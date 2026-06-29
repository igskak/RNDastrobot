#!/usr/bin/env python3
"""Backfill chart birth_place values that were saved as raw coordinates."""
from __future__ import annotations

import argparse
import logging
import math
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from uuid import UUID

from dotenv import load_dotenv
from sqlalchemy import text


ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

load_dotenv()

from app.database.connection import get_db_session  # noqa: E402


logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

COORDINATE_PLACE_RE = re.compile(r'^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$')
DEFAULT_MAX_DISTANCE_KM = 25.0


@dataclass(frozen=True)
class ChartCandidate:
    user_id: UUID
    astrologer_id: UUID
    birth_place: str
    lat: float
    lon: float


@dataclass(frozen=True)
class CityMatch:
    label: str
    distance_km: float
    geoname_id: int
    population: int
    feature_code: str


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0088
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return radius_km * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _unique_parts(parts: Iterable[str | None]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for part in parts:
        value = str(part or '').strip()
        key = value.casefold()
        if value and key not in seen:
            result.append(value)
            seen.add(key)
    return result


def _city_label(row: dict, *, city_only: bool) -> str:
    name = str(row.get('name') or '').strip()
    if city_only:
        return name
    parts = _unique_parts([name, row.get('admin1_name'), row.get('country_name')])
    return ', '.join(parts) if parts else name


def _load_candidates(db, *, astrologer_id: str | None, limit: int | None) -> list[ChartCandidate]:
    sql = """
        SELECT user_id, astrologer_id, birth_place, lat, lon
        FROM users
        WHERE birth_place ~ :coord_re
    """
    params: dict[str, object] = {
        'coord_re': r'^\s*-?[0-9]+(\.[0-9]+)?\s*,\s*-?[0-9]+(\.[0-9]+)?\s*$',
    }
    if astrologer_id:
        sql += " AND astrologer_id = :astrologer_id"
        params['astrologer_id'] = astrologer_id
    sql += " ORDER BY created_at ASC, user_id ASC"
    if limit is not None:
        sql += " LIMIT :limit"
        params['limit'] = limit

    rows = db.execute(text(sql), params).mappings().all()
    candidates: list[ChartCandidate] = []
    for row in rows:
        birth_place = str(row['birth_place'] or '').strip()
        if not COORDINATE_PLACE_RE.match(birth_place):
            continue
        candidates.append(
            ChartCandidate(
                user_id=row['user_id'],
                astrologer_id=row['astrologer_id'],
                birth_place=birth_place,
                lat=float(row['lat']),
                lon=float(row['lon']),
            )
        )
    return candidates


def _find_nearest_city(db, candidate: ChartCandidate, *, max_distance_km: float, city_only: bool) -> CityMatch | None:
    degree_delta = max(max_distance_km / 111.0, 0.05)
    rows = db.execute(
        text(
            """
            SELECT
                geoname_id,
                name,
                admin1_name,
                country_name,
                latitude,
                longitude,
                population,
                feature_code
            FROM geo_cities
            WHERE latitude BETWEEN :min_lat AND :max_lat
              AND longitude BETWEEN :min_lon AND :max_lon
            ORDER BY ABS(latitude - :lat) + ABS(longitude - :lon) ASC, population DESC
            LIMIT 100
            """
        ),
        {
            'lat': candidate.lat,
            'lon': candidate.lon,
            'min_lat': candidate.lat - degree_delta,
            'max_lat': candidate.lat + degree_delta,
            'min_lon': candidate.lon - degree_delta,
            'max_lon': candidate.lon + degree_delta,
        },
    ).mappings().all()

    matches: list[tuple[float, int, int, dict]] = []
    for row in rows:
        distance = _haversine_km(candidate.lat, candidate.lon, float(row['latitude']), float(row['longitude']))
        if distance <= max_distance_km:
            feature_code = str(row.get('feature_code') or '')
            feature_rank = 1 if feature_code == 'PPLX' else 0
            matches.append((distance, feature_rank, int(row.get('population') or 0), dict(row)))

    if not matches:
        return None

    nearest_distance = min(item[0] for item in matches)
    close_window_km = min(max_distance_km, max(2.0, nearest_distance + 0.5))
    close_matches = [item for item in matches if item[0] <= close_window_km]
    distance, _feature_rank, population, row = sorted(
        close_matches,
        key=lambda item: (item[1], -item[2], round(item[0], 3)),
    )[0]
    label = _city_label(row, city_only=city_only)
    if not label:
        return None
    return CityMatch(
        label=label[:255],
        distance_km=distance,
        geoname_id=int(row['geoname_id']),
        population=population,
        feature_code=str(row.get('feature_code') or ''),
    )


def run_backfill(
    *,
    apply: bool = False,
    max_distance_km: float = DEFAULT_MAX_DISTANCE_KM,
    city_only: bool = False,
    astrologer_id: str | None = None,
    limit: int | None = None,
) -> dict[str, int]:
    db = get_db_session()
    stats = {
        'candidates': 0,
        'matched': 0,
        'updated': 0,
        'skipped_no_match': 0,
    }

    try:
        candidates = _load_candidates(db, astrologer_id=astrologer_id, limit=limit)
        stats['candidates'] = len(candidates)

        for candidate in candidates:
            match = _find_nearest_city(
                db,
                candidate,
                max_distance_km=max_distance_km,
                city_only=city_only,
            )
            if match is None:
                stats['skipped_no_match'] += 1
                logger.info(
                    "SKIP %s: no geo_cities match within %.1f km for %s",
                    candidate.user_id,
                    max_distance_km,
                    candidate.birth_place,
                )
                continue

            stats['matched'] += 1
            logger.info(
                "%s %s: %r -> %r (%.2f km, geoname:%s, feature:%s, pop:%s)",
                "UPDATE" if apply else "DRY-RUN",
                candidate.user_id,
                candidate.birth_place,
                match.label,
                match.distance_km,
                match.geoname_id,
                match.feature_code,
                match.population,
            )

            if apply:
                db.execute(
                    text(
                        """
                        UPDATE users
                        SET birth_place = :birth_place, updated_at = NOW()
                        WHERE user_id = :user_id
                        """
                    ),
                    {'birth_place': match.label, 'user_id': candidate.user_id},
                )
                stats['updated'] += 1

        if apply:
            db.commit()
        else:
            db.rollback()

        return stats
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description='Backfill users.birth_place when it contains raw "lat, lon" coordinates.',
    )
    parser.add_argument('--apply', action='store_true', help='Write changes to the database')
    parser.add_argument(
        '--max-distance-km',
        type=float,
        default=DEFAULT_MAX_DISTANCE_KM,
        help='Maximum allowed distance from chart coordinates to a geo_cities row',
    )
    parser.add_argument('--city-only', action='store_true', help='Save only city name instead of city, region, country')
    parser.add_argument('--astrologer-id', help='Limit backfill to one astrologer UUID')
    parser.add_argument('--limit', type=int, help='Process at most N candidate rows')
    args = parser.parse_args()

    if args.max_distance_km <= 0:
        raise SystemExit('--max-distance-km must be positive')

    stats = run_backfill(
        apply=args.apply,
        max_distance_km=args.max_distance_km,
        city_only=args.city_only,
        astrologer_id=args.astrologer_id,
        limit=args.limit,
    )
    logger.info('Coordinate birth_place backfill finished: %s', stats)


if __name__ == '__main__':
    main()

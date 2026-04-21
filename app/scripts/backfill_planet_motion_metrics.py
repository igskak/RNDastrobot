#!/usr/bin/env python3
"""Backfill cached planet motion metrics in natal_planets."""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

load_dotenv()

from app.database.connection import get_db_session  # noqa: E402
from app.database.models import NatalPlanet  # noqa: E402
from app.services.planet_characteristics_service import PlanetCharacteristicsService  # noqa: E402
from app.services.preferences_runtime import DEFAULT_STATIONARY_THRESHOLD_PERCENT  # noqa: E402


logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

DEFAULT_BATCH_SIZE = 500


def _to_stationary_code(stationary_type: str | None) -> str | None:
    if stationary_type == 'pre_retrograde':
        return 'SR'
    if stationary_type == 'pre_direct':
        return 'SD'
    if stationary_type in {'SR', 'SD'}:
        return stationary_type
    return None


def run_backfill(*, dry_run: bool = False, batch_size: int = DEFAULT_BATCH_SIZE) -> dict[str, int]:
    db = get_db_session()
    stats = {
        'rows_seen': 0,
        'rows_updated': 0,
        'speed_percent_updated': 0,
        'stationary_updated': 0,
        'stationary_type_updated': 0,
    }

    try:
        query = (
            db.query(NatalPlanet)
            .order_by(NatalPlanet.user_id.asc(), NatalPlanet.planet.asc())
            .yield_per(max(1, batch_size))
        )

        for planet in query:
            stats['rows_seen'] += 1

            speed = float(planet.speed or 0.0)
            retrograde = bool(planet.retrograde)
            speed_percent = PlanetCharacteristicsService.calculate_speed_percent(planet.planet, speed)
            is_stationary, stationary_type = PlanetCharacteristicsService.calculate_stationary_status(
                planet.planet,
                speed,
                retrograde,
                threshold_percent=DEFAULT_STATIONARY_THRESHOLD_PERCENT,
            )
            stationary_code = _to_stationary_code(stationary_type)

            row_changed = False
            current_speed_percent = float(planet.speed_percent) if planet.speed_percent is not None else None
            if current_speed_percent != speed_percent:
                planet.speed_percent = speed_percent
                stats['speed_percent_updated'] += 1
                row_changed = True

            if bool(planet.is_stationary) != is_stationary:
                planet.is_stationary = is_stationary
                stats['stationary_updated'] += 1
                row_changed = True

            if planet.stationary_type != stationary_code:
                planet.stationary_type = stationary_code
                stats['stationary_type_updated'] += 1
                row_changed = True

            if row_changed:
                stats['rows_updated'] += 1

            if stats['rows_seen'] % max(1, batch_size) == 0:
                if dry_run:
                    db.expire_all()
                else:
                    db.flush()
                logger.info(
                    "Processed %s rows, updated %s",
                    stats['rows_seen'],
                    stats['rows_updated'],
                )

        if dry_run:
            db.rollback()
        else:
            db.commit()

        return stats
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description='Backfill speed_percent / is_stationary / stationary_type in natal_planets',
    )
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without writing to the database')
    parser.add_argument(
        '--batch-size',
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help='Flush progress every N rows',
    )
    args = parser.parse_args()

    stats = run_backfill(
        dry_run=args.dry_run,
        batch_size=max(1, args.batch_size),
    )
    logger.info('Planet motion backfill finished: %s', stats)


if __name__ == '__main__':
    main()

"""
Импорт GeoNames cities*.txt в локальную таблицу geo_cities.

Пример:
  python3 app/database/import_geo_cities.py \
    --cities-file /path/to/cities5000.txt \
    --country-info-file /path/to/countryInfo.txt \
    --admin1-file /path/to/admin1CodesASCII.txt \
    --admin2-file /path/to/admin2Codes.txt
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Dict, Iterable, Optional

from sqlalchemy import text

from app.database.connection import db_manager


def parse_country_info(path: Optional[Path]) -> Dict[str, str]:
    if path is None or not path.exists():
        return {}
    result: Dict[str, str] = {}
    with path.open("r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("\t")
            if len(parts) < 5:
                continue
            iso = parts[0].strip()
            country_name = parts[4].strip()
            if iso:
                result[iso] = country_name
    return result


def parse_admin_codes(path: Optional[Path], name_idx: int) -> Dict[str, str]:
    if path is None or not path.exists():
        return {}
    result: Dict[str, str] = {}
    with path.open("r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("\t")
            if len(parts) <= name_idx:
                continue
            code = parts[0].strip()
            name = parts[name_idx].strip()
            if code:
                result[code] = name
    return result


def chunks(items: Iterable[dict], size: int):
    batch = []
    for item in items:
        batch.append(item)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


def parse_cities(
    path: Path,
    countries: Dict[str, str],
    admin1: Dict[str, str],
    admin2: Dict[str, str],
):
    with path.open("r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 19:
                continue

            feature_class = parts[6].strip()
            feature_code = parts[7].strip()
            if feature_class != "P":
                continue

            geoname_id = int(parts[0])
            name = parts[1].strip()
            ascii_name = parts[2].strip() or None
            alt_names = parts[3].strip() or None
            lat = float(parts[4])
            lon = float(parts[5])
            country_code = parts[8].strip()
            admin1_code = parts[10].strip() or None
            admin2_code = parts[11].strip() or None
            population = int(parts[14] or 0)
            timezone = parts[17].strip() or None

            admin1_key = f"{country_code}.{admin1_code}" if country_code and admin1_code else ""
            admin2_key = f"{country_code}.{admin1_code}.{admin2_code}" if country_code and admin1_code and admin2_code else ""

            yield {
                "geoname_id": geoname_id,
                "name": name,
                "ascii_name": ascii_name,
                "alternate_names": alt_names,
                "country_code": country_code,
                "country_name": countries.get(country_code, country_code),
                "admin1_code": admin1_code,
                "admin1_name": admin1.get(admin1_key),
                "admin2_code": admin2_code,
                "admin2_name": admin2.get(admin2_key),
                "latitude": lat,
                "longitude": lon,
                "population": population,
                "timezone": timezone,
                "feature_class": feature_class,
                "feature_code": feature_code,
            }


def main():
    parser = argparse.ArgumentParser(description="Import GeoNames cities into geo_cities table")
    parser.add_argument("--cities-file", required=True, type=Path)
    parser.add_argument("--country-info-file", type=Path)
    parser.add_argument("--admin1-file", type=Path)
    parser.add_argument("--admin2-file", type=Path)
    parser.add_argument("--batch-size", type=int, default=1000)
    args = parser.parse_args()

    if not args.cities_file.exists():
        raise SystemExit(f"Cities file not found: {args.cities_file}")

    countries = parse_country_info(args.country_info_file)
    admin1 = parse_admin_codes(args.admin1_file, name_idx=1)
    admin2 = parse_admin_codes(args.admin2_file, name_idx=1)

    stage_insert_sql = text(
        """
        INSERT INTO geo_cities_import_stage (
            geoname_id, name, ascii_name, alternate_names,
            country_code, country_name,
            admin1_code, admin1_name,
            admin2_code, admin2_name,
            latitude, longitude, population, timezone,
            feature_class, feature_code
        ) VALUES (
            :geoname_id, :name, :ascii_name, :alternate_names,
            :country_code, :country_name,
            :admin1_code, :admin1_name,
            :admin2_code, :admin2_name,
            :latitude, :longitude, :population, :timezone,
            :feature_class, :feature_code
        )
        ON CONFLICT (geoname_id) DO UPDATE SET
            name = EXCLUDED.name,
            ascii_name = EXCLUDED.ascii_name,
            alternate_names = EXCLUDED.alternate_names,
            country_code = EXCLUDED.country_code,
            country_name = EXCLUDED.country_name,
            admin1_code = EXCLUDED.admin1_code,
            admin1_name = EXCLUDED.admin1_name,
            admin2_code = EXCLUDED.admin2_code,
            admin2_name = EXCLUDED.admin2_name,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            population = EXCLUDED.population,
            timezone = EXCLUDED.timezone,
            feature_class = EXCLUDED.feature_class,
            feature_code = EXCLUDED.feature_code,
            updated_at = NOW()
        """
    )

    create_stage_sql = text(
        """
        CREATE TEMP TABLE IF NOT EXISTS geo_cities_import_stage
        (LIKE geo_cities INCLUDING DEFAULTS INCLUDING CONSTRAINTS)
        ON COMMIT DROP
        """
    )

    truncate_stage_sql = text("TRUNCATE TABLE geo_cities_import_stage")

    lock_target_sql = text("LOCK TABLE geo_cities IN ACCESS EXCLUSIVE MODE")
    truncate_target_sql = text("TRUNCATE TABLE geo_cities")
    copy_to_target_sql = text(
        """
        INSERT INTO geo_cities (
            geoname_id, name, ascii_name, alternate_names,
            country_code, country_name,
            admin1_code, admin1_name,
            admin2_code, admin2_name,
            latitude, longitude, population, timezone,
            feature_class, feature_code
        )
        SELECT
            geoname_id, name, ascii_name, alternate_names,
            country_code, country_name,
            admin1_code, admin1_name,
            admin2_code, admin2_name,
            latitude, longitude, population, timezone,
            feature_class, feature_code
        FROM geo_cities_import_stage
        """
    )

    total = 0
    with db_manager.get_session() as session:
        session.execute(create_stage_sql)
        session.execute(truncate_stage_sql)

        for batch in chunks(parse_cities(args.cities_file, countries, admin1, admin2), args.batch_size):
            session.execute(stage_insert_sql, batch)
            total += len(batch)
            if total % (args.batch_size * 10) == 0:
                print(f"Imported rows: {total}")

        # Атомарная замена данных под эксклюзивной блокировкой:
        # внешние читатели не увидят "пустое окно".
        session.execute(lock_target_sql)
        session.execute(truncate_target_sql)
        session.execute(copy_to_target_sql)

    print(f"Done. Imported rows: {total}")


if __name__ == "__main__":
    main()

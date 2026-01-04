#!/usr/bin/env python3
"""
Імпорт психологічних довідників у Supabase
Читає CSV файли та завантажує дані в таблиці
"""
import csv
import sys
import os
from pathlib import Path
from io import StringIO
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

# Базова директорія проекту
BASE_DIR = Path(__file__).parent.parent.parent
REF_DIR = BASE_DIR / 'ref'

# Завантажити змінні з .env
load_dotenv(BASE_DIR / 'app' / '.env')


def read_quoted_csv(csv_file):
    """
    Читає CSV файл, де кожен рядок обгорнутий в лапки
    Повертає DictReader
    """
    with open(csv_file, 'r', encoding='utf-8') as f:
        content = f.read()
        # Видалити зовнішні лапки з кожного рядка
        lines = []
        for line in content.strip().split('\n'):
            line = line.strip()
            if line.startswith('"') and line.endswith('"'):
                line = line[1:-1]
            lines.append(line)

        # Тепер парсимо як CSV
        csv_content = StringIO('\n'.join(lines))
        return csv.DictReader(csv_content)


def connect_to_supabase():
    """Підключення до Supabase"""
    # Спробувати отримати параметри з .env
    database_url = os.getenv('DATABASE_URL')

    if database_url:
        print("\n🔌 Підключення до Supabase (з .env)...")
        try:
            conn = psycopg2.connect(database_url)
            print("✅ Підключення успішне!")
            return conn
        except Exception as e:
            print(f"❌ Помилка підключення: {e}")
            sys.exit(1)

    # Якщо DATABASE_URL немає, запитати параметри вручну
    print("\n📝 DATABASE_URL не знайдено в .env")
    print("Введіть параметри підключення до Supabase:")
    print("(Знайти в: Supabase Dashboard → Settings → Database)")
    print()

    host = input("Host (db.xxxxx.supabase.co): ").strip()
    port = input("Port [5432]: ").strip() or "5432"
    database = input("Database [postgres]: ").strip() or "postgres"
    user = input("User [postgres]: ").strip() or "postgres"
    password = input("Password: ").strip()

    if not host or not password:
        print("❌ Host та Password обов'язкові!")
        sys.exit(1)

    print("\n🔌 Підключення до Supabase...")

    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            database=database,
            user=user,
            password=password
        )
        print("✅ Підключення успішне!")
        return conn
    except Exception as e:
        print(f"❌ Помилка підключення: {e}")
        sys.exit(1)


def import_planet_psych_functions(conn):
    """Імпорт психологічних функцій планет"""
    csv_file = REF_DIR / 'ref_planet_psych_functions - Sheet1.csv'

    print(f"\n📄 Імпорт: {csv_file.name}")

    if not csv_file.exists():
        print(f"❌ Файл не знайдено: {csv_file}")
        return False

    cursor = conn.cursor()

    # Очистити таблицю
    cursor.execute("TRUNCATE TABLE ref_planet_psych_functions RESTART IDENTITY CASCADE;")

    # Читати CSV
    reader = read_quoted_csv(csv_file)
    rows = []

    for row in reader:
        rows.append((
            row['planet'],
            row['function_core'],
            row['function_extended'],
            row['archetype'],
            row['keywords_positive'],
            row['keywords_shadow'],
            row['low_level_manifestation'],
            row['high_level_manifestation']
        ))

    # Вставити дані
    execute_values(
        cursor,
        """
        INSERT INTO ref_planet_psych_functions
        (planet, function_core, function_extended, archetype, keywords_positive,
         keywords_shadow, low_level_manifestation, high_level_manifestation)
        VALUES %s
        """,
        rows
    )

    conn.commit()
    print(f"✅ Імпортовано {len(rows)} записів")
    cursor.close()
    return True


def import_planet_in_sign_psych(conn):
    """Імпорт планет у знаках (психологія)"""
    csv_file = REF_DIR / 'ref_planet_in_sign_psych.csv'

    print(f"\n📄 Імпорт: {csv_file.name}")

    if not csv_file.exists():
        print(f"❌ Файл не знайдено: {csv_file}")
        return False

    cursor = conn.cursor()

    # Очистити таблицю
    cursor.execute("TRUNCATE TABLE ref_planet_in_sign_psych RESTART IDENTITY CASCADE;")

    # Читати CSV
    reader = read_quoted_csv(csv_file)
    rows = []

    for row in reader:
        rows.append((
            row['planet'],
            row['sign'],
            row['summary'],
            row['detailed_description'],
            row['strengths'],
            row['risks'],
            row['defense_mechanisms']
        ))

    # Вставити дані
    execute_values(
        cursor,
        """
        INSERT INTO ref_planet_in_sign_psych
        (planet, sign, summary, detailed_description, strengths, risks, defense_mechanisms)
        VALUES %s
        """,
        rows
    )

    conn.commit()
    print(f"✅ Імпортовано {len(rows)} записів")
    cursor.close()
    return True


def import_planet_in_house_psych(conn):
    """Імпорт планет у домах (психологія)"""
    csv_file = REF_DIR / 'ref_planet_in_house_psych.csv'

    print(f"\n📄 Імпорт: {csv_file.name}")

    if not csv_file.exists():
        print(f"❌ Файл не знайдено: {csv_file}")
        return False

    cursor = conn.cursor()

    # Очистити таблицю
    cursor.execute("TRUNCATE TABLE ref_planet_in_house_psych RESTART IDENTITY CASCADE;")

    # Читати CSV
    reader = read_quoted_csv(csv_file)
    rows = []

    for row in reader:
        rows.append((
            row['planet'],
            int(row['house_number']),
            row['summary'],
            row['detailed_description'],
            row['life_area_focus'],
            row['inner_conflicts']
        ))

    # Вставити дані
    execute_values(
        cursor,
        """
        INSERT INTO ref_planet_in_house_psych
        (planet, house_number, summary, detailed_description, life_area_focus, inner_conflicts)
        VALUES %s
        """,
        rows
    )

    conn.commit()
    print(f"✅ Імпортовано {len(rows)} записів")
    cursor.close()
    return True


def import_aspect_psych(conn):
    """Імпорт аспектів (психологія)"""
    csv_file = REF_DIR / 'ref_aspect_psych.csv'

    print(f"\n📄 Імпорт: {csv_file.name}")

    if not csv_file.exists():
        print(f"❌ Файл не знайдено: {csv_file}")
        return False

    cursor = conn.cursor()

    # Очистити таблицю
    cursor.execute("TRUNCATE TABLE ref_aspect_psych RESTART IDENTITY CASCADE;")

    # Читати CSV
    reader = read_quoted_csv(csv_file)
    rows = []

    for row in reader:
        rows.append((
            row['planet_1'],
            row['planet_2'],
            row['aspect_type'],
            row['role'],
            row['summary'],
            row['detailed_description'],
            row['typical_patterns'],
            row['shadow_scenarios']
        ))

    # Вставити дані
    execute_values(
        cursor,
        """
        INSERT INTO ref_aspect_psych
        (planet_1, planet_2, aspect_type, role, summary, detailed_description,
         typical_patterns, shadow_scenarios)
        VALUES %s
        """,
        rows
    )

    conn.commit()
    print(f"✅ Імпортовано {len(rows)} записів")
    cursor.close()
    return True


def main():
    """Головна функція"""
    print("=" * 80)
    print("🚀 ІМПОРТ ПСИХОЛОГІЧНИХ ДОВІДНИКІВ У SUPABASE")
    print("=" * 80)

    # Підключення
    conn = connect_to_supabase()

    # Імпорт даних
    results = []
    results.append(("Психологічні функції планет", import_planet_psych_functions(conn)))
    results.append(("Планети в знаках", import_planet_in_sign_psych(conn)))
    results.append(("Планети в домах", import_planet_in_house_psych(conn)))
    results.append(("Аспекти", import_aspect_psych(conn)))

    # Закрити підключення
    conn.close()

    # Підсумок
    print("\n" + "=" * 80)
    print("📊 ПІДСУМОК ІМПОРТУ:")
    print("=" * 80)

    for name, success in results:
        status = "✅" if success else "❌"
        print(f"{status} {name}")

    all_ok = all(r[1] for r in results)

    if all_ok:
        print("\n🎉 ВСІ ДОВІДНИКИ УСПІШНО ІМПОРТОВАНО!")
    else:
        print("\n⚠️  ДЕЯКІ ДОВІДНИКИ НЕ ІМПОРТОВАНО")

    print("=" * 80)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Перервано користувачем")
        sys.exit(1)


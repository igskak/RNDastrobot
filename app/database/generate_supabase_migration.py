#!/usr/bin/env python3
"""
Генератор міграційного скрипта для Supabase
Об'єднує всі schema та seed файли в один SQL файл
"""
import os
from pathlib import Path

# Базова директорія
BASE_DIR = Path(__file__).parent

# Файли схеми (в порядку застосування)
SCHEMA_FILES = [
    'schema/00_master_schema.sql',
    'schema/01_core_tables.sql',
    'schema/02_special_points.sql',
    'schema/03_reference_tables.sql',
    'schema/04_karma_reference_tables.sql',
    'schema/05_balance_tables.sql',
    'schema/06_analysis_tables.sql',
    'schema/07_topic_tables.sql',
    'schema/08_karma_tables.sql',
    'schema/09_support_challenge_tables.sql',
]

# Файли seeds (в порядку застосування)
SEED_FILES = [
    'seeds/01_sign_properties.sql',
    'seeds/02_aspect_types.sql',
    'seeds/03_house_meanings.sql',
    'seeds/04_chakra_mapping.sql',
    'seeds/05_configuration_types.sql',
    'seeds/06_cosmogram_patterns.sql',
]

# Вихідний файл
OUTPUT_FILE = BASE_DIR / 'supabase_migration.sql'


def read_sql_file(filepath: Path) -> str:
    """Читає SQL файл та повертає його вміст, фільтруючи проблемні команди"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Видалити команди \i (psql include) - вони не працюють в Supabase
        lines = content.split('\n')
        filtered_lines = []
        skip_grant_section = False

        for line in lines:
            # Пропустити команди \i
            if line.strip().startswith('\\i '):
                continue

            # Пропустити секцію GRANT (потребує astrobot_user)
            if 'GRANT PERMISSIONS' in line or 'GRANT USAGE' in line:
                skip_grant_section = True

            if skip_grant_section:
                if line.strip().startswith('--') and '=' * 10 in line:
                    skip_grant_section = False
                continue

            # Пропустити окремі GRANT команди
            if line.strip().startswith('GRANT ') or line.strip().startswith('ALTER DEFAULT PRIVILEGES'):
                continue

            filtered_lines.append(line)

        return '\n'.join(filtered_lines)
    except Exception as e:
        print(f"⚠️  Помилка читання {filepath}: {e}")
        return ""


def generate_migration():
    """Генерує об'єднаний міграційний файл"""
    
    print("🚀 Генерація Supabase міграції...")
    print("=" * 80)
    
    # Початок файлу
    content = []
    content.append("-- " + "=" * 76)
    content.append("-- SUPABASE MIGRATION SCRIPT")
    content.append("-- Застосування схеми та seeds для пунктів 3.1, 3.2, 3.3")
    content.append("-- Дата: 2025-11-27")
    content.append("-- " + "=" * 76)
    content.append("")
    content.append("-- ВАЖЛИВО: Виконувати в Supabase SQL Editor!")
    content.append("-- Можна виконати весь файл одразу або по частинах")
    content.append("")
    content.append("BEGIN;")
    content.append("")
    
    # Додати схему
    content.append("-- " + "=" * 76)
    content.append("-- ЧАСТИНА 1: СХЕМА БД (CREATE TABLE)")
    content.append("-- " + "=" * 76)
    content.append("")
    
    for schema_file in SCHEMA_FILES:
        filepath = BASE_DIR / schema_file
        if filepath.exists():
            print(f"✅ Додаю схему: {schema_file}")
            content.append(f"-- {'-' * 76}")
            content.append(f"-- Файл: {schema_file}")
            content.append(f"-- {'-' * 76}")
            content.append("")
            content.append(read_sql_file(filepath))
            content.append("")
        else:
            print(f"⚠️  Файл не знайдено: {schema_file}")
    
    # Додати seeds
    content.append("")
    content.append("-- " + "=" * 76)
    content.append("-- ЧАСТИНА 2: SEEDS (INSERT INTO)")
    content.append("-- " + "=" * 76)
    content.append("")
    
    for seed_file in SEED_FILES:
        filepath = BASE_DIR / seed_file
        if filepath.exists():
            print(f"✅ Додаю seed: {seed_file}")
            content.append(f"-- {'-' * 76}")
            content.append(f"-- Файл: {seed_file}")
            content.append(f"-- {'-' * 76}")
            content.append("")
            content.append(read_sql_file(filepath))
            content.append("")
        else:
            print(f"⚠️  Файл не знайдено: {seed_file}")
    
    # Кінець файлу
    content.append("")
    content.append("COMMIT;")
    content.append("")
    content.append("-- " + "=" * 76)
    content.append("-- МІГРАЦІЯ ЗАВЕРШЕНА!")
    content.append("-- " + "=" * 76)
    
    # Записати файл
    final_content = "\n".join(content)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(final_content)
    
    print("=" * 80)
    print(f"✅ Міграційний файл створено: {OUTPUT_FILE}")
    print(f"📊 Розмір: {len(final_content)} символів")
    print(f"📄 Рядків: {len(final_content.splitlines())}")
    print("")
    print("🎯 Наступні кроки:")
    print("1. Відкрити Supabase Dashboard → SQL Editor")
    print("2. Скопіювати вміст файлу supabase_migration.sql")
    print("3. Вставити в SQL Editor та виконати")
    print("")


if __name__ == '__main__':
    generate_migration()


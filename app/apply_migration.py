#!/usr/bin/env python3
"""
Скрипт для применения миграции БД
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Загружаем переменные окружения
load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

# Создаём подключение
engine = create_engine(DATABASE_URL, echo=True)

import sys

if len(sys.argv) < 2:
    print("Usage: python app/apply_migration.py <migration_file>")
    sys.exit(1)

migration_file = sys.argv[1]

print("=" * 80)
print(f"🔄 Применение миграции: {migration_file}")
print("=" * 80)

# Читаем SQL-файл
with open(migration_file, 'r') as f:
    migration_sql = f.read()

# Применяем миграцию
with engine.begin() as conn:
    conn.execute(text(migration_sql))
    print("\n✅ Миграция успешно применена!")

print("=" * 80)


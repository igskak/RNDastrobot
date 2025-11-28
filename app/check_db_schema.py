#!/usr/bin/env python3
"""
Скрипт для проверки схемы БД
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Загружаем переменные окружения
load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

# Создаём подключение
engine = create_engine(DATABASE_URL, echo=False)

print("=" * 80)
print("🔍 Проверка схемы БД")
print("=" * 80)

with engine.connect() as conn:
    # Проверяем существующие таблицы
    print("\n1️⃣  Существующие таблицы:")
    result = conn.execute(text("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    """))
    tables = [row[0] for row in result]
    for table in tables:
        print(f"   - {table}")
    
    # Проверяем структуру natal_configurations
    if 'natal_configurations' in tables:
        print("\n2️⃣  Структура natal_configurations:")
        result = conn.execute(text("""
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'natal_configurations'
            ORDER BY ordinal_position;
        """))
        for row in result:
            print(f"   - {row[0]}: {row[1]}" + (f"({row[2]})" if row[2] else ""))
    else:
        print("\n❌ Таблица natal_configurations не найдена!")

print("\n" + "=" * 80)


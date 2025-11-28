#!/usr/bin/env python3
"""
Автоматичне застосування міграції в Supabase через psycopg2
"""
import os
import sys
from pathlib import Path

try:
    import psycopg2
except ImportError:
    print("❌ Помилка: psycopg2 не встановлено")
    print("Встановіть: pip install psycopg2-binary")
    sys.exit(1)


def apply_migration():
    """Застосувати міграцію в Supabase"""
    
    print("🚀 Застосування міграції в Supabase...")
    print("=" * 80)
    
    # Отримати параметри підключення
    print("\n📝 Введіть параметри підключення до Supabase:")
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
    
    # Підключення до БД
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
    except Exception as e:
        print(f"❌ Помилка підключення: {e}")
        sys.exit(1)
    
    # Читати міграційний файл
    migration_file = Path(__file__).parent / 'supabase_migration.sql'
    
    if not migration_file.exists():
        print(f"❌ Файл міграції не знайдено: {migration_file}")
        print("Спочатку запустіть: python generate_supabase_migration.py")
        sys.exit(1)
    
    print(f"\n📄 Читання міграційного файлу...")
    with open(migration_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    print(f"✅ Прочитано {len(sql_content)} символів")
    
    # Застосувати міграцію
    print("\n⚙️  Застосування міграції...")
    print("Це може зайняти 10-30 секунд...")
    
    try:
        cursor = conn.cursor()
        cursor.execute(sql_content)
        conn.commit()
        print("✅ Міграція успішно застосована!")
    except Exception as e:
        print(f"❌ Помилка виконання міграції: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        cursor.close()
    
    # Перевірка
    print("\n🔍 Перевірка результатів...")
    
    checks = [
        ("Таблиці", "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'", None),
        ("Знаки", "SELECT COUNT(*) FROM ref_sign_properties", 12),
        ("Аспекти", "SELECT COUNT(*) FROM ref_aspect_types", 18),
        ("Конфігурації", "SELECT COUNT(*) FROM ref_configuration_types", 4),
        ("Паттерни", "SELECT COUNT(*) FROM ref_cosmogram_patterns", 7),
    ]
    
    cursor = conn.cursor()
    all_ok = True
    
    for name, query, expected in checks:
        try:
            cursor.execute(query)
            count = cursor.fetchone()[0]
            
            if expected and count != expected:
                print(f"⚠️  {name}: {count} (очікувалось {expected})")
                all_ok = False
            else:
                print(f"✅ {name}: {count}")
        except Exception as e:
            print(f"❌ {name}: помилка - {e}")
            all_ok = False
    
    cursor.close()
    conn.close()
    
    # Підсумок
    print("\n" + "=" * 80)
    if all_ok:
        print("🎉 МІГРАЦІЯ ЗАВЕРШЕНА УСПІШНО!")
        print("\n📚 Наступні кроки:")
        print("1. Оновити параметри підключення в app/database/config.py")
        print("2. Протестувати підключення: python -c 'from database.connection import get_db_session; print(get_db_session())'")
        print("3. Запустити тести: pytest tests/test_aspects_and_configurations.py")
    else:
        print("⚠️  МІГРАЦІЯ ЗАВЕРШЕНА З ПОПЕРЕДЖЕННЯМИ")
        print("Перевірте логи вище для деталей")
    print("=" * 80)


if __name__ == '__main__':
    try:
        apply_migration()
    except KeyboardInterrupt:
        print("\n\n❌ Перервано користувачем")
        sys.exit(1)


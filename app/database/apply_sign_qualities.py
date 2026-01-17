#!/usr/bin/env python3
"""
Скрипт для добавления качеств знаков в базу данных
"""
import sys
from pathlib import Path

# Добавляем корневую директорию в путь
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.database.connection import get_db_session
from sqlalchemy import text


def apply_sign_qualities():
    """Применить качества знаков"""
    
    migration_file = Path(__file__).parent / 'migrations' / 'add_sign_qualities.sql'
    
    if not migration_file.exists():
        print(f"❌ Файл не найден: {migration_file}")
        return False
    
    print(f"📄 Применение миграции: {migration_file.name}")
    
    try:
        with get_db_session() as session:
            # Читаем SQL файл
            with open(migration_file, 'r', encoding='utf-8') as f:
                sql_content = f.read()
            
            # Выполняем SQL
            session.execute(text(sql_content))
            session.commit()
            
            print("✅ Качества знаков успешно добавлены в базу данных")
            
            # Проверка
            result = session.execute(
                text("""
                    SELECT sign, LEFT(qualities, 80) || '...' as preview 
                    FROM ref_sign_properties 
                    WHERE qualities IS NOT NULL
                    ORDER BY 
                      CASE sign
                        WHEN 'Aries' THEN 1
                        WHEN 'Taurus' THEN 2
                        WHEN 'Gemini' THEN 3
                        WHEN 'Cancer' THEN 4
                        WHEN 'Leo' THEN 5
                        WHEN 'Virgo' THEN 6
                        WHEN 'Libra' THEN 7
                        WHEN 'Scorpio' THEN 8
                        WHEN 'Sagittarius' THEN 9
                        WHEN 'Capricorn' THEN 10
                        WHEN 'Aquarius' THEN 11
                        WHEN 'Pisces' THEN 12
                      END
                """)
            )
            
            print("\n📊 Добавленные качества знаков:")
            for row in result:
                print(f"  ♈ {row[0]}: {row[1]}")
            
            return True
            
    except Exception as e:
        print(f"❌ Ошибка при применении: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    success = apply_sign_qualities()
    sys.exit(0 if success else 1)


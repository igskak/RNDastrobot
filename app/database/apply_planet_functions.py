#!/usr/bin/env python3
"""
Скрипт для применения функций психики планет к базе данных
"""
import sys
from pathlib import Path

# Добавляем корневую директорию в путь
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.database.connection import get_db_session
from sqlalchemy import text


def apply_planet_functions():
    """Применить функции психики планет"""
    
    sql_file = Path(__file__).parent / 'seeds' / '07a_planet_psych_functions_data.sql'
    
    if not sql_file.exists():
        print(f"❌ Файл не найден: {sql_file}")
        return False
    
    print(f"📄 Применение: {sql_file.name}")
    
    try:
        with get_db_session() as session:
            # Читаем SQL файл
            with open(sql_file, 'r', encoding='utf-8') as f:
                sql_content = f.read()
            
            # Выполняем SQL
            session.execute(text(sql_content))
            session.commit()
            
            print("✅ Функции психики планет успешно добавлены в базу данных")
            
            # Проверка
            result = session.execute(
                text("SELECT planet, function_core FROM ref_planet_psych_functions ORDER BY planet")
            )
            
            print("\n📊 Добавленные планеты:")
            for row in result:
                print(f"  - {row[0]}: {row[1]}")
            
            return True
            
    except Exception as e:
        print(f"❌ Ошибка при применении: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    success = apply_planet_functions()
    sys.exit(0 if success else 1)


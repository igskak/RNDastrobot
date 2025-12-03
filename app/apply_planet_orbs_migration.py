"""
Применение миграции для системы индивидуальных орбисов планет
"""
from app.database.connection import get_db_session
from sqlalchemy import text
import os

def read_sql_file(filepath: str) -> str:
    """Прочитать SQL файл"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()


def apply_schema():
    """Применить схему таблицы ref_planet_orbs"""
    print("="*80)
    print("ШАГ 1: Применение схемы таблицы ref_planet_orbs")
    print("="*80)
    
    schema_file = 'app/database/schema/03a_planet_orbs.sql'
    
    if not os.path.exists(schema_file):
        print(f"❌ Файл не найден: {schema_file}")
        return False
    
    sql = read_sql_file(schema_file)
    
    with get_db_session() as db:
        try:
            # Выполнить SQL
            db.execute(text(sql))
            db.commit()
            print("✅ Схема успешно применена")
            
            # Проверить создание таблицы
            result = db.execute(text("""
                SELECT COUNT(*) as count 
                FROM information_schema.tables 
                WHERE table_name = 'ref_planet_orbs'
            """))
            count = result.scalar()
            
            if count > 0:
                print("✅ Таблица ref_planet_orbs создана")
                return True
            else:
                print("❌ Таблица ref_planet_orbs не найдена после создания")
                return False
                
        except Exception as e:
            print(f"❌ Ошибка применения схемы: {e}")
            db.rollback()
            return False


def apply_seeds():
    """Загрузить данные орбисов"""
    print("\n" + "="*80)
    print("ШАГ 2: Загрузка данных орбисов планет")
    print("="*80)
    
    seeds_file = 'app/database/seeds/02b_planet_orbs.sql'
    
    if not os.path.exists(seeds_file):
        print(f"❌ Файл не найден: {seeds_file}")
        return False
    
    sql = read_sql_file(seeds_file)
    
    with get_db_session() as db:
        try:
            # Выполнить SQL
            db.execute(text(sql))
            db.commit()
            print("✅ Данные успешно загружены")
            
            # Проверить количество записей
            result = db.execute(text("SELECT COUNT(*) FROM ref_planet_orbs"))
            count = result.scalar()
            print(f"✅ Загружено записей: {count}")
            
            # Проверить количество аспектов
            result = db.execute(text("SELECT COUNT(*) FROM ref_aspect_types"))
            aspect_count = result.scalar()
            print(f"✅ Типов аспектов в системе: {aspect_count}")
            
            return True
            
        except Exception as e:
            print(f"❌ Ошибка загрузки данных: {e}")
            db.rollback()
            return False


def verify_migration():
    """Проверить результаты миграции"""
    print("\n" + "="*80)
    print("ШАГ 3: Проверка результатов миграции")
    print("="*80)
    
    with get_db_session() as db:
        try:
            # Проверка 1: Количество записей
            result = db.execute(text("""
                SELECT 
                    COUNT(*) as total,
                    COUNT(DISTINCT planet) as planets,
                    COUNT(DISTINCT aspect_type) as aspects
                FROM ref_planet_orbs
            """))
            row = result.fetchone()
            
            print(f"\n📊 Статистика:")
            print(f"   Всего записей: {row[0]}")
            print(f"   Уникальных планет: {row[1]}")
            print(f"   Уникальных аспектов: {row[2]}")
            print(f"   Ожидается: {row[1]} × {row[2]} = {row[1] * row[2]}")
            
            # Проверка 2: Примеры орбисов
            print(f"\n🔍 Примеры орбисов:")
            result = db.execute(text("""
                SELECT planet, aspect_type, orb 
                FROM ref_planet_orbs 
                WHERE planet IN ('Sun', 'Moon', 'Pluto', 'BlackMoon')
                  AND aspect_type = 'Conjunction'
                ORDER BY orb DESC
            """))
            
            for row in result:
                print(f"   {row[0]:15} + {row[1]:15} = {row[2]}°")
            
            # Проверка 3: Исключённые аспекты
            print(f"\n❌ Проверка исключённых аспектов:")
            excluded = ['Vigintile', 'Semi_Nonagon', 'Binonagon', 'Sentagon']
            
            for aspect in excluded:
                result = db.execute(text(
                    "SELECT COUNT(*) FROM ref_aspect_types WHERE aspect_type = :aspect"
                ), {"aspect": aspect})
                count = result.scalar()
                
                if count == 0:
                    print(f"   ✅ {aspect} успешно удалён")
                else:
                    print(f"   ⚠️  {aspect} всё ещё существует")
            
            return True
            
        except Exception as e:
            print(f"❌ Ошибка проверки: {e}")
            return False


def main():
    """Главная функция миграции"""
    print("\n" + "🚀"*40)
    print("ПРИМЕНЕНИЕ МИГРАЦИИ: СИСТЕМА ИНДИВИДУАЛЬНЫХ ОРБИСОВ ПЛАНЕТ")
    print("🚀"*40 + "\n")
    
    # Шаг 1: Применить схему
    if not apply_schema():
        print("\n❌ МИГРАЦИЯ ПРЕРВАНА: Ошибка применения схемы")
        return
    
    # Шаг 2: Загрузить данные
    if not apply_seeds():
        print("\n❌ МИГРАЦИЯ ПРЕРВАНА: Ошибка загрузки данных")
        return
    
    # Шаг 3: Проверить результаты
    if not verify_migration():
        print("\n⚠️  МИГРАЦИЯ ЗАВЕРШЕНА С ПРЕДУПРЕЖДЕНИЯМИ")
        return
    
    print("\n" + "="*80)
    print("✅ МИГРАЦИЯ УСПЕШНО ЗАВЕРШЕНА!")
    print("="*80)
    print("\nТеперь можно запустить тесты:")
    print("  python app/test_planet_orbs.py")
    print("  python app/test_user_request.py")
    print()


if __name__ == "__main__":
    main()


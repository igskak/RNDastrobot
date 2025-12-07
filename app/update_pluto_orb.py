"""
Скрипт для оновлення орбісу Плутона в соединенні з 3.0 на 5.0
"""
from app.database.connection import get_db_session
from sqlalchemy import text

def update_pluto_conjunction_orb():
    """Оновити орбіс Плутона для соединення"""
    session = get_db_session()
    
    try:
        # Оновити орбіс Плутона для Conjunction
        query = text("""
            UPDATE ref_planet_orbs 
            SET orb = 5.0 
            WHERE planet = 'Pluto' AND aspect_type = 'Conjunction'
        """)
        
        result = session.execute(query)
        session.commit()
        
        # Перевірити результат
        check_query = text("""
            SELECT planet, aspect_type, orb 
            FROM ref_planet_orbs 
            WHERE planet = 'Pluto' AND aspect_type = 'Conjunction'
        """)
        
        row = session.execute(check_query).fetchone()
        
        if row:
            print(f"✅ Орбіс Плутона успішно оновлено:")
            print(f"   Планета: {row[0]}")
            print(f"   Аспект: {row[1]}")
            print(f"   Орбіс: {row[2]}°")
        else:
            print("❌ Запис не знайдено")
            
    except Exception as e:
        session.rollback()
        print(f"❌ Помилка: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    print("🔄 Оновлення орбісу Плутона для соединення...")
    update_pluto_conjunction_orb()


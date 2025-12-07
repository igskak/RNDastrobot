"""
Перерахунок натальної карти для тестового користувача
з новими орбісами (правило MAX)
"""
from datetime import datetime
from app.database.connection import get_db_session
from app.services.aspect_service import AspectService
from app.services.configuration_service import ConfigurationService
from app.database.models import User, NatalAspect
from sqlalchemy import text

def recalculate_natal_chart():
    """Перерахувати натальну карту"""
    session = get_db_session()
    
    try:
        # Дані тестового користувача
        birth_data = {
            'date': '1990-09-11',
            'time': '09:39:00',
            'timezone': 'Europe/Kiev',
            'latitude': 50.0,
            'longitude': 36.25
        }
        
        print("🔄 Перерахунок натальної карти...")
        print(f"📅 Дата: {birth_data['date']}")
        print(f"⏰ Час: {birth_data['time']}")
        print(f"🌍 Координати: {birth_data['latitude']}°N, {birth_data['longitude']}°E")
        print()
        
        # Знайти або створити користувача
        user = session.query(User).filter(
            User.birth_date == datetime.strptime(birth_data['date'], '%Y-%m-%d').date(),
            User.birth_time == datetime.strptime(birth_data['time'], '%H:%M:%S').time()
        ).first()

        if not user:
            print("👤 Створення тестового користувача...")
            user = User(
                birth_date=datetime.strptime(birth_data['date'], '%Y-%m-%d').date(),
                birth_time=datetime.strptime(birth_data['time'], '%H:%M:%S').time(),
                birth_place='Kharkiv, Ukraine',
                lat=birth_data['latitude'],
                lon=birth_data['longitude'],
                timezone=birth_data['timezone']
            )
            session.add(user)
            session.commit()
            print(f"✅ Користувач створений: {user.user_id}")
        else:
            print(f"✅ Користувач знайдений: {user.user_id}")
        
        # Видалити старі аспекти
        print("\n🗑️  Видалення старих аспектів...")
        deleted = session.query(NatalAspect).filter(
            NatalAspect.user_id == user.user_id
        ).delete()
        session.commit()
        print(f"✅ Видалено {deleted} старих аспектів")

        # Перерахувати аспекти
        print("\n🔮 Розрахунок аспектів з новими орбісами...")
        aspect_service = AspectService(session)
        aspects = aspect_service.calculate_aspects(user.user_id)

        # Перерахувати конфігурації
        print("🔮 Розрахунок конфігурацій...")
        config_service = ConfigurationService(session)
        configurations = config_service.detect_configurations(user.user_id)
        stelliums = config_service.detect_stelliums(user.user_id)
        
        # Показати результати
        print("\n" + "="*80)
        print("📊 РЕЗУЛЬТАТИ")
        print("="*80)

        print(f"\n✅ Знайдено аспектів: {len(aspects)}")

        if aspects:
            print("\n🔗 Приклади аспектів (перші 15):")
            for i, aspect in enumerate(aspects[:15], 1):
                print(f"{i:2}. {aspect['planet_1']:15} {aspect['aspect_type']:15} "
                      f"{aspect['planet_2']:15} (орбіс: {aspect['orb']:.2f}°)")

        # Показати конфігурації
        if configurations:
            print(f"\n🌟 Конфігурації аспектів: {len(configurations)}")
            for config in configurations:
                planets = ', '.join(config['planets_involved'])
                print(f"  • {config['type']}: {planets}")

        # Показати стеллиуми
        if stelliums:
            print(f"\n⭐ Стеллиуми: {len(stelliums)}")
            for stellium in stelliums:
                planets = ', '.join(stellium['planets'])
                location = stellium.get('sign') or stellium.get('house')
                print(f"  • {location}: {planets}")
        
        print("\n" + "="*80)
        print("✅ ПЕРЕРАХУНОК ЗАВЕРШЕНО")
        print("="*80)
        
    except Exception as e:
        session.rollback()
        print(f"\n❌ Помилка: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    recalculate_natal_chart()


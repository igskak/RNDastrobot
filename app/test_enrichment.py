#!/usr/bin/env python3
"""
Тестовый скрипт для проверки обогащения данных (пункт 3.2)
"""
import os
import sys
from datetime import date, time
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Добавляем путь к модулям
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.natal_chart_service import NatalChartService
from app.database.models import Base

# Загружаем переменные окружения
load_dotenv()

def get_db_url():
    """Получить URL базы данных"""
    host = os.getenv('DB_HOST')
    port = os.getenv('DB_PORT', '5432')
    database = os.getenv('DB_NAME', 'postgres')
    user = os.getenv('DB_USER')
    password = os.getenv('DB_PASSWORD')
    
    return f"postgresql://{user}:{password}@{host}:{port}/{database}"

def test_enrichment():
    """Тестирование обогащения данных"""
    print("=" * 80)
    print("ТЕСТ ОБОГАЩЕНИЯ ДАННЫХ (Пункт 3.2 спецификации)")
    print("=" * 80)
    
    # Создаём подключение к БД
    db_url = get_db_url()
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    db_session = Session()
    
    try:
        # Инициализируем сервис с путём к эфемеридам
        ephe_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'swisseph', 'ephe')
        natal_service = NatalChartService(ephe_path=ephe_path)
        
        # Тестовые данные рождения
        birth_data = {
            'date': date(1990, 3, 21),  # 21 марта 1990
            'time': time(12, 0, 0),      # 12:00:00
            'timezone': 'Europe/Kiev',
            'place': 'Kyiv, Ukraine',
            'house_system': 'P',
            'save_to_db': True
        }
        
        print("\n📋 Тестовые данные:")
        print(f"   Дата: {birth_data['date']}")
        print(f"   Время: {birth_data['time']}")
        print(f"   Место: {birth_data['place']}")
        print(f"   Часовой пояс: {birth_data['timezone']}")
        
        # Расчёт натальной карты
        print("\n🔄 Расчёт натальной карты...")
        result = natal_service.calculate_natal_chart(
            birth_date=birth_data['date'],
            birth_time=birth_data['time'],
            timezone=birth_data['timezone'],
            place=birth_data['place'],
            house_system=birth_data['house_system'],
            save_to_db=birth_data['save_to_db'],
            db_session=db_session
        )
        
        print("✅ Расчёт завершён!")
        
        # Проверяем обогащение планет
        print("\n" + "=" * 80)
        print("ПЛАНЕТЫ (с обогащением)")
        print("=" * 80)
        
        for planet in result['planets'][:5]:  # Показываем первые 5 планет
            print(f"\n🪐 {planet['name']}:")
            print(f"   Знак: {planet['sign']}")
            print(f"   Долгота: {planet['longitude']:.2f}°")
            print(f"   Дом: {planet['house']}")
            print(f"   ✨ Стихия: {planet.get('element', 'НЕТ ДАННЫХ')}")
            print(f"   ✨ Крест: {planet.get('mode', 'НЕТ ДАННЫХ')}")
            print(f"   ✨ Достоинство: {planet.get('dignity', 'НЕТ ДАННЫХ')}")
        
        # Проверяем обогащение домов
        print("\n" + "=" * 80)
        print("ДОМА (с обогащением)")
        print("=" * 80)
        
        for house in result['houses'][:4]:  # Показываем первые 4 дома
            print(f"\n🏠 Дом {house['number']}:")
            print(f"   Знак на куспиде: {house['sign']}")
            print(f"   Долгота куспида: {house['longitude']:.2f}°")
            print(f"   ✨ Группа дома: {house.get('house_group', 'НЕТ ДАННЫХ')}")
            print(f"   ✨ Управитель: {house.get('ruler_planet', 'НЕТ ДАННЫХ')}")
        
        # Проверяем сохранение в БД
        if birth_data['save_to_db'] and result.get('user_id'):
            print("\n" + "=" * 80)
            print("ПРОВЕРКА СОХРАНЕНИЯ В БД")
            print("=" * 80)
            print(f"✅ User ID: {result['user_id']}")
            print("✅ Данные сохранены в базу данных")
            
            # Проверяем, что данные действительно обогащены в БД
            from app.database.models import NatalPlanet, NatalHouse
            
            # Проверяем планеты
            planets_in_db = db_session.query(NatalPlanet).filter(
                NatalPlanet.user_id == result['user_id']
            ).limit(3).all()
            
            print("\n📊 Планеты в БД (первые 3):")
            for p in planets_in_db:
                print(f"   {p.planet}: element={p.element}, mode={p.mode}, dignity={p.dignity}")
            
            # Проверяем дома
            houses_in_db = db_session.query(NatalHouse).filter(
                NatalHouse.user_id == result['user_id']
            ).limit(3).all()
            
            print("\n📊 Дома в БД (первые 3):")
            for h in houses_in_db:
                print(f"   Дом {h.house_number}: group={h.house_group}, ruler={h.ruler_planet}")
        
        print("\n" + "=" * 80)
        print("✅ ТЕСТ УСПЕШНО ЗАВЕРШЁН!")
        print("=" * 80)
        
    except Exception as e:
        print(f"\n❌ ОШИБКА: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db_session.close()

if __name__ == '__main__':
    test_enrichment()


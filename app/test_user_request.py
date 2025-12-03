"""
Тестовый запрос для проверки системы индивидуальных орбисов планет
Данные пользователя: 11.09.1990, 09:39, Киев
"""
import json
from datetime import date, time as time_type
from app.database.connection import get_db_session
from app.services.natal_chart_service import NatalChartService
from app.services.aspect_service import AspectService
import os

# Тестовые данные пользователя
TEST_USER_DATA = {
    "birth_date": date(1990, 9, 11),
    "birth_time": time_type(9, 39, 0),
    "timezone": "Europe/Kiev",
    "latitude": 50.0,
    "longitude": 36.25,
    "house_system": "P"
}

def print_section(title: str):
    """Красивый вывод заголовка секции"""
    print("\n" + "="*80)
    print(f"  {title}")
    print("="*80)


def test_natal_chart_calculation():
    """Тест расчёта натальной карты"""
    print_section("ТЕСТ 1: Расчёт натальной карты")
    
    # Путь к эфемеридам
    EPHE_PATH = os.getenv("SWISSEPH_EPHE_PATH", "./swisseph/ephe")
    
    # Создать сервис
    natal_service = NatalChartService(ephe_path=EPHE_PATH)
    
    with get_db_session() as db:
        try:
            # Рассчитать натальную карту
            result = natal_service.calculate_natal_chart(
                birth_date=TEST_USER_DATA["birth_date"],
                birth_time=TEST_USER_DATA["birth_time"],
                timezone=TEST_USER_DATA["timezone"],
                latitude=TEST_USER_DATA["latitude"],
                longitude=TEST_USER_DATA["longitude"],
                house_system=TEST_USER_DATA["house_system"],
                save_to_db=True,
                db_session=db
            )
            
            print(f"✅ Натальная карта успешно рассчитана")
            print(f"   User ID: {result['user_id']}")
            print(f"   Планет: {len(result.get('planets', []))}")
            print(f"   Домов: {len(result.get('houses', []))}")
            print(f"   Углов: {len(result.get('angles', []))}")
            print(f"   Спец. точек: {len(result.get('special_points', []))}")
            print(f"   Аспектов: {len(result.get('aspects', []))}")
            
            return result
            
        except Exception as e:
            print(f"❌ Ошибка расчёта: {e}")
            import traceback
            traceback.print_exc()
            return None


def test_aspects_with_orbs(result):
    """Тест аспектов с новой системой орбисов"""
    if not result:
        print("⚠️  Пропуск теста аспектов - нет данных натальной карты")
        return
    
    print_section("ТЕСТ 2: Анализ аспектов с индивидуальными орбисами")
    
    aspects = result.get('aspects', [])
    
    if not aspects:
        print("⚠️  Аспекты не найдены")
        return
    
    print(f"\n📊 Найдено аспектов: {len(aspects)}")
    
    # Группировка по типам
    aspect_types = {}
    for aspect in aspects:
        aspect_type = aspect.get('aspect_type', 'Unknown')
        if aspect_type not in aspect_types:
            aspect_types[aspect_type] = []
        aspect_types[aspect_type].append(aspect)
    
    print(f"\n📈 Распределение по типам:")
    for aspect_type, items in sorted(aspect_types.items()):
        print(f"   {aspect_type:20} : {len(items):2} аспектов")
    
    # Показать примеры аспектов с орбисами
    print(f"\n🔍 Примеры аспектов (первые 10):")
    print(f"{'Планета 1':15} {'Планета 2':15} {'Аспект':15} {'Орбис':>8} {'Тип':>8}")
    print("-" * 80)
    
    for aspect in aspects[:10]:
        planet1 = aspect.get('planet_1', 'N/A')
        planet2 = aspect.get('planet_2', 'N/A')
        aspect_type = aspect.get('aspect_type', 'N/A')
        orb = aspect.get('orb', 0.0)
        is_major = "Major" if aspect.get('is_major', False) else "Minor"
        
        print(f"{planet1:15} {planet2:15} {aspect_type:15} {orb:7.2f}° {is_major:>8}")
    
    # Найти аспекты с участием Солнца и Луны
    print(f"\n☀️  Аспекты Солнца:")
    sun_aspects = [a for a in aspects if 'Sun' in [a.get('planet_1'), a.get('planet_2')]]
    for aspect in sun_aspects[:5]:
        planet1 = aspect.get('planet_1', 'N/A')
        planet2 = aspect.get('planet_2', 'N/A')
        aspect_type = aspect.get('aspect_type', 'N/A')
        orb = aspect.get('orb', 0.0)
        other_planet = planet2 if planet1 == 'Sun' else planet1
        print(f"   Sun - {other_planet:15} : {aspect_type:15} (орбис {orb:.2f}°)")
    
    print(f"\n🌙 Аспекты Луны:")
    moon_aspects = [a for a in aspects if 'Moon' in [a.get('planet_1'), a.get('planet_2')]]
    for aspect in moon_aspects[:5]:
        planet1 = aspect.get('planet_1', 'N/A')
        planet2 = aspect.get('planet_2', 'N/A')
        aspect_type = aspect.get('aspect_type', 'N/A')
        orb = aspect.get('orb', 0.0)
        other_planet = planet2 if planet1 == 'Moon' else planet1
        print(f"   Moon - {other_planet:15} : {aspect_type:15} (орбис {orb:.2f}°)")


def test_orb_verification():
    """Проверка корректности применения орбисов"""
    print_section("ТЕСТ 3: Проверка применения индивидуальных орбисов")
    
    with get_db_session() as db:
        aspect_service = AspectService(db)
        
        # Тестовые случаи
        test_cases = [
            ('Sun', 'Moon', 'Conjunction', 10.0),   # MIN(12, 10) = 10
            ('Sun', 'Pluto', 'Conjunction', 3.0),   # MIN(12, 3) = 3
            ('Mercury', 'BlackMoon', 'Trine', 3.0), # MIN(5, 3) = 3
            ('Sun', 'Venus', 'Sextile', 5.0),       # MIN(10, 5) = 5 (исправлено!)
            ('Moon', 'Mars', 'Square', 5.0),        # MIN(8, 5) = 5
        ]
        
        print("\n📐 Проверка расчёта орбисов:")
        print(f"{'Тело 1':15} {'Тело 2':15} {'Аспект':15} {'Расчётный':>12} {'Ожидаемый':>12} {'Статус':>8}")
        print("-" * 90)
        
        for body_a, body_b, aspect, expected in test_cases:
            try:
                result = aspect_service._calculate_allowed_orb(body_a, body_b, aspect)
                status = "✅" if abs(result - expected) < 0.01 else "❌"
                print(f"{body_a:15} {body_b:15} {aspect:15} {result:11.2f}° {expected:11.2f}° {status:>8}")
            except Exception as e:
                print(f"{body_a:15} {body_b:15} {aspect:15} {'ERROR':>12} {expected:11.2f}° {'❌':>8}")
                print(f"   Ошибка: {e}")


def main():
    """Главная функция тестирования"""
    print("\n" + "🌟"*40)
    print("ТЕСТИРОВАНИЕ СИСТЕМЫ С ИНДИВИДУАЛЬНЫМИ ОРБИСАМИ ПЛАНЕТ")
    print("Тестовый пользователь: 11.09.1990, 09:39, Киев (50.0°N, 36.25°E)")
    print("🌟"*40)
    
    try:
        # Тест 1: Расчёт натальной карты
        result = test_natal_chart_calculation()
        
        # Тест 2: Анализ аспектов
        test_aspects_with_orbs(result)
        
        # Тест 3: Проверка орбисов
        test_orb_verification()
        
        print("\n" + "="*80)
        print("✅ ВСЕ ТЕСТЫ ЗАВЕРШЕНЫ")
        print("="*80 + "\n")
        
    except Exception as e:
        print(f"\n❌ КРИТИЧЕСКАЯ ОШИБКА: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()


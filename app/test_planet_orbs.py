"""
Тестирование системы индивидуальных орбисов планет
"""
from sqlalchemy.orm import Session
from app.database.connection import get_db_session
from app.database.models import RefPlanetOrb, RefAspectType
from app.services.aspect_service import AspectService


def test_planet_orbs_data():
    """Проверка наличия данных в таблице ref_planet_orbs"""
    print("\n" + "="*80)
    print("ТЕСТ 1: Проверка данных орбисов планет")
    print("="*80)
    
    with get_db_session() as db:
        # Подсчитать записи
        total_orbs = db.query(RefPlanetOrb).count()
        planets_count = db.query(RefPlanetOrb.planet).distinct().count()
        aspects_count = db.query(RefPlanetOrb.aspect_type).distinct().count()
        
        print(f"✅ Всего записей орбисов: {total_orbs}")
        print(f"✅ Уникальных планет/точек: {planets_count}")
        print(f"✅ Уникальных типов аспектов: {aspects_count}")
        print(f"✅ Ожидаемое количество: {planets_count} × {aspects_count} = {planets_count * aspects_count}")
        
        # Проверить примеры
        print("\n📊 Примеры орбисов:")
        examples = [
            ('Sun', 'Conjunction'),
            ('Moon', 'Conjunction'),
            ('Pluto', 'Conjunction'),
            ('BlackMoon', 'Conjunction'),
            ('Sun', 'Trine'),
            ('Mercury', 'Sextile'),
        ]
        
        for planet, aspect in examples:
            orb = db.query(RefPlanetOrb.orb).filter(
                RefPlanetOrb.planet == planet,
                RefPlanetOrb.aspect_type == aspect
            ).scalar()
            print(f"  {planet:15} + {aspect:15} = {orb}°")


def test_excluded_aspects():
    """Проверка удаления исключённых аспектов"""
    print("\n" + "="*80)
    print("ТЕСТ 2: Проверка исключённых аспектов")
    print("="*80)
    
    excluded = ['Vigintile', 'Semi_Nonagon', 'Binonagon', 'Sentagon']
    
    with get_db_session() as db:
        for aspect in excluded:
            exists = db.query(RefAspectType).filter(
                RefAspectType.aspect_type == aspect
            ).first()
            
            if exists:
                print(f"❌ {aspect} всё ещё существует (должен быть удалён)")
            else:
                print(f"✅ {aspect} успешно удалён")


def test_orb_calculation():
    """Тестирование расчёта орбисов по правилу MIN"""
    print("\n" + "="*80)
    print("ТЕСТ 3: Расчёт орбисов (правило MIN)")
    print("="*80)
    
    with get_db_session() as db:
        service = AspectService(db)
        
        test_cases = [
            ('Sun', 'Moon', 'Conjunction', 12.0),      # MAX(12, 10) = 12
            ('Sun', 'Pluto', 'Conjunction', 12.0),     # MAX(12, 5) = 12
            ('Mercury', 'BlackMoon', 'Trine', 5.0),    # MAX(5, 3) = 5
            ('ASC', 'Mars', 'Square', 5.0),            # MAX(5, 5) = 5
            ('Sun', 'Moon', 'Sextile', 10.0),          # MAX(10, 8) = 10
        ]
        
        print("\n📐 Примеры расчёта:")
        for body_a, body_b, aspect, expected in test_cases:
            result = service._calculate_allowed_orb(body_a, body_b, aspect)
            status = "✅" if result == expected else "❌"
            print(f"{status} {body_a:10} + {body_b:10} ({aspect:15}): {result}° (ожидалось {expected}°)")


def test_aspect_detection():
    """Тестирование обнаружения аспектов с новыми орбисами"""
    print("\n" + "="*80)
    print("ТЕСТ 4: Обнаружение аспектов")
    print("="*80)
    
    with get_db_session() as db:
        service = AspectService(db)
        aspect_types = service._get_aspect_types()
        
        # Тестовые случаи: (obj1, obj2, ожидаемый_аспект)
        test_cases = [
            # Солнце на 0°, Луна на 9° -> Соединение (орбис MAX(12, 10) = 12°)
            (
                {'name': 'Sun', 'longitude': 0.0, 'type': 'planet'},
                {'name': 'Moon', 'longitude': 9.0, 'type': 'planet'},
                'Conjunction'
            ),
            # Солнце на 0°, Плутон на 4° -> Соединение (орбис MAX(12, 5) = 12°)
            (
                {'name': 'Sun', 'longitude': 0.0, 'type': 'planet'},
                {'name': 'Pluto', 'longitude': 4.0, 'type': 'planet'},
                'Conjunction'
            ),
            # Солнце на 0°, Луна на 120° -> Трин (орбис MAX(10, 8) = 10°)
            (
                {'name': 'Sun', 'longitude': 0.0, 'type': 'planet'},
                {'name': 'Moon', 'longitude': 120.0, 'type': 'planet'},
                'Trine'
            ),
        ]
        
        print("\n🔍 Тестовые случаи:")
        for obj1, obj2, expected in test_cases:
            result = service._calculate_aspect_between(obj1, obj2, aspect_types)
            
            if expected is None:
                if result is None:
                    print(f"✅ {obj1['name']:10} ({obj1['longitude']:6.1f}°) + {obj2['name']:10} ({obj2['longitude']:6.1f}°): Нет аспекта (как ожидалось)")
                else:
                    print(f"❌ {obj1['name']:10} ({obj1['longitude']:6.1f}°) + {obj2['name']:10} ({obj2['longitude']:6.1f}°): Найден {result['aspect_type']} (ожидалось: нет аспекта)")
            else:
                if result and result['aspect_type'] == expected:
                    print(f"✅ {obj1['name']:10} ({obj1['longitude']:6.1f}°) + {obj2['name']:10} ({obj2['longitude']:6.1f}°): {result['aspect_type']} (орбис {result['orb']:.2f}°)")
                else:
                    actual = result['aspect_type'] if result else 'None'
                    print(f"❌ {obj1['name']:10} ({obj1['longitude']:6.1f}°) + {obj2['name']:10} ({obj2['longitude']:6.1f}°): {actual} (ожидалось: {expected})")


def main():
    """Запуск всех тестов"""
    print("\n" + "🌟"*40)
    print("ТЕСТИРОВАНИЕ СИСТЕМЫ ИНДИВИДУАЛЬНЫХ ОРБИСОВ ПЛАНЕТ")
    print("🌟"*40)
    
    try:
        test_planet_orbs_data()
        test_excluded_aspects()
        test_orb_calculation()
        test_aspect_detection()
        
        print("\n" + "="*80)
        print("✅ ВСЕ ТЕСТЫ ЗАВЕРШЕНЫ")
        print("="*80 + "\n")
        
    except Exception as e:
        print(f"\n❌ ОШИБКА: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()


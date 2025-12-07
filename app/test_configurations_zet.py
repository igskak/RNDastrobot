"""
Тест конфигураций: сравнение с ZET
Данные: 11.09.1990, 09:39, Europe/Kiev, 50.0°N, 36.25°E
"""
import os
from datetime import date, time as time_type
from app.database.connection import get_db_session
from app.database.models import NatalAspect
from app.services.natal_chart_service import NatalChartService
from app.services.configuration_service import ConfigurationService

# Ожидаемые конфигурации по ZET
EXPECTED_CHARIOTS = [
    {'planets': {'Mars', 'Jupiter', 'BlackMoon', 'TrueSouthNode'}, 'name': 'Марс-Юпитер-Лилит-Южн.Узел'},
    {'planets': {'Mars', 'TrueNorthNode', 'BlackMoon', 'TrueSouthNode'}, 'name': 'Марс-Сев.Узел-Лилит-Южн.Узел'},
    {'planets': {'Mars', 'WhiteMoon', 'BlackMoon', 'TrueSouthNode'}, 'name': 'Марс-Селена-Лилит-Южн.Узел'},
]

EXPECTED_T_SQUARES = [
    {'planets': {'Mars', 'Venus', 'BlackMoon'}, 'apex': 'Venus', 'name': 'Марс-Венера-Лилит'},
]

EXPECTED_BISEXTILES = [
    {'planets': {'Venus', 'Proserpina', 'Uranus'}, 'apex': 'Proserpina', 'name': 'Венера-Прозерпина-Уран'},
    {'planets': {'Sun', 'Pluto', 'Saturn'}, 'apex': 'Pluto', 'name': 'Солнце-Плутон-Сатурн'},
]


def main():
    print("=" * 80)
    print("ТЕСТ КОНФИГУРАЦИЙ: СРАВНЕНИЕ С ZET")
    print("Пользователь: 11.09.1990, 09:39, Europe/Kiev")
    print("Правило орбисов: MAX(orb_a, orb_b)")
    print("=" * 80)
    
    EPHE_PATH = os.getenv("SWISSEPH_EPHE_PATH", "./swisseph/ephe")
    natal_service = NatalChartService(ephe_path=EPHE_PATH)
    
    with get_db_session() as db:
        # Расчёт натальной карты
        print("\n1️⃣  Расчёт натальной карты...")
        result = natal_service.calculate_natal_chart(
            birth_date=date(1990, 9, 11),
            birth_time=time_type(9, 39, 0),
            timezone="Europe/Kiev",
            latitude=50.0,
            longitude=36.25,
            house_system="P",
            save_to_db=True,
            db_session=db
        )
        user_id = result['user_id']
        print(f"   ✅ User ID: {user_id}")
        
        # Получаем аспекты из БД
        aspects = db.query(NatalAspect).filter(NatalAspect.user_id == user_id).all()
        print(f"   ✅ Найдено аспектов: {len(aspects)}")
        
        # Получаем конфигурации
        config_service = ConfigurationService(db)
        configurations = config_service.detect_configurations(user_id)
        
        # Анализ
        print("\n2️⃣  НАЙДЕННЫЕ КОНФИГУРАЦИИ:")
        print("-" * 60)
        
        chariots = [c for c in configurations if c['type'] == 'Chariot']
        t_squares = [c for c in configurations if c['type'] == 'T_Square']
        bisextiles = [c for c in configurations if c['type'] == 'Bisextile']
        
        print(f"\n   ПОВОЗКИ (Chariot): {len(chariots)}")
        for c in chariots:
            print(f"      • {sorted(c['planets_involved'])}")
        
        print(f"\n   ТАУ-КВАДРАТЫ (T_Square): {len(t_squares)}")
        for c in t_squares:
            print(f"      • {sorted(c['planets_involved'])} (apex: {c.get('apex_planet', '?')})")
        
        print(f"\n   БИСЕКСТИЛИ (Bisextile): {len(bisextiles)}")
        for c in bisextiles:
            print(f"      • {sorted(c['planets_involved'])} (apex: {c.get('apex_planet', '?')})")
        
        # Проверка ожидаемых конфигураций
        print("\n3️⃣  ПРОВЕРКА ОЖИДАЕМЫХ КОНФИГУРАЦИЙ (ZET):")
        print("-" * 60)
        
        found_chariots = [set(c['planets_involved']) for c in chariots]
        found_t_squares = [(set(c['planets_involved']), c.get('apex_planet')) for c in t_squares]
        found_bisextiles = [(set(c['planets_involved']), c.get('apex_planet')) for c in bisextiles]
        
        print("\n   ПОВОЗКИ:")
        for exp in EXPECTED_CHARIOTS:
            found = "✅" if exp['planets'] in found_chariots else "❌"
            print(f"      {found} {exp['name']}")
        
        print("\n   ТАУ-КВАДРАТЫ:")
        for exp in EXPECTED_T_SQUARES:
            found = any(exp['planets'] == f[0] for f in found_t_squares)
            status = "✅" if found else "❌"
            print(f"      {status} {exp['name']} (apex: {exp['apex']})")
        
        print("\n   БИСЕКСТИЛИ:")
        for exp in EXPECTED_BISEXTILES:
            found = any(exp['planets'] == f[0] for f in found_bisextiles)
            status = "✅" if found else "❌"
            print(f"      {status} {exp['name']} (apex: {exp['apex']})")
        
        # Проверка ключевых аспектов
        print("\n4️⃣  КЛЮЧЕВЫЕ АСПЕКТЫ ДЛЯ КОНФИГУРАЦИЙ:")
        print("-" * 60)
        
        key_aspects = [
            ('Mars', 'BlackMoon', 'Opposition'),
            ('Mars', 'Venus', 'Square'),
            ('Venus', 'BlackMoon', 'Square'),
            ('Jupiter', 'TrueSouthNode', 'Opposition'),
            ('Mars', 'Jupiter', 'Sextile'),
            ('WhiteMoon', 'TrueSouthNode', 'Opposition'),
            ('Sun', 'Saturn', 'Trine'),
            ('Pluto', 'Saturn', 'Sextile'),
            ('Venus', 'Uranus', 'Trine'),
            ('Venus', 'Proserpina', 'Sextile'),
            ('Proserpina', 'Uranus', 'Sextile'),
        ]
        
        for p1, p2, asp_type in key_aspects:
            found_asp = next(
                (a for a in aspects 
                 if {a.planet_1, a.planet_2} == {p1, p2} and a.aspect_type == asp_type),
                None
            )
            if found_asp:
                print(f"      ✅ {p1}-{p2} {asp_type}: орбис {found_asp.orb:.2f}°")
            else:
                print(f"      ❌ {p1}-{p2} {asp_type}: НЕ НАЙДЕН")
        
        print("\n" + "=" * 80)


if __name__ == "__main__":
    main()


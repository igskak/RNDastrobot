"""
Тест полного расчёта натальной карты с Прозерпиной
"""

import sys
import os
from datetime import date, time

# Добавляем корневую директорию в путь
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.natal_chart_service import NatalChartService


def test_natal_chart_with_proserpina():
    """Тест натальной карты с Прозерпиной"""
    
    print("=" * 70)
    print("ТЕСТ НАТАЛЬНОЙ КАРТЫ С ПРОЗЕРПИНОЙ")
    print("=" * 70)

    # Путь к эфемеридам
    ephe_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'swisseph', 'ephe')

    # Создаём сервис
    service = NatalChartService(ephe_path=ephe_path)
    
    # Входные данные
    birth_date = date(1990, 9, 11)
    birth_time = time(10, 39, 0)
    timezone = "Europe/Kiev"
    latitude = 50.0
    longitude = 36.25
    house_system = "P"
    
    print(f"Дата: {birth_date}")
    print(f"Время: {birth_time}")
    print(f"Timezone: {timezone}")
    print(f"Координаты: {latitude}°N, {longitude}°E")
    print(f"Система домов: {house_system}")
    print()
    
    # Рассчитываем натальную карту
    chart = service.calculate_natal_chart(
        birth_date=birth_date,
        birth_time=birth_time,
        timezone=timezone,
        latitude=latitude,
        longitude=longitude,
        house_system=house_system,
        save_to_db=False
    )
    
    # Выводим планеты
    print("ПЛАНЕТЫ:")
    print("-" * 70)
    for planet in chart['planets']:
        name = planet['name']
        sign = planet['sign']
        degree = planet['degree_in_sign_formatted']
        house = planet.get('house', '?')
        retro = " R" if planet.get('retrograde', False) else ""
        
        print(f"{name:12} {degree:12} {sign:12} Дом {house}{retro}")
    
    print()
    
    # Проверяем Прозерпину
    proserpina = next((p for p in chart['planets'] if p['name'] == 'Proserpina'), None)
    
    if proserpina:
        print("ПРОЗЕРПИНА:")
        print(f"  Долгота: {proserpina['longitude']:.6f}°")
        print(f"  Знак: {proserpina['sign']}")
        print(f"  Позиция в знаке: {proserpina['degree_in_sign_formatted']}")
        print(f"  Дом: {proserpina.get('house', '?')}")
        print()
        
        # Проверка
        degree_in_sign = proserpina['degree_in_sign']
        degrees = int(degree_in_sign)
        minutes = (degree_in_sign - degrees) * 60
        
        print("ПРОВЕРКА:")
        print(f"  Ожидаем: 2°37' Scorpio")
        print(f"  Получили: {degrees}°{minutes:.0f}' {proserpina['sign']}")
        
        if proserpina['sign'] == 'Scorpio' and degrees == 2 and abs(minutes - 37) < 2:
            print("  ✓ ТЕСТ ПРОЙДЕН!")
        else:
            print("  ✗ ТЕСТ НЕ ПРОЙДЕН")
    else:
        print("❌ ПРОЗЕРПИНА НЕ НАЙДЕНА В НАТАЛЬНОЙ КАРТЕ!")
    
    print("=" * 70)


if __name__ == "__main__":
    test_natal_chart_with_proserpina()


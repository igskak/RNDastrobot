"""
Тестовый скрипт для проверки расчёта Прозерпины

Проверяем на примере:
- Дата: 1990-09-11
- Время: 10:39:00
- Timezone: Europe/Kiev
- Ожидаемый результат: 2°37' Скорпиона
"""

import sys
import os
from datetime import datetime, date, time

# Добавляем корневую директорию в путь
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.time_service import TimeService
from app.services.special_points_service import SpecialPointsService
from app.utils.constants import get_zodiac_sign, get_degree_in_sign


def test_proserpina():
    """Тест расчёта Прозерпины"""
    
    # Входные данные
    birth_date = date(1990, 9, 11)
    birth_time = time(10, 39, 0)
    timezone = "Europe/Kiev"
    
    print("=" * 60)
    print("ТЕСТ РАСЧЁТА ПРОЗЕРПИНЫ")
    print("=" * 60)
    print(f"Дата рождения: {birth_date}")
    print(f"Время рождения: {birth_time}")
    print(f"Часовой пояс: {timezone}")
    print()
    
    # Конвертируем в UTC и получаем JD
    utc_dt, jd = TimeService.process_birth_time(birth_date, birth_time, timezone)
    
    print(f"UTC время: {utc_dt}")
    print(f"Юлианский день: {jd}")
    print()
    
    # Рассчитываем Прозерпину
    proserpina_lon = SpecialPointsService.calculate_proserpina(jd)
    
    # Получаем знак и градус
    sign = get_zodiac_sign(proserpina_lon)
    degree_in_sign = get_degree_in_sign(proserpina_lon)
    
    # Форматируем градусы и минуты
    degrees = int(degree_in_sign)
    minutes = (degree_in_sign - degrees) * 60
    
    print("РЕЗУЛЬТАТ:")
    print(f"Прозерпина: {degrees}°{minutes:.0f}' {sign}")
    print(f"Полная долгота: {proserpina_lon:.6f}°")
    print()
    
    # Проверка
    expected_sign = "Scorpio"
    expected_degrees = 2
    expected_minutes = 37
    
    print("ОЖИДАЕМЫЙ РЕЗУЛЬТАТ:")
    print(f"Прозерпина: {expected_degrees}°{expected_minutes}' {expected_sign}")
    print()
    
    # Сравнение
    is_correct_sign = sign == expected_sign
    is_correct_degree = degrees == expected_degrees
    is_correct_minute = abs(minutes - expected_minutes) < 1  # Допуск ±1 минута
    
    print("ПРОВЕРКА:")
    print(f"✓ Знак зодиака: {sign} {'✓' if is_correct_sign else '✗ (ожидался ' + expected_sign + ')'}")
    print(f"✓ Градус: {degrees}° {'✓' if is_correct_degree else '✗ (ожидался ' + str(expected_degrees) + '°)'}")
    print(f"✓ Минуты: {minutes:.0f}' {'✓' if is_correct_minute else '✗ (ожидалось ' + str(expected_minutes) + ')'}")
    print()
    
    if is_correct_sign and is_correct_degree and is_correct_minute:
        print("🎉 ТЕСТ ПРОЙДЕН УСПЕШНО!")
    else:
        print("❌ ТЕСТ НЕ ПРОЙДЕН")
        print(f"   Разница в минутах: {minutes - expected_minutes:.2f}'")
    
    print("=" * 60)


if __name__ == "__main__":
    test_proserpina()


"""
Детальный тест расчёта Прозерпины с выводом промежуточных значений
"""

import sys
import os
from datetime import datetime, date, time
import swisseph as swe

# Добавляем корневую директорию в путь
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.time_service import TimeService
from app.services.special_points_service import SpecialPointsService


def test_proserpina_detailed():
    """Детальный тест с промежуточными значениями"""
    
    # Входные данные
    birth_date = date(1990, 9, 11)
    birth_time = time(10, 39, 0)
    timezone = "Europe/Kiev"
    
    print("=" * 70)
    print("ДЕТАЛЬНЫЙ РАСЧЁТ ПРОЗЕРПИНЫ")
    print("=" * 70)
    
    # Конвертируем в UTC и получаем JD
    utc_dt, jd = TimeService.process_birth_time(birth_date, birth_time, timezone)
    
    print(f"Дата рождения: {birth_date}")
    print(f"Время рождения: {birth_time} ({timezone})")
    print(f"UTC время: {utc_dt}")
    print(f"Юлианский день: {jd}")
    print()
    
    # Загружаем эфемериды
    ephemeris = SpecialPointsService._load_proserpina_ephemeris()
    
    # Получаем данные для 1990 и 1991
    p_1990 = ephemeris['1990']['longitude']
    p_1991 = ephemeris['1991']['longitude']
    
    print("ЭФЕМЕРИДЫ:")
    print(f"1990-01-01: {p_1990}° ({ephemeris['1990']['formatted']})")
    print(f"1991-01-01: {p_1991}° ({ephemeris['1991']['formatted']})")
    print(f"Годовое смещение: {p_1991 - p_1990:.6f}° ({(p_1991 - p_1990) * 60:.2f}')")
    print()
    
    # Вычисляем количество дней от начала года
    jd_year_start = swe.julday(1990, 1, 1, 0.0)
    days_passed = jd - jd_year_start
    days_in_year = 365  # 1990 не високосный
    
    print("РАСЧЁТ:")
    print(f"JD начала года (1990-01-01 00:00): {jd_year_start}")
    print(f"Дней прошло с начала года: {days_passed:.6f}")
    print(f"Дней в году: {days_in_year}")
    print(f"Коэффициент: {days_passed / days_in_year:.6f} ({days_passed / days_in_year * 100:.2f}%)")
    print()
    
    # Линейная интерполяция
    delta = p_1991 - p_1990
    interpolated = p_1990 + delta * (days_passed / days_in_year)
    
    print("ИНТЕРПОЛЯЦИЯ:")
    print(f"P_start (1990-01-01): {p_1990}°")
    print(f"P_end (1991-01-01): {p_1991}°")
    print(f"Delta: {delta}° ({delta * 60:.2f}')")
    print(f"Смещение: {delta * (days_passed / days_in_year):.6f}° ({delta * (days_passed / days_in_year) * 60:.2f}')")
    print(f"Результат: {interpolated}°")
    print()
    
    # Рассчитываем через сервис
    proserpina_lon = SpecialPointsService.calculate_proserpina(jd)
    
    # Форматируем результат
    degree_in_sign = proserpina_lon % 30
    degrees = int(degree_in_sign)
    minutes = (degree_in_sign - degrees) * 60
    
    print("ФИНАЛЬНЫЙ РЕЗУЛЬТАТ:")
    print(f"Долгота: {proserpina_lon:.6f}°")
    print(f"Позиция: {degrees}°{minutes:.2f}' Scorpio")
    print()
    
    # Проверка формулы из описания
    print("ПРОВЕРКА ПО ФОРМУЛЕ ИЗ ОПИСАНИЯ:")
    print(f"P_start = 2°15' = 212.25°")
    print(f"P_end = 2°47' = 212.783° (примерно)")
    print(f"Коэффициент времени: 254/365 ≈ 0.6959")
    print(f"Ожидаемое смещение: 32' × 0.6959 ≈ 22.2' = 0.37°")
    print(f"Ожидаемый результат: 212.25° + 0.37° = 212.62°")
    print(f"Наш результат: {proserpina_lon:.2f}°")
    print(f"Разница: {abs(proserpina_lon - 212.62):.4f}° ({abs(proserpina_lon - 212.62) * 60:.2f}')")
    print()
    
    print("=" * 70)


if __name__ == "__main__":
    test_proserpina_detailed()


"""
Генератор эфемерид Прозерпины для школы Михаила Левина

Параметры Прозерпины (калиброваны по данным Zet 1944 и 2007):
- Цикл: ~779 лет (полный круг 360°)
- Скорость: 0.461968° в год (27.72 угловых минут в год) — точно по Левину
- Движение: равномерное (Mean Motion)

Метод: линейная интерполяция между значениями на 1 января каждого года
"""

import json
from datetime import datetime

# Параметры Прозерпины (калиброваны по данным Zet 1944 и 2007)
# Скорость точно совпадает с данными школы Левина (27.7' в год)
PROSERPINA_SPEED = 0.461968  # градусов в год (27.72' в год)
PROSERPINA_START_YEAR = 1900
PROSERPINA_END_YEAR = 2100

# Начальная позиция (на 1 января 1900 года)
# Вычислено из точки Zet 1944-06-26 = 11°16'59" Весы (191.283056°)
# JD для 1944-06-26 = 2431266.5
# JD для 1900-01-01 = 2415020.5
# Разница = 16246 дней = 44.4877 лет
# Позиция в 1900 = 191.283056 - (44.4877 * 0.461968) = 170.729°

PROSERPINA_1944_06_26 = 191.283056  # 11°16'59" Весы (точка Zet)
YEARS_FROM_1900_TO_1944_06_26 = 44.4877
PROSERPINA_1900_JAN_1 = PROSERPINA_1944_06_26 - (YEARS_FROM_1900_TO_1944_06_26 * PROSERPINA_SPEED)

# Знаки зодиака
ZODIAC_SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
]


def normalize_longitude(lon):
    """Нормализация долготы к диапазону 0-360"""
    return lon % 360


def get_zodiac_sign(longitude):
    """Получить знак зодиака по долготе"""
    sign_index = int(longitude / 30)
    return ZODIAC_SIGNS[sign_index]


def get_degree_in_sign(longitude):
    """Получить градус внутри знака"""
    return longitude % 30


def format_position(longitude):
    """Форматировать позицию в читаемый вид"""
    degree_in_sign = get_degree_in_sign(longitude)
    degrees = int(degree_in_sign)
    minutes = (degree_in_sign - degrees) * 60
    sign = get_zodiac_sign(longitude)
    return f"{degrees}°{minutes:.2f}' {sign}"


def generate_ephemeris():
    """Генерация эфемерид Прозерпины"""
    ephemeris = {}
    
    for year in range(PROSERPINA_START_YEAR, PROSERPINA_END_YEAR + 1):
        years_from_start = year - PROSERPINA_START_YEAR
        longitude = normalize_longitude(PROSERPINA_1900_JAN_1 + (years_from_start * PROSERPINA_SPEED))
        
        ephemeris[str(year)] = {
            "longitude": round(longitude, 6),
            "sign": get_zodiac_sign(longitude),
            "formatted": format_position(longitude)
        }
    
    return ephemeris


def main():
    """Основная функция"""
    print("Генерация эфемерид Прозерпины...")
    print(f"Период: {PROSERPINA_START_YEAR}-{PROSERPINA_END_YEAR}")
    print(f"Скорость: {PROSERPINA_SPEED}° в год")
    print(f"Начальная позиция (1 января 1900): {format_position(PROSERPINA_1900_JAN_1)}")

    # Вычисляем позицию на 1990
    proserpina_1990 = PROSERPINA_1900_JAN_1 + (90 * PROSERPINA_SPEED)
    print(f"Позиция на 1 января 1990: {format_position(proserpina_1990)}")
    print()

    ephemeris = generate_ephemeris()

    # Проверка для 1990 года
    print("Проверка:")
    print(f"1990-01-01: {ephemeris['1990']['formatted']}")
    print(f"1991-01-01: {ephemeris['1991']['formatted']}")
    print()
    
    # Сохранение в JSON
    output_file = "app/data/proserpina_ephemeris.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(ephemeris, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Эфемериды сохранены в {output_file}")
    print(f"✓ Всего записей: {len(ephemeris)}")


if __name__ == "__main__":
    main()


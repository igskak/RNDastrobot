"""
Сервис для работы с Swiss Ephemeris
"""
import swisseph as swe
from typing import List, Dict, Tuple
from app.utils.constants import PLANETS, get_zodiac_sign, get_degree_in_sign, format_degree_minutes_seconds
from app.services.special_points_service import SpecialPointsService


class SwissEphemerisEngine:
    """Движок для астрономических расчётов с использованием Swiss Ephemeris"""
    
    def __init__(self, ephe_path: str = None):
        """
        Инициализация движка
        
        Args:
            ephe_path: Путь к файлам эфемерид (опционально)
        """
        if ephe_path:
            swe.set_ephe_path(ephe_path)
    
    def calculate_planets(self, jd: float) -> List[Dict]:
        """
        Расчёт позиций планет

        Args:
            jd: Юлианский день

        Returns:
            Список словарей с данными о планетах
        """
        planets_data = []

        for planet_id, planet_name in PLANETS.items():
            # Прозерпина (ID=1000) рассчитывается отдельно методом интерполяции
            if planet_id == 1000:
                longitude = SpecialPointsService.calculate_proserpina(jd)
                latitude = 0.0  # Фиктивная планета, широта = 0
                distance = 0.0  # Расстояние не определено
                speed_lon = 0.54135 / 365.25  # Средняя скорость в градусах/день
                is_retrograde = False  # Прозерпина всегда директная
            else:
                # Расчёт позиции планеты через Swiss Ephemeris
                planet_data, ret = swe.calc_ut(jd, planet_id, swe.FLG_SWIEPH | swe.FLG_SPEED)

                longitude = planet_data[0]  # Эклиптическая долгота
                latitude = planet_data[1]   # Эклиптическая широта
                distance = planet_data[2]   # Расстояние в а.е.
                speed_lon = planet_data[3]  # Скорость по долготе

                # Определяем ретроградность (скорость < 0)
                is_retrograde = speed_lon < 0

            degree_in_sign = get_degree_in_sign(longitude)

            planets_data.append({
                'id': planet_id,
                'name': planet_name,
                'longitude': longitude,
                'latitude': latitude,
                'distance': distance,
                'speed': speed_lon,
                'sign': get_zodiac_sign(longitude),
                'degree_in_sign': degree_in_sign,
                'degree_in_sign_formatted': format_degree_minutes_seconds(degree_in_sign),
                'retrograde': is_retrograde,
            })

        return planets_data
    
    def calculate_houses(
        self,
        jd: float,
        lat: float,
        lon: float,
        hsys: str = 'P'
    ) -> Tuple[List[Dict], Dict]:
        """
        Расчёт домов и углов
        
        Args:
            jd: Юлианский день
            lat: Широта места рождения
            lon: Долгота места рождения
            hsys: Система домов (P=Placidus, K=Koch и т.д.)
        
        Returns:
            Кортеж (список домов, словарь углов)
        """
        # Расчёт домов через Swiss Ephemeris
        cusps, ascmc = swe.houses(jd, lat, lon, hsys.encode())

        # Обработка куспидов домов (индексы 0-11 в tuple, но нумеруем как 1-12)
        houses_data = []
        for i in range(12):
            house_lon = cusps[i]
            degree_in_sign = get_degree_in_sign(house_lon)
            houses_data.append({
                'number': i + 1,  # Дома нумеруются с 1
                'longitude': house_lon,
                'sign': get_zodiac_sign(house_lon),
                'degree_in_sign': degree_in_sign,
                'degree_in_sign_formatted': format_degree_minutes_seconds(degree_in_sign),
            })
        
        # Обработка углов
        # ascmc[0] = ASC, ascmc[1] = MC, ascmc[2] = ARMC, ascmc[3] = Vertex
        asc_deg = get_degree_in_sign(ascmc[0])
        mc_deg = get_degree_in_sign(ascmc[1])
        vertex_deg = get_degree_in_sign(ascmc[3])

        angles_data = {
            'ASC': {
                'name': 'ASC',
                'longitude': ascmc[0],
                'sign': get_zodiac_sign(ascmc[0]),
                'degree_in_sign': asc_deg,
                'degree_in_sign_formatted': format_degree_minutes_seconds(asc_deg),
            },
            'MC': {
                'name': 'MC',
                'longitude': ascmc[1],
                'sign': get_zodiac_sign(ascmc[1]),
                'degree_in_sign': mc_deg,
                'degree_in_sign_formatted': format_degree_minutes_seconds(mc_deg),
            },
            'Vertex': {
                'name': 'Vertex',
                'longitude': ascmc[3],
                'sign': get_zodiac_sign(ascmc[3]),
                'degree_in_sign': vertex_deg,
                'degree_in_sign_formatted': format_degree_minutes_seconds(vertex_deg),
            },
        }

        # Добавляем DSC (противоположная точка ASC)
        dsc_lon = (ascmc[0] + 180) % 360
        dsc_deg = get_degree_in_sign(dsc_lon)
        angles_data['DSC'] = {
            'name': 'DSC',
            'longitude': dsc_lon,
            'sign': get_zodiac_sign(dsc_lon),
            'degree_in_sign': dsc_deg,
            'degree_in_sign_formatted': format_degree_minutes_seconds(dsc_deg),
        }

        # Добавляем IC (противоположная точка MC)
        ic_lon = (ascmc[1] + 180) % 360
        ic_deg = get_degree_in_sign(ic_lon)
        angles_data['IC'] = {
            'name': 'IC',
            'longitude': ic_lon,
            'sign': get_zodiac_sign(ic_lon),
            'degree_in_sign': ic_deg,
            'degree_in_sign_formatted': format_degree_minutes_seconds(ic_deg),
        }
        
        return houses_data, angles_data
    
    def get_planet_house(self, planet_lon: float, houses: List[Dict]) -> int:
        """
        Определить, в каком доме находится планета

        Логика: точка находится в доме, к куспиду которого она ближе всего.
        Если точка находится ровно посередине между двумя куспидами,
        она относится к дому с меньшим номером.

        Args:
            planet_lon: Долгота планеты
            houses: Список домов с куспидами

        Returns:
            Номер дома (1-12)
        """
        min_distance = 360.0
        closest_house = 1

        for house in houses:
            cusp = house['longitude']

            # Вычисляем расстояние с учётом цикличности (0-360°)
            distance = abs(planet_lon - cusp)
            if distance > 180:
                distance = 360 - distance

            if distance < min_distance:
                min_distance = distance
                closest_house = house['number']

        return closest_house


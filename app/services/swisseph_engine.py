"""
Сервис для работы с Swiss Ephemeris
"""
import swisseph as swe
from typing import List, Dict, Tuple
from app.utils.constants import PLANETS, get_zodiac_sign, get_degree_in_sign


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
            # Расчёт позиции планеты
            planet_data, ret = swe.calc_ut(jd, planet_id, swe.FLG_SWIEPH | swe.FLG_SPEED)
            
            longitude = planet_data[0]  # Эклиптическая долгота
            latitude = planet_data[1]   # Эклиптическая широта
            distance = planet_data[2]   # Расстояние в а.е.
            speed_lon = planet_data[3]  # Скорость по долготе
            
            # Определяем ретроградность (скорость < 0)
            is_retrograde = speed_lon < 0
            
            planets_data.append({
                'id': planet_id,
                'name': planet_name,
                'longitude': longitude,
                'latitude': latitude,
                'distance': distance,
                'speed': speed_lon,
                'sign': get_zodiac_sign(longitude),
                'degree_in_sign': get_degree_in_sign(longitude),
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
            houses_data.append({
                'number': i + 1,  # Дома нумеруются с 1
                'longitude': house_lon,
                'sign': get_zodiac_sign(house_lon),
            })
        
        # Обработка углов
        # ascmc[0] = ASC, ascmc[1] = MC, ascmc[2] = ARMC, ascmc[3] = Vertex
        angles_data = {
            'ASC': {
                'name': 'ASC',
                'longitude': ascmc[0],
                'sign': get_zodiac_sign(ascmc[0]),
                'degree_in_sign': get_degree_in_sign(ascmc[0]),
            },
            'MC': {
                'name': 'MC',
                'longitude': ascmc[1],
                'sign': get_zodiac_sign(ascmc[1]),
                'degree_in_sign': get_degree_in_sign(ascmc[1]),
            },
            'Vertex': {
                'name': 'Vertex',
                'longitude': ascmc[3],
                'sign': get_zodiac_sign(ascmc[3]),
                'degree_in_sign': get_degree_in_sign(ascmc[3]),
            },
        }
        
        # Добавляем DSC (противоположная точка ASC)
        dsc_lon = (ascmc[0] + 180) % 360
        angles_data['DSC'] = {
            'name': 'DSC',
            'longitude': dsc_lon,
            'sign': get_zodiac_sign(dsc_lon),
            'degree_in_sign': get_degree_in_sign(dsc_lon),
        }
        
        # Добавляем IC (противоположная точка MC)
        ic_lon = (ascmc[1] + 180) % 360
        angles_data['IC'] = {
            'name': 'IC',
            'longitude': ic_lon,
            'sign': get_zodiac_sign(ic_lon),
            'degree_in_sign': get_degree_in_sign(ic_lon),
        }
        
        return houses_data, angles_data
    
    def get_planet_house(self, planet_lon: float, houses: List[Dict]) -> int:
        """
        Определить, в каком доме находится планета
        
        Args:
            planet_lon: Долгота планеты
            houses: Список домов с куспидами
        
        Returns:
            Номер дома (1-12)
        """
        for i in range(12):
            current_house = houses[i]
            next_house = houses[(i + 1) % 12]
            
            cusp_current = current_house['longitude']
            cusp_next = next_house['longitude']
            
            # Обработка перехода через 0° Овна
            if cusp_next < cusp_current:
                if planet_lon >= cusp_current or planet_lon < cusp_next:
                    return current_house['number']
            else:
                if cusp_current <= planet_lon < cusp_next:
                    return current_house['number']
        
        # Если не нашли (не должно происходить), возвращаем 1
        return 1


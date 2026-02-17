"""
Сервис для работы с Swiss Ephemeris
"""
import swisseph as swe
from typing import List, Dict, Tuple
from app.utils.constants import PLANETS, get_zodiac_sign, get_degree_in_sign, format_degree_minutes_seconds
from app.services.special_points_service import SpecialPointsService
from app.utils.ephemeris import get_ephemeris_path
from loguru import logger


class SwissEphemerisEngine:
    """Движок для астрономических расчётов с использованием Swiss Ephemeris"""
    
    def __init__(self, ephe_path: str = None):
        """
        Инициализация движка

        Args:
            ephe_path: Путь к файлам эфемерид (опционально)
        """
        self.ephe_path = ephe_path or get_ephemeris_path()
        self._ensure_ephe_path()

    def _ensure_ephe_path(self) -> None:
        """Гарантированно применяет путь к файлам эфемерид."""
        swe.set_ephe_path(self.ephe_path)
    
    def calculate_planets(self, jd: float) -> List[Dict]:
        """
        Расчёт позиций планет

        Args:
            jd: Юлианский день

        Returns:
            Список словарей с данными о планетах
        """
        self._ensure_ephe_path()
        planets_data = []

        for planet_id, planet_name in PLANETS.items():
            # Прозерпина (ID=1000) рассчитывается отдельно методом интерполяции
            if planet_id == 1000:
                longitude = SpecialPointsService.calculate_proserpina(jd)
                latitude = 0.0  # Фиктивная планета, широта = 0
                distance = 0.0  # Расстояние не определено
                speed_lon = 0.461968 / 365.25  # Средняя скорость в градусах/день (27.72' в год)
                is_retrograde = False  # Прозерпина всегда директная
            else:
                # Расчёт позиции планеты через Swiss Ephemeris
                try:
                    planet_data, ret = swe.calc_ut(jd, planet_id, swe.FLG_SWIEPH | swe.FLG_SPEED)
                except Exception as e:
                    # После swe.close() глобальный ephe_path может сбрасываться.
                    # Повторно применяем путь и делаем один retry.
                    self._ensure_ephe_path()
                    logger.warning("SwissEph calc_ut retry after path reset: {}", str(e))
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
        # Сбрасываем состояние Swiss Ephemeris перед расчётом
        # Это предотвращает ошибки после нескольких вызовов
        swe.close()
        self._ensure_ephe_path()

        # Расчёт домов через Swiss Ephemeris
        # Для высоких широт (>66°) Placidus и Koch не работают
        polar_mode = False
        try:
            cusps, ascmc = swe.houses(jd, lat, lon, hsys.encode())
        except Exception as e:
            # Если ошибка - используем Equal houses от MC (как в ZET)
            # Берём реальный MC и откладываем дома по 30° от него
            if abs(lat) > 66.0:
                polar_mode = True
                # Получаем реальный MC через Equal houses
                _, ascmc_raw = swe.houses(jd, lat, lon, b'E')
                mc = ascmc_raw[1]  # Реальный MC

                # ASC = MC + 90° (система Equal Houses от MC, как в ZET)
                asc_polar = (mc + 90.0) % 360

                # Строим Equal дома от MC: 10 дом = MC, остальные по 30°
                cusps = []
                for i in range(12):
                    house_offset = (i - 9) * 30  # Смещение от 10 дома
                    cusp = (mc + house_offset) % 360
                    cusps.append(cusp)
                cusps = tuple(cusps)

                # Переопределяем ascmc с правильным ASC
                # ascmc: [ASC, MC, ARMC, Vertex, ...]
                ascmc = list(ascmc_raw)
                ascmc[0] = asc_polar  # Правильный ASC для полярных широт
                ascmc[3] = None  # Vertex не определён для полярных широт
            else:
                raise e

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

        # Vertex не определён для полярных широт
        vertex_lon = ascmc[3] if ascmc[3] is not None else None
        vertex_deg = get_degree_in_sign(vertex_lon) if vertex_lon is not None else None

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
                'longitude': vertex_lon,
                'sign': get_zodiac_sign(vertex_lon) if vertex_lon is not None else None,
                'degree_in_sign': vertex_deg,
                'degree_in_sign_formatted': format_degree_minutes_seconds(vertex_deg) if vertex_deg is not None else None,
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

        Логика: планета находится в доме N, если она расположена
        между куспидом дома N и куспидом дома N+1 (по ходу Зодиака).

        Args:
            planet_lon: Долгота планеты (0-360°)
            houses: Список домов с куспидами

        Returns:
            Номер дома (1-12)
        """
        # Защита от неполных/отсутствующих данных домов в БД:
        # не роняем прогнозные эндпоинты, возвращаем fallback-дом.
        if not houses or len(houses) < 12:
            logger.warning(
                "get_planet_house fallback: invalid houses data (len={})",
                len(houses) if houses is not None else 0
            )
            return 1

        # Проходим по всем домам и проверяем, находится ли планета между
        # куспидом текущего дома и куспидом следующего дома
        for i in range(12):
            current_house = houses[i]
            next_house = houses[(i + 1) % 12]  # Следующий дом (с учётом цикла 12->1)

            cusp_current = current_house['longitude']
            cusp_next = next_house['longitude']

            # Проверяем, находится ли планета между двумя куспидами
            # Учитываем переход через 0° (например, 12 дом -> 1 дом)
            if cusp_next > cusp_current:
                # Обычный случай: куспиды не пересекают 0°
                if cusp_current <= planet_lon < cusp_next:
                    return current_house['number']
            else:
                # Переход через 0°: например, 12 дом (350°) -> 1 дом (10°)
                if planet_lon >= cusp_current or planet_lon < cusp_next:
                    return current_house['number']

        # Если не нашли (не должно происходить), возвращаем 1 дом
        return 1

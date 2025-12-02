"""
Сервис для расчёта специальных астрологических точек
"""
import swisseph as swe
from typing import Dict, Tuple
from app.utils.constants import normalize_longitude


class SpecialPointsService:
    """Сервис для расчёта специальных точек (узлы, Лилит, Селена, Фортуна и т.д.)"""
    
    @staticmethod
    def calculate_true_nodes(jd: float) -> Tuple[float, float]:
        """
        Расчёт истинных Лунных узлов (Раху и Кету)
        
        Args:
            jd: Юлианский день
        
        Returns:
            Кортеж (north_node_longitude, south_node_longitude)
        """
        # Расчёт истинного Северного узла
        north_node_data, ret = swe.calc_ut(jd, swe.TRUE_NODE, swe.FLG_SWIEPH)
        north_node_lon = north_node_data[0]
        
        # Южный узел = Северный узел + 180°
        south_node_lon = normalize_longitude(north_node_lon + 180)
        
        return north_node_lon, south_node_lon
    
    @staticmethod
    def calculate_black_moon(jd: float) -> float:
        """
        Расчёт Чёрной Луны (Лилит) - средний апогей Луны

        Используется метод MEAN APOGEE, который является стандартом
        в большинстве астрологических эфемерид и программ (включая ZET).

        Документация Swiss Ephemeris: "most astrologers associate her
        with the Mean Apogee"

        Args:
            jd: Юлианский день

        Returns:
            Долгота Чёрной Луны в градусах
        """
        # Используем средний апогей (MEAN_APOG) - стандарт в астрологии
        black_moon_data, ret = swe.calc_ut(jd, swe.MEAN_APOG, swe.FLG_SWIEPH)
        return black_moon_data[0]

    @staticmethod
    def calculate_white_moon(jd: float) -> float:
        """
        Расчёт Белой Луны (Селены) по формуле ZET

        Используется формула из программы ZET (Zet Geo), которая широко
        распространена в русскоязычной астрологической школе и авестийской
        традиции.

        Формула: Селена = (242.4900166227 + 0.1408037548 × (JD - 2451545.0)) mod 360

        Параметры:
        - Период обращения: 7.0 лет (не 7.022 как в Swiss Ephemeris)
        - Начальная долгота на J2000.0: 242.4900166227°
        - Среднее движение: 0.1408037548 град/день

        Args:
            jd: Юлианский день

        Returns:
            Долгота Белой Луны в градусах
        """
        # Константы формулы ZET для Селены
        J2000 = 2451545.0  # Эпоха J2000.0 (1 января 2000, 12:00 TT)
        INITIAL_LONGITUDE = 242.4900166227  # Начальная долгота на J2000
        MEAN_MOTION_PER_DAY = 0.1408037548  # Среднее движение в градусах/день

        # Расчёт количества дней от эпохи J2000
        days_from_j2000 = jd - J2000

        # Расчёт долготы Селены
        selena_longitude = (INITIAL_LONGITUDE + MEAN_MOTION_PER_DAY * days_from_j2000) % 360

        return selena_longitude
    
    @staticmethod
    def calculate_chiron(jd: float) -> float:
        """
        Расчёт позиции Хирона
        
        Args:
            jd: Юлианский день
        
        Returns:
            Долгота Хирона в градусах
        """
        chiron_data, ret = swe.calc_ut(jd, swe.CHIRON, swe.FLG_SWIEPH)
        return chiron_data[0]
    
    @staticmethod
    def calculate_part_of_fortune(
        asc_lon: float,
        sun_lon: float,
        moon_lon: float,
        sun_house: int
    ) -> float:
        """
        Расчёт Колеса Фортуны (Part of Fortune)
        
        Формула:
        - Дневная карта (Солнце в домах 7-12): Fortune = ASC + Moon - Sun
        - Ночная карта (Солнце в домах 1-6): Fortune = ASC + Sun - Moon
        
        Args:
            asc_lon: Долгота Асцендента
            sun_lon: Долгота Солнца
            moon_lon: Долгота Луны
            sun_house: Номер дома, в котором находится Солнце (1-12)
        
        Returns:
            Долгота Колеса Фортуны в градусах
        """
        # Определяем дневная или ночная карта
        # Дом 7-12 = день (Солнце над горизонтом)
        # Дом 1-6 = ночь (Солнце под горизонтом)
        is_day_chart = 7 <= sun_house <= 12
        
        if is_day_chart:
            # Дневная формула
            fortune = asc_lon + moon_lon - sun_lon
        else:
            # Ночная формула
            fortune = asc_lon + sun_lon - moon_lon
        
        return normalize_longitude(fortune)
    
    @staticmethod
    def calculate_fate_cross(north_node_lon: float) -> Dict[str, float]:
        """
        Расчёт Креста Судьбы (4 точки квадратуры к оси Лунных Узлов)
        
        Формула:
        - Раху (Северный узел)
        - Кету (Южный узел) = Раху + 180°
        - Точка Судьбы 1 = Раху + 90°
        - Точка Судьбы 2 = Раху - 90° (= Раху + 270°)
        
        Args:
            north_node_lon: Долгота Северного узла (Раху)
        
        Returns:
            Словарь с 4 точками Креста Судьбы
        """
        return {
            'Rahu': north_node_lon,
            'Ketu': normalize_longitude(north_node_lon + 180),
            'FateCross1': normalize_longitude(north_node_lon + 90),
            'FateCross2': normalize_longitude(north_node_lon + 270),
        }


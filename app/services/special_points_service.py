"""
Сервис для расчёта специальных астрологических точек
"""
import swisseph as swe
import json
import os
from datetime import datetime
from typing import Dict, Tuple
from app.utils.constants import normalize_longitude


class SpecialPointsService:
    """Сервис для расчёта специальных точек (узлы, Лилит, Селена, Фортуна и т.д.)"""

    # Кэш для эфемерид Прозерпины
    _proserpina_ephemeris = None

    @classmethod
    def _load_proserpina_ephemeris(cls) -> Dict:
        """
        Загрузка эфемерид Прозерпины из JSON файла (с кэшированием)

        Returns:
            Словарь с эфемеридами Прозерпины
        """
        if cls._proserpina_ephemeris is None:
            # Путь к файлу эфемерид
            current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            ephemeris_path = os.path.join(current_dir, 'data', 'proserpina_ephemeris.json')

            with open(ephemeris_path, 'r', encoding='utf-8') as f:
                cls._proserpina_ephemeris = json.load(f)

        return cls._proserpina_ephemeris

    @staticmethod
    def calculate_proserpina(jd: float) -> float:
        """
        Расчёт позиции Прозерпины методом линейной интерполяции

        Метод используется в школе Михаила Левина и Константина Дарагана.
        Прозерпина движется крайне медленно (~0.54135° в год), поэтому
        используется табличный метод с линейной интерполяцией между
        значениями на 1 января текущего и следующего года.

        Формула:
        P_date = P_start + (P_end - P_start) × (D_passed / D_year)

        где:
        - P_start: координата на 1 января текущего года
        - P_end: координата на 1 января следующего года
        - D_passed: количество дней от начала года
        - D_year: длительность года (365 или 366)

        Args:
            jd: Юлианский день

        Returns:
            Долгота Прозерпины в градусах
        """
        # Загружаем эфемериды
        ephemeris = SpecialPointsService._load_proserpina_ephemeris()

        # Конвертируем JD в календарную дату
        year, month, day, hour = swe.revjul(jd)

        # Получаем позиции на начало текущего и следующего года
        year_str = str(year)
        next_year_str = str(year + 1)

        if year_str not in ephemeris or next_year_str not in ephemeris:
            raise ValueError(f"Эфемериды Прозерпины недоступны для года {year}")

        p_start = ephemeris[year_str]['longitude']
        p_end = ephemeris[next_year_str]['longitude']

        # Определяем високосный год
        is_leap = (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)
        days_in_year = 366 if is_leap else 365

        # Вычисляем количество дней от начала года
        # JD для 1 января текущего года в 00:00
        jd_year_start = swe.julday(year, 1, 1, 0.0)
        days_passed = jd - jd_year_start

        # Линейная интерполяция
        # Учитываем переход через 0° (360° -> 0°)
        delta = p_end - p_start
        if delta < -180:  # Переход через 0° вперёд
            delta += 360
        elif delta > 180:  # Переход через 0° назад
            delta -= 360

        proserpina_lon = p_start + delta * (days_passed / days_in_year)

        return normalize_longitude(proserpina_lon)

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
        sun_house: int,
        jd: float = None,
        latitude: float = None,
        longitude: float = None
    ) -> float:
        """
        Расчёт Колеса Фортуны (Part of Fortune)

        Формула (классическая, как в ZET):
        - Дневная карта (Солнце над горизонтом): Fortune = ASC + Moon - Sun
        - Ночная карта (Солнце под горизонтом): Fortune = ASC + Sun - Moon

        Определение дня/ночи:
        - Для обычных широт (|lat| < 60°): по номеру дома (7-12 = день, 1-6 = ночь)
        - Для полярных широт (|lat| >= 60°): по астрономической высоте Солнца над горизонтом
          (используется Swiss Ephemeris swe_azalt для точного расчёта)

        Args:
            asc_lon: Долгота Асцендента
            sun_lon: Долгота Солнца
            moon_lon: Долгота Луны
            sun_house: Номер дома, в котором находится Солнце (1-12)
            jd: Юлианский день (опционально, для полярных широт)
            latitude: Географическая широта (опционально, для полярных широт)
            longitude: Географическая долгота (опционально, для полярных широт)

        Returns:
            Долгота Колеса Фортуны в градусах
        """
        import swisseph as swe

        # Определяем дневная или ночная карта
        is_day_chart = None

        # Для полярных широт используем астрономический расчёт
        if latitude is not None and abs(latitude) >= 60.0 and jd is not None and longitude is not None:
            # Рассчитываем высоту Солнца над горизонтом через Swiss Ephemeris
            geopos = [longitude, latitude, 0]  # долгота, широта, высота над уровнем моря
            xin = [sun_lon, 0, 1]  # эклиптические координаты: долгота, широта, расстояние

            # azalt возвращает tuple: (азимут, истинная высота, видимая высота)
            azimuth, true_altitude, apparent_altitude = swe.azalt(jd, swe.ECL2HOR, geopos, 0, 0, xin)

            is_day_chart = true_altitude > 0  # если > 0, то Солнце над горизонтом = день
        else:
            # Для обычных широт используем классическую логику по номеру дома
            # Дома 7-12 = над горизонтом = день
            # Дома 1-6 = под горизонтом = ночь
            is_day_chart = 7 <= sun_house <= 12

        if is_day_chart:
            # Дневная формула: ASC + Moon - Sun
            fortune = asc_lon + moon_lon - sun_lon
        else:
            # Ночная формула: ASC + Sun - Moon
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


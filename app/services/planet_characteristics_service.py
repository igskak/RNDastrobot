"""
Сервис для расчёта характеристик планет и домов.

Уровни имплементации:
- Уровень 1: Критические градусы, Скорость %, Сигнификаторы
- Уровень 2: Казими/Сожжение/В лучах (sun_relation)
- Уровень 3: Включённые знаки, Соуправители, Элевация
- Уровень 4: Партильность, Шахта, Гармония аспектов
- Уровень 5: Стационарность
- Уровень 6: Кармический статус
"""
import json
from pathlib import Path
from typing import List, Dict, Optional, Any


class PlanetCharacteristicsService:
    """Сервис для расчёта характеристик планет"""
    
    # Загрузка справочников
    REF_PATH = Path(__file__).parent.parent.parent / 'ref'
    
    # Средние скорости планет (градусы/день)
    MEAN_SPEEDS: Dict[str, float] = {}
    
    # Сигнификаторы домов
    HOUSE_SIGNIFICATORS: Dict[int, str] = {}
    
    # Критические градусы (применимы к любому знаку)
    CRITICAL_DEGREES = {
        'jubilee': 1,      # Юбилей — 1°
        'middle': 15,      # Серединный — 15°
        'anareta': 30,     # Анарета — последний градус (29.x → 30)
    }
    
    # Королевские градусы (по знакам, абсолютные позиции 0-360)
    ROYAL_DEGREES = [
        (19, 'Aries'),      # 19° Овна
        (3, 'Gemini'),      # 3° Близнецов  
        (9, 'Leo'),         # 9° Льва (Regulus)
        (22, 'Scorpio'),    # 22° Скорпиона
        (29, 'Aquarius'),   # 29° Водолея
    ]
    
    # Разрушительные градусы (по знакам)
    DESTRUCTIVE_DEGREES = [
        (9, 'Aries'),       # 9° Овна
        (19, 'Taurus'),     # 19° Тельца
        (19, 'Scorpio'),    # 19° Скорпиона
        (26, 'Sagittarius'),# 26° Стрельца
    ]

    # Свойства знаков (элемент, модальность)
    SIGN_ELEMENTS = {
        'Aries': 'Fire', 'Leo': 'Fire', 'Sagittarius': 'Fire',
        'Taurus': 'Earth', 'Virgo': 'Earth', 'Capricorn': 'Earth',
        'Gemini': 'Air', 'Libra': 'Air', 'Aquarius': 'Air',
        'Cancer': 'Water', 'Scorpio': 'Water', 'Pisces': 'Water',
    }

    SIGN_MODES = {
        'Aries': 'Cardinal', 'Cancer': 'Cardinal', 'Libra': 'Cardinal', 'Capricorn': 'Cardinal',
        'Taurus': 'Fixed', 'Leo': 'Fixed', 'Scorpio': 'Fixed', 'Aquarius': 'Fixed',
        'Gemini': 'Mutable', 'Virgo': 'Mutable', 'Sagittarius': 'Mutable', 'Pisces': 'Mutable',
    }

    # Достоинства планет
    DIGNITIES = {
        'Sun': {'domicile': ['Leo'], 'exaltation': 'Aries', 'detriment': ['Aquarius'], 'fall': 'Libra'},
        'Moon': {'domicile': ['Cancer'], 'exaltation': 'Taurus', 'detriment': ['Capricorn'], 'fall': 'Scorpio'},
        'Mercury': {'domicile': ['Gemini', 'Virgo'], 'exaltation': 'Virgo', 'detriment': ['Sagittarius', 'Pisces'], 'fall': 'Pisces'},
        'Venus': {'domicile': ['Taurus', 'Libra'], 'exaltation': 'Pisces', 'detriment': ['Aries', 'Scorpio'], 'fall': 'Virgo'},
        'Mars': {'domicile': ['Aries', 'Scorpio'], 'exaltation': 'Capricorn', 'detriment': ['Libra', 'Taurus'], 'fall': 'Cancer'},
        'Jupiter': {'domicile': ['Sagittarius', 'Pisces'], 'exaltation': 'Cancer', 'detriment': ['Gemini', 'Virgo'], 'fall': 'Capricorn'},
        'Saturn': {'domicile': ['Capricorn', 'Aquarius'], 'exaltation': 'Libra', 'detriment': ['Cancer', 'Leo'], 'fall': 'Aries'},
        'Uranus': {'domicile': ['Aquarius'], 'exaltation': 'Scorpio', 'detriment': ['Leo'], 'fall': 'Taurus'},
        'Neptune': {'domicile': ['Pisces'], 'exaltation': 'Cancer', 'detriment': ['Virgo'], 'fall': 'Capricorn'},
        'Pluto': {'domicile': ['Scorpio'], 'exaltation': 'Leo', 'detriment': ['Taurus'], 'fall': 'Aquarius'},
    }

    @classmethod
    def get_sign_element(cls, sign: str) -> str:
        """Получить элемент знака"""
        return cls.SIGN_ELEMENTS.get(sign, '')

    @classmethod
    def get_sign_mode(cls, sign: str) -> str:
        """Получить модальность знака"""
        return cls.SIGN_MODES.get(sign, '')

    @classmethod
    def get_dignity(cls, planet_name: str, sign: str) -> str:
        """Получить достоинство планеты в знаке"""
        dignities = cls.DIGNITIES.get(planet_name, {})
        if not dignities:
            return 'neutral'

        if sign in dignities.get('domicile', []):
            return 'domicile'
        elif sign == dignities.get('exaltation'):
            return 'exaltation'
        elif sign in dignities.get('detriment', []):
            return 'detriment'
        elif sign == dignities.get('fall'):
            return 'fall'
        return 'neutral'

    @classmethod
    def _load_references(cls):
        """Загрузить справочники если ещё не загружены"""
        if not cls.MEAN_SPEEDS:
            with open(cls.REF_PATH / 'ref_planet_mean_speeds.json', 'r') as f:
                data = json.load(f)
                cls.MEAN_SPEEDS = {k: v for k, v in data.items() if not k.startswith('_')}
        
        if not cls.HOUSE_SIGNIFICATORS:
            with open(cls.REF_PATH / 'ref_house_significators.json', 'r') as f:
                data = json.load(f)
                cls.HOUSE_SIGNIFICATORS = {int(k): v for k, v in data.items() if not k.startswith('_')}
    
    # Орбисы для отношения к Солнцу (в градусах)
    SUN_RELATION_ORBS = {
        'cazimi': 17 / 60,      # 0°17' = 0.283°
        'combust': 3.0,         # до 3°
        'under_rays': 9.0,      # до 9° (базовый) - "в лучах"
        'under_rays_strong': 12.0,  # до 12° если Солнце сильное
    }

    # =========================================================================
    # УРОВЕНЬ 1: Простые характеристики
    # =========================================================================
    
    @classmethod
    def calculate_speed_percent(cls, planet_name: str, actual_speed: float) -> Optional[float]:
        """
        Рассчитать скорость планеты в процентах от средней.
        
        Args:
            planet_name: Название планеты
            actual_speed: Фактическая скорость (градусы/день)
            
        Returns:
            Скорость в процентах (100% = средняя) или None если планета не в справочнике
        """
        cls._load_references()
        mean_speed = cls.MEAN_SPEEDS.get(planet_name)
        if mean_speed is None or mean_speed == 0:
            return None
        return round(abs(actual_speed) / mean_speed * 100, 2)
    
    @classmethod
    def calculate_critical_degrees(cls, planet_name: str, sign: str, degree_in_sign: float) -> List[str]:
        """
        Определить критические градусы для позиции планеты.
        
        Args:
            planet_name: Название планеты
            sign: Знак зодиака
            degree_in_sign: Градус внутри знака (0-30)
            
        Returns:
            Список критических градусов: ['jubilee', 'royal', ...]
        """
        result = []
        degree_int = int(degree_in_sign) + 1  # 0.x -> 1°, 14.x -> 15°, 29.x -> 30°
        
        # Проверка универсальных критических градусов
        if degree_int == cls.CRITICAL_DEGREES['jubilee']:
            result.append('jubilee')
        if degree_int == cls.CRITICAL_DEGREES['middle']:
            result.append('middle')
        if degree_int == cls.CRITICAL_DEGREES['anareta'] or degree_in_sign >= 29.0:
            result.append('anareta')
        
        # Проверка королевских градусов
        for deg, royal_sign in cls.ROYAL_DEGREES:
            if sign == royal_sign and degree_int == deg:
                result.append('royal')
                break
        
        # Проверка разрушительных градусов
        for deg, destr_sign in cls.DESTRUCTIVE_DEGREES:
            if sign == destr_sign and degree_int == deg:
                result.append('destructive')
                break
        
        return result
    
    @classmethod
    def get_house_significator(cls, house_number: int) -> Optional[str]:
        """
        Получить естественный сигнификатор дома.
        
        Args:
            house_number: Номер дома (1-12)
            
        Returns:
            Название планеты-сигнификатора
        """
        cls._load_references()
        return cls.HOUSE_SIGNIFICATORS.get(house_number)

    # =========================================================================
    # УРОВЕНЬ 2: Солнечные характеристики
    # =========================================================================

    @classmethod
    def calculate_sun_relation(
        cls,
        planet_name: str,
        planet_longitude: float,
        sun_longitude: float,
        sun_is_strong: bool = False
    ) -> Optional[str]:
        """
        Определить отношение планеты к Солнцу.

        Args:
            planet_name: Название планеты
            planet_longitude: Абсолютная долгота планеты (0-360)
            sun_longitude: Абсолютная долгота Солнца (0-360)
            sun_is_strong: Солнце в сильном положении (расширяет орбис лучей до 12°)

        Returns:
            'cazimi' | 'combust' | 'under_rays' | None
        """
        # Солнце не может быть в отношении к себе
        if planet_name == 'Sun':
            return None

        # Луна не считается сожжённой (особый случай)
        # Но казими и в лучах для неё применимы

        # Вычисляем угловое расстояние
        diff = abs(planet_longitude - sun_longitude)
        if diff > 180:
            diff = 360 - diff

        # Проверяем орбисы
        if diff <= cls.SUN_RELATION_ORBS['cazimi']:
            return 'cazimi'

        if diff <= cls.SUN_RELATION_ORBS['combust']:
            # Луна не считается сожжённой
            if planet_name == 'Moon':
                return 'under_rays'
            return 'combust'

        # Определяем границу для лучей
        rays_limit = (cls.SUN_RELATION_ORBS['under_rays_strong']
                      if sun_is_strong
                      else cls.SUN_RELATION_ORBS['under_rays'])

        if diff <= rays_limit:
            return 'under_rays'

        return None

    # =========================================================================
    # УРОВЕНЬ 3: Дома и знаки
    # =========================================================================

    @classmethod
    def find_intercepted_signs(cls, houses: List[Dict[str, Any]]) -> List[str]:
        """
        Найти включённые (intercepted) знаки.

        Включённый знак — знак, который полностью находится внутри дома,
        без куспидов на нём (ни начало, ни конец дома не попадают в этот знак).

        Args:
            houses: Список домов с полями sign (знак на куспиде)

        Returns:
            Список включённых знаков
        """
        # Собираем все знаки на куспидах
        cusp_signs = {house.get('sign') for house in houses}

        # Все 12 знаков
        all_signs = [
            'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
            'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
        ]

        # Включённые — те, которых нет на куспидах
        intercepted = [sign for sign in all_signs if sign not in cusp_signs]

        return intercepted

    @classmethod
    def is_planet_in_intercepted_sign(
        cls,
        planet_sign: str,
        intercepted_signs: List[str]
    ) -> bool:
        """Проверить, находится ли планета во включённом знаке."""
        return planet_sign in intercepted_signs

    @classmethod
    def find_elevated_planet(cls, planets: List[Dict[str, Any]]) -> Optional[str]:
        """
        Найти планету в элевации (самая высокая над горизонтом).

        Элевация — планета на MC (в 10 доме) или в 9 доме.
        Если несколько планет в 9-10 домах, выбираем ближайшую к MC.

        Args:
            planets: Список планет с полем house

        Returns:
            Имя планеты в элевации или None
        """
        candidates = []
        for planet in planets:
            house = planet.get('house')
            if house in [9, 10]:
                candidates.append({
                    'name': planet.get('name'),
                    'house': house,
                    'longitude': planet.get('longitude', 0)
                })

        if not candidates:
            return None

        # Приоритет 10 дому, затем по долготе (ближе к MC)
        # Упрощённо: 10 дом > 9 дом
        for c in candidates:
            if c['house'] == 10:
                return c['name']

        # Если только 9 дом — первая планета
        return candidates[0]['name'] if candidates else None

    # =========================================================================
    # УРОВЕНЬ 4: Аспекты и шахта
    # =========================================================================

    # Порог для партильного аспекта (градусы)
    PARTILE_ORB = 1.0

    # Гармоничные и напряжённые типы аспектов
    HARMONIC_ASPECTS = {'trine', 'sextile'}
    TENSE_ASPECTS = {'opposition', 'square'}

    @classmethod
    def is_partile_aspect(cls, orb: float) -> bool:
        """
        Проверить, является ли аспект партильным (точным).

        Args:
            orb: Орбис аспекта в градусах

        Returns:
            True если аспект партильный
        """
        return abs(orb) <= cls.PARTILE_ORB

    @classmethod
    def find_peregrine_planets(
        cls,
        planets: List[Dict[str, Any]],
        aspects: List[Dict[str, Any]]
    ) -> List[str]:
        """
        Найти планеты в шахте (без аспектов).

        Args:
            planets: Список планет
            aspects: Список аспектов

        Returns:
            Список имён планет в шахте
        """
        # Собираем все планеты, участвующие в аспектах
        aspected_planets = set()
        for aspect in aspects:
            aspected_planets.add(aspect.get('planet_1'))
            aspected_planets.add(aspect.get('planet_2'))

        # Планеты без аспектов
        peregrine = []
        for planet in planets:
            name = planet.get('name')
            if name and name not in aspected_planets:
                peregrine.append(name)

        return peregrine

    @classmethod
    def calculate_aspect_harmony(
        cls,
        planet_name: str,
        aspects: List[Dict[str, Any]]
    ) -> Optional[str]:
        """
        Определить гармонию аспектов для планеты.

        Args:
            planet_name: Название планеты
            aspects: Список всех аспектов

        Returns:
            'harmonious' | 'tense' | 'mixed' | None (если нет аспектов)
        """
        harmonic_count = 0
        tense_count = 0

        for aspect in aspects:
            p1 = aspect.get('planet_1')
            p2 = aspect.get('planet_2')

            if planet_name not in (p1, p2):
                continue

            aspect_type = aspect.get('aspect_type', '').lower()

            if aspect_type in cls.HARMONIC_ASPECTS:
                harmonic_count += 1
            elif aspect_type in cls.TENSE_ASPECTS:
                tense_count += 1

        if harmonic_count == 0 and tense_count == 0:
            return None  # Шахта

        if harmonic_count > tense_count:
            return 'harmonious'
        elif tense_count > harmonic_count:
            return 'tense'
        else:
            return 'mixed'

    @classmethod
    def enrich_aspects(cls, aspects: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Обогатить аспекты характеристикой партильности.

        Args:
            aspects: Список аспектов

        Returns:
            Обогащённый список аспектов
        """
        for aspect in aspects:
            orb = aspect.get('orb', 999)
            aspect['is_partile'] = cls.is_partile_aspect(orb)

        return aspects

    # =========================================================================
    # УРОВЕНЬ 5: Стационарность
    # =========================================================================

    # Дефолтный порог стационарности: скорость <= 5% от средней.
    # Может быть переопределён через account methodology preferences.
    STATIONARY_THRESHOLD_PERCENT = 5.0

    @classmethod
    def calculate_stationary_status(
        cls,
        planet_name: str,
        speed: float,
        is_retrograde: bool,
        threshold_percent: Optional[float] = None,
    ) -> tuple:
        """
        Определить стационарный статус планеты.

        Стационарная планета — планета с очень малой скоростью,
        что происходит при смене направления движения.

        Args:
            planet_name: Название планеты
            speed: Скорость планеты (градусы/день)
            is_retrograde: Ретроградна ли планета

        Returns:
            (is_stationary: bool, stationary_type: str | None)
            stationary_type: 'pre_retrograde' | 'pre_direct' | None
        """
        # Светила не бывают стационарными
        if planet_name in ('Sun', 'Moon'):
            return (False, None)

        stationary_threshold = float(
            cls.STATIONARY_THRESHOLD_PERCENT if threshold_percent is None else threshold_percent
        )
        speed_percent = cls.calculate_speed_percent(planet_name, speed)

        if speed_percent is None:
            return (False, None)

        if speed_percent <= stationary_threshold:
            # Определяем тип стационарности по направлению движения
            # Если ретро — то планета "выходит" из ретро (pre_direct)
            # Если директ — то планета "входит" в ретро (pre_retrograde)
            if is_retrograde:
                stationary_type = 'pre_direct'
            else:
                stationary_type = 'pre_retrograde'
            return (True, stationary_type)

        return (False, None)

    # =========================================================================
    # УРОВЕНЬ 6: Кармический статус
    # =========================================================================

    # =========================================================================
    # Вспомогательные методы для кармического статуса
    # =========================================================================

    @staticmethod
    def _normalize_angle(angle: float) -> float:
        """Нормализовать угол к диапазону 0-360"""
        angle = angle % 360
        if angle < 0:
            angle += 360
        return angle

    @staticmethod
    def _angular_distance(lon1: float, lon2: float) -> float:
        """Кратчайшее угловое расстояние между двумя долготами (0-180)"""
        diff = abs(lon1 - lon2)
        if diff > 180:
            diff = 360 - diff
        return diff

    @classmethod
    def _is_on_angle(
        cls,
        planet_lon: float,
        angle_lon: float,
        orb: float = 5.0
    ) -> bool:
        """Проверить, находится ли планета на угле (в пределах орбиса)"""
        return cls._angular_distance(planet_lon, angle_lon) <= orb

    @classmethod
    def _has_aspect_to_point(
        cls,
        planet_name: str,
        point_name: str,
        aspects: List[Dict[str, Any]],
        aspect_types: List[str]
    ) -> bool:
        """
        Проверить, есть ли у планеты аспект к точке.

        Args:
            planet_name: Название планеты
            point_name: Название точки (BlackMoon, TrueNorthNode, etc.)
            aspects: Список аспектов
            aspect_types: Типы аспектов для проверки (Conjunction, Trine, etc.)

        Returns:
            True если аспект найден
        """
        for aspect in aspects:
            p1 = aspect.get('planet_1', '')
            p2 = aspect.get('planet_2', '')
            aspect_type = aspect.get('aspect_type', '')

            # Проверяем оба направления
            if aspect_type in aspect_types:
                if (p1 == planet_name and p2 == point_name) or \
                   (p1 == point_name and p2 == planet_name):
                    return True
        return False

    @classmethod
    def _is_in_ophiuchus_sector(cls, sign: str, degree_in_sign: float) -> bool:
        """
        Проверить, находится ли планета в секторе Змееносца.
        Сектор: 23°-30° Скорпиона + 0°-7° Стрельца
        """
        if sign == 'Scorpio' and degree_in_sign >= 23:
            return True
        if sign == 'Sagittarius' and degree_in_sign <= 7:
            return True
        return False

    @classmethod
    def calculate_karmic_score(
        cls,
        planet: Dict[str, Any],
        aspects: List[Dict[str, Any]] = None,
        angles: Dict[str, float] = None,
        special_points: Dict[str, Any] = None,
        all_planets: List[Dict[str, Any]] = None
    ) -> Dict[str, int]:
        """
        Рассчитать кармический статус планеты по методичке Алёны.

        ГЛАВНОЕ: Считаем отдельно минусовой и плюсовой столбик.
        Столбики НЕ складываем. Если модуль столбика > 3 — суммируем модули.

        Args:
            planet: Словарь с данными планеты
            aspects: Список аспектов карты
            angles: Углы {ASC: lon, MC: lon, IC: lon, DSC: lon}
            special_points: Специальные точки {BlackMoon: {longitude: ...}, ...}
            all_planets: Все планеты карты (для проверки соединений)

        Returns:
            Dict с ключами: minus_score, plus_score, total
        """
        aspects = aspects or []
        angles = angles or {}
        special_points = special_points or {}
        all_planets = all_planets or []

        minus_score = 0
        plus_score = 0

        name = planet.get('name', '')
        longitude = planet.get('longitude', 0.0)
        sign = planet.get('sign', '')
        degree_in_sign = planet.get('degree_in_sign', 0.0)
        house_number = planet.get('house') or planet.get('house_number')
        ruled_houses = planet.get('ruled_houses', [])
        special_roles = planet.get('special_roles', [])
        dignity = planet.get('dignity', '')

        # Категория планеты
        luminaries = {'Sun', 'Moon'}
        personal = {'Mercury', 'Venus', 'Mars'}
        outer = {'Uranus', 'Neptune', 'Pluto'}

        # =====================================================================
        # МИНУСОВОЙ СТОЛБИК (-2 балла)
        # =====================================================================

        # В поражении по аспектам
        if planet.get('aspect_harmony') == 'tense':
            minus_score += 2

        # В Изгнании или Падении
        if dignity in ('detriment', 'fall'):
            minus_score += 2

        # В ретро-движении
        if planet.get('is_retrograde') or planet.get('retrograde'):
            minus_score += 2

        # В сожжении
        if planet.get('sun_relation') == 'combust':
            minus_score += 2

        # Управляет 4 или 12 домом
        if 4 in ruled_houses or 12 in ruled_houses:
            minus_score += 2

        # На ASC со стороны 12 дома (в 12 доме, близко к ASC)
        asc_lon = angles.get('ASC')
        if asc_lon is not None and house_number == 12:
            if cls._is_on_angle(longitude, asc_lon, orb=5.0):
                minus_score += 2

        # На IC (±5°)
        ic_lon = angles.get('IC')
        if ic_lon is not None and cls._is_on_angle(longitude, ic_lon, orb=5.0):
            minus_score += 2

        # В соединении с Лилит (BlackMoon)
        if cls._has_aspect_to_point(name, 'BlackMoon', aspects, ['Conjunction']):
            minus_score += 2

        # Затмение: для Солнца/Луны — соединение с Узлами ≤3°
        if name in luminaries:
            north_node = special_points.get('TrueNorthNode', {})
            south_node = special_points.get('TrueSouthNode', {})
            nn_lon = north_node.get('longitude')
            sn_lon = south_node.get('longitude')
            if nn_lon is not None and cls._angular_distance(longitude, nn_lon) <= 3:
                minus_score += 2
            if sn_lon is not None and cls._angular_distance(longitude, sn_lon) <= 3:
                minus_score += 2

        # =====================================================================
        # МИНУСОВОЙ СТОЛБИК (-1 балл)
        # =====================================================================

        # Во включенном знаке
        if planet.get('in_intercepted_sign'):
            minus_score += 1

        # В шахте (без мажорных аспектов)
        if planet.get('is_peregrine'):
            minus_score += 1

        # В 4 или 12 доме
        if house_number in (4, 12):
            minus_score += 1

        # Квадратура к Лунным Узлам
        if cls._has_aspect_to_point(name, 'TrueNorthNode', aspects, ['Square']) or \
           cls._has_aspect_to_point(name, 'TrueSouthNode', aspects, ['Square']):
            minus_score += 1

        # =====================================================================
        # ПЛЮСОВОЙ СТОЛБИК (+2 балла)
        # =====================================================================

        # Гармонично аспектирована
        if planet.get('aspect_harmony') == 'harmonious':
            plus_score += 2

        # В Обители или Экзальтации
        if dignity in ('domicile', 'exaltation'):
            plus_score += 2

        # Быстрая в движении (> 100% от средней)
        speed_percent = planet.get('speed_percent')
        if speed_percent is not None and speed_percent > 100:
            plus_score += 2

        # В сердце Солнца (Казими), кроме Луны
        if planet.get('sun_relation') == 'cazimi' and name != 'Moon':
            plus_score += 2

        # Управляет 1 или 10 домом
        if 1 in ruled_houses or 10 in ruled_houses:
            plus_score += 2

        # На ASC со стороны 1 дома (в 1 доме, близко к ASC)
        if asc_lon is not None and house_number == 1:
            if cls._is_on_angle(longitude, asc_lon, orb=5.0):
                plus_score += 2

        # На MC (±5°)
        mc_lon = angles.get('MC')
        if mc_lon is not None and cls._is_on_angle(longitude, mc_lon, orb=5.0):
            plus_score += 2

        # =====================================================================
        # ПЛЮСОВОЙ СТОЛБИК (+1 балл)
        # =====================================================================

        # В лучах Солнца, кроме Луны
        if planet.get('sun_relation') == 'under_rays' and name != 'Moon':
            plus_score += 1

        # В 1 или 10 доме
        if house_number in (1, 10):
            plus_score += 1

        # Гармоничные аспекты к Узлам (трин, секстиль)
        harmonious_aspects = ['Trine', 'Sextile']
        if cls._has_aspect_to_point(name, 'TrueNorthNode', aspects, harmonious_aspects) or \
           cls._has_aspect_to_point(name, 'TrueSouthNode', aspects, harmonious_aspects):
            plus_score += 1

        # Возничий (Charioteer) — из special_roles
        if 'charioteer' in special_roles or 'doryphoros' in special_roles:
            plus_score += 1

        # =====================================================================
        # ±1 БАЛЛ (в оба столбика)
        # =====================================================================

        # Элевация
        if planet.get('is_elevated'):
            plus_score += 1
            minus_score += 1

        # Стационарность
        if planet.get('is_stationary'):
            plus_score += 1
            minus_score += 1

        # Ручка корзины/ведра
        if 'handle' in special_roles or 'bucket_handle' in special_roles:
            plus_score += 1
            minus_score += 1

        # Король аспектов
        if 'aspect_king' in special_roles:
            plus_score += 1
            minus_score += 1

        # Сектор Змееносца
        if cls._is_in_ophiuchus_sector(sign, degree_in_sign):
            plus_score += 1
            minus_score += 1

        # Юбилей (первые 3° знака) и Анарета (последние 3° знака)
        critical = planet.get('critical_degrees', [])
        if 'jubilee' in critical:
            plus_score += 1
            minus_score += 1
        if 'anareta' in critical:
            plus_score += 1
            minus_score += 1

        # Соединение с Узлами (для светил и личностных планет)
        if name in luminaries | personal:
            if cls._has_aspect_to_point(name, 'TrueNorthNode', aspects, ['Conjunction']) or \
               cls._has_aspect_to_point(name, 'TrueSouthNode', aspects, ['Conjunction']):
                plus_score += 1
                minus_score += 1

        # Соединение Солнце-Луна (для светил)
        if name in luminaries:
            other_luminary = 'Moon' if name == 'Sun' else 'Sun'
            if cls._has_aspect_to_point(name, other_luminary, aspects, ['Conjunction']):
                plus_score += 1
                minus_score += 1

        # Высшие планеты + Луна соединение
        if name == 'Moon':
            for outer_planet in outer:
                if cls._has_aspect_to_point(name, outer_planet, aspects, ['Conjunction']):
                    plus_score += 1
                    minus_score += 1
                    break

        # =====================================================================
        # ИТОГОВЫЙ РАСЧЁТ
        # =====================================================================
        # Суммируем модули только тех столбиков, которые > 3
        # Если оба ≤ 3, итог = 0
        total = 0
        if minus_score > 3:
            total += minus_score
        if plus_score > 3:
            total += plus_score

        return {
            'minus_score': minus_score,
            'plus_score': plus_score,
            'total': total
        }

    # =========================================================================
    # Публичные методы для обогащения данных
    # =========================================================================
    
    @classmethod
    def enrich_planets(
        cls,
        planets: List[Dict[str, Any]],
        houses: List[Dict[str, Any]] = None,
        aspects: List[Dict[str, Any]] = None,
        sun_is_strong: bool = False,
        angles: Dict[str, Any] = None,
        special_points: Dict[str, Any] = None,
        stationary_threshold_percent: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """
        Обогатить список планет характеристиками Уровней 1-6.

        Args:
            planets: Список словарей с данными планет
            houses: Список домов (для расчёта включённых знаков)
            aspects: Список аспектов (для шахты и гармонии)
            sun_is_strong: Солнце в сильном положении (для расширения орбиса лучей)
            angles: Углы карты (для кармического статуса)
            special_points: Специальные точки (для кармического статуса)
            stationary_threshold_percent: Порог стационарности в % от средней скорости

        Returns:
            Обогащённый список планет
        """
        # Находим Солнце для расчёта sun_relation
        sun_longitude = None
        for planet in planets:
            if planet.get('name') == 'Sun':
                sun_longitude = planet.get('longitude')
                break

        # УРОВЕНЬ 3: Находим включённые знаки
        intercepted_signs = cls.find_intercepted_signs(houses) if houses else []

        # УРОВЕНЬ 3: Находим планету в элевации
        elevated_planet = cls.find_elevated_planet(planets)

        # УРОВЕНЬ 4: Находим планеты в шахте
        peregrine_planets = cls.find_peregrine_planets(planets, aspects or [])

        # Подготовка данных для кармического статуса
        # Извлекаем долготы углов
        angles_lon = {}
        if angles:
            for angle_name in ('ASC', 'MC', 'IC', 'DSC'):
                angle_data = angles.get(angle_name, {})
                if isinstance(angle_data, dict):
                    angles_lon[angle_name] = angle_data.get('longitude')
                elif isinstance(angle_data, (int, float)):
                    angles_lon[angle_name] = angle_data

        for planet in planets:
            name = planet.get('name', '')
            speed = planet.get('speed', 0.0)
            sign = planet.get('sign', '')
            degree = planet.get('degree_in_sign', 0.0)
            longitude = planet.get('longitude', 0.0)

            # УРОВЕНЬ 1: Скорость в процентах
            planet['speed_percent'] = cls.calculate_speed_percent(name, speed)

            # УРОВЕНЬ 1: Критические градусы
            planet['critical_degrees'] = cls.calculate_critical_degrees(name, sign, degree)

            # УРОВЕНЬ 2: Отношение к Солнцу (казими/сожжение/в лучах)
            if sun_longitude is not None:
                planet['sun_relation'] = cls.calculate_sun_relation(
                    name, longitude, sun_longitude, sun_is_strong
                )
            else:
                planet['sun_relation'] = None

            # УРОВЕНЬ 3: Планета во включённом знаке
            planet['in_intercepted_sign'] = cls.is_planet_in_intercepted_sign(sign, intercepted_signs)

            # УРОВЕНЬ 3: Планета в элевации
            planet['is_elevated'] = (name == elevated_planet)

            # УРОВЕНЬ 4: Шахта (планета без аспектов)
            planet['is_peregrine'] = name in peregrine_planets

            # УРОВЕНЬ 4: Гармония аспектов
            planet['aspect_harmony'] = cls.calculate_aspect_harmony(name, aspects or [])

            # УРОВЕНЬ 5: Стационарность
            is_retrograde = bool(
                planet.get('is_retrograde')
                if planet.get('is_retrograde') is not None
                else planet.get('retrograde', False)
            )
            is_stationary, stationary_type = cls.calculate_stationary_status(
                name,
                speed,
                is_retrograde,
                threshold_percent=stationary_threshold_percent,
            )
            planet['is_stationary'] = is_stationary
            planet['stationary_type'] = stationary_type

            # УРОВЕНЬ 6: Кармический статус (рассчитывается после всех других характеристик)
            karmic_result = cls.calculate_karmic_score(
                planet,
                aspects=aspects or [],
                angles=angles_lon,
                special_points=special_points or {},
                all_planets=planets
            )
            planet['karmic_minus_score'] = karmic_result['minus_score']
            planet['karmic_plus_score'] = karmic_result['plus_score']
            planet['karmic_score'] = karmic_result['total']

        return planets

    @classmethod
    def enrich_houses(cls, houses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Обогатить список домов характеристиками Уровней 1 и 3.
        """
        # УРОВЕНЬ 3: Находим включённые знаки
        intercepted_signs = cls.find_intercepted_signs(houses)

        for house in houses:
            number = house.get('number', 0)

            # УРОВЕНЬ 1: Сигнификатор
            house['significator'] = cls.get_house_significator(number)

            # УРОВЕНЬ 3: Включённый знак в этом доме
            # (знак, который полностью внутри дома)
            # Для упрощения: проверяем следующий знак после куспида
            cusp_sign = house.get('sign', '')
            signs_order = [
                'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
                'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
            ]
            if cusp_sign in signs_order:
                idx = signs_order.index(cusp_sign)
                next_sign = signs_order[(idx + 1) % 12]
                if next_sign in intercepted_signs:
                    house['included_sign'] = next_sign
                else:
                    house['included_sign'] = None
            else:
                house['included_sign'] = None

        return houses

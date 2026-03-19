"""
Главный сервис для расчёта натальной карты
"""
from datetime import date, time as time_type
from typing import Dict, Optional, Tuple
from uuid import UUID
from sqlalchemy.orm import Session

from app.services.time_service import TimeService
from app.services.geocoding_service import GeocodingService
from app.services.swisseph_engine import SwissEphemerisEngine
from app.services.special_points_service import SpecialPointsService
from app.services.karmic_analysis_service import KarmicAnalysisService
from app.services.dignity_service import DignityService
from app.services.planet_characteristics_service import PlanetCharacteristicsService
from app.utils.constants import get_zodiac_sign, get_degree_in_sign, format_degree_minutes_seconds
from app.database.repositories import UserRepository, NatalChartRepository
from app.database.models import NatalAspect, NatalConfigurationAspect


class NatalChartService:
    """Главный сервис для расчёта натальной карты (оркестратор)"""

    # Единый порядок тел для UI-группировки аспектов (как в аспектной сетке).
    ASPECT_DISPLAY_ORDER = (
        'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
        'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
        'Chiron', 'Proserpina',
        'TrueNode', 'SouthNode',
        'BlackMoon', 'WhiteMoon', 'PartOfFortune',
        'ASC', 'MC', 'IC', 'DSC', 'Vertex', 'AntiVertex'
    )
    ASPECT_NAME_ALIASES = {
        'TrueNorthNode': 'TrueNode',
        'TrueSouthNode': 'SouthNode',
        'Fortune': 'PartOfFortune',
    }
    ASPECT_DISPLAY_RANK = {name: idx for idx, name in enumerate(ASPECT_DISPLAY_ORDER)}
    
    def __init__(self, ephe_path: str = None):
        """
        Инициализация сервиса
        
        Args:
            ephe_path: Путь к файлам эфемерид Swiss Ephemeris
        """
        self.time_service = TimeService()
        self.geocoding_service = GeocodingService()
        self.swisseph_engine = SwissEphemerisEngine(ephe_path)
        self.special_points_service = SpecialPointsService()
        self.karmic_analysis_service = KarmicAnalysisService()

    @classmethod
    def _normalize_aspect_name_for_order(cls, name: Optional[str]) -> Optional[str]:
        """Привести имя точки/планеты к каноническому для ранжирования."""
        if not name:
            return name
        return cls.ASPECT_NAME_ALIASES.get(name, name)

    @classmethod
    def _get_aspect_rank(cls, name: Optional[str]) -> int:
        """Получить rank по порядку аспектной сетки; неизвестные в конец."""
        normalized = cls._normalize_aspect_name_for_order(name)
        return cls.ASPECT_DISPLAY_RANK.get(normalized, 999)

    @classmethod
    def _normalize_aspect_pair(cls, planet_1: str, planet_2: str) -> Tuple[str, str, int, int]:
        """
        Нормализовать пару аспектов в детерминированный left/right порядок.
        """
        rank_1 = cls._get_aspect_rank(planet_1)
        rank_2 = cls._get_aspect_rank(planet_2)

        if rank_1 < rank_2:
            return planet_1, planet_2, rank_1, rank_2
        if rank_2 < rank_1:
            return planet_2, planet_1, rank_2, rank_1

        # tie-break для стабильного порядка неизвестных/равных alias-рангов
        if planet_1 <= planet_2:
            return planet_1, planet_2, rank_1, rank_2
        return planet_2, planet_1, rank_2, rank_1

    @classmethod
    def _enrich_aspect_for_display(cls, aspect_data: Dict) -> Dict:
        """
        Добавить к аспекту поля left/right + rank для фронтенд-сортировки/отрисовки.
        """
        left_planet, right_planet, left_rank, right_rank = cls._normalize_aspect_pair(
            aspect_data['planet_1'],
            aspect_data['planet_2'],
        )
        return {
            **aspect_data,
            'left_planet': left_planet,
            'right_planet': right_planet,
            'left_rank': left_rank,
            'right_rank': right_rank,
        }
    
    def calculate_natal_chart(
        self,
        birth_date: date,
        birth_time: time_type,
        timezone: str,
        astrologer_id: Optional[UUID] = None,
        place: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        house_system: str = 'P',
        save_to_db: bool = False,
        db_session: Optional[Session] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
    ) -> Dict:
        """
        Расчёт полной натальной карты

        Args:
            birth_date: Дата рождения
            birth_time: Время рождения
            timezone: Временная зона
            place: Название места (опционально)
            latitude: Широта (опционально)
            longitude: Долгота (опционально)
            house_system: Система домов (по умолчанию Placidus)
            save_to_db: Сохранить результат в БД (по умолчанию False)
            db_session: SQLAlchemy сессия (обязательна если save_to_db=True)

        Returns:
            Словарь с полными данными натальной карты (включая user_id если сохранено в БД)
        """
        # 1. Получаем координаты
        lat, lon, place_name = self.geocoding_service.get_coordinates(
            place=place,
            latitude=latitude,
            longitude=longitude,
            db_session=db_session,
        )
        
        # 2. Конвертируем время в UTC и получаем юлианский день
        utc_dt, jd = self.time_service.process_birth_time(
            birth_date, birth_time, timezone
        )
        
        # 3. Рассчитываем планеты
        planets = self.swisseph_engine.calculate_planets(jd)
        
        # 4. Рассчитываем дома и углы
        houses, angles = self.swisseph_engine.calculate_houses(jd, lat, lon, house_system)
        
        # 5. Определяем дома для планет
        for planet in planets:
            planet['house'] = self.swisseph_engine.get_planet_house(
                planet['longitude'], houses
            )
        
        # 6. Рассчитываем специальные точки
        special_points = self._calculate_special_points(jd, angles, planets, houses, lat, lon)

        # 7. Рассчитываем конфигурации (Крест Судьбы)
        configurations = self._calculate_configurations(special_points, houses)

        # 8. Обогащаем данные характеристиками (без БД — без аспектов)
        planets = self._enrich_planets_basic(planets, houses, angles, special_points)
        houses = self._enrich_houses_basic(houses)

        # 8.1. Добавляем связи дом-планета
        planets, houses = self._enrich_house_planet_relations(planets, houses)

        # 9. Формируем результат
        result = {
            'user_id': None,  # Будет заполнено если save_to_db=True
            'birth_data': {
                'first_name': first_name,
                'last_name': last_name,
                'date': birth_date.isoformat(),
                'time': birth_time.isoformat(),
                'timezone': timezone,
                'utc_time': utc_dt.isoformat(),
                'julian_day': jd,
                'latitude': lat,
                'longitude': lon,
                'place': place_name or place,
            },
            'planets': planets,
            'houses': houses,
            'angles': angles,
            'special_points': special_points,
            'configurations': configurations,
        }

        # 10. Сохраняем в БД если требуется
        if save_to_db:
            if db_session is None:
                raise ValueError("db_session обязательна при save_to_db=True")
            if astrologer_id is None:
                raise ValueError("astrologer_id обязателен при save_to_db=True")

            user_id = self._save_to_database(
                db_session=db_session,
                birth_date=birth_date,
                birth_time=birth_time,
                timezone=timezone,
                birth_place=place_name or place or f"{lat}, {lon}",
                lat=lat,
                lon=lon,
                julian_day=jd,
                planets=planets,
                houses=houses,
                angles=angles,
                special_points=special_points,
                configurations=configurations,
                first_name=first_name,
                last_name=last_name,
                astrologer_id=astrologer_id,
            )

            # Читаємо повні дані з БД (включаючи похідні: аспекти, конфігурації, тощо)
            db_result = self.get_natal_chart_from_db(user_id, db_session)
            if db_result is not None:
                # Якщо вдалося прочитати з БД, використовуємо ці дані
                result = db_result
            else:
                # Якщо не вдалося прочитати, додаємо user_id до базового результату
                result['user_id'] = str(user_id)

        self._append_karmic_analysis(result)
        return result

    def _append_karmic_analysis(self, chart_data: Dict) -> None:
        """Append backend-ready karmic analysis block to chart_data."""
        chart_data['karmic_analysis'] = self.karmic_analysis_service.build(chart_data)
    
    def _calculate_special_points(
        self,
        jd: float,
        angles: Dict,
        planets: list,
        houses: list,
        lat: float,
        lon: float
    ) -> Dict:
        """
        Расчёт всех специальных точек

        Примечание: Chiron теперь рассчитывается как планета в calculate_planets(),
        поэтому здесь его нет.
        """

        # Получаем данные для расчёта Фортуны
        sun = next(p for p in planets if p['name'] == 'Sun')
        moon = next(p for p in planets if p['name'] == 'Moon')
        asc_lon = angles['ASC']['longitude']

        # Рассчитываем узлы
        north_node_lon, south_node_lon = self.special_points_service.calculate_true_nodes(jd)

        # Рассчитываем Лилит и Селену
        black_moon_lon = self.special_points_service.calculate_black_moon(jd)
        white_moon_lon = self.special_points_service.calculate_white_moon(jd)

        # Рассчитываем Фортуну
        fortune_lon = self.special_points_service.calculate_part_of_fortune(
            asc_lon, sun['longitude'], moon['longitude'], sun['house'],
            jd=jd, latitude=lat, longitude=lon
        )

        # Vertex уже есть в angles (может быть None для полярных широт)
        vertex_lon = angles['Vertex']['longitude']
        anti_vertex_lon = (vertex_lon + 180) % 360 if vertex_lon is not None else None

        # Формируем результат (без Chiron - он теперь в планетах)
        special_points = {}

        for name, lon in [
            ('TrueNorthNode', north_node_lon),
            ('TrueSouthNode', south_node_lon),
            ('BlackMoon', black_moon_lon),
            ('WhiteMoon', white_moon_lon),
            ('Fortune', fortune_lon),
            ('Vertex', vertex_lon),
            ('AntiVertex', anti_vertex_lon),
        ]:
            if lon is not None:
                degree_in_sign = get_degree_in_sign(lon)
                special_points[name] = {
                    'name': name,
                    'longitude': lon,
                    'sign': get_zodiac_sign(lon),
                    'degree_in_sign': degree_in_sign,
                    'degree_in_sign_formatted': format_degree_minutes_seconds(degree_in_sign),
                    'house': self.swisseph_engine.get_planet_house(lon, houses),
                }
            else:
                special_points[name] = {
                    'name': name,
                    'longitude': None,
                    'sign': None,
                    'degree_in_sign': None,
                    'degree_in_sign_formatted': None,
                    'house': None,
                }

        return special_points

    def _calculate_configurations(self, special_points: Dict, houses: list) -> Dict:
        """Расчёт астрологических конфигураций"""

        configurations = {}

        # Крест Судьбы
        north_node_lon = special_points['TrueNorthNode']['longitude']
        fate_cross_points = self.special_points_service.calculate_fate_cross(north_node_lon)

        # Формируем данные для Креста Судьбы
        fate_cross_data = {
            'axis': 'LunarNodes',
            'points': []
        }

        for point_name, lon in fate_cross_points.items():
            fate_cross_data['points'].append({
                'name': point_name,
                'longitude': lon,
                'sign': get_zodiac_sign(lon),
                'degree_in_sign': get_degree_in_sign(lon),
                'house': self.swisseph_engine.get_planet_house(lon, houses),
            })

        configurations['FateCross'] = fate_cross_data

        return configurations

    def _enrich_planets_basic(
        self,
        planets: list,
        houses: list,
        angles: dict = None,
        special_points: dict = None
    ) -> list:
        """
        Базовое обогащение планет (без БД и аспектов).
        Используется при расчёте без сохранения в БД.
        """
        # Добавляем dignity, element, mode
        for planet in planets:
            sign = planet['sign']
            planet_name = planet['name']

            # Element и Mode
            planet['element'] = PlanetCharacteristicsService.get_sign_element(sign)
            planet['mode'] = PlanetCharacteristicsService.get_sign_mode(sign)

            # Dignity
            planet['dignity'] = PlanetCharacteristicsService.get_dignity(planet_name, sign)

        # Уровни 1-6: Характеристики (без аспектов — шахта и гармония будут None)
        planets = PlanetCharacteristicsService.enrich_planets(
            planets, houses, aspects=[],
            angles=angles, special_points=special_points
        )
        return planets

    def _enrich_houses_basic(self, houses: list) -> list:
        """
        Базовое обогащение домов (без БД).
        Используется при расчёте без сохранения в БД.

        Добавляет:
        - house_group (angular/succedent/cadent)
        - ruler_planet (управитель дома по знаку на куспиде)
        - significator (естественный сигнификатор)
        - included_sign (включённый знак)
        - co_rulers (соуправители)
        """
        from app.services.dignity_service import DignityService

        # Создаём DignityService без БД-сессии (использует fallback данные)
        dignity_service = DignityService(db_session=None)

        for house in houses:
            house_number = house['number']
            sign_on_cusp = house['sign']

            # Определяем группу дома
            house['house_group'] = dignity_service.get_house_group(house_number)

            # Определяем управителя дома
            house['ruler_planet'] = dignity_service.get_house_ruler(sign_on_cusp)

        # Уровень 1: Сигнификаторы + included_sign
        houses = PlanetCharacteristicsService.enrich_houses(houses)

        # Определяем соуправителей (после enrich_houses, т.к. нужен included_sign)
        for house in houses:
            sign_on_cusp = house['sign']
            included_sign = house.get('included_sign')
            house['co_rulers'] = dignity_service.get_house_co_rulers(
                sign_on_cusp, included_sign
            )

        return houses

    def _enrich_planets_with_properties(
        self,
        planets: list,
        houses: list,
        aspects: list,
        db_session: Session,
        angles: dict = None,
        special_points: dict = None
    ) -> list:
        """
        Обогатить планеты свойствами знаков и достоинствами

        Добавляет к каждой планете:
        - element (стихия знака: Fire, Earth, Air, Water)
        - mode (крест знака: Cardinal, Fixed, Mutable)
        - dignity (достоинство планеты: domicile, exaltation, detriment, fall, neutral)
        - speed_percent (скорость в % от средней)
        - critical_degrees (критические градусы: jubilee, middle, anareta, royal, destructive)
        - sun_relation (казими/сожжение/в лучах)
        - in_intercepted_sign (планета во включённом знаке)
        - is_elevated (планета в элевации)
        - is_peregrine (шахта — без аспектов)
        - aspect_harmony (harmonic/tense/mixed)
        - karmic_minus_score, karmic_plus_score, karmic_score

        Args:
            planets: Список планет с базовыми данными
            houses: Список домов (для расчёта включённых знаков)
            aspects: Список аспектов (для шахты и гармонии)
            db_session: SQLAlchemy сессия
            angles: Углы карты (для кармического статуса)
            special_points: Специальные точки (для кармического статуса)

        Returns:
            Обогащённый список планет
        """
        dignity_service = DignityService(db_session)

        for planet in planets:
            sign = planet['sign']
            planet_name = planet['name']

            # Получаем свойства знака
            sign_props = dignity_service.get_sign_properties(sign)

            # Добавляем стихию и крест
            planet['element'] = sign_props.get('element', '')
            planet['mode'] = sign_props.get('mode', '')

            # Определяем достоинство
            planet['dignity'] = dignity_service.calculate_dignity(planet_name, sign)

        # Уровни 1-6: Характеристики планет
        planets = PlanetCharacteristicsService.enrich_planets(
            planets, houses, aspects,
            angles=angles, special_points=special_points
        )

        return planets

    def _enrich_houses_with_properties(
        self,
        houses: list,
        db_session: Session
    ) -> list:
        """
        Обогатить дома группами и управителями

        Добавляет к каждому дому:
        - house_group (группа дома: angular, succedent, cadent)
        - ruler_planet (управитель дома по знаку на куспиде)
        - co_rulers (соуправители по Астрокурсу)
        - significator (естественный сигнификатор: 1=Mars, 2=Venus...)

        Args:
            houses: Список домов с базовыми данными
            db_session: SQLAlchemy сессия

        Returns:
            Обогащённый список домов
        """
        dignity_service = DignityService(db_session)

        for house in houses:
            house_number = house['number']
            sign_on_cusp = house['sign']

            # Определяем группу дома
            house['house_group'] = dignity_service.get_house_group(house_number)

            # Определяем управителя дома
            house['ruler_planet'] = dignity_service.get_house_ruler(sign_on_cusp)

        # Уровень 1: Сигнификаторы домов + включённые знаки
        houses = PlanetCharacteristicsService.enrich_houses(houses)

        # Определяем соуправителей (после enrich_houses, т.к. нужен included_sign)
        for house in houses:
            sign_on_cusp = house['sign']
            included_sign = house.get('included_sign')
            house['co_rulers'] = dignity_service.get_house_co_rulers(
                sign_on_cusp, included_sign
            )

        return houses

    def _enrich_house_planet_relations(
        self,
        planets: list,
        houses: list
    ) -> tuple:
        """
        Обогатить связи между домами и планетами.

        Добавляет:
        - planets: ruled_houses (какими домами управляет планета)
        - houses: ruler_in_house (в каком доме находится управитель)
        - houses: planets_in_house (какие планеты в доме)

        Args:
            planets: Список планет с данными
            houses: Список домов с данными (должен содержать ruler_planet)

        Returns:
            Tuple (planets, houses) с добавленными полями
        """
        # Создаём индекс: планета -> номер дома где находится
        # Поле может называться 'house' (при расчёте) или 'house_number' (из БД)
        planet_to_house = {}
        for planet in planets:
            planet_name = planet.get('name')
            house_num = planet.get('house') or planet.get('house_number')
            if planet_name and house_num:
                planet_to_house[planet_name] = house_num

        # Создаём индекс: планета -> список домов которыми управляет
        planet_ruled_houses = {}
        for house in houses:
            ruler = house.get('ruler_planet')
            house_num = house.get('number')
            if ruler and house_num:
                if ruler not in planet_ruled_houses:
                    planet_ruled_houses[ruler] = []
                planet_ruled_houses[ruler].append(house_num)

        # 1. Заполняем ruled_houses для планет
        for planet in planets:
            planet_name = planet.get('name')
            planet['ruled_houses'] = planet_ruled_houses.get(planet_name, [])

        # 2. Заполняем ruler_in_house и planets_in_house для домов
        for house in houses:
            house_num = house.get('number')
            ruler = house.get('ruler_planet')

            # В каком доме находится управитель
            house['ruler_in_house'] = planet_to_house.get(ruler) if ruler else None

            # Какие планеты в этом доме
            planets_in = [
                p.get('name') for p in planets
                if (p.get('house') or p.get('house_number')) == house_num
            ]
            house['planets_in_house'] = planets_in

        return planets, houses

    def _update_planet_aspect_characteristics(
        self,
        user_id: UUID,
        db_session: Session
    ) -> None:
        """
        Обновить характеристики планет, зависящие от аспектов.

        Вызывается после расчёта аспектов для добавления:
        - is_peregrine (шахта)
        - aspect_harmony (harmonic/tense/mixed)

        Args:
            user_id: ID пользователя
            db_session: SQLAlchemy сессия
        """
        from app.database.models import NatalPlanet, NatalAspect

        # Получаем все аспекты пользователя
        aspects = db_session.query(NatalAspect).filter(
            NatalAspect.user_id == user_id
        ).all()

        aspects_list = [
            {'planet_1': a.planet_1, 'planet_2': a.planet_2, 'aspect_type': a.aspect_type, 'orb': float(a.orb)}
            for a in aspects
        ]

        # Обогащаем аспекты (партильность)
        aspects_list = PlanetCharacteristicsService.enrich_aspects(aspects_list)

        # Обновляем is_partile в БД
        for aspect_db, aspect_data in zip(aspects, aspects_list):
            aspect_db.is_partile = aspect_data.get('is_partile', False)

        # Получаем все планеты пользователя
        planets = db_session.query(NatalPlanet).filter(
            NatalPlanet.user_id == user_id
        ).all()

        planets_list = [{'name': p.planet} for p in planets]

        # Находим планеты в шахте
        peregrine_planets = PlanetCharacteristicsService.find_peregrine_planets(planets_list, aspects_list)

        # Обновляем характеристики каждой планеты
        for planet in planets:
            planet.is_peregrine = planet.planet in peregrine_planets
            planet.aspect_harmony = PlanetCharacteristicsService.calculate_aspect_harmony(
                planet.planet, aspects_list
            )

        db_session.flush()

    def _format_degree(self, degree: float) -> str:
        """
        Форматировать градус в формат градусы°минуты'секунды"

        Args:
            degree: Градус в десятичном формате

        Returns:
            Строка вида "25°48'04""
        """
        return format_degree_minutes_seconds(degree)

    def _save_to_database(
        self,
        db_session: Session,
        birth_date: date,
        birth_time: time_type,
        timezone: str,
        birth_place: str,
        lat: float,
        lon: float,
        julian_day: float,
        planets: list,
        houses: list,
        angles: Dict,
        special_points: Dict,
        configurations: Dict,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        astrologer_id: Optional[UUID] = None,
    ) -> UUID:
        """
        Сохранить натальную карту в базу данных

        Args:
            db_session: SQLAlchemy сессия
            birth_date: Дата рождения
            birth_time: Время рождения
            timezone: Временная зона
            birth_place: Место рождения
            lat: Широта
            lon: Долгота
            julian_day: Юлианский день
            planets: Данные планет
            houses: Данные домов
            angles: Данные углов
            special_points: Данные специальных точек
            configurations: Данные конфигураций
            first_name: Имя пользователя
            last_name: Фамилия пользователя

        Returns:
            UUID: ID созданного пользователя
        """
        user_repo = UserRepository(db_session)
        user = user_repo.create_user(
            astrologer_id=astrologer_id,
            birth_date=birth_date,
            birth_time=birth_time,
            timezone=timezone,
            birth_place=birth_place,
            lat=lat,
            lon=lon,
            julian_day=julian_day,
            first_name=first_name,
            last_name=last_name,
        )

        return self._persist_chart_for_user(
            db_session=db_session,
            user=user,
            planets=planets,
            houses=houses,
            angles=angles,
            special_points=special_points,
            configurations=configurations,
        )

    def update_existing_chart(
        self,
        user_id: UUID,
        db_session: Session,
        birth_date: date,
        birth_time: time_type,
        timezone: str,
        astrologer_id: UUID,
        place: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        house_system: str = 'P',
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
    ) -> Dict:
        """
        Обновить данные рождения существующего клиента и пересчитать карту для того же user_id.
        """
        user_repo = UserRepository(db_session)
        user = user_repo.get_user_by_id(user_id, astrologer_id=astrologer_id)
        if not user:
            raise ValueError("Пользователь не найден")

        lat, lon, place_name = self.geocoding_service.get_coordinates(
            place=place,
            latitude=latitude,
            longitude=longitude,
            db_session=db_session,
        )

        utc_dt, jd = self.time_service.process_birth_time(
            birth_date, birth_time, timezone
        )

        planets = self.swisseph_engine.calculate_planets(jd)
        houses, angles = self.swisseph_engine.calculate_houses(jd, lat, lon, house_system)

        for planet in planets:
            planet['house'] = self.swisseph_engine.get_planet_house(
                planet['longitude'], houses
            )

        special_points = self._calculate_special_points(jd, angles, planets, houses, lat, lon)
        configurations = self._calculate_configurations(special_points, houses)

        user.first_name = first_name
        user.last_name = last_name
        user.birth_date = birth_date
        user.birth_time = birth_time
        user.timezone = timezone
        user.birth_place = place_name or place or f"{lat}, {lon}"
        user.lat = lat
        user.lon = lon
        user.julian_day = jd
        db_session.flush()

        self._invalidate_dependent_chart_artifacts(user.user_id, db_session)
        self._persist_chart_for_user(
            db_session=db_session,
            user=user,
            planets=planets,
            houses=houses,
            angles=angles,
            special_points=special_points,
            configurations=configurations,
        )

        result = self.get_natal_chart_from_db(user.user_id, db_session)
        if result is None:
            result = {
                'user_id': str(user.user_id),
                'birth_data': {
                    'first_name': first_name,
                    'last_name': last_name,
                    'date': birth_date.isoformat(),
                    'time': birth_time.isoformat(),
                    'timezone': timezone,
                    'utc_time': utc_dt.isoformat(),
                    'julian_day': jd,
                    'latitude': lat,
                    'longitude': lon,
                    'place': place_name or place,
                },
                'planets': planets,
                'houses': houses,
                'angles': angles,
                'special_points': special_points,
                'configurations': configurations,
            }

        self._append_karmic_analysis(result)
        return result

    def _persist_chart_for_user(
        self,
        db_session: Session,
        user,
        planets: list,
        houses: list,
        angles: Dict,
        special_points: Dict,
        configurations: Dict,
    ) -> UUID:
        natal_repo = NatalChartRepository(db_session)

        houses = self._enrich_houses_with_properties(houses, db_session)
        planets = self._enrich_planets_with_properties(
            planets, houses, [], db_session,
            angles=angles, special_points=special_points
        )
        planets, houses = self._enrich_house_planet_relations(planets, houses)

        fate_cross = configurations.get('FateCross') if configurations else None

        natal_repo.save_full_natal_chart(
            user_id=user.user_id,
            planets=planets,
            houses=houses,
            angles=angles,
            special_points=special_points,
            fate_cross=fate_cross,
            configurations=[],
        )

        from app.services.aspect_service import AspectService
        from app.services.configuration_service import ConfigurationService
        from app.services.cosmogram_service import CosmogramService
        from app.services.planet_strength_service import PlanetStrengthService
        from app.services.special_roles_service import SpecialRolesService
        from app.services.balance_service import BalanceService
        from app.services.general_overview_service import GeneralOverviewService

        aspect_service = AspectService(db_session)
        aspect_service.calculate_aspects(user.user_id)
        self._update_planet_aspect_characteristics(user.user_id, db_session)

        config_service = ConfigurationService(db_session)
        config_service.detect_configurations(user.user_id)
        config_service.detect_stelliums(user.user_id)

        cosmogram_service = CosmogramService(db_session)
        cosmogram_service.analyze_distribution(user.user_id)
        cosmogram_service.determine_jones_pattern(user.user_id)

        strength_service = PlanetStrengthService(db_session)
        strength_service.calculate_all_strengths(user.user_id)

        roles_service = SpecialRolesService(db_session)
        roles_service.determine_all_roles(user.user_id)

        balance_service = BalanceService(db_session)
        balance_service.calculate_all_balances(user.user_id)

        overview_service = GeneralOverviewService(db_session)
        overview_service.build_general_overview(user.user_id)

        return user.user_id

    def _invalidate_dependent_chart_artifacts(self, user_id: UUID, db_session: Session) -> None:
        """
        Очистить прогнозные и AI-артефакты, которые становятся невалидны после смены birth-data.
        """
        from app.database.models import (
            Direction,
            ForecastRun,
            Progression,
            PrognosticInterpretation,
            SolarReturn,
            TransitEventsCache,
        )

        for model in (
            SolarReturn,
            Progression,
            Direction,
            TransitEventsCache,
            PrognosticInterpretation,
            ForecastRun,
        ):
            db_session.query(model).filter(model.user_id == user_id).delete(synchronize_session=False)

        db_session.flush()

    def get_natal_chart_from_db(self, user_id: UUID, db_session: Session) -> Optional[Dict]:
        """
        Получить натальную карту из БД

        Args:
            user_id: UUID пользователя
            db_session: SQLAlchemy сессия

        Returns:
            Optional[Dict]: Данные натальной карты или None
        """
        user_repo = UserRepository(db_session)
        user = user_repo.get_user_with_natal_chart(user_id)

        if not user:
            return None

        # Вычисляем UTC время
        from datetime import datetime
        import pytz

        local_tz = pytz.timezone(user.timezone)
        local_dt = local_tz.localize(datetime.combine(user.birth_date, user.birth_time))
        utc_dt = local_dt.astimezone(pytz.UTC)

        # Преобразуем ORM модели в словари
        result = {
            'user_id': str(user.user_id),
            'birth_data': {
                'first_name': user.first_name,
                'last_name': user.last_name,
                'date': user.birth_date.isoformat(),
                'time': user.birth_time.isoformat(),
                'timezone': user.timezone,
                'utc_time': utc_dt.strftime('%Y-%m-%d %H:%M:%S'),
                'julian_day': float(user.julian_day) if user.julian_day else None,
                'latitude': float(user.lat),
                'longitude': float(user.lon),
                'place': user.birth_place,
            },
            'planets': [
                {
                    'name': p.planet,
                    'longitude': float(p.degree),
                    'sign': p.sign,
                    'degree_in_sign': float(p.degree) % 30,  # Вычисляем градус в знаке
                    'degree_in_sign_formatted': self._format_degree(float(p.degree) % 30),
                    'house': p.house_number,
                    'retrograde': p.retrograde,
                    'speed': float(p.speed) if p.speed else None,
                    # Этап 3.2: Обогащение планет
                    'element': p.element,
                    'mode': p.mode,
                    'dignity': p.dignity,
                    # Этап 3.4: Сила и роли планет
                    'strength_score': float(p.strength_score) if p.strength_score else None,
                    'special_roles': p.special_roles or [],
                    # Миграция 005: расширенные характеристики
                    'speed_percent': float(p.speed_percent) if p.speed_percent else None,
                    'critical_degrees': p.critical_degrees or [],
                    'sun_relation': p.sun_relation,
                    'in_intercepted_sign': p.in_intercepted_sign or False,
                    'is_elevated': p.is_elevated or False,
                    'is_peregrine': p.is_peregrine or False,
                    'aspect_harmony': p.aspect_harmony,
                    'is_stationary': p.is_stationary or False,
                    'stationary_type': p.stationary_type,
                    'karmic_score': float(p.karmic_score) if p.karmic_score else None,
                    'karmic_minus_score': p.karmic_minus_score or 0,
                    'karmic_plus_score': p.karmic_plus_score or 0,
                    # Миграция 007: Связи планета-дом
                    'ruled_houses': p.ruled_houses or [],
                }
                for p in user.planets
            ],
            'houses': [
                {
                    'number': h.house_number,
                    'longitude': float(h.cusp_degree),
                    'sign': h.sign_on_cusp,
                    'degree_in_sign': float(h.cusp_degree) % 30,  # Вычисляем градус в знаке
                    'degree_in_sign_formatted': self._format_degree(float(h.cusp_degree) % 30),
                    # Этап 3.2: Обогащение домов
                    'ruler_planet': h.ruler_planet,
                    'house_group': h.house_group,
                    # Миграция 007: Связи дом-планета
                    'ruler_in_house': h.ruler_in_house,
                    'planets_in_house': h.planets_in_house or [],
                    'co_rulers': h.co_rulers or [],
                    'significator': h.significator,
                    'included_sign': h.included_sign,
                }
                for h in sorted(user.houses, key=lambda x: x.house_number)
            ],
            'angles': {},
            'special_points': {},
            'configurations': {},
            'aspects': None,
            'aspect_configurations': None,
            'stelliums': None,
            'planet_distribution': None,
            'cosmogram_pattern': None,
        }

        # Добавляем углы
        if user.angles:
            a = user.angles
            result['angles'] = {
                'ASC': {
                    'name': 'ASC',
                    'longitude': float(a.asc_degree),
                    'sign': a.asc_sign,
                    'degree_in_sign': float(a.asc_degree) % 30,
                    'degree_in_sign_formatted': self._format_degree(float(a.asc_degree) % 30)
                },
                'MC': {
                    'name': 'MC',
                    'longitude': float(a.mc_degree),
                    'sign': a.mc_sign,
                    'degree_in_sign': float(a.mc_degree) % 30,
                    'degree_in_sign_formatted': self._format_degree(float(a.mc_degree) % 30)
                },
                'IC': {
                    'name': 'IC',
                    'longitude': float(a.ic_degree),
                    'sign': a.ic_sign,
                    'degree_in_sign': float(a.ic_degree) % 30,
                    'degree_in_sign_formatted': self._format_degree(float(a.ic_degree) % 30)
                },
                'DSC': {
                    'name': 'DSC',
                    'longitude': float(a.dsc_degree),
                    'sign': a.dsc_sign,
                    'degree_in_sign': float(a.dsc_degree) % 30,
                    'degree_in_sign_formatted': self._format_degree(float(a.dsc_degree) % 30)
                },
            }
            if a.vertex_degree:
                result['angles']['Vertex'] = {
                    'name': 'Vertex',
                    'longitude': float(a.vertex_degree),
                    'sign': a.vertex_sign,
                    'degree_in_sign': float(a.vertex_degree) % 30,
                    'degree_in_sign_formatted': self._format_degree(float(a.vertex_degree) % 30)
                }

        # Добавляем специальные точки
        for sp in user.special_points:
            result['special_points'][sp.point] = {
                'name': sp.point,
                'longitude': float(sp.degree),
                'sign': sp.sign,
                'degree_in_sign': float(sp.degree) % 30,  # Вычисляем градус в знаке
                'degree_in_sign_formatted': self._format_degree(float(sp.degree) % 30),
                'house': sp.house_number,
            }

        # Добавляем Крест Судьбы (если есть)
        if user.fate_cross:
            fc = user.fate_cross
            # Получаем узлы из special_points
            north_node = next((sp for sp in user.special_points if sp.point == 'TrueNorthNode'), None)
            south_node = next((sp for sp in user.special_points if sp.point == 'TrueSouthNode'), None)

            if north_node and south_node:
                result['configurations']['FateCross'] = {
                    'axis': 'LunarNodes',
                    'points': [
                        {
                            'name': 'Rahu',
                            'longitude': float(north_node.degree),
                            'sign': north_node.sign,
                            'house': north_node.house_number
                        },
                        {
                            'name': 'Ketu',
                            'longitude': float(south_node.degree),
                            'sign': south_node.sign,
                            'house': south_node.house_number
                        },
                        {
                            'name': 'FateCross1',
                            'longitude': float(fc.point_1_longitude),
                            'sign': fc.point_1_sign,
                            'house': fc.point_1_house
                        },
                        {
                            'name': 'FateCross2',
                            'longitude': float(fc.point_2_longitude),
                            'sign': fc.point_2_sign,
                            'house': fc.point_2_house
                        }
                    ]
                }

        # Добавляем другие конфигурации (пока пусто, будет заполнено на этапе 2)
        for config in user.configurations:
            result['configurations'][config.type] = {
                'planets_involved': config.planets_involved,
                'houses_involved': config.houses_involved,
                'element': config.element,
                'mode': config.mode,
                'strength_score': float(config.strength_score) if config.strength_score else None,
            }

        # ДОДАЄМО НОВІ ДАНІ (пункт 3.3 спецификації)
        # Все данные уже eager-loaded через get_user_with_natal_chart()

        # 1. Аспекти (eager-loaded через user.natal_aspects)
        result['aspects'] = [
            self._enrich_aspect_for_display({
                'planet_1': a.planet_1,
                'planet_2': a.planet_2,
                'aspect_type': a.aspect_type,
                'orb': float(a.orb),
                'is_major': a.is_major,
                'harmonic_type': a.harmonic_type
            })
            for a in user.natal_aspects
        ]

        # 2. Аспектні конфігурації з деталями аспектів
        # Один экземпляр scoring_service с кэшем орбисов (вместо N+1)
        from app.services.aspect_scoring_service import AspectScoringService
        scoring_service = AspectScoringService(db_session)

        # Построить индекс аспектов по aspect_id для быстрого поиска
        aspects_by_id = {a.aspect_id: a for a in user.natal_aspects}

        # Сортируем конфигурации (уже eager-loaded)
        sorted_configs = sorted(
            user.configurations,
            key=lambda c: (c.type, -(float(c.strength_score) if c.strength_score else 0))
        )

        result['aspect_configurations'] = []
        for c in sorted_configs:
            # aspect_links уже eager-loaded через selectinload
            aspects_details = []
            for link in (c.aspect_links or []):
                aspect = aspects_by_id.get(link.aspect_id) or link.aspect
                if aspect:
                    _, details = scoring_service.calculate_aspect_score(aspect)
                    aspects_details.append({
                        'planet_1': aspect.planet_1,
                        'planet_2': aspect.planet_2,
                        'aspect_type': aspect.aspect_type,
                        'orb': float(aspect.orb),
                        'orb_planet_1': details['orb_planet_1'],
                        'orb_planet_2': details['orb_planet_2'],
                        'min_orb': details['min_orb'],
                        'max_orb': details['max_orb'],
                        'score': link.aspect_score
                    })

            result['aspect_configurations'].append({
                'type': c.type,
                'planets_involved': c.planets_involved.get('planets', []) if isinstance(c.planets_involved, dict) else c.planets_involved,
                'apex_planet': c.planets_involved.get('apex_planet') if isinstance(c.planets_involved, dict) else None,
                'strength_score': float(c.strength_score) if c.strength_score else 0.0,
                'aspects': aspects_details
            })

        # 3. Стеллиуми (eager-loaded)
        result['stelliums'] = [
            {
                'type': s.type,
                'house_number': s.house_number,
                'sign': s.sign,
                'planets': s.planets,
                'count': s.count,
                'strength_score': float(s.strength_score) if s.strength_score else 0.0
            }
            for s in user.natal_stelliums
        ]

        # 4. Розподіл планет (eager-loaded)
        distribution = user.planet_distribution
        if distribution:
            result['planet_distribution'] = {
                'min_empty_arc': float(distribution.min_empty_arc) if distribution.min_empty_arc else 0.0,
                'max_empty_arc': float(distribution.max_empty_arc) if distribution.max_empty_arc else 0.0,
                'cluster_count': distribution.cluster_count,
                'spread_map': distribution.spread_map
            }

        # 5. Фігура Джонса (eager-loaded)
        pattern = user.cosmogram_pattern
        if pattern:
            pattern_data = {
                'pattern_type': pattern.pattern_type,
                'empty_arc_degree': float(pattern.empty_arc_degree) if pattern.empty_arc_degree else 0.0,
            }
            if pattern.special_roles and isinstance(pattern.special_roles, dict):
                pattern_data.update(pattern.special_roles)
            pattern_data['anchor_planet'] = pattern.anchor_planet
            pattern_data['special_roles'] = []
            result['cosmogram_pattern'] = pattern_data

        # 6. Інтегральні баланси (все eager-loaded через relationships)
        balances = {}

        eb = user.element_balance
        if eb:
            balances['element_balance'] = {
                'fire': float(eb.fire), 'earth': float(eb.earth),
                'air': float(eb.air), 'water': float(eb.water)
            }

        mb = user.mode_balance
        if mb:
            balances['mode_balance'] = {
                'cardinal': float(mb.cardinal), 'fixed': float(mb.fixed),
                'mutable': float(mb.mutable)
            }

        gb = user.gender_balance
        if gb:
            balances['gender_balance'] = {
                'masculine': float(gb.masculine), 'feminine': float(gb.feminine)
            }

        zb = user.zones_balance
        if zb:
            balances['zones_balance'] = {
                'brahma': float(zb.brahma), 'vishnu': float(zb.vishnu),
                'shiva': float(zb.shiva)
            }

        hb = user.hemisphere_balance
        if hb:
            balances['hemisphere_balance'] = {
                'northern': float(hb.northern), 'southern': float(hb.southern),
                'eastern': float(hb.eastern), 'western': float(hb.western)
            }

        qb = user.quadrant_balance
        if qb:
            balances['quadrant_balance'] = {
                'q1': float(qb.quadrant_1), 'q2': float(qb.quadrant_2),
                'q3': float(qb.quadrant_3), 'q4': float(qb.quadrant_4)
            }

        hgb = user.house_group_balance
        if hgb:
            balances['house_group_balance'] = {
                'angular': float(hgb.angular_count),
                'succedent': float(hgb.succedent_count),
                'cadent': float(hgb.cadent_count)
            }

        result['balances'] = balances if balances else None
        self._append_karmic_analysis(result)
        return result

    def get_natal_chart_for_interpretation(self, user_id: UUID, db_session: Session) -> Optional[Dict]:
        """
        Получить минимальные данные натальной карты для интерпретации.
        Оптимизированный метод - загружает только планеты и аспекты.

        Args:
            user_id: UUID пользователя
            db_session: SQLAlchemy сессия

        Returns:
            Optional[Dict]: Минимальные данные для интерпретации или None
        """
        from sqlalchemy.orm import joinedload
        from app.database.models import User, NatalPlanet, NatalAspect

        # Загружаем только пользователя и планеты
        user = (
            db_session.query(User)
            .filter(User.user_id == user_id)
            .options(joinedload(User.planets))
            .first()
        )

        if not user:
            return None

        # Загружаем аспекты отдельным запросом
        aspects = db_session.query(NatalAspect).filter(
            NatalAspect.user_id == user_id
        ).all()

        return {
            'user_id': str(user.user_id),
            'planets': [
                {
                    'name': p.planet,
                    'sign': p.sign,
                    'degree_in_sign': float(p.degree) % 30,
                    'house': p.house_number,
                    'retrograde': p.retrograde,
                    'dignity': p.dignity,
                    'special_roles': p.special_roles or [],
                    'critical_degrees': p.critical_degrees or [],
                    'sun_relation': p.sun_relation,
                    'aspect_harmony': p.aspect_harmony,
                    'is_peregrine': p.is_peregrine or False,
                    'is_stationary': p.is_stationary or False,
                }
                for p in user.planets
            ],
            'aspects': [
                self._enrich_aspect_for_display({
                    'planet_1': a.planet_1,
                    'planet_2': a.planet_2,
                    'aspect_type': a.aspect_type,
                    'orb': float(a.orb),
                    'is_partile': a.is_partile or False,
                })
                for a in aspects
            ]
        }

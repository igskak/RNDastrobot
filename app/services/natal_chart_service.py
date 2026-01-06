"""
Главный сервис для расчёта натальной карты
"""
from datetime import date, time as time_type
from typing import Dict, Optional
from uuid import UUID
from sqlalchemy.orm import Session

from app.services.time_service import TimeService
from app.services.geocoding_service import GeocodingService
from app.services.swisseph_engine import SwissEphemerisEngine
from app.services.special_points_service import SpecialPointsService
from app.services.dignity_service import DignityService
from app.services.planet_characteristics_service import PlanetCharacteristicsService
from app.utils.constants import get_zodiac_sign, get_degree_in_sign, format_degree_minutes_seconds
from app.database.repositories import UserRepository, NatalChartRepository
from app.database.models import NatalAspect, NatalConfigurationAspect


class NatalChartService:
    """Главный сервис для расчёта натальной карты (оркестратор)"""
    
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
    
    def calculate_natal_chart(
        self,
        birth_date: date,
        birth_time: time_type,
        timezone: str,
        place: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        house_system: str = 'P',
        save_to_db: bool = False,
        db_session: Optional[Session] = None
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
            longitude=longitude
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
        planets = self._enrich_planets_basic(planets, houses)
        houses = self._enrich_houses_basic(houses)

        # 8.1. Добавляем связи дом-планета
        planets, houses = self._enrich_house_planet_relations(planets, houses)

        # 9. Формируем результат
        result = {
            'user_id': None,  # Будет заполнено если save_to_db=True
            'birth_data': {
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
            )

            # Читаємо повні дані з БД (включаючи похідні: аспекти, конфігурації, тощо)
            db_result = self.get_natal_chart_from_db(user_id, db_session)
            if db_result is not None:
                # Якщо вдалося прочитати з БД, використовуємо ці дані
                result = db_result
            else:
                # Якщо не вдалося прочитати, додаємо user_id до базового результату
                result['user_id'] = str(user_id)

        return result
    
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

    def _enrich_planets_basic(self, planets: list, houses: list) -> list:
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

        # Уровни 1-5: Характеристики (без аспектов — шахта и гармония будут None)
        planets = PlanetCharacteristicsService.enrich_planets(planets, houses, aspects=[])
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
        db_session: Session
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

        Args:
            planets: Список планет с базовыми данными
            houses: Список домов (для расчёта включённых знаков)
            aspects: Список аспектов (для шахты и гармонии)
            db_session: SQLAlchemy сессия

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

        # Уровни 1-4: Характеристики планет
        planets = PlanetCharacteristicsService.enrich_planets(planets, houses, aspects)

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

        Returns:
            UUID: ID созданного пользователя
        """
        # Создаём repositories
        user_repo = UserRepository(db_session)
        natal_repo = NatalChartRepository(db_session)

        # Создаём пользователя
        user = user_repo.create_user(
            birth_date=birth_date,
            birth_time=birth_time,
            timezone=timezone,
            birth_place=birth_place,
            lat=lat,
            lon=lon,
            julian_day=julian_day
        )

        # ОБОГАЩАЕМ ДАННЫЕ перед сохранением (пункт 3.2 спецификации)
        # ВАЖНО: сначала дома, потом планеты (планетам нужны дома для включённых знаков)
        # Примечание: характеристики шахты и гармонии будут добавлены после расчёта аспектов

        # Добавляем house_group, ruler_planet, significator, included_sign для домов
        houses = self._enrich_houses_with_properties(houses, db_session)

        # Добавляем element, mode, dignity, speed_percent, critical_degrees,
        # sun_relation, in_intercepted_sign, is_elevated для планет
        # (аспекты ещё не вычислены, поэтому передаём пустой список)
        planets = self._enrich_planets_with_properties(planets, houses, [], db_session)

        # Добавляем связи дом-планета:
        # - ruled_houses для планет (какими домами управляет)
        # - ruler_in_house для домов (где находится управитель)
        # - planets_in_house для домов (какие планеты в доме)
        planets, houses = self._enrich_house_planet_relations(planets, houses)

        # Разделяем Крест Судьбы и другие конфигурации
        fate_cross = configurations.get('FateCross') if configurations else None
        # Пока других конфигураций нет, передаём пустой список
        other_configs = []

        # Сохраняем натальную карту
        natal_repo.save_full_natal_chart(
            user_id=user.user_id,
            planets=planets,
            houses=houses,
            angles=angles,
            special_points=special_points,
            fate_cross=fate_cross,
            configurations=other_configs,
        )

        # ЭТАП 2: Обчислення похідних (пункт 3.3 спецификації)
        # Імпортуємо нові сервіси
        from app.services.aspect_service import AspectService
        from app.services.configuration_service import ConfigurationService
        from app.services.cosmogram_service import CosmogramService

        # 1. Розрахунок аспектів
        aspect_service = AspectService(db_session)
        aspect_service.calculate_aspects(user.user_id)

        # 1.1 Обновляем характеристики планет зависящие от аспектов (шахта, гармония)
        self._update_planet_aspect_characteristics(user.user_id, db_session)

        # 2. Виявлення конфігурацій та стеллиумів
        config_service = ConfigurationService(db_session)
        config_service.detect_configurations(user.user_id)
        config_service.detect_stelliums(user.user_id)

        # 3. Аналіз космограми
        cosmogram_service = CosmogramService(db_session)
        cosmogram_service.analyze_distribution(user.user_id)
        cosmogram_service.determine_jones_pattern(user.user_id)

        # ЭТАП 3: Сила и статус планет (пункт 3.4 спецификації)
        from app.services.planet_strength_service import PlanetStrengthService
        from app.services.special_roles_service import SpecialRolesService

        # 1. Розрахунок сили планет
        strength_service = PlanetStrengthService(db_session)
        strength_service.calculate_all_strengths(user.user_id)

        # 2. Визначення спеціальних ролей
        roles_service = SpecialRolesService(db_session)
        roles_service.determine_all_roles(user.user_id)

        # ЭТАП 4: Интегральные балансы (пункт 3.5 спецификації)
        from app.services.balance_service import BalanceService

        balance_service = BalanceService(db_session)
        balance_service.calculate_all_balances(user.user_id)

        # ЭТАП 5: Общий срез (пункт 3.6 спецификації)
        from app.services.general_overview_service import GeneralOverviewService

        overview_service = GeneralOverviewService(db_session)
        overview_service.build_general_overview(user.user_id)

        return user.user_id

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
        from app.database.models import (
            NatalAspect, NatalConfiguration, NatalStellium,
            NatalPlanetDistribution, CosmogramPattern
        )

        # 1. Аспекти
        aspects = db_session.query(NatalAspect).filter(
            NatalAspect.user_id == user_id
        ).all()
        result['aspects'] = [
            {
                'planet_1': a.planet_1,
                'planet_2': a.planet_2,
                'aspect_type': a.aspect_type,
                'orb': float(a.orb),
                'is_major': a.is_major,
                'harmonic_type': a.harmonic_type
            }
            for a in aspects
        ]

        # 2. Аспектні конфігурації з деталями аспектів
        configurations = db_session.query(NatalConfiguration).filter(
            NatalConfiguration.user_id == user_id
        ).order_by(NatalConfiguration.type, NatalConfiguration.strength_score.desc()).all()

        result['aspect_configurations'] = []
        for c in configurations:
            # Получить аспекты конфигурации с баллами
            config_aspects = db_session.query(
                NatalAspect,
                NatalConfigurationAspect.aspect_score
            ).join(
                NatalConfigurationAspect,
                NatalConfigurationAspect.aspect_id == NatalAspect.aspect_id
            ).filter(
                NatalConfigurationAspect.config_id == c.config_id
            ).all()

            # Формировать детали аспектов
            aspects_details = []
            for aspect, score in config_aspects:
                # Получить орбисы планет из aspect_scoring_service
                from app.services.aspect_scoring_service import AspectScoringService
                scoring_service = AspectScoringService(db_session)
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
                    'score': score
                })

            result['aspect_configurations'].append({
                'type': c.type,
                'planets_involved': c.planets_involved.get('planets', []) if isinstance(c.planets_involved, dict) else c.planets_involved,
                'apex_planet': c.planets_involved.get('apex_planet') if isinstance(c.planets_involved, dict) else None,
                'strength_score': float(c.strength_score) if c.strength_score else 0.0,
                'aspects': aspects_details
            })

        # 3. Стеллиуми
        stelliums = db_session.query(NatalStellium).filter(
            NatalStellium.user_id == user_id
        ).all()
        result['stelliums'] = [
            {
                'type': s.type,
                'house_number': s.house_number,
                'sign': s.sign,
                'planets': s.planets,
                'count': s.count,
                'strength_score': float(s.strength_score) if s.strength_score else 0.0
            }
            for s in stelliums
        ]

        # 4. Розподіл планет
        distribution = db_session.query(NatalPlanetDistribution).filter(
            NatalPlanetDistribution.user_id == user_id
        ).first()
        if distribution:
            result['planet_distribution'] = {
                'min_empty_arc': float(distribution.min_empty_arc) if distribution.min_empty_arc else 0.0,
                'max_empty_arc': float(distribution.max_empty_arc) if distribution.max_empty_arc else 0.0,
                'cluster_count': distribution.cluster_count,
                'spread_map': distribution.spread_map
            }

        # 5. Фігура Джонса
        pattern = db_session.query(CosmogramPattern).filter(
            CosmogramPattern.user_id == user_id
        ).first()
        if pattern:
            # Розпаковуємо ключові планети з special_roles (JSONB)
            pattern_data = {
                'pattern_type': pattern.pattern_type,
                'empty_arc_degree': float(pattern.empty_arc_degree) if pattern.empty_arc_degree else 0.0,
            }

            # Додаємо ключові планети з special_roles
            if pattern.special_roles and isinstance(pattern.special_roles, dict):
                pattern_data.update(pattern.special_roles)

            # Для зворотної сумісності
            pattern_data['anchor_planet'] = pattern.anchor_planet
            pattern_data['special_roles'] = []

            result['cosmogram_pattern'] = pattern_data

        # 6. Інтегральні баланси (пункт 3.5 спецификації)
        from app.database.models import (
            UserElementBalance, UserModeBalance, UserGenderBalance,
            UserZonesBalance, UserHemisphereBalance, UserQuadrantBalance,
            UserHouseGroupBalance
        )

        balances = {}

        # Баланс стихій
        element_balance = db_session.query(UserElementBalance).filter(
            UserElementBalance.user_id == user_id
        ).first()
        if element_balance:
            balances['element_balance'] = {
                'fire': float(element_balance.fire),
                'earth': float(element_balance.earth),
                'air': float(element_balance.air),
                'water': float(element_balance.water)
            }

        # Баланс крестів
        mode_balance = db_session.query(UserModeBalance).filter(
            UserModeBalance.user_id == user_id
        ).first()
        if mode_balance:
            balances['mode_balance'] = {
                'cardinal': float(mode_balance.cardinal),
                'fixed': float(mode_balance.fixed),
                'mutable': float(mode_balance.mutable)
            }

        # Баланс полів
        gender_balance = db_session.query(UserGenderBalance).filter(
            UserGenderBalance.user_id == user_id
        ).first()
        if gender_balance:
            balances['gender_balance'] = {
                'masculine': float(gender_balance.masculine),
                'feminine': float(gender_balance.feminine)
            }

        # Баланс зон
        zones_balance = db_session.query(UserZonesBalance).filter(
            UserZonesBalance.user_id == user_id
        ).first()
        if zones_balance:
            balances['zones_balance'] = {
                'brahma': float(zones_balance.brahma),
                'vishnu': float(zones_balance.vishnu),
                'shiva': float(zones_balance.shiva)
            }

        # Баланс півсфер
        hemisphere_balance = db_session.query(UserHemisphereBalance).filter(
            UserHemisphereBalance.user_id == user_id
        ).first()
        if hemisphere_balance:
            balances['hemisphere_balance'] = {
                'northern': float(hemisphere_balance.northern),
                'southern': float(hemisphere_balance.southern),
                'eastern': float(hemisphere_balance.eastern),
                'western': float(hemisphere_balance.western)
            }

        # Баланс квадрантів
        quadrant_balance = db_session.query(UserQuadrantBalance).filter(
            UserQuadrantBalance.user_id == user_id
        ).first()
        if quadrant_balance:
            balances['quadrant_balance'] = {
                'q1': float(quadrant_balance.quadrant_1),
                'q2': float(quadrant_balance.quadrant_2),
                'q3': float(quadrant_balance.quadrant_3),
                'q4': float(quadrant_balance.quadrant_4)
            }

        # Баланс груп домів
        house_group_balance = db_session.query(UserHouseGroupBalance).filter(
            UserHouseGroupBalance.user_id == user_id
        ).first()
        if house_group_balance:
            balances['house_group_balance'] = {
                'angular': float(house_group_balance.angular_count),
                'succedent': float(house_group_balance.succedent_count),
                'cadent': float(house_group_balance.cadent_count)
            }

        # Додаємо баланси до результату
        result['balances'] = balances if balances else None

        return result


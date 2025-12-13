"""
Сервис для формирования общего среза натальной карты (Этап 5 спецификации)

Этот сервис агрегирует данные из различных источников и формирует
единую запись в таблице general_overview_summary.
"""
from typing import Dict, List, Optional, Any
from uuid import UUID
from decimal import Decimal
from sqlalchemy.orm import Session

from app.database.models import (
    User, Angle, NatalPlanet, NatalAspect, NatalConfiguration, NatalStellium,
    CosmogramPattern, RefSignProperties, GeneralOverviewSummary,
    UserElementBalance, UserModeBalance, UserZonesBalance,
    UserHemisphereBalance, UserHouseGroupBalance, UserGenderBalance
)
from app.services.dignity_service import DignityService


class GeneralOverviewService:
    """
    Сервис для формирования общего среза натальной карты
    
    Собирает и агрегирует:
    - ASC-блок (знак, стихия, модальность, зона, соединения, управитель)
    - Светила (Солнце, Луна: знак, дом, аспекты)
    - Космограмма (тип, якорная планета)
    - Конфигурации и стеллиумы
    - Доминанты (стихия, крест, зона, полусфера, angularity)
    """
    
    def __init__(self, db_session: Session):
        """
        Инициализация сервиса
        
        Args:
            db_session: SQLAlchemy сессия для работы с БД
        """
        self.db = db_session
        self.dignity_service = DignityService(db_session)
    
    def build_general_overview(self, user_id: UUID) -> GeneralOverviewSummary:
        """
        Сформировать общий срез для пользователя
        
        Args:
            user_id: ID пользователя
            
        Returns:
            GeneralOverviewSummary: Сформированный общий срез
        """
        # 1. ASC-блок
        asc_data = self._build_asc_block(user_id)
        
        # 2. Светила
        luminaries_data = self._build_luminaries_block(user_id)
        
        # 3. Космограмма
        cosmo_data = self._build_cosmogram_block(user_id)
        
        # 4. Конфигурации и стеллиумы
        configs_data = self._build_configurations_block(user_id)
        
        # 5. Доминанты
        dominants_data = self._build_dominants_block(user_id)
        
        # Удаляем старую запись если есть
        self.db.query(GeneralOverviewSummary).filter(
            GeneralOverviewSummary.user_id == user_id
        ).delete()
        
        # Создаём новую запись
        summary = GeneralOverviewSummary(
            user_id=user_id,
            # ASC блок
            asc_sign=asc_data.get('asc_sign'),
            asc_degree=asc_data.get('asc_degree'),
            asc_element=asc_data.get('asc_element'),
            asc_mode=asc_data.get('asc_mode'),
            asc_zone=asc_data.get('asc_zone'),
            asc_conjunctions=asc_data.get('asc_conjunctions'),
            asc_ruler=asc_data.get('asc_ruler'),
            # Светила
            sun_sign=luminaries_data.get('sun_sign'),
            sun_house=luminaries_data.get('sun_house'),
            sun_aspect_summary=luminaries_data.get('sun_aspects'),
            moon_sign=luminaries_data.get('moon_sign'),
            moon_house=luminaries_data.get('moon_house'),
            moon_aspect_summary=luminaries_data.get('moon_aspects'),
            # Космограмма
            cosmogram_pattern=cosmo_data.get('pattern_type'),
            cosmogram_anchor_planet=cosmo_data.get('anchor_planet'),
            cosmogram_empty_arc=cosmo_data.get('empty_arc'),
            # Конфигурации и стеллиумы
            main_configurations=configs_data.get('configurations'),
            main_stelliums=configs_data.get('stelliums'),
            # Доминанты
            dominant_element=dominants_data.get('dominant_element'),
            dominant_mode=dominants_data.get('dominant_mode'),
            dominant_zone=dominants_data.get('dominant_zone'),
            dominant_hemisphere=dominants_data.get('dominant_hemisphere'),
            dominant_gender=dominants_data.get('dominant_gender'),
            angularity_ratio=dominants_data.get('angularity_ratio'),
        )
        
        self.db.add(summary)
        self.db.commit()
        
        return summary
    
    def _build_asc_block(self, user_id: UUID) -> Dict[str, Any]:
        """Сформировать ASC-блок"""
        angles = self.db.query(Angle).filter(Angle.user_id == user_id).first()
        
        if not angles:
            return {}
        
        asc_sign = angles.asc_sign
        asc_degree = float(angles.asc_degree)
        
        # Получаем свойства знака ASC
        sign_props = self.dignity_service.get_sign_properties(asc_sign)
        
        # Находим планеты в соединении с ASC
        asc_conjunctions = self._find_asc_conjunctions(user_id, asc_degree)
        
        # Находим управителя ASC и его данные
        asc_ruler = self._build_asc_ruler_info(user_id, sign_props.get('ruler'))
        
        return {
            'asc_sign': asc_sign,
            'asc_degree': Decimal(str(asc_degree)),
            'asc_element': sign_props.get('element'),
            'asc_mode': sign_props.get('mode'),
            'asc_zone': sign_props.get('zone'),
            'asc_conjunctions': asc_conjunctions,
            'asc_ruler': asc_ruler,
        }

    def _find_asc_conjunctions(self, user_id: UUID, asc_degree: float) -> List[Dict]:
        """Найти планеты в соединении с ASC"""
        # Ищем аспекты где ASC участвует в соединении
        aspects = self.db.query(NatalAspect).filter(
            NatalAspect.user_id == user_id,
            NatalAspect.aspect_type == 'Conjunction'
        ).filter(
            (NatalAspect.planet_1 == 'ASC') | (NatalAspect.planet_2 == 'ASC')
        ).all()

        conjunctions = []
        for asp in aspects:
            planet = asp.planet_2 if asp.planet_1 == 'ASC' else asp.planet_1
            conjunctions.append({
                'planet': planet,
                'orb': float(asp.orb) if asp.orb else 0
            })

        return conjunctions if conjunctions else None

    def _build_asc_ruler_info(self, user_id: UUID, ruler_planet: str) -> Optional[Dict]:
        """Построить информацию об управителе ASC"""
        if not ruler_planet:
            return None

        # Находим позицию управителя
        ruler = self.db.query(NatalPlanet).filter(
            NatalPlanet.user_id == user_id,
            NatalPlanet.planet == ruler_planet
        ).first()

        if not ruler:
            return None

        # Находим аспекты управителя
        aspects = self.db.query(NatalAspect).filter(
            NatalAspect.user_id == user_id
        ).filter(
            (NatalAspect.planet_1 == ruler_planet) | (NatalAspect.planet_2 == ruler_planet)
        ).all()

        ruler_aspects = []
        for asp in aspects:
            other_planet = asp.planet_2 if asp.planet_1 == ruler_planet else asp.planet_1
            ruler_aspects.append({
                'planet': other_planet,
                'aspect': asp.aspect_type,
                'orb': float(asp.orb) if asp.orb else 0
            })

        return {
            'planet': ruler_planet,
            'sign': ruler.sign,
            'house': ruler.house_number,
            'aspects': ruler_aspects
        }

    def _build_luminaries_block(self, user_id: UUID) -> Dict[str, Any]:
        """Сформировать блок светил (Солнце и Луна)"""
        result = {}

        for luminary in ['Sun', 'Moon']:
            planet = self.db.query(NatalPlanet).filter(
                NatalPlanet.user_id == user_id,
                NatalPlanet.planet == luminary
            ).first()

            if planet:
                prefix = 'sun' if luminary == 'Sun' else 'moon'
                result[f'{prefix}_sign'] = planet.sign
                result[f'{prefix}_house'] = planet.house_number
                # Для общего среза — только мажорные аспекты
                result[f'{prefix}_aspects'] = self._get_planet_aspects(user_id, luminary, major_only=True)

        return result

    def _get_planet_aspects(self, user_id: UUID, planet_name: str, major_only: bool = False) -> List[Dict]:
        """Получить аспекты планеты

        Args:
            user_id: ID пользователя
            planet_name: Имя планеты
            major_only: Если True - только мажорные аспекты (Conjunction, Opposition, Trine, Square, Sextile)
        """
        MAJOR_ASPECTS = {'Conjunction', 'Opposition', 'Trine', 'Square', 'Sextile'}

        query = self.db.query(NatalAspect).filter(
            NatalAspect.user_id == user_id
        ).filter(
            (NatalAspect.planet_1 == planet_name) | (NatalAspect.planet_2 == planet_name)
        )

        if major_only:
            query = query.filter(NatalAspect.aspect_type.in_(MAJOR_ASPECTS))

        aspects = query.all()

        result = []
        for asp in aspects:
            other_planet = asp.planet_2 if asp.planet_1 == planet_name else asp.planet_1
            result.append({
                'planet': other_planet,
                'aspect': asp.aspect_type,
                'orb': float(asp.orb) if asp.orb else 0
            })

        return result if result else None

    def _build_cosmogram_block(self, user_id: UUID) -> Dict[str, Any]:
        """Сформировать блок космограммы"""
        pattern = self.db.query(CosmogramPattern).filter(
            CosmogramPattern.user_id == user_id
        ).first()

        if not pattern:
            return {}

        # Определяем якорную планету на основе типа паттерна
        anchor_planet = self._determine_anchor_planet(pattern)

        return {
            'pattern_type': pattern.pattern_type,
            'anchor_planet': anchor_planet,
            'empty_arc': float(pattern.empty_arc_degree) if pattern.empty_arc_degree else None
        }

    def _determine_anchor_planet(self, pattern: CosmogramPattern) -> Optional[str]:
        """
        Определить главную (якорную) планету для паттерна

        Логика выбора зависит от типа паттерна:
        - Bowl: leading_planet (ведущая)
        - Bucket: handle_planet (ручка)
        - Bundle: central_planet (центральная)
        - Locomotive: leading_planet (локомотив)
        - Seesaw: group1_leading (первая группа)
        - Splay/Splash: key_planet (ключевая)
        """
        roles = pattern.special_roles or {}
        pattern_type = pattern.pattern_type

        # Приоритеты выбора якорной планеты
        priority_map = {
            'Bowl': ['leading_planet', 'closing_planet'],
            'Bucket': ['handle_planet', 'handle_planets'],
            'Bundle': ['central_planet', 'leading_planet'],
            'Locomotive': ['leading_planet', 'closing_planet'],
            'Seesaw': ['group1_leading', 'group2_leading'],
            'Splay': ['key_planet', 'stellium_center_planet'],
            'Splash': ['key_planet'],
        }

        priorities = priority_map.get(pattern_type, [])

        for key in priorities:
            if key in roles and roles[key]:
                value = roles[key]
                # handle_planets может быть списком
                if isinstance(value, list):
                    return value[0] if value else None
                return value

        # Fallback на deprecated anchor_planet
        return pattern.anchor_planet

    def _build_configurations_block(self, user_id: UUID) -> Dict[str, Any]:
        """Сформировать блок конфигураций и стеллиумов"""
        # Получаем конфигурации
        configs = self.db.query(NatalConfiguration).filter(
            NatalConfiguration.user_id == user_id
        ).all()

        configurations = [
            {
                'type': c.type,
                'planets': c.planets_involved,
                'strength': float(c.strength_score) if c.strength_score else None
            }
            for c in configs
        ] if configs else None

        # Получаем стеллиумы
        stelliums_data = self.db.query(NatalStellium).filter(
            NatalStellium.user_id == user_id
        ).all()

        stelliums = [
            {
                'type': s.type,
                'location': s.sign if s.type == 'sign' else f"H{s.house_number}",
                'planets': s.planets,
                'strength': float(s.strength_score) if s.strength_score else None
            }
            for s in stelliums_data
        ] if stelliums_data else None

        return {
            'configurations': configurations,
            'stelliums': stelliums
        }

    def _build_dominants_block(self, user_id: UUID) -> Dict[str, Any]:
        """Сформировать блок доминант из балансов"""
        result = {}

        # Доминантная стихия
        element_balance = self.db.query(UserElementBalance).filter(
            UserElementBalance.user_id == user_id
        ).first()
        if element_balance:
            elements = {
                'Fire': float(element_balance.fire or 0),
                'Earth': float(element_balance.earth or 0),
                'Air': float(element_balance.air or 0),
                'Water': float(element_balance.water or 0)
            }
            result['dominant_element'] = max(elements, key=elements.get)

        # Доминантный крест
        mode_balance = self.db.query(UserModeBalance).filter(
            UserModeBalance.user_id == user_id
        ).first()
        if mode_balance:
            modes = {
                'Cardinal': float(mode_balance.cardinal or 0),
                'Fixed': float(mode_balance.fixed or 0),
                'Mutable': float(mode_balance.mutable or 0)
            }
            result['dominant_mode'] = max(modes, key=modes.get)

        # Доминантная зона
        zones_balance = self.db.query(UserZonesBalance).filter(
            UserZonesBalance.user_id == user_id
        ).first()
        if zones_balance:
            zones = {
                'Brahma': float(zones_balance.brahma or 0),
                'Vishnu': float(zones_balance.vishnu or 0),
                'Shiva': float(zones_balance.shiva or 0)
            }
            result['dominant_zone'] = max(zones, key=zones.get)

        # Доминантная полусфера
        hemisphere_balance = self.db.query(UserHemisphereBalance).filter(
            UserHemisphereBalance.user_id == user_id
        ).first()
        if hemisphere_balance:
            hemispheres = {
                'Northern': float(hemisphere_balance.northern or 0),
                'Southern': float(hemisphere_balance.southern or 0),
                'Eastern': float(hemisphere_balance.eastern or 0),
                'Western': float(hemisphere_balance.western or 0)
            }
            result['dominant_hemisphere'] = max(hemispheres, key=hemispheres.get)

        # Доминантный гендер (бинер: masculine/feminine)
        gender_balance = self.db.query(UserGenderBalance).filter(
            UserGenderBalance.user_id == user_id
        ).first()
        if gender_balance:
            genders = {
                'Masculine': float(gender_balance.masculine or 0),
                'Feminine': float(gender_balance.feminine or 0)
            }
            result['dominant_gender'] = max(genders, key=genders.get)

        # Angularity ratio (доля планет в угловых домах)
        house_group_balance = self.db.query(UserHouseGroupBalance).filter(
            UserHouseGroupBalance.user_id == user_id
        ).first()
        if house_group_balance:
            angular = float(house_group_balance.angular_count or 0)
            total = angular + float(house_group_balance.succedent_count or 0) + \
                    float(house_group_balance.cadent_count or 0)
            if total > 0:
                result['angularity_ratio'] = Decimal(str(round(angular / total * 100, 2)))

        return result

    def get_overview(self, user_id: UUID) -> Optional[GeneralOverviewSummary]:
        """Получить сохранённый общий срез"""
        return self.db.query(GeneralOverviewSummary).filter(
            GeneralOverviewSummary.user_id == user_id
        ).first()


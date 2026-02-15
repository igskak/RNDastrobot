"""
Сервис для расчета силы планет (strength_score)
"""
from typing import Dict, List
from uuid import UUID
from sqlalchemy.orm import Session
from app.database.models import (
    NatalPlanet, NatalHouse, NatalAspect, 
    NatalConfiguration, NatalStellium
)


class PlanetStrengthService:
    """
    Сервис для расчета силы планет в натальной карте
    
    Учитывает:
    - Достоинство в знаке (domicile, exaltation, detriment, fall)
    - Положение в доме (angular, succedent, cadent)
    - Аспекты (гармоничные/напряженные, соединения)
    - Участие в конфигурациях
    - Участие в стеллиумах
    - Ретроградность
    """
    
    # Веса для расчета силы
    DIGNITY_WEIGHTS = {
        'domicile': 5.0,
        'exaltation': 4.0,
        'neutral': 0.0,
        'detriment': -5.0,
        'fall': -4.0,
    }
    
    HOUSE_GROUP_WEIGHTS = {
        'angular': 4.0,
        'succedent': 2.0,
        'cadent': 0.0,
    }
    
    ASPECT_WEIGHTS = {
        'harmonious': 2.0,
        'tense': 3.0,
        'neutral': 0.0,
    }
    
    CONJUNCTION_WEIGHTS = {
        'Jupiter': 2.0,
        'Venus': 2.0,
        'Mars': -2.0,
        'Saturn': -2.0,
    }
    
    CONFIGURATION_WEIGHTS = {
        'Grand_Trine': 5.0,
        'T_Square': 4.0,
        'Grand_Cross': 6.0,
        'Yod': 3.0,
    }
    
    STELLIUM_WEIGHT = 2.0
    RETROGRADE_PENALTY = -1.0
    
    def __init__(self, db_session: Session):
        """
        Инициализация сервиса
        
        Args:
            db_session: SQLAlchemy сессия для работы с БД
        """
        self.db = db_session
    
    def calculate_all_strengths(self, user_id: UUID) -> None:
        """
        Рассчитать силу всех планет пользователя и обновить natal_planets
        
        Args:
            user_id: ID пользователя
        """
        planets = self.db.query(NatalPlanet).filter(
            NatalPlanet.user_id == user_id
        ).all()
        if not planets:
            self.db.commit()
            return

        # Загружаем связанные данные один раз, чтобы избежать N+1 запросов.
        houses = self.db.query(NatalHouse).filter(
            NatalHouse.user_id == user_id
        ).all()
        aspects = self.db.query(NatalAspect).filter(
            NatalAspect.user_id == user_id
        ).all()
        configurations = self.db.query(NatalConfiguration).filter(
            NatalConfiguration.user_id == user_id
        ).all()
        stelliums = self.db.query(NatalStellium).filter(
            NatalStellium.user_id == user_id
        ).all()

        house_group_by_number = {
            house.house_number: house.house_group
            for house in houses
        }

        aspects_by_planet: Dict[str, List[NatalAspect]] = {}
        for aspect in aspects:
            aspects_by_planet.setdefault(aspect.planet_1, []).append(aspect)
            aspects_by_planet.setdefault(aspect.planet_2, []).append(aspect)

        configuration_score_by_planet: Dict[str, float] = {}
        for config in configurations:
            config_score = self.CONFIGURATION_WEIGHTS.get(config.type, 0.0)
            if config_score <= 0.0 or not config.planets_involved:
                continue
            for planet_name in config.planets_involved:
                configuration_score_by_planet[planet_name] = (
                    configuration_score_by_planet.get(planet_name, 0.0) + config_score
                )

        stellium_planets = set()
        for stellium in stelliums:
            if stellium.planets:
                stellium_planets.update(stellium.planets)

        for planet in planets:
            strength = self._calculate_planet_strength_prefetched(
                planet=planet,
                house_group=house_group_by_number.get(planet.house_number),
                aspects=aspects_by_planet.get(planet.planet, []),
                configuration_score=configuration_score_by_planet.get(planet.planet, 0.0),
                in_stellium=planet.planet in stellium_planets,
            )
            planet.strength_score = round(strength, 2)
        
        self.db.commit()

    def _calculate_planet_strength_prefetched(
        self,
        planet: NatalPlanet,
        house_group: str,
        aspects: List[NatalAspect],
        configuration_score: float,
        in_stellium: bool,
    ) -> float:
        """Расчёт силы планеты на предзагруженных данных (без дополнительных SQL)."""
        strength = 0.0
        strength += self._get_dignity_score(planet.dignity)
        strength += self.HOUSE_GROUP_WEIGHTS.get(house_group, 0.0)
        strength += self._calculate_aspect_score_prefetched(planet.planet, aspects)
        strength += configuration_score
        if in_stellium:
            strength += self.STELLIUM_WEIGHT
        if planet.retrograde:
            strength += self.RETROGRADE_PENALTY
        return strength

    def _calculate_aspect_score_prefetched(self, planet_name: str, aspects: List[NatalAspect]) -> float:
        """Баллы за аспекты на предзагруженных данных."""
        score = 0.0
        for aspect in aspects:
            if aspect.harmonic_type:
                score += self.ASPECT_WEIGHTS.get(aspect.harmonic_type, 0.0)

            if aspect.aspect_type == 'conjunction':
                other_planet = aspect.planet_2 if aspect.planet_1 == planet_name else aspect.planet_1
                score += self.CONJUNCTION_WEIGHTS.get(other_planet, 0.0)

        return score
    
    def _calculate_planet_strength(self, user_id: UUID, planet: NatalPlanet) -> float:
        """
        Рассчитать силу одной планеты
        
        Args:
            user_id: ID пользователя
            planet: Объект планеты
            
        Returns:
            Итоговый балл силы
        """
        strength = 0.0
        
        # 1. Достоинство в знаке
        strength += self._get_dignity_score(planet.dignity)
        
        # 2. Положение в доме (угловость)
        strength += self._get_house_score(user_id, planet.house_number)
        
        # 3. Аспекты
        strength += self._get_aspect_score(user_id, planet.planet)
        
        # 4. Участие в конфигурациях
        strength += self._get_configuration_score(user_id, planet.planet)
        
        # 5. Участие в стеллиумах
        strength += self._get_stellium_score(user_id, planet.planet)
        
        # 6. Ретроградность
        if planet.retrograde:
            strength += self.RETROGRADE_PENALTY
        
        return strength
    
    def _get_dignity_score(self, dignity: str) -> float:
        """Баллы за достоинство в знаке"""
        return self.DIGNITY_WEIGHTS.get(dignity, 0.0)
    
    def _get_house_score(self, user_id: UUID, house_number: int) -> float:
        """Баллы за положение в доме (угловость)"""
        if not house_number:
            return 0.0

        house = self.db.query(NatalHouse).filter(
            NatalHouse.user_id == user_id,
            NatalHouse.house_number == house_number
        ).first()

        if not house or not house.house_group:
            return 0.0

        return self.HOUSE_GROUP_WEIGHTS.get(house.house_group, 0.0)

    def _get_aspect_score(self, user_id: UUID, planet_name: str) -> float:
        """
        Баллы за аспекты планеты

        Учитывает:
        - Гармоничные аспекты: +2
        - Напряженные аспекты: +3 (сила через напряжение)
        - Соединения с благодетелями/вредителями
        """
        score = 0.0

        # Получаем все аспекты планеты
        aspects = self.db.query(NatalAspect).filter(
            NatalAspect.user_id == user_id,
            ((NatalAspect.planet_1 == planet_name) | (NatalAspect.planet_2 == planet_name))
        ).all()

        for aspect in aspects:
            # Баллы за тип аспекта (гармоничный/напряженный)
            if aspect.harmonic_type:
                score += self.ASPECT_WEIGHTS.get(aspect.harmonic_type, 0.0)

            # Дополнительные баллы за соединения с благодетелями/вредителями
            if aspect.aspect_type == 'conjunction':
                other_planet = aspect.planet_2 if aspect.planet_1 == planet_name else aspect.planet_1
                score += self.CONJUNCTION_WEIGHTS.get(other_planet, 0.0)

        return score

    def _get_configuration_score(self, user_id: UUID, planet_name: str) -> float:
        """
        Баллы за участие в аспектных конфигурациях

        Grand Trine: +5
        T-Square: +4
        Grand Cross: +6
        Yod: +3
        """
        score = 0.0

        configurations = self.db.query(NatalConfiguration).filter(
            NatalConfiguration.user_id == user_id
        ).all()

        for config in configurations:
            # Проверяем, участвует ли планета в конфигурации
            if config.planets_involved and planet_name in config.planets_involved:
                score += self.CONFIGURATION_WEIGHTS.get(config.type, 0.0)

        return score

    def _get_stellium_score(self, user_id: UUID, planet_name: str) -> float:
        """
        Баллы за участие в стеллиумах

        Планета в стеллиуме: +2
        """
        stelliums = self.db.query(NatalStellium).filter(
            NatalStellium.user_id == user_id
        ).all()

        for stellium in stelliums:
            if stellium.planets and planet_name in stellium.planets:
                return self.STELLIUM_WEIGHT

        return 0.0

"""
Aspect Scoring Service - расчет баллов для аспектов и конфигураций
"""
from typing import List, Dict, Tuple, Optional
from decimal import Decimal
from sqlalchemy.orm import Session

from app.database.models import NatalAspect, RefPlanetOrb, RefAspectType


class AspectScoringService:
    """Сервис для расчета баллов аспектов на основе точности"""

    def __init__(self, db_session: Session):
        self.db = db_session
        self._planet_orbs_cache: Optional[Dict[Tuple[str, str], float]] = None

    def _get_planet_orbs(self) -> Dict[Tuple[str, str], float]:
        """
        Получить все орбисы планет с кэшированием

        Returns:
            Dict: Словарь {(planet, aspect_type): orb}
        """
        if self._planet_orbs_cache is None:
            orbs = self.db.query(RefPlanetOrb).all()
            self._planet_orbs_cache = {
                (orb.planet, orb.aspect_type): float(orb.orb)
                for orb in orbs
            }
        return self._planet_orbs_cache

    def _get_orb_for_body(self, body: str, aspect_type: str) -> float:
        """
        Получить орбис для конкретного тела и типа аспекта

        Args:
            body: Название тела (планета/точка)
            aspect_type: Тип аспекта

        Returns:
            float: Орбис для данного тела
        """
        planet_orbs = self._get_planet_orbs()
        orb = planet_orbs.get((body, aspect_type))

        # Если орбис не найден, использовать базовый из ref_aspect_types
        if orb is None:
            aspect = self.db.query(RefAspectType).filter(
                RefAspectType.aspect_type == aspect_type
            ).first()
            orb = float(aspect.base_orb) if aspect else 5.0

        return orb

    def calculate_aspect_score(self, aspect: NatalAspect) -> Tuple[int, Dict]:
        """
        Рассчитать балл для одного аспекта

        Правила:
        - 3 балла: орбис < 1° (партильный/точный аспект)
        - 2 балла: орбис <= минимального орбиса из двух планет
        - 1 балл: орбис <= максимального орбиса из двух планет

        Args:
            aspect: Объект аспекта

        Returns:
            Tuple[int, Dict]: (балл, детали расчета)
        """
        # Получить орбисы обеих планет
        orb_a = self._get_orb_for_body(aspect.planet_1, aspect.aspect_type)
        orb_b = self._get_orb_for_body(aspect.planet_2, aspect.aspect_type)

        min_orb = min(orb_a, orb_b)
        max_orb = max(orb_a, orb_b)

        actual_orb = float(aspect.orb)

        # Применить правила начисления баллов
        if actual_orb < 1.0:
            score = 3
        elif actual_orb <= min_orb:
            score = 2
        elif actual_orb <= max_orb:
            score = 1
        else:
            # Не должно происходить, так как аспект уже найден
            score = 0

        details = {
            'aspect_id': aspect.aspect_id,
            'planet_1': aspect.planet_1,
            'planet_2': aspect.planet_2,
            'aspect_type': aspect.aspect_type,
            'actual_orb': actual_orb,
            'orb_planet_1': orb_a,
            'orb_planet_2': orb_b,
            'min_orb': min_orb,
            'max_orb': max_orb,
            'score': score
        }

        return score, details

    def calculate_configuration_score(
        self,
        aspects_in_config: List[NatalAspect]
    ) -> Tuple[float, List[Dict]]:
        """
        Рассчитать общий балл конфигурации

        Args:
            aspects_in_config: Список аспектов в конфигурации

        Returns:
            Tuple[float, List[Dict]]:
                - общий балл конфигурации (сумма баллов всех аспектов)
                - список деталей по каждому аспекту
        """
        total_score = 0
        aspect_details = []

        for aspect in aspects_in_config:
            score, details = self.calculate_aspect_score(aspect)
            total_score += score
            aspect_details.append(details)

        return float(total_score), aspect_details


"""
Aspect Service - розрахунок аспектів між об'єктами натальної карти
"""
from typing import List, Dict, Optional, Tuple
from uuid import UUID
from decimal import Decimal
from sqlalchemy.orm import Session

from app.database.models import (
    NatalPlanet, NatalSpecialPoint, Angle, NatalAspect, RefAspectType, RefPlanetOrb
)


class AspectService:
    """Сервіс для розрахунку аспектів між планетами, спецточками та кутами"""
    
    def __init__(self, db_session: Session):
        self.db = db_session
        self._aspect_types_cache: Optional[List[RefAspectType]] = None
        self._planet_orbs_cache: Optional[Dict[Tuple[str, str], float]] = None
    
    def calculate_aspects(self, user_id: UUID) -> List[Dict]:
        """
        Розрахунок всіх аспектів для користувача
        
        Args:
            user_id: ID користувача
            
        Returns:
            List[Dict]: Список знайдених аспектів
        """
        # Отримати всі об'єкти для аспектування
        objects = self._get_all_objects(user_id)
        
        # Отримати типи аспектів
        aspect_types = self._get_aspect_types()
        
        # Розрахувати аспекти між усіма парами
        aspects = []
        for i, obj1 in enumerate(objects):
            for obj2 in objects[i+1:]:
                aspect = self._calculate_aspect_between(obj1, obj2, aspect_types)
                if aspect:
                    aspects.append(aspect)
        
        # Зберегти в БД
        self._save_aspects(user_id, aspects)
        
        return aspects
    
    def _get_all_objects(self, user_id: UUID) -> List[Dict]:
        """
        Отримати всі об'єкти для аспектування (планети, спецточки, кути)
        
        Returns:
            List[Dict]: Список об'єктів з назвою та довготою
        """
        objects = []
        
        # Планети
        planets = self.db.query(NatalPlanet).filter(
            NatalPlanet.user_id == user_id
        ).all()
        
        for planet in planets:
            objects.append({
                'name': planet.planet,
                'longitude': float(planet.degree),
                'type': 'planet'
            })
        
        # Спеціальні точки
        special_points = self.db.query(NatalSpecialPoint).filter(
            NatalSpecialPoint.user_id == user_id
        ).all()
        
        for point in special_points:
            objects.append({
                'name': point.point,
                'longitude': float(point.degree),
                'type': 'special_point'
            })
        
        # Кути (ASC, MC, IC, DSC)
        angles = self.db.query(Angle).filter(
            Angle.user_id == user_id
        ).first()
        
        if angles:
            objects.extend([
                {'name': 'ASC', 'longitude': float(angles.asc_degree), 'type': 'angle'},
                {'name': 'MC', 'longitude': float(angles.mc_degree), 'type': 'angle'},
                {'name': 'IC', 'longitude': float(angles.ic_degree), 'type': 'angle'},
                {'name': 'DSC', 'longitude': float(angles.dsc_degree), 'type': 'angle'},
            ])
        
        return objects
    
    def _get_aspect_types(self) -> List[RefAspectType]:
        """Отримати типи аспектів з кешуванням"""
        if self._aspect_types_cache is None:
            self._aspect_types_cache = self.db.query(RefAspectType).all()
        return self._aspect_types_cache

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

    def _calculate_allowed_orb(
        self,
        body_a: str,
        body_b: str,
        aspect_type: str
    ) -> float:
        """
        Расчет допустимого орбиса для пары тел согласно правилу:
        "если в аспекте участвуют планеты с разными орбисами - берем меньший"

        Args:
            body_a: Название первого тела (планета/точка)
            body_b: Название второго тела
            aspect_type: Тип аспекта (например, 'Conjunction')

        Returns:
            float: Минимальный орбис из двух тел
        """
        planet_orbs = self._get_planet_orbs()

        # Получить орбис для тела A
        orb_a = planet_orbs.get((body_a, aspect_type))

        # Получить орбис для тела B
        orb_b = planet_orbs.get((body_b, aspect_type))

        # Если орбис не найден, использовать базовый из ref_aspect_types
        if orb_a is None:
            aspect = self.db.query(RefAspectType).filter(
                RefAspectType.aspect_type == aspect_type
            ).first()
            orb_a = float(aspect.base_orb) if aspect else 5.0

        if orb_b is None:
            aspect = self.db.query(RefAspectType).filter(
                RefAspectType.aspect_type == aspect_type
            ).first()
            orb_b = float(aspect.base_orb) if aspect else 5.0

        # ГЛАВНОЕ ПРАВИЛО: берем меньший орбис
        return min(orb_a, orb_b)
    
    def _calculate_aspect_between(
        self,
        obj1: Dict,
        obj2: Dict,
        aspect_types: List[RefAspectType]
    ) -> Optional[Dict]:
        """
        Розрахунок аспекту між двома об'єктами з використанням індивідуальних орбісів

        Алгоритм:
        1. Рассчитать угловое расстояние между телами
        2. Для каждого типа аспекта:
           - Получить индивидуальный орбис для каждого тела
           - Применить правило: "берем меньший орбис"
           - Проверить, попадает ли отклонение в допустимый орбис

        Args:
            obj1: Перший об'єкт
            obj2: Другий об'єкт
            aspect_types: Список типів аспектів

        Returns:
            Optional[Dict]: Дані аспекту або None
        """
        # ИЗМЕНЕНО: Разрешаем аспекты между фиктивными точками для конфигураций
        # (например, BlackMoon - TrueNorthNode для Повозки)
        # Старое правило: if obj1['type'] == 'special_point' and obj2['type'] == 'special_point': return None

        # 1. Рассчитать угловое расстояние между телами
        diff = abs(obj1['longitude'] - obj2['longitude'])

        # Нормалізувати до 0-180
        if diff > 180:
            diff = 360 - diff

        # 2. Проверить каждый тип аспекта
        for aspect_type in aspect_types:
            exact_angle = float(aspect_type.exact_angle)

            # 3. НОВОЕ: Получить индивидуальный орбис для данной пары
            max_orb = self._calculate_allowed_orb(
                obj1['name'],
                obj2['name'],
                aspect_type.aspect_type
            )

            # 4. Рассчитать отклонение от точного аспекта
            deviation = abs(diff - exact_angle)

            # 5. Проверка: если отклонение <= допустимого орбиса
            if deviation <= max_orb:
                return {
                    'planet_1': obj1['name'],
                    'planet_2': obj2['name'],
                    'aspect_type': aspect_type.aspect_type,
                    'orb': deviation,  # Фактический орбис (отклонение от точного аспекта)
                    'is_major': aspect_type.class_ == 'major',
                    'harmonic_type': aspect_type.character
                }

        return None

    def _save_aspects(self, user_id: UUID, aspects: List[Dict]) -> None:
        """
        Зберегти аспекти в БД

        Args:
            user_id: ID користувача
            aspects: Список аспектів для збереження
        """
        # Видалити старі аспекти користувача
        self.db.query(NatalAspect).filter(
            NatalAspect.user_id == user_id
        ).delete()

        # Додати нові аспекти
        for aspect_data in aspects:
            aspect = NatalAspect(
                user_id=user_id,
                planet_1=aspect_data['planet_1'],
                planet_2=aspect_data['planet_2'],
                aspect_type=aspect_data['aspect_type'],
                orb=Decimal(str(aspect_data['orb'])),
                is_major=aspect_data['is_major'],
                harmonic_type=aspect_data['harmonic_type']
            )
            self.db.add(aspect)

        self.db.commit()

    def get_aspects_for_planet(self, user_id: UUID, planet_name: str) -> List[NatalAspect]:
        """
        Отримати всі аспекти для конкретної планети

        Args:
            user_id: ID користувача
            planet_name: Назва планети

        Returns:
            List[NatalAspect]: Список аспектів
        """
        return self.db.query(NatalAspect).filter(
            NatalAspect.user_id == user_id,
            (NatalAspect.planet_1 == planet_name) | (NatalAspect.planet_2 == planet_name)
        ).all()

    def get_aspects_by_type(
        self,
        user_id: UUID,
        aspect_type: str
    ) -> List[NatalAspect]:
        """
        Отримати всі аспекти певного типу

        Args:
            user_id: ID користувача
            aspect_type: Тип аспекту (наприклад, 'Trine', 'Square')

        Returns:
            List[NatalAspect]: Список аспектів
        """
        return self.db.query(NatalAspect).filter(
            NatalAspect.user_id == user_id,
            NatalAspect.aspect_type == aspect_type
        ).all()


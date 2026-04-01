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
from app.services.preferences_runtime import PreferencesRuntimeResolver


class AspectService:
    """Сервіс для розрахунку аспектів між планетами, спецточками та кутами"""
    
    def __init__(self, db_session: Session):
        self.db = db_session
        self._aspect_types_cache: Optional[List[RefAspectType]] = None
        self._aspect_angles_cache: Optional[Dict[str, float]] = None
        self._planet_orbs_cache: Optional[Dict[Tuple[str, str], float]] = None
        self._base_orbs_cache: Optional[Dict[str, float]] = None
        self.preferences_runtime = PreferencesRuntimeResolver(db_session)

    @staticmethod
    def _normalize_angle(value: float) -> float:
        normalized = float(value) % 360.0
        return normalized + 360.0 if normalized < 0 else normalized

    @classmethod
    def _angular_distance(cls, longitude_a: float, longitude_b: float) -> float:
        diff = abs(cls._normalize_angle(longitude_a) - cls._normalize_angle(longitude_b))
        return 360.0 - diff if diff > 180.0 else diff

    @classmethod
    def _build_phase_objects_lookup(cls, objects: List[Dict]) -> Dict[str, Dict[str, float]]:
        lookup: Dict[str, Dict[str, float]] = {}
        for obj in objects or []:
            name = str(obj.get('name') or '').strip()
            longitude = obj.get('longitude')
            if not name or longitude is None:
                continue
            speed = obj.get('speed')
            lookup[name] = {
                'longitude': cls._normalize_angle(float(longitude)),
                'speed': float(speed) if speed is not None else 0.0,
            }
        return lookup
    
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

        # Історично метод повертає нефільтрований список, а тривіальні аспекти
        # прибираються лише при збереженні в БД.
        aspects = self.calculate_aspects_for_objects(objects, filter_trivial=False, user_id=user_id)
        
        # Зберегти в БД
        self._save_aspects(user_id, aspects)
        
        return aspects

    def calculate_aspects_for_objects(
        self,
        objects: List[Dict],
        filter_trivial: bool = True,
        *,
        user_id: Optional[UUID] = None,
        astrologer_id: Optional[UUID] = None,
    ) -> List[Dict]:
        """
        Розрахувати аспекти для довільного набору об'єктів без збереження в БД.

        Args:
            objects: Список об'єктів у форматі
                {'name': str, 'longitude': float, 'type': str, 'speed': float?}
            filter_trivial: Прибрати математично тривіальні опозиції

        Returns:
            List[Dict]: Список знайдених аспектів
        """
        aspect_types = self._get_aspect_types()
        aspects: List[Dict] = []

        for i, obj1 in enumerate(objects):
            for obj2 in objects[i + 1:]:
                aspect = self._calculate_aspect_between(
                    obj1,
                    obj2,
                    aspect_types,
                    user_id=user_id,
                    astrologer_id=astrologer_id,
                )
                if aspect:
                    aspects.append(aspect)

        if filter_trivial:
            return self._filter_trivial_aspects(aspects)
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
                'type': 'planet',
                'speed': float(planet.speed) if planet.speed is not None else 0.0,
            })
        
        # Спеціальні точки
        special_points = self.db.query(NatalSpecialPoint).filter(
            NatalSpecialPoint.user_id == user_id
        ).all()
        
        for point in special_points:
            objects.append({
                'name': point.point,
                'longitude': float(point.degree),
                'type': 'special_point',
                'speed': 0.0,
            })
        
        # Кути (ASC, MC, IC, DSC)
        angles = self.db.query(Angle).filter(
            Angle.user_id == user_id
        ).first()
        
        if angles:
            objects.extend([
                {'name': 'ASC', 'longitude': float(angles.asc_degree), 'type': 'angle', 'speed': 0.0},
                {'name': 'MC', 'longitude': float(angles.mc_degree), 'type': 'angle', 'speed': 0.0},
                {'name': 'IC', 'longitude': float(angles.ic_degree), 'type': 'angle', 'speed': 0.0},
                {'name': 'DSC', 'longitude': float(angles.dsc_degree), 'type': 'angle', 'speed': 0.0},
            ])
        
        return objects
    
    def _get_aspect_types(self) -> List[RefAspectType]:
        """Отримати типи аспектів з кешуванням"""
        if self._aspect_types_cache is None:
            self._aspect_types_cache = self.db.query(RefAspectType).all()
        return self._aspect_types_cache

    def _get_aspect_angles(self) -> Dict[str, float]:
        """Получить точные углы аспектов из справочника."""
        if self._aspect_angles_cache is None:
            self._aspect_angles_cache = {
                aspect.aspect_type: float(aspect.exact_angle)
                for aspect in self._get_aspect_types()
            }
        return self._aspect_angles_cache

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

    def _get_base_orbs(self) -> Dict[str, float]:
        """Получить базовые орбисы аспектов с кешированием."""
        if self._base_orbs_cache is None:
            self._base_orbs_cache = {
                aspect.aspect_type: float(aspect.base_orb)
                for aspect in self._get_aspect_types()
            }
        return self._base_orbs_cache

    def _calculate_allowed_orb(
        self,
        body_a: str,
        body_b: str,
        aspect_type: str,
        *,
        astrologer_id: Optional[UUID] = None,
    ) -> float:
        """
        Расчет допустимого орбиса для пары тел согласно правилу:
        "если в аспекте участвуют планеты с разными орбисами - берем больший"

        Args:
            body_a: Название первого тела (планета/точка)
            body_b: Название второго тела
            aspect_type: Тип аспекта (например, 'Conjunction')

        Returns:
            float: Максимальный орбис из двух тел
        """
        if astrologer_id:
            return self.preferences_runtime.resolve_orb_for_astrologer(
                astrologer_id,
                body_a,
                body_b,
                aspect_type,
                orb_profile='natal',
            )

        planet_orbs = self._get_planet_orbs()
        base_orbs = self._get_base_orbs()

        # Получить орбис для тела A
        orb_a = planet_orbs.get((body_a, aspect_type))

        # Получить орбис для тела B
        orb_b = planet_orbs.get((body_b, aspect_type))

        # Если орбис не найден, использовать базовый из ref_aspect_types
        if orb_a is None:
            orb_a = base_orbs.get(aspect_type, 5.0)

        if orb_b is None:
            orb_b = base_orbs.get(aspect_type, 5.0)

        # ГЛАВНОЕ ПРАВИЛО: берем больший орбис
        return max(orb_a, orb_b)

    def infer_aspect_phase(
        self,
        aspect_data: Dict,
        objects_lookup: Dict[str, Dict[str, float]],
    ) -> Optional[bool]:
        """
        Определить фазу аспекта: True = applying, False = separating.

        Возвращает None, если фазу нельзя надёжно вычислить.
        """
        if not aspect_data or not objects_lookup:
            return None

        exact_angle = self._get_aspect_angles().get(aspect_data.get('aspect_type'))
        if exact_angle is None:
            return None

        body_a = objects_lookup.get(aspect_data.get('planet_1'))
        body_b = objects_lookup.get(aspect_data.get('planet_2'))
        if not body_a or not body_b:
            return None

        current_distance = self._angular_distance(body_a['longitude'], body_b['longitude'])
        current_deviation = abs(current_distance - exact_angle)

        # Маленький шаг вперёд по времени позволяет стабильно понять,
        # сходятся ли тела к точному аспекту или уже расходятся.
        step_days = 1.0 / 24.0
        future_distance = self._angular_distance(
            body_a['longitude'] + (body_a['speed'] * step_days),
            body_b['longitude'] + (body_b['speed'] * step_days),
        )
        future_deviation = abs(future_distance - exact_angle)

        if abs(future_deviation - current_deviation) < 1e-9:
            return None
        return future_deviation < current_deviation

    def annotate_aspects_with_phase(self, aspects: List[Dict], objects: List[Dict]) -> List[Dict]:
        """Обогатить аспекты вычисленным applying/separating."""
        if not aspects:
            return aspects

        objects_lookup = self._build_phase_objects_lookup(objects)
        if not objects_lookup:
            return aspects

        annotated_aspects: List[Dict] = []
        for aspect in aspects:
            if isinstance(aspect.get('applying'), bool):
                annotated_aspects.append(aspect)
                continue
            applying = self.infer_aspect_phase(aspect, objects_lookup)
            if applying is None:
                annotated_aspects.append(aspect)
                continue
            annotated_aspects.append({
                **aspect,
                'applying': applying,
            })
        return annotated_aspects
    
    def _calculate_aspect_between(
        self,
        obj1: Dict,
        obj2: Dict,
        aspect_types: List[RefAspectType],
        *,
        user_id: Optional[UUID] = None,
        astrologer_id: Optional[UUID] = None,
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
        resolved_astrologer_id = astrologer_id
        if resolved_astrologer_id is None and user_id is not None:
            resolved_astrologer_id = self.preferences_runtime.get_astrologer_id_for_user(user_id)

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
                aspect_type.aspect_type,
                astrologer_id=resolved_astrologer_id,
            )

            # 4. Рассчитать отклонение от точного аспекта
            deviation = abs(diff - exact_angle)

            # 5. Проверка: если отклонение <= допустимого орбиса
            if deviation <= max_orb:
                applying = self.infer_aspect_phase(
                    {
                        'planet_1': obj1['name'],
                        'planet_2': obj2['name'],
                        'aspect_type': aspect_type.aspect_type,
                    },
                    self._build_phase_objects_lookup([obj1, obj2]),
                )
                return {
                    'planet_1': obj1['name'],
                    'planet_2': obj2['name'],
                    'aspect_type': aspect_type.aspect_type,
                    'orb': deviation,  # Фактический орбис (отклонение от точного аспекта)
                    'is_major': aspect_type.class_ == 'major',
                    'harmonic_type': aspect_type.character,
                    'applying': applying,
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

        # Фильтруем гарантированные математические оппозиции
        filtered_aspects = self._filter_trivial_aspects(aspects)

        # Додати нові аспекти
        for aspect_data in filtered_aspects:
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

    def _filter_trivial_aspects(self, aspects: List[Dict]) -> List[Dict]:
        """
        Фильтрует математически гарантированные оппозиции, которые всегда присутствуют
        на каждой натальной карте и не несут астрологической информации.

        Исключаемые аспекты:
        1. TrueNorthNode ☊ TrueSouthNode (Opposition) - математически south = north + 180°
        2. ASC ☊ DSC (Opposition) - математически dsc = asc + 180°
        3. MC ☊ IC (Opposition) - математически ic = mc + 180°
        4. Vertex ☊ AntiVertex (Opposition) - математически anti_vertex = vertex + 180°

        Args:
            aspects: Список всех найденных аспектов

        Returns:
            Отфильтрованный список аспектов без тривиальных
        """
        # Определяем пары, которые нужно исключить (только оппозиции)
        trivial_pairs = [
            # Лунные узлы
            frozenset(['TrueNorthNode', 'TrueSouthNode']),
            # Оси углов
            frozenset(['ASC', 'DSC']),
            frozenset(['MC', 'IC']),
            # Вертекс (если определён)
            frozenset(['Vertex', 'AntiVertex']),
        ]

        filtered = []
        for aspect in aspects:
            pair = frozenset([aspect['planet_1'], aspect['planet_2']])

            # Исключаем только если это оппозиция И это одна из тривиальных пар
            is_trivial = (
                aspect['aspect_type'] == 'Opposition' and
                pair in trivial_pairs
            )

            if not is_trivial:
                filtered.append(aspect)

        return filtered

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

"""
Сервис для определения специальных ролей планет
"""
from typing import Optional, List, Dict
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database.models import NatalPlanet, NatalAspect, CosmogramPattern


class SpecialRolesService:
    """
    Сервис для определения специальных ролей планет в натальной карте
    
    Роли:
    - Альмутен карты (almuten) - планета с максимальной силой
    - Возничий (charioteer) - планета перед Солнцем (классические, орбис 5°)
    - Дорифор (doryphoros) - планета после Солнца (Меркурий/Венера/Марс, орбис 15°)
    - Король аспектов (aspect_king) - планета с максимумом мажорных аспектов
    - Ручка ведра (handle) - якорная планета фигуры Bucket
    """
    
    # Классические планеты для Возничего
    CLASSICAL_PLANETS = ['Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']
    
    # Планеты для Дорифора
    DORYPHOROS_PLANETS = ['Mercury', 'Venus', 'Mars']
    
    # Орбисы
    CHARIOTEER_ORB = 5.0
    DORYPHOROS_ORB = 15.0
    
    def __init__(self, db_session: Session):
        """
        Инициализация сервиса
        
        Args:
            db_session: SQLAlchemy сессия для работы с БД
        """
        self.db = db_session
    
    def determine_all_roles(self, user_id: UUID) -> None:
        """
        Определить все специальные роли для планет пользователя
        
        Args:
            user_id: ID пользователя
        """
        # Получаем все планеты
        planets = self.db.query(NatalPlanet).filter(
            NatalPlanet.user_id == user_id
        ).all()
        
        # Сбрасываем все роли
        for planet in planets:
            planet.special_roles = []
        
        # Определяем каждую роль
        almuten = self._find_almuten(user_id)
        charioteer = self._find_charioteer(user_id)
        doryphoros = self._find_doryphoros(user_id)
        aspect_king = self._find_aspect_king(user_id)
        handle = self._find_handle(user_id)
        
        # Присваиваем роли
        roles_map = {
            almuten: 'almuten',
            charioteer: 'charioteer',
            doryphoros: 'doryphoros',
            aspect_king: 'aspect_king',
            handle: 'handle',
        }
        
        for planet_name, role in roles_map.items():
            if planet_name:
                planet = next((p for p in planets if p.planet == planet_name), None)
                if planet:
                    if not planet.special_roles:
                        planet.special_roles = []
                    planet.special_roles.append(role)
        
        self.db.commit()
    
    def _find_almuten(self, user_id: UUID) -> Optional[str]:
        """
        Найти альмутена карты - планету с максимальной силой
        
        Args:
            user_id: ID пользователя
            
        Returns:
            Название планеты или None
        """
        planet = self.db.query(NatalPlanet).filter(
            NatalPlanet.user_id == user_id,
            NatalPlanet.strength_score.isnot(None)
        ).order_by(NatalPlanet.strength_score.desc()).first()
        
        return planet.planet if planet else None
    
    def _find_charioteer(self, user_id: UUID) -> Optional[str]:
        """
        Найти Возничего - классическую планету перед Солнцем (орбис 5°)
        
        Возничий - это планета, которая восходит ПЕРЕД Солнцем
        (находится западнее Солнца, но в пределах орбиса)
        
        Args:
            user_id: ID пользователя
            
        Returns:
            Название планеты или None
        """
        # Получаем Солнце
        sun = self.db.query(NatalPlanet).filter(
            NatalPlanet.user_id == user_id,
            NatalPlanet.planet == 'Sun'
        ).first()
        
        if not sun:
            return None
        
        sun_lon = float(sun.degree)
        
        # Получаем классические планеты
        planets = self.db.query(NatalPlanet).filter(
            NatalPlanet.user_id == user_id,
            NatalPlanet.planet.in_(self.CLASSICAL_PLANETS)
        ).all()
        
        # Ищем ближайшую планету ПЕРЕД Солнцем (западнее)
        candidates = []
        for planet in planets:
            planet_lon = float(planet.degree)
            
            # Вычисляем разницу (планета должна быть западнее Солнца)
            diff = (sun_lon - planet_lon) % 360
            
            # Проверяем орбис (планета в пределах 5° перед Солнцем)
            if 0 < diff <= self.CHARIOTEER_ORB:
                candidates.append((planet.planet, diff))
        
        # Возвращаем ближайшую
        if candidates:
            candidates.sort(key=lambda x: x[1])
            return candidates[0][0]

        return None

    def _find_doryphoros(self, user_id: UUID) -> Optional[str]:
        """
        Найти Дорифора - Меркурий/Венеру/Марс после Солнца (орбис 15°)

        Дорифор - это планета, которая восходит ПОСЛЕ Солнца
        (находится восточнее Солнца, но в пределах орбиса)

        Args:
            user_id: ID пользователя

        Returns:
            Название планеты или None
        """
        # Получаем Солнце
        sun = self.db.query(NatalPlanet).filter(
            NatalPlanet.user_id == user_id,
            NatalPlanet.planet == 'Sun'
        ).first()

        if not sun:
            return None

        sun_lon = float(sun.degree)

        # Получаем планеты для Дорифора
        planets = self.db.query(NatalPlanet).filter(
            NatalPlanet.user_id == user_id,
            NatalPlanet.planet.in_(self.DORYPHOROS_PLANETS)
        ).all()

        # Ищем ближайшую планету ПОСЛЕ Солнца (восточнее)
        candidates = []
        for planet in planets:
            planet_lon = float(planet.degree)

            # Вычисляем разницу (планета должна быть восточнее Солнца)
            diff = (planet_lon - sun_lon) % 360

            # Проверяем орбис (планета в пределах 15° после Солнца)
            if 0 < diff <= self.DORYPHOROS_ORB:
                candidates.append((planet.planet, diff))

        # Возвращаем ближайшую
        if candidates:
            candidates.sort(key=lambda x: x[1])
            return candidates[0][0]

        return None

    def _find_aspect_king(self, user_id: UUID) -> Optional[str]:
        """
        Найти короля аспектов - планету с максимумом мажорных аспектов

        Считаем только мажорные аспекты к другим планетам (без фиктивных точек)

        Args:
            user_id: ID пользователя

        Returns:
            Название планеты или None
        """
        # Список планет (без фиктивных точек)
        REAL_PLANETS = [
            'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
            'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'
        ]

        # Получаем все мажорные аспекты
        aspects = self.db.query(NatalAspect).filter(
            NatalAspect.user_id == user_id,
            NatalAspect.is_major == True,
            NatalAspect.planet_1.in_(REAL_PLANETS),
            NatalAspect.planet_2.in_(REAL_PLANETS)
        ).all()

        # Подсчитываем аспекты для каждой планеты
        aspect_counts = {}
        for aspect in aspects:
            aspect_counts[aspect.planet_1] = aspect_counts.get(aspect.planet_1, 0) + 1
            aspect_counts[aspect.planet_2] = aspect_counts.get(aspect.planet_2, 0) + 1

        # Находим планету с максимумом аспектов
        if aspect_counts:
            max_planet = max(aspect_counts.items(), key=lambda x: x[1])
            return max_planet[0]

        return None

    def _find_handle(self, user_id: UUID) -> Optional[str]:
        """
        Найти ручку ведра - якорную планету фигуры Bucket

        Args:
            user_id: ID пользователя

        Returns:
            Название планеты или None
        """
        pattern = self.db.query(CosmogramPattern).filter(
            CosmogramPattern.user_id == user_id,
            CosmogramPattern.pattern_type == 'Bucket'
        ).first()

        if pattern and pattern.anchor_planet:
            return pattern.anchor_planet

        return None


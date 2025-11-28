"""
Repository для работы с пользователями
"""
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID
from datetime import date, time as time_type

from app.database.models import User


class UserRepository:
    """Repository для управления пользователями"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def create_user(
        self,
        birth_date: date,
        birth_time: time_type,
        timezone: str,
        birth_place: str,
        lat: float,
        lon: float,
        julian_day: float
    ) -> User:
        """
        Создать нового пользователя
        
        Args:
            birth_date: Дата рождения
            birth_time: Время рождения
            timezone: Временная зона
            birth_place: Место рождения
            lat: Широта
            lon: Долгота
            julian_day: Юлианский день
            
        Returns:
            User: Созданный пользователь
        """
        user = User(
            birth_date=birth_date,
            birth_time=birth_time,
            timezone=timezone,
            birth_place=birth_place,
            lat=lat,
            lon=lon,
            julian_day=julian_day
        )
        
        self.session.add(user)
        self.session.flush()  # Получить user_id без commit
        
        return user
    
    def get_user_by_id(self, user_id: UUID) -> Optional[User]:
        """
        Получить пользователя по ID
        
        Args:
            user_id: UUID пользователя
            
        Returns:
            Optional[User]: Пользователь или None
        """
        return self.session.query(User).filter(User.user_id == user_id).first()
    
    def get_user_with_natal_chart(self, user_id: UUID) -> Optional[User]:
        """
        Получить пользователя со всеми данными натальной карты
        
        Args:
            user_id: UUID пользователя
            
        Returns:
            Optional[User]: Пользователь с загруженными relationships или None
        """
        from sqlalchemy.orm import joinedload
        
        return (
            self.session.query(User)
            .filter(User.user_id == user_id)
            .options(
                joinedload(User.planets),
                joinedload(User.houses),
                joinedload(User.angles),
                joinedload(User.special_points),
                joinedload(User.configurations),
            )
            .first()
        )
    
    def update_user(self, user_id: UUID, **kwargs) -> Optional[User]:
        """
        Обновить данные пользователя
        
        Args:
            user_id: UUID пользователя
            **kwargs: Поля для обновления
            
        Returns:
            Optional[User]: Обновлённый пользователь или None
        """
        user = self.get_user_by_id(user_id)
        if not user:
            return None
        
        for key, value in kwargs.items():
            if hasattr(user, key):
                setattr(user, key, value)
        
        self.session.flush()
        return user
    
    def delete_user(self, user_id: UUID) -> bool:
        """
        Удалить пользователя (каскадно удалит все связанные данные)
        
        Args:
            user_id: UUID пользователя
            
        Returns:
            bool: True если удалён, False если не найден
        """
        user = self.get_user_by_id(user_id)
        if not user:
            return False
        
        self.session.delete(user)
        self.session.flush()
        return True
    
    def find_users_by_location(
        self,
        lat: float,
        lon: float,
        radius_degrees: float = 1.0
    ) -> list[User]:
        """
        Найти пользователей в радиусе от координат
        
        Args:
            lat: Широта
            lon: Долгота
            radius_degrees: Радиус поиска в градусах
            
        Returns:
            list[User]: Список пользователей
        """
        return (
            self.session.query(User)
            .filter(
                User.lat.between(lat - radius_degrees, lat + radius_degrees),
                User.lon.between(lon - radius_degrees, lon + radius_degrees)
            )
            .all()
        )


"""
Repository для работы с натальными картами
"""
from sqlalchemy.orm import Session
from typing import Optional, Dict, List, Any
from uuid import UUID

from app.database.models import (
    User, NatalPlanet, NatalHouse, Angle,
    NatalSpecialPoint, NatalConfiguration, FateCrossPoints
)


class NatalChartRepository:
    """Repository для сохранения и загрузки натальных карт"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def save_planets(self, user_id: UUID, planets_data: List[Dict[str, Any]]) -> None:
        """
        Сохранить планеты натальной карты
        
        Args:
            user_id: UUID пользователя
            planets_data: Список данных планет
        """
        # Удаляем старые данные (если есть)
        self.session.query(NatalPlanet).filter(NatalPlanet.user_id == user_id).delete()
        
        # Добавляем новые
        for planet_data in planets_data:
            planet = NatalPlanet(
                user_id=user_id,
                planet=planet_data['name'],
                sign=planet_data['sign'],
                degree=planet_data['longitude'],
                house_number=planet_data.get('house') or planet_data.get('house_number'),
                retrograde=planet_data.get('retrograde') or planet_data.get('is_retrograde', False),
                speed=planet_data.get('speed'),
                # Новые поля из пункта 3.2 спецификации
                element=planet_data.get('element'),
                mode=planet_data.get('mode'),
                dignity=planet_data.get('dignity'),
                # Миграция 007: связи планета-дом
                ruled_houses=planet_data.get('ruled_houses', []),
            )
            self.session.add(planet)
        
        self.session.flush()
    
    def save_houses(self, user_id: UUID, houses_data: List[Dict[str, Any]]) -> None:
        """
        Сохранить дома натальной карты
        
        Args:
            user_id: UUID пользователя
            houses_data: Список данных домов
        """
        # Удаляем старые данные
        self.session.query(NatalHouse).filter(NatalHouse.user_id == user_id).delete()
        
        # Добавляем новые
        for house_data in houses_data:
            house = NatalHouse(
                user_id=user_id,
                house_number=house_data['number'],
                sign_on_cusp=house_data['sign'],
                cusp_degree=house_data['longitude'],
                # Новые поля из пункта 3.2 спецификации
                ruler_planet=house_data.get('ruler_planet'),
                house_group=house_data.get('house_group'),
                included_sign=house_data.get('included_sign'),
                co_rulers=house_data.get('co_rulers', []),
                significator=house_data.get('significator'),
                # Миграция 007: связи дом-планета
                ruler_in_house=house_data.get('ruler_in_house'),
                planets_in_house=house_data.get('planets_in_house', []),
            )
            self.session.add(house)
        
        self.session.flush()
    
    def save_angles(self, user_id: UUID, angles_data: Dict[str, Dict[str, Any]]) -> None:
        """
        Сохранить углы натальной карты
        
        Args:
            user_id: UUID пользователя
            angles_data: Словарь с данными углов
        """
        # Удаляем старые данные
        self.session.query(Angle).filter(Angle.user_id == user_id).delete()
        
        # Создаём новую запись
        angle = Angle(
            user_id=user_id,
            asc_sign=angles_data['ASC']['sign'],
            asc_degree=angles_data['ASC']['longitude'],
            mc_sign=angles_data['MC']['sign'],
            mc_degree=angles_data['MC']['longitude'],
            ic_sign=angles_data['IC']['sign'],
            ic_degree=angles_data['IC']['longitude'],
            dsc_sign=angles_data['DSC']['sign'],
            dsc_degree=angles_data['DSC']['longitude'],
            vertex_sign=angles_data.get('Vertex', {}).get('sign'),
            vertex_degree=angles_data.get('Vertex', {}).get('longitude'),
        )
        self.session.add(angle)
        self.session.flush()
    
    def save_special_points(self, user_id: UUID, points_data: Dict[str, Dict[str, Any]]) -> None:
        """
        Сохранить специальные точки
        
        Args:
            user_id: UUID пользователя
            points_data: Словарь с данными специальных точек
        """
        # Удаляем старые данные
        self.session.query(NatalSpecialPoint).filter(NatalSpecialPoint.user_id == user_id).delete()
        
        # Добавляем новые
        for point_name, point_data in points_data.items():
            point = NatalSpecialPoint(
                user_id=user_id,
                point=point_name,
                sign=point_data['sign'],
                degree=point_data['longitude'],
                house_number=point_data.get('house'),
            )
            self.session.add(point)
        
        self.session.flush()
    
    def save_fate_cross(self, user_id: UUID, fate_cross_data: Dict[str, Any]) -> None:
        """
        Сохранить точки Креста Судьбы

        Args:
            user_id: UUID пользователя
            fate_cross_data: Данные Креста Судьбы с точками
        """
        # Удаляем старые данные
        self.session.query(FateCrossPoints).filter(FateCrossPoints.user_id == user_id).delete()

        # Извлекаем точки из данных
        points = fate_cross_data.get('points', [])
        if len(points) >= 4:
            # Точки 3 и 4 - это точки квадратуры (Раху+90° и Раху-90°)
            # Точки 1 и 2 - это сами узлы (уже сохранены в natal_special_points)
            fate_cross = FateCrossPoints(
                user_id=user_id,
                point_1_longitude=points[2]['longitude'],  # FateCross1 (Раху + 90°)
                point_1_sign=points[2]['sign'],
                point_1_house=points[2]['house'],
                point_2_longitude=points[3]['longitude'],  # FateCross2 (Раху - 90°)
                point_2_sign=points[3]['sign'],
                point_2_house=points[3]['house'],
            )
            self.session.add(fate_cross)

        self.session.flush()

    def save_configurations(self, user_id: UUID, configurations_data: List[Dict[str, Any]]) -> None:
        """
        Сохранить аспектные конфигурации (Т-квадраты, трины, йоды и т.д.)

        Args:
            user_id: UUID пользователя
            configurations_data: Список конфигураций
        """
        # Удаляем старые данные
        self.session.query(NatalConfiguration).filter(NatalConfiguration.user_id == user_id).delete()

        # Добавляем новые
        for config in configurations_data:
            configuration = NatalConfiguration(
                user_id=user_id,
                type=config['type'],
                planets_involved=config['planets_involved'],
                houses_involved=config.get('houses_involved'),
                element=config.get('element'),
                mode=config.get('mode'),
                strength_score=config.get('strength_score'),
            )
            self.session.add(configuration)

        self.session.flush()
    
    def save_full_natal_chart(
        self,
        user_id: UUID,
        planets: List[Dict[str, Any]],
        houses: List[Dict[str, Any]],
        angles: Dict[str, Dict[str, Any]],
        special_points: Dict[str, Dict[str, Any]],
        fate_cross: Optional[Dict[str, Any]] = None,
        configurations: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        """
        Сохранить полную натальную карту

        Args:
            user_id: UUID пользователя
            planets: Данные планет
            houses: Данные домов
            angles: Данные углов
            special_points: Данные специальных точек
            fate_cross: Данные Креста Судьбы (опционально)
            configurations: Список аспектных конфигураций (опционально)
        """
        self.save_planets(user_id, planets)
        self.save_houses(user_id, houses)
        self.save_angles(user_id, angles)
        self.save_special_points(user_id, special_points)

        if fate_cross:
            self.save_fate_cross(user_id, fate_cross)

        if configurations:
            self.save_configurations(user_id, configurations)

        self.session.flush()


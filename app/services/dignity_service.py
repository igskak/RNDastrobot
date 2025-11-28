"""
Сервис для работы с достоинствами планет и свойствами знаков
"""
from typing import Dict, Optional
from sqlalchemy.orm import Session
from app.database.models import RefSignProperties


class DignityService:
    """
    Сервис для определения достоинств планет и свойств знаков
    
    Этот сервис работает со справочником ref_sign_properties и предоставляет:
    - Свойства знаков (стихия, крест, пол, зона)
    - Достоинства планет в знаках (обитель, экзальтация, изгнание, падение)
    - Группы домов (угловые, последующие, падающие)
    - Управителей домов
    """
    
    def __init__(self, db_session: Session):
        """
        Инициализация сервиса
        
        Args:
            db_session: SQLAlchemy сессия для работы с БД
        """
        self.db_session = db_session
        self._sign_properties_cache: Optional[Dict[str, Dict]] = None
    
    def _load_sign_properties(self) -> None:
        """Загрузить свойства знаков из БД в кэш"""
        signs = self.db_session.query(RefSignProperties).all()
        
        self._sign_properties_cache = {}
        for sign in signs:
            self._sign_properties_cache[sign.sign] = {
                'element': sign.element,
                'mode': sign.mode,
                'gender': sign.gender,
                'zone': sign.zone,
                'life_quadrant': sign.life_quadrant,
                'ruler': sign.ruler,
                'exaltation': sign.exaltation,
                'detriment': sign.detriment,
                'fall': sign.fall,
            }
    
    def get_sign_properties(self, sign: str) -> Dict:
        """
        Получить свойства знака из справочника
        
        Args:
            sign: Название знака (например, 'Aries', 'Taurus')
        
        Returns:
            Словарь со свойствами знака:
            {
                'element': 'Fire',
                'mode': 'Cardinal',
                'gender': 'Masculine',
                'zone': 'Brahma',
                'life_quadrant': 'Childhood',
                'ruler': 'Mars',
                'exaltation': 'Sun',
                'detriment': 'Venus',
                'fall': 'Saturn'
            }
        """
        # Кэшируем данные при первом обращении
        if self._sign_properties_cache is None:
            self._load_sign_properties()
        
        return self._sign_properties_cache.get(sign, {})
    
    def calculate_dignity(self, planet: str, sign: str) -> str:
        """
        Определить достоинство планеты в знаке
        
        Args:
            planet: Название планеты (например, 'Sun', 'Moon', 'Mars')
            sign: Название знака (например, 'Aries', 'Taurus')
        
        Returns:
            Достоинство планеты:
            - 'domicile' (обитель) - планета управляет знаком
            - 'exaltation' (экзальтация) - планета экзальтирует в знаке
            - 'detriment' (изгнание) - планета в изгнании
            - 'fall' (падение) - планета в падении
            - 'neutral' (нейтральное положение)
        """
        sign_props = self.get_sign_properties(sign)
        
        if not sign_props:
            return 'neutral'
        
        # Проверяем обитель (ruler)
        if sign_props.get('ruler') == planet:
            return 'domicile'
        
        # Проверяем экзальтацию
        if sign_props.get('exaltation') == planet:
            return 'exaltation'
        
        # Проверяем изгнание
        if sign_props.get('detriment') == planet:
            return 'detriment'
        
        # Проверяем падение
        if sign_props.get('fall') == planet:
            return 'fall'
        
        return 'neutral'
    
    def get_house_group(self, house_number: int) -> str:
        """
        Определить группу дома
        
        Args:
            house_number: Номер дома (1-12)
        
        Returns:
            Группа дома:
            - 'angular' (угловые дома: 1, 4, 7, 10) - самые сильные
            - 'succedent' (последующие дома: 2, 5, 8, 11) - средней силы
            - 'cadent' (падающие дома: 3, 6, 9, 12) - самые слабые
        """
        if house_number in [1, 4, 7, 10]:
            return 'angular'
        elif house_number in [2, 5, 8, 11]:
            return 'succedent'
        else:  # 3, 6, 9, 12
            return 'cadent'
    
    def get_house_ruler(self, sign_on_cusp: str) -> str:
        """
        Получить управителя дома по знаку на куспиде
        
        Args:
            sign_on_cusp: Знак на куспиде дома
        
        Returns:
            Название планеты-управителя (например, 'Mars', 'Venus')
        """
        sign_props = self.get_sign_properties(sign_on_cusp)
        return sign_props.get('ruler', '')


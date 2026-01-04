"""
Сервис для работы с достоинствами планет и свойствами знаков
"""
from typing import Dict, List, Optional
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
        """Загрузить свойства знаков из БД в кэш или использовать fallback"""
        if self.db_session:
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
                    'co_ruler': getattr(sign, 'co_ruler', None),
                    'exaltation': sign.exaltation,
                    'detriment': sign.detriment,
                    'fall': sign.fall,
                }
        else:
            # Fallback: используем встроенные данные
            self._sign_properties_cache = self._get_fallback_sign_properties()
    
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
                'co_ruler': None,
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

    def get_sign_co_ruler(self, sign: str) -> Optional[str]:
        """
        Получить соуправителя знака (по Астрокурсу)

        Args:
            sign: Название знака

        Returns:
            Название планеты-соуправителя или None
        """
        sign_props = self.get_sign_properties(sign)
        return sign_props.get('co_ruler')

    def get_house_co_rulers(
        self,
        sign_on_cusp: str,
        included_sign: Optional[str] = None
    ) -> List[str]:
        """
        Получить соуправителей дома.

        По Астрокурсу (строки 709-710):
        "Несколько Управителей, если есть включённый знак
        или в знаке на куспиде управляют 2 планеты"

        Соуправители появляются когда:
        1. Знак на куспиде имеет соуправителя (co_ruler)
        2. В доме есть включённый знак — его управитель становится соуправителем

        Args:
            sign_on_cusp: Знак на куспиде дома
            included_sign: Включённый знак в доме (если есть)

        Returns:
            Список соуправителей (может быть пустым)
        """
        co_rulers = []

        # 1. Соуправитель знака на куспиде
        cusp_co_ruler = self.get_sign_co_ruler(sign_on_cusp)
        if cusp_co_ruler:
            co_rulers.append(cusp_co_ruler)

        # 2. Управитель включённого знака
        if included_sign:
            included_sign_props = self.get_sign_properties(included_sign)
            included_ruler = included_sign_props.get('ruler')
            if included_ruler and included_ruler not in co_rulers:
                co_rulers.append(included_ruler)
            # Также добавляем соуправителя включённого знака
            included_co_ruler = included_sign_props.get('co_ruler')
            if included_co_ruler and included_co_ruler not in co_rulers:
                co_rulers.append(included_co_ruler)

        return co_rulers

    def _get_fallback_sign_properties(self) -> Dict[str, Dict]:
        """Fallback данные знаков (когда нет БД)"""
        return {
            'Aries': {'element': 'Fire', 'mode': 'Cardinal', 'gender': 'Masculine', 'zone': 'Brahma', 'life_quadrant': 'Childhood', 'ruler': 'Mars', 'co_ruler': None, 'exaltation': 'Sun', 'detriment': 'Venus', 'fall': 'Saturn'},
            'Taurus': {'element': 'Earth', 'mode': 'Fixed', 'gender': 'Feminine', 'zone': 'Brahma', 'life_quadrant': 'Childhood', 'ruler': 'Venus', 'co_ruler': None, 'exaltation': 'Moon', 'detriment': 'Mars', 'fall': None},
            'Gemini': {'element': 'Air', 'mode': 'Mutable', 'gender': 'Masculine', 'zone': 'Brahma', 'life_quadrant': 'Childhood', 'ruler': 'Mercury', 'co_ruler': None, 'exaltation': None, 'detriment': 'Jupiter', 'fall': None},
            'Cancer': {'element': 'Water', 'mode': 'Cardinal', 'gender': 'Feminine', 'zone': 'Brahma', 'life_quadrant': 'Childhood', 'ruler': 'Moon', 'co_ruler': None, 'exaltation': 'Jupiter', 'detriment': 'Saturn', 'fall': 'Mars'},
            'Leo': {'element': 'Fire', 'mode': 'Fixed', 'gender': 'Masculine', 'zone': 'Brahma', 'life_quadrant': 'Youth', 'ruler': 'Sun', 'co_ruler': None, 'exaltation': None, 'detriment': 'Saturn', 'fall': None},
            'Virgo': {'element': 'Earth', 'mode': 'Mutable', 'gender': 'Feminine', 'zone': 'Vishnu', 'life_quadrant': 'Youth', 'ruler': 'Mercury', 'co_ruler': 'Proserpina', 'exaltation': 'Mercury', 'detriment': 'Jupiter', 'fall': 'Venus'},
            'Libra': {'element': 'Air', 'mode': 'Cardinal', 'gender': 'Masculine', 'zone': 'Vishnu', 'life_quadrant': 'Youth', 'ruler': 'Venus', 'co_ruler': 'Chiron', 'exaltation': 'Saturn', 'detriment': 'Mars', 'fall': 'Sun'},
            'Scorpio': {'element': 'Water', 'mode': 'Fixed', 'gender': 'Feminine', 'zone': 'Vishnu', 'life_quadrant': 'Youth', 'ruler': 'Pluto', 'co_ruler': 'Mars', 'exaltation': None, 'detriment': 'Venus', 'fall': 'Moon'},
            'Sagittarius': {'element': 'Fire', 'mode': 'Mutable', 'gender': 'Masculine', 'zone': 'Brahma', 'life_quadrant': 'Maturity', 'ruler': 'Jupiter', 'co_ruler': 'Neptune', 'exaltation': None, 'detriment': 'Mercury', 'fall': None},
            'Capricorn': {'element': 'Earth', 'mode': 'Cardinal', 'gender': 'Feminine', 'zone': 'Shiva', 'life_quadrant': 'Maturity', 'ruler': 'Saturn', 'co_ruler': 'Uranus', 'exaltation': 'Mars', 'detriment': 'Moon', 'fall': 'Jupiter'},
            'Aquarius': {'element': 'Air', 'mode': 'Fixed', 'gender': 'Masculine', 'zone': 'Shiva', 'life_quadrant': 'Maturity', 'ruler': 'Uranus', 'co_ruler': 'Saturn', 'exaltation': None, 'detriment': 'Sun', 'fall': None},
            'Pisces': {'element': 'Water', 'mode': 'Mutable', 'gender': 'Feminine', 'zone': 'Shiva', 'life_quadrant': 'Maturity', 'ruler': 'Neptune', 'co_ruler': 'Jupiter', 'exaltation': 'Venus', 'detriment': 'Mercury', 'fall': 'Mercury'},
        }


"""Сервис для работы с достоинствами планет и свойствами знаков."""
from copy import deepcopy
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.database.models import RefSignProperties
from app.services.preferences_runtime import (
    CANONICAL_SIGNS,
    OPPOSITE_SIGN_BY_SIGN,
    PreferencesRuntimeResolver,
)
from app.services.reference_data_cache import get_sign_properties


class DignityService:
    """
    Сервис для определения достоинств планет и свойств знаков
    
    Этот сервис работает со справочником ref_sign_properties и предоставляет:
    - Свойства знаков (стихия, крест, пол, зона)
    - Достоинства планет в знаках (обитель, экзальтация, изгнание, падение)
    - Группы домов (угловые, последующие, падающие)
    - Управителей домов
    """
    
    def __init__(
        self,
        db_session: Session,
        astrologer_id=None,
        default_house_system: str = 'P',
    ):
        """
        Инициализация сервиса
        
        Args:
            db_session: SQLAlchemy сессия для работы с БД
        """
        self.db_session = db_session
        self.astrologer_id = astrologer_id
        self.default_house_system = default_house_system
        self._sign_properties_cache: Optional[Dict[str, Dict]] = None
    
    def _load_sign_properties(self) -> None:
        """Загрузить свойства знаков из БД в кэш или использовать fallback"""
        if self.db_session:
            signs = get_sign_properties(self.db_session)
            self._sign_properties_cache = {
                sign.sign: {
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
                for sign in signs
            }
        else:
            self._sign_properties_cache = self._get_fallback_sign_properties()

        if self.astrologer_id and self.db_session:
            resolver = PreferencesRuntimeResolver(self.db_session)
            dignity_settings = resolver.get_dignity_settings_for_astrologer(
                self.astrologer_id,
                default_house_system=self.default_house_system,
            )
            signs_payload = dignity_settings.get('signs') or {}
            for sign_name in CANONICAL_SIGNS:
                sign_props = deepcopy(self._sign_properties_cache.get(sign_name) or {})
                overrides = signs_payload.get(sign_name) or {}
                sign_props['ruler'] = overrides.get('ruler')
                sign_props['co_ruler'] = overrides.get('co_ruler')
                sign_props['exaltation'] = overrides.get('exaltation')
                self._sign_properties_cache[sign_name] = sign_props

        self._recompute_derived_dignities()

    def _recompute_derived_dignities(self) -> None:
        """Recompute detriment/fall from the full sign map so overrides stay consistent."""
        if not self._sign_properties_cache:
            return

        for sign_name in CANONICAL_SIGNS:
            sign_props = self._sign_properties_cache.setdefault(sign_name, {})
            opposite_sign = OPPOSITE_SIGN_BY_SIGN.get(sign_name)
            opposite_props = self._sign_properties_cache.get(opposite_sign or '', {})
            sign_props['detriment'] = opposite_props.get('ruler')
            sign_props['fall'] = opposite_props.get('exaltation')
    
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
        
        if sign_props.get('ruler') == planet or sign_props.get('co_ruler') == planet:
            return 'domicile'
        
        # Проверяем экзальтацию
        if sign_props.get('exaltation') == planet:
            return 'exaltation'
        
        # Проверяем изгнание
        opposite_sign_props = self.get_sign_properties(OPPOSITE_SIGN_BY_SIGN.get(sign, ''))
        if opposite_sign_props.get('ruler') == planet or opposite_sign_props.get('co_ruler') == planet:
            return 'detriment'
        
        # Проверяем падение
        if opposite_sign_props.get('exaltation') == planet:
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

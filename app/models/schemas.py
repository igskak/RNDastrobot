"""
Pydantic модели для валидации данных API
"""
from pydantic import BaseModel, Field, field_validator
from datetime import date as date_type, time as time_type
from typing import Optional, List, Dict
from uuid import UUID


class BirthDataInput(BaseModel):
    """Входные данные для расчёта натальной карты"""

    date: date_type = Field(..., description="Дата рождения (YYYY-MM-DD)")
    time: time_type = Field(..., description="Время рождения (HH:MM:SS)")
    timezone: str = Field(..., description="Временная зона (например, 'America/New_York', 'Europe/Kiev')")
    
    # Место рождения - либо название, либо координаты
    place: Optional[str] = Field(None, description="Название места рождения (для геокодирования)")
    latitude: Optional[float] = Field(None, ge=-90, le=90, description="Широта (-90 до 90)")
    longitude: Optional[float] = Field(None, ge=-180, le=180, description="Долгота (-180 до 180)")
    
    # Система домов
    house_system: str = Field(default="P", description="Система домов (P=Placidus, K=Koch, W=Whole Sign и т.д.)")
    
    @field_validator('house_system')
    @classmethod
    def validate_house_system(cls, v: str) -> str:
        """Валидация системы домов"""
        valid_systems = ['P', 'K', 'O', 'R', 'C', 'E', 'W', 'X', 'H', 'T', 'B', 'M']
        if v not in valid_systems:
            raise ValueError(f'Недопустимая система домов: {v}. Допустимые: {", ".join(valid_systems)}')
        return v
    
    @field_validator('timezone')
    @classmethod
    def validate_timezone(cls, v: str) -> str:
        """Валидация временной зоны"""
        import pytz
        try:
            pytz.timezone(v)
        except pytz.exceptions.UnknownTimeZoneError:
            raise ValueError(f'Неизвестная временная зона: {v}')
        return v
    
    def model_post_init(self, __context) -> None:
        """Проверка после инициализации модели"""
        # Должны быть указаны либо place, либо координаты
        if not self.place and (self.latitude is None or self.longitude is None):
            raise ValueError('Необходимо указать либо place, либо latitude и longitude')


class PlanetPosition(BaseModel):
    """Позиция планеты"""
    name: str
    longitude: float = Field(..., ge=0, lt=360)
    latitude: float = Field(default=0.0)
    distance: float = Field(default=0.0)
    speed: float = Field(default=0.0)
    sign: str
    degree_in_sign: float = Field(..., ge=0, lt=30)
    degree_in_sign_formatted: Optional[str] = Field(None, description="Градус в формате 25°48'04\"")
    house: int = Field(..., ge=1, le=12)
    retrograde: bool = Field(default=False)
    # Новые поля из пункта 3.2 спецификации
    element: Optional[str] = Field(None, description="Стихия знака (Fire, Earth, Air, Water)")
    mode: Optional[str] = Field(None, description="Крест знака (Cardinal, Fixed, Mutable)")
    dignity: Optional[str] = Field(None, description="Достоинство планеты (domicile, exaltation, detriment, fall, neutral)")
    # Новые поля из пункта 3.4 спецификации
    strength_score: Optional[float] = Field(None, description="Сила планеты (от -20 до +50)")
    special_roles: Optional[List[str]] = Field(default=[], description="Специальные роли планеты (almuten, charioteer, doryphoros, aspect_king, handle)")
    # Новые поля характеристик (миграция 005)
    speed_percent: Optional[float] = Field(None, description="Скорость в % от средней (100% = норма)")
    critical_degrees: Optional[List[str]] = Field(default=[], description="Критические градусы: jubilee, middle, anareta, royal, destructive")
    sun_relation: Optional[str] = Field(None, description="Отношение к Солнцу: cazimi, combust, under_rays")
    in_intercepted_sign: Optional[bool] = Field(default=False, description="Планета во включённом знаке")
    is_elevated: Optional[bool] = Field(default=False, description="Элевация - самая высокая планета")
    is_peregrine: Optional[bool] = Field(default=False, description="В шахте - без мажорных аспектов")
    aspect_harmony: Optional[str] = Field(None, description="Тип аспектов: harmonious, tense, mixed")
    is_stationary: Optional[bool] = Field(default=False, description="Стационарная планета")
    stationary_type: Optional[str] = Field(None, description="Тип стационарности: SR (перед ретро), SD (перед директ)")
    karmic_score: Optional[float] = Field(None, description="Итоговый кармический статус")
    karmic_minus_score: Optional[int] = Field(default=0, description="Минусовой столбик кармического статуса")
    karmic_plus_score: Optional[int] = Field(default=0, description="Плюсовой столбик кармического статуса")
    # Миграция 007: связи планета-дом
    ruled_houses: Optional[List[int]] = Field(default=[], description="Дома, которыми управляет планета")


class HousePosition(BaseModel):
    """Позиция куспида дома"""
    number: int = Field(..., ge=1, le=12)
    longitude: float = Field(..., ge=0, lt=360)
    sign: str
    degree_in_sign: float = Field(..., ge=0, lt=30, description="Градус внутри знака (0-30)")
    degree_in_sign_formatted: Optional[str] = Field(None, description="Градус в формате 25°48'04\"")
    # Новые поля из пункта 3.2 спецификации
    ruler_planet: Optional[str] = Field(None, description="Управитель дома (планета-управитель знака на куспиде)")
    house_group: Optional[str] = Field(None, description="Группа дома (angular, succedent, cadent)")
    # Новые поля характеристик (миграция 005)
    included_sign: Optional[str] = Field(None, description="Включённый знак (знак без куспидов внутри дома)")
    co_rulers: Optional[List[str]] = Field(default=[], description="Соуправители дома")
    significator: Optional[str] = Field(None, description="Естественный сигнификатор дома")
    # Миграция 007: Связи дом-планета
    ruler_in_house: Optional[int] = Field(None, description="В каком доме находится управитель")
    planets_in_house: Optional[List[str]] = Field(default=[], description="Планеты в доме")


class AnglePosition(BaseModel):
    """Позиция угла (ASC, MC, etc.)"""
    name: str
    longitude: float = Field(..., ge=0, lt=360)
    sign: str
    degree_in_sign: float = Field(..., ge=0, lt=30)
    degree_in_sign_formatted: Optional[str] = Field(None, description="Градус в формате 25°48'04\"")


class SpecialPointPosition(BaseModel):
    """Позиция специальной точки"""
    name: str
    longitude: float = Field(..., ge=0, lt=360)
    sign: str
    degree_in_sign: float = Field(..., ge=0, lt=30)
    degree_in_sign_formatted: Optional[str] = Field(None, description="Градус в формате 25°48'04\"")
    house: int = Field(..., ge=1, le=12)


class BirthDataOutput(BaseModel):
    """Выходные данные о рождении"""
    date: str
    time: str
    timezone: str
    utc_time: str
    julian_day: float
    latitude: float
    longitude: float
    place: Optional[str] = None


class AspectInfo(BaseModel):
    """Информация об аспекте"""
    planet_1: str
    planet_2: str
    aspect_type: str
    orb: float
    is_major: bool
    harmonic_type: Optional[str] = None
    is_partile: Optional[bool] = Field(default=False, description="Партильный (точный) аспект")


class AspectInConfiguration(BaseModel):
    """Аспект внутри конфигурации с баллом"""
    planet_1: str
    planet_2: str
    aspect_type: str
    orb: float
    orb_planet_1: float
    orb_planet_2: float
    min_orb: float
    max_orb: float
    score: int  # 1, 2 или 3


class ConfigurationInfo(BaseModel):
    """Информация об аспектной конфигурации"""
    type: str
    planets_involved: List[str]
    apex_planet: Optional[str] = None
    strength_score: float
    aspects: List[AspectInConfiguration] = []


class StelliumInfo(BaseModel):
    """Информация о стеллиуме"""
    type: str  # 'house' or 'sign'
    house_number: Optional[int] = None
    sign: Optional[str] = None
    planets: List[str]
    count: int
    strength_score: float


class CosmogramPatternInfo(BaseModel):
    """Информация о фигуре Джонса"""
    pattern_type: str
    empty_arc_degree: float

    # Ключові планети (залежать від типу паттерну)
    # Bowl: leading_planet, closing_planet
    leading_planet: Optional[str] = None
    closing_planet: Optional[str] = None

    # Bucket: handle_planet або handle_planets
    handle_planet: Optional[str] = None
    handle_planets: Optional[List[str]] = None

    # Bundle: central_planet, leading_planet, closing_planet
    central_planet: Optional[str] = None

    # Seesaw: group1_leading, group1_closing, group2_leading, group2_closing
    group1_leading: Optional[str] = None
    group1_closing: Optional[str] = None
    group2_leading: Optional[str] = None
    group2_closing: Optional[str] = None

    # Splay: key_planet (планета з найбільшим статусом) + stellium_center_planet
    # Splash: key_planet (планета з найбільшим статусом)
    key_planet: Optional[str] = None
    stellium_center_planet: Optional[str] = None

    # Deprecated (для зворотної сумісності)
    anchor_planet: Optional[str] = None
    special_roles: List[str] = []


class PlanetDistributionInfo(BaseModel):
    """Информация о распределении планет"""
    min_empty_arc: float
    max_empty_arc: float
    cluster_count: int
    spread_map: Dict


class ElementBalanceInfo(BaseModel):
    """Баланс стихий"""
    fire: float
    earth: float
    air: float
    water: float


class ModeBalanceInfo(BaseModel):
    """Баланс крестов"""
    cardinal: float
    fixed: float
    mutable: float


class GenderBalanceInfo(BaseModel):
    """Баланс полов"""
    masculine: float
    feminine: float


class ZonesBalanceInfo(BaseModel):
    """Баланс зон Тримурти"""
    brahma: float
    vishnu: float
    shiva: float


class HemisphereBalanceInfo(BaseModel):
    """Баланс полусфер"""
    northern: float
    southern: float
    eastern: float
    western: float


class QuadrantBalanceInfo(BaseModel):
    """Баланс квадрантов"""
    q1: float
    q2: float
    q3: float
    q4: float


class HouseGroupBalanceInfo(BaseModel):
    """Баланс групп домов"""
    angular: float
    succedent: float
    cadent: float


class BalancesInfo(BaseModel):
    """Все интегральные балансы (пункт 3.5 спецификации)"""
    element_balance: Optional[ElementBalanceInfo] = None
    mode_balance: Optional[ModeBalanceInfo] = None
    gender_balance: Optional[GenderBalanceInfo] = None
    zones_balance: Optional[ZonesBalanceInfo] = None
    hemisphere_balance: Optional[HemisphereBalanceInfo] = None
    quadrant_balance: Optional[QuadrantBalanceInfo] = None
    house_group_balance: Optional[HouseGroupBalanceInfo] = None


class NatalChartResponse(BaseModel):
    """Полный ответ с натальной картой"""
    user_id: Optional[UUID] = None
    birth_data: BirthDataOutput
    planets: List[PlanetPosition]
    houses: List[HousePosition]
    angles: Dict[str, AnglePosition]
    special_points: Dict[str, SpecialPointPosition]
    configurations: Optional[Dict[str, Dict]] = None
    # Новые поля из пункта 3.3 спецификации
    aspects: Optional[List[AspectInfo]] = None
    aspect_configurations: Optional[List[ConfigurationInfo]] = None
    stelliums: Optional[List[StelliumInfo]] = None
    cosmogram_pattern: Optional[CosmogramPatternInfo] = None
    planet_distribution: Optional[PlanetDistributionInfo] = None
    # Новые поля из пункта 3.5 спецификации
    balances: Optional[BalancesInfo] = None


# ============================================================================
# General Overview (Этап 5 - Общий срез)
# ============================================================================

class AscConjunctionInfo(BaseModel):
    """Информация о планете в соединении с ASC"""
    planet: str
    orb: float
    applying: Optional[bool] = None


class AscRulerInfo(BaseModel):
    """Информация об управителе ASC"""
    planet: str
    sign: str
    house: int
    aspects: List[Dict] = []


class GeneralOverviewResponse(BaseModel):
    """Полный общий срез натальной карты (Этап 5)"""
    user_id: UUID
    # ASC блок
    asc_sign: Optional[str] = None
    asc_degree: Optional[float] = None
    asc_element: Optional[str] = None
    asc_mode: Optional[str] = None
    asc_zone: Optional[str] = None
    asc_conjunctions: Optional[List[AscConjunctionInfo]] = None
    asc_ruler: Optional[AscRulerInfo] = None
    # Светила
    sun_sign: Optional[str] = None
    sun_house: Optional[int] = None
    sun_aspects: Optional[List[Dict]] = None
    moon_sign: Optional[str] = None
    moon_house: Optional[int] = None
    moon_aspects: Optional[List[Dict]] = None
    # Космограмма
    cosmogram_pattern: Optional[str] = None
    cosmogram_anchor_planet: Optional[str] = None
    cosmogram_empty_arc: Optional[float] = None  # Пустая дуга в градусах
    # Конфигурации и стеллиумы
    main_configurations: Optional[List[Dict]] = None
    main_stelliums: Optional[List[Dict]] = None
    # Доминанты
    dominant_element: Optional[str] = None
    dominant_mode: Optional[str] = None
    dominant_zone: Optional[str] = None
    dominant_hemisphere: Optional[str] = None
    dominant_gender: Optional[str] = None  # Masculine/Feminine (бинер)
    angularity_ratio: Optional[float] = None
    notes: Optional[str] = None


class ErrorResponse(BaseModel):
    """Ответ с ошибкой"""
    error: str
    detail: Optional[str] = None


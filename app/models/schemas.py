"""
Pydantic модели для валидации данных API
"""
from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import date as date_type, time as time_type
from typing import Any, Optional, List, Dict
from uuid import UUID

VALID_HOUSE_SYSTEMS = ['P', 'K', 'O', 'R', 'C', 'E', 'W', 'X', 'H', 'T', 'B', 'M']
VALID_AYANAMSHAS = frozenset({'lahiri', 'fagan_bradley', 'krishnamurti', 'raman', 'de_luce'})
HOUSE_SYSTEM_ALIASES = {
    'P': 'P',
    'K': 'K',
    'O': 'O',
    'R': 'R',
    'C': 'C',
    'E': 'E',
    'W': 'W',
    'X': 'X',
    'H': 'H',
    'T': 'T',
    'B': 'B',
    'M': 'M',
    'PLACIDUS': 'P',
    'KOCH': 'K',
    'PORPHYRY': 'O',
    'REGIOMONTANUS': 'R',
    'CAMPANUS': 'C',
    'EQUAL': 'E',
    'WHOLE_SIGN': 'W',
    'WHOLESIGN': 'W',
    'AXIAL_ROTATION': 'X',
    'HORIZONTAL': 'H',
    'TOPOCENTRIC': 'T',
    'ALCABITIUS': 'B',
    'MORINUS': 'M',
}


def normalize_house_system_code(value: str) -> str:
    """Нормализовать код/название системы домов к 1-буквенному коду Swiss Ephemeris."""
    normalized = str(value or '').strip().upper().replace('-', '_').replace(' ', '_')
    return HOUSE_SYSTEM_ALIASES.get(normalized, normalized)


class BirthDataInput(BaseModel):
    """Входные данные для расчёта натальной карты"""

    first_name: Optional[str] = Field(None, description="Имя пользователя")
    last_name: Optional[str] = Field(None, description="Фамилия пользователя")
    date: date_type = Field(..., description="Дата рождения (YYYY-MM-DD)")
    time: time_type = Field(..., description="Время рождения (HH:MM:SS)")
    timezone: str = Field(..., description="Временная зона (например, 'America/New_York', 'Europe/Kiev')")

    @field_validator('first_name', 'last_name', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v.strip() if isinstance(v, str) else v
    
    # Место рождения - либо название, либо координаты
    place: Optional[str] = Field(None, description="Название места рождения (для геокодирования)")
    latitude: Optional[float] = Field(None, ge=-90, le=90, description="Широта (-90 до 90)")
    longitude: Optional[float] = Field(None, ge=-180, le=180, description="Долгота (-180 до 180)")
    
    # Система домов
    house_system: str = Field(default="P", description="Система домов (P=Placidus, K=Koch, W=Whole Sign и т.д.)")

    # Зодиак
    zodiac: str = Field(default="tropical", description="Зодиак: tropical или sidereal")
    ayanamsha: str = Field(default="lahiri", description="Аянамша для сидерического зодиака")

    # CRM contact fields (optional, used by PUT /users/{id})
    email: Optional[str] = Field(None, description="Email клиента")
    phone: Optional[str] = Field(None, description="Телефон клиента")
    messenger: Optional[str] = Field(None, description="Мессенджер (Telegram, WhatsApp и т.д.)")
    tags: Optional[List[str]] = Field(None, description="Теги клиента")
    notes: Optional[str] = Field(None, description="Заметки астролога о клиенте")
    
    @field_validator('house_system')
    @classmethod
    def validate_house_system(cls, v: str) -> str:
        """Валидация системы домов"""
        code = normalize_house_system_code(v)
        if code not in VALID_HOUSE_SYSTEMS:
            raise ValueError(f'Недопустимая система домов: {v}. Допустимые: {", ".join(VALID_HOUSE_SYSTEMS)}')
        return code

    @field_validator('zodiac')
    @classmethod
    def validate_zodiac(cls, v: str) -> str:
        code = (v or 'tropical').strip().lower()
        if code not in ('tropical', 'sidereal'):
            raise ValueError(f'Недопустимый зодиак: {v}. Допустимые: tropical, sidereal')
        return code

    @field_validator('ayanamsha')
    @classmethod
    def validate_ayanamsha(cls, v: str) -> str:
        code = (v or 'lahiri').strip().lower()
        if code not in VALID_AYANAMSHAS:
            raise ValueError(f'Недопустимая аянамша: {v}. Допустимые: {", ".join(sorted(VALID_AYANAMSHAS))}')
        return code
    
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
    speed_percent: Optional[float] = Field(None, description="Скорость в % от средней (100% = средняя)")
    critical_degrees: Optional[List[str]] = Field(default=[], description="Критические градусы: jubilee, middle, anareta, royal, destructive")
    sun_relation: Optional[str] = Field(None, description="Отношение к Солнцу: cazimi, combust, under_rays")
    declination: Optional[float] = Field(None, description="Склонение (°), экваториальная координата")
    out_of_bounds: Optional[bool] = Field(None, description="Планета вне границ склонения Солнца (|dec| > наклонности)")
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
    ruler_groups: Optional[List[Dict[str, Any]]] = Field(default=[], description="Группы управителей дома по куспиду и включённому знаку")
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
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date: str
    time: str
    timezone: str
    utc_time: str
    julian_day: float
    latitude: float
    longitude: float
    place: Optional[str] = None
    house_system: str = "P"
    zodiac: str = "tropical"
    ayanamsha: Optional[str] = None


class AspectInfo(BaseModel):
    """Информация об аспекте"""
    planet_1: str
    planet_2: str
    left_planet: Optional[str] = Field(None, description="Левая планета в нормализованной паре для отображения")
    right_planet: Optional[str] = Field(None, description="Правая планета в нормализованной паре для отображения")
    left_rank: Optional[int] = Field(None, description="Позиция левой планеты в порядке аспектной сетки")
    right_rank: Optional[int] = Field(None, description="Позиция правой планеты в порядке аспектной сетки")
    aspect_type: str
    orb: float
    is_major: bool
    applying: Optional[bool] = Field(default=None, description="True = сходящийся, False = расходящийся")
    harmonic_type: Optional[str] = None
    is_partile: Optional[bool] = Field(default=False, description="Партильный (точный) аспект")


class AspectInConfiguration(BaseModel):
    """Аспект внутри конфигурации с баллом"""
    planet_1: str
    planet_2: str
    aspect_type: str
    orb: float
    applying: Optional[bool] = Field(default=None, description="True = сходящийся, False = расходящийся")
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


class KarmicAspectInfo(BaseModel):
    """Аспект между планетами для кармического read-model."""
    planet_1: str
    planet_2: str
    aspect_type: str
    orb: Optional[float] = None


class KarmicNodeInfo(BaseModel):
    """Агрегированный анализ лунного узла."""
    sign: Optional[str] = None
    house: Optional[int] = None
    dispositor_planet: Optional[str] = None
    conjunctions_orb3: List[str] = Field(default_factory=list)
    helper_planets: List[str] = Field(default_factory=list)
    blocker_planets: List[str] = Field(default_factory=list)


class KarmicNodesInfo(BaseModel):
    """Анализ северного и южного узлов."""
    north_node: KarmicNodeInfo
    south_node: KarmicNodeInfo


class SaturnAnalysisInfo(BaseModel):
    """Анализ Сатурна в кармическом контексте."""
    sign: Optional[str] = None
    house: Optional[int] = None
    dispositor_planet: Optional[str] = None
    helper_planets: List[str] = Field(default_factory=list)
    blocker_planets: List[str] = Field(default_factory=list)


class LunarPointAnalysisInfo(BaseModel):
    """Анализ фиктивной лунной точки."""
    sign: Optional[str] = None
    house: Optional[int] = None
    dispositor_planet: Optional[str] = None
    aspected_planets: List[str] = Field(default_factory=list)


class LunarPointsAnalysisInfo(BaseModel):
    """Анализ Лилит и Селены."""
    black_moon: LunarPointAnalysisInfo
    white_moon: LunarPointAnalysisInfo


class KarmicStatusInfo(BaseModel):
    """Срез кармического статуса планет."""
    support_planets_plus_3: List[str] = Field(default_factory=list)
    development_planets_minus_3: List[str] = Field(default_factory=list)
    top_karmic_planets: List[str] = Field(default_factory=list)


class KarmicSupportInfo(BaseModel):
    """Кармическая поддержка и ресурсы."""
    first_house_planets: List[str] = Field(default_factory=list)
    domicile_or_exaltation_planets: List[str] = Field(default_factory=list)
    south_node_sign_dispositor: Optional[str] = None
    charioteer_planet: Optional[str] = None
    harmonic_trines: List[KarmicAspectInfo] = Field(default_factory=list)
    stelliums: List[StelliumInfo] = Field(default_factory=list)


class KarmicDevelopmentInfo(BaseModel):
    """Кармические задачи и зоны развития."""
    north_node_sign_dispositor: Optional[str] = None
    doryphoros_planet: Optional[str] = None
    black_moon_dispositor: Optional[str] = None
    challenging_aspects: List[KarmicAspectInfo] = Field(default_factory=list)


class KarmicJonesPatternInfo(BaseModel):
    """Jones pattern блок для кармического read-model."""
    type: Optional[str] = None
    leading_planet: Optional[str] = None
    handle_planet: Optional[str] = None


class KarmicAnalysisInfo(BaseModel):
    """Полный backend-ready кармический read-model."""
    nodes: KarmicNodesInfo
    saturn_analysis: SaturnAnalysisInfo
    lunar_points_analysis: LunarPointsAnalysisInfo
    karmic_status: KarmicStatusInfo
    karmic_support: KarmicSupportInfo
    karmic_development: KarmicDevelopmentInfo
    jones_pattern: KarmicJonesPatternInfo


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
    """Баланс полусферы"""
    lower: float
    upper: float
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


class BalanceSetInfo(BaseModel):
    """Набор интегральных балансов для одного способа расчёта"""
    element_balance: Optional[ElementBalanceInfo] = None
    mode_balance: Optional[ModeBalanceInfo] = None
    gender_balance: Optional[GenderBalanceInfo] = None
    zones_balance: Optional[ZonesBalanceInfo] = None
    hemisphere_balance: Optional[HemisphereBalanceInfo] = None
    quadrant_balance: Optional[QuadrantBalanceInfo] = None
    house_group_balance: Optional[HouseGroupBalanceInfo] = None


class BalancesInfo(BaseModel):
    """Все интегральные балансы по двум базам расчёта"""
    by_sign: Optional[BalanceSetInfo] = None
    by_house: Optional[BalanceSetInfo] = None


class NatalChartResponse(BaseModel):
    """Полный ответ с натальной картой"""
    user_id: Optional[UUID] = None
    title: Optional[str] = None
    display_title: Optional[str] = None
    birth_data: BirthDataOutput
    planets: List[PlanetPosition]
    houses: List[HousePosition]
    angles: Dict[str, AnglePosition]
    special_points: Dict[str, SpecialPointPosition]
    configurations: Optional[Dict[str, Dict]] = None
    # Новые поля из пункта 3.3 спецификации
    aspects: Optional[List[AspectInfo]] = None
    aspect_configurations: Optional[List[ConfigurationInfo]] = None
    declination_aspects: Optional[List[Dict[str, Any]]] = Field(None, description="Деклинационные аспекты: параллели/контрпараллели")
    stelliums: Optional[List[StelliumInfo]] = None
    cosmogram_pattern: Optional[CosmogramPatternInfo] = None
    planet_distribution: Optional[PlanetDistributionInfo] = None
    # Новые поля из пункта 3.5 спецификации
    balances: Optional[BalancesInfo] = None
    # Агрегированный кармический read-model для AI/UI
    karmic_analysis: KarmicAnalysisInfo


class RelatedPersonLinkRequest(BaseModel):
    """Link an existing client to the current client for synastry."""
    related_user_id: UUID
    relation_label: Optional[str] = Field(None, max_length=100)
    relation_notes: Optional[str] = None

    @field_validator('relation_label', 'relation_notes', mode='before')
    @classmethod
    def normalize_optional_text(cls, value):
        if isinstance(value, str):
            normalized = value.strip()
            return normalized or None
        return value


class RelatedPersonCreateRequest(BirthDataInput):
    """Create a full natal chart for a new related person and link them."""
    relation_label: Optional[str] = Field(None, max_length=100)
    relation_notes: Optional[str] = None

    @field_validator('relation_label', 'relation_notes', mode='before')
    @classmethod
    def normalize_optional_relation_text(cls, value):
        if isinstance(value, str):
            normalized = value.strip()
            return normalized or None
        return value


class RelatedPersonResponse(BaseModel):
    """Serialized related-person link for client profile UI."""
    user_id: UUID
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    birth_date: Optional[str] = None
    birth_time: Optional[str] = None
    birth_place: Optional[str] = None
    timezone: Optional[str] = None
    relation_label: Optional[str] = None
    relation_notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class SynastryAspectInfo(BaseModel):
    """Cross-chart aspect between the primary client and related person."""
    planet_1: str
    planet_2: str
    left_planet: Optional[str] = None
    right_planet: Optional[str] = None
    left_rank: Optional[int] = None
    right_rank: Optional[int] = None
    aspect_type: str
    orb: float
    is_major: bool
    applying: Optional[bool] = None
    harmonic_type: Optional[str] = None
    is_partile: Optional[bool] = False
    chart_1: str
    chart_2: str
    object_1_type: Optional[str] = None
    object_2_type: Optional[str] = None
    object_1_sign: Optional[str] = None
    object_2_sign: Optional[str] = None
    object_1_house: Optional[int] = None
    object_2_house: Optional[int] = None


class HouseOverlayItem(BaseModel):
    """Placement of one body from chart A into houses of chart B."""
    body_name: str
    body_type: str
    sign: Optional[str] = None
    degree_in_sign: Optional[float] = None
    degree_in_sign_formatted: Optional[str] = None
    natal_house: Optional[int] = None
    overlay_house: int


class HouseOverlaySet(BaseModel):
    """Both house-overlay directions for synastry."""
    primary_in_partner_houses: List[HouseOverlayItem] = Field(default_factory=list)
    partner_in_primary_houses: List[HouseOverlayItem] = Field(default_factory=list)


class SynastryResponse(BaseModel):
    """Full synastry workspace payload."""
    primary_chart: NatalChartResponse
    partner_chart: NatalChartResponse
    inter_aspects: List[SynastryAspectInfo] = Field(default_factory=list)
    house_overlays: HouseOverlaySet
    resolved_preferences: Dict[str, Any] = Field(default_factory=dict)


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
    error_code: str
    message: str
    detail: Optional[Any] = None
    # Legacy alias for backward compatibility with old clients
    error: Optional[str] = None


class AccountPreferencesPatchRequest(BaseModel):
    """Partial update for astrologer-level preferences."""
    chart_defaults: Optional[Dict[str, Any]] = None
    methodology: Optional[Dict[str, Any]] = None
    visual: Optional[Dict[str, Any]] = None
    chart_creation_defaults: Optional[Dict[str, Any]] = None


class AccountPreferencesResponse(BaseModel):
    """Full account-level preferences payload."""
    version: int
    chart_defaults: Dict[str, Any]
    methodology: Dict[str, Any]
    visual: Dict[str, Any]
    chart_creation_defaults: Dict[str, Any]
    default_house_system: str


class PreferencesMetadataResponse(BaseModel):
    """Metadata required to render methodology + visual editors."""
    aspect_types: List[Dict[str, Any]]
    bodies: List[Dict[str, Any]]
    signs: List[Dict[str, Any]]
    default_balance_targets: Dict[str, Any]
    default_visual_palettes: Dict[str, Any]
    default_dignities: Dict[str, Any]


class ChartViewOverrideUpsertRequest(BaseModel):
    """Upsert sparse per-chart overrides."""
    chart_kind: str
    chart_id: UUID
    view_type: str
    overrides: Dict[str, Any] = Field(default_factory=dict)


class ResolvedPreferencesResponse(BaseModel):
    """Resolved account defaults + chart-specific overrides for a view."""
    chart_kind: str
    chart_id: UUID
    view_type: str
    account_defaults: Dict[str, Any]
    overrides: Dict[str, Any]
    resolved: Dict[str, Any]
    chart_meta: Dict[str, Any]


class PreferenceRecalcJobCreateRequest(BaseModel):
    """Create a methodology recalculation job."""
    job_type: str = Field(default='methodology_recalc')
    payload: Dict[str, Any] = Field(default_factory=dict)


class PreferenceRecalcJobResponse(BaseModel):
    """Serialized preference recalculation job."""
    job_id: UUID
    astrologer_id: UUID
    job_type: str
    status: str
    progress_total: int
    progress_done: int
    failed_count: int
    payload: Dict[str, Any]
    error: Optional[str] = None
    created_at: Optional[str] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None


class HouseSystemUpdateRequest(BaseModel):
    """Persisted house-system update for an existing natal chart."""
    house_system: str = Field(..., description="Система домов")

    @field_validator('house_system')
    @classmethod
    def validate_house_system(cls, v: str) -> str:
        code = normalize_house_system_code(v)
        if code not in VALID_HOUSE_SYSTEMS:
            raise ValueError(f'Недопустимая система домов: {v}. Допустимые: {", ".join(VALID_HOUSE_SYSTEMS)}')
        return code


class ZodiacUpdateRequest(BaseModel):
    """Persisted zodiac/ayanamsha update for an existing natal chart."""
    zodiac: str = Field(..., description="Зодиак: tropical или sidereal")
    ayanamsha: str = Field(default="lahiri", description="Аянамша для сидерического зодиака")

    @field_validator('zodiac')
    @classmethod
    def validate_zodiac(cls, v: str) -> str:
        code = (v or 'tropical').strip().lower()
        if code not in ('tropical', 'sidereal'):
            raise ValueError(f'Недопустимый зодиак: {v}. Допустимые: tropical, sidereal')
        return code

    @field_validator('ayanamsha')
    @classmethod
    def validate_ayanamsha(cls, v: str) -> str:
        code = (v or 'lahiri').strip().lower()
        if code not in VALID_AYANAMSHAS:
            raise ValueError(f'Недопустимая аянамша: {v}. Допустимые: {", ".join(sorted(VALID_AYANAMSHAS))}')
        return code


class ResetViewToDefaultsRequest(BaseModel):
    """Reset one view to account defaults."""
    view_type: str = Field(..., description="Тип экрана: natal, biwheel или forecast_new")


# ============================================================================
# SOLAR RETURN (Соляр)
# ============================================================================

class SolarReturnRequest(BaseModel):
    """Запрос на расчёт соляра.

    Источник натала — ровно один из ``user_id`` (сохранённый клиент) либо ``natal`` (inline).
    """
    user_id: Optional[UUID] = Field(
        None, description="UUID сохранённого клиента. Взаимоисключающе с `natal`."
    )
    natal: Optional[BirthDataInput] = Field(
        None, description="Inline данные рождения (ephemeral). Взаимоисключающе с `user_id`."
    )
    year: int = Field(..., ge=1900, le=2100, description="Год соляра")
    name: Optional[str] = Field(None, max_length=160, description="Название сохранённого соляра")

    # Место соляра (опционально, по умолчанию = место рождения)
    location_latitude: Optional[float] = Field(None, ge=-90, le=90, description="Широта места соляра")
    location_longitude: Optional[float] = Field(None, ge=-180, le=180, description="Долгота места соляра")
    location_name: Optional[str] = Field(None, description="Название места соляра")
    location_source_id: Optional[str] = Field(None, description="source_id из /places/autocomplete")
    location_timezone: Optional[str] = Field(None, description="IANA timezone места соляра")

    # Параметры расчёта
    house_system: str = Field(default="P", description="Система домов")
    save_to_db: bool = Field(default=True, description="Сохранить результат в БД")

    @field_validator('house_system')
    @classmethod
    def validate_house_system(cls, v: str) -> str:
        code = normalize_house_system_code(v)
        if code not in VALID_HOUSE_SYSTEMS:
            raise ValueError(f'Недопустимая система домов: {v}')
        return code

    @model_validator(mode='after')
    def exactly_one_source(self):
        if bool(self.user_id) == bool(self.natal):
            raise ValueError("Укажите ровно один источник натала: `user_id` или `natal`")
        # inline-натал ephemeral: в БД не сохраняем (нет user_id)
        if self.natal is not None:
            self.save_to_db = False
        return self


class SolarLocationInfo(BaseModel):
    """Информация о месте соляра"""
    latitude: float
    longitude: float
    name: Optional[str] = None


class SolarInfo(BaseModel):
    """Информация о соляре"""
    year: int
    solar_datetime_utc: str
    solar_datetime_local: str
    julian_day: float
    natal_sun_longitude: float
    location: SolarLocationInfo
    house_system: str
    timezone: str


class SolarBirthData(BaseModel):
    """Данные рождения для соляра"""
    user_id: Optional[str] = None   # None для inline-натала (ephemeral)
    birth_date: str
    birth_time: Optional[str] = None
    birth_place: Optional[str] = None


class SolarReturnNatalAspectInfo(BaseModel):
    """Аспект солярного объекта к натальному объекту."""
    planet_1: str
    planet_2: str
    left_planet: Optional[str] = None
    right_planet: Optional[str] = None
    solar_planet: str
    natal_object: str
    natal_object_type: str
    aspect_type: str
    orb: float
    is_exact: bool = False
    is_major: bool
    harmonic_type: Optional[str] = None
    applying: Optional[bool] = None


class SolarReturnResponse(BaseModel):
    """Полный ответ с соларной картой"""
    solar_id: Optional[UUID] = None
    name: Optional[str] = None
    solar_info: SolarInfo
    birth_data: SolarBirthData
    planets: List[PlanetPosition]
    houses: List[HousePosition]
    angles: Dict[str, AnglePosition]
    aspects: Optional[List[AspectInfo]] = None
    aspects_to_natal: Optional[List[SolarReturnNatalAspectInfo]] = None
    aspect_configurations: Optional[List[ConfigurationInfo]] = None
    stelliums: Optional[List[StelliumInfo]] = None
    cosmogram_pattern: Optional[CosmogramPatternInfo] = None
    planet_distribution: Optional[PlanetDistributionInfo] = None
    balances: Optional[BalancesInfo] = None


class SolarReturnListItem(BaseModel):
    """Элемент списка соляров"""
    solar_id: Optional[str] = None
    name: Optional[str] = None
    year: int
    solar_datetime: Optional[str] = None
    location_name: Optional[str] = None


class SolarReturnListResponse(BaseModel):
    """Список соляров пользователя"""
    user_id: UUID
    solar_returns: List[SolarReturnListItem]


class SolarReturnUpdateRequest(BaseModel):
    """Обновление метаданных сохранённого соляра"""
    name: Optional[str] = Field(None, max_length=160, description="Название сохранённого соляра")

    @field_validator('name')
    @classmethod
    def normalize_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        normalized = v.strip()
        return normalized or None

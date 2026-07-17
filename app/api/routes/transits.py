"""
API эндпоинты для работы с транзитами
"""
from fastapi import APIRouter, HTTPException, status, Depends, Request
from sqlalchemy.orm import Session
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import date as date_type, time as time_type
from typing import List, Literal, Optional

from app.services.transit_service import TransitService
from app.services.aspect_dynamics_service import AspectDynamicsService
from app.services.natal_chart_service import NatalChartService
from app.services.natal_chart_cache import calculate_natal_chart_cached
from app.services.natal_context import NatalContext
from app.models.schemas import BirthDataInput
from app.database.connection import get_db
from app.auth.dependencies import AuthContext, ensure_client_access, require_auth
from app.utils.ephemeris import get_ephemeris_path
from loguru import logger

router = APIRouter()

# Путь к эфемеридам
EPHE_PATH = get_ephemeris_path()


# === Pydantic Schemas ===

class TransitRequest(BaseModel):
    """Входные данные для расчёта транзитов.

    Источник натала — ровно один из:
      - ``user_id``: сохранённый клиент (DB-путь);
      - ``natal``: inline данные рождения (ephemeral, без записи в БД) — план D3.
    """
    user_id: Optional[UUID] = Field(
        None, description="ID сохранённого клиента. Взаимоисключающе с `natal`."
    )
    natal: Optional[BirthDataInput] = Field(
        None, description="Inline данные рождения (ephemeral). Взаимоисключающе с `user_id`."
    )
    date: date_type = Field(..., description="Дата транзита (YYYY-MM-DD)")
    time: time_type = Field(..., description="Время транзита (HH:MM:SS)")
    timezone: str = Field(..., description="Часовой пояс (например, 'Europe/Kiev')")
    location: Optional[str] = Field(None, description="Место транзита")
    latitude: Optional[float] = Field(None, ge=-90, le=90, description="Широта места транзита")
    longitude: Optional[float] = Field(None, ge=-180, le=180, description="Долгота места транзита")

    @field_validator('timezone')
    @classmethod
    def validate_timezone(cls, v: str) -> str:
        import pytz
        try:
            pytz.timezone(v)
        except pytz.exceptions.UnknownTimeZoneError:
            raise ValueError(f'Неизвестная временная зона: {v}')
        return v

    @model_validator(mode='after')
    def exactly_one_source(self):
        if bool(self.user_id) == bool(self.natal):
            raise ValueError("Укажите ровно один источник натала: `user_id` или `natal`")
        return self


class TransitPlanetInfo(BaseModel):
    """Информация о транзитной планете"""
    name: str
    longitude: float
    sign: str
    degree_in_sign: float
    degree_in_sign_formatted: str
    retrograde: bool
    speed: float
    speed_percent: Optional[float] = Field(None, description="Скорость в % от средней (может быть > 100)")
    is_stationary: bool = Field(default=False, description="Стационарная планета")
    stationary_type: Optional[str] = Field(None, description="Тип стационарности")
    natal_house: int = Field(..., description="В каком натальном доме находится транзитная планета")
    house: Optional[int] = Field(None, description="В каком доме транзитной карты находится планета")


class TransitAspectInfo(BaseModel):
    """Информация об аспекте транзит→натал"""
    transit_planet: str
    natal_object: str
    natal_object_type: str
    aspect_type: str
    orb: float
    max_allowed_orb: Optional[float] = Field(default=None, description="Допустимый орбис для пары")
    is_exact: bool = Field(default=False, description="Точный аспект (±15 минут дуги)")
    is_major: bool
    harmonic_type: Optional[str] = None


class TransitInfoBlock(BaseModel):
    """Метаданные транзитного момента"""
    date: str
    time: str
    timezone: str
    utc_time: str
    julian_day: float
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class TransitHouseInfo(BaseModel):
    """Информация о доме транзитной карты"""
    number: int
    longitude: float
    sign: Optional[str] = None
    degree_in_sign: Optional[float] = None
    degree_in_sign_formatted: Optional[str] = None


class TransitResponse(BaseModel):
    """Ответ с данными транзитов"""
    transit_info: TransitInfoBlock
    transit_planets: List[TransitPlanetInfo]
    transit_houses: List[TransitHouseInfo] = Field(default_factory=list)
    aspects: List[TransitAspectInfo]


# === Schemas для транзитов на период ===

class TransitPeriodRequest(BaseModel):
    """Входные данные для поиска транзитных событий на период"""
    user_id: UUID = Field(..., description="ID пользователя с сохранённой натальной картой")
    start_date: date_type = Field(..., description="Начало периода (YYYY-MM-DD)")
    end_date: date_type = Field(..., description="Конец периода (YYYY-MM-DD)")
    timezone: str = Field(..., description="Часовой пояс (например, 'Europe/Kiev')")
    step_hours: int = Field(6, ge=1, le=24, description="Шаг сканирования в часах (1-24)")
    transit_bodies: Optional[List[str]] = Field(None, description="Фильтр транзитных планет")
    natal_bodies: Optional[List[str]] = Field(None, description="Фильтр натальных объектов")
    aspect_types: Optional[List[str]] = Field(None, description="Фильтр типов аспектов")

    @field_validator('timezone')
    @classmethod
    def validate_timezone(cls, v: str) -> str:
        import pytz
        try:
            pytz.timezone(v)
        except pytz.exceptions.UnknownTimeZoneError:
            raise ValueError(f'Неизвестная временная зона: {v}')
        return v

    @field_validator('end_date')
    @classmethod
    def validate_end_date(cls, v: date_type, info) -> date_type:
        start = info.data.get('start_date')
        if start and v < start:
            raise ValueError('end_date должен быть >= start_date')
        return v


class TransitEventInfo(BaseModel):
    """Информация о транзитном событии (интервал аспекта)"""
    transit_body: str
    natal_body: str
    natal_type: str
    aspect_type: str
    t_enter: str = Field(..., description="Момент входа в орбис (ISO)")
    t_exact: str = Field(..., description="Точный момент аспекта (ISO)")
    t_leave: str = Field(..., description="Момент выхода из орбиса (ISO)")
    min_orb: float = Field(..., description="Минимальный орбис (градусы)")
    max_allowed_orb: float = Field(..., description="Допустимый орбис для пары")
    is_exact: bool = Field(default=False, description="Точный аспект (±15 минут дуги)")
    is_major: bool
    harmonic_type: Optional[str] = None


class TransitPeriodResponse(BaseModel):
    """Ответ с событиями транзитов на период"""
    period: dict = Field(..., description="Информация о периоде")
    events: List[TransitEventInfo]
    total_events: int


class AspectDynamicsSourceInput(BaseModel):
    """Источник карты для universal aspect dynamics."""

    user_id: Optional[UUID] = Field(None, description="ID сохранённого клиента")
    natal: Optional[BirthDataInput] = Field(
        None,
        description="Inline данные рождения",
    )

    @model_validator(mode='after')
    def exactly_one_source(self):
        if bool(self.user_id) == bool(self.natal):
            raise ValueError(
                "Укажите ровно один источник карты: `user_id` или `natal`"
            )
        return self


class AspectDynamicsRequest(BaseModel):
    """Входные данные для графика динамики одного аспекта.

    Backward-compatible legacy fields:
    - user_id + transit_body + natal_body still mean transit->natal.

    Universal v2 fields:
    - method: natal/transit/progression/direction/solar_return/synastry_partner
    - source_body/target_body: left/right objects in the aspect
    - natal: inline primary chart source
    - partner: synastry partner source
    """
    user_id: Optional[UUID] = Field(
        None,
        description="ID основной сохранённой карты",
    )
    natal: Optional[BirthDataInput] = Field(
        None,
        description="Inline источник основной карты",
    )
    partner: Optional[AspectDynamicsSourceInput] = Field(
        None,
        description="Источник партнёра для синастрии",
    )
    method: Literal[
        "natal",
        "transit",
        "progression",
        "direction",
        "solar_return",
        "synastry_partner",
    ] = Field("transit", description="Тип слоя/методики")
    source_body: Optional[str] = Field(
        None,
        min_length=1,
        description="Движущийся/левый объект аспекта",
    )
    target_body: Optional[str] = Field(
        None,
        min_length=1,
        description="Целевой/правый объект аспекта",
    )
    transit_body: Optional[str] = Field(
        None,
        min_length=1,
        description="Legacy alias для source_body",
    )
    natal_body: Optional[str] = Field(
        None,
        min_length=1,
        description="Legacy alias для target_body",
    )
    aspect_type: str = Field(..., min_length=1, description="Тип аспекта")
    selected_date: date_type = Field(..., description="Выбранная дата (YYYY-MM-DD)")
    selected_time: time_type = Field(..., description="Выбранное время (HH:MM:SS)")
    timezone: str = Field(..., description="Часовой пояс")
    contact_start: Optional[date_type] = Field(None, description="Опциональное начало окна")
    contact_end: Optional[date_type] = Field(None, description="Опциональный конец окна")
    direction_type: Optional[
        Literal["solar_arc", "zodiacal", "symbolic", "equatorial"]
    ] = Field(
        "zodiacal",
        description="Тип дирекции для method=direction",
    )
    solar_year: Optional[int] = Field(
        None,
        ge=1900,
        le=2100,
        description="Год соляра",
    )
    solar_location_latitude: Optional[float] = Field(None, ge=-90, le=90)
    solar_location_longitude: Optional[float] = Field(None, ge=-180, le=180)
    solar_location_timezone: Optional[str] = Field(None)
    max_points: int = Field(
        320,
        ge=2,
        le=1200,
        description="Максимум точек графика",
    )
    preview: bool = Field(
        False,
        description="Быстрый предварительный график без полного поиска контактов",
    )

    @field_validator('timezone')
    @classmethod
    def validate_timezone(cls, v: str) -> str:
        import pytz
        try:
            pytz.timezone(v)
        except pytz.exceptions.UnknownTimeZoneError:
            raise ValueError(f'Неизвестная временная зона: {v}')
        return v

    @model_validator(mode='after')
    def validate_contact_window(self):
        if bool(self.user_id) == bool(self.natal):
            raise ValueError(
                "Укажите ровно один источник основной карты: "
                "`user_id` или `natal`"
            )
        if not (self.source_body or self.transit_body):
            raise ValueError("source_body или transit_body обязательны")
        if not (self.target_body or self.natal_body):
            raise ValueError("target_body или natal_body обязательны")
        if self.method == "synastry_partner" and self.partner is None:
            raise ValueError("partner обязателен для method=synastry_partner")
        if bool(self.contact_start) != bool(self.contact_end):
            raise ValueError(
                "contact_start и contact_end должны быть указаны вместе"
            )
        if (
            self.contact_start
            and self.contact_end
            and self.contact_end < self.contact_start
        ):
            raise ValueError("contact_end должен быть >= contact_start")
        return self

    @property
    def resolved_source_body(self) -> str:
        return self.source_body or self.transit_body or ""

    @property
    def resolved_target_body(self) -> str:
        return self.target_body or self.natal_body or ""

    @property
    def is_legacy_transit_request(self) -> bool:
        return (
            self.method == "transit"
            and not self.preview
            and self.natal is None
            and self.partner is None
            and self.source_body is None
            and self.target_body is None
            and self.user_id is not None
            and self.transit_body is not None
            and self.natal_body is not None
            and self.direction_type in (None, "zodiacal")
            and self.solar_year is None
            and self.solar_location_latitude is None
            and self.solar_location_longitude is None
            and self.solar_location_timezone is None
        )


class AspectDynamicsPoint(BaseModel):
    """Точка signed-orb графика."""
    datetime: str
    julian_day: float
    signed_orb: Optional[float] = None
    abs_orb: Optional[float] = None
    strength: float
    in_orb: bool


class AspectDynamicsPass(BaseModel):
    date: str
    motion: str
    orb: float


class AspectDynamicsStation(BaseModel):
    date: str
    type: str


class AspectDynamicsClosestApproach(BaseModel):
    date: str
    orb: float


class AspectDynamicsContact(BaseModel):
    enter: str
    enter_complete: bool
    leave: str
    leave_complete: bool
    exact_pass_count: int
    passes: List[AspectDynamicsPass] = Field(default_factory=list)
    stations: List[AspectDynamicsStation] = Field(default_factory=list)
    closest_approach: AspectDynamicsClosestApproach


class AspectDynamicsResponse(BaseModel):
    method: Optional[str] = None
    transit_body: str
    natal_body: str
    source_body: Optional[str] = None
    target_body: Optional[str] = None
    aspect_type: str
    timezone: str
    calc_version: str
    status: str
    preview: Optional[bool] = None
    cache_hit: Optional[bool] = None
    exact_angle: Optional[float] = None
    orb_used: Optional[float] = None
    orb_source: Optional[str] = None
    target_angle: Optional[float] = None
    selected_point: Optional[AspectDynamicsPoint] = None
    requested_window: Optional[dict] = None
    effective_window: Optional[dict] = None
    boundary_complete: Optional[bool] = None
    contacts: List[AspectDynamicsContact] = Field(default_factory=list)
    series: List[AspectDynamicsPoint] = Field(default_factory=list)


# === API Endpoints ===

@router.post(
    "/transits/calculate",
    response_model=TransitResponse,
    status_code=status.HTTP_200_OK,
    summary="Расчёт транзитов",
    description="Рассчитывает транзиты к сохранённой натальной карте пользователя",
)
def calculate_transits(
    request: TransitRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    """
    Рассчитать транзиты к натальной карте.

    - **user_id**: UUID пользователя с сохранённой натальной картой
    - **date**: Дата транзита
    - **time**: Время транзита
    - **timezone**: Часовой пояс
    """
    transit_service = TransitService(db_session=db, ephe_path=EPHE_PATH)

    # --- Inline-натал (ephemeral): данные рождения переданы напрямую, без сохранённого клиента ---
    if request.natal is not None:
        try:
            natal_service = NatalChartService(ephe_path=EPHE_PATH)
            calc_result = calculate_natal_chart_cached(
                natal_service,
                db_session=db,
                birth_date=request.natal.date,
                birth_time=request.natal.time,
                timezone=request.natal.timezone,
                astrologer_id=auth.astrologer.id,
                place=request.natal.place,
                latitude=request.natal.latitude,
                longitude=request.natal.longitude,
                house_system=request.natal.house_system,
            )
        except ValueError as e:
            # Плохие inline-данные (геокод/дата/место) — это ошибка ввода, не 404
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
        except Exception as e:
            logger.exception(f"Error computing inline natal for transits: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка расчёта inline-натала: {str(e)}",
            )
        context = NatalContext.from_inline(calc_result, astrologer_id=auth.astrologer.id)
        try:
            return transit_service.calculate_transits_from_context(
                context,
                transit_date=request.date,
                transit_time=request.time,
                timezone=request.timezone,
                location=request.location,
                latitude=request.latitude,
                longitude=request.longitude,
            )
        except Exception as e:
            logger.exception(f"Error calculating transits (inline): {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка расчёта транзитов: {str(e)}",
            )

    # --- Сохранённый клиент (DB-путь): прежнее поведение, авторизация обязательна ---
    try:
        ensure_client_access(db, http_request, auth, request.user_id, action="client.transits.calculate")
        result = transit_service.calculate_transits(
            user_id=request.user_id,
            transit_date=request.date,
            transit_time=request.time,
            timezone=request.timezone,
            location=request.location,
            latitude=request.latitude,
            longitude=request.longitude,
        )
        return result

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.exception(f"Error calculating transits: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка расчёта транзитов: {str(e)}"
        )


@router.post(
    "/transits/period",
    response_model=TransitPeriodResponse,
    status_code=status.HTTP_200_OK,
    summary="Поиск транзитных событий на период",
    description="Находит все интервалы транзитных аспектов на указанный период (как в ZET Aspects Diagram)",
)
def find_transit_events(
    request: TransitPeriodRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    """
    Поиск транзитных событий на период.

    Для каждого аспекта транзит→натал возвращает:
    - **t_enter**: момент входа в орбис
    - **t_exact**: точный момент аспекта (минимальный орбис)
    - **t_leave**: момент выхода из орбиса
    """
    try:
        ensure_client_access(db, http_request, auth, request.user_id, action="client.transits.period")
        transit_service = TransitService(db_session=db, ephe_path=EPHE_PATH)
        events = transit_service.find_transit_events(
            user_id=request.user_id,
            start_date=request.start_date,
            end_date=request.end_date,
            timezone=request.timezone,
            step_hours=request.step_hours,
            transit_bodies=request.transit_bodies,
            natal_bodies=request.natal_bodies,
            aspect_types=request.aspect_types,
        )

        return {
            'period': {
                'start_date': request.start_date.isoformat(),
                'end_date': request.end_date.isoformat(),
                'timezone': request.timezone,
                'step_hours': request.step_hours,
            },
            'events': events,
            'total_events': len(events),
        }

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.exception(f"Error finding transit events: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка поиска транзитных событий: {str(e)}"
        )


@router.post(
    "/transits/aspect-dynamics",
    response_model=AspectDynamicsResponse,
    status_code=status.HTTP_200_OK,
    summary="Динамика транзитного аспекта",
    description="Возвращает signed-orb график одного транзитного аспекта к наталу",
)
def calculate_aspect_dynamics(
    request: AspectDynamicsRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    """Рассчитать график усиления/ослабления одного аспекта."""
    try:
        primary_user = None
        partner_user = None
        if request.user_id:
            primary_user = ensure_client_access(
                db,
                http_request,
                auth,
                request.user_id,
                action="client.aspects.dynamics",
            )
        if request.partner and request.partner.user_id:
            partner_user = ensure_client_access(
                db,
                http_request,
                auth,
                request.partner.user_id,
                action="client.aspects.dynamics_partner",
            )

        if request.is_legacy_transit_request:
            transit_service = TransitService(db_session=db, ephe_path=EPHE_PATH)
            return transit_service.calculate_aspect_dynamics(
                user_id=request.user_id,
                transit_body=request.transit_body,
                natal_body=request.natal_body,
                aspect_type=request.aspect_type,
                selected_date=request.selected_date,
                selected_time=request.selected_time,
                timezone=request.timezone,
                contact_start=request.contact_start,
                contact_end=request.contact_end,
                max_points=request.max_points,
            )

        payload_for_cache = request.model_dump(mode="json")
        cache_key = AspectDynamicsService.request_cache_key(
            payload_for_cache,
            astrologer_id=auth.astrologer.id,
        )
        cached = getattr(AspectDynamicsService, "cached_response", lambda _key: None)(cache_key)
        if cached is not None:
            return cached

        dynamics_service = AspectDynamicsService(db_session=db, ephe_path=EPHE_PATH)
        if request.user_id:
            primary_context = dynamics_service.context_from_user(primary_user)
        else:
            primary_context = dynamics_service.context_from_birth_data(
                request.natal,
                astrologer_id=auth.astrologer.id,
            )

        partner_context = None
        if request.partner:
            if request.partner.user_id:
                partner_context = dynamics_service.context_from_user(partner_user)
            else:
                partner_context = dynamics_service.context_from_birth_data(
                    request.partner.natal,
                    astrologer_id=auth.astrologer.id,
                )

        solar_location = None
        if (
            request.solar_location_latitude is not None
            and request.solar_location_longitude is not None
        ):
            solar_location = {
                "latitude": request.solar_location_latitude,
                "longitude": request.solar_location_longitude,
                "timezone": request.solar_location_timezone,
            }

        return dynamics_service.calculate(
            method=request.method,
            primary_context=primary_context,
            partner_context=partner_context,
            source_body=request.resolved_source_body,
            target_body=request.resolved_target_body,
            aspect_type=request.aspect_type,
            selected_date=request.selected_date,
            selected_time=request.selected_time,
            timezone=request.timezone,
            contact_start=request.contact_start,
            contact_end=request.contact_end,
            max_points=request.max_points,
            direction_type=request.direction_type or "zodiacal",
            solar_year=request.solar_year,
            solar_location=solar_location,
            preview=request.preview,
            cache_key=cache_key,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        logger.exception(f"Error calculating transit aspect dynamics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка расчёта динамики аспекта: {str(e)}",
        )

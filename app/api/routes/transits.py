"""
API эндпоинты для работы с транзитами
"""
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from uuid import UUID
from pydantic import BaseModel, Field, field_validator
from datetime import date as date_type, time as time_type
from typing import List, Optional

from app.services.transit_service import TransitService
from app.database.connection import get_db
from app.utils.ephemeris import get_ephemeris_path
from loguru import logger

router = APIRouter()

# Путь к эфемеридам
EPHE_PATH = get_ephemeris_path()


# === Pydantic Schemas ===

class TransitRequest(BaseModel):
    """Входные данные для расчёта транзитов"""
    user_id: UUID = Field(..., description="ID пользователя с сохранённой натальной картой")
    date: date_type = Field(..., description="Дата транзита (YYYY-MM-DD)")
    time: time_type = Field(..., description="Время транзита (HH:MM:SS)")
    timezone: str = Field(..., description="Часовой пояс (например, 'Europe/Kiev')")

    @field_validator('timezone')
    @classmethod
    def validate_timezone(cls, v: str) -> str:
        import pytz
        try:
            pytz.timezone(v)
        except pytz.exceptions.UnknownTimeZoneError:
            raise ValueError(f'Неизвестная временная зона: {v}')
        return v


class TransitPlanetInfo(BaseModel):
    """Информация о транзитной планете"""
    name: str
    longitude: float
    sign: str
    degree_in_sign: float
    degree_in_sign_formatted: str
    retrograde: bool
    speed: float
    natal_house: int = Field(..., description="В каком натальном доме находится транзитная планета")


class TransitAspectInfo(BaseModel):
    """Информация об аспекте транзит→натал"""
    transit_planet: str
    natal_object: str
    natal_object_type: str
    aspect_type: str
    orb: float
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


class TransitResponse(BaseModel):
    """Ответ с данными транзитов"""
    transit_info: TransitInfoBlock
    transit_planets: List[TransitPlanetInfo]
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
    db: Session = Depends(get_db)
):
    """
    Рассчитать транзиты к натальной карте.

    - **user_id**: UUID пользователя с сохранённой натальной картой
    - **date**: Дата транзита
    - **time**: Время транзита
    - **timezone**: Часовой пояс
    """
    try:
        transit_service = TransitService(db_session=db, ephe_path=EPHE_PATH)
        result = transit_service.calculate_transits(
            user_id=request.user_id,
            transit_date=request.date,
            transit_time=request.time,
            timezone=request.timezone
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
    db: Session = Depends(get_db)
):
    """
    Поиск транзитных событий на период.

    Для каждого аспекта транзит→натал возвращает:
    - **t_enter**: момент входа в орбис
    - **t_exact**: точный момент аспекта (минимальный орбис)
    - **t_leave**: момент выхода из орбиса
    """
    try:
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

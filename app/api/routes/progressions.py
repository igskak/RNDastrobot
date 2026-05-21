"""
API эндпоинты для работы с прогрессиями (Secondary Progressions)
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from sqlalchemy.orm import Session
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import date as date_type, time as time_type
from typing import List, Optional
import pytz

from app.services.progression_service import ProgressionService
from app.database.connection import get_db
from app.auth.dependencies import AuthContext, ensure_client_access, require_auth
from app.utils.ephemeris import get_ephemeris_path
from loguru import logger

router = APIRouter()

# Путь к эфемеридам
EPHE_PATH = get_ephemeris_path()


# === Pydantic Schemas ===

class ProgressionRequest(BaseModel):
    """Входные данные для расчёта прогрессии"""
    user_id: UUID = Field(..., description="ID пользователя с сохранённой натальной картой")
    target_date: date_type = Field(..., description="Дата, на которую рассчитывается прогрессия (YYYY-MM-DD)")
    target_time: Optional[time_type] = Field(None, description="Локальное время прогностического момента (HH:MM:SS)")
    timezone: Optional[str] = Field(None, description="IANA timezone прогностического момента")
    save_to_db: bool = Field(False, description="Сохранить результат в базу данных")
    name: Optional[str] = Field(None, max_length=160, description="Название сохранённой прогрессии")

    @field_validator('timezone')
    @classmethod
    def validate_timezone(cls, value: Optional[str]) -> Optional[str]:
        if value in (None, ''):
            return None
        try:
            pytz.timezone(value)
        except pytz.exceptions.UnknownTimeZoneError:
            raise ValueError(f"Unknown timezone: {value}")
        return value

    @model_validator(mode='after')
    def require_timezone_for_time(self):
        if self.target_time is not None and not self.timezone:
            raise ValueError("timezone is required when target_time is provided")
        return self


class ProgressedPlanetInfo(BaseModel):
    """Информация о прогрессивной планете"""
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
    natal_house: int = Field(..., description="В каком натальном доме находится прогрессивная планета")
    progressed_house: Optional[int] = Field(None, description="В каком прогрессивном доме находится планета")
    house: Optional[int] = Field(None, description="Alias для отображения дома на карте")


class ProgressionAspectInfo(BaseModel):
    """Информация об аспекте прогрессия→натал"""
    progressed_planet: str
    natal_object: str
    natal_object_type: str
    aspect_type: str
    orb: float
    is_major: bool
    harmonic_type: Optional[str] = None


class ProgressionInfoBlock(BaseModel):
    """Метаданные прогрессии"""
    target_date: str
    target_time: Optional[str] = None
    target_datetime: Optional[str] = None
    timezone: Optional[str] = None
    target_utc: Optional[str] = None
    age_years: float
    progressed_jd: float
    progressed_date: str
    progressed_datetime: Optional[str] = None
    method: str
    rate: str


class PlanetIngressInfo(BaseModel):
    """Ингрессия планеты (в знак или дом)."""
    body: str
    ingress_type: str = Field(..., description="sign | house")
    from_sign: Optional[str] = None
    to_sign: Optional[str] = None
    from_house: Optional[int] = None
    to_house: Optional[int] = None
    from_longitude: Optional[float] = None
    to_longitude: Optional[float] = None
    from_degree_in_sign_formatted: Optional[str] = None
    to_degree_in_sign_formatted: Optional[str] = None


class BirthDataBlock(BaseModel):
    """Данные рождения"""
    user_id: str
    birth_date: str
    birth_time: Optional[str] = None
    birth_place: str
    birth_jd: float


class NatalHouseInfo(BaseModel):
    """Информация о натальном доме"""
    number: int
    longitude: float
    sign: Optional[str] = None
    degree_in_sign: Optional[float] = None
    degree_in_sign_formatted: Optional[str] = None


class ProgressionResponse(BaseModel):
    """Ответ с данными прогрессии"""
    progression_id: Optional[str] = None
    name: Optional[str] = None
    progression_info: ProgressionInfoBlock
    birth_data: BirthDataBlock
    progressed_planets: List[ProgressedPlanetInfo]
    natal_houses: List[NatalHouseInfo]
    progressed_houses: List[NatalHouseInfo]
    aspects_to_natal: List[ProgressionAspectInfo]
    planet_ingresses: List[PlanetIngressInfo] = Field(default_factory=list)


class ProgressionListItem(BaseModel):
    """Элемент списка прогрессий"""
    progression_id: Optional[str] = None
    name: Optional[str] = None
    target_date: str
    target_time: Optional[str] = None
    timezone: Optional[str] = None
    target_utc: Optional[str] = None
    progressed_jd: float


class ProgressionListResponse(BaseModel):
    """Список прогрессий пользователя"""
    user_id: UUID
    progressions: List[ProgressionListItem]


class ProgressionUpdateRequest(BaseModel):
    """Обновление метаданных сохранённой прогрессии"""
    name: Optional[str] = Field(None, max_length=160)

    @field_validator('name')
    @classmethod
    def normalize_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


# === API Endpoints ===

@router.post(
    "/progressions/calculate",
    response_model=ProgressionResponse,
    status_code=status.HTTP_200_OK,
    summary="Расчёт вторичной прогрессии",
    description="Рассчитывает прогрессивную карту на указанную дату (метод: 1 день = 1 год)",
)
def calculate_progression(
    request: ProgressionRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    """
    Рассчитать вторичную прогрессию.

    - **user_id**: UUID пользователя с сохранённой натальной картой
    - **target_date**: Дата, на которую рассчитывается прогрессия
    - **save_to_db**: Сохранить результат в БД (по умолчанию False)
    """
    try:
        ensure_client_access(db, http_request, auth, request.user_id, action="client.progressions.calculate")
        progression_service = ProgressionService(db_session=db, ephe_path=EPHE_PATH)
        result = progression_service.calculate_progression(
            user_id=request.user_id,
            target_date=request.target_date,
            target_time=request.target_time,
            timezone=request.timezone,
            save_to_db=request.save_to_db,
            name=request.name,
        )
        return result

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.exception(f"Error calculating progression: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка расчёта прогрессии: {str(e)}"
        )


@router.get(
    "/progressions/{user_id}",
    response_model=ProgressionListResponse,
    status_code=status.HTTP_200_OK,
    summary="Список прогрессий пользователя",
    description="Получить список всех сохранённых прогрессий пользователя",
)
def list_progressions(
    user_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    """Получить список сохранённых прогрессий пользователя"""
    try:
        ensure_client_access(db, request, auth, user_id, action="client.progressions.list")
        progression_service = ProgressionService(db_session=db, ephe_path=EPHE_PATH)
        progressions = progression_service.list_progressions(user_id)
        return {
            'user_id': user_id,
            'progressions': progressions
        }
    except Exception as e:
        logger.exception(f"Error listing progressions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка получения списка прогрессий: {str(e)}"
        )


@router.patch(
    "/progressions/{progression_id}",
    response_model=ProgressionListItem,
    status_code=status.HTTP_200_OK,
    summary="Переименовать сохранённую прогрессию",
)
def update_progression(
    progression_id: UUID,
    payload: ProgressionUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    try:
        progression_service = ProgressionService(db_session=db, ephe_path=EPHE_PATH)
        progression = progression_service.get_progression_by_id(progression_id)
        if not progression:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Прогрессия не найдена")

        ensure_client_access(db, request, auth, progression.user_id, action="client.progressions.update")
        updated = progression_service.rename_progression(progression_id, payload.name)
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Прогрессия не найдена")
        return updated

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error updating progression: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка обновления прогрессии: {str(e)}"
        )

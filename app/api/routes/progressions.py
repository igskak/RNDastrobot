"""
API эндпоинты для работы с прогрессиями (Secondary Progressions)
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from sqlalchemy.orm import Session
from uuid import UUID
from pydantic import BaseModel, Field, field_validator
from datetime import date as date_type
from typing import List, Optional
import os

from app.services.progression_service import ProgressionService
from app.database.connection import get_db
from loguru import logger

router = APIRouter()

# Путь к эфемеридам
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EPHE_PATH = os.getenv("SWISSEPH_EPHE_PATH", os.path.join(_PROJECT_ROOT, "swisseph", "ephe"))


# === Pydantic Schemas ===

class ProgressionRequest(BaseModel):
    """Входные данные для расчёта прогрессии"""
    user_id: UUID = Field(..., description="ID пользователя с сохранённой натальной картой")
    target_date: date_type = Field(..., description="Дата, на которую рассчитывается прогрессия (YYYY-MM-DD)")
    save_to_db: bool = Field(False, description="Сохранить результат в базу данных")


class ProgressedPlanetInfo(BaseModel):
    """Информация о прогрессивной планете"""
    name: str
    longitude: float
    sign: str
    degree_in_sign: float
    degree_in_sign_formatted: str
    retrograde: bool
    speed: float
    natal_house: int = Field(..., description="В каком натальном доме находится прогрессивная планета")


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
    age_years: float
    progressed_jd: float
    progressed_date: str
    method: str
    rate: str


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


class ProgressionResponse(BaseModel):
    """Ответ с данными прогрессии"""
    progression_info: ProgressionInfoBlock
    birth_data: BirthDataBlock
    progressed_planets: List[ProgressedPlanetInfo]
    natal_houses: List[NatalHouseInfo]
    aspects_to_natal: List[ProgressionAspectInfo]


class ProgressionListItem(BaseModel):
    """Элемент списка прогрессий"""
    target_date: str
    progressed_jd: float


class ProgressionListResponse(BaseModel):
    """Список прогрессий пользователя"""
    user_id: UUID
    progressions: List[ProgressionListItem]


# === API Endpoints ===

@router.post(
    "/progressions/calculate",
    response_model=ProgressionResponse,
    status_code=status.HTTP_200_OK,
    summary="Расчёт вторичной прогрессии",
    description="Рассчитывает прогрессивную карту на указанную дату (метод: 1 день = 1 год)",
)
async def calculate_progression(
    request: ProgressionRequest,
    db: Session = Depends(get_db)
):
    """
    Рассчитать вторичную прогрессию.

    - **user_id**: UUID пользователя с сохранённой натальной картой
    - **target_date**: Дата, на которую рассчитывается прогрессия
    - **save_to_db**: Сохранить результат в БД (по умолчанию False)
    """
    try:
        progression_service = ProgressionService(db_session=db, ephe_path=EPHE_PATH)
        result = progression_service.calculate_progression(
            user_id=request.user_id,
            target_date=request.target_date,
            save_to_db=request.save_to_db
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
async def list_progressions(
    user_id: UUID,
    db: Session = Depends(get_db)
):
    """Получить список сохранённых прогрессий пользователя"""
    try:
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


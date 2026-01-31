"""
API эндпоинты для работы с дирекциями (Directions)
"""
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import date as date_type
from typing import List, Optional, Literal
import os

from app.services.direction_service import DirectionService
from app.database.connection import get_db
from loguru import logger

router = APIRouter()

# Путь к эфемеридам
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EPHE_PATH = os.getenv("SWISSEPH_EPHE_PATH", os.path.join(_PROJECT_ROOT, "swisseph", "ephe"))


# === Pydantic Schemas ===

class DirectionRequest(BaseModel):
    """Входные данные для расчёта дирекции"""
    user_id: UUID = Field(..., description="ID пользователя с сохранённой натальной картой")
    target_date: date_type = Field(..., description="Дата, на которую рассчитывается дирекция")
    direction_type: Literal['solar_arc', 'symbolic', 'equatorial'] = Field(
        'solar_arc', 
        description="Тип дирекции: solar_arc, symbolic (1°=1 год), equatorial (Naibod)"
    )
    save_to_db: bool = Field(False, description="Сохранить результат в базу данных")


class DirectedObjectInfo(BaseModel):
    """Информация о направленном объекте"""
    name: str
    longitude: float
    natal_longitude: float
    sign: str
    degree_in_sign: float
    degree_in_sign_formatted: str
    arc_applied: float
    type: str
    natal_house: Optional[int] = None


class DirectionAspectInfo(BaseModel):
    """Информация об аспекте дирекция→натал"""
    directed_object: str
    directed_type: str
    natal_object: str
    natal_type: str
    aspect_type: str
    orb: float
    is_major: bool
    harmonic_type: Optional[str] = None


class DirectionInfoBlock(BaseModel):
    """Метаданные дирекции"""
    target_date: str
    direction_type: str
    arc_degrees: float
    arc_formatted: str
    age_years: float
    method_description: str


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


class DirectionResponse(BaseModel):
    """Ответ с данными дирекции"""
    direction_info: DirectionInfoBlock
    birth_data: BirthDataBlock
    directed_planets: List[DirectedObjectInfo]
    directed_angles: List[DirectedObjectInfo]
    directed_special_points: List[DirectedObjectInfo]
    natal_houses: List[NatalHouseInfo]
    aspects_to_natal: List[DirectionAspectInfo]


class DirectionListItem(BaseModel):
    """Элемент списка дирекций"""
    target_date: str
    direction_type: str
    arc_degrees: float
    age_years: Optional[float] = None


class DirectionListResponse(BaseModel):
    """Список дирекций пользователя"""
    user_id: UUID
    directions: List[DirectionListItem]


# === API Endpoints ===

@router.post(
    "/directions/calculate",
    response_model=DirectionResponse,
    status_code=status.HTTP_200_OK,
    summary="Расчёт дирекции",
    description="Рассчитывает дирекционную карту на указанную дату",
)
async def calculate_direction(
    request: DirectionRequest,
    db: Session = Depends(get_db)
):
    """
    Рассчитать дирекцию.

    - **user_id**: UUID пользователя с сохранённой натальной картой
    - **target_date**: Дата, на которую рассчитывается дирекция
    - **direction_type**: Тип дирекции (solar_arc, symbolic, equatorial)
    - **save_to_db**: Сохранить результат в БД (по умолчанию False)
    """
    try:
        direction_service = DirectionService(db_session=db, ephe_path=EPHE_PATH)
        result = direction_service.calculate_direction(
            user_id=request.user_id,
            target_date=request.target_date,
            direction_type=request.direction_type,
            save_to_db=request.save_to_db
        )
        return result

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.exception(f"Error calculating direction: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка расчёта дирекции: {str(e)}"
        )


@router.get(
    "/directions/{user_id}",
    response_model=DirectionListResponse,
    status_code=status.HTTP_200_OK,
    summary="Список дирекций пользователя",
    description="Получить список всех сохранённых дирекций пользователя",
)
async def list_directions(
    user_id: UUID,
    db: Session = Depends(get_db)
):
    """Получить список сохранённых дирекций пользователя"""
    try:
        direction_service = DirectionService(db_session=db, ephe_path=EPHE_PATH)
        directions = direction_service.list_directions(user_id)
        return {
            'user_id': user_id,
            'directions': directions
        }
    except Exception as e:
        logger.exception(f"Error listing directions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка получения списка дирекций: {str(e)}"
        )


"""
API эндпоинты для работы с дирекциями (Directions)
"""
from fastapi import APIRouter, HTTPException, status, Depends, Request
from sqlalchemy.orm import Session
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import date as date_type
from typing import List, Optional, Literal

from app.services.direction_service import DirectionService
from app.database.connection import get_db
from app.auth.dependencies import AuthContext, ensure_client_access, require_auth
from app.utils.ephemeris import get_ephemeris_path
from loguru import logger

router = APIRouter()

# Путь к эфемеридам
EPHE_PATH = get_ephemeris_path()


# === Pydantic Schemas ===

class DirectionRequest(BaseModel):
    """Входные данные для расчёта дирекции"""
    user_id: UUID = Field(..., description="ID пользователя с сохранённой натальной картой")
    target_date: date_type = Field(..., description="Дата, на которую рассчитывается дирекция")
    direction_type: Literal['solar_arc', 'zodiacal', 'symbolic', 'equatorial'] = Field(
        'zodiacal',
        description="Тип дирекции: solar_arc, zodiacal/symbolic (1°=1 год), equatorial (Naibod)"
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
    directed_house: Optional[int] = None
    house: Optional[int] = None


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


class HouseCuspIngressInfo(BaseModel):
    """Ингрессия куспида дома в знак."""
    house_number: int
    from_sign: str
    to_sign: str
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


class DirectionResponse(BaseModel):
    """Ответ с данными дирекции"""
    direction_info: DirectionInfoBlock
    birth_data: BirthDataBlock
    directed_planets: List[DirectedObjectInfo]
    directed_angles: List[DirectedObjectInfo]
    directed_special_points: List[DirectedObjectInfo]
    natal_houses: List[NatalHouseInfo]
    directed_houses: List[NatalHouseInfo]
    aspects_to_natal: List[DirectionAspectInfo]
    planet_ingresses: List[PlanetIngressInfo] = Field(default_factory=list)
    house_cusp_ingresses: List[HouseCuspIngressInfo] = Field(default_factory=list)


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
def calculate_direction(
    request: DirectionRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    """
    Рассчитать дирекцию.

    - **user_id**: UUID пользователя с сохранённой натальной картой
    - **target_date**: Дата, на которую рассчитывается дирекция
    - **direction_type**: Тип дирекции (solar_arc, zodiacal/symbolic, equatorial)
    - **save_to_db**: Сохранить результат в БД (по умолчанию False)
    """
    try:
        ensure_client_access(db, http_request, auth, request.user_id, action="client.directions.calculate")
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
def list_directions(
    user_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    """Получить список сохранённых дирекций пользователя"""
    try:
        ensure_client_access(db, request, auth, user_id, action="client.directions.list")
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

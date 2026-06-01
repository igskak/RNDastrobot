"""
API эндпоинты для работы с дирекциями (Directions)
"""
from fastapi import APIRouter, HTTPException, status, Depends, Request
from sqlalchemy.orm import Session
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import date as date_type
from typing import List, Optional, Literal

from app.services.direction_service import DirectionService
from app.services.natal_chart_service import NatalChartService
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

class DirectionRequest(BaseModel):
    """Входные данные для расчёта дирекции.

    Источник натала — ровно один из ``user_id`` (сохранённый клиент) либо ``natal`` (inline).
    """
    user_id: Optional[UUID] = Field(
        None, description="ID сохранённого клиента. Взаимоисключающе с `natal`."
    )
    natal: Optional[BirthDataInput] = Field(
        None, description="Inline данные рождения (ephemeral). Взаимоисключающе с `user_id`."
    )
    target_date: date_type = Field(..., description="Дата, на которую рассчитывается дирекция")
    direction_type: Literal['solar_arc', 'zodiacal', 'symbolic', 'equatorial'] = Field(
        'zodiacal',
        description="Тип дирекции: solar_arc, zodiacal/symbolic (1°=1 год), equatorial (Naibod)"
    )
    save_to_db: bool = Field(False, description="Сохранить результат в базу данных")
    name: Optional[str] = Field(None, max_length=160, description="Название сохранённой дирекции")

    @model_validator(mode='after')
    def exactly_one_source(self):
        if bool(self.user_id) == bool(self.natal):
            raise ValueError("Укажите ровно один источник натала: `user_id` или `natal`")
        if self.natal is not None and self.save_to_db:
            raise ValueError("save_to_db недоступно для inline-натала (ephemeral)")
        return self


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
    user_id: Optional[str] = None   # None для inline-натала (ephemeral)
    birth_date: str
    birth_time: Optional[str] = None
    birth_place: Optional[str] = None
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
    direction_id: Optional[str] = None
    name: Optional[str] = None
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
    direction_id: Optional[str] = None
    name: Optional[str] = None
    target_date: str
    direction_type: str
    arc_degrees: float
    age_years: Optional[float] = None


class DirectionListResponse(BaseModel):
    """Список дирекций пользователя"""
    user_id: UUID
    directions: List[DirectionListItem]


class DirectionUpdateRequest(BaseModel):
    """Обновление метаданных сохранённой дирекции"""
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
    direction_service = DirectionService(db_session=db, ephe_path=EPHE_PATH)

    # --- Inline-натал (ephemeral) ---
    if request.natal is not None:
        try:
            calc_result = NatalChartService(ephe_path=EPHE_PATH).calculate_natal_chart(
                birth_date=request.natal.date,
                birth_time=request.natal.time,
                timezone=request.natal.timezone,
                astrologer_id=auth.astrologer.id,
                place=request.natal.place,
                latitude=request.natal.latitude,
                longitude=request.natal.longitude,
                house_system=request.natal.house_system,
                save_to_db=False,
                db_session=db,
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
        context = NatalContext.from_inline(calc_result, astrologer_id=auth.astrologer.id)
        try:
            return direction_service.calculate_direction_from_context(
                context,
                target_date=request.target_date,
                direction_type=request.direction_type,
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
        except Exception as e:
            logger.exception(f"Error calculating direction (inline): {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка расчёта дирекции: {str(e)}",
            )

    # --- Сохранённый клиент (DB-путь) ---
    try:
        ensure_client_access(db, http_request, auth, request.user_id, action="client.directions.calculate")
        result = direction_service.calculate_direction(
            user_id=request.user_id,
            target_date=request.target_date,
            direction_type=request.direction_type,
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


@router.patch(
    "/directions/{direction_id}",
    response_model=DirectionListItem,
    status_code=status.HTTP_200_OK,
    summary="Переименовать сохранённую дирекцию",
)
def update_direction(
    direction_id: UUID,
    payload: DirectionUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    try:
        direction_service = DirectionService(db_session=db, ephe_path=EPHE_PATH)
        direction = direction_service.get_direction_by_id(direction_id)
        if not direction:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Дирекция не найдена")

        ensure_client_access(db, request, auth, direction.user_id, action="client.directions.update")
        updated = direction_service.rename_direction(direction_id, payload.name)
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Дирекция не найдена")
        return updated

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error updating direction: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка обновления дирекции: {str(e)}"
        )

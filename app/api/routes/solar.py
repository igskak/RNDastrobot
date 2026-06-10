"""
API эндпоинты для работы с соларными картами (Solar Return)
"""
from fastapi import APIRouter, HTTPException, status, Depends, Request
from sqlalchemy.orm import Session
from uuid import UUID

from app.models.schemas import (
    SolarReturnRequest,
    SolarReturnResponse,
    SolarReturnListResponse,
    SolarReturnListItem,
    SolarReturnUpdateRequest,
    ErrorResponse,
)
from app.database.connection import get_db
from app.auth.dependencies import AuthContext, ensure_client_access, require_auth
from app.services.solar_return_service import SolarReturnService
from app.services.natal_chart_service import NatalChartService
from app.services.natal_context import NatalContext
from app.services.primary_chart_service import apply_primary
from app.utils.ephemeris import get_ephemeris_path

router = APIRouter(prefix="/solar", tags=["Solar Return"])

# Путь к эфемеридам
EPHE_PATH = get_ephemeris_path()


@router.post(
    "/calculate",
    response_model=SolarReturnResponse,
    status_code=status.HTTP_200_OK,
    summary="Расчёт соларной карты",
    description="Рассчитывает соларную карту (годовой прогноз) для пользователя",
    responses={
        404: {"model": ErrorResponse, "description": "Пользователь не найден"},
        400: {"model": ErrorResponse, "description": "Ошибка в параметрах запроса"},
    }
)
def calculate_solar_return(
    request: SolarReturnRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> SolarReturnResponse:
    """
    Расчёт соларной карты
    
    **Соляр** — карта на момент точного возвращения Солнца на натальную позицию.
    Используется для годового прогноза.
    
    **Входные данные:**
    - `user_id`: UUID пользователя с сохранённой натальной картой
    - `year`: Год соляра (1900-2100)
    - `location_latitude/longitude`: Место соляра (опционально, по умолчанию = место рождения)
    - `location_name`: Название места соляра
    - `house_system`: Система домов (по умолчанию 'P' - Placidus)
    - `save_to_db`: Сохранить результат в БД (по умолчанию True)
    
    **Возвращает:**
    - Полные данные соларной карты: планеты, дома, углы
    """
    solar_service = SolarReturnService(db_session=db, ephe_path=EPHE_PATH)

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
            if request.primary is not None:
                context = apply_primary(db, context, request.primary.method, request.primary.params)
            return solar_service.calculate_solar_return_from_context(
                context,
                year=request.year,
                location_lat=request.location_latitude,
                location_lon=request.location_longitude,
                location_name=request.location_name,
                location_source_id=request.location_source_id,
                location_timezone=request.location_timezone,
                house_system=request.house_system,
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка расчёта соляра: {str(e)}",
            )

    # --- Сохранённый клиент (DB-путь) ---
    try:
        ensure_client_access(db, http_request, auth, request.user_id, action="client.solar.calculate")
        # Первичная карта != натал: считаем через контекст (аспекты к первичной, без сохранения).
        if request.primary is not None and request.primary.method != 'natal':
            base = solar_service._build_context_from_user_id(request.user_id)
            context = apply_primary(db, base, request.primary.method, request.primary.params)
            return solar_service.calculate_solar_return_from_context(
                context,
                year=request.year,
                location_lat=request.location_latitude,
                location_lon=request.location_longitude,
                location_name=request.location_name,
                location_source_id=request.location_source_id,
                location_timezone=request.location_timezone,
                house_system=request.house_system,
            )
        result = solar_service.calculate_solar_return(
            user_id=request.user_id,
            year=request.year,
            location_lat=request.location_latitude,
            location_lon=request.location_longitude,
            location_name=request.location_name,
            location_source_id=request.location_source_id,
            location_timezone=request.location_timezone,
            house_system=request.house_system,
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка расчёта соляра: {str(e)}"
        )


@router.get(
    "/{user_id}/{year}",
    response_model=SolarReturnResponse,
    status_code=status.HTTP_200_OK,
    summary="Получить сохранённый соляр",
    description="Получает ранее рассчитанный соляр из БД",
    responses={
        404: {"model": ErrorResponse, "description": "Соляр не найден"},
    }
)
def get_solar_return(
    user_id: UUID,
    year: int,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> SolarReturnResponse:
    """
    Получить сохранённый соляр
    
    **Параметры:**
    - `user_id`: UUID пользователя
    - `year`: Год соляра
    """
    try:
        ensure_client_access(db, request, auth, user_id, action="client.solar.get")
        solar_service = SolarReturnService(db_session=db, ephe_path=EPHE_PATH)
        result = solar_service.get_solar_return(user_id, year)
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Соляр для пользователя {user_id} за {year} год не найден"
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка получения соляра: {str(e)}"
        )


@router.get(
    "/{user_id}",
    response_model=SolarReturnListResponse,
    status_code=status.HTTP_200_OK,
    summary="Список соляров пользователя",
    description="Получает список всех рассчитанных соляров пользователя",
)
def list_solar_returns(
    user_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> SolarReturnListResponse:
    """
    Получить список всех соляров пользователя
    """
    try:
        ensure_client_access(db, request, auth, user_id, action="client.solar.list")
        solar_service = SolarReturnService(db_session=db, ephe_path=EPHE_PATH)
        solars = solar_service.list_solar_returns(user_id)
        
        return SolarReturnListResponse(
            user_id=user_id,
            solar_returns=[SolarReturnListItem(**s) for s in solars]
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка получения списка соляров: {str(e)}"
        )


@router.patch(
    "/{solar_id}",
    response_model=SolarReturnListItem,
    status_code=status.HTTP_200_OK,
    summary="Переименовать сохранённый соляр",
    description="Обновляет пользовательское название сохранённого соляра",
)
def update_solar_return(
    solar_id: UUID,
    payload: SolarReturnUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> SolarReturnListItem:
    try:
        solar_service = SolarReturnService(db_session=db, ephe_path=EPHE_PATH)
        solar = solar_service.get_solar_return_by_id(solar_id)
        if not solar:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Соляр не найден")

        ensure_client_access(db, request, auth, solar.user_id, action="client.solar.update")
        updated = solar_service.rename_solar_return(solar_id, payload.name)
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Соляр не найден")
        return SolarReturnListItem(**updated)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка обновления соляра: {str(e)}"
        )

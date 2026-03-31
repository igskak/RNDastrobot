"""
API эндпоинты для работы с натальными картами
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional

from app.models.schemas import (
    BirthDataInput,
    NatalChartResponse,
    ErrorResponse,
    PlanetPosition,
    HousePosition,
    AnglePosition,
    SpecialPointPosition,
    BirthDataOutput,
    AspectInfo,
    ConfigurationInfo,
    StelliumInfo,
    CosmogramPatternInfo,
    PlanetDistributionInfo,
    KarmicAnalysisInfo,
    BalancesInfo,
    ElementBalanceInfo,
    ModeBalanceInfo,
    GenderBalanceInfo,
    ZonesBalanceInfo,
    HemisphereBalanceInfo,
    QuadrantBalanceInfo,
    HouseGroupBalanceInfo,
    GeneralOverviewResponse,
    HouseSystemUpdateRequest,
    ResetViewToDefaultsRequest,
)
from app.services.natal_chart_service import NatalChartService
from app.services.preferences_service import PreferencesService
from app.database.connection import get_db
from app.database.repositories.user_repository import UserRepository
from app.database.models import User, Consultation
from app.auth.dependencies import AuthContext, create_audit_event, ensure_client_access, require_auth
from app.utils.ephemeris import get_ephemeris_path
from app.services.geocoding_service import GeocodingTimeoutError, GeocodingServiceError
from sqlalchemy import func as sa_func, case, and_
import os
from loguru import logger

router = APIRouter()

# Инициализация сервиса
EPHE_PATH = get_ephemeris_path()
# Логируем только в development
if os.getenv('APP_ENV') != 'production':
    logger.info(f"Ephemeris path: {EPHE_PATH}")
natal_service = NatalChartService(ephe_path=EPHE_PATH)


def build_natal_chart_response(chart_data: dict) -> NatalChartResponse:
    balances_data = None
    if chart_data.get('balances'):
        balances_dict = chart_data['balances']
        balances_data = BalancesInfo(
            element_balance=ElementBalanceInfo(**balances_dict['element_balance']) if balances_dict.get('element_balance') else None,
            mode_balance=ModeBalanceInfo(**balances_dict['mode_balance']) if balances_dict.get('mode_balance') else None,
            gender_balance=GenderBalanceInfo(**balances_dict['gender_balance']) if balances_dict.get('gender_balance') else None,
            zones_balance=ZonesBalanceInfo(**balances_dict['zones_balance']) if balances_dict.get('zones_balance') else None,
            hemisphere_balance=HemisphereBalanceInfo(**balances_dict['hemisphere_balance']) if balances_dict.get('hemisphere_balance') else None,
            quadrant_balance=QuadrantBalanceInfo(**balances_dict['quadrant_balance']) if balances_dict.get('quadrant_balance') else None,
            house_group_balance=HouseGroupBalanceInfo(**balances_dict['house_group_balance']) if balances_dict.get('house_group_balance') else None,
        )

    return NatalChartResponse(
        user_id=UUID(chart_data['user_id']) if chart_data.get('user_id') else None,
        birth_data=BirthDataOutput(**chart_data['birth_data']),
        planets=[PlanetPosition(**p) for p in chart_data['planets']],
        houses=[HousePosition(**h) for h in chart_data['houses']],
        angles={k: AnglePosition(**v) for k, v in chart_data['angles'].items()},
        special_points={k: SpecialPointPosition(**v) for k, v in chart_data['special_points'].items()},
        configurations=chart_data.get('configurations'),
        aspects=[AspectInfo(**a) for a in chart_data['aspects']] if chart_data.get('aspects') else None,
        aspect_configurations=[ConfigurationInfo(**c) for c in chart_data['aspect_configurations']] if chart_data.get('aspect_configurations') else None,
        stelliums=[StelliumInfo(**s) for s in chart_data['stelliums']] if chart_data.get('stelliums') else None,
        cosmogram_pattern=CosmogramPatternInfo(**chart_data['cosmogram_pattern']) if chart_data.get('cosmogram_pattern') else None,
        planet_distribution=PlanetDistributionInfo(**chart_data['planet_distribution']) if chart_data.get('planet_distribution') else None,
        balances=balances_data,
        karmic_analysis=KarmicAnalysisInfo(**chart_data['karmic_analysis']),
    )

@router.post(
    "/natal/calculate",
    response_model=NatalChartResponse,
    status_code=status.HTTP_200_OK,
    summary="Расчёт натальной карты",
    description="Рассчитывает полную натальную карту по данным рождения",
    responses={
        200: {"description": "Успешный расчёт натальной карты"},
        400: {"model": ErrorResponse, "description": "Ошибка валидации данных"},
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    }
)
def calculate_natal_chart(
    birth_data: BirthDataInput,
    save_to_db: bool = Query(True, description="Сохранить результат в базу данных"),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> NatalChartResponse:
    """
    Расчёт натальной карты

    **Входные данные:**
    - `date`: Дата рождения (YYYY-MM-DD)
    - `time`: Время рождения (HH:MM:SS)
    - `timezone`: Временная зона (например, 'America/New_York', 'Europe/Kiev')
    - `place`: Название места (опционально, если указаны координаты)
    - `latitude`: Широта (опционально, если указано место)
    - `longitude`: Долгота (опционально, если указано место)
    - `house_system`: Система домов (по умолчанию 'P' - Placidus)
    - `save_to_db`: Сохранить результат в БД (по умолчанию False)

    **Возвращает:**
    - Полные данные натальной карты: планеты, дома, углы, специальные точки, конфигурации
    - Если save_to_db=True, также возвращает user_id
    """
    try:
        # Расчёт натальной карты
        chart_data = natal_service.calculate_natal_chart(
            birth_date=birth_data.date,
            birth_time=birth_data.time,
            timezone=birth_data.timezone,
            astrologer_id=auth.astrologer.id,
            place=birth_data.place,
            latitude=birth_data.latitude,
            longitude=birth_data.longitude,
            house_system=birth_data.house_system,
            save_to_db=save_to_db,
            db_session=db if save_to_db else None,
            first_name=birth_data.first_name,
            last_name=birth_data.last_name,
        )
        
        return build_natal_chart_response(chart_data)
    
    except ValueError as e:
        logger.error(f"Ошибка валидации: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    except GeocodingTimeoutError as e:
        logger.error(f"Таймаут геокодирования: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Превышено время ожидания при определении координат места"
        )
    
    except GeocodingServiceError as e:
        logger.error(f"Ошибка сервиса геокодирования: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Сервис геокодирования временно недоступен"
        )
    
    except Exception as e:
        logger.exception(f"Неожиданная ошибка при расчёте натальной карты: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )


@router.get(
    "/natal/{user_id}",
    response_model=NatalChartResponse,
    status_code=status.HTTP_200_OK,
    summary="Получить натальную карту из БД",
    description="Получает сохранённую натальную карту пользователя по ID",
    responses={
        200: {"description": "Натальная карта найдена"},
        404: {"model": ErrorResponse, "description": "Натальная карта не найдена"},
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    }
)
def get_natal_chart(
    user_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> NatalChartResponse:
    """
    Получить сохранённую натальную карту

    **Параметры:**
    - `user_id`: UUID пользователя

    **Возвращает:**
    - Полные данные натальной карты из базы данных
    """
    try:
        ensure_client_access(db, request, auth, user_id, action="client.natal.open")
        # Получаем данные из БД
        chart_data = natal_service.get_natal_chart_from_db(user_id, db)

        if not chart_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Натальная карта для пользователя {user_id} не найдена"
            )

        return build_natal_chart_response(chart_data)

    except HTTPException:
        raise

    except Exception as e:
        logger.exception(f"Ошибка при получении натальной карты: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )


@router.get(
    "/natal/{user_id}/overview",
    response_model=GeneralOverviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Получить общий срез натальной карты",
    description="Получает агрегированный общий срез (Этап 5): ASC-блок, светила, космограмму, доминанты",
    responses={
        200: {"description": "Общий срез найден"},
        404: {"model": ErrorResponse, "description": "Общий срез не найден"},
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    }
)
def get_general_overview(
    user_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> GeneralOverviewResponse:
    """
    Получить общий срез натальной карты

    Возвращает агрегированные данные:
    - ASC-блок (знак, стихия, модальность, зона, соединения, управитель)
    - Светила (Солнце и Луна: знак, дом, аспекты)
    - Космограмма (тип паттерна, якорная планета)
    - Конфигурации и стеллиумы
    - Доминанты (стихия, крест, зона, полусфера, angularity)
    """
    try:
        ensure_client_access(db, request, auth, user_id, action="client.natal.overview")
        from app.services.general_overview_service import GeneralOverviewService

        overview_service = GeneralOverviewService(db)
        overview = overview_service.get_overview(user_id)

        if not overview:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Общий срез для пользователя {user_id} не найден"
            )

        return GeneralOverviewResponse(
            user_id=overview.user_id,
            asc_sign=overview.asc_sign,
            asc_degree=float(overview.asc_degree) if overview.asc_degree else None,
            asc_element=overview.asc_element,
            asc_mode=overview.asc_mode,
            asc_zone=overview.asc_zone,
            asc_conjunctions=overview.asc_conjunctions,
            asc_ruler=overview.asc_ruler,
            sun_sign=overview.sun_sign,
            sun_house=overview.sun_house,
            sun_aspects=overview.sun_aspect_summary,
            moon_sign=overview.moon_sign,
            moon_house=overview.moon_house,
            moon_aspects=overview.moon_aspect_summary,
            cosmogram_pattern=overview.cosmogram_pattern,
            cosmogram_anchor_planet=overview.cosmogram_anchor_planet,
            cosmogram_empty_arc=float(overview.cosmogram_empty_arc) if overview.cosmogram_empty_arc else None,
            main_configurations=overview.main_configurations,
            main_stelliums=overview.main_stelliums,
            dominant_element=overview.dominant_element,
            dominant_mode=overview.dominant_mode,
            dominant_zone=overview.dominant_zone,
            dominant_hemisphere=overview.dominant_hemisphere,
            dominant_gender=overview.dominant_gender,
            angularity_ratio=float(overview.angularity_ratio) if overview.angularity_ratio else None,
            notes=overview.notes
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )


@router.get(
    "/natal/test",
    summary="Тестовый эндпоинт",
    description="Проверка работоспособности модуля натальных карт"
)
def test_natal():
    """Тестовый эндпоинт для проверки работы модуля"""
    return {
        "status": "ok",
        "message": "Natal charts module is working",
        "ephe_path": EPHE_PATH
    }


@router.get(
    "/users",
    summary="Список всех пользователей",
    description="Возвращает список всех пользователей с основными данными",
)
def list_users(
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    """Получить список всех пользователей с CRM-данными"""
    try:
        # Subquery: consultation stats per user
        consult_stats = (
            db.query(
                Consultation.user_id,
                sa_func.count(Consultation.id).label("consultation_count"),
                sa_func.max(Consultation.scheduled_at).label("last_consultation_at"),
                sa_func.sum(
                    case((and_(Consultation.is_paid == False, Consultation.status == 'completed'), 1), else_=0)  # noqa: E712
                ).label("unpaid_count"),
                sa_func.sum(
                    case((Consultation.status == 'planned', 1), else_=0)
                ).label("upcoming_count"),
            )
            .filter(Consultation.astrologer_id == auth.astrologer.id)
            .group_by(Consultation.user_id)
            .subquery()
        )

        # Last consultation type (correlated scalar — only fetched if there are consultations)
        last_consult = (
            db.query(Consultation.consultation_type)
            .filter(
                Consultation.user_id == User.user_id,
                Consultation.astrologer_id == auth.astrologer.id,
            )
            .order_by(Consultation.scheduled_at.desc().nullslast())
            .limit(1)
            .correlate(User)
            .scalar_subquery()
        )

        rows = (
            db.query(
                User,
                consult_stats.c.consultation_count,
                consult_stats.c.last_consultation_at,
                consult_stats.c.unpaid_count,
                consult_stats.c.upcoming_count,
                last_consult.label("last_consultation_type"),
            )
            .outerjoin(consult_stats, User.user_id == consult_stats.c.user_id)
            .filter(User.astrologer_id == auth.astrologer.id)
            .order_by(User.created_at.desc())
            .all()
        )

        create_audit_event(
            db,
            request,
            actor_id=auth.astrologer.id,
            action="client.list",
            resource_type="users",
            resource_id=None,
            result="success",
        )

        result = []
        for u, cons_count, last_at, unpaid, upcoming, last_type in rows:
            result.append({
                "user_id": str(u.user_id),
                "first_name": u.first_name,
                "last_name": u.last_name,
                "birth_date": u.birth_date.isoformat() if u.birth_date else None,
                "birth_place": u.birth_place,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                # CRM contact fields
                "email": u.email,
                "phone": u.phone,
                "messenger": u.messenger,
                "tags": u.tags or [],
                "notes": u.notes,
                # Consultation summary
                "consultation_count": cons_count or 0,
                "last_consultation_at": last_at.isoformat() if last_at else None,
                "last_consultation_type": last_type,
                "unpaid_count": unpaid or 0,
                "upcoming_count": upcoming or 0,
            })
        return result
    except Exception as e:
        logger.exception(f"Ошибка при получении списка пользователей: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )

@router.put(
    "/users/{user_id}",
    response_model=NatalChartResponse,
    summary="Обновить данные клиента",
    description="Обновляет birth-data клиента, пересчитывает натальную карту и возвращает свежий результат",
)
def update_user_birth_data(
    user_id: UUID,
    birth_data: BirthDataInput,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> NatalChartResponse:
    """Обновить данные рождения клиента и пересчитать сохранённую карту."""
    try:
        ensure_client_access(db, request, auth, user_id, action="client.natal.update")
        chart_data = natal_service.update_existing_chart(
            user_id=user_id,
            db_session=db,
            birth_date=birth_data.date,
            birth_time=birth_data.time,
            timezone=birth_data.timezone,
            astrologer_id=auth.astrologer.id,
            place=birth_data.place,
            latitude=birth_data.latitude,
            longitude=birth_data.longitude,
            house_system=birth_data.house_system,
            first_name=birth_data.first_name,
            last_name=birth_data.last_name,
        )
        # Save CRM contact fields if provided
        user = db.query(User).filter(User.user_id == user_id).first()
        if user:
            if birth_data.email is not None:
                user.email = birth_data.email or None
            if birth_data.phone is not None:
                user.phone = birth_data.phone or None
            if birth_data.messenger is not None:
                user.messenger = birth_data.messenger or None
            if birth_data.tags is not None:
                user.tags = birth_data.tags
            if birth_data.notes is not None:
                user.notes = birth_data.notes or None
            db.flush()
        return build_natal_chart_response(chart_data)
    except ValueError as e:
        logger.error(f"Ошибка валидации при обновлении клиента: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except GeocodingTimeoutError as e:
        logger.error(f"Таймаут геокодирования при обновлении клиента: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Превышено время ожидания при определении координат места"
        )
    except GeocodingServiceError as e:
        logger.error(f"Ошибка сервиса геокодирования при обновлении клиента: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Сервис геокодирования временно недоступен"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Ошибка при обновлении клиента: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )


@router.patch(
    "/users/{user_id}/house-system",
    response_model=NatalChartResponse,
    summary="Обновить persisted house system клиента",
    description="Сохраняет house system на уровне карты, пересчитывает натальную карту и возвращает свежий результат",
)
def update_user_house_system(
    user_id: UUID,
    payload: HouseSystemUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> NatalChartResponse:
    try:
        ensure_client_access(db, request, auth, user_id, action="client.natal.house_system.update")
        chart_data = natal_service.update_house_system_for_user(
            user_id,
            house_system=payload.house_system,
            astrologer_id=auth.astrologer.id,
            db_session=db,
        )
        return build_natal_chart_response(chart_data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Ошибка при обновлении house system клиента: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )


@router.post(
    "/users/{user_id}/reset-view-to-defaults",
    summary="Сбросить настройки экрана клиента к account defaults",
    description="Удаляет overrides указанного экрана. Для natal также возвращает house system к account default и пересчитывает карту.",
)
def reset_user_view_to_defaults(
    user_id: UUID,
    payload: ResetViewToDefaultsRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    ensure_client_access(db, request, auth, user_id, action="client.natal.reset_view_defaults")

    if payload.view_type not in ('natal', 'biwheel'):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="view_type must be natal or biwheel")

    preferences_service = PreferencesService(db)
    preferences_service.delete_chart_view_override(
        chart_kind='natal',
        chart_id=user_id,
        view_type=payload.view_type,
    )

    chart_response = None
    if payload.view_type == 'natal':
        account_preferences = preferences_service.get_account_preferences(auth.astrologer)
        house_system = account_preferences.get('chart_creation_defaults', {}).get('house_system') or auth.astrologer.default_house_system
        chart_response = natal_service.update_house_system_for_user(
            user_id,
            house_system=house_system,
            astrologer_id=auth.astrologer.id,
            db_session=db,
        )

    resolved_preferences = preferences_service.resolve_preferences(
        auth.astrologer,
        chart_kind='natal',
        chart_id=user_id,
        view_type=payload.view_type,
    )

    return {
        'status': 'ok',
        'view_type': payload.view_type,
        'chart_data': chart_response,
        'resolved_preferences': resolved_preferences,
    }


@router.delete(
    "/users/{user_id}",
    summary="Удалить пользователя",
    description="Удаляет пользователя и все связанные данные (каскадно)",
)
def delete_user(
    user_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    """Удалить пользователя по ID"""
    try:
        ensure_client_access(db, request, auth, user_id, action="client.delete")
        user_repo = UserRepository(db)
        deleted = user_repo.delete_user(user_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Пользователь {user_id} не найден"
            )
        db.commit()
        return {"status": "ok", "message": f"Пользователь {user_id} удалён"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Ошибка при удалении пользователя: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )

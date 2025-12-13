"""
API эндпоинты для работы с натальными картами
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
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
    BalancesInfo,
    ElementBalanceInfo,
    ModeBalanceInfo,
    GenderBalanceInfo,
    ZonesBalanceInfo,
    HemisphereBalanceInfo,
    QuadrantBalanceInfo,
    HouseGroupBalanceInfo,
    GeneralOverviewResponse
)
from app.services.natal_chart_service import NatalChartService
from app.database.connection import get_db
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
import os
from loguru import logger

router = APIRouter()

# Инициализация сервиса
# Путь к эфемеридам Swiss Ephemeris (абсолютный путь)
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EPHE_PATH = os.getenv("SWISSEPH_EPHE_PATH", os.path.join(_PROJECT_ROOT, "swisseph", "ephe"))
natal_service = NatalChartService(ephe_path=EPHE_PATH)


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
async def calculate_natal_chart(
    birth_data: BirthDataInput,
    save_to_db: bool = Query(False, description="Сохранить результат в базу данных"),
    db: Session = Depends(get_db)
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
        logger.info(f"Расчёт натальной карты для {birth_data.date} {birth_data.time} (save_to_db={save_to_db})")

        # Расчёт натальной карты
        chart_data = natal_service.calculate_natal_chart(
            birth_date=birth_data.date,
            birth_time=birth_data.time,
            timezone=birth_data.timezone,
            place=birth_data.place,
            latitude=birth_data.latitude,
            longitude=birth_data.longitude,
            house_system=birth_data.house_system,
            save_to_db=save_to_db,
            db_session=db if save_to_db else None
        )
        
        # Преобразование балансов (пункт 3.5 спецификации)
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

        # Преобразование в Pydantic модели
        response = NatalChartResponse(
            user_id=UUID(chart_data['user_id']) if chart_data.get('user_id') else None,
            birth_data=BirthDataOutput(**chart_data['birth_data']),
            planets=[PlanetPosition(**p) for p in chart_data['planets']],
            houses=[HousePosition(**h) for h in chart_data['houses']],
            angles={k: AnglePosition(**v) for k, v in chart_data['angles'].items()},
            special_points={k: SpecialPointPosition(**v) for k, v in chart_data['special_points'].items()},
            configurations=chart_data.get('configurations'),
            # Похідні дані (пункт 3.3 специфікації)
            aspects=[AspectInfo(**a) for a in chart_data['aspects']] if chart_data.get('aspects') else None,
            aspect_configurations=[ConfigurationInfo(**c) for c in chart_data['aspect_configurations']] if chart_data.get('aspect_configurations') else None,
            stelliums=[StelliumInfo(**s) for s in chart_data['stelliums']] if chart_data.get('stelliums') else None,
            cosmogram_pattern=CosmogramPatternInfo(**chart_data['cosmogram_pattern']) if chart_data.get('cosmogram_pattern') else None,
            planet_distribution=PlanetDistributionInfo(**chart_data['planet_distribution']) if chart_data.get('planet_distribution') else None,
            # Інтегральні баланси (пункт 3.5 специфікації)
            balances=balances_data,
        )

        if save_to_db:
            logger.info(f"Натальная карта успешно рассчитана и сохранена в БД (user_id={chart_data['user_id']})")
        else:
            logger.info(f"Натальная карта успешно рассчитана")

        return response
    
    except ValueError as e:
        logger.error(f"Ошибка валидации: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    except GeocoderTimedOut as e:
        logger.error(f"Таймаут геокодирования: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Превышено время ожидания при определении координат места"
        )
    
    except GeocoderServiceError as e:
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
async def get_natal_chart(
    user_id: UUID,
    db: Session = Depends(get_db)
) -> NatalChartResponse:
    """
    Получить сохранённую натальную карту

    **Параметры:**
    - `user_id`: UUID пользователя

    **Возвращает:**
    - Полные данные натальной карты из базы данных
    """
    try:
        logger.info(f"Запрос натальной карты для user_id={user_id}")

        # Получаем данные из БД
        chart_data = natal_service.get_natal_chart_from_db(user_id, db)

        if not chart_data:
            logger.warning(f"Натальная карта не найдена для user_id={user_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Натальная карта для пользователя {user_id} не найдена"
            )

        # Преобразование балансов (пункт 3.5 спецификации)
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

        # Преобразование в Pydantic модели
        response = NatalChartResponse(
            user_id=UUID(chart_data['user_id']),
            birth_data=BirthDataOutput(**chart_data['birth_data']),
            planets=[PlanetPosition(**p) for p in chart_data['planets']],
            houses=[HousePosition(**h) for h in chart_data['houses']],
            angles={k: AnglePosition(**v) for k, v in chart_data['angles'].items()},
            special_points={k: SpecialPointPosition(**v) for k, v in chart_data['special_points'].items()},
            configurations=chart_data.get('configurations'),
            # Похідні дані (пункт 3.3 специфікації)
            aspects=[AspectInfo(**a) for a in chart_data['aspects']] if chart_data.get('aspects') else None,
            aspect_configurations=[ConfigurationInfo(**c) for c in chart_data['aspect_configurations']] if chart_data.get('aspect_configurations') else None,
            stelliums=[StelliumInfo(**s) for s in chart_data['stelliums']] if chart_data.get('stelliums') else None,
            cosmogram_pattern=CosmogramPatternInfo(**chart_data['cosmogram_pattern']) if chart_data.get('cosmogram_pattern') else None,
            planet_distribution=PlanetDistributionInfo(**chart_data['planet_distribution']) if chart_data.get('planet_distribution') else None,
            # Інтегральні баланси (пункт 3.5 специфікації)
            balances=balances_data,
        )

        logger.info(f"Натальная карта успешно получена из БД для user_id={user_id}")
        return response

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
async def get_general_overview(
    user_id: UUID,
    db: Session = Depends(get_db)
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
async def test_natal():
    """Тестовый эндпоинт для проверки работы модуля"""
    return {
        "status": "ok",
        "message": "Natal charts module is working",
        "ephe_path": EPHE_PATH
    }


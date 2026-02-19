"""
API эндпоинты для чата с OpenAI агентом (ChatKit интеграция + прогностический чат)
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List, Literal
from uuid import UUID
from sqlalchemy.orm import Session
from loguru import logger

from app.services.openai_service import get_openai_service
from app.services.natal_chart_service import NatalChartService
from app.services.prognostic_tools_service import PrognosticToolsService
from app.services.forecast_run_service import ForecastRunService
from app.database.connection import get_db
from app.i18n.context import get_current_locale
from app.utils.ephemeris import get_ephemeris_path

# Инициализация natal_service для загрузки карт из БД
EPHE_PATH = get_ephemeris_path()
natal_service = NatalChartService(ephe_path=EPHE_PATH)

router = APIRouter()


# ============================================================================
# Pydantic модели
# ============================================================================

class CreateSessionRequest(BaseModel):
    """Запрос на создание ChatKit сессии"""
    user_id: str


class CreateSessionResponse(BaseModel):
    """Ответ с client_secret для ChatKit виджета"""
    client_secret: str
    session_id: str


class PrognosticChatRequest(BaseModel):
    """Запрос прогностического чата"""
    user_id: str
    message: str
    previous_response_id: Optional[str] = None


class PrognosticChatResponse(BaseModel):
    """Ответ прогностического чата"""
    response_text: str
    response_id: str
    tools_called: List[str] = []
    tokens: int = 0


class PrognosticToolRequest(BaseModel):
    """Запрос на выполнение tool-функции (от ChatKit client-side)"""
    user_id: str
    tool_name: str
    arguments: Dict[str, Any] = {}
    frontend_context: Optional[Dict[str, Any]] = None


class SaveForecastRunRequest(BaseModel):
    """Запрос на сохранение snapshot рассчитанной прогностики."""
    user_id: str
    method: Literal["transits", "progressions", "directions", "solar_return"]
    context_data: Dict[str, Any] = Field(default_factory=dict)
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    target_date: Optional[str] = None
    year: Optional[int] = None
    timezone: Optional[str] = None
    direction_type: Optional[Literal["solar_arc", "symbolic", "equatorial"]] = None
    location_name: Optional[str] = None
    location_lat: Optional[float] = None
    location_lon: Optional[float] = None


class SaveForecastRunResponse(BaseModel):
    """Ответ после сохранения snapshot прогностики."""
    run_id: str
    method: str
    is_active: bool = True
    created_at: Optional[str] = None


# ============================================================================
# Endpoints
# ============================================================================

@router.post(
    "/chat/session",
    response_model=CreateSessionResponse,
    status_code=status.HTTP_200_OK,
    summary="Создать ChatKit сессию",
    description="Создаёт ChatKit сессию и возвращает client_secret для виджета"
)
async def create_chat_session(
    request: CreateSessionRequest,
    db: Session = Depends(get_db)
) -> CreateSessionResponse:
    """
    Создать ChatKit сессию для чата с агентом.

    Для простой интеграции ChatKit:
    - Backend создаёт сессию и возвращает client_secret
    - Frontend использует ChatKit.js виджет с этим токеном
    - Всё общение идёт напрямую через ChatKit виджет
    - Данные натальной карты загружаются из БД по user_id

    **Входные данные:**
    - `user_id`: Идентификатор пользователя (UUID в формате строки)

    **Возвращает:**
    - `client_secret`: Токен для ChatKit виджета
    - `session_id`: ID созданной сессии
    """
    try:
        logger.info(f"Создание ChatKit сессии для пользователя: {request.user_id}")
        locale = get_current_locale()

        # Парсим user_id в UUID (убираем префикс "user_" если есть)
        user_id_clean = request.user_id.replace("user_", "") if request.user_id.startswith("user_") else request.user_id
        try:
            user_uuid = UUID(user_id_clean)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Некорректный формат user_id: {request.user_id}"
            )

        # Загружаем полную натальную карту из БД (если есть)
        chart_data = natal_service.get_natal_chart_from_db(user_uuid, db)

        if chart_data:
            logger.info(f"Натальная карта загружена для пользователя {request.user_id}")
        else:
            logger.warning(f"Натальная карта для пользователя {request.user_id} не найдена. "
                          "Чат будет работать без данных карты.")
            # Можно либо вернуть ошибку, либо создать сессию без chart_data
            # Для тестирования оставляем chart_data = None, агент попросит данные

        # Timezone уже есть в chart_data (загружен вместе с User)
        user_tz = chart_data.get('birth_data', {}).get('timezone') if chart_data else None

        # Создаём ChatKit сессию с данными карты
        openai_service = get_openai_service()
        result = await openai_service.create_chatkit_session(
            user_id=request.user_id,
            chart_data=chart_data,
            timezone=user_tz,
            locale=locale,
        )

        logger.info(f"ChatKit сессия создана: {result['session_id']}")

        return CreateSessionResponse(
            client_secret=result['client_secret'],
            session_id=result['session_id']
        )

    except HTTPException:
        # Пробрасываем HTTP исключения как есть
        raise
    except Exception as e:
        logger.exception(f"Ошибка при создании ChatKit сессии: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при создании сессии: {str(e)}"
        )



@router.post(
    "/chat/prognostic-session",
    response_model=CreateSessionResponse,
    status_code=status.HTTP_200_OK,
    summary="Создать ChatKit сессию для прогностического агента",
    description="Создаёт сессию с отдельным прогностическим workflow (Agent Builder)"
)
async def create_prognostic_session(
    request: CreateSessionRequest,
    db: Session = Depends(get_db)
) -> CreateSessionResponse:
    """Создать ChatKit сессию для прогностического чата (отдельный workflow)."""
    try:
        locale = get_current_locale()
        user_id_clean = request.user_id.replace("user_", "") if request.user_id.startswith("user_") else request.user_id
        try:
            user_uuid = UUID(user_id_clean)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Некорректный формат user_id: {request.user_id}"
            )

        chart_data = natal_service.get_natal_chart_from_db(user_uuid, db)

        # Timezone уже есть в chart_data
        user_tz = chart_data.get('birth_data', {}).get('timezone') if chart_data else None

        openai_service = get_openai_service()
        result = await openai_service.create_chatkit_session(
            user_id=request.user_id,
            chart_data=chart_data,
            timezone=user_tz,
            locale=locale,
            workflow="prognostic",
        )

        logger.info(f"Прогностическая ChatKit сессия создана: {result['session_id']}")
        return CreateSessionResponse(
            client_secret=result['client_secret'],
            session_id=result['session_id']
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Ошибка при создании прогностической сессии: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при создании прогностической сессии: {str(e)}"
        )


@router.post(
    "/chat/prognostic",
    response_model=PrognosticChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Прогностический чат с AI",
    description="AI агент анализирует прогностические данные и отвечает на вопросы о будущем"
)
async def prognostic_chat(
    request: PrognosticChatRequest,
    db: Session = Depends(get_db)
) -> PrognosticChatResponse:
    """
    Прогностический чат: AI сам выбирает нужные прогностические методы
    (транзиты, прогрессии, дирекции, соляр) на основе вопроса пользователя.

    **Входные данные:**
    - `user_id`: UUID пользователя
    - `message`: Вопрос пользователя
    - `previous_response_id`: ID предыдущего ответа для продолжения диалога (опционально)

    **Возвращает:**
    - `response_text`: Текстовый ответ AI
    - `response_id`: ID для продолжения диалога
    - `tools_called`: Какие прогностические методы были использованы
    - `tokens`: Кол-во использованных токенов
    """
    try:
        locale = get_current_locale()
        # Парсим user_id
        user_id_clean = request.user_id.replace("user_", "") if request.user_id.startswith("user_") else request.user_id
        try:
            user_uuid = UUID(user_id_clean)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Некорректный формат user_id: {request.user_id}"
            )

        # Загружаем краткое описание карты для контекста AI
        chart_data = natal_service.get_natal_chart_from_db(user_uuid, db)
        chart_summary = None
        if chart_data:
            # Минимальное описание для системного промпта
            planets = chart_data.get("planets", [])
            chart_summary = ", ".join(
                f"{p.get('name', '?')}: {p.get('sign', '?')}" for p in planets[:10]
            )

        openai_service = get_openai_service()
        result = await openai_service.prognostic_chat(
            user_id=user_uuid,
            message=request.message,
            db_session=db,
            locale=locale,
            previous_response_id=request.previous_response_id,
            chart_summary=chart_summary,
        )

        return PrognosticChatResponse(
            response_text=result["response_text"],
            response_id=result["response_id"],
            tools_called=result.get("tools_called", []),
            tokens=result.get("tokens", 0),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Ошибка прогностического чата: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка прогностического чата: {str(e)}"
        )


@router.post(
    "/chat/prognostic-tool",
    status_code=status.HTTP_200_OK,
    summary="Выполнить prognostic tool-функцию",
    description="Диспетчер для client-side tool calls от ChatKit виджета"
)
async def execute_prognostic_tool(
    request: PrognosticToolRequest,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Endpoint-диспетчер для tool calls от ChatKit client-side.
    Вызывается фронтендом когда ChatKit получает function_call от AI.
    """
    try:
        user_id_clean = request.user_id.replace("user_", "") if request.user_id.startswith("user_") else request.user_id
        try:
            user_uuid = UUID(user_id_clean)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Некорректный формат user_id: {request.user_id}"
            )

        service = PrognosticToolsService(
            user_id=user_uuid,
            db_session=db,
            frontend_context=request.frontend_context,
        )
        result_json = service.dispatch(request.tool_name, request.arguments)

        import json as _json
        return _json.loads(result_json)

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception(f"Ошибка выполнения tool {request.tool_name}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка выполнения tool: {str(e)}"
        )


@router.post(
    "/chat/forecast-run",
    response_model=SaveForecastRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Сохранить активный forecast run",
    description="Сохраняет snapshot текущей рассчитанной прогностики для контекста ChatKit/Agent Builder"
)
async def save_forecast_run(
    request: SaveForecastRunRequest,
    db: Session = Depends(get_db)
) -> SaveForecastRunResponse:
    """Сохранить snapshot текущего расчета прогностики и сделать его активным."""
    try:
        user_id_clean = request.user_id.replace("user_", "") if request.user_id.startswith("user_") else request.user_id
        try:
            user_uuid = UUID(user_id_clean)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Некорректный формат user_id: {request.user_id}"
            )

        service = ForecastRunService(db)
        run = service.create_active_run(
            user_id=user_uuid,
            method=request.method,
            context_data=request.context_data,
            period_start=request.period_start,
            period_end=request.period_end,
            target_date=request.target_date,
            year=request.year,
            timezone=request.timezone,
            direction_type=request.direction_type,
            location_name=request.location_name,
            location_lat=request.location_lat,
            location_lon=request.location_lon,
        )

        return SaveForecastRunResponse(
            run_id=str(run.run_id),
            method=run.method,
            is_active=run.is_active,
            created_at=run.created_at.isoformat() if run.created_at else None,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Ошибка сохранения forecast run: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка сохранения forecast run: {str(e)}"
        )

"""
API эндпоинты для чата с OpenAI агентом (ChatKit интеграция)
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from loguru import logger
import os

from app.services.openai_service import get_openai_service
from app.services.natal_chart_service import NatalChartService
from app.database.connection import get_db

# Инициализация natal_service для загрузки карт из БД
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EPHE_PATH = os.getenv("SWISSEPH_EPHE_PATH", os.path.join(_PROJECT_ROOT, "swisseph", "ephe"))
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

        # Парсим user_id в UUID (убираем префикс "user_" если есть)
        user_id_clean = request.user_id.replace("user_", "") if request.user_id.startswith("user_") else request.user_id
        try:
            user_uuid = UUID(user_id_clean)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Некорректный формат user_id: {request.user_id}"
            )

        # Загружаем натальную карту из БД (если есть)
        chart_data = natal_service.get_natal_chart_for_interpretation(user_uuid, db)

        if chart_data:
            logger.info(f"Натальная карта загружена для пользователя {request.user_id}")
        else:
            logger.warning(f"Натальная карта для пользователя {request.user_id} не найдена. "
                          "Чат будет работать без данных карты.")
            # Можно либо вернуть ошибку, либо создать сессию без chart_data
            # Для тестирования оставляем chart_data = None, агент попросит данные

        # Создаём ChatKit сессию с данными карты
        openai_service = get_openai_service()
        result = await openai_service.create_chatkit_session(
            user_id=request.user_id,
            chart_data=chart_data
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


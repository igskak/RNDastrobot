"""
API эндпоинты для интерпретаций натальных карт через OpenAI
"""
from fastapi import APIRouter, HTTPException, status, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import select
from uuid import UUID
from typing import Optional, Dict, Any
from pydantic import BaseModel
import time

from app.database.connection import get_db
from app.database.models import NatalInterpretation
from app.auth.dependencies import AuthContext, ensure_client_access, require_auth
from app.i18n.context import get_current_locale
from app.services.openai_service import get_openai_service, OpenAIService
from app.services.natal_chart_service import NatalChartService
from app.utils.ephemeris import get_ephemeris_path
from loguru import logger

router = APIRouter()

# Инициализация сервисов
EPHE_PATH = get_ephemeris_path()
natal_service = NatalChartService(ephe_path=EPHE_PATH)


# ============================================================================
# Pydantic модели
# ============================================================================

class InterpretationResponse(BaseModel):
    """Ответ с интерпретацией"""
    user_id: UUID
    interpretation_type: str
    content: Dict[str, Any]
    cached: bool = False
    model: Optional[str] = None
    tokens_used: Optional[int] = None
    generation_time_ms: Optional[int] = None


class GenerateInterpretationRequest(BaseModel):
    """Запрос на генерацию интерпретации"""
    interpretation_type: str = "psychological_profile"
    force_regenerate: bool = False  # Игнорировать кэш и пересоздать


# ============================================================================
# Endpoints
# ============================================================================

@router.post(
    "/interpretations/{user_id}",
    response_model=InterpretationResponse,
    status_code=status.HTTP_200_OK,
    summary="Генерировать интерпретацию натальной карты",
    description="Генерирует психологический профиль через OpenAI API (с кэшированием)"
)
async def generate_interpretation(
    user_id: UUID,
    request: GenerateInterpretationRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> InterpretationResponse:
    """
    Генерировать интерпретацию натальной карты
    
    - Проверяет кэш по chart_hash
    - Если кэш актуален и force_regenerate=False, возвращает кэш
    - Иначе генерирует через OpenAI и сохраняет в кэш
    """
    start_time = time.time()
    locale = get_current_locale()

    try:
        ensure_client_access(db, http_request, auth, user_id, action="client.interpretation.generate")
        # 1. Получаем данные карты из БД (оптимизированный метод)
        t1 = time.time()
        chart_data = natal_service.get_natal_chart_for_interpretation(user_id, db)
        logger.debug(f"Получение карты из БД: {int((time.time() - t1) * 1000)}ms")
        if not chart_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Натальная карта для пользователя {user_id} не найдена"
            )

        # 2. Вычисляем хэш карты (статический метод, не требует OpenAI клиента)
        t2 = time.time()
        chart_hash = OpenAIService.calculate_chart_hash(chart_data)
        logger.debug(f"Вычисление хэша: {int((time.time() - t2) * 1000)}ms")

        # 3. Проверяем кэш (если не force_regenerate)
        if not request.force_regenerate:
            t3 = time.time()
            cached = db.execute(
                select(NatalInterpretation).where(
                    NatalInterpretation.user_id == user_id,
                    NatalInterpretation.interpretation_type == request.interpretation_type,
                    NatalInterpretation.locale == locale,
                    NatalInterpretation.chart_hash == chart_hash
                )
            ).scalar_one_or_none()
            logger.debug(f"Запрос кэша из БД: {int((time.time() - t3) * 1000)}ms")

            if cached:
                cache_load_time_ms = int((time.time() - start_time) * 1000)
                logger.info(f"Кэш найден для {user_id}/{request.interpretation_type} (загрузка: {cache_load_time_ms}ms)")
                return InterpretationResponse(
                    user_id=user_id,
                    interpretation_type=request.interpretation_type,
                    content=cached.content,
                    cached=True,
                    model=cached.openai_model,
                    tokens_used=cached.tokens_used,
                    generation_time_ms=cache_load_time_ms
                )
        
        # 4. Генерируем через OpenAI (только здесь инициализируем клиент)
        logger.info(f"Генерация интерпретации для {user_id}/{request.interpretation_type}")
        openai_service = get_openai_service()
        result = await openai_service.generate_psychological_profile(chart_data, locale=locale)
        
        generation_time_ms = int((time.time() - start_time) * 1000)
        
        # 5. Сохраняем в кэш (upsert)
        interpretation = NatalInterpretation(
            user_id=user_id,
            interpretation_type=request.interpretation_type,
            locale=locale,
            content=result['content'],
            chart_hash=chart_hash,
            openai_model=result['model'],
            openai_prompt_id=result.get('prompt_id'),
            prompt_version=result.get('prompt_version'),
            tokens_used=result.get('tokens'),
            generation_time_ms=generation_time_ms
        )
        
        # Upsert логика
        db.merge(interpretation)
        db.commit()
        
        return InterpretationResponse(
            user_id=user_id,
            interpretation_type=request.interpretation_type,
            content=result['content'],
            cached=False,
            model=result['model'],
            tokens_used=result.get('tokens'),
            generation_time_ms=generation_time_ms
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Ошибка генерации интерпретации: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка генерации интерпретации: {str(e)}"
        )


@router.get(
    "/interpretations/{user_id}/{interpretation_type}",
    response_model=InterpretationResponse,
    status_code=status.HTTP_200_OK,
    summary="Получить кэшированную интерпретацию"
)
async def get_interpretation(
    user_id: UUID,
    interpretation_type: str,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> InterpretationResponse:
    """Получить сохранённую интерпретацию (без генерации)"""
    ensure_client_access(db, request, auth, user_id, action="client.interpretation.get")
    locale = get_current_locale()
    cached = db.execute(
        select(NatalInterpretation).where(
            NatalInterpretation.user_id == user_id,
            NatalInterpretation.interpretation_type == interpretation_type,
            NatalInterpretation.locale == locale
        )
    ).scalar_one_or_none()
    
    if not cached:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Интерпретация {interpretation_type} для {user_id} не найдена"
        )
    
    return InterpretationResponse(
        user_id=user_id,
        interpretation_type=interpretation_type,
        content=cached.content,
        cached=True,
        model=cached.openai_model,
        tokens_used=cached.tokens_used,
        generation_time_ms=cached.generation_time_ms
    )

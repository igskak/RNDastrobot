"""
API эндпоинты для чата с OpenAI агентом (ChatKit интеграция + прогностический чат)
"""
import json as _json

from fastapi import APIRouter, HTTPException, status, Depends, Request, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List, Literal
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from loguru import logger

from app.services.openai_service import get_openai_service
from app.services.natal_chart_service import NatalChartService
from app.services.prognostic_tools_service import PrognosticToolsService
from app.services.forecast_run_service import ForecastRunService
from app.database.connection import get_db
from app.database.models import ChatConversation, ChatMessage
from app.auth.dependencies import AuthContext, ensure_client_access, require_auth
from app.i18n.context import get_current_locale
from app.utils.ephemeris import get_ephemeris_path

# Инициализация natal_service для загрузки карт из БД
EPHE_PATH = get_ephemeris_path()
natal_service = NatalChartService(ephe_path=EPHE_PATH)

router = APIRouter()


def _parse_user_uuid(raw_user_id: str) -> UUID:
    user_id_clean = raw_user_id.replace("user_", "") if raw_user_id.startswith("user_") else raw_user_id
    try:
        return UUID(user_id_clean)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Некорректный формат user_id: {raw_user_id}"
        ) from exc


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


class ChatStreamRequest(BaseModel):
    """Запрос для streaming чата (custom chat UI)."""
    user_id: str
    message: str
    mode: Literal["natal", "prognostic"] = "natal"
    previous_response_id: Optional[str] = None
    frontend_context: Optional[Dict[str, Any]] = None
    conversation_id: Optional[str] = None


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
    http_request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
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
        user_uuid = _parse_user_uuid(request.user_id)
        ensure_client_access(db, http_request, auth, user_uuid, action="client.chat.session")

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
    http_request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> CreateSessionResponse:
    """Создать ChatKit сессию для прогностического чата (отдельный workflow)."""
    try:
        locale = get_current_locale()
        user_uuid = _parse_user_uuid(request.user_id)
        ensure_client_access(db, http_request, auth, user_uuid, action="client.chat.prognostic_session")

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
    http_request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
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
        user_uuid = _parse_user_uuid(request.user_id)
        ensure_client_access(db, http_request, auth, user_uuid, action="client.chat.prognostic")

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
    http_request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> Dict[str, Any]:
    """
    Endpoint-диспетчер для tool calls от ChatKit client-side.
    Вызывается фронтендом когда ChatKit получает function_call от AI.
    """
    try:
        user_uuid = _parse_user_uuid(request.user_id)
        ensure_client_access(db, http_request, auth, user_uuid, action="client.chat.prognostic_tool")

        service = PrognosticToolsService(
            user_id=user_uuid,
            db_session=db,
            frontend_context=request.frontend_context,
        )
        result_json = service.dispatch(request.tool_name, request.arguments)

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
    http_request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> SaveForecastRunResponse:
    """Сохранить snapshot текущего расчета прогностики и сделать его активным."""
    try:
        user_uuid = _parse_user_uuid(request.user_id)
        ensure_client_access(db, http_request, auth, user_uuid, action="client.chat.forecast_run")

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


@router.post(
    "/chat/stream",
    status_code=status.HTTP_200_OK,
    summary="Streaming чат (SSE)",
    description="Streaming чат через Server-Sent Events для custom chat UI"
)
async def chat_stream(
    request: ChatStreamRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    """
    SSE streaming endpoint для custom chat UI.

    Поддерживает два режима:
    - natal: чат с контекстом натальной карты (без tool calling)
    - prognostic: чат с прогностическими инструментами (tool calling)

    Возвращает SSE поток с событиями:
    - data: {"type":"token","text":"..."} — токен ответа
    - data: {"type":"tool_call","name":"..."} — вызов инструмента
    - data: {"type":"tool_result","name":"..."} — результат инструмента
    - data: {"type":"done","response_id":"..."} — завершение
    - data: {"type":"error","message":"..."} — ошибка
    """
    user_uuid = _parse_user_uuid(request.user_id)
    ensure_client_access(db, http_request, auth, user_uuid, action="client.chat.stream")

    locale = get_current_locale()
    openai_service = get_openai_service()

    # Загружаем данные карты
    chart_data = natal_service.get_natal_chart_from_db(user_uuid, db)
    user_tz = chart_data.get('birth_data', {}).get('timezone') if chart_data else None

    # ---- Conversation persistence ----
    import uuid as _uuid
    conv_id = None
    if request.conversation_id:
        try:
            conv_id = _uuid.UUID(request.conversation_id)
        except ValueError:
            pass

    # Find or create conversation
    conversation = None
    if conv_id:
        conversation = db.query(ChatConversation).filter(
            ChatConversation.id == conv_id,
            ChatConversation.user_id == user_uuid,
        ).first()

    if not conversation:
        conversation = ChatConversation(
            user_id=user_uuid,
            mode=request.mode,
            title=request.message[:80],
        )
        db.add(conversation)
        db.flush()

    # Save user message
    db.add(ChatMessage(conversation_id=conversation.id, role="user", content=request.message))
    db.commit()

    conv_id_str = str(conversation.id)
    conv_uuid = conversation.id

    # Pre-load conversation data while DB session is still active
    # (lazy loading won't work inside the async generator after session closes)
    cached_workflow_state = dict(conversation.workflow_state or {})
    cached_conv_messages = [
        {"role": m.role, "content": m.content}
        for m in conversation.messages
    ] if conversation.messages else []

    async def sse_generator():
        assistant_text = ""
        response_id = None
        new_workflow_state = None
        # Send an SSE comment to force the first flush immediately
        yield ": keepalive\n\n"
        try:
            if request.mode == "prognostic":
                chart_summary = None
                if chart_data:
                    planets = chart_data.get("planets", [])
                    chart_summary = ", ".join(
                        f"{p.get('name', '?')}: {p.get('sign', '?')}" for p in planets[:10]
                    )

                stream = openai_service.prognostic_chat_stream(
                    user_id=user_uuid,
                    message=request.message,
                    db_session=db,
                    locale=locale,
                    previous_response_id=request.previous_response_id,
                    chart_summary=chart_summary,
                    frontend_context=request.frontend_context,
                )
            else:
                stream = openai_service.natal_chat_stream(
                    user_id=request.user_id,
                    message=request.message,
                    chart_data=chart_data,
                    timezone=user_tz,
                    locale=locale,
                    workflow_state=cached_workflow_state,
                    conversation_messages=cached_conv_messages,
                )

            async for event in stream:
                if event.get("type") == "token":
                    assistant_text += event.get("text", "")
                elif event.get("type") == "done":
                    response_id = event.get("response_id")
                    new_workflow_state = event.pop("workflow_state", None)
                    # Include conversation_id in the done event
                    event["conversation_id"] = conv_id_str

                yield f"data: {_json.dumps(event, ensure_ascii=False)}\n\n"

        except Exception as e:
            logger.exception(f"SSE stream error: {e}")
            error_event = {"type": "error", "message": str(e)}
            yield f"data: {_json.dumps(error_event, ensure_ascii=False)}\n\n"
        finally:
            # Persist assistant message with a fresh DB session
            # (the original session from Depends(get_db) is already closed)
            from app.database.connection import get_db_session
            save_db = get_db_session()
            try:
                if assistant_text.strip():
                    save_db.add(ChatMessage(conversation_id=conv_uuid, role="assistant", content=assistant_text))
                update_fields = {"updated_at": func.now()}
                if response_id:
                    update_fields["last_response_id"] = response_id
                if new_workflow_state:
                    update_fields["workflow_state"] = new_workflow_state
                save_db.query(ChatConversation).filter(
                    ChatConversation.id == conv_uuid
                ).update(update_fields)
                save_db.commit()
            except Exception as e:
                save_db.rollback()
                logger.warning(f"Failed to persist chat message: {e}")
            finally:
                save_db.close()

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/chat/transcribe",
    status_code=status.HTTP_200_OK,
    summary="Speech-to-Text (Whisper)",
    description="Транскрибирует аудио в текст через OpenAI Whisper API"
)
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: Optional[str] = Form(None),
    http_request: Request = None,
    auth: AuthContext = Depends(require_auth),
):
    """
    Транскрибирует аудио файл в текст через Whisper API.

    Принимает аудио в форматах: webm, mp3, mp4, wav, ogg, flac.
    Опционально можно указать язык (ISO-639-1: en, ru, uk) для повышения точности.

    Возвращает: {"text": "транскрибированный текст"}
    """
    ALLOWED_TYPES = {
        "audio/webm", "audio/ogg", "audio/mp3", "audio/mpeg",
        "audio/mp4", "audio/wav", "audio/flac", "audio/x-m4a",
        "video/webm",  # некоторые браузеры отдают video/webm для аудио
    }
    MAX_SIZE = 25 * 1024 * 1024  # 25MB — лимит Whisper API

    base_type = (audio.content_type or "").split(";")[0].strip()
    if base_type and base_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported audio format: {audio.content_type}. Supported: webm, ogg, mp3, mp4, wav, flac"
        )

    try:
        content = await audio.read()

        if len(content) > MAX_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Audio file too large. Maximum 25MB."
            )

        if len(content) < 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Audio file too small or empty."
            )

        # Создаём file-like object для Whisper API
        import io
        ext = "webm"
        if audio.filename:
            ext = audio.filename.rsplit(".", 1)[-1] if "." in audio.filename else "webm"
        audio_file = io.BytesIO(content)
        audio_file.name = f"audio.{ext}"

        # Маппинг локали на язык Whisper
        lang = language
        if lang and len(lang) > 2:
            lang = lang[:2]  # "ru-RU" → "ru"

        openai_service = get_openai_service()
        text = await openai_service.transcribe_audio(
            audio_file=audio_file,
            language=lang,
        )

        return {"text": text}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Transcription error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription failed: {str(e)}"
        )


# ============================================================================
# Chat conversation history
# ============================================================================

@router.get(
    "/chat/conversations",
    status_code=status.HTTP_200_OK,
    summary="Список разговоров клиента",
)
async def list_conversations(
    user_id: str,
    mode: Optional[str] = None,
    http_request: Request = None,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    user_uuid = _parse_user_uuid(user_id)
    ensure_client_access(db, http_request, auth, user_uuid, action="client.chat.conversations")

    q = db.query(ChatConversation).filter(ChatConversation.user_id == user_uuid)
    if mode:
        q = q.filter(ChatConversation.mode == mode)
    conversations = q.order_by(ChatConversation.updated_at.desc()).limit(50).all()

    return [
        {
            "id": str(c.id),
            "mode": c.mode,
            "title": c.title,
            "last_response_id": c.last_response_id,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        }
        for c in conversations
    ]


@router.get(
    "/chat/conversations/{conversation_id}/messages",
    status_code=status.HTTP_200_OK,
    summary="Сообщения разговора",
)
async def get_conversation_messages(
    conversation_id: str,
    http_request: Request = None,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    import uuid as _uuid
    try:
        conv_uuid = _uuid.UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid conversation_id")

    conversation = db.query(ChatConversation).filter(ChatConversation.id == conv_uuid).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    ensure_client_access(db, http_request, auth, conversation.user_id, action="client.chat.messages")

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.conversation_id == conv_uuid)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )

    return {
        "conversation": {
            "id": str(conversation.id),
            "mode": conversation.mode,
            "title": conversation.title,
            "last_response_id": conversation.last_response_id,
        },
        "messages": [
            {
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
    }


@router.delete(
    "/chat/conversations/{conversation_id}",
    status_code=status.HTTP_200_OK,
    summary="Удалить разговор",
)
async def delete_conversation(
    conversation_id: str,
    http_request: Request = None,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    import uuid as _uuid
    try:
        conv_uuid = _uuid.UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid conversation_id")

    conversation = db.query(ChatConversation).filter(ChatConversation.id == conv_uuid).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    ensure_client_access(db, http_request, auth, conversation.user_id, action="client.chat.delete")

    db.delete(conversation)
    db.commit()
    return {"ok": True}

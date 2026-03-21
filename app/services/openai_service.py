"""
Сервис для работы с OpenAI API

Используется для генерации интерпретаций натальных карт через OpenAI.
Поддерживает кэширование результатов и использование prompt ID из Playground.
"""
import os
import json
import hashlib
from typing import AsyncGenerator, Dict, Any, Optional, List
from uuid import UUID
from openai import OpenAI
from sqlalchemy.orm import Session
from loguru import logger

from app.i18n.context import get_current_locale
from app.i18n.locale import DEFAULT_LOCALE, normalize_locale
from app.i18n.reference_lookup import LocalizedReferenceLookup


class OpenAIService:
    """Сервис для генерации интерпретаций через OpenAI API"""

    # Классические планеты для психопрофиля
    CLASSICAL_PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']

    def __init__(self):
        """Инициализация клиента OpenAI"""
        self.api_key = os.getenv('OPENAI_API_KEY')
        self.model = os.getenv('OPENAI_MODEL', 'gpt-4.1')
        self.prompt_id = os.getenv('OPENAI_PROMPT_ID')
        self.prompt_version = os.getenv('OPENAI_PROMPT_VERSION', '1.0')
        self.workflow_id = os.getenv('OPENAI_WORKFLOW_ID', 'wf_696ac18a25408190a38d8f44318c8c5a0b7269c5cba0bf81')
        self.prognostic_workflow_id = os.getenv('OPENAI_PROGNOSTIC_WORKFLOW_ID', 'wf_6987cc5e9ff08190aeac925da8e921ea00c988f7d7727d42')

        if not self.api_key:
            raise ValueError("OPENAI_API_KEY не найден в переменных окружения")

        self.client = OpenAI(api_key=self.api_key)
        logger.info(f"OpenAI сервис инициализирован (модель: {self.model}, workflow: {self.workflow_id}, prognostic: {self.prognostic_workflow_id})")

    @staticmethod
    def _resolve_locale(locale: Optional[str]) -> str:
        """Normalize locale and guarantee fallback to en."""
        return (
            normalize_locale(locale)
            or normalize_locale(get_current_locale())
            or DEFAULT_LOCALE
        )
    
    @staticmethod
    def calculate_chart_hash(chart_data: Dict[str, Any]) -> str:
        """
        Вычислить хэш ключевых параметров карты для кэширования

        Args:
            chart_data: Данные натальной карты

        Returns:
            SHA256 хэш в hex формате
        """
        # Берём только данные 7 классических планет
        CLASSICAL_PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']
        key_data = {
            'planets': [
                {
                    'name': p['name'],
                    'sign': p['sign'],
                    'degree': round(p.get('degree_in_sign', 0), 2),
                    'house': p.get('house'),
                    'retrograde': p.get('retrograde', False),
                    'dignity': p.get('dignity'),
                    'special_roles': sorted(p.get('special_roles', [])),
                    'critical_degrees': sorted(p.get('critical_degrees', [])),
                    'sun_relation': p.get('sun_relation'),
                    'aspect_harmony': p.get('aspect_harmony'),
                    'is_peregrine': p.get('is_peregrine', False),
                    'is_stationary': p.get('is_stationary', False),
                }
                for p in chart_data.get('planets', [])
                if p['name'] in CLASSICAL_PLANETS
            ],
            'aspects': [
                {
                    'p1': a['planet_1'],
                    'p2': a['planet_2'],
                    'type': a['aspect_type'],
                    'orb': round(a['orb'], 1),
                    'is_partile': a.get('is_partile', False),
                }
                for a in chart_data.get('aspects', [])
                if a['planet_1'] in CLASSICAL_PLANETS
                and a['planet_2'] in CLASSICAL_PLANETS
            ]
        }
        
        key_json = json.dumps(key_data, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(key_json.encode('utf-8')).hexdigest()
    
    def prepare_psychological_profile_data(self, chart_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Подготовить данные для отправки в OpenAI (только 7 планет)

        Args:
            chart_data: Полные данные натальной карты

        Returns:
            Очищенные данные для психопрофиля
        """
        planets = [
            {
                'name': p['name'],
                'sign': p['sign'],
                'degree_in_sign': p.get('degree_in_sign'),
                'degree_in_sign_formatted': p.get('degree_in_sign_formatted'),
                'house': p.get('house'),
                'retrograde': p.get('retrograde', False),
                'element': p.get('element'),
                'mode': p.get('mode'),
                'dignity': p.get('dignity'),
                'strength_score': p.get('strength_score'),
                'special_roles': p.get('special_roles', []),
                'critical_degrees': p.get('critical_degrees', []),
                'sun_relation': p.get('sun_relation'),
                'aspect_harmony': p.get('aspect_harmony'),
                'is_peregrine': p.get('is_peregrine', False),
                'is_stationary': p.get('is_stationary', False),
                'stationary_type': p.get('stationary_type'),
                'is_elevated': p.get('is_elevated', False),
                'in_intercepted_sign': p.get('in_intercepted_sign', False),
            }
            for p in chart_data.get('planets', [])
            if p['name'] in self.CLASSICAL_PLANETS
        ]

        aspects = [
            {
                'planet_1': a['planet_1'],
                'planet_2': a['planet_2'],
                'aspect_type': a['aspect_type'],
                'orb': a['orb'],
                'is_partile': a.get('is_partile', False),
                'harmonic_type': a.get('harmonic_type'),
            }
            for a in chart_data.get('aspects', [])
            if a['planet_1'] in self.CLASSICAL_PLANETS
            and a['planet_2'] in self.CLASSICAL_PLANETS
        ]

        return {
            'planets': planets,
            'aspects': aspects
        }

    def build_planet_sign_psych(
        self,
        psych_data: Dict[str, Any],
        locale: Optional[str] = None,
    ) -> list:
        """
        Собрать психологический контекст для всех планет с их знаками.

        Для каждой планеты из psych_data извлекает:
        - функции психики планеты из ref_planet_psych_functions
        - качества знака из ref_sign_properties

        Args:
            psych_data: Результат prepare_psychological_profile_data

        Returns:
            Список объектов вида:
            [
                {
                    "planet_name": "Sun",
                    "sign_name": "Cancer",
                    "planet_psych_functions": "...",
                    "sign_qualities": "..."
                },
                ...
            ]
        """
        from app.database.connection import get_db_session

        resolved_locale = self._resolve_locale(locale)
        result = []

        try:
            with get_db_session() as session:
                lookup = LocalizedReferenceLookup(session)
                for p in psych_data.get("planets", []):
                    planet = p["name"]
                    sign = p["sign"]

                    # Получаем локализованные функции психики планеты с fallback -> en
                    func = lookup.fetch_localized_scalar(
                        base_table="ref_planet_psych_functions",
                        key_column="planet",
                        key_value=planet,
                        base_value_column="function_extended",
                        i18n_table="ref_planet_psych_functions_i18n",
                        i18n_value_column="function_extended",
                        locale=resolved_locale,
                    )

                    # Получаем локализованные качества знака с fallback -> en
                    qualities = lookup.fetch_localized_scalar(
                        base_table="ref_sign_properties",
                        key_column="sign",
                        key_value=sign,
                        base_value_column="qualities",
                        i18n_table="ref_sign_properties_i18n",
                        i18n_value_column="qualities",
                        locale=resolved_locale,
                    )

                    result.append({
                        "planet_name": planet,
                        "sign_name": sign,
                        "planet_psych_functions": func or "",
                        "sign_qualities": qualities or "",
                    })

        except Exception as e:
            logger.error(f"Ошибка при сборе planet_sign_psych: {e}")
            # Возвращаем пустой список в случае ошибки
            return []

        return result
    
    async def generate_psychological_profile(
        self,
        chart_data: Dict[str, Any],
        locale: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Генерация психологического профиля через OpenAI API
        
        Использует prompt ID из OpenAI Playground.
        
        Args:
            chart_data: Данные натальной карты
            
        Returns:
            Словарь с результатом:
            {
                'content': {...},  # Ответ от OpenAI
                'model': 'gpt-4.1',
                'tokens': 1234,
                'prompt_id': '...'
            }
        """
        profile_data = self.prepare_psychological_profile_data(chart_data)
        data_json = json.dumps(profile_data, ensure_ascii=False, indent=2)
        resolved_locale = self._resolve_locale(locale)
        
        logger.info(f"Отправка запроса в OpenAI (модель: {self.model}, prompt_id: {self.prompt_id})")
        logger.debug(f"Размер данных: {len(data_json)} символов")
        
        try:
            # Используем Responses API для работы с сохранёнными промптами
            response = self.client.responses.create(
                prompt={
                    "id": self.prompt_id,
                    "variables": {
                        "chart_data": data_json,
                        "locale": resolved_locale,
                    }
                }
            )

            # Получаем текст ответа
            content_text = response.output_text
            tokens_used = response.usage.total_tokens if hasattr(response, 'usage') and response.usage else 0

            # Пробуем распарсить JSON из ответа
            try:
                content = json.loads(content_text)
            except json.JSONDecodeError:
                # Если не JSON, возвращаем как текст
                content = {"raw_text": content_text}

            logger.info(f"OpenAI ответ получен ({tokens_used} токенов)")

            return {
                'content': content,
                'model': self.model,
                'tokens': tokens_used,
                'prompt_id': self.prompt_id,
                'prompt_version': self.prompt_version
            }

        except Exception as e:
            logger.error(f"Ошибка OpenAI API: {str(e)}")
            raise

    # ------------------------------------------------------------------
    # Prognostic Chat (Responses API + function calling)
    # ------------------------------------------------------------------

    async def prognostic_chat(
        self,
        user_id: UUID,
        message: str,
        db_session: Session,
        locale: Optional[str] = None,
        previous_response_id: Optional[str] = None,
        chart_summary: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Прогностический чат с AI через Responses API + tool calling.

        AI решает какие прогностические методы вызвать на основе вопроса,
        бэкенд исполняет tool calls и возвращает результаты.

        Args:
            user_id: UUID пользователя
            message: Сообщение пользователя
            db_session: SQLAlchemy сессия
            previous_response_id: ID предыдущего ответа для продолжения диалога
            chart_summary: Краткое описание натальной карты (для контекста AI)

        Returns:
            {
                'response_text': str,       # Текстовый ответ AI
                'response_id': str,         # ID ответа для продолжения диалога
                'tools_called': List[str],  # Какие tool-функции были вызваны
                'tokens': int,
            }
        """
        from app.services.prognostic_tools_service import PROGNOSTIC_TOOLS, PrognosticToolsService

        tool_service = PrognosticToolsService(user_id=user_id, db_session=db_session)
        resolved_locale = self._resolve_locale(locale)

        # Системный промпт для прогностического агента
        system_instructions = (
            "Ты — профессиональный астролог-консультант. "
            "У тебя есть инструменты для получения прогностических данных пользователя. "
            "Используй их чтобы ответить на вопрос. "
            "Правила:\n"
            "1. Перед интерпретацией контекстного вопроса про 'эту прогностику' сначала вызови get_active_forecast_context\n"
            "2. Для вопросов о текущем моменте → get_current_transits\n"
            "3. Для прогноза на период (неделя/месяц) → get_transit_events\n"
            "4. Для внутренних изменений → get_progressions\n"
            "5. Для ключевых жизненных событий → get_directions\n"
            "6. Для годового прогноза → get_solar_return\n"
            "7. Для комплексного прогноза комбинируй несколько методов\n"
            "8. Отвечай на языке пользователя согласно его локали (en/uk/ru), развёрнуто и понятно\n"
            "9. Не упоминай технические детали (орбы, градусы) — интерпретируй смысл\n"
        )
        if chart_summary:
            system_instructions += f"\nДанные натальной карты:\n{chart_summary}\n"
        system_instructions += f"\n10. Предпочтительная локаль пользователя: {resolved_locale}\n"

        # Собираем input
        input_messages: List[Dict[str, Any]] = [
            {"role": "developer", "content": system_instructions},
            {"role": "user", "content": message},
        ]

        tools_called: List[str] = []
        max_iterations = 5  # защита от бесконечного цикла

        try:
            # Первый вызов
            create_kwargs: Dict[str, Any] = {
                "model": self.model,
                "input": input_messages,
                "tools": PROGNOSTIC_TOOLS,
            }
            if previous_response_id:
                create_kwargs["previous_response_id"] = previous_response_id

            response = self.client.responses.create(**create_kwargs)

            # Tool execution loop
            for _ in range(max_iterations):
                # Ищем tool calls в output
                function_calls = [
                    item for item in response.output
                    if item.type == "function_call"
                ]

                if not function_calls:
                    break  # AI дал финальный ответ

                # Исполняем каждый tool call
                tool_results = []
                for fc in function_calls:
                    tool_name = fc.name
                    arguments = json.loads(fc.arguments)
                    tools_called.append(tool_name)

                    logger.info(f"Prognostic tool call: {tool_name}({arguments})")
                    result_json = tool_service.dispatch(tool_name, arguments)

                    tool_results.append({
                        "type": "function_call_output",
                        "call_id": fc.call_id,
                        "output": result_json,
                    })

                # Отправляем результаты обратно в AI
                response = self.client.responses.create(
                    model=self.model,
                    previous_response_id=response.id,
                    input=tool_results,
                    tools=PROGNOSTIC_TOOLS,
                )

            # Извлекаем финальный текст
            response_text = response.output_text or ""
            tokens = response.usage.total_tokens if hasattr(response, 'usage') and response.usage else 0

            logger.info(f"Prognostic chat done: {len(tools_called)} tools called, {tokens} tokens")

            return {
                "response_text": response_text,
                "response_id": response.id,
                "tools_called": tools_called,
                "tokens": tokens,
            }

        except Exception as e:
            logger.error(f"Prognostic chat error: {e}")
            raise

    # ------------------------------------------------------------------
    # Speech-to-Text (Whisper API)
    # ------------------------------------------------------------------

    async def transcribe_audio(
        self,
        audio_file,
        language: Optional[str] = None,
    ) -> str:
        """
        Transcribe audio using OpenAI Whisper API.

        Args:
            audio_file: File-like object with audio data
            language: Optional ISO-639-1 language hint (e.g. 'en', 'ru', 'uk')

        Returns:
            Transcribed text string
        """
        try:
            kwargs: Dict[str, Any] = {
                "model": "whisper-1",
                "file": audio_file,
            }
            if language:
                kwargs["language"] = language

            transcription = self.client.audio.transcriptions.create(**kwargs)
            text = transcription.text or ""
            logger.info(f"Whisper transcription: {len(text)} chars, lang={language}")
            return text

        except Exception as e:
            logger.error(f"Whisper transcription error: {e}")
            raise

    # ------------------------------------------------------------------
    # Streaming Chat (SSE) — custom chat UI
    # ------------------------------------------------------------------

    def _build_natal_system_prompt(
        self,
        chart_data: Optional[Dict[str, Any]],
        timezone: Optional[str],
        locale: str,
    ) -> str:
        """Build system prompt for natal chat with all chart context."""
        parts = [
            "Ты — профессиональный астролог-консультант. "
            "Ты анализируешь натальную карту пользователя и отвечаешь на вопросы "
            "о его характере, психологическом профиле, потенциале и жизненных темах.",
            "",
            "Правила:",
            "1. Отвечай на языке пользователя согласно его локали, развёрнуто и понятно",
            "2. Не упоминай технические детали (орбы, градусы) — интерпретируй смысл",
            "3. Используй психологический подход к интерпретации",
            f"4. Предпочтительная локаль пользователя: {locale}",
        ]

        if timezone:
            parts.append(f"5. Таймзона пользователя: {timezone}")

        if chart_data:
            planets = chart_data.get("planets", [])
            summary = ", ".join(
                f"{p.get('name', '?')}: {p.get('sign', '?')}" for p in planets[:10]
            )
            if summary:
                parts.append(f"\nКраткая карта: {summary}")

            parts.append(f"\nПолные данные натальной карты:\n{json.dumps(chart_data, ensure_ascii=False)}")

            try:
                psych_data = self.prepare_psychological_profile_data(chart_data)
                parts.append(
                    f"\nДанные для психопрофиля (7 классических планет):\n"
                    f"{json.dumps(psych_data, ensure_ascii=False)}"
                )

                planet_sign_psych = self.build_planet_sign_psych(psych_data, locale=locale)
                if planet_sign_psych:
                    parts.append(
                        f"\nПсихологические функции планет и качества знаков:\n"
                        f"{json.dumps(planet_sign_psych, ensure_ascii=False)}"
                    )
            except Exception as e:
                logger.warning(f"Ошибка подготовки psych данных для streaming: {e}")

        return "\n".join(parts)

    def _build_prognostic_system_prompt(
        self,
        chart_summary: Optional[str],
        locale: str,
    ) -> str:
        """Build system prompt for prognostic chat (reuses existing logic)."""
        system_instructions = (
            "Ты — профессиональный астролог-консультант. "
            "У тебя есть инструменты для получения прогностических данных пользователя. "
            "Используй их чтобы ответить на вопрос. "
            "Правила:\n"
            "1. Перед интерпретацией контекстного вопроса про 'эту прогностику' сначала вызови get_active_forecast_context\n"
            "2. Для вопросов о текущем моменте → get_current_transits\n"
            "3. Для прогноза на период (неделя/месяц) → get_transit_events\n"
            "4. Для внутренних изменений → get_progressions\n"
            "5. Для ключевых жизненных событий → get_directions\n"
            "6. Для годового прогноза → get_solar_return\n"
            "7. Для комплексного прогноза комбинируй несколько методов\n"
            "8. Отвечай на языке пользователя согласно его локали (en/uk/ru), развёрнуто и понятно\n"
            "9. Не упоминай технические детали (орбы, градусы) — интерпретируй смысл\n"
        )
        if chart_summary:
            system_instructions += f"\nДанные натальной карты:\n{chart_summary}\n"
        system_instructions += f"\n10. Предпочтительная локаль пользователя: {locale}\n"
        return system_instructions

    async def natal_chat_stream(
        self,
        user_id: str,
        message: str,
        chart_data: Optional[Dict[str, Any]] = None,
        timezone: Optional[str] = None,
        locale: Optional[str] = None,
        previous_response_id: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Streaming natal chat via Responses API (no tool calling).

        Yields SSE-compatible dicts:
            {"type": "token", "text": "..."}
            {"type": "done", "response_id": "..."}
            {"type": "error", "message": "..."}
        """
        resolved_locale = self._resolve_locale(locale)
        system_prompt = self._build_natal_system_prompt(chart_data, timezone, resolved_locale)

        input_messages: List[Dict[str, Any]] = [
            {"role": "developer", "content": system_prompt},
            {"role": "user", "content": message},
        ]

        create_kwargs: Dict[str, Any] = {
            "model": self.model,
            "input": input_messages,
            "stream": True,
        }
        if previous_response_id:
            create_kwargs["previous_response_id"] = previous_response_id

        try:
            stream = self.client.responses.create(**create_kwargs)

            response_id = None
            for event in stream:
                if event.type == "response.output_text.delta":
                    yield {"type": "token", "text": event.delta}
                elif event.type == "response.completed":
                    response_id = event.response.id
                    break

            yield {"type": "done", "response_id": response_id or ""}

        except Exception as e:
            logger.error(f"Natal chat stream error: {e}")
            yield {"type": "error", "message": str(e)}

    async def prognostic_chat_stream(
        self,
        user_id: UUID,
        message: str,
        db_session: Session,
        locale: Optional[str] = None,
        previous_response_id: Optional[str] = None,
        chart_summary: Optional[str] = None,
        frontend_context: Optional[Dict[str, Any]] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Streaming prognostic chat with tool calling via Responses API.

        Yields SSE-compatible dicts:
            {"type": "token", "text": "..."}
            {"type": "tool_call", "name": "..."}
            {"type": "tool_result", "name": "..."}
            {"type": "done", "response_id": "..."}
            {"type": "error", "message": "..."}
        """
        from app.services.prognostic_tools_service import PROGNOSTIC_TOOLS, PrognosticToolsService

        tool_service = PrognosticToolsService(
            user_id=user_id,
            db_session=db_session,
            frontend_context=frontend_context,
        )
        resolved_locale = self._resolve_locale(locale)
        system_prompt = self._build_prognostic_system_prompt(chart_summary, resolved_locale)

        input_messages: List[Dict[str, Any]] = [
            {"role": "developer", "content": system_prompt},
            {"role": "user", "content": message},
        ]

        create_kwargs: Dict[str, Any] = {
            "model": self.model,
            "input": input_messages,
            "tools": PROGNOSTIC_TOOLS,
            "stream": True,
        }
        if previous_response_id:
            create_kwargs["previous_response_id"] = previous_response_id

        max_iterations = 5

        try:
            stream = self.client.responses.create(**create_kwargs)

            for _ in range(max_iterations):
                response_id = None
                function_calls = []
                current_fc = {}

                for event in stream:
                    if event.type == "response.output_text.delta":
                        yield {"type": "token", "text": event.delta}

                    elif event.type == "response.output_item.done":
                        item = event.item
                        if getattr(item, 'type', None) == 'function_call':
                            current_fc = {
                                "name": item.name,
                                "call_id": item.call_id,
                                "arguments": item.arguments,
                            }
                            function_calls.append(current_fc)
                            yield {"type": "tool_call", "name": item.name}

                    elif event.type == "response.completed":
                        response_id = event.response.id
                        break

                if not function_calls:
                    yield {"type": "done", "response_id": response_id or ""}
                    return

                # Execute tool calls and feed results back
                tool_results = []
                for fc in function_calls:
                    tool_name = fc["name"]
                    arguments = json.loads(fc["arguments"])
                    logger.info(f"Prognostic stream tool call: {tool_name}({arguments})")
                    result_json = tool_service.dispatch(tool_name, arguments)
                    yield {"type": "tool_result", "name": tool_name}

                    tool_results.append({
                        "type": "function_call_output",
                        "call_id": fc["call_id"],
                        "output": result_json,
                    })

                # Continue with tool results
                stream = self.client.responses.create(
                    model=self.model,
                    previous_response_id=response_id,
                    input=tool_results,
                    tools=PROGNOSTIC_TOOLS,
                    stream=True,
                )

            # If we exhaust iterations, still send done
            yield {"type": "done", "response_id": response_id or ""}

        except Exception as e:
            logger.error(f"Prognostic chat stream error: {e}")
            yield {"type": "error", "message": str(e)}

    async def create_chatkit_session(
        self,
        user_id: str,
        chart_data: Optional[Dict[str, Any]] = None,
        timezone: Optional[str] = None,
        locale: Optional[str] = None,
        workflow: str = "natal",
    ) -> Dict[str, Any]:
        """
        Создать ChatKit сессию и вернуть client_secret для фронтенда.

        Args:
            user_id: Идентификатор пользователя
            chart_data: Данные натальной карты для передачи в workflow (опционально)
            timezone: Таймзона пользователя
            workflow: Какой workflow использовать — "natal" (по умолчанию) или "prognostic"

        Returns:
            {'client_secret': str, 'session_id': str}
        """
        wf_id = self.prognostic_workflow_id if workflow == "prognostic" else self.workflow_id
        resolved_locale = self._resolve_locale(locale)
        logger.info(f"Создание ChatKit сессии для workflow {wf_id} ({workflow})")

        try:
            # Подготовка state_variables с данными карты
            state_variables: Dict[str, Any] = {}

            if chart_data:
                # 1) Полные данные карты для общего агента
                state_variables["chart_data"] = json.dumps(
                    chart_data,
                    ensure_ascii=False,
                )

                # 2) Очищенные данные для психо-профиля
                try:
                    psych_data = self.prepare_psychological_profile_data(chart_data)
                    state_variables["prepare_psychological_profile_data"] = json.dumps(
                        psych_data,
                        ensure_ascii=False,
                    )

                    # 3) Психологические функции планет + качества знаков (вариант B)
                    planet_sign_psych = self.build_planet_sign_psych(
                        psych_data,
                        locale=resolved_locale,
                    )
                    if planet_sign_psych:
                        state_variables["planet_sign_psych"] = json.dumps(
                            planet_sign_psych,
                            ensure_ascii=False,
                        )
                        logger.info(f"Добавлено planet_sign_psych для {len(planet_sign_psych)} планет")

                except Exception as prep_err:
                    # Не роняем создание сессии, просто логируем проблему подготовки
                    logger.error(
                        f"Ошибка подготовки prepare_psychological_profile_data: {prep_err}"
                    )

            # Добавляем state variables для прогностики
            state_variables["user_id"] = user_id
            state_variables["locale"] = resolved_locale

            if timezone:
                state_variables["timezone"] = timezone

            if chart_data:
                # Краткое описание карты для прогностического промпта
                planets = chart_data.get("planets", [])
                summary = ", ".join(
                    f"{p.get('name', '?')}: {p.get('sign', '?')}" for p in planets[:10]
                )
                if summary:
                    state_variables["chart_summary"] = summary

            # Создаём ChatKit сессию через OpenAI SDK
            session = self.client.beta.chatkit.sessions.create(
                user=user_id,
                workflow={
                    "id": wf_id,
                    "state_variables": state_variables if state_variables else None
                }
            )

            logger.info(f"ChatKit сессия создана: {session.id}")

            return {
                'client_secret': session.client_secret,
                'session_id': session.id
            }

        except Exception as e:
            logger.error(f"Ошибка при создании ChatKit сессии: {str(e)}")
            raise


# Singleton instance
_openai_service: Optional[OpenAIService] = None


def get_openai_service() -> OpenAIService:
    """Получить экземпляр OpenAI сервиса (singleton)"""
    global _openai_service
    if _openai_service is None:
        _openai_service = OpenAIService()
    return _openai_service

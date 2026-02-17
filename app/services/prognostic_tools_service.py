"""
Prognostic Tools Service — tool-функции для AI chatbot (function calling).

Каждая функция — обёртка над существующими сервисами прогностики,
возвращающая данные в формате удобном для AI-интерпретации.

Используется OpenAI Responses API с tools (function calling):
AI агент решает какие методы вызвать на основе вопроса пользователя.
"""
import os
import json
from typing import Dict, Any, List, Optional
from uuid import UUID
from datetime import date, datetime
from sqlalchemy.orm import Session
from loguru import logger

from app.services.transit_service import TransitService
from app.services.progression_service import ProgressionService
from app.services.direction_service import DirectionService
from app.services.solar_return_service import SolarReturnService
from app.services.forecast_run_service import ForecastRunService
from app.database.models import User

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EPHE_PATH = os.getenv("SWISSEPH_EPHE_PATH", os.path.join(_PROJECT_ROOT, "swisseph", "ephe"))


# ============================================================================
# OpenAI Tools Definitions (JSON Schema для function calling)
# ============================================================================

PROGNOSTIC_TOOLS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "name": "get_active_forecast_context",
        "description": (
            "Получить активный контекст уже рассчитанной прогностики (метод, дата/период, место, таймзона). "
            "Вызывай перед интерпретацией, если пользователь спрашивает про 'эту прогностику'."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "run_id": {
                    "type": "string",
                    "description": "ID снимка прогностики. Если не указан, вернётся текущий активный контекст."
                },
            },
            "required": [],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "get_transit_events",
        "description": (
            "Получить транзитные события (аспекты транзитных планет к натальным) за период. "
            "Используй для: 'что ждёт на этой неделе/месяце', 'какие транзиты', "
            "'когда лучше начать проект', 'благоприятные/неблагоприятные периоды'."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "start_date": {"type": "string", "description": "Начало периода (YYYY-MM-DD)"},
                "end_date": {"type": "string", "description": "Конец периода (YYYY-MM-DD)"},
            },
            "required": ["start_date", "end_date"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "get_current_transits",
        "description": (
            "Получить текущие транзиты (позиции планет и аспекты к наталу сейчас). "
            "Используй для: 'что сейчас происходит', 'текущая ситуация', 'какие аспекты действуют'."
        ),
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "get_progressions",
        "description": (
            "Получить вторичные прогрессии (внутренние изменения, эволюция личности). "
            "Используй для: 'внутренние изменения', 'как я меняюсь', 'прогрессивная Луна'."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "target_date": {"type": "string", "description": "Дата (YYYY-MM-DD). По умолчанию — сегодня."},
            },
            "required": [],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "get_directions",
        "description": (
            "Получить дирекции солнечной дуги (ключевые долгосрочные события). "
            "Используй для: 'ключевые события жизни', 'поворотные моменты', 'долгосрочные тенденции'."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "target_date": {"type": "string", "description": "Дата (YYYY-MM-DD). По умолчанию — сегодня."},
                "direction_type": {"type": "string", "enum": ["solar_arc", "symbolic"], "description": "Тип дирекции. По умолчанию solar_arc."},
            },
            "required": [],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "get_solar_return",
        "description": (
            "Получить солярную карту (годовой прогноз). "
            "Используй для: 'годовой прогноз', 'что ждёт в 2026', 'соляр', 'тема года'."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "year": {"type": "integer", "description": "Год соляра. По умолчанию — текущий."},
            },
            "required": [],
            "additionalProperties": False,
        },
    },
]


# ============================================================================
# Service class
# ============================================================================

class PrognosticToolsService:
    """Сервис для выполнения tool-вызовов от AI агента."""

    def __init__(
        self,
        user_id: UUID,
        db_session: Session,
        frontend_context: Optional[Dict[str, Any]] = None,
    ):
        self.user_id = user_id
        self.db = db_session
        self.frontend_context = frontend_context or {}
        self._user: Optional[User] = None
        self._forecast_run_cache = None

    @property
    def user(self) -> User:
        if self._user is None:
            self._user = self.db.query(User).filter(User.user_id == self.user_id).first()
            if not self._user:
                raise ValueError(f"User not found: {self.user_id}")
        return self._user

    # ------------------------------------------------------------------
    # Dispatcher
    # ------------------------------------------------------------------

    def dispatch(self, tool_name: str, arguments: Dict[str, Any]) -> str:
        """Выполнить tool-функцию и вернуть JSON-строку результата."""
        handlers = {
            "get_active_forecast_context": self._handle_active_forecast_context,
            "get_transit_events": self._handle_transit_events,
            "get_current_transits": self._handle_current_transits,
            "get_progressions": self._handle_progressions,
            "get_directions": self._handle_directions,
            "get_solar_return": self._handle_solar_return,
        }
        handler = handlers.get(tool_name)
        if not handler:
            return json.dumps({"error": f"Unknown tool: {tool_name}"}, ensure_ascii=False)
        try:
            result = handler(arguments)
            return json.dumps(result, ensure_ascii=False, default=str)
        except Exception as e:
            logger.error(f"Tool {tool_name} error: {e}")
            return json.dumps({"error": str(e)}, ensure_ascii=False)

    # ------------------------------------------------------------------
    # Tool handlers
    # ------------------------------------------------------------------

    def _handle_active_forecast_context(self, args: Dict[str, Any]) -> Dict:
        """Активный snapshot прогностики для Agent Builder."""
        requested_run_id = args.get("run_id")
        run = self._resolve_forecast_run(requested_run_id=requested_run_id)

        if run:
            return {
                "source": "forecast_runs_db",
                "context": self._serialize_forecast_run(run),
            }

        method = self.frontend_context.get("selected_method")
        controls = self.frontend_context.get("controls") if isinstance(self.frontend_context.get("controls"), dict) else {}
        calculated = self.frontend_context.get("calculated") if isinstance(self.frontend_context.get("calculated"), dict) else {}

        if method or controls or calculated:
            return {
                "source": "frontend_context",
                "context": {
                    "run_id": None,
                    "method": method,
                    "controls": controls,
                    "calculated": calculated,
                },
            }

        return {
            "source": "none",
            "context": None,
            "message": "Активный контекст прогностики не найден. Попросите пользователя сначала выполнить расчёт на странице прогностики.",
        }

    def _handle_transit_events(self, args: Dict[str, Any]) -> Dict:
        """Транзитные события за период."""
        start_str = args.get("start_date")
        end_str = args.get("end_date")

        run = self._resolve_forecast_run(requested_run_id=args.get("run_id"))
        run_ctx = self._extract_run_context(run, "transits")

        run_start_str = run_ctx.get("period_start")
        run_end_str = run_ctx.get("period_end")
        run_events = run_ctx.get("events") if isinstance(run_ctx.get("events"), list) else None

        if not start_str and run_start_str:
            start_str = run_start_str
        if not end_str and run_end_str:
            end_str = run_end_str

        transits_ctx = self._get_calculated_ctx("transits")
        ctx_start_str = transits_ctx.get("period_start")
        ctx_end_str = transits_ctx.get("period_end")
        cached_events = transits_ctx.get("events") if isinstance(transits_ctx.get("events"), list) else None

        if not start_str and ctx_start_str:
            start_str = ctx_start_str
        if not end_str and ctx_end_str:
            end_str = ctx_end_str

        if not start_str or not end_str:
            raise ValueError("Нужны start_date и end_date (YYYY-MM-DD) или предварительный расчет периода на странице прогностики")

        start = date.fromisoformat(start_str)
        end = date.fromisoformat(end_str)
        if end < start:
            raise ValueError("end_date не может быть раньше start_date")

        if (
            run_events is not None
            and run_start_str
            and run_end_str
            and start_str >= run_start_str
            and end_str <= run_end_str
        ):
            filtered = self._filter_transit_events_by_period(run_events, start_str, end_str)
            return {
                "method": "transits",
                "source": "forecast_runs_db",
                "run_id": str(run.run_id) if run else None,
                "period": f"{start.isoformat()} — {end.isoformat()}",
                "total_events": len(filtered),
                "events": self._summarize_transit_events(filtered),
            }

        if (
            cached_events is not None
            and ctx_start_str
            and ctx_end_str
            and start_str >= ctx_start_str
            and end_str <= ctx_end_str
        ):
            filtered = self._filter_transit_events_by_period(cached_events, start_str, end_str)
            return {
                "method": "transits",
                "source": "frontend_context",
                "period": f"{start.isoformat()} — {end.isoformat()}",
                "total_events": len(filtered),
                "events": self._summarize_transit_events(filtered),
            }

        tz = self.user.timezone or "UTC"

        svc = TransitService(db_session=self.db, ephe_path=EPHE_PATH)
        events = svc.find_transit_events(
            user_id=self.user_id, start_date=start, end_date=end, timezone=tz,
        )
        return {
            "method": "transits",
            "source": "backend_calculation",
            "period": f"{start.isoformat()} — {end.isoformat()}",
            "total_events": len(events),
            "events": self._summarize_transit_events(events),
        }

    def _handle_current_transits(self, args: Dict[str, Any]) -> Dict:
        """Текущие транзиты (на данный момент)."""
        now = datetime.utcnow()
        tz = self.user.timezone or "UTC"

        svc = TransitService(db_session=self.db, ephe_path=EPHE_PATH)
        result = svc.calculate_transits(
            user_id=self.user_id, transit_date=now.date(),
            transit_time=now.time(), timezone=tz,
        )

        aspects = result.get("aspects", [])
        return {
            "method": "current_transits",
            "datetime": now.isoformat() + "Z",
            "timezone": tz,
            "total_aspects": len(aspects),
            "aspects": self._format_aspects_for_ai(aspects),
        }

    def _handle_progressions(self, args: Dict[str, Any]) -> Dict:
        """Вторичные прогрессии."""
        target = date.fromisoformat(args["target_date"]) if args.get("target_date") else None
        run = self._resolve_forecast_run(requested_run_id=args.get("run_id"))
        run_ctx = self._extract_run_context(run, "progressions")
        run_target_str = run_ctx.get("target_date")
        run_data = run_ctx.get("data") if isinstance(run_ctx.get("data"), dict) else None

        if target is None and run_target_str:
            target = date.fromisoformat(run_target_str)

        progressions_ctx = self._get_calculated_ctx("progressions")
        ctx_target_str = progressions_ctx.get("target_date")
        ctx_data = progressions_ctx.get("data") if isinstance(progressions_ctx.get("data"), dict) else None

        if target is None and ctx_target_str:
            target = date.fromisoformat(ctx_target_str)
        if target is None:
            target = date.today()

        if run_data and run_target_str == target.isoformat():
            aspects = run_data.get("aspects_to_natal", [])
            return {
                "method": "progressions",
                "source": "forecast_runs_db",
                "run_id": str(run.run_id) if run else None,
                "target_date": target.isoformat(),
                "age_years": run_data.get("progression_info", {}).get("age_years"),
                "total_aspects": len(aspects),
                "aspects": self._format_aspects_for_ai(aspects),
                "progressed_planets_summary": self._summarize_progressed_planets(
                    run_data.get("progressed_planets", [])
                ),
            }

        if ctx_data and ctx_target_str == target.isoformat():
            aspects = ctx_data.get("aspects_to_natal", [])
            return {
                "method": "progressions",
                "source": "frontend_context",
                "target_date": target.isoformat(),
                "age_years": ctx_data.get("progression_info", {}).get("age_years"),
                "total_aspects": len(aspects),
                "aspects": self._format_aspects_for_ai(aspects),
                "progressed_planets_summary": self._summarize_progressed_planets(
                    ctx_data.get("progressed_planets", [])
                ),
            }

        svc = ProgressionService(db_session=self.db, ephe_path=EPHE_PATH)
        result = svc.calculate_progression(user_id=self.user_id, target_date=target)

        aspects = result.get("aspects_to_natal", [])
        return {
            "method": "progressions",
            "source": "backend_calculation",
            "target_date": target.isoformat(),
            "age_years": result.get("progression_info", {}).get("age_years"),
            "total_aspects": len(aspects),
            "aspects": self._format_aspects_for_ai(aspects),
            "progressed_planets_summary": self._summarize_progressed_planets(
                result.get("progressed_planets", [])
            ),
        }

    def _handle_directions(self, args: Dict[str, Any]) -> Dict:
        """Дирекции солнечной дуги."""
        target = date.fromisoformat(args["target_date"]) if args.get("target_date") else None
        direction_type = args.get("direction_type", "solar_arc")
        run = self._resolve_forecast_run(requested_run_id=args.get("run_id"))
        run_ctx = self._extract_run_context(run, "directions")
        run_target_str = run_ctx.get("target_date")
        run_direction_type = run_ctx.get("direction_type")
        run_data = run_ctx.get("data") if isinstance(run_ctx.get("data"), dict) else None

        if target is None and run_target_str:
            target = date.fromisoformat(run_target_str)
        if (not args.get("direction_type")) and run_direction_type:
            direction_type = run_direction_type

        directions_ctx = self._get_calculated_ctx("directions")
        ctx_target_str = directions_ctx.get("target_date")
        ctx_direction_type = directions_ctx.get("direction_type")
        ctx_data = directions_ctx.get("data") if isinstance(directions_ctx.get("data"), dict) else None

        if target is None and ctx_target_str:
            target = date.fromisoformat(ctx_target_str)
        if target is None:
            target = date.today()

        if run_data and run_target_str == target.isoformat() and run_direction_type == direction_type:
            aspects = run_data.get("aspects_to_natal", [])
            info = run_data.get("direction_info", {})
            return {
                "method": "directions",
                "source": "forecast_runs_db",
                "run_id": str(run.run_id) if run else None,
                "target_date": target.isoformat(),
                "direction_type": direction_type,
                "arc_degrees": info.get("arc_degrees"),
                "arc_formatted": info.get("arc_formatted"),
                "total_aspects": len(aspects),
                "aspects": self._format_aspects_for_ai(aspects),
            }

        if ctx_data and ctx_target_str == target.isoformat() and ctx_direction_type == direction_type:
            aspects = ctx_data.get("aspects_to_natal", [])
            info = ctx_data.get("direction_info", {})
            return {
                "method": "directions",
                "source": "frontend_context",
                "target_date": target.isoformat(),
                "direction_type": direction_type,
                "arc_degrees": info.get("arc_degrees"),
                "arc_formatted": info.get("arc_formatted"),
                "total_aspects": len(aspects),
                "aspects": self._format_aspects_for_ai(aspects),
            }

        svc = DirectionService(db_session=self.db, ephe_path=EPHE_PATH)
        result = svc.calculate_direction(
            user_id=self.user_id, target_date=target, direction_type=direction_type,
        )

        aspects = result.get("aspects_to_natal", [])
        info = result.get("direction_info", {})
        return {
            "method": "directions",
            "source": "backend_calculation",
            "target_date": target.isoformat(),
            "direction_type": direction_type,
            "arc_degrees": info.get("arc_degrees"),
            "arc_formatted": info.get("arc_formatted"),
            "total_aspects": len(aspects),
            "aspects": self._format_aspects_for_ai(aspects),
        }

    def _handle_solar_return(self, args: Dict[str, Any]) -> Dict:
        """Солярная карта (годовой прогноз)."""
        year = args.get("year")
        run = self._resolve_forecast_run(requested_run_id=args.get("run_id"))
        run_ctx = self._extract_run_context(run, "solar_return")
        run_year = run_ctx.get("year")
        run_data = run_ctx.get("data") if isinstance(run_ctx.get("data"), dict) else None

        if year is None and isinstance(run_year, int):
            year = run_year

        solar_ctx = self._get_calculated_ctx("solar_return")
        ctx_year = solar_ctx.get("year")
        ctx_data = solar_ctx.get("data") if isinstance(solar_ctx.get("data"), dict) else None

        if year is None and isinstance(ctx_year, int):
            year = ctx_year
        if year is None:
            year = date.today().year

        if run_data and run_year == year:
            planets = run_data.get("planets", [])
            return {
                "method": "solar_return",
                "source": "forecast_runs_db",
                "run_id": str(run.run_id) if run else None,
                "year": year,
                "solar_datetime": run_data.get("solar_info", {}).get("solar_datetime_local"),
                "planets_summary": self._summarize_solar_planets(planets),
                "houses": run_data.get("houses", []),
                "angles": run_data.get("angles", {}),
            }

        if ctx_data and ctx_year == year:
            planets = ctx_data.get("planets", [])
            return {
                "method": "solar_return",
                "source": "frontend_context",
                "year": year,
                "solar_datetime": ctx_data.get("solar_info", {}).get("solar_datetime_local"),
                "planets_summary": self._summarize_solar_planets(planets),
                "houses": ctx_data.get("houses", []),
                "angles": ctx_data.get("angles", {}),
            }

        user = self.user

        # Координаты места рождения для соляра (по умолчанию)
        lat = float(user.lat) if user.lat else 0.0
        lon = float(user.lon) if user.lon else 0.0

        svc = SolarReturnService(db_session=self.db, ephe_path=EPHE_PATH)
        result = svc.calculate_solar_return(
            user_id=self.user_id, year=year,
            location_lat=lat, location_lon=lon,
            location_name=user.birth_place,
        )

        planets = result.get("planets", [])
        return {
            "method": "solar_return",
            "source": "backend_calculation",
            "year": year,
            "solar_datetime": result.get("solar_info", {}).get("solar_datetime_local"),
            "planets_summary": self._summarize_solar_planets(planets),
            "houses": result.get("houses", []),
            "angles": result.get("angles", {}),
        }

    # ------------------------------------------------------------------
    # Helpers — frontend context + форматирование данных для AI
    # ------------------------------------------------------------------

    def _get_calculated_ctx(self, key: str) -> Dict[str, Any]:
        calculated = self.frontend_context.get("calculated")
        if not isinstance(calculated, dict):
            return {}
        value = calculated.get(key)
        return value if isinstance(value, dict) else {}

    def _resolve_forecast_run(self, requested_run_id: Optional[str] = None):
        if requested_run_id:
            service = ForecastRunService(self.db)
            return service.get_run(self.user_id, requested_run_id)

        if self._forecast_run_cache is not None:
            return self._forecast_run_cache

        frontend_run_id = self.frontend_context.get("active_run_id")
        service = ForecastRunService(self.db)
        if isinstance(frontend_run_id, str) and frontend_run_id.strip():
            self._forecast_run_cache = service.get_run(self.user_id, frontend_run_id)
            if self._forecast_run_cache:
                return self._forecast_run_cache

        self._forecast_run_cache = service.get_active_run(self.user_id)
        return self._forecast_run_cache

    @staticmethod
    def _serialize_forecast_run(run) -> Dict[str, Any]:
        return ForecastRunService.serialize_run(run)

    @staticmethod
    def _extract_run_context(run, method_key: str) -> Dict[str, Any]:
        if not run or not isinstance(run.context_data, dict):
            return {}
        value = run.context_data.get(method_key)
        return value if isinstance(value, dict) else {}

    @staticmethod
    def _date_in_period(period_start: Optional[str], period_end: Optional[str], value: Optional[str]) -> bool:
        if not period_start or not period_end or not value:
            return False
        return period_start <= value <= period_end

    def _filter_transit_events_by_period(self, events: List[Dict], start_str: str, end_str: str) -> List[Dict]:
        if not events:
            return []

        filtered = []
        for event in events:
            if not isinstance(event, dict):
                continue
            exact = event.get("t_exact")
            enter = event.get("t_enter")
            leave = event.get("t_leave")
            if (
                self._date_in_period(start_str, end_str, exact)
                or self._date_in_period(start_str, end_str, enter)
                or self._date_in_period(start_str, end_str, leave)
            ):
                filtered.append(event)
                continue

            if enter and leave and enter <= end_str and leave >= start_str:
                filtered.append(event)

        return filtered

    @staticmethod
    def _summarize_transit_events(events: List[Dict]) -> List[Dict]:
        """Компактный формат транзитных событий для AI."""
        return [
            {
                "transit": e.get("transit_body"),
                "aspect": e.get("aspect_type"),
                "natal": e.get("natal_body"),
                "natal_type": e.get("natal_type"),
                "is_exact": e.get("is_exact", False),
                "exact": e.get("t_exact"),
                "enter": e.get("t_enter"),
                "leave": e.get("t_leave"),
                "orb": e.get("min_orb"),
                "is_major": e.get("is_major"),
                "harmonic": e.get("harmonic_type"),
            }
            for e in events
        ]

    @staticmethod
    def _format_aspects_for_ai(aspects: List[Dict]) -> List[Dict]:
        """Компактный формат аспектов для AI."""
        return [
            {
                "planet1": a.get("planet1") or a.get("transit_planet") or a.get("progressed_planet") or a.get("directed_object"),
                "aspect": a.get("aspect_type") or a.get("aspect"),
                "planet2": a.get("planet2") or a.get("natal_planet") or a.get("natal_object"),
                "orb": a.get("orb"),
                "is_exact": a.get("is_exact", False),
                "is_applying": a.get("is_applying"),
            }
            for a in aspects
        ]

    @staticmethod
    def _summarize_progressed_planets(planets: List[Dict]) -> List[Dict]:
        """Компактный формат прогрессивных планет для AI."""
        return [
            {
                "planet": p.get("name") or p.get("planet"),
                "sign": p.get("sign"),
                "degree": p.get("degree_in_sign"),
                # Для прогрессий `house` должен отражать прогрессивный дом,
                # чтобы не путать AI с натальным положением.
                "house": p.get("progressed_house") or p.get("house") or p.get("natal_house"),
                "natal_house": p.get("natal_house"),
                "progressed_house": p.get("progressed_house") or p.get("house"),
                "is_retrograde": p.get("is_retrograde", p.get("retrograde")),
            }
            for p in planets
        ]

    @staticmethod
    def _summarize_solar_planets(planets: List[Dict]) -> List[Dict]:
        """Компактный формат планет соляра для AI."""
        return [
            {
                "planet": p.get("name") or p.get("planet"),
                "sign": p.get("sign"),
                "degree": p.get("degree_in_sign"),
                "house": p.get("house"),
                "is_retrograde": p.get("is_retrograde"),
            }
            for p in planets
        ]

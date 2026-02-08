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
from app.database.models import User

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EPHE_PATH = os.getenv("SWISSEPH_EPHE_PATH", os.path.join(_PROJECT_ROOT, "swisseph", "ephe"))


# ============================================================================
# OpenAI Tools Definitions (JSON Schema для function calling)
# ============================================================================

PROGNOSTIC_TOOLS: List[Dict[str, Any]] = [
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

    def __init__(self, user_id: UUID, db_session: Session):
        self.user_id = user_id
        self.db = db_session
        self._user: Optional[User] = None

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

    def _handle_transit_events(self, args: Dict[str, Any]) -> Dict:
        """Транзитные события за период."""
        start = date.fromisoformat(args["start_date"])
        end = date.fromisoformat(args["end_date"])
        tz = self.user.timezone or "UTC"

        svc = TransitService(db_session=self.db, ephe_path=EPHE_PATH)
        events = svc.find_transit_events(
            user_id=self.user_id, start_date=start, end_date=end, timezone=tz,
        )

        return {
            "method": "transits",
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
        target = date.fromisoformat(args["target_date"]) if args.get("target_date") else date.today()

        svc = ProgressionService(db_session=self.db, ephe_path=EPHE_PATH)
        result = svc.calculate_progression(user_id=self.user_id, target_date=target)

        aspects = result.get("aspects_to_natal", [])
        return {
            "method": "progressions",
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
        target = date.fromisoformat(args["target_date"]) if args.get("target_date") else date.today()
        direction_type = args.get("direction_type", "solar_arc")

        svc = DirectionService(db_session=self.db, ephe_path=EPHE_PATH)
        result = svc.calculate_direction(
            user_id=self.user_id, target_date=target, direction_type=direction_type,
        )

        aspects = result.get("aspects_to_natal", [])
        info = result.get("direction_info", {})
        return {
            "method": "directions",
            "target_date": target.isoformat(),
            "direction_type": direction_type,
            "arc_degrees": info.get("arc_degrees"),
            "arc_formatted": info.get("arc_formatted"),
            "total_aspects": len(aspects),
            "aspects": self._format_aspects_for_ai(aspects),
        }

    def _handle_solar_return(self, args: Dict[str, Any]) -> Dict:
        """Солярная карта (годовой прогноз)."""
        year = args.get("year", date.today().year)
        user = self.user

        # Координаты места рождения для соляра (по умолчанию)
        lat = float(user.birth_lat) if user.birth_lat else 0.0
        lon = float(user.birth_lon) if user.birth_lon else 0.0

        svc = SolarReturnService(db_session=self.db, ephe_path=EPHE_PATH)
        result = svc.calculate_solar_return(
            user_id=self.user_id, year=year,
            location_lat=lat, location_lon=lon,
            location_name=user.birth_place,
        )

        planets = result.get("planets", [])
        return {
            "method": "solar_return",
            "year": year,
            "solar_datetime": result.get("solar_info", {}).get("solar_datetime_local"),
            "planets_summary": self._summarize_solar_planets(planets),
            "houses": result.get("houses", []),
            "angles": result.get("angles", {}),
        }

    # ------------------------------------------------------------------
    # Helpers — форматирование данных для AI
    # ------------------------------------------------------------------

    @staticmethod
    def _summarize_transit_events(events: List[Dict]) -> List[Dict]:
        """Компактный формат транзитных событий для AI."""
        return [
            {
                "transit": e.get("transit_body"),
                "aspect": e.get("aspect_type"),
                "natal": e.get("natal_body"),
                "natal_type": e.get("natal_type"),
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
                "house": p.get("natal_house"),
                "is_retrograde": p.get("is_retrograde"),
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
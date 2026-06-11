"""
Assistant API — computational tools for the astrologer assistant.

PR2: the aspect-passes endpoint. Wraps TransitService.find_aspect_passes with
deterministic, enum-validated arguments and a structured result. Domain
conditions (unknown body, no contact in window, …) are returned as a
machine-readable ``status`` in the 200 body so the agent layer can react;
only a missing natal chart is a 404, and internal errors never leak text.
"""
from __future__ import annotations

from datetime import date as date_type
from typing import List, Optional
from uuid import UUID

import pytz
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy.orm import Session
from loguru import logger

from app.auth.dependencies import AuthContext, ensure_client_access, require_auth
from app.database.connection import get_db
from app.services.astro_assistant_service import (
    ASPECT_TYPE_NAMES as _ASPECT_TYPES,
    AstroAssistantService,
    NATAL_BODY_NAMES as _NATAL_BODY_NAMES,
    TRANSIT_BODY_NAMES as _TRANSIT_BODY_NAMES,
)
from app.services.openai_service import is_openai_configured
from app.services.transit_service import TransitService
from app.utils.ephemeris import get_ephemeris_path

router = APIRouter(prefix="/assistant", tags=["Assistant"])

EPHE_PATH = get_ephemeris_path()

MAX_EXPANSION_DAYS = 4000
MAX_CHAT_MESSAGES = 40
MAX_CHAT_CONTENT_CHARS = 4000


class AspectPassesRequest(BaseModel):
    """Find when a transiting body forms an aspect to a natal object."""

    user_id: UUID = Field(..., description="Chart source (active chart's user_id).")
    transit_body: str = Field(..., description="Transiting body.")
    natal_body: str = Field(..., description="Natal target object.")
    aspect_type: str = Field(..., description="Aspect type (ref_aspect_types).")
    timezone: str = Field(..., description="IANA timezone, e.g. 'Europe/Kiev'.")
    mode: str = Field(
        'next_contact',
        description="'next_contact' (auto-expand forward) or 'window' (explicit range).",
    )
    start_date: Optional[date_type] = Field(None, description="window mode: range start.")
    end_date: Optional[date_type] = Field(None, description="window mode: range end.")
    anchor_date: Optional[date_type] = Field(
        None, description="next_contact mode: scan anchor (defaults to today).")
    max_expansion_days: Optional[int] = Field(
        None, ge=1, le=MAX_EXPANSION_DAYS,
        description="next_contact mode: forward cap; defaults per body.")

    @field_validator('transit_body')
    @classmethod
    def _validate_transit_body(cls, v: str) -> str:
        if v not in _TRANSIT_BODY_NAMES:
            raise ValueError(f"Unsupported transit_body: {v}")
        return v

    @field_validator('natal_body')
    @classmethod
    def _validate_natal_body(cls, v: str) -> str:
        if v not in _NATAL_BODY_NAMES:
            raise ValueError(f"Unsupported natal_body: {v}")
        return v

    @field_validator('aspect_type')
    @classmethod
    def _validate_aspect_type(cls, v: str) -> str:
        if v not in _ASPECT_TYPES:
            raise ValueError(f"Unknown aspect_type: {v}")
        return v

    @field_validator('mode')
    @classmethod
    def _validate_mode(cls, v: str) -> str:
        if v not in ('next_contact', 'window'):
            raise ValueError("mode must be 'next_contact' or 'window'")
        return v

    @field_validator('timezone')
    @classmethod
    def _validate_timezone(cls, v: str) -> str:
        try:
            pytz.timezone(v)
        except pytz.exceptions.UnknownTimeZoneError:
            raise ValueError(f"Unknown timezone: {v}")
        return v

    @model_validator(mode='after')
    def _validate_window(self):
        if self.mode == 'window':
            if self.start_date is None or self.end_date is None:
                raise ValueError("window mode requires start_date and end_date")
            if self.end_date < self.start_date:
                raise ValueError("end_date must not precede start_date")
        return self


class AspectPass(BaseModel):
    date: str
    motion: str  # 'direct' | 'retrograde'
    orb: float


class Station(BaseModel):
    date: str
    type: str  # 'R' | 'D'


class ClosestApproach(BaseModel):
    orb: float
    date: str


class AspectContact(BaseModel):
    enter: str
    enter_complete: bool
    leave: str
    leave_complete: bool
    exact_pass_count: int
    passes: List[AspectPass]
    stations: List[Station]
    closest_approach: ClosestApproach


class AspectPassesResponse(BaseModel):
    status: str
    transit_body: str
    natal_body: str
    aspect_type: str
    timezone: str
    calc_version: str
    exact_angle: Optional[float] = None
    orb_used: Optional[float] = None
    orb_source: Optional[str] = None
    mode: Optional[str] = None
    requested_window: Optional[dict] = None
    effective_window: Optional[dict] = None
    window_cap_reached: Optional[bool] = None
    boundary_complete: Optional[bool] = None
    contacts: List[AspectContact] = Field(default_factory=list)


@router.post(
    "/aspect-passes",
    response_model=AspectPassesResponse,
    status_code=status.HTTP_200_OK,
    summary="Aspect passes (enter / each exact crossing / leave)",
    description=(
        "Finds when a transiting body forms an aspect to a natal object: every "
        "exact crossing (retrograde loops yield multiple), motion per pass, and "
        "station dates. Orbs come from the astrologer's configured settings."
    ),
)
def aspect_passes(
    request: AspectPassesRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    try:
        ensure_client_access(
            db, http_request, auth, request.user_id, action="client.assistant.aspect_passes")
        service = TransitService(db_session=db, ephe_path=EPHE_PATH)
        return service.find_aspect_passes(
            user_id=request.user_id,
            transit_body=request.transit_body,
            natal_body=request.natal_body,
            aspect_type=request.aspect_type,
            timezone=request.timezone,
            anchor_date=request.anchor_date,
            start_date=request.start_date if request.mode == 'window' else None,
            end_date=request.end_date if request.mode == 'window' else None,
            max_expansion_days=request.max_expansion_days,
        )
    except ValueError as e:
        # Only raised for a genuinely missing natal chart.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception:
        logger.exception("aspect_passes failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Aspect passes calculation failed",
        )


class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'.")
    content: str = Field(..., max_length=MAX_CHAT_CONTENT_CHARS)

    @field_validator('role')
    @classmethod
    def _validate_role(cls, v: str) -> str:
        if v not in ('user', 'assistant'):
            raise ValueError("role must be 'user' or 'assistant'")
        return v


class ChatRequest(BaseModel):
    """A chat turn bound to the active chart."""

    user_id: UUID = Field(..., description="Active chart's user_id (server-bound context).")
    timezone: str = Field('UTC', description="Active chart's timezone (default for tools).")
    messages: List[ChatMessage] = Field(..., min_length=1, max_length=MAX_CHAT_MESSAGES)

    @field_validator('timezone')
    @classmethod
    def _validate_timezone(cls, v: str) -> str:
        try:
            pytz.timezone(v)
        except pytz.exceptions.UnknownTimeZoneError:
            raise ValueError(f"Unknown timezone: {v}")
        return v


class ChatResponse(BaseModel):
    reply: str
    tool_results: List[dict] = Field(default_factory=list)
    iterations: int
    max_iterations_reached: bool


@router.post(
    "/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Astrologer assistant chat turn",
    description=(
        "Runs the function-calling assistant for the active chart. The model "
        "selects deterministic tools; the chart's user_id is bound server-side "
        "and never controlled by the model."
    ),
)
def chat(
    request: ChatRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    if not is_openai_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Assistant is not configured",
        )
    ensure_client_access(db, http_request, auth, request.user_id, action="client.assistant.chat")
    service = AstroAssistantService(db_session=db, default_timezone=request.timezone)
    try:
        return service.chat(
            user_id=request.user_id,
            messages=[m.model_dump() for m in request.messages],
        )
    except Exception:
        logger.exception("assistant chat failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Assistant request failed",
        )

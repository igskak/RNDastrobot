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
from app.services.transit_service import TransitService
from app.utils.constants import PLANETS, SPECIAL_POINTS
from app.utils.ephemeris import get_ephemeris_path

router = APIRouter(prefix="/assistant", tags=["Assistant"])

EPHE_PATH = get_ephemeris_path()

# Deterministic vocabularies — built from constants so they never drift from
# the rest of the app. The agent (PR3) emits these same sets into its tool
# JSON-schema enums so the model cannot invent body or aspect labels.
_PLANET_NAMES = frozenset(PLANETS.values())
_ANGLE_NAMES = frozenset({'ASC', 'MC', 'IC', 'DSC', 'Vertex', 'AntiVertex'})
_TRANSIT_BODY_NAMES = _PLANET_NAMES | frozenset(
    {'TrueNorthNode', 'TrueSouthNode', 'BlackMoon', 'WhiteMoon'})
_NATAL_BODY_NAMES = _PLANET_NAMES | frozenset(SPECIAL_POINTS.keys()) | _ANGLE_NAMES
# Mirrors database/seeds/02_aspect_types.sql (ref_aspect_types).
_ASPECT_TYPES = frozenset({
    'Conjunction', 'Sextile', 'Square', 'Trine', 'Opposition',
    'Vigintile', 'Semi_Nonagon', 'Semisextile', 'Decile', 'Nonagon',
    'Semisquare', 'Quintile', 'Binonagon', 'Sentagon', 'Tridecile',
    'Sesquiquadrate', 'Biquintile', 'Quincunx',
})

MAX_EXPANSION_DAYS = 4000


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

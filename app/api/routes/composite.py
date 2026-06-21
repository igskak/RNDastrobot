"""API endpoint for composite charts (midpoint + Davison) of two clients."""
from __future__ import annotations

from datetime import date as date_type, time as time_type
from typing import Any, Dict, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from loguru import logger
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, ensure_client_access, require_auth
from app.database.connection import get_db
from app.database.models import CompositeChart
from app.services.aspect_service import AspectService
from app.services.composite_service import CompositeService
from app.services.entitlements_service import FEATURE_CLIENTS, assert_can_create_saved_chart, assert_feature_enabled
from app.services.natal_chart_service import NatalChartService
from app.services.swisseph_engine import SwissEphemerisEngine
from app.utils.ephemeris import get_ephemeris_path

router = APIRouter()

EPHE_PATH = get_ephemeris_path()
_natal_service = NatalChartService(ephe_path=EPHE_PATH)


class PartnerBirthData(BaseModel):
    """Inline partner birth data for a manually-entered (non-saved) partner."""
    name: Optional[str] = Field(None, description="Имя партнёра (для подписи)")
    date: date_type = Field(..., description="Дата рождения")
    time: time_type = Field(..., description="Время рождения")
    timezone: str = Field(..., description="IANA timezone")
    place: Optional[str] = Field(None, description="Место рождения (для геокодинга)")
    latitude: Optional[float] = Field(None, description="Широта (если известна)")
    longitude: Optional[float] = Field(None, description="Долгота (если известна)")


class CompositeRequest(BaseModel):
    user_id: UUID = Field(..., description="ID основного клиента")
    partner_id: Optional[UUID] = Field(None, description="ID сохранённого партнёра")
    partner_birth_data: Optional[PartnerBirthData] = Field(
        None, description="Данные рождения партнёра, введённые вручную"
    )
    house_system: str = Field("P", description="Система домов для Davison")
    method: Literal["both", "midpoint", "davison"] = Field(
        "both", description="Какой метод композита рассчитать"
    )

    @model_validator(mode="after")
    def _exactly_one_partner(self) -> "CompositeRequest":
        # Exactly one of the two partner sources must be present (D4).
        if bool(self.partner_id) == bool(self.partner_birth_data):
            raise ValueError(
                "Provide exactly one of partner_id or partner_birth_data"
            )
        return self


class CompositeSaveRequest(CompositeRequest):
    method: Literal["midpoint", "davison"] = Field(..., description="Какой метод композита сохранить")
    title: Optional[str] = Field(None, max_length=160)
    tags: Optional[list[str]] = None
    notes: Optional[str] = None

    @field_validator("title", "notes", mode="before")
    @classmethod
    def _clean_optional_str(cls, value):
        if value is None:
            return None
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("tags")
    @classmethod
    def _clean_tags(cls, value: Optional[list[str]]) -> list[str]:
        if not value:
            return []
        result: list[str] = []
        seen: set[str] = set()
        for item in value:
            if not isinstance(item, str):
                continue
            cleaned = item.strip()
            key = cleaned.casefold()
            if cleaned and key not in seen:
                result.append(cleaned)
                seen.add(key)
        return result


class CompositeSavedResponse(BaseModel):
    composite_chart_id: UUID
    title: Optional[str]
    method: str
    house_system: str
    primary_user_id: Optional[UUID]
    partner_user_id: Optional[UUID]
    partner_birth_data: Optional[Dict[str, Any]]
    chart_data: Dict[str, Any]
    tags: list[str]
    notes: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]


def _build_manual_partner(
    pbd: PartnerBirthData,
    house_system: str,
    auth: AuthContext,
    db: Session,
) -> Dict[str, Any]:
    """Compute an in-memory natal chart for a manually-entered partner.

    save_to_db stays False (default), so nothing is persisted — the partner is
    user-supplied data, not a saved client. db_session is passed only so orbs /
    aspect reference data and geocoding cache are available (read-only here).
    Geocoding failure (place can't resolve and no coords) is a clear 422.
    """
    try:
        return _natal_service.calculate_natal_chart(
            birth_date=pbd.date,
            birth_time=pbd.time,
            timezone=pbd.timezone,
            astrologer_id=auth.astrologer.id,
            place=pbd.place,
            latitude=pbd.latitude,
            longitude=pbd.longitude,
            house_system=house_system,
            save_to_db=False,
            db_session=db,
            first_name=pbd.name,
        )
    except (ValueError, KeyError) as exc:
        logger.info("Manual partner build failed: {}", str(exc))
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not build the partner chart — provide coordinates or a resolvable place.",
        )


def _chart_for_house_system(
    chart: Dict[str, Any],
    house_system: str,
    auth: AuthContext,
    db: Session,
) -> Dict[str, Any]:
    """Return a chart calculated with the requested house system when possible.

    Saved charts may have been stored with another house system. Midpoint houses
    must be based on the currently selected system, so we recalculate in memory
    from birth_data and keep the saved chart untouched.
    """
    birth = chart.get("birth_data") or {}
    if not all(birth.get(key) for key in ("date", "time", "timezone")):
        return chart
    return _natal_service.calculate_natal_chart(
        birth_date=date_type.fromisoformat(str(birth["date"])),
        birth_time=time_type.fromisoformat(str(birth["time"])),
        timezone=str(birth["timezone"]),
        astrologer_id=auth.astrologer.id,
        place=birth.get("place"),
        latitude=birth.get("latitude"),
        longitude=birth.get("longitude"),
        house_system=house_system,
        save_to_db=False,
        db_session=db,
        first_name=birth.get("first_name"),
        last_name=birth.get("last_name"),
        zodiac=birth.get("zodiac") or "tropical",
        ayanamsha=birth.get("ayanamsha") or "lahiri",
    )


def _calculate_composite_payload(
    payload: CompositeRequest,
    request: Request,
    db: Session,
    auth: AuthContext,
) -> Dict[str, Any]:
    # The primary is always a saved client the astrologer must own.
    ensure_client_access(db, request, auth, payload.user_id, action="client.composite.primary")
    primary = _natal_service.get_natal_chart_from_db(payload.user_id, db)
    if primary is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Primary natal chart not found")
    primary = _chart_for_house_system(primary, payload.house_system, auth, db)

    if payload.partner_id is not None:
        # Saved partner: authorize and load from DB.
        ensure_client_access(db, request, auth, payload.partner_id, action="client.composite.partner")
        partner = _natal_service.get_natal_chart_from_db(payload.partner_id, db)
        if partner is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner natal chart not found")
        partner = _chart_for_house_system(partner, payload.house_system, auth, db)
    else:
        # Manual partner: user-supplied data, no DB record to authorize (D2).
        partner = _build_manual_partner(payload.partner_birth_data, payload.house_system, auth, db)

    service = CompositeService(engine=SwissEphemerisEngine(ephe_path=EPHE_PATH))
    midpoint = None
    if payload.method in ("both", "midpoint"):
        midpoint = CompositeService.midpoint_composite(primary, partner)
    davison_unavailable_reason: str | None = None
    davison = None
    if payload.method in ("both", "davison"):
        try:
            davison = service.davison(primary, partner, house_system=payload.house_system)
        except ValueError as exc:
            # Birth data incomplete for Davison — still return the midpoint composite.
            logger.info("Davison skipped: {}", str(exc))
            davison_unavailable_reason = str(exc)

    # In-composite aspects. Midpoint has no planet speeds, so omit phase;
    # Davison has real speeds, so annotate applying/separating (D5).
    aspect_service = AspectService(db)
    CompositeService.attach_aspects(
        midpoint, aspect_service, with_phase=False, astrologer_id=auth.astrologer.id
    )
    CompositeService.attach_aspects(
        davison, aspect_service, with_phase=True, astrologer_id=auth.astrologer.id
    )

    return {
        "midpoint": midpoint,
        "davison": davison,
        "davison_unavailable_reason": davison_unavailable_reason,
    }


def _saved_response(row: CompositeChart) -> CompositeSavedResponse:
    return CompositeSavedResponse(
        composite_chart_id=row.composite_chart_id,
        title=row.title,
        method=row.method,
        house_system=row.house_system,
        primary_user_id=row.primary_user_id,
        partner_user_id=row.partner_user_id,
        partner_birth_data=row.partner_birth_data,
        chart_data=row.chart_data,
        tags=row.tags or [],
        notes=row.notes,
        created_at=row.created_at.isoformat() if row.created_at else None,
        updated_at=row.updated_at.isoformat() if row.updated_at else None,
    )


def _composite_chart_title(payload: CompositeSaveRequest, chart: Dict[str, Any]) -> str:
    if payload.title:
        return payload.title
    method = payload.method.capitalize()
    return f"Composite · {method}"


def _decorate_saved_chart_data(
    row: CompositeChart,
    payload: CompositeSaveRequest,
    chart: Dict[str, Any],
) -> Dict[str, Any]:
    midpoint_time = chart.get("midpoint_time") or {}
    birth_data = {
        "first_name": "Composite",
        "last_name": row.title or "",
        "date": midpoint_time.get("date_utc") or "",
        "time": midpoint_time.get("time_utc") or "",
        "timezone": "UTC" if midpoint_time.get("time_utc") else None,
        "latitude": midpoint_time.get("latitude"),
        "longitude": midpoint_time.get("longitude"),
        "place": row.title,
        "house_system": row.house_system,
    }
    return {
        **chart,
        "user_id": str(row.primary_user_id) if row.primary_user_id else None,
        "chart_kind": "composite",
        "composite_saved_chart_id": str(row.composite_chart_id),
        "composite_method": row.method,
        "composite_pair_title": row.title,
        "composite_meta": " · ".join(
            part for part in [row.method.capitalize(), row.house_system] if part
        ),
        "title": row.title,
        "source": {
            "primary_user_id": str(row.primary_user_id) if row.primary_user_id else None,
            "partner_user_id": str(row.partner_user_id) if row.partner_user_id else None,
            "partner_birth_data": payload.partner_birth_data.model_dump(mode="json") if payload.partner_birth_data else None,
        },
        "birth_data": birth_data,
        "planets": chart.get("planets") or [],
        "houses": chart.get("houses") or [],
        "angles": chart.get("angles") or {},
        "aspects": chart.get("aspects") or [],
        "special_points": chart.get("special_points") or {},
        "aspect_configurations": chart.get("aspect_configurations") or [],
        "stelliums": chart.get("stelliums") or [],
        "balances": chart.get("balances"),
        "cosmogram_pattern": chart.get("cosmogram_pattern"),
    }


@router.post(
    "/composite/calculate",
    status_code=status.HTTP_200_OK,
    summary="Композитная карта двух клиентов: midpoint + Davison",
)
def calculate_composite(
    payload: CompositeRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> Dict[str, Any]:
    assert_feature_enabled(auth.astrologer, FEATURE_CLIENTS, plan_code=auth.effective_plan_code)
    try:
        return _calculate_composite_payload(payload, request, db, auth)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error calculating composite: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка расчёта композита: {str(exc)}",
        )


@router.post(
    "/composite/save",
    response_model=CompositeSavedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Сохранить рассчитанную композитную карту",
)
def save_composite(
    payload: CompositeSaveRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> CompositeSavedResponse:
    assert_feature_enabled(auth.astrologer, FEATURE_CLIENTS, plan_code=auth.effective_plan_code)
    assert_can_create_saved_chart(db, auth.astrologer, plan_code=auth.effective_plan_code)
    try:
        calculated = _calculate_composite_payload(payload, request, db, auth)
        chart = calculated.get(payload.method)
        if not chart:
            detail = calculated.get("davison_unavailable_reason") or "Composite chart is unavailable"
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)

        row = CompositeChart(
            astrologer_id=auth.astrologer.id,
            title=_composite_chart_title(payload, chart),
            primary_user_id=payload.user_id,
            partner_user_id=payload.partner_id,
            partner_birth_data=payload.partner_birth_data.model_dump(mode="json") if payload.partner_birth_data else None,
            method=payload.method,
            house_system=payload.house_system,
            chart_data=chart,
            tags=payload.tags or [],
            notes=payload.notes,
        )
        db.add(row)
        db.flush()
        row.chart_data = _decorate_saved_chart_data(row, payload, chart)
        db.flush()
        return _saved_response(row)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error saving composite: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка сохранения композита: {str(exc)}",
        )


@router.get(
    "/composite/saved",
    response_model=list[CompositeSavedResponse],
    summary="Список сохранённых композитных карт",
)
def list_saved_composites(
    tag: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> list[CompositeSavedResponse]:
    assert_feature_enabled(auth.astrologer, FEATURE_CLIENTS, plan_code=auth.effective_plan_code)
    query = (
        db.query(CompositeChart)
        .filter(CompositeChart.astrologer_id == auth.astrologer.id)
        .order_by(CompositeChart.updated_at.desc(), CompositeChart.created_at.desc())
    )
    rows = query.all()
    if tag:
        wanted = tag.strip().casefold()
        rows = [
            row for row in rows
            if any(str(item).strip().casefold() == wanted for item in (row.tags or []))
        ]
    return [_saved_response(row) for row in rows]


@router.get(
    "/composite/saved/{composite_chart_id}",
    response_model=CompositeSavedResponse,
    summary="Загрузить сохранённую композитную карту",
)
def get_saved_composite(
    composite_chart_id: UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> CompositeSavedResponse:
    row = (
        db.query(CompositeChart)
        .filter(
            CompositeChart.composite_chart_id == composite_chart_id,
            CompositeChart.astrologer_id == auth.astrologer.id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Composite chart not found")
    return _saved_response(row)

"""API endpoint for composite charts (midpoint + Davison) of two clients."""
from __future__ import annotations

from datetime import date as date_type, time as time_type
from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from loguru import logger
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, ensure_client_access, require_auth
from app.database.connection import get_db
from app.services.aspect_service import AspectService
from app.services.composite_service import CompositeService
from app.services.entitlements_service import FEATURE_CLIENTS, assert_feature_enabled
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

    @model_validator(mode="after")
    def _exactly_one_partner(self) -> "CompositeRequest":
        # Exactly one of the two partner sources must be present (D4).
        if bool(self.partner_id) == bool(self.partner_birth_data):
            raise ValueError(
                "Provide exactly one of partner_id or partner_birth_data"
            )
        return self


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
        # The primary is always a saved client the astrologer must own.
        ensure_client_access(db, request, auth, payload.user_id, action="client.composite.primary")
        primary = _natal_service.get_natal_chart_from_db(payload.user_id, db)
        if primary is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Primary natal chart not found")

        if payload.partner_id is not None:
            # Saved partner: authorize and load from DB.
            ensure_client_access(db, request, auth, payload.partner_id, action="client.composite.partner")
            partner = _natal_service.get_natal_chart_from_db(payload.partner_id, db)
            if partner is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner natal chart not found")
        else:
            # Manual partner: user-supplied data, no DB record to authorize (D2).
            # Built in-memory only — save_to_db stays False so nothing is persisted.
            partner = _build_manual_partner(payload.partner_birth_data, payload.house_system, auth, db)

        service = CompositeService(engine=SwissEphemerisEngine(ephe_path=EPHE_PATH))
        midpoint = CompositeService.midpoint_composite(primary, partner)
        davison_unavailable_reason: str | None = None
        try:
            davison = service.davison(primary, partner, house_system=payload.house_system)
        except ValueError as exc:
            # Birth data incomplete for Davison — still return the midpoint composite.
            logger.info("Davison skipped: {}", str(exc))
            davison = None
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
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error calculating composite: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка расчёта композита: {str(exc)}",
        )

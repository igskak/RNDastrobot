"""API endpoint for composite charts (midpoint + Davison) of two clients."""
from __future__ import annotations

from typing import Any, Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, ensure_client_access, require_auth
from app.database.connection import get_db
from app.services.composite_service import CompositeService
from app.services.entitlements_service import FEATURE_CLIENTS, assert_feature_enabled
from app.services.natal_chart_service import NatalChartService
from app.services.swisseph_engine import SwissEphemerisEngine
from app.utils.ephemeris import get_ephemeris_path

router = APIRouter()

EPHE_PATH = get_ephemeris_path()
_natal_service = NatalChartService(ephe_path=EPHE_PATH)


class CompositeRequest(BaseModel):
    user_id: UUID = Field(..., description="ID основного клиента")
    partner_id: UUID = Field(..., description="ID второго клиента")
    house_system: str = Field("P", description="Система домов для Davison")


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
        ensure_client_access(db, request, auth, payload.user_id, action="client.composite.primary")
        ensure_client_access(db, request, auth, payload.partner_id, action="client.composite.partner")

        primary = _natal_service.get_natal_chart_from_db(payload.user_id, db)
        partner = _natal_service.get_natal_chart_from_db(payload.partner_id, db)
        if primary is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Primary natal chart not found")
        if partner is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner natal chart not found")

        service = CompositeService(engine=SwissEphemerisEngine(ephe_path=EPHE_PATH))
        midpoint = CompositeService.midpoint_composite(primary, partner)
        try:
            davison = service.davison(primary, partner, house_system=payload.house_system)
        except ValueError as exc:
            # Birth data incomplete for Davison — still return the midpoint composite.
            logger.info("Davison skipped: {}", str(exc))
            davison = None

        return {"midpoint": midpoint, "davison": davison}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error calculating composite: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка расчёта композита: {str(exc)}",
        )

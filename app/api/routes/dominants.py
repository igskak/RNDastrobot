"""API endpoint for chart dominants (planets/signs/elements/modes/houses)."""
from __future__ import annotations

from typing import Any, Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from loguru import logger
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, ensure_client_access, require_auth
from app.database.connection import get_db
from app.services.dominants_service import DominantsService
from app.services.natal_chart_service import NatalChartService
from app.utils.ephemeris import get_ephemeris_path

router = APIRouter()

EPHE_PATH = get_ephemeris_path()
_natal_service = NatalChartService(ephe_path=EPHE_PATH)


@router.get(
    "/dominants",
    status_code=status.HTTP_200_OK,
    summary="Доминанты карты: планеты/знаки/стихии/кресты/дома",
)
def get_dominants(
    user_id: UUID = Query(..., description="ID клиента"),
    top_n: int = Query(5, ge=1, le=12, description="Сколько верхних позиций возвращать"),
    request: Request = None,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> Dict[str, Any]:
    try:
        ensure_client_access(db, request, auth, user_id, action="client.dominants")
        chart = _natal_service.get_natal_chart_from_db(user_id, db)
        if chart is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Natal chart not found")
        return DominantsService.compute(chart, top_n=top_n)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error computing dominants: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка расчёта доминант: {str(exc)}",
        )

"""API endpoint for annual/monthly profections of a saved chart."""
from __future__ import annotations

from datetime import date
from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from loguru import logger
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, ensure_client_access, require_auth
from app.database.connection import get_db
from app.services.natal_chart_service import NatalChartService
from app.services.profections_service import ProfectionsService
from app.utils.ephemeris import get_ephemeris_path

router = APIRouter()

EPHE_PATH = get_ephemeris_path()
_natal_service = NatalChartService(ephe_path=EPHE_PATH)


@router.get(
    "/profections",
    status_code=status.HTTP_200_OK,
    summary="Годовая/месячная профекция сохранённой карты",
)
def get_profections(
    user_id: UUID = Query(..., description="ID клиента"),
    at: Optional[date] = Query(None, description="Целевая дата (ISO). По умолчанию — сегодня."),
    request: Request = None,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> Dict[str, Any]:
    try:
        ensure_client_access(db, request, auth, user_id, action="client.profections")
        chart = _natal_service.get_natal_chart_from_db(user_id, db)
        if chart is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Natal chart not found")

        asc = (chart.get("angles") or {}).get("ASC") or {}
        asc_sign = asc.get("sign")
        birth_iso = (chart.get("birth_data") or {}).get("date")
        if not asc_sign or not birth_iso:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Chart lacks ascendant sign or birth date",
            )

        return ProfectionsService.profections(
            ascendant_sign=asc_sign,
            birth_date=date.fromisoformat(birth_iso),
            target_date=at,
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        logger.exception("Error computing profections: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка расчёта профекций: {str(exc)}",
        )

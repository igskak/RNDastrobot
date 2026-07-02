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
from app.services.forecast_aux_service import ForecastAuxService
from app.utils.ephemeris import get_ephemeris_path

router = APIRouter()

EPHE_PATH = get_ephemeris_path()


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
        user = ensure_client_access(db, request, auth, user_id, action="client.profections")
        return ForecastAuxService(db, ephe_path=EPHE_PATH).get_saved_block(
            user,
            "profections",
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

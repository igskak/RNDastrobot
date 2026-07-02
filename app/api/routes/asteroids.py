"""API endpoint for the major asteroids (Ceres, Pallas, Juno, Vesta) of a chart."""
from __future__ import annotations

from typing import Any, Dict
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
    "/asteroids",
    status_code=status.HTTP_200_OK,
    summary="Основные астероиды (Церера/Паллада/Юнона/Веста) для сохранённой карты",
)
def get_asteroids(
    user_id: UUID = Query(..., description="ID клиента"),
    request: Request = None,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> Dict[str, Any]:
    try:
        user = ensure_client_access(db, request, auth, user_id, action="client.asteroids")
        return ForecastAuxService(db, ephe_path=EPHE_PATH).get_saved_block(user, "asteroids")
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        logger.exception("Error computing asteroids: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка расчёта астероидов: {str(exc)}",
        )

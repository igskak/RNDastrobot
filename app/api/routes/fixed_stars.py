"""API endpoint for fixed stars and their conjunctions with a saved chart."""
from __future__ import annotations

from typing import Any, Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from loguru import logger
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, ensure_client_access, require_auth
from app.database.connection import get_db
from app.services.fixed_stars_service import DEFAULT_STAR_ORB
from app.services.forecast_aux_service import ForecastAuxService
from app.utils.ephemeris import get_ephemeris_path

router = APIRouter()

EPHE_PATH = get_ephemeris_path()


@router.get(
    "/fixed-stars",
    status_code=status.HTTP_200_OK,
    summary="Фиксированные звёзды и их соединения с точками сохранённой карты",
)
def get_fixed_stars(
    user_id: UUID = Query(..., description="ID клиента"),
    orb: float = Query(DEFAULT_STAR_ORB, ge=0.0, le=3.0, description="Орб соединения (°)"),
    request: Request = None,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> Dict[str, Any]:
    try:
        user = ensure_client_access(db, request, auth, user_id, action="client.fixed_stars")
        return ForecastAuxService(db, ephe_path=EPHE_PATH).get_saved_block(
            user,
            "fixed_stars",
            options={"fixed_star_orb": orb},
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        logger.exception("Error computing fixed stars: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка расчёта фиксированных звёзд: {str(exc)}",
        )

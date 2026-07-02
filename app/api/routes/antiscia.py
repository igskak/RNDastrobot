"""API endpoint for antiscia / contra-antiscia of a saved chart."""
from __future__ import annotations

from typing import Any, Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from loguru import logger
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, ensure_client_access, require_auth
from app.database.connection import get_db
from app.services.antiscia_service import DEFAULT_ANTISCIA_ORB
from app.services.forecast_aux_service import ForecastAuxService
from app.utils.ephemeris import get_ephemeris_path

router = APIRouter()

EPHE_PATH = get_ephemeris_path()


@router.get(
    "/antiscia",
    status_code=status.HTTP_200_OK,
    summary="Антисы/контрантисы и их контакты для сохранённой карты",
)
def get_antiscia(
    user_id: UUID = Query(..., description="ID клиента"),
    orb: float = Query(DEFAULT_ANTISCIA_ORB, ge=0.0, le=5.0, description="Орб для контактов (°)"),
    request: Request = None,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> Dict[str, Any]:
    try:
        user = ensure_client_access(db, request, auth, user_id, action="client.antiscia")
        return ForecastAuxService(db, ephe_path=EPHE_PATH).get_saved_block(
            user,
            "antiscia",
            options={"antiscia_orb": orb},
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        logger.exception("Error computing antiscia: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка расчёта антисов: {str(exc)}",
        )

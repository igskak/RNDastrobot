"""API endpoint for the electional workspace block (планетные часы, лунный день)."""

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger

from app.auth.dependencies import AuthContext, require_auth
from app.services.electional_service import ElectionalService

router = APIRouter()


@router.get(
    "/electional/planetary-hours",
    status_code=status.HTTP_200_OK,
    summary="Планетные часы, управитель дня и лунный день для локации",
)
def get_planetary_hours(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Широта (северная положительна)"),
    lon: float = Query(..., ge=-180.0, le=180.0, description="Долгота (восточная положительна)"),
    at: Optional[datetime] = Query(
        None,
        description="Момент в ISO-8601 (UTC, если без таймзоны). По умолчанию — сейчас.",
    ),
    auth: AuthContext = Depends(require_auth),
) -> Dict[str, Any]:
    try:
        at_utc = datetime.now(timezone.utc) if at is None else (
            at if at.tzinfo else at.replace(tzinfo=timezone.utc)
        )
        service = ElectionalService()
        return service.planetary_hours(at_utc=at_utc, lat=lat, lon=lon)
    except Exception as exc:
        logger.exception("Error computing planetary hours: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка расчёта планетных часов: {str(exc)}",
        )

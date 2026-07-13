"""API endpoint for the lunar workspace block (фаза Луны, VOC, лунации)."""

from datetime import date, datetime, time, timezone
from typing import Any, Dict, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger

from app.auth.dependencies import AuthContext, require_auth
from app.services.lunar_service import LunarService

router = APIRouter()


@router.get(
    "/lunar/snapshot",
    status_code=status.HTTP_200_OK,
    summary="Лунный снапшот: фаза, Void of Course, ближайшие лунации/затмения",
)
def get_lunar_snapshot(
    at: Optional[datetime] = Query(
        None,
        description="Момент в ISO-8601 (UTC, если без таймзоны). По умолчанию — сейчас.",
    ),
    lunations: int = Query(4, ge=1, le=12, description="Сколько ближайших лунаций вернуть"),
    auth: AuthContext = Depends(require_auth),
) -> Dict[str, Any]:
    try:
        at_utc: Optional[datetime] = None
        if at is not None:
            at_utc = at if at.tzinfo else at.replace(tzinfo=timezone.utc)
        service = LunarService()
        return service.build_snapshot(at_utc=at_utc, lunation_count=lunations)
    except Exception as exc:
        logger.exception("Error building lunar snapshot: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка расчёта лунного снапшота: {str(exc)}",
        )


@router.get(
    "/lunar/eclipses",
    status_code=status.HTTP_200_OK,
    summary="Солнечные и лунные затмения за период с локальной видимостью",
)
def get_eclipses(
    start_date: date = Query(..., description="Начало локального периода включительно"),
    end_date: date = Query(..., description="Конец локального периода включительно"),
    timezone_name: str = Query("UTC", alias="timezone", description="IANA-таймзона карты"),
    latitude: Optional[float] = Query(None, ge=-90, le=90),
    longitude: Optional[float] = Query(None, ge=-180, le=180),
    location_name: Optional[str] = Query(None, max_length=255),
    auth: AuthContext = Depends(require_auth),
) -> Dict[str, Any]:
    if (latitude is None) != (longitude is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Для локального расчёта нужны и широта, и долгота",
        )
    try:
        zone = ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Неизвестная таймзона карты",
        )
    if abs((end_date - start_date).days) > 3660:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Период расчёта затмений не может превышать 10 лет",
        )
    local_start = datetime.combine(start_date, time.min, tzinfo=zone)
    local_end = datetime.combine(end_date, time.max, tzinfo=zone)
    try:
        return LunarService().eclipses_in_period(
            local_start.astimezone(timezone.utc),
            local_end.astimezone(timezone.utc),
            timezone_name=timezone_name,
            latitude=latitude,
            longitude=longitude,
            location_name=location_name,
        )
    except Exception as exc:
        logger.exception("Error calculating eclipses: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка расчёта затмений: {str(exc)}",
        )

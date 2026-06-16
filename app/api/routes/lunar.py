"""API endpoint for the lunar workspace block (фаза Луны, VOC, лунации)."""

from datetime import datetime, timezone
from typing import Any, Dict, Optional

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

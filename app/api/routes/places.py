"""API эндпоинты для автокомплита мест."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, Header
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.services.geocoding_service import (
    GeocodingService,
    GeocodingServiceError,
    GeocodingTimeoutError,
)

router = APIRouter(prefix="/places", tags=["Places"])

geocoding_service = GeocodingService()


@router.get(
    "/autocomplete",
    status_code=status.HTTP_200_OK,
    summary="Автокомплит населенных пунктов",
    description="Возвращает нормализованный список населенных пунктов без дублей",
)
def autocomplete_places(
    q: str = Query(..., min_length=2, description="Поисковый запрос"),
    limit: int = Query(5, ge=1, le=10, description="Максимум результатов"),
    language: Optional[str] = Query(None, description="Язык ответа (например, ru, uk, en)"),
    accept_language: Optional[str] = Header(None, alias="Accept-Language"),
    db: Session = Depends(get_db),
):
    try:
        locale = language or accept_language or "en"
        results = geocoding_service.autocomplete(q, limit=limit, language=locale, db_session=db)
        return {
            "query": q,
            "results": [
                {
                    "short_name": item["short_name"],
                    "display_name": item["display_name"],
                    "lat": item["lat"],
                    "lon": item["lon"],
                    "source_id": item.get("source_id"),
                }
                for item in results
            ],
        }
    except GeocodingTimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail=f"Таймаут геокодирования: {exc}",
        ) from exc
    except GeocodingServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Ошибка сервиса геокодирования: {exc}",
        ) from exc


@router.get(
    "/timezone",
    status_code=status.HTTP_200_OK,
    summary="Определить timezone по source_id",
    description="Возвращает IANA timezone для локального результата geo_cities",
)
def resolve_place_timezone(
    source_id: str = Query(..., description="source_id из /places/autocomplete"),
    db: Session = Depends(get_db),
):
    timezone = geocoding_service.resolve_timezone_by_source(source_id=source_id, db_session=db)
    return {
        "source_id": source_id,
        "timezone": timezone,
    }

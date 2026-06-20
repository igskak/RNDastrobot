"""API endpoint for fixed stars and their conjunctions with a saved chart."""
from __future__ import annotations

from typing import Any, Dict, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from loguru import logger
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, ensure_client_access, require_auth
from app.database.connection import get_db
from app.services.fixed_stars_service import FixedStarsService, DEFAULT_STAR_ORB
from app.services.natal_chart_service import NatalChartService
from app.utils.ephemeris import get_ephemeris_path

router = APIRouter()

EPHE_PATH = get_ephemeris_path()
_natal_service = NatalChartService(ephe_path=EPHE_PATH)
_stars_service = FixedStarsService(ephe_path=EPHE_PATH)


def _collect_objects(chart: Dict) -> List[Dict]:
    objects: List[Dict] = []
    for planet in chart.get("planets") or []:
        if planet.get("longitude") is not None:
            objects.append({"name": planet["name"], "longitude": float(planet["longitude"])})
    for key in ("ASC", "MC", "DSC", "IC"):
        angle = (chart.get("angles") or {}).get(key)
        if angle and angle.get("longitude") is not None:
            objects.append({"name": key, "longitude": float(angle["longitude"])})
    return objects


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
        ensure_client_access(db, request, auth, user_id, action="client.fixed_stars")
        chart = _natal_service.get_natal_chart_from_db(user_id, db)
        if chart is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Natal chart not found")

        jd = (chart.get("birth_data") or {}).get("julian_day")
        if jd is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Chart lacks julian_day")

        objects = _collect_objects(chart)
        return {
            "orb": orb,
            "stars": _stars_service.star_positions(float(jd)),
            "conjunctions": _stars_service.conjunctions(float(jd), objects, orb=orb),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error computing fixed stars: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка расчёта фиксированных звёзд: {str(exc)}",
        )

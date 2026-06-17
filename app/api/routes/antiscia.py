"""API endpoint for antiscia / contra-antiscia of a saved chart."""
from __future__ import annotations

from typing import Any, Dict, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from loguru import logger
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, ensure_client_access, require_auth
from app.database.connection import get_db
from app.services.antiscia_service import AntisciaService, DEFAULT_ANTISCIA_ORB
from app.services.natal_chart_service import NatalChartService
from app.utils.ephemeris import get_ephemeris_path

router = APIRouter()

EPHE_PATH = get_ephemeris_path()
_natal_service = NatalChartService(ephe_path=EPHE_PATH)


def _collect_objects(chart: Dict) -> List[Dict]:
    objects: List[Dict] = []
    for planet in chart.get("planets") or []:
        if planet.get("longitude") is not None:
            objects.append({"name": planet["name"], "longitude": float(planet["longitude"])})
    for point in (chart.get("special_points") or {}).values():
        if point and point.get("longitude") is not None:
            objects.append({"name": point["name"], "longitude": float(point["longitude"])})
    for key in ("ASC", "MC"):
        angle = (chart.get("angles") or {}).get(key)
        if angle and angle.get("longitude") is not None:
            objects.append({"name": key, "longitude": float(angle["longitude"])})
    return objects


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
        ensure_client_access(db, request, auth, user_id, action="client.antiscia")
        chart = _natal_service.get_natal_chart_from_db(user_id, db)
        if chart is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Natal chart not found")

        objects = _collect_objects(chart)
        return {
            "orb": orb,
            "points": AntisciaService.compute_for_objects(objects),
            "contacts": AntisciaService.find_contacts(objects, orb=orb),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error computing antiscia: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка расчёта антисов: {str(exc)}",
        )

"""API endpoint for declination aspects (parallels / contra-parallels) of a chart."""
from __future__ import annotations

from typing import Any, Dict, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from loguru import logger
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, ensure_client_access, require_auth
from app.database.connection import get_db
from app.services.declination_service import DeclinationService, DEFAULT_DECLINATION_ORB
from app.services.natal_chart_service import NatalChartService
from app.utils.ephemeris import get_ephemeris_path

router = APIRouter()

EPHE_PATH = get_ephemeris_path()
_natal_service = NatalChartService(ephe_path=EPHE_PATH)


def _collect_objects(chart: Dict) -> List[Dict]:
    # Склонение есть только у планет (см. swisseph_engine.calculate_planets).
    # Углы/спец-точки пока без δ — параллели считаем по планетам.
    objects: List[Dict] = []
    for planet in chart.get("planets") or []:
        if planet.get("declination") is not None:
            objects.append({
                "name": planet["name"],
                "declination": float(planet["declination"]),
                "out_of_bounds": bool(planet.get("out_of_bounds", False)),
            })
    return objects


@router.get(
    "/declination",
    status_code=status.HTTP_200_OK,
    summary="Параллели/контрпараллели по склонению для сохранённой карты",
)
def get_declination(
    user_id: UUID = Query(..., description="ID клиента"),
    orb: float = Query(DEFAULT_DECLINATION_ORB, ge=0.0, le=5.0, description="Орб для контактов (°)"),
    request: Request = None,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> Dict[str, Any]:
    try:
        ensure_client_access(db, request, auth, user_id, action="client.declination")
        chart = _natal_service.get_natal_chart_from_db(user_id, db)
        if chart is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Natal chart not found")

        objects = _collect_objects(chart)
        return {
            "orb": orb,
            "points": DeclinationService.compute_for_objects(objects),
            "contacts": DeclinationService.find_contacts(objects, orb=orb),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error computing declination aspects: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка расчёта параллелей: {str(exc)}",
        )

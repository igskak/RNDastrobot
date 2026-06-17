"""API endpoint for the major asteroids (Ceres, Pallas, Juno, Vesta) of a chart."""
from __future__ import annotations

from typing import Any, Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from loguru import logger
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, ensure_client_access, require_auth
from app.database.connection import get_db
from app.services.natal_chart_service import NatalChartService
from app.services.swisseph_engine import SwissEphemerisEngine
from app.utils.ephemeris import get_ephemeris_path

router = APIRouter()

EPHE_PATH = get_ephemeris_path()
_natal_service = NatalChartService(ephe_path=EPHE_PATH)
_engine = SwissEphemerisEngine(ephe_path=EPHE_PATH)


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
        ensure_client_access(db, request, auth, user_id, action="client.asteroids")
        chart = _natal_service.get_natal_chart_from_db(user_id, db)
        if chart is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Natal chart not found")

        birth = chart.get("birth_data") or {}
        jd = birth.get("julian_day")
        if jd is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Chart lacks julian_day")

        zodiac = birth.get("zodiac") or "tropical"
        ayanamsha = birth.get("ayanamsha") or "lahiri"
        asteroids = _engine.calculate_asteroids(float(jd), zodiac=zodiac, ayanamsha=ayanamsha)

        houses = chart.get("houses") or []
        if houses:
            for a in asteroids:
                a["house"] = _engine.get_planet_house(a["longitude"], houses)

        return {"zodiac": zodiac, "asteroids": asteroids}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error computing asteroids: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка расчёта астероидов: {str(exc)}",
        )

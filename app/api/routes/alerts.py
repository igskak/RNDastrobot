"""
API endpoint for dashboard smart alerts (solar returns + major transits).
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.auth.dependencies import AuthContext, require_auth
from app.services.alerts_service import AlertsService
from app.utils.ephemeris import get_ephemeris_path
from loguru import logger

router = APIRouter(prefix="/alerts")

EPHE_PATH = get_ephemeris_path()


@router.get(
    "/dashboard",
    summary="Dashboard alerts: solar returns & major transits",
)
def get_dashboard_alerts(
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    try:
        service = AlertsService(db_session=db, ephe_path=EPHE_PATH)
        return service.get_dashboard_alerts(astrologer_id=auth.astrologer.id)
    except Exception as e:
        logger.exception(f"Error computing dashboard alerts: {e}")
        return {"solar_returns": [], "transits": []}

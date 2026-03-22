"""
Smart Alerts Service — solar returns & major transits for the dashboard.

Lightweight service that scans all clients for an astrologer and returns
actionable alerts: upcoming solar returns and hard transits to luminaries.
"""
from typing import Dict, List, Optional
from uuid import UUID
from datetime import date, datetime, timedelta
from decimal import Decimal

import swisseph as swe
from sqlalchemy.orm import Session, selectinload
from loguru import logger

from app.database.models import User, NatalPlanet
from app.services.transit_service import TransitService

# Hard aspects only
_ALERT_ASPECT_TYPES = frozenset({'Conjunction', 'Opposition', 'Square'})
# Outer planets only
_ALERT_TRANSIT_BODIES = ['Saturn', 'Uranus', 'Neptune', 'Pluto']
# Luminaries + angles
_ALERT_NATAL_TARGETS = ['Sun', 'Moon']


class AlertsService:
    """Compute dashboard alerts for an astrologer's client base."""

    def __init__(self, db_session: Session, ephe_path: str = None):
        self.db = db_session
        if ephe_path:
            swe.set_ephe_path(ephe_path)
        self._transit_service = TransitService(db_session, ephe_path)

    def get_dashboard_alerts(
        self,
        astrologer_id: UUID,
        now: Optional[date] = None,
    ) -> Dict:
        now = now or date.today()

        users = (
            self.db.query(User)
            .filter(User.astrologer_id == astrologer_id)
            .options(selectinload(User.planets))
            .all()
        )

        if not users:
            return {"solar_returns": [], "transits": []}

        solar_alerts = self._find_solar_returns_this_month(users, now)
        transit_alerts = self._find_major_transits(users, now)

        return {
            "solar_returns": sorted(solar_alerts, key=lambda a: a["solar_date"]),
            "transits": sorted(transit_alerts, key=lambda a: a["exact_date"]),
        }

    # ── Solar returns ────────────────────────────────────────────────

    def _find_solar_returns_this_month(
        self, users: List[User], now: date
    ) -> List[Dict]:
        alerts = []
        year = now.year
        month = now.month

        for user in users:
            try:
                natal_sun_lon = self._get_natal_sun_longitude(user)
                if natal_sun_lon is None:
                    continue

                jd_solar = swe.solcross_ut(natal_sun_lon, swe.julday(year, 1, 1, 0.0), swe.FLG_SWIEPH)
                yr, mo, dy, hr = swe.revjul(jd_solar)

                if int(mo) != month or int(yr) != year:
                    continue

                solar_date = date(int(yr), int(mo), int(dy))
                days_until = (solar_date - now).days

                name = " ".join(filter(None, [user.first_name, user.last_name])) or "—"
                alerts.append({
                    "user_id": str(user.user_id),
                    "name": name,
                    "solar_date": solar_date.isoformat(),
                    "days_until": days_until,
                })
            except Exception as e:
                logger.warning(f"Solar return alert failed for user {user.user_id}: {e}")

        return alerts

    @staticmethod
    def _get_natal_sun_longitude(user: User) -> Optional[float]:
        if not user.planets:
            return None
        for p in user.planets:
            if p.planet == 'Sun':
                return float(p.degree) if p.degree is not None else None
        return None

    # ── Major transits ───────────────────────────────────────────────

    def _find_major_transits(
        self, users: List[User], now: date
    ) -> List[Dict]:
        alerts = []
        end_date = now + timedelta(days=30)

        for user in users:
            try:
                events = self._transit_service.find_transit_events(
                    user_id=user.user_id,
                    start_date=now,
                    end_date=end_date,
                    timezone=user.timezone or 'UTC',
                    step_hours=6,
                    transit_bodies=_ALERT_TRANSIT_BODIES,
                    natal_bodies=_ALERT_NATAL_TARGETS,
                    aspect_types=None,  # filter below — service doesn't accept aspect type filter directly
                    use_cache=True,
                    save_to_db=True,
                )

                name = " ".join(filter(None, [user.first_name, user.last_name])) or "—"

                for event in events:
                    aspect = event.get('aspect_type', '')
                    if aspect not in _ALERT_ASPECT_TYPES:
                        continue

                    exact_raw = event.get('t_exact', '')
                    exact_date = exact_raw[:10] if exact_raw else ''

                    alerts.append({
                        "user_id": str(user.user_id),
                        "name": name,
                        "transit_body": event.get('transit_body', ''),
                        "natal_body": event.get('natal_body', ''),
                        "aspect": aspect,
                        "exact_date": exact_date,
                        "harmonic_type": event.get('harmonic_type', ''),
                    })

            except Exception as e:
                logger.warning(f"Transit alert failed for user {user.user_id}: {e}")

        return alerts

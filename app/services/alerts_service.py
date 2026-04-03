"""
Smart Alerts Service — solar returns & major transits for the dashboard.

Lightweight service that scans all clients for an astrologer and returns
actionable alerts: upcoming solar returns and hard transits to luminaries.
"""
from typing import Dict, List, Optional
from uuid import UUID
from datetime import date

import swisseph as swe
from sqlalchemy.orm import Session, selectinload
from loguru import logger

from app.database.models import User, NatalPlanet

# Luminaries — natal targets for dashboard alerts
_ALERT_NATAL_TARGETS = ['Sun', 'Moon']


class AlertsService:
    """Compute dashboard alerts for an astrologer's client base."""

    def __init__(self, db_session: Session, ephe_path: str = None):
        self.db = db_session
        if ephe_path:
            swe.set_ephe_path(ephe_path)

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

    # SWE planet IDs for the 4 outer transit bodies
    _BODY_SWE_ID = {'Saturn': 6, 'Uranus': 7, 'Neptune': 8, 'Pluto': 9}

    # Hard aspects: (exact_angle, name, harmonic_type)
    _HARD_ASPECTS = [
        (0.0,   'Conjunction', 'neutral'),
        (180.0, 'Opposition',  'tense'),
        (90.0,  'Square',      'tense'),
    ]

    _ALERT_ORB = 5.0  # generous orb for dashboard-level alerts

    def _find_major_transits(
        self, users: List[User], now: date
    ) -> List[Dict]:
        """
        Fast major-transit detection: compute 4 outer-planet positions ONCE,
        then do simple float comparisons against each client's natal Sun/Moon.
        """
        alerts = []
        jd_now = swe.julday(now.year, now.month, now.day, 12.0)

        # Compute transit positions ONCE for all 4 bodies
        transit_positions: Dict[str, float] = {}
        for body_name, swe_id in self._BODY_SWE_ID.items():
            try:
                planet_data, _ret = swe.calc_ut(jd_now, swe_id, swe.FLG_SWIEPH)
                transit_positions[body_name] = planet_data[0]
            except Exception as e:
                logger.warning(f"Failed to compute transit position for {body_name}: {e}")

        if not transit_positions:
            return alerts

        for user in users:
            try:
                if not user.planets:
                    continue

                name = " ".join(filter(None, [user.first_name, user.last_name])) or "—"

                for natal_p in user.planets:
                    if natal_p.planet not in _ALERT_NATAL_TARGETS or natal_p.degree is None:
                        continue
                    natal_lon = float(natal_p.degree)

                    for t_name, t_lon in transit_positions.items():
                        diff = abs(t_lon - natal_lon)
                        if diff > 180:
                            diff = 360 - diff

                        for exact_angle, aspect_name, harmonic_type in self._HARD_ASPECTS:
                            deviation = abs(diff - exact_angle)
                            if deviation <= self._ALERT_ORB:
                                alerts.append({
                                    "user_id": str(user.user_id),
                                    "name": name,
                                    "transit_body": t_name,
                                    "natal_body": natal_p.planet,
                                    "aspect": aspect_name,
                                    "exact_date": now.isoformat(),
                                    "harmonic_type": harmonic_type,
                                })

            except Exception as e:
                logger.warning(f"Transit alert failed for user {user.user_id}: {e}")

        return alerts

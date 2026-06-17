"""
Electional service — планетные часы, управитель дня, лунный день (P3).

«Момент сейчас» для электив/хорар (source 'now', блок `hours`):
- планетные часы (халдейский ряд) от восхода/заката для заданной локации;
- управитель текущего часа и управитель дня недели;
- номер лунного дня (от последнего новолуния).

Опирается на Swiss Ephemeris напрямую (как `swisseph_engine`/`lunar_service`).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone as _tz
from typing import Dict, List, Optional

import swisseph as swe
from loguru import logger

from app.utils.ephemeris import get_ephemeris_path

# Халдейский ряд (от медленной к быстрой) — порядок управителей планетных часов.
_CHALDEAN = ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon"]

# Управитель дня недели. Python weekday(): Monday=0 .. Sunday=6.
_DAY_RULERS = {
    0: "Moon",      # Monday
    1: "Mars",      # Tuesday
    2: "Mercury",   # Wednesday
    3: "Jupiter",   # Thursday
    4: "Venus",     # Friday
    5: "Saturn",    # Saturday
    6: "Sun",       # Sunday
}


class ElectionalService:
    """Планетные часы и сопутствующий тайминг для блока `hours`."""

    def __init__(self, ephe_path: Optional[str] = None):
        self.ephe_path = ephe_path or get_ephemeris_path()
        swe.set_ephe_path(self.ephe_path)

    # --- время ----------------------------------------------------------

    @staticmethod
    def _to_jd(dt_utc: datetime) -> float:
        hour = (dt_utc.hour + dt_utc.minute / 60.0 + dt_utc.second / 3600.0
                + dt_utc.microsecond / 3.6e9)
        return swe.julday(dt_utc.year, dt_utc.month, dt_utc.day, hour, swe.GREG_CAL)

    @staticmethod
    def _jd_to_dt(jd: float) -> datetime:
        y, m, d, h = swe.revjul(jd, swe.GREG_CAL)
        hh = int(h)
        mm = int((h - hh) * 60)
        ss = int(round((((h - hh) * 60) - mm) * 60))
        if ss == 60:
            ss = 59
        return datetime(y, m, d, hh, mm, ss, tzinfo=_tz.utc)

    # --- восход/закат ---------------------------------------------------

    def _rise_or_set(self, jd_start: float, lat: float, lon: float, rising: bool) -> Optional[float]:
        swe.set_ephe_path(self.ephe_path)
        flag = swe.CALC_RISE if rising else swe.CALC_SET
        # BIT_DISC_CENTER: считать по центру диска (без рефракции у горизонта) —
        # стандарт для планетных часов.
        rsmi = flag | swe.BIT_DISC_CENTER
        try:
            res, tret = swe.rise_trans(jd_start, swe.SUN, rsmi, (lon, lat, 0.0))
        except Exception as exc:  # pragma: no cover
            logger.warning("rise_trans failed: {}", str(exc))
            return None
        if res != 0:
            return None  # циркумполярно — события нет
        return tret[0]

    # --- планетные часы -------------------------------------------------

    def planetary_hours(self, at_utc: datetime, lat: float, lon: float) -> Dict:
        """
        24 планетных часа суток, в которые попадает момент at_utc, плюс
        управитель дня и текущий час.
        """
        jd = self._to_jd(at_utc)

        # Восход, ограничивающий текущие «сутки восхода». Берём восход не позже jd:
        # ищем восход начиная за сутки и шагаем вперёд, пока не охватим jd.
        sunrise = self._rise_or_set(jd - 1.0, lat, lon, rising=True)
        if sunrise is None:
            return {"available": False, "reason": "circumpolar"}
        # Если ближайший восход уже позже момента — берём предыдущий день.
        if sunrise > jd:
            sunrise = self._rise_or_set(jd - 2.0, lat, lon, rising=True)
            if sunrise is None:
                return {"available": False, "reason": "circumpolar"}

        sunset = self._rise_or_set(sunrise, lat, lon, rising=False)
        next_sunrise = self._rise_or_set(sunset, lat, lon, rising=True) if sunset else None
        if sunset is None or next_sunrise is None:
            return {"available": False, "reason": "circumpolar"}

        day_len = (sunset - sunrise) / 12.0
        night_len = (next_sunrise - sunset) / 12.0

        # Управитель дня — по дню недели на момент восхода (локальная гражданская
        # дата приближается датой восхода в UT, что для электива достаточно).
        weekday = self._jd_to_dt(sunrise).weekday()
        day_ruler = _DAY_RULERS[weekday]
        start_idx = _CHALDEAN.index(day_ruler)

        hours: List[Dict] = []
        for i in range(24):
            if i < 12:
                h_start = sunrise + i * day_len
                h_end = sunrise + (i + 1) * day_len
                is_day = True
            else:
                h_start = sunset + (i - 12) * night_len
                h_end = sunset + (i - 11) * night_len
                is_day = False
            ruler = _CHALDEAN[(start_idx + i) % 7]
            hours.append({
                "index": i + 1,
                "is_day": is_day,
                "ruler": ruler,
                "start": self._jd_to_dt(h_start).isoformat(),
                "end": self._jd_to_dt(h_end).isoformat(),
                "start_jd": h_start,
                "end_jd": h_end,
            })

        current = next((h for h in hours if h["start_jd"] <= jd < h["end_jd"]), None)

        return {
            "available": True,
            "at": at_utc.astimezone(_tz.utc).isoformat(),
            "day_ruler": day_ruler,
            "sunrise": self._jd_to_dt(sunrise).isoformat(),
            "sunset": self._jd_to_dt(sunset).isoformat(),
            "next_sunrise": self._jd_to_dt(next_sunrise).isoformat(),
            "current_hour": current,
            "hours": hours,
            "lunar_day": self.lunar_day(jd),
        }

    # --- лунный день ----------------------------------------------------

    def lunar_day(self, jd: float) -> Optional[int]:
        """Номер лунного дня (1..30): дни от последнего новолуния, +1."""
        last_new = self._previous_new_moon(jd)
        if last_new is None:
            return None
        return int((jd - last_new) // 1.0) + 1

    def _previous_new_moon(self, jd: float, max_back: float = 31.0) -> Optional[float]:
        """Юлианский день последнего новолуния до jd (элонгация Moon-Sun = 0)."""
        def elong(t: float) -> float:
            swe.set_ephe_path(self.ephe_path)
            moon = swe.calc_ut(t, swe.MOON, swe.FLG_SWIEPH)[0][0]
            sun = swe.calc_ut(t, swe.SUN, swe.FLG_SWIEPH)[0][0]
            return ((moon - sun) % 360.0 + 180.0) % 360.0 - 180.0

        step = 1.0
        t = jd
        prev = elong(t)
        scanned = 0.0
        while scanned < max_back:
            t_prev = t
            t -= step
            scanned += step
            cur = elong(t)
            # Новолуние — переход элонгации через 0 (с малой амплитудой).
            if prev != 0.0 and (prev < 0) != (cur < 0) and abs(prev) < 90 and abs(cur) < 90:
                lo, hi = t, t_prev
                f_lo = elong(lo)
                for _ in range(40):
                    mid = 0.5 * (lo + hi)
                    f_mid = elong(mid)
                    if (f_lo < 0) == (f_mid < 0):
                        lo, f_lo = mid, f_mid
                    else:
                        hi = mid
                return 0.5 * (lo + hi)
            prev = cur
        return None

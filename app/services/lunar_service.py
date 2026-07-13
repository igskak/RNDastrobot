"""
Lunar service — лунный фундамент рабочего экрана (P1).

Считает «момент сейчас» по Луне:
- фаза Луны (8 фаз) + процент освещённости;
- Void of Course (Луна без курса): интервал от последнего точного мажорного
  аспекта Луны к классическим планетам до выхода Луны из текущего знака;
- ближайшие лунации (новолуния/полнолуния) и затмения.

Опирается на Swiss Ephemeris напрямую (как `swisseph_engine`), плюс бисекция
для точных моментов (по образцу `transit_service`).
"""
from __future__ import annotations

from datetime import datetime, timezone as _tz
from typing import Dict, List, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import swisseph as swe
from loguru import logger

from app.utils.constants import get_zodiac_sign, get_degree_in_sign, normalize_longitude
from app.utils.ephemeris import get_ephemeris_path

# Классические тела для определения Void of Course (традиционное определение:
# мажорные аспекты Луны к семи видимым планетам).
_VOC_BODIES = {
    swe.SUN: "Sun",
    swe.MERCURY: "Mercury",
    swe.VENUS: "Venus",
    swe.MARS: "Mars",
    swe.JUPITER: "Jupiter",
    swe.SATURN: "Saturn",
}
# Мажорные аспекты (птолемеевы), по которым определяется VOC.
_VOC_ANGLES = (0.0, 60.0, 90.0, 120.0, 180.0)

# Восемь фаз Луны по углу элонгации (Moon - Sun, 0..360).
_PHASE_NAMES = [
    ("new", "Новолуние"),
    ("waxing_crescent", "Растущий серп"),
    ("first_quarter", "Первая четверть"),
    ("waxing_gibbous", "Растущая Луна"),
    ("full", "Полнолуние"),
    ("waning_gibbous", "Убывающая Луна"),
    ("last_quarter", "Последняя четверть"),
    ("waning_crescent", "Убывающий серп"),
]

_DAY = 1.0  # 1 julian day


class LunarService:
    """Расчёты по Луне для блоков `lunar` / `lunations`."""

    def __init__(self, ephe_path: Optional[str] = None):
        self.ephe_path = ephe_path or get_ephemeris_path()
        swe.set_ephe_path(self.ephe_path)

    # --- конвертация времени -------------------------------------------

    @staticmethod
    def _to_jd(dt_utc: datetime) -> float:
        hour = (dt_utc.hour + dt_utc.minute / 60.0 + dt_utc.second / 3600.0
                + dt_utc.microsecond / 3.6e9)
        return swe.julday(dt_utc.year, dt_utc.month, dt_utc.day, hour, swe.GREG_CAL)

    @staticmethod
    def _jd_to_iso(jd: float) -> str:
        y, m, d, h = swe.revjul(jd, swe.GREG_CAL)
        hh = int(h)
        mm = int((h - hh) * 60)
        ss = int(round((((h - hh) * 60) - mm) * 60))
        if ss == 60:
            ss = 59
        return datetime(y, m, d, hh, mm, ss, tzinfo=_tz.utc).isoformat()

    @classmethod
    def _jd_to_local_iso(cls, jd: float, timezone_name: str) -> str:
        """Convert a Julian UT moment to the requested IANA timezone."""
        try:
            zone = ZoneInfo(timezone_name or "UTC")
        except ZoneInfoNotFoundError:
            zone = _tz.utc
        return datetime.fromisoformat(cls._jd_to_iso(jd)).astimezone(zone).isoformat()

    def build_snapshot(self, at_utc: Optional[datetime] = None,
                       lunation_count: int = 4) -> Dict:
        """
        Полный «момент сейчас» по Луне для блоков `lunar` / `lunations`.
        ISO-времена в UTC; jd сохранены для отладки/клиентских пересчётов.
        """
        if at_utc is None:
            at_utc = datetime.now(_tz.utc)
        jd = self._to_jd(at_utc)

        phase = self.moon_phase(jd)
        voc = self.void_of_course(jd)
        voc_out = {
            "is_void": voc["is_void"],
            "status": voc["status"],
            "starts_jd": voc["starts_jd"],
            "starts_at": self._jd_to_iso(voc["starts_jd"]),
            "ends_jd": voc["ends_jd"],
            "ends_at": self._jd_to_iso(voc["ends_jd"]),
            # Backward-compatible names used by the existing Moon block.
            "egress_jd": voc["ends_jd"],
            "egress_at": self._jd_to_iso(voc["ends_jd"]),
        }
        for k in ("next_aspect", "last_aspect", "start_aspect"):
            a = voc[k]
            voc_out[k] = None if not a else {
                "body": a["body"], "angle": a["angle"],
                "jd": a["jd"], "at": self._jd_to_iso(a["jd"]),
            }

        lunations = []
        for e in self.upcoming_lunations(jd, lunation_count):
            item = dict(e)
            item["at"] = self._jd_to_iso(e["jd"])
            if e["eclipse"]:
                item["eclipse"] = dict(e["eclipse"])
                item["eclipse"]["max_at"] = self._jd_to_iso(e["eclipse"]["max_jd"])
            lunations.append(item)

        return {
            "at": at_utc.astimezone(_tz.utc).isoformat(),
            "jd": jd,
            "phase": phase,
            "void_of_course": voc_out,
            "lunations": lunations,
        }

    # --- низкоуровневые помощники --------------------------------------

    def _lon(self, jd: float, body: int) -> float:
        """Эклиптическая долгота тела на момент jd."""
        swe.set_ephe_path(self.ephe_path)
        data, _ = swe.calc_ut(jd, body, swe.FLG_SWIEPH | swe.FLG_SPEED)
        return data[0]

    def _moon_speed(self, jd: float) -> float:
        swe.set_ephe_path(self.ephe_path)
        data, _ = swe.calc_ut(jd, swe.MOON, swe.FLG_SWIEPH | swe.FLG_SPEED)
        return data[3]

    @staticmethod
    def _elongation(moon_lon: float, sun_lon: float) -> float:
        """Угол Moon-Sun в диапазоне [0, 360)."""
        return normalize_longitude(moon_lon - sun_lon)

    @staticmethod
    def _wrap_pm180(x: float) -> float:
        return (x + 180.0) % 360.0 - 180.0

    # --- фаза Луны ------------------------------------------------------

    def moon_phase(self, jd: float) -> Dict:
        """Фаза Луны + процент освещённости на момент jd."""
        moon_lon = self._lon(jd, swe.MOON)
        sun_lon = self._lon(jd, swe.SUN)
        elong = self._elongation(moon_lon, sun_lon)

        # 8 фаз шириной 45° с центрами на 0/45/.../315.
        idx = int((elong + 22.5) % 360 // 45)
        key, label = _PHASE_NAMES[idx]

        # Освещённость через фазовый угол Солнце-Земля-Луна.
        swe.set_ephe_path(self.ephe_path)
        pheno = swe.pheno_ut(jd, swe.MOON, swe.FLG_SWIEPH)
        illumination = pheno[1]  # фракция освещённого диска 0..1

        return {
            "phase_key": key,
            "phase_label": label,
            "elongation": round(elong, 4),
            "illumination": round(illumination * 100.0, 1),
            "waxing": elong < 180.0,
            "moon_longitude": round(moon_lon, 4),
            "moon_sign": get_zodiac_sign(moon_lon),
            "moon_degree_in_sign": round(get_degree_in_sign(moon_lon), 4),
        }

    # --- Void of Course -------------------------------------------------

    def _next_sign_egress_jd(self, jd: float, max_days: float = 3.0) -> float:
        """Момент, когда Луна покидает текущий знак (входит в следующий)."""
        start_sign = self._moon_sign_index(jd)
        lo, hi = jd, jd + max_days
        # Грубый поиск смены знака.
        step = _DAY / 24.0  # шаг 1 час
        prev = jd
        t = jd + step
        while t <= hi:
            if self._moon_sign_index(t) != start_sign:
                lo, hi = prev, t
                break
            prev = t
            t += step
        else:
            return jd + max_days
        # Бисекция границы знака.
        for _ in range(40):
            mid = 0.5 * (lo + hi)
            if self._moon_sign_index(mid) != start_sign:
                hi = mid
            else:
                lo = mid
        return 0.5 * (lo + hi)

    def _previous_sign_ingress_jd(
        self,
        jd: float,
        max_days: float = 3.0,
    ) -> float:
        """Момент, когда Луна вошла в текущий знак."""
        start_sign = self._moon_sign_index(jd)
        lo, hi = jd - max_days, jd
        step = _DAY / 24.0
        t = jd - step
        prev = jd
        while t >= lo:
            if self._moon_sign_index(t) != start_sign:
                lo, hi = t, prev
                break
            prev = t
            t -= step
        else:
            return jd - max_days
        for _ in range(40):
            mid = 0.5 * (lo + hi)
            if self._moon_sign_index(mid) == start_sign:
                hi = mid
            else:
                lo = mid
        return 0.5 * (lo + hi)

    def _moon_sign_index(self, jd: float) -> int:
        return int(self._lon(jd, swe.MOON) // 30) % 12

    @staticmethod
    def _aspect_orientations(angle: float) -> List[float]:
        if angle in (0.0, 180.0):
            return [angle]
        return [angle, -angle]

    def _aspect_residual(
        self,
        jd: float,
        body: int,
        orientation: float,
    ) -> float:
        """Signed residual for one oriented Moon-body aspect."""
        moon = self._lon(jd, swe.MOON)
        other = self._lon(jd, body)
        return self._wrap_pm180((moon - other) - orientation)

    def _bisect_aspect(
        self,
        lo: float,
        hi: float,
        body: int,
        orientation: float,
    ) -> float:
        f_lo = self._aspect_residual(lo, body, orientation)
        for _ in range(40):
            mid = 0.5 * (lo + hi)
            f_mid = self._aspect_residual(mid, body, orientation)
            if (f_lo < 0) == (f_mid < 0):
                lo, f_lo = mid, f_mid
            else:
                hi = mid
        return 0.5 * (lo + hi)

    def _aspects_between(self, start_jd: float, end_jd: float) -> List[Dict]:
        """All exact major Moon aspects inside one sign interval."""
        step = _DAY / 24.0
        found: List[Dict] = []
        for body_id, body_name in _VOC_BODIES.items():
            for angle in _VOC_ANGLES:
                for orientation in self._aspect_orientations(angle):
                    prev_t = start_jd
                    prev_r = self._aspect_residual(
                        start_jd,
                        body_id,
                        orientation,
                    )
                    t = start_jd + step
                    while t <= end_jd + 1e-9:
                        r = self._aspect_residual(t, body_id, orientation)
                        crossed = prev_r == 0.0 or (
                            (prev_r < 0) != (r < 0)
                            and abs(prev_r - r) < 180.0
                        )
                        if not crossed:
                            prev_t, prev_r = t, r
                            t += step
                            continue
                        if prev_r == 0.0:
                            exact = prev_t
                        else:
                            exact = self._bisect_aspect(
                                prev_t,
                                t,
                                body_id,
                                orientation,
                            )
                        if start_jd - 1e-8 <= exact <= end_jd + 1e-8:
                            found.append({
                                "jd": exact,
                                "body": body_name,
                                "angle": angle,
                            })
                        prev_t, prev_r = t, r
                        t += step
        found.sort(key=lambda item: item["jd"])
        deduped: List[Dict] = []
        for item in found:
            duplicate = deduped and (
                abs(item["jd"] - deduped[-1]["jd"]) < 1e-6
                and item["body"] == deduped[-1]["body"]
                and item["angle"] == deduped[-1]["angle"]
            )
            if not duplicate:
                deduped.append(item)
        return deduped

    def void_of_course(self, jd: float) -> Dict:
        """
        Текущее состояние VOC. Луна считается «без курса», если после момента jd
        и до выхода из знака она не образует ни одного точного мажорного аспекта.
        """
        ingress_jd = self._previous_sign_ingress_jd(jd)
        egress_jd = self._next_sign_egress_jd(jd)
        aspects = self._aspects_between(ingress_jd, egress_jd)
        next_aspect = next(
            (a for a in aspects if a["jd"] > jd + 1e-7),
            None,
        )
        start_aspect = aspects[-1] if aspects else None
        starts_jd = start_aspect["jd"] if start_aspect else ingress_jd
        is_voc = jd >= starts_jd - 1e-7
        last = start_aspect if is_voc else None
        return {
            "is_void": is_voc,
            "status": "active" if is_voc else "upcoming",
            "starts_jd": starts_jd,
            "ends_jd": egress_jd,
            "egress_jd": egress_jd,
            "next_aspect": next_aspect,
            "last_aspect": last,       # аспект, с которого начался текущий VOC
            "start_aspect": start_aspect,
        }

    # --- лунации и затмения --------------------------------------------

    def upcoming_lunations(self, jd: float, count: int = 4) -> List[Dict]:
        """Ближайшие новолуния/полнолуния с пометкой затмений."""
        out: List[Dict] = []
        t = jd
        for _ in range(count * 2):
            event = self._next_syzygy(t)
            if event is None:
                break
            out.append(event)
            t = event["jd"] + 1.0
            if len(out) >= count * 2:
                break
        return out[: count * 2]

    def _next_syzygy(self, jd: float) -> Optional[Dict]:
        """Ближайшая сизигия (новолуние или полнолуние) после jd."""
        step = _DAY / 4.0  # 6 часов
        prev_t = jd
        prev_e = self._elongation(self._lon(jd, swe.MOON), self._lon(jd, swe.SUN))
        t = jd + step
        horizon = jd + 35.0
        while t <= horizon:
            e = self._elongation(self._lon(t, swe.MOON), self._lon(t, swe.SUN))
            for target, kind in ((0.0, "new_moon"), (180.0, "full_moon")):
                d_prev = self._wrap_pm180(prev_e - target)
                d_cur = self._wrap_pm180(e - target)
                if d_prev != 0.0 and (d_prev < 0) != (d_cur < 0) and abs(d_prev) < 90:
                    exact = self._bisect_elong(prev_t, t, target)
                    return self._annotate_syzygy(exact, kind)
            prev_t, prev_e = t, e
            t += step
        return None

    def _bisect_elong(self, lo: float, hi: float, target: float) -> float:
        f_lo = self._wrap_pm180(
            self._elongation(self._lon(lo, swe.MOON), self._lon(lo, swe.SUN)) - target)
        for _ in range(40):
            mid = 0.5 * (lo + hi)
            f_mid = self._wrap_pm180(
                self._elongation(self._lon(mid, swe.MOON), self._lon(mid, swe.SUN)) - target)
            if (f_lo < 0) == (f_mid < 0):
                lo, f_lo = mid, f_mid
            else:
                hi = mid
        return 0.5 * (lo + hi)

    def _annotate_syzygy(self, jd: float, kind: str) -> Dict:
        moon_lon = self._lon(jd, swe.MOON)
        eclipse = self._eclipse_at(jd, kind)
        return {
            "jd": jd,
            "kind": kind,
            "longitude": round(moon_lon, 4),
            "sign": get_zodiac_sign(moon_lon),
            "degree_in_sign": round(get_degree_in_sign(moon_lon), 4),
            "eclipse": eclipse,
        }

    def _eclipse_at(self, jd: float, kind: str) -> Optional[Dict]:
        """Проверить, является ли сизигия затмением (в окне ±1 день)."""
        swe.set_ephe_path(self.ephe_path)
        try:
            if kind == "new_moon":
                ret, tret = swe.sol_eclipse_when_glob(jd - 1.0, swe.FLG_SWIEPH, 0)
                max_jd = tret[0]
                etype = "solar"
            else:
                ret, tret = swe.lun_eclipse_when(jd - 1.0, swe.FLG_SWIEPH, 0)
                max_jd = tret[0]
                etype = "lunar"
        except Exception as exc:  # pragma: no cover - зависит от эфемерид
            logger.warning("eclipse lookup failed: {}", str(exc))
            return None
        if abs(max_jd - jd) > 1.0:
            return None
        kinds = []
        if ret & swe.ECL_TOTAL:
            kinds.append("total")
        if ret & swe.ECL_ANNULAR:
            kinds.append("annular")
        if ret & swe.ECL_PARTIAL:
            kinds.append("partial")
        if ret & swe.ECL_PENUMBRAL:
            kinds.append("penumbral")
        return {"type": etype, "classes": kinds or ["partial"], "max_jd": max_jd}

    # --- затмения в периоде --------------------------------------------

    @staticmethod
    def _eclipse_classes(flags: int) -> List[str]:
        classes: List[str] = []
        if flags & swe.ECL_TOTAL:
            classes.append("total")
        if flags & swe.ECL_ANNULAR:
            classes.append("annular")
        if getattr(swe, "ECL_ANNULAR_TOTAL", 0) and flags & swe.ECL_ANNULAR_TOTAL:
            classes.append("hybrid")
        if flags & swe.ECL_PARTIAL:
            classes.append("partial")
        if flags & swe.ECL_PENUMBRAL:
            classes.append("penumbral")
        return list(dict.fromkeys(classes)) or ["partial"]

    @staticmethod
    def _contact_or_default(values, index: int, default: float) -> float:
        value = values[index] if len(values) > index else 0.0
        return float(value) if value and value > 0 else default

    def _local_solar_circumstances(
        self,
        max_jd: float,
        longitude: float,
        latitude: float,
    ) -> Dict:
        """Local visibility/circumstances for one known global solar eclipse."""
        try:
            flags, times, attr = swe.sol_eclipse_when_loc(
                max_jd - 2.0,
                (longitude, latitude, 0.0),
                swe.FLG_SWIEPH,
                False,
            )
        except Exception as exc:  # pragma: no cover - ephemeris dependent
            logger.warning("local solar eclipse lookup failed: {}", str(exc))
            return {"visible": False}
        if abs(float(times[0]) - max_jd) > 2.0:
            return {"visible": False}
        return {
            "visible": bool(flags & swe.ECL_VISIBLE),
            "classes": self._eclipse_classes(flags),
            "begin_jd": self._contact_or_default(times, 1, max_jd),
            "max_jd": float(times[0]),
            "end_jd": self._contact_or_default(times, 4, max_jd),
            "magnitude": round(float(attr[0]), 4),
            "obscuration": round(float(attr[2]), 4),
            "altitude": round(float(attr[5]), 2),
        }

    def _local_lunar_circumstances(
        self,
        max_jd: float,
        longitude: float,
        latitude: float,
    ) -> Dict:
        """Local visibility/circumstances for one known global lunar eclipse."""
        try:
            flags, times, attr = swe.lun_eclipse_when_loc(
                max_jd - 2.0,
                (longitude, latitude, 0.0),
                swe.FLG_SWIEPH,
                False,
            )
        except Exception as exc:  # pragma: no cover - ephemeris dependent
            logger.warning("local lunar eclipse lookup failed: {}", str(exc))
            return {"visible": False}
        if abs(float(times[0]) - max_jd) > 2.0:
            return {"visible": False}
        begin_jd = self._contact_or_default(times, 6, max_jd)
        end_jd = self._contact_or_default(times, 7, max_jd)
        return {
            "visible": True,
            "classes": self._eclipse_classes(flags),
            "begin_jd": begin_jd,
            "max_jd": float(times[0]),
            "end_jd": end_jd,
            "magnitude": round(float(attr[0]), 4),
            "penumbral_magnitude": round(float(attr[1]), 4),
            "altitude": round(float(attr[5]), 2),
        }

    def eclipses_in_period(
        self,
        start_utc: datetime,
        end_utc: datetime,
        *,
        timezone_name: str = "UTC",
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        location_name: Optional[str] = None,
    ) -> Dict:
        """Return every solar and lunar eclipse whose maximum is in a period.

        Global circumstances are always returned.  When coordinates are supplied,
        each event is additionally evaluated for local visibility and local contact
        times at the chart location.
        """
        if start_utc.tzinfo is None:
            start_utc = start_utc.replace(tzinfo=_tz.utc)
        if end_utc.tzinfo is None:
            end_utc = end_utc.replace(tzinfo=_tz.utc)
        start_utc = start_utc.astimezone(_tz.utc)
        end_utc = end_utc.astimezone(_tz.utc)
        if end_utc < start_utc:
            start_utc, end_utc = end_utc, start_utc

        start_jd = self._to_jd(start_utc)
        end_jd = self._to_jd(end_utc)
        has_location = latitude is not None and longitude is not None
        events: List[Dict] = []

        def append_event(eclipse_type: str, flags: int, times) -> None:
            max_jd = float(times[0])
            if max_jd < start_jd - 1e-7 or max_jd > end_jd + 1e-7:
                return
            if eclipse_type == "solar":
                begin_jd = self._contact_or_default(times, 2, max_jd)
                end_event_jd = self._contact_or_default(times, 3, max_jd)
                local = self._local_solar_circumstances(max_jd, longitude, latitude) if has_location else None
            else:
                begin_jd = self._contact_or_default(times, 6, max_jd)
                end_event_jd = self._contact_or_default(times, 7, max_jd)
                local = self._local_lunar_circumstances(max_jd, longitude, latitude) if has_location else None

            moon_lon = self._lon(max_jd, swe.MOON)
            event = {
                "event_type": "eclipse",
                "eclipse_type": eclipse_type,
                "classes": self._eclipse_classes(flags),
                "begin_at": self._jd_to_iso(begin_jd),
                "max_at": self._jd_to_iso(max_jd),
                "end_at": self._jd_to_iso(end_event_jd),
                "begin_local": self._jd_to_local_iso(begin_jd, timezone_name),
                "max_local": self._jd_to_local_iso(max_jd, timezone_name),
                "end_local": self._jd_to_local_iso(end_event_jd, timezone_name),
                "longitude": round(moon_lon, 4),
                "sign": get_zodiac_sign(moon_lon),
                "degree_in_sign": round(get_degree_in_sign(moon_lon), 4),
                "local": local,
            }
            if local:
                for key in ("begin_jd", "max_jd", "end_jd"):
                    if key in local:
                        stem = key.removesuffix("_jd")
                        local[f"{stem}_at"] = self._jd_to_iso(local[key])
                        local[f"{stem}_local"] = self._jd_to_local_iso(local[key], timezone_name)
                        del local[key]
            events.append(event)

        for eclipse_type in ("solar", "lunar"):
            cursor = start_jd - 40.0
            while True:
                if eclipse_type == "solar":
                    flags, times = swe.sol_eclipse_when_glob(cursor, swe.FLG_SWIEPH, 0, False)
                else:
                    flags, times = swe.lun_eclipse_when(cursor, swe.FLG_SWIEPH, 0, False)
                max_jd = float(times[0])
                if max_jd > end_jd + 1e-7:
                    break
                append_event(eclipse_type, flags, times)
                cursor = max_jd + 20.0

        events.sort(key=lambda item: item["max_at"])
        return {
            "period_start": start_utc.isoformat(),
            "period_end": end_utc.isoformat(),
            "timezone": timezone_name or "UTC",
            "location": {
                "name": location_name or "",
                "latitude": latitude,
                "longitude": longitude,
                "provided": has_location,
            },
            "events": events,
            "count": len(events),
        }

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
            "egress_jd": voc["egress_jd"],
            "egress_at": self._jd_to_iso(voc["egress_jd"]),
        }
        for k in ("next_aspect", "last_aspect"):
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
        start_sign = int(self._lon(jd, swe.MOON) // 30)
        lo, hi = jd, jd + max_days
        # Грубый поиск смены знака.
        step = _DAY / 24.0  # шаг 1 час
        prev = jd
        t = jd + step
        while t <= hi:
            if int(self._lon(t, swe.MOON) // 30) != start_sign:
                lo, hi = prev, t
                break
            prev = t
            t += step
        else:
            return jd + max_days
        # Бисекция границы знака.
        for _ in range(40):
            mid = 0.5 * (lo + hi)
            if int(self._lon(mid, swe.MOON) // 30) != start_sign:
                hi = mid
            else:
                lo = mid
        return 0.5 * (lo + hi)

    def _aspect_residual(self, jd: float, body: int, angle: float) -> float:
        """Знаковый остаток (Moon-other - angle), свёрнутый в [-180,180]."""
        moon = self._lon(jd, swe.MOON)
        other = self._lon(jd, body)
        return self._wrap_pm180((moon - other) - angle)

    def _last_aspect_before(self, jd: float, egress_jd: float) -> Optional[Dict]:
        """Последний точный мажорный аспект Луны до выхода из знака."""
        step = _DAY / 24.0
        best: Optional[Dict] = None
        for body_id, body_name in _VOC_BODIES.items():
            for angle in _VOC_ANGLES:
                prev_t = jd
                prev_r = self._aspect_residual(jd, body_id, angle)
                t = jd + step
                while t <= egress_jd + 1e-9:
                    r = self._aspect_residual(t, body_id, angle)
                    if prev_r == 0.0:
                        exact = prev_t
                    elif prev_r != 0.0 and (prev_r < 0) != (r < 0):
                        lo, hi = prev_t, t
                        for _ in range(40):
                            mid = 0.5 * (lo + hi)
                            rm = self._aspect_residual(mid, body_id, angle)
                            if (self._aspect_residual(lo, body_id, angle) < 0) == (rm < 0):
                                lo = mid
                            else:
                                hi = mid
                        exact = 0.5 * (lo + hi)
                    else:
                        prev_t, prev_r = t, r
                        t += step
                        continue
                    if best is None or exact > best["jd"]:
                        best = {"jd": exact, "body": body_name, "angle": angle}
                    prev_t, prev_r = t, r
                    t += step
        return best

    def void_of_course(self, jd: float) -> Dict:
        """
        Текущее состояние VOC. Луна считается «без курса», если после момента jd
        и до выхода из знака она не образует ни одного точного мажорного аспекта.
        """
        egress_jd = self._next_sign_egress_jd(jd)
        # Есть ли точный аспект в интервале (jd, egress)?
        upcoming = None
        step = _DAY / 24.0
        for body_id, body_name in _VOC_BODIES.items():
            for angle in _VOC_ANGLES:
                prev_t, prev_r = jd, self._aspect_residual(jd, body_id, angle)
                t = jd + step
                while t <= egress_jd + 1e-9:
                    r = self._aspect_residual(t, body_id, angle)
                    crossed = prev_r == 0.0 or (prev_r != 0.0 and (prev_r < 0) != (r < 0))
                    if crossed:
                        if upcoming is None or prev_t < upcoming["jd"]:
                            upcoming = {"jd": prev_t, "body": body_name, "angle": angle}
                        break
                    prev_t, prev_r = t, r
                    t += step
        is_voc = upcoming is None
        last = self._last_aspect_before(jd - 3.0, jd) if is_voc else None
        return {
            "is_void": is_voc,
            "egress_jd": egress_jd,
            "next_aspect": upcoming,   # ближайший аспект (если есть) — конец VOC впереди
            "last_aspect": last,       # аспект, с которого начался текущий VOC
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

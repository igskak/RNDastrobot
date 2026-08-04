"""
Layer-1 technical-data tools for the astro assistant (chat-v2).

Exposes the factual astrology model the assistant must be fluent in but cannot
currently query — starting with the reference facets, growing to the
chart-specific ones (dignities, houses, speeds, stations) as they land.

The load-bearing piece here is ``ChartDataset``: a lazy, per-turn, frozen +
hashed assembly of Layer-1 data. Facets are computed on FIRST access and
memoized; the set of touched facets defines a stable provenance hash D that the
trust chips and capture reference. One engine-service instance (e.g.
DignityService, which loads its ref table once) is reused for the whole turn, so
a chart-wide facet never triggers an N+1 reload.

NOTE: this module is intentionally NOT yet wired into build_tools()/dispatch —
it grows behind the existing agent so live behavior is unchanged until the facet
set is meaningful. Guarantee unchanged: every value is server-computed.
"""
from __future__ import annotations

import hashlib
import json
from typing import Callable, Dict, List, Optional
from uuid import UUID

from app.services.astro_provenance import overridable
from app.services.dignity_service import DignityService
from app.services.natal_chart_service import NatalChartService
from app.services.preferences_runtime import CANONICAL_SIGNS

# Sentinel so a real chart of None (no saved chart) is memoized, not re-fetched.
_UNSET = object()

# Facets implemented so far. Grows as chart-specific facets land; the tool-schema
# enum and the route validation both read this so they can never drift from what
# the assembler can actually produce.
CHART_DATA_FACETS = (
    "sign_properties", "dignities", "speeds", "houses",
    # Slice-1 additions: the chart is loaded whole every turn, but the model
    # could previously see 5 planet fields and zero aspects. These surface the
    # structure an analyst actually reasons over.
    "natal_aspects", "angles_and_points", "planet_roles", "house_details",
    "configurations",
)


def _event_row(event: Dict) -> Dict:
    """Flatten one survey event into analysable columns.

    Nested structures (passes, stations, the overridable house block) collapse to
    the scalars a query can filter and rank on; the full record stays available
    through the survey itself.
    """
    passes = event.get("passes") or []
    orbs = [p.get("orb") for p in passes if isinstance(p.get("orb"), (int, float))]
    closest = (event.get("closest_approach") or {}).get("orb")
    house = event.get("target_natal_house")
    return {
        "event_id": event.get("event_id"),
        "transit_body": event.get("transit_body"),
        "natal_body": event.get("natal_body"),
        "aspect_type": event.get("aspect_type"),
        "target_type": event.get("target_type"),
        "target_natal_house": house.get("effective_value") if isinstance(house, dict) else house,
        "axis_group": event.get("axis_group"),
        "enter": event.get("enter"),
        "leave": event.get("leave"),
        "exact_pass_count": event.get("exact_pass_count", len(passes)),
        "station_count": len(event.get("stations") or []),
        "min_orb": min(orbs) if orbs else (closest if isinstance(closest, (int, float)) else None),
        "duration_days": _duration_days(event.get("enter"), event.get("leave")),
    }


def _duration_days(enter, leave):
    from datetime import datetime

    def _parse(value):
        if not isinstance(value, str) or not value:
            return None
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            try:
                return datetime.fromisoformat(value[:10])
            except ValueError:
                return None

    start, end = _parse(enter), _parse(leave)
    if start is None or end is None:
        return None
    return round((end - start).total_seconds() / 86400.0, 2)


class ChartDataset:
    """Per-turn frozen Layer-1 dataset. Assemble lazily, hash what was touched.

    ┌──────────────────────────────────────────────────────────────┐
    │ facet(name)  ── first access ──►  builder(self) ──► memoized  │
    │              ── later access ──►  cached value               │
    │ provenance_hash()  = sha256 over the SORTED touched facets    │
    │ engine services (DignityService, …) built ONCE, reused        │
    └──────────────────────────────────────────────────────────────┘
    """

    def __init__(
        self,
        *,
        user_id: UUID,
        astrologer_id: Optional[UUID],
        db,
        house_system: str = "P",
    ):
        self.user_id = user_id
        self.astrologer_id = astrologer_id
        self.db = db
        self.house_system = house_system
        self._facets: Dict[str, Dict] = {}
        # Forecast data attached by the turn once a survey has run, so analyze
        # can query events and segments alongside the natal tables. Held on the
        # dataset rather than passed around so one turn analyses one consistent
        # snapshot.
        self.forecast_events: List[Dict] = []
        self.forecast_segments: List[Dict] = []
        self.forecast_findings: List[Dict] = []
        self._dignity: Optional[DignityService] = None
        self._natal_svc: Optional[NatalChartService] = None
        self._natal_chart_cache = _UNSET  # the active chart dict, fetched once/turn

    # --- lazy engine-service singletons (one per turn; avoids ref-table N+1) ---
    def _dignity_service(self) -> DignityService:
        if self._dignity is None:
            self._dignity = DignityService(
                db_session=self.db,
                astrologer_id=self.astrologer_id,
                default_house_system=self.house_system,
            )
        return self._dignity

    def _natal_service(self) -> NatalChartService:
        if self._natal_svc is None:
            self._natal_svc = NatalChartService()
        return self._natal_svc

    def _natal_chart(self) -> Optional[Dict]:
        """The active chart's saved objects (planets/houses), fetched ONCE per turn.

        Shared by every chart-specific facet (dignities/speeds/stations/houses) so
        they read one consistent snapshot. Returns None when no chart is saved.
        """
        if self._natal_chart_cache is _UNSET:
            self._natal_chart_cache = self._natal_service().get_natal_chart_from_db(
                self.user_id, self.db)
        return self._natal_chart_cache

    # --- facet assembly --------------------------------------------------------
    def facet(self, name: str) -> Dict:
        """Return the (memoized) computed data for one facet.

        Raises ValueError('bad_facet:<name>') for an unknown facet so the tool
        layer can return a machine error code instead of throwing.
        """
        if name not in _FACET_BUILDERS:
            raise ValueError(f"bad_facet:{name}")
        if name not in self._facets:
            self._facets[name] = _FACET_BUILDERS[name](self)
        return self._facets[name]

    def touched_facets(self) -> List[str]:
        return sorted(self._facets)

    # --- tabular views (for the Layer-2 analyze executor) ----------------------
    def table(self, name: str) -> List[Dict]:
        """Return an analyzable table (list of flat rows) from the frozen chart.

        Tables are the Layer-2 substrate: the analyze() executor loads one into
        in-memory SQLite. Columns are fixed per table (see ANALYSIS_TABLES in
        astro_analysis) so the SQL compiler can allowlist them. Unknown table or
        absent chart -> empty list (analysis over nothing is a clean empty).
        """
        if name == "planets":
            chart = self._natal_chart()
            rows = []
            for p in (chart or {}).get("planets") or []:
                rows.append({
                    "name": p.get("name"),
                    "sign": p.get("sign"),
                    "house": p.get("house"),
                    "dignity": p.get("dignity"),
                    "speed": p.get("speed"),
                    "retrograde": 1 if p.get("retrograde") else 0,
                })
            return rows
        if name == "natal_aspects":
            # Booleans are stored 0/1: SQLite has no bool type, and a filter of
            # {"is_major": 1} must match what the compiler binds.
            rows = []
            for a in self.facet("natal_aspects").get("aspects") or []:
                rows.append({
                    "left": a.get("left"),
                    "right": a.get("right"),
                    "aspect": a.get("aspect"),
                    "orb": a.get("orb"),
                    "is_major": 1 if a.get("is_major") else 0,
                    "harmonic_type": a.get("harmonic_type"),
                    "is_partile": 1 if a.get("is_partile") else 0,
                    "applying": 1 if a.get("applying") else 0,
                })
            return rows
        if name == "houses":
            rows = []
            for h in self.facet("house_details").get("houses") or []:
                rows.append({
                    "number": h.get("number"),
                    "sign": h.get("sign"),
                    "ruler": h.get("ruler"),
                    "group": h.get("group"),
                    "planet_count": len(h.get("planets_in_house") or []),
                })
            return rows
        if name == "configurations":
            return [
                {
                    "type": c.get("type"),
                    "apex_planet": c.get("apex_planet"),
                    "planet_count": len(c.get("planets_involved") or []),
                    "strength_score": c.get("strength_score"),
                }
                for c in self.facet("configurations").get("configurations") or []
            ]
        # Forecast tables come from the turn's survey rather than the chart, so
        # they stay empty until one has run. Empty is a clean answer here: asking
        # about transit events before surveying is a question with no data, not
        # an error.
        if name == "transit_events":
            return [_event_row(e) for e in self.forecast_events]
        if name == "time_segments":
            return [
                {
                    "start": s.get("start"), "end": s.get("end"),
                    "contact_count": s.get("contact_count"),
                    "unique_target_count": s.get("unique_target_count"),
                    "unique_body_count": s.get("unique_body_count"),
                }
                for s in self.forecast_segments
            ]
        if name == "pattern_findings":
            return [
                {
                    "finding_id": f.get("finding_id"), "type": f.get("type"),
                    "evidence_count": len(f.get("evidence_ids") or []),
                }
                for f in self.forecast_findings
            ]
        return []

    def provenance_hash(self) -> str:
        """Stable short hash over the facets actually assembled this turn.

        The hash covers only touched facets (lazy assembly, per P-1), which is
        exactly the data any cited number reconciles to. Deterministic: sorted
        keys + canonical JSON.
        """
        payload = {name: self._facets[name] for name in self.touched_facets()}
        # Include the analyzed chart content so analyze()-only turns (which read
        # the natal chart, not a facet) still reconcile to a real provenance hash.
        if self._natal_chart_cache is not _UNSET and self._natal_chart_cache is not None:
            payload["_natal"] = {
                "planets": self._natal_chart_cache.get("planets"),
                "houses": self._natal_chart_cache.get("houses"),
            }
        blob = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
        return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:12]


# ── facet builders (each takes the dataset, returns server-computed data) ──────
def _build_sign_properties(ds: ChartDataset) -> Dict:
    """Reference facet: element/mode/gender/rulers/dignities for every sign.

    Chart-independent (deterministic reference data), but resolved through the
    astrologer's dignity settings via DignityService, so co-rulers/overrides are
    honored. Proves the assembler seam before the chart-specific facets.
    """
    svc = ds._dignity_service()
    return {sign: svc.get_sign_properties(sign) for sign in CANONICAL_SIGNS}


def _build_dignities(ds: ChartDataset) -> Dict:
    """Chart-specific facet: each natal planet's sign, house, and essential dignity.

    Reads the active chart's saved objects (server-computed at chart-creation
    time). Empty/absent chart -> a clean empty result, never an error or a
    fabricated placement.
    """
    chart = ds._natal_chart()
    if not chart:
        return {"planets": []}
    planets = []
    for p in chart.get("planets") or []:
        planets.append({
            "name": p.get("name"),
            "sign": p.get("sign"),
            "house": p.get("house"),
            "dignity": p.get("dignity"),
            "retrograde": p.get("retrograde"),
        })
    return {"planets": planets}


def _build_speeds(ds: ChartDataset) -> Dict:
    """Chart-specific facet: each natal planet's speed and motion direction.

    Reads the once-per-turn snapshot; empty/absent chart -> clean empty result.
    """
    chart = ds._natal_chart()
    if not chart:
        return {"planets": []}
    planets = []
    for p in chart.get("planets") or []:
        planets.append({
            "name": p.get("name"),
            "speed": p.get("speed"),
            "retrograde": p.get("retrograde"),
            "motion": "retrograde" if p.get("retrograde") else "direct",
        })
    return {"planets": planets}


def _build_houses(ds: ChartDataset) -> Dict:
    """Chart-specific facet: house cusps, sign on cusp, ruler, group, occupants.

    Reads the once-per-turn snapshot; empty/absent chart -> clean empty result.
    """
    chart = ds._natal_chart()
    if not chart:
        return {"houses": []}
    houses = []
    for h in chart.get("houses") or []:
        houses.append({
            "number": h.get("number"),
            "sign": h.get("sign"),
            "cusp_degree": h.get("degree_in_sign_formatted"),
            "ruler": h.get("ruler_planet"),
            "group": h.get("house_group"),
            "planets_in_house": h.get("planets_in_house") or [],
        })
    return {"houses": houses}


def _build_natal_aspects(ds: ChartDataset) -> Dict:
    """Chart-specific facet: the natal aspect network.

    Already loaded with every chart (a real chart carries ~90 rows) but never
    exposed, so "which body is most-aspected" was unanswerable. Sorted by orb
    ascending: tightest first is the order an analyst scans in.
    """
    chart = ds._natal_chart()
    if not chart:
        return {"aspects": []}
    rows = []
    for a in chart.get("aspects") or []:
        rows.append({
            "left": a.get("left_planet") or a.get("planet_1"),
            "right": a.get("right_planet") or a.get("planet_2"),
            "aspect": a.get("aspect_type"),
            "orb": round(float(a["orb"]), 4) if a.get("orb") is not None else None,
            "is_major": a.get("is_major"),
            "harmonic_type": a.get("harmonic_type"),
            "is_partile": bool(a.get("is_partile")),
            "applying": a.get("applying"),
        })
    rows.sort(key=lambda r: r["orb"] if r["orb"] is not None else 99)
    return {"aspects": rows}


def _build_angles_and_points(ds: ChartDataset) -> Dict:
    """Chart-specific facet: angles (ASC/MC/IC/DSC/Vertex) and special points.

    Both are valid natal targets for transit search, but the model had no way to
    read their positions. Angles carry no house (they define the houses).
    """
    chart = ds._natal_chart()
    if not chart:
        return {"angles": [], "points": []}
    angles = [
        {
            "name": a.get("name"),
            "sign": a.get("sign"),
            "degree": a.get("degree_in_sign_formatted"),
            "longitude": round(float(a["longitude"]), 6) if a.get("longitude") is not None else None,
        }
        for a in (chart.get("angles") or {}).values()
    ]
    points = [
        {
            "name": p.get("name"),
            "sign": p.get("sign"),
            "degree": p.get("degree_in_sign_formatted"),
            "longitude": round(float(p["longitude"]), 6) if p.get("longitude") is not None else None,
            "house": p.get("house"),
        }
        for p in (chart.get("special_points") or {}).values()
    ]
    return {"angles": angles, "points": points}


def _build_planet_roles(ds: ChartDataset) -> Dict:
    """Chart-specific facet: each planet's structural role in the chart.

    House is emitted through the computed/effective override shape: an astrologer
    may treat a planet as belonging to another house for their working method,
    and the computed value must survive that (see astro_provenance.overridable).
    """
    chart = ds._natal_chart()
    if not chart:
        return {"planets": []}
    planets = []
    for p in chart.get("planets") or []:
        planets.append({
            "name": p.get("name"),
            "house": overridable("natal_house", p.get("house")),
            "ruled_houses": p.get("ruled_houses") or [],
            "special_roles": p.get("special_roles") or [],
            "is_elevated": bool(p.get("is_elevated")),
            "is_peregrine": bool(p.get("is_peregrine")),
            "sun_relation": p.get("sun_relation"),
            "strength_score": p.get("strength_score"),
        })
    return {"planets": planets}


def _build_house_details(ds: ChartDataset) -> Dict:
    """Chart-specific facet: houses with rulership detail.

    Wider than the ``houses`` facet: adds co-rulers (which carry the
    intercepted-sign rulers), the ruler's own house, significator and the
    included sign — the fields a rulership argument needs.
    """
    chart = ds._natal_chart()
    if not chart:
        return {"houses": []}
    houses = []
    for h in chart.get("houses") or []:
        houses.append({
            "number": h.get("number"),
            "sign": h.get("sign"),
            "cusp_degree": h.get("degree_in_sign_formatted"),
            "ruler": h.get("ruler_planet"),
            "co_rulers": h.get("co_rulers") or [],
            "ruler_in_house": h.get("ruler_in_house"),
            "group": h.get("house_group"),
            "significator": h.get("significator"),
            "included_sign": h.get("included_sign"),
            "planets_in_house": h.get("planets_in_house") or [],
        })
    return {"houses": houses}


def _build_configurations(ds: ChartDataset) -> Dict:
    """Chart-specific facet: detected aspect configurations (T-square, grand trine…).

    The per-configuration aspect detail is dropped: it duplicates the
    natal_aspects facet and would bloat the payload. Type, members, apex and the
    engine's strength score are what identifies a configuration.
    """
    chart = ds._natal_chart()
    if not chart:
        return {"configurations": []}
    return {
        "configurations": [
            {
                "type": c.get("type"),
                "planets_involved": c.get("planets_involved") or [],
                "apex_planet": c.get("apex_planet"),
                "strength_score": c.get("strength_score"),
            }
            for c in (chart.get("aspect_configurations") or [])
        ]
    }


_FACET_BUILDERS: Dict[str, Callable[[ChartDataset], Dict]] = {
    "sign_properties": _build_sign_properties,
    "dignities": _build_dignities,
    "speeds": _build_speeds,
    "houses": _build_houses,
    "natal_aspects": _build_natal_aspects,
    "angles_and_points": _build_angles_and_points,
    "planet_roles": _build_planet_roles,
    "house_details": _build_house_details,
    "configurations": _build_configurations,
}


def get_chart_data(dataset: ChartDataset, facet: str) -> Dict:
    """Layer-1 tool entrypoint: one facet of the frozen dataset + provenance.

    Returns a server-computed result the model narrates (never invents). On an
    unknown facet returns a machine error code, mirroring the command-validation
    discipline — it never throws into the agent loop.
    """
    try:
        data = dataset.facet(facet)
    except ValueError as e:
        return {"status": "error", "error": str(e)}
    return {
        "status": "ok",
        "facet": facet,
        "data": data,
        "provenance": {"dataset": dataset.provenance_hash()},
    }

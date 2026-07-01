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

from app.services.dignity_service import DignityService
from app.services.natal_chart_service import NatalChartService
from app.services.preferences_runtime import CANONICAL_SIGNS

# Sentinel so a real chart of None (no saved chart) is memoized, not re-fetched.
_UNSET = object()

# Facets implemented so far. Grows as chart-specific facets land; the tool-schema
# enum and the route validation both read this so they can never drift from what
# the assembler can actually produce.
CHART_DATA_FACETS = ("sign_properties", "dignities", "speeds")


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

    def provenance_hash(self) -> str:
        """Stable short hash over the facets actually assembled this turn.

        The hash covers only touched facets (lazy assembly, per P-1), which is
        exactly the data any cited number reconciles to. Deterministic: sorted
        keys + canonical JSON.
        """
        payload = {name: self._facets[name] for name in self.touched_facets()}
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


_FACET_BUILDERS: Dict[str, Callable[[ChartDataset], Dict]] = {
    "sign_properties": _build_sign_properties,
    "dignities": _build_dignities,
    "speeds": _build_speeds,
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

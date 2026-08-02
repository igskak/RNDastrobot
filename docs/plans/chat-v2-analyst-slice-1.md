# Slice 1 — Chat-v2 → Astrological Data Analyst

**Branch:** `feat/chat-v2-analyst` (from `origin/main` @ `3c10597c`)
**Source spec:** Steliara Chat v2 Final Architecture and Spec v3.0, roadmap §27
**Scope:** PR1 + PR4 + PR8 + PR2. PR3/PR5/PR6/PR7 are slice 2.
**Next migration number:** 055 (main is at 054)

---

## Context

The assistant answers atomic questions well ("when does Jupiter trine my Sun?")
and broad analytical ones badly. Production evidence, `assistant_turn_metrics`
id 167: astrologer asked "на год." with a transit layer open; the model made four
`find_aspect_passes` calls, all `transit_body=Jupiter`, and got 👎 "нет транзитов
плутона". Same gap in id 154 two days earlier.

Root cause is not the engine. Three things are missing at the interface:

1. No tool can survey many bodies at once, so the model picks one and stops.
2. The chart is loaded richly but exposed thinly — 90 natal aspects and 28
   per-planet fields sit in memory, the model sees 5 fields and zero aspects.
3. Two finished services (symbolic aspect windows, period ingresses) are wired
   only to HTTP routes, not to the assistant.

This slice fixes all three plus provenance. It does not rewrite the agent loop.

---

## Current state (verified on `3c10597c`)

| Fact | Value | Location |
|---|---|---|
| Query tools | 6 | `astro_tool_schemas.py:112-279` |
| Command tools | 11 (incl. new `add_client_note`) | `astro_tool_schemas.py:37-109` |
| Iteration cap | 5 | `astro_assistant_service.py:90` |
| Completion tokens | 300 | `astro_assistant_service.py:92` |
| Model | `gpt-5.4-mini` | `model_config.py` |
| `ANALYSIS_TABLES` | 1 table, 6 cols | `astro_analysis.py:26-28` |
| `ANALYSIS_OPS` | count, rank, extreme | `astro_analysis.py:30` |
| `CHART_DATA_FACETS` | 4 facets | `astro_data_tools.py:36` |
| Migrations | up to 054 | `app/database/migrations/` |

Assets present but unreachable by the model:

- `TransitService.find_transit_events(...)` — bulk, cached, defaults to slow
  planets. `transit_service.py:441`. **Coarse:** 6h grid, single approximate
  `t_exact`, no stations, no passes, no houses/roles. `_format_transit_event`
  at `:900-915`.
- `TransitService._scan_aspect_contacts(...)` — true root-finding, stations,
  multi-pass. `transit_service.py:1156`.
- `AspectDynamicsService.calculate(method="progression"|"direction", ...)` —
  enter/exact/leave/stations/closest_approach/series, ±3650d, step 7d/14d,
  10-min cache. `aspect_dynamics_service.py:204`.
- `PeriodIngressSummaryService.calculate_period_summary(...)` — progression and
  direction ingresses with before/exact/after times. `period_ingress_summary_service.py:81`.
- `preferences_runtime.get_methodology_hash_for_user(...)` — stable content hash.
  `preferences_runtime.py:590`. Used only by `transit_events_cache`.

Chart data loaded per turn but not exposed (`natal_chart_service.py:1291-1600`):
90 natal aspects (`planet_1, planet_2, aspect_type, orb, is_major, harmonic_type,
is_partile, applying, left_planet, right_planet, left_rank, right_rank`);
28 planet fields; 13 house fields; angles ASC/MC/IC/DSC/Vertex; special points;
`aspect_configurations` (`type, planets_involved, apex_planet, strength_score`).

---

## Locked decisions (owner, do not re-litigate)

**D1 — hybrid transit survey.** `find_transit_events` is the discovery layer.
Every pair it finds is refined through `_scan_aspect_contacts`. One bulk tool
call externally. Retrograde re-contacts aggregate into one logical event with
`passes[]`, `exact_pass_count`, stable `event_id`. The grid-based `t_exact` is
never exposed.

**D2 — versioned profiles.** New `broad_default_v1`; existing `TRANSIT_FOCUSED_*`
untouched (alerts depend on them). Targets: 10 planets, ASC/DSC/MC/IC,
TrueNorthNode, TrueSouthNode, BlackMoon. Fortune excluded. Non-angle cusps
available for house computation and manual profiles, not default aspect targets.
`outer_planets` = Uranus, Neptune, Pluto, Chiron.

**D3 — orchestration is logical stages, not 6 model calls.** Not implemented in
this slice. Only groundwork: token limits sized for the new answer format.

---

## PR1 — provenance and methodology safety

### Changes

Migration `055_add_assistant_turn_provenance.sql`:

```sql
ALTER TABLE assistant_turn_metrics
    ADD COLUMN IF NOT EXISTS methodology_hash TEXT,
    ADD COLUMN IF NOT EXISTS resolved_settings JSONB;

CREATE INDEX IF NOT EXISTS idx_assistant_metrics_methodology
    ON assistant_turn_metrics (astrologer_id, methodology_hash)
    WHERE methodology_hash IS NOT NULL;
```

- `AstroAssistantService` resolves the methodology hash once per turn (lazy,
  memoized like `_chart_dataset`) and attaches to every tool result under
  `provenance.methodology_hash` plus `provenance.resolved_settings`
  (`rulership_system`, `intercepted_sign_policy`, `orb_profile`).
- `log_turn()` persists both. Route passes them through.
- Computed/effective override schema as a shared helper in a new
  `app/services/astro_provenance.py`:

```python
def overridable(field: str, computed, effective=None, *, source=None, reason=None) -> dict:
    """{field, computed_value, effective_value, override_applied, override_type,
        override_source, override_reason}. effective=None => no override."""
```

No override *producers* exist yet — this slice lands the schema and the helper so
PR-later work cannot invent a second shape. Emitted wherever natal house/role is
reported (PR4 facets, PR2 events).

### Acceptance

1. Migration 055 applies twice with no error (idempotent).
2. Every turn writes a non-null `methodology_hash` to `assistant_turn_metrics`.
3. Changing an orb setting changes the stored hash for the next turn.
4. Every tool result contains `provenance.methodology_hash`.
5. `overridable()` with `effective=None` yields `override_applied=false` and
   `effective_value == computed_value`.

---

## PR4 — chart data exposure

### New facets (`astro_data_tools.py`)

`CHART_DATA_FACETS` gains: `natal_aspects`, `angles_and_points`, `planet_roles`,
`house_details`, `configurations`.

| Facet | Shape |
|---|---|
| `natal_aspects` | `{aspects:[{left, right, aspect, orb, is_major, harmonic_type, is_partile, applying}]}` |
| `angles_and_points` | `{angles:[{name, sign, degree, longitude}], points:[{name, sign, degree, longitude, house}]}` |
| `planet_roles` | `{planets:[{name, house(overridable), ruled_houses, special_roles, is_elevated, is_peregrine, sun_relation, strength_score}]}` |
| `house_details` | `{houses:[{number, sign, cusp_degree, ruler, co_rulers, ruler_in_house, group, significator, included_sign, planets_in_house}]}` |
| `configurations` | `{configurations:[{type, planets_involved, apex_planet, strength_score}]}` |

All read the once-per-turn `_natal_chart()` snapshot. Absent chart yields a clean
empty result, never an error. `planet_roles.house` uses `overridable()` from PR1.

### New analyze tables (`astro_analysis.py`)

```python
ANALYSIS_TABLES = {
    "planets": ("name", "sign", "house", "dignity", "speed", "retrograde"),
    "natal_aspects": ("left", "right", "aspect", "orb", "is_major",
                      "harmonic_type", "is_partile", "applying"),
    "houses": ("number", "sign", "ruler", "group", "planet_count"),
}
```

`ChartDataset.table()` gains the two new tables. `ANALYSIS_OPS` unchanged
(count/rank/extreme) — `aggregate`/`bucket_time`/`distribution` land in slice 2
with the Pattern Engine that needs them.

This makes "most-aspected body" a `count`+`group_by` away, which it is not today.

### Acceptance

6. All 9 facets return `status=ok` with provenance on a real chart.
7. `natal_aspects` facet returns the same count as the chart's aspect list.
8. `analyze {op:count, over:natal_aspects, group_by:left}` ranks bodies by
   aspect count.
9. `analyze {op:rank, over:natal_aspects, sort:orb, order:asc, limit:3}` returns
   the three tightest orbs.
10. Every new facet on a chartless user returns an empty structure, not an error.
11. No model-supplied string reaches SQL — new columns are allowlisted, values
    stay bound parameters (regression test with a `';DROP` filter value).

---

## PR8 — expose the symbolic services

### `find_symbolic_aspect_passes`

Wraps `AspectDynamicsService`. Model-facing schema:

```jsonc
{
  "method": "progression | direction",
  "source_body": "<TRANSIT_BODY_NAMES>",
  "target_body": "<NATAL_BODY_NAMES>",
  "aspect_type": "<ASPECT_TYPE_NAMES>",
  "contact_start": "YYYY-MM-DD (optional)",
  "contact_end": "YYYY-MM-DD (optional)",
  "direction_type": "solar_arc|zodiacal|symbolic|equatorial (direction only)"
}
```

Server binds `primary_context` from the auth-bound `user_id` via
`context_from_user_id()`. Returns the existing contact schema (enter,
enter_complete, leave, leave_complete, exact_pass_count, passes[], stations[],
closest_approach) plus window metadata. `series` is dropped from the model-facing
payload (hundreds of points, useless as text; kept for slice-2 charts).

### `survey_symbolic_ingresses`

Wraps `PeriodIngressSummaryService`. Input `{start_date, end_date, timezone?,
direction_type?}`. Returns rows with `{object, method, ingress_type, from, to,
times:{before, exact, after}}`.

**Risk to verify during implementation:** `PeriodIngressSummaryService` opens its
own DB session via `db_manager`. Confirm it closes it, or wrap the call so the
assistant's pool discipline holds (see invariants).

### Acceptance

12. `find_symbolic_aspect_passes(method="progression")` returns enter/exact/leave
    for a known pair (spec §25 Test 12).
13. A broad symbolic survey request returns a clear unsupported-capability
    message, not dozens of one-pair calls (spec §25 Test 13).
14. Neither tool accepts a `user_id` argument from the model.
15. Calling both tools in one turn leaves no leaked DB connection (pool count
    unchanged before/after).

---

## PR2 — `survey_transits`

### Profiles (`app/services/astro_profiles.py`, new)

```python
TRANSIT_BODY_PROFILES = {
    "outer_planets": ("Uranus", "Neptune", "Pluto", "Chiron"),
    "slow_planets":  ("Jupiter", "Saturn", "Uranus", "Neptune", "Pluto", "Chiron"),
    "all_planets":   (10 planets,),
}
NATAL_TARGET_PROFILES = {
    "broad_default_v1": (
        "Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn",
        "Uranus","Neptune","Pluto",
        "ASC","DSC","MC","IC",
        "TrueNorthNode","TrueSouthNode","BlackMoon",
    ),
}
PROFILE_VERSION = "broad_default_v1"
```

Existing `TRANSIT_FOCUSED_*` in `constants.py` untouched.

### Algorithm (D1 hybrid)

1. Resolve profiles to explicit body lists. Reject unknown profile names.
2. **Discovery:** `find_transit_events(transit_bodies, natal_bodies, aspect_types,
   start, end, timezone)` — cached, coarse. Yields candidate
   `(transit_body, natal_body, aspect_type)` triples.
3. **Refinement:** for each distinct triple, `_scan_aspect_contacts` over the
   window with the astrologer's orb. Produces true contacts with passes and
   stations.
4. **Aggregation:** one event per contact interval. `event_id = sha1(
   chart_id, transit_body, natal_body, aspect_type, enter_iso)[:12]` — stable
   across identical inputs, which the full-table and citation layers need later.
5. **Enrichment:** natal house of target, transit body's natal house
   (`overridable()`), `ruled_houses`, `axis_group` for ASC/DSC and MC/IC contacts.
6. **Summarize:** `monthly_summary` (counts per YYYY-MM), `summary` (totals,
   unique targets, unique bodies, max simultaneous count is **deferred to PR3**).

### Output

```jsonc
{
  "status": "ok",
  "survey_id": "ts_<hash>",
  "profile": {"transit": "outer_planets", "target": "broad_default_v1"},
  "requested_window": {"start": "...", "end": "..."},
  "events": [{
    "event_id": "...", "transit_body": "Pluto", "natal_body": "MC",
    "target_type": "angle", "aspect_type": "Conjunction",
    "transit_natal_house": {...overridable...},
    "target_natal_house": 10, "ruled_houses": [4, 11],
    "axis_group": "MC-IC",
    "enter": "...", "enter_complete": true,
    "leave": "...", "leave_complete": true,
    "passes": [{"date": "...", "motion": "retrograde", "orb": 0.0}],
    "exact_pass_count": 3, "stations": [...],
    "min_orb": 0.0031, "duration_days": 412,
    "calc_version": "survey_transits_v1"
  }],
  "monthly_summary": [{"month": "2027-08", "count": 7}],
  "summary": {"event_count": 24, "unique_targets": 9, "unique_bodies": 4},
  "provenance": {"methodology_hash": "...", "resolved_settings": {...}},
  "warnings": []
}
```

### Cost guard

A 2-year × 4 bodies × 17 targets × 5 aspects discovery pass is ~1M grid checks.
`find_transit_events` caches by `(user, window, tz, step, bodies, targets,
aspects, methodology_hash)`, so repeats are free. Refinement is bounded by
contacts actually found, not the combinatorial space. Add a hard cap:
`MAX_SURVEY_EVENTS = 400`; on overflow, truncate deterministically (earliest
first), set `warnings: ["truncated"]` and `truncated: true`. Never silently drop.

### Acceptance

16. "Все мажорные аспекты высших планет на два года" resolves `outer_planets` to
    Uranus/Neptune/Pluto/Chiron and issues **one** `survey_transits` call
    (spec §25 Test 2).
17. Default targets are exactly `broad_default_v1`: Fortune absent, only the four
    angles present, no non-angle cusps (spec §25 Test 2).
18. "Транзиты Урана на два года" → one bulk call, not N one-pair calls
    (spec §25 Test 3).
19. A retrograde triple contact returns ONE event with `exact_pass_count=3` and
    three entries in `passes[]` (D1).
20. No response field carries a grid-derived `t_exact` (D1).
21. Pluto conjunction IC and Pluto opposition MC are two events sharing one
    `axis_group` (spec §2.5, §25 Test 7).
22. Every event carries `methodology_hash` and `calc_version` (spec §25 Test 16).
23. Same inputs twice produce identical `event_id`s.
24. Survey exceeding 400 events sets `truncated: true` and a warning.

---

## Testing plan

| Layer | What | Count |
|---|---|---|
| Unit | `overridable()` shapes; profile resolution incl. unknown-name rejection; `event_id` stability; axis grouping; monthly bucketing; truncation | +14 |
| Unit | New facet builders on populated and empty charts | +10 |
| Unit | New analyze tables incl. SQL-injection regression | +6 |
| Integration | Each new tool end-to-end against a seeded chart | +4 |
| Integration | Hybrid survey: retrograde triple pass aggregation | +2 |
| Integration | Provenance written to `assistant_turn_metrics` | +2 |
| Acceptance | Spec §25 Tests 2, 3, 12, 13, 16 | +5 |
| Regression | Existing 163-test assistant suite stays green | 0 new |

---

## Invariants (must not break)

1. `user_id` server-bound, never a model tool argument. Same for `astrologer_id`.
2. Every number engine-computed; the model narrates only.
3. Server never executes workspace commands.
4. No model-controlled string reaches SQL — allowlisted columns, bound params.
5. Orbs from the astrologer's settings (`orb_source: astrologer_settings`).
6. DB connections released before LLM calls (`_release_db_after_tool`,
   `_commit_and_close_request_db`). This caused a production pool exhaustion once.

---

## Rollback

Per-PR revert is clean. Migration 055 is additive and nullable — rolling back the
code leaves two unused columns, no data loss, no constraint break. New tools are
additive; removing them from `build_tools()` restores prior behavior exactly.

---

## Effort

| PR | Work | Estimate |
|---|---|---|
| PR1 | migration + hash plumbing + `overridable()` + tests | ~2h |
| PR4 | 5 facets + 2 analyze tables + tests | ~3h |
| PR8 | 2 tool wrappers + session-safety check + tests | ~2h |
| PR2 | profiles + hybrid survey + enrichment + summaries + tests | ~6h |

---

## Out of scope (slice 2)

- `intersect_forecast_windows` / sweep-line (PR3)
- Pattern Discovery Engine and Structured Findings (PR5)
- Router/planner/narrative/renderer orchestration (PR6)
- Full-table dataset, CSV, timeline, heatmap, visualization planner (PR7)
- `survey_symbolic_aspects` bulk backend (PR9)
- Solar-return integration (PR10)
- Methodology version history (PR11)
- Workspace timeline (PR12)

### Known limitation to carry forward

`direction_service.py:407` applies `PROGNOSTIC_EXCLUDED_NATAL_TARGETS`, which
excludes `BlackMoon`. Symbolic surveys in PR9 need their own profile or Lilith
silently disappears, contradicting `broad_default_v1`.

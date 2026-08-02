# Chat-v2 astrology assistant — architecture brief for external review

**Purpose of this document.** We want feedback on how our chat assistant should be
adjusted so it produces the kind of data analysis a professional astrologer actually
wants. This describes exactly what the assistant is today: what it receives as input,
what it is allowed to do, which functions it can call, how those functions talk to the
mathematical engine, and where we already know it falls short.

Written for someone with no access to the codebase. Every file:line reference is real
so any claim here can be checked.

**Status:** live beta, ~5 professional astrologers, in production.
**Branch described:** `feat/chat-v2-like-dislike` (current prod behaviour).
**Date:** 2026-07-30.

> **A note on the data samples in §5.** All field names, key structures, and payload
> shapes were captured by running the real code against a real chart. The *values* have
> been replaced with synthetic ones, because the originals are a real person's birth data.
> Structure is exact; numbers are illustrative.

---

## 0. TL;DR for the reviewer

The assistant is a **function-calling LLM that is forbidden from doing astronomy and
forbidden from interpreting meaning**. It is a narrator over a deterministic ephemeris
engine. Its job: pick the right tool, pass the right arguments, and read the numbers back
in a readable format.

Three layers of guarantee:

| Layer | What it guarantees | Where |
|---|---|---|
| **Layer 1** — deterministic tools | Every number comes from the Swiss Ephemeris engine, never from the model | `astro_tool_schemas.py`, `transit_service.py` |
| **Layer 2** — analysis spec → SQL | Data-science style analysis (count/rank/extreme) is compiled to parameterized SQL over a frozen per-turn dataset, not computed by the model | `astro_analysis.py` |
| **Layer 3** — non-interpretation gate | The model may report DATA, never MEANING; enforced by prompt + LLM judge + citation rendering | `astro_boundary.py`, `astro_judge.py`, `astro_citation.py` |

**Two known gaps we most want feedback on:**

1. The assistant is excellent at *"when does Jupiter trine my Sun?"* and poor at *"what
   should I look at over the next two years?"* — nothing tells it **which bodies to
   survey** when the astrologer names none (§10.1).
2. The chart the server loads is **far richer than what the model can see**. 90 natal
   aspects and 28 fields per planet are in memory; the model gets 5 fields and **no
   aspects at all** (§5.6).

---

## 1. Product context

The user is a **professional astrologer**, working in a browser on a chart workspace
(the "forecast" page): a natal wheel plus optional prognostic layers (transits,
progressions, directions, solar return, synastry). The chat widget sits beside that
workspace.

The astrologer does the interpretation. The assistant is explicitly **not** allowed to.
It is positioned as a *computational assistant / data analyst*: it fetches, computes,
ranks, and highlights; the human assigns meaning. This is a deliberate product and
compliance boundary, not a limitation we want removed — but the exact line is something
we are still tuning (see §8 and §10.4).

---

## 2. End-to-end request flow

```
Browser (chat.js)
  │  POST /assistant/chat
  │  { user_id, timezone, anchor_date, workspace, conversation_id, messages[] }
  ▼
FastAPI route (app/api/routes/assistant.py:415 chat)
  │  auth + entitlement checks, chart-access check
  │  merge browser history with server-persisted thread history
  │  release the DB connection BEFORE any LLM work
  ▼
AstroAssistantService.chat()  (app/services/astro_assistant_service.py:1142)
  │  build system prompt + workspace context line + conversation
  │  ┌─ loop, max 5 iterations ────────────────────────────┐
  │  │ OpenAI chat.completions with tools, tool_choice=auto│
  │  │   ├─ tool_calls?  → execute → append results → loop │
  │  │   └─ no tool_calls → final answer → exit loop       │
  │  └────────────────────────────────────────────────────┘
  ▼
_finalize_reply()  (astro_assistant_service.py:1081)
  │  1. wheel-view coercion
  │  2. render structured citations (server substitutes values)
  │  3. Layer-3 judge (allow / regenerate once / refuse)
  ▼
Response { reply, tool_results[], actions[], guardrail, metric_id, metrics }
  │
  ├─ client applies `actions` to the workspace (charts change on screen)
  └─ turn is persisted to assistant_turn_metrics (full audit payload)
```

Key architectural point: **the model never touches the database or the ephemeris
directly**. It emits tool calls; the server executes them against deterministic services.

---

## 3. What the assistant receives as input

### 3.1 Request body (`ChatRequest`, `assistant.py:292-318`)

| Field | Meaning | Notes |
|---|---|---|
| `user_id` | The **active chart** (a person's natal chart) | **Server-bound.** Never a model argument. The model cannot switch charts. |
| `timezone` | Chart timezone, default for all tools | IANA, validated |
| `anchor_date` | The date currently selected in the workspace | This is "now" for the assistant's purposes |
| `conversation_id` | Thread to append to | Server merges persisted history with browser history |
| `workspace` | Compact live snapshot of what's on screen | **Advisory only** — see §3.3 and §5.5 |
| `messages[]` | Conversation, `{role, content}` | Max 40 messages, 4000 chars each |

### 3.2 The system prompt (`astro_assistant_service.py:495-581`)

Roughly 80 lines. Its substantive rules, in order:

1. **Role + hard boundary.** "You do NOT perform astronomy yourself and you NEVER invent
   dates, degrees, or counts: every number must come from a tool result."
2. **Command rules.** When the assistant may change the workspace (see §6), including
   an anti-misrouting rule ("multi-wheel mode" ≠ "add a transit layer") and the synastry
   resolution flow.
3. **Workspace grounding.** "Treat workspace resources as the astrologer's current
   workbench… Use them to resolve pronouns like 'эта карта', 'этот слой', 'то что на
   экране'. **Do not ask for data that is already present in workspace resources.**"
4. **Window selection** (`:548-553`) — the only rule about search scope:
   > 1. Preserve any explicit period or dates exactly.
   > 2. "Next/when will" means `mode=next_contact` from the active forecast date.
   > 3. A general overview with no direction or period means a symmetric window around
   >    the active forecast date: ±1 year for Moon/Sun/Mercury/Venus/Mars and ±10 years
   >    for slower bodies.

   **Note carefully:** this governs *how wide the time window is once a planet has been
   chosen*. There is **no rule about which planets to choose.** This is the root of our
   main open problem (§10.1).
5. **Faithful reporting.** Report exact-pass counts honestly (a retrograde loop can
   perfect 3 times); if a contact never perfects, say it was a close approach.
6. **Output format** — a fairly detailed spec mirroring the app's timeline hover format:
   one heading, each contact as a numbered block, `Вход` / `Точно` / `Выход` each on its
   own line, `D`/`R` motion markers, `Станция R/D` only when a station explains repeated
   passes.
7. **Language.** "Reply in the astrologer's language."
8. Appended verbatim: the **non-interpretation rules** (§8) and the **citation rule** (§9).

### 3.3 The workspace context line (`astro_assistant_service.py:584-672`)

One extra system message per turn, built from the `workspace` payload. Every field is
re-validated server-side against the command vocabularies, so client junk can neither
bloat nor poison the prompt. Full structure in §5.5.

Prefixed: *"Current workspace state (context for grounding commands; do not act unless
explicitly asked) — …"*

**Critical nuance for the reviewer.** The transit layer is a **single-moment snapshot** —
whatever is within orb *on the selected date* — not a forward scan. So `tightAspects` is
"what's in orb today," not "what matters this year." Combined with prompt rule 3 ("do not
ask for data already present in workspace resources"), this nudges the model to treat that
handful of currently-in-orb aspects as the full scope of the question. That is a large part
of why broad questions get narrow answers.

---

## 4. Query tools — what the assistant can compute

All defined in `app/services/astro_tool_schemas.py:112-279`. Enums are generated from a
single shared vocabulary module (`astro_vocab.py`) so the schema the model sees and the
server-side validation can never drift apart.

### 4.1 `find_aspect_passes` — the workhorse

```jsonc
{
  "transit_body": "<enum: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn,
                     Uranus, Neptune, Pluto, Chiron, Proserpina,
                     TrueNorthNode, TrueSouthNode, BlackMoon, WhiteMoon>",
  "natal_body":   "<enum: all planets + special points + angles (ASC/MC/IC/DSC/Vertex…)>",
  "aspect_type":  "<enum: 18 types — Conjunction, Sextile, Square, Trine, Opposition,
                     Quincunx, Semisextile, Semisquare, Sesquiquadrate, Quintile,
                     Biquintile, Decile, Tridecile, Nonagon, Binonagon, Sentagon,
                     Vigintile, Semi_Nonagon>",
  "timezone":     "IANA, optional",
  "mode":         "next_contact | window",
  "start_date":   "YYYY-MM-DD (window mode)",
  "end_date":     "YYYY-MM-DD (window mode)",
  "anchor_date":  "YYYY-MM-DD (next_contact anchor)",
  "max_expansion_days": "integer"
}
// required: transit_body, natal_body, aspect_type
```

**This is the single most important design constraint in the whole system: one call =
one (transit body × natal body × aspect type) triple.** There is no bulk or scan variant
exposed to the model. Covering "Saturn, Uranus, Neptune, Pluto against Sun, Moon, ASC,
across 4 major aspects" would be 48 separate calls — against a hard cap of 5 tool
iterations per turn (§7). Result structure in §5.2.

### 4.2 `calculate_progression` / `calculate_direction`

Secondary progressions and directions (solar arc / zodiacal / symbolic / equatorial), for
either `active_chart` or `synastry_partner`. Results are compacted before reaching the
model — see §5.4.

### 4.3 `get_chart_data` — Layer 1 facets

One facet per call, from `("sign_properties", "dignities", "speeds", "houses")`.
Payloads in §5.3.

Backed by `ChartDataset` (`astro_data_tools.py:39`): a **lazy, per-turn, frozen** assembly.
Facets are computed on first access and memoized; the natal chart is fetched exactly once
per turn; engine services are instantiated once (no N+1). A `provenance_hash()` over the
touched facets gives every answer a reconcilable fingerprint.

### 4.4 `analyze` — Layer 2, the data-science tool

The model emits a **spec, never code**:

```jsonc
{
  "op":       "count | rank | extreme",
  "over":     "planets",                 // currently the ONLY analyzable table
  "filter":   { "sign": "Leo" },         // equality only
  "group_by": "sign",                    // count op
  "sort":     "speed",                   // required for rank/extreme
  "order":    "asc | desc",
  "limit":    1-50
}
```

The server validates the spec against a fixed per-table column allowlist, loads the frozen
dataset into **in-memory SQLite**, and compiles the spec to parameterized SQL
(`astro_analysis.py:114-136`). Nothing from the model is ever interpolated into SQL as a
raw string: column/group_by/sort are allowlist-checked, filter values are bound parameters,
op/order come from fixed sets, limit is integer-coerced.

Result rows carry stable ids (`r0`, `r1`, …) which the model then **cites** rather than
retyping (§9). Payloads in §5.3.

### 4.5 `find_chart`

Name search over the astrologer's own saved charts, to resolve a person for synastry.
Scoped to the authenticated astrologer (never model-controlled). Returns candidates
`{chart_id, title, birth_date, birth_place}` for the model to disambiguate.

---

## 5. The chart data structures — what exists vs what the model sees

This section is the concrete answer to "what data does the agent actually get."

### 5.1 The full natal chart the server loads

`NatalChartService.get_natal_chart_from_db()` (`natal_chart_service.py:1256`) returns one
dict per chart. Verified top-level keys:

```
user_id, title, display_title, birth_data, planets, houses, angles, special_points,
configurations, aspects, aspect_configurations, stelliums, planet_distribution,
cosmogram_pattern, balances, karmic_analysis, declination_aspects
```

**Per-planet — 28 fields** (verified key list, synthetic values):

```jsonc
{
  "name": "Mars", "longitude": 128.2758, "sign": "Leo",
  "degree_in_sign": 8.2758, "degree_in_sign_formatted": "8°16'33\"",
  "house": 9, "retrograde": false, "speed": 0.6412,
  "element": "Fire", "mode": "Fixed", "dignity": "neutral",
  "strength_score": 4.75, "special_roles": ["chart_ruler"],
  "critical_degrees": [], "sun_relation": "free",
  "in_intercepted_sign": false, "is_elevated": true, "is_peregrine": false,
  "aspect_harmony": "mixed",
  "speed_percent": 92.4, "is_stationary": false, "stationary_type": null,
  "karmic_score": 1.5, "karmic_minus_score": 1, "karmic_plus_score": 0,
  "ruled_houses": [5, 12],
  "declination": 18.44, "out_of_bounds": false
}
```

**Per-house — 13 fields:**

```jsonc
{
  "number": 1, "longitude": 111.906, "sign": "Cancer",
  "degree_in_sign": 21.906, "degree_in_sign_formatted": "21°54'22\"",
  "ruler_planet": "Moon", "house_group": "angular",
  "ruler_in_house": 7, "planets_in_house": [], "co_rulers": [],
  "significator": null, "included_sign": null, "ruler_groups": {...}
}
```

**Natal aspects — a real chart in our DB has 90 of them**, each:

```jsonc
{
  "planet_1": "Sun", "planet_2": "Saturn", "aspect_type": "Square",
  "orb": 1.42, "is_major": true, "harmonic_type": "tense",
  "is_partile": false, "applying": true,
  "left_planet": "Sun", "right_planet": "Saturn",
  "left_rank": 1, "right_rank": 6
}
```

**Angles:** `ASC, MC, IC, DSC, Vertex` — each `{name, longitude, sign, degree_in_sign,
degree_in_sign_formatted}`.
**Special points:** `TrueNorthNode, TrueSouthNode, BlackMoon, WhiteMoon, Fortune, Vertex,
AntiVertex` — each additionally carries `house`.

### 5.2 `find_aspect_passes` result — what the model gets

Real captured shape (from production turn id 167, values as-is since they are ephemeris
facts, not personal data):

```jsonc
{
  "status": "ok",                      // | no_contact_in_window | unknown_natal_body
                                       // | unknown_aspect_type | unsupported_transit_body
  "transit_body": "Jupiter", "natal_body": "Sun", "aspect_type": "Trine",
  "exact_angle": 120.0,
  "orb_used": 1.0, "orb_source": "astrologer_settings",
  "mode": "window",
  "requested_window": { "start": "2025-05-06", "end": "2026-05-06" },
  "effective_window": { "start": "2025-05-05T23:59:59+02:00",
                        "end":   "2026-05-06T23:59:58+02:00" },
  "window_cap_reached": false,
  "boundary_complete": true,
  "calc_version": "aspect_passes_v1",
  "contacts": [
    {
      "enter": "2025-06-24T23:09:47+02:00", "enter_complete": true,
      "leave": "2025-07-03T17:38:09+02:00", "leave_complete": true,
      "exact_pass_count": 1,
      "passes":   [ { "date": "2025-06-29T08:14:35+02:00", "motion": "direct", "orb": 0.0 } ],
      "stations": [],
      "closest_approach": { "orb": 0.0783, "date": "2025-06-28T23:59:59+02:00" }
    }
  ]
}
```

Every field is machine-readable *result quality* metadata — the caller never has to trust
prose. `boundary_complete: false` means a contact was still open at the window edge;
`window_cap_reached` means the forward scan hit its cap without closing.

### 5.3 `get_chart_data` facets and `analyze` rows — what the model gets

Every facet is wrapped:
`{ "status": "ok", "facet": "<name>", "data": {…}, "provenance": { "dataset": "ce07affaa3d3" } }`

**`dignities`** — 12 planets, 5 fields each:
```jsonc
{ "planets": [ { "name": "Jupiter", "sign": "Virgo", "house": 3,
                 "dignity": "detriment", "retrograde": false } ] }
```

**`speeds`** — 12 planets, 4 fields each:
```jsonc
{ "planets": [ { "name": "Jupiter", "speed": 0.191671,
                 "retrograde": false, "motion": "direct" } ] }
```

**`houses`** — 12 houses, 6 fields each:
```jsonc
{ "houses": [ { "number": 1, "sign": "Cancer", "cusp_degree": "21°54'22\"",
                "ruler": "Moon", "group": "angular", "planets_in_house": [] } ] }
```

**`sign_properties`** — all 12 signs, resolved through the astrologer's own dignity
settings (co-rulers/overrides honored):
```jsonc
{ "Aries": { "element": "Fire", "mode": "Cardinal", "gender": "Masculine",
             "zone": "Brahma", "life_quadrant": "Childhood",
             "ruler": "Mars", "co_ruler": null,
             "exaltation": "Sun", "detriment": "Venus", "fall": "Saturn" } }
```

**The `analyze` substrate** — one table, `planets`, 6 columns
(`astro_data_tools.py:110-131`). Note `retrograde` is coerced to 0/1 for SQL:
```jsonc
{ "name": "Jupiter", "sign": "Virgo", "house": 3,
  "dignity": "detriment", "speed": 0.191671, "retrograde": 0 }
```

`analyze` results, real captured output:

```jsonc
// {"op":"count","over":"planets","group_by":"sign"}
{ "status": "ok", "op": "count", "over": "planets",
  "rows": [ {"bucket":"Virgo","n":3,"id":"r0"}, {"bucket":"Libra","n":3,"id":"r1"},
            {"bucket":"Scorpio","n":2,"id":"r2"} ],
  "provenance": { "dataset": "ce07affaa3d3" } }

// {"op":"rank","over":"planets","sort":"speed","order":"desc","limit":3}
{ "status": "ok", "op": "rank", "over": "planets",
  "rows": [ {"name":"Moon","sign":"Capricorn","house":7,"dignity":"detriment",
             "speed":14.037977,"retrograde":0,"id":"r0"} ],
  "provenance": { "dataset": "ce07affaa3d3" } }
```

The `id` on each row is the citation handle (§9).

### 5.4 Progression / direction results — what the model gets

Compacted before reaching the model (`astro_assistant_service.py:884-946`): aspects sorted
by orb ascending, **capped at 30 aspects, 24 objects, 12 ingresses**, with an explicit
`truncated` counter so the model knows data was cut.

```jsonc
{
  "status": "ok", "chart_ref": "active_chart",
  "progression_info": {...}, "birth_data": {...},
  "progressed_planets": [ { "name": "Sun", "sign": "Sagittarius",
                            "degree": "3°12'40\"", "longitude": 243.2111,
                            "house": 5, "retrograde": false } ],
  "aspects_to_natal":  [ { "left": "Sun", "right": "Venus",
                           "aspect": "Conjunction", "orb": 0.412 } ],
  "planet_ingresses":  [ { "body": "Mercury", "type": "sign",
                           "from": "Scorpio", "to": "Sagittarius",
                           "from_degree": "29°58'02\"", "to_degree": "0°01'12\"" } ],
  "truncated": { "aspects": 0, "progressed_planets": 0 }
}
```

`calculate_direction` is the same shape with `directed_objects` /
`direction_info`, plus `house_cusp_ingresses`.

### 5.5 The workspace payload — client → server

Built by `chat.js:879 buildWorkspaceSummary()` from the live page state:

```jsonc
{
  "wheelView": "multi",            // multi | single
  "houseSystem": "P",
  "date": "2025-05-06",            // selected transit date
  "solarYear": 2026,
  "layers": ["transit"],           // active layer methods
  "synastry": { "active": true, "mode": "db", "partnerName": "…",
                "partnerId": "<uuid>", "date": "…", "time": "…",
                "timezone": "…", "place": "…", "latitude": 0, "longitude": 0,
                "houseSystem": "P", "zodiac": "tropical",
                "aspectCount": 42,
                "tightInterAspects": [ { "primary":"Venus", "aspect":"Trine",
                                         "partner":"Mars", "orb":0.31 } ] },
  "resources": {
    "activeChart": { "chartId": "<uuid>", "source": "saved", "title": "…",
                     "date": "1987-11-14", "time": "19:45:00",
                     "timezone": "Europe/Berlin", "place": "Berlin",
                     "latitude": 52.52437, "longitude": 13.41053,
                     "houseSystem": "P", "zodiac": "tropical", "ayanamsha": null,
                     "planetCount": 12, "aspectCount": 90 },
    "selectedLayerId": "transit-3",
    "selectedMethod": "transit",
    "layers": [
      { "id": "transit-3", "method": "transit", "selected": true, "ready": true,
        "label": "Транзиты", "meta": "06.05.2025 · 19:45:46 · GMT+2",
        "config": { "date": "2025-05-06", "time": "19:45:46",
                    "timezone": "Europe/Berlin",
                    "location": { "name": "Берлин", "latitude": 52.52437,
                                  "longitude": 13.41053 } },
        "result": {
          "aspectCount": 57, "bodyCount": 17,
          "tightAspects": [ { "primary":"Jupiter", "aspect":"Trine",
                              "target":"Sun", "orb":0.08, "phase":"applying" } ],
          "keyBodies":    [ { "name":"Sun", "sign":"Taurus", "degree":"16°26'41\"",
                              "longitude":46.445, "house":7, "retrograde":false } ],
          "target": {...}
        } }
    ]
  }
}
```

**Two truncation stages, worth noting:**

| Stage | tightAspects | keyBodies | Where |
|---|---|---|---|
| Client builds | 8 | 12 | `forecast-new.js:4605`, `:4628` |
| Server renders into prompt | **5** | **6** | `astro_assistant_service.py:305`, `:325` |

So the model sees at most **5 tight aspects and 6 bodies** per layer, flattened to a text
line like:

```
workspace layers resource selected=transit-3: [transit, id=transit-3, selected, ready,
date=2025-05-06 19:45:46, tz=Europe/Berlin, place=Берлин, aspects=57, bodies=17,
tight=Jupiter Trine Sun orb 0.08 applying; …, bodies=Sun 16°26'41" H7; …]
```

### 5.6 What exists vs what reaches the model

This table is the heart of our concern.

| Data | In the loaded chart | Reachable by the model |
|---|---|---|
| Planet name, sign, house | ✅ | ✅ (`dignities`, `analyze`) |
| Planet dignity | ✅ | ✅ |
| Planet speed, retrograde | ✅ | ✅ (`speeds`, `analyze`) |
| Planet `strength_score` | ✅ | ❌ |
| `is_stationary`, `stationary_type`, `speed_percent` | ✅ | ❌ |
| `declination`, `out_of_bounds` | ✅ | ❌ |
| `special_roles`, `ruled_houses`, `is_elevated`, `is_peregrine` | ✅ | ❌ |
| `critical_degrees`, `sun_relation`, `aspect_harmony` | ✅ | ❌ |
| Karmic scores | ✅ | ❌ |
| **Natal aspects (90 rows: orb, is_major, harmonic_type, is_partile, applying)** | ✅ | ❌ **none at all** |
| Aspect configurations, stelliums | ✅ | ❌ |
| Planet distribution, cosmogram pattern, balances | ✅ | ❌ |
| Declination aspects | ✅ | ❌ |
| House cusps, ruler, group, occupants | ✅ | ✅ (`houses`) |
| House `co_rulers`, `significator`, `ruler_in_house` | ✅ | ❌ |
| Angles (ASC/MC/IC/DSC/Vertex) | ✅ | ❌ as a facet (usable as `natal_body` in transit search) |
| Special points | ✅ | ❌ as a facet (usable as `natal_body`) |

The chart dict is already fully assembled in memory when `get_chart_data` runs. Exposing
more of it is a question of surface design, not of computation cost.

---

## 6. Command tools — what the assistant can *do* to the workspace

Ten commands (`astro_tool_schemas.py:37-109`). **The server never executes them.**
Workspace state lives in the browser; the server validates the model's intent, returns a
structured `action` in the response, and the client applies it
(`astro_commands.py:137-156`).

| Command | Effect | Confirmation |
|---|---|---|
| `set_transit_date` | Set date on the selected layer | auto (toast + undo) |
| `step_date` | Move date ±N units (second…year) | auto |
| `add_layer` | Add transit/progression/direction/solar_return/synastry_partner | auto |
| `build_solar` / `set_solar_year` | Solar return for a year (1900-2100) | auto |
| `set_wheel_view` | multi (natal + rings) vs single | auto |
| `set_house_system` | 12 Swiss Ephemeris codes | auto |
| `set_synastry_partner` | By saved `chart_id`, or by manual birth data | auto |
| `remove_layer` / `clear_layers` | Destructive | **confirm chip required** |

A guard rewrites misrouted display-mode intents: if the astrologer said "многослойный
режим" (multi-wheel *display mode*) and the model tried to `add_layer`, the server drops
the layer action and substitutes `set_wheel_view`
(`astro_assistant_service.py:198-220`).

---

## 7. The agent loop and its cost controls

`astro_assistant_service.py:1142-1268`. Hard limits, deliberately not tunable knobs:

| Control | Value | Why |
|---|---|---|
| `MAX_TOOL_ITERATIONS` | **5** | Cost ceiling per turn |
| `MAX_COMPLETION_TOKENS` | **300** | Cost ceiling per completion |
| `REQUEST_TIMEOUT_S` | 60 | |
| `verbosity` | `"low"` | |
| Model | `gpt-5.4-mini` (env `OPENAI_ASSISTANT_MODEL`) | `model_config.py` |
| Judge model | `gpt-5.4-mini` (env `OPENAI_JUDGE_MODEL`) | |

Each iteration may contain multiple parallel tool calls, but the loop body runs at most 5
times. On hitting the cap, one final completion is requested **with no tools** and the
model is expected to summarize what it completed plus the next remaining step.

The DB connection is **committed and closed after each tool execution**
(`_release_db_after_tool`, `:1014`) and the request connection is released *before* any
LLM work (`_commit_and_close_request_db`, `:338`). This was a production incident fix:
long tool loops holding pooled Supabase connections exhausted the pool.

Interaction worth flagging: **300 completion tokens is tight for the verbose output format
the prompt demands** (numbered contact blocks, entry/exact/exit each on its own line). For
a multi-planet survey it is nowhere near enough.

---

## 8. Layer 3 — the non-interpretation boundary

Single source of truth: `app/services/astro_boundary.py:16-39`, injected **verbatim** into
both the system prompt and the judge prompt so they cannot drift.

**Forbidden:** assigning meaning to any astrological object; associating factors with life
domains, events, personality, emotions, relationships, career, finances, health;
predicting events; inferring psychological traits; introducing concepts not present in the
data.

**Required:** report observations, calculations, comparisons, rankings, frequencies,
similarities, differences, objective summaries.

**Explicitly ALLOWED (this clause was added after beta feedback):**

> You MAY, and SHOULD when asked, identify and RANK which data elements are notable by
> OBJECTIVE measures — exactness/orb, count, frequency, rarity, clustering, most- or
> least-aspected, tightest/widest — and suggest which data points the astrologer may want
> to examine. This data-level analysis and highlighting is NOT interpretation and must NOT
> be refused; only saying what an element MEANS for a person or life area is forbidden.

Enforcement pipeline (`_finalize_reply`, `astro_assistant_service.py:1081-1140`):

1. **Wheel-view coercion** — display-mode intent short-circuits, own text, unjudged.
2. **Citation rendering** — server substitutes `{{r0.speed}}` tokens with real values.
   An *unresolved* token when analyze rows exist = a fabricated citation → refuse
   (`guardrail: blocked_citation`). When no analyze rows exist this turn, a stray token is
   just a formatting slip → strip and serve (this rule was added after a false-block bug
   in beta).
3. **LLM judge** (`astro_judge.py`) — strict binary ALLOW/BLOCK classifier, "when in doubt,
   BLOCK", with worked examples on both sides. On BLOCK: **one** regeneration nudged to
   data-only, re-rendered and re-judged; if it still fails, a canned refusal in the
   astrologer's language. If the judge is *unavailable*: fail-closed **soft** — a
   deterministic keyword heuristic screens the reply; clean → serve with
   `guardrail: degraded`.

Every turn records its outcome: `ok | regenerated | degraded | regenerated_degraded |
blocked | blocked_degraded | blocked_citation`.

**Known tension.** Even with the explicit "ranking and highlighting is allowed" clause,
the assistant still over-refuses on data-analyst framings. A real beta transcript:

> **Astrologer:** "Let's work as a Data Analyst. Show me the key important events I'll take
> into interpretation for the next two years."
> **Assistant:** "I don't interpret the meaning of configurations. I can only give data and
> calculations — tell me which figures to show."
> **Astrologer:** "That's right, I'm *not* asking you to interpret. I'm asking you to
> analyze which significant chart elements I should take so that I can interpret them
> myself."
> **Assistant:** *(offers a menu: exact contacts, repeat passes, stations, progressions,
> directions, most/least frequent contacts)* "Shall I start with slow-planet transits for
> 2026-07-02 → 2028-07-02?"
> **Astrologer:** "Let's go."
> **Assistant:** "I don't interpret the meaning of configurations…" *(refuses again, having
> just proposed the exact thing)*

That last refusal is the failure we most want fixed: the word "analyze" plus a two-year
horizon trips the boundary even when the request is purely data-level, and the assistant
loses its own proposal across a turn.

---

## 9. Structured citation (quote-by-reference)

`app/services/astro_citation.py`. For Layer-2 numbers the model does **not retype values**;
it writes `{{r0.speed}}` and the server substitutes the actual value from that turn's
results. This makes "no invented numbers" *structural* rather than merely instructed, and
an unresolved reference is a caught fabrication.

Scope is deliberately narrow: **only `analyze()` result rows are citable.** Numbers from
`find_aspect_passes` (dates, orbs), progressions, directions, and `get_chart_data` are
stated directly as plain text — they are not citable, because they aren't row-shaped.

---

## 10. Where it falls short — the questions we want feedback on

### 10.1 No rule for *which bodies* to survey (highest priority)

Real production failure, `assistant_turn_metrics` id 167:

- Workspace: a transit layer for 2025-05-06, Berlin. On that single date, essentially one
  aspect was tight — Jupiter trine Sun.
- Astrologer typed: **"на год."** ("for a year.")
- The model made **4 tool calls, all `transit_body: "Jupiter"`** — Conjunction, Square,
  Opposition, Trine to natal Sun — and answered with the Jupiter trine.
- Astrologer's feedback: 👎 **"нет транзитов плутона"** ("no Pluto transits").

Diagnosis: the prompt tells the model how wide a window to use *after* a body is chosen,
but never tells it to fan out across bodies when the astrologer names none. The workspace
snapshot offered exactly one aspect, and prompt rule 3 says don't ask for data already
present. Pluto is not blocked anywhere — the enum includes it, the engine handles it — the
model simply was never told to look.

Same gap, earlier turn (id 154): a two-year overview request produced only Jupiter and
Saturn; the astrologer had to explicitly ask *"а что насчёт Урана, Плутона, Нептуна?"* to
get outer planets. That feedback was captured but never turned into a prompt or tool change.

We already have the right vocabulary elsewhere in the codebase, unused by the assistant
(`app/utils/constants.py:76-84`):

```python
TRANSIT_FOCUSED_BODIES = frozenset({'Pluto','Neptune','Uranus','Chiron','Saturn','Jupiter'})
TRANSIT_FOCUSED_NATAL_TARGETS = frozenset({
    'Sun','Moon','Mercury','Venus','Mars',        # personal
    'Jupiter','Saturn',                            # social
    'TrueNorthNode','TrueSouthNode','BlackMoon',  # nodes + Lilith
})
```

These feed a bulk engine method, `TransitService.find_transit_events(user_id, start_date,
end_date, timezone, step_hours=6, transit_bodies=None, natal_bodies=None,
aspect_types=None, use_cache=True)` (`transit_service.py:441`), which defaults to exactly
this slow-planet survey, returns `t_enter / t_exact / t_leave` per event, and is
**cached** — **but it is wired only to the alerts/timeline feature, never exposed to the
chat assistant.**

*Questions:* What is the right default survey set for a vague forecast request? Should the
assistant survey and then narrow, or ask one clarifying question first? Should the default
depend on window length (a 1-year question vs a 10-year question)?

### 10.2 Tool granularity vs the iteration cap

One call per (transit × natal × aspect) triple, 5 iterations per turn. A proper slow-planet
survey is dozens of combinations. Options we see:

- **(a)** Expose a bulk tool wrapping `find_transit_events` — one call covers the whole
  survey, results ranked by orb/exactness. Already cached, already has the right defaults.
- **(b)** Let `find_aspect_passes` accept arrays for `transit_body` / `natal_body` /
  `aspect_type`.
- **(c)** Keep single-pair calls, raise the iteration cap, and instruct fan-out.

Each trades cost, latency, and result-payload size differently. Payload size matters: the
model has a 300-token completion budget and the prompt demands a verbose per-contact
format, so a 40-contact survey cannot be rendered in the current output style — the
*presentation* rules would have to change too (ranked summary first, detail on request).

### 10.3 The `analyze` layer is too thin — and blind to aspects

One table (`planets`), six columns, three ops (`count`/`rank`/`extreme`), equality filters
only. The questions astrologers actually ask — tightest orbs, most-aspected body, busiest
time window, clustering, rarity — need at minimum an **aspects** table and a
**transit-events** table, plus range filters (not just equality) and probably a
date-bucketing op.

As §5.6 shows, **the natal aspects are already loaded** — 90 rows with `orb`, `is_major`,
`harmonic_type`, `is_partile`, `applying` — and simply never surfaced. "Which planet is
most-aspected?" is one `GROUP BY` away from being answerable, and today it cannot be
expressed at all.

The `analyze` design (spec → allowlisted SQL → cited rows) is the part we are most
confident in and would like to extend rather than replace. What tables, columns, and ops
would make it genuinely useful for this domain?

### 10.4 Boundary over-refusal on analyst framings

See the transcript in §8. The rubric already permits objective ranking and highlighting,
but the judge is tuned strict ("when in doubt, BLOCK") and the word "analyze" near a
forecast horizon still trips it. We want the line to sit precisely at *"what does this mean
for this person"* — everything short of that should pass.

### 10.5 Workspace snapshot is a moment, not a period

`tightAspects` reflects what is in orb on the selected date, truncated to 5 by the time it
reaches the model (§5.5). For any question about a period, that framing is actively
misleading. Should the workspace context carry a forward-looking summary instead — or
should broad questions ignore the snapshot entirely?

### 10.6 Output format is tuned for one aspect pair

The format spec (numbered contact blocks, `Вход`/`Точно`/`Выход` on separate lines,
stations) is excellent for a single pair and unusable for a 40-contact survey. A survey
answer probably needs: ranked summary first (what's notable and why, by objective measure),
then drill-down on request.

---

## 11. Observability — what we can measure

Every turn is persisted to `assistant_turn_metrics` (`assistant_log_service.py`,
migrations 049/050) with a full audit payload:

| Column | Content |
|---|---|
| `model`, `iterations`, `model_calls`, `latency_ms` | Cost + latency |
| `prompt_tokens`, `completion_tokens`, `total_tokens` | Token spend per turn |
| `max_iterations_reached` | Whether the 5-iteration cap was hit |
| `guardrail` | Layer-3 outcome for the turn |
| `tool_results` (JSONB) | **Every tool call: name, arguments, full result** |
| `workspace_manifest` (JSONB) | Frozen workspace state for that turn |
| `correction_flag`, `correction_note` | Astrologer's free-text correction |
| `feedback` | `'like'` / `'dislike'` / null |

This is how the Jupiter/Pluto diagnosis above was made — the exact tool calls the model
chose are replayable. Any recommendation that can be evaluated against captured turns is
especially valuable to us.

Conversation transcripts live in `assistant_messages` (role, content, timestamp).

---

## 12. Security and correctness invariants (please don't propose breaking these)

1. **The active chart's `user_id` is server-bound.** It is never a model-controlled tool
   argument, so the model cannot read another person's chart. Same for `astrologer_id` in
   `find_chart`.
2. **Every number is engine-computed.** The model narrates; it never calculates.
3. **The server never executes workspace commands** — it validates intent and returns an
   action; the browser applies it, with confirmation required for destructive ones.
4. **No model-controlled string ever reaches SQL.** Allowlisted columns, bound parameters.
5. **Orbs come from the astrologer's own configured settings** (`orb_source:
   "astrologer_settings"`), not from the model, not from a hardcoded default when settings
   exist.
6. **DB connections are released before LLM calls** (production pool-exhaustion fix).

---

## 13. Reference — engine parameters

From `transit_service.py:942-962`:

**Forward-scan caps for `next_contact` auto-expansion (days):**
Moon 45 · Sun 420 · Mercury 420 · Venus 540 · Mars 900 · Jupiter 650 · Saturn 1150 ·
Chiron 1900 · Uranus 1650 · Neptune 2300 · Pluto 2700 · Proserpina 4000 · default 1150

**Scan step (days):** Moon 1/24 · Sun/Mercury/Venus 0.25 · Mars 0.5 · everything else 1.0
Hard guard: 60 000 samples max per scan.

**Orbs:** resolved per (body_a, body_b, aspect_type) through the astrologer's account
methodology with `orb_profile='prognostic'`; fallback `PROGNOSTIC_DEFAULT_ORB = 1.0°`.
Exact-aspect threshold in prognostics: `PROGNOSTIC_EXACT_ORB = 0.25°` (±15 arcmin).
Moon in progressions: 3.0°.

**Contact detection:** a contact is a maximal interval where the unsigned orb deviation
stays within `max_orb`. Aspects other than conjunction/opposition are scanned on **both
sides** (transit ahead of and behind natal). Exact passes are roots found within the
interval; stations are detected via speed sign changes
(`_scan_aspect_contacts`, `transit_service.py:1156`).

**Bodies available:** Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune,
Pluto, Chiron, Proserpina, plus TrueNorthNode, TrueSouthNode, BlackMoon (Lilith),
WhiteMoon (Selena). Natal targets additionally include angles (ASC, MC, IC, DSC, Vertex,
AntiVertex) and Fortune.

**Excluded as prognostic natal targets** (`constants.py:63-65`):
Fortune, Vertex, AntiVertex, WhiteMoon, BlackMoon.

---

## 14. Summary of what we're asking

1. What should the assistant do by default when the astrologer asks a **broad, undirected**
   forecast question? (§10.1)
2. What is the right **tool shape** for multi-body surveys given a hard iteration cap? (§10.2)
3. What **tables, columns, and operations** would make the `analyze` layer genuinely useful
   — starting with the natal aspects that are already loaded but never exposed? (§10.3, §5.6)
4. Which of the **28 per-planet fields** we compute but hide (strength_score, stationary
   state, declination/out-of-bounds, special roles) are worth surfacing to a data-analyst
   assistant? (§5.6)
5. How should we **express the interpretation boundary** so objective analysis passes
   reliably while meaning-assignment still fails? (§10.4)
6. How should broad answers be **presented** when a survey returns dozens of contacts? (§10.6)

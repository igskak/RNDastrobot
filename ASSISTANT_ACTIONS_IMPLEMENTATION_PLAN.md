# Astrologer Assistant — Actions (Workspace Control) Implementation Plan

Base: `main` | Date: 2026-06-27 | Builds on `ASSISTANT_IMPLEMENTATION_PLAN.md`

## Goal

Extend the existing astrologer chat companion from a **read-only data analyst**
into one that can also **drive the chart workspace by natural language / voice**:
"добавь слой транзитов на 14 марта", "построй соляр на 2027", "сделай синастрию
с Алёной", "покажи одиночную карту". Primary payoff is **mobile**: speaking a
command is faster than tapping through nested steppers / popovers / add-layer menus.

The LLM never mutates state directly. It translates language into a **structured,
enum/ID-validated action intent**; deterministic client code applies it against the
live workspace `state` by calling functions that already exist. This mirrors the
locked principle of the read engine ("LLM never does astronomy") — now:
**"LLM never mutates state — it only emits a validated intent; the client applies it."**

## Locked decisions (from user, 2026-06-27)

1. **Confirmation policy:** reversible/cheap actions auto-apply with a toast + one-tap
   Undo; destructive/expensive actions require an inline confirm chip. (No blanket
   confirm-everything — speed is the point.)
2. **Voice:** push-to-talk only (reuse existing `/assistant/transcribe` → composer).
   No realtime/TTS.
3. **Placement:** same corner-dock chat widget (`chat.js`); no new full-screen surface yet.

## Core architectural decision — where actions execute

The "workspace" is a browser-side in-memory object: `state` in
`app/frontend/js/forecast-new.js` (an IIFE), persisted to localStorage. **The server
holds no representation of the live workspace.** Therefore:

- **Query tools** execute on the **server** (as today) and return data the agent narrates.
- **Command tools** execute on the **client**. The server does NOT compute them — it
  validates the args against shared enums, returns a synthetic receipt into the
  function-calling loop (so the model can confirm in words), and surfaces the intent in
  a new `actions[]` field on the response. The browser applies each action via a narrow
  command facade.

```
VOICE / TEXT
   │  push-to-talk → POST /assistant/transcribe → composer   (exists)
   ▼
POST /assistant/chat ──► OpenAI function-calling loop          (exists)
   │
   ├─ QUERY tool (find_aspect_passes, find_person, …)
   │     server COMPUTES → data → agent narrates
   │
   └─ COMMAND tool (set_transit_date, add_layer, build_solar, …)
         server does NOT execute: validates args by enum/ID,
         returns receipt {status:"applied_clientside"} into the loop,
         agent confirms in words,
         intent rides along:  actions:[{name,args,confirm,reversible}]
   ▼
response = { reply, tool_results, actions[] }   ← tool_results channel already exists
   ▼
chat.js applies each action → window.ForecastCommands.*   (new facade)
   ▼
forecast-new.js: activateLayer / applySolarYear / … → loadActiveLayers() → re-render
   ▼
client reports outcome (✓/✗) back into chat + refreshes the workspace snapshot
   that is fed as context to the next turn (so "а теперь на месяц вперёд" knows the date)
```

`actions[]` is the write-sibling of the existing `tool_results` field on
`ChatResponse` (`app/api/routes/assistant.py`) — the "structured data rides next to the
reply text" plumbing already exists; today `chat.js` simply ignores `tool_results`.

## Two-class tool model

| | Query tool (exists) | Command tool (new) |
|---|---|---|
| Executes | server (`_dispatch`) | client (`ForecastCommands`) |
| Loop result | real data | `{status:"applied_clientside"}` receipt |
| Side effect | none | mutates `state`, re-renders |
| Auto-run safe | always | per-action policy (see registry) |
| LLM role | pick tool + narrate numbers | pick command + confirm in words |

System-prompt contract (new): **queries never mutate the screen; only explicit
command verbs ("поставь", "добавь", "построй", "убери", "покажи") mutate.** This
resolves the central product risk (a plain question silently rebuilding the chart).

## Reuse map (what already exists — do NOT rebuild)

| Capability | Location | Use |
|---|---|---|
| Function-calling agent loop, cost caps, usage metrics | `astro_assistant_service.py` (`chat`, `build_tools`, `_dispatch`, `MAX_TOOL_ITERATIONS=5`) | add command tool-class |
| Chat endpoint, `ensure_client_access`, server-bound `user_id`, `tool_results` field | `api/routes/assistant.py` | add `actions[]` to response |
| Corner-dock chat widget, push-to-talk, history, active-chart context | `app/frontend/js/chat.js`, `window.getAssistantChartContext` | apply `actions[]` |
| Add/remove a layer instance | `activateLayer(method,{openConfig})`, `deactivateMethod(method)`, `removeLayerInstance(id)` | facade targets |
| Set transit/prog/dir moment + reload | `applyDisplayedMomentDateTime(value)`, `setSelectedDateTime`, `commitSelectedLayerEdit`, `loadActiveLayers` | facade targets |
| Solar return | `applySolarYear(year)`, solar location setters | facade targets |
| Synastry partner from a saved chart | `applySavedSynastryPartnerChart(chart)`, `setSynastryMode` | facade target |
| Wheel view / house system | `setWheelView(view)`, `updateHouseSystem(system)` | facade targets |
| Layer vocabulary (single source) | `LAYER_ORDER = ['transit','progression','direction','solar_return','synastry_partner']` | command enum source |
| **Fuzzy person search, already scoped to the astrologer, already audited** | `GET /persons?q=` → `list_persons` (`api/routes/persons.py`) | `find_person` grounding |
| Undo affordance precedent (snapshot + 8s toast slot + disabled-state button) | `announceUndo`, `state.layoutUndo`, `state._undoTimer`, `syncUndoButton` | generalize to command undo |
| i18n catalogs | `app/frontend/locales/*`, `window.FrontendI18n` | all user-facing strings |
| Turn persistence + cost/latency | `assistant_log_service.log_turn` | extend to log applied actions |

## Command facade (the missing bridge)

`forecast-new.js` functions are closures inside one IIFE; only
`window.getAssistantChartContext` is exported today. Add a **narrow, curated facade**
at the end of the IIFE — not raw functions:

```js
window.ForecastCommands = {
  setTransitDate({date, time, layerId}),     // applyDisplayedMomentDateTime
  stepDate({amount, unit, direction}),        // stepper
  addLayer({method, config}),                 // activateLayer (+ apply config)
  removeLayer({method, layerId}),             // deactivateMethod / removeLayerInstance
  buildSolar({year, location}),               // activateLayer('solar_return') + applySolarYear
  setSolarYear({year}),                       // applySolarYear
  setSynastryPartner({personId}),             // applySavedSynastryPartnerChart
  setWheelView({view}),                       // setWheelView
  setHouseSystem({system}),                   // updateHouseSystem
  clearLayers(),                              // reset to natal-only (destructive)
  undo(),                                     // pop inverse off the command undo stack
  describeState(),                            // {activeLayers, selectedLayerId, date, view, houseSystem}
  apply(action),                              // validate → dispatch → toast/undo → return {ok,error}
};
```

Why a facade, not direct calls:
- **Stable contract** — chat does not reach into internals; the same facade can later
  drive a keyboard command palette or `?cmd=` deep link.
- **Single source of truth for enums** — agent command schemas are generated from the
  same registry, exactly as read-tool enums are generated from `PLANETS`/`LAYER_ORDER`.
- **One place** for validation, toasts, the undo stack, and telemetry.

## Action registry & confirmation policy

One declarative entry per command: `{ name, args (enum/ID), apply, inverse,
confirm: 'auto'|'confirm', describe }`. The agent's tool schemas are generated from it.

| Command | Args | Maps to | Policy | Tier |
|---|---|---|---|---|
| `set_transit_date` | `date`, `time?`, `layer_id?` | `applyDisplayedMomentDateTime` | auto + undo | 1 |
| `step_date` | `amount`, `unit`, `direction` | stepper | auto + undo | 1 |
| `add_layer` | `method ∈ LAYER_ORDER`, `config?` | `activateLayer` | auto + undo | 1 |
| `build_solar` | `year`, `location?` | `activateLayer('solar_return')`+`applySolarYear` | auto + undo | 1 |
| `set_solar_year` | `year` | `applySolarYear` | auto + undo | 1 |
| `set_wheel_view` | `view ∈ {multi,single}` | `setWheelView` | auto + undo | 1 |
| `set_house_system` | `system` | `updateHouseSystem` | auto + undo | 1 |
| `remove_layer` | `method` \| `layer_id` | `deactivateMethod`/`removeLayerInstance` | **confirm** | 1 |
| `clear_layers` | — | reset to natal-only | **confirm** | 1 |
| `set_synastry_partner` | `person_id` | `applySavedSynastryPartnerChart` | auto (new) / **confirm** (replace) | 2 |

"auto + undo" = apply immediately, show a toast `✓ Транзиты · 14 мар 2026`, push the
inverse onto the undo stack, "отмени"/Undo button restores. "confirm" = render an inline
chip; nothing mutates until tapped.

## New components

**Backend**
- `astro_assistant_service.py`: a `COMMAND_TOOLS` registry → generates command schemas in
  `build_tools()`; `_dispatch` returns a `{status:"applied_clientside"}` receipt for
  command tools and collects them into `actions[]`; updated system prompt (query-vs-command
  contract); `find_person` query tool wrapping `list_persons` (astrologer-scoped).
- `api/routes/assistant.py`: add `actions: List[dict]` to `ChatResponse`; validate command
  args against the shared vocabularies; no exception-text leakage; extend `log_turn` to
  record applied action names (audit).

**Frontend**
- `forecast-new.js`: `window.ForecastCommands` facade + action registry (apply + inverse),
  generalized command undo stack (reuse the `announceUndo`/`layoutUndo` pattern),
  `describeState()` snapshot.
- `chat.js`: read `actions[]`; auto-apply or render confirm chip per policy; toast + Undo;
  report each outcome back into the thread; inject `describeState()` into the next turn's
  context alongside `anchor_date`.
- i18n catalogs: command confirmations, toasts, undo, disambiguation, errors, suggestion chips.

## PR breakdown (contract → data → logic → UI → tests)

1. **PR1 — Command facade + action registry (client only).** `window.ForecastCommands`,
   Tier-1 commands, validation, toast + generalized undo stack, `describeState()`. No agent
   yet — drivable from console / future palette (standalone value). jsdom unit tests
   (alongside existing `forecast-new-*.test.js`): each command's apply + inverse + enum
   rejection.
2. **PR2 — Command tool-class in the agent.** `COMMAND_TOOLS` registry → `build_tools()`;
   `actions[]` on `ChatResponse`; server validates args, returns receipts, never executes;
   system-prompt query-vs-command contract. Tests: a command prompt yields a validated
   `actions[]` and no server mutation; an out-of-enum arg is rejected.
3. **PR3 — Wire chat.js to apply actions.** Auto-apply vs confirm chip per policy; toast +
   Undo; outcome reported back into the thread; `describeState()` fed into next-turn context.
   Tests: auto path applies + undoes; destructive path waits for the chip; client failure
   surfaces a conversational error.
4. **PR4 — Person grounding + synastry/composite (Tier 2).** `find_person` over
   `GET /persons?q=` (astrologer-scoped); disambiguation: 1 → apply, N → agent asks ONE
   question, 0 → "не нашёл". `set_synastry_partner`. Tests: 1/N/0 matches; replace = confirm.
5. **PR5 — Discoverability + mobile polish.** Suggestion chips / examples menu, i18n,
   large push-to-talk affordance in the same corner dock. No new surface.

Every PR closes AGENTS.md DoD (`make all`, `pytest`, i18n checkers).

## Cross-cutting

- **Security.** `user_id` stays server-bound (model never controls it). `find_person`
  reuses `list_persons`, already filtered by `auth.astrologer.id` — no new leak surface.
  Commands run client-side but any data they need (partner chart) flows through existing
  authorized endpoints. Applied actions are audited via `log_turn`.
- **Trust through structure** (recurring theme from the prior plan review): enum/ID args in;
  client re-validates against `LAYER_ORDER`/method vocab before applying; the model can never
  invent a method or a raw mutation; echo back exactly what was applied.
- **Context feedback loop.** After apply, push outcome into the thread and feed
  `describeState()` into the next turn so follow-ups ("а теперь на месяц вперёд") resolve
  against the updated anchor/layers — richer than today's `anchor_date`-only context.
- **Undo.** Each applied command pushes its inverse; "отмени" or the Undo button restores.
  Generalizes the existing `layoutUndo` mechanism; the safety net that makes auto-apply OK.

## Out of scope (deferred until Tier-1 proves demand)

- **Query→command chaining** ("поставь транзит на дату следующего точного Сатурна") — needs
  the loop to thread a query result into a command arg; powerful, but tune after basics ship.
- **Compound commands** ("соляр на 2027 и наложи транзиты на дату соляра").
- Realtime voice / TTS; any non-corner-dock surface.

## Open questions

- Exact relative-date grammar to support in `set_transit_date`/`step_date`
  ("через 3 месяца", "на следующий день рождения") — start narrow, expand on usage.
- Whether `set_synastry_partner` replacing an existing partner should always confirm, or
  only when a partner layer is already present (current assumption: only on replace).
- Per-command telemetry granularity in `log_turn` (names only vs args).

<!-- /autoplan restore point: /Users/ihorskakovskyi/.gstack/projects/igorskak-RNDastro/claude-gallant-curie-f59e30-autoplan-restore-20260612-173441.md -->
# Plan: Configurable Corner Overlay Blocks on Forecast-New

## Problem

The center area of forecast-new renders a round chart wheel inside a rectangular
container. The corners of that rectangle are dead space. ZET and other pro astrology
apps put compact readouts in those corners. We want the same: turn the four corners
into configurable overlay slots that reuse the existing info-block system, so the
working screen becomes a user-configurable "constructor".

## Goal

Each of the four chart corners becomes a slot that can hold one info block, configured
in the same panel editor that configures the left/right side panels. Content renders
compact, with internal scroll when it overflows.

## User decisions (locked)

1. **Content**: the same blocks as the side panels, but rendered more compactly in the
   corner zones, and each corner block scrolls internally when content overflows.
2. **Capacity**: exactly one block per corner (no tabs, no stacking).
3. **Editor**: corners configured in the same panel editor. The four corner slots are
   laid out as a 2×2 grid in the center of the editor, between the left- and
   right-panel columns, mirroring the on-screen physical layout (spatially intuitive,
   no labels needed).

## Existing architecture (what we reuse)

- `app/frontend/js/forecast-new-panel-layout.js` — pure data model. Blocks
  (`{source, view}`), tabs, per-side layouts, multi/single mode, `BLOCK_TARGET_MAP`,
  schema version, `buildDefaultForecastNewLayout`, `renderPanelsToDom`.
- `app/frontend/js/forecast-new.js` — `renderPanels` (~4262), `bindPanelConfigurator`
  (~5001), renderer instances `state.natalRenderer` / `state.prognosticRenderer`,
  persistence (`scheduleLayoutPersist`, `hydratePreferences`, `applyPanelLayout`).
- `app/frontend/forecast-new.html` — `.forecast-new-center` (position: relative),
  `#forecastNewWheelShell`, existing absolute overlays (zoom z45, datebar z40,
  result-switch z46).
- `app/frontend/css/forecast-new.css` — center container, side panel widths.
- Persistence: `chart_defaults.forecast_new.panels` (server) + localStorage view state.

## Committed direction: Option C — shared block pool

A block lives in a side panel **OR** one corner, never both. This reuses the existing
"move, don't copy" editor model and the single-physical-node architecture as-is. No
duplicate renderers. The corner block IS the same rendered block, relocated.

## Implementation

### 1. Data model (`forecast-new-panel-layout.js`)
- Add `corners: { tl, tr, bl, br }` per mode; each corner is `null` or one block
  `{ source, view }`. Mode-dependent (separate multi/single).
- Add `normalizeCorners` step inside the per-mode block ([:188](app/frontend/js/forecast-new-panel-layout.js:188)) that participates in
  the SAME `seenBlockKeys` pass as panels, with defined precedence (corners normalized
  AFTER panels → a duplicate blockKey stays in the panel, corner drops it). Force
  `source:natal` in single mode (mirror [:147](app/frontend/js/forecast-new-panel-layout.js:147)). [fixes C4, C6]
- Empty-rebuild fix: the `left.length===0 && right.length===0` fallback ([:197](app/frontend/js/forecast-new-panel-layout.js:197)) must
  also test corners empty, and `buildDefaultForecastNewLayout` must emit
  `corners:{tl:null,tr:null,bl:null,br:null}` so the replace branch never drops the key. [fixes C3]
- `SCHEMA_VERSION` bump is informational only (normalizeLayout doesn't read it);
  missing `corners` default to all-null. Document as such.

### 2. DOM + CSS
- Four absolutely-positioned containers inside `.forecast-new-center`, sized to the
  **dead corner triangle** around the circle (NOT the full rectangle) to minimize
  overlap with the interactive wheel disc.
- z-index: top corners 47+; **bottom corners must sit BELOW datebar (z40) and zoom
  (z45)** — inset them to clear, or raise datebar/zoom above bottom corners. [fixes C5]
- Hide corners when `data-result-view` is `layers`/`aspects` (same rule as
  `forecast-new.css:1031`). [fixes C5]
- Compact typography class; `max-height` + `overflow:auto` internal scroll. Corner
  content is interactive → `pointer-events:auto` on painted content (occludes wheel
  where it paints — acceptable because corners are the dead triangles).
- Per-view compact treatment (hide non-essential columns) is likely needed beyond a
  font shrink — wide tables won't fit on font size alone. Treat as part of this work,
  not deferred.

### 3. Rendering (`forecast-new.js`)
- No new renderers. The existing single container is re-homed into the corner by an
  extended `renderPanelsToDom` (corners are just additional render targets in the same
  detach/re-home pass). `.is-compact` class drives compact CSS.

### 4. Editor (`bindPanelConfigurator`)
- Insert a 2×2 corner grid between the left/right editor columns (mirrors screen layout).
- Each slot: pick a block (catalog) + clear. Picking a block MOVES it (existing
  move-don't-copy via `removeBlockFromMode`).
- `commitLayoutFromEditorDom` ([:4773](app/frontend/js/forecast-new.js:4773)) must serialize corners too — currently it
  writes `{left, right}` and would drop corners. Reset/undo/presets/hydration likewise. [fixes C2]

### 5. Persistence
- `corners` rides in `state.panelLayout` → server prefs + localStorage. Always PATCH the
  full normalized object (backend replaces lists wholesale). Presets must carry corners.

### 6. Tests (new — none exist; current tests pass while these regress)
See the test matrix in the review report below. Minimum before merge: legacy-without-
corners normalizes intact; block in corner not also in panel; clear-both-panels
preserves corners; dedup across left/right/corners deterministic; editor commit/reset/
undo/preset preserve corners; single-mode forces natal; one-container-per-block assertion.

## Rollout

Vertical slice: one corner (top-left) + one block (`natal:planets`) end-to-end (data
model → normalize → render → editor slot → persist). Verify the moved-block behavior
(panel tab empties when block goes to corner — expected under Option C), pointer-events,
and persistence round-trip. Then expand to all four corners.

## Rollout

Vertical slice first: one corner (top-left) + one block (`natal:planets`) end-to-end
(data → DOM → render → editor → persist). Verify hover events, pointer-events
pass-through, and persistence. Then expand to all four corners and all views.

## Not in scope (yet)

- Multiple blocks per corner / tabs in corners.
- New compact-only mini-blocks (ASC/MC summary, moon phase, etc.).
- Drag-to-resize corner areas.

---

# GSTACK REVIEW REPORT (/autoplan)

Pipeline: CEO → Design → Eng. DX skipped (end-user app, not a dev tool).
Voices: Codex + Claude subagent, both ran for CEO and Eng. Design folded into CEO
(both CEO voices covered legibility/aesthetic at depth) plus eng pointer-events.

## Headline

Both models, independently, in both the CEO and Eng phases, recommend **NOT building
the plan as written**. Two distinct reasons, both strong:

1. **Strategy (CEO):** configurable 4-corner slots reusing all 9 panel views is the
   most expensive, least-aligned variant. The stronger product is curated, read-only,
   glanceable corner readouts (ASC/MC, Moon phase, strongest active transit) — designer
   controlled, off-or-curated by default. This is a **User Challenge** (see below).
2. **Engineering (Eng):** the plan's central premise — "distinct DOM ids let one block
   live in both a panel and a corner" — is contradicted by three independent invariants
   in the codebase. As written it causes silent data loss.

## CEO dual-voices consensus

| Dimension | Claude | Codex | Consensus |
|---|---|---|---|
| 1. Premises valid (not assumed)? | NO | NO | CONFIRMED weak |
| 2. Right problem to solve? | NO (reframe) | NO (reframe) | CONFIRMED — reframe |
| 3. Scope calibration (9 views in corners)? | NO | NO | CONFIRMED wrong-sized |
| 4. Alternatives explored? | NO (curated dismissed) | NO | CONFIRMED |
| 5. Conversion/retention tie? | NO metric | NO metric | CONFIRMED missing |
| 6. Aesthetic fit w/ native-macOS? | NO (conflict) | NO (clutter) | CONFIRMED conflict |

Both flag: aesthetic conflict with the approved "Soft Aurora" native-macOS direction
(memory: design-direction-native-macos); ZET is power-user software, wrong north star
for a $24/$39 reverse-trial consumer funnel; default-on corners are an unexamined
first-run/conversion risk; scroll-inside-a-floating-corner is a known anti-pattern.

10x reframe (both, independently): a single context-aware **Interpretation/HUD readout**
("what matters in this chart right now") beats four empty configurable boxes.

## Eng dual-voices consensus

| Dimension | Claude | Codex | Consensus |
|---|---|---|---|
| 1. Architecture sound as written? | NO | NO | CONFIRMED — fatal premise |
| 2. Test coverage sufficient? | NO | NO | CONFIRMED gaps |
| 3. Migration safe? | NO (3 bugs) | NO | CONFIRMED data-loss |
| 4. Pointer-events workable? | NO | NO | CONFIRMED conflict |
| 5. CSS-only compact enough? | NO | NO | CONFIRMED insufficient |
| 6. "Reuse renderers" accurate? | NO | NO | CONFIRMED understated |

### Critical eng findings (verified against code)

- **C1 — One DOM node per block (FATAL to "same block in both").**
  `BLOCK_TARGET_MAP` ([forecast-new-panel-layout.js:65](app/frontend/js/forecast-new-panel-layout.js:65)) = one container per `source:view`. `renderPanelsToDom`
  detaches and re-homes that single node ([:299](app/frontend/js/forecast-new-panel-layout.js:299)). `ChartDataRenderer` caches the element
  in its constructor — no `renderInto(target)`. Editor already enforces move-don't-copy
  ([forecast-new.js:4360](app/frontend/js/forecast-new.js:4360)). So a block in a corner is REMOVED from the panel. The
  plan's "distinct DOM ids" line is false. Three real options:
  - **(A)** Duplicate corner containers + up to 4 extra renderer instances, mirror every
    render/filter/hover call site (~8 sites). Satisfies "same block in both", real work.
  - **(C)** Corners share the block pool — a block is in a panel OR a corner, never both.
    Nearly free, fits existing dedup. Contradicts decision #1's implied mirror.
  - **(Curated)** Separate `corner_readouts` model with purpose-built read-only compact
    components fed by shared chart data. Both models' preferred path.
- **C2 — `commitLayoutFromEditorDom` ([forecast-new.js:4773](app/frontend/js/forecast-new.js:4773)) replaces the mode with
  `{left, right}` — drops `corners` on every editor commit.** Silent data loss. Reset,
  undo, presets, hydration all need corner-aware handling.
- **C3 — Empty-rebuild wipes corners.** `normalizeLayout` rebuilds a mode from defaults
  when `left.length===0 && right.length===0` ([:197](app/frontend/js/forecast-new-panel-layout.js:197)); fallback has no `corners`. Clear
  both panels, keep corner blocks → corners silently wiped.
- **C4 — Dedup scope.** Corners must join `seenBlockKeys` with defined precedence, else
  nondeterministic double-homing.
- **C5 — pointer-events is not solvable for interactive corners.** Transparent bg does
  not help: any pixel with `pointer-events:auto` eats wheel hover/drag/zoom beneath it,
  killing cross-highlight + tooltip in that quadrant. Internal scroll captures the wheel
  scroll-zoom. Bottom corners at z47+ also cover the datebar (z40) and zoom (z45), and
  float over the layers/aspects result pane. → Either corners are read-only
  `pointer-events:none` throughout, or they deliberately occlude the wheel. Can't be both.
- **C6 — single-mode coercion**: corner blocks must be forced `source:natal` in single
  mode or they become non-realizable.

### Required test matrix (none exist today; existing tests pass while regressions ship)
- legacy layout without `corners` normalizes → panels intact, corners all-null
- block in corner is NOT also in a panel pane
- clear both panels preserves corners (C3)
- dedup one blockKey across left/right/all corners, deterministic winner (C4)
- editor commit / reset / undo / preset save+load / hydration preserve corners (C2)
- single mode forces corner source natal (C6)
- wheel hover/drag/zoom under and adjacent to each corner (C5)
- result-view switch (layers/aspects) hides corners
- assertion: every canonical container exists exactly once after every render

## Decision Audit Trail

| # | Phase | Decision | Class | Principle | Rationale |
|---|---|---|---|---|---|
| 1 | CEO | Scope of "9 views in corners" | Taste→escalated | P1/P5 | Both models say wrong-sized; rolls into User Challenge |
| 2 | CEO | Pivot to curated readouts vs configurable | USER CHALLENGE | — | Both models disagree w/ stated direction; never auto-decided |
| 3 | Eng | Architecture A vs C vs Curated | USER CHALLENGE-linked | P5/P3 | Depends on #2; explicit decision required pre-code |
| 4 | Eng | Fix C2/C3/C4 migration bugs | Mechanical | P1 | Required regardless of path; auto-include |
| 5 | Eng | Add full test matrix | Mechanical | P1 | Boil-the-lake; auto-include |
| 6 | Eng | pointer-events: read-only vs occluding | Taste→escalated | P5 | Forces the read-only-vs-interactive product decision |

## NOT in scope (deferred)
Multiple blocks/tabs per corner; drag-resize. If curated path chosen: the panel-editor
2×2 grid is deferred (curated corners need a simpler on/off + pick-readout control).

## What already exists (reuse map)
- Layout data model, dedup, render: `forecast-new-panel-layout.js`
- Editor, renderers, persistence: `forecast-new.js` (4260–4391, 4773, 414–440)
- Renderer element caching: `chart-data.js:8`
- Wheel hover/tooltip: `prognostic-rings-wheel.js:1383,1584`
- Overlay z-stack + result-view hiding: `forecast-new.css:978,1031,1154,1205`


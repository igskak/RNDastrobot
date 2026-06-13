# Cleanup plan: retire old chart pages, keep forecast-new as the sole workspace

Reviewed via `/plan-eng-review`. Scope decisions locked with the owner:
- **D1** — Delete the **frontend** of old pages now; keep their **backend** (routes + services), because forecast-new still calls them.
- **D2** — In scope: **Chart, Solar, Synastry**. Out of scope: `forecast-timeline`, `forecast-tables`, `natal-full`, demo mockups (forecast-new still *links* to them; not copied in).
- **D3** — Repoint inbound links from kept pages to forecast-new.
- **A1** — Delete `chart-wheel.js` + `chart-wheel-adapter.js` in the same pass (they orphan when chart/synastry go; forecast-new uses `prognostic-rings-wheel.js`). This closes W6.
- **A2** — Remove the Solar link + Synastry button from forecast-new's action menu (redundant with in-page ring-layer toggles).

## Why backend stays (the landmine)

forecast-new is **not** a self-contained island — it calls the old pages' backend for its ring layers:

```
forecast-new.js:3213  ──POST /solar/calculate──────►  app/api/routes/solar.py    ──►  solar_return_service.py   [KEEP]
forecast-new.js:3222  ──POST /synastry/calculate──►  app/api/routes/synastry.py ──►  synastry_service.py       [KEEP]
forecast-new.js:3181  ──POST /transits/...        ──►  transits.py / progressions.py / directions.py            [KEEP]
```

Deleting `solar.py`/`synastry.py`/their services would silently break the Solar & Synastry ring layers. **Backend is kept.**

## Dependency map (frontend)

```
DELETE (Chart / Solar / Synastry only)            KEEP (shared with forecast-new — "chart-" name is misleading)
──────────────────────────────────────           ──────────────────────────────────────────────────────────
chart.html  solar.html  synastry.html             chart-data.js        (forecast-new imports)
entries/{chart,solar,synastry}.entry.js           chart-picker.js      (forecast-new imports)
entries-css/{chart,solar,synastry}.entry.css      chart-config-presets.js (forecast-new imports)
js/chart.js  js/solar.js  js/synastry.js          save-chart-modal.js  (forecast-new imports)
js/chart-layout.js          (chart-only)          chart-source-panel.js (forecast-new imports)
js/chart-wheel.js           (orphan after A1)      aspect-phase.js      (imported by chart-data.js)
js/chart-wheel-adapter.js   (orphan after A1)      related-people-ui.js (imported by client-profile.entry.js!)
js/bundles/{chart,solar,synastry}.bundle.js        prognostic-rings-wheel.js / prognostic-layer-normalizer.js
bundles/{chart,solar,synastry}.bundle.css          ALL backend: routes/{solar,synastry,charts}.py + services
```

## Execution steps (ordered to never break a build mid-way)

### Step 1 — Repoint inbound links to forecast-new (D3) [do FIRST]
Kept files that link to soon-deleted pages (will 404 otherwise):

| File | Current target | Action |
|------|----------------|--------|
| `app/frontend/js/quick-open-popover.js:261,287` | `solar.html`, `synastry.html` | → forecast-new |
| `app/frontend/js/clients.js:1159` | `chart.html` | → forecast-new |
| `app/frontend/js/client-profile.js:961` | `synastry.html` | → forecast-new |
| `app/frontend/js/consultation-call.js:151` | `chart.html` | → forecast-new |
| `app/frontend/js/form.js:207` | `chart.html` | → forecast-new |
| `app/frontend/js/related-people-ui.js:82,98` | `chart.html`, `synastry.html` | → forecast-new |
| `app/frontend/natal-full.html:68,80` | `solar.html`, `chart.html?open=synastry` | → forecast-new (natal-full kept) |
| `app/frontend/js/natal-full.js:449,477,497` | `chart.html` | → forecast-new |

### Step 2 — Clean forecast-new's own chrome (A2)
- `forecast-new.html:118` — remove `<a href="solar.html">` action-menu item.
- `forecast-new.html:120` + `forecast-new.js:495-500` (`openSynastryBtn`) — remove the Synastry action-menu item + handler.
- `forecast-new.js:232-238` (`getForecastSynastryUrl`) + `:499` fallback `/chart.html?open=synastry` — remove the chart.html fallback path.
- Keep: view tabs to `forecast-tables.html`/`forecast-timeline.html` (out of scope) and `openNatalTablesBtn` → `natal-full.html` (out of scope).

### Step 3 — Remove build-config entries
`app/scripts/build-frontend-bundles.mjs` — remove `chart`/`solar`/`synastry` from all 3 lists:
- htmlPages (lines 18-20), jsEntryPoints (36-38), cssEntryPoints (54-56). Leave forecast-tables/timeline/natal-full.

### Step 4 — Delete frontend files
HTML (3), entries/*.entry.js (3), entries-css/*.entry.css (3), js/{chart,solar,synastry}.js, js/chart-layout.js, js/chart-wheel.js, js/chart-wheel-adapter.js, and the matching js/bundles/*.bundle.js + bundles/*.bundle.css.

### Step 5 — Remove backend page-route handlers (NOT API routers)
`app/api/main.py`:
- Delete handlers: `chart_page` (239-247), `synastry_page` (248-266), `solar_page` (267-~285).
- Remove cache-list entries (lines 108-113): `/chart.html`, `/synastry`, `/synastry.html`, `/solar`, `/solar.html`.
- **KEEP** lines 146/155/156: `solar.router`, `synastry.router`, `charts.router`.

### Step 6 — Test cleanup
- `app/tests/test_prognostic_rings_wheel_unified.test.cjs:165-185` — remove the "W5: ChartWheelUnified adapter" block (tests the deleted adapter). Rest of file stays.

### Step 7 — Rebuild + verify
- `cd app && npm run build:frontend` (regenerates bundles without deleted entries).
- `.venv/bin/python -m pytest app/tests/` (backend unchanged → green).
- `node app/tests/test_prognostic_rings_wheel_unified.test.cjs` and other `.test.cjs`.
- Live: load forecast-new, toggle Solar + Synastry ring layers (confirm /solar/calculate, /synastry/calculate still work), check the action menu no longer shows Solar/Synastry, click a client → forecast-new opens.

## Failure modes
| Codepath | Failure | Covered? |
|----------|---------|----------|
| Solar ring layer | `/solar/calculate` 404 if router accidentally removed | Backend kept; verify live + pytest |
| Synastry ring layer | same for `/synastry/calculate` | Backend kept; verify live |
| Inbound nav from clients/calls | dead link → 404 (silent UX break) | Step 1 repoint; manual click-through |
| Build | esbuild fails on missing entry | Step 3 before Step 4 |
| Unified-wheel test | import error on deleted adapter | Step 6 removes the block |

## NOT in scope
- `solar.py` / `synastry.py` routes + services — shared by forecast-new (D1).
- `forecast-timeline.html` / `forecast-tables.html` — forecast-new links to them; period views not yet ported in-page (handoff §4.3).
- `natal-full.html` / `natal-full.js` — kept (D2); links repointed only.
- Demo mockups (`forecast-new-{aurora,midnight,studio}-demo.html`).
- Feature-flag migration of old URLs (D4) — superseded for these 3 pages by direct frontend removal.

## Parallelization
- Lane A: Steps 1-2 (frontend JS/HTML link edits + chrome) — touches `app/frontend/`.
- Lane B: Step 5 (`app/api/main.py`) — independent module, can run parallel to A.
- Steps 3-4 depend on 1-2 (don't delete files still linked). Step 6-7 sequential at the end.

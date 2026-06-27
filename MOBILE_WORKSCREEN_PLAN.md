# Mobile work screen — implementation plan & decision log

**Scope (this deliverable):** mobile/responsive optimization of the astrologer **work screen** = `app/frontend/forecast-new.html` (the unified workspace: header + layer toggles, left natal panel, center chart wheel, right prognostic panel, corner-dock chat). First of a series; other in-app screens follow later.

**Hard constraint (user):** the app stays **desktop-first**. Every change here is **purely additive inside mobile breakpoints**. The desktop (and tablet >640px) rendering must remain byte-for-byte unchanged. No base/desktop rule is altered in effect.

---

## Analysis summary (current mobile baseline)

- The desktop layout is a CSS grid `clamp(210px,18.5vw,286px) | minmax(0,1fr) | clamp(210px,18.5vw,286px)`.
- At `≤860px` it already collapses to a single flex column: wheel on top (`order:-1`), then **both** side panels stacked full-width. Header wraps. Touch targets bumped to 40px.
- Gaps that make it feel like "a long scroll dump" rather than an app:
  1. **Both** data panels stack → a very long double scroll (natal tables, then prognostic tables).
  2. No phone-specific tier below 640px → wheel pinned to `64vh + min-height:440px` (overflows short/landscape phones).
  3. Overlays (display settings, kebab actions, layer config popovers, add-layer menu) stay as edge-anchored desktop popovers → clip at the 390px edge.
  4. Chat input is `12.5px` (iOS zoom-on-focus); chat buttons 30–32px (< touch target).
  5. Horizontally-scrollable layer-tab / tab strips have no scroll affordance on touch.

### Verified facts that make this safe & CSS-light
- Layer popovers and all menus are **click/tap-triggered** (not hover) and dismissed by a **global outside-click + Escape** handler → bottom sheets dismiss correctly.
- JS reads `innerWidth` only to **clamp floating-menu position**, never for layout-column decisions → CSS-only layout won't fight JS.
- No ancestor of the overlays uses `transform/filter/will-change/contain` → `position:fixed` bottom sheets resolve to the viewport. **Exception:** `.side-panel` has `backdrop-filter` (desktop glass) which would trap a fixed child → the **moment card** is handled as an in-flow expander instead, and panel blur is neutralized at ≤640 (invisible: panels are opaque full-width there).
- Chart wheel SVG (`viewBox 0 0 600 600` + `preserveAspectRatio="xMidYMid meet"`) scales square to its shell → never causes horizontal scroll. **Left untouched.**

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Phone tier = one new `@media (max-width:640px)` block appended at the END of `forecast-new.css`.** | Aligns with the existing chat mobile breakpoint (640) and the existing 640 block; last-in-file wins ties; clearly delineated, reviewable diff. The 640–860 range keeps the current "tablet stacked" treatment. |
| D2 | **Panel switcher (Primary ⇄ Comparison)**: show only ONE side panel at a time on phones, via a segmented control below the wheel. | Kills the double-stack — the single biggest UX win. Labels describe panel roles, not calculation types: left = source/main chart data, right = comparison/forecast/synastry layers. CSS-only display toggle via `body.fn-mobile-panel-prog`; tiny guarded JS listener; no-JS fallback = both panels stacked (current behavior), so reachability never depends on JS. |
| D3 | **Wheel stays the hero, always on top**, band height `clamp(340px,54vh,520px)` (replaces 64vh+440 floor on phones). SVG untouched. | Chart is the focus of a reading; sized to fit portrait & landscape without overflow. |
| D4 | **Overlays → bottom sheets** on phones: display-settings panel, kebab actions menu, layer-config popovers (direction/solar/synastry), add-layer menu, forecast-nav dropdown. Native feel: rounded top, grabber handle, slide-up with `--motion-soft`, blur. | Edge-anchored desktop popovers clip at 390px; bottom sheets are the native-app idiom and never clip. |
| D5 | **Moment (date/time/place) card = in-flow expander** on phones (`position:static`), not a fixed sheet. | Avoids the `.side-panel` `backdrop-filter` fixed-trap; a disclosure that pushes content down is robust and natural. |
| D6 | **Touch ergonomics**: chat input `16px` (no iOS zoom) + chat buttons 40px (inside the existing chat 640 block); matrix checkbox cells, panel tabs, stepper segments ≥ 44px tappable; scroll-fade affordance on the layer-tab row. | "Super convenient": every control comfortably tappable; discoverable horizontal scroll. |
| D7 | **Dedicated mobile switcher i18n keys** (`page.forecastNew.mobilePanels.primary`, `page.forecastNew.mobilePanels.comparison`). | Existing `Natal` / `Forecast` keys name calculation types and feel misleading on a role-based mobile panel switcher. New keys keep desktop labels unchanged while phones say `Основная / Сравнение`. |
| D8 | now:lunar / now:hours corner-exclusive reachability on phones = **follow-up**, not a blocker. | Corners hidden ≤860 already; blocks default to panel-tab hosts per code. Edge case dependent on a user's saved layout. |
| D9 | **Layer config sheets remain DOM-owned by the hidden header toggle strip, but the strip becomes a zero-size visible host while a phone sheet is open.** | The real phone layer UI is `rightLayerTabs`; moving DOM would be riskier. CSS `:has(...)` exposes only the fixed sheet and keeps old header chips hidden. |
| D10 | **Top-level mobile sheets are mutually exclusive, Escape closes settings, and header-owned sheets temporarily raise the header stacking context.** | Prevents settings from intercepting add-layer/menu taps, and keeps layer sheets above the sticky panel switcher and chat launcher. |
| D11 | **Touch pinch zoom on the wheel is implemented with touch events, separate from desktop mouse wheel/drag.** | Desktop behavior stays intact. On phones, one finger pans the chart and two fingers adjust `state.viewport.zoom`; persistence is deferred until the touch sequence ends to avoid storage churn while pinching. |

## Files touched
- `app/frontend/css/forecast-new.css` — one trailing `@media (max-width:640px)` block + one base `display:none` rule for the switcher (inert on desktop); phone-only layer-sheet host and stacking fixes.
- `app/frontend/css/chat-widget.css` — additions inside the existing `@media (max-width:640px)` block only.
- `app/frontend/forecast-new.html` — add the `.forecast-new-mobile-panel-switch` element (i18n labels, ARIA).
- `app/frontend/js/forecast-new.js` — one guarded listener (toggle `fn-mobile-panel-prog`; clear it above 640), shared overlay close behavior for settings/actions/layer sheets, and touch pan/pinch handlers for the wheel.
- `app/frontend/locales/en.json`, `app/frontend/locales/ru.json`, `app/frontend/locales/uk.json` — role-based mobile panel labels.
- Rebuild bundles (`npm --prefix app run build:frontend`); commit regenerated `bundles/**` + `js/bundles/**` + the HTML version markers together.

## Implementation follow-up — 2026-06-27

- Found during live phone QA: adding Direction/Solar/Synastry from the mobile `+` menu added the layer, but the config sheet stayed invisible because its DOM lives under `.forecast-new-layer-toggles`, which is hidden in the current workspace header.
- Found during live phone QA: opening settings and then opening add-layer left settings above the new sheet; Escape also did not close settings.
- Found during live phone QA: once exposed, header-owned layer sheets could render under the sticky Natal/Forecast switcher and chat launcher because the header's own stacking context was lower than those fixed/sticky controls.
- Implemented D9/D10 as additive mobile behavior: no new locale keys, no desktop layout changes, and no new framework/dependency.
- Browser QA passed at 390x844, 641x844, and 1280x900: no horizontal overflow; phone shows one data panel at a time; 641px shows both stacked panels; 1280px keeps the three-column grid.

## Implementation follow-up — 2026-06-27 (labels + pinch)

- Renamed the phone-only panel switcher from calculation labels (`Natal` / `Forecast`) to role labels (`Primary` / `Comparison`; RU `Основная` / `Сравнение`; UK `Основна` / `Порівняння`). Desktop panel titles remain unchanged.
- Added phone touch gestures for the wheel: one-finger pan and two-finger pinch zoom. Existing desktop mouse wheel zoom and mouse drag remain unchanged.
- Browser QA confirmed the mobile switcher renders via the new i18n keys at 390x844 and the wheel shell is present with `touch-action:none`. Synthetic pinch dispatch could not be completed through the in-app browser automation surface because that environment does not expose DOM event constructors; code path was verified by build/static checks and will be best manually smoke-tested on a physical touch device.

## Verification (Definition of Done)
- `npm --prefix app run build:frontend` + `npm --prefix app run check:frontend-build` (clean diff).
- i18n gates (4 checkers) + relevant `node --test` suites.
- **Desktop regression check**: screenshot work screen at ≥1280px before/after — 3-column grid, wheel, mirrored panels pixel-identical.
- **Mobile check**: 390×844 + landscape — no horizontal scroll, sticky header, wheel hero, switcher toggles panels, bottom sheets don't clip, chat no-zoom.
- **Boundary check**: 641px and 860px behave exactly as baseline (new rules must not engage).
- Push committed merge to BOTH remotes (GitLab `origin` + GitHub `github`).

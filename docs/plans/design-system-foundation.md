# Design system foundation: spacing, type, components, app chrome

Branch: `feat/design-ux` (base: `origin/main`, confirmed identical to live steliara.com as of 2026-07-12).
Source: external design audit (Claude Design Audit, July 2026) + verification below.
Scope lock: **no color/palette changes, no accent-usage rebalancing** — this is a discipline/consistency pass on the existing navy/gold/parchment language, not a new aesthetic.

## Why

The audit's core finding: the aesthetic is fine, the assembly isn't. Every page redefines its own spacing, type sizes, and components instead of sharing one system. That reads as "unfinished" before a visitor reads any content, and it's the single highest-leverage fix before launch — it improves all ~15 pages at once instead of one at a time.

## Current state (verified against `origin/main`, 2026-07-12)

**Spacing.** `styles.css` defines `--density-space-{1..5}` (4/6/8/10/12px) but they're used alongside hundreds of hand-typed values:
- 33 distinct margin/padding pixel values in use across the frontend CSS (2px to 98px), with no consistent scale — e.g. `6px` appears 128 times, `9px` 45 times, `18px` 34 times, as parallel/competing choices rather than one snapping to the other.

**Type.** No type-scale tokens exist at all today (no `--font-size-*` variables). Raw `font-size: Npx` is hand-typed everywhere:
- **32 distinct font-size values** in use, from 7px to 48px. The worst offenders: `12px` (173 uses), `13px` (126), `11px` (111), `10px` (69), `14px` (55), plus fractional sizes `12.5px` (16), `13.5px` (6), `11.5px` (12), `10.5px` (3) — sub-pixel deltas nobody can perceive as intentional hierarchy.

**Components.** No shared component classes exist:
- `.btn` variants are defined **74 separate times** across different files (e.g. `.btn-new` and `.btn-logout` are each redefined at least twice with different values in `styles.css` alone, at lines 111-156 and again 2272-2303).
- `.card` is defined **zero times** as a shared class — every page builds its own card-like containers inline.
- Table-row styling patterns appear in 30 different places with no shared class.
- Inline `<style>` blocks exist directly in `<head>` on `clients.html`, `index.html`, `pricing.html`, `terms.html`, plus all 3 (now-deleted) forecast demo pages — a sign these components escaped the design system entirely.

**Page-specific CSS bloat** (symptom of the above — components rebuilt per page instead of shared):
| File | Size |
|---|---|
| `css/forecast-new.css` | 105 KB |
| `css/chart-layout.css` | 43 KB |
| `css/account-settings.css` | 41 KB |
| `entries-css/clients.entry.css` | 41 KB |
| `entries-css/client-profile.entry.css` | 31 KB |
| `css/natal-full.css` | 30 KB |

**App chrome.** No persistent nav exists today — every authenticated page builds its own top bar with a brand mark + destination pills (Calendar/Settings/Logout), and the "Practika" home screen adds a second, competing heading inside its own card. **Already in progress**: this branch has uncommitted `app/frontend/css/app-sidebar.css` (168 lines) and `app/frontend/js/app-sidebar.js` (145 lines) implementing a self-mounting left sidebar (Practice/Calendar/Settings + account footer), following the same injection pattern as the existing `locale-switcher.js`. This spec extends that work rather than replacing it.

## Proposed change

### 1. Spacing scale
Add to `styles.css` `:root`, alongside (not replacing) the existing density tokens, which stay for their specific job (compact in-app control sizing):
```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 24px;
--space-6: 32px;
--space-7: 48px;
--space-8: 64px;
```
Rule going forward: no new hand-typed margin/padding px value outside this scale or the existing `--density-space-*` tokens. Existing off-scale values get remapped to the nearest scale step during the page-by-page pass (task below), not in one giant sweep — each page's pass rounds its own values as it's touched, so nothing regresses before it's verified live.

### 2. Type scale
```css
--font-size-caption: 12px;
--font-size-label:   14px;
--font-size-body:    16px;
--font-size-h3:      20px;
--font-size-h2:      28px;
--font-size-h1:      40px;
```
Rule: `--font-display` (Cormorant Garamond) only ever pairs with `--font-size-h2` or `--font-size-h1`. Everything at `h3` and below uses `--font-ui` (DM Sans), including UI labels that currently use serif at small sizes.

### 3. Shared components
One canonical definition each, added to `styles.css`, replacing the 74 scattered `.btn` redefinitions and the ad hoc card/table/settings patterns as pages are touched:
- `.btn` + `.btn-primary` / `.btn-secondary` / `.btn-ghost` — one height per size variant (`.btn`, `.btn-sm`), not one height per page.
- `.input` — one text input treatment (border, radius, focus ring) reused for every text/number/select field, including the six loose coordinate-degree inputs on the landing form.
- `.card` — one surface treatment (background, radius, shadow, padding) — currently doesn't exist as a shared class anywhere.
- `.table-row` — one row treatment (hover affordance, height, dividers) to replace the 30 scattered ad hoc table stylings.
- `.settings-row` — label-left/control-right, fixed height, hairline divider — purpose-built for the Account Settings sectioning work, reusable anywhere else a label+control pair appears.
- `.empty-state` — icon + title + copy + CTA slot, to give the already-well-written empty-state copy (confirmed present: consultation insights, client profile history/recordings, forecast timeline) a consistent visual home instead of a bare grey line. Icon renders inside a single accent-tinted circle (kept deliberately, reviewed against the AI-slop "icons in colored circles" pattern — a single functional empty-state marker reads differently from repeated decorative section icons in a feature grid).
- `.dialog` — one modal/dialog shell.

### 4. App chrome — slide-out burger nav (REVISED 2026-07-13)
Extend the existing uncommitted `app-sidebar.css`/`app-sidebar.js`, but **not as a persistent always-visible sidebar** (earlier assumption, reversed by user). Instead:
- **Hidden by default, slide-out on burger.** On the Practice page AND every other authenticated page, the nav is not visible by default; a burger button slides it out neatly, and it dismisses (overlay/esc/click-away). Trades a persistent rail for more canvas; nav costs one click to reveal.
- **Nav contents:** Practice · Calendar · Settings (nav destinations), plus — moved OUT of the page header into the nav — the **language switcher**, the **login email**, and **logout**.
- **Remove Consultations** from the nav — there is no Consultations page today (earlier plan to add it as a 4th item is reversed).
- Mounts on every authenticated page (clients/home, client-profile, forecast-new + siblings, calendar, account-settings). Removes the now-redundant top-bar pills, since language/email/logout now live in the slide-out nav.
- Note: this revises the earlier forecast-new + account-settings mockups (which showed a persistent left sidebar with a Consultations item) — those chrome regions become the same burger slide-out, no Consultations.

## Accessibility fix (decided, verified)
`--text-muted` (#9B9289) measures **2.86:1** contrast against `--bg-primary` (#F9F7F2) — fails WCAG AA even for large text (needs 3:1), let alone the captions/table-headers/empty-state copy it's actually used on (needs 4.5:1 as normal-size text). Fix: darken to **`#7A6F63`**, verified at **4.58:1** (passes AA), same warm neutral hue family — not a palette change, a legibility fix to an existing token. This is the one hex value this spec touches; everything else stays untouched per the color-lock scope.

## Deferred (not this spec, tracked for implementation)
- **Sidebar mobile/responsive behavior** and **dialog keyboard handling** (Escape to close, focus-trap, focus-return on close) — deferred to the page-by-page `/design-review` pass, where these get specified against real pages rather than in the abstract. Existing reference: `docs/mobile-ui-audit.md` already covers mobile patterns broadly and should inform the sidebar's mobile spec when it's written.
- **Interaction-state matrix** (hover/focus/disabled/error/selected for the 7 components) — deferred to whoever implements each component, rather than specified up front here. Risk: without it, disabled/error/selected states may get re-invented ad hoc per page again, the same pattern that produced 74 scattered `.btn` definitions. Revisit if that recurs during the page-by-page pass.

## forecast-new.html — locked constraint (overrides the audit)
The external audit's "07 · Natal chart" CRITICAL finding ("wheel competes with a wall of tables → hide data in a collapsible panel, progressive disclosure") is **rejected for this page.** The always-visible wheel + all data panels is a deliberate, expert-requested design: astrologers explicitly asked to see the wheel and every data table on one screen simultaneously, so they get the exact data they need by moving their eyes — not by clicking to reveal it. Fast at-a-glance scanning + quick adjustment with no extra clicks is the whole point. The team spent significant time designing this page and does not want to lose it.
- **Do NOT** introduce drawers, tabs-that-hide, overlays, or any progressive-disclosure mechanism on `forecast-new.html`.
- **What to actually improve here:** the *display discipline* of the existing dense layout — align the left/center/right regions to a shared grid, apply the consistent spacing rhythm and type scale, and fix glyph legibility (retire the blanket `--glyph-scale: 1.2` hack for deliberate per-context sizing) — so a glance lands faster. Nothing is removed, nothing becomes click-gated.
- This makes `forecast-new.html` a light-touch consistency pass, not a layout redesign — unlike the other big-IA pages (settings, workspace home, landing) which do get structural changes.
- **Top-controls reorganization (decided, separate from the density layout):** the page's top controls are scattered across 3+ clusters today (top-left identity, top-center layer toggles, top-right ⋮-actions-menu + panel-editor, and a floating cluster on the wheel with view-mode/zoom/settings-gear). This causes "hunt for the button." Fixes:
  - **Navigation leaves the toolbar entirely** — Home / Account settings / Client profile move to the persistent sidebar; the ⋮ "Actions" menu shrinks to only chart-specific items (or goes away).
  - **Fork 1 (decided): two clearly-labeled settings buttons, not one.** Keep "calculation/display settings" (zodiac, ayanamsha, aspect scope, icon size, house system) SEPARATE from "panel layout" (the panel editor / "Настроить панели"). Two mental models, two labeled buttons.
  - **Fork 2 (decided): lift ALL the floating wheel controls (single/multi wheel, swap, zoom) up into the top bar** so positions are fixed/predictable instead of floating over the wheel. Result is a **two-row top bar**: Row 1 = identity + layer toggles; Row 2 = view switcher + wheel controls + the two settings buttons. A lighter one-row alternative (wheel controls returned to a floating cluster, ghost buttons, borderless chips) was built and compared — user chose to keep the two-row version for now. Revisit weight after it's live if the density bothers in practice.
  - **Fork 3 (decided): visible view switcher** for Wheel / Tables / Timeline (the alternate representations of the same chart), instead of burying tables/timeline in the ⋮ menu.
- **Identity block shows full birth data (decided 2026-07-13):** the top-bar identity subtitle shows date, **time**, place, **and timezone** (e.g. "14.03.1990, 08:15 · Москва · UTC+3"), not just date+place. Date/time format must honor the account date-format preference (`accountDateFormatSelect`), not be hardcoded.
- **Top bar = ONE row, three zones (FINAL 2026-07-13):** a single line, no second row. **Left (fixed):** ← Практика · name + full birth data. **Middle (flexible, `overflow-x:auto`):** Слои + all layer moments, always visible; scrolls sideways if there are too many active layers to fit, with faded edges hinting the scroll — so it never wraps to a second row. **Right (fixed):** Вид ▾ · ⚙ Настройки карты · ▤ Панели. Each active date/year layer (transit/progression/direction/solar) shows its moment instances **inline as full DD.MM.YYYY chips** (removable ×, + to add) — no click to see moments. Inactive layers are add-able chips (+ Дирекция / + Соляр). **Synastry is different (per prod):** instance = a **partner** (name), not a date — partner-name chips + "+ партнёр" (picker) + the **Композит** option. Per-layer config (direction type, solar location) stays behind a small ▾ (setup, not data). Wheel controls (single/multi/swap/zoom) float on the wheel. Supersedes the earlier one-line AND two-zone attempts. **Chip pattern:** the delete × on each moment/partner chip is hidden by default and reveals on chip hover — keeps chips compact (just the date/name) since they already carry a lot of horizontal weight; matches the hover-to-reveal pattern used for the Practice-page row ⋯ menu.
- **~~One-line top bar / two-zone attempts~~ (SUPERSEDED by the one-row three-zone layout above):** reversed the earlier two-row choice — everything fits one row. Trades to fit: wheel controls (single/multi/swap/zoom) float on the wheel (contextual anyway); «Вид» is a compact labeled dropdown (Колесо / Натальные таблицы / Таблицы прогноза[multi] / Таймлайн[multi]) instead of a wide segmented control; per-instance layer moments fold into the layer chip as "Транзит (2) ▾" → popover (add/remove). Line splits: **left = context** (← Практика · name+full birth data), **right = controls** (Слои[chips] · Вид ▾ · ⚙ Настройки карты · ▤ Панели). The chart-settings button is labeled **«Настройки карты»** (not just «Настройки») to distinguish it from account settings (which lives in the burger nav).
- **Completeness audit (done 2026-07-13):** full inventory of every prod control taken; top-bar redesign checked against it. **4 items were missing, now added:** (1) Natal tables (natal-full) → added to the Вид switcher, distinct from forecast tables; (2) Client profile → the client name becomes a visible link (was a hidden clickable title + a ⋮ item); (3) per-instance layer management (`#rightLayerTabs`: +add-instance / per-instance chips / − remove) → shown near the layer toggles in multi-view; (4) the hidden clickable-title affordance → made explicit. **No excess** controls invented. **State rules preserved:** forecast tables/timeline are multi-wheel-only (hidden in single); swap starts disabled; composite/relationship controls appear only when synastry active; per-instance chips only in multi-view. **← Практика** top-left merges the old back arrow + ⋮ Home item + the user's requested burger-free Practice link into one affordance. All controls that live in the always-visible data panels (moment editors, save/saved-charts, time steppers, panel tabs+overflow, matrix, composite/relationship switch, chat, mobile switch) stay in the panels, untouched.
- **Scope (decided): start with alignment + spacing + type + glyph legibility only** (snap the 3 regions to a shared grid, apply the spacing rhythm and type scale, retire the blanket `--glyph-scale`). Purely making the existing dense layout scan faster; nothing moves, nothing changes behavior. Optional follow-on (quiet non-interactive at-a-glance structure — clearer panel/section headers, subtle grouping) is deferred: evaluate whether it's needed only after the alignment pass is in and viewed live.

## clients.html (workspace home) — layout direction (REVISED 2026-07-13)
Chosen direction: **A · Today panel** (reversed from the earlier Option C master–detail). Layout: burger slide-out nav (hidden by default) + main list + a right rail kept as a real "today" surface (mini-calendar + some events: solars this month, key transits). Fixes the audit's findings via: burger nav removes the top-bar pills and the "two headers, no navigation" problem; a single aligned toolbar row (search grows, tag/sort fixed-width, same height).
- Client list gets contacts-style identity treatment (avatar initials + name), not a raw data dump.
- **Per-row ⋯ action menu (matches prod):** each row keeps the existing production pattern — a `btn-actions` toggle opening an `actions-dropdown` with **Rename** (charts view), **Edit**, and **Delete** (danger), plus the quick open-chart / open-forecast buttons. Not new; the redesign must preserve it.
- Copy: keep "Практика" as page title + "Карты / Люди" as the two tabs; drop the stray "Профили" column header.
- Right rail = calendar + events (Option A), NOT a per-person detail pane. The Option C detail-pane enrichment idea (charts list, connected persons/charts graph) is dropped for now with the switch to A; revisit only if a detail view is ever added.

## account-settings.html — sectioned restructure (decided)
Chosen nav pattern: **B · top tabs** (sections as horizontal tabs across the content), NOT a second left section-list — the persistent app sidebar already carries navigation, so a second left rail would be heavy double-chrome. Fixes the audit's three findings:
- **Everything-on-one-plane → grouped sections.** Real content only (no invented empty sections): **Настройки карты** (the dominant chart-config group, sub-grouped into Отображение / По типам карт / Форматы-adjacent) · **Форматы** · **Оплата и план** (the plan card — belongs under its OWN tab, not appended to the chart-settings tab) · **Аккаунт** (language, date-format, onboarding-reset — absorbs the content from the killed colored column). No Notifications section and no profile fields — those don't exist yet; not inventing empty sections.
- **Misaligned select/checkbox grids → one `.settings-row` pattern:** label left, control right, consistent 52px height, hairline dividers. Replaces the two mismatched `repeat(3,1fr)` grids.
- **Unclear save model → dirty-state save bar (decided):** Save/Отменить appear only when something changed; shows "✓ Сохранено" when clean. Chosen over pure autosave because saving can spawn an expensive methodology-recalc job, so autosaving on every toggle would fire those constantly.
- **The "huge empty colored column"** (`.account-settings-toolbar-note`, a ~320px beige panel holding two lines of text) is removed; its onboarding-reset moves into the Аккаунт tab.

## Flat visual treatment (decided 2026-07-13 — adopted everywhere)
Same navy/gold/parchment palette and Cormorant/DM Sans fonts, but a **flatter depth treatment**, adopted across all pages after the user preferred it in the Practice-page mockup. A deliberate, narrow refinement of *treatment* (not palette or type):
- **Solid fills, no gradients** — replace prod's gradient buttons (navy→blue) and gradient plan/CTA cards with flat solid fills. Flatten fully — no gradient even on special surfaces.
- **Soft, low-opacity neutral shadows** — replace prod's heavy colored drop-shadows (e.g. `0 10px 24px rgba(30,58,95,0.18)`) with the small neutral `--shadow-sm/md` tokens, so surfaces sit quietly instead of floating.
- **Hairline 1px borders** define surfaces, rather than leaning on shadow for separation.
- **Accent used sparingly** — fewer filled/accented elements competing, so navy means more (also nudges the audit's "accent overuse" without changing hex values).
This is the calm macOS/Things-3 feel from the original brief and answers the audit's "raw/heavy" + "accent overuse" findings via treatment, not color.

## Explicit exclusions (locked, out of scope this round)
- No hex/color-value changes anywhere, with one accessibility-driven exception: `--text-muted` (see "Accessibility fix" above) — every other value is untouched.
- No change to navy/gold accent hue or values (audit's "demote gold" recommendation — deferred; the flat treatment reduces accent *frequency* but not the colors themselves).
- No new typography family change. The flat depth treatment above IS an adopted refinement (the one deliberate exception to "no visual-direction change") — gradients/heavy shadows out, flat/soft in.
- Deleting/restyling the 3 conquest.css SEO pages, the 4 forecast views, and the natal chart progressive-disclosure rework are separate downstream tasks (page-by-page pass + design-shotgun directions) — this spec only lands the shared foundation they'll build on.

## DESIGN.md (new, decided)
No design-system reference file exists in the repo today — only `styles.css` itself. Per user decision, this stays documentation of the *existing* system, not a new consultation: a `DESIGN.md` codifying the current navy/gold/parchment palette, the Cormorant Garamond + DM Sans pairing, and this spec's new spacing/type tokens, so future work (and future sessions) calibrates against a written reference instead of re-deriving it from `styles.css` each time. Written as part of this spec's implementation, not a separate initiative.

## What already exists (reuse, don't reinvent)
- **`--density-space-{1..5}`** (4/6/8/10/12px) — existing compact in-app spacing tokens, kept for their specific job (control sizing), not replaced by the new `--space-*` scale.
- **Self-mounting injection pattern** (`locale-switcher.js`) — `app-sidebar.js` already follows this pattern (build DOM via innerHTML, insert once, retry until dependencies ready); the new Consultations nav item and any chrome fixes should keep using it, not introduce a second mounting approach.
- **`docs/mobile-ui-audit.md`** — an existing 43KB mobile-pattern audit; the deferred sidebar mobile-responsive spec should start from this rather than from scratch.
- **Well-written empty-state copy** — already present and good (confirmed: consultation insights, client-profile history/recordings, forecast timeline empty states) — needs a visual home (`.empty-state`), not new copy.

## Files most affected
| File | Change |
|---|---|
| `app/frontend/css/styles.css` | Add `--space-*` and `--font-size-*` tokens; add `.btn`/`.input`/`.card`/`.table-row`/`.settings-row`/`.empty-state`/`.dialog` shared classes |
| `app/frontend/css/app-sidebar.css`, `js/app-sidebar.js` | Extend nav items (add Consultations), confirm mount coverage across all authenticated pages |
| Every page's entry CSS (`entries-css/*.entry.css`, `css/{forecast-new,chart-layout,account-settings,natal-full}.css`) | Migrate off hand-typed spacing/font-size values and local `.btn`/table styles onto the shared tokens/components, one page at a time in the page-by-page pass (separate task, not part of this spec) |

## Acceptance criteria
1. `--space-*` and `--font-size-*` tokens exist in `styles.css` `:root` and are documented with a one-line comment on intended use each.
2. Shared `.btn`, `.input`, `.card`, `.table-row`, `.settings-row`, `.empty-state`, `.dialog` classes exist in `styles.css` and render correctly in isolation (spot-check via a scratch HTML page or Storybook-less visual check in the browser).
3. `app-sidebar.js` nav list includes Consultations as a 4th item, with an active-state test matching `/consultation` paths.
4. Exactly one color hex value changes in this pass: `--text-muted` from `#9B9289` to `#7A6F63` (verified 4.58:1 contrast), for accessibility. No other `#`-prefixed value changes in `styles.css` (verifiable via `git diff`).
5. No page regresses visually before this spec's changes are verified live via `/design-review` in the follow-up page-by-page task — this spec only adds new tokens/classes, it does not yet delete or rewrite existing per-page CSS.

## Effort estimate
- Spacing + type tokens in `styles.css`: ~30 min.
- Shared component classes (7 components): ~2-3 hours, mostly deciding on one canonical treatment per component by comparing the existing variants.
- App-chrome coverage audit + Consultations nav item: ~1 hour.
- Total: ~4-5 hours before the page-by-page migration pass begins.

## Implementation Tasks
Synthesized from this review's findings. Each task derives from a specific
finding above. Run with Claude Code or Codex; checkbox as you ship.

- [ ] **T1 (P1, human: ~30min / CC: ~5min)** — tokens — Add `--space-*` (4/8/12/16/24/32/48/64) and `--font-size-*` (12/14/16/20/28/40) tokens to `styles.css` `:root`
  - Surfaced by: Current state — 33 distinct spacing values, 32 distinct font-size values in use with no scale
  - Files: `app/frontend/css/styles.css`
  - Verify: grep for the new custom properties in the compiled CSS output
- [ ] **T2 (P1, human: ~2-3h / CC: ~30min)** — components — Add `.btn`(+variants)/`.input`/`.card`/`.table-row`/`.settings-row`/`.empty-state`/`.dialog` shared classes to `styles.css`
  - Surfaced by: Current state — 74 scattered `.btn` definitions, zero shared `.card`, 30 scattered table-row stylings
  - Files: `app/frontend/css/styles.css`
  - Verify: component sheet at the approved mockup renders correctly (see Approved Mockups below)
- [ ] **T3 (P1, human: ~5min / CC: ~2min)** — accessibility — Darken `--text-muted` from `#9B9289` to `#7A6F63`
  - Surfaced by: Pass 6 — measured 2.86:1 contrast, fails WCAG AA; verified `#7A6F63` at 4.58:1
  - Files: `app/frontend/css/styles.css`
  - Verify: contrast-check the new value against `--bg-primary` and `--bg-secondary`
- [ ] **T4 (P1, human: ~15min / CC: ~5min)** — app-chrome — Add Consultations as 4th nav item in `app-sidebar.js`, ordered Practice/Calendar/Consultations/Settings
  - Surfaced by: Pass 1 + audit's chrome proposal — consultation flow has no nav landing point today
  - Files: `app/frontend/js/app-sidebar.js`
  - Verify: active-state highlights correctly on `/consultation*` paths
- [ ] **T5 (P2, human: ~1h / CC: ~15min)** — app-chrome — Audit sidebar mount coverage across all authenticated pages; remove redundant top-bar destination pills where sidebar covers them
  - Surfaced by: Current state — audit's "two headers, no navigation" finding on the home screen
  - Files: all authenticated page HTML entries (clients/home, client-profile, natal-full/forecast-new×4, calendar, account-settings, consultation×3)
  - Verify: manual click-through, no duplicate nav destinations visible on any authenticated page
- [ ] **T6 (P2, human: ~1h / CC: ~15min)** — docs — Write `DESIGN.md` documenting the existing palette/type system + this spec's new tokens
  - Surfaced by: Pass 5 — no design-system reference file exists in the repo
  - Files: `DESIGN.md` (new)
  - Verify: file exists, covers palette/type/spacing/component list
- [ ] **T7 (P3, deferred — tracked in TODOS.md)** — components — Interaction-state matrix for the 7 shared components
- [ ] **T8 (P3, deferred — tracked in TODOS.md)** — app-chrome — Sidebar mobile-responsive behavior + dialog keyboard handling

## Out of scope (tracked separately)
- Migrating every page's CSS onto these tokens (task: "Design-review pass: simpler pages" + "Generate layout directions for 4 big-IA pages").
- Accent-color usage rebalancing (explicitly deferred by user).
- conquest.css SEO page restyle (part of the page-by-page pass, not deletion).

## Approved Mockups

| Screen/Section | Mockup Path | Direction | Notes |
|----------------|-------------|-----------|-------|
| Component system sheet | `/tmp/claude-0/-root-RNDastrobot-design/cf768161-cfd6-4046-8756-762827142fdc/scratchpad/component-sheet.html` (published: https://claude.ai/code/artifact/c438bf3f-d03a-4023-8c74-0ba8d5080d6e) | Real HTML/CSS built from existing tokens, no AI-generated approximation (gstack designer unavailable — no OpenAI key configured) | Approved as-is, including the empty-state icon-in-circle treatment (Pass 4 decision) |

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | not run |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | not run |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | not run |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 5/10 → 8/10, 8 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | not run |

- **VERDICT:** DESIGN CLEARED (8/10, 0 unresolved) — eng review required before implementation begins (shipping gate not yet run).

NO UNRESOLVED DECISIONS

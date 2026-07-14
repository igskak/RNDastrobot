# Steliara design/UX effort — orientation

Portable context for the pre-launch design/UX pass, so any Claude Code session (this Hetzner box, the web, or mobile) can pick up where we are. Read this first, then the linked plan.

## What this is
A pre-launch consistency + IA pass on steliara.com (live, beta users). Goal: make the product feel finished and pleasant via **consistency + information architecture + a flat visual treatment** — NOT a new aesthetic. Same navy/gold/parchment palette and Cormorant + DM Sans fonts.

## Where the detail lives
- **`docs/plans/design-system-foundation.md`** — the master plan. Every locked decision: spacing/type tokens, flat treatment, per-page layout directions (Practice, forecast-new, account settings, workspace home), the forecast-new top-bar design, component standardization. Passed `/plan-design-review` (5→8/10). **This is the source of truth.**
- **`docs/plans/landing-copy-rewrite.md`** — the leaner landing-page copy rewrite (RU), section by section.
- **`docs/design/memory/`** — key durable decisions (also mirrored in Claude Code local memory on the Hetzner box):
  - `design-ux-launch-scope.md` — scope locks (flat treatment adopted; no palette/font change).
  - `forecast-new-density-is-a-feature.md` — the wheel + all-panels-visible layout is expert-requested; never add progressive disclosure there.
  - `steliara-positioning-not-client-only.md` — avoid «клиент»; person/люди/профиль language; for all astrologers not just consulting ones.

## Locked design decisions (quick reference)
- **Flat treatment** (adopted everywhere): solid fills (no gradients), soft neutral shadows (not heavy colored drop-shadows), hairline borders, accent used sparingly. Same palette/fonts.
- **Tokens**: `--space-1..8` (4px scale) + `--font-size-caption..h1` (6-step) added to `styles.css`. Pages migrate onto them.
- **A11y**: `--text-muted` darkened `#9B9289 → #7A6F63` (WCAG AA).
- **App chrome**: burger slide-out nav (hidden by default), NOT a persistent sidebar; contains Practice · Calendar · Settings + language + login email + logout; NO Consultations page.
- **Practice page**: today panel (calendar + events); per-row ⋯ menu (rename/edit/delete, matches prod).
- **forecast-new top bar**: one row, three zones — left context (← Практика · name+birthdata), middle scrollable layer strip (moments visible inline as DD.MM.YYYY chips, × on hover), right controls (Вид ▾ · ⚙ Настройки карты · ▤ Панели). Synastry is partner-based. The dense data panels stay always-visible (see the density memory).
- **Account settings**: sectioned via top tabs (Настройки карты / Форматы / Оплата и план / Аккаунт); one settings-row pattern; dirty-state save bar.

## Workflow / operational notes
- **Prod auto-deploys from GitHub `main`.** Every push to main = live deploy to beta users. Small incremental pushes; rebase on latest `origin/main` first (partner Igor pushes frequently).
- **Coordinate with the partner (Igor)** before editing shared files — he actively edits `styles.css`, `login.html`, account settings, forecast/profile. Divide file ownership to avoid clobbering + double-deploys.
- **This Hetzner box** can run the app + screenshot for visual QA (`python3 -m http.server` in `app/frontend`, then the gstack browse binary). That preview loop is how design changes get verified page-by-page.
- **Build**: edit source CSS/JS → `cd app && npm run build:frontend` → commit source + rebuilt bundles. Deterministic; verified.
- **Rollout order**: foundation tokens (done) → simplest pages first (login → pricing → terms → calendar → consultation) → then the big structural pages.

## Status (as of this writing)
- Committed on the design branch: the plan docs; foundation tokens + a11y fix (bundles rebuilt).
- Login page flattened locally + verified via screenshot; not yet pushed (pending push creds + Igor coordination).

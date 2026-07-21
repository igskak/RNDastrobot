# Steliara design system

The written reference for how Steliara looks and is assembled. This documents the
**existing** navy/gold/parchment system plus the tokens and shared components added in
the `feat/design-ux` consistency pass — so any developer (or future session) calibrates
against this file instead of re-deriving it from `styles.css`.

Source of truth for values: `app/frontend/css/styles.css` (`:root`) and the shared kit
`app/frontend/css/design-kit.css`. If this doc and the CSS disagree, the CSS wins — fix
the doc.

> **Scope lock (launch pass):** no palette/hue changes, no accent rebalancing. This is a
> discipline pass on the existing language, not a new aesthetic. The one deliberate
> refinement is a **flatter depth treatment** (see below). The one accessibility-driven
> hex change is `--text-muted`.

---

## Palette

Warm navy / gold on a parchment ground. Do not introduce new hues.

| Token | Light | Role |
|---|---|---|
| `--accent` | `#1E3A5F` | Navy — primary actions, links, active accents |
| `--accent-hover` | (see styles.css) | Navy hover |
| `--accent-light` | `#E8F0F7` | Navy tint — focus rings, empty-state icon bg |
| gold | `#B8935A` | Secondary accent — kickers, hairline emphasis. Used sparingly |
| `--bg-primary` | `#F9F7F2` | Parchment page ground |
| `--bg-secondary` | `#FFFFFF` | Card / raised surface |
| `--bg-tertiary` | `#F0EDE4` | Sunken track (segmented control, wells) |
| `--text-primary` | `#1A1614` | Body ink |
| `--text-secondary` | `#4A4038` | Secondary ink |
| `--text-muted` | `#7A6F63` | Captions, table headers, hints. **Darkened from `#9B9289`** for WCAG AA (2.86:1 → 4.58:1) |
| `--success` | `#287A4B` | Positive state only |
| `--error` | `#B23232` | Danger actions / invalid |

**Accent discipline:** navy fill means **"act"** (primary buttons). Selection among
equals is *not* a navy fill — it's the light-pill segmented control (below). Keeping
these distinct is why the accent still reads as meaningful.

---

## Type

Two families. **Cormorant Garamond** (`--font-display`) for display headings only;
**DM Sans** (`--font-ui`) for everything at h3 and below, including small UI labels.

**Rule:** `--font-display` only ever pairs with `--font-size-h1` or `--font-size-h2`.
Never set serif at label/caption sizes.

| Token | Size | Use |
|---|---|---|
| `--font-size-h1` | 40px | Hero / page display (serif) |
| `--font-size-h2` | 28px | Section headings (serif) |
| `--font-size-h3` | 20px | Sub-headings, dialog titles (sans) |
| `--font-size-body` | 16px | Body copy, inputs (sans) |
| `--font-size-label` | 14px | UI labels, buttons, table cells (sans) |
| `--font-size-caption` | 12px | Captions, table headers, hints (sans) |

No hand-typed `font-size` outside this scale. (Prod had 32 distinct sizes incl.
sub-pixel deltas like 12.5px — those get remapped to the nearest step as pages are touched.)

---

## Spacing

One 4px-based scale for margins/padding/gaps.

| Token | Value | | Token | Value |
|---|---|---|---|---|
| `--space-1` | 4px | | `--space-5` | 24px |
| `--space-2` | 8px | | `--space-6` | 32px |
| `--space-3` | 12px | | `--space-7` | 48px |
| `--space-4` | 16px | | `--space-8` | 64px |

**Rule:** no new hand-typed spacing px outside this scale. The existing
`--density-space-{1..5}` (4/6/8/10/12px) tokens stay for their specific job — compact
in-app control sizing — and are *not* replaced by `--space-*`.

Lay out sibling groups with flex/grid + `gap`, not per-element margins.

---

## Depth — flat treatment (adopted `feat/design-ux`)

Same palette and fonts, flatter depth. Applied across all pages:

- **Solid fills, no gradients.** Replace prod's navy→blue gradient buttons and gradient
  plan/CTA cards with flat solid fills. Flat even on special surfaces.
- **Soft neutral shadows** (`--shadow-sm` / `--shadow-md`), not heavy colored
  drop-shadows. Surfaces sit quietly, not floating.
- **Hairline 1px borders** (`--border`) define surfaces, rather than leaning on shadow.
- **Accent used sparingly** — fewer filled elements competing, so navy means more.

The calm macOS / Things-3 feel: quiet surfaces, clear hierarchy, restraint.

---

## Shared components — the UI kit

Canonical building blocks live in `app/frontend/css/design-kit.css`, namespaced `.ui-*`
so they coexist with existing scattered classes (adding the file changes nothing until an
element opts in). Live reference: **`/styleguide.html`**.

| Component | Class | Notes |
|---|---|---|
| Button | `.ui-btn` + `--primary` / `--secondary` / `--ghost` / `--danger`, `--sm` / `--block` | One height per size. Navy fill = primary action |
| Segmented control | `.ui-segmented` + `.ui-segmented__item` | "One selected among equals" — date presets, view switchers, toggles. Active = light pill on tinted track via `.is-selected` / `[aria-selected]` / `[aria-pressed]`. **Not** a navy fill. Keep JS-hook classes (e.g. `.preset-btn`) alongside |
| Input | `.ui-input` (+ `.ui-field` / `.ui-label`) | One text/number/select treatment, visible label, focus ring |
| Card | `.ui-card` | One surface — bg + hairline border + `--shadow-sm` + padding |
| Table | `.ui-table` (+ `.ui-table--rows` for hover) | Contacts-style rows, uppercase muted headers, hairline dividers |
| Settings row | `.ui-settings-row` (+ `__label` / `__hint`) | Label left, control right, 52px min height |
| Toggle | `.ui-toggle` | `[aria-checked]` switch |
| Empty state | `.ui-empty-state` (+ `__icon` / `__title` / `__text`) | Icon-in-tinted-circle + title + copy + CTA slot |
| Dialog | `.ui-dialog` (+ `-backdrop` / `__title` / `__body` / `__actions`) | One modal shell |

**Rule:** reach for a `.ui-*` class before hand-rolling. Prod had 74 scattered `.btn`
redefinitions and zero shared `.card` — the kit exists to end that.

---

## App chrome — burger nav

Authenticated pages share one slide-out nav (`app/frontend/css/app-nav.css` +
`js/app-nav.js`), self-mounting via the `locale-switcher.js` injection pattern.

- **Hidden by default**, slides out on a burger button that sits **on the same level as
  page content** (sticky top bar, not a floating overlay), dismisses on overlay / esc /
  click-away.
- **Contents:** Practice · Calendar · Settings, plus — moved out of page headers — the
  **language switcher**, **account email**, and **logout**.
- Replaces the old per-page top-bar pills. No Consultations item (no such page yet).
- `app-nav.css` / `app-nav.js` are versioned by the build's asset-hash pass — reference
  them with `?v=` so cache-busting works (they're served `immutable`, 1yr).

---

## Build & deploy

- Static frontend (HTML + page CSS/JS) bundled via esbuild:
  `cd app && npm run build:frontend`. Bundles land in `app/frontend/bundles/` +
  `js/bundles/`; asset markers get `?v=<hash>` so caches update.
- `design-kit.css` is `@import`ed into `styles.css` → into every bundle, so a kit change
  requires a rebuild (and re-touches every bundle/HTML hash).
- Prod auto-deploys from GitHub **`main`** on push (~90s–4min). Work on `feat/design-ux`,
  land to `main`.
- Two developers work in parallel via this shared kit — prefer the kit's enforced classes
  over per-page conventions. Coordinate before changing `design-kit.css` / `styles.css`
  tokens.

---

## Locked constraints (do not "fix")

- **forecast-new.html density is a feature.** Astrologers explicitly asked for the wheel
  + all data panels on one screen, no clicks to reveal data. **Never** add drawers, tabs
  that hide, or progressive disclosure there. Improve *display discipline* (alignment,
  spacing, type, glyph legibility) only.
- **Positioning language:** avoid «клиент». Use person / люди / профиль — the product is
  for all astrologers, not only consulting ones.
- **Palette/hue is locked.** Only `--text-muted` changed (accessibility). No other hex
  moves in this pass.

---

## References

- Master plan: `docs/plans/design-system-foundation.md`
- Landing copy rewrite: `docs/plans/landing-copy-rewrite.md`
- Living kit: `app/frontend/styleguide.html` → `/styleguide.html`
- Mobile patterns: `docs/mobile-ui-audit.md`

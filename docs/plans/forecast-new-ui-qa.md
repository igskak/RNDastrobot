# TODO: Full UI QA + analysis + critique — forecast-new (power surface)

Status: BACKLOG (captured 2026-07-23, requested by Igor S.)
Scope owner: design-ux
Related: [[design-system-foundation]] (forecast-new density is locked — this QA improves *discipline*, never removes the wheel+all-data-on-one-screen surface).

## Ask
Exhaustively exercise and critique the forecast-new UI: **every widget, every option, every button, in all realistic combinations** — then produce a QA + design analysis + critique. Not a light pass; a full sweep of the app's most complex surface.

## Why
It's the craft that now leads the launch landing hero (see the office-hours design doc: `~/.gstack/projects/igskak-RNDastrobot/root-feat-design-ux-design-20260723-083808.md`, Approach A). If it's the thing we sell, it must be tight — and we've only ever touched it as a light consistency pass, never QA'd the full state space.

## Coverage checklist (to expand when we run it)
- **Layer toggles:** Transits · Progressions · Directions · Solar return · Synastry — each on/off, and combinations (multi-layer). Verify per-layer instance chips (add/remove moments, partners for synastry, Композит).
- **View switcher (Вид):** Колесо / Натальные таблицы / Таблицы прогноза / Таймлайн — including which are multi-wheel-only (hidden in single).
- **Wheel controls:** single vs multi wheel, swap (starts disabled), zoom +/−, settings gear — all states.
- **Left/right panels:** Planets / Houses / Aspects tabs; D/A checkboxes; the panel editor («Панели») — add/remove/move blocks, presets, reset, undo; overflow behavior.
- **Chart settings** («Настройки карты»): zodiac, ayanamsha, aspect scope, icon size, house system — each option's effect.
- **Identity block:** full birth data + date-format preference honoring; ← Практика back nav.
- **Chat + voice** buttons (ask-answer / ask-show) — note first-iteration roughness (per office-hours D5).
- **Empty / edge states:** no aspects, long names, extreme dates, many active layers (horizontal scroll of the middle zone), timezone edge cases.
- **Responsive / mobile** behavior.

## Deliverable
A QA report (bugs + state issues) + a design critique (hierarchy, where the eye lands, alignment, the floating angles readout, spacing/type discipline against DESIGN.md) + a prioritized fix list. Candidate: run via `/qa` (behavior) + `/design-review` (visual) once we pick this up.

## First observations (from the 2026-07-23 hero screenshot, not a full pass)
- No single landing point for the eye — three dense panels at equal contrast hit at once.
- Top-left angles readout (Ascendant/Descendant/MC/IC/Vertex/Anti-Vertex) floats a bit unstyled next to the polished wheel.
- Example person is "John Smith / New York" (EN) — product UI language vs RU landing audience (matters for hero asset, not for the app itself).

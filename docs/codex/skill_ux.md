# skill_ux

## Purpose
Create UX spec for frontend/API-facing behavior.

## Inputs
- PRD + Architecture Note.
- Target pages/components in `app/frontend`.
- Locale and i18n constraints.

## Outputs
- UX spec with: user flow, loading/empty/error states, a11y checklist, microcopy keys.

## Procedure
1. Define primary user flow and entry points.
2. Define UI states: loading, empty, error, success.
3. Define microcopy keys and i18n impact. For astrology objects, default to icon-only presentation with the name shown via hover/tooltip instead of inline labels unless the view is explicitly textual.
4. Define a11y requirements (keyboard, focus, semantics, aria labels).
5. Define telemetry/diagnostics if needed.
6. Produce acceptance checklist for QA.

## How To Invoke In Codex App
`Используй docs/codex/skill_ux.md и сформируй UX spec для фичи: <описание>.`

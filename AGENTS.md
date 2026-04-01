# AGENTS.md

## Project Scope
This repository contains a mixed stack:
- Native layer: Swiss Ephemeris C library (`swisseph/`) and C binaries (`app/src/`, `make all`).
- Backend layer: FastAPI + SQLAlchemy in `app/api`, `app/services`, `app/database`, `app/models`.
- Frontend layer: static HTML/CSS/JS in `app/frontend` with esbuild bundling.

## Setup and Run
Install (from repo root):
- `python3 -m venv .venv && . .venv/bin/activate`
- `pip install -r app/requirements.txt`
- `npm ci --prefix app`

Run locally:
- `bash app/start_api.sh`

Build:
- `make all`
- `npm --prefix app run build:frontend`

## Source Of Truth Verification
Mandatory (Definition of Done):
- `make all`
- `make test` (on macOS command is a no-op with explicit skip message; on Linux runs `setest`)
- `npm --prefix app run build:frontend`
- `node app/scripts/check-i18n-missing-keys.cjs`
- `node app/scripts/check-i18n-hardcoded-strings.cjs`
- `node app/scripts/check-i18n-untranslated-values.cjs`
- `node --test app/tests/test_i18n_missing_keys_checker.test.cjs app/tests/test_i18n_hardcoded_strings_checker.test.cjs app/tests/test_i18n_untranslated_values_checker.test.cjs app/tests/test_i18n_ci_wiring.test.cjs`
- `node --test app/tests/test_frontend_i18n.test.cjs app/tests/test_frontend_i18n_ui.test.cjs app/tests/test_frontend_api_client.test.cjs app/tests/test_frontend_timezones.test.cjs app/tests/test_forecast_timeline_utils.test.cjs`
- `flake8 app/utils/ephemeris.py app/i18n/context.py app/i18n/errors.py --count`
- `mypy --follow-imports=skip app/utils/ephemeris.py app/i18n/context.py app/i18n/errors.py`
- `python -m pytest -q app/tests`

Non-gating for now (track as TODO):
- Global `flake8` and global `mypy` (baseline not clean yet).

## Dependency Rules
- Python dependencies: update only `app/requirements.txt`, pin versions.
- Node dependencies: update only `app/package.json` + `app/package-lock.json`.
- Do not add parallel libraries for the same concern without removing old usage.
- Any new dependency must be justified in PR description (why built-in/current stack is insufficient).

## Architecture Boundaries
- `app/api/routes/*`: HTTP contract, validation, response mapping; no business calculations.
- `app/services/*`: business/domain logic.
- `app/database/*`: persistence, schema, migrations, repositories.
- `app/models/*`: request/response/domain schemas.
- `app/frontend/*`: UI only; backend logic must not be duplicated here.
- Avoid circular imports between `api`, `services`, and `database`.

## Database and Migrations
- Add schema changes via new SQL file in `app/database/migrations/` (numbered prefix, immutable).
- Keep migrations forward-only by default; if rollback is required, add explicit paired down migration.
- Reference data updates go to `app/database/seeds/`.
- For DB-related changes, include migration file + test/update coverage in the same PR.

## Logging and Error Handling
- Use `loguru`/standard logging; no `print()` in API/services.
- Keep API errors compatible with centralized handlers in `app/api/error_handlers.py`.
- Do not leak secrets/tokens/PII in logs.

## UX, i18n, a11y
- No hardcoded user-facing strings in frontend/backend responses; use i18n catalogs and existing checkers.
- For every new async UI flow, define and implement states: loading, empty, error.
- Ensure keyboard focus is visible and interactive elements are semantic (`button`, `label`, `aria-*` when needed).
- Default UI convention for astrology objects: render the icon without inline text label; reveal the object name on hover/tooltip instead of placing text next to the icon unless the screen explicitly requires a textual list/table view.

## Delivery Workflow
- Split feature work into small PRs: contract -> data -> logic -> UI -> tests.
- Run mandatory verification before asking for review.
- Run `codex review` (or `/review` in app) as a separate quality gate before merge.

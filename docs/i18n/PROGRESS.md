# I18N Progress Tracker

## Stage Status
- [x] BL-00 Plan and Tracking
- [x] BL-01 SQL Foundation
- [x] BL-02 API Locale Plumbing
- [x] BL-03 Frontend I18N Core
- [x] BL-04 UI Migration
- [x] BL-05 AI and Interpretations
- [x] BL-06 CI, Hardening, Cleanup

## Current Stage
- Current: `BL-06 (completed)`
- Owner: `Codex`
- Updated at: `2026-02-18`

## BL-00 Checklist
- [x] `docs/i18n/MASTER_PLAN.md` created
- [x] `docs/i18n/PROGRESS.md` created
- [x] `docs/i18n/DECISIONS.md` created
- [x] Locales fixed: `en`, `uk`, `ru`
- [x] Default/fallback fixed: `en`
- [x] Stage order BL-01..BL-06 fixed

## BL-01 Checklist (SQL Foundation)
- [x] Define `*_i18n` table set for localizable reference entities
- [x] Add `(entity, locale)` unique constraints
- [x] Add lookup indexes for `locale` and entity foreign keys
- [x] Add `locale` dimension to interpretation cache model/table
- [x] Create data migration RU/EN -> i18n tables
- [x] Verify migration up/down and backward compatibility

DoD:
- [x] Schema and migration scripts merged
- [x] Existing API use cases still functional
- [x] Test query paths support fallback to `en`

## BL-02 Checklist (API Locale Plumbing)
- [x] Implement locale resolver by policy chain
- [x] Add locale to request context and service calls
- [x] Introduce error contract: `error_code` + localized `message`
- [x] Localize existing route-level user-facing error texts
- [x] Add tests for `en`/`uk`/`ru` + fallback

DoD:
- [x] API responses are locale-aware
- [x] Missing translation resolves via `en`
- [x] Contract tests pass for all 3 locales

## BL-03 Checklist (Frontend I18N Core)
- [x] Implement i18n runtime (`t`, `setLocale`, loaders)
- [x] Add locale catalogs (`en`, `uk`, `ru`)
- [x] Add language switcher UI
- [x] Persist user locale
- [x] Wire `html lang` and `Intl` formatters to active locale

DoD:
- [x] Base screens switch locale correctly
- [x] No runtime failures when key is missing (fallback path works)
- [x] Locale persistence survives page reload

## BL-04 Checklist (UI Migration)
- [x] Migrate priority pages/components to key-based strings
- [x] Remove hardcoded locale usage in geocoding/autocomplete/date format
- [x] Replace domain label literals with i18n dictionary lookups
- [x] Run smoke checks for `en`/`uk`/`ru`

DoD:
- [x] Target UI surfaces contain no hardcoded user-facing strings in migrated BL-04 surfaces
- [x] Priority frontend i18n smoke/tests pass for 3 locales and fallback scenarios

## BL-05 Checklist (AI and Interpretations)
- [x] Remove forced RU response policy
- [x] Inject locale into prompt building logic
- [x] Fetch localized reference texts with `en` fallback
- [x] Ensure interpretation cache is locale-aware
- [x] Add locale-specific AI tests

DoD:
- [x] AI output language matches requested locale
- [x] Cache does not mix results between locales
- [x] Missing localized source text falls back to `en`

## BL-06 Checklist (CI, Hardening, Cleanup)
- [x] Add missing-key checker (`en` as baseline)
- [x] Add hardcoded-string checker for user-facing texts
- [x] Wire checks into CI pipeline
- [x] Add runtime logging for missing translation keys
- [x] Remove legacy i18n hardcodes or track explicit debt items

DoD:
- [x] CI blocks i18n regressions
- [x] Runtime diagnostics exist for missing keys
- [x] Legacy hardcodes are eliminated from migrated areas

## Change Log
### 2026-02-18
- Stage: `BL-00`
- Completed:
  - Created plan/tracking/decision artifacts in `docs/i18n`
  - Fixed locales `en`, `uk`, `ru`
  - Fixed default/fallback `en`
  - Recorded BL-01..BL-06 checklists and DoD
- Validation:
  - Files created and checked in working tree
- Risks/Blockers:
  - None for BL-00
- Next Stage:
  - `BL-01 SQL Foundation`

### 2026-02-18
- Stage: `BL-01`
- Completed:
  - Added BL-01 migrations:
    - `app/database/migrations/017_bl01_i18n_foundation_up.sql`
    - `app/database/migrations/017_bl01_i18n_foundation_down.sql`
  - Added `*_i18n` tables for localizable `ref_*` dictionaries with locale policy (`en`/`uk`/`ru`) and `(entity, locale)` PK uniqueness
  - Added locale and entity lookup indexes for new i18n tables
  - Added `locale` dimension to interpretation cache tables (`natal_interpretations`, `prognostic_interpretations`)
  - Migrated current RU/EN reference texts into `*_i18n` tables with fallback-safe `en` rows
  - Preserved backward compatibility for existing interpretation endpoints (default locale `en`)
- Validation:
  - Up/down SQL migration pair executed in isolated DB schema (`up -> down -> up`): PASS
  - ORM model updated to match schema changes for interpretation caches
- Risks/Blockers:
  - Locale detection in migration is heuristic (marker-based for `uk`/`ru`); ambiguous Cyrillic-only rows can still require manual review
  - `uk` rows are intentionally not auto-generated; they must be filled by translation pipeline in later stages
- Next Stage:
  - `BL-02 API Locale Plumbing`

### 2026-02-18
- Stage: `BL-02`
- Completed:
  - Added centralized locale utilities and request context:
    - `app/i18n/locale.py`
    - `app/i18n/context.py`
    - `app/api/locale_dependency.py`
  - Implemented locale resolution chain by ADR-002 (`user preference -> explicit query/header -> Accept-Language -> en`)
  - Added centralized localized API error contract:
    - `app/i18n/errors.py`
    - `app/api/error_handlers.py`
    - Global handlers wired in `app/api/main.py`
  - Updated API error schema contract to `error_code + message (+ detail)` with legacy `error` alias in `app/models/schemas.py`
  - Propagated locale into service layer for interpretation/chat calls and interpretation cache key lookup (`app/api/routes/interpretations.py`, `app/api/routes/chat.py`, `app/services/openai_service.py`)
  - Added locale-aware localized reference lookup with fallback to `en` through `*_i18n` tables (and safe fallback to base tables when i18n tables/columns are absent):
    - `app/i18n/reference_lookup.py`
    - Applied for `ref_planet_psych_functions` and `ref_sign_properties` reads in OpenAI context preparation
  - Added API tests for resolver priority, fallback, error contract and backward-compat smoke:
    - `app/tests/test_api_i18n.py`
- Validation:
  - New tests passed: `./.venv/bin/python -m pytest -q app/tests/test_api_i18n.py` (6 passed)
  - Syntax check passed: `python3 -m compileall app/api app/i18n app/services/openai_service.py app/models/schemas.py app/tests/test_api_i18n.py`
- Risks/Blockers:
  - User preference locale is read in best-effort mode from optional `users` locale columns (`preferred_locale|locale|language|lang`); if none exist, chain falls back to explicit request/Accept-Language/default `en`
  - Detailed domain-specific error code mapping is currently substring-based for legacy `detail` strings; moving endpoints to explicit `error_code` raises will make mapping stricter in subsequent stages
- Next Stage:
  - `BL-03 Frontend I18N Core`

### 2026-02-18
- Stage: `BL-03`
- Completed:
  - Added frontend i18n runtime and helpers:
    - `app/frontend/js/i18n.js` (`t`, `setLocale`, `getLocale`, locale source resolver, persistence, fallback `en`, missing-key warnings)
    - `app/frontend/js/locale-formatters.js` (shared `Intl.DateTimeFormat`/`Intl.NumberFormat`/`Intl.Collator` by active locale)
    - `app/frontend/js/locale-switcher.js` (global language switcher UI with persistence)
  - Added locale catalogs:
    - `app/frontend/locales/en.json`
    - `app/frontend/locales/uk.json`
    - `app/frontend/locales/ru.json`
  - Bound document language to active locale (`html lang`) and switched default page markup to fallback-safe `en`
  - Removed frontend core locale hardcodes in bootstrap/service paths:
    - Replaced fixed `ru` in geocoding autocomplete (`form.js`, `forecast.js`, `place-autocomplete.js`)
    - Replaced fixed locale formatting/collation (`clients.js`) with shared locale-aware `Intl` helper
    - Added locale headers propagation (`Accept-Language` + `X-Locale`) in frontend API calls (`api.js`, `forecast.js`, `clients.js`, `interpretations.js`, `chat.js`, `chatkit-init.js`)
  - Preserved backward compatibility in API client error parsing (`message` + legacy `detail`)
- Validation:
  - `node --test app/tests/test_frontend_i18n.test.cjs app/tests/test_frontend_api_client.test.cjs app/tests/test_forecast_timeline_utils.test.cjs` (10 passed)
  - `./.venv/bin/python -m pytest -q app/tests/test_api_i18n.py` (6 passed)
- Risks/Blockers:
  - Full UI text migration to i18n keys is intentionally deferred to BL-04; current switcher immediately affects runtime locale, request locale headers, and shared formatters, but not all static page literals yet
  - Locale catalogs are now loaded from `locales/*.json` with safe built-in fallback; malformed/missing keys are tolerated with warning + fallback `en`
- Next Stage:
  - `BL-04 UI Migration`

### 2026-02-18
- Stage: `BL-04`
- Completed:
  - Migrated priority UI surfaces to key-based i18n:
    - `app/frontend/index.html`
    - `app/frontend/chart.html`
    - `app/frontend/forecast.html`
    - `app/frontend/clients.html`
    - `app/frontend/interpretations.html`
    - `app/frontend/natal-full.html`
  - Added shared DOM i18n binder for initial render + locale-change re-apply:
    - `app/frontend/js/i18n-ui.js`
  - Removed hardcoded locale-dependent display strings from migrated UI JS modules (labels/messages/tooltips/empty states) and wired locale-change re-render paths where needed:
    - `app/frontend/js/form.js`
    - `app/frontend/js/clients.js`
    - `app/frontend/js/interpretations.js`
    - `app/frontend/js/chart.js`
    - `app/frontend/js/chart-data.js`
    - `app/frontend/js/chart-layout.js`
    - `app/frontend/js/chart-wheel.js`
    - `app/frontend/js/forecast.js`
    - `app/frontend/js/forecast-timeline.js`
    - `app/frontend/js/forecast-biwheel.js`
    - `app/frontend/js/chatkit-init.js`
    - `app/frontend/js/natal-full.js`
  - Expanded locale catalogs with BL-04 key coverage (`en` baseline + `uk`/`ru`) including dynamic `astro.*` dictionaries:
    - `app/frontend/locales/en.json`
    - `app/frontend/locales/uk.json`
    - `app/frontend/locales/ru.json`
  - Added frontend UI i18n tests for initial render, locale switch reaction, and fallback safety:
    - `app/tests/test_frontend_i18n_ui.test.cjs`
- Validation:
  - `node --test app/tests/test_frontend_i18n.test.cjs app/tests/test_frontend_i18n_ui.test.cjs app/tests/test_frontend_api_client.test.cjs app/tests/test_forecast_timeline_utils.test.cjs` (13 passed)
  - Verified key coverage for extracted BL-04 frontend key usage: `en/uk/ru` missing keys = `0`
- Risks/Blockers:
  - `uk`/`ru` catalogs are now key-complete, but part of non-critical long-form copy remains English and should be refined in later localization QA pass
  - No behavioral changes were made to astrology calculation logic; only UI/i18n layer was touched
- Next Stage:
  - `BL-05 AI and Interpretations`

### 2026-02-18
- Stage: `BL-05`
- Completed:
  - Removed forced RU policy in AI backend prompts (`app/services/openai_service.py`):
    - replaced hardcoded instruction `Отвечай на русском языке...` with locale-aware rule tied to request locale
  - Added unified locale normalization/fallback (`en`) for AI generation/session paths:
    - `generate_psychological_profile`
    - `prognostic_chat`
    - `create_chatkit_session`
    - `build_planet_sign_psych`
  - Made locale propagation explicit end-to-end for prompt/session building in natal/prognostic scenarios:
    - `prognostic_chat` always includes developer locale instructions in the first request payload (including follow-up calls with `previous_response_id`)
    - `create_chatkit_session` now explicitly passes resolved locale into reference lookup preparation (`build_planet_sign_psych(..., locale=...)`)
  - Enforced strict i18n reference lookup fallback semantics for AI:
    - `requested locale -> en` in `app/i18n/reference_lookup.py`
    - removed fallback to base table value when `*_i18n` lookup path is available (prevents implicit RU fallback)
  - Added BL-05 backend tests:
    - `app/tests/test_ai_i18n_bl05.py`
    - Covers locale-aware prompt variables (`en`/`uk`), no forced RU in prognostic prompt path, explicit locale propagation into ChatKit/reference lookup, reference-data fallback to `en`, no RU fallback when `en` missing, and locale-isolated interpretation cache behavior
- Validation:
  - `./.venv/bin/python -m pytest -q app/tests/test_ai_i18n_bl05.py app/tests/test_api_i18n.py` (12 passed)
- Risks/Blockers:
  - `prognostic_interpretations` DB cache model remains not wired to active API flow (separate functional backlog), but locale-aware constraints/indexes and BL-05 locale generation path are in place
- Next Stage:
  - `BL-06 CI, Hardening, Cleanup`

### 2026-02-18
- Stage: `BL-06`
- Completed:
  - Added frontend locale completeness checker (`en` baseline):
    - `app/scripts/check-i18n-missing-keys.cjs`
    - checks `app/frontend/locales/uk.json` and `app/frontend/locales/ru.json` against `app/frontend/locales/en.json`
    - fails on missing keys and type mismatches
  - Added hardcoded user-facing string checker for BL-04 frontend priority surfaces:
    - `app/scripts/check-i18n-hardcoded-strings.cjs`
    - scans migrated BL-04 HTML/JS files and fails on direct hardcoded UI literals in UI sinks/HTML text/critical attributes
    - supports focused allowlist entries for objectively justified exceptions
  - Wired both checkers into CI pipeline with fail-fast order:
    - `.github/workflows/ci.yml` runs missing-key checker and hardcoded-string checker before regression tests
    - added CI wiring guard test: `app/tests/test_i18n_ci_wiring.test.cjs`
  - Added checker unit tests (pass/fail):
    - `app/tests/test_i18n_missing_keys_checker.test.cjs`
    - `app/tests/test_i18n_hardcoded_strings_checker.test.cjs`
  - Strengthened runtime diagnostics for missing translations in frontend i18n runtime:
    - `app/frontend/js/i18n.js` now emits warning + diagnostics callback (`onMissing`) + `frontend:i18n-missing` event while preserving fallback-safe behavior (`en`)
    - extended test coverage in `app/tests/test_frontend_i18n.test.cjs`
  - Performed point cleanup in migrated UI:
    - replaced legacy hardcoded `N/A` fallback in `app/frontend/js/interpretations.js` with `t('common.notAvailable')`
- Validation:
  - Checkers:
    - `node app/scripts/check-i18n-missing-keys.cjs` -> PASS
    - `node app/scripts/check-i18n-hardcoded-strings.cjs` -> PASS
  - Node tests:
    - `node --test app/tests/test_i18n_missing_keys_checker.test.cjs app/tests/test_i18n_hardcoded_strings_checker.test.cjs app/tests/test_i18n_ci_wiring.test.cjs app/tests/test_frontend_i18n.test.cjs app/tests/test_frontend_i18n_ui.test.cjs app/tests/test_frontend_api_client.test.cjs app/tests/test_forecast_timeline_utils.test.cjs` -> 20 passed
  - Python tests (BL-05/API i18n regression):
    - `./.venv/bin/python -m pytest -q app/tests/test_api_i18n.py app/tests/test_ai_i18n_bl05.py` -> 12 passed
- Risks/Blockers:
  - TODO(owner: frontend, date: 2026-02-18): normalize remaining non-user-facing RU developer log strings in `app/frontend/js/chatkit-init.js`; postponed intentionally to avoid broad non-functional churn outside BL-06 scope.
- Next Stage:
  - Initiative i18n BL-00..BL-06 closed; continue with routine localization QA and translation quality refinement backlog.

### 2026-02-18
- Stage: `BL-01 hotfix`
- Completed:
  - Fixed BL-01 locale detector in `app/database/migrations/017_bl01_i18n_foundation_up.sql`:
    - explicit `uk` markers (`ІіЇїЄєҐґ`) are now detected before `ru`
    - explicit `ru` markers (`ЁёЪъЫыЭэ`) preserved
    - generic Cyrillic fallback remains `ru` for backward compatibility of historical RU/EN seeds
  - Added corrective migration for already migrated databases:
    - `app/database/migrations/018_bl01_fix_uk_ru_locale_mapping.sql`
    - reclassifies clearly Ukrainian rows from `ru` -> `uk` in `*_i18n` tables where `uk` row does not already exist
- Validation:
  - SQL files reviewed for all BL-01 `*_i18n` reference tables and optional `ref_planet_role_weights_i18n` handling
- Risks/Blockers:
  - Ambiguous Cyrillic rows without language-specific markers may still need explicit locale mapping pipeline/manual curation.

### 2026-02-18
- Stage: `BL-01 hotfix (locale QA hardening)`
- Completed:
  - Upgraded locale correction classifier in `app/database/migrations/018_bl01_fix_uk_ru_locale_mapping.sql`:
    - replaced single-letter heuristic with score-based detector (`_bl01_detect_locale_v3`)
    - added lexical marker dictionaries for `uk`/`ru`
    - introduced explicit `ambiguous_cyrillic` classification (no auto-flip for uncertain rows)
  - Added manual QA report script:
    - `app/scripts/qa-i18n-locale-mapping.py`
    - scans all `ref_*_i18n` tables with `locale='ru'`
    - reports `uk` candidates and ambiguous rows to JSON (`app/reports/i18n_locale_mapping_qa.json`)
- Validation:
  - Isolated DB execution of migration `018_bl01_fix_uk_ru_locale_mapping.sql`: PASS
  - QA script run result: scanned 20 tables, 54 RU rows, 10 ambiguous rows reported for manual review
- Risks/Blockers:
  - Dictionary-based detection remains probabilistic; final classification for ambiguous rows requires human QA or explicit curation map.

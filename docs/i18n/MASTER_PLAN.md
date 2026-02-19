# I18N Master Plan (en/uk/ru)

## 1. Goal
Implement internationalization with support for:
- `en` (default and fallback)
- `uk`
- `ru`

Coverage:
- Frontend UI texts
- Backend API error messages
- AI/LLM responses and interpretation texts
- Localizable reference data from DB

## 2. Core Rules
1. Canonical system language is `en`.
2. Missing translation fallback is always `en`.
3. Locale resolution order:
   1. User preference (profile/settings)
   2. Explicit request locale (query/header)
   3. `Accept-Language`
   4. `en`
4. Translation keys are stable IDs and must not depend on localized text.
5. New user-facing hardcoded strings are not allowed outside i18n catalogs/backend i18n dictionaries.

## 3. Architecture Principles
1. Frontend: key-based i18n runtime (`t(key, params)`, `setLocale(locale)`).
2. Backend: locale-aware request context + stable `error_code` + localized `message`.
3. DB: localized reference texts stored in dedicated `*_i18n` tables with `(entity, locale)` uniqueness.
4. AI: locale included in prompt policy, content retrieval, and cache keys.

## 4. Execution Stages

### BL-00 Plan and Tracking
Scope:
- Create and maintain planning artifacts in `docs/i18n`.

DoD:
- `MASTER_PLAN.md`, `PROGRESS.md`, `DECISIONS.md` created and aligned.
- Locales and fallback policy fixed (`en`, `uk`, `ru`; fallback `en`).
- Stage order BL-01..BL-06 fixed.

### BL-01 SQL Foundation
Scope:
- Add i18n-ready DB structures and migrate existing localizable reference data.
- Add `locale` dimension for interpretation cache.

DoD:
- New `*_i18n` tables and indexes created.
- Uniqueness by `(entity, locale)` implemented.
- Data migration for current RU/EN content completed.
- Migrations pass up/down.
- Existing API behavior preserved.

### BL-02 API Locale Plumbing
Scope:
- Implement locale resolver and propagate locale through API/service layers.
- Introduce structured localized errors.

DoD:
- Locale resolver works by agreed priority chain.
- `error_code` + localized `message` available in API errors.
- Fallback to `en` works for missing messages.
- API tests cover `en`, `uk`, `ru`.

### BL-03 Frontend I18N Core
Scope:
- Introduce frontend i18n runtime and locale catalogs.
- Add language switch and locale persistence.

DoD:
- `t(...)` and locale loading work in browser runtime.
- `locales/en.json`, `locales/uk.json`, `locales/ru.json` created.
- Language switcher works and persists user choice.
- `html lang` and `Intl.*` formatters use active locale.

### BL-04 UI Migration
Scope:
- Move user-facing strings from HTML/JS into i18n keys and catalogs.
- Replace locale hardcodes in geocoding/date/sorting/display logic.

DoD:
- Priority screens migrated and language switch validated.
- Target files have no hardcoded user-facing RU/UK/EN strings.
- UI smoke checks pass for `en`, `uk`, `ru`.

### BL-05 AI and Interpretations
Scope:
- Make AI generation and interpretation retrieval locale-aware.
- Include locale in interpretation cache key semantics.

DoD:
- AI answers follow requested locale (`en`/`uk`/`ru`).
- Localized reference texts used with fallback to `en`.
- Cache entries are locale-isolated.

### BL-06 CI, Hardening, Cleanup
Scope:
- Add automated checks for i18n completeness and regressions.
- Remove legacy hardcoded paths after migration stabilization.

DoD:
- CI fails on missing keys against `en` baseline.
- CI fails on new hardcoded user-facing strings.
- Runtime missing-key warnings enabled.
- Legacy i18n debt either removed or tracked with explicit TODO owner/date.

## 5. Non-Goals (Current Initiative)
1. No changes to astrology calculation business logic.
2. No full UI framework rewrite.
3. No extra locales beyond `en`, `uk`, `ru` in this phase.

## 6. Initiative Completion Criteria
1. UI, API errors, and AI outputs work consistently for `en`, `uk`, `ru`.
2. Fallback `en` prevents runtime breakage on missing translations.
3. CI blocks i18n regressions.
4. Adding a new locale requires only new catalogs/translations, not architectural rewrite.

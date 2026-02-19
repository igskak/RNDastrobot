# I18N Architecture Decisions (ADR)

## ADR-001 Default Language and Fallback
- Date: `2026-02-18`
- Status: `Accepted`

Context:
The product must support `en`, `uk`, and `ru`, while remaining maintainable for future locale expansion.

Decision:
1. System default language is `en`.
2. Global fallback language is `en`.
3. Any new translation key must be introduced in `en` first.

Consequences:
1. Predictable behavior when translations are incomplete.
2. Simpler CI checks with one canonical baseline.
3. Easier incremental onboarding of new locales.

## ADR-002 Locale Resolution Policy
- Date: `2026-02-18`
- Status: `Accepted`

Decision:
Locale must be resolved in this order:
1. User preference (profile/settings)
2. Explicit request locale (query/header)
3. `Accept-Language`
4. `en`

Consequences:
1. User-controlled language behavior.
2. Stable fallback path across UI/API/AI.

## ADR-003 API Error Contract
- Date: `2026-02-18`
- Status: `Accepted`

Decision:
User-facing API errors must provide:
1. `error_code` (stable machine-readable identifier)
2. `message` (localized human-readable text)

Consequences:
1. Frontend logic does not depend on localized message text.
2. Error handling is stable across locales.
3. Translation updates do not break API consumers.

## ADR-004 DB Strategy for Localized References
- Date: `2026-02-18`
- Status: `Accepted`

Decision:
Localized reference texts are stored in dedicated `*_i18n` tables keyed by `(entity, locale)` with uniqueness constraints.

Consequences:
1. Clean separation between canonical entities and translated texts.
2. Scalable model for adding locales.
3. Deterministic locale lookup with fallback to `en`.

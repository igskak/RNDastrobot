# Analytics setup (PostHog + audit_events)

Deep user tracking for Steliara. Two layers:

- **Layer A — client behaviour (PostHog):** autocapture clicks, pageviews,
  time-on-page, navigation paths, heatmaps. Loaded on every page by
  `app/frontend/js/analytics.js`.
- **Layer B — server value events (`audit_events`):** the canonical log; a
  curated allowlist of value actions is mirrored to PostHog by
  `app/analytics/posthog.py`.

Both keyed by the same identity: `astrologer.id` = PostHog `distinct_id`, plus a
shared `session_id` (the session cookie value, stored on `audit_events`).

## Configuration

Set on the server (Render env):

| Env var | Purpose | Default |
|---|---|---|
| `POSTHOG_PROJECT_API_KEY` | Public project token (write-only, safe in client). Enables both layers. | _(empty → analytics disabled / no-op)_ |
| `POSTHOG_HOST` | PostHog ingestion host. | `https://eu.i.posthog.com` |
| `GA4_MEASUREMENT_ID` | GA4 Measurement ID (`G-XXXXXXXXXX`). Public by design; powers Google Ads conversion/audience signals. | _(empty → GA4 off)_ |

GA4 loads via `gtag.js` and runs under **Consent Mode v2**: `analytics_storage`
starts `denied` and flips to `granted` only when the user accepts the same
consent banner that gates PostHog. Empty `GA4_MEASUREMENT_ID` → no GA4 script
loads.

The key is exposed to the browser via `GET /runtime-config.js`
(`window.__RUNTIME_CONFIG__`). **Use the EU project** (`eu.posthog.com`) for
GDPR/data-residency. A Personal API key is NOT required (capture uses the project
token).

## Privacy / consent (GDPR)

- **Session replay is OFF**; `mask_all_text` masks all input/text so client PII
  (birth data, names, notes) never leaves the browser.
- PostHog is **opt-out by default**. A localized (en/ru/uk) consent banner gates
  capture: Accept → opt-in; Decline → enforced opt-out. Choice persists in
  `localStorage['steliara_consent']`.
- **TODO (legal):** review the consent copy and update the privacy policy /
  subprocessor list (add PostHog EU + DPA). The banner copy lives in
  `analytics.js` (`CONSENT_COPY`).

## Database

Migration `046_extend_audit_events.sql` adds `properties JSONB` + `session_id`
to `audit_events`. **Applied manually** (migrations are not auto-applied):

```
PYTHONPATH=. python app/database/apply_migration.py 046_extend_audit_events.sql
```

## Dashboards to build in PostHog (manual, UI)

These can't be created from code — set them up once in the PostHog project.

**Product / CPO dashboard:**
- Paths (Sankey) across screens — uses the `screen` property / `$pageview`.
- Heatmaps — open any page via the PostHog **Toolbar** (autocapture clicks).
- Time-on-screen — `$pageview`/`$pageleave` duration; `screen_view` events.
- Feature funnels — e.g. `client.natal.open` → forecast → `call_session.create`.
- Retention (W1/W4), DAU/WAU/MAU, stickiness; break down by the `plan` group.
- Dead clicks / rage clicks — PostHog autocapture provides these.

**Marketing / CMO dashboard:**
- Acquisition funnel: landing → `auth.register` (mirrored) → first `chart.create`.
- Channel mix / CAC: group `auth.register` by `utm_source`/`utm_medium`/
  `utm_campaign` (captured first-touch into the `steliara_attribution` cookie and
  stored on the register event).
- Geo / locale: `locale` property + IP (enable IP anonymization in project
  settings if city-level geo isn't needed).

**North-star (grant):** Weekly Active Astrologers — distinct `distinct_id` per
week with a value action (`chart.create`, `client.natal.open`,
`call_session.create`).

## Verifying after deploy

- `GET /runtime-config.js` returns `window.__RUNTIME_CONFIG__` with a non-empty
  `posthogKey` and `posthogHost: https://eu.i.posthog.com`.
- Open a page → accept consent → PostHog **Activity → Live events** shows
  `$pageview` / `$autocapture` with `distinct_id = astrologer id`.
- Network requests go to `eu.i.posthog.com/e/` (not `us.*`).
- A server value action (e.g. `chart.create`) appears in PostHog with
  `source: server` and `$session_id`.

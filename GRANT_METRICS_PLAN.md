# Steliara — Metrics Plan (CzechInvest grant + product analytics)

**Status:** draft v1 · June 2026
**Purpose:** two jobs in one doc.
1. Define the KPI set that backs a **CzechInvest Technology Incubation (~€200k)** application — the numbers a grant committee reads to judge innovation, product-market fit, retention, scalability and international demand.
2. Serve as the **engineering spec** for instrumentation: every metric below maps to a concrete event, its current source (`audit_events` or "NEW"), and the exact formula.

Related: `MONETIZATION_PLAN.md`, `GTM_EXECUTION_PLAN.md`.

---

## 0. North Star Metric (NSM)

**Weekly Active Astrologers doing real client work (WAA-client).**

> Distinct `actor_id` in a calendar week who performed at least one *value action*: opened/built a chart, or ran a consultation, for at least one client.

- Value actions: `chart.create`, `client.natal.open`, `call_session.create`.
- Why this and not "logins": grant reviewers (and investors) discount vanity activity. NSM must represent delivered value. A logged-in user who never touches a chart is not a customer in the making.
- Everything below is either a **driver** of the NSM (acquisition, activation) or a **consequence** of it (engagement, retention, revenue).

---

## 1. Current data foundation & its limits

All server-side telemetry today lives in one table, `audit_events` (`app/database/models.py:209`):

| column | use for metrics |
|---|---|
| `actor_id` | the astrologer (user dimension) |
| `action` | the event type (e.g. `chart.create`) |
| `resource_type`, `resource_id` | object touched |
| `result` | `success` / `failure` / … → funnel drop-off, error rate |
| `ip` | **geo** (IP → country) — basis for "different regions" |
| `user_agent` | device / browser split |
| `created_at` | time dimension, cohorts, retention |

**~70 distinct actions already emitted** (full list in `app/api/routes/*.py`), covering register, login, person CRUD, chart CRUD, natal/transits/progressions/directions/solar/synastry, AI assistant, recorded call sessions, plan updates. This is enough to compute the bulk of Section 2–4 **today**, before any GA4/PostHog work.

Known gaps are not just noted but planned out as concrete tasks in **Section 5 — Instrumentation gaps → tasks**.

---

## 2. AARRR — the product funnel (the PMF proof)

### Acquisition
| Metric | Formula | Source |
|---|---|---|
| New registrations / week | count `auth.register` (result=success) per ISO week | audit ✅ |
| Geo distribution of signups | group `auth.register` by country(`ip`) | audit ✅ (geo lookup) |
| Channel mix | signups grouped by `utm_source/medium/campaign` | **NEW** (capture UTM at register) |
| Signup → verified email | `auth.verify-email` success / `auth.register` | audit ✅ |

### Activation (the "aha moment")
| Metric | Formula | Source |
|---|---|---|
| **Activation rate** | % of new users who within 7 days did ≥1 `person.create` **and** ≥1 `chart.create` | audit ✅ |
| Time-to-first-chart (TTFC) | median(`first chart.create.created_at` − `auth.register.created_at`) | audit ✅ |
| Onboarding drop-off | funnel: register → verify → first person → first chart, with % surviving each step | audit ✅ |

### Retention — **the single most important panel for the grant**
| Metric | Formula | Source |
|---|---|---|
| W1 / W4 retention | % of a signup cohort active again in week 1 / week 4 | audit ✅ |
| Cohort retention curve | weekly cohorts × weeks-since-signup matrix | audit ✅ |
| DAU / WAU / MAU | distinct `actor_id` with a value action per day/week/month | audit ✅ |
| Stickiness | DAU / MAU | audit ✅ |
| Resurrection rate | % of dormant (≥28d) users who return | audit ✅ |

### Revenue (needs billing layer — Paddle)
| Metric | Formula | Source |
|---|---|---|
| Trial → Paid conversion | paid-start / trial-start (plan target **15%**) | **NEW** (Paddle) + `auth.plan.update` |
| MRR / ARR | Σ active subscription value | **NEW** (Paddle) |
| ARPU | MRR / paying customers (blended target **~$28**) | **NEW** |
| Monthly churn (logo + revenue) | cancelled / start-of-month (target **4%/mo**) | **NEW** |
| LTV : CAC | (ARPU·gross margin / churn) ÷ CAC (CAC ≈ $50–58, `MONETIZATION_PLAN.md`) | **NEW** |

### Referral
| Metric | Formula | Source |
|---|---|---|
| Referral share of signups | referred signups / all signups | **NEW** (referral ledger) |
| Viral coefficient K | invites/user × invite→signup conversion | **NEW** |
| Referral → first paid invoice | reward trigger conversion | **NEW** |

---

## 3. Engagement / depth-of-use (product is a tool, not a toy)

| Metric | Formula | Source |
|---|---|---|
| Charts per active astrologer / week | `chart.create` / WAA | audit ✅ |
| Clients per astrologer | distinct persons per `actor_id` | audit ✅ |
| **Feature adoption matrix** | % of 30-day actives who used each feature ≥1× | audit ✅ |
| Advanced-feature usage | transits / progressions / directions / solar / synastry calc counts | audit ✅ (`client.transits.calculate`, `client.progressions.calculate`, `client.directions.calculate`, `client.solar.calculate`, `client.synastry.open`) |
| AI assistant usage | `client.assistant.chat`, `client.assistant.aspect_passes` per active user | audit ✅ |
| Recorded consultations | `call_session.create`, `…recording_start`, `…end` counts & duration | audit ✅ |
| Error / failure rate | events with `result≠success` ÷ total, by action | audit ✅ |

---

## 4. Grant-specific metrics (mapped to CzechInvest evaluation rubric)

CzechInvest Technology Incubation scores on innovation, market validation, scalability, and team. Frame the data to hit each:

### 4.1 Innovation / R&D intensity
- **AI engagement share:** % of active sessions touching the AI assistant or recorded-call auto-processing (`client.assistant.*`, `call_session.recording_*`). Positions Steliara as an **AI-driven astrology workbench**, not "another SaaS form."
- AI inference volume (chats, aspect passes, call transcripts processed) / month.
- Proprietary engine depth: ephemeris/configuration coverage vs off-the-shelf (qualitative + accuracy metric). Pull from existing ORBS/configuration reports in repo.

### 4.2 Market validation / international demand
- **Paying customers across ≥N countries** (the reason synthetic users span regions). Geo-diverse *paying* base is the strongest CzechInvest signal that this is an export-capable product, not a local hobby.
- Signup & activation by region (UA beachhead vs EN markets US/UK/CA/AU — per `MONETIZATION_PLAN.md`).
- Organic vs paid mix; willingness-to-pay (trial→paid by region).

### 4.3 Scalability / unit economics
- Gross margin (~84% at $1M, `MONETIZATION_PLAN.md`).
- Cost per active user (VM €12/mo, AI/call $0.37 per 90-min).
- Infra cost growth vs MAU growth (should be sublinear).

### 4.4 Traction milestones (KPI table for the application)
Quarterly targets straight from `MONETIZATION_PLAN.md`: 20 paid (~$500 MRR, grant-trigger) → scaling toward 3,000 paying / ~$1M ARR over 24 months. Present as a milestone table with the metrics above as the tracked KPIs per quarter.

---

## 5. Instrumentation gaps → tasks

The metrics above are blocked in places by missing instrumentation. Each gap is a concrete, ordered task. "Blocks" = which Section 2–4 metrics cannot be computed until it ships.

| # | Gap | Blocks | What to build | Where | Effort | Priority |
|---|---|---|---|---|---|---|
| G1 | No `properties` column on audit rows — only a string `resource_id` | Plan-tier-at-event-time splits, feature-variant, duration, any structured context | Add `properties JSONB` (nullable) to `audit_events`; extend `create_audit_event(...)` to accept a dict; backfill nothing (forward-only) | `app/database/models.py:209`, audit helper, Alembic migration | S | **P1** |
| G2 | No UTM / referrer captured at signup | Acquisition → channel mix; grant "international demand by channel" | Persist `utm_source/medium/campaign/term/content` + `referrer` from the register request (read from query/cookie set on landing) into G1 `properties` of `auth.register` | `app/api/routes/auth.py` register handler + frontend landing capture | S–M | **P1** |
| G3 | No `session_id` | Sessions, session length, pages-per-session, true bounce | Issue a session id at login/visit; stamp it on audit rows via G1; (client analytics can also own this) | session issuance + audit helper | M | P2 |
| G4 | No raw pageviews — static HTML loads not logged | Navigation/funnel between pages, time-on-page, entry/exit pages | Client-side pageview tracking. **Recommend PostHog** (self-host, bot-friendly) over GA4 (drops automated browsers) | new analytics snippet in HTML templates / shared bundle | M | P2 |
| G5 | No billing events | All Revenue metrics: trial→paid, MRR, ARR, ARPU, churn, LTV:CAC | Paddle webhooks → write subscription transitions; `reconcile_subscription` as sole `plan_code` writer (per `MONETIZATION_PLAN.md`) | billing layer (does not exist yet) + `auth.plan.update` | L | P2 |
| G6 | No way to exclude test/bot traffic | Clean grant numbers once synthetic users run on prod | Tag synthetic accounts (known `actor_id` set or a service flag in G1 `properties`); filter in every metric query and dashboard | accounts + analysis layer | S | **P1** (before bots hit prod) |

Notes:
- **P1 items (G1, G2, G6) are cheap and unblock the most grant-relevant story** (acquisition channels + clean data) — do them first.
- G1 is a dependency of G2, G3, and G6: ship the `properties JSONB` column first, then the rest ride on it.
- G4/G5 are larger and can land in Phase 1–2 (Section 7); the grant baseline does **not** require them — Section 2–4 audit-based metrics carry the application.

---

## 6. Mapping to the synthetic-user test

The Playwright bots (separate spec) must reproduce **these exact events in realistic proportions and across regions**, so the test validates both (a) the metric pipeline computes correctly and (b) the grant dashboard fills with plausible per-country numbers.

Suggested behavioural mix per simulated astrologer (funnel-shaped, not uniform):
- 100% register → login → create 1–8 clients → build natal charts.
- ~60% run at least one advanced calc (transits/progressions/etc.).
- ~25% use the AI assistant.
- ~10% create a recorded consultation.
- Region assignment via per-context proxy + matching locale/timezone/geolocation.
- **Test data must be taggable & filterable out of production metrics** (e.g. a known set of `actor_id`s, or a service tag) so bots never pollute the real grant numbers.

---

## 7. Recommended build order

1. **Phase 0 (now, no code):** compute Section 2–4 metrics already in `audit_events` via a read-only analysis script → baseline + confirm gaps. Validates the data is even usable.
2. **Phase 1 (P1 gaps — cheap, high grant value):** **G1** `properties JSONB`, **G2** UTM at register, **G6** test-traffic tagging. Unblocks channel mix + clean numbers before bots.
3. **Phase 2 (P2 instrumentation):** **G3** `session_id`, **G4** pageview tracking (PostHog).
4. **Phase 3 (billing):** **G5** Paddle webhooks → revenue/churn/LTV metrics.
5. **Phase 4:** grant dashboard (per-country, retention cohorts, funnel) assembled from the above.
6. **Synthetic-user bots** run against any phase to load-test the pipeline and populate the dashboard (must respect **G6** tagging before hitting prod).

---

## Appendix A — metric → event quick index

| Event (audit action) | Feeds metric |
|---|---|
| `auth.register` | acquisition, cohorts, geo, (UTM TODO) |
| `auth.verify-email` | signup→verified |
| `auth.login` | activity (not NSM by itself) |
| `auth.plan.update` | plan transitions (paid via Paddle) |
| `person.create` | activation, clients-per-astrologer |
| `chart.create` | **NSM**, activation, charts/week |
| `client.natal.open` | **NSM**, engagement |
| `client.transits.calculate` / `client.progressions.calculate` / `client.directions.calculate` / `client.solar.calculate` / `client.synastry.open` | advanced-feature adoption (R&D story) |
| `client.assistant.chat` / `client.assistant.aspect_passes` | AI engagement (innovation score) |
| `call_session.create` / `call_session.recording_start` / `…end` | recorded consultations (innovation + depth) |
| any `result≠success` | error/drop-off rate |

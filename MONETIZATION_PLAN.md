# Monetization, Billing, Referral & $1M ARR Plan

Status: draft for review (run `/autoplan` against this file)
Audience: Ukrainian + English-speaking (international/diaspora) astrologers, RU as a third UI language. NOT a Russia-market play.
Provider decision: Paddle (Merchant of Record). Architecture stays swap-friendly so the provider can change painlessly.

---

## 1. Product & pricing model (decided)

Steliara is a professional daily-use tool for practicing astrologers: chart calculation, client CRM, forecasts, and video consultations with recording + transcription + AI summaries.

### Lifecycle states — 3 states, 2 sellable

| Code | Sellable? | Entitlements | How you reach it |
|------|-----------|--------------|------------------|
| `trial` | No (auto) | Full Pro, 14 days, unlimited | Every signup |
| `standard` ⭐ | Yes — $24/mo, $19/mo annual | CRM + consultations + meeting stats | Buy |
| `pro` | Yes — $39/mo, $29/mo annual | + calls, recording, transcription, AI summaries | Buy |
| `expired` | No (not sellable) | Read-only: existing charts/clients visible, all create/consult/call locked | Trial lapses or subscription cancelled/past_due past grace |

Rename the current `solo` plan_code to `expired`. There is no "buy Solo" path anywhere. The only exits from `expired` are Standard or Pro. This kills the low price anchor at the purchase decision while keeping the user's client data visible (ethical + reduces chargebacks + the frozen data is itself the conversion lever via loss aversion).

### Reverse-trial logic
- One trial for everyone: 14 days, full Pro, no card upfront (maximize trial starts).
- On expiry: downgrade to `expired` (read-only), not full lockout.
- Annual billed upfront, ~20-26% discount vs monthly.

### Why two tiers, not three
A cheap purchasable entry tier anchors users low and they never discover CRM/consultation value, so they pay the minimum forever. Removing it forces the value-based decision (Standard vs Pro) to happen only *after* the user has felt full value in trial.

---

## 2. Unit economics (validated with real COGS)

Variable cost per 90-min recorded + transcribed + AI-processed call: **$0.37**. Fixed VM: **€12/mo (~$13)** at current scale.

- Pro user, 20 recorded sessions/mo: COGS $7.40 vs $39 revenue → **~81% gross margin**.
- Heavy Pro user, 40 sessions/mo: COGS $14.80 → still **~62% margin**.
- One Standard subscriber covers the fixed VM.

Conclusion: **not cost-constrained. Price on value.** The recording/transcription/AI stack is a near-free moat (95%+ marginal margin) and is the centerpiece of the Pro upsell. No marketed usage cap; keep only a silent anti-abuse ceiling (~80-100 recorded calls/mo).

Watch item: recording **storage** accumulates. Retention policy required (e.g. recordings auto-expire after 90 days unless downloaded). Design in now.

---

## 3. Referral program (NEW — full spec)

### Why referral is a structural advantage here
The real cost of a "give a month, get a month" reward is mostly **forgone revenue**, not COGS:
- Referrer (active paid user): 1 free month = **~$39 forgone revenue**. Their call COGS is incurred regardless of the reward, so COGS is not the cost here.
- Referee: extended trial = a few dollars of trial COGS, or 50%-off-first-month = ~$12-19 forgone.
- **Effective referral CAC ≈ $50-58 per acquired paying customer.**

That beats paid-ad CAC (target $60-100), so referral is the cheapest channel — but it is "good," not free. High margins (LTV ~$590) make a $50 referral CAC comfortable (~12:1). Consider a smaller fixed credit ($15-20 off rather than a full month) to blunt the forgone-revenue cost while keeping most of the referral lift, especially on Standard.

### Mechanics — "Give a month, get a month" (double-sided)
- **Referee (new user):** extended trial — 21 days instead of 14 (handled locally, no provider needed), OR 50% off first paid month.
- **Referrer (existing paid user):** 1 month account credit, applied to their next invoice — **but only after the referee's first successful payment** (qualified conversion), never on trial signup. This blocks the obvious abuse vector.

### Abuse prevention
- Reward triggers only on referee's first *paid* invoice (status `qualified`).
- Cap rewards per referrer per calendar month (e.g. max 5 free months/mo).
- Dedupe by payment fingerprint + email + IP heuristics.
- Self-referral blocked (same payment method / email domain rules).

### Data model
```
referral_codes        (code PK, astrologer_id FK, created_at)
referrals             (id PK, referrer_id FK, referee_id FK,
                       status ENUM[pending, qualified, rewarded, void],
                       qualified_at, rewarded_at, created_at)
account_credits       (id PK, astrologer_id FK, amount_months INT or amount_cents,
                       source ENUM[referral, founding, manual], applied_at, created_at)
```

### Swap-friendly credit handling (important)
Keep an account-neutral `account_credits` ledger. The credit is **provider-agnostic**; only the `BillingProvider` adapter knows how to redeem it (e.g. translate "apply 1 month credit" into a Paddle adjustment/discount on next invoice). Never store Paddle credit IDs in the entitlements or referral tables. This keeps referral logic working unchanged if the provider is swapped.
- Referee extended-trial reward = local trial-expiry extension (no provider call).
- Referrer paid-month reward = credit ledger entry → adapter redeems against next invoice.

### Viral surface (free distribution loop)
AI-generated session summary exported with subtle "made with Steliara" branding. Every consultation an astrologer sends a client becomes a marketing impression to a potential future astrologer. Pair with an in-app referral CTA after the user's first successful consultation (peak-satisfaction moment).

### Localization requirement
Referral invites, reward emails, and the referral dashboard must be fully localized in RU / UKR / ENG from day one.

---

## 4. Billing architecture (swap-friendly)

Current readiness: 7/10. Entitlements are already fully decoupled from any payment provider (`app/services/entitlements_service.py` maps `plan_code` → feature flags). That is the seam we build on.

### Required changes
1. **Billing schema**
   ```
   billing_subscriptions (astrologer_id, provider, customer_id, subscription_id,
                          price_id, status, current_period_end, raw JSONB)
   billing_events        (id, provider, event_id UNIQUE, type, payload, processed_at)  -- idempotency log
   ```
2. **`BillingProvider` interface + Paddle adapter** — `create_checkout`, `create_portal_url`, `parse_webhook → NormalizedSubEvent`, `redeem_credit`. Provider selected by config.
3. **`reconcile_subscription(astrologer, plan_code, status, period_end)`** — the ONLY function allowed to mutate `plan_code`. Maps `price_id → plan_code`, applies status (active / past_due / cancelled) + period end + grace.
4. **Enforce expiry** — `get_entitlements` must honor `plan_expires_at` + status with a grace window. Today it ignores expiry entirely.
5. **Fix two security holes**
   - `DEFAULT_PLAN_CODE` and the column `server_default` change from `pro` → `expired` (locked). Today an unknown/empty plan silently grants the top tier.
   - `PATCH /me/plan` must stop being a free self-grant (any logged-in user can set themselves to `pro`). Replace with "open checkout / portal". Only webhooks may write `standard`/`pro`.
6. **Webhook endpoint** with Paddle signature verification + idempotency via `billing_events`.
7. **Migration for existing rows** — grandfather current real astrologers explicitly (map `solo` → `standard`, keep `pro`); new signups default to `trial`.
8. **Localized billing surface** — checkout, paywall, trial banners, dunning emails fully in RU / UKR / ENG.

---

## 5. Path to $1M ARR with profit calculation

### Market size (TAM) — researched June 2026
- US "psychic services" industry: ~100,000 businesses / ~100,000 practitioners (IBISWorld 2024-25), $2.3B revenue. Astrology is a subset → est. **~25,000-40,000 astrology-practicing US businesses**.
- + UK/CA/AU English markets (~15-25k) + Ukraine (~5-15k). **Serviceable market for an EN/UK/RU online-consultation tool: ~50,000-80,000 pros** (excludes India/Vedic — different product + price point).
- **3,000 paying ≈ 4-6% of that 50-80k serviceable market** → achievable as the category-leading tool. BUT ≈ 15-30% of a UA+RU-only beachhead → implausible on that alone.
- **Strategic consequence: Ukraine is the wedge, English-speaking markets (US/UK/CA/AU) are the prize. $1M requires winning English markets. LATAM (ES/PT) is upside, not a dependency.**

### Assumptions (benchmarked, June 2026)
- Tier mix: 60% Standard, 40% Pro.
- Blended ARPU: 0.6 × $24 + 0.4 × $39 = $30/mo gross; annual discount pulls effective to **~$28/mo = $336/yr**.
- Trial → paid conversion: **base 15%** (opt-in/no-card benchmark: First Page Sage avg 18.2%, ChartMogul 8.9%, target band 15-25%). 20% is bull, not base.
- Monthly churn: **base 4%** (SMB self-serve benchmark 3-5%, avg 3.5%). 43% of churn in first 90 days → onboarding is the retention lever.
- Paddle MoR: ~6% all-in. Variable COGS: ~8% of revenue. Fixed infra at scale: ~$20k/yr.

### Target size
$1,000,000 ARR ÷ $336/yr = **~3,000 paying customers** (ARPU-driven, independent of conversion/churn).

### Sensitivity band (this is the honest model, not a single point)
| Scenario | Conversion | Churn/mo | Trials needed for 3,000 paying | Monthly replacement load |
|----------|-----------|----------|-------------------------------|--------------------------|
| Bear | 10% | 5% | ~30,000 | ~150/mo |
| **Base** | **15%** | **4%** | **~20,000** | **~120/mo** |
| Bull | 22% | 3% | ~13,600 | ~90/mo |

The gap between bear and bull is ~2x the trial volume and ~1.7x the steady-state replacement load. Plan acquisition for the base case; treat bull as upside, hold reserve for bear.

### Steady-state P&L at $1M ARR

| Line | % of rev | Annual |
|------|----------|--------|
| Revenue (ARR) | 100% | $1,000,000 |
| Paddle MoR fees | ~6% | -$60,000 |
| Variable delivery COGS (calls/AI/storage) | ~8% | -$80,000 |
| Fixed infra | ~2% | -$20,000 |
| **Gross profit** | **~84%** | **~$840,000** |
| Marketing / CAC (steady-state replacement + growth) | ~20% | -$200,000 |
| Team + tools + ops | varies | -$X |
| **Contribution before team** | | **~$640,000** |

Gross margin is ~84%. Even after a generous $200k/yr marketing budget, contribution before team cost is ~$640k. That comfortably funds a small team (2-4 people) and still leaves profit. **This is a genuinely profitable $1M ARR business, not a break-even one.**

### CAC sanity check (LTV:CAC)
- LTV = ARPU / churn = $28 / 0.04 = ~$700 gross revenue per customer; ~$590 gross-margin LTV.
- Healthy 3:1 → you can spend up to **~$195 to acquire a paying customer**.
- With a school/influencer/referral-heavy mix, blended CAC target is **$60-100**, giving 6:1 to 10:1 — strong.

### Referral's effect on the model
Each referred-and-converted customer costs ~$50-58 (mostly the referrer's forgone free month + the referee's discount) instead of $60-100 paid CAC. The advantage is real but modest, not order-of-magnitude. If referral drives ~25% of new customers, blended CAC drops somewhat and the marketing line eases, but do not model referral as near-free. Using a smaller fixed credit ($15-20) instead of a full month improves referral's CAC advantage further.

### Year-by-year ramp (illustrative)

| Phase | Paying customers | ARR | Focus |
|-------|------------------|-----|-------|
| Phase 0 (validate) | 0 | $0 | 10 customer interviews, Paddle live, dunning, founding offer |
| Phase 1 (founding cohort) | ~50-100 | ~$30k | School + influencer seeding, testimonials, prove trial→paid |
| Phase 2 (PLG engine) | ~500-800 | ~$200k | Onboarding/activation tuning, referral launch, content cadence |
| Phase 3 (scale) | ~3,000 | ~$1M | Paid ads on proven funnel, LATAM (ES/PT) language expansion |

LATAM (Spanish/Portuguese, esp. Brazil) is the largest astrology-language expansion lever and is cheap given the existing i18n layer. Name it as the Phase-3 growth path; do not build it before Phase 2 converts.

---

## 6. Go-to-market (PLG, not a sales team)

Positioning: the practice-management tool for working astrologers — charts, client CRM, and recorded AI-summarized consultations in one place. Differentiator vs free chart calculators: you run your *business* on it, and the AI session summaries are unique at this price.

Funnel + north-star metrics (instrument before marketing):
```
Acquisition → Trial start → Activation → Paid → Expansion → Referral
```
- Trial → paid conversion (target 15-25%) — north star.
- Activation = saved a real client + ran one consultation in first 3 days (strongest conversion predictor).
- Standard vs Pro mix; monthly churn (<5%); annual take rate; referral share of new customers.

Channels, ranked by fit:
1. **Astrology-school partnerships** (strongest wedge) — graduating cohorts need the tool, no incumbent. Revenue share / affiliate, extended trial for students. Works in both UA and English markets.
2. **Practicing-astrologer influencers** — in this niche the pros are the influencers. Free tool + affiliate code; they demo in real readings.
3. **Content / SEO** — forecast guides, techniques the tool already encodes.
4. **Organic social** (IG / TikTok / YouTube Shorts / Telegram) — astrology is highly viral; chart wheels + AI summaries demo well.
5. **Paid ads — last**, only after the funnel converts. Cap at CAC ceiling (~$195, target $60-100).

---

## 7. Localization (cross-cutting requirement)

RU / UKR / ENG must cover the entire monetization surface from launch: pricing page, checkout, paywall, trial banners, dunning/recovery emails, referral invites and reward emails. A half-translated checkout or English-only "trial expired" email kills conversion for non-English users. The existing i18n layer makes adding ES/PT later cheap (Phase 3).

Note: supporting the RU *language* serves Ukrainian/diaspora Russian-speakers. It is NOT a commitment to selling inside Russia (which would bring sanctions/payment risk). Keep those decisions separate.

---

## 8. Open questions for review
- Trial length: 14 vs 21 days (referee referral reward assumes 21 for referred users).
- Annual discount exact %: 20% vs 26%.
- Founding-member offer: lifetime locked discount (e.g. Standard $15) for first cohort — confirm.
- Grace period length on past_due before downgrade to `expired` (e.g. 7 days).
- Recording retention window (90 days proposed).

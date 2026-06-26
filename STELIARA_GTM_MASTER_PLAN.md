# Steliara — Master GTM, Marketing & Monetization Plan

*Single source of truth. Last updated 2026-06-25.*

This document consolidates what used to live in four separate files (`MONETIZATION_PLAN.md`, `GTM_EXECUTION_PLAN.md`, `GRANT_METRICS_PLAN.md`, `docs/MARKETING_ANALYSIS_AND_GOOGLE_ADS_PLAN.md`) plus the June 2026 market/competitor research and the channel-playbook upgrade. Positioning context that the marketing skills read automatically stays in [`.agents/product-marketing.md`](.agents/product-marketing.md) — this plan references it rather than duplicating it.

**Reading order for a newcomer:** §1 Positioning → §2 Market → §4 Monetization → §7 GTM ladder → §8 Channel playbook → §10 Measurement.

---

## 0. Status & locked decisions

**Locked founder constraints:**
- Timeline: **24 months to $1M ARR**.
- Funding: **grants + revenue only, no dilution** (the ~$640k profit at $1M is reinvested during the ramp, not taken).
- Legal: **Czech s.r.o.** — incorporate early; it gates all EU grants and is clean for Paddle MoR.
- Team: founder + a part-time bizdev hire added at the M1→M2 boundary.
- Audience: Ukrainian + English-speaking (international/diaspora) astrologers, **RU as a UI language, NOT a Russia-market play**.

**Strategic decision (2026-06-24):** dual-track — UA/RU warm network is the cheap, competitor-thin **beachhead for first revenue + testimonials + grant proof**; English (US/UK/CA/AU) is where the $1M actually lives. Build product/price/copy English-first by default, localize to RU/UK. See [[competitor-astrolium-dualtrack]].

---

## 1. Positioning

Full positioning lives in [`.agents/product-marketing.md`](.agents/product-marketing.md). Summary:

**One-liner:** the cloud workspace for practicing astrologers — charts, the people you read for, forecasts, and recorded/transcribed/summarized consultations in one place.

**Messaging hierarchy — lead with ONE hero + 3 pillars (never flatten into a list):**
- **HERO (unique + provable):** *Everything about every person you read for — charts, notes, and the actual recorded consultations — in one place. You never have to remember what you said last time.* Fuses "capture the consultation" + "everything in one place" with an emotional core (removes the memory burden). No competitor ships this.
- **Pillar 1 — Works everywhere** (cloud; Mac/Windows/any browser). Concrete fact that conquers Windows-only Solar Fire.
- **Pillar 2 — Genuinely easy** ("a new level of convenience vs the old desktop programs"). Say it human, not "UX"; support claim, shown visually, not led with.
- **Pillar 3 — Saves time on client context** (no re-assembling a person's history before each session).

**Messaging rule:** never lead with "another astrologer workspace + AI" — Astrolium owns that sentence. Charts + CRM + Swiss-Ephemeris accuracy are table-stakes proof mentioned underneath the hero.

**AI stance (trust line, not the hero):** *AI will never read a chart for you. It just finds the facts faster: the aspects, the exact dates, where a planet sits. You stay the astrologer; it does the digging.* This deliberately occupies the opposite pole from AI-astrology chatbots (Jenova, AstroSage AI) that try to *replace* interpretation, and disarms the #1 objection from a craft-protective audience. The assistant retrieves data and time windows from the chart; it does not interpret. Use it in objection-handling, the assistant/FAQ surfaces, and a dedicated content/ad angle — never as the hero.

**Voice:** soft, warm, human. "practice" and "the people you read for", not "clients"/"CRM" in user-facing copy (in English ads "clients" is acceptable — it is the market's search word). No AI/business/enterprise jargon. No em dashes in copy.

---

## 2. Market & competitive landscape

### 2.1 TAM (researched June 2026)
- US "psychic services": ~100k practitioners, $2.3B (IBISWorld). Astrology subset → ~25–40k US practicing businesses.
- + UK/CA/AU (~15–25k) + Ukraine (~5–15k). **Serviceable EN/UK/RU online-consultation market ≈ 50–80k pros** (excludes India/Vedic — different product + price point).
- **3,000 paying ≈ 4–6% of that 50–80k** → achievable as the category leader. But ≈ 15–30% of a UA/RU-only base → implausible alone.
- **Consequence: Ukraine is the wedge, English-speaking markets are the prize. LATAM (ES/PT) is Phase-3 upside, not a dependency.**
- Broader consumer astrology-app market (~$4.75–5.7B, +20%/yr) is mostly Co-Star/CHANI-style B2C — relevant only as a tailwind (more readings → more practitioners needing tools), NOT our buyer.

### 2.2 Competitors
| Competitor | What it is | Strength | Gap we exploit |
|---|---|---|---|
| **Chronos** (chronos.mg) | Dominant RU/UA astro-processor | Calc, dispositors, forecasts, booking | No recorded/transcribed/summarized sessions; not "whole practice in one place" |
| **Astrolium** (astrolium.com) | Closest vision-match; **pre-launch (<~1k target users, untracked traffic)**, by astrology-api.io team | Same "workspace + AI" pitch, English-native, free tier | **No video calls / recording / transcription yet** (roadmapped). Free/$11 sets a low price anchor. Not localized for UA/RU. |
| **Solar Fire / Astro Gold / Kepler** | Desktop incumbents | Deep calc, trusted, report writers | Desktop-era, single-user, no consultation capture (Solar Fire Windows-only) |
| **LUNA** | Cloud calculator | Multi-device, cheap | Calculator-first; no consultation capture |
| **Astro.com, AI chatbots (Jenova, AstroSage)** | Free charts / B2C "personal astrologer" | Free, trusted / mainstream | Serve *end clients*, not the practitioner's workflow |

**Key competitive read:** this is a **green-field race**, not a market already won. Astrolium is the most vision-aligned rival but pre-traction and missing the recorded-consultation wedge. That wedge is a **time-boxed advantage** (they have audio recording on their roadmap) — press it while it is live. RU is currently competitor-thin for this category.

---

## 3. ICP, pain & opportunity map

Research-backed (RU sources strong; Western validated). Confidence noted. Verbatim from real practitioners is the biggest remaining research gap — collect during M0 white-glove onboarding.

| # | Pain | Confidence | Opportunity / angle |
|---|---|---|---|
| 1 | **"Record it — you'll only remember 20–30%."** Recording sessions is already a norm in BOTH markets; astrologers manually record + send files. | **High** | Productize the habit: *automatic* record → transcript → AI summary. Headline angle. |
| 2 | Astrologers forget what they told each person. | **High** | Core wedge: the session's substance is captured for you, searchable later. |
| 3 | Desktop software is clunky, single-device, dated. | High | Conquest: "Solar Fire alternative", "cloud astrology software". |
| 4 | Tool-juggling: charts + Zoom + notes + spreadsheet. | Med–High | "Your whole practice in one tab." |
| 5 | Prep is slow (15–30 min × 10–15 chart components). | Med | Chart-aware assistant = faster prep. |
| 6 | Finding/keeping clients is a constant worry. | Med | Adjacent — content/organic, not core product. |
| 7 | Burnout / overload. | Med | Frame around *relief*, not "productivity". |

**Biggest opportunity:** own **"capture the consultation"** before Astrolium ships audio recording. It maps to an existing behavior, so it needs zero behavior change to land.

---

## 4. Monetization

### 4.1 Pricing & lifecycle (decided)
| Code | Sellable? | Entitlements | Reached by |
|---|---|---|---|
| `trial` | No (auto) | Full Pro, 14 days, unlimited, no card | Every signup |
| `standard` ⭐ | **Yes — $24/mo, $19/mo annual** | CRM + consultations + meeting stats | Buy |
| `pro` | **Yes — $39/mo, $29/mo annual** | + calls, recording, transcription, AI summaries | Buy |
| `expired` | No | Read-only: existing charts/clients visible, all create/consult/call locked | Trial lapses or sub cancelled/past_due past grace |

- **Reverse trial:** one 14-day full-Pro trial for everyone, no card upfront. On expiry → `expired` (read-only), not full lockout. Frozen data is itself the conversion lever (loss aversion + ethical + fewer chargebacks).
- **Two sellable tiers, no cheap entry tier:** a cheap purchasable tier anchors users low and they never discover CRM/consultation value. Forcing the Standard-vs-Pro decision *after* the trial captures value-based pricing.
- Annual billed upfront, ~20–26% discount.
- **⚠️ Open re-check (from competitor research):** Astrolium's Free/$11 tiers set a public low anchor that partially undercuts the "kill the cheap anchor" logic. Hold pricing for now; justify the premium via the recorded-consultation wedge, revisit if the English price test shows resistance.

### 4.2 Unit economics (validated COGS)
- Variable cost per 90-min recorded + transcribed + AI-processed call: **$0.37**. Fixed VM: ~€12/mo.
- Pro user @ 20 sessions/mo: COGS $7.40 vs $39 → **~81% margin**; @ 40 sessions → still ~62%.
- **Not cost-constrained. Price on value.** The recording/transcription/AI stack is a ~95%-marginal-margin moat. No marketed usage cap; silent anti-abuse ceiling ~80–100 calls/mo. **Watch:** recording storage accumulates → auto-expire recordings after 90 days unless downloaded.

### 4.3 Path to $1M ARR
- Tier mix 60% Standard / 40% Pro → blended ARPU ~$28/mo effective = **$336/yr**.
- $1M ÷ $336 = **~3,000 paying customers** (ARPU-driven).
- Base case: **15% trial→paid, 4% monthly churn**.

**Sensitivity (the honest model):**
| Scenario | Conversion | Churn/mo | Trials needed | Monthly replacement |
|---|---|---|---|---|
| Bear | 10% | 5% | ~30,000 | ~150/mo |
| **Base** | **15%** | **4%** | **~20,000** | **~120/mo** |
| Bull | 22% | 3% | ~13,600 | ~90/mo |

**Steady-state P&L at $1M:** Paddle MoR ~6%, variable COGS ~8%, fixed infra ~2% → **~84% gross margin (~$840k)**; after ~$200k/yr marketing → **~$640k contribution before team**. A genuinely profitable $1M business.

**LTV:CAC:** gross-margin LTV ≈ $590; healthy 3:1 allows up to ~$195 CAC; blended target **$60–100** (school/influencer/referral-heavy) → 6:1–10:1.

### 4.4 Billing architecture (swap-friendly — eng spec)
Entitlements already decouple `plan_code` → feature flags. Required: `billing_subscriptions` + `billing_events` (idempotency) tables; a `BillingProvider` interface + Paddle adapter (`create_checkout`, `create_portal_url`, `parse_webhook`, `redeem_credit`); `reconcile_subscription(...)` as the **only** writer of `plan_code`; enforce `plan_expires_at` + grace; **fix two security holes** (`DEFAULT_PLAN_CODE` pro→expired; `PATCH /me/plan` must stop being a free self-grant — only webhooks write standard/pro); signed+idempotent webhook; migration grandfathering current astrologers (solo→standard, keep pro; new signups → trial). Provider = Paddle (Merchant of Record), architecture stays swap-friendly.

---

## 5. Referral program

- **Why it matters:** the real cost of "give a month, get a month" is mostly **forgone revenue** (~$39 referrer free month), not COGS → effective referral CAC ≈ **$50–58**, beating paid CAC ($60–100). Real but modest advantage; consider a smaller fixed credit ($15–20) to blunt forgone-revenue cost, especially on Standard.
- **Mechanics (double-sided):** referee → 21-day trial (vs 14) or 50% off first month; referrer → 1 month credit **only after the referee's first successful payment** (qualified conversion), never on trial signup.
- **Abuse prevention:** reward only on first *paid* invoice; cap rewards/referrer/month; dedupe by payment fingerprint + email + IP; block self-referral.
- **Data model:** `referral_codes`, `referrals` (status: pending/qualified/rewarded/void), `account_credits` (provider-agnostic ledger; only the BillingProvider adapter redeems — never store Paddle credit IDs in entitlements/referral tables).
- **Viral surface:** AI session summary exported with subtle "made with Steliara" branding → every client deliverable is a marketing impression. In-app referral CTA after the first successful consultation (peak-satisfaction moment).
- **Localized RU/UK/EN from day one** (invites, reward emails, dashboard).

---

## 6. GTM strategy: funding logic + milestone ladder

### 6.1 Funding stack
| Stage | Source | Amount | Buys |
|---|---|---|---|
| Bootstrap | Founder-led, ~$0 | — | First 20 paid, validation |
| Grant 1 | Czech innovation voucher / CzechStarter | €20–40k | First growth experiments, part-time bizdev |
| Grant 2 | **CzechInvest Technology Incubation** | up to CZK 5M (~€200k), 18–24 mo | The real growth engine |
| Optional | Pre-seed angel / Czech VC (Credo, Rockaway) or EIC | €50–200k | Accelerate if grants insufficient |

**Aim at Technology Incubation (~€200k), not just the small voucher** — AI session summaries qualify as the "innovative technology" angle. **Grant timing is critical-path:** the big call is ~annual (2025 call ran Nov 24 2025 – Jan 9 2026); missing the window costs ~12 months. Mitigation: start the free CzechInvest pre-incubation consultation immediately; run a faster innovation voucher in parallel.

### 6.2 Milestone ladder
| Milestone | Paid | MRR | ARR | Funding | Primary motion |
|---|---|---|---|---|---|
| **M0** | ~20 | ~$500 | ~$6k | Bootstrap | Founder-led, do-things-that-don't-scale |
| **M1** | ~50–80 | ~$1.5–2k | ~$20k | Grant 1 | Founding cohort + school pilots |
| **M2** | ~500 | ~$14k | ~$170k | Grant 2 | PLG engine + referral live + partnerships |
| **M3** | ~1,500 | ~$42k | ~$500k | Grant + revenue | **English-market entry**, paid ads on proven funnel |
| **M4** | ~3,000 | ~$84k | **$1M** | Revenue-funded + optional raise | English leadership, LATAM upside |

### 6.3 24-month quarterly roadmap
| Qtr | Months | Paid (end) | ARR | Focus |
|---|---|---|---|---|
| Q1 | 1–3 | ~20 | ~$6k | s.r.o. registered, billing MVP, M0 founder-led sales |
| Q2 | 4–6 | ~80 | ~$20k | Grant 1 applied, founding cohort, school pilots, **bizdev hired** |
| Q3 | 7–9 | ~250 | ~$70k | Grant 1 in, referral live, PLG cadence |
| Q4 | 10–12 | ~500 | ~$170k | Technology Incubation secured, partnerships repeatable |
| Q5 | 13–15 | ~900 | ~$300k | English-market entry begins |
| Q6 | 16–18 | ~1,500 | ~$500k | English content/influencer engine, paid ads scaling |
| Q7 | 19–21 | ~2,200 | ~$740k | English-market leadership push |
| Q8 | 22–24 | ~3,000 | **$1M** | LATAM upside, retention/onboarding compounding |

### 6.4 Critical-path dependencies (in order)
1. Register Czech s.r.o. (gates grants + Paddle).
2. Ship billing MVP (two tiers + reverse-trial + Paddle) so you can charge the first 20.
3. Get 20 paid (M0) — proof.
4. Apply for grant(s) using that proof.
5. Deploy grant into PLG + referral engine.
6. Pivot acquisition to English markets for the back half.

**Feasibility (honest):** 24 months grant+revenue-only is aggressive-but-doable IF (1) base-case conversion (≥15%), (2) English entry in the back half works, (3) nearly all gross profit is reinvested. Bear-case conversion (10%) slips toward 36 months. Biggest schedule risk = grant timing; biggest strategic hinge = English-market entry (Q5) — de-risk by starting English content in Q4.

---

## 7. Channel playbook (the execution layer)

**Core POV (this corrects the old Google-Ads-first framing):** for a niche prosumer tool with a solo founder, thin search volume, and an audience that lives in Telegram/Instagram, **paid search is NOT the first channel.** Fastest + cheapest traction = warm communities + school partnerships + founder content. Paid comes later and small, with **Meta/Instagram ahead of Google Search**.

### 7.1 Channel portfolio
| # | Channel | Market | Cost | Speed | Leverage | Cheapest first test | Phase |
|---|---|---|---|---|---|---|---|
| 1 | Direct outreach in astro-Telegram/IG | RU/UA | $0 | days | med | 20 personal DMs + demo | **P0 now** |
| 2 | **Astrology-school partnerships** | RU/UA→EN | $0 | weeks | **very high** (student cohorts) | 2–3 conversations, 1 pilot | **P0 now** |
| 3 | Practicing-astrologer influencers (free tool + affiliate) | both | $0–low | days–weeks | high | 3–5 micro-deals | P0–P1 |
| 4 | Founder content (IG/Telegram/YouTube on the pain) | both | $0 | compounds | high | 1 post/video per week | **P1 parallel** |
| 5 | SEO: alternative pages (Chronos/Solar Fire/Astrolium alternative) + category | EN > RU | $0 | months | high | 3 pSEO pages | P1 |
| 6 | AI-SEO (citations in ChatGPT/Perplexity) | EN | $0 | months | med | llms.txt + 1 answer page | P1 |
| 7 | Directories (Product Hunt, BetaList, AlternativeTo, SaaSHub, AI dirs) | EN | $0 | days | med (backlinks + discovery) | 10 submissions | P1 |
| 8 | **Meta/Instagram Ads** (demand-gen, visual) | EN+RU | $ | days | **higher than Search for this niche** | $10–15/day, 1 angle | **P2 (before Search)** |
| 9 | Google Search Ads (**conquest + category only**) | EN | $ | days | med (thin volume) | $20/day, phrase/exact | P2 |
| 10 | Telegram channel sponsorship/Ads | RU/UA | $ | days | med | 1–2 niche channels | P2 |
| 11 | Referral program (§5) | both | forgone rev | after first paid | high | "give a month / get a month" | P3 |
| 12 | PR / podcasts / launch moment | both | $0 | weeks | med (trust + grant narrative) | 5 podcast pitches | P3 |

### 7.2 Sequencing & cadence
- **P0 (weeks 1–4): founder engine** (1–3). Goal = first 20 paid + 3 testimonials + verbatim + grant proof. **White-glove onboarding = activation + verbatim research + testimonials in one motion.**
- **P1 (parallel from the start): compounding content/SEO** (4–7). Won't pay off for months — so start now.
- **P2 (after the funnel shows signal): small paid tests** (8–10), Meta/IG first, then Search-conquest. Tracking is live (see §9).
- **P3: referral + PR** (11–12) once there are paying users and testimonials.
- **Operating cadence:** one weekly GTM ritual (30–60 min) — update pipeline (leads → demo → trial → paid), read `sign_up`/activation in GA4/PostHog, pick 1–2 experiments for the week. Single funnel spine: **trial_start → activation → paid**.

---

## 8. Paid acquisition specifics

### 8.1 Meta / Instagram (P2, run before Search)
Demand-gen for a visual audience that lives on IG. Angle off the hero (capture the consultation) + product screenshots/short video of record → transcript → summary. Start $10–15/day, one angle, optimize to `sign_up`. *(Detailed creative angles: to be drafted via the `ad-creative` skill.)*

### 8.2 Google Search (P2, conquest + category only)
- **Role:** precision capture, not volume. English-first (US/UK/CA/AU).
- **Account structure:** one Search campaign, 3 ad groups — AG1 desktop-switch/conquest (Solar Fire/Astro Gold/cloud), AG2 workspace conquest (Astrolium/LUNA/"astrology software with CRM"), AG3 problem/category ("astrology practice management", "record astrology consultation").
- **Keywords:** phrase/exact only at launch. **Negatives (≥8):** free horoscope, daily horoscope, tarot, psychic, love compatibility, zodiac meaning, kundli, numerology, co-star, crack/torrent, course/jobs.
- **Bidding:** Manual CPC / Maximize Clicks with cap until ~30–50 conversions, then Maximize Conversions/tCPA.
- **Budget:** $20–30/day test. Read CTR + cost-per-trial after ~$600–900.
- **Compliance:** never use a competitor trademark in ad *text* (keyword is fine); confirm astrology-ads policy/account standing.

**Ready-to-load RSAs** (15 headlines ≤30 chars, 4 descriptions ≤90 chars, 3 RSAs mapped to the 3 ad groups) are preserved in git history of the former `docs/MARKETING_ANALYSIS_AND_GOOGLE_ADS_PLAN.md`; regenerate/refresh via the `ads` skill when launching, since headline #1 should reflect the current hero ("Everything about every person…") and Pillar 1 ("Works on Mac & Windows"). Do not put "Solar Fire"/"Astrolium" in headline text.

---

## 9. Measurement

### 9.1 Live status (2026-06-25)
- **GA4 + PostHog both live in prod** via `runtime-config.js` + `app/frontend/js/analytics.js` (`window.AstroAnalytics.track`), Consent Mode v2 + GDPR banner. GA4 Measurement ID `G-4G1GPY7RBE` (property 543015333). Verified: page_view + custom events reach GA4 realtime.
- **Conversion event = `sign_up`** (login.js register success) — marked key event in GA4, imported into Google Ads as a Sign-up conversion (Primary, Active). *(Note: `trial_start` is NOT used — the prod event is `sign_up`.)*
- Other events emitted: `login`, `begin_checkout`, `consultation_started`, `consultation_completed`. `purchase` still needs server-side Measurement Protocol from the Paddle webhook (follow-up).

### 9.2 North Star + funnel
**NSM = Weekly Active Astrologers doing real client work** — distinct astrologer/week who did ≥1 value action (`chart.create`, `client.natal.open`, or `call_session.create`). Vanity logins excluded.

**AARRR spine:** Acquisition → Trial start → **Activation** → Paid → Expansion → Referral.
- **Activation** = saved a real client + ran one consultation in first 3 days (strongest conversion predictor; 43% of churn is in first 90 days → onboarding is the #1 retention lever).
- North-star: trial→paid (target 15–25%). Watch: Standard/Pro mix, monthly churn (<5%), annual take rate, referral share.

### 9.3 Instrumentation gaps → tasks
Server-side telemetry lives in `audit_events` (~70 actions already emitted — enough for most acquisition/activation/retention/engagement metrics today).
| # | Gap | Blocks | Priority |
|---|---|---|---|
| G1 | No `properties JSONB` on audit rows | tier-at-event splits, duration, structured context | **P1** |
| G2 | No UTM/referrer at signup | channel mix, "international demand by channel" | **P1** |
| G3 | No `session_id` | sessions, session length, bounce | P2 |
| G4 | No raw pageviews server-side | navigation/funnel, time-on-page | P2 (PostHog covers client-side) |
| G5 | No billing events | trial→paid, MRR, ARR, churn, LTV:CAC | P2 (Paddle webhooks) |
G1 is a dependency of G2/G3 — ship the JSONB column first. P1 items are cheap and unblock the most grant-relevant story (channels).

### 9.4 Grant KPI framing (CzechInvest rubric)
- **Innovation/R&D:** AI engagement share (assistant + recorded-call auto-processing), AI inference volume, proprietary ephemeris/orb depth → "AI-driven astrology workbench", not "another SaaS form".
- **Market validation / international demand:** paying customers across ≥N countries (geo-diverse *paying* base = export-capable signal), signup/activation by region, organic vs paid, WTP by region.
- **Scalability/unit economics:** ~84% gross margin, cost per active user (VM + $0.37/call), sublinear infra-vs-MAU growth.
- **Traction milestones:** the §6.2 ladder as the quarterly KPI table.

---

## 10. Localization (cross-cutting)
RU / UK / EN must cover the **entire** monetization + marketing surface from launch: pricing, checkout, paywall, trial banners, dunning emails, referral invites/reward emails, ad copy, landing. A half-translated checkout or English-only "trial expired" email kills non-English conversion. The i18n layer makes ES/PT (LATAM, Phase 3) cheap to add. RU *language* serves Ukrainian/diaspora speakers — it is NOT selling inside Russia (keep sanction/payment decisions separate).

---

## 11. Open decisions & next actions

**Open decisions:**
- Trial length 14 vs 21 days (referral reward assumes 21 for referred users).
- Annual discount exact %: 20 vs 26.
- Founding-member offer: lifetime locked discount (e.g. Standard €15) for first cohort — confirm.
- Grace period on past_due before `expired` (e.g. 7 days).
- Recording retention window (90 days proposed).
- Pricing response to Astrolium's Free/$11 anchor (hold vs adjust) — decide after the English price test.

**Immediate next actions (founder-side, ready to execute):**
1. **P0 outreach** — DM practicing astrologers in UA/RU Telegram/IG + line up 2–3 school conversations (assets: outreach templates — to draft via `cold-email`/`copywriting`).
2. **White-glove onboard** each signup; capture verbatim + a testimonial.
3. **Czech s.r.o. + CzechInvest pre-incubation consultation** (gates grants).
4. **Billing MVP** (two tiers + reverse-trial + Paddle) so the first 20 can pay.
5. In parallel: start P1 content/SEO (3 alternative pages) + 10 directory submissions.

**Assets still to produce (offer):** outreach templates (RU/UK/EN), directory submission list + texts, 4-week content calendar, Meta/IG ad angles, conquest landing page, refreshed Google RSAs.

---

*Cross-references: positioning → [`.agents/product-marketing.md`](.agents/product-marketing.md). Memory: [[project-monetization-gtm]], [[competitor-astrolium-dualtrack]], [[grant-metrics-plan]], [[google-ads-ga4-mcp]], [[copywriting-voice]].*

# Product Marketing Context

*Last updated: 2026-06-24*

> V1 auto-drafted from the codebase (README, prior planning docs now consolidated into [STELIARA_GTM_MASTER_PLAN.md](../STELIARA_GTM_MASTER_PLAN.md)) and prior product work. Review and correct; flagged uncertainties marked with ⚠️.

## Product Overview
**One-liner:** Steliara — the daily workspace for practicing astrologers: charts, the people you read for, forecasts, and recorded consultations in one place.
**What it does:** Calculates natal charts and forecasts on the Swiss Ephemeris engine, keeps a profile for every person you read for (notes, recordings, charts), and runs video consultations with recording, transcription, and AI session summaries. A chat assistant answers questions fast from the chart data.
**Product category:** Professional astrology practice software (chart calculation + practice management + consultations).
**Product type:** SaaS (web app).
**Business model:** Subscription. 14-day full-feature reverse trial (no card). Two sellable tiers: **Standard $24/mo** ($19 annual) and **Pro $39/mo** ($29 annual). Lapsed accounts go read-only (`expired`), not locked. Double-sided referral ("give a month, get a month"). Provider: Paddle (Merchant of Record).

## Target Audience
**Target companies:** Solo practitioners and small practices — not enterprises. Primarily Ukrainian + English-speaking (international/diaspora) astrologers; RU as a third UI language. **Not a Russia-market play.**
**Decision-makers:** The individual astrologer (they are user, buyer, and decision-maker). Secondary: astrology schools (partnership/pilot channel).
**Primary use case:** Run a real reading practice end to end — calculate the chart, prep, hold the consultation, capture what was said, follow up.
**Jobs to be done:**
- "Give me an accurate chart and forecast fast so I can prep for a reading."
- "Hold a consultation and remember everything that was said without taking notes the whole time."
- "Keep the history of everyone I read for in one place so I'm not scrambling across tools."
**Use cases:**
- Pre-session chart + forecast prep.
- Live recorded video consultation → transcript → AI summary.
- Looking back at a person's past sessions, notes, and charts before a follow-up.
- Asking the chat assistant a quick interpretation question grounded in the chart.

## Personas
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Practicing astrologer (solo) | Accurate calculations, looking professional, not losing session context | Juggling chart software + notes + Zoom + spreadsheets | One workspace for charts, people, and recorded sessions |
| Astrology school ⚠️ | Training students on real tools, student retention | No practice-grade tool to standardize on | Extended student trials / partnership pricing |

## Problems & Pain Points
**Core problem:** A practicing astrologer's work is scattered across chart software, video calls, and ad-hoc notes — and the substance of each consultation evaporates the moment the call ends.
**Why alternatives fall short:**
- Classic chart software calculates but has no concept of the people you read for or your sessions.
- Generic CRMs/calendars don't understand charts or astrology.
- Zoom + manual notes means no transcript, no summary, no searchable history.
**What it costs them:** Time lost re-prepping, weaker follow-ups, an unprofessional patchwork, and forgotten consultation detail.
**Emotional tension:** Wanting to be fully present with the person in front of them instead of scrambling between tools and frantically taking notes.

## Competitive Landscape
*(Researched June 2026. The market splits by region — the tools your UA/RU + diaspora audience actually uses are NOT the Western desktop incumbents.)*

**Direct — astro-processors your audience uses today:**
- **Chronos (chronos.mg)** — the dominant online astro-processor in the UA/RU world. Strong chart calculation, dispositor/strength analysis, forecasts, daily recommendations, and a consultation-booking layer. **Falls short:** no recorded video consultations, no transcription, no AI session summaries — the consultation itself isn't captured. This is Steliara's clearest wedge.
- **Matryoshka-Astro (matryoshka-astro.com)** — pro astro-processor (transits, directions, progressions, synastry). Calculation-focused; no session capture or practice management.
- **Astro.expert** — lets astrologers save observations/notes per chart and prep for repeat consultations — closest to "practice management," but still no recorded/transcribed/summarized sessions.

**Western incumbents (calculators):** Solar Fire (~$700+ perpetual, Windows, industry standard), Astro Gold (Mac/iOS), TimePassages. Powerful calculators with report writers, but desktop-era, single-user, no built-in consultations or session capture.

**⚠️ KEY ENGLISH-MARKET COMPETITOR — Astrolium (astrolium.com):** Modern cloud "one workspace for working astrologers: charts, transits, synastry, returns, built-in client CRM, and an AI trained on the craft." Nearly identical *vision* to Steliara, already shipping, English-native. Pricing **Free / $11 (Pro+AI) / $29 / $79 (3 seats, team roles)**; founding members get 6 months free. **Where Steliara still leads (June 2026):** Astrolium does NOT yet host video calls, record, or transcribe — "audio session recording is on the way" (roadmapped, not shipped). So Steliara's live recorded+transcribed+summarized *consultation* is a real but **time-boxed** advantage. **Strategic implications:** (1) Astrolium's Free/$11 tiers set a low reference price that undercuts Steliara's $24/$39-no-free-tier model — the "kill the cheap anchor" logic assumed no competitor anchor; one now exists. (2) Don't position as "another astrologer workspace + AI" (Astrolium owns that sentence) — position on the live consultation capture they lack. (3) Astrolium is NOT localized for UA/RU, where Chronos (calc/forecast only) doesn't do this workspace play — so RU is currently competitor-thin for this category.

**Secondary:** Zoom/Google Meet/Telegram video + Notion/Google Docs + a spreadsheet — fragmented, no astrology awareness, no automatic session capture.

**Indirect:** Free one-off chart sites (Astro-Seek, Astrodienst/astro.com, GEOCULT) and AI "personal astrologer" chatbots (Jenova, AstroSage AI) — these serve *end clients*, not the practicing astrologer's workflow, but anchor people's expectations of "free charts."

## Differentiation & Positioning Hierarchy
**Lead with ONE hero message + 3 supporting pillars. Don't flatten them into a list — "say everything" = "say nothing."**

**HERO (always lead here — unique + provable):**
> Everything about every person you read for — charts, notes, and the actual **recorded consultations** — in one place. You never have to remember what you said last time or what they told you: it's all already here.
- Fuses "capture the consultation" + "everything in one place" into one promise with an emotional core (removes the memory burden). No competitor ships this.

**PILLAR 1 — Works everywhere** *(concrete fact; conquers Solar Fire specifically)*
- Cloud web app: macOS, Windows, any browser/device. Beats Windows-only Solar Fire and Apple-only Astro Gold. Use heavily in desktop-conquest ads.

**PILLAR 2 — Genuinely easy / a new level of convenience** *(experience; counters "clunky / learning curve")*
- Say it human, NOT "UX": "much simpler and nicer to use than the old programs." Support claim, not the lead (everyone claims "modern"; hard to prove in one line).

**PILLAR 3 — Saves time on client context** *(benefit; a consequence of the hero)*
- No re-assembling a person's history before each session, no digging through files. Their charts, past consultations, and context are already in front of you → less prep, easier work.

**Underlying capabilities (the proof beneath the pillars):**
- Recorded video consultations + transcription + AI summaries (near-zero marginal cost, ~95% margin — structural moat; the proof for HERO).
- A profile per person you read for: notes, recordings, charts together (proof for HERO + Pillar 3).
- Swiss Ephemeris accuracy with practice-grade orbs tuned with a professional astrologer (Alyona's table) — table-stakes credibility.
- A chat assistant that answers fast from the actual chart data.

**Why customers choose us:** It's built for the working day of a real practicing astrologer — the consultation and the person, not just the chart — and it works anywhere, with everything in one place.

**Messaging rule:** never lead with "another astrologer workspace + AI" (Astrolium owns that). Lead with the HERO; reinforce with the pillars in this priority order.

## Objections
| Objection | Response |
|-----------|----------|
| "I already use Chronos / my astro-processor." | Steliara isn't trying to replace your calculations — it adds what they don't: the people you read for in one place, plus recorded, transcribed, and summarized consultations so nothing from a session is lost. Run it free for 14 days alongside what you use. |
| "Is AI going to get the astrology wrong / replace my judgment?" ⚠️ | The assistant works from your chart data to save prep time; you stay the interpreter. Summaries capture what *you* said. |
| "Will my clients' data and recordings be safe?" ⚠️ | (confirm storage/retention + consent story — recordings auto-expire policy in monetization plan.) |

**Anti-persona:** Hobbyists who just want a free one-off chart; anyone wanting a consumer "read my horoscope" app; the Russia market.

## Switching Dynamics
**Push:** Tired of stitching chart tool + Zoom + notes; losing what was said in sessions.
**Pull:** One place for charts, people, and recorded/summarized consultations.
**Habit:** Comfort with existing chart software and personal note style.
**Anxiety:** Migrating existing client history; trusting accuracy; recording/consent and data safety. ⚠️

## Customer Language
*(V1 from community/desk research, June 2026. Sources are RU astrology-school/business content + market research — themes are well-supported, but true word-for-word verbatim from individual practitioners still needs first-party mining via Telegram channels, school communities, and founding-cohort interviews — web search can't reach inside those.)*

**Research-backed themes (with confidence):**

| Theme | What the audience says / does | Confidence | Implication for Steliara |
|-------|-------------------------------|------------|--------------------------|
| Recording sessions is already the norm | Astrologers tell clients to "record on a dictaphone — you'll only remember 20–30%." Sessions run 1–2+ hrs. | **High** (3+ independent RU sources) | Don't sell "recording" as new — sell *automatic* recording + transcript + summary the astrologer keeps. Productizes an existing habit. |
| Astrologers forget what they told each person | Even specialists struggle to recall what was said to whom; advised to keep notes/checklists post-session. | **High** | Core wedge: the session's substance is captured for you, searchable later. |
| Interpretation is slow, prep-heavy | "10–15 components per chart, 15–30 min each; takes ~10,000 hrs to read fast." | **Medium** | Fast accurate charts + a chart-aware assistant = real time saved on prep. |
| Burnout / overload | "Feels like I put in far more energy than I'm paid for"; emotional exhaustion, juggling everything. | **Medium** | One calm workspace reduces tool-juggling friction; frame around relief, not "productivity." |
| Finding/keeping clients is a constant worry | Heavy RU content market on "where astrologers find clients," multichannel advice. | **Medium** | Adjacent pain (acquisition) — not core product, but resonant in outreach/content. |
| Chronos is the default, but fragmented | Praised for calculation/forecasts; users still bolt on a separate recorder + notes. | **Medium** | Position as additive to the calculator they trust, not a replacement. |

**How they describe the problem (paraphrased themes — replace with verbatim when captured):**
- "После консультации часть инсайтов быстро забывается" / clients (and astrologers) forget most of what was said.
- Sessions are long (1–2+ hrs) and must be recorded to be useful later.
**How they describe us:** ⚠️ *(needs verbatim — capture from founding-cohort testimonials)*
**Words to use:** "practice," "the people you read for," "sessions/consultations" (RU: «консультация»), "readings"; «расшифровка»/«запись консультации» (transcript/recording — already-familiar terms); human and warm language.
**Words to avoid:** "clients" (prefer "people"/"practice"), "CRM," and AI/business/tech jargon in user-facing copy — keep it soft and human. Avoid anything that reads like enterprise SaaS.
**First-party research still needed:** raw verbatim from (1) UA/RU astrology Telegram channels, (2) astrology-school student/grad communities, (3) 5–10 founding-cohort interviews. Highest-leverage remaining gap.
**Glossary:**
| Term | Meaning |
|------|---------|
| Forecast | Time-based/transit predictions view |
| Profile | A record for a person you read for (notes, recordings, charts) |
| Septener | The 7 classical planets used in the psychological profile |
| Orbs | Allowed degrees of deviation for an aspect (tuned per Alyona's table) |
| Reverse trial | 14-day full-Pro trial; lapses to read-only, not locked |

## Brand Voice
**Tone:** Soft, warm, human.
**Style:** Conversational and plain; not corporate, not techy.
**Personality:** Calm, supportive, professional, grounded, human.

## Proof Points
**Metrics:** ⚠️ *(early stage — capture once founding cohort lands)* Target funnel: ~15% trial→paid, ~4% monthly churn, ~$28 blended ARPU.
**Customers:** ⚠️ First founding cohort being recruited (M0: first 20 paid).
**Testimonials:** ⚠️ *(collect 3+ written testimonials from founding members)*
**Value themes:**
| Theme | Proof |
|-------|-------|
| Accuracy you can trust | Swiss Ephemeris + professional orb table |
| Never lose a session | Recording + transcription + AI summaries |
| Your whole practice in one place | Charts + people profiles + consultations |

## Goals
**Business goal:** Bootstrap to ~20 paid (M0) → grant funding → $1M ARR (~3,000 paid, M4).
**Conversion action:** Start the free 14-day trial → activate (first chart + first consultation) → convert to Standard/Pro.
**Current metrics:** ⚠️ *(instrument and fill: trial starts, activation rate, trial→paid, churn)*

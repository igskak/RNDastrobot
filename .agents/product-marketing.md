# Product Marketing Context

*Last updated: 2026-09-29*

> V1 auto-drafted from the codebase (README, prior planning docs now consolidated into [STELIARA_GTM_MASTER_PLAN.md](../STELIARA_GTM_MASTER_PLAN.md)) and prior product work. Review and correct; flagged uncertainties marked with ⚠️.
>
> **2026-09-29 refresh.** Pricing, plan contents, recording, retention and the chart importer were re-checked against the code and the live site; competitor facts carry the date and source of the check. The weekly SEO content agent reads this file before writing any page, so a stale line here becomes a wrong sentence on the site. Anything a page claims about Steliara must be traceable to this file or to the shipped product.

## Product Overview
**One-liner:** Steliara — the daily workspace for practicing astrologers: charts, the people you read for, forecasts, and recorded consultations in one place.
**What it does:** Calculates natal charts and forecasts on the Swiss Ephemeris engine, keeps a profile for every person you read for (notes, recordings, charts), and runs video consultations whose **audio** is recorded (never the video), transcribed, and summarized. A chat assistant answers questions fast from the chart data. Existing charts can be imported from ZET, Astro.com, Solar Fire / Astro Gold and Astrolog.
**Product category:** Professional astrology practice software (chart calculation + practice management + consultations).
**Product type:** SaaS (web app).
**Business model:** Subscription. 14-day trial with every feature unlocked, no card. Two sellable tiers (live pricing page, 2026-09-24):
- **Practitioner — $24/mo, or $20/mo billed annually.** Natal and transit charts, unlimited profiles for the people you read for, notes, forecast timeline and tables, multiple house systems, email support. *(Internal plan id: `standard`.)*
- **Studio — $39/mo, or $32/mo billed annually.** Everything in Practitioner, plus **session recordings, automatic consultation summaries**, and fast factual answers from the chart data during a session. *(Internal plan id: `pro`.)*

Recording, transcripts and summaries are **Studio only** — say which plan whenever a price appears next to the recording story. ⚠️ Open decision: the pricing page lists the chat assistant under Studio, but entitlements currently also enable it on Practitioner; until that is settled, do not claim the assistant at $24.

Lapsed accounts go read-only (`expired`), not locked; charts and records are kept. Double-sided referral ("give a month, get a month"). Provider: Stripe (Stripe Managed Payments, Merchant of Record); Paddle kept as an alternate adapter.

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

**Western incumbents (calculators):** Solar Fire, Astro Gold, TimePassages. Powerful calculators with report writers, but desktop-era, installed per computer, no built-in consultations or session capture described on their pages.
- **Solar Fire X** — ⚠️ **corrected 2026-10-28: Solar Fire is no longer Windows only.** Solar Fire X is a **native Mac app** (macOS 14+, Intel and Apple silicon, "Parallels and Windows are not required") and also runs on Windows 10 and 11. US$360 new, US$99 upgrade from Solar Fire 9 (US$129 from 8, up to US$325 from 2–4). A licence covers up to two computers. **No iPad, iPhone, Android, Linux or tablet version** (its FAQ says so). It imports Solar Fire 9 libraries with a migration utility. Solar Fire 9 is no longer sold; for 9 and earlier the maker still says "We do not officially support Solar Fire on the Mac" (Intel Mac plus Windows emulation). Feature pages cover charting, maps, midpoints, forecasting, research, reports, interpretations, Vedic, astrocartography, electional, traditional, harmonic. The counts "30 house systems, 50 points, 110+ wheels" come from the **Solar Fire 9** page; no count found for X. *(sfx.alabe.com/system-requirements, /faq, /features, alabe.com/solar-fire-x-buy.html and /solar-fire-x-order.html, checked 2026-10-28.)* **Never write "Solar Fire has no Mac version" again.** Whether Solar Fire X saves `.SFcht` files is untested: our importer is verified against Solar Fire 9 files and text exports.
- **Astro Gold** — $249.99 for macOS; made by Solar Fire's creators, chart files interchangeable with Solar Fire. **Not Apple-only:** astrogold.io sells Windows, macOS, iOS and Android versions. *(astrogold.io, price checked 2026-09-28, platforms 2026-10-03.)*
- The SERP for "solar fire for mac" was a Change.org petition and a Facebook support group (September 2026). That demand is now answered by the maker itself, since Solar Fire X ships natively on Mac; `/solar-fire-alternative` and `/answers/best-astrology-software-for-mac` were rewritten on 2026-10-28 to say so.

**⚠️ KEY ENGLISH-MARKET COMPETITOR — Astrolium (astrolium.com):** Modern cloud "one workspace for working astrologers: charts, transits, synastry, returns, built-in client CRM, and an AI trained on the craft." Nearly identical *vision* to Steliara, already shipping, English-native. Pricing **Free / $11 (Pro) / $29 (Adept) / $79 (Master, team)**, plus a $12 Personal plan *(astrolium.com/pricing, re-checked 2026-10-05, unchanged)*. The "founding members get 6 months free" offer is gone from their homepage and pricing page as of 2026-10-05; the hero now leads with "Start on the free tier: no card, five clients, all 23 house systems." Their FAQ also states 23 house systems, AES-256 at rest with EU hosting on Hetzner, and a self-serve JSON data export. **Where Steliara still leads:** Astrolium does NOT yet host video calls, record, or transcribe. A June 2026 note said "audio session recording is on the way", but on 2026-10-05 recording appears nowhere on their pricing page, FAQ, /compare hub or public roadmap, in any state (shipped, next, V2, decided against). Say "their pages do not mention it as of <date>", never "they cannot". So Steliara's live recorded+transcribed+summarized *consultation* is a real advantage; absence from their roadmap means it is not obviously time-boxed, but it is no promise either. **Strategic implications:** (1) Astrolium's Free/$11 tiers set a low reference price that undercuts Steliara's $24/$39-no-free-tier model — the "kill the cheap anchor" logic assumed no competitor anchor; one now exists. (2) Don't position as "another astrologer workspace + AI" (Astrolium owns that sentence) — position on the live consultation capture they lack. (3) Astrolium's interface is not known to be localized for UA/RU (unchecked; their Report Studio does write client documents in seven languages including Russian and Ukrainian, and the AI answers in Russian), while in RU/UA Chronos (calc/forecast only) doesn't do this workspace play — so RU is currently competitor-thin for this category.

**Watch — sacredsystems.io ("Sacred Scribe"):** surfaced 2026-09-24 in the top 5 for "astrology software that records client sessions". Search snippets describe turning the astrologer's own dictated interpretation into a client report — adjacent to our differentiator, but a solo voice memo, not the two-way consultation. ⚠️ Unverified: the site renders client-side and could not be read. Check by hand before any comparison page names it.

**Secondary:** Zoom/Google Meet/Telegram video + Notion/Google Docs + a spreadsheet — fragmented, no astrology awareness, no automatic session capture.

**Indirect:** Free one-off chart sites (Astro-Seek, Astrodienst/astro.com, GEOCULT) and AI "personal astrologer" chatbots (Jenova, AstroSage AI) — these serve *end clients*, not the practicing astrologer's workflow, but anchor people's expectations of "free charts."

## Differentiation & Positioning Hierarchy
**Lead with ONE hero message + 3 supporting pillars. Don't flatten them into a list — "say everything" = "say nothing."**

**HERO (always lead here — unique + provable):**
> Everything about every person you read for — charts, notes, and the actual **recorded consultations** — in one place. You never have to remember what you said last time or what they told you: it's all already here.
- Fuses "capture the consultation" + "everything in one place" into one promise with an emotional core (removes the memory burden). No competitor ships this.

**PILLAR 1 — Works everywhere** *(concrete fact; conquers Solar Fire specifically)*
- Cloud web app: macOS, Windows, any browser, **including a tablet or phone**. **No longer beats Solar Fire on "Mac"**: Solar Fire X is native on Mac and Windows. What still holds against it: it has no iPad, iPhone or Android version and is installed on up to two computers; ZET still runs on a Mac only through emulators (ZET's own site: "only through emulators" such as Parallels or CrossOver). Do **not** frame Astro Gold as Apple-only — it ships on Windows and Android too; against it the argument is the people you read for and the recorded consultation, not the platform. Use heavily in desktop-conquest ads.

**PILLAR 2 — Genuinely easy / a new level of convenience** *(experience; counters "clunky / learning curve")*
- Say it human, NOT "UX": "much simpler and nicer to use than the old programs." Support claim, not the lead (everyone claims "modern"; hard to prove in one line).

**PILLAR 3 — Saves time on client context** *(benefit; a consequence of the hero)*
- No re-assembling a person's history before each session, no digging through files. Their charts, past consultations, and context are already in front of you → less prep, easier work.

**Underlying capabilities (the proof beneath the pillars):**
- Video consultations with the **audio** recorded, transcribed and summarized (near-zero marginal cost, ~95% margin — structural moat; the proof for HERO). Recording starts only after both sides agree. Studio plan.
- **Chart import from the tools people already use:** ZET (`.zbs`), Astro.com / AAF, Solar Fire and Astro Gold (`.SFcht`), Astrolog (`.as`), and Solar Fire text exports — up to 5 MiB and 2,000 records per file, possible duplicates flagged, notes on a source chart carried over (every format except Astrolog). Subsidiary charts inside a Solar Fire record and the source program's calculation settings are *not* carried over. *(`app/services/chart_import/`, `page.accountSettings.import` in the catalog.) For an alternative page this is the strongest line available: the incumbent's own file opens here.*
- A profile per person you read for: notes, recordings, charts together (proof for HERO + Pillar 3).
- Swiss Ephemeris accuracy with practice-grade orbs tuned with a professional astrologer (Alyona's table) — table-stakes credibility.
- Tropical and sidereal zodiac, with five ayanamshas (Lahiri, Fagan-Bradley, Krishnamurti, Raman, De Luce); six house systems in the UI. *(`common.zodiac` and the house-system keys in the catalog.)*
- A chat assistant that answers fast from the actual chart data.
- **A phone layout built for the work screen, and voice commands on top of it** *(added 2026-10-20, checked against `forecast-new.css` phone tier ≤640px, `chat.js` and `entitlements_service.py`)*. The forecast workspace has a dedicated phone layout (chart on top, panels switched with a segmented control, menus as bottom sheets). On it you can tap the mic, say what you want done, and tap again: a spoken request like "add transits for November 1" is transcribed and applied to the workspace, with a one-tap undo; destructive changes (removing a layer) ask first. Spoken commands today: set or step the transit date, add or remove a layer (transits, progressions, directions, solar return, synastry partner), build a solar return for a year, switch single/multi wheel, change house system, open a synastry with a saved chart by name. Speaking beats tapping nested date pickers on a small screen, which is the whole point.
  - **Plan:** the mic and voice commands are **Studio only** (`transcription_enabled`), plus the 14-day trial. The phone layout itself is on every plan. Typed assistant commands follow the assistant's own open decision above.
  - **Say honestly:** it is the web app in a phone browser, not a native iOS/Android app; voice is tap-to-talk (one tap starts it, the next tap stops and sends; it records only between the two taps, never always-listening or hands-free), needs microphone permission and a browser with `MediaRecorder`; it acts on the workspace and finds facts, it does not interpret. Mobile is a convenience layer next to the desktop workspace, which stays the main surface; do not call the phone version "full-featured" without naming what is missing.
  - ⚠️ No measured claim yet on how fast or accurate transcription is. Do not write "instant" or "accurate" about the voice.

**Why customers choose us:** It's built for the working day of a real practicing astrologer — the consultation and the person, not just the chart — and it works anywhere, with everything in one place.

**Messaging rule:** never lead with "another astrologer workspace + AI" (Astrolium owns that). Lead with the HERO; reinforce with the pillars in this priority order.

## Honest gaps (say them on comparison pages)

A comparison that finds nothing good about the alternative reads as marketing and gets cited by nobody. These are where desktop incumbents are genuinely stronger. Verified by absence in the codebase on 2026-09-28 — recheck before relying on one, since absence is the weaker kind of proof:

- **House systems:** six in the UI (Campanus, Equal, Koch, Placidus, Regiomontanus, Whole Sign) against Solar Fire's 30 and Astrolium's 23 (on its free tier). The engine normalizes more codes than the UI exposes; claim the number a user can pick.
- **No astrocartography / astro-mapping.**
- **No Vedic dasas or nakshatras.**
- **No written interpretation reports** — by design, the assistant finds facts and does not interpret.
- **One chart-wheel style**, no chart-art designer.
- **No offline mode** — it is a cloud app.
- **No native iOS or Android app** — the phone experience is the responsive web app. (Astro Gold, Astrolium and TimePassages ship store apps; check their pages the day you compare.)
- **No free tier** — Astrolium has Free and $11 plans against our $24 floor.
- **No horary, electional search, primary directions or Hellenistic time lords** — Astrolium ships all of these (astrolium.com/roadmap, 2026-10-05).
- **No self-serve data export.** Getting data out is a request handled under privacy §7, not a button. ⚠️ Terms §8 tells users "we recommend exporting any data you wish to keep" without a feature to do it — a product gap and a wording mismatch, flagged 2026-10-03 by the agent's cloud-page rebuild (PR #18). Do not claim one-click export.

## Objections
| Objection | Response |
|-----------|----------|
| "I already use Chronos / my astro-processor." | Steliara isn't trying to replace your calculations — it adds what they don't: the people you read for in one place, plus recorded, transcribed, and summarized consultations so nothing from a session is lost. Run it free for 14 days alongside what you use. |
| "Is AI going to get the astrology wrong / replace my judgment?" | **AI will never read a chart for you. It just finds the facts faster: the aspects, the exact dates, where a planet sits. You stay the astrologer; it does the digging.** The assistant retrieves data and time windows from the chart; it does not interpret. Summaries capture what *you* said. This is the trust line — use it to disarm the objection, not the hero. |
| "Will my clients' data and recordings be safe?" | Only the audio is recorded, never the video, and recording starts only when both sides agree. The audio is kept for six months and then deleted automatically; the transcript and summary stay on the profile until you delete them or close your account. You own your content, and personal data is never sold. *(Terms §5 and privacy §5; enforced by `recording_retention_service.py` for recordings made from 2026-09-26.)* Do **not** claim a storage region or encryption scheme — neither is stated publicly yet. |
| "Moving my existing charts over is too much work." | Import them: ZET, Astro.com, Solar Fire / Astro Gold and Astrolog files open directly, up to 2,000 charts per file, with duplicates flagged. Sessions recorded in other tools do not come across. |

**Anti-persona:** Hobbyists who just want a free one-off chart; anyone wanting a consumer "read my horoscope" app; the Russia market.

## Switching Dynamics
**Push:** Tired of stitching chart tool + Zoom + notes; losing what was said in sessions.
**Pull:** One place for charts, people, and recorded/summarized consultations.
**Habit:** Comfort with existing chart software and personal note style.
**Anxiety:** Trusting accuracy; recording/consent and data safety (now answerable — see Objections). Migrating existing charts is largely answered by the importer; migrating past *session history* from other tools is not.

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
| Reverse trial | 14-day trial with every feature unlocked; lapses to read-only, not locked |

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
**Conversion action:** Start the free 14-day trial → activate (first chart + first consultation) → convert to Practitioner/Studio.
**Current metrics:** ⚠️ *(instrument and fill: trial starts, activation rate, trial→paid, churn)*

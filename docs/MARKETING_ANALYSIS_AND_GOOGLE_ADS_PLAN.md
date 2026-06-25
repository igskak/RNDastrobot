# Steliara — Market Analysis & Google Ads Launch Plan

*Prepared 2026-06-25. Built on `.agents/product-marketing.md`, June 2026 desk research, and live GA4 data. Read that context file first.*

---

## 0. Executive summary & readiness verdict

**The honest headline: you are not yet ready to *scale* Google Ads — but you are ready to *prepare and run a small, instrumented test*.** Two hard blockers and one strategic caveat:

1. **No conversion tracking is live.** The Steliara GA4 property (`543015333`) recorded **~4 sessions in the last 90 days** and **0 conversions**. You cannot run conversion-optimized search campaigns with no conversion signal. This must be fixed before any spend. *(Blocker #1)*
2. **No landing page proven to convert cold traffic.** Founder-led/warm users ≠ cold paid clicks. *(Blocker #2)*
3. **Strategic caveat — search volume is thin.** "Astrology *practice* software" is a category you are partly *creating*. The high-intent terms have low volume; the high-volume terms ("astrology software", "natal chart") are polluted with hobbyists/consumers. Google Search is therefore a **precision conquesting + category-capture channel here, not a volume firehose.** Plan accordingly.

**Recommendation:** treat Google Ads as a **small, English-first validation test** ($20–30/day) of the dual-track thesis — *not* the primary M0 acquisition engine (that remains founder-led warm outreach in UA/RU, which is cheaper and competitor-thin). Fix tracking → ship a focused landing page → run conquesting + category ad groups → read intent before scaling.

---

## 1. Market analysis

### 1.1 Market size & tailwind
- Global astrology **app** market ~$4.75–5.7B (2025), growing ~20%/yr. This is mostly **consumer** (Co-Star, CHANI, The Pattern), NOT your market.
- Your market is the **professional astrologer tooling** sliver underneath it — far smaller, but underserved and higher-value-per-user. The consumer boom matters only as a *tailwind* (more people get readings → more demand for practitioners → more practitioners needing tools).

### 1.2 Segments & where they live
| Segment | WTP | Searches Google? | Reachability |
|---|---|---|---|
| **UA/RU + diaspora practicing astrologers** (core/M0) | Low–mid ($30–50/session) | Some (Chronos, «астропроцессор», «натальная карта») | **Warm network, Telegram, schools** — cheap, not via Google Ads |
| **English/US/UK pros** (high-value expansion) | **High ($100–400/session)** | Yes — software + competitor names | Google Search, communities, influencers — colder, pricier CAC |
| Hobbyists / students | ~$0 | Yes, high volume | Avoid in paid search (negative-keyword them out) |
| End clients (consumers) | n/a | Huge volume | **Not your buyer** — exclude aggressively |

### 1.3 Category dynamics (critical for paid search)
- **Western pros default to desktop incumbents**: Solar Fire (~$360–700, Windows, "kitchen sink" but clunky, learning curve), Astro Gold (Mac/iOS, cleaner), TimePassages, Kepler/Sirius. Free baseline = Astro.com (astro.com / astrodienst).
- **Cloud challengers are emerging**: LUNA (cloud, multi-device, low monthly), and **Astrolium** (the closest vision-match — see §3).
- **The wedge that has search-able pain**: switching from clunky desktop → cloud, and the recorded/transcribed/summarized **consultation** that *no* incumbent ships yet.

---

## 2. Pain & opportunity map

From community/desk research (RU sources strong; Western validated). Confidence noted.

| # | Pain (verbatim/observed) | Confidence | Opportunity / ad angle |
|---|---|---|---|
| 1 | **"Record it — you'll only remember 20–30%."** Recording sessions is already a norm in BOTH markets; astrologers manually record + send files. | **High** | Productize the habit: *automatic* record → transcript → AI summary. This is the headline angle. |
| 2 | **Astrologers forget what they told each person.** | **High** | "Never lose a session." Searchable history per person. |
| 3 | **Desktop software is clunky, single-device, dated.** (Solar Fire learning curve, Windows-only.) | High | Conquesting: "Solar Fire alternative", "cloud astrology software". |
| 4 | **Tool-juggling: charts + Zoom + notes + spreadsheet.** | Medium–High | "Your whole practice in one tab." |
| 5 | Prep is slow (15–30 min × 10–15 chart components). | Medium | Chart-aware assistant = faster prep. |
| 6 | Finding/keeping clients is a constant worry. | Medium | Adjacent — content/organic, not core paid-search. |
| 7 | Burnout/overload. | Medium | Frame around *relief*, not "productivity." |

**Biggest opportunity:** own the **"capture the consultation"** position before Astrolium ships its roadmapped audio recording. It is the one durable, demo-able differentiator and it maps to an existing behavior (so it needs zero behavior change to land).

---

## 3. Competitive positioning

| Competitor | What they are | Strength | Gap you exploit |
|---|---|---|---|
| **Chronos** (chronos.mg) | Dominant RU/UA astro-processor | Calc, dispositors, forecasts, booking | No recorded/transcribed/summarized sessions; not the "practice in one place" play |
| **Astrolium** (astrolium.com) | Closest vision-match, English, **pre-launch (<~1k target users, untracked traffic)**, by astrology-api.io team | Same "workspace+AI" pitch, competent infra, free tier | **No video calls / recording / transcription yet** (roadmapped). Their Free/$11 sets a low price anchor. |
| **Solar Fire / Astro Gold / Kepler** | Desktop incumbents | Deep calc, trusted, report writers | Desktop-era, single-user, no consultations or capture |
| **LUNA** | Cloud calculator | Multi-device, cheap | Calculator-first; no consultation capture |
| **Astro.com** | Free calc gold standard | Free, trusted | Not a practice tool at all |

**Positioning statement (working):**
> For practicing astrologers who run real consultations, **Steliara** is the cloud workspace that keeps **everything about every person you read for — charts, notes, and the actual recorded consultations — in one place**, so you never have to remember what you said last time. It runs in any browser on Mac or Windows, and it's far simpler to use than the old desktop programs. Unlike desktop tools (Solar Fire, Windows-only) or chart-first cloud apps (Astrolium, LUNA), the *consultation itself* is captured — not just the chart.

**Messaging hierarchy (use this priority in every ad/landing):**
1. **HERO** — everything in one place + recorded consultations → *you never have to remember.* (unique, provable, emotional)
2. **Pillar — works everywhere** (cloud; Mac/Windows/any device) → conquers Windows-only Solar Fire.
3. **Pillar — genuinely easy** ("a new level of convenience vs old programs") — say it human, not "UX"; support claim.
4. **Pillar — saves time on client context** (no re-prepping a person's history). 

**Messaging rule:** never lead with "another astrologer workspace + AI" (Astrolium owns that sentence). Lead with the HERO; charts + CRM + Swiss-Ephemeris accuracy are table-stakes proof mentioned underneath.

---

## 4. Google Ads launch plan

### 4.1 Strategic shape
- **Channel role:** high-intent capture, not demand generation. Volume will be modest; that's expected and fine.
- **Market for the paid test:** **English-first** (US, UK, CA, AU, IE). Rationale: high WTP, real software-search behavior, conquest-able competitor terms. RU/UA demand is cheaper to reach via warm/organic, so don't burn paid budget there first. (This *is* the dual-track in action: paid search tests the high-value English thesis.)
- **Objective:** trial starts (free 14-day trial). Secondary: qualified email/waitlist if trial isn't ready for cold traffic.
- **Bid strategy:** start **Manual CPC** or **Maximize Clicks with a max-CPC cap** (no conversion data yet). Switch to Maximize Conversions / tCPA only after ~30–50 tracked conversions.
- **Budget:** **$20–30/day** test (~$600–900/mo). Expect to *learn*, not to hit CAC targets immediately.

### 4.2 ⚠️ Pre-launch blockers (do these FIRST — in order)
1. **Conversion tracking.** Put GA4 + Google Ads tag on the marketing site AND app. Define key events: `trial_start` (primary), `signup`, `pricing_view`, `checkout_start`, `purchase`. Mark `trial_start`/`purchase` as conversions; import to Google Ads. **Verify with a real test conversion.** (Current GA4 shows ~0 sessions — tracking is effectively not installed where traffic will land.)
2. **Landing page** dedicated to the ad (see §4.7). Fast (<3s), mobile-first, single CTA = Start free trial.
3. **Policy check.** Astrology ads are generally allowed by Google but can be sensitive/restricted in some regions; confirm the ad account isn't flagged and avoid "guaranteed outcome" claims.
4. **UTM scheme** consistent across all ads.

### 4.3 Account structure
```
Campaign: GOOG_Search_EN_Pro-Astrologers_Trial_2026
  ├─ AG1 — Desktop-switch / conquest   (Solar Fire, Astro Gold, cloud switch)
  ├─ AG2 — Workspace conquest          (Astrolium / LUNA / "best astrology software for astrologers")
  └─ AG3 — Problem / category          (client management, record consultation, practice software)
Geo: US, UK, CA, AU, IE  ·  Language: English  ·  Networks: Search only (no Display/Partners at start)
```
*(Optional parallel: a tiny `GOOG_Search_RU` mirror later, targeting «программа для астролога», «Хронос аналог» — only after the EN test reads.)*

### 4.4 Keyword strategy (start tight: phrase/exact, not broad)
**AG1 — Desktop-switch / conquest**
- `"solar fire alternative"` · `[astro gold alternative]` · `"timepassages alternative"` · `"cloud astrology software"` · `"astrology software for mac"` · `[best astrology software for professional astrologers]`

**AG2 — Workspace conquest**
- `[astrolium]` · `"astrolium alternative"` · `[luna astrology software]` · `"astrology software with crm"` · `"astrology client management software"`
- *(Bidding on a competitor's brand as a keyword is allowed; do NOT use their trademark in ad text.)*

**AG3 — Problem / category**
- `"astrology practice management"` · `"record astrology consultation"` · `"astrology client notes app"` · `"astrology consultation software"` · `[software for practicing astrologers]`

**Match-type discipline:** launch phrase + exact only. Add broad match *only* after negatives are proven, or you'll pay for "free horoscope" junk.

### 4.5 Negative keywords
**Campaign-level (≥4):**
- free horoscope
- daily horoscope
- tarot
- psychic
- love compatibility
- zodiac sign meaning
- kundli
- numerology
- co-star
- crack / torrent / free download
- course / certification / school / jobs / salary

**Ad-group level:**
- AG1: `reading` (consumer intent), `app for iphone free`, `download crack`
- AG2: `api` (developer intent for astrology-api.io), `free`
- AG3: `my reading`, `get a reading`, `near me` (consumer seeking a reading, not software)

### 4.6 Ad assets — sitelinks, callouts, snippets

**Sitelinks (≥4):**
- Recorded Sessions | Record, transcribe, summarize | Every consultation captured | https://steliara.com/features/sessions
- Client Workspace | Everyone you read for, in one place | Profiles, notes, history | https://steliara.com/features/crm
- Swiss Ephemeris Charts | Professional-grade accuracy | Natal, transit, synastry | https://steliara.com/features/charts
- Pricing | Simple monthly plans | 14-day free trial, no card | https://steliara.com/pricing

**Callouts (≥4, ≤25 chars):**
- 14-day free trial
- No card to start
- Swiss Ephemeris accuracy
- Record & transcribe
- AI session summaries
- Cancel anytime

**Structured snippet** — Header *Features*: Natal charts, Transits, Synastry, Client CRM, Session recording, Transcription, AI summaries

### 4.7 Landing page requirements (for the ad)
- **Hero:** "Everything about every person you read for — charts, notes, recorded consultations — in one place. Never re-remember what was said." + 1 CTA ("Start free — no card").
- Above fold: one-line value + product screenshot (chart + session/recording UI).
- **Supporting pillar row (3 blocks under hero):** (1) Works on Mac, Windows, any browser; (2) A new level of convenience vs old desktop programs; (3) Every person's charts, past consultations and context already in front of you — less prep.
- Proof: Swiss Ephemeris accuracy; "record → transcript → summary" shown visually; founding-member note.
- Match the ad: if ad says "Solar Fire alternative," the page must address switchers (migration, cloud, multi-device).
- Soft, human voice (per brand voice). In **English** ads, "clients" is acceptable (it's the market's search word); keep "the people you read for" for the softer RU/brand surfaces.
- Speed <3s, mobile-first, single primary CTA, trust/security note on recordings.

### 4.8 Measurement & success criteria (read after ~$600–900 / 3–4 weeks)
- **Leading:** CTR (≥4–6% on conquest/exact is healthy in a niche), CPC, landing-page CVR to trial.
- **Primary:** cost per trial start; trial→paid (blend with product data).
- **Decision:** if cost-per-trial and early trial→paid suggest CAC < ~$60–100 (well inside LTV ~$590), English paid search is viable → scale + add broad/RU. If CTR is fine but trials don't convert → landing/offer problem, not channel. If volume is simply too thin → shift budget to Meta demand-gen / community, keep Google for conquest only.

---

## 5. RSAs (English, ready to load)

> Google limits: 15 headlines (≤30 chars), 4 descriptions (≤90 chars), max 3 RSAs per ad group. Char counts shown. All unpinned unless noted. Replace `steliara.com` with the real final URL.

### RSA1 — AG1 Desktop-switch / conquest
Final URL: https://steliara.com/  ·  Path1: astrology  Path2: workspace
Headlines (15):
1. Cloud Astrology Workspace (25)
2. Works on Mac & Windows (22)
3. Leave Desktop Astrology (23)
4. Run Your Whole Practice (23)
5. Charts, Clients, Sessions (25)
6. Easier Than Old Software (24)
7. Never Lose a Session Again (26)
8. Swiss Ephemeris Accuracy (24)
9. Transcribe Consultations (24)
10. AI Session Summaries (20)
11. One Tab, Whole Practice (23)
12. Free 14-Day Trial (17)
13. No Card to Start (16)
14. Built for Pro Astrologers (25)
15. Your Practice, One Place (24)
Descriptions (4):
1. Charts, client profiles, and recorded sessions in one cloud workspace. Try it free. (83)
2. Leave clunky desktop software behind. Swiss Ephemeris accuracy, anywhere you work. (82)
3. Record, transcribe and summarize every consultation automatically. Nothing gets lost. (85)
4. The modern home for your whole astrology practice. Start free, no card required. (80)
Pinning: none.

### RSA2 — AG2 Workspace conquest *(no competitor trademarks in text)*
Final URL: https://steliara.com/  ·  Path1: astrology  Path2: sessions
Headlines (15):
1. Astrology Workspace + Calls (27)
2. Charts, CRM & Recorded Calls (28)
3. More Than a Chart Tool (22)
4. Run Sessions, Not Just Charts (29)
5. Record & Transcribe Sessions (28)
6. AI Summaries of Every Call (26)
7. Your Whole Practice, 1 Tab (26)
8. Built for Pro Astrologers (25)
9. Swiss Ephemeris Charts (22)
10. Free 14-Day Trial (17)
11. No Card Needed (14)
12. Client Profiles + History (25)
13. See Every Client's Story (24)
14. Charts to Recordings, One App (29)
15. Compare Astrology Tools (23)
Descriptions (4):
1. Not just charts — host, record, transcribe and summarize every client session. (78)
2. Charts, client CRM, and recorded video consultations in one cloud workspace. (76)
3. Swiss Ephemeris accuracy plus session recording. Try free, no card to start. (76)
4. Compare the modern astrologer workspaces and see what your tools are missing. (77)
Pinning: none.

### RSA3 — AG3 Problem / category
Final URL: https://steliara.com/  ·  Path1: astrology  Path2: practice
Headlines (15):
1. Astrology Practice Software (27)
2. Manage Your Astrology Clients (29)
3. All Your Clients in One Place (29)
4. Record Every Consultation (25)
5. Never Lose Session Notes (24)
6. Client Profiles + Charts (24)
7. Notes, Charts & Recordings (26)
8. Prep Faster for Readings (24)
9. Recall Every Past Session (25)
10. Swiss Ephemeris Accuracy (24)
11. Free 14-Day Trial (17)
12. No Card to Start (16)
13. Built for Working Astrologers (29)
14. One Home for Your Practice (26)
15. Stop Juggling 5 Apps (20)
Descriptions (4):
1. Keep every client's charts, notes and recorded sessions in one searchable place. (80)
2. Record, transcribe and summarize consultations so nothing is ever forgotten. (76)
3. Swiss Ephemeris charts plus a built-in client CRM. Try free, no card needed. (76)
4. The all-in-one workspace for professional astrologers. Start your free trial. (77)
Pinning: none.

---

## 6. Sequenced action plan

**Phase 0 — Make it measurable (before any spend)**
1. Install GA4 + Google Ads tag on marketing site + app; define & verify `trial_start` conversion. *(Blocker)*
2. Ship the conquest landing page (§4.7).
3. Confirm Google Ads astrology policy / account standing.

**Phase 1 — Small EN test ($20–30/day, 3–4 weeks)**
4. Build campaign per §4.3–4.6; load RSAs (§5); phrase/exact only; negatives on.
5. Watch CTR + cost-per-trial weekly; refine negatives daily for the first week.

**Phase 2 — Read & decide**
6. Viable CAC → scale budget 20–30%/step, add broad match + RU mirror + retargeting. Thin volume → keep Google for conquest only, move demand-gen budget to Meta/community.

**Parallel (not Google Ads):** keep founder-led UA/RU warm outreach as the real M0 engine; harvest verbatim testimonials → feed back into ad copy and the positioning doc.

---

*Open data gaps: exact keyword search volumes (need Google Keyword Planner once the account is active), real landing-page CVR, and first-party verbatim from founding cohort. Fill these as they become available and revisit this plan.*

# Wave 2 — Conquest & category landing pages (content, ready to build)

*Created 2026-06-25. English-first (that is where the conquest/SEO value is); RU mirrors optional. Voice: clear and confident, still warm, no em dashes, no fabricated claims. Positioning hierarchy from [.agents/product-marketing.md](../../.agents/product-marketing.md): HERO = everything in one place + recorded consultations; pillars = works everywhere, genuinely easy, saves time; AI finds facts, the astrologer interprets. Comparison claims must stay truthful (fair-use comparison is fine; do not put a competitor trademark in paid-ad headline text).*

**Implementation note:** these are page contents (copy + SEO meta + structure + schema). Wiring them into the app's i18n/build as real routes is a separate code task — flag when ready and I'll build them. Each page ends in the same single CTA: start the free trial.

---

## Page 1 — "Cloud astrology software for Mac and Windows" (desktop-switch / Solar Fire conquest)

- **Slug:** `/cloud-astrology-software`
- **SEO title (≤60):** Cloud Astrology Software for Mac & Windows | Steliara
- **Meta description (≤155):** Run your whole astrology practice in the browser. Charts, the people you read for, and recorded, transcribed, summarized sessions. Free 14-day trial.
- **Target keywords:** cloud astrology software, astrology software for mac, solar fire alternative, web-based astrology software

**H1:** Your astrology practice, in any browser
**Subhead:** Leave the desktop-only programs behind. Steliara runs on Mac, Windows, and any browser, and keeps everything about every person you read for in one place.

**Section — Why astrologers move off desktop software**
- It only runs on one machine (and often only on Windows).
- The chart is all it knows. Your notes, recordings, and client history live in five other places.
- Nothing from the actual consultation is captured.

**Section — What you get instead**
- Everything about each person in one place: charts, notes, and recorded consultations.
- Sessions recorded, transcribed, and summarized automatically, so nothing is lost.
- Swiss Ephemeris accuracy, with a professional orb setup.
- Works on Mac, Windows, and any browser. Nothing to install.

**Comparison table (truthful)**
| | Desktop programs (e.g. Solar Fire) | Steliara |
|---|---|---|
| Platforms | Windows-only / one machine | Mac, Windows, any browser |
| The people you read for | Not really | Profiles with full history |
| Records the consultation | No | Yes, with transcript + summary |
| Setup | Install + license | Open a browser, free trial |

**Trust line:** AI will never read a chart for you. It just finds the facts faster: the aspects, the exact dates, where a planet sits. You stay the astrologer.

**FAQ (with FAQPage schema):**
- Can I use it on a Mac? Yes, it runs in any browser, same on Mac, Windows, or a borrowed laptop.
- Do I lose my charts if I switch? No. Your charts and people live in your account and stay there.
- Is the calculation accurate? Yes, based on Swiss Ephemeris with a professional orb setup.

**CTA:** Start free, no card needed.

---

## Page 2 — "The astrologer workspace that records your sessions" (Astrolium / LUNA conquest)

- **Slug:** `/astrologer-workspace`
- **SEO title (≤60):** Astrologer Workspace with Recorded Sessions | Steliara
- **Meta description (≤155):** Not just charts and a CRM. Steliara runs, records, transcribes, and summarizes your actual client consultations, all in one place. Free 14-day trial.
- **Target keywords:** astrology software with crm, astrology client management software, astrologer workspace, astrolium alternative
- **Note:** do NOT put "Astrolium" in paid-ad headline text. On an organic comparison page, a truthful "compared to other workspaces" framing is fine.

**H1:** More than charts and a client list
**Subhead:** Other modern workspaces give you charts, a CRM, and an assistant. Steliara adds the one thing they do not: the consultation itself, recorded, transcribed, and summarized.

**Section — The gap in chart-first workspaces**
Charts and a client list are table stakes now. But after the reading ends, the substance of the session still disappears, you are back to typing notes from memory.

**Section — Steliara captures the consultation**
- Run the session, record it, get a transcript and a short summary.
- Every person's charts, notes, and past sessions sit together.
- Ask the chart for facts (aspects, exact date windows, placements) in seconds. You interpret.
- Mac, Windows, any browser.

**Comparison table (truthful, keep current):**
| | Chart-first workspaces | Steliara |
|---|---|---|
| Charts, transits, synastry | Yes | Yes |
| Client profiles / CRM | Yes | Yes |
| Records live consultations | Not yet | Yes |
| Transcribes + summarizes sessions | Not yet | Yes |

**CTA:** Start free, no card needed.

---

## Page 3 — "Astrology practice management software" (category page)

- **Slug:** `/astrology-practice-management`
- **SEO title (≤60):** Astrology Practice Management Software | Steliara
- **Meta description (≤155):** One place for your charts, the people you read for, and your recorded consultations. Built for working astrologers. Free 14-day trial, no card.
- **Target keywords:** astrology practice management, software for practicing astrologers, astrology consultation software, record astrology consultation

**H1:** Run your whole astrology practice in one place
**Subhead:** Charts, the people you read for, and the consultations themselves, recorded and summarized, so you never rebuild the context from memory before a session.

**Section — Built for the working day, not just the chart**
1. Calculate the chart in under a minute.
2. Keep everyone you read for in one place, with their notes, recordings, and history.
3. Run and record the consultation. Get a transcript and a summary.
4. Ask the chart for facts when you prep. You interpret, it digs.

**Section — Why astrologers choose it**
- Nothing is lost after a session.
- No re-assembling a person's story before each meeting.
- Works anywhere, far simpler than the old desktop programs.

**FAQ (FAQPage schema):**
- Will it interpret the chart for me? No, that is your craft. The assistant retrieves data and dates faster.
- Can I keep recordings of my consultations? Yes, with a transcript and a short summary.
- Is there a free trial? Yes, 14 days, full features, no card.

**CTA:** Start free, no card needed.

---

## Shared SEO + build notes
- Add `FAQPage` + `SoftwareApplication` JSON-LD to each page (see Wave 2 SEO-technical follow-up).
- Internal-link all three to each other and to `/pricing` and the home hero.
- Canonical, OG image per page (OG can reuse the product screenshot).
- RU mirrors: optional; if built, keep the same structure and the soft voice, "люди, которых вы консультируете" not "клиенты".
- These pages are the landing targets for the Wave 2 Google Search conquest ad groups (see wave2-content-and-ads.md).

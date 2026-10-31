# Moon letters: cheap validation of a paid lunar journal

Status 2026-10-27: built and tested on branch `claude/b2c-astrology-low-competition-aee954`, not deployed.

## The idea being tested

A B2C product on top of our ephemeris that does not deceive: a journal in the rhythm of the Moon.
At each new moon a person writes an intention, at each full moon what they are grateful for; the
questions change with the house of their chart where the lunation falls. We never predict; we give a
rhythm, questions and an affirmation.

| Free (built) | Personal month, paid (not built, about $5 / 4 EUR a month) |
|---|---|
| A letter on every new and full moon: the house of the chart, its theme, three questions, an affirmation | Everything free |
| A journal of the answers, kept on our server, on any device | A calendar of the person's own transits for the month, with a question for each |
| | A monthly look back at what they wrote, next to the sky of those days |
| | A year book of the entries for their birthday |

Storage is free on purpose: nobody pays for "your notes on every device", and a journal that loses
notes after a cleared cache measures the browser, not the idea. What is paid needs our engine and the
person's own accumulated words, so its value grows the longer they write. Both pages show an example of
a free letter (built from the real letter blocks) and of a personal month (a fictional person, labelled).

Before building the paid part we check, per market, whether people (1) find the page, (2) leave an
email, (3) confirm it, (4) come back and write in their journal and (5) press "I'm interested" on the
personal month, which records interest and charges nothing.

## Why these markets (Semrush, 2026-10-27)

| Market | Entry query | Volume / KD / CPC |
|---|---|---|
| DE | neumond | 22.2k / 24 / $0.56 (mondkalender 22.2k / 45 / $0.72) |
| FR | nouvelle lune | 40.5k / 30 / $0 (journal de gratitude 2.9k / 29) |
| PL | nów księżyca, pełnia księżyca | 5.4k / 27, 33.1k / 27 (afirmacje 18.1k / 25 / $0.84) |
| IT | luna nuova | 8.1k / 48 / $1.00 |
| ES | luna nueva | 9.9k / 54 |
| BR | lua nova | 49.5k / 53 |
| US | new moon intentions | 320 / 4 (gratitude journal 33.1k / 23) |

Nobody searches for an "astrology journal" as such (0-20 a month in every language); the parts have
demand on their own. The page therefore answers the head query (dates of the new and full moons, with
exact times) and offers the personal part on top. DE, FR and PL have the best difficulty for their
volume; IT, ES and BR are harder and are included because the page costs nothing extra per language.

## What is built

- Pages: `/moon` (en), `/moon/pl`, `/moon/de`, `/moon/fr`, `/moon/it`, `/moon/es`, `/moon/pt` (pt-BR),
  one hreflang set, all in the sitemap. Each has a table of every new and full moon from November 2026
  to December 2027 in the market's time zone, the calculator (date, optional time and place) and the signup.
  Letter pages `/moon/<lang>/letter?t=...` are noindexed.
- One page per lunation until June 2027 (16 lunations, 112 pages), added 2026-10-31 because search
  already showed impressions for date queries ("vollmond dezember", "luna nueva diciembre") that no page
  answered. Address = kind + the date as written in that language, e.g. `/moon/pl/pelnia-24-grudnia-2026`,
  `/moon/new-moon-december-8-2026`; the date is in the market's time zone (US Eastern for English), UTC is
  shown too. Each page: the exact moment, sign and degree, a table of the twelve rising signs with the house
  and its theme (no birth data needed), what to write, a way to the calculator, three FAQ answers,
  previous/next and a link to every other lunation page, and the same lunation in the six other languages
  (one hreflang set per lunation). The index table links to them. The build writes
  `app/frontend/moon/lunation-pages.json`, which the server reads for routing and the sitemap; to extend
  the range change `DATE_PAGES_BEFORE` in `build-moon-pages.mjs` and rebuild (needs lunations in
  `moon-src/lunations.json`). Page views of these are counted as `moon.page_view` with `page = lunation`.
- Isolation: the moon and kundli pages do not link to the professional-astrologer pages and nothing there
  links to them (decision 2026-10-31). The footer of the English moon and kundli pages links to each other
  ("Also free").
- Houses are whole-sign from the rising sign (time and place known) or from the Sun sign (solar houses,
  said so on the page and in every letter).
- Double opt-in. Then one email on the day of every new and full moon: the house theme, two questions for
  that house plus one universal (intention / three things to be grateful for), an affirmation, a link to
  the letter page. Answers typed there are saved to the person's journal as they type
  (`moon_journal_entries`); the page shows the whole journal, newest lunation first.
- A light account without a password: the confirmed email is the account and every link is signed
  (`MOON_LINK_SECRET`). From another device, "send me my link" on `/moon` emails the link again (same
  answer for any address, one email per address per 10 minutes). Anyone holding the link can read the
  journal, which the letter page says plainly.
- Unsubscribe, and delete-my-data (subscriber and every entry), on the letter page.
- Copy lives in `app/frontend/moon-src/<lang>.json` (pages) and `app/services/moon_journal_content/<lang>.json`
  (letters). The English letter text passes the same safety filter as the kundli reports.

## To switch it on

1. Apply migration `app/database/migrations/065_add_moon_subscribers.sql` (check that the deploy applied
   it; earlier migrations sometimes had to be applied by hand).
2. Render env: `MOON_LINK_SECRET` (32+ random characters), `MOON_CRON_SECRET` (32+ random characters).
   Email already works through the existing `EMAIL_PROVIDER` settings.
3. GitHub secret `MOON_CRON_SECRET` (same value). `KUNDLI_SITE_BASE_URL` is reused for the site URL.
   Until both exist the hourly `Moon letters` workflow skips quietly.
4. Search Console: submit the seven `/moon` URLs.
5. Recommended before indexing: a native read of pl, de, fr, it, es, pt copy (written by us, not reviewed),
   and a sentence in `/terms.html` about the moon letters' data (email, birth data, journal entries,
   deletion on request).

## PostHog dashboard (separate from the astrologer metrics)

The moon pages run without cookies or a consent banner, so they send nothing from the browser.
The server sends anonymous events to the same PostHog project as the app (`POSTHOG_PROJECT_API_KEY`,
write-only token): every event gets a fresh random id, no person profile and no GeoIP, and carries
only the language and a few non-identifying facts (never an email, birth data or answers). Counts are
exact, unique visitors cannot be counted by design. Crawlers and empty user agents are not counted.

| Event | Sent when | Properties |
|---|---|---|
| `moon.page_view` | a /moon page is opened (calculator, letter or lunation date page) | `locale`, `page` (index / letter / lunation), `referrer_host` (host only, or `direct`) |
| `moon.chart_calculated` | someone presses "Show my moons" | `locale`, `frame` (rising / sun) |
| `moon.signup_requested` | the confirmation email goes out | `locale`, `frame` |
| `moon.confirmed` | the address is confirmed | `locale` |
| `moon.journal_entry` | a new answer is saved (editing is not counted) | `locale`, `kind` |
| `moon.interest_clicked` | "I'm interested" on the personal month, once per person | `locale` |
| `moon.letter_sent` | a lunation letter is delivered | `locale`, `kind` |
| `moon.link_requested`, `moon.unsubscribed`, `moon.erased` | self service | `locale` |

Build one dashboard named "Moon pages (free, B2C)", kept apart from the astrologer dashboards, with
these insights (all events start with `moon.`, so a search for `moon.` finds them):

1. **Visits per day by language**: Trends, `moon.page_view` where `page` = `index`, breakdown `locale`, stacked bars, last 30 days.
2. **Where visits come from**: Trends, `moon.page_view` where `page` = `index`, breakdown `referrer_host`, table, total value.
3. **Journey in numbers**: Trends, total value, series `moon.page_view` (page = index), `moon.chart_calculated`, `moon.signup_requested`, `moon.confirmed`, `moon.journal_entry`, `moon.interest_clicked`; breakdown `locale`. Read it as ratios: calculated / visits, signups / calculated, confirmed / signups.
4. **Letters**: Trends, `moon.letter_sent`, breakdown `kind`, by week.
5. **Leaving**: Trends, `moon.unsubscribed` and `moon.erased` per week.
6. **Date pages**: Trends, `moon.page_view` where `page` = `lunation`, breakdown `locale`, stacked bars, last 30 days (visits that start on a lunation date page; the calculator visits in 1-3 are counted separately).

Per-language funnel numbers with exact confirmed / writers / interested counts remain in the stats
endpoint below; PostHog is for traffic and the shape of the journey.

## Reading the result

```bash
curl -s -H "X-Moon-Cron: $MOON_CRON_SECRET" https://www.steliara.com/api/v1/moon/internal/stats
```

Per language: signups, confirmed, unsubscribed, letters sent, opened (visited the letter page at least
once), writers (wrote at least one answer), entries, interested (pressed the personal-month button).
Page clicks come from Search Console.

Read it after three lunar cycles (about six weeks after the pages are indexed). A market earns the paid
journal when it has at least 50 confirmed subscribers and:

- confirmed / signups >= 60%
- opened / confirmed >= 30%
- writers / confirmed >= 20%
- interested / confirmed >= 10%
- unsubscribes per letter sent < 3%

Below that, the market keeps the free pages (they still bring traffic) and we do not build further there.

# Organic audit — steliara.com, 2026-09-17

Measured, not estimated. Every number below comes from a live fetch of the production
site, the GA4 property (543015333), or a live search query on the date in the title.
Google's own `site:` operator was unavailable (Google served a bot check and Startpage a
proof-of-work challenge; neither was bypassed), so Google-side index counts are inferred
from GA4 rather than observed directly — see "What we still cannot see".

---

## 1. The short version

The site is **crawlable, partly indexed, and not ranking**. That is three different
problems and only the third one is the one people usually assume.

| Question | Answer |
| --- | --- |
| Is the site indexed? | Partly. Bing/DDG holds ~10 URLs, including 3 that should never be indexed. |
| Does it rank? | On Bing, yes for one term (#2). On Google, effectively no. |
| Does organic bring traffic? | **2 sessions in 90 days.** |
| Is there a technical blocker? | Yes, one big one: the English homepage ships no text. |

GA4, `sessionDefaultChannelGroup`, 2026-06-17 → 2026-09-16:

| Channel | Sessions | Users |
| --- | --- | --- |
| Direct | 120 | 57 |
| Referral | 104 | 8 |
| Unassigned | 65 | 11 |
| Paid Search | 48 | 39 |
| **Organic Search** | **2** | **1** |
| AI Assistant | 1 | 1 |
| Cross-network | 1 | 1 |

Ads have been paused since 15.07.2026, so the 48 paid sessions are the tail of that.
Organic is not "small" — it is zero with rounding error.

---

## 2. Critical: the English homepage serves one word of text

`https://www.steliara.com/` returns HTTP 200, 22.7 KB, a correct `<title>`, a correct
meta description, a correct canonical, and valid `SoftwareApplication` JSON-LD.

Its `<body>` contains **1 word** of text.

Measured on the served HTML (no JS execution):

| URL | Body words in served HTML | `data-i18n` nodes | Empty ones |
| --- | --- | --- | --- |
| `/` (English) | **1** | 126 | **125** |
| `/de/` | 859 | 126 | 0 |
| `/ru/` | 824 | 126 | 0 |
| `/uk/` | 764 | 126 | 0 |

`app/scripts/build-localized-pages.mjs` prerenders `de`, `ru`, `uk` into their own static
documents. English is not prerendered — English *is* the source document, and in the
source every translatable node is an empty shell (`<span data-i18n="common.brandName"></span>`)
that `i18n-ui.js` fills in the browser. The comment above the `<title>` in
`app/frontend/index.html` claims "the text content here is the English copy served at
this URL". That is not what ships.

Why this matters more than it looks:

- **Google can render JS, but on a queue.** JS-dependent pages get indexed late and
  re-crawled less often. This is a plausible cause of the Google-side silence.
- **AI crawlers mostly do not render JS at all.** `GPTBot`, `PerplexityBot`, `ClaudeBot`
  and `OAI-SearchBot` are explicitly welcomed in `robots.txt` and pointed at `llms.txt` —
  and then handed a blank page at the URL with sitemap priority 1.0. The one channel that
  has already produced a non-ads signup is being served an empty document.
- **It is locale-inverted.** The German page is better optimised than the English one, in
  a market the GTM plan calls "where the $1M actually lives".

`/pricing.html` (5 empty nodes of 52) and `/terms.html` (4 of 19) have the same defect in
a minor form. The three conquest landings have no `data-i18n` at all and ship 533–721
words of real static HTML — they are fine.

---

## 3. App shells are indexable and thin

| URL | HTTP | `X-Robots-Tag` | `<meta robots>` | In Bing index |
| --- | --- | --- | --- | --- |
| `/login.html` | 200 | none | none | **yes** |
| `/calendar` | 200 | none | none | **yes** |
| `/account-settings.html` | 200 | none | none | **yes** |
| `/natal-full.html` | 200 | none | none | — |
| `/forecast-new.html` | 200 | none | none | — |
| `/styleguide.html` | 200 | none | `noindex, nofollow` | — |

`robots.txt` disallows `/account-settings` (prefix match covers `.html`), but a crawl
block is not an index block: Bing indexed the page anyway, with a snippet reading
"Balances Weights used for natal balance calculations". Only `/styleguide.html` carries a
real `noindex`.

Net effect: a domain with 6 genuinely public pages is showing search engines a majority of
near-empty application shells. On a domain this small that is a meaningful quality signal.

---

## 4. Ranking reality (Bing/DuckDuckGo, live 2026-09-17)

| Query | Steliara position | Who owns it |
| --- | --- | --- |
| `astrology practice management software` | **#2** | dkscore.com #1, astrologerapp.org #3, pro.stellaxa.com #4 |
| `cloud astrology software` | not in top 10 | lunaastrology.com #1–2, astroapp.com #3, astrocloud.net #4 |
| `astrology software that records client sessions` | **not in top 10** | astrologerapp.org #1 **and** #2 |
| `"steliara"` (quoted) | #1 and #2 | — |
| `steliara` (unquoted) | **0 results** | autocorrected to "stelara" |

Two things to take from this:

1. **The conquest-page format works.** One page, ~720 words, no backlinks, and it is #2
   for its head term. The other two just are not good enough yet for theirs.
2. **We are losing our own differentiator.** "astrology software that records client
   sessions" is the sentence the whole product is built on, and `astrologerapp.org` takes
   both of the top two slots with a dedicated `/sessions-scheduling` page. We have no page
   that targets the recording/transcription job directly — `/astrologer-workspace` buries
   it under "More than charts and a client list".

### The brand-name collision

Unqualified `steliara` is autocorrected by Bing/DDG to **stelara** — Johnson & Johnson's
ustekinumab, a multi-billion-dollar drug brand with enormous search volume. The site
does not appear at all on that results page. Only the quoted query returns us.

This is structural and will not fix itself with content. It is fixable with brand-entity
signals (see §6), but it should be a conscious decision, because it means every piece of
brand marketing pays a tax.

---

## 5. What is already right

Worth stating, because it is a real foundation and most of the audit is complaints:

- `robots.txt` (200, 2.1 KB) names 13 AI crawlers explicitly and points at both
  `sitemap.xml` and `llms.txt`.
- `llms.txt` (200, 2.0 KB) exists and leads with category, differentiator, price.
- `sitemap.xml` (200) lists 15 URLs with correct reciprocal `hreflang` sets including
  `x-default`, and a `lastmod`.
- Titles and meta descriptions are present, unique and well-written on all 15 sitemap URLs.
- Canonicals are correct everywhere except `/pricing.html` and `/terms.html` (English only
  — the localized copies have them).
- `SoftwareApplication` JSON-LD on the homepage and all three conquest pages.
- A GSC domain property is verified (`google-site-verification` TXT record on
  `steliara.com`).
- `/de/`, `/ru/`, `/uk/` are genuinely prerendered, 764–949 words each.

The machinery is built. It is pointed at an empty English homepage.

---

## 6. Fix list, in the order that matters

### P0 — done 2026-09-17, in the same change set as this document

1. ~~**Prerender English.**~~ `build-localized-pages.mjs` now emits English alongside
   `de/ru/uk`, back over the bare-URL source files. `/` went from 1 word of body text to
   843, `/terms.html` from 46 to 1556, `/pricing.html` from 196 to 313, and every empty
   translation slot is gone.
2. ~~**`noindex` the app shells.**~~ `X-Robots-Tag: noindex, follow` is now served on
   every HTML document that is not advertised in the sitemap. The rule is an allow-list
   derived from the sitemap, so a screen added next year is private without anyone
   remembering. `/account-settings` came *out* of the robots.txt `Disallow` list at the
   same time: blocking the crawl was what made the page impossible to deindex.
3. ~~**Canonical on `/pricing.html` and `/terms.html`.**~~ Added by the prerender pass.

The audit script reports 16 errors against production as it stands today and 0 against
the fixed build.

### P1 — the content that earns rankings

These are now the queue in [`seo-backlog.yml`](seo-backlog.yml), which the weekly agent
works through. See [`seo-automation-pipeline.md`](seo-automation-pipeline.md).

4. **A page for the differentiator.** `/record-astrology-consultations` (or similar),
   targeting "record / transcribe / summarize astrology sessions". Today a competitor owns
   both top slots for our own hero claim. This is the highest-value new page on the site.
5. **Rebuild `/cloud-astrology-software`** to actually beat LUNA — it is 533 words against
   an established brand. Comparison depth, a real feature table, screenshots.
6. **Alternative pages**, already P1 in the GTM plan and still unbuilt: Solar Fire
   alternative, Astro Gold alternative, Astrolium alternative, TimePassages alternative.
   These are the cheapest qualified traffic in the category and they convert.
7. **Answer pages for AI engines.** Short, factual, heavily structured pages answering the
   exact questions category buyers ask an LLM. Per the Perplexity baseline (2026-08-06),
   brand queries already cite us and category queries never do.

### P2 — signals and distribution

8. ~~**IndexNow**~~ — implemented 2026-09-17 (`/indexnow-<key>.txt` +
   `app/scripts/indexnow_ping.py`, fired daily by the monitor on a clean audit). Dormant
   until `INDEXNOW_KEY` is set on both the Render service and repo secrets.
9. **Bing Webmaster Tools** — not verified. Free, and Bing is where we already rank.
10. **Brand-entity work** for the `stelara` collision: Crunchbase, LinkedIn company page,
    Product Hunt, G2/Capterra listings, Wikidata. These teach engines that "steliara" is a
    distinct entity rather than a typo.
11. **Directory submissions** — `docs/marketing/wave2-directory-kit.md` exists, execution
    does not.

---

## 7. What we still cannot see

Honest list of gaps in this audit, because acting on them requires access this session
does not have:

- **Google Search Console data.** The property is verified but there is no API connector
  here. Impressions, average position, actual index coverage and crawl errors are all
  invisible. This is the single most valuable missing input, and it is the first thing the
  automated pipeline needs.
- **Google index count.** `site:` was blocked by a bot check. Bing's index is observable;
  Google's is not.
- **Backlink profile.** No Ahrefs/Semrush API in this session. Assume near-zero: the
  domain is new and the directory kit was never executed.
- **Core Web Vitals.** The homepage ships a full-screen `page-loader` overlay that is
  cleared by JS, which is exactly the pattern that produces a poor LCP. Not measured.

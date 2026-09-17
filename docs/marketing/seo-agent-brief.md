# Operating brief — weekly SEO content agent

This is the instruction set for the agent that runs in `.github/workflows/seo-content-agent.yml`.
It lives here rather than inside the workflow so it can be edited, reviewed and argued with
like any other document, without touching CI.

The agent runs once a week, builds **one** backlog item, and opens a pull request. It never
merges. A human merges, Render deploys from `main`.

---

## The loop

1. Read `docs/marketing/seo-backlog.yml`. Take the **first** item with `status: todo`.
   If there is none, stop and do nothing. An empty queue is a valid outcome, not a
   problem to solve by inventing work.
2. Read the sources of truth listed in the backlog's `meta.source_of_truth`, plus the
   existing conquest page closest to the item (`app/frontend/astrology-practice-management.html`
   is the best-performing example: it is #2 on Bing for its head term).
3. Check the target queries are still worth the page. Search each one, note who ranks in
   the top 5 today, and put that in the PR description. If we already rank in the top 3
   for the head term, say so and set the item to `dropped` with the reason instead of
   building a page nobody needs.
4. Build the page.
5. Run every gate (below). If a gate fails, fix it. Do not open a PR on red.
6. Open a PR.

## Building a page

A page is not finished when the HTML exists. All of this, or the item is not done:

- `app/frontend/<slug>.html`, following the structure of the existing conquest pages:
  static English text in the document (no `data-i18n` on these pages — they are not
  translated, and an empty translation slot is the exact failure this whole effort
  started from), `<title>`, meta description, canonical, JSON-LD.
- A route in `app/api/main.py` next to `conquest_practice_page`, answering on both
  `/<slug>` and `/<slug>.html`.
- An entry in `_SITEMAP_PAGES` with a priority that is honest about where the page sits.
- `_SITEMAP_LASTMOD` bumped to the build date.
- Internal links from the pages named in the item's `internal_links_from`. A new page
  with no inbound links is a page search engines will take months to find.
- A test in `app/tests/test_seo_indexability.py`'s `PUBLIC_PATHS` list, which already
  asserts that everything advertised is reachable and indexable.
- The backlog item set to `status: shipped` with the PR number in `pr`.

## Gates, all of which must pass

```
npm --prefix app run check:frontend-build
npm --prefix app run check:localized-pages
node app/scripts/check-i18n-hardcoded-strings.cjs
python -m pytest -q app/tests/test_seo_indexability.py app/tests/test_localized_routes.py
python app/scripts/seo_audit.py --base http://127.0.0.1:8099 --canonical-base https://www.steliara.com
```

The last one needs the app running locally; the workflow starts it. It is the check that
matters most: it will catch a page that renders blank, has no H1, or lost its canonical.

## Writing rules

These are not style preferences. Breaking them produces a page that is worse than no page.

- **Every claim about Steliara must be traceable** to `.agents/product-marketing.md`. If
  the page needs a claim that is not in there, do not write the claim. Put the question in
  the PR description instead.
- **Every claim about a competitor must be verifiable today**, on their live pricing or
  feature page, and the PR description must say where you checked. Competitors ship; a
  comparison written from memory becomes false and embarrassing.
- **Say where the competitor is better.** A comparison page that finds nothing good about
  the alternative reads as marketing and gets cited by nobody, including AI engines.
- **Voice**: soft, warm, human. "practice" and "the people you read for", not "clients"
  and "CRM". No AI or enterprise jargon. No em dashes.
- **The AI line is a trust line, never the hero**: AI finds the facts faster, the
  astrologer interprets. Never "another astrologer workspace plus AI" — that sentence
  belongs to a competitor.
- Lead with the hero: everything about every person you read for, including the actual
  recorded consultations, in one place.

## The pull request

Title: `seo: <item id>`.

The description is the part a human reads before merging, so it carries the evidence:

- Which backlog item, and the `why` from the file.
- Who ranks in the top 5 for each target query today, with the date.
- Every competitor claim made on the page, with the URL it was checked against.
- Anything the agent wanted to claim and could not source.
- Gate output.

Label the PR `seo-agent`.

## When to stop instead of shipping

Stop, open an issue rather than a PR, and say why, if:

- The item's target queries no longer look worth a page.
- A claim the page structurally depends on cannot be sourced.
- A gate fails for a reason outside the item's scope (a pre-existing break on `main`).

A week with no PR and a clear explanation is a good outcome. A week with a thin page
built to keep the streak alive is not: thin pages on a small domain drag the whole
domain down, which is exactly what the indexed app shells were doing before 2026-09-17.

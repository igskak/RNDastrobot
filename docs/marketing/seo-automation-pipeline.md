# The organic pipeline — what runs by itself, what needs you

Built 2026-09-17 off the findings in [seo-audit-2026-09.md](seo-audit-2026-09.md).

The shape: **everything runs in GitHub Actions, nothing merges itself.** Content and
fixes arrive as pull requests with the evidence attached; you merge, Render deploys from
`main`. Measurement and alerting are fully hands-off.

The gate is deliberate. On a domain with six public pages, one thin or factually stale
page costs more than the five minutes it saves — thin pages are precisely what the
indexed app shells were doing to us before today.

---

## What runs without you

| | What it does | When | Output |
| --- | --- | --- | --- |
| `seo-monitor.yml` | Crawls production like a search engine and fails on regressions | Daily 06:20 UTC | A GitHub issue when broken, closed automatically when fixed |
| `seo-monitor.yml` | Pulls Search Console: impressions, position, top queries and pages, against the previous equal window | Daily 06:20 UTC | Recorded to `seo-metrics`; an issue if impressions halve |
| `seo-monitor.yml` | Pushes the sitemap to IndexNow (Bing, Yandex, Copilot) | Daily, only on a clean audit | Re-crawl in minutes instead of weeks |
| `seo-monitor.yml` | Commits the measurement to the `seo-metrics` branch | Daily | `latest.json` + `history/YYYY-MM-DD.json` for trends |
| `ci.yml` | Boots the branch and audits it before merge | Every push and PR | Red CI, so the regression cannot ship |
| `seo-content-agent.yml` | Builds one backlog page and opens a PR | Monday 07:00 UTC | A PR labelled `seo-agent` with the SERP check and sources |

### The measurement engine

`app/scripts/seo_audit.py` — stdlib only, no install step. It fetches `robots.txt`,
`sitemap.xml`, `llms.txt` and every advertised URL, and asserts:

- **body text in the served HTML** — the check that would have caught the English home
  page shipping one word for months,
- empty translation slots, meaning a page was not prerendered,
- title, meta description, canonical, H1, JSON-LD presence,
- hreflang reciprocity across the translated sets,
- `X-Robots-Tag: noindex` on app screens, and its absence on public ones,
- and, against the previous day's snapshot, what got *worse* rather than what is merely
  imperfect.

Run it against anything:

```bash
python app/scripts/seo_audit.py
python app/scripts/seo_audit.py --base http://127.0.0.1:8099 --canonical-base https://www.steliara.com
```

Against production before today's fixes it reported 16 errors. Against the fixed build,
0.

### The content agent

`docs/marketing/seo-backlog.yml` is an ordered queue; each item carries the measured
reason it exists. `docs/marketing/seo-agent-brief.md` is the agent's operating brief —
edit it there, not in the workflow.

Each Monday the agent takes the first `todo` item, checks the target queries still
justify a page, writes it, wires the route, the sitemap entry, the internal links and a
test, runs every gate, and opens a PR. The PR description carries who ranks in the top 5
today, the URL behind every competitor claim, and anything it wanted to claim and could
not source.

It is instructed to open an issue instead of a PR when an item stops making sense. A week
with no PR and a clear reason is a good week.

---

## What you have to do once

Four things, all in a browser, maybe an hour total. I cannot do these: they need account
creation or credentials.

All four are browser work. The `gh` PAT on this machine gets HTTP 403 on
`/actions/secrets` and the Render CLI is not logged in, so none of it can be scripted
from here even in principle — and an Anthropic API key is a credential I will not handle
in plaintext regardless of tooling.

1. **`ANTHROPIC_API_KEY`** — create at
   [console.anthropic.com](https://console.anthropic.com/settings/keys) → Create Key,
   then paste it at
   `github.com/igskak/RNDastrobot/settings/secrets/actions` → New repository secret,
   name exactly `ANTHROPIC_API_KEY`. Without it the content agent idles with a notice
   every Monday instead of failing. Billed on API rates, separately from a Claude
   subscription. Budget roughly one medium coding session a week.
2. **Connect Google Search Console.** The code is written and wired into the daily
   monitor (`app/scripts/gsc_report.py`); it no-ops with a notice until the credential
   exists. Four steps, all in a browser, once:

   1. **Google Cloud project** — [console.cloud.google.com](https://console.cloud.google.com/projectcreate).
      Any name. An existing project is fine too.
   2. **Enable the API** — APIs & Services → Library → "Google Search Console API" →
      Enable. (It is listed under this name; the endpoints still say `webmasters/v3`.)
   3. **Service account** — IAM & Admin → Service Accounts → Create. No project role is
      needed: the permission that matters is granted in Search Console, not in GCP. Then
      Keys → Add key → Create new key → **JSON**, and copy the downloaded file's
      `client_email` — it looks like `something@project-id.iam.gserviceaccount.com`.
   4. **Grant it the property, then store the key**:
      - [Search Console](https://search.google.com/search-console) → pick the
        `steliara.com` domain property → Settings → Users and permissions → Add user →
        paste that `client_email` → permission **Restricted** (read is all it needs).
      - `github.com/igskak/RNDastrobot/settings/secrets/actions` → New repository secret,
        name `GSC_SERVICE_ACCOUNT`, value = **the entire contents of the JSON file**,
        pasted as-is including the braces.

   Skipping step 4's first half is the usual mistake: the credential authenticates fine
   and every query comes back 403. The script detects that case specifically and prints
   the fix rather than a raw API error.

   Check it locally before trusting the workflow:
   ```bash
   GSC_SERVICE_ACCOUNT=~/Downloads/your-key.json python app/scripts/gsc_report.py
   ```
3. **Bing Webmaster Tools** — free, five minutes, and Bing is where we already rank #2 for
   the category term. Import from GSC rather than re-verifying.
4. **`INDEXNOW_KEY`** — any 8–128 character hex string, the *same value* in **two**
   places, or it does nothing:
   - Render dashboard → the `astrobot` service → Environment → Add Environment Variable,
     key `INDEXNOW_KEY`. This is what makes `/indexnow-<key>.txt` answer, which is how
     the engines verify we own the origin. Saving it redeploys the service, so do it
     *after* the prerender PR is merged — the route does not exist on production until
     then.
   - `github.com/igskak/RNDastrobot/settings/secrets/actions` → New repository secret,
     same name, same value. This is what lets the daily monitor submit.

   It is not a credential: it grants nothing and is served publicly at that URL. It is a
   secret only in repo-settings terminology. With one side set and not the other the
   daily monitor emits a warning annotation and carries on.

### Things that will never be automated here, on purpose

- **Directory and marketplace listings** (G2, Capterra, Product Hunt, Crunchbase). They
  require account creation, which I will not do on your behalf. `wave2-directory-kit.md`
  has the copy prepared; the submissions are yours. These matter more than usual right
  now because of the brand collision below.
- **Outreach and anything posted under your name.** The micro-influencer playbook stays
  a human channel.
- **Merging.** By your choice, and it is the right one.

---

## The brand-name problem, which no pipeline fixes

Unqualified `steliara` autocorrects to **stelara** — Johnson & Johnson's ustekinumab, a
multi-billion-dollar drug brand. On 2026-09-17 the site did not appear anywhere on that
results page. Only the quoted `"steliara"` returns us, at #1.

Nothing in this pipeline addresses that, because it is an entity-recognition problem, not
a content one. The lever is external corroboration: Crunchbase, LinkedIn, Product Hunt,
G2, Wikidata — enough independent sources naming "Steliara" as a software product that
engines stop treating it as a misspelling. That is a reason to prioritise item 3 above,
not a reason to consider renaming; it is a tax on brand marketing, not a wall.

---

## What to expect, and when

Organic SEO compounds slowly and this domain is starting from two sessions a quarter.

- **Weeks 1–2:** re-crawl of the fixed pages. The English home page acquires content in
  Google's index for the first time. App shells begin dropping out. IndexNow makes the
  Bing side of this near-immediate.
- **Weeks 3–8:** the first new pages land. `/record-astrology-consultations` is the one to
  watch — it targets our own hero claim, which a competitor currently owns outright.
- **Months 3–6:** whether the alternative pages rank. This is the real test of the
  channel. If `/astrology-practice-management` holding #2 on Bing with 690 words and no
  backlinks is representative, the format works and the constraint is simply page count.

The honest failure mode is Google. Bing already ranks us; Google sends nothing. If, three
months after the prerender fix and with Search Console connected, Google impressions are
still flat, the problem is domain authority rather than pages, and the answer is links and
listings — not more content.

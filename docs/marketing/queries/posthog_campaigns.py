"""What PostHog saw around the Product Hunt launch and the DAV-Kongress flyers.

Usage: the key comes from POSTHOG_PERSONAL_API_KEY in the environment, or from the same
line in the main checkout's app/.env (git-ignored), so it never goes on a command line:
    python docs/marketing/queries/posthog_campaigns.py

Needs a personal API key (phx_...) with read access to project 209186, from
eu.posthog.com > Settings > Personal API keys. Prints counts only: no emails,
names, distinct ids or full URLs.
"""
import json
import os
import sys
import urllib.request

import ssl
from pathlib import Path

import certifi
from dotenv import dotenv_values

HOST = "https://eu.posthog.com"
PROJECT = os.getenv("POSTHOG_PROJECT_ID", "209186")
SINCE = "2026-09-20"

QUERIES = {
    "1. Events per day: client pageviews vs everything else (server-mirrored included)": f"""
        SELECT toDate(timestamp) AS day,
               countIf(event = '$pageview')                         AS pageviews,
               uniqIf(distinct_id, event = '$pageview')              AS visitors,
               countIf(event NOT LIKE '$%')                          AS business_events,
               count()                                               AS all_events
        FROM events
        WHERE timestamp >= '{SINCE}'
        GROUP BY day ORDER BY day
    """,
    "2. Visits from the campaigns (promo, ?ref=producthunt, PH referrer)": f"""
        SELECT toDate(timestamp) AS day,
               multiIf(properties.$current_url ILIKE '%promo=dav2026%', 'dav2026 QR',
                       properties.$current_url ILIKE '%ref=producthunt%', 'producthunt ref',
                       properties.$referring_domain ILIKE '%producthunt%', 'producthunt referrer',
                       'other') AS campaign,
               properties.$pathname AS path,
               properties.$device_type AS device,
               count() AS pageviews,
               uniq(distinct_id) AS visitors
        FROM events
        WHERE event = '$pageview' AND timestamp >= '{SINCE}'
          AND (properties.$current_url ILIKE '%promo=%'
               OR properties.$current_url ILIKE '%ref=producthunt%'
               OR properties.$referring_domain ILIKE '%producthunt%')
        GROUP BY day, campaign, path, device ORDER BY day
    """,
    "3. Where visitors came from (first referrer domain), since 2026-09-26": """
        SELECT coalesce(properties.$referring_domain, '(none)') AS referrer,
               count() AS pageviews,
               uniq(distinct_id) AS visitors
        FROM events
        WHERE event = '$pageview' AND timestamp >= '2026-09-26'
        GROUP BY referrer ORDER BY visitors DESC LIMIT 25
    """,
    "4. Business events per day (sign-ups, logins, consent, server mirrors)": f"""
        SELECT toDate(timestamp) AS day, event, count() AS n
        FROM events
        WHERE timestamp >= '{SINCE}' AND event NOT LIKE '$%'
        GROUP BY day, event ORDER BY day, n DESC
    """,
    "5. Consent banner answers per day (if tracked)": f"""
        SELECT toDate(timestamp) AS day, event, count() AS n
        FROM events
        WHERE timestamp >= '{SINCE}' AND (event ILIKE '%consent%' OR event = '$opt_in')
        GROUP BY day, event ORDER BY day
    """,
}


def run(key: str, hogql: str):
    req = urllib.request.Request(
        f"{HOST}/api/projects/{PROJECT}/query/",
        data=json.dumps({"query": {"kind": "HogQLQuery", "query": hogql}}).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    ctx = ssl.create_default_context(cafile=certifi.where())
    with urllib.request.urlopen(req, context=ctx, timeout=60) as resp:
        body = json.load(resp)
    return body.get("columns", []), body.get("results", [])


def show(title, cols, rows):
    rows = [["" if v is None else str(v) for v in r] for r in rows]
    widths = [max([len(c)] + [len(r[i]) for r in rows]) for i, c in enumerate(cols)]
    print(f"\n-- {title}: {len(rows)} row(s)")
    print("  ".join(c.ljust(w) for c, w in zip(cols, widths)))
    for r in rows:
        print("  ".join(v.ljust(w) for v, w in zip(r, widths)))


def main():
    key = os.getenv("POSTHOG_PERSONAL_API_KEY", "").strip()
    if not key:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from run_readonly import env_file
        key = (dotenv_values(env_file()).get("POSTHOG_PERSONAL_API_KEY") or "").strip()
    if not key:
        sys.exit("Set POSTHOG_PERSONAL_API_KEY first (see the docstring).")
    for title, q in QUERIES.items():
        try:
            show(title, *run(key, q))
        except urllib.error.HTTPError as e:
            print(f"\n-- {title}: HTTP {e.code} {e.read().decode(errors='replace')[:300]}")


if __name__ == "__main__":
    main()

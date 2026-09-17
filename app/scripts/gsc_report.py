#!/usr/bin/env python3
"""Pulls Search Console data so "Google sends us nothing" becomes a number.

Everything else in this pipeline measures what we serve. This measures what Google does
with it: impressions, clicks, average position, per query and per page, against the
previous equal-length window. Without it the Google side of the audit is an inference
from GA4 sessions, which only sees the clicks that already happened and is blind to the
much larger question of whether we are being shown at all.

No new dependencies: PyJWT is already pinned in app/requirements.txt, and a service
account only needs it to sign one assertion. HTTP is stdlib.

    GSC_SERVICE_ACCOUNT=./sa.json python app/scripts/gsc_report.py
    GSC_SERVICE_ACCOUNT='{"type":"service_account",...}' python app/scripts/gsc_report.py
    python app/scripts/gsc_report.py --days 7 --json gsc.json

Unset GSC_SERVICE_ACCOUNT and it prints a notice and exits 0, so it can be wired into a
workflow before the credential exists.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta

TOKEN_URL = "https://oauth2.googleapis.com/token"
API_ROOT = "https://www.googleapis.com/webmasters/v3/sites"
SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
DEFAULT_SITE = "sc-domain:steliara.com"

# Search Console finalizes data with a lag. Ending the window today would compare a
# half-populated day against a complete one and invent a drop every morning.
FRESHNESS_LAG_DAYS = 3

TIMEOUT = 60


def _ssl_context():
    try:
        import ssl

        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return None


_SSL_CONTEXT = _ssl_context()


def load_service_account(raw: str) -> dict:
    """Accepts the JSON itself or a path to it — CI passes one, a laptop the other."""
    candidate = raw.strip()
    if candidate.startswith("{"):
        return json.loads(candidate)
    with open(os.path.expanduser(candidate), encoding="utf-8") as handle:
        return json.load(handle)


def access_token(service_account: dict) -> str:
    """Two-legged OAuth: sign an assertion, trade it for a bearer token."""
    import jwt  # PyJWT[crypto], already pinned for the app

    issued = int(time.time())
    assertion = jwt.encode(
        {
            "iss": service_account["client_email"],
            "scope": SCOPE,
            "aud": TOKEN_URL,
            "iat": issued,
            "exp": issued + 3600,
        },
        service_account["private_key"],
        algorithm="RS256",
    )

    body = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": assertion,
    }).encode()

    request = urllib.request.Request(TOKEN_URL, data=body, method="POST")
    with urllib.request.urlopen(request, timeout=TIMEOUT, context=_SSL_CONTEXT) as response:
        return json.loads(response.read())["access_token"]


def query(token: str, site: str, payload: dict) -> list:
    url = f"{API_ROOT}/{urllib.parse.quote(site, safe='')}/searchAnalytics/query"
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT, context=_SSL_CONTEXT) as response:
            return json.loads(response.read()).get("rows", [])
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:300]
        if exc.code == 403:
            raise SystemExit(
                f"Search Console refused the request for {site}.\n"
                "The usual cause is that the service account has not been added to the "
                "property: Search Console > Settings > Users and permissions > Add user, "
                "using the service account's client_email, with Full or Restricted access.\n"
                f"API said: {detail}"
            )
        if exc.code == 404:
            raise SystemExit(
                f"Search Console has no property called {site}.\n"
                "A domain property is addressed as sc-domain:example.com; a URL-prefix "
                "property as https://www.example.com/ including the trailing slash.\n"
                f"API said: {detail}"
            )
        raise SystemExit(f"Search Console returned HTTP {exc.code}: {detail}")


def totals(rows: list) -> dict:
    clicks = sum(row.get("clicks", 0) for row in rows)
    impressions = sum(row.get("impressions", 0) for row in rows)
    # Position has to be weighted by impressions; averaging the averages of a long tail
    # of one-impression queries would flatter us badly.
    weighted = sum(row.get("position", 0) * row.get("impressions", 0) for row in rows)
    return {
        "clicks": clicks,
        "impressions": impressions,
        "ctr": round(clicks / impressions, 4) if impressions else 0.0,
        "position": round(weighted / impressions, 2) if impressions else 0.0,
    }


def window(days: int) -> tuple:
    end = date.today() - timedelta(days=FRESHNESS_LAG_DAYS)
    start = end - timedelta(days=days - 1)
    previous_end = start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=days - 1)
    return (start, end, previous_start, previous_end)


def collect(token: str, site: str, days: int) -> dict:
    start, end, previous_start, previous_end = window(days)

    def run(dimensions, since, until, limit=25):
        return query(token, site, {
            "startDate": since.isoformat(),
            "endDate": until.isoformat(),
            "dimensions": dimensions,
            "rowLimit": limit,
        })

    current_days = run(["date"], start, end, limit=1000)
    previous_days = run(["date"], previous_start, previous_end, limit=1000)

    now, before = totals(current_days), totals(previous_days)
    return {
        "site": site,
        "window": {"start": start.isoformat(), "end": end.isoformat(), "days": days},
        "previous_window": {"start": previous_start.isoformat(), "end": previous_end.isoformat()},
        "totals": now,
        "previous_totals": before,
        "delta": {
            key: round(now[key] - before[key], 4) for key in ("clicks", "impressions", "ctr", "position")
        },
        "by_day": [
            {"date": row["keys"][0], **{k: row.get(k, 0) for k in ("clicks", "impressions", "position")}}
            for row in sorted(current_days, key=lambda r: r["keys"][0])
        ],
        "top_queries": [
            {"query": row["keys"][0], **{k: row.get(k, 0) for k in ("clicks", "impressions", "position")}}
            for row in run(["query"], start, end)
        ],
        "top_pages": [
            {"page": row["keys"][0], **{k: row.get(k, 0) for k in ("clicks", "impressions", "position")}}
            for row in run(["page"], start, end)
        ],
    }


def render(report: dict) -> str:
    now, before, delta = report["totals"], report["previous_totals"], report["delta"]
    win, prev = report["window"], report["previous_window"]

    lines = [
        f"Search Console — {report['site']}",
        f"{win['start']} to {win['end']} ({win['days']}d), vs {prev['start']} to {prev['end']}",
        "",
        f"{'':<14}{'now':>10}{'before':>10}{'change':>10}",
        f"{'impressions':<14}{now['impressions']:>10}{before['impressions']:>10}{delta['impressions']:>+10}",
        f"{'clicks':<14}{now['clicks']:>10}{before['clicks']:>10}{delta['clicks']:>+10}",
        f"{'avg position':<14}{now['position']:>10}{before['position']:>10}{delta['position']:>+10}",
        f"{'ctr':<14}{now['ctr']:>10.2%}{before['ctr']:>10.2%}{delta['ctr']:>+10.2%}",
    ]

    if not now["impressions"]:
        lines += [
            "",
            "Zero impressions in the window. Either the property has no data yet, or Google "
            "is not showing the site at all. Check Search Console > Pages for the indexing "
            "reason before assuming it is a ranking problem.",
        ]
        return "\n".join(lines)

    for label, key, rows in (("Top queries", "query", report["top_queries"]),
                             ("Top pages", "page", report["top_pages"])):
        lines += ["", label, f"  {'':<52}{'impr':>7}{'clicks':>8}{'pos':>7}"]
        for row in rows[:10]:
            name = str(row[key])
            if len(name) > 50:
                name = name[:47] + "..."
            lines.append(f"  {name:<52}{row['impressions']:>7}{row['clicks']:>8}{row['position']:>7.1f}")
    return "\n".join(lines)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--site", default=os.getenv("GSC_SITE", DEFAULT_SITE))
    parser.add_argument("--days", type=int, default=28)
    parser.add_argument("--json", dest="json_path", help="write the full report here")
    parser.add_argument(
        "--fail-on-impression-drop", type=float, default=0.0,
        help="exit non-zero when impressions fall by more than this fraction (e.g. 0.4)",
    )
    args = parser.parse_args(argv)

    raw = os.getenv("GSC_SERVICE_ACCOUNT", "").strip()
    if not raw:
        print(
            "GSC_SERVICE_ACCOUNT is not set — skipping the Search Console pull. "
            "This is not an error; see docs/marketing/seo-automation-pipeline.md for setup."
        )
        return 0

    try:
        service_account = load_service_account(raw)
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"GSC_SERVICE_ACCOUNT is neither valid JSON nor a readable file: {exc}")

    report = collect(access_token(service_account), args.site, args.days)
    print(render(report))

    if args.json_path:
        with open(args.json_path, "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2, ensure_ascii=False, sort_keys=True)
            handle.write("\n")

    before = report["previous_totals"]["impressions"]
    if args.fail_on_impression_drop and before:
        drop = (before - report["totals"]["impressions"]) / before
        if drop > args.fail_on_impression_drop:
            print(f"\nImpressions fell {drop:.0%} against the previous window.")
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

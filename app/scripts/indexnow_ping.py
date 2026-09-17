#!/usr/bin/env python3
"""Tells the IndexNow engines that our pages changed, instead of waiting for a crawl.

One POST covers Bing, Yandex and Seznam — and Copilot, which rides the Bing index.
Bing is where we already rank (#2 for "astrology practice management software" on
2026-09-17), so pushing a change there costs nothing and lands in minutes.

Google does not participate in IndexNow. For Google the levers are the sitemap and
Search Console, not this.

Needs INDEXNOW_KEY set to the same value the origin serves at
/indexnow-<key>.txt. Without it this exits 0 and does nothing, so it is safe to wire
into a pipeline before the key exists.

    INDEXNOW_KEY=... python app/scripts/indexnow_ping.py
    INDEXNOW_KEY=... python app/scripts/indexnow_ping.py --dry-run
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

ENDPOINT = "https://api.indexnow.org/indexnow"
DEFAULT_BASE = "https://www.steliara.com"
TIMEOUT = 30


def _ssl_context():
    try:
        import ssl

        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return None


def sitemap_urls(base: str) -> list:
    request = urllib.request.Request(
        f"{base}/sitemap.xml", headers={"User-Agent": "SteliaraIndexNow/1.0"}
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT, context=_ssl_context()) as response:
        body = response.read().decode("utf-8", "replace")
    return re.findall(r"<loc>([^<]+)</loc>", body)


def verify_key_is_served(base: str, key: str) -> bool:
    """IndexNow rejects the whole batch if the key file is missing. Check first."""
    url = f"{base}/indexnow-{key}.txt"
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "SteliaraIndexNow/1.0"})
        with urllib.request.urlopen(request, timeout=TIMEOUT, context=_ssl_context()) as response:
            return response.status == 200 and response.read().decode().strip() == key
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError):
        return False


def submit(base: str, key: str, urls: list) -> int:
    host = urllib.parse.urlparse(base).netloc
    payload = json.dumps({
        "host": host,
        "key": key,
        "keyLocation": f"{base}/indexnow-{key}.txt",
        "urlList": urls,
    }).encode("utf-8")

    request = urllib.request.Request(
        ENDPOINT,
        data=payload,
        headers={"Content-Type": "application/json; charset=utf-8", "User-Agent": "SteliaraIndexNow/1.0"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT, context=_ssl_context()) as response:
            return response.status
    except urllib.error.HTTPError as exc:
        print(f"IndexNow refused the batch: HTTP {exc.code} {exc.read().decode('utf-8', 'replace')[:200]}")
        return exc.code


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base", default=os.getenv("FRONTEND_BASE_URL", DEFAULT_BASE))
    parser.add_argument("--dry-run", action="store_true", help="print what would be submitted")
    args = parser.parse_args(argv)

    base = args.base.rstrip("/")
    key = os.getenv("INDEXNOW_KEY", "").strip()
    if not key:
        print("INDEXNOW_KEY is not set — skipping. This is not an error.")
        return 0

    urls = sitemap_urls(base)
    if not urls:
        print("Sitemap listed no URLs — nothing to submit.")
        return 1

    if args.dry_run:
        print(f"Would submit {len(urls)} URLs for {base}:")
        print("\n".join(f"  {url}" for url in urls))
        return 0

    if not verify_key_is_served(base, key):
        print(
            f"{base}/indexnow-{key}.txt does not serve the key. "
            "Set INDEXNOW_KEY on the web service too, then retry."
        )
        return 1

    status = submit(base, key, urls)
    # 200 accepted, 202 accepted but the key is still being validated.
    if status in (200, 202):
        print(f"Submitted {len(urls)} URLs to IndexNow (HTTP {status}).")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())

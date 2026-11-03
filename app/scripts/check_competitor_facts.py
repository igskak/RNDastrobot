#!/usr/bin/env python3
"""Re-read every source behind a competitor claim and report whether it still holds.

Reads docs/marketing/competitor-facts.json. For each entry it fetches `source`, strips
inline data: URIs (alabe.com pages are about 700,000 characters, nearly all base64),
and looks for `phrase` in the page text or in the raw HTML with whitespace collapsed.

Per entry the outcome is one of:
  held            the phrase is on the source
  phrase missing  the source loaded and the phrase is not there: the claim may be stale
  fetch failed    the source could not be read; this is never counted as a pass

Exit status: 1 when any phrase is missing, 2 when none is missing but a fetch failed,
0 when every entry held. Standard library only, so it runs in any CI image.

    python app/scripts/check_competitor_facts.py
    python app/scripts/check_competitor_facts.py --json     # machine-readable
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
import urllib.request
from pathlib import Path
from typing import Any, Dict, List

FACTS_PATH = Path(__file__).resolve().parents[2] / "docs" / "marketing" / "competitor-facts.json"
USER_AGENT = "Mozilla/5.0 (compatible; steliara-competitor-facts-check)"
TIMEOUT_SECONDS = 30

_DATA_URI = re.compile(r"data:[^\"')\s]+")
_SCRIPT_OR_STYLE = re.compile(r"<(script|style)\b.*?</\1>", re.S | re.I)
_TAG = re.compile(r"<[^>]+>")
_SPACE = re.compile(r"\s+")


def load_facts(path: Path = FACTS_PATH) -> List[Dict[str, Any]]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)["facts"]


def normalise(raw_html: str) -> List[str]:
    """Two views of a page: visible text, and raw HTML with whitespace collapsed."""
    stripped = _DATA_URI.sub("", raw_html)
    text = _TAG.sub(" ", _SCRIPT_OR_STYLE.sub(" ", stripped))
    views = [_SPACE.sub(" ", html.unescape(text)), _SPACE.sub(" ", html.unescape(stripped))]
    return views


def phrase_held(raw_html: str, phrase: str) -> bool:
    needle = _SPACE.sub(" ", phrase)
    return any(needle in view for view in normalise(raw_html))


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        return response.read().decode("utf-8", "replace")


def check(facts: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    pages: Dict[str, Any] = {}
    results: List[Dict[str, str]] = []
    for fact in facts:
        url = fact["source"]
        if url not in pages:
            try:
                pages[url] = fetch(url)
            except Exception as error:  # a vendor being down must not read as a pass
                pages[url] = error
        body = pages[url]
        if isinstance(body, Exception):
            status, detail = "fetch failed", f"{type(body).__name__}: {body}"
        elif phrase_held(body, fact["phrase"]):
            status, detail = "held", ""
        else:
            status, detail = "phrase missing", f'"{fact["phrase"]}" not on the page'
        results.append({"id": fact["id"], "status": status, "source": url, "detail": detail})
    return results


def main(argv: List[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--json", action="store_true", help="print results as JSON")
    args = parser.parse_args(argv)

    results = check(load_facts())
    if args.json:
        print(json.dumps(results, indent=2))
    else:
        for row in results:
            line = f'{row["status"]:<15} {row["id"]:<30} {row["source"]}'
            print(line + (f'  ({row["detail"]})' if row["detail"] else ""))
        counts = {s: sum(r["status"] == s for r in results) for s in ("held", "phrase missing", "fetch failed")}
        print("\n" + ", ".join(f"{n} {s}" for s, n in counts.items()))

    if any(r["status"] == "phrase missing" for r in results):
        return 1
    if any(r["status"] == "fetch failed" for r in results):
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

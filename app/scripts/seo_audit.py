#!/usr/bin/env python3
"""Turns the organic surface of the site into something that can pass or fail.

Run it against production (or any deploy) and it fetches robots.txt, sitemap.xml,
llms.txt and every advertised URL, then asserts the things that quietly broke before:

- a page whose text only exists after JavaScript runs (the English home page shipped
  1 word of body text for months while /de/ shipped 859 — Google renders JS on a queue
  and most AI crawlers do not render it at all),
- an application screen that is missing its noindex,
- a sitemap URL that 404s, lost its title, its description, its canonical or its H1.

Stdlib only, on purpose: this has to run in a cold CI container with no install step.

    python app/scripts/seo_audit.py
    python app/scripts/seo_audit.py --base https://staging.example.com --json out.json
    python app/scripts/seo_audit.py --baseline docs/marketing/seo-baseline.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import date
from html.parser import HTMLParser
from typing import Iterable, Optional

DEFAULT_BASE = "https://www.steliara.com"
USER_AGENT = "SteliaraSEOAudit/1.0 (+https://www.steliara.com)"
TIMEOUT = 30

# Below this, a page is a shell: the text is in the catalogs and the crawler never
# sees it. 200 words is well under any real page we publish and well over the 1 word
# the English home page used to serve.
MIN_BODY_WORDS = 200

TITLE_RANGE = (15, 65)
DESCRIPTION_RANGE = (70, 165)

# Screens that must never be indexed. Not exhaustive by design — the server derives the
# real rule from the sitemap — but these are the ones Bing actually had.
MUST_BE_NOINDEX = (
    "/login.html",
    "/calendar",
    "/account-settings.html",
    "/natal-full.html",
    "/forecast-new.html",
    "/new",
)

ERROR, WARN = "error", "warning"


def describe_status(status: int, headers: dict) -> str:
    """HTTP 0 means we never got a reply; saying why beats saying zero."""
    if status:
        return f"HTTP {status}"
    reason = headers.get("x-audit-error", "no response")
    return f"unreachable ({reason})"


@dataclass
class Finding:
    level: str
    check: str
    url: str
    detail: str

    def __str__(self) -> str:
        mark = "FAIL" if self.level == ERROR else "warn"
        return f"  [{mark}] {self.check}: {self.url} — {self.detail}"


@dataclass
class PageFacts:
    url: str
    status: int
    title: str = ""
    description: str = ""
    canonical: str = ""
    h1: str = ""
    body_words: int = 0
    jsonld_blocks: int = 0
    empty_i18n_nodes: int = 0
    hreflang: dict = field(default_factory=dict)
    robots_header: str = ""
    status_detail: str = ""
    bytes: int = 0


class _Extractor(HTMLParser):
    """Pulls the handful of facts we assert on, without a parser dependency."""

    _SKIP = {"script", "style", "svg", "noscript", "template"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.description = ""
        self.canonical = ""
        self.h1 = ""
        self.jsonld_blocks = 0
        self.hreflang: dict = {}
        self._text: list = []
        self._skip_depth = 0
        self._in_title = False
        self._in_h1 = False
        self._in_body = False

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag in self._SKIP:
            self._skip_depth += 1
            if tag == "script" and attributes.get("type") == "application/ld+json":
                self.jsonld_blocks += 1
            return
        if tag == "body":
            self._in_body = True
        elif tag == "title":
            self._in_title = True
        elif tag == "h1" and not self.h1:
            self._in_h1 = True
        elif tag == "meta" and attributes.get("name", "").lower() == "description":
            self.description = attributes.get("content", "")
        elif tag == "link":
            rel = attributes.get("rel", "").lower()
            if rel == "canonical":
                self.canonical = attributes.get("href", "")
            elif rel == "alternate" and attributes.get("hreflang"):
                self.hreflang[attributes["hreflang"]] = attributes.get("href", "")

    def handle_startendtag(self, tag, attrs):
        if tag not in self._SKIP:
            self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if tag in self._SKIP:
            self._skip_depth = max(0, self._skip_depth - 1)
        elif tag == "title":
            self._in_title = False
        elif tag == "h1":
            self._in_h1 = False

    def handle_data(self, data):
        if self._skip_depth:
            return
        if self._in_title:
            self.title += data
        if self._in_h1:
            self.h1 += data
        if self._in_body:
            self._text.append(data)

    @property
    def body_words(self) -> int:
        return len(re.sub(r"\s+", " ", "".join(self._text)).split())


def _ssl_context():
    """CI has a system CA bundle; a stock python.org build on macOS does not.

    Without this the whole audit reports HTTP 0 on a developer laptop and looks like the
    site is down.
    """
    try:
        import ssl

        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return None


_SSL_CONTEXT = _ssl_context()


def fetch(url: str) -> tuple:
    """Returns (status, body, headers). A non-200 is data, not an exception."""
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT, context=_SSL_CONTEXT) as response:
            return response.status, response.read().decode("utf-8", "replace"), dict(response.headers)
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", "replace"), dict(exc.headers)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        return 0, "", {"x-audit-error": str(exc)}


def read_page(url: str) -> PageFacts:
    status, body, headers = fetch(url)
    facts = PageFacts(url=url, status=status, bytes=len(body.encode("utf-8")))
    facts.robots_header = headers.get("X-Robots-Tag", headers.get("x-robots-tag", ""))
    facts.status_detail = describe_status(status, headers)
    if status != 200 or not body:
        return facts

    extractor = _Extractor()
    try:
        extractor.feed(body)
    except Exception:  # a malformed document is a finding, not a crash
        pass

    facts.title = extractor.title.strip()
    facts.description = extractor.description.strip()
    facts.canonical = extractor.canonical.strip()
    facts.h1 = re.sub(r"\s+", " ", extractor.h1).strip()
    facts.body_words = extractor.body_words
    facts.jsonld_blocks = extractor.jsonld_blocks
    facts.hreflang = extractor.hreflang
    # An element that carries a translation key and no text is a page whose copy only
    # exists once JavaScript has run. This is the check that would have caught the
    # English home page shipping blank for months.
    facts.empty_i18n_nodes = len(re.findall(r'data-i18n="[^"]*"[^>]*></', body))
    return facts


def sitemap_urls(base: str, findings: list) -> list:
    status, body, headers = fetch(f"{base}/sitemap.xml")
    if status != 200:
        findings.append(Finding(
            ERROR, "sitemap.reachable", f"{base}/sitemap.xml", describe_status(status, headers),
        ))
        return []
    urls = re.findall(r"<loc>([^<]+)</loc>", body)
    if not urls:
        findings.append(Finding(ERROR, "sitemap.populated", f"{base}/sitemap.xml", "no <loc> entries"))
    return urls


def check_robots(base: str, findings: list) -> None:
    status, body, headers = fetch(f"{base}/robots.txt")
    url = f"{base}/robots.txt"
    if status != 200:
        findings.append(Finding(ERROR, "robots.reachable", url, describe_status(status, headers)))
        return
    if "sitemap:" not in body.lower():
        findings.append(Finding(ERROR, "robots.sitemap", url, "does not point at the sitemap"))
    if "llms.txt" not in body:
        findings.append(Finding(WARN, "robots.llms", url, "does not mention llms.txt"))
    for blocked in ("/login", "/calendar", "/account-settings"):
        if f"Disallow: {blocked}" in body:
            findings.append(Finding(
                ERROR, "robots.blocks-noindex", url,
                f"Disallow: {blocked} hides the noindex header that would deindex it",
            ))


def check_llms(base: str, findings: list) -> None:
    status, body, headers = fetch(f"{base}/llms.txt")
    if status != 200:
        findings.append(Finding(ERROR, "llms.reachable", f"{base}/llms.txt", describe_status(status, headers)))
    elif len(body.split()) < 80:
        findings.append(Finding(WARN, "llms.substance", f"{base}/llms.txt", f"only {len(body.split())} words"))


def check_page(facts: PageFacts, findings: list, canonical_base: str = "") -> None:
    if facts.status != 200:
        findings.append(Finding(ERROR, "page.status", facts.url, facts.status_detail))
        return

    if facts.robots_header and "noindex" in facts.robots_header.lower():
        findings.append(Finding(
            ERROR, "page.noindexed", facts.url,
            f"advertised in the sitemap but served with X-Robots-Tag: {facts.robots_header}",
        ))

    # The one that matters most: a page whose text needs a JS engine to exist.
    if facts.body_words < MIN_BODY_WORDS:
        findings.append(Finding(
            ERROR, "page.empty-shell", facts.url,
            f"{facts.body_words} words of body text in the served HTML "
            f"(minimum {MIN_BODY_WORDS}) — crawlers that do not run JavaScript see nothing",
        ))
    if facts.empty_i18n_nodes:
        findings.append(Finding(
            ERROR, "page.unrendered-i18n", facts.url,
            f"{facts.empty_i18n_nodes} translation slots are empty in the served HTML "
            "— the page was not prerendered",
        ))

    low, high = TITLE_RANGE
    if not facts.title:
        findings.append(Finding(ERROR, "page.title", facts.url, "no <title>"))
    elif not low <= len(facts.title) <= high:
        findings.append(Finding(WARN, "page.title-length", facts.url, f"{len(facts.title)} chars (want {low}-{high})"))

    low, high = DESCRIPTION_RANGE
    if not facts.description:
        findings.append(Finding(ERROR, "page.description", facts.url, "no meta description"))
    elif not low <= len(facts.description) <= high:
        # Cyrillic descriptions run long in characters while reading short; warn only.
        findings.append(Finding(
            WARN, "page.description-length", facts.url, f"{len(facts.description)} chars (want {low}-{high})",
        ))

    if not facts.canonical:
        findings.append(Finding(ERROR, "page.canonical", facts.url, "no canonical link"))
    elif facts.canonical.rstrip("/") != _expected_canonical(facts.url, canonical_base).rstrip("/"):
        findings.append(Finding(
            WARN, "page.canonical-target", facts.url, f"canonical points at {facts.canonical}",
        ))

    if not facts.h1:
        findings.append(Finding(ERROR, "page.h1", facts.url, "no <h1>"))


def _expected_canonical(url: str, canonical_base: str) -> str:
    """Canonicals are baked into the prerendered HTML with the production origin.

    Auditing a staging deploy or a local server means the fetched URL and the canonical
    it should carry differ by hostname only, which is correct rather than a finding.
    """
    if not canonical_base:
        return url
    scheme_end = url.find("//")
    path_start = url.find("/", scheme_end + 2) if scheme_end != -1 else -1
    path = url[path_start:] if path_start != -1 else "/"
    return f"{canonical_base.rstrip('/')}{path}"


def check_hreflang_reciprocity(pages: dict, findings: list) -> None:
    """Every page in a translated set must list the whole set, itself included."""
    for url, facts in pages.items():
        if not facts.hreflang:
            continue
        for hreflang, href in facts.hreflang.items():
            if hreflang == "x-default":
                continue
            other = pages.get(href.rstrip("/")) or pages.get(href)
            if other is None:
                continue
            if url.rstrip("/") not in {h.rstrip("/") for h in other.hreflang.values()}:
                findings.append(Finding(
                    ERROR, "hreflang.reciprocity", url,
                    f"{href} does not link back — search engines treat them as competing duplicates",
                ))


def check_noindex_screens(base: str, findings: list) -> dict:
    results = {}
    for path in MUST_BE_NOINDEX:
        url = f"{base}{path}"
        status, _, headers = fetch(url)
        header = headers.get("X-Robots-Tag", headers.get("x-robots-tag", ""))
        results[path] = {"status": status, "x_robots_tag": header}
        if status == 404:
            continue
        if status != 200:
            findings.append(Finding(WARN, "screen.status", url, describe_status(status, headers)))
        elif "noindex" not in header.lower():
            findings.append(Finding(
                ERROR, "screen.indexable", url,
                "application screen is served without a noindex header",
            ))
    return results


def run(base: str, canonical_base: str = "") -> dict:
    base = base.rstrip("/")
    canonical_base = (canonical_base or base).rstrip("/")
    findings: list = []

    check_robots(base, findings)
    check_llms(base, findings)

    urls = sitemap_urls(base, findings)
    pages = {}
    for url in urls:
        facts = read_page(url)
        pages[url.rstrip("/")] = facts
        check_page(facts, findings, canonical_base)

    check_hreflang_reciprocity(pages, findings)
    screens = check_noindex_screens(base, findings)

    return {
        "base": base,
        "date": date.today().isoformat(),
        "sitemap_url_count": len(urls),
        "pages": {
            facts.url: {
                "status": facts.status,
                "title": facts.title,
                "title_length": len(facts.title),
                "description_length": len(facts.description),
                "canonical": facts.canonical,
                "h1": facts.h1,
                "body_words": facts.body_words,
                "jsonld_blocks": facts.jsonld_blocks,
                "empty_i18n_nodes": facts.empty_i18n_nodes,
                "hreflang_count": len(facts.hreflang),
                "x_robots_tag": facts.robots_header,
                "bytes": facts.bytes,
            }
            for facts in pages.values()
        },
        "app_screens": screens,
        "findings": [
            {"level": f.level, "check": f.check, "url": f.url, "detail": f.detail} for f in findings
        ],
        "errors": sum(1 for f in findings if f.level == ERROR),
        "warnings": sum(1 for f in findings if f.level == WARN),
    }


def compare_to_baseline(report: dict, baseline_path: str) -> list:
    """Reports what got worse since the last committed snapshot, not what is imperfect."""
    try:
        with open(baseline_path, encoding="utf-8") as handle:
            baseline = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return []

    regressions = []
    for url, before in baseline.get("pages", {}).items():
        after = report["pages"].get(url)
        if after is None:
            regressions.append(f"{url} disappeared from the sitemap")
            continue
        if before.get("body_words", 0) - after.get("body_words", 0) > 50:
            regressions.append(
                f"{url}: body text fell from {before['body_words']} to {after['body_words']} words"
            )
        if before.get("status") == 200 and after.get("status") != 200:
            regressions.append(f"{url}: HTTP {before['status']} -> {after['status']}")
        if before.get("title") and not after.get("title"):
            regressions.append(f"{url}: lost its <title>")
    return regressions


def render(report: dict, regressions: Iterable) -> str:
    lines = [f"SEO audit — {report['base']} — {report['date']}", ""]
    lines.append(f"{'URL':<50} {'HTTP':>4} {'words':>6} {'title':>6} {'desc':>5} {'ld':>3}")
    for url, page in sorted(report["pages"].items()):
        short = url.replace(report["base"], "") or "/"
        lines.append(
            f"{short:<50} {page['status']:>4} {page['body_words']:>6} "
            f"{page['title_length']:>6} {page['description_length']:>5} {page['jsonld_blocks']:>3}"
        )

    lines += ["", f"{report['errors']} errors, {report['warnings']} warnings"]
    for level in (ERROR, WARN):
        for finding in report["findings"]:
            if finding["level"] == level:
                mark = "FAIL" if level == ERROR else "warn"
                lines.append(f"  [{mark}] {finding['check']}: {finding['url']} — {finding['detail']}")

    regressions = list(regressions)
    if regressions:
        lines += ["", "Regressions against the committed baseline:"]
        lines += [f"  - {item}" for item in regressions]
    return "\n".join(lines)


def main(argv: Optional[list] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base", default=DEFAULT_BASE, help="origin to audit")
    parser.add_argument(
        "--canonical-base", default="",
        help="origin the canonicals should point at (defaults to --base; set it when "
             "auditing staging or localhost, where the baked-in canonical is production)",
    )
    parser.add_argument("--json", dest="json_path", help="write the full report here")
    parser.add_argument("--baseline", help="committed snapshot to compare against")
    parser.add_argument(
        "--fail-on", choices=("error", "warning", "never"), default="error",
        help="exit non-zero at this severity (default: error)",
    )
    args = parser.parse_args(argv)

    report = run(args.base, args.canonical_base)
    regressions = compare_to_baseline(report, args.baseline) if args.baseline else []
    report["regressions"] = regressions

    print(render(report, regressions))

    if args.json_path:
        with open(args.json_path, "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2, ensure_ascii=False, sort_keys=True)
            handle.write("\n")

    if args.fail_on == "never":
        return 0
    if report["errors"] or regressions:
        return 1
    if args.fail_on == "warning" and report["warnings"]:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

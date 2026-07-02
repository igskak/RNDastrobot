"""
Structured citation (quote-by-reference) for chat-v2 Layer-2 numbers.

The model does not retype numbers; it cites result rows by id and field, e.g.
``{{r0.speed}}``. The server substitutes the actual value from that turn's
tool_results, so every cited number is server-rendered by construction — the
no-invented-numbers guarantee becomes structural for cited values, and an
unresolved reference is a caught fabrication (the caller refuses).

Index keys are ``<row_id>.<field>`` built from analyze()/tool result rows that
carry an ``id``. Ids are per-turn; if two results in one turn reuse an id, the
later result wins (beta limitation — most turns run a single analyze()).
"""
from __future__ import annotations

import re
from typing import Dict, List, Tuple

# Injected into the system prompt so the model cites instead of retyping numbers.
CITATION_RULE = (
    "When you state a number that came from an analyze() result row, cite it as "
    "{{row_id.field}} using that row's id and field name (for example "
    "{{r0.speed}}); do NOT retype the number yourself. The server substitutes the "
    "exact value. Numbers from other tools may be stated normally."
)

# {{ r0.speed }} — row id + field, tolerant of surrounding whitespace.
_TOKEN_RE = re.compile(r"\{\{\s*(r\d+\.[A-Za-z_]\w*)\s*\}\}")


def build_citation_index(tool_results) -> Dict[str, object]:
    """Map '<row_id>.<field>' -> value from every cited row in the turn's results."""
    index: Dict[str, object] = {}
    for tr in tool_results or []:
        if not isinstance(tr, dict):
            continue
        result = tr.get("result")
        rows = result.get("rows") if isinstance(result, dict) else None
        for row in rows or []:
            if not isinstance(row, dict) or "id" not in row:
                continue
            rid = row["id"]
            for field, val in row.items():
                if field != "id":
                    index[f"{rid}.{field}"] = val
    return index


def _fmt(value) -> str:
    if value is None:
        return "n/a"
    if isinstance(value, bool):
        return "yes" if value else "no"
    return str(value)


def render_citations(reply: str, index: Dict[str, object]) -> Tuple[str, List[str]]:
    """Substitute {{row.field}} tokens with server values.

    Returns (rendered_text, unresolved_keys). A non-empty unresolved list means
    the model cited a value the server never produced — a fabrication the caller
    must refuse rather than serve.
    """
    unresolved: List[str] = []

    def repl(match):
        key = match.group(1)
        if key in index:
            return _fmt(index[key])
        unresolved.append(key)
        return match.group(0)  # leave the raw token; caller will block

    return _TOKEN_RE.sub(repl, reply or ""), unresolved

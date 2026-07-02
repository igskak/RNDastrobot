"""
Tests for structured citation (quote-by-reference).

Every cited number must resolve to a server value; an unresolved reference must
be reported so the caller refuses rather than serving a fabricated number.
"""
from app.services.astro_citation import (
    build_citation_index,
    render_citations,
    strip_citation_tokens,
)


def test_strip_citation_tokens_removes_stray_tokens():
    # safety net for turns with no analyze() rows (a stray token is a formatting slip)
    assert strip_citation_tokens("Uranus conj Moon on {{r0.date}}.") == "Uranus conj Moon on ."
    assert strip_citation_tokens("no tokens here") == "no tokens here"
    assert strip_citation_tokens("") == ""


def _tool_results():
    return [{
        "name": "analyze",
        "result": {
            "op": "rank",
            "rows": [
                {"id": "r0", "name": "Moon", "speed": 13.2, "retrograde": 0},
                {"id": "r1", "name": "Mars", "speed": -0.12, "retrograde": 1},
            ],
        },
    }]


def test_index_maps_row_field_to_value():
    idx = build_citation_index(_tool_results())
    assert idx["r0.name"] == "Moon"
    assert idx["r0.speed"] == 13.2
    assert idx["r1.retrograde"] == 0 or idx["r1.retrograde"] == 1
    assert "r0.id" not in idx  # id itself is not citable


def test_render_substitutes_cited_values():
    idx = build_citation_index(_tool_results())
    text, unresolved = render_citations(
        "Fastest is {{r0.name}} at {{r0.speed}} deg/day.", idx)
    assert text == "Fastest is Moon at 13.2 deg/day."
    assert unresolved == []


def test_render_flags_unresolved_reference():
    idx = build_citation_index(_tool_results())
    text, unresolved = render_citations("It is {{r9.speed}} today.", idx)
    assert unresolved == ["r9.speed"]      # fabrication caught
    assert "{{r9.speed}}" in text          # token left raw; caller refuses


def test_render_handles_booleans_and_none():
    idx = {"r0.retro": True, "r0.missing": None}
    text, unresolved = render_citations("{{r0.retro}} / {{r0.missing}}", idx)
    assert text == "yes / n/a"
    assert unresolved == []


def test_render_no_tokens_is_unchanged():
    text, unresolved = render_citations("Mars square Saturn, orb 0.9 degrees.", {})
    assert text == "Mars square Saturn, orb 0.9 degrees."
    assert unresolved == []


def test_whitespace_in_token_is_tolerated():
    idx = {"r0.speed": 13.2}
    text, _ = render_citations("{{ r0.speed }}", idx)
    assert text == "13.2"


def test_later_result_wins_on_id_collision():
    results = [
        {"result": {"rows": [{"id": "r0", "name": "First"}]}},
        {"result": {"rows": [{"id": "r0", "name": "Second"}]}},
    ]
    idx = build_citation_index(results)
    assert idx["r0.name"] == "Second"

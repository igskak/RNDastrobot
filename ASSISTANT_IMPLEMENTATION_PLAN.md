<!-- /autoplan restore point: /Users/ihorskakovskyi/.gstack/projects/igorskak-RNDastro/Copilot-autoplan-restore-20260611-161905.md -->
# Astrologer Assistant Chatbot — Implementation Plan

Branch: `Copilot` | Base: `main` | Date: 2026-06-11

## Goal

A chat-based assistant for the **astrologer** (not the client) that answers
computational questions about a chart while they work, with **voice input**
(push-to-talk dictation → text; no TTS). The LLM never does astronomy math —
it translates natural language into structured tool calls; deterministic
Swiss Ephemeris code computes the numbers; the LLM narrates the result.

## Two core capabilities

### Feature 1 — Aspect timeline ("when will transiting Uranus conjunct natal Venus")
Astrologer asks when a transit→natal aspect enters orb, perfects, and leaves;
how many times it perfects (retrograde loops → 1 or 3 exact hits); retrograde
status and station dates through the contact.

- Number of exact crossings is a **physical fact** computed by the ephemeris
  scanner, never guessed by the LLM.
- Two distinct counts kept separate:
  - (a) exact crossings within ONE contact (retrograde triple-pass).
  - (b) number of contacts within a calendar window (relevant for fast bodies).

### Feature 2 — Pattern finder over N life-event dates (purely mathematical)
Astrologer gives N dates; the system computes positions/configurations at each
and returns features common to all / most events (frequency/support ranked).
**No interpretation** — the astrologer interprets. Parameterized by technique
(`transits | progressions | directions | solar | natal_only`); the LLM picks the
technique from the astrologer's wording.

## Window resolution (Feature 1)

Priority ladder, and the assistant always states the window it used:
1. Explicit in the query ("за 2 года", "до 2030", "в этом году") → parse it.
2. Implicit anchor = transit date currently on screen (active chart context).
3. Question "when will / how many" with no period → mode `next_contact`:
   scan forward from anchor, auto-expand until the contact fully resolves,
   capped per transit body (e.g. Uranus ~4y).
4. Genuinely ambiguous → assistant asks ONE clarifying question.

## Architecture

```
Voice/text → STT → OpenAI (function-calling loop) → tools:
   • find_aspect_passes(...)   ← wraps transit_service.find_transit_events
   • find_event_patterns(...)  ← pattern_service (adapters over transit/prog/dir/solar)
   • get_positions_at(...)     ← swisseph_engine
   • get_chart_summary / list_persons  ← persons, natal_chart_service
→ deterministic numbers → LLM narrates → chat
```

Respects AGENTS.md boundaries: routes validate + map; services compute; no
business calc in routes; i18n catalogs for all user-facing strings.

## Reuse map (what already exists)

| Capability | Location | Status |
|---|---|---|
| enter/exact/leave intervals + orbs + cache | `transit_service.find_transit_events()` | reuse |
| exact-moment refine (ternary/bisection) | `transit_service._find_aspect_exact_and_orb()` | reuse |
| single-body longitude / deviation at JD | `transit_service._get_transit_body_longitude / _aspect_deviation_at_jd` | reuse |
| all-planet positions at JD (+ retrograde) | `swisseph_engine.calculate_planets(jd)` | reuse |
| natal aspects / configurations | `aspect_service`, `configuration_service` | reuse (Feature 2) |
| progressions / directions / solar return | `progression_service`, `direction_service`, `solar_return_service` | reuse (Feature 2 adapters) |
| OpenAI client (JSON mode) | `openai_service.py` | extend to tool-calling |

### KNOWN GAP (critical, drove the engine design)
`find_transit_events` collapses a retrograde loop into ONE interval with ONE
`jd_exact` (the min-orb moment). It does **not** count the 3 separate exact
crossings. Feature 1 therefore needs its own per-contact scan that detects each
crossing of the exact angle (local minima of the deviation reaching ~0°),
refines each, and labels motion (direct/retro) + station dates. This reuses the
low-level helpers above; it does not modify the generic transit engine.

## Backend / Frontend components

- Services: `astro_assistant_service.py` (agent loop + tool registry),
  `pattern_service.py`; extend `openai_service` with function-calling.
- Routes: `api/routes/assistant.py` — `POST /assistant/chat` (SSE stream),
  `POST /assistant/transcribe`.
- Models: Pydantic request/response + tool JSON schemas in `app/models`.
- Frontend: chat widget in `chart.html` workspace (`assistant.entry.js`),
  esbuild bundle, i18n catalogs, loading/empty/error states, mic button
  (MediaRecorder → /assistant/transcribe → OpenAI gpt-4o-transcribe).

## PR breakdown (contract → data → logic → UI → tests)

1. **PR1** — `find_aspect_passes` (per-contact crossing scan, grouping, retro +
   station annotation, window auto-expand) + unit tests on a known ephemeris.
   *Standalone value even without the chat.*
2. **PR2** — function-calling in `openai_service`, `astro_assistant_service` with
   one tool, `POST /assistant/chat` (text), active-chart context binding.
3. **PR3** — `pattern_service` (`transits` + `natal_only`) + tool + tests.
4. **PR3.1** — `progressions / directions / solar` adapters.
5. **PR4** — `POST /assistant/transcribe` + mic push-to-talk.
6. **PR5** — UI: streaming, history, states, i18n, workspace placement.

Every PR closes AGENTS.md DoD (`make all`, `pytest`, i18n checkers).

## Decisions already locked (from user)
- Voice = input only (no TTS, no Realtime).
- Pattern finder = all techniques, LLM routes by question.
- Default context = active chart on screen.

## Open questions / risks
- Per-body window caps for `next_contact` auto-expand (need a small table).
- STT cost/latency for long dictation; need a max audio length.
- Pattern finder feature-space design (which discrete features per technique)
  and how "common" is defined (all N vs k-of-N threshold).
- Cost controls for the OpenAI agent loop (max tool iterations, model choice).

---
<!-- AUTONOMOUS DECISION LOG -->
# GSTACK REVIEW REPORT (/autoplan)

Dual voices: **Codex** (multi-lens, repo-grounded) + **independent Claude subagents**.
Greenfield plan, no diff. Codex ran once across all 4 lenses (plan is one page;
4 separate sessions would re-read identical input); Claude subagents ran per phase.

## Consensus tables

### CEO (strategy)
| Dimension | Claude | Codex | Consensus |
|---|---|---|---|
| Right problem (chat vs form)? | NO — form problem | NO — validate workflow first | **DISAGREE w/ plan** |
| Premises validated? | NO (3 unvalidated) | NO | CONFIRMED |
| Scope calibrated? | NO — 5/6 PRs speculative | NO — ship engine+UI first | CONFIRMED |
| Alternatives explored? | NO — form/keyword router dismissed | NO | CONFIRMED |
| Moat correct? | ephemeris correctness, not chat | engine is the value | CONFIRMED |
| 6-month trajectory? | regret: unused agent loop | defer chat/voice/patterns | CONFIRMED |

### ENG (architecture) — most important technical finding
| Dimension | Claude | Codex | Consensus |
|---|---|---|---|
| Crossing detector sound? | (n/a) | **NO — abs-minima ≠ root finding** | CRITICAL (Codex) |
| Opposition/180° wraparound | (n/a) | NO — needs signed branch | CRITICAL |
| Wraps find_transit_events ok? | gap real | NO — contact grouping conflicts | CONFIRMED |
| Refine helper multi-root? | (n/a) | NO — unimodal assumption | HIGH |
| Performance budget? | (n/a) | NO — all bodies every JD | HIGH |
| Security on endpoints? | (n/a) | NO — auth/ensure_client_access | HIGH |
| Cost controls? | open Q = too late | must be requirements | CONFIRMED |

### DESIGN / DX
| Dimension | Consensus |
|---|---|
| Tool schemas = enums/IDs not freeform strings | CONFIRMED |
| Tool contract owns window resolution (not LLM date-parsing) | CONFIRMED |
| Structured result quality (status, boundary_complete, exact_pass_count, closest_approach) | CONFIRMED |
| Widget states underspecified (agent flow ≠ loading/empty/error) | CONFIRMED |
| Push-to-talk failure modes missing; transcript → composer for review, not auto-run | CONFIRMED |
| Window/pass-count must be structured UI, not prose | CONFIRMED |
| Existing AssemblyAI transcription_service — PR4 adds 2nd STT vendor (DRY) | CONFIRMED |

## CRITICAL eng correction (auto-accepted into plan)
The PR1 design I sketched ("local minima of abs-deviation reaching ~0°") is **not a
sound crossing algorithm**. Conjunction deviation is non-negative (minimum, not a sign
change); opposition has a two-branch topology at 180°; a station near the aspect that
never perfects looks like a shallow minimum. **Correct design:** find roots of an
*unwrapped, signed* angular-distance function f(t)=signed_sep(t) − target; minima only
classify "closest approach without perfection". Refine each root independently (the
existing `_find_aspect_exact_and_orb` finds ONE global min — unsuitable). Define
"contact"/"pass"/grouping tolerance explicitly; raise the 45-day boundary cap or emit
`boundary_complete=false` for slow-body long contacts.

## Auto-decided (folded into plan — P1 completeness / P4 DRY / P5 explicit)
| # | Decision | Principle |
|---|---|---|
| 1 | Signed-angle root finder for passes (not abs-minima) | P1/P5 |
| 2 | Tool args = enums/IDs; tool owns window resolution; return requested+effective window | P5 |
| 3 | Result quality flags: status, boundary_complete, window_cap_reached, exact_pass_count, closest_approach, calc_version | P1 |
| 4 | New endpoints: require_auth + ensure_client_access + audio MIME/size limits + rate limit + audit; don't leak exception text | P1 |
| 5 | Cost controls promoted from open-Q to requirements: max tool iterations, model timeout, audio max length | P1 |
| 6 | Reuse existing transcription_service / shared OpenAI client infra; separate assistant service from summary singleton | P4 |
| 7 | Technique (Feature 2) = explicit visible control, echoed in result; never silently LLM-chosen | P5 |
| 8 | Per-body window caps table for next_contact auto-expand | P5 |

## USER CHALLENGE (NOT auto-decided — see gate)
Both models independently recommend changing the stated direction: build the
deterministic aspect-pass **engine + a structured panel** first and ship it; treat the
**chat agent, voice, and pattern-mining as later, validated bets** behind a usage signal.

## NOT in scope (deferred per review)
- Feature 2 pattern-mining beyond a single explicit technique until feature-space +
  baseline-frequency semantics are defined (Codex: "undefined research project").
- Voice/STT until aspect-timeline usage shows demand AND vendor reconciled with AssemblyAI.

## What already exists (reuse, don't rebuild)
transit_service low-level helpers; swisseph_engine; openai_service client;
**transcription_service (AssemblyAI) — already does STT**; aspect/configuration/
progression/direction/solar services for Feature 2 adapters.

---
# RESOLUTION (post-gate, user decisions)

## D1 — Architecture: chat companion over a validated engine (confirmed, reframed)
User clarified the value is **flow, not interface choice**: a chat window docked in
the corner of the chart workspace (mono-wheel AND multi-wheel modes). The astrologer
keeps working with the chart and asks the bot (text or voice) for "astrological data
analysis" — dates of crossings, cusp contacts, patterns — instead of manually hunting
them or switching to a separate query tool. This answers the reviewers' "why chat over
a form": the form would force a context switch away from the chart; the chat does not.

**Resolved build:**
- The deterministic **aspect-pass engine is built first and validated** (it is the
  correctness moat). It exposes a clean structured API.
- The **chat window** (text + voice) sits in the chart workspace over that same API,
  from the start. Chat is the in-flow surface; results render as **structured cards**
  (window used, per-contact passes, motion, stations) inside the chat — not loose prose
  (satisfies the design reviewers' "structured result, not narration" finding).
- All 8 hardening items above are folded in.

## D2 — Feature 2 (pattern finder): full design FIRST
Do NOT build pattern-mining until feature-space, baseline frequencies, event-time
uncertainty, and statistical/multiple-comparison correction are designed and written up.
Produces a design doc (`PATTERN_FINDER_DESIGN.md`) as its own deliverable before any code.
Feature 2 is therefore **out of the near-term build sequence**.

## Revised PR sequence
1. **PR1 — Aspect-pass engine.** Signed/unwrapped angular root-finder (NOT abs-minima):
   - roots of f(t)=signed_sep(t)−target → exact passes; minima w/o root = "closest
     approach, no perfection"; explicit opposition/180° branch handling.
   - explicit definitions: contact / pass / grouping tolerance; per-body window caps;
     `boundary_complete` flag (raise/replace the 45-day cap for slow bodies).
   - result quality fields: status, requested+effective window, window_cap_reached,
     exact_pass_count, closest_approach, calc_version, warnings.
   - per-tool limits: max window, max ephemeris evals, timeout; single-body fast path
     (avoid computing all bodies every JD).
   - unit tests vs known ephemeris (incl. a real retrograde triple-pass + a no-perfection
     near-miss + an opposition).
2. **PR2 — Engine API + structured result.** `POST` endpoint: require_auth +
   ensure_client_access; enum/ID args (body, aspect, technique, person); tool owns window
   resolution; no exception-text leakage. Structured result card renderer.
3. **PR3 — Chat companion (text).** assistant service w/ OpenAI function-calling over the
   PR2 API; cost controls as requirements (max iterations, timeout); SSE; active-chart
   context snapshot (labeled, immune to mid-response chart switch); corner widget w/ full
   agent state model + cancel/retry; separate assistant service from the summary singleton.
4. **PR4 — Voice input.** Push-to-talk → STT. **Reuse existing `transcription_service`
   (AssemblyAI) or explicitly justify OpenAI gpt-4o-transcribe** (don't silently add a 2nd
   vendor). Full mic failure-mode handling; transcript → composer for review, never auto-run.
5. **(Parallel, design-only) Feature 2 design doc** — gated per D2; no code yet.

## Cross-phase theme (flagged by both models in 2+ lenses)
"Trust through structure": deterministic IDs in, structured result-quality out, visible
window/pass disclosure. Recurred in ENG, DESIGN, and DX. High-confidence — treat the
structured result contract (not the narration) as the real interface.

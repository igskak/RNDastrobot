# Steliara Chat v2 → Astrological Data Analyst
## Implementation report against spec v3.0

**For:** the agent who authored the specification
**Date:** 2026-08-04
**Branch:** all work merged to `main`, deployed to production (Render, auto-deploy on merge)
**Scope of this report:** what was built, how it differs from the spec and why, what remains

---

## 0. Summary

Twelve deliveries shipped in one working session, all on production. The test
suite went 483 → 696. The model's tool count went 17 → 22. Migrations 055-057
landed.

Three beta complaints that motivated the rework are closed and verified by live
runs against the real model, not only by tests:

| Complaint | Evidence before | Evidence after |
|---|---|---|
| «нет транзитов плутона» (metric 167) | 4 `find_aspect_passes` calls, all Jupiter | one `survey_transits` call, 18 events incl. Pluto, 5.5s |
| Refusal of an explicitly data-level request (metric 154) | "Я не интерпретирую значение конфигураций" | 1218-token analytical report |
| Dry, list-shaped answers | numbered contact blocks only | prose overview → structure → detail |

**The single most important caveat:** no astrologer has used any of this. The
last beta turn in the database is 2026-07-20. Everything below was verified by me
against one chart. All §26 rates currently have a zero denominator.

---

## 1. What was built, mapped to the spec roadmap §27

| Spec PR | Status | Commit |
|---|---|---|
| PR1 provenance | shipped | `afb82d6c` |
| PR2 transit bulk survey | shipped | `53d2374c` |
| PR3 interval intersections | shipped | `dbf6a6f9` |
| PR4 chart data exposure | shipped | `2bf6f97d` |
| PR5 Pattern Discovery Engine | shipped | `3b866dfc` |
| PR6 orchestration and prompts | shipped (reshaped, see §4.1) | `4364a361` |
| PR7 tables and visualizations | **not started** (deferred by owner) | — |
| PR8 symbolic service exposure | shipped | `22ce7b1a` |
| PR9 symbolic bulk surveys | **not started** | — |
| PR10 solar-return integration | **not started** | — |
| PR11 methodology version history | **not started** | — |
| PR12 workspace timeline | **not started**, audit §23 not run | — |

Beyond the roadmap, from the cross-cutting sections:

| Spec section | Status | Commit |
|---|---|---|
| §13 master system prompt | rewritten to spec | `e99a8bfe` |
| §16 Narrative Analyst | shipped, **enabled in production** | `2e316f62`, `47754e51`, `e5689672`, `87c3e4fd` |
| §20 Interpretation judge | recalibrated | `4364a361` |
| §21 ChartDataset facets + analysis tables | extended (see §4.6) | `90b25118` |
| §22.2 survey persistence | shipped | `e14e2166` |
| §26 metrics | shipped | `c1686b00` |
| §22.1 pending_analysis object | **deferred**, reasons in §5.1 | — |
| §2.4 manual override producer | schema only, **deferred**, §5.2 | — |
| §14 Intent Router, §15 Planner | **not built as stages**, §4.1 | — |
| §17 Visualization Planner, §18 Report Renderer | blocked on PR7 | — |
| §19 Fact-Grounding Validator | deterministic subset only, §4.5 | — |

---

## 2. Architecture as built

```
Browser (chat.js)
  │  POST /assistant/chat { user_id, timezone, anchor_date, workspace,
  │                         conversation_id, messages[] }
  ▼
Route (app/api/routes/assistant.py)
  │  auth · entitlement · chart-access · history merge
  │  release the DB connection BEFORE any model call
  ▼
AstroAssistantService.chat()
  │
  ├─ [deterministic] methodology provenance, then hand the connection back
  ├─ [deterministic] system prompt · locale line · workspace line · continuation
  │
  ├─ ┌─ TOOL LOOP, ≤5 iterations ─────────────────────────────┐
  │  │ model call: 22 tools, tool_choice=auto, 1800 tokens    │
  │  │   tool_calls → server executes → provenance stamped    │
  │  │   no tool_calls → exit with a draft answer             │
  │  └────────────────────────────────────────────────────────┘
  │
  ├─ [model, conditional] §16 Narrative Analyst — only when the turn used an
  │                       analytical tool. No tools, findings only.
  │
  └─ _finalize_reply()
       ├─ [deterministic] wheel-view coercion
       ├─ [deterministic] citation rendering; unresolved analyze cite → refuse
       ├─ [model] §20 judge → ALLOW | BLOCK → one regeneration → re-judge
       └─ [deterministic] unsupported-date grounding check (reports, never blocks)
  ▼
Response + persistence (turn metrics, provenance, quality signals, survey)
```

### 2.1 Model calls per turn

| Stage | Model | Budget | When |
|---|---|---|---|
| Tool loop | `gpt-5.4-mini` | 1800 | every turn, ≤5 iterations |
| Narrative Analyst | `gpt-5.6-luna`, effort `low` | 8000 | only analytical turns |
| Judge | `gpt-5.4-mini` | 4 | every turn (`ASSISTANT_JUDGE_ENABLED=true`) |
| Regeneration | `gpt-5.4-mini` | 1800 | only when the judge blocks |

A simple lookup costs 2 calls and about 2 seconds. A broad analytical turn costs
3 calls and about 29 seconds.

### 2.2 Deterministic stages

Everything not listed above is code: auth and tenancy, history merge, methodology
resolution, continuation detection, workspace context assembly, all 22 tool
executions, the sweep-line, the Pattern Discovery Engine, citation substitution,
date grounding, ranking, and all persistence.

---

## 3. Composition

### 3.1 Query tools (11)

`find_aspect_passes` · `find_chart` · `calculate_progression` ·
`calculate_direction` · `get_chart_data` · `survey_transits` ·
`discover_patterns` · `intersect_forecast_windows` ·
`find_symbolic_aspect_passes` · `survey_symbolic_ingresses` · `analyze`

### 3.2 Command tools (11, client-applied)

`set_transit_date` · `step_date` · `add_layer` · `build_solar` · `set_solar_year` ·
`set_wheel_view` · `set_house_system` · `set_synastry_partner` · `add_client_note` ·
`remove_layer` · `clear_layers`

### 3.3 Chart data facets (9)

`sign_properties` · `dignities` · `speeds` · `houses` · `natal_aspects` ·
`angles_and_points` · `planet_roles` · `house_details` · `configurations`

### 3.4 Analysis layer

Tables (7): `planets` · `natal_aspects` · `houses` · `configurations` ·
`transit_events` · `time_segments` · `pattern_findings`
Operations (5): `count` · `rank` · `extreme` · `aggregate` · `bucket_time`

The three forecast tables are populated from the turn's survey, so they are empty
until one runs — an empty result, never an error.

### 3.5 Profiles (versioned)

Transit bodies: `outer_planets` (Uranus, Neptune, Pluto, Chiron) · `slow_planets` ·
`social_planets` · `personal_planets` · `all_planets`
Natal targets: `broad_default_v1` (10 planets + ASC/DSC/MC/IC + both nodes +
Lilith; Fortune excluded) · `angles_only` · `luminaries_and_angles`
Pattern thresholds: `forecast_patterns_v1` · Ranking: `technical_priority_v1`

### 3.6 Limits

`MAX_TOOL_ITERATIONS=5` · `MAX_COMPLETION_TOKENS=300` (compact stages) ·
`MAX_ANSWER_TOKENS=1800` · `MAX_NARRATIVE_TOKENS=8000` ·
`MAX_SURVEY_EVENTS=400` · `REQUEST_TIMEOUT_S=60` · gunicorn worker timeout 120s

### 3.7 Migrations

`055` methodology provenance · `056` `assistant_surveys` ·
`057` per-turn quality signals

---

## 4. Decisions and compromises, with reasons

### 4.1 The §6 pipeline is logical stages, not six model calls

**Spec:** router → planner → capability check → orchestrator → validator →
pattern engine → narrative → visualization → renderer → grounding → judge.

**Built:** one tool loop, one conditional narrative call, one judge call.

**Reason.** Production data settled it. Guardrail outcomes on the live database
were 38 `ok`, 3 `blocked_citation`, **zero** `blocked` and zero `regenerated`.
The judge has never blocked an interpretation. Yet the beta transcript shows
refusals — which means the model was self-censoring under its own master prompt,
not being stopped by a guardrail. Adding stages would not have touched the cause.
Routing and planning are already performed by tool selection across 22 tools;
a separate router would add latency and a failure mode to something that works.

**What this costs.** No `capability_registry`, so the "return
unsupported_capability" rule of §15 has no formal backing — the model says so in
prose instead.

### 4.2 The transit survey is a hybrid, not an exposure

**Spec §9.2** reads as though the existing bulk backend can be exposed.

**Finding.** `TransitService.find_transit_events` scans a 6-hour grid and reports
`t_exact` as the sampled minimum, not a root. A retrograde loop that perfects
three times collapses into one approximate crossing. It cannot produce the
`passes[]`, `exact_pass_count` or `stations` §9.2 requires.

**Built.** Discovery with `find_transit_events` (fast, cached), then every
discovered triple re-run through `find_aspect_passes` for real root finding.
Externally one tool call. The grid-derived time never leaves the executor, and a
test asserts `t_exact`/`t_enter`/`t_leave` appear nowhere in the payload.

### 4.3 Clustering runs on exact passes, not windows

**Spec §11.3** asks for activity clusters without saying what anchors them.

**Finding.** Clustering on the contact WINDOW chains a two-year outer-planet
survey into a single 14-month "densest period" — technically true, useless in
practice, because Pluto windows run for months and every contact lands within the
14-day gap of the next.

**Built.** Clusters anchor on exact passes, which are point events. Live result
went from 2 mega-clusters to 3 clusters of 1.5–4 months separated by 180- and
138-day gaps. Contacts that never perfect anchor at closest approach so an in-orb
period cannot vanish. Window overlap is a different question, answered by the
sweep-line.

### 4.4 Findings ship with their evidence

**Spec §11.5** gives findings `evidence_ids`, assuming a full-table layer (§9.9)
resolves them.

**Finding, from the first live run.** With PR7 deferred, those ids resolve to
nothing the model can read. Told to report contact detail it had not been given,
the model **invented eight fully-formed enter/exact/leave records with timezone
offsets**. The deterministic date check caught all 14 fabricated dates.

**Built.** `discover_patterns` now returns `supporting_events` — the top 12 by
rank, in full, with the omitted count stated — and the master prompt forbids
detailing a record that was not supplied. Re-run: zero unsupported dates.

### 4.5 Fact-grounding is deterministic and reports rather than blocks

**Spec §19** describes an LLM validator classifying every claim.

**Built.** A regex check on ISO dates asserted in the reply against dates present
in the tool results, restricted to ISO on purpose: if the model writes
`2027-03-20` it is almost certainly copying an engine value, whereas "март 2027"
could be a fair rendering and flagging it would be noise.

**Why it reports rather than blocks.** Blocking before the false-positive rate is
known trades a rare fabrication for a common wrongly-refused answer. This beta
has already been bitten once by a guardrail firing on valid replies
(`blocked_citation`, 3 turns). Migration 057 persists the result so the rate can
be measured first.

### 4.6 Four analysis operations were declined

`overlap` and `cluster` duplicate the sweep-line and the Pattern Discovery
Engine, which answer them with real algorithms; SQL versions would be worse
second answers to the same question. `distribution` is `count` with `group_by`.
`compare` has no single correct semantics in the spec. Table `symbolic_events`
has no source until PR9, and registering an always-empty table would invite the
model to query it and get nothing.

The reasons are recorded in `astro_analysis.py` so they are not re-litigated.

### 4.7 Provenance reports what exists, not what §8.3 names

**Spec §8.3** asks for `rulership_system` and `intercepted_sign_policy`.

**Finding.** Neither setting exists. What is actually stored is
`orbs.profiles.*`, `dignities.signs.*`, `stationary.threshold_percent` and
`balances`.

**Built.** `resolved_settings` reports the real fields: orb profile and source,
stationary threshold, house system, and a count of customized rulership signs.
A `methodology_version` short form was added after a live run showed the model
quoting all 64 characters of the hash at the astrologer.

### 4.8 The narrative model was chosen by measurement

**Spec §7.1** assigns the analytical narrative "the strongest available reasoning
model". My first A/B ran it on `gpt-5.4-mini` to isolate the isolation variable,
which made the conclusion invalid — I said so and re-ran.

Narration stage alone, identical payload:

| Model / effort | Latency | Output |
|---|---|---|
| **luna / low** | **15.2s** | 8021 chars |
| luna / medium | 19.2s | 8939 chars |
| terra / medium | 26.0s | 8331 chars |
| sol / medium | 51.3s | 7536 chars, leaked internal profile ids into prose |

`gpt-5.6-luna` at `low` is both the fastest and the most complete. Tier guessing
from the names would have picked wrong.

**A trap worth recording.** Reasoning tokens bill from the same completion budget
and are emitted BEFORE any content. At the plain 1800 ceiling the narrator spent
all 1800 on reasoning, hit `finish_reason=length` and returned an empty string —
so the stage does not degrade at an insufficient budget, it produces nothing. The
fallback masked this as `narrated=False`. Reasoning stages default to 8000.

### 4.9 Capability without instruction is capability unused

Three times a capability shipped and sat idle until its description was written:
the new facets in PR4, the bulk survey in PR2, and the full aspect formula, whose
data landed in PR2 while the instruction to use it arrived only with §13. Tool
descriptions now name the exact user phrasings that should route to them,
including «на год», and name the tool NOT to loop.

---

## 5. Deferred, with reasons

### 5.1 §22.1 `pending_analysis` with five statuses

`proposed/approved/running/completed/cancelled` describes an asynchronous
pipeline. Analysis runs synchronously inside the turn, so `running` is never
observable. Reopening is already covered twice: the offer text lives in
`assistant_messages` and is merged server-side into history, and surveys persist
with `conversation_id`. Building the object would add state with no reader.

Continuation itself IS implemented, deterministically: an affirmative-only
message plus a prior assistant turn that actually offered something causes the
offer to be quoted back with an instruction to execute it. This closes the
observed failure where the assistant proposed slow-planet transits, the
astrologer said «Давай», and the assistant refused.

### 5.2 §2.4 manual override producer

The `overridable()` schema is in place and already used by `planet_roles.house`
and survey events, so the computed value can never be silently replaced. No
producer exists because two product decisions are open — which fields an
astrologer may override, and whether an override is scoped to a chart or to the
methodology profile — and because it needs UI, which belongs with PR7.

### 5.3 PR7 and its two prompts

Deferred by the owner in favour of answer quality. §17 Visualization Planner and
§18 Report Renderer are blocked on it: both consume table and chart references
that nothing currently produces.

---

## 6. Every prompt in the system

Eight pieces of text reach a model. Five are permanent system prompts, three are
conditional injections.

### 6.1 Master system prompt — `astro_assistant_service._SYSTEM_PROMPT` (13 099 chars)

Spec §13. Sections, in order: role and the no-astronomy rule; workspace command
rules (ours, not in the spec — the spec does not cover workspace mutation);
window selection; faithful pass reporting; **TOOL RULES**; **METHODOLOGY**;
**FULL ASPECT FORMULA**; **ANALYTICAL BEHAVIOR** with the §12.3 poor/good
contrast and the §12.4 allowed phrasings; **RANKING**; **ANSWER SHAPE**
(conditional per §10.2: lookup / single contact / analytical report in eight
sections); **ANTI-HALLUCINATION**; **OUTPUT**. Then `NON_INTERPRETATION_RULES`
and `CITATION_RULE` appended verbatim.

Removed in the rewrite: the "timeline hover format" rules and
`"Start directly with the result; no greeting, preamble, or conclusion"`, which
literally forbade the executive overview §12.2 requires.

### 6.2 Narrative Analyst — `astro_narrative._SYSTEM` (3 748 chars)

Spec §16. Nine-part narrative order; the rule to begin with structure rather than
a list of aspects; report only numbers present in the supplied data; the full
aspect formula; the "no dominant cluster" case; headings in the astrologer's
language; `NON_INTERPRETATION_RULES` appended. Receives findings and records
only, and no tools.

### 6.3 Interpretation judge — `astro_judge._JUDGE_SYSTEM`

Spec §20. Carries `NON_INTERPRETATION_RULES`, ALLOW/BLOCK worked examples, and
the §20 calibration added this session: judge the CLAIM, never the vocabulary,
with an explicit non-block list (analysis, forecast, period, important,
significant, career, money, health) and four ALLOW examples a keyword screen
would wrongly reject. Answers in one word.

### 6.4 Non-interpretation rubric — `astro_boundary.NON_INTERPRETATION_RULES`

Single source, embedded verbatim in three places: master prompt, narrative
prompt, judge prompt. Includes the clause added from earlier beta feedback that
objective ranking and highlighting is NOT interpretation and must not be refused.

### 6.5 Citation rule — `astro_citation.CITATION_RULE`

Quote-by-reference for `analyze()` rows only: `{{r0.speed}}` is substituted
server-side. Numbers from other tools are stated as plain text and are not
citable.

### 6.6 Locale instruction — `_locale_instruction()` (conditional)

Injected when a UI locale is known. Fixes the beta bug where an English UI and an
English question got a Russian reply.

### 6.7 Workspace context line — `_workspace_context_line()` (conditional)

A validated one-line summary of the live workspace, prefixed "context for
grounding commands; do not act unless explicitly asked". Every field is
re-validated against the command vocabularies. Truncated to 5 tight aspects and
6 bodies per layer.

### 6.8 Continuation instruction — `_continuation_instruction()` (conditional)

Injected when the latest user message is a bare affirmative AND a prior assistant
turn made an offer. Quotes the offer back and instructs execution without
re-asking. Detection is a regex, not a model call.

Two further short texts are model-facing: the regeneration nudge in
`_regenerate_without_interpretation` (used only after a judge BLOCK) and the
canned refusal in `_refuse_and_redirect`, which is written text rather than a
prompt.

---

## 7. What remains

**In the roadmap:** PR7 (tables, charts, full-table dataset, CSV — unblocks §17
and §18), PR9 (symbolic bulk surveys; note `direction_service.py:407` applies
`PROGNOSTIC_EXCLUDED_NATAL_TARGETS`, which excludes `BlackMoon`, so a symbolic
survey needs its own profile or Lilith silently disappears against
`broad_default_v1`), PR10 (solar return; `solar_return_service.py` exists and is
not exposed), PR11 (methodology version history), PR12 (workspace timeline, after
the §23 audit which has not been run).

**Cross-cutting:** §22.1 and §2.4 as above; §19 as an LLM validator; the
`capability_registry` of §15.

**Not a development item, and the most important one.** The §26 metrics now
exist and will report `None` for every rate, because every denominator is zero.
No astrologer has sent a turn since 2026-07-20. Twelve deliveries are verified
against one chart by one person. Whether the model actually reaches
`survey_transits` on «на год» in the hands of a real user, whether the narrative
reads as analysis to an astrologer rather than to me, and whether numbers stay
grounded in situations I did not try — none of that is known.

`compute_quality_metrics()` and `recent_ungrounded_turns()` are ready to answer
those questions the moment there is traffic.

---

## 8. Verification method

Tests: 696 passing, 31 skipped. Every delivery also exercised against the live
production database read-only, and the final stages against the real model with a
real API key.

This mattered. Two defects were invisible to tests and appeared only in live
output: the fabricated dates (§4.4) and the empty reasoning narration (§4.8). A
third — the engine returning `selected_not_in_orb` alongside found contacts,
which the model would read as "nothing found" — appeared only when running the
symbolic tool against a real chart.

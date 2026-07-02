# Chat-v2 eval harness

Eval-first: these gate the assistant's guarantees before shipping and double as
the model-selection instrument (swap `OPENAI_ASSISTANT_MODEL` / `OPENAI_JUDGE_MODEL`
and re-run to compare).

## Suites

| Suite | File | Needs a key? | Status |
|-------|------|--------------|--------|
| Analysis-correctness | `test_analysis_correctness.py` | no (deterministic) | ✅ built |
| Interpretation-refusal | `test_interpretation_refusal.py` | yes (live judge) | ✅ built (key-gated) |
| Faithfulness | — | yes (live turn) | ⏳ pending T4 structured citation |
| Provenance | — | partial | ⏳ pending T4 |

## Run

Deterministic (runs anywhere, incl. keyless CI):
```
.venv/bin/python -m pytest app/tests/eval/test_analysis_correctness.py -q
```

Live judge eval — explicit opt-in (costs API money; grades quality, not
correctness, so it never runs in a normal test pass). Grades the judge model from
`model_for("judge")` (env `OPENAI_JUDGE_MODEL`, default gpt-5.4-mini):
```
RUN_LLM_EVALS=1 OPENAI_API_KEY=... .venv/bin/python -m pytest app/tests/eval/test_interpretation_refusal.py -q
```
Zero failures = the Layer-3 boundary holds on the seed + subtle + evocative-but-
factual cases. A failure names the exact reply that leaked or was wrongly blocked;
feed those back into `astro_boundary` (the single source) to tune the rubric.

## Model selection

To compare models for a role, set the env var and re-run the live eval:
```
RUN_LLM_EVALS=1 OPENAI_JUDGE_MODEL=<candidate> OPENAI_API_KEY=... .venv/bin/python -m pytest app/tests/eval -q
```

Known finding (2026-07-02): gpt-5.4-mini with the current judge prompt LEAKS
some subtle interpretations (e.g. "…is a hard aspect that brings tension",
"…points to challenges in relationships"). Tune the judge prompt in
`astro_judge` and/or try a stronger `OPENAI_JUDGE_MODEL`, re-running this eval
until zero leaks before enabling the judge in prod.
Fixtures live in `app/services/astro_boundary.py` (single source shared with the
system prompt and the judge) + `golden_charts.py` (analysis golden data).

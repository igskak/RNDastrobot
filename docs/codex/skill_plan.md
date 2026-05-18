# skill_plan

## Purpose
Convert approved specs into technical plan and executable tasks.

## Inputs
- PRD, Architecture Note, UX spec.
- Current repository constraints and mandatory checks from `AGENTS.md`.

## Outputs
- Tech Spec + task decomposition by streams: frontend, backend, tests.
- Acceptance criteria for each task.

## Procedure
1. Break change into vertical slices deliverable in small PRs.
2. Split tasks into parallel streams: front/back/tests.
3. Add acceptance criteria per task.
4. Mark dependencies and critical path.
5. Add verification commands per task, including i18n used-key checks and full `python -m pytest -q app/tests` when the change can affect runtime behavior.
6. If frontend build outputs change, treat bundle rebuild as part of the task instead of planning manual edits to generated files.
7. Produce ordered implementation queue.

## How To Invoke In Codex App
`Используй docs/codex/skill_plan.md и разложи фичу на задачи (front/back/tests) с acceptance criteria.`

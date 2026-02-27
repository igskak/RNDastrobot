# Feature Workflow (Spec-First + Multi-Agent + Verification)

## 6 Stages
1. PRD
- Define goal, non-goals, user stories, risks, open questions.
- Exit criterion: PRD approved, open questions triaged.

2. Architecture
- Define components, API contract, model changes, migration strategy, security constraints.
- Exit criterion: architecture note approved.

3. UX
- Define flow, loading/empty/error states, i18n keys, a11y expectations.
- Exit criterion: UX spec approved.

4. Tech Spec and Tasks
- Split into small tasks with acceptance criteria.
- Assign streams: frontend, backend, tests.
- Exit criterion: implementation plan approved.

5. Implementation (parallel)
- Run front/back/tests streams in parallel with strict file ownership.
- Exit criterion: mandatory checks from `AGENTS.md` are green.

6. Review and Fix
- Run independent review (`/review` or `codex review`).
- Fix findings and rerun mandatory checks.
- Exit criterion: no unresolved high/medium findings.

## Feature Kickoff Prompt Template
`Новая фича: <название>. Контекст: <проблема/цель>. Ограничения: <срок, API, backward compatibility>. Используй workflow из docs/codex/workflow.md и последовательно пройди этапы PRD -> Architecture -> UX -> TechSpec/Tasks -> Implementation -> /review. На этапе планирования раздели задачи на front/back/tests с acceptance criteria. Реализацию веди маленькими изменениями и после каждого блока запускай mandatory проверки из AGENTS.md.`

## Parallel Work Rules
- Frontend stream owns: `app/frontend/**`, frontend-related Node tests.
- Backend stream owns: `app/api/**`, `app/services/**`, `app/models/**`, `app/database/**`.
- Test stream owns: `app/tests/**` and updates CI wiring.
- Single-writer files (do not edit from two streams simultaneously):
  - `app/models/schemas.py`
  - `app/database/models.py`
  - `app/api/main.py`
  - `.github/workflows/ci.yml`
  - `AGENTS.md`
- If multiple streams need a single-writer file, merge via one integration task at the end.

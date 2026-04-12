# skill_impl

## Purpose
Implement tasks with minimal risk and predictable quality.

## Inputs
- Task list from Tech Spec.
- Current branch state.
- Mandatory checks from `AGENTS.md`.

## Outputs
- Code changes in small reviewable commits/PRs.
- Self-check report with executed commands and results.

## Procedure
1. Reuse existing implementation and patterns whenever possible before creating new code paths.
2. Implement one small task at a time and avoid over-engineering.
3. Keep changes scoped to ownership boundaries.
4. Use `python3` explicitly in commands/scripts when Python invocation is needed.
5. Run relevant checks after each task.
6. Fix failures before moving to next task, then prepare for independent review.

## How To Invoke In Codex App
`Используй docs/codex/skill_impl.md и реализуй задачу: <id/описание>, затем прогони проверки из AGENTS.md.`

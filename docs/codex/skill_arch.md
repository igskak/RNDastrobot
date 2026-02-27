# skill_arch

## Purpose
Produce an Architecture Note from approved PRD.

## Inputs
- PRD.
- Existing module boundaries (`app/api`, `app/services`, `app/database`, `app/frontend`).
- Current DB schema/migrations.

## Outputs
- Architecture Note with: components, API changes, data model, migrations, security considerations.

## Procedure
1. Map affected components and dependencies.
2. Define API contract changes (request/response/errors).
3. Define data model updates and migration plan.
4. Describe failure modes and rollback strategy.
5. Add security checks (auth, validation, secrets, logging).
6. Mark unresolved architecture decisions.

## How To Invoke In Codex App
`Используй docs/codex/skill_arch.md и сделай Architecture Note на основе PRD: <текст/ссылка>.`

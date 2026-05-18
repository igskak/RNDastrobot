# skill_review

## Purpose
Perform strict diff review before merge.

## Inputs
- Final diff/PR.
- Relevant specs (PRD/Architecture/UX/Tech Spec).
- Security and performance expectations.

## Outputs
- Review findings prioritized by severity.
- Required fixes list.
- Merge readiness decision.

## Procedure
1. Validate correctness against acceptance criteria.
2. Check security: validation, auth boundaries, secrets in logs.
3. Check tests: missing coverage, edge cases, regressions, and whether `AGENTS.md` mandatory checks were updated when the workflow changed.
4. Check i18n hygiene: hardcoded strings, unused keys, and whether locale changes stay consistent with existing catalogs.
5. Check performance and operational impact.
6. Check developer experience: readability, maintainability, migration safety, and whether generated artifacts were rebuilt instead of hand-edited.
7. Produce actionable fix list.

## How To Invoke In Codex App
- In chat: `Проведи review этого диффа по docs/codex/skill_review.md`.
- Or use built-in review mode: `/review`.

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
3. Check tests: missing coverage, edge cases, regressions.
4. Check performance and operational impact.
5. Check developer experience: readability, maintainability, migration safety.
6. Produce actionable fix list.

## How To Invoke In Codex App
- In chat: `Проведи review этого диффа по docs/codex/skill_review.md`.
- Or use built-in review mode: `/review`.

---
name: design-ux-launch-scope
description: "The feat/design-ux pre-launch redesign — goal, scope locks, and the plan doc that tracks it"
metadata: 
  node_type: memory
  type: project
  originSessionId: cf768161-cfd6-4046-8756-762827142fdc
---

Pre-launch UX/design polish for steliara.com, on branch `feat/design-ux` (base origin/main = production). Goal: make the product feel finished and pleasant with coherent inner product logic — via **consistency + information architecture, NOT a new aesthetic**. First product launch.

**Scope locks (user-stated):**
- No color/palette changes (one exception: `--text-muted` darkened #9B9289→#7A6F63 for WCAG contrast).
- BUT: **flat visual treatment adopted** (2026-07-13) — solid fills (no gradients), soft neutral shadows (not heavy colored drop-shadows), hairline borders, accent used sparingly. Same palette/fonts, calmer depth. The one deliberate refinement beyond "consistency only."
- No accent-usage rebalancing (audit's "demote gold" deferred).
- No new visual direction — discipline pass on existing navy/gold/parchment + Cormorant/DM Sans.
- Layout variants use real HTML/CSS, not AI mockups (gstack designer has no OpenAI key here anyway).

**Driving input:** external "Steliara Design Audit, July 2026" (PDF). Its system-level fixes (spacing scale, type scale, one app chrome, component standardization) are adopted; some page-level findings adjusted or rejected against domain reality (see [[forecast-new-density-is-a-feature]]).

**Plan + tracking:** `docs/plans/design-system-foundation.md` (passed /plan-design-review 5→8/10). Sequencing decision: scope page-by-page visual changes FIRST, then implement foundation tokens against known real needs. The 4 "big-IA pages" are really 3 distinct ones: marketing landing, account settings, workspace home (clients/charts) + forecast-new (light-touch only). End state: commit everything on feat/design-ux so the partner can deploy to prod (confirm before push).

---
name: forecast-new-density-is-a-feature
description: "forecast-new.html's always-visible wheel+all-data-panels is expert-requested, not a bug — never add progressive disclosure there"
metadata: 
  node_type: memory
  type: project
  originSessionId: cf768161-cfd6-4046-8756-762827142fdc
---

`forecast-new.html` (the single workspace serving both the natal-chart and forecast jobs) shows the chart wheel plus all natal/transit data panels on one screen at once. This is a **deliberate, astrologer-requested design**: experts asked to get the exact data they need by moving their eyes across blocks, with no clicks to reveal it — fast at-a-glance scanning + quick adjustment. The team spent significant time on this page and does not want to lose it.

**Why:** The July 2026 external design audit flagged this as a CRITICAL "wheel drowning in tables → use progressive disclosure" problem. That recommendation is WRONG for this page — the audit assumed a professional wants data on demand; the actual expert users want the opposite.

**How to apply:** Never propose drawers, hide-behind-tabs, overlays, or any click-gated disclosure on forecast-new. The only improvement in scope is *display discipline* on the existing dense layout (grid alignment, spacing rhythm, type scale, glyph legibility) so a glance lands faster — nothing removed or hidden. See [[design-ux-launch-scope]].

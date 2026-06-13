# TODOS

## Port forecast-timeline + forecast-tables into forecast-new as in-page modes

- **What:** Move the period views (`forecast-timeline.html`, `forecast-tables.html`) into forecast-new as in-page tabs/modes, then delete the standalone pages + their entries/CSS/JS (`forecast-timeline.js`, `forecast-timeline-utils.js`, `forecast-timeline-page.js`, `forecast-tables-page.js`) and their `build-frontend-bundles.mjs` entries.
- **Why:** forecast-new's view tabs currently link *out* to these standalone pages (`forecast-new.html:102-103`). They're the last two old pages forecast-new still depends on. This is decision **D1** from `UNIFIED_WORKSPACE_PIVOT_PLAN.md` ("tables/timeline as modes inside forecast-new"), listed as remaining work in `WORKSPACE_PIVOT_HANDOFF.md` §4.3.
- **Pros:** Completes the single-workspace pivot; removes ~4 more JS modules + 2 pages; one nav surface for the astrologer.
- **Cons:** Real feature work, not a deletion — period view (range) ≠ moment view, so the in-page mode needs its own range-picker + render path. Must reach parity before deleting the old pages or the period views are lost.
- **Context:** Period views use `forecast-range-data.js` and the timeline/tables renderers. forecast-new is moment-based today (`renderWheel()` per time point). The handoff notes period ≠ moment is exactly why D1 kept them as separate modes rather than folding into the wheel. Start by reading `forecast-timeline-page.js` / `forecast-tables-page.js` to see the render contract, then add a mode toggle in forecast-new that swaps the main panel.
- **Depends on / blocked by:** Should land after the Chart/Solar/Synastry removal (`OLD_PAGES_CLEANUP_PLAN.md`) so the two cleanups don't tangle. Not blocked otherwise.

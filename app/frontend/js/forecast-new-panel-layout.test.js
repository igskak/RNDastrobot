/**
 * Plain Node assertion tests for forecast-new-panel-layout.js.
 * Run: node app/frontend/js/forecast-new-panel-layout.test.js
 * (Repo has no JS test runner; this is a self-contained script.)
 */
'use strict';
const L = require('./forecast-new-panel-layout.js');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('FAIL:', msg); } }

// --- defaults reproduce current UX ---
const def = L.buildDefaultForecastNewLayout();
ok(def.schema_version === 1, 'schema_version stamped');
ok(def.panels.multi.left.length === 9, 'multi.left has 9 tabs');
ok(def.panels.multi.left.every(t => t.blocks[0].source === 'natal'), 'multi.left all natal');
ok(def.panels.multi.right.every(t => t.blocks[0].source === 'prog'), 'multi.right all prog');
ok(def.panels.single.left.length === 5, 'single.left 5 (planets/aspects/grid/configs/stelliums)');
ok(def.panels.single.right.length === 4, 'single.right 4 (houses/balances/jones/dispositors)');
ok(def.panels.single.right.every(t => t.blocks[0].source === 'natal'), 'single all natal');

// --- normalize is idempotent on the default ---
ok(JSON.stringify(L.normalizeLayout(def)) === JSON.stringify(def), 'normalize(default) === default');

// --- reset only the requested wheel mode ---
const customizedForReset = L.buildBuiltinWorkspaceLayout('compact');
const resetMulti = L.resetModeToDefault(customizedForReset, 'multi');
ok(JSON.stringify(resetMulti.panels.multi) === JSON.stringify(def.panels.multi), 'reset multi restores default multi layout');
ok(JSON.stringify(resetMulti.panels.single) === JSON.stringify(customizedForReset.panels.single), 'reset multi preserves single layout');
const missingProgPlanets = L.normalizeLayout({
  schema_version: 1,
  panels: {
    multi: {
      left: def.panels.multi.left,
      right: def.panels.multi.right.filter(tab => tab.blocks[0].view !== 'planets'),
      corners: { tl: null, tr: null, bl: null, br: null },
    },
    single: def.panels.single,
  },
});
const restoredProgPlanets = L.resetModeToDefault(missingProgPlanets, 'multi');
ok(restoredProgPlanets.panels.multi.right.some(tab =>
  tab.blocks.some(block => block.source === 'prog' && block.view === 'planets')
), 'reset multi restores removed prognostic planets tab');

// --- dedup same blockKey across the whole mode ---
const dup = { schema_version: 1, panels: { multi: { left: [
  { id: 'a', blocks: [{ source: 'natal', view: 'planets' }] },
  { id: 'b', blocks: [{ source: 'natal', view: 'planets' }] },
], right: [] }, single: { left: [], right: [] } } };
ok(L.normalizeLayout(dup).panels.multi.left.length === 1, 'dedup blockKey across mode');

// --- drop unknown view ---
const unk = { schema_version: 1, panels: { multi: { left: [
  { id: 'a', blocks: [{ source: 'natal', view: 'bogus' }, { source: 'natal', view: 'houses' }] },
], right: [] }, single: { left: [], right: [] } } };
const nu = L.normalizeLayout(unk);
ok(nu.panels.multi.left[0].blocks.length === 1 && nu.panels.multi.left[0].blocks[0].view === 'houses', 'drop unknown view');

// --- single forces natal source ---
const sf = { schema_version: 1, panels: { multi: { left: [{ id: 'x', blocks: [{ source: 'natal', view: 'planets' }] }], right: [] },
  single: { left: [{ id: 's', blocks: [{ source: 'prog', view: 'houses' }] }], right: [] } } };
ok(L.normalizeLayout(sf).panels.single.left[0].blocks[0].source === 'natal', 'single forces natal source');

// --- empty mode rebuilt from default; non-empty preserved ---
const empty = { schema_version: 1, panels: { multi: { left: [], right: [] },
  single: { left: [{ id: 's', blocks: [{ source: 'natal', view: 'planets' }] }], right: [] } } };
const ne = L.normalizeLayout(empty);
ok(ne.panels.multi.left.length === 9, 'empty multi mode rebuilt from default');
ok(ne.panels.single.left.length === 1, 'non-empty single preserved');

// --- duplicate tab ids regenerated ---
const dupid = { schema_version: 1, panels: { multi: { left: [
  { id: 'same', blocks: [{ source: 'natal', view: 'planets' }] },
  { id: 'same', blocks: [{ source: 'natal', view: 'houses' }] },
], right: [] }, single: { left: [], right: [] } } };
const ndi = L.normalizeLayout(dupid);
ok(ndi.panels.multi.left[0].id !== ndi.panels.multi.left[1].id, 'duplicate tab ids regenerated');

// --- multi-block tab + custom title preserved ---
const mb = { schema_version: 1, panels: { multi: { left: [
  { id: 't', title: 'Mine', blocks: [
    { source: 'natal', view: 'planets' }, { source: 'natal', view: 'configs' }, { source: 'natal', view: 'balances' },
  ] },
], right: [] }, single: { left: [], right: [] } } };
const nmb = L.normalizeLayout(mb);
ok(nmb.panels.multi.left[0].blocks.length === 3 && nmb.panels.multi.left[0].title === 'Mine', 'multi-block + title preserved');

// --- legacy active-tab migration ---
const mig = L.migrateLegacyActiveTab({ leftTab: 'Aspects', rightTab: 'Houses', singleRightTab: 'Balances' }, def);
ok(mig.multiLeft === def.panels.multi.left.find(t => t.blocks[0].view === 'aspects').id, 'legacy leftTab=Aspects maps to aspects tab');
ok(mig.singleRight === def.panels.single.right.find(t => t.blocks[0].view === 'balances').id, 'legacy singleRightTab=Balances maps');

// --- garbage falls back to default ---
ok(L.normalizeLayout(null).panels.multi.left.length === 9, 'null -> default');
ok(L.normalizeLayout({ foo: 1 }).panels.single.right.length === 4, 'garbage -> default');

// ===================== corners (Option C) =====================

// default carries empty corners on both modes
ok(def.panels.multi.corners && L.cornersEmpty(def.panels.multi.corners), 'default multi corners empty');
ok(def.panels.single.corners && L.cornersEmpty(def.panels.single.corners), 'default single corners empty');

// legacy layout WITHOUT corners normalizes: panels intact + corners all-null
const legacy = { schema_version: 1, panels: {
  multi: { left: [{ id: 'a', blocks: [{ source: 'natal', view: 'planets' }] }], right: [] },
  single: { left: [{ id: 's', blocks: [{ source: 'natal', view: 'houses' }] }], right: [] },
} };
const nl = L.normalizeLayout(legacy);
ok(nl.panels.multi.left.length === 1, 'legacy: panel preserved');
ok(nl.panels.multi.corners && L.cornersEmpty(nl.panels.multi.corners), 'legacy: corners defaulted to all-null');

// corner block accepted and realized
const wc = { schema_version: 1, panels: {
  multi: { left: [{ id: 'a', blocks: [{ source: 'natal', view: 'houses' }] }], right: [],
           corners: { tl: { source: 'natal', view: 'planets' }, tr: null, bl: null, br: null } },
  single: { left: [], right: [] },
} };
const nwc = L.normalizeLayout(wc);
ok(nwc.panels.multi.corners.tl && nwc.panels.multi.corners.tl.view === 'planets', 'corner block kept');

// dedup: a blockKey in BOTH a panel and a corner -> panel wins, corner drops it
const clash = { schema_version: 1, panels: {
  multi: { left: [{ id: 'a', blocks: [{ source: 'natal', view: 'planets' }] }], right: [],
           corners: { tl: { source: 'natal', view: 'planets' }, tr: null, bl: null, br: null } },
  single: { left: [], right: [] },
} };
const ncl = L.normalizeLayout(clash);
ok(ncl.panels.multi.left[0].blocks.length === 1, 'clash: panel keeps planets');
ok(ncl.panels.multi.corners.tl === null, 'clash: corner yields planets to panel');

// dedup across two corners: same block can't sit in tl AND tr
const twoCorners = { schema_version: 1, panels: {
  multi: { left: [], right: [],
           corners: { tl: { source: 'natal', view: 'planets' }, tr: { source: 'natal', view: 'planets' }, bl: null, br: null } },
  single: { left: [], right: [] },
} };
const ntc = L.normalizeLayout(twoCorners);
ok(!!ntc.panels.multi.corners.tl && ntc.panels.multi.corners.tr === null, 'corner dedup: only first keeps the block');

// corner-only mode is NOT wiped by the empty-rebuild fallback
const cornerOnly = { schema_version: 1, panels: {
  multi: { left: [], right: [], corners: { tl: { source: 'natal', view: 'planets' }, tr: null, bl: null, br: null } },
  single: { left: [{ id: 's', blocks: [{ source: 'natal', view: 'houses' }] }], right: [] },
} };
const nco = L.normalizeLayout(cornerOnly);
ok(nco.panels.multi.left.length === 0 && !!nco.panels.multi.corners.tl, 'corner-only mode preserved (not rebuilt from default)');

// single mode forces corner source to natal
const singleCorner = { schema_version: 1, panels: {
  multi: { left: [{ id: 'x', blocks: [{ source: 'natal', view: 'planets' }] }], right: [] },
  single: { left: [], right: [], corners: { tl: { source: 'prog', view: 'houses' }, tr: null, bl: null, br: null } },
} };
const nsc = L.normalizeLayout(singleCorner);
ok(nsc.panels.single.corners.tl.source === 'natal', 'single: corner source forced to natal');

// unknown corner view is dropped
const badCorner = { schema_version: 1, panels: {
  multi: { left: [{ id: 'x', blocks: [{ source: 'natal', view: 'planets' }] }], right: [],
           corners: { tl: { source: 'natal', view: 'bogus' }, tr: null, bl: null, br: null } },
  single: { left: [], right: [] },
} };
ok(L.normalizeLayout(badCorner).panels.multi.corners.tl === null, 'unknown corner view dropped');

// corners survive a normalize round-trip (idempotent)
ok(JSON.stringify(L.normalizeLayout(nwc)) === JSON.stringify(nwc), 'normalize(withCorners) idempotent');
ok(L.CORNER_RECOMMENDED_VIEWS.includes('balances'), 'corner recommendations include balances');
ok(L.CORNER_DISCOURAGED_VIEWS.includes('grid'), 'dense grid is discouraged for corners');
// --- built-in astrologer workspaces are valid and preserve the schema ---
ok(L.BUILTIN_WORKSPACES.length === 5, 'five built-in workspaces');
L.BUILTIN_WORKSPACES.forEach(({ id }) => {
  const workspace = L.buildBuiltinWorkspaceLayout(id);
  ok(workspace.schema_version === 1, `workspace ${id}: schema version`);
  ok(workspace.panels.multi.left.length > 0 && workspace.panels.multi.right.length > 0, `workspace ${id}: usable multi panels`);
  ok(JSON.stringify(L.normalizeLayout(workspace)) === JSON.stringify(workspace), `workspace ${id}: normalized`);
});
const compact = L.buildBuiltinWorkspaceLayout('compact');
ok(compact.panels.multi.left[0].blocks.length === 3, 'compact workspace keeps a concise primary tab');
ok(!L.cornersEmpty(compact.panels.multi.corners), 'compact workspace includes observation widgets');
const unknownWorkspace = L.buildBuiltinWorkspaceLayout('unknown', def);
ok(JSON.stringify(unknownWorkspace) === JSON.stringify(def), 'unknown workspace preserves current layout');

// --- "now" source / lunar block ---
ok(L.isNowView('lunar'), 'lunar is a now-view');
ok(!L.isNowView('planets'), 'planets is not a now-view');
ok(L.isValidView('lunar'), 'lunar is a valid view');
ok(L.BLOCK_TARGET_MAP['now:lunar'], 'now:lunar is DOM-realizable');
ok(L.BLOCK_TARGET_MAP['now:lunar'].containerId === 'nowLunarView', 'now:lunar -> nowLunarView container');
ok(L.BLOCK_TARGET_MAP['now:lunar'].rendererKey === 'now', 'now:lunar owned by now renderer');
ok(!L.BLOCK_TARGET_MAP['natal:lunar'], 'no natal:lunar pairing');
ok(!L.BLOCK_TARGET_MAP['now:planets'], 'no now:planets pairing');
const nowLayout = L.normalizeLayout({
  panels: {
    multi: { left: [{ id: 'a', blocks: [{ source: 'prog', view: 'lunar' }] }], right: [], corners: L.emptyCorners() },
    single: { left: [{ id: 'b', blocks: [{ source: 'prog', view: 'lunar' }] }], right: [], corners: L.emptyCorners() },
  },
});
ok(nowLayout.panels.multi.left[0].blocks[0].source === 'now', 'multi: lunar forced to source now');
ok(nowLayout.panels.single.left[0].blocks[0].source === 'now', 'single: lunar forced to source now (not natal)');
const lunarCorner = L.normalizeLayout({
  panels: {
    multi: { left: [], right: [], corners: { tl: { source: 'now', view: 'lunar' }, tr: null, bl: null, br: null } },
    single: { left: [], right: [], corners: L.emptyCorners() },
  },
});
ok(lunarCorner.panels.multi.corners.tl && lunarCorner.panels.multi.corners.tl.view === 'lunar', 'lunar lives in a corner');
ok(L.CORNER_COMPACT_VIEWS.includes('lunar'), 'lunar offered as a compact corner widget');

// --- "now" hours block ---
ok(L.isNowView('hours'), 'hours is a now-view');
ok(L.BLOCK_TARGET_MAP['now:hours'] && L.BLOCK_TARGET_MAP['now:hours'].rendererKey === 'now', 'now:hours owned by now renderer');
ok(!L.BLOCK_TARGET_MAP['prog:hours'], 'no prog:hours pairing');
ok(L.CORNER_COMPACT_VIEWS.includes('hours'), 'hours offered as a compact corner widget');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

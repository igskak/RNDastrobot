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
ok(def.panels.multi.left.length === 7, 'multi.left has 7 tabs');
ok(def.panels.multi.left.every(t => t.blocks[0].source === 'natal'), 'multi.left all natal');
ok(def.panels.multi.right.every(t => t.blocks[0].source === 'prog'), 'multi.right all prog');
ok(def.panels.single.left.length === 3, 'single.left 3 (planets/aspects/grid)');
ok(def.panels.single.right.length === 4, 'single.right 4 (houses/configs/balances/rulers)');
ok(def.panels.single.right.every(t => t.blocks[0].source === 'natal'), 'single all natal');

// --- normalize is idempotent on the default ---
ok(JSON.stringify(L.normalizeLayout(def)) === JSON.stringify(def), 'normalize(default) === default');

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
ok(ne.panels.multi.left.length === 7, 'empty multi mode rebuilt from default');
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
const mig = L.migrateLegacyActiveTab({ leftTab: 'Aspects', rightTab: 'Houses', singleRightTab: 'Configs' }, def);
ok(mig.multiLeft === def.panels.multi.left.find(t => t.blocks[0].view === 'aspects').id, 'legacy leftTab=Aspects maps to aspects tab');
ok(mig.singleRight === def.panels.single.right.find(t => t.blocks[0].view === 'configs').id, 'legacy singleRightTab=Configs maps');

// --- garbage falls back to default ---
ok(L.normalizeLayout(null).panels.multi.left.length === 7, 'null -> default');
ok(L.normalizeLayout({ foo: 1 }).panels.single.right.length === 4, 'garbage -> default');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

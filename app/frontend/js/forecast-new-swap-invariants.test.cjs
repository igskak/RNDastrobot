/**
 * Source-assertion guards for the swap architecture invariants.
 * These protect the "one selection mutator + auto-exit" design from silent
 * re-divergence (the class of bug that made swap unstable).
 * Run: node app/frontend/js/forecast-new-swap-invariants.test.cjs
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'forecast-new.js'), 'utf8');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.error('FAIL:', msg); } }

function bodyOf(name) {
    // Grab a function body by brace matching from `function name(`.
    const start = source.indexOf(`function ${name}(`);
    if (start === -1) return '';
    // Skip the parameter list first — a default like `(options = {})` would
    // otherwise be mistaken for the body's opening brace.
    let p = source.indexOf('(', start);
    let parens = 0;
    for (; p < source.length; p++) {
        if (source[p] === '(') parens++;
        else if (source[p] === ')') { parens--; if (parens === 0) break; }
    }
    const i = source.indexOf('{', p);
    if (i === -1) return '';
    let depth = 0;
    for (let j = i; j < source.length; j++) {
        if (source[j] === '{') depth++;
        else if (source[j] === '}') { depth--; if (depth === 0) return source.slice(i, j + 1); }
    }
    return '';
}

// ── the three swap primitives exist and are wired ────────────────────────────
ok(/function clearSwapState\(\)/.test(source), 'clearSwapState() exists (state-only swap clear)');
ok(/function renderSwapExitTail\(\)/.test(source), 'renderSwapExitTail() exists (shared render tail)');
ok(/function setSelectedRightLayer\(id\)/.test(source), 'setSelectedRightLayer(id) exists (single selection mutator)');

// ── setSelectedRightLayer enforces auto-exit invariant ───────────────────────
const mutator = bodyOf('setSelectedRightLayer');
ok(mutator.includes('state.swapBaseLayerId') && mutator.includes('id !== state.swapBaseLayerId'),
    'setSelectedRightLayer auto-exits when a non-swap layer is selected');
ok(mutator.includes('clearSwapState()') && mutator.includes('renderSwapExitTail()'),
    'setSelectedRightLayer clears swap state then re-renders on exit');

// ── setSwap reuses the shared tail (single exit path) ────────────────────────
ok(bodyOf('setSwap').includes('renderSwapExitTail()'), 'setSwap renders through the shared swap tail');

// ── interactive selection paths route through the mutator ────────────────────
ok(source.includes('setSelectedRightLayer(button.dataset.rightLayer)'), 'layer-tab click uses the mutator (auto-exit UX)');
ok(source.includes('setSelectedRightLayer(layerId)'), 'result-row click uses the mutator');
ok(source.includes('setSelectedRightLayer(instance.id)'), 'activateLayer uses the mutator');
ok(source.includes('setSelectedRightLayer(fallback.id)'), 'cmdEnsureMomentLayer uses the mutator');

// ── recursion guard: reconcileSwapState stays state-only ─────────────────────
const reconcile = bodyOf('reconcileSwapState');
ok(!reconcile.includes('syncSwapButton(') && !reconcile.includes('renderSwapExitTail('),
    'reconcileSwapState never calls syncSwapButton/renderSwapExitTail (would recurse via syncSwapButton)');

// ── the wrong-name bug is fixed: panel titles come from panelRoles(), and the
// identity behind them is a pure module that cannot reach global scratch ──────
ok(!source.includes('function selectedPanelTitle('),
    'the old divergent selectedPanelTitle (read global state.synastryManual) is gone');
ok(bodyOf('panelRoles').includes('computePanelRoles') && bodyOf('panelRoles').includes('layerCardIdentity('),
    'panelRoles() is the single source of which card sits in which panel');
ok(bodyOf('renderRightPanel').includes('panelRoles().right.title'),
    'right panel title comes from the panel roles');
ok(bodyOf('updateNatalMomentMeta').includes('panelRoles().left'),
    'left panel header comes from the panel roles');
ok(!bodyOf('layerCardIdentity').includes('synastryManual')
    && !bodyOf('natalCardIdentity').includes('synastryManual'),
    'identity bindings never read global state.synastryManual');
ok(bodyOf('layerCardIdentity').includes('inst?.config || {}'),
    'layer identity reads the per-instance config (never the global scratch config)');

// ── swap lifecycle: ephemeral but undo/redo-consistent ──────────────────────
ok(bodyOf('cmdSnapshot').includes('swapBaseLayerId: state.swapBaseLayerId'),
    'cmdSnapshot captures swapBaseLayerId (undo/redo reproduces swap)');
ok(bodyOf('cmdRestoreWorkspace').includes('state.swapBaseLayerId = snapshot.swapBaseLayerId'),
    'cmdRestoreWorkspace restores swap and pins selection to the invariant');
ok(bodyOf('applyDeepLinkParams').includes('state.swapBaseLayerId = null'),
    'deep-link entry starts without swap (ephemeral)');
ok(bodyOf('applySavedChartToNatal').includes('clearSwapState()'),
    'replacing the natal chart exits swap');
ok(!bodyOf('setWheelView').includes('clearSwapState()'),
    'switching between multi and single wheel preserves the active swap');
ok(bodyOf('areSwapPanelControlsCrossed').includes('isSwapDemotedNatalSelected()')
    && !bodyOf('areSwapPanelControlsCrossed').includes("state.wheelView !== 'single'"),
    'single-wheel swap keeps the promoted chart controls crossed into the visible left panel');
ok(bodyOf('renderSingleNatalRightPanel').includes('if (promoted) renderOrUpdateTimeStepper()'),
    'single-wheel swap renders the promoted chart date in its visible stepper');
ok(bodyOf('reconcileSwapState').includes('return true') && bodyOf('reconcileSwapState').includes('return false'),
    'reconcileSwapState reports whether it cleared swap (caller rebuilds base)');

// ── stepper responsiveness: a solar/synastry step loads ONLY its own layer ───
// A full loadActiveLayers() would trip the hasCompletePreviousLayers branch while
// swapped (the promoted layer's cache is deliberately kept), freezing the wheel
// until every layer settles — the "slow left stepper in swap" report.
ok(/function momentChangeAffectsOnlySelectedLayer\(\)/.test(source),
    'momentChangeAffectsOnlySelectedLayer() names the single-layer condition');
ok(bodyOf('loadSelectedMomentLayer').includes("'solar_return'"),
    'solar is single-loadable (no full reload of every layer per step)');
ok(bodyOf('stepTargetDatetime').includes('selectedOnly: momentChangeAffectsOnlySelectedLayer()'),
    'stepper arrows load only the selected layer for solar/synastry');

// ── only the whitelisted call sites assign selectedRightLayerId directly ─────
// (single `=`, excluding `===` comparisons). Everything interactive goes via the
// mutator; the rest are init/restore/mutator internals.
const directAssigns = (source.match(/state\.selectedRightLayerId = [^=]/g) || []).length;
ok(directAssigns <= 9, `direct selectedRightLayerId assignments stay whitelisted (found ${directAssigns}, expected <= 9)`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

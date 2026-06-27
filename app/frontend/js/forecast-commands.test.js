/**
 * Plain Node assertion tests for forecast-commands.js.
 * Run: node app/frontend/js/forecast-commands.test.js
 * (Repo has no JS test runner; this is a self-contained script.)
 */
'use strict';
const K = require('./forecast-commands.js');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('FAIL:', msg); } }

// A mock workspace adapter: records dispatched actions and serves a describeState
// snapshot, so apply/undo/inverse can be verified without a browser.
function makeAdapter(initial) {
    const st = Object.assign({
        date: '2026-06-27', time: '12:00:00', datetime: '2026-06-27T12:00:00',
        solarYear: 2026, wheelView: 'multi', houseSystem: 'P',
        activeLayers: [{ id: 'transit-1', method: 'transit' }], selectedLayerId: 'transit-1',
        snapshot: { token: 'snap@2026-06-27' },
    }, initial || {});
    const calls = [];
    return {
        st, calls,
        describeState() {
            return {
                date: st.date, time: st.time, datetime: st.datetime,
                solarYear: st.solarYear, wheelView: st.wheelView, houseSystem: st.houseSystem,
                activeLayers: st.activeLayers.map((l) => ({ id: l.id, method: l.method })),
                selectedLayerId: st.selectedLayerId,
                snapshot: st.snapshot,
            };
        },
        async dispatch(action) {
            calls.push(action);
            // Mutate the fake state just enough to make undo observable.
            if (action.name === 'set_wheel_view') st.wheelView = action.args.view;
            if (action.name === 'set_house_system') st.houseSystem = action.args.system;
            if (action.name === 'set_solar_year') st.solarYear = action.args.year;
            if (action.name === 'set_transit_date') { st.date = action.args.date; if (action.args.time) st.time = action.args.time; }
            if (action.name === 'restore_workspace') st.restoredWith = action.args.snapshot;
            return { ok: true, label: action.name };
        },
    };
}

(async function run() {
    const { validateAction, computeInverse, REGISTRY, VOCAB, createForecastCommands } = K;

    // ── validation: rejections ──────────────────────────────────────────────
    ok(!validateAction({ name: 'nope' }).ok, 'unknown command rejected');
    ok(validateAction({ name: 'nope' }).error.code === 'unknown_command', 'unknown command code');
    ok(!validateAction({ name: 'restore_workspace', args: {} }).ok, 'internal command not directly applicable');
    ok(!validateAction({ name: 'set_transit_date', args: { date: '27-06-2026' } }).ok, 'bad date format rejected');
    ok(!validateAction({ name: 'set_transit_date', args: { date: '2026-06-27', time: '25:00' } }).ok, 'bad time rejected');
    ok(!validateAction({ name: 'add_layer', args: { method: 'lunar' } }).ok, 'bad layer method rejected');
    ok(!validateAction({ name: 'set_wheel_view', args: { view: 'triple' } }).ok, 'bad wheel view rejected');
    ok(!validateAction({ name: 'set_house_system', args: { system: 'Z' } }).ok, 'bad house system rejected');
    ok(!validateAction({ name: 'set_solar_year', args: { year: 1700 } }).ok, 'solar year below range rejected');
    ok(!validateAction({ name: 'set_solar_year', args: { year: 2200 } }).ok, 'solar year above range rejected');
    ok(!validateAction({ name: 'step_date', args: { unit: 'fortnight', amount: 1, direction: 'forward' } }).ok, 'bad step unit rejected');
    ok(!validateAction({ name: 'step_date', args: { unit: 'day', amount: 0, direction: 'forward' } }).ok, 'zero step amount rejected');
    ok(!validateAction({ name: 'step_date', args: { unit: 'day', amount: 2, direction: 'sideways' } }).ok, 'bad step direction rejected');
    ok(!validateAction({ name: 'remove_layer', args: {} }).ok, 'remove_layer without target rejected');

    // ── validation: acceptances ─────────────────────────────────────────────
    ok(validateAction({ name: 'set_transit_date', args: { date: '2026-03-14' } }).ok, 'valid transit date accepted');
    ok(validateAction({ name: 'set_transit_date', args: { date: '2026-03-14', time: '08:30' } }).ok, 'valid transit date+time accepted');
    ok(validateAction({ name: 'step_date', args: { unit: 'week', amount: 2, direction: 'backward' } }).ok, 'valid step accepted');
    ok(validateAction({ name: 'add_layer', args: { method: 'progression' } }).ok, 'valid add_layer accepted');
    ok(validateAction({ name: 'build_solar', args: { year: 2027 } }).ok, 'valid build_solar accepted');
    ok(validateAction({ name: 'set_house_system', args: { system: 'C' } }).ok, 'valid house system accepted');
    ok(validateAction({ name: 'remove_layer', args: { method: 'transit' } }).ok, 'remove_layer by method accepted');
    ok(validateAction({ name: 'remove_layer', args: { layer_id: 'transit-2' } }).ok, 'remove_layer by id accepted');

    // ── registry / confirm policy ────────────────────────────────────────────
    ok(REGISTRY.set_transit_date.confirm === 'auto', 'transit date auto-applies');
    ok(REGISTRY.remove_layer.confirm === 'confirm', 'remove_layer needs confirm');
    ok(REGISTRY.clear_layers.confirm === 'confirm', 'clear_layers needs confirm');
    ok(REGISTRY.restore_workspace.internal === true, 'restore_workspace is internal');
    ok(VOCAB.LAYER_METHODS.length === 5 && VOCAB.LAYER_METHODS[3] === 'solar_return', 'layer vocab matches LAYER_ORDER');

    // ── inverse computation (pure) ───────────────────────────────────────────
    const before = makeAdapter().describeState();
    const invView = computeInverse({ name: 'set_wheel_view', args: { view: 'single' } }, before);
    ok(invView.name === 'set_wheel_view' && invView.args.view === 'multi', 'wheel view inverse restores prior view');
    const invYear = computeInverse({ name: 'set_solar_year', args: { year: 2030 } }, before);
    ok(invYear.name === 'restore_workspace' && invYear.args.snapshot === before.snapshot, 'solar year inverse restores snapshot');
    const invDate = computeInverse({ name: 'set_transit_date', args: { date: '2030-01-01', layer_id: 'transit-1' } }, before);
    ok(invDate.name === 'set_transit_date' && invDate.args.date === '2026-06-27' && invDate.args.layer_id === 'transit-1', 'transit date inverse restores prior moment + layer');
    const invAdd = computeInverse({ name: 'add_layer', args: { method: 'direction' } }, before);
    ok(invAdd.name === 'restore_workspace', 'add_layer inverse is a workspace restore');
    const invHouse = computeInverse({ name: 'set_house_system', args: { system: 'K' } }, before);
    ok(invHouse.name === 'set_house_system' && invHouse.args.system === 'P', 'house system inverse restores prior system');

    // ── apply: invalid action does not reach the adapter ─────────────────────
    {
        const a = makeAdapter();
        const cmds = createForecastCommands(a);
        const r = await cmds.apply({ name: 'add_layer', args: { method: 'bogus' } });
        ok(!r.ok && r.error.code === 'bad_method', 'apply rejects invalid action');
        ok(a.calls.length === 0, 'invalid action never dispatched');
        ok(!cmds.canUndo(), 'no undo entry after rejected apply');
    }

    // ── apply: scalar command, then undo restores prior value ────────────────
    {
        const a = makeAdapter();
        const cmds = createForecastCommands(a);
        const r = await cmds.apply({ name: 'set_wheel_view', args: { view: 'single' } });
        ok(r.ok && r.undoable, 'set_wheel_view applied + undoable');
        ok(a.st.wheelView === 'single', 'adapter state advanced to single');
        ok(cmds.canUndo() && cmds.undoDepth() === 1, 'undo stack has the inverse');
        const u = await cmds.undo();
        ok(u.ok && a.st.wheelView === 'multi', 'undo restored multi');
        ok(!cmds.canUndo(), 'undo stack drained');
    }

    // ── apply: structural command pushes a workspace-restore inverse ─────────
    {
        const a = makeAdapter();
        const cmds = createForecastCommands(a);
        const r = await cmds.apply({ name: 'add_layer', args: { method: 'progression' } });
        ok(r.ok, 'add_layer applied');
        const u = await cmds.undo();
        ok(u.ok && u.inverse.name === 'restore_workspace', 'add_layer undo dispatched restore_workspace');
        ok(a.st.restoredWith && a.st.restoredWith.token === 'snap@2026-06-27', 'restore used the pre-change snapshot');
    }

    // ── apply: onApplied UI hook fires but cannot break apply ────────────────
    {
        const a = makeAdapter();
        let seen = null;
        const cmds = createForecastCommands(a, { onApplied: (x) => { seen = x; throw new Error('UI boom'); } });
        const r = await cmds.apply({ name: 'set_house_system', args: { system: 'K' } });
        ok(r.ok, 'apply succeeds despite throwing UI hook');
        ok(seen && seen.name === 'set_house_system' && seen.confirm === 'auto', 'onApplied received the applied action');
    }

    // ── undo with empty stack ────────────────────────────────────────────────
    {
        const cmds = createForecastCommands(makeAdapter());
        const u = await cmds.undo();
        ok(!u.ok && u.error.code === 'nothing_to_undo', 'undo on empty stack reports nothing_to_undo');
    }

    console.log(`\nforecast-commands.test.js: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})();

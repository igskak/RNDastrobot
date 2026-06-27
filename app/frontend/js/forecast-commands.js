/**
 * Forecast workspace command toolkit (PR1 of ASSISTANT_ACTIONS_IMPLEMENTATION_PLAN.md).
 *
 * Pure, DOM-free core for "actions": validation, the action registry (confirm
 * policy + reversibility), inverse computation, and the undo stack. It owns NO
 * workspace knowledge — every mutation is delegated to an injected `adapter`
 * (provided by forecast-new.js, which wraps the real imperative functions).
 *
 * This split keeps the agent-facing contract testable without a browser: the
 * same vocabularies validate the LLM's intent (PR2) and the client's apply.
 * The LLM never mutates state — it emits a validated intent; the client applies.
 *
 * UMD: `require()` in node tests → ForecastCommandsKit; `window.ForecastCommandsKit`
 * in the esbuild bundle. forecast-new.js builds the live `window.ForecastCommands`.
 */
(function (root) {
    'use strict';

    // ── Deterministic vocabularies ──────────────────────────────────────────
    // Single source for command validation. Mirror forecast-new.js constants
    // (LAYER_ORDER, HOUSE_SYSTEM_CODES single-letter keys, CUSTOM_STEP_UNITS) so
    // the agent and the client reject the same inputs. Drift here is a bug.
    const LAYER_METHODS = ['transit', 'progression', 'direction', 'solar_return', 'synastry_partner'];
    const WHEEL_VIEWS = ['multi', 'single'];
    const HOUSE_SYSTEMS = ['P', 'K', 'O', 'R', 'C', 'E', 'W', 'X', 'H', 'T', 'B', 'M'];
    const STEP_UNITS = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year'];
    const STEP_DIRECTIONS = ['forward', 'backward'];
    const SOLAR_YEAR_MIN = 1900;
    const SOLAR_YEAR_MAX = 2100;
    const STEP_AMOUNT_MAX = 9999;

    const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
    const TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

    function isValidDate(value) {
        const m = DATE_RE.exec(String(value || ''));
        if (!m) return false;
        const year = +m[1], month = +m[2], day = +m[3];
        if (month < 1 || month > 12 || day < 1 || day > 31) return false;
        // Reject impossible days (e.g. Feb 30) via a round-trip through Date.
        const probe = new Date(Date.UTC(year, month - 1, day));
        return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
    }

    function isValidTime(value) {
        const m = TIME_RE.exec(String(value || ''));
        if (!m) return false;
        const hh = +m[1], mm = +m[2], ss = m[3] != null ? +m[3] : 0;
        return hh <= 23 && mm <= 59 && ss <= 59;
    }

    // ── Registry: per-command confirm policy + reversibility ────────────────
    // confirm:'auto'  → client applies immediately (toast + undo).
    // confirm:'confirm' → client renders a confirm chip; nothing mutates until tapped.
    // internal:true   → never exposed to the LLM (PR2); used only as an undo inverse.
    const REGISTRY = {
        set_transit_date:  { confirm: 'auto', reversible: true },
        step_date:         { confirm: 'auto', reversible: true },
        add_layer:         { confirm: 'auto', reversible: true },
        build_solar:       { confirm: 'auto', reversible: true },
        set_solar_year:    { confirm: 'auto', reversible: true },
        set_wheel_view:    { confirm: 'auto', reversible: true },
        set_house_system:  { confirm: 'auto', reversible: true },
        remove_layer:      { confirm: 'confirm', reversible: true },
        clear_layers:      { confirm: 'confirm', reversible: true },
        restore_workspace: { confirm: 'auto', reversible: false, internal: true },
    };

    const VOCAB = {
        LAYER_METHODS, WHEEL_VIEWS, HOUSE_SYSTEMS, STEP_UNITS, STEP_DIRECTIONS,
        SOLAR_YEAR_MIN, SOLAR_YEAR_MAX, STEP_AMOUNT_MAX,
    };

    function fail(code, message) {
        return { ok: false, error: { code, message: message || code } };
    }
    function pass(extra) {
        return Object.assign({ ok: true }, extra || {});
    }

    function isInteger(value) {
        return typeof value === 'number' ? Number.isInteger(value) : /^-?\d+$/.test(String(value));
    }

    // ── Validation (pure) ───────────────────────────────────────────────────
    function validateAction(action) {
        if (!action || typeof action !== 'object') return fail('invalid_action', 'action must be an object');
        const name = action.name;
        const args = action.args || {};
        const meta = REGISTRY[name];
        if (!meta) return fail('unknown_command', 'unknown command: ' + name);
        if (meta.internal) return fail('internal_command', 'command is internal: ' + name);

        switch (name) {
            case 'set_transit_date': {
                if (!isValidDate(args.date)) return fail('bad_date', 'date must be a valid YYYY-MM-DD');
                if (args.time != null && !isValidTime(args.time)) return fail('bad_time', 'time must be a valid HH:mm[:ss]');
                return pass();
            }
            case 'step_date': {
                if (!STEP_UNITS.includes(args.unit)) return fail('bad_unit', 'unit must be one of: ' + STEP_UNITS.join(', '));
                if (!STEP_DIRECTIONS.includes(args.direction)) return fail('bad_direction', "direction must be 'forward' or 'backward'");
                const amount = Number(args.amount);
                if (!isInteger(args.amount) || amount < 1 || amount > STEP_AMOUNT_MAX) {
                    return fail('bad_amount', 'amount must be an integer 1..' + STEP_AMOUNT_MAX);
                }
                return pass();
            }
            case 'add_layer': {
                if (!LAYER_METHODS.includes(args.method)) return fail('bad_method', 'method must be one of: ' + LAYER_METHODS.join(', '));
                return pass();
            }
            case 'build_solar':
            case 'set_solar_year': {
                const year = Number(args.year);
                if (!isInteger(args.year) || year < SOLAR_YEAR_MIN || year > SOLAR_YEAR_MAX) {
                    return fail('bad_year', 'year must be an integer ' + SOLAR_YEAR_MIN + '..' + SOLAR_YEAR_MAX);
                }
                return pass();
            }
            case 'set_wheel_view': {
                if (!WHEEL_VIEWS.includes(args.view)) return fail('bad_view', "view must be 'multi' or 'single'");
                return pass();
            }
            case 'set_house_system': {
                if (!HOUSE_SYSTEMS.includes(args.system)) return fail('bad_house_system', 'system must be one of: ' + HOUSE_SYSTEMS.join(', '));
                return pass();
            }
            case 'remove_layer': {
                if (!args.layer_id && !LAYER_METHODS.includes(args.method)) {
                    return fail('bad_target', 'remove_layer needs layer_id or a valid method');
                }
                return pass();
            }
            case 'clear_layers':
                return pass();
            default:
                return fail('unknown_command', 'unknown command: ' + name);
        }
    }

    // ── Inverse computation (pure) ──────────────────────────────────────────
    // Scalar commands restore the prior value surgically (cheap, no refetch
    // storm). Structural commands (layer set / solar) restore a workspace
    // snapshot captured before the change — robust against multi-instance edits.
    function computeInverse(action, before) {
        if (!before) return null;
        const name = action.name;
        const args = action.args || {};
        switch (name) {
            case 'set_transit_date':
            case 'step_date': {
                if (before.date == null) return null;
                const a = { date: before.date, time: before.time };
                if (args.layer_id) a.layer_id = args.layer_id;
                return { name: 'set_transit_date', args: a };
            }
            case 'set_wheel_view':
                return { name: 'set_wheel_view', args: { view: before.wheelView } };
            case 'set_house_system':
                return { name: 'set_house_system', args: { system: before.houseSystem } };
            case 'set_solar_year':
            case 'build_solar':
            case 'add_layer':
            case 'remove_layer':
            case 'clear_layers':
                if (!before.snapshot) return null;
                return { name: 'restore_workspace', args: { snapshot: before.snapshot } };
            default:
                return null;
        }
    }

    // ── Live command runner (wired to a workspace adapter) ───────────────────
    // adapter = { describeState(): stateSnapshot, dispatch(action): {ok,...} }.
    function createForecastCommands(adapter, options) {
        const opts = options || {};
        const maxUndo = opts.maxUndo || 25;
        const onApplied = typeof opts.onApplied === 'function' ? opts.onApplied : null;
        const undoStack = [];

        async function apply(action) {
            const valid = validateAction(action);
            if (!valid.ok) return valid;

            const meta = REGISTRY[action.name];
            let before = null;
            if (meta.reversible) {
                try { before = adapter.describeState(); } catch (_) { before = null; }
            }

            let result;
            try {
                result = await adapter.dispatch(action);
            } catch (e) {
                return fail('apply_failed', (e && e.message) ? e.message : String(e));
            }
            if (!result || result.ok === false) {
                return result || fail('apply_failed', 'command did not apply');
            }

            let undoable = false;
            if (meta.reversible && before) {
                const inverse = computeInverse(action, before);
                if (inverse) {
                    undoStack.push(inverse);
                    while (undoStack.length > maxUndo) undoStack.shift();
                    undoable = true;
                }
            }

            const applied = {
                ok: true,
                name: action.name,
                args: action.args || {},
                confirm: meta.confirm,
                undoable,
                result,
            };
            if (onApplied) { try { onApplied(applied); } catch (_) { /* UI hook must not break apply */ } }
            return applied;
        }

        async function undo() {
            const inverse = undoStack.pop();
            if (!inverse) return fail('nothing_to_undo', 'nothing to undo');
            try {
                const result = await adapter.dispatch(inverse);
                return pass({ undone: true, inverse, result });
            } catch (e) {
                return fail('undo_failed', (e && e.message) ? e.message : String(e));
            }
        }

        return {
            apply,
            undo,
            canUndo: function () { return undoStack.length > 0; },
            undoDepth: function () { return undoStack.length; },
            describeState: function () { return adapter.describeState(); },
            validateAction,
            policyFor: function (name) { return REGISTRY[name] || null; },
            registry: REGISTRY,
            vocab: VOCAB,
            _computeInverse: computeInverse,
        };
    }

    const api = {
        createForecastCommands,
        validateAction,
        computeInverse,
        REGISTRY,
        VOCAB,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof root !== 'undefined' && root) {
        root.ForecastCommandsKit = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../frontend/js/onboarding.js'), 'utf8');

function createStorage() {
    const values = new Map();
    return {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); },
    };
}

function createHarness({ enabled = true, launchedAt = '2026-07-01T00:00:00Z', preferences, failLoad = false } = {}) {
    const listeners = new Map();
    const events = [];
    const patches = [];
    const document = {
        addEventListener(type, handler) {
            const bucket = listeners.get(type) || [];
            bucket.push(handler);
            listeners.set(type, bucket);
        },
        dispatchEvent(event) {
            for (const handler of listeners.get(event.type) || []) handler(event);
            return true;
        },
    };
    class CustomEvent {
        constructor(type, options = {}) {
            this.type = type;
            this.detail = options.detail;
        }
    }
    const initial = preferences || {
        onboarding: {
            version: 1,
            status: 'not_started',
            completed_steps: [],
            started_at: null,
            dismissed_at: null,
            completed_at: null,
        },
    };
    const window = {
        document,
        CustomEvent,
        console: { ...console, warn() {} },
        sessionStorage: createStorage(),
        __RUNTIME_CONFIG__: {
            onboardingV1Enabled: enabled,
            onboardingV1LaunchedAt: launchedAt,
        },
        AstroAnalytics: { track(name, props) { events.push({ name, props }); } },
        AstroAPI: {
            async getAccountPreferences() {
                if (failLoad) throw new Error('offline');
                return initial;
            },
            async patchAccountPreferences(payload) {
                patches.push(payload);
                return { ...initial, onboarding: payload.onboarding };
            },
            getCachedAstrologer() { return null; },
        },
    };
    window.window = window;
    window.globalThis = window;
    const context = vm.createContext(window);
    vm.runInContext(source, context);
    return { onboarding: context.AstroOnboarding, document, events, patches };
}

test('eligibility is limited to enabled trial/pro accounts', async () => {
    const disabled = createHarness({ enabled: false });
    let state = await disabled.onboarding.init({
        astrologer: { id: 'a', plan_code: 'trial', created_at: '2026-07-10T00:00:00Z' },
        charts: [],
        surface: 'clients',
    });
    assert.equal(state.eligible, false);

    const standard = createHarness();
    state = await standard.onboarding.init({
        astrologer: { id: 'b', plan_code: 'standard', created_at: '2026-07-10T00:00:00Z' },
        charts: [],
        surface: 'clients',
    });
    assert.equal(state.eligible, false);

    const trial = createHarness();
    state = await trial.onboarding.init({
        astrologer: { id: 'c', plan_code: 'trial', created_at: '2026-07-10T00:00:00Z' },
        charts: [],
        surface: 'clients',
    });
    assert.equal(state.eligible, true);
});

test('existing pre-launch accounts with charts are not interrupted', async () => {
    const harness = createHarness();
    const state = await harness.onboarding.init({
        astrologer: { id: 'a', plan_code: 'pro', created_at: '2026-06-01T00:00:00Z' },
        charts: [{ user_id: 'chart-1' }],
        surface: 'clients',
    });
    assert.equal(state.eligible, false);
    assert.deepEqual(Array.from(state.completed_steps), []);
});

test('new account with a chart resumes at the forecast step', async () => {
    const harness = createHarness();
    const state = await harness.onboarding.init({
        astrologer: { id: 'a', plan_code: 'pro', created_at: '2026-07-10T00:00:00Z' },
        charts: [{ user_id: 'chart-1' }],
        surface: 'forecast',
    });
    assert.equal(state.status, 'active');
    assert.deepEqual(Array.from(state.completed_steps), ['profile_chart']);
    assert.equal(harness.patches.length, 2); // start + completed step
});

test('step completion is idempotent and completes after a successful assistant answer', async () => {
    const harness = createHarness();
    await harness.onboarding.init({
        astrologer: { id: 'a', plan_code: 'trial', created_at: '2026-07-10T00:00:00Z' },
        charts: [],
        surface: 'clients',
    });
    await harness.onboarding.completeStep('profile_chart', 'chart_created');
    await harness.onboarding.completeStep('profile_chart', 'duplicate');
    await harness.onboarding.completeStep('forecast_ready', 'transit_render');
    await harness.onboarding.completeStep('assistant_answer', 'assistant_response');

    const state = harness.onboarding.getState();
    assert.equal(state.status, 'completed');
    assert.deepEqual(Array.from(state.completed_steps), ['profile_chart', 'forecast_ready', 'assistant_answer']);
    assert.equal(harness.events.filter((event) => event.name === 'onboarding_step_completed').length, 3);
    assert.equal(harness.events.filter((event) => event.name === 'onboarding_completed').length, 1);
});

test('preference load failure hides onboarding without breaking initialization', async () => {
    const harness = createHarness({ failLoad: true });
    const state = await harness.onboarding.init({
        astrologer: { id: 'a', plan_code: 'trial', created_at: '2026-07-10T00:00:00Z' },
        charts: [],
        surface: 'clients',
    });
    assert.equal(state.initialized, true);
    assert.equal(state.eligible, false);
});

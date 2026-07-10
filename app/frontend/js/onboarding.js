(function (root) {
    'use strict';

    const VERSION = 1;
    const STEPS = ['profile_chart', 'forecast_ready', 'assistant_answer'];
    const ELIGIBLE_PLANS = new Set(['trial', 'pro']);
    const TERMINAL_STATUSES = new Set(['dismissed', 'completed']);
    const CHANGE_EVENT = 'steliara:onboarding-state-changed';
    const SESSION_PREFIX = 'steliara.onboarding.pending';
    const SHOWN_PREFIX = 'steliara.onboarding.shown';

    let context = null;
    let state = defaultState();
    let eligible = false;
    let initialized = false;
    let listenersBound = false;
    let persistChain = Promise.resolve();

    function defaultState() {
        return {
            version: VERSION,
            status: 'not_started',
            completed_steps: [],
            started_at: null,
            dismissed_at: null,
            completed_at: null,
        };
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function normalizeState(value) {
        const input = value && typeof value === 'object' ? value : {};
        const status = ['not_started', 'active', 'dismissed', 'completed'].includes(input.status)
            ? input.status
            : 'not_started';
        const completed = new Set(Array.isArray(input.completed_steps) ? input.completed_steps : []);
        return {
            version: VERSION,
            status,
            completed_steps: STEPS.filter((step) => completed.has(step)),
            started_at: input.started_at || null,
            dismissed_at: input.dismissed_at || null,
            completed_at: input.completed_at || null,
        };
    }

    function snapshot() {
        return {
            ...state,
            completed_steps: [...state.completed_steps],
            eligible,
            initialized,
            surface: context?.surface || '',
            entry_state: context?.entryState || 'empty',
        };
    }

    function getAstrologerKey() {
        return String(context?.astrologer?.id || 'anonymous');
    }

    function pendingStorageKey() {
        return `${SESSION_PREFIX}:${getAstrologerKey()}`;
    }

    function readPendingState() {
        try {
            const raw = root.sessionStorage?.getItem(pendingStorageKey());
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return normalizeState(parsed?.state || parsed);
        } catch (_error) {
            return null;
        }
    }

    function storePendingState() {
        try {
            root.sessionStorage?.setItem(pendingStorageKey(), JSON.stringify({ state, saved_at: nowIso() }));
        } catch (_error) {
            // Session persistence is best-effort only.
        }
    }

    function clearPendingState() {
        try {
            root.sessionStorage?.removeItem(pendingStorageKey());
        } catch (_error) {
            // Ignore unavailable storage.
        }
    }

    function mergePending(remote, pending) {
        if (!pending) return remote;
        const completed = new Set([...(remote.completed_steps || []), ...(pending.completed_steps || [])]);
        const terminal = TERMINAL_STATUSES.has(pending.status) ? pending.status : remote.status;
        return normalizeState({
            ...remote,
            ...pending,
            status: terminal === remote.status && pending.status === 'active' ? 'active' : terminal,
            completed_steps: [...completed],
        });
    }

    function isNewSinceLaunch(astrologer, launchedAt) {
        const created = Date.parse(astrologer?.created_at || '');
        const launched = Date.parse(launchedAt || '');
        return Number.isFinite(created) && Number.isFinite(launched) && created >= launched;
    }

    function computeEligibility({ astrologer, chartCount, remoteState }) {
        const cfg = root.__RUNTIME_CONFIG__ || {};
        const plan = String(astrologer?.plan_code || '').trim().toLowerCase();
        if (cfg.onboardingV1Enabled !== true || !ELIGIBLE_PLANS.has(plan)) return false;
        if (TERMINAL_STATUSES.has(remoteState.status)) return false;
        return Number(chartCount || 0) === 0 || isNewSinceLaunch(astrologer, cfg.onboardingV1LaunchedAt);
    }

    function track(event, properties = {}) {
        root.AstroAnalytics?.track?.(event, {
            version: VERSION,
            plan_code: String(context?.astrologer?.plan_code || ''),
            surface: context?.surface || '',
            entry_state: context?.entryState || 'empty',
            ...properties,
        });
    }

    function trackShownOnce() {
        try {
            const key = `${SHOWN_PREFIX}:${getAstrologerKey()}`;
            if (root.sessionStorage?.getItem(key) === '1') return;
            root.sessionStorage?.setItem(key, '1');
        } catch (_error) {
            // Analytics dedupe is best-effort.
        }
        track('onboarding_shown');
    }

    function trackLearning(event, properties = {}, { once = true } = {}) {
        const allowed = new Set([
            'onboarding_control_used',
            'onboarding_layer_added',
            'onboarding_prompt_used',
            'onboarding_hint_skipped',
            'onboarding_help_reopened',
        ]);
        if (!allowed.has(event)) return false;
        const milestone = String(properties.milestone || properties.control || properties.hint || 'default');
        if (once) {
            try {
                const key = `steliara.onboarding.learning:${event}:${milestone}`;
                if (root.sessionStorage?.getItem(key) === '1') return false;
                root.sessionStorage?.setItem(key, '1');
            } catch (_error) {
                // Analytics dedupe is best-effort.
            }
        }
        track(event, properties);
        return true;
    }

    function announce() {
        root.document?.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: snapshot() }));
    }

    function persist() {
        storePendingState();
        if (!root.AstroAPI?.patchAccountPreferences) return Promise.resolve(false);
        persistChain = persistChain
            .catch(() => false)
            .then(async () => {
                try {
                    const response = await root.AstroAPI.patchAccountPreferences({ onboarding: state });
                    state = normalizeState(response?.onboarding || state);
                    clearPendingState();
                    announce();
                    return true;
                } catch (error) {
                    console.warn('Onboarding progress sync failed:', error);
                    storePendingState();
                    return false;
                }
            });
        return persistChain;
    }

    function bindEvents() {
        if (listenersBound || !root.document) return;
        listenersBound = true;
        root.document.addEventListener('steliara:onboarding-forecast-ready', () => {
            completeStep('forecast_ready', 'transit_render');
        });
        root.document.addEventListener('steliara:onboarding-assistant-answer', () => {
            completeStep('assistant_answer', 'assistant_response');
        });
    }

    async function init({ astrologer, charts = [], surface = 'unknown' } = {}) {
        context = {
            astrologer: astrologer || null,
            chartCount: Array.isArray(charts) ? charts.length : Number(charts || 0),
            surface,
            entryState: (Array.isArray(charts) ? charts.length : Number(charts || 0)) > 0
                ? 'existing_chart'
                : 'empty',
        };
        bindEvents();

        let preferences;
        try {
            preferences = await root.AstroAPI?.getAccountPreferences?.();
        } catch (error) {
            console.warn('Onboarding preferences unavailable:', error);
            eligible = false;
            initialized = true;
            announce();
            return snapshot();
        }

        state = mergePending(normalizeState(preferences?.onboarding), readPendingState());
        eligible = computeEligibility({
            astrologer: context.astrologer,
            chartCount: context.chartCount,
            remoteState: state,
        });
        initialized = true;

        if (eligible) trackShownOnce();
        if (eligible && context.chartCount > 0 && !state.completed_steps.includes('profile_chart')) {
            await completeStep('profile_chart', 'existing_chart');
        } else if (eligible) {
            announce();
            if (readPendingState()) persist();
        } else {
            announce();
        }
        return snapshot();
    }

    async function start(source = 'primary_cta') {
        if (!eligible || TERMINAL_STATUSES.has(state.status)) return snapshot();
        if (state.status !== 'active') {
            state = normalizeState({
                ...state,
                status: 'active',
                started_at: state.started_at || nowIso(),
                dismissed_at: null,
                completed_at: null,
            });
            track('onboarding_started', { source });
            announce();
            await persist();
        }
        return snapshot();
    }

    async function completeStep(step, source = 'product_event') {
        if (!eligible || !STEPS.includes(step) || TERMINAL_STATUSES.has(state.status)) return snapshot();
        if (state.completed_steps.includes(step)) return snapshot();
        if (state.status !== 'active') await start(source);

        state = normalizeState({
            ...state,
            status: 'active',
            completed_steps: [...state.completed_steps, step],
        });
        track('onboarding_step_completed', { step, source });

        if (STEPS.every((item) => state.completed_steps.includes(item))) {
            state.status = 'completed';
            state.completed_at = nowIso();
            track('onboarding_completed', { step, source });
        }
        announce();
        await persist();
        return snapshot();
    }

    async function dismiss(source = 'skip') {
        if (!eligible || TERMINAL_STATUSES.has(state.status)) return snapshot();
        state = normalizeState({
            ...state,
            status: 'dismissed',
            dismissed_at: nowIso(),
        });
        track('onboarding_dismissed', { source });
        eligible = false;
        announce();
        await persist();
        return snapshot();
    }

    async function reset() {
        if (!context) {
            context = {
                astrologer: root.AstroAPI?.getCachedAstrologer?.() || null,
                chartCount: 0,
                surface: 'account_settings',
                entryState: 'empty',
            };
        }
        state = normalizeState({
            ...defaultState(),
            status: 'active',
            completed_steps: context?.chartCount > 0 ? ['profile_chart'] : [],
            started_at: nowIso(),
        });
        eligible = ELIGIBLE_PLANS.has(String(context?.astrologer?.plan_code || '').toLowerCase());
        announce();
        await persist();
        return snapshot();
    }

    root.AstroOnboarding = {
        VERSION,
        STEPS: [...STEPS],
        CHANGE_EVENT,
        init,
        start,
        completeStep,
        dismiss,
        reset,
        trackLearning,
        getState: snapshot,
        isEligible: () => eligible,
        isActive: () => eligible && state.status === 'active',
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = root.AstroOnboarding;
    }
})(typeof window !== 'undefined' ? window : globalThis);

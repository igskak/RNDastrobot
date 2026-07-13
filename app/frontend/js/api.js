/**
 * API модуль для работы с бэкендом AstroBot
 */
(function (root) {
    'use strict';

    const hasWindow = typeof window !== 'undefined';
    const hasDocument = typeof document !== 'undefined';

    const API_BASE_URL = hasWindow && window.location.hostname === 'localhost'
        ? 'http://localhost:8000/api/v1'
        : '/api/v1';
    const NAVIGATION_STATE_KEY = 'astroNavigationState';
    const ACCOUNT_SETTINGS_RETURN_URL_KEY = 'accountSettingsReturnUrl';
    const READ_CACHE_TTL_MS = 5 * 60 * 1000;
    let currentAstrologerCache = null;
    const readCache = new Map();
    const readInFlight = new Map();

    function getCurrentLocale() {
        return root?.FrontendI18n?.getLocale?.() || 'en';
    }

    function withLocaleHeaders(headers = {}) {
        if (root?.FrontendI18n?.withLocaleHeaders) {
            return root.FrontendI18n.withLocaleHeaders(headers);
        }

        const locale = getCurrentLocale();
        return {
            ...headers,
            'Accept-Language': locale,
            'X-Locale': locale,
        };
    }

    function t(key, params, fallback = key) {
        if (root?.FrontendI18n?.t) {
            return root.FrontendI18n.t(key, params);
        }
        return fallback;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function apiFetch(url, init = {}) {
        return fetch(url, {
            credentials: 'include',
            ...init,
            headers: init.headers || {},
        });
    }

    async function cachedRead(cacheKey, options, loader) {
        if (options?.force === true) {
            readCache.delete(cacheKey);
            readInFlight.delete(cacheKey);
        }
        const cached = readCache.get(cacheKey);
        if (cached && Date.now() - cached.savedAt < READ_CACHE_TTL_MS) {
            return cached.value;
        }
        if (readInFlight.has(cacheKey)) {
            return readInFlight.get(cacheKey);
        }
        const request = loader().then((value) => {
            readCache.set(cacheKey, { savedAt: Date.now(), value });
            return value;
        }).finally(() => {
            readInFlight.delete(cacheKey);
        });
        readInFlight.set(cacheKey, request);
        return request;
    }

    function invalidatePreferencesReadCache() {
        [...readCache.keys()].forEach((key) => {
            if (key.startsWith('preferences:')) readCache.delete(key);
        });
        [...readInFlight.keys()].forEach((key) => {
            if (key.startsWith('preferences:')) readInFlight.delete(key);
        });
    }

    // Maps a backend plan-gate error_code to the upgrade-modal reason key.
    const PLAN_ERROR_REASONS = {
        TRIAL_ENDED: 'trial_ended',
        PLAN_LIMIT_REACHED: 'limit',
    };

    // When a 403 carries a plan-gate error_code, surface the plan-selection
    // popup. Called from readErrorMessage so every API path that funnels errors
    // through it (chart/profile creation, synastry, etc.) reacts automatically.
    function maybeSurfacePlanModal(response, payload) {
        if (!hasDocument || !payload || response?.status !== 403) return;
        const code = payload.error_code;
        if (!code) return;
        let reason;
        if (code === 'PLAN_FEATURE_LOCKED') {
            reason = (payload.detail && payload.detail.feature) || 'default';
        } else if (PLAN_ERROR_REASONS[code]) {
            reason = PLAN_ERROR_REASONS[code];
        } else {
            return;
        }
        if (document.querySelector('.astro-plan-modal-backdrop')) return; // already open
        showPlanUpgradeModal({ reason, astrologer: currentAstrologerCache });
    }

    async function readErrorMessage(response, fallbackKey, fallbackText) {
        let payload = null;

        try {
            payload = await response.json();
        } catch (_error) {
            payload = null;
        }

        maybeSurfacePlanModal(response, payload);

        if (payload && typeof payload.message === 'string' && payload.message.trim()) {
            return payload.message;
        }

        if (payload && typeof payload.detail === 'string' && payload.detail.trim()) {
            return payload.detail;
        }

        return t(fallbackKey, null, fallbackText);
    }

    /**
     * Расчёт натальной карты
     * @param {Object} birthData - Данные рождения
     * @param {Object} options - Дополнительные настройки запроса
     * @returns {Promise<Object>} - Результат расчёта
     */
    async function calculateNatalChart(birthData, options = {}) {
        const params = new URLSearchParams();
        if (options.saveToDb === false) {
            params.set('save_to_db', 'false');
        }

        const url = params.size
            ? `${API_BASE_URL}/natal/calculate?${params.toString()}`
            : `${API_BASE_URL}/natal/calculate`;

        const response = await apiFetch(url, {
            method: 'POST',
            headers: withLocaleHeaders({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify(birthData),
            signal: options.signal,
        });

        if (!response.ok) {
            throw new Error(await readErrorMessage(
                response,
                'page.index.errors.calculateFailed',
                'Failed to calculate chart'
            ));
        }

        return normalizeChartMotion(await response.json());
    }

    async function getNatalChart(userId, options = {}) {
        const response = await apiFetch(`${API_BASE_URL}/natal/${encodeURIComponent(String(userId))}`, {
            method: 'GET',
            headers: withLocaleHeaders(),
            signal: options.signal,
        });

        if (!response.ok) {
            throw new Error(await readErrorMessage(
                response,
                'common.error',
                'Failed to load natal chart'
            ));
        }

        return normalizeChartMotion(await response.json());
    }

    async function updateClientChart(userId, birthData, options = {}) {
        if (!userId) {
            throw new Error(translate('page.chart.edit.errors.userIdMissing'));
        }

        const response = await apiFetch(`${API_BASE_URL}/users/${encodeURIComponent(String(userId))}`, {
            method: 'PUT',
            headers: withLocaleHeaders({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify(birthData),
            signal: options.signal,
        });

        if (!response.ok) {
            throw new Error(await readErrorMessage(
                response,
                'page.chart.edit.errors.saveFailed',
                'Failed to update client data'
            ));
        }

        return response.json();
    }

    async function getCurrentAstrologer() {
        const response = await apiFetch(`${API_BASE_URL}/auth/me`, {
            method: 'GET',
            headers: withLocaleHeaders(),
        });
        if (!response.ok) {
            currentAstrologerCache = null;
            return null;
        }
        currentAstrologerCache = await response.json();
        return currentAstrologerCache;
    }

    // Once per browser session, auto-open the plan popup when the trial has
    // ended so an expired user is prompted to pick a plan on first load. The
    // popup is closable — the rest of the app stays usable in read-only mode.
    function maybePromptExpiredOnce(astrologer) {
        if (!hasDocument || getPlanCode(astrologer) !== 'expired') return;
        try {
            if (root.sessionStorage?.getItem('astroExpiredPromptShown')) return;
            root.sessionStorage?.setItem('astroExpiredPromptShown', '1');
        } catch (_error) { /* storage unavailable — show anyway */ }
        showPlanUpgradeModal({ reason: 'trial_ended', astrologer });
    }

    async function requireAuth(options = {}) {
        const redirectTo = options.redirectTo || '/login.html';
        const me = await getCurrentAstrologer();
        if (me) {
            currentAstrologerCache = me;
            maybePromptExpiredOnce(me);
            return me;
        }
        if (typeof window !== 'undefined' && redirectTo) {
            window.location.href = buildLoginRedirect(redirectTo);
        }
        return null;
    }

    function buildLoginRedirect(redirectTo) {
        if (!hasWindow) return redirectTo;
        try {
            const url = new URL(redirectTo, window.location.origin);
            if (url.origin !== window.location.origin) return redirectTo;
            if (!/^\/login(?:\.html)?$/.test(url.pathname)) return redirectTo;
            const current = `${window.location.pathname}${window.location.search || ''}${window.location.hash || ''}`;
            if (!current || /^\/login(?:\.html)?(?:[?#]|$)/.test(current)) return `${url.pathname}${url.search}${url.hash}`;
            if (!url.searchParams.has('next')) {
                url.searchParams.set('next', current);
            }
            return `${url.pathname}${url.search}${url.hash}`;
        } catch (_error) {
            return redirectTo;
        }
    }

    function getCachedAstrologer() {
        return currentAstrologerCache;
    }

    function getPlanCode(astrologer = currentAstrologerCache) {
        return String(astrologer?.plan_code || 'pro').trim().toLowerCase() || 'pro';
    }

    function getEntitlements(astrologer = currentAstrologerCache) {
        return astrologer?.entitlements && typeof astrologer.entitlements === 'object'
            ? astrologer.entitlements
            : {};
    }

    function canUseFeature(feature, astrologer = currentAstrologerCache) {
        const entitlements = getEntitlements(astrologer);
        const flagByFeature = {
            clients: 'clients_enabled',
            consultations: 'consultations_enabled',
            calls: 'calls_enabled',
            recording: 'recording_enabled',
            transcription: 'transcription_enabled',
            meeting_stats: 'meeting_stats_enabled',
            assistant: 'assistant_enabled',
        };
        const flag = flagByFeature[feature] || feature;
        return entitlements[flag] === true;
    }

    function isSoloPlan(astrologer = currentAstrologerCache) {
        return getPlanCode(astrologer) === 'solo';
    }

    function getUsage(astrologer = currentAstrologerCache) {
        return astrologer?.usage && typeof astrologer.usage === 'object'
            ? astrologer.usage
            : {};
    }

    function getSavedChartLimitState(astrologer = currentAstrologerCache) {
        const usage = getUsage(astrologer);
        const current = Number(usage.saved_charts_count || 0);
        const maxRaw = usage.max_saved_charts;
        const max = maxRaw === null || maxRaw === undefined ? null : Number(maxRaw);
        return {
            current: Number.isFinite(current) ? current : 0,
            max: Number.isFinite(max) ? max : null,
            reached: Number.isFinite(max) && current >= max,
        };
    }

    async function updateCurrentPlan(planCode) {
        const response = await apiFetch(`${API_BASE_URL}/auth/me/plan`, {
            method: 'PATCH',
            headers: withLocaleHeaders({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({ plan_code: planCode }),
        });

        if (!response.ok) {
            throw new Error(await readErrorMessage(
                response,
                'page.plan.modal.errors.updateFailed',
                'Unable to update plan right now.'
            ));
        }

        currentAstrologerCache = await response.json();
        return currentAstrologerCache;
    }

    async function createBillingCheckout(options = {}) {
        const response = await apiFetch(`${API_BASE_URL}/billing/checkout`, {
            method: 'POST',
            headers: withLocaleHeaders({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
                plan_code: options.planCode,
                interval: options.interval || 'monthly',
                coupon_code: options.couponCode || undefined,
            }),
        });

        if (!response.ok) {
            throw new Error(await readErrorMessage(
                response,
                'page.plan.modal.errors.checkoutFailed',
                'Unable to start checkout right now.'
            ));
        }

        return response.json();
    }

    async function getBillingPortal() {
        const response = await apiFetch(`${API_BASE_URL}/billing/portal`, {
            method: 'GET',
            headers: withLocaleHeaders(),
        });

        if (!response.ok) {
            throw new Error(await readErrorMessage(
                response,
                'page.plan.modal.errors.portalFailed',
                'Unable to open the billing portal right now.'
            ));
        }

        return response.json();
    }

    async function getBillingSubscription() {
        const response = await apiFetch(`${API_BASE_URL}/billing/subscription`, {
            method: 'GET',
            headers: withLocaleHeaders(),
        });
        if (!response.ok) return null;
        return response.json();
    }

    function getUpgradePlanCodes(reason, astrologer = currentAstrologerCache) {
        const current = getPlanCode(astrologer);
        if (reason === 'calls' || reason === 'recording' || reason === 'transcription') {
            return current === 'pro' ? [] : ['pro'];
        }
        return ['standard', 'pro'].filter((planCode) => planCode !== current);
    }

    function ensurePlanModalStyles() {
        if (!hasDocument || document.getElementById('astroPlanModalStyles')) return;
        const style = document.createElement('style');
        style.id = 'astroPlanModalStyles';
        style.textContent = `
            .astro-plan-modal-backdrop{position:fixed;inset:0;z-index:220;background:rgba(17,24,39,.48);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:18px}
            .astro-plan-modal{width:min(680px,100%);max-height:min(88vh,760px);overflow:auto;border:1px solid rgba(184,147,90,.24);border-radius:26px;background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(249,247,242,.98));box-shadow:0 32px 72px rgba(18,28,45,.24);padding:24px}
            .astro-plan-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}
            .astro-plan-modal-kicker{margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#b8935a}
            .astro-plan-modal-title{margin:0;font-family:var(--font-display, Georgia, serif);font-size:clamp(30px,4vw,40px);font-weight:500;line-height:.98;color:#1a1614}
            .astro-plan-modal-copy{margin:10px 0 0;max-width:54ch;font-size:14px;line-height:1.55;color:#5c554e}
            .astro-plan-modal-close{width:40px;height:40px;flex:0 0 auto;border:1px solid rgba(30,58,95,.12);border-radius:999px;background:#fff;color:#5c554e;font-size:24px;line-height:1;cursor:pointer}
            .astro-plan-modal-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}
            .astro-plan-option{display:grid;gap:10px;text-align:left;border:1px solid rgba(30,58,95,.1);border-radius:18px;background:#fff;padding:15px;cursor:pointer;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}
            .astro-plan-option:hover:not(:disabled){transform:translateY(-1px);border-color:rgba(30,58,95,.32);box-shadow:0 14px 28px rgba(30,58,95,.12)}
            .astro-plan-option:disabled{opacity:.62;cursor:not-allowed}
            .astro-plan-option-title{font-size:17px;font-weight:700;color:#1a1614}
            .astro-plan-option-copy{font-size:13px;line-height:1.45;color:#5c554e}
            .astro-plan-option-action{width:max-content;min-height:30px;display:inline-flex;align-items:center;padding:0 11px;border-radius:999px;background:#1e3a5f;color:#fff;font-size:12px;font-weight:700}
            .astro-plan-modal-note,.astro-plan-modal-error{margin:14px 0 0;font-size:12px;line-height:1.45;color:#7a5a2c}
            .astro-plan-modal-error{color:#9b2c2c}
            @media(max-width:560px){.astro-plan-modal{padding:20px 16px;border-radius:22px}.astro-plan-modal-head{gap:12px}.astro-plan-modal-grid{grid-template-columns:1fr}}
        `;
        document.head.appendChild(style);
    }

    function closePlanUpgradeModal() {
        if (!hasDocument) return;
        document.querySelector('.astro-plan-modal-backdrop')?.remove();
        document.body.style.overflow = '';
    }

    function showPlanUpgradeModal(options = {}) {
        if (!hasDocument) return;
        ensurePlanModalStyles();
        closePlanUpgradeModal();

        const reason = options.reason || 'default';
        const planCodes = options.planCodes || getUpgradePlanCodes(reason, options.astrologer);
        const backdrop = document.createElement('div');
        backdrop.className = 'astro-plan-modal-backdrop';
        backdrop.innerHTML = `
            <section class="astro-plan-modal" role="dialog" aria-modal="true" aria-labelledby="astroPlanModalTitle">
                <div class="astro-plan-modal-head">
                    <div>
                        <p class="astro-plan-modal-kicker">${escapeHtml(t('page.plan.modal.kicker', null, 'Plan upgrade'))}</p>
                        <h2 class="astro-plan-modal-title" id="astroPlanModalTitle">${escapeHtml(t('page.plan.modal.title', null, 'Choose a workspace plan'))}</h2>
                        <p class="astro-plan-modal-copy">${escapeHtml(t(`page.plan.modal.copy.${reason}`, null, t('page.plan.modal.copy.default', null, 'Choose a plan to unlock this workspace.')))}</p>
                    </div>
                    <button class="astro-plan-modal-close" type="button" data-plan-modal-close aria-label="${escapeHtml(t('common.close', null, 'Close'))}">×</button>
                </div>
                <div class="astro-plan-modal-grid">
                    ${planCodes.map((planCode) => `
                        <button class="astro-plan-option" type="button" data-plan-code="${escapeHtml(planCode)}">
                            <span class="astro-plan-option-title">${escapeHtml(t(`page.plan.names.${planCode}`, null, planCode))}</span>
                            <span class="astro-plan-option-copy">${escapeHtml(t(`page.plan.descriptions.${planCode}`, null, ''))}</span>
                            <span class="astro-plan-option-action">${escapeHtml(t('page.plan.modal.choosePlan', { plan: t(`page.plan.names.${planCode}`, null, planCode) }, `Switch to ${planCode}`))}</span>
                        </button>
                    `).join('')}
                </div>
                <p class="astro-plan-modal-error" data-plan-modal-error hidden></p>
            </section>
        `;

        backdrop.addEventListener('click', async (event) => {
            if (event.target === backdrop || event.target.closest('[data-plan-modal-close]')) {
                closePlanUpgradeModal();
                return;
            }
            const button = event.target.closest('[data-plan-code]');
            if (!button) return;

            const errorEl = backdrop.querySelector('[data-plan-modal-error]');
            backdrop.querySelectorAll('[data-plan-code]').forEach((node) => {
                node.disabled = true;
            });
            button.querySelector('.astro-plan-option-action').textContent = t('page.plan.modal.openingCheckout');
            if (errorEl) errorEl.hidden = true;

            try {
                const checkout = await createBillingCheckout({
                    planCode: button.dataset.planCode,
                    interval: options.interval || 'monthly',
                    couponCode: options.couponCode || null,
                });
                if (checkout?.checkout_url && root.location) {
                    if (typeof root.AstroAnalytics?.track === 'function') {
                        root.AstroAnalytics.track('begin_checkout', {
                            plan_code: button.dataset.planCode,
                            interval: options.interval || 'monthly',
                        });
                    }
                    root.location.href = checkout.checkout_url;
                    return;
                }
                throw new Error(t('page.plan.modal.errors.checkoutFailed'));
            } catch (error) {
                if (errorEl) {
                    errorEl.textContent = error.message || t('page.plan.modal.errors.checkoutFailed');
                    errorEl.hidden = false;
                }
                backdrop.querySelectorAll('[data-plan-code]').forEach((node) => {
                    node.disabled = false;
                });
            }
        });

        document.body.appendChild(backdrop);
        document.body.style.overflow = 'hidden';
        backdrop.querySelector('[data-plan-code], [data-plan-modal-close]')?.focus();
    }

    async function logout() {
        await apiFetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: withLocaleHeaders(),
        });
    }

    async function resolvePlaceTimezone(sourceId, options = {}) {
        if (!sourceId) return null;
        const params = new URLSearchParams({ source_id: String(sourceId) });
        const response = await apiFetch(`${API_BASE_URL}/places/timezone?${params.toString()}`, {
            method: 'GET',
            headers: withLocaleHeaders(),
            signal: options.signal,
        });
        if (!response.ok) {
            return null;
        }
        const payload = await response.json();
        const timezone = String(payload?.timezone || '').trim();
        return timezone || null;
    }

    function toQueryString(params = {}) {
        const search = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '') return;
            search.set(key, String(value));
        });
        const serialized = search.toString();
        return serialized ? `?${serialized}` : '';
    }

    async function getAccountPreferences(options = {}) {
        return cachedRead('preferences:account', options, async () => {
            const response = await apiFetch(`${API_BASE_URL}/preferences/account`, {
                method: 'GET',
                headers: withLocaleHeaders(),
                signal: options.signal,
            });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, 'common.error', 'Failed to load account preferences'));
            }
            return response.json();
        });
    }

    async function patchAccountPreferences(payload, options = {}) {
        const response = await apiFetch(`${API_BASE_URL}/preferences/account`, {
            method: 'PATCH',
            headers: withLocaleHeaders({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify(payload || {}),
            signal: options.signal,
        });
        if (!response.ok) {
            throw new Error(await readErrorMessage(response, 'common.error', 'Failed to update account preferences'));
        }
        invalidatePreferencesReadCache();
        return response.json();
    }

    async function getPreferencesMetadata(options = {}) {
        return cachedRead('preferences:metadata', options, async () => {
            const response = await apiFetch(`${API_BASE_URL}/preferences/metadata`, {
                method: 'GET',
                headers: withLocaleHeaders(),
                signal: options.signal,
            });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, 'common.error', 'Failed to load preferences metadata'));
            }
            return response.json();
        });
    }

    async function createPreferenceRecalcJob(payload, options = {}) {
        const response = await apiFetch(`${API_BASE_URL}/preferences/recalc-jobs`, {
            method: 'POST',
            headers: withLocaleHeaders({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify(payload || {}),
            signal: options.signal,
        });
        if (!response.ok) {
            throw new Error(await readErrorMessage(response, 'common.error', 'Failed to create preference recalculation job'));
        }
        return response.json();
    }

    async function getPreferenceRecalcJob(jobId, options = {}) {
        const response = await apiFetch(`${API_BASE_URL}/preferences/recalc-jobs/${encodeURIComponent(String(jobId))}`, {
            method: 'GET',
            headers: withLocaleHeaders(),
            signal: options.signal,
        });
        if (!response.ok) {
            throw new Error(await readErrorMessage(response, 'common.error', 'Failed to load preference recalculation job'));
        }
        return response.json();
    }

    async function getResolvedPreferences(params, options = {}) {
        const query = toQueryString(params);
        return cachedRead(`preferences:resolved:${query}`, options, async () => {
            const response = await apiFetch(
                `${API_BASE_URL}/preferences/resolved${query}`,
                {
                    method: 'GET',
                    headers: withLocaleHeaders(),
                    signal: options.signal,
                }
            );
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, 'common.error', 'Failed to resolve preferences'));
            }
            return response.json();
        });
    }

    async function saveChartViewOverride(payload, options = {}) {
        const response = await apiFetch(`${API_BASE_URL}/preferences/chart-view`, {
            method: 'PUT',
            headers: withLocaleHeaders({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify(payload || {}),
            signal: options.signal,
        });
        if (!response.ok) {
            throw new Error(await readErrorMessage(response, 'common.error', 'Failed to save chart view override'));
        }
        invalidatePreferencesReadCache();
        return response.json();
    }

    async function deleteChartViewOverride(params, options = {}) {
        const response = await apiFetch(
            `${API_BASE_URL}/preferences/chart-view${toQueryString(params)}`,
            {
                method: 'DELETE',
                headers: withLocaleHeaders(),
                signal: options.signal,
            }
        );
        if (!response.ok) {
            throw new Error(await readErrorMessage(response, 'common.error', 'Failed to delete chart view override'));
        }
        invalidatePreferencesReadCache();
        return response.json();
    }

    async function updateUserHouseSystem(userId, houseSystem, options = {}) {
        const response = await apiFetch(`${API_BASE_URL}/users/${encodeURIComponent(String(userId))}/house-system`, {
            method: 'PATCH',
            headers: withLocaleHeaders({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({ house_system: houseSystem }),
            signal: options.signal,
        });
        if (!response.ok) {
            throw new Error(await readErrorMessage(response, 'common.error', 'Failed to update house system'));
        }
        return response.json();
    }

    async function updateUserZodiac(userId, zodiac, ayanamsha = 'lahiri', options = {}) {
        const response = await apiFetch(`${API_BASE_URL}/users/${encodeURIComponent(String(userId))}/zodiac`, {
            method: 'PATCH',
            headers: withLocaleHeaders({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({ zodiac, ayanamsha }),
            signal: options.signal,
        });
        if (!response.ok) {
            throw new Error(await readErrorMessage(response, 'common.error', 'Failed to update zodiac'));
        }
        return response.json();
    }

    async function resetUserViewToDefaults(userId, viewType, options = {}) {
        const response = await apiFetch(`${API_BASE_URL}/users/${encodeURIComponent(String(userId))}/reset-view-to-defaults`, {
            method: 'POST',
            headers: withLocaleHeaders({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({ view_type: viewType }),
            signal: options.signal,
        });
        if (!response.ok) {
            throw new Error(await readErrorMessage(response, 'common.error', 'Failed to reset view to defaults'));
        }
        return response.json();
    }

    async function getRelatedPeople(personId, options = {}) {
        const response = await apiFetch(`${API_BASE_URL}/persons/${encodeURIComponent(String(personId))}/related-people`, {
            method: 'GET',
            headers: withLocaleHeaders(),
            signal: options.signal,
        });
        if (!response.ok) {
            throw new Error(await readErrorMessage(response, 'common.error', 'Failed to load related people'));
        }
        return response.json();
    }

    async function createRelatedPerson(userId, payload, options = {}) {
        const response = await apiFetch(`${API_BASE_URL}/users/${encodeURIComponent(String(userId))}/related-people/create`, {
            method: 'POST',
            headers: withLocaleHeaders({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify(payload || {}),
            signal: options.signal,
        });
        if (!response.ok) {
            throw new Error(await readErrorMessage(response, 'common.error', 'Failed to create related person'));
        }
        return response.json();
    }

    async function linkRelatedPerson(personId, payload, options = {}) {
        const normalizedPayload = {
            related_person_id: payload?.related_person_id || payload?.related_user_id,
            relation_label: payload?.relation_label || null,
            notes: payload?.notes || null,
        };
        const response = await apiFetch(`${API_BASE_URL}/persons/${encodeURIComponent(String(personId))}/related-people`, {
            method: 'POST',
            headers: withLocaleHeaders({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify(normalizedPayload),
            signal: options.signal,
        });
        if (!response.ok) {
            throw new Error(await readErrorMessage(response, 'common.error', 'Failed to link related person'));
        }
        return response.json();
    }

    async function deleteRelatedPerson(personId, relatedPersonId, options = {}) {
        const response = await apiFetch(`${API_BASE_URL}/persons/${encodeURIComponent(String(personId))}/related-people/${encodeURIComponent(String(relatedPersonId))}`, {
            method: 'DELETE',
            headers: withLocaleHeaders(),
            signal: options.signal,
        });
        if (!response.ok) {
            throw new Error(await readErrorMessage(response, 'common.error', 'Failed to delete related person'));
        }
        return response.json();
    }

    async function getSynastry(userId, partnerId, options = {}) {
        const params = new URLSearchParams({
            user_id: String(userId),
            partner_id: String(partnerId),
        });
        const response = await apiFetch(`${API_BASE_URL}/synastry?${params.toString()}`, {
            method: 'GET',
            headers: withLocaleHeaders(),
            signal: options.signal,
        });
        if (!response.ok) {
            throw new Error(await readErrorMessage(response, 'common.error', 'Failed to load synastry'));
        }
        return response.json();
    }

    /**
     * Форматирование даты для API
     * @param {number} day
     * @param {string} month
     * @param {number} year
     * @returns {string} - Дата в формате YYYY-MM-DD
     */
    function formatDate(day, month, year) {
        const d = String(day).padStart(2, '0');
        return `${year}-${month}-${d}`;
    }

    /**
     * Форматирование времени для API
     * @param {number} hour
     * @param {number} minute
     * @returns {string} - Время в формате HH:MM:SS
     */
    function formatTime(hour, minute) {
        const h = String(hour).padStart(2, '0');
        const m = String(minute).padStart(2, '0');
        return `${h}:${m}:00`;
    }

    const DEFAULT_STATIONARY_THRESHOLD_PERCENT = 10;

    function normalizePlanetMotion(planet) {
        if (!planet || typeof planet !== 'object') return planet;

        const speed = Number(planet.speed);
        const retrograde = typeof planet.retrograde === 'boolean'
            ? planet.retrograde
            : speed < 0;

        const speedPercent = Number(planet.speed_percent);

        const threshold = Number.isFinite(Number(planet.stationary_threshold_percent))
            ? Number(planet.stationary_threshold_percent)
            : DEFAULT_STATIONARY_THRESHOLD_PERCENT;
        const hasSpeedPercent = Number.isFinite(speedPercent);
        const isStationary = hasSpeedPercent
            ? speedPercent <= threshold
            : Boolean(planet.is_stationary);

        return {
            ...planet,
            retrograde,
            speed_percent: hasSpeedPercent ? speedPercent : null,
            is_stationary: isStationary,
            stationary_type: isStationary
                ? (planet.stationary_type || (retrograde ? 'pre_direct' : 'pre_retrograde'))
                : null,
        };
    }

    function normalizeChartMotion(chartData) {
        if (!chartData || typeof chartData !== 'object' || !Array.isArray(chartData.planets)) {
            return chartData;
        }

        return {
            ...chartData,
            planets: chartData.planets.map(normalizePlanetMotion),
        };
    }

    /**
     * Сохранение данных карты в sessionStorage
     * @param {Object} chartData
     */
    function saveChartToSession(chartData) {
        const normalizedChartData = normalizeChartMotion(chartData);
        sessionStorage.setItem('natalChart', JSON.stringify(normalizedChartData));

        // Сохраняем user_id отдельно для быстрого доступа
        if (normalizedChartData?.user_id) {
            localStorage.setItem('currentUserId', normalizedChartData.user_id);
        }
    }

    /**
     * Получение данных карты из sessionStorage
     * @returns {Object|null}
     */
    function getChartFromSession() {
        const data = sessionStorage.getItem('natalChart');
        return data ? normalizeChartMotion(JSON.parse(data)) : null;
    }

    /**
     * Сохранение входных данных формы
     * @param {Object} formData
     */
    function saveFormData(formData) {
        sessionStorage.setItem('formData', JSON.stringify(formData));
    }

    /**
     * Получение входных данных формы
     * @returns {Object|null}
     */
    function getFormData() {
        const data = sessionStorage.getItem('formData');
        return data ? JSON.parse(data) : null;
    }

    function getNavigationState() {
        if (!hasWindow || !window.sessionStorage) return {};
        const raw = window.sessionStorage.getItem(NAVIGATION_STATE_KEY);
        if (!raw) return {};
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_error) {
            return {};
        }
    }

    function saveNavigationState(state) {
        if (!hasWindow || !window.sessionStorage) return {};
        const normalized = state && typeof state === 'object' ? state : {};
        window.sessionStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(normalized));
        return normalized;
    }

    function patchNavigationState(patch) {
        const current = getNavigationState();
        const next = { ...current };

        Object.entries(patch || {}).forEach(([key, value]) => {
            if (value === undefined) {
                delete next[key];
                return;
            }
            next[key] = value;
        });

        return saveNavigationState(next);
    }

    function clearNavigationState() {
        if (!hasWindow || !window.sessionStorage) return;
        window.sessionStorage.removeItem(NAVIGATION_STATE_KEY);
    }

    function getCurrentReturnUrl() {
        if (!hasWindow) return '/';
        return `${window.location.pathname}${window.location.search || ''}${window.location.hash || ''}` || '/';
    }

    // Resolve a "back to the previous page" URL for a navigation (not undo) button.
    // Prefers a same-origin document.referrer, then the navigation-state breadcrumb,
    // then a fallback. `excludePattern` (RegExp) rejects referrer/sourceUrl values that
    // point back at the current page type (e.g. a work-screen chart switch or a
    // self-referencing profile), so "back" never loops on the same screen.
    function resolveBackUrl({ excludePattern = null, fallback = '/' } = {}) {
        const canTest = excludePattern && typeof excludePattern.test === 'function';
        const isExcluded = (value) => Boolean(value) && canTest && excludePattern.test(value);

        let referrerUrl = '';
        if (hasWindow) {
            try {
                const referrer = window.document?.referrer ? new URL(window.document.referrer) : null;
                if (referrer && referrer.origin === window.location.origin) {
                    const path = `${referrer.pathname}${referrer.search || ''}${referrer.hash || ''}`;
                    if (!isExcluded(path)) referrerUrl = path;
                }
            } catch (_error) {
                referrerUrl = '';
            }
        }
        if (referrerUrl) return referrerUrl;

        const sourceUrl = getNavigationState().sourceUrl;
        if (sourceUrl && !isExcluded(sourceUrl)) return sourceUrl;

        return fallback || '/';
    }

    function isAccountSettingsHref(href) {
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return false;
        try {
            const url = new URL(href, window.location.origin);
            return url.origin === window.location.origin && url.pathname.endsWith('/account-settings.html');
        } catch (_error) {
            return href.includes('account-settings.html');
        }
    }

    function saveAccountSettingsReturnUrl(returnUrl = getCurrentReturnUrl()) {
        if (!hasWindow || !window.sessionStorage) return returnUrl || '/';
        const normalizedReturnUrl = returnUrl || '/';
        window.sessionStorage.setItem(ACCOUNT_SETTINGS_RETURN_URL_KEY, normalizedReturnUrl);
        patchNavigationState({
            sourceView: 'account-settings-return',
            sourceUrl: normalizedReturnUrl,
        });
        return normalizedReturnUrl;
    }

    function getAccountSettingsReturnUrl() {
        if (!hasWindow || !window.sessionStorage) return '';
        return window.sessionStorage.getItem(ACCOUNT_SETTINGS_RETURN_URL_KEY) || '';
    }

    function buildClientProfileUrl(personId) {
        return `/client/${encodeURIComponent(String(personId || ''))}`;
    }

    function buildSynastryUrl(clientUserId, partnerUserId) {
        // Synastry now lives as a ring layer inside forecast-new. The client chart
        // is loaded from sessionStorage; the partner rides in as a deep-link param.
        const params = new URLSearchParams({
            layer: 'synastry_partner',
            partner: String(partnerUserId || ''),
        });
        return `/forecast-new.html?${params.toString()}`;
    }

    // Session-aware synastry open: forecast-new needs the client's natal chart in
    // sessionStorage (it shows a cold-start picker otherwise), so fetch + persist
    // before navigating. Callers used to jump straight to synastry.html?client&partner.
    async function openForecastForSynastry(clientUserId, partnerUserId, navMeta = {}) {
        const cid = String(clientUserId || '');
        const pid = String(partnerUserId || '');
        if (!cid || !pid) return;
        saveNavigationState({
            sourceView: navMeta.sourceView || 'clients',
            sourceUrl: navMeta.sourceUrl || '/',
            clientPersonId: navMeta.clientPersonId || null,
            clientChartId: cid,
            partnerPersonId: navMeta.partnerPersonId || null,
            partnerChartId: pid,
            clientUserId: cid,
            partnerUserId: pid,
        });
        try {
            const response = await apiFetch(`${API_BASE_URL}/natal/${encodeURIComponent(cid)}`, { method: 'GET' });
            if (response.ok) {
                const chartData = await response.json();
                saveChartToSession(chartData);
                saveFormData(chartToFormData(chartData));
            }
        } catch (_) {
            // Fall through — forecast-new's cold-start overlay can recover.
        }
        if (hasWindow) {
            window.showPageLoader?.();
            window.location.href = buildSynastryUrl(cid, pid);
        }
    }

    function chartToFormData(chartData, options = {}) {
        const birthData = chartData?.birth_data || {};
        const [yearRaw, monthRaw, dayRaw] = String(birthData.date || '').split('-');
        const [hourRaw, minuteRaw] = String(birthData.time || '').split(':');
        const latitude = Number(birthData.latitude);
        const longitude = Number(birthData.longitude);
        const existingFormData = getFormData();

        return {
            userId: chartData?.user_id || existingFormData?.userId || null,
            firstName: birthData.first_name || '',
            lastName: birthData.last_name || '',
            day: Number.parseInt(dayRaw, 10) || '',
            month: monthRaw || '',
            year: Number.parseInt(yearRaw, 10) || '',
            hour: Number.parseInt(hourRaw, 10) || '',
            minute: Number.parseInt(minuteRaw, 10) || '',
            place: birthData.place || '',
            timezone: birthData.timezone || '',
            houseSystem: options.houseSystem || birthData.house_system || existingFormData?.houseSystem || 'P',
            latitude: Number.isFinite(latitude) ? latitude : null,
            longitude: Number.isFinite(longitude) ? longitude : null,
        };
    }

    /**
     * Скрыть глобальный лоадер страницы
     */
    function hidePageLoader() {
        const loader = document.getElementById('pageLoader');
        if (!loader) return;
        loader.classList.add('fade-out');
        setTimeout(() => loader.remove(), 460);
    }

    /**
     * Показать лоадер (создаёт его, если нет в DOM)
     */
    function showPageLoader() {
        if (document.getElementById('pageLoader')) return;
        const loader = document.createElement('div');
        loader.className = 'page-loader';
        loader.id = 'pageLoader';
        loader.innerHTML = '<div class="pl-spinner"></div><div class="pl-text"></div>';
        const textEl = loader.querySelector('.pl-text');
        if (textEl) {
            textEl.textContent = t('common.loading', null, 'Loading...');
        }
        document.body.prepend(loader);
    }

    if (hasDocument) {
        // Автоматически скрываем лоадер когда страница готова
        document.addEventListener('DOMContentLoaded', () => {
            if (document.body?.classList?.contains('chart-page') || document.body?.classList?.contains('forecast-new-page')) {
                return;
            }
            // Небольшая задержка чтобы дать JS-рендерингу отработать
            requestAnimationFrame(() => hidePageLoader());
        });

        // Показываем лоадер при переходе по ссылкам (убирает белый экран)
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (!link) return;
            const href = link.getAttribute('href');
            // Только локальные переходы на .html страницы
            if (!href || href.startsWith('#') || href.startsWith('javascript') || link.target === '_blank') return;
            if (href.startsWith('http')) {
                try {
                    if (new URL(href).origin !== window.location.origin) return;
                } catch (_error) {
                    return;
                }
            }
            if (isAccountSettingsHref(href)) {
                saveAccountSettingsReturnUrl();
            }
            showPageLoader();
        }, { capture: true });
    }

    // Экспорт для использования
    const api = {
        API_BASE_URL,
        calculateNatalChart,
        getNatalChart,
        updateClientChart,
        getCurrentAstrologer,
        requireAuth,
        buildLoginRedirect,
        getCachedAstrologer,
        getPlanCode,
        getEntitlements,
        canUseFeature,
        isSoloPlan,
        getUsage,
        getSavedChartLimitState,
        updateCurrentPlan,
        createBillingCheckout,
        getBillingPortal,
        getBillingSubscription,
        showPlanUpgradeModal,
        logout,
        resolvePlaceTimezone,
        getAccountPreferences,
        patchAccountPreferences,
        getPreferencesMetadata,
        createPreferenceRecalcJob,
        getPreferenceRecalcJob,
        getResolvedPreferences,
        saveChartViewOverride,
        deleteChartViewOverride,
        updateUserHouseSystem,
        updateUserZodiac,
        resetUserViewToDefaults,
        getRelatedPeople,
        createRelatedPerson,
        linkRelatedPerson,
        deleteRelatedPerson,
        getSynastry,
        formatDate,
        formatTime,
        saveChartToSession,
        getChartFromSession,
        saveFormData,
        getFormData,
        getNavigationState,
        saveNavigationState,
        patchNavigationState,
        clearNavigationState,
        resolveBackUrl,
        saveAccountSettingsReturnUrl,
        getAccountSettingsReturnUrl,
        buildClientProfileUrl,
        buildSynastryUrl,
        openForecastForSynastry,
        chartToFormData,
        withLocaleHeaders,
        showPageLoader,
        hidePageLoader,
    };

    root.AstroAPI = api;
    root.AstroPlan = {
        getCachedAstrologer,
        getPlanCode,
        getEntitlements,
        canUseFeature,
        isSoloPlan,
        getUsage,
        getSavedChartLimitState,
        updateCurrentPlan,
        createBillingCheckout,
        getBillingPortal,
        getBillingSubscription,
        showUpgradeModal: showPlanUpgradeModal,
    };
    root.showPageLoader = showPageLoader;
    root.hidePageLoader = hidePageLoader;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);

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

    function apiFetch(url, init = {}) {
        return fetch(url, {
            credentials: 'include',
            ...init,
            headers: init.headers || {},
        });
    }

    async function readErrorMessage(response, fallbackKey, fallbackText) {
        let payload = null;

        try {
            payload = await response.json();
        } catch (_error) {
            payload = null;
        }

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
            return null;
        }
        return response.json();
    }

    async function requireAuth(options = {}) {
        const redirectTo = options.redirectTo || '/login.html';
        const me = await getCurrentAstrologer();
        if (me) {
            return me;
        }
        if (typeof window !== 'undefined' && redirectTo) {
            window.location.href = redirectTo;
        }
        return null;
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
        const response = await apiFetch(`${API_BASE_URL}/preferences/account`, {
            method: 'GET',
            headers: withLocaleHeaders(),
            signal: options.signal,
        });
        if (!response.ok) {
            throw new Error(await readErrorMessage(response, 'common.error', 'Failed to load account preferences'));
        }
        return response.json();
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
        return response.json();
    }

    async function getPreferencesMetadata(options = {}) {
        const response = await apiFetch(`${API_BASE_URL}/preferences/metadata`, {
            method: 'GET',
            headers: withLocaleHeaders(),
            signal: options.signal,
        });
        if (!response.ok) {
            throw new Error(await readErrorMessage(response, 'common.error', 'Failed to load preferences metadata'));
        }
        return response.json();
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
        const response = await apiFetch(
            `${API_BASE_URL}/preferences/resolved${toQueryString(params)}`,
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

    async function getRelatedPeople(userId, options = {}) {
        const response = await apiFetch(`${API_BASE_URL}/users/${encodeURIComponent(String(userId))}/related-people`, {
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

    async function linkRelatedPerson(userId, payload, options = {}) {
        const response = await apiFetch(`${API_BASE_URL}/users/${encodeURIComponent(String(userId))}/related-people`, {
            method: 'POST',
            headers: withLocaleHeaders({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify(payload || {}),
            signal: options.signal,
        });
        if (!response.ok) {
            throw new Error(await readErrorMessage(response, 'common.error', 'Failed to link related person'));
        }
        return response.json();
    }

    async function deleteRelatedPerson(userId, relatedUserId, options = {}) {
        const response = await apiFetch(`${API_BASE_URL}/users/${encodeURIComponent(String(userId))}/related-people/${encodeURIComponent(String(relatedUserId))}`, {
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

    const SPEED_MEANS = {
        Sun: 0.9856,
        Moon: 13.1764,
        Mercury: 1.607,
        Venus: 1.174,
        Mars: 0.524,
        Jupiter: 0.0831,
        Saturn: 0.0335,
        Uranus: 0.0117,
        Neptune: 0.006,
        Pluto: 0.004,
        Chiron: 0.0192,
        Proserpina: 0.001265,
    };
    const DEFAULT_STATIONARY_THRESHOLD_PERCENT = 10;

    function normalizePlanetMotion(planet) {
        if (!planet || typeof planet !== 'object') return planet;

        const speed = Number(planet.speed);
        const meanSpeed = SPEED_MEANS[String(planet.name || '')];
        const retrograde = typeof planet.retrograde === 'boolean'
            ? planet.retrograde
            : speed < 0;

        let speedPercent = planet.speed_percent;
        if (Number.isFinite(speed) && Number.isFinite(meanSpeed) && meanSpeed > 0) {
            speedPercent = Math.min(Math.abs(speed) / meanSpeed * 100, 100);
            speedPercent = Math.round(speedPercent * 100) / 100;
        }

        const threshold = Number.isFinite(Number(planet.stationary_threshold_percent))
            ? Number(planet.stationary_threshold_percent)
            : DEFAULT_STATIONARY_THRESHOLD_PERCENT;
        const hasSpeedPercent = Number.isFinite(Number(speedPercent));
        const isStationary = hasSpeedPercent
            ? Number(speedPercent) <= threshold
            : Boolean(planet.is_stationary);

        return {
            ...planet,
            retrograde,
            speed_percent: hasSpeedPercent ? Number(speedPercent) : null,
            is_stationary: isStationary,
            stationary_type: isStationary
                ? (retrograde ? 'pre_direct' : 'pre_retrograde')
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

    function buildClientProfileUrl(userId) {
        return `/client/${encodeURIComponent(String(userId || ''))}`;
    }

    function buildSynastryUrl(clientUserId, partnerUserId) {
        const params = new URLSearchParams({
            client: String(clientUserId || ''),
            partner: String(partnerUserId || ''),
        });
        return `/synastry.html?${params.toString()}`;
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
        setTimeout(() => loader.remove(), 300);
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
            // Небольшая задержка чтобы дать JS-рендерингу отработать
            requestAnimationFrame(() => hidePageLoader());
        });

        // Показываем лоадер при переходе по ссылкам (убирает белый экран)
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (!link) return;
            const href = link.getAttribute('href');
            // Только локальные переходы на .html страницы
            if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript') || link.target === '_blank') return;
            showPageLoader();
        });
    }

    // Экспорт для использования
    const api = {
        API_BASE_URL,
        calculateNatalChart,
        getNatalChart,
        updateClientChart,
        getCurrentAstrologer,
        requireAuth,
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
        buildClientProfileUrl,
        buildSynastryUrl,
        chartToFormData,
        withLocaleHeaders,
        showPageLoader,
        hidePageLoader,
    };

    root.AstroAPI = api;
    root.showPageLoader = showPageLoader;
    root.hidePageLoader = hidePageLoader;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);

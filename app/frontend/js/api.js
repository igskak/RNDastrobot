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

        return response.json();
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

    /**
     * Сохранение данных карты в sessionStorage
     * @param {Object} chartData
     */
    function saveChartToSession(chartData) {
        sessionStorage.setItem('natalChart', JSON.stringify(chartData));

        // Сохраняем user_id отдельно для быстрого доступа
        if (chartData.user_id) {
            localStorage.setItem('currentUserId', chartData.user_id);
        }
    }

    /**
     * Получение данных карты из sessionStorage
     * @returns {Object|null}
     */
    function getChartFromSession() {
        const data = sessionStorage.getItem('natalChart');
        return data ? JSON.parse(data) : null;
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
            houseSystem: options.houseSystem || existingFormData?.houseSystem || 'P',
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
        updateClientChart,
        getCurrentAstrologer,
        requireAuth,
        logout,
        resolvePlaceTimezone,
        formatDate,
        formatTime,
        saveChartToSession,
        getChartFromSession,
        saveFormData,
        getFormData,
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

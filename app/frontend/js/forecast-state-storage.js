(function() {
    'use strict';

    const STORAGE_PREFIX = 'forecastViewState';
    const STORAGE_VERSION = 1;
    const VALID_TABS = ['biwheel', 'timeline', 'table', 'solar'];
    const VALID_SCALE_UNITS = ['day', 'week', 'month'];
    const VALID_DIRECTION_TYPES = ['solar_arc', 'symbolic', 'equatorial'];
    const VALID_BIWHEEL_DISPLAY_MODES = ['prognostic', 'natal-pinned'];
    const VALID_SOLAR_PANEL_TABS = ['solar-planets-list', 'solar-aspects-list', 'solar-grid-list'];
    const VALID_TABLE_SORT_COLS = ['date', 'method', 'transit', 'aspect', 'natal', 'orb', 'type'];

    function normalizeToken(value) {
        if (value === null || value === undefined) return '';
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value.toFixed(6);
        }
        return String(value).trim();
    }

    function sanitizeDateValue(value) {
        const raw = typeof value === 'string' ? value.trim() : '';
        return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
    }

    function sanitizeYearValue(value) {
        const year = Number.parseInt(value, 10);
        if (!Number.isFinite(year) || year < 1900 || year > 2100) return '';
        return String(year);
    }

    function sanitizeInteger(value, fallback = 0) {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    }

    function pickEnum(value, allowed, fallback) {
        return allowed.includes(value) ? value : fallback;
    }

    function buildChartSignature(natalData) {
        const birthData = natalData?.birth_data || {};
        const signature = [
            natalData?.user_id,
            birthData.date,
            birthData.time,
            birthData.place,
            birthData.latitude,
            birthData.longitude,
            birthData.house_system,
        ].map(normalizeToken);

        return signature.some(Boolean) ? signature.join('|') : null;
    }

    function buildStorageKey(natalData) {
        const signature = buildChartSignature(natalData);
        return signature ? `${STORAGE_PREFIX}:${signature}` : null;
    }

    function sanitizeControls(controls) {
        const source = controls && typeof controls === 'object' ? controls : {};
        return {
            startDate: sanitizeDateValue(source.startDate),
            endDate: sanitizeDateValue(source.endDate),
            singleDate: sanitizeDateValue(source.singleDate),
            solarYear: sanitizeYearValue(source.solarYear),
            filterMajor: source.filterMajor !== false,
        };
    }

    function sanitizeStatePayload(payload, natalData) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const chartSignature = buildChartSignature(natalData);

        if (!chartSignature) return null;
        if (source.chartSignature && source.chartSignature !== chartSignature) return null;

        return {
            version: STORAGE_VERSION,
            chartSignature,
            savedAt: typeof source.savedAt === 'string' ? source.savedAt : '',
            currentTab: pickEnum(source.currentTab, VALID_TABS, 'biwheel'),
            isFocusMode: source.isFocusMode === true,
            transitScaleUnit: pickEnum(source.transitScaleUnit, VALID_SCALE_UNITS, 'week'),
            transitScaleIndex: sanitizeInteger(source.transitScaleIndex, 0),
            transitMoment: sanitizeDateValue(source.transitMoment),
            pendingBiwheelDate: sanitizeDateValue(source.pendingBiwheelDate),
            directionType: pickEnum(source.directionType, VALID_DIRECTION_TYPES, 'solar_arc'),
            biwheelDisplayMode: pickEnum(source.biwheelDisplayMode, VALID_BIWHEEL_DISPLAY_MODES, 'prognostic'),
            solarPanelTab: pickEnum(source.solarPanelTab, VALID_SOLAR_PANEL_TABS, 'solar-planets-list'),
            tableSortCol: pickEnum(source.tableSortCol, VALID_TABLE_SORT_COLS, 'date'),
            tableSortAsc: source.tableSortAsc !== false,
            hasCalculatedState: source.hasCalculatedState === true,
            activeRunId: typeof source.activeRunId === 'string' ? source.activeRunId : '',
            activeRunMethod: typeof source.activeRunMethod === 'string' ? source.activeRunMethod : '',
            cachedData: source.cachedData && typeof source.cachedData === 'object' ? source.cachedData : null,
            controls: sanitizeControls(source.controls),
        };
    }

    function buildPersistedState(input) {
        const natalData = input?.natalData;
        const state = input?.state && typeof input.state === 'object' ? input.state : {};
        const payload = sanitizeStatePayload({
            ...state,
            controls: input?.controls,
        }, natalData);

        if (!payload) return null;
        payload.savedAt = new Date().toISOString();
        return payload;
    }

    function parsePersistedState(rawValue, natalData) {
        if (!rawValue) return null;

        let parsed = rawValue;
        if (typeof rawValue === 'string') {
            try {
                parsed = JSON.parse(rawValue);
            } catch {
                return null;
            }
        }

        if (!parsed || typeof parsed !== 'object') return null;
        if (parsed.version !== STORAGE_VERSION) return null;

        return sanitizeStatePayload(parsed, natalData);
    }

    const api = {
        STORAGE_PREFIX,
        STORAGE_VERSION,
        buildChartSignature,
        buildStorageKey,
        buildPersistedState,
        parsePersistedState,
    };

    if (typeof window !== 'undefined') {
        window.ForecastStateStorage = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})();

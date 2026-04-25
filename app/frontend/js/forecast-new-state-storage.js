(function() {
    'use strict';

    const STORAGE_PREFIX = 'forecastNewViewState';
    const STORAGE_VERSION = 1;
    const VALID_LAYERS = ['transit', 'progression', 'direction'];
    const VALID_STEP_MODES = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year'];
    const VALID_TABS = ['Planets', 'Aspects', 'Grid', 'Configs', 'Balances'];

    function normalizeToken(value) {
        if (value === null || value === undefined) return '';
        if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(6);
        return String(value).trim();
    }

    function buildChartSignature(natalData) {
        const birthData = natalData?.birth_data || {};
        const parts = [
            natalData?.user_id,
            birthData.date,
            birthData.time,
            birthData.place,
            birthData.latitude,
            birthData.longitude,
            birthData.house_system,
        ].map(normalizeToken);
        return parts.some(Boolean) ? parts.join('|') : null;
    }

    function buildStorageKey(natalData) {
        const signature = buildChartSignature(natalData);
        return signature ? `${STORAGE_PREFIX}:${signature}` : null;
    }

    function sanitizeTargetDatetime(value) {
        const raw = typeof value === 'string' ? value.trim() : '';
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
            return raw.length === 16 ? `${raw}:00` : raw;
        }
        return '';
    }

    function pickEnum(value, allowed, fallback) {
        return allowed.includes(value) ? value : fallback;
    }

    function sanitizeLayerList(value) {
        const source = Array.isArray(value) && value.length ? value : ['transit'];
        const layers = source.filter((layer, index, arr) => (
            VALID_LAYERS.includes(layer) && arr.indexOf(layer) === index
        ));
        return layers.length ? layers : ['transit'];
    }

    function sanitizeViewport(value) {
        const source = value && typeof value === 'object' ? value : {};
        const zoom = Number(source.zoom);
        const panX = Number(source.panX);
        const panY = Number(source.panY);
        return {
            zoom: Number.isFinite(zoom) ? Math.min(5, Math.max(0.5, zoom)) : 1,
            panX: Number.isFinite(panX) ? panX : 0,
            panY: Number.isFinite(panY) ? panY : 0,
        };
    }

    function sanitizePayload(payload, natalData) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const chartSignature = buildChartSignature(natalData);
        if (!chartSignature) return null;
        if (source.chartSignature && source.chartSignature !== chartSignature) return null;

        return {
            version: STORAGE_VERSION,
            chartSignature,
            savedAt: typeof source.savedAt === 'string' ? source.savedAt : '',
            targetDatetime: sanitizeTargetDatetime(source.targetDatetime),
            timezone: typeof source.timezone === 'string' ? source.timezone.trim() : '',
            location: source.location && typeof source.location === 'object' ? {
                name: typeof source.location.name === 'string' ? source.location.name : '',
                latitude: Number.isFinite(Number(source.location.latitude)) ? Number(source.location.latitude) : null,
                longitude: Number.isFinite(Number(source.location.longitude)) ? Number(source.location.longitude) : null,
            } : { name: '', latitude: null, longitude: null },
            activeLayers: sanitizeLayerList(source.activeLayers),
            selectedRightLayer: pickEnum(source.selectedRightLayer, VALID_LAYERS, 'transit'),
            stepMode: pickEnum(source.stepMode, VALID_STEP_MODES, 'hour'),
            leftTab: pickEnum(source.leftTab, VALID_TABS, 'Planets'),
            rightTab: pickEnum(source.rightTab, VALID_TABS, 'Planets'),
            matrixRows: source.matrixRows && typeof source.matrixRows === 'object' ? source.matrixRows : {},
            viewport: sanitizeViewport(source.viewport),
            pageSettings: source.pageSettings && typeof source.pageSettings === 'object' ? source.pageSettings : {},
        };
    }

    function buildPersistedState(input) {
        const payload = sanitizePayload(input?.state, input?.natalData);
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
        if (!parsed || parsed.version !== STORAGE_VERSION) return null;
        return sanitizePayload(parsed, natalData);
    }

    const api = {
        STORAGE_PREFIX,
        STORAGE_VERSION,
        buildChartSignature,
        buildStorageKey,
        buildPersistedState,
        parsePersistedState,
    };

    if (typeof window !== 'undefined') window.ForecastNewStateStorage = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();

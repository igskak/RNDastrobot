(function() {
    'use strict';

    const STORAGE_PREFIX = 'forecastNewViewState';
    const STORAGE_VERSION = 1;
    const MATRIX_SCHEMA_VERSION = 2;
    const VALID_LAYERS = ['transit', 'progression', 'direction', 'solar_return', 'synastry_partner'];
    const DEFAULT_DIRECTION_TYPE = 'zodiacal';
    const VALID_DIRECTION_TYPES = ['solar_arc', 'zodiacal', 'equatorial'];
    const VALID_STEP_MODES = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year'];
    const VALID_CUSTOM_STEP_UNITS = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year'];
    const VALID_TABS = ['Planets', 'Houses', 'Aspects', 'Grid', 'Configs', 'Balances', 'Rulers'];
    const VALID_RESULT_VIEWS = ['wheel', 'layers', 'aspects'];

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

    function normalizeDirectionType(value) {
        const normalized = String(value || '').trim();
        if (normalized === 'symbolic') return 'zodiacal';
        return VALID_DIRECTION_TYPES.includes(normalized) ? normalized : DEFAULT_DIRECTION_TYPE;
    }

    function sanitizeLayerList(value) {
        const source = Array.isArray(value) ? value : ['transit'];
        return source.filter((layer, index, arr) => (
            VALID_LAYERS.includes(layer) && arr.indexOf(layer) === index
        ));
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

    function sanitizeCustomStep(value) {
        const source = value && typeof value === 'object' ? value : {};
        const amount = Math.trunc(Number(source.amount));
        return {
            amount: Number.isFinite(amount) ? Math.min(9999, Math.max(1, amount)) : 1,
            unit: pickEnum(source.unit, VALID_CUSTOM_STEP_UNITS, 'day'),
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
            selectedRightLayer: pickEnum(source.selectedRightLayer, VALID_LAYERS, ''),
            directionType: normalizeDirectionType(source.directionType),
            stepMode: pickEnum(source.stepMode, VALID_STEP_MODES, 'hour'),
            customStep: sanitizeCustomStep(source.customStep),
            wheelView: pickEnum(source.wheelView, ['single', 'multi'], 'multi'),
            resultView: pickEnum(source.resultView, VALID_RESULT_VIEWS, 'wheel'),
            solarYear: (() => {
                const year = Number(source.solarYear);
                return Number.isFinite(year) && year >= 1900 && year <= 2100 ? Math.trunc(year) : null;
            })(),
            solarLocation: (() => {
                const loc = source.solarLocation;
                if (!loc || typeof loc !== 'object') return null;
                const lat = Number(loc.latitude);
                const lon = Number(loc.longitude);
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
                return { name: String(loc.name || ''), latitude: lat, longitude: lon, timezone: loc.timezone || null, sourceId: loc.sourceId || null };
            })(),
            synastryPartnerId: typeof source.synastryPartnerId === 'string' ? source.synastryPartnerId : '',
            leftTab: pickEnum(source.leftTab, VALID_TABS, 'Planets'),
            rightTab: pickEnum(source.rightTab, VALID_TABS, 'Planets'),
            matrixSchemaVersion: Number(source.matrixSchemaVersion) === MATRIX_SCHEMA_VERSION ? MATRIX_SCHEMA_VERSION : 1,
            natalMatrixRows: source.natalMatrixRows && typeof source.natalMatrixRows === 'object' ? source.natalMatrixRows : {},
            matrixRows: source.matrixRows && typeof source.matrixRows === 'object' ? source.matrixRows : {},
            viewport: sanitizeViewport(source.viewport),
            pageSettings: source.pageSettings && typeof source.pageSettings === 'object' ? source.pageSettings : {},
        };
    }

    function buildPersistedState(input) {
        const payload = sanitizePayload(input?.state, input?.natalData);
        if (!payload) return null;
        payload.savedAt = new Date().toISOString();
        payload.matrixSchemaVersion = MATRIX_SCHEMA_VERSION;
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
        MATRIX_SCHEMA_VERSION,
        buildChartSignature,
        buildStorageKey,
        buildPersistedState,
        parsePersistedState,
    };

    if (typeof window !== 'undefined') window.ForecastNewStateStorage = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();

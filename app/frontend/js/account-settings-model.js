(function (root, factory) {
    const api = factory();
    root.AccountSettingsModel = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const TECHNICAL_VIEW_IDS = ['natal', 'biwheel', 'forecast_new', 'solar'];

    function isRecord(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    function deepClone(value) {
        if (value === null || value === undefined) return value;
        return JSON.parse(JSON.stringify(value));
    }

    function deepMerge(base, patch) {
        const output = isRecord(base) ? deepClone(base) : {};
        Object.entries(patch || {}).forEach(([key, value]) => {
            output[key] = isRecord(value)
                ? deepMerge(output[key], value)
                : deepClone(value);
        });
        return output;
    }

    function buildUiChartDefaults(chartDefaults = {}, normalize = (value) => value || {}) {
        const forecast = chartDefaults?.forecast_new;
        const hasForecastSource = isRecord(forecast) && Object.keys(forecast).length > 0;
        return {
            single: normalize(chartDefaults?.natal || {}),
            double: normalize(hasForecastSource ? forecast : (chartDefaults?.biwheel || {})),
        };
    }

    function buildTechnicalChartDefaults(existing = {}, globalPatch = {}, singlePatch = {}, doublePatch = {}) {
        return Object.fromEntries(TECHNICAL_VIEW_IDS.map((viewId) => {
            const typePatch = viewId === 'natal' || viewId === 'solar' ? singlePatch : doublePatch;
            return [
                viewId,
                deepMerge(deepMerge(existing?.[viewId] || {}, globalPatch), typePatch),
            ];
        }));
    }

    return {
        TECHNICAL_VIEW_IDS,
        deepMerge,
        buildUiChartDefaults,
        buildTechnicalChartDefaults,
    };
});

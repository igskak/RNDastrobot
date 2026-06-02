/**
 * MethodologyRegistry — декларативный реестр методик (Фаза 2 плана, решение A6).
 *
 * Каждая запись объявляет ТОЛЬКО методико-специфичные поля запроса (Findings DX#2):
 * источник натала ({user_id} XOR {natal}) добавляет единый buildSourcePayload из
 * ChartSourcePanel — инвариант «ровно один источник» живёт в одном месте и зеркалит
 * backend-валидатор NatalSourceMixin. Нормализация ответа — PrognosticLayerNormalizer
 * (по умолчанию, ключ = method).
 *
 * Добавить методику = один объект: { endpoint, ringMethod, buildMethodologyPayload }.
 */
(function () {
    'use strict';

    const sourcePanel = (typeof module !== 'undefined' && typeof require === 'function')
        ? require('./chart-source-panel.js')
        : (typeof window !== 'undefined' ? window.ChartSourcePanel : null);
    const sourceUtils = (typeof module !== 'undefined' && typeof require === 'function')
        ? require('./forecast-source-utils.js')
        : (typeof window !== 'undefined' ? window.ForecastSourceUtils : null);

    function splitDt(value) {
        return sourceUtils.splitTargetDatetime(value);
    }

    const REGISTRY = {
        transit: {
            endpoint: '/transits/calculate',
            ringMethod: 'transit',
            targetInputVariant: 'datetime',
            buildMethodologyPayload(target) {
                const [date, time] = splitDt(target.datetime);
                return {
                    date,
                    time,
                    timezone: target.timezone || 'UTC',
                    location: target.location?.name || null,
                    latitude: target.location?.latitude ?? undefined,
                    longitude: target.location?.longitude ?? undefined,
                };
            },
        },
        progression: {
            endpoint: '/progressions/calculate',
            ringMethod: 'progression',
            targetInputVariant: 'datetime',
            buildMethodologyPayload(target) {
                const [date, time] = splitDt(target.datetime);
                return {
                    target_date: date,
                    target_time: time,
                    timezone: target.timezone || 'UTC',
                    save_to_db: false,
                };
            },
        },
        direction: {
            endpoint: '/directions/calculate',
            ringMethod: 'direction',
            targetInputVariant: 'datetime',
            buildMethodologyPayload(target, opts = {}) {
                const [date] = splitDt(target.datetime);
                return {
                    target_date: date,
                    direction_type: opts.directionType || 'zodiacal',
                    save_to_db: false,
                };
            },
        },
        solar_return: {
            endpoint: '/solar/calculate',
            ringMethod: 'solar_return',
            targetInputVariant: 'year',
            buildMethodologyPayload(target) {
                return {
                    year: target.year,
                    save_to_db: false,
                    location_latitude: target.location?.latitude ?? undefined,
                    location_longitude: target.location?.longitude ?? undefined,
                    location_name: target.location?.name || undefined,
                    location_timezone: target.timezone || undefined,
                };
            },
        },
    };

    function listMethods() {
        return Object.keys(REGISTRY);
    }

    function getEntry(method) {
        const entry = REGISTRY[method];
        if (!entry) throw new Error(`Unknown methodology: ${method}`);
        return entry;
    }

    /**
     * Собрать запрос слоя: { endpoint, ringMethod, body }.
     * body = источник натала (user_id XOR natal) + методико-специфичные поля.
     */
    function buildLayerRequest(method, sourceSnapshot, targetSnapshot, opts = {}) {
        const entry = getEntry(method);
        return {
            endpoint: entry.endpoint,
            ringMethod: entry.ringMethod,
            body: {
                ...sourcePanel.buildSourcePayload(sourceSnapshot),
                ...entry.buildMethodologyPayload(targetSnapshot, opts),
            },
        };
    }

    const api = { REGISTRY, listMethods, getEntry, buildLayerRequest };

    if (typeof window !== 'undefined') window.MethodologyRegistry = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();

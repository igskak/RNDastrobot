/**
 * Shared helpers for timeline range normalization and event filtering.
 * Exposes `window.ForecastTimelineUtils` in browser and `module.exports` in Node.
 */
(function() {
    'use strict';

    function parseDayStartMs(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return NaN;
        const ms = new Date(`${dateStr}T00:00:00`).getTime();
        return Number.isFinite(ms) ? ms : NaN;
    }

    function parseDayEndMs(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return NaN;
        const ms = new Date(`${dateStr}T23:59:59.999`).getTime();
        return Number.isFinite(ms) ? ms : NaN;
    }

    function buildTimelineRange(startDate, endDate) {
        const startMs = parseDayStartMs(startDate);
        const endMs = parseDayEndMs(endDate);
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
            return null;
        }
        return {
            startMs,
            endMs,
            totalMs: endMs - startMs,
        };
    }

    function normalizeTimelineEvents(rawEvents, startDate, endDate) {
        const range = buildTimelineRange(startDate, endDate);
        if (!range) {
            return {
                events: [],
                dropped: { invalid: 0, outOfRange: 0 },
                range: null,
            };
        }

        const result = [];
        let invalid = 0;
        let outOfRange = 0;

        (rawEvents || []).forEach((ev) => {
            const enterMs = new Date(ev?.t_enter).getTime();
            const exactMs = new Date(ev?.t_exact).getTime();
            const leaveMs = new Date(ev?.t_leave).getTime();

            if (!Number.isFinite(enterMs) || !Number.isFinite(exactMs) || !Number.isFinite(leaveMs)) {
                invalid += 1;
                return;
            }

            const spanStart = Math.min(enterMs, leaveMs);
            const spanEnd = Math.max(enterMs, leaveMs);

            if (spanEnd < range.startMs || spanStart > range.endMs) {
                outOfRange += 1;
                return;
            }

            result.push({
                ...ev,
                _enterMs: enterMs,
                _exactMs: exactMs,
                _leaveMs: leaveMs,
            });
        });

        return {
            events: result,
            dropped: { invalid, outOfRange },
            range,
        };
    }

    function buildTimelineRowKey(ev) {
        return `${ev?.transit_body || ''}|${ev?.aspect_type || ''}|${ev?.natal_body || ''}`;
    }

    function countTimelineRows(events) {
        const keys = new Set();
        (events || []).forEach((ev) => {
            keys.add(buildTimelineRowKey(ev));
        });
        return keys.size;
    }

    const api = {
        buildTimelineRange,
        normalizeTimelineEvents,
        buildTimelineRowKey,
        countTimelineRows,
    };

    if (typeof window !== 'undefined') {
        window.ForecastTimelineUtils = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})();

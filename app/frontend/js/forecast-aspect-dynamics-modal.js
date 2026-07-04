/**
 * ForecastAspectDynamicsModal
 *
 * Opens a ZET-like signed-orb graph for one aspect in forecast-new layers.
 * The browser receives graph-ready values from /transits/aspect-dynamics;
 * no astrological calculations are duplicated here.
 */
(function (rootFactory) {
    const root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
    const api = rootFactory(root);

    if (typeof window !== 'undefined') {
        window.ForecastAspectDynamicsModal = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(function (root) {
    'use strict';

    const DEFAULT_MAX_POINTS = 320;
    const PREVIEW_MAX_POINTS = 96;
    const FULL_WINDOW_DAYS = 36525;
    const MIN_WINDOW_DAYS = 3;
    const MAX_WINDOW_DAYS = 36525;
    const CLIENT_CACHE_MAX_ITEMS = 24;
    const DAY_MS = 86400000;
    const WINDOW_REQUEST_DEBOUNCE_MS = 110;
    const WHEEL_REQUEST_DEBOUNCE_MS = 90;
    const DRAG_ACTIVATION_PX = 4;
    const WHEEL_ZOOM_SENSITIVITY = 0.00075;
    const API_BASE = () => root.AstroAPI?.API_BASE_URL || '/api/v1';

    const state = {
        overlay: null,
        dialog: null,
        canvas: null,
        overviewCanvas: null,
        chartWrap: null,
        status: null,
        summary: null,
        title: null,
        subtitle: null,
        closeButton: null,
        toolbar: null,
        scrubber: null,
        data: null,
        lastFocus: null,
        resizeObserver: null,
        fetchImpl: null,
        basePayload: null,
        requestSeq: 0,
        responseCache: new Map(),
        dragStart: null,
        interactionWindow: null,
        defaultViewWindow: null,
        pendingWindowTimer: null,
        scrollDomain: null,
        isLoading: false,
        hoverMs: null,
        hoverFrame: null,
    };

    function tr(key, fallback, params) {
        const value = root.FrontendI18n?.t?.(key, params);
        return value && value !== key ? value : fallback;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttr(value) {
        return escapeHtml(value);
    }

    function normalizeTime(value) {
        const raw = String(value || '').trim();
        if (!raw) return '12:00:00';
        const clean = raw.replace(/Z$/, '').split(/[+-]\d{2}:?\d{2}$/)[0];
        const parts = clean.split(':');
        const hh = parts[0] || '12';
        const mm = parts[1] || '00';
        const ss = parts[2] || '00';
        return [hh, mm, ss].map((part) => String(part).padStart(2, '0').slice(0, 2)).join(':');
    }

    function splitSelectedDateTime(selectedDateTime) {
        const raw = String(selectedDateTime || '').trim();
        if (!raw) {
            const now = new Date();
            return {
                date: now.toISOString().slice(0, 10),
                time: '12:00:00',
            };
        }
        if (raw.includes('T')) {
            const [datePart, timePart] = raw.split('T');
            return {
                date: datePart,
                time: normalizeTime(timePart),
            };
        }
        return {
            date: raw.slice(0, 10),
            time: '12:00:00',
        };
    }

    function aspectSourceBody(aspect) {
        return aspect?.source_body
            || aspect?.transit_planet
            || aspect?.progressed_planet
            || aspect?.directed_object
            || aspect?.solar_planet
            || aspect?.planet_1
            || aspect?.left_planet
            || '';
    }

    function aspectTargetBody(aspect) {
        return aspect?.target_body
            || aspect?.natal_object
            || aspect?.planet_2
            || aspect?.right_planet
            || '';
    }

    function normalizeSource(source, fallbackUserId) {
        if (source?.natal) return { natal: source.natal };
        if (source?.user_id) return { user_id: source.user_id };
        if (source?.userId) return { user_id: source.userId };
        return fallbackUserId ? { user_id: fallbackUserId } : {};
    }

    function buildPayload(options = {}) {
        const aspect = options.aspect || {};
        const selected = splitSelectedDateTime(options.selectedDateTime);
        const sourceBody = options.sourceBody || aspectSourceBody(aspect);
        const targetBody = options.targetBody || aspectTargetBody(aspect);
        const method = options.method || aspect.method || 'transit';
        const source = normalizeSource(options.natalSource || options.source, options.userId);
        const payload = {
            ...source,
            method,
            source_body: sourceBody,
            target_body: targetBody,
            transit_body: sourceBody,
            natal_body: targetBody,
            aspect_type: aspect.aspect_type,
            selected_date: selected.date,
            selected_time: selected.time,
            timezone: options.timezone || 'UTC',
            max_points: options.maxPoints || DEFAULT_MAX_POINTS,
        };
        if (options.partnerSource) payload.partner = normalizeSource(options.partnerSource);
        if (options.directionType) payload.direction_type = options.directionType;
        if (options.solarYear) payload.solar_year = Number(options.solarYear);
        if (options.solarLocation?.latitude != null && options.solarLocation?.longitude != null) {
            payload.solar_location_latitude = options.solarLocation.latitude;
            payload.solar_location_longitude = options.solarLocation.longitude;
            if (options.solarLocation.timezone) payload.solar_location_timezone = options.solarLocation.timezone;
        }
        if (options.contactStart && options.contactEnd) {
            payload.contact_start = options.contactStart;
            payload.contact_end = options.contactEnd;
        }
        return payload;
    }

    function validatePayload(payload) {
        return Boolean(
            payload?.user_id
            || payload?.natal
        ) && Boolean(
            payload?.source_body
            && payload?.target_body
            && payload?.aspect_type
            && payload?.selected_date
            && payload?.selected_time
            && payload?.timezone
        ) && (payload.method !== 'synastry_partner' || Boolean(payload.partner));
    }

    function stableJson(value) {
        if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
        if (value && typeof value === 'object') {
            return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
        }
        return JSON.stringify(value);
    }

    function payloadCacheKey(payload) {
        return stableJson(payload);
    }

    function setCachedResponse(key, data) {
        if (!key) return;
        state.responseCache.set(key, data);
        while (state.responseCache.size > CLIENT_CACHE_MAX_ITEMS) {
            const oldest = state.responseCache.keys().next().value;
            state.responseCache.delete(oldest);
        }
    }

    function toDateOnly(ms) {
        return new Date(ms).toISOString().slice(0, 10);
    }

    function startOfDayMs(ms) {
        const date = new Date(ms);
        if (Number.isNaN(date.getTime())) return ms;
        return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    }

    function msFromIso(value) {
        const ms = new Date(value).getTime();
        return Number.isFinite(ms) ? ms : null;
    }

    function committedDataWindowMs(data = state.data) {
        const start = msFromIso(data?.effective_window?.start)
            ?? msFromIso(data?.series?.[0]?.datetime);
        const end = msFromIso(data?.effective_window?.end)
            ?? msFromIso(data?.series?.[data?.series?.length - 1]?.datetime);
        return Number.isFinite(start) && Number.isFinite(end) && end > start
            ? { start, end }
            : null;
    }

    function dataWindowMs(data = state.data) {
        const active = state.interactionWindow;
        if (Number.isFinite(active?.start) && Number.isFinite(active?.end) && active.end > active.start) {
            return { start: active.start, end: active.end };
        }
        return committedDataWindowMs(data);
    }

    function selectedMs(data = state.data) {
        return msFromIso(data?.selected_point?.datetime)
            ?? msFromIso(`${state.basePayload?.selected_date || ''}T${state.basePayload?.selected_time || '12:00:00'}`);
    }

    function windowPayload(startMs, endMs) {
        const start = Math.min(startMs, endMs);
        const end = Math.max(startMs, endMs);
        return {
            ...state.basePayload,
            preview: false,
            max_points: maxPointsForWindow(start, end),
            contact_start: toDateOnly(start),
            contact_end: toDateOnly(end),
        };
    }

    function fullWindowPayload(payload) {
        const anchor = selectedMsForPayload(payload) || Date.now();
        const halfSpan = (FULL_WINDOW_DAYS * DAY_MS) / 2;
        return {
            ...payload,
            preview: false,
            max_points: maxPointsForWindow(anchor - halfSpan, anchor + halfSpan),
            contact_start: toDateOnly(startOfDayMs(anchor - halfSpan)),
            contact_end: toDateOnly(startOfDayMs(anchor + halfSpan)),
        };
    }

    function selectedMsForPayload(payload) {
        return msFromIso(`${payload?.selected_date || ''}T${payload?.selected_time || '12:00:00'}`);
    }

    function previewPayload(payload) {
        const {
            contact_start: _contactStart,
            contact_end: _contactEnd,
            ...base
        } = payload || {};
        return {
            ...base,
            preview: true,
            max_points: Math.min(Number(base.max_points || DEFAULT_MAX_POINTS), PREVIEW_MAX_POINTS),
        };
    }

    function maxPointsForWindow(startMs, endMs) {
        const base = Number(state.basePayload?.max_points || DEFAULT_MAX_POINTS);
        const days = Math.abs(endMs - startMs) / 86400000;
        if (days >= 3650) return Math.max(base, 720);
        if (days >= 365) return Math.max(base, 520);
        if (days >= 60) return Math.max(base, 420);
        return Math.max(base, 320);
    }

    function clampWindow(startMs, endMs) {
        const center = (startMs + endMs) / 2;
        const minSpan = MIN_WINDOW_DAYS * 86400000;
        const maxSpan = MAX_WINDOW_DAYS * 86400000;
        let span = Math.max(minSpan, Math.min(Math.abs(endMs - startMs), maxSpan));
        return {
            start: center - span / 2,
            end: center + span / 2,
        };
    }

    async function fetchAndRender(payload, { keepStatus = false, preserveViewport = false } = {}) {
        const seq = ++state.requestSeq;
        if (!keepStatus) renderLoading();
        const key = payloadCacheKey(payload);
        if (state.responseCache.has(key)) {
            renderData(state.responseCache.get(key), { preserveViewport });
            return state.data;
        }
        try {
            const data = await postJson('/transits/aspect-dynamics', payload);
            if (seq !== state.requestSeq) return null;
            setCachedResponse(key, data);
            renderData(data, { preserveViewport });
            return data;
        } catch (error) {
            if (seq !== state.requestSeq) return null;
            renderError(error?.message || tr('page.forecastNew.aspectDynamics.errors.loadFailed', 'Could not load aspect dynamics.'));
            return null;
        }
    }

    async function fetchPreviewThenFull(payload) {
        const seq = ++state.requestSeq;
        renderLoading();
        const previewRequest = previewPayload(payload);
        const previewKey = payloadCacheKey(previewRequest);
        const fullRequest = fullWindowPayload(payload);
        const fullKey = payloadCacheKey(fullRequest);
        if (state.responseCache.has(fullKey)) {
            renderData(state.responseCache.get(fullKey));
            return state.data;
        }
        let previewData = null;
        try {
            previewData = state.responseCache.get(previewKey);
            if (!previewData) {
                previewData = await postJson('/transits/aspect-dynamics', previewRequest);
                setCachedResponse(previewKey, previewData);
            }
        } catch (error) {
            if (seq !== state.requestSeq) return null;
            renderError(error?.message || tr('page.forecastNew.aspectDynamics.errors.loadFailed', 'Could not load aspect dynamics.'));
            return null;
        }
        if (seq !== state.requestSeq) return null;
        renderData(previewData);

        try {
            const fullData = await postJson('/transits/aspect-dynamics', fullRequest);
            if (seq !== state.requestSeq) return null;
            setCachedResponse(fullKey, fullData);
            renderData(fullData, { preserveViewport: true });
            return fullData;
        } catch (error) {
            if (seq !== state.requestSeq) return null;
            state.isLoading = false;
            state.status.hidden = false;
            state.status.className = 'aspect-dynamics-status aspect-dynamics-status--error';
            state.status.textContent = error?.message || tr('page.forecastNew.aspectDynamics.errors.loadFailed', 'Could not load aspect dynamics.');
            drawChart();
            return state.data;
        }
    }

    function setInteractionWindow(window) {
        if (!window) {
            state.interactionWindow = null;
            return;
        }
        state.interactionWindow = {
            start: window.start,
            end: window.end,
        };
        updateRangeLabel();
        syncScrubber();
        drawChart();
    }

    function requestWindow(startMs, endMs, { debounce = false, debounceMs = WINDOW_REQUEST_DEBOUNCE_MS } = {}) {
        if (!state.basePayload) return;
        const bounded = clampWindow(startMs, endMs);
        setInteractionWindow(bounded);
        if (!shouldFetchWindow(bounded)) return;
        const run = () => {
            state.pendingWindowTimer = null;
            void fetchAndRender(expandedWindowPayload(bounded), { keepStatus: true, preserveViewport: true });
        };
        if (!debounce) {
            clearTimeout(state.pendingWindowTimer);
            run();
            return;
        }
        clearTimeout(state.pendingWindowTimer);
        state.pendingWindowTimer = setTimeout(run, debounceMs);
    }

    function loadedDataWindowMs(data = state.data) {
        return committedDataWindowMs(data);
    }

    function shouldFetchWindow(window) {
        const loaded = loadedDataWindowMs();
        if (!loaded || !window) return true;
        if (window.start >= loaded.start && window.end <= loaded.end) return false;
        const span = loaded.end - loaded.start;
        const margin = Math.max(DAY_MS, span * 0.03);
        return window.start < loaded.start + margin || window.end > loaded.end - margin;
    }

    function expandedWindowPayload(window) {
        const span = Math.max(MIN_WINDOW_DAYS * DAY_MS, window.end - window.start);
        const center = (window.start + window.end) / 2;
        const targetSpan = Math.min(MAX_WINDOW_DAYS * DAY_MS, Math.max(span * 4, 3650 * DAY_MS));
        return windowPayload(center - targetSpan / 2, center + targetSpan / 2);
    }

    function chartPad() {
        return { left: 42, right: 18, top: 20, bottom: 30 };
    }

    function elementInnerWidth(element, fallback) {
        const raw = Number(element?.clientWidth || fallback || 0);
        const styles = element && typeof root.getComputedStyle === 'function'
            ? root.getComputedStyle(element)
            : null;
        const padding = styles
            ? (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0)
            : 0;
        return Math.max(320, Math.floor(raw - padding));
    }

    function eventAnchorMs(event) {
        const current = dataWindowMs();
        const canvas = state.canvas;
        if (!current || !canvas || !event) return null;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return null;
        const pad = chartPad();
        const plotW = Math.max(1, rect.width - pad.left - pad.right);
        const ratio = Math.max(
            0,
            Math.min(1, (event.clientX - rect.left - pad.left) / plotW),
        );
        return current.start + ratio * (current.end - current.start);
    }

    function scheduleHoverDraw() {
        if (typeof root.requestAnimationFrame !== 'function') {
            drawChart();
            return;
        }
        if (state.hoverFrame) return;
        state.hoverFrame = root.requestAnimationFrame(() => {
            state.hoverFrame = null;
            drawChart();
        });
    }

    function cancelHoverDraw() {
        if (state.hoverFrame && typeof root.cancelAnimationFrame === 'function') {
            root.cancelAnimationFrame(state.hoverFrame);
        }
        state.hoverFrame = null;
    }

    function updateHoverMarker(event) {
        const ms = eventAnchorMs(event);
        if (!Number.isFinite(ms)) return;
        if (Number.isFinite(state.hoverMs) && Math.abs(state.hoverMs - ms) < 1000) return;
        state.hoverMs = ms;
        scheduleHoverDraw();
    }

    function clearHoverMarker() {
        if (!Number.isFinite(state.hoverMs)) return;
        state.hoverMs = null;
        scheduleHoverDraw();
    }

    function zoom(factor, anchorMs = null, options = {}) {
        const current = dataWindowMs();
        if (!current) return;
        const anchor = anchorMs || selectedMs() || ((current.start + current.end) / 2);
        const span = (current.end - current.start) * factor;
        const leftRatio = (anchor - current.start) / (current.end - current.start || 1);
        requestWindow(anchor - span * leftRatio, anchor + span * (1 - leftRatio), options);
    }

    function pan(ratio) {
        const current = dataWindowMs();
        if (!current) return;
        const shift = (current.end - current.start) * ratio;
        requestWindow(current.start + shift, current.end + shift);
    }

    function preset(days) {
        const anchor = selectedMs() || Date.now();
        const span = Math.max(MIN_WINDOW_DAYS, Math.min(days, MAX_WINDOW_DAYS)) * 86400000;
        requestWindow(anchor - span / 2, anchor + span / 2);
    }

    function updateRangeLabel(data = state.data) {
        if (!state.toolbar) return;
        const label = state.toolbar.querySelector('.aspect-dynamics-range-label');
        const current = dataWindowMs(data);
        if (!label || !current) return;
        label.textContent = [
            `${formatDateShort(current.start)} - ${formatDateShort(current.end)}`,
            formatSpanLabel(current.end - current.start),
            `${(data?.series || []).length} pts`,
        ].filter(Boolean).join(' · ');
    }

    function ensureScrollDomain(current) {
        if (!current) return null;
        const span = Math.max(MIN_WINDOW_DAYS * DAY_MS, current.end - current.start);
        const center = (current.start + current.end) / 2;
        const existing = state.scrollDomain;
        const changedScale = existing?.windowSpan
            ? Math.abs(existing.windowSpan - span) / Math.max(span, 1) > 0.25
            : true;
        if (!existing || changedScale || current.start < existing.start || current.end > existing.end) {
            const anchor = selectedMs() || center;
            const domainSpan = Math.max(span * 5, 3650 * DAY_MS);
            const domainCenter = current.start < existing?.start || current.end > existing?.end
                ? center
                : anchor;
            state.scrollDomain = {
                start: domainCenter - domainSpan / 2,
                end: domainCenter + domainSpan / 2,
                windowSpan: span,
            };
        }
        return state.scrollDomain;
    }

    function syncScrubber(data = state.data) {
        if (!state.scrubber) return;
        const current = dataWindowMs(data);
        if (!current) {
            state.scrubber.disabled = true;
            state.scrubber.value = '500';
            state.scrubber.style.removeProperty('--aspect-dynamics-scroll-pos');
            return;
        }
        const domain = ensureScrollDomain(current);
        if (!domain || domain.end <= domain.start) return;
        const center = (current.start + current.end) / 2;
        const ratio = Math.max(0, Math.min(1, (center - domain.start) / (domain.end - domain.start)));
        state.scrubber.disabled = false;
        state.scrubber.value = String(Math.round(ratio * 1000));
        state.scrubber.style.setProperty('--aspect-dynamics-scroll-pos', `${ratio * 100}%`);
    }

    function onScrubberInput(event) {
        const input = event.target;
        const current = dataWindowMs();
        const domain = ensureScrollDomain(current);
        if (!current || !domain || domain.end <= domain.start) return;
        const ratio = Math.max(0, Math.min(1, Number(input.value || 0) / 1000));
        const span = current.end - current.start;
        const center = domain.start + (domain.end - domain.start) * ratio;
        requestWindow(center - span / 2, center + span / 2, { debounce: true });
    }

    function onToolbarClick(event) {
        const button = event.target.closest('button');
        if (!button) return;
        const zoomAction = button.dataset.aspectDynamicsZoom;
        const panAction = button.dataset.aspectDynamicsPan;
        const range = button.dataset.aspectDynamicsRange;
        if (zoomAction === 'in') zoom(0.5);
        else if (zoomAction === 'out') zoom(2);
        else if (zoomAction === 'reset') resetViewWindow();
        else if (panAction) pan(Number(panAction));
        else if (range) preset(Number(range));
    }

    function onCanvasWheel(event) {
        if (!state.data) return;
        event.preventDefault();
        const delta = normalizeWheelDelta(event);
        if (!Number.isFinite(delta) || delta === 0) return;
        zoom(Math.exp(delta * WHEEL_ZOOM_SENSITIVITY), eventAnchorMs(event), {
            debounce: true,
            debounceMs: WHEEL_REQUEST_DEBOUNCE_MS,
        });
    }

    function normalizeWheelDelta(event) {
        const raw = Math.abs(Number(event.deltaX || 0)) > Math.abs(Number(event.deltaY || 0))
            ? Number(event.deltaX || 0)
            : Number(event.deltaY || 0);
        if (event.deltaMode === 1) return raw * 16;
        if (event.deltaMode === 2) return raw * Math.max(240, state.canvas?.clientWidth || 720);
        return raw;
    }

    function dragWindowForEvent(event, drag = state.dragStart) {
        if (!drag?.window) return null;
        const width = Math.max(240, state.canvas?.clientWidth || state.chartWrap?.clientWidth || 720);
        const dx = event.clientX - drag.x;
        const span = drag.window.end - drag.window.start;
        const shift = -(dx / width) * span;
        return clampWindow(drag.window.start + shift, drag.window.end + shift);
    }

    function onCanvasPointerDown(event) {
        if (!state.data) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        updateHoverMarker(event);
        state.dragStart = {
            x: event.clientX,
            window: dataWindowMs(),
            moved: false,
        };
        state.chartWrap?.classList.add('is-dragging');
        state.chartWrap?.setPointerCapture?.(event.pointerId);
        event.preventDefault();
    }

    function onCanvasPointerMove(event) {
        const drag = state.dragStart;
        if (!drag?.window) {
            updateHoverMarker(event);
            return;
        }
        event.preventDefault();
        const dx = event.clientX - drag.x;
        if (!drag.moved && Math.abs(dx) < DRAG_ACTIVATION_PX) {
            updateHoverMarker(event);
            return;
        }
        drag.moved = true;
        const next = dragWindowForEvent(event, drag);
        if (!next) return;
        requestWindow(next.start, next.end, {
            debounce: true,
        });
        updateHoverMarker(event);
    }

    function onCanvasPointerUp(event) {
        if (!state.dragStart?.window) {
            state.dragStart = null;
            state.chartWrap?.classList.remove('is-dragging');
            return;
        }
        const drag = state.dragStart;
        const next = dragWindowForEvent(event, drag);
        state.dragStart = null;
        state.chartWrap?.classList.remove('is-dragging');
        state.chartWrap?.releasePointerCapture?.(event.pointerId);
        if (next && (drag.moved || Math.abs(event.clientX - drag.x) > DRAG_ACTIVATION_PX)) {
            requestWindow(next.start, next.end);
        }
        updateHoverMarker(event);
    }

    function resetViewWindow() {
        const next = state.defaultViewWindow || initialViewWindow(state.data) || loadedDataWindowMs();
        if (!next) return;
        setInteractionWindow(next);
    }

    function onCanvasPointerCancel() {
        clearTimeout(state.pendingWindowTimer);
        state.pendingWindowTimer = null;
        state.dragStart = null;
        state.chartWrap?.classList.remove('is-dragging');
        clearHoverMarker();
    }

    function onCanvasPointerLeave() {
        if (state.dragStart?.window) return;
        clearHoverMarker();
    }

    function getFetch() {
        return state.fetchImpl || root.fetch?.bind(root);
    }

    async function postJson(path, payload) {
        const fetchFn = getFetch();
        if (!fetchFn) {
            throw new Error(tr('page.forecastNew.aspectDynamics.errors.fetchUnavailable', 'Network is unavailable.'));
        }
        const headers = root.AstroAPI?.withLocaleHeaders
            ? root.AstroAPI.withLocaleHeaders({ 'Content-Type': 'application/json' })
            : { 'Content-Type': 'application/json' };
        const response = await fetchFn(`${API_BASE()}${path}`, {
            method: 'POST',
            credentials: 'include',
            headers,
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            let message = `HTTP ${response.status}`;
            try {
                const data = await response.json();
                message = data?.detail || data?.message || message;
            } catch {
                message = await response.text().catch(() => message);
            }
            throw new Error(message);
        }
        return response.json();
    }

    function ensureModal() {
        if (state.overlay || typeof document === 'undefined') return state.overlay;

        const overlay = document.createElement('div');
        overlay.className = 'aspect-dynamics-modal hidden';
        overlay.innerHTML = `
            <div class="aspect-dynamics-backdrop" data-aspect-dynamics-close></div>
            <section class="aspect-dynamics-dialog" role="dialog" aria-modal="true" aria-labelledby="aspectDynamicsTitle" tabindex="-1">
                <header class="aspect-dynamics-header">
                    <div class="aspect-dynamics-heading">
                        <h2 id="aspectDynamicsTitle"></h2>
                        <p class="aspect-dynamics-subtitle"></p>
                    </div>
                    <button type="button" class="aspect-dynamics-close" data-aspect-dynamics-close aria-label="${escapeAttr(tr('common.close', 'Close'))}">x</button>
                </header>
                <div class="aspect-dynamics-status" role="status"></div>
                <div class="aspect-dynamics-toolbar" aria-label="${escapeAttr(tr('page.forecastNew.aspectDynamics.toolbar', 'Chart controls'))}">
                    <button type="button" data-aspect-dynamics-pan="-0.5" title="${escapeAttr(tr('common.previous', 'Previous'))}">←</button>
                    <button type="button" data-aspect-dynamics-zoom="in" title="${escapeAttr(tr('page.forecastNew.aspectDynamics.zoomIn', 'Zoom in'))}">+</button>
                    <button type="button" data-aspect-dynamics-zoom="out" title="${escapeAttr(tr('page.forecastNew.aspectDynamics.zoomOut', 'Zoom out'))}">−</button>
                    <button type="button" data-aspect-dynamics-pan="0.5" title="${escapeAttr(tr('common.next', 'Next'))}">→</button>
                    <button type="button" data-aspect-dynamics-zoom="reset" title="${escapeAttr(tr('page.forecastNew.aspectDynamics.resetZoom', 'Reset zoom'))}">⟲</button>
                    <span class="aspect-dynamics-toolbar-divider"></span>
                    <button type="button" data-aspect-dynamics-range="30">1M</button>
                    <button type="button" data-aspect-dynamics-range="365">1Y</button>
                    <button type="button" data-aspect-dynamics-range="3650">10Y</button>
                    <button type="button" data-aspect-dynamics-range="36525">100Y</button>
                    <span class="aspect-dynamics-range-label"></span>
                </div>
                <div class="aspect-dynamics-chart-wrap">
                    <canvas class="aspect-dynamics-canvas" width="720" height="320"></canvas>
                </div>
                <div class="aspect-dynamics-scroll-wrap">
                    <canvas class="aspect-dynamics-overview-canvas" width="720" height="54" aria-hidden="true"></canvas>
                    <input class="aspect-dynamics-scrollbar" type="range" min="0" max="1000" value="500" step="1" aria-label="${escapeAttr(tr('page.forecastNew.aspectDynamics.toolbar', 'Chart controls'))}">
                </div>
                <div class="aspect-dynamics-legend" aria-hidden="true">
                    <span><i class="aspect-dynamics-legend-line aspect-dynamics-legend-line--orb"></i>${escapeHtml(tr('page.forecastNew.aspectDynamics.legend.orb', 'signed orb'))}</span>
                    <span><i class="aspect-dynamics-legend-line aspect-dynamics-legend-line--selected"></i>${escapeHtml(tr('page.forecastNew.aspectDynamics.legend.selected', 'selected date'))}</span>
                    <span><i class="aspect-dynamics-legend-line aspect-dynamics-legend-line--exact"></i>${escapeHtml(tr('page.forecastNew.aspectDynamics.legend.exact', 'exact aspect'))}</span>
                </div>
                <div class="aspect-dynamics-summary"></div>
            </section>
        `;
        document.body.appendChild(overlay);

        state.overlay = overlay;
        state.dialog = overlay.querySelector('.aspect-dynamics-dialog');
        state.canvas = overlay.querySelector('.aspect-dynamics-canvas');
        state.overviewCanvas = overlay.querySelector('.aspect-dynamics-overview-canvas');
        state.status = overlay.querySelector('.aspect-dynamics-status');
        state.summary = overlay.querySelector('.aspect-dynamics-summary');
        state.title = overlay.querySelector('#aspectDynamicsTitle');
        state.subtitle = overlay.querySelector('.aspect-dynamics-subtitle');
        state.closeButton = overlay.querySelector('.aspect-dynamics-close');
        state.toolbar = overlay.querySelector('.aspect-dynamics-toolbar');
        state.chartWrap = overlay.querySelector('.aspect-dynamics-chart-wrap');
        state.scrubber = overlay.querySelector('.aspect-dynamics-scrollbar');

        overlay.addEventListener('click', (event) => {
            if (event.target.closest('[data-aspect-dynamics-close]')) close();
        });
        state.toolbar?.addEventListener('click', onToolbarClick);
        state.chartWrap?.addEventListener('wheel', onCanvasWheel, { passive: false });
        state.chartWrap?.addEventListener('pointerdown', onCanvasPointerDown);
        state.chartWrap?.addEventListener('pointermove', onCanvasPointerMove);
        state.chartWrap?.addEventListener('pointerup', onCanvasPointerUp);
        state.chartWrap?.addEventListener('pointercancel', onCanvasPointerCancel);
        state.chartWrap?.addEventListener('pointerleave', onCanvasPointerLeave);
        state.scrubber?.addEventListener('input', onScrubberInput);

        if (typeof ResizeObserver !== 'undefined') {
            state.resizeObserver = new ResizeObserver(() => drawChart());
            if (state.chartWrap) state.resizeObserver.observe(state.chartWrap);
        } else if (typeof root.addEventListener === 'function') {
            root.addEventListener('resize', drawChart);
        }

        return overlay;
    }

    function setOpen(isOpen) {
        if (!state.overlay) return;
        state.overlay.classList.toggle('hidden', !isOpen);
        document.body.classList.toggle('aspect-dynamics-open', isOpen);
        if (isOpen) {
            document.addEventListener('keydown', onKeyDown);
            state.dialog?.focus?.();
        } else {
            document.removeEventListener('keydown', onKeyDown);
        }
    }

    function close() {
        clearTimeout(state.pendingWindowTimer);
        state.pendingWindowTimer = null;
        cancelHoverDraw();
        state.hoverMs = null;
        setOpen(false);
        const focusTarget = state.lastFocus;
        state.lastFocus = null;
        if (focusTarget && typeof focusTarget.focus === 'function') {
            focusTarget.focus();
        }
    }

    function onKeyDown(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
            return;
        }
        if (event.key !== 'Tab' || !state.dialog) return;
        const focusables = [...state.dialog.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )].filter((node) => !node.disabled && node.offsetParent !== null);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function bodyLabel(name) {
        const normalized = root.Symbols?.normalizeBodyName?.(name) || name;
        const key = `astro.planet.${normalized}`;
        const translated = root.FrontendI18n?.t?.(key);
        return translated && translated !== key
            ? translated
            : (root.Symbols?.getPlanetNameRu?.(normalized) || root.Symbols?.planetNamesRu?.[normalized] || normalized);
    }

    function aspectLabel(name) {
        const key = `astro.aspect.${name}`;
        const translated = root.FrontendI18n?.t?.(key);
        return translated && translated !== key
            ? translated
            : (root.Symbols?.aspectNamesRu?.[name] || name);
    }

    function aspectTitle(payload) {
        const transitSymbol = root.Symbols?.getPlanetSymbol?.(payload.transit_body) || payload.transit_body;
        const natalSymbol = root.Symbols?.getPlanetSymbol?.(payload.natal_body) || payload.natal_body;
        const aspectSymbol = root.Symbols?.getAspectDisplay?.(payload.aspect_type)
            || root.Symbols?.aspects?.[payload.aspect_type]
            || payload.aspect_type;
        return `${transitSymbol} ${aspectSymbol} ${natalSymbol}`;
    }

    function renderShell(payload) {
        if (!state.title || !state.subtitle) return;
        state.title.textContent = aspectTitle(payload);
        state.subtitle.textContent = [
            bodyLabel(payload.transit_body),
            aspectLabel(payload.aspect_type),
            bodyLabel(payload.natal_body),
        ].filter(Boolean).join(' ');
    }

    function renderLoading() {
        state.data = null;
        state.interactionWindow = null;
        state.defaultViewWindow = null;
        state.isLoading = true;
        state.hoverMs = null;
        state.status.hidden = false;
        state.status.className = 'aspect-dynamics-status';
        state.status.textContent = tr('page.forecastNew.aspectDynamics.loading', 'Loading chart...');
        state.summary.innerHTML = '';
        syncScrubber(null);
        drawChart();
    }

    function renderError(message) {
        state.data = null;
        state.interactionWindow = null;
        state.defaultViewWindow = null;
        state.isLoading = false;
        state.hoverMs = null;
        state.status.hidden = false;
        state.status.className = 'aspect-dynamics-status aspect-dynamics-status--error';
        state.status.textContent = message || tr('page.forecastNew.aspectDynamics.errors.loadFailed', 'Could not load aspect dynamics.');
        state.summary.innerHTML = '';
        syncScrubber(null);
        drawChart();
    }

    function statusMessage(status) {
        const map = {
            selected_not_in_orb: tr('page.forecastNew.aspectDynamics.empty.notInOrb', 'The selected moment is outside the aspect orb.'),
            unknown_natal_body: tr('page.forecastNew.aspectDynamics.empty.unknownNatal', 'Natal object is not available.'),
            unknown_aspect_type: tr('page.forecastNew.aspectDynamics.empty.unknownAspect', 'Aspect type is not available.'),
            unsupported_transit_body: tr('page.forecastNew.aspectDynamics.empty.unsupportedTransit', 'Transit body is not supported.'),
            unsupported_body: tr('page.forecastNew.aspectDynamics.empty.unsupportedTransit', 'Transit body is not supported.'),
            missing_partner: tr('page.forecastNew.aspectDynamics.empty.noData', 'No aspect dynamics data.'),
        };
        return map[status] || tr('page.forecastNew.aspectDynamics.empty.noData', 'No aspect dynamics data.');
    }

    function renderData(data, options = {}) {
        const previousView = state.interactionWindow;
        state.data = data || null;
        const initialView = initialViewWindow(data);
        const loaded = committedDataWindowMs(data);
        state.defaultViewWindow = initialView;
        if (options.preserveViewport && previousView && loaded) {
            state.interactionWindow = constrainWindowToLoaded(previousView.start, previousView.end, loaded);
        } else {
            state.interactionWindow = initialView;
        }
        const hasSeries = Array.isArray(data?.series) && data.series.length > 1;
        const isPreview = Boolean(data?.preview);
        state.isLoading = isPreview;
        if (isPreview) {
            state.status.hidden = false;
            state.status.className = 'aspect-dynamics-status';
            state.status.textContent = tr('page.forecastNew.aspectDynamics.loading', 'Loading chart...');
        } else if (!data || data.status !== 'ok' || !hasSeries) {
            state.status.hidden = false;
            state.status.className = 'aspect-dynamics-status aspect-dynamics-status--empty';
            state.status.textContent = statusMessage(data?.status);
        } else {
            state.status.hidden = true;
            state.status.textContent = '';
        }
        renderSummary(data);
        updateRangeLabel(data);
        syncScrubber(data);
        drawChart();
    }

    function initialViewWindow(data = state.data) {
        const loaded = committedDataWindowMs(data);
        if (!loaded) return null;
        const selected = selectedMs(data);
        const contact = Array.isArray(data?.contacts) ? data.contacts[0] : null;
        const contactStart = msFromIso(contact?.enter);
        const contactEnd = msFromIso(contact?.leave);
        if (Number.isFinite(contactStart) && Number.isFinite(contactEnd) && contactEnd > contactStart) {
            const contactSpan = contactEnd - contactStart;
            const paddedSpan = Math.max(30 * DAY_MS, Math.min(730 * DAY_MS, contactSpan * 2.5));
            const center = Number.isFinite(selected)
                ? selected
                : (contactStart + contactEnd) / 2;
            return constrainWindowToLoaded(center - paddedSpan / 2, center + paddedSpan / 2, loaded);
        }
        if (Number.isFinite(selected)) {
            const span = Math.min(loaded.end - loaded.start, defaultVisibleSpanDays(data) * DAY_MS);
            return constrainWindowToLoaded(selected - span / 2, selected + span / 2, loaded);
        }
        return loaded;
    }

    function defaultVisibleSpanDays(data = state.data) {
        const method = data?.method || state.basePayload?.method || 'transit';
        return ({
            natal: 365,
            transit: 365,
            progression: 3650,
            direction: 3650,
            solar_return: 365,
            synastry_partner: 365,
        })[method] || 365;
    }

    function constrainWindowToLoaded(start, end, loaded) {
        const span = Math.min(Math.max(MIN_WINDOW_DAYS * DAY_MS, end - start), loaded.end - loaded.start);
        let nextStart = start;
        let nextEnd = start + span;
        if (nextStart < loaded.start) {
            nextStart = loaded.start;
            nextEnd = nextStart + span;
        }
        if (nextEnd > loaded.end) {
            nextEnd = loaded.end;
            nextStart = nextEnd - span;
        }
        return { start: nextStart, end: nextEnd };
    }

    function formatDateTime(value) {
        if (!value) return tr('common.notAvailable', 'N/A');
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        if (root.LocaleFormatters?.formatDateTime) {
            return root.LocaleFormatters.formatDateTime(date, { hour12: false });
        }
        return new Intl.DateTimeFormat(root.FrontendI18n?.getLocale?.() || 'en', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).format(date);
    }

    function formatOrb(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return tr('common.notAvailable', 'N/A');
        return `${numeric.toFixed(2)}&deg;`;
    }

    function renderSummary(data) {
        if (!state.summary) return;
        const contact = Array.isArray(data?.contacts) ? data.contacts[0] : null;
        if (state.isLoading && data?.preview) {
            state.summary.innerHTML = `<div class="aspect-dynamics-summary-empty">${escapeHtml(tr('page.forecastNew.aspectDynamics.loading', 'Loading chart...'))}</div>`;
            return;
        }
        if (!contact) {
            state.summary.innerHTML = `<div class="aspect-dynamics-summary-empty">${escapeHtml(statusMessage(data?.status))}</div>`;
            return;
        }
        const passes = Array.isArray(contact.passes) && contact.passes.length
            ? contact.passes.map((pass, index) => `
                <span class="aspect-dynamics-chip">
                    ${escapeHtml(tr('page.forecastNew.aspectDynamics.pass', 'Pass {number}', { number: index + 1 }))}
                    <b>${escapeHtml(formatDateTime(pass.date))}</b>
                    <em>${escapeHtml(pass.motion || '')}</em>
                </span>
            `).join('')
            : `<span class="aspect-dynamics-chip">${escapeHtml(tr('page.forecastNew.aspectDynamics.noExactPass', 'No exact crossing'))}</span>`;
        const stations = Array.isArray(contact.stations) && contact.stations.length
            ? contact.stations.map((station) => `
                <span class="aspect-dynamics-chip">
                    ${escapeHtml(station.type)}
                    <b>${escapeHtml(formatDateTime(station.date))}</b>
                </span>
            `).join('')
            : '';
        state.summary.innerHTML = `
            <div class="aspect-dynamics-summary-grid">
                <div><span>${escapeHtml(tr('page.forecast.timeline.tooltip.enter', 'Enter'))}</span><b>${escapeHtml(formatDateTime(contact.enter))}</b></div>
                <div><span>${escapeHtml(tr('page.forecast.timeline.tooltip.leave', 'Leave'))}</span><b>${escapeHtml(formatDateTime(contact.leave))}</b></div>
                <div><span>${escapeHtml(tr('page.forecastNew.aspectDynamics.closest', 'Closest approach'))}</span><b>${formatOrb(contact.closest_approach?.orb)} ${escapeHtml(formatDateTime(contact.closest_approach?.date))}</b></div>
                <div><span>${escapeHtml(tr('common.orb', 'Orb'))}</span><b>${formatOrb(data?.orb_used)}</b></div>
            </div>
            <div class="aspect-dynamics-chip-row">${passes}${stations}</div>
        `;
    }

    function pointMs(point) {
        const ms = new Date(point?.datetime).getTime();
        return Number.isFinite(ms) ? ms : null;
    }

    function graphSeries(data = state.data) {
        return (data?.series || []).filter((point) => (
            Number.isFinite(Number(point.signed_orb)) && pointMs(point) !== null
        ));
    }

    function drawChart() {
        const canvas = state.canvas;
        if (!canvas || typeof canvas.getContext !== 'function') return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const wrap = canvas.parentElement;
        const width = elementInnerWidth(wrap, 720);
        const height = Math.max(280, Math.floor(wrap?.clientHeight || 320));
        const dpr = root.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        const data = state.data;
        const series = graphSeries(data);
        if (series.length < 2) {
            drawEmptyChartState(ctx, width, height);
            drawOverviewChart();
            return;
        }

        const pad = chartPad();
        const plotW = width - pad.left - pad.right;
        const plotH = height - pad.top - pad.bottom;
        const plotBottom = pad.top + plotH;
        const times = series.map(pointMs);
        const seriesMinMs = Math.min(...times);
        const seriesMaxMs = Math.max(...times);
        const windowMs = dataWindowMs(data) || { start: seriesMinMs, end: seriesMaxMs };
        const minMs = windowMs.start;
        const maxMs = windowMs.end;
        const orbUsed = Math.abs(Number(data?.orb_used || 0));
        const maxSeriesAbs = Math.max(...series.map((point) => Math.abs(Number(point.signed_orb))));
        const maxAbs = Math.max(1, orbUsed, maxSeriesAbs) * 1.08;

        const xOf = (ms) => {
            if (maxMs === minMs) return pad.left;
            return pad.left + ((ms - minMs) / (maxMs - minMs)) * plotW;
        };
        const yOf = (value) => {
            const clamped = Math.max(-maxAbs, Math.min(maxAbs, value));
            return plotBottom - ((clamped + maxAbs) / (maxAbs * 2)) * plotH;
        };
        const ticks = buildCalendarTicks(minMs, maxMs);

        drawZetGrid(ctx, ticks, xOf, yOf, pad, width, plotBottom, plotH, maxAbs);
        drawRangeCaption(ctx, data, minMs, maxMs, pad, width);

        if (orbUsed > 0) {
            ctx.save();
            ctx.setLineDash([3, 4]);
            ctx.strokeStyle = '#cbbf9b';
            ctx.lineWidth = 1;
            [orbUsed, -orbUsed].forEach((value) => {
                ctx.beginPath();
                ctx.moveTo(pad.left, yOf(value));
                ctx.lineTo(width - pad.right, yOf(value));
                ctx.stroke();
            });
            ctx.restore();
        }

        ctx.strokeStyle = '#6f6f6f';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.left, yOf(0));
        ctx.lineTo(width - pad.right, yOf(0));
        ctx.stroke();

        drawZeroAxisTicks(ctx, ticks, xOf, yOf(0), pad, width, plotBottom, minMs, maxMs);

        ctx.strokeStyle = '#3035a8';
        ctx.lineWidth = 1.35;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        series.forEach((point, index) => {
            const x = xOf(pointMs(point));
            const y = yOf(Number(point.signed_orb));
            if (index === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        drawContactMarkers(ctx, data, xOf, yOf, pad, width, plotBottom);
        drawSelectedMarker(ctx, data?.selected_point, xOf, yOf, pad, width, plotBottom);
        drawScaleKey(ctx, minMs, maxMs, yOf, pad, width, plotBottom);
        drawHoverMarker(ctx, state.hoverMs, xOf, yOf(0), pad, width, plotBottom, minMs, maxMs);
        drawOverviewChart();
    }

    function drawHoverMarker(ctx, hoverMs, xOf, axisY, pad, width, plotBottom, minMs, maxMs) {
        if (!Number.isFinite(hoverMs) || hoverMs < minMs || hoverMs > maxMs) return;
        const x = xOf(hoverMs);
        if (x < pad.left || x > width - pad.right) return;
        const label = formatHoverDateTime(hoverMs, maxMs - minMs);
        const textWidth = typeof ctx.measureText === 'function'
            ? ctx.measureText(label).width
            : label.length * 6.5;
        const boxW = Math.ceil(textWidth + 14);
        const boxH = 22;
        const boxX = Math.max(pad.left, Math.min(width - pad.right - boxW, x - boxW / 2));
        const boxY = Math.max(pad.top + 8, Math.min(plotBottom - boxH - 4, axisY + 12));

        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#946b1f';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, plotBottom);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#946b1f';
        ctx.beginPath();
        ctx.arc(x, axisY, 3.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeStyle = '#c9a15c';
        if (typeof ctx.strokeRect === 'function') {
            ctx.strokeRect(boxX, boxY, boxW, boxH);
        }
        ctx.fillStyle = '#3b3020';
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, boxX + boxW / 2, boxY + boxH / 2 + 0.5);
        ctx.restore();
    }

    function drawEmptyChartState(ctx, width, height) {
        const pad = chartPad();
        const plotW = width - pad.left - pad.right;
        const plotH = height - pad.top - pad.bottom;
        const plotBottom = pad.top + plotH;
        const fallbackSpan = Math.max(MIN_WINDOW_DAYS, defaultVisibleSpanDays()) * DAY_MS;
        const anchor = selectedMs() || Date.now();
        const windowMs = dataWindowMs()
            || { start: anchor - fallbackSpan / 2, end: anchor + fallbackSpan / 2 };
        const minMs = windowMs.start;
        const maxMs = windowMs.end;
        const maxAbs = 1;
        const xOf = (ms) => pad.left + ((ms - minMs) / (maxMs - minMs || 1)) * plotW;
        const yOf = (value) => plotBottom - ((value + maxAbs) / (maxAbs * 2)) * plotH;
        const ticks = buildCalendarTicks(minMs, maxMs);

        drawZetGrid(ctx, ticks, xOf, yOf, pad, width, plotBottom, plotH, maxAbs);
        drawEmptyRangeCaption(ctx, minMs, maxMs, pad);

        ctx.strokeStyle = '#6f6f6f';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.left, yOf(0));
        ctx.lineTo(width - pad.right, yOf(0));
        ctx.stroke();
        drawZeroAxisTicks(ctx, ticks, xOf, yOf(0), pad, width, plotBottom, minMs, maxMs);

        ctx.save();
        ctx.fillStyle = '#6f6b66';
        ctx.font = '13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
            state.isLoading
                ? tr('page.forecastNew.aspectDynamics.loading', 'Loading chart...')
                : statusMessage(state.data?.status),
            width / 2,
            Math.max(pad.top + 34, yOf(0) - 22),
        );
        ctx.restore();
    }

    function drawEmptyRangeCaption(ctx, minMs, maxMs, pad) {
        ctx.save();
        ctx.fillStyle = '#4f4943';
        ctx.font = '600 12px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(
            [
                `${formatDateShort(minMs)} - ${formatDateShort(maxMs)}`,
                formatSpanLabel(maxMs - minMs),
            ].filter(Boolean).join(' · '),
            pad.left,
            14,
        );
        ctx.restore();
    }

    function drawZetGrid(ctx, ticks, xOf, yOf, pad, width, plotBottom, plotH, maxAbs) {
        const right = width - pad.right;
        ctx.save();
        ctx.lineWidth = 1;
        ctx.setLineDash([1, 3]);
        ctx.strokeStyle = '#e1e1e1';
        ctx.beginPath();
        for (let i = 0; i <= 8; i += 1) {
            const y = pad.top + (plotH / 8) * i;
            ctx.moveTo(pad.left, y);
            ctx.lineTo(right, y);
        }
        ctx.stroke();

        ['minor', 'major'].forEach((weight) => {
            ctx.beginPath();
            ctx.strokeStyle = weight === 'major' ? '#d0d0d0' : '#ededed';
            ticks.forEach((tick) => {
                if ((weight === 'major') !== Boolean(tick.major)) return;
                const x = xOf(tick.ms);
                if (x < pad.left || x > right) return;
                ctx.moveTo(x, pad.top);
                ctx.lineTo(x, plotBottom);
            });
            ctx.stroke();
        });
        ctx.setLineDash([]);

        ctx.fillStyle = '#5b5b5b';
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'right';
        [-maxAbs, -maxAbs / 2, 0, maxAbs / 2, maxAbs].forEach((value) => {
            ctx.fillText(`${value.toFixed(Math.abs(value) >= 10 ? 0 : 1)}°`, pad.left - 7, yOf(value) + 4);
        });
        ctx.restore();
    }

    function drawZeroAxisTicks(ctx, ticks, xOf, axisY, pad, width, plotBottom, minMs, maxMs) {
        const right = width - pad.right;
        const spanMs = maxMs - minMs;
        ctx.save();
        ctx.strokeStyle = '#515151';
        ctx.fillStyle = '#333333';
        ctx.font = '10px system-ui, sans-serif';
        ticks.forEach((tick) => {
            const x = xOf(tick.ms);
            if (x < pad.left || x > right) return;
            const length = tick.major ? 7 : 5;
            ctx.beginPath();
            ctx.moveTo(x, axisY - length);
            ctx.lineTo(x, axisY + length);
            ctx.stroke();

            const y = Math.min(plotBottom - 3, axisY + (tick.major ? 20 : 15));
            ctx.textAlign = tick.ms <= minMs + 1 ? 'left' : (tick.ms >= maxMs - 1 ? 'right' : 'center');
            ctx.fillText(tick.label || formatDateTick(tick.ms, spanMs), x, y);
        });
        ctx.restore();
    }

    function drawScaleKey(ctx, minMs, maxMs, yOf, pad, width, plotBottom) {
        const spanMs = maxMs - minMs;
        const scaleMs = pickScaleInterval(spanMs);
        if (!Number.isFinite(scaleMs) || scaleMs <= 0) return;
        const plotW = width - pad.left - pad.right;
        const w = Math.max(32, Math.min(110, (scaleMs / spanMs) * plotW));
        const x = Math.max(pad.left + 64, width - pad.right - w - 48);
        const y = Math.max(pad.top + 42, plotBottom - 16);
        const h = Math.max(12, Math.min(54, Math.abs(yOf(1) - yOf(0))));
        ctx.save();
        ctx.strokeStyle = '#25258f';
        ctx.fillStyle = '#25258f';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, y - h);
        ctx.lineTo(x, y);
        ctx.lineTo(x + w, y);
        ctx.stroke();
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('1°', x - 5, y - h + 4);
        ctx.textAlign = 'left';
        ctx.fillText(formatSpanLabel(scaleMs), x + w + 5, y + 3);
        ctx.restore();
    }

    function drawOverviewChart() {
        const canvas = state.overviewCanvas;
        if (!canvas || typeof canvas.getContext !== 'function') return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const wrap = canvas.parentElement;
        const width = elementInnerWidth(wrap, 720);
        const height = Math.max(42, Math.floor(canvas.clientHeight || 54));
        const dpr = root.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#fbfbfb';
        ctx.fillRect(0, 0, width, height);

        const series = graphSeries();
        if (series.length < 2) return;
        const pad = { left: 3, right: 3, top: 5, bottom: 5 };
        const plotW = width - pad.left - pad.right;
        const plotH = height - pad.top - pad.bottom;
        const plotBottom = pad.top + plotH;
        const times = series.map(pointMs);
        const minMs = Math.min(...times);
        const maxMs = Math.max(...times);
        const maxAbs = Math.max(1, ...series.map((point) => Math.abs(Number(point.signed_orb))));
        const xOf = (ms) => pad.left + ((ms - minMs) / (maxMs - minMs || 1)) * plotW;
        const yOf = (value) => plotBottom - ((Math.max(-maxAbs, Math.min(maxAbs, value)) + maxAbs) / (maxAbs * 2)) * plotH;

        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.left, yOf(0));
        ctx.lineTo(width - pad.right, yOf(0));
        ctx.stroke();

        ctx.strokeStyle = '#4a55bc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        series.forEach((point, index) => {
            const x = xOf(pointMs(point));
            const y = yOf(Number(point.signed_orb));
            if (index === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        const selected = selectedMs();
        if (selected && selected >= minMs && selected <= maxMs) {
            const x = xOf(selected);
            ctx.strokeStyle = '#d03131';
            ctx.beginPath();
            ctx.moveTo(x, pad.top);
            ctx.lineTo(x, plotBottom);
            ctx.stroke();
        }
    }

    function drawContactMarkers(ctx, data, xOf, yOf, pad, width, plotBottom) {
        const contact = Array.isArray(data?.contacts) ? data.contacts[0] : null;
        if (!contact) return;
        ctx.save();
        ctx.fillStyle = '#1e3a5f';
        ctx.strokeStyle = '#1e3a5f';
        (contact.passes || []).forEach((pass) => {
            const ms = new Date(pass.date).getTime();
            if (!Number.isFinite(ms)) return;
            const x = xOf(ms);
            if (x < pad.left || x > width - pad.right) return;
            ctx.beginPath();
            ctx.arc(x, yOf(0), 4, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.fillStyle = '#7a4f9f';
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        (contact.stations || []).forEach((station) => {
            const ms = new Date(station.date).getTime();
            if (!Number.isFinite(ms)) return;
            const x = xOf(ms);
            if (x < pad.left || x > width - pad.right) return;
            ctx.beginPath();
            ctx.moveTo(x, pad.top + 5);
            ctx.lineTo(x - 4, pad.top + 14);
            ctx.lineTo(x + 4, pad.top + 14);
            ctx.closePath();
            ctx.fill();
            ctx.fillText(station.type || '', x, pad.top + 28);
        });
        ctx.restore();
    }

    function drawSelectedMarker(ctx, selected, xOf, yOf, pad, width, plotBottom) {
        const ms = new Date(selected?.datetime).getTime();
        const signed = Number(selected?.signed_orb);
        if (!Number.isFinite(ms) || !Number.isFinite(signed)) return;
        const x = xOf(ms);
        const y = yOf(signed);
        if (x < pad.left || x > width - pad.right) return;
        ctx.save();
        ctx.strokeStyle = '#d03131';
        ctx.fillStyle = '#d03131';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, plotBottom);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - 6, y - 6);
        ctx.lineTo(x + 6, y + 6);
        ctx.moveTo(x + 6, y - 6);
        ctx.lineTo(x - 6, y + 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawRangeCaption(ctx, data, minMs, maxMs, pad, width) {
        ctx.save();
        ctx.fillStyle = '#4f4943';
        ctx.font = '600 12px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(
            [
                `${formatDateShort(minMs)} - ${formatDateShort(maxMs)}`,
                formatSpanLabel(maxMs - minMs),
                `${(data?.series || []).length} pts`,
            ].filter(Boolean).join(' · '),
            pad.left,
            14,
        );
        ctx.restore();
    }

    function buildTimeTicks(minMs, maxMs, targetCount = 6) {
        if (!Number.isFinite(minMs) || !Number.isFinite(maxMs) || maxMs <= minMs) {
            return [];
        }
        const count = Math.max(2, targetCount);
        return Array.from({ length: count }, (_, index) => (
            minMs + ((maxMs - minMs) * index) / (count - 1)
        ));
    }

    function buildCalendarTicks(minMs, maxMs) {
        const spanDays = Math.abs(maxMs - minMs) / DAY_MS;
        if (spanDays <= 0) return [];
        if (spanDays >= 365 * 5) {
            const step = spanDays >= 365 * 80 ? 10 : (spanDays >= 365 * 25 ? 5 : 1);
            const startYear = Math.floor(new Date(minMs).getUTCFullYear() / step) * step;
            const endYear = new Date(maxMs).getUTCFullYear() + step;
            const ticks = [];
            for (let year = startYear; year <= endYear; year += step) {
                const ms = Date.UTC(year, 0, 1);
                if (ms >= minMs - DAY_MS && ms <= maxMs + DAY_MS) {
                    ticks.push({ ms, label: String(year), major: true });
                }
            }
            return ticks.length ? ticks : buildTimeTicks(minMs, maxMs, 6).map((ms) => ({ ms, label: formatDateTick(ms, maxMs - minMs), major: true }));
        }
        if (spanDays >= 90) {
            const stepMonths = spanDays >= 365 * 2 ? 3 : 1;
            const start = new Date(minMs);
            let year = start.getUTCFullYear();
            let month = Math.floor(start.getUTCMonth() / stepMonths) * stepMonths;
            const ticks = [];
            while (Date.UTC(year, month, 1) <= maxMs + 32 * DAY_MS) {
                const ms = Date.UTC(year, month, 1);
                const date = new Date(ms);
                const monthIndex = date.getUTCMonth();
                if (ms >= minMs - 32 * DAY_MS && ms <= maxMs + 32 * DAY_MS) {
                    ticks.push({
                        ms,
                        label: monthIndex === 0 ? String(date.getUTCFullYear()) : String(monthIndex + 1),
                        major: monthIndex === 0,
                    });
                }
                month += stepMonths;
                if (month >= 12) {
                    year += Math.floor(month / 12);
                    month %= 12;
                }
            }
            return ticks;
        }
        const stepDays = spanDays >= 30 ? 7 : (spanDays >= 12 ? 2 : 1);
        const startDay = Math.floor(minMs / DAY_MS) * DAY_MS;
        const ticks = [];
        for (let ms = startDay; ms <= maxMs + stepDays * DAY_MS; ms += stepDays * DAY_MS) {
            if (ms >= minMs - DAY_MS && ms <= maxMs + DAY_MS) {
                ticks.push({ ms, label: formatDateTick(ms, maxMs - minMs), major: ticks.length === 0 });
            }
        }
        return ticks;
    }

    function formatDateTick(ms, spanMs) {
        const date = new Date(ms);
        if (Number.isNaN(date.getTime())) return '';
        const locale = root.FrontendI18n?.getLocale?.() || 'en';
        const spanDays = Math.abs(spanMs) / 86400000;
        if (spanDays >= 365 * 5) {
            return new Intl.DateTimeFormat(locale, { year: 'numeric' }).format(date);
        }
        if (spanDays >= 120) {
            return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(date);
        }
        return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date);
    }

    function formatHoverDateTime(ms, spanMs) {
        const date = new Date(ms);
        if (Number.isNaN(date.getTime())) return '';
        const locale = root.FrontendI18n?.getLocale?.() || 'en';
        const options = Math.abs(spanMs) <= 60 * DAY_MS
            ? {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            }
            : {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            };
        return new Intl.DateTimeFormat(locale, options).format(date);
    }

    function formatSpanLabel(spanMs) {
        const days = Math.abs(spanMs) / 86400000;
        if (!Number.isFinite(days) || days <= 0) return '';
        if (days >= 365 * 2) return `${(days / 365.2425).toFixed(days >= 3650 ? 0 : 1)}y`;
        if (days >= 60) return `${Math.round(days / 30.4375)}mo`;
        return `${Math.max(1, Math.round(days))}d`;
    }

    function pickScaleInterval(spanMs) {
        const days = Math.abs(spanMs) / DAY_MS;
        if (days >= 365 * 80) return 365.2425 * 10 * DAY_MS;
        if (days >= 365 * 25) return 365.2425 * 5 * DAY_MS;
        if (days >= 365 * 5) return 365.2425 * DAY_MS;
        if (days >= 365 * 2) return 91.3125 * DAY_MS;
        if (days >= 120) return 30.4375 * DAY_MS;
        if (days >= 30) return 7 * DAY_MS;
        if (days >= 7) return DAY_MS;
        return Math.max(DAY_MS / 4, spanMs / 8);
    }

    function formatDateShort(ms) {
        const date = new Date(ms);
        if (Number.isNaN(date.getTime())) return '';
        return new Intl.DateTimeFormat(root.FrontendI18n?.getLocale?.() || 'en', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        }).format(date);
    }

    async function open(options = {}) {
        const overlay = ensureModal();
        if (!overlay) return null;
        const payload = buildPayload(options);
        const nextBaseKey = payloadCacheKey(payload);
        const previousBaseKey = state.basePayload ? payloadCacheKey(state.basePayload) : null;
        state.basePayload = payload;
        if (nextBaseKey !== previousBaseKey) {
            state.scrollDomain = null;
        }
        clearTimeout(state.pendingWindowTimer);
        state.pendingWindowTimer = null;
        renderShell(payload);
        state.lastFocus = typeof document !== 'undefined' ? document.activeElement : null;
        setOpen(true);

        if (!validatePayload(payload)) {
            renderError(tr('page.forecastNew.aspectDynamics.errors.missingContext', 'Aspect context is incomplete.'));
            return null;
        }

        return fetchPreviewThenFull(payload);
    }

    function setFetchImpl(fetchImpl) {
        state.fetchImpl = fetchImpl;
    }

    return {
        buildPayload,
        close,
        drawChart,
        fetchAndRender,
        fetchPreviewThenFull,
        open,
        renderData,
        setFetchImpl,
        splitSelectedDateTime,
        _state: state,
    };
});

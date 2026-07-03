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
    const MIN_WINDOW_DAYS = 3;
    const MAX_WINDOW_DAYS = 36525;
    const API_BASE = () => root.AstroAPI?.API_BASE_URL || '/api/v1';

    const state = {
        overlay: null,
        dialog: null,
        canvas: null,
        chartWrap: null,
        status: null,
        summary: null,
        title: null,
        subtitle: null,
        closeButton: null,
        toolbar: null,
        data: null,
        lastFocus: null,
        resizeObserver: null,
        fetchImpl: null,
        basePayload: null,
        requestSeq: 0,
        responseCache: new Map(),
        dragStart: null,
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

    function toDateOnly(ms) {
        return new Date(ms).toISOString().slice(0, 10);
    }

    function msFromIso(value) {
        const ms = new Date(value).getTime();
        return Number.isFinite(ms) ? ms : null;
    }

    function dataWindowMs(data = state.data) {
        const start = msFromIso(data?.effective_window?.start)
            ?? msFromIso(data?.series?.[0]?.datetime);
        const end = msFromIso(data?.effective_window?.end)
            ?? msFromIso(data?.series?.[data?.series?.length - 1]?.datetime);
        return Number.isFinite(start) && Number.isFinite(end) && end > start
            ? { start, end }
            : null;
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
            max_points: maxPointsForWindow(start, end),
            contact_start: toDateOnly(start),
            contact_end: toDateOnly(end),
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

    async function fetchAndRender(payload, { keepStatus = false } = {}) {
        const seq = ++state.requestSeq;
        if (!keepStatus) renderLoading();
        const key = payloadCacheKey(payload);
        if (state.responseCache.has(key)) {
            renderData(state.responseCache.get(key));
            return state.data;
        }
        try {
            const data = await postJson('/transits/aspect-dynamics', payload);
            if (seq !== state.requestSeq) return null;
            state.responseCache.set(key, data);
            renderData(data);
            return data;
        } catch (error) {
            if (seq !== state.requestSeq) return null;
            renderError(error?.message || tr('page.forecastNew.aspectDynamics.errors.loadFailed', 'Could not load aspect dynamics.'));
            return null;
        }
    }

    function requestWindow(startMs, endMs) {
        if (!state.basePayload) return;
        const bounded = clampWindow(startMs, endMs);
        void fetchAndRender(windowPayload(bounded.start, bounded.end));
    }

    function eventAnchorMs(event) {
        const current = dataWindowMs();
        const canvas = state.canvas;
        if (!current || !canvas || !event) return null;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return null;
        const padLeft = 54;
        const padRight = 18;
        const plotW = Math.max(1, rect.width - padLeft - padRight);
        const ratio = Math.max(
            0,
            Math.min(1, (event.clientX - rect.left - padLeft) / plotW),
        );
        return current.start + ratio * (current.end - current.start);
    }

    function zoom(factor, anchorMs = null) {
        const current = dataWindowMs();
        if (!current) return;
        const anchor = anchorMs || selectedMs() || ((current.start + current.end) / 2);
        const span = (current.end - current.start) * factor;
        const leftRatio = (anchor - current.start) / (current.end - current.start || 1);
        requestWindow(anchor - span * leftRatio, anchor + span * (1 - leftRatio));
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

    function onToolbarClick(event) {
        const button = event.target.closest('button');
        if (!button) return;
        const zoomAction = button.dataset.aspectDynamicsZoom;
        const panAction = button.dataset.aspectDynamicsPan;
        const range = button.dataset.aspectDynamicsRange;
        if (zoomAction === 'in') zoom(0.5);
        else if (zoomAction === 'out') zoom(2);
        else if (zoomAction === 'reset') void fetchAndRender(state.basePayload);
        else if (panAction) pan(Number(panAction));
        else if (range) preset(Number(range));
    }

    function onCanvasWheel(event) {
        if (!state.data) return;
        event.preventDefault();
        zoom(event.deltaY < 0 ? 0.65 : 1.55, eventAnchorMs(event));
    }

    function onCanvasPointerDown(event) {
        if (!state.data) return;
        state.dragStart = {
            x: event.clientX,
            window: dataWindowMs(),
        };
        state.chartWrap?.setPointerCapture?.(event.pointerId);
    }

    function onCanvasPointerUp(event) {
        if (!state.dragStart?.window) {
            state.dragStart = null;
            return;
        }
        const drag = state.dragStart;
        const width = Math.max(1, state.canvas?.clientWidth || 1);
        const dx = event.clientX - drag.x;
        const span = drag.window.end - drag.window.start;
        const shift = -(dx / width) * span;
        state.dragStart = null;
        if (Math.abs(dx) > 4) {
            requestWindow(drag.window.start + shift, drag.window.end + shift);
        }
    }

    function onCanvasPointerCancel() {
        state.dragStart = null;
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
        state.status = overlay.querySelector('.aspect-dynamics-status');
        state.summary = overlay.querySelector('.aspect-dynamics-summary');
        state.title = overlay.querySelector('#aspectDynamicsTitle');
        state.subtitle = overlay.querySelector('.aspect-dynamics-subtitle');
        state.closeButton = overlay.querySelector('.aspect-dynamics-close');
        state.toolbar = overlay.querySelector('.aspect-dynamics-toolbar');
        state.chartWrap = overlay.querySelector('.aspect-dynamics-chart-wrap');

        overlay.addEventListener('click', (event) => {
            if (event.target.closest('[data-aspect-dynamics-close]')) close();
        });
        state.toolbar?.addEventListener('click', onToolbarClick);
        state.chartWrap?.addEventListener('wheel', onCanvasWheel, { passive: false });
        state.chartWrap?.addEventListener('pointerdown', onCanvasPointerDown);
        state.chartWrap?.addEventListener('pointerup', onCanvasPointerUp);
        state.chartWrap?.addEventListener('pointercancel', onCanvasPointerCancel);

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
        state.status.hidden = false;
        state.status.className = 'aspect-dynamics-status';
        state.status.textContent = tr('page.forecastNew.aspectDynamics.loading', 'Calculating aspect dynamics...');
        state.summary.innerHTML = '';
        drawChart();
    }

    function renderError(message) {
        state.data = null;
        state.status.hidden = false;
        state.status.className = 'aspect-dynamics-status aspect-dynamics-status--error';
        state.status.textContent = message || tr('page.forecastNew.aspectDynamics.errors.loadFailed', 'Could not load aspect dynamics.');
        state.summary.innerHTML = '';
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

    function renderData(data) {
        state.data = data || null;
        const hasSeries = Array.isArray(data?.series) && data.series.length > 1;
        if (!data || data.status !== 'ok' || !hasSeries) {
            state.status.hidden = false;
            state.status.className = 'aspect-dynamics-status aspect-dynamics-status--empty';
            state.status.textContent = statusMessage(data?.status);
        } else {
            state.status.hidden = true;
            state.status.textContent = '';
        }
        renderSummary(data);
        updateRangeLabel(data);
        drawChart();
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

    function drawChart() {
        const canvas = state.canvas;
        if (!canvas || typeof canvas.getContext !== 'function') return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const wrap = canvas.parentElement;
        const width = Math.max(320, Math.floor(wrap?.clientWidth || 720));
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
        const series = (data?.series || []).filter((point) => Number.isFinite(Number(point.signed_orb)) && pointMs(point) !== null);
        if (series.length < 2) {
            ctx.fillStyle = '#8a8178';
            ctx.font = '13px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(tr('page.forecastNew.aspectDynamics.empty.noData', 'No aspect dynamics data.'), width / 2, height / 2);
            return;
        }

        const pad = { left: 54, right: 18, top: 22, bottom: 36 };
        const plotW = width - pad.left - pad.right;
        const plotH = height - pad.top - pad.bottom;
        const plotBottom = pad.top + plotH;
        const times = series.map(pointMs);
        const minMs = Math.min(...times);
        const maxMs = Math.max(...times);
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
        const ticks = buildTimeTicks(minMs, maxMs, 6);

        ctx.strokeStyle = '#e7e1d8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= 4; i += 1) {
            const y = pad.top + (plotH / 4) * i;
            ctx.moveTo(pad.left, y);
            ctx.lineTo(width - pad.right, y);
        }
        ctx.stroke();

        ctx.strokeStyle = '#f1ece4';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ticks.forEach((tick) => {
            const x = xOf(tick);
            ctx.moveTo(x, pad.top);
            ctx.lineTo(x, plotBottom);
        });
        ctx.stroke();

        drawRangeCaption(ctx, data, minMs, maxMs, pad, width);

        ctx.fillStyle = '#7b736c';
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'right';
        [-maxAbs, 0, maxAbs].forEach((value) => {
            ctx.fillText(`${value.toFixed(1)}°`, pad.left - 8, yOf(value) + 4);
        });

        if (orbUsed > 0) {
            ctx.save();
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = '#d4a74f';
            ctx.lineWidth = 1;
            [orbUsed, -orbUsed].forEach((value) => {
                ctx.beginPath();
                ctx.moveTo(pad.left, yOf(value));
                ctx.lineTo(width - pad.right, yOf(value));
                ctx.stroke();
            });
            ctx.restore();
        }

        ctx.strokeStyle = '#a9a19a';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(pad.left, yOf(0));
        ctx.lineTo(width - pad.right, yOf(0));
        ctx.stroke();

        ctx.strokeStyle = '#1f63b5';
        ctx.lineWidth = 2.2;
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
        drawDateLabels(ctx, ticks, xOf, minMs, maxMs, pad, width, plotBottom);
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

    function drawDateLabels(ctx, ticks, xOf, minMs, maxMs, pad, width, plotBottom) {
        const spanMs = maxMs - minMs;
        ctx.save();
        ctx.fillStyle = '#7b736c';
        ctx.font = '11px system-ui, sans-serif';
        ticks.forEach((tick, index) => {
            const x = xOf(tick);
            ctx.textAlign = index === 0
                ? 'left'
                : (index === ticks.length - 1 ? 'right' : 'center');
            const boundedX = Math.max(pad.left, Math.min(width - pad.right, x));
            ctx.fillText(formatDateTick(tick, spanMs), boundedX, plotBottom + 22);
        });
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

    function formatSpanLabel(spanMs) {
        const days = Math.abs(spanMs) / 86400000;
        if (!Number.isFinite(days) || days <= 0) return '';
        if (days >= 365 * 2) return `${(days / 365.2425).toFixed(days >= 3650 ? 0 : 1)}y`;
        if (days >= 60) return `${Math.round(days / 30.4375)}mo`;
        return `${Math.max(1, Math.round(days))}d`;
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
        state.basePayload = payload;
        state.responseCache.clear();
        renderShell(payload);
        state.lastFocus = typeof document !== 'undefined' ? document.activeElement : null;
        setOpen(true);

        if (!validatePayload(payload)) {
            renderError(tr('page.forecastNew.aspectDynamics.errors.missingContext', 'Aspect context is incomplete.'));
            return null;
        }

        return fetchAndRender(payload);
    }

    function setFetchImpl(fetchImpl) {
        state.fetchImpl = fetchImpl;
    }

    return {
        buildPayload,
        close,
        drawChart,
        fetchAndRender,
        open,
        renderData,
        setFetchImpl,
        splitSelectedDateTime,
        _state: state,
    };
});

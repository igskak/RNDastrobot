/**
 * forecast-timeline-page.js — controller for the standalone Forecast Timeline page.
 *
 * Loads the client's natal chart, fetches transit events over a date range via
 * ForecastRangeData, and renders the Gantt-style timeline using the shared
 * window.ForecastTimeline canvas renderer.
 */
(function () {
    'use strict';

    const RD = () => window.ForecastRangeData;

    const state = {
        natalData: null,
        periodData: null,
    };

    const refs = {};

    function t(key, params) {
        return window.FrontendI18n?.t?.(key, params) || key;
    }

    async function waitForI18n() {
        if (window.FrontendI18n?.ready) {
            await Promise.resolve(window.FrontendI18n.ready).catch(() => {});
        }
    }

    function cacheRefs() {
        refs.pageLoader = document.getElementById('pageLoader');
        refs.error = document.getElementById('pageError');
        refs.errorMsg = document.getElementById('pageErrorMsg');
        refs.subtitle = document.getElementById('pageSubtitle');
        refs.startDate = document.getElementById('startDate');
        refs.endDate = document.getElementById('endDate');
        refs.calculate = document.getElementById('btnCalculate');
        refs.filterMajor = document.getElementById('filterMajor');
        refs.eventCount = document.getElementById('tlEventCount');
        refs.activeSummary = document.getElementById('activeEventsSummary');
        refs.empty = document.getElementById('timelineEmpty');
        refs.loading = document.getElementById('timelineLoading');
        refs.container = document.getElementById('timelineContainer');
        refs.legend = document.getElementById('timelineLegend');
    }

    function hideLoader() {
        refs.pageLoader?.classList.add('fade-out');
        setTimeout(() => refs.pageLoader?.remove(), 320);
    }

    function showError(message) {
        if (refs.error) {
            refs.error.classList.remove('hidden');
            if (refs.errorMsg) refs.errorMsg.textContent = message;
        }
    }

    function showState(mode) {
        // mode: 'empty' | 'loading' | 'content'
        if (refs.empty) refs.empty.style.display = mode === 'empty' ? '' : 'none';
        if (refs.loading) refs.loading.style.display = mode === 'loading' ? '' : 'none';
        if (refs.container) refs.container.style.display = mode === 'content' ? '' : 'none';
    }

    async function loadNatalData() {
        let natalData = window.AstroAPI?.getChartFromSession?.();
        const userId = natalData?.user_id || localStorage.getItem('currentUserId');
        if ((!natalData || !natalData.planets) && userId && window.AstroAPI?.getNatalChart) {
            natalData = await window.AstroAPI.getNatalChart(userId);
            window.AstroAPI.saveChartToSession(natalData);
        }
        if (!natalData?.user_id) {
            throw new Error(t('page.clients.errors.chartNotFound'));
        }
        state.natalData = natalData;
        localStorage.setItem('currentUserId', natalData.user_id);
        return natalData;
    }

    function getTimezone() {
        const birth = state.natalData?.birth_data || {};
        return birth.timezone || 'UTC';
    }

    function updateHeader() {
        const birth = state.natalData?.birth_data || {};
        const parts = [birth.date || birth.birth_date, birth.time || birth.birth_time, birth.place || birth.birth_place]
            .filter(Boolean);
        if (refs.subtitle) refs.subtitle.textContent = parts.join(' · ');
    }

    function fmtDate(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function applyDatePreset(value, unit) {
        const today = new Date();
        refs.startDate.value = fmtDate(today);
        const end = new Date(today);
        if (unit === 'days') end.setDate(end.getDate() + value);
        else end.setMonth(end.getMonth() + value);
        refs.endDate.value = fmtDate(end);
        document.querySelectorAll('#datePresets .preset-btn').forEach((b) => {
            const months = b.dataset.months ? parseInt(b.dataset.months, 10) : null;
            const days = b.dataset.days ? parseInt(b.dataset.days, 10) : null;
            const matches = unit === 'days' ? days === value : months === value;
            b.classList.toggle('active', matches);
        });
    }

    function getFilteredEvents() {
        const events = state.periodData?.events || [];
        if (refs.filterMajor?.checked) return events.filter((e) => e.is_major);
        return events;
    }

    function renderActiveEventsSummary(events) {
        if (!refs.activeSummary) return;
        const now = new Date();
        const active = (events || []).filter((ev) => {
            const enter = new Date(ev.t_enter);
            const leave = new Date(ev.t_leave);
            return now >= enter && now <= leave;
        });
        if (!active.length) {
            refs.activeSummary.innerHTML = `<div class="aes-empty">${t('page.forecast.timeline.activeNow.empty')}</div>`;
            return;
        }
        const chips = active.map((ev) => {
            const pSym = window.Symbols?.getPlanetSymbol?.(ev.transit_body) || ev.transit_body;
            const nSym = window.Symbols?.getPlanetSymbol?.(ev.natal_body) || ev.natal_body;
            const aSym = window.Symbols?.aspects?.[ev.aspect_type] || ev.aspect_type;
            const harmony = RD().getAspectHarmony(ev.aspect_type);
            const exact = new Date(ev.t_exact);
            const daysToExact = Math.round((exact - now) / 86400000);
            const exactLabel = daysToExact === 0
                ? t('page.forecast.timeline.activeNow.exactToday')
                : daysToExact > 0
                    ? t('page.forecast.timeline.activeNow.exactInDays', { days: daysToExact })
                    : t('page.forecast.timeline.activeNow.exactDaysAgo', { days: Math.abs(daysToExact) });
            return `<div class="aes-chip ${harmony}" title="${ev.transit_body} ${ev.aspect_type} ${ev.natal_body}\n${t('common.orb')}: ${ev.min_orb?.toFixed(2)}°\n${exactLabel}">
                <span class="aes-planets">${pSym} ${aSym} ${nSym}</span>
                <span class="aes-exact">${exactLabel}</span>
            </div>`;
        });
        refs.activeSummary.innerHTML = `
            <div class="aes-header">⚡ ${t('page.forecast.timeline.activeNow.title')} <span class="aes-count">${active.length}</span></div>
            <div class="aes-chips">${chips.join('')}</div>
        `;
    }

    function renderTimeline() {
        const s = refs.startDate.value;
        const e = refs.endDate.value;
        const rawEvents = getFilteredEvents();
        const normalized = window.ForecastTimelineUtils?.normalizeTimelineEvents
            ? window.ForecastTimelineUtils.normalizeTimelineEvents(rawEvents, s, e)
            : { events: rawEvents };
        const evts = normalized.events || [];
        if (refs.eventCount) {
            const totalRaw = state.periodData?.events?.length || 0;
            refs.eventCount.textContent = t('page.forecast.timeline.eventCount', { shown: evts.length, total: totalRaw });
        }
        renderActiveEventsSummary(evts);
        requestAnimationFrame(() => {
            window.ForecastTimeline?.render(evts, s, e);
        });
    }

    async function calculate() {
        const start = refs.startDate.value;
        const end = refs.endDate.value;
        if (!start || !end) return;
        showState('loading');
        if (refs.calculate) refs.calculate.disabled = true;
        try {
            state.periodData = await RD().ensureTransitPeriod(start, end);
            showState('content');
            renderTimeline();
        } catch (err) {
            console.error('Timeline load error:', err);
            showState('empty');
            if (refs.empty) {
                refs.empty.querySelector('div:last-child').textContent = err?.message || t('common.error');
            }
        } finally {
            if (refs.calculate) refs.calculate.disabled = false;
        }
    }

    function bindEvents() {
        refs.calculate?.addEventListener('click', calculate);
        refs.filterMajor?.addEventListener('change', () => {
            if (state.periodData) renderTimeline();
        });
        document.querySelectorAll('#datePresets .preset-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const months = btn.dataset.months ? parseInt(btn.dataset.months, 10) : null;
                const days = btn.dataset.days ? parseInt(btn.dataset.days, 10) : null;
                if (days != null) applyDatePreset(days, 'days');
                else if (months != null) applyDatePreset(months, 'months');
            });
        });
    }

    async function init() {
        cacheRefs();
        await waitForI18n();
        if (window.AstroAPI?.requireAuth && !await window.AstroAPI.requireAuth({ redirectTo: '/login.html' })) return;
        try {
            await loadNatalData();
        } catch (err) {
            hideLoader();
            showError(err?.message || t('page.clients.errors.chartNotFound'));
            return;
        }
        RD().configure({
            userId: state.natalData.user_id,
            timezone: getTimezone(),
            natalData: state.natalData,
        });
        if (window.AstroPreferences?.getAccountVisualPreferences) {
            window.ForecastTimeline?.setVisualPreferences?.(window.AstroPreferences.getAccountVisualPreferences());
        }
        updateHeader();
        applyDatePreset(6, 'months');
        bindEvents();
        hideLoader();
        showState('empty');
        calculate();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

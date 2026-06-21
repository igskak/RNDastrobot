(function (root) {
    'use strict';

    const API_BASE = root.AstroAPI?.API_BASE_URL || '/api/v1';

    const state = {
        root: null,
        search: null,
        tagRow: null,
        list: null,
        closeBtn: null,
        lastFocus: null,
        charts: [],
        availableTags: [],
        query: '',
        activeTag: '',
        onSelect: null,
        excludeId: null,
        includeComposites: false,
    };

    function t(key, params, fallback = '') {
        const value = root.FrontendI18n?.t?.(key, params);
        return value && value !== key ? value : (fallback || key);
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function withLocaleHeaders(headers = {}) {
        return root.AstroAPI?.withLocaleHeaders?.(headers) || headers;
    }

    async function apiFetch(path, options = {}) {
        const response = await fetch(`${API_BASE}${path}`, {
            credentials: 'include',
            ...options,
            headers: withLocaleHeaders(options.headers || {}),
        });
        if (!response.ok) {
            const detail = await response.json().catch(() => ({}));
            throw new Error(detail.detail || detail.message || t('common.error', null, 'Error'));
        }
        return response.json();
    }

    function formatDate(value) {
        return root.LocaleFormatters?.formatDate?.(value) || String(value || '');
    }

    function normalizeTag(value) {
        return String(value || '').trim().toLowerCase();
    }

    function chartTitle(chart) {
        return chart.display_title
            || chart.title
            || [chart.first_name, chart.last_name].filter(Boolean).join(' ')
            || t('common.notAvailable', null, 'Not available');
    }

    function chartMeta(chart) {
        if (chart.chart_kind === 'composite') {
            const method = chart.composite_method || chart.method || '';
            const methodLabel = method
                ? t(`page.forecastNew.composite.${method}`, null, method)
                : '';
            return [
                t('page.forecastNew.composite.calculate', null, 'Composite'),
                methodLabel,
                chart.house_system,
            ].filter(Boolean).join(' · ');
        }
        const date = chart.date ? formatDate(chart.date) : '';
        return [chart.person_display_name, date, chart.location_name]
            .filter(Boolean)
            .join(' · ');
    }

    function normalizeCompositeChart(item) {
        const data = item?.chart_data || {};
        const birth = data.birth_data || {};
        const method = item?.method || data.composite_method || '';
        return {
            ...data,
            ...item,
            chart_kind: 'composite',
            composite_chart_id: item?.composite_chart_id || data.composite_saved_chart_id,
            composite_saved_chart_id: item?.composite_chart_id || data.composite_saved_chart_id,
            display_title: item?.title || data.title || data.composite_pair_title || '',
            title: item?.title || data.title || data.composite_pair_title || '',
            date: birth.date || data.date || (item?.created_at ? String(item.created_at).slice(0, 10) : ''),
            time: birth.time || data.time || '',
            timezone: birth.timezone || data.timezone || '',
            location_name: data.composite_pair_title || birth.place || '',
            latitude: birth.latitude ?? data.latitude ?? null,
            longitude: birth.longitude ?? data.longitude ?? null,
            method,
            composite_method: method,
            house_system: item?.house_system || birth.house_system || data.house_system || '',
            tags: Array.isArray(item?.tags) ? item.tags : (Array.isArray(data.tags) ? data.tags : []),
            chart_data: data,
            primary_user_id: item?.primary_user_id || data.source?.primary_user_id || null,
            partner_user_id: item?.partner_user_id || data.source?.partner_user_id || null,
            partner_birth_data: item?.partner_birth_data || data.source?.partner_birth_data || null,
        };
    }

    function ensureDialog() {
        if (state.root) return state.root;

        const rootEl = document.createElement('div');
        rootEl.className = 'quick-open-popover chart-picker hidden';
        rootEl.innerHTML = `
            <div class="quick-open-backdrop" data-chart-picker-close></div>
            <section class="quick-open-dialog chart-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="chartPickerTitle">
                <header class="quick-open-head">
                    <div>
                        <h3 class="quick-open-title" id="chartPickerTitle">${escapeHtml(t('page.chartPicker.title', null, 'Select a chart'))}</h3>
                        <p class="quick-open-subtitle">${escapeHtml(t('page.chartPicker.subtitle', null, 'Search by title, person, or tag.'))}</p>
                    </div>
                    <button type="button" class="quick-open-close" data-chart-picker-close aria-label="${escapeHtml(t('common.close', null, 'Close'))}">×</button>
                </header>
                <div class="chart-picker-search-row">
                    <input type="search" class="chart-picker-search" autocomplete="off"
                        placeholder="${escapeHtml(t('page.chartPicker.searchPlaceholder', null, 'Search charts…'))}"
                        aria-label="${escapeHtml(t('page.chartPicker.searchPlaceholder', null, 'Search charts…'))}">
                </div>
                <div class="chart-picker-tags" data-chart-picker-tags></div>
                <div class="quick-open-list chart-picker-list"></div>
            </section>
        `;
        document.body.appendChild(rootEl);

        state.root = rootEl;
        state.search = rootEl.querySelector('.chart-picker-search');
        state.tagRow = rootEl.querySelector('[data-chart-picker-tags]');
        state.list = rootEl.querySelector('.chart-picker-list');
        state.closeBtn = rootEl.querySelector('.quick-open-close');

        rootEl.addEventListener('click', (event) => {
            if (event.target.closest('[data-chart-picker-close]')) {
                close();
                return;
            }
            const tagButton = event.target.closest('[data-chart-picker-tag]');
            if (tagButton) {
                const tag = tagButton.dataset.chartPickerTag || '';
                state.activeTag = normalizeTag(tag) === normalizeTag(state.activeTag) ? '' : tag;
                renderTags();
                loadCharts();
                return;
            }
            const item = event.target.closest('[data-chart-picker-index]');
            if (item) {
                const chart = state.charts[Number(item.dataset.chartPickerIndex)];
                if (chart && typeof state.onSelect === 'function') {
                    const cb = state.onSelect;
                    close();
                    cb(chart);
                }
            }
        });
        state.search.addEventListener('input', () => {
            state.query = state.search.value.trim().toLowerCase();
            renderList();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && state.root && !state.root.classList.contains('hidden')) {
                close();
            }
        });

        return rootEl;
    }

    function getTags(chart) {
        return Array.isArray(chart.tags) ? chart.tags.filter(Boolean) : [];
    }

    function filterCharts() {
        // Tag filtering for saved people is done server-side (incl. family tags);
        // composites are fetched by their own tag endpoint when enabled.
        const query = state.query;
        return state.charts.filter((chart) => {
            if (chart.chart_kind !== 'composite'
                && state.excludeId
                && String(chart.user_id) === String(state.excludeId)) return false;
            if (!query) return true;
            const haystack = [
                chart.display_title, chart.title, chart.first_name, chart.last_name,
                chart.person_display_name, chart.location_name,
                chart.date ? formatDate(chart.date) : '', chart.date,
                chart.chart_kind, chart.method, chart.composite_method, chart.house_system,
                getTags(chart).join(' '),
            ].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(query);
        });
    }

    function renderTags() {
        const tags = state.availableTags;
        if (!tags.length) {
            state.tagRow.innerHTML = '';
            state.tagRow.hidden = true;
            return;
        }
        state.tagRow.hidden = false;
        state.tagRow.innerHTML = tags.map((tag) => {
            const active = normalizeTag(tag) === normalizeTag(state.activeTag);
            return `<button type="button" class="chart-picker-tag${active ? ' is-active' : ''}" data-chart-picker-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`;
        }).join('');
    }

    function renderList() {
        const charts = filterCharts();
        if (!charts.length) {
            state.list.innerHTML = `<div class="quick-open-empty">${escapeHtml(t('page.chartPicker.empty', null, 'No charts found.'))}</div>`;
            return;
        }
        // Map filtered items back to their index in state.charts for selection.
        state.list.innerHTML = charts.map((chart) => {
            const index = state.charts.indexOf(chart);
            return `
                <button type="button" class="quick-open-item" data-chart-picker-index="${index}">
                    <span class="quick-open-item-main">
                        <span class="quick-open-item-title">${escapeHtml(chartTitle(chart))}</span>
                        <span class="quick-open-item-meta">${escapeHtml(chartMeta(chart) || t('common.notAvailable', null, 'Not available'))}</span>
                    </span>
                    <span class="quick-open-item-action">${escapeHtml(t('page.chartPicker.select', null, 'Select'))}</span>
                </button>
            `;
        }).join('');
    }

    async function loadCharts() {
        state.list.innerHTML = `<div class="quick-open-status">${escapeHtml(t('common.loading', null, 'Loading'))}</div>`;
        try {
            const tag = state.activeTag ? `?tag=${encodeURIComponent(state.activeTag)}` : '';
            const [charts, composites] = await Promise.all([
                apiFetch(`/charts${tag}`),
                state.includeComposites ? apiFetch(`/composite/saved${tag}`).catch(() => []) : Promise.resolve([]),
            ]);
            const regularCharts = Array.isArray(charts) ? charts : [];
            const compositeCharts = Array.isArray(composites) ? composites.map(normalizeCompositeChart) : [];
            state.charts = regularCharts.concat(compositeCharts);
            renderList();
        } catch (error) {
            state.list.innerHTML = `<div class="quick-open-empty quick-open-empty--error">${escapeHtml(error?.message || t('common.error', null, 'Error'))}</div>`;
        }
    }

    function close() {
        if (!state.root) return;
        state.root.classList.add('hidden');
        document.body.classList.remove('quick-open-active');
        state.onSelect = null;
        state.lastFocus?.focus?.();
    }

    async function open(options = {}) {
        if (typeof options.onSelect !== 'function') return;
        ensureDialog();
        state.onSelect = options.onSelect;
        state.excludeId = options.excludeId || null;
        state.includeComposites = options.includeComposites === true;
        state.query = '';
        state.activeTag = '';
        state.charts = [];
        state.availableTags = [];
        state.search.value = '';
        state.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

        if (options.title) state.root.querySelector('#chartPickerTitle').textContent = options.title;
        if (options.subtitle) state.root.querySelector('.quick-open-subtitle').textContent = options.subtitle;

        state.tagRow.hidden = true;
        state.list.innerHTML = `<div class="quick-open-status">${escapeHtml(t('common.loading', null, 'Loading'))}</div>`;
        state.root.classList.remove('hidden');
        document.body.classList.add('quick-open-active');
        state.search.focus();

        try {
            const tags = await apiFetch('/charts/tags').catch(() => []);
            state.availableTags = Array.isArray(tags) ? tags : [];
            renderTags();
        } catch (_) {
            state.availableTags = [];
        }
        await loadCharts();
    }

    root.AstroChartPicker = { open, close };
})(typeof window !== 'undefined' ? window : globalThis);

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
        query: '',
        activeTag: '',
        onSelect: null,
        excludeId: null,
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
        const date = chart.date ? formatDate(chart.date) : '';
        return [chart.person_display_name, date, chart.location_name]
            .filter(Boolean)
            .join(' · ');
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
                renderList();
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
        const tag = normalizeTag(state.activeTag);
        const query = state.query;
        return state.charts.filter((chart) => {
            if (state.excludeId && String(chart.user_id) === String(state.excludeId)) return false;
            if (tag && !getTags(chart).some((value) => normalizeTag(value) === tag)) return false;
            if (!query) return true;
            const haystack = [
                chart.display_title, chart.title, chart.first_name, chart.last_name,
                chart.person_display_name, chart.location_name,
                chart.date ? formatDate(chart.date) : '', chart.date,
                getTags(chart).join(' '),
            ].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(query);
        });
    }

    function renderTags() {
        const tagSet = new Set();
        state.charts.forEach((chart) => getTags(chart).forEach((tag) => tagSet.add(tag)));
        const tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b));
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
        state.query = '';
        state.activeTag = '';
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
            const charts = await apiFetch('/charts');
            state.charts = Array.isArray(charts) ? charts : [];
            renderTags();
            renderList();
        } catch (error) {
            state.list.innerHTML = `<div class="quick-open-empty quick-open-empty--error">${escapeHtml(error?.message || t('common.error', null, 'Error'))}</div>`;
        }
    }

    root.AstroChartPicker = { open, close };
})(typeof window !== 'undefined' ? window : globalThis);

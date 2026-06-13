(function (root) {
    'use strict';

    const API_BASE = root.AstroAPI?.API_BASE_URL || '/api/v1';

    const state = {
        root: null,
        title: null,
        subtitle: null,
        list: null,
        closeBtn: null,
        lastFocus: null,
        context: {},
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

    function ensureDialog() {
        if (state.root) return state.root;

        const rootEl = document.createElement('div');
        rootEl.className = 'quick-open-popover hidden';
        rootEl.innerHTML = `
            <div class="quick-open-backdrop" data-quick-open-close></div>
            <section class="quick-open-dialog" role="dialog" aria-modal="true" aria-labelledby="quickOpenTitle">
                <header class="quick-open-head">
                    <div>
                        <h3 class="quick-open-title" id="quickOpenTitle"></h3>
                        <p class="quick-open-subtitle"></p>
                    </div>
                    <button type="button" class="quick-open-close" data-quick-open-close aria-label="${escapeHtml(t('common.close', null, 'Close'))}">×</button>
                </header>
                <div class="quick-open-list"></div>
            </section>
        `;
        document.body.appendChild(rootEl);

        state.root = rootEl;
        state.title = rootEl.querySelector('.quick-open-title');
        state.subtitle = rootEl.querySelector('.quick-open-subtitle');
        state.list = rootEl.querySelector('.quick-open-list');
        state.closeBtn = rootEl.querySelector('.quick-open-close');

        rootEl.addEventListener('click', (event) => {
            if (event.target.closest('[data-quick-open-close]')) close();
        });
        rootEl.addEventListener('click', (event) => {
            const chartButton = event.target.closest('[data-quick-open-chart-index]');
            if (chartButton) {
                void openSavedChartByIndex(Number(chartButton.dataset.quickOpenChartIndex));
                return;
            }
            const personButton = event.target.closest('[data-quick-open-person-id]');
            if (personButton) {
                openRelatedPerson(personButton.dataset.quickOpenPersonId);
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && state.root && !state.root.classList.contains('hidden')) {
                close();
            }
        });

        return rootEl;
    }

    function openShell({ title, subtitle }) {
        ensureDialog();
        state.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        state.title.textContent = title;
        state.subtitle.textContent = subtitle || '';
        state.list.innerHTML = `<div class="quick-open-status">${escapeHtml(t('common.loading', null, 'Loading'))}</div>`;
        state.root.classList.remove('hidden');
        document.body.classList.add('quick-open-active');
        state.closeBtn?.focus();
    }

    function close() {
        if (!state.root) return;
        state.root.classList.add('hidden');
        document.body.classList.remove('quick-open-active');
        state.lastFocus?.focus?.();
    }

    function normalizeSavedChart(item) {
        if (item?.chart_type) return item;
        return {
            ...item,
            id: item?.solar_id,
            chart_type: 'solar_return',
            target_date: item?.solar_datetime ? item.solar_datetime.split('T')[0] : null,
            datetime: item?.solar_datetime,
        };
    }

    function savedChartDefaultName(chart) {
        if (chart?.chart_type === 'solar_return') {
            return t('page.clientProfile.savedCharts.defaultSolarName', { year: chart?.year || '' }, `Solar ${chart?.year || ''}`.trim());
        }
        if (chart?.chart_type === 'forecast') return t('page.clientProfile.savedCharts.defaultForecastName', null, 'Forecast');
        if (chart?.chart_type === 'progression') return t('page.clientProfile.savedCharts.defaultProgressionName', null, 'Progression');
        if (chart?.chart_type === 'direction') return t('page.clientProfile.savedCharts.defaultDirectionName', null, 'Direction');
        return t('page.clientProfile.savedCharts.defaultName', null, 'Chart');
    }

    function savedChartTypeLabel(chart) {
        const key = `page.clientProfile.savedCharts.types.${chart?.chart_type || 'chart'}`;
        const value = t(key);
        return value === key ? t('page.clientProfile.savedCharts.types.chart', null, 'Chart') : value;
    }

    function formatDate(value) {
        return root.LocaleFormatters?.formatDate?.(value) || String(value || '');
    }

    function formatDateTime(value) {
        if (!value) return '';
        return root.LocaleFormatters?.formatDateTime?.(value) || String(value).replace('T', ' ');
    }

    function renderSavedCharts(charts) {
        if (!charts.length) {
            state.list.innerHTML = `<div class="quick-open-empty">${escapeHtml(t('page.clientProfile.savedCharts.empty'))}</div>`;
            return;
        }

        state.list.innerHTML = charts.map((chart, index) => {
            const dateStr = chart.datetime
                ? formatDateTime(chart.datetime)
                : (chart.target_date ? formatDate(chart.target_date) : '');
            const meta = [
                savedChartTypeLabel(chart),
                chart.year,
                chart.location_name,
                dateStr,
            ].filter(Boolean).join(' · ');
            return `
                <button type="button" class="quick-open-item" data-quick-open-chart-index="${index}">
                    <span class="quick-open-item-main">
                        <span class="quick-open-item-title">${escapeHtml(chart.name || savedChartDefaultName(chart))}</span>
                        <span class="quick-open-item-meta">${escapeHtml(meta || t('common.notAvailable', null, 'Not available'))}</span>
                    </span>
                    <span class="quick-open-item-action">${escapeHtml(t('page.clientProfile.savedCharts.open', null, 'Open'))}</span>
                </button>
            `;
        }).join('');
    }

    function formatPersonName(person) {
        return root.RelatedPeopleUI?.formatRelatedPersonName?.(person)
            || [person?.first_name, person?.last_name].filter(Boolean).join(' ')
            || t('common.notAvailable', null, 'Not available');
    }

    function formatPersonMeta(person) {
        return root.RelatedPeopleUI?.formatRelatedPersonMeta?.(person)
            || [person?.relation_label, person?.birth_date, person?.birth_place].filter(Boolean).join(' · ')
            || t('common.notAvailable', null, 'Not available');
    }

    function renderRelatedPeople(people) {
        if (!people.length) {
            state.list.innerHTML = `<div class="quick-open-empty">${escapeHtml(t('page.clientProfile.related.empty'))}</div>`;
            return;
        }

        state.list.innerHTML = people.map((person) => `
            <button type="button" class="quick-open-item" data-quick-open-person-id="${escapeHtml(person.user_id)}">
                <span class="quick-open-item-main">
                    <span class="quick-open-item-title">${escapeHtml(formatPersonName(person))}</span>
                    <span class="quick-open-item-meta">${escapeHtml(formatPersonMeta(person))}</span>
                </span>
                <span class="quick-open-item-action">${escapeHtml(t('page.clients.consultation.types.synastry', null, 'Synastry'))}</span>
            </button>
        `).join('');
    }

    function setError(error) {
        state.list.innerHTML = `<div class="quick-open-empty quick-open-empty--error">${escapeHtml(error?.message || t('common.error', null, 'Error'))}</div>`;
    }

    async function loadNatalToSession(userId) {
        const natalData = await apiFetch(`/natal/${encodeURIComponent(String(userId))}`);
        root.AstroAPI?.saveChartToSession?.(natalData);
        if (root.AstroAPI?.chartToFormData) {
            root.AstroAPI.saveFormData?.(root.AstroAPI.chartToFormData(natalData));
        }
        return natalData;
    }

    function saveNavigationState(partnerUserId = null) {
        const { userId, sourceView, sourceUrl } = state.context;
        root.AstroAPI?.saveNavigationState?.({
            sourceView: sourceView || 'quick-open',
            sourceUrl: sourceUrl || `${window.location.pathname}${window.location.search || ''}`,
            clientUserId: String(userId || ''),
            partnerUserId: partnerUserId ? String(partnerUserId) : null,
        });
    }

    function navigate(targetUrl) {
        close();
        root.showPageLoader?.();
        window.location.href = targetUrl;
    }

    async function openSavedChartByIndex(index) {
        const chart = state.context.charts?.[index];
        const userId = state.context.userId;
        if (!chart || !userId) return;

        state.list.classList.add('quick-open-list--busy');
        try {
            await loadNatalToSession(userId);
            saveNavigationState(null);

            if (chart.chart_type === 'solar_return' && chart.year) {
                const solarData = await apiFetch(`/solar/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(chart.year))}`);
                const solarInfo = solarData.solar_info || {};
                const location = solarInfo.location || {};
                sessionStorage.setItem('solarReturnData', JSON.stringify(solarData));

                if (Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude))) {
                    localStorage.setItem('solarLocation', JSON.stringify({
                        name: location.name || '',
                        lat: Number(location.latitude),
                        lon: Number(location.longitude),
                        sourceId: '',
                        timezone: solarInfo.timezone || '',
                    }));
                }
                navigate(`/forecast-new.html?layer=solar_return&solarYear=${encodeURIComponent(String(chart.year))}`);
                return;
            }

            if (chart.url_path) {
                navigate(chart.url_path);
                return;
            }

            const params = new URLSearchParams();
            if (chart.target_date) params.set('date', chart.target_date);
            if (chart.target_time) params.set('time', String(chart.target_time).slice(0, 8));
            params.set('layer', chart.chart_type === 'direction' ? 'direction' : 'progression');
            if (chart.direction_type) params.set('directionType', chart.direction_type);
            navigate(`/forecast-new.html?${params.toString()}`);
        } catch (error) {
            state.list.classList.remove('quick-open-list--busy');
            setError(error);
        }
    }

    function openRelatedPerson(relatedUserId) {
        const userId = state.context.userId;
        if (!userId || !relatedUserId) return;
        close();
        root.AstroAPI?.openForecastForSynastry?.(userId, relatedUserId, {
            sourceView: state.context.sourceView || 'quick-open',
            sourceUrl: state.context.sourceUrl || `${window.location.pathname}${window.location.search || ''}`,
        });
    }

    async function openSavedCharts(options = {}) {
        const userId = options.userId;
        if (!userId) return;
        state.context = {
            userId,
            sourceView: options.sourceView,
            sourceUrl: options.sourceUrl,
            charts: [],
        };
        openShell({
            title: t('page.clientProfile.quickOpen.savedChartsTitle', null, 'Saved charts'),
            subtitle: t('page.clientProfile.quickOpen.savedChartsSubtitle', null, 'Choose a chart to open.'),
        });
        try {
            const profile = await apiFetch(`/users/${encodeURIComponent(String(userId))}/profile`);
            const charts = (profile.saved_charts || profile.solar_returns || []).map(normalizeSavedChart);
            state.context.charts = charts;
            renderSavedCharts(charts);
        } catch (error) {
            setError(error);
        }
    }

    async function openRelatedPeople(options = {}) {
        const userId = options.userId;
        if (!userId) return;
        state.context = {
            userId,
            sourceView: options.sourceView,
            sourceUrl: options.sourceUrl,
        };
        openShell({
            title: t('page.clientProfile.quickOpen.relatedPeopleTitle', null, 'Profile people'),
            subtitle: t('page.clientProfile.quickOpen.relatedPeopleSubtitle', null, 'Choose a person for synastry.'),
        });
        try {
            const people = await (root.AstroAPI?.getRelatedPeople?.(userId) || apiFetch(`/users/${encodeURIComponent(String(userId))}/related-people`));
            renderRelatedPeople(Array.isArray(people) ? people : []);
        } catch (error) {
            setError(error);
        }
    }

    root.AstroQuickOpen = {
        openSavedCharts,
        openRelatedPeople,
        close,
    };
})(typeof window !== 'undefined' ? window : globalThis);

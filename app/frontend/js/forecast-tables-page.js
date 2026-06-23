/**
 * forecast-tables-page.js — controller for the standalone Forecast Tables page.
 *
 * Loads the client's natal chart, fetches combined transit/progression/direction
 * data over a date range via ForecastRangeData, builds the aspect + ingress rows,
 * and renders the filterable / sortable tables.
 */
(function () {
    'use strict';

    const RD = () => window.ForecastRangeData;

    const state = {
        natalData: null,
        directionType: 'zodiacal',
        combinedData: null,
        tableRowsRaw: [],
        tableRows: [],
        sortCol: 'date',
        sortAsc: true,
    };

    const refs = {};
    let ingressTooltip = null;

    function t(key, params) {
        return window.FrontendI18n?.t?.(key, params) || key;
    }

    function escapeHtml(value) {
        return RD().escapeHtml(value);
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
        refs.empty = document.getElementById('tableEmpty');
        refs.loading = document.getElementById('tableLoading');
        refs.container = document.getElementById('tableContainer');
        refs.tableBody = document.getElementById('tableBody');
        refs.ingressSection = document.getElementById('ingressSection');
        refs.ingressBody = document.getElementById('ingressTableBody');
        refs.filterKind = document.getElementById('tableFilterKind');
        refs.filterStrength = document.getElementById('tableFilterStrength');
        refs.filterAspect = document.getElementById('tableFilterAspect');
        refs.filterMaxOrb = document.getElementById('tableFilterMaxOrb');
        refs.filterSearch = document.getElementById('tableFilterSearch');
        refs.filterReset = document.getElementById('tableFilterReset');
        refs.filtersToggle = document.getElementById('tableFiltersToggle');
        refs.filtersCount = document.getElementById('tableFiltersCount');
        refs.directionType = document.getElementById('directionTypeSelect');
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
        const rawDate = birth.date || birth.birth_date;
        const displayDate = rawDate ? (window.LocaleFormatters?.formatDate?.(rawDate) || rawDate) : '';
        const parts = [displayDate, birth.time || birth.birth_time, birth.place || birth.birth_place]
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

    // ─── Row building (ported from legacy populateTableFromCombinedData) ──
    function buildCombinedRows(combinedData, targetDate, transitPeriodEvents) {
        const rd = RD();
        const layers = combinedData?._layers || {};
        const transitLayer = layers.transit || null;
        const progressionLayer = layers.progression || null;
        const directionLayer = layers.direction || null;
        const directionType = rd.normalizeDirectionType(combinedData?._directionType || state.directionType);

        const collectLayerPlanets = (layer) => {
            if (!layer) return [];
            if (Array.isArray(layer.transit_planets)) return layer.transit_planets;
            if (Array.isArray(layer.progressed_planets)) return layer.progressed_planets;
            if (Array.isArray(layer.directed_planets)) {
                return [
                    ...layer.directed_planets,
                    ...(Array.isArray(layer.directed_angles) ? layer.directed_angles : []),
                    ...(Array.isArray(layer.directed_special_points) ? layer.directed_special_points : []),
                ];
            }
            return [];
        };

        const natalMotionMap = rd.buildPlanetMotionLookup(state.natalData?.planets || []);
        const methodRetroMaps = {
            transits: rd.buildPlanetMotionLookup(collectLayerPlanets(transitLayer)),
            progressions: rd.buildPlanetMotionLookup(collectLayerPlanets(progressionLayer)),
            directions_solar_arc: rd.buildPlanetMotionLookup(collectLayerPlanets(directionLayer)),
            directions_zodiacal: rd.buildPlanetMotionLookup(collectLayerPlanets(directionLayer)),
            directions_equatorial: rd.buildPlanetMotionLookup(collectLayerPlanets(directionLayer)),
        };

        const resolveTransitMotion = (methodName, bodyName, fallback = {}) => {
            const map = methodRetroMaps[methodName];
            const lookedUp = rd.resolvePlanetMotion(map, bodyName);
            return {
                retrograde: typeof fallback?.retrograde === 'boolean' ? fallback.retrograde : lookedUp.retrograde,
                isStationary: typeof fallback?.isStationary === 'boolean' ? fallback.isStationary : lookedUp.isStationary,
            };
        };
        const resolveNatalMotion = (bodyName) => rd.resolvePlanetMotion(natalMotionMap, bodyName);

        const rows = [];
        const ingressRows = [];
        const pushAspectRow = ({ date, method, methodClass, transit, aspect, natal, orb, isMajor, transitRetrograde = null, transitIsStationary = null }) => {
            const idx = rd.PLANET_PRIORITY.indexOf(transit);
            const transitMotion = resolveTransitMotion(method, transit, { retrograde: transitRetrograde, isStationary: transitIsStationary });
            const natalMotion = resolveNatalMotion(natal);
            rows.push({
                date: date || targetDate || '—',
                method: rd.getMethodLabel(method),
                methodClass,
                transit: transit || '—',
                aspect: aspect || '—',
                natal: natal || '—',
                orb: typeof orb === 'number' ? orb : 99,
                hasOrb: typeof orb === 'number',
                isMajor: !!isMajor,
                rowKind: 'aspect',
                type: isMajor ? t('common.majorShort') : t('common.minorShort'),
                _priority: idx < 0 ? 999 : idx,
                transitRetrograde: transitMotion.retrograde,
                transitIsStationary: transitMotion.isStationary,
                natalRetrograde: natalMotion.retrograde,
                natalIsStationary: natalMotion.isStationary,
            });
        };

        const pushIngressRows = (data, method, date) => {
            const methodClass = method.startsWith('directions') ? 'direction' : 'progression';
            (data?.planet_ingresses || []).forEach((ing) => {
                const body = ing.body || '—';
                const summaryRow = rd.getIngressSummaryRow(method, body);
                const ingressType = ing.ingress_type === 'house' ? t('page.forecast.table.ingress.house') : t('page.forecast.table.ingress.sign');
                const fromLabel = ing.ingress_type === 'house'
                    ? t('page.forecast.table.houseLabel', { house: rd.formatHouseLabel(ing.from_house ?? t('common.notAvailable')) })
                    : rd.formatSignLabel(ing.from_sign);
                const toLabel = ing.ingress_type === 'house'
                    ? t('page.forecast.table.houseLabel', { house: rd.formatHouseLabel(ing.to_house ?? t('common.notAvailable')) })
                    : rd.formatSignLabel(ing.to_sign);
                const transitMotion = resolveTransitMotion(method, body);
                ingressRows.push({
                    date: date || targetDate || '—',
                    method: rd.getMethodLabel(method),
                    methodClass,
                    object: body,
                    objectHtml: rd.formatPlanetCellHtml(body, transitMotion),
                    ingressType,
                    transition: `${fromLabel} → ${toLabel}`,
                    hoverDetails: Array.isArray(summaryRow?.hover_details) ? summaryRow.hover_details : [],
                    hoverLines: Array.isArray(summaryRow?.hover_lines) ? summaryRow.hover_lines : [],
                });
            });
            (data?.house_cusp_ingresses || []).forEach((ing) => {
                const houseLabel = t('page.forecast.table.ingress.cuspLabel', { house: rd.formatHouseLabel(ing.house_number) });
                const summaryRow = rd.getIngressSummaryRow(method, `Cusp${ing.house_number}`);
                ingressRows.push({
                    date: date || targetDate || '—',
                    method: rd.getMethodLabel(method),
                    methodClass,
                    object: houseLabel,
                    objectHtml: escapeHtml(houseLabel),
                    ingressType: t('page.forecast.table.ingress.cusp'),
                    transition: `${rd.formatSignLabel(ing.from_sign)} → ${rd.formatSignLabel(ing.to_sign)}`,
                    hoverDetails: Array.isArray(summaryRow?.hover_details) ? summaryRow.hover_details : [],
                    hoverLines: Array.isArray(summaryRow?.hover_lines) ? summaryRow.hover_lines : [],
                });
            });
        };

        if (Array.isArray(transitPeriodEvents) && transitPeriodEvents.length) {
            transitPeriodEvents.forEach((ev) => {
                pushAspectRow({
                    date: ev.t_exact ? ev.t_exact.split('T')[0] : targetDate,
                    method: 'transits',
                    methodClass: 'transit',
                    transit: ev.transit_body,
                    aspect: ev.aspect_type,
                    natal: ev.natal_body,
                    orb: ev.min_orb,
                    isMajor: ev.is_major,
                    transitRetrograde: typeof ev.transit_retrograde === 'boolean' ? ev.transit_retrograde : null,
                });
            });
        } else {
            (transitLayer?.aspects || []).forEach((a) => {
                pushAspectRow({
                    date: targetDate,
                    method: 'transits',
                    methodClass: 'transit',
                    transit: a.transit_planet,
                    aspect: a.aspect_type,
                    natal: a.natal_object,
                    orb: a.orb,
                    isMajor: a.is_major,
                });
            });
        }

        (progressionLayer?.aspects_to_natal || []).forEach((a) => {
            pushAspectRow({
                date: targetDate,
                method: 'progressions',
                methodClass: 'progression',
                transit: a.progressed_planet,
                aspect: a.aspect_type,
                natal: a.natal_object,
                orb: a.orb,
                isMajor: a.is_major,
            });
        });
        pushIngressRows(progressionLayer, 'progressions', targetDate);

        const directionMethodKey = `directions_${directionType}`;
        (directionLayer?.aspects_to_natal || []).forEach((a) => {
            pushAspectRow({
                date: targetDate,
                method: directionMethodKey,
                methodClass: 'direction',
                transit: a.directed_object,
                aspect: a.aspect_type,
                natal: a.natal_object,
                orb: a.orb,
                isMajor: a.is_major,
            });
        });
        pushIngressRows(directionLayer, directionMethodKey, targetDate);

        rows.sort((a, b) => {
            if (a.date !== b.date) return String(a.date).localeCompare(String(b.date));
            return (a._priority ?? 999) - (b._priority ?? 999) || (a.orb ?? 99) - (b.orb ?? 99);
        });

        const summaryIngressRows = rd.buildIngressRowsFromSummary(combinedData);
        return { rows, ingressRows: summaryIngressRows.length ? summaryIngressRows : ingressRows };
    }

    // ─── Filters ─────────────────────────────────────────────
    function toggleFilters(forceOpen = null) {
        const panel = document.getElementById('tableFilters');
        const btn = refs.filtersToggle;
        if (!panel || !btn) return;
        const isCollapsed = panel.classList.contains('table-filters-collapsed');
        const shouldOpen = forceOpen === null ? isCollapsed : !!forceOpen;
        panel.classList.toggle('table-filters-collapsed', !shouldOpen);
        btn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
        btn.textContent = shouldOpen
            ? t('page.forecast.table.filters.buttonOpen')
            : t('page.forecast.table.filters.buttonClosed');
    }

    function updateFiltersBadge() {
        const badge = refs.filtersCount;
        if (!badge) return;
        let active = 0;
        if ((refs.filterKind?.value || 'all') !== 'all') active += 1;
        if ((refs.filterStrength?.value || 'all') !== 'all') active += 1;
        if ((refs.filterAspect?.value || 'all') !== 'all') active += 1;
        if ((refs.filterMaxOrb?.value || '').trim()) active += 1;
        if ((refs.filterSearch?.value || '').trim()) active += 1;
        badge.textContent = String(active);
        badge.style.display = active > 0 ? '' : 'none';
    }

    function resetFilters() {
        if (refs.filterKind) refs.filterKind.value = 'all';
        if (refs.filterStrength) refs.filterStrength.value = 'all';
        if (refs.filterAspect) refs.filterAspect.value = 'all';
        if (refs.filterMaxOrb) refs.filterMaxOrb.value = '';
        if (refs.filterSearch) refs.filterSearch.value = '';
        updateFiltersBadge();
    }

    function refreshAspectOptions(rows) {
        if (!refs.filterAspect) return;
        const current = refs.filterAspect.value || 'all';
        const uniq = [...new Set((rows || []).map((r) => r.aspect).filter(Boolean))].sort();
        refs.filterAspect.innerHTML = [`<option value="all">${t('common.all')}</option>`]
            .concat(uniq.map((a) => `<option value="${a}">${a}</option>`))
            .join('');
        refs.filterAspect.value = uniq.includes(current) ? current : 'all';
    }

    function applyFiltersAndRender() {
        const raw = state.tableRowsRaw || [];
        const kind = refs.filterKind?.value || 'all';
        const strength = refs.filterStrength?.value || 'all';
        const aspect = refs.filterAspect?.value || 'all';
        const maxOrbRaw = refs.filterMaxOrb?.value?.trim();
        const search = (refs.filterSearch?.value || '').trim().toLowerCase();
        const maxOrb = maxOrbRaw ? parseFloat(maxOrbRaw) : null;

        state.tableRows = raw.filter((r) => {
            if (kind !== 'all' && r.rowKind !== kind) return false;
            if (strength === 'major' && !r.isMajor) return false;
            if (strength === 'minor' && r.isMajor !== false) return false;
            if (aspect !== 'all' && r.aspect !== aspect) return false;
            if (maxOrb !== null) {
                if (!(r.hasOrb && typeof r.orb === 'number' && r.orb <= maxOrb)) return false;
            }
            if (search) {
                const haystack = [r.transit, r.natal, r.aspect, r.type].filter(Boolean).join(' ').toLowerCase();
                if (!haystack.includes(search)) return false;
            }
            return true;
        });
        updateFiltersBadge();
        renderTableRows();
    }

    function renderTableRows() {
        const rd = RD();
        const rows = [...state.tableRows];
        const col = state.sortCol;
        const asc = state.sortAsc;
        rows.sort((a, b) => {
            let va = a[col];
            let vb = b[col];
            if (col === 'orb') { va = parseFloat(va) || 0; vb = parseFloat(vb) || 0; }
            if (va < vb) return asc ? -1 : 1;
            if (va > vb) return asc ? 1 : -1;
            return 0;
        });
        const syncSortIndicators = () => {
            document.querySelectorAll('.forecast-table th.sortable').forEach((th) => {
                const c = th.dataset.sort;
                th.classList.toggle('sort-active', c === col);
                th.classList.toggle('sort-desc', c === col && !asc);
            });
        };
        if (!rows.length) {
            refs.tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-secondary)">${t('page.forecast.table.noRowsByFilters')}</td></tr>`;
            syncSortIndicators();
            return;
        }
        refs.tableBody.innerHTML = rows.map((r) => {
            const aSym = window.Symbols?.aspects?.[r.aspect] || r.aspect;
            const harmony = rd.getAspectHarmony(r.aspect);
            const transitCell = rd.formatPlanetCellHtml(r.transit, { isRetrograde: r.transitRetrograde === true, isStationary: r.transitIsStationary === true });
            const natalCell = rd.formatPlanetCellHtml(r.natal, { isRetrograde: r.natalRetrograde === true, isStationary: r.natalIsStationary === true });
            return `<tr>
                <td>${r.date}</td>
                <td><span class="method-badge ${r.methodClass}">${r.method}</span></td>
                <td>${transitCell}</td>
                <td><span class="aspect-badge ${harmony}">${aSym} ${r.aspect}</span></td>
                <td>${natalCell}</td>
                <td>${r.orb < 99 ? r.orb.toFixed(2) + '°' : '—'}</td>
                <td>${r.type}</td>
            </tr>`;
        }).join('');
        syncSortIndicators();
    }

    // ─── Ingress section + hover tooltip ─────────────────────
    function ensureIngressTooltip() {
        if (ingressTooltip && ingressTooltip.isConnected) return ingressTooltip;
        ingressTooltip = document.body?.querySelector('.chart-tooltip.table-ingress-tooltip');
        if (!ingressTooltip) {
            ingressTooltip = document.createElement('div');
            ingressTooltip.className = 'chart-tooltip table-ingress-tooltip';
            document.body?.appendChild(ingressTooltip);
        }
        return ingressTooltip;
    }

    function placeIngressTooltip(event, tooltip) {
        if (!tooltip) return;
        let x = event.clientX + 12;
        let y = event.clientY + 6;
        const maxX = window.innerWidth - tooltip.offsetWidth - 8;
        const maxY = window.innerHeight - tooltip.offsetHeight - 8;
        x = Math.max(8, Math.min(x, Math.max(8, maxX)));
        y = Math.max(8, Math.min(y, Math.max(8, maxY)));
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
    }

    function showIngressTooltip(html, event) {
        const tooltip = ensureIngressTooltip();
        if (!tooltip) return;
        tooltip.innerHTML = html;
        tooltip.style.display = 'block';
        placeIngressTooltip(event, tooltip);
    }

    function hideIngressTooltip() {
        const tooltip = ensureIngressTooltip();
        if (tooltip) tooltip.style.display = 'none';
    }

    function bindIngressHover(container) {
        if (!container) return;
        container.querySelectorAll('.table-ingress-transition-hover').forEach((node) => {
            const getHoverHtml = () => {
                const raw = node.getAttribute('data-hover-html') || '';
                if (!raw) return '';
                try { return decodeURIComponent(raw); } catch { return raw; }
            };
            node.addEventListener('mouseenter', (event) => {
                const html = getHoverHtml();
                if (html) showIngressTooltip(html, event);
            });
            node.addEventListener('mousemove', (event) => {
                const tooltip = ensureIngressTooltip();
                if (tooltip && tooltip.style.display !== 'none') placeIngressTooltip(event, tooltip);
            });
            node.addEventListener('mouseleave', hideIngressTooltip);
        });
    }

    function renderIngressSection(rows) {
        const rd = RD();
        if (!refs.ingressSection || !refs.ingressBody) return;
        if (!rows || !rows.length) {
            refs.ingressSection.style.display = 'none';
            refs.ingressBody.innerHTML = '';
            hideIngressTooltip();
            return;
        }
        refs.ingressBody.innerHTML = rows.map((r) => {
            const hoverHtml = rd.buildIngressHoverHtml(r);
            const transitionHtml = hoverHtml
                ? `<span class="table-ingress-transition-hover" data-hover-html="${encodeURIComponent(hoverHtml)}">${escapeHtml(r.transition || '')}</span>`
                : escapeHtml(r.transition || '');
            return `<tr>
                <td>${escapeHtml(r.date || '—')}</td>
                <td><span class="method-badge ${escapeHtml(r.methodClass || '')}">${escapeHtml(r.method || '—')}</span></td>
                <td>${r.objectHtml || escapeHtml(r.object || '—')}</td>
                <td>${escapeHtml(r.ingressType || '—')}</td>
                <td>${transitionHtml}</td>
            </tr>`;
        }).join('');
        refs.ingressSection.style.display = '';
        bindIngressHover(refs.ingressBody);
    }

    // ─── Calculate ───────────────────────────────────────────
    async function calculate() {
        const start = refs.startDate.value;
        const end = refs.endDate.value;
        if (!start || !end) return;
        const targetDate = start;
        showState('loading');
        if (refs.calculate) refs.calculate.disabled = true;
        try {
            const rd = RD();
            const [periodData, combinedData] = await Promise.all([
                rd.ensureTransitPeriod(start, end),
                rd.ensureCombined(targetDate, { directionType: state.directionType }),
            ]);
            try {
                await rd.ensureIngressSummary(start, end, state.directionType);
            } catch (err) {
                console.error('Ingress summary load error:', err);
            }
            state.combinedData = combinedData;
            const { rows, ingressRows } = buildCombinedRows(combinedData, targetDate, periodData?.events || []);
            state.tableRowsRaw = rows;
            refreshAspectOptions(rows);
            resetFilters();
            applyFiltersAndRender();
            renderIngressSection(ingressRows);
            showState('content');
        } catch (err) {
            console.error('Table load error:', err);
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
        refs.directionType?.addEventListener('change', () => {
            state.directionType = RD().normalizeDirectionType(refs.directionType.value);
            if (state.combinedData) calculate();
        });
        document.querySelectorAll('#datePresets .preset-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const months = btn.dataset.months ? parseInt(btn.dataset.months, 10) : null;
                const days = btn.dataset.days ? parseInt(btn.dataset.days, 10) : null;
                if (days != null) applyDatePreset(days, 'days');
                else if (months != null) applyDatePreset(months, 'months');
            });
        });
        refs.filtersToggle?.addEventListener('click', () => toggleFilters());
        refs.filterReset?.addEventListener('click', () => { resetFilters(); applyFiltersAndRender(); });
        [refs.filterKind, refs.filterStrength, refs.filterAspect].forEach((el) => {
            el?.addEventListener('change', applyFiltersAndRender);
        });
        [refs.filterMaxOrb, refs.filterSearch].forEach((el) => {
            el?.addEventListener('input', applyFiltersAndRender);
        });
        document.querySelectorAll('.forecast-table th.sortable').forEach((th) => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (!col) return;
                if (state.sortCol === col) state.sortAsc = !state.sortAsc;
                else { state.sortCol = col; state.sortAsc = true; }
                renderTableRows();
            });
        });
    }

    async function init() {
        cacheRefs();
        await waitForI18n();
        if (window.AstroAPI?.requireAuth && !await window.AstroAPI.requireAuth({ redirectTo: '/login.html' })) return;
        if (window.AstroAPI?.getAccountPreferences) {
            try {
                window.accountPreferencesCache = await window.AstroAPI.getAccountPreferences();
                window.AstroPreferences?.setAccountVisualPreferences?.(window.accountPreferencesCache?.visual || {});
            } catch (error) {
                console.warn('Forecast tables account preferences fallback to defaults:', error);
            }
        }
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
        if (refs.directionType) state.directionType = RD().normalizeDirectionType(refs.directionType.value);
        updateHeader();
        applyDatePreset(6, 'months');
        toggleFilters(false);
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

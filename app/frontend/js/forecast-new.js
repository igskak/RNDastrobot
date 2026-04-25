(function() {
    'use strict';

    const API_BASE = window.location.hostname === 'localhost'
        ? 'http://localhost:8000/api/v1'
        : '/api/v1';
    const LAYER_ORDER = ['transit', 'progression', 'direction'];
    const DEFAULT_ASPECT_TYPES = window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES || [
        'Conjunction', 'Opposition', 'Trine', 'Square', 'Sextile',
        'Vigintile', 'Semi_Nonagon', 'Semisextile', 'Decile', 'Nonagon',
        'Semisquare', 'Quintile', 'Binonagon', 'Sentagon', 'Tridecile',
        'Sesquiquadrate', 'Biquintile', 'Quincunx',
    ];
    const PANEL_TARGET_TO_TAB = {
        natalPlanetsView: 'Planets',
        natalAspectsView: 'Aspects',
        natalGridView: 'Grid',
        natalConfigsView: 'Configs',
        natalBalancesView: 'Balances',
        progPlanetsView: 'Planets',
        progAspectsView: 'Aspects',
        progGridView: 'Grid',
        progConfigsView: 'Configs',
        progBalancesView: 'Balances',
    };
    const HOUSE_SYSTEM_CODES = {
        P: 'P',
        K: 'K',
        O: 'O',
        R: 'R',
        C: 'C',
        E: 'E',
        W: 'W',
        X: 'X',
        H: 'H',
        T: 'T',
        B: 'B',
        M: 'M',
        PLACIDUS: 'P',
        KOCH: 'K',
        PORPHYRY: 'O',
        REGIOMONTANUS: 'R',
        CAMPANUS: 'C',
        EQUAL: 'E',
        WHOLE_SIGN: 'W',
        WHOLESIGN: 'W',
    };
    const DEFAULT_ASPECT_PHASE_FILTER = ['applying', 'separating'];
    const DEFAULT_ASPECTING_BODIES = new Set([
        'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
        'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
    ]);

    const refs = {};
    const state = {
        natalData: null,
        natalWheelData: null,
        userId: null,
        targetDatetime: '',
        timezone: 'UTC',
        location: { name: '', latitude: null, longitude: null },
        activeLayers: ['transit'],
        selectedRightLayer: 'transit',
        stepMode: 'hour',
        leftTab: 'Planets',
        rightTab: 'Planets',
        matrixRows: buildDefaultForecastNewMatrixRows(),
        pageSettings: {
            houseSystem: 'P',
            orientation: 'aries',
            planetScale: 1.2,
            pointScale: 1.2,
            aspectScope: 'all',
            enabledAspectTypes: [...DEFAULT_ASPECT_TYPES],
            showApplyingSeparating: true,
            aspectPhaseFilter: [...DEFAULT_ASPECT_PHASE_FILTER],
            showSpeed: true,
            showStationary: true,
            showWheelStationary: false,
            showWheelDegree: false,
            houseNumberStyle: 'arabic',
            houseLabelsOutside: false,
        },
        viewport: { zoom: 1, panX: 0, panY: 0 },
        cache: {},
        inFlight: {},
        wheel: null,
        natalRenderer: null,
        prognosticRenderer: null,
        resolvedPreferences: null,
        hoveredAspectKey: null,
        pinnedAspectKey: null,
        activePlanetSelection: null,
        applySettingsTimer: null,
        persistTimer: null,
        requestSeq: 0,
    };

    function t(key, params) {
        return window.FrontendI18n?.t?.(key, params) || key;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    async function waitForI18nReady() {
        if (!window.FrontendI18n?.ready) return;
        await Promise.resolve(window.FrontendI18n.ready).catch(() => {});
    }

    document.addEventListener('DOMContentLoaded', async () => {
        await waitForI18nReady();
        cacheElements();
        const me = await window.AstroAPI?.requireAuth?.({ redirectTo: '/login.html' });
        if (!me) return;

        const natalData = window.AstroAPI?.getChartFromSession?.();
        if (!natalData) {
            window.location.href = '/';
            return;
        }

        state.natalData = natalData;
        state.natalWheelData = window.NatalWheelData?.prepareNatalWheelData
            ? window.NatalWheelData.prepareNatalWheelData(natalData, {
                houseSystem: natalData.birth_data?.house_system || undefined,
            })
            : natalData;
        state.userId = natalData.user_id || localStorage.getItem('currentUserId');
        state.timezone = natalData.birth_data?.timezone
            || Intl.DateTimeFormat().resolvedOptions().timeZone
            || 'UTC';
        state.location = {
            name: natalData.birth_data?.place || '',
            latitude: numberOrNull(natalData.birth_data?.latitude),
            longitude: numberOrNull(natalData.birth_data?.longitude),
        };
        state.pageSettings.houseSystem = normalizeHouseSystemCode(natalData.birth_data?.house_system || 'P');
        state.targetDatetime = getLocalNowIso(state.timezone);

        await hydratePreferences();
        hydrateState();
        applyDeepLinkParams();
        initRenderers();
        bindEvents();
        initAspectInteractions();
        syncControlsFromState();
        renderStaticNatal();
        await loadActiveLayers({ showLoader: true });
    });

    function cacheElements() {
        [
            'pageLoader', 'forecastNewLayout', 'forecastNewError', 'forecastNewErrorMsg',
            'forecastNewBackBtn', 'forecastNewTitle', 'forecastNewSubtitle', 'openNatalBtn',
            'natalPanelMeta', 'prognosticPanelTitle', 'prognosticPanelMeta',
            'forecastNewWheel', 'forecastNewWheelShell', 'targetDateInput', 'targetTimeInput',
            'stepModeSelect', 'stepBackward', 'stepForward', 'timezoneInput', 'locationInput',
            'latitudeInput', 'longitudeInput', 'targetDatetimeLabel', 'rightLayerTabs',
            'forecastNewMatrixEditor', 'forecastNewSettingsMatrixEditor',
            'forecastNewZoomIn', 'forecastNewZoomOut',
            'forecastNewZoomReset', 'forecastNewSettingsToggle', 'forecastNewSettingsPanel',
            'orientationSelect', 'houseSystemSelect', 'iconScaleRange', 'iconScaleValue',
            'aspectScopeSelect', 'aspectTypeToggles',
            'aspectPhaseApplyingToggle', 'aspectPhaseSeparatingToggle',
            'houseNumberStyleSelect', 'houseLabelsOutsideToggle',
            'showWheelStationaryToggle', 'showWheelDegreeToggle',
            'showSpeedToggle', 'showStationaryToggle',
        ].forEach((id) => {
            refs[id] = document.getElementById(id);
        });
        refs.layerToggles = [...document.querySelectorAll('[data-layer-toggle]')];
    }

    function initRenderers() {
        state.wheel = new window.PrognosticRingsWheel(refs.forecastNewWheel);
        state.natalRenderer = new ChartDataRenderer({
            planetsTableId: 'natalPlanetsTable',
            housesTableId: 'natalHousesTable',
            aspectsTableId: 'natalAspectsTable',
            aspectGridContainerId: 'natalAspectGridContainer',
            configsContainerId: 'natalConfigurationsContainer',
            balancesContainerId: 'natalBalancesContainer',
            dignitiesContainerId: 'natalDignitiesContainer',
            aspectSortHeadersSelector: '#natalAspectsView th.sortable[data-sort]',
        });
        state.prognosticRenderer = new ChartDataRenderer({
            planetsTableId: 'progPlanetsTable',
            housesTableId: 'progHousesTable',
            aspectsTableId: 'progAspectsTable',
            aspectGridContainerId: 'progAspectGridContainer',
            configsContainerId: 'progConfigurationsContainer',
            balancesContainerId: 'progBalancesContainer',
            dignitiesContainerId: 'progDignitiesContainer',
            aspectSortHeadersSelector: '#progAspectsView th.sortable[data-sort]',
        });
    }

    function bindEvents() {
        refs.openNatalBtn?.addEventListener('click', () => {
            window.AstroAPI?.saveChartToSession?.(state.natalData);
            window.AstroAPI?.saveFormData?.(window.AstroAPI.chartToFormData(state.natalData));
            window.location.href = '/natal-full.html';
        });

        refs.layerToggles.forEach((input) => {
            input.addEventListener('change', async () => {
                const layer = input.dataset.layerToggle;
                state.activeLayers = LAYER_ORDER.filter((method) => {
                    const toggle = document.querySelector(`[data-layer-toggle="${method}"]`);
                    return toggle?.checked;
                });
                if (!state.activeLayers.length) {
                    state.activeLayers = ['transit'];
                    const transitToggle = document.querySelector('[data-layer-toggle="transit"]');
                    if (transitToggle) transitToggle.checked = true;
                }
                if (layer && !state.activeLayers.includes(state.selectedRightLayer)) {
                    state.selectedRightLayer = state.activeLayers[0];
                }
                schedulePersist();
                await loadActiveLayers();
            });
        });

        refs.targetDateInput?.addEventListener('change', onTargetDatetimeChange);
        refs.targetTimeInput?.addEventListener('change', onTargetDatetimeChange);
        refs.stepModeSelect?.addEventListener('change', () => {
            state.stepMode = refs.stepModeSelect.value;
            schedulePersist();
        });
        refs.stepBackward?.addEventListener('click', () => stepTargetDatetime(-1));
        refs.stepForward?.addEventListener('click', () => stepTargetDatetime(1));

        ['timezoneInput', 'locationInput', 'latitudeInput', 'longitudeInput'].forEach((id) => {
            refs[id]?.addEventListener('change', async () => {
                state.timezone = refs.timezoneInput.value.trim() || state.timezone;
                state.location = {
                    name: refs.locationInput.value.trim(),
                    latitude: numberOrNull(refs.latitudeInput.value),
                    longitude: numberOrNull(refs.longitudeInput.value),
                };
                schedulePersist();
                await loadActiveLayers();
            });
        });

        document.querySelectorAll('.forecast-new-side-panel').forEach((panel) => {
            panel.addEventListener('click', (event) => {
                const tab = event.target.closest('.panel-tab[data-panel-target]');
                if (!tab) return;
                activatePanelTab(panel, tab.dataset.panelTarget);
                if (panel.id === 'forecastNewNatalPanel') state.leftTab = PANEL_TARGET_TO_TAB[tab.dataset.panelTarget] || 'Planets';
                if (panel.id === 'forecastNewProgPanel') state.rightTab = PANEL_TARGET_TO_TAB[tab.dataset.panelTarget] || 'Planets';
                syncHoveredAspectToActiveSurface();
                schedulePersist();
            });
        });

        refs.rightLayerTabs?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-right-layer]');
            if (!button) return;
            state.selectedRightLayer = button.dataset.rightLayer;
            renderRightPanel();
            schedulePersist();
        });

        [refs.forecastNewMatrixEditor, refs.forecastNewSettingsMatrixEditor].forEach((editor) => {
            editor?.addEventListener('change', (event) => {
                const container = event.currentTarget;
                state.matrixRows = normalizeForecastNewMatrixRows(readMatrixRows(container));
                renderMatrixEditor();
                renderInlineMatrixControls();
                scheduleApplySettings();
            });
        });
        refs.forecastNewNatalPanel?.addEventListener('click', (event) => {
            if (event.target instanceof Element && event.target.closest('.forecast-new-matrix-inline')) {
                event.stopPropagation();
            }
        });
        refs.forecastNewNatalPanel?.addEventListener('change', async (event) => {
            const input = event.target;
            if (!(input instanceof HTMLInputElement) || !input.matches('input[data-matrix-body][data-matrix-field]')) return;
            updateMatrixRowFromControl(input);
            renderMatrixEditor();
            renderInlineMatrixControls();
            await applySettings();
        });

        refs.forecastNewSettingsToggle?.addEventListener('click', (event) => {
            event.stopPropagation();
            refs.forecastNewSettingsPanel?.classList.toggle('hidden');
        });
        refs.forecastNewSettingsPanel?.addEventListener('click', (event) => event.stopPropagation());
        document.addEventListener('click', () => refs.forecastNewSettingsPanel?.classList.add('hidden'));
        [
            refs.orientationSelect,
            refs.houseSystemSelect,
            refs.iconScaleRange,
            refs.aspectScopeSelect,
            refs.aspectPhaseApplyingToggle,
            refs.aspectPhaseSeparatingToggle,
            refs.houseNumberStyleSelect,
            refs.houseLabelsOutsideToggle,
            refs.showWheelStationaryToggle,
            refs.showWheelDegreeToggle,
            refs.showSpeedToggle,
            refs.showStationaryToggle,
        ].forEach((control) => {
            control?.addEventListener(control === refs.iconScaleRange ? 'input' : 'change', () => {
                if (refs.iconScaleRange && refs.iconScaleValue) {
                    refs.iconScaleValue.textContent = `${refs.iconScaleRange.value}%`;
                }
                scheduleApplySettings();
            });
        });
        refs.aspectTypeToggles?.addEventListener('change', () => scheduleApplySettings());

        refs.forecastNewZoomIn?.addEventListener('click', () => setViewport({ zoom: state.viewport.zoom * 1.18 }));
        refs.forecastNewZoomOut?.addEventListener('click', () => setViewport({ zoom: state.viewport.zoom / 1.18 }));
        refs.forecastNewZoomReset?.addEventListener('click', () => setViewport({ zoom: 1, panX: 0, panY: 0 }));
        bindWheelPanZoom();

        document.addEventListener('frontend:locale-changed', () => {
            renderStaticNatal();
            renderRightPanel();
            renderWheel();
        });

        document.addEventListener('click', (event) => {
            if (!(event.target instanceof Element)) return;
            if (event.target.closest('tr[data-planet]') || event.target.closest('.prognostic-body')) return;
            clearPlanetSelection();
            if (event.target.closest('tr[data-aspect-key]') || event.target.closest('td[data-aspect-key]') || event.target.closest('.aspect-line')) return;
            if (state.pinnedAspectKey) {
                state.pinnedAspectKey = null;
                state.hoveredAspectKey = null;
                applyHoveredAspectFocus();
            }
        });
    }

    function bindWheelPanZoom() {
        const shell = refs.forecastNewWheelShell;
        if (!shell) return;
        let panning = false;
        let startX = 0;
        let startY = 0;
        shell.addEventListener('wheel', (event) => {
            event.preventDefault();
            setViewport({ zoom: state.viewport.zoom * (event.deltaY > 0 ? 0.92 : 1.08) });
        }, { passive: false });
        shell.addEventListener('mousedown', (event) => {
            if (event.button !== 0) return;
            panning = true;
            startX = event.clientX;
            startY = event.clientY;
        });
        window.addEventListener('mousemove', (event) => {
            if (!panning) return;
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;
            startX = event.clientX;
            startY = event.clientY;
            setViewport({ panX: state.viewport.panX + dx, panY: state.viewport.panY + dy }, { persist: false });
        });
        window.addEventListener('mouseup', () => {
            if (panning) schedulePersist();
            panning = false;
        });
    }

    function setViewport(next, options = {}) {
        state.viewport = {
            zoom: clamp(Number(next.zoom ?? state.viewport.zoom), 0.5, 5),
            panX: Number.isFinite(Number(next.panX)) ? Number(next.panX) : state.viewport.panX,
            panY: Number.isFinite(Number(next.panY)) ? Number(next.panY) : state.viewport.panY,
        };
        applyViewport();
        if (options.persist !== false) schedulePersist();
    }

    function applyViewport() {
        if (!refs.forecastNewWheel) return;
        refs.forecastNewWheel.style.transform = `translate(${state.viewport.panX}px, ${state.viewport.panY}px) scale(${state.viewport.zoom})`;
        refs.forecastNewWheel.style.transformOrigin = 'center center';
    }

    function syncControlsFromState() {
        const [date, time] = splitTargetDatetime(state.targetDatetime);
        if (refs.targetDateInput) refs.targetDateInput.value = date;
        if (refs.targetTimeInput) refs.targetTimeInput.value = time;
        if (refs.stepModeSelect) refs.stepModeSelect.value = state.stepMode;
        if (refs.timezoneInput) refs.timezoneInput.value = state.timezone;
        if (refs.locationInput) refs.locationInput.value = state.location.name || '';
        if (refs.latitudeInput) refs.latitudeInput.value = state.location.latitude ?? '';
        if (refs.longitudeInput) refs.longitudeInput.value = state.location.longitude ?? '';
        if (refs.houseSystemSelect) refs.houseSystemSelect.value = normalizeHouseSystemCode(state.pageSettings.houseSystem);
        if (refs.orientationSelect) refs.orientationSelect.value = state.pageSettings.orientation;
        if (refs.iconScaleRange) refs.iconScaleRange.value = String(Math.round((state.pageSettings.planetScale || 1.2) * 100));
        if (refs.iconScaleValue) refs.iconScaleValue.textContent = `${Math.round((state.pageSettings.planetScale || 1.2) * 100)}%`;
        if (refs.aspectScopeSelect) refs.aspectScopeSelect.value = state.pageSettings.aspectScope;
        if (refs.aspectPhaseApplyingToggle) refs.aspectPhaseApplyingToggle.checked = getAspectPhaseFilter().includes('applying');
        if (refs.aspectPhaseSeparatingToggle) refs.aspectPhaseSeparatingToggle.checked = getAspectPhaseFilter().includes('separating');
        if (refs.houseNumberStyleSelect) refs.houseNumberStyleSelect.value = state.pageSettings.houseNumberStyle === 'roman' ? 'roman' : 'arabic';
        if (refs.houseLabelsOutsideToggle) refs.houseLabelsOutsideToggle.checked = state.pageSettings.houseLabelsOutside === true;
        if (refs.showWheelStationaryToggle) refs.showWheelStationaryToggle.checked = state.pageSettings.showWheelStationary === true;
        if (refs.showWheelDegreeToggle) refs.showWheelDegreeToggle.checked = state.pageSettings.showWheelDegree === true;
        if (refs.showSpeedToggle) refs.showSpeedToggle.checked = state.pageSettings.showSpeed !== false;
        if (refs.showStationaryToggle) refs.showStationaryToggle.checked = state.pageSettings.showStationary !== false;
        refs.layerToggles.forEach((input) => {
            input.checked = state.activeLayers.includes(input.dataset.layerToggle);
        });
        updateHeaderInfo();
        renderMatrixEditor();
        renderAspectTypeToggles();
        applyViewport();
    }

    function updateHeaderInfo() {
        const birth = state.natalData?.birth_data || {};
        const name = [birth.first_name, birth.last_name].filter(Boolean).join(' ').trim() || 'Клиент';
        refs.forecastNewTitle.textContent = `${name} · Прогностика New`;
        refs.forecastNewSubtitle.textContent = [birth.date, birth.time, birth.place].filter(Boolean).join(' · ');
        refs.natalPanelMeta.textContent = [birth.date, birth.time, birth.place].filter(Boolean).join(' · ');
    }

    function renderStaticNatal() {
        state.natalRenderer?.setAspectTypeFilter?.('all');
        state.natalRenderer?.setDisplayPreferences?.({
            showSpeed: state.pageSettings.showSpeed !== false,
            showStationary: state.pageSettings.showStationary !== false,
            showApplyingSeparating: state.pageSettings.showApplyingSeparating === true,
        });
        state.natalRenderer?.render(filterChartDataForRenderer(state.natalWheelData));
        state.natalRenderer?.renderPlanets(state.natalWheelData?.planets || []);
        state.natalRenderer?.renderHouses(state.natalWheelData?.houses || []);
        renderInlineMatrixControls();
        applyInlineMatrixRowState();
        renderMatrixEditor();
        activateSavedTabs();
    }

    function renderMatrixEditor() {
        const bodies = window.AstroPreferences?.MATRIX_BODIES || [];
        const rows = ensureMatrixRows(state.matrixRows);
        const markup = `
            <table class="natal-matrix-table forecast-new-matrix-table">
                <thead><tr><th>Body</th><th>Display</th><th>Aspecting</th></tr></thead>
                <tbody>
                    ${bodies.map((body) => {
                        const label = escapeHtml(planetName(body));
                        const symbol = Symbols?.getPlanetSymbolMarkup?.(body, { size: 18, title: planetName(body) })
                            || `<span class="astro-symbol">${escapeHtml(Symbols?.getPlanetSymbol?.(body) || '')}</span>`;
                        return `
                            <tr>
                                <td><span class="natal-matrix-body natal-matrix-body--icon-only" title="${label}" aria-label="${label}">${symbol}</span></td>
                                <td><input type="checkbox" data-matrix-body="${body}" data-matrix-field="display" ${rows?.[body]?.display !== false ? 'checked' : ''}></td>
                                <td><input type="checkbox" data-matrix-body="${body}" data-matrix-field="aspecting" ${rows?.[body]?.aspecting !== false ? 'checked' : ''}></td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        [refs.forecastNewMatrixEditor, refs.forecastNewSettingsMatrixEditor].forEach((container) => {
            if (container) container.innerHTML = markup;
        });
    }

    function readMatrixRows(container = refs.forecastNewMatrixEditor || refs.forecastNewSettingsMatrixEditor) {
        const rows = normalizeForecastNewMatrixRows(state.matrixRows);
        container?.querySelectorAll('input[data-matrix-body][data-matrix-field]').forEach((input) => {
            const body = input.dataset.matrixBody;
            const field = input.dataset.matrixField;
            rows[body] = { ...(rows[body] || { display: true, aspecting: true }), [field]: input.checked };
        });
        return normalizeForecastNewMatrixRows(rows);
    }

    function updateMatrixRowFromControl(input) {
        const body = matrixBodyKey(input.dataset.matrixBody);
        const field = input.dataset.matrixField;
        if (!body || !['display', 'aspecting'].includes(field)) return;
        const rows = normalizeForecastNewMatrixRows(state.matrixRows);
        rows[body] = { ...(rows[body] || { display: true, aspecting: true }), [field]: input.checked };
        state.matrixRows = normalizeForecastNewMatrixRows(rows);
    }

    function renderInlineMatrixControls() {
        const rows = normalizeForecastNewMatrixRows(state.matrixRows);
        refs.forecastNewLayout?.querySelectorAll('.forecast-new-matrix-inline-cell').forEach((cell) => cell.remove());

        document.querySelectorAll('#natalPlanetsTable tr[data-planet]').forEach((row) => {
            const body = matrixBodyKey(row.dataset.planet);
            row.insertAdjacentHTML('beforeend', matrixControlCells(body, rows));
        });

        document.querySelectorAll('#natalHousesTable tr[id^="row-house-"]').forEach((row) => {
            const houseNumber = Number(String(row.id).replace('row-house-', ''));
            const body = matrixBodyForHouse(houseNumber);
            row.insertAdjacentHTML('beforeend', matrixControlCells(body, rows));
        });
    }

    function applyInlineMatrixRowState() {
        const rows = normalizeForecastNewMatrixRows(state.matrixRows);

        document.querySelectorAll('#natalPlanetsTable tr[data-planet]').forEach((row) => {
            const body = matrixBodyKey(row.dataset.planet);
            const config = rows?.[body] || { display: true, aspecting: true };
            row.classList.toggle('forecast-new-matrix-row-display-off', config.display === false);
            row.classList.toggle('forecast-new-matrix-row-aspecting-off', config.aspecting === false);
        });

        document.querySelectorAll('#natalHousesTable tr[id^="row-house-"]').forEach((row) => {
            const houseNumber = Number(String(row.id).replace('row-house-', ''));
            const body = matrixBodyForHouse(houseNumber);
            const config = body ? (rows?.[body] || { display: true, aspecting: true }) : null;
            row.classList.toggle('forecast-new-matrix-row-display-off', Boolean(config) && config.display === false);
            row.classList.toggle('forecast-new-matrix-row-aspecting-off', Boolean(config) && config.aspecting === false);
        });
    }

    function matrixControlCells(bodyName, rows) {
        const body = matrixBodyKey(bodyName);
        if (!body) {
            return '<td class="forecast-new-matrix-inline-cell forecast-new-matrix-inline-empty"></td><td class="forecast-new-matrix-inline-cell forecast-new-matrix-inline-empty"></td>';
        }
        return ['display', 'aspecting'].map((field) => {
            const checked = rows?.[body]?.[field] !== false ? 'checked' : '';
            const shortLabel = field === 'display' ? 'Показ' : 'Аспектация';
            const label = `${shortLabel}: ${planetName(body)}`;
            return `
                <td class="forecast-new-matrix-inline-cell">
                    <label class="forecast-new-matrix-inline" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
                        <input type="checkbox" data-matrix-body="${escapeHtml(body)}" data-matrix-field="${field}" ${checked}>
                    </label>
                </td>
            `;
        }).join('');
    }

    function matrixBodyForHouse(houseNumber) {
        return ({ 1: 'ASC', 4: 'IC', 7: 'DSC', 10: 'MC' })[houseNumber] || '';
    }

    function matrixBodyKey(name) {
        return window.AstroPreferences?.normalizeMatrixBodyName
            ? window.AstroPreferences.normalizeMatrixBodyName(name)
            : String(name || '');
    }

    function renderAspectTypeToggles() {
        if (!refs.aspectTypeToggles) return;
        const enabled = new Set(state.pageSettings.enabledAspectTypes?.length ? state.pageSettings.enabledAspectTypes : DEFAULT_ASPECT_TYPES);
        refs.aspectTypeToggles.innerHTML = DEFAULT_ASPECT_TYPES.map((aspectType) => {
            const label = escapeHtml(aspectName(aspectType));
            const symbol = escapeHtml(Symbols?.getAspectDisplay?.(aspectType) || Symbols?.aspects?.[aspectType] || aspectType[0]);
            return `
                <label class="settings-check-option settings-check-option--pill settings-check-option--icon-only" title="${label}">
                    <input type="checkbox" data-aspect-type="${aspectType}" ${enabled.has(aspectType) ? 'checked' : ''} aria-label="${label}">
                    <span class="settings-check-option-glyph" aria-hidden="true"><span class="astro-symbol">${symbol}</span></span>
                </label>
            `;
        }).join('');
    }

    function readEnabledAspectTypesFromControls() {
        const enabled = [];
        refs.aspectTypeToggles?.querySelectorAll('input[data-aspect-type]').forEach((input) => {
            if (input.checked && input.dataset.aspectType) {
                enabled.push(input.dataset.aspectType);
            }
        });
        return enabled.length ? enabled : [...DEFAULT_ASPECT_TYPES];
    }

    function scheduleApplySettings() {
        clearTimeout(state.applySettingsTimer);
        state.applySettingsTimer = setTimeout(async () => {
            try {
                await applySettings();
            } finally {
                state.applySettingsTimer = null;
            }
        }, 120);
    }

    async function applySettings() {
        const nextHouseSystem = normalizeHouseSystemCode(refs.houseSystemSelect?.value || state.pageSettings.houseSystem);
        const nextOrientation = refs.orientationSelect?.value === 'asc' ? 'asc' : 'aries';
        const iconScale = clampPointScale(Number(refs.iconScaleRange?.value || Math.round((state.pageSettings.planetScale || 1.2) * 100)) / 100);
        const nextAspectScope = ['all', 'major', 'minor'].includes(refs.aspectScopeSelect?.value)
            ? refs.aspectScopeSelect.value
            : 'all';
        const nextEnabledAspectTypes = window.AstroPreferences?.healEnabledAspectTypesForScope
            ? window.AstroPreferences.healEnabledAspectTypesForScope(
                readEnabledAspectTypesFromControls(),
                nextAspectScope,
                DEFAULT_ASPECT_TYPES,
            )
            : readEnabledAspectTypesFromControls();
        const nextAspectPhaseFilter = normalizeAspectPhaseFilter([
            refs.aspectPhaseApplyingToggle?.checked === true ? 'applying' : null,
            refs.aspectPhaseSeparatingToggle?.checked === true ? 'separating' : null,
        ]);

        state.pageSettings = {
            ...state.pageSettings,
            houseSystem: nextHouseSystem,
            orientation: nextOrientation,
            planetScale: iconScale,
            pointScale: iconScale,
            aspectScope: nextAspectScope,
            enabledAspectTypes: nextEnabledAspectTypes,
            showApplyingSeparating: nextAspectPhaseFilter.length > 0,
            aspectPhaseFilter: nextAspectPhaseFilter,
            showSpeed: refs.showSpeedToggle?.checked !== false,
            showStationary: refs.showStationaryToggle?.checked !== false,
            showWheelStationary: refs.showWheelStationaryToggle?.checked === true,
            showWheelDegree: refs.showWheelDegreeToggle?.checked === true,
            houseNumberStyle: refs.houseNumberStyleSelect?.value === 'roman' ? 'roman' : 'arabic',
            houseLabelsOutside: refs.houseLabelsOutsideToggle?.checked === true,
        };

        if (refs.iconScaleValue) {
            refs.iconScaleValue.textContent = `${Math.round(iconScale * 100)}%`;
        }

        try {
            await persistForecastNewViewOverrides();
        } catch (error) {
            console.warn('Failed to persist Forecast New settings:', error);
        }

        if (state.pageSettings.houseSystem !== normalizeHouseSystemCode(state.natalData?.birth_data?.house_system || 'P')) {
            await updateHouseSystem(nextHouseSystem);
        } else {
            renderStaticNatal();
            renderRightPanel();
            renderWheel();
        }
        schedulePersist();
    }

    async function updateHouseSystem(nextHouseSystem) {
        if (!state.userId || !window.AstroAPI?.updateUserHouseSystem) {
            renderStaticNatal();
            renderRightPanel();
            renderWheel();
            return;
        }

        try {
            const natalData = await window.AstroAPI.updateUserHouseSystem(state.userId, nextHouseSystem);
            state.natalData = natalData;
            state.natalWheelData = window.NatalWheelData?.prepareNatalWheelData
                ? window.NatalWheelData.prepareNatalWheelData(natalData, { houseSystem: nextHouseSystem })
                : natalData;
            updateHeaderInfo();
            renderStaticNatal();
            await loadActiveLayers();
        } catch (error) {
            console.error('Forecast New house system update failed:', error);
            state.pageSettings.houseSystem = normalizeHouseSystemCode(state.natalData?.birth_data?.house_system || 'P');
            syncControlsFromState();
        }
    }

    async function onTargetDatetimeChange() {
        const date = refs.targetDateInput?.value || splitTargetDatetime(state.targetDatetime)[0];
        const time = refs.targetTimeInput?.value || '12:00:00';
        state.targetDatetime = `${date}T${normalizeTime(time)}`;
        schedulePersist();
        await loadActiveLayers();
    }

    async function stepTargetDatetime(direction) {
        state.targetDatetime = addStep(state.targetDatetime, state.stepMode, direction);
        syncControlsFromState();
        schedulePersist();
        await loadActiveLayers();
    }

    async function loadActiveLayers(options = {}) {
        const seq = ++state.requestSeq;
        if (options.showLoader) showLoader();
        try {
            const layers = {};
            await Promise.all(state.activeLayers.map(async (method) => {
                layers[method] = await fetchLayer(method);
            }));
            if (seq !== state.requestSeq) return;
            state.layers = layers;
            renderWheel();
            renderRightLayerTabs();
            renderRightPanel();
            showLayout();
            schedulePersist();
        } catch (error) {
            console.error('Forecast New load failed:', error);
            showError(error.message || 'Ошибка загрузки прогностики');
        } finally {
            hideLoader();
        }
    }

    async function fetchLayer(method) {
        const [date, time] = splitTargetDatetime(state.targetDatetime);
        const key = method === 'transit'
            ? `${method}|${state.targetDatetime}|${state.timezone}`
            : `${method}|${date}`;
        if (state.cache[key]) return state.cache[key];
        if (state.inFlight[key]) return state.inFlight[key];

        const request = (async () => {
            if (method === 'transit') {
                return apiPost('/transits/calculate', {
                    user_id: state.userId,
                    date,
                    time,
                    timezone: state.timezone,
                });
            }
            if (method === 'progression') {
                return apiPost('/progressions/calculate', {
                    user_id: state.userId,
                    target_date: date,
                });
            }
            return apiPost('/directions/calculate', {
                user_id: state.userId,
                target_date: date,
                direction_type: 'solar_arc',
            });
        })().then((data) => {
            state.cache[key] = data;
            return data;
        }).finally(() => {
            delete state.inFlight[key];
        });

        state.inFlight[key] = request;
        return request;
    }

    async function apiPost(endpoint, body) {
        const withLocaleHeaders = window.AstroAPI?.withLocaleHeaders || ((headers) => headers);
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: withLocaleHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            let detail = `HTTP ${response.status}`;
            try {
                const error = await response.json();
                detail = typeof error?.detail === 'string' ? error.detail : JSON.stringify(error?.detail || error);
            } catch {
                detail = await response.text().catch(() => detail);
            }
            throw new Error(detail);
        }
        return response.json();
    }

    function renderWheel() {
        if (!state.wheel || !state.natalWheelData) return;
        const rawViewModel = window.PrognosticLayerNormalizer.buildViewModel(
            state.natalWheelData,
            state.layers || {},
            { activeMethods: state.activeLayers },
        );
        const viewModel = filterViewModelForSettings(rawViewModel);
        state.viewModel = viewModel;
        state.wheel.setOptions({
            houseSystem: state.pageSettings.houseSystem,
            orientation: state.pageSettings.orientation,
            matrixRows: state.matrixRows,
            planetScale: state.pageSettings.planetScale,
            pointScale: state.pageSettings.pointScale,
            aspectScope: state.pageSettings.aspectScope,
            enabledAspectTypes: state.pageSettings.enabledAspectTypes,
            houseNumberStyle: state.pageSettings.houseNumberStyle,
            houseLabelsOutside: state.pageSettings.houseLabelsOutside,
            showPlanetStationary: state.pageSettings.showWheelStationary,
            showPlanetDegree: state.pageSettings.showWheelDegree,
        });
        state.wheel.render(viewModel);
        applyHoveredAspectFocus();
    }

    function renderRightLayerTabs() {
        if (!refs.rightLayerTabs) return;
        if (!state.activeLayers.includes(state.selectedRightLayer)) {
            state.selectedRightLayer = state.activeLayers[0] || 'transit';
        }
        refs.rightLayerTabs.innerHTML = state.activeLayers.map((method) => `
            <button type="button" class="forecast-new-right-layer-tab ${method === state.selectedRightLayer ? 'active' : ''}" data-right-layer="${method}">
                ${layerLabel(method)}
            </button>
        `).join('');
    }

    function renderRightPanel() {
        const method = state.selectedRightLayer;
        const layer = state.viewModel?.activePrognosticLayers?.find((item) => item.method === method);
        refs.prognosticPanelTitle.textContent = layerLabel(method);
        refs.prognosticPanelMeta.textContent = buildLayerMeta(method, layer?.raw);
        refs.targetDatetimeLabel.textContent = state.targetDatetime.replace('T', ' ');

        if (!layer) {
            state.prognosticRenderer?.render({ planets: [], houses: [], aspects: [], aspect_configurations: [], stelliums: [], balances: null, cosmogram_pattern: null });
            return;
        }
        state.prognosticRenderer?.setAspectTypeFilter?.('all');
        state.prognosticRenderer?.setDisplayPreferences?.({
            showSpeed: state.pageSettings.showSpeed !== false,
            showStationary: state.pageSettings.showStationary !== false,
            showApplyingSeparating: state.pageSettings.showApplyingSeparating === true,
        });
        state.prognosticRenderer?.render(filterChartDataForRenderer({
            planets: layer.bodies || [],
            houses: layer.houses || [],
            aspects: layer.aspects || [],
            aspect_configurations: [],
            stelliums: [],
            balances: null,
            cosmogram_pattern: null,
        }));
        syncHoveredAspectToActiveSurface();
        activateSavedTabs();
    }

    function initAspectInteractions() {
        const aspectsPane = document.getElementById('progAspectsView');
        if (aspectsPane) {
            aspectsPane.addEventListener('mouseover', (event) => {
                if (state.pinnedAspectKey) return;
                if (!(event.target instanceof Element)) return;
                const row = event.target.closest('tr[data-aspect-key]');
                const key = row?.dataset?.aspectKey;
                if (key) setHoveredAspectKey(key);
            });

            aspectsPane.addEventListener('mouseout', (event) => {
                if (state.pinnedAspectKey) return;
                if (!(event.target instanceof Element)) return;
                const row = event.target.closest('tr[data-aspect-key]');
                if (!row) return;
                if (row.contains(event.relatedTarget)) return;
                setHoveredAspectKey(null);
            });

            aspectsPane.addEventListener('click', (event) => {
                if (!(event.target instanceof Element)) return;
                const row = event.target.closest('tr[data-aspect-key]');
                const key = row?.dataset?.aspectKey;
                if (!key) return;
                togglePinnedAspectKey(key);
            });
        }

        const gridPane = document.getElementById('progGridView');
        if (gridPane) {
            gridPane.addEventListener('mouseover', (event) => {
                if (state.pinnedAspectKey) return;
                if (!(event.target instanceof Element)) return;
                const cell = event.target.closest('td[data-aspect-key]');
                const key = cell?.dataset?.aspectKey;
                if (key) setHoveredAspectKey(key);
            });

            gridPane.addEventListener('mouseout', (event) => {
                if (state.pinnedAspectKey) return;
                if (!(event.target instanceof Element)) return;
                const cell = event.target.closest('td[data-aspect-key]');
                if (!cell) return;
                if (cell.contains(event.relatedTarget)) return;
                setHoveredAspectKey(null);
            });

            gridPane.addEventListener('click', (event) => {
                if (!(event.target instanceof Element)) return;
                const cell = event.target.closest('td[data-aspect-key]');
                const key = cell?.dataset?.aspectKey;
                if (!key) return;
                togglePinnedAspectKey(key);
            });
        }

        document.addEventListener('chart:aspect-hover', (event) => {
            const key = event?.detail?.aspectKey;
            if (!key) return;
            if (state.pinnedAspectKey) return;
            setHoveredAspectKey(key);
        });

        document.addEventListener('chart:aspect-leave', (event) => {
            const key = event?.detail?.aspectKey || null;
            if (state.pinnedAspectKey) return;
            if (key && state.hoveredAspectKey && key !== state.hoveredAspectKey) return;
            setHoveredAspectKey(null);
        });

        refs.forecastNewWheel?.addEventListener('click', (event) => {
            if (!(event.target instanceof Element)) return;
            const line = event.target.closest('.aspect-line');
            const key = line?.dataset?.aspectKey;
            if (!key) return;
            togglePinnedAspectKey(key);
        });

        bindPlanetTableInteractions(document.getElementById('forecastNewNatalPanel'), 'natal');
        bindPlanetTableInteractions(document.getElementById('forecastNewProgPanel'), 'prog');
        bindHouseTableInteractions(document.getElementById('forecastNewNatalPanel'), 'natal');
        bindHouseTableInteractions(document.getElementById('forecastNewProgPanel'), 'prog');
    }

    function setHoveredAspectKey(aspectKey) {
        state.hoveredAspectKey = aspectKey || null;
        applyHoveredAspectFocus();
    }

    function togglePinnedAspectKey(aspectKey) {
        const normalized = aspectKey || null;
        state.pinnedAspectKey = state.pinnedAspectKey === normalized ? null : normalized;
        state.hoveredAspectKey = state.pinnedAspectKey;
        applyHoveredAspectFocus();
    }

    function applyHoveredAspectFocus() {
        if (state.wheel?.clearHoveredAspect) {
            state.wheel.clearHoveredAspect();
        }
        const activeAspectKey = state.pinnedAspectKey || state.hoveredAspectKey || null;
        if (activeAspectKey && state.wheel?.setHoveredAspect) {
            state.wheel.setHoveredAspect(activeAspectKey);
        }
        syncHoveredAspectToActiveSurface();
    }

    function getActiveProgAspectSurface() {
        if (document.getElementById('progAspectsView')?.classList.contains('active')) return 'table';
        if (document.getElementById('progGridView')?.classList.contains('active')) return 'grid';
        return null;
    }

    function syncHoveredAspectToActiveSurface() {
        const renderer = state.prognosticRenderer;
        if (!renderer || typeof renderer.setHoveredAspect !== 'function') return;

        const surface = getActiveProgAspectSurface();
        const activeAspectKey = state.pinnedAspectKey || state.hoveredAspectKey || null;
        if (!activeAspectKey || !surface) {
            renderer.clearHoveredAspect?.();
            return;
        }

        renderer.setHoveredAspect(activeAspectKey, { surface });
    }

    function bindPlanetTableInteractions(panel, scope) {
        if (!panel) return;
        const planetsPane = panel;

        planetsPane.addEventListener('mouseover', (event) => {
            if (!(event.target instanceof Element)) return;
            const row = event.target.closest('tr[data-planet]');
            if (!row) return;
            const planetName = row.dataset.planet;
            const method = scope === 'natal' ? 'natal' : state.selectedRightLayer;
            hoverPlanetRow(planetName, method, row, true);
        });

        planetsPane.addEventListener('mouseout', (event) => {
            if (!(event.target instanceof Element)) return;
            const row = event.target.closest('tr[data-planet]');
            if (!row) return;
            if (row.contains(event.relatedTarget)) return;
            if (state.activePlanetSelection?.key) return;
            clearPlanetHover();
        });

        planetsPane.addEventListener('click', (event) => {
            if (!(event.target instanceof Element)) return;
            if (event.target.closest('.forecast-new-matrix-inline')) return;
            const row = event.target.closest('tr[data-planet]');
            if (!row) return;
            event.stopPropagation();
            const planetName = row.dataset.planet;
            const method = scope === 'natal' ? 'natal' : state.selectedRightLayer;
            togglePlanetSelection(planetName, method, row, scope);
        });
    }

    function bindHouseTableInteractions(panel, scope) {
        if (!panel) return;

        panel.addEventListener('mouseover', (event) => {
            if (!(event.target instanceof Element)) return;
            const row = event.target.closest('tr[id^="row-house-"]');
            if (!row) return;
            const houseNumber = Number(String(row.id).replace('row-house-', ''));
            if (!Number.isFinite(houseNumber)) return;
            const method = scope === 'natal' ? 'natal' : state.selectedRightLayer;
            hoverHouseRow(houseNumber, method, row);
        });

        panel.addEventListener('mouseout', (event) => {
            if (!(event.target instanceof Element)) return;
            const row = event.target.closest('tr[id^="row-house-"]');
            if (!row) return;
            if (row.contains(event.relatedTarget)) return;
            clearHouseHover();
        });
    }

    function hoverPlanetRow(planetName, method, row, showTooltip = false) {
        if (!planetName || !state.wheel?.svg) return;
        const group = state.wheel.svg.querySelector(`.prognostic-body[data-planet="${escapeAttribute(planetName)}"][data-method="${escapeAttribute(method)}"]`);
        if (!group) return;
        state.wheel.onPlanetHover({ currentTarget: group }, true);
        row?.classList.add('active-row');
        if (showTooltip) {
            const groupRect = group.getBoundingClientRect();
            state.wheel.onPlanetClick({
                currentTarget: group,
                clientX: groupRect.left + groupRect.width / 2,
                clientY: groupRect.top + groupRect.height / 2,
            });
        }
    }

    function clearPlanetHover() {
        if (!state.wheel?.svg) return;
        state.wheel.svg.querySelectorAll('.prognostic-body').forEach((group) => {
            state.wheel.onPlanetHover({ currentTarget: group }, false);
        });
        state.wheel.hideTooltip?.();
        document.querySelectorAll('tr[data-planet].active-row').forEach((row) => {
            if (state.activePlanetSelection?.row === row) return;
            row.classList.remove('active-row');
        });
    }

    function togglePlanetSelection(planetName, method, row, scope) {
        const key = `${scope}:${method}:${planetName}`;
        if (state.activePlanetSelection?.key === key) {
            clearPlanetSelection();
            return;
        }

        clearPlanetSelection();
        state.activePlanetSelection = { key, row, planetName, method, scope };
        hoverPlanetRow(planetName, method, row, true);
        row.classList.add('active-row');

        const renderer = scope === 'natal' ? state.natalRenderer : state.prognosticRenderer;
        renderer?.setAspectPlanetFilter?.(planetName);
    }

    function clearPlanetSelection() {
        if (state.activePlanetSelection?.row) {
            state.activePlanetSelection.row.classList.remove('active-row');
        }
        clearPlanetHover();
        state.activePlanetSelection = null;
        state.natalRenderer?.setAspectPlanetFilter?.(null);
        state.prognosticRenderer?.setAspectPlanetFilter?.(null);
    }

    function hoverHouseRow(houseNumber, method, row) {
        if (!state.wheel?.svg) return;
        clearHouseHover();
        const group = state.wheel.svg.querySelector(`.house-cusp-group[data-house="${escapeAttribute(String(houseNumber))}"][data-method="${escapeAttribute(method)}"]`);
        if (!group) return;
        const groupRect = group.getBoundingClientRect();
        state.wheel.onHouseCuspHover({
            currentTarget: group,
            clientX: groupRect.left + groupRect.width / 2,
            clientY: groupRect.top + groupRect.height / 2,
        }, true);
        row?.classList.add('active-row');
    }

    function clearHouseHover() {
        if (!state.wheel?.svg) return;
        state.wheel.svg.querySelectorAll('.house-cusp-group').forEach((group) => {
            state.wheel.onHouseCuspHover({ currentTarget: group }, false);
        });
        document.querySelectorAll('tr[id^="row-house-"].active-row').forEach((row) => {
            row.classList.remove('active-row');
        });
    }

    function filterViewModelForSettings(viewModel) {
        if (!viewModel) return viewModel;
        return {
            ...viewModel,
            activePrognosticLayers: (viewModel.activePrognosticLayers || []).map((layer) => ({
                ...layer,
                aspects: filterAspectsByPhase(layer.aspects || []),
            })),
        };
    }

    function filterChartDataForRenderer(chartData = {}) {
        let filtered = window.AstroPreferences?.filterChartDataByViewPreferences
            ? window.AstroPreferences.filterChartDataByViewPreferences(chartData, {
                matrixRows: normalizeForecastNewMatrixRows(state.matrixRows),
                aspectScope: state.pageSettings.aspectScope || 'all',
                enabledAspectTypes: Array.isArray(state.pageSettings.enabledAspectTypes) && state.pageSettings.enabledAspectTypes.length
                    ? state.pageSettings.enabledAspectTypes
                    : DEFAULT_ASPECT_TYPES,
            })
            : chartData;

        if (window.AstroAspectPhase?.enrichChartDataWithAspectPhases) {
            filtered = window.AstroAspectPhase.enrichChartDataWithAspectPhases(filtered);
        }
        if (window.AstroAspectPhase?.filterChartDataByAspectPhase) {
            filtered = window.AstroAspectPhase.filterChartDataByAspectPhase(filtered, getAspectPhaseFilter());
        }
        return filtered;
    }

    function filterAspectsByPhase(aspects = []) {
        const filter = getAspectPhaseFilter();
        const matcher = window.AstroAspectPhase?.aspectMatchesPhaseFilter;
        if (typeof matcher !== 'function') return aspects;
        return (aspects || []).filter((aspect) => matcher(aspect, filter));
    }

    function getAspectPhaseFilter() {
        return normalizeAspectPhaseFilter(state.pageSettings.aspectPhaseFilter);
    }

    function buildLayerMeta(method, raw) {
        if (method === 'transit') {
            const info = raw?.transit_info || {};
            return [info.date, info.time, info.timezone].filter(Boolean).join(' · ');
        }
        if (method === 'progression') {
            const info = raw?.progression_info || {};
            return [info.target_date, info.method, info.rate].filter(Boolean).join(' · ');
        }
        const info = raw?.direction_info || {};
        return [info.target_date, info.direction_type, info.arc_formatted].filter(Boolean).join(' · ');
    }

    function activateSavedTabs() {
        activatePanelTab(document.getElementById('forecastNewNatalPanel'), tabToNatalTarget(state.leftTab));
        activatePanelTab(document.getElementById('forecastNewProgPanel'), tabToProgTarget(state.rightTab));
    }

    function activatePanelTab(panel, targetId) {
        if (!panel || !targetId) return;
        panel.querySelectorAll('.panel-tab').forEach((node) => node.classList.toggle('active', node.dataset.panelTarget === targetId));
        panel.querySelectorAll('.panel-tab-content').forEach((node) => node.classList.toggle('active', node.id === targetId));
    }

    function tabToNatalTarget(tab) {
        return {
            Planets: 'natalPlanetsView',
            Aspects: 'natalAspectsView',
            Grid: 'natalGridView',
            Configs: 'natalConfigsView',
            Balances: 'natalBalancesView',
        }[tab] || 'natalPlanetsView';
    }

    function tabToProgTarget(tab) {
        return {
            Planets: 'progPlanetsView',
            Aspects: 'progAspectsView',
            Grid: 'progGridView',
            Configs: 'progConfigsView',
            Balances: 'progBalancesView',
        }[tab] || 'progPlanetsView';
    }

    function hydrateState() {
        const storage = window.ForecastNewStateStorage;
        const key = storage?.buildStorageKey?.(state.natalData);
        if (!storage || !key) return;
        const restored = storage.parsePersistedState(localStorage.getItem(key), state.natalData);
        if (!restored) return;
        state.targetDatetime = restored.targetDatetime || state.targetDatetime;
        state.timezone = restored.timezone || state.timezone;
        state.location = restored.location || state.location;
        state.activeLayers = restored.activeLayers || state.activeLayers;
        state.selectedRightLayer = restored.selectedRightLayer || state.selectedRightLayer;
        state.stepMode = restored.stepMode || state.stepMode;
        state.leftTab = restored.leftTab || state.leftTab;
        state.rightTab = restored.rightTab || state.rightTab;
        state.matrixRows = normalizeForecastNewMatrixRows(restored.matrixRows);
        state.viewport = restored.viewport || state.viewport;
        state.pageSettings = {
            ...state.pageSettings,
            ...(restored.pageSettings || {}),
            houseSystem: normalizeHouseSystemCode(restored.pageSettings?.houseSystem || state.pageSettings.houseSystem),
            planetScale: clampPointScale(restored.pageSettings?.planetScale ?? state.pageSettings.planetScale),
            pointScale: clampPointScale(restored.pageSettings?.pointScale ?? state.pageSettings.pointScale),
            enabledAspectTypes: Array.isArray(restored.pageSettings?.enabledAspectTypes)
                ? restored.pageSettings.enabledAspectTypes
                : state.pageSettings.enabledAspectTypes,
            aspectPhaseFilter: normalizeAspectPhaseFilter(restored.pageSettings?.aspectPhaseFilter || state.pageSettings.aspectPhaseFilter),
            houseNumberStyle: restored.pageSettings?.houseNumberStyle === 'roman' ? 'roman' : state.pageSettings.houseNumberStyle,
            houseLabelsOutside: restored.pageSettings?.houseLabelsOutside === true,
            showApplyingSeparating: restored.pageSettings?.showApplyingSeparating !== false,
            showSpeed: restored.pageSettings?.showSpeed !== false,
            showStationary: restored.pageSettings?.showStationary !== false,
            showWheelStationary: restored.pageSettings?.showWheelStationary === true,
            showWheelDegree: restored.pageSettings?.showWheelDegree === true,
        };
    }

    async function hydratePreferences() {
        if (!window.AstroAPI?.getResolvedPreferences || !state.userId) return;
        try {
            const payload = await window.AstroAPI.getResolvedPreferences({
                chart_kind: 'natal',
                chart_id: state.userId,
                view_type: 'forecast_new',
            });
            state.resolvedPreferences = payload;
            const resolved = payload?.resolved || {};
            state.matrixRows = normalizeForecastNewMatrixRows(resolved?.matrix?.rows || state.matrixRows);
            state.pageSettings = {
                ...state.pageSettings,
                houseSystem: normalizeHouseSystemCode(payload?.chart_meta?.house_system || state.pageSettings.houseSystem),
                orientation: resolved?.view_options?.orientation === 'asc' ? 'asc' : (state.pageSettings.orientation || 'aries'),
                aspectScope: ['all', 'major', 'minor'].includes(resolved?.aspects?.scope)
                    ? resolved.aspects.scope
                    : state.pageSettings.aspectScope,
                enabledAspectTypes: Array.isArray(resolved?.aspects?.enabled_types) && resolved.aspects.enabled_types.length
                    ? resolved.aspects.enabled_types
                    : state.pageSettings.enabledAspectTypes,
                showApplyingSeparating: resolved?.aspects?.show_applying_separating !== false,
                showSpeed: resolved?.table_options?.show_speed !== false,
                showStationary: resolved?.table_options?.show_stationary !== false,
            };
        } catch (error) {
            console.warn('Forecast New preferences fallback to local defaults:', error);
        }
    }

    function getResolvedForecastNewViewSettings() {
        return {
            matrix: {
                rows: ensureMatrixRows(state.matrixRows),
            },
            aspects: {
                scope: state.pageSettings.aspectScope || 'all',
                enabled_types: Array.isArray(state.pageSettings.enabledAspectTypes) && state.pageSettings.enabledAspectTypes.length
                    ? [...state.pageSettings.enabledAspectTypes]
                    : [...DEFAULT_ASPECT_TYPES],
                show_applying_separating: state.pageSettings.showApplyingSeparating === true,
            },
            table_options: {
                show_speed: state.pageSettings.showSpeed !== false,
                show_stationary: state.pageSettings.showStationary !== false,
            },
            view_options: {
                orientation: state.pageSettings.orientation === 'asc' ? 'asc' : 'aries',
            },
        };
    }

    async function persistForecastNewViewOverrides() {
        if (!state.userId || !window.AstroAPI?.saveChartViewOverride) return;
        const resolved = getResolvedForecastNewViewSettings();
        const accountDefaults = window.AstroPreferences?.normalizeViewSettings
            ? window.AstroPreferences.normalizeViewSettings(state.resolvedPreferences?.account_defaults || {})
            : (state.resolvedPreferences?.account_defaults || {});
        const diff = window.AstroPreferences?.buildSparseDiff
            ? window.AstroPreferences.buildSparseDiff(accountDefaults, resolved)
            : resolved;

        if (!diff || (typeof diff === 'object' && Object.keys(diff).length === 0)) {
            await window.AstroAPI?.deleteChartViewOverride?.({
                chart_kind: 'natal',
                chart_id: state.userId,
                view_type: 'forecast_new',
            });
            state.resolvedPreferences = {
                ...(state.resolvedPreferences || {}),
                overrides: {},
                resolved,
            };
            return;
        }

        await window.AstroAPI.saveChartViewOverride({
            chart_kind: 'natal',
            chart_id: state.userId,
            view_type: 'forecast_new',
            overrides: diff,
        });
        state.resolvedPreferences = {
            ...(state.resolvedPreferences || {}),
            overrides: diff,
            resolved,
        };
    }

    function applyDeepLinkParams() {
        const params = new URLSearchParams(window.location.search);
        const date = params.get('date');
        const time = params.get('time');
        if (/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
            state.targetDatetime = `${date}T${normalizeTime(time || splitTargetDatetime(state.targetDatetime)[1])}`;
        }
        const layer = params.get('layer');
        if (LAYER_ORDER.includes(layer)) {
            state.activeLayers = LAYER_ORDER.filter((method) => method === 'transit' || method === layer);
            state.selectedRightLayer = layer;
        }
        if (params.has('date') || params.has('time') || params.has('layer')) {
            window.history.replaceState({}, '', window.location.pathname);
        }
    }

    function schedulePersist() {
        clearTimeout(state.persistTimer);
        state.persistTimer = setTimeout(persistState, 120);
    }

    function persistState() {
        const storage = window.ForecastNewStateStorage;
        const key = storage?.buildStorageKey?.(state.natalData);
        if (!storage || !key) return;
        const payload = storage.buildPersistedState({
            natalData: state.natalData,
            state: {
                targetDatetime: state.targetDatetime,
                timezone: state.timezone,
                location: state.location,
                activeLayers: state.activeLayers,
                selectedRightLayer: state.selectedRightLayer,
                stepMode: state.stepMode,
                leftTab: state.leftTab,
                rightTab: state.rightTab,
                matrixRows: state.matrixRows,
                viewport: state.viewport,
                pageSettings: state.pageSettings,
            },
        });
        if (payload) localStorage.setItem(key, JSON.stringify(payload));
    }

    function showLoader() {
        refs.pageLoader?.classList.remove('fade-out');
    }

    function hideLoader() {
        if (!refs.pageLoader) return;
        refs.pageLoader.classList.add('fade-out');
        setTimeout(() => refs.pageLoader?.remove(), 300);
    }

    function showLayout() {
        refs.forecastNewLayout?.classList.remove('hidden');
        refs.forecastNewError?.classList.add('hidden');
    }

    function showError(message) {
        refs.forecastNewErrorMsg.textContent = message;
        refs.forecastNewError?.classList.remove('hidden');
        refs.forecastNewLayout?.classList.add('hidden');
    }

    function ensureMatrixRows(rows) {
        return window.AstroPreferences?.ensureMatrixRows ? window.AstroPreferences.ensureMatrixRows(rows || {}) : (rows || {});
    }

    function buildDefaultForecastNewMatrixRows() {
        const rows = ensureMatrixRows({});
        Object.keys(rows).forEach((body) => {
            rows[body] = {
                ...rows[body],
                display: true,
                aspecting: DEFAULT_ASPECTING_BODIES.has(body),
            };
        });
        return rows;
    }

    function isLegacyAllEnabledMatrix(rows) {
        const ensured = ensureMatrixRows(rows);
        const bodies = Object.keys(ensured);
        return bodies.length > 0 && bodies.every((body) => ensured[body].display !== false && ensured[body].aspecting !== false);
    }

    function normalizeForecastNewMatrixRows(rows, options = {}) {
        const source = rows && typeof rows === 'object' ? rows : {};
        const fallback = buildDefaultForecastNewMatrixRows();
        const normalized = ensureMatrixRows(source);
        const resetLegacyAllEnabled = options.resetLegacyAllEnabled !== false;

        Object.keys(normalized).forEach((body) => {
            const hasExplicitBodyConfig = Object.prototype.hasOwnProperty.call(source, body);
            if (!hasExplicitBodyConfig) {
                normalized[body] = { ...fallback[body] };
            }
        });

        if (resetLegacyAllEnabled && isLegacyAllEnabledMatrix(source)) {
            return fallback;
        }

        return normalized;
    }

    function layerLabel(method) {
        return ({ transit: 'Транзиты', progression: 'Прогрессии', direction: 'Дирекции' })[method] || method;
    }

    function planetName(name) {
        const key = `astro.planet.${name}`;
        const translated = t(key);
        return translated === key ? (Symbols?.getPlanetNameRu?.(name) || name) : translated;
    }

    function escapeAttribute(value) {
        return String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    function aspectName(name) {
        const key = `astro.aspect.${name}`;
        const translated = t(key);
        return translated === key ? (Symbols?.aspectNamesRu?.[name] || name) : translated;
    }

    function splitTargetDatetime(value) {
        const raw = String(value || '');
        const [date, time = '12:00:00'] = raw.split('T');
        return [/^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayIsoDate(), normalizeTime(time)];
    }

    function normalizeTime(value) {
        const raw = String(value || '12:00:00');
        if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
        if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
        return '12:00:00';
    }

    function todayIsoDate() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    function getLocalNowIso() {
        const now = new Date();
        const date = todayIsoDate();
        const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
            .map((part) => String(part).padStart(2, '0'))
            .join(':');
        return `${date}T${time}`;
    }

    function addStep(value, mode, direction) {
        const [date, time] = splitTargetDatetime(value);
        const next = new Date(`${date}T${time}`);
        const dir = direction >= 0 ? 1 : -1;
        if (mode === 'second') next.setSeconds(next.getSeconds() + dir);
        else if (mode === 'minute') next.setMinutes(next.getMinutes() + dir);
        else if (mode === 'hour') next.setHours(next.getHours() + dir);
        else if (mode === 'day') next.setDate(next.getDate() + dir);
        else if (mode === 'week') next.setDate(next.getDate() + dir * 7);
        else if (mode === 'month') next.setMonth(next.getMonth() + dir);
        else if (mode === 'year') next.setFullYear(next.getFullYear() + dir);
        return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}T${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}:${String(next.getSeconds()).padStart(2, '0')}`;
    }

    function numberOrNull(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    function clampPointScale(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 1.2;
        return Math.min(1.7, Math.max(0.8, numeric));
    }

    function normalizeHouseSystemCode(value) {
        const normalized = String(value || 'P').trim().toUpperCase().replace(/[\s-]+/g, '_');
        return HOUSE_SYSTEM_CODES[normalized] || 'P';
    }

    function normalizeAspectPhaseFilter(value) {
        if (window.AstroAspectPhase?.normalizeAspectPhaseFilter) {
            return window.AstroAspectPhase.normalizeAspectPhaseFilter(value);
        }
        if (Array.isArray(value)) {
            const normalized = value
                .map((entry) => String(entry || '').trim().toLowerCase())
                .filter((entry) => DEFAULT_ASPECT_PHASE_FILTER.includes(entry));
            return [...new Set(normalized)];
        }
        return [...DEFAULT_ASPECT_PHASE_FILTER];
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    window.ForecastNewState = state;
})();

(function() {
    'use strict';

    const API_BASE = window.location.hostname === 'localhost'
        ? 'http://localhost:8000/api/v1'
        : '/api/v1';
    const LAYER_ORDER = ['transit', 'progression', 'direction'];
    const LAYER_CACHE_PREFIX = 'forecastNewLayerCache:';
    const LAYER_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
    const DEFAULT_ASPECT_TYPES = window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES || [
        'Conjunction', 'Opposition', 'Trine', 'Square', 'Sextile',
        'Vigintile', 'Semi_Nonagon', 'Semisextile', 'Decile', 'Nonagon',
        'Semisquare', 'Quintile', 'Binonagon', 'Sentagon', 'Tridecile',
        'Sesquiquadrate', 'Biquintile', 'Quincunx',
    ];
    const PANEL_TARGET_TO_TAB = {
        natalPlanetsView: 'Planets',
        natalHousesView: 'Houses',
        natalAspectsView: 'Aspects',
        natalGridView: 'Grid',
        natalConfigsView: 'Configs',
        natalBalancesView: 'Balances',
        natalRulersView: 'Rulers',
        progPlanetsView: 'Planets',
        progHousesView: 'Houses',
        progAspectsView: 'Aspects',
        progGridView: 'Grid',
        progConfigsView: 'Configs',
        progBalancesView: 'Balances',
        progRulersView: 'Rulers',
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
    const TIME_STEPPER_SEGMENTS = [
        { key: 'yearThousands', label: '1000л', title: 'Тысячи лет', unit: 'year', amount: 1000 },
        { key: 'yearHundreds', label: '100л', title: 'Сотни лет', unit: 'year', amount: 100 },
        { key: 'yearTens', label: '10л', title: 'Десятки лет', unit: 'year', amount: 10 },
        { key: 'yearOnes', label: 'Год', title: 'Годы', unit: 'year', amount: 1 },
        { key: 'monthTens', label: '10мес', title: 'Десятки месяцев', unit: 'month', amount: 10 },
        { key: 'monthOnes', label: 'Мес', title: 'Месяцы', unit: 'month', amount: 1 },
        { key: 'dayTens', label: '10д', title: 'Десятки дней', unit: 'day', amount: 10 },
        { key: 'dayOnes', label: 'День', title: 'Дни', unit: 'day', amount: 1 },
        { key: 'hour', label: 'Час', title: 'Часы', unit: 'hour', amount: 1 },
        { key: 'tenMinute', label: '10м', title: 'Десятки минут', unit: 'minute', amount: 10 },
        { key: 'minute', label: 'Мин', title: 'Минуты', unit: 'minute', amount: 1 },
        { key: 'tenSecond', label: '10с', title: 'Десятки секунд', unit: 'second', amount: 10 },
        { key: 'second', label: 'Сек', title: 'Секунды', unit: 'second', amount: 1 },
    ];
    const CUSTOM_STEP_UNITS = [
        { value: 'second', label: 'секунд' },
        { value: 'minute', label: 'минут' },
        { value: 'hour', label: 'часов' },
        { value: 'day', label: 'дней' },
        { value: 'week', label: 'недель' },
        { value: 'month', label: 'месяцев' },
        { value: 'year', label: 'лет' },
    ];

    const refs = {};
    const state = {
        natalData: null,
        natalWheelData: null,
        userId: null,
        selectedDateTime: '',
        lastCalculatedTransitDateTime: '',
        lastCalculatedPrognosticDate: '',
        enabledLayers: ['transit'],
        activeRightMethodTab: 'transit',
        pendingRequestToken: 0,
        targetDatetime: '',
        timezone: 'UTC',
        location: { name: '', latitude: null, longitude: null, sourceId: null },
        activeLayers: ['transit'],
        selectedRightLayer: 'transit',
        stepMode: 'hour',
        customStep: { amount: 1, unit: 'day' },
        isCustomStepOpen: false,
        natalSelectedDateTime: '',
        natalInitialDateTime: '',
        natalTimezone: 'UTC',
        natalLocation: { name: '', latitude: null, longitude: null, sourceId: null },
        natalCustomStep: { amount: 1, unit: 'day' },
        natalIsCustomStepOpen: false,
        leftTab: 'Planets',
        rightTab: 'Planets',
        natalMatrixRows: buildDefaultForecastNewMatrixRows(),
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
            showAspectText: false,
            showWheelStationary: false,
            showWheelDegree: false,
            angleAscDscBold: true,
            angleMcIcBold: true,
            houseNumberStyle: 'arabic',
            houseLabelsOutside: false,
            showTransitCusps: true,
            showProgressionCusps: true,
            showDirectionCusps: true,
        },
        viewport: { zoom: 1, panX: 0, panY: 0 },
        cache: {},
        inFlight: {},
        inFlightByKey: {},
        inFlightByMethod: {},
        wheel: null,
        natalRenderer: null,
        prognosticRenderer: null,
        resolvedPreferences: null,
        hoveredAspectKey: null,
        pinnedAspectKey: null,
        activePlanetSelection: null,
        applySettingsTimer: null,
        viewOverridesPersistTimer: null,
        persistTimer: null,
        rightPanelRenderFrame: null,
        adjacentPrefetchTimer: null,
        lastStepperAction: null,
        requestSeq: 0,
        bodyActionMenu: {
            body: null,
            method: null,
            scope: 'prognostic',
        },
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

    function formatHeaderTimezone(value) {
        return window.Timezones?.formatOffsetLabel?.(value) || String(value || '').trim();
    }

    function getForecastNavigationState() {
        return window.AstroAPI?.getNavigationState?.() || {};
    }

    function getForecastBackUrl() {
        const navState = getForecastNavigationState();
        return navState.sourceUrl || '/chart.html';
    }

    function getForecastSynastryUrl() {
        const navState = getForecastNavigationState();
        if (state.userId && navState.partnerUserId && String(navState.clientUserId || '') === String(state.userId)) {
            return window.AstroAPI?.buildSynastryUrl?.(state.userId, navState.partnerUserId) || null;
        }
        return null;
    }

    function navigateFromForecast(targetUrl) {
        const navState = getForecastNavigationState();
        window.AstroAPI?.saveNavigationState?.({
            sourceView: 'forecast-new',
            sourceUrl: `/forecast-new.html${window.location.search || ''}`,
            clientUserId: state.userId ? String(state.userId) : navState.clientUserId,
            partnerUserId: String(navState.clientUserId || '') === String(state.userId || '')
                ? (navState.partnerUserId ? String(navState.partnerUserId) : null)
                : null,
        });
        window.showPageLoader?.();
        window.location.href = targetUrl;
    }

    function configureForecastNavigation() {
        const navState = getForecastNavigationState();
        if (refs.forecastNewBackBtn) {
            refs.forecastNewBackBtn.href = getForecastBackUrl();
        }
        if (refs.openSynastryBtn) {
            refs.openSynastryBtn.disabled = !state.userId;
        }
        window.AstroAPI?.patchNavigationState?.({
            currentView: 'forecast-new',
            clientUserId: state.userId ? String(state.userId) : navState.clientUserId,
            partnerUserId: String(navState.clientUserId || '') === String(state.userId || '')
                ? (navState.partnerUserId ? String(navState.partnerUserId) : null)
                : null,
        });
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
        state.timezone = normalizeTimezoneValue(
            natalData.birth_data?.timezone,
            natalData.birth_data?.place,
        ) || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        state.location = {
            name: natalData.birth_data?.place || '',
            latitude: numberOrNull(natalData.birth_data?.latitude),
            longitude: numberOrNull(natalData.birth_data?.longitude),
            sourceId: null,
        };
        state.pageSettings.houseSystem = normalizeHouseSystemCode(natalData.birth_data?.house_system || 'P');
        setSelectedDateTime(getLocalNowIso(state.timezone));

        const birthDate = natalData.birth_data?.date || '';
        const birthTime = normalizeTime(natalData.birth_data?.time || '12:00:00');
        if (birthDate) {
            state.natalInitialDateTime = `${birthDate}T${birthTime}`;
            state.natalSelectedDateTime = state.natalInitialDateTime;
        }
        state.natalTimezone = normalizeTimezoneValue(
            natalData.birth_data?.timezone,
            natalData.birth_data?.place,
        ) || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        state.natalLocation = {
            name: natalData.birth_data?.place || '',
            latitude: numberOrNull(natalData.birth_data?.latitude),
            longitude: numberOrNull(natalData.birth_data?.longitude),
            sourceId: null,
        };

        hydrateState();
        applyDeepLinkParams();
        populateTimezoneOptions();
        populateNatalTimezoneOptions();
        initRenderers();
        configureForecastNavigation();
        bindEvents();
        bindLocationAutocomplete();
        bindNatalLocationAutocomplete();
        initAspectInteractions();
        syncControlsFromState();
        renderStaticNatal();
        refreshViewModel();
        renderWheel();
        renderRightLayerTabs();
        showLayout();
        hideLoader();

        void hydratePreferences().then(() => {
            syncControlsFromState();
            renderStaticNatal();
            refreshViewModel();
            renderWheel();
            renderRightLayerTabs();
            scheduleRightPanelRender();
        });
        void loadActiveLayers({ lightweight: true });
    });

    function cacheElements() {
        [
            'pageLoader', 'forecastNewLayout', 'forecastNewError', 'forecastNewErrorMsg',
            'forecastNewBackBtn', 'forecastNewTitle', 'forecastNewSubtitle', 'openNatalBtn', 'openNatalTablesBtn', 'openSynastryBtn',
            'forecastNewNatalPanel', 'forecastNewProgPanel',
            'natalPanelMeta', 'prognosticPanelTitle', 'prognosticPanelMeta',
            'prognosticMomentToggle', 'forecastNewMomentCard',
            'forecastNewWheel', 'forecastNewWheelShell', 'targetDateInput', 'targetTimeInput',
            'forecastNewTimeStepper',
            'stepModeSelect', 'stepBackward', 'stepForward', 'timezoneInput', 'locationInput',
            'latitudeInput', 'longitudeInput', 'locationSuggestions', 'targetDatetimeLabel', 'rightLayerTabs',
            'forecastNewNatalTimeStepper', 'natalMomentToggle', 'forecastNewNatalCard',
            'natalDatetimeLabel', 'natalDateInput', 'natalTimeInput',
            'natalTimezoneInput', 'natalLocationInput', 'natalLocationSuggestions',
            'natalLatitudeInput', 'natalLongitudeInput',
            'forecastNewMatrixEditor', 'forecastNewSettingsMatrixEditor',
            'forecastNewZoomIn', 'forecastNewZoomOut',
            'forecastNewZoomReset', 'forecastNewSettingsToggle', 'forecastNewSettingsPanel',
            'orientationSelect', 'houseSystemSelect', 'iconScaleRange', 'iconScaleValue',
            'aspectScopeSelect', 'aspectTypeToggles',
            'aspectPhaseApplyingToggle', 'aspectPhaseSeparatingToggle',
            'houseNumberStyleSelect', 'houseLabelsOutsideToggle',
            'showTransitCuspsToggle', 'showProgressionCuspsToggle', 'showDirectionCuspsToggle',
            'showWheelStationaryToggle', 'showWheelDegreeToggle',
            'angleAscDscBoldToggle', 'angleMcIcBoldToggle',
            'showSpeedToggle', 'showStationaryToggle',
        ].forEach((id) => {
            refs[id] = document.getElementById(id);
        });
        refs.layerToggles = [...document.querySelectorAll('[data-layer-toggle]')];
        refs.tabsOverflow = [...document.querySelectorAll('[data-tabs-overflow]')];
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
            aspectSortHeadersSelector: '#natalAspectsView th.sortable[data-sort]',
            showSpeedColumn: false,
            showHouseColumn: false,
        });
        state.prognosticRenderer = new ChartDataRenderer({
            planetsTableId: 'progPlanetsTable',
            housesTableId: 'progHousesTable',
            aspectsTableId: 'progAspectsTable',
            aspectGridContainerId: 'progAspectGridContainer',
            configsContainerId: 'progConfigurationsContainer',
            balancesContainerId: 'progBalancesContainer',
            aspectSortHeadersSelector: '#progAspectsView th.sortable[data-sort]',
            showSpeedColumn: false,
            showHouseColumn: false,
        });
    }

    function bindEvents() {
        refs.openNatalBtn?.addEventListener('click', () => {
            window.AstroAPI?.saveChartToSession?.(state.natalData);
            window.AstroAPI?.saveFormData?.(window.AstroAPI.chartToFormData(state.natalData));
            navigateFromForecast('/chart.html');
        });

        refs.openNatalTablesBtn?.addEventListener('click', () => {
            window.AstroAPI?.saveChartToSession?.(state.natalData);
            window.AstroAPI?.saveFormData?.(window.AstroAPI.chartToFormData(state.natalData));
            navigateFromForecast('/natal-full.html');
        });

        refs.openSynastryBtn?.addEventListener('click', () => {
            if (!state.userId) return;
            window.AstroAPI?.saveChartToSession?.(state.natalData);
            window.AstroAPI?.saveFormData?.(window.AstroAPI.chartToFormData(state.natalData));
            navigateFromForecast(getForecastSynastryUrl() || '/chart.html?open=synastry');
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
                state.enabledLayers = state.activeLayers;
                state.activeRightMethodTab = state.selectedRightLayer;
                schedulePersist();
                await loadActiveLayers();
            });
        });

        refs.targetDateInput?.addEventListener('change', onTargetDatetimeChange);
        refs.targetTimeInput?.addEventListener('change', onTargetDatetimeChange);
        refs.forecastNewTimeStepper?.addEventListener('click', (event) => {
            const resetButton = event.target.closest('[data-reset-moment="prognostic"]');
            if (resetButton) {
                event.stopPropagation();
                resetPrognosticDateTime();
                return;
            }
            const customToggle = event.target.closest('[data-custom-step-toggle]');
            if (customToggle) {
                event.stopPropagation();
                toggleCustomStepPopover();
                return;
            }
            const customDirectionButton = event.target.closest('[data-custom-step-direction]');
            if (customDirectionButton) {
                event.stopPropagation();
                stepSelectedDateTimeByCustom(Number(customDirectionButton.dataset.customStepDirection));
                return;
            }
            if (event.target.closest('.forecast-new-custom-step')) {
                event.stopPropagation();
                return;
            }
            const button = event.target.closest('[data-time-step-segment][data-time-step-direction]');
            if (!button) return;
            const segment = TIME_STEPPER_SEGMENTS.find((item) => item.key === button.dataset.timeStepSegment);
            if (!segment) return;
            stepSelectedDateTimeSegment(segment, Number(button.dataset.timeStepDirection));
        });
        refs.forecastNewTimeStepper?.addEventListener('keydown', (event) => {
            if (!(event.target instanceof Element)) return;
            if (event.target.closest('#forecastNewCustomStepPopover')) {
                if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    stepSelectedDateTimeByCustom(-1);
                    return;
                }
                if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    stepSelectedDateTimeByCustom(1);
                    return;
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    setCustomStepPopoverOpen(false);
                    return;
                }
            }
            if (event.target.closest('.forecast-new-custom-step')) return;
            const segmentEl = event.target.closest('[data-time-step-key]');
            if (!segmentEl) return;

            const directionByKey = {
                ArrowUp: 1,
                ArrowDown: -1,
                PageUp: 1,
                PageDown: -1,
            };
            const direction = directionByKey[event.key];
            if (!direction) return;

            const segment = TIME_STEPPER_SEGMENTS.find((item) => item.key === segmentEl.dataset.timeStepKey);
            if (!segment) return;
            event.preventDefault();
            stepSelectedDateTimeSegment(segment, direction);
            requestAnimationFrame(() => {
                refs.forecastNewTimeStepper?.querySelector(`[data-time-step-key="${segment.key}"]`)?.focus();
            });
        });
        refs.forecastNewTimeStepper?.addEventListener('input', (event) => {
            if (!(event.target instanceof Element) || !event.target.closest('[data-custom-step-input]')) return;
            updateCustomStepFromControls();
        });
        refs.forecastNewTimeStepper?.addEventListener('change', (event) => {
            if (!(event.target instanceof Element) || !event.target.closest('[data-custom-step-input]')) return;
            updateCustomStepFromControls();
        });
        refs.prognosticMomentToggle?.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleMomentEditor();
        });
        refs.forecastNewMomentCard?.addEventListener('click', (event) => event.stopPropagation());

        refs.natalMomentToggle?.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleNatalMomentEditor();
        });
        refs.forecastNewNatalCard?.addEventListener('click', (event) => event.stopPropagation());

        refs.natalDateInput?.addEventListener('change', onNatalDatetimeChange);
        refs.natalTimeInput?.addEventListener('change', onNatalDatetimeChange);

        refs.forecastNewNatalTimeStepper?.addEventListener('click', (event) => {
            const resetButton = event.target.closest('[data-reset-moment="natal"]');
            if (resetButton) {
                event.stopPropagation();
                resetNatalDateTime();
                return;
            }
            const customToggle = event.target.closest('[data-custom-step-toggle]');
            if (customToggle) {
                event.stopPropagation();
                toggleNatalCustomStepPopover();
                return;
            }
            const customDirectionButton = event.target.closest('[data-custom-step-direction]');
            if (customDirectionButton) {
                event.stopPropagation();
                stepNatalDateTimeByCustom(Number(customDirectionButton.dataset.customStepDirection));
                return;
            }
            if (event.target.closest('.forecast-new-custom-step')) {
                event.stopPropagation();
                return;
            }
            const button = event.target.closest('[data-time-step-segment][data-time-step-direction]');
            if (!button) return;
            const segment = TIME_STEPPER_SEGMENTS.find((item) => item.key === button.dataset.timeStepSegment);
            if (!segment) return;
            stepNatalDateTimeSegment(segment, Number(button.dataset.timeStepDirection));
        });
        refs.forecastNewNatalTimeStepper?.addEventListener('keydown', (event) => {
            if (!(event.target instanceof Element)) return;
            if (event.target.closest('#forecastNewNatalCustomStepPopover')) {
                if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    stepNatalDateTimeByCustom(-1);
                    return;
                }
                if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    stepNatalDateTimeByCustom(1);
                    return;
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    setNatalCustomStepPopoverOpen(false);
                    return;
                }
            }
            if (event.target.closest('.forecast-new-custom-step')) return;
            const segmentEl = event.target.closest('[data-time-step-key]');
            if (!segmentEl) return;
            const directionByKey = { ArrowUp: 1, ArrowDown: -1, PageUp: 1, PageDown: -1 };
            const direction = directionByKey[event.key];
            if (!direction) return;
            const segment = TIME_STEPPER_SEGMENTS.find((item) => item.key === segmentEl.dataset.timeStepKey);
            if (!segment) return;
            event.preventDefault();
            stepNatalDateTimeSegment(segment, direction);
            requestAnimationFrame(() => {
                refs.forecastNewNatalTimeStepper?.querySelector(`[data-time-step-key="${segment.key}"]`)?.focus();
            });
        });
        refs.forecastNewNatalTimeStepper?.addEventListener('input', (event) => {
            if (!(event.target instanceof Element) || !event.target.closest('[data-custom-step-input]')) return;
            updateNatalCustomStepFromControls();
        });
        refs.forecastNewNatalTimeStepper?.addEventListener('change', (event) => {
            if (!(event.target instanceof Element) || !event.target.closest('[data-custom-step-input]')) return;
            updateNatalCustomStepFromControls();
        });

        ['natalTimezoneInput', 'natalLocationInput', 'natalLatitudeInput', 'natalLongitudeInput'].forEach((id) => {
            refs[id]?.addEventListener('change', async () => {
                applyNatalLocationInputsToState();
                await loadNatal();
            });
        });
        refs.natalLocationInput?.addEventListener('input', handleNatalLocationInput);

        ['timezoneInput', 'locationInput', 'latitudeInput', 'longitudeInput'].forEach((id) => {
            refs[id]?.addEventListener('change', async () => {
                applyLocationInputsToState();
                schedulePersist();
                await loadActiveLayers();
            });
        });
        refs.locationInput?.addEventListener('input', handleLocationInput);
        document.addEventListener('frontend:locale-changed', () => {
            populateTimezoneOptions();
            populateNatalTimezoneOptions();
            syncControlsFromState();
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

        refs.tabsOverflow.forEach((overflow) => {
            const toggle = overflow.querySelector('[data-tabs-overflow-toggle]');
            toggle?.addEventListener('click', (event) => {
                event.stopPropagation();
                const shouldOpen = !overflow.classList.contains('is-open');
                closeTabsOverflowMenus();
                overflow.classList.toggle('is-open', shouldOpen);
                syncTabsOverflowToggleState();
            });
        });

        refs.rightLayerTabs?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-right-layer]');
            if (!button) return;
            state.selectedRightLayer = button.dataset.rightLayer;
            state.activeRightMethodTab = state.selectedRightLayer;
            renderRightPanel();
            schedulePersist();
        });

        [refs.forecastNewMatrixEditor, refs.forecastNewSettingsMatrixEditor].forEach((editor) => {
            editor?.addEventListener('change', async (event) => {
                const input = event.target instanceof Element
                    ? event.target.closest('input[data-matrix-body][data-matrix-field]')
                    : null;
                if (!(input instanceof HTMLInputElement)) return;
                updateMatrixRowFromControl(input);
                syncMatrixCheckboxes();
                await applyMatrixRows();
            });
        });
        [refs.forecastNewNatalPanel, refs.forecastNewProgPanel].forEach((panel) => {
            panel?.addEventListener('click', (event) => {
                if (event.target instanceof Element && event.target.closest('.forecast-new-matrix-inline')) {
                    event.stopPropagation();
                }
            });
            panel?.addEventListener('change', async (event) => {
                const input = event.target instanceof Element
                    ? event.target.closest('input[data-matrix-body][data-matrix-field]')
                    : null;
                if (!(input instanceof HTMLInputElement)) return;
                updateMatrixRowFromControl(input);
                syncMatrixCheckboxes();
                await applyMatrixRows();
            });
        });

        refs.forecastNewSettingsToggle?.addEventListener('click', (event) => {
            event.stopPropagation();
            refs.forecastNewSettingsPanel?.classList.toggle('hidden');
        });
        refs.forecastNewSettingsPanel?.addEventListener('click', (event) => event.stopPropagation());
        document.addEventListener('click', () => {
            closeBodyActionMenu();
            refs.forecastNewSettingsPanel?.classList.add('hidden');
            setMomentEditorOpen(false);
            setCustomStepPopoverOpen(false);
            setNatalMomentEditorOpen(false);
            setNatalCustomStepPopoverOpen(false);
            closeTabsOverflowMenus();
        });
        [
            refs.orientationSelect,
            refs.houseSystemSelect,
            refs.iconScaleRange,
            refs.aspectScopeSelect,
            refs.aspectPhaseApplyingToggle,
            refs.aspectPhaseSeparatingToggle,
            refs.houseNumberStyleSelect,
            refs.houseLabelsOutsideToggle,
            refs.showTransitCuspsToggle,
            refs.showProgressionCuspsToggle,
            refs.showDirectionCuspsToggle,
            refs.showWheelStationaryToggle,
            refs.showWheelDegreeToggle,
            refs.angleAscDscBoldToggle,
            refs.angleMcIcBoldToggle,
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
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeBodyActionMenu();
        });
        document.addEventListener('chart:body-contextmenu', (event) => {
            const detail = event?.detail || {};
            if (detail.source !== 'wheel' || !detail.body) return;
            openBodyActionMenu(detail);
        });
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
        const [date, time] = splitTargetDatetime(state.selectedDateTime);
        if (refs.targetDateInput) refs.targetDateInput.value = date;
        if (refs.targetTimeInput) refs.targetTimeInput.value = time;
        renderOrUpdateTimeStepper();
        renderOrUpdateNatalTimeStepper();
        updateNatalMomentControls();
        if (refs.timezoneInput) refs.timezoneInput.value = normalizeTimezoneValue(state.timezone, state.location?.name) || '';
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
        if (refs.showTransitCuspsToggle) refs.showTransitCuspsToggle.checked = state.pageSettings.showTransitCusps !== false;
        if (refs.showProgressionCuspsToggle) refs.showProgressionCuspsToggle.checked = state.pageSettings.showProgressionCusps !== false;
        if (refs.showDirectionCuspsToggle) refs.showDirectionCuspsToggle.checked = state.pageSettings.showDirectionCusps !== false;
        if (refs.showWheelStationaryToggle) refs.showWheelStationaryToggle.checked = state.pageSettings.showWheelStationary === true;
        if (refs.showWheelDegreeToggle) refs.showWheelDegreeToggle.checked = state.pageSettings.showWheelDegree === true;
        if (refs.angleAscDscBoldToggle) refs.angleAscDscBoldToggle.checked = state.pageSettings.angleAscDscBold !== false;
        if (refs.angleMcIcBoldToggle) refs.angleMcIcBoldToggle.checked = state.pageSettings.angleMcIcBold !== false;
        if (refs.showSpeedToggle) refs.showSpeedToggle.checked = state.pageSettings.showSpeed !== false;
        if (refs.showStationaryToggle) refs.showStationaryToggle.checked = state.pageSettings.showStationary !== false;
        refs.layerToggles.forEach((input) => {
            input.checked = state.activeLayers.includes(input.dataset.layerToggle);
        });
        updateHeaderInfo();
        updatePrognosticTimeMeta();
        renderMatrixEditor();
        renderAspectTypeToggles();
        applyViewport();
    }

    function populateTimezoneOptions() {
        const selectedTimezone = normalizeTimezoneValue(refs.timezoneInput?.value || state.timezone, state.location?.name);
        window.Timezones?.populate?.(refs.timezoneInput);
        if (refs.timezoneInput && selectedTimezone) {
            refs.timezoneInput.value = selectedTimezone;
        }
        if (selectedTimezone) {
            state.timezone = selectedTimezone;
        }
    }

    function bindLocationAutocomplete() {
        if (!window.PlaceAutocomplete || !refs.locationInput || !refs.locationSuggestions) return;
        window.PlaceAutocomplete.attach({
            input: refs.locationInput,
            suggestions: refs.locationSuggestions,
            minChars: 2,
            debounceMs: 350,
            limit: 5,
            getLabel: (item) => item.shortName || item.displayName,
            onInput: (place) => {
                state.location = {
                    ...state.location,
                    name: refs.locationInput.value.trim(),
                    latitude: null,
                    longitude: null,
                    sourceId: null,
                };
                if (refs.latitudeInput) refs.latitudeInput.value = '';
                if (refs.longitudeInput) refs.longitudeInput.value = '';
                const guessedTimezone = window.Timezones?.guess?.(place);
                if (guessedTimezone && refs.timezoneInput) {
                    refs.timezoneInput.value = guessedTimezone;
                    state.timezone = guessedTimezone;
                }
                updatePrognosticTimeMeta();
                schedulePersist();
            },
            onSelect: async (item) => {
                if (refs.locationInput) refs.locationInput.value = item.shortName || item.displayName;
                if (refs.latitudeInput) refs.latitudeInput.value = String(item.lat);
                if (refs.longitudeInput) refs.longitudeInput.value = String(item.lon);

                let resolvedTimezone = null;
                if (item.sourceId && window.AstroAPI?.resolvePlaceTimezone) {
                    try {
                        resolvedTimezone = await window.AstroAPI.resolvePlaceTimezone(item.sourceId);
                    } catch (_error) {
                        resolvedTimezone = null;
                    }
                }
                if (!resolvedTimezone) {
                    resolvedTimezone = window.Timezones?.guess?.(item.displayName || item.shortName) || null;
                }
                if (resolvedTimezone && refs.timezoneInput) {
                    refs.timezoneInput.value = resolvedTimezone;
                }

                state.location = {
                    name: item.shortName || item.displayName,
                    latitude: item.lat,
                    longitude: item.lon,
                    sourceId: item.sourceId || null,
                };
                if (resolvedTimezone) {
                    state.timezone = resolvedTimezone;
                }
                updatePrognosticTimeMeta();
                syncControlsFromState();
                schedulePersist();
                await loadActiveLayers();
            },
        });
    }

    function handleLocationInput() {
        const nextValue = refs.locationInput?.value?.trim() || '';
        const normalizedSelected = normalizeLooseText(state.location?.name);
        const normalizedNext = normalizeLooseText(nextValue);
        if (!normalizedNext || normalizedNext !== normalizedSelected) {
            state.location = {
                ...state.location,
                name: nextValue,
                latitude: null,
                longitude: null,
                sourceId: null,
            };
            if (refs.latitudeInput) refs.latitudeInput.value = '';
            if (refs.longitudeInput) refs.longitudeInput.value = '';
            updatePrognosticTimeMeta();
        }
    }

    function applyLocationInputsToState() {
        state.timezone = normalizeTimezoneValue(refs.timezoneInput?.value?.trim(), refs.locationInput?.value?.trim())
            || normalizeTimezoneValue(state.timezone, refs.locationInput?.value?.trim())
            || 'UTC';
        state.location = {
            name: refs.locationInput?.value?.trim() || '',
            latitude: numberOrNull(refs.latitudeInput?.value),
            longitude: numberOrNull(refs.longitudeInput?.value),
            sourceId: state.location?.sourceId || null,
        };
    }

    function updateHeaderInfo() {
        const birth = state.natalData?.birth_data || {};
        const name = [birth.first_name, birth.last_name].filter(Boolean).join(' ').trim() || 'Клиент';
        refs.forecastNewTitle.textContent = `${name} · Прогностика New`;
        refs.forecastNewSubtitle.textContent = [
            birth.date,
            birth.time,
            formatHeaderTimezone(birth.timezone),
            birth.place,
        ].filter(Boolean).join(' · ');
        updateNatalMomentMeta();
    }

    function updateNatalMomentMeta() {
        const [date, time] = splitTargetDatetime(state.natalSelectedDateTime);
        const summary = [
            `${date} · ${time}`,
            formatHeaderTimezone(state.natalTimezone),
            state.natalLocation?.name || '',
        ].filter(Boolean).join(' · ');
        if (refs.natalPanelMeta) refs.natalPanelMeta.textContent = summary;
        if (refs.natalDatetimeLabel) refs.natalDatetimeLabel.textContent = state.natalSelectedDateTime.replace('T', ' ');
    }

    function updatePrognosticTimeMeta() {
        if (refs.targetDatetimeLabel) refs.targetDatetimeLabel.textContent = state.selectedDateTime.replace('T', ' ');
        if (refs.prognosticPanelMeta) refs.prognosticPanelMeta.textContent = buildPrognosticMomentSummary();
    }

    function buildPrognosticMomentSummary() {
        const locationName = state.location?.name || '';
        return [state.selectedDateTime.replace('T', ' · '), formatHeaderTimezone(state.timezone), locationName]
            .filter(Boolean)
            .join(' · ');
    }

    function toggleMomentEditor() {
        const isOpen = refs.forecastNewMomentCard?.classList.contains('hidden') !== false;
        setMomentEditorOpen(isOpen);
    }

    function setMomentEditorOpen(isOpen) {
        refs.forecastNewMomentCard?.classList.toggle('hidden', !isOpen);
        refs.prognosticMomentToggle?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    function renderTimeStepper() {
        if (!refs.forecastNewTimeStepper) return;
        const values = getTimeStepperSegmentValues(state.selectedDateTime);
        const customStep = normalizeCustomStep(state.customStep);
        const customStepLabel = formatCustomStepLabel(customStep);
        const customStepTooltip = `Кастомный шаг: ${customStepLabel}`;
        const customStepUnitOptions = CUSTOM_STEP_UNITS.map((unit) => `
            <option value="${unit.value}" ${unit.value === customStep.unit ? 'selected' : ''}>${escapeHtml(unit.label)}</option>
        `).join('');
        const segmentMarkup = (segmentKey) => {
            const segment = TIME_STEPPER_SEGMENTS.find((item) => item.key === segmentKey);
            const value = values[segmentKey] ?? '';
            if (!segment) return '';
            return `
                <span class="forecast-new-time-stepper-segment forecast-new-time-stepper-segment--${segment.key}" data-time-step-key="${segment.key}" tabindex="0" role="spinbutton" aria-label="${escapeHtml(segment.title)}" aria-valuetext="${escapeHtml(value)}" title="${escapeHtml(segment.title)}">
                    <button type="button" class="forecast-new-time-stepper-btn forecast-new-time-stepper-btn--up" data-time-step-segment="${segment.key}" data-time-step-direction="1" aria-label="${escapeHtml(segment.title)} +1"></button>
                    <span class="forecast-new-time-stepper-value">${escapeHtml(value)}</span>
                    <button type="button" class="forecast-new-time-stepper-btn forecast-new-time-stepper-btn--down" data-time-step-segment="${segment.key}" data-time-step-direction="-1" aria-label="${escapeHtml(segment.title)} -1"></button>
                </span>
            `;
        };

        refs.forecastNewTimeStepper.innerHTML = `
            <button
                type="button"
                class="forecast-new-stepper-action"
                data-reset-moment="prognostic"
                title="Вернуть текущие дату и время"
                aria-label="Вернуть текущие дату и время"
            >↺</button>
            <span class="forecast-new-custom-step ${state.isCustomStepOpen ? 'is-open' : ''}">
                <button
                    type="button"
                    class="forecast-new-custom-step-toggle"
                    data-custom-step-toggle
                    aria-expanded="${state.isCustomStepOpen ? 'true' : 'false'}"
                    aria-controls="forecastNewCustomStepPopover"
                    title="${escapeHtml(customStepTooltip)}"
                    aria-label="${escapeHtml(customStepTooltip)}"
                >
                    <span aria-hidden="true">⇄</span>
                </button>
                <span class="forecast-new-custom-step-popover ${state.isCustomStepOpen ? '' : 'hidden'}" id="forecastNewCustomStepPopover">
                    <span class="forecast-new-custom-step-actions" aria-label="Переход по пользовательскому шагу">
                        <button type="button" data-custom-step-direction="-1" aria-label="Назад на пользовательский шаг">&larr;</button>
                        <button type="button" data-custom-step-direction="1" aria-label="Вперед на пользовательский шаг">&rarr;</button>
                    </span>
                    <label class="forecast-new-custom-step-field forecast-new-custom-step-field--amount">
                        <span>Шаг</span>
                        <input type="number" min="1" max="9999" step="1" value="${customStep.amount}" data-custom-step-input="amount">
                    </label>
                    <label class="forecast-new-custom-step-field forecast-new-custom-step-field--unit">
                        <span>Ед.</span>
                        <select data-custom-step-input="unit">${customStepUnitOptions}</select>
                    </label>
                </span>
            </span>
            <span class="forecast-new-time-stepper-display">
                <span class="forecast-new-time-stepper-group forecast-new-time-stepper-group--date" aria-label="Дата">
                    <span class="forecast-new-time-stepper-group forecast-new-time-stepper-group--year">${segmentMarkup('yearThousands')}${segmentMarkup('yearHundreds')}${segmentMarkup('yearTens')}${segmentMarkup('yearOnes')}</span>
                    <span class="forecast-new-time-stepper-separator" aria-hidden="true">.</span>
                    <span class="forecast-new-time-stepper-group forecast-new-time-stepper-group--month">${segmentMarkup('monthTens')}${segmentMarkup('monthOnes')}</span>
                    <span class="forecast-new-time-stepper-separator" aria-hidden="true">.</span>
                    <span class="forecast-new-time-stepper-group forecast-new-time-stepper-group--day">${segmentMarkup('dayTens')}${segmentMarkup('dayOnes')}</span>
                </span>
                <span class="forecast-new-time-stepper-separator forecast-new-time-stepper-separator--major" aria-hidden="true">,</span>
                <span class="forecast-new-time-stepper-group forecast-new-time-stepper-group--time" aria-label="Время">
                    ${segmentMarkup('hour')}
                    <span class="forecast-new-time-stepper-separator" aria-hidden="true">:</span>
                    <span class="forecast-new-time-stepper-group forecast-new-time-stepper-group--minute">${segmentMarkup('tenMinute')}${segmentMarkup('minute')}</span>
                    <span class="forecast-new-time-stepper-separator" aria-hidden="true">:</span>
                    <span class="forecast-new-time-stepper-group forecast-new-time-stepper-group--second">${segmentMarkup('tenSecond')}${segmentMarkup('second')}</span>
                </span>
            </span>
        `;
    }

    function renderOrUpdateTimeStepper() {
        if (!refs.forecastNewTimeStepper?.querySelector('[data-time-step-key]')) {
            renderTimeStepper();
            return;
        }
        updateTimeStepperValues(refs.forecastNewTimeStepper, state.selectedDateTime);
    }

    function renderNatalTimeStepper() {
        if (!refs.forecastNewNatalTimeStepper) return;
        const values = getTimeStepperSegmentValues(state.natalSelectedDateTime);
        const customStep = normalizeCustomStep(state.natalCustomStep);
        const customStepLabel = formatCustomStepLabel(customStep);
        const customStepTooltip = `Кастомный шаг: ${customStepLabel}`;
        const customStepUnitOptions = CUSTOM_STEP_UNITS.map((unit) => `
            <option value="${unit.value}" ${unit.value === customStep.unit ? 'selected' : ''}>${escapeHtml(unit.label)}</option>
        `).join('');
        const segmentMarkup = (segmentKey) => {
            const segment = TIME_STEPPER_SEGMENTS.find((item) => item.key === segmentKey);
            const value = values[segmentKey] ?? '';
            if (!segment) return '';
            return `
                <span class="forecast-new-time-stepper-segment forecast-new-time-stepper-segment--${segment.key}" data-time-step-key="${segment.key}" tabindex="0" role="spinbutton" aria-label="${escapeHtml(segment.title)}" aria-valuetext="${escapeHtml(value)}" title="${escapeHtml(segment.title)}">
                    <button type="button" class="forecast-new-time-stepper-btn forecast-new-time-stepper-btn--up" data-time-step-segment="${segment.key}" data-time-step-direction="1" aria-label="${escapeHtml(segment.title)} +1"></button>
                    <span class="forecast-new-time-stepper-value">${escapeHtml(value)}</span>
                    <button type="button" class="forecast-new-time-stepper-btn forecast-new-time-stepper-btn--down" data-time-step-segment="${segment.key}" data-time-step-direction="-1" aria-label="${escapeHtml(segment.title)} -1"></button>
                </span>
            `;
        };

        refs.forecastNewNatalTimeStepper.innerHTML = `
            <button
                type="button"
                class="forecast-new-stepper-action"
                data-reset-moment="natal"
                title="Вернуть дату и время рождения"
                aria-label="Вернуть дату и время рождения"
            >↺</button>
            <span class="forecast-new-custom-step ${state.natalIsCustomStepOpen ? 'is-open' : ''}">
                <button
                    type="button"
                    class="forecast-new-custom-step-toggle"
                    data-custom-step-toggle
                    aria-expanded="${state.natalIsCustomStepOpen ? 'true' : 'false'}"
                    aria-controls="forecastNewNatalCustomStepPopover"
                    title="${escapeHtml(customStepTooltip)}"
                    aria-label="${escapeHtml(customStepTooltip)}"
                >
                    <span aria-hidden="true">⇄</span>
                </button>
                <span class="forecast-new-custom-step-popover ${state.natalIsCustomStepOpen ? '' : 'hidden'}" id="forecastNewNatalCustomStepPopover">
                    <span class="forecast-new-custom-step-actions" aria-label="Переход по пользовательскому шагу">
                        <button type="button" data-custom-step-direction="-1" aria-label="Назад на пользовательский шаг">&larr;</button>
                        <button type="button" data-custom-step-direction="1" aria-label="Вперед на пользовательский шаг">&rarr;</button>
                    </span>
                    <label class="forecast-new-custom-step-field forecast-new-custom-step-field--amount">
                        <span>Шаг</span>
                        <input type="number" min="1" max="9999" step="1" value="${customStep.amount}" data-custom-step-input="amount">
                    </label>
                    <label class="forecast-new-custom-step-field forecast-new-custom-step-field--unit">
                        <span>Ед.</span>
                        <select data-custom-step-input="unit">${customStepUnitOptions}</select>
                    </label>
                </span>
            </span>
            <span class="forecast-new-time-stepper-display">
                <span class="forecast-new-time-stepper-group forecast-new-time-stepper-group--date" aria-label="Дата рождения">
                    <span class="forecast-new-time-stepper-group forecast-new-time-stepper-group--year">${segmentMarkup('yearThousands')}${segmentMarkup('yearHundreds')}${segmentMarkup('yearTens')}${segmentMarkup('yearOnes')}</span>
                    <span class="forecast-new-time-stepper-separator" aria-hidden="true">.</span>
                    <span class="forecast-new-time-stepper-group forecast-new-time-stepper-group--month">${segmentMarkup('monthTens')}${segmentMarkup('monthOnes')}</span>
                    <span class="forecast-new-time-stepper-separator" aria-hidden="true">.</span>
                    <span class="forecast-new-time-stepper-group forecast-new-time-stepper-group--day">${segmentMarkup('dayTens')}${segmentMarkup('dayOnes')}</span>
                </span>
                <span class="forecast-new-time-stepper-separator forecast-new-time-stepper-separator--major" aria-hidden="true">,</span>
                <span class="forecast-new-time-stepper-group forecast-new-time-stepper-group--time" aria-label="Время рождения">
                    ${segmentMarkup('hour')}
                    <span class="forecast-new-time-stepper-separator" aria-hidden="true">:</span>
                    <span class="forecast-new-time-stepper-group forecast-new-time-stepper-group--minute">${segmentMarkup('tenMinute')}${segmentMarkup('minute')}</span>
                    <span class="forecast-new-time-stepper-separator" aria-hidden="true">:</span>
                    <span class="forecast-new-time-stepper-group forecast-new-time-stepper-group--second">${segmentMarkup('tenSecond')}${segmentMarkup('second')}</span>
                </span>
            </span>
        `;
    }

    function renderOrUpdateNatalTimeStepper() {
        if (!refs.forecastNewNatalTimeStepper?.querySelector('[data-time-step-key]')) {
            renderNatalTimeStepper();
            return;
        }
        updateTimeStepperValues(refs.forecastNewNatalTimeStepper, state.natalSelectedDateTime);
    }

    function updateTimeStepperValues(root, datetimeValue) {
        if (!root) return;
        const values = getTimeStepperSegmentValues(datetimeValue);
        root.querySelectorAll('[data-time-step-key]').forEach((segmentEl) => {
            const key = segmentEl.dataset.timeStepKey;
            const value = values[key] ?? '';
            const valueEl = segmentEl.querySelector('.forecast-new-time-stepper-value');
            if (valueEl) valueEl.textContent = value;
            segmentEl.setAttribute('aria-valuetext', value);
        });
    }

    function toggleNatalCustomStepPopover() {
        setNatalCustomStepPopoverOpen(!state.natalIsCustomStepOpen);
    }

    function setNatalCustomStepPopoverOpen(isOpen) {
        state.natalIsCustomStepOpen = isOpen === true;
        const popover = refs.forecastNewNatalTimeStepper?.querySelector('#forecastNewNatalCustomStepPopover');
        const toggle = refs.forecastNewNatalTimeStepper?.querySelector('[data-custom-step-toggle]');
        popover?.classList.toggle('hidden', !state.natalIsCustomStepOpen);
        refs.forecastNewNatalTimeStepper?.querySelector('.forecast-new-custom-step')?.classList.toggle('is-open', state.natalIsCustomStepOpen);
        toggle?.setAttribute('aria-expanded', state.natalIsCustomStepOpen ? 'true' : 'false');
        if (state.natalIsCustomStepOpen) {
            positionCustomStepPopover(toggle, popover);
        }
    }

    function updateNatalCustomStepFromControls() {
        const amountInput = refs.forecastNewNatalTimeStepper?.querySelector('[data-custom-step-input="amount"]');
        const unitSelect = refs.forecastNewNatalTimeStepper?.querySelector('[data-custom-step-input="unit"]');
        state.natalCustomStep = normalizeCustomStep({
            amount: amountInput?.value,
            unit: unitSelect?.value,
        });
        const toggle = refs.forecastNewNatalTimeStepper?.querySelector('[data-custom-step-toggle]');
        if (toggle) {
            const tooltip = `Кастомный шаг: ${formatCustomStepLabel(state.natalCustomStep)}`;
            toggle.setAttribute('title', tooltip);
            toggle.setAttribute('aria-label', tooltip);
        }
    }

    function stepNatalDateTimeSegment(segment, direction) {
        const dir = direction >= 0 ? 1 : -1;
        state.natalSelectedDateTime = addDateTimeUnit(state.natalSelectedDateTime, segment.unit, segment.amount * dir);
        renderOrUpdateNatalTimeStepper();
        updateNatalMomentMeta();
        setNatalLightweightLoading(true);
        void loadNatal({ lightweight: true });
    }

    function stepNatalDateTimeByCustom(direction) {
        updateNatalCustomStepFromControls();
        const step = normalizeCustomStep(state.natalCustomStep);
        const dir = direction >= 0 ? 1 : -1;
        const unit = step.unit === 'week' ? 'day' : step.unit;
        const amount = step.unit === 'week' ? step.amount * 7 : step.amount;
        state.natalSelectedDateTime = addDateTimeUnit(state.natalSelectedDateTime, unit, amount * dir);
        renderOrUpdateNatalTimeStepper();
        setNatalCustomStepPopoverOpen(true);
        updateNatalMomentMeta();
        setNatalLightweightLoading(true);
        void loadNatal({ lightweight: true });
    }

    function resetNatalDateTime() {
        if (!state.natalInitialDateTime) return;
        state.natalSelectedDateTime = state.natalInitialDateTime;
        renderOrUpdateNatalTimeStepper();
        updateNatalMomentControls();
        setNatalLightweightLoading(true);
        void loadNatal({ lightweight: true });
    }

    function resetPrognosticDateTime() {
        setSelectedDateTime(getLocalNowIso(state.timezone));
        state.lastStepperAction = null;
        syncControlsFromState();
        schedulePersist();
        setLightweightLoading(true);
        void loadActiveLayers({ lightweight: true });
    }

    function toggleNatalMomentEditor() {
        const isOpen = refs.forecastNewNatalCard?.classList.contains('hidden') !== false;
        setNatalMomentEditorOpen(isOpen);
    }

    function setNatalMomentEditorOpen(isOpen) {
        refs.forecastNewNatalCard?.classList.toggle('hidden', !isOpen);
        refs.natalMomentToggle?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    function updateNatalMomentControls() {
        const [date, time] = splitTargetDatetime(state.natalSelectedDateTime);
        if (refs.natalDateInput) refs.natalDateInput.value = date;
        if (refs.natalTimeInput) refs.natalTimeInput.value = time;
        if (refs.natalTimezoneInput) refs.natalTimezoneInput.value = normalizeTimezoneValue(state.natalTimezone, state.natalLocation?.name) || '';
        if (refs.natalLocationInput) refs.natalLocationInput.value = state.natalLocation.name || '';
        if (refs.natalLatitudeInput) refs.natalLatitudeInput.value = state.natalLocation.latitude ?? '';
        if (refs.natalLongitudeInput) refs.natalLongitudeInput.value = state.natalLocation.longitude ?? '';
        updateNatalMomentMeta();
    }

    function populateNatalTimezoneOptions() {
        const selectedTimezone = normalizeTimezoneValue(refs.natalTimezoneInput?.value || state.natalTimezone, state.natalLocation?.name);
        window.Timezones?.populate?.(refs.natalTimezoneInput);
        if (refs.natalTimezoneInput && selectedTimezone) {
            refs.natalTimezoneInput.value = selectedTimezone;
        }
        if (selectedTimezone) {
            state.natalTimezone = selectedTimezone;
        }
    }

    function bindNatalLocationAutocomplete() {
        if (!window.PlaceAutocomplete || !refs.natalLocationInput || !refs.natalLocationSuggestions) return;
        window.PlaceAutocomplete.attach({
            input: refs.natalLocationInput,
            suggestions: refs.natalLocationSuggestions,
            minChars: 2,
            debounceMs: 350,
            limit: 5,
            getLabel: (item) => item.shortName || item.displayName,
            onInput: (place) => {
                state.natalLocation = {
                    ...state.natalLocation,
                    name: refs.natalLocationInput.value.trim(),
                    latitude: null,
                    longitude: null,
                    sourceId: null,
                };
                if (refs.natalLatitudeInput) refs.natalLatitudeInput.value = '';
                if (refs.natalLongitudeInput) refs.natalLongitudeInput.value = '';
                const guessedTimezone = window.Timezones?.guess?.(place);
                if (guessedTimezone && refs.natalTimezoneInput) {
                    refs.natalTimezoneInput.value = guessedTimezone;
                    state.natalTimezone = guessedTimezone;
                }
                updateNatalMomentMeta();
            },
            onSelect: async (item) => {
                if (refs.natalLocationInput) refs.natalLocationInput.value = item.shortName || item.displayName;
                if (refs.natalLatitudeInput) refs.natalLatitudeInput.value = String(item.lat);
                if (refs.natalLongitudeInput) refs.natalLongitudeInput.value = String(item.lon);

                let resolvedTimezone = null;
                if (item.sourceId && window.AstroAPI?.resolvePlaceTimezone) {
                    try {
                        resolvedTimezone = await window.AstroAPI.resolvePlaceTimezone(item.sourceId);
                    } catch (_error) {
                        resolvedTimezone = null;
                    }
                }
                if (!resolvedTimezone) {
                    resolvedTimezone = window.Timezones?.guess?.(item.displayName || item.shortName) || null;
                }
                if (resolvedTimezone && refs.natalTimezoneInput) {
                    refs.natalTimezoneInput.value = resolvedTimezone;
                }

                state.natalLocation = {
                    name: item.shortName || item.displayName,
                    latitude: item.lat,
                    longitude: item.lon,
                    sourceId: item.sourceId || null,
                };
                if (resolvedTimezone) {
                    state.natalTimezone = resolvedTimezone;
                }
                updateNatalMomentMeta();
                renderNatalTimeStepper();
                await loadNatal();
            },
        });
    }

    function handleNatalLocationInput() {
        const nextValue = refs.natalLocationInput?.value?.trim() || '';
        const normalizedSelected = normalizeLooseText(state.natalLocation?.name);
        const normalizedNext = normalizeLooseText(nextValue);
        if (!normalizedNext || normalizedNext !== normalizedSelected) {
            state.natalLocation = {
                ...state.natalLocation,
                name: nextValue,
                latitude: null,
                longitude: null,
                sourceId: null,
            };
            if (refs.natalLatitudeInput) refs.natalLatitudeInput.value = '';
            if (refs.natalLongitudeInput) refs.natalLongitudeInput.value = '';
            updateNatalMomentMeta();
        }
    }

    function applyNatalLocationInputsToState() {
        state.natalTimezone = normalizeTimezoneValue(refs.natalTimezoneInput?.value?.trim(), refs.natalLocationInput?.value?.trim())
            || normalizeTimezoneValue(state.natalTimezone, refs.natalLocationInput?.value?.trim())
            || 'UTC';
        state.natalLocation = {
            name: refs.natalLocationInput?.value?.trim() || '',
            latitude: numberOrNull(refs.natalLatitudeInput?.value),
            longitude: numberOrNull(refs.natalLongitudeInput?.value),
            sourceId: state.natalLocation?.sourceId || null,
        };
    }

    async function onNatalDatetimeChange() {
        const date = refs.natalDateInput?.value || splitTargetDatetime(state.natalSelectedDateTime)[0];
        const time = refs.natalTimeInput?.value || '12:00:00';
        state.natalSelectedDateTime = `${date}T${normalizeTime(time)}`;
        renderNatalTimeStepper();
        updateNatalMomentMeta();
        await loadNatal({ lightweight: true });
    }

    async function loadNatal(options = {}) {
        if (!window.AstroAPI?.calculateNatalChart) return;
        const seq = ++state.requestSeq;
        if (options.lightweight) setNatalLightweightLoading(true);
        try {
            const birth = state.natalData?.birth_data || {};
            const [date, time] = splitTargetDatetime(state.natalSelectedDateTime);
            const newNatalData = await window.AstroAPI.calculateNatalChart({
                first_name: birth.first_name || '',
                last_name: birth.last_name || '',
                date,
                time,
                timezone: state.natalTimezone,
                place: state.natalLocation.name || '',
                latitude: state.natalLocation.latitude ?? undefined,
                longitude: state.natalLocation.longitude ?? undefined,
                house_system: state.pageSettings.houseSystem,
            }, { saveToDb: false });

            if (!newNatalData || seq !== state.requestSeq) return;

            state.natalData = {
                ...newNatalData,
                user_id: state.userId,
                birth_data: {
                    ...newNatalData.birth_data,
                    first_name: birth.first_name,
                    last_name: birth.last_name,
                },
            };
            state.natalWheelData = window.NatalWheelData?.prepareNatalWheelData
                ? window.NatalWheelData.prepareNatalWheelData(state.natalData, { houseSystem: state.pageSettings.houseSystem })
                : state.natalData;

            state.cache = {};
            abortAllInFlightLayerRequests();
            setNatalLightweightLoading(false);
            renderStaticNatal();
            await loadActiveLayers({ lightweight: true });
        } catch (error) {
            setNatalLightweightLoading(false);
            if (seq !== state.requestSeq) return;
            console.error('Natal recalculation failed:', error);
        }
    }

    function setNatalLightweightLoading(isLoading) {
        refs.forecastNewNatalPanel?.classList.toggle('forecast-new-loading', isLoading);
        refs.forecastNewWheelShell?.classList.toggle('forecast-new-loading', isLoading);
    }

    function toggleCustomStepPopover() {
        setCustomStepPopoverOpen(!state.isCustomStepOpen);
    }

    function setCustomStepPopoverOpen(isOpen) {
        state.isCustomStepOpen = isOpen === true;
        const popover = refs.forecastNewTimeStepper?.querySelector('#forecastNewCustomStepPopover');
        const toggle = refs.forecastNewTimeStepper?.querySelector('[data-custom-step-toggle]');
        popover?.classList.toggle('hidden', !state.isCustomStepOpen);
        refs.forecastNewTimeStepper?.querySelector('.forecast-new-custom-step')?.classList.toggle('is-open', state.isCustomStepOpen);
        toggle?.setAttribute('aria-expanded', state.isCustomStepOpen ? 'true' : 'false');
        if (state.isCustomStepOpen) {
            positionCustomStepPopover(toggle, popover);
        }
    }

    function positionCustomStepPopover(toggle, popover) {
        if (!(toggle instanceof HTMLElement) || !(popover instanceof HTMLElement)) return;

        const gap = 8;
        const toggleRect = toggle.getBoundingClientRect();
        const popoverWidth = popover.offsetWidth || 196;
        const popoverHeight = popover.offsetHeight || 118;

        let left = toggleRect.left;
        let top = toggleRect.bottom + gap;

        const maxLeft = window.innerWidth - popoverWidth - 8;
        left = Math.max(8, Math.min(left, maxLeft));

        if (top + popoverHeight > window.innerHeight - 8) {
            const aboveTop = toggleRect.top - popoverHeight - gap;
            top = aboveTop >= 8 ? aboveTop : Math.max(8, window.innerHeight - popoverHeight - 8);
        }

        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
    }

    function updateCustomStepFromControls() {
        const amountInput = refs.forecastNewTimeStepper?.querySelector('[data-custom-step-input="amount"]');
        const unitSelect = refs.forecastNewTimeStepper?.querySelector('[data-custom-step-input="unit"]');
        state.customStep = normalizeCustomStep({
            amount: amountInput?.value,
            unit: unitSelect?.value,
        });
        const toggle = refs.forecastNewTimeStepper?.querySelector('[data-custom-step-toggle]');
        if (toggle) {
            const tooltip = `Кастомный шаг: ${formatCustomStepLabel(state.customStep)}`;
            toggle.setAttribute('title', tooltip);
            toggle.setAttribute('aria-label', tooltip);
        }
        schedulePersist();
    }

    function renderStaticNatal() {
        state.natalRenderer?.setAspectTypeFilter?.('all');
        state.natalRenderer?.setHouseNumberStyle?.(state.pageSettings.houseNumberStyle);
        state.natalRenderer?.setDisplayPreferences?.({
            showSpeed: state.pageSettings.showSpeed !== false,
            showStationary: state.pageSettings.showStationary !== false,
            showApplyingSeparating: state.pageSettings.showApplyingSeparating === true,
            showAspectText: state.pageSettings.showAspectText === true,
        });
        state.natalRenderer?.render(filterChartDataForSidePanel(state.natalWheelData, { scope: 'natal' }));
        renderForecastNewRulersTab('natalRulersContainer', state.natalWheelData, 'forecastNewNatalRulersMode');
        renderInlineMatrixControls();
        applyInlineMatrixRowState();
        renderMatrixEditor();
        activateSavedTabs();
    }

    function renderForecastNewRulersTab(containerId, chartData, selectId) {
        window.DispositorChains?.render?.(containerId, chartData || {
            planets: [],
            houses: [],
            balances: null,
            cosmogram_pattern: null,
        }, { selectId });
    }

    function renderMatrixEditor() {
        const bodies = window.AstroPreferences?.MATRIX_BODIES || [];
        const rows = getMatrixRowsForScope('prognostic');
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
                                <td><input type="checkbox" data-matrix-scope="prognostic" data-matrix-body="${body}" data-matrix-field="display" ${rows?.[body]?.display !== false ? 'checked' : ''}></td>
                                <td><input type="checkbox" data-matrix-scope="prognostic" data-matrix-body="${body}" data-matrix-field="aspecting" ${rows?.[body]?.aspecting !== false ? 'checked' : ''}></td>
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
        const scope = container?.dataset?.matrixScope || 'prognostic';
        const rows = getMatrixRowsForScope(scope);
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
        const scope = input.dataset.matrixScope || 'prognostic';
        const rows = getMatrixRowsForScope(scope);
        rows[body] = { ...(rows[body] || { display: true, aspecting: true }), [field]: input.checked };
        setMatrixRowsForScope(scope, rows);
    }

    function syncMatrixCheckboxes() {
        document.querySelectorAll('input[data-matrix-body][data-matrix-field]').forEach((input) => {
            const body = matrixBodyKey(input.dataset.matrixBody);
            const field = input.dataset.matrixField;
            if (!body || !['display', 'aspecting'].includes(field)) return;
            const scope = input.dataset.matrixScope || 'prognostic';
            const rows = getMatrixRowsForScope(scope);
            input.checked = rows?.[body]?.[field] !== false;
        });
    }

    async function applyMatrixRows() {
        refreshViewModel();
        renderWheel();
        renderMatrixSensitivePanelData();
        applyInlineMatrixRowState();
        syncHoveredAspectToActiveSurface();
        schedulePersistViewOverrides();
        schedulePersist();
    }

    function refreshViewModel() {
        if (!state.natalWheelData) return;
        const rawViewModel = window.PrognosticLayerNormalizer.buildViewModel(
            state.natalWheelData,
            state.layers || {},
            { activeMethods: state.activeLayers },
        );
        state.viewModel = filterViewModelForSettings(rawViewModel);
    }

    function updateRendererMatrixSensitiveData(renderer, chartData) {
        if (!renderer || !chartData) return;
        renderer.chartData = chartData;
        renderer.renderAspects?.(chartData.aspects || []);
        renderer.renderAspectGrid?.(chartData.aspects || [], chartData.planets || []);
        renderer.renderConfigurations?.(
            chartData.aspect_configurations || [],
            chartData.stelliums || []
        );
    }

    function renderMatrixSensitivePanelData() {
        updateRendererMatrixSensitiveData(
            state.natalRenderer,
            filterChartDataForSidePanel(state.natalWheelData, { scope: 'natal' })
        );

        const method = state.selectedRightLayer;
        const layer = state.viewModel?.activePrognosticLayers?.find((item) => item.method === method);
        if (layer) {
            updateRendererMatrixSensitiveData(state.prognosticRenderer, filterChartDataForSidePanel({
                planets: layer.bodies || [],
                houses: layer.houses || [],
                aspects: layer.aspects || [],
                aspect_configurations: [],
                stelliums: [],
                balances: null,
                cosmogram_pattern: null,
            }, { scope: 'prognostic' }));
        }
    }

    function renderInlineMatrixControls() {
        const natalRows = getMatrixRowsForScope('natal');
        const prognosticRows = getMatrixRowsForScope('prognostic');
        refs.forecastNewLayout?.querySelectorAll('.forecast-new-matrix-inline-cell').forEach((cell) => cell.remove());

        document.querySelectorAll('#natalPlanetsTable tr[data-planet]').forEach((row) => {
            const body = matrixBodyKey(row.dataset.planet);
            row.insertAdjacentHTML('beforeend', matrixControlCells(body, natalRows, 'natal'));
        });

        document.querySelectorAll('#progPlanetsTable tr[data-planet]').forEach((row) => {
            const body = matrixBodyKey(row.dataset.planet);
            row.insertAdjacentHTML('beforeend', matrixControlCells(body, prognosticRows, 'prognostic'));
        });
    }

    function applyInlineMatrixRowState() {
        const natalRows = getMatrixRowsForScope('natal');
        const prognosticRows = getMatrixRowsForScope('prognostic');

        document.querySelectorAll('#natalPlanetsTable tr[data-planet]').forEach((row) => {
            const body = matrixBodyKey(row.dataset.planet);
            const config = natalRows?.[body] || { display: true, aspecting: true };
            row.hidden = false;
            row.classList.toggle('forecast-new-matrix-row-display-off', false);
            row.classList.toggle('forecast-new-matrix-row-aspecting-off', config.aspecting === false);
        });

        document.querySelectorAll('#progPlanetsTable tr[data-planet]').forEach((row) => {
            const body = matrixBodyKey(row.dataset.planet);
            const config = prognosticRows?.[body] || { display: true, aspecting: true };
            row.hidden = false;
            row.classList.toggle('forecast-new-matrix-row-display-off', false);
            row.classList.toggle('forecast-new-matrix-row-aspecting-off', config.aspecting === false);
        });

    }

    function matrixControlCells(bodyName, rows, scope = 'prognostic') {
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
                        <input type="checkbox" data-matrix-scope="${escapeHtml(scope)}" data-matrix-body="${escapeHtml(body)}" data-matrix-field="${field}" ${checked}>
                    </label>
                </td>
            `;
        }).join('');
    }

    function matrixBodyKey(name) {
        return window.AstroPreferences?.normalizeMatrixBodyName
            ? window.AstroPreferences.normalizeMatrixBodyName(name)
            : String(name || '');
    }

    function ensureBodyActionMenu() {
        let menu = document.body.querySelector('.forecast-new-body-action-menu[data-menu-scope="forecast-new"]');
        if (menu) return menu;

        menu = document.createElement('div');
        menu.className = 'forecast-new-body-action-menu hidden';
        menu.dataset.menuScope = 'forecast-new';
        menu.setAttribute('role', 'menu');
        document.body.appendChild(menu);

        menu.addEventListener('click', (event) => event.stopPropagation());
        menu.addEventListener('contextmenu', (event) => event.preventDefault());
        menu.addEventListener('click', async (event) => {
            const button = event.target instanceof Element
                ? event.target.closest('button[data-action-field]')
                : null;
            if (!(button instanceof HTMLButtonElement)) return;
            const body = matrixBodyKey(menu.dataset.body);
            const field = button.dataset.actionField;
            if (!body || !['display', 'aspecting'].includes(field)) return;
            const scope = menu.dataset.bodyScope || 'prognostic';

            const rows = getMatrixRowsForScope(scope);
            const current = rows?.[body]?.[field] !== false;
            rows[body] = {
                ...(rows[body] || { display: true, aspecting: true }),
                [field]: !current,
            };
            setMatrixRowsForScope(scope, rows);
            syncMatrixCheckboxes();
            renderBodyActionMenu(body, menu.dataset.method || '', menu, scope);
            await applyMatrixRows();
        });

        return menu;
    }

    function openBodyActionMenu(detail = {}) {
        const body = matrixBodyKey(detail.body);
        if (!body) return;
        const menu = ensureBodyActionMenu();
        const scope = detail.method === 'natal' ? 'natal' : 'prognostic';
        state.bodyActionMenu = { body, method: detail.method || '', scope };
        renderBodyActionMenu(body, detail.method || '', menu, scope);
        positionBodyActionMenu(menu, detail.clientX, detail.clientY);
        menu.classList.remove('hidden');
    }

    function renderBodyActionMenu(body, method, menu = ensureBodyActionMenu(), scope = 'prognostic') {
        const rows = getMatrixRowsForScope(scope);
        const config = rows?.[body] || { display: true, aspecting: true };
        const label = escapeHtml(planetName(body));
        menu.dataset.body = body;
        menu.dataset.method = method || '';
        menu.dataset.bodyScope = scope;
        menu.innerHTML = `
            <div class="forecast-new-body-action-menu-title">${label}</div>
            <div class="forecast-new-body-action-menu-controls">
                ${bodyActionToggleMarkup('display', 'п', 'Показ', config.display !== false)}
                ${bodyActionToggleMarkup('aspecting', 'а', 'Аспектация', config.aspecting !== false)}
            </div>
        `;
    }

    function bodyActionToggleMarkup(field, glyph, label, checked) {
        const escapedLabel = escapeHtml(label);
        return `
            <button type="button" class="settings-check-option settings-check-option--pill settings-check-option--icon-only forecast-new-body-action-toggle" data-action-field="${field}" aria-label="${escapedLabel}" aria-pressed="${checked ? 'true' : 'false'}" title="${escapedLabel}">
                <span class="settings-check-option-glyph" aria-hidden="true">${glyph}</span>
            </button>
        `;
    }

    function positionBodyActionMenu(menu, clientX, clientY) {
        let x = Number(clientX) + 8;
        let y = Number(clientY) + 8;
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        const maxX = window.innerWidth - menu.offsetWidth - 8;
        const maxY = window.innerHeight - menu.offsetHeight - 8;
        x = Math.max(8, Math.min(x, Math.max(8, maxX)));
        y = Math.max(8, Math.min(y, Math.max(8, maxY)));
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
    }

    function closeBodyActionMenu() {
        const menu = document.body.querySelector('.forecast-new-body-action-menu[data-menu-scope="forecast-new"]');
        menu?.classList.add('hidden');
        state.bodyActionMenu = { body: null, method: null, scope: 'prognostic' };
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

    function hasArraySettingChanged(previousValue, nextValue) {
        const previous = Array.isArray(previousValue) ? previousValue : [];
        const next = Array.isArray(nextValue) ? nextValue : [];
        if (previous.length !== next.length) return true;
        return previous.some((value, index) => value !== next[index]);
    }

    function hasSettingChanged(previousSettings, nextSettings, key) {
        if (Array.isArray(previousSettings?.[key]) || Array.isArray(nextSettings?.[key])) {
            return hasArraySettingChanged(previousSettings?.[key], nextSettings?.[key]);
        }
        return previousSettings?.[key] !== nextSettings?.[key];
    }

    function haveAnySettingsChanged(previousSettings, nextSettings, keys) {
        return keys.some((key) => hasSettingChanged(previousSettings, nextSettings, key));
    }

    function applyRendererDisplayPreferences() {
        const preferences = {
            showSpeed: state.pageSettings.showSpeed !== false,
            showStationary: state.pageSettings.showStationary !== false,
            showApplyingSeparating: state.pageSettings.showApplyingSeparating === true,
            showAspectText: state.pageSettings.showAspectText === true,
        };
        state.natalRenderer?.setDisplayPreferences?.(preferences);
        state.prognosticRenderer?.setDisplayPreferences?.(preferences);
    }

    function applyPanelSettingsChanges(previousSettings, nextSettings) {
        const houseNumberStyleChanged = hasSettingChanged(previousSettings, nextSettings, 'houseNumberStyle');
        if (houseNumberStyleChanged) {
            renderStaticNatal();
            renderRightPanel();
            return;
        }

        const displayPreferenceChanged = haveAnySettingsChanged(previousSettings, nextSettings, [
            'showSpeed',
            'showStationary',
            'showApplyingSeparating',
            'showAspectText',
        ]);
        const aspectFilterChanged = haveAnySettingsChanged(previousSettings, nextSettings, [
            'aspectScope',
            'enabledAspectTypes',
            'aspectPhaseFilter',
        ]);

        if (displayPreferenceChanged) {
            applyRendererDisplayPreferences();
        }
        if (aspectFilterChanged) {
            renderMatrixSensitivePanelData();
        }
        if (displayPreferenceChanged || aspectFilterChanged) {
            syncHoveredAspectToActiveSurface();
        }
    }

    async function applySettings() {
        const previousSettings = { ...state.pageSettings };
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
            showAspectText: state.pageSettings.showAspectText === true,
            showWheelStationary: refs.showWheelStationaryToggle?.checked === true,
            showWheelDegree: refs.showWheelDegreeToggle?.checked === true,
            angleAscDscBold: refs.angleAscDscBoldToggle?.checked !== false,
            angleMcIcBold: refs.angleMcIcBoldToggle?.checked !== false,
            houseNumberStyle: refs.houseNumberStyleSelect?.value === 'roman' ? 'roman' : 'arabic',
            houseLabelsOutside: refs.houseLabelsOutsideToggle?.checked === true,
            showTransitCusps: refs.showTransitCuspsToggle?.checked !== false,
            showProgressionCusps: refs.showProgressionCuspsToggle?.checked !== false,
            showDirectionCusps: refs.showDirectionCuspsToggle?.checked !== false,
        };

        if (refs.iconScaleValue) {
            refs.iconScaleValue.textContent = `${Math.round(iconScale * 100)}%`;
        }

        if (state.pageSettings.houseSystem !== normalizeHouseSystemCode(state.natalData?.birth_data?.house_system || 'P')) {
            await updateHouseSystem(nextHouseSystem);
        } else {
            const wheelSettingsChanged = haveAnySettingsChanged(previousSettings, state.pageSettings, [
                'orientation',
                'planetScale',
                'pointScale',
                'aspectScope',
                'enabledAspectTypes',
                'aspectPhaseFilter',
                'houseLabelsOutside',
                'showTransitCusps',
                'showProgressionCusps',
                'showDirectionCusps',
                'showWheelStationary',
                'showWheelDegree',
                'angleAscDscBold',
                'angleMcIcBold',
            ]);
            if (wheelSettingsChanged) {
                renderWheel();
            }
            applyPanelSettingsChanges(previousSettings, state.pageSettings);
        }
        schedulePersistViewOverrides();
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
        const date = refs.targetDateInput?.value || splitTargetDatetime(state.selectedDateTime)[0];
        const time = refs.targetTimeInput?.value || '12:00:00';
        setSelectedDateTime(`${date}T${normalizeTime(time)}`);
        state.lastStepperAction = null;
        syncControlsFromState();
        schedulePersist();
        await loadActiveLayers({ lightweight: true });
    }

    async function stepTargetDatetime(direction) {
        setSelectedDateTime(addStep(state.selectedDateTime, state.stepMode, direction));
        syncControlsFromState();
        schedulePersist();
        await loadActiveLayers({ lightweight: true });
    }

    function stepSelectedDateTimeSegment(segment, direction) {
        const dir = direction >= 0 ? 1 : -1;
        setSelectedDateTime(addDateTimeUnit(state.selectedDateTime, segment.unit, segment.amount * dir));
        state.lastStepperAction = { type: 'segment', segment, direction: dir };
        syncControlsFromState();
        updatePrognosticTimeMeta();
        setLightweightLoading(true);
        schedulePersist();
        void loadActiveLayers({ lightweight: true });
    }

    function stepSelectedDateTimeByCustom(direction) {
        updateCustomStepFromControls();
        const step = normalizeCustomStep(state.customStep);
        const dir = direction >= 0 ? 1 : -1;
        const unit = step.unit === 'week' ? 'day' : step.unit;
        const amount = step.unit === 'week' ? step.amount * 7 : step.amount;
        setSelectedDateTime(addDateTimeUnit(state.selectedDateTime, unit, amount * dir));
        state.lastStepperAction = { type: 'custom', step, direction: dir };
        syncControlsFromState();
        setCustomStepPopoverOpen(true);
        updatePrognosticTimeMeta();
        setLightweightLoading(true);
        schedulePersist();
        void loadActiveLayers({ lightweight: true });
    }

    async function loadActiveLayers(options = {}) {
        const seq = ++state.requestSeq;
        state.pendingRequestToken = seq;
        const activeMethods = [...state.activeLayers];
        const nextLayers = {};
        let hasRenderedPartial = false;
        const hasCompletePreviousLayers = activeMethods.length > 0
            && activeMethods.every((method) => state.layers?.[method]);
        if (options.showLoader) showLoader();
        if (options.lightweight) setLightweightLoading(true);
        state.layers = Object.fromEntries(activeMethods
            .filter((method) => state.layers?.[method])
            .map((method) => [method, state.layers[method]]));
        renderRightLayerTabs();
        try {
            const results = await Promise.allSettled(activeMethods.map(async (method) => {
                const data = await fetchLayer(method, { seq });
                if (seq !== state.requestSeq) return null;
                nextLayers[method] = data;
                if (!hasCompletePreviousLayers) {
                    state.layers = { ...nextLayers };
                    renderWheel();
                    scheduleRightPanelRender();
                    showLayout();
                    hasRenderedPartial = true;
                }
                return data;
            }));
            if (seq !== state.requestSeq) return;
            const failures = results
                .filter((result) => result.status === 'rejected' && !isAbortError(result.reason));
            if (failures.length) {
                throw failures[0].reason;
            }
            state.layers = nextLayers;
            state.lastCalculatedTransitDateTime = activeMethods.includes('transit') ? state.selectedDateTime : state.lastCalculatedTransitDateTime;
            state.lastCalculatedPrognosticDate = splitTargetDatetime(state.selectedDateTime)[0];
            if (!hasRenderedPartial || hasCompletePreviousLayers) renderWheel();
            renderRightLayerTabs();
            scheduleRightPanelRender();
            showLayout();
            schedulePersist();
            scheduleAdjacentLayerPrefetch();
        } catch (error) {
            if (seq !== state.requestSeq) return;
            if (isAbortError(error)) return;
            console.error('Forecast New load failed:', error);
            showError(error.message || 'Ошибка загрузки прогностики');
        } finally {
            if (seq === state.requestSeq) {
                hideLoader();
                setLightweightLoading(false);
            }
        }
    }

    async function fetchLayer(method, options = {}) {
        const targetDateTime = options.targetDateTime || state.selectedDateTime;
        const targetTimezone = options.timezone || state.timezone;
        const targetLocation = options.location || state.location || {};
        const [date, time] = splitTargetDatetime(targetDateTime);
        const key = buildLayerCacheKey(method, date, {
            selectedDateTime: targetDateTime,
            timezone: targetTimezone,
            location: targetLocation,
        });
        if (state.cache[key]) return state.cache[key];
        const cachedLayer = readPersistedLayerCache(key);
        if (cachedLayer) {
            state.cache[key] = cachedLayer;
            return cachedLayer;
        }
        if (state.inFlight[key]) return state.inFlight[key];
        if (!options.prefetch) {
            abortInFlightLayerMethod(method, key);
        }

        const controller = new AbortController();

        const request = (async () => {
            if (method === 'transit') {
                return apiPost('/transits/calculate', {
                    user_id: state.userId,
                    date,
                    time,
                    timezone: targetTimezone,
                    location: targetLocation?.name || null,
                    latitude: targetLocation?.latitude,
                    longitude: targetLocation?.longitude,
                }, { signal: controller.signal });
            }
            if (method === 'progression') {
                return apiPost('/progressions/calculate', {
                    user_id: state.userId,
                    target_date: date,
                }, { signal: controller.signal });
            }
            return apiPost('/directions/calculate', {
                user_id: state.userId,
                target_date: date,
                direction_type: 'solar_arc',
            }, { signal: controller.signal });
        })().then((data) => {
            state.cache[key] = data;
            writePersistedLayerCache(key, data);
            return data;
        }).finally(() => {
            delete state.inFlight[key];
            delete state.inFlightByKey[key];
            if (state.inFlightByMethod[method]?.key === key) {
                delete state.inFlightByMethod[method];
            }
        });

        state.inFlight[key] = request;
        state.inFlightByKey[key] = controller;
        if (!options.prefetch) {
            state.inFlightByMethod[method] = { key, controller };
        }
        return request;
    }

    function abortInFlightLayerMethod(method, nextKey) {
        const inFlight = state.inFlightByMethod[method];
        if (!inFlight || inFlight.key === nextKey) return;
        inFlight.controller?.abort?.();
        delete state.inFlight[inFlight.key];
        delete state.inFlightByKey[inFlight.key];
        delete state.inFlightByMethod[method];
    }

    function abortAllInFlightLayerRequests() {
        Object.values(state.inFlightByKey || {}).forEach((controller) => {
            controller?.abort?.();
        });
        state.inFlight = {};
        state.inFlightByKey = {};
        state.inFlightByMethod = {};
    }

    function isAbortError(error) {
        return error?.name === 'AbortError';
    }

    function scheduleAdjacentLayerPrefetch() {
        clearTimeout(state.adjacentPrefetchTimer);
        if (!state.lastStepperAction || !state.activeLayers?.length) return;
        state.adjacentPrefetchTimer = setTimeout(() => {
            void prefetchAdjacentLayers();
        }, 80);
    }

    async function prefetchAdjacentLayers() {
        const nextDateTime = getAdjacentPrefetchDateTime();
        if (!nextDateTime) return;
        const activeMethods = [...state.activeLayers];
        await Promise.allSettled(activeMethods.map((method) => fetchLayer(method, {
            targetDateTime: nextDateTime,
            timezone: state.timezone,
            location: state.location,
            prefetch: true,
        })));
    }

    function getAdjacentPrefetchDateTime() {
        const action = state.lastStepperAction;
        if (!action) return '';
        if (action.type === 'segment' && action.segment) {
            return addDateTimeUnit(
                state.selectedDateTime,
                action.segment.unit,
                action.segment.amount * action.direction,
            );
        }
        if (action.type === 'custom' && action.step) {
            const step = normalizeCustomStep(action.step);
            const unit = step.unit === 'week' ? 'day' : step.unit;
            const amount = step.unit === 'week' ? step.amount * 7 : step.amount;
            return addDateTimeUnit(state.selectedDateTime, unit, amount * action.direction);
        }
        return '';
    }

    async function apiPost(endpoint, body, options = {}) {
        const withLocaleHeaders = window.AstroAPI?.withLocaleHeaders || ((headers) => headers);
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: withLocaleHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(body),
            signal: options.signal,
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

    function persistedLayerCacheStorageKey(key) {
        return `${LAYER_CACHE_PREFIX}${state.userId || 'anonymous'}:${key}`;
    }

    function readPersistedLayerCache(key) {
        try {
            const raw = localStorage.getItem(persistedLayerCacheStorageKey(key));
            if (!raw) return null;
            const payload = JSON.parse(raw);
            if (!payload || Date.now() - Number(payload.savedAt || 0) > LAYER_CACHE_TTL_MS) {
                localStorage.removeItem(persistedLayerCacheStorageKey(key));
                return null;
            }
            return payload.data || null;
        } catch {
            return null;
        }
    }

    function writePersistedLayerCache(key, data) {
        try {
            localStorage.setItem(persistedLayerCacheStorageKey(key), JSON.stringify({
                savedAt: Date.now(),
                data,
            }));
        } catch {
            // Storage may be full or unavailable; in-memory cache still applies.
        }
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
            natalMatrixRows: state.natalMatrixRows,
            prognosticMatrixRows: state.matrixRows,
            matrixRows: state.matrixRows,
            planetScale: state.pageSettings.planetScale,
            pointScale: state.pageSettings.pointScale,
            aspectScope: state.pageSettings.aspectScope,
            enabledAspectTypes: state.pageSettings.enabledAspectTypes,
            houseNumberStyle: state.pageSettings.houseNumberStyle,
            houseLabelsOutside: state.pageSettings.houseLabelsOutside,
            showTransitCusps: state.pageSettings.showTransitCusps,
            showProgressionCusps: state.pageSettings.showProgressionCusps,
            showDirectionCusps: state.pageSettings.showDirectionCusps,
            showPlanetStationary: state.pageSettings.showWheelStationary,
            showPlanetDegree: state.pageSettings.showWheelDegree,
            showAspectText: state.pageSettings.showAspectText === true,
            angleAscDscBold: state.pageSettings.angleAscDscBold,
            angleMcIcBold: state.pageSettings.angleMcIcBold,
            visualPreferences: window.AstroPreferences?.getAccountVisualPreferences?.() || window.accountPreferencesCache?.visual || null,
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

    function scheduleRightPanelRender() {
        if (state.rightPanelRenderFrame) {
            cancelAnimationFrame(state.rightPanelRenderFrame);
        }
        state.rightPanelRenderFrame = requestAnimationFrame(() => {
            state.rightPanelRenderFrame = null;
            renderRightPanel();
        });
    }

    function renderRightPanel() {
        const method = state.selectedRightLayer;
        const layer = state.viewModel?.activePrognosticLayers?.find((item) => item.method === method);
        refs.prognosticPanelTitle.textContent = layerLabel(method);
        refs.prognosticPanelMeta.textContent = buildPrognosticMomentSummary();
        refs.targetDatetimeLabel.textContent = state.selectedDateTime.replace('T', ' ');

        if (!layer) {
            state.prognosticRenderer?.setHouseNumberStyle?.(state.pageSettings.houseNumberStyle);
            state.prognosticRenderer?.render({ planets: [], houses: [], aspects: [], aspect_configurations: [], stelliums: [], balances: null, cosmogram_pattern: null });
            renderForecastNewRulersTab('progRulersContainer', null, 'forecastNewProgRulersMode');
            syncPrognosticHousesVisibility([]);
            return;
        }
        state.prognosticRenderer?.setAspectTypeFilter?.('all');
        state.prognosticRenderer?.setHouseNumberStyle?.(state.pageSettings.houseNumberStyle);
        state.prognosticRenderer?.setDisplayPreferences?.({
            showSpeed: state.pageSettings.showSpeed !== false,
            showStationary: state.pageSettings.showStationary !== false,
            showApplyingSeparating: state.pageSettings.showApplyingSeparating === true,
            showAspectText: state.pageSettings.showAspectText === true,
        });
        state.prognosticRenderer?.render(filterChartDataForSidePanel({
            planets: layer.bodies || [],
            houses: layer.houses || [],
            aspects: layer.aspects || [],
            aspect_configurations: [],
            stelliums: [],
            balances: layer.balances || null,
            cosmogram_pattern: layer.cosmogram_pattern || null,
        }, { scope: 'prognostic' }));
        renderForecastNewRulersTab('progRulersContainer', {
            planets: layer.bodies || [],
            houses: layer.houses || [],
            balances: layer.balances || null,
            cosmogram_pattern: layer.cosmogram_pattern || null,
        }, 'forecastNewProgRulersMode');
        renderInlineMatrixControls();
        applyInlineMatrixRowState();
        syncPrognosticHousesVisibility(layer.houses || []);
        syncHoveredAspectToActiveSurface();
        activateSavedTabs();
    }

    function syncPrognosticHousesVisibility(houses = []) {
        const tableBody = document.getElementById('progHousesTable');
        const table = tableBody?.closest('table');
        const title = table?.previousElementSibling?.classList.contains('forecast-new-houses-title')
            ? table.previousElementSibling
            : null;
        const hasHouses = Array.isArray(houses) && houses.length > 0;
        if (table) table.hidden = !hasHouses;
        if (title) title.hidden = !hasHouses;
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

    function getMatrixRowsForScope(scope = 'prognostic') {
        return normalizeForecastNewMatrixRows(scope === 'natal' ? state.natalMatrixRows : state.matrixRows);
    }

    function setMatrixRowsForScope(scope = 'prognostic', rows = {}) {
        const normalized = normalizeForecastNewMatrixRows(rows);
        if (scope === 'natal') {
            state.natalMatrixRows = normalized;
            return;
        }
        state.matrixRows = normalized;
    }

    function filterViewModelForSettings(viewModel) {
        if (!viewModel) return viewModel;
        return {
            ...viewModel,
            natalLayer: viewModel.natalLayer ? filterLayerForSettings(viewModel.natalLayer, { scope: 'natal' }) : viewModel.natalLayer,
            activePrognosticLayers: (viewModel.activePrognosticLayers || []).map((layer) => {
                return filterLayerForSettings(layer, { scope: 'prognostic' });
            }),
        };
    }

    function filterLayerForSettings(layer, options = {}) {
        const filteredLayer = filterChartDataForRenderer({
            planets: layer.bodies || [],
            houses: layer.houses || [],
            aspects: normalizeForecastAspects(layer.aspects || []),
            aspect_configurations: layer.aspect_configurations || [],
            stelliums: layer.stelliums || [],
            balances: layer.balances || null,
            cosmogram_pattern: layer.cosmogram_pattern || null,
        }, options);
        return {
            ...layer,
            bodies: layer.bodies || [],
            houses: filteredLayer.houses || [],
            aspects: filteredLayer.aspects || [],
            aspect_configurations: filteredLayer.aspect_configurations || [],
            stelliums: filteredLayer.stelliums || [],
            balances: filteredLayer.balances || layer.balances || null,
            cosmogram_pattern: filteredLayer.cosmogram_pattern || layer.cosmogram_pattern || null,
            showCusps: getLayerCuspVisibility(layer.method),
        };
    }

    function getLayerCuspVisibility(method) {
        if (method === 'transit') return state.pageSettings.showTransitCusps !== false;
        if (method === 'progression') return state.pageSettings.showProgressionCusps !== false;
        if (method === 'direction') return state.pageSettings.showDirectionCusps !== false;
        return true;
    }

    function normalizeForecastAspects(aspects = []) {
        return (aspects || []).map((aspect) => {
            const planet1 = aspect?.planet_1
                ?? aspect?.left_planet
                ?? aspect?.transit_planet
                ?? aspect?.progressed_planet
                ?? aspect?.directed_object;
            const planet2 = aspect?.planet_2
                ?? aspect?.right_planet
                ?? aspect?.natal_object;
            return {
                ...aspect,
                planet_1: matrixBodyKey(planet1),
                planet_2: matrixBodyKey(planet2),
                left_planet: matrixBodyKey(aspect?.left_planet ?? planet1),
                right_planet: matrixBodyKey(aspect?.right_planet ?? planet2),
            };
        });
    }

    function matrixRowsForSidePanel(scope = 'prognostic') {
        const rows = getMatrixRowsForScope(scope);
        return Object.fromEntries(Object.entries(rows).map(([body, config]) => [
            body,
            {
                ...config,
                display: true,
            },
        ]));
    }

    function aspectMatrixRowsForRenderer(scope = 'prognostic') {
        if (scope !== 'prognostic') return null;
        return {
            first: getMatrixRowsForScope('prognostic'),
            second: getMatrixRowsForScope('natal'),
        };
    }

    function aspectMatrixRowsForSidePanel(scope = 'prognostic') {
        if (scope !== 'prognostic') return null;
        return {
            first: matrixRowsForSidePanel('prognostic'),
            second: matrixRowsForSidePanel('natal'),
        };
    }

    function filterChartDataForRenderer(chartData = {}, options = {}) {
        const scope = options.scope || 'prognostic';
        let filtered = {
            ...chartData,
            aspects: normalizeForecastAspects(chartData.aspects || []),
        };

        filtered = window.AstroPreferences?.filterChartDataByViewPreferences
            ? window.AstroPreferences.filterChartDataByViewPreferences(filtered, {
                matrixRows: getMatrixRowsForScope(scope),
                aspectMatrixRows: aspectMatrixRowsForRenderer(scope),
                aspectScope: state.pageSettings.aspectScope || 'all',
                enabledAspectTypes: Array.isArray(state.pageSettings.enabledAspectTypes) && state.pageSettings.enabledAspectTypes.length
                    ? state.pageSettings.enabledAspectTypes
                    : DEFAULT_ASPECT_TYPES,
            })
            : filtered;

        if (window.AstroAspectPhase?.enrichChartDataWithAspectPhases) {
            filtered = window.AstroAspectPhase.enrichChartDataWithAspectPhases(filtered);
        }
        if (window.AstroAspectPhase?.filterChartDataByAspectPhase) {
            filtered = window.AstroAspectPhase.filterChartDataByAspectPhase(filtered, getAspectPhaseFilter());
        }
        return filtered;
    }

    function filterChartDataForSidePanel(chartData = {}, options = {}) {
        const scope = options.scope || 'prognostic';
        let filtered = {
            ...chartData,
            aspects: normalizeForecastAspects(chartData.aspects || []),
        };

        filtered = window.AstroPreferences?.filterChartDataByViewPreferences
            ? window.AstroPreferences.filterChartDataByViewPreferences(filtered, {
                matrixRows: matrixRowsForSidePanel(scope),
                aspectMatrixRows: aspectMatrixRowsForSidePanel(scope),
                aspectScope: state.pageSettings.aspectScope || 'all',
                enabledAspectTypes: Array.isArray(state.pageSettings.enabledAspectTypes) && state.pageSettings.enabledAspectTypes.length
                    ? state.pageSettings.enabledAspectTypes
                    : DEFAULT_ASPECT_TYPES,
            })
            : filtered;

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
            return [info.date, info.time, formatHeaderTimezone(info.timezone)].filter(Boolean).join(' · ');
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
        panel.querySelectorAll('[data-tabs-overflow]').forEach((overflow) => {
            const hasActiveOverflowTab = !!overflow.querySelector(`.panel-tab[data-panel-target="${targetId}"]`);
            overflow.classList.toggle('is-active', hasActiveOverflowTab);
            overflow.classList.remove('is-open');
        });
        syncTabsOverflowToggleState();
    }

    function tabToNatalTarget(tab) {
        return {
            Planets: 'natalPlanetsView',
            Houses: 'natalHousesView',
            Aspects: 'natalAspectsView',
            Grid: 'natalGridView',
            Configs: 'natalConfigsView',
            Balances: 'natalBalancesView',
            Rulers: 'natalRulersView',
        }[tab] || 'natalPlanetsView';
    }

    function tabToProgTarget(tab) {
        return {
            Planets: 'progPlanetsView',
            Houses: 'progHousesView',
            Aspects: 'progAspectsView',
            Grid: 'progGridView',
            Configs: 'progConfigsView',
            Balances: 'progBalancesView',
            Rulers: 'progRulersView',
        }[tab] || 'progPlanetsView';
    }

    function closeTabsOverflowMenus() {
        refs.tabsOverflow?.forEach((overflow) => overflow.classList.remove('is-open'));
        syncTabsOverflowToggleState();
    }

    function syncTabsOverflowToggleState() {
        refs.tabsOverflow?.forEach((overflow) => {
            const toggle = overflow.querySelector('[data-tabs-overflow-toggle]');
            if (toggle) toggle.setAttribute('aria-expanded', overflow.classList.contains('is-open') ? 'true' : 'false');
        });
    }

    function hydrateState() {
        const storage = window.ForecastNewStateStorage;
        const key = storage?.buildStorageKey?.(state.natalData);
        if (!storage || !key) return;
        const restored = storage.parsePersistedState(localStorage.getItem(key), state.natalData);
        if (!restored) return;
        setSelectedDateTime(restored.targetDatetime || state.selectedDateTime);
        state.timezone = normalizeTimezoneValue(restored.timezone, restored.location?.name) || state.timezone;
        state.location = restored.location || state.location;
        state.activeLayers = restored.activeLayers || state.activeLayers;
        state.enabledLayers = state.activeLayers;
        state.selectedRightLayer = restored.selectedRightLayer || state.selectedRightLayer;
        state.activeRightMethodTab = state.selectedRightLayer;
        state.stepMode = restored.stepMode || state.stepMode;
        state.customStep = normalizeCustomStep(restored.customStep || state.customStep);
        state.leftTab = restored.leftTab || state.leftTab;
        state.rightTab = restored.rightTab || state.rightTab;
        const hasSplitMatrixState = Number(restored.matrixSchemaVersion) >= 2;
        state.natalMatrixRows = normalizeForecastNewMatrixRows(
            hasSplitMatrixState ? (restored.natalMatrixRows || state.natalMatrixRows) : state.natalMatrixRows
        );
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
            showTransitCusps: restored.pageSettings?.showTransitCusps !== false,
            showProgressionCusps: restored.pageSettings?.showProgressionCusps !== false,
            showDirectionCusps: restored.pageSettings?.showDirectionCusps !== false,
            showApplyingSeparating: restored.pageSettings?.showApplyingSeparating !== false,
            showSpeed: restored.pageSettings?.showSpeed !== false,
            showStationary: restored.pageSettings?.showStationary !== false,
            showAspectText: restored.pageSettings?.showAspectText === true,
            showWheelStationary: restored.pageSettings?.showWheelStationary === true,
            showWheelDegree: restored.pageSettings?.showWheelDegree === true,
            angleAscDscBold: restored.pageSettings?.angleAscDscBold !== false,
            angleMcIcBold: restored.pageSettings?.angleMcIcBold !== false,
        };
    }

    async function hydratePreferences() {
        if (!window.AstroAPI?.getResolvedPreferences || !state.userId) return;
        try {
            const accountPreferencesPromise = window.AstroAPI?.getAccountPreferences
                ? window.AstroAPI.getAccountPreferences()
                : Promise.resolve(null);
            const resolvedPreferencesPromise = window.AstroAPI.getResolvedPreferences({
                chart_kind: 'natal',
                chart_id: state.userId,
                view_type: 'forecast_new',
            });
            const [accountResult, resolvedResult] = await Promise.allSettled([
                accountPreferencesPromise,
                resolvedPreferencesPromise,
            ]);

            if (accountResult.status === 'fulfilled' && accountResult.value) {
                window.accountPreferencesCache = accountResult.value;
                window.AstroPreferences?.setAccountVisualPreferences?.(window.accountPreferencesCache?.visual || {});
            } else if (accountResult.status === 'rejected') {
                console.warn('Forecast New account preferences fallback to defaults:', accountResult.reason);
            }

            if (resolvedResult.status !== 'fulfilled') {
                throw resolvedResult.reason;
            }
            const payload = resolvedResult.value;
            state.resolvedPreferences = payload;
            const resolved = payload?.resolved || {};
            const matrixSettings = resolved?.matrix || {};
            const hasSplitMatrixPreferences = Number(matrixSettings.schema_version) >= 2;
            state.natalMatrixRows = normalizeForecastNewMatrixRows(
                hasSplitMatrixPreferences ? (matrixSettings.natal_rows || state.natalMatrixRows) : state.natalMatrixRows
            );
            state.matrixRows = normalizeForecastNewMatrixRows(
                matrixSettings.prognostic_rows || matrixSettings.rows || state.matrixRows
            );
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
                showAspectText: resolved?.table_options?.show_aspect_text === true,
                angleAscDscBold: resolved?.view_options?.bold_asc_dsc !== false,
                angleMcIcBold: resolved?.view_options?.bold_mc_ic !== false,
                showTransitCusps: resolved?.view_options?.show_transit_cusps !== false,
                showProgressionCusps: resolved?.view_options?.show_progression_cusps !== false,
                showDirectionCusps: resolved?.view_options?.show_direction_cusps !== false,
            };
        } catch (error) {
            console.warn('Forecast New preferences fallback to local defaults:', error);
        }
    }

    function getResolvedForecastNewViewSettings() {
        return {
            matrix: {
                schema_version: 2,
                rows: ensureMatrixRows(state.matrixRows),
                prognostic_rows: ensureMatrixRows(state.matrixRows),
                natal_rows: ensureMatrixRows(state.natalMatrixRows),
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
                show_aspect_text: state.pageSettings.showAspectText === true,
            },
            view_options: {
                orientation: state.pageSettings.orientation === 'asc' ? 'asc' : 'aries',
                bold_asc_dsc: state.pageSettings.angleAscDscBold !== false,
                bold_mc_ic: state.pageSettings.angleMcIcBold !== false,
                show_transit_cusps: state.pageSettings.showTransitCusps !== false,
                show_progression_cusps: state.pageSettings.showProgressionCusps !== false,
                show_direction_cusps: state.pageSettings.showDirectionCusps !== false,
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

    function schedulePersistViewOverrides(delay = 650) {
        clearTimeout(state.viewOverridesPersistTimer);
        state.viewOverridesPersistTimer = setTimeout(async () => {
            state.viewOverridesPersistTimer = null;
            try {
                await persistForecastNewViewOverrides();
            } catch (error) {
                console.warn('Failed to persist Forecast New settings:', error);
            }
        }, delay);
    }

    function applyDeepLinkParams() {
        const params = new URLSearchParams(window.location.search);
        const date = params.get('date');
        const time = params.get('time');
        if (/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
            setSelectedDateTime(`${date}T${normalizeTime(time || splitTargetDatetime(state.selectedDateTime)[1])}`);
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
                targetDatetime: state.selectedDateTime,
                timezone: state.timezone,
                location: state.location,
                activeLayers: state.activeLayers,
                selectedRightLayer: state.selectedRightLayer,
                stepMode: state.stepMode,
                customStep: state.customStep,
                leftTab: state.leftTab,
                rightTab: state.rightTab,
                matrixSchemaVersion: window.ForecastNewStateStorage?.MATRIX_SCHEMA_VERSION || 2,
                natalMatrixRows: state.natalMatrixRows,
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
        setTimeout(() => refs.pageLoader?.remove(), 460);
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

    function setLightweightLoading(isLoading) {
        refs.forecastNewWheelShell?.classList.toggle('forecast-new-loading', isLoading);
        refs.forecastNewProgPanel?.classList.toggle('forecast-new-loading', isLoading);
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

    function normalizeLooseText(value) {
        return String(value || '').trim().toLowerCase();
    }

    function setSelectedDateTime(value) {
        const [date, time] = splitTargetDatetime(value);
        state.selectedDateTime = `${date}T${time}`;
        state.targetDatetime = state.selectedDateTime;
    }

    function normalizeTimezoneValue(value, placeName = '') {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const normalized = window.Timezones?.list?.find((timezone) => timezone.value === raw)?.value;
        if (normalized) return normalized;
        const guessedByValue = window.Timezones?.guess?.(raw);
        if (guessedByValue) return guessedByValue;
        const guessedByPlace = window.Timezones?.guess?.(placeName);
        if (guessedByPlace) return guessedByPlace;
        return '';
    }

    function buildLayerCacheKey(method, date, context = {}) {
        const selectedDateTime = context.selectedDateTime || state.selectedDateTime;
        const timezone = context.timezone || state.timezone;
        const location = context.location || state.location || {};
        if (method === 'transit') {
            return [
                method,
                selectedDateTime,
                timezone,
                location?.name || '',
                location?.latitude ?? '',
                location?.longitude ?? '',
            ].join('|');
        }
        if (method === 'direction') {
            return [method, date, 'solar_arc'].join('|');
        }
        return [method, date].join('|');
    }

    function getTimeStepperSegmentValues(value) {
        const date = parseLocalDateTime(value);
        const fullYear = date.getFullYear();
        const year = String(Math.abs(fullYear)).padStart(4, '0').slice(-4);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const minute = date.getMinutes();
        const second = date.getSeconds();
        return {
            yearThousands: year[0],
            yearHundreds: year[1],
            yearTens: year[2],
            yearOnes: year[3],
            monthTens: month[0],
            monthOnes: month[1],
            dayTens: day[0],
            dayOnes: day[1],
            hour: String(date.getHours()).padStart(2, '0'),
            tenMinute: String(Math.trunc(minute / 10)),
            minute: String(minute % 10),
            tenSecond: String(Math.trunc(second / 10)),
            second: String(second % 10),
        };
    }

    function parseLocalDateTime(value) {
        const [date, time] = splitTargetDatetime(value);
        const next = new Date(`${date}T${time}`);
        if (!Number.isNaN(next.getTime())) return next;
        return new Date();
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

    function getLocalNowIso(timezone) {
        const now = new Date();
        const resolvedTimezone = normalizeTimezoneValue(timezone) || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: resolvedTimezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
        const parts = formatter.formatToParts(now);
        const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
        if (byType.year && byType.month && byType.day && byType.hour && byType.minute && byType.second) {
            return `${byType.year}-${byType.month}-${byType.day}T${byType.hour}:${byType.minute}:${byType.second}`;
        }
        const date = todayIsoDate();
        const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
            .map((part) => String(part).padStart(2, '0'))
            .join(':');
        return `${date}T${time}`;
    }

    function addStep(value, mode, direction) {
        const dir = direction >= 0 ? 1 : -1;
        if (mode === 'week') return addDateTimeUnit(value, 'day', dir * 7);
        return addDateTimeUnit(value, mode, dir);
    }

    function normalizeCustomStep(value) {
        const source = value && typeof value === 'object' ? value : {};
        const amount = Math.trunc(Number(source.amount));
        const unit = CUSTOM_STEP_UNITS.some((item) => item.value === source.unit) ? source.unit : 'day';
        return {
            amount: Number.isFinite(amount) ? Math.min(9999, Math.max(1, amount)) : 1,
            unit,
        };
    }

    function formatCustomStepLabel(value) {
        const step = normalizeCustomStep(value);
        const unit = CUSTOM_STEP_UNITS.find((item) => item.value === step.unit);
        return `${step.amount} ${unit?.label || 'дней'}`;
    }

    function addDateTimeUnit(value, unit, amount) {
        const next = parseLocalDateTime(value);
        if (unit === 'second') next.setSeconds(next.getSeconds() + amount);
        else if (unit === 'minute') next.setMinutes(next.getMinutes() + amount);
        else if (unit === 'hour') next.setHours(next.getHours() + amount);
        else if (unit === 'day') next.setDate(next.getDate() + amount);
        else if (unit === 'month') next.setMonth(next.getMonth() + amount);
        else if (unit === 'year') next.setFullYear(next.getFullYear() + amount);
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

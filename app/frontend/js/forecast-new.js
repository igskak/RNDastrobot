(function() {
    'use strict';

    const API_BASE = window.location.hostname === 'localhost'
        ? 'http://localhost:8000/api/v1'
        : '/api/v1';
    const LAYER_ORDER = ['transit', 'progression', 'direction', 'solar_return', 'synastry_partner'];
    const DEFAULT_DIRECTION_TYPE = 'zodiacal';
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
    const RESULT_VIEWS = ['wheel', 'layers', 'aspects'];
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
        directionType: DEFAULT_DIRECTION_TYPE,
        // D6: вид колеса — 'multi' (натал + кольца, как сейчас) | 'single' (только
        // натал в виде одиночной карты: внешний слот + маркеры углов).
        wheelView: 'multi',
        resultView: 'wheel',
        // Параметры новых слоёв (Path B шаг 2)
        solarYear: new Date().getFullYear(),
        solarLocation: null,    // {name, latitude, longitude, timezone} | null = birth place
        synastryPartnerId: '',
        synastryMode: 'db',     // 'db' = сохранённый клиент | 'manual' = ручной ввод партнёра
        synastryManual: null,   // {name, date, time, timezone, place, latitude, longitude} | null
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
            aspectScope: 'major',
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
        singleRightTab: 'Grid',
        // Configurable side panels (see forecast-new-panel-layout.js). panelLayout
        // is the normalized {schema_version, panels:{multi,single:{left,right}}}.
        // activeTab maps multiLeft/multiRight/singleLeft/singleRight -> tab id.
        panelLayout: null,
        activeTab: {},
        panelPresets: [],
        panelLayoutDirty: false,
        panelEditMode: false,
        layoutPersistSeq: 0,
        layoutUndo: null,
        panelSaveState: 'saved',
        panelDialog: null,
        panelEditReturnFocus: null,
    };

    window.getAssistantChartContext = () => ({
        userId: state.userId || localStorage.getItem('currentUserId') || null,
        timezone: state.natalTimezone || state.timezone || 'UTC',
        anchorDate: state.selectedDateTime?.split('T')[0] || null,
    });

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
        return navState.sourceUrl || '/';
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
        if (refs.openClientProfileBtn) {
            refs.openClientProfileBtn.disabled = !state.userId;
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
        window.addEventListener('pagehide', flushPendingPersistence);
        window.addEventListener('beforeunload', flushPendingPersistence);
        await waitForI18nReady();
        cacheElements();
        const me = await window.AstroAPI?.requireAuth?.({ redirectTo: '/login.html' });
        if (!me) return;

        const natalData = window.AstroAPI?.getChartFromSession?.();
        if (!natalData) {
            showColdStartOverlay();
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
        // Снимок исходного натала (сохранённого клиента) — для isNatalEdited():
        // если астролог сдвинул момент/место натала, форкаст-слои должны считаться
        // против пересчитанного натала (inline), а не против stale user_id (фикс C2).
        state.natalInitialSource = {
            timezone: state.natalTimezone,
            locationName: state.natalLocation.name || '',
            latitude: state.natalLocation.latitude,
            longitude: state.natalLocation.longitude,
        };

        hydrateState();
        applyDeepLinkParams();
        syncLayerControlInputs();
        void populateSynastryPartnerOptions();
        populateTimezoneOptions();
        populateNatalTimezoneOptions();
        initRenderers();
        configureForecastNavigation();
        bindEvents();
        bindSaveChartModal();
        bindLocationAutocomplete();
        bindNatalLocationAutocomplete();
        bindSolarLocationAutocomplete();
        bindSynastryManualControls();
        initLayerPopovers();
        initAspectInteractions();
        syncControlsFromState();
        initPanelLayout();
        bindPanelConfigurator();
        syncWorkspaceModePanels();
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
            'forecastNewBackBtn', 'forecastNewTitle', 'forecastNewSubtitle', 'openNatalTablesBtn',
            'openClientProfileBtn', 'saveSourceChartBtn', 'saveNatalChartBtn', 'forecastNewActionsToggle', 'forecastNewActionsMenu',
            'forecastNewDirectionTypeSelect',
            'forecastNewNatalPanel', 'forecastNewProgPanel',
            'natalPanelMeta', 'prognosticPanelTitle', 'prognosticPanelMeta',
            'prognosticMomentToggle', 'forecastSavedChartsBtn', 'natalSavedChartsBtn', 'forecastNewMomentCard',
            'forecastNewWheel', 'forecastNewWheelShell', 'forecastNewResultViews', 'forecastNewResultPane', 'targetDateInput', 'targetTimeInput',
            'forecastNewTimeStepper',
            'stepModeSelect', 'stepBackward', 'stepForward', 'timezoneInput', 'locationInput',
            'latitudeInput', 'longitudeInput', 'locationSuggestions', 'targetDatetimeLabel', 'rightLayerTabs',
            'forecastNewNatalTimeStepper', 'natalMomentToggle', 'forecastNewNatalCard',
            'natalDatetimeLabel', 'natalDateInput', 'natalTimeInput',
            'natalTimezoneInput', 'natalLocationInput', 'natalLocationSuggestions',
            'natalLatitudeInput', 'natalLongitudeInput',
            'forecastNewMatrixEditor', 'forecastNewSettingsMatrixEditor',
            'forecastNewViewSingle', 'forecastNewViewMulti',
            'forecastNewSolarYearInput', 'forecastNewSolarLocationInput', 'forecastNewSolarLocationSuggestions',
            'forecastNewSolarLat', 'forecastNewSolarLon', 'forecastNewSynastryPartnerSelect',
            'forecastNewSynastryManualName', 'forecastNewSynastryManualDate', 'forecastNewSynastryManualTime',
            'forecastNewSynastryManualTimezone', 'forecastNewSynastryManualLocation', 'forecastNewSynastryManualSuggestions',
            'forecastNewSynastryManualLat', 'forecastNewSynastryManualLon', 'forecastNewSynastryManualApply', 'forecastNewSynastryManualError',
            'forecastNewZoomIn', 'forecastNewZoomOut',
            'forecastNewSettingsToggle', 'forecastNewSettingsPanel',
            'orientationSelect', 'houseSystemSelect', 'iconScaleRange', 'iconScaleValue',
            'aspectScopeSelect', 'aspectTypeToggles',
            'aspectPhaseApplyingToggle', 'aspectPhaseSeparatingToggle',
            'houseNumberStyleSelect', 'houseLabelsOutsideToggle',
            'showTransitCuspsToggle', 'showProgressionCuspsToggle', 'showDirectionCuspsToggle',
            'showWheelStationaryToggle', 'showWheelDegreeToggle',
            'angleAscDscBoldToggle', 'angleMcIcBoldToggle',
            'showSpeedToggle', 'showStationaryToggle',
            'forecastNewResetLocalBtn',
            // save-chart modal elements removed — handled by window.SaveChartModal
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
            stelliumsContainerId: 'natalStelliumsContainer',
            balancesContainerId: 'natalBalancesContainer',
            aspectSortHeadersSelector: '#natalAspectsView th.sortable[data-sort]',
            showSpeedColumn: true,
            showHouseColumn: false,
        });
        state.prognosticRenderer = new ChartDataRenderer({
            planetsTableId: 'progPlanetsTable',
            housesTableId: 'progHousesTable',
            aspectsTableId: 'progAspectsTable',
            aspectGridContainerId: 'progAspectGridContainer',
            configsContainerId: 'progConfigurationsContainer',
            stelliumsContainerId: 'progStelliumsContainer',
            balancesContainerId: 'progBalancesContainer',
            aspectSortHeadersSelector: '#progAspectsView th.sortable[data-sort]',
            showSpeedColumn: true,
            showHouseColumn: false,
        });
    }

    function bindEvents() {
        initForecastNewActionsMenu();

        // Solar year stepper — delegated via the regular stepper container
        document.addEventListener('click', (event) => {
            const btn = event.target.closest('[data-solar-year-step]');
            if (!btn || !refs.forecastNewTimeStepper?.contains(btn)) return;
            const delta = Number(btn.dataset.solarYearStep);
            if (!delta) return;
            const next = clamp(state.solarYear + delta, 1900, 2100);
            if (next === state.solarYear) return;
            state.solarYear = next;
            // Sync header year input
            if (refs.forecastNewSolarYearInput) refs.forecastNewSolarYearInput.value = String(next);
            updateSolarYearStepperValue();
            // Invalidate cache and refetch
            delete state.layers?.solar_return;
            if (state.activeLayers.includes('solar_return')) {
                void loadActiveLayers({ lightweight: false });
            }
            // Update subtitle
            if (refs.prognosticPanelMeta) refs.prognosticPanelMeta.textContent = buildPrognosticMomentSummary();
            schedulePersist();
        });

        // Keyboard on solar year segment
        document.addEventListener('keydown', (event) => {
            const seg = event.target.closest('[data-solar-year-segment]');
            if (!seg) return;
            let delta = 0;
            if (event.key === 'ArrowUp') delta = 1;
            else if (event.key === 'ArrowDown') delta = -1;
            else return;
            event.preventDefault();
            const btn = seg.querySelector(`[data-solar-year-step="${delta}"]`);
            btn?.click();
        });

        refs.openNatalTablesBtn?.addEventListener('click', () => {
            window.AstroAPI?.saveChartToSession?.(state.natalData);
            window.AstroAPI?.saveFormData?.(window.AstroAPI.chartToFormData(state.natalData));
            navigateFromForecast('/natal-full.html');
        });

        refs.openClientProfileBtn?.addEventListener('click', () => {
            if (!state.userId) return;
            window.location.href = `/client/${encodeURIComponent(state.userId)}`;
        });
        refs.forecastSavedChartsBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            window.AstroChartPicker?.open?.({
                title: t('page.chartPicker.momentTitle', null, 'Load saved chart'),
                subtitle: t('page.chartPicker.momentSubtitle', null, 'Its date, time and place apply to the active layer.'),
                onSelect: applySavedChartMoment,
            });
        });
        refs.natalSavedChartsBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            window.AstroChartPicker?.open?.({
                title: t('page.chartPicker.natalMomentTitle', null, 'Load saved chart'),
                subtitle: t('page.chartPicker.natalMomentSubtitle', null, 'It becomes the natal chart of this workspace.'),
                onSelect: applySavedChartToNatal,
            });
        });
        refs.saveSourceChartBtn?.addEventListener('click', saveCurrentSourceAsChart);
        refs.saveNatalChartBtn?.addEventListener('click', saveCurrentSourceAsChart);

        refs.layerToggles.forEach((input) => {
            input.addEventListener('change', async () => {
                const layer = input.dataset.layerToggle;
                if (input.checked) await activateLayer(layer, { openConfig: true });
                else await deactivateLayer(layer);
            });
        });

        refs.forecastNewDirectionTypeSelect?.addEventListener('change', async () => {
            state.directionType = normalizeDirectionType(refs.forecastNewDirectionTypeSelect.value);
            refs.forecastNewDirectionTypeSelect.value = state.directionType;
            schedulePersist();
            if (state.activeLayers.includes('direction')) {
                await loadActiveLayers({ lightweight: true });
            }
        });

        refs.forecastNewSolarYearInput?.addEventListener('change', async () => {
            const year = Number(refs.forecastNewSolarYearInput.value);
            state.solarYear = Number.isFinite(year)
                ? Math.min(2100, Math.max(1900, Math.trunc(year)))
                : new Date().getFullYear();
            refs.forecastNewSolarYearInput.value = String(state.solarYear);
            schedulePersist();
            if (state.activeLayers.includes('solar_return')) {
                await loadActiveLayers({ lightweight: true });
            }
        });

        refs.forecastNewSynastryPartnerSelect?.addEventListener('change', async () => {
            state.synastryPartnerId = refs.forecastNewSynastryPartnerSelect.value || '';
            schedulePersist();
            if (state.synastryPartnerId) {
                closeLayerPopover('synastry_partner');
                await ensureSynastryLayerActive({ lightweight: true });
            }
        });

        document.getElementById('forecastNewSynastryPickerBtn')?.addEventListener('click', () => {
            window.AstroChartPicker?.open?.({
                excludeId: state.userId,
                onSelect(chart) {
                    const select = refs.forecastNewSynastryPartnerSelect;
                    if (!select || !chart?.user_id) return;
                    const id = String(chart.user_id);
                    if (!Array.from(select.options).some((opt) => opt.value === id)) {
                        const opt = document.createElement('option');
                        opt.value = id;
                        opt.textContent = chart.display_title || chart.title
                            || [chart.first_name, chart.last_name].filter(Boolean).join(' ') || id.slice(0, 8);
                        select.appendChild(opt);
                    }
                    select.value = id;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                },
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
                const tab = event.target.closest('.panel-tab[data-tab-id]');
                if (!tab) return;
                const side = panel.id === 'forecastNewProgPanel' ? 'right' : 'left';
                activatePanelTab(side, tab.dataset.tabId);
                syncHoveredAspectToActiveSurface();
                schedulePersist();
            });
        });

        // Overflow toggles are rebuilt on every renderPanels(); use delegation.
        document.querySelectorAll('.forecast-new-side-panel').forEach((panel) => {
            panel.addEventListener('click', (event) => {
                const toggle = event.target.closest('[data-tabs-overflow-toggle]');
                if (!toggle) return;
                event.stopPropagation();
                const overflow = toggle.closest('[data-tabs-overflow]');
                if (!overflow) return;
                const shouldOpen = !overflow.classList.contains('is-open');
                closeTabsOverflowMenus();
                overflow.classList.toggle('is-open', shouldOpen);
                syncTabsOverflowToggleState();
            });
        });
        // Close overflow menus when clicking outside.
        document.addEventListener('click', () => closeTabsOverflowMenus());

        refs.rightLayerTabs?.addEventListener('click', (event) => {
            const addToggle = event.target.closest('[data-add-layer-toggle]');
            if (addToggle) {
                event.stopPropagation();
                toggleAddLayerMenu();
                return;
            }

            const addButton = event.target.closest('[data-add-layer-method]');
            if (addButton) {
                event.stopPropagation();
                closeAddLayerMenu();
                void activateLayer(addButton.dataset.addLayerMethod, { openConfig: true });
                return;
            }

            const removeButton = event.target.closest('[data-remove-layer]');
            if (removeButton) {
                event.stopPropagation();
                void deactivateLayer(removeButton.dataset.removeLayer);
                return;
            }

            const button = event.target.closest('[data-right-layer]');
            if (!button) return;
            state.selectedRightLayer = button.dataset.rightLayer;
            state.activeRightMethodTab = state.selectedRightLayer;
            syncControlsFromState();
            renderRightPanel();
            schedulePersist();
        });

        refs.forecastNewResultViews?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-result-view]');
            if (!button) return;
            setResultView(button.dataset.resultView);
        });
        refs.forecastNewResultPane?.addEventListener('click', (event) => {
            const row = event.target.closest('[data-result-layer]');
            if (!row) return;
            const method = row.dataset.resultLayer;
            if (LAYER_ORDER.includes(method)) {
                state.selectedRightLayer = method;
                state.activeRightMethodTab = method;
                renderRightLayerTabs();
                renderRightPanel();
            }
            const aspectKey = row.dataset.resultAspectKey;
            if (aspectKey) togglePinnedAspectKey(aspectKey);
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
        if (refs.forecastNewSettingsPanel && window.ChartConfigPresets) {
            window.ChartConfigPresets.attach({
                container: refs.forecastNewSettingsPanel,
                viewType: 'prognostic',
                getSettings: () => getResolvedForecastNewViewSettings(),
                applySettings: (resolvedView) => applyResolvedForecastNewView(resolvedView || {}),
            });
        }
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

        refs.forecastNewResetLocalBtn?.addEventListener('click', () => {
            const confirmMsg = t('page.forecastNew.settings.resetConfirm')
                || 'Сбросить настройки карты к стандартным?';
            if (!window.confirm(confirmMsg)) return;
            const storage = window.ForecastNewStateStorage;
            const key = storage?.buildStorageKey?.(state.natalData);
            if (key) {
                try { localStorage.removeItem(key); } catch (_) { /* ignore */ }
            }
            refs.forecastNewSettingsPanel?.classList.add('hidden');
            window.location.reload();
        });

        refs.forecastNewViewSingle?.addEventListener('click', () => setWheelView('single'));
        refs.forecastNewViewMulti?.addEventListener('click', () => setWheelView('multi'));
        syncWheelViewButtons();
        refs.forecastNewZoomIn?.addEventListener('click', () => setViewport({ zoom: state.viewport.zoom * 1.18 }));
        refs.forecastNewZoomOut?.addEventListener('click', () => setViewport({ zoom: state.viewport.zoom / 1.18 }));
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
            syncResultViewButtons();
            renderResultView();
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

    function initForecastNewActionsMenu() {
        const toggle = refs.forecastNewActionsToggle;
        const menu = refs.forecastNewActionsMenu;
        if (!toggle || !menu) return;

        const setOpen = (isOpen) => {
            menu.classList.toggle('hidden', !isOpen);
            toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        };

        toggle.addEventListener('click', (event) => {
            event.stopPropagation();
            setOpen(menu.classList.contains('hidden'));
        });
        menu.addEventListener('click', () => setOpen(false));
        menu.addEventListener('click', (event) => event.stopPropagation());
        document.addEventListener('click', () => setOpen(false));
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') setOpen(false);
        });
    }

    // ── Поповеры параметров слоёв (Дирекции / Соляр / Синастрия) ──────────────
    function getLayerPopover(layer) {
        return document.querySelector(`[data-layer-popover="${layer}"]`);
    }

    function closeAllLayerPopovers(except) {
        document.querySelectorAll('[data-layer-popover]').forEach((pop) => {
            if (pop !== except) pop.classList.add('hidden');
        });
    }

    function openLayerPopover(layer) {
        const pop = getLayerPopover(layer);
        if (!pop) return;
        closeAllLayerPopovers(pop);
        pop.classList.remove('hidden');
        // Фокус на первый осмысленный контрол поповера
        pop.querySelector('select, input:not([type=hidden]), button')?.focus({ preventScroll: true });
    }

    function closeLayerPopover(layer) {
        getLayerPopover(layer)?.classList.add('hidden');
    }

    function syncLayerTogglesFromState() {
        refs.layerToggles?.forEach((input) => {
            input.checked = state.activeLayers.includes(input.dataset.layerToggle);
        });
    }

    function normalizeActiveLayers() {
        state.activeLayers = LAYER_ORDER.filter((method) => state.activeLayers.includes(method));
        state.enabledLayers = state.activeLayers;
        if (!state.activeLayers.includes(state.selectedRightLayer)) {
            state.selectedRightLayer = state.activeLayers[0] || '';
        }
        state.activeRightMethodTab = state.selectedRightLayer;
        syncLayerTogglesFromState();
    }

    async function activateLayer(method, { openConfig = false } = {}) {
        if (!LAYER_ORDER.includes(method)) return;
        const wasInactive = !state.activeLayers.includes(method);
        if (method === 'transit' && wasInactive) {
            setSelectedDateTime(getLocalNowIso(state.timezone));
            state.lastStepperAction = null;
            syncControlsFromState();
        }
        if (method === 'solar_return' && wasInactive) {
            initializeSolarDefaultsFromNatal();
        }
        if (wasInactive) {
            state.activeLayers = LAYER_ORDER.filter((item) => item === method || state.activeLayers.includes(item));
        }
        state.selectedRightLayer = method;
        normalizeActiveLayers();
        renderRightLayerTabs();
        scheduleRightPanelRender();
        if (openConfig) openLayerPopover(method);
        schedulePersist();
        await loadActiveLayers();
    }

    function initializeSolarDefaultsFromNatal() {
        const [currentYear] = splitTargetDatetime(getLocalNowIso(state.timezone || state.natalTimezone));
        const year = Number(currentYear?.slice(0, 4));
        state.solarYear = Number.isFinite(year) ? year : new Date().getFullYear();

        const source = state.natalLocation || {};
        state.solarLocation = {
            name: source.name || state.natalData?.birth_data?.place || '',
            latitude: numberOrNull(source.latitude),
            longitude: numberOrNull(source.longitude),
            timezone: state.natalTimezone || state.timezone || null,
            sourceId: source.sourceId || null,
        };

        if (refs.forecastNewSolarYearInput) refs.forecastNewSolarYearInput.value = String(state.solarYear);
        if (refs.forecastNewSolarLocationInput) refs.forecastNewSolarLocationInput.value = state.solarLocation.name || '';
        if (refs.forecastNewSolarLat) refs.forecastNewSolarLat.value = state.solarLocation.latitude !== null ? String(state.solarLocation.latitude) : '';
        if (refs.forecastNewSolarLon) refs.forecastNewSolarLon.value = state.solarLocation.longitude !== null ? String(state.solarLocation.longitude) : '';
        delete state.layers?.solar_return;
    }

    async function deactivateLayer(method) {
        if (!LAYER_ORDER.includes(method)) return;
        closeLayerPopover(method);
        state.activeLayers = state.activeLayers.filter((item) => item !== method);
        normalizeActiveLayers();
        renderRightLayerTabs();
        scheduleRightPanelRender();
        schedulePersist();
        await loadActiveLayers();
    }

    function closeAddLayerMenu() {
        refs.rightLayerTabs?.querySelector('[data-add-layer-menu]')?.classList.add('hidden');
        refs.rightLayerTabs?.querySelector('[data-add-layer-toggle]')?.setAttribute('aria-expanded', 'false');
    }

    function toggleAddLayerMenu() {
        const menu = refs.rightLayerTabs?.querySelector('[data-add-layer-menu]');
        const toggle = refs.rightLayerTabs?.querySelector('[data-add-layer-toggle]');
        if (!menu || !toggle) return;
        const willOpen = menu.classList.contains('hidden');
        menu.classList.toggle('hidden', !willOpen);
        toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (willOpen) menu.querySelector('[data-add-layer-method]:not(:disabled)')?.focus({ preventScroll: true });
    }

    function initLayerPopovers() {
        // Закрытие по клику вне поповера/чипа и по Escape.
        document.addEventListener('click', (event) => {
            if (event.target.closest('.forecast-new-layer-pop')) return;
            if (event.target.closest('.forecast-new-add-layer')) return;
            closeAllLayerPopovers(null);
            closeAddLayerMenu();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeAllLayerPopovers(null);
                closeAddLayerMenu();
            }
        });

        // Переключатель источника партнёра синастрии: «Из базы» / «Вручную».
        document.querySelectorAll('[data-synastry-mode]').forEach((btn) => {
            btn.addEventListener('click', () => {
                setSynastryMode(btn.dataset.synastryMode);
            });
        });
    }

    function setSynastryMode(mode) {
        const next = mode === 'manual' ? 'manual' : 'db';
        state.synastryMode = next;
        document.querySelectorAll('[data-synastry-mode]').forEach((btn) => {
            const isActive = btn.dataset.synastryMode === next;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
        document.querySelectorAll('[data-synastry-pane]').forEach((pane) => {
            pane.classList.toggle('hidden', pane.dataset.synastryPane !== next);
        });
        schedulePersist();
    }

    function bindSynastryManualControls() {
        // Часовые пояса в ручной форме — тем же источником, что и остальные селекты.
        if (refs.forecastNewSynastryManualTimezone) {
            window.Timezones?.populate?.(refs.forecastNewSynastryManualTimezone);
        }

        if (window.PlaceAutocomplete && refs.forecastNewSynastryManualLocation && refs.forecastNewSynastryManualSuggestions) {
            window.PlaceAutocomplete.attach({
                input: refs.forecastNewSynastryManualLocation,
                suggestions: refs.forecastNewSynastryManualSuggestions,
                minChars: 2,
                debounceMs: 350,
                limit: 5,
                getLabel: (item) => item.shortName || item.displayName,
                onInput: () => {
                    if (refs.forecastNewSynastryManualLat) refs.forecastNewSynastryManualLat.value = '';
                    if (refs.forecastNewSynastryManualLon) refs.forecastNewSynastryManualLon.value = '';
                },
                onSelect: async (item) => {
                    refs.forecastNewSynastryManualLocation.value = item.shortName || item.displayName;
                    const latitude = item.lat ?? item.latitude ?? null;
                    const longitude = item.lon ?? item.longitude ?? null;
                    if (refs.forecastNewSynastryManualLat) refs.forecastNewSynastryManualLat.value = latitude !== null ? String(latitude) : '';
                    if (refs.forecastNewSynastryManualLon) refs.forecastNewSynastryManualLon.value = longitude !== null ? String(longitude) : '';
                    if (refs.forecastNewSynastryManualTimezone && !refs.forecastNewSynastryManualTimezone.value) {
                        let tz = null;
                        if (item.sourceId && window.AstroAPI?.resolvePlaceTimezone) {
                            try { tz = await window.AstroAPI.resolvePlaceTimezone(item.sourceId); } catch (_) { /* ignore */ }
                        }
                        tz = tz || window.Timezones?.guess?.(item.displayName || item.shortName) || null;
                        if (tz) refs.forecastNewSynastryManualTimezone.value = tz;
                    }
                },
            });
        }

        refs.forecastNewSynastryManualApply?.addEventListener('click', applyManualSynastryPartner);
    }

    function showSynastryManualError(message) {
        const el = refs.forecastNewSynastryManualError;
        if (!el) return;
        if (message) {
            el.textContent = message;
            el.classList.remove('hidden');
        } else {
            el.textContent = '';
            el.classList.add('hidden');
        }
    }

    async function applyManualSynastryPartner() {
        const name = (refs.forecastNewSynastryManualName?.value || '').trim();
        const date = refs.forecastNewSynastryManualDate?.value || '';
        const time = refs.forecastNewSynastryManualTime?.value || '';
        const timezone = refs.forecastNewSynastryManualTimezone?.value || '';
        const place = (refs.forecastNewSynastryManualLocation?.value || '').trim();
        const latRaw = refs.forecastNewSynastryManualLat?.value || '';
        const lonRaw = refs.forecastNewSynastryManualLon?.value || '';
        const hasCoords = latRaw !== '' && lonRaw !== '';

        if (!date || !time) {
            showSynastryManualError('Укажите дату и время рождения партнёра.');
            return;
        }
        if (!timezone) {
            showSynastryManualError('Выберите часовой пояс партнёра.');
            return;
        }
        if (!place && !hasCoords) {
            showSynastryManualError('Укажите место рождения партнёра.');
            return;
        }
        showSynastryManualError('');

        state.synastryManual = {
            name,
            date,
            time: time.length === 5 ? `${time}:00` : time,
            timezone,
            place: place || null,
            latitude: hasCoords ? Number(latRaw) : null,
            longitude: hasCoords ? Number(lonRaw) : null,
        };
        state.synastryMode = 'manual';
        // Сброс кэша слоя синастрии — данные партнёра поменялись.
        delete state.layers?.synastry_partner;
        schedulePersist();
        closeLayerPopover('synastry_partner');
        await ensureSynastryLayerActive({ lightweight: false });
    }

    function hasUsableSynastryPartner() {
        if (state.synastryMode === 'manual') {
            const m = state.synastryManual;
            return !!(m && m.date && m.time && m.timezone && (m.place || (m.latitude !== null && m.longitude !== null)));
        }
        return !!state.synastryPartnerId;
    }

    function isSynastryMomentActive() {
        return state.selectedRightLayer === 'synastry_partner';
    }

    function getDisplayedMomentDateTime() {
        if (isSynastryMomentActive()) {
            const bd = state.viewModel?.activePrognosticLayers
                ?.find((layer) => layer.method === 'synastry_partner')
                ?.raw?.partner_chart?.birth_data;
            const date = state.synastryMode === 'manual'
                ? state.synastryManual?.date
                : (bd?.date || state.synastryManual?.date);
            const time = state.synastryMode === 'manual'
                ? state.synastryManual?.time
                : (bd?.time || state.synastryManual?.time);
            if (date) return `${date}T${normalizeTime(time || '12:00:00')}`;
        }
        return state.selectedDateTime;
    }

    function buildManualSynastryFromMoment(moment, source = {}) {
        return {
            name: source.display_title || source.title || source.person_display_name
                || [source.first_name, source.last_name].filter(Boolean).join(' ')
                || state.synastryManual?.name
                || '',
            date: moment.date,
            time: normalizeTime(moment.time || '12:00:00'),
            timezone: moment.timezone || state.synastryManual?.timezone || state.timezone || 'UTC',
            place: moment.locationName || state.synastryManual?.place || null,
            latitude: moment.latitude,
            longitude: moment.longitude,
        };
    }

    function ensureManualSynastryPartnerForEdit() {
        if (state.synastryMode === 'manual' && state.synastryManual) return state.synastryManual;
        const layer = state.viewModel?.activePrognosticLayers?.find((item) => item.method === 'synastry_partner');
        const bd = layer?.raw?.partner_chart?.birth_data || {};
        const select = refs.forecastNewSynastryPartnerSelect;
        const name = select && select.selectedIndex > 0
            ? (select.options[select.selectedIndex]?.text || '')
            : '';
        state.synastryMode = 'manual';
        state.synastryManual = buildManualSynastryFromMoment({
            date: bd.date || splitTargetDatetime(state.selectedDateTime)[0],
            time: bd.time || splitTargetDatetime(state.selectedDateTime)[1],
            timezone: bd.timezone || state.synastryManual?.timezone || state.timezone || 'UTC',
            locationName: bd.place || state.synastryManual?.place || '',
            latitude: numberOrNull(bd.latitude),
            longitude: numberOrNull(bd.longitude),
        }, { display_title: name });
        state.synastryPartnerId = '';
        setSynastryMode('manual');
        syncSynastryManualControlsFromState();
        return state.synastryManual;
    }

    function applyDisplayedMomentDateTime(value) {
        if (!isSynastryMomentActive()) {
            setSelectedDateTime(value);
            return;
        }
        const [date, time] = splitTargetDatetime(value);
        const manual = ensureManualSynastryPartnerForEdit();
        state.synastryManual = {
            ...manual,
            date,
            time,
        };
        delete state.layers?.synastry_partner;
        syncSynastryManualControlsFromState();
    }

    async function loadDisplayedMomentLayers(options = {}) {
        if (isSynastryMomentActive()) {
            await ensureSynastryLayerActive(options);
            return;
        }
        await loadActiveLayers(options);
    }

    function readChartMoment(chart = {}) {
        const date = chart.date || chart.birth_date || chart.birthData?.date || '';
        const time = chart.time || chart.birth_time || chart.birthData?.time || '';
        const lat = Number(chart.latitude ?? chart.lat ?? chart.birthData?.latitude);
        const lon = Number(chart.longitude ?? chart.lon ?? chart.birthData?.longitude);
        return {
            date,
            time,
            timezone: chart.timezone || chart.birthData?.timezone || '',
            locationName: chart.location_name || chart.birth_place || chart.place || chart.birthData?.place || '',
            latitude: Number.isFinite(lat) ? lat : null,
            longitude: Number.isFinite(lon) ? lon : null,
        };
    }

    function syncSynastryManualControlsFromState() {
        const m = state.synastryManual;
        if (!m) return;
        if (refs.forecastNewSynastryManualName) refs.forecastNewSynastryManualName.value = m.name || '';
        if (refs.forecastNewSynastryManualDate) refs.forecastNewSynastryManualDate.value = m.date || '';
        if (refs.forecastNewSynastryManualTime) refs.forecastNewSynastryManualTime.value = (m.time || '').slice(0, 8);
        if (refs.forecastNewSynastryManualTimezone && m.timezone) refs.forecastNewSynastryManualTimezone.value = m.timezone;
        if (refs.forecastNewSynastryManualLocation) refs.forecastNewSynastryManualLocation.value = m.place || '';
        if (refs.forecastNewSynastryManualLat) refs.forecastNewSynastryManualLat.value = m.latitude !== null && m.latitude !== undefined ? String(m.latitude) : '';
        if (refs.forecastNewSynastryManualLon) refs.forecastNewSynastryManualLon.value = m.longitude !== null && m.longitude !== undefined ? String(m.longitude) : '';
    }

    async function ensureSynastryLayerActive(options = {}) {
        if (!hasUsableSynastryPartner()) return;
        if (!state.activeLayers.includes('synastry_partner')) {
            await activateLayer('synastry_partner', { openConfig: false });
            return;
        }
        state.selectedRightLayer = 'synastry_partner';
        normalizeActiveLayers();
        renderRightLayerTabs();
        scheduleRightPanelRender();
        await loadActiveLayers(options);
    }

    function buildSynastryPartnerSource() {
        if (state.synastryMode === 'manual' && state.synastryManual) {
            const m = state.synastryManual;
            const natal = {
                date: m.date,
                time: m.time,
                timezone: m.timezone,
                house_system: state.pageSettings?.houseSystem || 'P',
            };
            if (m.name) natal.first_name = m.name;
            if (m.latitude !== null && m.longitude !== null) {
                natal.latitude = m.latitude;
                natal.longitude = m.longitude;
                if (m.place) natal.place = m.place;
            } else if (m.place) {
                natal.place = m.place;
            }
            return { natal };
        }
        return { user_id: state.synastryPartnerId };
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
        const [date, time] = splitTargetDatetime(getDisplayedMomentDateTime());
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
        if (refs.forecastNewDirectionTypeSelect) refs.forecastNewDirectionTypeSelect.value = normalizeDirectionType(state.directionType);
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
        const name = [birth.first_name, birth.last_name].filter(Boolean).join(' ').trim();
        refs.forecastNewTitle.textContent = name;
        refs.forecastNewSubtitle.textContent = '';
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
        if (refs.targetDatetimeLabel) refs.targetDatetimeLabel.textContent = getDisplayedMomentDateTime().replace('T', ' ');
        if (refs.prognosticPanelMeta) refs.prognosticPanelMeta.textContent = buildPrognosticMomentSummary();
    }

    function buildPrognosticMomentSummary() {
        const method = state.selectedRightLayer;

        if (method === 'solar_return') {
            // Always use state.solarYear (user's selection), not the stale API response year
            const year = state.solarYear;
            const layer = state.viewModel?.activePrognosticLayers?.find((l) => l.method === 'solar_return');
            const locName = layer?.raw?.solar_info?.location?.name
                || state.solarLocation?.name
                || state.location?.name
                || '';
            return [String(year), locName].filter(Boolean).join(' · ');
        }

        if (method === 'synastry_partner') {
            // Show partner name + birth date + place
            const select = refs.forecastNewSynastryPartnerSelect;
            const partnerName = state.synastryMode === 'manual'
                ? (state.synastryManual?.name || 'Партнёр (вручную)')
                : (select && select.selectedIndex > 0
                    ? (select.options[select.selectedIndex]?.text || '')
                    : '');
            const layer = state.viewModel?.activePrognosticLayers?.find((l) => l.method === 'synastry_partner');
            const bd = layer?.raw?.partner_chart?.birth_data;
            const partnerMeta = bd
                ? [bd.date, bd.place].filter(Boolean).join(' · ')
                : '';
            return [partnerName, partnerMeta].filter(Boolean).join(' · ');
        }

        // transit / progression / direction — target date + tz + place
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
        const values = getTimeStepperSegmentValues(getDisplayedMomentDateTime());
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
            <span class="forecast-new-time-stepper-actions">
                <button type="button" class="forecast-new-stepper-action" data-reset-moment="prognostic" title="Вернуть текущие дату и время" aria-label="Вернуть текущие дату и время">↺</button>
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
            </span>
        `;
    }

    function renderOrUpdateTimeStepper() {
        if (!refs.forecastNewTimeStepper?.querySelector('[data-time-step-key]')) {
            renderTimeStepper();
            return;
        }
        updateTimeStepperValues(refs.forecastNewTimeStepper, getDisplayedMomentDateTime());
    }

    function renderSolarYearStepper() {
        // Render a year-only stepper into the regular stepper slot (#forecastNewTimeStepper)
        const container = refs.forecastNewTimeStepper;
        if (!container) return;
        container.innerHTML = `
            <span class="forecast-new-time-stepper-display">
                <span class="forecast-new-time-stepper-segment forecast-new-time-stepper-segment--yearOnes"
                    data-solar-year-segment tabindex="0" role="spinbutton"
                    aria-label="Год соляра" aria-valuetext="${state.solarYear}">
                    <button type="button" class="forecast-new-time-stepper-btn forecast-new-time-stepper-btn--up"
                        data-solar-year-step="1" aria-label="Следующий год"></button>
                    <span class="forecast-new-time-stepper-value">${state.solarYear}</span>
                    <button type="button" class="forecast-new-time-stepper-btn forecast-new-time-stepper-btn--down"
                        data-solar-year-step="-1" aria-label="Предыдущий год"></button>
                </span>
            </span>
        `;
    }

    function updateSolarYearStepperValue() {
        const container = refs.forecastNewTimeStepper;
        if (!container) return;
        const valueEl = container.querySelector('[data-solar-year-segment] .forecast-new-time-stepper-value');
        const segmentEl = container.querySelector('[data-solar-year-segment]');
        if (valueEl) valueEl.textContent = String(state.solarYear);
        if (segmentEl) segmentEl.setAttribute('aria-valuetext', String(state.solarYear));
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
            <span class="forecast-new-time-stepper-actions">
                <button type="button" class="forecast-new-stepper-action" data-reset-moment="natal" title="Вернуть дату и время рождения" aria-label="Вернуть дату и время рождения">↺</button>
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

    function bindSolarLocationAutocomplete() {
        if (!window.PlaceAutocomplete || !refs.forecastNewSolarLocationInput || !refs.forecastNewSolarLocationSuggestions) return;
        window.PlaceAutocomplete.attach({
            input: refs.forecastNewSolarLocationInput,
            suggestions: refs.forecastNewSolarLocationSuggestions,
            minChars: 2,
            debounceMs: 350,
            limit: 5,
            getLabel: (item) => item.shortName || item.displayName,
            onInput: () => {
                // Clear coordinates if user types manually
                state.solarLocation = state.solarLocation
                    ? { ...state.solarLocation, latitude: null, longitude: null, sourceId: null }
                    : null;
                if (refs.forecastNewSolarLat) refs.forecastNewSolarLat.value = '';
                if (refs.forecastNewSolarLon) refs.forecastNewSolarLon.value = '';
            },
            onSelect: async (item) => {
                if (refs.forecastNewSolarLocationInput) refs.forecastNewSolarLocationInput.value = item.shortName || item.displayName;
                const latitude = item.lat ?? item.latitude ?? null;
                const longitude = item.lon ?? item.longitude ?? null;
                if (refs.forecastNewSolarLat) refs.forecastNewSolarLat.value = latitude !== null ? String(latitude) : '';
                if (refs.forecastNewSolarLon) refs.forecastNewSolarLon.value = longitude !== null ? String(longitude) : '';

                let resolvedTimezone = null;
                if (item.sourceId && window.AstroAPI?.resolvePlaceTimezone) {
                    try { resolvedTimezone = await window.AstroAPI.resolvePlaceTimezone(item.sourceId); } catch (_) { /* ignore */ }
                }
                state.solarLocation = {
                    name: item.shortName || item.displayName,
                    latitude,
                    longitude,
                    sourceId: item.sourceId || item.source_id || null,
                    timezone: resolvedTimezone || window.Timezones?.guess?.(item.displayName || item.shortName) || null,
                };
                // Invalidate cache and refetch solar layer
                const cacheKey = buildLayerCacheKey('solar_return');
                delete state.layers?.solar_return;
                sessionStorage.removeItem(LAYER_CACHE_PREFIX + cacheKey);
                schedulePersist();
                if (state.activeLayers.includes('solar_return')) {
                    void loadActiveLayers({ lightweight: false });
                }
            },
        });

        // Clear solar location when input is emptied
        refs.forecastNewSolarLocationInput.addEventListener('change', () => {
            if (!refs.forecastNewSolarLocationInput.value.trim()) {
                state.solarLocation = null;
                if (refs.forecastNewSolarLat) refs.forecastNewSolarLat.value = '';
                if (refs.forecastNewSolarLon) refs.forecastNewSolarLon.value = '';
                if (state.activeLayers.includes('solar_return')) {
                    delete state.layers?.solar_return;
                    void loadActiveLayers({ lightweight: false });
                }
                schedulePersist();
            }
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
        renderForecastNewDispositorBlocks('natal', state.natalWheelData);
        renderInlineMatrixControls();
        applyInlineMatrixRowState();
        renderMatrixEditor();
        activateSavedTabs();
    }

    // Granular dispositor blocks: Jones cosmogram and the dispositor scheme are
    // rendered into their own containers (natal*/prog*) instead of the former
    // combined "rulers" block.
    function renderForecastNewDispositorBlocks(prefix, chartData) {
        const data = chartData || {
            planets: [],
            houses: [],
            balances: null,
            cosmogram_pattern: null,
        };
        window.DispositorChains?.render?.(`${prefix}JonesContainer`, data, { section: 'jones' });
        window.DispositorChains?.render?.(`${prefix}DispositorsContainer`, data, { section: 'scheme' });
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
        const enabled = new Set(Array.isArray(state.pageSettings.enabledAspectTypes) ? state.pageSettings.enabledAspectTypes : DEFAULT_ASPECT_TYPES);
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
        return enabled;
    }

    function applyResolvedForecastNewView(resolvedView = {}) {
        const resolved = window.AstroPreferences?.normalizeViewSettings
            ? window.AstroPreferences.normalizeViewSettings(resolvedView)
            : resolvedView;
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
            orientation: resolved?.view_options?.orientation === 'asc' ? 'asc' : (state.pageSettings.orientation || 'aries'),
            houseNumberStyle: resolved?.view_options?.house_number_style === 'roman' ? 'roman' : 'arabic',
            houseLabelsOutside: resolved?.view_options?.house_labels_outside === true,
            aspectScope: ['all', 'major', 'minor'].includes(resolved?.aspects?.scope)
                ? resolved.aspects.scope
                : (state.pageSettings.aspectScope || 'major'),
            enabledAspectTypes: Array.isArray(resolved?.aspects?.enabled_types)
                ? [...resolved.aspects.enabled_types]
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
        // Panel layout lives outside normalizeViewSettings; read from raw view.
        if (resolvedView && resolvedView.panels) applyPanelLayout(resolvedView.panels);
        syncControlsFromState();
        return applySettings();
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
            // Перерисовка таблиц планет стирает инлайновые ячейки матрицы — восстанавливаем их.
            renderInlineMatrixControls();
            applyInlineMatrixRowState();
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
        const nextHouseSystem = normalizeHouseSystemCode(state.pageSettings.houseSystem);
        const nextOrientation = state.pageSettings.orientation === 'asc' ? 'asc' : 'aries';
        const iconScale = clampPointScale(Number(refs.iconScaleRange?.value || Math.round((state.pageSettings.planetScale || 1.2) * 100)) / 100);
        const nextAspectScope = ['all', 'major', 'minor'].includes(refs.aspectScopeSelect?.value)
            ? refs.aspectScopeSelect.value
            : 'major';
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
            angleAscDscBold: state.pageSettings.angleAscDscBold !== false,
            angleMcIcBold: state.pageSettings.angleMcIcBold !== false,
            houseNumberStyle: state.pageSettings.houseNumberStyle === 'roman' ? 'roman' : 'arabic',
            houseLabelsOutside: state.pageSettings.houseLabelsOutside === true,
            showTransitCusps: refs.showTransitCuspsToggle?.checked !== false,
            showProgressionCusps: refs.showProgressionCuspsToggle?.checked !== false,
            showDirectionCusps: refs.showDirectionCuspsToggle?.checked !== false,
        };
        window.AstroPreferences?.saveChartViewDraft?.({
            chart_kind: 'natal',
            chart_id: state.userId,
            view_type: 'forecast_new',
        }, getResolvedForecastNewViewSettings());

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
        const date = refs.targetDateInput?.value || splitTargetDatetime(getDisplayedMomentDateTime())[0];
        const time = refs.targetTimeInput?.value || '12:00:00';
        applyDisplayedMomentDateTime(`${date}T${normalizeTime(time)}`);
        state.lastStepperAction = null;
        syncControlsFromState();
        schedulePersist();
        await loadDisplayedMomentLayers({ lightweight: true });
    }

    // Apply a saved chart (date/time/place) as the prognostic moment of the active layer.
    async function applySavedChartMoment(chart) {
        if (isSynastryMomentActive()) {
            await applySavedSynastryPartnerChart(chart);
            return;
        }
        const moment = readChartMoment(chart);
        if (!moment.date) return;
        setSelectedDateTime(`${moment.date}T${normalizeTime(moment.time || '12:00:00')}`);
        const tz = normalizeTimezoneValue(moment.timezone, moment.locationName);
        if (tz) state.timezone = tz;
        state.location = {
            name: moment.locationName || '',
            latitude: moment.latitude,
            longitude: moment.longitude,
        };
        state.lastStepperAction = null;
        syncControlsFromState();
        updatePrognosticTimeMeta();
        schedulePersist();
        await loadActiveLayers({ lightweight: true });
    }

    async function applySavedChartToNatal(chart) {
        const moment = readChartMoment(chart);
        if (!moment.date) return;
        state.natalSelectedDateTime = `${moment.date}T${normalizeTime(moment.time || '12:00:00')}`;
        const tz = normalizeTimezoneValue(moment.timezone, moment.locationName);
        if (tz) state.natalTimezone = tz;
        state.natalLocation = {
            name: moment.locationName || '',
            latitude: moment.latitude,
            longitude: moment.longitude,
            sourceId: null,
        };
        if (state.natalData) {
            state.natalData = {
                ...state.natalData,
                birth_data: {
                    ...state.natalData.birth_data,
                    first_name: chart?.first_name || chart?.birthData?.first_name || '',
                    last_name: chart?.last_name || chart?.birthData?.last_name || '',
                },
            };
        }
        if (chart?.user_id) {
            // Загруженная карта становится новым «сохранённым» наталом воркспейса:
            // isNatalEdited() → false, слои считаются по user_id, а не inline.
            state.userId = String(chart.user_id);
            state.natalInitialDateTime = state.natalSelectedDateTime;
            state.natalInitialSource = {
                timezone: state.natalTimezone,
                locationName: state.natalLocation.name || '',
                latitude: state.natalLocation.latitude,
                longitude: state.natalLocation.longitude,
            };
            configureForecastNavigation();
            void populateSynastryPartnerOptions();
        }
        syncControlsFromState();
        updateNatalMomentMeta();
        schedulePersist();
        await loadNatal({ lightweight: true });
    }

    async function applySavedSynastryPartnerChart(chart) {
        const moment = readChartMoment(chart);
        if (!moment.date) return;
        const id = chart?.user_id || chart?.chart_id || '';
        if (id) {
            state.synastryMode = 'db';
            state.synastryPartnerId = String(id);
            state.synastryManual = buildManualSynastryFromMoment(moment, chart);
            if (refs.forecastNewSynastryPartnerSelect) {
                const select = refs.forecastNewSynastryPartnerSelect;
                if (!Array.from(select.options).some((opt) => opt.value === String(id))) {
                    const opt = document.createElement('option');
                    opt.value = String(id);
                    opt.textContent = chart.display_title || chart.title
                        || chart.person_display_name
                        || [chart.first_name, chart.last_name].filter(Boolean).join(' ')
                        || String(id).slice(0, 8);
                    select.appendChild(opt);
                }
                select.value = String(id);
            }
            setSynastryMode('db');
        } else {
            state.synastryMode = 'manual';
            state.synastryPartnerId = '';
            state.synastryManual = buildManualSynastryFromMoment(moment, chart);
            setSynastryMode('manual');
            syncSynastryManualControlsFromState();
        }
        delete state.layers?.synastry_partner;
        state.lastStepperAction = null;
        syncControlsFromState();
        schedulePersist();
        await ensureSynastryLayerActive({ lightweight: true });
    }

    async function stepTargetDatetime(direction) {
        applyDisplayedMomentDateTime(addStep(getDisplayedMomentDateTime(), state.stepMode, direction));
        syncControlsFromState();
        schedulePersist();
        await loadDisplayedMomentLayers({ lightweight: true });
    }

    function stepSelectedDateTimeSegment(segment, direction) {
        const dir = direction >= 0 ? 1 : -1;
        applyDisplayedMomentDateTime(addDateTimeUnit(getDisplayedMomentDateTime(), segment.unit, segment.amount * dir));
        state.lastStepperAction = { type: 'segment', segment, direction: dir };
        syncControlsFromState();
        updatePrognosticTimeMeta();
        setLightweightLoading(true);
        schedulePersist();
        void loadDisplayedMomentLayers({ lightweight: true });
    }

    function stepSelectedDateTimeByCustom(direction) {
        updateCustomStepFromControls();
        const step = normalizeCustomStep(state.customStep);
        const dir = direction >= 0 ? 1 : -1;
        const unit = step.unit === 'week' ? 'day' : step.unit;
        const amount = step.unit === 'week' ? step.amount * 7 : step.amount;
        applyDisplayedMomentDateTime(addDateTimeUnit(getDisplayedMomentDateTime(), unit, amount * dir));
        state.lastStepperAction = { type: 'custom', step, direction: dir };
        syncControlsFromState();
        setCustomStepPopoverOpen(true);
        updatePrognosticTimeMeta();
        setLightweightLoading(true);
        schedulePersist();
        void loadDisplayedMomentLayers({ lightweight: true });
    }

    async function loadActiveLayers(options = {}) {
        const seq = ++state.requestSeq;
        state.pendingRequestToken = seq;
        const activeMethods = [...state.activeLayers];
        // Synastry can't be computed until a partner is chosen. Toggling it on opens the
        // partner popover (see the layer toggle handler); skip loading the layer until a
        // partner exists so one un-configured layer can't throw and tear down the layers
        // that did load (transit/progression/solar).
        const methodsToLoad = activeMethods.filter((method) =>
            method !== 'synastry_partner' || hasUsableSynastryPartner());
        const nextLayers = {};
        let hasRenderedPartial = false;
        const hasCompletePreviousLayers = methodsToLoad.length > 0
            && methodsToLoad.every((method) => state.layers?.[method]);
        if (options.showLoader) showLoader();
        if (options.lightweight) setLightweightLoading(true);
        state.layers = Object.fromEntries(activeMethods
            .filter((method) => state.layers?.[method])
            .map((method) => [method, state.layers[method]]));
        renderRightLayerTabs();
        try {
            const results = await Promise.allSettled(methodsToLoad.map(async (method) => {
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

    function isNatalEdited() {
        if (!state.natalInitialDateTime) return false;
        if (state.natalSelectedDateTime !== state.natalInitialDateTime) return true;
        const init = state.natalInitialSource;
        if (!init) return false;
        return state.natalTimezone !== init.timezone
            || (state.natalLocation?.name || '') !== init.locationName
            || state.natalLocation?.latitude !== init.latitude
            || state.natalLocation?.longitude !== init.longitude;
    }

    /**
     * Источник натала для форкаст-запросов (фикс C2 / план PA1).
     * Сохранённый клиент → {user_id}. Отредактированный момент натала → inline {natal}
     * через ChartSourcePanel.buildSourcePayload — слои считаются против пересчитанного
     * натала, а не против stale user_id из БД.
     */
    function buildNatalSourcePayload() {
        // Сохранённый клиент с неизменённым наталом → {user_id}.
        // Ручная (несохранённая) карта не имеет user_id — для неё всегда inline {natal},
        // иначе бэкенд отвечает 422 «укажите ровно один источник натала» (user_id=null).
        if (state.userId && !isNatalEdited()) return { user_id: state.userId };
        return window.ChartSourcePanel.buildSourcePayload({
            mode: 'manual',
            datetime: state.natalSelectedDateTime,
            timezone: state.natalTimezone,
            location: state.natalLocation,
        });
    }

    /** Идентичность натала в ключе кэша слоёв (фикс M2: две разные правки натала не коллидируют). */
    function natalCacheToken() {
        if (state.userId && !isNatalEdited()) return 'natal:saved';
        return [
            'natal',
            state.natalSelectedDateTime,
            state.natalTimezone,
            state.natalLocation?.latitude ?? '',
            state.natalLocation?.longitude ?? '',
        ].join('|');
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
            directionType: state.directionType,
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
            const natalSource = buildNatalSourcePayload();
            if (method === 'transit') {
                return apiPost('/transits/calculate', {
                    ...natalSource,
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
                    ...natalSource,
                    target_date: date,
                    target_time: time,
                    timezone: targetTimezone,
                    save_to_db: options.saveToDb === true && !natalSource.natal,
                    name: options.name || null,
                }, { signal: controller.signal });
            }
            if (method === 'solar_return') {
                const solarBody = {
                    ...natalSource,
                    year: state.solarYear,
                    save_to_db: false,
                };
                if (state.solarLocation?.latitude !== null && state.solarLocation?.latitude !== undefined) {
                    solarBody.location_latitude = state.solarLocation.latitude;
                    solarBody.location_longitude = state.solarLocation.longitude;
                    if (state.solarLocation.name) solarBody.location_name = state.solarLocation.name;
                    if (state.solarLocation.timezone) solarBody.location_timezone = state.solarLocation.timezone;
                }
                return apiPost('/solar/calculate', solarBody, { signal: controller.signal });
            }
            if (method === 'synastry_partner') {
                if (!hasUsableSynastryPartner()) {
                    throw new Error(state.synastryMode === 'manual'
                        ? 'Заполните данные партнёра для синастрии'
                        : 'Выберите партнёра для синастрии');
                }
                // primary = тот же источник натала, что у остальных слоёв (saved или inline)
                return apiPost('/synastry/calculate', {
                    primary: natalSource,
                    partner: buildSynastryPartnerSource(),
                }, { signal: controller.signal }).then((resp) => ({
                    partner_chart: resp.partner_chart,
                    inter_aspects: resp.inter_aspects,
                }));
            }
            return apiPost('/directions/calculate', {
                ...natalSource,
                target_date: date,
                direction_type: normalizeDirectionType(state.directionType),
                save_to_db: options.saveToDb === true && !natalSource.natal,
                name: options.name || null,
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

    /** Значения контролов новых слоёв из state (после hydrate). */
    function syncLayerControlInputs() {
        if (refs.forecastNewSolarYearInput) {
            refs.forecastNewSolarYearInput.value = String(state.solarYear);
        }
        if (refs.forecastNewSynastryPartnerSelect && state.synastryPartnerId) {
            refs.forecastNewSynastryPartnerSelect.value = state.synastryPartnerId;
        }
        // Источник партнёра (из базы / вручную) + поля ручной формы.
        setSynastryMode(state.synastryMode);
        const m = state.synastryManual;
        if (m) {
            if (refs.forecastNewSynastryManualName) refs.forecastNewSynastryManualName.value = m.name || '';
            if (refs.forecastNewSynastryManualDate) refs.forecastNewSynastryManualDate.value = m.date || '';
            if (refs.forecastNewSynastryManualTime) refs.forecastNewSynastryManualTime.value = (m.time || '').slice(0, 5);
            if (refs.forecastNewSynastryManualTimezone && m.timezone) refs.forecastNewSynastryManualTimezone.value = m.timezone;
            if (refs.forecastNewSynastryManualLocation) refs.forecastNewSynastryManualLocation.value = m.place || '';
            if (refs.forecastNewSynastryManualLat) refs.forecastNewSynastryManualLat.value = m.latitude !== null && m.latitude !== undefined ? String(m.latitude) : '';
            if (refs.forecastNewSynastryManualLon) refs.forecastNewSynastryManualLon.value = m.longitude !== null && m.longitude !== undefined ? String(m.longitude) : '';
        }
    }

    /** Список партнёров для синастрии: все сохранённые клиенты, кроме текущего. */
    async function populateSynastryPartnerOptions() {
        const select = refs.forecastNewSynastryPartnerSelect;
        if (!select) return;
        try {
            const response = await fetch(`${API_BASE}/users`, { credentials: 'include' });
            if (!response.ok) return;
            const users = await response.json();
            const currentId = String(state.userId || '');
            const options = (Array.isArray(users) ? users : [])
                .filter((user) => String(user.user_id) !== currentId)
                .map((user) => {
                    const name = [user.first_name, user.last_name].filter(Boolean).join(' ')
                        || String(user.user_id).slice(0, 8);
                    return `<option value="${user.user_id}">${name}</option>`;
                })
                .join('');
            select.innerHTML = `<option value="">— партнёр —</option>${options}`;
            if (state.synastryPartnerId) select.value = state.synastryPartnerId;
            if (select.value !== state.synastryPartnerId) state.synastryPartnerId = select.value || '';
        } catch {
            // нет сети/прав — селект останется пустым, слой синастрии сообщит об этом при включении
        }
    }

    async function apiPost(endpoint, body, options = {}) {
        const withLocaleHeaders = window.AstroAPI?.withLocaleHeaders || ((headers) => headers);
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            credentials: 'include',
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

    async function apiGet(endpoint) {
        const withLocaleHeaders = window.AstroAPI?.withLocaleHeaders || ((headers) => headers);
        const response = await fetch(`${API_BASE}${endpoint}`, {
            credentials: 'include',
            headers: withLocaleHeaders({}),
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
            // D6: «Одно колесо» = только натал в виде одиночной карты (внешний слот
            // 2-слотовой сетки + маркеры углов), весь остальной UI остаётся.
            visibleMethods: state.wheelView === 'single' ? ['natal'] : null,
            showAngleMarkers: state.wheelView === 'single',
            visualPreferences: window.AstroPreferences?.getAccountVisualPreferences?.() || window.accountPreferencesCache?.visual || null,
        });
        state.wheel.render(viewModel);
        applyHoveredAspectFocus();
        renderResultView();
    }

    function setWheelView(view) {
        const next = view === 'single' ? 'single' : 'multi';
        if (state.wheelView === next) return;
        state.wheelView = next;
        syncWorkspaceModePanels();
        syncWheelViewButtons();
        renderWheel();
        renderRightLayerTabs();
        renderRightPanel();
        persistState();
    }

    function syncWheelViewButtons() {
        refs.forecastNewViewSingle?.classList.toggle('is-active', state.wheelView === 'single');
        refs.forecastNewViewMulti?.classList.toggle('is-active', state.wheelView !== 'single');
    }

    function syncWorkspaceModePanels() {
        const isSingle = state.wheelView === 'single';
        document.body.classList.toggle('forecast-new-single-mode', isSingle);
        document.body.classList.toggle('forecast-new-multi-mode', !isSingle);
        refs.forecastNewProgPanel?.setAttribute('data-panel-mode', isSingle ? 'natal' : 'prognostic');
        // Rebuild chrome for the new mode's layout (panels.single vs panels.multi).
        if (state.panelLayout) renderPanels();
    }

    function normalizeResultView(view) {
        return 'wheel';
    }

    function setResultView(view) {
        const next = normalizeResultView(view);
        if (state.resultView === next) return;
        state.resultView = next;
        syncResultViewButtons();
        renderResultView();
        schedulePersist();
    }

    function syncResultViewButtons() {
        const current = normalizeResultView(state.resultView);
        state.resultView = current;
        refs.forecastNewResultViews?.querySelectorAll('[data-result-view]').forEach((button) => {
            const active = button.dataset.resultView === current;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-selected', active ? 'true' : 'false');
            button.textContent = resultViewLabel(button.dataset.resultView);
        });
        refs.forecastNewWheelShell?.closest('.forecast-new-center')?.setAttribute('data-result-view', current);
        refs.forecastNewResultPane?.classList.toggle('hidden', current === 'wheel');
    }

    function resultViewLabel(view) {
        return ({
            wheel: t('page.forecastNew.resultViews.wheel'),
            layers: t('page.forecastNew.resultViews.layers'),
            aspects: t('page.forecastNew.resultViews.aspects'),
        })[view] || view;
    }

    function renderResultView() {
        syncResultViewButtons();
        if (!refs.forecastNewResultPane || state.resultView === 'wheel') return;
        refs.forecastNewResultPane.innerHTML = state.resultView === 'aspects'
            ? renderResultAspectsView()
            : renderResultLayersView();
    }

    function resultLayers() {
        const layers = state.viewModel?.activePrognosticLayers || [];
        return LAYER_ORDER
            .map((method) => layers.find((layer) => layer.method === method))
            .filter(Boolean);
    }

    function renderResultHead(titleKey, subtitleKey, count) {
        return `
            <div class="forecast-new-result-head">
                <div>
                    <h3>${escapeHtml(t(titleKey))}</h3>
                    <p>${escapeHtml(t(subtitleKey))}</p>
                </div>
                <span class="forecast-new-result-count">${escapeHtml(String(count))}</span>
            </div>
        `;
    }

    function renderResultLayersView() {
        const layers = resultLayers();
        if (!layers.length) {
            return `${renderResultHead('page.forecastNew.resultViews.layersTitle', 'page.forecastNew.resultViews.layersSubtitle', 0)}
                <div class="forecast-new-result-empty">${escapeHtml(t('page.forecastNew.resultViews.emptyLayers'))}</div>`;
        }
        return `
            ${renderResultHead('page.forecastNew.resultViews.layersTitle', 'page.forecastNew.resultViews.layersSubtitle', layers.length)}
            <table class="forecast-new-result-table">
                <thead>
                    <tr>
                        <th>${escapeHtml(t('page.forecastNew.resultViews.layer'))}</th>
                        <th>${escapeHtml(t('page.forecastNew.resultViews.source'))}</th>
                        <th>${escapeHtml(t('page.forecastNew.resultViews.bodies'))}</th>
                        <th>${escapeHtml(t('page.forecastNew.resultViews.aspectsCount'))}</th>
                    </tr>
                </thead>
                <tbody>
                    ${layers.map((layer) => `
                        <tr data-result-layer="${escapeHtml(layer.method)}">
                            <td>
                                <span class="forecast-new-result-layer-name">
                                    <span class="forecast-new-result-layer-dot"></span>
                                    ${escapeHtml(layerLabel(layer.method))}
                                </span>
                            </td>
                            <td>${escapeHtml(buildResultLayerMeta(layer.method, layer)) || '—'}</td>
                            <td class="mono">${escapeHtml(String((layer.bodies || []).length))}</td>
                            <td class="mono">${escapeHtml(String((layer.aspects || []).length))}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function renderResultAspectsView() {
        const aspects = resultLayers().flatMap((layer) => (layer.aspects || []).map((aspect) => ({
            layerMethod: layer.method,
            aspect: state.prognosticRenderer?.normalizeAspectForDisplay
                ? state.prognosticRenderer.normalizeAspectForDisplay(aspect)
                : aspect,
        })));
        if (!aspects.length) {
            return `${renderResultHead('page.forecastNew.resultViews.aspectsTitle', 'page.forecastNew.resultViews.aspectsSubtitle', 0)}
                <div class="forecast-new-result-empty">${escapeHtml(t('page.forecastNew.resultViews.emptyAspects'))}</div>`;
        }
        const sorted = aspects.sort((a, b) => {
            const orbA = Number(a.aspect?.orb);
            const orbB = Number(b.aspect?.orb);
            if (Number.isFinite(orbA) && Number.isFinite(orbB) && orbA !== orbB) return orbA - orbB;
            return LAYER_ORDER.indexOf(a.layerMethod) - LAYER_ORDER.indexOf(b.layerMethod);
        });
        return `
            ${renderResultHead('page.forecastNew.resultViews.aspectsTitle', 'page.forecastNew.resultViews.aspectsSubtitle', sorted.length)}
            <table class="forecast-new-result-table">
                <thead>
                    <tr>
                        <th>${escapeHtml(t('page.forecastNew.resultViews.layer'))}</th>
                        <th>${escapeHtml(t('page.forecastNew.resultViews.aspect'))}</th>
                        <th>${escapeHtml(t('page.forecastNew.resultViews.phase'))}</th>
                        <th>${escapeHtml(t('page.forecastNew.resultViews.orb'))}</th>
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map(({ layerMethod, aspect }) => {
                        const aspectKey = state.prognosticRenderer?.getAspectKey?.(aspect) || '';
                        const phase = state.prognosticRenderer?.getApplyingSeparatingShortLabel?.(aspect) || '';
                        const orb = Number(aspect?.orb);
                        return `
                            <tr data-result-layer="${escapeHtml(layerMethod)}" data-result-aspect-key="${escapeHtml(aspectKey)}">
                                <td>${escapeHtml(layerLabel(layerMethod))}</td>
                                <td>${state.prognosticRenderer?.renderAspectPairCell?.(aspect) || escapeHtml(formatAspectText(aspect))}</td>
                                <td>${phase ? escapeHtml(phase) : '—'}</td>
                                <td class="mono">${Number.isFinite(orb) ? `${orb.toFixed(2)}°` : '—'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    function formatAspectText(aspect) {
        return [aspect?.left_planet || aspect?.planet_1, aspect?.aspect_type, aspect?.right_planet || aspect?.planet_2]
            .filter(Boolean)
            .join(' ');
    }

    function buildResultLayerMeta(method, layer) {
        if (method === 'solar_return') {
            const info = layer?.raw?.solar_info || {};
            const locName = info?.location?.name || state.solarLocation?.name || state.location?.name || '';
            return [String(state.solarYear || info.year || ''), locName].filter(Boolean).join(' · ');
        }
        if (method === 'synastry_partner') return buildSynastryLayerMeta(layer);
        return buildLayerMeta(method, layer?.raw || {});
    }

    function buildSynastryLayerMeta(layer) {
        const select = refs.forecastNewSynastryPartnerSelect;
        const partnerName = state.synastryMode === 'manual'
            ? (state.synastryManual?.name || t('page.forecastNew.resultViews.manualPartner'))
            : (select && select.selectedIndex > 0 ? (select.options[select.selectedIndex]?.text || '') : '');
        const bd = layer?.raw?.partner_chart?.birth_data;
        return [partnerName, bd?.date, bd?.place].filter(Boolean).join(' · ');
    }

    function renderRightLayerTabs() {
        if (!refs.rightLayerTabs) return;
        if (state.wheelView === 'single') {
            refs.rightLayerTabs.innerHTML = '';
            return;
        }
        normalizeActiveLayers();
        const activeTabs = state.activeLayers.map((method) => `
            <button type="button" class="forecast-new-right-layer-tab ${method === state.selectedRightLayer ? 'active' : ''}" data-right-layer="${method}">
                <span class="forecast-new-right-layer-label">${layerLabel(method)}</span>
                <span type="button" class="forecast-new-right-layer-remove" data-remove-layer="${method}" aria-label="Убрать слой ${escapeHtml(layerLabel(method))}" title="Убрать слой">−</span>
            </button>
        `).join('');
        const layerButtons = LAYER_ORDER.map((method) => {
            const active = state.activeLayers.includes(method);
            return `
                <button type="button" class="forecast-new-add-layer-item" data-add-layer-method="${method}" ${active ? 'disabled' : ''}>
                    ${active ? '✓ ' : '+ '}${layerLabel(method)}
                </button>
            `;
        }).join('');
        const allLayersActive = state.activeLayers.length >= LAYER_ORDER.length;
        const compact = state.activeLayers.length > 0;
        const addLayerLabel = t('page.chart.actions.addLayer');
        const addLayerMarkup = allLayersActive ? '' : `
            <span class="forecast-new-add-layer${compact ? ' forecast-new-add-layer--compact' : ''}">
                <button type="button" class="forecast-new-add-layer-toggle" data-add-layer-toggle aria-haspopup="menu" aria-expanded="false"${compact ? ` aria-label="${escapeHtml(addLayerLabel)}" title="${escapeHtml(addLayerLabel)}"` : ''}>${compact ? '+' : `+ ${addLayerLabel}`}</button>
                <span class="forecast-new-add-layer-menu hidden" data-add-layer-menu role="menu">
                    ${layerButtons}
                </span>
            </span>
        `;
        refs.rightLayerTabs.innerHTML = `
            ${activeTabs}
            ${addLayerMarkup}
        `;
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
        if (state.wheelView === 'single') {
            renderSingleNatalRightPanel();
            return;
        }
        const method = state.selectedRightLayer;
        if (!method) {
            refs.prognosticPanelTitle.textContent = 'Слой не выбран';
            refs.prognosticPanelMeta.textContent = 'Добавьте слой для расчёта';
            if (refs.forecastNewTimeStepper) refs.forecastNewTimeStepper.innerHTML = '';
            if (refs.targetDatetimeLabel) refs.targetDatetimeLabel.textContent = '';
            state.prognosticRenderer?.render({ planets: [], houses: [], aspects: [], aspect_configurations: [], stelliums: [], balances: null, cosmogram_pattern: null });
            renderForecastNewDispositorBlocks('prog', null);
            syncPrognosticHousesVisibility([]);
            renderResultView();
            return;
        }
        const layer = state.viewModel?.activePrognosticLayers?.find((item) => item.method === method);
        refs.prognosticPanelTitle.textContent = layerLabel(method);
        refs.prognosticPanelMeta.textContent = buildPrognosticMomentSummary();
        // Solar return: render year-only stepper into the regular stepper slot
        if (method === 'solar_return') renderSolarYearStepper();
        else renderOrUpdateTimeStepper();
        refs.targetDatetimeLabel.textContent = getDisplayedMomentDateTime().replace('T', ' ');

        if (!layer) {
            state.prognosticRenderer?.setHouseNumberStyle?.(state.pageSettings.houseNumberStyle);
            state.prognosticRenderer?.render({ planets: [], houses: [], aspects: [], aspect_configurations: [], stelliums: [], balances: null, cosmogram_pattern: null });
            renderForecastNewDispositorBlocks('prog', null);
            syncPrognosticHousesVisibility([]);
            renderResultView();
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
        renderForecastNewDispositorBlocks('prog', {
            planets: layer.bodies || [],
            houses: layer.houses || [],
            balances: layer.balances || null,
            cosmogram_pattern: layer.cosmogram_pattern || null,
        });
        renderInlineMatrixControls();
        applyInlineMatrixRowState();
        syncPrognosticHousesVisibility(layer.houses || []);
        syncHoveredAspectToActiveSurface();
        activateSavedTabs();
        renderResultView();
    }

    function renderSingleNatalRightPanel() {
        if (!refs.prognosticPanelTitle || !refs.prognosticPanelMeta) return;
        refs.prognosticPanelTitle.textContent = 'Натал';
        refs.prognosticPanelMeta.textContent = refs.natalPanelMeta?.textContent || '';
        if (refs.forecastNewTimeStepper) refs.forecastNewTimeStepper.innerHTML = '';
        if (refs.targetDatetimeLabel) refs.targetDatetimeLabel.textContent = state.natalSelectedDateTime.replace('T', ' ');
        // Single mode is natal-only. The natal* containers are filled by
        // renderStaticNatal()/state.natalRenderer and distributed across BOTH
        // panels by renderPanels() according to panels.single. The legacy reuse
        // of prog* containers for natal data is gone.
        renderPanels();
        renderResultView();
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
                aspectScope: state.pageSettings.aspectScope || 'major',
                enabledAspectTypes: Array.isArray(state.pageSettings.enabledAspectTypes)
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
                aspectScope: state.pageSettings.aspectScope || 'major',
                enabledAspectTypes: Array.isArray(state.pageSettings.enabledAspectTypes)
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
            const targetTime = info.target_time || '';
            return [
                [info.target_date, targetTime].filter(Boolean).join(' '),
                formatHeaderTimezone(info.timezone),
                info.method,
                info.rate,
            ].filter(Boolean).join(' · ');
        }
        const info = raw?.direction_info || {};
        return [info.target_date, info.direction_type, info.arc_formatted].filter(Boolean).join(' · ');
    }

    // ====================================================================
    // Configurable side panels — chrome rendered from state.panelLayout.
    // Each block keeps its fixed content <div id> (populated by the renderers);
    // here we only (re)build the tab bar + tab panes and re-parent block divs.
    // ====================================================================
    const PANEL_SIDE_IDS = { left: 'forecastNewNatalPanel', right: 'forecastNewProgPanel' };

    function currentWheelMode() {
        const singleActive = document.getElementById('forecastNewViewSingle')?.classList.contains('is-active');
        const multiActive = document.getElementById('forecastNewViewMulti')?.classList.contains('is-active');
        if (singleActive !== multiActive) return singleActive ? 'single' : 'multi';
        return state.wheelView === 'single' ? 'single' : 'multi';
    }

    function activeTabStateKey(side) {
        const mode = currentWheelMode();
        const cap = side === 'left' ? 'Left' : 'Right';
        return mode + cap; // multiLeft | multiRight | singleLeft | singleRight
    }

    // Rebuild BOTH panels from the current layout. Delegates the DOM work to the
    // pure (jsdom-testable) module so cross-panel moves never clobber: it detaches
    // every block div to a hidden store, then re-homes per side in one pass.
    function renderPanels() {
        if (!state.panelLayout || !window.ForecastNewPanelLayout) return;
        window.ForecastNewPanelLayout.renderPanelsToDom({
            document,
            layout: state.panelLayout,
            mode: currentWheelMode(),
            activeTab: state.activeTab,
            translate: t,
        });
        syncHoveredAspectToActiveSurface?.();
        renderNowBlocks();
    }

    // True when the current mode's layout places the given now-view anywhere
    // (a side panel tab or a corner).
    function layoutHasBlock(blockKey) {
        const mode = currentWheelMode();
        const pane = state.panelLayout?.panels?.[mode];
        if (!pane) return false;
        for (const side of ['left', 'right']) {
            for (const tab of pane[side] || []) {
                if ((tab.blocks || []).some((b) => `${b.source}:${b.view}` === blockKey)) return true;
            }
        }
        const corners = pane.corners || {};
        return Object.keys(corners).some((k) => {
            const b = corners[k];
            return b && `${b.source}:${b.view}` === blockKey;
        });
    }

    function renderNowBlocks() {
        if (layoutHasBlock('now:lunar')) renderLunarBlock();
        if (layoutHasBlock('now:hours')) renderHoursBlock();
    }

    function formatLunarMoment(iso) {
        if (!iso) return '';
        try {
            return new Date(iso).toLocaleString(undefined, {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
            });
        } catch {
            return iso;
        }
    }

    function lunarBlockMarkup(snapshot) {
        const phase = snapshot.phase || {};
        const voc = snapshot.void_of_course || {};
        const signKey = `astro.sign.${phase.moon_sign || ''}`;
        const signLabel = t(signKey) && t(signKey) !== signKey ? t(signKey) : (phase.moon_sign || '');
        const deg = Math.floor(phase.moon_degree_in_sign || 0);
        const phaseKey = `page.forecastNew.lunar.phase.${phase.phase_key || ''}`;
        const phaseLabel = t(phaseKey) && t(phaseKey) !== phaseKey ? t(phaseKey) : (phase.phase_label || '');
        const illum = phase.illumination != null ? `${phase.illumination}%` : '';

        const vocLabel = voc.is_void
            ? (t('page.forecastNew.lunar.vocActive') || 'Без курса')
            : (t('page.forecastNew.lunar.vocInactive') || 'В курсе');
        let vocDetail = '';
        if (voc.is_void && voc.egress_at) {
            vocDetail = `${t('page.forecastNew.lunar.untilEgress') || 'до смены знака'} ${escapeHtml(formatLunarMoment(voc.egress_at))}`;
        } else if (!voc.is_void && voc.next_aspect) {
            const body = voc.next_aspect.body || '';
            vocDetail = `${t('page.forecastNew.lunar.nextAspect') || 'след. аспект'} ${escapeHtml(body)} ${escapeHtml(formatLunarMoment(voc.next_aspect.at))}`;
        }

        const lunations = (snapshot.lunations || []).slice(0, 3).map((e) => {
            const kindLabel = t(`page.forecastNew.lunar.${e.kind}`) || e.kind;
            let ecl = '';
            if (e.eclipse) {
                const typeLabel = t(`page.forecastNew.lunar.eclipse.${e.eclipse.type}`) || e.eclipse.type;
                ecl = ` · ${escapeHtml(typeLabel)} (${escapeHtml((e.eclipse.classes || []).join(', '))})`;
            }
            return `<li class="forecast-new-lunar-event">
                <span class="forecast-new-lunar-event-when">${escapeHtml(formatLunarMoment(e.at))}</span>
                <span class="forecast-new-lunar-event-kind">${escapeHtml(kindLabel)}${ecl}</span>
            </li>`;
        }).join('');

        return `
            <div class="forecast-new-lunar">
                <div class="forecast-new-lunar-phase">
                    <span class="forecast-new-lunar-phase-name">${escapeHtml(phaseLabel)}</span>
                    <span class="forecast-new-lunar-illum">${escapeHtml(illum)}</span>
                </div>
                <div class="forecast-new-lunar-pos">${escapeHtml(`${deg}° ${signLabel}`)}</div>
                <div class="forecast-new-lunar-voc" data-void="${voc.is_void ? '1' : '0'}">
                    <span class="forecast-new-lunar-voc-label">${escapeHtml(vocLabel)}</span>
                    <span class="forecast-new-lunar-voc-detail">${vocDetail}</span>
                </div>
                <ul class="forecast-new-lunar-events">${lunations}</ul>
            </div>`;
    }

    async function renderLunarBlock() {
        const el = document.getElementById('nowLunarView')
            || document.getElementById('forecastNewBlockStore')?.querySelector('#nowLunarView');
        if (!el) return;
        // Cache for 10 minutes — the moment moves slowly relative to a session.
        const fresh = state.lunarSnapshot && (Date.now() - state.lunarSnapshotAt) < 600000;
        if (fresh) {
            el.innerHTML = lunarBlockMarkup(state.lunarSnapshot);
            return;
        }
        if (!state.lunarSnapshot) {
            el.innerHTML = `<div class="forecast-new-lunar-loading">${escapeHtml(t('common.loading') || '…')}</div>`;
        }
        try {
            const snapshot = await apiGet('/lunar/snapshot');
            state.lunarSnapshot = snapshot;
            state.lunarSnapshotAt = Date.now();
            el.innerHTML = lunarBlockMarkup(snapshot);
        } catch (error) {
            el.innerHTML = `<div class="forecast-new-lunar-error">${escapeHtml(t('common.error') || 'Ошибка')}</div>`;
        }
    }

    function planetLabel(name) {
        const key = `astro.planet.${name}`;
        const tr = t(key);
        return tr && tr !== key ? tr : name;
    }

    function formatHourRange(startIso, endIso) {
        const fmt = (iso) => {
            try {
                return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            } catch { return iso; }
        };
        return `${fmt(startIso)}–${fmt(endIso)}`;
    }

    function hoursBlockMarkup(data) {
        if (!data || data.available === false) {
            return `<div class="forecast-new-hours-empty">${escapeHtml(t('page.forecastNew.hours.unavailable') || '—')}</div>`;
        }
        const cur = data.current_hour;
        const dayRuler = escapeHtml(planetLabel(data.day_ruler));
        const lunarDay = data.lunar_day != null
            ? `<span class="forecast-new-hours-lunarday">${escapeHtml(t('page.forecastNew.hours.lunarDay') || 'Лунный день')}: ${data.lunar_day}</span>`
            : '';
        const currentHtml = cur
            ? `<div class="forecast-new-hours-current">
                    <span class="forecast-new-hours-current-ruler">${escapeHtml(planetLabel(cur.ruler))}</span>
                    <span class="forecast-new-hours-current-range">${escapeHtml(formatHourRange(cur.start, cur.end))}</span>
                    <span class="forecast-new-hours-current-dn">${escapeHtml(cur.is_day ? (t('page.forecastNew.hours.day') || 'день') : (t('page.forecastNew.hours.night') || 'ночь'))}</span>
               </div>`
            : '';
        const rows = (data.hours || []).map((h) => {
            const isCur = cur && h.index === cur.index;
            return `<li class="forecast-new-hours-row${isCur ? ' is-current' : ''}" data-day="${h.is_day ? '1' : '0'}">
                <span class="forecast-new-hours-idx">${h.index}</span>
                <span class="forecast-new-hours-ruler">${escapeHtml(planetLabel(h.ruler))}</span>
                <span class="forecast-new-hours-range">${escapeHtml(formatHourRange(h.start, h.end))}</span>
            </li>`;
        }).join('');
        return `
            <div class="forecast-new-hours">
                <div class="forecast-new-hours-head">
                    <span class="forecast-new-hours-dayruler">${escapeHtml(t('page.forecastNew.hours.dayRuler') || 'Управитель дня')}: ${dayRuler}</span>
                    ${lunarDay}
                </div>
                ${currentHtml}
                <ul class="forecast-new-hours-list">${rows}</ul>
            </div>`;
    }

    async function renderHoursBlock() {
        const el = document.getElementById('nowHoursView')
            || document.getElementById('forecastNewBlockStore')?.querySelector('#nowHoursView');
        if (!el) return;
        const lat = state.location?.latitude;
        const lon = state.location?.longitude;
        if (lat == null || lon == null) {
            el.innerHTML = `<div class="forecast-new-hours-empty">${escapeHtml(t('page.forecastNew.hours.noLocation') || '—')}</div>`;
            return;
        }
        const fresh = state.hoursData && (Date.now() - state.hoursDataAt) < 600000
            && state.hoursDataLat === lat && state.hoursDataLon === lon;
        if (fresh) {
            el.innerHTML = hoursBlockMarkup(state.hoursData);
            return;
        }
        if (!state.hoursData) {
            el.innerHTML = `<div class="forecast-new-hours-loading">${escapeHtml(t('common.loading') || '…')}</div>`;
        }
        try {
            const data = await apiGet(`/electional/planetary-hours?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
            state.hoursData = data;
            state.hoursDataAt = Date.now();
            state.hoursDataLat = lat;
            state.hoursDataLon = lon;
            el.innerHTML = hoursBlockMarkup(data);
        } catch (error) {
            el.innerHTML = `<div class="forecast-new-hours-error">${escapeHtml(t('common.error') || 'Ошибка')}</div>`;
        }
    }

    // Activate a tab without rebuilding chrome (used on tab click).
    function activatePanelTab(side, tabId) {
        const panel = document.getElementById(PANEL_SIDE_IDS[side]);
        if (!panel || !tabId) return;
        state.activeTab[activeTabStateKey(side)] = tabId;
        panel.querySelectorAll('.panel-tabs .panel-tab').forEach((node) =>
            node.classList.toggle('active', node.dataset.tabId === tabId));
        panel.querySelectorAll('.panel-content [data-tab-id]').forEach((node) =>
            node.classList.toggle('active', node.dataset.tabId === tabId));
        // Mark overflow wrapper is-active when the active tab lives in the overflow menu.
        const overflow = panel.querySelector('[data-tabs-overflow]');
        if (overflow) {
            const inOverflow = !!overflow.querySelector(`.forecast-new-tabs-overflow-item[data-tab-id="${tabId}"]`);
            overflow.classList.toggle('is-active', inOverflow);
        }
        closeTabsOverflowMenus();
    }

    // Back-compat alias retained at call sites; rebuilds chrome from layout.
    function activateSavedTabs() {
        renderPanels();
    }

    // Initialize panelLayout/activeTab from defaults, migrating legacy localStorage
    // active-tab labels. Called before the first chrome render.
    function initPanelLayout() {
        const PL = window.ForecastNewPanelLayout;
        if (!PL) return;
        state.panelLayout = PL.normalizeLayout(PL.buildDefaultForecastNewLayout());
        const migrated = PL.migrateLegacyActiveTab(
            { leftTab: state.leftTab, rightTab: state.rightTab, singleRightTab: state.singleRightTab },
            state.panelLayout
        );
        state.activeTab = migrated;
    }

    // Apply a layout coming from server prefs (resolved.panels), preserving the
    // active tab where possible.
    function applyPanelLayout(rawPanelsLayout) {
        const PL = window.ForecastNewPanelLayout;
        if (!PL || !rawPanelsLayout) return;
        state.panelLayout = PL.normalizeLayout(rawPanelsLayout);
        const def = PL.defaultActiveTabs(state.panelLayout);
        // Keep current active tab ids that still exist; else fall back to first.
        ['multiLeft', 'multiRight', 'singleLeft', 'singleRight'].forEach((k) => {
            const mode = k.startsWith('multi') ? 'multi' : 'single';
            const side = k.endsWith('Left') ? 'left' : 'right';
            const tabs = state.panelLayout.panels[mode][side] || [];
            if (!tabs.some((tb) => tb.id === state.activeTab[k])) state.activeTab[k] = def[k];
        });
        renderPanels();
    }

    function closeTabsOverflowMenus() {
        document.querySelectorAll('[data-tabs-overflow].is-open').forEach((el) => {
            el.classList.remove('is-open');
            const toggle = el.querySelector('[data-tabs-overflow-toggle]');
            if (toggle) toggle.setAttribute('aria-expanded', 'false');
        });
    }
    function syncTabsOverflowToggleState() {
        document.querySelectorAll('[data-tabs-overflow]').forEach((el) => {
            const toggle = el.querySelector('[data-tabs-overflow-toggle]');
            if (toggle) toggle.setAttribute('aria-expanded', String(el.classList.contains('is-open')));
        });
    }

    // ====================================================================
    // Inline panel configurator (no drag-and-drop). Explicit controls:
    // add/rename/delete/reorder tabs, switch tab panel side, add/remove/reorder
    // blocks within a tab, reset to default. Edits the CURRENT wheel mode's
    // layout (what you see is what you configure).
    // ====================================================================
    const SOURCE_LABEL_I18N = {
        natal: 'page.forecastNew.natalPanelTitle',
        prog: 'page.forecastNew.tabs.prognosticShort',
    };

    function blockLabel(block) {
        const PL = window.ForecastNewPanelLayout;
        const view = PL.autoTabTitle({ blocks: [block] }, t);
        if (currentWheelMode() === 'single') return view; // single = natal only, no need to disambiguate
        const srcKey = SOURCE_LABEL_I18N[block.source];
        let src = srcKey ? t(srcKey) : block.source;
        if (!src || src === srcKey) src = block.source === 'prog' ? 'Прогноз' : 'Натал';
        return src + ' · ' + view;
    }

    // The full catalog of blocks for a mode. A block may only live in one place
    // at a time (one DOM container), so "adding" a block that already exists
    // elsewhere MOVES it. The add menus therefore offer the whole catalog and we
    // remove the block from its current home before placing it (see add-block /
    // removeBlockFromMode). This avoids the dead-end where every block is already
    // placed and nothing can be added.
    function allBlocksForMode(mode) {
        const PL = window.ForecastNewPanelLayout;
        const sources = mode === 'single' ? ['natal'] : ['natal', 'prog'];
        const out = [];
        sources.forEach((source) => PL.VIEW_KEYS.forEach((view) => {
            out.push({ source: source, view: view });
        }));
        // "now" blocks are mode-agnostic single instances (source 'now').
        (PL.NOW_VIEWS || []).forEach((view) => out.push({ source: 'now', view: view }));
        return out;
    }

    const VIEW_GROUPS = {
        chart: ['planets', 'houses'],
        positions: ['grid'],
        aspects: ['aspects', 'configs', 'stelliums'],
        analysis: ['balances', 'jones', 'dispositors'],
        now: ['lunar', 'hours'],
    };

    function findBlockLocation(mode, blockKey) {
        for (const side of ['left', 'right']) {
            for (const tab of state.panelLayout.panels[mode][side] || []) {
                if (tab.blocks.some((block) => `${block.source}:${block.view}` === blockKey)) return { side, tab };
            }
        }
        const corners = state.panelLayout.panels[mode].corners || {};
        for (const corner of window.ForecastNewPanelLayout.CORNER_KEYS || ['tl', 'tr', 'bl', 'br']) {
            const block = corners[corner];
            if (block && `${block.source}:${block.view}` === blockKey) return { corner };
        }
        return null;
    }

    function blockLocationLabel(location, mode = currentWheelMode()) {
        if (!location) return '';
        if (location.corner) return t(CORNER_LABEL_I18N[location.corner]) || CORNER_LABEL_FALLBACK[location.corner];
        return `${panelSideLabel(location.side, mode)} · ${window.ForecastNewPanelLayout.autoTabTitle(location.tab, t)}`;
    }

    function panelSideLabel(side, mode = currentWheelMode()) {
        if (mode === 'single') return t('page.forecastNew.panelEditor.chartData') || 'Данные карты';
        return side === 'left'
            ? (t('page.forecastNew.panelEditor.primaryChart') || 'Основная карта')
            : (t('page.forecastNew.panelEditor.comparisonChart') || 'Карта сравнения');
    }

    function setPanelSaveState(next) {
        state.panelSaveState = next;
        const status = document.querySelector('[data-pe-save-status]');
        if (!status) return;
        const keys = {
            saving: 'page.forecastNew.panelEditor.saving',
            saved: 'page.forecastNew.panelEditor.saved',
            error: 'page.forecastNew.panelEditor.saveFailed',
        };
        status.dataset.state = next;
        status.innerHTML = escapeHtml(t(keys[next]) || keys[next]);
        if (next === 'error') {
            status.innerHTML += ` · <button type="button" class="forecast-new-pe-link" data-pe-action="retry-save">${escapeHtml(t('page.forecastNew.panelEditor.retry') || 'Повторить')}</button>`;
        }
    }

    function closePanelDialog(result = false) {
        const dialog = document.getElementById('forecastNewPanelDialog');
        if (!dialog || !state.panelDialog) return;
        dialog.classList.add('hidden');
        dialog.setAttribute('aria-hidden', 'true');
        const pending = state.panelDialog;
        state.panelDialog = null;
        pending.restoreFocus?.focus?.();
        pending.resolve(result);
    }

    function showPanelDialog({ title, copy, confirmLabel, inputLabel, destructive = false }) {
        const dialog = ensurePanelDialog();
        const active = document.activeElement;
        const dialogTitle = dialog.querySelector('[data-pe-dialog-title]');
        const dialogCopy = dialog.querySelector('[data-pe-dialog-copy]');
        const inputWrap = dialog.querySelector('[data-pe-dialog-input-wrap]');
        const input = dialog.querySelector('[data-pe-dialog-input]');
        const confirm = dialog.querySelector('[data-pe-dialog-confirm]');
        if (!dialogTitle || !dialogCopy || !inputWrap || !input || !confirm) {
            throw new Error('Panel dialog is missing required controls');
        }
        dialogTitle.textContent = title;
        dialogCopy.textContent = copy || '';
        inputWrap.classList.toggle('hidden', !inputLabel);
        input.value = '';
        input.placeholder = inputLabel || '';
        confirm.textContent = confirmLabel;
        confirm.classList.toggle('is-destructive', destructive);
        dialog.classList.remove('hidden');
        dialog.setAttribute('aria-hidden', 'false');
        setTimeout(() => (inputLabel ? input : confirm).focus(), 0);
        return new Promise((resolve) => { state.panelDialog = { resolve, input, inputLabel, restoreFocus: active }; });
    }

    function ensurePanelDialog() {
        let dialog = document.getElementById('forecastNewPanelDialog');
        const requiredSelectors = [
            '[data-pe-dialog-title]',
            '[data-pe-dialog-copy]',
            '[data-pe-dialog-input-wrap]',
            '[data-pe-dialog-input]',
            '[data-pe-dialog-cancel]',
            '[data-pe-dialog-confirm]',
        ];
        if (dialog && requiredSelectors.every((selector) => dialog.querySelector(selector))) return dialog;
        dialog?.remove();
        dialog = document.createElement('div');
        dialog.id = 'forecastNewPanelDialog';
        dialog.className = 'forecast-new-pe-dialog hidden';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-hidden', 'true');
        dialog.innerHTML = `
            <div class="forecast-new-pe-dialog-card">
                <h2 data-pe-dialog-title></h2>
                <p data-pe-dialog-copy></p>
                <label class="forecast-new-pe-dialog-input-wrap hidden" data-pe-dialog-input-wrap>
                    <span>${escapeHtml(t('page.forecastNew.panelEditor.workspaceName') || 'Название')}</span>
                    <input type="text" data-pe-dialog-input>
                </label>
                <div class="forecast-new-pe-dialog-actions">
                    <button type="button" class="forecast-new-pe-secondary" data-pe-dialog-cancel>${escapeHtml(t('common.cancel') || 'Отмена')}</button>
                    <button type="button" class="forecast-new-pe-primary forecast-new-pe-dialog-confirm" data-pe-dialog-confirm></button>
                </div>
            </div>`;
        document.body.appendChild(dialog);
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog || event.target.closest('[data-pe-dialog-cancel]')) closePanelDialog(false);
            if (event.target.closest('[data-pe-dialog-confirm]')) {
                const value = state.panelDialog?.inputLabel ? state.panelDialog.input.value.trim() : true;
                if (state.panelDialog?.inputLabel && !value) return state.panelDialog.input.focus();
                closePanelDialog(value);
            }
        });
        return dialog;
    }

    // Remove a blockKey from every tab in the mode (used before re-placing it).
    function removeBlockFromMode(layout, mode, blockKey) {
        ['left', 'right'].forEach((side) => (layout.panels[mode][side] || []).forEach((tab) => {
            tab.blocks = tab.blocks.filter((b) => (b.source + ':' + b.view) !== blockKey);
        }));
        // A block lives in exactly one slot — panel tab OR corner. Clear corners too.
        const corners = layout.panels[mode].corners;
        if (corners) {
            (window.ForecastNewPanelLayout.CORNER_KEYS || ['tl', 'tr', 'bl', 'br']).forEach((pos) => {
                const b = corners[pos];
                if (b && (b.source + ':' + b.view) === blockKey) corners[pos] = null;
            });
        }
    }

    function restoreCornerBlockToPanel(layout, mode, pos) {
        const block = layout.panels[mode].corners?.[pos];
        if (!block) return;
        const side = mode === 'single' || block.source === 'natal' ? 'left' : 'right';
        const tabs = layout.panels[mode][side];
        const matchingTab = tabs.find((tab) => tab.blocks.some((item) => item.view === block.view));
        if (matchingTab) matchingTab.blocks.push(block);
        else tabs.push({ id: window.ForecastNewPanelLayout.makeTabId(), title: null, blocks: [block] });
        layout.panels[mode].corners[pos] = null;
    }

    function mutateLayout(fn, { skipUndo, skipEditorRender } = {}) {
        const PL = window.ForecastNewPanelLayout;
        if (!skipUndo) state.layoutUndo = JSON.parse(JSON.stringify(state.panelLayout));
        fn(state.panelLayout);
        state.panelLayout = PL.normalizeLayout(state.panelLayout);
        renderPanels();
        if (!skipEditorRender) renderPanelEditor();
        scheduleLayoutPersist();
    }

    function findTab(layout, mode, side, tabId) {
        return (layout.panels[mode][side] || []).find((tb) => tb.id === tabId);
    }

    async function handleEditorAction(action, ds) {
        const PL = window.ForecastNewPanelLayout;
        const mode = currentWheelMode();
        const side = ds.side;
        const tabId = ds.tab;
        switch (action) {
            case 'add-tab':
                mutateLayout((l) => {
                    const title = t('page.forecastNew.panelEditor.newTabTitle') || 'Новая вкладка';
                    l.panels[mode][side].push({ id: PL.makeTabId(), title: title, blocks: [] });
                });
                break;
            case 'remove-tab':
                mutateLayout((l) => {
                    l.panels[mode][side] = l.panels[mode][side].filter((tb) => tb.id !== tabId);
                });
                announceUndo(t('page.forecastNew.panelEditor.tabRemoved') || 'Вкладка удалена');
                break;
            case 'rename-tab': {
                const value = ds.value != null ? ds.value : '';
                mutateLayout((l) => {
                    const tab = findTab(l, mode, side, tabId);
                    if (tab) tab.title = value.trim() ? value.trim() : null;
                }, { skipUndo: true });
                break;
            }
            case 'add-block':
                {
                const blockKey = `${mode === 'single' ? 'natal' : (ds.source || 'natal')}:${ds.view}`;
                const location = findBlockLocation(mode, blockKey);
                if (location && (location.side !== side || location.tab.id !== tabId)) {
                    const from = `${panelSideLabel(location.side, mode)} · ${window.ForecastNewPanelLayout.autoTabTitle(location.tab, t)}`;
                    const accepted = await showPanelDialog({
                        title: t('page.forecastNew.panelEditor.moveBlockTitle') || 'Переместить блок?',
                        copy: (t('page.forecastNew.panelEditor.moveBlockCopy', { location: from }) || `Блок уже находится в «${from}». Переместить его сюда?`),
                        confirmLabel: t('page.forecastNew.panelEditor.move') || 'Переместить',
                    });
                    if (!accepted) return;
                }
                mutateLayout((l) => {
                    const tab = findTab(l, mode, side, tabId);
                    if (!tab) return;
                    const source = mode === 'single' ? 'natal' : (ds.source || 'natal');
                    // Move-on-add: a block lives in exactly one place, so detach
                    // it from any current home before appending it here.
                    removeBlockFromMode(l, mode, source + ':' + ds.view);
                    const target = findTab(l, mode, side, tabId);
                    if (target) target.blocks.push({ source: source, view: ds.view });
                });
                announceUndo(t('page.forecastNew.panelEditor.blockMoved') || 'Блок перемещён');
                break;
                }
            case 'remove-block':
                mutateLayout((l) => {
                    const tab = findTab(l, mode, side, tabId);
                    if (!tab) return;
                    tab.blocks = tab.blocks.filter((b) => (b.source + ':' + b.view) !== ds.blockkey);
                });
                break;
            case 'set-corner':
                {
                const source = mode === 'single' ? 'natal' : (ds.source || 'natal');
                const blockKey = `${source}:${ds.view}`;
                const location = findBlockLocation(mode, blockKey);
                const existing = state.panelLayout.panels[mode].corners?.[ds.corner];
                const discouraged = PL.CORNER_DISCOURAGED_VIEWS.includes(ds.view);
                const copy = [
                    existing ? (t('page.forecastNew.panelEditor.widgetReplaceCopy') || 'Текущий виджет в этой позиции будет заменён.') : '',
                    discouraged ? (t('page.forecastNew.panelEditor.widgetDenseWarning') || 'Этот блок может быть трудно читать в компактном виде.') : '',
                ].filter(Boolean).join(' ');
                if (copy && !await showPanelDialog({
                    title: t('page.forecastNew.panelEditor.addWidgetTitle') || 'Добавить виджет вокруг карты?',
                    copy,
                    confirmLabel: existing ? (t('page.forecastNew.panelEditor.replace') || 'Заменить') : (t('page.forecastNew.panelEditor.move') || 'Переместить'),
                })) return;
                mutateLayout((l) => {
                    const pos = ds.corner;
                    if (!l.panels[mode].corners || !(pos in l.panels[mode].corners)) return;
                    // Move-on-set: a block lives in one slot, so detach it from any
                    // current home (panel tab or other corner) before placing here.
                    removeBlockFromMode(l, mode, source + ':' + ds.view);
                    l.panels[mode].corners[pos] = { source: source, view: ds.view };
                });
                announceUndo(location
                    ? (t('page.forecastNew.panelEditor.widgetMovedFrom', { location: blockLocationLabel(location, mode) }) || `Виджет добавлен, блок перемещён из «${blockLocationLabel(location, mode)}»`)
                    : (t('page.forecastNew.panelEditor.widgetAdded') || 'Виджет добавлен'));
                break;
                }
            case 'clear-corner':
                mutateLayout((l) => {
                    const pos = ds.corner;
                    restoreCornerBlockToPanel(l, mode, pos);
                });
                break;
            case 'clear-corners':
                mutateLayout((l) => {
                    (PL.CORNER_KEYS || ['tl', 'tr', 'bl', 'br']).forEach((pos) => restoreCornerBlockToPanel(l, mode, pos));
                });
                announceUndo(t('page.forecastNew.panelEditor.widgetsCleared') || 'Виджеты убраны');
                break;
            case 'reset':
                if (!await showPanelDialog({
                    title: t('page.forecastNew.panelEditor.reset') || 'Сбросить к стандартной',
                    copy: t('page.forecastNew.panelEditor.resetConfirm') || 'Сбросить раскладку панелей к стандартной?',
                    confirmLabel: t('page.forecastNew.panelEditor.reset') || 'Сбросить',
                    destructive: true,
                })) return;
                state.layoutUndo = JSON.parse(JSON.stringify(state.panelLayout));
                state.panelLayout = PL.normalizeLayout(PL.buildDefaultForecastNewLayout());
                const defaultTabs = PL.defaultActiveTabs(state.panelLayout);
                state.activeTab = { ...state.activeTab, ...defaultTabs };
                renderPanels();
                renderPanelEditor();
                scheduleLayoutPersist();
                announceUndo(t('page.forecastNew.panelEditor.workspaceReset') || 'Рабочее пространство сброшено');
                break;
            case 'undo':
                if (!state.layoutUndo) return;
                state.panelLayout = PL.normalizeLayout(state.layoutUndo);
                state.layoutUndo = null;
                renderPanels();
                renderPanelEditor();
                scheduleLayoutPersist();
                break;
            case 'close':
                togglePanelEditMode(false);
                break;
            case 'toggle-presets': {
                const wrap = document.querySelector('[data-pe-presets-wrap]');
                if (wrap) wrap.classList.toggle('is-open');
                return; // no re-render needed
            }
            case 'save-preset': {
                const name = await showPanelDialog({
                    title: t('page.forecastNew.panelEditor.saveAsNew') || 'Сохранить как новое',
                    copy: t('page.forecastNew.panelEditor.saveWorkspaceCopy') || 'Назовите рабочее пространство, чтобы быстро использовать его позже.',
                    inputLabel: t('page.forecastNew.panelEditor.workspaceName') || 'Название',
                    confirmLabel: t('page.forecastNew.panelEditor.save') || 'Сохранить',
                });
                if (!name) return;
                const PL2 = window.ForecastNewPanelLayout;
                const newPreset = { id: PL2.makeTabId(), name, layout: PL2.normalizeLayout(state.panelLayout) };
                state.panelPresets = [...(state.panelPresets || []), newPreset];
                renderPanelEditor();
                persistPanelPresets();
                break;
            }
            case 'load-preset': {
                const preset = (state.panelPresets || []).find((p) => p.id === ds.presetId);
                if (!preset) return;
                state.layoutUndo = JSON.parse(JSON.stringify(state.panelLayout));
                applyPanelLayout(preset.layout);
                renderPanelEditor();
                scheduleLayoutPersist();
                announceUndo(t('page.forecastNew.panelEditor.presetLoaded') || `Загружено: ${preset.name}`);
                break;
            }
            case 'delete-preset': {
                const idx = (state.panelPresets || []).findIndex((p) => p.id === ds.presetId);
                if (idx === -1) return;
                const deleted = state.panelPresets[idx];
                if (!await showPanelDialog({
                    title: t('page.forecastNew.panelEditor.deleteWorkspaceTitle') || 'Удалить рабочее пространство?',
                    copy: `«${deleted.name}»`,
                    confirmLabel: t('common.delete') || 'Удалить',
                    destructive: true,
                })) return;
                state.panelPresets = state.panelPresets.filter((_, i) => i !== idx);
                renderPanelEditor();
                persistPanelPresets();
                announceUndo(`${escapeHtml(deleted.name)} ${t('page.forecastNew.panelEditor.presetDeleted') || 'удалено'}`);
                break;
            }
            case 'apply-workspace': {
                const workspace = PL.BUILTIN_WORKSPACES.find((item) => item.id === ds.workspaceId);
                if (!workspace) return;
                state.layoutUndo = JSON.parse(JSON.stringify(state.panelLayout));
                const built = PL.buildBuiltinWorkspaceLayout(workspace.id, state.panelLayout);
                state.panelLayout.panels[mode] = built.panels[mode];
                state.panelLayout = PL.normalizeLayout(state.panelLayout);
                renderPanels();
                renderPanelEditor();
                scheduleLayoutPersist();
                announceUndo(t('page.forecastNew.panelEditor.workspaceApplied') || 'Рабочее пространство применено');
                break;
            }
            case 'retry-save':
                persistPanelLayout();
                break;
            default:
                break;
        }
    }

    function announceUndo(message) {
        const editor = document.getElementById('forecastNewPanelEditor');
        const slot = editor?.querySelector('[data-pe-undo-slot]');
        if (!slot) return;
        slot.textContent = message;
        syncUndoButton();
        clearTimeout(state._undoTimer);
        state._undoTimer = setTimeout(() => { if (slot) slot.textContent = ''; }, 8000);
    }

    function syncUndoButton() {
        const button = document.querySelector('[data-pe-action="undo"]');
        if (button) button.disabled = !state.layoutUndo;
    }

    function injectPanelEditorStyles() {
        if (document.getElementById('forecastNewPanelEditorStyles')) return;
        const css = `
        body.forecast-new-panel-edit .forecast-new-side-panel{outline:2px dashed rgba(120,120,200,.45);outline-offset:-2px}
        .forecast-new-block-header{position:sticky;top:0;z-index:2;font-size:11px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;opacity:.65;padding:6px 8px 4px;background:var(--surface,#fff)}
        .forecast-new-block{border-top:1px solid rgba(120,120,140,.18)}
        .forecast-new-block:first-child{border-top:0}
        #forecastNewPanelEditor{position:fixed;right:16px;bottom:16px;width:min(560px,92vw);max-height:78vh;overflow:auto;z-index:9999;background:var(--surface,#fff);color:var(--text,#1a1a2e);border:1px solid rgba(120,120,160,.3);border-radius:14px;box-shadow:0 18px 48px rgba(20,20,50,.28);font-size:13px}
        #forecastNewPanelEditor.hidden{display:none}
        .forecast-new-pe-header{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid rgba(120,120,160,.18);position:sticky;top:0;background:inherit;z-index:3}
        .forecast-new-pe-header strong{font-size:14px}
        .forecast-new-pe-mode{font-size:11px;opacity:.6;padding:2px 8px;border-radius:99px;background:rgba(120,120,200,.12)}
        .forecast-new-pe-close{margin-left:auto;border:0;background:transparent;cursor:pointer;font-size:16px;opacity:.6}
        .forecast-new-pe-body{display:grid;grid-template-columns:1fr minmax(150px,0.8fr) 1fr;gap:12px;padding:12px 14px}
        @media (max-width:640px){.forecast-new-pe-body{grid-template-columns:1fr}}
        .forecast-new-pe-corners-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
        .forecast-new-pe-corner{border:1px solid rgba(120,120,160,.22);border-radius:10px;padding:6px;background:rgba(140,140,180,.05);min-height:54px;display:flex;flex-direction:column;gap:4px}
        .forecast-new-pe-corner-label{font-size:11px;opacity:.6;font-weight:600}
        .forecast-new-pe-corner-blocks{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;min-height:16px}
        .forecast-new-pe-corner-add{width:100%;padding:4px 5px;border:1px dashed rgba(120,120,160,.4);border-radius:6px;background:transparent;cursor:pointer;color:inherit;font-size:11px}
        .forecast-new-pe-side-head{font-weight:600;margin-bottom:6px;opacity:.8}
        .forecast-new-pe-tab{position:relative;border:1px solid rgba(120,120,160,.22);border-radius:10px;padding:8px;margin-bottom:8px;background:rgba(140,140,180,.05)}
        .forecast-new-pe-tab-head{display:flex;gap:6px;align-items:center}
        .forecast-new-pe-title{flex:1;min-width:0;padding:4px 6px;border:1px solid rgba(120,120,160,.3);border-radius:6px;background:var(--surface,#fff);color:inherit}
        .forecast-new-pe-tab-remove,.forecast-new-pe-block-remove{flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border:0;border-radius:999px;background:transparent;color:inherit;cursor:pointer;font-size:11px;line-height:1;opacity:0;transition:opacity .15s,background .15s}
        .forecast-new-pe-tab:hover .forecast-new-pe-tab-remove,.forecast-new-pe-tab:focus-within .forecast-new-pe-tab-remove,.forecast-new-pe-block:hover .forecast-new-pe-block-remove,.forecast-new-pe-block:focus-within .forecast-new-pe-block-remove{opacity:.7}
        .forecast-new-pe-tab-remove:hover,.forecast-new-pe-block-remove:hover{opacity:1!important;background:rgba(200,80,80,.16);color:#c25}
        .forecast-new-pe-blocks{list-style:none;margin:8px 0 6px;padding:0;display:flex;flex-direction:column;gap:4px;min-height:18px}
        .forecast-new-pe-block{display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:6px;background:rgba(120,120,200,.07)}
        .forecast-new-pe-block-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .forecast-new-pe-tab-grip,.forecast-new-pe-block-grip{cursor:grab;opacity:.4;font-size:13px;line-height:1;user-select:none;padding:0 2px;flex-shrink:0}
        .forecast-new-pe-tab-grip:hover,.forecast-new-pe-block-grip:hover{opacity:.75}
        .forecast-new-pe-tab-grip:active,.forecast-new-pe-block-grip:active{cursor:grabbing}
        .forecast-new-pe-ghost{opacity:.4;background:rgba(120,120,200,.22)!important}
        .forecast-new-pe-chosen{box-shadow:0 0 0 2px rgba(120,120,200,.45)}
        .forecast-new-pe-add-block,.forecast-new-pe-add-tab{width:100%;margin-top:4px;padding:5px 6px;border:1px dashed rgba(120,120,160,.4);border-radius:6px;background:transparent;cursor:pointer;color:inherit;font-size:12px}
        .forecast-new-pe-add-tab[disabled]{opacity:.4;cursor:not-allowed}
        .forecast-new-pe-footer{display:flex;align-items:center;gap:6px;padding:10px 14px;border-top:1px solid rgba(120,120,160,.18);position:sticky;bottom:0;background:inherit}
        .forecast-new-pe-footer span[data-pe-undo-slot]{flex:1;font-size:12px;opacity:.85}
        .forecast-new-pe-preset-save{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border:1px solid rgba(120,120,160,.3);background:var(--surface,#fff);border-radius:8px;cursor:pointer;color:inherit;flex-shrink:0}
        .forecast-new-pe-preset-save:hover{background:rgba(120,120,200,.08)}
        .forecast-new-pe-presets-wrap{position:relative;flex-shrink:0}
        .forecast-new-pe-presets-toggle{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border:1px solid rgba(120,120,160,.3);background:var(--surface,#fff);border-radius:8px;cursor:pointer;color:inherit}
        .forecast-new-pe-presets-toggle:hover{background:rgba(120,120,200,.08)}
        .forecast-new-pe-presets-wrap.is-open .forecast-new-pe-presets-toggle{background:rgba(120,120,200,.15);border-color:rgba(120,120,200,.5)}
        .forecast-new-pe-presets-dropdown{display:none;position:absolute;bottom:calc(100% + 6px);right:0;min-width:240px;background:var(--surface,#fff);border:1px solid rgba(120,120,160,.25);border-radius:10px;box-shadow:0 8px 24px rgba(20,20,50,.16);padding:6px;z-index:10}
        .forecast-new-pe-presets-wrap.is-open .forecast-new-pe-presets-dropdown{display:flex;flex-direction:column;gap:4px}
        .forecast-new-pe-presets-empty{font-size:12px;opacity:.5;padding:6px 8px}
        .forecast-new-pe-preset{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;border-radius:7px;background:rgba(120,120,180,.06);border:1px solid rgba(120,120,160,.12)}
        .forecast-new-pe-preset-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
        .forecast-new-pe-preset-actions{display:flex;gap:4px;flex-shrink:0}
        .forecast-new-pe-preset-load{border:1px solid rgba(120,120,200,.4);background:transparent;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:11px;color:inherit}
        .forecast-new-pe-preset-load:hover{background:rgba(120,120,200,.12)}
        .forecast-new-pe-preset-delete{border:1px solid rgba(200,80,80,.3);background:transparent;border-radius:6px;width:22px;height:22px;cursor:pointer;font-size:11px;color:#c25;line-height:1}
        .forecast-new-pe-reset{border:1px solid rgba(200,80,80,.4);color:#c25;background:transparent;border-radius:8px;padding:6px 10px;cursor:pointer;flex-shrink:0}
        .forecast-new-pe-link{border:0;background:transparent;color:#46c;cursor:pointer;text-decoration:underline;padding:0;font:inherit}
        .forecast-new-panel-edit-btn.is-active{background:rgba(120,120,200,.2)}`;
        const style = document.createElement('style');
        style.id = 'forecastNewPanelEditorStyles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    function ensurePanelEditor() {
        let editor = document.getElementById('forecastNewPanelEditor');
        if (editor) return editor;
        editor = document.createElement('div');
        editor.id = 'forecastNewPanelEditor';
        editor.className = 'forecast-new-panel-editor hidden';
        document.body.appendChild(editor);
        editor.addEventListener('click', (event) => {
            // Only buttons act on click. The add-block <select> also carries a
            // data-pe-action but must be handled via 'change' — otherwise the
            // click that opens its dropdown would mutate the layout and re-render
            // the editor, closing the dropdown before a choice is made.
            const btn = event.target.closest('button[data-pe-action]');
            if (!btn) return;
            void handleEditorAction(btn.dataset.peAction, { ...btn.dataset }).catch((error) => {
                console.error('Panel editor action failed:', error);
            });
        });
        editor.addEventListener('change', (event) => {
            const sel = event.target.closest('select[data-pe-action="add-block"]');
            if (sel) {
                const value = sel.value;
                const [source, view] = value.split(':');
                sel.value = '';
                if (view) void handleEditorAction('add-block', { side: sel.dataset.side, tab: sel.dataset.tab, source, view });
                return;
            }
            const cornerSel = event.target.closest('select[data-pe-action="set-corner"]');
            if (cornerSel) {
                const [source, view] = cornerSel.value.split(':');
                cornerSel.value = '';
                if (view) void handleEditorAction('set-corner', { corner: cornerSel.dataset.corner, source, view });
            }
        });
        editor.addEventListener('input', (event) => {
            const input = event.target.closest('input[data-pe-action="rename-tab"]');
            if (!input) return;
            // Update state without re-rendering the editor — re-rendering would
            // destroy the focused input, losing the caret after every keystroke.
            const mode = currentWheelMode();
            const { side, tab: tabId } = input.dataset;
            const value = input.value;
            mutateLayout((l) => {
                const tab = findTab(l, mode, side, tabId);
                if (tab) tab.title = value.trim() ? value.trim() : null;
            }, { skipUndo: true, skipEditorRender: true });
        });
        editor.addEventListener('keydown', (event) => {
            const input = event.target.closest('input[data-pe-action="rename-tab"]');
            if (input && event.key === 'Enter') { input.blur(); }
            if (event.key === 'Escape') togglePanelEditMode(false);
        });
        editor.addEventListener('blur', (event) => {
            const input = event.target.closest('input[data-pe-action="rename-tab"]');
            if (input) renderPanelEditor();
        }, true);
        editor.addEventListener('mouseover', previewEditorTarget);
        editor.addEventListener('focusin', previewEditorTarget);
        editor.addEventListener('mouseout', (event) => {
            if (!editor.contains(event.relatedTarget)) clearEditorPreview();
            else if (event.target.closest('.forecast-new-pe-tab') !== event.relatedTarget?.closest?.('.forecast-new-pe-tab')) {
                clearEditorPreview();
            }
        });
        editor.addEventListener('focusout', (event) => {
            if (!editor.contains(event.relatedTarget)) clearEditorPreview();
        });
        return editor;
    }

    function clearEditorPreview() {
        document.querySelectorAll('.forecast-new-pe-preview').forEach((node) => node.classList.remove('forecast-new-pe-preview'));
    }

    function previewEditorTarget(event) {
        const editorCorner = event.target.closest('.forecast-new-pe-corner[data-corner]');
        if (editorCorner) {
            clearEditorPreview();
            document.getElementById(window.ForecastNewPanelLayout.CORNER_CONTAINER_IDS[editorCorner.dataset.corner])?.classList.add('forecast-new-pe-preview');
            return;
        }
        const editorTab = event.target.closest('.forecast-new-pe-tab');
        if (!editorTab) {
            clearEditorPreview();
            return;
        }
        clearEditorPreview();
        const side = editorTab.closest('.forecast-new-pe-side')?.dataset.side;
        const panel = document.getElementById(PANEL_SIDE_IDS[side]);
        panel?.querySelector(`.panel-tab[data-tab-id="${editorTab.dataset.tab}"]`)?.classList.add('forecast-new-pe-preview');
        const editorBlock = event.target.closest('.forecast-new-pe-block[data-blockkey]');
        if (!editorBlock) return;
        const meta = window.ForecastNewPanelLayout.BLOCK_TARGET_MAP[editorBlock.dataset.blockkey];
        document.getElementById(meta?.containerId)?.classList.add('forecast-new-pe-preview');
    }

    function renderTabEditorCard(tab, side, mode) {
        const PL = window.ForecastNewPanelLayout;
        const title = tab.title != null ? tab.title : '';
        const placeholder = escapeHtml(PL.autoTabTitle(tab, t));
        const blocksHtml = tab.blocks.map((b) => `
            <li class="forecast-new-pe-block" data-blockkey="${b.source}:${b.view}" tabindex="0">
                <span class="forecast-new-pe-block-grip" title="${escapeHtml(t('page.forecastNew.panelEditor.dragHint') || 'Перетащить')}" aria-label="${escapeHtml(t('page.forecastNew.panelEditor.dragHint') || 'Перетащить')}" role="button">⠿</span>
                <span class="forecast-new-pe-block-label">${escapeHtml(blockLabel(b))}</span>
                <button type="button" class="forecast-new-pe-block-remove" data-pe-action="remove-block" data-side="${side}" data-tab="${tab.id}" data-blockkey="${b.source}:${b.view}" title="${escapeHtml(t('common.delete') || 'Удалить')}" aria-label="${escapeHtml(t('common.delete') || 'Удалить')}">✕</button>
            </li>`).join('');
        // Offer the whole catalog except blocks already in THIS tab. Adding a
        // block placed elsewhere moves it here.
        const inThisTab = new Set(tab.blocks.map((b) => b.source + ':' + b.view));
        const avail = allBlocksForMode(mode).filter((b) => !inThisTab.has(b.source + ':' + b.view));
        const addOptions = Object.entries(VIEW_GROUPS).map(([group, views]) => {
            const options = avail.filter((block) => views.includes(block.view))
                .map((block) => `<option value="${block.source}:${block.view}">${escapeHtml(blockLabel(block))}</option>`).join('');
            return options ? `<optgroup label="${escapeHtml(t(`page.forecastNew.panelEditor.groups.${group}`) || group)}">${options}</optgroup>` : '';
        }).join('');
        const addSelect = avail.length
            ? `<select class="forecast-new-pe-add-block" data-pe-action="add-block" data-side="${side}" data-tab="${tab.id}"><option value="">+ ${escapeHtml(t('page.forecastNew.panelEditor.addBlock') || 'Добавить блок')}</option>${addOptions}</select>`
            : '';
        return `
            <div class="forecast-new-pe-tab" data-tab="${tab.id}">
                <div class="forecast-new-pe-tab-head">
                    <span class="forecast-new-pe-tab-grip" title="${escapeHtml(t('page.forecastNew.panelEditor.dragHint') || 'Перетащить')}" aria-label="${escapeHtml(t('page.forecastNew.panelEditor.dragHint') || 'Перетащить')}" role="button">⠿</span>
                    <input type="text" class="forecast-new-pe-title" data-pe-action="rename-tab" data-side="${side}" data-tab="${tab.id}" value="${escapeHtml(title)}" placeholder="${placeholder}">
                    <button type="button" class="forecast-new-pe-tab-remove" data-pe-action="remove-tab" data-side="${side}" data-tab="${tab.id}" title="${escapeHtml(t('common.delete') || 'Удалить')}" aria-label="${escapeHtml(t('common.delete') || 'Удалить')}">✕</button>
                </div>
                <ul class="forecast-new-pe-blocks">${blocksHtml}</ul>
                ${addSelect}
            </div>`;
    }

    function renderPanelEditorSide(side, mode) {
        const tabs = state.panelLayout.panels[mode][side] || [];
        const head = panelSideLabel(side, mode);
        return `
            <div class="forecast-new-pe-side" data-side="${side}">
                <div class="forecast-new-pe-side-head">${escapeHtml(head)}</div>
                ${tabs.map((tab) => renderTabEditorCard(tab, side, mode)).join('')}
                <button type="button" class="forecast-new-pe-add-tab" data-pe-action="add-tab" data-side="${side}">+ ${escapeHtml(t('page.forecastNew.panelEditor.addTab') || 'Вкладка')}</button>
            </div>`;
    }

    // The four chart-corner slots, laid out as a 2×2 grid that mirrors the
    // physical screen positions (tl/tr over bl/br). Each slot holds 0 or 1 block.
    const CORNER_LABEL_I18N = {
        tl: 'page.forecastNew.panelEditor.cornerTl',
        tr: 'page.forecastNew.panelEditor.cornerTr',
        bl: 'page.forecastNew.panelEditor.cornerBl',
        br: 'page.forecastNew.panelEditor.cornerBr',
    };
    const CORNER_LABEL_FALLBACK = { tl: '↖', tr: '↗', bl: '↙', br: '↘' };

    function renderCornerSlot(pos, mode) {
        const PL = window.ForecastNewPanelLayout;
        const corners = state.panelLayout.panels[mode].corners || PL.emptyCorners();
        const block = corners[pos] || null;
        const labelKey = CORNER_LABEL_I18N[pos];
        let label = labelKey ? t(labelKey) : '';
        if (!label || label === labelKey) label = CORNER_LABEL_FALLBACK[pos];
        const blockLi = block ? `
            <li class="forecast-new-pe-block" data-blockkey="${block.source}:${block.view}">
                <span class="forecast-new-pe-block-grip" aria-hidden="true">⠿</span>
                <span class="forecast-new-pe-block-label">${escapeHtml(blockLabel(block))}</span>
                <button type="button" class="forecast-new-pe-block-remove" data-pe-action="clear-corner" data-corner="${pos}" title="${escapeHtml(t('common.delete') || 'Удалить')}" aria-label="${escapeHtml(t('common.delete') || 'Удалить')}">✕</button>
            </li>` : '';
        const avail = allBlocksForMode(mode).filter((b) => !block || (b.source + ':' + b.view) !== (block.source + ':' + block.view));
        const optionGroup = (labelKey, views) => {
            const options = avail.filter((item) => views.includes(item.view))
                .map((item) => `<option value="${item.source}:${item.view}">${escapeHtml(blockLabel(item))}</option>`).join('');
            return options ? `<optgroup label="${escapeHtml(t(labelKey) || labelKey)}">${options}</optgroup>` : '';
        };
        const addOptions = [
            optionGroup('page.forecastNew.panelEditor.widgetRecommended', PL.CORNER_RECOMMENDED_VIEWS),
            optionGroup('page.forecastNew.panelEditor.widgetCompactTables', PL.CORNER_COMPACT_VIEWS),
            optionGroup('page.forecastNew.panelEditor.widgetOther', PL.CORNER_DISCOURAGED_VIEWS),
        ].join('');
        const addSelect = `<select class="forecast-new-pe-corner-add" data-pe-action="set-corner" data-corner="${pos}"><option value="">+ ${escapeHtml(block ? (t('page.forecastNew.panelEditor.replaceWidget') || 'Заменить виджет') : (t('page.forecastNew.panelEditor.addWidget') || 'Добавить виджет'))}</option>${addOptions}</select>`;
        return `
            <div class="forecast-new-pe-corner" data-corner="${pos}">
                <div class="forecast-new-pe-corner-label">${escapeHtml(label)}</div>
                <ul class="forecast-new-pe-corner-blocks" data-corner="${pos}">${blockLi}</ul>
                ${addSelect}
            </div>`;
    }

    function renderPanelEditorCorners(mode) {
        const PL = window.ForecastNewPanelLayout;
        const head = t('page.forecastNew.panelEditor.corners') || 'Виджеты вокруг карты';
        const count = (PL.CORNER_KEYS || ['tl', 'tr', 'bl', 'br']).filter((pos) => state.panelLayout.panels[mode].corners?.[pos]).length;
        const slots = (PL.CORNER_KEYS || ['tl', 'tr', 'bl', 'br']).map((pos) => renderCornerSlot(pos, mode)).join('');
        return `
            <div class="forecast-new-pe-corners">
                <div class="forecast-new-pe-side-head">${escapeHtml(head)} <span class="forecast-new-pe-corner-count">${count}/4</span></div>
                <p class="forecast-new-pe-corners-copy">${escapeHtml(t('page.forecastNew.panelEditor.cornersCopy') || 'Закрепите компактные показатели рядом с колесом.')}</p>
                <div class="forecast-new-pe-corner-stage"><div class="forecast-new-pe-corner-wheel" aria-hidden="true">◎</div><div class="forecast-new-pe-corners-grid">${slots}</div></div>
                <button type="button" class="forecast-new-pe-clear-corners" data-pe-action="clear-corners" ${count ? '' : 'disabled'}>${escapeHtml(t('page.forecastNew.panelEditor.clearWidgets') || 'Очистить все виджеты')}</button>
            </div>`;
    }

    function renderPanelEditor() {
        if (!state.panelEditMode || !state.panelLayout) return;
        const editor = ensurePanelEditor();
        destroyEditorDnd(); // tear down stale Sortable instances before replacing innerHTML
        const mode = currentWheelMode();
        const modeLabel = mode === 'single'
            ? (t('page.forecastNew.panelEditor.chartData') || 'Данные карты')
            : (t('page.forecastNew.panelEditor.comparisonMode') || 'Режим сравнения');
        const presets = state.panelPresets || [];
        const builtinHtml = window.ForecastNewPanelLayout.BUILTIN_WORKSPACES.map((workspace) => `
            <button type="button" class="forecast-new-pe-workspace" data-pe-action="apply-workspace" data-workspace-id="${workspace.id}">
                ${escapeHtml(t(workspace.labelKey) || workspace.id)}
            </button>`).join('');
        const presetsHtml = presets.length === 0
            ? `<div class="forecast-new-pe-presets-empty">${escapeHtml(t('page.forecastNew.panelEditor.presetsEmpty') || 'Нет сохранённых конфигураций')}</div>`
            : presets.map((p) => `
                <div class="forecast-new-pe-preset">
                    <span class="forecast-new-pe-preset-name">${escapeHtml(p.name)}</span>
                    <div class="forecast-new-pe-preset-actions">
                        <button type="button" class="forecast-new-pe-preset-load" data-pe-action="load-preset" data-preset-id="${escapeHtml(p.id)}">${escapeHtml(t('page.forecastNew.panelEditor.presetLoad') || 'Загрузить')}</button>
                        <button type="button" class="forecast-new-pe-preset-delete" data-pe-action="delete-preset" data-preset-id="${escapeHtml(p.id)}" title="${escapeHtml(t('common.delete') || 'Удалить')}" aria-label="${escapeHtml(t('common.delete') || 'Удалить')}">✕</button>
                    </div>
                </div>`).join('');
        editor.innerHTML = `
            <div class="forecast-new-pe-header">
                <div><strong>${escapeHtml(t('page.forecastNew.panelEditor.title') || 'Настройка рабочего пространства')}</strong>
                <p>${escapeHtml(t('page.forecastNew.panelEditor.instructions') || 'Перетаскивайте вкладки и блоки между областями.')}</p></div>
                <span class="forecast-new-pe-mode">${escapeHtml(modeLabel)}</span>
                <button type="button" class="forecast-new-pe-primary forecast-new-pe-close" data-pe-action="close">${escapeHtml(t('page.forecastNew.panelEditor.done') || 'Готово')}</button>
            </div>
            <div class="forecast-new-pe-workspaces">
                <div><span class="forecast-new-pe-kicker">${escapeHtml(t('page.forecastNew.panelEditor.builtinWorkspaces') || 'Готовые рабочие пространства')}</span><div class="forecast-new-pe-workspace-list">${builtinHtml}</div></div>
                <div class="forecast-new-pe-saved-workspaces">
                    <div class="forecast-new-pe-saved-head">
                        <span class="forecast-new-pe-kicker">${escapeHtml(t('page.forecastNew.panelEditor.myWorkspaces') || 'Мои рабочие пространства')}</span>
                        <button type="button" class="forecast-new-pe-save-preset" data-pe-action="save-preset">${escapeHtml(t('page.forecastNew.panelEditor.save') || 'Сохранить')}</button>
                    </div>
                    <div class="forecast-new-pe-preset-list">${presetsHtml}</div>
                </div>
            </div>
            <div class="forecast-new-pe-body">
                ${renderPanelEditorSide('left', mode)}
                ${renderPanelEditorCorners(mode)}
                ${renderPanelEditorSide('right', mode)}
            </div>
            <div class="forecast-new-pe-footer">
                <span data-pe-save-status aria-live="polite"></span>
                <span data-pe-undo-slot aria-live="polite"></span>
                <button type="button" class="forecast-new-pe-secondary forecast-new-pe-undo-button" data-pe-action="undo">${escapeHtml(t('page.forecastNew.panelEditor.undo') || 'Отменить')}</button>
                <button type="button" class="forecast-new-pe-reset" data-pe-action="reset">${escapeHtml(t('page.forecastNew.panelEditor.reset') || 'Сбросить к стандартной')}</button>
            </div>`;
        setPanelSaveState(state.panelSaveState);
        syncUndoButton();
        initEditorDnd();
    }

    // ---- drag-and-drop for the panel configurator (SortableJS) ----
    function destroyEditorDnd() {
        (state._editorSortables || []).forEach((s) => { try { s.destroy(); } catch (_) { /* ignore */ } });
        state._editorSortables = [];
    }

    function initEditorDnd() {
        if (!window.Sortable) return;
        destroyEditorDnd();
        const editor = document.getElementById('forecastNewPanelEditor');
        if (!editor) return;
        state._editorSortables = [];
        // Defer commit to next tick so we never destroy a Sortable instance
        // synchronously inside its own onEnd handler.
        const commit = () => setTimeout(commitLayoutFromEditorDom, 0);
        // Tabs: each panel side is a sortable list of tab cards; shared group
        // lets a tab move between the left and right panels.
        editor.querySelectorAll('.forecast-new-pe-side').forEach((sideEl) => {
            state._editorSortables.push(window.Sortable.create(sideEl, {
                group: 'fn-tabs',
                draggable: '.forecast-new-pe-tab',
                handle: '.forecast-new-pe-tab-grip',
                animation: 150,
                ghostClass: 'forecast-new-pe-ghost',
                chosenClass: 'forecast-new-pe-chosen',
                onEnd: commit,
            }));
        });
        // Blocks: each tab's <ul> is a sortable list; shared group lets a block
        // move between tabs and across panels.
        editor.querySelectorAll('.forecast-new-pe-blocks').forEach((ul) => {
            state._editorSortables.push(window.Sortable.create(ul, {
                group: 'fn-blocks',
                handle: '.forecast-new-pe-block-grip',
                animation: 150,
                ghostClass: 'forecast-new-pe-ghost',
                chosenClass: 'forecast-new-pe-chosen',
                onEnd: commit,
            }));
        });
        // Corner slots: same block group so a block drags between a panel and a
        // corner (move-on-drop = Option C). put() caps each corner at one block.
        editor.querySelectorAll('.forecast-new-pe-corner-blocks').forEach((ul) => {
            state._editorSortables.push(window.Sortable.create(ul, {
                group: { name: 'fn-blocks', pull: true, put: (to) => to.el.children.length < 1 },
                handle: '.forecast-new-pe-block-grip',
                animation: 150,
                ghostClass: 'forecast-new-pe-ghost',
                chosenClass: 'forecast-new-pe-chosen',
                onEnd: commit,
            }));
        });
    }

    // Rebuild the current wheel mode's panels from the editor DOM order after a
    // drag, then normalize/render/persist. The other mode is left untouched.
    function readPanelEditorDom(mode) {
        const PL = window.ForecastNewPanelLayout;
        const editor = document.getElementById('forecastNewPanelEditor');
        const result = { left: [], right: [], corners: PL.emptyCorners() };
        if (!editor) return result;
        ['left', 'right'].forEach((side) => {
            const sideEl = editor.querySelector(`.forecast-new-pe-side[data-side="${side}"]`);
            if (!sideEl) return;
            sideEl.querySelectorAll('.forecast-new-pe-tab').forEach((tabEl) => {
                const id = tabEl.dataset.tab || null;
                const input = tabEl.querySelector('.forecast-new-pe-title');
                const titleRaw = input ? input.value.trim() : '';
                const blocks = [];
                tabEl.querySelectorAll('.forecast-new-pe-block').forEach((li) => {
                    const key = li.dataset.blockkey || '';
                    const [source, view] = key.split(':');
                    if (source && view) blocks.push({ source, view });
                });
                result[side].push({ id, title: titleRaw || null, blocks });
            });
        });
        // Corners: read the FIRST block in each corner slot (max 1).
        (PL.CORNER_KEYS || ['tl', 'tr', 'bl', 'br']).forEach((pos) => {
            const slot = editor.querySelector(`.forecast-new-pe-corner-blocks[data-corner="${pos}"]`);
            if (!slot) return;
            const li = slot.querySelector('.forecast-new-pe-block');
            if (!li) return;
            const [source, view] = (li.dataset.blockkey || '').split(':');
            if (source && view) result.corners[pos] = { source, view };
        });
        return result;
    }

    function commitLayoutFromEditorDom() {
        const PL = window.ForecastNewPanelLayout;
        if (!PL || !state.panelLayout) return;
        const mode = currentWheelMode();
        const dom = readPanelEditorDom(mode);
        state.layoutUndo = JSON.parse(JSON.stringify(state.panelLayout));
        state.panelLayout.panels[mode] = { left: dom.left, right: dom.right, corners: dom.corners };
        state.panelLayout = PL.normalizeLayout(state.panelLayout);
        renderPanels();
        renderPanelEditor();
        scheduleLayoutPersist();
    }

    function togglePanelEditMode(force) {
        const next = typeof force === 'boolean' ? force : !state.panelEditMode;
        state.panelEditMode = next;
        document.body.classList.toggle('forecast-new-panel-edit', next);
        const toggle = document.getElementById('forecastNewPanelEditToggle');
        if (toggle) toggle.setAttribute('aria-pressed', next ? 'true' : 'false');
        toggle?.classList.toggle('is-active', next);
        const editor = ensurePanelEditor();
        editor.classList.toggle('hidden', !next);
        if (next) {
            state.panelEditReturnFocus = document.activeElement;
            renderPanelEditor();
            setTimeout(() => editor.querySelector('.forecast-new-pe-close')?.focus(), 0);
        } else {
            destroyEditorDnd();
            state.panelEditReturnFocus?.focus?.();
            state.panelEditReturnFocus = null;
        }
    }

    function bindPanelConfigurator() {
        const toggle = document.getElementById('forecastNewPanelEditToggle');
        toggle?.addEventListener('click', () => togglePanelEditMode());
        document.querySelector('.forecast-new-center')?.addEventListener('click', (event) => {
            const remove = event.target.closest('[data-corner-remove]');
            if (!remove) return;
            event.stopPropagation();
            const mode = currentWheelMode();
            mutateLayout((layout) => {
                restoreCornerBlockToPanel(layout, mode, remove.dataset.cornerRemove);
            });
        });
    }

    // ---- panel presets (named saved configurations) ----
    function normalizePanelPresets(raw) {
        if (!Array.isArray(raw)) return [];
        const PL = window.ForecastNewPanelLayout;
        return raw.reduce((out, item) => {
            if (!item || typeof item !== 'object') return out;
            const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : null;
            if (!name) return out;
            const id = typeof item.id === 'string' && item.id ? item.id : PL.makeTabId();
            const layout = item.layout && typeof item.layout === 'object'
                ? PL.normalizeLayout(item.layout) : null;
            if (!layout) return out;
            out.push({ id, name, layout });
            return out;
        }, []);
    }

    function persistPanelPresets() {
        if (!window.AstroAPI?.patchAccountPreferences || !state.userId) return;
        const presets = (state.panelPresets || []).map(({ id, name, layout }) => ({ id, name, layout }));
        window.AstroAPI.patchAccountPreferences({
            chart_defaults: { forecast_new: { panel_presets: presets } },
        }).catch((err) => console.warn('Panel presets save failed:', err));
    }

    // ---- persistence of panel layout (account-level default) ----
    function scheduleLayoutPersist() {
        state.panelLayoutDirty = true;
        setPanelSaveState('saving');
        clearTimeout(state._layoutPersistTimer);
        state._layoutPersistTimer = setTimeout(persistPanelLayout, 600);
    }

    function persistPanelLayout() {
        const PL = window.ForecastNewPanelLayout;
        if (!PL || !state.panelLayout) return;
        const layout = PL.normalizeLayout(state.panelLayout);
        state.panelLayout = layout;
        if (!window.AstroAPI?.patchAccountPreferences || !state.userId) {
            setPanelSaveState('saved');
            return;
        }
        setPanelSaveState('saving');
        const seq = ++state.layoutPersistSeq;
        window.AstroAPI.patchAccountPreferences({
            chart_defaults: { forecast_new: { panels: layout } },
        }).then(() => {
            if (seq === state.layoutPersistSeq) {
                state.panelLayoutDirty = false;
                setPanelSaveState('saved');
            }
        }).catch((err) => {
            state.panelLayoutDirty = true;
            setPanelSaveState('error');
            console.warn('Forecast New panel layout save failed:', err);
            announceUndo(t('page.forecastNew.panelEditor.saveFailed') || 'Не удалось сохранить раскладку');
        });
    }

    function flushLayoutPersist() {
        if (!state.panelLayoutDirty) return;
        clearTimeout(state._layoutPersistTimer);
        persistPanelLayout();
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
        state.directionType = normalizeDirectionType(restored.directionType || state.directionType);
        state.stepMode = restored.stepMode || state.stepMode;
        state.customStep = normalizeCustomStep(restored.customStep || state.customStep);
        state.wheelView = restored.wheelView === 'single' ? 'single' : 'multi';
        state.resultView = 'wheel';
        const restoredSolarYear = Number(restored.solarYear);
        if (Number.isFinite(restoredSolarYear) && restoredSolarYear >= 1900 && restoredSolarYear <= 2100) {
            state.solarYear = Math.trunc(restoredSolarYear);
        }
        if (restored.solarLocation && typeof restored.solarLocation === 'object') {
            const lat = Number(restored.solarLocation.latitude);
            const lon = Number(restored.solarLocation.longitude);
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
                state.solarLocation = {
                    name: restored.solarLocation.name || '',
                    latitude: lat,
                    longitude: lon,
                    timezone: restored.solarLocation.timezone || null,
                    sourceId: restored.solarLocation.sourceId || null,
                };
                if (refs.forecastNewSolarLocationInput) refs.forecastNewSolarLocationInput.value = state.solarLocation.name;
                if (refs.forecastNewSolarLat) refs.forecastNewSolarLat.value = String(lat);
                if (refs.forecastNewSolarLon) refs.forecastNewSolarLon.value = String(lon);
            }
        }
        state.synastryPartnerId = typeof restored.synastryPartnerId === 'string' ? restored.synastryPartnerId : state.synastryPartnerId;
        state.synastryMode = restored.synastryMode === 'manual' ? 'manual' : 'db';
        state.synastryManual = (restored.synastryManual && typeof restored.synastryManual === 'object')
            ? restored.synastryManual
            : state.synastryManual;
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
            const draftResolved = window.AstroPreferences?.readChartViewDraft?.({
                chart_kind: 'natal',
                chart_id: state.userId,
                view_type: 'forecast_new',
            });
            const resolved = draftResolved || payload?.resolved || {};
            // Configurable panel layout (account default). resolved.panels is the
            // raw saved layout; applyPanelLayout normalizes + re-renders chrome.
            if (resolved && resolved.panels) applyPanelLayout(resolved.panels);
            // Named panel presets saved alongside the active layout.
            if (Array.isArray(resolved?.panel_presets)) {
                state.panelPresets = normalizePanelPresets(resolved.panel_presets);
            }
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
                houseNumberStyle: resolved?.view_options?.house_number_style === 'roman' ? 'roman' : 'arabic',
                houseLabelsOutside: resolved?.view_options?.house_labels_outside === true,
                aspectScope: ['all', 'major', 'minor'].includes(resolved?.aspects?.scope)
                    ? resolved.aspects.scope
                    : (state.pageSettings.aspectScope || 'major'),
                enabledAspectTypes: Array.isArray(resolved?.aspects?.enabled_types)
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
            if (draftResolved) {
                state.resolvedPreferences = {
                    ...state.resolvedPreferences,
                    resolved: draftResolved,
                };
                persistForecastNewViewOverrides().catch((error) => {
                    console.warn('Failed to replay Forecast New settings draft:', error);
                });
            }
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
                scope: state.pageSettings.aspectScope || 'major',
                enabled_types: Array.isArray(state.pageSettings.enabledAspectTypes)
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
        if (!state.userId || !window.AstroAPI?.patchAccountPreferences) return;
        const resolved = getResolvedForecastNewViewSettings();
        const draftMeta = {
            chart_kind: 'natal',
            chart_id: state.userId,
            view_type: 'forecast_new',
        };
        window.AstroPreferences?.saveChartViewDraft?.(draftMeta, resolved);

        await window.AstroAPI.patchAccountPreferences({
            chart_defaults: { forecast_new: resolved },
        });
        if (window.AstroAPI?.deleteChartViewOverride) {
            await window.AstroAPI.deleteChartViewOverride({
                chart_kind: 'natal',
                chart_id: state.userId,
                view_type: 'forecast_new',
            }).catch(() => null);
        }
        state.resolvedPreferences = {
            ...(state.resolvedPreferences || {}),
            account_defaults: resolved,
            overrides: {},
            resolved,
        };
        window.AstroPreferences?.clearChartViewDraft?.(draftMeta);
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
        const tab = params.get('tab');
        if (tab === 'biwheel') {
            state.wheelView = 'single';
            state.activeLayers = [];
            state.enabledLayers = [];
            state.selectedRightLayer = '';
            state.activeRightMethodTab = '';
            window.history.replaceState({}, '', window.location.pathname);
        }
        const date = params.get('date');
        const time = params.get('time');
        if (/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
            setSelectedDateTime(`${date}T${normalizeTime(time || splitTargetDatetime(state.selectedDateTime)[1])}`);
        }
        const directionType = params.get('directionType');
        if (directionType) {
            state.directionType = normalizeDirectionType(directionType);
        }
        const layer = params.get('layer');
        if (LAYER_ORDER.includes(layer)) {
            state.activeLayers = LAYER_ORDER.filter((method) => method === 'transit' || method === layer);
            state.enabledLayers = state.activeLayers;
            state.selectedRightLayer = layer;
            state.activeRightMethodTab = layer;
        }
        // Synastry deep-link (from clients / client-profile / related-people): preselect
        // the partner so the synastry_partner layer loads on cold open.
        const partner = params.get('partner');
        if (partner && layer === 'synastry_partner') {
            state.synastryPartnerId = String(partner);
            state.synastryMode = 'db';
        }
        // Solar deep-link (from clients / quick-open saved solar charts): preselect year.
        const solarYearParam = Number(params.get('solarYear'));
        if (Number.isFinite(solarYearParam) && solarYearParam >= 1900 && solarYearParam <= 2100) {
            state.solarYear = solarYearParam;
        }
        if (params.has('date') || params.has('time') || params.has('layer')
            || params.has('directionType') || params.has('partner') || params.has('solarYear')) {
            window.history.replaceState({}, '', window.location.pathname);
        }
    }

    function buildCurrentSourceChartPayload({ title, chartKind, tags, personId }) {
        const [date, time] = splitTargetDatetime(state.natalSelectedDateTime);
        const location = state.natalLocation || {};
        const payload = {
            title,
            chart_kind: chartKind || 'birth',
            date,
            time: normalizeTime(time || '12:00:00'),
            timezone: state.natalTimezone || 'UTC',
            location_name: location.name || state.natalData?.birth_data?.place || null,
            latitude: location.latitude,
            longitude: location.longitude,
            house_system: normalizeHouseSystemCode(state.pageSettings.houseSystem || state.natalData?.birth_data?.house_system || 'P'),
            tags: Array.isArray(tags) ? tags : [],
        };
        if (personId) payload.person_id = personId;
        return payload;
    }

    function defaultSourceChartTitle() {
        const birth = state.natalData?.birth_data || {};
        const name = [birth.first_name, birth.last_name].filter(Boolean).join(' ').trim();
        const [date] = splitTargetDatetime(state.natalSelectedDateTime);
        if (name && isNatalEdited()) return `${name} · ${date}`;
        if (name) return name;
        return t('page.chart.actions.saveSourceChartDefaultTitle', { date: date || '' }).trim();
    }

    function bindSaveChartModal() {
        // Modal UI is managed by window.SaveChartModal (save-chart-modal.js)
    }

    async function saveCurrentSourceAsChart() {
        const result = await window.SaveChartModal?.open({
            defaultTitle: defaultSourceChartTitle(),
            defaultDate: splitTargetDatetime(state.natalSelectedDateTime)[0],
            defaultTime: splitTargetDatetime(state.natalSelectedDateTime)[1],
            showTags: true,
            showPerson: true,
        });
        if (!result) return;
        try {
            const saved = await apiPost('/charts', buildCurrentSourceChartPayload({
                title: result.title,
                chartKind: 'birth',
                date: result.date,
                time: result.time,
                tags: result.tags,
                personId: result.personId,
            }));
            const newChartId = saved.chart_id || saved.user_id;
            // Primary person is set via person_id (FK above); link any extra
            // selected people through the M2M endpoint so the chart belongs to all.
            const extraPersonIds = (result.personIds || []).slice(1);
            for (const pid of extraPersonIds) {
                try {
                    await apiPost(`/persons/${encodeURIComponent(pid)}/charts`, { chart_id: newChartId });
                } catch (linkErr) {
                    console.warn('Failed to link extra person to chart', pid, linkErr);
                }
            }
            const resp = await apiGet(`/natal/${encodeURIComponent(String(saved.chart_id || saved.user_id))}`);
            state.userId = resp.user_id || saved.chart_id || saved.user_id;
            state.natalData = resp;
            state.natalWheelData = window.NatalWheelData?.prepareNatalWheelData
                ? window.NatalWheelData.prepareNatalWheelData(resp, { houseSystem: resp.birth_data?.house_system || undefined })
                : resp;
            window.AstroAPI?.saveChartToSession?.(resp);
            window.AstroAPI?.saveFormData?.(window.AstroAPI.chartToFormData?.(resp));
            window.AstroAPI?.saveNavigationState?.({
                sourceView: 'forecast-new',
                sourceUrl: `/forecast-new.html${window.location.search || ''}`,
                clientUserId: String(state.userId),
                partnerUserId: null,
            });
            localStorage.setItem('currentUserId', String(state.userId));
            window.location.reload();
        } catch (error) {
            window.showToast?.(
                t('page.chart.actions.saveSourceChartError', { error: error.message }, error.message),
                'error'
            );
        }
    }

    function schedulePersist() {
        clearTimeout(state.persistTimer);
        state.persistTimer = setTimeout(persistState, 120);
    }

    function flushPendingPersistence() {
        flushLayoutPersist();
        if (state.applySettingsTimer) {
            clearTimeout(state.applySettingsTimer);
            state.applySettingsTimer = null;
            applySettings().catch((error) => {
                console.warn('Failed to flush Forecast New settings:', error);
            });
        }
        if (state.persistTimer) {
            clearTimeout(state.persistTimer);
            state.persistTimer = null;
        }
        persistState();
        if (state.viewOverridesPersistTimer) {
            clearTimeout(state.viewOverridesPersistTimer);
            state.viewOverridesPersistTimer = null;
            persistForecastNewViewOverrides().catch((error) => {
                console.warn('Failed to flush Forecast New view overrides:', error);
            });
        }
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
                directionType: state.directionType,
                stepMode: state.stepMode,
                customStep: state.customStep,
                wheelView: state.wheelView,
                resultView: 'wheel',
                solarYear: state.solarYear,
                solarLocation: state.solarLocation,
                synastryPartnerId: state.synastryPartnerId,
                synastryMode: state.synastryMode,
                synastryManual: state.synastryManual,
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
        return ({
            transit: t('common.method.transit'),
            progression: t('common.method.progression'),
            direction: t('common.method.direction'),
            solar_return: t('common.method.solar'),
            synastry_partner: t('page.chart.nav.synastry'),
        })[method] || method;
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
        // Делегируем в общий модуль (Фаза 0: вынесенный тестируемый шов). Поведение идентично.
        return window.ForecastSourceUtils.splitTargetDatetime(value);
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
        return window.ForecastSourceUtils.normalizeTimezoneValue(value, placeName, window.Timezones);
    }

    function buildLayerCacheKey(method, date, context = {}) {
        const selectedDateTime = context.selectedDateTime || state.selectedDateTime;
        const timezone = context.timezone || state.timezone;
        const location = context.location || state.location || {};
        const directionType = normalizeDirectionType(context.directionType || state.directionType);
        // Идентичность натала в ключе (фикс M2): слой против отредактированного натала
        // не должен коллидировать со слоем против сохранённого (или другой правки).
        const natalToken = natalCacheToken();
        if (method === 'transit') {
            return [
                method,
                natalToken,
                selectedDateTime,
                timezone,
                location?.name || '',
                location?.latitude ?? '',
                location?.longitude ?? '',
            ].join('|');
        }
        if (method === 'direction') {
            return [method, natalToken, date, directionType].join('|');
        }
        if (method === 'progression') {
            return [method, natalToken, selectedDateTime, timezone].join('|');
        }
        if (method === 'solar_return') {
            return [method, natalToken, state.solarYear,
                state.solarLocation?.latitude ?? '', state.solarLocation?.longitude ?? ''].join('|');
        }
        if (method === 'synastry_partner') {
            if (state.synastryMode === 'manual') {
                const m = state.synastryManual || {};
                return [method, natalToken, 'manual', m.date || '', m.time || '', m.timezone || '',
                    m.latitude ?? '', m.longitude ?? '', m.place || ''].join('|');
            }
            return [method, natalToken, state.synastryPartnerId || ''].join('|');
        }
        return [method, natalToken, date].join('|');
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
        return window.ForecastSourceUtils.normalizeTime(value);
    }

    function todayIsoDate() {
        return window.ForecastSourceUtils.todayIsoDate();
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

    function normalizeDirectionType(value) {
        const normalized = String(value || '').trim();
        if (normalized === 'symbolic') return 'zodiacal';
        return ['solar_arc', 'zodiacal', 'equatorial'].includes(normalized) ? normalized : DEFAULT_DIRECTION_TYPE;
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

    // ─── Cold-start overlay ───────────────────────────────────────────────────
    // Shown when forecast-new.html is opened without a natal chart in session.
    // Two tabs: pick a saved client, or enter birth data manually.
    // On selection → saveChartToSession → location.reload() (re-runs clean init).

    function coldFetch(url, init) {
        return fetch(url, { credentials: 'include', ...(init || {}) });
    }

    function showColdStartOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'coldStartOverlay';
        overlay.innerHTML = `
<style>
#coldStartOverlay{position:fixed;inset:0;background:#0e0e16;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:40px 16px 24px;overflow-y:auto;font-family:inherit}
#coldStartOverlay h2{color:#e8e6f0!important;font-size:1.25rem;margin:0 0 8px;text-align:center}
#coldStartOverlay p{color:#9d9ab0!important;font-size:.875rem;margin:0 0 24px;text-align:center}
.cold-tabs{display:flex;gap:8px;margin-bottom:20px}
.cold-tab{padding:8px 20px;border-radius:8px;border:1px solid #2a2840;background:transparent;color:#9d9ab0!important;cursor:pointer;font-size:.875rem;transition:all .15s}
.cold-tab.active{background:#6c5ce7;border-color:#6c5ce7;color:#fff!important}
.cold-panel{width:100%;max-width:480px}
.cold-panel.hidden{display:none}
.cold-client-list{display:flex;flex-direction:column;gap:6px;max-height:50vh;overflow-y:auto}
.cold-client-item{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:8px;border:1px solid #2a2840;background:#16151f;cursor:pointer;color:#e8e6f0!important;font-size:.875rem;transition:border-color .15s}
.cold-client-item:hover{border-color:#6c5ce7}
.cold-client-name{font-weight:500;color:#e8e6f0!important}
.cold-client-meta{color:#9d9ab0!important;font-size:.8rem}
.cold-status{color:#9d9ab0!important;font-size:.875rem;text-align:center;padding:16px 0}
.cold-form{display:flex;flex-direction:column;gap:12px}
.cold-form label{color:#9d9ab0!important;font-size:.8rem;margin-bottom:2px;display:block}
.cold-form input,.cold-form select{width:100%;padding:9px 12px;border-radius:8px;border:1px solid #2a2840;background:#16151f;color:#e8e6f0!important;font-size:.875rem;box-sizing:border-box;outline:none}
.cold-form input:focus,.cold-form select:focus{border-color:#6c5ce7}
.cold-place-wrap{position:relative}
.cold-suggestions{position:absolute;top:100%;left:0;right:0;z-index:10;background:#16151f;border:1px solid #2a2840;border-radius:8px;max-height:180px;overflow-y:auto;display:none}
.cold-suggestions.visible{display:block}
.cold-btn{padding:10px 20px;border-radius:8px;background:#6c5ce7;border:none;color:#fff!important;font-size:.875rem;cursor:pointer;width:100%;transition:opacity .15s}
.cold-btn:disabled{opacity:.5;cursor:not-allowed}
.cold-err{color:#ff6b6b!important;font-size:.8rem;text-align:center;min-height:20px}
</style>
<h2 data-cold-i18n="page.forecastNew.coldStart.title">Відкрити карту</h2>
<p data-cold-i18n="page.forecastNew.coldStart.subtitle">Виберіть клієнта або введіть дані вручну</p>
<div class="cold-tabs">
  <button class="cold-tab active" id="coldTabClients">Клієнти</button>
  <button class="cold-tab" id="coldTabManual">Вручну</button>
</div>
<div class="cold-panel" id="coldPanelClients">
  <div class="cold-client-list" id="coldClientList">
    <div class="cold-status" id="coldClientsStatus">Завантаження…</div>
  </div>
</div>
<div class="cold-panel hidden" id="coldPanelManual">
  <div class="cold-form" id="coldManualForm">
    <div><label>Дата народження</label><input type="date" id="coldDate" required></div>
    <div><label>Час народження</label><input type="time" id="coldTime" value="12:00" step="1"></div>
    <div>
      <label>Місце народження</label>
      <div class="cold-place-wrap">
        <input type="text" id="coldPlace" autocomplete="off" placeholder="Місто…">
        <div class="cold-suggestions" id="coldSuggestions"></div>
      </div>
    </div>
    <div><label>Часовий пояс</label><select id="coldTimezone"></select></div>
    <input type="hidden" id="coldLat">
    <input type="hidden" id="coldLon">
    <div class="cold-err" id="coldManualErr"></div>
    <button class="cold-btn" id="coldBuildBtn">Побудувати карту</button>
  </div>
</div>`;
        document.body.appendChild(overlay);

        // i18n labels (best-effort, silent on failure)
        overlay.querySelectorAll('[data-cold-i18n]').forEach((el) => {
            try {
                const val = window.i18n?.t?.(el.dataset.coldI18n);
                if (val && val !== el.dataset.coldI18n) el.textContent = val;
            } catch (_) { /* ignore */ }
        });

        // Tab switching
        const tabClients = overlay.querySelector('#coldTabClients');
        const tabManual = overlay.querySelector('#coldTabManual');
        const panelClients = overlay.querySelector('#coldPanelClients');
        const panelManual = overlay.querySelector('#coldPanelManual');

        tabClients.addEventListener('click', () => {
            tabClients.classList.add('active'); tabManual.classList.remove('active');
            panelClients.classList.remove('hidden'); panelManual.classList.add('hidden');
        });
        tabManual.addEventListener('click', () => {
            tabManual.classList.add('active'); tabClients.classList.remove('active');
            panelManual.classList.remove('hidden'); panelClients.classList.add('hidden');
            initManualPanel();
        });

        // ── Tab: Clients ──────────────────────────────────────────────────────
        const clientList = overlay.querySelector('#coldClientList');
        const clientsStatus = overlay.querySelector('#coldClientsStatus');

        coldFetch(`${API_BASE}/users`)
            .then((r) => r.ok ? r.json() : Promise.reject(new Error('Помилка завантаження')))
            .then((users) => {
                if (!Array.isArray(users) || !users.length) {
                    clientsStatus.textContent = 'Немає збережених клієнтів';
                    return;
                }
                clientsStatus.remove();
                users.forEach((u) => {
                    const btn = document.createElement('button');
                    btn.className = 'cold-client-item';
                    const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || '(без імені)';
                    const meta = u.birth_date ? u.birth_date + (u.birth_place ? ' · ' + u.birth_place : '') : (u.birth_place || '');
                    btn.innerHTML = `<span class="cold-client-name">${escapeHtml(name)}</span>${meta ? `<span class="cold-client-meta">${escapeHtml(meta)}</span>` : ''}`;
                    btn.addEventListener('click', () => openClient(u.user_id, btn));
                    clientList.appendChild(btn);
                });
            })
            .catch((err) => { clientsStatus.textContent = err.message || 'Помилка'; });

        async function openClient(userId, btn) {
            btn.disabled = true;
            btn.style.opacity = '0.6';
            try {
                const resp = await coldFetch(`${API_BASE}/natal/${encodeURIComponent(String(userId))}`);
                if (!resp.ok) throw new Error('Не вдалося завантажити карту');
                const natalData = await resp.json();
                window.AstroAPI?.saveChartToSession?.(natalData);
                window.AstroAPI?.saveFormData?.(window.AstroAPI.chartToFormData?.(natalData));
                window.location.reload();
            } catch (err) {
                btn.disabled = false;
                btn.style.opacity = '';
                clientsStatus.textContent = err.message || 'Помилка';
            }
        }

        // ── Tab: Manual entry ─────────────────────────────────────────────────
        let manualPanelInited = false;
        let coldPanel = null;

        function initManualPanel() {
            if (manualPanelInited) return;
            manualPanelInited = true;

            const tzSelect = overlay.querySelector('#coldTimezone');
            window.Timezones?.populate?.(tzSelect);
            const guessedTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
            tzSelect.value = guessedTz;

            const placeInput = overlay.querySelector('#coldPlace');
            const suggestions = overlay.querySelector('#coldSuggestions');
            const latInput = overlay.querySelector('#coldLat');
            const lonInput = overlay.querySelector('#coldLon');

            coldPanel = new window.ChartSourcePanel.ChartSourcePanel({ mode: 'manual' }).attachDom({
                dateInput: overlay.querySelector('#coldDate'),
                timeInput: overlay.querySelector('#coldTime'),
                timezoneInput: tzSelect,
                locationInput: placeInput,
                latitudeInput: latInput,
                longitudeInput: lonInput,
            });

            // Place autocomplete
            if (window.PlaceAutocomplete?.attach) {
                window.PlaceAutocomplete.attach({
                    input: placeInput,
                    suggestions,
                    onSelect(place) {
                        const latitude = place.lat ?? place.latitude ?? null;
                        const longitude = place.lon ?? place.longitude ?? null;
                        const timezone = place.timezone
                            || window.Timezones?.guess?.(place.displayName || place.shortName || placeInput.value)
                            || null;
                        coldPanel.update({
                            location: {
                                name: place.shortName || place.displayName || placeInput.value,
                                latitude,
                                longitude,
                                sourceId: place.sourceId || place.source_id || null,
                            },
                            ...(timezone ? { timezone } : {}),
                        });
                        coldPanel.syncToDom();
                        suggestions.classList.remove('visible');
                    },
                });
            }

            // Show/hide suggestions box
            placeInput.addEventListener('input', () => {
                suggestions.classList.toggle('visible', suggestions.children.length > 0);
            });
        }

        const buildBtn = overlay.querySelector('#coldBuildBtn');
        const manualErr = overlay.querySelector('#coldManualErr');

        buildBtn.addEventListener('click', async () => {
            manualErr.textContent = '';
            const snapshot = coldPanel?.getSource?.() || {};
            const payload = window.ChartSourcePanel?.buildSourcePayload?.(snapshot);
            if (!payload?.natal?.date) {
                manualErr.textContent = 'Введіть дату народження';
                return;
            }
            buildBtn.disabled = true;
            try {
                const resp = await coldFetch(`${API_BASE}/natal/calculate?save_to_db=false`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload.natal),
                });
                if (!resp.ok) {
                    const err = await resp.json().catch(() => ({}));
                    throw new Error(err.detail || 'Помилка розрахунку');
                }
                const natalData = await resp.json();
                window.AstroAPI?.saveChartToSession?.(natalData);
                window.location.reload();
            } catch (err) {
                manualErr.textContent = err.message || 'Помилка';
                buildBtn.disabled = false;
            }
        });
    }

    function escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    // ── End cold-start overlay ────────────────────────────────────────────────
})();

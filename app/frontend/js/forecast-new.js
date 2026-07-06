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
    const VALID_AYANAMSHAS = ['lahiri', 'fagan_bradley', 'krishnamurti', 'raman', 'de_luce'];
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
        activeLayers: [{ id: 'transit-1', method: 'transit' }],
        selectedRightLayerId: 'transit-1',
        directionType: DEFAULT_DIRECTION_TYPE,
        // D6: вид колеса — 'multi' (натал + кольца, как сейчас) | 'single' (только
        // натал в виде одиночной карты: внешний слот + маркеры углов).
        wheelView: 'multi',
        singleChartMode: 'natal',
        compositeMethod: 'midpoint',
        compositeData: null,
        compositeChartData: null,
        compositeMeta: null,
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
            showDeclinationAspects: false,
            angleAscDscBold: true,
            angleMcIcBold: true,
            houseNumberStyle: 'arabic',
            houseLabelsOutside: false,
            showTransitCusps: true,
            showProgressionCusps: true,
            showDirectionCusps: true,
            compositeMethod: 'midpoint',
        },
        viewport: { zoom: 1, panX: 0, panY: 0 },
        cache: {},
        inFlight: {},
        inFlightByKey: {},
        inFlightById: {},
        auxBlockCache: {},
        auxBlockInFlight: {},
        auxPendingBlocks: new Set(),
        auxBlockTimer: null,
        wheel: null,
        natalRenderer: null,
        prognosticRenderer: null,
        resolvedPreferences: null,
        hoveredAspectKey: null,
        activePlanetSelection: null,
        applySettingsTimer: null,
        viewOverridesPersistTimer: null,
        persistTimer: null,
        displayedMomentLoadTimer: null,
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

    // ── Множественные слои одного типа (multi-instance) ──────────────────────
    // Слой — инстанс { id, method }. transit/progression/direction можно
    // добавлять несколько раз; solar_return/synastry_partner пока single
    // (их конфиг живёт в глобальном state — Ship 2 перенесёт его в инстанс),
    // поэтому для них id === method (это сохраняет совместимость
    // state.layers[method] / buildLayerCacheKey(method)).
    let _layerInstanceSeq = 0;
    function isMultiInstanceMethod(method) {
        // Ship 2: solar_return и synastry_partner тоже мультиинстанс (per-layer config).
        return LAYER_ORDER.includes(method);
    }
    function nextLayerInstanceId(method) {
        let id;
        do {
            _layerInstanceSeq += 1;
            id = `${method}-${_layerInstanceSeq}`;
        } while (state.activeLayers.some((l) => l.id === id));
        return id;
    }
    function activeLayerMethods() {
        return state.activeLayers.map((l) => l.method);
    }
    function hasActiveMethod(method) {
        return state.activeLayers.some((l) => l.method === method);
    }
    function instancesOfMethod(method) {
        return state.activeLayers.filter((l) => l.method === method);
    }
    function findLayerInstance(id) {
        return state.activeLayers.find((l) => l.id === id) || null;
    }
    function selectedLayerInstance() {
        return findLayerInstance(state.selectedRightLayerId);
    }
    function selectedRightMethod() {
        return selectedLayerInstance()?.method || '';
    }
    // Слой viewModel для выбранного инстанса (для сводок момента/партнёра).
    function selectedViewModelLayer() {
        const layers = state.viewModel?.activePrognosticLayers || [];
        return layers.find((l) => l.id === state.selectedRightLayerId)
            || layers.find((l) => l.method === selectedRightMethod())
            || null;
    }
    function sortActiveLayersInPlace() {
        // Стабильная сортировка по LAYER_ORDER; внутри метода порядок добавления.
        state.activeLayers.sort((a, b) => LAYER_ORDER.indexOf(a.method) - LAYER_ORDER.indexOf(b.method));
    }

    // ── Per-instance конфиг solar_return / synastry_partner (Ship 2) ─────────
    // Глобальные state.solar*/synastry* — это «scratch» редактора ВЫБРАННОГО слоя.
    // Каждый инстанс хранит свой снимок в inst.config; fetch/cacheKey читают его.
    // transit/progression/direction несут «момент» (дата/время/место[/тип дирекции]);
    // solar_return хранит год/место и отображает рассчитанный момент соляра;
    // synastry_partner — свой конфиг. Все методы конфигурируемы.
    function isMomentMethod(method) {
        return method === 'transit' || method === 'progression' || method === 'direction';
    }
    function methodHasConfig(method) {
        return LAYER_ORDER.includes(method);
    }
    function ensureLayerConfig(inst) {
        if (!inst) return null;
        if (!inst.config) inst.config = {};
        return inst.config;
    }
    function momentScratchConfig() {
        return {
            datetime: state.selectedDateTime,
            timezone: state.timezone,
            location: state.location ? { ...state.location } : null,
            directionType: state.directionType,
        };
    }
    function layerConfigOf(layerOrInst) {
        // Принимает инстанс или строку-метод; возвращает конфиг для fetch/cacheKey.
        if (layerOrInst && typeof layerOrInst === 'object' && layerOrInst.config
            && Object.keys(layerOrInst.config).length) {
            return layerOrInst.config;
        }
        const method = typeof layerOrInst === 'string' ? layerOrInst : layerOrInst?.method;
        if (method === 'solar_return') return { year: state.solarYear, location: state.solarLocation };
        if (method === 'synastry_partner') return synastryScratchConfig();
        if (isMomentMethod(method)) return momentScratchConfig();
        return {};
    }
    // scratch (глобальный state) → inst.config
    function captureScratchToConfig(inst) {
        if (!inst || !methodHasConfig(inst.method)) return;
        const cfg = ensureLayerConfig(inst);
        if (inst.method === 'solar_return') {
            cfg.year = state.solarYear;
            cfg.datetime = cfg.datetime || getDisplayedSolarDateTime();
            cfg.location = state.solarLocation ? { ...state.solarLocation } : null;
        } else if (inst.method === 'synastry_partner') {
            cfg.mode = state.synastryMode;
            cfg.partnerId = state.synastryPartnerId;
            cfg.manual = state.synastryManual ? { ...state.synastryManual } : null;
        } else {
            cfg.datetime = state.selectedDateTime;
            cfg.timezone = state.timezone;
            cfg.location = state.location ? { ...state.location } : null;
            if (inst.method === 'direction') cfg.directionType = state.directionType;
        }
    }
    // inst.config → scratch (+ синк DOM-редакторов)
    function applyConfigToScratch(inst) {
        if (!inst || !methodHasConfig(inst.method)) return;
        const cfg = inst.config || {};
        if (inst.method === 'solar_return') {
            if (Number.isFinite(Number(cfg.year))) state.solarYear = Number(cfg.year);
            state.solarLocation = cfg.location ? { ...cfg.location } : null;
            syncSolarInputs();
        } else if (inst.method === 'synastry_partner') {
            state.synastryMode = cfg.mode === 'manual' ? 'manual' : 'db';
            state.synastryPartnerId = cfg.partnerId || '';
            state.synastryManual = cfg.manual ? { ...cfg.manual } : null;
            setSynastryMode(state.synastryMode);
            syncSynastryManualControlsFromState();
            if (refs.forecastNewSynastryPartnerSelect) {
                refs.forecastNewSynastryPartnerSelect.value = state.synastryPartnerId;
            }
        } else {
            if (cfg.datetime) setSelectedDateTime(cfg.datetime);
            if (cfg.timezone) state.timezone = cfg.timezone;
            if (cfg.location) state.location = { ...cfg.location };
            if (inst.method === 'direction' && cfg.directionType) {
                state.directionType = normalizeDirectionType(cfg.directionType);
            }
            syncControlsFromState();
        }
    }
    // Инвалидировать кэш слоя по id и перезагрузить, если нужно.
    function invalidateLayerById(id) {
        if (id) delete state.layers?.[id];
    }
    // Зафиксировать scratch в выбранном слое и сбросить его кэш (после правки редактора).
    function commitSelectedLayerEdit() {
        const inst = selectedLayerInstance();
        captureScratchToConfig(inst);
        invalidateLayerById(inst?.id);
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

    // Format a bare "YYYY-MM-DD" date per the account date-format preference.
    // Builds a local Date (no UTC parse) so the day never shifts across timezones.
    function formatChartDate(isoDate) {
        const raw = String(isoDate || '').trim();
        const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m || !window.LocaleFormatters?.formatDate) return raw;
        const localDate = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        return window.LocaleFormatters.formatDate(localDate);
    }

    // Format a "YYYY-MM-DDTHH:MM[:SS]" moment: date follows the preference,
    // the time portion is preserved as-is.
    function formatChartDateTimeLabel(isoDateTime, separator = ' ') {
        const raw = String(isoDateTime || '').trim();
        if (!raw.includes('T')) return formatChartDate(raw);
        const [datePart, timePart] = raw.split('T');
        return [formatChartDate(datePart), timePart].filter(Boolean).join(separator);
    }

    function formatHeaderTimezone(value, datetimeOrOptions = {}) {
        const options = typeof datetimeOrOptions === 'string'
            ? { datetime: datetimeOrOptions }
            : (datetimeOrOptions || {});
        return window.Timezones?.formatOffsetLabel?.(value, options) || String(value || '').trim();
    }

    function buildPanelLocationMeta(locationName, timezone, datetimeOrOptions = {}) {
        return [
            locationName,
            formatHeaderTimezone(timezone, datetimeOrOptions),
        ].filter(Boolean).join(' · ');
    }

    function chartDisplayTitle(chart = {}, fallback = '') {
        const birth = chart.birth_data || chart.birthData || {};
        return chart.display_title
            || chart.title
            || chart.person_display_name
            || [birth.first_name, birth.last_name].filter(Boolean).join(' ').trim()
            || [chart.first_name, chart.last_name].filter(Boolean).join(' ').trim()
            || fallback;
    }

    function chartOptionLabel(chart = {}, fallback = '') {
        const birth = chart.birth_data || chart.birthData || {};
        const date = chart.date || chart.birth_date || birth.date || '';
        const place = chart.location_name || chart.birth_place || birth.place || '';
        return chartDisplayTitle(chart)
            || [date ? formatChartDate(date) : '', place].filter(Boolean).join(' · ')
            || fallback
            || t('common.notAvailable', null, 'Not available');
    }

    function selectedPanelTitle(method) {
        const inst = selectedLayerInstance();
        if (inst?.config?.chartTitle) return inst.config.chartTitle;
        if (method === 'synastry_partner') {
            return state.synastryManual?.name || layerLabel(method);
        }
        return layerLabel(method);
    }

    function buildNatalHeaderSubtitle(birth = {}) {
        const locationName = state.natalLocation?.name || birth.place || '';
        const parts = [
            formatChartDateTimeLabel(state.natalSelectedDateTime),
            buildPanelLocationMeta(
                locationName,
                state.natalTimezone || birth.timezone,
                state.natalSelectedDateTime,
            ),
        ].filter(Boolean);

        // Zodiac indicator: shown only for sidereal (tropical is the implicit default).
        if ((birth.zodiac || 'tropical') === 'sidereal') {
            const label = t('page.forecastNew.zodiac.sidereal') || 'Sidereal';
            const ayan = birth.ayanamsha
                ? ` · ${birth.ayanamsha.charAt(0).toUpperCase()}${birth.ayanamsha.slice(1)}`
                : '';
            parts.push(`${label}${ayan}`);
        }

        return parts.join(' · ');
    }

    function getForecastNavigationState() {
        return window.AstroAPI?.getNavigationState?.() || {};
    }

    function getForecastBackUrl() {
        const navState = getForecastNavigationState();
        // The back button is navigation, not undo: it must return to the page the
        // user entered the work screen from (clients / profile), never to a
        // previously viewed chart. If sourceUrl was clobbered to a forecast-new
        // URL by an in-workspace chart switch, ignore it and fall back to the
        // client's profile (if known), then home.
        const sourceUrl = navState.sourceUrl;
        if (sourceUrl && !/\/forecast-new(\.html)?(\?|#|$)/.test(sourceUrl)) {
            return sourceUrl;
        }
        if (state.userId) {
            return `/client/${encodeURIComponent(String(state.userId))}`;
        }
        return '/';
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
            redirectToChartLibrary();
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
        // Гарантируем, что у каждого слоя есть свой config (момент/конфиг). Несохранённые
        // слои берут текущий scratch (на холодном старте — единственный транзит = «сейчас»),
        // затем загружаем config выбранного слоя в редактор.
        state.activeLayers.forEach((inst) => {
            if (methodHasConfig(inst.method) && !inst.config) captureScratchToConfig(inst);
        });
        applyConfigToScratch(selectedLayerInstance());
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
        await hydratePreferences();
        syncControlsFromState();
        renderStaticNatal();
        renderRightLayerTabs();
        if (state.singleChartMode === 'composite') {
            await enterCompositeMode();
            showLayout();
            hideLoader();
        } else {
            await loadActiveLayers({ waitForComplete: true });
        }
    });

    function cacheElements() {
        [
            'pageLoader', 'forecastNewLayout', 'forecastNewError', 'forecastNewErrorMsg',
            'forecastNewBackBtn', 'forecastNewTitle', 'forecastNewSubtitle', 'openNatalTablesBtn',
            'openClientProfileBtn', 'saveSourceChartBtn', 'saveNatalChartBtn', 'forecastNewActionsToggle', 'forecastNewActionsMenu',
            'forecastNewDirectionTypeSelect',
            'forecastNewNatalPanel', 'forecastNewProgPanel',
            'natalPanelTitle', 'natalPanelMeta', 'prognosticPanelTitle', 'prognosticPanelMeta',
            'prognosticMomentToggle', 'forecastSavedChartsBtn', 'natalSavedChartsBtn', 'forecastNewMomentCard',
            'forecastNewRelationshipSwitch', 'forecastNewRelationshipSynastryBtn', 'forecastNewRelationshipCompositeBtn',
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
            'forecastNewSolarLat', 'forecastNewSolarLon', 'forecastNewSynastryPartnerSelect', 'forecastNewCompositeHeaderBtn',
            'momentSolarYearInput', 'momentSolarLocationInput', 'momentSolarLocationSuggestions',
            'momentSolarLat', 'momentSolarLon',
            'forecastNewSynastryManualName', 'forecastNewSynastryManualDate', 'forecastNewSynastryManualTime',
            'forecastNewSynastryManualTimezone', 'forecastNewSynastryManualLocation', 'forecastNewSynastryManualSuggestions',
            'forecastNewSynastryManualLat', 'forecastNewSynastryManualLon', 'forecastNewSynastryManualApply', 'forecastNewSynastryManualError',
            'forecastNewZoomIn', 'forecastNewZoomOut',
            'forecastNewSettingsToggle', 'forecastNewSettingsPanel',
            'orientationSelect', 'houseSystemSelect', 'zodiacSelect', 'ayanamshaSelect', 'compositeMethodSettingsSection', 'compositeMethodSelect', 'iconScaleRange', 'iconScaleValue',
            'aspectScopeSelect', 'aspectTypeToggles',
            'aspectPhaseApplyingToggle', 'aspectPhaseSeparatingToggle',
            'houseNumberStyleSelect', 'houseLabelsOutsideToggle',
            'showTransitCuspsToggle', 'showProgressionCuspsToggle', 'showDirectionCuspsToggle',
            'showWheelStationaryToggle', 'showWheelDegreeToggle', 'showDeclinationAspectsToggle',
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
        initMobilePanelSwitch();

        refs.openNatalTablesBtn?.addEventListener('click', () => {
            const chart = getActiveReportChartData();
            window.AstroAPI?.saveChartToSession?.(chart);
            if (chart?.chart_kind !== 'composite') {
                window.AstroAPI?.saveFormData?.(window.AstroAPI.chartToFormData(chart));
            }
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
                includeComposites: true,
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
        // Right (prognostic) panel save targets the chart shown there: for a
        // solar layer that's the solar chart, not the natal. Left (natal) panel
        // always saves the natal source.
        refs.saveSourceChartBtn?.addEventListener('click', saveRightPanelAsChart);
        refs.saveNatalChartBtn?.addEventListener('click', saveCurrentSourceAsChart);

        refs.layerToggles.forEach((input) => {
            input.addEventListener('change', async () => {
                const layer = input.dataset.layerToggle;
                if (input.checked) await activateLayer(layer, { openConfig: true });
                else await deactivateMethod(layer);
            });
        });

        refs.forecastNewDirectionTypeSelect?.addEventListener('change', async () => {
            state.directionType = normalizeDirectionType(refs.forecastNewDirectionTypeSelect.value);
            refs.forecastNewDirectionTypeSelect.value = state.directionType;
            // Тип дирекции относится к выбранному слою дирекции.
            if (selectedRightMethod() === 'direction') commitSelectedLayerEdit();
            schedulePersist();
            if (hasActiveMethod('direction')) {
                await loadActiveLayers({ lightweight: true });
            }
        });
        refs.zodiacSelect?.addEventListener('change', () => {
            if (refs.ayanamshaSelect) {
                refs.ayanamshaSelect.disabled = normalizeZodiac(refs.zodiacSelect?.value) !== 'sidereal';
            }
            scheduleApplySettings();
        });
        refs.ayanamshaSelect?.addEventListener('change', scheduleApplySettings);

        refs.forecastNewSolarYearInput?.addEventListener('change', () => {
            void applySolarYear(refs.forecastNewSolarYearInput.value);
        });
        refs.momentSolarYearInput?.addEventListener('change', () => {
            void applySolarYear(refs.momentSolarYearInput.value);
        });

        refs.forecastNewSynastryPartnerSelect?.addEventListener('change', async () => {
            state.synastryPartnerId = refs.forecastNewSynastryPartnerSelect.value || '';
            state.synastryMode = 'db';
            invalidateCompositeCache();
            schedulePersist();
            if (state.synastryPartnerId) {
                closeLayerPopover('synastry_partner');
                await ensureSynastryLayerActive({ lightweight: true });
                if (state.singleChartMode === 'composite') {
                    await enterCompositeMode();
                }
            }
        });
        refs.forecastNewCompositeHeaderBtn?.addEventListener('click', () => {
            void enterCompositeMode();
        });
        refs.forecastNewRelationshipCompositeBtn?.addEventListener('click', () => {
            void enterCompositeMode();
        });
        refs.forecastNewRelationshipSynastryBtn?.addEventListener('click', () => {
            void enterSynastryMode();
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
                        opt.textContent = chartOptionLabel(chart);
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

            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                focusAdjacentTimeStepperSegment(refs.forecastNewTimeStepper, segmentEl, event.key === 'ArrowRight' ? 1 : -1);
                return;
            }

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

            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                focusAdjacentTimeStepperSegment(refs.forecastNewNatalTimeStepper, segmentEl, event.key === 'ArrowRight' ? 1 : -1);
                return;
            }

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
                await loadDisplayedMomentLayers();
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
                void removeLayerInstance(removeButton.dataset.removeLayer);
                return;
            }

            const button = event.target.closest('[data-right-layer]');
            if (!button) return;
            state.selectedRightLayerId = button.dataset.rightLayer;
            state.activeRightMethodTab = selectedRightMethod();
            applyConfigToScratch(selectedLayerInstance());
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
            const aspectRow = event.target.closest('[data-result-aspect-key]');
            if (aspectRow) {
                const aspectKey = aspectRow.dataset.resultAspectKey;
                const aspectType = aspectRow.dataset.resultAspectType;
                const layerId = aspectRow.dataset.resultLayer;
                openAspectDynamicsByKey(aspectKey, aspectType, layerId);
                return;
            }

            const row = event.target.closest('[data-result-layer]');
            if (!row) return;
            const layerId = row.dataset.resultLayer;
            const inst = findLayerInstance(layerId);
            if (inst) {
                state.selectedRightLayerId = layerId;
                state.activeRightMethodTab = inst.method;
                applyConfigToScratch(inst);
                renderRightLayerTabs();
                renderRightPanel();
            }
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
            const willOpen = refs.forecastNewSettingsPanel?.classList.contains('hidden');
            if (willOpen) {
                closeBodyActionMenu();
                closeAllLayerPopovers(null);
                closeAddLayerMenu();
            }
            refs.forecastNewSettingsPanel?.classList.toggle('hidden');
        });
        refs.compositeMethodSelect?.addEventListener('change', () => {
            scheduleApplySettings();
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
            refs.showDeclinationAspectsToggle,
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

        refs.forecastNewViewSingle?.addEventListener('click', () => setWheelView('single', { singleChartMode: 'natal' }));
        refs.forecastNewViewMulti?.addEventListener('click', () => setWheelView('multi'));
        syncWheelViewButtons();
        refs.forecastNewZoomIn?.addEventListener('click', () => setViewport({ zoom: state.viewport.zoom * 1.18 }));
        refs.forecastNewZoomOut?.addEventListener('click', () => setViewport({ zoom: state.viewport.zoom / 1.18 }));
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeBodyActionMenu();
                closeSettingsPanel();
            }
        });
        document.addEventListener('chart:body-contextmenu', (event) => {
            const detail = event?.detail || {};
            if (detail.source !== 'wheel' || !detail.body) return;
            openBodyActionMenu(detail);
        });
        bindWheelPanZoom();

        document.addEventListener('frontend:locale-changed', () => {
            syncMobilePanelLabels();
            renderStaticNatal();
            renderRightPanel();
            renderWheel();
            syncResultViewButtons();
            renderResultView();
            // Workspace "now" blocks (lunar, hours, profections, …) are rendered
            // once into cached markup and otherwise never refreshed — re-render
            // them so their labels follow the active locale instead of getting
            // stuck in whatever language was active on first paint.
            renderNowBlocks();
        });

        document.addEventListener('click', (event) => {
            if (!(event.target instanceof Element)) return;
            if (event.target.closest('tr[data-planet]') || event.target.closest('.prognostic-body')) return;
            clearPlanetSelection();
        });
    }

    function initForecastNewActionsMenu() {
        const toggle = refs.forecastNewActionsToggle;
        const menu = refs.forecastNewActionsMenu;
        if (!toggle || !menu) return;

        const setOpen = (isOpen) => {
            if (isOpen) {
                closeSettingsPanel();
                closeAllLayerPopovers(null);
                closeAddLayerMenu();
                closeBodyActionMenu();
            }
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

    function closeSettingsPanel() {
        refs.forecastNewSettingsPanel?.classList.add('hidden');
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
        closeSettingsPanel();
        closeAddLayerMenu();
        closeBodyActionMenu();
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
            input.checked = hasActiveMethod(input.dataset.layerToggle);
        });
    }

    function normalizeActiveLayers() {
        state.activeLayers = state.activeLayers.filter((l) => l && l.id && LAYER_ORDER.includes(l.method));
        sortActiveLayersInPlace();
        state.enabledLayers = state.activeLayers;
        if (!selectedLayerInstance()) {
            state.selectedRightLayerId = state.activeLayers[0]?.id || '';
        }
        state.activeRightMethodTab = selectedRightMethod();
        syncLayerTogglesFromState();
    }

    async function activateLayer(method, { openConfig = false } = {}) {
        if (!LAYER_ORDER.includes(method)) return;
        const existing = instancesOfMethod(method);
        let instance;
        if (!isMultiInstanceMethod(method) && existing.length) {
            // Single-instance метод уже активен — просто переключаемся на него.
            instance = existing[0];
        } else {
            if (method === 'transit' && existing.length === 0) {
                setSelectedDateTime(getLocalNowIso(state.timezone));
                state.lastStepperAction = null;
                syncControlsFromState();
            }
            instance = { id: nextLayerInstanceId(method), method };
            state.activeLayers.push(instance);
            if (method === 'solar_return') {
                initializeSolarDefaultsFromNatal();
            } else if (method === 'synastry_partner') {
                // Новый слой синастрии стартует с пустым партнёром (не наследует прошлый).
                state.synastryMode = 'db';
                state.synastryPartnerId = '';
                state.synastryManual = null;
            }
            // Снимок scratch → конфиг нового инстанса.
            captureScratchToConfig(instance);
        }
        state.selectedRightLayerId = instance.id;
        // Переключение на слой загружает его конфиг в редактор (scratch).
        applyConfigToScratch(instance);
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

        syncSolarInputs();
    }

    // Снять весь метод (используется чекбоксами слоёв слева) — удаляет все его инстансы.
    async function deactivateMethod(method) {
        if (!LAYER_ORDER.includes(method)) return;
        closeLayerPopover(method);
        instancesOfMethod(method).forEach((l) => { delete state.layers?.[l.id]; });
        state.activeLayers = state.activeLayers.filter((l) => l.method !== method);
        normalizeActiveLayers();
        renderRightLayerTabs();
        scheduleRightPanelRender();
        schedulePersist();
        await loadActiveLayers();
    }

    // Удалить один инстанс слоя по id (кнопка «−» на вкладке слоя).
    async function removeLayerInstance(id) {
        const inst = findLayerInstance(id);
        if (!inst) return;
        if (!isMultiInstanceMethod(inst.method) && instancesOfMethod(inst.method).length <= 1) {
            closeLayerPopover(inst.method);
        }
        delete state.layers?.[id];
        state.activeLayers = state.activeLayers.filter((l) => l.id !== id);
        normalizeActiveLayers();
        renderRightLayerTabs();
        scheduleRightPanelRender();
        schedulePersist();
        await loadActiveLayers();
    }

    function closeAddLayerMenu() {
        const menu = refs.rightLayerTabs?.querySelector('[data-add-layer-menu]');
        if (menu) {
            menu.classList.add('hidden');
            menu.classList.remove('forecast-new-add-layer-menu--floating');
            menu.style.removeProperty('--forecast-new-add-layer-menu-top');
            menu.style.removeProperty('--forecast-new-add-layer-menu-left');
        }
        refs.rightLayerTabs?.querySelector('[data-add-layer-toggle]')?.setAttribute('aria-expanded', 'false');
    }

    function positionAddLayerMenu(menu, toggle) {
        menu.classList.add('forecast-new-add-layer-menu--floating');
        const toggleRect = toggle.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        const viewportWidth = document.documentElement.clientWidth || window.innerWidth || 0;
        const margin = 8;
        const top = Math.min(
            Math.max(toggleRect.bottom + 7, margin),
            Math.max(margin, (window.innerHeight || 0) - menuRect.height - margin)
        );
        const left = Math.min(
            Math.max(toggleRect.right - menuRect.width, margin),
            Math.max(margin, viewportWidth - menuRect.width - margin)
        );
        menu.style.setProperty('--forecast-new-add-layer-menu-top', `${top}px`);
        menu.style.setProperty('--forecast-new-add-layer-menu-left', `${left}px`);
    }

    function toggleAddLayerMenu() {
        const menu = refs.rightLayerTabs?.querySelector('[data-add-layer-menu]');
        const toggle = refs.rightLayerTabs?.querySelector('[data-add-layer-toggle]');
        if (!menu || !toggle) return;
        const willOpen = menu.classList.contains('hidden');
        if (willOpen) {
            closeSettingsPanel();
            closeAllLayerPopovers(null);
            closeBodyActionMenu();
        }
        menu.classList.toggle('hidden', !willOpen);
        toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (willOpen) {
            positionAddLayerMenu(menu, toggle);
            menu.querySelector('[data-add-layer-method]:not(:disabled)')?.focus({ preventScroll: true });
        } else {
            closeAddLayerMenu();
        }
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

    // ── Mobile-only panel switcher (Natal ⇄ Forecast) ─────────────────────────
    // On phones (≤640px) only one side panel is shown at a time; this toggles a
    // body class that the mobile CSS uses to hide the other panel. Fully guarded
    // so desktop is never affected: with no interaction (or no JS) no class is
    // set and both panels simply stack, as in the existing ≤860px layout. When
    // the viewport grows past 640px any class is cleared so the desktop layout
    // never inherits a hidden panel.
    function initMobilePanelSwitch() {
        const switchEl = document.getElementById('forecastNewMobilePanelSwitch');
        if (!switchEl) return;
        const buttons = Array.from(switchEl.querySelectorAll('[data-mobile-panel]'));
        const mq = window.matchMedia('(max-width: 640px)');

        const setPanel = (panel) => {
            const isProg = panel === 'prog';
            document.body.classList.toggle('fn-mobile-panel-prog', isProg);
            document.body.classList.toggle('fn-mobile-panel-natal', !isProg);
            buttons.forEach((btn) => {
                const active = btn.dataset.mobilePanel === panel;
                btn.classList.toggle('is-active', active);
                btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
        };

        const syncToViewport = () => {
            if (mq.matches) {
                if (!document.body.classList.contains('fn-mobile-panel-prog')
                    && !document.body.classList.contains('fn-mobile-panel-natal')) {
                    setPanel('natal');
                }
            } else {
                document.body.classList.remove('fn-mobile-panel-prog', 'fn-mobile-panel-natal');
            }
        };

        buttons.forEach((btn) => {
            btn.addEventListener('click', () => setPanel(btn.dataset.mobilePanel));
        });
        syncMobilePanelLabels();

        if (typeof mq.addEventListener === 'function') {
            mq.addEventListener('change', syncToViewport);
        } else if (typeof mq.addListener === 'function') {
            mq.addListener(syncToViewport);
        }
        syncToViewport();
    }

    function syncMobilePanelLabels() {
        const switchEl = document.getElementById('forecastNewMobilePanelSwitch');
        if (!switchEl) return;
        const single = state.wheelView === 'single';
        const labels = {
            natal: single
                ? (t('page.forecastNew.mobilePanels.singleData') || 'Data')
                : (t('page.forecastNew.mobilePanels.multiChart') || 'Chart'),
            prog: single
                ? (t('page.forecastNew.mobilePanels.singleAnalysis') || 'Analysis')
                : (t('page.forecastNew.mobilePanels.multiLayers') || 'Layers'),
        };
        switchEl.querySelectorAll('[data-mobile-panel]').forEach((btn) => {
            const label = labels[btn.dataset.mobilePanel];
            if (!label) return;
            btn.textContent = label;
            btn.setAttribute('aria-label', label);
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

    async function applyManualSynastryPartner(input = null) {
        const manual = input && typeof input === 'object' && !('target' in input) ? input : null;
        const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== '';
        const name = (manual
            ? (manual.name || manual.title || '')
            : (refs.forecastNewSynastryManualName?.value || '')).trim();
        const date = manual ? (manual.date || '') : (refs.forecastNewSynastryManualDate?.value || '');
        const time = manual ? (manual.time || '') : (refs.forecastNewSynastryManualTime?.value || '');
        const timezone = manual ? (manual.timezone || '') : (refs.forecastNewSynastryManualTimezone?.value || '');
        const place = (manual
            ? (manual.place || '')
            : (refs.forecastNewSynastryManualLocation?.value || '')).trim();
        const latRaw = manual ? manual.latitude : (refs.forecastNewSynastryManualLat?.value || '');
        const lonRaw = manual ? manual.longitude : (refs.forecastNewSynastryManualLon?.value || '');
        const latitude = hasValue(latRaw) ? Number(latRaw) : null;
        const longitude = hasValue(lonRaw) ? Number(lonRaw) : null;
        const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude);

        if (!date || !time) {
            showSynastryManualError('Укажите дату и время рождения партнёра.');
            return { ok: false, error: 'missing_datetime' };
        }
        if (!timezone) {
            showSynastryManualError('Выберите часовой пояс партнёра.');
            return { ok: false, error: 'missing_timezone' };
        }
        if (!place && !hasCoords) {
            showSynastryManualError('Укажите место рождения партнёра.');
            return { ok: false, error: 'missing_place' };
        }
        showSynastryManualError('');

        state.synastryManual = {
            name,
            date,
            time: time.length === 5 ? `${time}:00` : time,
            timezone,
            place: place || null,
            latitude: hasCoords ? latitude : null,
            longitude: hasCoords ? longitude : null,
        };
        state.synastryMode = 'manual';
        state.synastryPartnerId = '';
        setSynastryMode('manual');
        syncSynastryManualControlsFromState();
        invalidateCompositeCache();
        // Партнёр поменялся — ensureSynastryLayerActive зафиксирует конфиг и сбросит кэш слоя.
        schedulePersist();
        closeLayerPopover('synastry_partner');
        await ensureSynastryLayerActive({ lightweight: false });
        if (state.singleChartMode === 'composite') {
            await enterCompositeMode();
        }
        return { ok: true, label: name || t('page.forecastNew.resultViews.manualPartner') };
    }

    // cfg — снимок конфига синастрии слоя { mode, manual, partnerId }. По умолчанию
    // берём глобальный «scratch» (state.synastry*), который зеркалит выбранный слой.
    function synastryScratchConfig() {
        return { mode: state.synastryMode, manual: state.synastryManual, partnerId: state.synastryPartnerId };
    }
    function hasUsableSynastryPartner(cfg) {
        const c = cfg || synastryScratchConfig();
        if (c.mode === 'manual') {
            const m = c.manual;
            return !!(m && m.date && m.time && m.timezone && (m.place || (m.latitude !== null && m.longitude !== null)));
        }
        return !!c.partnerId;
    }

    function isSynastryMomentActive() {
        return selectedRightMethod() === 'synastry_partner';
    }

    function isSolarMomentActive() {
        return selectedRightMethod() === 'solar_return';
    }

    function normalizeSolarDateTime(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const [date, clock = ''] = raw.split('T');
        if (!date) return '';
        const time = String(clock || '').split(/[+\-Z]/)[0] || '12:00:00';
        return `${date}T${normalizeTime(time || '12:00:00')}`;
    }

    function getDisplayedSolarDateTime() {
        const infoDateTime = normalizeSolarDateTime(selectedViewModelLayer()?.raw?.solar_info?.solar_datetime_local);
        if (infoDateTime) return infoDateTime;
        const cfgDateTime = normalizeSolarDateTime(selectedLayerInstance()?.config?.datetime);
        if (cfgDateTime) return cfgDateTime;
        return `${state.solarYear || new Date().getFullYear()}-01-01T12:00:00`;
    }

    function getDisplayedMomentDateTime() {
        if (isSolarMomentActive()) {
            return getDisplayedSolarDateTime();
        }
        if (isSynastryMomentActive()) {
            const bd = selectedViewModelLayer()?.raw?.partner_chart?.birth_data;
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
        const bd = selectedViewModelLayer()?.raw?.partner_chart?.birth_data || {};
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
        if (isSolarMomentActive()) {
            const [date] = splitTargetDatetime(value);
            const nextYear = Number(String(date || '').slice(0, 4));
            if (Number.isFinite(nextYear)) {
                state.solarYear = Math.min(2100, Math.max(1900, Math.trunc(nextYear)));
            }
            const cfg = ensureLayerConfig(selectedLayerInstance());
            if (cfg) {
                cfg.year = state.solarYear;
                cfg.datetime = value;
                cfg.location = state.solarLocation ? { ...state.solarLocation } : null;
            }
            syncSolarInputs();
            invalidateLayerById(selectedLayerInstance()?.id);
            return;
        }
        if (!isSynastryMomentActive()) {
            setSelectedDateTime(value);
            commitSelectedLayerEdit();
            return;
        }
        const [date, time] = splitTargetDatetime(value);
        const manual = ensureManualSynastryPartnerForEdit();
        state.synastryManual = {
            ...manual,
            date,
            time,
        };
        commitSelectedLayerEdit();
        syncSynastryManualControlsFromState();
    }

    async function loadDisplayedMomentLayers(options = {}) {
        if (options.selectedOnly) {
            await loadSelectedMomentLayer(options);
            return;
        }
        if (isSynastryMomentActive()) {
            await ensureSynastryLayerActive(options);
            return;
        }
        await loadActiveLayers(options);
    }

    function scheduleDisplayedMomentLayerLoad(options = {}) {
        clearTimeout(state.displayedMomentLoadTimer);
        const delay = Number.isFinite(Number(options.delay)) ? Number(options.delay) : 140;
        const layerId = options.layerId || state.selectedRightLayerId;
        state.displayedMomentLoadTimer = setTimeout(() => {
            state.displayedMomentLoadTimer = null;
            void loadDisplayedMomentLayers({
                ...options,
                layerId,
                selectedOnly: true,
                lightweight: true,
            });
        }, delay);
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

    // Place/timezone shown in the moment card belong to the partner when synastry
    // is the selected layer (its "moment" is the partner's birth data), otherwise
    // to the transit moment (state.location / state.timezone).
    function getMomentPlaceView() {
        if (isSynastryMomentActive()) {
            if (state.synastryMode === 'manual' && state.synastryManual) {
                const m = state.synastryManual;
                return { name: m.place || '', latitude: m.latitude ?? null, longitude: m.longitude ?? null, timezone: m.timezone || '' };
            }
            const bd = selectedViewModelLayer()?.raw?.partner_chart?.birth_data || {};
            return { name: bd.place || '', latitude: numberOrNull(bd.latitude), longitude: numberOrNull(bd.longitude), timezone: bd.timezone || '' };
        }
        return { name: state.location?.name || '', latitude: state.location?.latitude ?? null, longitude: state.location?.longitude ?? null, timezone: state.timezone };
    }

    // Write an edited place/timezone back to the right target: the synastry
    // partner (switching it to manual, as editing a saved chart forks it) or the
    // transit moment. Mirrors how applyDisplayedMomentDateTime routes date/time.
    function commitMomentPlace({ name, latitude, longitude, sourceId, timezone }) {
        if (isSynastryMomentActive()) {
            const manual = ensureManualSynastryPartnerForEdit();
            state.synastryManual = {
                ...manual,
                place: name || '',
                latitude: numberOrNull(latitude),
                longitude: numberOrNull(longitude),
                timezone: timezone || manual.timezone,
            };
            commitSelectedLayerEdit();
            syncSynastryManualControlsFromState();
            return;
        }
        state.location = {
            name: name || '',
            latitude: numberOrNull(latitude),
            longitude: numberOrNull(longitude),
            sourceId: sourceId || null,
        };
        if (timezone) state.timezone = timezone;
        commitSelectedLayerEdit();
    }

    async function ensureSynastryLayerActive(options = {}) {
        if (!hasUsableSynastryPartner()) return;
        // Если выбран слой синастрии — правки относятся к нему; иначе берём первый
        // активный слой синастрии, а при отсутствии создаём новый.
        let target = selectedRightMethod() === 'synastry_partner'
            ? selectedLayerInstance()
            : instancesOfMethod('synastry_partner')[0];
        if (!target) {
            await activateLayer('synastry_partner', { openConfig: false });
            return;
        }
        state.selectedRightLayerId = target.id;
        captureScratchToConfig(target);   // зафиксировать отредактированного партнёра в слое
        invalidateLayerById(target.id);   // партнёр изменился — сбросить кэш этого слоя
        normalizeActiveLayers();
        renderRightLayerTabs();
        scheduleRightPanelRender();
        await loadActiveLayers(options);
    }

    function buildSynastryPartnerSource(cfg) {
        const c = cfg || synastryScratchConfig();
        if (c.mode === 'manual' && c.manual) {
            const m = c.manual;
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
        return { user_id: c.partnerId };
    }

    function bindWheelPanZoom() {
        const shell = refs.forecastNewWheelShell;
        if (!shell) return;
        let panning = false;
        let startX = 0;
        let startY = 0;
        let touchMode = null;
        let touchStartX = 0;
        let touchStartY = 0;
        let pinchStartDistance = 0;
        let pinchStartZoom = 1;
        let pinchStartMidX = 0;
        let pinchStartMidY = 0;
        let pinchStartPanX = 0;
        let pinchStartPanY = 0;
        shell.addEventListener('wheel', (event) => {
            event.preventDefault();
            setViewport({ zoom: state.viewport.zoom * (event.deltaY > 0 ? 0.96 : 1.04) });
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
        const touchDistance = (a, b) => Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
        const touchMidpoint = (a, b) => ({
            x: (a.clientX + b.clientX) / 2,
            y: (a.clientY + b.clientY) / 2,
        });
        const startPinch = (touches) => {
            const first = touches[0];
            const second = touches[1];
            const mid = touchMidpoint(first, second);
            touchMode = 'pinch';
            pinchStartDistance = Math.max(1, touchDistance(first, second));
            pinchStartZoom = state.viewport.zoom;
            pinchStartMidX = mid.x;
            pinchStartMidY = mid.y;
            pinchStartPanX = state.viewport.panX;
            pinchStartPanY = state.viewport.panY;
        };
        shell.addEventListener('touchstart', (event) => {
            if (event.touches.length === 1) {
                const touch = event.touches[0];
                touchMode = 'pan';
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;
            } else if (event.touches.length >= 2) {
                event.preventDefault();
                startPinch(event.touches);
            }
        }, { passive: false });
        shell.addEventListener('touchmove', (event) => {
            if (event.touches.length >= 2) {
                event.preventDefault();
                const first = event.touches[0];
                const second = event.touches[1];
                if (touchMode !== 'pinch' || !pinchStartDistance) {
                    startPinch(event.touches);
                }
                const mid = touchMidpoint(first, second);
                const zoom = pinchStartZoom * (touchDistance(first, second) / pinchStartDistance);
                setViewport({
                    zoom,
                    panX: pinchStartPanX + (mid.x - pinchStartMidX),
                    panY: pinchStartPanY + (mid.y - pinchStartMidY),
                }, { persist: false });
                return;
            }
            if (event.touches.length === 1 && touchMode === 'pan') {
                event.preventDefault();
                const touch = event.touches[0];
                const dx = touch.clientX - touchStartX;
                const dy = touch.clientY - touchStartY;
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;
                setViewport({ panX: state.viewport.panX + dx, panY: state.viewport.panY + dy }, { persist: false });
            }
        }, { passive: false });
        shell.addEventListener('touchend', (event) => {
            if (event.touches.length >= 2) {
                startPinch(event.touches);
                return;
            }
            if (event.touches.length === 1) {
                const touch = event.touches[0];
                touchMode = 'pan';
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;
                schedulePersist();
                return;
            }
            if (touchMode) schedulePersist();
            touchMode = null;
            pinchStartDistance = 0;
        }, { passive: true });
        shell.addEventListener('touchcancel', () => {
            if (touchMode) schedulePersist();
            touchMode = null;
            pinchStartDistance = 0;
        }, { passive: true });
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
        const momentPlace = getMomentPlaceView();
        if (refs.timezoneInput) refs.timezoneInput.value = normalizeTimezoneValue(momentPlace.timezone, momentPlace.name) || '';
        if (refs.locationInput) refs.locationInput.value = momentPlace.name || '';
        if (refs.latitudeInput) refs.latitudeInput.value = momentPlace.latitude ?? '';
        if (refs.longitudeInput) refs.longitudeInput.value = momentPlace.longitude ?? '';
        if (refs.houseSystemSelect) refs.houseSystemSelect.value = normalizeHouseSystemCode(state.pageSettings.houseSystem);
        state.compositeMethod = normalizeCompositeMethod(state.compositeMethod || state.pageSettings.compositeMethod);
        state.pageSettings.compositeMethod = state.compositeMethod;
        refs.compositeMethodSettingsSection?.classList.toggle('hidden', state.singleChartMode !== 'composite');
        if (refs.compositeMethodSelect) refs.compositeMethodSelect.value = state.compositeMethod;
        syncZodiacControlsFromNatal();
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
        if (refs.showDeclinationAspectsToggle) refs.showDeclinationAspectsToggle.checked = state.pageSettings.showDeclinationAspects === true;
        if (refs.angleAscDscBoldToggle) refs.angleAscDscBoldToggle.checked = state.pageSettings.angleAscDscBold !== false;
        if (refs.angleMcIcBoldToggle) refs.angleMcIcBoldToggle.checked = state.pageSettings.angleMcIcBold !== false;
        if (refs.showSpeedToggle) refs.showSpeedToggle.checked = state.pageSettings.showSpeed !== false;
        if (refs.showStationaryToggle) refs.showStationaryToggle.checked = state.pageSettings.showStationary !== false;
        if (refs.forecastNewDirectionTypeSelect) refs.forecastNewDirectionTypeSelect.value = normalizeDirectionType(state.directionType);
        refs.layerToggles.forEach((input) => {
            input.checked = hasActiveMethod(input.dataset.layerToggle);
        });
        syncSolarInputs();
        syncMomentCardLayout();
        updateHeaderInfo();
        updatePrognosticTimeMeta();
        renderMatrixEditor();
        renderAspectTypeToggles();
        applyViewport();
    }

    // Mirror state.solarYear / state.solarLocation into both solar editors:
    // the gear popover on the layer toggle and the "Date / time" moment card.
    function syncSolarInputs() {
        const year = String(state.solarYear);
        const name = state.solarLocation?.name || '';
        const lat = state.solarLocation?.latitude;
        const lon = state.solarLocation?.longitude;
        const latStr = lat !== null && lat !== undefined ? String(lat) : '';
        const lonStr = lon !== null && lon !== undefined ? String(lon) : '';
        if (refs.forecastNewSolarYearInput) refs.forecastNewSolarYearInput.value = year;
        if (refs.forecastNewSolarLocationInput) refs.forecastNewSolarLocationInput.value = name;
        if (refs.forecastNewSolarLat) refs.forecastNewSolarLat.value = latStr;
        if (refs.forecastNewSolarLon) refs.forecastNewSolarLon.value = lonStr;
        if (refs.momentSolarYearInput) refs.momentSolarYearInput.value = year;
        if (refs.momentSolarLocationInput) refs.momentSolarLocationInput.value = name;
        if (refs.momentSolarLat) refs.momentSolarLat.value = latStr;
        if (refs.momentSolarLon) refs.momentSolarLon.value = lonStr;
    }

    // When solar_return is the selected layer the moment card edits the solar
    // chart (year + place), not the irrelevant transit date/location.
    function syncMomentCardLayout() {
        const card = refs.forecastNewMomentCard;
        if (!card) return;
        const isSolar = selectedRightMethod() === 'solar_return';
        card.querySelector('[data-moment-transit]')?.classList.toggle('hidden', isSolar);
        card.querySelector('[data-moment-solar]')?.classList.toggle('hidden', !isSolar);
    }

    async function applySolarYear(rawYear) {
        const year = Number(rawYear);
        state.solarYear = Number.isFinite(year)
            ? Math.min(2100, Math.max(1900, Math.trunc(year)))
            : new Date().getFullYear();
        const cfg = ensureLayerConfig(selectedLayerInstance());
        if (cfg && selectedRightMethod() === 'solar_return') {
            cfg.year = state.solarYear;
            cfg.datetime = `${state.solarYear}-01-01T12:00:00`;
            cfg.location = state.solarLocation ? { ...state.solarLocation } : null;
        }
        syncSolarInputs();
        renderOrUpdateTimeStepper();
        schedulePersist();
        if (hasActiveMethod('solar_return')) {
            await loadActiveLayers({ lightweight: true });
        }
    }

    async function applySolarLocationSelection(item) {
        const latitude = item.lat ?? item.latitude ?? null;
        const longitude = item.lon ?? item.longitude ?? null;
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
        syncSolarInputs();
        const selInst = selectedLayerInstance();
        captureScratchToConfig(selInst);
        const cacheKey = buildLayerCacheKey(selInst || 'solar_return');
        invalidateLayerById(selInst?.id);
        sessionStorage.removeItem(LAYER_CACHE_PREFIX + cacheKey);
        schedulePersist();
        if (hasActiveMethod('solar_return')) {
            void loadActiveLayers({ lightweight: false });
        }
    }

    function clearSolarLocation() {
        state.solarLocation = null;
        syncSolarInputs();
        if (hasActiveMethod('solar_return')) {
            commitSelectedLayerEdit();
            void loadActiveLayers({ lightweight: false });
        }
        schedulePersist();
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
                const guessedTimezone = window.Timezones?.guess?.(place) || null;
                commitMomentPlace({
                    name: refs.locationInput.value.trim(),
                    latitude: null,
                    longitude: null,
                    sourceId: null,
                    timezone: guessedTimezone,
                });
                if (refs.latitudeInput) refs.latitudeInput.value = '';
                if (refs.longitudeInput) refs.longitudeInput.value = '';
                if (guessedTimezone && refs.timezoneInput) refs.timezoneInput.value = guessedTimezone;
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

                commitMomentPlace({
                    name: item.shortName || item.displayName,
                    latitude: item.lat,
                    longitude: item.lon,
                    sourceId: item.sourceId || null,
                    timezone: resolvedTimezone || null,
                });
                updatePrognosticTimeMeta();
                syncControlsFromState();
                schedulePersist();
                await loadDisplayedMomentLayers();
            },
        });
    }

    function normalizeZodiac(value) {
        return String(value || 'tropical').toLowerCase() === 'sidereal' ? 'sidereal' : 'tropical';
    }

    function normalizeAyanamsha(value) {
        const normalized = String(value || 'lahiri').toLowerCase();
        return VALID_AYANAMSHAS.includes(normalized) ? normalized : 'lahiri';
    }

    function syncZodiacControlsFromNatal() {
        const birth = state.natalData?.birth_data || {};
        const zodiac = normalizeZodiac(birth.zodiac);
        const ayanamsha = normalizeAyanamsha(birth.ayanamsha);
        if (refs.zodiacSelect) refs.zodiacSelect.value = zodiac;
        if (refs.ayanamshaSelect) {
            refs.ayanamshaSelect.value = ayanamsha;
            refs.ayanamshaSelect.disabled = zodiac !== 'sidereal';
        }
    }

    function handleLocationInput() {
        const nextValue = refs.locationInput?.value?.trim() || '';
        const normalizedSelected = normalizeLooseText(getMomentPlaceView().name);
        const normalizedNext = normalizeLooseText(nextValue);
        if (!normalizedNext || normalizedNext !== normalizedSelected) {
            commitMomentPlace({ name: nextValue, latitude: null, longitude: null, sourceId: null });
            if (refs.latitudeInput) refs.latitudeInput.value = '';
            if (refs.longitudeInput) refs.longitudeInput.value = '';
            updatePrognosticTimeMeta();
        }
    }

    function applyLocationInputsToState() {
        const timezone = normalizeTimezoneValue(refs.timezoneInput?.value?.trim(), refs.locationInput?.value?.trim())
            || normalizeTimezoneValue(state.timezone, refs.locationInput?.value?.trim())
            || 'UTC';
        commitMomentPlace({
            name: refs.locationInput?.value?.trim() || '',
            latitude: refs.latitudeInput?.value,
            longitude: refs.longitudeInput?.value,
            sourceId: state.location?.sourceId || null,
            timezone,
        });
    }

    function updateHeaderInfo() {
        const birth = state.natalData?.birth_data || {};
        const name = [birth.first_name, birth.last_name].filter(Boolean).join(' ').trim();
        refs.forecastNewTitle.textContent = name;
        refs.forecastNewSubtitle.textContent = buildNatalHeaderSubtitle(birth);
        updateNatalMomentMeta();
    }

    function updateNatalMomentMeta() {
        const birth = state.natalData?.birth_data || {};
        if (refs.natalPanelTitle) {
            refs.natalPanelTitle.textContent = chartDisplayTitle(
                state.natalData,
                t('page.forecastNew.natalPanelTitle'),
            );
        }
        const summary = buildPanelLocationMeta(
            state.natalLocation?.name || birth.place || '',
            state.natalTimezone || birth.timezone,
            state.natalSelectedDateTime,
        );
        if (refs.natalPanelMeta) refs.natalPanelMeta.textContent = summary;
        if (refs.natalDatetimeLabel) refs.natalDatetimeLabel.textContent = formatChartDateTimeLabel(state.natalSelectedDateTime);
    }

    function updatePrognosticTimeMeta() {
        if (refs.targetDatetimeLabel) refs.targetDatetimeLabel.textContent = formatChartDateTimeLabel(getDisplayedMomentDateTime());
        if (refs.prognosticPanelMeta) refs.prognosticPanelMeta.textContent = buildPrognosticMomentSummary();
    }

    // Compact meta for a solar layer: year + the COMPUTED solar moment
    // (date · time · TZ offset of the solar place) + location. The moment is
    // shown like every other method because it drifts from the birthday — the
    // Sun returns to its natal longitude ~6 h later each year.
    function buildSolarMomentMeta(solarInfo, { year } = {}) {
        const info = solarInfo || {};
        const resolvedYear = String(year || info.year || '');
        const locName = info?.location?.name
            || state.solarLocation?.name
            || state.location?.name
            || '';
        const [solarDate, solarClock] = String(info.solar_datetime_local || '').split('T');
        const solarTime = (solarClock || '').slice(0, 5);
        const moment = [
            [solarDate ? formatChartDate(solarDate) : '', solarTime].filter(Boolean).join(' '),
            formatHeaderTimezone(info.timezone, { date: solarDate, time: solarTime }),
        ].filter(Boolean).join(' · ');
        return [resolvedYear, moment, locName].filter(Boolean).join(' · ');
    }

    function buildPrognosticMomentSummary() {
        const method = selectedRightMethod();

        if (method === 'solar_return') {
            return buildSolarMomentMeta(selectedViewModelLayer()?.raw?.solar_info, { year: state.solarYear });
        }

        const place = getMomentPlaceView();
        return buildPanelLocationMeta(
            place.name,
            place.timezone,
            getDisplayedMomentDateTime(),
        );
    }

    function toggleMomentEditor() {
        const isOpen = refs.forecastNewMomentCard?.classList.contains('hidden') !== false;
        setMomentEditorOpen(isOpen);
    }

    function setMomentEditorOpen(isOpen) {
        refs.forecastNewMomentCard?.classList.toggle('hidden', !isOpen);
        refs.prognosticMomentToggle?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    // Build the date portion of a time stepper, ordering the day/month/year
    // groups and choosing the separator from the account date-format preference.
    function buildStepperDateGroup(segmentMarkup, ariaLabel) {
        const yearGroup = `<span class="forecast-new-time-stepper-group forecast-new-time-stepper-group--year">${segmentMarkup('yearThousands')}${segmentMarkup('yearHundreds')}${segmentMarkup('yearTens')}${segmentMarkup('yearOnes')}</span>`;
        const monthGroup = `<span class="forecast-new-time-stepper-group forecast-new-time-stepper-group--month">${segmentMarkup('monthTens')}${segmentMarkup('monthOnes')}</span>`;
        const dayGroup = `<span class="forecast-new-time-stepper-group forecast-new-time-stepper-group--day">${segmentMarkup('dayTens')}${segmentMarkup('dayOnes')}</span>`;
        const fmt = String(window.AstroPreferences?.getDateFormat?.() || 'DD_MM_YYYY').trim().toUpperCase();
        let order = [dayGroup, monthGroup, yearGroup];
        let sep = '.';
        if (fmt === 'MM_DD_YYYY') {
            order = [monthGroup, dayGroup, yearGroup];
            sep = '/';
        } else if (fmt === 'YYYY_MM_DD') {
            order = [yearGroup, monthGroup, dayGroup];
            sep = '-';
        }
        const separator = `<span class="forecast-new-time-stepper-separator" aria-hidden="true">${sep}</span>`;
        return `<span class="forecast-new-time-stepper-group forecast-new-time-stepper-group--date" aria-label="${escapeHtml(ariaLabel)}">${order.join(separator)}</span>`;
    }

    function focusAdjacentTimeStepperSegment(root, currentSegmentEl, direction) {
        if (!root || !currentSegmentEl) return;
        const segments = Array.from(root.querySelectorAll('[data-time-step-key]'));
        const currentIndex = segments.indexOf(currentSegmentEl);
        if (currentIndex < 0) return;
        const nextIndex = Math.min(Math.max(currentIndex + direction, 0), segments.length - 1);
        segments[nextIndex]?.focus();
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
                ${buildStepperDateGroup(segmentMarkup, 'Дата')}
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
                ${buildStepperDateGroup(segmentMarkup, 'Дата рождения')}
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
        // Two solar-place editors share the same state: the gear popover on the
        // layer toggle and the "Date / time" moment card.
        attachSolarLocationAutocomplete(refs.forecastNewSolarLocationInput, refs.forecastNewSolarLocationSuggestions);
        attachSolarLocationAutocomplete(refs.momentSolarLocationInput, refs.momentSolarLocationSuggestions);
    }

    function attachSolarLocationAutocomplete(input, suggestions) {
        if (!window.PlaceAutocomplete || !input || !suggestions) return;
        window.PlaceAutocomplete.attach({
            input,
            suggestions,
            minChars: 2,
            debounceMs: 350,
            limit: 5,
            getLabel: (item) => item.shortName || item.displayName,
            onInput: () => {
                // Coordinates are stale once the user edits the query manually, but do
                // NOT rewrite the text inputs here — that would clobber what's being typed.
                state.solarLocation = state.solarLocation
                    ? { ...state.solarLocation, latitude: null, longitude: null, sourceId: null }
                    : null;
                if (refs.forecastNewSolarLat) refs.forecastNewSolarLat.value = '';
                if (refs.forecastNewSolarLon) refs.forecastNewSolarLon.value = '';
                if (refs.momentSolarLat) refs.momentSolarLat.value = '';
                if (refs.momentSolarLon) refs.momentSolarLon.value = '';
            },
            onSelect: (item) => { void applySolarLocationSelection(item); },
        });

        // Clear solar location when input is emptied
        input.addEventListener('change', () => {
            if (!input.value.trim()) clearSolarLocation();
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
            invalidateAuxBlockCache();
            abortAllInFlightLayerRequests();
            setNatalLightweightLoading(false);
            renderStaticNatal();
            renderWheel();
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

    function isCompositeSingleMode() {
        return state.wheelView === 'single' && state.singleChartMode === 'composite' && !!state.compositeChartData;
    }

    function activeBaseChartData() {
        return isCompositeSingleMode() ? state.compositeChartData : state.natalData;
    }

    function activeBaseWheelData() {
        return isCompositeSingleMode()
            ? (window.NatalWheelData?.prepareNatalWheelData
                ? window.NatalWheelData.prepareNatalWheelData(state.compositeChartData, { houseSystem: state.pageSettings.houseSystem })
                : state.compositeChartData)
            : state.natalWheelData;
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
        const chartData = activeBaseWheelData();
        state.natalRenderer?.setAspectTypeFilter?.('all');
        state.natalRenderer?.setHouseNumberStyle?.(state.pageSettings.houseNumberStyle);
        state.natalRenderer?.setDisplayPreferences?.({
            showSpeed: state.pageSettings.showSpeed !== false,
            showStationary: state.pageSettings.showStationary !== false,
            showApplyingSeparating: state.pageSettings.showApplyingSeparating === true,
            showAspectText: state.pageSettings.showAspectText === true,
        });
        state.natalRenderer?.render(filterChartDataForSidePanel(chartData, { scope: 'natal' }));
        renderForecastNewDispositorBlocks('natal', chartData);
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

    function buildLayerDispositorChartData(layer = {}) {
        const raw = layer.raw && typeof layer.raw === 'object' ? layer.raw : {};
        return {
            ...raw,
            planets: raw.planets || layer.bodies || [],
            houses: raw.houses || layer.houses || [],
            balances: raw.balances || layer.balances || null,
            cosmogram_pattern: raw.cosmogram_pattern || layer.cosmogram_pattern || null,
        };
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
        const baseData = activeBaseWheelData();
        if (!baseData) return;
        const rawViewModel = window.PrognosticLayerNormalizer.buildViewModel(
            baseData,
            state.layers || {},
            { activeInstances: isCompositeSingleMode() ? [] : state.activeLayers },
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
            filterChartDataForSidePanel(activeBaseWheelData(), { scope: 'natal' })
        );

        const layer = state.viewModel?.activePrognosticLayers?.find((item) => item.id === state.selectedRightLayerId)
            || state.viewModel?.activePrognosticLayers?.find((item) => item.method === selectedRightMethod());
        if (layer) {
            updateRendererMatrixSensitiveData(state.prognosticRenderer, filterChartDataForSidePanel({
                planets: layer.bodies || [],
                houses: layer.houses || [],
                aspects: layer.aspects || [],
                aspect_configurations: layer.aspect_configurations || [],
                stelliums: layer.stelliums || [],
                balances: layer.balances || null,
                cosmogram_pattern: layer.cosmogram_pattern || null,
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
            compositeMethod: normalizeCompositeMethod(resolved?.view_options?.composite_method || state.pageSettings.compositeMethod || state.compositeMethod),
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
        const nextHouseSystem = normalizeHouseSystemCode(refs.houseSystemSelect?.value || state.pageSettings.houseSystem);
        const nextCompositeMethod = normalizeCompositeMethod(refs.compositeMethodSelect?.value || state.compositeMethod || state.pageSettings.compositeMethod);
        const nextZodiac = normalizeZodiac(refs.zodiacSelect?.value || state.natalData?.birth_data?.zodiac);
        const nextAyanamsha = normalizeAyanamsha(refs.ayanamshaSelect?.value || state.natalData?.birth_data?.ayanamsha);
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
            compositeMethod: nextCompositeMethod,
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
            showDeclinationAspects: refs.showDeclinationAspectsToggle?.checked === true,
            angleAscDscBold: state.pageSettings.angleAscDscBold !== false,
            angleMcIcBold: state.pageSettings.angleMcIcBold !== false,
            houseNumberStyle: state.pageSettings.houseNumberStyle === 'roman' ? 'roman' : 'arabic',
            houseLabelsOutside: state.pageSettings.houseLabelsOutside === true,
            showTransitCusps: refs.showTransitCuspsToggle?.checked !== false,
            showProgressionCusps: refs.showProgressionCuspsToggle?.checked !== false,
            showDirectionCusps: refs.showDirectionCuspsToggle?.checked !== false,
        };
        state.compositeMethod = nextCompositeMethod;
        window.AstroPreferences?.saveChartViewDraft?.({
            chart_kind: 'natal',
            chart_id: state.userId,
            view_type: 'forecast_new',
        }, getResolvedForecastNewViewSettings());

        if (refs.iconScaleValue) {
            refs.iconScaleValue.textContent = `${Math.round(iconScale * 100)}%`;
        }

        const currentZodiac = normalizeZodiac(state.natalData?.birth_data?.zodiac);
        const currentAyanamsha = normalizeAyanamsha(state.natalData?.birth_data?.ayanamsha);
        if (nextZodiac !== currentZodiac || (nextZodiac === 'sidereal' && nextAyanamsha !== currentAyanamsha)) {
            await updateZodiac(nextZodiac, nextAyanamsha);
        } else if (state.singleChartMode === 'composite' && (
            previousSettings.houseSystem !== state.pageSettings.houseSystem
            || previousSettings.compositeMethod !== state.pageSettings.compositeMethod
        )) {
            await loadCompositeChart({ force: true });
        } else if (state.pageSettings.houseSystem !== normalizeHouseSystemCode(state.natalData?.birth_data?.house_system || 'P')) {
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
                'showDeclinationAspects',
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

    async function updateZodiac(nextZodiac, nextAyanamsha) {
        if (!state.userId || !window.AstroAPI?.updateUserZodiac) {
            renderStaticNatal();
            renderRightPanel();
            renderWheel();
            return;
        }

        try {
            const natalData = await window.AstroAPI.updateUserZodiac(state.userId, nextZodiac, nextAyanamsha);
            state.natalData = natalData;
            state.natalWheelData = window.NatalWheelData?.prepareNatalWheelData
                ? window.NatalWheelData.prepareNatalWheelData(natalData, { houseSystem: state.pageSettings.houseSystem })
                : natalData;
            state.profectionsData = null;
            state.antisciaData = null;
            state.asteroidsData = null;
            state.dominantsData = null;
            state.fixstarsData = null;
            invalidateAuxBlockCache();
            updateHeaderInfo();
            syncZodiacControlsFromNatal();
            renderStaticNatal();
            await loadActiveLayers();
        } catch (error) {
            console.error('Forecast New zodiac update failed:', error);
            syncZodiacControlsFromNatal();
        }
    }

    function onTargetDatetimeChange() {
        const date = refs.targetDateInput?.value || splitTargetDatetime(getDisplayedMomentDateTime())[0];
        const time = refs.targetTimeInput?.value || '12:00:00';
        applyDisplayedMomentDateTime(`${date}T${normalizeTime(time)}`);
        state.lastStepperAction = null;
        syncControlsFromState();
        schedulePersist();
        scheduleDisplayedMomentLayerLoad({ lightweight: true, delay: 180 });
    }

    // Apply a saved chart (date/time/place) as the prognostic moment of the active layer.
    async function applySavedChartMoment(chart) {
        if (chart?.chart_kind === 'composite') {
            await loadSavedCompositeChart(
                chart.composite_chart_id || chart.composite_saved_chart_id
            );
            return;
        }
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
        ensureLayerConfig(selectedLayerInstance()).chartTitle = chartDisplayTitle(chart);
        commitSelectedLayerEdit();
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
                title: chart?.title || null,
                display_title: chartDisplayTitle(chart),
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
        ensureLayerConfig(selectedLayerInstance()).chartTitle = chartDisplayTitle(chart);
        const id = chart?.user_id || chart?.chart_id || '';
        if (id) {
            state.synastryMode = 'db';
            state.synastryPartnerId = String(id);
            state.synastryManual = buildManualSynastryFromMoment(moment, chart);
            invalidateCompositeCache();
            if (refs.forecastNewSynastryPartnerSelect) {
                const select = refs.forecastNewSynastryPartnerSelect;
                if (!Array.from(select.options).some((opt) => opt.value === String(id))) {
                    const opt = document.createElement('option');
                    opt.value = String(id);
                    opt.textContent = chartOptionLabel(chart);
                    select.appendChild(opt);
                }
                select.value = String(id);
            }
            setSynastryMode('db');
        } else {
            state.synastryMode = 'manual';
            state.synastryPartnerId = '';
            state.synastryManual = buildManualSynastryFromMoment(moment, chart);
            invalidateCompositeCache();
            setSynastryMode('manual');
            syncSynastryManualControlsFromState();
        }
        // ensureSynastryLayerActive зафиксирует конфиг и сбросит кэш слоя.
        state.lastStepperAction = null;
        syncControlsFromState();
        schedulePersist();
        await ensureSynastryLayerActive({ lightweight: true });
        if (state.singleChartMode === 'composite') {
            await enterCompositeMode();
        }
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
        scheduleDisplayedMomentLayerLoad({ layerId: state.selectedRightLayerId });
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
        scheduleDisplayedMomentLayerLoad({ layerId: state.selectedRightLayerId });
    }

    async function loadActiveLayers(options = {}) {
        clearTimeout(state.displayedMomentLoadTimer);
        state.displayedMomentLoadTimer = null;
        const seq = ++state.requestSeq;
        state.pendingRequestToken = seq;
        const activeInstances = [...state.activeLayers];
        const activeIds = activeInstances.map((l) => l.id);
        // Synastry can't be computed until a partner is chosen. Toggling it on opens the
        // partner popover (see the layer toggle handler); skip loading the layer until a
        // partner exists so one un-configured layer can't throw and tear down the layers
        // that did load (transit/progression/solar).
        const instancesToLoad = activeInstances.filter((inst) =>
            inst.method !== 'synastry_partner' || hasUsableSynastryPartner(layerConfigOf(inst)));
        const nextLayers = {};
        let hasRenderedPartial = false;
        const hasCompletePreviousLayers = instancesToLoad.length > 0
            && instancesToLoad.every((inst) => state.layers?.[inst.id]);
        if (options.showLoader) showLoader();
        if (options.lightweight) setLightweightLoading(true);
        state.layers = Object.fromEntries(activeIds
            .filter((id) => state.layers?.[id])
            .map((id) => [id, state.layers[id]]));
        renderRightLayerTabs();
        try {
            const results = await Promise.allSettled(instancesToLoad.map(async (inst) => {
                const data = await fetchLayer(inst, { seq });
                if (seq !== state.requestSeq) return null;
                nextLayers[inst.id] = data;
                if (!hasCompletePreviousLayers && !options.waitForComplete) {
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
            state.lastCalculatedTransitDateTime = activeInstances.some((l) => l.method === 'transit') ? state.selectedDateTime : state.lastCalculatedTransitDateTime;
            state.lastCalculatedPrognosticDate = splitTargetDatetime(state.selectedDateTime)[0];
            if (!hasRenderedPartial || hasCompletePreviousLayers || options.waitForComplete) renderWheel();
            renderRightLayerTabs();
            scheduleRightPanelRender();
            showLayout();
            renderNowBlocks();
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

    async function loadSelectedMomentLayer(options = {}) {
        const inst = options.layerId ? findLayerInstance(options.layerId) : selectedLayerInstance();
        if (!inst || (!isMomentMethod(inst.method) && inst.method !== 'synastry_partner')) {
            await loadActiveLayers(options);
            return;
        }
        if (inst.method === 'synastry_partner' && !hasUsableSynastryPartner(layerConfigOf(inst))) return;

        const seq = ++state.requestSeq;
        state.pendingRequestToken = seq;
        if (options.lightweight) setLightweightLoading(true);
        const activeIds = state.activeLayers.map((layer) => layer.id);
        state.layers = Object.fromEntries(activeIds
            .filter((id) => state.layers?.[id])
            .map((id) => [id, state.layers[id]]));
        try {
            const data = await fetchLayer(inst, { seq });
            if (seq !== state.requestSeq) return;
            state.layers = {
                ...(state.layers || {}),
                [inst.id]: data,
            };
            if (inst.method === 'transit') state.lastCalculatedTransitDateTime = state.selectedDateTime;
            if (isMomentMethod(inst.method)) state.lastCalculatedPrognosticDate = splitTargetDatetime(getDisplayedMomentDateTime())[0];
            renderWheel();
            renderRightLayerTabs();
            scheduleRightPanelRender();
            renderNowBlocks();
            schedulePersist();
            scheduleAdjacentLayerPrefetch();
        } catch (error) {
            if (seq !== state.requestSeq) return;
            if (isAbortError(error)) return;
            console.error('Forecast New selected layer load failed:', error);
            showError(error.message || 'Ошибка загрузки прогностики');
        } finally {
            if (seq === state.requestSeq) {
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

    async function fetchLayer(layer, options = {}) {
        // layer — инстанс { id, method } либо строка-метод (для standalone-вызовов).
        const method = typeof layer === 'string' ? layer : layer.method;
        const layerId = typeof layer === 'string' ? layer : layer.id;
        // Момент (дата/время/место/тип дирекции) берём из конфига слоя; options.* —
        // переопределение для префетча соседних дат.
        const moment = isMomentMethod(method) ? layerConfigOf(layer) : {};
        const targetDateTime = options.targetDateTime || moment.datetime || state.selectedDateTime;
        const targetTimezone = options.timezone || moment.timezone || state.timezone;
        const targetLocation = options.location || moment.location || state.location || {};
        const targetDirectionType = moment.directionType || state.directionType;
        const [date, time] = splitTargetDatetime(targetDateTime);
        const key = buildLayerCacheKey(layer, date, {
            selectedDateTime: targetDateTime,
            timezone: targetTimezone,
            location: targetLocation,
            directionType: targetDirectionType,
        });
        if (state.cache[key]) return state.cache[key];
        const cachedLayer = readPersistedLayerCache(key);
        if (cachedLayer) {
            state.cache[key] = cachedLayer;
            return cachedLayer;
        }
        if (state.inFlight[key]) return state.inFlight[key];
        if (!options.prefetch) {
            abortInFlightLayerInstance(layerId, key);
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
                const solarCfg = layerConfigOf(layer);
                const solarLoc = solarCfg.location;
                const solarDateTime = options.targetDateTime || solarCfg.datetime || getDisplayedSolarDateTime();
                const [solarDate] = splitTargetDatetime(solarDateTime);
                const solarYear = Number(String(solarDate || '').slice(0, 4));
                const solarBody = {
                    ...natalSource,
                    year: Number.isFinite(Number(solarCfg.year))
                        ? Number(solarCfg.year)
                        : (Number.isFinite(solarYear) ? solarYear : state.solarYear),
                    save_to_db: false,
                };
                if (solarLoc?.latitude !== null && solarLoc?.latitude !== undefined) {
                    solarBody.location_latitude = solarLoc.latitude;
                    solarBody.location_longitude = solarLoc.longitude;
                    if (solarLoc.name) solarBody.location_name = solarLoc.name;
                    if (solarLoc.timezone) solarBody.location_timezone = solarLoc.timezone;
                }
                return apiPost('/solar/calculate', solarBody, { signal: controller.signal });
            }
            if (method === 'synastry_partner') {
                const synCfg = layerConfigOf(layer);
                if (!hasUsableSynastryPartner(synCfg)) {
                    throw new Error(synCfg.mode === 'manual'
                        ? 'Заполните данные партнёра для синастрии'
                        : 'Выберите партнёра для синастрии');
                }
                // primary = тот же источник натала, что у остальных слоёв (saved или inline)
                return apiPost('/synastry/calculate', {
                    primary: natalSource,
                    partner: buildSynastryPartnerSource(synCfg),
                }, { signal: controller.signal }).then((resp) => ({
                    partner_chart: resp.partner_chart,
                    inter_aspects: resp.inter_aspects,
                }));
            }
            return apiPost('/directions/calculate', {
                ...natalSource,
                target_date: date,
                direction_type: normalizeDirectionType(targetDirectionType),
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
            if (state.inFlightById[layerId]?.key === key) {
                delete state.inFlightById[layerId];
            }
        });

        state.inFlight[key] = request;
        state.inFlightByKey[key] = controller;
        if (!options.prefetch) {
            state.inFlightById[layerId] = { key, controller };
        }
        return request;
    }

    function abortInFlightLayerInstance(layerId, nextKey) {
        const inFlight = state.inFlightById[layerId];
        if (!inFlight || inFlight.key === nextKey) return;
        inFlight.controller?.abort?.();
        delete state.inFlight[inFlight.key];
        delete state.inFlightByKey[inFlight.key];
        delete state.inFlightById[layerId];
    }

    function abortAllInFlightLayerRequests() {
        Object.values(state.inFlightByKey || {}).forEach((controller) => {
            controller?.abort?.();
        });
        state.inFlight = {};
        state.inFlightByKey = {};
        state.inFlightById = {};
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
        // Степпер двигает момент ВЫБРАННОГО слоя — префетчим только его соседнюю дату.
        const inst = selectedLayerInstance();
        if (!inst || !isMomentMethod(inst.method)) return;
        await fetchLayer(inst, {
            targetDateTime: nextDateTime,
            timezone: state.timezone,
            location: state.location,
            prefetch: true,
        });
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
        syncSolarInputs();
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
            const response = await fetch(`${API_BASE}/charts`, { credentials: 'include' });
            if (!response.ok) return;
            const charts = await response.json();
            const currentId = String(state.userId || '');
            const options = (Array.isArray(charts) ? charts : [])
                .filter((chart) => String(chart.user_id) !== currentId)
                .map((chart) => {
                    const id = String(chart.user_id || chart.chart_id || '');
                    if (!id) return '';
                    return `<option value="${escapeHtml(id)}">${escapeHtml(chartOptionLabel(chart))}</option>`;
                })
                .filter(Boolean)
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
        const baseData = activeBaseWheelData();
        if (!state.wheel || !baseData) return;
        const rawViewModel = window.PrognosticLayerNormalizer.buildViewModel(
            baseData,
            state.layers || {},
            { activeInstances: isCompositeSingleMode() ? [] : state.activeLayers },
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
            showDeclinationAspects: state.pageSettings.showDeclinationAspects === true,
            declinationAspects: state.natalWheelData?.declination_aspects || [],
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

    function setWheelView(view, options = {}) {
        const next = view === 'single' ? 'single' : 'multi';
        const nextSingleMode = next === 'single'
            ? (options.singleChartMode === 'composite' ? 'composite' : 'natal')
            : 'natal';
        if (state.wheelView === next && state.singleChartMode === nextSingleMode) return;
        state.wheelView = next;
        state.singleChartMode = nextSingleMode;
        syncWorkspaceModePanels();
        syncWheelViewButtons();
        renderStaticNatal();
        refreshViewModel();
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
        document.body.classList.toggle('forecast-new-composite-mode', state.singleChartMode === 'composite');
        syncMobilePanelLabels();
        syncRelationshipSwitch();
        refs.forecastNewProgPanel?.setAttribute('data-panel-mode', isSingle ? 'natal' : 'prognostic');
        // Rebuild chrome for the new mode's layout (panels.single vs panels.multi).
        if (state.panelLayout) renderPanels();
    }

    function syncRelationshipSwitch() {
        const hasRelationshipContext = hasActiveMethod('synastry_partner')
            || state.singleChartMode === 'composite'
            || hasUsableSynastryPartner();
        refs.forecastNewRelationshipSwitch?.classList.toggle('hidden', !hasRelationshipContext);
        const compositeActive = state.singleChartMode === 'composite';
        refs.forecastNewRelationshipSynastryBtn?.classList.toggle('is-active', !compositeActive);
        refs.forecastNewRelationshipCompositeBtn?.classList.toggle('is-active', compositeActive);
        refs.forecastNewRelationshipSynastryBtn?.setAttribute('aria-selected', compositeActive ? 'false' : 'true');
        refs.forecastNewRelationshipCompositeBtn?.setAttribute('aria-selected', compositeActive ? 'true' : 'false');
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
        // activePrognosticLayers уже отсортирован buildViewModel по порядку инстансов;
        // каждый инстанс (включая дубли одного метода) попадает в результат отдельной строкой.
        return [...(state.viewModel?.activePrognosticLayers || [])];
    }

    // Подпись слоя с порядковым номером при дублях метода («Транзит 2»).
    function resultLayerLabel(layer, layers) {
        const base = layerLabel(layer.method);
        const sameMethod = layers.filter((l) => l.method === layer.method);
        if (sameMethod.length <= 1) return base;
        const ordinal = sameMethod.indexOf(layer) + 1;
        return `${base} ${ordinal}`;
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
                        <tr data-result-layer="${escapeHtml(layer.id || layer.method)}">
                            <td>
                                <span class="forecast-new-result-layer-name">
                                    <span class="forecast-new-result-layer-dot"></span>
                                    ${escapeHtml(resultLayerLabel(layer, layers))}
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
        const allLayers = resultLayers();
        const aspects = allLayers.flatMap((layer) => (layer.aspects || []).map((aspect) => ({
            layerMethod: layer.method,
            layerId: layer.id || layer.method,
            layerLabelText: resultLayerLabel(layer, allLayers),
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
                    ${sorted.map(({ layerId, layerLabelText, aspect }) => {
                        const aspectKey = state.prognosticRenderer?.getAspectKey?.(aspect) || '';
                        const phase = state.prognosticRenderer?.getApplyingSeparatingShortLabel?.(aspect) || '';
                        const orb = Number(aspect?.orb);
                        return `
                            <tr data-result-layer="${escapeHtml(layerId)}" data-result-aspect-key="${escapeHtml(aspectKey)}" data-result-aspect-type="${escapeHtml(aspect?.aspect_type || '')}">
                                <td>${escapeHtml(layerLabelText)}</td>
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

    function aspectRendererForDynamics() {
        return state.prognosticRenderer || state.natalRenderer || null;
    }

    function aspectKeyForDynamics(aspect) {
        const renderer = aspectRendererForDynamics();
        if (!aspect || !renderer?.getAspectKey) return null;
        const normalized = renderer.normalizeAspectForDisplay
            ? renderer.normalizeAspectForDisplay(aspect)
            : aspect;
        return renderer.getAspectKey(normalized);
    }

    function findAspectInLayerForDynamics(layer, aspectKey, aspectType) {
        if (!layer || !aspectKey) return null;
        const aspects = Array.isArray(layer.aspects) ? layer.aspects : [];
        return aspects.find((aspect) => (
            aspectKeyForDynamics(aspect) === aspectKey
            && (!aspectType || aspect.aspect_type === aspectType)
        )) || null;
    }

    function findPrognosticAspectForDynamics(aspectKey, aspectType, layerId = null) {
        const layers = state.viewModel?.activePrognosticLayers || [];
        const preferredLayer = layerId
            ? layers.find((layer) => layer.id === layerId || layer.method === layerId)
            : selectedViewModelLayer();
        const preferredAspect = findAspectInLayerForDynamics(preferredLayer, aspectKey, aspectType);
        if (preferredAspect) return { layer: preferredLayer, aspect: preferredAspect };
        for (const layer of layers) {
            const aspect = findAspectInLayerForDynamics(layer, aspectKey, aspectType);
            if (aspect) return { layer, aspect };
        }
        return null;
    }

    function findNatalAspectForDynamics(aspectKey, aspectType) {
        const candidates = [
            state.viewModel?.natalLayer,
            activeBaseWheelData(),
            state.natalRenderer?.chartData,
            activeBaseChartData(),
        ].filter(Boolean);
        for (const layer of candidates) {
            const aspect = findAspectInLayerForDynamics(layer, aspectKey, aspectType);
            if (aspect) return { layer: state.viewModel?.natalLayer || layer, aspect };
        }
        const wheelAspect = state.wheel?.aspectLookupByKey?.[aspectKey];
        if (wheelAspect && (!aspectType || wheelAspect.aspect_type === aspectType)) {
            return {
                layer: state.viewModel?.natalLayer || { id: 'natal', method: 'natal' },
                aspect: wheelAspect,
            };
        }
        return null;
    }

    function layerInstanceForDynamics(layer) {
        if (!layer) return selectedLayerInstance();
        return findLayerInstance(layer.id)
            || instancesOfMethod(layer.method)[0]
            || selectedLayerInstance();
    }

    function solarDynamicsDateTime(layer, cfg) {
        return normalizeSolarDateTime(layer?.raw?.solar_info?.solar_datetime_local)
            || cfg?.datetime
            || getDisplayedSolarDateTime();
    }

    function synastryDynamicsDateTime(layer, cfg) {
        const manual = cfg?.mode === 'manual' ? (cfg.manual || state.synastryManual || {}) : {};
        const bd = layer?.raw?.partner_chart?.birth_data || {};
        const date = cfg?.mode === 'manual' ? manual.date : (bd.date || state.synastryManual?.date || '');
        const time = cfg?.mode === 'manual' ? manual.time : (bd.time || state.synastryManual?.time || '12:00:00');
        return date ? `${date}T${time || '12:00:00'}` : getDisplayedMomentDateTime();
    }

    function dynamicsOptionsForLayer(match, inst) {
        const method = match.layer?.method || inst?.method || 'transit';
        const cfg = layerConfigOf(inst || method);
        const options = {
            method,
            natalSource: buildNatalSourcePayload(),
            userId: state.userId,
            timezone: cfg.timezone || state.timezone || state.natalTimezone || 'UTC',
            selectedDateTime: cfg.datetime || state.selectedDateTime,
            aspect: { ...match.aspect, method },
        };
        if (method === 'direction') {
            options.directionType = normalizeDirectionType(cfg.directionType || state.directionType);
        }
        if (method === 'solar_return') {
            options.selectedDateTime = solarDynamicsDateTime(match.layer, cfg);
            options.timezone = cfg.location?.timezone || state.natalTimezone || state.timezone || 'UTC';
            options.solarYear = cfg.year || state.solarYear || Number(String(options.selectedDateTime).slice(0, 4));
            options.solarLocation = cfg.location || state.solarLocation || null;
        }
        if (method === 'synastry_partner') {
            options.selectedDateTime = synastryDynamicsDateTime(match.layer, cfg);
            options.timezone = cfg.manual?.timezone
                || match.layer?.raw?.partner_chart?.birth_data?.timezone
                || state.synastryManual?.timezone
                || state.timezone
                || 'UTC';
            options.partnerSource = buildSynastryPartnerSource(cfg);
        }
        return options;
    }

    function openNatalAspectDynamicsByKey(aspectKey, aspectType) {
        const match = findNatalAspectForDynamics(aspectKey, aspectType);
        if (!match) {
            window.showToast?.(t('page.forecastNew.aspectDynamics.errors.missingContext'), 'warning');
            return;
        }
        window.ForecastAspectDynamicsModal?.open({
            method: 'natal',
            natalSource: buildNatalSourcePayload(),
            userId: state.userId,
            timezone: state.natalTimezone || state.timezone || 'UTC',
            selectedDateTime: state.natalSelectedDateTime || state.selectedDateTime,
            aspect: { ...match.aspect, method: 'natal' },
        });
    }

    function openAspectDynamicsByKey(aspectKey, aspectType, layerId = null) {
        const match = findPrognosticAspectForDynamics(aspectKey, aspectType, layerId);
        if (!match) {
            window.showToast?.(t('page.forecastNew.aspectDynamics.errors.missingContext'), 'warning');
            return;
        }
        const inst = layerInstanceForDynamics(match.layer);
        window.ForecastAspectDynamicsModal?.open(dynamicsOptionsForLayer(match, inst));
    }

    function aspectNodeFromEventTarget(target) {
        if (!(target instanceof Element)) return null;
        return target.closest(
            '.aspect-line[data-aspect-key], '
            + '.aspect-symbol-group[data-aspect-key], '
            + '[data-aspect-key][data-method-1][data-method-2]'
        );
    }

    function openWheelAspectDynamicsFromNode(node) {
        const key = node?.dataset?.aspectKey;
        if (!key) return false;
        const method1 = node.getAttribute('data-method-1') || node.dataset.method1 || '';
        const method2 = node.getAttribute('data-method-2') || node.dataset.method2 || '';
        const aspectType = node.dataset.aspectType || node.dataset.type;
        if (method1 === 'natal' && method2 === 'natal') {
            openNatalAspectDynamicsByKey(key, aspectType);
            return true;
        }
        openAspectDynamicsByKey(
            key,
            aspectType,
            method1 && method1 !== 'natal' ? method1 : null,
        );
        return true;
    }

    function handleAspectDynamicsClick(event) {
        if (!(event.target instanceof Element)) return;

        const wheelNode = aspectNodeFromEventTarget(event.target);
        if (wheelNode && refs.forecastNewWheel?.contains(wheelNode)) {
            event.preventDefault();
            openWheelAspectDynamicsFromNode(wheelNode);
            return;
        }

        const natalNode = event.target.closest(
            '#natalAspectsView tr[data-aspect-key], '
            + '#natalGridView td[data-aspect-key]'
        );
        if (natalNode) {
            event.preventDefault();
            openNatalAspectDynamicsByKey(
                natalNode.dataset.aspectKey,
                natalNode.dataset.aspectType,
            );
            return;
        }

        const prognosticNode = event.target.closest(
            '#progAspectsView tr[data-aspect-key], '
            + '#progGridView td[data-aspect-key]'
        );
        if (prognosticNode) {
            event.preventDefault();
            openAspectDynamicsByKey(
                prognosticNode.dataset.aspectKey,
                prognosticNode.dataset.aspectType,
            );
        }
    }

    function buildResultLayerMeta(method, layer) {
        if (method === 'solar_return') {
            return buildSolarMomentMeta(layer?.raw?.solar_info, { year: state.solarYear });
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
        return [partnerName, formatChartDate(bd?.date), bd?.place].filter(Boolean).join(' · ');
    }

    function assistantCleanText(value, limit = 120) {
        const text = String(value || '').trim();
        return text ? text.slice(0, limit) : '';
    }

    function assistantSplitDatetime(value) {
        const [date, time] = splitTargetDatetime(value || '');
        return { date, time };
    }

    function assistantLocationSummary(location = {}) {
        const out = {};
        const name = assistantCleanText(location.name || location.place || location.locationName, 120);
        if (name) out.name = name;
        const lat = numberOrNull(location.latitude);
        const lon = numberOrNull(location.longitude);
        if (lat !== null && lon !== null) {
            out.latitude = lat;
            out.longitude = lon;
        }
        const timezone = assistantCleanText(location.timezone, 80);
        if (timezone) out.timezone = timezone;
        return Object.keys(out).length ? out : null;
    }

    function assistantAspectSummary(aspects, limit = 8) {
        return (Array.isArray(aspects) ? aspects : [])
            .filter((aspect) => aspect && (aspect.aspect_type || aspect.aspect))
            .slice()
            .sort((a, b) => Number(a.orb ?? 99) - Number(b.orb ?? 99))
            .slice(0, limit)
            .map((aspect) => ({
                primary: assistantCleanText(
                    aspect.left_planet || aspect.planet_1 || aspect.transit_planet
                    || aspect.progressed_planet || aspect.directed_object || aspect.solar_planet,
                    32,
                ),
                aspect: assistantCleanText(aspect.aspect_type || aspect.aspect, 32),
                target: assistantCleanText(
                    aspect.right_planet || aspect.planet_2 || aspect.natal_object,
                    32,
                ),
                orb: Number.isFinite(Number(aspect.orb)) ? Number(Number(aspect.orb).toFixed(2)) : null,
                phase: assistantCleanText(aspect.phase || aspect.aspect_phase, 24),
            }))
            .filter((aspect) => aspect.primary && aspect.aspect && aspect.target && aspect.orb !== null);
    }

    function assistantBodySummary(bodies, limit = 12) {
        const preferred = new Set(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'ASC', 'MC']);
        const normalized = (Array.isArray(bodies) ? bodies : [])
            .filter((body) => body && body.name && body.longitude !== null && body.longitude !== undefined);
        return normalized
            .slice()
            .sort((a, b) => {
                const ap = preferred.has(a.name) ? 0 : 1;
                const bp = preferred.has(b.name) ? 0 : 1;
                return ap - bp;
            })
            .slice(0, limit)
            .map((body) => ({
                name: assistantCleanText(body.name, 32),
                sign: assistantCleanText(body.sign, 24),
                degree: assistantCleanText(body.degree_in_sign_formatted, 32),
                longitude: Number.isFinite(Number(body.longitude)) ? Number(Number(body.longitude).toFixed(4)) : null,
                house: Number.isFinite(Number(body.house)) ? Number(body.house) : null,
                retrograde: body.retrograde === true,
            }));
    }

    function assistantLayerBodies(method, layer, raw) {
        if (method === 'transit') return raw?.transit_planets || layer?.bodies || [];
        if (method === 'progression') return raw?.progressed_planets || layer?.bodies || [];
        if (method === 'direction') {
            return [
                ...(raw?.directed_planets || []),
                ...(raw?.directed_angles || []),
                ...(raw?.directed_special_points || []),
            ];
        }
        if (method === 'solar_return') return raw?.planets || layer?.bodies || [];
        if (method === 'synastry_partner') return raw?.partner_chart?.planets || layer?.bodies || [];
        return layer?.bodies || [];
    }

    function assistantLayerAspects(method, layer, raw) {
        if (method === 'synastry_partner') return raw?.inter_aspects || layer?.aspects || [];
        return raw?.aspects_to_natal || raw?.aspects || layer?.aspects || [];
    }

    function assistantLayerConfig(inst) {
        const cfg = layerConfigOf(inst);
        if (isMomentMethod(inst.method)) {
            const { date, time } = assistantSplitDatetime(cfg.datetime || state.selectedDateTime);
            const out = {
                date,
                time,
                timezone: cfg.timezone || state.timezone || 'UTC',
            };
            const location = assistantLocationSummary(cfg.location || state.location || {});
            if (location) out.location = location;
            if (inst.method === 'direction') {
                out.directionType = normalizeDirectionType(cfg.directionType || state.directionType);
            }
            return out;
        }
        if (inst.method === 'solar_return') {
            const out = { year: Number(cfg.year || state.solarYear) };
            const location = assistantLocationSummary(cfg.location || {});
            if (location) out.location = location;
            return out;
        }
        if (inst.method === 'synastry_partner') {
            return buildAssistantSynastryContextFor(inst) || { mode: cfg.mode || 'db' };
        }
        return {};
    }

    function buildAssistantSynastryContextFor(inst = null) {
        const resolvedInst = inst || (selectedRightMethod() === 'synastry_partner'
            ? selectedLayerInstance()
            : instancesOfMethod('synastry_partner')[0]);
        if (!resolvedInst && !hasUsableSynastryPartner()) return null;
        const layer = (state.viewModel?.activePrognosticLayers || []).find((item) => item.id === resolvedInst?.id)
            || (state.viewModel?.activePrognosticLayers || []).find((item) => item.method === 'synastry_partner')
            || null;
        const raw = layer?.raw || {};
        const cfg = layerConfigOf(resolvedInst || 'synastry_partner');
        const manual = cfg.mode === 'manual' ? (cfg.manual || state.synastryManual || {}) : {};
        const bd = raw?.partner_chart?.birth_data || {};
        const select = refs.forecastNewSynastryPartnerSelect;
        const selectedLabel = select && select.selectedIndex > 0
            ? (select.options[select.selectedIndex]?.text || '')
            : '';
        const partnerName = cfg.mode === 'manual'
            ? (manual.name || manual.title || t('page.forecastNew.resultViews.manualPartner'))
            : (resolvedInst?.config?.chartTitle
                || selectedLabel
                || [bd.first_name, bd.last_name].filter(Boolean).join(' ').trim()
                || state.synastryManual?.name
                || t('page.chart.nav.synastry'));
        const rawAspects = Array.isArray(raw?.inter_aspects)
            ? raw.inter_aspects
            : (Array.isArray(layer?.aspects) ? layer.aspects.map((aspect) => ({
                planet_1: aspect.planet_2 || aspect.right_planet,
                planet_2: aspect.planet_1 || aspect.left_planet,
                aspect_type: aspect.aspect_type,
                orb: aspect.orb,
            })) : []);
        const tightInterAspects = rawAspects
            .filter((aspect) => aspect && aspect.planet_1 && aspect.planet_2 && aspect.aspect_type)
            .slice()
            .sort((a, b) => Number(a.orb ?? 99) - Number(b.orb ?? 99))
            .slice(0, 8)
            .map((aspect) => ({
                primary: String(aspect.planet_1),
                partner: String(aspect.planet_2),
                aspect: String(aspect.aspect_type),
                orb: Number.isFinite(Number(aspect.orb)) ? Number(Number(aspect.orb).toFixed(2)) : null,
            }))
            .filter((aspect) => aspect.orb !== null);
        return {
            active: true,
            mode: cfg.mode === 'manual' ? 'manual' : 'db',
            partnerName,
            partnerId: cfg.partnerId || null,
            date: cfg.mode === 'manual' ? manual.date : (bd.date || state.synastryManual?.date || ''),
            time: cfg.mode === 'manual' ? manual.time : (bd.time || state.synastryManual?.time || ''),
            timezone: cfg.mode === 'manual' ? manual.timezone : (bd.timezone || state.synastryManual?.timezone || ''),
            place: cfg.mode === 'manual' ? manual.place : (bd.place || state.synastryManual?.place || ''),
            latitude: cfg.mode === 'manual' ? manual.latitude : numberOrNull(bd.latitude),
            longitude: cfg.mode === 'manual' ? manual.longitude : numberOrNull(bd.longitude),
            houseSystem: cfg.mode === 'manual'
                ? (manual.houseSystem || state.pageSettings?.houseSystem || 'P')
                : (bd.house_system || state.pageSettings?.houseSystem || 'P'),
            zodiac: cfg.mode === 'manual'
                ? (manual.zodiac || state.natalData?.birth_data?.zodiac || 'tropical')
                : (bd.zodiac || state.natalData?.birth_data?.zodiac || 'tropical'),
            ayanamsha: cfg.mode === 'manual'
                ? (manual.ayanamsha || state.natalData?.birth_data?.ayanamsha || null)
                : (bd.ayanamsha || state.natalData?.birth_data?.ayanamsha || null),
            aspectCount: rawAspects.length,
            tightInterAspects,
        };
    }

    function buildAssistantSynastryContext() {
        return buildAssistantSynastryContextFor();
    }

    function buildAssistantActiveChartResource() {
        const birth = state.natalData?.birth_data || {};
        const [date, time] = splitTargetDatetime(state.natalSelectedDateTime || '');
        const title = chartDisplayTitle(state.natalData || {}, t('page.chart.nav.natal'));
        const out = {
            chartId: state.userId || null,
            source: state.userId && !isNatalEdited() ? 'saved' : 'inline',
            title: assistantCleanText(title, 140),
            date: birth.date || date || '',
            time: birth.time || time || '',
            timezone: state.natalTimezone || birth.timezone || 'UTC',
            place: birth.place || state.natalLocation?.name || '',
            latitude: numberOrNull(birth.latitude ?? state.natalLocation?.latitude),
            longitude: numberOrNull(birth.longitude ?? state.natalLocation?.longitude),
            houseSystem: normalizeHouseSystemCode(state.pageSettings?.houseSystem || birth.house_system || 'P'),
            zodiac: birth.zodiac || 'tropical',
            ayanamsha: birth.ayanamsha || null,
            planetCount: Array.isArray(state.natalData?.planets) ? state.natalData.planets.length : 0,
            aspectCount: Array.isArray(state.natalData?.aspects) ? state.natalData.aspects.length : 0,
        };
        return out;
    }

    function buildAssistantLayerResources() {
        const vmLayers = state.viewModel?.activePrognosticLayers || [];
        return state.activeLayers.map((inst) => {
            const layer = vmLayers.find((item) => item.id === inst.id)
                || vmLayers.find((item) => item.method === inst.method)
                || null;
            const raw = layer?.raw || state.layers?.[inst.id] || null;
            const aspects = assistantLayerAspects(inst.method, layer, raw);
            const bodies = assistantLayerBodies(inst.method, layer, raw);
            return {
                id: inst.id,
                method: inst.method,
                selected: inst.id === state.selectedRightLayerId,
                ready: !!raw,
                label: assistantCleanText(layer?.label || layerLabel(inst.method), 80),
                config: assistantLayerConfig(inst),
                meta: assistantCleanText(buildResultLayerMeta(inst.method, layer || { raw }) || '', 180),
                result: {
                    aspectCount: Array.isArray(aspects) ? aspects.length : 0,
                    bodyCount: Array.isArray(bodies) ? bodies.length : 0,
                    tightAspects: assistantAspectSummary(aspects),
                    keyBodies: assistantBodySummary(bodies),
                    target: raw?.transit_info || raw?.progression_info || raw?.direction_info
                        || raw?.solar_info || null,
                },
            };
        });
    }

    function buildAssistantWorkspaceResources() {
        return {
            activeChart: buildAssistantActiveChartResource(),
            selectedLayerId: state.selectedRightLayerId || '',
            selectedMethod: selectedRightMethod(),
            layers: buildAssistantLayerResources(),
        };
    }

    function normalizeCompositeMethod(method) {
        return method === 'davison' ? 'davison' : 'midpoint';
    }

    function invalidateCompositeCache() {
        state.compositeData = null;
        state.compositeChartData = null;
        state.compositeMeta = null;
    }

    async function loadSavedCompositeChart(compositeChartId) {
        if (!compositeChartId) return;
        refs.forecastNewWheelShell?.classList.add('forecast-new-loading');
        refs.forecastNewProgPanel?.classList.add('forecast-new-loading');
        try {
            const saved = await apiGet(`/composite/saved/${encodeURIComponent(compositeChartId)}`);
            const method = normalizeCompositeMethod(saved.method || saved.chart_data?.composite_method);
            const chartData = {
                ...(saved.chart_data || {}),
                chart_kind: 'composite',
                composite_saved_chart_id: saved.composite_chart_id || compositeChartId,
                composite_method: method,
                title: saved.title || saved.chart_data?.title || saved.chart_data?.composite_pair_title || '',
            };
            state.compositeMethod = method;
            state.pageSettings.compositeMethod = method;
            if (saved.house_system) {
                state.pageSettings.houseSystem = normalizeHouseSystemCode(saved.house_system);
            }
            state.compositeData = {
                [method]: chartData,
                davison_unavailable_reason: null,
            };
            state.compositeChartData = chartData;
            state.compositeMeta = chartData.composite_meta || '';
            state.singleChartMode = 'composite';
            state.wheelView = 'single';
            if (saved.partner_user_id) {
                state.synastryMode = 'db';
                state.synastryPartnerId = String(saved.partner_user_id);
                state.synastryManual = null;
                setSynastryMode('db');
                if (refs.forecastNewSynastryPartnerSelect) {
                    refs.forecastNewSynastryPartnerSelect.value = String(saved.partner_user_id);
                }
            } else if (saved.partner_birth_data) {
                state.synastryMode = 'manual';
                state.synastryPartnerId = '';
                state.synastryManual = saved.partner_birth_data;
                setSynastryMode('manual');
                syncSynastryManualControlsFromState();
            }
            syncWorkspaceModePanels();
            syncWheelViewButtons();
            syncControlsFromState();
            renderCompositeWorkspace();
            renderRightLayerTabs();
            window.AstroAPI?.saveChartToSession?.(state.compositeChartData);
            schedulePersist();
        } catch (error) {
            window.showToast?.(error.message || t('common.error') || 'Ошибка', 'error');
        } finally {
            refs.forecastNewWheelShell?.classList.remove('forecast-new-loading');
            refs.forecastNewProgPanel?.classList.remove('forecast-new-loading');
        }
    }

    function selectedPartnerName() {
        if (state.synastryMode === 'manual') {
            return state.synastryManual?.name || t('page.forecastNew.resultViews.manualPartner') || 'Партнёр';
        }
        const select = refs.forecastNewSynastryPartnerSelect;
        return select && select.selectedIndex > 0
            ? (select.options[select.selectedIndex]?.text || '')
            : '';
    }

    function compositePairTitle() {
        const birth = state.natalData?.birth_data || {};
        const primary = [birth.first_name, birth.last_name].filter(Boolean).join(' ').trim()
            || refs.forecastNewTitle?.textContent
            || t('page.synastry.people.primary')
            || 'Карта';
        return [primary, selectedPartnerName()].filter(Boolean).join(' + ');
    }

    function compositeMethodLabel(method = state.compositeMethod) {
        return t(`page.forecastNew.composite.${normalizeCompositeMethod(method)}`);
    }

    function buildCompositeChartData(chart, method, response = {}) {
        if (!chart) return null;
        const pairTitle = compositePairTitle();
        const methodLabel = compositeMethodLabel(method);
        const mt = chart.midpoint_time || {};
        const metaParts = [
            methodLabel,
            state.pageSettings.houseSystem,
            mt.date_utc ? `${formatChartDate(mt.date_utc)}${mt.time_utc ? ` ${mt.time_utc} UTC` : ''}` : '',
        ].filter(Boolean);
        return {
            ...chart,
            user_id: state.userId,
            title: `${t('page.forecastNew.composite.calculate') || 'Композит'}: ${pairTitle}`,
            chart_kind: 'composite',
            composite_method: method,
            composite_pair_title: pairTitle,
            composite_meta: metaParts.join(' · '),
            davison_unavailable_reason: response.davison_unavailable_reason || null,
            birth_data: {
                ...(state.natalData?.birth_data || {}),
                first_name: t('page.forecastNew.composite.calculate') || 'Композит',
                last_name: pairTitle,
                house_system: state.pageSettings.houseSystem,
                date: mt.date_utc || state.natalData?.birth_data?.date || '',
                time: mt.time_utc || state.natalData?.birth_data?.time || '',
                timezone: mt.time_utc ? 'UTC' : state.natalData?.birth_data?.timezone,
                latitude: mt.latitude ?? state.natalData?.birth_data?.latitude,
                longitude: mt.longitude ?? state.natalData?.birth_data?.longitude,
                place: pairTitle,
            },
            planets: chart.planets || [],
            houses: chart.houses || [],
            angles: chart.angles || {},
            aspects: chart.aspects || [],
            special_points: chart.special_points || {},
            aspect_configurations: chart.aspect_configurations || [],
            stelliums: chart.stelliums || [],
            balances: chart.balances || null,
            cosmogram_pattern: chart.cosmogram_pattern || null,
        };
    }

    // Build the /composite/calculate request body for the current partner.
    // DB partner → partner_id; manual partner → inline partner_birth_data (D4).
    // Returns null when there is no usable partner.
    function buildCompositeRequest() {
        if (!state.userId) return null;
        const houseSystem = state.pageSettings.houseSystem
            || state.natalData?.birth_data?.house_system || 'P';
        const method = normalizeCompositeMethod(state.compositeMethod);
        if (state.synastryMode === 'manual') {
            const m = state.synastryManual;
            if (!m || !m.date || !m.time || !m.timezone) return null;
            return {
                user_id: state.userId,
                house_system: houseSystem,
                method,
                partner_birth_data: {
                    name: m.name || null,
                    date: m.date,
                    time: m.time,
                    timezone: m.timezone,
                    place: m.place || null,
                    latitude: m.latitude != null ? m.latitude : null,
                    longitude: m.longitude != null ? m.longitude : null,
                },
            };
        }
        if (!state.synastryPartnerId) return null;
        return {
            user_id: state.userId,
            partner_id: state.synastryPartnerId,
            house_system: houseSystem,
            method,
        };
    }

    // Client-side memo: re-opening the panel for the same partner shouldn't
    // recompute (the endpoint now builds charts + may geocode). Keyed by body.
    let _compositeMemo = { key: null, data: null };

    async function loadCompositeChart(options = {}) {
        const body = buildCompositeRequest();
        if (!body) {
            window.showToast?.(t('page.forecastNew.composite.noPartner') || 'Сначала выберите партнёра', 'warning');
            return;
        }
        const key = JSON.stringify(body);
        if (!options.force && _compositeMemo.key === key && _compositeMemo.data) {
            state.compositeData = _compositeMemo.data;
            const method = normalizeCompositeMethod(state.compositeMethod);
            const chart = state.compositeData[method];
            if (!chart) {
                const message = state.compositeData.davison_unavailable_reason
                    || t('page.forecastNew.composite.unavailable')
                    || 'Композит недоступен';
                window.showToast?.(message, 'warning');
                return null;
            }
            state.compositeChartData = buildCompositeChartData(chart, method, state.compositeData);
            state.compositeMeta = state.compositeChartData?.composite_meta || '';
            renderCompositeWorkspace();
            return state.compositeChartData;
        }
        refs.forecastNewWheelShell?.classList.add('forecast-new-loading');
        refs.forecastNewProgPanel?.classList.add('forecast-new-loading');
        try {
            const data = await apiPost('/composite/calculate', body);
            _compositeMemo = { key, data };
            state.compositeData = data;
            const method = normalizeCompositeMethod(state.compositeMethod);
            const chart = data[method];
            if (!chart) {
                const message = data.davison_unavailable_reason
                    || t('page.forecastNew.composite.unavailable')
                    || 'Композит недоступен';
                window.showToast?.(message, 'warning');
                return null;
            }
            state.compositeChartData = buildCompositeChartData(chart, method, data);
            state.compositeMeta = state.compositeChartData?.composite_meta || '';
            renderCompositeWorkspace();
            return state.compositeChartData;
        } catch (error) {
            window.showToast?.(error.message || t('common.error') || 'Ошибка', 'error');
            return null;
        } finally {
            refs.forecastNewWheelShell?.classList.remove('forecast-new-loading');
            refs.forecastNewProgPanel?.classList.remove('forecast-new-loading');
        }
    }

    async function enterCompositeMode() {
        state.compositeMethod = normalizeCompositeMethod(state.compositeMethod || state.pageSettings.compositeMethod);
        state.pageSettings.compositeMethod = state.compositeMethod;
        state.singleChartMode = 'composite';
        state.wheelView = 'single';
        syncWorkspaceModePanels();
        syncWheelViewButtons();
        syncControlsFromState();
        await loadCompositeChart();
        renderRightLayerTabs();
        schedulePersist();
    }

    async function enterSynastryMode() {
        state.singleChartMode = 'natal';
        state.wheelView = 'multi';
        if (hasUsableSynastryPartner()) {
            await ensureSynastryLayerActive({ lightweight: true });
            const synastryLayer = instancesOfMethod('synastry_partner')[0];
            if (synastryLayer) {
                state.selectedRightLayerId = synastryLayer.id;
                applyConfigToScratch(synastryLayer);
            }
        }
        syncWorkspaceModePanels();
        syncWheelViewButtons();
        renderStaticNatal();
        refreshViewModel();
        renderWheel();
        renderRightLayerTabs();
        renderRightPanel();
        schedulePersist();
    }

    function renderCompositeWorkspace() {
        syncWorkspaceModePanels();
        syncControlsFromState();
        renderStaticNatal();
        refreshViewModel();
        renderWheel();
        renderRightPanel();
    }

    function viewModelLayerForInstance(inst) {
        const layers = state.viewModel?.activePrognosticLayers || [];
        return layers.find((layer) => layer.id === inst?.id)
            || layers.find((layer) => layer.method === inst?.method)
            || null;
    }

    function formatLayerChipDateTime(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const [date, time] = splitTargetDatetime(raw);
        const shortTime = String(time || '').slice(0, 5);
        return [date ? formatChartDate(date) : '', shortTime].filter(Boolean).join(' ');
    }

    function layerInstanceChipLabel(inst, ordinal) {
        const cfg = layerConfigOf(inst);
        const viewLayer = viewModelLayerForInstance(inst);

        if (isMomentMethod(inst.method)) {
            return formatLayerChipDateTime(cfg.datetime || state.selectedDateTime) || String(ordinal);
        }

        if (inst.method === 'solar_return') {
            const solarDateTime = normalizeSolarDateTime(
                viewLayer?.raw?.solar_info?.solar_datetime_local || cfg.datetime || ''
            );
            const year = cfg.year || viewLayer?.raw?.solar_info?.year || state.solarYear || '';
            return formatLayerChipDateTime(solarDateTime) || String(year || ordinal);
        }

        if (inst.method === 'synastry_partner') {
            const bd = viewLayer?.raw?.partner_chart?.birth_data || {};
            const manual = cfg.manual || {};
            const name = cfg.chartTitle
                || manual.name
                || [bd.first_name, bd.last_name].filter(Boolean).join(' ').trim();
            return name || (bd.date ? formatChartDate(bd.date) : String(ordinal));
        }

        return String(ordinal);
    }

    function renderRightLayerTabs() {
        if (!refs.rightLayerTabs) return;
        if (state.wheelView === 'single') {
            refs.rightLayerTabs.classList.remove('is-dense');
            refs.rightLayerTabs.innerHTML = '';
            syncCompositeHeaderButton();
            return;
        }
        normalizeActiveLayers();
        refs.rightLayerTabs.classList.toggle('is-dense', state.activeLayers.length >= 3);
        const addLayerLabel = t('page.chart.actions.addLayer');
        const groupedLayers = LAYER_ORDER.map((method) => {
            const instances = instancesOfMethod(method);
            const canAdd = isMultiInstanceMethod(method) || instances.length === 0;
            const label = layerLabel(method);
            const addTitle = `${addLayerLabel}: ${label}`;
            const methodControl = canAdd
                ? `<button type="button" class="forecast-new-layer-method-action" data-add-layer-method="${method}" aria-label="${escapeHtml(addTitle)}" title="${escapeHtml(addTitle)}">
                        <span class="forecast-new-layer-method-plus" aria-hidden="true">+</span>
                        <span class="forecast-new-layer-method-name">${escapeHtml(label)}</span>
                    </button>`
                : `<span class="forecast-new-layer-method-action forecast-new-layer-method-action--locked">
                        <span class="forecast-new-layer-method-name">${escapeHtml(label)}</span>
                    </span>`;
            const chips = instances.map((inst, index) => {
                const chipLabel = layerInstanceChipLabel(inst, index + 1);
                const chipTitle = `${label}: ${chipLabel}`;
                const isActive = inst.id === state.selectedRightLayerId;
                return `
                    <span class="forecast-new-layer-instance-wrap ${isActive ? 'active' : ''}">
                        <button type="button" class="forecast-new-layer-instance" data-right-layer="${escapeHtml(inst.id)}" title="${escapeHtml(chipTitle)}">
                            <span class="forecast-new-layer-instance-label">${escapeHtml(chipLabel)}</span>
                        </button>
                        <button type="button" class="forecast-new-layer-instance-remove" data-remove-layer="${escapeHtml(inst.id)}" aria-label="Убрать слой ${escapeHtml(chipTitle)}" title="Убрать слой">−</button>
                    </span>
                `;
            }).join('');
            return `
                <span class="forecast-new-layer-group ${instances.length ? 'has-instances' : 'is-empty'}" data-layer-group="${method}">
                    ${methodControl}
                    ${chips ? `<span class="forecast-new-layer-instances">${chips}</span>` : ''}
                </span>
            `;
        }).join('');
        refs.rightLayerTabs.innerHTML = groupedLayers;
        syncCompositeHeaderButton();
        syncRelationshipSwitch();
    }

    function syncCompositeHeaderButton() {
        if (!refs.forecastNewCompositeHeaderBtn) return;
        // Discoverable whenever a synastry partner layer is active — not only when
        // it's the *selected* layer (P5). Users no longer have to hunt for it.
        const hasSynastry = hasActiveMethod('synastry_partner');
        const visible = state.singleChartMode !== 'composite' && hasSynastry;
        refs.forecastNewCompositeHeaderBtn.classList.toggle('hidden', !visible);
        refs.forecastNewCompositeHeaderBtn.disabled = !visible;
        syncRelationshipSwitch();
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
        syncCompositeHeaderButton();
        if (state.wheelView === 'single') {
            renderSingleNatalRightPanel();
            return;
        }
        const method = selectedRightMethod();
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
        const layer = state.viewModel?.activePrognosticLayers?.find((item) => item.id === state.selectedRightLayerId)
            || state.viewModel?.activePrognosticLayers?.find((item) => item.method === method);
        refs.prognosticPanelTitle.textContent = selectedPanelTitle(method);
        refs.prognosticPanelMeta.textContent = buildPrognosticMomentSummary();
        syncMomentCardLayout();
        renderOrUpdateTimeStepper();
        refs.targetDatetimeLabel.textContent = formatChartDateTimeLabel(getDisplayedMomentDateTime());

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
            aspect_configurations: layer.aspect_configurations || [],
            stelliums: layer.stelliums || [],
            balances: layer.balances || null,
            cosmogram_pattern: layer.cosmogram_pattern || null,
        }, { scope: 'prognostic' }));
        renderForecastNewDispositorBlocks('prog', buildLayerDispositorChartData(layer));
        renderInlineMatrixControls();
        applyInlineMatrixRowState();
        syncPrognosticHousesVisibility(layer.houses || []);
        syncHoveredAspectToActiveSurface();
        activateSavedTabs();
        renderResultView();
    }

    function renderSingleNatalRightPanel() {
        if (!refs.prognosticPanelTitle || !refs.prognosticPanelMeta) return;
        const activeChart = activeBaseChartData();
        refs.prognosticPanelTitle.textContent = chartDisplayTitle(
            activeChart,
            isCompositeSingleMode()
                ? (t('page.forecastNew.composite.calculate') || 'Композит')
                : t('page.forecastNew.natalPanelTitle'),
        );
        refs.prognosticPanelMeta.textContent = isCompositeSingleMode()
            ? (activeChart?.composite_meta || state.compositeMeta || '')
            : (refs.natalPanelMeta?.textContent || '');
        if (refs.forecastNewTimeStepper) refs.forecastNewTimeStepper.innerHTML = '';
        if (refs.targetDatetimeLabel) {
            const bd = activeChart?.birth_data || {};
            refs.targetDatetimeLabel.textContent = [formatChartDate(bd.date), bd.time].filter(Boolean).join(' ')
                || formatChartDateTimeLabel(state.natalSelectedDateTime);
        }
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
        document.addEventListener('click', handleAspectDynamicsClick);

        const aspectsPane = document.getElementById('progAspectsView');
        if (aspectsPane) {
            aspectsPane.addEventListener('mouseover', (event) => {
                if (!(event.target instanceof Element)) return;
                const row = event.target.closest('tr[data-aspect-key]');
                const key = row?.dataset?.aspectKey;
                if (key) setHoveredAspectKey(key);
            });

            aspectsPane.addEventListener('mouseout', (event) => {
                if (!(event.target instanceof Element)) return;
                const row = event.target.closest('tr[data-aspect-key]');
                if (!row) return;
                if (row.contains(event.relatedTarget)) return;
                setHoveredAspectKey(null);
            });
        }

        const gridPane = document.getElementById('progGridView');
        if (gridPane) {
            gridPane.addEventListener('mouseover', (event) => {
                if (!(event.target instanceof Element)) return;
                const cell = event.target.closest('td[data-aspect-key]');
                const key = cell?.dataset?.aspectKey;
                if (key) setHoveredAspectKey(key);
            });

            gridPane.addEventListener('mouseout', (event) => {
                if (!(event.target instanceof Element)) return;
                const cell = event.target.closest('td[data-aspect-key]');
                if (!cell) return;
                if (cell.contains(event.relatedTarget)) return;
                setHoveredAspectKey(null);
            });
        }

        document.addEventListener('chart:aspect-hover', (event) => {
            const key = event?.detail?.aspectKey;
            if (!key) return;
            setHoveredAspectKey(key);
        });

        document.addEventListener('chart:aspect-leave', (event) => {
            const key = event?.detail?.aspectKey || null;
            if (key && state.hoveredAspectKey && key !== state.hoveredAspectKey) return;
            setHoveredAspectKey(null);
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

    function applyHoveredAspectFocus() {
        if (state.wheel?.clearHoveredAspect) {
            state.wheel.clearHoveredAspect();
        }
        const activeAspectKey = state.hoveredAspectKey || null;
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
        const activeAspectKey = state.hoveredAspectKey || null;
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
            const method = scope === 'natal' ? 'natal' : selectedRightMethod();
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
            const method = scope === 'natal' ? 'natal' : selectedRightMethod();
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
            const method = scope === 'natal' ? 'natal' : selectedRightMethod();
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
            return [formatChartDate(info.date), info.time, formatHeaderTimezone(info.timezone, { date: info.date, time: info.time })].filter(Boolean).join(' · ');
        }
        if (method === 'progression') {
            const info = raw?.progression_info || {};
            const targetTime = info.target_time || '';
            return [
                [formatChartDate(info.target_date), targetTime].filter(Boolean).join(' '),
                formatHeaderTimezone(info.timezone, { date: info.target_date, time: targetTime }),
                info.method,
                info.rate,
            ].filter(Boolean).join(' · ');
        }
        const info = raw?.direction_info || {};
        return [formatChartDate(info.target_date), info.direction_type, info.arc_formatted].filter(Boolean).join(' · ');
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
        if (layoutHasBlock('natal:profections')) renderProfectionsBlock();
        if (layoutHasBlock('natal:extraangles')) renderExtraAnglesBlock();
        if (layoutHasBlock('natal:antiscia')) renderAntisciaBlock();
        if (layoutHasBlock('natal:asteroids')) renderAsteroidsBlock();
        if (layoutHasBlock('natal:dominants')) renderDominantsBlock();
        if (layoutHasBlock('natal:fixstars')) renderFixstarsBlock();
    }

    const AUX_BLOCK_API_KEY = {
        profections: 'profections',
        antiscia: 'antiscia',
        asteroids: 'asteroids',
        dominants: 'dominants',
        fixstars: 'fixed_stars',
    };

    function invalidateAuxBlockCache() {
        state.auxBlockCache = {};
        state.auxBlockInFlight = {};
        state.auxPendingBlocks = new Set();
        clearTimeout(state.auxBlockTimer);
        state.auxBlockTimer = null;
    }

    function auxBlockTargetDate() {
        return splitTargetDatetime(getDisplayedMomentDateTime())[0];
    }

    function auxBlockCacheKey(block) {
        const targetPart = block === 'profections' ? auxBlockTargetDate() : 'static';
        return [natalCacheToken(), block, targetPart].join('|');
    }

    function getCachedAuxBlock(block) {
        return state.auxBlockCache?.[auxBlockCacheKey(block)] || null;
    }

    function setCachedAuxBlock(block, data, cacheToken, targetDate) {
        const key = [cacheToken, block, block === 'profections' ? targetDate : 'static'].join('|');
        state.auxBlockCache[key] = data;
    }

    function auxBlockContainer(containerId) {
        return document.getElementById(containerId)
            || document.getElementById('forecastNewBlockStore')?.querySelector('#' + containerId);
    }

    function renderAuxBlock(opts) {
        const { block, containerId, markup, emptyMarkup, loadingClass = 'forecast-new-list-loading' } = opts;
        const el = auxBlockContainer(containerId);
        if (!el) return;
        if (!state.userId && !isNatalEdited()) {
            el.innerHTML = emptyMarkup();
            return;
        }
        const cached = getCachedAuxBlock(block);
        if (cached) {
            el.innerHTML = markup(cached);
        } else if (!el.innerHTML.trim()) {
            el.innerHTML = `<div class="${loadingClass}">${escapeHtml(t('common.loading') || '…')}</div>`;
        }
        scheduleAuxBlockFetch([block]);
    }

    function scheduleAuxBlockFetch(blocks) {
        blocks.forEach((block) => {
            if (AUX_BLOCK_API_KEY[block]) state.auxPendingBlocks.add(block);
        });
        clearTimeout(state.auxBlockTimer);
        state.auxBlockTimer = setTimeout(flushAuxBlockFetch, 50);
    }

    async function flushAuxBlockFetch() {
        const requested = [...state.auxPendingBlocks];
        state.auxPendingBlocks.clear();
        state.auxBlockTimer = null;
        const blocks = requested.filter((block) => !getCachedAuxBlock(block));
        if (blocks.length === 0) return;

        const cacheToken = natalCacheToken();
        const targetDate = auxBlockTargetDate();
        const requestKey = [cacheToken, targetDate, blocks.slice().sort().join(',')].join('|');
        if (state.auxBlockInFlight[requestKey]) return state.auxBlockInFlight[requestKey];

        const request = apiPost('/forecast/aux', {
            source: buildNatalSourcePayload(),
            target_date: targetDate,
            blocks: blocks.map((block) => AUX_BLOCK_API_KEY[block]),
            options: {},
        }).then((payload) => {
            const responseBlocks = payload?.blocks || {};
            const responseErrors = payload?.errors || {};
            blocks.forEach((block) => {
                const apiKey = AUX_BLOCK_API_KEY[block];
                if (responseBlocks[apiKey]) {
                    setCachedAuxBlock(block, responseBlocks[apiKey], cacheToken, targetDate);
                    renderAuxBlockIfCurrent(block, responseBlocks[apiKey], cacheToken, targetDate);
                } else if (responseErrors[apiKey]) {
                    renderAuxBlockErrorIfCurrent(block, cacheToken, targetDate);
                }
            });
        }).catch(() => {
            blocks.forEach((block) => renderAuxBlockErrorIfCurrent(block, cacheToken, targetDate));
        }).finally(() => {
            delete state.auxBlockInFlight[requestKey];
        });
        state.auxBlockInFlight[requestKey] = request;
        return request;
    }

    function renderAuxBlockIfCurrent(block, data, cacheToken, targetDate) {
        const currentKey = auxBlockCacheKey(block);
        const responseKey = [cacheToken, block, block === 'profections' ? targetDate : 'static'].join('|');
        if (currentKey !== responseKey) return;
        const renderers = {
            profections: () => renderProfectionsBlock(),
            antiscia: () => renderAntisciaBlock(),
            asteroids: () => renderAsteroidsBlock(),
            dominants: () => renderDominantsBlock(),
            fixstars: () => renderFixstarsBlock(),
        };
        if (data && renderers[block]) renderers[block]();
    }

    function renderAuxBlockErrorIfCurrent(block, cacheToken, targetDate) {
        const currentKey = auxBlockCacheKey(block);
        const responseKey = [cacheToken, block, block === 'profections' ? targetDate : 'static'].join('|');
        if (currentKey !== responseKey || getCachedAuxBlock(block)) return;
        const containers = {
            profections: 'natalProfectionsView',
            antiscia: 'natalAntisciaView',
            asteroids: 'natalAsteroidsView',
            dominants: 'natalDominantsView',
            fixstars: 'natalFixstarsView',
        };
        const el = auxBlockContainer(containers[block]);
        if (el) el.innerHTML = `<div class="forecast-new-list-error">${escapeHtml(t('common.error') || 'Ошибка')}</div>`;
    }

    function fixstarsBlockMarkup(data) {
        const contacts = data && Array.isArray(data.conjunctions) ? data.conjunctions : [];
        if (contacts.length === 0) {
            return `<div class="forecast-new-list-empty">${escapeHtml(t('page.forecastNew.fixstars.empty') || '—')}</div>`;
        }
        const rows = contacts.map((c) => `
            <li class="forecast-new-list-row">
                <span class="forecast-new-list-name">${escapeHtml(planetLabel(c.object))} · ${escapeHtml(c.star)}</span>
                <span class="forecast-new-list-val">${escapeHtml(c.star_position || '')}</span>
                <span class="forecast-new-list-val forecast-new-list-val--dim">${escapeHtml(c.nature || '')} · ${escapeHtml(String(c.orb))}°</span>
            </li>`).join('');
        return `<div class="forecast-new-list forecast-new-fixstars">
                <div class="forecast-new-list-subhead">${escapeHtml(t('page.forecastNew.fixstars.conjunctions') || 'Conjunctions')}</div>
                <ul class="forecast-new-list-body">${rows}</ul>
            </div>`;
    }

    function renderFixstarsBlock() {
        return renderAuxBlock({
            block: 'fixstars',
            containerId: 'natalFixstarsView',
            markup: fixstarsBlockMarkup,
            emptyMarkup: () => `<div class="forecast-new-list-empty">${escapeHtml(t('page.forecastNew.profections.noSavedChart') || '—')}</div>`,
        });
    }

    function pointShort(point) {
        if (!point) return '';
        const deg = Math.floor(point.degree_in_sign || 0);
        return `${deg}° ${signLabel(point.sign)}`;
    }

    function anglePointShort(point) {
        if (!point) return '';
        if (Number.isFinite(Number(point.degree_in_sign)) && point.sign) return pointShort(point);
        if (Number.isFinite(Number(point.longitude))) {
            const lon = ((Number(point.longitude) % 360) + 360) % 360;
            const deg = Math.floor(lon % 30);
            const signIndex = Math.floor(lon / 30);
            const sign = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'][signIndex] || '';
            return `${deg}° ${signLabel(sign)}`;
        }
        return '';
    }

    function extraAnglesBlockMarkup(chartData) {
        const angles = chartData?.angles || {};
        const specialPoints = chartData?.special_points || {};
        const names = ['ASC', 'DSC', 'MC', 'IC', 'Vertex', 'AntiVertex', 'EastPoint'];
        const rows = names.map((name) => {
            const point = angles[name] || specialPoints[name];
            if (!point || point.longitude == null) return '';
            return `
                <li class="forecast-new-list-row">
                    <span class="forecast-new-list-name">${escapeHtml(planetLabel(name))}</span>
                    <span class="forecast-new-list-val">${escapeHtml(anglePointShort(point))}</span>
                    <span class="forecast-new-list-val forecast-new-list-val--dim">${point.house ? escapeHtml(t('page.forecastNew.asteroids.house', { house: point.house }) || String(point.house)) : ''}</span>
                </li>`;
        }).filter(Boolean).join('');
        if (!rows) {
            return `<div class="forecast-new-list-empty">${escapeHtml(t('page.forecastNew.extraangles.empty') || '—')}</div>`;
        }
        return `<div class="forecast-new-list forecast-new-extraangles"><ul class="forecast-new-list-body">${rows}</ul></div>`;
    }

    function renderExtraAnglesBlock() {
        const el = document.getElementById('natalExtraanglesView')
            || document.getElementById('forecastNewBlockStore')?.querySelector('#natalExtraanglesView');
        if (!el) return;
        el.innerHTML = extraAnglesBlockMarkup(state.natalData || state.natalWheelData || {});
    }

    function antisciaBlockMarkup(data) {
        if (!data || !Array.isArray(data.points) || data.points.length === 0) {
            return `<div class="forecast-new-list-empty">${escapeHtml(t('page.forecastNew.antiscia.empty') || '—')}</div>`;
        }
        const rows = data.points.map((p) => `
            <li class="forecast-new-list-row">
                <span class="forecast-new-list-name">${escapeHtml(planetLabel(p.name))}</span>
                <span class="forecast-new-list-val">${escapeHtml(pointShort(p.antiscion))}</span>
                <span class="forecast-new-list-val forecast-new-list-val--dim">${escapeHtml(pointShort(p.contra_antiscion))}</span>
            </li>`).join('');
        const contacts = (data.contacts || []).map((c) => {
            const kind = t(`page.forecastNew.antiscia.${c.kind}`) || c.kind;
            return `<li class="forecast-new-antiscia-contact">${escapeHtml(planetLabel(c.from))} → ${escapeHtml(planetLabel(c.to))} · ${escapeHtml(kind)} (${escapeHtml(String(c.orb))}°)</li>`;
        }).join('');
        return `
            <div class="forecast-new-list forecast-new-antiscia">
                <div class="forecast-new-list-head">
                    <span>${escapeHtml(t('page.forecastNew.antiscia.antiscion') || 'Antiscion')}</span>
                    <span>${escapeHtml(t('page.forecastNew.antiscia.contra_antiscion') || 'Contra')}</span>
                </div>
                <ul class="forecast-new-list-body">${rows}</ul>
                ${contacts ? `<div class="forecast-new-antiscia-contacts"><div class="forecast-new-list-subhead">${escapeHtml(t('page.forecastNew.antiscia.contacts') || 'Contacts')}</div><ul>${contacts}</ul></div>` : ''}
            </div>`;
    }

    function asteroidsBlockMarkup(data) {
        const list = data && Array.isArray(data.asteroids) ? data.asteroids : [];
        if (list.length === 0) {
            return `<div class="forecast-new-list-empty">${escapeHtml(t('page.forecastNew.asteroids.empty') || '—')}</div>`;
        }
        const rows = list.map((a) => `
            <li class="forecast-new-list-row">
                <span class="forecast-new-list-name">${escapeHtml(planetLabel(a.name))}${a.retrograde ? ' <span class="forecast-new-retro">R</span>' : ''}</span>
                <span class="forecast-new-list-val">${escapeHtml(`${Math.floor(a.degree_in_sign || 0)}° ${signLabel(a.sign)}`)}</span>
                <span class="forecast-new-list-val forecast-new-list-val--dim">${a.house ? escapeHtml(t('page.forecastNew.asteroids.house', { house: a.house }) || `${a.house}`) : ''}</span>
            </li>`).join('');
        return `<div class="forecast-new-list forecast-new-asteroids"><ul class="forecast-new-list-body">${rows}</ul></div>`;
    }

    function dominantsBlockMarkup(data) {
        if (!data || !data.dominant) {
            return `<div class="forecast-new-list-empty">${escapeHtml(t('page.forecastNew.dominants.empty') || '—')}</div>`;
        }
        const d = data.dominant;
        const headline = `
            <div class="forecast-new-dominants-headline">
                ${escapeHtml(planetLabel(d.planet))} · ${escapeHtml(signLabel(d.sign))} ·
                ${escapeHtml(t(`page.forecastNew.dominants.element.${d.element}`) || d.element || '')} ·
                ${escapeHtml(t(`page.forecastNew.dominants.mode.${d.mode}`) || d.mode || '')}
            </div>`;
        const ranked = (label, items, mapKey, formatKey) => {
            if (!items || items.length === 0) return '';
            const cells = items.map((it) => {
                let name = it.key;
                if (mapKey) {
                    name = t(`${mapKey}.${it.key}`) || it.key;
                } else if (formatKey === 'planet') {
                    name = planetLabel(it.key);
                } else if (formatKey === 'sign') {
                    name = signLabel(it.key);
                } else if (formatKey === 'house') {
                    name = t('page.forecastNew.asteroids.house', { house: it.key }) || it.key;
                }
                return `<span class="forecast-new-dominants-chip">${escapeHtml(name)} <b>${escapeHtml(String(it.score))}</b></span>`;
            }).join('');
            return `<div class="forecast-new-dominants-row"><span class="forecast-new-dominants-label">${escapeHtml(t(label) || label)}</span><span class="forecast-new-dominants-chips">${cells}</span></div>`;
        };
        return `
            <div class="forecast-new-dominants">
                ${headline}
                ${ranked('page.forecastNew.dominants.planets', data.planets, null, 'planet')}
                ${ranked('page.forecastNew.dominants.signs', data.signs, null, 'sign')}
                ${ranked('page.forecastNew.dominants.houses', data.houses, null, 'house')}
                ${ranked('page.forecastNew.dominants.elements', data.elements, 'page.forecastNew.dominants.element')}
                ${ranked('page.forecastNew.dominants.modes', data.modes, 'page.forecastNew.dominants.mode')}
            </div>`;
    }

    function renderAntisciaBlock() {
        return renderAuxBlock({
            block: 'antiscia',
            containerId: 'natalAntisciaView',
            markup: antisciaBlockMarkup,
            emptyMarkup: () => `<div class="forecast-new-list-empty">${escapeHtml(t('page.forecastNew.profections.noSavedChart') || '—')}</div>`,
        });
    }
    function renderAsteroidsBlock() {
        return renderAuxBlock({
            block: 'asteroids',
            containerId: 'natalAsteroidsView',
            markup: asteroidsBlockMarkup,
            emptyMarkup: () => `<div class="forecast-new-list-empty">${escapeHtml(t('page.forecastNew.profections.noSavedChart') || '—')}</div>`,
        });
    }
    function renderDominantsBlock() {
        return renderAuxBlock({
            block: 'dominants',
            containerId: 'natalDominantsView',
            markup: dominantsBlockMarkup,
            emptyMarkup: () => `<div class="forecast-new-list-empty">${escapeHtml(t('page.forecastNew.profections.noSavedChart') || '—')}</div>`,
        });
    }

    function signLabel(name) {
        if (!name) return '';
        const key = `astro.sign.${name}`;
        const tr = t(key);
        return tr && tr !== key ? tr : name;
    }

    function profectionsBlockMarkup(data) {
        if (!data) {
            return `<div class="forecast-new-profections-empty">${escapeHtml(t('page.forecastNew.profections.empty') || '—')}</div>`;
        }
        const annual = data.annual || {};
        const monthly = data.monthly || {};
        const row = (labelKey, house, sign, lord) => `
            <div class="forecast-new-profections-row">
                <span class="forecast-new-profections-label">${escapeHtml(t(labelKey) || labelKey)}</span>
                <span class="forecast-new-profections-value">
                    ${escapeHtml(t('page.forecastNew.profections.house', { house }) || `${house}`)}
                    · ${escapeHtml(signLabel(sign))}
                    · ${escapeHtml(planetLabel(lord))}
                </span>
            </div>`;
        return `
            <div class="forecast-new-profections">
                <div class="forecast-new-profections-head">
                    <span>${escapeHtml(t('page.forecastNew.profections.age') || 'Age')}: ${escapeHtml(data.age)}</span>
                    <span>${escapeHtml(formatChartDate(data.target_date))}</span>
                </div>
                ${row('page.forecastNew.profections.annual', annual.house, annual.sign, annual.lord)}
                ${row('page.forecastNew.profections.monthly', monthly.house, monthly.sign, monthly.lord)}
            </div>`;
    }

    function renderProfectionsBlock() {
        const el = document.getElementById('natalProfectionsView')
            || document.getElementById('forecastNewBlockStore')?.querySelector('#natalProfectionsView');
        if (!el) return;
        if (!state.userId && !isNatalEdited()) {
            el.innerHTML = `<div class="forecast-new-profections-empty">${escapeHtml(t('page.forecastNew.profections.noSavedChart') || '—')}</div>`;
            return;
        }
        const cached = getCachedAuxBlock('profections');
        if (cached) el.innerHTML = profectionsBlockMarkup(cached);
        else if (!el.innerHTML.trim()) el.innerHTML = `<div class="forecast-new-profections-loading">${escapeHtml(t('common.loading') || '…')}</div>`;
        scheduleAuxBlockFetch(['profections']);
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
            if (PL.BLOCK_TARGET_MAP?.[`${source}:${view}`]) {
                out.push({ source: source, view: view });
            }
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
        advanced: ['profections', 'extraangles', 'antiscia', 'asteroids', 'dominants', 'fixstars'],
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
        document.getElementById('forecastNewPanelEditorStyles')?.remove();
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
        const previousBodyScrollTop = editor.querySelector('.forecast-new-pe-body')?.scrollTop || 0;
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
        const body = editor.querySelector('.forecast-new-pe-body');
        if (body && previousBodyScrollTop > 0) body.scrollTop = previousBodyScrollTop;
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
        if (Array.isArray(restored.activeLayers) && restored.activeLayers.length) {
            state.activeLayers = restored.activeLayers.map((l) => {
                const inst = { id: l.id, method: l.method };
                if (l.config && typeof l.config === 'object') inst.config = l.config;
                return inst;
            });
            // Сдвинуть генератор id, чтобы новые инстансы не коллизировали с восстановленными.
            state.activeLayers.forEach((l) => {
                const m = /-(\d+)$/.exec(l.id || '');
                if (m) _layerInstanceSeq = Math.max(_layerInstanceSeq, Number(m[1]));
            });
        }
        state.enabledLayers = state.activeLayers;
        // selectedRightLayerId предпочтительно; для старых снимков — первый инстанс метода.
        const restoredSelId = restored.selectedRightLayerId
            || (restored.selectedRightLayer
                ? state.activeLayers.find((l) => l.method === restored.selectedRightLayer)?.id
                : '');
        if (restoredSelId && state.activeLayers.some((l) => l.id === restoredSelId)) {
            state.selectedRightLayerId = restoredSelId;
        } else if (!selectedLayerInstance()) {
            state.selectedRightLayerId = state.activeLayers[0]?.id || '';
        }
        state.activeRightMethodTab = selectedRightMethod();
        state.directionType = normalizeDirectionType(restored.directionType || state.directionType);
        state.stepMode = restored.stepMode || state.stepMode;
        state.customStep = normalizeCustomStep(restored.customStep || state.customStep);
        state.wheelView = restored.wheelView === 'single' ? 'single' : 'multi';
        state.singleChartMode = restored.singleChartMode === 'composite' ? 'composite' : 'natal';
        state.compositeMethod = normalizeCompositeMethod(restored.compositeMethod || restored.pageSettings?.compositeMethod || state.compositeMethod);
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
                syncSolarInputs();
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
            compositeMethod: state.compositeMethod,
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
            showDeclinationAspects: restored.pageSettings?.showDeclinationAspects === true,
            angleAscDscBold: restored.pageSettings?.angleAscDscBold !== false,
            angleMcIcBold: restored.pageSettings?.angleMcIcBold !== false,
        };

        // Ship 2: засеять per-instance config из legacy-полей для слоёв без config
        // (старые снимки), затем загрузить config выбранного слоя в редактор-scratch.
        state.activeLayers.forEach((inst) => {
            if (methodHasConfig(inst.method) && !inst.config) captureScratchToConfig(inst);
        });
        applyConfigToScratch(selectedLayerInstance());
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
            compositeMethod: normalizeCompositeMethod(resolved?.view_options?.composite_method || state.pageSettings.compositeMethod || state.compositeMethod),
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
                composite_method: normalizeCompositeMethod(state.pageSettings.compositeMethod || state.compositeMethod),
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
            state.selectedRightLayerId = '';
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
            // Транзит всегда присутствует; целевой слой добавляется (или совпадает с транзитом).
            const methods = layer === 'transit' ? ['transit'] : ['transit', layer];
            state.activeLayers = methods.map((method) => ({ id: nextLayerInstanceId(method), method }));
            state.enabledLayers = state.activeLayers;
            const sel = state.activeLayers.find((l) => l.method === layer) || state.activeLayers[0];
            state.selectedRightLayerId = sel?.id || '';
            state.activeRightMethodTab = sel?.method || '';
        }
        // Synastry deep-link (from clients / client-profile / related-people): preselect
        // the partner so the synastry_partner layer loads after the source chart is restored.
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
        // Зафиксировать deep-link конфиг в соответствующем инстансе слоя.
        if (layer === 'synastry_partner' || layer === 'solar_return') {
            captureScratchToConfig(state.activeLayers.find((l) => l.method === layer));
        }
        if (params.has('date') || params.has('time') || params.has('layer')
            || params.has('directionType') || params.has('partner') || params.has('solarYear')) {
            window.history.replaceState({}, '', window.location.pathname);
        }
    }

    function buildCurrentSourceChartPayload({ title, chartKind, date: overrideDate, time: overrideTime, tags, personId }) {
        const [stateDate, stateTime] = splitTargetDatetime(state.natalSelectedDateTime);
        const date = overrideDate || stateDate;
        const time = overrideTime || stateTime;
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

    function getActiveReportChartData() {
        return isCompositeSingleMode() && state.compositeChartData
            ? state.compositeChartData
            : state.natalData;
    }

    async function saveCompositeChart() {
        if (!state.compositeChartData) {
            window.showToast?.(t('page.forecastNew.composite.noPartner') || 'Сначала выберите партнёра', 'warning');
            return;
        }
        const result = await window.SaveChartModal?.open({
            defaultTitle: defaultSourceChartTitle(),
            defaultDate: state.compositeChartData.birth_data?.date || splitTargetDatetime(state.natalSelectedDateTime)[0],
            defaultTime: state.compositeChartData.birth_data?.time || splitTargetDatetime(state.natalSelectedDateTime)[1],
            showTags: true,
            showPerson: false,
        });
        if (!result) return;
        const body = buildCompositeRequest();
        if (!body) return;
        try {
            const saved = await apiPost('/composite/save', {
                ...body,
                method: normalizeCompositeMethod(state.compositeMethod),
                title: result.title,
                tags: result.tags || [],
            });
            state.compositeChartData = {
                ...(saved.chart_data || state.compositeChartData),
                chart_kind: 'composite',
                composite_saved_chart_id: saved.composite_chart_id,
                title: saved.title || result.title || state.compositeChartData.title,
            };
            state.compositeMeta = state.compositeChartData.composite_meta || state.compositeMeta;
            window.AstroAPI?.saveChartToSession?.(state.compositeChartData);
            window.showToast?.(t('page.forecastNew.composite.saved') || 'Композит сохранён', 'success');
        } catch (error) {
            window.showToast?.(
                t('page.chart.actions.saveSourceChartError', { error: error.message }, error.message),
                'error'
            );
        }
    }

    function defaultSourceChartTitle() {
        if (isCompositeSingleMode() && state.compositeChartData) {
            return state.compositeChartData.title || state.compositeChartData.composite_pair_title || 'Композит';
        }
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

    // The person of the main (source) chart — used to pre-fill linked people when
    // saving a derived chart, so by default it belongs to the same person.
    async function resolveMainChartPersons() {
        const chartId = state.userId;
        if (!chartId) return [];
        try {
            const chart = await apiGet(`/charts/${encodeURIComponent(String(chartId))}`);
            if (chart?.person_id) {
                return [{
                    id: chart.person_id,
                    name: chart.person_display_name
                        || [chart.first_name, chart.last_name].filter(Boolean).join(' ').trim()
                        || '',
                }];
            }
        } catch (error) {
            console.warn('Failed to resolve main chart person', error);
        }
        return [];
    }

    async function saveCurrentSourceAsChart() {
        if (isCompositeSingleMode()) {
            await saveCompositeChart();
            return;
        }
        const result = await window.SaveChartModal?.open({
            defaultTitle: defaultSourceChartTitle(),
            defaultDate: splitTargetDatetime(state.natalSelectedDateTime)[0],
            defaultTime: splitTargetDatetime(state.natalSelectedDateTime)[1],
            showTags: true,
            showPerson: true,
            defaultPersons: await resolveMainChartPersons(),
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
            // Staying on the work screen (reload with a new natal): keep the origin
            // sourceUrl so the back button still points at the entry page, not this
            // chart. Only refresh the current-chart identity.
            window.AstroAPI?.patchNavigationState?.({
                currentView: 'forecast-new',
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

    // Right-panel save dispatcher. The button lives on the prognostic panel, so
    // it saves the currently selected right-layer source, never the left natal
    // source. Solar and synastry have computed/special snapshots; moment layers
    // save their selected date/time/place as a standalone event chart.
    async function saveRightPanelAsChart() {
        if (selectedRightMethod() === 'solar_return') {
            await saveSolarAsChart();
            return;
        }
        if (selectedRightMethod() === 'synastry_partner') {
            await saveSynastryPartnerAsChart();
            return;
        }
        if (isMomentMethod(selectedRightMethod())) {
            await saveRightMomentAsChart();
            return;
        }
        await saveCurrentSourceAsChart();
    }

    function nullableNumber(value) {
        if (value === null || value === undefined || value === '') return null;
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    function defaultRightMomentChartTitle(method, date) {
        return [layerLabel(method), date ? formatChartDate(date) : '']
            .filter(Boolean)
            .join(' · ')
            || defaultSourceChartTitle();
    }

    function rightMomentSnapshotFromSelectedLayer() {
        const inst = selectedLayerInstance();
        if (!inst || !isMomentMethod(inst.method)) return null;
        const cfg = layerConfigOf(inst);
        const [date, time] = splitTargetDatetime(cfg.datetime || state.selectedDateTime);
        const location = cfg.location || state.location || {};
        return {
            title: cfg.chartTitle || defaultRightMomentChartTitle(inst.method, date),
            chartKind: 'event',
            date,
            time: normalizeTime(time || '12:00:00'),
            timezone: cfg.timezone || state.timezone || 'UTC',
            locationName: location.name || '',
            latitude: nullableNumber(location.latitude),
            longitude: nullableNumber(location.longitude),
            houseSystem: normalizeHouseSystemCode(state.pageSettings?.houseSystem || 'P'),
            defaultPersons: [],
        };
    }

    async function linkExtraPersonsToChart(chartId, personIds = []) {
        const extraPersonIds = (personIds || []).slice(1);
        for (const pid of extraPersonIds) {
            try {
                await apiPost(`/persons/${encodeURIComponent(pid)}/charts`, { chart_id: chartId });
            } catch (linkErr) {
                console.warn('Failed to link extra person to chart', pid, linkErr);
            }
        }
    }

    async function saveRightMomentAsChart() {
        const snapshot = rightMomentSnapshotFromSelectedLayer();
        if (!snapshot?.date || !snapshot?.time) {
            window.showToast?.(
                t('page.forecast.errors.dateRequired', null, 'Требуется указать дату'),
                'warning',
            );
            return;
        }
        if (!snapshot.locationName && (snapshot.latitude === null || snapshot.longitude === null)) {
            window.showToast?.(
                t('page.clients.newChart.errors.placeRequired', null, 'Укажите место и выберите его из списка'),
                'warning',
            );
            return;
        }
        const result = await window.SaveChartModal?.open({
            defaultTitle: snapshot.title,
            defaultDate: snapshot.date,
            defaultTime: snapshot.time,
            showTags: true,
            showPerson: true,
            defaultPersons: await resolveMainChartPersons(),
        });
        if (!result) return;
        try {
            const payload = {
                title: result.title,
                chart_kind: snapshot.chartKind,
                date: result.date,
                time: normalizeTime(result.time || snapshot.time || '12:00:00'),
                timezone: snapshot.timezone || 'UTC',
                location_name: snapshot.locationName || null,
                latitude: snapshot.latitude,
                longitude: snapshot.longitude,
                house_system: snapshot.houseSystem,
                tags: Array.isArray(result.tags) ? result.tags : [],
            };
            if (result.personId) payload.person_id = result.personId;
            const saved = await apiPost('/charts', payload);
            const newChartId = saved.chart_id || saved.user_id;
            await linkExtraPersonsToChart(newChartId, result.personIds || []);
            await applySavedChartMoment(saved);
            window.showToast?.(
                t('page.chart.actions.saveSourceChartSaved', null, 'Карта сохранена в библиотеку.'),
                'success',
            );
        } catch (error) {
            window.showToast?.(
                t('page.chart.actions.saveSourceChartError', { error: error.message }, error.message),
                'error',
            );
        }
    }

    function splitSynastryDisplayName(name) {
        const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return { firstName: null, lastName: null };
        return {
            firstName: parts[0],
            lastName: parts.slice(1).join(' ') || null,
        };
    }

    function synastrySnapshotFromManual(manual = {}) {
        const title = manual.title || manual.name || t('page.forecastNew.resultViews.manualPartner');
        const split = splitSynastryDisplayName(manual.name || manual.title || '');
        const latitude = manual.latitude === null || manual.latitude === undefined || manual.latitude === ''
            ? null
            : numberOrNull(manual.latitude);
        const longitude = manual.longitude === null || manual.longitude === undefined || manual.longitude === ''
            ? null
            : numberOrNull(manual.longitude);
        return {
            title,
            date: manual.date || '',
            time: normalizeTime(manual.time || '12:00:00'),
            timezone: manual.timezone || 'UTC',
            locationName: manual.place || '',
            latitude,
            longitude,
            houseSystem: state.pageSettings?.houseSystem || 'P',
            firstName: split.firstName,
            lastName: split.lastName,
            defaultPersons: [],
        };
    }

    function synastrySnapshotFromChart(chart = {}) {
        const moment = readChartMoment(chart);
        const title = chartDisplayTitle(chart, t('page.chart.nav.synastry'));
        return {
            title,
            date: moment.date,
            time: normalizeTime(moment.time || '12:00:00'),
            timezone: moment.timezone || 'UTC',
            locationName: moment.locationName || '',
            latitude: moment.latitude,
            longitude: moment.longitude,
            houseSystem: normalizeHouseSystemCode(chart.house_system || chart.birth_data?.house_system || state.pageSettings?.houseSystem || 'P'),
            firstName: chart.first_name || chart.birth_data?.first_name || null,
            lastName: chart.last_name || chart.birth_data?.last_name || null,
            defaultPersons: chart.person_id ? [{
                id: chart.person_id,
                name: chart.person_display_name
                    || [chart.first_name, chart.last_name].filter(Boolean).join(' ').trim()
                    || title,
            }] : [],
        };
    }

    async function resolveSynastryPartnerSnapshot() {
        const inst = selectedLayerInstance();
        const cfg = layerConfigOf(inst || 'synastry_partner');
        if (cfg.mode === 'manual' && cfg.manual) {
            return synastrySnapshotFromManual(cfg.manual);
        }
        const rawPartner = selectedViewModelLayer()?.raw?.partner_chart;
        if (rawPartner?.birth_data?.date) {
            return synastrySnapshotFromChart({
                ...rawPartner.birth_data,
                birth_data: rawPartner.birth_data,
                title: inst?.config?.chartTitle || state.synastryManual?.name || '',
                display_title: inst?.config?.chartTitle || state.synastryManual?.name || '',
            });
        }
        if (cfg.partnerId) {
            const chart = await cmdFetchChartById(cfg.partnerId);
            if (chart) return synastrySnapshotFromChart(chart);
        }
        return null;
    }

    async function saveSynastryPartnerAsChart() {
        const snapshot = await resolveSynastryPartnerSnapshot();
        if (!snapshot?.date || !snapshot?.time) {
            window.showToast?.(
                t('page.forecastNew.synastry.notReady', null, 'Сначала рассчитайте синастрию'),
                'warning',
            );
            return;
        }
        const result = await window.SaveChartModal?.open({
            defaultTitle: snapshot.title || defaultSourceChartTitle(),
            defaultDate: snapshot.date,
            defaultTime: snapshot.time,
            showTags: true,
            showPerson: true,
            defaultPersons: snapshot.defaultPersons || [],
        });
        if (!result) return;
        try {
            const payload = {
                title: result.title,
                chart_kind: 'birth',
                date: result.date,
                time: normalizeTime(result.time || snapshot.time || '12:00:00'),
                timezone: snapshot.timezone || 'UTC',
                location_name: snapshot.locationName || null,
                latitude: snapshot.latitude,
                longitude: snapshot.longitude,
                house_system: normalizeHouseSystemCode(snapshot.houseSystem || state.pageSettings.houseSystem || 'P'),
                tags: Array.isArray(result.tags) ? result.tags : [],
            };
            if (snapshot.firstName) payload.first_name = snapshot.firstName;
            if (snapshot.lastName) payload.last_name = snapshot.lastName;
            if (result.personId) payload.person_id = result.personId;
            const saved = await apiPost('/charts', payload);
            const newChartId = saved.chart_id || saved.user_id;
            const extraPersonIds = (result.personIds || []).slice(1);
            for (const pid of extraPersonIds) {
                try {
                    await apiPost(`/persons/${encodeURIComponent(pid)}/charts`, { chart_id: newChartId });
                } catch (linkErr) {
                    console.warn('Failed to link extra person to synastry chart', pid, linkErr);
                }
            }
            await applySavedSynastryPartnerChart(saved);
            window.showToast?.(
                t('page.forecastNew.synastry.saved', null, 'Партнёр синастрии сохранён как карта'),
                'success',
            );
        } catch (error) {
            window.showToast?.(
                t('page.chart.actions.saveSourceChartError', { error: error.message }, error.message),
                'error',
            );
        }
    }

    // Save the currently displayed solar return as a standalone chart
    // (chart_kind=solar_point). The save modal is pre-filled with the COMPUTED
    // solar moment (date/time/place differ from birth) so the user just confirms.
    // This only ADDS a new chart; it never touches the natal or other charts.
    async function saveSolarAsChart() {
        const info = selectedViewModelLayer()?.raw?.solar_info;
        if (!info || !info.solar_datetime_local) {
            window.showToast?.(
                t('page.forecastNew.solar.notReady', null, 'Сначала рассчитайте соляр'),
                'warning',
            );
            return;
        }
        const [solarDate, solarClock] = String(info.solar_datetime_local).split('T');
        // Strip the TZ offset/Z suffix from the clock part → bare HH:MM:SS.
        const solarTime = String(solarClock || '').split(/[+\-Z]/)[0].slice(0, 8);
        const result = await window.SaveChartModal?.open({
            defaultTitle: defaultSolarChartTitle(info),
            defaultDate: solarDate,
            defaultTime: solarTime,
            showTags: true,
            showPerson: true,
            defaultPersons: await resolveMainChartPersons(),
        });
        if (!result) return;
        try {
            const payload = {
                title: result.title,
                chart_kind: 'solar_point',
                date: result.date,
                time: normalizeTime(result.time || solarTime || '12:00:00'),
                timezone: info.timezone || 'UTC',
                location_name: info.location?.name || null,
                latitude: info.location?.latitude,
                longitude: info.location?.longitude,
                house_system: normalizeHouseSystemCode(info.house_system || 'P'),
                tags: Array.isArray(result.tags) ? result.tags : [],
            };
            if (result.personId) payload.person_id = result.personId;
            const saved = await apiPost('/charts', payload);
            const newChartId = saved.chart_id || saved.user_id;
            const extraPersonIds = (result.personIds || []).slice(1);
            for (const pid of extraPersonIds) {
                try {
                    await apiPost(`/persons/${encodeURIComponent(pid)}/charts`, { chart_id: newChartId });
                } catch (linkErr) {
                    console.warn('Failed to link extra person to solar chart', pid, linkErr);
                }
            }
            // Stay in the current workspace — we only added a chart to the library.
            window.showToast?.(
                t('page.forecastNew.solar.saved', null, 'Соляр сохранён как карта'),
                'success',
            );
        } catch (error) {
            window.showToast?.(
                t('page.chart.actions.saveSourceChartError', { error: error.message }, error.message),
                'error',
            );
        }
    }

    function defaultSolarChartTitle(info) {
        const birth = state.natalData?.birth_data || {};
        const name = [birth.first_name, birth.last_name].filter(Boolean).join(' ').trim();
        const year = String(state.solarYear || info?.year || '');
        const label = t('page.forecastNew.solar.chartTitlePrefix', null, 'Соляр');
        return [name, [label, year].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
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
                selectedRightLayerId: state.selectedRightLayerId,
                selectedRightLayer: selectedRightMethod(),
                directionType: state.directionType,
                stepMode: state.stepMode,
                customStep: state.customStep,
                wheelView: state.wheelView,
                singleChartMode: state.singleChartMode,
                compositeMethod: state.compositeMethod,
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

    function buildLayerCacheKey(layer, date, context = {}) {
        // layer — инстанс { id, method } либо строка-метод. layerId различает
        // несколько инстансов одного метода (два транзита → разные ключи кэша).
        const method = typeof layer === 'string' ? layer : layer?.method;
        const layerId = typeof layer === 'string' ? layer : (layer?.id || layer?.method);
        const selectedDateTime = context.selectedDateTime || state.selectedDateTime;
        const timezone = context.timezone || state.timezone;
        const location = context.location || state.location || {};
        const directionType = normalizeDirectionType(context.directionType || state.directionType);
        // Идентичность натала в ключе (фикс M2): слой против отредактированного натала
        // не должен коллидировать со слоем против сохранённого (или другой правки).
        const natalToken = natalCacheToken();
        if (method === 'transit') {
            return [
                layerId,
                natalToken,
                selectedDateTime,
                timezone,
                location?.name || '',
                location?.latitude ?? '',
                location?.longitude ?? '',
            ].join('|');
        }
        if (method === 'direction') {
            return [layerId, natalToken, date, directionType].join('|');
        }
        if (method === 'progression') {
            return [layerId, natalToken, selectedDateTime, timezone].join('|');
        }
        if (method === 'solar_return') {
            const cfg = layerConfigOf(layer);
            const loc = cfg.location || {};
            return [layerId, natalToken, cfg.year ?? '',
                loc.latitude ?? '', loc.longitude ?? ''].join('|');
        }
        if (method === 'synastry_partner') {
            const cfg = layerConfigOf(layer);
            if (cfg.mode === 'manual') {
                const m = cfg.manual || {};
                return [layerId, natalToken, 'manual', m.date || '', m.time || '', m.timezone || '',
                    m.latitude ?? '', m.longitude ?? '', m.place || ''].join('|');
            }
            return [layerId, natalToken, cfg.partnerId || ''].join('|');
        }
        return [layerId, natalToken, date].join('|');
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

    function redirectToChartLibrary() {
        window.AstroAPI?.saveNavigationState?.({
            sourceView: 'forecast-new',
            sourceUrl: '/',
            clientUserId: null,
            partnerUserId: null,
        });
        window.showPageLoader?.();
        window.location.replace('/');
    }

    // ── Command facade (PR1 — ASSISTANT_ACTIONS_IMPLEMENTATION_PLAN.md) ───────
    // A narrow, curated surface for natural-language / voice "actions". chat.js
    // (PR3) and a future command palette call window.ForecastCommands.apply();
    // the agent only emits validated intents. We never expose raw internals —
    // only this adapter, which routes each command through the SAME imperative
    // functions the UI controls already use (so behavior/persistence match).
    function cmdClone(value) {
        return value == null ? value : JSON.parse(JSON.stringify(value));
    }

    // Serializable slice restored by the `restore_workspace` undo inverse.
    function cmdSnapshot() {
        return {
            activeLayers: cmdClone(state.activeLayers),
            selectedRightLayerId: state.selectedRightLayerId,
            selectedDateTime: state.selectedDateTime,
            timezone: state.timezone,
            location: cmdClone(state.location),
            solarYear: state.solarYear,
            solarLocation: cmdClone(state.solarLocation),
            synastryMode: state.synastryMode,
            synastryPartnerId: state.synastryPartnerId,
            synastryManual: cmdClone(state.synastryManual),
        };
    }

    function cmdDescribeState() {
        const [date, time] = splitTargetDatetime(state.selectedDateTime || '');
        return {
            date,
            time,
            datetime: state.selectedDateTime,
            timezone: state.timezone,
            solarYear: state.solarYear,
            wheelView: state.wheelView,
            houseSystem: state.pageSettings?.houseSystem || 'P',
            activeLayers: state.activeLayers.map((l) => ({ id: l.id, method: l.method })),
            selectedLayerId: state.selectedRightLayerId,
            synastry: buildAssistantSynastryContext(),
            resources: buildAssistantWorkspaceResources(),
            snapshot: cmdSnapshot(),
        };
    }

    // Mirror the stepper's side-effect tail so a programmatic moment change
    // refreshes controls, meta, persistence, and reloads the selected layer.
    function cmdApplyMoment(value) {
        applyDisplayedMomentDateTime(value);
        syncControlsFromState();
        updatePrognosticTimeMeta();
        schedulePersist();
        scheduleDisplayedMomentLayerLoad({ layerId: state.selectedRightLayerId });
    }

    async function cmdEnsureMomentLayer(preferredMethod = 'transit') {
        const selected = selectedLayerInstance();
        if (selected && isMomentMethod(selected.method)) return selected;

        const fallback = instancesOfMethod(preferredMethod)[0]
            || state.activeLayers.find((inst) => isMomentMethod(inst.method));
        if (fallback) {
            state.selectedRightLayerId = fallback.id;
            state.activeRightMethodTab = fallback.method;
            applyConfigToScratch(fallback);
            normalizeActiveLayers();
            renderRightLayerTabs();
            scheduleRightPanelRender();
            syncControlsFromState();
            schedulePersist();
            return fallback;
        }

        await activateLayer(preferredMethod);
        const created = selectedLayerInstance();
        return created && isMomentMethod(created.method) ? created : null;
    }

    async function cmdRestoreWorkspace(snapshot) {
        if (!snapshot) return { ok: false, error: { code: 'no_snapshot' } };
        state.activeLayers = Array.isArray(snapshot.activeLayers)
            ? snapshot.activeLayers.map((l) => ({ ...l }))
            : [];
        state.selectedRightLayerId = snapshot.selectedRightLayerId
            || state.activeLayers[0]?.id || '';
        state.selectedDateTime = snapshot.selectedDateTime || state.selectedDateTime;
        state.targetDatetime = state.selectedDateTime;
        state.timezone = snapshot.timezone || state.timezone;
        state.location = snapshot.location || state.location;
        if (snapshot.solarYear != null) state.solarYear = snapshot.solarYear;
        state.solarLocation = snapshot.solarLocation ?? state.solarLocation;
        state.synastryMode = snapshot.synastryMode ?? state.synastryMode;
        state.synastryPartnerId = snapshot.synastryPartnerId ?? state.synastryPartnerId;
        state.synastryManual = snapshot.synastryManual ?? state.synastryManual;
        normalizeActiveLayers();
        syncControlsFromState();
        renderRightLayerTabs();
        scheduleRightPanelRender();
        schedulePersist();
        await loadActiveLayers();
        return { ok: true };
    }

    // Fetch a saved chart (ChartResponse) by id for set_synastry_partner.
    async function cmdFetchChartById(chartId) {
        if (!chartId) return null;
        try {
            const headers = window.AstroAPI?.withLocaleHeaders
                ? window.AstroAPI.withLocaleHeaders({}) : {};
            const resp = await fetch(`${API_BASE}/charts/${encodeURIComponent(chartId)}`, {
                credentials: 'include', headers,
            });
            if (!resp.ok) return null;
            return await resp.json();
        } catch (_) {
            return null;
        }
    }

    async function cmdDispatch(action) {
        const args = action.args || {};
        switch (action.name) {
            case 'set_transit_date': {
                const target = await cmdEnsureMomentLayer('transit');
                if (!target) {
                    return {
                        ok: false,
                        error: {
                            code: 'no_moment_layer',
                            message: 'No transit/prognostic layer is available',
                        },
                    };
                }
                const [, currentTime] = splitTargetDatetime(
                    getDisplayedMomentDateTime() || state.selectedDateTime || '');
                const time = args.time || currentTime || '00:00:00';
                cmdApplyMoment(`${args.date}T${time}`);
                return { ok: true, layerId: target.id, label: args.date };
            }
            case 'step_date': {
                const target = await cmdEnsureMomentLayer('transit');
                if (!target) {
                    return {
                        ok: false,
                        error: {
                            code: 'no_moment_layer',
                            message: 'No transit/prognostic layer is available',
                        },
                    };
                }
                const dir = args.direction === 'backward' ? -1 : 1;
                const unit = args.unit === 'week' ? 'day' : args.unit;
                const amount = (args.unit === 'week' ? args.amount * 7 : args.amount) * dir;
                const base = getDisplayedMomentDateTime() || state.selectedDateTime;
                cmdApplyMoment(addDateTimeUnit(base, unit, amount));
                return { ok: true, layerId: target.id };
            }
            case 'add_layer': {
                await activateLayer(args.method);
                const inst = instancesOfMethod(args.method).slice(-1)[0];
                return { ok: true, layerId: inst?.id, label: args.method };
            }
            case 'build_solar':
            case 'set_solar_year': {
                if (!hasActiveMethod('solar_return')) await activateLayer('solar_return');
                await applySolarYear(args.year);
                const inst = instancesOfMethod('solar_return').slice(-1)[0];
                return { ok: true, layerId: inst?.id, label: String(args.year) };
            }
            case 'set_wheel_view': {
                setWheelView(args.view);
                return { ok: true, label: args.view };
            }
            case 'set_house_system': {
                const code = normalizeHouseSystemCode(args.system);
                state.pageSettings.houseSystem = code;
                await updateHouseSystem(code);
                syncControlsFromState();
                return { ok: true, label: code };
            }
            case 'set_synastry_partner': {
                if (args.manual) {
                    await activateLayer('synastry_partner');
                    const applied = await applyManualSynastryPartner(args.manual);
                    if (!applied?.ok) {
                        return { ok: false, error: { code: applied?.error || 'bad_manual_synastry' } };
                    }
                    return { ok: true, layerId: selectedLayerInstance()?.id, label: applied.label };
                }
                const chart = await cmdFetchChartById(args.chart_id);
                if (!chart || !(chart.date || chart.birth_date)) {
                    return { ok: false, error: { code: 'chart_not_found' } };
                }
                // activateLayer selects (or creates) the synastry layer so
                // applySavedSynastryPartnerChart writes to the right instance.
                await activateLayer('synastry_partner');
                await applySavedSynastryPartnerChart(chart);
                const name = args.title || chartOptionLabel(chart);
                return { ok: true, label: name };
            }
            case 'remove_layer': {
                if (args.layer_id) await removeLayerInstance(args.layer_id);
                else await deactivateMethod(args.method);
                return { ok: true, label: args.layer_id || args.method };
            }
            case 'clear_layers': {
                const methods = [...new Set(activeLayerMethods())];
                for (const method of methods) {
                    await deactivateMethod(method); // eslint-disable-line no-await-in-loop
                }
                return { ok: true };
            }
            case 'restore_workspace':
                return cmdRestoreWorkspace(args.snapshot);
            default:
                return { ok: false, error: { code: 'unknown_command', message: action.name } };
        }
    }

    // Minimal toast + Undo. PR5 moves the copy into the i18n catalogs and the
    // styling into CSS; kept self-contained here so PR1 touches no templates.
    const CMD_TOAST_LABELS = {
        set_transit_date: 'Дата транзита изменена',
        step_date: 'Дата сдвинута',
        add_layer: 'Слой добавлен',
        build_solar: 'Соляр построен',
        set_solar_year: 'Год соляра изменён',
        set_wheel_view: 'Вид колеса изменён',
        set_house_system: 'Система домов изменена',
        set_synastry_partner: 'Синастрия построена',
        remove_layer: 'Слой удалён',
        clear_layers: 'Слои очищены',
    };
    let cmdToastTimer = null;

    function cmdToastElement() {
        let el = document.getElementById('forecastCommandToast');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'forecastCommandToast';
        el.setAttribute('role', 'status');
        el.style.cssText = [
            'position:fixed', 'left:50%', 'bottom:24px', 'transform:translateX(-50%)',
            'z-index:1200', 'display:none', 'align-items:center', 'gap:12px',
            'max-width:90vw', 'padding:10px 14px', 'border-radius:12px',
            'background:rgba(20,22,28,0.92)', 'color:#fff',
            'font:13px/1.35 -apple-system,system-ui,sans-serif',
            'box-shadow:0 8px 24px rgba(0,0,0,0.25)',
        ].join(';');
        const text = document.createElement('span');
        text.setAttribute('data-cmd-toast-text', '');
        const undo = document.createElement('button');
        undo.type = 'button';
        undo.setAttribute('data-cmd-toast-undo', '');
        undo.textContent = 'Отменить';
        undo.style.cssText = 'border:0;background:rgba(255,255,255,0.16);color:#fff;'
            + 'border-radius:8px;padding:5px 10px;cursor:pointer;font:inherit';
        undo.addEventListener('click', async () => {
            undo.disabled = true;
            await window.ForecastCommands?.undo?.();
            cmdHideToast();
        });
        el.append(text, undo);
        document.body.appendChild(el);
        return el;
    }

    function cmdHideToast() {
        const el = document.getElementById('forecastCommandToast');
        if (el) el.style.display = 'none';
        clearTimeout(cmdToastTimer);
    }

    function cmdShowToast(applied) {
        const el = cmdToastElement();
        const base = CMD_TOAST_LABELS[applied.name] || 'Готово';
        const label = applied.result?.label;
        el.querySelector('[data-cmd-toast-text]').textContent = label ? `${base}: ${label}` : base;
        const undo = el.querySelector('[data-cmd-toast-undo]');
        undo.hidden = !applied.undoable;
        undo.disabled = false;
        el.style.display = 'flex';
        clearTimeout(cmdToastTimer);
        cmdToastTimer = setTimeout(cmdHideToast, 8000);
    }

    if (typeof window !== 'undefined' && window.ForecastCommandsKit) {
        window.ForecastCommands = window.ForecastCommandsKit.createForecastCommands(
            { describeState: cmdDescribeState, dispatch: cmdDispatch },
            { onApplied: cmdShowToast },
        );
    }
})();

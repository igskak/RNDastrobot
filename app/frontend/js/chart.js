/**
 * Главный скрипт страницы натальной карты
 */

let chartWheel = null;
let chartDataRenderer = null;
let inFlightRecalcPromise = null;
let inFlightRecalcKey = null;
let currentHoveredAspectKey = null;
let chartToastTimer = null;
let currentResolvedPreferences = null;
let activeConfigurationCard = null;
let configPointTooltipEl = null;
let chartRelatedPeoplePicker = null;
let synastryLauncherPeople = [];
const CHART_TOGGLEABLE_POINTS = [
    'Chiron',
    'TrueNode',
    'SouthNode',
    'BlackMoon',
    'WhiteMoon',
    'Proserpina',
    'PartOfFortune',
];
const editClientState = {
    autocompleteBound: false,
    mode: 'edit-client',
    originalCoords: null,
    selectedCoords: null,
    originalPlace: '',
    selectedPlaceLabel: '',
    returnToLauncherOnCancel: false,
    skipLauncherRestore: false,
};
const HOUSE_SYSTEM_ALIASES = {
    'P': 'P',
    'K': 'K',
    'O': 'O',
    'R': 'R',
    'C': 'C',
    'E': 'E',
    'W': 'W',
    'X': 'X',
    'H': 'H',
    'T': 'T',
    'B': 'B',
    'M': 'M',
    'PLACIDUS': 'P',
    'KOCH': 'K',
    'PORPHYRY': 'O',
    'REGIOMONTANUS': 'R',
    'CAMPANUS': 'C',
    'EQUAL': 'E',
    'WHOLE_SIGN': 'W',
    'WHOLESIGN': 'W'
};
const NATAL_ASPECT_TYPES = window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES || [
    'Conjunction',
    'Opposition',
    'Trine',
    'Square',
    'Sextile',
    'Vigintile',
    'Semi_Nonagon',
    'Semisextile',
    'Decile',
    'Nonagon',
    'Semisquare',
    'Quintile',
    'Binonagon',
    'Sentagon',
    'Tridecile',
    'Sesquiquadrate',
    'Biquintile',
    'Quincunx',
];
const ASPECT_PHASE_STORAGE_KEY = 'natalAspectPhaseFilter';
const HOUSE_NUMBER_STYLE_STORAGE_KEY = 'natalHouseNumberStyle';
const HOUSE_LABELS_OUTSIDE_STORAGE_KEY = 'natalHouseLabelsOutside';
const ANGLE_ASC_DSC_BOLD_STORAGE_KEY = 'natalAngleAscDscBold';
const ANGLE_MC_IC_BOLD_STORAGE_KEY = 'natalAngleMcIcBold';
const ASPECT_NAME_ALIASES = {
    TrueNorthNode: 'TrueNode',
    TrueSouthNode: 'SouthNode',
    Fortune: 'PartOfFortune',
};

function t(key, params) {
    return window.FrontendI18n?.t?.(key, params) || key;
}

async function waitForI18nReady() {
    if (!window.FrontendI18n?.ready) return;
    await Promise.resolve(window.FrontendI18n.ready).catch(() => {});
}

function normalizeHouseSystemCode(value) {
    const raw = String(value || 'P').trim().toUpperCase().replace(/[\s-]+/g, '_');
    return HOUSE_SYSTEM_ALIASES[raw] || 'P';
}

function escapeAttribute(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function getPlanetNameLabel(name) {
    const key = `astro.planet.${name}`;
    const translated = t(key);
    return translated === key
        ? (window.Symbols?.getPlanetNameRu?.(name) || window.Symbols?.planetNamesRu?.[name] || name)
        : translated;
}

function getPlanetSymbolMarkup(name, options = {}) {
    return window.Symbols?.getPlanetSymbolMarkup?.(name, options)
        || `<span class="astro-symbol">${escapeAttribute(window.Symbols?.getPlanetSymbol?.(name) || '')}</span>`;
}

function normalizeAspectPhaseFilter(value) {
    if (window.AstroAspectPhase?.normalizeAspectPhaseFilter) {
        return window.AstroAspectPhase.normalizeAspectPhaseFilter(value);
    }
    if (Array.isArray(value)) {
        const normalized = value
            .map((entry) => String(entry || '').trim().toLowerCase())
            .filter((entry) => entry === 'applying' || entry === 'separating');
        return [...new Set(normalized)];
    }
    const raw = String(value || '').trim().toLowerCase();
    if (!raw || raw === 'all') return ['applying', 'separating'];
    if (raw.includes(',')) return normalizeAspectPhaseFilter(raw.split(','));
    return raw === 'applying' || raw === 'separating' ? [raw] : ['applying', 'separating'];
}

function serializeAspectPhaseFilter(value) {
    const normalized = normalizeAspectPhaseFilter(value);
    if (normalized.length === 2) return 'all';
    return normalized.join(',');
}

function readSavedAspectPhaseFilter() {
    return normalizeAspectPhaseFilter(localStorage.getItem(ASPECT_PHASE_STORAGE_KEY));
}

function readSavedHouseNumberStyle() {
    return localStorage.getItem(HOUSE_NUMBER_STYLE_STORAGE_KEY) === 'roman' ? 'roman' : 'arabic';
}

function readSavedHouseLabelsOutside() {
    return localStorage.getItem(HOUSE_LABELS_OUTSIDE_STORAGE_KEY) === 'true';
}

function readSavedAngleBold(storageKey) {
    return localStorage.getItem(storageKey) !== 'false';
}

let currentSettings = {
    houseSystem: 'P',
    hiddenPlanets: [],
    orientation: 'aries',
    aspectScope: 'all',
    matrixRows: window.AstroPreferences?.ensureMatrixRows?.({}) || {},
    enabledAspectTypes: [...NATAL_ASPECT_TYPES],
    showApplyingSeparating: true,
    aspectPhaseFilter: readSavedAspectPhaseFilter(),
    showSpeed: true,
    showStationary: true,
    showAspectText: false,
    showWheelStationary: false,
    showWheelDegree: false,
    planetScale: readSavedPlanetScale(),
    pointScale: readSavedPointScale(),
    houseNumberStyle: readSavedHouseNumberStyle(),
    houseLabelsOutside: readSavedHouseLabelsOutside(),
    angleAscDscBold: readSavedAngleBold(ANGLE_ASC_DSC_BOLD_STORAGE_KEY),
    angleMcIcBold: readSavedAngleBold(ANGLE_MC_IC_BOLD_STORAGE_KEY),
};

function clampPointScale(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 1;
    return Math.min(1.7, Math.max(0.8, n));
}

function readSavedUnifiedScale() {
    const raw = localStorage.getItem('natalPlanetScale')
        || localStorage.getItem('natalPointScale')
        || '1.2';
    return clampPointScale(parseFloat(raw));
}

function readSavedPlanetScale() {
    return readSavedUnifiedScale();
}

function readSavedPointScale() {
    return readSavedUnifiedScale();
}

function normalizeAspectBodyName(name) {
    return ASPECT_NAME_ALIASES[name] || name;
}

function buildAspectPairKey(left, right) {
    const normalizedLeft = normalizeAspectBodyName(left);
    const normalizedRight = normalizeAspectBodyName(right);
    return normalizedLeft <= normalizedRight
        ? `${normalizedLeft}-${normalizedRight}`
        : `${normalizedRight}-${normalizedLeft}`;
}

function getAspectPhaseState(aspect) {
    return window.AstroAspectPhase?.getAspectPhaseState
        ? window.AstroAspectPhase.getAspectPhaseState(aspect)
        : 'all';
}

function aspectMatchesPhaseFilter(aspect, filter = currentSettings.aspectPhaseFilter) {
    return window.AstroAspectPhase?.aspectMatchesPhaseFilter
        ? window.AstroAspectPhase.aspectMatchesPhaseFilter(aspect, filter)
        : true;
}

function getChartNavigationState() {
    return window.AstroAPI?.getNavigationState?.() || {};
}

function getChartBackUrl() {
    const state = getChartNavigationState();
    if (typeof state.sourceUrl === 'string' && state.sourceUrl.trim()) {
        return state.sourceUrl;
    }
    return '/';
}

function getChartSynastryUrl() {
    const userId = getCurrentChartUserId();
    const state = getChartNavigationState();
    if (userId && state.partnerUserId && String(state.clientUserId || '') === String(userId)) {
        return window.AstroAPI?.buildSynastryUrl?.(userId, state.partnerUserId) || null;
    }
    return null;
}

function navigateFromChart(target) {
    const userId = getCurrentChartUserId();
    const state = getChartNavigationState();
    const patch = {
        sourceView: 'chart',
        sourceUrl: '/chart.html',
        clientUserId: userId ? String(userId) : state.clientUserId,
    };

    if (String(state.clientUserId || '') !== String(userId || '')) {
        patch.partnerUserId = null;
    } else if (state.partnerUserId) {
        patch.partnerUserId = String(state.partnerUserId);
    }

    window.AstroAPI?.saveNavigationState?.(patch);
    window.showPageLoader?.();
    window.location.href = target;
}

function configureChartHeaderNavigation() {
    const backBtn = document.querySelector('.back-btn-compact');
    const tablesBtn = document.querySelector('.header-nav-buttons a[href="natal-full.html"]');
    const forecastBtn = document.querySelector('.header-nav-buttons a[href="forecast-new.html"]');
    const synastryBtn = document.getElementById('openSynastryNavBtn');
    const userId = getCurrentChartUserId();

    if (backBtn) {
        backBtn.href = getChartBackUrl();
    }

    if (synastryBtn) {
        synastryBtn.disabled = !userId;
    }

    tablesBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        navigateFromChart('/natal-full.html');
    });

    forecastBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        navigateFromChart('/forecast-new.html');
    });

    synastryBtn?.addEventListener('click', () => {
        const synastryUrl = getChartSynastryUrl();
        if (synastryUrl) {
            navigateFromChart(synastryUrl);
            return;
        }
        openSynastryLauncherDialog();
    });
}

function handleChartOpenQueryAction() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('open') !== 'synastry') return;
    params.delete('open');
    const nextQuery = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`);
    openSynastryLauncherDialog();
}

function filterChartDataByAspectPhase(chartData) {
    return window.AstroAspectPhase?.filterChartDataByAspectPhase
        ? window.AstroAspectPhase.filterChartDataByAspectPhase(chartData, currentSettings.aspectPhaseFilter)
        : chartData;
}

async function loadFreshNatalChartData(fallbackChartData) {
    const userId = fallbackChartData?.user_id || localStorage.getItem('currentUserId');
    if (!userId || !window.AstroAPI?.getNatalChart) {
        return fallbackChartData;
    }

    try {
        const freshChartData = await window.AstroAPI.getNatalChart(userId);
        return ensureChartUserId(freshChartData, userId);
    } catch (error) {
        console.warn('Failed to load fresh natal chart, using session snapshot:', error);
        return fallbackChartData;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await waitForI18nReady();

    const me = await window.AstroAPI?.requireAuth?.({ redirectTo: '/login.html' });
    if (!me) return;

    // Получаем данные карты из сессии
    let chartData = AstroAPI.getChartFromSession();
    const formData = AstroAPI.getFormData();

    if (!chartData) {
        window.location.href = 'index.html';
        return;
    }

    chartData = await loadFreshNatalChartData(chartData);

    currentSettings.houseSystem = normalizeHouseSystemCode(
        chartData.birth_data?.house_system || formData?.houseSystem || 'P'
    );

    const initialNavState = getChartNavigationState();
    window.AstroAPI?.patchNavigationState?.({
        currentView: 'chart',
        clientUserId: getCurrentChartUserId() ? String(getCurrentChartUserId()) : initialNavState.clientUserId,
        partnerUserId: String(initialNavState.clientUserId || '') === String(getCurrentChartUserId() || '')
            ? initialNavState.partnerUserId
            : null,
    });
    configureChartHeaderNavigation();

    chartData = applyChartState(chartData, { houseSystem: currentSettings.houseSystem });

    // Обновляем заголовок
    updateHeader(chartData);
    // Инициализируем круговую карту
    const svgElement = document.getElementById('chartWheel');
    chartWheel = new ChartWheel(svgElement);
    chartWheel.setOrientationMode(currentSettings.orientation, { redraw: false });
    chartWheel.setPointScales({
        planets: currentSettings.planetScale,
        points: currentSettings.pointScale
    }, { redraw: false });
    chartWheel.setPlanetAnnotationOptions({
        showStationary: currentSettings.showWheelStationary,
        showDegree: currentSettings.showWheelDegree,
        showAspectText: currentSettings.showAspectText,
    }, { redraw: false });
    chartWheel.setHouseLabelOptions({
        style: currentSettings.houseNumberStyle,
        outside: currentSettings.houseLabelsOutside,
    }, { redraw: false });
    chartWheel.setAngleMarkerOptions?.({
        ascDscBold: currentSettings.angleAscDscBold,
        mcIcBold: currentSettings.angleMcIcBold,
    }, { redraw: false });
    chartWheel.applyMatrixRows?.(getCurrentNatalMatrixRows());

    // Применяем фильтры ДО первого draw, чтобы избежать мигания аспектов
    const prefiltered = window.AstroPreferences?.filterChartDataByViewPreferences
        ? window.AstroPreferences.filterChartDataByViewPreferences(chartData, {
            matrixRows: getCurrentNatalMatrixRows(),
            aspectScope: currentSettings.aspectScope || 'all',
            enabledAspectTypes: Array.isArray(currentSettings.enabledAspectTypes) && currentSettings.enabledAspectTypes.length
                ? currentSettings.enabledAspectTypes
                : NATAL_ASPECT_TYPES,
        })
        : chartData;
    const initialFiltered = filterChartDataByAspectPhase(prefiltered);
    chartWheel.draw(initialFiltered);

    // Сохраняем в глобальную область для фильтров
    window.chartWheel = chartWheel;
    initBodyActionMenuInteractions();

    // Инициализируем таблицы данных
    chartDataRenderer = new ChartDataRenderer();
    chartDataRenderer.setDisplayPreferences({
        showSpeed: currentSettings.showSpeed,
        showStationary: currentSettings.showStationary,
        showApplyingSeparating: currentSettings.showApplyingSeparating,
        showAspectText: currentSettings.showAspectText,
    });
    chartDataRenderer.render(filterChartDataForNatalTables(chartData));
    renderNatalRulersTab(chartData);
    chartDataRenderer.setAspectTypeFilter(currentSettings.aspectScope);

    initPlanetRowClick();

    document.addEventListener('chart:aspect-planet-filter', (event) => {
        const planetName = event?.detail?.planetName || null;
        if (chartDataRenderer) {
            chartDataRenderer.setAspectPlanetFilter(planetName);
        }
    });

    document.addEventListener('chart:aspect-hover', (event) => {
        const aspectKey = event?.detail?.aspectKey || null;
        currentHoveredAspectKey = aspectKey;
        syncHoveredAspectToActiveSurface();
    });

    document.addEventListener('chart:aspect-leave', () => {
        currentHoveredAspectKey = null;
        if (chartDataRenderer?.clearHoveredAspect) {
            chartDataRenderer.clearHoveredAspect();
        }
    });

    // Инициализируем вкладки и настройки
    initTabs();
    initSettings(chartData);
    initPanelTabs();
    initChartActions();
    bindConfigurationHoverInteractions();
    initEditClientDialog();
    initSynastryDialogs();
    handleChartOpenQueryAction();
    await hydrateNatalPreferences(chartData, formData);

    document.addEventListener('frontend:locale-changed', () => {
        if (!window.chartDataCache) return;
        updateHeader(window.chartDataCache);
        refreshEditDialogLocale();
        refreshSynastryLauncherLocale();
        chartRelatedPeoplePicker?.refreshLocale?.();
        renderNatalSettingsEditors();
        if (chartDataRenderer && typeof chartDataRenderer.render === 'function') {
            const hidden = currentSettings.hiddenPlanets || [];
            redrawChart(window.chartDataCache, hidden, currentSettings.orientation);
        }
    });

    window.addEventListener('resize', () => {
        syncHoveredAspectToActiveSurface();
    });
});

/**
 * Обновление ссылок на интерпретации с user_id
 */
/**
 * Click on planet table row → highlight planet on wheel + show tooltip near it
 */
function initPlanetRowClick() {
    const planetsTable = document.getElementById('planetsTable');
    if (!planetsTable) return;

    let activePlanetName = null;
    const dispatchAspectPlanetFilter = (planetName) => {
        document.dispatchEvent(new CustomEvent('chart:aspect-planet-filter', {
            detail: { planetName: planetName || null }
        }));
    };

    const clearActivePlanetSelection = () => {
        if (!activePlanetName) return;

        const wheel = window.chartWheel;
        if (wheel) {
            const prevGroup = wheel.svg.querySelector(`[data-planet="${activePlanetName}"]`);
            if (prevGroup) {
                wheel.onPlanetHover({ currentTarget: prevGroup }, false);
            }
            wheel.hideTooltip();
        }

        document.getElementById(`row-${activePlanetName}`)?.classList.remove('active-row');
        activePlanetName = null;
        dispatchAspectPlanetFilter(null);
    };

    planetsTable.addEventListener('click', (e) => {
        const row = e.target.closest('tr[data-planet]');
        if (!row) return;
        e.stopPropagation();

        const planetName = row.dataset.planet;
        const wheel = window.chartWheel;
        if (!wheel) return;

        // Toggle off if clicking same row
        if (activePlanetName === planetName) {
            clearActivePlanetSelection();
            return;
        }

        clearActivePlanetSelection();
        activePlanetName = planetName;
        row.classList.add('active-row');

        const group = wheel.svg.querySelector(`[data-planet="${planetName}"]`);
        if (!group) return;

        // Highlight planet + related aspects on the wheel
        wheel.onPlanetHover({ currentTarget: group }, true);

        // Show tooltip positioned near the planet symbol on the wheel
        const groupRect = group.getBoundingClientRect();
        const fakeEvent = {
            currentTarget: group,
            clientX: groupRect.left + groupRect.width / 2,
            clientY: groupRect.top + groupRect.height / 2,
        };
        wheel.onPlanetClick(fakeEvent);
        dispatchAspectPlanetFilter(planetName);
    });

    // Clicking the chart canvas deselects
    document.getElementById('view-chart')?.addEventListener('click', (e) => {
        if (!activePlanetName) return;
        if (e.target.closest('.planet-group')) return; // let wheel handle its own clicks
        clearActivePlanetSelection();
    });

    document.addEventListener('click', (e) => {
        if (!activePlanetName) return;
        if (e.target.closest('tr[data-planet]') || e.target.closest('.planet-group')) return;
        clearActivePlanetSelection();
    });
}

/**
 * Обновление заголовка с данными рождения
 */
function updateHeader(chartData) {
    const birthData = chartData.birth_data;
    const formData = AstroAPI.getFormData();
    
    const date = new Date(birthData.date);
    const dateStr = Number.isNaN(date.getTime())
        ? birthData.date
        : (window.LocaleFormatters?.formatDate ? window.LocaleFormatters.formatDate(date) : birthData.date);
    const timeStr = birthData.time.slice(0, 5);
    
    const firstName = birthData?.first_name || formData?.firstName || '';
    const lastName = birthData?.last_name || formData?.lastName || '';
    const clientName = [firstName, lastName].filter(Boolean).join(' ').trim();
    const placeStr = getBirthPlaceLabel(chartData, formData);

    const titleEl = document.getElementById('birthDate');
    const subtitleEl = document.getElementById('birthPlace');
    titleEl?.removeAttribute('data-i18n');
    if (clientName) {
        titleEl.textContent = clientName;
        subtitleEl.textContent = placeStr
            ? `${dateStr}, ${timeStr} · ${placeStr}`
            : `${dateStr}, ${timeStr}`;
    } else {
        titleEl.textContent = `${dateStr}, ${timeStr}`;
        subtitleEl.textContent = placeStr;
    }
}

function getBirthPlaceLabel(chartData, formData) {
    const candidates = [
        chartData?.birth_data?.place,
        formData?.place,
    ];

    for (const candidate of candidates) {
        const value = String(candidate || '').trim();
        if (value) {
            return value;
        }
    }

    return '';
}

function getTranslatedSignName(signName) {
    const key = `astro.sign.${signName}`;
    const translated = t(key);
    return translated === key ? (window.Symbols?.signNamesRu?.[signName] || signName || '') : translated;
}

function getCurrentChartUserId() {
    return (
        window.chartDataRawCache?.user_id
        || window.chartDataCache?.user_id
        || localStorage.getItem('currentUserId')
        || null
    );
}

function applyChartState(rawChartData, options = {}) {
    if (!rawChartData) return rawChartData;

    const ensuredRawChartData = ensureChartUserId(rawChartData, options.userId || getCurrentChartUserId());
    const houseSystem = normalizeHouseSystemCode(
        options.houseSystem
        || currentSettings.houseSystem
        || AstroAPI.getFormData()?.houseSystem
        || 'P'
    );

    window.chartDataRawCache = ensuredRawChartData;
    const preparedChartData = window.NatalWheelData?.prepareNatalWheelData
        ? window.NatalWheelData.prepareNatalWheelData(ensuredRawChartData, { houseSystem })
        : ensuredRawChartData;
    window.chartDataCache = window.AstroAspectPhase?.enrichChartDataWithAspectPhases
        ? window.AstroAspectPhase.enrichChartDataWithAspectPhases(preparedChartData)
        : preparedChartData;

    AstroAPI.saveChartToSession(ensuredRawChartData);
    AstroAPI.saveFormData(AstroAPI.chartToFormData(ensuredRawChartData, { houseSystem }));

    return window.chartDataCache;
}

function ensureChartUserId(chartData, fallbackUserId) {
    if (!chartData) return chartData;
    const userId = chartData.user_id || fallbackUserId || null;
    return userId
        ? { ...chartData, user_id: userId }
        : chartData;
}

function getNatalPreferenceHelpers() {
    return window.AstroPreferences || {};
}

function getNatalResolvedViewSettings() {
    const helpers = getNatalPreferenceHelpers();
    const base = helpers.normalizeViewSettings
        ? helpers.normalizeViewSettings(currentResolvedPreferences?.resolved || {})
        : {
            matrix: { rows: currentSettings.matrixRows || {} },
            aspects: {
                scope: currentSettings.aspectScope || 'all',
                enabled_types: [...(currentSettings.enabledAspectTypes || NATAL_ASPECT_TYPES)],
                show_applying_separating: currentSettings.showApplyingSeparating === true,
            },
            table_options: {
                show_speed: currentSettings.showSpeed !== false,
                show_stationary: currentSettings.showStationary !== false,
                show_aspect_text: currentSettings.showAspectText === true,
            },
            view_options: {
                orientation: currentSettings.orientation || 'aries',
                show_planet_stationary: currentSettings.showWheelStationary === true,
                show_planet_degree: currentSettings.showWheelDegree === true,
                bold_asc_dsc: currentSettings.angleAscDscBold !== false,
                bold_mc_ic: currentSettings.angleMcIcBold !== false,
            },
        };
    return {
        ...base,
        matrix: {
            ...(base.matrix || {}),
            rows: helpers.ensureMatrixRows
                ? helpers.ensureMatrixRows(currentSettings.matrixRows || base.matrix?.rows || {})
                : (currentSettings.matrixRows || base.matrix?.rows || {}),
        },
        aspects: {
            ...(base.aspects || {}),
            scope: currentSettings.aspectScope || base.aspects?.scope || 'all',
            enabled_types: Array.isArray(currentSettings.enabledAspectTypes) && currentSettings.enabledAspectTypes.length
                ? [...currentSettings.enabledAspectTypes]
                : [...(base.aspects?.enabled_types || NATAL_ASPECT_TYPES)],
            show_applying_separating: currentSettings.showApplyingSeparating === true,
        },
        table_options: {
            ...(base.table_options || {}),
            show_speed: currentSettings.showSpeed !== false,
            show_stationary: currentSettings.showStationary !== false,
            show_aspect_text: currentSettings.showAspectText === true,
        },
        view_options: {
            ...(base.view_options || {}),
            orientation: currentSettings.orientation === 'asc' ? 'asc' : 'aries',
            show_planet_stationary: currentSettings.showWheelStationary === true,
            show_planet_degree: currentSettings.showWheelDegree === true,
            bold_asc_dsc: currentSettings.angleAscDscBold !== false,
            bold_mc_ic: currentSettings.angleMcIcBold !== false,
        },
    };
}

function getCurrentNatalMatrixRows() {
    const helpers = getNatalPreferenceHelpers();
    return helpers.ensureMatrixRows
        ? helpers.ensureMatrixRows(currentSettings.matrixRows || {})
        : (currentSettings.matrixRows || {});
}

function getNatalMatrixBodyKey(name) {
    return window.AstroPreferences?.normalizeMatrixBodyName
        ? window.AstroPreferences.normalizeMatrixBodyName(name)
        : String(name || '');
}

function syncNatalMatrixCheckboxes() {
    const rows = getCurrentNatalMatrixRows();
    document.querySelectorAll('#natalMatrixEditor input[data-matrix-body][data-matrix-field]').forEach((input) => {
        const body = getNatalMatrixBodyKey(input.dataset.matrixBody);
        const field = input.dataset.matrixField;
        if (!body || !['display', 'aspecting'].includes(field)) return;
        input.checked = rows?.[body]?.[field] !== false;
    });
}

function ensureNatalBodyActionMenu() {
    let menu = document.body.querySelector('.forecast-new-body-action-menu[data-menu-scope="natal"]');
    if (menu) return menu;

    menu = document.createElement('div');
    menu.className = 'forecast-new-body-action-menu hidden';
    menu.dataset.menuScope = 'natal';
    menu.setAttribute('role', 'menu');
    document.body.appendChild(menu);

    menu.addEventListener('click', (event) => event.stopPropagation());
    menu.addEventListener('contextmenu', (event) => event.preventDefault());
    menu.addEventListener('click', (event) => {
        const button = event.target instanceof Element
            ? event.target.closest('button[data-action-field]')
            : null;
        if (!(button instanceof HTMLButtonElement)) return;
        const body = getNatalMatrixBodyKey(menu.dataset.body);
        const field = button.dataset.actionField;
        if (!body || !['display', 'aspecting'].includes(field)) return;
        const current = getCurrentNatalMatrixRows()?.[body]?.[field] !== false;
        setNatalMatrixField(body, field, !current);
        renderNatalBodyActionMenu(body, menu);
    });

    return menu;
}

function initBodyActionMenuInteractions() {
    if (bodyActionMenuBound) return;
    bodyActionMenuBound = true;

    document.addEventListener('chart:body-contextmenu', (event) => {
        const detail = event?.detail || {};
        if (detail.source !== 'wheel' || !detail.body || detail.method !== 'natal') return;
        openNatalBodyActionMenu(detail);
    });
    document.addEventListener('click', closeNatalBodyActionMenu);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeNatalBodyActionMenu();
    });
}

function openNatalBodyActionMenu(detail = {}) {
    const body = getNatalMatrixBodyKey(detail.body);
    if (!body) return;
    const menu = ensureNatalBodyActionMenu();
    renderNatalBodyActionMenu(body, menu);
    positionNatalBodyActionMenu(menu, detail.clientX, detail.clientY);
    menu.classList.remove('hidden');
}

function renderNatalBodyActionMenu(body, menu = ensureNatalBodyActionMenu()) {
    const rows = getCurrentNatalMatrixRows();
    const config = rows?.[body] || { display: true, aspecting: true };
    const label = escapeAttribute(getPlanetNameLabel(body));
    menu.dataset.body = body;
    menu.innerHTML = `
        <div class="forecast-new-body-action-menu-title">${label}</div>
        <div class="forecast-new-body-action-menu-controls">
            ${natalBodyActionToggleMarkup('display', 'п', 'Показ', config.display !== false)}
            ${natalBodyActionToggleMarkup('aspecting', 'а', 'Аспектация', config.aspecting !== false)}
        </div>
    `;
}

function natalBodyActionToggleMarkup(field, glyph, label, checked) {
    const escapedLabel = escapeAttribute(label);
    return `
        <button type="button" class="settings-check-option settings-check-option--pill settings-check-option--icon-only forecast-new-body-action-toggle" data-action-field="${field}" aria-label="${escapedLabel}" aria-pressed="${checked ? 'true' : 'false'}" title="${escapedLabel}">
            <span class="settings-check-option-glyph" aria-hidden="true">${glyph}</span>
        </button>
    `;
}

function positionNatalBodyActionMenu(menu, clientX, clientY) {
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

function closeNatalBodyActionMenu() {
    document.querySelector('.forecast-new-body-action-menu[data-menu-scope="natal"]')?.classList.add('hidden');
}

function setNatalMatrixField(body, field, checked) {
    const helpers = getNatalPreferenceHelpers();
    const rows = getCurrentNatalMatrixRows();
    rows[body] = {
        ...(rows[body] || { display: true, aspecting: true }),
        [field]: checked,
    };
    currentSettings.matrixRows = helpers.ensureMatrixRows
        ? helpers.ensureMatrixRows(rows)
        : rows;
    currentSettings.hiddenPlanets = Object.entries(rows)
        .filter(([, config]) => config?.display === false)
        .map(([bodyName]) => bodyName);
    syncNatalMatrixCheckboxes();
    redrawChart(window.chartDataCache, currentSettings.hiddenPlanets || [], currentSettings.orientation);
    void persistNatalViewOverrides();
}

function getNatalMatrixRowsForTables() {
    return Object.fromEntries(Object.entries(getCurrentNatalMatrixRows()).map(([body, config]) => [
        body,
        {
            ...config,
            display: true,
        },
    ]));
}

function filterChartDataForNatalTables(chartData) {
    const filteredByView = window.AstroPreferences?.filterChartDataByViewPreferences
        ? window.AstroPreferences.filterChartDataByViewPreferences(chartData, {
            matrixRows: getNatalMatrixRowsForTables(),
            aspectScope: currentSettings.aspectScope || 'all',
            enabledAspectTypes: Array.isArray(currentSettings.enabledAspectTypes) && currentSettings.enabledAspectTypes.length
                ? currentSettings.enabledAspectTypes
                : NATAL_ASPECT_TYPES,
        })
        : chartData;
    return filterChartDataByAspectPhase(filteredByView);
}

function renderNatalSettingsEditors() {
    renderNatalMatrixEditor();
    renderNatalAspectTypeToggles();
    bindNatalSettingsHandlers();
}

function syncNatalSettingsControls() {
    const orientationSelect = document.getElementById('orientationSelect');
    if (orientationSelect) orientationSelect.value = currentSettings.orientation === 'asc' ? 'asc' : 'aries';

    const houseSystemSelect = document.getElementById('houseSystemSelect');
    if (houseSystemSelect) houseSystemSelect.value = normalizeHouseSystemCode(currentSettings.houseSystem);

    const aspectScopeSelect = document.getElementById('aspectScopeSelect');
    if (aspectScopeSelect) aspectScopeSelect.value = currentSettings.aspectScope;

    const phaseFilter = normalizeAspectPhaseFilter(currentSettings.aspectPhaseFilter);
    const aspectPhaseApplyingToggle = document.getElementById('aspectPhaseApplyingToggle');
    if (aspectPhaseApplyingToggle) {
        aspectPhaseApplyingToggle.checked = phaseFilter.includes('applying');
    }
    const aspectPhaseSeparatingToggle = document.getElementById('aspectPhaseSeparatingToggle');
    if (aspectPhaseSeparatingToggle) {
        aspectPhaseSeparatingToggle.checked = phaseFilter.includes('separating');
    }

    const showSpeedToggle = document.getElementById('showSpeedToggle');
    if (showSpeedToggle) {
        showSpeedToggle.checked = currentSettings.showSpeed !== false;
    }

    const showStationaryToggle = document.getElementById('showStationaryToggle');
    if (showStationaryToggle) {
        showStationaryToggle.checked = currentSettings.showStationary !== false;
    }

    const showWheelStationaryToggle = document.getElementById('showWheelStationaryToggle');
    if (showWheelStationaryToggle) {
        showWheelStationaryToggle.checked = currentSettings.showWheelStationary === true;
    }

    const showWheelDegreeToggle = document.getElementById('showWheelDegreeToggle');
    if (showWheelDegreeToggle) {
        showWheelDegreeToggle.checked = currentSettings.showWheelDegree === true;
    }

    const houseNumberStyleSelect = document.getElementById('houseNumberStyleSelect');
    if (houseNumberStyleSelect) {
        houseNumberStyleSelect.value = currentSettings.houseNumberStyle === 'roman' ? 'roman' : 'arabic';
    }

    const houseLabelsOutsideToggle = document.getElementById('houseLabelsOutsideToggle');
    if (houseLabelsOutsideToggle) {
        houseLabelsOutsideToggle.checked = currentSettings.houseLabelsOutside === true;
    }

    const angleAscDscBoldToggle = document.getElementById('angleAscDscBoldToggle');
    if (angleAscDscBoldToggle) {
        angleAscDscBoldToggle.checked = currentSettings.angleAscDscBold !== false;
    }

    const angleMcIcBoldToggle = document.getElementById('angleMcIcBoldToggle');
    if (angleMcIcBoldToggle) {
        angleMcIcBoldToggle.checked = currentSettings.angleMcIcBold !== false;
    }

    renderNatalSettingsEditors();
}

function applyResolvedNatalPreferences(payload, { redraw = true } = {}) {
    if (!payload) return;

    const helpers = getNatalPreferenceHelpers();
    currentResolvedPreferences = payload;
    const resolved = helpers.normalizeViewSettings
        ? helpers.normalizeViewSettings(payload.resolved || {})
        : (payload.resolved || {});

    currentSettings.houseSystem = normalizeHouseSystemCode(payload.chart_meta?.house_system || currentSettings.houseSystem);
    currentSettings.orientation = resolved.view_options?.orientation === 'asc' ? 'asc' : 'aries';
    currentSettings.aspectScope = resolved.aspects?.scope || 'all';
    currentSettings.enabledAspectTypes = window.AstroPreferences?.healEnabledAspectTypesForScope
        ? window.AstroPreferences.healEnabledAspectTypesForScope(
            resolved.aspects?.enabled_types,
            currentSettings.aspectScope,
            NATAL_ASPECT_TYPES,
        )
        : (Array.isArray(resolved.aspects?.enabled_types) && resolved.aspects.enabled_types.length
            ? [...resolved.aspects.enabled_types]
            : [...NATAL_ASPECT_TYPES]);
    currentSettings.showApplyingSeparating = true;
    currentSettings.matrixRows = helpers.ensureMatrixRows
        ? helpers.ensureMatrixRows(resolved.matrix?.rows || {})
        : (resolved.matrix?.rows || {});
    currentSettings.hiddenPlanets = helpers.getHiddenBodiesFromMatrix
        ? helpers.getHiddenBodiesFromMatrix(currentSettings.matrixRows)
        : [];
    currentSettings.showSpeed = resolved.table_options?.show_speed !== false;
    currentSettings.showStationary = resolved.table_options?.show_stationary !== false;
    currentSettings.showAspectText = resolved.table_options?.show_aspect_text === true;
    currentSettings.showWheelStationary = resolved.view_options?.show_planet_stationary === true;
    currentSettings.showWheelDegree = resolved.view_options?.show_planet_degree === true;
    currentSettings.angleAscDscBold = resolved.view_options?.bold_asc_dsc !== false;
    currentSettings.angleMcIcBold = resolved.view_options?.bold_mc_ic !== false;

    syncNatalSettingsControls();
    applyChartState(window.chartDataRawCache || window.chartDataCache, { houseSystem: currentSettings.houseSystem });
    chartWheel?.setPlanetAnnotationOptions?.({
        showStationary: currentSettings.showWheelStationary,
        showDegree: currentSettings.showWheelDegree,
        showAspectText: currentSettings.showAspectText,
    }, { redraw: false });
    chartWheel?.setAngleMarkerOptions?.({
        ascDscBold: currentSettings.angleAscDscBold,
        mcIcBold: currentSettings.angleMcIcBold,
    }, { redraw: false });
    chartDataRenderer?.setDisplayPreferences?.({
        showSpeed: currentSettings.showSpeed,
        showStationary: currentSettings.showStationary,
        showApplyingSeparating: currentSettings.showApplyingSeparating,
        showAspectText: currentSettings.showAspectText,
    });
    const accountVisual = window.accountPreferencesCache?.visual || null;
    if (accountVisual && window.AstroPreferences?.setAccountVisualPreferences) {
        window.AstroPreferences.setAccountVisualPreferences(accountVisual);
        chartWheel?.setVisualPreferences?.(accountVisual, { redraw: false });
        chartDataRenderer?.setVisualPreferences?.(accountVisual);
    }

    if (redraw && window.chartDataCache) {
        redrawChart(window.chartDataCache, currentSettings.hiddenPlanets || [], currentSettings.orientation);
    }
    applyNatalAspectScope(currentSettings.aspectScope, { persist: false });
}

function updateLocalResolvedNatalPreferences(nextResolvedView, overrides) {
    if (!currentResolvedPreferences) return;
    currentResolvedPreferences = {
        ...currentResolvedPreferences,
        overrides: overrides || {},
        resolved: nextResolvedView || currentResolvedPreferences.resolved,
    };
}

async function persistNatalViewOverrides() {
    const userId = getCurrentChartUserId();
    if (!userId || !currentResolvedPreferences || !window.AstroAPI?.saveChartViewOverride) return;

    const helpers = getNatalPreferenceHelpers();
    const accountDefaults = helpers.normalizeViewSettings
        ? helpers.normalizeViewSettings(currentResolvedPreferences.account_defaults || {})
        : (currentResolvedPreferences.account_defaults || {});
    const resolved = getNatalResolvedViewSettings();
    const diff = helpers.buildSparseDiff ? helpers.buildSparseDiff(accountDefaults, resolved) : resolved;

    if (!diff || (typeof diff === 'object' && Object.keys(diff).length === 0)) {
        await window.AstroAPI.deleteChartViewOverride({
            chart_kind: 'natal',
            chart_id: userId,
            view_type: 'natal',
        });
        updateLocalResolvedNatalPreferences(resolved, {});
        return;
    }

    await window.AstroAPI.saveChartViewOverride({
        chart_kind: 'natal',
        chart_id: userId,
        view_type: 'natal',
        overrides: diff,
    });
    updateLocalResolvedNatalPreferences(resolved, diff);
}

async function migrateNatalHouseSystemIfNeeded(formData) {
    const userId = getCurrentChartUserId();
    const legacyHouseSystem = normalizeHouseSystemCode(
        formData?.houseSystem || window.chartDataRawCache?.birth_data?.house_system || currentSettings.houseSystem
    );
    const resolvedHouseSystem = normalizeHouseSystemCode(currentResolvedPreferences?.chart_meta?.house_system || currentSettings.houseSystem);

    if (!userId || !window.AstroAPI?.updateUserHouseSystem) return null;
    if (!legacyHouseSystem || legacyHouseSystem === resolvedHouseSystem) return null;
    if (resolvedHouseSystem !== 'P') return null;

    const chartData = await window.AstroAPI.updateUserHouseSystem(userId, legacyHouseSystem);
    return applyChartState(ensureChartUserId(chartData, userId), { houseSystem: legacyHouseSystem });
}

async function hydrateNatalPreferences(chartData, formData) {
    const userId = chartData?.user_id || getCurrentChartUserId();
    if (!userId || !window.AstroAPI?.getResolvedPreferences) {
        return;
    }

    try {
        if (window.AstroAPI?.getAccountPreferences) {
            window.accountPreferencesCache = await window.AstroAPI.getAccountPreferences();
            if (window.AstroPreferences?.setAccountVisualPreferences) {
                window.AstroPreferences.setAccountVisualPreferences(window.accountPreferencesCache?.visual || {});
            }
            chartWheel?.setVisualPreferences?.(window.accountPreferencesCache?.visual || {}, { redraw: false });
            chartDataRenderer?.setVisualPreferences?.(window.accountPreferencesCache?.visual || {});
            updateHeader(chartData);
        }
        currentResolvedPreferences = await window.AstroAPI.getResolvedPreferences({
            chart_kind: 'natal',
            chart_id: userId,
            view_type: 'natal',
        });

        const migratedChartData = await migrateNatalHouseSystemIfNeeded(formData);
        if (migratedChartData) {
            currentResolvedPreferences = await window.AstroAPI.getResolvedPreferences({
                chart_kind: 'natal',
                chart_id: userId,
                view_type: 'natal',
            });
            chartData = migratedChartData;
            updateHeader(chartData);
        }

        const resolvedHouseSystem = normalizeHouseSystemCode(currentResolvedPreferences?.chart_meta?.house_system || currentSettings.houseSystem);
        const loadedHouseSystem = normalizeHouseSystemCode(chartData?.birth_data?.house_system || currentSettings.houseSystem);
        if (resolvedHouseSystem !== loadedHouseSystem && window.AstroAPI?.getNatalChart) {
            chartData = await window.AstroAPI.getNatalChart(userId);
            chartData = applyChartState(ensureChartUserId(chartData, userId), { houseSystem: resolvedHouseSystem });
            updateHeader(chartData);
        }

        applyResolvedNatalPreferences(currentResolvedPreferences, { redraw: true });
    } catch (error) {
        console.warn('Failed to hydrate natal preferences:', error);
    }
}

async function applyNatalAspectScope(filter, { persist = true } = {}) {
    const nextFilter = ['all', 'major', 'minor'].includes(filter) ? filter : 'all';
    currentSettings.aspectScope = nextFilter;

    if (window.chartWheel) {
        window.chartWheel.setAspectFilter(nextFilter);
    }
    if (chartDataRenderer) {
        chartDataRenderer.setAspectTypeFilter(nextFilter);
    }

    if (persist) {
        try {
            await persistNatalViewOverrides();
        } catch (error) {
            console.warn('Failed to persist natal aspect scope:', error);
        }
    }
}

async function saveNatalSettingsAsAccountDefaults() {
    const userId = getCurrentChartUserId();
    if (!userId || !window.AstroAPI?.patchAccountPreferences || !window.AstroAPI?.getResolvedPreferences) {
        throw new Error('Account defaults are unavailable');
    }

    await window.AstroAPI.patchAccountPreferences({
        chart_defaults: {
            natal: getNatalResolvedViewSettings(),
        },
        chart_creation_defaults: {
            house_system: normalizeHouseSystemCode(currentSettings.houseSystem),
        },
    });

    currentResolvedPreferences = await window.AstroAPI.getResolvedPreferences({
        chart_kind: 'natal',
        chart_id: userId,
        view_type: 'natal',
    });
    await persistNatalViewOverrides();
    currentResolvedPreferences = await window.AstroAPI.getResolvedPreferences({
        chart_kind: 'natal',
        chart_id: userId,
        view_type: 'natal',
    });
    applyResolvedNatalPreferences(currentResolvedPreferences, { redraw: true });
}

/**
 * Инициализация вкладок
 */
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

/**
 * Инициализация вкладок панелей (левая/правая)
 */
function initPanelTabs() {
    document.querySelectorAll('.panel-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const panelId = tab.dataset.panelTab;
            const parent = tab.closest('.side-panel');

            // Переключаем активную вкладку
            parent.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
            parent.querySelectorAll('.panel-tab-content').forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(panelId).classList.add('active');
            syncHoveredAspectToActiveSurface();
        });
    });
}

function isElementVisible(element) {
    if (!element) return false;
    if (element.offsetParent === null) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
}

function getActiveAspectSurface() {
    const leftPanel = document.getElementById('view-planets');
    if (!leftPanel || !isElementVisible(leftPanel)) return null;

    const aspectsPane = document.getElementById('aspects-list');
    const gridPane = document.getElementById('grid-list');

    if (aspectsPane?.classList.contains('active')) return 'table';
    if (gridPane?.classList.contains('active')) return 'grid';
    return null;
}

function syncHoveredAspectToActiveSurface() {
    if (!chartDataRenderer || typeof chartDataRenderer.setHoveredAspect !== 'function') return;

    if (!currentHoveredAspectKey) {
        chartDataRenderer.clearHoveredAspect?.();
        return;
    }

    const surface = getActiveAspectSurface();
    if (!surface) {
        chartDataRenderer.clearHoveredAspect?.();
        return;
    }

    chartDataRenderer.setHoveredAspect(currentHoveredAspectKey, { surface });
}

/**
 * Инициализация панели настроек
 */
function initSettings(chartData) {
    const settingsToggle = document.getElementById('settingsToggle');
    const settingsPanel = document.getElementById('settingsPanel');
    const orientationSelect = document.getElementById('orientationSelect');
    const aspectScopeSelect = document.getElementById('aspectScopeSelect');
    const iconScaleRange = document.getElementById('iconScaleRange');
    const iconScaleValue = document.getElementById('iconScaleValue');

    renderNatalSettingsEditors();

    // Переключение панели
    if (settingsToggle && settingsPanel) {
        settingsToggle.addEventListener('click', () => {
            settingsPanel.classList.toggle('hidden');
        });

        // Закрытие при клике вне панели
        document.addEventListener('click', (e) => {
            if (!settingsPanel.contains(e.target) && e.target !== settingsToggle) {
                settingsPanel.classList.add('hidden');
            }
        });
    }

    // Prevent chart drag when interacting with settings controls
    if (settingsPanel) {
        ['mousedown', 'touchstart', 'wheel'].forEach(evt => {
            settingsPanel.addEventListener(evt, e => e.stopPropagation(), { passive: false });
        });
    }

    if (orientationSelect) {
        orientationSelect.value = currentSettings.orientation;
        orientationSelect.addEventListener('change', () => applySettings());
    }
    if (aspectScopeSelect) {
        aspectScopeSelect.value = currentSettings.aspectScope;
        aspectScopeSelect.addEventListener('change', () => applySettings());
    }
    const houseSystemSelect = document.getElementById('houseSystemSelect');
    if (houseSystemSelect) {
        houseSystemSelect.value = normalizeHouseSystemCode(currentSettings.houseSystem);
        houseSystemSelect.addEventListener('change', () => applySettings());
    }
    if (iconScaleRange) {
        iconScaleRange.value = String(Math.round(currentSettings.planetScale * 100));
        if (iconScaleValue) iconScaleValue.textContent = `${Math.round(currentSettings.planetScale * 100)}%`;
        iconScaleRange.addEventListener('input', () => {
            if (iconScaleValue) iconScaleValue.textContent = `${iconScaleRange.value}%`;
            applySettings();
        });
    }
}

function renderNatalMatrixEditor() {
    const matrixEditor = document.getElementById('natalMatrixEditor');
    if (!matrixEditor) return;

    const rows = getCurrentNatalMatrixRows();
    const bodies = window.AstroPreferences?.MATRIX_BODIES || CHART_TOGGLEABLE_POINTS;
    matrixEditor.innerHTML = `
        <table class="natal-matrix-table">
            <thead>
                <tr>
                    <th>Body</th>
                    <th>Display</th>
                    <th>Aspecting</th>
                </tr>
            </thead>
            <tbody>
                ${bodies.map((body) => {
                    const label = getPlanetNameLabel(body);
                    const symbolMarkup = getPlanetSymbolMarkup(body, { size: 18, title: label });
                    const displayChecked = rows?.[body]?.display !== false ? 'checked' : '';
                    const aspectingChecked = rows?.[body]?.aspecting !== false ? 'checked' : '';
                    const escapedLabel = escapeAttribute(label);
                    return `
                        <tr>
                            <td>
                                <span class="natal-matrix-body natal-matrix-body--icon-only" title="${escapedLabel}" aria-label="${escapedLabel}" role="img">
                                    ${symbolMarkup}
                                </span>
                            </td>
                            <td>
                                <label class="natal-matrix-check">
                                    <input type="checkbox" data-matrix-body="${body}" data-matrix-field="display" ${displayChecked}>
                                </label>
                            </td>
                            <td>
                                <label class="natal-matrix-check">
                                    <input type="checkbox" data-matrix-body="${body}" data-matrix-field="aspecting" ${aspectingChecked}>
                                </label>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function renderNatalAspectTypeToggles() {
    const toggles = document.getElementById('aspectTypeToggles');
    if (!toggles) return;

    const enabledTypes = new Set(
        Array.isArray(currentSettings.enabledAspectTypes) && currentSettings.enabledAspectTypes.length
            ? currentSettings.enabledAspectTypes
            : NATAL_ASPECT_TYPES
    );

    toggles.innerHTML = NATAL_ASPECT_TYPES.map((aspectType) => {
        const label = t(`astro.aspect.${aspectType}`);
        const symbol = Symbols?.getAspectDisplay?.(aspectType) || Symbols?.aspects?.[aspectType] || '';
        const checked = enabledTypes.has(aspectType) ? 'checked' : '';
        const escapedLabel = escapeAttribute(label);
        return `
            <label class="settings-check-option settings-check-option--pill settings-check-option--icon-only" title="${escapedLabel}">
                <input type="checkbox" data-aspect-type="${aspectType}" ${checked} aria-label="${escapedLabel}">
                <span class="settings-check-option-glyph" aria-hidden="true"><span class="astro-symbol">${symbol}</span></span>
            </label>
        `;
    }).join('');
}

function bindNatalSettingsHandlers() {
    document.querySelectorAll('#natalMatrixEditor input').forEach((cb) => {
        cb.onchange = (event) => {
            const input = event.currentTarget;
            const body = input?.dataset?.matrixBody;
            const field = input?.dataset?.matrixField;
            if (!body || !['display', 'aspecting'].includes(field)) return;
            setNatalMatrixField(body, field, input.checked);
        };
    });
    document.querySelectorAll('#aspectTypeToggles input').forEach((cb) => {
        cb.onchange = () => applySettings();
    });
    const aspectPhaseApplyingToggle = document.getElementById('aspectPhaseApplyingToggle');
    if (aspectPhaseApplyingToggle) {
        aspectPhaseApplyingToggle.onchange = () => applySettings();
    }
    const aspectPhaseSeparatingToggle = document.getElementById('aspectPhaseSeparatingToggle');
    if (aspectPhaseSeparatingToggle) {
        aspectPhaseSeparatingToggle.onchange = () => applySettings();
    }
    const showSpeedToggle = document.getElementById('showSpeedToggle');
    if (showSpeedToggle) {
        showSpeedToggle.onchange = () => applySettings();
    }
    const showStationaryToggle = document.getElementById('showStationaryToggle');
    if (showStationaryToggle) {
        showStationaryToggle.onchange = () => applySettings();
    }
    const showWheelStationaryToggle = document.getElementById('showWheelStationaryToggle');
    if (showWheelStationaryToggle) {
        showWheelStationaryToggle.onchange = () => applySettings();
    }
    const showWheelDegreeToggle = document.getElementById('showWheelDegreeToggle');
    if (showWheelDegreeToggle) {
        showWheelDegreeToggle.onchange = () => applySettings();
    }
    const houseNumberStyleSelect = document.getElementById('houseNumberStyleSelect');
    if (houseNumberStyleSelect) {
        houseNumberStyleSelect.onchange = () => applySettings();
    }
    const houseLabelsOutsideToggle = document.getElementById('houseLabelsOutsideToggle');
    if (houseLabelsOutsideToggle) {
        houseLabelsOutsideToggle.onchange = () => applySettings();
    }
    const angleAscDscBoldToggle = document.getElementById('angleAscDscBoldToggle');
    if (angleAscDscBoldToggle) {
        angleAscDscBoldToggle.onchange = () => applySettings();
    }
    const angleMcIcBoldToggle = document.getElementById('angleMcIcBoldToggle');
    if (angleMcIcBoldToggle) {
        angleMcIcBoldToggle.onchange = () => applySettings();
    }
}

function readNatalMatrixRowsFromControls() {
    const helpers = getNatalPreferenceHelpers();
    const rows = getCurrentNatalMatrixRows();
    document.querySelectorAll('#natalMatrixEditor input[data-matrix-body][data-matrix-field]').forEach((input) => {
        const body = input.dataset.matrixBody;
        const field = input.dataset.matrixField;
        if (!body || !field) return;
        rows[body] = {
            ...(rows[body] || { display: true, aspecting: true }),
            [field]: input.checked,
        };
    });
    return helpers.ensureMatrixRows
        ? helpers.ensureMatrixRows(rows)
        : rows;
}

function readNatalEnabledAspectTypesFromControls() {
    const enabled = [];
    document.querySelectorAll('#aspectTypeToggles input[data-aspect-type]').forEach((input) => {
        if (input.checked && input.dataset.aspectType) {
            enabled.push(input.dataset.aspectType);
        }
    });
    return enabled.length ? enabled : [...NATAL_ASPECT_TYPES];
}

/**
 * Применение настроек и перерисовка карты
 */
let applySettingsTimer = null;
let bodyActionMenuBound = false;
async function applySettings() {
    if (applySettingsTimer) {
        clearTimeout(applySettingsTimer);
    }
    applySettingsTimer = setTimeout(async () => {
        const houseSystem = normalizeHouseSystemCode(document.getElementById('houseSystemSelect').value);
        const orientation = document.getElementById('orientationSelect')?.value || 'aries';
        const aspectScope = document.getElementById('aspectScopeSelect')?.value || 'all';
        const iconScalePct = Number(document.getElementById('iconScaleRange')?.value || 120);
        const iconScale = clampPointScale(iconScalePct / 100);
        const matrixRows = readNatalMatrixRowsFromControls();
        const hiddenPlanets = Object.entries(matrixRows)
            .filter(([, config]) => config?.display === false)
            .map(([body]) => body);
        const enabledAspectTypes = readNatalEnabledAspectTypesFromControls();
        const showApplyingSeparating = true;
        const aspectPhaseFilter = normalizeAspectPhaseFilter([
            document.getElementById('aspectPhaseApplyingToggle')?.checked === true ? 'applying' : null,
            document.getElementById('aspectPhaseSeparatingToggle')?.checked === true ? 'separating' : null,
        ]);
        const showSpeed = document.getElementById('showSpeedToggle')?.checked !== false;
        const showStationary = document.getElementById('showStationaryToggle')?.checked !== false;
        const showWheelStationary = document.getElementById('showWheelStationaryToggle')?.checked === true;
        const showWheelDegree = document.getElementById('showWheelDegreeToggle')?.checked === true;
        const houseNumberStyle = document.getElementById('houseNumberStyleSelect')?.value === 'roman' ? 'roman' : 'arabic';
        const houseLabelsOutside = document.getElementById('houseLabelsOutsideToggle')?.checked === true;
        const angleAscDscBold = document.getElementById('angleAscDscBoldToggle')?.checked !== false;
        const angleMcIcBold = document.getElementById('angleMcIcBoldToggle')?.checked !== false;

        currentSettings.orientation = orientation === 'asc' ? 'asc' : 'aries';
        currentSettings.aspectScope = ['all', 'major', 'minor'].includes(aspectScope) ? aspectScope : 'all';
        currentSettings.planetScale = iconScale;
        currentSettings.pointScale = iconScale;
        currentSettings.matrixRows = matrixRows;
        currentSettings.hiddenPlanets = hiddenPlanets;
        currentSettings.enabledAspectTypes = window.AstroPreferences?.healEnabledAspectTypesForScope
            ? window.AstroPreferences.healEnabledAspectTypesForScope(
                enabledAspectTypes,
                currentSettings.aspectScope,
                NATAL_ASPECT_TYPES,
            )
            : enabledAspectTypes;
        currentSettings.showApplyingSeparating = showApplyingSeparating;
        currentSettings.aspectPhaseFilter = aspectPhaseFilter;
        currentSettings.showSpeed = showSpeed;
        currentSettings.showStationary = showStationary;
        currentSettings.showWheelStationary = showWheelStationary;
        currentSettings.showWheelDegree = showWheelDegree;
        currentSettings.houseNumberStyle = houseNumberStyle;
        currentSettings.houseLabelsOutside = houseLabelsOutside;
        currentSettings.angleAscDscBold = angleAscDscBold;
        currentSettings.angleMcIcBold = angleMcIcBold;
        localStorage.setItem('natalPlanetScale', String(iconScale));
        localStorage.setItem('natalPointScale', String(iconScale));
        localStorage.setItem(ASPECT_PHASE_STORAGE_KEY, serializeAspectPhaseFilter(aspectPhaseFilter));
        localStorage.setItem(HOUSE_NUMBER_STYLE_STORAGE_KEY, houseNumberStyle);
        localStorage.setItem(HOUSE_LABELS_OUTSIDE_STORAGE_KEY, houseLabelsOutside ? 'true' : 'false');
        localStorage.setItem(ANGLE_ASC_DSC_BOLD_STORAGE_KEY, angleAscDscBold ? 'true' : 'false');
        localStorage.setItem(ANGLE_MC_IC_BOLD_STORAGE_KEY, angleMcIcBold ? 'true' : 'false');
        chartWheel?.setHouseLabelOptions?.({
            style: houseNumberStyle,
            outside: houseLabelsOutside,
        }, { redraw: false });
        chartWheel?.setAngleMarkerOptions?.({
            ascDscBold: angleAscDscBold,
            mcIcBold: angleMcIcBold,
        }, { redraw: false });
        chartWheel?.setPlanetAnnotationOptions?.({
            showStationary: showWheelStationary,
            showDegree: showWheelDegree,
            showAspectText: currentSettings.showAspectText,
        }, { redraw: false });
        await applyNatalAspectScope(currentSettings.aspectScope, { persist: false });
        chartDataRenderer?.setDisplayPreferences?.({
            showSpeed,
            showStationary,
            showApplyingSeparating,
            showAspectText: currentSettings.showAspectText,
        });
        chartDataRenderer?.setHouseNumberStyle?.(houseNumberStyle);

        try {
            const userId = getCurrentChartUserId();
            const currentChartHouseSystem = normalizeHouseSystemCode(currentSettings.houseSystem);
            if (userId && houseSystem !== currentChartHouseSystem && window.AstroAPI?.updateUserHouseSystem) {
                const updatedChartData = await window.AstroAPI.updateUserHouseSystem(userId, houseSystem);
                const preparedChartData = applyChartState(
                    ensureChartUserId(updatedChartData, userId),
                    { houseSystem }
                );
                currentSettings.houseSystem = houseSystem;
                if (currentResolvedPreferences?.chart_meta) {
                    currentResolvedPreferences.chart_meta.house_system = houseSystem;
                }
                updateHeader(preparedChartData);
            } else {
                currentSettings.houseSystem = houseSystem;
            }

            await persistNatalViewOverrides();
            redrawChart(window.chartDataCache, currentSettings.hiddenPlanets || [], currentSettings.orientation);
        } catch (err) {
            console.error('Failed to apply natal settings:', err);

            // Fallback preview for charts that are not yet persisted server-side.
            const formData = AstroAPI.getFormData();
            if (formData && houseSystem !== normalizeHouseSystemCode(formData?.houseSystem || 'P')) {
                try {
                    const requestData = buildChartRequestFromFormData(formData, houseSystem);
                    if (!requestData) {
                        redrawChart(window.chartDataCache, hiddenPlanets, orientation);
                        applySettingsTimer = null;
                        return;
                    }
                    const requestKey = JSON.stringify(requestData);
                    if (!inFlightRecalcPromise || inFlightRecalcKey !== requestKey) {
                        inFlightRecalcKey = requestKey;
                        inFlightRecalcPromise = AstroAPI.calculateNatalChart(requestData, { saveToDb: false });
                    }
                    let newChartData = await inFlightRecalcPromise;

                    if (newChartData) {
                        newChartData = applyChartState(
                            ensureChartUserId(newChartData, getCurrentChartUserId()),
                            { houseSystem }
                        );
                        currentSettings.houseSystem = houseSystem;
                        updateHeader(newChartData);
                        redrawChart(newChartData, hiddenPlanets, orientation);
                    }
                } catch (previewErr) {
                    console.error('Failed to preview natal recalculation:', previewErr);
                } finally {
                    inFlightRecalcPromise = null;
                    inFlightRecalcKey = null;
                }
            } else {
                redrawChart(window.chartDataCache, hiddenPlanets, orientation);
            }
        } finally {
            applySettingsTimer = null;
        }
    }, 120);
}

function buildChartRequestFromFormData(formData, houseSystem) {
    if (!formData) return null;

    const hasApiShape = Boolean(formData.date && formData.time && formData.timezone);
    if (hasApiShape) {
        return {
            ...formData,
            house_system: houseSystem
        };
    }

    if (
        formData.day == null || formData.month == null || formData.year == null
        || formData.hour == null || formData.minute == null || !formData.timezone
    ) {
        return null;
    }

    const requestData = {
        first_name: formData.firstName || null,
        last_name: formData.lastName || null,
        date: AstroAPI.formatDate(formData.day, formData.month, formData.year),
        time: AstroAPI.formatTime(formData.hour, formData.minute),
        timezone: formData.timezone,
        house_system: houseSystem
    };

    if (typeof formData.place === 'string' && formData.place.trim()) {
        requestData.place = formData.place.trim();
    }

    const latitude = Number(formData.latitude);
    const longitude = Number(formData.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        requestData.latitude = latitude;
        requestData.longitude = longitude;
    }

    return requestData;
}

/**
 * Перерисовка карты с учётом скрытых планет
 */
function redrawChart(chartData, hiddenPlanets, orientation = currentSettings.orientation) {
    const filteredByView = window.AstroPreferences?.filterChartDataByViewPreferences
        ? window.AstroPreferences.filterChartDataByViewPreferences(chartData, {
            matrixRows: getCurrentNatalMatrixRows(),
            aspectScope: currentSettings.aspectScope || 'all',
            enabledAspectTypes: Array.isArray(currentSettings.enabledAspectTypes) && currentSettings.enabledAspectTypes.length
                ? currentSettings.enabledAspectTypes
                : NATAL_ASPECT_TYPES,
        })
        : chartData;
    const filteredData = filterChartDataByAspectPhase(filteredByView);

    // Перерисовываем
    if (chartWheel) {
        chartWheel.setOrientationMode(orientation, { redraw: false });
        chartWheel.setPointScales({
            planets: currentSettings.planetScale,
            points: currentSettings.pointScale
        }, { redraw: false });
        chartWheel.setPlanetAnnotationOptions({
            showStationary: currentSettings.showWheelStationary,
            showDegree: currentSettings.showWheelDegree,
            showAspectText: currentSettings.showAspectText,
        }, { redraw: false });
        chartWheel.setHouseLabelOptions({
            style: currentSettings.houseNumberStyle,
            outside: currentSettings.houseLabelsOutside,
        }, { redraw: false });
        chartWheel.setAngleMarkerOptions?.({
            ascDscBold: currentSettings.angleAscDscBold,
            mcIcBold: currentSettings.angleMcIcBold,
        }, { redraw: false });
        chartWheel.applyMatrixRows?.(getCurrentNatalMatrixRows());
    }
    chartDataRenderer?.setDisplayPreferences?.({
        showSpeed: currentSettings.showSpeed,
        showStationary: currentSettings.showStationary,
        showApplyingSeparating: currentSettings.showApplyingSeparating,
        showAspectText: currentSettings.showAspectText,
    });
    clearConfigurationHighlight();
    chartWheel.draw(filteredData);
    chartDataRenderer.render(filterChartDataForNatalTables(chartData));
    renderNatalRulersTab(chartData);
    syncHoveredAspectToActiveSurface();
}

function renderNatalRulersTab(data) {
    window.DispositorChains?.render?.('rulersContainer', data, {
        selectId: 'natalRulersModeSelect',
    });
}

function initChartActions() {
    const toggle = document.getElementById('chartActionsToggle');
    const menu = document.getElementById('chartActionsMenu');
    const editAction = document.getElementById('editClientAction');
    const openSynastryAction = document.getElementById('openSynastryAction');
    const saveDefaultsAction = document.getElementById('saveNatalDefaultsAction');
    const resetAction = document.getElementById('resetDefaultsAction');

    if (!toggle || !menu || !editAction) return;

    const hasPersistedUser = Boolean(getCurrentChartUserId());
    openSynastryAction?.classList.toggle('hidden', !hasPersistedUser);

    toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        const shouldOpen = menu.classList.contains('hidden');
        setChartActionsMenuOpen(shouldOpen);
    });

    editAction.addEventListener('click', () => {
        setChartActionsMenuOpen(false);
        openEditClientDialog();
    });

    openSynastryAction?.addEventListener('click', () => {
        setChartActionsMenuOpen(false);
        openSynastryLauncherDialog();
    });

    saveDefaultsAction?.addEventListener('click', async () => {
        setChartActionsMenuOpen(false);
        try {
            await saveNatalSettingsAsAccountDefaults();
            showChartToast(t('page.chart.toasts.defaultsSaved'), 'success');
        } catch (error) {
            showChartToast(error.message || t('page.chart.toasts.defaultsSaveFailed'), 'error');
        }
    });

    resetAction?.addEventListener('click', async () => {
        const userId = getCurrentChartUserId();
        if (!userId || !window.AstroAPI?.resetUserViewToDefaults) return;

        setChartActionsMenuOpen(false);
        try {
            const response = await window.AstroAPI.resetUserViewToDefaults(userId, 'natal');
            if (response?.chart_data) {
                const preparedChartData = applyChartState(
                    ensureChartUserId(response.chart_data, userId),
                    { houseSystem: response.chart_data?.birth_data?.house_system || currentSettings.houseSystem }
                );
                updateHeader(preparedChartData);
            }
            if (response?.resolved_preferences) {
                applyResolvedNatalPreferences(response.resolved_preferences, { redraw: true });
            } else {
                redrawChart(window.chartDataCache, currentSettings.hiddenPlanets || [], currentSettings.orientation);
            }
            showChartToast(t('page.chart.toasts.defaultsRestored'), 'success');
        } catch (error) {
            showChartToast(error.message || t('page.chart.toasts.defaultsResetFailed'), 'error');
        }
    });

    document.addEventListener('click', (event) => {
        if (!menu.contains(event.target) && !toggle.contains(event.target)) {
            setChartActionsMenuOpen(false);
        }
    });
}

function clearConfigurationHighlight() {
    if (activeConfigurationCard) {
        activeConfigurationCard.classList.remove('config-card--hovered');
        activeConfigurationCard = null;
    }

    hideConfigPointTooltip();

    document.querySelectorAll('.config-highlight-line').forEach((line) => {
        line.classList.remove('config-highlight-line');
    });
    document.querySelectorAll('.config-highlight-planet').forEach((group) => {
        group.classList.remove('config-highlight-planet');
    });
}

function highlightConfigurationCard(card) {
    if (!card || !chartWheel?.svg) return;
    if (activeConfigurationCard === card) return;

    clearConfigurationHighlight();
    activeConfigurationCard = card;
    activeConfigurationCard.classList.add('config-card--hovered');

    const aspectKeys = String(card.dataset.configAspectKeys || '')
        .split('|')
        .map((value) => value.trim())
        .filter(Boolean);
    const planetNames = String(card.dataset.configPlanets || '')
        .split('|')
        .map((value) => value.trim())
        .filter(Boolean);

    aspectKeys.forEach((aspectKey) => {
        const line = chartWheel.svg.querySelector(`.aspect-line[data-aspect-key="${escapeAttribute(aspectKey)}"]`);
        if (line) {
            line.classList.add('config-highlight-line');
        }
    });

    planetNames.forEach((planetName) => {
        const group = chartWheel.svg.querySelector(`.planet-group[data-planet="${escapeAttribute(planetName)}"]`);
        if (group) {
            group.classList.add('config-highlight-planet');
        }
    });
}

function ensureConfigPointTooltip() {
    if (configPointTooltipEl?.isConnected) {
        return configPointTooltipEl;
    }

    const host = document.querySelector('.chart-page') || document.body;
    configPointTooltipEl = document.createElement('div');
    configPointTooltipEl.className = 'chart-tooltip chart-tooltip--floating config-point-tooltip';
    host.appendChild(configPointTooltipEl);
    return configPointTooltipEl;
}

function showConfigPointTooltip(html, event) {
    if (!html || !event) return;
    const tooltip = ensureConfigPointTooltip();
    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    moveConfigPointTooltip(event);
}

function moveConfigPointTooltip(event) {
    if (!event) return;
    const tooltip = ensureConfigPointTooltip();
    if (!tooltip || tooltip.style.display === 'none') return;

    const margin = 14;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const tooltipWidth = tooltip.offsetWidth || 0;
    const tooltipHeight = tooltip.offsetHeight || 0;

    let left = event.clientX + margin;
    let top = event.clientY + 10;

    if (left + tooltipWidth > viewportWidth - 8) {
        left = Math.max(8, event.clientX - tooltipWidth - margin);
    }
    if (top + tooltipHeight > viewportHeight - 8) {
        top = Math.max(8, viewportHeight - tooltipHeight - 8);
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
}

function hideConfigPointTooltip() {
    if (configPointTooltipEl) {
        configPointTooltipEl.style.display = 'none';
    }
}

function bindConfigurationHoverInteractions() {
    const container = document.getElementById('configurationsContainer');
    if (!container || container.dataset.configHoverReady === 'true') return;
    container.dataset.configHoverReady = 'true';

    container.addEventListener('mouseover', (event) => {
        const card = event.target.closest('.config-card[data-config-planets]');
        if (!card || !container.contains(card)) return;
        highlightConfigurationCard(card);

        const point = event.target.closest('.planet-tag--config-point[data-config-point-tooltip]');
        if (point && container.contains(point)) {
            showConfigPointTooltip(point.dataset.configPointTooltip, event);
        }
    });

    container.addEventListener('mousemove', (event) => {
        const point = event.target.closest('.planet-tag--config-point[data-config-point-tooltip]');
        if (!point || !container.contains(point)) return;
        moveConfigPointTooltip(event);
    });

    container.addEventListener('mouseout', (event) => {
        const card = event.target.closest('.config-card[data-config-planets]');
        if (!card || !container.contains(card)) return;

        const point = event.target.closest('.planet-tag--config-point[data-config-point-tooltip]');
        if (point && !point.contains(event.relatedTarget)) {
            hideConfigPointTooltip();
        }

        if (card.contains(event.relatedTarget)) return;
        if (activeConfigurationCard === card) {
            clearConfigurationHighlight();
        }
    });

    container.addEventListener('mouseleave', () => {
        clearConfigurationHighlight();
    });
}

function setChartActionsMenuOpen(isOpen) {
    const toggle = document.getElementById('chartActionsToggle');
    const menu = document.getElementById('chartActionsMenu');
    if (!toggle || !menu) return;

    menu.classList.toggle('hidden', !isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function syncChartModalBodyLock() {
    const openModalIds = [
        'editClientDialog',
        'synastryLauncherDialog',
        'chartRelatedPickerDialog',
    ];
    const hasVisibleModal = openModalIds.some((id) => {
        const element = document.getElementById(id);
        return element && !element.classList.contains('hidden');
    });
    document.body.style.overflow = hasVisibleModal ? 'hidden' : '';
}

function getSynastryLauncherRefs() {
    return {
        backdrop: document.getElementById('synastryLauncherBackdrop'),
        dialog: document.getElementById('synastryLauncherDialog'),
        close: document.getElementById('synastryLauncherClose'),
        cancel: document.getElementById('synastryLauncherCancel'),
        error: document.getElementById('synastryLauncherError'),
        list: document.getElementById('synastryLauncherList'),
        empty: document.getElementById('synastryLauncherEmpty'),
        linkExisting: document.getElementById('synastryLauncherLinkExisting'),
        createNew: document.getElementById('synastryLauncherCreateRelated'),
    };
}

function renderSynastryLauncherList() {
    const refs = getSynastryLauncherRefs();
    if (!refs.list || !refs.empty) return;

    if (!synastryLauncherPeople.length) {
        refs.list.innerHTML = '';
        refs.empty.classList.remove('hidden');
        return;
    }

    refs.empty.classList.add('hidden');
    refs.list.innerHTML = synastryLauncherPeople.map((person) => {
        const relatedUserId = String(person.user_id || '');
        const name = window.RelatedPeopleUI?.formatRelatedPersonName?.(person) || t('common.notAvailable');
        const meta = window.RelatedPeopleUI?.formatRelatedPersonMeta?.(person) || t('common.notAvailable');
        return `
            <button
                type="button"
                class="related-person-option"
                data-related-user-id="${escapeAttribute(relatedUserId)}"
            >
                <span class="related-person-name-row">
                    <span class="related-person-name">${escapeAttribute(name)}</span>
                    ${person.relation_label ? `<span class="related-person-badge">${escapeAttribute(person.relation_label)}</span>` : ''}
                </span>
                <span class="related-person-meta">${escapeAttribute(meta)}</span>
            </button>
        `;
    }).join('');
}

function closeSynastryLauncherDialog() {
    const refs = getSynastryLauncherRefs();
    refs.backdrop?.classList.add('hidden');
    refs.dialog?.classList.add('hidden');
    refs.error?.classList.add('hidden');
    if (refs.error) refs.error.textContent = '';
    syncChartModalBodyLock();
}

async function openSynastryLauncherDialog() {
    const refs = getSynastryLauncherRefs();
    const userId = getCurrentChartUserId();
    if (!refs.dialog || !userId) return;

    refs.error?.classList.add('hidden');
    if (refs.error) refs.error.textContent = '';

    try {
        const payload = await window.AstroAPI.getRelatedPeople(userId);
        synastryLauncherPeople = Array.isArray(payload) ? payload : [];
        renderSynastryLauncherList();
        refs.backdrop?.classList.remove('hidden');
        refs.dialog?.classList.remove('hidden');
        syncChartModalBodyLock();
        refs.list?.querySelector('[data-related-user-id]')?.focus();
    } catch (error) {
        synastryLauncherPeople = [];
        renderSynastryLauncherList();
        if (refs.error) {
            refs.error.textContent = error.message || t('page.chart.synastry.loadFailed');
            refs.error.classList.remove('hidden');
        }
        refs.backdrop?.classList.remove('hidden');
        refs.dialog?.classList.remove('hidden');
        syncChartModalBodyLock();
        refs.linkExisting?.focus();
    }
}

function refreshSynastryLauncherLocale() {
    const refs = getSynastryLauncherRefs();
    if (!refs.dialog || refs.dialog.classList.contains('hidden')) return;
    renderSynastryLauncherList();
}

function initSynastryDialogs() {
    const refs = getSynastryLauncherRefs();
    if (refs.dialog && refs.dialog.dataset.bound !== 'true') {
        refs.dialog.dataset.bound = 'true';
        refs.close?.addEventListener('click', closeSynastryLauncherDialog);
        refs.cancel?.addEventListener('click', closeSynastryLauncherDialog);
        refs.backdrop?.addEventListener('click', closeSynastryLauncherDialog);
        refs.list?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-related-user-id]');
            if (!button) return;
            const clientUserId = getCurrentChartUserId();
            closeSynastryLauncherDialog();
            window.RelatedPeopleUI?.openSynastry?.(clientUserId, button.dataset.relatedUserId);
        });
        refs.linkExisting?.addEventListener('click', () => {
            closeSynastryLauncherDialog();
            chartRelatedPeoplePicker?.open?.();
        });
        refs.createNew?.addEventListener('click', () => {
            closeSynastryLauncherDialog();
            openCreateRelatedPersonDialog({ returnToLauncherOnCancel: true });
        });
    }

    if (!chartRelatedPeoplePicker && window.RelatedPeopleUI?.createRelatedPeoplePicker) {
        chartRelatedPeoplePicker = window.RelatedPeopleUI.createRelatedPeoplePicker({
            refs: {
                backdrop: document.getElementById('chartRelatedPickerBackdrop'),
                dialog: document.getElementById('chartRelatedPickerDialog'),
                close: document.getElementById('chartRelatedPickerClose'),
                cancel: document.getElementById('chartRelatedPickerCancel'),
                search: document.getElementById('chartRelatedPickerSearch'),
                relationLabel: document.getElementById('chartRelatedPickerRelationLabel'),
                error: document.getElementById('chartRelatedPickerError'),
                list: document.getElementById('chartRelatedPickerList'),
                empty: document.getElementById('chartRelatedPickerEmpty'),
                submit: document.getElementById('chartRelatedPickerSubmit'),
            },
            getCurrentUserId: () => getCurrentChartUserId(),
            getExistingRelatedPeople: () => synastryLauncherPeople,
            onLinked: async (person) => {
                window.RelatedPeopleUI?.openSynastry?.(getCurrentChartUserId(), person?.user_id);
            },
            onOpenError: (error) => {
                showChartToast(error.message || t('page.chart.synastry.loadFailed'), 'error');
                openSynastryLauncherDialog();
            },
            onClose: (reason) => {
                if (reason !== 'linked') {
                    openSynastryLauncherDialog();
                }
            },
            onVisibilityChange: () => {
                syncChartModalBodyLock();
            },
        });
        chartRelatedPeoplePicker.init();
    }
}

function initEditClientDialog() {
    const refs = getEditDialogRefs();
    if (!refs.dialog || refs.dialog.dataset.bound === 'true') return;

    refs.dialog.dataset.bound = 'true';
    window.Timezones?.populate?.(refs.timezone);

    refs.close.addEventListener('click', closeEditClientDialog);
    refs.cancel.addEventListener('click', closeEditClientDialog);
    refs.backdrop.addEventListener('click', closeEditClientDialog);
    refs.form.addEventListener('submit', handleEditClientSubmit);
    refs.placeInput.addEventListener('input', handleEditPlaceInput);
    refs.placeInput.addEventListener('focus', bindEditPlaceAutocomplete, { once: true });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;

        if (!refs.dialog.classList.contains('hidden')) {
            closeEditClientDialog();
            return;
        }

        setChartActionsMenuOpen(false);
    });
}

function getEditDialogRefs() {
    return {
        dialog: document.getElementById('editClientDialog'),
        backdrop: document.getElementById('editClientBackdrop'),
        form: document.getElementById('editClientForm'),
        kicker: document.getElementById('editClientKicker'),
        title: document.getElementById('editClientTitle'),
        copy: document.getElementById('editClientCopy'),
        close: document.getElementById('editClientClose'),
        cancel: document.getElementById('editClientCancel'),
        submit: document.getElementById('editClientSubmit'),
        error: document.getElementById('editClientError'),
        firstName: document.getElementById('editFirstName'),
        lastName: document.getElementById('editLastName'),
        day: document.getElementById('editBirthDay'),
        month: document.getElementById('editBirthMonth'),
        year: document.getElementById('editBirthYear'),
        hour: document.getElementById('editBirthHour'),
        minute: document.getElementById('editBirthMinute'),
        placeInput: document.getElementById('editBirthPlace'),
        placeSuggestions: document.getElementById('editBirthPlaceSuggestions'),
        placeHint: document.getElementById('editPlaceHint'),
        timezone: document.getElementById('editTimezone'),
        timezoneHint: document.getElementById('editTimezoneHint'),
        relationGroup: document.getElementById('editRelationGroup'),
        relationLabel: document.getElementById('editRelationLabel'),
    };
}

function setEditDialogMode(mode) {
    const refs = getEditDialogRefs();
    editClientState.mode = mode === 'create-related' ? 'create-related' : 'edit-client';
    refs.relationGroup?.classList.toggle('hidden', editClientState.mode !== 'create-related');

    if (refs.kicker) {
        refs.kicker.textContent = editClientState.mode === 'create-related'
            ? t('page.chart.synastry.createKicker')
            : t('page.chart.edit.kicker');
    }
    if (refs.title) {
        refs.title.textContent = editClientState.mode === 'create-related'
            ? t('page.clientProfile.related.createTitle')
            : t('page.chart.edit.title');
    }
    if (refs.copy) {
        refs.copy.textContent = editClientState.mode === 'create-related'
            ? t('page.chart.synastry.createSubtitle')
            : t('page.chart.edit.subtitle');
    }

    const submitText = refs.submit?.querySelector('.btn-text');
    if (submitText) {
        submitText.textContent = editClientState.mode === 'create-related'
            ? t('page.clientProfile.related.createSubmit')
            : t('page.chart.edit.submit');
    }
    const submitLoader = refs.submit?.querySelector('.btn-loader');
    if (submitLoader) {
        submitLoader.textContent = editClientState.mode === 'create-related'
            ? t('page.chart.synastry.createSubmitting')
            : t('page.chart.edit.submitting');
    }
}

function openEditClientDialog() {
    const refs = getEditDialogRefs();
    const rawChartData = window.chartDataRawCache || AstroAPI.getChartFromSession();
    if (!refs.dialog || !rawChartData?.user_id) {
        showChartToast(t('page.chart.edit.errors.chartUnavailable'), 'error');
        return;
    }

    setEditDialogMode('edit-client');
    editClientState.returnToLauncherOnCancel = false;
    editClientState.skipLauncherRestore = false;

    const formData = AstroAPI.chartToFormData(rawChartData, { houseSystem: currentSettings.houseSystem });
    const place = String(formData.place || '').trim();

    refs.firstName.value = formData.firstName || '';
    refs.lastName.value = formData.lastName || '';
    refs.day.value = formData.day || '';
    refs.month.value = formData.month || '';
    refs.year.value = formData.year || '';
    refs.hour.value = formData.hour || '';
    refs.minute.value = formData.minute || '';
    refs.placeInput.value = place;
    if (refs.relationLabel) refs.relationLabel.value = '';

    window.Timezones?.populate?.(refs.timezone);
    refs.timezone.value = formData.timezone || '';
    refs.timezoneHint.textContent = '';
    refs.timezoneHint.style.color = '';

    editClientState.originalCoords = {
        lat: Number(formData.latitude),
        lon: Number(formData.longitude),
    };
    editClientState.selectedCoords = {
        lat: Number(formData.latitude),
        lon: Number(formData.longitude),
    };
    editClientState.originalPlace = normalizeLooseText(place);
    editClientState.selectedPlaceLabel = normalizeLooseText(place);

    refs.error.classList.add('hidden');
    refs.error.textContent = '';
    renderEditPlaceHint('current');
    setEditClientSubmitting(false);

    refs.backdrop.classList.remove('hidden');
    refs.dialog.classList.remove('hidden');
    refs.firstName.focus();
    syncChartModalBodyLock();
}

function openCreateRelatedPersonDialog(options = {}) {
    const refs = getEditDialogRefs();
    if (!refs.dialog || !getCurrentChartUserId()) {
        showChartToast(t('page.chart.edit.errors.chartUnavailable'), 'error');
        return;
    }

    setEditDialogMode('create-related');
    editClientState.returnToLauncherOnCancel = options.returnToLauncherOnCancel === true;
    editClientState.skipLauncherRestore = false;
    editClientState.originalCoords = null;
    editClientState.selectedCoords = null;
    editClientState.originalPlace = '';
    editClientState.selectedPlaceLabel = '';

    refs.form?.reset();
    if (refs.relationLabel) refs.relationLabel.value = '';
    window.Timezones?.populate?.(refs.timezone);
    refs.timezone.value = '';
    refs.timezoneHint.textContent = '';
    refs.timezoneHint.style.color = '';
    refs.error.classList.add('hidden');
    refs.error.textContent = '';
    renderEditPlaceHint('empty');
    setEditClientSubmitting(false);

    refs.backdrop.classList.remove('hidden');
    refs.dialog.classList.remove('hidden');
    refs.firstName.focus();
    syncChartModalBodyLock();
}

function closeEditClientDialog() {
    const refs = getEditDialogRefs();
    if (!refs.dialog) return;

    const shouldRestoreLauncher = editClientState.mode === 'create-related'
        && editClientState.returnToLauncherOnCancel === true
        && editClientState.skipLauncherRestore !== true;

    refs.backdrop.classList.add('hidden');
    refs.dialog.classList.add('hidden');
    refs.error.classList.add('hidden');
    refs.error.textContent = '';
    refs.timezoneHint.textContent = '';
    refs.timezoneHint.style.color = '';
    if (refs.relationLabel) refs.relationLabel.value = '';
    editClientState.returnToLauncherOnCancel = false;
    editClientState.skipLauncherRestore = false;
    editClientState.mode = 'edit-client';
    syncChartModalBodyLock();

    if (shouldRestoreLauncher) {
        openSynastryLauncherDialog();
    }
}

function refreshEditDialogLocale() {
    const refs = getEditDialogRefs();
    if (!refs.dialog || refs.dialog.classList.contains('hidden')) return;

    setEditDialogMode(editClientState.mode);
    const timezoneValue = refs.timezone.value;
    window.Timezones?.populate?.(refs.timezone);
    if (timezoneValue) {
        refs.timezone.value = timezoneValue;
    }
    renderEditPlaceHint(resolveEditPlaceHintMode());
}

function bindEditPlaceAutocomplete() {
    const refs = getEditDialogRefs();
    if (editClientState.autocompleteBound || !window.PlaceAutocomplete || !refs.placeInput || !refs.placeSuggestions) {
        return;
    }

    editClientState.autocompleteBound = true;

    window.PlaceAutocomplete.attach({
        input: refs.placeInput,
        suggestions: refs.placeSuggestions,
        minChars: 2,
        debounceMs: 350,
        limit: 5,
        getLabel: (item) => item.shortName || item.displayName,
        onSelect: async (item) => {
            editClientState.selectedCoords = { lat: item.lat, lon: item.lon };
            editClientState.selectedPlaceLabel = normalizeLooseText(item.shortName || item.displayName);
            renderEditPlaceHint('selected');

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

            if (resolvedTimezone) {
                refs.timezone.value = resolvedTimezone;
                refs.timezoneHint.textContent = t('page.index.form.timezone.autoDetected');
                refs.timezoneHint.style.color = '#22c55e';
            }
        },
    });
}

function handleEditPlaceInput(event) {
    const nextValue = normalizeLooseText(event.target.value);
    if (!nextValue) {
        editClientState.selectedCoords = null;
        renderEditPlaceHint('empty');
        return;
    }

    if (nextValue === editClientState.selectedPlaceLabel) {
        renderEditPlaceHint(resolveEditPlaceHintMode());
        return;
    }

    if (nextValue === editClientState.originalPlace) {
        editClientState.selectedCoords = editClientState.originalCoords;
        editClientState.selectedPlaceLabel = editClientState.originalPlace;
        renderEditPlaceHint('current');
        return;
    }

    editClientState.selectedCoords = null;
    renderEditPlaceHint('manual');
}

function resolveEditPlaceHintMode() {
    if (editClientState.selectedCoords && editClientState.selectedPlaceLabel === editClientState.originalPlace) {
        return 'current';
    }
    if (editClientState.selectedCoords) {
        return 'selected';
    }
    if (getEditDialogRefs().placeInput?.value?.trim()) {
        return 'manual';
    }
    return 'empty';
}

function renderEditPlaceHint(mode) {
    const refs = getEditDialogRefs();
    if (!refs.placeHint) return;

    refs.placeHint.style.color = '';

    if (mode === 'selected') {
        refs.placeHint.textContent = t('page.chart.edit.placeSelected');
        refs.placeHint.style.color = '#22c55e';
        return;
    }

    if (mode === 'manual') {
        refs.placeHint.textContent = t('page.chart.edit.placeManual');
        refs.placeHint.style.color = '#b07d10';
        return;
    }

    if (mode === 'empty') {
        refs.placeHint.textContent = t('page.chart.edit.placeHint');
        return;
    }

    refs.placeHint.textContent = t('page.chart.edit.placeCurrent');
}

async function handleEditClientSubmit(event) {
    event.preventDefault();

    const refs = getEditDialogRefs();
    const rawChartData = window.chartDataRawCache || AstroAPI.getChartFromSession();
    if (!refs.form.reportValidity()) return;
    if (editClientState.mode !== 'create-related' && !rawChartData?.user_id) {
        showChartToast(t('page.chart.edit.errors.chartUnavailable'), 'error');
        return;
    }

    const place = refs.placeInput.value.trim();
    const requestData = {
        first_name: refs.firstName.value.trim(),
        last_name: refs.lastName.value.trim(),
        date: AstroAPI.formatDate(refs.day.value, refs.month.value, refs.year.value),
        time: AstroAPI.formatTime(refs.hour.value, refs.minute.value),
        timezone: refs.timezone.value,
        place,
        house_system: currentSettings.houseSystem,
    };

    const resolvedCoords = resolveEditCoords(place);
    if (resolvedCoords) {
        requestData.latitude = resolvedCoords.lat;
        requestData.longitude = resolvedCoords.lon;
    }

    refs.error.classList.add('hidden');
    refs.error.textContent = '';
    setEditClientSubmitting(true);

    try {
        if (editClientState.mode === 'create-related') {
            const createdPerson = await AstroAPI.createRelatedPerson(getCurrentChartUserId(), {
                ...requestData,
                relation_label: refs.relationLabel?.value?.trim() || '',
            });
            editClientState.skipLauncherRestore = true;
            closeEditClientDialog();
            window.RelatedPeopleUI?.openSynastry?.(getCurrentChartUserId(), createdPerson?.user_id);
        } else {
            const updatedChartData = await AstroAPI.updateClientChart(rawChartData.user_id, requestData);
            const preparedChartData = applyChartState(updatedChartData, { houseSystem: currentSettings.houseSystem });
            currentHoveredAspectKey = null;
            updateHeader(preparedChartData);
            redrawChart(preparedChartData, currentSettings.hiddenPlanets || [], currentSettings.orientation);
            closeEditClientDialog();
            showChartToast(t('page.chart.edit.success'), 'success');
        }
    } catch (error) {
        refs.error.textContent = error.message || t('page.chart.edit.errors.saveFailed');
        refs.error.classList.remove('hidden');
    } finally {
        setEditClientSubmitting(false);
    }
}

function resolveEditCoords(place) {
    const normalizedPlace = normalizeLooseText(place);
    const coords = editClientState.selectedCoords;
    const lat = Number(coords?.lat);
    const lon = Number(coords?.lon);

    if (!normalizedPlace || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
    }

    if (
        normalizedPlace === editClientState.selectedPlaceLabel
        || normalizedPlace === editClientState.originalPlace
    ) {
        return { lat, lon };
    }

    return null;
}

function normalizeLooseText(value) {
    return String(value || '').trim().toLowerCase();
}

function setEditClientSubmitting(isSubmitting) {
    const refs = getEditDialogRefs();
    if (!refs.submit) return;

    refs.submit.disabled = isSubmitting;
    refs.submit.querySelector('.btn-text')?.classList.toggle('hidden', isSubmitting);
    refs.submit.querySelector('.btn-loader')?.classList.toggle('hidden', !isSubmitting);
}

function showChartToast(message, type = 'info') {
    const toast = document.getElementById('chartToast');
    if (!toast || !message) return;

    toast.textContent = message;
    toast.className = `toast ${type}`;

    requestAnimationFrame(() => {
        toast.classList.add('visible');
    });

    clearTimeout(chartToastTimer);
    chartToastTimer = setTimeout(() => {
        toast.classList.remove('visible');
    }, 2800);
}

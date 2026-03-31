/**
 * forecast.js — Main logic for the Forecast page
 * Tabs, API calls, state management, controls
 */

const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:8000/api/v1'
    : '/api/v1';

function t(key, params) {
    return window.FrontendI18n?.t?.(key, params) || key;
}

async function waitForI18nReady() {
    if (!window.FrontendI18n?.ready) return;
    await Promise.resolve(window.FrontendI18n.ready).catch(() => {});
}

function getPlanetName(name) {
    const key = `astro.planet.${name}`;
    const translated = t(key);
    return translated === key ? (Symbols?.planetNamesRu?.[name] || name) : translated;
}

function getSignName(name) {
    const key = `astro.sign.${name}`;
    const translated = t(key);
    return translated === key ? (Symbols?.signNamesRu?.[name] || name) : translated;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getRetrogradeLabel() {
    const key = 'page.natalFull.legend.motion.retrograde';
    const translated = t(key);
    return translated === key ? 'Retrograde' : translated;
}

function retroIndicatorHtml(isRetrograde, variantClass = 'retro-indicator--micro') {
    if (!isRetrograde) return '';
    const suffix = variantClass ? ` ${variantClass}` : '';
    const label = escapeHtml(getRetrogradeLabel());
    return `<span class="retro-indicator${suffix}" title="${label}" aria-label="${label}">R</span>`;
}

function formatPlanetCellHtml(bodyName, isRetrograde = false) {
    if (!bodyName || bodyName === '—') return '—';
    const symbol = Symbols?.planets?.[bodyName] || '';
    const label = escapeHtml(getPlanetName(bodyName));
    const symbolHtml = symbol ? `<span class="astro-symbol">${escapeHtml(symbol)}</span>` : '';
    return `<span class="forecast-body-chip" title="${label}" aria-label="${label}" role="img">${symbolHtml}${retroIndicatorHtml(isRetrograde)}</span>`;
}

// ─── State ──────────────────────────────────────────────
const ForecastState = {
    userId: null,
    natalData: null,
    natalWheelData: null,
    currentTab: 'biwheel',
    controlsExpanded: true,
    isFocusMode: false,
    method: 'transits',
    // cached results
    transitEvents: null,
    transitMoment: null,
    progressionData: null,
    directionData: null,
    combinedBiwheelData: null,
    combinedBiwheelCache: {},
    combinedBiwheelInFlight: {},
    solarData: null,
    solarCache: {},
    solarOrientation: 'aries',
    solarPointScale: 1.0,
    solarWheel: null,
    solarDataRenderer: null,
    solarPanelTab: 'solar-planets-list',
    solarHoveredAspectKey: null,
    solarPinnedAspectKey: null,
    solarAspectInteractionsInit: false,
    // Table data for sorting
    tableRowsRaw: [],
    tableRows: [],
    tableSortCol: 'date',
    tableSortAsc: true,
    biwheelOrientation: 'aries',
    biwheelDisplayMode: 'prognostic',
    transitScaleUnit: 'week',
    transitScalePoints: [],
    transitScaleIndex: 0,
    transitBiwheelCache: {},
    biwheelRequestSeq: 0,
    pendingBiwheelDate: null,
    scalePlaybackTimer: null,
    isScalePlaying: false,
    transitBiwheelBusy: false,
    transitBiwheelInFlight: {},
    transitPrewarmSeq: 0,
    combinedPeriodPrewarmSeq: 0,
    transitPeriodCache: {},
    transitPeriodKey: null,
    transitCalculatedRange: null,
    prognosticPointCache: {},
    pointData: null,
    ingressSummaryData: null,
    ingressSummaryError: null,
    ingressSummaryCache: {},
    ingressSummaryInFlight: {},
    ingressSummaryKey: null,
    progressionTargetDate: null,
    directionTargetDate: null,
    directionType: null,
    solarCalculatedYear: null,
    tableDataKey: null,
    timezone: 'UTC',
    activeRunId: null,
    activeRunMethod: null,
    natalOverlayWheel: null,
    natalOverlayViewportUnsubscribe: null,
    biwheelCompareHighlightHover: null,
    biwheelCompareHighlightPinned: null,
    appliedBiwheelCompareTarget: null,
    biwheelCompareInteractionsInit: false,
    natalButtonPress: null,
    spacePeekActive: false,
    summaryControlsInit: false,
};
window.ForecastState = ForecastState;

const SOLAR_LOCATION_STORAGE_KEY = 'forecastSolarLocation';
const SOLAR_YEAR_STORAGE_KEY = 'forecastSolarYear';
const DIRECTION_TYPE_STORAGE_KEY = 'forecastDirectionType';
const INGRESS_SUMMARY_CACHE_VERSION = 'v5';
const BIWHEEL_NATAL_SCALE_STORAGE_KEY = 'bwNatalPointScale';
const BIWHEEL_NATAL_BUTTON_TAP_MAX_MS = 220;
const BIWHEEL_NATAL_VIEWBOX_SIZE = 500;
const BIWHEEL_NATAL_ANGLE_HOUSE_MAP = {
    ASC: '1',
    DSC: '7',
    MC: '10',
    IC: '4',
};
const FORECAST_PERSIST_WATCH_IDS = new Set([
    'startDate',
    'endDate',
    'singleDate',
    'solarYear',
    'filterMajor',
    'biwheelStepSelect',
    'bwDirectionTypeSelect',
    'biwheelOrientationSelect',
    'solarOrientationSelect',
]);

let forecastStatePersistTimer = null;
let natalButtonIgnoreClickUntil = 0;

function getForecastDisplayModeApi() {
    return window.ForecastDisplayMode || null;
}

function normalizeForecastBiwheelDisplayMode(value, options = {}) {
    return getForecastDisplayModeApi()?.normalizeForecastDisplayMode
        ? getForecastDisplayModeApi().normalizeForecastDisplayMode(value, options)
        : (options.persisted === true
            ? (value === 'natal-pinned' ? 'natal-pinned' : 'prognostic')
            : (['prognostic', 'natal-peek', 'natal-pinned'].includes(value) ? value : 'prognostic'));
}

function reduceForecastBiwheelDisplayMode(currentMode, action) {
    return getForecastDisplayModeApi()?.reduceForecastDisplayMode
        ? getForecastDisplayModeApi().reduceForecastDisplayMode(currentMode, action)
        : normalizeForecastBiwheelDisplayMode(currentMode);
}

function isEditableForecastTarget(target) {
    return getForecastDisplayModeApi()?.isEditableControlTarget
        ? getForecastDisplayModeApi().isEditableControlTarget(target)
        : false;
}

function getForecastStorageApi() {
    return window.ForecastStateStorage || null;
}

function getForecastPersistenceKey() {
    const storageApi = getForecastStorageApi();
    if (!storageApi || !ForecastState.natalData) return null;
    return storageApi.buildStorageKey(ForecastState.natalData);
}

function captureForecastControlState() {
    return {
        startDate: document.getElementById('startDate')?.value || '',
        endDate: document.getElementById('endDate')?.value || '',
        singleDate: document.getElementById('singleDate')?.value || '',
        solarYear: document.getElementById('solarYear')?.value || '',
        filterMajor: document.getElementById('filterMajor')?.checked !== false,
    };
}

function captureForecastCachedData() {
    const cachedData = {};
    const currentTab = ForecastState.currentTab;
    const tableKey = ForecastState.tableDataKey || '';
    const needsTransitPeriod = currentTab === 'timeline'
        || (currentTab === 'table' && (
            tableKey.startsWith('transits|')
            || tableKey.startsWith('combined_table|')
        ));
    const needsCombinedData = currentTab === 'biwheel'
        || (currentTab === 'table' && tableKey.startsWith('combined_table|'));
    const needsIngressSummary = currentTab === 'biwheel'
        || (currentTab === 'table' && tableKey.startsWith('combined_table|'));
    const needsSolarData = currentTab === 'solar';

    if (needsTransitPeriod && ForecastState.transitPeriodKey && ForecastState.transitEvents) {
        cachedData.transitPeriodKey = ForecastState.transitPeriodKey;
        cachedData.transitCalculatedRange = ForecastState.transitCalculatedRange || null;
        cachedData.transitEvents = ForecastState.transitEvents;
    }

    if (needsCombinedData && ForecastState.combinedBiwheelData) {
        const combinedTargetDate = ForecastState.combinedBiwheelData?._targetDate || ForecastState.transitMoment;
        const combinedDirectionType = normalizeDirectionType(
            ForecastState.combinedBiwheelData?._directionType || ForecastState.directionType || 'solar_arc'
        );
        if (combinedTargetDate) {
            cachedData.combinedPointKey = getCombinedPointKey(combinedTargetDate, combinedDirectionType);
            cachedData.combinedBiwheelData = ForecastState.combinedBiwheelData;
        }
    }

    if (needsIngressSummary && ForecastState.ingressSummaryKey) {
        cachedData.ingressSummaryKey = ForecastState.ingressSummaryKey;
        cachedData.ingressSummaryData = ForecastState.ingressSummaryData || null;
        cachedData.ingressSummaryError = ForecastState.ingressSummaryError || null;
    }

    if (currentTab === 'table' && ForecastState.tableDataKey) {
        cachedData.tableDataKey = ForecastState.tableDataKey;
    }

    if (needsSolarData && ForecastState.solarData) {
        const year = Number.parseInt(document.getElementById('solarYear')?.value, 10);
        const lat = Number.parseFloat(document.getElementById('solarLocationLat')?.value);
        const lon = Number.parseFloat(document.getElementById('solarLocationLon')?.value);
        const name = document.getElementById('solarLocationName')?.value?.trim() || '';
        const timezone = document.getElementById('solarLocationTimezone')?.value?.trim() || '';
        cachedData.solarCalculatedYear = ForecastState.solarCalculatedYear;
        cachedData.solarData = ForecastState.solarData;
        if (Number.isFinite(year) && Number.isFinite(lat) && Number.isFinite(lon)) {
            cachedData.solarCacheKey = getSolarCacheKey(year, lat, lon, name, timezone);
        }
    }

    return Object.keys(cachedData).length ? cachedData : null;
}

function restoreForecastCachedData(cachedData) {
    if (!cachedData || typeof cachedData !== 'object') return false;

    let restoredAny = false;

    if (cachedData.transitPeriodKey && cachedData.transitEvents) {
        ForecastState.transitPeriodKey = cachedData.transitPeriodKey;
        ForecastState.transitEvents = cachedData.transitEvents;
        ForecastState.transitCalculatedRange = cachedData.transitCalculatedRange || null;
        ForecastState.transitPeriodCache[cachedData.transitPeriodKey] = cachedData.transitEvents;
        restoredAny = true;
    }

    if (cachedData.combinedPointKey && cachedData.combinedBiwheelData) {
        const combinedData = cachedData.combinedBiwheelData;
        ForecastState.combinedBiwheelCache[cachedData.combinedPointKey] = combinedData;
        ForecastState.combinedBiwheelData = combinedData;
        ForecastState.pointData = combinedData;
        ForecastState.transitMoment = combinedData?._targetDate || ForecastState.transitMoment;
        ForecastState.progressionData = combinedData?._layers?.progression || null;
        ForecastState.progressionTargetDate = combinedData?._targetDate || ForecastState.progressionTargetDate;
        ForecastState.directionData = combinedData?._layers?.direction || null;
        ForecastState.directionTargetDate = combinedData?._targetDate || ForecastState.directionTargetDate;
        ForecastState.directionType = normalizeDirectionType(
            combinedData?._directionType || ForecastState.directionType || 'solar_arc'
        );
        if (ForecastState.transitMoment && combinedData?._layers?.transit) {
            ForecastState.transitBiwheelCache[ForecastState.transitMoment] = combinedData._layers.transit;
        }
        restoredAny = true;
    }

    if (cachedData.ingressSummaryKey) {
        ForecastState.ingressSummaryKey = cachedData.ingressSummaryKey;
        ForecastState.ingressSummaryData = cachedData.ingressSummaryData || null;
        ForecastState.ingressSummaryError = cachedData.ingressSummaryError || null;
        if (cachedData.ingressSummaryData) {
            ForecastState.ingressSummaryCache[cachedData.ingressSummaryKey] = cachedData.ingressSummaryData;
        }
        restoredAny = true;
    }

    if (cachedData.tableDataKey) {
        ForecastState.tableDataKey = cachedData.tableDataKey;
        restoredAny = true;
    }

    if (cachedData.solarData) {
        ForecastState.solarData = cachedData.solarData;
        ForecastState.solarCalculatedYear = cachedData.solarCalculatedYear || ForecastState.solarCalculatedYear;
        if (cachedData.solarCacheKey) {
            ForecastState.solarCache[cachedData.solarCacheKey] = cachedData.solarData;
        }
        restoredAny = true;
    }

    return restoredAny;
}

function applyForecastControlState(controls = {}) {
    const setValue = (id, value) => {
        if (!value) return;
        const element = document.getElementById(id);
        if (element) {
            element.value = value;
        }
    };

    setValue('startDate', controls.startDate);
    setValue('endDate', controls.endDate);
    setValue('singleDate', controls.singleDate);
    setValue('solarYear', controls.solarYear);

    const filterMajor = document.getElementById('filterMajor');
    if (filterMajor && typeof controls.filterMajor === 'boolean') {
        filterMajor.checked = controls.filterMajor;
    }
}

function hasForecastCalculatedState() {
    return Boolean(
        ForecastState.transitMoment
        || ForecastState.transitPeriodKey
        || ForecastState.tableDataKey
        || ForecastState.solarCalculatedYear
        || ForecastState.activeRunId
    );
}

function flushForecastStatePersist() {
    const storageApi = getForecastStorageApi();
    const storageKey = getForecastPersistenceKey();
    if (!storageApi || !storageKey) return;

    if (forecastStatePersistTimer) {
        clearTimeout(forecastStatePersistTimer);
        forecastStatePersistTimer = null;
    }

    const payload = storageApi.buildPersistedState({
        natalData: ForecastState.natalData,
        state: {
            currentTab: ForecastState.currentTab,
            isFocusMode: ForecastState.isFocusMode,
            transitScaleUnit: ForecastState.transitScaleUnit,
            transitScaleIndex: ForecastState.transitScaleIndex,
            transitMoment: ForecastState.transitMoment,
            pendingBiwheelDate: ForecastState.pendingBiwheelDate,
            directionType: ForecastState.directionType,
            biwheelOrientation: ForecastState.biwheelOrientation,
            biwheelDisplayMode: ForecastState.biwheelDisplayMode,
            solarOrientation: ForecastState.solarOrientation,
            solarPanelTab: ForecastState.solarPanelTab,
            tableSortCol: ForecastState.tableSortCol,
            tableSortAsc: ForecastState.tableSortAsc,
            hasCalculatedState: hasForecastCalculatedState(),
            activeRunId: ForecastState.activeRunId,
            activeRunMethod: ForecastState.activeRunMethod,
            cachedData: captureForecastCachedData(),
        },
        controls: captureForecastControlState(),
    });

    if (!payload) return;

    try {
        sessionStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (err) {
        console.warn('Forecast state persist skipped:', err);
    }
}

function scheduleForecastStatePersist(delay = 120) {
    if (forecastStatePersistTimer) {
        clearTimeout(forecastStatePersistTimer);
    }
    forecastStatePersistTimer = setTimeout(() => {
        flushForecastStatePersist();
    }, delay);
}

function restoreForecastStateSnapshot() {
    const storageApi = getForecastStorageApi();
    const storageKey = getForecastPersistenceKey();
    if (!storageApi || !storageKey) return null;

    let restored;
    try {
        restored = storageApi.parsePersistedState(sessionStorage.getItem(storageKey), ForecastState.natalData);
    } catch (err) {
        console.warn('Forecast state restore skipped:', err);
        return null;
    }

    if (!restored) return null;

    applyForecastControlState(restored.controls);
    ForecastState.currentTab = restored.currentTab;
    ForecastState.isFocusMode = restored.isFocusMode;
    ForecastState.transitScaleUnit = restored.transitScaleUnit;
    ForecastState.transitScaleIndex = restored.transitScaleIndex;
    ForecastState.transitMoment = restored.transitMoment || null;
    ForecastState.pendingBiwheelDate = restored.pendingBiwheelDate || restored.transitMoment || null;
    ForecastState.directionType = normalizeDirectionType(restored.directionType || ForecastState.directionType || 'solar_arc');
    ForecastState.biwheelOrientation = restored.biwheelOrientation;
    ForecastState.biwheelDisplayMode = normalizeForecastBiwheelDisplayMode(restored.biwheelDisplayMode, { persisted: false });
    ForecastState.solarOrientation = restored.solarOrientation;
    ForecastState.solarPanelTab = restored.solarPanelTab;
    ForecastState.tableSortCol = restored.tableSortCol;
    ForecastState.tableSortAsc = restored.tableSortAsc;
    ForecastState.activeRunId = restored.activeRunId || null;
    ForecastState.activeRunMethod = restored.activeRunMethod || null;
    restoreForecastCachedData(restored.cachedData);

    const stepSelect = document.getElementById('biwheelStepSelect');
    if (stepSelect) stepSelect.value = ForecastState.transitScaleUnit;
    const directionTypeSelect = document.getElementById('bwDirectionTypeSelect');
    if (directionTypeSelect) directionTypeSelect.value = ForecastState.directionType;
    const biwheelOrientationSelect = document.getElementById('biwheelOrientationSelect');
    if (biwheelOrientationSelect) biwheelOrientationSelect.value = ForecastState.biwheelOrientation;
    const solarOrientationSelect = document.getElementById('solarOrientationSelect');
    if (solarOrientationSelect) solarOrientationSelect.value = ForecastState.solarOrientation;

    applyBiwheelDisplayModeState();

    return restored;
}

function bindForecastStatePersistence() {
    const persistOnControlChange = (event) => {
        if (!(event.target instanceof HTMLElement)) return;
        if (!FORECAST_PERSIST_WATCH_IDS.has(event.target.id)) return;
        scheduleForecastStatePersist();
    };

    document.addEventListener('change', persistOnControlChange);
    document.addEventListener('input', persistOnControlChange);
    window.addEventListener('pagehide', flushForecastStatePersist);
    window.addEventListener('beforeunload', flushForecastStatePersist);
}

function hasRenderableCachedForecastState() {
    if (ForecastState.currentTab === 'solar') {
        return Boolean(ForecastState.solarData);
    }
    if (ForecastState.currentTab === 'timeline') {
        return Boolean(ForecastState.transitEvents);
    }
    if (ForecastState.currentTab === 'table') {
        return Boolean(
            ForecastState.tableDataKey
            || ForecastState.transitEvents
            || ForecastState.combinedBiwheelData
        );
    }
    if (ForecastState.currentTab === 'biwheel') {
        try {
            const method = document.getElementById('methodSelect')?.value || ForecastState.method || 'transits';
            const targetDate = resolveBiwheelTargetDate(method);
            const directionType = resolveDirectionTypeForCombined(method);
            return Boolean(ForecastState.combinedBiwheelCache[getCombinedPointKey(targetDate, directionType)]);
        } catch {
            return Boolean(ForecastState.combinedBiwheelData);
        }
    }
    return false;
}

function activateForecastTab(tabId, { render = true } = {}) {
    const nextTab = ['biwheel', 'timeline', 'table', 'solar'].includes(tabId) ? tabId : 'biwheel';
    document.querySelectorAll('.forecast-tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.tab === nextTab);
    });
    document.querySelectorAll('.forecast-pane').forEach((pane) => {
        pane.classList.toggle('active', pane.id === `pane-${nextTab}`);
    });

    ForecastState.currentTab = nextTab;
    if (nextTab !== 'biwheel' && ForecastState.biwheelDisplayMode === 'natal-peek') {
        setBiwheelDisplayMode('prognostic', { persist: false, preserveCompare: false });
        ForecastState.spacePeekActive = false;
        clearNatalButtonPress();
    } else {
        applyBiwheelDisplayModeState();
    }
    updateControlsVisibility();
    scheduleForecastStatePersist();

    if (render) {
        renderCurrentTabFromCache().catch((err) => {
            console.error('Tab render error:', err);
        });
    }
}

async function hydrateForecastStateSnapshot(restored) {
    if (!restored) return;

    activateForecastTab(restored.currentTab, { render: false });
    activateSolarPanelTab(ForecastState.solarPanelTab || 'solar-planets-list');
    updateControlsVisibility();

    if (!restored.hasCalculatedState) {
        await renderCurrentTabFromCache();
        return;
    }

    try {
        if (hasRenderableCachedForecastState()) {
            await renderCurrentTabFromCache();
            return;
        }

        if (ForecastState.currentTab === 'solar') {
            const year = parseInt(document.getElementById('solarYear')?.value, 10);
            const lat = parseFloat(document.getElementById('solarLocationLat')?.value);
            const lon = parseFloat(document.getElementById('solarLocationLon')?.value);
            if (Number.isFinite(year) && Number.isFinite(lat) && Number.isFinite(lon)) {
                await calculateSolar();
            } else {
                showState('solar', 'empty');
            }
            return;
        }

        await calculateAllForecastViews();
        await renderCurrentTabFromCache();
    } catch (err) {
        console.warn('Forecast state restore failed:', err);
        await renderCurrentTabFromCache();
    }
}

function clampChartPointScale(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 1;
    return Math.min(1.7, Math.max(0.8, n));
}

function readChartPointScale() {
    return clampChartPointScale(parseFloat(localStorage.getItem('solarPointScale') || '1.2'));
}

function getPreparedNatalWheelData() {
    if (ForecastState.natalWheelData) return ForecastState.natalWheelData;
    if (!ForecastState.natalData) return null;

    const houseSystem = ForecastState.natalData?.birth_data?.house_system || undefined;
    ForecastState.natalWheelData = window.NatalWheelData?.prepareNatalWheelData
        ? window.NatalWheelData.prepareNatalWheelData(ForecastState.natalData, { houseSystem })
        : ForecastState.natalData;
    return ForecastState.natalWheelData;
}

function readBiwheelNatalPointScale() {
    return clampChartPointScale(parseFloat(localStorage.getItem(BIWHEEL_NATAL_SCALE_STORAGE_KEY) || '1.0'));
}

function getCurrentBiwheelViewport() {
    return window.ForecastBiwheel?.getNormalizedViewport?.() || {
        zoom: 1,
        panX: 0,
        panY: 0,
    };
}

function applyNormalizedViewBoxToSvg(svg, viewport, baseSize) {
    if (!svg) return;
    const zoom = Math.min(4, Math.max(0.5, Number(viewport?.zoom) || 1));
    const panX = Number.isFinite(Number(viewport?.panX)) ? Number(viewport.panX) : 0;
    const panY = Number.isFinite(Number(viewport?.panY)) ? Number(viewport.panY) : 0;
    const width = baseSize / zoom;
    const height = baseSize / zoom;
    const centerX = baseSize / 2 + (panX * baseSize);
    const centerY = baseSize / 2 + (panY * baseSize);
    svg.setAttribute('viewBox', `${centerX - width / 2} ${centerY - height / 2} ${width} ${height}`);
}

function applyNatalOverlayViewport(viewport = getCurrentBiwheelViewport()) {
    const svg = document.getElementById('biwheelNatalSvg');
    if (!svg) return;
    applyNormalizedViewBoxToSvg(svg, viewport, BIWHEEL_NATAL_VIEWBOX_SIZE);
}

function ensureNatalOverlayWheel() {
    const svg = document.getElementById('biwheelNatalSvg');
    if (!svg || !window.ChartWheel) return null;

    if (!ForecastState.natalOverlayWheel || ForecastState.natalOverlayWheel.svg !== svg) {
        ForecastState.natalOverlayWheel = new window.ChartWheel(svg);
    }
    return ForecastState.natalOverlayWheel;
}

function escapeForecastSelectorValue(value) {
    if (window.CSS?.escape) return window.CSS.escape(String(value ?? ''));
    return String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function normalizeNatalCompareBodyName(name) {
    return window.NatalWheelData?.normalizeSpecialPointName
        ? window.NatalWheelData.normalizeSpecialPointName(name)
        : name;
}

function normalizeBiwheelCompareHighlight(highlight) {
    if (!highlight || typeof highlight !== 'object') return null;
    const rawNatalBody = String(highlight.natalBody || '').trim();
    if (!rawNatalBody) return null;

    const normalizedBody = normalizeNatalCompareBodyName(rawNatalBody);
    const cuspMatch = normalizedBody.match(/^Cusp(\d{1,2})$/i);
    const mappedHouse = cuspMatch?.[1] || BIWHEEL_NATAL_ANGLE_HOUSE_MAP[normalizedBody] || null;
    const target = mappedHouse
        ? { type: 'house', house: mappedHouse }
        : { type: 'planet', name: normalizedBody };
    const key = highlight.key || `${target.type}:${target.type === 'house' ? target.house : target.name}`;

    return {
        key,
        natalBody: normalizedBody,
        target,
        sourceKind: highlight.sourceKind || 'unknown',
    };
}

function getResolvedBiwheelCompareHighlight() {
    return ForecastState.biwheelCompareHighlightPinned || ForecastState.biwheelCompareHighlightHover || null;
}

function setNatalHouseCompareState(group, active) {
    if (!(group instanceof Element)) return;
    const line = group.querySelector('.house-cusp-line');
    const text = group.querySelector('text');
    const houseNumber = Number.parseInt(group.getAttribute('data-house') || '', 10);
    const isAngular = [1, 4, 7, 10].includes(houseNumber);

    if (line) {
        line.style.opacity = active ? '1' : '';
        line.style.strokeWidth = active
            ? (isAngular ? '3.2' : '2.2')
            : '';
    }
    if (text instanceof SVGElement) {
        text.style.fill = active ? 'var(--accent)' : '';
        text.style.fontWeight = active ? '700' : '';
    }
}

function releaseAppliedBiwheelCompareHighlight() {
    const wheel = ForecastState.natalOverlayWheel;
    const applied = ForecastState.appliedBiwheelCompareTarget;
    if (!wheel || !applied) return;

    if (applied.type === 'planet') {
        const node = wheel.svg?.querySelector(`[data-planet="${escapeForecastSelectorValue(applied.name)}"]`);
        if (node) {
            wheel.onPlanetHover({ currentTarget: node }, false);
        }
    } else if (applied.type === 'house') {
        const group = wheel.svg?.querySelector(`.house-cusp-group[data-house="${escapeForecastSelectorValue(applied.house)}"]`);
        if (group) {
            setNatalHouseCompareState(group, false);
        }
    }

    wheel.hideTooltip?.();
    ForecastState.appliedBiwheelCompareTarget = null;
}

function applyBiwheelCompareHighlight() {
    releaseAppliedBiwheelCompareHighlight();

    if (ForecastState.biwheelDisplayMode === 'prognostic') return;
    const wheel = ForecastState.natalOverlayWheel;
    const highlight = getResolvedBiwheelCompareHighlight();
    if (!wheel || !highlight) return;

    if (highlight.target.type === 'planet') {
        const node = wheel.svg?.querySelector(`[data-planet="${escapeForecastSelectorValue(highlight.target.name)}"]`);
        if (!node) return;
        wheel.onPlanetHover({ currentTarget: node }, true);
        wheel.hideTooltip?.();
        ForecastState.appliedBiwheelCompareTarget = highlight.target;
        return;
    }

    if (highlight.target.type === 'house') {
        const group = wheel.svg?.querySelector(`.house-cusp-group[data-house="${escapeForecastSelectorValue(highlight.target.house)}"]`);
        if (!group) return;
        setNatalHouseCompareState(group, true);
        wheel.hideTooltip?.();
        ForecastState.appliedBiwheelCompareTarget = highlight.target;
    }
}

function clearBiwheelCompareHighlights(options = {}) {
    releaseAppliedBiwheelCompareHighlight();
    ForecastState.biwheelCompareHighlightHover = null;
    if (options.includePinned !== false) {
        ForecastState.biwheelCompareHighlightPinned = null;
    }
}

function setBiwheelCompareHoverHighlight(highlight) {
    if (ForecastState.biwheelCompareHighlightPinned) return;
    ForecastState.biwheelCompareHighlightHover = normalizeBiwheelCompareHighlight(highlight);
    applyBiwheelCompareHighlight();
}

function toggleBiwheelComparePinnedHighlight(highlight) {
    const normalized = normalizeBiwheelCompareHighlight(highlight);
    if (!normalized) {
        ForecastState.biwheelCompareHighlightPinned = null;
        applyBiwheelCompareHighlight();
        return;
    }

    ForecastState.biwheelCompareHighlightPinned =
        ForecastState.biwheelCompareHighlightPinned?.key === normalized.key
            ? null
            : normalized;
    if (!ForecastState.biwheelCompareHighlightPinned) {
        ForecastState.biwheelCompareHighlightHover = null;
    }
    applyBiwheelCompareHighlight();
}

function resolveBiwheelCompareHighlightFromElement(element) {
    if (!(element instanceof Element)) return null;

    const aspectRow = element.closest('#biwheelAspects tr[data-aspect-key]');
    if (aspectRow) {
        return normalizeBiwheelCompareHighlight({
            key: `aspect-row:${aspectRow.dataset.aspectKey || aspectRow.dataset.natal || ''}`,
            natalBody: aspectRow.dataset.natal || '',
            sourceKind: 'aspect-row',
        });
    }

    const aspectLine = element.closest('.bw-aspect-line[data-aspect-key]');
    if (aspectLine) {
        return normalizeBiwheelCompareHighlight({
            key: `aspect-line:${aspectLine.dataset.aspectKey || aspectLine.dataset.natal || ''}`,
            natalBody: aspectLine.dataset.natal || '',
            sourceKind: 'aspect-line',
        });
    }

    const prognosticPlanet = element.closest('.bw-planet-group[data-planet-role="transit"]');
    if (prognosticPlanet) {
        return normalizeBiwheelCompareHighlight({
            key: `planet:${prognosticPlanet.getAttribute('data-planet-name') || ''}`,
            natalBody: prognosticPlanet.getAttribute('data-planet-name') || '',
            sourceKind: 'planet',
        });
    }

    return null;
}

function applyBiwheelDisplayModeState() {
    const wrapper = document.getElementById('biwheelSvgWrapper');
    const overlay = document.getElementById('biwheelNatalOverlay');
    const button = document.getElementById('bwNatalToggleBtn');
    const mode = normalizeForecastBiwheelDisplayMode(ForecastState.biwheelDisplayMode);

    if (wrapper) {
        wrapper.dataset.displayMode = mode;
    }
    if (overlay) {
        overlay.setAttribute('aria-hidden', mode === 'prognostic' ? 'true' : 'false');
    }
    if (button) {
        button.setAttribute('aria-pressed', mode === 'natal-pinned' ? 'true' : 'false');
        button.dataset.peeking = mode === 'natal-peek' ? 'true' : 'false';
    }
}

function setBiwheelDisplayMode(nextMode, options = {}) {
    const normalizedMode = normalizeForecastBiwheelDisplayMode(nextMode);
    const previousMode = ForecastState.biwheelDisplayMode;
    ForecastState.biwheelDisplayMode = normalizedMode;

    if (normalizedMode === 'prognostic') {
        releaseAppliedBiwheelCompareHighlight();
        if (options.preserveCompare !== true) {
            clearBiwheelCompareHighlights({ includePinned: true });
        }
    }

    applyBiwheelDisplayModeState();

    if (normalizedMode !== 'prognostic') {
        renderNatalOverlay();
    }

    const modeChanged = previousMode !== normalizedMode;
    if (modeChanged && options.persist !== false && normalizedMode !== 'natal-peek') {
        scheduleForecastStatePersist();
    }
}

function renderNatalOverlay() {
    const wheel = ensureNatalOverlayWheel();
    const natalWheelData = getPreparedNatalWheelData();
    if (!wheel || !natalWheelData) return null;

    const natalPointScale = readBiwheelNatalPointScale();
    wheel.setOrientationMode(ForecastState.biwheelOrientation, { redraw: false });
    wheel.setPointScales({
        planets: natalPointScale,
        points: natalPointScale,
    }, { redraw: false });
    wheel.draw(natalWheelData);
    applyNatalOverlayViewport();
    applyBiwheelCompareHighlight();
    return wheel;
}

function syncBiwheelViewportToNatalOverlay() {
    if (ForecastState.natalOverlayViewportUnsubscribe || !window.ForecastBiwheel?.subscribeViewport) return;
    ForecastState.natalOverlayViewportUnsubscribe = window.ForecastBiwheel.subscribeViewport((viewport) => {
        applyNatalOverlayViewport(viewport);
    });
}

function clearNatalButtonPress() {
    const press = ForecastState.natalButtonPress;
    if (press?.releaseTimer) {
        clearTimeout(press.releaseTimer);
    }
    ForecastState.natalButtonPress = null;
}

function isDesktopNatalPeekShortcutContext(event) {
    if (ForecastState.currentTab !== 'biwheel') return false;
    if (event.defaultPrevented) return false;
    if (event.altKey || event.ctrlKey || event.metaKey) return false;
    if (isEditableForecastTarget(event.target)) return false;
    if (window.matchMedia && !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return false;
    return true;
}

function stopBiwheelControlPointerPropagation(event) {
    event.stopPropagation();
}

function onNatalToggleButtonPointerDown(event) {
    stopBiwheelControlPointerPropagation(event);
    clearNatalButtonPress();

    ForecastState.natalButtonPress = {
        pointerId: event.pointerId,
        startedAt: Date.now(),
        shouldPeek: ForecastState.biwheelDisplayMode !== 'natal-pinned',
        awaitingClick: false,
        releaseTimer: null,
    };

    if (ForecastState.natalButtonPress.shouldPeek) {
        setBiwheelDisplayMode(reduceForecastBiwheelDisplayMode(ForecastState.biwheelDisplayMode, 'peek-on'), {
            persist: false,
            preserveCompare: true,
        });
    }
}

function onNatalToggleButtonPointerUp(event) {
    stopBiwheelControlPointerPropagation(event);
    const press = ForecastState.natalButtonPress;
    if (!press || press.pointerId !== event.pointerId) return;

    const duration = Date.now() - press.startedAt;
    if (!press.shouldPeek) {
        return;
    }

    if (duration > BIWHEEL_NATAL_BUTTON_TAP_MAX_MS) {
        natalButtonIgnoreClickUntil = Date.now() + 320;
        clearNatalButtonPress();
        setBiwheelDisplayMode(reduceForecastBiwheelDisplayMode(ForecastState.biwheelDisplayMode, 'peek-off'), {
            persist: false,
            preserveCompare: true,
        });
        return;
    }

    press.awaitingClick = true;
    press.releaseTimer = window.setTimeout(() => {
        if (ForecastState.natalButtonPress !== press) return;
        clearNatalButtonPress();
        setBiwheelDisplayMode('prognostic', { persist: false, preserveCompare: true });
    }, BIWHEEL_NATAL_BUTTON_TAP_MAX_MS + 40);
}

function onNatalToggleButtonPointerCancel(event) {
    stopBiwheelControlPointerPropagation(event);
    const press = ForecastState.natalButtonPress;
    if (!press || press.pointerId !== event.pointerId) return;
    natalButtonIgnoreClickUntil = Date.now() + 320;
    clearNatalButtonPress();
    if (ForecastState.biwheelDisplayMode === 'natal-peek') {
        setBiwheelDisplayMode('prognostic', { persist: false, preserveCompare: true });
    }
}

function onNatalToggleButtonPointerLeave(event) {
    stopBiwheelControlPointerPropagation(event);
    const press = ForecastState.natalButtonPress;
    if (!press) return;
    natalButtonIgnoreClickUntil = Date.now() + 320;
    clearNatalButtonPress();
    if (ForecastState.biwheelDisplayMode === 'natal-peek') {
        setBiwheelDisplayMode('prognostic', { persist: false, preserveCompare: true });
    }
}

function onNatalToggleButtonClick(event) {
    stopBiwheelControlPointerPropagation(event);
    event.preventDefault();

    if (Date.now() < natalButtonIgnoreClickUntil) {
        return;
    }

    if (ForecastState.biwheelDisplayMode === 'natal-pinned') {
        clearNatalButtonPress();
        setBiwheelDisplayMode('prognostic');
        return;
    }

    if (ForecastState.natalButtonPress?.awaitingClick) {
        clearNatalButtonPress();
        setBiwheelDisplayMode('natal-pinned');
        return;
    }

    setBiwheelDisplayMode('natal-pinned');
}

function onForecastBiwheelKeyDown(event) {
    if (ForecastState.currentTab !== 'biwheel') return;

    if (event.key === 'Escape' && ForecastState.biwheelDisplayMode !== 'prognostic' && !isEditableForecastTarget(event.target)) {
        clearNatalButtonPress();
        ForecastState.spacePeekActive = false;
        setBiwheelDisplayMode('prognostic');
        return;
    }

    const isSpace = event.code === 'Space' || event.key === ' ';
    if (!isSpace || !isDesktopNatalPeekShortcutContext(event)) return;
    if (event.repeat || ForecastState.spacePeekActive || ForecastState.biwheelDisplayMode === 'natal-pinned') {
        event.preventDefault();
        return;
    }

    ForecastState.spacePeekActive = true;
    event.preventDefault();
    setBiwheelDisplayMode('natal-peek', { persist: false, preserveCompare: true });
}

function onForecastBiwheelKeyUp(event) {
    const isSpace = event.code === 'Space' || event.key === ' ';
    if (!isSpace || !ForecastState.spacePeekActive) return;

    ForecastState.spacePeekActive = false;
    event.preventDefault();
    if (ForecastState.biwheelDisplayMode === 'natal-peek') {
        setBiwheelDisplayMode('prognostic', { persist: false, preserveCompare: true });
    }
}

function onForecastBiwheelWindowBlur() {
    ForecastState.spacePeekActive = false;
    clearNatalButtonPress();
    if (ForecastState.biwheelDisplayMode === 'natal-peek') {
        setBiwheelDisplayMode('prognostic', { persist: false, preserveCompare: true });
    }
}

function shouldHandleBiwheelCompareInteractions() {
    return ForecastState.currentTab === 'biwheel' && ForecastState.biwheelDisplayMode !== 'prognostic';
}

function onBiwheelCompareMouseOver(event) {
    if (!shouldHandleBiwheelCompareInteractions()) return;
    const highlight = resolveBiwheelCompareHighlightFromElement(event.target);
    if (!highlight) return;
    setBiwheelCompareHoverHighlight(highlight);
}

function onBiwheelCompareMouseOut(event) {
    if (!shouldHandleBiwheelCompareInteractions()) return;
    if (ForecastState.biwheelCompareHighlightPinned) return;
    if (!(event.target instanceof Element)) return;

    const source = event.target.closest('#biwheelAspects tr[data-aspect-key], .bw-aspect-line[data-aspect-key], .bw-planet-group[data-planet-role="transit"]');
    if (!source) return;
    if (event.relatedTarget instanceof Element && source.contains(event.relatedTarget)) return;
    setBiwheelCompareHoverHighlight(null);
}

function onBiwheelCompareClick(event) {
    if (!shouldHandleBiwheelCompareInteractions()) return;
    const highlight = resolveBiwheelCompareHighlightFromElement(event.target);
    if (!highlight) return;
    toggleBiwheelComparePinnedHighlight(highlight);
}

function initBiwheelNatalInteractions() {
    if (ForecastState.biwheelCompareInteractionsInit) return;
    ForecastState.biwheelCompareInteractionsInit = true;

    const natalButton = document.getElementById('bwNatalToggleBtn');
    const wrapper = document.getElementById('biwheelSvgWrapper');
    const aspectsList = document.getElementById('biwheelAspects');

    if (natalButton) {
        natalButton.addEventListener('pointerdown', onNatalToggleButtonPointerDown);
        natalButton.addEventListener('pointerup', onNatalToggleButtonPointerUp);
        natalButton.addEventListener('pointercancel', onNatalToggleButtonPointerCancel);
        natalButton.addEventListener('pointerleave', onNatalToggleButtonPointerLeave);
        natalButton.addEventListener('click', onNatalToggleButtonClick);
        natalButton.addEventListener('mousedown', stopBiwheelControlPointerPropagation);
        natalButton.addEventListener('touchstart', stopBiwheelControlPointerPropagation, { passive: true });
    }

    document.addEventListener('keydown', onForecastBiwheelKeyDown);
    document.addEventListener('keyup', onForecastBiwheelKeyUp);
    window.addEventListener('blur', onForecastBiwheelWindowBlur);

    [wrapper, aspectsList].forEach((node) => {
        if (!node) return;
        node.addEventListener('mouseover', onBiwheelCompareMouseOver);
        node.addEventListener('mouseout', onBiwheelCompareMouseOut);
        node.addEventListener('click', onBiwheelCompareClick, true);
    });

    syncBiwheelViewportToNatalOverlay();
    applyBiwheelDisplayModeState();
}

function buildForecastChatContext() {
    const method = document.getElementById('methodSelect')?.value || ForecastState.method || 'transits';
    const startDate = document.getElementById('startDate')?.value || null;
    const endDate = document.getElementById('endDate')?.value || null;
    const singleDate = document.getElementById('singleDate')?.value || null;
    const solarYearRaw = document.getElementById('solarYear')?.value;
    const solarYear = solarYearRaw ? parseInt(solarYearRaw, 10) : null;

    const solarLatRaw = parseFloat(document.getElementById('solarLocationLat')?.value);
    const solarLonRaw = parseFloat(document.getElementById('solarLocationLon')?.value);

    const context = {
        page: 'forecast',
        active_tab: ForecastState.currentTab,
        selected_method: method,
        active_run_id: ForecastState.activeRunId || null,
        active_run_method: ForecastState.activeRunMethod || null,
        controls: {
            start_date: startDate,
            end_date: endDate,
            single_date: singleDate,
            solar_year: Number.isNaN(solarYear) ? null : solarYear,
            solar_location_name: document.getElementById('solarLocationName')?.value?.trim() || null,
            solar_location_lat: Number.isFinite(solarLatRaw) ? solarLatRaw : null,
            solar_location_lon: Number.isFinite(solarLonRaw) ? solarLonRaw : null,
        },
        calculated: {
            transits: null,
            progressions: null,
            directions: null,
            solar_return: null,
        },
    };

    const transitRange = ForecastState.transitCalculatedRange || { start_date: startDate, end_date: endDate };
    if (
        ForecastState.transitEvents
        && Array.isArray(ForecastState.transitEvents.events)
        && transitRange.start_date
        && transitRange.end_date
    ) {
        context.calculated.transits = {
            period_start: transitRange.start_date,
            period_end: transitRange.end_date,
            total_events: ForecastState.transitEvents.events.length,
            events: ForecastState.transitEvents.events,
        };
    }

    if (ForecastState.progressionData) {
        context.calculated.progressions = {
            target_date: ForecastState.progressionTargetDate || singleDate,
            data: ForecastState.progressionData,
        };
    }

    if (ForecastState.directionData) {
        const directionType = method.startsWith('directions_')
            ? method.replace('directions_', '')
            : (ForecastState.directionType || ForecastState.directionData.direction_info?.direction_type || 'solar_arc');
        context.calculated.directions = {
            target_date: ForecastState.directionTargetDate || singleDate,
            direction_type: directionType,
            data: ForecastState.directionData,
        };
    }

    if (ForecastState.solarData) {
        context.calculated.solar_return = {
            year: ForecastState.solarCalculatedYear || (Number.isNaN(solarYear) ? null : solarYear),
            data: ForecastState.solarData,
        };
    }

    return context;
}

window.getForecastChatContext = buildForecastChatContext;

// ─── Solar Zoom/Pan ─────────────────────────────────────
let solarZoomLevel = 1;
let solarPanX = 0;
let solarPanY = 0;
let solarIsPanning = false;
let solarPanStartX = 0;
let solarPanStartY = 0;
let solarPinchDistance = 0;
let solarPinchStartZoom = 1;
const SOLAR_VIEWBOX_SIZE = 500;
const SOLAR_ZOOM_MIN = 0.5;
const SOLAR_ZOOM_MAX = 4;
const SOLAR_ZOOM_STEP = 0.08;

// ─── Init ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await waitForI18nReady();

    const me = await window.AstroAPI?.requireAuth?.({ redirectTo: '/login.html' });
    if (!me) return;

    const natalData = AstroAPI.getChartFromSession();
    if (!natalData) {
        window.location.href = 'index.html';
        return;
    }
    ForecastState.natalData = natalData;
    ForecastState.natalWheelData = window.NatalWheelData?.prepareNatalWheelData
        ? window.NatalWheelData.prepareNatalWheelData(natalData, {
            houseSystem: natalData.birth_data?.house_system || undefined,
        })
        : natalData;
    ForecastState.userId = natalData.user_id || localStorage.getItem('currentUserId');
    ForecastState.timezone = natalData.birth_data?.timezone
        || Intl.DateTimeFormat().resolvedOptions().timeZone
        || 'UTC';

    updateHeaderInfo(natalData);
    initDefaults();
    initTabs();
    initControls();
    document.addEventListener('frontend:locale-changed', () => {
        updateHeaderInfo(ForecastState.natalData || natalData);
        updateBiwheelFocusButton();
        updateTransitPlaybackButton();
        renderForecastSummary();
        if (ForecastState.currentTab === 'table' && ForecastState.tableRowsRaw.length) {
            applyTableFiltersAndRender();
        }
        if (window.ForecastBiwheel?.hasLastRender?.()) {
            window.ForecastBiwheel.rerenderLast();
        }
    });
    // Deep-link: if URL has tab/date params, skip state restoration to avoid
    // the restored state overriding the requested date.
    const hasDeepLink = new URLSearchParams(window.location.search).has('tab');

    if (!hasDeepLink) {
        const restoredState = restoreForecastStateSnapshot();
        bindForecastStatePersistence();
        if (restoredState) {
            await hydrateForecastStateSnapshot(restoredState);
        } else {
            scheduleForecastStatePersist();
        }
    } else {
        bindForecastStatePersistence();
        await handleForecastDeepLink();
    }
});

async function handleForecastDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const transitDate = params.get('date');
    const solarYear = params.get('solarYear');

    if (!tab) return;

    // Clean up URL without reloading
    window.history.replaceState({}, '', window.location.pathname);

    if (tab === 'biwheel' && transitDate) {
        activateForecastTab('biwheel', { render: false });
        const singleDateEl = document.getElementById('singleDate');
        if (singleDateEl) singleDateEl.value = transitDate;
        try {
            await calculateTransitBiwheelAt(transitDate, { showLoading: true });
        } catch (err) {
            console.error('Deep-link transit load failed:', err);
        }
        return;
    }

    if (tab === 'solar' && solarYear) {
        activateForecastTab('solar', { render: false });
        const solarYearEl = document.getElementById('solarYear');
        if (solarYearEl) solarYearEl.value = solarYear;

        // Pre-fill birth location as default solar location if not already set
        const latEl = document.getElementById('solarLocationLat');
        const lonEl = document.getElementById('solarLocationLon');
        const nameEl = document.getElementById('solarLocationName');
        const tzEl = document.getElementById('solarLocationTimezone');
        if (latEl && !latEl.value && ForecastState.natalData?.birth_data) {
            const bd = ForecastState.natalData.birth_data;
            latEl.value = bd.latitude ?? '';
            if (lonEl) lonEl.value = bd.longitude ?? '';
            if (nameEl) nameEl.value = bd.place ?? '';
            if (tzEl) tzEl.value = bd.timezone ?? '';
        }

        try {
            await calculateSolar();
        } catch (err) {
            console.error('Deep-link solar load failed:', err);
        }
        return;
    }

    // Fallback: just switch tab
    activateForecastTab(tab);
}

function getForecastTimezone() {
    return ForecastState.timezone || 'UTC';
}

function isForecastMobileViewport() {
    return window.matchMedia?.('(max-width: 768px)')?.matches ?? window.innerWidth <= 768;
}

function formatForecastSummaryDate(dateStr) {
    if (!dateStr) return t('page.forecast.summary.window.notSet');
    const parsed = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return dateStr;
    const locale = window.FrontendI18n?.getLocale?.() || 'en';
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
}

function getForecastSummaryWindowText() {
    if (ForecastState.currentTab === 'solar') {
        const year = document.getElementById('solarYear')?.value || '';
        const location = document.getElementById('solarLocationName')?.value?.trim() || '';
        if (!year && !location) return t('page.forecast.summary.window.notSet');
        return [year, location].filter(Boolean).join(' · ');
    }

    if (ForecastState.currentTab === 'biwheel') {
        const selectedDate = ForecastState.transitMoment
            || document.getElementById('singleDate')?.value
            || document.getElementById('startDate')?.value;
        return selectedDate ? formatForecastSummaryDate(selectedDate) : t('page.forecast.summary.window.notSet');
    }

    const startDate = document.getElementById('startDate')?.value || '';
    const endDate = document.getElementById('endDate')?.value || '';
    if (!startDate && !endDate) return t('page.forecast.summary.window.notSet');
    if (!startDate || !endDate) return formatForecastSummaryDate(startDate || endDate);
    return `${formatForecastSummaryDate(startDate)} - ${formatForecastSummaryDate(endDate)}`;
}

function getForecastSummaryStatusKey() {
    if (ForecastState.currentTab === 'biwheel' && ForecastState.isFocusMode) {
        return 'focus';
    }
    if (ForecastState.currentTab === 'solar') {
        return ForecastState.solarData ? 'ready' : 'needsCalculation';
    }
    if (ForecastState.currentTab === 'timeline') {
        return ForecastState.transitEvents ? 'ready' : 'needsCalculation';
    }
    if (ForecastState.currentTab === 'table') {
        return ForecastState.tableRowsRaw.length ? 'ready' : 'needsCalculation';
    }
    return hasRenderableCachedForecastState() ? 'ready' : 'needsCalculation';
}

function getForecastSummaryText() {
    if (ForecastState.currentTab === 'solar') {
        const year = document.getElementById('solarYear')?.value || '—';
        return ForecastState.solarData
            ? t('page.forecast.summary.solarReady', { year })
            : t('page.forecast.summary.solarPending');
    }

    if (ForecastState.currentTab === 'timeline' && ForecastState.transitEvents?.events?.length) {
        return t('page.forecast.summary.timelineReady', {
            count: ForecastState.transitEvents.events.length,
        });
    }

    if (ForecastState.currentTab === 'biwheel' && hasRenderableCachedForecastState()) {
        return t('page.forecast.summary.biwheelReady', {
            date: formatForecastSummaryDate(
                ForecastState.transitMoment
                || document.getElementById('singleDate')?.value
                || document.getElementById('startDate')?.value
                || ''
            ),
        });
    }

    if (ForecastState.currentTab === 'table' && ForecastState.tableRowsRaw.length) {
        return t('page.forecast.summary.tableReady');
    }

    return t('page.forecast.summary.rangePending');
}

function applyForecastControlsExpandedState() {
    const controls = document.getElementById('forecastControls');
    if (controls) {
        controls.classList.toggle('is-collapsed', ForecastState.controlsExpanded === false);
    }
    updateForecastControlsToggle();
}

function setForecastControlsExpanded(expanded) {
    ForecastState.controlsExpanded = !!expanded;
    applyForecastControlsExpandedState();
}

function updateForecastControlsToggle() {
    const button = document.getElementById('forecastToggleControls');
    if (!button) return;
    const label = ForecastState.controlsExpanded
        ? t('page.forecast.summary.actions.hideSetup')
        : t('page.forecast.summary.actions.editSetup');
    button.textContent = label;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-expanded', ForecastState.controlsExpanded ? 'true' : 'false');
}

function renderForecastSummary() {
    const title = document.getElementById('forecastSummaryTitle');
    const text = document.getElementById('forecastSummaryText');
    const mode = document.getElementById('forecastSummaryMode');
    const windowValue = document.getElementById('forecastSummaryWindow');
    const status = document.getElementById('forecastSummaryStatus');

    if (title) title.textContent = t(`page.forecast.tabs.${ForecastState.currentTab}`);
    if (text) text.textContent = getForecastSummaryText();
    if (mode) mode.textContent = t(`page.forecast.tabs.${ForecastState.currentTab}`);
    if (windowValue) windowValue.textContent = getForecastSummaryWindowText();
    if (status) status.textContent = t(`page.forecast.summary.status.${getForecastSummaryStatusKey()}`);

    document.querySelectorAll('[data-forecast-quick-tab]').forEach((button) => {
        button.classList.toggle('active', button.dataset.forecastQuickTab === ForecastState.currentTab);
    });

    updateForecastControlsToggle();
}

function updateHeaderInfo(data) {
    const el = document.getElementById('headerSubtitle');
    if (el && data.birth_data) {
        const bd = data.birth_data;
        const d = new Date(bd.date);
        const locale = window.FrontendI18n?.getLocale?.() || 'en';
        const dateText = Number.isNaN(d.getTime())
            ? bd.date
            : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
        el.textContent = `${dateText}, ${bd.time?.slice(0,5) || ''}`;
    }
}

function initDefaults() {
    const today = new Date();
    const fmt = d => d.toISOString().split('T')[0];
    document.getElementById('startDate').value = fmt(today);
    applyDatePreset(6, 'months'); // default 6 months
    document.getElementById('singleDate').value = fmt(today);
    const savedSolarYear = parseInt(localStorage.getItem(SOLAR_YEAR_STORAGE_KEY), 10);
    document.getElementById('solarYear').value = (
        Number.isFinite(savedSolarYear) && savedSolarYear >= 1900 && savedSolarYear <= 2100
    ) ? savedSolarYear : today.getFullYear();
    ForecastState.solarPointScale = readChartPointScale();
    const solarScaleRange = document.getElementById('solarPointScaleRange');
    const solarScaleValue = document.getElementById('solarPointScaleValue');
    if (solarScaleRange) solarScaleRange.value = String(Math.round(ForecastState.solarPointScale * 100));
    if (solarScaleValue) solarScaleValue.textContent = `${Math.round(ForecastState.solarPointScale * 100)}%`;
    const stepSelect = document.getElementById('biwheelStepSelect');
    if (stepSelect) stepSelect.value = ForecastState.transitScaleUnit;
    ForecastState.isFocusMode = false;
    ForecastState.controlsExpanded = !isForecastMobileViewport();
    ForecastState.biwheelDisplayMode = 'prognostic';
    ForecastState.directionType = normalizeDirectionType(localStorage.getItem(DIRECTION_TYPE_STORAGE_KEY) || 'solar_arc');
    const directionTypeSelect = document.getElementById('bwDirectionTypeSelect');
    if (directionTypeSelect) directionTypeSelect.value = ForecastState.directionType;
    restoreSolarLocationFromStorage();
    updateBiwheelFocusButton();
    applyForecastFocusState();
    applyBiwheelDisplayModeState();
    applyForecastControlsExpandedState();
}

function applyDatePreset(value, unit = 'months') {
    const today = new Date();
    const fmt = d => d.toISOString().split('T')[0];
    document.getElementById('startDate').value = fmt(today);
    const end = new Date(today);
    if (unit === 'days') {
        end.setDate(end.getDate() + value);
    } else {
        end.setMonth(end.getMonth() + value);
    }
    document.getElementById('endDate').value = fmt(end);
    // Update active preset button
    document.querySelectorAll('.date-presets .preset-btn').forEach(b => {
        const months = b.dataset.months ? parseInt(b.dataset.months, 10) : null;
        const days = b.dataset.days ? parseInt(b.dataset.days, 10) : null;
        const matches = unit === 'days'
            ? days === value
            : months === value;
        b.classList.toggle('active', matches);
    });
    scheduleForecastStatePersist();
}

function formatInputDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseInputDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(`${dateStr}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
}

function addScaleStep(date, stepUnit) {
    const next = new Date(date);
    if (stepUnit === 'month') {
        const day = next.getDate();
        next.setDate(1);
        next.setMonth(next.getMonth() + 1);
        next.setDate(Math.min(day, daysInMonth(next.getFullYear(), next.getMonth())));
        return next;
    }
    if (stepUnit === 'week') {
        next.setDate(next.getDate() + 7);
        return next;
    }
    next.setDate(next.getDate() + 1);
    return next;
}

function buildTransitScalePoints(startDateStr, endDateStr, stepUnit) {
    const start = parseInputDate(startDateStr);
    const end = parseInputDate(endDateStr);
    if (!start || !end || end < start) return [];

    const points = [];
    let cursor = new Date(start);
    let safety = 0;

    while (cursor <= end && safety < 10000) {
        points.push(formatInputDate(cursor));
        const next = addScaleStep(cursor, stepUnit);
        if (next.getTime() === cursor.getTime()) break;
        cursor = next;
        safety += 1;
    }

    const endStr = formatInputDate(end);
    if (points.length === 0 || points[points.length - 1] !== endStr) {
        points.push(endStr);
    }

    return points;
}

// ─── Tabs ───────────────────────────────────────────────
function initTabs() {
    document.querySelectorAll('.forecast-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            activateForecastTab(tab.dataset.tab);
        });
    });
}

function activateSolarPanelTab(tabId) {
    const nextTab = tabId || 'solar-planets-list';
    const tabButtons = document.querySelectorAll('.solar-panel-tab');
    const panes = document.querySelectorAll('.solar-panel-pane');

    tabButtons.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.solarPanelTab === nextTab);
    });
    panes.forEach((pane) => {
        pane.classList.toggle('active', pane.id === nextTab);
    });
    ForecastState.solarPanelTab = nextTab;
    syncSolarHoveredAspectToActiveSurface();
    scheduleForecastStatePersist();
}

function initSolarPanelTabs() {
    const tabButtons = document.querySelectorAll('.solar-panel-tab');
    if (!tabButtons.length) return;

    tabButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            activateSolarPanelTab(btn.dataset.solarPanelTab);
        });
    });

    activateSolarPanelTab(ForecastState.solarPanelTab || 'solar-planets-list');
}

function getSolarDataRenderer() {
    if (!window.ChartDataRenderer) return null;
    if (!ForecastState.solarDataRenderer) {
        ForecastState.solarDataRenderer = new window.ChartDataRenderer({
            planetsTableId: 'solarPlanetsTable',
            aspectsTableId: 'solarAspectsTable',
            aspectGridContainerId: 'solarAspectGridContainer',
            aspectSortHeadersSelector: '#solar-aspects-list th.sortable[data-sort]',
        });
    }
    return ForecastState.solarDataRenderer;
}

function getSolarFocusedAspectKey() {
    return ForecastState.solarPinnedAspectKey || ForecastState.solarHoveredAspectKey || null;
}

function getActiveSolarAspectSurface() {
    const aspectsPane = document.getElementById('solar-aspects-list');
    const gridPane = document.getElementById('solar-grid-list');
    if (aspectsPane?.classList.contains('active')) return 'table';
    if (gridPane?.classList.contains('active')) return 'grid';
    return null;
}

function syncSolarHoveredAspectToActiveSurface() {
    const renderer = getSolarDataRenderer();
    if (!renderer || typeof renderer.setHoveredAspect !== 'function') return;

    const aspectKey = getSolarFocusedAspectKey();
    const surface = getActiveSolarAspectSurface();

    if (!aspectKey || !surface) {
        renderer.clearHoveredAspect?.();
        return;
    }

    renderer.setHoveredAspect(aspectKey, { surface });
}

function findSolarAspectLine(aspectKey) {
    const svg = document.getElementById('solarWheel');
    if (!svg || !aspectKey) return null;
    const lines = svg.querySelectorAll('.aspect-line');
    for (const line of lines) {
        if (line.dataset.aspectKey === aspectKey) return line;
    }
    return null;
}

function applySolarAspectFocus() {
    const svg = document.getElementById('solarWheel');
    if (!svg) return;

    svg.querySelectorAll('.aspect-line.solar-aspect-focus')
        .forEach((line) => line.classList.remove('solar-aspect-focus'));
    svg.querySelectorAll('.planet-group.solar-planet-focus')
        .forEach((group) => group.classList.remove('solar-planet-focus'));

    const aspectKey = getSolarFocusedAspectKey();
    if (!aspectKey) {
        syncSolarHoveredAspectToActiveSurface();
        return;
    }

    const line = findSolarAspectLine(aspectKey);
    if (!line) {
        if (ForecastState.solarPinnedAspectKey === aspectKey) ForecastState.solarPinnedAspectKey = null;
        if (ForecastState.solarHoveredAspectKey === aspectKey) ForecastState.solarHoveredAspectKey = null;
        syncSolarHoveredAspectToActiveSurface();
        return;
    }

    line.classList.add('solar-aspect-focus');
    const bodies = [line.dataset.planet1, line.dataset.planet2].filter(Boolean);
    bodies.forEach((bodyName) => {
        svg.querySelector(`[data-planet="${bodyName}"]`)?.classList.add('solar-planet-focus');
    });

    syncSolarHoveredAspectToActiveSurface();
}

function setSolarHoveredAspectKey(aspectKey) {
    ForecastState.solarHoveredAspectKey = aspectKey || null;
    applySolarAspectFocus();
}

function toggleSolarPinnedAspect(aspectKey) {
    const normalizedKey = aspectKey || null;
    ForecastState.solarPinnedAspectKey = ForecastState.solarPinnedAspectKey === normalizedKey ? null : normalizedKey;
    ForecastState.solarHoveredAspectKey = ForecastState.solarPinnedAspectKey;
    applySolarAspectFocus();
}

function initSolarAspectInteractions() {
    if (ForecastState.solarAspectInteractionsInit) return;
    ForecastState.solarAspectInteractionsInit = true;

    const aspectsPane = document.getElementById('solar-aspects-list');
    if (aspectsPane) {
        aspectsPane.addEventListener('mouseover', (event) => {
            if (ForecastState.solarPinnedAspectKey) return;
            if (!(event.target instanceof Element)) return;
            const row = event.target.closest('tr[data-aspect-key]');
            const key = row?.dataset?.aspectKey;
            if (key) setSolarHoveredAspectKey(key);
        });

        aspectsPane.addEventListener('mouseout', (event) => {
            if (ForecastState.solarPinnedAspectKey) return;
            if (!(event.target instanceof Element)) return;
            const row = event.target.closest('tr[data-aspect-key]');
            if (!row) return;
            if (row.contains(event.relatedTarget)) return;
            setSolarHoveredAspectKey(null);
        });

        aspectsPane.addEventListener('click', (event) => {
            if (!(event.target instanceof Element)) return;
            const row = event.target.closest('tr[data-aspect-key]');
            const key = row?.dataset?.aspectKey;
            if (!key) return;
            toggleSolarPinnedAspect(key);
        });
    }

    const gridPane = document.getElementById('solar-grid-list');
    if (gridPane) {
        gridPane.addEventListener('mouseover', (event) => {
            if (ForecastState.solarPinnedAspectKey) return;
            if (!(event.target instanceof Element)) return;
            const cell = event.target.closest('td[data-aspect-key]');
            const key = cell?.dataset?.aspectKey;
            if (key) setSolarHoveredAspectKey(key);
        });

        gridPane.addEventListener('mouseout', (event) => {
            if (ForecastState.solarPinnedAspectKey) return;
            if (!(event.target instanceof Element)) return;
            const cell = event.target.closest('td[data-aspect-key]');
            if (!cell) return;
            if (cell.contains(event.relatedTarget)) return;
            setSolarHoveredAspectKey(null);
        });

        gridPane.addEventListener('click', (event) => {
            if (!(event.target instanceof Element)) return;
            const cell = event.target.closest('td[data-aspect-key]');
            const key = cell?.dataset?.aspectKey;
            if (!key) return;
            toggleSolarPinnedAspect(key);
        });
    }

    document.addEventListener('chart:aspect-hover', (event) => {
        const key = event?.detail?.aspectKey;
        if (!key || ForecastState.currentTab !== 'solar') return;
        if (!findSolarAspectLine(key)) return;
        if (ForecastState.solarPinnedAspectKey) return;
        setSolarHoveredAspectKey(key);
    });

    document.addEventListener('chart:aspect-leave', (event) => {
        const key = event?.detail?.aspectKey || null;
        if (ForecastState.currentTab !== 'solar') return;
        if (ForecastState.solarPinnedAspectKey) return;
        if (key && ForecastState.solarHoveredAspectKey && key !== ForecastState.solarHoveredAspectKey) return;
        setSolarHoveredAspectKey(null);
    });

    const solarWheel = document.getElementById('solarWheel');
    if (solarWheel) {
        solarWheel.addEventListener('click', (event) => {
            if (!(event.target instanceof Element)) return;
            const line = event.target.closest('.aspect-line');
            const key = line?.dataset?.aspectKey;
            if (!key) return;
            toggleSolarPinnedAspect(key);
        });
    }
}

// ─── Controls ───────────────────────────────────────────
function initControls() {
    // Help overlay
    const helpOverlay = document.getElementById('helpOverlay');
    document.getElementById('btnHelp')?.addEventListener('click', () => helpOverlay.style.display = 'flex');
    document.getElementById('helpClose')?.addEventListener('click', () => helpOverlay.style.display = 'none');
    helpOverlay?.addEventListener('click', e => { if (e.target === helpOverlay) helpOverlay.style.display = 'none'; });

    const methodSelect = document.getElementById('methodSelect');
    if (methodSelect) {
        methodSelect.value = 'transits';
        ForecastState.method = 'transits';
    }
    document.getElementById('btnCalculate').addEventListener('click', onCalculate);
    document.getElementById('forecastSummaryCalculate')?.addEventListener('click', onCalculate);
    document.getElementById('forecastToggleControls')?.addEventListener('click', () => {
        setForecastControlsExpanded(!ForecastState.controlsExpanded);
    });
    document.querySelectorAll('[data-forecast-quick-tab]').forEach((button) => {
        button.addEventListener('click', () => {
            activateForecastTab(button.dataset.forecastQuickTab);
        });
    });
    // Timeline filter re-render
    ['filterMajor'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => {
            if (ForecastState.transitEvents) renderTimeline();
        });
    });
    ['startDate', 'endDate', 'singleDate', 'solarYear', 'solarLocationName'].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        ['input', 'change'].forEach((eventName) => {
            el.addEventListener(eventName, () => {
                renderForecastSummary();
            });
        });
    });
    // Date presets
    document.querySelectorAll('.date-presets .preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.days) {
                applyDatePreset(parseInt(btn.dataset.days, 10), 'days');
                return;
            }
            applyDatePreset(parseInt(btn.dataset.months, 10), 'months');
        });
    });
    ['startDate', 'endDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', async () => {
                if (ForecastState.currentTab === 'biwheel' && document.getElementById('methodSelect').value === 'transits') {
                    refreshTransitScale(ForecastState.transitMoment);
                    const selectedDate = getTransitScaleDateByIndex(ForecastState.transitScaleIndex);
                    if (selectedDate) {
                        calculateTransitBiwheelAt(selectedDate, { showLoading: false }).catch(err => {
                            console.error('Transit biwheel range error:', err);
                        });
                    }
                    const directionType = resolveDirectionTypeForCombined('transits');
                    const period = resolvePrognosticPeriod(selectedDate || ForecastState.transitMoment || '');
                    try {
                        await ensureIngressSummaryData(period.startDate, period.endDate, directionType);
                        if (window.ForecastBiwheel?.hasLastRender?.()) {
                            window.ForecastBiwheel.rerenderLast();
                        }
                    } catch (err) {
                        console.error('Ingress summary period change error:', err);
                    }
                }
            });
        }
    });
    // "Today" button for single-date
    const btnToday = document.getElementById('btnToday');
    if (btnToday) btnToday.addEventListener('click', () => {
        document.getElementById('singleDate').value = new Date().toISOString().split('T')[0];
        scheduleForecastStatePersist();
    });
    // Table sorting
    document.querySelectorAll('.forecast-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (ForecastState.tableSortCol === col) {
                ForecastState.tableSortAsc = !ForecastState.tableSortAsc;
            } else {
                ForecastState.tableSortCol = col;
                ForecastState.tableSortAsc = true;
            }
            if (ForecastState.tableRows.length) renderTableRows();
            scheduleForecastStatePersist();
        });
    });
    ['tableFilterKind', 'tableFilterStrength', 'tableFilterAspect', 'tableFilterMaxOrb', 'tableFilterSearch']
        .forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const evt = id === 'tableFilterSearch' || id === 'tableFilterMaxOrb' ? 'input' : 'change';
            el.addEventListener(evt, () => applyTableFiltersAndRender());
        });
    document.getElementById('tableFiltersToggle')?.addEventListener('click', () => {
        toggleTableFilters();
    });
    document.getElementById('tableFilterReset')?.addEventListener('click', () => {
        resetTableFilters();
        applyTableFiltersAndRender();
    });
    // Solar location geocoding with autocomplete
    initSolarPlaceAutocomplete();
    initSolarZoomPan();
    initSolarPanelTabs();
    initSolarAspectInteractions();
    initBiwheelNatalInteractions();

    const orientationSelect = document.getElementById('biwheelOrientationSelect');
    if (orientationSelect) {
        orientationSelect.value = ForecastState.biwheelOrientation;
        orientationSelect.addEventListener('change', e => {
            ForecastState.biwheelOrientation = e.target.value === 'asc' ? 'asc' : 'aries';
            if (window.ForecastBiwheel?.setOrientationMode) {
                window.ForecastBiwheel.setOrientationMode(ForecastState.biwheelOrientation);
            }
            renderNatalOverlay();
            if (window.ForecastBiwheel && window.ForecastBiwheel.hasLastRender?.()) {
                window.ForecastBiwheel.rerenderLast();
            }
        });
    }

    const solarOrientationSelect = document.getElementById('solarOrientationSelect');
    if (solarOrientationSelect) {
        solarOrientationSelect.value = ForecastState.solarOrientation;
        solarOrientationSelect.addEventListener('change', e => {
            ForecastState.solarOrientation = e.target.value === 'asc' ? 'asc' : 'aries';
            if (ForecastState.solarData) {
                renderSolarChart(ForecastState.solarData);
            }
        });
    }
    const solarPointScaleRange = document.getElementById('solarPointScaleRange');
    const solarPointScaleValue = document.getElementById('solarPointScaleValue');
    if (solarPointScaleRange) {
        solarPointScaleRange.addEventListener('input', e => {
            ForecastState.solarPointScale = clampChartPointScale((Number(e.target.value) || 100) / 100);
            localStorage.setItem('solarPointScale', String(ForecastState.solarPointScale));
            if (solarPointScaleValue) {
                solarPointScaleValue.textContent = `${Math.round(ForecastState.solarPointScale * 100)}%`;
            }
            if (ForecastState.solarData) {
                renderSolarChart(ForecastState.solarData);
            }
        });
    }
    const solarSettingsBtn = document.getElementById('solarSettingsBtn');
    const solarSettingsPanel = document.getElementById('solarSettingsPanel');
    if (solarSettingsBtn && solarSettingsPanel) {
        solarSettingsBtn.addEventListener('click', () => {
            solarSettingsPanel.classList.remove('hidden');
        });
        solarSettingsPanel.addEventListener('click', e => {
            if (e.target === solarSettingsPanel) {
                solarSettingsPanel.classList.add('hidden');
            }
        });
        document.getElementById('solarSettingsClose')?.addEventListener('click', () => {
            solarSettingsPanel.classList.add('hidden');
        });
    }

    const stepSelect = document.getElementById('biwheelStepSelect');
    if (stepSelect) {
        stepSelect.addEventListener('change', () => {
            ForecastState.transitScaleUnit = stepSelect.value;
            refreshTransitScale(ForecastState.transitMoment);
            const selectedDate = getTransitScaleDateByIndex(ForecastState.transitScaleIndex);
            if (selectedDate && ForecastState.currentTab === 'biwheel' && document.getElementById('methodSelect').value === 'transits') {
                calculateTransitBiwheelAt(selectedDate, { showLoading: false }).catch(err => {
                    console.error('Transit biwheel step-unit error:', err);
                });
            }
        });
    }
    document.getElementById('btnScalePrev')?.addEventListener('click', () => shiftTransitScale(-1));
    document.getElementById('btnScaleNext')?.addEventListener('click', () => shiftTransitScale(1));
    document.getElementById('btnScalePlay')?.addEventListener('click', toggleTransitScalePlayback);
    document.getElementById('biwheelTimeSlider')?.addEventListener('input', onTransitScaleSliderInput);
    document.getElementById('forecastFocusToggleBtn')?.addEventListener('click', () => {
        setForecastFocusMode(!ForecastState.isFocusMode);
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && ForecastState.isFocusMode) {
            setForecastFocusMode(false);
        }
    });
    document.getElementById('bwNatalScaleRange')?.addEventListener('input', () => {
        renderNatalOverlay();
    });
    const directionTypeSelect = document.getElementById('bwDirectionTypeSelect');
    if (directionTypeSelect) {
        directionTypeSelect.value = normalizeDirectionType(ForecastState.directionType || 'solar_arc');
        directionTypeSelect.addEventListener('change', async e => {
            const nextType = normalizeDirectionType(e.target.value);
            ForecastState.directionType = nextType;
            localStorage.setItem(DIRECTION_TYPE_STORAGE_KEY, nextType);
            ForecastState.combinedPeriodPrewarmSeq += 1;
            if (ForecastState.currentTab === 'biwheel' || ForecastState.currentTab === 'table') {
                try {
                    await calculateAllForecastViews();
                    await renderCurrentTabFromCache();
                } catch (err) {
                    console.error('Direction type switch error:', err);
                }
            }
        });
    }

    toggleTableFilters(true);
    updateTableFiltersBadge();
    updateControlsVisibility();
    renderForecastSummary();
}

function updateBiwheelFocusButton() {
    const btn = document.getElementById('forecastFocusToggleBtn');
    if (!btn) return;
    const labelKey = ForecastState.isFocusMode
        ? 'page.forecast.scale.focusExit'
        : 'page.forecast.scale.focusEnter';
    const label = t(labelKey);
    const show = ForecastState.currentTab === 'biwheel';
    btn.style.display = show ? 'inline-flex' : 'none';
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.textContent = label;
}

function applyForecastFocusState() {
    const isFocusBiwheel = ForecastState.currentTab === 'biwheel' && ForecastState.isFocusMode;
    document.body.classList.toggle('forecast-focus-active', isFocusBiwheel);
    updateBiwheelFocusButton();
    renderForecastSummary();
}

function setForecastFocusMode(enabled) {
    ForecastState.isFocusMode = !!enabled;
    applyForecastFocusState();
    updateControlsVisibility();
    scheduleForecastStatePersist();
}

function applySolarViewBox() {
    const svg = document.getElementById('solarWheel');
    if (!svg) return;
    const width = SOLAR_VIEWBOX_SIZE / solarZoomLevel;
    const height = SOLAR_VIEWBOX_SIZE / solarZoomLevel;
    const cx = SOLAR_VIEWBOX_SIZE / 2 + solarPanX;
    const cy = SOLAR_VIEWBOX_SIZE / 2 + solarPanY;
    svg.setAttribute('viewBox', `${cx - width / 2} ${cy - height / 2} ${width} ${height}`);
}

function resetSolarView() {
    const svg = document.getElementById('solarWheel');
    solarZoomLevel = 1;
    solarPanX = 0;
    solarPanY = 0;
    if (svg) {
        svg.setAttribute('viewBox', `0 0 ${SOLAR_VIEWBOX_SIZE} ${SOLAR_VIEWBOX_SIZE}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }
    applySolarViewBox();
}

function initSolarZoomPan() {
    const wrapper = document.getElementById('solarWheelWrapper');
    if (!wrapper || wrapper.dataset.zoomInit === '1') return;
    wrapper.dataset.zoomInit = '1';

    const getSolarTouchDistance = (touchA, touchB) => {
        const dx = touchA.clientX - touchB.clientX;
        const dy = touchA.clientY - touchB.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const isBlockedSolarZoomTarget = (target) => target instanceof Element
        && Boolean(target.closest('.biwheel-zoom-controls, .bw-settings-panel'));

    wrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -SOLAR_ZOOM_STEP : SOLAR_ZOOM_STEP;
        solarZoomLevel = Math.min(SOLAR_ZOOM_MAX, Math.max(SOLAR_ZOOM_MIN, solarZoomLevel + delta));
        applySolarViewBox();
    }, { passive: false });

    wrapper.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || e.target.closest('.bw-zoom-btn')) return;
        solarIsPanning = true;
        solarPanStartX = e.clientX;
        solarPanStartY = e.clientY;
    });
    window.addEventListener('mousemove', (e) => {
        if (!solarIsPanning) return;
        const scale = SOLAR_VIEWBOX_SIZE / (solarZoomLevel * (wrapper.clientWidth || SOLAR_VIEWBOX_SIZE));
        solarPanX -= (e.clientX - solarPanStartX) * scale;
        solarPanY -= (e.clientY - solarPanStartY) * scale;
        solarPanStartX = e.clientX;
        solarPanStartY = e.clientY;
        applySolarViewBox();
    });
    window.addEventListener('mouseup', () => { solarIsPanning = false; });

    wrapper.addEventListener('touchstart', (e) => {
        if (isBlockedSolarZoomTarget(e.target)) return;
        if (e.touches.length === 2) {
            solarPinchDistance = getSolarTouchDistance(e.touches[0], e.touches[1]);
            solarPinchStartZoom = solarZoomLevel;
            solarIsPanning = false;
            e.preventDefault();
            return;
        }
        if (e.touches.length !== 1) {
            solarIsPanning = false;
            solarPinchDistance = 0;
            return;
        }
        solarIsPanning = true;
        solarPanStartX = e.touches[0].clientX;
        solarPanStartY = e.touches[0].clientY;
    }, { passive: false });
    wrapper.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && solarPinchDistance > 0) {
            e.preventDefault();
            const currentDistance = getSolarTouchDistance(e.touches[0], e.touches[1]);
            const nextZoom = solarPinchStartZoom * (currentDistance / solarPinchDistance);
            solarZoomLevel = Math.min(SOLAR_ZOOM_MAX, Math.max(SOLAR_ZOOM_MIN, nextZoom));
            applySolarViewBox();
            return;
        }
        if (e.touches.length !== 1 || !solarIsPanning) return;
        e.preventDefault();
        const scale = SOLAR_VIEWBOX_SIZE / (solarZoomLevel * (wrapper.clientWidth || SOLAR_VIEWBOX_SIZE));
        solarPanX -= (e.touches[0].clientX - solarPanStartX) * scale;
        solarPanY -= (e.touches[0].clientY - solarPanStartY) * scale;
        solarPanStartX = e.touches[0].clientX;
        solarPanStartY = e.touches[0].clientY;
        applySolarViewBox();
    }, { passive: false });
    wrapper.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            solarPinchDistance = 0;
        }
        if (e.touches.length === 1) {
            solarIsPanning = true;
            solarPanStartX = e.touches[0].clientX;
            solarPanStartY = e.touches[0].clientY;
            return;
        }
        solarIsPanning = false;
    });
    wrapper.addEventListener('touchcancel', () => {
        solarIsPanning = false;
        solarPinchDistance = 0;
    });

    document.getElementById('solarZoomIn')?.addEventListener('click', () => {
        solarZoomLevel = Math.min(SOLAR_ZOOM_MAX, solarZoomLevel + SOLAR_ZOOM_STEP * 2);
        applySolarViewBox();
    });
    document.getElementById('solarZoomOut')?.addEventListener('click', () => {
        solarZoomLevel = Math.max(SOLAR_ZOOM_MIN, solarZoomLevel - SOLAR_ZOOM_STEP * 2);
        applySolarViewBox();
    });
    document.getElementById('solarZoomReset')?.addEventListener('click', resetSolarView);

    resetSolarView();
}

function getTransitScaleDateByIndex(index) {
    return ForecastState.transitScalePoints[index] || null;
}

function findNearestTransitScaleIndex(dateStr) {
    const points = ForecastState.transitScalePoints;
    if (!points.length) return 0;
    const target = parseInputDate(dateStr)?.getTime();
    if (!target) return 0;

    let bestIdx = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < points.length; i++) {
        const pointTime = parseInputDate(points[i])?.getTime() ?? 0;
        const diff = Math.abs(pointTime - target);
        if (diff < bestDiff) {
            bestDiff = diff;
            bestIdx = i;
        }
    }
    return bestIdx;
}

function updateTransitScaleControls() {
    const slider = document.getElementById('biwheelTimeSlider');
    const prevBtn = document.getElementById('btnScalePrev');
    const nextBtn = document.getElementById('btnScaleNext');
    const currentEl = document.getElementById('biwheelScaleCurrent');
    const rangeEl = document.getElementById('biwheelScaleRange');
    const ticksEl = document.getElementById('biwheelScaleTicks');
    const points = ForecastState.transitScalePoints;

    if (!slider || !prevBtn || !nextBtn || !currentEl || !rangeEl) return;

    const hasPoints = points.length > 0;
    slider.max = String(Math.max(0, points.length - 1));
    slider.value = String(Math.min(ForecastState.transitScaleIndex, Math.max(0, points.length - 1)));
    slider.disabled = !hasPoints;
    prevBtn.disabled = !hasPoints || ForecastState.transitScaleIndex <= 0;
    nextBtn.disabled = !hasPoints || ForecastState.transitScaleIndex >= points.length - 1;

    const selectedDate = getTransitScaleDateByIndex(ForecastState.transitScaleIndex);
    currentEl.textContent = selectedDate || '—';
    rangeEl.textContent = hasPoints
        ? t('page.forecast.scale.range', { start: points[0], end: points[points.length - 1], count: points.length })
        : '';
    renderTransitScaleTicks(ticksEl, points, ForecastState.transitScaleIndex);
    updateTransitPlaybackButton();
}

function updateTransitPlaybackButton() {
    const playBtn = document.getElementById('btnScalePlay');
    if (!playBtn) return;
    const atEnd = ForecastState.transitScalePoints.length > 0 &&
        ForecastState.transitScaleIndex >= ForecastState.transitScalePoints.length - 1;
    playBtn.textContent = ForecastState.isScalePlaying ? '⏸' : '▶';
    playBtn.title = ForecastState.isScalePlaying ? t('common.pause') : t('page.forecast.scale.play');
    playBtn.disabled = ForecastState.transitScalePoints.length === 0 || (atEnd && !ForecastState.isScalePlaying);
}

function getScaleTickStride(totalPoints) {
    if (totalPoints <= 14) return 1;
    if (totalPoints <= 50) return 5;
    if (totalPoints <= 100) return 7;
    return 10;
}

function formatScaleTickLabel(dateStr, totalPoints) {
    if (!dateStr) return '';
    if (totalPoints <= 20) return dateStr.slice(5);
    const [y, m, d] = dateStr.split('-');
    return `${d}.${m}`;
}

function buildTransitPrewarmQueue(centerDate) {
    const points = ForecastState.transitScalePoints || [];
    if (!centerDate || !points.length) return [];
    const centerIndex = points.indexOf(centerDate);
    if (centerIndex < 0) return [];

    const queue = [];
    const seen = new Set([centerDate]);
    const pushIfValid = (idx) => {
        if (idx < 0 || idx >= points.length) return;
        const date = points[idx];
        if (!date || seen.has(date)) return;
        seen.add(date);
        queue.push(date);
    };

    for (let delta = 1; delta <= 3; delta++) {
        pushIfValid(centerIndex + delta);
        pushIfValid(centerIndex - delta);
    }

    pushIfValid(0);
    pushIfValid(points.length - 1);
    return queue;
}

function scheduleTransitBiwheelPrewarm(centerDate) {
    const method = document.getElementById('methodSelect')?.value;
    if (method !== 'transits') return;

    const queue = buildTransitPrewarmQueue(centerDate);
    if (!queue.length) return;

    const seq = ++ForecastState.transitPrewarmSeq;
    (async () => {
        for (const dateStr of queue) {
            if (seq !== ForecastState.transitPrewarmSeq) return;
            if (ForecastState.transitBiwheelCache[dateStr]) continue;
            try {
                await fetchTransitBiwheelData(dateStr);
            } catch (err) {
                console.debug('Transit biwheel prewarm skipped:', dateStr, err?.message || err);
            }
        }
    })();
}

function scheduleCombinedPeriodPrewarm(directionType) {
    const method = document.getElementById('methodSelect')?.value;
    if (method !== 'transits') return;
    const points = ForecastState.transitScalePoints || [];
    if (!points.length) return;

    const normalizedDirectionType = normalizeDirectionType(directionType);
    const seq = ++ForecastState.combinedPeriodPrewarmSeq;
    (async () => {
        for (const dateStr of points) {
            if (seq !== ForecastState.combinedPeriodPrewarmSeq) return;
            const key = getCombinedPointKey(dateStr, normalizedDirectionType);
            if (ForecastState.combinedBiwheelCache[key]) continue;
            try {
                await ensureCombinedBiwheelData(dateStr, { directionType: normalizedDirectionType });
            } catch (err) {
                console.debug('Combined period prewarm skipped:', dateStr, err?.message || err);
            }
        }
    })();
}

function renderTransitScaleTicks(container, points, activeIndex) {
    if (!container) return;
    if (!points || points.length === 0) {
        container.innerHTML = '';
        return;
    }
    const total = points.length;
    const stride = getScaleTickStride(total);
    const indexSet = new Set([0, total - 1]);
    for (let i = 0; i < total; i += stride) indexSet.add(i);
    const indexes = [...indexSet].sort((a, b) => a - b);

    container.innerHTML = indexes.map(i => {
        const leftPct = total === 1 ? 50 : (i / (total - 1)) * 100;
        const activeClass = i === activeIndex ? ' active' : '';
        const label = formatScaleTickLabel(points[i], total);
        return `<span class="bw-scale-tick${activeClass}" style="left:${leftPct.toFixed(3)}%" title="${points[i]}">${label}</span>`;
    }).join('');
}

function refreshTransitScale(preferredDate) {
    const startDate = document.getElementById('startDate')?.value;
    const endDate = document.getElementById('endDate')?.value;
    const stepSelect = document.getElementById('biwheelStepSelect');
    if (stepSelect && ['day', 'week', 'month'].includes(stepSelect.value)) {
        ForecastState.transitScaleUnit = stepSelect.value;
    }

    ForecastState.transitScalePoints = buildTransitScalePoints(
        startDate,
        endDate,
        ForecastState.transitScaleUnit
    );

    if (!ForecastState.transitScalePoints.length) {
        stopTransitScalePlayback();
        ForecastState.transitScaleIndex = 0;
        updateTransitScaleControls();
        return;
    }

    const target = preferredDate || ForecastState.pendingBiwheelDate || ForecastState.transitMoment || startDate;
    ForecastState.transitScaleIndex = findNearestTransitScaleIndex(target);
    ForecastState.pendingBiwheelDate = null;
    updateTransitScaleControls();
}

function setTransitScaleIndex(index) {
    const points = ForecastState.transitScalePoints;
    if (!points.length) return null;
    const nextIndex = Math.max(0, Math.min(index, points.length - 1));
    ForecastState.transitScaleIndex = nextIndex;
    updateTransitScaleControls();
    scheduleForecastStatePersist();
    return points[nextIndex];
}

function shiftTransitScale(delta) {
    const method = document.getElementById('methodSelect').value;
    if (method !== 'transits') return false;
    const prevIndex = ForecastState.transitScaleIndex;
    const nextDate = setTransitScaleIndex(ForecastState.transitScaleIndex + delta);
    if (!nextDate) return false;
    if (ForecastState.transitScaleIndex === prevIndex) return false;
    calculateTransitBiwheelAt(nextDate, { showLoading: false }).catch(err => {
        console.error('Transit biwheel step error:', err);
    });
    return true;
}

let biwheelSliderDebounce = null;
function onTransitScaleSliderInput(e) {
    const method = document.getElementById('methodSelect').value;
    if (method !== 'transits') return;
    const index = parseInt(e.target.value, 10);
    const selectedDate = setTransitScaleIndex(Number.isNaN(index) ? 0 : index);
    if (!selectedDate) return;

    clearTimeout(biwheelSliderDebounce);
    biwheelSliderDebounce = setTimeout(() => {
        calculateTransitBiwheelAt(selectedDate, { showLoading: false }).catch(err => {
            console.error('Transit biwheel slider error:', err);
        });
    }, 180);
}

function startTransitScalePlayback() {
    if (ForecastState.isScalePlaying) return;
    const method = document.getElementById('methodSelect').value;
    if (method !== 'transits') return;
    const points = ForecastState.transitScalePoints;
    if (!points.length) return;
    if (ForecastState.transitScaleIndex >= points.length - 1) {
        setTransitScaleIndex(0);
    }

    ForecastState.isScalePlaying = true;
    updateTransitPlaybackButton();
    ForecastState.scalePlaybackTimer = setInterval(() => {
        if (ForecastState.transitBiwheelBusy) return;
        const moved = shiftTransitScale(1);
        if (!moved) {
            stopTransitScalePlayback();
        }
    }, 1000);
}

function stopTransitScalePlayback() {
    if (ForecastState.scalePlaybackTimer) {
        clearInterval(ForecastState.scalePlaybackTimer);
        ForecastState.scalePlaybackTimer = null;
    }
    ForecastState.isScalePlaying = false;
    updateTransitPlaybackButton();
}

function toggleTransitScalePlayback() {
    if (ForecastState.isScalePlaying) stopTransitScalePlayback();
    else startTransitScalePlayback();
}

function initSolarPlaceAutocomplete() {
    const input = document.getElementById('solarLocationName');
    const suggestions = document.getElementById('solarPlaceSuggestions');
    if (!input || !suggestions) return;

    let bound = false;
    const bind = () => {
        if (bound || !window.PlaceAutocomplete) return;
        bound = true;
        PlaceAutocomplete.attach({
            input,
            suggestions,
            minChars: 2,
            debounceMs: 350,
            limit: 5,
            getLabel: (item) => item.shortName || item.displayName,
            onInput: () => {
                // Force explicit place selection from suggestions for valid coords.
                document.getElementById('solarLocationLat').value = '';
                document.getElementById('solarLocationLon').value = '';
                document.getElementById('solarLocationSourceId').value = '';
                document.getElementById('solarLocationTimezone').value = '';
                document.getElementById('solarCoordsDisplay').textContent = '';
                persistSolarLocationToStorage();
            },
            onSelect: async (item) => {
                document.getElementById('solarLocationLat').value = item.lat;
                document.getElementById('solarLocationLon').value = item.lon;
                document.getElementById('solarLocationSourceId').value = item.sourceId || '';
                document.getElementById('solarCoordsDisplay').textContent = `(${item.lat.toFixed(2)}°, ${item.lon.toFixed(2)}°)`;
                let resolvedTz = null;
                if (item.sourceId && window.AstroAPI?.resolvePlaceTimezone) {
                    try {
                        resolvedTz = await window.AstroAPI.resolvePlaceTimezone(item.sourceId);
                    } catch (_error) {
                        resolvedTz = null;
                    }
                }
                if (!resolvedTz) {
                    resolvedTz = window.Timezones?.guess?.(item.displayName || item.shortName) || null;
                }
                document.getElementById('solarLocationTimezone').value = resolvedTz || '';
                persistSolarLocationToStorage();
            }
        });
    };

    input.addEventListener('focus', bind, { once: true });
}

function getSolarCacheKey(year, lat, lon, name, timezone) {
    const latKey = Number.isFinite(lat) ? lat.toFixed(5) : 'NaN';
    const lonKey = Number.isFinite(lon) ? lon.toFixed(5) : 'NaN';
    const nameKey = (name || '').trim().toLowerCase();
    const timezoneKey = (timezone || '').trim();
    return `${year}|${latKey}|${lonKey}|${nameKey}|${timezoneKey}`;
}

function persistSolarLocationToStorage() {
    const name = document.getElementById('solarLocationName')?.value?.trim() || '';
    const lat = parseFloat(document.getElementById('solarLocationLat')?.value);
    const lon = parseFloat(document.getElementById('solarLocationLon')?.value);
    const sourceId = document.getElementById('solarLocationSourceId')?.value?.trim() || '';
    const timezone = document.getElementById('solarLocationTimezone')?.value?.trim() || '';
    const payload = {
        name,
        lat: Number.isFinite(lat) ? lat : null,
        lon: Number.isFinite(lon) ? lon : null,
        source_id: sourceId || null,
        timezone: timezone || null,
    };
    localStorage.setItem(SOLAR_LOCATION_STORAGE_KEY, JSON.stringify(payload));
}

function restoreSolarLocationFromStorage() {
    const raw = localStorage.getItem(SOLAR_LOCATION_STORAGE_KEY);
    if (!raw) return;
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return;
    }
    const nameInput = document.getElementById('solarLocationName');
    const latInput = document.getElementById('solarLocationLat');
    const lonInput = document.getElementById('solarLocationLon');
    const sourceIdInput = document.getElementById('solarLocationSourceId');
    const timezoneInput = document.getElementById('solarLocationTimezone');
    const coordsDisplay = document.getElementById('solarCoordsDisplay');
    if (!nameInput || !latInput || !lonInput || !sourceIdInput || !timezoneInput || !coordsDisplay) return;

    if (typeof parsed?.name === 'string') nameInput.value = parsed.name;
    if (Number.isFinite(parsed?.lat)) latInput.value = String(parsed.lat);
    if (Number.isFinite(parsed?.lon)) lonInput.value = String(parsed.lon);
    if (typeof parsed?.source_id === 'string') sourceIdInput.value = parsed.source_id;
    if (typeof parsed?.timezone === 'string') timezoneInput.value = parsed.timezone;
    if (Number.isFinite(parsed?.lat) && Number.isFinite(parsed?.lon)) {
        coordsDisplay.textContent = `(${parsed.lat.toFixed(2)}°, ${parsed.lon.toFixed(2)}°)`;
    } else {
        coordsDisplay.textContent = '';
    }
}

function updateControlsVisibility() {
    const tab = ForecastState.currentTab;
    const dateRange = document.getElementById('dateRangeGroup');
    const singleDate = document.getElementById('singleDateGroup');
    const solarYear = document.getElementById('solarYearGroup');
    const solarOrientation = document.getElementById('solarOrientationGroup');
    const solarLocation = document.getElementById('solarLocationGroup');
    const biwheelTimeControls = document.getElementById('biwheelTimeControls');
    const biwheelScaleTicks = document.getElementById('biwheelScaleTicks');
    const isFocusBiwheel = tab === 'biwheel' && ForecastState.isFocusMode;

    dateRange.style.display = 'none';
    singleDate.style.display = 'none';
    solarYear.style.display = 'none';
    solarOrientation.style.display = 'none';
    solarLocation.style.display = 'none';

    if (tab === 'solar') {
        solarYear.style.display = '';
        solarOrientation.style.display = '';
        solarLocation.style.display = '';
    } else if (!isFocusBiwheel && (tab === 'timeline' || tab === 'biwheel' || tab === 'table')) {
        dateRange.style.display = '';
    }

    if (biwheelTimeControls) {
        const showTimeControls = tab === 'biwheel';
        biwheelTimeControls.style.display = showTimeControls ? 'flex' : 'none';
        if (biwheelScaleTicks) biwheelScaleTicks.style.display = showTimeControls ? '' : 'none';
        if (!showTimeControls) stopTransitScalePlayback();
        if (showTimeControls) {
            refreshTransitScale();
        }
    } else {
        if (biwheelScaleTicks) biwheelScaleTicks.style.display = 'none';
        stopTransitScalePlayback();
    }

    if (!hasRenderableCachedForecastState()) {
        setForecastControlsExpanded(true);
    } else {
        applyForecastControlsExpandedState();
    }
    applyForecastFocusState();
}

// ─── Calculate ──────────────────────────────────────────
async function onCalculate() {
    const btn = document.getElementById('btnCalculate');
    const summaryBtn = document.getElementById('forecastSummaryCalculate');
    btn.disabled = true;
    if (summaryBtn) summaryBtn.disabled = true;
    try {
        const tab = ForecastState.currentTab;
        if (tab === 'solar') {
            await calculateSolar();
        } else {
            const forcedMethod = tab === 'timeline' ? 'transits' : null;
            await calculateAllForecastViews(forcedMethod);
            await renderCurrentTabFromCache();
            if (tab === 'biwheel') {
                setForecastFocusMode(true);
            }
        }
        if (isForecastMobileViewport()) {
            setForecastControlsExpanded(false);
        }
    } catch (err) {
        console.error('Forecast error:', err);
        alert(t('common.errorWithMessage', { message: err.message }));
    } finally {
        btn.disabled = false;
        if (summaryBtn) summaryBtn.disabled = false;
        renderForecastSummary();
    }
}

// ─── Navigation (timeline → biwheel) ────────────────────
window.ForecastNavigation = {
    goToBiwheel(dateStr, highlightAspect) {
        const methodSelect = document.getElementById('methodSelect');
        if (methodSelect && methodSelect.value !== 'transits') {
            methodSelect.value = 'transits';
        }
        ForecastState.method = 'transits';
        // Set date inputs
        document.getElementById('startDate').value = dateStr;
        document.getElementById('endDate').value = dateStr;
        document.getElementById('singleDate').value = dateStr;
        ForecastState.pendingBiwheelDate = dateStr;
        // Store highlight info for biwheel to pick up after render
        ForecastState.highlightAspect = highlightAspect || null;
        // Switch to biwheel tab
        activateForecastTab('biwheel', { render: false });
        // Auto-calculate
        onCalculate();
    }
};

// ─── API helpers ────────────────────────────────────────
async function apiPost(endpoint, body) {
    const withLocaleHeaders = window.AstroAPI?.withLocaleHeaders
        ? window.AstroAPI.withLocaleHeaders
        : (headers) => headers;
    const resp = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: withLocaleHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
    });
    if (!resp.ok) {
        let detail = `HTTP ${resp.status}`;
        try {
            const err = await resp.json();
            if (typeof err?.detail === 'string' && err.detail.trim()) {
                detail = err.detail;
            } else if (err?.detail) {
                detail = JSON.stringify(err.detail);
            }
        } catch {
            const text = await resp.text().catch(() => '');
            if (text && text.trim()) {
                detail = text.slice(0, 400);
            }
        }
        throw new Error(detail);
    }
    return resp.json();
}

// ─── Planet priority & groups for filtering ──────────────
const PLANET_PRIORITY = ['Pluto','Neptune','Uranus','Chiron','Saturn','Jupiter','TrueNorthNode','TrueSouthNode','BlackMoon','Proserpina','Mars','Venus','Mercury','Sun','Moon'];

// ─── Timeline filtering & rendering ─────────────────────
function getFilteredTimelineEvents() {
    const data = ForecastState.transitEvents;
    if (!data || !data.events) return [];
    let evts = data.events;
    if (document.getElementById('filterMajor')?.checked) {
        evts = evts.filter(e => e.is_major);
    }

    return evts;
}

function renderTimeline() {
    const rawEvents = getFilteredTimelineEvents();
    const s = document.getElementById('startDate').value;
    const e = document.getElementById('endDate').value;
    const normalized = window.ForecastTimelineUtils?.normalizeTimelineEvents
        ? window.ForecastTimelineUtils.normalizeTimelineEvents(rawEvents, s, e)
        : { events: rawEvents };
    const evts = normalized.events || [];
    const counter = document.getElementById('tlEventCount');
    if (counter) {
        const totalRaw = ForecastState.transitEvents?.events?.length || 0;
        counter.textContent = t('page.forecast.timeline.eventCount', { shown: evts.length, total: totalRaw });
    }
    renderActiveEventsSummary(evts);
    requestAnimationFrame(() => {
        if (window.ForecastTimeline) {
            window.ForecastTimeline.render(evts, s, e);
        }
    });
}

function renderActiveEventsSummary(events) {
    const container = document.getElementById('activeEventsSummary');
    if (!container) return;
    const now = new Date();
    const active = (events || []).filter(ev => {
        const enter = new Date(ev.t_enter);
        const leave = new Date(ev.t_leave);
        return now >= enter && now <= leave;
    });
    if (!active.length) {
        container.innerHTML = `<div class="aes-empty">${t('page.forecast.timeline.activeNow.empty')}</div>`;
        return;
    }
    const chips = active.map(ev => {
        const pSym = Symbols?.planets?.[ev.transit_body] || ev.transit_body;
        const nSym = Symbols?.planets?.[ev.natal_body] || ev.natal_body;
        const aSym = Symbols?.aspects?.[ev.aspect_type] || ev.aspect_type;
        const harmony = getAspectHarmony(ev.aspect_type);
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
    container.innerHTML = `
        <div class="aes-header">⚡ ${t('page.forecast.timeline.activeNow.title')} <span class="aes-count">${active.length}</span></div>
        <div class="aes-chips">${chips.join('')}</div>
    `;
}

async function calculateTimeline() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const data = await ensureTransitPeriodData(startDate, endDate, { showLoading: true });
    ForecastState.transitEvents = data;
    ForecastState.transitPeriodKey = getTransitPeriodKey(startDate, endDate);
    showState('timeline', 'content');
    renderTimeline();
    // Also populate table
    populateTable(data.events, 'transit');
    ForecastState.tableDataKey = getTransitTableKey(startDate, endDate);
}

// ─── Biwheel calculation ────────────────────────────────
async function calculateBiwheel() {
    await calculateAllForecastViews();
}

async function calculateTransitBiwheelAt(dateStr, { showLoading = false } = {}) {
    if (!dateStr) throw new Error(t('page.forecast.errors.transitDateMissing'));
    const requestSeq = ++ForecastState.biwheelRequestSeq;
    if (showLoading) {
        showState('biwheel', 'loading');
    }

    ForecastState.transitBiwheelBusy = true;
    let combinedData;
    try {
        const method = document.getElementById('methodSelect')?.value || ForecastState.method || 'transits';
        const directionType = resolveDirectionTypeForCombined(method);
        combinedData = await ensureCombinedBiwheelData(dateStr, { directionType });
    } finally {
        ForecastState.transitBiwheelBusy = false;
    }

    if (requestSeq !== ForecastState.biwheelRequestSeq) return;

    ForecastState.transitMoment = dateStr;
    ForecastState.pointData = combinedData;
    ForecastState.combinedBiwheelData = combinedData;
    showState('biwheel', 'content');
    renderBiwheelData(combinedData);
    scheduleTransitBiwheelPrewarm(dateStr);
}

// ─── Table calculation ──────────────────────────────────
async function calculateTable() {
    await calculateAllForecastViews();
    showState('table', 'content');
}

function getTransitPeriodKey(startDate, endDate) {
    return `${startDate}|${endDate}`;
}

function getTransitTableKey(startDate, endDate) {
    return `transits|${startDate}|${endDate}`;
}

function getPrognosticPointKey(method, targetDate) {
    return `${method}|${targetDate}`;
}

function getCombinedPointKey(targetDate, directionType) {
    return `combined|${targetDate}|${directionType || 'solar_arc'}`;
}

function getCombinedTableKey(targetDate, directionType, startDate = '', endDate = '') {
    return `combined_table|${targetDate}|${directionType || 'solar_arc'}|${startDate}|${endDate}`;
}

function getIngressSummaryKey(startDate, endDate, directionType) {
    return `ingress_summary|${INGRESS_SUMMARY_CACHE_VERSION}|${startDate}|${endDate}|${directionType || 'solar_arc'}`;
}

function normalizeDirectionType(directionType) {
    const value = String(directionType || '').trim();
    return ['solar_arc', 'symbolic', 'equatorial'].includes(value) ? value : 'solar_arc';
}

function resolveDirectionTypeForCombined(method) {
    if (method && method.startsWith('directions_')) {
        return normalizeDirectionType(method.replace('directions_', ''));
    }
    return normalizeDirectionType(ForecastState.directionType || 'solar_arc');
}

function resolveBiwheelTargetDate(method) {
    if (method === 'transits') {
        const startDate = document.getElementById('startDate')?.value;
        refreshTransitScale(ForecastState.pendingBiwheelDate || ForecastState.transitMoment || startDate);
        const selectedDate = getTransitScaleDateByIndex(ForecastState.transitScaleIndex);
        if (!selectedDate) throw new Error(t('page.forecast.errors.invalidRange'));
        return selectedDate;
    }
    const targetDate = document.getElementById('singleDate')?.value;
    if (!targetDate) throw new Error(t('page.forecast.errors.dateRequired'));
    return targetDate;
}

async function fetchTransitBiwheelData(dateStr) {
    if (!dateStr) throw new Error(t('page.forecast.errors.transitDateMissing'));
    if (ForecastState.transitBiwheelCache[dateStr]) {
        return ForecastState.transitBiwheelCache[dateStr];
    }
    if (ForecastState.transitBiwheelInFlight[dateStr]) {
        return ForecastState.transitBiwheelInFlight[dateStr];
    }

    const requestPromise = apiPost('/transits/calculate', {
        user_id: ForecastState.userId,
        date: dateStr,
        time: '12:00:00',
        timezone: getForecastTimezone(),
    }).then((data) => {
        data._method = 'transits';
        ForecastState.transitBiwheelCache[dateStr] = data;
        return data;
    }).finally(() => {
        delete ForecastState.transitBiwheelInFlight[dateStr];
    });

    ForecastState.transitBiwheelInFlight[dateStr] = requestPromise;
    return requestPromise;
}

function renderBiwheelData(data) {
    if (!window.ForecastBiwheel || !data) return;
    if (window.ForecastBiwheel.setOrientationMode) {
        window.ForecastBiwheel.setOrientationMode(ForecastState.biwheelOrientation);
    }
    window.ForecastBiwheel.render(ForecastState.natalWheelData || ForecastState.natalData, data);
    renderNatalOverlay();
}

async function ensureTransitPeriodData(startDate, endDate, { showLoading = false } = {}) {
    if (!startDate || !endDate) throw new Error(t('page.forecast.errors.datesRequired'));
    const key = getTransitPeriodKey(startDate, endDate);

    if (ForecastState.transitPeriodKey === key && ForecastState.transitEvents) {
        ForecastState.transitCalculatedRange = { start_date: startDate, end_date: endDate };
        return ForecastState.transitEvents;
    }
    if (ForecastState.transitPeriodCache[key]) {
        ForecastState.transitEvents = ForecastState.transitPeriodCache[key];
        ForecastState.transitPeriodKey = key;
        ForecastState.transitCalculatedRange = { start_date: startDate, end_date: endDate };
        return ForecastState.transitEvents;
    }

    if (showLoading) showState('timeline', 'loading');
    const data = await apiPost('/transits/period', {
        user_id: ForecastState.userId,
        start_date: startDate,
        end_date: endDate,
        timezone: getForecastTimezone(),
        step_hours: 6,
    });
    ForecastState.transitPeriodCache[key] = data;
    ForecastState.transitEvents = data;
    ForecastState.transitPeriodKey = key;
    ForecastState.transitCalculatedRange = { start_date: startDate, end_date: endDate };
    return data;
}

async function ensurePrognosticPointData(method, targetDate) {
    if (!targetDate) throw new Error(t('page.forecast.errors.dateRequired'));
    const key = getPrognosticPointKey(method, targetDate);
    if (ForecastState.prognosticPointCache[key]) {
        return ForecastState.prognosticPointCache[key];
    }

    let data;
    if (method === 'progressions') {
        data = await apiPost('/progressions/calculate', {
            user_id: ForecastState.userId,
            target_date: targetDate,
        });
        data._method = 'progressions';
        ForecastState.progressionData = data;
        ForecastState.progressionTargetDate = targetDate;
    } else {
        const dirType = normalizeDirectionType(method.replace('directions_', ''));
        data = await apiPost('/directions/calculate', {
            user_id: ForecastState.userId,
            target_date: targetDate,
            direction_type: dirType,
        });
        data._method = 'directions';
        ForecastState.directionData = data;
        ForecastState.directionTargetDate = targetDate;
        ForecastState.directionType = dirType;
    }
    ForecastState.prognosticPointCache[key] = data;
    return data;
}

async function ensureCombinedBiwheelData(targetDate, { directionType = 'solar_arc' } = {}) {
    if (!targetDate) throw new Error(t('page.forecast.errors.dateRequired'));
    const normalizedDirectionType = normalizeDirectionType(directionType);
    const key = getCombinedPointKey(targetDate, normalizedDirectionType);
    if (ForecastState.combinedBiwheelCache[key]) {
        ForecastState.combinedBiwheelData = ForecastState.combinedBiwheelCache[key];
        return ForecastState.combinedBiwheelData;
    }
    if (ForecastState.combinedBiwheelInFlight[key]) {
        return ForecastState.combinedBiwheelInFlight[key];
    }

    const requestPromise = Promise.all([
        fetchTransitBiwheelData(targetDate),
        ensurePrognosticPointData('progressions', targetDate),
        ensurePrognosticPointData(`directions_${normalizedDirectionType}`, targetDate),
    ]).then(([transitData, progressionData, directionData]) => {
        const combined = {
            _method: 'combined',
            _combined: true,
            _targetDate: targetDate,
            _directionType: normalizedDirectionType,
            _layers: {
                transit: transitData || null,
                progression: progressionData || null,
                direction: directionData || null,
            },
        };
        ForecastState.combinedBiwheelCache[key] = combined;
        ForecastState.combinedBiwheelData = combined;
        ForecastState.transitMoment = targetDate;
        ForecastState.progressionData = progressionData || null;
        ForecastState.progressionTargetDate = targetDate;
        ForecastState.directionData = directionData || null;
        ForecastState.directionTargetDate = targetDate;
        ForecastState.directionType = normalizedDirectionType;
        return combined;
    }).finally(() => {
        delete ForecastState.combinedBiwheelInFlight[key];
    });

    ForecastState.combinedBiwheelInFlight[key] = requestPromise;
    return requestPromise;
}

function resolvePrognosticPeriod(targetDate) {
    const startRaw = document.getElementById('startDate')?.value;
    const endRaw = document.getElementById('endDate')?.value;
    const start = parseInputDate(startRaw);
    const end = parseInputDate(endRaw);
    if (start && end) {
        if (end >= start) {
            return { startDate: formatInputDate(start), endDate: formatInputDate(end) };
        }
        return { startDate: formatInputDate(end), endDate: formatInputDate(start) };
    }
    return { startDate: targetDate, endDate: targetDate };
}

async function ensureIngressSummaryData(startDate, endDate, directionType) {
    if (!startDate || !endDate) {
        ForecastState.ingressSummaryData = null;
        ForecastState.ingressSummaryError = null;
        ForecastState.ingressSummaryKey = null;
        return null;
    }

    const normalizedDirectionType = normalizeDirectionType(directionType);
    const key = getIngressSummaryKey(startDate, endDate, normalizedDirectionType);
    if (ForecastState.ingressSummaryKey === key && ForecastState.ingressSummaryData) {
        return ForecastState.ingressSummaryData;
    }
    if (ForecastState.ingressSummaryCache[key]) {
        ForecastState.ingressSummaryData = ForecastState.ingressSummaryCache[key];
        ForecastState.ingressSummaryError = null;
        ForecastState.ingressSummaryKey = key;
        return ForecastState.ingressSummaryData;
    }
    if (ForecastState.ingressSummaryInFlight[key]) {
        return ForecastState.ingressSummaryInFlight[key];
    }

    const requestPromise = apiPost('/ingresses/period-summary', {
        user_id: ForecastState.userId,
        start_date: startDate,
        end_date: endDate,
        timezone: getForecastTimezone(),
        direction_type: normalizedDirectionType,
    }).then((data) => {
        ForecastState.ingressSummaryCache[key] = data;
        ForecastState.ingressSummaryData = data;
        ForecastState.ingressSummaryError = null;
        ForecastState.ingressSummaryKey = key;
        return data;
    }).catch((err) => {
        ForecastState.ingressSummaryData = null;
        ForecastState.ingressSummaryError = err?.message || t('common.error');
        ForecastState.ingressSummaryKey = key;
        throw err;
    }).finally(() => {
        delete ForecastState.ingressSummaryInFlight[key];
    });

    ForecastState.ingressSummaryInFlight[key] = requestPromise;
    return requestPromise;
}

async function calculateAllForecastViews(forcedMethod = null) {
    const method = forcedMethod || document.getElementById('methodSelect').value;
    const startDate = document.getElementById('startDate')?.value;
    const endDate = document.getElementById('endDate')?.value;
    const needTransitPeriod = method === 'transits';
    if (needTransitPeriod) {
        await ensureTransitPeriodData(startDate, endDate, { showLoading: true });
        if (ForecastState.currentTab === 'timeline') {
            showState('timeline', 'content');
            renderTimeline();
        }
    }

    const targetDate = resolveBiwheelTargetDate(method);
    const directionType = resolveDirectionTypeForCombined(method);
    const period = resolvePrognosticPeriod(targetDate);
    showState('biwheel', 'loading');
    const combinedData = await ensureCombinedBiwheelData(targetDate, { directionType });
    ForecastState.pointData = combinedData;
    try {
        await ensureIngressSummaryData(period.startDate, period.endDate, directionType);
    } catch (err) {
        console.error('Ingress summary load error:', err);
    }
    renderBiwheelData(combinedData);
    showState('biwheel', 'content');
    if (method === 'transits') {
        scheduleCombinedPeriodPrewarm(directionType);
    }

    populateTableFromCombinedData(combinedData, targetDate, {
        transitPeriodEvents: needTransitPeriod ? (ForecastState.transitEvents?.events || []) : [],
    });
    ForecastState.tableDataKey = getCombinedTableKey(
        targetDate,
        directionType,
        method === 'transits' ? startDate : '',
        method === 'transits' ? endDate : ''
    );
    showState('table', 'content');

    if (method === 'transits') {
        scheduleForecastStatePersist();
        return;
    }

    if (method === 'progressions') {
        scheduleForecastStatePersist();
        return;
    }

    scheduleForecastStatePersist();
}

function rebuildTableFromCachedState(method) {
    if (method === 'transits') {
        const startDate = document.getElementById('startDate')?.value;
        const endDate = document.getElementById('endDate')?.value;
        const directionType = resolveDirectionTypeForCombined(method);
        let selectedDate = ForecastState.transitMoment || startDate;
        refreshTransitScale(ForecastState.pendingBiwheelDate || selectedDate || startDate);
        selectedDate = getTransitScaleDateByIndex(ForecastState.transitScaleIndex) || selectedDate;

        const transitKey = getTransitTableKey(startDate, endDate);
        const combinedKey = getCombinedTableKey(selectedDate, directionType, startDate, endDate);
        const combinedData = ForecastState.combinedBiwheelCache[getCombinedPointKey(selectedDate, directionType)]
            || ForecastState.combinedBiwheelData;
        const transitPeriodEvents = ForecastState.transitEvents?.events || [];

        if (ForecastState.tableDataKey === transitKey && transitPeriodEvents.length) {
            populateTable(transitPeriodEvents, 'transit');
            ForecastState.tableDataKey = transitKey;
            return true;
        }

        if (combinedData) {
            populateTableFromCombinedData(combinedData, selectedDate, { transitPeriodEvents });
            ForecastState.tableDataKey = combinedKey;
            return true;
        }

        if (transitPeriodEvents.length) {
            populateTable(transitPeriodEvents, 'transit');
            ForecastState.tableDataKey = transitKey;
            return true;
        }

        return false;
    }

    const targetDate = document.getElementById('singleDate')?.value;
    if (!targetDate) return false;

    if (method === 'progressions' && ForecastState.progressionData) {
        populateTableFromPrognosticData(ForecastState.progressionData, method, targetDate);
        ForecastState.tableDataKey = getPrognosticPointKey(method, targetDate);
        return true;
    }

    if (method.startsWith('directions_') && ForecastState.directionData) {
        populateTableFromPrognosticData(ForecastState.directionData, method, targetDate);
        ForecastState.tableDataKey = getPrognosticPointKey(method, targetDate);
        return true;
    }

    const directionType = resolveDirectionTypeForCombined(method);
    const combinedData = ForecastState.combinedBiwheelCache[getCombinedPointKey(targetDate, directionType)]
        || ForecastState.combinedBiwheelData;
    if (!combinedData) return false;

    populateTableFromCombinedData(combinedData, targetDate);
    ForecastState.tableDataKey = getCombinedTableKey(targetDate, directionType);
    return true;
}

async function renderCurrentTabFromCache() {
    const tab = ForecastState.currentTab;
    const method = document.getElementById('methodSelect').value;
    if (tab === 'solar') {
        if (ForecastState.solarData) {
            showState('solar', 'content');
            renderSolar(ForecastState.solarData);
        } else {
            const year = parseInt(document.getElementById('solarYear').value, 10);
            const lat = parseFloat(document.getElementById('solarLocationLat')?.value);
            const lon = parseFloat(document.getElementById('solarLocationLon')?.value);
            const name = document.getElementById('solarLocationName')?.value?.trim() || '';
            const timezone = document.getElementById('solarLocationTimezone')?.value?.trim() || '';
            const key = getSolarCacheKey(year, lat, lon, name, timezone);
            const cached = ForecastState.solarCache[key];
            if (cached) {
                ForecastState.solarData = cached;
                ForecastState.solarCalculatedYear = year;
                showState('solar', 'content');
                renderSolar(cached);
            } else {
                showState('solar', 'empty');
            }
        }
        return;
    }

    if (tab === 'timeline') {
        if (ForecastState.transitEvents) {
            showState('timeline', 'content');
            renderTimeline();
        } else {
            showState('timeline', 'empty');
        }
        return;
    }

    if (tab === 'biwheel') {
        const directionType = resolveDirectionTypeForCombined(method);
        let targetDate = null;
        try {
            targetDate = resolveBiwheelTargetDate(method);
        } catch {
            showState('biwheel', 'empty');
            return;
        }
        const key = getCombinedPointKey(targetDate, directionType);
        const data = ForecastState.combinedBiwheelCache[key];
        if (data) {
            ForecastState.pointData = data;
            showState('biwheel', 'content');
            renderBiwheelData(data);
            if (method === 'transits') {
                scheduleTransitBiwheelPrewarm(targetDate);
            }
        } else {
            showState('biwheel', 'empty');
        }
        return;
    }

    if (tab === 'table') {
        let expectedKeys = [];
        if (method === 'transits') {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            const directionType = resolveDirectionTypeForCombined(method);
            let selectedDate = ForecastState.transitMoment || startDate;
            refreshTransitScale(ForecastState.pendingBiwheelDate || selectedDate || startDate);
            selectedDate = getTransitScaleDateByIndex(ForecastState.transitScaleIndex) || selectedDate;
            expectedKeys = [
                getTransitTableKey(startDate, endDate),
                getCombinedTableKey(selectedDate, directionType, startDate, endDate),
            ];
        } else {
            const targetDate = document.getElementById('singleDate').value;
            const directionType = resolveDirectionTypeForCombined(method);
            expectedKeys = [
                getCombinedTableKey(targetDate, directionType),
                getPrognosticPointKey(method, targetDate),
            ];
        }

        if (ForecastState.tableDataKey && expectedKeys.includes(ForecastState.tableDataKey)) {
            showState('table', 'content');
            if (ForecastState.tableRowsRaw.length) {
                if (ForecastState.tableRows.length) renderTableRows();
                else applyTableFiltersAndRender();
            } else if (!rebuildTableFromCachedState(method)) {
                document.getElementById('tableBody').innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-secondary)">${t('page.forecast.table.noData')}</td></tr>`;
            }
        } else if (ForecastState.tableRowsRaw.length && ForecastState.tableDataKey) {
            showState('table', 'content');
            if (ForecastState.tableRows.length) renderTableRows();
            else applyTableFiltersAndRender();
        } else if (rebuildTableFromCachedState(method)) {
            showState('table', 'content');
        } else {
            showState('table', 'empty');
        }
    }
}

// ─── Solar calculation ──────────────────────────────────
async function calculateSolar() {
    showState('solar', 'loading');
    const year = parseInt(document.getElementById('solarYear').value, 10);
    if (!year || year < 1900 || year > 2100) throw new Error(t('page.forecast.errors.yearRange'));
    localStorage.setItem(SOLAR_YEAR_STORAGE_KEY, String(year));

    // Build request payload
    const payload = {
        user_id: ForecastState.userId,
        year: year,
        save_to_db: false,
    };

    const lat = parseFloat(document.getElementById('solarLocationLat').value);
    const lon = parseFloat(document.getElementById('solarLocationLon').value);
    const name = document.getElementById('solarLocationName').value?.trim();
    const sourceId = document.getElementById('solarLocationSourceId').value?.trim();
    const locationTimezone = document.getElementById('solarLocationTimezone').value?.trim();
    if (!isNaN(lat) && !isNaN(lon)) {
        payload.location_latitude = lat;
        payload.location_longitude = lon;
        if (name) payload.location_name = name;
        if (sourceId) payload.location_source_id = sourceId;
        if (locationTimezone) payload.location_timezone = locationTimezone;
        persistSolarLocationToStorage();
    } else {
        throw new Error(t('page.forecast.errors.selectLocationFromList'));
    }

    const cacheKey = getSolarCacheKey(year, lat, lon, name || '', locationTimezone || '');
    const cached = ForecastState.solarCache[cacheKey];
    if (cached) {
        ForecastState.solarData = cached;
        ForecastState.solarCalculatedYear = year;
        showState('solar', 'content');
        renderSolar(cached);
        scheduleForecastStatePersist();
        return;
    }

    const data = await apiPost('/solar/calculate', payload);
    ForecastState.solarCache[cacheKey] = data;
    ForecastState.solarData = data;
    ForecastState.solarCalculatedYear = year;
    showState('solar', 'content');
    renderSolar(data);
    scheduleForecastStatePersist();
}

function renderSolar(data) {
    // Info bar
    const infoBar = document.getElementById('solarInfoBar');
    const si = data.solar_info;
    infoBar.innerHTML = `
        <div class="solar-info-item"><div class="si-label">${t('common.year')}</div><div class="si-value">${si.year}</div></div>
        <div class="solar-info-item"><div class="si-label">${t('page.forecast.solar.info.utcDate')}</div><div class="si-value">${si.solar_datetime_utc}</div></div>
        <div class="solar-info-item"><div class="si-label">${t('page.forecast.solar.info.localDate')}</div><div class="si-value">${si.solar_datetime_local}</div></div>
        <div class="solar-info-item"><div class="si-label">${t('common.location')}</div><div class="si-value">${si.location?.name || t('common.notAvailable')}</div></div>
    `;
    renderSolarChart(data);
    // Planets table
    renderSolarPlanetsTable(data);
}

function renderSolarChart(data) {
    const svg = document.getElementById('solarWheel');
    if (!svg) return;
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    if (!ForecastState.solarWheel) {
        ForecastState.solarWheel = new ChartWheel(svg);
    }
    if (typeof ForecastState.solarWheel.setPointScale === 'function') {
        ForecastState.solarWheel.setPointScale(ForecastState.solarPointScale, { redraw: false });
    }
    ForecastState.solarWheel.setOrientationMode(ForecastState.solarOrientation, { redraw: false });
    ForecastState.solarWheel.draw({
        planets: data.planets,
        houses: data.houses,
        angles: data.angles,
        aspects: Array.isArray(data?.aspects) ? data.aspects : [],
    });
    applySolarAspectFocus();
    resetSolarView();
}

function renderSolarPlanetsTable(data) {
    const renderer = getSolarDataRenderer();
    if (!renderer) return;

    renderer.render({
        planets: Array.isArray(data?.planets) ? data.planets : [],
        aspects: Array.isArray(data?.aspects) ? data.aspects : [],
        houses: [],
        aspect_configurations: [],
        stelliums: [],
        balances: null,
        cosmogram_pattern: null,
    });
    syncSolarHoveredAspectToActiveSurface();
}

// ─── UI Helpers ─────────────────────────────────────────
function showState(pane, state) {
    // state: 'empty', 'loading', 'content'
    const empty = document.getElementById(`${pane}Empty`);
    const loading = document.getElementById(`${pane}Loading`);
    const content = document.getElementById(`${pane}Container`);

    if (empty) empty.style.display = state === 'empty' ? '' : 'none';
    if (loading) loading.style.display = state === 'loading' ? '' : 'none';
    if (content) content.style.display = state === 'content' ? '' : 'none';

    // Special: timeline legend
    if (pane === 'timeline') {
        const legend = document.getElementById('timelineLegend');
        if (legend) legend.style.display = state === 'content' ? '' : 'none';
    }
    // Table special
    if (pane === 'table') {
        const tc = document.getElementById('tableContainer');
        if (tc) tc.style.display = state === 'content' ? '' : 'none';
        const te = document.getElementById('tableEmpty');
        if (te) te.style.display = state === 'empty' ? '' : 'none';
    }

    renderForecastSummary();
}

// ─── Aspect classification helpers ──────────────────────
function getAspectHarmony(aspectType) {
    const harmonious = ['Trine', 'Sextile'];
    const tense = ['Square', 'Opposition'];
    const neutral = ['Conjunction'];
    if (harmonious.includes(aspectType)) return 'harmonious';
    if (tense.includes(aspectType)) return 'tense';
    if (neutral.includes(aspectType)) return 'neutral';
    return 'minor';
}

function getMethodLabel(method) {
    const map = {
        'transit': t('common.method.transit'),
        'transits': t('common.method.transit'),
        'progressions': t('common.method.progression'),
        'directions': t('common.method.direction'),
        'directions_solar_arc': t('common.method.directionSolarArc'),
        'directions_symbolic': t('common.method.directionSymbolic'),
        'directions_equatorial': t('common.method.directionNaibod'),
    };
    return map[method] || method;
}

function toggleTableFilters(forceOpen = null) {
    const panel = document.getElementById('tableFilters');
    const btn = document.getElementById('tableFiltersToggle');
    if (!panel || !btn) return;
    const isCollapsed = panel.classList.contains('table-filters-collapsed');
    const shouldOpen = forceOpen === null ? isCollapsed : !!forceOpen;
    panel.classList.toggle('table-filters-collapsed', !shouldOpen);
    btn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    btn.textContent = shouldOpen
        ? t('page.forecast.table.filters.buttonOpen')
        : t('page.forecast.table.filters.buttonClosed');
}

function updateTableFiltersBadge() {
    const badge = document.getElementById('tableFiltersCount');
    if (!badge) return;
    let active = 0;
    if ((document.getElementById('tableFilterKind')?.value || 'all') !== 'all') active += 1;
    if ((document.getElementById('tableFilterStrength')?.value || 'all') !== 'all') active += 1;
    if ((document.getElementById('tableFilterAspect')?.value || 'all') !== 'all') active += 1;
    if ((document.getElementById('tableFilterMaxOrb')?.value || '').trim()) active += 1;
    if ((document.getElementById('tableFilterSearch')?.value || '').trim()) active += 1;
    badge.textContent = String(active);
    badge.style.display = active > 0 ? '' : 'none';
}

function resetTableFilters() {
    const kind = document.getElementById('tableFilterKind');
    const strength = document.getElementById('tableFilterStrength');
    const aspect = document.getElementById('tableFilterAspect');
    const maxOrb = document.getElementById('tableFilterMaxOrb');
    const search = document.getElementById('tableFilterSearch');
    if (kind) kind.value = 'all';
    if (strength) strength.value = 'all';
    if (aspect) aspect.value = 'all';
    if (maxOrb) maxOrb.value = '';
    if (search) search.value = '';
    updateTableFiltersBadge();
}

function refreshTableAspectFilterOptions(rows) {
    const aspectSelect = document.getElementById('tableFilterAspect');
    if (!aspectSelect) return;
    const current = aspectSelect.value || 'all';
    const uniq = [...new Set((rows || []).map(r => r.aspect).filter(Boolean))].sort();
    aspectSelect.innerHTML = [`<option value="all">${t('common.all')}</option>`]
        .concat(uniq.map(a => `<option value="${a}">${a}</option>`))
        .join('');
    aspectSelect.value = uniq.includes(current) ? current : 'all';
}

function applyTableFiltersAndRender() {
    const raw = ForecastState.tableRowsRaw || [];
    const kind = document.getElementById('tableFilterKind')?.value || 'all';
    const strength = document.getElementById('tableFilterStrength')?.value || 'all';
    const aspect = document.getElementById('tableFilterAspect')?.value || 'all';
    const maxOrbRaw = document.getElementById('tableFilterMaxOrb')?.value?.trim();
    const search = (document.getElementById('tableFilterSearch')?.value || '').trim().toLowerCase();
    const maxOrb = maxOrbRaw ? parseFloat(maxOrbRaw) : null;

    let rows = raw.filter(r => {
        if (kind !== 'all' && r.rowKind !== kind) return false;
        if (strength === 'major' && !r.isMajor) return false;
        if (strength === 'minor' && r.isMajor !== false) return false;
        if (aspect !== 'all' && r.aspect !== aspect) return false;
        if (maxOrb !== null) {
            if (!(r.hasOrb && typeof r.orb === 'number' && r.orb <= maxOrb)) return false;
        }
        if (search) {
            const haystack = [
                r.transit, r.natal, r.aspect, r.type, r.transitDisplay, r.natalDisplay
            ].filter(Boolean).join(' ').toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        return true;
    });

    ForecastState.tableRows = rows;
    updateTableFiltersBadge();
    renderTableRows();
}

// ─── Populate table from transit events ─────────────────
function populateTable(events, method) {
    hideIngressSection();
    showState('table', 'content');
    if (!events || events.length === 0) {
        document.getElementById('tableBody').innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-secondary)">${t('page.forecast.table.noEvents')}</td></tr>`;
        ForecastState.tableRowsRaw = [];
        ForecastState.tableRows = [];
        return;
    }
    const natalRetroMap = new Map((ForecastState.natalData?.planets || [])
        .filter((p) => p?.name)
        .map((p) => [p.name, Boolean(p.retrograde)]));
    ForecastState.tableRowsRaw = events.map(ev => ({
        date: ev.t_exact ? ev.t_exact.split('T')[0] : '—',
        method: getMethodLabel(method),
        methodClass: 'transit',
        transit: ev.transit_body,
        aspect: ev.aspect_type,
        natal: ev.natal_body,
        orb: ev.min_orb ?? 99,
        hasOrb: typeof ev.min_orb === 'number',
        isMajor: !!ev.is_major,
        rowKind: 'aspect',
        type: ev.is_major ? t('common.majorShort') : t('common.minorShort'),
        transitRetrograde: typeof ev.transit_retrograde === 'boolean' ? ev.transit_retrograde : null,
        natalRetrograde: natalRetroMap.has(ev.natal_body) ? natalRetroMap.get(ev.natal_body) : null,
    }));
    refreshTableAspectFilterOptions(ForecastState.tableRowsRaw);
    resetTableFilters();
    applyTableFiltersAndRender();
}

// ─── Populate table from aspect list (progressions/directions) ─
function populateTableFromAspects(aspects, method, date) {
    hideIngressSection();
    showState('table', 'content');
    if (!aspects || aspects.length === 0) {
        document.getElementById('tableBody').innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-secondary)">${t('page.forecast.table.noAspects')}</td></tr>`;
        ForecastState.tableRowsRaw = [];
        ForecastState.tableRows = [];
        return;
    }
    const natalRetroMap = new Map((ForecastState.natalData?.planets || [])
        .filter((p) => p?.name)
        .map((p) => [p.name, Boolean(p.retrograde)]));
    const methodClass = method.startsWith('directions') ? 'direction' : 'progression';
    ForecastState.tableRowsRaw = aspects.map(a => {
        const body = a.progressed_planet || a.directed_object || '—';
        const idx = PLANET_PRIORITY.indexOf(body);
        return {
            date: date,
            method: getMethodLabel(method),
            methodClass,
            transit: body,
            aspect: a.aspect_type,
            natal: a.natal_object || '—',
            orb: a.orb ?? 99,
            hasOrb: typeof a.orb === 'number',
            isMajor: !!a.is_major,
            rowKind: 'aspect',
            type: a.is_major ? t('common.majorShort') : t('common.minorShort'),
            _priority: idx < 0 ? 999 : idx,
            transitRetrograde: typeof a.transit_retrograde === 'boolean'
                ? a.transit_retrograde
                : (typeof a.retrograde === 'boolean' ? a.retrograde : null),
            natalRetrograde: natalRetroMap.has(a.natal_object) ? natalRetroMap.get(a.natal_object) : null,
        };
    });
    // Sort: slow planets first, then by orb
    ForecastState.tableRowsRaw.sort((a, b) => a._priority - b._priority || a.orb - b.orb);
    refreshTableAspectFilterOptions(ForecastState.tableRowsRaw);
    resetTableFilters();
    applyTableFiltersAndRender();
}

function formatSignLabel(sign) {
    if (!sign) return t('common.notAvailable');
    const sym = Symbols?.signs?.[sign] || '';
    const ru = getSignName(sign);
    return `${sym ? sym + ' ' : ''}${ru}`;
}

let tableIngressHoverTooltip = null;

function formatDateShort6(value) {
    const raw = String(value || '').trim();
    if (!raw || raw === '—') return '—';
    const direct = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (direct) return `${direct[3]}.${direct[2]}.${direct[1].slice(2)}`;
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return raw;
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yy = String(dt.getFullYear()).slice(-2);
    return `${dd}.${mm}.${yy}`;
}

function formatIngressHoverValue(value, ingressType) {
    if (value === null || value === undefined || value === '') return '—';
    if (ingressType === 'house' && Number.isFinite(Number(value))) {
        return `H${value}`;
    }
    if (ingressType === 'sign' && typeof value === 'string') {
        const symbol = Symbols?.signs?.[value] || '';
        const name = getSignName(value);
        return `${symbol ? `${symbol} ` : ''}${name}`.trim();
    }
    return String(value);
}

function formatLegacyIngressHoverLine(line) {
    const safe = escapeHtml(String(line || ''));
    return safe.replace(/(\d{4}-\d{2}-\d{2})/g, (_, match) => formatDateShort6(match));
}

function buildIngressHoverHtml(row) {
    const details = Array.isArray(row.hoverDetails) ? row.hoverDetails : [];
    if (details.length) {
        const blocks = details.map((detail) => {
            const ingressType = detail?.ingress_type || 'none';
            if (ingressType === 'none') {
                const fromLabel = formatIngressHoverValue(detail?.from, ingressType);
                const toLabel = formatIngressHoverValue(detail?.to, ingressType);
                const periodStart = formatDateShort6(detail?.times?.before);
                const periodEnd = formatDateShort6(detail?.times?.exact);
                return `<div class="bw-hover-item">
                    <div class="bw-hover-head">${escapeHtml(t('page.forecast.table.noEvents') || 'No intermediate transitions')}.</div>
                    <div class="bw-hover-times">${escapeHtml(periodStart)} → ${escapeHtml(periodEnd)}</div>
                    <div class="bw-hover-times">${escapeHtml(fromLabel)} → ${escapeHtml(toLabel)}</div>
                </div>`;
            }
            const label = ingressType === 'house'
                ? t('page.forecast.table.ingress.house')
                : ingressType === 'sign'
                    ? t('page.forecast.table.ingress.sign')
                    : t('page.forecast.table.columns.transition');
            const fromLabel = formatIngressHoverValue(detail?.from, ingressType);
            const toLabel = formatIngressHoverValue(detail?.to, ingressType);
            const before = formatDateShort6(detail?.times?.before);
            const exact = formatDateShort6(detail?.times?.exact);
            const after = formatDateShort6(detail?.times?.after);
            return `<div class="bw-hover-item">
                <div class="bw-hover-head">${escapeHtml(label)}: ${escapeHtml(fromLabel)} → ${escapeHtml(toLabel)}</div>
                <div class="bw-hover-times">-1° ${escapeHtml(before)} · 0° ${escapeHtml(exact)} · +1° ${escapeHtml(after)}</div>
            </div>`;
        }).join('');
        return `<div class="bw-hover-wrap">${blocks}</div>`;
    }

    const lines = Array.isArray(row.hoverLines) ? row.hoverLines.filter(Boolean) : [];
    if (!lines.length) return '';
    return `<div class="bw-hover-wrap">${lines.map((line) => `<div class="bw-hover-item"><div class="bw-hover-head">${formatLegacyIngressHoverLine(line)}</div></div>`).join('')}</div>`;
}

function ensureTableIngressTooltip() {
    if (tableIngressHoverTooltip && tableIngressHoverTooltip.isConnected) return tableIngressHoverTooltip;
    tableIngressHoverTooltip = document.body?.querySelector('.chart-tooltip.table-ingress-tooltip');
    if (!tableIngressHoverTooltip) {
        tableIngressHoverTooltip = document.createElement('div');
        tableIngressHoverTooltip.className = 'chart-tooltip table-ingress-tooltip';
        document.body?.appendChild(tableIngressHoverTooltip);
    }
    return tableIngressHoverTooltip;
}

function placeTableIngressTooltip(event, tooltip) {
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

function showTableIngressTooltip(html, event) {
    const tooltip = ensureTableIngressTooltip();
    if (!tooltip) return;
    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    placeTableIngressTooltip(event, tooltip);
}

function hideTableIngressTooltip() {
    const tooltip = ensureTableIngressTooltip();
    if (tooltip) tooltip.style.display = 'none';
}

function bindIngressHoverTooltips(container) {
    if (!container) return;
    container.querySelectorAll('.table-ingress-transition-hover').forEach((node) => {
        const getHoverHtml = () => {
            const raw = node.getAttribute('data-hover-html') || '';
            if (!raw) return '';
            try {
                return decodeURIComponent(raw);
            } catch {
                return raw;
            }
        };
        node.addEventListener('mouseenter', (event) => {
            const html = getHoverHtml();
            if (!html) return;
            showTableIngressTooltip(html, event);
        });
        node.addEventListener('mousemove', (event) => {
            const tooltip = ensureTableIngressTooltip();
            if (!tooltip || tooltip.style.display === 'none') return;
            placeTableIngressTooltip(event, tooltip);
        });
        node.addEventListener('mouseleave', hideTableIngressTooltip);
    });
}

function normalizeIngressSummaryMethodKey(method) {
    const raw = String(method || '');
    if (raw.startsWith('directions')) return 'directions';
    if (raw.startsWith('progressions')) return 'progressions';
    return raw;
}

function getIngressSummaryRow(method, objectKey) {
    const rows = ForecastState.ingressSummaryData?.rows;
    if (!Array.isArray(rows) || !rows.length || !objectKey) return null;
    const normalizedMethod = normalizeIngressSummaryMethodKey(method);
    return rows.find((row) => (
        normalizeIngressSummaryMethodKey(row?.method) === normalizedMethod
        && String(row?.object_key || row?.object || '') === String(objectKey)
    )) || null;
}

function buildIngressRowsFromSummary() {
    const rows = ForecastState.ingressSummaryData?.rows;
    if (!Array.isArray(rows) || !rows.length) return [];
    return rows.flatMap((row) => {
        const methodKey = row.method || '';
        const methodClass = row.method_class || (methodKey === 'progressions' ? 'progression' : 'direction');
        const hoverDetails = Array.isArray(row.hover_details) ? row.hover_details : [];
        let object = row.object || '—';
        let objectHtml = escapeHtml(object);
        if (row.object_key && !String(row.object_key).startsWith('Cusp')) {
            object = getPlanetName(row.object_key);
            objectHtml = formatPlanetCellHtml(row.object_key);
        } else if (row.object_key?.startsWith('Cusp')) {
            const houseNumber = String(row.object_key).replace('Cusp', '');
            object = t('page.forecast.table.ingress.cuspLabel', { house: houseNumber });
            objectHtml = escapeHtml(object);
        }
        const makeRow = (details, ingressType, transition) => ({
            date: details[0]?.times?.exact || '—',
            method: getMethodLabel(methodKey),
            methodClass,
            object,
            objectHtml,
            ingressType,
            transition,
            hoverDetails: details,
            hoverLines: details.map((item) => item?.text).filter(Boolean),
        });

        if (row.object_key && String(row.object_key).startsWith('Cusp')) {
            const signDetails = hoverDetails.filter((item) => item?.ingress_type === 'sign');
            if (!signDetails.length) return [];
            const first = signDetails[0];
            const last = signDetails[signDetails.length - 1];
            return [makeRow(
                signDetails,
                t('page.forecast.table.ingress.cusp'),
                `${formatSignLabel(first?.from)} → ${formatSignLabel(last?.to)}`
            )];
        }

        const signDetails = hoverDetails.filter((item) => item?.ingress_type === 'sign');
        const houseDetails = hoverDetails.filter((item) => item?.ingress_type === 'house');
        const result = [];
        if (signDetails.length) {
            const first = signDetails[0];
            const last = signDetails[signDetails.length - 1];
            result.push(makeRow(
                signDetails,
                t('page.forecast.table.ingress.sign'),
                `${formatSignLabel(first?.from)} → ${formatSignLabel(last?.to)}`
            ));
        }
        if (houseDetails.length) {
            const first = houseDetails[0];
            const last = houseDetails[houseDetails.length - 1];
            result.push(makeRow(
                houseDetails,
                t('page.forecast.table.ingress.house'),
                `${t('page.forecast.table.houseLabel', { house: first?.from ?? t('common.notAvailable') })} → ${t('page.forecast.table.houseLabel', { house: last?.to ?? t('common.notAvailable') })}`
            ));
        }
        return result;
    });
}

function hideIngressSection() {
    const section = document.getElementById('ingressSection');
    const tbody = document.getElementById('ingressTableBody');
    if (section) section.style.display = 'none';
    if (tbody) tbody.innerHTML = '';
    hideTableIngressTooltip();
}

function renderIngressSection(rows) {
    const section = document.getElementById('ingressSection');
    const tbody = document.getElementById('ingressTableBody');
    if (!section || !tbody) return;
    if (!rows || !rows.length) {
        section.style.display = 'none';
        tbody.innerHTML = '';
        hideTableIngressTooltip();
        return;
    }
    tbody.innerHTML = rows.map(r => {
        const hoverHtml = buildIngressHoverHtml(r);
        const transitionHtml = hoverHtml
            ? `<span class="table-ingress-transition-hover" data-hover-html="${encodeURIComponent(hoverHtml)}">${escapeHtml(r.transition || '')}</span>`
            : escapeHtml(r.transition || '');
        return `
        <tr>
            <td>${escapeHtml(r.date || '—')}</td>
            <td><span class="method-badge ${escapeHtml(r.methodClass || '')}">${escapeHtml(r.method || '—')}</span></td>
            <td>${r.objectHtml || escapeHtml(r.object || '—')}</td>
            <td>${escapeHtml(r.ingressType || '—')}</td>
            <td>${transitionHtml}</td>
        </tr>
    `;
    }).join('');
    section.style.display = '';
    bindIngressHoverTooltips(tbody);
}

function populateTableFromPrognosticData(data, method, date) {
    const aspects = data?.aspects_to_natal || [];
    const planetIngresses = data?.planet_ingresses || [];
    const cuspIngresses = data?.house_cusp_ingresses || [];
    const methodClass = method.startsWith('directions') ? 'direction' : 'progression';
    const ingressRows = [];
    const prognosticPlanets = Array.isArray(data?.progressed_planets)
        ? data.progressed_planets
        : Array.isArray(data?.directed_planets)
            ? [
                ...data.directed_planets,
                ...(Array.isArray(data?.directed_angles) ? data.directed_angles : []),
                ...(Array.isArray(data?.directed_special_points) ? data.directed_special_points : []),
            ]
            : [];
    const prognosticRetroMap = new Map(prognosticPlanets
        .filter((p) => p?.name)
        .map((p) => [p.name, Boolean(p.retrograde)]));
    const natalRetroMap = new Map((ForecastState.natalData?.planets || [])
        .filter((p) => p?.name)
        .map((p) => [p.name, Boolean(p.retrograde)]));

    const aspectRows = aspects.map(a => {
        const body = a.progressed_planet || a.directed_object || '—';
        const idx = PLANET_PRIORITY.indexOf(body);
        return {
            date: date,
            method: getMethodLabel(method),
            methodClass,
            transit: body,
            aspect: a.aspect_type,
            natal: a.natal_object || '—',
            orb: a.orb ?? 99,
            hasOrb: typeof a.orb === 'number',
            isMajor: !!a.is_major,
            rowKind: 'aspect',
            type: a.is_major ? t('common.majorShort') : t('common.minorShort'),
            _priority: idx < 0 ? 999 : idx,
            transitRetrograde: prognosticRetroMap.has(body) ? prognosticRetroMap.get(body) : null,
            natalRetrograde: natalRetroMap.has(a.natal_object) ? natalRetroMap.get(a.natal_object) : null,
        };
    });

    planetIngresses.forEach(ing => {
        const body = ing.body || '—';
        const objectKey = body;
        const summaryRow = getIngressSummaryRow(method, objectKey);
        const ingressType = ing.ingress_type === 'house' ? t('page.forecast.table.ingress.house') : t('page.forecast.table.ingress.sign');
        const fromLabel = ing.ingress_type === 'house'
            ? t('page.forecast.table.houseLabel', { house: ing.from_house ?? t('common.notAvailable') })
            : formatSignLabel(ing.from_sign);
        const toLabel = ing.ingress_type === 'house'
            ? t('page.forecast.table.houseLabel', { house: ing.to_house ?? t('common.notAvailable') })
            : formatSignLabel(ing.to_sign);
        ingressRows.push({
            date: date,
            method: getMethodLabel(method),
            methodClass,
            object: body,
            objectHtml: formatPlanetCellHtml(body, prognosticRetroMap.get(body) === true),
            ingressType,
            transition: `${fromLabel} → ${toLabel}`,
            hoverDetails: Array.isArray(summaryRow?.hover_details) ? summaryRow.hover_details : [],
            hoverLines: Array.isArray(summaryRow?.hover_lines) ? summaryRow.hover_lines : [],
        });
    });

    cuspIngresses.forEach(ing => {
        const houseLabel = t('page.forecast.table.ingress.cuspLabel', { house: ing.house_number });
        const summaryRow = getIngressSummaryRow(method, `Cusp${ing.house_number}`);
        const fromLabel = formatSignLabel(ing.from_sign);
        const toLabel = formatSignLabel(ing.to_sign);
        ingressRows.push({
            date: date,
            method: getMethodLabel(method),
            methodClass,
            object: houseLabel,
            objectHtml: escapeHtml(houseLabel),
            ingressType: t('page.forecast.table.ingress.cusp'),
            transition: `${fromLabel} → ${toLabel}`,
            hoverDetails: Array.isArray(summaryRow?.hover_details) ? summaryRow.hover_details : [],
            hoverLines: Array.isArray(summaryRow?.hover_lines) ? summaryRow.hover_lines : [],
        });
    });

    if (aspectRows.length === 0) {
        document.getElementById('tableBody').innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-secondary)">${t('page.forecast.table.noAspects')}</td></tr>`;
        ForecastState.tableRowsRaw = [];
        ForecastState.tableRows = [];
        refreshTableAspectFilterOptions([]);
        resetTableFilters();
        updateTableFiltersBadge();
    } else {
        ForecastState.tableRowsRaw = aspectRows.sort((a, b) => a._priority - b._priority || a.orb - b.orb);
        refreshTableAspectFilterOptions(ForecastState.tableRowsRaw);
        resetTableFilters();
        applyTableFiltersAndRender();
    }

    const summaryIngressRows = buildIngressRowsFromSummary();
    renderIngressSection(summaryIngressRows.length ? summaryIngressRows : ingressRows);
}

function populateTableFromCombinedData(combinedData, targetDate, { transitPeriodEvents = [] } = {}) {
    const layers = combinedData?._layers || {};
    const transitLayer = layers.transit || null;
    const progressionLayer = layers.progression || null;
    const directionLayer = layers.direction || null;
    const directionType = normalizeDirectionType(combinedData?._directionType || ForecastState.directionType || 'solar_arc');

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

    const buildRetroMap = (planets = []) => {
        const map = new Map();
        (planets || []).forEach((planet) => {
            if (!planet?.name) return;
            map.set(planet.name, Boolean(planet.retrograde));
        });
        return map;
    };

    const natalRetroMap = buildRetroMap(ForecastState.natalData?.planets || []);
    const methodRetroMaps = {
        transits: buildRetroMap(collectLayerPlanets(transitLayer)),
        progressions: buildRetroMap(collectLayerPlanets(progressionLayer)),
        directions_solar_arc: buildRetroMap(collectLayerPlanets(directionLayer)),
        directions_symbolic: buildRetroMap(collectLayerPlanets(directionLayer)),
        directions_equatorial: buildRetroMap(collectLayerPlanets(directionLayer)),
    };

    const resolveTransitRetrograde = (methodName, bodyName, fallback = null) => {
        if (typeof fallback === 'boolean') return fallback;
        const map = methodRetroMaps[methodName];
        if (!map || !bodyName) return null;
        return map.has(bodyName) ? map.get(bodyName) : null;
    };

    const resolveNatalRetrograde = (bodyName) => {
        if (!bodyName) return null;
        return natalRetroMap.has(bodyName) ? natalRetroMap.get(bodyName) : null;
    };

    const rows = [];
    const ingressRows = [];
    const pushAspectRow = ({
        date,
        method,
        methodClass,
        transit,
        aspect,
        natal,
        orb,
        isMajor,
        transitRetrograde = null,
        natalRetrograde = null,
    }) => {
        const idx = PLANET_PRIORITY.indexOf(transit);
        rows.push({
            date: date || targetDate || '—',
            method: getMethodLabel(method),
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
            transitRetrograde,
            natalRetrograde,
        });
    };

    const pushIngressRows = (data, method, date) => {
        const methodClass = method.startsWith('directions') ? 'direction' : 'progression';
        (data?.planet_ingresses || []).forEach(ing => {
            const body = ing.body || '—';
            const summaryRow = getIngressSummaryRow(method, body);
            const ingressType = ing.ingress_type === 'house' ? t('page.forecast.table.ingress.house') : t('page.forecast.table.ingress.sign');
            const fromLabel = ing.ingress_type === 'house'
                ? t('page.forecast.table.houseLabel', { house: ing.from_house ?? t('common.notAvailable') })
                : formatSignLabel(ing.from_sign);
            const toLabel = ing.ingress_type === 'house'
                ? t('page.forecast.table.houseLabel', { house: ing.to_house ?? t('common.notAvailable') })
                : formatSignLabel(ing.to_sign);
            const transitRetrograde = resolveTransitRetrograde(method, body);
            ingressRows.push({
                date: date || targetDate || '—',
                method: getMethodLabel(method),
                methodClass,
                object: body,
                objectHtml: formatPlanetCellHtml(body, transitRetrograde === true),
                ingressType,
                transition: `${fromLabel} → ${toLabel}`,
                hoverDetails: Array.isArray(summaryRow?.hover_details) ? summaryRow.hover_details : [],
                hoverLines: Array.isArray(summaryRow?.hover_lines) ? summaryRow.hover_lines : [],
            });
        });
        (data?.house_cusp_ingresses || []).forEach(ing => {
            const houseLabel = t('page.forecast.table.ingress.cuspLabel', { house: ing.house_number });
            const summaryRow = getIngressSummaryRow(method, `Cusp${ing.house_number}`);
            ingressRows.push({
                date: date || targetDate || '—',
                method: getMethodLabel(method),
                methodClass,
                object: houseLabel,
                objectHtml: escapeHtml(houseLabel),
                ingressType: t('page.forecast.table.ingress.cusp'),
                transition: `${formatSignLabel(ing.from_sign)} → ${formatSignLabel(ing.to_sign)}`,
                hoverDetails: Array.isArray(summaryRow?.hover_details) ? summaryRow.hover_details : [],
                hoverLines: Array.isArray(summaryRow?.hover_lines) ? summaryRow.hover_lines : [],
            });
        });
    };

    if (Array.isArray(transitPeriodEvents) && transitPeriodEvents.length) {
        transitPeriodEvents.forEach(ev => {
            pushAspectRow({
                date: ev.t_exact ? ev.t_exact.split('T')[0] : targetDate,
                method: 'transits',
                methodClass: 'transit',
                transit: ev.transit_body,
                aspect: ev.aspect_type,
                natal: ev.natal_body,
                orb: ev.min_orb,
                isMajor: ev.is_major,
                transitRetrograde: resolveTransitRetrograde('transits', ev.transit_body, ev.transit_retrograde),
                natalRetrograde: resolveNatalRetrograde(ev.natal_body),
            });
        });
    } else {
        (transitLayer?.aspects || []).forEach(a => {
            pushAspectRow({
                date: targetDate,
                method: 'transits',
                methodClass: 'transit',
                transit: a.transit_planet,
                aspect: a.aspect_type,
                natal: a.natal_object,
                orb: a.orb,
                isMajor: a.is_major,
                transitRetrograde: resolveTransitRetrograde('transits', a.transit_planet),
                natalRetrograde: resolveNatalRetrograde(a.natal_object),
            });
        });
    }

    (progressionLayer?.aspects_to_natal || []).forEach(a => {
        pushAspectRow({
            date: targetDate,
            method: 'progressions',
            methodClass: 'progression',
            transit: a.progressed_planet,
            aspect: a.aspect_type,
            natal: a.natal_object,
            orb: a.orb,
            isMajor: a.is_major,
            transitRetrograde: resolveTransitRetrograde('progressions', a.progressed_planet),
            natalRetrograde: resolveNatalRetrograde(a.natal_object),
        });
    });
    pushIngressRows(progressionLayer, 'progressions', targetDate);

    const directionMethodKey = `directions_${directionType}`;
    (directionLayer?.aspects_to_natal || []).forEach(a => {
        pushAspectRow({
            date: targetDate,
            method: directionMethodKey,
            methodClass: 'direction',
            transit: a.directed_object,
            aspect: a.aspect_type,
            natal: a.natal_object,
            orb: a.orb,
            isMajor: a.is_major,
            transitRetrograde: resolveTransitRetrograde(directionMethodKey, a.directed_object),
            natalRetrograde: resolveNatalRetrograde(a.natal_object),
        });
    });
    pushIngressRows(directionLayer, directionMethodKey, targetDate);

    if (!rows.length) {
        document.getElementById('tableBody').innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-secondary)">${t('page.forecast.table.noAspects')}</td></tr>`;
        ForecastState.tableRowsRaw = [];
        ForecastState.tableRows = [];
        refreshTableAspectFilterOptions([]);
        resetTableFilters();
        updateTableFiltersBadge();
    } else {
        ForecastState.tableRowsRaw = rows.sort((a, b) => {
            if (a.date !== b.date) return String(a.date).localeCompare(String(b.date));
            return (a._priority ?? 999) - (b._priority ?? 999) || (a.orb ?? 99) - (b.orb ?? 99);
        });
        refreshTableAspectFilterOptions(ForecastState.tableRowsRaw);
        resetTableFilters();
        applyTableFiltersAndRender();
    }

    const summaryIngressRows = buildIngressRowsFromSummary();
    renderIngressSection(summaryIngressRows.length ? summaryIngressRows : ingressRows);
}

function renderTableRows() {
    const rows = [...ForecastState.tableRows];
    const col = ForecastState.tableSortCol;
    const asc = ForecastState.tableSortAsc;
    rows.sort((a, b) => {
        let va = a[col], vb = b[col];
        if (col === 'orb') { va = parseFloat(va) || 0; vb = parseFloat(vb) || 0; }
        if (va < vb) return asc ? -1 : 1;
        if (va > vb) return asc ? 1 : -1;
        return 0;
    });
    const tbody = document.getElementById('tableBody');
    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-secondary)">${t('page.forecast.table.noRowsByFilters')}</td></tr>`;
        document.querySelectorAll('.forecast-table th.sortable').forEach(th => {
            const c = th.dataset.sort;
            th.classList.toggle('sort-active', c === col);
            th.classList.toggle('sort-desc', c === col && !asc);
        });
        return;
    }
    tbody.innerHTML = rows.map(r => {
        const aSym = Symbols?.aspects?.[r.aspect] || r.aspect;
        const harmony = getAspectHarmony(r.aspect);
        const transitCell = r.transitDisplay || formatPlanetCellHtml(r.transit, r.transitRetrograde === true);
        const natalCell = r.natalDisplay || formatPlanetCellHtml(r.natal, r.natalRetrograde === true);
        const aspectCell = r.aspectDisplay || `${aSym} ${r.aspect}`;
        return `<tr>
            <td>${r.date}</td>
            <td><span class="method-badge ${r.methodClass}">${r.method}</span></td>
            <td>${transitCell}</td>
            <td><span class="aspect-badge ${harmony}">${aspectCell}</span></td>
            <td>${natalCell}</td>
            <td>${r.orb < 99 ? r.orb.toFixed(2) + '°' : '—'}</td>
            <td>${r.type}</td>
        </tr>`;
    }).join('');
    // Update sort indicators
    document.querySelectorAll('.forecast-table th.sortable').forEach(th => {
        const c = th.dataset.sort;
        th.classList.toggle('sort-active', c === col);
        th.classList.toggle('sort-desc', c === col && !asc);
    });
}

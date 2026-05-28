/**
 * Synastry workspace page.
 */

const synastryParams = new URLSearchParams(window.location.search);
const primaryUserId = synastryParams.get('client') || '';
const partnerUserId = synastryParams.get('partner') || '';

const SYNASTRY_ASPECT_TYPES = window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES || [
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

const PLANET_SCALE_STORAGE_KEY = 'natalPlanetScale';
const POINT_SCALE_STORAGE_KEY = 'natalPointScale';
const HOUSE_NUMBER_STYLE_STORAGE_KEY = 'natalHouseNumberStyle';
const HOUSE_LABELS_OUTSIDE_STORAGE_KEY = 'natalHouseLabelsOutside';
const SYNASTRY_VIEW_STATE_KEY_PREFIX = 'synastryViewState:';

const synastryRefs = {};
const synastryState = {
    payload: null,
    displayMode: 'both',
    primaryRenderer: null,
    partnerRenderer: null,
    wheel: null,
    accountVisualPreferences: null,
    resolvedPreferences: null,
    applySettingsTimer: null,
    zoomScale: 1,
    panX: 0,
    panY: 0,
    panning: false,
    startX: 0,
    startY: 0,
    pinchDistance: 0,
    pinchStartScale: 1,
    settings: {
        orientation: 'aries',
        aspectScope: 'all',
        primaryMatrixRows: window.AstroPreferences?.ensureMatrixRows?.({}) || {},
        partnerMatrixRows: window.AstroPreferences?.ensureMatrixRows?.({}) || {},
        enabledAspectTypes: [...SYNASTRY_ASPECT_TYPES],
        showApplyingSeparating: false,
        showSpeed: true,
        showStationary: true,
        showAspectText: false,
        planetScale: readSavedPlanetScale(),
        pointScale: readSavedPointScale(),
        houseNumberStyle: readSavedHouseNumberStyle(),
        houseLabelsOutside: readSavedHouseLabelsOutside(),
    },
};

function synT(key, params) {
    return window.FrontendI18n?.t?.(key, params) || key;
}

async function waitForSynI18n() {
    if (!window.FrontendI18n?.ready) return;
    await Promise.resolve(window.FrontendI18n.ready).catch(() => {});
}

function clampPointScale(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 1;
    return Math.min(1.7, Math.max(0.8, numeric));
}

function readSavedUnifiedScale() {
    const raw = localStorage.getItem(PLANET_SCALE_STORAGE_KEY)
        || localStorage.getItem(POINT_SCALE_STORAGE_KEY)
        || '1.2';
    return clampPointScale(parseFloat(raw));
}

function readSavedPlanetScale() {
    return readSavedUnifiedScale();
}

function readSavedPointScale() {
    return readSavedUnifiedScale();
}

function readSavedHouseNumberStyle() {
    return localStorage.getItem(HOUSE_NUMBER_STYLE_STORAGE_KEY) === 'roman' ? 'roman' : 'arabic';
}

function readSavedHouseLabelsOutside() {
    return localStorage.getItem(HOUSE_LABELS_OUTSIDE_STORAGE_KEY) === 'true';
}

document.addEventListener('DOMContentLoaded', async () => {
    await waitForSynI18n();
    cacheSynastryElements();
    showSynastryLoader();

    if (!primaryUserId || !partnerUserId) {
        showSynastryError(synT('page.synastry.errors.missingParams'));
        return;
    }

    const astrologer = await window.AstroAPI?.requireAuth?.({ redirectTo: '/login.html' });
    if (!astrologer) return;

    configureSynastryNavigation();
    hydrateSynastryViewState();
    bindSynastryEvents();
    await loadSynastry();
});

function cacheSynastryElements() {
    synastryRefs.loader = document.getElementById('pageLoader');
    synastryRefs.error = document.getElementById('synastryError');
    synastryRefs.errorMsg = document.getElementById('synastryErrorMsg');
    synastryRefs.layout = document.getElementById('synastryLayout');
    synastryRefs.backBtn = document.getElementById('synastryBackBtn');
    synastryRefs.title = document.getElementById('synastryTitle');
    synastryRefs.subtitle = document.getElementById('synastrySubtitle');
    synastryRefs.openPrimaryNatalBtn = document.getElementById('openPrimaryNatalBtn');
    synastryRefs.openPrimaryForecastBtn = document.getElementById('openPrimaryForecastBtn');
    synastryRefs.openPrimaryProfileBtn = document.getElementById('openPrimaryProfileBtn');
    synastryRefs.openPartnerProfileBtn = document.getElementById('openPartnerProfileBtn');
    synastryRefs.openRelatedPeopleBtn = document.getElementById('openRelatedPeopleBtn');
    synastryRefs.primaryPanelTitle = document.getElementById('primaryPanelTitle');
    synastryRefs.primaryPanelMeta = document.getElementById('primaryPanelMeta');
    synastryRefs.partnerPanelTitle = document.getElementById('partnerPanelTitle');
    synastryRefs.partnerPanelMeta = document.getElementById('partnerPanelMeta');
    synastryRefs.displayModeInputs = [...document.querySelectorAll('input[name="synastryDisplayMode"]')];
    synastryRefs.wheelCaption = document.getElementById('synastryWheelCaption');
    synastryRefs.wheelWrapper = document.getElementById('synastryWheelWrapper');
    synastryRefs.wheelSvg = document.getElementById('synastryWheel');
    synastryRefs.tabsOverflow = [...document.querySelectorAll('[data-tabs-overflow]')];
    synastryRefs.primaryInterAspects = document.getElementById('primaryInterAspectsTable');
    synastryRefs.partnerInterAspects = document.getElementById('partnerInterAspectsTable');
    synastryRefs.primaryOverlayList = document.getElementById('primaryOverlayList');
    synastryRefs.partnerOverlayList = document.getElementById('partnerOverlayList');
    synastryRefs.settingsToggle = document.getElementById('settingsToggle');
    synastryRefs.settingsPanel = document.getElementById('settingsPanel');
    synastryRefs.orientationSelect = document.getElementById('orientationSelect');
    synastryRefs.aspectScopeSelect = document.getElementById('aspectScopeSelect');
    synastryRefs.iconScaleRange = document.getElementById('iconScaleRange');
    synastryRefs.iconScaleValue = document.getElementById('iconScaleValue');
    synastryRefs.showApplyingSeparatingToggle = document.getElementById('showApplyingSeparatingToggle');
    synastryRefs.showSpeedToggle = document.getElementById('showSpeedToggle');
    synastryRefs.showStationaryToggle = document.getElementById('showStationaryToggle');
    synastryRefs.houseNumberStyleSelect = document.getElementById('houseNumberStyleSelect');
    synastryRefs.houseLabelsOutsideToggle = document.getElementById('houseLabelsOutsideToggle');
    synastryRefs.matrixEditor = document.getElementById('natalMatrixEditor');
    synastryRefs.aspectTypeToggles = document.getElementById('aspectTypeToggles');
    synastryRefs.zoomIn = document.getElementById('zoomIn');
    synastryRefs.zoomOut = document.getElementById('zoomOut');
    synastryRefs.zoomReset = document.getElementById('zoomReset');
}

function getSynastryNavigationState() {
    return window.AstroAPI?.getNavigationState?.() || {};
}

function getSynastryViewStateKey() {
    return `${SYNASTRY_VIEW_STATE_KEY_PREFIX}${primaryUserId || 'primary'}:${partnerUserId || 'partner'}`;
}

function normalizeSynastryDisplayMode(value) {
    return ['both', 'primary', 'partner'].includes(value) ? value : 'both';
}

function hydrateSynastryViewState() {
    try {
        const raw = localStorage.getItem(getSynastryViewStateKey());
        const parsed = raw ? JSON.parse(raw) : {};
        synastryState.displayMode = normalizeSynastryDisplayMode(parsed.displayMode || synastryState.displayMode);
    } catch {
        synastryState.displayMode = 'both';
    }
    syncSynastryDisplayModeControls();
}

function persistSynastryViewState() {
    try {
        localStorage.setItem(getSynastryViewStateKey(), JSON.stringify({
            displayMode: synastryState.displayMode,
        }));
    } catch {
        // View state is a convenience only.
    }
}

function configureSynastryNavigation() {
    const navState = getSynastryNavigationState();
    window.AstroAPI?.patchNavigationState?.({
        currentView: 'synastry',
        clientUserId: primaryUserId ? String(primaryUserId) : navState.clientUserId,
        partnerUserId: partnerUserId ? String(partnerUserId) : navState.partnerUserId,
    });
    if (synastryRefs.backBtn) {
        synastryRefs.backBtn.href = navState.sourceUrl || window.AstroAPI?.buildClientProfileUrl?.(primaryUserId) || `/client/${encodeURIComponent(primaryUserId)}`;
    }
}

function navigateFromSynastry(targetUrl) {
    window.AstroAPI?.saveNavigationState?.({
        sourceView: 'synastry',
        sourceUrl: window.location.pathname + (window.location.search || ''),
        clientUserId: String(primaryUserId || ''),
        partnerUserId: String(partnerUserId || ''),
    });
    window.showPageLoader?.();
    window.location.href = targetUrl;
}

async function preparePrimaryChartForNavigation() {
    const chartData = synastryState.payload?.primary_chart
        || await window.AstroAPI?.getNatalChart?.(primaryUserId).catch(() => null);
    if (!chartData) return false;
    window.AstroAPI?.saveChartToSession?.(chartData);
    window.AstroAPI?.saveFormData?.(window.AstroAPI.chartToFormData(chartData));
    return true;
}

function bindSynastryEvents() {
    synastryRefs.displayModeInputs.forEach((input) => {
        input.addEventListener('change', () => {
            if (!input.checked) return;
            synastryState.displayMode = normalizeSynastryDisplayMode(input.value);
            persistSynastryViewState();
            renderWheelMode();
        });
    });

    synastryRefs.settingsToggle?.addEventListener('click', (event) => {
        event.stopPropagation();
        const shouldOpen = synastryRefs.settingsPanel?.classList.contains('hidden');
        setSynastrySettingsOpen(Boolean(shouldOpen));
    });

    synastryRefs.settingsPanel?.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    document.addEventListener('click', () => {
        setSynastrySettingsOpen(false);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            setSynastrySettingsOpen(false);
        }
    });

    synastryRefs.openPrimaryProfileBtn?.addEventListener('click', () => {
        window.location.href = `/client/${encodeURIComponent(primaryUserId)}`;
    });

    synastryRefs.openPrimaryNatalBtn?.addEventListener('click', async () => {
        const prepared = await preparePrimaryChartForNavigation();
        if (!prepared) return;
        navigateFromSynastry('/chart.html');
    });

    synastryRefs.openPrimaryForecastBtn?.addEventListener('click', async () => {
        const prepared = await preparePrimaryChartForNavigation();
        if (!prepared) return;
        navigateFromSynastry('/forecast-new.html');
    });

    synastryRefs.openPartnerProfileBtn?.addEventListener('click', () => {
        window.location.href = `/client/${encodeURIComponent(partnerUserId)}`;
    });

    synastryRefs.openRelatedPeopleBtn?.addEventListener('click', () => {
        window.AstroQuickOpen?.openRelatedPeople?.({
            userId: primaryUserId,
            sourceView: 'synastry',
            sourceUrl: window.location.pathname + (window.location.search || ''),
        });
    });

    document.querySelectorAll('.synastry-side-panel').forEach((panel) => {
        panel.addEventListener('click', (event) => {
            if (event.target.closest('.forecast-new-matrix-inline')) {
                event.stopPropagation();
                return;
            }
            const tab = event.target.closest('.panel-tab[data-panel-target]');
            if (!tab) return;

            activateSynastryPanelTab(panel, tab.dataset.panelTarget);
        });
        panel.addEventListener('change', (event) => {
            const input = event.target instanceof HTMLInputElement
                ? event.target.closest('.forecast-new-matrix-inline input[data-matrix-body][data-matrix-field]')
                : null;
            if (!input) return;
            applySynastryInlineMatrixChange(input);
        });
    });

    synastryRefs.tabsOverflow.forEach((overflow) => {
        const toggle = overflow.querySelector('[data-tabs-overflow-toggle]');
        toggle?.addEventListener('click', (event) => {
            event.stopPropagation();
            const shouldOpen = !overflow.classList.contains('is-open');
            closeSynastryTabsOverflowMenus();
            overflow.classList.toggle('is-open', shouldOpen);
            syncSynastryTabsOverflowToggleState();
        });
    });

    bindStaticSettingsHandlers();
    bindSynastryWheelInteractions();

    document.addEventListener('frontend:locale-changed', () => {
        if (synastryState.payload) {
            renderSynastry();
        }
    });
}

function activateSynastryPanelTab(panel, targetId) {
    if (!panel || !targetId) return;
    panel.querySelectorAll('.panel-tab').forEach((node) => {
        node.classList.toggle('active', node.dataset.panelTarget === targetId);
    });
    panel.querySelectorAll('.panel-tab-content').forEach((content) => {
        content.classList.toggle('active', content.id === targetId);
    });
    panel.querySelectorAll('[data-tabs-overflow]').forEach((overflow) => {
        const hasActiveOverflowTab = !!overflow.querySelector(`.panel-tab[data-panel-target="${targetId}"]`);
        overflow.classList.toggle('is-active', hasActiveOverflowTab);
        overflow.classList.remove('is-open');
    });
    syncSynastryTabsOverflowToggleState();
}

function closeSynastryTabsOverflowMenus() {
    synastryRefs.tabsOverflow?.forEach((overflow) => overflow.classList.remove('is-open'));
    syncSynastryTabsOverflowToggleState();
}

function syncSynastryTabsOverflowToggleState() {
    synastryRefs.tabsOverflow?.forEach((overflow) => {
        const toggle = overflow.querySelector('[data-tabs-overflow-toggle]');
        toggle?.setAttribute('aria-expanded', overflow.classList.contains('is-open') ? 'true' : 'false');
    });
}

function syncSynastryDisplayModeControls() {
    synastryRefs.displayModeInputs?.forEach((input) => {
        input.checked = input.value === synastryState.displayMode;
    });
}

function bindStaticSettingsHandlers() {
    synastryRefs.orientationSelect?.addEventListener('change', scheduleApplySynastrySettings);
    synastryRefs.aspectScopeSelect?.addEventListener('change', scheduleApplySynastrySettings);
    synastryRefs.showApplyingSeparatingToggle?.addEventListener('change', scheduleApplySynastrySettings);
    synastryRefs.showSpeedToggle?.addEventListener('change', scheduleApplySynastrySettings);
    synastryRefs.showStationaryToggle?.addEventListener('change', scheduleApplySynastrySettings);
    synastryRefs.houseNumberStyleSelect?.addEventListener('change', scheduleApplySynastrySettings);
    synastryRefs.houseLabelsOutsideToggle?.addEventListener('change', scheduleApplySynastrySettings);

    synastryRefs.iconScaleRange?.addEventListener('input', () => {
        if (synastryRefs.iconScaleValue) {
            synastryRefs.iconScaleValue.textContent = `${synastryRefs.iconScaleRange.value}%`;
        }
        scheduleApplySynastrySettings();
    });
}

function clampZoomScale(nextScale) {
    return Math.max(0.5, Math.min(5, Number(nextScale) || 1));
}

function setSynastryWheelTransform() {
    if (!synastryRefs.wheelWrapper) return;
    synastryRefs.wheelWrapper.style.transform =
        `translate(${synastryState.panX}px, ${synastryState.panY}px) scale(${synastryState.zoomScale})`;
}

function zoomSynastryIn() {
    synastryState.zoomScale = clampZoomScale(synastryState.zoomScale * 1.2);
    setSynastryWheelTransform();
}

function zoomSynastryOut() {
    synastryState.zoomScale = clampZoomScale(synastryState.zoomScale / 1.2);
    setSynastryWheelTransform();
}

function resetSynastryZoom() {
    synastryState.zoomScale = 1;
    synastryState.panX = 0;
    synastryState.panY = 0;
    setSynastryWheelTransform();
}

function getSynastryTouchDistance(touchA, touchB) {
    const dx = touchA.clientX - touchB.clientX;
    const dy = touchA.clientY - touchB.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function isSynastryGestureBlocked(target) {
    return target instanceof Element
        && Boolean(target.closest('.zoom-controls-float, .synastry-controls-float, .settings-panel, .synastry-wheel-caption'));
}

function bindSynastryWheelInteractions() {
    const wheelWrapper = synastryRefs.wheelWrapper;
    if (!wheelWrapper) return;
    wheelWrapper.style.cursor = 'grab';
    setSynastryWheelTransform();

    synastryRefs.zoomIn?.addEventListener('click', zoomSynastryIn);
    synastryRefs.zoomOut?.addEventListener('click', zoomSynastryOut);
    synastryRefs.zoomReset?.addEventListener('click', resetSynastryZoom);

    wheelWrapper.addEventListener('wheel', (event) => {
        if (isSynastryGestureBlocked(event.target)) return;
        event.preventDefault();
        const wheelFactor = 1.06;
        synastryState.zoomScale = event.deltaY < 0
            ? clampZoomScale(synastryState.zoomScale * wheelFactor)
            : clampZoomScale(synastryState.zoomScale / wheelFactor);
        setSynastryWheelTransform();
    }, { passive: false });

    wheelWrapper.addEventListener('mousedown', (event) => {
        if (isSynastryGestureBlocked(event.target)) return;
        synastryState.panning = true;
        synastryState.startX = event.clientX - synastryState.panX;
        synastryState.startY = event.clientY - synastryState.panY;
        wheelWrapper.style.cursor = 'grabbing';
    });

    wheelWrapper.addEventListener('mousemove', (event) => {
        if (!synastryState.panning) return;
        event.preventDefault();
        synastryState.panX = event.clientX - synastryState.startX;
        synastryState.panY = event.clientY - synastryState.startY;
        setSynastryWheelTransform();
    });

    ['mouseup', 'mouseleave'].forEach((eventName) => {
        wheelWrapper.addEventListener(eventName, () => {
            synastryState.panning = false;
            wheelWrapper.style.cursor = 'grab';
        });
    });

    wheelWrapper.addEventListener('touchstart', (event) => {
        if (isSynastryGestureBlocked(event.target)) return;
        if (event.touches.length === 2) {
            synastryState.pinchDistance = getSynastryTouchDistance(event.touches[0], event.touches[1]);
            synastryState.pinchStartScale = synastryState.zoomScale;
            synastryState.panning = false;
            event.preventDefault();
            return;
        }
        if (event.touches.length === 1) {
            synastryState.panning = true;
            synastryState.startX = event.touches[0].clientX - synastryState.panX;
            synastryState.startY = event.touches[0].clientY - synastryState.panY;
        }
    }, { passive: false });

    wheelWrapper.addEventListener('touchmove', (event) => {
        if (event.touches.length === 2 && synastryState.pinchDistance > 0) {
            event.preventDefault();
            const nextDistance = getSynastryTouchDistance(event.touches[0], event.touches[1]);
            synastryState.zoomScale = clampZoomScale(
                (nextDistance / synastryState.pinchDistance) * synastryState.pinchStartScale
            );
            setSynastryWheelTransform();
            return;
        }
        if (synastryState.panning && event.touches.length === 1) {
            event.preventDefault();
            synastryState.panX = event.touches[0].clientX - synastryState.startX;
            synastryState.panY = event.touches[0].clientY - synastryState.startY;
            setSynastryWheelTransform();
        }
    }, { passive: false });

    wheelWrapper.addEventListener('touchend', (event) => {
        if (event.touches.length < 2) {
            synastryState.pinchDistance = 0;
        }
        if (event.touches.length === 1) {
            synastryState.panning = true;
            synastryState.startX = event.touches[0].clientX - synastryState.panX;
            synastryState.startY = event.touches[0].clientY - synastryState.panY;
            return;
        }
        synastryState.panning = false;
    });

    wheelWrapper.addEventListener('touchcancel', () => {
        synastryState.panning = false;
        synastryState.pinchDistance = 0;
    });
}

async function loadSynastry() {
    try {
        const [payload, accountPreferences] = await Promise.all([
            window.AstroAPI.getSynastry(primaryUserId, partnerUserId),
            window.AstroAPI.getAccountPreferences
                ? window.AstroAPI.getAccountPreferences().catch(() => null)
                : Promise.resolve(null),
        ]);
        synastryState.payload = payload;
        synastryState.accountVisualPreferences = accountPreferences?.visual || null;
        initializeSynastrySettings();
        renderSynastry();
        synastryRefs.layout.classList.remove('hidden');
        hideSynastryLoader();
    } catch (error) {
        showSynastryError(error.message || synT('page.synastry.errors.loadFailed'));
    }
}

function showSynastryError(message) {
    hideSynastryLoader();
    synastryRefs.errorMsg.textContent = message;
    synastryRefs.error.classList.remove('hidden');
}

function showSynastryLoader() {
    synastryRefs.loader?.classList.remove('hidden');
    document.body.setAttribute('aria-busy', 'true');
}

function hideSynastryLoader() {
    synastryRefs.loader?.classList.add('hidden');
    document.body.removeAttribute('aria-busy');
}

function setSynastrySettingsOpen(isOpen) {
    if (!synastryRefs.settingsPanel || !synastryRefs.settingsToggle) return;
    synastryRefs.settingsPanel.classList.toggle('hidden', !isOpen);
    synastryRefs.settingsToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function initializeSynastrySettings() {
    const resolved = window.AstroPreferences?.normalizeViewSettings
        ? window.AstroPreferences.normalizeViewSettings(synastryState.payload?.resolved_preferences?.synastry?.resolved || {})
        : (synastryState.payload?.resolved_preferences?.synastry?.resolved || {});

    synastryState.resolvedPreferences = synastryState.payload?.resolved_preferences?.synastry || null;
    synastryState.settings.orientation = resolved?.view_options?.orientation === 'asc' ? 'asc' : 'aries';
    synastryState.settings.aspectScope = resolved?.aspects?.scope || 'all';
    const matrixSettings = resolved?.matrix || {};
    const hasSplitMatrixRows = Number(matrixSettings.schema_version) >= 2;
    const primaryRows = hasSplitMatrixRows
        ? (matrixSettings.natal_rows || matrixSettings.rows || {})
        : (matrixSettings.rows || {});
    const partnerRows = hasSplitMatrixRows
        ? (matrixSettings.prognostic_rows || matrixSettings.rows || {})
        : (matrixSettings.rows || {});
    synastryState.settings.primaryMatrixRows = ensureSynastryMatrixRows(primaryRows);
    synastryState.settings.partnerMatrixRows = ensureSynastryMatrixRows(partnerRows);
    synastryState.settings.enabledAspectTypes = window.AstroPreferences?.healEnabledAspectTypesForScope
        ? window.AstroPreferences.healEnabledAspectTypesForScope(
            resolved?.aspects?.enabled_types,
            synastryState.settings.aspectScope,
            SYNASTRY_ASPECT_TYPES,
        )
        : (Array.isArray(resolved?.aspects?.enabled_types) && resolved.aspects.enabled_types.length
            ? [...resolved.aspects.enabled_types]
            : [...SYNASTRY_ASPECT_TYPES]);
    synastryState.settings.showApplyingSeparating = resolved?.aspects?.show_applying_separating === true;
    synastryState.settings.showSpeed = resolved?.table_options?.show_speed !== false;
    synastryState.settings.showStationary = resolved?.table_options?.show_stationary !== false;
    synastryState.settings.showAspectText = resolved?.table_options?.show_aspect_text === true;
    synastryState.settings.planetScale = readSavedPlanetScale();
    synastryState.settings.pointScale = readSavedPointScale();
    synastryState.settings.houseNumberStyle = readSavedHouseNumberStyle();
    synastryState.settings.houseLabelsOutside = readSavedHouseLabelsOutside();
}

function renderSynastry() {
    const primaryChart = synastryState.payload?.primary_chart || {};
    const partnerChart = synastryState.payload?.partner_chart || {};

    renderSynastryHeader(primaryChart, partnerChart);
    syncSynastrySettingsControls();
    renderSynastryWorkspace();
}

function renderSynastryWorkspace() {
    const primarySideChart = getFilteredSynastryChartData(synastryState.payload?.primary_chart || {}, { target: 'side-panel', side: 'primary' });
    const partnerSideChart = getFilteredSynastryChartData(synastryState.payload?.partner_chart || {}, { target: 'side-panel', side: 'partner' });
    const primaryWheelChart = getFilteredSynastryChartData(synastryState.payload?.primary_chart || {}, { target: 'wheel', side: 'primary' });
    const partnerWheelChart = getFilteredSynastryChartData(synastryState.payload?.partner_chart || {}, { target: 'wheel', side: 'partner' });

    renderSynastrySide('primary', primarySideChart);
    renderSynastrySide('partner', partnerSideChart);
    renderPerspectiveInterAspects(synastryRefs.primaryInterAspects, 'primary');
    renderPerspectiveInterAspects(synastryRefs.partnerInterAspects, 'partner');
    renderHouseOverlayList(
        synastryRefs.primaryOverlayList,
        getFilteredHouseOverlayItems(synastryState.payload?.house_overlays?.primary_in_partner_houses || []),
    );
    renderHouseOverlayList(
        synastryRefs.partnerOverlayList,
        getFilteredHouseOverlayItems(synastryState.payload?.house_overlays?.partner_in_primary_houses || []),
    );
    renderWheelMode(primaryWheelChart, partnerWheelChart);
}

function renderSynastryHeader(primaryChart, partnerChart) {
    const primaryName = getChartPersonName(primaryChart);
    const partnerName = getChartPersonName(partnerChart);
    synastryRefs.title.textContent = synT('page.synastry.headerTitle', { client: primaryName, partner: partnerName });
    synastryRefs.subtitle.textContent = `${formatBirthSummary(primaryChart)}  •  ${formatBirthSummary(partnerChart)}`;
    synastryRefs.primaryPanelTitle.textContent = primaryName;
    synastryRefs.partnerPanelTitle.textContent = partnerName;
    synastryRefs.primaryPanelMeta.textContent = formatBirthSummary(primaryChart);
    synastryRefs.partnerPanelMeta.textContent = formatBirthSummary(partnerChart);
}

function renderSynastrySide(side, chartData) {
    const renderer = ensureSideRenderer(side);
    renderer.setHouseNumberStyle?.(synastryState.settings.houseNumberStyle);
    renderer.setDisplayPreferences({
        showSpeed: synastryState.settings.showSpeed,
        showStationary: synastryState.settings.showStationary,
        showApplyingSeparating: synastryState.settings.showApplyingSeparating,
        showAspectText: synastryState.settings.showAspectText,
    });
    renderer.render(chartData);
    renderSynastryInlineMatrixControls(side);
    renderer.setAspectTypeFilter(synastryState.settings.aspectScope);
    window.DispositorChains?.render?.(`${side}RulersContainer`, chartData, {
        selectId: `${side}RulersModeSelect`,
        layout: 'tabs',
    });
}

function renderSynastryInlineMatrixControls(side) {
    const table = document.getElementById(`${side}PlanetsTable`);
    if (!table) return;
    const rows = getCurrentSynastryMatrixRows(side);
    table.querySelectorAll('tr[data-planet]').forEach((row) => {
        row.querySelectorAll('.forecast-new-matrix-inline-cell').forEach((cell) => cell.remove());
        const body = getSynastryMatrixBodyKey(row.dataset.planet);
        row.insertAdjacentHTML('beforeend', renderSynastryMatrixControlCells(body, rows, side));
    });
}

function renderSynastryMatrixControlCells(bodyName, rows, side = 'partner') {
    const body = getSynastryMatrixBodyKey(bodyName);
    if (!body) {
        return '<td class="forecast-new-matrix-inline-cell forecast-new-matrix-inline-empty"></td><td class="forecast-new-matrix-inline-cell forecast-new-matrix-inline-empty"></td>';
    }
    return ['display', 'aspecting'].map((field) => {
        const checked = rows?.[body]?.[field] !== false ? 'checked' : '';
        const shortLabel = field === 'display' ? 'Показ' : 'Аспектация';
        const label = `${shortLabel}: ${getBodyLabel(body)}`;
        return `
            <td class="forecast-new-matrix-inline-cell">
                <label class="forecast-new-matrix-inline" title="${escapeSynAttribute(label)}" aria-label="${escapeSynAttribute(label)}">
                    <input type="checkbox" data-matrix-side="${escapeSynAttribute(normalizeSynastryMatrixSide(side))}" data-matrix-body="${escapeSynAttribute(body)}" data-matrix-field="${field}" ${checked}>
                </label>
            </td>
        `;
    }).join('');
}

function getSynastryMatrixBodyKey(name) {
    return window.AstroPreferences?.normalizeMatrixBodyName
        ? window.AstroPreferences.normalizeMatrixBodyName(name)
        : String(name || '');
}

function applySynastryInlineMatrixChange(input) {
    const side = normalizeSynastryMatrixSide(input.dataset.matrixSide);
    const body = getSynastryMatrixBodyKey(input.dataset.matrixBody);
    const field = input.dataset.matrixField;
    if (!body || !['display', 'aspecting'].includes(field)) return;

    const previousSettings = snapshotSynastrySettings();
    const rows = cloneSynastryMatrixRows(getCurrentSynastryMatrixRows(side));
    rows[body] = {
        ...(rows[body] || { display: true, aspecting: true }),
        [field]: input.checked,
    };
    setSynastryMatrixRowsForSide(side, rows);
    syncSynastryMatrixInputsFromState();

    if (canApplySynastrySettingsFast(previousSettings, snapshotSynastrySettings())) {
        renderSynastryTablesAndApplyMatrixFast();
    } else {
        renderSynastryWorkspace();
    }

    persistSynastryViewOverrides().catch((error) => {
        console.warn('Failed to persist synastry matrix settings:', error);
    });
}

function syncSynastryMatrixInputsFromState() {
    document
        .querySelectorAll('input[data-matrix-body][data-matrix-field]')
        .forEach((input) => {
            const side = normalizeSynastryMatrixSide(input.dataset.matrixSide);
            const rows = getCurrentSynastryMatrixRows(side);
            const body = getSynastryMatrixBodyKey(input.dataset.matrixBody);
            const field = input.dataset.matrixField;
            if (!body || !['display', 'aspecting'].includes(field)) return;
            input.checked = rows?.[body]?.[field] !== false;
        });
}

function ensureSideRenderer(side) {
    const key = side === 'primary' ? 'primaryRenderer' : 'partnerRenderer';
    if (synastryState[key]) {
        if (synastryState.accountVisualPreferences) {
            synastryState[key].setVisualPreferences?.(synastryState.accountVisualPreferences);
        }
        return synastryState[key];
    }

    synastryState[key] = new window.ChartDataRenderer({
        planetsTableId: `${side}PlanetsTable`,
        housesTableId: `${side}HousesTable`,
        aspectsTableId: `${side}AspectsTable`,
        aspectGridContainerId: `${side}AspectGridContainer`,
        configsContainerId: `${side}ConfigurationsContainer`,
        balancesContainerId: `${side}BalancesContainer`,
        aspectSortHeadersSelector: `#${side}AspectsView th.sortable[data-sort]`,
        showSpeedColumn: false,
        showHouseColumn: false,
    });

    if (synastryState.accountVisualPreferences) {
        synastryState[key].setVisualPreferences?.(synastryState.accountVisualPreferences);
    }

    return synastryState[key];
}

function ensureSynastryWheel() {
    if (!synastryState.wheel && window.PrognosticRingsWheel && synastryRefs.wheelSvg) {
        synastryState.wheel = new window.PrognosticRingsWheel(synastryRefs.wheelSvg);
    }
    return synastryState.wheel;
}

function renderWheelMode(primaryChartOverride, partnerChartOverride) {
    if (!synastryState.payload) return;
    const wheel = ensureSynastryWheel();
    if (!wheel) return;

    const primaryChart = primaryChartOverride || getFilteredSynastryChartData(synastryState.payload.primary_chart, { target: 'wheel', side: 'primary' });
    const partnerChart = partnerChartOverride || getFilteredSynastryChartData(synastryState.payload.partner_chart, { target: 'wheel', side: 'partner' });
    const viewModel = buildSynastryWheelViewModel(primaryChart, partnerChart);
    const primaryMatrixRows = getCurrentSynastryMatrixRows('primary');
    const partnerMatrixRows = getCurrentSynastryMatrixRows('partner');
    syncSynastryDisplayModeControls();
    wheel.setOptions({
        orientation: synastryState.settings.orientation,
        natalMatrixRows: primaryMatrixRows,
        prognosticMatrixRows: partnerMatrixRows,
        matrixRows: partnerMatrixRows,
        planetScale: synastryState.settings.planetScale,
        pointScale: synastryState.settings.pointScale,
        aspectScope: synastryState.settings.aspectScope,
        enabledAspectTypes: synastryState.settings.enabledAspectTypes,
        houseNumberStyle: synastryState.settings.houseNumberStyle,
        houseLabelsOutside: synastryState.settings.houseLabelsOutside,
        showAspectText: synastryState.settings.showAspectText === true,
        minimumRingCount: 2,
        alignSingleRingOuter: synastryState.displayMode !== 'both',
        visualPreferences: synastryState.accountVisualPreferences || null,
    });
    wheel.render(viewModel);
    resetSynastryZoom();

    const captionKey = {
        primary: 'page.synastry.compare.clientOnly',
        partner: 'page.synastry.compare.partnerOnly',
        both: 'page.synastry.compare.overlayHint',
    }[synastryState.displayMode] || 'page.synastry.compare.overlayHint';
    synastryRefs.wheelCaption.textContent = synT(captionKey);
}

function buildSynastryWheelViewModel(primaryChart, partnerChart) {
    const mode = normalizeSynastryDisplayMode(synastryState.displayMode);
    if (mode === 'primary') {
        return window.PrognosticLayerNormalizer.buildViewModel(primaryChart, {}, { activeMethods: [] });
    }
    if (mode === 'partner') {
        const partnerLayer = window.PrognosticLayerNormalizer.normalizeLayer('synastry_partner', {
            partner_chart: {
                ...partnerChart,
                aspects: normalizePartnerInternalAspects(partnerChart?.aspects || []),
            },
            aspects: normalizePartnerInternalAspects(partnerChart?.aspects || []),
        }, 1);
        partnerLayer.aspects = normalizePartnerInternalAspects(partnerChart?.aspects || []);
        return {
            natalLayer: null,
            activePrognosticLayers: [partnerLayer],
        };
    }
    return window.PrognosticLayerNormalizer.buildViewModel(primaryChart, {
        synastry_partner: {
            partner_chart: partnerChart,
            inter_aspects: getFilteredInterAspects({ target: 'wheel' }),
        },
    }, { activeMethods: ['synastry_partner'] });
}

function normalizePartnerInternalAspects(aspects = []) {
    return (aspects || []).map((aspect) => ({
        ...aspect,
        planet_1: aspect.planet_1 || aspect.left_planet,
        planet_2: aspect.planet_2 || aspect.right_planet,
        left_planet: aspect.left_planet || aspect.planet_1,
        right_planet: aspect.right_planet || aspect.planet_2,
        method: 'synastry_partner',
    }));
}

function syncSynastrySettingsControls() {
    if (synastryRefs.orientationSelect) {
        synastryRefs.orientationSelect.value = synastryState.settings.orientation === 'asc' ? 'asc' : 'aries';
    }
    if (synastryRefs.aspectScopeSelect) {
        synastryRefs.aspectScopeSelect.value = synastryState.settings.aspectScope || 'all';
    }
    if (synastryRefs.iconScaleRange) {
        synastryRefs.iconScaleRange.value = String(Math.round(synastryState.settings.planetScale * 100));
    }
    if (synastryRefs.iconScaleValue) {
        synastryRefs.iconScaleValue.textContent = `${Math.round(synastryState.settings.planetScale * 100)}%`;
    }
    if (synastryRefs.showApplyingSeparatingToggle) {
        synastryRefs.showApplyingSeparatingToggle.checked = synastryState.settings.showApplyingSeparating === true;
    }
    if (synastryRefs.showSpeedToggle) {
        synastryRefs.showSpeedToggle.checked = synastryState.settings.showSpeed !== false;
    }
    if (synastryRefs.showStationaryToggle) {
        synastryRefs.showStationaryToggle.checked = synastryState.settings.showStationary !== false;
    }
    if (synastryRefs.houseNumberStyleSelect) {
        synastryRefs.houseNumberStyleSelect.value = synastryState.settings.houseNumberStyle === 'roman' ? 'roman' : 'arabic';
    }
    if (synastryRefs.houseLabelsOutsideToggle) {
        synastryRefs.houseLabelsOutsideToggle.checked = synastryState.settings.houseLabelsOutside === true;
    }

    renderSynastrySettingsEditors();
}

function renderSynastrySettingsEditors() {
    renderSynastryMatrixEditor();
    renderSynastryAspectTypeToggles();
    bindDynamicSettingsHandlers();
    syncSynastryMatrixInputsFromState();
}

function renderSynastryMatrixEditor() {
    if (!synastryRefs.matrixEditor) return;

    const rows = getCurrentSynastryMatrixRows('primary');
    const bodies = window.AstroPreferences?.MATRIX_BODIES || [];
    synastryRefs.matrixEditor.innerHTML = `
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
                    const label = synT(`astro.planet.${body}`);
                    const symbol = Symbols?.planets?.[body] || '';
                    const displayChecked = rows?.[body]?.display !== false ? 'checked' : '';
                    const aspectingChecked = rows?.[body]?.aspecting !== false ? 'checked' : '';
                    const escapedLabel = escapeSynAttribute(label);
                    return `
                        <tr>
                            <td>
                                <span class="natal-matrix-body natal-matrix-body--icon-only" title="${escapedLabel}" aria-label="${escapedLabel}" role="img">
                                    <span class="astro-symbol">${symbol}</span>
                                </span>
                            </td>
                            <td>
                                <label class="natal-matrix-check">
                                    <input type="checkbox" data-matrix-side="primary" data-matrix-body="${body}" data-matrix-field="display" ${displayChecked}>
                                </label>
                            </td>
                            <td>
                                <label class="natal-matrix-check">
                                    <input type="checkbox" data-matrix-side="primary" data-matrix-body="${body}" data-matrix-field="aspecting" ${aspectingChecked}>
                                </label>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function renderSynastryAspectTypeToggles() {
    if (!synastryRefs.aspectTypeToggles) return;

    const enabledTypes = new Set(
        Array.isArray(synastryState.settings.enabledAspectTypes) && synastryState.settings.enabledAspectTypes.length
            ? synastryState.settings.enabledAspectTypes
            : SYNASTRY_ASPECT_TYPES
    );

    synastryRefs.aspectTypeToggles.innerHTML = SYNASTRY_ASPECT_TYPES.map((aspectType) => {
        const label = synT(`astro.aspect.${aspectType}`);
        const symbol = Symbols?.getAspectDisplay?.(aspectType) || Symbols?.aspects?.[aspectType] || '';
        const checked = enabledTypes.has(aspectType) ? 'checked' : '';
        const escapedLabel = escapeSynAttribute(label);
        return `
            <label class="settings-check-option settings-check-option--pill settings-check-option--icon-only" title="${escapedLabel}">
                <input type="checkbox" data-aspect-type="${aspectType}" ${checked} aria-label="${escapedLabel}">
                <span class="settings-check-option-glyph" aria-hidden="true"><span class="astro-symbol">${symbol}</span></span>
            </label>
        `;
    }).join('');
}

function bindDynamicSettingsHandlers() {
    document.querySelectorAll('#natalMatrixEditor input').forEach((input) => {
        input.onchange = () => scheduleApplySynastrySettings();
    });
    document.querySelectorAll('#aspectTypeToggles input').forEach((input) => {
        input.onchange = () => scheduleApplySynastrySettings();
    });
}

function snapshotSynastrySettings() {
    return {
        orientation: synastryState.settings.orientation,
        aspectScope: synastryState.settings.aspectScope,
        primaryMatrixRows: cloneSynastryMatrixRows(getCurrentSynastryMatrixRows('primary')),
        partnerMatrixRows: cloneSynastryMatrixRows(getCurrentSynastryMatrixRows('partner')),
        enabledAspectTypes: [...(synastryState.settings.enabledAspectTypes || [])],
        showApplyingSeparating: synastryState.settings.showApplyingSeparating === true,
        showSpeed: synastryState.settings.showSpeed !== false,
        showStationary: synastryState.settings.showStationary !== false,
        showAspectText: synastryState.settings.showAspectText === true,
        planetScale: synastryState.settings.planetScale,
        pointScale: synastryState.settings.pointScale,
        houseNumberStyle: synastryState.settings.houseNumberStyle,
        houseLabelsOutside: synastryState.settings.houseLabelsOutside === true,
    };
}

function cloneSynastryMatrixRows(rows = {}) {
    return Object.fromEntries(Object.entries(rows || {}).map(([body, row]) => ([
        body,
        {
            display: row?.display !== false,
            aspecting: row?.aspecting !== false,
        },
    ])));
}

function matrixRowsChanged(previousRows = {}, nextRows = {}) {
    const bodies = new Set([...Object.keys(previousRows || {}), ...Object.keys(nextRows || {})]);
    return [...bodies].some((body) => (
        (previousRows?.[body]?.display !== false) !== (nextRows?.[body]?.display !== false)
        || (previousRows?.[body]?.aspecting !== false) !== (nextRows?.[body]?.aspecting !== false)
    ));
}

function matrixChangeEnablesBodyOrAspects(previousRows = {}, nextRows = {}) {
    const bodies = new Set([...Object.keys(previousRows || {}), ...Object.keys(nextRows || {})]);
    return [...bodies].some((body) => (
        previousRows?.[body]?.display === false && nextRows?.[body]?.display !== false
    ) || (
        previousRows?.[body]?.aspecting === false && nextRows?.[body]?.aspecting !== false
    ));
}

function aspectTypesChanged(previousTypes = [], nextTypes = []) {
    const previous = new Set(previousTypes || []);
    const next = new Set(nextTypes || []);
    if (previous.size !== next.size) return true;
    return [...previous].some((type) => !next.has(type));
}

function canApplySynastrySettingsFast(previousSettings, nextSettings) {
    const geometryChanged = previousSettings.orientation !== nextSettings.orientation
        || previousSettings.planetScale !== nextSettings.planetScale
        || previousSettings.pointScale !== nextSettings.pointScale
        || previousSettings.houseNumberStyle !== nextSettings.houseNumberStyle
        || previousSettings.houseLabelsOutside !== nextSettings.houseLabelsOutside;
    if (geometryChanged) return false;

    const aspectOptionsChanged = previousSettings.aspectScope !== nextSettings.aspectScope
        || aspectTypesChanged(previousSettings.enabledAspectTypes, nextSettings.enabledAspectTypes)
        || previousSettings.showApplyingSeparating !== nextSettings.showApplyingSeparating;
    if (aspectOptionsChanged) return false;

    const primaryRowsChanged = matrixRowsChanged(previousSettings.primaryMatrixRows, nextSettings.primaryMatrixRows);
    const partnerRowsChanged = matrixRowsChanged(previousSettings.partnerMatrixRows, nextSettings.partnerMatrixRows);
    if (!primaryRowsChanged && !partnerRowsChanged) {
        return true;
    }

    return !(
        matrixChangeEnablesBodyOrAspects(previousSettings.primaryMatrixRows, nextSettings.primaryMatrixRows)
        || matrixChangeEnablesBodyOrAspects(previousSettings.partnerMatrixRows, nextSettings.partnerMatrixRows)
    );
}

function renderSynastryTablesAndApplyMatrixFast() {
    const primaryChart = getFilteredSynastryChartData(synastryState.payload?.primary_chart || {}, { target: 'side-panel', side: 'primary' });
    const partnerChart = getFilteredSynastryChartData(synastryState.payload?.partner_chart || {}, { target: 'side-panel', side: 'partner' });

    renderSynastrySide('primary', primaryChart);
    renderSynastrySide('partner', partnerChart);
    renderPerspectiveInterAspects(synastryRefs.primaryInterAspects, 'primary');
    renderPerspectiveInterAspects(synastryRefs.partnerInterAspects, 'partner');
    renderHouseOverlayList(
        synastryRefs.primaryOverlayList,
        getFilteredHouseOverlayItems(synastryState.payload?.house_overlays?.primary_in_partner_houses || []),
    );
    renderHouseOverlayList(
        synastryRefs.partnerOverlayList,
        getFilteredHouseOverlayItems(synastryState.payload?.house_overlays?.partner_in_primary_houses || []),
    );
    const primaryMatrixRows = getCurrentSynastryMatrixRows('primary');
    const partnerMatrixRows = getCurrentSynastryMatrixRows('partner');
    synastryState.wheel?.applyMatrixRows?.(partnerMatrixRows, {
        natalMatrixRows: primaryMatrixRows,
        prognosticMatrixRows: partnerMatrixRows,
    });
}

function scheduleApplySynastrySettings() {
    if (synastryState.applySettingsTimer) {
        clearTimeout(synastryState.applySettingsTimer);
    }
    synastryState.applySettingsTimer = setTimeout(async () => {
        const previousSettings = snapshotSynastrySettings();
        synastryState.settings.orientation = synastryRefs.orientationSelect?.value === 'asc' ? 'asc' : 'aries';
        synastryState.settings.aspectScope = ['all', 'major', 'minor'].includes(synastryRefs.aspectScopeSelect?.value)
            ? synastryRefs.aspectScopeSelect.value
            : 'all';
        const iconScale = clampPointScale(Number(synastryRefs.iconScaleRange?.value || 120) / 100);
        synastryState.settings.planetScale = iconScale;
        synastryState.settings.pointScale = iconScale;
        synastryState.settings.primaryMatrixRows = readSynastryMatrixRowsFromControls('primary');
        synastryState.settings.enabledAspectTypes = window.AstroPreferences?.healEnabledAspectTypesForScope
            ? window.AstroPreferences.healEnabledAspectTypesForScope(
                readSynastryEnabledAspectTypesFromControls(),
                synastryState.settings.aspectScope,
                SYNASTRY_ASPECT_TYPES,
            )
            : readSynastryEnabledAspectTypesFromControls();
        synastryState.settings.showApplyingSeparating = synastryRefs.showApplyingSeparatingToggle?.checked === true;
        synastryState.settings.showSpeed = synastryRefs.showSpeedToggle?.checked !== false;
        synastryState.settings.showStationary = synastryRefs.showStationaryToggle?.checked !== false;
        synastryState.settings.houseNumberStyle = synastryRefs.houseNumberStyleSelect?.value === 'roman' ? 'roman' : 'arabic';
        synastryState.settings.houseLabelsOutside = synastryRefs.houseLabelsOutsideToggle?.checked === true;

        localStorage.setItem(PLANET_SCALE_STORAGE_KEY, String(iconScale));
        localStorage.setItem(POINT_SCALE_STORAGE_KEY, String(iconScale));
        localStorage.setItem(HOUSE_NUMBER_STYLE_STORAGE_KEY, synastryState.settings.houseNumberStyle);
        localStorage.setItem(HOUSE_LABELS_OUTSIDE_STORAGE_KEY, synastryState.settings.houseLabelsOutside ? 'true' : 'false');

        if (canApplySynastrySettingsFast(previousSettings, snapshotSynastrySettings())) {
            renderSynastryTablesAndApplyMatrixFast();
        } else {
            renderSynastryWorkspace();
        }

        try {
            await persistSynastryViewOverrides();
        } catch (error) {
            console.warn('Failed to persist synastry settings:', error);
        } finally {
            synastryState.applySettingsTimer = null;
        }
    }, 120);
}

async function persistSynastryViewOverrides() {
    if (!synastryState.resolvedPreferences || !window.AstroAPI?.saveChartViewOverride) return;

    const accountDefaults = window.AstroPreferences?.normalizeViewSettings
        ? window.AstroPreferences.normalizeViewSettings(synastryState.resolvedPreferences.account_defaults || {})
        : (synastryState.resolvedPreferences.account_defaults || {});
    const resolved = getCurrentSynastryViewSettings();
    const diff = window.AstroPreferences?.buildSparseDiff
        ? window.AstroPreferences.buildSparseDiff(accountDefaults, resolved)
        : resolved;

    if (!diff || (typeof diff === 'object' && Object.keys(diff).length === 0)) {
        await window.AstroAPI.deleteChartViewOverride({
            chart_kind: 'natal',
            chart_id: primaryUserId,
            view_type: 'biwheel',
        });
        synastryState.resolvedPreferences = {
            ...synastryState.resolvedPreferences,
            overrides: {},
            resolved,
        };
        return;
    }

    await window.AstroAPI.saveChartViewOverride({
        chart_kind: 'natal',
        chart_id: primaryUserId,
        view_type: 'biwheel',
        overrides: diff,
    });
    synastryState.resolvedPreferences = {
        ...synastryState.resolvedPreferences,
        overrides: diff,
        resolved,
    };
}

function getCurrentSynastryViewSettings() {
    const primaryMatrixRows = getCurrentSynastryMatrixRows('primary');
    const partnerMatrixRows = getCurrentSynastryMatrixRows('partner');
    return {
        matrix: {
            schema_version: 2,
            rows: partnerMatrixRows,
            natal_rows: primaryMatrixRows,
            prognostic_rows: partnerMatrixRows,
        },
        aspects: {
            scope: synastryState.settings.aspectScope || 'all',
            enabled_types: Array.isArray(synastryState.settings.enabledAspectTypes) && synastryState.settings.enabledAspectTypes.length
                ? [...synastryState.settings.enabledAspectTypes]
                : [...SYNASTRY_ASPECT_TYPES],
            show_applying_separating: synastryState.settings.showApplyingSeparating === true,
        },
        table_options: {
            show_speed: synastryState.settings.showSpeed !== false,
            show_stationary: synastryState.settings.showStationary !== false,
            show_aspect_text: synastryState.settings.showAspectText === true,
        },
        view_options: {
            orientation: synastryState.settings.orientation === 'asc' ? 'asc' : 'aries',
        },
    };
}

function ensureSynastryMatrixRows(rows = {}) {
    return window.AstroPreferences?.ensureMatrixRows
        ? window.AstroPreferences.ensureMatrixRows(rows || {})
        : (rows || {});
}

function normalizeSynastryMatrixSide(side) {
    return side === 'primary' ? 'primary' : 'partner';
}

function getCurrentSynastryMatrixRows(side = 'partner') {
    const key = normalizeSynastryMatrixSide(side) === 'primary' ? 'primaryMatrixRows' : 'partnerMatrixRows';
    return ensureSynastryMatrixRows(synastryState.settings[key] || {});
}

function setSynastryMatrixRowsForSide(side = 'partner', rows = {}) {
    const key = normalizeSynastryMatrixSide(side) === 'primary' ? 'primaryMatrixRows' : 'partnerMatrixRows';
    synastryState.settings[key] = ensureSynastryMatrixRows(rows);
}

function readSynastryMatrixRowsFromControls(side = 'primary') {
    const normalizedSide = normalizeSynastryMatrixSide(side);
    const rows = cloneSynastryMatrixRows(getCurrentSynastryMatrixRows(normalizedSide));
    document.querySelectorAll(`#natalMatrixEditor input[data-matrix-side="${normalizedSide}"][data-matrix-body][data-matrix-field]`).forEach((input) => {
        const body = input.dataset.matrixBody;
        const field = input.dataset.matrixField;
        if (!body || !field) return;
        rows[body] = {
            ...(rows[body] || { display: true, aspecting: true }),
            [field]: input.checked,
        };
    });
    return rows;
}

function readSynastryEnabledAspectTypesFromControls() {
    const enabled = [];
    document.querySelectorAll('#aspectTypeToggles input[data-aspect-type]').forEach((input) => {
        if (input.checked && input.dataset.aspectType) {
            enabled.push(input.dataset.aspectType);
        }
    });
    return enabled.length ? enabled : [...SYNASTRY_ASPECT_TYPES];
}

function getFilteredSynastryChartData(chartData = {}, options = {}) {
    const target = options.target === 'wheel' ? 'wheel' : 'side-panel';
    const side = normalizeSynastryMatrixSide(options.side);
    const filtered = window.AstroPreferences?.filterChartDataByViewPreferences
        ? window.AstroPreferences.filterChartDataByViewPreferences(chartData, {
            matrixRows: target === 'wheel'
                ? getCurrentSynastryMatrixRows(side)
                : getSynastryMatrixRowsForSidePanel(side),
            aspectScope: synastryState.settings.aspectScope || 'all',
            enabledAspectTypes: Array.isArray(synastryState.settings.enabledAspectTypes) && synastryState.settings.enabledAspectTypes.length
                ? synastryState.settings.enabledAspectTypes
                : SYNASTRY_ASPECT_TYPES,
        })
        : chartData;

    if (target !== 'wheel') {
        return filtered;
    }

    const filterVisible = (entry) => bodyIsVisible(entry?.name, side);
    return {
        ...filtered,
        special_points: Object.fromEntries(
            Object.entries(filtered.special_points || {}).filter(([, point]) => filterVisible(point))
        ),
        angles: Object.fromEntries(
            Object.entries(filtered.angles || {}).filter(([, angle]) => filterVisible(angle))
        ),
    };
}

function getSynastryMatrixRowsForSidePanel(side = 'partner') {
    return Object.fromEntries(Object.entries(getCurrentSynastryMatrixRows(side)).map(([body, config]) => [
        body,
        {
            ...config,
            display: true,
        },
    ]));
}

function getFilteredInterAspects(options = {}) {
    const target = options.target === 'wheel' ? 'wheel' : 'side-panel';
    const primaryMatrixRows = getCurrentSynastryMatrixRows('primary');
    const partnerMatrixRows = getCurrentSynastryMatrixRows('partner');
    const enabledAspectTypes = window.AstroPreferences?.resolveEnabledAspectTypesForScope
        ? window.AstroPreferences.resolveEnabledAspectTypesForScope({
            enabledAspectTypes: synastryState.settings.enabledAspectTypes,
            aspectScope: synastryState.settings.aspectScope || 'all',
            availableAspectTypes: (synastryState.payload?.inter_aspects || []).map((aspect) => aspect?.aspect_type).filter(Boolean),
        })
        : new Set(synastryState.settings.enabledAspectTypes || SYNASTRY_ASPECT_TYPES);

    const normalizeBody = (name) => window.AstroPreferences?.normalizeMatrixBodyName
        ? window.AstroPreferences.normalizeMatrixBodyName(name)
        : name;
    const bodyIsDisplayable = (name, side = 'partner') => {
        const matrixRows = normalizeSynastryMatrixSide(side) === 'primary' ? primaryMatrixRows : partnerMatrixRows;
        const normalized = normalizeBody(name);
        return !matrixRows[normalized] || matrixRows[normalized]?.display !== false;
    };
    const bodyIsAspecting = (name, side = 'partner') => {
        const matrixRows = normalizeSynastryMatrixSide(side) === 'primary' ? primaryMatrixRows : partnerMatrixRows;
        const normalized = normalizeBody(name);
        return !matrixRows[normalized] || matrixRows[normalized]?.aspecting !== false;
    };

    return (synastryState.payload?.inter_aspects || []).filter((aspect) => {
        const firstSide = aspect?.chart_1 === 'partner' ? 'partner' : 'primary';
        const secondSide = aspect?.chart_2 === 'primary' ? 'primary' : 'partner';
        return (
            (target !== 'wheel' || bodyIsDisplayable(aspect?.planet_1, firstSide))
            && (target !== 'wheel' || bodyIsDisplayable(aspect?.planet_2, secondSide))
            && bodyIsAspecting(aspect?.planet_1, firstSide)
            && bodyIsAspecting(aspect?.planet_2, secondSide)
            && enabledAspectTypes.has(aspect?.aspect_type)
        );
    });
}

function getFilteredHouseOverlayItems(items = []) {
    return items;
}

function bodyIsVisible(bodyName, side = 'partner') {
    const rows = getCurrentSynastryMatrixRows(side);
    const normalized = window.AstroPreferences?.normalizeMatrixBodyName
        ? window.AstroPreferences.normalizeMatrixBodyName(bodyName)
        : bodyName;
    return !rows[normalized] || rows[normalized]?.display !== false;
}

function renderPerspectiveInterAspects(container, perspective) {
    if (!container) return;
    const aspects = getFilteredInterAspects();
    if (!aspects.length) {
        container.innerHTML = `<tr><td colspan="4" class="text-muted">—</td></tr>`;
        return;
    }

    container.innerHTML = aspects.map((aspect) => {
        const isDirectPerspective = aspect.chart_1 === perspective;
        const firstPlanet = isDirectPerspective ? aspect.planet_1 : aspect.planet_2;
        const secondPlanet = isDirectPerspective ? aspect.planet_2 : aspect.planet_1;
        const phase = typeof aspect.applying === 'boolean'
            ? (aspect.applying ? synT('page.chart.settings.aspectPhase.applying') : synT('page.chart.settings.aspectPhase.separating'))
            : '—';
        const aspectLabel = synastryState.settings.showAspectText
            ? ` ${escapeSynHtml(getAspectLabel(aspect.aspect_type))}`
            : '';

        return `
            <tr>
                <td>
                    <div class="synastry-aspect-bodies synastry-aspect-bodies--stacked">
                        <span>${getBodySymbolMarkup(firstPlanet, { size: 16, title: getBodyLabel(firstPlanet) })} ${escapeSynHtml(getBodyLabel(firstPlanet))}</span>
                        <span class="synastry-aspect-divider">→</span>
                        <span>${getBodySymbolMarkup(secondPlanet, { size: 16, title: getBodyLabel(secondPlanet) })} ${escapeSynHtml(getBodyLabel(secondPlanet))}</span>
                    </div>
                </td>
                <td><span class="astro-symbol">${Symbols?.getAspectDisplay?.(aspect.aspect_type) || Symbols.aspects[aspect.aspect_type] || ''}</span>${aspectLabel}</td>
                <td class="mono">${Number(aspect.orb || 0).toFixed(2)}°</td>
                <td>${escapeSynHtml(phase)}</td>
            </tr>
        `;
    }).join('');
}

function renderHouseOverlayList(container, items) {
    if (!container) return;
    if (!items.length) {
        container.innerHTML = `<p class="profile-empty">—</p>`;
        return;
    }

    container.innerHTML = items.map((item) => `
        <div class="synastry-overlay-item">
            <div class="synastry-overlay-body">
                ${getBodySymbolMarkup(item.body_name, { size: 16, title: getBodyLabel(item.body_name) })}
                <span>${escapeSynHtml(getBodyLabel(item.body_name))}</span>
            </div>
            <div class="synastry-overlay-meta">
                <span>${escapeSynHtml(formatSynAstroCoordinate(item))}</span>
                <strong>H${Number(item.overlay_house || 0)}</strong>
            </div>
        </div>
    `).join('');
}

function getChartPersonName(chartData) {
    const birthData = chartData?.birth_data || {};
    return [birthData.first_name, birthData.last_name].filter(Boolean).join(' ') || synT('common.notAvailable');
}

function formatBirthSummary(chartData) {
    const birthData = chartData?.birth_data || {};
    const parts = [];
    if (birthData.date) parts.push(formatSynDate(birthData.date));
    if (birthData.time) parts.push(String(birthData.time).slice(0, 5));
    if (birthData.place) parts.push(birthData.place);
    return parts.join(' · ');
}

function formatSynDate(isoDate) {
    if (!isoDate) return '';
    const [year, month, day] = String(isoDate).split('T')[0].split('-');
    return year && month && day ? `${day}.${month}.${year}` : isoDate;
}

function getBodyLabel(bodyName) {
    const key = `astro.planet.${bodyName}`;
    const translated = synT(key);
    return translated === key ? (Symbols.getPlanetNameRu?.(bodyName) || bodyName) : translated;
}

function getBodySymbolMarkup(bodyName, options = {}) {
    return Symbols.getPlanetSymbolMarkup?.(bodyName, options)
        || `<span class="astro-symbol">${escapeSynHtml(Symbols.getPlanetSymbol?.(bodyName) || '')}</span>`;
}

function getAspectLabel(aspectType) {
    const key = `astro.aspect.${aspectType}`;
    const translated = synT(key);
    return translated === key ? aspectType : translated;
}

function getSignSymbol(signName) {
    return Symbols.signs?.[signName] || '';
}

function formatSynAstroCoordinate(item) {
    if (!item?.sign) return '';
    const formatted = window.LocaleFormatters?.formatAstroCoordinate?.(item, {
        signSymbol: getSignSymbol(item.sign),
    });
    if (formatted) return formatted;

    const degree = Number(item.degree_in_sign);
    if (!Number.isFinite(degree)) return getSignSymbol(item.sign);
    const d = Math.floor(degree);
    const m = Math.floor((degree - d) * 60);
    return [`${d}°`, getSignSymbol(item.sign), `${String(m).padStart(2, '0')}'`].join(' ');
}

function escapeSynHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
}

function escapeSynAttribute(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

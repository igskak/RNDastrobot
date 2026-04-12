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

const synastryRefs = {};
const synastryState = {
    payload: null,
    wheelMode: 'compare',
    primaryRenderer: null,
    partnerRenderer: null,
    baseWheel: null,
    overlayWheel: null,
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
        matrixRows: window.AstroPreferences?.ensureMatrixRows?.({}) || {},
        enabledAspectTypes: [...SYNASTRY_ASPECT_TYPES],
        showApplyingSeparating: false,
        showSpeed: true,
        showStationary: true,
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
    synastryRefs.openPrimaryProfileBtn = document.getElementById('openPrimaryProfileBtn');
    synastryRefs.openPartnerProfileBtn = document.getElementById('openPartnerProfileBtn');
    synastryRefs.primaryPanelTitle = document.getElementById('primaryPanelTitle');
    synastryRefs.primaryPanelMeta = document.getElementById('primaryPanelMeta');
    synastryRefs.partnerPanelTitle = document.getElementById('partnerPanelTitle');
    synastryRefs.partnerPanelMeta = document.getElementById('partnerPanelMeta');
    synastryRefs.modeButtons = [...document.querySelectorAll('.synastry-mode-btn')];
    synastryRefs.wheelCaption = document.getElementById('synastryWheelCaption');
    synastryRefs.wheelWrapper = document.getElementById('synastryWheelWrapper');
    synastryRefs.overlay = document.getElementById('synastryOverlay');
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

function bindSynastryEvents() {
    synastryRefs.modeButtons.forEach((button) => {
        button.addEventListener('click', () => {
            synastryState.wheelMode = button.dataset.mode || 'compare';
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

    synastryRefs.openPartnerProfileBtn?.addEventListener('click', () => {
        window.location.href = `/client/${encodeURIComponent(partnerUserId)}`;
    });

    document.querySelectorAll('.synastry-side-panel').forEach((panel) => {
        panel.addEventListener('click', (event) => {
            const tab = event.target.closest('.panel-tab[data-panel-target]');
            if (!tab) return;

            panel.querySelectorAll('.panel-tab').forEach((node) => node.classList.toggle('active', node === tab));
            panel.querySelectorAll('.panel-tab-content').forEach((content) => {
                content.classList.toggle('active', content.id === tab.dataset.panelTarget);
            });
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
    synastryState.settings.matrixRows = window.AstroPreferences?.ensureMatrixRows
        ? window.AstroPreferences.ensureMatrixRows(resolved?.matrix?.rows || {})
        : (resolved?.matrix?.rows || {});
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
    const primaryChart = getFilteredSynastryChartData(synastryState.payload?.primary_chart || {});
    const partnerChart = getFilteredSynastryChartData(synastryState.payload?.partner_chart || {});

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
    renderWheelMode(primaryChart, partnerChart);
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
    synastryRefs.backBtn.href = `/client/${encodeURIComponent(primaryUserId)}`;
}

function renderSynastrySide(side, chartData) {
    const renderer = ensureSideRenderer(side);
    renderer.setDisplayPreferences({
        showSpeed: synastryState.settings.showSpeed,
        showStationary: synastryState.settings.showStationary,
        showApplyingSeparating: synastryState.settings.showApplyingSeparating,
    });
    renderer.render(chartData);
    renderer.setAspectTypeFilter(synastryState.settings.aspectScope);
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
        dignitiesContainerId: `${side}DignitiesContainer`,
        aspectSortHeadersSelector: `#${side}AspectsView th.sortable[data-sort]`,
    });

    if (synastryState.accountVisualPreferences) {
        synastryState[key].setVisualPreferences?.(synastryState.accountVisualPreferences);
    }

    return synastryState[key];
}

function ensureWheels() {
    if (!synastryState.baseWheel && window.ChartWheel) {
        synastryState.baseWheel = new window.ChartWheel(document.getElementById('synastryBaseWheel'));
    }
    if (!synastryState.overlayWheel && window.ChartWheel) {
        synastryState.overlayWheel = new window.ChartWheel(document.getElementById('synastryOverlayWheel'));
    }

    if (synastryState.accountVisualPreferences) {
        synastryState.baseWheel?.setVisualPreferences?.(synastryState.accountVisualPreferences, { redraw: false });
        synastryState.overlayWheel?.setVisualPreferences?.(synastryState.accountVisualPreferences, { redraw: false });
    }
}

function renderWheelMode(primaryChartOverride, partnerChartOverride) {
    if (!synastryState.payload) return;
    ensureWheels();
    if (!synastryState.baseWheel) return;

    const primaryChart = primaryChartOverride || getFilteredSynastryChartData(synastryState.payload.primary_chart);
    const partnerChart = partnerChartOverride || getFilteredSynastryChartData(synastryState.payload.partner_chart);
    const mode = synastryState.wheelMode;

    synastryRefs.modeButtons.forEach((button) => {
        button.classList.toggle('active', button.dataset.mode === mode);
    });

    [synastryState.baseWheel, synastryState.overlayWheel].forEach((wheel) => {
        wheel?.setOrientationMode(synastryState.settings.orientation, { redraw: false });
        wheel?.setPointScales({
            planets: synastryState.settings.planetScale,
            points: synastryState.settings.pointScale,
        }, { redraw: false });
        wheel?.setHouseLabelOptions({
            style: synastryState.settings.houseNumberStyle,
            outside: synastryState.settings.houseLabelsOutside,
        }, { redraw: false });
    });

    if (mode === 'partner') {
        synastryState.baseWheel.draw(partnerChart);
        synastryRefs.overlay.classList.remove('visible');
        synastryRefs.wheelCaption.textContent = synT('page.synastry.compare.partnerOnly');
        return;
    }

    synastryState.baseWheel.draw(primaryChart);
    if (mode === 'compare' && synastryState.overlayWheel) {
        synastryState.overlayWheel.draw(partnerChart);
        synastryRefs.overlay.classList.add('visible');
        synastryRefs.wheelCaption.textContent = synT('page.synastry.compare.overlayHint');
        return;
    }

    synastryRefs.overlay.classList.remove('visible');
    synastryRefs.wheelCaption.textContent = synT('page.synastry.compare.clientOnly');
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
}

function renderSynastryMatrixEditor() {
    if (!synastryRefs.matrixEditor) return;

    const rows = getCurrentSynastryMatrixRows();
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

function renderSynastryAspectTypeToggles() {
    if (!synastryRefs.aspectTypeToggles) return;

    const enabledTypes = new Set(
        Array.isArray(synastryState.settings.enabledAspectTypes) && synastryState.settings.enabledAspectTypes.length
            ? synastryState.settings.enabledAspectTypes
            : SYNASTRY_ASPECT_TYPES
    );

    synastryRefs.aspectTypeToggles.innerHTML = SYNASTRY_ASPECT_TYPES.map((aspectType) => {
        const label = synT(`astro.aspect.${aspectType}`);
        const symbol = Symbols?.aspects?.[aspectType] || '';
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

function scheduleApplySynastrySettings() {
    if (synastryState.applySettingsTimer) {
        clearTimeout(synastryState.applySettingsTimer);
    }
    synastryState.applySettingsTimer = setTimeout(async () => {
        synastryState.settings.orientation = synastryRefs.orientationSelect?.value === 'asc' ? 'asc' : 'aries';
        synastryState.settings.aspectScope = ['all', 'major', 'minor'].includes(synastryRefs.aspectScopeSelect?.value)
            ? synastryRefs.aspectScopeSelect.value
            : 'all';
        const iconScale = clampPointScale(Number(synastryRefs.iconScaleRange?.value || 120) / 100);
        synastryState.settings.planetScale = iconScale;
        synastryState.settings.pointScale = iconScale;
        synastryState.settings.matrixRows = readSynastryMatrixRowsFromControls();
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

        renderSynastryWorkspace();

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
    return {
        matrix: {
            rows: getCurrentSynastryMatrixRows(),
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
        },
        view_options: {
            orientation: synastryState.settings.orientation === 'asc' ? 'asc' : 'aries',
        },
    };
}

function getCurrentSynastryMatrixRows() {
    return window.AstroPreferences?.ensureMatrixRows
        ? window.AstroPreferences.ensureMatrixRows(synastryState.settings.matrixRows || {})
        : (synastryState.settings.matrixRows || {});
}

function readSynastryMatrixRowsFromControls() {
    const rows = getCurrentSynastryMatrixRows();
    document.querySelectorAll('#natalMatrixEditor input[data-matrix-body][data-matrix-field]').forEach((input) => {
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

function getFilteredSynastryChartData(chartData = {}) {
    const filtered = window.AstroPreferences?.filterChartDataByViewPreferences
        ? window.AstroPreferences.filterChartDataByViewPreferences(chartData, {
            matrixRows: getCurrentSynastryMatrixRows(),
            aspectScope: synastryState.settings.aspectScope || 'all',
            enabledAspectTypes: Array.isArray(synastryState.settings.enabledAspectTypes) && synastryState.settings.enabledAspectTypes.length
                ? synastryState.settings.enabledAspectTypes
                : SYNASTRY_ASPECT_TYPES,
        })
        : chartData;

    const filterVisible = (entry) => bodyIsVisible(entry?.name);
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

function getFilteredInterAspects() {
    const matrixRows = getCurrentSynastryMatrixRows();
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
    const bodyIsDisplayable = (name) => {
        const normalized = normalizeBody(name);
        return !matrixRows[normalized] || matrixRows[normalized]?.display !== false;
    };
    const bodyIsAspecting = (name) => {
        const normalized = normalizeBody(name);
        return !matrixRows[normalized] || matrixRows[normalized]?.aspecting !== false;
    };

    return (synastryState.payload?.inter_aspects || []).filter((aspect) => (
        bodyIsDisplayable(aspect?.planet_1)
        && bodyIsDisplayable(aspect?.planet_2)
        && bodyIsAspecting(aspect?.planet_1)
        && bodyIsAspecting(aspect?.planet_2)
        && enabledAspectTypes.has(aspect?.aspect_type)
    ));
}

function getFilteredHouseOverlayItems(items = []) {
    return items.filter((item) => bodyIsVisible(item?.body_name));
}

function bodyIsVisible(bodyName) {
    const rows = getCurrentSynastryMatrixRows();
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

        return `
            <tr>
                <td>
                    <div class="synastry-aspect-bodies synastry-aspect-bodies--stacked">
                        <span><span class="astro-symbol">${Symbols.planets[firstPlanet] || ''}</span> ${escapeSynHtml(getBodyLabel(firstPlanet))}</span>
                        <span class="synastry-aspect-divider">→</span>
                        <span><span class="astro-symbol">${Symbols.planets[secondPlanet] || ''}</span> ${escapeSynHtml(getBodyLabel(secondPlanet))}</span>
                    </div>
                </td>
                <td><span class="astro-symbol">${Symbols.aspects[aspect.aspect_type] || ''}</span> ${escapeSynHtml(getAspectLabel(aspect.aspect_type))}</td>
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
                <span class="astro-symbol">${Symbols.planets[item.body_name] || ''}</span>
                <span>${escapeSynHtml(getBodyLabel(item.body_name))}</span>
            </div>
            <div class="synastry-overlay-meta">
                <span>${escapeSynHtml(item.sign ? `${getSignSymbol(item.sign)} ${item.degree_in_sign_formatted || ''}` : '')}</span>
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
    return translated === key ? bodyName : translated;
}

function getAspectLabel(aspectType) {
    const key = `astro.aspect.${aspectType}`;
    const translated = synT(key);
    return translated === key ? aspectType : translated;
}

function getSignSymbol(signName) {
    return Symbols.signs?.[signName] || '';
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

/**
 * forecast-biwheel.js — Dual wheel: natal (inner) + prognostic (outer)
 * Renders SVG biwheel in #biwheelSvg (viewBox 600x600)
 */
(function() {
    'use strict';

    function t(key, params) {
        return window.FrontendI18n?.t?.(key, params) || key;
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

    const C = 300; // center
    const NS = 'http://www.w3.org/2000/svg';
    const VIEWBOX_SIZE = 600;
    const DEFAULT_VIEWPORT = Object.freeze({
        zoom: 1,
        panX: 0,
        panY: 0,
    });

    // Radii
    const OUTER_R = 285;
    const DEGREE_RING = 10;
    const SIGN_RING = 22;
    const HOUSE_RING = 30;
    const SIGN_SYMBOL_SIZE = 13;
    const NATAL_PLANET_SYMBOL_SIZE = 14;
    const PROG_PLANET_SYMBOL_SIZE = 14;
    const RETRO_SYMBOL_SIZE = 8;
    // Keep aspect field close to natal wheel proportions:
    // make the aspect working area noticeably larger and reduce dead space before houses.
    const ASPECT_R = 124;
    const SIGN_INNER_R = OUTER_R - DEGREE_RING - SIGN_RING;
    const HOUSE_INNER_R = SIGN_INNER_R - HOUSE_RING;
    const WHEEL_ORDER = ['natal', 'transit', 'progression', 'direction'];
    const WHEEL_INSET = 2;
    const WHEEL_GAP = 0;
    const DEFAULT_WHEEL_BAND_WIDTH =
        (SIGN_INNER_R - ASPECT_R - (WHEEL_INSET * 2) - (WHEEL_GAP * (WHEEL_ORDER.length - 1))) / WHEEL_ORDER.length;
    const PROGNOSTIC_GLYPH_COLOR = '#111111';
    const WHEEL_SEPARATOR_COLOR = '#94a3b8';
    const WHEEL_SEPARATOR_WIDTH = 0.9;
    const WHEEL_SEPARATOR_OPACITY = 0.55;
    const PROGNOSTIC_RING_STYLES = {
        transit: { ringAlpha: '28', cuspAlpha: 'AA', cuspOpacity: '0.72' },
        progression: { ringAlpha: '24', cuspAlpha: 'A6', cuspOpacity: '0.68' },
        direction: { ringAlpha: '26', cuspAlpha: 'AB', cuspOpacity: '0.7' },
        solar_return: { ringAlpha: '22', cuspAlpha: 'A0', cuspOpacity: '0.66' },
    };

    // Colors
    const ELEMENT_COLORS = {
        Fire: '#ef4444', Earth: '#84cc16', Air: '#f59e0b', Water: '#3b82f6'
    };
    const ASPECT_COLORS = {
        Conjunction: '#6366f1', Opposition: '#ef4444', Trine: '#22c55e',
        Square: '#f97316', Sextile: '#06b6d4', Quincunx: '#a855f7',
    };
    const PROGNOSTIC_LAYERS = {
        transit: {
            color: '#0ea5e9',
            label: 'transit',
            tableMethod: 'transits',
        },
        progression: {
            color: '#c026d3',
            label: 'progression',
            tableMethod: 'progressions',
        },
        direction: {
            color: '#f97316',
            label: 'direction',
            tableMethod: 'directions',
        },
        solar_return: {
            color: '#14b8a6',
            label: 'solar_return',
            tableMethod: 'solar_return',
        },
    };

    let svg, ascLong = 0;
    let orientationMode = 'aries';
    let aspectFilter = 'major';
    let persistentMatrixRows = null;
    let enabledAspectTypes = new Set(['Conjunction', 'Opposition', 'Trine', 'Square', 'Sextile']);
    let layerVisibility = {
        natal: true,
        transit: true,
        progression: true,
        direction: true,
    };
    let enabledTransitBodies = new Set();
    let enabledNatalBodies = new Set();
    let transitFiltersInitialized = false;
    let natalFiltersInitialized = false;
    let lastNatalData = null;
    let lastProgData = null;
    let natalPointScale = 1.0;
    let transitPointScale = 1.0;
    let focusState = {
        mode: null,
        method: null,
        transitBody: null,
        natalBody: null,
        aspectType: null,
        aspectKey: null,
        planetRole: null,
        planetName: null,
    };
    let hoverState = {
        aspectKey: null,
        source: null,
    };
    let aspectLookupByKey = new Map();
    let planetClickFilter = {
        role: null,
        planetName: null,
    };
    let hoverTooltip = null;
    let ingressesCollapsed = window.matchMedia?.('(max-width: 768px)')?.matches ?? false;
    let aspectsCollapsed = window.matchMedia?.('(max-width: 768px)')?.matches ?? false;
    let ingressesAvailable = false;
    let natalRetrogradeMap = new Map();
    let layerRetrogradeMaps = new Map();
    let wheelBandsByMethod = new Map();
    let wheelBandWidth = DEFAULT_WHEEL_BAND_WIDTH;
    let layoutAnimationTimer = null;
    const viewportSubscribers = new Set();

    function normalizeMatrixRows(rows) {
        return window.AstroPreferences?.ensureMatrixRows
            ? window.AstroPreferences.ensureMatrixRows(rows || {})
            : (rows || {});
    }

    function getBodyMatrixConfig(name) {
        const rows = persistentMatrixRows || {};
        return rows?.[name] || { display: true, aspecting: true };
    }

    function getAllowedAspectTypes() {
        return enabledAspectTypes.size
            ? enabledAspectTypes
            : new Set(['Conjunction', 'Opposition', 'Trine', 'Square', 'Sextile']);
    }

    function el(tag, attrs, text) {
        const e = document.createElementNS(NS, tag);
        if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
        if (text) e.textContent = text;
        return e;
    }

    function clampPointScale(v) {
        return Math.min(1.7, Math.max(0.8, Number(v) || 1));
    }

    function normalizeWheelMethod(methodOrLayer = 'transit') {
        return methodOrLayer === 'solar_return' ? 'direction' : methodOrLayer;
    }

    function isKnownWheelMethod(methodOrLayer) {
        return WHEEL_ORDER.includes(normalizeWheelMethod(methodOrLayer));
    }

    function collectWheelMethods(layers = [], options = {}) {
        const methods = [];
        const includeVisibleOnly = options.visibleOnly !== false;
        const push = (method) => {
            const normalized = normalizeWheelMethod(method);
            if (!isKnownWheelMethod(normalized)) return;
            if (!methods.includes(normalized)) methods.push(normalized);
        };

        if (!includeVisibleOnly || layerVisibility.natal) push('natal');
        (layers || []).forEach((layer) => {
            if (!layer?.method) return;
            if (includeVisibleOnly && !isLayerVisible(layer.method)) return;
            push(layer.method);
        });
        return methods;
    }

    function updateWheelLayout(layers = []) {
        const visibleMethods = collectWheelMethods(layers, { visibleOnly: true });
        const fallbackMethods = visibleMethods.length
            ? visibleMethods
            : collectWheelMethods(layers, { visibleOnly: false });
        const methods = fallbackMethods.length ? fallbackMethods : ['natal'];
        const totalThickness = SIGN_INNER_R - ASPECT_R - (WHEEL_INSET * 2);
        const gapsTotal = WHEEL_GAP * Math.max(0, methods.length - 1);
        const availableThickness = Math.max(totalThickness - gapsTotal, DEFAULT_WHEEL_BAND_WIDTH);
        wheelBandWidth = availableThickness / methods.length;
        wheelBandsByMethod = new Map();

        methods.forEach((method, index) => {
            const inner = ASPECT_R + WHEEL_INSET + index * (wheelBandWidth + WHEEL_GAP);
            const outer = inner + wheelBandWidth;
            wheelBandsByMethod.set(method, {
                inner,
                outer,
                center: inner + (wheelBandWidth / 2),
            });
        });
    }

    function getVisibleWheelCount(layers = []) {
        return collectWheelMethods(layers, { visibleOnly: true }).length;
    }

    function getVisibleWheelBandBounds() {
        const methods = WHEEL_ORDER.filter((method) => layerVisibility[method] !== false);
        if (!methods.length) return null;

        let inner = Infinity;
        let outer = -Infinity;
        methods.forEach((method) => {
            const band = getWheelBand(method);
            inner = Math.min(inner, band.inner);
            outer = Math.max(outer, band.outer);
        });

        if (!Number.isFinite(inner) || !Number.isFinite(outer)) return null;
        return {
            inner,
            outer,
            count: methods.length,
        };
    }

    function triggerLayoutAnimation() {
        const container = document.getElementById('biwheelContainer');
        if (!container) return;
        container.classList.remove('bw-layout-animating');
        // Restart CSS animation class.
        void container.offsetWidth;
        container.classList.add('bw-layout-animating');
        if (layoutAnimationTimer) clearTimeout(layoutAnimationTimer);
        layoutAnimationTimer = window.setTimeout(() => {
            container.classList.remove('bw-layout-animating');
            layoutAnimationTimer = null;
        }, 320);
    }

    function applyBiwheelContainerState(layers = []) {
        const container = document.getElementById('biwheelContainer');
        if (!container) return;
        const visibleWheels = getVisibleWheelCount(layers);
        container.setAttribute('data-bw-visible-wheels', String(visibleWheels));
        container.classList.toggle('bw-single-wheel', visibleWheels <= 1);
    }

    function normalizeAspectKeyPart(value) {
        return String(value ?? '');
    }

    function buildAspectKey(method, transitBody, aspectType, natalBody) {
        return [
            normalizeAspectKeyPart(method || ''),
            normalizeAspectKeyPart(transitBody || ''),
            normalizeAspectKeyPart(aspectType || ''),
            normalizeAspectKeyPart(natalBody || '')
        ].join('|');
    }

    function getAspectKey(aspect) {
        if (!aspect) return null;
        return buildAspectKey(aspect.method, aspect.transitBody, aspect.aspectType, aspect.natalBody);
    }

    function escapeSelectorValue(value) {
        if (window.CSS?.escape) return window.CSS.escape(String(value ?? ''));
        return String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    function getAspectName(name) {
        const key = `astro.aspect.${name}`;
        const translated = t(key);
        return translated === key ? (Symbols?.aspectNamesRu?.[name] || name) : translated;
    }

    function buildNatalLongitudeMap(natalData) {
        const natalMap = {};
        (natalData?.planets || []).forEach((planet) => {
            if (!planet?.name) return;
            natalMap[planet.name] = planet.longitude;
        });
        return natalMap;
    }

    function buildMethodLongitudeMaps(layers) {
        const maps = {};
        (layers || []).forEach((layer) => {
            if (!layer?.method) return;
            const methodMap = {};
            (layer.planets || []).forEach((planet) => {
                if (!planet?.name) return;
                methodMap[planet.name] = planet.longitude;
            });
            maps[layer.method] = methodMap;
        });
        return maps;
    }

    function buildRetrogradeMap(planets = []) {
        const map = new Map();
        (planets || []).forEach((planet) => {
            if (!planet?.name) return;
            map.set(planet.name, Boolean(planet.retrograde));
        });
        return map;
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

    function tableMethodToLayerMethod(methodKey = '') {
        if (methodKey === 'progressions') return 'progression';
        if (methodKey === 'directions') return 'direction';
        if (methodKey === 'solar_return') return 'solar_return';
        return 'transit';
    }

    function isTransitBodyRetrograde(bodyName, methodKey = '') {
        const layerMethod = tableMethodToLayerMethod(methodKey);
        const map = layerRetrogradeMaps.get(layerMethod);
        if (!map || !bodyName) return false;
        return map.get(bodyName) === true;
    }

    function isNatalBodyRetrograde(bodyName) {
        if (!bodyName) return false;
        return natalRetrogradeMap.get(bodyName) === true;
    }

    function isAspectRenderable(aspect, natalMap, methodLongitudeMaps) {
        if (!aspect) return false;
        const method = aspect.method || 'transit';
        const progMap = methodLongitudeMaps?.[method];
        if (!progMap) return false;
        const nLong = natalMap?.[aspect.natalBody];
        const pLong = progMap?.[aspect.transitBody];
        return nLong != null && pLong != null;
    }

    function filterRenderableAspects(aspects, natalMap, methodLongitudeMaps) {
        return (aspects || []).filter((aspect) => isAspectRenderable(aspect, natalMap, methodLongitudeMaps));
    }

    function filterPlanetsByBodyVisibility(planets, role, availableBodies) {
        return (planets || []).filter((planet) => {
            const name = planet?.name;
            if (!name) return false;
            const config = getBodyMatrixConfig(name);
            if (config.display === false) return false;
            // Bodies without checkbox remain visible; checkbox controls only available aspect bodies.
            if (!availableBodies?.has(name)) return true;
            return role === 'natal'
                ? enabledNatalBodies.has(name)
                : enabledTransitBodies.has(name);
        });
    }

    function readSavedScale(key, fallback) {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return clampPointScale(parseFloat(raw));
    }

    function updateScaleControlsUI() {
        const natalRange = document.getElementById('bwNatalScaleRange');
        const transitRange = document.getElementById('bwTransitScaleRange');
        const natalValue = document.getElementById('bwNatalScaleValue');
        const transitValue = document.getElementById('bwTransitScaleValue');
        const natalPct = Math.round(natalPointScale * 100);
        const transitPct = Math.round(transitPointScale * 100);

        if (natalRange) natalRange.value = String(natalPct);
        if (transitRange) transitRange.value = String(transitPct);
        if (natalValue) natalValue.textContent = `${natalPct}%`;
        if (transitValue) transitValue.textContent = `${transitPct}%`;
    }

    function getReferenceLongitude() {
        return orientationMode === 'asc' ? ascLong : 0;
    }

    function longToAngle(lon) {
        const reference = getReferenceLongitude();
        // Зеркальная геометрия: от левой точки (9 часов) движение против часовой
        let a = 180 - (lon - reference);
        while (a < 0) a += 360;
        while (a >= 360) a -= 360;
        return a;
    }

    function normalizeAngle(deg) {
        let value = Number(deg) || 0;
        while (value < 0) value += 360;
        while (value >= 360) value -= 360;
        return value;
    }

    function polar(r, deg) {
        const rad = deg * Math.PI / 180;
        return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) };
    }

    function drawArc(outerR, innerR, startAngle, endAngle, fill) {
        const startOuter = polar(outerR, startAngle);
        const endOuter = polar(outerR, endAngle);
        const startInner = polar(innerR, endAngle);
        const endInner = polar(innerR, startAngle);

        const d = [
            `M ${startOuter.x} ${startOuter.y}`,
            `A ${outerR} ${outerR} 0 0 1 ${endOuter.x} ${endOuter.y}`,
            `L ${startInner.x} ${startInner.y}`,
            `A ${innerR} ${innerR} 0 0 0 ${endInner.x} ${endInner.y}`,
            'Z'
        ].join(' ');

        svg.appendChild(el('path', { d, fill }));
    }

    function withAlpha(color, alphaHex) {
        if (typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)) {
            return `${color}${alphaHex}`;
        }
        return color;
    }

    function sanitizeNormalizedViewport(viewport) {
        const source = viewport && typeof viewport === 'object' ? viewport : DEFAULT_VIEWPORT;
        const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(source.zoom) || DEFAULT_VIEWPORT.zoom));
        const panXValue = Number(source.panX);
        const panYValue = Number(source.panY);
        return {
            zoom,
            panX: Number.isFinite(panXValue) ? panXValue : DEFAULT_VIEWPORT.panX,
            panY: Number.isFinite(panYValue) ? panYValue : DEFAULT_VIEWPORT.panY,
        };
    }

    function getNormalizedViewport() {
        return {
            zoom: zoomLevel,
            panX,
            panY,
        };
    }

    function notifyViewportSubscribers() {
        const snapshot = getNormalizedViewport();
        viewportSubscribers.forEach((listener) => {
            try {
                listener(snapshot);
            } catch (error) {
                console.error('ForecastBiwheel viewport subscriber error:', error);
            }
        });
    }

    function subscribeViewport(listener) {
        if (typeof listener !== 'function') {
            return () => {};
        }
        viewportSubscribers.add(listener);
        listener(getNormalizedViewport());
        return () => {
            viewportSubscribers.delete(listener);
        };
    }

    // ─── Public render ──────────────────────────────────
    function render(natalData, progData) {
        lastNatalData = natalData;
        lastProgData = progData;
        svg = document.getElementById('biwheelSvg');
        if (!svg) return;
        clearHoveredAspectState({ hideTooltip: true, force: true });
        svg.innerHTML = '';
        ascLong = natalData.angles?.ASC?.longitude || 0;

        const layers = buildPrognosticLayers(progData);
        updateWheelLayout(layers);
        applyBiwheelContainerState(layers);
        natalRetrogradeMap = buildRetrogradeMap(natalData?.planets || []);
        layerRetrogradeMaps = new Map(
            layers.map((layer) => [layer.method, buildRetrogradeMap(layer.planets || [])])
        );
        const aspects = layers.flatMap(layer => layer.aspects || []);
        const natalMap = buildNatalLongitudeMap(natalData);
        const methodLongitudeMaps = buildMethodLongitudeMaps(layers);
        const renderableAspects = filterRenderableAspects(aspects, natalMap, methodLongitudeMaps);
        syncBodyFilters(renderableAspects);
        const filteredAspects = getFilteredAspects(renderableAspects);
        const availableTransitBodies = new Set(renderableAspects.map((a) => a.transitBody).filter(Boolean));
        const availableNatalBodies = new Set(renderableAspects.map((a) => a.natalBody).filter(Boolean));
        updateLayerLegendUI();

        drawBackground();
        drawSignRing();
        if (layerVisibility.natal) {
            drawMethodRing('natal');
        }
        layers.forEach(layer => {
            if (!isLayerVisible(layer.method)) return;
            drawMethodRing(layer.method);
        });
        drawWheelSeparators(layers);

        if (layerVisibility.natal) {
            drawHouses(natalData.houses, { layer: 'natal', layerLabel: t('page.forecast.biwheel.legend.natal') });
        }

        layers.forEach(layer => {
            if (!isLayerVisible(layer.method)) return;
            if (!layer.houses?.length) return;
            drawHouses(layer.houses, {
                layer: 'prognostic',
                method: layer.method,
                layerLabel: getPrognosticHouseLayerLabel(layer.method),
            });
        });

        drawAspectCircle();

        if (layerVisibility.natal) {
            const visibleNatalPlanets = filterPlanetsByBodyVisibility(natalData.planets, 'natal', availableNatalBodies);
            drawPlanets(visibleNatalPlanets, getLayerRadius('natal'), '#374151', NATAL_PLANET_SYMBOL_SIZE, true, 'natal', 'natal');
        }

        layers.forEach(layer => {
            if (!isLayerVisible(layer.method)) return;
            const visibleLayerPlanets = filterPlanetsByBodyVisibility(layer.planets, 'transit', availableTransitBodies);
            drawPlanets(
                visibleLayerPlanets,
                getLayerRadius(layer.method),
                layer.color,
                PROG_PLANET_SYMBOL_SIZE,
                false,
                'prognostic',
                layer.method
            );
        });
        aspectLookupByKey = new Map();
        filteredAspects.forEach((aspect) => {
            const key = getAspectKey(aspect);
            if (!key || aspectLookupByKey.has(key)) return;
            aspectLookupByKey.set(key, aspect);
        });
        layers.forEach(layer => {
            if (!isLayerVisible(layer.method)) return;
            const layerAspects = filteredAspects.filter(a => a.method === layer.method);
            drawCrossAspects(layerAspects, natalMap, layer.planets, layer.method);
        });

        const ingresses = getIngressRowsForRender();
        renderIngressesTable(ingresses);

        renderAspectsTable(filteredAspects);

        // Highlight aspect from timeline click
        if (window.ForecastState?.highlightAspect) {
            applyHighlight(window.ForecastState.highlightAspect);
            window.ForecastState.highlightAspect = null;
        } else {
            applyFocusState();
        }

        applyViewBox({ notify: false });
    }

    function applyHighlight(h) {
        if (!h || !svg) return;
        const container = document.getElementById('biwheelAspects');
        if (!container) return;

        const rows = [...container.querySelectorAll('tbody tr')];
        const targetRow = rows.find((tr) => {
            const methodMatches = !h.method || !tr.dataset.method || tr.dataset.method === h.method;
            return methodMatches &&
                tr.dataset.transit === h.transitBody &&
                tr.dataset.aspect === h.aspectType &&
                tr.dataset.natal === h.natalBody;
        });

        if (!targetRow) return;

        setFocusAspect(
            targetRow.dataset.transit || null,
            targetRow.dataset.natal || null,
            targetRow.dataset.aspect || null,
            targetRow.dataset.method || null,
            targetRow.dataset.aspectKey || null
        );
        targetRow.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    // ─── Background ─────────────────────────────────────
    function drawBackground() {
        svg.appendChild(el('circle', { cx:C, cy:C, r:OUTER_R, fill:'#fafafa', stroke:'#d1d5db', 'stroke-width':1 }));
    }

    // ─── Sign ring ──────────────────────────────────────
    function drawSignRing() {
        const degreeOuter = OUTER_R;
        const signOuter = OUTER_R - DEGREE_RING;
        svg.appendChild(el('circle', { cx:C, cy:C, r:signOuter, fill:'none', stroke:'#d1d5db', 'stroke-width':1 }));
        svg.appendChild(el('circle', { cx:C, cy:C, r:SIGN_INNER_R, fill:'white', stroke:'#d1d5db', 'stroke-width':1 }));

        const signNames = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                           'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
        for (let i = 0; i < 12; i++) {
            const startLong = i * 30;
            const endLong = startLong + 30;
            const startAngleDeg = longToAngle(startLong);
            const endAngleDeg = longToAngle(endLong);
            const sign = signNames[i];
            const elemKey = Symbols?.signElements?.[sign];
            const color = ELEMENT_COLORS[elemKey] || '#6b7280';

            // Match natal wheel: subtle element tint per zodiac sector.
            drawArc(signOuter, SIGN_INNER_R, endAngleDeg, startAngleDeg, `${color}18`);

            const lineAngle = endAngleDeg * Math.PI / 180;
            svg.appendChild(el('line', {
                x1: C + SIGN_INNER_R * Math.cos(lineAngle),
                y1: C + SIGN_INNER_R * Math.sin(lineAngle),
                x2: C + degreeOuter * Math.cos(lineAngle),
                y2: C + degreeOuter * Math.sin(lineAngle),
                stroke:'#9ca3af', 'stroke-width':1.5
            }));

            for (let deg = 0; deg < 30; deg += 5) {
                const tickAngle = longToAngle(startLong + deg) * Math.PI / 180;
                const tickInner = deg % 10 === 0 ? signOuter + 2 : signOuter + 5;
                svg.appendChild(el('line', {
                    x1: C + tickInner * Math.cos(tickAngle),
                    y1: C + tickInner * Math.sin(tickAngle),
                    x2: C + degreeOuter * Math.cos(tickAngle),
                    y2: C + degreeOuter * Math.sin(tickAngle),
                    stroke: '#9ca3af',
                    'stroke-width': deg % 10 === 0 ? '1' : '0.5'
                }));
            }

            // Sign symbol
            const midLong = startLong + 15;
            const midAngle = longToAngle(midLong) * Math.PI / 180;
            const textR = SIGN_INNER_R + SIGN_RING / 2;
            const sym = Symbols?.signs?.[sign] || sign.slice(0, 2);
            svg.appendChild(el('text', {
                x: C + textR * Math.cos(midAngle),
                y: C + textR * Math.sin(midAngle) + 5,
                'text-anchor':'middle', 'font-size': String(SIGN_SYMBOL_SIZE), fill:color, 'font-weight':'500',
                class: 'sign-symbol-text',
                style:'pointer-events:none'
            }, sym));
        }
    }

    function drawHouses(houses, options = {}) {
        if (!houses) return;
        const layer = options.layer || 'natal';
        const isPrognostic = layer === 'prognostic';
        const method = options.method || 'transit';
        const layerLabel = options.layerLabel || (isPrognostic ? t('page.forecast.biwheel.prognostic') : t('page.forecast.biwheel.legend.natal'));
        const progColor = getLayerConfig(method).color;
        const prognosticStyle = PROGNOSTIC_RING_STYLES[method] || PROGNOSTIC_RING_STYLES.transit;
        const visibleBandBounds = !isPrognostic ? getVisibleWheelBandBounds() : null;
        const extendNatalCuspsToForecastWheels = !isPrognostic
            && visibleBandBounds
            && visibleBandBounds.count > 1;

        if (!isPrognostic) {
            // Keep only the inner/aspect field clean without covering prognostic rings.
            svg.appendChild(el('circle', { cx:C, cy:C, r:ASPECT_R, fill:'#fafafa', stroke:'#d1d5db', 'stroke-width':0.5 }));
        }
        const wheelBand = isPrognostic ? getWheelBand(method) : null;
        houses.forEach((h, i) => {
            const angle = longToAngle(h.longitude) * Math.PI / 180;
            const isAngular = [1,4,7,10].includes(h.number);
            const innerR = isPrognostic
                ? wheelBand.inner
                : (isAngular ? ASPECT_R : (extendNatalCuspsToForecastWheels ? visibleBandBounds.inner : HOUSE_INNER_R));
            const outerR = isPrognostic
                ? wheelBand.outer
                : SIGN_INNER_R;
            const strokeColor = isPrognostic
                ? withAlpha(progColor, prognosticStyle.cuspAlpha)
                : (isAngular ? '#6366f1' : (extendNatalCuspsToForecastWheels ? '#94a3b8' : '#c7d2db'));
            const strokeWidth = isPrognostic
                ? (isAngular ? 2.3 : 1.9)
                : (isAngular ? 1.5 : (extendNatalCuspsToForecastWheels ? 0.95 : 0.5));
            const strokeDash = isPrognostic ? '4,3' : null;
            const defaultOpacity = isPrognostic ? prognosticStyle.cuspOpacity : '1';
            const cuspGroup = el('g', {
                class: 'bw-house-cusp',
                'data-house': String(h.number),
                'data-sign': h.sign || '',
                'data-degree-in-sign': String(h.degree_in_sign ?? 0),
                'data-longitude': String(h.longitude ?? 0),
                'data-layer-label': layerLabel,
                'data-default-stroke-width': String(strokeWidth),
                'data-default-opacity': defaultOpacity,
                style: 'cursor:pointer;'
            });
            cuspGroup.appendChild(el('line', {
                x1: C + innerR * Math.cos(angle), y1: C + innerR * Math.sin(angle),
                x2: C + outerR * Math.cos(angle), y2: C + outerR * Math.sin(angle),
                stroke:'transparent', 'stroke-width': isPrognostic ? 10 : 8,
                class: 'bw-house-cusp-hit'
            }));
            const visibleLineAttrs = {
                x1: C + innerR * Math.cos(angle), y1: C + innerR * Math.sin(angle),
                x2: C + outerR * Math.cos(angle), y2: C + outerR * Math.sin(angle),
                stroke: strokeColor, 'stroke-width': strokeWidth,
                opacity: defaultOpacity,
                class: 'bw-house-cusp-line'
            };
            if (strokeDash) visibleLineAttrs['stroke-dasharray'] = strokeDash;
            cuspGroup.appendChild(el('line', visibleLineAttrs));
            if (!isPrognostic) {
                // House number
                const nextH = houses[(i + 1) % 12];
                let midLong = (h.longitude + nextH.longitude) / 2;
                if (nextH.longitude < h.longitude) midLong = ((h.longitude + nextH.longitude + 360) / 2) % 360;
                const midAngle = longToAngle(midLong) * Math.PI / 180;
                const natalBand = getWheelBand('natal');
                const textR = natalBand.center;
                cuspGroup.appendChild(el('text', {
                    x: C + textR * Math.cos(midAngle), y: C + textR * Math.sin(midAngle) + 3,
                    'text-anchor':'middle', 'font-size':'10', fill: isAngular ? '#6366f1' : '#6b7280',
                    'font-weight': isAngular ? '700' : '400', style:'pointer-events:none'
                }, String(h.number)));
            }
            cuspGroup.addEventListener('mouseenter', onHouseHover);
            cuspGroup.addEventListener('mousemove', onHouseHover);
            cuspGroup.addEventListener('mouseleave', onHouseLeave);
            svg.appendChild(cuspGroup);
        });
    }



    function drawAspectCircle() {
        svg.appendChild(el('circle', { cx:C, cy:C, r:ASPECT_R, fill:'none', stroke:'#e5e7eb', 'stroke-width':0.5 }));
    }

    function getWheelBand(methodOrLayer = 'transit') {
        const normalized = normalizeWheelMethod(methodOrLayer);
        const band = wheelBandsByMethod.get(normalized);
        if (band) return band;
        const idx = WHEEL_ORDER.indexOf(normalized);
        const safeIdx = idx === -1 ? 1 : idx;
        const inner = ASPECT_R + WHEEL_INSET + safeIdx * (DEFAULT_WHEEL_BAND_WIDTH + WHEEL_GAP);
        const outer = inner + DEFAULT_WHEEL_BAND_WIDTH;
        return { inner, outer, center: inner + (DEFAULT_WHEEL_BAND_WIDTH / 2) };
    }

    function drawMethodRing(method = 'transit') {
        const band = getWheelBand(method);
        const styleByMethod = {
            natal: { color: '#374151', fillAlpha: '26' },
            transit: { color: getLayerConfig('transit').color, fillAlpha: PROGNOSTIC_RING_STYLES.transit.ringAlpha },
            progression: { color: getLayerConfig('progression').color, fillAlpha: PROGNOSTIC_RING_STYLES.progression.ringAlpha },
            direction: { color: getLayerConfig('direction').color, fillAlpha: PROGNOSTIC_RING_STYLES.direction.ringAlpha },
            solar_return: { color: getLayerConfig('solar_return').color, fillAlpha: PROGNOSTIC_RING_STYLES.solar_return.ringAlpha },
        };
        const style = styleByMethod[method] || styleByMethod.transit;
        svg.appendChild(el('circle', {
            cx: C,
            cy: C,
            r: band.center,
            fill: 'none',
            stroke: withAlpha(style.color, style.fillAlpha),
            'stroke-width': wheelBandWidth.toFixed(2),
            class: 'bw-method-ring',
            'data-layer': method,
        }));
    }

    function drawWheelSeparators(layers = []) {
        const radii = new Set();
        if (layerVisibility.natal) {
            const natalBand = getWheelBand('natal');
            radii.add(natalBand.inner.toFixed(3));
            radii.add(natalBand.outer.toFixed(3));
        }
        layers.forEach(layer => {
            if (!isLayerVisible(layer.method)) return;
            const band = getWheelBand(layer.method);
            radii.add(band.inner.toFixed(3));
            radii.add(band.outer.toFixed(3));
        });
        [...radii]
            .map(value => Number(value))
            .sort((a, b) => a - b)
            .forEach(radius => {
                svg.appendChild(el('circle', {
                    cx: C,
                    cy: C,
                    r: radius,
                    fill: 'none',
                    stroke: WHEEL_SEPARATOR_COLOR,
                    'stroke-width': WHEEL_SEPARATOR_WIDTH,
                    opacity: String(WHEEL_SEPARATOR_OPACITY),
                }));
            });
    }

    // ─── Draw planets ───────────────────────────────────
    function getLayerConfig(method) {
        return PROGNOSTIC_LAYERS[method] || PROGNOSTIC_LAYERS.transit;
    }

    function getLayerRadius(method) {
        if (method === 'natal') return getWheelBand('natal').center;
        return getWheelBand(method).center;
    }

    function isLayerVisible(method) {
        return layerVisibility[method] !== false;
    }

    function getProgMeta(data, forcedMethod = null) {
        const method = forcedMethod || (
            data?.transit_planets ? 'transit'
                : data?.progressed_planets ? 'progression'
                    : data?.directed_planets ? 'direction'
                        : (data?.solar_planets || data?.solar_return_planets) ? 'solar_return'
                            : 'transit'
        );
        const cfg = getLayerConfig(method);
        return { method, color: cfg.color };
    }

    function buildPrognosticLayers(data) {
        if (!data) return [];
        if (data._combined && data._layers) {
            return [
                { method: 'transit', methodKey: 'transits', payload: data._layers.transit },
                { method: 'progression', methodKey: 'progressions', payload: data._layers.progression },
                { method: 'direction', methodKey: 'directions', payload: data._layers.direction },
            ].filter(layer => layer.payload).map(layer => ({
                ...layer,
                color: getLayerConfig(layer.method).color,
                planets: extractProgPlanets(layer.payload, layer.method),
                houses: extractProgHouses(layer.payload, layer.method),
                aspects: extractAspects(layer.payload, layer.method, layer.methodKey),
                ingresses: extractIngresses(layer.payload, layer.methodKey),
            }));
        }

        const meta = getProgMeta(data);
        const methodKey = data?._method || getLayerConfig(meta.method).tableMethod;
        return [{
            method: meta.method,
            methodKey,
            payload: data,
            color: meta.color,
            planets: extractProgPlanets(data, meta.method),
            houses: extractProgHouses(data, meta.method),
            aspects: extractAspects(data, meta.method, methodKey),
            ingresses: extractIngresses(data, methodKey),
        }];
    }

    function drawPlanets(planets, radius, defaultColor, fontSize, colorByElement = false, layerType = 'natal', layerMethod = 'natal') {
        if (!planets || !planets.length) return;
        const layerScale = layerType === 'natal' ? natalPointScale : transitPointScale;
        const wheelBand = getWheelBand(layerMethod);
        const displayRadius = Math.max(wheelBand.inner + 1.2, Math.min(wheelBand.outer - 1.2, radius));
        const calloutRadius = Math.min(wheelBand.outer - 0.8, wheelBand.inner + 0.8);
        const desiredGapPx = Math.max(fontSize * layerScale * 0.9, 10);
        const minGapDeg = Math.max(1.5, (desiredGapPx / (2 * Math.PI * Math.max(displayRadius, 1))) * 360);
        const spreadDeg = Math.max(1.5, minGapDeg * 0.95);
        const positions = planets.map(p => ({
            planet: p,
            angle: normalizeAngle(longToAngle(p.longitude)),
            displayAngle: normalizeAngle(longToAngle(p.longitude)),
            hasLeader: false,
            clusterAngle: null,
        })).sort((a, b) => a.angle - b.angle);

        if (positions.length > 1) {
            const clusters = [];
            let currentCluster = [positions[0]];
            for (let i = 1; i < positions.length; i++) {
                const prev = positions[i - 1];
                const curr = positions[i];
                const diff = curr.angle - prev.angle;
                if (diff < minGapDeg) {
                    currentCluster.push(curr);
                } else {
                    clusters.push(currentCluster);
                    currentCluster = [curr];
                }
            }
            clusters.push(currentCluster);

            if (clusters.length > 1) {
                const firstCluster = clusters[0];
                const lastCluster = clusters[clusters.length - 1];
                const wrapGap = (firstCluster[0].angle + 360) - lastCluster[lastCluster.length - 1].angle;
                if (wrapGap < minGapDeg) {
                    const merged = [...lastCluster, ...firstCluster];
                    merged.forEach((item, idx) => {
                        item.clusterAngle = idx < lastCluster.length ? item.angle : item.angle + 360;
                    });
                    clusters[0] = merged;
                    clusters.pop();
                }
            }

            clusters.forEach((cluster) => {
                cluster.forEach(item => {
                    if (item.clusterAngle == null) item.clusterAngle = item.angle;
                });
                if (cluster.length === 1) return;
                const center = (cluster.length - 1) / 2;
                cluster.forEach((item, idx) => {
                    const offset = (idx - center) * spreadDeg;
                    item.displayAngle = normalizeAngle(item.clusterAngle + offset);
                    item.hasLeader = Math.abs(offset) > 0.01;
                });
            });
        }

        positions.forEach(({ planet, angle, displayAngle, hasLeader }) => {
            const p = polar(displayRadius, displayAngle);
            const exactPoint = polar(calloutRadius, angle);
            const sym = Symbols?.planets?.[planet.name] || planet.name.slice(0, 2);
            const glyphScale = Symbols?.planetGlyphScale?.[planet.name] || 1;
            const glyphSize = fontSize * glyphScale * layerScale;
            const element = Symbols?.signElements?.[planet.sign];
            const isNatal = layerType === 'natal';
            const color = isNatal
                ? (colorByElement ? (ELEMENT_COLORS[element] || defaultColor) : defaultColor)
                : PROGNOSTIC_GLYPH_COLOR;
            const label = getPlanetName(planet.name);
            const group = el('g', {
                class: `bw-planet-group ${isNatal ? 'bw-natal-planet' : 'bw-prog-planet'}`,
                'data-planet-role': isNatal ? 'natal' : 'transit',
                'data-method': isNatal ? 'natal' : (planet._method || 'transit'),
                'data-planet-name': planet.name,
                'data-sign': planet.sign || '',
                'data-degree-in-sign': String(planet.degree_in_sign ?? 0),
                'data-house': String(planet.house ?? ''),
                'data-retrograde': planet.retrograde ? 'true' : 'false',
                'aria-label': `${isNatal ? t('page.forecast.biwheel.legend.natal') : t('page.forecast.biwheel.prognostic')} ${label}`
            });

            if (hasLeader) {
                group.appendChild(el('line', {
                    x1: p.x,
                    y1: p.y,
                    x2: exactPoint.x,
                    y2: exactPoint.y,
                    stroke: color,
                    'stroke-width': '0.35',
                    opacity: '0.3',
                    style: 'pointer-events:none'
                }));
                group.appendChild(el('circle', {
                    cx: exactPoint.x,
                    cy: exactPoint.y,
                    r: '1.6',
                    fill: color,
                    opacity: '0.8',
                    style: 'pointer-events:none'
                }));
            }

            const glyph = el('text', {
                x: p.x, y: p.y + glyphSize * 0.35,
                'text-anchor':'middle', 'font-size': glyphSize.toFixed(2), fill: color,
                'font-weight': isNatal ? '700' : '600',
                opacity: '1',
                class: `bw-planet-glyph ${isNatal ? 'bw-planet-natal' : 'bw-planet-prog'}`,
            }, sym);
            group.appendChild(glyph);

            if (planet.retrograde) {
                const rxScale = Math.min(1.1, layerScale);
                group.appendChild(el('text', {
                    x: p.x + glyphSize * 0.36, y: p.y + glyphSize * 0.42,
                    'font-size': String((RETRO_SYMBOL_SIZE * rxScale).toFixed(2)), fill:'#dc2626',
                    'font-weight':'700',
                    class: 'bw-retro-mark'
                }, 'R'));
            }

            group.addEventListener('click', () => {
                clearFocus();
                togglePlanetAspectFilter(isNatal ? 'natal' : 'transit', planet.name);
                rerenderLast();
            });
            group.addEventListener('mouseenter', onPlanetHover);
            group.addEventListener('mousemove', onPlanetHover);
            group.addEventListener('mouseleave', onPlanetLeave);
            svg.appendChild(group);
        });
    }

    function formatDMS(value) {
        const deg = Number(value);
        if (!Number.isFinite(deg)) return '—';
        const d = Math.floor(deg);
        const mFull = (deg - d) * 60;
        const m = Math.floor(mFull);
        const s = Math.round((mFull - m) * 60);
        return `${d}°${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"`;
    }

    function ensureHoverTooltip() {
        if (hoverTooltip && hoverTooltip.isConnected) return hoverTooltip;
        const wrapper = document.getElementById('biwheelSvgWrapper');
        if (!wrapper) return null;
        hoverTooltip = wrapper.querySelector('.chart-tooltip');
        if (!hoverTooltip) {
            hoverTooltip = document.createElement('div');
            hoverTooltip.className = 'chart-tooltip';
            wrapper.appendChild(hoverTooltip);
        }
        return hoverTooltip;
    }

    function placeHoverTooltip(event, tooltip) {
        const wrapper = document.getElementById('biwheelSvgWrapper');
        if (!wrapper || !tooltip) return;
        const rect = wrapper.getBoundingClientRect();
        let x = event.clientX - rect.left + 12;
        let y = event.clientY - rect.top + 6;
        const maxX = rect.width - tooltip.offsetWidth - 8;
        const maxY = rect.height - tooltip.offsetHeight - 8;
        x = Math.max(8, Math.min(x, Math.max(8, maxX)));
        y = Math.max(8, Math.min(y, Math.max(8, maxY)));
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
    }

    function showHoverTooltip(html, event) {
        const tooltip = ensureHoverTooltip();
        if (!tooltip) return;
        tooltip.innerHTML = html;
        tooltip.style.display = 'block';
        placeHoverTooltip(event, tooltip);
    }

    function hideHoverTooltip() {
        const tooltip = ensureHoverTooltip();
        if (tooltip) tooltip.style.display = 'none';
    }

    function getAspectTooltipHtml(aspect) {
        const transitBody = aspect?.transitBody || '';
        const natalBody = aspect?.natalBody || '';
        const aspectType = aspect?.aspectType || '';
        const transitSym = Symbols?.planets?.[transitBody] || '';
        const natalSym = Symbols?.planets?.[natalBody] || '';
        const aspectSym = Symbols?.aspects?.[aspectType] || '';
        const transitName = getPlanetName(transitBody);
        const natalName = getPlanetName(natalBody);
        const aspectName = getAspectName(aspectType);
        const orb = Number(aspect?.orb);
        const orbLabel = Number.isFinite(orb) ? `${orb.toFixed(2)}°` : '—';
        const methodLabel = getMethodLabelShort(aspect?.methodKey || getLayerConfig(aspect?.method || 'transit').tableMethod);

        return `
            <strong>${escapeHtml(methodLabel)}: <span class="astro-symbol">${transitSym}</span> ${escapeHtml(transitName)} <span class="astro-symbol">${aspectSym}</span> ${escapeHtml(aspectName)} <span class="astro-symbol">${natalSym}</span> ${escapeHtml(natalName)}</strong><br>
            ${escapeHtml(t('common.orb'))}: ${escapeHtml(orbLabel)}
        `;
    }

    function matchesFocusDataset(dataset = {}) {
        if (!focusState.mode) return true;
        if (focusState.mode === 'aspect') {
            if (focusState.aspectKey) {
                return dataset.aspectKey === focusState.aspectKey;
            }
            const methodMatches = !focusState.method || dataset.method === focusState.method;
            return methodMatches &&
                dataset.transit === focusState.transitBody &&
                dataset.natal === focusState.natalBody &&
                dataset.aspect === focusState.aspectType;
        }
        if (focusState.mode === 'planet') {
            return focusState.planetRole === 'transit'
                ? dataset.transit === focusState.planetName
                : dataset.natal === focusState.planetName;
        }
        return true;
    }

    function isHoverAllowedForAspect(aspectKey) {
        if (!aspectKey) return false;
        if (!focusState.mode) return true;
        const aspect = aspectLookupByKey.get(aspectKey);
        if (!aspect) return false;
        return matchesFocusDataset({
            method: aspect.method || '',
            transit: aspect.transitBody || '',
            natal: aspect.natalBody || '',
            aspect: aspect.aspectType || '',
            aspectKey,
        });
    }

    function toggleHoverClassesByAspectKey(aspectKey, active) {
        if (!aspectKey) return;
        const escaped = escapeSelectorValue(aspectKey);
        if (svg) {
            svg.querySelectorAll(`.bw-aspect-line[data-aspect-key="${escaped}"]`).forEach((line) => {
                line.classList.toggle('bw-hover-line', active);
            });
        }
        const table = document.getElementById('biwheelAspects');
        if (table) {
            table.querySelectorAll(`tbody tr[data-aspect-key="${escaped}"]`).forEach((tr) => {
                tr.classList.toggle('bw-hover-row', active);
            });
        }
    }

    function refreshHoveredAspectVisual() {
        if (!hoverState.aspectKey) return;
        toggleHoverClassesByAspectKey(hoverState.aspectKey, isHoverAllowedForAspect(hoverState.aspectKey));
    }

    function setHoveredAspectState(aspectKey, options = {}) {
        if (!aspectKey) {
            clearHoveredAspectState({ force: true, hideTooltip: options.hideTooltip === true });
            return;
        }

        if (hoverState.aspectKey && hoverState.aspectKey !== aspectKey) {
            toggleHoverClassesByAspectKey(hoverState.aspectKey, false);
        }

        hoverState = {
            aspectKey,
            source: options.source || null,
        };
        refreshHoveredAspectVisual();

        if (options.showTooltip) {
            const aspect = aspectLookupByKey.get(aspectKey);
            if (aspect && options.event) {
                showHoverTooltip(getAspectTooltipHtml(aspect), options.event);
            }
        }
    }

    function clearHoveredAspectState(options = {}) {
        if (!hoverState.aspectKey) {
            if (options.hideTooltip) hideHoverTooltip();
            return;
        }
        if (!options.force) {
            if (options.source && hoverState.source && options.source !== hoverState.source) return;
            if (options.aspectKey && options.aspectKey !== hoverState.aspectKey) return;
        }

        toggleHoverClassesByAspectKey(hoverState.aspectKey, false);
        hoverState = { aspectKey: null, source: null };
        if (options.hideTooltip) hideHoverTooltip();
    }

    function applyPanelCollapseStates() {
        const leftbar = document.querySelector('.biwheel-leftbar');
        const sidebar = document.querySelector('.biwheel-sidebar');
        const ingressesList = document.getElementById('biwheelIngresses');
        const aspectsList = document.getElementById('biwheelAspects');
        const openIngressesBtn = document.getElementById('bwOpenIngresses');
        const openAspectsBtn = document.getElementById('bwOpenAspects');
        const main = document.querySelector('.biwheel-main');

        const showIngressPanel = ingressesAvailable && !ingressesCollapsed;
        if (leftbar) leftbar.classList.toggle('bw-panel-hidden', !showIngressPanel);
        if (ingressesList) ingressesList.classList.toggle('bw-panel-collapsed', !showIngressPanel);
        if (openIngressesBtn) {
            openIngressesBtn.style.display = (ingressesAvailable && ingressesCollapsed) ? 'inline-flex' : 'none';
        }

        const showAspectsPanel = !aspectsCollapsed;
        if (sidebar) sidebar.classList.toggle('bw-panel-hidden', !showAspectsPanel);
        if (aspectsList) aspectsList.classList.toggle('bw-panel-collapsed', !showAspectsPanel);
        if (openAspectsBtn) {
            openAspectsBtn.style.display = aspectsCollapsed ? 'inline-flex' : 'none';
        }
        if (main) {
            main.classList.toggle('bw-ingresses-visible', showIngressPanel);
            main.classList.toggle('bw-aspects-visible', showAspectsPanel);
        }
    }

    function onPlanetHover(event) {
        const group = event.currentTarget;
        const methodKey = group.getAttribute('data-method') || '';
        const role = group.getAttribute('data-planet-role') === 'natal'
            ? t('page.forecast.biwheel.legend.natal')
            : getPrognosticHouseLayerLabel(methodKey);
        const name = group.getAttribute('data-planet-name') || '';
        const sign = group.getAttribute('data-sign') || '';
        const house = group.getAttribute('data-house') || '—';
        const retro = group.getAttribute('data-retrograde') === 'true';
        const degree = Number(group.getAttribute('data-degree-in-sign') || 0);
        const symbol = Symbols?.planets?.[name] || '';
        const nameRu = getPlanetName(name);
        const signSymbol = Symbols?.signs?.[sign] || '';
        const signRu = getSignName(sign);

        showHoverTooltip(`
            <strong>${role}: <span class="astro-symbol">${symbol}</span> ${nameRu}</strong><br>
            <span class="astro-symbol">${signSymbol}</span> ${signRu} ${formatDMS(degree)}<br>
            ${t('common.house')}: ${house}${retro ? ' <span style="color:#dc2626">R</span>' : ''}
        `, event);
    }

    function onPlanetLeave() {
        hideHoverTooltip();
    }

    function onHouseHover(event) {
        const group = event.currentTarget;
        const line = group.querySelector('.bw-house-cusp-line');
        const houseNumber = Number(group.getAttribute('data-house') || 0);
        const layerLabel = group.getAttribute('data-layer-label') || t('page.forecast.biwheel.legend.natal');
        const sign = group.getAttribute('data-sign') || '';
        const signRu = getSignName(sign);
        const signSymbol = Symbols?.signs?.[sign] || '';
        const degree = Number(group.getAttribute('data-degree-in-sign') || 0);
        const longitude = Number(group.getAttribute('data-longitude') || 0);
        const defaultWidth = Number(group.getAttribute('data-default-stroke-width') || 1);

        if (line) {
            line.setAttribute('stroke-width', String((defaultWidth + 0.9).toFixed(2)));
            line.setAttribute('opacity', '1');
        }

        showHoverTooltip(`
            <strong>${layerLabel}: ${t('page.forecast.table.ingress.cuspLabel', { house: houseNumber }).toLowerCase()}</strong><br>
            <span class="astro-symbol">${signSymbol}</span> ${signRu} ${formatDMS(degree)}<br>
            ${t('common.longitude')}: ${formatDMS(longitude)}
        `, event);
    }

    function onHouseLeave(event) {
        const group = event.currentTarget;
        const line = group.querySelector('.bw-house-cusp-line');
        if (line) {
            line.setAttribute('stroke-width', group.getAttribute('data-default-stroke-width') || '1');
            line.setAttribute('opacity', group.getAttribute('data-default-opacity') || '1');
        }
        hideHoverTooltip();
    }

    function onAspectLineHoverEnter(event) {
        const line = event.currentTarget;
        const aspectKey = line?.dataset?.aspectKey;
        if (!aspectKey) return;
        setHoveredAspectState(aspectKey, {
            source: 'line',
            showTooltip: true,
            event,
        });
    }

    function onAspectLineHoverMove(event) {
        const line = event.currentTarget;
        const aspectKey = line?.dataset?.aspectKey;
        if (!aspectKey || hoverState.aspectKey !== aspectKey || hoverState.source !== 'line') return;
        const tooltip = ensureHoverTooltip();
        if (!tooltip || tooltip.style.display === 'none') return;
        placeHoverTooltip(event, tooltip);
    }

    function onAspectLineHoverLeave(event) {
        const line = event.currentTarget;
        const aspectKey = line?.dataset?.aspectKey;
        clearHoveredAspectState({
            source: 'line',
            aspectKey,
            hideTooltip: true,
        });
    }

    function onAspectLineClick(event) {
        const line = event.currentTarget;
        if (!line) return;
        setFocusAspect(
            line.dataset.transit || null,
            line.dataset.natal || null,
            line.dataset.aspect || null,
            line.dataset.method || null,
            line.dataset.aspectKey || null
        );
    }

    function onAspectRowHoverEnter(event) {
        const row = event.currentTarget;
        const aspectKey = row?.dataset?.aspectKey;
        if (!aspectKey) return;
        setHoveredAspectState(aspectKey, { source: 'table' });
    }

    function onAspectRowHoverLeave(event) {
        const row = event.currentTarget;
        const aspectKey = row?.dataset?.aspectKey;
        clearHoveredAspectState({
            source: 'table',
            aspectKey,
        });
    }

    function extractProgPlanets(data, forcedMethod = null) {
        const meta = getProgMeta(data, forcedMethod);
        const enrich = p => ({
            ...p,
            house: p.house ?? p.progressed_house ?? p.directed_house ?? p.natal_house ?? '',
            _color: meta.color,
            _method: meta.method,
        });
        if (!data) return [];
        if (data.transit_planets) return data.transit_planets.map(enrich);
        if (data.progressed_planets) return data.progressed_planets.map(enrich);
        if (data.directed_planets) {
            const planets = data.directed_planets.map(enrich);
            if (data.directed_angles) data.directed_angles.forEach(a => planets.push(enrich(a)));
            return planets;
        }
        return [];
    }

    function extractProgHouses(data, forcedMethod = null) {
        const meta = getProgMeta(data, forcedMethod);
        if (!data) return [];
        if (meta.method === 'progression' && Array.isArray(data.progressed_houses)) return data.progressed_houses;
        if (meta.method === 'direction' && Array.isArray(data.directed_houses)) return data.directed_houses;
        return [];
    }

    function getPrognosticHouseLayerLabel(method) {
        if (method === 'transit') return t('common.method.transit');
        if (method === 'progression') return t('common.method.progression');
        if (method === 'direction') return t('common.method.direction');
        if (method === 'solar_return') return t('common.method.solar');
        return t('page.forecast.biwheel.prognostic');
    }

    function extractAspects(data, method = null, methodKey = null) {
        if (!data) return [];
        const meta = getProgMeta(data, method);
        const effectiveMethodKey = methodKey || getLayerConfig(meta.method).tableMethod;
        if (data.aspects) {
            return data.aspects.map(a => ({
                transitBody: a.transit_planet, natalBody: a.natal_object,
                aspectType: a.aspect_type, orb: a.orb, isMajor: a.is_major,
                method: meta.method,
                methodKey: effectiveMethodKey,
            }));
        }
        if (data.aspects_to_natal) {
            return data.aspects_to_natal.map(a => ({
                transitBody: a.progressed_planet || a.directed_object,
                natalBody: a.natal_object, aspectType: a.aspect_type,
                orb: a.orb, isMajor: a.is_major,
                method: meta.method,
                methodKey: effectiveMethodKey,
            }));
        }
        return [];
    }

    function getMethodLabelShort(methodKey) {
        if (methodKey === 'progressions') return t('common.method.progression');
        if (methodKey === 'directions') return t('common.method.direction');
        if (methodKey === 'solar_return') return t('common.method.solar');
        return t('common.method.transit');
    }

    function getMethodBadgeClass(methodKey) {
        if (methodKey === 'progressions') return 'progression';
        if (methodKey === 'directions') return 'direction';
        if (methodKey === 'solar_return') return 'direction';
        return 'transit';
    }

    function extractIngresses(data, methodKey = null) {
        if (!data) return [];
        const method = methodKey || data?._method;
        const methodSupported = method === 'progressions' || method === 'directions';
        if (!methodSupported) return [];

        const targetDate = data?.progression_info?.target_date || data?.direction_info?.target_date || null;
        const list = [];
        const fmtSign = sign => {
            if (!sign) return '—';
            const sym = Symbols?.signs?.[sign] || '';
            return sym || sign;
        };

        (data.planet_ingresses || []).forEach(ing => {
            const body = ing.body || '—';
            const bodySym = Symbols?.planets?.[body] || '';
            const isHouseIngress = ing.ingress_type === 'house';
            const fromPart = isHouseIngress
                ? t('page.forecast.table.houseLabel', { house: ing.from_house ?? t('common.notAvailable') })
                : fmtSign(ing.from_sign);
            const toPart = isHouseIngress
                ? t('page.forecast.table.houseLabel', { house: ing.to_house ?? t('common.notAvailable') })
                : fmtSign(ing.to_sign);
            list.push({
                date: targetDate,
                object: bodySym || body,
                transition: `${fromPart} → ${toPart}`,
                method: method,
                methodLabel: getMethodLabelShort(method),
                methodClass: getMethodBadgeClass(method),
            });
        });

        (data.house_cusp_ingresses || []).forEach(ing => {
            list.push({
                date: targetDate,
                object: t('page.forecast.table.ingress.cuspLabel', { house: ing.house_number }),
                transition: `${fmtSign(ing.from_sign)} → ${fmtSign(ing.to_sign)}`,
                method: method,
                methodLabel: getMethodLabelShort(method),
                methodClass: getMethodBadgeClass(method),
            });
        });

        return list;
    }

    function drawCrossAspects(aspects, natalMap, progPlanets, method = 'transit') {
        const layerCfg = getLayerConfig(method);
        const progMap = {};
        (progPlanets || []).forEach(p => progMap[p.name] = p.longitude);

        aspects.forEach(a => {
            const nLong = natalMap[a.natalBody];
            const pLong = progMap[a.transitBody];
            if (nLong == null || pLong == null) return;
            const aspectKey = getAspectKey(a);
            const nAngle = longToAngle(nLong) * Math.PI / 180;
            const pAngle = longToAngle(pLong) * Math.PI / 180;
            const aspectColor = ASPECT_COLORS[a.aspectType] || '#9ca3af';
            const color = aspectColor === '#9ca3af' ? layerCfg.color : aspectColor;
            const line = el('line', {
                x1: C + ASPECT_R * Math.cos(nAngle), y1: C + ASPECT_R * Math.sin(nAngle),
                x2: C + ASPECT_R * Math.cos(pAngle), y2: C + ASPECT_R * Math.sin(pAngle),
                stroke: color, 'stroke-width': a.isMajor ? 1.3 : 0.7,
                'stroke-dasharray': a.isMajor ? 'none' : '4,4',
                opacity: a.isMajor ? 0.5 : 0.22,
                'data-transit': a.transitBody, 'data-natal': a.natalBody, 'data-aspect': a.aspectType, 'data-method': a.method || method,
                'data-aspect-key': aspectKey || '',
                class: `bw-aspect-line ${a.isMajor ? 'bw-aspect-major' : 'bw-aspect-minor'}`
            });
            line.addEventListener('mouseenter', onAspectLineHoverEnter);
            line.addEventListener('mousemove', onAspectLineHoverMove);
            line.addEventListener('mouseleave', onAspectLineHoverLeave);
            line.addEventListener('click', onAspectLineClick);
            svg.appendChild(line);
        });
    }

    const BW_PLANET_ORDER = ['Pluto','Neptune','Uranus','Chiron','Saturn','Jupiter','TrueNorthNode','TrueSouthNode','BlackMoon','Proserpina','Mars','Venus','Mercury','Sun','Moon'];

    let lastAspects = [];
    let sortCol = 'transit_priority';
    let sortAsc = true;

    function renderPanelHeader(title, options = {}) {
        const collapseId = options.collapseId || '';
        const collapseLabel = options.collapseLabel || '';
        const controlsId = options.controlsId || '';
        const icon = options.icon || '→';
        return `<div class="bw-panel-header">
            <div class="bw-panel-title">${escapeHtml(title)}</div>
            <button
                type="button"
                class="bw-panel-collapse-btn"
                id="${collapseId}"
                aria-expanded="true"
                aria-controls="${controlsId}"
                aria-label="${escapeHtml(collapseLabel)}"
                title="${escapeHtml(collapseLabel)}"
            >
                <span class="bw-panel-collapse-icon" aria-hidden="true">${icon}</span>
            </button>
        </div>`;
    }

    function renderAspectsTable(aspects) {
        const container = document.getElementById('biwheelAspects');
        if (!container) return;
        if (!aspects.length) {
            container.innerHTML = `<div class="bw-panel-section">
                ${renderPanelHeader(t('page.chart.tabs.aspects'), {
                    collapseId: 'bwToggleAspectsInTable',
                    collapseLabel: t('page.forecast.biwheel.collapseAspects'),
                    controlsId: 'bwAspectsPanelBody',
                    icon: '→'
                })}
                <div class="bw-panel-body" id="bwAspectsPanelBody">
                    <table><thead><tr>
                        <th>${t('page.chart.tabs.aspects')}</th>
                    </tr></thead><tbody><tr><td style="padding:12px;color:var(--text-secondary);font-size:1rem">${t('page.forecast.table.noAspects')}</td></tr></tbody></table>
                </div>
            </div>`;
            lastAspects = [];
            container.querySelector('#bwToggleAspectsInTable')?.addEventListener('click', (event) => {
                event.stopPropagation();
                aspectsCollapsed = true;
                applyPanelCollapseStates();
                triggerLayoutAnimation();
            });
            applyPanelCollapseStates();
            return;
        }
        lastAspects = aspects;
        buildAspectsHTML(container);
        applyPanelCollapseStates();
    }

    function escapeHtml(text) {
        return String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

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

    function formatIngressValue(value, ingressType) {
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

    function formatLegacyHoverLine(line) {
        const safe = escapeHtml(String(line || ''));
        return safe.replace(/(\d{4}-\d{2}-\d{2})/g, (_, m1) => formatDateShort6(m1));
    }

    function buildIngressHoverHtml(row) {
        const details = Array.isArray(row.hoverDetails) ? row.hoverDetails : [];
        if (details.length) {
            const blocks = details.map((detail) => {
                const ingressType = detail?.ingress_type || 'none';
                if (ingressType === 'none') {
                    const fromLabel = formatIngressValue(detail?.from, ingressType);
                    const toLabel = formatIngressValue(detail?.to, ingressType);
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
                const fromLabel = formatIngressValue(detail?.from, ingressType);
                const toLabel = formatIngressValue(detail?.to, ingressType);
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
        return `<div class="bw-hover-wrap">${lines.map((line) => `<div class="bw-hover-item"><div class="bw-hover-head">${formatLegacyHoverLine(line)}</div></div>`).join('')}</div>`;
    }

    function expandIngressSummaryRow(row) {
        const methodKey = row.method || '';
        const methodLabel = methodKey === 'progressions'
            ? t('common.method.progression')
            : t('common.method.direction');
        const methodClass = row.method_class || (methodKey === 'progressions' ? 'progression' : 'direction');
        let objectLabel = row.object || '';
        let objectHtml = escapeHtml(objectLabel);
        if (row.object_key && !String(row.object_key).startsWith('Cusp')) {
            const name = getPlanetName(row.object_key);
            const retro = isTransitBodyRetrograde(row.object_key, methodKey);
            objectLabel = name;
            objectHtml = formatCompactBodyGlyph(row.object_key, retro);
        } else if (row.object_key?.startsWith('Cusp')) {
            const houseNumber = String(row.object_key).replace('Cusp', '');
            objectLabel = t('page.forecast.table.ingress.cuspLabel', { house: houseNumber });
            objectHtml = escapeHtml(objectLabel);
        }

        const hoverDetails = Array.isArray(row.hover_details) ? row.hover_details : (Array.isArray(row.hoverDetails) ? row.hoverDetails : []);
        const buildRow = (details, transition) => ({
            ...row,
            object: objectLabel,
            objectHtml,
            methodLabel,
            methodClass,
            transition,
            hoverDetails: details,
            hoverLines: details.map((item) => item?.text).filter(Boolean),
        });

        if (row.object_key && String(row.object_key).startsWith('Cusp')) {
            const signDetails = hoverDetails.filter((item) => item?.ingress_type === 'sign');
            if (!signDetails.length) return [];
            const first = signDetails[0];
            const last = signDetails[signDetails.length - 1];
            return [buildRow(signDetails, `${formatIngressValue(first?.from, 'sign')} → ${formatIngressValue(last?.to, 'sign')}`)];
        }

        const signDetails = hoverDetails.filter((item) => item?.ingress_type === 'sign');
        const houseDetails = hoverDetails.filter((item) => item?.ingress_type === 'house');
        const rows = [];
        if (signDetails.length) {
            const first = signDetails[0];
            const last = signDetails[signDetails.length - 1];
            rows.push(buildRow(signDetails, `${formatIngressValue(first?.from, 'sign')} → ${formatIngressValue(last?.to, 'sign')}`));
        }
        if (houseDetails.length) {
            const first = houseDetails[0];
            const last = houseDetails[houseDetails.length - 1];
            rows.push(buildRow(houseDetails, `${formatIngressValue(first?.from, 'house')} → ${formatIngressValue(last?.to, 'house')}`));
        }
        return rows;
    }

    function getIngressRowsForRender() {
        const summaryRows = window.ForecastState?.ingressSummaryData?.rows;
        if (!Array.isArray(summaryRows) || !summaryRows.length) {
            return [];
        }
        return summaryRows
            .filter((row) => {
                if (row.method === 'progressions') return isLayerVisible('progression');
                if (row.method === 'directions') return isLayerVisible('direction');
                return true;
            })
            .flatMap((row) => expandIngressSummaryRow(row));
    }

    function renderIngressesTable(ingresses) {
        const container = document.getElementById('biwheelIngresses');
        if (!container) return;
        if (window.ForecastState?.ingressSummaryError) {
            ingressesAvailable = true;
            container.style.display = '';
            container.innerHTML = `<div class="bw-panel-section">
                ${renderPanelHeader(t('page.forecast.table.ingresses.title'), {
                    collapseId: 'bwToggleIngressesInTable',
                    collapseLabel: t('page.forecast.biwheel.collapseIngresses'),
                    controlsId: 'bwIngressesPanelBody',
                    icon: '←'
                })}
                <div class="bw-panel-body" id="bwIngressesPanelBody">
                    <table><thead><tr>
                        <th>${t('page.forecast.table.columns.object')}</th>
                        <th>${t('page.forecast.table.columns.method')}</th>
                        <th>${t('page.forecast.table.columns.transition')}</th>
                    </tr></thead><tbody><tr>
                        <td colspan="3" style="padding:10px;color:var(--text-secondary)">${escapeHtml(window.ForecastState.ingressSummaryError)}</td>
                    </tr></tbody></table>
                </div>
            </div>`;
            container.querySelector('#bwToggleIngressesInTable')?.addEventListener('click', (event) => {
                event.stopPropagation();
                ingressesCollapsed = true;
                applyPanelCollapseStates();
                triggerLayoutAnimation();
            });
            applyPanelCollapseStates();
            return;
        }
        if (!ingresses?.length) {
            ingressesAvailable = false;
            ingressesCollapsed = false;
            container.innerHTML = '';
            container.style.display = 'none';
            applyPanelCollapseStates();
            return;
        }
        ingressesAvailable = true;

        let html = `<div class="bw-panel-section">
            ${renderPanelHeader(t('page.forecast.table.ingresses.title'), {
                collapseId: 'bwToggleIngressesInTable',
                collapseLabel: t('page.forecast.biwheel.collapseIngresses'),
                controlsId: 'bwIngressesPanelBody',
                icon: '←'
            })}
            <div class="bw-panel-body" id="bwIngressesPanelBody">
                <table><thead><tr>
                    <th>${t('page.forecast.table.columns.object')}</th>
                    <th>${t('page.forecast.table.columns.method')}</th>
                    <th>${t('page.forecast.table.columns.transition')}</th>
                </tr></thead><tbody>`;

        ingresses.forEach(row => {
            const hoverHtml = buildIngressHoverHtml(row);
            const transitionHtml = hoverHtml
                ? `<span class="bw-ingress-transition-hover" data-hover-html="${encodeURIComponent(hoverHtml)}">${escapeHtml(row.transition || '')}</span>`
                : escapeHtml(row.transition || '');
            html += `<tr>
                <td class="bw-ingress-object">${row.objectHtml || escapeHtml(row.object || '')}</td>
                <td><span class="method-badge ${row.methodClass || ''}">${escapeHtml(row.methodLabel || row.method || '')}</span></td>
                <td class="bw-ingress-transition">${transitionHtml}</td>
            </tr>`;
        });
        html += '</tbody></table></div></div>';
        container.innerHTML = html;
        container.style.display = '';
        container.querySelector('#bwToggleIngressesInTable')?.addEventListener('click', (event) => {
            event.stopPropagation();
            ingressesCollapsed = true;
            applyPanelCollapseStates();
            triggerLayoutAnimation();
        });
        container.querySelectorAll('.bw-ingress-transition-hover').forEach((node) => {
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
                showHoverTooltip(html, event);
            });
            node.addEventListener('mousemove', (event) => {
                const tooltip = ensureHoverTooltip();
                if (!tooltip || tooltip.style.display === 'none') return;
                placeHoverTooltip(event, tooltip);
            });
            node.addEventListener('mouseleave', () => {
                hideHoverTooltip();
            });
        });
        applyPanelCollapseStates();
    }

    function bodyPriority(name) {
        const idx = BW_PLANET_ORDER.indexOf(name);
        return idx < 0 ? 999 : idx;
    }

    function sortedBodies(setLike) {
        return [...setLike].sort((a, b) => {
            const pa = bodyPriority(a);
            const pb = bodyPriority(b);
            return pa === pb ? a.localeCompare(b) : pa - pb;
        });
    }

    function getSettingsBodyLabel(name) {
        return getPlanetName(name);
    }

    function formatCompactBodyGlyph(name, isRetrograde = false) {
        if (!name) return '';
        const symbol = Symbols?.planets?.[name] || '';
        const label = escapeHtml(getPlanetName(name));
        return `<span class="bw-compact-body" title="${label}" aria-label="${label}" role="img"><span class="astro-symbol">${escapeHtml(symbol)}</span>${retroIndicatorHtml(isRetrograde)}</span>`;
    }

    function syncBodyFilters(aspects) {
        const transitBodies = new Set(aspects.map(a => a.transitBody).filter(Boolean));
        const natalBodies = new Set(aspects.map(a => a.natalBody).filter(Boolean));

        if (persistentMatrixRows) {
            enabledTransitBodies = new Set([...transitBodies].filter((body) => getBodyMatrixConfig(body).display !== false));
            enabledNatalBodies = new Set([...natalBodies].filter((body) => getBodyMatrixConfig(body).display !== false));
            transitFiltersInitialized = true;
            natalFiltersInitialized = true;
            renderSettingsToggles(transitBodies, natalBodies);
            updateFilterButtonsUI();
            return;
        }

        if (!transitFiltersInitialized) {
            enabledTransitBodies = new Set(transitBodies);
            transitFiltersInitialized = true;
        } else {
            enabledTransitBodies = new Set([...enabledTransitBodies].filter(p => transitBodies.has(p)));
        }

        if (!natalFiltersInitialized) {
            enabledNatalBodies = new Set(natalBodies);
            natalFiltersInitialized = true;
        } else {
            enabledNatalBodies = new Set([...enabledNatalBodies].filter(p => natalBodies.has(p)));
        }

        if (
            planetClickFilter.role === 'transit' &&
            planetClickFilter.planetName &&
            !transitBodies.has(planetClickFilter.planetName)
        ) {
            planetClickFilter = { role: null, planetName: null };
        }
        if (
            planetClickFilter.role === 'natal' &&
            planetClickFilter.planetName &&
            !natalBodies.has(planetClickFilter.planetName)
        ) {
            planetClickFilter = { role: null, planetName: null };
        }

        renderSettingsToggles(transitBodies, natalBodies);
        updateFilterButtonsUI();
    }

    function togglePlanetAspectFilter(role, planetName) {
        const normalizedRole = role === 'natal' ? 'natal' : 'transit';
        if (
            planetClickFilter.role === normalizedRole &&
            planetClickFilter.planetName === planetName
        ) {
            planetClickFilter = { role: null, planetName: null };
            return;
        }
        planetClickFilter = { role: normalizedRole, planetName };
    }

    function getFilteredAspects(aspects) {
        return aspects.filter(a => {
            if (!layerVisibility.natal) return false;
            if (a.method && !isLayerVisible(a.method)) return false;
            if (aspectFilter === 'major' && !a.isMajor) return false;
            if (aspectFilter === 'minor' && a.isMajor) return false;
            if (!getAllowedAspectTypes().has(a.aspectType)) return false;
            if (getBodyMatrixConfig(a.transitBody).display === false) return false;
            if (getBodyMatrixConfig(a.natalBody).display === false) return false;
            if (getBodyMatrixConfig(a.transitBody).aspecting === false) return false;
            if (getBodyMatrixConfig(a.natalBody).aspecting === false) return false;
            if (!enabledTransitBodies.has(a.transitBody)) return false;
            if (!enabledNatalBodies.has(a.natalBody)) return false;
            if (planetClickFilter.role === 'transit' && a.transitBody !== planetClickFilter.planetName) return false;
            if (planetClickFilter.role === 'natal' && a.natalBody !== planetClickFilter.planetName) return false;
            return true;
        });
    }

    function updateLayerLegendUI() {
        const legendItems = document.querySelectorAll('.bw-legend-toggle[data-layer]');
        legendItems.forEach(node => {
            const layer = node.dataset.layer;
            const active = layerVisibility[layer] !== false;
            node.classList.toggle('active', active);
            node.classList.toggle('inactive', !active);
        });
    }

    function toggleLayerVisibility(layer) {
        if (!Object.prototype.hasOwnProperty.call(layerVisibility, layer)) return;
        layerVisibility[layer] = !layerVisibility[layer];
        updateLayerLegendUI();
        triggerLayoutAnimation();
        rerenderLast();
    }

    function renderSettingsToggles(transitBodies, natalBodies) {
        const transitContainers = [
            document.getElementById('bwTransitToggles'),
            document.getElementById('bwTransitTogglesModal'),
        ].filter(Boolean);
        const natalContainers = [
            document.getElementById('bwNatalToggles'),
            document.getElementById('bwNatalTogglesModal'),
        ].filter(Boolean);
        if (!transitContainers.length || !natalContainers.length) return;

        const transitHTML = sortedBodies(transitBodies).map(name => {
            const checked = enabledTransitBodies.has(name) ? 'checked' : '';
            const symbol = Symbols?.planets?.[name] || '';
            const label = getSettingsBodyLabel(name);
            const escapedLabel = escapeHtml(label);
            return `<label class="bw-toggle bw-toggle--icon-only" title="${escapedLabel}"><input type="checkbox" data-group="transit" data-body="${name}" ${checked} aria-label="${escapedLabel}"><span class="bw-toggle-label" aria-hidden="true"><span class="astro-symbol">${escapeHtml(symbol)}</span></span></label>`;
        }).join('');

        const natalHTML = sortedBodies(natalBodies).map(name => {
            const checked = enabledNatalBodies.has(name) ? 'checked' : '';
            const symbol = Symbols?.planets?.[name] || '';
            const label = getSettingsBodyLabel(name);
            const escapedLabel = escapeHtml(label);
            return `<label class="bw-toggle bw-toggle--icon-only" title="${escapedLabel}"><input type="checkbox" data-group="natal" data-body="${name}" ${checked} aria-label="${escapedLabel}"><span class="bw-toggle-label" aria-hidden="true"><span class="astro-symbol">${escapeHtml(symbol)}</span></span></label>`;
        }).join('');

        transitContainers.forEach(container => {
            container.innerHTML = transitHTML;
            container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', () => {
                    const body = cb.dataset.body;
                    if (!body) return;
                    if (cb.checked) enabledTransitBodies.add(body);
                    else enabledTransitBodies.delete(body);
                    rerenderLast();
                });
            });
        });

        natalContainers.forEach(container => {
            container.innerHTML = natalHTML;
            container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', () => {
                    const body = cb.dataset.body;
                    if (!body) return;
                    if (cb.checked) enabledNatalBodies.add(body);
                    else enabledNatalBodies.delete(body);
                    rerenderLast();
                });
            });
        });
    }

    function updateFilterButtonsUI() {
        document.querySelectorAll('.bw-filter-btn[data-filter]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === aspectFilter);
        });
    }

    function setAspectFilter(filter) {
        aspectFilter = ['all', 'major', 'minor'].includes(filter) ? filter : 'all';
        updateFilterButtonsUI();
    }

    function setMatrixRows(rows) {
        persistentMatrixRows = rows ? normalizeMatrixRows(rows) : null;
        transitFiltersInitialized = false;
        natalFiltersInitialized = false;
        if (hasLastRender()) {
            rerenderLast();
        }
    }

    function setEnabledAspectTypes(types) {
        const nextTypes = Array.isArray(types) && types.length
            ? types
            : ['Conjunction', 'Opposition', 'Trine', 'Square', 'Sextile'];
        enabledAspectTypes = new Set(nextTypes);
        if (hasLastRender()) {
            rerenderLast();
        }
    }

    function resetAspectFilters() {
        if (!lastProgData) return;
        aspectFilter = 'major';
        layerVisibility = {
            natal: true,
            transit: true,
            progression: true,
            direction: true,
        };
        enabledTransitBodies = new Set();
        enabledNatalBodies = new Set();
        transitFiltersInitialized = false;
        natalFiltersInitialized = false;
        planetClickFilter = { role: null, planetName: null };
        updateLayerLegendUI();
        triggerLayoutAnimation();
        rerenderLast();
    }

    function buildAspectsHTML(container) {
        const sorted = [...lastAspects].sort((a, b) => {
            let va, vb;
            if (sortCol === 'transit_priority') {
                const ia = BW_PLANET_ORDER.indexOf(a.transitBody);
                const ib = BW_PLANET_ORDER.indexOf(b.transitBody);
                va = ia < 0 ? 999 : ia;
                vb = ib < 0 ? 999 : ib;
            } else if (sortCol === 'method') {
                va = a.method || '';
                vb = b.method || '';
            } else if (sortCol === 'transit') { va = a.transitBody; vb = b.transitBody; }
            else if (sortCol === 'natal') { va = a.natalBody; vb = b.natalBody; }
            else if (sortCol === 'aspect') { va = a.aspectType; vb = b.aspectType; }
            else { va = a.orb ?? 99; vb = b.orb ?? 99; }
            const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
            return sortAsc ? cmp : -cmp;
        });

        const arrow = col => col === sortCol ? (sortAsc ? ' ↑' : ' ↓') : '';
        let html = `<div class="bw-panel-section">
            ${renderPanelHeader(t('page.chart.tabs.aspects'), {
                collapseId: 'bwToggleAspectsInTable',
                collapseLabel: t('page.forecast.biwheel.collapseAspects'),
                controlsId: 'bwAspectsPanelBody',
                icon: '→'
            })}
            <div class="bw-panel-body" id="bwAspectsPanelBody">
                <table><thead><tr>
                    <th data-col="method">${t('page.forecast.table.columns.methodShort')}${arrow('method')}</th>
                    <th data-col="transit">${t('page.forecast.table.columns.transitShort')}${arrow('transit')}</th>
                    <th data-col="aspect">${arrow('aspect')}</th>
                    <th data-col="natal">${t('page.forecast.table.columns.natalShort')}${arrow('natal')}</th>
                    <th data-col="orb">${t('common.orb')}${arrow('orb')}</th>
                </tr></thead><tbody>`;
        sorted.forEach(a => {
            const tSym = Symbols?.planets?.[a.transitBody] || a.transitBody;
            const nSym = Symbols?.planets?.[a.natalBody] || a.natalBody;
            const aSym = Symbols?.aspects?.[a.aspectType] || a.aspectType;
            const methodKey = a.methodKey || getLayerConfig(a.method || 'transit').tableMethod;
            const methodLabel = getMethodLabelShort(methodKey);
            const methodClass = getMethodBadgeClass(methodKey);
            const transitRetro = isTransitBodyRetrograde(a.transitBody, methodKey);
            const natalRetro = isNatalBodyRetrograde(a.natalBody);
            const aspectKey = getAspectKey(a);
            html += `<tr title="${methodLabel}: ${a.transitBody} ${a.aspectType} ${a.natalBody}" data-method="${a.method || ''}" data-transit="${a.transitBody}" data-natal="${a.natalBody}" data-aspect="${a.aspectType}" data-aspect-key="${aspectKey || ''}"><td><span class="method-badge ${methodClass}">${methodLabel}</span></td><td><span class="astro-symbol">${tSym}</span>${retroIndicatorHtml(transitRetro)}</td><td><span class="astro-symbol">${aSym}</span></td><td><span class="astro-symbol">${nSym}</span>${retroIndicatorHtml(natalRetro)}</td><td>${a.orb?.toFixed(2)}°</td></tr>`;
        });
        html += '</tbody></table></div></div>';
        container.innerHTML = html;

        container.querySelectorAll('th[data-col]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.col;
                if (sortCol === col) sortAsc = !sortAsc;
                else { sortCol = col; sortAsc = true; }
                buildAspectsHTML(container);
            });
        });
        container.querySelector('#bwToggleAspectsInTable')?.addEventListener('click', (event) => {
            event.stopPropagation();
            aspectsCollapsed = true;
            applyPanelCollapseStates();
            triggerLayoutAnimation();
        });
        container.querySelectorAll('tbody tr').forEach(tr => {
            tr.addEventListener('mouseenter', onAspectRowHoverEnter);
            tr.addEventListener('mouseleave', onAspectRowHoverLeave);
            tr.addEventListener('click', () => {
                setFocusAspect(
                    tr.dataset.transit || null,
                    tr.dataset.natal || null,
                    tr.dataset.aspect || null,
                    tr.dataset.method || null,
                    tr.dataset.aspectKey || null
                );
            });
        });
        applyFocusState();
    }

    function setFocusAspect(transitBody, natalBody, aspectType, method = null, aspectKey = null) {
        const resolvedAspectKey = aspectKey || (method
            ? buildAspectKey(method, transitBody, aspectType, natalBody)
            : null);
        focusState = {
            mode: 'aspect',
            method,
            transitBody,
            natalBody,
            aspectType,
            aspectKey: resolvedAspectKey,
            planetRole: null,
            planetName: null,
        };
        applyFocusState();
    }

    function togglePlanetFocus(role, planetName) {
        if (focusState.mode === 'planet' && focusState.planetRole === role && focusState.planetName === planetName) {
            clearFocus();
            return;
        }
        focusState = {
            mode: 'planet',
            method: null,
            transitBody: null,
            natalBody: null,
            aspectType: null,
            aspectKey: null,
            planetRole: role,
            planetName,
        };
        applyFocusState();
    }

    function clearFocus() {
        focusState = {
            mode: null,
            method: null,
            transitBody: null,
            natalBody: null,
            aspectType: null,
            aspectKey: null,
            planetRole: null,
            planetName: null,
        };
        applyFocusState();
    }

    function tryClearFocusFromChartClick(event) {
        if (!focusState.mode || !event?.target) return;
        const interactive = event.target.closest('.bw-planet-group, .bw-aspect-line, .bw-house-cusp');
        if (interactive) return;
        clearFocus();
    }

    function tryClearFocusFromEsc(event) {
        if (event.key !== 'Escape' || !focusState.mode) return;
        const target = event.target;
        const isTypingTarget = target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable
        );
        if (isTypingTarget) return;
        clearFocus();
    }

    function matchesFocusLine(line) {
        return matchesFocusDataset({
            method: line?.dataset?.method || '',
            transit: line?.dataset?.transit || '',
            natal: line?.dataset?.natal || '',
            aspect: line?.dataset?.aspect || '',
            aspectKey: line?.dataset?.aspectKey || '',
        });
    }

    function applyFocusState() {
        if (!svg) return;
        const hasFocus = Boolean(focusState.mode);
        svg.classList.toggle('bw-focus-active', hasFocus);
        svg.querySelectorAll('.bw-aspect-line').forEach(line => {
            const active = matchesFocusLine(line);
            line.classList.toggle('bw-dimmed', hasFocus && !active);
            line.classList.toggle('bw-highlight-line', hasFocus && active);
            if (hasFocus && active) {
                line.setAttribute('opacity', '1');
                line.setAttribute('stroke-width', '2.2');
            } else {
                const isMajor = line.classList.contains('bw-aspect-major');
                line.setAttribute('opacity', isMajor ? '0.5' : '0.22');
                line.setAttribute('stroke-width', isMajor ? '1.3' : '0.7');
            }
        });

        svg.querySelectorAll('.bw-planet-group').forEach(node => {
            if (!hasFocus) {
                node.classList.remove('bw-dimmed');
                return;
            }
            let keep = false;
            const role = node.getAttribute('data-planet-role');
            const name = node.getAttribute('data-planet-name');
            if (focusState.mode === 'planet') {
                keep = role === focusState.planetRole && name === focusState.planetName;
            } else {
                keep = (role === 'transit' && name === focusState.transitBody) ||
                    (role === 'natal' && name === focusState.natalBody);
            }
            node.classList.toggle('bw-dimmed', !keep);
        });

        const table = document.getElementById('biwheelAspects');
        if (table) {
            table.querySelectorAll('tbody tr').forEach(tr => {
                const active = matchesFocusDataset({
                    method: tr.dataset.method || '',
                    transit: tr.dataset.transit || '',
                    natal: tr.dataset.natal || '',
                    aspect: tr.dataset.aspect || '',
                    aspectKey: tr.dataset.aspectKey || '',
                });
                tr.classList.toggle('bw-highlight-row', hasFocus && active);
                tr.classList.toggle('bw-dimmed-row', hasFocus && !active);
            });
        }
        refreshHoveredAspectVisual();
        const clearBtn = document.getElementById('bwClearFocusBtn');
        if (clearBtn) clearBtn.classList.toggle('active', hasFocus);
    }

    // ─── Zoom & Pan ────────────────────────────────────────
    let zoomLevel = 1;
    const ZOOM_MIN = 0.5, ZOOM_MAX = 4, ZOOM_STEP = 0.08;
    let panX = 0, panY = 0;
    let isPanning = false, panStartX = 0, panStartY = 0;
    let pinchDistance = 0;
    let pinchStartZoom = 1;

    function getTouchDistance(touchA, touchB) {
        const dx = touchA.clientX - touchB.clientX;
        const dy = touchA.clientY - touchB.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function isBlockedZoomTarget(target) {
        return target instanceof Element
            && Boolean(target.closest('.bw-overlay-controls, .bw-focus-controls, .biwheel-zoom-controls, .biwheel-aspect-bar, .bw-settings-panel, .bw-edge-toggle'));
    }

    function applyViewBox(options = {}) {
        if (!svg) return;
        const size = VIEWBOX_SIZE;
        const w = size / zoomLevel;
        const h = size / zoomLevel;
        const cx = size / 2 + (panX * size);
        const cy = size / 2 + (panY * size);
        svg.setAttribute('viewBox', `${cx - w/2} ${cy - h/2} ${w} ${h}`);
        if (options.notify !== false) {
            notifyViewportSubscribers();
        }
    }

    function setNormalizedViewport(viewport, options = {}) {
        const nextViewport = sanitizeNormalizedViewport(viewport);
        zoomLevel = nextViewport.zoom;
        panX = nextViewport.panX;
        panY = nextViewport.panY;
        applyViewBox(options);
        return getNormalizedViewport();
    }

    function resetView() {
        setNormalizedViewport(DEFAULT_VIEWPORT);
    }

    function initZoomPan() {
        const wrapper = document.getElementById('biwheelSvgWrapper');
        if (!wrapper || wrapper.dataset.zoomInit === '1') return;
        wrapper.dataset.zoomInit = '1';

        // Wheel zoom
        wrapper.addEventListener('wheel', e => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
            zoomLevel = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomLevel + delta));
            applyViewBox();
        }, { passive: false });

        // Mouse drag pan
        wrapper.addEventListener('mousedown', e => {
            if (e.button !== 0 || e.target.closest('.bw-overlay-controls')) return;
            isPanning = true;
            panStartX = e.clientX; panStartY = e.clientY;
        });
        window.addEventListener('mousemove', e => {
            if (!isPanning) return;
            const width = wrapper.clientWidth || VIEWBOX_SIZE;
            panX -= (e.clientX - panStartX) / (zoomLevel * width);
            panY -= (e.clientY - panStartY) / (zoomLevel * width);
            panStartX = e.clientX; panStartY = e.clientY;
            applyViewBox();
        });
        window.addEventListener('mouseup', () => { isPanning = false; });

        wrapper.addEventListener('touchstart', e => {
            if (isBlockedZoomTarget(e.target)) return;
            if (e.touches.length === 2) {
                pinchDistance = getTouchDistance(e.touches[0], e.touches[1]);
                pinchStartZoom = zoomLevel;
                isPanning = false;
                e.preventDefault();
                return;
            }
            if (e.touches.length !== 1) {
                isPanning = false;
                pinchDistance = 0;
                return;
            }
            isPanning = true;
            panStartX = e.touches[0].clientX;
            panStartY = e.touches[0].clientY;
        }, { passive: false });
        wrapper.addEventListener('touchmove', e => {
            if (e.touches.length === 2 && pinchDistance > 0) {
                e.preventDefault();
                const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
                const nextZoom = pinchStartZoom * (currentDistance / pinchDistance);
                zoomLevel = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nextZoom));
                applyViewBox();
                return;
            }
            if (e.touches.length !== 1 || !isPanning) return;
            e.preventDefault();
            const width = wrapper.clientWidth || VIEWBOX_SIZE;
            panX -= (e.touches[0].clientX - panStartX) / (zoomLevel * width);
            panY -= (e.touches[0].clientY - panStartY) / (zoomLevel * width);
            panStartX = e.touches[0].clientX;
            panStartY = e.touches[0].clientY;
            applyViewBox();
        }, { passive: false });
        wrapper.addEventListener('touchend', e => {
            if (e.touches.length < 2) {
                pinchDistance = 0;
            }
            if (e.touches.length === 1) {
                isPanning = true;
                panStartX = e.touches[0].clientX;
                panStartY = e.touches[0].clientY;
                return;
            }
            isPanning = false;
        });
        wrapper.addEventListener('touchcancel', () => {
            isPanning = false;
            pinchDistance = 0;
        });

        // Buttons
        document.getElementById('bwZoomIn')?.addEventListener('click', () => {
            zoomLevel = Math.min(ZOOM_MAX, zoomLevel + ZOOM_STEP * 2);
            applyViewBox();
        });
        document.getElementById('bwZoomOut')?.addEventListener('click', () => {
            zoomLevel = Math.max(ZOOM_MIN, zoomLevel - ZOOM_STEP * 2);
            applyViewBox();
        });
        document.getElementById('bwZoomReset')?.addEventListener('click', resetView);
    }

    // Init zoom once DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initZoomPan);
    } else {
        initZoomPan();
    }

    function initAspectControls() {
        natalPointScale = readSavedScale('bwNatalPointScale', 1.0);
        transitPointScale = readSavedScale('bwTransitPointScale', 1.0);
        updateScaleControlsUI();
        updateLayerLegendUI();
        localStorage.removeItem('bwViewMode');

        const mobileAspectBarMedia = window.matchMedia('(max-width: 768px)');
        const aspectBar = document.getElementById('bwAspectFilters');
        const aspectToggleBtn = document.getElementById('bwAspectFiltersToggleBtn');

        const isMobileAspectBarMode = () => mobileAspectBarMedia.matches;

        function syncMobileAspectBarButton() {
            if (!aspectToggleBtn || !aspectBar) return;
            const expanded = isMobileAspectBarMode() && aspectBar.classList.contains('is-open');
            const label = t(expanded ? 'page.forecast.biwheel.mobileFilters.close' : 'page.forecast.biwheel.mobileFilters.open');
            aspectToggleBtn.textContent = label;
            aspectToggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            aspectToggleBtn.setAttribute('aria-label', label);
            aspectToggleBtn.setAttribute('title', label);
        }

        function setMobileAspectBarOpen(shouldOpen) {
            if (!aspectBar) return;
            if (!isMobileAspectBarMode()) {
                aspectBar.classList.add('is-open');
                syncMobileAspectBarButton();
                return;
            }
            aspectBar.classList.toggle('is-open', shouldOpen);
            aspectToggleBtn?.classList.toggle('active', shouldOpen);
            syncMobileAspectBarButton();
        }

        function syncMobileAspectBarMode() {
            if (!aspectBar) return;
            if (isMobileAspectBarMode()) {
                aspectBar.classList.remove('is-open');
                aspectToggleBtn?.classList.remove('active');
            } else {
                aspectBar.classList.add('is-open');
                aspectToggleBtn?.classList.remove('active');
            }
            syncMobileAspectBarButton();
        }

        document.querySelectorAll('.bw-filter-btn[data-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                setAspectFilter(btn.dataset.filter);
                rerenderLast();
            });
        });
        document.querySelectorAll('.bw-legend-toggle[data-layer]').forEach(item => {
            item.addEventListener('click', (event) => {
                if (event.target && event.target.closest('.bw-direction-type-select')) return;
                const layer = item.dataset.layer;
                if (!layer) return;
                toggleLayerVisibility(layer);
            });
        });
        const directionTypeSelect = document.getElementById('bwDirectionTypeSelect');
        if (directionTypeSelect) {
            ['click', 'mousedown', 'pointerdown'].forEach(evt => {
                directionTypeSelect.addEventListener(evt, e => e.stopPropagation());
            });
            directionTypeSelect.addEventListener('change', () => {
                if (isMobileAspectBarMode()) {
                    setMobileAspectBarOpen(false);
                }
            });
        }
        if (aspectToggleBtn && aspectBar) {
            aspectToggleBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                setMobileAspectBarOpen(!aspectBar.classList.contains('is-open'));
            });

            aspectBar.addEventListener('click', (event) => {
                if (!isMobileAspectBarMode()) return;
                const actionable = event.target.closest('.bw-legend-toggle, .bw-filter-btn');
                if (!actionable) return;
                requestAnimationFrame(() => setMobileAspectBarOpen(false));
            });

            document.addEventListener('click', (event) => {
                if (!isMobileAspectBarMode() || !aspectBar.classList.contains('is-open')) return;
                if (aspectBar.contains(event.target) || aspectToggleBtn.contains(event.target)) return;
                setMobileAspectBarOpen(false);
            });

            if (typeof mobileAspectBarMedia.addEventListener === 'function') {
                mobileAspectBarMedia.addEventListener('change', syncMobileAspectBarMode);
            } else if (typeof mobileAspectBarMedia.addListener === 'function') {
                mobileAspectBarMedia.addListener(syncMobileAspectBarMode);
            }

            document.addEventListener('frontend:locale-changed', syncMobileAspectBarButton);
            syncMobileAspectBarMode();
        }
        const openIngressesBtn = document.getElementById('bwOpenIngresses');
        const openAspectsBtn = document.getElementById('bwOpenAspects');
        if (openIngressesBtn) {
            openIngressesBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                ingressesCollapsed = false;
                applyPanelCollapseStates();
                triggerLayoutAnimation();
            });
        }
        if (openAspectsBtn) {
            openAspectsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                aspectsCollapsed = false;
                applyPanelCollapseStates();
                triggerLayoutAnimation();
            });
        }
        applyPanelCollapseStates();
        document.getElementById('bwNatalScaleRange')?.addEventListener('input', e => {
            natalPointScale = clampPointScale((Number(e.target.value) || 100) / 100);
            localStorage.setItem('bwNatalPointScale', String(natalPointScale));
            updateScaleControlsUI();
            rerenderLast();
        });
        document.getElementById('bwTransitScaleRange')?.addEventListener('input', e => {
            transitPointScale = clampPointScale((Number(e.target.value) || 100) / 100);
            localStorage.setItem('bwTransitPointScale', String(transitPointScale));
            updateScaleControlsUI();
            rerenderLast();
        });
        document.getElementById('bwClearFocusBtn')?.addEventListener('click', () => {
            clearFocus();
        });
        const chartSvg = document.getElementById('biwheelSvg');
        if (chartSvg) {
            chartSvg.addEventListener('click', tryClearFocusFromChartClick);
        }
        document.addEventListener('keydown', tryClearFocusFromEsc);

        const settingsBtn = document.getElementById('bwSettingsBtn');
        const settingsPanel = document.getElementById('bwSettingsPanel');
        if (settingsBtn && settingsPanel) {
            settingsBtn.addEventListener('click', () => {
                settingsPanel.classList.remove('hidden');
            });
            settingsPanel.addEventListener('click', e => {
                if (e.target === settingsPanel) {
                    settingsPanel.classList.add('hidden');
                }
            });
            document.getElementById('bwSettingsClose')?.addEventListener('click', () => {
                settingsPanel.classList.add('hidden');
            });
        }

        document.getElementById('bwResetFilters')?.addEventListener('click', () => {
            resetAspectFilters();
        });
        document.getElementById('bwMajorOnly')?.addEventListener('click', () => {
            setAspectFilter('major');
            rerenderLast();
        });
        document.getElementById('bwMinorOnly')?.addEventListener('click', () => {
            setAspectFilter('minor');
            rerenderLast();
        });
        document.getElementById('bwResetFiltersModal')?.addEventListener('click', () => {
            resetAspectFilters();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAspectControls);
    } else {
        initAspectControls();
    }

    function setOrientationMode(mode) {
        orientationMode = mode === 'asc' ? 'asc' : 'aries';
    }

    function hasLastRender() {
        return Boolean(lastNatalData && lastProgData);
    }

    function rerenderLast() {
        if (!hasLastRender()) return;
        render(lastNatalData, lastProgData);
    }

    window.ForecastBiwheel = {
        render,
        setOrientationMode,
        hasLastRender,
        rerenderLast,
        setAspectFilter,
        setMatrixRows,
        setEnabledAspectTypes,
        resetAspectFilters,
        getNormalizedViewport,
        setNormalizedViewport,
        resetViewport: resetView,
        subscribeViewport,
    };
})();

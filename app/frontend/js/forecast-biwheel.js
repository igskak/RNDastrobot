/**
 * forecast-biwheel.js — Dual wheel: natal (inner) + prognostic (outer)
 * Renders SVG biwheel in #biwheelSvg (viewBox 600x600)
 */
(function() {
    'use strict';

    const C = 300; // center
    const NS = 'http://www.w3.org/2000/svg';

    // Radii
    const OUTER_R = 285;
    const DEGREE_RING = 10;
    const SIGN_RING = 22;
    const HOUSE_RING = 30;
    const SIGN_SYMBOL_SIZE = 13;
    const NATAL_PLANET_SYMBOL_SIZE = 15;
    const PROG_PLANET_SYMBOL_SIZE = 14;
    const RETRO_SYMBOL_SIZE = 8;
    // Natal must stay on the inner ring; prognostic must stay on the outer ring.
    const NATAL_PLANET_R = 190;
    const PROGNOSTIC_PLANET_R = 214;
    // Keep aspect field close to natal wheel proportions:
    // make the aspect working area noticeably larger and reduce dead space before houses.
    const ASPECT_R = 182;
    const SIGN_INNER_R = OUTER_R - DEGREE_RING - SIGN_RING;
    const HOUSE_INNER_R = SIGN_INNER_R - HOUSE_RING;

    // Colors
    const ELEMENT_COLORS = {
        Fire: '#ef4444', Earth: '#84cc16', Air: '#f59e0b', Water: '#3b82f6'
    };
    const ASPECT_COLORS = {
        Conjunction: '#6366f1', Opposition: '#ef4444', Trine: '#22c55e',
        Square: '#f97316', Sextile: '#06b6d4', Quincunx: '#a855f7',
    };

    let svg, ascLong = 0;
    let orientationMode = 'aries';
    let aspectFilter = 'major';
    let enabledTransitBodies = new Set();
    let enabledNatalBodies = new Set();
    let transitFiltersInitialized = false;
    let natalFiltersInitialized = false;
    let lastNatalData = null;
    let lastProgData = null;
    let natalPointScale = 1.2;
    let transitPointScale = 1.0;
    let focusState = {
        mode: null,
        transitBody: null,
        natalBody: null,
        aspectType: null,
        planetRole: null,
        planetName: null,
    };
    let hoverTooltip = null;

    function el(tag, attrs, text) {
        const e = document.createElementNS(NS, tag);
        if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
        if (text) e.textContent = text;
        return e;
    }

    function clampPointScale(v) {
        return Math.min(1.7, Math.max(0.8, Number(v) || 1));
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

    // ─── Public render ──────────────────────────────────
    function render(natalData, progData) {
        lastNatalData = natalData;
        lastProgData = progData;
        svg = document.getElementById('biwheelSvg');
        if (!svg) return;
        svg.innerHTML = '';
        // Reset zoom/pan on new render
        zoomLevel = 1; panX = 0; panY = 0;
        svg.setAttribute('viewBox', '0 0 600 600');
        ascLong = natalData.angles?.ASC?.longitude || 0;

        drawBackground();
        drawSignRing();
        drawHouses(natalData.houses, { layer: 'natal', layerLabel: 'Натал' });
        const progMeta = getProgMeta(progData);
        const progHouses = extractProgHouses(progData);
        if (progHouses.length) {
            drawHouses(progHouses, {
                layer: 'prognostic',
                method: progMeta.method,
                layerLabel: getPrognosticHouseLayerLabel(progMeta.method),
            });
        }
        drawAspectCircle();

        // Natal planets (inner)
        drawPlanets(natalData.planets, NATAL_PLANET_R, '#374151', NATAL_PLANET_SYMBOL_SIZE, true, 'natal');

        // Prognostic planets (outer ring)
        const progPlanets = extractProgPlanets(progData);
        drawOuterRing();
        drawPlanets(progPlanets, PROGNOSTIC_PLANET_R, '#6366f1', PROG_PLANET_SYMBOL_SIZE, false, 'prognostic');

        // Cross-aspect lines
        const aspects = extractAspects(progData);
        syncBodyFilters(aspects);
        const filteredAspects = getFilteredAspects(aspects);
        drawCrossAspects(filteredAspects, natalData.planets, progPlanets);

        // Ingresses table (for progressions / directions)
        renderIngressesTable(extractIngresses(progData), progData?._method);

        // Aspects table
        renderAspectsTable(filteredAspects, progData._method);

        // Highlight aspect from timeline click
        if (window.ForecastState?.highlightAspect) {
            applyHighlight(window.ForecastState.highlightAspect);
            window.ForecastState.highlightAspect = null;
        } else {
            applyFocusState();
        }
    }

    function applyHighlight(h) {
        if (!h || !svg) return;
        setFocusAspect(h.transitBody, h.natalBody, h.aspectType);
        const container = document.getElementById('biwheelAspects');
        if (container) {
            container.querySelectorAll('tbody tr').forEach(tr => {
                const title = tr.getAttribute('title') || '';
                if (title === `${h.transitBody} ${h.aspectType} ${h.natalBody}`) {
                    tr.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
            });
        }
    }

    // ─── Background ─────────────────────────────────────
    function drawBackground() {
        svg.appendChild(el('circle', { cx:C, cy:C, r:OUTER_R, fill:'#fafafa', stroke:'#d1d5db', 'stroke-width':1 }));
    }

    // ─── Sign ring ──────────────────────────────────────
    function drawSignRing() {
        const signOuter = OUTER_R - DEGREE_RING;
        svg.appendChild(el('circle', { cx:C, cy:C, r:signOuter, fill:'none', stroke:'#d1d5db', 'stroke-width':0.5 }));
        svg.appendChild(el('circle', { cx:C, cy:C, r:SIGN_INNER_R, fill:'white', stroke:'#d1d5db', 'stroke-width':0.5 }));

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

            const lineAngle = longToAngle(startLong) * Math.PI / 180;
            svg.appendChild(el('line', {
                x1: C + SIGN_INNER_R * Math.cos(lineAngle),
                y1: C + SIGN_INNER_R * Math.sin(lineAngle),
                x2: C + signOuter * Math.cos(lineAngle),
                y2: C + signOuter * Math.sin(lineAngle),
                stroke:'#9ca3af', 'stroke-width':0.5
            }));
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
        const layerLabel = options.layerLabel || (isPrognostic ? 'Прогностика' : 'Натал');
        const prognosticColorByMethod = {
            progression: '#a855f7',
            direction: '#ca8a04',
            solar_return: '#0f766e',
            transit: '#6366f1',
        };
        const progColor = prognosticColorByMethod[method] || '#6366f1';

        if (!isPrognostic) {
            svg.appendChild(el('circle', { cx:C, cy:C, r:HOUSE_INNER_R, fill:'white', stroke:'#d1d5db', 'stroke-width':0.5 }));
        }
        houses.forEach((h, i) => {
            const angle = longToAngle(h.longitude) * Math.PI / 180;
            const isAngular = [1,4,7,10].includes(h.number);
            const innerR = isAngular ? ASPECT_R + (isPrognostic ? 3 : 0) : HOUSE_INNER_R + (isPrognostic ? 3 : 0);
            const outerR = SIGN_INNER_R - (isPrognostic ? 2 : 0);
            const strokeColor = isPrognostic
                ? progColor
                : (isAngular ? '#6366f1' : '#c7d2db');
            const strokeWidth = isPrognostic
                ? (isAngular ? 1.15 : 0.8)
                : (isAngular ? 1.5 : 0.5);
            const strokeDash = isPrognostic ? '3,2' : null;
            const cuspGroup = el('g', {
                class: 'bw-house-cusp',
                'data-house': String(h.number),
                'data-sign': h.sign || '',
                'data-degree-in-sign': String(h.degree_in_sign ?? 0),
                'data-longitude': String(h.longitude ?? 0),
                'data-layer-label': layerLabel,
                'data-default-stroke-width': String(strokeWidth),
                'data-default-opacity': '1',
                style: 'cursor:pointer;'
            });
            cuspGroup.appendChild(el('line', {
                x1: C + innerR * Math.cos(angle), y1: C + innerR * Math.sin(angle),
                x2: C + outerR * Math.cos(angle), y2: C + outerR * Math.sin(angle),
                stroke:'transparent', 'stroke-width':8,
                class: 'bw-house-cusp-hit'
            }));
            const visibleLineAttrs = {
                x1: C + innerR * Math.cos(angle), y1: C + innerR * Math.sin(angle),
                x2: C + outerR * Math.cos(angle), y2: C + outerR * Math.sin(angle),
                stroke: strokeColor, 'stroke-width': strokeWidth,
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
                const textR = HOUSE_INNER_R + HOUSE_RING / 2;
                cuspGroup.appendChild(el('text', {
                    x: C + textR * Math.cos(midAngle), y: C + textR * Math.sin(midAngle) + 3,
                    'text-anchor':'middle', 'font-size':'9', fill: isAngular ? '#6366f1' : '#9ca3af',
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

    function drawOuterRing() {
        svg.appendChild(el('circle', { cx:C, cy:C, r:PROGNOSTIC_PLANET_R + 10, fill:'none', stroke:'#6366f120', 'stroke-width':0.5 }));
        svg.appendChild(el('circle', { cx:C, cy:C, r:PROGNOSTIC_PLANET_R - 10, fill:'none', stroke:'#6366f120', 'stroke-width':0.5 }));
    }

    // ─── Draw planets ───────────────────────────────────
    function getProgMarkerShape(method) {
        if (method === 'progression') return 'diamond';
        if (method === 'direction') return 'square';
        if (method === 'solar_return') return 'triangle';
        return 'circle';
    }

    function getProgMeta(data) {
        if (!data) return { method: 'transit', color: '#6366f1' };
        if (data.transit_planets) return { method: 'transit', color: '#6366f1' };
        if (data.progressed_planets) return { method: 'progression', color: '#a855f7' };
        if (data.directed_planets) return { method: 'direction', color: '#ca8a04' };
        if (data.solar_planets || data.solar_return_planets) return { method: 'solar_return', color: '#0f766e' };
        return { method: 'transit', color: '#6366f1' };
    }

    function drawProgMarker(point, shape, color, glyphSize) {
        const markerR = Math.max(8, glyphSize * 0.62);
        const markerHalf = markerR - 1;
        if (shape === 'diamond') {
            const d = [
                `M ${point.x} ${point.y - markerR}`,
                `L ${point.x + markerR} ${point.y}`,
                `L ${point.x} ${point.y + markerR}`,
                `L ${point.x - markerR} ${point.y}`,
                'Z'
            ].join(' ');
            return el('path', {
                d,
                fill: 'none',
                stroke: color,
                'stroke-width': '1.2',
                class: 'bw-prog-marker'
            });
        }
        if (shape === 'square') {
            return el('rect', {
                x: point.x - markerHalf,
                y: point.y - markerHalf,
                width: markerHalf * 2,
                height: markerHalf * 2,
                fill: 'none',
                stroke: color,
                'stroke-width': '1.2',
                class: 'bw-prog-marker'
            });
        }
        if (shape === 'triangle') {
            const d = [
                `M ${point.x} ${point.y - markerR}`,
                `L ${point.x + markerR * 0.94} ${point.y + markerR * 0.72}`,
                `L ${point.x - markerR * 0.94} ${point.y + markerR * 0.72}`,
                'Z'
            ].join(' ');
            return el('path', {
                d,
                fill: 'none',
                stroke: color,
                'stroke-width': '1.2',
                class: 'bw-prog-marker'
            });
        }
        return el('circle', {
            cx: point.x,
            cy: point.y,
            r: markerR,
            fill: 'none',
            stroke: color,
            'stroke-width': '1.2',
            class: 'bw-prog-marker'
        });
    }

    function drawPlanets(planets, radius, defaultColor, fontSize, colorByElement = false, layerType = 'natal') {
        if (!planets || !planets.length) return;
        const layerScale = layerType === 'natal' ? natalPointScale : transitPointScale;
        let positions = planets.map(p => ({
            planet: p,
            angle: longToAngle(p.longitude),
            offset: 0,
        })).sort((a, b) => a.angle - b.angle);

        const MIN_GAP = (layerType === 'natal' ? 12 : 10) * layerScale;
        for (let i = 1; i < positions.length; i++) {
            let diff = positions[i].angle - positions[i - 1].angle;
            if (diff < 0) diff += 360;
            if (diff < MIN_GAP) positions[i].offset = Math.round(14 * layerScale);
        }

        positions.forEach(({ planet, angle, offset }) => {
            const r = radius + offset;
            const p = polar(r, angle);
            const sym = Symbols?.planets?.[planet.name] || planet.name.slice(0, 2);
            const glyphScale = Symbols?.planetGlyphScale?.[planet.name] || 1;
            const glyphSize = fontSize * glyphScale * layerScale;
            const element = Symbols?.signElements?.[planet.sign];
            const color = colorByElement
                ? (ELEMENT_COLORS[element] || defaultColor)
                : (planet._color || defaultColor);
            const isNatal = layerType === 'natal';
            const markerShape = planet._markerShape || 'circle';
            const label = Symbols?.planetNamesRu?.[planet.name] || planet.name;
            const group = el('g', {
                class: `bw-planet-group ${isNatal ? 'bw-natal-planet' : 'bw-prog-planet'}`,
                'data-planet-role': isNatal ? 'natal' : 'transit',
                'data-planet-name': planet.name,
                'data-sign': planet.sign || '',
                'data-degree-in-sign': String(planet.degree_in_sign ?? 0),
                'data-house': String(planet.house ?? ''),
                'data-retrograde': planet.retrograde ? 'true' : 'false',
                'aria-label': `${isNatal ? 'Натал' : 'Прогностика'} ${label}`
            });

            if (!isNatal) {
                group.appendChild(drawProgMarker(p, markerShape, color, glyphSize));
            }

            const glyph = el('text', {
                x: p.x, y: p.y + glyphSize * 0.35,
                'text-anchor':'middle', 'font-size': glyphSize.toFixed(2), fill: color,
                'font-weight': isNatal ? '700' : '600',
                opacity: isNatal ? '1' : '0.9',
                class: `bw-planet-glyph ${isNatal ? 'bw-planet-natal' : 'bw-planet-prog'}`,
            }, sym);
            group.appendChild(glyph);

            if (planet.retrograde) {
                const rxScale = Math.min(1.25, layerScale);
                group.appendChild(el('text', {
                    x: p.x + glyphSize * 0.5, y: p.y - glyphSize * 0.25,
                    'font-size': String((RETRO_SYMBOL_SIZE * rxScale).toFixed(2)), fill:'#dc2626',
                    'font-weight':'700',
                    class: 'bw-retro-mark'
                }, 'Rx'));
            }

            group.addEventListener('click', () => {
                togglePlanetFocus(isNatal ? 'natal' : 'transit', planet.name);
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

    function onPlanetHover(event) {
        const group = event.currentTarget;
        const role = group.getAttribute('data-planet-role') === 'natal' ? 'Натал' : 'Прогностика';
        const name = group.getAttribute('data-planet-name') || '';
        const sign = group.getAttribute('data-sign') || '';
        const house = group.getAttribute('data-house') || '—';
        const retro = group.getAttribute('data-retrograde') === 'true';
        const degree = Number(group.getAttribute('data-degree-in-sign') || 0);
        const symbol = Symbols?.planets?.[name] || '';
        const nameRu = Symbols?.planetNamesRu?.[name] || name;
        const signSymbol = Symbols?.signs?.[sign] || '';
        const signRu = Symbols?.signNamesRu?.[sign] || sign || '—';

        showHoverTooltip(`
            <strong>${role}: <span class="astro-symbol">${symbol}</span> ${nameRu}</strong><br>
            <span class="astro-symbol">${signSymbol}</span> ${signRu} ${formatDMS(degree)}<br>
            Дом: ${house}${retro ? ' <span style="color:#dc2626">Rx</span>' : ''}
        `, event);
    }

    function onPlanetLeave() {
        hideHoverTooltip();
    }

    function onHouseHover(event) {
        const group = event.currentTarget;
        const line = group.querySelector('.bw-house-cusp-line');
        const houseNumber = Number(group.getAttribute('data-house') || 0);
        const layerLabel = group.getAttribute('data-layer-label') || 'Натал';
        const sign = group.getAttribute('data-sign') || '';
        const signRu = Symbols?.signNamesRu?.[sign] || sign || '—';
        const signSymbol = Symbols?.signs?.[sign] || '';
        const degree = Number(group.getAttribute('data-degree-in-sign') || 0);
        const longitude = Number(group.getAttribute('data-longitude') || 0);
        const defaultWidth = Number(group.getAttribute('data-default-stroke-width') || 1);

        if (line) {
            line.setAttribute('stroke-width', String((defaultWidth + 0.7).toFixed(2)));
            line.setAttribute('opacity', '1');
        }

        showHoverTooltip(`
            <strong>${layerLabel}: куспид дома ${houseNumber}</strong><br>
            <span class="astro-symbol">${signSymbol}</span> ${signRu} ${formatDMS(degree)}<br>
            Долгота: ${formatDMS(longitude)}
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

    function extractProgPlanets(data) {
        const meta = getProgMeta(data);
        const enrich = p => ({
            ...p,
            house: p.house ?? p.progressed_house ?? p.directed_house ?? p.natal_house ?? '',
            _color: meta.color,
            _method: meta.method,
            _markerShape: getProgMarkerShape(meta.method),
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

    function extractProgHouses(data) {
        if (!data) return [];
        if (Array.isArray(data.progressed_houses)) return data.progressed_houses;
        if (Array.isArray(data.directed_houses)) return data.directed_houses;
        return [];
    }

    function getPrognosticHouseLayerLabel(method) {
        if (method === 'progression') return 'Прогрессия';
        if (method === 'direction') return 'Дирекция';
        if (method === 'solar_return') return 'Соляр';
        return 'Прогностика';
    }

    function extractAspects(data) {
        if (!data) return [];
        if (data.aspects) {
            return data.aspects.map(a => ({
                transitBody: a.transit_planet, natalBody: a.natal_object,
                aspectType: a.aspect_type, orb: a.orb, isMajor: a.is_major,
            }));
        }
        if (data.aspects_to_natal) {
            return data.aspects_to_natal.map(a => ({
                transitBody: a.progressed_planet || a.directed_object,
                natalBody: a.natal_object, aspectType: a.aspect_type,
                orb: a.orb, isMajor: a.is_major,
            }));
        }
        return [];
    }

    function extractIngresses(data) {
        if (!data) return [];
        const method = data?._method;
        const methodSupported = method === 'progressions' || method === 'directions';
        if (!methodSupported) return [];

        const targetDate = data?.progression_info?.target_date || data?.direction_info?.target_date || null;
        const list = [];
        const fmtSign = sign => {
            if (!sign) return '—';
            const sym = Symbols?.signs?.[sign] || '';
            return `${sym ? sym + ' ' : ''}${sign}`;
        };

        (data.planet_ingresses || []).forEach(ing => {
            const body = ing.body || '—';
            const bodySym = Symbols?.planets?.[body] || '';
            const isHouseIngress = ing.ingress_type === 'house';
            const fromPart = isHouseIngress
                ? `Дом ${ing.from_house ?? '—'}`
                : fmtSign(ing.from_sign);
            const toPart = isHouseIngress
                ? `Дом ${ing.to_house ?? '—'}`
                : fmtSign(ing.to_sign);
            list.push({
                date: targetDate,
                object: `${bodySym ? bodySym + ' ' : ''}${body}`,
                transition: `${fromPart} → ${toPart}`,
            });
        });

        (data.house_cusp_ingresses || []).forEach(ing => {
            list.push({
                date: targetDate,
                object: `Куспид ${ing.house_number} дома`,
                transition: `${fmtSign(ing.from_sign)} → ${fmtSign(ing.to_sign)}`,
            });
        });

        return list;
    }

    function drawCrossAspects(aspects, natalPlanets, progPlanets) {
        const natalMap = {};
        natalPlanets.forEach(p => natalMap[p.name] = p.longitude);
        const progMap = {};
        progPlanets.forEach(p => progMap[p.name] = p.longitude);

        aspects.forEach(a => {
            const nLong = natalMap[a.natalBody];
            const pLong = progMap[a.transitBody];
            if (nLong == null || pLong == null) return;
            const nAngle = longToAngle(nLong) * Math.PI / 180;
            const pAngle = longToAngle(pLong) * Math.PI / 180;
            const color = ASPECT_COLORS[a.aspectType] || '#9ca3af';
            const line = el('line', {
                x1: C + ASPECT_R * Math.cos(nAngle), y1: C + ASPECT_R * Math.sin(nAngle),
                x2: C + ASPECT_R * Math.cos(pAngle), y2: C + ASPECT_R * Math.sin(pAngle),
                stroke: color, 'stroke-width': a.isMajor ? 1.3 : 0.7,
                'stroke-dasharray': a.isMajor ? 'none' : '4,4',
                opacity: a.isMajor ? 0.5 : 0.22,
                'data-transit': a.transitBody, 'data-natal': a.natalBody, 'data-aspect': a.aspectType,
                class: `bw-aspect-line ${a.isMajor ? 'bw-aspect-major' : 'bw-aspect-minor'}`
            });
            svg.appendChild(line);
        });
    }

    const BW_PLANET_ORDER = ['Pluto','Neptune','Uranus','Chiron','Saturn','Jupiter','TrueNorthNode','TrueSouthNode','BlackMoon','Proserpina','Mars','Venus','Mercury','Sun','Moon'];

    let lastAspects = [];
    let sortCol = 'transit_priority';
    let sortAsc = true;

    function renderAspectsTable(aspects, method) {
        const container = document.getElementById('biwheelAspects');
        if (!container) return;
        if (!aspects.length) {
            container.innerHTML = '<p style="padding:12px;color:var(--text-secondary);font-size:1rem">Нет аспектов</p>';
            return;
        }
        lastAspects = aspects;
        buildAspectsHTML(container);
    }

    function compactDate(dateStr) {
        if (!dateStr) return '—';
        const parts = String(dateStr).slice(0, 10).split('-');
        if (parts.length !== 3) return dateStr;
        const [y, m, d] = parts;
        return `${d}.${m}.${y.slice(-2)}`;
    }

    function setIngressSidebarVisible(visible) {
        const leftbar = document.querySelector('.biwheel-leftbar');
        if (!leftbar) return;
        leftbar.style.display = visible ? 'flex' : 'none';
    }

    function renderIngressesTable(ingresses, method) {
        const container = document.getElementById('biwheelIngresses');
        if (!container) return;
        const supported = method === 'progressions' || method === 'directions';
        if (!supported || !ingresses?.length) {
            container.innerHTML = '';
            container.style.display = 'none';
            setIngressSidebarVisible(false);
            return;
        }

        let html = `<table><thead><tr>
            <th>Дата</th>
            <th>Объект</th>
            <th>Переход</th>
        </tr></thead><tbody>`;

        ingresses.forEach(row => {
            html += `<tr>
                <td>${compactDate(row.date)}</td>
                <td class="bw-ingress-object">${row.object}</td>
                <td class="bw-ingress-transition">${row.transition}</td>
            </tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
        container.style.display = '';
        setIngressSidebarVisible(true);
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
        const compact = {
            TrueNorthNode: 'Сев. узел',
            TrueSouthNode: 'Юж. узел',
            BlackMoon: 'Лилит',
        };
        return compact[name] || (Symbols?.planetNamesRu?.[name] || name);
    }

    function syncBodyFilters(aspects) {
        const transitBodies = new Set(aspects.map(a => a.transitBody).filter(Boolean));
        const natalBodies = new Set(aspects.map(a => a.natalBody).filter(Boolean));

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

        renderSettingsToggles(transitBodies, natalBodies);
        updateFilterButtonsUI();
    }

    function getFilteredAspects(aspects) {
        return aspects.filter(a => {
            if (aspectFilter === 'major' && !a.isMajor) return false;
            if (aspectFilter === 'minor' && a.isMajor) return false;
            if (!enabledTransitBodies.has(a.transitBody)) return false;
            if (!enabledNatalBodies.has(a.natalBody)) return false;
            return true;
        });
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
            return `<label class="bw-toggle"><input type="checkbox" data-group="transit" data-body="${name}" ${checked}><span class="bw-toggle-label"><span class="astro-symbol">${symbol}</span><span class="bw-toggle-name">${label}</span></span></label>`;
        }).join('');

        const natalHTML = sortedBodies(natalBodies).map(name => {
            const checked = enabledNatalBodies.has(name) ? 'checked' : '';
            const symbol = Symbols?.planets?.[name] || '';
            const label = getSettingsBodyLabel(name);
            return `<label class="bw-toggle"><input type="checkbox" data-group="natal" data-body="${name}" ${checked}><span class="bw-toggle-label"><span class="astro-symbol">${symbol}</span><span class="bw-toggle-name">${label}</span></span></label>`;
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

    function resetAspectFilters() {
        if (!lastProgData) return;
        aspectFilter = 'major';
        enabledTransitBodies = new Set();
        enabledNatalBodies = new Set();
        transitFiltersInitialized = false;
        natalFiltersInitialized = false;
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
            } else if (sortCol === 'transit') { va = a.transitBody; vb = b.transitBody; }
            else if (sortCol === 'natal') { va = a.natalBody; vb = b.natalBody; }
            else if (sortCol === 'aspect') { va = a.aspectType; vb = b.aspectType; }
            else { va = a.orb ?? 99; vb = b.orb ?? 99; }
            const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
            return sortAsc ? cmp : -cmp;
        });

        const arrow = col => col === sortCol ? (sortAsc ? ' ↑' : ' ↓') : '';
        let html = `<table><thead><tr>
            <th data-col="transit">Тр.${arrow('transit')}</th>
            <th data-col="aspect">${arrow('aspect')}</th>
            <th data-col="natal">Нат.${arrow('natal')}</th>
            <th data-col="orb">Орб${arrow('orb')}</th>
        </tr></thead><tbody>`;
        sorted.forEach(a => {
            const tSym = Symbols?.planets?.[a.transitBody] || a.transitBody;
            const nSym = Symbols?.planets?.[a.natalBody] || a.natalBody;
            const aSym = Symbols?.aspects?.[a.aspectType] || a.aspectType;
            html += `<tr title="${a.transitBody} ${a.aspectType} ${a.natalBody}" data-transit="${a.transitBody}" data-natal="${a.natalBody}" data-aspect="${a.aspectType}"><td><span class="astro-symbol">${tSym}</span></td><td><span class="astro-symbol">${aSym}</span></td><td><span class="astro-symbol">${nSym}</span></td><td>${a.orb?.toFixed(2)}°</td></tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;

        container.querySelectorAll('th[data-col]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.col;
                if (sortCol === col) sortAsc = !sortAsc;
                else { sortCol = col; sortAsc = true; }
                buildAspectsHTML(container);
            });
        });
        container.querySelectorAll('tbody tr').forEach(tr => {
            tr.addEventListener('click', () => {
                setFocusAspect(tr.dataset.transit, tr.dataset.natal, tr.dataset.aspect);
            });
        });
        applyFocusState();
    }

    function setFocusAspect(transitBody, natalBody, aspectType) {
        focusState = {
            mode: 'aspect',
            transitBody,
            natalBody,
            aspectType,
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
            transitBody: null,
            natalBody: null,
            aspectType: null,
            planetRole: role,
            planetName,
        };
        applyFocusState();
    }

    function clearFocus() {
        focusState = {
            mode: null,
            transitBody: null,
            natalBody: null,
            aspectType: null,
            planetRole: null,
            planetName: null,
        };
        applyFocusState();
    }

    function matchesFocusLine(line) {
        if (!focusState.mode) return true;
        if (focusState.mode === 'aspect') {
            return line.dataset.transit === focusState.transitBody &&
                line.dataset.natal === focusState.natalBody &&
                line.dataset.aspect === focusState.aspectType;
        }
        if (focusState.mode === 'planet') {
            return focusState.planetRole === 'transit'
                ? line.dataset.transit === focusState.planetName
                : line.dataset.natal === focusState.planetName;
        }
        return true;
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
                const active = matchesFocusLine({
                    dataset: {
                        transit: tr.dataset.transit,
                        natal: tr.dataset.natal,
                        aspect: tr.dataset.aspect,
                    }
                });
                tr.classList.toggle('bw-highlight-row', hasFocus && active);
                tr.classList.toggle('bw-dimmed-row', hasFocus && !active);
            });
        }
        const clearBtn = document.getElementById('bwClearFocusBtn');
        if (clearBtn) clearBtn.classList.toggle('active', hasFocus);
    }

    // ─── Zoom & Pan ────────────────────────────────────────
    let zoomLevel = 1;
    const ZOOM_MIN = 0.5, ZOOM_MAX = 4, ZOOM_STEP = 0.15;
    let panX = 0, panY = 0;
    let isPanning = false, panStartX = 0, panStartY = 0;

    function applyViewBox() {
        if (!svg) return;
        const size = 600;
        const w = size / zoomLevel;
        const h = size / zoomLevel;
        const cx = size / 2 + panX;
        const cy = size / 2 + panY;
        svg.setAttribute('viewBox', `${cx - w/2} ${cy - h/2} ${w} ${h}`);
    }

    function resetView() {
        zoomLevel = 1; panX = 0; panY = 0;
        applyViewBox();
    }

    function initZoomPan() {
        const wrapper = document.getElementById('biwheelSvgWrapper');
        if (!wrapper) return;

        // Wheel zoom
        wrapper.addEventListener('wheel', e => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
            zoomLevel = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomLevel + delta));
            applyViewBox();
        }, { passive: false });

        // Mouse drag pan
        wrapper.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            isPanning = true;
            panStartX = e.clientX; panStartY = e.clientY;
        });
        window.addEventListener('mousemove', e => {
            if (!isPanning) return;
            const scale = 600 / (zoomLevel * (wrapper.clientWidth || 600));
            panX -= (e.clientX - panStartX) * scale;
            panY -= (e.clientY - panStartY) * scale;
            panStartX = e.clientX; panStartY = e.clientY;
            applyViewBox();
        });
        window.addEventListener('mouseup', () => { isPanning = false; });

        // Touch pinch zoom + pan
        let lastTouchDist = 0, lastTouchMid = null;
        wrapper.addEventListener('touchstart', e => {
            if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                lastTouchDist = Math.hypot(dx, dy);
                lastTouchMid = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                                 y: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
            } else if (e.touches.length === 1) {
                isPanning = true;
                panStartX = e.touches[0].clientX;
                panStartY = e.touches[0].clientY;
            }
        }, { passive: true });
        wrapper.addEventListener('touchmove', e => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.hypot(dx, dy);
                if (lastTouchDist > 0) {
                    const ratio = dist / lastTouchDist;
                    zoomLevel = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomLevel * ratio));
                    applyViewBox();
                }
                lastTouchDist = dist;
            } else if (e.touches.length === 1 && isPanning) {
                const scale = 600 / (zoomLevel * (wrapper.clientWidth || 600));
                panX -= (e.touches[0].clientX - panStartX) * scale;
                panY -= (e.touches[0].clientY - panStartY) * scale;
                panStartX = e.touches[0].clientX;
                panStartY = e.touches[0].clientY;
                applyViewBox();
            }
        }, { passive: false });
        wrapper.addEventListener('touchend', () => { isPanning = false; lastTouchDist = 0; });

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
        natalPointScale = readSavedScale('bwNatalPointScale', 1.2);
        transitPointScale = readSavedScale('bwTransitPointScale', 1.0);
        updateScaleControlsUI();

        document.querySelectorAll('.bw-filter-btn[data-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                setAspectFilter(btn.dataset.filter);
                rerenderLast();
            });
        });
        document.getElementById('bwNatalScaleRange')?.addEventListener('input', e => {
            natalPointScale = clampPointScale((Number(e.target.value) || 120) / 100);
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
        document.getElementById('bwMajorOnlyModal')?.addEventListener('click', () => {
            setAspectFilter('major');
            rerenderLast();
        });
        document.getElementById('bwMinorOnlyModal')?.addEventListener('click', () => {
            setAspectFilter('minor');
            rerenderLast();
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
        resetAspectFilters
    };
})();

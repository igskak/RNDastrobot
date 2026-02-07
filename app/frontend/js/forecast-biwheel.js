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
    const NATAL_PLANET_R = 200;
    const TRANSIT_PLANET_R = 140;
    const ASPECT_R = 120;
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

    function el(tag, attrs, text) {
        const e = document.createElementNS(NS, tag);
        if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
        if (text) e.textContent = text;
        return e;
    }

    function longToAngle(lon) {
        let a = 180 - (lon - ascLong);
        while (a < 0) a += 360;
        while (a >= 360) a -= 360;
        return a;
    }

    function polar(r, deg) {
        const rad = deg * Math.PI / 180;
        return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) };
    }

    // ─── Public render ──────────────────────────────────
    function render(natalData, progData) {
        svg = document.getElementById('biwheelSvg');
        if (!svg) return;
        svg.innerHTML = '';
        // Reset zoom/pan on new render
        zoomLevel = 1; panX = 0; panY = 0;
        svg.setAttribute('viewBox', '0 0 600 600');
        ascLong = natalData.angles?.ASC?.longitude || 0;

        drawBackground();
        drawSignRing();
        drawHouses(natalData.houses);
        drawAspectCircle();

        // Natal planets (inner)
        drawPlanets(natalData.planets, NATAL_PLANET_R, '#374151', 13);

        // Prognostic planets (outer ring)
        const progPlanets = extractProgPlanets(progData);
        drawOuterRing();
        drawPlanets(progPlanets, TRANSIT_PLANET_R, '#6366f1', 11);

        // Cross-aspect lines
        const aspects = extractAspects(progData);
        drawCrossAspects(aspects, natalData.planets, progPlanets);

        // Aspects table
        renderAspectsTable(aspects, progData._method);

        // Highlight aspect from timeline click
        if (window.ForecastState?.highlightAspect) {
            applyHighlight(window.ForecastState.highlightAspect);
            window.ForecastState.highlightAspect = null;
        }
    }

    function applyHighlight(h) {
        if (!h || !svg) return;
        // Dim all aspect lines, then brighten the matching one
        svg.querySelectorAll('line[data-transit]').forEach(line => {
            if (line.dataset.transit === h.transitBody &&
                line.dataset.natal === h.natalBody &&
                line.dataset.aspect === h.aspectType) {
                line.setAttribute('stroke-width', '3');
                line.setAttribute('opacity', '1');
                line.classList.add('bw-highlight-line');
            } else {
                line.setAttribute('opacity', '0.12');
            }
        });
        // Highlight matching row in aspects table
        const container = document.getElementById('biwheelAspects');
        if (container) {
            container.querySelectorAll('tbody tr').forEach(tr => {
                const title = tr.getAttribute('title') || '';
                if (title === `${h.transitBody} ${h.aspectType} ${h.natalBody}`) {
                    tr.classList.add('bw-highlight-row');
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
            const sign = signNames[i];
            const sym = Symbols?.signs?.[sign] || sign.slice(0, 2);
            const elemKey = Symbols?.signElements?.[sign];
            const color = ELEMENT_COLORS[elemKey] || '#6b7280';
            svg.appendChild(el('text', {
                x: C + textR * Math.cos(midAngle),
                y: C + textR * Math.sin(midAngle) + 4,
                'text-anchor':'middle', 'font-size':'11', fill:color, 'font-weight':'500',
                style:'pointer-events:none'
            }, sym));
        }
    }

    function drawHouses(houses) {
        if (!houses) return;
        svg.appendChild(el('circle', { cx:C, cy:C, r:HOUSE_INNER_R, fill:'white', stroke:'#d1d5db', 'stroke-width':0.5 }));
        houses.forEach((h, i) => {
            const angle = longToAngle(h.longitude) * Math.PI / 180;
            const isAngular = [1,4,7,10].includes(h.number);
            const innerR = isAngular ? ASPECT_R : HOUSE_INNER_R;
            svg.appendChild(el('line', {
                x1: C + innerR * Math.cos(angle), y1: C + innerR * Math.sin(angle),
                x2: C + SIGN_INNER_R * Math.cos(angle), y2: C + SIGN_INNER_R * Math.sin(angle),
                stroke: isAngular ? '#6366f1' : '#c7d2db', 'stroke-width': isAngular ? 1.5 : 0.5
            }));
            // House number
            const nextH = houses[(i + 1) % 12];
            let midLong = (h.longitude + nextH.longitude) / 2;
            if (nextH.longitude < h.longitude) midLong = ((h.longitude + nextH.longitude + 360) / 2) % 360;
            const midAngle = longToAngle(midLong) * Math.PI / 180;
            const textR = HOUSE_INNER_R + HOUSE_RING / 2;
            svg.appendChild(el('text', {
                x: C + textR * Math.cos(midAngle), y: C + textR * Math.sin(midAngle) + 3,
                'text-anchor':'middle', 'font-size':'9', fill: isAngular ? '#6366f1' : '#9ca3af',
                'font-weight': isAngular ? '700' : '400', style:'pointer-events:none'
            }, String(h.number)));
        });
    }



    function drawAspectCircle() {
        svg.appendChild(el('circle', { cx:C, cy:C, r:ASPECT_R, fill:'none', stroke:'#e5e7eb', 'stroke-width':0.5 }));
    }

    function drawOuterRing() {
        svg.appendChild(el('circle', { cx:C, cy:C, r:TRANSIT_PLANET_R + 12, fill:'none', stroke:'#6366f120', 'stroke-width':0.5 }));
        svg.appendChild(el('circle', { cx:C, cy:C, r:TRANSIT_PLANET_R - 12, fill:'none', stroke:'#6366f120', 'stroke-width':0.5 }));
    }

    // ─── Draw planets ───────────────────────────────────
    function drawPlanets(planets, radius, defaultColor, fontSize) {
        if (!planets || !planets.length) return;
        let positions = planets.map(p => ({
            planet: p,
            angle: longToAngle(p.longitude),
            offset: 0,
        })).sort((a, b) => a.angle - b.angle);

        const MIN_GAP = 10;
        for (let i = 1; i < positions.length; i++) {
            let diff = positions[i].angle - positions[i - 1].angle;
            if (diff < 0) diff += 360;
            if (diff < MIN_GAP) positions[i].offset = 14;
        }

        positions.forEach(({ planet, angle, offset }) => {
            const r = radius + offset;
            const p = polar(r, angle);
            const sym = Symbols?.planets?.[planet.name] || planet.name.slice(0, 2);
            const color = planet._color || defaultColor;
            svg.appendChild(el('text', {
                x: p.x, y: p.y + fontSize * 0.35,
                'text-anchor':'middle', 'font-size': fontSize, fill: color,
                'font-weight':'600', style:'pointer-events:none'
            }, sym));
            if (planet.retrograde) {
                svg.appendChild(el('text', {
                    x: p.x + fontSize * 0.5, y: p.y - fontSize * 0.3,
                    'font-size': fontSize * 0.55, fill:'#dc2626',
                    'font-weight':'700', style:'pointer-events:none'
                }, 'R'));
            }
        });
    }

    function extractProgPlanets(data) {
        if (!data) return [];
        if (data.transit_planets) return data.transit_planets.map(p => ({ ...p, _color: '#6366f1' }));
        if (data.progressed_planets) return data.progressed_planets.map(p => ({ ...p, _color: '#a855f7' }));
        if (data.directed_planets) {
            const planets = data.directed_planets.map(p => ({ ...p, _color: '#ca8a04' }));
            if (data.directed_angles) data.directed_angles.forEach(a => planets.push({ ...a, _color: '#ca8a04' }));
            return planets;
        }
        return [];
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
                stroke: color, 'stroke-width': a.isMajor ? 1.2 : 0.7,
                'stroke-dasharray': a.isMajor ? 'none' : '3,3',
                opacity: a.isMajor ? 0.6 : 0.35,
                'data-transit': a.transitBody, 'data-natal': a.natalBody, 'data-aspect': a.aspectType,
            });
            svg.appendChild(line);
        });
    }

    let lastAspects = [];
    let sortCol = 'orb';
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

    function buildAspectsHTML(container) {
        const sorted = [...lastAspects].sort((a, b) => {
            let va, vb;
            if (sortCol === 'transit') { va = a.transitBody; vb = b.transitBody; }
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
            html += `<tr title="${a.transitBody} ${a.aspectType} ${a.natalBody}"><td>${tSym}</td><td>${aSym}</td><td>${nSym}</td><td>${a.orb?.toFixed(2)}°</td></tr>`;
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

    window.ForecastBiwheel = { render };
})();
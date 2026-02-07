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
            svg.appendChild(el('line', {
                x1: C + ASPECT_R * Math.cos(nAngle), y1: C + ASPECT_R * Math.sin(nAngle),
                x2: C + ASPECT_R * Math.cos(pAngle), y2: C + ASPECT_R * Math.sin(pAngle),
                stroke: color, 'stroke-width': a.isMajor ? 1.2 : 0.7,
                'stroke-dasharray': a.isMajor ? 'none' : '3,3',
                opacity: a.isMajor ? 0.6 : 0.35,
            }));
        });
    }

    function renderAspectsTable(aspects, method) {
        const container = document.getElementById('biwheelAspects');
        if (!container) return;
        if (!aspects.length) {
            container.innerHTML = '<p style="padding:12px;color:var(--text-secondary);font-size:0.8rem">Нет аспектов</p>';
            return;
        }
        let html = '<table><thead><tr><th>Транзит</th><th>Аспект</th><th>Натал</th><th>Орб</th></tr></thead><tbody>';
        aspects.forEach(a => {
            const tSym = Symbols?.planets?.[a.transitBody] || a.transitBody;
            const nSym = Symbols?.planets?.[a.natalBody] || a.natalBody;
            const aSym = Symbols?.aspects?.[a.aspectType] || a.aspectType;
            html += `<tr><td>${tSym} ${a.transitBody}</td><td>${aSym}</td><td>${nSym} ${a.natalBody}</td><td>${a.orb?.toFixed(2)}°</td></tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    }

    window.ForecastBiwheel = { render };
})();
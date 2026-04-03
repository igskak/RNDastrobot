(function () {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const DEFAULT_STROKE = 4.75;
    const ASTRO_FONT_STACK = "'Astronomicon Local', 'Noto Sans Symbols Local', 'Noto Sans Symbols 2 Local', 'Segoe UI Symbol', 'Apple Symbols', sans-serif";
    const FONT_BASED_PLANETS = new Set([
        'Sun',
        'Moon',
        'Mercury',
        'Venus',
        'Mars',
        'Jupiter',
        'Saturn',
        'Uranus',
        'Neptune',
        'Pluto',
        'Chiron',
        'TrueNode',
        'TrueNorthNode',
        'MeanNode',
        'SouthNode',
        'TrueSouthNode',
        'BlackMoon',
        'WhiteMoon',
        'Fortune',
        'PartOfFortune',
    ]);
    const FONT_GLYPH_SCALE = {
        Sun: 0.84,
        Moon: 0.92,
        Mercury: 0.92,
        Venus: 0.9,
        Mars: 0.93,
        Jupiter: 0.89,
        Saturn: 0.89,
        Uranus: 0.9,
        Neptune: 0.9,
        Pluto: 0.9,
        Chiron: 0.91,
        Proserpina: 0.76,
        TrueNode: 0.88,
        TrueNorthNode: 0.88,
        MeanNode: 0.88,
        SouthNode: 0.88,
        TrueSouthNode: 0.88,
        BlackMoon: 0.9,
        WhiteMoon: 0.9,
        Fortune: 0.86,
        PartOfFortune: 0.86,
    };
    const FONT_GLYPH_Y = {
        Sun: 56,
        Moon: 55,
        Mercury: 57,
        Venus: 56,
        Mars: 55,
        Jupiter: 57,
        Saturn: 57,
        Uranus: 57,
        Neptune: 57,
        Pluto: 57,
        Chiron: 57,
        Proserpina: 57,
        TrueNode: 56,
        TrueNorthNode: 56,
        MeanNode: 56,
        SouthNode: 56,
        TrueSouthNode: 56,
        BlackMoon: 57,
        WhiteMoon: 57,
        Fortune: 56,
        PartOfFortune: 56,
    };
    const ICON_BOX_SCALE = {
        Proserpina: 1.06,
    };

    function createSvgElement(tag, attrs = {}) {
        const element = document.createElementNS(SVG_NS, tag);
        Object.entries(attrs).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                element.setAttribute(key, String(value));
            }
        });
        return element;
    }

    function append(parent, child) {
        parent.appendChild(child);
        return child;
    }

    function addStrokeShape(parent, tag, attrs = {}) {
        const className = ['planet-symbol-stroke', attrs.class].filter(Boolean).join(' ');
        return append(parent, createSvgElement(tag, {
            ...attrs,
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': attrs['stroke-width'] ?? DEFAULT_STROKE,
            'stroke-linecap': attrs['stroke-linecap'] ?? 'round',
            'stroke-linejoin': attrs['stroke-linejoin'] ?? 'round',
            class: className,
        }));
    }

    function addFillShape(parent, tag, attrs = {}) {
        const className = ['planet-symbol-fill', attrs.class].filter(Boolean).join(' ');
        return append(parent, createSvgElement(tag, {
            ...attrs,
            fill: 'currentColor',
            stroke: 'none',
            class: className,
        }));
    }

    function addLine(parent, x1, y1, x2, y2, attrs = {}) {
        return addStrokeShape(parent, 'line', { x1, y1, x2, y2, ...attrs });
    }

    function addCircle(parent, cx, cy, r, attrs = {}) {
        return addStrokeShape(parent, 'circle', { cx, cy, r, ...attrs });
    }

    function addFilledCircle(parent, cx, cy, r, attrs = {}) {
        return addFillShape(parent, 'circle', { cx, cy, r, ...attrs });
    }

    function addPath(parent, d, attrs = {}) {
        return addStrokeShape(parent, 'path', { d, ...attrs });
    }

    function addFilledPath(parent, d, attrs = {}) {
        return addFillShape(parent, 'path', { d, ...attrs });
    }

    function addCross(parent, cx, cy, verticalTop, verticalBottom, horizontalWidth, attrs = {}) {
        addLine(parent, cx, verticalTop, cx, verticalBottom, attrs);
        addLine(parent, cx - horizontalWidth / 2, cy, cx + horizontalWidth / 2, cy, attrs);
    }

    function addCrescent(parent, {
        outerCx = 50,
        outerCy = 42,
        outerR = 24,
        innerCx = 60,
        innerCy = 42,
        innerR = 21,
        className = '',
    } = {}) {
        const d = [
            `M ${outerCx + outerR} ${outerCy - outerR}`,
            `A ${outerR} ${outerR} 0 1 0 ${outerCx + outerR} ${outerCy + outerR}`,
            `A ${innerR} ${innerR} 0 1 1 ${innerCx + innerR} ${innerCy - innerR}`,
            'Z',
        ].join(' ');
        addFilledPath(parent, d, { class: className });
    }

    function appendSun(root) {
        addCircle(root, 50, 50, 24);
        addFilledCircle(root, 50, 50, 4.75);
    }

    function appendMoon(root) {
        addPath(root, 'M 62 20 A 30 30 0 1 0 62 80');
        addPath(root, 'M 62 20 A 22 30 0 1 1 62 80');
    }

    function appendMercury(root) {
        addCircle(root, 50, 40, 17);
        addCross(root, 50, 66, 56, 82, 22);
        addPath(root, 'M 34 22 C 34 12 42 10 47 16');
        addPath(root, 'M 66 22 C 66 12 58 10 53 16');
    }

    function appendVenus(root) {
        addCircle(root, 50, 34, 17);
        addCross(root, 50, 60, 51, 82, 22);
    }

    function appendMars(root) {
        addCircle(root, 40, 60, 17);
        addLine(root, 54, 46, 76, 24);
        addLine(root, 64, 24, 76, 24);
        addLine(root, 76, 24, 76, 36);
    }

    function appendJupiter(root) {
        addLine(root, 42, 16, 42, 84);
        addLine(root, 28, 48, 56, 48);
        addPath(root, 'M 42 28 C 52 22 70 24 70 42 C 70 62 58 76 42 76');
    }

    function appendSaturn(root) {
        addLine(root, 46, 16, 46, 84);
        addLine(root, 30, 28, 58, 28);
        addPath(root, 'M 46 48 C 56 42 68 44 68 58 C 68 74 58 84 48 84 C 42 84 38 80 38 74');
    }

    function appendUranus(root) {
        addPath(root, 'M 26 24 C 36 30 36 70 26 76');
        addPath(root, 'M 74 24 C 64 30 64 70 74 76');
        addLine(root, 40, 34, 40, 64);
        addLine(root, 60, 34, 60, 64);
        addLine(root, 40, 49, 60, 49);
        addCircle(root, 50, 82, 8);
    }

    function appendNeptune(root) {
        addLine(root, 50, 18, 50, 84);
        addLine(root, 34, 28, 34, 52);
        addLine(root, 50, 20, 50, 52);
        addLine(root, 66, 28, 66, 52);
        addLine(root, 28, 76, 72, 76);
        addLine(root, 28, 28, 34, 22);
        addLine(root, 34, 22, 40, 28);
        addLine(root, 44, 20, 50, 14);
        addLine(root, 50, 14, 56, 20);
        addLine(root, 60, 28, 66, 22);
        addLine(root, 66, 22, 72, 28);
    }

    function appendPluto(root) {
        addCircle(root, 50, 22, 12);
        addPath(root, 'M 36 42 C 42 34 58 34 64 42');
        addLine(root, 50, 42, 50, 84);
        addLine(root, 40, 72, 60, 72);
    }

    function appendChiron(root) {
        addLine(root, 34, 16, 34, 72);
        addLine(root, 34, 40, 62, 18);
        addLine(root, 34, 40, 58, 60);
        addCircle(root, 34, 82, 8);
    }

    function appendProserpina(root) {
        addPath(root, 'M 30 20 H 40 V 80 H 30', { 'stroke-width': 4 });
        addPath(root, 'M 70 20 H 60 V 80 H 70', { 'stroke-width': 4 });
        addFilledCircle(root, 50, 50, 8.6);
    }

    function appendNorthNode(root) {
        addPath(root, 'M 32 68 C 32 46 42 34 50 34 C 58 34 68 46 68 68');
        addCircle(root, 32, 68, 7.5);
        addCircle(root, 68, 68, 7.5);
    }

    function appendSouthNode(root) {
        addPath(root, 'M 32 32 C 32 54 42 66 50 66 C 58 66 68 54 68 32');
        addCircle(root, 32, 32, 7.5);
        addCircle(root, 68, 32, 7.5);
    }

    function appendBlackMoon(root) {
        addCrescent(root, {
            outerCx: 50,
            outerCy: 28,
            outerR: 18,
            innerCx: 58,
            innerCy: 28,
            innerR: 15,
        });
        addCross(root, 50, 62, 44, 84, 22);
    }

    function appendWhiteMoon(root) {
        addPath(root, 'M 62 18 A 18 18 0 1 0 62 54');
        addPath(root, 'M 62 18 A 14 18 0 1 1 62 54');
        addCross(root, 50, 64, 46, 84, 22);
    }

    function appendFortune(root) {
        addCircle(root, 50, 50, 24);
        addLine(root, 34, 34, 66, 66);
        addLine(root, 66, 34, 34, 66);
    }

    const PLANET_ICON_BUILDERS = {
        Sun: appendSun,
        Moon: appendMoon,
        Mercury: appendMercury,
        Venus: appendVenus,
        Mars: appendMars,
        Jupiter: appendJupiter,
        Saturn: appendSaturn,
        Uranus: appendUranus,
        Neptune: appendNeptune,
        Pluto: appendPluto,
        Chiron: appendChiron,
        Proserpina: appendProserpina,
        TrueNode: appendNorthNode,
        TrueNorthNode: appendNorthNode,
        MeanNode: appendNorthNode,
        SouthNode: appendSouthNode,
        TrueSouthNode: appendSouthNode,
        BlackMoon: appendBlackMoon,
        WhiteMoon: appendWhiteMoon,
        Fortune: appendFortune,
        PartOfFortune: appendFortune,
    };

    function hasPlanetIcon(name) {
        return Boolean(PLANET_ICON_BUILDERS[name]);
    }

    function appendFallbackText(svg, symbol) {
        const text = createSvgElement('text', {
            x: 50,
            y: 64,
            'text-anchor': 'middle',
            'font-size': 56,
            'font-weight': 500,
            fill: 'currentColor',
            class: 'planet-symbol-text',
            style: `font-family:${ASTRO_FONT_STACK};pointer-events:none`,
        });
        text.textContent = symbol;
        svg.appendChild(text);
    }

    function appendFontBasedGlyph(svg, name, options = {}) {
        const symbol = options.symbol || window.Symbols?.planets?.[name] || String(name || '').charAt(0) || '?';
        const glyphScale = FONT_GLYPH_SCALE[name] || 0.9;
        const y = FONT_GLYPH_Y[name] || 57;
        const text = createSvgElement('text', {
            x: 50,
            y,
            'text-anchor': 'middle',
            'font-size': (76 * glyphScale).toFixed(2),
            'font-weight': 400,
            fill: 'currentColor',
            class: 'planet-symbol-text',
            style: `font-family:${ASTRO_FONT_STACK};pointer-events:none`,
        });
        text.textContent = symbol;
        svg.appendChild(text);
    }

    function createPlanetSymbolSvg(name, options = {}) {
        const size = Number.isFinite(Number(options.size)) ? Number(options.size) : 24;
        const svg = createSvgElement('svg', {
            viewBox: '0 0 100 100',
            width: size.toFixed(2),
            height: size.toFixed(2),
            class: ['planet-symbol-svg', options.className].filter(Boolean).join(' '),
            'aria-hidden': options.ariaHidden === false ? 'false' : 'true',
            focusable: 'false',
            preserveAspectRatio: 'xMidYMid meet',
        });

        if (options.x !== undefined) svg.setAttribute('x', Number(options.x).toFixed(2));
        if (options.y !== undefined) svg.setAttribute('y', Number(options.y).toFixed(2));

        const styleParts = [`color:${options.color || 'currentColor'}`, 'overflow:visible'];
        if (options.pointerEvents === 'none') styleParts.push('pointer-events:none');
        if (options.style) styleParts.push(options.style);
        svg.setAttribute('style', styleParts.join(';'));

        if (options.title) {
            const title = createSvgElement('title');
            title.textContent = options.title;
            svg.appendChild(title);
        }

        const builder = PLANET_ICON_BUILDERS[name];
        if (FONT_BASED_PLANETS.has(name)) {
            appendFontBasedGlyph(svg, name, options);
        } else if (builder) {
            const root = append(svg, createSvgElement('g', { class: 'planet-symbol-art' }));
            builder(root);
        } else {
            const symbol = options.symbol || window.Symbols?.planets?.[name] || String(name || '').charAt(0) || '?';
            appendFallbackText(svg, symbol);
        }

        return svg;
    }

    function createPlanetSymbolMarkup(name, options = {}) {
        return createPlanetSymbolSvg(name, options).outerHTML;
    }

    function getPlanetIconScale(name) {
        return ICON_BOX_SCALE[name] || 1.18;
    }

    function setPlanetSymbolActive(container, active) {
        if (!container || typeof container.querySelector !== 'function') return;
        container.querySelectorAll('.planet-symbol-svg').forEach((svg) => {
            svg.classList.toggle('is-active', Boolean(active));
        });
    }

    function resetPlanetSymbolActive(root = document) {
        if (!root || typeof root.querySelectorAll !== 'function') return;
        root.querySelectorAll('.planet-symbol-svg.is-active').forEach((svg) => {
            svg.classList.remove('is-active');
        });
    }

    window.AstroGlyphs = {
        createPlanetSymbolSvg,
        createPlanetSymbolMarkup,
        hasPlanetIcon,
        getPlanetIconScale,
        setPlanetSymbolActive,
        resetPlanetSymbolActive,
    };
})();

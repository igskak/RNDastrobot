/**
 * Отрисовка профессиональной круговой натальной карты (SVG)
 * Best Practices: ZET, Solar Fire, Astro-Seek standards
 */

class ChartWheel {
    constructor(svgElement) {
        this.svg = svgElement;
        this.center = 250;
        this.outerRadius = 230;
        this.svgPadding = 30;
        this.updateSvgViewport();
        const initialScale = this.readPointScale();
        this.planetScale = initialScale;
        this.pointScale = initialScale;

        // Двойное кольцо: градусная сетка + символы знаков
        this.degreeRingWidth = 10;       // Внешнее кольцо с градусами
        this.signRingWidth = 26;         // Кольцо символов знаков
        this.houseRingWidth = 40;        // Кольцо домов
        this.planetRadius = this.getHouseCenterRadius();
        this.aspectRadius = this.getHouseInnerRadius();
        this.natalGlyphBaseSize = 18;    // Натальные точки +20% к базовому размеру
        this.houseNumberStyle = 'arabic';
        this.houseLabelsOutside = false;
        this.houseVisualOptions = {
            insideAngularColor: '#6366f1',
            insideMutedColor: '#9ca3af',
            insideAngularLineColor: '#6366f1',
            insideMutedLineColor: '#c7d2db',
            outsideColor: '#111111',
            outsideLineColor: '#111111',
            outsideExtension: 14,
            outsideRadialOffset: 8,
            outsideTangentOffset: 12,
        };
        this.angleMarkerOptions = {
            color: '#6366f1',
            ascDscBold: true,
            mcIcBold: true,
        };
        this.showPlanetStationary = false;
        this.showPlanetDegree = false;

        this.visualPreferences = window.AstroPreferences?.getAccountVisualPreferences?.() || null;
        this.aspectColors = this.visualPreferences?.aspect_colors || {
            'Conjunction': '#f59e0b',
            'Opposition': '#ef4444',
            'Square': '#ef4444',
            'Trine': '#3b82f6',
            'Sextile': '#22c55e',
            'Quincunx': '#8b5cf6',
            'Semisextile': '#14b8a6',
            'Quintile': '#ec4899',
            'Biquintile': '#ec4899',
            'Semisquare': '#f97316'
        };

        // Мажорные vs минорные аспекты
        this.majorAspects = ['Conjunction', 'Opposition', 'Trine', 'Square', 'Sextile'];

        // Цвета стихий
        this.elementColors = this.visualPreferences?.planet_colors?.element_palette || {
            'Fire': '#ef4444',
            'Earth': '#22c55e',
            'Air': '#eab308',
            'Water': '#3b82f6'
        };

        // Интерактивность
        this.hoveredAspect = null;
        this.selectedPlanet = null;
        this.aspectLookupByKey = {};

        // Фильтры аспектов
        this.aspectFilter = 'all'; // 'all', 'major', 'minor'

        // Ориентация карты
        // mode: 'aries' (по умолчанию) или 'asc'
        // direction: 'clockwise' или 'counterclockwise'
        this.orientationMode = 'asc';
        this.orientationDirection = 'counterclockwise';

        this.aspectNameAliases = {
            TrueNorthNode: 'TrueNode',
            TrueSouthNode: 'SouthNode',
            Fortune: 'PartOfFortune'
        };
        this.aspectSortRank = [
            'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
            'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
            'Chiron', 'Proserpina',
            'TrueNode', 'SouthNode',
            'BlackMoon', 'WhiteMoon', 'PartOfFortune',
            'ASC', 'MC', 'IC', 'DSC', 'Vertex', 'AntiVertex'
        ].reduce((acc, name, idx) => {
            acc[name] = idx;
            return acc;
        }, {});

        this.planetLeaderColor = '#9ca3af';
        this.conjunctionDisplay = {
            collapseThreshold: 9,
            minLineLength: 14,
        };
    }

    updateSvgViewport() {
        if (!this.svg) return;
        const padding = Number.isFinite(this.svgPadding) ? this.svgPadding : 0;
        const size = this.center * 2;
        this.svg.setAttribute('viewBox', `${-padding} ${-padding} ${size + padding * 2} ${size + padding * 2}`);
        this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }

    readPointScale() {
        return this.clampPointScale(1);
    }

    clampPointScale(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return 1;
        return Math.min(1.7, Math.max(0.8, n));
    }

    t(key, params) {
        return window.FrontendI18n?.t?.(key, params) || key;
    }

    getPlanetName(name) {
        const key = `astro.planet.${name}`;
        const translated = this.t(key);
        return translated === key ? (Symbols.planetNamesRu[name] || name) : translated;
    }

    getSignName(name) {
        const key = `astro.sign.${name}`;
        const translated = this.t(key);
        return translated === key ? (Symbols.signNamesRu[name] || name) : translated;
    }

    normalizeAspectBodyName(name) {
        if (!name) return name;
        return this.aspectNameAliases[name] || name;
    }

    getAspectRank(name) {
        const normalizedName = this.normalizeAspectBodyName(name);
        return this.aspectSortRank[normalizedName] ?? 999;
    }

    buildAspectKey(planetA, planetB) {
        const left = this.normalizeAspectBodyName(planetA);
        const right = this.normalizeAspectBodyName(planetB);
        const leftRank = this.getAspectRank(left);
        const rightRank = this.getAspectRank(right);

        if (leftRank < rightRank) return `${left}-${right}`;
        if (rightRank < leftRank) return `${right}-${left}`;
        return left <= right ? `${left}-${right}` : `${right}-${left}`;
    }

    getAspectHarmonicLabel(harmonicType) {
        if (harmonicType === 'harmonious') return this.t('page.chart.legend.harmonious');
        if (harmonicType === 'tense') return this.t('page.chart.legend.tense');
        return this.t('page.chart.legend.neutral');
    }

    setVisualPreferences(visualPreferences, { redraw = true } = {}) {
        this.visualPreferences = window.AstroPreferences?.resolveVisualPreferences
            ? window.AstroPreferences.resolveVisualPreferences(visualPreferences || {})
            : (visualPreferences || {});
        this.aspectColors = this.visualPreferences?.aspect_colors || this.aspectColors;
        this.elementColors = this.visualPreferences?.planet_colors?.element_palette || this.elementColors;
        if (redraw && this.chartData) {
            this.draw(this.chartData);
        }
    }

    getAspectColor(aspectType, harmonicType = null) {
        return window.AstroPreferences?.getAspectColor
            ? window.AstroPreferences.getAspectColor(aspectType, this.visualPreferences, harmonicType)
            : (this.aspectColors?.[aspectType] || '#9ca3af');
    }

    getPlanetColor(planet) {
        const bodyName = typeof planet === 'string' ? planet : planet?.name;
        const element = typeof planet === 'string' ? null : planet?.element || Symbols.signElements?.[planet?.sign];
        return window.AstroPreferences?.getPlanetColor
            ? window.AstroPreferences.getPlanetColor(bodyName, element, this.visualPreferences)
            : (this.elementColors?.[element] || '#374151');
    }

    getAspectTooltipHtml(aspectData) {
        const leftPlanet = this.normalizeAspectBodyName(aspectData?.left_planet || aspectData?.planet_1);
        const rightPlanet = this.normalizeAspectBodyName(aspectData?.right_planet || aspectData?.planet_2);
        const leftSymbol = Symbols.planets[leftPlanet] || '';
        const rightSymbol = Symbols.planets[rightPlanet] || '';
        const leftName = this.getPlanetName(leftPlanet);
        const rightName = this.getPlanetName(rightPlanet);
        const aspectType = aspectData?.aspect_type || '';
        const aspectSymbol = Symbols.getAspectDisplay?.(aspectType) || Symbols.aspects[aspectType] || '';
        const aspectName = this.t(`astro.aspect.${aspectType}`);
        const aspectLabel = aspectName === `astro.aspect.${aspectType}` ? (Symbols.aspectNamesRu[aspectType] || aspectType) : aspectName;
        const orb = Number(aspectData?.orb);
        const orbLabel = Number.isFinite(orb) ? `${orb.toFixed(2)}°` : this.t('common.notAvailable');
        const harmonicLabel = this.getAspectHarmonicLabel(aspectData?.harmonic_type);

        return `
            <strong><span class="astro-symbol">${leftSymbol}</span> ${leftName} ${aspectSymbol} ${aspectLabel} <span class="astro-symbol">${rightSymbol}</span> ${rightName}</strong><br>
            ${this.t('common.orb')}: ${orbLabel}<br>
            ${harmonicLabel}
        `;
    }

    dispatchAspectHover(type, detail = {}) {
        document.dispatchEvent(new CustomEvent(type, { detail }));
    }

    /**
     * Преобразование эклиптической долготы в угол на карте
     * Базовая точка слева (180°)
     */
    longitudeToAngle(longitude) {
        const reference = this.getOrientationReference();
        let angle = this.orientationDirection === 'clockwise'
            ? 180 + (longitude - reference)
            : 180 - (longitude - reference);
        // Нормализация к диапазону 0-360°
        while (angle < 0) angle += 360;
        while (angle >= 360) angle -= 360;
        return angle;
    }

    getOrientationReference() {
        if (this.orientationMode === 'asc') {
            return this.chartData?.angles?.ASC?.longitude || 0;
        }
        return 0;
    }

    normalizeAngle(angle) {
        let normalized = Number(angle) || 0;
        while (normalized < 0) normalized += 360;
        while (normalized >= 360) normalized -= 360;
        return normalized;
    }

    getSignOuterRadius() {
        return this.outerRadius - this.degreeRingWidth;
    }

    getSignInnerRadius() {
        return this.getSignOuterRadius() - this.signRingWidth;
    }

    getHouseInnerRadius() {
        return this.getSignInnerRadius() - this.houseRingWidth;
    }

    getHouseCenterRadius() {
        return this.getHouseInnerRadius() + this.houseRingWidth / 2;
    }

    getAspectBoundaryRadius() {
        return this.getHouseInnerRadius();
    }

    getHouseLabelColor(isAngular) {
        if (this.houseLabelsOutside) {
            return this.houseVisualOptions.outsideColor || '#111111';
        }
        return isAngular
            ? this.houseVisualOptions.insideAngularColor
            : this.houseVisualOptions.insideMutedColor;
    }

    getHouseLineColor(isAngular) {
        if (this.houseLabelsOutside) {
            return this.houseVisualOptions.outsideLineColor || '#111111';
        }
        return isAngular
            ? this.houseVisualOptions.insideAngularLineColor
            : this.houseVisualOptions.insideMutedLineColor;
    }

    getOutsideHouseLabelGeometry(angle) {
        const radialOffset = Number(this.houseVisualOptions.outsideRadialOffset) || 0;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const tangentX = -sin;
        const tangentY = cos;
        const tangentOffset = Number(this.houseVisualOptions.outsideTangentOffset) || 0;
        const verticalBias = Math.max(0, 0.55 - Math.abs(cos)) * 18;
        const radius = this.outerRadius + radialOffset;
        const anchor = Math.abs(cos) < 0.18 ? 'middle' : (cos > 0 ? 'start' : 'end');

        return {
            x: this.center + radius * cos + (tangentOffset + verticalBias) * tangentX,
            y: this.center + radius * sin + (tangentOffset + verticalBias) * tangentY,
            anchor,
        };
    }

    resolveAspectLineGeometry({ x1, y1, x2, y2, angle1, angle2, aspectType }) {
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const rawLength = Math.hypot(x2 - x1, y2 - y1);

        if (aspectType !== 'Conjunction' || rawLength >= this.conjunctionDisplay.collapseThreshold) {
            return {
                x1,
                y1,
                x2,
                y2,
                midX,
                midY,
                rawLength,
                collapsed: false,
            };
        }

        const avgCos = Math.cos(angle1) + Math.cos(angle2);
        const avgSin = Math.sin(angle1) + Math.sin(angle2);
        const avgNorm = Math.hypot(avgCos, avgSin) || 1;
        const tangentX = -avgSin / avgNorm;
        const tangentY = avgCos / avgNorm;
        const halfLength = this.conjunctionDisplay.minLineLength / 2;

        return {
            x1: midX - tangentX * halfLength,
            y1: midY - tangentY * halfLength,
            x2: midX + tangentX * halfLength,
            y2: midY + tangentY * halfLength,
            midX,
            midY,
            rawLength,
            collapsed: true,
        };
    }

    /**
     * Отрисовка полной карты
     */
    draw(chartData) {
        this.dispatchAspectHover('chart:aspect-leave', { source: 'wheel' });
        this.hideTooltip();
        this.svg.innerHTML = '';
        this.chartData = chartData;
        this.aspectLookupByKey = {};
        this.aspectRadius = this.getAspectBoundaryRadius();
        this.planetRadius = this.getHouseCenterRadius();

        // Создаём группы для слоёв (порядок важен для z-index)
        this.createLayers();

        // Фоновый круг
        this.drawBackground();

        // Двойное кольцо зодиака (градусы + символы)
        this.drawDualSignRing();

        // Линии домов
        this.drawHouses(chartData.houses);

        // Центральный круг для аспектов
        this.drawAspectCircle();

        // Аспекты с улучшенным стилем
        if (chartData.aspects) {
            this.drawAspectsEnhanced(chartData.aspects, chartData.planets);
        }

        // Планеты с anti-collision
        this.drawPlanetsEnhanced(chartData.planets);

        // Углы ASC/MC с выносными линиями
        this.drawAnglesEnhanced(chartData.angles);

        // Привязка событий
        this.bindEvents();
    }

    createLayers() {
        this.layers = {
            background: this.createSvgElement('g', { id: 'layer-bg' }),
            signs: this.createSvgElement('g', { id: 'layer-signs' }),
            houses: this.createSvgElement('g', { id: 'layer-houses' }),
            aspects: this.createSvgElement('g', { id: 'layer-aspects' }),
            planets: this.createSvgElement('g', { id: 'layer-planets' }),
            angles: this.createSvgElement('g', { id: 'layer-angles' }),
            labels: this.createSvgElement('g', { id: 'layer-labels' })
        };
        Object.values(this.layers).forEach(l => this.svg.appendChild(l));
    }

    drawBackground() {
        const circle = this.createSvgElement('circle', {
            cx: this.center,
            cy: this.center,
            r: this.outerRadius,
            fill: '#fafafa',
            stroke: '#d1d5db',
            'stroke-width': 1
        });
        this.layers.background.appendChild(circle);
    }

    /**
     * Двойное кольцо: внешнее — градусная сетка, внутреннее — символы знаков
     */
    drawDualSignRing() {
        const degreeR = this.outerRadius;
        const signOuterR = this.outerRadius - this.degreeRingWidth;
        const signInnerR = signOuterR - this.signRingWidth;

        // Внутренняя граница кольца знаков
        this.layers.signs.appendChild(this.createSvgElement('circle', {
            cx: this.center,
            cy: this.center,
            r: signInnerR,
            fill: 'white',
            stroke: '#d1d5db',
            'stroke-width': 1
        }));

        // Граница между градусами и знаками
        this.layers.signs.appendChild(this.createSvgElement('circle', {
            cx: this.center,
            cy: this.center,
            r: signOuterR,
            fill: 'none',
            stroke: '#d1d5db',
            'stroke-width': 1
        }));

        // 12 секторов знаков
        // Левый горизонт (180°) — базовая точка, порядок зависит от ориентации
        for (let i = 0; i < 12; i++) {
            // Эклиптическая долгота знака (Овен 0-30°, Телец 30-60° и т.д.)
            const signStartLong = i * 30;
            const signEndLong = signStartLong + 30;

            // Преобразуем в углы на карте
            const signStartAngle = this.longitudeToAngle(signStartLong);
            const signEndAngle = this.longitudeToAngle(signEndLong);

            const sign = this.getSignByIndex(i);
            const element = Symbols.signElements[sign];
            const color = window.AstroPreferences?.getElementColor
                ? window.AstroPreferences.getElementColor(element, this.visualPreferences)
                : (this.elementColors[element] || '#6b7280');

            // Сектор с цветом стихии
            this.drawArc(signOuterR, signInnerR, signEndAngle, signStartAngle, color + '18', this.layers.signs);

            // Разделительная линия знаков (на границе signEndAngle)
            const lineAngle = signEndAngle * Math.PI / 180;
            this.layers.signs.appendChild(this.createSvgElement('line', {
                x1: this.center + signInnerR * Math.cos(lineAngle),
                y1: this.center + signInnerR * Math.sin(lineAngle),
                x2: this.center + degreeR * Math.cos(lineAngle),
                y2: this.center + degreeR * Math.sin(lineAngle),
                stroke: '#9ca3af',
                'stroke-width': 1.5
            }));

            // Градусные метки (каждые 5° внутри знака)
            for (let deg = 0; deg < 30; deg += 5) {
                const tickLong = signStartLong + deg;
                const tickAngle = this.longitudeToAngle(tickLong) * Math.PI / 180;
                const tickOuter = degreeR;
                const tickInner = deg % 10 === 0 ? signOuterR + 2 : signOuterR + 5;

                this.layers.signs.appendChild(this.createSvgElement('line', {
                    x1: this.center + tickInner * Math.cos(tickAngle),
                    y1: this.center + tickInner * Math.sin(tickAngle),
                    x2: this.center + tickOuter * Math.cos(tickAngle),
                    y2: this.center + tickOuter * Math.sin(tickAngle),
                    stroke: '#9ca3af',
                    'stroke-width': deg % 10 === 0 ? 1 : 0.5
                }));
            }

            // Символ знака (в середине сектора)
            const midLong = signStartLong + 15;
            const midAngle = this.longitudeToAngle(midLong) * Math.PI / 180;
            const textR = signInnerR + this.signRingWidth / 2;
            this.layers.signs.appendChild(this.createSvgElement('text', {
                x: this.center + textR * Math.cos(midAngle),
                y: this.center + textR * Math.sin(midAngle) + 5,
                'text-anchor': 'middle',
                'font-size': '13',
                'font-weight': '500',
                fill: color,
                class: 'sign-symbol-text'
            }, Symbols.signs[sign]));
        }
    }

    drawHouses(houses) {
        const signInnerR = this.getSignInnerRadius();
        const houseInnerR = this.getHouseInnerRadius();
        const outsideExtension = Number(this.houseVisualOptions.outsideExtension) || 14;
        const lineOuterR = signInnerR;
        const outsideSegmentStartR = this.outerRadius + 1;
        const outsideSegmentEndR = this.outerRadius + outsideExtension;

        // Круг домов (внутренняя граница)
        this.layers.houses.appendChild(this.createSvgElement('circle', {
            cx: this.center,
            cy: this.center,
            r: houseInnerR,
            fill: 'white',
            stroke: '#d1d5db',
            'stroke-width': 1
        }));

        houses.forEach((house, idx) => {
            // Используем единую функцию преобразования
            const angle = this.longitudeToAngle(house.longitude) * Math.PI / 180;
            const isAngular = [1, 4, 7, 10].includes(house.number);
            const cuspGroup = this.createSvgElement('g', {
                class: 'house-cusp-group',
                'data-house': String(house.number),
                'data-sign': house.sign || '',
                'data-degree-in-sign': String(house.degree_in_sign ?? 0),
                'data-longitude': String(house.longitude ?? 0),
                style: 'cursor: pointer;'
            });

            const lineInnerR = houseInnerR;

            // Увеличенная прозрачная зона захвата для hover
            cuspGroup.appendChild(this.createSvgElement('line', {
                x1: this.center + lineInnerR * Math.cos(angle),
                y1: this.center + lineInnerR * Math.sin(angle),
                x2: this.center + lineOuterR * Math.cos(angle),
                y2: this.center + lineOuterR * Math.sin(angle),
                stroke: 'transparent',
                'stroke-width': 10,
                class: 'house-cusp-hit'
            }));

            cuspGroup.appendChild(this.createSvgElement('line', {
                x1: this.center + lineInnerR * Math.cos(angle),
                y1: this.center + lineInnerR * Math.sin(angle),
                x2: this.center + lineOuterR * Math.cos(angle),
                y2: this.center + lineOuterR * Math.sin(angle),
                stroke: this.getHouseLineColor(isAngular),
                'stroke-width': isAngular ? 2.5 : 1,
                class: 'house-cusp-line'
            }));

            if (this.houseLabelsOutside) {
                cuspGroup.appendChild(this.createSvgElement('line', {
                    x1: this.center + outsideSegmentStartR * Math.cos(angle),
                    y1: this.center + outsideSegmentStartR * Math.sin(angle),
                    x2: this.center + outsideSegmentEndR * Math.cos(angle),
                    y2: this.center + outsideSegmentEndR * Math.sin(angle),
                    stroke: 'transparent',
                    'stroke-width': 10,
                    class: 'house-cusp-hit'
                }));

                cuspGroup.appendChild(this.createSvgElement('line', {
                    x1: this.center + outsideSegmentStartR * Math.cos(angle),
                    y1: this.center + outsideSegmentStartR * Math.sin(angle),
                    x2: this.center + outsideSegmentEndR * Math.cos(angle),
                    y2: this.center + outsideSegmentEndR * Math.sin(angle),
                    stroke: this.getHouseLineColor(isAngular),
                    'stroke-width': isAngular ? 2.1 : 1.2,
                    class: 'house-cusp-line'
                }));
            }

            // Номер дома в секторе (дома идут против часовой: 1→2→3→...→12)
            // Дом N занимает сектор от куспида N до куспида N+1 (против часовой)
            const nextHouse = houses[(idx + 1) % 12];
            // Середина сектора: от house.longitude против часовой к nextHouse.longitude
            let midLong = (house.longitude + nextHouse.longitude) / 2;
            if (nextHouse.longitude < house.longitude) {
                midLong = ((house.longitude + nextHouse.longitude + 360) / 2) % 360;
            }
            const midAngle = this.longitudeToAngle(midLong) * Math.PI / 180;
            if (this.houseLabelsOutside) {
                const outsideLabel = this.getOutsideHouseLabelGeometry(angle);
                cuspGroup.appendChild(this.createSvgElement('text', {
                    x: outsideLabel.x,
                    y: outsideLabel.y,
                    'text-anchor': outsideLabel.anchor,
                    'dominant-baseline': 'middle',
                    'font-size': '9.5',
                    'font-weight': isAngular ? '600' : '500',
                    fill: this.getHouseLabelColor(isAngular),
                    stroke: '#fafafa',
                    'stroke-width': '2.4',
                    'stroke-linejoin': 'round',
                    'paint-order': 'stroke',
                    style: 'pointer-events: none;'
                }, this.formatHouseLabel(house.number)));
            } else {
                const textR = signInnerR - 10;
                cuspGroup.appendChild(this.createSvgElement('text', {
                    x: this.center + textR * Math.cos(midAngle),
                    y: this.center + textR * Math.sin(midAngle) + 3,
                    'text-anchor': 'middle',
                    'font-size': '10',
                    'font-weight': isAngular ? '700' : '400',
                    fill: this.getHouseLabelColor(isAngular),
                    style: 'pointer-events: none;'
                }, this.formatHouseLabel(house.number)));
            }

            this.layers.houses.appendChild(cuspGroup);
        });
    }

    drawAspectCircle() {
        // Внутренний контур уже отрисован как граница кольца домов.
    }

    /**
     * Улучшенная отрисовка аспектов:
     * - Цвет по типу аспекта
     * - Сплошные для мажорных, пунктир для минорных
     * - Толщина зависит от орбиса (более тонкие линии)
     * - Иконки аспектов на середине линии
     */
    drawAspectsEnhanced(aspects, planets) {
        const aspectRadius = this.getAspectBoundaryRadius();
        this.aspectRadius = aspectRadius;
        const planetMap = {};
        planets.forEach((p) => {
            const normalizedName = this.normalizeAspectBodyName(p.name);
            planetMap[p.name] = p.longitude;
            planetMap[normalizedName] = p.longitude;
        });

        // Символы аспектов
        const aspectGlyphs = {
            'Conjunction': '☌', 'Opposition': '☍', 'Trine': '△',
            'Square': '□', 'Sextile': '⚹', 'Quincunx': '⚻',
            'Semisextile': '⚺', 'Quintile': 'Q', 'Biquintile': 'bQ',
            'Semisquare': '∠', 'Sesquiquadrate': '⚼'
        };

        // Сортируем: сначала слабые (тонкие), потом точные (жирные)
        const sorted = [...aspects].sort((a, b) => b.orb - a.orb);

        sorted.forEach(aspect => {
            const planet1 = this.normalizeAspectBodyName(aspect.planet_1);
            const planet2 = this.normalizeAspectBodyName(aspect.planet_2);
            const long1 = planetMap[aspect.planet_1] ?? planetMap[planet1];
            const long2 = planetMap[aspect.planet_2] ?? planetMap[planet2];
            if (long1 === undefined || long2 === undefined) return;
            const aspectKey = this.buildAspectKey(planet1, planet2);
            this.aspectLookupByKey[aspectKey] = {
                ...aspect,
                planet_1: planet1,
                planet_2: planet2,
                left_planet: this.normalizeAspectBodyName(aspect.left_planet || planet1),
                right_planet: this.normalizeAspectBodyName(aspect.right_planet || planet2)
            };

            // Мажорные — сплошные, минорные — пунктир
            const isMajor = this.majorAspects.includes(aspect.aspect_type);

            // Фильтрация по типу аспекта
            if (this.aspectFilter === 'major' && !isMajor) return;
            if (this.aspectFilter === 'minor' && isMajor) return;

            const angle1 = this.longitudeToAngle(long1) * Math.PI / 180;
            const angle2 = this.longitudeToAngle(long2) * Math.PI / 180;

            const x1 = this.center + aspectRadius * Math.cos(angle1);
            const y1 = this.center + aspectRadius * Math.sin(angle1);
            const x2 = this.center + aspectRadius * Math.cos(angle2);
            const y2 = this.center + aspectRadius * Math.sin(angle2);
            const geometry = this.resolveAspectLineGeometry({
                x1,
                y1,
                x2,
                y2,
                angle1,
                angle2,
                aspectType: aspect.aspect_type,
            });

            // Цвет по типу аспекта
            const color = this.getAspectColor(aspect.aspect_type, aspect.harmonic_type);

            // Толщина: более тонкие линии (0° → 1.5px, 10° → 0.3px)
            const maxOrb = 12;
            const thickness = Math.max(0.3, 1.5 - (aspect.orb / maxOrb) * 1.2);

            const dashArray = isMajor ? 'none' : '3,2';

            const line = this.createSvgElement('line', {
                x1: geometry.x1,
                y1: geometry.y1,
                x2: geometry.x2,
                y2: geometry.y2,
                stroke: color,
                'stroke-width': thickness,
                'stroke-dasharray': dashArray,
                'stroke-linecap': aspect.aspect_type === 'Conjunction' ? 'round' : 'butt',
                opacity: isMajor ? 0.7 : 0.45,
                class: 'aspect-line',
                'data-aspect': aspectKey,
                'data-aspect-key': aspectKey,
                'data-planet-1': planet1,
                'data-planet-2': planet2,
                'data-type': aspect.aspect_type,
                'data-major': isMajor ? 'true' : 'false',
                'data-conjunction-collapsed': geometry.collapsed ? 'true' : 'false'
            });

            this.layers.aspects.appendChild(line);

            const shouldDrawAspectGlyph = isMajor
                && aspect.orb < 5
                && (aspect.aspect_type !== 'Conjunction' || geometry.collapsed);

            // Иконка аспекта на середине линии
            if (shouldDrawAspectGlyph) {
                const midX = geometry.midX;
                const midY = geometry.midY;
                const glyph = aspectGlyphs[aspect.aspect_type];

                if (glyph) {
                    const symbolGroup = this.createSvgElement('g', {
                        class: 'aspect-symbol-group',
                        style: 'pointer-events: none;'
                    });
                    const symbolText = this.createSvgElement('text', {
                        x: midX, y: midY + 2.5,
                        'text-anchor': 'middle',
                        'font-size': '8',
                        fill: color,
                        class: 'aspect-symbol-text',
                        style: 'pointer-events: none;'
                    }, glyph);
                    symbolGroup.appendChild(symbolText);
                    this.layers.aspects.appendChild(symbolGroup);

                    try {
                        const bbox = symbolText.getBBox();
                        const backdropRadius = Math.max(bbox.width, bbox.height) / 2 + 1.5;
                        const backdrop = this.createSvgElement('circle', {
                            cx: bbox.x + bbox.width / 2,
                            cy: bbox.y + bbox.height / 2,
                            r: backdropRadius,
                            fill: '#fafafa',
                            opacity: '0.96',
                            class: 'aspect-symbol-backdrop'
                        });
                        symbolGroup.insertBefore(backdrop, symbolText);
                    } catch (error) {
                        // Ignore bbox issues and keep the text visible even without backdrop.
                    }
                }
            }
        });
    }

    /**
     * Улучшенная отрисовка планет с кластерным anti-collision и выносками
     */
    drawPlanetsEnhanced(planets) {
        const houseCenterRadius = this.getHouseCenterRadius();
        const anchorRadius = this.getAspectBoundaryRadius();
        this.planetRadius = houseCenterRadius;
        const positions = this.calculatePlanetPositionsEnhanced(planets, {
            baseRadius: houseCenterRadius,
        });

        positions.forEach(({ planet, angle, displayAngle, displayRadius, hasLeader }) => {
            const displayAngleRad = displayAngle * Math.PI / 180;
            const exactAngleRad = angle * Math.PI / 180;
            const radius = Number.isFinite(displayRadius) ? displayRadius : this.planetRadius;
            const x = this.center + radius * Math.cos(displayAngleRad);
            const y = this.center + radius * Math.sin(displayAngleRad);
            const anchorX = this.center + anchorRadius * Math.cos(exactAngleRad);
            const anchorY = this.center + anchorRadius * Math.sin(exactAngleRad);
            const color = this.getPlanetColor(planet);
            const scale = this.isPointBody(planet.name) ? this.pointScale : this.planetScale;
            const useVectorIcon = window.AstroGlyphs?.hasPlanetIcon?.(planet.name) === true;
            const glyphScale = useVectorIcon ? 1 : (Symbols.planetGlyphScale?.[planet.name] || 1);
            const glyphSize = this.natalGlyphBaseSize * glyphScale * scale;
            const iconBoxScale = useVectorIcon ? (window.AstroGlyphs?.getPlanetIconScale?.(planet.name) || 1.18) : 1;
            const iconSize = useVectorIcon ? this.natalGlyphBaseSize * scale * iconBoxScale : glyphSize;
            const leaderTargetRadius = Math.max(9 * scale, iconSize * 0.58);
            const leaderEnd = this.getLeaderLineEndPoint(
                { x: anchorX, y: anchorY },
                { x, y },
                leaderTargetRadius,
                2.2
            );

            // Группа для интерактивности
            const group = this.createSvgElement('g', {
                class: 'planet-group',
                'data-planet': planet.name,
                style: 'cursor: pointer;'
            });

            group.appendChild(this.createSvgElement('line', {
                x1: anchorX, y1: anchorY,
                x2: leaderEnd.x, y2: leaderEnd.y,
                stroke: this.planetLeaderColor,
                'stroke-width': 0.5,
                opacity: hasLeader ? 0.34 : 0.24,
                class: 'planet-leader-line',
                style: 'pointer-events: none;'
            }));

            group.appendChild(this.createSvgElement('circle', {
                cx: anchorX,
                cy: anchorY,
                r: 1.8,
                fill: '#fafafa',
                stroke: this.planetLeaderColor,
                'stroke-width': 1,
                opacity: hasLeader ? 0.8 : 0.48,
                class: 'planet-anchor-point',
                style: 'pointer-events: none;'
            }));

            // Фоновый круг (прозрачный, для интерактивности)
            group.appendChild(this.createSvgElement('circle', {
                cx: x, cy: y, r: 10 * scale,
                fill: 'transparent',
                class: 'planet-circle'
            }));

            if (useVectorIcon) {
                group.appendChild(window.AstroGlyphs.createPlanetSymbolSvg(planet.name, {
                    size: iconSize,
                    x: x - iconSize / 2,
                    y: y - iconSize / 2,
                    color,
                    title: this.getPlanetName(planet.name),
                    pointerEvents: 'none',
                }));
            } else {
                group.appendChild(this.createSvgElement('text', {
                    x: x, y: y + glyphSize * 0.33,
                    'text-anchor': 'middle',
                    'font-size': glyphSize.toFixed(2),
                    'font-weight': '600',
                    fill: color,
                    class: 'planet-symbol-text',
                    style: 'pointer-events: none;'
                }, Symbols.planets[planet.name] || planet.name.charAt(0)));
            }

            const annotationScale = Math.min(1.25, scale);
            const motionFontSize = (8 * annotationScale).toFixed(2);
            const motionX = x + iconSize * 0.17;
            const motionY = y + iconSize * 0.22;

            if (this.showPlanetStationary && planet.is_stationary) {
                group.appendChild(this.createSvgElement('text', {
                    x: motionX,
                    y: motionY - iconSize * 0.17,
                    'font-size': motionFontSize,
                    'font-weight': '700',
                    fill: '#1e3a5f',
                    style: 'pointer-events: none;'
                }, 'S'));
            }

            if (planet.retrograde) {
                group.appendChild(this.createSvgElement('text', {
                    x: motionX,
                    y: motionY,
                    'font-size': motionFontSize,
                    'font-weight': '700',
                    fill: '#dc2626',
                    style: 'pointer-events: none;'
                }, 'R'));
            }

            if (this.showPlanetDegree) {
                const degreeLabel = `${Math.floor(Number(planet.degree_in_sign) || 0)}°`;
                group.appendChild(this.createSvgElement('text', {
                    x: x - iconSize * 0.24,
                    y: y - iconSize * 0.08,
                    'text-anchor': 'end',
                    'font-size': (4.9 * annotationScale).toFixed(2),
                    'font-family': 'monospace',
                    'font-weight': '600',
                    fill: '#5c554e',
                    style: 'pointer-events: none;'
                }, degreeLabel));
            }

            this.layers.planets.appendChild(group);
        });
    }

    /**
     * Anti-collision: группируем близкие точки и равномерно разводим их по дуге
     */
    calculatePlanetPositionsEnhanced(planets, options = {}) {
        const baseRadius = Number.isFinite(options.baseRadius) ? options.baseRadius : this.planetRadius;
        const secondTrackRadius = baseRadius + 8;
        const positions = planets
            .map(planet => {
                const scale = this.isPointBody(planet.name) ? this.pointScale : this.planetScale;
                const useVectorIcon = window.AstroGlyphs?.hasPlanetIcon?.(planet.name) === true;
                const glyphScale = useVectorIcon ? 1 : (Symbols.planetGlyphScale?.[planet.name] || 1);
                const angle = this.normalizeAngle(this.longitudeToAngle(planet.longitude));
                return {
                    planet,
                    angle,
                    displayAngle: angle,
                    displayRadius: baseRadius,
                    glyphSize: useVectorIcon
                        ? this.natalGlyphBaseSize * scale * (window.AstroGlyphs?.getPlanetIconScale?.(planet.name) || 1.18)
                        : this.natalGlyphBaseSize * glyphScale * scale,
                    hasLeader: false,
                    clusterAngle: null
                };
            })
            .sort((a, b) => a.angle - b.angle);

        if (positions.length <= 1) {
            return positions;
        }

        const getPairGapDeg = (leftItem, rightItem, radius = baseRadius) => {
            const pairGapPx = ((leftItem.glyphSize + rightItem.glyphSize) / 2) + 2;
            return Math.max(1.1, (pairGapPx / (2 * Math.PI * Math.max(radius, 1))) * 360);
        };

        const compactTrack = (items, radius) => {
            if (!items.length) return [];
            const rawAngles = items.map((item) => item.clusterAngle);
            const displayAngles = [...rawAngles];

            for (let index = 1; index < items.length; index++) {
                const minGapDeg = getPairGapDeg(items[index - 1], items[index], radius);
                displayAngles[index] = Math.max(rawAngles[index], displayAngles[index - 1] + minGapDeg);
            }

            const rawCenter = (rawAngles[0] + rawAngles[rawAngles.length - 1]) / 2;
            const displayCenter = (displayAngles[0] + displayAngles[displayAngles.length - 1]) / 2;
            const shift = rawCenter - displayCenter;
            return displayAngles.map((angle) => angle + shift);
        };

        const clusters = [];
        let currentCluster = [positions[0]];

        for (let i = 1; i < positions.length; i++) {
            const prev = positions[i - 1];
            const curr = positions[i];
            const pairGapDeg = getPairGapDeg(prev, curr);
            if ((curr.angle - prev.angle) < pairGapDeg) {
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
            const wrapMinGap = getPairGapDeg(lastCluster[lastCluster.length - 1], firstCluster[0]);

            if (wrapGap < wrapMinGap) {
                const mergedCluster = [...lastCluster, ...firstCluster];
                mergedCluster.forEach((item, index) => {
                    item.clusterAngle = index < lastCluster.length ? item.angle : item.angle + 360;
                });
                clusters[0] = mergedCluster;
                clusters.pop();
            }
        }

        clusters.forEach((cluster) => {
            cluster.forEach((item) => {
                if (item.clusterAngle == null) item.clusterAngle = item.angle;
                item.displayRadius = baseRadius;
                item.displayAngle = this.normalizeAngle(item.clusterAngle);
                item.hasLeader = false;
            });

            if (cluster.length === 1) return;

            const rawAngles = cluster.map((item) => item.clusterAngle);
            const primaryTrackAngles = compactTrack(cluster, baseRadius);
            const maxOffsetDeg = 3.25;
            const needsSecondTrack = primaryTrackAngles.some((angle, index) => Math.abs(angle - rawAngles[index]) > maxOffsetDeg);

            if (!needsSecondTrack) {
                const leaderThreshold = Math.max(0.35, getPairGapDeg(cluster[0], cluster[Math.min(cluster.length - 1, 1)], baseRadius) * 0.18);
                cluster.forEach((item, index) => {
                    item.displayAngle = this.normalizeAngle(primaryTrackAngles[index]);
                    item.displayRadius = baseRadius;
                    item.hasLeader = Math.abs(primaryTrackAngles[index] - rawAngles[index]) > leaderThreshold;
                });
                return;
            }

            const primaryTrackItems = cluster.filter((_, index) => index % 2 === 0);
            const secondaryTrackItems = cluster.filter((_, index) => index % 2 === 1);
            const primaryCompactAngles = compactTrack(primaryTrackItems, baseRadius);
            const secondaryCompactAngles = compactTrack(secondaryTrackItems, secondTrackRadius);

            let primaryIndex = 0;
            let secondaryIndex = 0;
            cluster.forEach((item) => {
                const isSecondaryTrack = cluster.indexOf(item) % 2 === 1;
                const rawAngle = item.clusterAngle;
                const displayRawAngle = isSecondaryTrack
                    ? secondaryCompactAngles[secondaryIndex++]
                    : primaryCompactAngles[primaryIndex++];
                const displayRadius = isSecondaryTrack ? secondTrackRadius : baseRadius;
                item.displayAngle = this.normalizeAngle(displayRawAngle);
                item.displayRadius = displayRadius;
                item.hasLeader = Math.abs(displayRawAngle - rawAngle) > 0.35 || Math.abs(displayRadius - baseRadius) > 0.5;
            });
        });

        return positions;
    }

    /**
     * Улучшенные маркеры углов ASC/MC с выносными линиями
     */
    drawAnglesEnhanced(angles) {
        if (!angles) return;

        const signInnerR = this.outerRadius - this.degreeRingWidth - this.signRingWidth;

        // ASC — горизонтальная линия слева, выходит за круг
        if (angles.ASC) {
            const ascAngle = this.longitudeToAngle(angles.ASC.longitude) * Math.PI / 180;
            this.drawAngleMarkerEnhanced(ascAngle, signInnerR, 'ASC', this.angleMarkerOptions.color);
        }

        // MC — вертикальная линия сверху
        if (angles.MC) {
            const mcAngle = this.longitudeToAngle(angles.MC.longitude) * Math.PI / 180;
            this.drawAngleMarkerEnhanced(mcAngle, signInnerR, 'MC', this.angleMarkerOptions.color);
        }

        // DSC — напротив ASC
        if (angles.DSC) {
            const dscAngle = this.longitudeToAngle(angles.DSC.longitude) * Math.PI / 180;
            this.drawAngleMarkerEnhanced(dscAngle, signInnerR, 'DSC', this.angleMarkerOptions.color);
        }

        // IC — напротив MC
        if (angles.IC) {
            const icAngle = this.longitudeToAngle(angles.IC.longitude) * Math.PI / 180;
            this.drawAngleMarkerEnhanced(icAngle, signInnerR, 'IC', this.angleMarkerOptions.color);
        }
    }

    drawAngleMarkerEnhanced(angle, radius, label, color) {
        const lineOuterR = this.houseLabelsOutside ? this.outerRadius + 14 : this.outerRadius - 0.5;
        const labelR = this.outerRadius + (this.houseLabelsOutside ? 20 : 8);
        const isAscDsc = label === 'ASC' || label === 'DSC';
        const isMcIc = label === 'MC' || label === 'IC';
        const isBold = (isAscDsc && this.angleMarkerOptions.ascDscBold !== false)
            || (isMcIc && this.angleMarkerOptions.mcIcBold !== false);

        // Линия выносная за пределы круга
        this.layers.angles.appendChild(this.createSvgElement('line', {
            x1: this.center + this.aspectRadius * Math.cos(angle),
            y1: this.center + this.aspectRadius * Math.sin(angle),
            x2: this.center + lineOuterR * Math.cos(angle),
            y2: this.center + lineOuterR * Math.sin(angle),
            stroke: color,
            'stroke-width': isBold ? 2.5 : 1.5
        }));

        // Подпись за кругом
        const cos = Math.cos(angle);
        const anchor = Math.abs(cos) < 0.2
            ? 'middle'
            : (cos > 0 ? 'start' : 'end');
        const dx = anchor === 'middle' ? 0 : (anchor === 'start' ? 3 : -3);
        this.layers.labels.appendChild(this.createSvgElement('text', {
            x: this.center + labelR * Math.cos(angle) + dx,
            y: this.center + labelR * Math.sin(angle) + 3,
            'text-anchor': anchor,
            'font-size': '9',
            'font-weight': isBold ? '700' : '500',
            fill: color
        }, label));
    }

    drawArc(outerR, innerR, startAngle, endAngle, fill, layer = null) {
        const start1 = this.polarToCartesian(outerR, startAngle);
        const end1 = this.polarToCartesian(outerR, endAngle);
        const start2 = this.polarToCartesian(innerR, endAngle);
        const end2 = this.polarToCartesian(innerR, startAngle);

        const d = [
            `M ${start1.x} ${start1.y}`,
            `A ${outerR} ${outerR} 0 0 1 ${end1.x} ${end1.y}`,
            `L ${start2.x} ${start2.y}`,
            `A ${innerR} ${innerR} 0 0 0 ${end2.x} ${end2.y}`,
            'Z'
        ].join(' ');

        const path = this.createSvgElement('path', { d, fill });
        (layer || this.svg).appendChild(path);
    }

    polarToCartesian(r, angleDeg) {
        const angle = angleDeg * Math.PI / 180;
        return {
            x: this.center + r * Math.cos(angle),
            y: this.center + r * Math.sin(angle)  // Зеркальное отображение по горизонтальной оси
        };
    }

    getLeaderLineEndPoint(anchorPoint, iconPoint, iconRadius, gap = 2) {
        const dx = iconPoint.x - anchorPoint.x;
        const dy = iconPoint.y - anchorPoint.y;
        const distance = Math.hypot(dx, dy);
        if (!distance) {
            return { x: iconPoint.x, y: iconPoint.y };
        }
        const trim = Math.min(distance, Math.max(0, Number(iconRadius) || 0) + Math.max(0, Number(gap) || 0));
        const ratio = (distance - trim) / distance;
        return {
            x: anchorPoint.x + dx * ratio,
            y: anchorPoint.y + dy * ratio
        };
    }

    getSignByIndex(index) {
        const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
                       'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
        return signs[index];
    }

    createSvgElement(tag, attrs, text = null) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        if (text) el.textContent = text;
        return el;
    }

    /**
     * Установить фильтр аспектов и перерисовать
     * @param {string} filter - 'all', 'major', 'minor'
     */
    setAspectFilter(filter) {
        this.aspectFilter = filter;
        if (this.chartData) {
            this.draw(this.chartData);
        }
    }

    /**
     * Установить ориентацию карты и перерисовать
     * @param {string} mode - 'aries' | 'asc'
     */
    setOrientationMode(mode, options = {}) {
        const { redraw = true } = options;
        this.orientationMode = mode === 'asc' ? 'asc' : 'aries';
        // Движение от левой точки (9 часов) выполняем против часовой стрелки.
        this.orientationDirection = 'counterclockwise';
        if (redraw && this.chartData) {
            this.draw(this.chartData);
        }
    }

    /**
     * Установить масштаб точек и (опционально) перерисовать карту
     */
    setPointScale(scale, options = {}) {
        const { redraw = true } = options;
        const clamped = this.clampPointScale(scale);
        this.planetScale = clamped;
        this.pointScale = clamped;
        if (redraw && this.chartData) {
            this.draw(this.chartData);
        }
    }

    setPointScales(scales = {}, options = {}) {
        const { redraw = true } = options;
        if (typeof scales.planets !== 'undefined') {
            this.planetScale = this.clampPointScale(scales.planets);
        }
        if (typeof scales.points !== 'undefined') {
            this.pointScale = this.clampPointScale(scales.points);
        }
        if (redraw && this.chartData) {
            this.draw(this.chartData);
        }
    }

    setHouseLabelOptions(options = {}, settings = {}) {
        const { redraw = true } = settings;
        this.houseNumberStyle = options.style === 'roman' ? 'roman' : 'arabic';
        this.houseLabelsOutside = options.outside === true;
        if (redraw && this.chartData) {
            this.draw(this.chartData);
        }
    }

    setHouseVisualOptions(options = {}, settings = {}) {
        const { redraw = true } = settings;
        this.houseVisualOptions = {
            ...this.houseVisualOptions,
            ...Object.fromEntries(
                Object.entries(options || {}).filter(([, value]) => value !== undefined && value !== null)
            ),
        };
        if (redraw && this.chartData) {
            this.draw(this.chartData);
        }
    }

    setAngleMarkerOptions(options = {}, settings = {}) {
        const { redraw = true } = settings;
        this.angleMarkerOptions = {
            ...this.angleMarkerOptions,
            ...Object.fromEntries(
                Object.entries(options || {}).filter(([, value]) => value !== undefined && value !== null)
            ),
        };
        if (redraw && this.chartData) {
            this.draw(this.chartData);
        }
    }

    setPlanetAnnotationOptions(options = {}, settings = {}) {
        const { redraw = true } = settings;
        if (Object.prototype.hasOwnProperty.call(options, 'showStationary')) {
            this.showPlanetStationary = options.showStationary === true;
        }
        if (Object.prototype.hasOwnProperty.call(options, 'showDegree')) {
            this.showPlanetDegree = options.showDegree === true;
        }
        if (redraw && this.chartData) {
            this.draw(this.chartData);
        }
    }

    isPointBody(name) {
        return [
            'TrueNode',
            'TrueNorthNode',
            'SouthNode',
            'TrueSouthNode',
            'BlackMoon',
            'WhiteMoon',
            'PartOfFortune',
            'Fortune'
        ].includes(name);
    }

    formatHouseLabel(number) {
        if (this.houseNumberStyle !== 'roman') {
            return String(number);
        }
        const romanLabels = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
        return romanLabels[(Number(number) || 1) - 1] || String(number);
    }

    /**
     * Привязка интерактивных событий
     */
    bindEvents() {
        // Hover на планетах — подсветка аспектов
        this.svg.querySelectorAll('.planet-group').forEach(group => {
            group.addEventListener('mouseenter', (e) => this.onPlanetHover(e, true));
            group.addEventListener('mouseleave', (e) => this.onPlanetHover(e, false));
            group.addEventListener('click', (e) => this.onPlanetClick(e));
            group.addEventListener('mouseenter', (e) => this.onPlanetTooltipHover(e, true));
            group.addEventListener('mousemove', (e) => this.onPlanetTooltipHover(e, true));
            group.addEventListener('mouseleave', (e) => this.onPlanetTooltipHover(e, false));
        });

        // Hover на аспектах
        this.svg.querySelectorAll('.aspect-line').forEach(line => {
            line.addEventListener('mouseenter', (e) => this.onAspectHover(e, true));
            line.addEventListener('mousemove', (e) => this.onAspectHoverMove(e));
            line.addEventListener('mouseleave', (e) => this.onAspectHover(e, false));
        });

        // Hover на куспидах домов
        this.svg.querySelectorAll('.house-cusp-group').forEach(group => {
            group.addEventListener('mouseenter', (e) => this.onHouseCuspHover(e, true));
            group.addEventListener('mousemove', (e) => this.onHouseCuspHover(e, true));
            group.addEventListener('mouseleave', (e) => this.onHouseCuspHover(e, false));
        });
    }

    onPlanetHover(e, isEnter) {
        const planetName = e.currentTarget.dataset.planet;

        window.AstroGlyphs?.setPlanetSymbolActive?.(e.currentTarget, isEnter);

        const leaderLine = e.currentTarget.querySelector('.planet-leader-line');
        if (leaderLine) {
            leaderLine.style.opacity = isEnter ? '0.88' : '';
            leaderLine.style.strokeWidth = isEnter ? '1.4' : '';
        }

        const anchorPoint = e.currentTarget.querySelector('.planet-anchor-point');
        if (anchorPoint) {
            anchorPoint.style.stroke = isEnter ? 'rgba(184, 147, 90, 0.7)' : '';
            anchorPoint.style.strokeWidth = isEnter ? '2' : '';
        }

        // Подсветка строки в таблице
        const row = document.getElementById(`row-${planetName}`);
        if (row) {
            row.classList.toggle('active-row', isEnter);
        }

        // Подсветка связанных аспектов
        this.svg.querySelectorAll('.aspect-line').forEach(line => {
            const aspect = line.dataset.aspect;
            if (aspect && aspect.includes(planetName)) {
                line.style.opacity = isEnter ? '1' : '';
                line.style.strokeWidth = isEnter ? '3' : '';
            }
        });
    }

    onPlanetClick(e) {
        const planetName = e.currentTarget.dataset.planet;
        const planet = this.chartData.planets.find(p => p.name === planetName);
        if (!planet) return;

        const nameRu = this.getPlanetName(planetName);
        const symbol = Symbols.planets[planetName] || '';
        const signRu = this.getSignName(planet.sign);
        const signSymbol = Symbols.signs[planet.sign] || '';
        const degFormatted = this.formatDMS(planet.degree_in_sign ?? 0);
        const house = planet.house != null ? this.formatHouseLabel(planet.house) : this.t('common.notAvailable');
        this.showTooltip(`
            <strong><span class="astro-symbol">${symbol}</span> ${nameRu}</strong><br>
            <span class="astro-symbol">${signSymbol}</span> ${signRu} ${degFormatted}<br>
            ${this.t('common.house')}: ${house}${planet.retrograde ? ' <span style=\"color:#dc2626\">R</span>' : ''}
        `, e);
    }

    onAspectHover(e, isEnter) {
        const aspectKey = e.currentTarget.dataset.aspectKey || e.currentTarget.dataset.aspect;
        if (!aspectKey) return;

        const p1 = e.currentTarget.dataset.planet1 || '';
        const p2 = e.currentTarget.dataset.planet2 || '';

        // Подсветка планет
        [p1, p2].forEach(pName => {
            const group = this.svg.querySelector(`[data-planet="${pName}"]`);
            if (group) {
                const circle = group.querySelector('.planet-circle');
                if (circle) {
                    circle.style.strokeWidth = isEnter ? '3' : '';
                }
            }
            // Подсветка строк
            const row = document.getElementById(`row-${pName}`);
            if (row) row.classList.toggle('active-row', isEnter);
        });

        // Выделение самой линии
        e.currentTarget.style.opacity = isEnter ? '1' : '';
        e.currentTarget.style.strokeWidth = isEnter ? '3' : '';

        if (isEnter) {
            const aspectData = this.aspectLookupByKey[aspectKey];
            if (aspectData) {
                this.showTooltip(this.getAspectTooltipHtml(aspectData), e);
            }
            this.dispatchAspectHover('chart:aspect-hover', {
                source: 'wheel',
                aspectKey,
                aspect: aspectData || null
            });
            return;
        }

        this.hideTooltip();
        this.dispatchAspectHover('chart:aspect-leave', {
            source: 'wheel',
            aspectKey
        });
    }

    onAspectHoverMove(e) {
        if (!this.tooltipEl || this.tooltipEl.style.display !== 'block') return;
        this.moveTooltip(e);
    }

    onPlanetTooltipHover(e, isEnter) {
        if (!isEnter) {
            this.hideTooltip();
            return;
        }
        const planetName = e.currentTarget.dataset.planet;
        const planet = this.chartData?.planets?.find(p => p.name === planetName);
        if (!planet) return;

        const nameRu = this.getPlanetName(planetName);
        const symbol = Symbols.planets[planetName] || '';
        const signRu = this.getSignName(planet.sign);
        const signSymbol = Symbols.signs[planet.sign] || '';
        const degFormatted = this.formatDMS(planet.degree_in_sign ?? 0);
        const house = planet.house != null ? this.formatHouseLabel(planet.house) : this.t('common.notAvailable');

        this.showTooltip(`
            <strong><span class="astro-symbol">${symbol}</span> ${nameRu}</strong><br>
            <span class="astro-symbol">${signSymbol}</span> ${signRu} ${degFormatted}<br>
            ${this.t('common.house')}: ${house}${planet.retrograde ? ' <span style=\"color:#dc2626\">R</span>' : ''}
        `, e);
    }

    onHouseCuspHover(e, isEnter) {
        const group = e.currentTarget;
        const line = group.querySelector('.house-cusp-line');
        const houseNumber = Number(group.dataset.house || 0);

        if (!isEnter) {
            if (line) {
                line.style.strokeWidth = '';
                line.style.opacity = '';
            }
            const row = document.getElementById(`row-house-${houseNumber}`);
            if (row) row.classList.remove('active-row');
            this.hideTooltip();
            return;
        }

        if (line) {
            line.style.strokeWidth = [1, 4, 7, 10].includes(houseNumber) ? '3.2' : '2.2';
            line.style.opacity = '1';
        }

        const row = document.getElementById(`row-house-${houseNumber}`);
        if (row) row.classList.add('active-row');

        const sign = group.dataset.sign || '';
        const signRu = this.getSignName(sign);
        const signSymbol = Symbols.signs[sign] || '';
        const degreeInSign = Number(group.dataset.degreeInSign || 0);
        const longitude = Number(group.dataset.longitude || 0);
        const degFormatted = this.formatDMS(degreeInSign);
        const lonFormatted = this.formatDMS(longitude);

        this.showTooltip(`
            <strong>${this.t('page.chart.houseCusp', { house: this.formatHouseLabel(houseNumber) })}</strong><br>
            <span class="astro-symbol">${signSymbol}</span> ${signRu} ${degFormatted}<br>
            ${this.t('common.longitude')}: ${lonFormatted}
        `, e);
    }

    ensureTooltip() {
        if (this.tooltipEl && this.tooltipEl.isConnected) return this.tooltipEl;

        const host = this.svg.closest('.chart-center, .solar-wheel-wrapper, .biwheel-svg-wrapper')
            || this.svg.parentElement
            || document.body;
        if (host instanceof HTMLElement && getComputedStyle(host).position === 'static') {
            host.style.position = 'relative';
        }

        this.tooltipEl = host.querySelector('.chart-tooltip');
        if (!this.tooltipEl) {
            this.tooltipEl = document.createElement('div');
            this.tooltipEl.className = 'chart-tooltip';
            host.appendChild(this.tooltipEl);
        }

        return this.tooltipEl;
    }

    showTooltip(html, event) {
        const tooltip = this.ensureTooltip();
        if (!tooltip || !event) return;
        tooltip.innerHTML = html;
        tooltip.style.display = 'block';
        this.moveTooltip(event);
    }

    moveTooltip(event) {
        const tooltip = this.ensureTooltip();
        if (!tooltip || !event) return;

        const host = tooltip.parentElement;
        if (!host) return;

        const rect = host.getBoundingClientRect();
        let x = event.clientX - rect.left + 14;
        let y = event.clientY - rect.top + 6;

        const maxX = rect.width - tooltip.offsetWidth - 8;
        const maxY = rect.height - tooltip.offsetHeight - 8;
        x = Math.max(8, Math.min(x, Math.max(8, maxX)));
        y = Math.max(8, Math.min(y, Math.max(8, maxY)));

        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
    }

    hideTooltip() {
        const tooltip = this.ensureTooltip();
        if (tooltip) tooltip.style.display = 'none';
    }

    formatDMS(deg) {
        const d = Math.floor(deg);
        const mFull = (deg - d) * 60;
        const m = Math.floor(mFull);
        const s = Math.round((mFull - m) * 60);
        return `${d}°${m.toString().padStart(2,'0')}'${s.toString().padStart(2,'0')}"`;
    }
}

window.ChartWheel = ChartWheel;

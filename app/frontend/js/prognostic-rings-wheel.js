import { appendPlanetLeaderAnnotation, getPlanetLeaderLineEndPoint } from './wheel-planet-annotations.js';

(function() {
    'use strict';

    const NS = 'http://www.w3.org/2000/svg';
    const C = 300;
    const SIZE = 600;
    // Outside house labels and angle markers (MC/DSC/ASC/IC, degree numbers) are
    // drawn beyond OUTER_R, so the viewBox is padded to keep them from clipping.
    const VIEW_PADDING = 52;
    const OUTER_R = 285;
    const DEGREE_RING = 10;
    const SIGN_RING = 26;
    const FIRST_RING_INNER_R = 124;
    const RING_GAP = 0;
    const ZODIAC_INNER_R = OUTER_R - DEGREE_RING - SIGN_RING;
    const WHEEL_BG = '#fafafa';
    const WHEEL_BORDER = '#d1d5db';
    const WHEEL_TICK = '#9ca3af';
    const HOUSE_LABELS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    const ASPECT_SYMBOLS = {
        Conjunction: '☌',
        Opposition: '☍',
        Trine: '△',
        Square: '□',
        Sextile: '⚹',
        Quincunx: '⚻',
        Semisextile: '⚺',
        Quintile: 'Q',
        Biquintile: 'bQ',
        Semisquare: '∠',
        Sesquiquadrate: '⚼',
    };
    const MAJOR_ASPECTS = new Set(['Conjunction', 'Opposition', 'Trine', 'Square', 'Sextile']);
    const DEFAULT_ASPECT_COLORS = {
        Conjunction: '#b45309',
        Opposition: '#dc2626',
        Square: '#ea580c',
        Trine: '#2563eb',
        Sextile: '#16a34a',
        Quincunx: '#7c3aed',
        Semisextile: '#0d9488',
        Quintile: '#db2777',
        Biquintile: '#db2777',
        Semisquare: '#f97316',
        Sesquiquadrate: '#f97316',
    };
    // Multi-instance: два кольца одного метода (напр. два транзита) различаются
    // оттенком базового цвета метода. instanceIndex 0 = базовый цвет; каждый
    // следующий инстанс осветляется к белому фиксированным шагом.
    function tintLayerColor(hex, instanceIndex) {
        const idx = Number(instanceIndex) || 0;
        if (idx <= 0) return hex;
        const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
        if (!m) return hex;
        const num = parseInt(m[1], 16);
        const factor = Math.min(0.6, idx * 0.22); // доля смешивания с белым
        const mix = (c) => Math.round(c + (255 - c) * factor);
        const r = mix((num >> 16) & 0xff);
        const g = mix((num >> 8) & 0xff);
        const b = mix(num & 0xff);
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }

    const HOUSE_LAYER_THEMES = {
        natal: { color: '#111111', radialOffset: 4, tangentOffset: 8 },
        transit: { color: '#1e3a5f', radialOffset: 10, tangentOffset: 8 },
        progression: { color: '#7c3aed', radialOffset: 16, tangentOffset: 8 },
        direction: { color: '#0f766e', radialOffset: 22, tangentOffset: 8 },
        solar_return: { color: '#b45309', radialOffset: 22, tangentOffset: 8 },
        synastry_partner: { color: '#1e3a5f', radialOffset: 22, tangentOffset: 8 },
    };

    class PrognosticRingsWheel {
        constructor(svgElement) {
            this.svg = svgElement;
            this.orientation = 'aries';
            this.natalMatrixRows = {};
            this.prognosticMatrixRows = {};
            this.matrixRows = {};
            this.aspectScope = 'all';
            this.enabledAspectTypes = [];
            this.visualPreferences = window.AstroPreferences?.getAccountVisualPreferences?.() || null;
            this.planetScale = 1;
            this.pointScale = 1;
            this.houseNumberStyle = 'arabic';
            this.houseLabelsOutside = false;
            this.angleAscDscBold = true;
            this.angleMcIcBold = true;
            this.outsideHouseLabelMethod = 'natal';
            this.showPlanetStationary = false;
            this.showPlanetDegree = false;
            this.showAspectText = false;
            this.showDeclinationAspects = false;
            this.declinationAspects = [];
            this.minimumRingCount = 1;
            this.alignSingleRingOuter = false;
            // W1 (Фаза W): маркеры углов ASC/MC/DSC/IC за кругом (паритет с ChartWheel).
            // Opt-in, чтобы не менять вид существующих страниц до их явного включения.
            this.showAngleMarkers = false;
            // W4 (Фаза W): engine-level видимость колец. null = все кольца.
            // ['natal'] на мульти-viewModel = в точности вид одной карты (D6).
            this.visibleMethods = null;
            this.natalGlyphBaseSize = 18;
            this.planetLeaderColor = '#6b7280';
            this.houseVisualOptions = {
                outsideColor: null,
                outsideLineColor: null,
                outsideExtension: 14,
                outsideRadialOffset: 20,
                outsideTangentOffset: 12,
            };
            this.cuspVisibility = {
                transit: true,
                progression: true,
                direction: true,
                synastry_partner: true,
            };
            this.aspectLookupByKey = {};
            this.conjunctionDisplay = {
                dotOrbThreshold: 2,
                dotRadius: 3.6,
                collapseThreshold: 9,
                minLineLength: 14,
            };
            this.suppressPlanetClickUntil = 0;
            this.aspectNameAliases = {
                TrueNorthNode: 'TrueNode',
                TrueSouthNode: 'SouthNode',
                Fortune: 'PartOfFortune',
            };
            this.aspectSortRank = [
                'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
                'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
                'Chiron', 'Proserpina',
                'TrueNode', 'SouthNode',
                'BlackMoon', 'WhiteMoon', 'PartOfFortune',
                'ASC', 'MC', 'IC', 'DSC', 'Vertex', 'AntiVertex',
            ].reduce((acc, name, idx) => {
                acc[name] = idx;
                return acc;
            }, {});
        }

        setOptions(options = {}) {
            if (options.orientation) this.orientation = options.orientation === 'asc' ? 'asc' : 'aries';
            if (options.natalMatrixRows) this.natalMatrixRows = options.natalMatrixRows;
            if (options.prognosticMatrixRows) this.prognosticMatrixRows = options.prognosticMatrixRows;
            if (options.matrixRows) this.matrixRows = options.matrixRows;
            if (typeof options.planetScale !== 'undefined') this.planetScale = this.clampPointScale(options.planetScale);
            if (typeof options.pointScale !== 'undefined') this.pointScale = this.clampPointScale(options.pointScale);
            if (options.aspectScope) this.aspectScope = ['all', 'major', 'minor'].includes(options.aspectScope) ? options.aspectScope : 'all';
            if (Array.isArray(options.enabledAspectTypes)) this.enabledAspectTypes = options.enabledAspectTypes;
            if (Object.prototype.hasOwnProperty.call(options, 'houseNumberStyle')) {
                this.houseNumberStyle = options.houseNumberStyle === 'roman' ? 'roman' : 'arabic';
            }
            if (Object.prototype.hasOwnProperty.call(options, 'houseLabelsOutside')) {
                this.houseLabelsOutside = options.houseLabelsOutside === true;
            }
            if (Object.prototype.hasOwnProperty.call(options, 'showTransitCusps')) {
                this.cuspVisibility.transit = options.showTransitCusps !== false;
            }
            if (Object.prototype.hasOwnProperty.call(options, 'showProgressionCusps')) {
                this.cuspVisibility.progression = options.showProgressionCusps !== false;
            }
            if (Object.prototype.hasOwnProperty.call(options, 'showDirectionCusps')) {
                this.cuspVisibility.direction = options.showDirectionCusps !== false;
            }
            if (Object.prototype.hasOwnProperty.call(options, 'outsideHouseLabelMethod')) {
                this.outsideHouseLabelMethod = String(options.outsideHouseLabelMethod || 'natal');
            }
            if (Object.prototype.hasOwnProperty.call(options, 'showPlanetStationary')) {
                this.showPlanetStationary = options.showPlanetStationary === true;
            }
            if (Object.prototype.hasOwnProperty.call(options, 'showPlanetDegree')) {
                this.showPlanetDegree = options.showPlanetDegree === true;
            }
            if (Object.prototype.hasOwnProperty.call(options, 'showAspectText')) {
                this.showAspectText = options.showAspectText === true;
            }
            if (Object.prototype.hasOwnProperty.call(options, 'showDeclinationAspects')) {
                this.showDeclinationAspects = options.showDeclinationAspects === true;
            }
            if (Object.prototype.hasOwnProperty.call(options, 'declinationAspects')) {
                this.declinationAspects = Array.isArray(options.declinationAspects)
                    ? options.declinationAspects.slice()
                    : [];
            }
            if (Object.prototype.hasOwnProperty.call(options, 'minimumRingCount')) {
                this.minimumRingCount = Math.max(1, Number(options.minimumRingCount) || 1);
            }
            if (Object.prototype.hasOwnProperty.call(options, 'alignSingleRingOuter')) {
                this.alignSingleRingOuter = options.alignSingleRingOuter === true;
            }
            if (Object.prototype.hasOwnProperty.call(options, 'angleAscDscBold')) {
                this.angleAscDscBold = options.angleAscDscBold !== false;
            }
            if (Object.prototype.hasOwnProperty.call(options, 'angleMcIcBold')) {
                this.angleMcIcBold = options.angleMcIcBold !== false;
            }
            if (Object.prototype.hasOwnProperty.call(options, 'showAngleMarkers')) {
                this.showAngleMarkers = options.showAngleMarkers === true;
            }
            if (Object.prototype.hasOwnProperty.call(options, 'visibleMethods')) {
                this.visibleMethods = Array.isArray(options.visibleMethods) && options.visibleMethods.length
                    ? options.visibleMethods.slice()
                    : null;
            }
            if (options.visualPreferences) this.visualPreferences = options.visualPreferences;
        }

        /**
         * W4: показать только указанные кольца (по `method`). null/[] = все.
         * Одно видимое кольцо раскладывается как одиночная карта — «показать одно
         * колесо» из любого мульти-вида даёт ровно вид одной карты (D6).
         */
        setVisibleMethods(methods) {
            this.visibleMethods = Array.isArray(methods) && methods.length ? methods.slice() : null;
            if (this.viewModel) this.render(this.viewModel);
        }

        applyMatrixRows(matrixRows = {}, options = {}) {
            this.matrixRows = matrixRows || {};
            this.prognosticMatrixRows = options.prognosticMatrixRows || this.matrixRows;
            if (options.natalMatrixRows) {
                this.natalMatrixRows = options.natalMatrixRows;
            }
            this.applyMatrixVisibilityToDom();
        }

        isAspectElementVisibleByMatrix(element) {
            const first = element?.getAttribute?.('data-planet-1') || element?.dataset?.planet1;
            const second = element?.getAttribute?.('data-planet-2') || element?.dataset?.planet2;
            if (!first || !second) return true;
            const firstMethod = element?.getAttribute?.('data-method-1') || element?.dataset?.method1 || element?.dataset?.method || 'prognostic';
            const secondMethod = element?.getAttribute?.('data-method-2') || element?.dataset?.method2 || element?.dataset?.method || 'natal';
            return this.isBodyDisplayed(first, firstMethod)
                && this.isBodyDisplayed(second, secondMethod)
                && this.isBodyAspecting(first, firstMethod)
                && this.isBodyAspecting(second, secondMethod);
        }

        applyMatrixVisibilityToDom() {
            if (!this.svg) return;

            this.svg.querySelectorAll('.prognostic-body[data-planet]').forEach((group) => {
                const visible = this.isBodyDisplayed(group.dataset.planet, group.dataset.method);
                group.classList.toggle('matrix-hidden', !visible);
                group.setAttribute('aria-hidden', visible ? 'false' : 'true');
            });

            this.svg.querySelectorAll('.aspect-line[data-planet-1][data-planet-2], .aspect-symbol-group[data-planet-1][data-planet-2]').forEach((node) => {
                const visible = this.isAspectElementVisibleByMatrix(node);
                node.classList.toggle('matrix-hidden', !visible);
                node.setAttribute('aria-hidden', visible ? 'false' : 'true');
            });
        }

        render(viewModel) {
            this.viewModel = viewModel;
            this.aspectLookupByKey = {};
            this.svg.setAttribute('viewBox', `${-VIEW_PADDING} ${-VIEW_PADDING} ${SIZE + VIEW_PADDING * 2} ${SIZE + VIEW_PADDING * 2}`);
            const fragment = document.createDocumentFragment();
            this.layers = {
                background: this.el('g', { id: 'prognostic-bg' }),
                zodiac: this.el('g', { id: 'prognostic-zodiac' }),
                houses: this.el('g', { id: 'prognostic-houses' }),
                aspects: this.el('g', { id: 'prognostic-aspects' }),
                bodies: this.el('g', { id: 'prognostic-bodies' }),
                labels: this.el('g', { id: 'prognostic-labels' }),
                angles: this.el('g', { id: 'prognostic-angles' }),
            };
            Object.values(this.layers).forEach((layer) => fragment.appendChild(layer));

            this.drawBackground();
            this.drawZodiac();
            const rings = this.buildRings(viewModel);
            this.rings = rings;
            this.bodyColorByName = this.buildBodyColorMap(rings);
            rings.forEach((ring) => this.drawRingScaffold(ring));
            rings.forEach((ring) => this.drawHouses(ring));
            this.drawRingBoundaries(rings);
            this.drawAspects(rings);
            if (this.showDeclinationAspects) this.drawDeclinationAspects(rings);
            rings.forEach((ring) => this.drawBodies(ring));
            this.drawAngleMarkers(rings);
            this.svg.replaceChildren(fragment);
            this.bindEvents();
            this.applyMatrixVisibilityToDom();
        }

        buildRings(viewModel) {
            let allLayers = [
                viewModel?.natalLayer,
                ...(viewModel?.activePrognosticLayers || []),
            ].filter(Boolean);
            // W4: фильтр видимых колец. Если фильтр опустошает набор — игнорируем его
            // (защита от рассинхрона UI), показываем все.
            let visibleFilterApplied = false;
            if (this.visibleMethods) {
                const filtered = allLayers.filter((layer) => this.visibleMethods.includes(layer?.method));
                if (filtered.length) {
                    visibleFilterApplied = filtered.length < allLayers.length;
                    allLayers = filtered;
                }
            }
            let count = visibleFilterApplied
                ? allLayers.length
                : Math.max(1, allLayers.length, this.minimumRingCount || 1);
            // D6 (требование астролога): одиночное колесо имеет ту же толщину, что
            // кольцо двухкольцевой раскладки, и прижато к зодиаку — большое поле
            // аспектов в центре, как у классической одиночной карты. Поэтому одно
            // кольцо ВСЕГДА раскладывается как внешний слот ≥2-слотовой сетки.
            if (allLayers.length === 1) count = Math.max(2, count);
            const available = ZODIAC_INNER_R - FIRST_RING_INNER_R - RING_GAP * (count - 1);
            const width = Math.max(28, available / count);
            // Порядковый номер инстанса среди колец того же метода (0-based) — для оттенка.
            const methodSeen = {};
            return allLayers.map((layer, index) => {
                const visualIndex = allLayers.length === 1 ? count - 1 : index;
                const inner = FIRST_RING_INNER_R + visualIndex * (width + RING_GAP);
                const outer = inner + width;
                const method = layer?.method;
                const instanceIndex = methodSeen[method] || 0;
                methodSeen[method] = instanceIndex + 1;
                const baseColor = layer?.style?.color || '#111111';
                return {
                    ...layer,
                    inner,
                    outer,
                    center: inner + width / 2,
                    index,
                    instanceIndex,
                    color: method === 'natal' ? baseColor : tintLayerColor(baseColor, instanceIndex),
                };
            });
        }

        drawBackground() {
            this.layers.background.appendChild(this.el('circle', {
                cx: C,
                cy: C,
                r: OUTER_R,
                fill: WHEEL_BG,
                stroke: WHEEL_BORDER,
                'stroke-width': 1,
            }));
        }

        drawZodiac() {
            const signOuter = OUTER_R - DEGREE_RING;
            const signInner = ZODIAC_INNER_R;
            this.layers.zodiac.appendChild(this.el('circle', {
                cx: C, cy: C, r: signOuter, fill: 'none', stroke: WHEEL_BORDER, 'stroke-width': 1,
            }));
            this.layers.zodiac.appendChild(this.el('circle', {
                cx: C, cy: C, r: signInner, fill: 'white', stroke: WHEEL_BORDER, 'stroke-width': 1,
            }));

            for (let i = 0; i < 12; i += 1) {
                const sign = this.signByIndex(i);
                const element = Symbols?.signElements?.[sign];
                const color = window.AstroPreferences?.getElementColor
                    ? window.AstroPreferences.getElementColor(element, this.visualPreferences)
                    : ({ Fire: '#ef4444', Earth: '#84cc16', Air: '#f59e0b', Water: '#3b82f6' }[element] || '#94a3b8');
                const start = this.longToAngle(i * 30);
                const end = this.longToAngle((i + 1) * 30);
                this.drawArc(signOuter, signInner, end, start, `${color}18`, this.layers.zodiac);

                const boundary = this.polar(OUTER_R, end);
                const inner = this.polar(signInner, end);
                this.layers.zodiac.appendChild(this.el('line', {
                    x1: boundary.x, y1: boundary.y, x2: inner.x, y2: inner.y,
                    stroke: WHEEL_TICK,
                    'stroke-width': 1.5,
                }));

                const mid = this.longToAngle(i * 30 + 15);
                const pos = this.polar((signOuter + signInner) / 2, mid);
                this.layers.zodiac.appendChild(this.el('text', {
                    x: pos.x,
                    y: pos.y + 5,
                    'text-anchor': 'middle',
                    'font-size': 13,
                    'font-weight': '500',
                    fill: color,
                    class: 'sign-symbol-text',
                }, Symbols?.signs?.[sign] || sign[0]));
            }

            for (let signIndex = 0; signIndex < 12; signIndex += 1) {
                const signStartLong = signIndex * 30;
                for (let deg = 0; deg < 30; deg += 5) {
                    const angle = this.longToAngle(signStartLong + deg);
                    const tickOuter = OUTER_R;
                    const tickInner = deg % 10 === 0 ? signOuter + 2 : signOuter + 5;
                    const p1 = this.polar(tickInner, angle);
                    const p2 = this.polar(tickOuter, angle);
                    this.layers.zodiac.appendChild(this.el('line', {
                        x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
                        stroke: WHEEL_TICK,
                        'stroke-width': deg % 10 === 0 ? 1 : 0.5,
                    }));
                }
            }
        }

        drawRingScaffold(ring) {
            const fill = ring.method === 'natal' ? '#11111108' : `${ring.color}0f`;
            this.drawAnnulus(ring.outer, ring.inner, fill, this.layers.houses);
        }

        drawRingBoundaries(rings) {
            rings.forEach((ring, index) => {
                if (index === 0) {
                    this.layers.houses.appendChild(this.el('circle', {
                        cx: C,
                        cy: C,
                        r: ring.inner,
                        fill: 'none',
                        stroke: WHEEL_BORDER,
                        'stroke-width': 1,
                        opacity: 0.9,
                    }));
                }

                const isNatalOuterBoundary = ring.method === 'natal';
                this.layers.houses.appendChild(this.el('circle', {
                    cx: C,
                    cy: C,
                    r: ring.outer,
                    fill: 'none',
                    stroke: isNatalOuterBoundary ? WHEEL_BORDER : ring.color,
                    'stroke-width': isNatalOuterBoundary ? 1 : 1.15,
                    opacity: isNatalOuterBoundary ? 0.96 : 0.82,
                }));
            });
            const lastRing = rings[rings.length - 1];
            if (!lastRing) return;
            this.layers.houses.appendChild(this.el('circle', {
                cx: C,
                cy: C,
                r: ZODIAC_INNER_R,
                fill: 'none',
                stroke: WHEEL_BORDER,
                'stroke-width': 1,
            }));
        }

        drawHouses(ring) {
            const ringShowCusps = ring.method === 'natal'
                ? true
                : (ring.showCusps ?? this.cuspVisibility[ring.method] ?? true);
            if (ring.method !== 'natal' && ringShowCusps === false) return;
            const houses = Array.isArray(ring.houses) && ring.houses.length ? ring.houses : [];
            const useOutsideLabels = this.houseLabelsOutside === true;
            const outsideExtension = Number(this.houseVisualOptions.outsideExtension) || 14;
            const outsideSegmentStartR = OUTER_R + 1;
            const outsideSegmentEndR = OUTER_R + outsideExtension;
            const cuspOuterRadius = ring.method === 'natal'
                ? this.getNatalCuspOuterRadius()
                : ring.outer;
            houses.forEach((house, index) => {
                const longitude = Number(house.longitude);
                if (!Number.isFinite(longitude)) return;
                const angle = this.longToAngle(longitude);
                const pOuter = this.polar(cuspOuterRadius, angle);
                const pInner = this.polar(ring.inner, angle);
                const houseNumber = Number(house.number);
                const isAngular = [1, 4, 7, 10].includes(houseNumber);
                const innerStroke = ring.method === 'natal' ? this.getHouseLineColor(isAngular) : ring.color;
                const innerStrokeWidth = this.getHouseCuspStrokeWidth(houseNumber, ring.method === 'natal' ? 1 : 0.7);
                const innerOpacity = ring.method === 'natal'
                    ? 1
                    : 0.48;
                const group = this.el('g', {
                    class: 'house-cusp-group',
                    'data-house': String(house.number || ''),
                    'data-sign': String(house.sign || ''),
                    'data-degree-in-sign': String(Number(house.degree_in_sign) || 0),
                    'data-longitude': String(longitude),
                    'data-method': ring.method,
                });
                group.appendChild(this.el('line', {
                    x1: pInner.x, y1: pInner.y, x2: pOuter.x, y2: pOuter.y,
                    stroke: 'transparent',
                    'stroke-width': 10,
                    class: 'house-cusp-hit',
                }));
                group.appendChild(this.el('line', {
                    x1: pInner.x, y1: pInner.y, x2: pOuter.x, y2: pOuter.y,
                    stroke: innerStroke,
                    'stroke-width': innerStrokeWidth,
                    opacity: innerOpacity,
                    class: 'house-cusp-line',
                }));

                if (useOutsideLabels) {
                    const outsideStart = this.polar(outsideSegmentStartR, angle);
                    const outsideEnd = this.polar(outsideSegmentEndR, angle);
                    group.appendChild(this.el('line', {
                        x1: outsideStart.x, y1: outsideStart.y, x2: outsideEnd.x, y2: outsideEnd.y,
                        stroke: 'transparent',
                        'stroke-width': 10,
                        class: 'house-cusp-hit',
                    }));
                    group.appendChild(this.el('line', {
                        x1: outsideStart.x, y1: outsideStart.y, x2: outsideEnd.x, y2: outsideEnd.y,
                        stroke: innerStroke,
                        'stroke-width': innerStrokeWidth,
                        opacity: innerOpacity,
                        class: 'house-cusp-line',
                    }));
                }

                const next = houses[(index + 1) % houses.length];
                const nextLong = Number(next?.longitude);
                const midLong = Number.isFinite(nextLong)
                    ? this.midLongitude(longitude, nextLong)
                    : longitude + 15;
                if (useOutsideLabels) {
                    const outsideLabel = this.getOutsideHouseLabelGeometry(angle, ring.method);
                    this.layers.labels.appendChild(this.el('text', {
                        x: outsideLabel.x,
                        y: outsideLabel.y,
                        'text-anchor': outsideLabel.anchor,
                        'dominant-baseline': 'middle',
                        'font-size': ring.method === 'natal' ? 9.5 : 8.5,
                        'font-weight': '500',
                        fill: ring.method === 'natal' ? this.getHouseLabelColor(isAngular) : ring.color,
                        stroke: '#fafafa',
                        'stroke-width': '2.4',
                        'stroke-linejoin': 'round',
                        'paint-order': 'stroke',
                    }, this.getDisplayedHouseLabel(house.number)));
                } else {
                    const labelRadius = ring.inner + 9;
                    const labelPos = this.polar(labelRadius, this.longToAngle(midLong));
                    this.layers.labels.appendChild(this.el('text', {
                        x: labelPos.x,
                        y: labelPos.y + 3,
                        'text-anchor': 'middle',
                        'font-size': ring.method === 'natal' ? 10 : 8,
                        'font-weight': ring.method === 'natal' ? '400' : '700',
                        fill: ring.method === 'natal' ? this.getHouseLabelColor(isAngular) : ring.color,
                        opacity: ring.method === 'natal' ? 0.9 : 0.78,
                    }, this.getDisplayedHouseLabel(house.number)));
                }
                this.layers.houses.appendChild(group);
            });
        }

        getHouseCuspStrokeWidth(houseNumber, normalWidth = 1) {
            const number = Number(houseNumber);
            if (number === 1 || number === 7) {
                return this.angleAscDscBold !== false ? Math.max(2.2, normalWidth) : normalWidth;
            }
            if (number === 4 || number === 10) {
                return this.angleMcIcBold !== false ? Math.max(2.2, normalWidth) : normalWidth;
            }
            return normalWidth;
        }

        getNatalCuspOuterRadius() {
            const rings = Array.isArray(this.rings) ? this.rings : [];
            const hiddenOuterRadii = rings
                .filter((ring) => ring?.method !== 'natal' && (ring?.showCusps ?? this.cuspVisibility[ring.method] ?? true) === false)
                .map((ring) => Number(ring.outer))
                .filter((radius) => Number.isFinite(radius));
            if (!hiddenOuterRadii.length) {
                const natalRing = rings.find((ring) => ring?.method === 'natal');
                return Number.isFinite(natalRing?.outer) ? natalRing.outer : FIRST_RING_INNER_R;
            }
            return Math.max(...hiddenOuterRadii);
        }

        drawBodies(ring) {
            const bodies = (ring.bodies || []).filter((body) => this.isBodyDisplayed(body?.name, ring.method));
            const placed = this.resolveBodyLayout(bodies, ring.center, Math.min(ring.center + 8, ring.outer - 7));
            placed.forEach((item) => {
                const body = item.body;
                const anchorRadius = this.getBodyAnchorRadius(ring);
                const anchor = this.polar(anchorRadius, item.rawAngle);
                const pos = this.polar(item.radius, item.angle);
                const group = this.el('g', {
                    class: `planet-group prognostic-body prognostic-body--${ring.method}`,
                    'data-body': body.name,
                    'data-planet': body.name,
                    'data-method': ring.method,
                });
                const color = this.getBodyColor(body, '#374151');
                const hasSvg = window.AstroGlyphs?.hasPlanetIcon?.(body.name) === true;
                const scale = this.isPointBody(body.name) ? this.pointScale : this.planetScale;
                const glyphScale = hasSvg ? 1 : (Symbols?.planetGlyphScale?.[body.name] || 1);
                const glyphSize = this.natalGlyphBaseSize * glyphScale * scale;
                const iconBoxScale = hasSvg ? (window.AstroGlyphs?.getPlanetIconScale?.(body.name) || 1.18) : 1;
                const iconSize = hasSvg ? this.natalGlyphBaseSize * scale * iconBoxScale : glyphSize;
                appendPlanetLeaderAnnotation(group, {
                    createSvgElement: this.el.bind(this),
                    anchorPoint: anchor,
                    iconPoint: pos,
                    iconBoxSize: iconSize,
                    scale,
                    leaderColor: this.planetLeaderColor,
                    leaderOpacity: item.hasLeader ? 0.52 : 0.4,
                    anchorMaskFill: WHEEL_BG,
                });
                group.appendChild(this.el('circle', {
                    cx: pos.x,
                    cy: pos.y,
                    r: 10 * scale,
                    fill: 'transparent',
                    class: 'planet-circle',
                }));
                if (hasSvg) {
                    group.appendChild(window.AstroGlyphs.createPlanetSymbolSvg(body.name, {
                        size: iconSize,
                        x: pos.x - iconSize / 2,
                        y: pos.y - iconSize / 2,
                        color,
                        title: this.bodyName(body.name),
                        pointerEvents: 'none',
                    }));
                } else {
                    group.appendChild(this.el('text', {
                        x: pos.x,
                        y: pos.y + glyphSize * 0.33,
                        'text-anchor': 'middle',
                        'font-size': glyphSize.toFixed(2),
                        'font-weight': '600',
                        fill: color,
                        class: 'planet-symbol-text',
                    }, Symbols?.getPlanetSymbol?.(body.name) || body.name?.[0] || '?'));
                }
                const annotationScale = Math.min(1.25, scale);
                const motionFontSize = (6.12 * annotationScale).toFixed(2);
                const motionX = pos.x + iconSize * 0.28 - 2;
                const motionY = pos.y + iconSize * 0.42 - 2;
                if (body.retrograde) {
                    group.appendChild(this.el('text', {
                        x: motionX,
                        y: motionY,
                        'font-size': motionFontSize,
                        'font-weight': '700',
                        fill: color,
                    }, 'R'));
                }
                if (this.showPlanetStationary && body.is_stationary) {
                    group.appendChild(this.el('text', {
                        x: motionX + (body.retrograde ? iconSize * 0.25 : 0),
                        y: motionY,
                        'font-size': motionFontSize,
                        'font-weight': '700',
                        fill: color,
                    }, 'S'));
                }
                if (this.showPlanetDegree) {
                    const degreeLabel = `${Math.floor(Number(body.degree_in_sign) || 0)}°`;
                    group.appendChild(this.el('text', {
                        x: pos.x + iconSize * 0.26,
                        y: pos.y - iconSize * 0.31,
                        'text-anchor': 'start',
                        'font-size': (4.9 * annotationScale).toFixed(2),
                        'font-family': 'monospace',
                        'font-weight': '600',
                        fill: color,
                    }, degreeLabel));
                }
                this.layers.bodies.appendChild(group);
            });
        }

        getBodyAnchorRadius(ring) {
            return ring.inner;
        }

        getAspectBodies(ring) {
            return Array.isArray(ring?.aspectBodies) && ring.aspectBodies.length
                ? ring.aspectBodies
                : (ring?.bodies || []);
        }

        drawAspects(rings) {
            const natalRing = rings.find((ring) => ring.method === 'natal');
            if (!natalRing || rings.length === 1) {
                rings.forEach((ring) => this.drawInternalAspectsForRing(ring));
                return;
            }
            const aspectRadius = this.getAspectBoundaryRadius(natalRing);
            this.aspectRadius = aspectRadius;
            const natalMap = new Map(this.getAspectBodies(natalRing)
                .filter((body) => body?.name && this.isBodyAvailableForAspects(body.name, 'natal'))
                .map((body) => [this.normalizeBodyName(body.name), body]));
            rings.filter((ring) => ring.method !== 'natal').forEach((ring) => {
                const bodyMap = new Map(this.getAspectBodies(ring)
                    .filter((body) => body?.name && this.isBodyAvailableForAspects(body.name, ring.method))
                    .map((body) => [this.normalizeBodyName(body.name), body]));
                const aspects = (ring.aspects || []).filter((aspect) => this.isAspectEnabled(aspect));
                const sorted = [...aspects].sort((a, b) => Number(b.orb) - Number(a.orb));
                sorted.forEach((aspect) => {
                    const movingName = this.normalizeBodyName(aspect.planet_1 || aspect.left_planet);
                    const natalName = this.normalizeBodyName(aspect.planet_2 || aspect.natal_object || aspect.right_planet);
                    if (!this.isBodyAvailableForAspects(movingName, ring.method) || !this.isBodyAvailableForAspects(natalName, 'natal')) return;
                    const moving = bodyMap.get(movingName);
                    const natal = natalMap.get(natalName);
                    if (!moving || !natal) return;
                    const angle1 = this.longToAngle(moving.longitude) * Math.PI / 180;
                    const angle2 = this.longToAngle(natal.longitude) * Math.PI / 180;
                    const isSynastryComparison = ring.method === 'synastry_partner';
                    const p1 = this.polar(aspectRadius, angle1 * 180 / Math.PI);
                    const p2 = this.polar(aspectRadius, angle2 * 180 / Math.PI);
                    const geometry = this.resolveAspectLineGeometry({
                        x1: p1.x,
                        y1: p1.y,
                        x2: p2.x,
                        y2: p2.y,
                        angle1,
                        angle2,
                        aspectType: aspect.aspect_type,
                        orb: aspect.orb,
                    });
                    const aspectKey = this.buildAspectKey(movingName, natalName);
                    this.aspectLookupByKey[aspectKey] = {
                        ...aspect,
                        planet_1: movingName,
                        planet_2: natalName,
                        left_planet: this.normalizeAspectBodyName(aspect.left_planet || movingName),
                        right_planet: this.normalizeAspectBodyName(aspect.right_planet || natalName),
                    };
                    const isMajor = MAJOR_ASPECTS.has(aspect.aspect_type);
                    const color = this.getAspectColor(aspect.aspect_type, aspect.harmonic_type);
                    const baseThickness = Math.max(0.3, 1.5 - ((Number(aspect.orb) || 0) / 12) * 1.2);
                    const thickness = aspect.aspect_type === 'Conjunction'
                        ? baseThickness * 2
                        : baseThickness;
                    const aspectAttrs = {
                        'data-aspect': aspectKey,
                        'data-aspect-key': aspectKey,
                        'data-planet-1': movingName,
                        'data-planet-2': natalName,
                        'data-method-1': ring.method,
                        'data-method-2': 'natal',
                        'data-aspect-scope': isSynastryComparison ? 'inter' : 'prognostic',
                        'data-type': aspect.aspect_type,
                        'data-major': isMajor ? 'true' : 'false',
                        'data-conjunction-collapsed': geometry.collapsed ? 'true' : 'false',
                    };

                    const aspectElement = geometry.drawDot
                        ? this.el('circle', {
                            cx: geometry.midX,
                            cy: geometry.midY,
                            r: this.conjunctionDisplay.dotRadius,
                            fill: color,
                            stroke: color,
                            'stroke-width': aspect.aspect_type === 'Conjunction' ? 2.4 : 1.2,
                            opacity: isMajor ? 0.82 : 0.55,
                            class: 'aspect-line aspect-dot',
                            ...aspectAttrs,
                        })
                        : this.el('line', {
                            x1: geometry.x1, y1: geometry.y1, x2: geometry.x2, y2: geometry.y2,
                            stroke: color,
                            'stroke-width': thickness,
                            'stroke-dasharray': isMajor ? 'none' : '3,2',
                            'stroke-linecap': aspect.aspect_type === 'Conjunction' ? 'round' : 'butt',
                            opacity: isMajor ? 0.7 : 0.45,
                            class: 'aspect-line',
                            ...aspectAttrs,
                        });
                    this.layers.aspects.appendChild(aspectElement);

                    const shouldDrawAspectGlyph = isMajor
                        && Number(aspect.orb) < 5
                        && !geometry.drawDot
                        && (aspect.aspect_type !== 'Conjunction' || geometry.collapsed);
                    if (shouldDrawAspectGlyph) {
                        const glyph = ASPECT_SYMBOLS[aspect.aspect_type];
                        if (!glyph) return;
                        const symbolGroup = this.el('g', {
                            class: 'aspect-symbol-group',
                            style: 'pointer-events: none;',
                            ...aspectAttrs,
                        });
                        const symbolText = this.el('text', {
                            x: geometry.midX,
                            y: geometry.midY + 2.5,
                            'text-anchor': 'middle',
                            'font-size': 8,
                            fill: color,
                            class: 'aspect-symbol-text',
                            style: 'pointer-events: none;',
                        }, glyph);
                        symbolGroup.appendChild(symbolText);
                        this.layers.aspects.appendChild(symbolGroup);

                        try {
                            const bbox = symbolText.getBBox();
                            const backdropRadius = Math.max(bbox.width, bbox.height) / 2 + 1.5;
                            const backdrop = this.el('circle', {
                                cx: bbox.x + bbox.width / 2,
                                cy: bbox.y + bbox.height / 2,
                                r: backdropRadius,
                                fill: WHEEL_BG,
                                opacity: 0.96,
                                class: 'aspect-symbol-backdrop',
                            });
                            symbolGroup.insertBefore(backdrop, symbolText);
                        } catch (error) {
                            // Ignore bbox issues and keep the text visible even without backdrop.
                        }
                    }
                });
            });
        }

        /**
         * Declinational aspects (parallels / contra-parallels). Opt-in overlay
         * drawn as dotted lines so they read as a distinct kind from the
         * longitudinal aspects. Within-chart only → uses the natal ring.
         */
        drawDeclinationAspects(rings) {
            const list = Array.isArray(this.declinationAspects) ? this.declinationAspects : [];
            if (!list.length) return;
            const ring = rings.find((r) => r.method === 'natal') || rings[0];
            if (!ring) return;
            const aspectRadius = this.aspectRadius || this.getAspectBoundaryRadius(ring);
            const bodyMap = new Map(this.getAspectBodies(ring)
                .filter((body) => body?.name && this.isBodyAvailableForAspects(body.name, ring.method))
                .map((body) => [this.normalizeBodyName(body.name), body]));
            list.forEach((aspect) => {
                const n1 = this.normalizeBodyName(aspect.planet_1);
                const n2 = this.normalizeBodyName(aspect.planet_2);
                const b1 = bodyMap.get(n1);
                const b2 = bodyMap.get(n2);
                if (!b1 || !b2) return;
                const p1 = this.polar(aspectRadius, this.longToAngle(b1.longitude));
                const p2 = this.polar(aspectRadius, this.longToAngle(b2.longitude));
                const isContra = aspect.type === 'contra_parallel';
                const color = isContra ? '#b06a1f' : '#2b7a4b'; // contra=amber, parallel=green
                const lineEl = this.el('line', {
                    x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
                    stroke: color,
                    'stroke-width': 1,
                    'stroke-dasharray': '1,3',
                    'stroke-linecap': 'round',
                    opacity: 0.7,
                    class: 'declination-aspect-line',
                    'data-decl-type': aspect.type,
                    'data-planet-1': n1,
                    'data-planet-2': n2,
                });
                this.layers.aspects.appendChild(lineEl);
            });
        }

        drawInternalAspectsForRing(ring) {
            if (!ring) return;
            const aspectRadius = this.getAspectBoundaryRadius(ring);
            this.aspectRadius = aspectRadius;
            const bodyMap = new Map(this.getAspectBodies(ring)
                .filter((body) => body?.name && this.isBodyAvailableForAspects(body.name, ring.method))
                .map((body) => [this.normalizeBodyName(body.name), body]));
            const aspects = (ring.aspects || []).filter((aspect) => this.isAspectEnabled(aspect));
            const sorted = [...aspects].sort((a, b) => Number(b.orb) - Number(a.orb));
            sorted.forEach((aspect) => {
                const firstName = this.normalizeBodyName(aspect.planet_1 || aspect.left_planet);
                const secondName = this.normalizeBodyName(aspect.planet_2 || aspect.right_planet);
                if (!this.isBodyAvailableForAspects(firstName, ring.method) || !this.isBodyAvailableForAspects(secondName, ring.method)) return;
                const firstBody = bodyMap.get(firstName);
                const secondBody = bodyMap.get(secondName);
                if (!firstBody || !secondBody) return;

                const angle1 = this.longToAngle(firstBody.longitude) * Math.PI / 180;
                const angle2 = this.longToAngle(secondBody.longitude) * Math.PI / 180;
                const p1 = this.polar(aspectRadius, angle1 * 180 / Math.PI);
                const p2 = this.polar(aspectRadius, angle2 * 180 / Math.PI);
                const geometry = this.resolveAspectLineGeometry({
                    x1: p1.x,
                    y1: p1.y,
                    x2: p2.x,
                    y2: p2.y,
                    angle1,
                    angle2,
                    aspectType: aspect.aspect_type,
                    orb: aspect.orb,
                });
                const aspectKey = this.buildAspectKey(firstName, secondName);
                this.aspectLookupByKey[aspectKey] = {
                    ...aspect,
                    planet_1: firstName,
                    planet_2: secondName,
                    left_planet: this.normalizeAspectBodyName(aspect.left_planet || firstName),
                    right_planet: this.normalizeAspectBodyName(aspect.right_planet || secondName),
                    method: aspect.method || ring.method,
                };
                const isMajor = MAJOR_ASPECTS.has(aspect.aspect_type);
                const color = this.getAspectColor(aspect.aspect_type, aspect.harmonic_type);
                const baseThickness = Math.max(0.3, 1.5 - ((Number(aspect.orb) || 0) / 12) * 1.2);
                const thickness = aspect.aspect_type === 'Conjunction'
                    ? baseThickness * 2
                    : baseThickness;
                const aspectAttrs = {
                    'data-aspect': aspectKey,
                    'data-aspect-key': aspectKey,
                    'data-planet-1': firstName,
                    'data-planet-2': secondName,
                    'data-method-1': ring.method,
                    'data-method-2': ring.method,
                    'data-type': aspect.aspect_type,
                    'data-major': isMajor ? 'true' : 'false',
                    'data-conjunction-collapsed': geometry.collapsed ? 'true' : 'false',
                };

                const aspectElement = geometry.drawDot
                    ? this.el('circle', {
                        cx: geometry.midX,
                        cy: geometry.midY,
                        r: this.conjunctionDisplay.dotRadius,
                        fill: color,
                        stroke: color,
                        'stroke-width': aspect.aspect_type === 'Conjunction' ? 2.4 : 1.2,
                        opacity: isMajor ? 0.82 : 0.55,
                        class: 'aspect-line aspect-dot',
                        ...aspectAttrs,
                    })
                    : this.el('line', {
                        x1: geometry.x1, y1: geometry.y1, x2: geometry.x2, y2: geometry.y2,
                        stroke: color,
                        'stroke-width': thickness,
                        'stroke-dasharray': isMajor ? 'none' : '3,2',
                        'stroke-linecap': aspect.aspect_type === 'Conjunction' ? 'round' : 'butt',
                        opacity: isMajor ? 0.7 : 0.45,
                        class: 'aspect-line',
                        ...aspectAttrs,
                    });
                this.layers.aspects.appendChild(aspectElement);

                const shouldDrawAspectGlyph = isMajor
                    && Number(aspect.orb) < 5
                    && !geometry.drawDot
                    && (aspect.aspect_type !== 'Conjunction' || geometry.collapsed);
                if (!shouldDrawAspectGlyph) return;
                const glyph = ASPECT_SYMBOLS[aspect.aspect_type];
                if (!glyph) return;
                const symbolGroup = this.el('g', {
                    class: 'aspect-symbol-group',
                    style: 'pointer-events: none;',
                    ...aspectAttrs,
                });
                const symbolText = this.el('text', {
                    x: geometry.midX,
                    y: geometry.midY + 2.5,
                    'text-anchor': 'middle',
                    'font-size': 8,
                    fill: color,
                    class: 'aspect-symbol-text',
                    style: 'pointer-events: none;',
                }, glyph);
                symbolGroup.appendChild(symbolText);
                this.layers.aspects.appendChild(symbolGroup);

                try {
                    const bbox = symbolText.getBBox();
                    const backdropRadius = Math.max(bbox.width, bbox.height) / 2 + 1.5;
                    const backdrop = this.el('circle', {
                        cx: bbox.x + bbox.width / 2,
                        cy: bbox.y + bbox.height / 2,
                        r: backdropRadius,
                        fill: WHEEL_BG,
                        opacity: 0.96,
                        class: 'aspect-symbol-backdrop',
                    });
                    symbolGroup.insertBefore(backdrop, symbolText);
                } catch (error) {
                    // Ignore bbox issues and keep the text visible even without backdrop.
                }
            });
        }

        resolveBodyLayout(bodies, baseRadius, alternateRadius) {
            const items = bodies
                .map((body) => {
                    const scale = this.isPointBody(body.name) ? this.pointScale : this.planetScale;
                    const hasSvg = window.AstroGlyphs?.hasPlanetIcon?.(body.name) === true;
                    const glyphScale = hasSvg ? 1 : (Symbols?.planetGlyphScale?.[body.name] || 1);
                    const rawAngle = this.normalizeAngle(this.longToAngle(body.longitude));
                    return {
                        body,
                        rawAngle,
                        angle: rawAngle,
                        radius: baseRadius,
                        glyphSize: hasSvg
                            ? this.natalGlyphBaseSize * scale * (window.AstroGlyphs?.getPlanetIconScale?.(body.name) || 1.18)
                            : this.natalGlyphBaseSize * glyphScale * scale,
                        hasLeader: false,
                        clusterAngle: null,
                    };
                })
                .sort((a, b) => a.angle - b.angle);

            if (items.length <= 1) return items;

            const getPairGapDeg = (leftItem, rightItem, radius = baseRadius) => {
                const pairGapPx = ((leftItem.glyphSize + rightItem.glyphSize) / 2) + 2;
                return Math.max(1.1, (pairGapPx / (2 * Math.PI * Math.max(radius, 1))) * 360);
            };

            const compactTrack = (trackItems, radius) => {
                if (!trackItems.length) return [];
                const rawAngles = trackItems.map((item) => item.clusterAngle);
                const displayAngles = [...rawAngles];

                for (let index = 1; index < trackItems.length; index += 1) {
                    const minGapDeg = getPairGapDeg(trackItems[index - 1], trackItems[index], radius);
                    displayAngles[index] = Math.max(rawAngles[index], displayAngles[index - 1] + minGapDeg);
                }

                const rawCenter = (rawAngles[0] + rawAngles[rawAngles.length - 1]) / 2;
                const displayCenter = (displayAngles[0] + displayAngles[displayAngles.length - 1]) / 2;
                const shift = rawCenter - displayCenter;
                return displayAngles.map((angle) => angle + shift);
            };

            const clusters = [];
            let currentCluster = [items[0]];

            for (let index = 1; index < items.length; index += 1) {
                const prev = items[index - 1];
                const curr = items[index];
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
                    item.radius = baseRadius;
                    item.angle = this.normalizeAngle(item.clusterAngle);
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
                        item.angle = this.normalizeAngle(primaryTrackAngles[index]);
                        item.radius = baseRadius;
                        item.hasLeader = Math.abs(primaryTrackAngles[index] - rawAngles[index]) > leaderThreshold;
                    });
                    return;
                }

                const primaryTrackItems = cluster.filter((_, index) => index % 2 === 0);
                const secondaryTrackItems = cluster.filter((_, index) => index % 2 === 1);
                const primaryCompactAngles = compactTrack(primaryTrackItems, baseRadius);
                const secondaryCompactAngles = compactTrack(secondaryTrackItems, alternateRadius);

                let primaryIndex = 0;
                let secondaryIndex = 0;
                cluster.forEach((item, index) => {
                    const isSecondaryTrack = index % 2 === 1;
                    const rawAngle = item.clusterAngle;
                    const displayAngle = isSecondaryTrack
                        ? secondaryCompactAngles[secondaryIndex++]
                        : primaryCompactAngles[primaryIndex++];
                    const displayRadius = isSecondaryTrack ? alternateRadius : baseRadius;
                    item.angle = this.normalizeAngle(displayAngle);
                    item.radius = displayRadius;
                    item.hasLeader = Math.abs(displayAngle - rawAngle) > 0.35 || Math.abs(displayRadius - baseRadius) > 0.5;
                });
            });

            return items;
        }

        isAspectEnabled(aspect) {
            if (!aspect?.aspect_type) return false;
            const isMajor = MAJOR_ASPECTS.has(aspect.aspect_type);
            if (this.aspectScope === 'major' && !isMajor) return false;
            if (this.aspectScope === 'minor' && isMajor) return false;
            if (this.enabledAspectTypes.length && !this.enabledAspectTypes.includes(aspect.aspect_type)) return false;
            return true;
        }

        isBodyDisplayed(name, method = 'prognostic') {
            const row = this.getMatrixRow(name, method);
            return row.display !== false;
        }

        isBodyAspecting(name, method = 'prognostic') {
            const row = this.getMatrixRow(name, method);
            return row.aspecting !== false;
        }

        isBodyAvailableForAspects(name, method = 'prognostic') {
            const row = this.getMatrixRow(name, method);
            return row.display !== false && row.aspecting !== false;
        }

        getMatrixRow(name, method = 'prognostic') {
            const normalized = window.AstroPreferences?.normalizeMatrixBodyName
                ? window.AstroPreferences.normalizeMatrixBodyName(name)
                : this.normalizeBodyName(name);
            const scopedRows = method === 'natal'
                ? (this.natalMatrixRows || {})
                : (this.prognosticMatrixRows || this.matrixRows || {});
            return scopedRows?.[normalized] || { display: true, aspecting: true };
        }

        normalizeBodyName(name) {
            return ({ TrueNorthNode: 'TrueNode', TrueSouthNode: 'SouthNode', Fortune: 'PartOfFortune' })[String(name || '')] || String(name || '');
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

        normalizeAngle(angle) {
            let normalized = Number(angle) || 0;
            while (normalized < 0) normalized += 360;
            while (normalized >= 360) normalized -= 360;
            return normalized;
        }

        getAspectBoundaryRadius(natalRing) {
            return natalRing?.inner || FIRST_RING_INNER_R;
        }

        resolveAspectLineGeometry({ x1, y1, x2, y2, angle1, angle2, aspectType, orb }) {
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            const rawLength = Math.hypot(x2 - x1, y2 - y1);
            const numericOrb = Number(orb);
            const shouldDrawDot = aspectType === 'Conjunction'
                && Number.isFinite(numericOrb)
                && numericOrb <= this.conjunctionDisplay.dotOrbThreshold;

            if (aspectType !== 'Conjunction' || rawLength >= this.conjunctionDisplay.collapseThreshold) {
                return {
                    x1,
                    y1,
                    x2,
                    y2,
                    midX,
                    midY,
                    rawLength,
                    drawDot: shouldDrawDot,
                    collapsed: shouldDrawDot,
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
                drawDot: shouldDrawDot,
                collapsed: true,
            };
        }

        getAspectColor(aspectType, harmonicType = null) {
            return window.AstroPreferences?.getAspectColor
                ? window.AstroPreferences.getAspectColor(aspectType, this.visualPreferences, harmonicType)
                : (DEFAULT_ASPECT_COLORS[aspectType] || '#94a3b8');
        }

        getBodyColor(body, fallback) {
            const normalizedName = this.normalizeBodyName(body?.name);
            if (this.bodyColorByName?.has(normalizedName)) {
                return this.bodyColorByName.get(normalizedName);
            }
            const element = body?.element || Symbols?.signElements?.[body?.sign];
            return window.AstroPreferences?.getPlanetColor
                ? window.AstroPreferences.getPlanetColor(body?.name, element, this.visualPreferences)
                : fallback;
        }

        buildBodyColorMap(rings = []) {
            const colorByName = new Map();
            const orderedRings = [
                ...rings.filter((ring) => ring?.method === 'natal'),
                ...rings.filter((ring) => ring?.method !== 'natal'),
            ];
            orderedRings.forEach((ring) => {
                (ring?.bodies || []).forEach((body) => {
                    const normalizedName = this.normalizeBodyName(body?.name);
                    if (!normalizedName || colorByName.has(normalizedName)) return;
                    const element = body?.element || Symbols?.signElements?.[body?.sign];
                    const color = window.AstroPreferences?.getPlanetColor
                        ? window.AstroPreferences.getPlanetColor(body?.name, element, this.visualPreferences)
                        : '#374151';
                    colorByName.set(normalizedName, color);
                });
            });
            return colorByName;
        }

        longToAngle(longitude) {
            const referenceLayer = this.viewModel?.natalLayer || this.viewModel?.activePrognosticLayers?.[0];
            const reference = this.orientation === 'asc'
                ? (referenceLayer?.raw?.angles?.ASC?.longitude || 0)
                : 0;
            let angle = 180 - (Number(longitude) - reference);
            while (angle < 0) angle += 360;
            while (angle >= 360) angle -= 360;
            return angle;
        }

        midLongitude(start, end) {
            let delta = end - start;
            if (delta < 0) delta += 360;
            return start + delta / 2;
        }

        polar(radius, degrees) {
            const rad = degrees * Math.PI / 180;
            return { x: C + radius * Math.cos(rad), y: C + radius * Math.sin(rad) };
        }

        /**
         * W1 (Фаза W): маркеры углов ASC/MC/DSC/IC за кругом — порт drawAnglesEnhanced
         * из ChartWheel для паритета одиночной карты. Рисуются для первого кольца,
         * несущего `angles` (обычно базовое/натальное). Opt-in: showAngleMarkers.
         * Форма данных: ring.angles = { ASC: {longitude}, MC: {...}, DSC, IC }.
         */
        drawAngleMarkers(rings) {
            if (!this.showAngleMarkers || !this.layers.angles) return;
            // angles на слое напрямую, либо fallback в raw (так слои строит
            // PrognosticLayerNormalizer для существующих страниц)
            const resolveAngles = (r) => r?.angles || r?.raw?.angles || null;
            const ring = (rings || []).find((r) => {
                const a = resolveAngles(r);
                return a && (a.ASC || a.MC);
            });
            if (!ring) return;
            const angles = resolveAngles(ring);
            ['ASC', 'MC', 'DSC', 'IC'].forEach((label) => {
                const data = angles[label];
                const longitude = data && data.longitude;
                if (longitude === null || longitude === undefined) return;
                this.drawAngleMarker(this.longToAngle(Number(longitude)), label, ring);
            });
        }

        drawAngleMarker(angleDeg, label, ring) {
            const outsideExtension = Number(this.houseVisualOptions.outsideExtension) || 14;
            const isAscDsc = label === 'ASC' || label === 'DSC';
            const isBold = (isAscDsc && this.angleAscDscBold !== false)
                || (!isAscDsc && this.angleMcIcBold !== false);
            const stroke = ring.method === 'natal' ? '#111111' : (ring.color || '#111111');

            const p1 = this.polar(OUTER_R + 1, angleDeg);
            const p2 = this.polar(OUTER_R + outsideExtension, angleDeg);
            this.layers.angles.appendChild(this.el('line', {
                x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
                stroke,
                'stroke-width': isBold ? 2.4 : 1.2,
                class: 'angle-marker-line',
                'data-angle': label,
                'data-method': ring.method || '',
            }));

            const labelR = OUTER_R + (this.houseLabelsOutside ? 26 : 20);
            const pos = this.polar(labelR, angleDeg);
            const relX = (pos.x - C) / labelR;   // косинус экранного угла
            const anchor = Math.abs(relX) < 0.2 ? 'middle' : (relX > 0 ? 'start' : 'end');
            const dx = anchor === 'middle' ? 0 : (anchor === 'start' ? 3 : -3);
            this.layers.angles.appendChild(this.el('text', {
                x: pos.x + dx,
                y: pos.y + 3,
                'text-anchor': anchor,
                'font-size': '9',
                'font-weight': isBold ? '800' : '500',
                fill: stroke,
                class: 'angle-marker-label',
                'data-angle': label,
                'data-method': ring.method || '',
            }, label));
        }

        drawArc(outerR, innerR, startAngle, endAngle, fill, parent) {
            const startOuter = this.polar(outerR, startAngle);
            const endOuter = this.polar(outerR, endAngle);
            const startInner = this.polar(innerR, endAngle);
            const endInner = this.polar(innerR, startAngle);
            const sweep = (endAngle - startAngle + 360) % 360;
            const largeArc = sweep > 180 ? 1 : 0;
            const path = [
                `M ${startOuter.x} ${startOuter.y}`,
                `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
                `L ${startInner.x} ${startInner.y}`,
                `A ${innerR} ${innerR} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
                'Z',
            ].join(' ');
            parent.appendChild(this.el('path', { d: path, fill }));
        }

        drawAnnulus(outerR, innerR, fill, parent) {
            const path = [
                `M ${C - outerR} ${C}`,
                `A ${outerR} ${outerR} 0 1 0 ${C + outerR} ${C}`,
                `A ${outerR} ${outerR} 0 1 0 ${C - outerR} ${C}`,
                `M ${C - innerR} ${C}`,
                `A ${innerR} ${innerR} 0 1 1 ${C + innerR} ${C}`,
                `A ${innerR} ${innerR} 0 1 1 ${C - innerR} ${C}`,
                'Z',
            ].join(' ');
            parent.appendChild(this.el('path', {
                d: path,
                fill,
                'fill-rule': 'evenodd',
            }));
        }

        signByIndex(index) {
            return ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'][index];
        }

        bodyName(name) {
            const key = `astro.planet.${name}`;
            const translated = window.FrontendI18n?.t?.(key);
            return translated && translated !== key ? translated : (Symbols?.getPlanetNameRu?.(name) || name);
        }

        formatHouseLabel(number) {
            const numeric = Number(number) || 1;
            if (this.houseNumberStyle === 'roman') {
                return HOUSE_LABELS[numeric - 1] || String(numeric);
            }
            return String(numeric);
        }

        getDisplayedHouseLabel(number) {
            const numeric = Number(number) || 0;
            // When outer angle markers (ASC/IC/DSC/MC) are drawn, keep the inner
            // angular-house labels numeric so the axis names are not duplicated
            // both outside the ring and on the cusps.
            if (!this.showAngleMarkers) {
                const angleLabels = {
                    1: 'ASC',
                    4: 'IC',
                    7: 'DSC',
                    10: 'MC',
                };
                if (angleLabels[numeric]) return angleLabels[numeric];
            }
            return this.formatHouseLabel(numeric);
        }

        getHouseLabelColor(isAngular) {
            return isAngular && this.shouldUseBlackAngularCusps() ? '#111111' : '#5c554e';
        }

        getHouseLineColor(isAngular) {
            return isAngular && this.shouldUseBlackAngularCusps() ? '#111111' : '#7c746c';
        }

        shouldUseBlackAngularCusps() {
            return window.AstroPreferences?.shouldUseBlackAngularCusps
                ? window.AstroPreferences.shouldUseBlackAngularCusps(this.visualPreferences)
                : this.visualPreferences?.wheel?.angular_cusps_black === true;
        }

        getHouseLayerTheme(method = 'natal') {
            return HOUSE_LAYER_THEMES[method] || HOUSE_LAYER_THEMES.natal;
        }

        getOutsideHouseLabelGeometry(angleDeg, method = 'natal') {
            const angle = angleDeg * Math.PI / 180;
            const theme = this.getHouseLayerTheme(method);
            const outsideExtension = Number(this.houseVisualOptions.outsideExtension) || 14;
            const radialOffset = Number(theme.radialOffset ?? this.houseVisualOptions.outsideRadialOffset) || 0;
            const tangentOffset = Number(theme.tangentOffset ?? this.houseVisualOptions.outsideTangentOffset) || 0;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const tangentX = -sin;
            const tangentY = cos;
            const verticalBias = Math.max(0, 0.35 - Math.abs(cos)) * 8;
            const radius = OUTER_R + outsideExtension + radialOffset;
            const anchor = Math.abs(cos) < 0.18 ? 'middle' : (cos > 0 ? 'start' : 'end');

            return {
                x: C + radius * cos + (tangentOffset + verticalBias) * tangentX,
                y: C + radius * sin + (tangentOffset + verticalBias) * tangentY,
                anchor,
            };
        }

        isPointBody(name) {
            return ['TrueNode', 'TrueNorthNode', 'SouthNode', 'TrueSouthNode', 'BlackMoon', 'WhiteMoon', 'PartOfFortune', 'Fortune'].includes(name);
        }

        clampPointScale(value) {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) return 1;
            return Math.min(1.7, Math.max(0.8, numeric));
        }

        bindEvents() {
            this.svg.querySelectorAll('.prognostic-body').forEach((group) => {
                group.addEventListener('mouseenter', (event) => this.onPlanetHover(event, true));
                group.addEventListener('mouseleave', (event) => this.onPlanetHover(event, false));
                group.addEventListener('click', (event) => this.onPlanetClick(event));
                group.addEventListener('contextmenu', (event) => this.onPlanetContextMenu(event));
                group.addEventListener('mouseenter', (event) => this.onPlanetTooltipHover(event, true));
                group.addEventListener('mousemove', (event) => this.onPlanetTooltipHover(event, true));
                group.addEventListener('mouseleave', (event) => this.onPlanetTooltipHover(event, false));
            });

            this.svg.querySelectorAll('.aspect-line').forEach((line) => {
                line.addEventListener('mouseenter', (event) => this.onAspectHover(event, true));
                line.addEventListener('mousemove', (event) => this.onAspectHoverMove(event));
                line.addEventListener('mouseleave', (event) => this.onAspectHover(event, false));
            });

            this.svg.querySelectorAll('.house-cusp-group').forEach((group) => {
                group.addEventListener('mouseenter', (event) => this.onHouseCuspHover(event, true));
                group.addEventListener('mousemove', (event) => this.onHouseCuspHover(event, true));
                group.addEventListener('mouseleave', (event) => this.onHouseCuspHover(event, false));
            });
        }

        onPlanetHover(event, isEnter) {
            const planetName = event.currentTarget.dataset.planet;
            if (!planetName) return;

            window.AstroGlyphs?.setPlanetSymbolActive?.(event.currentTarget, isEnter);

            const leaderLine = event.currentTarget.querySelector('.planet-leader-line');
            if (leaderLine) {
                leaderLine.style.opacity = isEnter ? '0.92' : '';
                leaderLine.style.strokeWidth = isEnter ? '0.9' : '';
            }

            const anchorPoint = event.currentTarget.querySelector('.planet-anchor-point');
            if (anchorPoint) {
                anchorPoint.style.stroke = isEnter ? 'rgba(184, 147, 90, 0.7)' : '';
                anchorPoint.style.strokeWidth = isEnter ? '2' : '';
            }

            document.querySelectorAll(`tr[data-planet="${this.escapeAttribute(planetName)}"]`).forEach((row) => {
                row.classList.toggle('active-row', isEnter);
            });

            this.svg.querySelectorAll('.aspect-line').forEach((line) => {
                const matches = line.dataset.planet1 === planetName || line.dataset.planet2 === planetName;
                if (!matches) return;
                line.style.opacity = isEnter ? '1' : '';
                line.style.strokeWidth = isEnter ? '3' : '';
            });
        }

        onPlanetClick(event) {
            if (Date.now() < this.suppressPlanetClickUntil) return;
            const planetName = event.currentTarget.dataset.planet;
            const method = event.currentTarget.dataset.method;
            const body = this.findBody(planetName, method);
            if (!body) return;
            this.showTooltip(this.getPlanetTooltipHtml(body, method), event);
        }

        onPlanetContextMenu(event) {
            const planetName = event.currentTarget.dataset.planet;
            const method = event.currentTarget.dataset.method;
            if (!planetName) return;
            event.preventDefault();
            this.suppressPlanetClickUntil = Date.now() + 250;
            this.hideTooltip();
            this.dispatchAspectHover('chart:body-contextmenu', {
                source: 'wheel',
                body: planetName,
                method,
                clientX: event.clientX,
                clientY: event.clientY,
            });
        }

        onPlanetTooltipHover(event, isEnter) {
            if (!isEnter) {
                this.hideTooltip();
                return;
            }

            const planetName = event.currentTarget.dataset.planet;
            const method = event.currentTarget.dataset.method;
            const body = this.findBody(planetName, method);
            if (!body) return;
            this.showTooltip(this.getPlanetTooltipHtml(body, method), event);
        }

        onAspectHover(event, isEnter) {
            const aspectKey = event.currentTarget.dataset.aspectKey || event.currentTarget.dataset.aspect;
            if (!aspectKey) return;

            if (isEnter) {
                this.setHoveredAspect(aspectKey);
                const aspectData = this.aspectLookupByKey[aspectKey];
                if (aspectData) {
                    this.showTooltip(this.getAspectTooltipHtml(aspectData), event);
                }
                this.dispatchAspectHover('chart:aspect-hover', {
                    source: 'wheel',
                    aspectKey,
                    aspect: aspectData || null,
                });
                return;
            }

            this.clearHoveredAspect();
            this.hideTooltip();
            this.dispatchAspectHover('chart:aspect-leave', {
                source: 'wheel',
                aspectKey,
            });
        }

        onAspectHoverMove(event) {
            if (!this.tooltipEl || this.tooltipEl.style.display !== 'block') return;
            this.moveTooltip(event);
        }

        onHouseCuspHover(event, isEnter) {
            const group = event.currentTarget;
            const lines = [...group.querySelectorAll('.house-cusp-line')];
            const houseNumber = Number(group.dataset.house || 0);
            const method = group.dataset.method || '';

            if (!isEnter) {
                lines.forEach((line) => {
                    line.style.strokeWidth = '';
                    line.style.opacity = '';
                });
                document.querySelectorAll(`tr[id="row-house-${this.escapeAttribute(String(houseNumber))}"]`).forEach((row) => {
                    row.classList.remove('active-row');
                });
                this.hideTooltip();
                return;
            }

            lines.forEach((line) => {
                line.style.strokeWidth = [1, 4, 7, 10].includes(houseNumber) ? '3.2' : '2.2';
                line.style.opacity = '1';
            });

            document.querySelectorAll(`tr[id="row-house-${this.escapeAttribute(String(houseNumber))}"]`).forEach((row) => {
                row.classList.add('active-row');
            });

            const sign = group.dataset.sign || '';
            const degreeInSign = Number(group.dataset.degreeInSign || 0);
            const longitude = Number(group.dataset.longitude || 0);
            const methodLabel = this.methodLabel(method);
            const position = this.formatAstroCoordinate({ sign, degree_in_sign: degreeInSign });

            this.showTooltip(`
                <strong>${this.escapeHtml(methodLabel)} · ${this.escapeHtml(this.houseLabel(houseNumber))}</strong><br>
                ${position}<br>
                ${this.escapeHtml(this.t('common.longitude'))}: ${this.formatDMS(longitude)}
            `, event);
        }

        setHoveredAspect(aspectKey) {
            this.clearHoveredAspect();
            if (!aspectKey) return;

            const escaped = this.escapeAttribute(aspectKey);
            this.svg.querySelectorAll(`.aspect-line[data-aspect-key="${escaped}"]`).forEach((line) => {
                line.classList.add('forecast-new-aspect-focus');
            });

            const line = this.svg.querySelector(`.aspect-line[data-aspect-key="${escaped}"]`);
            const bodies = [line?.dataset.planet1, line?.dataset.planet2].filter(Boolean);
            bodies.forEach((bodyName) => {
                this.svg.querySelectorAll(`.prognostic-body[data-planet="${this.escapeAttribute(bodyName)}"]`).forEach((group) => {
                    group.classList.add('forecast-new-planet-focus');
                });
                document.querySelectorAll(`tr[data-planet="${this.escapeAttribute(bodyName)}"]`).forEach((row) => {
                    row.classList.add('active-row');
                });
            });
        }

        clearHoveredAspect() {
            this.svg.querySelectorAll('.forecast-new-aspect-focus').forEach((line) => {
                line.classList.remove('forecast-new-aspect-focus');
            });
            this.svg.querySelectorAll('.forecast-new-planet-focus').forEach((group) => {
                group.classList.remove('forecast-new-planet-focus');
            });
            document.querySelectorAll('tr[data-planet].active-row').forEach((row) => {
                row.classList.remove('active-row');
            });
        }

        dispatchAspectHover(type, detail = {}) {
            document.dispatchEvent(new CustomEvent(type, { detail }));
        }

        ensureTooltip() {
            if (this.tooltipEl && this.tooltipEl.isConnected) return this.tooltipEl;

            const host = this.svg.closest('.forecast-new-center, .chart-center, .solar-wheel-wrapper, .biwheel-svg-wrapper')
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

        getPlanetTooltipHtml(body, method) {
            const symbol = Symbols?.planets?.[this.normalizeAspectBodyName(body.name)] || Symbols?.planets?.[body.name] || '';
            const house = body.house != null ? this.formatHouseLabel(body.house) : this.t('common.notAvailable');
            const methodLabel = this.methodLabel(method);
            const position = this.formatAstroCoordinate(body);
            return `
                <strong>${this.escapeHtml(methodLabel)} · <span class="astro-symbol">${this.escapeHtml(symbol)}</span> ${this.escapeHtml(this.bodyName(body.name))}</strong><br>
                ${position}<br>
                ${this.escapeHtml(this.t('common.house'))}: ${this.escapeHtml(String(house))}${body.retrograde ? ' <span style="color:#dc2626">R</span>' : ''}
            `;
        }

        getAspectTooltipHtml(aspectData) {
            const leftPlanet = this.normalizeAspectBodyName(aspectData?.left_planet || aspectData?.planet_1);
            const rightPlanet = this.normalizeAspectBodyName(aspectData?.right_planet || aspectData?.planet_2);
            const leftSymbol = Symbols?.planets?.[leftPlanet] || '';
            const rightSymbol = Symbols?.planets?.[rightPlanet] || '';
            const leftName = this.bodyName(leftPlanet);
            const rightName = this.bodyName(rightPlanet);
            const aspectType = aspectData?.aspect_type || '';
            const aspectSymbol = Symbols?.getAspectDisplay?.(aspectType) || Symbols?.aspects?.[aspectType] || '';
            const aspectName = this.aspectName(aspectType);
            const orb = Number(aspectData?.orb);
            const orbLabel = Number.isFinite(orb) ? `${orb.toFixed(2)}°` : this.t('common.notAvailable');
            const methodLabel = this.methodLabel(aspectData?.method);
            const harmonicLabel = this.getAspectHarmonicLabel(aspectData?.harmonic_type);
            const phaseLabel = this.getAspectPhaseLabel(aspectData);
            const harmonyLine = (aspectData?.harmonic_type === 'neutral' && phaseLabel)
                ? `${this.escapeHtml(harmonicLabel)} · ${this.escapeHtml(phaseLabel)}`
                : this.escapeHtml(harmonicLabel);
            const aspectText = this.showAspectText ? ` ${this.escapeHtml(aspectName)}` : '';
            return `
                <strong>${this.escapeHtml(methodLabel)} · <span class="astro-symbol">${this.escapeHtml(leftSymbol)}</span> ${this.escapeHtml(leftName)} ${this.escapeHtml(aspectSymbol)}${aspectText} <span class="astro-symbol">${this.escapeHtml(rightSymbol)}</span> ${this.escapeHtml(rightName)}</strong><br>
                ${this.escapeHtml(this.t('common.orb'))}: ${this.escapeHtml(orbLabel)}<br>
                ${harmonyLine}
            `;
        }

        findBody(name, method) {
            const layers = [
                this.viewModel?.natalLayer,
                ...(this.viewModel?.activePrognosticLayers || []),
            ].filter(Boolean);
            for (const layer of layers) {
                if (method && layer.method !== method) continue;
                const found = (layer.bodies || []).find((body) => body?.name === name);
                if (found) return found;
            }
            return null;
        }

        t(key, params) {
            return window.FrontendI18n?.t?.(key, params) || key;
        }

        signName(name) {
            const key = `astro.sign.${name}`;
            const translated = this.t(key);
            return translated && translated !== key ? translated : (Symbols?.signNamesRu?.[name] || name || '');
        }

        aspectName(name) {
            const key = `astro.aspect.${name}`;
            const translated = this.t(key);
            return translated && translated !== key ? translated : (Symbols?.aspectNamesRu?.[name] || name || '');
        }

        getAspectHarmonicLabel(harmonicType) {
            if (harmonicType === 'harmonious') return this.t('page.chart.legend.harmonious');
            if (harmonicType === 'tense') return this.t('page.chart.legend.tense');
            return this.t('page.chart.legend.neutral');
        }

        getAspectPhaseLabel(aspectData) {
            if (!aspectData) return '';
            if (typeof aspectData.applying === 'boolean') {
                return aspectData.applying
                    ? this.t('page.chart.settings.aspectPhase.applying')
                    : this.t('page.chart.settings.aspectPhase.separating');
            }
            const rawPhase = String(aspectData.applying_separating || aspectData.phase || '').trim().toLowerCase();
            if (!rawPhase) return '';
            if (rawPhase.includes('applic') || rawPhase.includes('сход')) {
                return this.t('page.chart.settings.aspectPhase.applying');
            }
            if (rawPhase.includes('separ') || rawPhase.includes('расход')) {
                return this.t('page.chart.settings.aspectPhase.separating');
            }
            return '';
        }

        methodLabel(method) {
            const keyByMethod = {
                natal: 'page.synastry.people.natal',
                transit: 'common.method.transit',
                progression: 'common.method.progression',
                direction: 'common.method.direction',
                solar_return: 'common.method.solar',
                synastry_partner: 'page.synastry.people.partner',
            };
            const key = keyByMethod[String(method || '')];
            if (key) {
                const translated = this.t(key);
                if (translated && translated !== key) return translated;
            }
            return this.t('common.chart') !== 'common.chart' ? this.t('common.chart') : 'Карта';
        }

        houseLabel(number) {
            const formattedHouse = this.formatHouseLabel(number);
            return this.t('page.chart.houseCusp', { house: formattedHouse }) !== 'page.chart.houseCusp'
                ? this.t('page.chart.houseCusp', { house: formattedHouse })
                : `Дом ${formattedHouse}`;
        }

        formatDMS(deg) {
            const safe = Number(deg) || 0;
            let d = Math.floor(safe);
            let remainder = (safe - d) * 60;
            let m = Math.floor(remainder);
            let s = Math.round((remainder - m) * 60);
            if (s === 60) { s = 0; m += 1; }
            if (m === 60) { m = 0; d += 1; }
            return `${d}°${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"`;
        }

        formatAstroCoordinate(item) {
            if (window.LocaleFormatters?.formatAstroCoordinate) {
                return window.LocaleFormatters.formatAstroCoordinate(item, {
                    signSymbol: Symbols?.signs?.[item?.sign],
                    signClass: 'astro-symbol',
                });
            }

            const degree = Number(item?.degree_in_sign);
            if (!Number.isFinite(degree)) return '';
            const d = Math.floor(degree);
            const m = Math.floor((degree - d) * 60);
            const signSymbol = Symbols?.signs?.[item?.sign] || item?.sign || '';
            const signMarkup = signSymbol ? `<span class="astro-symbol">${signSymbol}</span>` : '';
            return [`${d}°`, signMarkup, `${String(m).padStart(2, '0')}'`]
                .filter(Boolean)
                .join(' ');
        }

        escapeAttribute(value) {
            return String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        }

        escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        getLeaderLineEndPoint(anchorPoint, iconPoint, iconRadius, gap = 2) {
            return getPlanetLeaderLineEndPoint(anchorPoint, iconPoint, iconRadius, gap);
        }

        el(tag, attrs = {}, text = null) {
            const node = document.createElementNS(NS, tag);
            Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
            if (text !== null && text !== undefined) node.textContent = text;
            return node;
        }
    }

    if (typeof window !== 'undefined') window.PrognosticRingsWheel = PrognosticRingsWheel;
})();

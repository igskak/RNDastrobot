/**
 * Отображение табличных данных карты (профессиональный формат)
 * Стандарт: ГГ°ММ'СС" для координат
 */

class ChartDataRenderer {
    constructor(options = {}) {
        const resolveElement = (explicit, explicitId, fallbackId) => {
            if (explicit) return explicit;
            if (explicitId) return document.getElementById(explicitId);
            return document.getElementById(fallbackId);
        };

        this.planetsTable = resolveElement(options.planetsTable, options.planetsTableId, 'planetsTable');
        this.housesTable = resolveElement(options.housesTable, options.housesTableId, 'housesTable');
        this.aspectsTable = resolveElement(options.aspectsTable, options.aspectsTableId, 'aspectsTable');
        this.aspectGridContainer = resolveElement(options.aspectGridContainer, options.aspectGridContainerId, 'aspectGridContainer');
        this.configsContainer = resolveElement(options.configsContainer, options.configsContainerId, 'configurationsContainer');
        this.balancesContainer = resolveElement(options.balancesContainer, options.balancesContainerId, 'balancesContainer');
        this.dignitiesContainer = resolveElement(options.dignitiesContainer, options.dignitiesContainerId, 'dignitiesContainer');
        this.aspectSortHeadersSelector = options.aspectSortHeadersSelector || '#aspects-list th.sortable[data-sort]';

        this.aspectTypeFilter = 'all'; // 'all', 'major', 'minor'
        this.aspectPlanetFilter = null;
        this.aspectSortState = { field: 'planet', ascending: true };
        this.aspectSortHeaders = [];
        this.hoveredAspectKey = null;
        this.showSpeed = true;
        this.showStationary = true;
        this.showApplyingSeparating = false;
        this.visualPreferences = window.AstroPreferences?.getAccountVisualPreferences?.() || null;
        this.initAspectSortHeaders();
    }

    t(key, params) {
        return window.FrontendI18n?.t?.(key, params) || key;
    }

    planetName(name) {
        const key = `astro.planet.${name}`;
        const translated = this.t(key);
        return translated === key ? (Symbols.planetNamesRu[name] || name) : translated;
    }

    signName(name) {
        const key = `astro.sign.${name}`;
        const translated = this.t(key);
        return translated === key ? (Symbols.signNamesRu[name] || name) : translated;
    }

    aspectName(name) {
        const key = `astro.aspect.${name}`;
        const translated = this.t(key);
        return translated === key ? (Symbols.aspectNamesRu[name] || name) : translated;
    }

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    retrogradeTitle() {
        const key = 'page.natalFull.legend.motion.retrograde';
        const translated = this.t(key);
        return translated === key ? 'Retrograde' : translated;
    }

    retroIndicatorHtml(isRetrograde, variantClass = '') {
        if (!isRetrograde) return '';
        const suffix = variantClass ? ` ${variantClass}` : '';
        const title = this.escapeHtml(this.retrogradeTitle());
        return `<span class="retro-indicator${suffix}" title="${title}" aria-label="${title}">R</span>`;
    }

    buildRetrogradeLookup(planets = []) {
        const lookup = new Map();
        planets.forEach((planet) => {
            if (!planet?.name) return;
            const normalizedName = this.normalizeAspectBodyName(planet.name);
            lookup.set(normalizedName, Boolean(planet.retrograde));
        });
        return lookup;
    }

    isBodyRetrograde(name, lookup = null) {
        if (!name) return false;
        const normalizedName = this.normalizeAspectBodyName(String(name));
        const source = lookup || this.buildRetrogradeLookup(this.chartData?.planets || []);
        return source.get(normalizedName) === true;
    }

    // Порядок тел для аспектной сетки и сортировки списка аспектов
    static ASPECT_SORT_ORDER = [
        'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
        'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
        'Chiron', 'Proserpina',
        'TrueNode', 'SouthNode',
        'BlackMoon', 'WhiteMoon', 'PartOfFortune',
        'ASC', 'MC', 'IC', 'DSC', 'Vertex', 'AntiVertex'
    ];

    // Алиясы имён из API к отображаемым ключам
    static ASPECT_NAME_ALIASES = {
        TrueNorthNode: 'TrueNode',
        TrueSouthNode: 'SouthNode',
        Fortune: 'PartOfFortune'
    };

    static ASPECT_SORT_RANK = ChartDataRenderer.ASPECT_SORT_ORDER
        .reduce((acc, name, idx) => {
            acc[name] = idx;
            return acc;
        }, {});

    static ASPECT_TYPE_ORDER = [
        'Conjunction',
        'Opposition',
        'Trine',
        'Square',
        'Sextile',
        'Quincunx',
        'Semisquare',
        'Semisextile',
        'Quintile',
        'Biquintile'
    ];

    static ASPECT_TYPE_RANK = ChartDataRenderer.ASPECT_TYPE_ORDER
        .reduce((acc, name, idx) => {
            acc[name] = idx;
            return acc;
        }, {});

    initAspectSortHeaders() {
        this.aspectSortHeaders = [...document.querySelectorAll(this.aspectSortHeadersSelector)];
        this.aspectSortHeaders.forEach((header) => {
            header.addEventListener('click', () => {
                this.toggleAspectSort(header.dataset.sort);
            });
        });
        this.updateAspectSortHeaders();
    }

    toggleAspectSort(field) {
        if (!field) return;
        if (this.aspectSortState.field === field) {
            this.aspectSortState.ascending = !this.aspectSortState.ascending;
        } else {
            this.aspectSortState.field = field;
            this.aspectSortState.ascending = true;
        }
        this.updateAspectSortHeaders();
        this.reRenderAspects();
    }

    updateAspectSortHeaders() {
        this.aspectSortHeaders.forEach((header) => {
            const isActive = this.aspectSortState.field === header.dataset.sort;
            header.classList.toggle('sort-active', isActive);
            header.classList.toggle('sort-desc', isActive && !this.aspectSortState.ascending);
            header.setAttribute('aria-sort', isActive
                ? (this.aspectSortState.ascending ? 'ascending' : 'descending')
                : 'none');
        });
    }

    setAspectTypeFilter(filter) {
        const nextFilter = filter === 'major' || filter === 'minor' ? filter : 'all';
        if (nextFilter === this.aspectTypeFilter) return;
        this.aspectTypeFilter = nextFilter;
        this.reRenderAspects();
    }

    setAspectPlanetFilter(planetName) {
        const normalizedName = planetName ? this.normalizeAspectBodyName(String(planetName)) : null;
        if (normalizedName === this.aspectPlanetFilter) return;
        this.aspectPlanetFilter = normalizedName;
        this.reRenderAspects();
    }

    setDisplayPreferences(options = {}) {
        if (Object.prototype.hasOwnProperty.call(options, 'showSpeed')) {
            this.showSpeed = options.showSpeed !== false;
        }
        if (Object.prototype.hasOwnProperty.call(options, 'showStationary')) {
            this.showStationary = options.showStationary !== false;
        }
        if (Object.prototype.hasOwnProperty.call(options, 'showApplyingSeparating')) {
            this.showApplyingSeparating = options.showApplyingSeparating === true;
        }

        if (this.chartData) {
            this.renderPlanets(this.chartData.planets);
            this.renderAspects(this.chartData.aspects);
        }
    }

    setVisualPreferences(visualPreferences = {}) {
        this.visualPreferences = window.AstroPreferences?.resolveVisualPreferences
            ? window.AstroPreferences.resolveVisualPreferences(visualPreferences || {})
            : (visualPreferences || null);
        if (this.chartData) {
            this.render(this.chartData);
        }
    }

    reRenderAspects() {
        if (this.chartData) {
            this.renderAspects(this.chartData.aspects);
        }
    }

    /**
     * Отрисовка всех данных
     */
    render(chartData) {
        this.chartData = chartData;
        this.renderPlanets(chartData.planets);
        this.renderHouses(chartData.houses);
        this.renderAspects(chartData.aspects);
        this.renderAspectGrid(chartData.aspects, chartData.planets);
        this.renderDignities(chartData.planets);
        this.renderConfigurations(chartData.aspect_configurations, chartData.stelliums);
        this.renderBalances(chartData.balances, chartData.cosmogram_pattern);
    }

    // Порядок планет и точек
    static PLANET_ORDER = [
        'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
        'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
        'Chiron', 'TrueNode', 'SouthNode', 'BlackMoon', 'WhiteMoon', 'Proserpina',
        'PartOfFortune'
    ];

    // Символы аспектов для сетки
    static ASPECT_GLYPHS = {
        'Conjunction': '☌', 'Opposition': '☍', 'Trine': '△',
        'Square': '□', 'Sextile': '⚹', 'Quincunx': '⚻',
        'Semisextile': '⚺', 'Quintile': 'Q', 'Biquintile': 'bQ'
    };

    renderPlanets(planets) {
        if (!planets || !this.planetsTable) return;

        const sorted = [...planets].sort((a, b) => {
            const iA = ChartDataRenderer.PLANET_ORDER.indexOf(a.name);
            const iB = ChartDataRenderer.PLANET_ORDER.indexOf(b.name);
            return (iA === -1 ? 999 : iA) - (iB === -1 ? 999 : iB);
        });

        // Компактный формат: Симв. (SVG) | Знак ГГ°ММ'СС" | Дом
        this.planetsTable.innerHTML = sorted.map(p => {
            const degDMS = this.formatDMS(p.degree_in_sign);
            const planetIcon = this.createPlanetIconSVG(p);
            const metaParts = [];
            const speedChip = this.renderPlanetSpeedChip(p);
            const stationaryChip = this.renderStationaryChip(p);
            if (this.showSpeed && speedChip) metaParts.push(speedChip);
            if (this.showStationary && stationaryChip) metaParts.push(stationaryChip);
            const metaHtml = metaParts.length
                ? `<div class="planet-position-meta">${metaParts.join('')}</div>`
                : '';
            return `
                <tr id="row-${p.name}" data-planet="${p.name}">
                    <td class="symbol-cell">
                        ${planetIcon}
                        ${this.retroIndicatorHtml(p.retrograde, 'retro-indicator--small')}
                    </td>
                    <td class="mono">
                        <div class="planet-position-main"><span class="astro-symbol">${Symbols.signs[p.sign]}</span> ${degDMS}</div>
                        ${metaHtml}
                    </td>
                    <td class="mono">${p.house}</td>
                </tr>
            `;
        }).join('');
    }

    renderPlanetSpeedChip(planet) {
        if (!planet) return '';
        if (planet.speed_percent !== undefined && planet.speed_percent !== null) {
            const speedPct = Number(planet.speed_percent);
            if (!Number.isFinite(speedPct)) return '';
            let speedClass = '';
            if (speedPct < 80) speedClass = ' planet-meta-chip--speed-slow';
            else if (speedPct > 120) speedClass = ' planet-meta-chip--speed-fast';
            return `<span class="planet-meta-chip${speedClass}">${Math.round(speedPct)}%</span>`;
        }

        if (planet.speed !== undefined && planet.speed !== null) {
            const speed = Number(planet.speed);
            if (!Number.isFinite(speed)) return '';
            return `<span class="planet-meta-chip">${Math.abs(speed).toFixed(2)}°/d</span>`;
        }

        return '';
    }

    renderStationaryChip(planet) {
        if (!planet?.is_stationary) return '';
        const stationaryType = String(planet.stationary_type || '').toLowerCase();
        const label = stationaryType.includes('direct')
            ? 'SD'
            : stationaryType.includes('retro')
                ? 'SR'
                : 'S';
        return `<span class="planet-meta-chip planet-meta-chip--stationary">${label}</span>`;
    }

    renderHouses(houses) {
        if (!houses || !this.housesTable) return;

        // Профессиональный формат: Куспид | Знак ГГ°ММ'СС"
        this.housesTable.innerHTML = houses.map(h => {
            const isAngular = [1, 4, 7, 10].includes(h.number);
            const degDMS = this.formatDMS(h.degree_in_sign);
            return `
                <tr id="row-house-${h.number}" class="${isAngular ? 'house-angular' : ''}">
                    <td class="mono">${h.number}${isAngular ? ' ★' : ''}</td>
                    <td class="mono"><span class="astro-symbol">${Symbols.signs[h.sign]}</span> ${degDMS}</td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Профессиональный формат: ГГ°ММ'СС"
     */
    formatDMS(deg) {
        let d = Math.floor(deg);
        let remainder = (deg - d) * 60;
        let m = Math.floor(remainder);
        let s = Math.round((remainder - m) * 60);
        if (s === 60) { s = 0; m += 1; }
        if (m === 60) { m = 0; d += 1; }
        return `${d}°${m.toString().padStart(2, '0')}'${s.toString().padStart(2, '0')}"`;
    }

    /**
     * Создаёт SVG-иконку планеты (цвет по стихии)
     */
    createPlanetIconSVG(planet) {
        const element = Symbols.signElements[planet.sign];
        const color = window.AstroPreferences?.getPlanetColor
            ? window.AstroPreferences.getPlanetColor(planet.name, element, this.visualPreferences)
            : (Symbols.elementColors[element] || '#374151');
        const symbol = Symbols.planets[planet.name] || planet.name.charAt(0);
        const glyphScale = Symbols.planetGlyphScale?.[planet.name] || 1;
        const glyphSize = 22 * glyphScale;
        const glyphY = 14 + glyphSize * 0.36;

        return `
            <span class="planet-icon-svg">
                <svg width="28" height="28" viewBox="0 0 28 28">
                    <text x="14" y="${glyphY.toFixed(2)}" text-anchor="middle" font-size="${glyphSize.toFixed(2)}" font-weight="600" fill="${color}" class="planet-symbol-text">${symbol}</text>
                </svg>
            </span>
        `;
    }

    formatDegreeShort(deg) {
        const d = Math.floor(deg);
        const m = Math.floor((deg - d) * 60);
        return `${d}°${m.toString().padStart(2, '0')}'`;
    }

    normalizeAspectBodyName(name) {
        return ChartDataRenderer.ASPECT_NAME_ALIASES[name] || name;
    }

    getAspectRank(name) {
        const normalizedName = this.normalizeAspectBodyName(name);
        return ChartDataRenderer.ASPECT_SORT_RANK[normalizedName] ?? 999;
    }

    normalizeAspectForDisplay(aspect) {
        const rank1 = Number.isInteger(aspect.left_rank) ? aspect.left_rank : this.getAspectRank(aspect.planet_1);
        const rank2 = Number.isInteger(aspect.right_rank) ? aspect.right_rank : this.getAspectRank(aspect.planet_2);

        let leftPlanet = aspect.left_planet || aspect.planet_1;
        let rightPlanet = aspect.right_planet || aspect.planet_2;
        let leftRank = rank1;
        let rightRank = rank2;

        // Fallback, если backend ещё не прислал normalized-поля.
        if (!aspect.left_planet || !aspect.right_planet) {
            if (rank2 < rank1 || (rank1 === rank2 && String(aspect.planet_2) < String(aspect.planet_1))) {
                leftPlanet = aspect.planet_2;
                rightPlanet = aspect.planet_1;
                leftRank = rank2;
                rightRank = rank1;
            }
        }

        return {
            ...aspect,
            left_planet: this.normalizeAspectBodyName(leftPlanet),
            right_planet: this.normalizeAspectBodyName(rightPlanet),
            left_rank: leftRank,
            right_rank: rightRank
        };
    }

    getAspectTypeRank(aspectType) {
        return ChartDataRenderer.ASPECT_TYPE_RANK[aspectType] ?? 999;
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

    getAspectKey(aspect) {
        if (!aspect) return null;
        const left = aspect.left_planet || aspect.planet_1;
        const right = aspect.right_planet || aspect.planet_2;
        if (!left || !right) return null;
        return this.buildAspectKey(left, right);
    }

    compareAspectsByPlanet(a, b) {
        if (a.left_rank !== b.left_rank) return a.left_rank - b.left_rank;
        if (a.orb !== b.orb) return a.orb - b.orb;
        if (a.right_rank !== b.right_rank) return a.right_rank - b.right_rank;
        return this.getAspectTypeRank(a.aspect_type) - this.getAspectTypeRank(b.aspect_type);
    }

    compareAspectsByType(a, b) {
        const typeRankDiff = this.getAspectTypeRank(a.aspect_type) - this.getAspectTypeRank(b.aspect_type);
        if (typeRankDiff !== 0) return typeRankDiff;
        if (a.left_rank !== b.left_rank) return a.left_rank - b.left_rank;
        if (a.right_rank !== b.right_rank) return a.right_rank - b.right_rank;
        return a.orb - b.orb;
    }

    compareAspectsByOrb(a, b) {
        // Сохранено текущее поведение: мажорные выше минорных, затем орбис.
        if (a.is_major !== b.is_major) return Number(b.is_major) - Number(a.is_major);
        if (a.orb !== b.orb) return a.orb - b.orb;
        if (a.left_rank !== b.left_rank) return a.left_rank - b.left_rank;
        return a.right_rank - b.right_rank;
    }

    getApplyingSeparatingBadge(aspect) {
        if (!this.showApplyingSeparating || !aspect) return '';

        let label = '';
        if (typeof aspect.applying === 'boolean') {
            label = aspect.applying ? 'Applying' : 'Separating';
        } else if (typeof aspect.applying_separating === 'string' && aspect.applying_separating.trim()) {
            label = aspect.applying_separating.trim();
        } else if (typeof aspect.phase === 'string' && aspect.phase.trim()) {
            label = aspect.phase.trim();
        }

        if (!label) return '';
        return `<div class="aspect-row-meta">${this.escapeHtml(label)}</div>`;
    }

    renderAspects(aspects) {
        if (!this.aspectsTable) return;
        if (!aspects || aspects.length === 0) {
            this.aspectsTable.innerHTML = '';
            return;
        }

        let filtered = aspects;

        if (this.aspectTypeFilter === 'major') {
            filtered = filtered.filter(a => a.is_major);
        } else if (this.aspectTypeFilter === 'minor') {
            filtered = filtered.filter(a => !a.is_major);
        }

        if (this.aspectPlanetFilter) {
            filtered = filtered.filter((a) => {
                const p1 = this.normalizeAspectBodyName(a.planet_1);
                const p2 = this.normalizeAspectBodyName(a.planet_2);
                return p1 === this.aspectPlanetFilter || p2 === this.aspectPlanetFilter;
            });
        }

        const normalized = filtered.map(a => this.normalizeAspectForDisplay(a));
        const retroLookup = this.buildRetrogradeLookup(this.chartData?.planets || []);
        const sorted = [...normalized].sort((a, b) => {
            let diff = 0;
            switch (this.aspectSortState.field) {
                case 'type':
                    diff = this.compareAspectsByType(a, b);
                    break;
                case 'orb':
                    diff = this.compareAspectsByOrb(a, b);
                    break;
                case 'planet':
                default:
                    diff = this.compareAspectsByPlanet(a, b);
                    break;
            }

            return this.aspectSortState.ascending ? diff : -diff;
        });

        if (sorted.length === 0) {
            this.aspectsTable.innerHTML = '<tr><td colspan="4" class="text-muted">—</td></tr>';
            return;
        }

        // Профессиональный формат с орбисом
        this.aspectsTable.innerHTML = sorted.map(a => {
            const typeClass = a.harmonic_type === 'harmonious' ? 'aspect-harmonious'
                            : a.harmonic_type === 'tense' ? 'aspect-tense'
                            : 'aspect-neutral';
            const aspectKey = this.getAspectKey(a);
            const applyingBadge = this.getApplyingSeparatingBadge(a);
            return `
                <tr data-aspect="${aspectKey || ''}" data-aspect-key="${aspectKey || ''}">
                    <td class="symbol-cell"><span class="astro-symbol">${Symbols.planets[a.left_planet] || ''}</span>${this.retroIndicatorHtml(this.isBodyRetrograde(a.left_planet, retroLookup), 'retro-indicator--micro')}</td>
                    <td class="symbol-cell"><span class="astro-symbol">${Symbols.planets[a.right_planet] || ''}</span>${this.retroIndicatorHtml(this.isBodyRetrograde(a.right_planet, retroLookup), 'retro-indicator--micro')}</td>
                    <td class="${typeClass}"><span class="astro-symbol" style="color:${window.AstroPreferences?.getAspectColor ? window.AstroPreferences.getAspectColor(a.aspect_type, this.visualPreferences) : '#9ca3af'}">${Symbols.aspects[a.aspect_type] || ''}</span> ${this.aspectName(a.aspect_type)}${applyingBadge}</td>
                    <td class="mono">${a.orb.toFixed(2)}°</td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Треугольная сетка аспектов (Aspect Grid) — профессиональный стандарт
     * Включает все точки с которыми строятся аспекты
     */
    renderAspectGrid(aspects, planets) {
        if (!this.aspectGridContainer || !aspects || !planets) return;

        const maxGridRank = this.getAspectRank('PartOfFortune');
        const gridPlanets = new Map();
        planets.forEach((p) => {
            const normalizedName = this.normalizeAspectBodyName(p.name);
            const rank = this.getAspectRank(normalizedName);
            if (rank > maxGridRank || gridPlanets.has(normalizedName)) return;
            gridPlanets.set(normalizedName, { ...p, name: normalizedName });
        });
        const filtered = [...gridPlanets.values()]
            .sort((a, b) => this.getAspectRank(a.name) - this.getAspectRank(b.name));

        // Карта аспектов
        const aspectMap = {};
        aspects.forEach(a => {
            const key = this.getAspectKey(a);
            if (key) {
                aspectMap[key] = a;
            }
        });

        let html = '<table class="aspect-grid">';

        // Заголовок
        html += '<tr><th></th>';
        filtered.forEach(p => {
            html += `<th title="${this.planetName(p.name)}"><span class="astro-symbol">${Symbols.planets[p.name]}</span>${this.retroIndicatorHtml(p.retrograde, 'retro-indicator--micro')}</th>`;
        });
        html += '</tr>';

        // Строки (треугольная матрица)
        filtered.forEach((rowPlanet, rowIdx) => {
            html += `<tr><th title="${this.planetName(rowPlanet.name)}"><span class="astro-symbol">${Symbols.planets[rowPlanet.name]}</span>${this.retroIndicatorHtml(rowPlanet.retrograde, 'retro-indicator--micro')}</th>`;

            filtered.forEach((colPlanet, colIdx) => {
                if (colIdx >= rowIdx) {
                    html += '<td></td>';
                } else {
                    const aspectKey = this.buildAspectKey(rowPlanet.name, colPlanet.name);
                    const aspect = aspectMap[aspectKey];
                    if (aspect) {
                        const glyph = ChartDataRenderer.ASPECT_GLYPHS[aspect.aspect_type] || '•';
                        const cls = aspect.harmonic_type === 'harmonious' ? 'grid-harmonious'
                                  : aspect.harmonic_type === 'tense' ? 'grid-tense'
                                  : 'grid-neutral';
                        html += `<td class="${cls}" data-aspect-key="${aspectKey}" title="${this.aspectName(aspect.aspect_type)} ${aspect.orb.toFixed(1)}°"><span class="astro-symbol" style="color:${window.AstroPreferences?.getAspectColor ? window.AstroPreferences.getAspectColor(aspect.aspect_type, this.visualPreferences) : '#9ca3af'}">${glyph}</span></td>`;
                    } else {
                        html += '<td>–</td>';
                    }
                }
            });

            html += '</tr>';
        });

        html += '</table>';
        this.aspectGridContainer.innerHTML = html;
    }

    clearHoveredAspect() {
        this.hoveredAspectKey = null;
        if (this.aspectsTable) {
            this.aspectsTable.querySelectorAll('tr.aspect-hover-row').forEach((row) => {
                row.classList.remove('aspect-hover-row');
            });
        }
        if (this.aspectGridContainer) {
            this.aspectGridContainer.querySelectorAll('td.grid-hover').forEach((cell) => {
                cell.classList.remove('grid-hover');
            });
        }
    }

    setHoveredAspect(aspectKey, options = {}) {
        const surface = options.surface === 'grid' ? 'grid' : 'table';
        this.clearHoveredAspect();
        if (!aspectKey) return;

        this.hoveredAspectKey = aspectKey;

        if (surface === 'table' && this.aspectsTable) {
            const row = this.aspectsTable.querySelector(`tr[data-aspect-key="${aspectKey}"]`);
            if (row) row.classList.add('aspect-hover-row');
            return;
        }

        if (surface === 'grid' && this.aspectGridContainer) {
            const cell = this.aspectGridContainer.querySelector(`td[data-aspect-key="${aspectKey}"]`);
            if (cell) cell.classList.add('grid-hover');
        }
    }

    /**
     * Таблица эссенциальных достоинств
     */
    renderDignities(planets) {
        if (!this.dignitiesContainer || !planets) return;

        const dignityLabels = {
            'domicile': { label: this.t('astro.dignity.domicile'), class: 'dignity-domicile', icon: '🏠' },
            'exaltation': { label: this.t('astro.dignity.exaltation'), class: 'dignity-exaltation', icon: '⬆' },
            'detriment': { label: this.t('astro.dignity.detriment'), class: 'dignity-detriment', icon: '⬇' },
            'fall': { label: this.t('astro.dignity.fall'), class: 'dignity-fall', icon: '💫' },
            'neutral': { label: '', class: '', icon: '' }
        };

        const withDignity = planets.filter(p => p.dignity && p.dignity !== 'neutral');

        if (withDignity.length === 0) {
            this.dignitiesContainer.innerHTML = `<p class="text-muted">${this.t('page.chart.empty.noDignities')}</p>`;
            return;
        }

        let html = '<div class="dignities-list">';
        withDignity.forEach(p => {
            const d = dignityLabels[p.dignity] || dignityLabels.neutral;
            html += `
                <div class="dignity-item ${d.class}">
                    <span class="dignity-planet">${Symbols.planets[p.name]} ${this.planetName(p.name)}</span>
                    <span class="dignity-label">${d.icon} ${d.label}</span>
                </div>
            `;
        });
        html += '</div>';

        this.dignitiesContainer.innerHTML = html;
    }

    renderConfigurations(configurations, stelliums) {
        if (!this.configsContainer) return;

        let html = '';

        // Конфигурации (сортируем по силе)
        if (configurations && configurations.length > 0) {
            const sortedConfigs = [...configurations].sort((a, b) => {
                const strengthA = a.strength_score || 0;
                const strengthB = b.strength_score || 0;
                return strengthB - strengthA;
            });

            html += `<h3 style="margin-bottom: 12px; font-size: 15px;">${this.t('page.chart.configurations.title')}</h3>`;
            html += sortedConfigs.map(c => `
                <div class="config-card">
                    <h4>
                        ${Symbols.configIcons[c.type] || '◆'}
                        ${this.formatConfigType(c.type)}
                    </h4>
                    ${c.apex_planet ? `<p>${this.t('page.chart.configurations.apex', { planet: this.planetName(c.apex_planet) })}</p>` : ''}
                    <p>${this.t('page.chart.configurations.strength', { value: c.strength_score.toFixed(1) })}</p>
                    <div class="config-planets">
                        ${c.planets_involved.map(p => `
                            <span class="planet-tag">
                                ${Symbols.planets[p] || ''} ${this.planetName(p)}
                            </span>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        }
        
        // Стеллиумы (сортируем по количеству планет)
        if (stelliums && stelliums.length > 0) {
            const sortedStelliums = [...stelliums].sort((a, b) => {
                return (b.count || 0) - (a.count || 0);
            });

            html += `<h3 style="margin: 20px 0 12px; font-size: 15px;">${this.t('page.chart.configurations.stelliums')}</h3>`;
            html += sortedStelliums.map(s => `
                <div class="config-card">
                    <h4>
                        ⭐ ${s.type === 'house'
                            ? this.t('page.chart.configurations.houseLabel', { house: s.house_number })
                            : this.signName(s.sign)}
                    </h4>
                    <p>${this.t('page.chart.configurations.planetCount', { count: s.count })}</p>
                    <div class="config-planets">
                        ${s.planets.map(p => `
                            <span class="planet-tag">
                                ${Symbols.planets[p] || ''} ${this.planetName(p)}
                            </span>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        }
        
        if (!html) {
            html = `<p style="color: #6e6e73; text-align: center; padding: 40px;">${this.t('page.chart.empty.noConfigurations')}</p>`;
        }
        
        this.configsContainer.innerHTML = html;
    }

    formatConfigType(type) {
        const key = `astro.configuration.${type}`;
        const translated = this.t(key);
        return translated === key ? type.replace(/_/g, ' ') : translated;
    }

    renderBalances(balances, cosmogramPattern) {
        if (!this.balancesContainer) return;

        let html = '';

        // Космограмма
        if (cosmogramPattern) {
            html += `
                <div class="balance-section">
                    <div class="balance-title">${this.t('page.chart.balances.cosmogramTitle')}</div>
                    <div class="config-card">
                        <h4>${this.formatPatternType(cosmogramPattern.pattern_type)}</h4>
                        <p>${this.t('page.chart.balances.emptyArc', { value: cosmogramPattern.empty_arc_degree.toFixed(0) })}</p>
                        ${cosmogramPattern.handle_planet ? `<p>${this.t('page.chart.balances.handle', { planet: this.planetName(cosmogramPattern.handle_planet) })}</p>` : ''}
                        ${cosmogramPattern.leading_planet ? `<p>${this.t('page.chart.balances.leading', { planet: this.planetName(cosmogramPattern.leading_planet) })}</p>` : ''}
                    </div>
                </div>
            `;
        }

        if (!balances) {
            this.balancesContainer.innerHTML = html || `<p style="color: #6e6e73; text-align: center; padding: 40px;">${this.t('page.chart.empty.noBalances')}</p>`;
            return;
        }

        // Стихии
        if (balances.element_balance) {
            const eb = balances.element_balance;
            const total = eb.fire + eb.earth + eb.air + eb.water;
            html += this.renderBalanceSection(this.t('page.chart.balances.elementsTitle'), [
                { label: this.t('astro.element.Fire'), value: eb.fire, total, colorClass: 'bar-fire' },
                { label: this.t('astro.element.Earth'), value: eb.earth, total, colorClass: 'bar-earth' },
                { label: this.t('astro.element.Air'), value: eb.air, total, colorClass: 'bar-air' },
                { label: this.t('astro.element.Water'), value: eb.water, total, colorClass: 'bar-water' }
            ]);
        }

        // Кресты
        if (balances.mode_balance) {
            const mb = balances.mode_balance;
            const total = mb.cardinal + mb.fixed + mb.mutable;
            html += this.renderBalanceSection(this.t('page.chart.balances.modesTitle'), [
                { label: this.t('astro.mode.short.Cardinal'), value: mb.cardinal, total, color: '#ef4444' },
                { label: this.t('astro.mode.short.Fixed'), value: mb.fixed, total, color: '#f59e0b' },
                { label: this.t('astro.mode.short.Mutable'), value: mb.mutable, total, color: '#22c55e' }
            ]);
        }

        // Полусферы
        if (balances.hemisphere_balance) {
            const hb = balances.hemisphere_balance;
            const nsTotal = hb.northern + hb.southern;
            const ewTotal = hb.eastern + hb.western;
            html += this.renderBalanceSection(this.t('page.chart.balances.hemispheresTitle'), [
                { label: this.t('page.chart.balances.north'), value: hb.northern, total: nsTotal, color: '#3b82f6' },
                { label: this.t('page.chart.balances.south'), value: hb.southern, total: nsTotal, color: '#f97316' },
                { label: this.t('page.chart.balances.east'), value: hb.eastern, total: ewTotal, color: '#8b5cf6' },
                { label: this.t('page.chart.balances.west'), value: hb.western, total: ewTotal, color: '#ec4899' }
            ]);
        }

        // Группы домов
        if (balances.house_group_balance) {
            const hgb = balances.house_group_balance;
            const total = hgb.angular + hgb.succedent + hgb.cadent;
            html += this.renderBalanceSection(this.t('page.chart.balances.houseGroupsTitle'), [
                { label: this.t('page.chart.balances.angular'), value: hgb.angular, total, color: '#6366f1' },
                { label: this.t('page.chart.balances.succedent'), value: hgb.succedent, total, color: '#14b8a6' },
                { label: this.t('page.chart.balances.cadent'), value: hgb.cadent, total, color: '#a855f7' }
            ]);
        }

        this.balancesContainer.innerHTML = html;
    }

    renderBalanceSection(title, items) {
        return `
            <div class="balance-section">
                <div class="balance-title">${title}</div>
                ${items.map(item => {
                    const pct = item.total > 0 ? (item.value / item.total * 100) : 0;
                    const cls = item.colorClass ? `balance-bar ${item.colorClass}` : 'balance-bar';
                    const bgStyle = item.color ? `background: ${item.color};` : '';
                    return `
                        <div class="balance-row">
                            <span class="balance-label">${item.label}</span>
                            <div class="balance-bar-container">
                                <div class="${cls}" style="${bgStyle} width: ${pct}%"></div>
                            </div>
                            <span class="balance-value">${item.value}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    formatPatternType(type) {
        const patternKey = `astro.pattern.${type}`;
        const translated = this.t(patternKey);
        if (translated !== patternKey) return translated;
        return type;
    }
}

window.ChartDataRenderer = ChartDataRenderer;

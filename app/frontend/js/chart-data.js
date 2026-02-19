/**
 * Отображение табличных данных карты (профессиональный формат)
 * Стандарт: ГГ°ММ'СС" для координат
 */

class ChartDataRenderer {
    constructor() {
        this.planetsTable = document.getElementById('planetsTable');
        this.housesTable = document.getElementById('housesTable');
        this.aspectsTable = document.getElementById('aspectsTable');
        this.aspectGridContainer = document.getElementById('aspectGridContainer');
        this.configsContainer = document.getElementById('configurationsContainer');
        this.balancesContainer = document.getElementById('balancesContainer');
        this.dignitiesContainer = document.getElementById('dignitiesContainer');

        // Состояние фильтра аспектов (все включены по умолчанию)
        this.aspectFilterPlanets = new Set();
        this.aspectTypeFilter = 'all'; // 'all', 'major', 'minor'
        this.initAspectsSettings();
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

    // Все планеты/точки для фильтра аспектов
    static ASPECT_FILTER_ITEMS = [
        { id: 'Sun' },
        { id: 'Moon' },
        { id: 'Mercury' },
        { id: 'Venus' },
        { id: 'Mars' },
        { id: 'Jupiter' },
        { id: 'Saturn' },
        { id: 'Uranus' },
        { id: 'Neptune' },
        { id: 'Pluto' },
        { id: 'Chiron' },
        { id: 'Proserpina' },
        { id: 'TrueNode' },
        { id: 'SouthNode' },
        { id: 'BlackMoon' },
        { id: 'WhiteMoon' },
        { id: 'PartOfFortune' }
    ];

    initAspectsSettings() {
        const settingsBtn = document.getElementById('aspectsSettingsBtn');
        const settingsPanel = document.getElementById('aspectsSettingsPanel');
        const togglesContainer = document.getElementById('aspectsPlanetToggles');
        const resetBtn = document.getElementById('aspectsResetBtn');
        const majorBtn = document.getElementById('aspectsMajorBtn');
        const minorBtn = document.getElementById('aspectsMinorBtn');

        if (!settingsBtn || !settingsPanel || !togglesContainer) return;

        // Все планеты включены по умолчанию
        ChartDataRenderer.ASPECT_FILTER_ITEMS.forEach(item => {
            this.aspectFilterPlanets.add(item.id);
        });

        // Генерируем чекбоксы
        togglesContainer.innerHTML = ChartDataRenderer.ASPECT_FILTER_ITEMS.map(item => `
            <label class="aspect-planet-toggle">
                <input type="checkbox" data-planet="${item.id}" checked>
                <span class="symbol">${Symbols.planets[item.id] || ''}</span>
                <span>${this.planetName(item.id)}</span>
            </label>
        `).join('');

        // Переключение панели
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsPanel.classList.toggle('hidden');
        });

        // Обработка чекбоксов
        togglesContainer.addEventListener('change', (e) => {
            if (e.target.type !== 'checkbox') return;
            const planetId = e.target.dataset.planet;
            if (e.target.checked) {
                this.aspectFilterPlanets.add(planetId);
            } else {
                this.aspectFilterPlanets.delete(planetId);
            }
            this.reRenderAspects();
        });

        // Кнопка "Сбросить" — все галочки, все типы аспектов
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.aspectTypeFilter = 'all';
                ChartDataRenderer.ASPECT_FILTER_ITEMS.forEach(item => {
                    this.aspectFilterPlanets.add(item.id);
                });
                this.updatePlanetCheckboxes();
                this.reRenderAspects();
            });
        }

        // Кнопка "Мажорные"
        if (majorBtn) {
            majorBtn.addEventListener('click', () => {
                this.aspectTypeFilter = 'major';
                this.reRenderAspects();
            });
        }

        // Кнопка "Минорные"
        if (minorBtn) {
            minorBtn.addEventListener('click', () => {
                this.aspectTypeFilter = 'minor';
                this.reRenderAspects();
            });
        }

        // Закрытие при клике вне панели
        document.addEventListener('click', (e) => {
            if (!settingsPanel.contains(e.target) && e.target !== settingsBtn) {
                settingsPanel.classList.add('hidden');
            }
        });
    }

    updatePlanetCheckboxes() {
        const togglesContainer = document.getElementById('aspectsPlanetToggles');
        if (!togglesContainer) return;
        togglesContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = this.aspectFilterPlanets.has(cb.dataset.planet);
        });
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
            return `
                <tr id="row-${p.name}" data-planet="${p.name}">
                    <td class="symbol-cell">
                        ${planetIcon}
                        ${p.retrograde ? '<span class="retro-badge-small">Rx</span>' : ''}
                    </td>
                    <td class="mono"><span class="astro-symbol">${Symbols.signs[p.sign]}</span> ${degDMS}</td>
                    <td class="mono">${p.house}</td>
                </tr>
            `;
        }).join('');
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
        const color = Symbols.elementColors[element] || '#374151';
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

    renderAspects(aspects) {
        if (!aspects || !this.aspectsTable) return;

        // Фильтруем по включённым планетам
        let filtered = aspects.filter(a =>
            this.aspectFilterPlanets.has(a.planet_1) &&
            this.aspectFilterPlanets.has(a.planet_2)
        );

        // Фильтруем по типу аспектов (мажорные/минорные)
        if (this.aspectTypeFilter === 'major') {
            filtered = filtered.filter(a => a.is_major);
        } else if (this.aspectTypeFilter === 'minor') {
            filtered = filtered.filter(a => !a.is_major);
        }

        // Сортируем: сначала мажорные, потом по орбису
        const sorted = [...filtered].sort((a, b) => {
            if (a.is_major !== b.is_major) return b.is_major - a.is_major;
            return a.orb - b.orb;
        });

        // Профессиональный формат с орбисом
        this.aspectsTable.innerHTML = sorted.map(a => {
            const typeClass = a.harmonic_type === 'harmonious' ? 'aspect-harmonious'
                            : a.harmonic_type === 'tense' ? 'aspect-tense'
                            : 'aspect-neutral';
            return `
                <tr data-aspect="${a.planet_1}-${a.planet_2}">
                    <td class="symbol-cell"><span class="astro-symbol">${Symbols.planets[a.planet_1] || ''}</span></td>
                    <td class="symbol-cell"><span class="astro-symbol">${Symbols.planets[a.planet_2] || ''}</span></td>
                    <td class="${typeClass}"><span class="astro-symbol">${Symbols.aspects[a.aspect_type] || ''}</span> ${this.aspectName(a.aspect_type)}</td>
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

        // Все планеты и точки с которыми строятся аспекты (в правильном порядке)
        const gridPlanets = [
            'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
            'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
            'Chiron', 'Proserpina', 'TrueNode', 'SouthNode',
            'BlackMoon', 'WhiteMoon', 'PartOfFortune'
        ];
        const filtered = planets.filter(p => gridPlanets.includes(p.name))
                                .sort((a, b) => gridPlanets.indexOf(a.name) - gridPlanets.indexOf(b.name));

        // Карта аспектов
        const aspectMap = {};
        aspects.forEach(a => {
            const key1 = `${a.planet_1}-${a.planet_2}`;
            const key2 = `${a.planet_2}-${a.planet_1}`;
            aspectMap[key1] = aspectMap[key2] = a;
        });

        let html = '<table class="aspect-grid">';

        // Заголовок
        html += '<tr><th></th>';
        filtered.forEach(p => {
            html += `<th title="${this.planetName(p.name)}"><span class="astro-symbol">${Symbols.planets[p.name]}</span></th>`;
        });
        html += '</tr>';

        // Строки (треугольная матрица)
        filtered.forEach((rowPlanet, rowIdx) => {
            html += `<tr><th title="${this.planetName(rowPlanet.name)}"><span class="astro-symbol">${Symbols.planets[rowPlanet.name]}</span></th>`;

            filtered.forEach((colPlanet, colIdx) => {
                if (colIdx >= rowIdx) {
                    html += '<td></td>';
                } else {
                    const aspect = aspectMap[`${rowPlanet.name}-${colPlanet.name}`];
                    if (aspect) {
                        const glyph = ChartDataRenderer.ASPECT_GLYPHS[aspect.aspect_type] || '•';
                        const cls = aspect.harmonic_type === 'harmonious' ? 'grid-harmonious'
                                  : aspect.harmonic_type === 'tense' ? 'grid-tense'
                                  : 'grid-neutral';
                        html += `<td class="${cls}" title="${this.aspectName(aspect.aspect_type)} ${aspect.orb.toFixed(1)}°"><span class="astro-symbol">${glyph}</span></td>`;
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

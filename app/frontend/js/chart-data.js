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

        // Профессиональный формат: Симв. | Объект | Знак ГГ°ММ'СС" | Дом
        this.planetsTable.innerHTML = sorted.map(p => {
            const degDMS = this.formatDMS(p.degree_in_sign);
            return `
                <tr id="row-${p.name}" data-planet="${p.name}">
                    <td class="symbol-cell">${Symbols.planets[p.name] || ''}</td>
                    <td>
                        <strong>${Symbols.planetNamesRu[p.name] || p.name}</strong>
                        ${p.retrograde ? '<span class="retro-badge">Rx</span>' : ''}
                    </td>
                    <td class="mono">${Symbols.signs[p.sign]} ${degDMS}</td>
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
                <tr class="${isAngular ? 'house-angular' : ''}">
                    <td class="mono">${h.number}${isAngular ? ' ★' : ''}</td>
                    <td class="mono">${Symbols.signs[h.sign]} ${degDMS}</td>
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

    formatDegreeShort(deg) {
        const d = Math.floor(deg);
        const m = Math.floor((deg - d) * 60);
        return `${d}°${m.toString().padStart(2, '0')}'`;
    }

    renderAspects(aspects) {
        if (!aspects || !this.aspectsTable) return;

        // Сортируем: сначала мажорные, потом по орбису
        const sorted = [...aspects].sort((a, b) => {
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
                    <td class="symbol-cell">${Symbols.planets[a.planet_1] || ''}</td>
                    <td class="symbol-cell">${Symbols.planets[a.planet_2] || ''}</td>
                    <td class="${typeClass}">${Symbols.aspects[a.aspect_type] || ''} ${Symbols.aspectNamesRu[a.aspect_type] || a.aspect_type}</td>
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
            html += `<th title="${Symbols.planetNamesRu[p.name]}">${Symbols.planets[p.name]}</th>`;
        });
        html += '</tr>';

        // Строки (треугольная матрица)
        filtered.forEach((rowPlanet, rowIdx) => {
            html += `<tr><th title="${Symbols.planetNamesRu[rowPlanet.name]}">${Symbols.planets[rowPlanet.name]}</th>`;

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
                        html += `<td class="${cls}" title="${Symbols.aspectNamesRu[aspect.aspect_type]} ${aspect.orb.toFixed(1)}°">${glyph}</td>`;
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
            'domicile': { label: 'Обитель', class: 'dignity-domicile', icon: '🏠' },
            'exaltation': { label: 'Экзальтация', class: 'dignity-exaltation', icon: '⬆' },
            'detriment': { label: 'Изгнание', class: 'dignity-detriment', icon: '⬇' },
            'fall': { label: 'Падение', class: 'dignity-fall', icon: '💫' },
            'neutral': { label: '', class: '', icon: '' }
        };

        const withDignity = planets.filter(p => p.dignity && p.dignity !== 'neutral');

        if (withDignity.length === 0) {
            this.dignitiesContainer.innerHTML = '<p class="text-muted">Нет планет в достоинствах/слабостях</p>';
            return;
        }

        let html = '<div class="dignities-list">';
        withDignity.forEach(p => {
            const d = dignityLabels[p.dignity] || dignityLabels.neutral;
            html += `
                <div class="dignity-item ${d.class}">
                    <span class="dignity-planet">${Symbols.planets[p.name]} ${Symbols.planetNamesRu[p.name]}</span>
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
        
        // Конфигурации
        if (configurations && configurations.length > 0) {
            html += '<h3 style="margin-bottom: 12px; font-size: 15px;">Аспектные конфигурации</h3>';
            html += configurations.map(c => `
                <div class="config-card">
                    <h4>
                        ${Symbols.configIcons[c.type] || '◆'} 
                        ${this.formatConfigType(c.type)}
                    </h4>
                    ${c.apex_planet ? `<p>Апекс: ${Symbols.planetNamesRu[c.apex_planet] || c.apex_planet}</p>` : ''}
                    <p>Сила: ${c.strength_score.toFixed(1)}</p>
                    <div class="config-planets">
                        ${c.planets_involved.map(p => `
                            <span class="planet-tag">
                                ${Symbols.planets[p] || ''} ${Symbols.planetNamesRu[p] || p}
                            </span>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        }
        
        // Стеллиумы
        if (stelliums && stelliums.length > 0) {
            html += '<h3 style="margin: 20px 0 12px; font-size: 15px;">Стеллиумы</h3>';
            html += stelliums.map(s => `
                <div class="config-card">
                    <h4>
                        ⭐ ${s.type === 'house' ? `${s.house_number} дом` : Symbols.signNamesRu[s.sign] || s.sign}
                    </h4>
                    <p>${s.count} планет</p>
                    <div class="config-planets">
                        ${s.planets.map(p => `
                            <span class="planet-tag">
                                ${Symbols.planets[p] || ''} ${Symbols.planetNamesRu[p] || p}
                            </span>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        }
        
        if (!html) {
            html = '<p style="color: #6e6e73; text-align: center; padding: 40px;">Нет значимых конфигураций</p>';
        }
        
        this.configsContainer.innerHTML = html;
    }

    formatConfigType(type) {
        const names = {
            'T_Square': 'Тау-квадрат',
            'Grand_Trine': 'Большой трин',
            'Grand_Cross': 'Большой крест',
            'Yod': 'Йод (Перст Судьбы)',
            'Mystic_Rectangle': 'Мистический прямоугольник',
            'Kite': 'Воздушный змей',
            'Star_of_David': 'Звезда Давида'
        };
        return names[type] || type.replace(/_/g, ' ');
    }

    renderBalances(balances, cosmogramPattern) {
        if (!this.balancesContainer) return;

        let html = '';

        // Космограмма
        if (cosmogramPattern) {
            html += `
                <div class="balance-section">
                    <div class="balance-title">🪐 Космограмма (паттерн Джонса)</div>
                    <div class="config-card">
                        <h4>${this.formatPatternType(cosmogramPattern.pattern_type)}</h4>
                        <p>Пустая дуга: ${cosmogramPattern.empty_arc_degree.toFixed(0)}°</p>
                        ${cosmogramPattern.handle_planet ? `<p>Ручка: ${Symbols.planetNamesRu[cosmogramPattern.handle_planet] || cosmogramPattern.handle_planet}</p>` : ''}
                        ${cosmogramPattern.leading_planet ? `<p>Ведущая: ${Symbols.planetNamesRu[cosmogramPattern.leading_planet] || cosmogramPattern.leading_planet}</p>` : ''}
                    </div>
                </div>
            `;
        }

        if (!balances) {
            this.balancesContainer.innerHTML = html || '<p style="color: #6e6e73; text-align: center; padding: 40px;">Нет данных о балансах</p>';
            return;
        }

        // Стихии
        if (balances.element_balance) {
            const eb = balances.element_balance;
            const total = eb.fire + eb.earth + eb.air + eb.water;
            html += this.renderBalanceSection('🔥 Стихии', [
                { label: 'Огонь', value: eb.fire, total, colorClass: 'bar-fire' },
                { label: 'Земля', value: eb.earth, total, colorClass: 'bar-earth' },
                { label: 'Воздух', value: eb.air, total, colorClass: 'bar-air' },
                { label: 'Вода', value: eb.water, total, colorClass: 'bar-water' }
            ]);
        }

        // Кресты
        if (balances.mode_balance) {
            const mb = balances.mode_balance;
            const total = mb.cardinal + mb.fixed + mb.mutable;
            html += this.renderBalanceSection('✚ Кресты', [
                { label: 'Кардин.', value: mb.cardinal, total, color: '#ef4444' },
                { label: 'Фиксир.', value: mb.fixed, total, color: '#f59e0b' },
                { label: 'Мутабел.', value: mb.mutable, total, color: '#22c55e' }
            ]);
        }

        // Полусферы
        if (balances.hemisphere_balance) {
            const hb = balances.hemisphere_balance;
            const nsTotal = hb.northern + hb.southern;
            const ewTotal = hb.eastern + hb.western;
            html += this.renderBalanceSection('🧭 Полусферы', [
                { label: 'Север', value: hb.northern, total: nsTotal, color: '#3b82f6' },
                { label: 'Юг', value: hb.southern, total: nsTotal, color: '#f97316' },
                { label: 'Восток', value: hb.eastern, total: ewTotal, color: '#8b5cf6' },
                { label: 'Запад', value: hb.western, total: ewTotal, color: '#ec4899' }
            ]);
        }

        // Группы домов
        if (balances.house_group_balance) {
            const hgb = balances.house_group_balance;
            const total = hgb.angular + hgb.succedent + hgb.cadent;
            html += this.renderBalanceSection('🏠 Группы домов', [
                { label: 'Угловые', value: hgb.angular, total, color: '#6366f1' },
                { label: 'Последующ.', value: hgb.succedent, total, color: '#14b8a6' },
                { label: 'Падающие', value: hgb.cadent, total, color: '#a855f7' }
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
        const names = {
            'Bowl': '🥣 Чаша (Bowl)',
            'Bucket': '🪣 Ведро (Bucket)',
            'Locomotive': '🚂 Локомотив',
            'Bundle': '📦 Связка (Bundle)',
            'Splash': '💦 Брызги (Splash)',
            'Splay': '🌟 Веер (Splay)',
            'Seesaw': '⚖️ Качели (Seesaw)'
        };
        return names[type] || type;
    }
}

window.ChartDataRenderer = ChartDataRenderer;


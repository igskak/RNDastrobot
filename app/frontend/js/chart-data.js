/**
 * Отображение табличных данных карты
 */

class ChartDataRenderer {
    constructor() {
        this.planetsTable = document.getElementById('planetsTable');
        this.housesTable = document.getElementById('housesTable');
        this.aspectsTable = document.getElementById('aspectsTable');
        this.configsContainer = document.getElementById('configurationsContainer');
        this.balancesContainer = document.getElementById('balancesContainer');
    }

    /**
     * Отрисовка всех данных
     */
    render(chartData) {
        this.renderPlanets(chartData.planets);
        this.renderHouses(chartData.houses);
        this.renderAspects(chartData.aspects);
        this.renderConfigurations(chartData.aspect_configurations, chartData.stelliums);
        this.renderBalances(chartData.balances, chartData.cosmogram_pattern);
    }

    // Порядок планет и точек
    static PLANET_ORDER = [
        'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
        'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
        'TrueNode', 'SouthNode', 'Lilith', 'Selena', 'Proserpina', 'Chiron',
        'PartOfFortune'
    ];

    renderPlanets(planets) {
        if (!planets || !this.planetsTable) return;

        // Сортируем по заданному порядку
        const sorted = [...planets].sort((a, b) => {
            const iA = ChartDataRenderer.PLANET_ORDER.indexOf(a.name);
            const iB = ChartDataRenderer.PLANET_ORDER.indexOf(b.name);
            // Если нет в списке — в конец
            return (iA === -1 ? 999 : iA) - (iB === -1 ? 999 : iB);
        });

        // Формат как в Natal_visualisation: Симв., Объект, Знак (с градусом), Дом
        this.planetsTable.innerHTML = sorted.map(p => {
            const degFormatted = p.degree_in_sign_formatted || this.formatDegreeInSign(p.degree_in_sign);
            return `
                <tr id="row-${p.name}" data-planet="${p.name}">
                    <td class="symbol-cell">${Symbols.planets[p.name] || ''}</td>
                    <td>
                        <strong>${Symbols.planetNamesRu[p.name] || p.name}</strong>
                        ${p.retrograde ? '<span class="retro-badge">R</span>' : ''}
                    </td>
                    <td>${Symbols.signs[p.sign] || ''} ${degFormatted}</td>
                    <td class="mono">${p.house}</td>
                </tr>
            `;
        }).join('');
    }

    renderHouses(houses) {
        if (!houses || !this.housesTable) return;

        this.housesTable.innerHTML = houses.map(h => {
            const isAngular = [1, 4, 7, 10].includes(h.number);
            return `
                <tr class="${isAngular ? 'house-angular' : ''}">
                    <td class="mono">${h.number}${isAngular ? ' ★' : ''}</td>
                    <td>
                        ${Symbols.signs[h.sign] || ''} ${Symbols.signNamesRu[h.sign] || h.sign}
                    </td>
                    <td class="mono">${this.formatDegreeInSign(h.degree_in_sign)}</td>
                    <td class="mono">${this.formatLongitude(h.longitude)}</td>
                </tr>
            `;
        }).join('');
    }

    formatDegreeInSign(deg) {
        const d = Math.floor(deg);
        const m = Math.floor((deg - d) * 60);
        return `${d}°${m.toString().padStart(2, '0')}'`;
    }

    formatLongitude(lon) {
        const d = Math.floor(lon);
        const m = Math.floor((lon - d) * 60);
        const s = Math.floor(((lon - d) * 60 - m) * 60);
        return `${d}°${m.toString().padStart(2, '0')}'${s.toString().padStart(2, '0')}"`;
    }

    renderAspects(aspects) {
        if (!aspects || !this.aspectsTable) return;

        // Сортируем: сначала мажорные, потом по орбису
        const sorted = [...aspects].sort((a, b) => {
            if (a.is_major !== b.is_major) return b.is_major - a.is_major;
            return a.orb - b.orb;
        });

        // Компактный формат: Планета1 ↔ Планета2 | Тип | Орбис
        this.aspectsTable.innerHTML = sorted.map(a => {
            const typeClass = a.harmonic_type === 'harmonious' ? 'aspect-harmonious'
                            : a.harmonic_type === 'tense' ? 'aspect-tense'
                            : 'aspect-neutral';
            return `
                <tr>
                    <td class="symbol-cell">${Symbols.planets[a.planet_1] || ''}</td>
                    <td class="symbol-cell">${Symbols.planets[a.planet_2] || ''}</td>
                    <td class="${typeClass}">${Symbols.aspects[a.aspect_type] || ''} ${Symbols.aspectNamesRu[a.aspect_type] || a.aspect_type}</td>
                    <td class="mono">${a.orb.toFixed(1)}°</td>
                </tr>
            `;
        }).join('');
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


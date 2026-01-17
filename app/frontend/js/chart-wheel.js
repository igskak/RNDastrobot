/**
 * Отрисовка профессиональной круговой натальной карты (SVG)
 * Best Practices: ZET, Solar Fire, Astro-Seek standards
 */

class ChartWheel {
    constructor(svgElement) {
        this.svg = svgElement;
        this.center = 250;
        this.outerRadius = 230;

        // Двойное кольцо: градусная сетка + символы знаков
        this.degreeRingWidth = 10;       // Внешнее кольцо с градусами
        this.signRingWidth = 26;         // Кольцо символов знаков
        this.houseRingWidth = 40;        // Кольцо домов
        this.planetRadius = 158;         // Радиус планет (на линии домов)
        this.aspectRadius = 145;         // Радиус аспектных линий (почти до кольца домов)

        // Цвета аспектов по типу
        this.aspectColors = {
            'Conjunction': '#f59e0b',     // Оранжевый — соединение
            'Opposition': '#ef4444',       // Красный — оппозиция
            'Square': '#ef4444',           // Красный — квадрат
            'Trine': '#3b82f6',            // Синий — трин
            'Sextile': '#22c55e',          // Зелёный — секстиль
            'Quincunx': '#8b5cf6',         // Фиолетовый — квиконс
            'Semisextile': '#14b8a6',      // Бирюзовый — полусекстиль
            'Quintile': '#ec4899',         // Розовый — квинтиль
            'Biquintile': '#ec4899',
            'Semisquare': '#f97316'        // Оранжево-красный — полуквадрат
        };

        // Мажорные vs минорные аспекты
        this.majorAspects = ['Conjunction', 'Opposition', 'Trine', 'Square', 'Sextile'];

        // Цвета стихий
        this.elementColors = {
            'Fire': '#ef4444',
            'Earth': '#22c55e',
            'Air': '#eab308',
            'Water': '#3b82f6'
        };

        // Интерактивность
        this.hoveredAspect = null;
        this.selectedPlanet = null;

        // Фильтры аспектов
        this.aspectFilter = 'all'; // 'all', 'major', 'minor'
    }

    /**
     * Преобразование эклиптической долготы в угол на карте
     * ASC слева (180°), долготы идут против часовой стрелки
     */
    longitudeToAngle(longitude) {
        const ascendant = this.chartData.angles?.ASC?.longitude || 0;
        let angle = 180 - (longitude - ascendant);
        // Нормализация к диапазону 0-360°
        while (angle < 0) angle += 360;
        while (angle >= 360) angle -= 360;
        return angle;
    }

    /**
     * Отрисовка полной карты
     */
    draw(chartData) {
        this.svg.innerHTML = '';
        this.chartData = chartData;

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

        // 12 секторов знаков (против часовой стрелки)
        // ASC должен быть слева (180°), поэтому знаки вращаются относительно ASC
        for (let i = 0; i < 12; i++) {
            // Эклиптическая долгота знака (Овен 0-30°, Телец 30-60° и т.д.)
            const signStartLong = i * 30;
            const signEndLong = signStartLong + 30;

            // Преобразуем в углы на карте
            const signStartAngle = this.longitudeToAngle(signStartLong);
            const signEndAngle = this.longitudeToAngle(signEndLong);

            const sign = this.getSignByIndex(i);
            const element = Symbols.signElements[sign];
            const color = this.elementColors[element] || '#6b7280';

            // Сектор с цветом стихии
            // signEndAngle < signStartAngle (т.к. долготы растут против часовой)
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
                fill: color
            }, Symbols.signs[sign]));
        }
    }

    drawHouses(houses) {
        const signOuterR = this.outerRadius - this.degreeRingWidth;
        const signInnerR = signOuterR - this.signRingWidth;
        const houseInnerR = signInnerR - this.houseRingWidth;

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

            // Угловые дома — линия выходит к центру
            const lineInnerR = isAngular ? this.aspectRadius : houseInnerR;

            this.layers.houses.appendChild(this.createSvgElement('line', {
                x1: this.center + lineInnerR * Math.cos(angle),
                y1: this.center + lineInnerR * Math.sin(angle),
                x2: this.center + signInnerR * Math.cos(angle),
                y2: this.center + signInnerR * Math.sin(angle),
                stroke: isAngular ? '#6366f1' : '#c7d2db',
                'stroke-width': isAngular ? 2.5 : 1
            }));

            // Номер дома в секторе (дома идут против часовой: 1→2→3→...→12)
            // Дом N занимает сектор от куспида N до куспида N+1 (против часовой)
            const nextHouse = houses[(idx + 1) % 12];
            // Середина сектора: от house.longitude против часовой к nextHouse.longitude
            let midLong = (house.longitude + nextHouse.longitude) / 2;
            if (nextHouse.longitude < house.longitude) {
                midLong = ((house.longitude + nextHouse.longitude + 360) / 2) % 360;
            }
            const midAngle = this.longitudeToAngle(midLong) * Math.PI / 180;
            const textR = houseInnerR + this.houseRingWidth / 2;

            this.layers.houses.appendChild(this.createSvgElement('text', {
                x: this.center + textR * Math.cos(midAngle),
                y: this.center + textR * Math.sin(midAngle) + 4,
                'text-anchor': 'middle',
                'font-size': '10',
                'font-weight': isAngular ? '700' : '400',
                fill: isAngular ? '#6366f1' : '#9ca3af'
            }, house.number.toString()));
        });
    }

    drawAspectCircle() {
        // Внутренний пунктирный круг для аспектов
        this.layers.aspects.appendChild(this.createSvgElement('circle', {
            cx: this.center,
            cy: this.center,
            r: this.aspectRadius,
            fill: 'none',
            stroke: '#e5e7eb',
            'stroke-width': 1,
            'stroke-dasharray': '3,3'
        }));
    }

    /**
     * Улучшенная отрисовка аспектов:
     * - Цвет по типу аспекта
     * - Сплошные для мажорных, пунктир для минорных
     * - Толщина зависит от орбиса (более тонкие линии)
     * - Иконки аспектов на середине линии
     */
    drawAspectsEnhanced(aspects, planets) {
        const planetMap = {};
        planets.forEach(p => planetMap[p.name] = p.longitude);

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
            const long1 = planetMap[aspect.planet_1];
            const long2 = planetMap[aspect.planet_2];
            if (long1 === undefined || long2 === undefined) return;

            // Мажорные — сплошные, минорные — пунктир
            const isMajor = this.majorAspects.includes(aspect.aspect_type);

            // Фильтрация по типу аспекта
            if (this.aspectFilter === 'major' && !isMajor) return;
            if (this.aspectFilter === 'minor' && isMajor) return;

            const angle1 = this.longitudeToAngle(long1) * Math.PI / 180;
            const angle2 = this.longitudeToAngle(long2) * Math.PI / 180;

            const x1 = this.center + this.aspectRadius * Math.cos(angle1);
            const y1 = this.center + this.aspectRadius * Math.sin(angle1);
            const x2 = this.center + this.aspectRadius * Math.cos(angle2);
            const y2 = this.center + this.aspectRadius * Math.sin(angle2);

            // Цвет по типу аспекта
            const color = this.aspectColors[aspect.aspect_type] || '#9ca3af';

            // Толщина: более тонкие линии (0° → 1.5px, 10° → 0.3px)
            const maxOrb = 12;
            const thickness = Math.max(0.3, 1.5 - (aspect.orb / maxOrb) * 1.2);

            const dashArray = isMajor ? 'none' : '3,2';

            const line = this.createSvgElement('line', {
                x1, y1, x2, y2,
                stroke: color,
                'stroke-width': thickness,
                'stroke-dasharray': dashArray,
                opacity: isMajor ? 0.7 : 0.45,
                class: 'aspect-line',
                'data-aspect': `${aspect.planet_1}-${aspect.planet_2}`,
                'data-type': aspect.aspect_type,
                'data-major': isMajor ? 'true' : 'false'
            });

            this.layers.aspects.appendChild(line);

            // Иконка аспекта на середине линии (только для мажорных с орбисом < 5°)
            if (isMajor && aspect.orb < 5) {
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;
                const glyph = aspectGlyphs[aspect.aspect_type];

                if (glyph) {
                    // Фон для иконки
                    this.layers.aspects.appendChild(this.createSvgElement('circle', {
                        cx: midX, cy: midY, r: 6,
                        fill: 'white',
                        stroke: color,
                        'stroke-width': 0.5,
                        opacity: 0.9
                    }));

                    // Иконка
                    this.layers.aspects.appendChild(this.createSvgElement('text', {
                        x: midX, y: midY + 3,
                        'text-anchor': 'middle',
                        'font-size': '8',
                        fill: color,
                        style: 'pointer-events: none;'
                    }, glyph));
                }
            }
        });
    }

    /**
     * Улучшенная отрисовка планет с anti-collision (radial offsets)
     */
    drawPlanetsEnhanced(planets) {
        const positions = this.calculatePlanetPositionsEnhanced(planets);

        positions.forEach(({ planet, displayAngle, radiusOffset }) => {
            const angle = displayAngle * Math.PI / 180;
            const r = this.planetRadius + radiusOffset;
            const x = this.center + r * Math.cos(angle);
            const y = this.center + r * Math.sin(angle);
            const element = Symbols.signElements[planet.sign];
            const color = this.elementColors[element] || '#374151';

            // Группа для интерактивности
            const group = this.createSvgElement('g', {
                class: 'planet-group',
                'data-planet': planet.name,
                style: 'cursor: pointer;'
            });

            // Выноска (линия от реальной позиции к отображаемой)
            const realAngleCalc = this.longitudeToAngle(planet.longitude);
            if (radiusOffset !== 0 || displayAngle !== realAngleCalc) {
                const realAngle = realAngleCalc * Math.PI / 180;
                const realX = this.center + this.planetRadius * Math.cos(realAngle);
                const realY = this.center + this.planetRadius * Math.sin(realAngle);
                group.appendChild(this.createSvgElement('line', {
                    x1: realX, y1: realY,
                    x2: x, y2: y,
                    stroke: '#d1d5db',
                    'stroke-width': 0.5,
                    'stroke-dasharray': '2,2'
                }));
            }

            // Фоновый круг (прозрачный, для интерактивности)
            group.appendChild(this.createSvgElement('circle', {
                cx: x, cy: y, r: 10,
                fill: 'transparent',
                class: 'planet-circle'
            }));

            // Символ планеты (увеличен размер)
            group.appendChild(this.createSvgElement('text', {
                x: x, y: y + 5,
                'text-anchor': 'middle',
                'font-size': '15',
                'font-weight': '600',
                fill: color,
                class: 'planet-symbol-text',
                style: 'pointer-events: none;'
            }, Symbols.planets[planet.name] || planet.name.charAt(0)));

            // Ретроградность — «Rx» (компактно, справа сверху от символа)
            if (planet.retrograde) {
                group.appendChild(this.createSvgElement('text', {
                    x: x + 8, y: y - 4,
                    'font-size': '8',
                    'font-weight': '700',
                    fill: '#dc2626',
                    style: 'pointer-events: none;'
                }, 'Rx'));
            }

            this.layers.planets.appendChild(group);
        });
    }

    /**
     * Anti-collision: радиальные и угловые смещения для тесных соединений
     */
    calculatePlanetPositionsEnhanced(planets) {
        const minAngularGap = 8;  // Минимальный угол между глифами
        const radialStep = 12;     // Шаг радиального смещения

        const sorted = planets
            .map(p => ({
                planet: p,
                originalAngle: this.longitudeToAngle(p.longitude),
                displayAngle: this.longitudeToAngle(p.longitude),
                radiusOffset: 0
            }))
            .sort((a, b) => a.originalAngle - b.originalAngle);

        // Проход: разводим по углу или радиусу
        for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            const curr = sorted[i];
            let diff = curr.displayAngle - prev.displayAngle;
            if (diff < 0) diff += 360;

            if (diff < minAngularGap) {
                // Если очень близко (<2°) — смещаем радиально
                if (diff < 2) {
                    curr.radiusOffset = prev.radiusOffset === 0 ? radialStep : -radialStep;
                } else {
                    // Иначе разводим по углу
                    curr.displayAngle = prev.displayAngle + minAngularGap;
                }
            }
        }

        return sorted;
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
            this.drawAngleMarkerEnhanced(ascAngle, signInnerR, 'ASC', '#6366f1');
        }

        // MC — вертикальная линия сверху
        if (angles.MC) {
            const mcAngle = this.longitudeToAngle(angles.MC.longitude) * Math.PI / 180;
            this.drawAngleMarkerEnhanced(mcAngle, signInnerR, 'MC', '#6366f1');
        }

        // DSC — напротив ASC
        if (angles.DSC) {
            const dscAngle = this.longitudeToAngle(angles.DSC.longitude) * Math.PI / 180;
            this.drawAngleMarkerEnhanced(dscAngle, signInnerR, 'DSC', '#9ca3af');
        }

        // IC — напротив MC
        if (angles.IC) {
            const icAngle = this.longitudeToAngle(angles.IC.longitude) * Math.PI / 180;
            this.drawAngleMarkerEnhanced(icAngle, signInnerR, 'IC', '#9ca3af');
        }
    }

    drawAngleMarkerEnhanced(angle, radius, label, color) {
        const outerR = this.outerRadius + 8;

        // Линия выносная за пределы круга
        this.layers.angles.appendChild(this.createSvgElement('line', {
            x1: this.center + this.aspectRadius * Math.cos(angle),
            y1: this.center + this.aspectRadius * Math.sin(angle),
            x2: this.center + outerR * Math.cos(angle),
            y2: this.center + outerR * Math.sin(angle),
            stroke: color,
            'stroke-width': label === 'ASC' || label === 'MC' ? 2.5 : 1.5
        }));

        // Подпись за кругом
        const labelR = outerR + 10;
        this.layers.labels.appendChild(this.createSvgElement('text', {
            x: this.center + labelR * Math.cos(angle),
            y: this.center + labelR * Math.sin(angle) + 4,
            'text-anchor': 'middle',
            'font-size': '10',
            'font-weight': '700',
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
     * Привязка интерактивных событий
     */
    bindEvents() {
        // Hover на планетах — подсветка аспектов
        this.svg.querySelectorAll('.planet-group').forEach(group => {
            group.addEventListener('mouseenter', (e) => this.onPlanetHover(e, true));
            group.addEventListener('mouseleave', (e) => this.onPlanetHover(e, false));
            group.addEventListener('click', (e) => this.onPlanetClick(e));
        });

        // Hover на аспектах
        this.svg.querySelectorAll('.aspect-line').forEach(line => {
            line.addEventListener('mouseenter', (e) => this.onAspectHover(e, true));
            line.addEventListener('mouseleave', (e) => this.onAspectHover(e, false));
        });
    }

    onPlanetHover(e, isEnter) {
        const planetName = e.currentTarget.dataset.planet;

        // Подсветка символа планеты - делаем жирным
        const symbolText = e.currentTarget.querySelector('.planet-symbol-text');
        if (symbolText) {
            symbolText.setAttribute('font-weight', isEnter ? '900' : '600');
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

        // Показываем тултип с данными
        const tooltip = document.getElementById('tooltip');
        if (tooltip) {
            const degFormatted = this.formatDMS(planet.degree_in_sign);
            tooltip.innerHTML = `
                <strong>${Symbols.planets[planetName]} ${Symbols.planetNamesRu[planetName]}</strong><br>
                ${Symbols.signs[planet.sign]} ${Symbols.signNamesRu[planet.sign]} ${degFormatted}<br>
                Дом: ${planet.house}${planet.retrograde ? ' <span style="color:#dc2626">Rx</span>' : ''}
            `;

            // Позиция тултипа
            const rect = this.svg.getBoundingClientRect();
            tooltip.style.left = (e.clientX - rect.left + 10) + 'px';
            tooltip.style.top = (e.clientY - rect.top - 10) + 'px';
            tooltip.style.display = 'block';

            // Скрываем через 3 сек
            setTimeout(() => { tooltip.style.display = 'none'; }, 3000);
        }
    }

    onAspectHover(e, isEnter) {
        const aspect = e.currentTarget.dataset.aspect;
        if (!aspect) return;

        const [p1, p2] = aspect.split('-');

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


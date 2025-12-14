/**
 * Отрисовка круговой натальной карты (SVG)
 */

class ChartWheel {
    constructor(svgElement) {
        this.svg = svgElement;
        this.center = 250;
        this.outerRadius = 230;
        this.signRingWidth = 35;
        this.houseRingWidth = 80;
        this.planetRadius = 140;
    }

    /**
     * Отрисовка полной карты
     */
    draw(chartData) {
        this.svg.innerHTML = '';
        
        // Фоновый круг
        this.drawBackground();
        
        // Кольцо знаков зодиака
        this.drawSignRing();
        
        // Линии домов
        this.drawHouses(chartData.houses);
        
        // Центральный круг для аспектов
        this.drawAspectCircle();
        
        // Аспекты
        if (chartData.aspects) {
            this.drawAspects(chartData.aspects, chartData.planets);
        }
        
        // Планеты
        this.drawPlanets(chartData.planets);
        
        // Углы (ASC, MC)
        this.drawAngles(chartData.angles);
    }

    drawBackground() {
        const circle = this.createSvgElement('circle', {
            cx: this.center,
            cy: this.center,
            r: this.outerRadius,
            fill: '#fafafa',
            stroke: '#e5e5e7',
            'stroke-width': 1
        });
        this.svg.appendChild(circle);
    }

    drawSignRing() {
        const innerR = this.outerRadius - this.signRingWidth;
        
        // Внутренняя граница кольца знаков
        const innerCircle = this.createSvgElement('circle', {
            cx: this.center,
            cy: this.center,
            r: innerR,
            fill: 'white',
            stroke: '#e5e5e7',
            'stroke-width': 1
        });
        this.svg.appendChild(innerCircle);

        // 12 секторов знаков
        for (let i = 0; i < 12; i++) {
            const startAngle = i * 30 - 90; // Начинаем с Овна сверху
            const sign = this.getSignByIndex(i);
            const element = Symbols.signElements[sign];
            const color = Symbols.elementColors[element];
            
            // Сектор знака
            this.drawArc(this.outerRadius, innerR, startAngle, startAngle + 30, color + '15');
            
            // Разделительная линия
            const lineAngle = startAngle * Math.PI / 180;
            this.svg.appendChild(this.createSvgElement('line', {
                x1: this.center + innerR * Math.cos(lineAngle),
                y1: this.center + innerR * Math.sin(lineAngle),
                x2: this.center + this.outerRadius * Math.cos(lineAngle),
                y2: this.center + this.outerRadius * Math.sin(lineAngle),
                stroke: '#e5e5e7',
                'stroke-width': 1
            }));
            
            // Символ знака
            const midAngle = (startAngle + 15) * Math.PI / 180;
            const textR = innerR + this.signRingWidth / 2;
            this.svg.appendChild(this.createSvgElement('text', {
                x: this.center + textR * Math.cos(midAngle),
                y: this.center + textR * Math.sin(midAngle) + 5,
                'text-anchor': 'middle',
                'font-size': '14',
                fill: color
            }, Symbols.signs[sign]));
        }
    }

    drawHouses(houses) {
        const innerR = this.outerRadius - this.signRingWidth;
        const houseInnerR = innerR - this.houseRingWidth;
        
        // Круг домов
        this.svg.appendChild(this.createSvgElement('circle', {
            cx: this.center,
            cy: this.center,
            r: houseInnerR,
            fill: 'white',
            stroke: '#e5e5e7',
            'stroke-width': 1
        }));

        houses.forEach((house, idx) => {
            // Угол куспида (от 0° Овна, против часовой стрелки)
            const angle = (90 - house.longitude) * Math.PI / 180;
            
            // Линия куспида
            const isAngular = [1, 4, 7, 10].includes(house.number);
            this.svg.appendChild(this.createSvgElement('line', {
                x1: this.center + houseInnerR * Math.cos(angle),
                y1: this.center - houseInnerR * Math.sin(angle),
                x2: this.center + innerR * Math.cos(angle),
                y2: this.center - innerR * Math.sin(angle),
                stroke: isAngular ? '#6366f1' : '#d1d5db',
                'stroke-width': isAngular ? 2 : 1
            }));
            
            // Номер дома
            const nextHouse = houses[(idx + 1) % 12];
            let midLong = (house.longitude + nextHouse.longitude) / 2;
            if (nextHouse.longitude < house.longitude) {
                midLong = ((house.longitude + nextHouse.longitude + 360) / 2) % 360;
            }
            const midAngle = (90 - midLong) * Math.PI / 180;
            const textR = houseInnerR + this.houseRingWidth / 2;
            
            this.svg.appendChild(this.createSvgElement('text', {
                x: this.center + textR * Math.cos(midAngle),
                y: this.center - textR * Math.sin(midAngle) + 4,
                'text-anchor': 'middle',
                'font-size': '11',
                'font-weight': isAngular ? '600' : '400',
                fill: isAngular ? '#6366f1' : '#9ca3af'
            }, house.number.toString()));
        });
    }

    drawAspectCircle() {
        const aspectR = this.outerRadius - this.signRingWidth - this.houseRingWidth;
        this.svg.appendChild(this.createSvgElement('circle', {
            cx: this.center,
            cy: this.center,
            r: aspectR * 0.95,
            fill: 'none',
            stroke: '#f3f4f6',
            'stroke-width': 1,
            'stroke-dasharray': '2,2'
        }));
    }

    drawAspects(aspects, planets) {
        const aspectR = this.planetRadius * 0.7;
        const planetMap = {};
        planets.forEach(p => planetMap[p.name] = p.longitude);

        // Только мажорные аспекты
        const majorAspects = aspects.filter(a => a.is_major);
        
        majorAspects.slice(0, 30).forEach(aspect => {
            const long1 = planetMap[aspect.planet_1];
            const long2 = planetMap[aspect.planet_2];
            if (long1 === undefined || long2 === undefined) return;

            const angle1 = (90 - long1) * Math.PI / 180;
            const angle2 = (90 - long2) * Math.PI / 180;
            
            let color = '#9ca3af';
            if (aspect.harmonic_type === 'harmonious') color = '#22c55e';
            else if (aspect.harmonic_type === 'tense') color = '#ef4444';
            
            this.svg.appendChild(this.createSvgElement('line', {
                x1: this.center + aspectR * Math.cos(angle1),
                y1: this.center - aspectR * Math.sin(angle1),
                x2: this.center + aspectR * Math.cos(angle2),
                y2: this.center - aspectR * Math.sin(angle2),
                stroke: color,
                'stroke-width': 1,
                opacity: 0.6
            }));
        });
    }

    drawPlanets(planets) {
        // Группируем планеты по позициям для избежания наложения
        const positions = this.calculatePlanetPositions(planets);

        positions.forEach(({ planet, displayAngle }) => {
            const angle = displayAngle * Math.PI / 180;
            const x = this.center + this.planetRadius * Math.cos(angle);
            const y = this.center - this.planetRadius * Math.sin(angle);
            const element = Symbols.signElements[planet.sign];
            const color = Symbols.elementColors[element] || '#1d1d1f';

            // Группа для интерактивности
            const group = this.createSvgElement('g', {
                class: 'planet-group',
                'data-planet': planet.name,
                style: 'cursor: pointer;'
            });

            // Фоновый круг
            group.appendChild(this.createSvgElement('circle', {
                cx: x,
                cy: y,
                r: 12,
                fill: 'white',
                stroke: color,
                'stroke-width': 1.5,
                class: 'planet-circle'
            }));

            // Символ планеты
            group.appendChild(this.createSvgElement('text', {
                x: x,
                y: y + 4,
                'text-anchor': 'middle',
                'font-size': '12',
                'font-weight': '500',
                fill: color,
                style: 'pointer-events: none;'
            }, Symbols.planets[planet.name] || planet.name.charAt(0)));

            // Индикатор ретроградности
            if (planet.retrograde) {
                group.appendChild(this.createSvgElement('text', {
                    x: x + 10,
                    y: y - 8,
                    'font-size': '8',
                    fill: '#d97706',
                    style: 'pointer-events: none;'
                }, 'R'));
            }

            this.svg.appendChild(group);
        });
    }

    calculatePlanetPositions(planets) {
        const minGap = 12; // Минимальный угол между планетами
        const sorted = planets
            .map(p => ({ planet: p, originalAngle: 90 - p.longitude, displayAngle: 90 - p.longitude }))
            .sort((a, b) => a.originalAngle - b.originalAngle);

        // Простой алгоритм разведения
        for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            const curr = sorted[i];
            let diff = curr.displayAngle - prev.displayAngle;
            if (diff < 0) diff += 360;

            if (diff < minGap) {
                curr.displayAngle = prev.displayAngle + minGap;
            }
        }

        return sorted;
    }

    drawAngles(angles) {
        if (!angles) return;

        const innerR = this.outerRadius - this.signRingWidth;

        // ASC
        if (angles.ASC) {
            const ascAngle = (90 - angles.ASC.longitude) * Math.PI / 180;
            this.drawAngleMarker(ascAngle, innerR, 'AC', '#6366f1');
        }

        // MC
        if (angles.MC) {
            const mcAngle = (90 - angles.MC.longitude) * Math.PI / 180;
            this.drawAngleMarker(mcAngle, innerR, 'MC', '#6366f1');
        }
    }

    drawAngleMarker(angle, radius, label, color) {
        const x = this.center + (radius + 12) * Math.cos(angle);
        const y = this.center - (radius + 12) * Math.sin(angle);

        this.svg.appendChild(this.createSvgElement('text', {
            x: x,
            y: y + 4,
            'text-anchor': 'middle',
            'font-size': '11',
            'font-weight': '600',
            fill: color
        }, label));
    }

    drawArc(outerR, innerR, startAngle, endAngle, fill) {
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

        this.svg.appendChild(this.createSvgElement('path', { d, fill }));
    }

    polarToCartesian(r, angleDeg) {
        const angle = angleDeg * Math.PI / 180;
        return {
            x: this.center + r * Math.cos(angle),
            y: this.center + r * Math.sin(angle)
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
}

window.ChartWheel = ChartWheel;


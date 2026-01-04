/**
 * Natal Full Page — Tabular Display
 */

// Порядок планет для отображения
const PLANET_ORDER = [
    'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
    'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
    'Chiron', 'Proserpina'
];

// Названия планет на русском
const PLANET_NAMES = {
    'Sun': 'Солнце',
    'Moon': 'Луна',
    'Mercury': 'Меркурий',
    'Venus': 'Венера',
    'Mars': 'Марс',
    'Jupiter': 'Юпитер',
    'Saturn': 'Сатурн',
    'Uranus': 'Уран',
    'Neptune': 'Нептун',
    'Pluto': 'Плутон',
    'Chiron': 'Хирон',
    'Proserpina': 'Прозерпина',
    'TrueNode': 'Раху (Сев. узел)',
    'SouthNode': 'Кету (Юж. узел)',
    'BlackMoon': 'Лилит',
    'WhiteMoon': 'Селена',
    'PartOfFortune': 'Парс Фортуны',
    'Vertex': 'Вертекс'
};

// Названия знаков
const SIGN_NAMES = {
    'Aries': 'Овен', 'Taurus': 'Телец', 'Gemini': 'Близнецы',
    'Cancer': 'Рак', 'Leo': 'Лев', 'Virgo': 'Дева',
    'Libra': 'Весы', 'Scorpio': 'Скорпион', 'Sagittarius': 'Стрелец',
    'Capricorn': 'Козерог', 'Aquarius': 'Водолей', 'Pisces': 'Рыбы'
};

// Названия достоинств
const DIGNITY_NAMES = {
    'domicile': 'Обитель',
    'exaltation': 'Экзальтация',
    'detriment': 'Изгнание',
    'fall': 'Падение',
    'neutral': 'Нейтрально'
};

// Названия аспектов
const ASPECT_NAMES = {
    'Conjunction': 'Соединение',
    'Opposition': 'Оппозиция',
    'Trine': 'Трин',
    'Square': 'Квадрат',
    'Sextile': 'Секстиль',
    'Semisextile': 'Полусекстиль',
    'Quincunx': 'Квинконс',
    'Semisquare': 'Полуквадрат',
    'Sesquiquadrate': 'Полутораквадрат',
    'Quintile': 'Квинтиль',
    'Biquintile': 'Биквинтиль'
};

let chartData = null;

document.addEventListener('DOMContentLoaded', () => {
    // Получаем данные из sessionStorage (используем тот же ключ, что и chart.html)
    const storedData = sessionStorage.getItem('natalChart');
    if (!storedData) {
        alert('Нет данных натальной карты. Перенаправление на главную страницу.');
        window.location.href = '/';
        return;
    }

    chartData = JSON.parse(storedData);
    renderFullChart(chartData);
});

function renderFullChart(data) {
    // 1. Заголовок и данные рождения
    renderHeader(data);
    renderBirthData(data);
    
    // 2. Таблица планет
    renderPlanetsTable(data.planets);
    
    // 3. Таблица домов
    renderHousesTable(data.houses);
    
    // 4. Аспекты
    renderAspects(data.aspects || []);

    // 5. Конфигурации
    renderConfigurations(data.aspect_configurations || []);

    // 6. Стеллиумы
    renderStelliums(data.stelliums || []);

    // 7. Специальные точки
    renderSpecialPoints(data.special_points || {});
}

function renderHeader(data) {
    const birthData = data.birth_data;
    document.getElementById('chartTitle').textContent = 
        `Натальная карта — ${birthData.place || 'Неизвестное место'}`;
    
    const dateTime = `${birthData.date} ${birthData.time} (${birthData.timezone})`;
    document.getElementById('birthDetails').textContent = dateTime;
}

function renderBirthData(data) {
    const birthData = data.birth_data;
    const angles = data.angles;

    document.getElementById('birthDateTime').textContent =
        `${birthData.date} ${birthData.time}`;

    document.getElementById('birthPlace').textContent =
        `${birthData.place || 'Неизвестно'} (${birthData.latitude.toFixed(2)}°, ${birthData.longitude.toFixed(2)}°)`;

    // angles - это объект, а не массив
    if (angles && angles.ASC) {
        document.getElementById('ascValue').textContent =
            `${SIGN_NAMES[angles.ASC.sign]} ${angles.ASC.degree_in_sign_formatted}`;
    }

    if (angles && angles.MC) {
        document.getElementById('mcValue').textContent =
            `${SIGN_NAMES[angles.MC.sign]} ${angles.MC.degree_in_sign_formatted}`;
    }

    // Фигура Джонса
    if (data.cosmogram_pattern) {
        const pattern = data.cosmogram_pattern;
        document.getElementById('jonesPattern').textContent = pattern.pattern_type;
    }
}

function renderPlanetsTable(planets) {
    const tbody = document.getElementById('planetsTableBody');
    tbody.innerHTML = '';
    
    // Сортируем планеты по порядку
    const sortedPlanets = planets
        .filter(p => PLANET_ORDER.includes(p.name))
        .sort((a, b) => PLANET_ORDER.indexOf(a.name) - PLANET_ORDER.indexOf(b.name));
    
    sortedPlanets.forEach(planet => {
        const row = createPlanetRow(planet);
        tbody.appendChild(row);
    });
}

function createPlanetRow(planet) {
    const tr = document.createElement('tr');

    // Планета
    const tdName = document.createElement('td');
    tdName.className = 'planet-name';
    tdName.textContent = PLANET_NAMES[planet.name] || planet.name;
    tr.appendChild(tdName);

    // Знак
    const tdSign = document.createElement('td');
    tdSign.textContent = SIGN_NAMES[planet.sign] || planet.sign;
    tr.appendChild(tdSign);

    // Градус
    const tdDegree = document.createElement('td');
    tdDegree.textContent = planet.degree_in_sign_formatted || `${planet.degree_in_sign.toFixed(2)}°`;
    tr.appendChild(tdDegree);

    // Дом
    const tdHouse = document.createElement('td');
    tdHouse.textContent = planet.house || '—';
    tr.appendChild(tdHouse);

    // Ретроградность
    const tdRetro = document.createElement('td');
    if (planet.retrograde) {
        const badge = document.createElement('span');
        badge.className = 'retrograde-badge';
        badge.textContent = 'R';
        tdRetro.appendChild(badge);
    } else {
        tdRetro.textContent = '—';
    }
    tr.appendChild(tdRetro);

    // Достоинство
    const tdDignity = document.createElement('td');
    if (planet.dignity && planet.dignity !== 'neutral') {
        const badge = document.createElement('span');
        badge.className = `dignity-badge dignity-${planet.dignity}`;
        badge.textContent = DIGNITY_NAMES[planet.dignity] || planet.dignity;
        tdDignity.appendChild(badge);
    } else {
        tdDignity.textContent = '—';
    }
    tr.appendChild(tdDignity);

    // Особенности
    const tdFeatures = document.createElement('td');
    const featuresContainer = document.createElement('div');
    featuresContainer.className = 'features-container';

    // Критические градусы
    if (planet.critical_degrees && planet.critical_degrees.length > 0) {
        planet.critical_degrees.forEach(deg => {
            const badge = createFeatureBadge(deg, 'critical');
            featuresContainer.appendChild(badge);
        });
    }

    // Отношение к Солнцу
    if (planet.sun_relation) {
        const sunBadge = createFeatureBadge(planet.sun_relation, 'critical');
        featuresContainer.appendChild(sunBadge);
    }

    // Элевация
    if (planet.is_elevated) {
        const elevBadge = createFeatureBadge('Элевация', 'elevated');
        featuresContainer.appendChild(elevBadge);
    }

    // В шахте
    if (planet.is_peregrine) {
        const perBadge = createFeatureBadge('Шахта', 'peregrine');
        featuresContainer.appendChild(perBadge);
    }

    // Стационарность
    if (planet.is_stationary) {
        const statBadge = createFeatureBadge(`Стац. ${planet.stationary_type || ''}`, 'critical');
        featuresContainer.appendChild(statBadge);
    }

    // Во включённом знаке
    if (planet.in_intercepted_sign) {
        const intBadge = createFeatureBadge('Вкл. знак', 'peregrine');
        featuresContainer.appendChild(intBadge);
    }

    if (featuresContainer.children.length === 0) {
        tdFeatures.textContent = '—';
    } else {
        tdFeatures.appendChild(featuresContainer);
    }
    tr.appendChild(tdFeatures);

    return tr;
}

function createFeatureBadge(text, type = '') {
    const badge = document.createElement('span');
    badge.className = `feature-badge ${type}`;
    badge.textContent = text;
    return badge;
}

function renderHousesTable(houses) {
    const tbody = document.getElementById('housesTableBody');
    tbody.innerHTML = '';

    houses.forEach(house => {
        const tr = document.createElement('tr');

        // Дом
        const tdNum = document.createElement('td');
        tdNum.textContent = house.number;
        if ([1, 4, 7, 10].includes(house.number)) {
            tdNum.style.fontWeight = '600';
            tdNum.style.color = 'var(--accent)';
        }
        tr.appendChild(tdNum);

        // Знак
        const tdSign = document.createElement('td');
        tdSign.textContent = SIGN_NAMES[house.sign] || house.sign;
        tr.appendChild(tdSign);

        // Градус
        const tdDegree = document.createElement('td');
        tdDegree.textContent = house.degree_in_sign_formatted || `${house.degree_in_sign.toFixed(2)}°`;
        tr.appendChild(tdDegree);

        // Управитель
        const tdRuler = document.createElement('td');
        tdRuler.textContent = PLANET_NAMES[house.ruler_planet] || house.ruler_planet || '—';
        tr.appendChild(tdRuler);

        // Управитель в доме
        const tdRulerHouse = document.createElement('td');
        tdRulerHouse.textContent = house.ruler_in_house || '—';
        tr.appendChild(tdRulerHouse);

        // Планеты в доме
        const tdPlanets = document.createElement('td');
        if (house.planets_in_house && house.planets_in_house.length > 0) {
            const planetNames = house.planets_in_house
                .map(p => PLANET_NAMES[p] || p)
                .join(', ');
            tdPlanets.textContent = planetNames;
        } else {
            tdPlanets.textContent = '—';
        }
        tr.appendChild(tdPlanets);

        tbody.appendChild(tr);
    });
}

function renderAspects(aspects) {
    const majorContainer = document.getElementById('majorAspectsContainer');
    const minorContainer = document.getElementById('minorAspectsContainer');

    majorContainer.innerHTML = '';
    minorContainer.innerHTML = '';

    if (!aspects || aspects.length === 0) {
        majorContainer.innerHTML = '<p style="color: var(--text-secondary);">Нет аспектов</p>';
        minorContainer.innerHTML = '<p style="color: var(--text-secondary);">Нет минорных аспектов</p>';
        return;
    }

    // Разделяем на мажорные и минорные
    const majorAspects = aspects.filter(a => a.is_major);
    const minorAspects = aspects.filter(a => !a.is_major);

    // Группируем мажорные по типу
    if (majorAspects.length > 0) {
        const majorGroups = groupAspectsByType(majorAspects);
        renderAspectGroups(majorGroups, majorContainer);
    } else {
        majorContainer.innerHTML = '<p style="color: var(--text-secondary);">Нет мажорных аспектов</p>';
    }

    // Минорные аспекты
    if (minorAspects.length > 0) {
        const minorGroups = groupAspectsByType(minorAspects);
        renderAspectGroups(minorGroups, minorContainer);
    } else {
        minorContainer.innerHTML = '<p style="color: var(--text-secondary);">Нет минорных аспектов</p>';
    }
}

function groupAspectsByType(aspects) {
    const groups = {};
    aspects.forEach(aspect => {
        const type = aspect.aspect_type;
        if (!groups[type]) {
            groups[type] = [];
        }
        groups[type].push(aspect);
    });
    return groups;
}

function renderAspectGroups(groups, container) {
    const typeOrder = ['Conjunction', 'Opposition', 'Trine', 'Square', 'Sextile',
                       'Semisextile', 'Quincunx', 'Semisquare', 'Sesquiquadrate',
                       'Quintile', 'Biquintile'];

    typeOrder.forEach(type => {
        if (groups[type]) {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'aspect-group';

            const title = document.createElement('div');
            title.className = 'aspect-group-title';
            title.textContent = `${ASPECT_NAMES[type] || type} (${groups[type].length})`;
            groupDiv.appendChild(title);

            const listDiv = document.createElement('div');
            listDiv.className = 'aspect-list';

            groups[type].forEach(aspect => {
                const item = createAspectItem(aspect);
                listDiv.appendChild(item);
            });

            groupDiv.appendChild(listDiv);
            container.appendChild(groupDiv);
        }
    });
}

function createAspectItem(aspect) {
    const div = document.createElement('div');
    div.className = `aspect-item ${aspect.harmonic_type || 'neutral'}`;

    const planetsSpan = document.createElement('span');
    planetsSpan.className = 'aspect-planets';
    const p1 = PLANET_NAMES[aspect.planet_1] || aspect.planet_1;
    const p2 = PLANET_NAMES[aspect.planet_2] || aspect.planet_2;
    planetsSpan.textContent = `${p1} — ${p2}`;

    const typeSpan = document.createElement('span');
    typeSpan.className = 'aspect-type';
    typeSpan.textContent = ASPECT_NAMES[aspect.aspect_type] || aspect.aspect_type;

    const orbSpan = document.createElement('span');
    orbSpan.className = 'aspect-orb';
    orbSpan.textContent = `орб: ${aspect.orb.toFixed(2)}°`;
    if (aspect.is_partile) {
        orbSpan.textContent += ' (партильный)';
        orbSpan.style.fontWeight = '600';
    }

    div.appendChild(planetsSpan);
    div.appendChild(typeSpan);
    div.appendChild(orbSpan);

    return div;
}

function renderConfigurations(configurations) {
    const container = document.getElementById('configurationsContainer');

    if (!configurations || configurations.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">Нет аспектных конфигураций</p>';
        return;
    }

    container.innerHTML = '';
    configurations.forEach(config => {
        const card = createConfigCard(config);
        container.appendChild(card);
    });
}

function createConfigCard(config) {
    const card = document.createElement('div');
    card.className = 'config-card';

    const header = document.createElement('div');
    header.className = 'config-header';

    const type = document.createElement('div');
    type.className = 'config-type';
    type.textContent = config.type.replace(/_/g, ' ');

    const strength = document.createElement('div');
    strength.className = 'config-strength';
    strength.textContent = `Сила: ${config.strength_score?.toFixed(1) || 'N/A'}`;

    header.appendChild(type);
    header.appendChild(strength);
    card.appendChild(header);

    const planets = document.createElement('div');
    planets.className = 'config-planets';
    const planetNames = config.planets_involved
        .map(p => PLANET_NAMES[p] || p)
        .join(', ');
    planets.textContent = `Планеты: ${planetNames}`;
    card.appendChild(planets);

    if (config.apex_planet) {
        const apex = document.createElement('div');
        apex.style.fontSize = '13px';
        apex.style.color = 'var(--text-secondary)';
        apex.textContent = `Апекс: ${PLANET_NAMES[config.apex_planet] || config.apex_planet}`;
        card.appendChild(apex);
    }

    return card;
}

function renderStelliums(stelliums) {
    const container = document.getElementById('stelliumsContainer');

    if (!stelliums || stelliums.length === 0) {
        container.innerHTML = '<p style="color: var--text-secondary);">Нет стеллиумов</p>';
        return;
    }

    container.innerHTML = '';
    stelliums.forEach(stellium => {
        const card = createStelliumCard(stellium);
        container.appendChild(card);
    });
}

function createStelliumCard(stellium) {
    const card = document.createElement('div');
    card.className = 'config-card';

    const header = document.createElement('div');
    header.className = 'config-header';

    const type = document.createElement('div');
    type.className = 'config-type';
    const location = stellium.type === 'sign'
        ? (SIGN_NAMES[stellium.sign] || stellium.sign)
        : `Дом ${stellium.house_number}`;
    type.textContent = `Стеллиум в ${location}`;

    const count = document.createElement('div');
    count.className = 'config-strength';
    count.textContent = `${stellium.count} планет`;

    header.appendChild(type);
    header.appendChild(count);
    card.appendChild(header);

    const planets = document.createElement('div');
    planets.className = 'config-planets';
    const planetNames = stellium.planets
        .map(p => PLANET_NAMES[p] || p)
        .join(', ');
    planets.textContent = planetNames;
    card.appendChild(planets);

    return card;
}

function renderSpecialPoints(specialPoints) {
    const tbody = document.getElementById('specialPointsTableBody');
    tbody.innerHTML = '';

    // special_points - это объект, а не массив
    if (!specialPoints || typeof specialPoints !== 'object') {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 4;
        td.style.textAlign = 'center';
        td.style.color = 'var(--text-secondary)';
        td.textContent = 'Нет специальных точек';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    const pointsToShow = ['TrueNode', 'SouthNode', 'BlackMoon', 'WhiteMoon', 'PartOfFortune', 'Vertex'];
    let hasPoints = false;

    pointsToShow.forEach(pointName => {
        const point = specialPoints[pointName];
        if (point && point.longitude !== null) {
            hasPoints = true;
            const tr = document.createElement('tr');

            // Точка
            const tdName = document.createElement('td');
            tdName.textContent = PLANET_NAMES[pointName] || pointName;
            tr.appendChild(tdName);

            // Знак
            const tdSign = document.createElement('td');
            tdSign.textContent = SIGN_NAMES[point.sign] || point.sign;
            tr.appendChild(tdSign);

            // Градус
            const tdDegree = document.createElement('td');
            tdDegree.textContent = point.degree_in_sign_formatted || `${point.degree_in_sign.toFixed(2)}°`;
            tr.appendChild(tdDegree);

            // Дом
            const tdHouse = document.createElement('td');
            tdHouse.textContent = point.house || '—';
            tr.appendChild(tdHouse);

            tbody.appendChild(tr);
        }
    });

    if (!hasPoints) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 4;
        td.style.textAlign = 'center';
        td.style.color = 'var(--text-secondary)';
        td.textContent = 'Нет специальных точек';
        tr.appendChild(td);
        tbody.appendChild(tr);
    }
}


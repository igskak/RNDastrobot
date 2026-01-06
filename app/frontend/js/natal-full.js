/**
 * Natal Full Page — Compact Tabular Display
 * Оптимизировано для астрологов: всё на одном экране
 * Использует символы из symbols.js (window.Symbols)
 */

// Порядок планет
const PLANET_ORDER = [
    'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
    'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
    'Chiron', 'Proserpina'
];

// Достоинства (короткие коды)
const DIGNITY_CODES = {
    'domicile': 'H', 'exaltation': 'X', 'detriment': 'D', 'fall': 'F'
};

// Особенности планет (текстовые метки)
const FEATURE_LABELS = {
    // Критические градусы
    'anareta': 'анарета', 'royal': 'корол.', 'jubilee': 'юбилей', 'destructive': 'деструкт.', 'middle': 'сред.',
    // Отношение к Солнцу
    'combust': 'сожж.', 'cazimi': 'казими', 'under_rays': 'в лучах',
    // Специальные роли
    'handle': 'ручка', 'aspect_king': 'король', 'doryphoros': 'дориф.', 'charioteer': 'возн.', 'almuten': 'альмут.'
};

// Хелперы для доступа к символам из symbols.js
const S = () => window.Symbols || {};
const getPlanetSymbol = (name) => S().planets?.[name] || '';
const getSignSymbol = (name) => S().signs?.[name] || '';
const getPlanetName = (name) => S().planetNamesRu?.[name] || name;
const getSignName = (name) => S().signNamesRu?.[name] || name;
const getAspectSymbol = (name) => S().aspects?.[name] || '?';
const getAspectName = (name) => S().aspectNamesRu?.[name] || name;

// Русские названия фигур Джонса
const PATTERN_NAMES_RU = {
    'Splash': 'Всплеск',
    'Bundle': 'Связка',
    'Locomotive': 'Локомотив',
    'Bowl': 'Чаша',
    'Bucket': 'Корзина',
    'Seesaw': 'Качели',
    'Splay': 'Веер'
};
const getPatternName = (name) => PATTERN_NAMES_RU[name] || name;

let chartData = null;

document.addEventListener('DOMContentLoaded', () => {
    const storedData = sessionStorage.getItem('natalChart');
    console.log('storedData:', storedData ? 'found' : 'NOT FOUND');

    if (!storedData) {
        alert('Нет данных натальной карты. Перенаправление на главную страницу.');
        window.location.href = '/';
        return;
    }

    chartData = JSON.parse(storedData);
    console.log('chartData:', chartData);
    console.log('planets:', chartData.planets);
    console.log('houses:', chartData.houses);

    renderFullChart(chartData);
    setupLegendToggle();
});

function setupLegendToggle() {
    const btn = document.getElementById('legendToggle');
    const panel = document.getElementById('legendPanel');
    if (btn && panel) {
        btn.addEventListener('click', () => {
            panel.classList.toggle('hidden');
        });
    }
}

function renderFullChart(data) {
    // DEBUG: проверяем данные
    console.log('=== DEBUG natal-full.js ===');
    console.log('planets[0]:', data.planets?.[0]);
    console.log('planets[0].ruled_houses:', data.planets?.[0]?.ruled_houses);
    console.log('planets[0].speed_percent:', data.planets?.[0]?.speed_percent);
    console.log('planets[0].speed:', data.planets?.[0]?.speed);
    console.log('houses[0]:', data.houses?.[0]);
    console.log('houses[0].ruler_planet:', data.houses?.[0]?.ruler_planet);

    renderHeader(data);
    renderSummaryBar(data);
    renderPlanetsTable(data.planets, data.houses);
    renderHousesTable(data.houses, data.planets);
    renderAspectsTable(data.aspects || []);
    renderConfigurations(data.aspect_configurations || [], data.stelliums || []);
    renderBalances(data.balances, data.cosmogram_pattern);
    renderSpecialPoints(data.special_points || {});
}

function renderHeader(data) {
    const birthData = data.birth_data;
    document.getElementById('chartTitle').textContent =
        `Натальная карта — ${birthData.place || 'Неизвестное место'}`;
    document.getElementById('birthDetails').textContent =
        `${birthData.date} ${birthData.time} (${birthData.timezone})`;
}

function renderSummaryBar(data) {
    const angles = data.angles;
    const planets = data.planets;
    const pattern = data.cosmogram_pattern;
    const balances = data.balances;

    // ASC
    if (angles?.ASC) {
        const asc = angles.ASC;
        document.getElementById('summaryAsc').textContent =
            `${getSignSymbol(asc.sign)} ${getSignName(asc.sign)} ${formatDegree(asc)}`;
    }

    // MC
    if (angles?.MC) {
        const mc = angles.MC;
        document.getElementById('summaryMc').textContent =
            `${getSignSymbol(mc.sign)} ${getSignName(mc.sign)} ${formatDegree(mc)}`;
    }

    // Sun
    const sun = planets?.find(p => p.name === 'Sun');
    if (sun) {
        document.getElementById('summarySun').textContent =
            `${getSignName(sun.sign)} ${formatDegree(sun)}`;
    }

    // Moon
    const moon = planets?.find(p => p.name === 'Moon');
    if (moon) {
        document.getElementById('summaryMoon').textContent =
            `${getSignName(moon.sign)} ${formatDegree(moon)}`;
    }

    // Pattern (фигура Джонса)
    if (pattern) {
        let patternText = getPatternName(pattern.pattern_type) || '—';
        if (pattern.handle_planet) {
            patternText += ` (${getPlanetName(pattern.handle_planet)})`;
        }
        document.getElementById('summaryPattern').textContent = patternText;
    }

    // Dominants
    if (balances) {
        const dominants = [];
        if (balances.element_balance) {
            const maxEl = getMaxBalance(balances.element_balance);
            if (maxEl) dominants.push(`🌍${maxEl.label} ${maxEl.pct}%`);
        }
        if (balances.mode_balance) {
            const maxMode = getMaxBalance(balances.mode_balance);
            if (maxMode) dominants.push(`${maxMode.label} ${maxMode.pct}%`);
        }
        if (balances.gender_balance) {
            const maxGender = getMaxBalance(balances.gender_balance);
            if (maxGender) dominants.push(`${maxGender.label} ${maxGender.pct}%`);
        }
        document.getElementById('summaryDominants').textContent = dominants.join(' │ ');
    }
}

function getMaxBalance(balanceObj) {
    if (!balanceObj) return null;

    // Словари для русификации (поддержка обоих регистров)
    const labels = {
        // Стихии
        'Fire': 'огонь', 'fire': 'огонь',
        'Earth': 'земля', 'earth': 'земля',
        'Air': 'воздух', 'air': 'воздух',
        'Water': 'вода', 'water': 'вода',
        // Кресты
        'Cardinal': 'кардинальный', 'cardinal': 'кардинальный',
        'Fixed': 'фиксированный', 'fixed': 'фиксированный',
        'Mutable': 'мутабельный', 'mutable': 'мутабельный',
        // Полярность
        'Masculine': 'мужской', 'masculine': 'мужской',
        'Feminine': 'женский', 'feminine': 'женский'
    };

    let max = { label: '', value: 0, pct: 0 };
    let total = 0;
    for (const [key, val] of Object.entries(balanceObj)) {
        total += val;
        if (val > max.value) {
            max = { label: labels[key] || key, value: val };
        }
    }
    max.pct = total > 0 ? Math.round((max.value / total) * 100) : 0;
    return max;
}

function formatDegreeFull(deg) {
    // Формат: 27°16'28"
    if (deg === null || deg === undefined) return '—';
    const d = Math.floor(deg);
    const minFloat = (deg - d) * 60;
    const m = Math.floor(minFloat);
    const s = Math.round((minFloat - m) * 60);
    return `${d}°${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"`;
}

function formatDegree(item) {
    // Используем готовый formatted если есть, иначе вычисляем
    if (item.degree_in_sign_formatted) return item.degree_in_sign_formatted;
    return formatDegreeFull(item.degree_in_sign);
}

function renderPlanetsTable(planets, houses) {
    const tbody = document.getElementById('planetsTableBody');
    tbody.innerHTML = '';

    // Если ruled_houses нет в данных, вычислим на лету из houses.ruler_planet
    const planetRuledHouses = {};
    if (houses) {
        houses.forEach(h => {
            const ruler = h.ruler_planet;
            if (ruler) {
                if (!planetRuledHouses[ruler]) planetRuledHouses[ruler] = [];
                planetRuledHouses[ruler].push(h.number);
            }
        });
    }

    const sortedPlanets = planets
        .filter(p => PLANET_ORDER.includes(p.name))
        .sort((a, b) => PLANET_ORDER.indexOf(a.name) - PLANET_ORDER.indexOf(b.name));

    sortedPlanets.forEach(planet => {
        // Если ruled_houses пустой или undefined, используем вычисленный
        if (!planet.ruled_houses || planet.ruled_houses.length === 0) {
            planet.ruled_houses = planetRuledHouses[planet.name] || [];
        }
        const row = createPlanetRow(planet, houses);
        tbody.appendChild(row);
    });
}

function createPlanetRow(planet, houses) {
    const tr = document.createElement('tr');

    // 1. Планета (символ + название)
    const tdName = document.createElement('td');
    tdName.innerHTML = `<span class="planet-cell">
        <span class="planet-symbol">${getPlanetSymbol(planet.name)}</span>
        <span class="planet-name">${getPlanetName(planet.name)}</span>
    </span>`;
    tr.appendChild(tdName);

    // 2. Позиция (знак + градус)
    const tdPos = document.createElement('td');
    tdPos.className = 'position-cell';
    const signSym = getSignSymbol(planet.sign);
    const signName = getSignName(planet.sign);
    const deg = formatDegree(planet);
    tdPos.innerHTML = `<span class="sign-symbol">${signSym}</span>${signName} ${deg}`;
    tr.appendChild(tdPos);

    // 3. Дом
    const tdHouse = document.createElement('td');
    const isAngular = [1, 4, 7, 10].includes(planet.house);
    tdHouse.className = isAngular ? 'angular-house' : '';
    tdHouse.textContent = planet.house || '—';
    tr.appendChild(tdHouse);

    // 4. Достоинство (компактный код)
    const tdDignity = document.createElement('td');
    if (planet.dignity && planet.dignity !== 'neutral') {
        const code = DIGNITY_CODES[planet.dignity] || planet.dignity[0].toUpperCase();
        tdDignity.innerHTML = `<span class="dignity-badge dignity-${planet.dignity}">${code}</span>`;
    } else {
        tdDignity.textContent = '—';
    }
    tr.appendChild(tdDignity);

    // 5. Движение (D/R/S)
    const tdMove = document.createElement('td');
    if (planet.is_stationary) {
        tdMove.innerHTML = `<span class="move-badge move-s">S</span>`;
    } else if (planet.retrograde) {
        tdMove.innerHTML = `<span class="move-badge move-r">R</span>`;
    } else {
        tdMove.innerHTML = `<span class="move-badge move-d">D</span>`;
    }
    tr.appendChild(tdMove);

    // 6. Скорость (speed_percent или вычисляем из speed)
    const tdSpeed = document.createElement('td');
    tdSpeed.className = 'speed-cell';
    let speedPct = planet.speed_percent;

    // Если speed_percent нет, но есть speed — показываем скорость
    if ((speedPct === undefined || speedPct === null) && planet.speed !== undefined) {
        // Показываем raw speed если нет процентов
        const rawSpeed = Math.abs(planet.speed).toFixed(2);
        tdSpeed.textContent = rawSpeed > 0 ? `${rawSpeed}°/д` : '—';
    } else if (speedPct !== undefined && speedPct !== null) {
        let speedClass = '';
        if (speedPct < 80) speedClass = 'speed-slow';
        else if (speedPct > 120) speedClass = 'speed-very-fast';
        else if (speedPct > 100) speedClass = 'speed-fast';
        tdSpeed.innerHTML = `<span class="${speedClass}">${Math.round(speedPct)}%</span>`;
    } else {
        tdSpeed.textContent = '—';
    }
    tr.appendChild(tdSpeed);

    // 7. Особенности (текстом)
    const tdFeatures = document.createElement('td');
    tdFeatures.className = 'features-cell';
    const features = [];

    // Критические градусы
    if (planet.critical_degrees?.length > 0) {
        planet.critical_degrees.forEach(deg => {
            const label = FEATURE_LABELS[deg];
            if (label) features.push(label);
        });
    }

    // Отношение к Солнцу
    if (planet.sun_relation) {
        const label = FEATURE_LABELS[planet.sun_relation] || planet.sun_relation;
        features.push(label);
    }

    // Элевация
    if (planet.is_elevated) features.push('элев.');

    // В шахте
    if (planet.is_peregrine) features.push('шахта');

    // Во включённом знаке
    if (planet.in_intercepted_sign) features.push('вкл.');

    // Special roles
    if (planet.special_roles?.length > 0) {
        planet.special_roles.forEach(role => {
            const label = FEATURE_LABELS[role] || role;
            features.push(label);
        });
    }

    tdFeatures.textContent = features.length > 0 ? features.join(', ') : '—';
    tr.appendChild(tdFeatures);

    // 8. Управляемые дома
    const tdRuled = document.createElement('td');
    tdRuled.className = 'ruled-houses';
    if (planet.ruled_houses?.length > 0) {
        tdRuled.textContent = planet.ruled_houses.join(',');
    } else {
        tdRuled.textContent = '—';
    }
    tr.appendChild(tdRuled);

    return tr;
}

function renderHousesTable(houses, planets) {
    const tbody = document.getElementById('housesTableBody');
    tbody.innerHTML = '';

    // Построим карту: дом -> планеты
    const planetsByHouse = {};
    planets?.forEach(p => {
        if (p.house) {
            if (!planetsByHouse[p.house]) planetsByHouse[p.house] = [];
            planetsByHouse[p.house].push(p.name);
        }
    });

    // Построим карту: планета -> дом (для ruler_in_house)
    const planetToHouse = {};
    planets?.forEach(p => {
        if (p.house) planetToHouse[p.name] = p.house;
    });

    houses.forEach(house => {
        const tr = document.createElement('tr');

        // 1. Дом
        const tdNum = document.createElement('td');
        const isAngular = [1, 4, 7, 10].includes(house.number);
        tdNum.className = isAngular ? 'angular-house' : '';
        tdNum.textContent = house.number;
        tr.appendChild(tdNum);

        // 2. Знак (символ + название + градус)
        const tdSign = document.createElement('td');
        tdSign.className = 'position-cell';
        const signSym = getSignSymbol(house.sign);
        const deg = formatDegree(house);
        tdSign.innerHTML = `${signSym} ${getSignName(house.sign)} ${deg}`;
        tr.appendChild(tdSign);

        // 3. Управитель + соуправители
        const tdRuler = document.createElement('td');
        let rulerText = getPlanetName(house.ruler_planet);
        if (house.co_rulers && house.co_rulers.length > 0) {
            const coRulerNames = house.co_rulers.map(p => getPlanetName(p)).join(', ');
            rulerText += ` (${coRulerNames})`;
        }
        tdRuler.textContent = rulerText;
        tr.appendChild(tdRuler);

        // 4. Управитель в доме
        const tdRulerHouse = document.createElement('td');
        const rulerHouse = house.ruler_in_house || planetToHouse[house.ruler_planet];
        tdRulerHouse.textContent = rulerHouse || '—';
        tr.appendChild(tdRulerHouse);

        // 5. Включённый знак (текстом)
        const tdIncluded = document.createElement('td');
        if (house.included_sign) {
            tdIncluded.textContent = getSignName(house.included_sign);
            tdIncluded.className = 'included-sign';
        } else {
            tdIncluded.textContent = '—';
        }
        tr.appendChild(tdIncluded);

        // 6. Планеты в доме (текстом)
        const tdPlanets = document.createElement('td');
        const housePlanets = house.planets_in_house || planetsByHouse[house.number] || [];
        if (housePlanets.length > 0) {
            // Короткие имена планет
            const shortNames = housePlanets.map(p => {
                const name = getPlanetName(p);
                // Сокращаем длинные названия
                if (name.length > 4) return name.substring(0, 3);
                return name;
            });
            tdPlanets.textContent = shortNames.join(', ');
            tdPlanets.title = housePlanets.map(p => getPlanetName(p)).join(', ');
        } else {
            tdPlanets.textContent = '—';
        }
        tr.appendChild(tdPlanets);

        tbody.appendChild(tr);
    });
}

// Глобальное состояние сортировки аспектов
let aspectsSortState = { field: 'type', ascending: true };
let currentMajorAspects = [];

function renderAspectsTable(aspects) {
    const majorBody = document.getElementById('aspectsTableBody');
    const minorBody = document.getElementById('minorAspectsTableBody');

    majorBody.innerHTML = '';
    minorBody.innerHTML = '';

    if (!aspects || aspects.length === 0) {
        majorBody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-secondary)">Нет аспектов</td></tr>';
        return;
    }

    currentMajorAspects = aspects.filter(a => a.is_major);
    const minorAspects = aspects.filter(a => !a.is_major);

    // Сортируем и рендерим мажорные
    renderSortedMajorAspects();

    minorAspects.forEach(aspect => {
        const row = createAspectRow(aspect);
        minorBody.appendChild(row);
    });

    // Инициализируем обработчики сортировки
    initAspectsSortHandlers();
}

function renderSortedMajorAspects() {
    const majorBody = document.getElementById('aspectsTableBody');
    majorBody.innerHTML = '';

    const typeOrder = ['Conjunction', 'Opposition', 'Trine', 'Square', 'Sextile'];
    const sorted = [...currentMajorAspects].sort((a, b) => {
        if (aspectsSortState.field === 'type') {
            const aIdx = typeOrder.indexOf(a.aspect_type);
            const bIdx = typeOrder.indexOf(b.aspect_type);
            const cmp = aIdx - bIdx;
            return aspectsSortState.ascending ? cmp : -cmp;
        } else {
            const cmp = a.orb - b.orb;
            return aspectsSortState.ascending ? cmp : -cmp;
        }
    });

    sorted.forEach(aspect => {
        const row = createAspectRow(aspect);
        majorBody.appendChild(row);
    });
}

function initAspectsSortHandlers() {
    document.querySelectorAll('#aspectsSection th.sortable').forEach(th => {
        th.style.cursor = 'pointer';
        th.onclick = () => {
            const field = th.dataset.sort;
            if (aspectsSortState.field === field) {
                aspectsSortState.ascending = !aspectsSortState.ascending;
            } else {
                aspectsSortState.field = field;
                aspectsSortState.ascending = true;
            }
            // Обновляем индикаторы
            document.querySelectorAll('#aspectsSection th.sortable').forEach(h => {
                h.textContent = h.dataset.sort === 'type' ? 'Тип ⇅' : 'Орб ⇅';
            });
            th.textContent = (field === 'type' ? 'Тип ' : 'Орб ') + (aspectsSortState.ascending ? '↑' : '↓');
            renderSortedMajorAspects();
        };
    });
}

function createAspectRow(aspect) {
    const tr = document.createElement('tr');

    // Определяем класс по гармоничности
    if (aspect.harmonic_type === 'harmonious') {
        tr.className = 'aspect-row-harmonious';
    } else if (aspect.harmonic_type === 'tense') {
        tr.className = 'aspect-row-tense';
    } else {
        tr.className = 'aspect-row-neutral';
    }

    // 1. Символ + название аспекта
    const tdSymbol = document.createElement('td');
    tdSymbol.className = 'aspect-symbol';
    const sym = getAspectSymbol(aspect.aspect_type);
    const name = getAspectName(aspect.aspect_type);
    tdSymbol.innerHTML = `${sym} <span class="aspect-name">${name}</span>`;
    tr.appendChild(tdSymbol);

    // 2. Планеты
    const tdPlanets = document.createElement('td');
    const p1 = getPlanetName(aspect.planet_1);
    const p2 = getPlanetName(aspect.planet_2);
    tdPlanets.textContent = `${p1} — ${p2}`;
    tr.appendChild(tdPlanets);

    // 3. Орб
    const tdOrb = document.createElement('td');
    tdOrb.className = 'aspect-orb';
    const orbStr = aspect.orb.toFixed(1) + '°';
    const partile = aspect.is_partile ? '<span class="partile-badge">⭐</span>' : '';
    tdOrb.innerHTML = orbStr + partile;
    tr.appendChild(tdOrb);

    return tr;
}

function renderConfigurations(configurations, stelliums) {
    const container = document.getElementById('configurationsContainer');
    container.innerHTML = '';

    const hasConfigs = configurations && configurations.length > 0;
    const hasStelliums = stelliums && stelliums.length > 0;

    if (!hasConfigs && !hasStelliums) {
        container.innerHTML = '<p style="color: var(--text-secondary);">Нет конфигураций</p>';
        return;
    }

    const row = document.createElement('div');
    row.className = 'configs-row';

    // Конфигурации
    configurations?.forEach(config => {
        const card = createConfigCard(config);
        row.appendChild(card);
    });

    // Стеллиумы
    stelliums?.forEach(stellium => {
        const card = createStelliumCard(stellium);
        row.appendChild(card);
    });

    container.appendChild(row);
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
    strength.textContent = config.strength_score ? config.strength_score.toFixed(0) : '';

    header.appendChild(type);
    header.appendChild(strength);
    card.appendChild(header);

    const planets = document.createElement('div');
    planets.className = 'config-planets';
    const planetSymbols = config.planets_involved
        .map(p => getPlanetSymbol(p))
        .join(' ');
    planets.textContent = planetSymbols;
    card.appendChild(planets);

    if (config.apex_planet) {
        const details = document.createElement('div');
        details.className = 'config-details';
        details.textContent = `Апекс: ${getPlanetName(config.apex_planet)}`;
        card.appendChild(details);
    }

    // Аспекты конфигурации
    if (config.aspects && config.aspects.length > 0) {
        const aspectsList = document.createElement('div');
        aspectsList.className = 'config-aspects-list';

        config.aspects.forEach(asp => {
            const aspectItem = document.createElement('div');
            aspectItem.className = 'config-aspect-item';

            const p1 = getPlanetName(asp.planet_1);
            const p2 = getPlanetName(asp.planet_2);
            const symbol = getAspectSymbol(asp.aspect_type);
            const orb = asp.orb.toFixed(1);

            aspectItem.textContent = `${p1} ${symbol} ${p2} (${orb}°)`;
            aspectsList.appendChild(aspectItem);
        });

        card.appendChild(aspectsList);
    }

    return card;
}

function createStelliumCard(stellium) {
    const card = document.createElement('div');
    card.className = 'config-card';

    const header = document.createElement('div');
    header.className = 'config-header';

    const type = document.createElement('div');
    type.className = 'config-type';
    const location = stellium.type === 'sign'
        ? `${getSignSymbol(stellium.sign)} ${getSignName(stellium.sign)}`
        : `Дом ${stellium.house_number}`;
    type.textContent = `Стеллиум: ${location}`;

    const count = document.createElement('div');
    count.className = 'config-strength';
    count.textContent = stellium.count;

    header.appendChild(type);
    header.appendChild(count);
    card.appendChild(header);

    const planets = document.createElement('div');
    planets.className = 'config-planets';
    const planetSymbols = stellium.planets
        .map(p => getPlanetSymbol(p))
        .join(' ');
    planets.textContent = planetSymbols;
    card.appendChild(planets);

    // Список планет с названиями
    const planetsList = document.createElement('div');
    planetsList.className = 'config-aspects-list';

    stellium.planets.forEach(planetName => {
        const planetItem = document.createElement('div');
        planetItem.className = 'config-aspect-item';
        planetItem.textContent = getPlanetName(planetName);
        planetsList.appendChild(planetItem);
    });

    card.appendChild(planetsList);

    return card;
}

function renderBalances(balances, pattern) {
    const container = document.getElementById('balancesContainer');
    if (!container) return;

    container.innerHTML = '';

    if (!balances) {
        container.innerHTML = '<p style="color: var(--text-secondary);">Нет данных о балансах</p>';
        return;
    }

    const row = document.createElement('div');
    row.className = 'balances-compact';

    // Элементы (на русском)
    if (balances.element_balance) {
        const group = createBalanceGroup('Стихии:', balances.element_balance, {
            'Fire': 'Огонь', 'fire': 'Огонь',
            'Earth': 'Земля', 'earth': 'Земля',
            'Air': 'Воздух', 'air': 'Воздух',
            'Water': 'Вода', 'water': 'Вода'
        });
        row.appendChild(group);
    }

    // Кресты (на русском)
    if (balances.mode_balance) {
        const group = createBalanceGroup('Кресты:', balances.mode_balance, {
            'Cardinal': 'Кардинальный', 'cardinal': 'Кардинальный',
            'Fixed': 'Фиксированный', 'fixed': 'Фиксированный',
            'Mutable': 'Мутабельный', 'mutable': 'Мутабельный'
        });
        row.appendChild(group);
    }

    // Полярность (на русском)
    if (balances.gender_balance) {
        const group = createBalanceGroup('Полярность:', balances.gender_balance, {
            'Masculine': 'Мужской', 'masculine': 'Мужской',
            'Feminine': 'Женский', 'feminine': 'Женский'
        });
        row.appendChild(group);
    }

    container.appendChild(row);
}

function createBalanceGroup(icon, data, labels) {
    const group = document.createElement('div');
    group.className = 'balance-group';

    // Иконка группы
    const iconSpan = document.createElement('span');
    iconSpan.className = 'balance-icon';
    iconSpan.textContent = icon;
    group.appendChild(iconSpan);

    // Значения
    let total = 0;
    for (const val of Object.values(data)) total += val;

    for (const [key, val] of Object.entries(data)) {
        const item = document.createElement('span');
        item.className = 'balance-item';
        const pct = total > 0 ? Math.round((val / total) * 100) : 0;
        const label = labels[key] || key;
        item.innerHTML = `<span class="balance-label">${label}</span><span class="balance-value">${pct}%</span>`;
        group.appendChild(item);
    }

    return group;
}

function renderSpecialPoints(specialPoints) {
    const tbody = document.getElementById('specialPointsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!specialPoints || typeof specialPoints !== 'object') {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-secondary)">Нет специальных точек</td></tr>';
        return;
    }

    const pointsToShow = ['TrueNode', 'SouthNode', 'BlackMoon', 'WhiteMoon', 'PartOfFortune', 'Vertex'];
    let hasPoints = false;

    pointsToShow.forEach(pointName => {
        const point = specialPoints[pointName];
        if (point && point.longitude !== null) {
            hasPoints = true;
            const tr = document.createElement('tr');

            // 1. Точка (символ + название)
            const tdName = document.createElement('td');
            tdName.innerHTML = `<span class="planet-cell">
                <span class="planet-symbol">${getPlanetSymbol(pointName)}</span>
                <span class="planet-name">${getPlanetName(pointName)}</span>
            </span>`;
            tr.appendChild(tdName);

            // 2. Позиция
            const tdPos = document.createElement('td');
            tdPos.className = 'position-cell';
            const signSym = getSignSymbol(point.sign);
            const deg = formatDegree(point);
            tdPos.innerHTML = `${signSym} ${getSignName(point.sign)} ${deg}`;
            tr.appendChild(tdPos);

            // 3. Дом
            const tdHouse = document.createElement('td');
            tdHouse.textContent = point.house || '—';
            tr.appendChild(tdHouse);

            tbody.appendChild(tr);
        }
    });

    if (!hasPoints) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-secondary)">Нет специальных точек</td></tr>';
    }
}


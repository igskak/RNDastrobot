/**
 * Natal Full Page - Compact Tabular Display.
 */

const PLANET_ORDER = [
    'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
    'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
    'Chiron', 'Proserpina'
];

const DIGNITY_CODES = {
    domicile: 'H',
    exaltation: 'X',
    detriment: 'D',
    fall: 'F'
};

const FEATURE_KEYS = {
    anareta: 'astro.feature.short.anareta',
    royal: 'astro.feature.short.royal',
    jubilee: 'astro.feature.short.jubilee',
    destructive: 'astro.feature.short.destructive',
    middle: 'astro.feature.short.middle',
    combust: 'astro.feature.short.combust',
    cazimi: 'astro.feature.short.cazimi',
    under_rays: 'astro.feature.short.under_rays',
    handle: 'astro.feature.short.handle',
    aspect_king: 'astro.feature.short.aspect_king',
    doryphoros: 'astro.feature.short.doryphoros',
    charioteer: 'astro.feature.short.charioteer',
    almuten: 'astro.feature.short.almuten',
    elevated: 'astro.feature.short.elevated',
    peregrine: 'astro.feature.short.peregrine',
    intercepted: 'astro.feature.short.intercepted'
};

const BALANCE_KEYS = {
    Fire: 'astro.element.Fire',
    fire: 'astro.element.Fire',
    Earth: 'astro.element.Earth',
    earth: 'astro.element.Earth',
    Air: 'astro.element.Air',
    air: 'astro.element.Air',
    Water: 'astro.element.Water',
    water: 'astro.element.Water',
    Cardinal: 'astro.mode.short.Cardinal',
    cardinal: 'astro.mode.short.Cardinal',
    Fixed: 'astro.mode.short.Fixed',
    fixed: 'astro.mode.short.Fixed',
    Mutable: 'astro.mode.short.Mutable',
    mutable: 'astro.mode.short.Mutable',
    Masculine: 'astro.polarity.Masculine',
    masculine: 'astro.polarity.Masculine',
    Feminine: 'astro.polarity.Feminine',
    feminine: 'astro.polarity.Feminine'
};

const EMPTY = '—';

const S = () => window.Symbols || {};

function t(key, params) {
    return window.FrontendI18n?.t?.(key, params) || key;
}

function getTranslatedAstroName(type, name, fallbackMap) {
    if (!name) return EMPTY;
    const key = `astro.${type}.${name}`;
    const translated = t(key);
    if (translated !== key) return translated;
    return fallbackMap?.[name] || name;
}

function getPlanetSymbol(name) {
    return S().planets?.[name] || '';
}

function getSignSymbol(name) {
    return S().signs?.[name] || '';
}

function getPlanetName(name) {
    return getTranslatedAstroName('planet', name, S().planetNamesRu);
}

function getSignName(name) {
    return getTranslatedAstroName('sign', name, S().signNamesRu);
}

function getAspectSymbol(name) {
    return S().aspects?.[name] || '?';
}

function getAspectName(name) {
    return getTranslatedAstroName('aspect', name, S().aspectNamesRu);
}

function getPatternName(name) {
    const key = `astro.pattern.${name}`;
    const translated = t(key);
    return translated === key ? (name || EMPTY) : translated;
}

function getConfigName(type) {
    const key = `astro.configuration.${type}`;
    const translated = t(key);
    if (translated !== key) return translated;
    return (type || '').replace(/_/g, ' ') || EMPTY;
}

function getFeatureLabel(code) {
    const key = FEATURE_KEYS[code];
    if (!key) return code;
    const translated = t(key);
    return translated === key ? code : translated;
}

function getBalanceLabel(key) {
    const translationKey = BALANCE_KEYS[key];
    if (!translationKey) return key;
    const translated = t(translationKey);
    return translated === translationKey ? key : translated;
}

function noDataRow(columns, translationKey) {
    return `<tr><td colspan="${columns}" style="text-align:center;color:var(--text-secondary)">${t(translationKey)}</td></tr>`;
}

function setAspectsSortHeaderLabel(headerEl, field, indicator) {
    if (!headerEl) return;
    const key = field === 'type'
        ? 'page.natalFull.table.aspects.type'
        : 'page.natalFull.table.aspects.orb';
    headerEl.textContent = `${t(key)} ${indicator}`;
}

let chartData = null;
let aspectsSortState = { field: 'type', ascending: true };
let currentMajorAspects = [];

document.addEventListener('DOMContentLoaded', () => {
    const storedData = sessionStorage.getItem('natalChart');
    if (!storedData) {
        window.location.href = '/';
        return;
    }

    chartData = JSON.parse(storedData);

    renderFullChart(chartData);
    setupLegendToggle();
    updateInterpretationLinks(chartData);

    document.addEventListener('frontend:locale-changed', () => {
        if (!chartData) return;
        renderFullChart(chartData);
        if (window.FrontendI18nUi?.applyI18n) {
            window.FrontendI18nUi.applyI18n(document);
        }
    });
});

function setupLegendToggle() {
    const btn = document.getElementById('legendToggle');
    const panel = document.getElementById('legendPanel');
    if (!btn || !panel) return;

    btn.addEventListener('click', () => {
        panel.classList.toggle('hidden');
    });
}

function renderFullChart(data) {
    renderHeader(data);
    renderSummaryBar(data);
    renderPlanetsTable(data.planets, data.houses);
    renderHousesTable(data.houses, data.planets);
    renderAspectsTable(data.aspects || []);
    renderConfigurations(data.aspect_configurations || [], data.stelliums || []);
    renderBalances(data.balances);
    renderSpecialPoints(data.special_points || {});
}

function renderHeader(data) {
    const birthData = data.birth_data || {};
    const place = birthData.place || t('page.natalFull.header.unknownPlace');
    const chartTitle = document.getElementById('chartTitle');
    const birthDetails = document.getElementById('birthDetails');

    if (chartTitle) {
        chartTitle.textContent = t('page.natalFull.header.title', { place });
    }
    if (birthDetails) {
        birthDetails.textContent = `${birthData.date || ''} ${birthData.time || ''} (${birthData.timezone || EMPTY})`.trim();
    }
}

function renderSummaryBar(data) {
    const angles = data.angles;
    const planets = data.planets;
    const pattern = data.cosmogram_pattern;
    const balances = data.balances;

    if (angles?.ASC) {
        const asc = angles.ASC;
        document.getElementById('summaryAsc').textContent =
            `${getSignSymbol(asc.sign)} ${getSignName(asc.sign)} ${formatDegree(asc)}`;
    }

    if (angles?.MC) {
        const mc = angles.MC;
        document.getElementById('summaryMc').textContent =
            `${getSignSymbol(mc.sign)} ${getSignName(mc.sign)} ${formatDegree(mc)}`;
    }

    const sun = planets?.find((p) => p.name === 'Sun');
    if (sun) {
        document.getElementById('summarySun').textContent =
            `${getSignName(sun.sign)} ${formatDegree(sun)}`;
    }

    const moon = planets?.find((p) => p.name === 'Moon');
    if (moon) {
        document.getElementById('summaryMoon').textContent =
            `${getSignName(moon.sign)} ${formatDegree(moon)}`;
    }

    if (pattern) {
        let patternText = getPatternName(pattern.pattern_type) || EMPTY;
        if (pattern.handle_planet) {
            patternText += ` (${getPlanetName(pattern.handle_planet)})`;
        }
        document.getElementById('summaryPattern').textContent = patternText;
    }

    if (balances) {
        const dominants = [];
        if (balances.element_balance) {
            const maxEl = getMaxBalance(balances.element_balance);
            if (maxEl) dominants.push(`${maxEl.label} ${maxEl.pct}%`);
        }
        if (balances.mode_balance) {
            const maxMode = getMaxBalance(balances.mode_balance);
            if (maxMode) dominants.push(`${maxMode.label} ${maxMode.pct}%`);
        }
        if (balances.gender_balance) {
            const maxGender = getMaxBalance(balances.gender_balance);
            if (maxGender) dominants.push(`${maxGender.label} ${maxGender.pct}%`);
        }
        document.getElementById('summaryDominants').textContent = dominants.join(' | ');
    }
}

function getMaxBalance(balanceObj) {
    if (!balanceObj) return null;

    let max = { label: '', value: 0, pct: 0 };
    let total = 0;

    for (const [key, val] of Object.entries(balanceObj)) {
        total += val;
        if (val > max.value) {
            max = { label: getBalanceLabel(key), value: val };
        }
    }

    max.pct = total > 0 ? Math.round((max.value / total) * 100) : 0;
    return max;
}

function formatDegreeFull(deg) {
    if (deg === null || deg === undefined) return EMPTY;
    const d = Math.floor(deg);
    const minFloat = (deg - d) * 60;
    const m = Math.floor(minFloat);
    const s = Math.round((minFloat - m) * 60);
    return `${d}°${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"`;
}

function formatDegree(item) {
    if (item.degree_in_sign_formatted) return item.degree_in_sign_formatted;
    return formatDegreeFull(item.degree_in_sign);
}

function renderPlanetsTable(planets, houses) {
    const tbody = document.getElementById('planetsTableBody');
    tbody.innerHTML = '';

    const planetRuledHouses = {};
    if (houses) {
        houses.forEach((h) => {
            const ruler = h.ruler_planet;
            if (!ruler) return;
            if (!planetRuledHouses[ruler]) planetRuledHouses[ruler] = [];
            planetRuledHouses[ruler].push(h.number);
        });
    }

    const sortedPlanets = (planets || [])
        .filter((p) => PLANET_ORDER.includes(p.name))
        .sort((a, b) => PLANET_ORDER.indexOf(a.name) - PLANET_ORDER.indexOf(b.name));

    sortedPlanets.forEach((planet) => {
        if (!planet.ruled_houses || planet.ruled_houses.length === 0) {
            planet.ruled_houses = planetRuledHouses[planet.name] || [];
        }
        tbody.appendChild(createPlanetRow(planet));
    });
}

function createPlanetRow(planet) {
    const tr = document.createElement('tr');

    const tdName = document.createElement('td');
    tdName.innerHTML = `<span class="planet-cell">
        <span class="planet-symbol">${getPlanetSymbol(planet.name)}</span>
        <span class="planet-name">${getPlanetName(planet.name)}</span>
    </span>`;
    tr.appendChild(tdName);

    const tdPos = document.createElement('td');
    tdPos.className = 'position-cell';
    tdPos.innerHTML = `<span class="sign-symbol">${getSignSymbol(planet.sign)}</span>${getSignName(planet.sign)} ${formatDegree(planet)}`;
    tr.appendChild(tdPos);

    const tdHouse = document.createElement('td');
    tdHouse.className = [1, 4, 7, 10].includes(planet.house) ? 'angular-house' : '';
    tdHouse.textContent = planet.house || EMPTY;
    tr.appendChild(tdHouse);

    const tdDignity = document.createElement('td');
    if (planet.dignity && planet.dignity !== 'neutral') {
        const code = DIGNITY_CODES[planet.dignity] || planet.dignity[0].toUpperCase();
        tdDignity.innerHTML = `<span class="dignity-badge dignity-${planet.dignity}">${code}</span>`;
    } else {
        tdDignity.textContent = EMPTY;
    }
    tr.appendChild(tdDignity);

    const tdHarmony = document.createElement('td');
    if (planet.aspect_harmony) {
        const harmonyLabels = {
            harmonious: { text: '✓', class: 'harmony-good', title: t('page.natalFull.legend.harmony.good') },
            tense: { text: '✗', class: 'harmony-bad', title: t('page.natalFull.legend.harmony.bad') },
            mixed: { text: '~', class: 'harmony-mixed', title: t('page.natalFull.legend.harmony.mixed') }
        };
        const h = harmonyLabels[planet.aspect_harmony] || { text: '?', class: '', title: '' };
        tdHarmony.innerHTML = `<span class="harmony-badge ${h.class}" title="${h.title}">${h.text}</span>`;
    } else {
        tdHarmony.textContent = EMPTY;
    }
    tr.appendChild(tdHarmony);

    const tdMove = document.createElement('td');
    if (planet.is_stationary) {
        tdMove.innerHTML = '<span class="move-badge move-s">S</span>';
    } else if (planet.retrograde) {
        tdMove.innerHTML = '<span class="move-badge move-r">R</span>';
    } else {
        tdMove.innerHTML = '<span class="move-badge move-d">D</span>';
    }
    tr.appendChild(tdMove);

    const tdSpeed = document.createElement('td');
    tdSpeed.className = 'speed-cell';
    const speedPct = planet.speed_percent;

    if ((speedPct === undefined || speedPct === null) && planet.speed !== undefined) {
        const rawSpeed = Math.abs(planet.speed).toFixed(2);
        tdSpeed.textContent = rawSpeed > 0
            ? t('page.natalFull.units.degPerDay', { value: rawSpeed })
            : EMPTY;
    } else if (speedPct !== undefined && speedPct !== null) {
        let speedClass = '';
        if (speedPct < 80) speedClass = 'speed-slow';
        else if (speedPct > 120) speedClass = 'speed-very-fast';
        else if (speedPct > 100) speedClass = 'speed-fast';
        tdSpeed.innerHTML = `<span class="${speedClass}">${Math.round(speedPct)}%</span>`;
    } else {
        tdSpeed.textContent = EMPTY;
    }
    tr.appendChild(tdSpeed);

    const tdKarma = document.createElement('td');
    tdKarma.className = 'karma-cell';
    const minus = planet.karmic_minus_score || 0;
    const plus = planet.karmic_plus_score || 0;
    const total = planet.karmic_score;

    if (minus > 0 || plus > 0 || total) {
        let karmaClass = '';
        if (minus > plus) karmaClass = 'karma-negative';
        else if (plus > minus) karmaClass = 'karma-positive';
        else karmaClass = 'karma-neutral';

        if (minus > 0 || plus > 0) {
            let calculatedTotal = 0;
            if (minus > 3) calculatedTotal += minus;
            if (plus > 3) calculatedTotal += plus;
            tdKarma.innerHTML = `<span class="${karmaClass}">${calculatedTotal} (-${minus}|+${plus})</span>`;
        } else if (total) {
            tdKarma.innerHTML = `<span class="${karmaClass}">${total}</span>`;
        }
    } else {
        tdKarma.textContent = EMPTY;
    }
    tr.appendChild(tdKarma);

    const tdFeatures = document.createElement('td');
    tdFeatures.className = 'features-cell';
    const features = [];

    if (planet.critical_degrees?.length > 0) {
        planet.critical_degrees.forEach((deg) => {
            features.push(getFeatureLabel(deg));
        });
    }

    if (planet.sun_relation) {
        features.push(getFeatureLabel(planet.sun_relation));
    }

    if (planet.is_elevated) features.push(getFeatureLabel('elevated'));
    if (planet.is_peregrine) features.push(getFeatureLabel('peregrine'));
    if (planet.in_intercepted_sign) features.push(getFeatureLabel('intercepted'));

    if (planet.special_roles?.length > 0) {
        planet.special_roles.forEach((role) => {
            features.push(getFeatureLabel(role));
        });
    }

    tdFeatures.textContent = features.length > 0 ? features.join(', ') : EMPTY;
    tr.appendChild(tdFeatures);

    const tdRuled = document.createElement('td');
    tdRuled.className = 'ruled-houses';
    tdRuled.textContent = planet.ruled_houses?.length > 0
        ? planet.ruled_houses.join(',')
        : EMPTY;
    tr.appendChild(tdRuled);

    return tr;
}

function renderHousesTable(houses, planets) {
    const tbody = document.getElementById('housesTableBody');
    tbody.innerHTML = '';

    const planetsByHouse = {};
    (planets || []).forEach((p) => {
        if (!p.house) return;
        if (!planetsByHouse[p.house]) planetsByHouse[p.house] = [];
        planetsByHouse[p.house].push(p.name);
    });

    const planetToHouse = {};
    (planets || []).forEach((p) => {
        if (p.house) planetToHouse[p.name] = p.house;
    });

    (houses || []).forEach((house) => {
        const tr = document.createElement('tr');

        const tdNum = document.createElement('td');
        tdNum.className = [1, 4, 7, 10].includes(house.number) ? 'angular-house' : '';
        tdNum.textContent = house.number;
        tr.appendChild(tdNum);

        const tdSign = document.createElement('td');
        tdSign.className = 'position-cell';
        tdSign.innerHTML = `${getSignSymbol(house.sign)} ${getSignName(house.sign)} ${formatDegree(house)}`;
        tr.appendChild(tdSign);

        const tdRuler = document.createElement('td');
        let rulerText = getPlanetName(house.ruler_planet);
        if (house.co_rulers?.length > 0) {
            const coRulerNames = house.co_rulers.map((p) => getPlanetName(p)).join(', ');
            rulerText += ` (${coRulerNames})`;
        }
        tdRuler.textContent = rulerText;
        tr.appendChild(tdRuler);

        const tdRulerHouse = document.createElement('td');
        const rulerHouse = house.ruler_in_house || planetToHouse[house.ruler_planet];
        tdRulerHouse.textContent = rulerHouse || EMPTY;
        tr.appendChild(tdRulerHouse);

        const tdIncluded = document.createElement('td');
        if (house.included_sign) {
            tdIncluded.textContent = getSignName(house.included_sign);
            tdIncluded.className = 'included-sign';
        } else {
            tdIncluded.textContent = EMPTY;
        }
        tr.appendChild(tdIncluded);

        const tdPlanets = document.createElement('td');
        const housePlanets = house.planets_in_house || planetsByHouse[house.number] || [];
        if (housePlanets.length > 0) {
            const shortNames = housePlanets.map((p) => {
                const name = getPlanetName(p);
                return name.length > 4 ? name.substring(0, 3) : name;
            });
            tdPlanets.textContent = shortNames.join(', ');
            tdPlanets.title = housePlanets.map((p) => getPlanetName(p)).join(', ');
        } else {
            tdPlanets.textContent = EMPTY;
        }
        tr.appendChild(tdPlanets);

        tbody.appendChild(tr);
    });
}

function renderAspectsTable(aspects) {
    const majorBody = document.getElementById('aspectsTableBody');
    const minorBody = document.getElementById('minorAspectsTableBody');

    majorBody.innerHTML = '';
    minorBody.innerHTML = '';

    if (!aspects || aspects.length === 0) {
        majorBody.innerHTML = noDataRow(3, 'page.natalFull.empty.noAspects');
        return;
    }

    currentMajorAspects = aspects.filter((a) => a.is_major);
    const minorAspects = aspects.filter((a) => !a.is_major);

    renderSortedMajorAspects();

    minorAspects.forEach((aspect) => {
        minorBody.appendChild(createAspectRow(aspect));
    });

    initAspectsSortHandlers();
}

function renderSortedMajorAspects() {
    const majorBody = document.getElementById('aspectsTableBody');
    majorBody.innerHTML = '';

    const typeOrder = ['Conjunction', 'Opposition', 'Trine', 'Square', 'Sextile'];
    const sorted = [...currentMajorAspects].sort((a, b) => {
        if (aspectsSortState.field === 'type') {
            const cmp = typeOrder.indexOf(a.aspect_type) - typeOrder.indexOf(b.aspect_type);
            return aspectsSortState.ascending ? cmp : -cmp;
        }
        const cmp = a.orb - b.orb;
        return aspectsSortState.ascending ? cmp : -cmp;
    });

    sorted.forEach((aspect) => {
        majorBody.appendChild(createAspectRow(aspect));
    });
}

function initAspectsSortHandlers() {
    document.querySelectorAll('#aspectsSection th.sortable').forEach((th) => {
        th.style.cursor = 'pointer';
        th.onclick = () => {
            const field = th.dataset.sort;
            if (aspectsSortState.field === field) {
                aspectsSortState.ascending = !aspectsSortState.ascending;
            } else {
                aspectsSortState.field = field;
                aspectsSortState.ascending = true;
            }

            document.querySelectorAll('#aspectsSection th.sortable').forEach((header) => {
                setAspectsSortHeaderLabel(header, header.dataset.sort, '⇅');
            });
            setAspectsSortHeaderLabel(th, field, aspectsSortState.ascending ? '↑' : '↓');
            renderSortedMajorAspects();
        };
    });
}

function createAspectRow(aspect) {
    const tr = document.createElement('tr');

    if (aspect.harmonic_type === 'harmonious') {
        tr.className = 'aspect-row-harmonious';
    } else if (aspect.harmonic_type === 'tense') {
        tr.className = 'aspect-row-tense';
    } else {
        tr.className = 'aspect-row-neutral';
    }

    const tdSymbol = document.createElement('td');
    tdSymbol.className = 'aspect-symbol';
    tdSymbol.innerHTML = `${getAspectSymbol(aspect.aspect_type)} <span class="aspect-name">${getAspectName(aspect.aspect_type)}</span>`;
    tr.appendChild(tdSymbol);

    const tdPlanets = document.createElement('td');
    tdPlanets.textContent = `${getPlanetName(aspect.planet_1)} - ${getPlanetName(aspect.planet_2)}`;
    tr.appendChild(tdPlanets);

    const tdOrb = document.createElement('td');
    tdOrb.className = 'aspect-orb';
    const orbStr = `${aspect.orb.toFixed(1)}°`;
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
        container.innerHTML = `<p style="color: var(--text-secondary);">${t('page.natalFull.empty.noConfigurations')}</p>`;
        return;
    }

    const row = document.createElement('div');
    row.className = 'configs-row';

    const sortedConfigs = hasConfigs
        ? [...configurations].sort((a, b) => (b.strength_score || 0) - (a.strength_score || 0))
        : [];
    sortedConfigs.forEach((config) => row.appendChild(createConfigCard(config)));

    const sortedStelliums = hasStelliums
        ? [...stelliums].sort((a, b) => (b.count || 0) - (a.count || 0))
        : [];
    sortedStelliums.forEach((stellium) => row.appendChild(createStelliumCard(stellium)));

    container.appendChild(row);
}

function createConfigCard(config) {
    const card = document.createElement('div');
    card.className = 'config-card';

    const header = document.createElement('div');
    header.className = 'config-header';

    const type = document.createElement('div');
    type.className = 'config-type';
    type.textContent = getConfigName(config.type);

    const strength = document.createElement('div');
    strength.className = 'config-strength';
    strength.textContent = config.strength_score ? config.strength_score.toFixed(0) : '';

    header.appendChild(type);
    header.appendChild(strength);
    card.appendChild(header);

    const planets = document.createElement('div');
    planets.className = 'config-planets';
    planets.textContent = (config.planets_involved || []).map((p) => getPlanetSymbol(p)).join(' ');
    card.appendChild(planets);

    if (config.apex_planet) {
        const details = document.createElement('div');
        details.className = 'config-details';
        details.textContent = t('page.natalFull.config.apex', { planet: getPlanetName(config.apex_planet) });
        card.appendChild(details);
    }

    if (config.aspects && config.aspects.length > 0) {
        const aspectsList = document.createElement('div');
        aspectsList.className = 'config-aspects-list';

        config.aspects.forEach((asp) => {
            const aspectItem = document.createElement('div');
            aspectItem.className = 'config-aspect-item';
            aspectItem.textContent = `${getPlanetName(asp.planet_1)} ${getAspectSymbol(asp.aspect_type)} ${getPlanetName(asp.planet_2)} (${asp.orb.toFixed(1)}°)`;
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
        : t('page.natalFull.config.house', { house: stellium.house_number });
    type.textContent = t('page.natalFull.config.stellium', { location });

    const count = document.createElement('div');
    count.className = 'config-strength';
    count.textContent = stellium.count;

    header.appendChild(type);
    header.appendChild(count);
    card.appendChild(header);

    const planets = document.createElement('div');
    planets.className = 'config-planets';
    planets.textContent = (stellium.planets || []).map((p) => getPlanetSymbol(p)).join(' ');
    card.appendChild(planets);

    const planetsList = document.createElement('div');
    planetsList.className = 'config-aspects-list';
    (stellium.planets || []).forEach((planetName) => {
        const planetItem = document.createElement('div');
        planetItem.className = 'config-aspect-item';
        planetItem.textContent = getPlanetName(planetName);
        planetsList.appendChild(planetItem);
    });

    card.appendChild(planetsList);
    return card;
}

function renderBalances(balances) {
    const container = document.getElementById('balancesContainer');
    if (!container) return;

    container.innerHTML = '';

    if (!balances) {
        container.innerHTML = `<p style="color: var(--text-secondary);">${t('page.natalFull.empty.noBalances')}</p>`;
        return;
    }

    const row = document.createElement('div');
    row.className = 'balances-compact';

    if (balances.element_balance) {
        row.appendChild(createBalanceGroup(
            t('page.natalFull.balances.elements'),
            balances.element_balance
        ));
    }

    if (balances.mode_balance) {
        row.appendChild(createBalanceGroup(
            t('page.natalFull.balances.modes'),
            balances.mode_balance
        ));
    }

    if (balances.gender_balance) {
        row.appendChild(createBalanceGroup(
            t('page.natalFull.balances.polarity'),
            balances.gender_balance
        ));
    }

    container.appendChild(row);
}

function createBalanceGroup(icon, data) {
    const group = document.createElement('div');
    group.className = 'balance-group';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'balance-icon';
    iconSpan.textContent = icon;
    group.appendChild(iconSpan);

    let total = 0;
    for (const val of Object.values(data)) total += val;

    for (const [key, val] of Object.entries(data)) {
        const item = document.createElement('span');
        item.className = 'balance-item';
        const pct = total > 0 ? Math.round((val / total) * 100) : 0;
        item.innerHTML = `<span class="balance-label">${getBalanceLabel(key)}</span><span class="balance-value">${pct}%</span>`;
        group.appendChild(item);
    }

    return group;
}

function renderSpecialPoints(specialPoints) {
    const tbody = document.getElementById('specialPointsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!specialPoints || typeof specialPoints !== 'object') {
        tbody.innerHTML = noDataRow(4, 'page.natalFull.empty.noSpecialPoints');
        return;
    }

    const pointsToShow = ['TrueNode', 'SouthNode', 'BlackMoon', 'WhiteMoon', 'PartOfFortune', 'Vertex'];
    let hasPoints = false;

    pointsToShow.forEach((pointName) => {
        const point = specialPoints[pointName];
        if (!point || point.longitude === null) return;

        hasPoints = true;
        const tr = document.createElement('tr');

        const tdName = document.createElement('td');
        tdName.innerHTML = `<span class="planet-cell">
            <span class="planet-symbol">${getPlanetSymbol(pointName)}</span>
            <span class="planet-name">${getPlanetName(pointName)}</span>
        </span>`;
        tr.appendChild(tdName);

        const tdPos = document.createElement('td');
        tdPos.className = 'position-cell';
        tdPos.innerHTML = `${getSignSymbol(point.sign)} ${getSignName(point.sign)} ${formatDegree(point)}`;
        tr.appendChild(tdPos);

        const tdHouse = document.createElement('td');
        tdHouse.textContent = point.house || EMPTY;
        tr.appendChild(tdHouse);

        tbody.appendChild(tr);
    });

    if (!hasPoints) {
        tbody.innerHTML = noDataRow(3, 'page.natalFull.empty.noSpecialPoints');
    }
}

function updateInterpretationLinks(data) {
    const userId = data.user_id || localStorage.getItem('currentUserId');
    if (!userId) return;

    const links = document.querySelectorAll('a[href="interpretations.html"]');
    links.forEach((link) => {
        link.href = `interpretations.html?user_id=${userId}`;
    });
}

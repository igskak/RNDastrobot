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
    oriental: 'astro.feature.short.oriental',
    occidental: 'astro.feature.short.occidental',
    out_of_bounds: 'astro.feature.short.out_of_bounds',
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
    feminine: 'astro.polarity.Feminine',
    brahma: 'page.natalFull.balances.brahma',
    vishnu: 'page.natalFull.balances.vishnu',
    shiva: 'page.natalFull.balances.shiva',
    lower: 'page.natalFull.balances.lower',
    upper: 'page.natalFull.balances.upper',
    eastern: 'page.natalFull.balances.east',
    western: 'page.natalFull.balances.west',
    q1: 'page.natalFull.balances.quadrant1',
    q2: 'page.natalFull.balances.quadrant2',
    q3: 'page.natalFull.balances.quadrant3',
    q4: 'page.natalFull.balances.quadrant4',
    angular: 'page.natalFull.balances.angular',
    succedent: 'page.natalFull.balances.succedent',
    cadent: 'page.natalFull.balances.cadent'
};

const EMPTY = '—';

const S = () => window.Symbols || {};

function t(key, params) {
    return window.FrontendI18n?.t?.(key, params) || key;
}

async function waitForI18nReady() {
    if (!window.FrontendI18n?.ready) return;
    await Promise.resolve(window.FrontendI18n.ready).catch(() => {});
}

async function loadFreshNatalFullChartData(fallbackChartData) {
    if (fallbackChartData?.chart_kind === 'composite') {
        return fallbackChartData;
    }
    const userId = fallbackChartData?.user_id || localStorage.getItem('currentUserId');
    if (!userId || !window.AstroAPI?.getNatalChart) {
        return fallbackChartData;
    }

    try {
        const freshChartData = await window.AstroAPI.getNatalChart(userId);
        const ensuredChartData = freshChartData?.user_id
            ? freshChartData
            : { ...freshChartData, user_id: userId };
        window.AstroAPI?.saveChartToSession?.(ensuredChartData);
        return ensuredChartData;
    } catch (error) {
        console.warn('Natal Full fresh chart fallback to session:', error);
        return fallbackChartData;
    }
}

function formatHeaderTimezone(value, options = {}) {
    return window.Timezones?.formatOffsetLabel?.(value, options) || String(value || '').trim();
}

function getTranslatedAstroName(type, name, fallbackMap) {
    if (!name) return EMPTY;
    const key = `astro.${type}.${name}`;
    const translated = t(key);
    if (translated !== key) return translated;
    return fallbackMap?.[name] || name;
}

function getPlanetSymbol(name) {
    return S().getPlanetSymbol?.(name) || S().planets?.[name] || '';
}

function getPlanetSymbolMarkup(name, options = {}) {
    return S().getPlanetSymbolMarkup?.(name, options)
        || `<span class="planet-symbol">${escapeHtml(getPlanetSymbol(name))}</span>`;
}

function getSignSymbol(name) {
    return S().signs?.[name] || '';
}

function getPlanetName(name) {
    return getTranslatedAstroName('planet', name, {
        ...(S().planetNamesRu || {}),
        [name]: S().getPlanetNameRu?.(name) || (S().planetNamesRu?.[name] || name)
    });
}

function getSignName(name) {
    return getTranslatedAstroName('sign', name, S().signNamesRu);
}

function getAspectSymbol(name) {
    return S().getAspectDisplay?.(name) || S().aspects?.[name] || '?';
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

function formatHouseNumber(number) {
    if (number === null || number === undefined || number === '') return '';
    return S().formatHouseLabel?.(number) || String(number);
}

function formatHouseList(houses, separator = ', ') {
    if (!Array.isArray(houses) || !houses.length) return '';
    return S().formatHouseList?.(houses, { separator }) || houses.map((house) => formatHouseNumber(house)).join(separator);
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
let retrogradeByBody = new Map();

const RETRO_ALIASES = {
    TrueNorthNode: 'TrueNode',
    TrueSouthNode: 'SouthNode',
    Fortune: 'PartOfFortune'
};

function normalizeBodyName(name) {
    return RETRO_ALIASES[name] || name;
}

function normalizeAspectBodyName(name) {
    return window.ChartDataRenderer?.ASPECT_NAME_ALIASES?.[name] || normalizeBodyName(name);
}

function getAspectBodyRank(name) {
    return window.ChartDataRenderer?.ASPECT_SORT_RANK?.[normalizeAspectBodyName(name)] ?? 999;
}

function buildAspectKey(planetA, planetB) {
    const left = normalizeAspectBodyName(planetA);
    const right = normalizeAspectBodyName(planetB);
    const leftRank = getAspectBodyRank(left);
    const rightRank = getAspectBodyRank(right);

    if (leftRank < rightRank) return `${left}-${right}`;
    if (rightRank < leftRank) return `${right}-${left}`;
    return left <= right ? `${left}-${right}` : `${right}-${left}`;
}

function getAspectKey(aspect) {
    if (!aspect) return null;
    const left = aspect.left_planet || aspect.planet_1;
    const right = aspect.right_planet || aspect.planet_2;
    if (!left || !right) return null;
    return buildAspectKey(left, right);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getRetrogradeLabel() {
    const key = 'page.natalFull.legend.motion.retrograde';
    const translated = t(key);
    return translated === key ? 'Retrograde' : translated;
}

function retroIndicatorHtml(isRetrograde, variantClass = '') {
    if (!isRetrograde) return '';
    const suffix = variantClass ? ` ${variantClass}` : '';
    const label = escapeHtml(getRetrogradeLabel());
    return `<span class="retro-indicator${suffix}" title="${label}" aria-label="${label}">R</span>`;
}

function buildRetrogradeLookup(planets = []) {
    const map = new Map();
    planets.forEach((planet) => {
        if (!planet?.name) return;
        map.set(normalizeBodyName(planet.name), Boolean(planet.retrograde));
    });
    return map;
}

function isBodyRetrograde(name) {
    if (!name) return false;
    return retrogradeByBody.get(normalizeBodyName(name)) === true;
}

function formatPlanetNameWithRetro(name, options = {}) {
    const { short = false, markerClass = 'retro-indicator--small' } = options;
    const fullName = getPlanetName(name);
    const label = short && fullName.length > 4 ? fullName.substring(0, 3) : fullName;
    return `${escapeHtml(label)}${retroIndicatorHtml(isBodyRetrograde(name), markerClass)}`;
}

function buildPlanetHouseLookup(planets = []) {
    const lookup = {};
    (planets || []).forEach((planet) => {
        if (!planet?.name || !planet.house) return;
        lookup[normalizeBodyName(planet.name)] = planet.house;
    });
    return lookup;
}

function buildHouseRulerGroups(house, planetToHouse = {}) {
    if (Array.isArray(house?.ruler_groups) && house.ruler_groups.length) {
        return house.ruler_groups
            .map((group) => ({
                included: group?.scope === 'included',
                entries: (group?.entries || []).map((entry) => ({
                    planet: entry.planet,
                    house: entry.house ?? planetToHouse[normalizeBodyName(entry.planet)] ?? null,
                })),
            }))
            .filter((group) => group.entries.length);
    }

    const entries = [];
    const fallbackPlanets = [house?.ruler_planet, ...(Array.isArray(house?.co_rulers) ? house.co_rulers : [])];
    const seen = new Set();

    fallbackPlanets.forEach((planetName, index) => {
        if (!planetName) return;
        const normalizedName = normalizeBodyName(planetName);
        if (seen.has(normalizedName)) return;
        seen.add(normalizedName);
        entries.push({
            planet: planetName,
            house: index === 0 && house?.ruler_in_house != null && house?.ruler_in_house !== ''
                ? house.ruler_in_house
                : planetToHouse[normalizedName] ?? null,
        });
    });

    return entries.length ? [{ entries, included: false }] : [];
}

function renderHouseRulerGroups(house, planetToHouse = {}) {
    const groups = buildHouseRulerGroups(house, planetToHouse);
    if (!groups.length) return EMPTY;

    return groups.map((group) => {
        const groupClass = group.included
            ? 'house-ruler-group house-ruler-group--included'
            : 'house-ruler-group';

        return `
            <div class="${groupClass}">
                ${group.entries.map((entry) => {
                    const planetName = getPlanetName(entry.planet);
                    const houseLabel = entry.house != null && entry.house !== ''
                        ? formatHouseNumber(entry.house)
                        : '';
                    const titleParts = [planetName];
                    if (houseLabel) {
                        titleParts.push(`${t('common.house')} ${houseLabel}`);
                    }
                    return `
                        <div class="house-ruler-line" title="${escapeHtml(titleParts.join(' • '))}">
                            <span class="house-ruler-symbol-wrap">
                                ${getPlanetSymbolMarkup(entry.planet, { size: 16, title: planetName })}
                                ${retroIndicatorHtml(isBodyRetrograde(entry.planet), 'retro-indicator--micro house-ruler-retro')}
                            </span>
                            <span class="house-ruler-planet-name">${escapeHtml(planetName)}</span>
                            <span class="house-ruler-house-inline">${escapeHtml(houseLabel || EMPTY)}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    const i18nReady = waitForI18nReady();
    bootstrapNatalFull(i18nReady);
});

async function bootstrapNatalFull(i18nReady) {
    // auth, префы, локаль и свежий расчёт натала независимы — стартуем разом.
    const authReady = Promise.resolve(
        window.AstroAPI?.requireAuth?.({ redirectTo: '/login.html' })
    );
    const prefsReady = loadAccountPreferences();

    // Данные карты лежат в sessionStorage — парсим синхронно и запускаем свежий
    // (тяжёлый серверный) расчёт натала параллельно auth/локали/префам. Функция
    // сама обрабатывает ошибки и не реджектит, поэтому ранний старт безопасен.
    const storedData = sessionStorage.getItem('natalChart');
    if (!storedData) {
        window.location.href = '/';
        return;
    }
    let parsedChartData;
    try {
        parsedChartData = JSON.parse(storedData);
    } catch (error) {
        console.warn('Natal Full invalid session chart data:', error);
        window.location.href = '/';
        return;
    }
    const freshChartReady = loadFreshNatalFullChartData(parsedChartData);

    const me = await authReady;
    if (!me) return;

    await Promise.all([Promise.resolve(i18nReady), prefsReady]);

    chartData = await freshChartReady;
    window.AstroOnboarding?.trackFirstChartViewed?.(chartData?.user_id, {
        source: 'natal_full',
    });
    configureNatalFullNavigation();
    setupNatalFullActionsMenu();

    renderFullChart(chartData);
    setupLegendToggle();
    // Карта и отчёт отрендерены — снимаем лоадер (страница помечена data-defer-loader).
    window.AstroAPI?.hidePageLoader?.();
    document.addEventListener('frontend:locale-changed', () => {
        if (!chartData) return;
        const viewState = captureNatalFullViewState();
        renderFullChart(chartData);
        restoreNatalFullViewState(viewState);
        if (window.FrontendI18nUi?.applyI18n) {
            window.FrontendI18nUi.applyI18n(document);
        }
    });
}

// Префы аккаунта — вынесено, чтобы фетч шёл параллельно auth/локали/расчёту.
async function loadAccountPreferences() {
    if (!window.AstroAPI?.getAccountPreferences) return;
    try {
        window.accountPreferencesCache = await window.AstroAPI.getAccountPreferences();
        window.AstroPreferences?.setAccountVisualPreferences?.(window.accountPreferencesCache?.visual || {});
    } catch (error) {
        console.warn('Natal Full account preferences fallback to defaults:', error);
    }
}

function captureNatalFullViewState() {
    return {
        scrollY: window.scrollY,
        openSections: Object.fromEntries([...document.querySelectorAll('details.report-section[id], details.section[id]')]
            .map((section) => [section.id, section.open])),
        activeBalanceTab: document.querySelector('[data-balance-tab].active')?.dataset?.balanceTab || null,
        legendOpen: !document.getElementById('legendPanel')?.classList.contains('hidden'),
    };
}

function restoreNatalFullViewState(viewState = {}) {
    Object.entries(viewState.openSections || {}).forEach(([id, isOpen]) => {
        const section = document.getElementById(id);
        if (section instanceof HTMLDetailsElement) section.open = isOpen === true;
    });

    if (viewState.activeBalanceTab) {
        const button = document.querySelector(`[data-balance-tab="${viewState.activeBalanceTab}"]`);
        button?.click();
    }

    const legendPanel = document.getElementById('legendPanel');
    if (legendPanel && viewState.legendOpen) legendPanel.classList.remove('hidden');
    requestAnimationFrame(() => window.scrollTo({ top: viewState.scrollY || 0 }));
}

function setupLegendToggle() {
    const btn = document.getElementById('legendToggle');
    const panel = document.getElementById('legendPanel');
    if (!btn || !panel) return;

    btn.addEventListener('click', () => {
        panel.classList.toggle('hidden');
    });
}

function setupNatalFullActionsMenu() {
    const toggle = document.getElementById('natalFullActionsToggle');
    const menu = document.getElementById('natalFullActionsMenu');
    if (!toggle || !menu) return;

    const setOpen = (isOpen) => {
        menu.classList.toggle('hidden', !isOpen);
        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    };

    toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        setOpen(menu.classList.contains('hidden'));
    });
    menu.addEventListener('click', () => setOpen(false));
    menu.addEventListener('click', (event) => event.stopPropagation());
    document.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') setOpen(false);
    });
}

function getNatalFullNavigationState() {
    return window.AstroAPI?.getNavigationState?.() || {};
}

function getNatalFullUserId() {
    return chartData?.user_id || window.AstroAPI?.getFormData?.()?.userId || null;
}

function numberOrUndefined(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
}

function buildNatalFullInlineSource() {
    const birth = chartData?.birth_data || {};
    if (!birth.date || !birth.time || !birth.timezone) return null;
    const latitude = numberOrUndefined(birth.latitude);
    const longitude = numberOrUndefined(birth.longitude);
    if (!birth.place && (latitude === undefined || longitude === undefined)) return null;

    return {
        first_name: birth.first_name || undefined,
        last_name: birth.last_name || undefined,
        date: birth.date,
        time: birth.time,
        timezone: birth.timezone,
        place: birth.place || undefined,
        latitude,
        longitude,
        house_system: birth.house_system || 'P',
        zodiac: birth.zodiac || 'tropical',
        ayanamsha: birth.ayanamsha || 'lahiri',
    };
}

function buildNatalFullSourcePayload() {
    const userId = getNatalFullUserId();
    if (userId) return { user_id: userId };
    const natal = buildNatalFullInlineSource();
    return natal ? { natal } : {};
}

function selectedNatalFullDateTime() {
    const birth = chartData?.birth_data || {};
    return birth.date ? `${birth.date}T${birth.time || '12:00:00'}` : '';
}

function findNatalFullAspect(aspectKey, aspectType) {
    if (!aspectKey) return null;
    const aspects = Array.isArray(chartData?.aspects) ? chartData.aspects : [];
    return aspects.find((aspect) => (
        getAspectKey(aspect) === aspectKey
        && (!aspectType || aspect.aspect_type === aspectType)
    )) || null;
}

function openNatalFullAspectDynamics(aspectKey, aspectType) {
    const aspect = findNatalFullAspect(aspectKey, aspectType);
    if (!aspect) {
        window.showToast?.(t('page.forecastNew.aspectDynamics.errors.missingContext'), 'warning');
        return;
    }

    window.ForecastAspectDynamicsModal?.open({
        method: 'natal',
        natalSource: buildNatalFullSourcePayload(),
        userId: getNatalFullUserId(),
        timezone: chartData?.birth_data?.timezone || 'UTC',
        selectedDateTime: selectedNatalFullDateTime(),
        aspect: { ...aspect, method: 'natal' },
    });
}

function setupNatalAspectDynamicsHandlers() {
    const section = document.getElementById('aspectsSection');
    if (!section || section.dataset.aspectDynamicsReady === 'true') return;
    section.dataset.aspectDynamicsReady = 'true';

    section.addEventListener('click', (event) => {
        if (!(event.target instanceof Element)) return;
        const row = event.target.closest('tbody tr[data-aspect-key]');
        if (!row) return;
        openNatalFullAspectDynamics(row.dataset.aspectKey, row.dataset.aspectType);
    });

    section.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (!(event.target instanceof Element)) return;
        const row = event.target.closest('tbody tr[data-aspect-key]');
        if (!row) return;
        event.preventDefault();
        openNatalFullAspectDynamics(row.dataset.aspectKey, row.dataset.aspectType);
    });
}

function configureNatalFullNavigation() {
    const navState = getNatalFullNavigationState();
    const currentUserId = getNatalFullUserId();
    const backBtn = document.getElementById('natalFullBackBtn');
    const wheelBtn = document.querySelector('.header-actions a[href="forecast-new.html?tab=biwheel"]');
    const forecastBtn = document.querySelector('.header-actions a[href="forecast-new.html"]');
    const synastryBtn = document.getElementById('openNatalFullSynastryBtn');
    const hasMatchingPartner = String(navState.clientUserId || '') === String(currentUserId || '') && navState.partnerUserId;

    if (backBtn) {
        backBtn.href = navState.sourceUrl || '/';
    }

    if (synastryBtn) {
        synastryBtn.setAttribute('aria-disabled', currentUserId ? 'false' : 'true');
    }

    window.AstroAPI?.patchNavigationState?.({
        currentView: 'natal-full',
        clientUserId: currentUserId ? String(currentUserId) : navState.clientUserId,
        partnerUserId: hasMatchingPartner ? String(navState.partnerUserId) : null,
    });

    wheelBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        window.AstroAPI?.saveNavigationState?.({
            sourceView: 'natal-full',
            sourceUrl: '/natal-full.html',
            clientUserId: currentUserId ? String(currentUserId) : navState.clientUserId,
            partnerUserId: hasMatchingPartner ? String(navState.partnerUserId) : null,
        });
        window.showPageLoader?.();
        window.location.href = '/forecast-new.html?tab=biwheel';
    });

    forecastBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        window.AstroAPI?.saveNavigationState?.({
            sourceView: 'natal-full',
            sourceUrl: '/natal-full.html',
            clientUserId: currentUserId ? String(currentUserId) : navState.clientUserId,
            partnerUserId: hasMatchingPartner ? String(navState.partnerUserId) : null,
        });
        window.showPageLoader?.();
        window.location.href = '/forecast-new.html';
    });

    synastryBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        if (!currentUserId) return;
        if (hasMatchingPartner) {
            // Known partner → open forecast-new with the synastry layer preloaded.
            window.AstroAPI?.openForecastForSynastry?.(currentUserId, navState.partnerUserId, {
                sourceView: 'natal-full',
                sourceUrl: '/natal-full.html',
            });
            return;
        }
        // No partner yet → land on forecast-new; astrologer picks the partner in-panel.
        window.AstroAPI?.saveNavigationState?.({
            sourceView: 'natal-full',
            sourceUrl: '/natal-full.html',
            clientUserId: currentUserId ? String(currentUserId) : navState.clientUserId,
            partnerUserId: null,
        });
        window.showPageLoader?.();
        window.location.href = '/forecast-new.html?layer=synastry_partner';
    });
}

function renderFullChart(data) {
    retrogradeByBody = buildRetrogradeLookup(data.planets || []);
    renderHeader(data);
    renderSummaryBar(data);
    renderReportIntro(data);
    renderPlanetsTable(data.planets, data.houses);
    renderHousesTable(data.houses, data.planets);
    renderAspectsTable(data.aspects || []);
    renderConfigurations(data.aspect_configurations || [], data.stelliums || []);
    renderBalances(data.balances);
    renderNatalFullRulers(data);
    renderSpecialPoints(data.special_points || {});
    updateSectionCounts(data);
    setupNatalAspectDynamicsHandlers();
    setupReportSections();
    setupReportShortcuts();
}

function renderHeader(data) {
    const birthData = data.birth_data || {};
    const formData = window.AstroAPI?.getFormData?.();
    const firstName = birthData.first_name || formData?.firstName || '';
    const lastName = birthData.last_name || formData?.lastName || '';
    const clientName = [firstName, lastName].filter(Boolean).join(' ').trim();
    const place = getBirthPlaceLabel(birthData, formData) || t('page.natalFull.header.unknownPlace');
    const chartTitle = document.getElementById('chartTitle');
    const birthDetails = document.getElementById('birthDetails');

    if (chartTitle) {
        chartTitle.removeAttribute('data-i18n');
        chartTitle.textContent = clientName || t('page.natalFull.header.title', { place });
    }
    if (birthDetails) {
        const details = [];
        const datePart = birthData.date
            ? (window.LocaleFormatters?.formatDate?.(birthData.date) || birthData.date)
            : '';
        const dateTime = `${datePart} ${birthData.time || ''}`.trim();
        if (dateTime) {
            details.push(dateTime);
        }
        if (birthData.timezone) {
            details.push(`(${formatHeaderTimezone(birthData.timezone, { date: birthData.date, time: birthData.time })})`);
        }
        if (place) {
            details.push(place);
        }
        birthDetails.textContent = details.join(' · ') || EMPTY;
    }
}

function getBirthPlaceLabel(birthData, formData) {
    const candidates = [
        birthData?.place,
        formData?.place,
    ];

    for (const candidate of candidates) {
        const value = String(candidate || '').trim();
        if (value) {
            return value;
        }
    }

    return '';
}

function renderSummaryBar(data) {
    const angles = data.angles;
    const planets = data.planets;
    const pattern = data.cosmogram_pattern;
    const balances = data.balances;
    const summaryAsc = document.getElementById('summaryAsc');
    const summaryMc = document.getElementById('summaryMc');
    const summarySun = document.getElementById('summarySun');
    const summaryMoon = document.getElementById('summaryMoon');
    const summaryPattern = document.getElementById('summaryPattern');
    const summaryDominants = document.getElementById('summaryDominants');

    if (summaryAsc) summaryAsc.textContent = EMPTY;
    if (summaryMc) summaryMc.textContent = EMPTY;
    if (summarySun) summarySun.textContent = EMPTY;
    if (summaryMoon) summaryMoon.textContent = EMPTY;
    if (summaryPattern) summaryPattern.textContent = EMPTY;
    if (summaryDominants) summaryDominants.textContent = EMPTY;

    if (angles?.ASC) {
        const asc = angles.ASC;
        summaryAsc.innerHTML =
            formatAstroCoordinate(asc);
    }

    if (angles?.MC) {
        const mc = angles.MC;
        summaryMc.innerHTML =
            formatAstroCoordinate(mc);
    }

    const sun = planets?.find((p) => p.name === 'Sun');
    if (sun) {
        summarySun.innerHTML =
            formatAstroCoordinate(sun);
    }

    const moon = planets?.find((p) => p.name === 'Moon');
    if (moon) {
        summaryMoon.innerHTML =
            formatAstroCoordinate(moon);
    }

    if (pattern) {
        let patternText = getPatternName(pattern.pattern_type) || EMPTY;
        if (pattern.handle_planet) {
            patternText += ` (${getPlanetName(pattern.handle_planet)})`;
        }
        summaryPattern.textContent = patternText;
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
        summaryDominants.textContent = dominants.join(' | ') || EMPTY;
    }
}

function renderReportIntro(data) {
    const angles = data.angles || {};
    const planets = data.planets || [];
    const pattern = data.cosmogram_pattern;
    const balances = data.balances;

    const sun = planets.find((planet) => planet.name === 'Sun');
    const moon = planets.find((planet) => planet.name === 'Moon');
    const axisParts = [];

    if (angles.ASC) {
        axisParts.push(`ASC ${getSignSymbol(angles.ASC.sign)} ${getSignName(angles.ASC.sign)}`);
    }
    if (angles.MC) {
        axisParts.push(`MC ${getSignSymbol(angles.MC.sign)} ${getSignName(angles.MC.sign)}`);
    }

    const luminaries = [sun, moon]
        .filter(Boolean)
        .map((planet) => `${getPlanetSymbol(planet.name)} ${getSignName(planet.sign)}`);

    let patternText = EMPTY;
    if (pattern) {
        patternText = getPatternName(pattern.pattern_type) || EMPTY;
        if (pattern.handle_planet) {
            patternText += ` (${getPlanetName(pattern.handle_planet)})`;
        }
    }

    const dominantParts = [];
    if (balances?.element_balance) {
        const maxEl = getMaxBalance(balances.element_balance);
        if (maxEl) dominantParts.push(`${maxEl.label} ${maxEl.pct}%`);
    }
    if (balances?.mode_balance) {
        const maxMode = getMaxBalance(balances.mode_balance);
        if (maxMode) dominantParts.push(`${maxMode.label} ${maxMode.pct}%`);
    }

    setTextContent('reportAxisValue', axisParts.join(' • ') || EMPTY);
    setTextContent('reportLuminariesValue', luminaries.join(' • ') || EMPTY);
    setTextContent('reportPatternValue', patternText);
    setTextContent('reportDominantsValue', dominantParts.join(' • ') || EMPTY);
}

function setTextContent(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value || EMPTY;
    }
}

function updateSectionCounts(data) {
    const majorAspects = (data.aspects || []).filter((aspect) => aspect.is_major);
    const configurationsCount = (data.aspect_configurations || []).length + (data.stelliums || []).length;
    const balanceGroupsCount = ['element_balance', 'mode_balance', 'gender_balance']
        .filter((key) => data.balances?.[key])
        .length;
    const specialPoints = data.special_points || {};
    const visibleSpecialPoints = ['TrueNode', 'SouthNode', 'BlackMoon', 'WhiteMoon', 'PartOfFortune', 'Vertex']
        .filter((key) => specialPoints[key] && specialPoints[key].longitude !== null)
        .length;

    setTextContent('planetsCount', String((data.planets || []).filter((planet) => PLANET_ORDER.includes(planet.name)).length));
    setTextContent('housesCount', String((data.houses || []).length));
    setTextContent('aspectsCount', String(majorAspects.length));
    setTextContent('configurationsCount', String(configurationsCount));
    setTextContent('balancesCount', String(balanceGroupsCount));
    setTextContent('rulersCount', String((data.planets || []).filter((planet) => PLANET_ORDER.includes(planet.name)).length));
    setTextContent('specialPointsCount', String(visibleSpecialPoints));
}

function setupReportSections() {
    if (document.body.dataset.natalReportSectionsReady === 'true') return;

    document.body.dataset.natalReportSectionsReady = 'true';

    if (window.innerWidth > 768) {
        document.querySelectorAll('.report-section').forEach((section) => {
            section.open = true;
        });
        return;
    }

    const defaultState = {
        balancesSection: true,
        rulersSection: true,
        configurationsSection: true,
        aspectsSection: true,
        planetsSection: false,
        housesSection: false,
        specialPointsSection: false,
    };

    Object.entries(defaultState).forEach(([id, isOpen]) => {
        const section = document.getElementById(id);
        if (section) {
            section.open = isOpen;
        }
    });
}

function renderNatalFullRulers(data) {
    window.DispositorChains?.render?.('natalFullRulersContainer', data, {
        selectId: 'natalFullRulersModeSelect',
        layout: 'tabs',
    });
}

function setupReportShortcuts() {
    if (document.body.dataset.natalReportShortcutsReady === 'true') return;

    document.body.dataset.natalReportShortcutsReady = 'true';

    document.querySelectorAll('.report-shortcut[href^="#"]').forEach((link) => {
        link.addEventListener('click', (event) => {
            const hash = link.getAttribute('href');
            if (!hash) return;

            const target = document.querySelector(hash);
            if (!target) return;

            if (target.tagName === 'DETAILS') {
                target.open = true;
            }

            event.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
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

function formatAstroCoordinate(item) {
    const formatted = window.LocaleFormatters?.formatAstroCoordinate?.(item, {
        signSymbol: getSignSymbol(item?.sign),
        signClass: 'astro-symbol',
        emptyValue: EMPTY,
    });
    if (formatted) return formatted;

    const degree = Number(item?.degree_in_sign);
    if (!Number.isFinite(degree)) return EMPTY;
    const d = Math.floor(degree);
    const m = Math.floor((degree - d) * 60);
    const signSymbol = getSignSymbol(item?.sign);
    const signMarkup = signSymbol ? `<span class="astro-symbol">${signSymbol}</span>` : '';
    return [`${d}°`, signMarkup, `${String(m).padStart(2, '0')}'`]
        .filter(Boolean)
        .join(' ');
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
        ${getPlanetSymbolMarkup(planet.name, { size: 18, title: getPlanetName(planet.name) })}
        <span class="planet-name">${getPlanetName(planet.name)}</span>${retroIndicatorHtml(Boolean(planet.retrograde), 'retro-indicator--small')}
    </span>`;
    tr.appendChild(tdName);

    const tdPos = document.createElement('td');
    tdPos.className = 'position-cell';
    tdPos.innerHTML = formatAstroCoordinate(planet);
    tr.appendChild(tdPos);

    const tdHouse = document.createElement('td');
    tdHouse.className = [1, 4, 7, 10].includes(planet.house) ? 'angular-house' : '';
    tdHouse.textContent = formatHouseNumber(planet.house) || EMPTY;
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
        if (speedPct < 10) speedClass = 'speed-slow';
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
        const karmaClass = plus > minus ? 'karma-positive' : 'karma-negative';

        if (minus > 0 || plus > 0) {
            tdKarma.innerHTML = `<span class="${karmaClass}">-${minus} | +${plus}</span>`;
        } else if (total) {
            const totalClass = total > 0 ? 'karma-positive' : 'karma-negative';
            tdKarma.innerHTML = `<span class="${totalClass}">${total}</span>`;
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

    if (planet.out_of_bounds) {
        features.push(getFeatureLabel('out_of_bounds'));
    }

    if (planet.solar_phase) {
        features.push(getFeatureLabel(planet.solar_phase));
    }

    if (planet.out_of_bounds) features.push(getFeatureLabel('out_of_bounds'));

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
        ? formatHouseList(planet.ruled_houses, ',')
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

    const planetToHouse = buildPlanetHouseLookup(planets);

    (houses || []).forEach((house) => {
        const tr = document.createElement('tr');

        const tdNum = document.createElement('td');
        tdNum.className = [1, 4, 7, 10].includes(house.number) ? 'angular-house' : '';
        tdNum.textContent = formatHouseNumber(house.number) || EMPTY;
        tr.appendChild(tdNum);

        const tdSign = document.createElement('td');
        tdSign.className = 'position-cell';
        tdSign.innerHTML = formatAstroCoordinate(house);
        tr.appendChild(tdSign);

        const tdRuler = document.createElement('td');
        tdRuler.className = 'house-ruler-stack-cell';
        tdRuler.innerHTML = renderHouseRulerGroups(house, planetToHouse);
        tr.appendChild(tdRuler);

        const tdRulerHouse = document.createElement('td');
        const rulerHouse = house.ruler_in_house || planetToHouse[normalizeBodyName(house.ruler_planet)];
        tdRulerHouse.textContent = formatHouseNumber(rulerHouse) || EMPTY;
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
            const shortNames = housePlanets.map((p) => formatPlanetNameWithRetro(p, {
                short: true,
                markerClass: 'retro-indicator--micro'
            }));
            tdPlanets.innerHTML = shortNames.join(', ');
            tdPlanets.title = housePlanets.map((p) => `${getPlanetName(p)}${isBodyRetrograde(p) ? ' R' : ''}`).join(', ');
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
    const aspectKey = getAspectKey(aspect);

    if (aspect.harmonic_type === 'harmonious') {
        tr.className = 'aspect-row-harmonious';
    } else if (aspect.harmonic_type === 'tense') {
        tr.className = 'aspect-row-tense';
    } else {
        tr.className = 'aspect-row-neutral';
    }
    if (aspectKey) {
        tr.classList.add('natal-aspect-dynamics-row');
        tr.dataset.aspectKey = aspectKey;
        tr.dataset.aspectType = aspect.aspect_type || '';
        tr.tabIndex = 0;
    }

    const tdSymbol = document.createElement('td');
    tdSymbol.className = 'aspect-symbol';
    tdSymbol.innerHTML = `${getAspectSymbol(aspect.aspect_type)} <span class="aspect-name">${getAspectName(aspect.aspect_type)}</span>`;
    tr.appendChild(tdSymbol);

    const tdPlanets = document.createElement('td');
    tdPlanets.innerHTML = `${formatPlanetNameWithRetro(aspect.planet_1, { markerClass: 'retro-indicator--micro' })} - ${formatPlanetNameWithRetro(aspect.planet_2, { markerClass: 'retro-indicator--micro' })}`;
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
        : t('page.natalFull.config.house', { house: formatHouseNumber(stellium.house_number) });
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

    const views = [
        { key: 'by_sign', label: t('page.natalFull.balances.sign'), data: balances.by_sign },
        { key: 'by_house', label: t('page.natalFull.balances.house'), data: balances.by_house }
    ].filter((view) => hasBalanceData(view.data));

    if (!views.length) {
        container.innerHTML = `<p style="color: var(--text-secondary);">${t('page.natalFull.empty.noBalances')}</p>`;
        return;
    }

    if (views.length === 1) {
        container.appendChild(createBalanceView(views[0].key, views[0].data));
        return;
    }

    const tabs = document.createElement('div');
    tabs.className = 'balance-tabs';

    const panelsWrap = document.createElement('div');

    views.forEach((view, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `balance-tab-btn${index === 0 ? ' active' : ''}`;
        button.dataset.balanceTab = view.key;
        button.textContent = view.label;
        button.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
        tabs.appendChild(button);

        const panel = document.createElement('div');
        panel.className = `balance-tab-panel${index === 0 ? ' active' : ''}`;
        panel.dataset.balancePanel = view.key;
        panel.appendChild(createBalanceView(view.key, view.data));
        panelsWrap.appendChild(panel);
    });

    container.appendChild(tabs);
    container.appendChild(panelsWrap);
    bindBalanceTabs(container);
}

function hasBalanceData(balanceSet) {
    return Boolean(balanceSet && Object.values(balanceSet).some((section) => section && Object.keys(section).length));
}

function createBalanceView(viewKey, balanceSet) {
    const row = document.createElement('div');
    row.className = 'balances-compact';

    const sections = [
        ['page.natalFull.balances.elements', balanceSet.element_balance],
        ['page.natalFull.balances.polarity', balanceSet.gender_balance],
        ['page.natalFull.balances.zones', balanceSet.zones_balance],
        ['page.natalFull.balances.quadrants', balanceSet.quadrant_balance],
        ['page.natalFull.balances.hemisphere', balanceSet.hemisphere_balance],
    ];

    if (viewKey === 'by_sign') {
        sections.splice(1, 0, ['page.natalFull.balances.modes', balanceSet.mode_balance]);
    } else if (viewKey === 'by_house') {
        sections.splice(1, 0, ['page.natalFull.balances.houseGroups', balanceSet.house_group_balance]);
    }

    sections.forEach(([titleKey, section]) => {
        if (!section) return;
        row.appendChild(createBalanceGroup(t(titleKey), titleKey, section));
    });

    return row;
}

function bindBalanceTabs(container) {
    const buttons = container.querySelectorAll('[data-balance-tab]');
    const panels = container.querySelectorAll('[data-balance-panel]');
    buttons.forEach((button) => {
        button.addEventListener('click', () => {
            const key = button.dataset.balanceTab;
            buttons.forEach((item) => {
                const isActive = item.dataset.balanceTab === key;
                item.classList.toggle('active', isActive);
                item.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });
            panels.forEach((panel) => {
                panel.classList.toggle('active', panel.dataset.balancePanel === key);
            });
        });
    });
}

function createBalanceGroup(title, titleKey, data) {
    const group = document.createElement('div');
    group.className = 'balance-group';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'balance-icon';
    iconSpan.textContent = title;
    group.appendChild(iconSpan);

    const isElementGroup = titleKey === 'page.natalFull.balances.elements';
    const neutralBalanceColor = '#6b7280';
    const elementColor = (key) => {
        const normalized = String(key || '').trim().toLowerCase();
        const mapping = {
            fire: 'Fire',
            earth: 'Earth',
            air: 'Air',
            water: 'Water'
        };
        const element = mapping[normalized];
        if (!element) return neutralBalanceColor;
        return window.AstroPreferences?.getElementColor
            ? window.AstroPreferences.getElementColor(element, window.AstroPreferences?.getAccountVisualPreferences?.() || null)
            : ({ Fire: '#ef4444', Earth: '#84cc16', Air: '#f59e0b', Water: '#3b82f6' }[element] || neutralBalanceColor);
    };

    let total = 0;
    for (const val of Object.values(data)) total += val;

    for (const [key, val] of Object.entries(data)) {
        const item = document.createElement('span');
        item.className = 'balance-item';
        item.style.color = isElementGroup ? elementColor(key) : neutralBalanceColor;
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
            ${getPlanetSymbolMarkup(pointName, { size: 18, title: getPlanetName(pointName) })}
            <span class="planet-name">${getPlanetName(pointName)}</span>${retroIndicatorHtml(Boolean(point.retrograde) || isBodyRetrograde(pointName), 'retro-indicator--small')}
        </span>`;
        tr.appendChild(tdName);

        const tdPos = document.createElement('td');
        tdPos.className = 'position-cell';
        tdPos.innerHTML = formatAstroCoordinate(point);
        tr.appendChild(tdPos);

        const tdHouse = document.createElement('td');
        tdHouse.textContent = formatHouseNumber(point.house) || EMPTY;
        tr.appendChild(tdHouse);

        tbody.appendChild(tr);
    });

    if (!hasPoints) {
        tbody.innerHTML = noDataRow(3, 'page.natalFull.empty.noSpecialPoints');
    }
}

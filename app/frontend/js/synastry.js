/**
 * Synastry workspace page.
 */

const synastryParams = new URLSearchParams(window.location.search);
const primaryUserId = synastryParams.get('client') || '';
const partnerUserId = synastryParams.get('partner') || '';

const synastryRefs = {};
const synastryState = {
    payload: null,
    wheelMode: 'compare',
    primaryRenderer: null,
    partnerRenderer: null,
    baseWheel: null,
    overlayWheel: null,
};

function synT(key, params) {
    return window.FrontendI18n?.t?.(key, params) || key;
}

async function waitForSynI18n() {
    if (!window.FrontendI18n?.ready) return;
    await Promise.resolve(window.FrontendI18n.ready).catch(() => {});
}

document.addEventListener('DOMContentLoaded', async () => {
    await waitForSynI18n();
    cacheSynastryElements();
    showSynastryLoader();

    if (!primaryUserId || !partnerUserId) {
        showSynastryError(synT('page.synastry.errors.missingParams'));
        return;
    }

    const astrologer = await window.AstroAPI?.requireAuth?.({ redirectTo: '/login.html' });
    if (!astrologer) return;

    bindSynastryEvents();
    await loadSynastry();
});

function cacheSynastryElements() {
    synastryRefs.loader = document.getElementById('pageLoader');
    synastryRefs.error = document.getElementById('synastryError');
    synastryRefs.errorMsg = document.getElementById('synastryErrorMsg');
    synastryRefs.layout = document.getElementById('synastryLayout');
    synastryRefs.backBtn = document.getElementById('synastryBackBtn');
    synastryRefs.title = document.getElementById('synastryTitle');
    synastryRefs.subtitle = document.getElementById('synastrySubtitle');
    synastryRefs.openPrimaryProfileBtn = document.getElementById('openPrimaryProfileBtn');
    synastryRefs.openPartnerProfileBtn = document.getElementById('openPartnerProfileBtn');
    synastryRefs.primaryPanelTitle = document.getElementById('primaryPanelTitle');
    synastryRefs.primaryPanelMeta = document.getElementById('primaryPanelMeta');
    synastryRefs.partnerPanelTitle = document.getElementById('partnerPanelTitle');
    synastryRefs.partnerPanelMeta = document.getElementById('partnerPanelMeta');
    synastryRefs.modeButtons = [...document.querySelectorAll('.synastry-mode-btn')];
    synastryRefs.wheelCaption = document.getElementById('synastryWheelCaption');
    synastryRefs.overlay = document.getElementById('synastryOverlay');
    synastryRefs.primaryInterAspects = document.getElementById('primaryInterAspectsTable');
    synastryRefs.partnerInterAspects = document.getElementById('partnerInterAspectsTable');
    synastryRefs.primaryOverlayList = document.getElementById('primaryOverlayList');
    synastryRefs.partnerOverlayList = document.getElementById('partnerOverlayList');
}

function bindSynastryEvents() {
    synastryRefs.modeButtons.forEach((button) => {
        button.addEventListener('click', () => {
            synastryState.wheelMode = button.dataset.mode || 'compare';
            renderWheelMode();
        });
    });

    synastryRefs.openPrimaryProfileBtn?.addEventListener('click', () => {
        window.location.href = `/client/${encodeURIComponent(primaryUserId)}`;
    });

    synastryRefs.openPartnerProfileBtn?.addEventListener('click', () => {
        window.location.href = `/client/${encodeURIComponent(partnerUserId)}`;
    });

    document.querySelectorAll('.synastry-side-panel').forEach((panel) => {
        panel.addEventListener('click', (event) => {
            const tab = event.target.closest('.panel-tab[data-panel-target]');
            if (!tab) return;

            panel.querySelectorAll('.panel-tab').forEach((node) => node.classList.toggle('active', node === tab));
            panel.querySelectorAll('.panel-tab-content').forEach((content) => {
                content.classList.toggle('active', content.id === tab.dataset.panelTarget);
            });
        });
    });

    document.addEventListener('frontend:locale-changed', () => {
        if (synastryState.payload) {
            renderSynastry();
        }
    });
}

async function loadSynastry() {
    try {
        synastryState.payload = await window.AstroAPI.getSynastry(primaryUserId, partnerUserId);
        renderSynastry();
        synastryRefs.layout.classList.remove('hidden');
        hideSynastryLoader();
    } catch (error) {
        showSynastryError(error.message || synT('page.synastry.errors.loadFailed'));
    }
}

function showSynastryError(message) {
    hideSynastryLoader();
    synastryRefs.errorMsg.textContent = message;
    synastryRefs.error.classList.remove('hidden');
}

function showSynastryLoader() {
    synastryRefs.loader?.classList.remove('hidden');
    document.body.setAttribute('aria-busy', 'true');
}

function hideSynastryLoader() {
    synastryRefs.loader?.classList.add('hidden');
    document.body.removeAttribute('aria-busy');
}

function renderSynastry() {
    const { primary_chart: primaryChart, partner_chart: partnerChart, resolved_preferences: prefs } = synastryState.payload;

    renderSynastryHeader(primaryChart, partnerChart);
    renderSynastrySide('primary', primaryChart, prefs?.primary_natal || {});
    renderSynastrySide('partner', partnerChart, prefs?.partner_natal || {});
    renderPerspectiveInterAspects(synastryRefs.primaryInterAspects, 'primary');
    renderPerspectiveInterAspects(synastryRefs.partnerInterAspects, 'partner');
    renderHouseOverlayList(
        synastryRefs.primaryOverlayList,
        synastryState.payload.house_overlays?.primary_in_partner_houses || [],
    );
    renderHouseOverlayList(
        synastryRefs.partnerOverlayList,
        synastryState.payload.house_overlays?.partner_in_primary_houses || [],
    );
    renderWheelMode();
}

function renderSynastryHeader(primaryChart, partnerChart) {
    const primaryName = getChartPersonName(primaryChart);
    const partnerName = getChartPersonName(partnerChart);
    synastryRefs.title.textContent = synT('page.synastry.headerTitle', { client: primaryName, partner: partnerName });
    synastryRefs.subtitle.textContent = `${formatBirthSummary(primaryChart)}  •  ${formatBirthSummary(partnerChart)}`;
    synastryRefs.primaryPanelTitle.textContent = primaryName;
    synastryRefs.partnerPanelTitle.textContent = partnerName;
    synastryRefs.primaryPanelMeta.textContent = formatBirthSummary(primaryChart);
    synastryRefs.partnerPanelMeta.textContent = formatBirthSummary(partnerChart);
    synastryRefs.backBtn.href = `/client/${encodeURIComponent(primaryUserId)}`;
}

function renderSynastrySide(side, chartData, preferencePayload) {
    const renderer = ensureSideRenderer(side);
    const resolved = preferencePayload?.resolved || {};

    renderer.setDisplayPreferences({
        showSpeed: resolved?.table_options?.show_speed !== false,
        showStationary: resolved?.table_options?.show_stationary !== false,
        showApplyingSeparating: resolved?.aspects?.show_applying_separating === true,
    });
    renderer.render(chartData);
    renderer.setAspectTypeFilter(resolved?.aspects?.scope || 'all');
}

function ensureSideRenderer(side) {
    const key = side === 'primary' ? 'primaryRenderer' : 'partnerRenderer';
    if (synastryState[key]) return synastryState[key];

    synastryState[key] = new window.ChartDataRenderer({
        planetsTableId: `${side}PlanetsTable`,
        housesTableId: `${side}HousesTable`,
        aspectsTableId: `${side}AspectsTable`,
        aspectGridContainerId: `${side}AspectGridContainer`,
        configsContainerId: `${side}ConfigurationsContainer`,
        balancesContainerId: `${side}BalancesContainer`,
        dignitiesContainerId: `${side}DignitiesContainer`,
        aspectSortHeadersSelector: `#${side}AspectsView th.sortable[data-sort]`,
    });
    return synastryState[key];
}

function ensureWheels() {
    if (!synastryState.baseWheel && window.ChartWheel) {
        synastryState.baseWheel = new window.ChartWheel(document.getElementById('synastryBaseWheel'));
    }
    if (!synastryState.overlayWheel && window.ChartWheel) {
        synastryState.overlayWheel = new window.ChartWheel(document.getElementById('synastryOverlayWheel'));
    }
}

function renderWheelMode() {
    if (!synastryState.payload) return;
    ensureWheels();
    if (!synastryState.baseWheel) return;

    const primaryChart = synastryState.payload.primary_chart;
    const partnerChart = synastryState.payload.partner_chart;
    const mode = synastryState.wheelMode;

    synastryRefs.modeButtons.forEach((button) => {
        button.classList.toggle('active', button.dataset.mode === mode);
    });

    synastryState.baseWheel.setOrientationMode('aries', { redraw: false });
    synastryState.overlayWheel?.setOrientationMode('aries', { redraw: false });

    if (mode === 'partner') {
        synastryState.baseWheel.draw(partnerChart);
        synastryRefs.overlay.classList.remove('visible');
        synastryRefs.wheelCaption.textContent = synT('page.synastry.compare.partnerOnly');
        return;
    }

    synastryState.baseWheel.draw(primaryChart);
    if (mode === 'compare' && synastryState.overlayWheel) {
        synastryState.overlayWheel.draw(partnerChart);
        synastryRefs.overlay.classList.add('visible');
        synastryRefs.wheelCaption.textContent = synT('page.synastry.compare.overlayHint');
        return;
    }

    synastryRefs.overlay.classList.remove('visible');
    synastryRefs.wheelCaption.textContent = synT('page.synastry.compare.clientOnly');
}

function renderPerspectiveInterAspects(container, perspective) {
    if (!container) return;
    const aspects = synastryState.payload.inter_aspects || [];
    if (!aspects.length) {
        container.innerHTML = `<tr><td colspan="4" class="text-muted">—</td></tr>`;
        return;
    }

    container.innerHTML = aspects.map((aspect) => {
        const isDirectPerspective = aspect.chart_1 === perspective;
        const firstPlanet = isDirectPerspective ? aspect.planet_1 : aspect.planet_2;
        const secondPlanet = isDirectPerspective ? aspect.planet_2 : aspect.planet_1;
        const phase = typeof aspect.applying === 'boolean'
            ? (aspect.applying ? synT('page.chart.settings.aspectPhase.applying') : synT('page.chart.settings.aspectPhase.separating'))
            : '—';

        return `
            <tr>
                <td>
                    <div class="synastry-aspect-bodies synastry-aspect-bodies--stacked">
                        <span><span class="astro-symbol">${Symbols.planets[firstPlanet] || ''}</span> ${escapeSynHtml(getBodyLabel(firstPlanet))}</span>
                        <span class="synastry-aspect-divider">→</span>
                        <span><span class="astro-symbol">${Symbols.planets[secondPlanet] || ''}</span> ${escapeSynHtml(getBodyLabel(secondPlanet))}</span>
                    </div>
                </td>
                <td><span class="astro-symbol">${Symbols.aspects[aspect.aspect_type] || ''}</span> ${escapeSynHtml(getAspectLabel(aspect.aspect_type))}</td>
                <td class="mono">${Number(aspect.orb || 0).toFixed(2)}°</td>
                <td>${escapeSynHtml(phase)}</td>
            </tr>
        `;
    }).join('');
}

function renderHouseOverlayList(container, items) {
    if (!container) return;
    if (!items.length) {
        container.innerHTML = `<p class="profile-empty">—</p>`;
        return;
    }

    container.innerHTML = items.map((item) => `
        <div class="synastry-overlay-item">
            <div class="synastry-overlay-body">
                <span class="astro-symbol">${Symbols.planets[item.body_name] || ''}</span>
                <span>${escapeSynHtml(getBodyLabel(item.body_name))}</span>
            </div>
            <div class="synastry-overlay-meta">
                <span>${escapeSynHtml(item.sign ? `${getSignSymbol(item.sign)} ${item.degree_in_sign_formatted || ''}` : '')}</span>
                <strong>H${Number(item.overlay_house || 0)}</strong>
            </div>
        </div>
    `).join('');
}

function getChartPersonName(chartData) {
    const birthData = chartData?.birth_data || {};
    return [birthData.first_name, birthData.last_name].filter(Boolean).join(' ') || synT('common.notAvailable');
}

function formatBirthSummary(chartData) {
    const birthData = chartData?.birth_data || {};
    const parts = [];
    if (birthData.date) parts.push(formatSynDate(birthData.date));
    if (birthData.time) parts.push(String(birthData.time).slice(0, 5));
    if (birthData.place) parts.push(birthData.place);
    return parts.join(' · ');
}

function formatSynDate(isoDate) {
    if (!isoDate) return '';
    const [year, month, day] = String(isoDate).split('T')[0].split('-');
    return year && month && day ? `${day}.${month}.${year}` : isoDate;
}

function getBodyLabel(bodyName) {
    const key = `astro.planet.${bodyName}`;
    const translated = synT(key);
    return translated === key ? bodyName : translated;
}

function getAspectLabel(aspectType) {
    const key = `astro.aspect.${aspectType}`;
    const translated = synT(key);
    return translated === key ? aspectType : translated;
}

function getSignSymbol(signName) {
    return Symbols.signs?.[signName] || '';
}

function escapeSynHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
}

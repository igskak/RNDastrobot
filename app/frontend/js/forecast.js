/**
 * forecast.js — Main logic for the Forecast page
 * Tabs, API calls, state management, controls
 */

const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:8000/api/v1'
    : '/api/v1';

// ─── State ──────────────────────────────────────────────
const ForecastState = {
    userId: null,
    natalData: null,
    currentTab: 'timeline',
    method: 'transits',
    // cached results
    transitEvents: null,
    transitMoment: null,
    progressionData: null,
    directionData: null,
    solarData: null,
    // Table data for sorting
    tableRows: [],
    tableSortCol: 'date',
    tableSortAsc: true,
};

// ─── Init ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const natalData = AstroAPI.getChartFromSession();
    if (!natalData) {
        window.location.href = 'index.html';
        return;
    }
    ForecastState.natalData = natalData;
    ForecastState.userId = natalData.user_id || localStorage.getItem('currentUserId');

    updateHeaderInfo(natalData);
    initDefaults();
    initTabs();
    initControls();
});

function updateHeaderInfo(data) {
    const el = document.getElementById('headerSubtitle');
    if (el && data.birth_data) {
        const bd = data.birth_data;
        const d = new Date(bd.date);
        const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
        el.textContent = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${bd.time?.slice(0,5) || ''}`;
    }
}

function initDefaults() {
    const today = new Date();
    const fmt = d => d.toISOString().split('T')[0];
    document.getElementById('startDate').value = fmt(today);
    applyDatePreset(6); // default 6 months
    document.getElementById('singleDate').value = fmt(today);
    document.getElementById('solarYear').value = today.getFullYear();
}

function applyDatePreset(months) {
    const today = new Date();
    const fmt = d => d.toISOString().split('T')[0];
    document.getElementById('startDate').value = fmt(today);
    const end = new Date(today);
    end.setMonth(end.getMonth() + months);
    document.getElementById('endDate').value = fmt(end);
    // Update active preset button
    document.querySelectorAll('.date-presets .preset-btn').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.months) === months);
    });
}

// ─── Tabs ───────────────────────────────────────────────
function initTabs() {
    document.querySelectorAll('.forecast-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const id = tab.dataset.tab;
            document.querySelectorAll('.forecast-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.forecast-pane').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`pane-${id}`).classList.add('active');
            ForecastState.currentTab = id;
            updateControlsVisibility();
        });
    });
}

// ─── Controls ───────────────────────────────────────────
function initControls() {
    document.getElementById('methodSelect').addEventListener('change', e => {
        ForecastState.method = e.target.value;
        updateControlsVisibility();
    });
    document.getElementById('btnCalculate').addEventListener('click', onCalculate);
    // Timeline filter re-render
    ['filterMajor', 'filterNoMoon'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => {
            if (ForecastState.transitEvents) renderTimeline();
        });
    });
    // Planet group filter buttons
    document.querySelectorAll('.tl-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            if (ForecastState.transitEvents) renderTimeline();
        });
    });
    // Date presets
    document.querySelectorAll('.date-presets .preset-btn').forEach(btn => {
        btn.addEventListener('click', () => applyDatePreset(parseInt(btn.dataset.months)));
    });
    // "Today" button for single-date
    const btnToday = document.getElementById('btnToday');
    if (btnToday) btnToday.addEventListener('click', () => {
        document.getElementById('singleDate').value = new Date().toISOString().split('T')[0];
    });
    // Table sorting
    document.querySelectorAll('.forecast-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (ForecastState.tableSortCol === col) {
                ForecastState.tableSortAsc = !ForecastState.tableSortAsc;
            } else {
                ForecastState.tableSortCol = col;
                ForecastState.tableSortAsc = true;
            }
            if (ForecastState.tableRows.length) renderTableRows();
        });
    });
    updateControlsVisibility();
}

function updateControlsVisibility() {
    const tab = ForecastState.currentTab;
    const method = document.getElementById('methodSelect').value;
    const dateRange = document.getElementById('dateRangeGroup');
    const singleDate = document.getElementById('singleDateGroup');
    const solarYear = document.getElementById('solarYearGroup');
    const methodSelect = document.getElementById('methodSelect');

    dateRange.style.display = 'none';
    singleDate.style.display = 'none';
    solarYear.style.display = 'none';
    methodSelect.closest('.control-group').style.display = '';

    if (tab === 'solar') {
        solarYear.style.display = '';
        methodSelect.closest('.control-group').style.display = 'none';
    } else if (tab === 'timeline') {
        dateRange.style.display = '';
    } else if (tab === 'biwheel' || tab === 'table') {
        if (method === 'transits') {
            dateRange.style.display = '';
        } else {
            singleDate.style.display = '';
        }
    }
}

// ─── Calculate ──────────────────────────────────────────
async function onCalculate() {
    const btn = document.getElementById('btnCalculate');
    btn.disabled = true;
    try {
        const tab = ForecastState.currentTab;
        if (tab === 'solar') {
            await calculateSolar();
        } else if (tab === 'timeline') {
            await calculateTimeline();
        } else if (tab === 'biwheel') {
            await calculateBiwheel();
        } else if (tab === 'table') {
            await calculateTable();
        }
    } catch (err) {
        console.error('Forecast error:', err);
        alert('Ошибка расчёта: ' + err.message);
    } finally {
        btn.disabled = false;
    }
}

// ─── Navigation (timeline → biwheel) ────────────────────
window.ForecastNavigation = {
    goToBiwheel(dateStr) {
        // Set date inputs
        document.getElementById('startDate').value = dateStr;
        document.getElementById('singleDate').value = dateStr;
        // Switch to biwheel tab
        document.querySelectorAll('.forecast-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.forecast-pane').forEach(p => p.classList.remove('active'));
        const biwheelTab = document.querySelector('.forecast-tab[data-tab="biwheel"]');
        if (biwheelTab) biwheelTab.classList.add('active');
        const biwheelPane = document.getElementById('pane-biwheel');
        if (biwheelPane) biwheelPane.classList.add('active');
        ForecastState.currentTab = 'biwheel';
        updateControlsVisibility();
        // Auto-calculate
        onCalculate();
    }
};

// ─── API helpers ────────────────────────────────────────
async function apiPost(endpoint, body) {
    const resp = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${resp.status}`);
    }
    return resp.json();
}

// ─── Planet groups for filtering ─────────────────────────
const PLANET_GROUPS = {
    outer: ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'],
    inner: ['Sun', 'Mercury', 'Venus', 'Mars'],
    nodes: ['North Node', 'South Node', 'Lilith', 'Chiron', 'NorthNode', 'SouthNode', 'Mean Node', 'True Node'],
};

// ─── Timeline filtering & rendering ─────────────────────
function getFilteredTimelineEvents() {
    const data = ForecastState.transitEvents;
    if (!data || !data.events) return [];
    let evts = data.events;
    if (document.getElementById('filterMajor')?.checked) {
        evts = evts.filter(e => e.is_major);
    }
    if (document.getElementById('filterNoMoon')?.checked) {
        evts = evts.filter(e => e.transit_body !== 'Moon');
    }
    // Planet group filters
    const allowedBodies = new Set();
    document.querySelectorAll('.tl-filter-btn.active').forEach(btn => {
        const group = btn.dataset.planetGroup;
        if (PLANET_GROUPS[group]) PLANET_GROUPS[group].forEach(p => allowedBodies.add(p));
    });
    // Also always allow Moon if not filtered out above
    if (!document.getElementById('filterNoMoon')?.checked) allowedBodies.add('Moon');
    if (allowedBodies.size > 0) {
        evts = evts.filter(e => allowedBodies.has(e.transit_body));
    }
    return evts;
}

function renderTimeline() {
    const evts = getFilteredTimelineEvents();
    const counter = document.getElementById('tlEventCount');
    if (counter) {
        const total = ForecastState.transitEvents?.events?.length || 0;
        counter.textContent = `${evts.length} из ${total} событий`;
    }
    renderActiveEventsSummary(evts);
    requestAnimationFrame(() => {
        if (window.ForecastTimeline) {
            const s = document.getElementById('startDate').value;
            const e = document.getElementById('endDate').value;
            window.ForecastTimeline.render(evts, s, e);
        }
    });
}

function renderActiveEventsSummary(events) {
    const container = document.getElementById('activeEventsSummary');
    if (!container) return;
    const now = new Date();
    const active = (events || []).filter(ev => {
        const enter = new Date(ev.t_enter);
        const leave = new Date(ev.t_leave);
        return now >= enter && now <= leave;
    });
    if (!active.length) {
        container.innerHTML = '<div class="aes-empty">Нет активных транзитов на сегодня</div>';
        return;
    }
    const chips = active.map(ev => {
        const pSym = Symbols?.planets?.[ev.transit_body] || ev.transit_body;
        const nSym = Symbols?.planets?.[ev.natal_body] || ev.natal_body;
        const aSym = Symbols?.aspects?.[ev.aspect_type] || ev.aspect_type;
        const harmony = getAspectHarmony(ev.aspect_type);
        const exact = new Date(ev.t_exact);
        const daysToExact = Math.round((exact - now) / 86400000);
        const exactLabel = daysToExact === 0 ? 'сегодня!'
            : daysToExact > 0 ? `точный через ${daysToExact}д`
            : `точный ${Math.abs(daysToExact)}д назад`;
        return `<div class="aes-chip ${harmony}" title="${ev.transit_body} ${ev.aspect_type} ${ev.natal_body}\nОрб: ${ev.min_orb?.toFixed(2)}°\n${exactLabel}">
            <span class="aes-planets">${pSym} ${aSym} ${nSym}</span>
            <span class="aes-exact">${exactLabel}</span>
        </div>`;
    });
    container.innerHTML = `
        <div class="aes-header">⚡ Активные транзиты сейчас <span class="aes-count">${active.length}</span></div>
        <div class="aes-chips">${chips.join('')}</div>
    `;
}

async function calculateTimeline() {
    showState('timeline', 'loading');
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    if (!startDate || !endDate) throw new Error('Укажите даты');

    const data = await apiPost('/transits/period', {
        user_id: ForecastState.userId,
        start_date: startDate,
        end_date: endDate,
        timezone: 'UTC',
        step_hours: 6,
    });
    ForecastState.transitEvents = data;
    showState('timeline', 'content');
    renderTimeline();
    // Also populate table
    populateTable(data.events, 'transit');
}

// ─── Biwheel calculation ────────────────────────────────
async function calculateBiwheel() {
    showState('biwheel', 'loading');
    const method = document.getElementById('methodSelect').value;
    let progData;

    if (method === 'transits') {
        const startDate = document.getElementById('startDate').value;
        if (!startDate) throw new Error('Укажите дату');
        progData = await apiPost('/transits/calculate', {
            user_id: ForecastState.userId,
            date: startDate,
            time: '12:00:00',
            timezone: 'UTC',
        });
        progData._method = 'transits';
    } else if (method === 'progressions') {
        const targetDate = document.getElementById('singleDate').value;
        if (!targetDate) throw new Error('Укажите дату');
        progData = await apiPost('/progressions/calculate', {
            user_id: ForecastState.userId,
            target_date: targetDate,
        });
        progData._method = 'progressions';
    } else {
        // directions
        const dirType = method.replace('directions_', '');
        const targetDate = document.getElementById('singleDate').value;
        if (!targetDate) throw new Error('Укажите дату');
        progData = await apiPost('/directions/calculate', {
            user_id: ForecastState.userId,
            target_date: targetDate,
            direction_type: dirType,
        });
        progData._method = 'directions';
    }

    showState('biwheel', 'content');
    if (window.ForecastBiwheel) {
        window.ForecastBiwheel.render(ForecastState.natalData, progData);
    }
}

// ─── Table calculation ──────────────────────────────────
async function calculateTable() {
    const method = document.getElementById('methodSelect').value;
    if (method === 'transits') {
        await calculateTimeline(); // reuses transit period
        return;
    }
    // For progressions/directions, calc single point and show aspects
    showState('table', 'loading');
    let data;
    if (method === 'progressions') {
        const targetDate = document.getElementById('singleDate').value;
        data = await apiPost('/progressions/calculate', {
            user_id: ForecastState.userId,
            target_date: targetDate,
        });
        populateTableFromAspects(data.aspects_to_natal, method, targetDate);
    } else {
        const dirType = method.replace('directions_', '');
        const targetDate = document.getElementById('singleDate').value;
        data = await apiPost('/directions/calculate', {
            user_id: ForecastState.userId,
            target_date: targetDate,
            direction_type: dirType,
        });
        populateTableFromAspects(data.aspects_to_natal, method, targetDate);
    }
    showState('table', 'content');
}

// ─── Solar calculation ──────────────────────────────────
async function calculateSolar() {
    showState('solar', 'loading');
    const year = parseInt(document.getElementById('solarYear').value);
    if (!year || year < 1900 || year > 2100) throw new Error('Укажите год (1900-2100)');

    const data = await apiPost('/solar/calculate', {
        user_id: ForecastState.userId,
        year: year,
        save_to_db: false,
    });
    ForecastState.solarData = data;
    showState('solar', 'content');
    renderSolar(data);
}

function renderSolar(data) {
    // Info bar
    const infoBar = document.getElementById('solarInfoBar');
    const si = data.solar_info;
    infoBar.innerHTML = `
        <div class="solar-info-item"><div class="si-label">Год</div><div class="si-value">${si.year}</div></div>
        <div class="solar-info-item"><div class="si-label">Дата соляра (UTC)</div><div class="si-value">${si.solar_datetime_utc}</div></div>
        <div class="solar-info-item"><div class="si-label">Локальное</div><div class="si-value">${si.solar_datetime_local}</div></div>
        <div class="solar-info-item"><div class="si-label">Место</div><div class="si-value">${si.location?.name || '—'}</div></div>
    `;
    // Draw chart wheel
    const svg = document.getElementById('solarWheel');
    const wheel = new ChartWheel(svg);
    wheel.draw({
        planets: data.planets,
        houses: data.houses,
        angles: data.angles,
        aspects: [],
    });
    // Planets table
    renderSolarPlanetsTable(data);
}

function renderSolarPlanetsTable(data) {
    const container = document.getElementById('solarDataSection');
    let html = '<table class="forecast-table"><thead><tr><th>Планета</th><th>Позиция</th><th>Дом</th><th>R</th></tr></thead><tbody>';
    data.planets.forEach(p => {
        const sym = (Symbols?.planets?.[p.name]) || p.name;
        const signSym = (Symbols?.signs?.[p.sign]) || p.sign;
        html += `<tr>
            <td>${sym} ${p.name}</td>
            <td>${signSym} ${p.degree_in_sign_formatted || p.degree_in_sign.toFixed(1) + '°'}</td>
            <td>${p.house}</td>
            <td>${p.retrograde ? 'R' : ''}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

// ─── UI Helpers ─────────────────────────────────────────
function showState(pane, state) {
    // state: 'empty', 'loading', 'content'
    const empty = document.getElementById(`${pane}Empty`);
    const loading = document.getElementById(`${pane}Loading`);
    const content = document.getElementById(`${pane}Container`);

    if (empty) empty.style.display = state === 'empty' ? '' : 'none';
    if (loading) loading.style.display = state === 'loading' ? '' : 'none';
    if (content) content.style.display = state === 'content' ? '' : 'none';

    // Special: timeline legend
    if (pane === 'timeline') {
        const legend = document.getElementById('timelineLegend');
        if (legend) legend.style.display = state === 'content' ? '' : 'none';
    }
    // Table special
    if (pane === 'table') {
        const tc = document.getElementById('tableContainer');
        if (tc) tc.style.display = state === 'content' ? '' : 'none';
        const te = document.getElementById('tableEmpty');
        if (te) te.style.display = state === 'empty' ? '' : 'none';
    }
}

// ─── Aspect classification helpers ──────────────────────
function getAspectHarmony(aspectType) {
    const harmonious = ['Trine', 'Sextile'];
    const tense = ['Square', 'Opposition'];
    const neutral = ['Conjunction'];
    if (harmonious.includes(aspectType)) return 'harmonious';
    if (tense.includes(aspectType)) return 'tense';
    if (neutral.includes(aspectType)) return 'neutral';
    return 'minor';
}

function getMethodLabel(method) {
    const map = {
        'transit': 'Транзит',
        'transits': 'Транзит',
        'progressions': 'Прогрессия',
        'directions_solar_arc': 'Дир. (сол.)',
        'directions_symbolic': 'Дир. (симв.)',
        'directions_equatorial': 'Дир. (Найб.)',
    };
    return map[method] || method;
}

// ─── Populate table from transit events ─────────────────
function populateTable(events, method) {
    showState('table', 'content');
    if (!events || events.length === 0) {
        document.getElementById('tableBody').innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-secondary)">Нет событий</td></tr>';
        ForecastState.tableRows = [];
        return;
    }
    ForecastState.tableRows = events.map(ev => ({
        date: ev.t_exact ? ev.t_exact.split('T')[0] : '—',
        method: getMethodLabel(method),
        methodClass: 'transit',
        transit: ev.transit_body,
        aspect: ev.aspect_type,
        natal: ev.natal_body,
        orb: ev.min_orb ?? 99,
        type: ev.is_major ? 'Мажор' : 'Минор',
    }));
    renderTableRows();
}

// ─── Populate table from aspect list (progressions/directions) ─
function populateTableFromAspects(aspects, method, date) {
    showState('table', 'content');
    if (!aspects || aspects.length === 0) {
        document.getElementById('tableBody').innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-secondary)">Нет аспектов</td></tr>';
        ForecastState.tableRows = [];
        return;
    }
    const methodClass = method.startsWith('directions') ? 'direction' : 'progression';
    ForecastState.tableRows = aspects.map(a => ({
        date: date,
        method: getMethodLabel(method),
        methodClass,
        transit: a.progressed_planet || a.directed_object || '—',
        aspect: a.aspect_type,
        natal: a.natal_object || '—',
        orb: a.orb ?? 99,
        type: a.is_major ? 'Мажор' : 'Минор',
    }));
    renderTableRows();
}

function renderTableRows() {
    const rows = [...ForecastState.tableRows];
    const col = ForecastState.tableSortCol;
    const asc = ForecastState.tableSortAsc;
    rows.sort((a, b) => {
        let va = a[col], vb = b[col];
        if (col === 'orb') { va = parseFloat(va) || 0; vb = parseFloat(vb) || 0; }
        if (va < vb) return asc ? -1 : 1;
        if (va > vb) return asc ? 1 : -1;
        return 0;
    });
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = rows.map(r => {
        const tSym = Symbols?.planets?.[r.transit] || r.transit;
        const nSym = Symbols?.planets?.[r.natal] || r.natal;
        const aSym = Symbols?.aspects?.[r.aspect] || r.aspect;
        const harmony = getAspectHarmony(r.aspect);
        return `<tr>
            <td>${r.date}</td>
            <td><span class="method-badge ${r.methodClass}">${r.method}</span></td>
            <td>${tSym} ${r.transit}</td>
            <td><span class="aspect-badge ${harmony}">${aSym} ${r.aspect}</span></td>
            <td>${nSym} ${r.natal}</td>
            <td>${r.orb < 99 ? r.orb.toFixed(2) + '°' : '—'}</td>
            <td>${r.type}</td>
        </tr>`;
    }).join('');
    // Update sort indicators
    document.querySelectorAll('.forecast-table th.sortable').forEach(th => {
        const c = th.dataset.sort;
        th.classList.toggle('sort-active', c === col);
        th.classList.toggle('sort-desc', c === col && !asc);
    });
}

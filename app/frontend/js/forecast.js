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
    solarOrientation: 'aries',
    solarPointScale: 1.0,
    solarWheel: null,
    // Table data for sorting
    tableRowsRaw: [],
    tableRows: [],
    tableSortCol: 'date',
    tableSortAsc: true,
    biwheelOrientation: 'aries',
    transitScaleUnit: 'week',
    transitScalePoints: [],
    transitScaleIndex: 0,
    transitBiwheelCache: {},
    biwheelRequestSeq: 0,
    pendingBiwheelDate: null,
    scalePlaybackTimer: null,
    isScalePlaying: false,
    transitBiwheelBusy: false,
    transitBiwheelInFlight: {},
    transitPrewarmSeq: 0,
    transitPeriodCache: {},
    transitPeriodKey: null,
    transitCalculatedRange: null,
    prognosticPointCache: {},
    progressionTargetDate: null,
    directionTargetDate: null,
    directionType: null,
    solarCalculatedYear: null,
    tableDataKey: null,
    timezone: 'UTC',
};

function clampChartPointScale(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 1;
    return Math.min(1.7, Math.max(0.8, n));
}

function readChartPointScale() {
    return clampChartPointScale(parseFloat(localStorage.getItem('solarPointScale') || '1.2'));
}

function buildForecastChatContext() {
    const method = document.getElementById('methodSelect')?.value || ForecastState.method || 'transits';
    const startDate = document.getElementById('startDate')?.value || null;
    const endDate = document.getElementById('endDate')?.value || null;
    const singleDate = document.getElementById('singleDate')?.value || null;
    const solarYearRaw = document.getElementById('solarYear')?.value;
    const solarYear = solarYearRaw ? parseInt(solarYearRaw, 10) : null;

    const context = {
        page: 'forecast',
        active_tab: ForecastState.currentTab,
        selected_method: method,
        controls: {
            start_date: startDate,
            end_date: endDate,
            single_date: singleDate,
            solar_year: Number.isNaN(solarYear) ? null : solarYear,
        },
        calculated: {
            transits: null,
            progressions: null,
            directions: null,
            solar_return: null,
        },
    };

    const transitRange = ForecastState.transitCalculatedRange || { start_date: startDate, end_date: endDate };
    if (
        ForecastState.transitEvents
        && Array.isArray(ForecastState.transitEvents.events)
        && transitRange.start_date
        && transitRange.end_date
    ) {
        context.calculated.transits = {
            period_start: transitRange.start_date,
            period_end: transitRange.end_date,
            total_events: ForecastState.transitEvents.events.length,
            events: ForecastState.transitEvents.events,
        };
    }

    if (ForecastState.progressionData) {
        context.calculated.progressions = {
            target_date: ForecastState.progressionTargetDate || singleDate,
            data: ForecastState.progressionData,
        };
    }

    if (ForecastState.directionData) {
        const directionType = method.startsWith('directions_')
            ? method.replace('directions_', '')
            : (ForecastState.directionType || ForecastState.directionData.direction_info?.direction_type || 'solar_arc');
        context.calculated.directions = {
            target_date: ForecastState.directionTargetDate || singleDate,
            direction_type: directionType,
            data: ForecastState.directionData,
        };
    }

    if (ForecastState.solarData) {
        context.calculated.solar_return = {
            year: ForecastState.solarCalculatedYear || (Number.isNaN(solarYear) ? null : solarYear),
            data: ForecastState.solarData,
        };
    }

    return context;
}

window.getForecastChatContext = buildForecastChatContext;

// ─── Solar Zoom/Pan ─────────────────────────────────────
let solarZoomLevel = 1;
let solarPanX = 0;
let solarPanY = 0;
let solarIsPanning = false;
let solarPanStartX = 0;
let solarPanStartY = 0;
const SOLAR_VIEWBOX_SIZE = 500;
const SOLAR_ZOOM_MIN = 0.5;
const SOLAR_ZOOM_MAX = 4;
const SOLAR_ZOOM_STEP = 0.15;

// ─── Init ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const natalData = AstroAPI.getChartFromSession();
    if (!natalData) {
        window.location.href = 'index.html';
        return;
    }
    ForecastState.natalData = natalData;
    ForecastState.userId = natalData.user_id || localStorage.getItem('currentUserId');
    ForecastState.timezone = natalData.birth_data?.timezone
        || Intl.DateTimeFormat().resolvedOptions().timeZone
        || 'UTC';

    updateHeaderInfo(natalData);
    initDefaults();
    initTabs();
    initControls();
});

function getForecastTimezone() {
    return ForecastState.timezone || 'UTC';
}

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
    ForecastState.solarPointScale = readChartPointScale();
    const solarScaleRange = document.getElementById('solarPointScaleRange');
    const solarScaleValue = document.getElementById('solarPointScaleValue');
    if (solarScaleRange) solarScaleRange.value = String(Math.round(ForecastState.solarPointScale * 100));
    if (solarScaleValue) solarScaleValue.textContent = `${Math.round(ForecastState.solarPointScale * 100)}%`;
    const stepSelect = document.getElementById('biwheelStepSelect');
    if (stepSelect) stepSelect.value = ForecastState.transitScaleUnit;
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

function formatInputDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseInputDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(`${dateStr}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
}

function addScaleStep(date, stepUnit) {
    const next = new Date(date);
    if (stepUnit === 'month') {
        const day = next.getDate();
        next.setDate(1);
        next.setMonth(next.getMonth() + 1);
        next.setDate(Math.min(day, daysInMonth(next.getFullYear(), next.getMonth())));
        return next;
    }
    if (stepUnit === 'week') {
        next.setDate(next.getDate() + 7);
        return next;
    }
    next.setDate(next.getDate() + 1);
    return next;
}

function buildTransitScalePoints(startDateStr, endDateStr, stepUnit) {
    const start = parseInputDate(startDateStr);
    const end = parseInputDate(endDateStr);
    if (!start || !end || end < start) return [];

    const points = [];
    let cursor = new Date(start);
    let safety = 0;

    while (cursor <= end && safety < 10000) {
        points.push(formatInputDate(cursor));
        const next = addScaleStep(cursor, stepUnit);
        if (next.getTime() === cursor.getTime()) break;
        cursor = next;
        safety += 1;
    }

    const endStr = formatInputDate(end);
    if (points.length === 0 || points[points.length - 1] !== endStr) {
        points.push(endStr);
    }

    return points;
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
            renderCurrentTabFromCache().catch(err => {
                console.error('Tab render error:', err);
            });
        });
    });
}

// ─── Controls ───────────────────────────────────────────
function initControls() {
    // Help overlay
    const helpOverlay = document.getElementById('helpOverlay');
    document.getElementById('btnHelp')?.addEventListener('click', () => helpOverlay.style.display = 'flex');
    document.getElementById('helpClose')?.addEventListener('click', () => helpOverlay.style.display = 'none');
    helpOverlay?.addEventListener('click', e => { if (e.target === helpOverlay) helpOverlay.style.display = 'none'; });

    document.getElementById('methodSelect').addEventListener('change', e => {
        ForecastState.method = e.target.value;
        updateControlsVisibility();
    });
    document.getElementById('btnCalculate').addEventListener('click', onCalculate);
    // Timeline filter re-render
    ['filterMajor'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => {
            if (ForecastState.transitEvents) renderTimeline();
        });
    });
    // Date presets
    document.querySelectorAll('.date-presets .preset-btn').forEach(btn => {
        btn.addEventListener('click', () => applyDatePreset(parseInt(btn.dataset.months)));
    });
    ['startDate', 'endDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                if (ForecastState.currentTab === 'biwheel' && document.getElementById('methodSelect').value === 'transits') {
                    refreshTransitScale(ForecastState.transitMoment);
                    const selectedDate = getTransitScaleDateByIndex(ForecastState.transitScaleIndex);
                    if (selectedDate) {
                        calculateTransitBiwheelAt(selectedDate, { showLoading: false }).catch(err => {
                            console.error('Transit biwheel range error:', err);
                        });
                    }
                }
            });
        }
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
    ['tableFilterKind', 'tableFilterStrength', 'tableFilterAspect', 'tableFilterMaxOrb', 'tableFilterSearch']
        .forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const evt = id === 'tableFilterSearch' || id === 'tableFilterMaxOrb' ? 'input' : 'change';
            el.addEventListener(evt, () => applyTableFiltersAndRender());
        });
    document.getElementById('tableFiltersToggle')?.addEventListener('click', () => {
        toggleTableFilters();
    });
    document.getElementById('tableFilterReset')?.addEventListener('click', () => {
        resetTableFilters();
        applyTableFiltersAndRender();
    });
    // Solar location geocoding with autocomplete
    initSolarPlaceAutocomplete();
    initSolarZoomPan();

    const orientationSelect = document.getElementById('biwheelOrientationSelect');
    if (orientationSelect) {
        orientationSelect.value = ForecastState.biwheelOrientation;
        orientationSelect.addEventListener('change', e => {
            ForecastState.biwheelOrientation = e.target.value === 'asc' ? 'asc' : 'aries';
            if (window.ForecastBiwheel?.setOrientationMode) {
                window.ForecastBiwheel.setOrientationMode(ForecastState.biwheelOrientation);
            }
            if (window.ForecastBiwheel && window.ForecastBiwheel.hasLastRender?.()) {
                window.ForecastBiwheel.rerenderLast();
            }
        });
    }

    const solarOrientationSelect = document.getElementById('solarOrientationSelect');
    if (solarOrientationSelect) {
        solarOrientationSelect.value = ForecastState.solarOrientation;
        solarOrientationSelect.addEventListener('change', e => {
            ForecastState.solarOrientation = e.target.value === 'asc' ? 'asc' : 'aries';
            if (ForecastState.solarData) {
                renderSolarChart(ForecastState.solarData);
            }
        });
    }
    const solarPointScaleRange = document.getElementById('solarPointScaleRange');
    const solarPointScaleValue = document.getElementById('solarPointScaleValue');
    if (solarPointScaleRange) {
        solarPointScaleRange.addEventListener('input', e => {
            ForecastState.solarPointScale = clampChartPointScale((Number(e.target.value) || 100) / 100);
            localStorage.setItem('solarPointScale', String(ForecastState.solarPointScale));
            if (solarPointScaleValue) {
                solarPointScaleValue.textContent = `${Math.round(ForecastState.solarPointScale * 100)}%`;
            }
            if (ForecastState.solarData) {
                renderSolarChart(ForecastState.solarData);
            }
        });
    }
    const solarSettingsBtn = document.getElementById('solarSettingsBtn');
    const solarSettingsPanel = document.getElementById('solarSettingsPanel');
    if (solarSettingsBtn && solarSettingsPanel) {
        solarSettingsBtn.addEventListener('click', () => {
            solarSettingsPanel.classList.remove('hidden');
        });
        solarSettingsPanel.addEventListener('click', e => {
            if (e.target === solarSettingsPanel) {
                solarSettingsPanel.classList.add('hidden');
            }
        });
        document.getElementById('solarSettingsClose')?.addEventListener('click', () => {
            solarSettingsPanel.classList.add('hidden');
        });
    }

    const stepSelect = document.getElementById('biwheelStepSelect');
    if (stepSelect) {
        stepSelect.addEventListener('change', () => {
            ForecastState.transitScaleUnit = stepSelect.value;
            refreshTransitScale(ForecastState.transitMoment);
            const selectedDate = getTransitScaleDateByIndex(ForecastState.transitScaleIndex);
            if (selectedDate && ForecastState.currentTab === 'biwheel' && document.getElementById('methodSelect').value === 'transits') {
                calculateTransitBiwheelAt(selectedDate, { showLoading: false }).catch(err => {
                    console.error('Transit biwheel step-unit error:', err);
                });
            }
        });
    }
    document.getElementById('btnScalePrev')?.addEventListener('click', () => shiftTransitScale(-1));
    document.getElementById('btnScaleNext')?.addEventListener('click', () => shiftTransitScale(1));
    document.getElementById('btnScalePlay')?.addEventListener('click', toggleTransitScalePlayback);
    document.getElementById('biwheelTimeSlider')?.addEventListener('input', onTransitScaleSliderInput);

    toggleTableFilters(false);
    updateTableFiltersBadge();
    updateControlsVisibility();
}

function applySolarViewBox() {
    const svg = document.getElementById('solarWheel');
    if (!svg) return;
    const width = SOLAR_VIEWBOX_SIZE / solarZoomLevel;
    const height = SOLAR_VIEWBOX_SIZE / solarZoomLevel;
    const cx = SOLAR_VIEWBOX_SIZE / 2 + solarPanX;
    const cy = SOLAR_VIEWBOX_SIZE / 2 + solarPanY;
    svg.setAttribute('viewBox', `${cx - width / 2} ${cy - height / 2} ${width} ${height}`);
}

function resetSolarView() {
    const svg = document.getElementById('solarWheel');
    solarZoomLevel = 1;
    solarPanX = 0;
    solarPanY = 0;
    if (svg) {
        svg.setAttribute('viewBox', `0 0 ${SOLAR_VIEWBOX_SIZE} ${SOLAR_VIEWBOX_SIZE}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }
    applySolarViewBox();
}

function initSolarZoomPan() {
    const wrapper = document.getElementById('solarWheelWrapper');
    if (!wrapper || wrapper.dataset.zoomInit === '1') return;
    wrapper.dataset.zoomInit = '1';

    wrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -SOLAR_ZOOM_STEP : SOLAR_ZOOM_STEP;
        solarZoomLevel = Math.min(SOLAR_ZOOM_MAX, Math.max(SOLAR_ZOOM_MIN, solarZoomLevel + delta));
        applySolarViewBox();
    }, { passive: false });

    wrapper.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || e.target.closest('.bw-zoom-btn')) return;
        solarIsPanning = true;
        solarPanStartX = e.clientX;
        solarPanStartY = e.clientY;
    });
    window.addEventListener('mousemove', (e) => {
        if (!solarIsPanning) return;
        const scale = SOLAR_VIEWBOX_SIZE / (solarZoomLevel * (wrapper.clientWidth || SOLAR_VIEWBOX_SIZE));
        solarPanX -= (e.clientX - solarPanStartX) * scale;
        solarPanY -= (e.clientY - solarPanStartY) * scale;
        solarPanStartX = e.clientX;
        solarPanStartY = e.clientY;
        applySolarViewBox();
    });
    window.addEventListener('mouseup', () => { solarIsPanning = false; });

    let lastTouchDist = 0;
    wrapper.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastTouchDist = Math.hypot(dx, dy);
        } else if (e.touches.length === 1) {
            solarIsPanning = true;
            solarPanStartX = e.touches[0].clientX;
            solarPanStartY = e.touches[0].clientY;
        }
    }, { passive: true });
    wrapper.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            if (lastTouchDist > 0) {
                const ratio = dist / lastTouchDist;
                solarZoomLevel = Math.min(SOLAR_ZOOM_MAX, Math.max(SOLAR_ZOOM_MIN, solarZoomLevel * ratio));
                applySolarViewBox();
            }
            lastTouchDist = dist;
        } else if (e.touches.length === 1 && solarIsPanning) {
            e.preventDefault();
            const scale = SOLAR_VIEWBOX_SIZE / (solarZoomLevel * (wrapper.clientWidth || SOLAR_VIEWBOX_SIZE));
            solarPanX -= (e.touches[0].clientX - solarPanStartX) * scale;
            solarPanY -= (e.touches[0].clientY - solarPanStartY) * scale;
            solarPanStartX = e.touches[0].clientX;
            solarPanStartY = e.touches[0].clientY;
            applySolarViewBox();
        }
    }, { passive: false });
    wrapper.addEventListener('touchend', () => {
        solarIsPanning = false;
        lastTouchDist = 0;
    });

    document.getElementById('solarZoomIn')?.addEventListener('click', () => {
        solarZoomLevel = Math.min(SOLAR_ZOOM_MAX, solarZoomLevel + SOLAR_ZOOM_STEP * 2);
        applySolarViewBox();
    });
    document.getElementById('solarZoomOut')?.addEventListener('click', () => {
        solarZoomLevel = Math.max(SOLAR_ZOOM_MIN, solarZoomLevel - SOLAR_ZOOM_STEP * 2);
        applySolarViewBox();
    });
    document.getElementById('solarZoomReset')?.addEventListener('click', resetSolarView);

    resetSolarView();
}

function getTransitScaleDateByIndex(index) {
    return ForecastState.transitScalePoints[index] || null;
}

function findNearestTransitScaleIndex(dateStr) {
    const points = ForecastState.transitScalePoints;
    if (!points.length) return 0;
    const target = parseInputDate(dateStr)?.getTime();
    if (!target) return 0;

    let bestIdx = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < points.length; i++) {
        const pointTime = parseInputDate(points[i])?.getTime() ?? 0;
        const diff = Math.abs(pointTime - target);
        if (diff < bestDiff) {
            bestDiff = diff;
            bestIdx = i;
        }
    }
    return bestIdx;
}

function updateTransitScaleControls() {
    const slider = document.getElementById('biwheelTimeSlider');
    const prevBtn = document.getElementById('btnScalePrev');
    const nextBtn = document.getElementById('btnScaleNext');
    const currentEl = document.getElementById('biwheelScaleCurrent');
    const rangeEl = document.getElementById('biwheelScaleRange');
    const ticksEl = document.getElementById('biwheelScaleTicks');
    const points = ForecastState.transitScalePoints;

    if (!slider || !prevBtn || !nextBtn || !currentEl || !rangeEl) return;

    const hasPoints = points.length > 0;
    slider.max = String(Math.max(0, points.length - 1));
    slider.value = String(Math.min(ForecastState.transitScaleIndex, Math.max(0, points.length - 1)));
    slider.disabled = !hasPoints;
    prevBtn.disabled = !hasPoints || ForecastState.transitScaleIndex <= 0;
    nextBtn.disabled = !hasPoints || ForecastState.transitScaleIndex >= points.length - 1;

    const selectedDate = getTransitScaleDateByIndex(ForecastState.transitScaleIndex);
    currentEl.textContent = selectedDate || '—';
    rangeEl.textContent = hasPoints ? `${points[0]} → ${points[points.length - 1]} (${points.length} точек)` : '';
    renderTransitScaleTicks(ticksEl, points, ForecastState.transitScaleIndex);
    updateTransitPlaybackButton();
}

function updateTransitPlaybackButton() {
    const playBtn = document.getElementById('btnScalePlay');
    if (!playBtn) return;
    const atEnd = ForecastState.transitScalePoints.length > 0 &&
        ForecastState.transitScaleIndex >= ForecastState.transitScalePoints.length - 1;
    playBtn.textContent = ForecastState.isScalePlaying ? '⏸' : '▶';
    playBtn.title = ForecastState.isScalePlaying ? 'Пауза' : 'Автопрокрутка';
    playBtn.disabled = ForecastState.transitScalePoints.length === 0 || (atEnd && !ForecastState.isScalePlaying);
}

function getScaleTickStride(totalPoints) {
    if (totalPoints <= 14) return 1;
    if (totalPoints <= 50) return 5;
    if (totalPoints <= 100) return 7;
    return 10;
}

function formatScaleTickLabel(dateStr, totalPoints) {
    if (!dateStr) return '';
    if (totalPoints <= 20) return dateStr.slice(5);
    const [y, m, d] = dateStr.split('-');
    return `${d}.${m}`;
}

function buildTransitPrewarmQueue(centerDate) {
    const points = ForecastState.transitScalePoints || [];
    if (!centerDate || !points.length) return [];
    const centerIndex = points.indexOf(centerDate);
    if (centerIndex < 0) return [];

    const queue = [];
    const seen = new Set([centerDate]);
    const pushIfValid = (idx) => {
        if (idx < 0 || idx >= points.length) return;
        const date = points[idx];
        if (!date || seen.has(date)) return;
        seen.add(date);
        queue.push(date);
    };

    for (let delta = 1; delta <= 3; delta++) {
        pushIfValid(centerIndex + delta);
        pushIfValid(centerIndex - delta);
    }

    pushIfValid(0);
    pushIfValid(points.length - 1);
    return queue;
}

function scheduleTransitBiwheelPrewarm(centerDate) {
    const method = document.getElementById('methodSelect')?.value;
    if (method !== 'transits') return;

    const queue = buildTransitPrewarmQueue(centerDate);
    if (!queue.length) return;

    const seq = ++ForecastState.transitPrewarmSeq;
    (async () => {
        for (const dateStr of queue) {
            if (seq !== ForecastState.transitPrewarmSeq) return;
            if (ForecastState.transitBiwheelCache[dateStr]) continue;
            try {
                await fetchTransitBiwheelData(dateStr);
            } catch (err) {
                console.debug('Transit biwheel prewarm skipped:', dateStr, err?.message || err);
            }
        }
    })();
}

function renderTransitScaleTicks(container, points, activeIndex) {
    if (!container) return;
    if (!points || points.length === 0) {
        container.innerHTML = '';
        return;
    }
    const total = points.length;
    const stride = getScaleTickStride(total);
    const indexSet = new Set([0, total - 1]);
    for (let i = 0; i < total; i += stride) indexSet.add(i);
    const indexes = [...indexSet].sort((a, b) => a - b);

    container.innerHTML = indexes.map(i => {
        const leftPct = total === 1 ? 50 : (i / (total - 1)) * 100;
        const activeClass = i === activeIndex ? ' active' : '';
        const label = formatScaleTickLabel(points[i], total);
        return `<span class="bw-scale-tick${activeClass}" style="left:${leftPct.toFixed(3)}%" title="${points[i]}">${label}</span>`;
    }).join('');
}

function refreshTransitScale(preferredDate) {
    const startDate = document.getElementById('startDate')?.value;
    const endDate = document.getElementById('endDate')?.value;
    const stepSelect = document.getElementById('biwheelStepSelect');
    if (stepSelect && ['day', 'week', 'month'].includes(stepSelect.value)) {
        ForecastState.transitScaleUnit = stepSelect.value;
    }

    ForecastState.transitScalePoints = buildTransitScalePoints(
        startDate,
        endDate,
        ForecastState.transitScaleUnit
    );

    if (!ForecastState.transitScalePoints.length) {
        stopTransitScalePlayback();
        ForecastState.transitScaleIndex = 0;
        updateTransitScaleControls();
        return;
    }

    const target = preferredDate || ForecastState.pendingBiwheelDate || ForecastState.transitMoment || startDate;
    ForecastState.transitScaleIndex = findNearestTransitScaleIndex(target);
    ForecastState.pendingBiwheelDate = null;
    updateTransitScaleControls();
}

function setTransitScaleIndex(index) {
    const points = ForecastState.transitScalePoints;
    if (!points.length) return null;
    const nextIndex = Math.max(0, Math.min(index, points.length - 1));
    ForecastState.transitScaleIndex = nextIndex;
    updateTransitScaleControls();
    return points[nextIndex];
}

function shiftTransitScale(delta) {
    const method = document.getElementById('methodSelect').value;
    if (method !== 'transits') return false;
    const prevIndex = ForecastState.transitScaleIndex;
    const nextDate = setTransitScaleIndex(ForecastState.transitScaleIndex + delta);
    if (!nextDate) return false;
    if (ForecastState.transitScaleIndex === prevIndex) return false;
    calculateTransitBiwheelAt(nextDate, { showLoading: false }).catch(err => {
        console.error('Transit biwheel step error:', err);
    });
    return true;
}

let biwheelSliderDebounce = null;
function onTransitScaleSliderInput(e) {
    const method = document.getElementById('methodSelect').value;
    if (method !== 'transits') return;
    const index = parseInt(e.target.value, 10);
    const selectedDate = setTransitScaleIndex(Number.isNaN(index) ? 0 : index);
    if (!selectedDate) return;

    clearTimeout(biwheelSliderDebounce);
    biwheelSliderDebounce = setTimeout(() => {
        calculateTransitBiwheelAt(selectedDate, { showLoading: false }).catch(err => {
            console.error('Transit biwheel slider error:', err);
        });
    }, 180);
}

function startTransitScalePlayback() {
    if (ForecastState.isScalePlaying) return;
    const method = document.getElementById('methodSelect').value;
    if (method !== 'transits') return;
    const points = ForecastState.transitScalePoints;
    if (!points.length) return;
    if (ForecastState.transitScaleIndex >= points.length - 1) {
        setTransitScaleIndex(0);
    }

    ForecastState.isScalePlaying = true;
    updateTransitPlaybackButton();
    ForecastState.scalePlaybackTimer = setInterval(() => {
        if (ForecastState.transitBiwheelBusy) return;
        const moved = shiftTransitScale(1);
        if (!moved) {
            stopTransitScalePlayback();
        }
    }, 1000);
}

function stopTransitScalePlayback() {
    if (ForecastState.scalePlaybackTimer) {
        clearInterval(ForecastState.scalePlaybackTimer);
        ForecastState.scalePlaybackTimer = null;
    }
    ForecastState.isScalePlaying = false;
    updateTransitPlaybackButton();
}

function toggleTransitScalePlayback() {
    if (ForecastState.isScalePlaying) stopTransitScalePlayback();
    else startTransitScalePlayback();
}

function initSolarPlaceAutocomplete() {
    const input = document.getElementById('solarLocationName');
    const suggestions = document.getElementById('solarPlaceSuggestions');
    if (!input || !suggestions) return;

    let bound = false;
    const bind = () => {
        if (bound || !window.PlaceAutocomplete) return;
        bound = true;
        PlaceAutocomplete.attach({
            input,
            suggestions,
            minChars: 2,
            debounceMs: 350,
            limit: 5,
            language: 'ru',
            getLabel: (item) => item.shortName || item.displayName,
            onInput: () => {
                // Force explicit place selection from suggestions for valid coords.
                document.getElementById('solarLocationLat').value = '';
                document.getElementById('solarLocationLon').value = '';
                document.getElementById('solarCoordsDisplay').textContent = '';
            },
            onSelect: (item) => {
                document.getElementById('solarLocationLat').value = item.lat;
                document.getElementById('solarLocationLon').value = item.lon;
                document.getElementById('solarCoordsDisplay').textContent = `(${item.lat.toFixed(2)}°, ${item.lon.toFixed(2)}°)`;
            }
        });
    };

    input.addEventListener('focus', bind, { once: true });
}

function updateControlsVisibility() {
    const tab = ForecastState.currentTab;
    const method = document.getElementById('methodSelect').value;
    const dateRange = document.getElementById('dateRangeGroup');
    const singleDate = document.getElementById('singleDateGroup');
    const solarYear = document.getElementById('solarYearGroup');
    const solarOrientation = document.getElementById('solarOrientationGroup');
    const solarLocation = document.getElementById('solarLocationGroup');
    const methodSelect = document.getElementById('methodSelect');
    const biwheelTimeControls = document.getElementById('biwheelTimeControls');
    const transitScaleGroup = document.getElementById('transitScaleGroup');
    const biwheelScaleTicks = document.getElementById('biwheelScaleTicks');

    dateRange.style.display = 'none';
    singleDate.style.display = 'none';
    solarYear.style.display = 'none';
    solarOrientation.style.display = 'none';
    solarLocation.style.display = 'none';
    methodSelect.closest('.control-group').style.display = '';

    if (tab === 'solar') {
        solarYear.style.display = '';
        solarOrientation.style.display = '';
        solarLocation.style.display = '';
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

    if (biwheelTimeControls) {
        const showTimeControls = tab === 'biwheel' && method === 'transits';
        biwheelTimeControls.style.display = showTimeControls ? 'flex' : 'none';
        if (biwheelScaleTicks) biwheelScaleTicks.style.display = showTimeControls ? '' : 'none';
        if (transitScaleGroup) transitScaleGroup.style.display = showTimeControls ? 'flex' : 'none';
        if (!showTimeControls) stopTransitScalePlayback();
        if (showTimeControls) {
            refreshTransitScale();
        }
    } else if (transitScaleGroup) {
        transitScaleGroup.style.display = 'none';
        if (biwheelScaleTicks) biwheelScaleTicks.style.display = 'none';
        stopTransitScalePlayback();
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
        } else {
            const forcedMethod = tab === 'timeline' ? 'transits' : null;
            await calculateAllForecastViews(forcedMethod);
            await renderCurrentTabFromCache();
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
    goToBiwheel(dateStr, highlightAspect) {
        // Set date inputs
        document.getElementById('startDate').value = dateStr;
        document.getElementById('endDate').value = dateStr;
        document.getElementById('singleDate').value = dateStr;
        ForecastState.pendingBiwheelDate = dateStr;
        // Store highlight info for biwheel to pick up after render
        ForecastState.highlightAspect = highlightAspect || null;
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
        let detail = `HTTP ${resp.status}`;
        try {
            const err = await resp.json();
            if (typeof err?.detail === 'string' && err.detail.trim()) {
                detail = err.detail;
            } else if (err?.detail) {
                detail = JSON.stringify(err.detail);
            }
        } catch {
            const text = await resp.text().catch(() => '');
            if (text && text.trim()) {
                detail = text.slice(0, 400);
            }
        }
        throw new Error(detail);
    }
    return resp.json();
}

// ─── Planet priority & groups for filtering ──────────────
const PLANET_PRIORITY = ['Pluto','Neptune','Uranus','Chiron','Saturn','Jupiter','TrueNorthNode','TrueSouthNode','BlackMoon','Proserpina','Mars','Venus','Mercury','Sun','Moon'];

// ─── Timeline filtering & rendering ─────────────────────
function getFilteredTimelineEvents() {
    const data = ForecastState.transitEvents;
    if (!data || !data.events) return [];
    let evts = data.events;
    if (document.getElementById('filterMajor')?.checked) {
        evts = evts.filter(e => e.is_major);
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
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const data = await ensureTransitPeriodData(startDate, endDate, { showLoading: true });
    ForecastState.transitEvents = data;
    ForecastState.transitPeriodKey = getTransitPeriodKey(startDate, endDate);
    showState('timeline', 'content');
    renderTimeline();
    // Also populate table
    populateTable(data.events, 'transit');
    ForecastState.tableDataKey = getTransitTableKey(startDate, endDate);
}

// ─── Biwheel calculation ────────────────────────────────
async function calculateBiwheel() {
    const method = document.getElementById('methodSelect').value;
    if (method === 'transits') {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        await ensureTransitPeriodData(startDate, endDate, { showLoading: true });
        refreshTransitScale(ForecastState.pendingBiwheelDate || ForecastState.transitMoment || startDate);
        const selectedDate = getTransitScaleDateByIndex(ForecastState.transitScaleIndex);
        if (!selectedDate) throw new Error('Укажите корректный период (С/По)');
        await calculateTransitBiwheelAt(selectedDate, { showLoading: true });
        return;
    }

    showState('biwheel', 'loading');
    const targetDate = document.getElementById('singleDate').value;
    const progData = await ensurePrognosticPointData(method, targetDate);
    showState('biwheel', 'content');
    renderBiwheelData(progData);
}

async function calculateTransitBiwheelAt(dateStr, { showLoading = false } = {}) {
    if (!dateStr) throw new Error('Не выбрана дата транзита');
    const requestSeq = ++ForecastState.biwheelRequestSeq;
    if (showLoading) {
        showState('biwheel', 'loading');
    }

    ForecastState.transitBiwheelBusy = true;
    let progData;
    try {
        progData = await fetchTransitBiwheelData(dateStr);
    } finally {
        ForecastState.transitBiwheelBusy = false;
    }

    if (requestSeq !== ForecastState.biwheelRequestSeq) return;

    ForecastState.transitMoment = dateStr;
    showState('biwheel', 'content');
    renderBiwheelData(progData);
    scheduleTransitBiwheelPrewarm(dateStr);
}

// ─── Table calculation ──────────────────────────────────
async function calculateTable() {
    const method = document.getElementById('methodSelect').value;
    if (method === 'transits') {
        await calculateTimeline();
        return;
    }
    // For progressions/directions, calc single point and show aspects
    showState('table', 'loading');
    const targetDate = document.getElementById('singleDate').value;
    const data = await ensurePrognosticPointData(method, targetDate);
    populateTableFromPrognosticData(data, method, targetDate);
    ForecastState.tableDataKey = getPrognosticPointKey(method, targetDate);
    showState('table', 'content');
}

function getTransitPeriodKey(startDate, endDate) {
    return `${startDate}|${endDate}`;
}

function getTransitTableKey(startDate, endDate) {
    return `transits|${startDate}|${endDate}`;
}

function getPrognosticPointKey(method, targetDate) {
    return `${method}|${targetDate}`;
}

async function fetchTransitBiwheelData(dateStr) {
    if (!dateStr) throw new Error('Не выбрана дата транзита');
    if (ForecastState.transitBiwheelCache[dateStr]) {
        return ForecastState.transitBiwheelCache[dateStr];
    }
    if (ForecastState.transitBiwheelInFlight[dateStr]) {
        return ForecastState.transitBiwheelInFlight[dateStr];
    }

    const requestPromise = apiPost('/transits/calculate', {
        user_id: ForecastState.userId,
        date: dateStr,
        time: '12:00:00',
        timezone: getForecastTimezone(),
    }).then((data) => {
        data._method = 'transits';
        ForecastState.transitBiwheelCache[dateStr] = data;
        return data;
    }).finally(() => {
        delete ForecastState.transitBiwheelInFlight[dateStr];
    });

    ForecastState.transitBiwheelInFlight[dateStr] = requestPromise;
    return requestPromise;
}

function renderBiwheelData(data) {
    if (!window.ForecastBiwheel || !data) return;
    if (window.ForecastBiwheel.setOrientationMode) {
        window.ForecastBiwheel.setOrientationMode(ForecastState.biwheelOrientation);
    }
    window.ForecastBiwheel.render(ForecastState.natalData, data);
}

async function ensureTransitPeriodData(startDate, endDate, { showLoading = false } = {}) {
    if (!startDate || !endDate) throw new Error('Укажите даты');
    const key = getTransitPeriodKey(startDate, endDate);

    if (ForecastState.transitPeriodKey === key && ForecastState.transitEvents) {
        ForecastState.transitCalculatedRange = { start_date: startDate, end_date: endDate };
        return ForecastState.transitEvents;
    }
    if (ForecastState.transitPeriodCache[key]) {
        ForecastState.transitEvents = ForecastState.transitPeriodCache[key];
        ForecastState.transitPeriodKey = key;
        ForecastState.transitCalculatedRange = { start_date: startDate, end_date: endDate };
        return ForecastState.transitEvents;
    }

    if (showLoading) showState('timeline', 'loading');
    const data = await apiPost('/transits/period', {
        user_id: ForecastState.userId,
        start_date: startDate,
        end_date: endDate,
        timezone: getForecastTimezone(),
        step_hours: 6,
    });
    ForecastState.transitPeriodCache[key] = data;
    ForecastState.transitEvents = data;
    ForecastState.transitPeriodKey = key;
    ForecastState.transitCalculatedRange = { start_date: startDate, end_date: endDate };
    return data;
}

async function ensurePrognosticPointData(method, targetDate) {
    if (!targetDate) throw new Error('Укажите дату');
    const key = getPrognosticPointKey(method, targetDate);
    if (ForecastState.prognosticPointCache[key]) {
        return ForecastState.prognosticPointCache[key];
    }

    let data;
    if (method === 'progressions') {
        data = await apiPost('/progressions/calculate', {
            user_id: ForecastState.userId,
            target_date: targetDate,
        });
        data._method = 'progressions';
        ForecastState.progressionData = data;
        ForecastState.progressionTargetDate = targetDate;
    } else {
        const dirType = method.replace('directions_', '');
        data = await apiPost('/directions/calculate', {
            user_id: ForecastState.userId,
            target_date: targetDate,
            direction_type: dirType,
        });
        data._method = 'directions';
        ForecastState.directionData = data;
        ForecastState.directionTargetDate = targetDate;
        ForecastState.directionType = dirType;
    }
    ForecastState.prognosticPointCache[key] = data;
    return data;
}

async function calculateAllForecastViews(forcedMethod = null) {
    const method = forcedMethod || document.getElementById('methodSelect').value;
    if (method === 'transits') {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const transitData = await ensureTransitPeriodData(startDate, endDate, { showLoading: true });
        showState('timeline', 'content');
        renderTimeline();
        populateTable(transitData.events, 'transit');
        ForecastState.tableDataKey = getTransitTableKey(startDate, endDate);

        refreshTransitScale(ForecastState.pendingBiwheelDate || ForecastState.transitMoment || startDate);
        const selectedDate = getTransitScaleDateByIndex(ForecastState.transitScaleIndex);
        if (selectedDate) {
            await calculateTransitBiwheelAt(selectedDate, { showLoading: false });
        }
        return;
    }

    const targetDate = document.getElementById('singleDate').value;
    showState('biwheel', 'loading');
    const prognosticData = await ensurePrognosticPointData(method, targetDate);
    renderBiwheelData(prognosticData);
    showState('biwheel', 'content');

    populateTableFromPrognosticData(prognosticData, method, targetDate);
    ForecastState.tableDataKey = getPrognosticPointKey(method, targetDate);
    showState('table', 'content');
}

async function renderCurrentTabFromCache() {
    const tab = ForecastState.currentTab;
    const method = document.getElementById('methodSelect').value;
    if (tab === 'solar') {
        if (ForecastState.solarData) {
            showState('solar', 'content');
            renderSolar(ForecastState.solarData);
        } else {
            showState('solar', 'empty');
        }
        return;
    }

    if (tab === 'timeline') {
        if (ForecastState.transitEvents) {
            showState('timeline', 'content');
            renderTimeline();
        } else {
            showState('timeline', 'empty');
        }
        return;
    }

    if (tab === 'biwheel') {
        if (method === 'transits') {
            const startDate = document.getElementById('startDate').value;
            refreshTransitScale(ForecastState.pendingBiwheelDate || ForecastState.transitMoment || startDate);
            const selectedDate = getTransitScaleDateByIndex(ForecastState.transitScaleIndex);
            const cached = selectedDate ? ForecastState.transitBiwheelCache[selectedDate] : null;
            if (cached) {
                ForecastState.transitMoment = selectedDate;
                showState('biwheel', 'content');
                renderBiwheelData(cached);
                scheduleTransitBiwheelPrewarm(selectedDate);
            } else {
                showState('biwheel', 'empty');
            }
            return;
        }

        const targetDate = document.getElementById('singleDate').value;
        const progKey = getPrognosticPointKey(method, targetDate);
        const data = ForecastState.prognosticPointCache[progKey];
        if (data) {
            showState('biwheel', 'content');
            renderBiwheelData(data);
        } else {
            showState('biwheel', 'empty');
        }
        return;
    }

    if (tab === 'table') {
        let expectedKey = null;
        if (method === 'transits') {
            expectedKey = getTransitTableKey(
                document.getElementById('startDate').value,
                document.getElementById('endDate').value
            );
        } else {
            expectedKey = getPrognosticPointKey(method, document.getElementById('singleDate').value);
        }

        if (ForecastState.tableDataKey && ForecastState.tableDataKey === expectedKey) {
            showState('table', 'content');
            if (ForecastState.tableRowsRaw.length) {
                if (ForecastState.tableRows.length) renderTableRows();
                else applyTableFiltersAndRender();
            }
        } else {
            showState('table', 'empty');
        }
    }
}

// ─── Solar calculation ──────────────────────────────────
async function calculateSolar() {
    showState('solar', 'loading');
    const year = parseInt(document.getElementById('solarYear').value);
    if (!year || year < 1900 || year > 2100) throw new Error('Укажите год (1900-2100)');

    // Build request payload
    const payload = {
        user_id: ForecastState.userId,
        year: year,
        save_to_db: false,
    };

    const lat = parseFloat(document.getElementById('solarLocationLat').value);
    const lon = parseFloat(document.getElementById('solarLocationLon').value);
    const name = document.getElementById('solarLocationName').value?.trim();
    if (!isNaN(lat) && !isNaN(lon)) {
        payload.location_latitude = lat;
        payload.location_longitude = lon;
        if (name) payload.location_name = name;
    } else {
        throw new Error('Выберите место из списка подсказок');
    }

    const data = await apiPost('/solar/calculate', payload);
    ForecastState.solarData = data;
    ForecastState.solarCalculatedYear = year;
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
    renderSolarChart(data);
    // Planets table
    renderSolarPlanetsTable(data);
}

function renderSolarChart(data) {
    const svg = document.getElementById('solarWheel');
    if (!svg) return;
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    if (!ForecastState.solarWheel) {
        ForecastState.solarWheel = new ChartWheel(svg);
    }
    if (typeof ForecastState.solarWheel.setPointScale === 'function') {
        ForecastState.solarWheel.setPointScale(ForecastState.solarPointScale, { redraw: false });
    }
    ForecastState.solarWheel.setOrientationMode(ForecastState.solarOrientation, { redraw: false });
    ForecastState.solarWheel.draw({
        planets: data.planets,
        houses: data.houses,
        angles: data.angles,
        aspects: [],
    });
    resetSolarView();
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

function toggleTableFilters(forceOpen = null) {
    const panel = document.getElementById('tableFilters');
    const btn = document.getElementById('tableFiltersToggle');
    if (!panel || !btn) return;
    const isCollapsed = panel.classList.contains('table-filters-collapsed');
    const shouldOpen = forceOpen === null ? isCollapsed : !!forceOpen;
    panel.classList.toggle('table-filters-collapsed', !shouldOpen);
    btn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    btn.textContent = shouldOpen ? 'Фильтры ▲' : 'Фильтры ▼';
}

function updateTableFiltersBadge() {
    const badge = document.getElementById('tableFiltersCount');
    if (!badge) return;
    let active = 0;
    if ((document.getElementById('tableFilterKind')?.value || 'all') !== 'all') active += 1;
    if ((document.getElementById('tableFilterStrength')?.value || 'all') !== 'all') active += 1;
    if ((document.getElementById('tableFilterAspect')?.value || 'all') !== 'all') active += 1;
    if ((document.getElementById('tableFilterMaxOrb')?.value || '').trim()) active += 1;
    if ((document.getElementById('tableFilterSearch')?.value || '').trim()) active += 1;
    badge.textContent = String(active);
    badge.style.display = active > 0 ? '' : 'none';
}

function resetTableFilters() {
    const kind = document.getElementById('tableFilterKind');
    const strength = document.getElementById('tableFilterStrength');
    const aspect = document.getElementById('tableFilterAspect');
    const maxOrb = document.getElementById('tableFilterMaxOrb');
    const search = document.getElementById('tableFilterSearch');
    if (kind) kind.value = 'all';
    if (strength) strength.value = 'all';
    if (aspect) aspect.value = 'all';
    if (maxOrb) maxOrb.value = '';
    if (search) search.value = '';
    updateTableFiltersBadge();
}

function refreshTableAspectFilterOptions(rows) {
    const aspectSelect = document.getElementById('tableFilterAspect');
    if (!aspectSelect) return;
    const current = aspectSelect.value || 'all';
    const uniq = [...new Set((rows || []).map(r => r.aspect).filter(Boolean))].sort();
    aspectSelect.innerHTML = ['<option value="all">Все</option>']
        .concat(uniq.map(a => `<option value="${a}">${a}</option>`))
        .join('');
    aspectSelect.value = uniq.includes(current) ? current : 'all';
}

function applyTableFiltersAndRender() {
    const raw = ForecastState.tableRowsRaw || [];
    const kind = document.getElementById('tableFilterKind')?.value || 'all';
    const strength = document.getElementById('tableFilterStrength')?.value || 'all';
    const aspect = document.getElementById('tableFilterAspect')?.value || 'all';
    const maxOrbRaw = document.getElementById('tableFilterMaxOrb')?.value?.trim();
    const search = (document.getElementById('tableFilterSearch')?.value || '').trim().toLowerCase();
    const maxOrb = maxOrbRaw ? parseFloat(maxOrbRaw) : null;

    let rows = raw.filter(r => {
        if (kind !== 'all' && r.rowKind !== kind) return false;
        if (strength === 'major' && !r.isMajor) return false;
        if (strength === 'minor' && r.isMajor !== false) return false;
        if (aspect !== 'all' && r.aspect !== aspect) return false;
        if (maxOrb !== null) {
            if (!(r.hasOrb && typeof r.orb === 'number' && r.orb <= maxOrb)) return false;
        }
        if (search) {
            const haystack = [
                r.transit, r.natal, r.aspect, r.type, r.transitDisplay, r.natalDisplay
            ].filter(Boolean).join(' ').toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        return true;
    });

    ForecastState.tableRows = rows;
    updateTableFiltersBadge();
    renderTableRows();
}

// ─── Populate table from transit events ─────────────────
function populateTable(events, method) {
    hideIngressSection();
    showState('table', 'content');
    if (!events || events.length === 0) {
        document.getElementById('tableBody').innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-secondary)">Нет событий</td></tr>';
        ForecastState.tableRowsRaw = [];
        ForecastState.tableRows = [];
        return;
    }
    ForecastState.tableRowsRaw = events.map(ev => ({
        date: ev.t_exact ? ev.t_exact.split('T')[0] : '—',
        method: getMethodLabel(method),
        methodClass: 'transit',
        transit: ev.transit_body,
        aspect: ev.aspect_type,
        natal: ev.natal_body,
        orb: ev.min_orb ?? 99,
        hasOrb: typeof ev.min_orb === 'number',
        isMajor: !!ev.is_major,
        rowKind: 'aspect',
        type: ev.is_major ? 'Мажор' : 'Минор',
    }));
    refreshTableAspectFilterOptions(ForecastState.tableRowsRaw);
    resetTableFilters();
    applyTableFiltersAndRender();
}

// ─── Populate table from aspect list (progressions/directions) ─
function populateTableFromAspects(aspects, method, date) {
    hideIngressSection();
    showState('table', 'content');
    if (!aspects || aspects.length === 0) {
        document.getElementById('tableBody').innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-secondary)">Нет аспектов</td></tr>';
        ForecastState.tableRowsRaw = [];
        ForecastState.tableRows = [];
        return;
    }
    const methodClass = method.startsWith('directions') ? 'direction' : 'progression';
    ForecastState.tableRowsRaw = aspects.map(a => {
        const body = a.progressed_planet || a.directed_object || '—';
        const idx = PLANET_PRIORITY.indexOf(body);
        return {
            date: date,
            method: getMethodLabel(method),
            methodClass,
            transit: body,
            aspect: a.aspect_type,
            natal: a.natal_object || '—',
            orb: a.orb ?? 99,
            hasOrb: typeof a.orb === 'number',
            isMajor: !!a.is_major,
            rowKind: 'aspect',
            type: a.is_major ? 'Мажор' : 'Минор',
            _priority: idx < 0 ? 999 : idx,
        };
    });
    // Sort: slow planets first, then by orb
    ForecastState.tableRowsRaw.sort((a, b) => a._priority - b._priority || a.orb - b.orb);
    refreshTableAspectFilterOptions(ForecastState.tableRowsRaw);
    resetTableFilters();
    applyTableFiltersAndRender();
}

function formatSignLabel(sign) {
    if (!sign) return '—';
    const sym = Symbols?.signs?.[sign] || '';
    const ru = Symbols?.signNamesRu?.[sign] || sign;
    return `${sym ? sym + ' ' : ''}${ru}`;
}

function hideIngressSection() {
    const section = document.getElementById('ingressSection');
    const tbody = document.getElementById('ingressTableBody');
    if (section) section.style.display = 'none';
    if (tbody) tbody.innerHTML = '';
}

function renderIngressSection(rows) {
    const section = document.getElementById('ingressSection');
    const tbody = document.getElementById('ingressTableBody');
    if (!section || !tbody) return;
    if (!rows || !rows.length) {
        section.style.display = 'none';
        tbody.innerHTML = '';
        return;
    }
    tbody.innerHTML = rows.map(r => `
        <tr>
            <td>${r.date}</td>
            <td><span class="method-badge ${r.methodClass}">${r.method}</span></td>
            <td>${r.object}</td>
            <td>${r.ingressType}</td>
            <td>${r.transition}</td>
        </tr>
    `).join('');
    section.style.display = '';
}

function populateTableFromPrognosticData(data, method, date) {
    const aspects = data?.aspects_to_natal || [];
    const planetIngresses = data?.planet_ingresses || [];
    const cuspIngresses = data?.house_cusp_ingresses || [];
    const methodClass = method.startsWith('directions') ? 'direction' : 'progression';
    const ingressRows = [];

    const aspectRows = aspects.map(a => {
        const body = a.progressed_planet || a.directed_object || '—';
        const idx = PLANET_PRIORITY.indexOf(body);
        return {
            date: date,
            method: getMethodLabel(method),
            methodClass,
            transit: body,
            aspect: a.aspect_type,
            natal: a.natal_object || '—',
            orb: a.orb ?? 99,
            hasOrb: typeof a.orb === 'number',
            isMajor: !!a.is_major,
            rowKind: 'aspect',
            type: a.is_major ? 'Мажор' : 'Минор',
            _priority: idx < 0 ? 999 : idx,
        };
    });

    planetIngresses.forEach(ing => {
        const body = ing.body || '—';
        const ingressType = ing.ingress_type === 'house' ? 'Ингрессия дома' : 'Ингрессия знака';
        const fromLabel = ing.ingress_type === 'house'
            ? `Дом ${ing.from_house ?? '—'}`
            : formatSignLabel(ing.from_sign);
        const toLabel = ing.ingress_type === 'house'
            ? `Дом ${ing.to_house ?? '—'}`
            : formatSignLabel(ing.to_sign);
        ingressRows.push({
            date: date,
            method: getMethodLabel(method),
            methodClass,
            object: `${(Symbols?.planets?.[body] || '')} ${body}`.trim(),
            ingressType,
            transition: `${fromLabel} → ${toLabel}`,
        });
    });

    cuspIngresses.forEach(ing => {
        const houseLabel = `Куспид ${ing.house_number} дома`;
        const fromLabel = formatSignLabel(ing.from_sign);
        const toLabel = formatSignLabel(ing.to_sign);
        ingressRows.push({
            date: date,
            method: getMethodLabel(method),
            methodClass,
            object: houseLabel,
            ingressType: 'Ингрессия куспида',
            transition: `${fromLabel} → ${toLabel}`,
        });
    });

    if (aspectRows.length === 0) {
        document.getElementById('tableBody').innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-secondary)">Нет аспектов</td></tr>';
        ForecastState.tableRowsRaw = [];
        ForecastState.tableRows = [];
        refreshTableAspectFilterOptions([]);
        resetTableFilters();
        updateTableFiltersBadge();
    } else {
        ForecastState.tableRowsRaw = aspectRows.sort((a, b) => a._priority - b._priority || a.orb - b.orb);
        refreshTableAspectFilterOptions(ForecastState.tableRowsRaw);
        resetTableFilters();
        applyTableFiltersAndRender();
    }

    renderIngressSection(ingressRows);
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
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-secondary)">Нет строк по текущим фильтрам</td></tr>';
        document.querySelectorAll('.forecast-table th.sortable').forEach(th => {
            const c = th.dataset.sort;
            th.classList.toggle('sort-active', c === col);
            th.classList.toggle('sort-desc', c === col && !asc);
        });
        return;
    }
    tbody.innerHTML = rows.map(r => {
        const tSym = Symbols?.planets?.[r.transit] || r.transit;
        const nSym = Symbols?.planets?.[r.natal] || r.natal;
        const aSym = Symbols?.aspects?.[r.aspect] || r.aspect;
        const harmony = getAspectHarmony(r.aspect);
        const transitCell = r.transitDisplay || `${tSym} ${r.transit}`;
        const natalCell = r.natalDisplay || `${nSym} ${r.natal}`;
        const aspectCell = r.aspectDisplay || `${aSym} ${r.aspect}`;
        return `<tr>
            <td>${r.date}</td>
            <td><span class="method-badge ${r.methodClass}">${r.method}</span></td>
            <td>${transitCell}</td>
            <td><span class="aspect-badge ${harmony}">${aspectCell}</span></td>
            <td>${natalCell}</td>
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

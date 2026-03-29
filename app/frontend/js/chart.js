/**
 * Главный скрипт страницы натальной карты
 */

let chartWheel = null;
let chartDataRenderer = null;
let inFlightRecalcPromise = null;
let inFlightRecalcKey = null;
let currentHoveredAspectKey = null;
let chartToastTimer = null;
const editClientState = {
    autocompleteBound: false,
    originalCoords: null,
    selectedCoords: null,
    originalPlace: '',
    selectedPlaceLabel: '',
};
const HOUSE_SYSTEM_ALIASES = {
    'P': 'P',
    'K': 'K',
    'O': 'O',
    'R': 'R',
    'C': 'C',
    'E': 'E',
    'W': 'W',
    'X': 'X',
    'H': 'H',
    'T': 'T',
    'B': 'B',
    'M': 'M',
    'PLACIDUS': 'P',
    'KOCH': 'K',
    'PORPHYRY': 'O',
    'REGIOMONTANUS': 'R',
    'CAMPANUS': 'C',
    'EQUAL': 'E',
    'WHOLE_SIGN': 'W',
    'WHOLESIGN': 'W'
};

function t(key, params) {
    return window.FrontendI18n?.t?.(key, params) || key;
}

async function waitForI18nReady() {
    if (!window.FrontendI18n?.ready) return;
    await Promise.resolve(window.FrontendI18n.ready).catch(() => {});
}

function normalizeHouseSystemCode(value) {
    const raw = String(value || 'P').trim().toUpperCase().replace(/[\s-]+/g, '_');
    return HOUSE_SYSTEM_ALIASES[raw] || 'P';
}

let currentSettings = {
    houseSystem: 'P',
    hiddenPlanets: [],
    orientation: 'aries',
    planetScale: readSavedPlanetScale(),
    pointScale: readSavedPointScale()
};

function clampPointScale(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 1;
    return Math.min(1.7, Math.max(0.8, n));
}

function readSavedPlanetScale() {
    const raw = localStorage.getItem('natalPlanetScale') || localStorage.getItem('natalPointScale') || '1.2';
    return clampPointScale(parseFloat(raw));
}

function readSavedPointScale() {
    return clampPointScale(parseFloat(localStorage.getItem('natalPointScale') || '1.0'));
}

document.addEventListener('DOMContentLoaded', async () => {
    await waitForI18nReady();

    const me = await window.AstroAPI?.requireAuth?.({ redirectTo: '/login.html' });
    if (!me) return;

    // Получаем данные карты из сессии
    let chartData = AstroAPI.getChartFromSession();
    const formData = AstroAPI.getFormData();

    if (!chartData) {
        window.location.href = 'index.html';
        return;
    }

    currentSettings.houseSystem = normalizeHouseSystemCode(
        chartData.birth_data?.house_system || formData?.houseSystem || 'P'
    );

    chartData = applyChartState(chartData, { houseSystem: currentSettings.houseSystem });

    // Обновляем заголовок
    updateHeader(chartData);
    // Инициализируем круговую карту
    const svgElement = document.getElementById('chartWheel');
    chartWheel = new ChartWheel(svgElement);
    chartWheel.setOrientationMode(currentSettings.orientation, { redraw: false });
    chartWheel.setPointScales({
        planets: currentSettings.planetScale,
        points: currentSettings.pointScale
    }, { redraw: false });
    chartWheel.draw(chartData);

    // Сохраняем в глобальную область для фильтров
    window.chartWheel = chartWheel;

    // Инициализируем таблицы данных
    chartDataRenderer = new ChartDataRenderer();
    chartDataRenderer.render(chartData);
    chartDataRenderer.setAspectTypeFilter('all');

    initPlanetRowClick();

    document.addEventListener('chart:aspect-planet-filter', (event) => {
        const planetName = event?.detail?.planetName || null;
        if (chartDataRenderer) {
            chartDataRenderer.setAspectPlanetFilter(planetName);
        }
    });

    document.addEventListener('chart:aspect-hover', (event) => {
        const aspectKey = event?.detail?.aspectKey || null;
        currentHoveredAspectKey = aspectKey;
        syncHoveredAspectToActiveSurface();
    });

    document.addEventListener('chart:aspect-leave', () => {
        currentHoveredAspectKey = null;
        if (chartDataRenderer?.clearHoveredAspect) {
            chartDataRenderer.clearHoveredAspect();
        }
    });

    // Инициализируем вкладки и настройки
    initTabs();
    initSettings(chartData);
    initPanelTabs();
    initAspectLegendFilters();
    initChartActions();
    initEditClientDialog();

    document.addEventListener('frontend:locale-changed', () => {
        if (!window.chartDataCache) return;
        updateHeader(window.chartDataCache);
        refreshEditDialogLocale();
        if (chartDataRenderer && typeof chartDataRenderer.render === 'function') {
            const hidden = currentSettings.hiddenPlanets || [];
            redrawChart(window.chartDataCache, hidden, currentSettings.orientation);
        }
    });

    window.addEventListener('resize', () => {
        syncHoveredAspectToActiveSurface();
    });
});

/**
 * Обновление ссылок на интерпретации с user_id
 */
/**
 * Click on planet table row → highlight planet on wheel + show tooltip near it
 */
function initPlanetRowClick() {
    const planetsTable = document.getElementById('planetsTable');
    if (!planetsTable) return;

    let activePlanetName = null;

    planetsTable.addEventListener('click', (e) => {
        const row = e.target.closest('tr[data-planet]');
        if (!row) return;

        const planetName = row.dataset.planet;
        const wheel = window.chartWheel;
        if (!wheel) return;

        // Deactivate previously active planet
        if (activePlanetName) {
            const prevGroup = wheel.svg.querySelector(`[data-planet="${activePlanetName}"]`);
            if (prevGroup) wheel.onPlanetHover({ currentTarget: prevGroup }, false);
            wheel.hideTooltip();
            document.getElementById(`row-${activePlanetName}`)?.classList.remove('active-row');
        }

        // Toggle off if clicking same row
        if (activePlanetName === planetName) {
            activePlanetName = null;
            return;
        }

        activePlanetName = planetName;
        row.classList.add('active-row');

        const group = wheel.svg.querySelector(`[data-planet="${planetName}"]`);
        if (!group) return;

        // Highlight planet + related aspects on the wheel
        wheel.onPlanetHover({ currentTarget: group }, true);

        // Show tooltip positioned near the planet symbol on the wheel
        const groupRect = group.getBoundingClientRect();
        const fakeEvent = {
            currentTarget: group,
            clientX: groupRect.left + groupRect.width / 2,
            clientY: groupRect.top + groupRect.height / 2,
        };
        wheel.onPlanetClick(fakeEvent);
    });

    // Clicking the chart canvas deselects
    document.getElementById('view-chart')?.addEventListener('click', (e) => {
        if (!activePlanetName) return;
        if (e.target.closest('.planet-group')) return; // let wheel handle its own clicks
        const wheel = window.chartWheel;
        if (!wheel) return;
        const prevGroup = wheel.svg.querySelector(`[data-planet="${activePlanetName}"]`);
        if (prevGroup) wheel.onPlanetHover({ currentTarget: prevGroup }, false);
        wheel.hideTooltip();
        document.getElementById(`row-${activePlanetName}`)?.classList.remove('active-row');
        activePlanetName = null;
    });
}

/**
 * Обновление заголовка с данными рождения
 */
function updateHeader(chartData) {
    const birthData = chartData.birth_data;
    const formData = AstroAPI.getFormData();
    
    const date = new Date(birthData.date);
    const locale = window.FrontendI18n?.getLocale?.() || 'en';
    const dateStr = Number.isNaN(date.getTime())
        ? birthData.date
        : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    const timeStr = birthData.time.slice(0, 5);
    
    const firstName = birthData?.first_name || formData?.firstName || '';
    const lastName = birthData?.last_name || formData?.lastName || '';
    const clientName = [firstName, lastName].filter(Boolean).join(' ').trim();
    const placeStr = getBirthPlaceLabel(chartData, formData);

    const titleEl = document.getElementById('birthDate');
    const subtitleEl = document.getElementById('birthPlace');
    titleEl?.removeAttribute('data-i18n');
    if (clientName) {
        titleEl.textContent = clientName;
        subtitleEl.textContent = placeStr
            ? `${dateStr}, ${timeStr} · ${placeStr}`
            : `${dateStr}, ${timeStr}`;
    } else {
        titleEl.textContent = `${dateStr}, ${timeStr}`;
        subtitleEl.textContent = placeStr;
    }
}

function getBirthPlaceLabel(chartData, formData) {
    const candidates = [
        chartData?.birth_data?.place,
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

function getTranslatedSignName(signName) {
    const key = `astro.sign.${signName}`;
    const translated = t(key);
    return translated === key ? (window.Symbols?.signNamesRu?.[signName] || signName || '') : translated;
}

function getCurrentChartUserId() {
    return (
        window.chartDataRawCache?.user_id
        || window.chartDataCache?.user_id
        || localStorage.getItem('currentUserId')
        || null
    );
}

function applyChartState(rawChartData, options = {}) {
    if (!rawChartData) return rawChartData;

    const ensuredRawChartData = ensureChartUserId(rawChartData, options.userId || getCurrentChartUserId());
    const houseSystem = normalizeHouseSystemCode(
        options.houseSystem
        || currentSettings.houseSystem
        || AstroAPI.getFormData()?.houseSystem
        || 'P'
    );

    window.chartDataRawCache = ensuredRawChartData;
    window.chartDataCache = window.NatalWheelData?.prepareNatalWheelData
        ? window.NatalWheelData.prepareNatalWheelData(ensuredRawChartData, { houseSystem })
        : ensuredRawChartData;

    AstroAPI.saveChartToSession(ensuredRawChartData);
    AstroAPI.saveFormData(AstroAPI.chartToFormData(ensuredRawChartData, { houseSystem }));

    return window.chartDataCache;
}

function ensureChartUserId(chartData, fallbackUserId) {
    if (!chartData) return chartData;
    const userId = chartData.user_id || fallbackUserId || null;
    return userId
        ? { ...chartData, user_id: userId }
        : chartData;
}

/**
 * Инициализация вкладок
 */
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

/**
 * Инициализация вкладок панелей (левая/правая)
 */
function initPanelTabs() {
    document.querySelectorAll('.panel-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const panelId = tab.dataset.panelTab;
            const parent = tab.closest('.side-panel');

            // Переключаем активную вкладку
            parent.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
            parent.querySelectorAll('.panel-tab-content').forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(panelId).classList.add('active');
            syncHoveredAspectToActiveSurface();
        });
    });
}

function isElementVisible(element) {
    if (!element) return false;
    if (element.offsetParent === null) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
}

function getActiveAspectSurface() {
    const leftPanel = document.getElementById('view-planets');
    if (!leftPanel || !isElementVisible(leftPanel)) return null;

    const aspectsPane = document.getElementById('aspects-list');
    const gridPane = document.getElementById('grid-list');

    if (aspectsPane?.classList.contains('active')) return 'table';
    if (gridPane?.classList.contains('active')) return 'grid';
    return null;
}

function syncHoveredAspectToActiveSurface() {
    if (!chartDataRenderer || typeof chartDataRenderer.setHoveredAspect !== 'function') return;

    if (!currentHoveredAspectKey) {
        chartDataRenderer.clearHoveredAspect?.();
        return;
    }

    const surface = getActiveAspectSurface();
    if (!surface) {
        chartDataRenderer.clearHoveredAspect?.();
        return;
    }

    chartDataRenderer.setHoveredAspect(currentHoveredAspectKey, { surface });
}

/**
 * Инициализация панели настроек
 */
function initSettings(chartData) {
    const settingsToggle = document.getElementById('settingsToggle');
    const settingsPanel = document.getElementById('settingsPanel');
    const planetToggles = document.getElementById('planetToggles');
    const orientationSelect = document.getElementById('orientationSelect');
    const planetScaleRange = document.getElementById('planetScaleRange');
    const planetScaleValue = document.getElementById('planetScaleValue');
    const pointScaleRange = document.getElementById('pointScaleRange');
    const pointScaleValue = document.getElementById('pointScaleValue');

    // Список планет для переключения
    const toggleablePlanets = [
        'Chiron',
        'TrueNode',
        'SouthNode',
        'BlackMoon',
        'WhiteMoon',
        'Proserpina',
        'PartOfFortune',
    ];

    // Генерируем чекбоксы
    if (planetToggles) {
        planetToggles.innerHTML = toggleablePlanets.map((planetId) => `
            <label class="planet-toggle">
                <input type="checkbox" data-planet="${planetId}" checked>
                <span><span class="astro-symbol">${Symbols.planets[planetId] || ''}</span> <span data-i18n="astro.planet.${planetId}"></span></span>
            </label>
        `).join('');
        window.FrontendI18nUi?.applyI18n?.(document);
    }

    // Переключение панели
    if (settingsToggle && settingsPanel) {
        settingsToggle.addEventListener('click', () => {
            settingsPanel.classList.toggle('hidden');
        });

        // Закрытие при клике вне панели
        document.addEventListener('click', (e) => {
            if (!settingsPanel.contains(e.target) && e.target !== settingsToggle) {
                settingsPanel.classList.add('hidden');
            }
        });
    }

    // Prevent chart drag when interacting with settings controls
    if (settingsPanel) {
        ['mousedown', 'touchstart', 'wheel'].forEach(evt => {
            settingsPanel.addEventListener(evt, e => e.stopPropagation(), { passive: false });
        });
    }

    if (orientationSelect) {
        orientationSelect.value = currentSettings.orientation;
        orientationSelect.addEventListener('change', () => applySettings());
    }
    const houseSystemSelect = document.getElementById('houseSystemSelect');
    if (houseSystemSelect) {
        houseSystemSelect.value = normalizeHouseSystemCode(currentSettings.houseSystem);
        houseSystemSelect.addEventListener('change', () => applySettings());
    }
    document.querySelectorAll('#planetToggles input').forEach(cb => {
        cb.addEventListener('change', () => applySettings());
    });
    if (planetScaleRange) {
        planetScaleRange.value = String(Math.round(currentSettings.planetScale * 100));
        if (planetScaleValue) planetScaleValue.textContent = `${Math.round(currentSettings.planetScale * 100)}%`;
        planetScaleRange.addEventListener('input', () => {
            if (planetScaleValue) planetScaleValue.textContent = `${planetScaleRange.value}%`;
            applySettings();
        });
    }
    if (pointScaleRange) {
        pointScaleRange.value = String(Math.round(currentSettings.pointScale * 100));
        if (pointScaleValue) pointScaleValue.textContent = `${Math.round(currentSettings.pointScale * 100)}%`;
        pointScaleRange.addEventListener('input', () => {
            if (pointScaleValue) pointScaleValue.textContent = `${pointScaleRange.value}%`;
            applySettings();
        });
    }

    // Применение настроек
}

/**
 * Применение настроек и перерисовка карты
 */
let applySettingsTimer = null;
async function applySettings() {
    if (applySettingsTimer) {
        clearTimeout(applySettingsTimer);
    }
    applySettingsTimer = setTimeout(async () => {
    const houseSystem = normalizeHouseSystemCode(document.getElementById('houseSystemSelect').value);
    const orientation = document.getElementById('orientationSelect')?.value || 'aries';
    const planetScalePct = Number(document.getElementById('planetScaleRange')?.value || 120);
    const pointScalePct = Number(document.getElementById('pointScaleRange')?.value || 100);
    const planetScale = clampPointScale(planetScalePct / 100);
    const pointScale = clampPointScale(pointScalePct / 100);
    const hiddenPlanets = [];

    document.querySelectorAll('#planetToggles input').forEach(cb => {
        if (!cb.checked) {
            hiddenPlanets.push(cb.dataset.planet);
        }
    });

    currentSettings.houseSystem = houseSystem;
    currentSettings.hiddenPlanets = hiddenPlanets;
    currentSettings.orientation = orientation;
    currentSettings.planetScale = planetScale;
    currentSettings.pointScale = pointScale;
    localStorage.setItem('natalPlanetScale', String(planetScale));
    localStorage.setItem('natalPointScale', String(pointScale));

    // Если система домов изменилась — нужен пересчёт на сервере
    const formData = AstroAPI.getFormData();
    const currentChartHouseSystem = normalizeHouseSystemCode(formData?.houseSystem || 'P');
    if (formData && houseSystem !== currentChartHouseSystem) {
        // Пересчитываем карту с новой системой домов
        try {
            const requestData = buildChartRequestFromFormData(formData, houseSystem);
            if (!requestData) {
                redrawChart(window.chartDataCache, hiddenPlanets, orientation);
                applySettingsTimer = null;
                return;
            }
            const requestKey = JSON.stringify(requestData);
            if (!inFlightRecalcPromise || inFlightRecalcKey !== requestKey) {
                inFlightRecalcKey = requestKey;
                inFlightRecalcPromise = AstroAPI.calculateNatalChart(requestData, { saveToDb: false });
            }
            let newChartData = await inFlightRecalcPromise;

            if (newChartData) {
                newChartData = applyChartState(
                    ensureChartUserId(newChartData, getCurrentChartUserId()),
                    { houseSystem }
                );
                updateHeader(newChartData);
                redrawChart(newChartData, hiddenPlanets, orientation);
            }
        } catch (err) {
            console.error('Failed to recalculate chart:', err);
        } finally {
            inFlightRecalcPromise = null;
            inFlightRecalcKey = null;
        }
    } else {
        // Просто скрываем/показываем планеты
        redrawChart(window.chartDataCache, hiddenPlanets, orientation);
    }

    // В live-режиме панель не закрываем
    applySettingsTimer = null;
    }, 120);
}

function buildChartRequestFromFormData(formData, houseSystem) {
    if (!formData) return null;

    const hasApiShape = Boolean(formData.date && formData.time && formData.timezone);
    if (hasApiShape) {
        return {
            ...formData,
            house_system: houseSystem
        };
    }

    if (
        formData.day == null || formData.month == null || formData.year == null
        || formData.hour == null || formData.minute == null || !formData.timezone
    ) {
        return null;
    }

    const requestData = {
        first_name: formData.firstName || null,
        last_name: formData.lastName || null,
        date: AstroAPI.formatDate(formData.day, formData.month, formData.year),
        time: AstroAPI.formatTime(formData.hour, formData.minute),
        timezone: formData.timezone,
        house_system: houseSystem
    };

    if (typeof formData.place === 'string' && formData.place.trim()) {
        requestData.place = formData.place.trim();
    }

    const latitude = Number(formData.latitude);
    const longitude = Number(formData.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        requestData.latitude = latitude;
        requestData.longitude = longitude;
    }

    return requestData;
}

/**
 * Перерисовка карты с учётом скрытых планет
 */
function redrawChart(chartData, hiddenPlanets, orientation = currentSettings.orientation) {
    // Фильтруем планеты
    const filteredData = {
        ...chartData,
        planets: chartData.planets.filter(p => !hiddenPlanets.includes(p.name)),
        aspects: chartData.aspects.filter(a =>
            !hiddenPlanets.includes(a.planet_1) && !hiddenPlanets.includes(a.planet_2)
        )
    };

    // Перерисовываем
    if (chartWheel) {
        chartWheel.setOrientationMode(orientation, { redraw: false });
        chartWheel.setPointScales({
            planets: currentSettings.planetScale,
            points: currentSettings.pointScale
        }, { redraw: false });
    }
    chartWheel.draw(filteredData);
    chartDataRenderer.render(filteredData);
    syncHoveredAspectToActiveSurface();
}

function initAspectLegendFilters() {
    document.querySelectorAll('.legend-item.clickable').forEach((item) => {
        item.addEventListener('click', () => {
            const filter = item.dataset.filter;

            document.querySelectorAll('.legend-item.clickable').forEach((legendItem) => {
                legendItem.classList.remove('active');
            });
            item.classList.add('active');

            if (window.chartWheel) {
                window.chartWheel.setAspectFilter(filter);
            }
            if (chartDataRenderer) {
                chartDataRenderer.setAspectTypeFilter(filter);
            }
        });
    });
}

function initChartActions() {
    const toggle = document.getElementById('chartActionsToggle');
    const menu = document.getElementById('chartActionsMenu');
    const editAction = document.getElementById('editClientAction');

    if (!toggle || !menu || !editAction) return;

    toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        const shouldOpen = menu.classList.contains('hidden');
        setChartActionsMenuOpen(shouldOpen);
    });

    editAction.addEventListener('click', () => {
        setChartActionsMenuOpen(false);
        openEditClientDialog();
    });

    document.addEventListener('click', (event) => {
        if (!menu.contains(event.target) && !toggle.contains(event.target)) {
            setChartActionsMenuOpen(false);
        }
    });
}

function setChartActionsMenuOpen(isOpen) {
    const toggle = document.getElementById('chartActionsToggle');
    const menu = document.getElementById('chartActionsMenu');
    if (!toggle || !menu) return;

    menu.classList.toggle('hidden', !isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function initEditClientDialog() {
    const refs = getEditDialogRefs();
    if (!refs.dialog || refs.dialog.dataset.bound === 'true') return;

    refs.dialog.dataset.bound = 'true';
    window.Timezones?.populate?.(refs.timezone);

    refs.close.addEventListener('click', closeEditClientDialog);
    refs.cancel.addEventListener('click', closeEditClientDialog);
    refs.backdrop.addEventListener('click', closeEditClientDialog);
    refs.form.addEventListener('submit', handleEditClientSubmit);
    refs.placeInput.addEventListener('input', handleEditPlaceInput);
    refs.placeInput.addEventListener('focus', bindEditPlaceAutocomplete, { once: true });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;

        if (!refs.dialog.classList.contains('hidden')) {
            closeEditClientDialog();
            return;
        }

        setChartActionsMenuOpen(false);
    });
}

function getEditDialogRefs() {
    return {
        dialog: document.getElementById('editClientDialog'),
        backdrop: document.getElementById('editClientBackdrop'),
        form: document.getElementById('editClientForm'),
        close: document.getElementById('editClientClose'),
        cancel: document.getElementById('editClientCancel'),
        submit: document.getElementById('editClientSubmit'),
        error: document.getElementById('editClientError'),
        firstName: document.getElementById('editFirstName'),
        lastName: document.getElementById('editLastName'),
        day: document.getElementById('editBirthDay'),
        month: document.getElementById('editBirthMonth'),
        year: document.getElementById('editBirthYear'),
        hour: document.getElementById('editBirthHour'),
        minute: document.getElementById('editBirthMinute'),
        placeInput: document.getElementById('editBirthPlace'),
        placeSuggestions: document.getElementById('editBirthPlaceSuggestions'),
        placeHint: document.getElementById('editPlaceHint'),
        timezone: document.getElementById('editTimezone'),
        timezoneHint: document.getElementById('editTimezoneHint'),
    };
}

function openEditClientDialog() {
    const refs = getEditDialogRefs();
    const rawChartData = window.chartDataRawCache || AstroAPI.getChartFromSession();
    if (!refs.dialog || !rawChartData?.user_id) {
        showChartToast(t('page.chart.edit.errors.chartUnavailable'), 'error');
        return;
    }

    const formData = AstroAPI.chartToFormData(rawChartData, { houseSystem: currentSettings.houseSystem });
    const place = String(formData.place || '').trim();

    refs.firstName.value = formData.firstName || '';
    refs.lastName.value = formData.lastName || '';
    refs.day.value = formData.day || '';
    refs.month.value = formData.month || '';
    refs.year.value = formData.year || '';
    refs.hour.value = formData.hour || '';
    refs.minute.value = formData.minute || '';
    refs.placeInput.value = place;

    window.Timezones?.populate?.(refs.timezone);
    refs.timezone.value = formData.timezone || '';
    refs.timezoneHint.textContent = '';
    refs.timezoneHint.style.color = '';

    editClientState.originalCoords = {
        lat: Number(formData.latitude),
        lon: Number(formData.longitude),
    };
    editClientState.selectedCoords = {
        lat: Number(formData.latitude),
        lon: Number(formData.longitude),
    };
    editClientState.originalPlace = normalizeLooseText(place);
    editClientState.selectedPlaceLabel = normalizeLooseText(place);

    refs.error.classList.add('hidden');
    refs.error.textContent = '';
    renderEditPlaceHint('current');
    setEditClientSubmitting(false);

    refs.backdrop.classList.remove('hidden');
    refs.dialog.classList.remove('hidden');
    refs.firstName.focus();
    document.body.style.overflow = 'hidden';
}

function closeEditClientDialog() {
    const refs = getEditDialogRefs();
    if (!refs.dialog) return;

    refs.backdrop.classList.add('hidden');
    refs.dialog.classList.add('hidden');
    refs.error.classList.add('hidden');
    refs.error.textContent = '';
    refs.timezoneHint.textContent = '';
    refs.timezoneHint.style.color = '';
    document.body.style.overflow = '';
}

function refreshEditDialogLocale() {
    const refs = getEditDialogRefs();
    if (!refs.dialog || refs.dialog.classList.contains('hidden')) return;

    const timezoneValue = refs.timezone.value;
    window.Timezones?.populate?.(refs.timezone);
    if (timezoneValue) {
        refs.timezone.value = timezoneValue;
    }
    renderEditPlaceHint(resolveEditPlaceHintMode());
}

function bindEditPlaceAutocomplete() {
    const refs = getEditDialogRefs();
    if (editClientState.autocompleteBound || !window.PlaceAutocomplete || !refs.placeInput || !refs.placeSuggestions) {
        return;
    }

    editClientState.autocompleteBound = true;

    window.PlaceAutocomplete.attach({
        input: refs.placeInput,
        suggestions: refs.placeSuggestions,
        minChars: 2,
        debounceMs: 350,
        limit: 5,
        getLabel: (item) => item.shortName || item.displayName,
        onSelect: async (item) => {
            editClientState.selectedCoords = { lat: item.lat, lon: item.lon };
            editClientState.selectedPlaceLabel = normalizeLooseText(item.shortName || item.displayName);
            renderEditPlaceHint('selected');

            let resolvedTimezone = null;
            if (item.sourceId && window.AstroAPI?.resolvePlaceTimezone) {
                try {
                    resolvedTimezone = await window.AstroAPI.resolvePlaceTimezone(item.sourceId);
                } catch (_error) {
                    resolvedTimezone = null;
                }
            }

            if (!resolvedTimezone) {
                resolvedTimezone = window.Timezones?.guess?.(item.displayName || item.shortName) || null;
            }

            if (resolvedTimezone) {
                refs.timezone.value = resolvedTimezone;
                refs.timezoneHint.textContent = t('page.index.form.timezone.autoDetected');
                refs.timezoneHint.style.color = '#22c55e';
            }
        },
    });
}

function handleEditPlaceInput(event) {
    const nextValue = normalizeLooseText(event.target.value);
    if (!nextValue) {
        editClientState.selectedCoords = null;
        renderEditPlaceHint('empty');
        return;
    }

    if (nextValue === editClientState.selectedPlaceLabel) {
        renderEditPlaceHint(resolveEditPlaceHintMode());
        return;
    }

    if (nextValue === editClientState.originalPlace) {
        editClientState.selectedCoords = editClientState.originalCoords;
        editClientState.selectedPlaceLabel = editClientState.originalPlace;
        renderEditPlaceHint('current');
        return;
    }

    editClientState.selectedCoords = null;
    renderEditPlaceHint('manual');
}

function resolveEditPlaceHintMode() {
    if (editClientState.selectedCoords && editClientState.selectedPlaceLabel === editClientState.originalPlace) {
        return 'current';
    }
    if (editClientState.selectedCoords) {
        return 'selected';
    }
    if (getEditDialogRefs().placeInput?.value?.trim()) {
        return 'manual';
    }
    return 'empty';
}

function renderEditPlaceHint(mode) {
    const refs = getEditDialogRefs();
    if (!refs.placeHint) return;

    refs.placeHint.style.color = '';

    if (mode === 'selected') {
        refs.placeHint.textContent = t('page.chart.edit.placeSelected');
        refs.placeHint.style.color = '#22c55e';
        return;
    }

    if (mode === 'manual') {
        refs.placeHint.textContent = t('page.chart.edit.placeManual');
        refs.placeHint.style.color = '#b07d10';
        return;
    }

    if (mode === 'empty') {
        refs.placeHint.textContent = t('page.chart.edit.placeHint');
        return;
    }

    refs.placeHint.textContent = t('page.chart.edit.placeCurrent');
}

async function handleEditClientSubmit(event) {
    event.preventDefault();

    const refs = getEditDialogRefs();
    const rawChartData = window.chartDataRawCache || AstroAPI.getChartFromSession();
    if (!refs.form.reportValidity()) return;
    if (!rawChartData?.user_id) {
        showChartToast(t('page.chart.edit.errors.chartUnavailable'), 'error');
        return;
    }

    const place = refs.placeInput.value.trim();
    const requestData = {
        first_name: refs.firstName.value.trim(),
        last_name: refs.lastName.value.trim(),
        date: AstroAPI.formatDate(refs.day.value, refs.month.value, refs.year.value),
        time: AstroAPI.formatTime(refs.hour.value, refs.minute.value),
        timezone: refs.timezone.value,
        place,
        house_system: currentSettings.houseSystem,
    };

    const resolvedCoords = resolveEditCoords(place);
    if (resolvedCoords) {
        requestData.latitude = resolvedCoords.lat;
        requestData.longitude = resolvedCoords.lon;
    }

    refs.error.classList.add('hidden');
    refs.error.textContent = '';
    setEditClientSubmitting(true);

    try {
        const updatedChartData = await AstroAPI.updateClientChart(rawChartData.user_id, requestData);
        const preparedChartData = applyChartState(updatedChartData, { houseSystem: currentSettings.houseSystem });
        currentHoveredAspectKey = null;
        updateHeader(preparedChartData);
        redrawChart(preparedChartData, currentSettings.hiddenPlanets || [], currentSettings.orientation);
        closeEditClientDialog();
        showChartToast(t('page.chart.edit.success'), 'success');
    } catch (error) {
        refs.error.textContent = error.message || t('page.chart.edit.errors.saveFailed');
        refs.error.classList.remove('hidden');
    } finally {
        setEditClientSubmitting(false);
    }
}

function resolveEditCoords(place) {
    const normalizedPlace = normalizeLooseText(place);
    const coords = editClientState.selectedCoords;
    const lat = Number(coords?.lat);
    const lon = Number(coords?.lon);

    if (!normalizedPlace || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
    }

    if (
        normalizedPlace === editClientState.selectedPlaceLabel
        || normalizedPlace === editClientState.originalPlace
    ) {
        return { lat, lon };
    }

    return null;
}

function normalizeLooseText(value) {
    return String(value || '').trim().toLowerCase();
}

function setEditClientSubmitting(isSubmitting) {
    const refs = getEditDialogRefs();
    if (!refs.submit) return;

    refs.submit.disabled = isSubmitting;
    refs.submit.querySelector('.btn-text')?.classList.toggle('hidden', isSubmitting);
    refs.submit.querySelector('.btn-loader')?.classList.toggle('hidden', !isSubmitting);
}

function showChartToast(message, type = 'info') {
    const toast = document.getElementById('chartToast');
    if (!toast || !message) return;

    toast.textContent = message;
    toast.className = `toast ${type}`;

    requestAnimationFrame(() => {
        toast.classList.add('visible');
    });

    clearTimeout(chartToastTimer);
    chartToastTimer = setTimeout(() => {
        toast.classList.remove('visible');
    }, 2800);
}

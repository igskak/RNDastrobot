/**
 * Главный скрипт страницы натальной карты
 */

let chartWheel = null;
let chartDataRenderer = null;
let inFlightRecalcPromise = null;
let inFlightRecalcKey = null;
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

document.addEventListener('DOMContentLoaded', () => {
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

    // Объединяем special_points с planets для отображения
    chartData = mergeSpecialPointsIntoPlanets(chartData);
    if (!chartData.birth_data) {
        chartData.birth_data = {};
    }
    chartData.birth_data.house_system = currentSettings.houseSystem;

    // Сохраняем в глобальный кэш для интерактивности
    window.chartDataCache = chartData;

    // Обновляем заголовок
    updateHeader(chartData);

    // Обновляем ссылки на интерпретации
    updateInterpretationLinks(chartData);

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

    // Инициализируем вкладки и настройки
    initTabs();
    initSettings(chartData);
    initPanelTabs();
    initZoomControls();
    initPinchZoom();
});

/**
 * Объединение special_points с planets для единого отображения
 */
function mergeSpecialPointsIntoPlanets(chartData) {
    if (!chartData.special_points) return chartData;

    // Маппинг имён из API в имена для отображения
    const nameMapping = {
        'TrueNorthNode': 'TrueNode',
        'TrueSouthNode': 'SouthNode',
        'Fortune': 'PartOfFortune'
    };

    // Точки для добавления в planets
    const pointsToAdd = ['TrueNorthNode', 'TrueSouthNode', 'BlackMoon', 'WhiteMoon', 'Fortune'];

    pointsToAdd.forEach(key => {
        const point = chartData.special_points[key];
        if (point && point.longitude !== null) {
            const displayName = nameMapping[key] || key;

            // Проверяем, нет ли уже такой точки в planets
            const exists = chartData.planets.some(p =>
                p.name === displayName || p.name === key
            );

            if (!exists) {
                chartData.planets.push({
                    name: displayName,
                    longitude: point.longitude,
                    sign: point.sign,
                    degree_in_sign: point.degree_in_sign,
                    house: point.house,
                    retrograde: false
                });
            }
        }
    });

    return chartData;
}

/**
 * Обновление ссылок на интерпретации с user_id
 */
function updateInterpretationLinks(chartData) {
    const userId = chartData.user_id || localStorage.getItem('currentUserId');
    if (!userId) return;

    const links = document.querySelectorAll('a[href="interpretations.html"]');
    links.forEach(link => {
        link.href = `interpretations.html?user_id=${userId}`;
    });
}

/**
 * Обновление заголовка с данными рождения
 */
function updateHeader(chartData) {
    const birthData = chartData.birth_data;
    const formData = AstroAPI.getFormData();
    
    // Форматируем дату
    const date = new Date(birthData.date);
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const dateStr = `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    const timeStr = birthData.time.slice(0, 5);
    
    document.getElementById('birthDate').textContent = `${dateStr}, ${timeStr}`;
    document.getElementById('birthPlace').textContent = formData?.place || 
        `${birthData.latitude.toFixed(2)}°, ${birthData.longitude.toFixed(2)}°`;
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
        });
    });
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
        { id: 'Chiron', label: 'Хирон' },
        { id: 'TrueNode', label: 'Сев. Узел' },
        { id: 'SouthNode', label: 'Юж. Узел' },
        { id: 'BlackMoon', label: 'Лилит' },
        { id: 'WhiteMoon', label: 'Селена' },
        { id: 'Proserpina', label: 'Прозерпина' },
        { id: 'PartOfFortune', label: 'Фортуна' }
    ];

    // Генерируем чекбоксы
    if (planetToggles) {
        planetToggles.innerHTML = toggleablePlanets.map(p => `
            <label class="planet-toggle">
                <input type="checkbox" data-planet="${p.id}" checked>
                <span><span class="astro-symbol">${Symbols.planets[p.id] || ''}</span> ${p.label}</span>
            </label>
        `).join('');
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
    const currentChartHouseSystem = normalizeHouseSystemCode(window.chartDataCache?.birth_data?.house_system || 'P');
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
                inFlightRecalcPromise = AstroAPI.calculateNatalChart(requestData);
            }
            let newChartData = await inFlightRecalcPromise;

            if (newChartData) {
                // Объединяем special_points с planets
                newChartData = mergeSpecialPointsIntoPlanets(newChartData);
                if (!newChartData.birth_data) {
                    newChartData.birth_data = {};
                }
                newChartData.birth_data.house_system = houseSystem;
                window.chartDataCache = newChartData;
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
}

/**
 * Инициализация кнопок зума
 */
function initZoomControls() {
    const wrapper = document.getElementById('chartWheelWrapper');
    const svg = document.getElementById('chartWheel');
    let scale = 1;
    let translateX = 0;
    let translateY = 0;

    const updateTransform = () => {
        svg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    };

    document.getElementById('zoomIn')?.addEventListener('click', () => {
        scale = Math.min(scale * 1.2, 4);
        updateTransform();
    });

    document.getElementById('zoomOut')?.addEventListener('click', () => {
        scale = Math.max(scale / 1.2, 0.5);
        updateTransform();
    });

    document.getElementById('zoomReset')?.addEventListener('click', () => {
        scale = 1;
        translateX = 0;
        translateY = 0;
        updateTransform();
    });

    // Фильтры аспектов
    document.querySelectorAll('.legend-item.clickable').forEach(item => {
        item.addEventListener('click', () => {
            const filter = item.dataset.filter;

            // Обновляем активное состояние
            document.querySelectorAll('.legend-item.clickable').forEach(i => {
                i.classList.remove('active');
            });
            item.classList.add('active');

            // Применяем фильтр
            if (window.chartWheel) {
                window.chartWheel.setAspectFilter(filter);
            }
        });
    });

    // Сохраняем для pinch-zoom
    wrapper._zoomState = { scale, translateX, translateY, updateTransform };
}

/**
 * Поддержка pinch-zoom на мобильных устройствах
 */
function initPinchZoom() {
    const wrapper = document.getElementById('chartWheelWrapper');
    const svg = document.getElementById('chartWheel');
    if (!wrapper || !svg) return;

    let initialDistance = 0;
    let initialScale = 1;

    wrapper.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            initialDistance = getDistance(e.touches[0], e.touches[1]);
            initialScale = wrapper._zoomState?.scale || 1;
        }
    }, { passive: true });

    wrapper.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            const currentDistance = getDistance(e.touches[0], e.touches[1]);
            const scaleChange = currentDistance / initialDistance;
            const newScale = Math.min(Math.max(initialScale * scaleChange, 0.5), 4);

            if (wrapper._zoomState) {
                wrapper._zoomState.scale = newScale;
                wrapper._zoomState.updateTransform();
            }
        }
    }, { passive: true });

    function getDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
}

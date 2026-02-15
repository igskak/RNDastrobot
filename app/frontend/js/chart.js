/**
 * Главный скрипт страницы натальной карты
 */

let chartWheel = null;
let chartDataRenderer = null;
let currentSettings = {
    houseSystem: 'Placidus',
    hiddenPlanets: [],
    orientation: 'aries'
};

document.addEventListener('DOMContentLoaded', () => {
    // Получаем данные карты из сессии
    let chartData = AstroAPI.getChartFromSession();

    if (!chartData) {
        window.location.href = 'index.html';
        return;
    }

    // Объединяем special_points с planets для отображения
    chartData = mergeSpecialPointsIntoPlanets(chartData);

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
    const applyBtn = document.getElementById('applySettings');
    const orientationSelect = document.getElementById('orientationSelect');

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

    if (orientationSelect) {
        orientationSelect.value = currentSettings.orientation;
    }

    // Применение настроек
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            applySettings();
        });
    }
}

/**
 * Применение настроек и перерисовка карты
 */
async function applySettings() {
    const houseSystem = document.getElementById('houseSystemSelect').value;
    const orientation = document.getElementById('orientationSelect')?.value || 'aries';
    const hiddenPlanets = [];

    document.querySelectorAll('#planetToggles input').forEach(cb => {
        if (!cb.checked) {
            hiddenPlanets.push(cb.dataset.planet);
        }
    });

    currentSettings.houseSystem = houseSystem;
    currentSettings.hiddenPlanets = hiddenPlanets;
    currentSettings.orientation = orientation;

    // Если система домов изменилась — нужен пересчёт на сервере
    const formData = AstroAPI.getFormData();
    if (formData && houseSystem !== 'Placidus') {
        // Пересчитываем карту с новой системой домов
        try {
            let newChartData = await AstroAPI.calculateChart({
                ...formData,
                house_system: houseSystem
            });

            if (newChartData) {
                // Объединяем special_points с planets
                newChartData = mergeSpecialPointsIntoPlanets(newChartData);
                window.chartDataCache = newChartData;
                redrawChart(newChartData, hiddenPlanets, orientation);
            }
        } catch (err) {
            console.error('Failed to recalculate chart:', err);
        }
    } else {
        // Просто скрываем/показываем планеты
        redrawChart(window.chartDataCache, hiddenPlanets, orientation);
    }

    // Закрываем панель
    document.getElementById('settingsPanel').classList.add('hidden');
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


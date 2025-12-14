/**
 * Главный скрипт страницы натальной карты
 */

document.addEventListener('DOMContentLoaded', () => {
    // Получаем данные карты из сессии
    const chartData = AstroAPI.getChartFromSession();

    if (!chartData) {
        // Если данных нет, возвращаемся на форму
        window.location.href = 'index.html';
        return;
    }

    // Сохраняем в глобальный кэш для интерактивности
    window.chartDataCache = chartData;

    // Обновляем заголовок
    updateHeader(chartData);

    // Инициализируем круговую карту
    const svgElement = document.getElementById('chartWheel');
    const wheel = new ChartWheel(svgElement);
    wheel.draw(chartData);

    // Инициализируем таблицы данных
    const dataRenderer = new ChartDataRenderer();
    dataRenderer.render(chartData);

    // Инициализируем вкладки (старая логика, если есть .tab-btn)
    initTabs();
});

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

            // Убираем active со всех
            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            // Добавляем active на выбранные
            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });
}




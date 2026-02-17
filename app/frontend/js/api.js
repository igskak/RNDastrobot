/**
 * API модуль для работы с бэкендом AstroBot
 */

const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8000/api/v1'
    : '/api/v1';

/**
 * Расчёт натальной карты
 * @param {Object} birthData - Данные рождения
 * @param {Object} options - Дополнительные настройки запроса
 * @returns {Promise<Object>} - Результат расчёта
 */
async function calculateNatalChart(birthData, options = {}) {
    const response = await fetch(`${API_BASE_URL}/natal/calculate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(birthData),
        signal: options.signal,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Ошибка при расчёте карты');
    }

    return response.json();
}

/**
 * Форматирование даты для API
 * @param {number} day 
 * @param {string} month 
 * @param {number} year 
 * @returns {string} - Дата в формате YYYY-MM-DD
 */
function formatDate(day, month, year) {
    const d = String(day).padStart(2, '0');
    return `${year}-${month}-${d}`;
}

/**
 * Форматирование времени для API
 * @param {number} hour 
 * @param {number} minute 
 * @returns {string} - Время в формате HH:MM:SS
 */
function formatTime(hour, minute) {
    const h = String(hour).padStart(2, '0');
    const m = String(minute).padStart(2, '0');
    return `${h}:${m}:00`;
}

/**
 * Сохранение данных карты в sessionStorage
 * @param {Object} chartData
 */
function saveChartToSession(chartData) {
    sessionStorage.setItem('natalChart', JSON.stringify(chartData));

    // Сохраняем user_id отдельно для быстрого доступа
    if (chartData.user_id) {
        localStorage.setItem('currentUserId', chartData.user_id);
    }
}

/**
 * Получение данных карты из sessionStorage
 * @returns {Object|null}
 */
function getChartFromSession() {
    const data = sessionStorage.getItem('natalChart');
    return data ? JSON.parse(data) : null;
}

/**
 * Сохранение входных данных формы
 * @param {Object} formData 
 */
function saveFormData(formData) {
    sessionStorage.setItem('formData', JSON.stringify(formData));
}

/**
 * Получение входных данных формы
 * @returns {Object|null}
 */
function getFormData() {
    const data = sessionStorage.getItem('formData');
    return data ? JSON.parse(data) : null;
}

/**
 * Скрыть глобальный лоадер страницы
 */
function hidePageLoader() {
    const loader = document.getElementById('pageLoader');
    if (!loader) return;
    loader.classList.add('fade-out');
    setTimeout(() => loader.remove(), 300);
}

/**
 * Показать лоадер (создаёт его, если нет в DOM)
 */
function showPageLoader() {
    if (document.getElementById('pageLoader')) return;
    const loader = document.createElement('div');
    loader.className = 'page-loader';
    loader.id = 'pageLoader';
    loader.innerHTML = '<div class="pl-spinner"></div><div class="pl-text">Загрузка...</div>';
    document.body.prepend(loader);
}

// Автоматически скрываем лоадер когда страница готова
document.addEventListener('DOMContentLoaded', () => {
    // Небольшая задержка чтобы дать JS-рендерингу отработать
    requestAnimationFrame(() => hidePageLoader());
});

// Показываем лоадер при переходе по ссылкам (убирает белый экран)
document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    // Только локальные переходы на .html страницы
    if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript') || link.target === '_blank') return;
    showPageLoader();
});

// Экспорт для использования
window.AstroAPI = {
    calculateNatalChart,
    formatDate,
    formatTime,
    saveChartToSession,
    getChartFromSession,
    saveFormData,
    getFormData
};
window.hidePageLoader = hidePageLoader;

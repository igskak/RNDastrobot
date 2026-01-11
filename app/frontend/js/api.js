/**
 * API модуль для работы с бэкендом AstroBot
 */

const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8000/api/v1'
    : '/api/v1';

/**
 * Расчёт натальной карты
 * @param {Object} birthData - Данные рождения
 * @returns {Promise<Object>} - Результат расчёта
 */
async function calculateNatalChart(birthData) {
    const response = await fetch(`${API_BASE_URL}/natal/calculate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(birthData),
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


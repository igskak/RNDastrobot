/**
 * Логика формы ввода данных рождения
 */

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('birthDataForm');
    const placeInput = document.getElementById('birthPlace');
    const timezoneSelect = document.getElementById('timezone');
    const timezoneHint = document.getElementById('timezoneHint');
    const submitBtn = document.getElementById('submitBtn');
    const errorMessage = document.getElementById('errorMessage');

    // Заполняем список часовых поясов
    Timezones.populate(timezoneSelect);

    // Автоопределение часового пояса и координат при вводе места
    let debounceTimer;
    placeInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const place = e.target.value.trim();
            if (place.length < 2) return;

            // Определяем часовой пояс
            const guessedTz = Timezones.guess(place);
            if (guessedTz) {
                timezoneSelect.value = guessedTz;
                timezoneHint.textContent = '✓ Часовой пояс определён автоматически';
                timezoneHint.style.color = '#22c55e';
            }

            // Пытаемся получить координаты через geocoding
            try {
                const coords = await geocodePlace(place);
                if (coords) {
                    setCoordinatesDMS(coords.lat, coords.lon);
                }
            } catch (err) {
                console.log('Geocoding недоступен:', err);
            }
        }, 500);
    });

    // Обработка отправки формы
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Скрываем ошибку
        errorMessage.classList.add('hidden');

        // Показываем загрузку
        submitBtn.disabled = true;
        submitBtn.querySelector('.btn-text').classList.add('hidden');
        submitBtn.querySelector('.btn-loader').classList.remove('hidden');

        try {
            // Собираем данные
            const day = parseInt(document.getElementById('birthDay').value);
            const month = document.getElementById('birthMonth').value;
            const year = parseInt(document.getElementById('birthYear').value);
            const hour = parseInt(document.getElementById('birthHour').value);
            const minute = parseInt(document.getElementById('birthMinute').value);
            const timezone = timezoneSelect.value;
            const houseSystem = document.getElementById('houseSystem').value;

            // Получаем координаты из DMS полей
            const coords = getCoordinatesFromDMS();

            // Формируем запрос
            const requestData = {
                date: AstroAPI.formatDate(day, month, year),
                time: AstroAPI.formatTime(hour, minute),
                timezone: timezone,
                house_system: houseSystem
            };

            if (coords.lat !== null && coords.lon !== null) {
                requestData.latitude = coords.lat;
                requestData.longitude = coords.lon;
            } else {
                requestData.place = placeInput.value;
            }

            // Сохраняем данные формы
            AstroAPI.saveFormData({
                day, month, year, hour, minute,
                place: placeInput.value,
                timezone, houseSystem,
                latitude: coords.lat,
                longitude: coords.lon
            });

            // Отправляем запрос
            const chartData = await AstroAPI.calculateNatalChart(requestData);
            
            // Сохраняем результат
            AstroAPI.saveChartToSession(chartData);
            
            // Переходим на страницу результата
            window.location.href = 'chart.html';

        } catch (error) {
            console.error('Ошибка:', error);
            errorMessage.textContent = error.message || 'Произошла ошибка при расчёте карты';
            errorMessage.classList.remove('hidden');
        } finally {
            // Убираем загрузку
            submitBtn.disabled = false;
            submitBtn.querySelector('.btn-text').classList.remove('hidden');
            submitBtn.querySelector('.btn-loader').classList.add('hidden');
        }
    });

    // Восстановление данных формы при возврате
    const savedFormData = AstroAPI.getFormData();
    if (savedFormData) {
        document.getElementById('birthDay').value = savedFormData.day || '';
        document.getElementById('birthMonth').value = savedFormData.month || '';
        document.getElementById('birthYear').value = savedFormData.year || '';
        document.getElementById('birthHour').value = savedFormData.hour || '';
        document.getElementById('birthMinute').value = savedFormData.minute || '';
        placeInput.value = savedFormData.place || '';
        timezoneSelect.value = savedFormData.timezone || '';
        document.getElementById('houseSystem').value = savedFormData.houseSystem || 'P';

        if (savedFormData.latitude && savedFormData.longitude) {
            setCoordinatesDMS(savedFormData.latitude, savedFormData.longitude);
        }
    }
});

/**
 * Геокодинг места через Nominatim API
 */
async function geocodePlace(place) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(place)}&limit=1`,
            { headers: { 'Accept-Language': 'ru' } }
        );
        const data = await response.json();
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon)
            };
        }
    } catch (err) {
        console.error('Geocoding error:', err);
    }
    return null;
}

/**
 * Установка координат в DMS формате
 */
function setCoordinatesDMS(lat, lon) {
    const latDMS = decimalToDMS(Math.abs(lat));
    const lonDMS = decimalToDMS(Math.abs(lon));

    document.getElementById('latDeg').value = latDMS.deg;
    document.getElementById('latMin').value = latDMS.min;
    document.getElementById('latSec').value = latDMS.sec.toFixed(2);
    document.getElementById('latDir').value = lat >= 0 ? 'N' : 'S';

    document.getElementById('lonDeg').value = lonDMS.deg;
    document.getElementById('lonMin').value = lonDMS.min;
    document.getElementById('lonSec').value = lonDMS.sec.toFixed(2);
    document.getElementById('lonDir').value = lon >= 0 ? 'E' : 'W';
}

/**
 * Получение координат из DMS полей
 */
function getCoordinatesFromDMS() {
    const latDeg = parseInt(document.getElementById('latDeg').value) || 0;
    const latMin = parseInt(document.getElementById('latMin').value) || 0;
    const latSec = parseFloat(document.getElementById('latSec').value) || 0;
    const latDir = document.getElementById('latDir').value;

    const lonDeg = parseInt(document.getElementById('lonDeg').value) || 0;
    const lonMin = parseInt(document.getElementById('lonMin').value) || 0;
    const lonSec = parseFloat(document.getElementById('lonSec').value) || 0;
    const lonDir = document.getElementById('lonDir').value;

    // Если ничего не заполнено
    if (!latDeg && !latMin && !latSec && !lonDeg && !lonMin && !lonSec) {
        return { lat: null, lon: null };
    }

    let lat = latDeg + latMin / 60 + latSec / 3600;
    let lon = lonDeg + lonMin / 60 + lonSec / 3600;

    if (latDir === 'S') lat = -lat;
    if (lonDir === 'W') lon = -lon;

    return { lat, lon };
}

/**
 * Конвертация десятичных градусов в DMS
 */
function decimalToDMS(decimal) {
    const deg = Math.floor(decimal);
    const minFloat = (decimal - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = (minFloat - min) * 60;
    return { deg, min, sec };
}


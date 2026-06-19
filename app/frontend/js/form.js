/**
 * Логика формы ввода данных рождения
 */

function t(key, params) {
    return window.FrontendI18n?.t?.(key, params) || key;
}

function normalizeHouseSystemCode(value) {
    const raw = String(value || 'P').trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (['P', 'K', 'O', 'R', 'C', 'E', 'W', 'X', 'H', 'T', 'B', 'M'].includes(raw)) {
        return raw;
    }
    if (raw === 'PLACIDUS') return 'P';
    if (raw === 'KOCH') return 'K';
    if (raw === 'PORPHYRY') return 'O';
    if (raw === 'REGIOMONTANUS') return 'R';
    if (raw === 'CAMPANUS') return 'C';
    if (raw === 'EQUAL') return 'E';
    if (raw === 'WHOLE_SIGN' || raw === 'WHOLESIGN') return 'W';
    return 'P';
}

async function waitForI18nReady() {
    if (!window.FrontendI18n?.ready) return;
    await Promise.resolve(window.FrontendI18n.ready).catch(() => {});
}

document.addEventListener('DOMContentLoaded', async () => {
    await waitForI18nReady();

    const form = document.getElementById('birthDataForm');
    const placeInput = document.getElementById('birthPlace');
    const timezoneSelect = document.getElementById('timezone');
    const timezoneHint = document.getElementById('timezoneHint');
    const submitBtn = document.getElementById('submitBtn');
    const errorMessage = document.getElementById('errorMessage');
    const summaryBirthItem = document.getElementById('summaryBirthItem');
    const summaryPlaceItem = document.getElementById('summaryPlaceItem');
    const summaryTimezoneItem = document.getElementById('summaryTimezoneItem');
    const houseSystemSelect = document.getElementById('houseSystem');
    let accountDefaultHouseSystem = 'P';

    let me = await window.AstroAPI?.getCurrentAstrologer?.().catch(() => null);

    async function loadAccountDefaults() {
        if (!window.AstroAPI?.getAccountPreferences) return;
        try {
            const preferences = await window.AstroAPI.getAccountPreferences();
            accountDefaultHouseSystem = normalizeHouseSystemCode(
                preferences?.chart_creation_defaults?.house_system
                || preferences?.default_house_system
                || 'P'
            );
            if (houseSystemSelect && !AstroAPI.getFormData()) {
                houseSystemSelect.value = accountDefaultHouseSystem;
            }
        } catch (error) {
            console.warn('Failed to load account preferences for form defaults:', error);
        }
    }

    if (me) {
        await loadAccountDefaults();
    }

    function hasValue(element) {
        return Boolean(element && String(element.value ?? '').trim());
    }

    function updateFormProgress() {
        const birthComplete = [
            document.getElementById('firstName'),
            document.getElementById('lastName'),
            document.getElementById('birthDay'),
            document.getElementById('birthMonth'),
            document.getElementById('birthYear'),
            document.getElementById('birthHour'),
            document.getElementById('birthMinute'),
        ].every(hasValue);
        const placeComplete = hasValue(placeInput);
        const timezoneComplete = hasValue(timezoneSelect);

        summaryBirthItem?.classList.toggle('is-complete', birthComplete);
        summaryPlaceItem?.classList.toggle('is-complete', placeComplete);
        summaryTimezoneItem?.classList.toggle('is-complete', timezoneComplete);
    }

    // Заполняем список часовых поясов
    Timezones.populate(timezoneSelect);
    document.addEventListener('frontend:locale-changed', () => {
        const selectedTimezone = timezoneSelect.value;
        Timezones.populate(timezoneSelect);
        if (selectedTimezone) {
            timezoneSelect.value = selectedTimezone;
        }
        updateFormProgress();
    });

    const placeSuggestions = document.getElementById('birthPlaceSuggestions');
    let placeAutocompleteBound = false;
    function bindPlaceAutocomplete() {
        if (placeAutocompleteBound || !window.PlaceAutocomplete || !placeInput || !placeSuggestions) return;
        placeAutocompleteBound = true;
        PlaceAutocomplete.attach({
            input: placeInput,
            suggestions: placeSuggestions,
            minChars: 2,
            debounceMs: 350,
            limit: 5,
            getLabel: (item) => item.shortName || item.displayName,
            onInput: (place) => {
                const guessedTz = Timezones.guess(place);
                if (guessedTz) {
                    timezoneSelect.value = guessedTz;
                    timezoneHint.textContent = t('page.index.form.timezone.autoDetected');
                    timezoneHint.style.color = '#22c55e';
                }
                updateFormProgress();
            },
            onSelect: async (item) => {
                if (Number.isFinite(item.lat) && Number.isFinite(item.lon)) {
                    setCoordinatesDMS(item.lat, item.lon);
                }
                let resolvedTz = null;
                if (item.sourceId && window.AstroAPI?.resolvePlaceTimezone) {
                    try {
                        resolvedTz = await window.AstroAPI.resolvePlaceTimezone(item.sourceId);
                    } catch (_error) {
                        resolvedTz = null;
                    }
                }
                if (!resolvedTz) {
                    resolvedTz = Timezones.guess(item.displayName || item.shortName);
                }
                if (resolvedTz) {
                    timezoneSelect.value = resolvedTz;
                    timezoneHint.textContent = t('page.index.form.timezone.autoDetected');
                    timezoneHint.style.color = '#22c55e';
                }
                updateFormProgress();
            }
        });
    }
    placeInput?.addEventListener('focus', bindPlaceAutocomplete, { once: true });
    form?.addEventListener('input', updateFormProgress);
    form?.addEventListener('change', updateFormProgress);

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
            if (!me) {
                me = await window.AstroAPI?.requireAuth?.({ redirectTo: '/login.html' });
                if (!me) return;
                await loadAccountDefaults();
            }

            // Собираем данные
            const firstName = document.getElementById('firstName').value.trim();
            const lastName = document.getElementById('lastName').value.trim();
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
                first_name: firstName,
                last_name: lastName,
                date: AstroAPI.formatDate(day, month, year),
                time: AstroAPI.formatTime(hour, minute),
                timezone: timezone,
                house_system: houseSystem
            };

            // Всегда передаём place (название города)
            if (placeInput.value.trim()) {
                requestData.place = placeInput.value.trim();
            }

            if (coords.lat !== null && coords.lon !== null) {
                requestData.latitude = coords.lat;
                requestData.longitude = coords.lon;
            }

            // Сохраняем данные формы
            AstroAPI.saveFormData({
                firstName, lastName,
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
            window.showPageLoader?.();
            window.location.href = 'forecast-new.html';

        } catch (error) {
            console.error('Ошибка:', error);
            errorMessage.textContent = error.message || t('page.index.errors.calculateFailed');
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
        document.getElementById('firstName').value = savedFormData.firstName || '';
        document.getElementById('lastName').value = savedFormData.lastName || '';
        document.getElementById('birthDay').value = savedFormData.day || '';
        document.getElementById('birthMonth').value = savedFormData.month || '';
        document.getElementById('birthYear').value = savedFormData.year || '';
        document.getElementById('birthHour').value = savedFormData.hour || '';
        document.getElementById('birthMinute').value = savedFormData.minute || '';
        placeInput.value = savedFormData.place || '';
        timezoneSelect.value = savedFormData.timezone || '';
        houseSystemSelect.value = normalizeHouseSystemCode(savedFormData.houseSystem || accountDefaultHouseSystem);

        if (savedFormData.latitude && savedFormData.longitude) {
            setCoordinatesDMS(savedFormData.latitude, savedFormData.longitude);
        }
    } else if (houseSystemSelect) {
        houseSystemSelect.value = accountDefaultHouseSystem;
    }

    updateFormProgress();
});

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

/**
 * Список часовых поясов с автоматическим определением по месту
 */

const TIMEZONES = [
    // Европа
    { value: 'Europe/Kyiv', label: 'Киев (UTC+2/+3)', country: 'UA' },
    { value: 'Europe/Moscow', label: 'Москва (UTC+3)', country: 'RU' },
    { value: 'Europe/London', label: 'Лондон (UTC+0/+1)', country: 'GB' },
    { value: 'Europe/Paris', label: 'Париж (UTC+1/+2)', country: 'FR' },
    { value: 'Europe/Berlin', label: 'Берлин (UTC+1/+2)', country: 'DE' },
    { value: 'Europe/Rome', label: 'Рим (UTC+1/+2)', country: 'IT' },
    { value: 'Europe/Madrid', label: 'Мадрид (UTC+1/+2)', country: 'ES' },
    { value: 'Europe/Warsaw', label: 'Варшава (UTC+1/+2)', country: 'PL' },
    { value: 'Europe/Prague', label: 'Прага (UTC+1/+2)', country: 'CZ' },
    { value: 'Europe/Vienna', label: 'Вена (UTC+1/+2)', country: 'AT' },
    { value: 'Europe/Athens', label: 'Афины (UTC+2/+3)', country: 'GR' },
    { value: 'Europe/Istanbul', label: 'Стамбул (UTC+3)', country: 'TR' },
    { value: 'Europe/Helsinki', label: 'Хельсинки (UTC+2/+3)', country: 'FI' },
    { value: 'Europe/Stockholm', label: 'Стокгольм (UTC+1/+2)', country: 'SE' },
    { value: 'Europe/Amsterdam', label: 'Амстердам (UTC+1/+2)', country: 'NL' },
    { value: 'Europe/Brussels', label: 'Брюссель (UTC+1/+2)', country: 'BE' },
    { value: 'Europe/Lisbon', label: 'Лиссабон (UTC+0/+1)', country: 'PT' },
    { value: 'Europe/Bucharest', label: 'Бухарест (UTC+2/+3)', country: 'RO' },
    { value: 'Europe/Sofia', label: 'София (UTC+2/+3)', country: 'BG' },
    { value: 'Europe/Budapest', label: 'Будапешт (UTC+1/+2)', country: 'HU' },
    { value: 'Europe/Belgrade', label: 'Белград (UTC+1/+2)', country: 'RS' },
    { value: 'Europe/Riga', label: 'Рига (UTC+2/+3)', country: 'LV' },
    { value: 'Europe/Vilnius', label: 'Вильнюс (UTC+2/+3)', country: 'LT' },
    { value: 'Europe/Tallinn', label: 'Таллин (UTC+2/+3)', country: 'EE' },
    { value: 'Europe/Minsk', label: 'Минск (UTC+3)', country: 'BY' },
    { value: 'Europe/Chisinau', label: 'Кишинёв (UTC+2/+3)', country: 'MD' },

    // Россия
    { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)', country: 'RU' },
    { value: 'Europe/Samara', label: 'Самара (UTC+4)', country: 'RU' },
    { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)', country: 'RU' },
    { value: 'Asia/Novosibirsk', label: 'Новосибирск (UTC+7)', country: 'RU' },
    { value: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)', country: 'RU' },
    { value: 'Asia/Irkutsk', label: 'Иркутск (UTC+8)', country: 'RU' },
    { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)', country: 'RU' },

    // СНГ
    { value: 'Asia/Almaty', label: 'Алматы (UTC+6)', country: 'KZ' },
    { value: 'Asia/Tashkent', label: 'Ташкент (UTC+5)', country: 'UZ' },
    { value: 'Asia/Baku', label: 'Баку (UTC+4)', country: 'AZ' },
    { value: 'Asia/Tbilisi', label: 'Тбилиси (UTC+4)', country: 'GE' },
    { value: 'Asia/Yerevan', label: 'Ереван (UTC+4)', country: 'AM' },
    { value: 'Asia/Bishkek', label: 'Бишкек (UTC+6)', country: 'KG' },
    { value: 'Asia/Dushanbe', label: 'Душанбе (UTC+5)', country: 'TJ' },
    { value: 'Asia/Ashgabat', label: 'Ашхабад (UTC+5)', country: 'TM' },

    // Азия
    { value: 'Asia/Dubai', label: 'Дубай (UTC+4)', country: 'AE' },
    { value: 'Asia/Jerusalem', label: 'Иерусалим (UTC+2/+3)', country: 'IL' },
    { value: 'Asia/Tehran', label: 'Тегеран (UTC+3:30)', country: 'IR' },
    { value: 'Asia/Kolkata', label: 'Дели (UTC+5:30)', country: 'IN' },
    { value: 'Asia/Bangkok', label: 'Бангкок (UTC+7)', country: 'TH' },
    { value: 'Asia/Singapore', label: 'Сингапур (UTC+8)', country: 'SG' },
    { value: 'Asia/Hong_Kong', label: 'Гонконг (UTC+8)', country: 'HK' },
    { value: 'Asia/Shanghai', label: 'Пекин (UTC+8)', country: 'CN' },
    { value: 'Asia/Tokyo', label: 'Токио (UTC+9)', country: 'JP' },
    { value: 'Asia/Seoul', label: 'Сеул (UTC+9)', country: 'KR' },

    // Америка
    { value: 'America/New_York', label: 'Нью-Йорк (UTC-5/-4)', country: 'US' },
    { value: 'America/Chicago', label: 'Чикаго (UTC-6/-5)', country: 'US' },
    { value: 'America/Denver', label: 'Денвер (UTC-7/-6)', country: 'US' },
    { value: 'America/Los_Angeles', label: 'Лос-Анджелес (UTC-8/-7)', country: 'US' },
    { value: 'America/Toronto', label: 'Торонто (UTC-5/-4)', country: 'CA' },
    { value: 'America/Vancouver', label: 'Ванкувер (UTC-8/-7)', country: 'CA' },
    { value: 'America/Mexico_City', label: 'Мехико (UTC-6/-5)', country: 'MX' },
    { value: 'America/Sao_Paulo', label: 'Сан-Паулу (UTC-3)', country: 'BR' },
    { value: 'America/Buenos_Aires', label: 'Буэнос-Айрес (UTC-3)', country: 'AR' },

    // Океания
    { value: 'Australia/Sydney', label: 'Сидней (UTC+10/+11)', country: 'AU' },
    { value: 'Australia/Melbourne', label: 'Мельбурн (UTC+10/+11)', country: 'AU' },
    { value: 'Australia/Perth', label: 'Перт (UTC+8)', country: 'AU' },
    { value: 'Pacific/Auckland', label: 'Окленд (UTC+12/+13)', country: 'NZ' },

    // Африка
    { value: 'Africa/Cairo', label: 'Каир (UTC+2)', country: 'EG' },
    { value: 'Africa/Johannesburg', label: 'Йоханнесбург (UTC+2)', country: 'ZA' },
    { value: 'Africa/Lagos', label: 'Лагос (UTC+1)', country: 'NG' },

    // UTC
    { value: 'UTC', label: 'UTC (Всемирное время)', country: '' },
];

/**
 * Заполнение select с часовыми поясами
 * @param {HTMLSelectElement} selectElement 
 */
function populateTimezones(selectElement) {
    TIMEZONES.forEach(tz => {
        const option = document.createElement('option');
        option.value = tz.value;
        option.textContent = tz.label;
        selectElement.appendChild(option);
    });
}

/**
 * Попытка определить часовой пояс по названию места
 * @param {string} placeName 
 * @returns {string|null}
 */
function guessTimezone(placeName) {
    const place = placeName.toLowerCase();
    
    // Украина
    if (place.includes('київ') || place.includes('киев') || place.includes('kyiv') || place.includes('kiev')) return 'Europe/Kyiv';
    if (place.includes('україн') || place.includes('украин') || place.includes('ukrain')) return 'Europe/Kyiv';
    if (place.includes('одес') || place.includes('харків') || place.includes('харьков') || place.includes('львів') || place.includes('львов')) return 'Europe/Kyiv';
    if (place.includes('днепр') || place.includes('дніпро') || place.includes('запоріж') || place.includes('запорож')) return 'Europe/Kyiv';
    
    // Россия
    if (place.includes('москв') || place.includes('moscow')) return 'Europe/Moscow';
    if (place.includes('петербург') || place.includes('petersburg') || place.includes('питер')) return 'Europe/Moscow';
    if (place.includes('россия') || place.includes('russia')) return 'Europe/Moscow';
    
    // Беларусь
    if (place.includes('минск') || place.includes('беларус') || place.includes('belarus')) return 'Europe/Minsk';
    
    // Европа
    if (place.includes('london') || place.includes('лондон')) return 'Europe/London';
    if (place.includes('paris') || place.includes('париж')) return 'Europe/Paris';
    if (place.includes('berlin') || place.includes('берлин')) return 'Europe/Berlin';
    if (place.includes('варшав') || place.includes('warsaw') || place.includes('польш') || place.includes('poland')) return 'Europe/Warsaw';
    
    // США
    if (place.includes('new york') || place.includes('нью-йорк') || place.includes('нью йорк')) return 'America/New_York';
    if (place.includes('los angeles') || place.includes('лос-анджелес')) return 'America/Los_Angeles';
    
    return null;
}

window.Timezones = {
    list: TIMEZONES,
    populate: populateTimezones,
    guess: guessTimezone
};


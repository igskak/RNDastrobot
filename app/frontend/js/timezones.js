/**
 * Timezone list and UI helpers.
 */

const TIMEZONES = [
    { value: 'Europe/Kyiv', cityId: 'kyiv', offset: 'UTC+2/+3', country: 'UA' },
    { value: 'Europe/Moscow', cityId: 'moscow', offset: 'UTC+3', country: 'RU' },
    { value: 'Europe/London', cityId: 'london', offset: 'UTC+0/+1', country: 'GB' },
    { value: 'Europe/Paris', cityId: 'paris', offset: 'UTC+1/+2', country: 'FR' },
    { value: 'Europe/Berlin', cityId: 'berlin', offset: 'UTC+1/+2', country: 'DE' },
    { value: 'Europe/Rome', cityId: 'rome', offset: 'UTC+1/+2', country: 'IT' },
    { value: 'Europe/Madrid', cityId: 'madrid', offset: 'UTC+1/+2', country: 'ES' },
    { value: 'Europe/Warsaw', cityId: 'warsaw', offset: 'UTC+1/+2', country: 'PL' },
    { value: 'Europe/Prague', cityId: 'prague', offset: 'UTC+1/+2', country: 'CZ' },
    { value: 'Europe/Vienna', cityId: 'vienna', offset: 'UTC+1/+2', country: 'AT' },
    { value: 'Europe/Athens', cityId: 'athens', offset: 'UTC+2/+3', country: 'GR' },
    { value: 'Europe/Istanbul', cityId: 'istanbul', offset: 'UTC+3', country: 'TR' },
    { value: 'Europe/Helsinki', cityId: 'helsinki', offset: 'UTC+2/+3', country: 'FI' },
    { value: 'Europe/Stockholm', cityId: 'stockholm', offset: 'UTC+1/+2', country: 'SE' },
    { value: 'Europe/Amsterdam', cityId: 'amsterdam', offset: 'UTC+1/+2', country: 'NL' },
    { value: 'Europe/Brussels', cityId: 'brussels', offset: 'UTC+1/+2', country: 'BE' },
    { value: 'Europe/Lisbon', cityId: 'lisbon', offset: 'UTC+0/+1', country: 'PT' },
    { value: 'Europe/Bucharest', cityId: 'bucharest', offset: 'UTC+2/+3', country: 'RO' },
    { value: 'Europe/Sofia', cityId: 'sofia', offset: 'UTC+2/+3', country: 'BG' },
    { value: 'Europe/Budapest', cityId: 'budapest', offset: 'UTC+1/+2', country: 'HU' },
    { value: 'Europe/Belgrade', cityId: 'belgrade', offset: 'UTC+1/+2', country: 'RS' },
    { value: 'Europe/Riga', cityId: 'riga', offset: 'UTC+2/+3', country: 'LV' },
    { value: 'Europe/Vilnius', cityId: 'vilnius', offset: 'UTC+2/+3', country: 'LT' },
    { value: 'Europe/Tallinn', cityId: 'tallinn', offset: 'UTC+2/+3', country: 'EE' },
    { value: 'Europe/Minsk', cityId: 'minsk', offset: 'UTC+3', country: 'BY' },
    { value: 'Europe/Chisinau', cityId: 'chisinau', offset: 'UTC+2/+3', country: 'MD' },

    { value: 'Europe/Kaliningrad', cityId: 'kaliningrad', offset: 'UTC+2', country: 'RU' },
    { value: 'Europe/Samara', cityId: 'samara', offset: 'UTC+4', country: 'RU' },
    { value: 'Asia/Yekaterinburg', cityId: 'yekaterinburg', offset: 'UTC+5', country: 'RU' },
    { value: 'Asia/Novosibirsk', cityId: 'novosibirsk', offset: 'UTC+7', country: 'RU' },
    { value: 'Asia/Krasnoyarsk', cityId: 'krasnoyarsk', offset: 'UTC+7', country: 'RU' },
    { value: 'Asia/Irkutsk', cityId: 'irkutsk', offset: 'UTC+8', country: 'RU' },
    { value: 'Asia/Vladivostok', cityId: 'vladivostok', offset: 'UTC+10', country: 'RU' },

    { value: 'Asia/Almaty', cityId: 'almaty', offset: 'UTC+6', country: 'KZ' },
    { value: 'Asia/Tashkent', cityId: 'tashkent', offset: 'UTC+5', country: 'UZ' },
    { value: 'Asia/Baku', cityId: 'baku', offset: 'UTC+4', country: 'AZ' },
    { value: 'Asia/Tbilisi', cityId: 'tbilisi', offset: 'UTC+4', country: 'GE' },
    { value: 'Asia/Yerevan', cityId: 'yerevan', offset: 'UTC+4', country: 'AM' },
    { value: 'Asia/Bishkek', cityId: 'bishkek', offset: 'UTC+6', country: 'KG' },
    { value: 'Asia/Dushanbe', cityId: 'dushanbe', offset: 'UTC+5', country: 'TJ' },
    { value: 'Asia/Ashgabat', cityId: 'ashgabat', offset: 'UTC+5', country: 'TM' },

    { value: 'Asia/Dubai', cityId: 'dubai', offset: 'UTC+4', country: 'AE' },
    { value: 'Asia/Jerusalem', cityId: 'jerusalem', offset: 'UTC+2/+3', country: 'IL' },
    { value: 'Asia/Tehran', cityId: 'tehran', offset: 'UTC+3:30', country: 'IR' },
    { value: 'Asia/Kolkata', cityId: 'kolkata', offset: 'UTC+5:30', country: 'IN' },
    { value: 'Asia/Bangkok', cityId: 'bangkok', offset: 'UTC+7', country: 'TH' },
    { value: 'Asia/Singapore', cityId: 'singapore', offset: 'UTC+8', country: 'SG' },
    { value: 'Asia/Hong_Kong', cityId: 'hong_kong', offset: 'UTC+8', country: 'HK' },
    { value: 'Asia/Shanghai', cityId: 'beijing', offset: 'UTC+8', country: 'CN' },
    { value: 'Asia/Tokyo', cityId: 'tokyo', offset: 'UTC+9', country: 'JP' },
    { value: 'Asia/Seoul', cityId: 'seoul', offset: 'UTC+9', country: 'KR' },

    { value: 'America/New_York', cityId: 'new_york', offset: 'UTC-5/-4', country: 'US' },
    { value: 'America/Chicago', cityId: 'chicago', offset: 'UTC-6/-5', country: 'US' },
    { value: 'America/Denver', cityId: 'denver', offset: 'UTC-7/-6', country: 'US' },
    { value: 'America/Los_Angeles', cityId: 'los_angeles', offset: 'UTC-8/-7', country: 'US' },
    { value: 'America/Toronto', cityId: 'toronto', offset: 'UTC-5/-4', country: 'CA' },
    { value: 'America/Vancouver', cityId: 'vancouver', offset: 'UTC-8/-7', country: 'CA' },
    { value: 'America/Mexico_City', cityId: 'mexico_city', offset: 'UTC-6/-5', country: 'MX' },
    { value: 'America/Sao_Paulo', cityId: 'sao_paulo', offset: 'UTC-3', country: 'BR' },
    { value: 'America/Buenos_Aires', cityId: 'buenos_aires', offset: 'UTC-3', country: 'AR' },

    { value: 'Australia/Sydney', cityId: 'sydney', offset: 'UTC+10/+11', country: 'AU' },
    { value: 'Australia/Melbourne', cityId: 'melbourne', offset: 'UTC+10/+11', country: 'AU' },
    { value: 'Australia/Perth', cityId: 'perth', offset: 'UTC+8', country: 'AU' },
    { value: 'Pacific/Auckland', cityId: 'auckland', offset: 'UTC+12/+13', country: 'NZ' },

    { value: 'Africa/Cairo', cityId: 'cairo', offset: 'UTC+2', country: 'EG' },
    { value: 'Africa/Johannesburg', cityId: 'johannesburg', offset: 'UTC+2', country: 'ZA' },
    { value: 'Africa/Lagos', cityId: 'lagos', offset: 'UTC+1', country: 'NG' },

    { value: 'UTC', cityId: 'utc', offset: 'UTC', country: '' },
];

function t(key, params) {
    return globalThis.window?.FrontendI18n?.t?.(key, params) || key;
}

function titleCase(raw) {
    return raw
        .split(/[_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function fallbackCityName(timezone) {
    if (timezone.cityId) return titleCase(timezone.cityId);
    const lastSegment = timezone.value?.split('/').pop() || timezone.value || '';
    return titleCase(lastSegment);
}

function getTimezoneCityLabel(timezone) {
    const key = `timezones.city.${timezone.cityId}`;
    const translated = t(key);
    return translated === key ? fallbackCityName(timezone) : translated;
}

function formatTimezoneLabel(timezone) {
    if (timezone.value === 'UTC') {
        const utcLabel = t('timezones.label.utc');
        if (utcLabel !== 'timezones.label.utc') return utcLabel;
    }

    const city = getTimezoneCityLabel(timezone);
    const label = t('timezones.label.cityWithOffset', {
        city,
        offset: timezone.offset,
    });

    if (label !== 'timezones.label.cityWithOffset') return label;
    return `${city} (${timezone.offset})`;
}

function clearTimezoneOptions(selectElement) {
    Array.from(selectElement.options)
        .filter((option) => option.value !== '')
        .forEach((option) => option.remove());
}

function populateTimezones(selectElement) {
    if (!selectElement) return;

    const currentValue = selectElement.value;
    clearTimezoneOptions(selectElement);

    TIMEZONES.forEach((timezone) => {
        const option = document.createElement('option');
        option.value = timezone.value;
        option.textContent = formatTimezoneLabel(timezone);
        selectElement.appendChild(option);
    });

    if (currentValue) {
        selectElement.value = currentValue;
    }
}

function guessTimezone(placeName) {
    const place = placeName.toLowerCase();

    if (place.includes('київ') || place.includes('киев') || place.includes('kyiv') || place.includes('kiev')) return 'Europe/Kyiv';
    if (place.includes('україн') || place.includes('украин') || place.includes('ukrain')) return 'Europe/Kyiv';
    if (place.includes('одес') || place.includes('харків') || place.includes('харьков') || place.includes('львів') || place.includes('львов')) return 'Europe/Kyiv';
    if (place.includes('днепр') || place.includes('дніпро') || place.includes('запоріж') || place.includes('запорож')) return 'Europe/Kyiv';

    if (place.includes('москв') || place.includes('moscow')) return 'Europe/Moscow';
    if (place.includes('петербург') || place.includes('petersburg') || place.includes('питер')) return 'Europe/Moscow';
    if (place.includes('россия') || place.includes('russia')) return 'Europe/Moscow';

    if (place.includes('минск') || place.includes('беларус') || place.includes('belarus')) return 'Europe/Minsk';

    if (place.includes('london') || place.includes('лондон')) return 'Europe/London';
    if (place.includes('paris') || place.includes('париж')) return 'Europe/Paris';
    if (place.includes('berlin') || place.includes('берлин')) return 'Europe/Berlin';
    if (place.includes('варшав') || place.includes('warsaw') || place.includes('польш') || place.includes('poland')) return 'Europe/Warsaw';

    if (place.includes('new york') || place.includes('нью-йорк') || place.includes('нью йорк')) return 'America/New_York';
    if (place.includes('los angeles') || place.includes('лос-анджелес')) return 'America/Los_Angeles';

    return null;
}

window.Timezones = {
    list: TIMEZONES,
    populate: populateTimezones,
    guess: guessTimezone,
    formatLabel: formatTimezoneLabel,
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TIMEZONES,
        populateTimezones,
        guessTimezone,
        formatTimezoneLabel,
    };
}

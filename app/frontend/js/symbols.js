/**
 * Астрологические символы и иконки
 */

const BODY_NAME_ALIASES = {
    'TrueNorthNode': 'TrueNode',
    'TrueSouthNode': 'SouthNode',
    'Fortune': 'PartOfFortune'
};

const PLANET_SYMBOLS = {
    'Sun': '☉',
    'Moon': '☽',
    'Mercury': '☿',
    'Venus': '♀',
    'Mars': '♂',
    'Jupiter': '♃',
    'Saturn': '♄',
    'Uranus': '♅',
    'Neptune': '♆',
    'Pluto': '♇',
    'Chiron': '⚷',
    'Proserpina': ']·[',
    'TrueNode': '☊',
    'TrueNorthNode': '☊',
    'TrueSouthNode': '☋',
    'MeanNode': '☊',
    'SouthNode': '☋',
    'BlackMoon': '⚸',
    'WhiteMoon': '⚳',
    'PartOfFortune': '⊗',
    'Fortune': '⊗',
    'Vertex': 'Vx',
    'AntiVertex': 'AVx',
    'ASC': 'AC',
    'MC': 'MC',
    'IC': 'IC',
    'DSC': 'DC'
};

const SIGN_SYMBOLS = {
    'Aries': '♈',
    'Taurus': '♉',
    'Gemini': '♊',
    'Cancer': '♋',
    'Leo': '♌',
    'Virgo': '♍',
    'Libra': '♎',
    'Scorpio': '♏',
    'Sagittarius': '♐',
    'Capricorn': '♑',
    'Aquarius': '♒',
    'Pisces': '♓'
};

const SIGN_NAMES_RU = {
    'Aries': 'Овен',
    'Taurus': 'Телец',
    'Gemini': 'Близнецы',
    'Cancer': 'Рак',
    'Leo': 'Лев',
    'Virgo': 'Дева',
    'Libra': 'Весы',
    'Scorpio': 'Скорпион',
    'Sagittarius': 'Стрелец',
    'Capricorn': 'Козерог',
    'Aquarius': 'Водолей',
    'Pisces': 'Рыбы'
};

const PLANET_NAMES_RU = {
    'Sun': 'Солнце',
    'Moon': 'Луна',
    'Mercury': 'Меркурий',
    'Venus': 'Венера',
    'Mars': 'Марс',
    'Jupiter': 'Юпитер',
    'Saturn': 'Сатурн',
    'Uranus': 'Уран',
    'Neptune': 'Нептун',
    'Pluto': 'Плутон',
    'Chiron': 'Хирон',
    'Proserpina': 'Прозерпина',
    'TrueNode': 'Сев. Узел',
    'TrueNorthNode': 'Сев. Узел (истинный)',
    'TrueSouthNode': 'Юж. Узел (истинный)',
    'MeanNode': 'Ср. Узел',
    'SouthNode': 'Юж. Узел',
    'BlackMoon': 'Лилит',
    'WhiteMoon': 'Селена',
    'PartOfFortune': 'Фортуна',
    'Fortune': 'Фортуна',
    'Vertex': 'Вертекс',
    'AntiVertex': 'Анти-Вертекс',
    'ASC': 'Асцендент',
    'MC': 'MC',
    'IC': 'IC',
    'DSC': 'Десцендент'
};

const MAJOR_ASPECT_SYMBOLS = {
    'Conjunction': '☌',
    'Opposition': '☍',
    'Trine': '△',
    'Square': '□',
    'Sextile': '⚹'
};

const ASPECT_ANGLES = {
    'Conjunction': 0,
    'Vigintile': 18,
    'Semi_Nonagon': 20,
    'Semisextile': 30,
    'Decile': 36,
    'Nonagon': 40,
    'Novile': 40,
    'Semisquare': 45,
    'Septile': 51,
    'Sextile': 60,
    'Quintile': 72,
    'Binonagon': 80,
    'Square': 90,
    'Sentagon': 100,
    'Tridecile': 108,
    'Trine': 120,
    'Sesquiquadrate': 135,
    'Biquintile': 144,
    'Quincunx': 150,
    'Opposition': 180
};

function isMajorAspect(aspectType) {
    return Object.prototype.hasOwnProperty.call(MAJOR_ASPECT_SYMBOLS, aspectType);
}

function getAspectDisplay(aspectType) {
    if (MAJOR_ASPECT_SYMBOLS[aspectType]) {
        return MAJOR_ASPECT_SYMBOLS[aspectType];
    }
    if (Number.isFinite(ASPECT_ANGLES[aspectType])) {
        return String(ASPECT_ANGLES[aspectType]);
    }
    return String(aspectType || '').slice(0, 3) || '•';
}

const ASPECT_SYMBOLS = Object.freeze(
    Object.keys(ASPECT_ANGLES).reduce((acc, aspectType) => {
        acc[aspectType] = getAspectDisplay(aspectType);
        return acc;
    }, {})
);

const ASPECT_NAMES_RU = {
    'Conjunction': 'Соединение',
    'Opposition': 'Оппозиция',
    'Trine': 'Трин',
    'Square': 'Квадрат',
    'Sextile': 'Секстиль',
    'Quincunx': 'Квиконс',
    'Semisextile': 'Полусекстиль',
    'Quintile': 'Квинтиль',
    'Biquintile': 'Биквинтиль',
    'Semisquare': 'Полуквадрат',
    'Sesquiquadrate': 'Полутораквадрат',
    'Vigintile': 'Вигинтиль',
    'Semi_Nonagon': 'Полунонагон',
    'Decile': 'Дециль',
    'Nonagon': 'Нонагон',
    'Binonagon': 'Бинонагон',
    'Sentagon': 'Сентагон',
    'Tridecile': 'Тридециль',
    'Septile': 'Септиль',
    'Novile': 'Новиль'
};

const ELEMENT_COLORS = {
    'Fire': '#ef4444',
    'Earth': '#84cc16',
    'Air': '#06b6d4',
    'Water': '#3b82f6'
};

const SIGN_ELEMENTS = {
    'Aries': 'Fire', 'Leo': 'Fire', 'Sagittarius': 'Fire',
    'Taurus': 'Earth', 'Virgo': 'Earth', 'Capricorn': 'Earth',
    'Gemini': 'Air', 'Libra': 'Air', 'Aquarius': 'Air',
    'Cancer': 'Water', 'Scorpio': 'Water', 'Pisces': 'Water'
};

const CONFIG_ICONS = {
    'T_Square': '🔺',
    'Grand_Trine': '🔷',
    'Grand_Cross': '✚',
    'Yod': '🔻',
    'Mystic_Rectangle': '▭',
    'Kite': '🪁',
    'Star_of_David': '✡',
    'Stellium': '⭐'
};

const PLANET_GLYPH_SCALE = {
    'Sun': 1.16,
    'Mercury': 1.18,
    'Uranus': 1.08
};

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeBodyName(name) {
    const rawName = String(name || '').trim();
    return BODY_NAME_ALIASES[rawName] || rawName;
}

function getPlanetSymbol(name) {
    const rawName = String(name || '').trim();
    return PLANET_SYMBOLS[rawName] || PLANET_SYMBOLS[normalizeBodyName(rawName)] || '';
}

function getPlanetNameRu(name) {
    const rawName = String(name || '').trim();
    return PLANET_NAMES_RU[rawName] || PLANET_NAMES_RU[normalizeBodyName(rawName)] || rawName;
}

function getPlanetSymbolMarkup(name, options = {}) {
    const rawName = String(name || '').trim();
    const normalizedName = normalizeBodyName(rawName);
    const symbol = getPlanetSymbol(rawName) || rawName.slice(0, 2) || '•';
    const title = options.title || getPlanetNameRu(rawName);
    const size = Number.isFinite(Number(options.size)) ? Number(options.size) : 18;
    const wrapperClass = ['planet-icon-svg', options.wrapperClass].filter(Boolean).join(' ');

    if (window.AstroGlyphs?.hasPlanetIcon?.(normalizedName)) {
        const svgMarkup = window.AstroGlyphs.createPlanetSymbolMarkup(normalizedName, {
            size,
            color: options.color,
            title,
            className: options.className,
        });
        return `<span class="${escapeHtml(wrapperClass)}">${svgMarkup}</span>`;
    }

    const textClass = ['astro-symbol', options.textClass].filter(Boolean).join(' ');
    return `<span class="${escapeHtml(wrapperClass)}"><span class="${escapeHtml(textClass)}" aria-hidden="true">${escapeHtml(symbol)}</span></span>`;
}

window.Symbols = {
    bodyNameAliases: BODY_NAME_ALIASES,
    normalizeBodyName,
    getPlanetSymbol,
    getPlanetNameRu,
    getPlanetSymbolMarkup,
    planets: PLANET_SYMBOLS,
    signs: SIGN_SYMBOLS,
    signNamesRu: SIGN_NAMES_RU,
    planetNamesRu: PLANET_NAMES_RU,
    aspects: ASPECT_SYMBOLS,
    aspectAngles: ASPECT_ANGLES,
    aspectNamesRu: ASPECT_NAMES_RU,
    getAspectDisplay,
    isMajorAspect,
    elementColors: ELEMENT_COLORS,
    signElements: SIGN_ELEMENTS,
    configIcons: CONFIG_ICONS,
    planetGlyphScale: PLANET_GLYPH_SCALE
};

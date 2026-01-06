/**
 * Астрологические символы и иконки
 */

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
    'Proserpina': '⯓',
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

const ASPECT_SYMBOLS = {
    'Conjunction': '☌',
    'Opposition': '☍',
    'Trine': '△',
    'Square': '□',
    'Sextile': '⚹',
    'Quincunx': '⚻',
    'Semisextile': '⚺',
    'Quintile': 'Q',
    'Biquintile': 'bQ',
    'Semisquare': '∠'
};

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
    'Semisquare': 'Полуквадрат'
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

window.Symbols = {
    planets: PLANET_SYMBOLS,
    signs: SIGN_SYMBOLS,
    signNamesRu: SIGN_NAMES_RU,
    planetNamesRu: PLANET_NAMES_RU,
    aspects: ASPECT_SYMBOLS,
    aspectNamesRu: ASPECT_NAMES_RU,
    elementColors: ELEMENT_COLORS,
    signElements: SIGN_ELEMENTS,
    configIcons: CONFIG_ICONS
};


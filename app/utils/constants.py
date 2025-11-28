"""
Астрологические константы и справочные данные
"""

# Знаки зодиака
ZODIAC_SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
]

ZODIAC_SIGNS_RU = [
    "Овен", "Телец", "Близнецы", "Рак", "Лев", "Дева",
    "Весы", "Скорпион", "Стрелец", "Козерог", "Водолей", "Рыбы"
]

# Планеты
PLANETS = {
    0: "Sun",
    1: "Moon",
    2: "Mercury",
    3: "Venus",
    4: "Mars",
    5: "Jupiter",
    6: "Saturn",
    7: "Uranus",
    8: "Neptune",
    9: "Pluto",
}

PLANETS_RU = {
    0: "Солнце",
    1: "Луна",
    2: "Меркурий",
    3: "Венера",
    4: "Марс",
    5: "Юпитер",
    6: "Сатурн",
    7: "Уран",
    8: "Нептун",
    9: "Плутон",
}

# Специальные точки
SPECIAL_POINTS = {
    'TrueNorthNode': 'Северный узел (истинный)',
    'TrueSouthNode': 'Южный узел (истинный)',
    'BlackMoon': 'Чёрная Луна (Лилит)',
    'WhiteMoon': 'Белая Луна (Селена)',
    'Fortune': 'Колесо Фортуны',
    'Vertex': 'Вертекс',
    'AntiVertex': 'Анти-Вертекс',
    'Chiron': 'Хирон',
}

# Системы домов
HOUSE_SYSTEMS = {
    'P': 'Placidus',
    'K': 'Koch',
    'O': 'Porphyrius',
    'R': 'Regiomontanus',
    'C': 'Campanus',
    'E': 'Equal (from Asc)',
    'W': 'Whole Sign',
    'X': 'Axial rotation system',
    'H': 'Azimuthal or horizontal system',
    'T': 'Polich/Page ("topocentric" system)',
    'B': 'Alcabitus',
    'M': 'Morinus',
}

# Углы (Angles)
ANGLES = {
    0: 'ASC',   # Асцендент
    1: 'MC',    # Середина Неба
    2: 'ARMC',  # Прямое восхождение MC
    3: 'Vertex',
}


def get_zodiac_sign(longitude: float) -> str:
    """
    Получить знак зодиака по долготе
    
    Args:
        longitude: Долгота в градусах (0-360)
    
    Returns:
        Название знака зодиака
    """
    sign_index = int(longitude / 30)
    return ZODIAC_SIGNS[sign_index]


def get_degree_in_sign(longitude: float) -> float:
    """
    Получить градус внутри знака
    
    Args:
        longitude: Долгота в градусах (0-360)
    
    Returns:
        Градус внутри знака (0-30)
    """
    return longitude % 30


def format_zodiac_position(longitude: float) -> str:
    """
    Форматировать позицию в зодиаке
    
    Args:
        longitude: Долгота в градусах (0-360)
    
    Returns:
        Строка вида "24°15' Pisces"
    """
    sign = get_zodiac_sign(longitude)
    degree = get_degree_in_sign(longitude)
    degrees = int(degree)
    minutes = int((degree - degrees) * 60)
    
    return f"{degrees}°{minutes:02d}' {sign}"


def normalize_longitude(longitude: float) -> float:
    """
    Нормализовать долготу к диапазону 0-360
    
    Args:
        longitude: Долгота в градусах
    
    Returns:
        Нормализованная долгота (0-360)
    """
    return longitude % 360


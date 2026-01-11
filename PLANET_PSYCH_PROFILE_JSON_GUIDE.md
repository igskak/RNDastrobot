# Путеводитель по JSON для психологического профиля планет

## ✅ НЕОБХОДИМЫЕ ПОЛЯ (оставить)

### 1. Планета и её достоинство в знаке
```json
planets[i].name                    // Название планеты (Sun, Moon, Mercury, ...)
planets[i].sign                    // Знак (Aries, Taurus, ...)
planets[i].dignity                 // Достоинство: "domicile", "exaltation", "detriment", "fall", "neutral"
planets[i].degree_in_sign          // Градус в знаке (0-30)
planets[i].degree_in_sign_formatted // Форматированный градус (25°48'04")
```

### 2. Знак и его влияние на планеты
```json
planets[i].element                 // Стихия знака: "Fire", "Earth", "Air", "Water"
planets[i].mode                    // Крест знака: "Cardinal", "Fixed", "Mutable"
```

### 3. Ретроградность/директность/стационарность
```json
planets[i].retrograde              // bool: true если ретроградна
planets[i].is_stationary           // bool: true если стационарна
planets[i].stationary_type         // "SR" (перед ретро) или "SD" (перед директ)
```

### 4. Градус нахождения и критические градусы
```json
planets[i].degree_in_sign          // Градус в знаке (0-30)
planets[i].critical_degrees        // Массив критических градусов:
                                   // ["jubilee", "middle", "anareta", "royal", "destructive"]
```

### 5. Аспекты к планете
```json
aspects[]                          // Массив всех аспектов
  .planet_1, .planet_2             // Две планеты в аспекте
  .aspect_type                     // Тип аспекта (Conjunction, Trine, Square, Opposition, Sextile)
  .orb                             // Орбис (точность аспекта)
  .is_partile                      // true если партильный (orb < 1°)
  .harmonic_type                   // "harmonious" или "tense"

planets[i].sun_relation            // "cazimi", "combust", "under_rays" (для соединений с Солнцем)
planets[i].aspect_harmony          // "harmonious", "tense", "mixed", или null (шахта)
planets[i].is_peregrine            // true если планета в шахте (без мажорных аспектов)
```

### 6. Дорифор и Возничий
```json
planets[i].special_roles[]         // Массив специальных ролей:
                                   // "doryphoros" - Дорифор
                                   // "charioteer" - Возничий
                                   // "almuten" - Альмутен карты
                                   // "aspect_king" - Король аспектов
                                   // "handle" - Ручка ведра
```

### 7. Дополнительные полезные поля
```json
planets[i].strength_score          // Сила планеты (-20 до +50)
planets[i].house                   // Номер дома (1-12)
planets[i].is_elevated             // true если самая высокая планета
planets[i].in_intercepted_sign     // true если во включённом знаке
```

---

## ❌ МОЖНО УДАЛИТЬ (не нужны для психопрофиля)

```json
planets[i].longitude               // Абсолютная долгота (0-360) - используется только для расчётов
planets[i].latitude                // Небесная широта - не влияет на психологию
planets[i].distance                // Расстояние до планеты - не используется
planets[i].speed                   // Скорость в градусах/день - используется только для расчётов
planets[i].speed_percent           // Скорость в % - вспомогательное поле
```

---

## 📋 МИНИМАЛЬНЫЙ JSON ДЛЯ ПСИХОПРОФИЛЯ

```json
{
  "planets": [
    {
      "name": "Sun",
      "sign": "Capricorn",
      "degree_in_sign": 25.5,
      "degree_in_sign_formatted": "25°30'00\"",
      "house": 8,
      "retrograde": false,
      "element": "Earth",
      "mode": "Cardinal",
      "dignity": "neutral",
      "strength_score": 15,
      "special_roles": ["almuten"],
      "critical_degrees": ["anareta"],
      "sun_relation": null,
      "aspect_harmony": "mixed",
      "is_peregrine": false,
      "is_stationary": false,
      "stationary_type": null,
      "is_elevated": true,
      "in_intercepted_sign": false
    }
  ],
  "aspects": [
    {
      "planet_1": "Sun",
      "planet_2": "Moon",
      "aspect_type": "Trine",
      "orb": 2.5,
      "is_partile": false,
      "harmonic_type": "harmonious"
    }
  ]
}
```

---

## 🔧 КОД ДЛЯ ОЧИСТКИ JSON

```python
def clean_planet_for_psych_profile(planet: dict) -> dict:
    """Оставить только необходимые поля для психопрофиля"""
    return {
        'name': planet['name'],
        'sign': planet['sign'],
        'degree_in_sign': planet['degree_in_sign'],
        'degree_in_sign_formatted': planet.get('degree_in_sign_formatted'),
        'house': planet['house'],
        'retrograde': planet['retrograde'],
        'element': planet['element'],
        'mode': planet['mode'],
        'dignity': planet['dignity'],
        'strength_score': planet.get('strength_score'),
        'special_roles': planet.get('special_roles', []),
        'critical_degrees': planet.get('critical_degrees', []),
        'sun_relation': planet.get('sun_relation'),
        'aspect_harmony': planet.get('aspect_harmony'),
        'is_peregrine': planet.get('is_peregrine', False),
        'is_stationary': planet.get('is_stationary', False),
        'stationary_type': planet.get('stationary_type'),
        'is_elevated': planet.get('is_elevated', False),
        'in_intercepted_sign': planet.get('in_intercepted_sign', False)
    }

def clean_aspect_for_psych_profile(aspect: dict) -> dict:
    """Оставить только необходимые поля для аспектов"""
    return {
        'planet_1': aspect['planet_1'],
        'planet_2': aspect['planet_2'],
        'aspect_type': aspect['aspect_type'],
        'orb': aspect['orb'],
        'is_partile': aspect.get('is_partile', False),
        'harmonic_type': aspect.get('harmonic_type')
    }
```


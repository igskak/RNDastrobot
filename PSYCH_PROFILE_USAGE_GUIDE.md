# Руководство по использованию психологического профиля планет

## Файл: `natal_26061990_psych_profile_7planets.json`

Этот файл содержит **только 7 классических планет** с полной информацией для психологического профиля.

---

## 📋 Структура данных

### 1. Планета и её достоинство в знаке
```json
planets[i].name                    // Название планеты
planets[i].sign                    // Знак зодиака
planets[i].dignity                 // "domicile", "exaltation", "neutral"
```

**Пример:**
- **Mars** в **Aries** — `dignity: "domicile"` (обитель)
- **Jupiter** в **Cancer** — `dignity: "exaltation"` (экзальтация)
- **Saturn** в **Capricorn** — `dignity: "domicile"` (обитель)

---

### 2. Знак и его влияние
```json
planets[i].element                 // "Fire", "Earth", "Air", "Water"
planets[i].mode                    // "Cardinal", "Fixed", "Mutable"
```

---

### 3. Ретроградность/директность/стационарность
```json
planets[i].retrograde              // true/false
planets[i].is_stationary           // true/false
planets[i].stationary_type         // "SR" или "SD"
```

**В этой карте:**
- **Saturn** — ретроградный (`retrograde: true`)
- Остальные планеты — директные

---

### 4. Критические градусы
```json
planets[i].critical_degrees        // ["royal", "anareta", "jubilee", ...]
```

**В этой карте:**
- **Mars** — в королевском градусе (`critical_degrees: ["royal"]`)

---

### 5. Аспекты к планете

#### 5.1 Соединения (Conjunction)
```json
aspect_summary[planet].conjunctions
```

**В этой карте:**
- **Sun-Mercury** соединение (Mercury под лучами Солнца — `sun_relation: "under_rays"`)

#### 5.2 Партильные аспекты (orb < 1°)
```json
aspect_summary[planet].partile_aspects
```

**В этой карте:**
- **Mars Square Jupiter** — партильный (0.615°) — **очень сильный аспект!**

#### 5.3 Гармоничные и напряженные аспекты
```json
aspect_summary[planet].harmonious  // Трины, секстили
aspect_summary[planet].tense       // Квадратуры, оппозиции
aspect_summary[planet].aspect_harmony  // "harmonious", "tense", "mixed"
```

**Примеры:**
- **Mercury** — только гармоничные (`aspect_harmony: "harmonious"`)
- **Venus** — только напряженные (`aspect_harmony: "tense"`)
- **Moon** — смешанные (`aspect_harmony: "mixed"`)

---

### 6. Дорифор и Возничий
```json
planets[i].special_roles           // ["doryphoros", "charioteer", "almuten", ...]
special_notes.doryphoros
special_notes.charioteer
```

**В этой карте:**
- **Дорифор** — нет
- **Возничий** — нет
- **Альмутен** — **Mars** (сила 29)
- **Король аспектов** — **Jupiter**

---

## 🎯 Ключевые особенности этой карты

### Т-квадрат (T-Square)
**Mars-Jupiter-Saturn** с вершиной в **Mars**
- Mars Square Jupiter (партильный! 0.615°)
- Mars Square Saturn (4.388°)
- Jupiter Opposition Saturn (5.003°)

### Достоинства планет
- **Mars** в обители (Aries)
- **Jupiter** в экзальтации (Cancer)
- **Saturn** в обители (Capricorn)
- **Mercury** в обители (Gemini)

### Специальные роли
- **Mars** — Альмутен карты (максимальная сила)
- **Jupiter** — Король аспектов
- **Moon** — Элевация (самая высокая планета)

### Меркурий под лучами Солнца
**Mercury** находится в соединении с **Sun** (7.446°) — `sun_relation: "under_rays"`

---

## 💡 Как использовать для психопрофиля

1. **Начните с достоинств** — планеты в обители/экзальтации сильнее
2. **Проверьте партильные аспекты** — они самые сильные
3. **Оцените Т-квадрат** — источник напряжения и мотивации
4. **Учтите специальные роли** — Альмутен и Король аспектов важны
5. **Обратите внимание на ретроградность** — Saturn ретроградный
6. **Критические градусы** — Mars в королевском градусе

---

## 📊 Быстрая сводка по планетам

| Планета | Знак | Достоинство | Аспекты | Особенности |
|---------|------|-------------|---------|-------------|
| Sun | Cancer | neutral | mixed | Соединение с Mercury |
| Moon | Leo | neutral | mixed | Элевация (самая высокая) |
| Mercury | Gemini | domicile | harmonious | Под лучами Солнца |
| Venus | Gemini | neutral | tense | Только напряженные аспекты |
| Mars | Aries | domicile | tense | Альмутен, Т-квадрат, партильный аспект |
| Jupiter | Cancer | exaltation | tense | Король аспектов, Т-квадрат |
| Saturn | Capricorn | domicile | tense | Ретроградный, Т-квадрат |


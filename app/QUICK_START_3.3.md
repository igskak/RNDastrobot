# Швидкий старт пункту 3.3

**Дата:** 2025-11-27  
**Час на виконання:** ~10 хвилин

---

## ✅ Чеклист швидкого запуску

### 1️⃣ Застосувати seeds (2 хв)

```bash
cd app/database

# Застосувати всі нові seeds
psql -U postgres -d astrobot -f seeds/02_aspect_types.sql
psql -U postgres -d astrobot -f seeds/05_configuration_types.sql
psql -U postgres -d astrobot -f seeds/06_cosmogram_patterns.sql
```

**Перевірка:**
```sql
SELECT COUNT(*) FROM ref_aspect_types;      -- має бути 18
SELECT COUNT(*) FROM ref_configuration_types; -- має бути 4
SELECT COUNT(*) FROM ref_cosmogram_patterns;  -- має бути 7
```

---

### 2️⃣ Запустити тести (3 хв)

```bash
cd app

# Встановити pytest (якщо потрібно)
pip install pytest

# Запустити тести
pytest tests/test_aspects_and_configurations.py -v
```

**Очікуваний результат:**
```
tests/test_aspects_and_configurations.py::TestAspectService::test_calculate_aspects PASSED
tests/test_aspects_and_configurations.py::TestAspectService::test_get_aspects_for_planet PASSED
tests/test_aspects_and_configurations.py::TestConfigurationService::test_detect_configurations PASSED
tests/test_aspects_and_configurations.py::TestConfigurationService::test_detect_stelliums PASSED
tests/test_aspects_and_configurations.py::TestCosmogramService::test_analyze_distribution PASSED
tests/test_aspects_and_configurations.py::TestCosmogramService::test_determine_jones_pattern PASSED
tests/test_aspects_and_configurations.py::TestIntegration::test_full_natal_chart_with_aspects PASSED

======================== 7 passed in X.XXs ========================
```

---

### 3️⃣ Тестовий розрахунок (5 хв)

```bash
# Запустити API
cd app/api
uvicorn main:app --reload
```

**В іншому терміналі:**
```bash
# Відправити тестовий запит
curl -X POST "http://localhost:8000/natal-chart" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "1990-01-15",
    "time": "12:30:00",
    "timezone": "Europe/Kiev",
    "place": "Kyiv, Ukraine",
    "house_system": "P"
  }' | python -m json.tool
```

**Перевірити наявність нових полів у відповіді:**
- ✅ `aspects` - список аспектів
- ✅ `aspect_configurations` - конфігурації
- ✅ `stelliums` - стеллиуми
- ✅ `cosmogram_pattern` - фігура Джонса
- ✅ `planet_distribution` - розподіл планет

---

## 🎯 Що має працювати

### Аспекти
```json
"aspects": [
  {
    "planet_1": "Sun",
    "planet_2": "Moon",
    "aspect_type": "Trine",
    "orb": 2.5,
    "is_major": true,
    "harmonic_type": "harmonious"
  }
]
```

### Конфігурації
```json
"aspect_configurations": [
  {
    "type": "Grand_Trine",
    "planets_involved": ["Sun", "Moon", "Jupiter"],
    "apex_planet": null,
    "strength_score": 8.0
  }
]
```

### Стеллиуми
```json
"stelliums": [
  {
    "type": "sign",
    "sign": "Capricorn",
    "planets": ["Sun", "Mercury", "Venus", "Neptune"],
    "count": 4,
    "strength_score": 6.0
  }
]
```

### Фігура Джонса
```json
"cosmogram_pattern": {
  "pattern_type": "Bowl",
  "anchor_planet": null,
  "empty_arc_degree": 165.5,
  "special_roles": []
}
```

---

## 🐛 Якщо щось не працює

### Seeds не застосовуються
```bash
# Перевірити підключення
psql -U postgres -d astrobot -c "SELECT version();"

# Застосувати схему, якщо потрібно
psql -U postgres -d astrobot -f schema/03_reference_tables.sql
```

### Тести падають
```bash
# Активувати venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Встановити залежності
pip install -r requirements.txt
```

### API не повертає нові поля
```bash
# Перезапустити API
# Ctrl+C в терміналі з uvicorn
uvicorn main:app --reload
```

---

## 📚 Додаткова документація

- **Детальний звіт:** [IMPLEMENTATION_REPORT_3.3.md](IMPLEMENTATION_REPORT_3.3.md)
- **Повна інструкція:** [SETUP_GUIDE_3.3.md](SETUP_GUIDE_3.3.md)
- **Специфікація:** [Astrobot_spec.txt](Astrobot_spec.txt) (рядки 790-796)

---

## ✅ Готово!

Якщо всі 3 кроки виконані успішно - пункт 3.3 повністю працює! 🎉


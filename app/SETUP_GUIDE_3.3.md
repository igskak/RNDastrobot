# Інструкція з налаштування та запуску пункту 3.3

**Дата:** 2025-11-27  
**Пункт специфікації:** 3.3 - Етап 2: обчислення похідних

---

## 📋 Передумови

Перед початком переконайтеся, що:
- ✅ PostgreSQL запущено
- ✅ База даних створена
- ✅ Виконано міграції схеми (пункти 3.1-3.2)
- ✅ Python venv активовано

---

## 🚀 Крок 1: Застосування нових seed-файлів

### 1.1 Перевірка підключення до БД

```bash
cd app
python -c "from database.connection import get_db_session; print('DB OK' if get_db_session() else 'DB FAIL')"
```

### 1.2 Запуск seed-файлів

```bash
# Перейти в директорію БД
cd app/database

# Запустити seeds для справочників
psql -U postgres -d astrobot -f seeds/02_aspect_types.sql
psql -U postgres -d astrobot -d seeds/05_configuration_types.sql
psql -U postgres -d astrobot -f seeds/06_cosmogram_patterns.sql
```

**Альтернативний спосіб (через Python):**

```python
from database.connection import get_db_session

db = get_db_session()

# Читати та виконати SQL файли
with open('seeds/02_aspect_types.sql', 'r') as f:
    db.execute(f.read())

with open('seeds/05_configuration_types.sql', 'r') as f:
    db.execute(f.read())

with open('seeds/06_cosmogram_patterns.sql', 'r') as f:
    db.execute(f.read())

db.commit()
print("Seeds applied successfully!")
```

### 1.3 Перевірка заповнення справочників

```sql
-- Перевірити типи аспектів (має бути 18)
SELECT COUNT(*) FROM ref_aspect_types;

-- Перевірити типи конфігурацій (має бути 4)
SELECT COUNT(*) FROM ref_configuration_types;

-- Перевірити паттерни космограми (має бути 7)
SELECT COUNT(*) FROM ref_cosmogram_patterns;
```

---

## 🧪 Крок 2: Запуск тестів

### 2.1 Встановлення pytest (якщо ще не встановлено)

```bash
pip install pytest
```

### 2.2 Запуск тестів

```bash
cd app

# Запустити всі тести для пункту 3.3
pytest tests/test_aspects_and_configurations.py -v

# Запустити конкретний тестовий клас
pytest tests/test_aspects_and_configurations.py::TestAspectService -v

# Запустити конкретний тест
pytest tests/test_aspects_and_configurations.py::TestAspectService::test_calculate_aspects -v
```

### 2.3 Очікувані результати

Всі тести мають пройти успішно:
- ✅ `test_calculate_aspects` - розрахунок аспектів
- ✅ `test_get_aspects_for_planet` - отримання аспектів планети
- ✅ `test_detect_configurations` - виявлення конфігурацій
- ✅ `test_detect_stelliums` - виявлення стеллиумів
- ✅ `test_analyze_distribution` - аналіз розподілу
- ✅ `test_determine_jones_pattern` - визначення фігури Джонса
- ✅ `test_full_natal_chart_with_aspects` - інтеграційний тест

---

## 🔍 Крок 3: Тестування на реальних даних

### 3.1 Розрахунок натальної карти через API

```bash
# Запустити API сервер (з кореня проекту swisseph/)
source .venv/bin/activate && pip install -r app/requirements.txt
bash app/start_api.sh
```

### 3.2 Відправити запит

```bash
curl -X POST "http://localhost:8000/natal-chart" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "1990-01-15",
    "time": "12:30:00",
    "timezone": "Europe/Kiev",
    "place": "Kyiv, Ukraine",
    "house_system": "P"
  }'
```

### 3.3 Перевірка відповіді

Відповідь має містити:
```json
{
  "user_id": "...",
  "birth_data": {...},
  "planets": [...],
  "houses": [...],
  "angles": {...},
  "special_points": {...},
  "aspects": [
    {
      "planet_1": "Sun",
      "planet_2": "Moon",
      "aspect_type": "Trine",
      "orb": 2.5,
      "is_major": true,
      "harmonic_type": "harmonious"
    },
    ...
  ],
  "aspect_configurations": [
    {
      "type": "Grand_Trine",
      "planets_involved": ["Sun", "Moon", "Jupiter"],
      "strength_score": 8.0
    },
    ...
  ],
  "stelliums": [
    {
      "type": "sign",
      "sign": "Capricorn",
      "planets": ["Sun", "Mercury", "Venus", "Neptune"],
      "count": 4,
      "strength_score": 6.0
    },
    ...
  ],
  "cosmogram_pattern": {
    "pattern_type": "Bowl",
    "empty_arc_degree": 165.5,
    "special_roles": []
  },
  "planet_distribution": {
    "min_empty_arc": 15.2,
    "max_empty_arc": 165.5,
    "cluster_count": 2,
    "spread_map": {...}
  }
}
```

---

## 🐛 Troubleshooting

### Проблема: Seeds не застосовуються

**Рішення:**
```bash
# Перевірити, чи існують таблиці
psql -U postgres -d astrobot -c "\dt ref_*"

# Якщо таблиць немає, застосувати схему
psql -U postgres -d astrobot -f schema/03_reference_tables.sql
```

### Проблема: Тести падають з помилкою імпорту

**Рішення:**
```bash
# Переконатися, що venv активовано
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Встановити залежності
pip install -r requirements.txt
```

### Проблема: Аспекти не розраховуються

**Рішення:**
```python
# Перевірити наявність даних
from database.connection import get_db_session
from database.models import NatalPlanet

db = get_db_session()
planets = db.query(NatalPlanet).filter(NatalPlanet.user_id == 'YOUR_USER_ID').all()
print(f"Found {len(planets)} planets")
```

---

## ✅ Перевірка успішності

Після виконання всіх кроків:

1. ✅ Справочники заповнені (18 аспектів, 4 конфігурації, 7 паттернів)
2. ✅ Всі тести проходять
3. ✅ API повертає повні дані з аспектами та конфігураціями
4. ✅ Дані зберігаються в БД

---

## 📚 Додаткова інформація

- Детальний звіт: `IMPLEMENTATION_REPORT_3.3.md`
- Специфікація: `Astrobot_spec.txt` (рядки 790-796)
- Тести: `tests/test_aspects_and_configurations.py`


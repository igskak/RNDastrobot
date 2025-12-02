# Отчёт о реализации этапа 3.5 — Интегральные балансы

## 📋 Обзор

Этап 3.5 реализует расчёт интегральных балансов натальной карты — распределение планет по различным категориям с учётом весов планет.

**Дата реализации:** 28.11.2024  
**Версия:** 1.0  
**Статус:** ✅ Завершено и протестировано

---

## 🎯 Реализованные балансы

### 1. **Баланс стихий** (`user_element_balance`)
Распределение планет по 4 стихиям:
- **Fire** (Огонь): Aries, Leo, Sagittarius
- **Earth** (Земля): Taurus, Virgo, Capricorn
- **Air** (Воздух): Gemini, Libra, Aquarius
- **Water** (Вода): Cancer, Scorpio, Pisces

### 2. **Баланс крестов/модальностей** (`user_mode_balance`)
Распределение планет по 3 крестам:
- **Cardinal** (Кардинальный): Aries, Cancer, Libra, Capricorn
- **Fixed** (Фиксированный): Taurus, Leo, Scorpio, Aquarius
- **Mutable** (Мутабельный): Gemini, Virgo, Sagittarius, Pisces

### 3. **Баланс полов/бинера** (`user_gender_balance`)
Распределение планет по полярности:
- **Masculine** (Мужской): Fire + Air знаки
- **Feminine** (Женский): Earth + Water знаки

### 4. **Баланс зон Тримурти** (`user_zones_balance`)
Распределение планет по зонам индийской космологии:
- **Brahma** (Творение): Aries, Taurus, Gemini, Cancer
- **Vishnu** (Сохранение): Leo, Virgo, Libra, Scorpio
- **Shiva** (Разрушение): Sagittarius, Capricorn, Aquarius, Pisces

### 5. **Баланс полусфер** (`user_hemisphere_balance`)
Распределение планет по методу Джонса (по осям ASC/DSC и MC/IC):
- **Northern** (Северная): дома 1→2→3→4→5→6 (от IC к MC против часовой)
- **Southern** (Южная): дома 7→8→9→10→11→12 (от MC к IC против часовой)
- **Eastern** (Восточная): дома 10→11→12→1→2→3 (от ASC к DSC против часовой)
- **Western** (Западная): дома 4→5→6→7→8→9 (от DSC к ASC против часовой)

### 6. **Баланс квадрантов** (`user_quadrant_balance`)
Распределение планет по 4 квадрантам (нумерация от углов):
- **Q1**: дома 10→11→12 (от MC к ASC)
- **Q2**: дома 1→2→3 (от ASC к IC)
- **Q3**: дома 4→5→6 (от IC к DSC)
- **Q4**: дома 7→8→9 (от DSC к MC)

### 7. **Баланс групп домов** (`user_house_group_balance`)
Распределение планет по типам домов:
- **Angular** (Угловые): 1, 4, 7, 10
- **Succedent** (Последующие): 2, 5, 8, 11
- **Cadent** (Падающие): 3, 6, 9, 12

---

## ⚖️ Веса планет

Все балансы рассчитываются с учётом весов планет:

| Планета | Вес | Обоснование |
|---------|-----|-------------|
| Sun     | 2   | Светило, основа личности |
| Moon    | 2   | Светило, эмоциональная природа |
| Mercury | 1   | Личная планета |
| Venus   | 1   | Личная планета |
| Mars    | 1   | Личная планета |
| Jupiter | 1   | Социальная планета |
| Saturn  | 1   | Социальная планета |
| Uranus  | 1   | Высшая планета |
| Neptune | 1   | Высшая планета |
| Pluto   | 1   | Высшая планета |
| Chiron  | 1   | Кентавр (учитывается как планета) |

**Итого:** 13 единиц веса (2 + 2 + 9×1)

---

## 🔧 Технические детали

### Архитектура

1. **ORM модели** (`app/database/models.py`):
   - 7 новых моделей для таблиц балансов
   - Связь с `User` через `user_id`
   - Автоматические timestamps (`created_at`, `updated_at`)

2. **Сервис** (`app/services/balance_service.py`):
   - Класс `BalanceService` с методом `calculate_all_balances(user_id)`
   - 7 приватных методов для расчёта каждого баланса
   - Метод `_get_planet_weight(planet_name)` для получения веса планеты

3. **Интеграция** (`app/services/natal_chart_service.py`):
   - Вызов `BalanceService.calculate_all_balances()` в конце `_save_to_database()`
   - Выполняется после этапа 3.4 (сила планет и особые роли)

### Алгоритмы расчёта

#### Балансы по знакам (стихии, кресты, пол, зоны)
```python
for planet in planets:
    weight = _get_planet_weight(planet.planet)
    # Получаем свойство знака из ref_sign_properties
    property_value = sign_properties[planet.sign][property_name]
    balance[property_value] += weight
```

#### Баланс полусфер (метод Джонса)
```python
# Northern/Southern: по оси MC/IC
if IC_degree <= planet_degree < MC_degree:
    balance.northern += weight
else:
    balance.southern += weight

# Eastern/Western: по оси ASC/DSC
if ASC_degree <= planet_degree < DSC_degree:
    balance.eastern += weight
else:
    balance.western += weight
```

#### Баланс квадрантов (от углов)
```python
quadrants = {
    1: (MC_degree, ASC_degree),   # Q1: MC → ASC
    2: (ASC_degree, IC_degree),   # Q2: ASC → IC
    3: (IC_degree, DSC_degree),   # Q3: IC → DSC
    4: (DSC_degree, MC_degree),   # Q4: DSC → MC
}
```

#### Баланс групп домов
```python
house_groups = {
    'angular': [1, 4, 7, 10],
    'succedent': [2, 5, 8, 11],
    'cadent': [3, 6, 9, 12]
}
```

---

## 📊 Пример результата

Для карты: **15.01.1990, 12:30, Киев** (50.4501°N, 30.5234°E)

```json
{
  "element_balance": {
    "fire": 1.0,
    "earth": 8.0,
    "air": 1.0,
    "water": 3.0
  },
  "mode_balance": {
    "cardinal": 8.0,
    "fixed": 2.0,
    "mutable": 3.0
  },
  "gender_balance": {
    "masculine": 2.0,
    "feminine": 11.0
  },
  "zones_balance": {
    "brahma": 3.0,
    "vishnu": 0.0,
    "shiva": 10.0
  },
  "hemisphere_balance": {
    "northern": 4.0,
    "southern": 9.0,
    "eastern": 5.0,
    "western": 8.0
  },
  "quadrant_balance": {
    "q1": 4.0,
    "q2": 1.0,
    "q3": 3.0,
    "q4": 5.0
  },
  "house_group_balance": {
    "angular": 5.0,
    "succedent": 4.0,
    "cadent": 4.0
  }
}
```

**Интерпретация:**
- **Доминирующая стихия:** Earth (8.0) — практичность, материализм
- **Недостающая стихия:** Air (1.0) — нужно развивать коммуникацию
- **Доминирующий крест:** Cardinal (8.0) — инициативность, лидерство
- **Доминирующий пол:** Feminine (11.0) — восприимчивость, интроверсия
- **Доминирующая зона:** Shiva (10.0) — трансформация, завершение
- **Полусферы:** Southern (9.0) > Northern (4.0) — публичность, социальность
- **Квадранты:** Q4 (5.0) — служение, карьера

---

## ✅ Тестирование

### Тестовый файл: `app/tests/test_balances.py`

**10 тестов:**

1. ✅ `test_chiron_in_planets` — проверка, что Chiron в `natal_planets`
2. ✅ `test_calculate_element_balance` — баланс стихий
3. ✅ `test_calculate_mode_balance` — баланс крестов
4. ✅ `test_calculate_gender_balance` — баланс полов
5. ✅ `test_calculate_zones_balance` — баланс зон
6. ✅ `test_calculate_hemisphere_balance` — баланс полусфер
7. ✅ `test_calculate_quadrant_balance` — баланс квадрантов
8. ✅ `test_calculate_house_group_balance` — баланс групп домов
9. ✅ `test_planet_weights` — проверка констант весов
10. ✅ `test_full_integration` — полная интеграция

### Запуск тестов

```bash
cd app
python -m pytest tests/test_balances.py -v
```

**Результат:**
```
10 passed, 2 warnings in 80.19s
```

---

## 🔄 Изменения в существующих файлах

### 1. `app/utils/constants.py`
**Изменение:** Chiron перемещён из `SPECIAL_POINTS` в `PLANETS`

```python
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
    15: "Chiron",  # ← ДОБАВЛЕНО
}

SPECIAL_POINTS = {
    'TrueNorthNode': 'Северный узел (истинный)',
    'TrueSouthNode': 'Южный узел (истинный)',
    'BlackMoon': 'Чёрная Луна (Лилит)',
    'WhiteMoon': 'Белая Луна (Селена)',
    'Fortune': 'Колесо Фортуны',
    'Vertex': 'Вертекс',
    'AntiVertex': 'Анти-Вертекс',
    # Chiron удалён отсюда
}
```

### 2. `app/services/natal_chart_service.py`
**Изменение 1:** Удалён расчёт Chiron из `_calculate_special_points()`

**Изменение 2:** Добавлена интеграция `BalanceService` в конец `_save_to_database()`:

```python
# ЭТАП 4: Интегральные балансы (пункт 3.5 спецификації)
from app.services.balance_service import BalanceService

balance_service = BalanceService(db_session)
balance_service.calculate_all_balances(user.user_id)
```

### 3. `app/database/models.py`
**Изменение:** Добавлено 7 новых ORM моделей (строки 377-488):
- `UserElementBalance`
- `UserModeBalance`
- `UserGenderBalance`
- `UserZonesBalance`
- `UserHemisphereBalance`
- `UserQuadrantBalance`
- `UserHouseGroupBalance`

---

## 📁 Новые файлы

### 1. `app/services/balance_service.py` (418 строк)
Полная реализация сервиса расчёта балансов.

**Основные методы:**
- `calculate_all_balances(user_id)` — публичный метод
- `_get_planet_weight(planet_name)` — получение веса планеты
- `_calculate_element_balance(user_id, planets)` — стихии
- `_calculate_mode_balance(user_id, planets)` — кресты
- `_calculate_gender_balance(user_id, planets)` — пол
- `_calculate_zones_balance(user_id, planets)` — зоны
- `_calculate_hemisphere_balance(user_id, planets)` — полусферы
- `_calculate_quadrant_balance(user_id, planets)` — квадранты
- `_calculate_house_group_balance(user_id, planets)` — группы домов

### 2. `app/tests/test_balances.py` (195 строк)
Полный набор тестов для проверки всех балансов.

---

## 🎓 Астрологическая методология

### Метод Джонса для полусфер

**Marc Edmund Jones** (1888-1980) — американский астролог, разработавший классификацию натальных карт по распределению планет.

**Принцип:** Полусферы определяются по **осям углов** (ASC/DSC и MC/IC), а не по домам.

**Преимущества:**
- ✅ Не зависит от системы домов
- ✅ Работает для любых широт
- ✅ Соответствует классической традиции

**Альтернативный метод (по домам):**
- Northern: дома 1-6
- Southern: дома 7-12
- Eastern: дома 10-12, 1-3
- Western: дома 4-9

❌ **Не используется**, так как зависит от системы домов и может давать искажения на высоких широтах.

### Квадранты от углов

**Нумерация:** Q1 (MC→ASC), Q2 (ASC→IC), Q3 (IC→DSC), Q4 (DSC→MC)

**Обоснование:**
- Соответствует движению Солнца по небу
- Используется в фигурах Джонса
- Описано у Подводного и в Астрокурсе

**Альтернативная нумерация (от 1-го дома):**
- Q1: дома 1-2-3
- Q2: дома 4-5-6
- Q3: дома 7-8-9
- Q4: дома 10-11-12

❌ **Не используется**, так как менее распространена в классической астрологии.

---

## 🚀 Использование

### Пример кода

```python
from app.services.balance_service import BalanceService
from app.database.connection import get_db_session
from uuid import UUID

# Создаём сессию
db_session = get_db_session()

# Создаём сервис
balance_service = BalanceService(db_session)

# Рассчитываем все балансы для пользователя
user_id = UUID('...')
balance_service.calculate_all_balances(user_id)

# Получаем результаты
from app.database.models import UserElementBalance

element_balance = db_session.query(UserElementBalance).filter(
    UserElementBalance.user_id == user_id
).first()

print(f"Fire: {element_balance.fire}")
print(f"Earth: {element_balance.earth}")
print(f"Air: {element_balance.air}")
print(f"Water: {element_balance.water}")
```

### Интеграция в основной процесс

Балансы рассчитываются **автоматически** при создании натальной карты:

```python
from app.services.natal_chart_service import NatalChartService

service = NatalChartService(ephe_path='/path/to/ephe')
result = service.calculate_natal_chart(
    birth_date=date(1990, 1, 15),
    birth_time=time(12, 30),
    timezone='Europe/Kiev',
    latitude=50.4501,
    longitude=30.5234,
    house_system='P',
    save_to_db=True,
    db_session=db_session
)

# Балансы уже рассчитаны и сохранены в БД!
```

---

## 📝 Следующие шаги

### Этап 3.6 (будущее)
Добавление доминирующих/недостающих элементов в таблицы балансов:
- `dominant_element` — доминирующая стихия
- `lacking_element` — недостающая стихия
- Аналогично для других балансов

### Этап 4 (будущее)
Семантический слой — интерпретация балансов:
- Текстовые описания доминирующих элементов
- Рекомендации по развитию недостающих качеств
- Психологические портреты на основе балансов

---

## ✅ Чек-лист завершения

- [x] Chiron перемещён в `natal_planets`
- [x] Созданы 7 ORM моделей для балансов
- [x] Реализован `BalanceService` с 7 методами расчёта
- [x] Интегрирован в `NatalChartService`
- [x] Созданы 10 тестов
- [x] Все тесты проходят (10/10)
- [x] Создана документация
- [x] Проверена корректность весов планет (13 единиц)
- [x] Проверена корректность алгоритмов (метод Джонса, квадранты от углов)

---

## 📚 Ссылки

- **Спецификация:** `app/Astrobot_spec.txt` (пункт 3.5)
- **Схема БД:** `app/database/schema/05_balance_tables.sql`
- **Сервис:** `app/services/balance_service.py`
- **Тесты:** `app/tests/test_balances.py`
- **Модели:** `app/database/models.py` (строки 377-488)

---

**Автор:** Augment Agent
**Дата:** 28.11.2024
**Версия:** 1.0



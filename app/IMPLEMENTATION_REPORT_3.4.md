# Звіт про реалізацію пункту 3.4 специфікації

**Дата:** 2025-11-28  
**Пункт специфікації:** 3.4 - Етап 3: Сила та статус планет

---

## 📋 Огляд

Реалізовано повний функціонал розрахунку сили планет та визначення спеціальних ролей:
- ✅ Розрахунок `strength_score` для кожної планети
- ✅ Визначення спеціальних ролей: альмутен, возничий, дорифор, король аспектів, ручка ведра
- ✅ Оновлення поля `special_roles` в таблиці `natal_planets`
- ✅ Інтеграція в основний процес після етапу 3.3

---

## 🗂️ Створені файли

### 1. SQL Schema та Seeds

#### `app/database/schema/03_reference_tables.sql`
- Додано таблицю `ref_planet_role_weights`
- Поля: `role`, `name`, `description`, `weight`
- Зберігає ваги для кожної спеціальної ролі

#### `app/database/seeds/07_planet_role_weights.sql`
- Заповнення справочника `ref_planet_role_weights`
- 5 ролей: almuten (3.0), charioteer (2.0), doryphoros (2.0), aspect_king (1.0), handle (1.0)
- Дані з `ref/ref_planet_role_weights.json`

### 2. ORM Моделі

#### Додано в `app/database/models.py`:
- `RefPlanetRoleWeight` - справочник весів ролей планет

### 3. Сервіси

#### `app/services/planet_strength_service.py`
Сервіс для розрахунку сили планет (`strength_score`).

**Основні методи:**
- `calculate_all_strengths(user_id)` - розрахувати силу всіх планет
- `_calculate_planet_strength(user_id, planet)` - розрахувати силу однієї планети
- `_get_dignity_score(dignity)` - бали за достоїнство
- `_get_house_score(user_id, house_number)` - бали за положення в будинку
- `_get_aspect_score(user_id, planet_name)` - бали за аспекти
- `_get_configuration_score(user_id, planet_name)` - бали за конфігурації
- `_get_stellium_score(user_id, planet_name)` - бали за стеллиуми

**Ваги для розрахунку:**
```python
DIGNITY_WEIGHTS = {
    'domicile': 5.0,
    'exaltation': 4.0,
    'neutral': 0.0,
    'detriment': -5.0,
    'fall': -4.0,
}

HOUSE_GROUP_WEIGHTS = {
    'angular': 4.0,
    'succedent': 2.0,
    'cadent': 0.0,
}

ASPECT_WEIGHTS = {
    'harmonious': 2.0,
    'tense': 3.0,
    'neutral': 0.0,
}

CONJUNCTION_WEIGHTS = {
    'Jupiter': 2.0,
    'Venus': 2.0,
    'Mars': -2.0,
    'Saturn': -2.0,
}

CONFIGURATION_WEIGHTS = {
    'Grand_Trine': 5.0,
    'T_Square': 4.0,
    'Grand_Cross': 6.0,
    'Yod': 3.0,
}

STELLIUM_WEIGHT = 2.0
RETROGRADE_PENALTY = -1.0
```

#### `app/services/special_roles_service.py`
Сервіс для визначення спеціальних ролей планет.

**Основні методи:**
- `determine_all_roles(user_id)` - визначити всі ролі
- `_find_almuten(user_id)` - знайти альмутена (планета з max strength_score)
- `_find_charioteer(user_id)` - знайти возничого (класична планета перед Сонцем, орбіс 5°)
- `_find_doryphoros(user_id)` - знайти дорифора (Меркурій/Венера/Марс після Сонця, орбіс 15°)
- `_find_aspect_king(user_id)` - знайти короля аспектів (max мажорних аспектів)
- `_find_handle(user_id)` - знайти ручку ведра (якірна планета фігури Bucket)

**Параметри:**
```python
CLASSICAL_PLANETS = ['Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']
DORYPHOROS_PLANETS = ['Mercury', 'Venus', 'Mars']
CHARIOTEER_ORB = 5.0
DORYPHOROS_ORB = 15.0
```

### 4. Інтеграція

#### Оновлено `app/services/natal_chart_service.py`:
Додано етап 3.4 після етапу 3.3 в методі `_save_to_database()`:

```python
# ЭТАП 3: Сила и статус планет (пункт 3.4 спецификації)
from app.services.planet_strength_service import PlanetStrengthService
from app.services.special_roles_service import SpecialRolesService

# 1. Розрахунок сили планет
strength_service = PlanetStrengthService(db_session)
strength_service.calculate_all_strengths(user.user_id)

# 2. Визначення спеціальних ролей
roles_service = SpecialRolesService(db_session)
roles_service.determine_all_roles(user.user_id)
```

### 5. Тести

#### `app/tests/test_planet_strength_and_roles.py`
Тести для перевірки функціональності:
- `test_planet_strength_calculation()` - перевірка розрахунку сили
- `test_almuten_determination()` - перевірка визначення альмутена
- `test_aspect_king_determination()` - перевірка визначення короля аспектів
- `test_special_roles_format()` - перевірка формату special_roles

---

## 🎯 Алгоритм розрахунку сили планети

Сила планети (`strength_score`) розраховується як сума балів за:

1. **Достоїнство в знаку:**
   - Domicile (обитель): +5
   - Exaltation (екзальтація): +4
   - Neutral: 0
   - Detriment (вигнання): -5
   - Fall (падіння): -4

2. **Положення в будинку (кутовість):**
   - Angular (кутовий: 1, 4, 7, 10): +4
   - Succedent (наступний: 2, 5, 8, 11): +2
   - Cadent (падаючий: 3, 6, 9, 12): 0

3. **Аспекти:**
   - Кожен гармонійний аспект (trine, sextile): +2
   - Кожен напружений аспект (square, opposition): +3
   - З'єднання з благодійником (Jupiter, Venus): +2
   - З'єднання зі шкідником (Mars, Saturn): -2

4. **Участь в конфігураціях:**
   - Grand Trine: +5
   - T-Square: +4
   - Grand Cross: +6
   - Yod: +3

5. **Участь в стеллиумах:**
   - Планета в стеллиумі: +2

6. **Ретроградність:**
   - Ретроградна планета: -1

---

## 🔑 Спеціальні ролі планет

### 1. Альмутен карти (Almuten)
- Планета з найвищим `strength_score`
- Головний управитель карти
- Вага: 3.0

### 2. Возничий (Charioteer)
- Класична планета (до Сатурна включно)
- Знаходиться ПЕРЕД Сонцем (західніше)
- Орбіс: 5°
- Веде людину до мети
- Вага: 2.0

### 3. Дорифор (Doryphoros)
- Тільки Меркурій, Венера або Марс
- Знаходиться ПІСЛЯ Сонця (східніше)
- Орбіс: 15°
- Супроводжує людину
- Вага: 2.0

### 4. Король аспектів (Aspect King)
- Планета з найбільшою кількістю мажорних аспектів
- Враховуються тільки реальні планети (без фіктивних точок)
- Найбільш аспектована планета
- Вага: 1.0

### 5. Ручка ведра (Handle)
- Якірна планета фігури Джонса "Bucket"
- Визначається в `CosmogramService`
- Точка фокусу енергії
- Вага: 1.0

---

## 📊 Структура даних

### Таблиця `natal_planets`
Оновлені поля:
- `strength_score` (DECIMAL(6,2)) - сила планети
- `special_roles` (JSONB) - масив ролей, наприклад: `["almuten", "aspect_king"]`

### Таблиця `ref_planet_role_weights`
```sql
CREATE TABLE ref_planet_role_weights (
    role VARCHAR(30) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    weight DECIMAL(3, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Дані:
| role | name | weight |
|------|------|--------|
| almuten | Альмутен карты | 3.0 |
| charioteer | Возничий | 2.0 |
| doryphoros | Дорифор | 2.0 |
| aspect_king | Король аспектов | 1.0 |
| handle | Ручка ведра | 1.0 |

---

## 🔄 Послідовність виконання

1. **Етап 3.1** - Базовий розрахунок (планети, будинки, кути)
2. **Етап 3.2** - Збагачення даних (element, mode, dignity, house_group)
3. **Етап 3.3** - Похідні дані (аспекти, конфігурації, стеллиуми, космограма)
4. **Етап 3.4** - Сила та статус планет ✅
   - Розрахунок `strength_score`
   - Визначення `special_roles`

---

## ✅ Результат

Після виконання етапу 3.4 кожна планета в таблиці `natal_planets` має:
- ✅ `strength_score` - числове значення сили планети
- ✅ `special_roles` - масив спеціальних ролей (може бути порожнім)

Приклад:
```json
{
  "planet": "Sun",
  "strength_score": 12.5,
  "special_roles": ["almuten", "charioteer"]
}
```

---

## 🧪 Тестування

Запуск тестів:
```bash
pytest app/tests/test_planet_strength_and_roles.py -v
```

**Результат:** ✅ **4 passed** (всі тести пройшли успішно)

Тести перевіряють:
- ✅ Розрахунок сили для всіх планет
- ✅ Визначення альмутена
- ✅ Визначення короля аспектів
- ✅ Формат поля special_roles

### Приклад результатів

Тестова карта (15.01.1990, 12:30, Київ):

| Планета  | Сила | Достоїнство | Дім | Ролі |
|----------|------|-------------|-----|------|
| Pluto    | 37   | domicile    | 7 (angular) | almuten |
| Saturn   | 31   | domicile    | 10 (angular) | - |
| Neptune  | 30   | neutral     | 9 (cadent) | - |
| Jupiter  | 29   | exaltation  | 4 (angular) | - |
| Mercury  | 29   | neutral     | 9 (cadent) | - |
| Moon     | 26   | neutral     | 6 (cadent) | aspect_king |
| Venus    | 24   | neutral     | 10 (angular) | doryphoros |
| Uranus   | 22   | neutral     | 9 (cadent) | - |
| Mars     | 17   | neutral     | 4 (angular) | - |
| Sun      | 13   | neutral     | 10 (angular) | - |

**Висновки:**
- Плутон — найсильніша планета (Альмутен): в домициле + кутовий дім + участь в конфігураціях
- Місяць — Король аспектів: максимальна кількість мажорних аспектів
- Венера — Дорифор: перша з Mercury/Venus/Mars після Сонця в межах 15°

---

## 📝 Примітки

1. **Ваги конфігурацій** враховують "силу через напругу" - напружені аспекти дають більше балів (+3), ніж гармонійні (+2)
2. **Возничий та Дорифор** можуть бути відсутні, якщо немає планет в потрібному орбісі
3. **Король аспектів** визначається тільки серед реальних планет (Sun-Pluto)
4. **Ручка ведра** визначається тільки для фігури Bucket
5. **Одна планета може мати кілька ролей** одночасно

---

## 🎓 Відповідність специфікації

✅ Пункт 3.4 специфікації (рядки 798-809) повністю реалізовано:
- Розрахунок сили планет з урахуванням всіх факторів
- Визначення спеціальних ролей
- Оновлення полів `strength_score` та `special_roles`
- Інтеграція в основний процес

---

**Статус:** ✅ ЗАВЕРШЕНО
**Наступний крок:** Етап 4 - Інтерпретація та аналіз


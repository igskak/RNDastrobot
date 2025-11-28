# ✅ Чеклист розгортання в Supabase

**Пункти 3.1, 3.2, 3.3 - повна міграція**

---

## 📋 Підготовка (5 хв)

- [ ] Є акаунт на https://supabase.com
- [ ] Створено проект в Supabase
- [ ] Є доступ до Supabase Dashboard
- [ ] Згенеровано міграційний файл (`supabase_migration.sql` існує)

**Якщо файлу немає:**
```bash
cd app/database
python generate_supabase_migration.py
```

---

## 🚀 Застосування міграції (3 хв)

### Варіант A: Через Dashboard (простіше)

- [ ] Відкрито Supabase Dashboard → SQL Editor
- [ ] Скопійовано вміст `app/database/supabase_migration.sql`
- [ ] Вставлено в SQL Editor
- [ ] Натиснуто **Run**
- [ ] Отримано "Success. No rows returned"

### Варіант B: Через Python (автоматично)

- [ ] Встановлено `pip install psycopg2-binary`
- [ ] Запущено `python app/database/apply_to_supabase.py`
- [ ] Введено параметри підключення
- [ ] Отримано "🎉 МІГРАЦІЯ ЗАВЕРШЕНА УСПІШНО!"

---

## ✅ Перевірка (2 хв)

Виконати в Supabase SQL Editor:

```sql
-- Перевірка 1: Таблиці створені
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public';
-- Очікується: ~45
```
- [ ] Таблиць: ~45 ✅

```sql
-- Перевірка 2: Довідники заповнені
SELECT COUNT(*) FROM ref_sign_properties;      -- 12
SELECT COUNT(*) FROM ref_aspect_types;         -- 18
SELECT COUNT(*) FROM ref_configuration_types;  -- 4
SELECT COUNT(*) FROM ref_cosmogram_patterns;   -- 7
```
- [ ] Знаків: 12 ✅
- [ ] Аспектів: 18 ✅
- [ ] Конфігурацій: 4 ✅
- [ ] Паттернів: 7 ✅

```sql
-- Перевірка 3: Основні таблиці
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'natal_%'
ORDER BY table_name;
```
- [ ] Є таблиці: `natal_planets`, `natal_houses`, `natal_aspects`, `natal_configurations`, `natal_stelliums` ✅

---

## 🔧 Налаштування підключення (2 хв)

### Крок 1: Отримати параметри
Supabase Dashboard → Settings → Database → Connection string

Приклад:
```
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

### Крок 2: Оновити config.py

Відкрити `app/database/config.py`:

```python
# Supabase connection
DATABASE_URL = "postgresql://postgres:ваш-пароль@db.xxxxx.supabase.co:5432/postgres"
```

- [ ] Оновлено `DATABASE_URL` в `config.py` ✅

---

## 🧪 Тестування підключення (2 хв)

```bash
cd app

# Тест 1: Підключення
python -c "from database.connection import get_db_session; print('✅ OK' if get_db_session() else '❌ FAIL')"
```
- [ ] Підключення працює ✅

```bash
# Тест 2: Запит до БД
python -c "
from database.connection import get_db_session
from database.models import RefAspectType
db = get_db_session()
aspects = db.query(RefAspectType).all()
print(f'✅ Знайдено {len(aspects)} аспектів')
"
```
- [ ] Запити працюють ✅

```bash
# Тест 3: Повний тест
pytest tests/test_aspects_and_configurations.py -v
```
- [ ] Всі тести проходять ✅

---

## 🎯 Тестування API (5 хв)

```bash
# Запустити API
cd app/api
uvicorn main:app --reload
```
- [ ] API запущено на http://localhost:8000 ✅

**В іншому терміналі:**
```bash
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

**Перевірити відповідь:**
- [ ] Є поле `planets` ✅
- [ ] Є поле `houses` ✅
- [ ] Є поле `aspects` ✅
- [ ] Є поле `aspect_configurations` ✅
- [ ] Є поле `stelliums` ✅
- [ ] Є поле `cosmogram_pattern` ✅
- [ ] Є поле `planet_distribution` ✅

---

## 🎉 Фінальна перевірка

- [ ] БД в Supabase налаштована ✅
- [ ] Всі таблиці створені ✅
- [ ] Довідники заповнені ✅
- [ ] Підключення з Python працює ✅
- [ ] Тести проходять ✅
- [ ] API повертає повні дані ✅

---

## ✅ ГОТОВО!

Пункти 3.1, 3.2, 3.3 повністю розгорнуті в Supabase! 🚀

**Наступні кроки:**
- Розгорнути API на Render/Vercel/Railway
- Підключити фронтенд
- Додати автентифікацію через Supabase Auth

---

## 📚 Документація

- [Детальна інструкція](database/SUPABASE_SETUP.md)
- [Швидкий старт](database/SUPABASE_QUICK_START.md)
- [Звіт про реалізацію 3.3](IMPLEMENTATION_REPORT_3.3.md)


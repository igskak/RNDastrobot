# Інструкція з налаштування Supabase

**Дата:** 2025-11-27  
**Час виконання:** ~5 хвилин

---

## 📋 Що буде зроблено

Застосування повної схеми БД та seeds для пунктів 3.1, 3.2, 3.3:
- ✅ Створення всіх таблиць (45+ таблиць)
- ✅ Заповнення довідників (знаки, аспекти, конфігурації, паттерни)
- ✅ Налаштування індексів та зв'язків

---

## 🚀 Крок 1: Відкрити Supabase Dashboard

1. Перейти на https://supabase.com/dashboard
2. Вибрати свій проект
3. В лівому меню вибрати **SQL Editor**

---

## 📝 Крок 2: Виконати міграцію

### Варіант A: Виконати весь файл одразу (рекомендовано)

1. Відкрити файл `app/database/supabase_migration.sql`
2. Скопіювати **весь** вміст файлу (Cmd+A, Cmd+C)
3. В Supabase SQL Editor:
   - Натиснути **New query**
   - Вставити скопійований SQL (Cmd+V)
   - Натиснути **Run** (або Cmd+Enter)

**Очікуваний результат:**
```
Success. No rows returned
```

### Варіант B: Виконати по частинах

Якщо виникають помилки при виконанні всього файлу:

#### Частина 1: Схема (CREATE TABLE)
1. Скопіювати з файлу розділ **ЧАСТИНА 1: СХЕМА БД**
2. Виконати в SQL Editor
3. Перевірити, що таблиці створені

#### Частина 2: Seeds (INSERT INTO)
1. Скопіювати з файлу розділ **ЧАСТИНА 2: SEEDS**
2. Виконати в SQL Editor
3. Перевірити, що дані вставлені

---

## ✅ Крок 3: Перевірка

Виконати в SQL Editor:

```sql
-- Перевірити кількість таблиць
SELECT COUNT(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'public';
-- Має бути ~45 таблиць

-- Перевірити довідники
SELECT COUNT(*) FROM ref_sign_properties;      -- має бути 12
SELECT COUNT(*) FROM ref_aspect_types;         -- має бути 18
SELECT COUNT(*) FROM ref_configuration_types;  -- має бути 4
SELECT COUNT(*) FROM ref_cosmogram_patterns;   -- має бути 7

-- Перевірити основні таблиці
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'natal_%'
ORDER BY table_name;
```

**Очікувані результати:**
- Таблиць: ~45
- Знаків: 12
- Аспектів: 18
- Конфігурацій: 4
- Паттернів: 7

---

## 🔧 Крок 4: Налаштування підключення

Після успішного застосування міграції, оновити параметри підключення в `app/database/config.py`:

```python
# Supabase connection settings
SUPABASE_HOST = "db.xxxxxxxxxxxxxx.supabase.co"
SUPABASE_PORT = 5432
SUPABASE_DB = "postgres"
SUPABASE_USER = "postgres"
SUPABASE_PASSWORD = "your-password-here"

# Connection string
DATABASE_URL = f"postgresql://{SUPABASE_USER}:{SUPABASE_PASSWORD}@{SUPABASE_HOST}:{SUPABASE_PORT}/{SUPABASE_DB}"
```

**Де знайти параметри:**
1. Supabase Dashboard → Settings → Database
2. Скопіювати **Connection string** (URI)
3. Або використати окремі параметри (Host, Port, User, Password)

---

## 🧪 Крок 5: Тестування підключення

```bash
cd app

# Тест підключення
python -c "from database.connection import get_db_session; print('✅ DB OK' if get_db_session() else '❌ DB FAIL')"

# Тест запиту
python -c "
from database.connection import get_db_session
from database.models import RefAspectType

db = get_db_session()
aspects = db.query(RefAspectType).all()
print(f'✅ Знайдено {len(aspects)} типів аспектів')
"
```

**Очікуваний результат:**
```
✅ DB OK
✅ Знайдено 18 типів аспектів
```

---

## 🐛 Troubleshooting

### Помилка: "relation already exists"

**Причина:** Таблиці вже створені раніше

**Рішення:**
```sql
-- Видалити всі таблиці (ОБЕРЕЖНО!)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Потім виконати міграцію знову
```

### Помилка: "duplicate key value"

**Причина:** Seeds вже застосовані

**Рішення:**
```sql
-- Очистити довідники
TRUNCATE ref_sign_properties CASCADE;
TRUNCATE ref_aspect_types CASCADE;
TRUNCATE ref_configuration_types CASCADE;
TRUNCATE ref_cosmogram_patterns CASCADE;

-- Потім виконати тільки ЧАСТИНУ 2 (seeds)
```

### Помилка підключення з Python

**Рішення:**
1. Перевірити параметри в `config.py`
2. Перевірити, що IP адреса дозволена в Supabase (Settings → Database → Connection pooling)
3. Використати connection pooler замість прямого підключення

---

## 📚 Додаткова інформація

- **Міграційний файл:** `app/database/supabase_migration.sql`
- **Генератор міграції:** `app/database/generate_supabase_migration.py`
- **Схема БД:** `app/database/schema/*.sql`
- **Seeds:** `app/database/seeds/*.sql`

---

## ✅ Готово!

Після виконання всіх кроків:
- ✅ БД повністю налаштована
- ✅ Всі таблиці створені
- ✅ Довідники заповнені
- ✅ Готово до використання API

Можна переходити до тестування пунктів 3.1, 3.2, 3.3! 🎉


# Швидкий старт Supabase

**2 способи застосування схеми та seeds**

> ✅ **ОНОВЛЕНО 2025-11-27:** Виправлено помилки з командами `\i` та `GRANT`
> Файл `supabase_migration.sql` тепер повністю сумісний з Supabase!

---

## 🎯 Варіант 1: Через Supabase Dashboard (рекомендовано)

### Крок 1: Відкрити SQL Editor
1. https://supabase.com/dashboard
2. Вибрати проект
3. SQL Editor → New query

### Крок 2: Виконати міграцію
1. Відкрити файл `supabase_migration.sql`
2. Скопіювати весь вміст (Cmd+A, Cmd+C)
3. Вставити в SQL Editor (Cmd+V)
4. Натиснути **Run** (Cmd+Enter)

### Крок 3: Перевірка
```sql
SELECT COUNT(*) FROM ref_aspect_types;  -- має бути 18
```

**Час виконання:** 2-3 хвилини

---

## 🤖 Варіант 2: Автоматично через Python

### Крок 1: Встановити psycopg2
```bash
pip install psycopg2-binary
```

### Крок 2: Запустити скрипт
```bash
cd app/database
python apply_to_supabase.py
```

### Крок 3: Ввести параметри
```
Host: db.xxxxx.supabase.co
Port: 5432
Database: postgres
User: postgres
Password: ваш-пароль
```

**Параметри знайти в:**
Supabase Dashboard → Settings → Database → Connection string

**Час виконання:** 1-2 хвилини

---

## ✅ Після застосування

### Оновити config.py
```python
# app/database/config.py
DATABASE_URL = "postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres"
```

### Протестувати
```bash
cd app
python -c "from database.connection import get_db_session; print('OK' if get_db_session() else 'FAIL')"
```

---

## 📊 Що буде створено

- **45+ таблиць** для натальних карт
- **12 знаків** зодіаку з властивостями
- **18 типів аспектів** (5 мажорних + 13 мінорних)
- **4 типи конфігурацій** (Grand Trine, T-Square, Grand Cross, Yod)
- **7 фігур Джонса** (Bundle, Bowl, Bucket, Locomotive, Seesaw, Splay, Splash)

---

## 🐛 Якщо щось не так

**Таблиці вже існують:**
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
-- Потім виконати міграцію знову
```

**Помилка підключення:**
- Перевірити IP в Supabase Settings → Database → Connection pooling
- Додати свій IP до whitelist

---

## 📚 Детальна інструкція

Дивись: [SUPABASE_SETUP.md](SUPABASE_SETUP.md)


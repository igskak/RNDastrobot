# 🚀 Быстрый деплой на Render - 5 минут

## ✅ Шаг 1: Закоммитить изменения (1 мин)

```bash
git add .
git commit -m "Add Render deployment configuration"
git push origin master
```

## ✅ Шаг 2: Создать сервис на Render (2 мин)

### Вариант A: Через Blueprint (автоматически)

1. Открыть https://dashboard.render.com/
2. Нажать **"New +"** → **"Blueprint"**
3. Выбрать репозиторий: `igskak/RNDastrobot`
4. Render найдёт `render.yaml` и создаст сервис автоматически

### Вариант B: Вручную

1. Открыть https://dashboard.render.com/
2. Нажать **"New +"** → **"Web Service"**
3. Подключить репозиторий: `igskak/RNDastrobot`
4. Настроить:
   - **Name:** `astrobot`
   - **Region:** `Frankfurt (EU Central)`
   - **Branch:** `master`
   - **Runtime:** `Python 3`
   - **Build Command:** `./build.sh`
   - **Start Command:** `./start.sh`
   - **Plan:** `Free`

## ✅ Шаг 3: Настроить переменные окружения (2 мин)

В Render Dashboard → Environment → добавить:

### Обязательные переменные:

```bash
# Database (Supabase)
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
DB_HOST=db.xxxxx.supabase.co
DB_PASSWORD=YOUR_PASSWORD

# Supabase API
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_key_here
```

### Где взять данные Supabase:

1. Перейти на https://app.supabase.com/
2. Выбрать проект
3. **Settings → Database:**
   - Connection string → скопировать `DATABASE_URL`
   - Host → скопировать `DB_HOST`
   - Password → ваш пароль
4. **Settings → API:**
   - Project URL → скопировать `SUPABASE_URL`
   - Project API keys → скопировать `anon` и `service_role`

## ✅ Готово!

После деплоя приложение будет доступно:

- **Главная:** https://steliara.com/
- **API Docs:** https://steliara.com/api/docs
- **Health:** https://steliara.com/health

---

## 📊 Что включено в деплой:

- ✅ FastAPI backend (Python)
- ✅ Frontend (HTML/CSS/JS)
- ✅ Swiss Ephemeris (186 файлов эфемерид)
- ✅ Proserpina ephemeris
- ✅ Supabase PostgreSQL
- ✅ Автоматическая сборка при push

---

## 🔧 Если что-то не работает:

1. **Проверить логи:** Render Dashboard → Logs
2. **Проверить переменные:** Render Dashboard → Environment
3. **Проверить Supabase:** https://app.supabase.com/ → проект активен?

---

## 📝 Важно:

- **Free tier:** сервис засыпает после 15 мин неактивности
- **Первый запрос:** может занять 30-60 сек после сна
- **Автодеплой:** включён для ветки `master`

Подробная документация: `RENDER_DEPLOYMENT.md`


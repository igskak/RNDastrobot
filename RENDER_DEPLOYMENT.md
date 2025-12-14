# 🚀 Деплой Astrobot на Render

## 📋 Подготовка завершена

Все необходимые файлы для деплоя созданы:
- ✅ `render.yaml` - конфигурация Blueprint
- ✅ `build.sh` - скрипт сборки (исполняемый)
- ✅ `start.sh` - скрипт запуска (исполняемый)
- ✅ `app/requirements.txt` - обновлён (добавлен gunicorn)
- ✅ `.gitignore` - обновлён (включены .se1 файлы)
- ✅ `swisseph/ephe/*.se1` - 186 файлов эфемерид в git (~30 MB)
- ✅ `app/data/proserpina_ephemeris.json` - эфемериды Прозерпины
- ✅ `app/frontend/` - HTML/CSS/JS фронтенд

---

## 🎯 Способ 1: Автоматический деплой через Blueprint (Рекомендуется)

### Шаг 1: Закоммитить и запушить изменения

```bash
git add render.yaml build.sh start.sh app/requirements.txt RENDER_DEPLOYMENT.md
git commit -m "Add Render deployment configuration"
git push origin master
```

### Шаг 2: Создать сервис на Render

1. Перейти на https://dashboard.render.com/
2. Нажать **"New +"** → **"Blueprint"**
3. Подключить репозиторий: `igskak/RNDastrobot`
4. Render автоматически найдёт `render.yaml` и создаст сервис

### Шаг 3: Настроить переменные окружения

В Render Dashboard → Environment → добавить:

```bash
# Database Configuration (Supabase)
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
DB_HOST=db.xxxxx.supabase.co
DB_PASSWORD=YOUR_PASSWORD

# Supabase Configuration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key
```

**Где взять данные Supabase:**
1. Перейти на https://app.supabase.com/
2. Выбрать проект
3. Settings → Database → Connection string
4. Settings → API → Project URL, anon key, service_role key

---

## 🎯 Способ 2: Ручное создание Web Service

### Шаг 1: Создать Web Service

1. Перейти на https://dashboard.render.com/
2. Нажать **"New +"** → **"Web Service"**
3. Подключить репозиторий: `igskak/RNDastrobot`

### Шаг 2: Настроить сервис

**Basic Settings:**
- **Name:** `astrobot`
- **Region:** `Frankfurt (EU Central)`
- **Branch:** `master`
- **Runtime:** `Python 3`
- **Build Command:** `./build.sh`
- **Start Command:** `./start.sh`

**Instance Type:**
- **Plan:** `Free` (или выше для production)

### Шаг 3: Добавить переменные окружения

См. список выше в Способе 1, Шаг 3.

---

## 📊 После деплоя

### Проверка работоспособности

Ваше приложение будет доступно по адресу:
```
https://astrobot.onrender.com
```

**Endpoints:**
- Главная страница: `https://astrobot.onrender.com/`
- API документация: `https://astrobot.onrender.com/api/docs`
- Health check: `https://astrobot.onrender.com/health`

### Просмотр логов

1. Render Dashboard → Ваш сервис → **Logs**
2. Проверить, что сборка прошла успешно
3. Проверить, что сервер запустился

---

## 🔧 Troubleshooting

### Проблема: Build failed

**Решение:**
1. Проверить логи сборки в Render Dashboard
2. Убедиться, что все файлы закоммичены
3. Проверить права на выполнение скриптов:
   ```bash
   chmod +x build.sh start.sh
   git add build.sh start.sh
   git commit -m "Fix script permissions"
   git push
   ```

### Проблема: Application failed to start

**Решение:**
1. Проверить переменные окружения (особенно DATABASE_URL)
2. Проверить логи запуска
3. Убедиться, что Supabase доступен

### Проблема: Database connection failed

**Решение:**
1. Проверить DATABASE_URL в переменных окружения
2. Убедиться, что Supabase проект активен
3. Проверить, что IP Render не заблокирован в Supabase

---

## 📝 Важные замечания

1. **Free tier ограничения:**
   - Сервис засыпает после 15 минут неактивности
   - Первый запрос после сна может занять 30-60 секунд
   - 750 часов в месяц (достаточно для одного сервиса)

2. **Ephemeris файлы:**
   - Файлы `swisseph/ephe/*` должны быть в репозитории
   - Проверить, что они не в `.gitignore`

3. **Логи:**
   - Логи пишутся в `/tmp/astrobot.log`
   - Доступны через Render Dashboard → Logs

4. **Автодеплой:**
   - При пуше в `master` Render автоматически пересобирает сервис
   - Можно отключить в Settings → Auto-Deploy

---

## 🎉 Готово!

После успешного деплоя ваше приложение будет доступно 24/7 на Render!


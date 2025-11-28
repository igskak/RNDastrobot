# 🚀 Швидкий старт API

## ✅ НАЙПРОСТІШИЙ СПОСІБ

```bash
cd /Users/ihorskakovskyi/RNDastro/swisseph/app
./start_api.sh
```

**Готово!** Скрипт автоматично:
- Активує правильне venv
- Встановить PYTHONPATH
- Запустить API через uvicorn

---

## 📖 Альтернативні способи

### Варіант 1: Через uvicorn (рекомендовано)

```bash
# Активувати venv
source /Users/ihorskakovskyi/RNDastro/swisseph/.venv/bin/activate

# Запустити з кореня проекту
cd /Users/ihorskakovskyi/RNDastro/swisseph
uvicorn app.api.main:app --reload --host 0.0.0.0 --port 8000
```

### Варіант 2: Через Python з PYTHONPATH

```bash
# Активувати venv
source /Users/ihorskakovskyi/RNDastro/swisseph/.venv/bin/activate

# Встановити PYTHONPATH
export PYTHONPATH=/Users/ihorskakovskyi/RNDastro/swisseph:$PYTHONPATH

# Запустити
cd /Users/ihorskakovskyi/RNDastro/swisseph/app/api
python main.py
```

---

## 🎯 Рекомендація

**Використовуй `./start_api.sh`** - це найпростіший спосіб!

---

## 📝 Після запуску

Коли API запуститься, ти побачиш:

```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345] using WatchFiles
INFO:     Started server process [12346]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

Тоді відкрий в браузері:
- **Swagger UI:** http://localhost:8000/api/docs
- **ReDoc:** http://localhost:8000/api/redoc
- **Health check:** http://localhost:8000/health

---

## 🐛 Якщо все ще не працює

Перевір, яке venv активоване:

```bash
which python
```

Має бути:
```
/Users/ihorskakovskyi/RNDastro/swisseph/.venv/bin/python
```

Якщо показує інше - деактивуй і активуй правильне venv.


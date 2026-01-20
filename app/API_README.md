# Astrobot API - Документация

API для расчёта натальных карт и астрологического анализа.

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
# Из корня проекта (swisseph/)
source .venv/bin/activate && pip install -r app/requirements.txt
```

### 2. Настройка окружения

Скопируйте `.env.example` в `.env`:

```bash
cp .env.example .env
```

### 3. Запуск сервера

```bash
# Из корня проекта (swisseph/)
bash app/start_api.sh
```

API: `http://localhost:8000`
Swagger: `http://localhost:8000/api/docs`
Health: `http://localhost:8000/health`

## 📚 API Endpoints

### POST /api/v1/natal/calculate

Расчёт натальной карты (с опциональным сохранением в БД).

**Query Parameters:**
- `save_to_db` (boolean, optional): Сохранить результат в БД. Default: `false`

**Request:**

```json
{
  "date": "1990-03-15",
  "time": "14:30:00",
  "timezone": "America/New_York",
  "place": "New York, NY, USA",
  "house_system": "P"
}
```

**Response:** Полная натальная карта с планетами, домами, углами, специальными точками и конфигурациями.

Если `save_to_db=true`, в ответе будет добавлено поле `user_id` (UUID).

**Пример с сохранением:**

```bash
curl -X POST "http://localhost:8000/api/v1/natal/calculate?save_to_db=true" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "1990-03-15",
    "time": "14:30:00",
    "timezone": "America/New_York",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "house_system": "P"
  }'
```

### GET /api/v1/natal/{user_id}

Получить сохранённую натальную карту из БД.

**Path Parameters:**
- `user_id` (UUID): ID пользователя

**Response:** Полная натальная карта (аналогично POST endpoint).

**Пример:**

```bash
curl "http://localhost:8000/api/v1/natal/16d0e329-3cb5-4b56-a0b0-bfff8bea1795"
```

## 🔧 Конфигурация

### Системы домов
- `P` - Placidus (по умолчанию)
- `K` - Koch
- `W` - Whole Sign

### Специальные точки
- **TrueNorthNode/TrueSouthNode** - Истинные Лунные узлы
- **BlackMoon** - Чёрная Луна (Лилит, истинная осцилирующая)
- **WhiteMoon** - Белая Луна (Селена = Лилит + 180°)
- **Fortune** - Колесо Фортуны
- **Vertex** - Вертекс
- **Chiron** - Хирон

### Конфигурации
- **FateCross** - Крест Судьбы (4 точки квадратуры к оси узлов)

## 🧪 Тестирование

```bash
pytest app/tests/
```


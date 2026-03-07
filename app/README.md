# Natal Chart Calculator Applications

This directory contains natal chart calculation programs built on the Swiss Ephemeris library.

## 🆕 Latest Updates

### Auth + Multi-tenant (2026-03-06)
- Added astrologer authentication with server-side cookie sessions.
- Added strict tenant isolation for all client (`user_id`) endpoints.
- Added Google OAuth exchange endpoint via Supabase token validation (`/api/v1/auth/google`).
- Added audit and auth session persistence (`audit_events`, `auth_sessions`).
- Added frontend login page (`/login.html`) with email/password + Google button.

### Frontend: Полная натальная карта (2026-01-04)
- ✅ Новая страница `/natal-full.html` — табличное отображение полной натальной карты
- ✅ Секции: Планеты, Дома, Аспекты, Конфигурации, Стеллиумы, Специальные точки
- ✅ Адаптивный дизайн с цветовым кодированием (достоинства, аспекты)
- ✅ Бейджи для особенностей планет (ретро, элевация, критические градусы)
- ✅ Исправлено: добавлены поля `ruler_in_house`, `planets_in_house`, `ruled_houses` при загрузке из БД

### Пункт 3.3 реалізовано (2025-11-27)
**Етап 2 - обчислення похідних:**
- ✅ Розрахунок аспектів між планетами, спецточками та кутами
- ✅ Виявлення аспектних конфігурацій (Grand Trine, T-Square, Grand Cross, Yod)
- ✅ Визначення стеллиумів по знаках та будинках
- ✅ Аналіз розподілу планет та визначення фігури Джонса

📖 Детальна інформація:
- [Звіт про реалізацію](IMPLEMENTATION_REPORT_3.3.md)
- [Інструкція з налаштування](SETUP_GUIDE_3.3.md)

## Programs

### natal_chart
Text output program with human-readable formatted output.
- Complete planetary positions, houses, and angles
- Perfect for terminal use and quick viewing

### natal_chart_json
JSON output program for easy integration.
- Structured JSON format
- Ideal for web apps and APIs

## Quick Start

```bash
# Build the applications
cd ..
make app

# Run with default data (New York, March 15, 1990, 14:30 UT)
./bin/natal_chart

# Run with your birth data
# Format: day month year hour latitude longitude "location" house_system
./bin/natal_chart 15 3 1990 14.5 40.7128 -74.0060 "New York" P

# Get JSON output
./bin/natal_chart_json 15 3 1990 14.5 40.7128 -74.0060 "New York" P
```

## Parameters

- **day, month, year** - Birth date
- **hour** - Birth time in decimal hours UT (e.g., 14.5 = 14:30)
- **latitude** - Geographic latitude in decimal degrees (North positive, South negative)
- **longitude** - Geographic longitude in decimal degrees (East positive, West negative)
- **location** - Place name (in quotes)
- **house_system** - House system code:
  - `P` - Placidus (default)
  - `K` - Koch
  - `O` - Porphyrius
  - `R` - Regiomontanus
  - `C` - Campanus
  - `E` - Equal
  - `W` - Whole Sign

## Features

✅ All major planets (Sun through Pluto)  
✅ Lunar Nodes (Mean and True)  
✅ Chiron  
✅ 12 House cusps with multiple house systems  
✅ Ascendant, MC, ARMC, Vertex  
✅ Retrograde detection  
✅ Zodiac sign positions  
✅ Text and JSON output formats  

## Example Output (JSON)

```json
{
  "birth_data": {
    "date": "1990-03-15",
    "time_ut": "14.50",
    "location": "New York, NY, USA",
    "latitude": 40.712800,
    "longitude": -74.006000,
    "house_system": "P"
  },
  "angles": {
    "ascendant": { "longitude": 98.183333, "sign": "Gemini" },
    "mc": { "longitude": 313.957417, "sign": "Aquarius" }
  },
  "planets": [
    {
      "name": "Sun",
      "longitude": 354.743889,
      "sign": "Pisces",
      "house": 11,
      "retrograde": false
    }
  ]
}
```

## Building from Source

```bash
# From the app directory
make

# Or from the project root
cd ..
make app

# Clean build
make clean
```

## Dependencies

Requires the Swiss Ephemeris library to be built first. The Makefile handles this automatically.

## Auth setup (dev)

```bash
# 1) Apply DB migration
python app/apply_migration.py 021_add_multi_tenant_auth.sql

# 2) Create first local astrologer (dev-only endpoint)
# (requires ENABLE_DEV_BOOTSTRAP=true and localhost request)
curl -X POST http://localhost:8000/api/v1/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"email":"astro@example.com","password":"password123"}'

# 3) Run API
bash app/start_api.sh

# 4) Run backend tests (including auth + tenant)
pytest -q app/tests/test_auth_tenant.py app/tests/test_api_i18n.py app/tests/test_natal_karmic_analysis_api.py app/tests/test_ingresses_api.py

# 5) Rebuild frontend bundles
npm --prefix app run build:frontend
```

Supabase redirect URL examples:
- Dev: `http://localhost:8000/login.html?oauth=callback`
- Prod: `https://YOUR_DOMAIN/login.html?oauth=callback`

## Source Files

- `src/natal_chart.c` - Text output version
- `src/natal_chart_json.c` - JSON output version

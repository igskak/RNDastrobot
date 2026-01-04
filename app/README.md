# Natal Chart Calculator Applications

This directory contains natal chart calculation programs built on the Swiss Ephemeris library.

## 🆕 Latest Updates

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

## Source Files

- `src/natal_chart.c` - Text output version
- `src/natal_chart_json.c` - JSON output version


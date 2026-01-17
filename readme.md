# Swiss Ephemeris Project

This project combines the Swiss Ephemeris astronomical calculation library with custom natal chart calculation applications.

## Recent Updates

### Chat with OpenAI Agent (2026-01-17)
- **Added**: Chat widget on natal chart page (`natal-full.html`)
- **Features**:
  - Minimalist design matching application style
  - Collapsible/expandable interface
  - Integration with OpenAI Workflow API (Agent Builder)
  - Automatic chart data injection from sessionStorage
  - Thread-based conversation history
- **Architecture**:
  - **Orchestrator Agent**: Routes requests to specialized agents
  - **Psychological Agent**: Analyzes psychological profile using 7 classical planets
  - **General Agent**: Handles other astrology questions
- **Backend**: `POST /api/v1/chat/message` endpoint
- **Frontend**: `js/chat.js` + `css/chat.css`
- **Configuration**: `OPENAI_WORKFLOW_ID` in `.env`

### Planet Orbs Update (2025-12-07)
- **Updated**: Planet orbs according to Alyona's professional astrology table
- **Changes**:
  - Septener planets (Mercury-Saturn): Sextile/Square/Trine **8° → 5°**
  - Fictitious points (Nodes, BlackMoon, WhiteMoon): all major aspects → **3°**
  - Pluto Conjunction: **3° → 5°**
- **Rule**: "If planets have different orbs - use the larger one"
- **Files**: `app/database/seeds/02b_planet_orbs.sql`, migration script created
- **Details**: See `ORBS_UPDATE_SUMMARY.md` for complete changes

### Proserpina (Прозерпина) Support
- **Added**: Proserpina calculation using linear interpolation method (школа Михаила Левина)
- **Method**: Tabular ephemeris with linear interpolation between January 1st values
- **Speed**: ~0.54135° per year (32.48 arc minutes per year)
- **Cycle**: ~665 years (full circle)
- **Data**: Ephemeris table for years 1900-2100 in `app/data/proserpina_ephemeris.json`
- **Integration**: Proserpina appears in planets list (ID=1000) alongside standard planets

### Part of Fortune (Парс Фортуны) Calculation
- **Formula**: Classical ZET-compatible day/night switching
  - **Day chart** (Sun above horizon): `ASC + Moon - Sun`
  - **Night chart** (Sun below horizon): `ASC + Sun - Moon`
- **Day/Night Determination**:
  - **Normal latitudes** (|lat| < 60°): By house position (houses 7-12 = day, 1-6 = night)
  - **Polar latitudes** (|lat| ≥ 60°): By astronomical Sun altitude using Swiss Ephemeris `swe_azalt()`
- **Reason**: At extreme northern/southern latitudes, house-based day/night determination fails due to polar day/night phenomena
- **Accuracy**: Matches ZET astrology software within 10-15 arc seconds for all latitudes

## Project Structure

```
swisseph/                    # Root project directory
├── swisseph/               # Swiss Ephemeris library
│   ├── src/               # Swiss Ephemeris C source files
│   ├── include/           # Swiss Ephemeris headers
│   ├── ephe/              # Ephemeris data files
│   ├── doc/               # Swiss Ephemeris documentation
│   ├── contrib/           # Contributed code
│   ├── setest/            # Swiss Ephemeris tests
│   ├── windows/           # Windows-specific files
│   ├── bin/               # Compiled Swiss Ephemeris tools
│   └── README.md          # Swiss Ephemeris documentation
├── app/                    # Natal chart applications
│   ├── src/               # Application source code
│   ├── bin/               # Compiled applications
│   └── README.md          # Application documentation
├── Makefile               # Root build system
└── README.md              # This file
```

## Quick Start

```bash
# Build everything
make all

# Run natal chart calculator (text output)
./app/bin/natal_chart

# Run natal chart calculator (JSON output)
./app/bin/natal_chart_json

# With custom birth data
./app/bin/natal_chart 15 3 1990 14.5 40.7128 -74.0060 "New York" P
```

## Building

```bash
# Build everything (library + applications)
make all

# Build only the Swiss Ephemeris library
make swisseph

# Build only the applications
make app

# Run tests
make test

# Clean all build artifacts
make clean

# Show help
make help
```

## Components

### Swiss Ephemeris Library
High-precision astronomical calculation library developed by Dieter Koch and Alois Treindl.
- Planetary positions with JPL precision
- House calculations
- Fixed stars
- Eclipses and planetary phenomena
- See `swisseph/README.md` for detailed documentation

### Natal Chart Applications
Custom applications for astrological natal chart calculations:
- **natal_chart** - Human-readable text output
- **natal_chart_json** - JSON format for integration
- See `app/README.md` for usage details

## Requirements

- C compiler (gcc, clang, or compatible)
- Make build system
- Ephemeris data files (included in `swisseph/ephe/`)

## License

- **Swiss Ephemeris**: AGPL-3.0 (see `swisseph/LICENSE.TXT`)
- **Applications**: See `LICENSE`

## Documentation

- Swiss Ephemeris documentation: `swisseph/doc/`
- Application documentation: `app/README.md`
- Swiss Ephemeris website: https://www.astro.com/swisseph

## План имплементации характеристик

### Уровень 1 — Простые (нет зависимостей)

| # | Характеристика | Где хранить | Сервис |
|---|----------------|-------------|--------|
| 1.1 | **Критические градусы** | `NatalPlanet.critical_degrees: JSONB` | `PlanetCharacteristicsService` |
| 1.2 | **Скорость планеты** | `NatalPlanet.speed_percent: Numeric` | `PlanetCharacteristicsService` |
| 1.3 | **Сигнификатор дома** | `NatalHouse.significator: String` | `HouseService` (уже есть?) |

### Уровень 2 — Солнечные (зависят от позиции Солнца)

| # | Характеристика | Где хранить | Зависимость |
|---|----------------|-------------|-------------|
| 2.1 | **Казими** | `NatalPlanet.sun_relation: String` | Расстояние до Солнца 0–17' |
| 2.2 | **Сожжение** | ↑ `'combust'` | 17'–3° |
| 2.3 | **В лучах Солнца** | ↑ `'under_rays'` | 3°–9° |
| 2.4 | *(норма)* | ↑ `null` | >9° |

### Уровень 3 — Домовые (зависят от куспидов)

| # | Характеристика | Где хранить | Зависимость |
|---|----------------|-------------|-------------|
| 3.1 | **Включённый знак** | `NatalHouse.intercepted_sign: String` | Знак без куспидов внутри дома |
| 3.2 | **Соуправители** | `NatalHouse.co_rulers: JSONB` | Включённый знак ИЛИ 2 управителя |
| 3.3 | **Во включённом знаке** | `NatalPlanet.in_intercepted_sign: Boolean` | Зависит от 3.1 |
| 3.4 | **Элевация** | `NatalPlanet.is_elevated: Boolean` | Планета в 9/10 ближе всех к MC |

### Уровень 4 — Аспектные (зависят от аспектов)

| # | Характеристика | Где хранить | Зависимость |
|---|----------------|-------------|-------------|
| 4.1 | **Партильный аспект** | `NatalAspect.is_partile: Boolean` | orb < 1° (или 0.5°?) |
| 4.2 | **Планета в шахте** | `NatalPlanet.is_peregrine: Boolean` | Нет мажорных аспектов |
| 4.3 | **Только напряженные** | `NatalPlanet.aspect_harmony: String` | Все аспекты tense |
| 4.4 | **Только гармоничные** | ↑ `'harmonious'` / `'tense'` / `'mixed'` | Все аспекты harmonious |

### Уровень 5 — Эфемеридные (нужны данные ±дней)

| # | Характеристика | Где хранить | Зависимость |
|---|----------------|-------------|-------------|
| 5.1 | **Стационарность** | `NatalPlanet.is_stationary: Boolean` | Скорость ±2 дня |
| 5.2 | **Тип стационарности** | `NatalPlanet.stationary_type: String` | `'SR'` (перед ретро) / `'SD'` (перед директ) |

### Уровень 6 — Комплексные (агрегация)

| # | Характеристика | Где хранить | Зависимость |
|---|----------------|-------------|-------------|
| 6.1 | **Кармический статус** | `NatalPlanet.karmic_score: Numeric` | Формула из Астрокурс (все факторы) |

### Ожидают вводные:

| # | Характеристика | Что нужно |
|---|----------------|-----------|
| — | Центр цепочки | Правила построения цепочек диспозиций |

---

### Новые поля в моделях:

**NatalPlanet** (добавить):
```
speed_percent        Numeric(6,2)   -- скорость в % от средней
critical_degrees     JSONB          -- ["jubilee","anareta",...]
sun_relation         String(15)     -- 'cazimi'/'combust'/'under_rays'/null
in_intercepted_sign  Boolean        -- планета во включённом знаке
is_elevated          Boolean        -- элевация (самая высокая)
is_peregrine         Boolean        -- в шахте (без аспектов)
aspect_harmony       String(15)     -- 'harmonious'/'tense'/'mixed'
is_stationary        Boolean        -- стационарная
stationary_type      String(5)      -- 'SR'/'SD'
karmic_score         Numeric(6,2)   -- итоговый кармический балл
```

**NatalHouse** (добавить):
```
intercepted_sign     String(20)     -- включённый знак (уже есть как included_sign!)
co_rulers            JSONB          -- соуправители
significator         String(20)     -- естественный сигнификатор
```

**NatalAspect** (добавить):
```
is_partile           Boolean        -- партильный аспект
```

## Support

For Swiss Ephemeris support:
- Mailing list: https://groups.io/g/swisseph
- Email: swisseph@groups.io

## Credits

- **Swiss Ephemeris**: Dieter Koch and Alois Treindl (Astrodienst AG)
- **Natal Chart Applications**: Built on Swiss Ephemeris


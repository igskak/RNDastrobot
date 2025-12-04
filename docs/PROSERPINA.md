# Прозерпина (Proserpina) в натальной карте

## Описание

Прозерпина — фиктивная планета, используемая в школе Михаила Левина и Константина Дарагана. Поскольку Прозерпина движется крайне медленно (около 0.54135° в год), для её расчёта используется **табличный метод с линейной интерполяцией**.

## Параметры

- **Цикл**: ~665 лет (полный круг 360°)
- **Скорость**: 0.54135° в год (32.48 угловых минут в год)
- **Движение**: равномерное (Mean Motion)
- **Ретроградность**: всегда директная (не бывает ретроградной)

## Метод расчёта

### Формула линейной интерполяции

```
P_date = P_start + (P_end - P_start) × (D_passed / D_year)
```

Где:
- `P_start` — координата Прозерпины на 1 января текущего года
- `P_end` — координата на 1 января следующего года
- `D_passed` — количество дней, прошедших с начала года до момента рождения
- `D_year` — длительность года в днях (365 или 366)

### Пример расчёта

Для даты **11 сентября 1990 года**:

1. **Эфемериды**:
   - 1990-01-01: 2°15' Скорпиона (212.25°)
   - 1991-01-01: 2°47.48' Скорпиона (212.79135°)

2. **Расчёт**:
   - Дней прошло: 253.32 (с 1 января по 11 сентября)
   - Дней в году: 365 (1990 не високосный)
   - Коэффициент: 253.32 / 365 ≈ 0.694 (69.4%)

3. **Интерполяция**:
   - Годовое смещение: 212.79135° - 212.25° = 0.54135° (32.48')
   - Смещение к дате: 0.54135° × 0.694 ≈ 0.3757° (22.54')
   - Результат: 212.25° + 0.3757° = **212.6257°** = **2°37.54' Скорпиона**

## Использование в коде

### Python API

```python
from app.services.special_points_service import SpecialPointsService
from app.services.time_service import TimeService
from datetime import date, time

# Конвертируем дату в юлианский день
birth_date = date(1990, 9, 11)
birth_time = time(10, 39, 0)
timezone = "Europe/Kiev"

utc_dt, jd = TimeService.process_birth_time(birth_date, birth_time, timezone)

# Рассчитываем Прозерпину
proserpina_lon = SpecialPointsService.calculate_proserpina(jd)
print(f"Прозерпина: {proserpina_lon}°")
```

### Через NatalChartService

```python
from app.services.natal_chart_service import NatalChartService

service = NatalChartService(ephe_path='./swisseph/ephe')

chart = service.calculate_natal_chart(
    birth_date=date(1990, 9, 11),
    birth_time=time(10, 39, 0),
    timezone="Europe/Kiev",
    latitude=50.0,
    longitude=36.25,
    house_system="P"
)

# Прозерпина будет в списке планет
proserpina = next(p for p in chart['planets'] if p['name'] == 'Proserpina')
print(proserpina)
```

### HTTP API

```bash
curl -X POST http://localhost:8000/api/v1/natal-chart \
  -H "Content-Type: application/json" \
  -d '{
    "date": "1990-09-11",
    "time": "10:39:00",
    "timezone": "Europe/Kiev",
    "latitude": 50.0,
    "longitude": 36.25,
    "house_system": "P"
  }'
```

Прозерпина будет в массиве `planets` в ответе.

## Файлы эфемерид

Эфемериды Прозерпины хранятся в файле `app/data/proserpina_ephemeris.json`.

Формат:
```json
{
  "1990": {
    "longitude": 212.25,
    "sign": "Scorpio",
    "formatted": "2°15.00' Scorpio"
  },
  "1991": {
    "longitude": 212.79135,
    "sign": "Scorpio",
    "formatted": "2°47.48' Scorpio"
  }
}
```

Диапазон: **1900-2100** (201 год)

## Генерация эфемерид

Для регенерации эфемерид (например, для расширения диапазона лет):

```bash
python scripts/generate_proserpina_ephemeris.py
```

## Тестирование

### Базовый тест
```bash
python scripts/test_proserpina.py
```

### Детальный тест с промежуточными значениями
```bash
python scripts/test_proserpina_detailed.py
```

### Тест через NatalChartService
```bash
python scripts/test_natal_chart_with_proserpina.py
```

### Тест через HTTP API
```bash
# Сначала запустите сервер
python -m uvicorn app.api.main:app --reload

# В другом терминале
python scripts/test_api_proserpina.py
```

## Точность

Метод линейной интерполяции даёт точность **±1 угловая минута** для дат в пределах одного года. Это достаточно для астрологических целей, учитывая медленное движение Прозерпины.

## Источники

- Школа Михаила Левина
- Константин Дараган (классические постсоветские эфемериды)
- Метод табличной интерполяции для медленных фиктивных точек


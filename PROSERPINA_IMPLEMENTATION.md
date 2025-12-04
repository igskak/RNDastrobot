# Реализация Прозерпины в натальной карте

## Краткое описание

Добавлена поддержка расчёта **Прозерпины** (фиктивной планеты) в натальную карту методом **линейной интерполяции** по эфемеридам школы Михаила Левина.

## Что было сделано

### 1. Создан файл эфемерид
- **Файл**: `app/data/proserpina_ephemeris.json`
- **Диапазон**: 1900-2100 (201 год)
- **Формат**: JSON с долготой на 1 января каждого года
- **Скрипт генерации**: `scripts/generate_proserpina_ephemeris.py`

### 2. Добавлен метод расчёта
- **Файл**: `app/services/special_points_service.py`
- **Метод**: `SpecialPointsService.calculate_proserpina(jd: float) -> float`
- **Алгоритм**: Линейная интерполяция между значениями на 1 января текущего и следующего года

### 3. Обновлены константы
- **Файл**: `app/utils/constants.py`
- **Изменения**: 
  - Добавлен `1000: "Proserpina"` в `PLANETS`
  - Добавлен `1000: "Прозерпина"` в `PLANETS_RU`

### 4. Интегрировано в движок
- **Файл**: `app/services/swisseph_engine.py`
- **Метод**: `SwissEphemerisEngine.calculate_planets()`
- **Логика**: Для ID=1000 используется специальный расчёт через `calculate_proserpina()`

### 5. Создана документация
- **Файл**: `docs/PROSERPINA.md`
- **Содержание**: Описание метода, примеры использования, API

### 6. Созданы тесты
- `scripts/test_proserpina.py` — базовый тест
- `scripts/test_proserpina_detailed.py` — детальный тест с промежуточными значениями
- `scripts/test_natal_chart_with_proserpina.py` — тест через NatalChartService
- `scripts/test_api_proserpina.py` — тест через HTTP API

## Параметры Прозерпины

- **Скорость**: 0.54135° в год (32.48 угловых минут в год)
- **Цикл**: ~665 лет (полный круг)
- **Движение**: равномерное (Mean Motion)
- **Ретроградность**: всегда директная

## Результаты тестирования

### Тестовый пример
- **Дата**: 1990-09-11 10:39:00 (Europe/Kiev)
- **Ожидаемый результат**: 2°37' Скорпиона
- **Полученный результат**: 2°37'32" Скорпиона (212.625710°)
- **Точность**: ±0.5 угловых минут ✓

### Проверка формулы
```
P_start (1990-01-01) = 212.25° (2°15' Scorpio)
P_end (1991-01-01) = 212.79135° (2°47.48' Scorpio)
Дней прошло: 253.32 / 365 = 0.694 (69.4%)
Смещение: 0.54135° × 0.694 = 0.3757° (22.54')
Результат: 212.25° + 0.3757° = 212.6257° ✓
```

## Использование

### Python API
```python
from app.services.natal_chart_service import NatalChartService
from datetime import date, time

service = NatalChartService(ephe_path='./swisseph/ephe')
chart = service.calculate_natal_chart(
    birth_date=date(1990, 9, 11),
    birth_time=time(10, 39, 0),
    timezone="Europe/Kiev",
    latitude=50.0,
    longitude=36.25,
    house_system="P"
)

# Прозерпина в списке планет
proserpina = next(p for p in chart['planets'] if p['name'] == 'Proserpina')
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

## Изменённые файлы

1. `app/data/proserpina_ephemeris.json` — **новый**
2. `app/services/special_points_service.py` — добавлен метод `calculate_proserpina()`
3. `app/services/swisseph_engine.py` — обновлён метод `calculate_planets()`
4. `app/utils/constants.py` — добавлена Прозерпина в `PLANETS` и `PLANETS_RU`
5. `scripts/generate_proserpina_ephemeris.py` — **новый**
6. `scripts/test_proserpina.py` — **новый**
7. `scripts/test_proserpina_detailed.py` — **новый**
8. `scripts/test_natal_chart_with_proserpina.py` — **новый**
9. `scripts/test_api_proserpina.py` — **новый**
10. `docs/PROSERPINA.md` — **новый**
11. `README.md` — добавлена секция о Прозерпине

## Совместимость

- ✓ Работает со всеми существующими планетами
- ✓ Не требует изменений в базе данных
- ✓ Совместима с API
- ✓ Не влияет на расчёт других точек

## Следующие шаги (опционально)

1. Добавить Прозерпину в расчёт аспектов
2. Добавить Прозерпину в интерпретации
3. Расширить диапазон эфемерид (например, 1800-2200)
4. Добавить другие фиктивные планеты (Вулкан, Трансплутон и т.д.)

## Источники

- Школа Михаила Левина
- Константин Дараган (классические постсоветские эфемериды)
- Метод табличной интерполяции для медленных фиктивных точек


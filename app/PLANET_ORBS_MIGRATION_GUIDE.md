# 🚀 Руководство по миграции на систему индивидуальных орбисов

## Обзор изменений

Реализована профессиональная система расчёта аспектов с индивидуальными орбисами для каждой планеты.

### Что изменилось:

1. ✅ Создана таблица `ref_planet_orbs` с индивидуальными орбисами
2. ✅ Удалены 4 минорных аспекта (Vigintile, Semi_Nonagon, Binonagon, Sentagon)
3. ✅ Обновлён `AspectService` для использования нового алгоритма
4. ✅ Добавлена модель `RefPlanetOrb` в SQLAlchemy
5. ✅ Реализовано правило: "берём меньший орбис"

---

## 📋 Пошаговая инструкция

### Шаг 1: Резервное копирование базы данных

```bash
# PostgreSQL
pg_dump -U your_user -d your_database > backup_before_orbs_migration.sql

# Или через psql
psql -U your_user -d your_database -c "\copy (SELECT * FROM ref_aspect_types) TO 'aspect_types_backup.csv' CSV HEADER"
```

### Шаг 2: Применить миграцию схемы

```bash
# Вариант A: Через psql
psql -U your_user -d your_database -f app/database/schema/03a_planet_orbs.sql

# Вариант B: Через Python
python -c "
from app.database.connection import get_db_session
with get_db_session() as db:
    with open('app/database/schema/03a_planet_orbs.sql', 'r') as f:
        db.execute(f.read())
    db.commit()
"
```

### Шаг 3: Загрузить данные орбисов

```bash
# Вариант A: Через psql
psql -U your_user -d your_database -f app/database/seeds/02b_planet_orbs.sql

# Вариант B: Через Python
python -c "
from app.database.connection import get_db_session
with get_db_session() as db:
    with open('app/database/seeds/02b_planet_orbs.sql', 'r') as f:
        db.execute(f.read())
    db.commit()
"
```

### Шаг 4: Проверить миграцию

```bash
# Запустить тесты
python app/test_planet_orbs.py
```

**Ожидаемый результат:**
```
✅ Всего записей орбисов: 294
✅ Уникальных планет/точек: 21
✅ Уникальных типов аспектов: 14
✅ Vigintile успешно удалён
✅ Semi_Nonagon успешно удалён
✅ Binonagon успешно удалён
✅ Sentagon успешно удалён
```

### Шаг 5: Пересчитать аспекты для существующих пользователей

```python
from app.database.connection import get_db_session
from app.services.aspect_service import AspectService
from app.database.models import User

with get_db_session() as db:
    aspect_service = AspectService(db)
    
    # Получить всех пользователей
    users = db.query(User).all()
    
    for user in users:
        print(f"Пересчёт аспектов для пользователя {user.user_id}...")
        try:
            aspects = aspect_service.calculate_aspects(user.user_id)
            print(f"  ✅ Найдено {len(aspects)} аспектов")
        except Exception as e:
            print(f"  ❌ Ошибка: {e}")
```

---

## 🔍 Проверка результатов

### Проверка 1: Таблица создана

```sql
SELECT COUNT(*) FROM ref_planet_orbs;
-- Ожидается: 294 записи (21 планета × 14 аспектов)
```

### Проверка 2: Исключённые аспекты удалены

```sql
SELECT aspect_type FROM ref_aspect_types 
WHERE aspect_type IN ('Vigintile', 'Semi_Nonagon', 'Binonagon', 'Sentagon');
-- Ожидается: 0 строк
```

### Проверка 3: Примеры орбисов

```sql
SELECT planet, aspect_type, orb 
FROM ref_planet_orbs 
WHERE planet IN ('Sun', 'Moon', 'Pluto', 'BlackMoon')
  AND aspect_type = 'Conjunction'
ORDER BY orb DESC;
```

**Ожидаемый результат:**
```
planet     | aspect_type  | orb
-----------+--------------+------
Sun        | Conjunction  | 12.0
Moon       | Conjunction  | 10.0
Pluto      | Conjunction  | 3.0
BlackMoon  | Conjunction  | 3.0
```

---

## 🧪 Тестирование

### Автоматические тесты

```bash
# Запустить все тесты
python app/test_planet_orbs.py

# Запустить тесты аспектов
python -m pytest app/tests/test_aspects_and_configurations.py -v
```

### Ручное тестирование

```python
from app.database.connection import get_db_session
from app.services.aspect_service import AspectService

with get_db_session() as db:
    service = AspectService(db)
    
    # Тест 1: Солнце-Луна в соединении (орбис 10°)
    orb = service._calculate_allowed_orb('Sun', 'Moon', 'Conjunction')
    assert orb == 10.0, f"Ожидалось 10.0, получено {orb}"
    print("✅ Тест 1 пройден")
    
    # Тест 2: Солнце-Плутон в соединении (орбис 3°)
    orb = service._calculate_allowed_orb('Sun', 'Pluto', 'Conjunction')
    assert orb == 3.0, f"Ожидалось 3.0, получено {orb}"
    print("✅ Тест 2 пройден")
    
    # Тест 3: Меркурий-Лилит в трине (орбис 3°)
    orb = service._calculate_allowed_orb('Mercury', 'BlackMoon', 'Trine')
    assert orb == 3.0, f"Ожидалось 3.0, получено {orb}"
    print("✅ Тест 3 пройден")
```

---

## 🔄 Откат изменений (если нужно)

### Вариант 1: Восстановление из бэкапа

```bash
psql -U your_user -d your_database < backup_before_orbs_migration.sql
```

### Вариант 2: Ручной откат

```sql
-- Удалить таблицу орбисов
DROP TABLE IF EXISTS ref_planet_orbs CASCADE;

-- Восстановить удалённые аспекты
INSERT INTO ref_aspect_types (aspect_type, exact_angle, base_orb, class, character, color) VALUES
('Vigintile', 18, 1.0, 'minor', 'neutral', 'green'),
('Semi_Nonagon', 20, 1.0, 'minor', 'neutral', 'blue'),
('Binonagon', 80, 1.0, 'minor', 'neutral', 'blue'),
('Sentagon', 100, 1.0, 'minor', 'neutral', 'blue');
```

---

## 📊 Статистика изменений

### До миграции:
- Аспектов: 18 типов
- Орбисы: единый `base_orb` для всех планет
- Точность: базовая

### После миграции:
- Аспектов: 14 типов (исключены 4 минорных)
- Орбисы: индивидуальные для каждой планеты (294 записи)
- Точность: профессиональная

---

## ⚠️ Важные замечания

1. **Обратная совместимость**: Если для планеты нет орбиса в `ref_planet_orbs`, используется `base_orb` из `ref_aspect_types`

2. **Производительность**: Орбисы кэшируются в памяти при первом обращении

3. **Пересчёт аспектов**: После миграции рекомендуется пересчитать аспекты для всех пользователей

4. **Тестирование**: Обязательно запустите тесты перед использованием в production

---

## 📚 Дополнительные ресурсы

- **Документация**: `app/PLANET_ORBS_SYSTEM.md`
- **Схема БД**: `app/database/schema/03a_planet_orbs.sql`
- **Данные**: `app/database/seeds/02b_planet_orbs.sql`
- **Тесты**: `app/test_planet_orbs.py`
- **Модель**: `app/database/models.py` → `RefPlanetOrb`
- **Сервис**: `app/services/aspect_service.py` → `AspectService`

---

## ✅ Чеклист миграции

- [ ] Создан бэкап базы данных
- [ ] Применена схема `03a_planet_orbs.sql`
- [ ] Загружены данные `02b_planet_orbs.sql`
- [ ] Запущены тесты `test_planet_orbs.py`
- [ ] Пересчитаны аспекты для существующих пользователей
- [ ] Проверена работа API
- [ ] Обновлена документация проекта


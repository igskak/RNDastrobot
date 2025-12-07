# Сводка изменений: Обновление орбисов планет

## Дата: 2025-12-05

## Что было сделано

### 1. ✅ Обновлен файл орбисов
**Файл**: `app/database/seeds/02b_planet_orbs.sql`

**Изменения**:
- **Планеты септенера** (Mercury, Venus, Mars, Jupiter, Saturn):
  - Sextile: 8.0° → **5.0°**
  - Square: 8.0° → **5.0°**
  - Trine: 8.0° → **5.0°**

- **Фиктивные точки** (TrueNorthNode, TrueSouthNode, BlackMoon, WhiteMoon):
  - Conjunction: 10.0° → **3.0°**
  - Sextile: 8.0° → **3.0°**
  - Square: 8.0° → **3.0°**
  - Trine: 8.0° → **3.0°**
  - Opposition: 10.0° → **3.0°**

### 2. ✅ Создана миграция для БД
**Файл**: `app/database/migrations/update_orbs_from_alyona.sql`

Миграция содержит UPDATE-запросы для обновления таблицы `ref_planet_orbs`.

### 3. ✅ Создан скрипт применения изменений
**Файл**: `APPLY_ORBS_UPDATE.sh`

Автоматический скрипт для применения миграции к базе данных.

### 4. ✅ Создана документация
**Файлы**:
- `ORBS_UPDATE_SUMMARY.md` - подробная документация изменений
- `CHANGES_SUMMARY.md` - краткая сводка (этот файл)
- `README.md` - обновлен раздел "Recent Updates"

## Что нужно сделать дальше

### Шаг 1: Запустить базу данных (если не запущена)
```bash
brew services start postgresql@14
# или
pg_ctl -D /usr/local/var/postgres start
```

### Шаг 2: Применить миграцию
```bash
./APPLY_ORBS_UPDATE.sh
```

Или вручную:
```bash
python3 -c "
from sqlalchemy import create_engine, text
import os

db_url = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/astrobot')
engine = create_engine(db_url)

with open('app/database/migrations/update_orbs_from_alyona.sql', 'r') as f:
    sql = f.read()

with engine.connect() as conn:
    for stmt in sql.split(';'):
        if stmt.strip() and stmt.strip().upper() not in ['BEGIN', 'COMMIT']:
            conn.execute(text(stmt))
    conn.commit()
print('✅ Migration applied successfully!')
"
```

### Шаг 3: Пересчитать аспекты (опционально)
⚠️ **Важно**: Существующие аспекты были рассчитаны со старыми орбисами.

Для пересчета можно использовать:
```python
from app.services.aspect_service import AspectService
from app.database.session import get_db
from app.database.models import User

db = next(get_db())
aspect_service = AspectService(db)

# Пересчитать для всех пользователей
users = db.query(User).all()
for user in users:
    print(f'Recalculating aspects for user {user.user_id}...')
    aspect_service.calculate_aspects(user.user_id)
```

## Источник изменений

**Таблица аспектов от Алены**: `Files from Alyona/Таблица аспектов.csv`

**Правила**:
1. Если в аспекте участвуют планеты с разными орбисами - берем больший
2. Если участвуют фиктивные планеты в аспекте берем орб 3 градуса

**Примеры**:
- Солнце - соединение - Луна: max(12, 10) = 12°
- Солнце - соединение - Лилит: max(12, 3) = 12°
- Венера - трин - Луна: max(5, 8) = 8°
- Венера - трин - Нептун: max(5, 3) = 5°

## Ожидаемые эффекты

### Положительные:
- ✅ Более точное соответствие профессиональным астрологическим стандартам
- ✅ Меньше "ложных" аспектов с широкими орбисами
- ✅ Более строгие критерии для конфигураций

### Потенциальные проблемы:
- ⚠️ Некоторые конфигурации могут исчезнуть (например, Повозки с фиктивными точками)
- ⚠️ Бисекстиль "Солнце Плутон Сатурн" не будет найден (Pluto-Saturn Sextile: 3.23° > 3.0°)
- ⚠️ Меньше аспектов между планетами септенера и фиктивными точками

## Проверка изменений

После применения миграции можно проверить орбисы:
```sql
SELECT planet, aspect_type, orb 
FROM ref_planet_orbs 
WHERE aspect_type IN ('Conjunction', 'Sextile', 'Square', 'Trine', 'Opposition')
  AND planet IN ('Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 
                 'TrueNorthNode', 'TrueSouthNode', 'BlackMoon', 'WhiteMoon')
ORDER BY aspect_type, planet;
```

## Статус

- [x] Файлы обновлены
- [x] Миграция создана
- [x] Документация создана
- [ ] Миграция применена к БД (требует запущенной БД)
- [ ] Аспекты пересчитаны (опционально)


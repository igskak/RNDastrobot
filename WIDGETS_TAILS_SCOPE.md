# Scope: оставшиеся «хвосты» по виджетам рабочего экрана

Контекст: бэкенд по всем фичам реализован и закоммичен (ветка
`claude/zealous-roentgen-0db59a`). Ниже — что осталось доделать, по задачам.
Каждый пункт самодостаточен; делать можно в любом порядке (зависимостей между
ними нет, кроме отмеченных).

## Общие соглашения проекта

- **Backend:** сервисы в `app/services/`, роуты в `app/api/routes/` (регистрируются
  в `app/api/main.py`), pytest-тесты в `app/tests/`.
- **Frontend workspace (рабочий экран):** реестр блоков — `VIEW_KEYS` /
  `NOW_VIEWS` в `app/frontend/js/forecast-new-panel-layout.js`. Блок =
  `{source, view}`, контейнер `<source><View>View` (camelCase) в
  `app/frontend/forecast-new.html`. Логика/рендеринг — `forecast-new.js`.
  Чистый layout-модуль покрыт тестами `forecast-new-panel-layout.test.js`
  и `forecast-new-panel-render.test.js` (запуск: `node frontend/js/<file>`).
- **Сборка фронта:** `cd app && npm run build:frontend` (детерминированная;
  обновляет `frontend/js/bundles`, `frontend/bundles`, asset-маркеры в `*.html`).
- **i18n:** ключи в `app/frontend/locales/{ru,uk,en}.json`. Гейты:
  `node app/scripts/check-i18n-missing-keys.cjs` ДОЛЖЕН проходить; `used-keys`
  и `hardcoded-strings` уже падают на baseline по чужим причинам — не добавляйте
  НОВЫХ нарушений.
- **Python-тесты:** удобный venv можно собрать из `app/requirements.txt` +
  `pyswisseph`; запуск: `SWISSEPH_EPHE_PATH="$PWD/swisseph/ephe" PYTHONPATH="$PWD" pytest app/tests/...`.
  Полный sqlite-сьют сейчас 219 passed.
- **Паттерн «now»-блока** (как референс для нового блока) — см. реализованные
  `lunar` и `hours`: `renderLunarBlock()` / `renderHoursBlock()` в `forecast-new.js`,
  `nowLunarView`/`nowHoursView` в html, `NOW_VIEWS` в layout.js.

---

## 1. Фронт профекций  (приоритет: высокий, объём: M)

Бэкенд готов: `GET /api/v1/profections?user_id=<uuid>&at=<iso?>` →
`{age, target_date, annual:{house,sign,lord}, monthly:{house,sign,lord,month_index}}`
(сервис `app/services/profections_service.py`).

Сделать новый workspace-блок `profections`:
- В `forecast-new-panel-layout.js`: добавить `'profections'` в `VIEW_KEYS`
  (НЕ в `NOW_VIEWS` — профекции это свойство натальной карты, **source `natal`**),
  лейбл в `VIEW_I18N` (`page.forecastNew.tabs.profections`), при желании в
  `CORNER_RECOMMENDED_VIEWS`.
- Контейнер `natalProfectionsView` в `forecast-new.html` (рядом с другими view-контейнерами).
- Рендерер в `forecast-new.js` (по образцу `renderLunarBlock`), фетчит
  `/profections?user_id=<state.userId>`; показывает: возраст, годовой
  дом/знак/управитель, месячный знак/управитель. Управители и знаки — через
  i18n (`astro.planet.<Name>`, `astro.sign.<Name>`).
- i18n ключи в 3 локалях.
- Тесты: дополнить `forecast-new-panel-layout.test.js` (валидность view,
  source natal) и `forecast-new-panel-render.test.js` (ре-хоминг контейнера).
- Пересобрать бандл.

Замечание: профекции зависят от Asc и даты рождения — блок имеет смысл только
для натальной карты (есть `state.userId`).

## 2. Отображение Vertex / EastPoint / AntiVertex  (приоритет: средний, объём: S)

Данные уже в payload: `chart.angles.Vertex`, `chart.angles.EastPoint`,
`chart.angles.AntiVertex` (поля `longitude/sign/degree_in_sign/degree_in_sign_formatted`).
Сейчас на фронте показываются только ASC/MC/IC/DSC.

Сделать:
- Найти рендеринг таблицы углов. В рабочем экране — `chart-data.js`
  (`ChartDataRenderer`, контейнеры `*HousesView`/angles) и/или `natal-full.js`.
  Проверить, где именно выводятся ASC/MC/DSC/IC, и добавить строки для
  Vertex / EastPoint / AntiVertex (выводить только если поле присутствует —
  для полярных широт Vertex может быть null).
- i18n названий: `astro.point.Vertex` / `EastPoint` / `AntiVertex` (или
  существующий namespace для точек — проверить `astro.planet.*`, там уже есть
  `Vertex`/`AntiVertex`).
- Пересобрать бандл, проверить i18n missing PASS.

## 3. Фронт композита / Davison  (приоритет: средний, объём: L — самый большой)

Бэкенд: `POST /api/v1/composite/calculate` body `{user_id, partner_id, house_system?}`
→ `{midpoint:{method,planets[],angles{}}, davison:{method,planets[],houses[],angles{},midpoint_time{}} | null}`
(сервис `app/services/composite_service.py`; gated `FEATURE_CLIENTS`).

Сделать поверхность сравнения композита двух связанных людей:
- Источник партнёра — переиспользовать механику синастрии (в `forecast-new.js`
  уже есть выбор партнёра: `forecastNewSynastryPartnerSelect`,
  `data-layer-toggle="synastry_partner"`). Композит можно подключить как
  ещё один режим/слой или как отдельную панель.
- Минимально достаточно **табличного** представления: позиции планет midpoint +
  Davison (полноценный biwheel-рендеринг — опционально, большой объём).
- i18n ключи (метод, заголовки), показать `davison.midpoint_time` (дата/гео).
- Учесть `davison == null` (если у карт нет полного birth_data).

Замечание (бэкенд-хвосты композита, опционально): composite-аспекты между
точками композита не считаются (только позиции); Davison усредняет долготу
арифметически (приближение для пар через антимеридиан ±180°).

## 4. UI-переключатель зодиака  (приоритет: средний, объём: M)

Бэкенд готов: `PATCH /api/v1/users/{user_id}/zodiac` body
`{zodiac:'tropical'|'sidereal', ayanamsha?}` → пересчитывает и сохраняет карту,
возвращает свежий `NatalChartResponse`. Аянамши: lahiri, fagan_bradley,
krishnamurti, raman, de_luce (см. `VALID_AYANAMSHAS` в `app/models/schemas.py`).
В шапке forecast-new уже есть **индикатор** (для sidereal), но **нет селектора**.

Сделать:
- Селектор зодиака (+ выпадающий список аянамши, активен только для sidereal),
  по образцу селектора системы домов, если он есть в UI настроек карты.
  Найти, где меняется house system на фронте (есть `PATCH /users/{id}/house-system`
  и `update_user_house_system`), и сделать аналогичный контрол.
- На изменение — вызвать `PATCH /users/{id}/zodiac`, применить ответ
  (обновить `state.natalData`, перерисовать), обновить индикатор в шапке.
- i18n: метки tropical/sidereal уже есть (`page.forecastNew.zodiac.*`); добавить
  метки аянамш.

## 5. Сидерик в прогностике  (приоритет: средний, объём: M)

Сейчас сидерический зодиак применяется только к натальной карте. Прогностические
сервисы (`transit_service`, `progression_service`, `direction_service`,
`solar_return_service`) зовут `SwissEphemerisEngine` без zodiac → считают
тропически даже для сидерической натальной карты.

Сделать:
- В этих сервисах прокинуть `zodiac`/`ayanamsha` (из сохранённой карты —
  `user.zodiac`/`user.ayanamsha`, теперь есть в модели и в `birth_data`) в вызовы
  `engine.calculate_planets(...)` / `calculate_houses(...)` /
  `calculate_planet_longitude(...)`.
- Внимание к транзитному движку `transit_service`: там много прямых вызовов
  `swe.calc_ut` через хелперы (`_aspect_residual_at_jd`, `_transit_speed_at_jd`
  и т.п.) — для корректной сидерики транзитные долготы тоже должны быть
  сидерическими, либо сравнение вести в одном зодиаке. Аккуратно: орбы/станции
  не должны поломаться (сидерик — это поворот, станции/скорости инвариантны).
  Прагматичный путь: считать транзит-тела тропически, а сравнивать с натальными
  целями, переведёнными в общий зодиак; ИЛИ перевести обе стороны в сидерик.
  Выбрать один подход и покрыть тестом «сидерический транзит ≈ тропический − аянамша
  по углам аспектов».
- Тесты на каждый сервис.

## 6. (Опционально) Бейджи фаз в прог/транзит-панелях  (приоритет: низкий, объём: S)

`enrich_planets` (даёт `solar_phase`, `sun_relation`, dignity и пр.) вызывается
только в натальном пути. В прогностическом пути планеты не обогащаются → бейджи
(`chart-data.js` уже умеет их рисовать) не показываются в прог/транзит-панелях.

Сделать (если нужно): прогнать прог-планеты через `PlanetCharacteristicsService`
в соответствующем сервисе/пути сборки прог-payload. Осторожно: некоторые
характеристики (sect, доминанты) натально-специфичны — для транзита уместны не все.

---

## Известные ограничения (НЕ баги, решения по дизайну)

- **methodology_hash** не включает zodiac намеренно: zodiac — per-chart свойство
  (как house_system), смена идёт немедленным пересчётом через PATCH, отдельная
  recalc-инвалидация не нужна.
- **Живая браузер-проверка** ни по одной фиче не делалась в исходной среде
  (нужен полный стек DB+auth+chart). Стоит прогнать QA в браузере по мере фронта.

## Чеклист «definition of done» для каждого хвоста

- [ ] Backend (если есть) + pytest, полный сьют зелёный.
- [ ] Frontend: рендер + i18n (ru/uk/en), `check-i18n-missing-keys` PASS.
- [ ] `npm run build:frontend`, бандл детерминирован (двойная сборка = тот же хеш).
- [ ] JS layout/render тесты зелёные (если трогали layout).
- [ ] Коммит с понятным сообщением.

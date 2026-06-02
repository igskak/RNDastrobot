# План пивота: единый workspace «одно колесо / мульти-колесо»

Статус: черновик плана (intake + premise gate пройдены через /autoplan)
Ветка: main
Дата: 2026-06-01

---

## 1. Цель

Обратная связь астролога: убрать разделение на страницы натал / прогностика / соляр / синастрия. Вместо этого — один рабочий стол (workspace) с двумя видами:

* **одно колесо** — построение одной карты;
* **два и более колец** — сравнение карт по методике.

В обоих видах для каждой панели (левой; и правой — для мульти-колеса) астролог задаёт **точку во времени** и **место**: либо вводом даты/места, либо выбором из базы сохранённых клиентов. Астролог выбирает **методику** (натал / транзиты / прогрессии / дирекции / соляр / синастрия), и карта строится соответственно. Переходы между страницами больше не нужны.

## 2. Принятые решения (premise gate)

| # | Решение | Выбор | Следствие |
|---|---------|-------|-----------|
| D1 | Объём объединения | Колёса → 2 вида. `forecast-tables`, `forecast-timeline`, `natal-full` остаются **аналитическими вкладками/режимами** внутри workspace, не сворачиваются в колесо. | Колесо = «момент». Таблицы/таймлайн = «период». Разные ментальные модели, но один контейнер. |
| D2 | Модель карт в мульти-колесе | **Асимметрично**: внутреннее/левое кольцо — базовая карта, внешние кольца строятся относительно неё (transit / progression / direction / solar / synastry_partner). | Совпадает с уже построенным `prognostic-rings-wheel.js`. Бэкенд-методики и так производны от натала. |
| D3 | Ручной ввод карт | **Ephemeral**: введённые руками карты живут в сессии, в базу не попадают. Кнопка «Сохранить как клиента/событие». | Требует рефактора форкаст-сервисов: принимать inline-натал без обязательного `user_id`. Главное backend-изменение. |
| D6 | Движок колеса | **Единый**: `PrognosticRingsWheel` — универсальное колесо (1..N колец); одна карта = 1-кольцевой режим; «показать одно кольцо» из любого мульти-вида = вид одной карты; `ChartWheel` retired после паритета (Фаза W). | Запрос астролога о консистентности. Gap: 85% совместимы, дыры W1–W4 локальные. |
| D4 | Переход со старых страниц | **Feature-flag + параллельный запуск** (пересмотрено после ревью — все 3 модели против жёсткого перехода). Workspace выкатывается за флагом (env или localStorage), старые страницы живы. Откат = переключить флаг, без redeploy. Редиректы — только после подтверждённого паритета по телеметрии. | Безопасный откат для инструмента, которым биллят клиентов. Цена: пара недель двойной сборки бандлов. |

## 3. Ключевой вывод: рендер-движки готовы, бэкенд недооценён

Это **объединение**, не переписывание — но «~80% готово» относится к **рендеру**, не к бэкенду (см. Findings C1 ниже: `user_id` прошит через 5 разных концернов во всех форкаст-сервисах, inline-натал — реальный рефактор, а не «if-ветка»). Что реально готово:

* **`app/frontend/js/prognostic-rings-wheel.js`** (1692 стр.) — движок мульти-колеса. Рисует 1..N колец. **Важно (Findings H2):** считает кросс-аспекты только **база↔производное кольцо** (асимметрично, соответствует D2), а НЕ кольцо↔кольцо. `synastry_partner` — это стиль рендера (цвет/смещение), а не готовый data-path; синастрия в бэке берёт два сохранённых `user_id` и даёт другую форму аспектов (Findings H3).
* **`app/frontend/js/forecast-new.js`** (3543 стр.) — уже содержит целевой механизм: левая/правая панель, выбор точки времени (date/time + степпер), места (autocomplete + lat/lon), выбор из сохранённых через `AstroQuickOpen.openSavedCharts()`, селектор методики (transit / progression / direction).
* **Бэкенд chart-agnostic**: сервисы (`TransitService`, `ProgressionService`, `DirectionService`, `SolarReturnService`, `SynastryService`) развязаны со структурой страниц. Связь «страница → API» живёт только во фронте.
* **`app/frontend/js/chart-wheel.js`** (1668 стр.) — высокодетальный рендер одиночного колеса.

### Что реально строим

1. **Workspace-шелл** — единый контейнер с переключателем вида (одно колесо / мульти-колесо), управлением кольцами/панелями, и аналитическими вкладками (таблицы/таймлайн/натал-full).
2. **Извлечение переиспользуемой панели «точка времени + место + источник»** из `forecast-new.js` в самостоятельный модуль.
3. **Реестр методик** — декларативный маппинг `{вид, отношение кольца} → endpoint + нормализатор`. `PrognosticRingsWheel` уже принимает `method` на кольцо.
4. **Backend: inline-натал** — форкаст-сервисы принимают данные рождения напрямую, без обязательного сохранённого `user_id` (решение D3).
5. **Миграция** — редиректы со старых URL (решение D4).

## 4. Целевая архитектура

### 4.1 Фронтенд

Новый entry: `app/frontend/entries/workspace.entry.js` → `workspace.bundle.js`. Один HTML `workspace.html`.

```
workspace.html
├── WorkspaceShell (новый, ~router/state)
│   ├── ViewSwitcher: single-wheel | multi-wheel
│   ├── AnalysisTabs: wheel | tables | timeline | natal-report   (D1)
│   └── PanelManager: список колец/панелей (1 для single, 2+ для multi)
│
├── ChartSourcePanel (НОВЫЙ модуль, извлечён из forecast-new.js)
│   ├── режим: manual (date/time + стэппер + место/lat-lon/tz)
│   │          | saved (AstroQuickOpen.openSavedCharts)
│   ├── состояние: { datetime, timezone, location{name,lat,lon,sourceId},
│   │               source: 'manual'|'saved', userId? , ephemeralId? }
│   └── кнопка «Сохранить как клиента/событие»   (D3)
│
├── MethodologyRegistry (НОВЫЙ декларативный реестр)
│   single:  natal | event | solar-return-snapshot | progressed-snapshot
│   multi:   transit | progression | direction(zodiacal|solar_arc|equatorial)
│            | solar-return | synastry
│   каждая методика → { endpoint, payloadBuilder, normalizer, ringMethod }
│
├── Рендер: ЕДИНЫЙ движок (решение D6, запрос астролога о консистентности)
│   └── PrognosticRingsWheel → универсальное колесо: одна карта = 1 кольцо,
│       соляр/синастрия = 2, прогностика = 2+. «Показать одно кольцо» в любом
│       виде = в точности вид одной карты. ChartWheel retired после паритета.
│       Gap-анализ: движки на 85% совместимы; дыры: углы ASC/MC/DSC/IC (W1),
│       фильтр аспектов (W2), адаптер chartData→viewModel (W3),
│       engine-level setVisibleMethods (W4).
│
└── Общие модули (без изменений): api.js, preferences.js, i18n*, symbols.js,
    chart-data.js, aspect-phase.js, natal-wheel-data.js, place-autocomplete.js,
    timezones.js, quick-open-popover.js, prognostic-layer-normalizer.js
```

Модель данных workspace (концепт):

```js
workspaceState = {
  view: 'single' | 'multi',
  analysisTab: 'wheel' | 'tables' | 'timeline' | 'report',
  base: ChartSource,              // базовая карта (D2: всегда есть)
  rings: [                        // только для multi; производны от base (D2)
    { method: 'transit'|'progression'|'direction'|'solar'|'synastry',
      source: ChartSource,        // точка времени+место этого кольца
      options: { directionType?, ... },
      data: NormalizedLayer }
  ],
  preferences, viewport, ...
}
```

### 4.2 Бэкенд (изменение по D3) — переоценено, реальный объём см. Findings C1

Сейчас форкаст-эндпоинты требуют `user_id` сохранённого натала. **`user_id` — это не просто ключ натала**, он прошит через 5 концернов в КАЖДОМ из 4 сервисов (`transit/progression/direction/solar`): загрузка натала из БД, house system (`Astrologer.default_house_system`), пороги стационарности (`get_stationary_threshold_for_user`), резолв орбисов (`get_astrologer_id_for_user → resolve_orb`), запись кэша (`db.add/commit`). Плюс авторизация: каждый route вызывает `ensure_client_access(...user_id...)` — security-граница мультитенантности.

Правильный подход (НЕ «if inline» в каждом методе — это расползётся):

* Ввести value-object **`NatalContext`** `{natal_data, astrologer_id, house_system}`. Конструкторы: `from_user_id(db, user_id)` (текущий путь) и `from_inline(birth_data, astrologer_id=auth.astrologer.id)`.
* **Аутентифицированный астролог имеет `astrologer_id` даже для ephemeral-карты** — направить inline-путь через `*_for_astrologer`-варианты (уже есть: `resolve_orb_for_astrologer`, `get_stationary_threshold_for_astrologer`), иначе орбисы молча упадут на `PROGNOSTIC_DEFAULT_ORB` и карта будет выглядеть неправильно.
* `ensure_client_access` вызывать только если есть `user_id`; для inline — пропускать (данные из БД не читаются, но entitlement-гейтинг остаётся).
* Запись кэша — условная (только при реальном `user_id`). `solar_return_service` по умолчанию `save_to_db=True` → для inline переключить на `False`.
* Контракт запроса: `NatalSourceMixin` с `@model_validator` «ровно один из `user_id`/`natal`» (не два новых endpoint'а). Ошибки валидации inline-натала → `422`, а не текущий blanket `ValueError→404` (Findings DX C3).
* Адаптер форм: `calculate_natal` (rich) → внутренняя форма `_load_natal_data` (упрощённая + фильтр `PROGNOSTIC_EXCLUDED`), иначе аспекты разойдутся (Findings M1).

Это **главное и недооценённое** backend-изменение, а не «переупаковка». Остальное — фронт.

## 4.3 Развилка реализации (H2) — резолв до Фазы 3

Ревью подняло: возможно дешевле эволюционировать `forecast-new` в workspace на месте, чем строить новый shell с нуля. Решить осознанно перед Фазой 3.

| Критерий | Путь A: новый `WorkspaceShell` с нуля | Путь B: эволюция `forecast-new` на месте |
|----------|----------------------------------------|-------------------------------------------|
| Архитектура | Чистая, новый entry/HTML, явная state-модель | Тащит существующий 3543-стр. файл и его скрытое состояние |
| Риск | Средний: всё новое, но изолировано от рабочих страниц | Высокий: правки в живом файле, которым пользуются сейчас |
| Скорость к ценности | Медленнее (строим контейнер) | Быстрее (80% UI уже на месте) |
| Техдолг | Низкий | Высокий, если не рефакторить параллельно |
| Совместимость с feature-flag (D4) | Естественна (новый URL за флагом) | Сложнее (тот же файл обслуживает старое и новое) |

**Рекомендация ревью:** путь B может дать большую часть ценности дешевле — но только если Фаза 0 (извлечение `ChartSourcePanel` + characterization-тесты) проходит чисто. Привязать развилку к kill-criterion Фазы 0: если панель извлекается без изменения поведения за N дней — путь B жизнеспособен; иначе путь A. Решение фиксируется по результату spike Фазы 0.

**РАЗВИЛКА РАЗРЕШЕНА ПОЛЬЗОВАТЕЛЕМ: путь B (эволюция forecast-new).** Скелет `/workspace` (путь A) был ошибкой имплементации — построен голый UI с потерей зрелой функциональности (форма с библиотекой городов и place→timezone, шапки панелей с датой/временем/местом, тикер времени, боковые панели с табами Planets/Houses/Aspects/Grid/Configs/Balances/Rulers, настройки карты, quick-open, zoom/pan, persistence, кэш, i18n). Ревью H2 это предсказывало.
**Исправленный курс:** workspace = эволюционированный forecast-new:
1. Переключатель «Одно колесо / Мульти» → `setVisibleMethods(['natal'])` единого движка (вид и толщина уже верные).
2. Методики на месте: + соляр (год) и + синастрия (партнёр через related-people/quick-open) к чекбоксам слоёв, через `MethodologyRegistry`/`buildSourcePayload` (inline-пути готовы).
3. База = левая панель forecast-new как есть (quick-open, ручная правка момента, тикер, сохранение).
4. Скелет `/workspace` — тестбед, затем редирект на эволюционированный forecast-new. Backend-фундамент, реестр и `ChartSourcePanel` переносятся без потерь.

## 5. План реализации (фазы)

**Фаза 0 — Извлечение `ChartSourcePanel`.** Вынести панель время+место+источник из `forecast-new.js` в самостоятельный модуль с собственным состоянием и событиями. Подключить обратно в `forecast-new` без изменения поведения (регрессионный якорь). Риск низкий, разблокирует всё остальное.

**Фаза 1 — Backend inline-натал.** Расширить схемы запросов (`TransitRequest` и др.) полем `natal`. Добавить ветку «считать из памяти» в сервисы. Тесты на оба пути (user_id и inline). Без изменения старых вызовов.

**Фаза 2 — `MethodologyRegistry`. ✅ (ядро)** `methodology-registry.js`: декларативный реестр (transit/progression/direction/solar_return) — {endpoint, ringMethod, buildMethodologyPayload, targetInputVariant}; источник натала отдельно через `buildSourcePayload` (DX#2). 7 тестов. Перевод forecast-new на реестр — follow-up.

**Фаза W — Унификация движка колеса (D6, перед Фазой 3).** `PrognosticRingsWheel` — единственный движок:
- **W1 ✅**: маркеры углов ASC/MC/DSC/IC (порт из ChartWheel; opt-in `showAngleMarkers`) + `angles` на слое.
- **W2 ✅ (уже существовал)**: фильтрация аспектов в движке была (`aspectScope`+`enabledAspectTypes`) — gap-отчёт ошибся.
- **W3 ✅**: `buildViewModel` нормализатора несёт `angles`; движок умеет fallback `ring.raw.angles`. Нормализатор = адаптер плоского натала.
- **W4 ✅**: `setVisibleMethods([...])` — 1 видимое кольцо раскладывается как настоящая одиночная карта (минуя `minimumRingCount`); пустой фильтр → все кольца; legacy-поведение страниц сохранено. Перевод display-mode synastry/solar на это API — follow-up.
- **W5 ✅**: `chart-wheel-adapter.js` (ChartWheelUnified) экспонирует API ChartWheel поверх единого движка; chart.js переключён (с fallback). Форматы aspect-key и события `chart:*` идентичны → интерактив таблиц сохранён. Верифицировано в браузере: колесо, углы, тултипы, подсветки. 10 jsdom-тестов.
- **W6 (осталось)**: retire `chart-wheel.js` — после визуальной проверки человеком chart.html на едином движке.

**Фазы 3–4 — Workspace MVP. ✅ (скелет, коммит `7355b44`)** Страница `/workspace`: переключатель «одно колесо / мульти», базовая карта (из базы / ручной ephemeral ввод через `ChartSourcePanel`), кольцо сравнения по методике из реестра, рендер единым движком (одиночный = D6-вид с маркерами). Cold-start экран (A9), year-вариант для соляра (Design 4.4), ephemeral-подсказка (D3), 422 в статус. E2E в браузере: 4 сценария.
**Дальше доделано (коммиты `847de17`, `9d311d2`):**
- **3+ кольца** ✅ — чекбоксы методик, параллельные слои, по-слойная изоляция ошибок (Design 2.3-lite). Проверено: натал+транзит+прогрессия+дирекция (4 кольца).
- **Фаза 5 «Сохранить» (D3)** ✅ — ручная карта → имя → `save_to_db=true` (auth+квота), автовыбор нового клиента.
- **Синастрия как методика** ✅ — бэк: `build_synastry_payload_from_charts` (ядро на dict-картах) + `POST /synastry/calculate` (двойной union: каждая сторона user_id XOR natal, «синастрия на лету» без ClientRelationship); фронт: партнёрский блок (из базы / вручную), кольцо `synastry_partner`. Проверено: saved+saved/saved+inline/inline+inline.
Остаточные follow-ups: вкладки tables/timeline/report в workspace, quick-open вместо select, persistence состояния, перевод forecast-new на реестр.

**Фаза 3 — `WorkspaceShell` (single-wheel). (детализация — см. MVP выше)** Новый `workspace.html` + entry. Вид «одно колесо»: `ChartSourcePanel` + методики single (natal/event/solar-snapshot/progressed-snapshot) → `ChartWheel`. Вкладки tables/report подключить как режимы (переиспользовать `natal-full`, `forecast-tables`).

**Фаза 4 — Multi-wheel.** Вид «два и более колец»: base + N производных колец, каждое со своим `ChartSourcePanel` и методикой → `PrognosticRingsWheel`. Покрыть transit/progression/direction/solar/synastry. Кросс-аспекты уже есть в движке.

**Фаза 5 — Кнопка «Сохранить» + ephemeral lifecycle (D3).** Временные карты в сессии; явное сохранение в базу клиентов/событий.

**Фаза 6 — Миграция (D4 = feature-flag).** Workspace за флагом, старые страницы живы как fallback. Централизованный `mapLegacyParams` (A10) с учётом **контракта sessionStorage** (`saveChartToSession`/`getChartFromSession` + `getNavigationState`) — это основной механизм передачи карт, query-params вторичны. QA-чеклист паритета (перечислить пофично: синастрия inter-aspects/house-overlays, solar relocation+год, stacked-layers форкаста, per-page настройки). После подтверждённого паритета по телеметрии — старые URL → редиректы. Откат = флаг. Обновить навигацию (`forecast-nav-menu.js`), `index.html`, `build-frontend-bundles.mjs`.

## 5.1 Постактивности

* **PA1 — Фикс stale `user_id` в forecast-new (Eng C2) — ✅ ВЫПОЛНЕН и верифицирован вживую.** При правке натал-момента `fetchLayer` теперь шлёт inline `natal` (через `ChartSourcePanel.buildSourcePayload`) вместо stale `user_id`; неотредактированный натал — прежний `user_id`-путь. Заодно исправлен M2: ключ кэша слоёв включает идентичность натала. Верификация в живом браузере: правка даты натала → `/transits`+`/progressions` уходят с `natal{date}`, аспекты меняются (31→27); возврат даты → кэш `natal:saved`, исходные аспекты; saved-путь не изменён.

## 5.2 Результат спайка (Фаза 0 + Фаза 1)

Сделано и покрыто тестами (ветка `feat/unified-workspace-spike`):
- **`NatalContext`** + адаптер inline→internal. Inline-натал считается без БД и без сохранённого клиента.
- **Phase 1 backend перенесён на ВСЕ 4 сервиса:** transit, progression, direction, solar. Каждый: context-ядро + тонкая `user_id`-обёртка, проброс `astrologer_id` через орбисы/стационарность, поля рождения (JD/координаты/таймзона) на контексте для производных методик.
- **Роуты transit/progression/direction/solar:** union `user_id` XOR `natal` с валидатором «ровно один», пропуск `ensure_client_access` для ephemeral, inline → `save_to_db` off, ошибки ввода → **422**.
- **`ChartSourcePanel`** (Phase 0): чистая DOM-agnostic модель источника, `buildSourcePayload` → backend-union.
- **Solar развязан** (был сложнее): `_build_solar_response` принимает поля вместо ORM-`User`; `enrich_solar_payload`/`AspectService` идут по `astrologer_id` (терпят `user_id=None`); натальное Солнце и цели аспектов — из контекста (`NatalContext.natal_aspect_targets`); вход-год через `calculate_solar_return_from_context`.
- Тесты: 7 inline-сервисных (натал не из БД) + 9 панели + 32 регрессионных прохода — зелёные.

**Backend Phase 1 — ЗАВЕРШЁН.**

**Фаза 0 — в работе:**
- Вынесены чистые хелперы панели (`forecast-source-utils.js`) + 12 characterization-тестов; `forecast-new.js` делегирует (поведение идентично) — первый тестируемый шов.
- `ChartSourcePanel` получил DOM-слой (`attachDom`/`hydrateFromDom`/`syncToDom`) — фреймворк-free, биндит date/time/timezone/location/year. Добавлен `jsdom` (dev) — 6 jsdom-тестов. Переиспользуемый компонент панели готов и протестирован.

**Остаётся (риск/H2-развилка):** проводка `ChartSourcePanel` в живой `forecast-new.js` (натал- и таргет-панели). `forecast-new.js` — авто-исполняемый IIFE, требующий полного DOM + глобалов, поэтому интеграцию юнит-тестами не покрыть — **верификация через browser-preview на поднятом стеке** (FastAPI + фронт + авторизация + карта в сессии). Делать осознанно, отдельным заходом.

## 6. Не в объёме (NOT in scope)

* Изменение астрологических расчётов/движка Swiss Ephemeris — только переупаковка вызовов.
* Новые методики, которых нет сейчас (композит, хармоники и т.п.) — реестр их допускает, но это отдельная задача.
* Редизайн визуала колеса — переиспользуем оба существующих рендера.
* Полный SPA-роутинг — workspace одностраничный, но это MPA-страница, не общий SPA-фреймворк.
* Свёртка таблиц/таймлайна в метафору колеса (явно отклонено в D1).

## 7. Что уже существует (карта переиспользования)

| Подзадача | Существующий код | Действие |
|-----------|------------------|----------|
| Мульти-колесо, кросс-аспекты | `prognostic-rings-wheel.js` | Переиспользовать как есть |
| Одиночное колесо | `chart-wheel.js` | Переиспользовать как есть |
| Панель время+место+источник | `forecast-new.js` (вшита) | Извлечь в модуль (Фаза 0) |
| Выбор из базы | `quick-open-popover.js` | Переиспользовать |
| Геокод/таймзоны | `place-autocomplete.js`, `timezones.js` | Переиспользовать |
| Нормализация слоёв | `prognostic-layer-normalizer.js` | Переиспользовать / расширить |
| Backend-методики | `*_service.py` | Расширить под inline-натал (Фаза 1) |
| Таблицы/отчёт | `natal-full.js`, `forecast-tables-page.js` | Встроить как вкладки (Фаза 3) |

## 8. Риски

* **R1 (D4, снижен):** ~~жёсткий редирект без отката~~ → закрыт переходом на feature-flag (D4 пересмотрен). Откат = переключение флага без redeploy. Остаточный риск — стоимость двойной сборки бандлов на время стабилизации.
* **R2:** `forecast-new.js` (3543 стр.) — извлечение панели может задеть скрытое состояние/кэш. Митигировать Фазой 0 как изолированным рефактором с регрессией на самой forecast-new.
* **R3:** размер бандла при объединении логики. Митигировать `esbuild splitting:true` (уже включён) + общими чанками.
* **R4 (D3):** inline-натал во всех форкаст-сервисах — расширение поверхности API. Митигировать тестами обоих путей и тем, что старый путь (`user_id`) не меняется.

## 9. Открытые вопросы для review-фаз

* Маппинг старых query-параметров (`?client=&partner=`, `?date=&time=&layer=`) на новые параметры workspace.
* ~~Где живёт ephemeral-состояние при перезагрузке~~ → **повышено до блокера** (Findings, риск потери данных). Минимум sessionStorage; решить ДО Фазы 5.
* Поведение вкладок tables/timeline в мульти-колесе (для какой панели строится период?).
* **Миграция — это контракт sessionStorage, а не query-params** (Findings): карты передаются между страницами через `saveChartToSession`/`getChartFromSession` + `getNavigationState`, forecast-new редиректит на `/` если в сессии пусто. Query-params вторичны.

---

# GSTACK REVIEW REPORT (/autoplan)

Режим: `[subagent-only]` — Codex отсутствует на машине. Голоса = мой первичный разбор + независимый Claude-субагент-рецензент на фазу. Все рецензенты читали реальный код и проверяли claim'ы.

## Кросс-фазовые темы (всплыли независимо в 2+ фазах — высокая достоверность)

1. **«80% / одно backend-изменение» — фактически неверно (CRITICAL).** CEO + Eng + DX независимо проверили: `user_id` прошит через 5 концернов во всех 4 форкаст-сервисах + auth-гейт. Inline-натал = рефактор через `NatalContext`, а не if-ветка. → План §3/§4.2 исправлены выше.
2. **D4 жёсткий переход без отката — неоправданный риск (CRITICAL → USER CHALLENGE).** CEO C3 + Eng C3 + Design 6.2 независимо рекомендуют feature-flag + параллельный запуск вместо жёсткой резки. Это инструмент, которым астрологи биллят клиентов. Вы выбрали D4=жёсткий вопреки моей рекомендации — выношу как User Challenge ниже.
3. **Error-контракт ломается для ephemeral (CRITICAL).** DX C3 + Eng/CEO C2: `ensure_client_access` даёт 404 до расчёта; плохой inline-натал мапится в 404 вместо 422. Гейтить по источнику; разнести коды ошибок.
4. **Извлечение панели НЕ изолировано (HIGH).** CEO H3 + Eng H1 + Design 4.4: `ChartSourcePanel` — это новая абстракция (event-граница + source-модель), а не «вынос». Фаза 0 — не low-risk; нужен timebox + kill-criterion + характеризационные тесты.
5. **Миграция — контракт sessionStorage, не query-params (CRITICAL для D4).** Eng C3 + DX #5.

## CEO консенсус (стратегия)

```
Dimension                              Primary  Subagent  Consensus
1. Premises valid (D1-D4)?             ⚠️       ⚠️        DISAGREE на D4 → User Challenge
2. Right problem to solve?             ~        ~         ОБА: «убрать страницы» — решение юзера, не валид. проблема (H1)
3. Scope calibration correct?          ✗        ✗         CONFIRMED: backend недооценён (C1)
4. Alternatives explored?              ✗        ✗         CONFIRMED: «расширить forecast-new на месте» не оценён (H2)
5. Competitive risks?                  ~        ~         CONFIRMED: тайм-скраббинг/мгновенное переключение карт — table stakes (M2)
6. 6-month trajectory sound?           ~        ~         CONFIRMED: риск «cockpit», нужен default-fast путь (M1)
```

## Eng консенсус (инженерка)

```
Dimension                    Primary  Subagent  Consensus
1. Architecture sound?       ~        ~         CONFIRMED: декомпозиция ок, но NatalContext обязателен
2. Test coverage?            ✗        ✗         CONFIRMED: нет тестов transit/solar/synastry-сервисов; нужны parity-тесты до D4
3. Performance risks?        ~        ~         CONFIRMED: bundle = объединение страниц; lazy-load вкладок (M4)
4. Security threats?         ✗        ✗         CONFIRMED: auth-гейт обходится для inline — нужен явный дизайн (C2)
5. Error paths?              ✗        ✗         CONFIRMED: 404-маппинг разрушает field-level ошибки (C3)
6. Deployment risk?          ✗        ✗         CONFIRMED: D4 без отката + контракт sessionStorage (C3)
```
**Бонус (Eng C2):** найден живой латентный баг — forecast-new при пересчёте натал-момента шлёт stale `user_id`, бэк грузит СТАРЫЙ натал из БД → транзиты считаются против старого натала. Это сильнейший аргумент ЗА пивот: inline-натал чинит существующую багу.

## Design консенсус (дизайн)

```
Dimension                          Primary  Subagent  Consensus
1. First-run / cold-start screen?  ✗        ✗         CRITICAL: экран без клиента не существует нигде сейчас, не спроектирован
2. Missing states?                 ✗        ✗         CONFIRMED: loading/error/partial — по-панельно, не спроектировано
3. single→multi transition?        ✗        ✗         CONFIRMED: судьба базовой карты при переключении не описана
4. Methodology selector?           ✗        ✗         CONFIRMED: «методика» значит разное в single/multi; single-select регрессит stacked-layers
5. Ephemeral data-loss?            ✗        ✗         CRITICAL: нет «unsaved»-сигнала, потеря при reload
6. Solar/Synastry влезают в модель? ✗       ✗         CONFIRMED: solar = год-int (не datetime); synastry симметрична, имеет уник. вкладки
```

## DX консенсус (контракты API/модулей)

```
Dimension                       Primary  Subagent  Consensus
1. Inline-natal contract?       ~        ~         CONFIRMED: union на сущ. endpoint'ах + NatalSourceMixin (не новые роуты)
2. MethodologyRegistry shape?   ~        ~         CONFIRMED: вынести source-payload из per-entry builder; normalizer по умолчанию
3. Error messages actionable?   ✗        ✗         CRITICAL: см. кросс-тему 3
4. ChartSourcePanel API?        ✗        ✗         CONFIRMED: events+snapshot; методичные поля (directionType/year) НЕ в панели
5. Maintainability post-D4?     ✗        ✗         CONFIRMED: централизовать mapLegacyParams (sessionStorage+query), тесты
```
**Доп. (Eng M2 + DX #2):** кэш слоёв в localStorage ключуется по `user_id||'anonymous'` — две разные ephemeral-карты столкнутся в кэше. Нужен `ephemeralId`/хэш натала в ключе.

## Дополнения к плану (приняты автоматически по 6 принципам)

| # | Решение | Класс | Принцип | Обоснование |
|---|---------|-------|---------|-------------|
| A1 | Phase 1 → рефактор через `NatalContext`, не if-ветка | Mechanical | P5 explicit | Код доказывает: 5 концернов × 4 сервиса |
| A2 | inline-путь использует `astrologer_id`-орбисы, не дефолты | Mechanical | P1 complete | Иначе карта молча неверна |
| A3 | `NatalSourceMixin` + validator «ровно один», union на сущ. endpoint'ах | Mechanical | P4 DRY | Не плодить роуты |
| A4 | Разнести коды ошибок: 404 (нет клиента) vs 422 (плохой inline) | Mechanical | P1 complete | Field-level сообщения должны доходить |
| A5 | Phase 0 = timebox+kill-criterion, characterization-тесты forecast-new | Taste | P6 action | Извлечение не изолировано |
| A6 | Методика — per-ring, не глобально (фиксит single/multi, stacked-layers, D2) | Taste | P5 explicit | Глобальный селектор скрывает режим |
| A7 | `ChartSourcePanel` — per-methodology input variant (datetime/year/none) | Mechanical | P1 complete | Solar = год, не datetime |
| A8 | Ephemeral: «Unsaved»-бейдж + beforeunload + sessionStorage до Фазы 5 | Mechanical | P1 complete | Иначе потеря клиентской работы |
| A9 | Cold-start экран — first-class deliverable Фазы 3 | Mechanical | P1 complete | Не существует сейчас |
| A10 | `mapLegacyParams` централизованный + тесты (sessionStorage-контракт) | Mechanical | P5 explicit | Иначе битые deep-links после резки |
| A11 | Lazy-load вкладок tables/timeline/report через `import()` | Taste | P3 pragmatic | Колесо не платит за вкладки |
| A12 | parity-тесты (saved vs inline идентичны) + тесты сервисов до D4 | Mechanical | P1 complete | Сейчас нет тестов transit/solar/synastry |
| A13 | Синастрия — отдельная подзадача Фазы 4 (свой data-path, уник. вкладки) | Taste | P1 complete | Не «переиспользование движка» |
| A14 | Подсветить Eng-C2 (stale user_id баг) как обоснование пивота | Mechanical | P6 action | Чинится тем же inline-путём |

## Не-авто-решения для вас (см. финальный gate)

* **User Challenge — D4** (все 3 модели против вашего выбора жёсткого перехода).
* **Taste — H2** (стоит ли всерьёз оценить «расширить forecast-new на месте» как более дешёвую альтернативу новому shell).

# HANDOFF: пивот единого workspace — контекст для продолжения работы

> Документ для передачи контекста новому агенту/чату. Прочитай целиком, затем
> прочитай `UNIFIED_WORKSPACE_PIVOT_PLAN.md` (живой план с решениями и статусами).
> Рабочая ветка: **`feat/unified-workspace-spike`** (~33 коммита впереди main, рабочий стол чист).

---

## 1. Проект и суть пивота

**Steliara** — веб-приложение для астрологов. Repo: `/Users/ihorskakovskyi/RNDastro/swisseph`.
Стек: FastAPI (`app/api`, `app/services`) + Supabase Postgres + Swiss Ephemeris; фронт — MPA на ванильном JS, esbuild-бандлы (`app/frontend`, entries → `js/bundles`).

**Запрос астролога (владельца):** убрать отдельные страницы натал/прогностика/соляр/синастрия. Должно быть два вида: **одно колесо** и **два и более колец**. В обоих — выбор точки времени и места для каждой панели (вводом или из базы клиентов), выбор методики расчёта (натал/транзиты/прогрессии/дирекции/соляр/синастрия). Один движок карт; «показать одно кольцо» из любого мульти-вида = в точности вид одной карты.

## 2. Ключевые решения (закреплены, НЕ пересматривать без пользователя)

- **D1**: колёса → 2 вида; tables/timeline — отдельные вкладки/режимы (период ≠ момент).
- **D2**: асимметричная модель — базовая карта + производные кольца (transit/progression/direction/solar/synastry_partner).
- **D3**: ручной ввод = ephemeral-карты (НЕ пишутся в БД); сохранение — явная кнопка.
- **D4**: миграция старых URL — **за feature-flag** с откатом (пользователь принял challenge ревью).
- **D6**: **единый движок** = `PrognosticRingsWheel`; `ChartWheel` retired после паритета. Одиночное колесо = **толщина слота 2-кольцевой раскладки, внешний слот у зодиака** (прямое указание астролога; правило в движке, `buildRings`).
- **H2-развилка → Path B**: workspace = **эволюционированный forecast-new**, НЕ новая страница. Пользователь жёстко раскритиковал мой green-field скелет за потерю зрелого UI (библиотека городов + place→timezone, шапки панелей с датой/временем/местом, тикер времени, табы панелей, настройки, quick-open). **Не строить UI с нуля — генерализовать существующий.**

## 3. Что сделано (по блокам, с коммитами)

### Backend Phase 1 — inline-натал (ЗАВЕРШЁН, живьём верифицирован)
- `app/services/natal_context.py` — **NatalContext**: value-object {natal_data, astrologer_id, house_system, user_id?, birth_jd/date/lat/lon/timezone, natal_aspect_targets} + адаптер `natal_data_from_calc_result`. Развязывает форкаст-сервисы от обязательного сохранённого `user_id` (он был прошит через 5 концернов: натал из БД, house system, стационарность, орбисы, кэш).
- Все 4 сервиса (`transit/progression/direction/solar_return`) — context-ядро `calculate_*_from_context` + тонкая `user_id`-обёртка; `astrologer_id` проброшен в орбисы/стационарность (`*_for_astrologer` варианты существовали).
- Роуты transit/progression/direction/solar: union **`user_id` XOR `natal`** (валидатор «ровно один»), пропуск `ensure_client_access` для ephemeral, inline→`save_to_db` off, ошибки ввода → **422** (не 404).
- **Синастрия**: `SynastryService.build_synastry_payload_from_charts` (ядро на dict-картах) + `POST /synastry/calculate` с **двойным union** {primary, partner} — «синастрия на лету» без ClientRelationship. Проверено: saved+saved/saved+inline/inline+inline.
- Фиксы по живой верификации: response-схемы `birth_data.user_id` → Optional (был 500); **внутринатальные аспекты в in-memory пути** `calculate_natal_chart` (было aspects=[]; паритет с DB-путём 129=129 проверен).

### Единый движок (Фаза W: W1–W5 ✅, W6 ждёт юзера)
- `prognostic-rings-wheel.js`: **W1** маркеры углов ASC/MC/DSC/IC (opt-in `showAngleMarkers`; fallback `ring.raw.angles`); **W4** `setVisibleMethods([...])` — engine-фильтр колец; **правило одиночного кольца** (см. D6) в `buildRings`. W2 (фильтр аспектов) уже существовал.
- `chart-wheel-adapter.js` (**W5**): `ChartWheelUnified` — API ChartWheel поверх единого движка; `chart.js` переключён (graceful fallback на старый ChartWheel). Форматы aspect-key и события `chart:*` у движков идентичны → интерактив таблиц жив.
- `prognostic-layer-normalizer.js` (**W3**): `buildViewModel` несёт `angles`; это и есть адаптер плоского натала → 1-кольцевой viewModel.
- solar.js/synastry.js: одиночные display-mode = вид одной карты (тонкое кольцо + маркеры).
- **W6 (НЕ ДЕЛАТЬ до визуального ОК юзера)**: удалить `chart-wheel.js` (~1670 строк дубля).

### Переиспользуемые модули
- `chart-source-panel.js` — модель «время+место+источник» (events + сериализуемый snapshot + DOM-слой attachDom/syncToDom; jsdom-тесты) + **`buildSourcePayload(snapshot)`** → `{user_id}` XOR `{natal}` (зеркало backend-union).
- `methodology-registry.js` — декларативный реестр методик: `{endpoint, ringMethod, buildMethodologyPayload, targetInputVariant}` (+ `buildRequestBody`-override для синастрии). Методика = один литерал.
- `forecast-source-utils.js` — чистые хелперы (normalizeTime/splitTargetDatetime/normalizeTimezoneValue), forecast-new делегирует.

### Path B — forecast-new = workspace (шаги 1–2 ✅)
- **Шаг 1** (`28a5063`): кнопки **◯/◎** в тулбаре колеса → `state.wheelView` → `setVisibleMethods(['natal'])` + `showAngleMarkers`. Персистится (`wheelView` в view-state). Весь chrome жив в обоих видах.
- **Шаг 2** (`b1b16c9`): тогглы **Соляр** (с инлайн-полем года) и **Синастрия** (с селектом партнёра из всех клиентов) в шапке слоёв; `fetchLayer`-кейсы; кэш-ключи с годом/партнёром; persistence (`solarYear`, `synastryPartnerId`); generic правая панель рендерит их таблицы сама. **Проверено: 5 колец одновременно.**
- Фикс C2/M2 (ещё раньше): правка натал-момента в forecast-new шлёт inline `natal` через `buildSourcePayload` (вместо stale user_id), натал-токен в кэш-ключах.

### Скелет `/workspace` (тестбед, НЕ продакшн)
`workspace.html/js/css` + роут — работает (single/multi, ручной ввод, мультислои, сохранение в базу, синастрия), но это упрощённый testbed. Судьба: редирект на forecast-new после его cold-start пути.

## 4. Что осталось (приоритетно)

1. **⏳ ВИЗУАЛЬНАЯ ПРОВЕРКА ПОЛЬЗОВАТЕЛЕМ** (блокирует W6 и миграцию). Список: chart.html на едином движке; одиночные режимы solar/synastry; forecast-new — single-вид, 5 колец, таблицы соляра/синастрии, persistence. Память агента: `pending_visual_check.md`.
2. **Path B шаг 3**: cold-start путь для forecast-new (сейчас без `natalChart` в sessionStorage редиректит на `/`); затем `/workspace` → редирект, скелет удалить.
3. Вкладки tables/timeline как режимы внутри forecast-new (D1).
4. **Фаза 6**: миграция старых URL (chart/solar/synastry/natal-full) за feature-flag (D4). Главный контракт миграции — **sessionStorage** (`saveChartToSession`/`getChartFromSession` + `astroNavigationState`), не query-params.
5. **W6**: retire `chart-wheel.js` (после п.1).
6. Опционально: перевод transit/progression/direction в forecast-new на `MethodologyRegistry`; relocation-поля соляра в UI; партнёр синастрии «вручную» в forecast-new (бэкенд уже умеет inline+inline).

## 5. Как работать (операционка)

- **Запуск стека**: `.claude/launch.json` → preview_start "steliara" (uvicorn :8000, отдаёт и API, и фронт; БД — живой Supabase из `.env`). Руками: `PYTHONPATH=$(pwd) .venv/bin/uvicorn app.api.main:app --host 127.0.0.1 --port 8000`.
- **Дев-логин**: используйте актуальный тестовый аккаунт из менеджера секретов или восстановление пароля через `/login.html`; не храните пароль в handoff-документах. `POST /api/v1/auth/login` использует cookie-сессию.
- **Тестовый клиент**: `072e22a8-7d3b-460c-a93b-f502c30348a2` («Тест 2», 1990-02-01, Сан-Паулу); партнёры есть у `00330bbe-...` и `96e9bcd7-...`; есть созданный мной «Workspace Test».
- **Открыть chart/forecast-new в браузере**: залогиниться fetch'ем, затем `sessionStorage.setItem('natalChart', JSON.stringify(await GET /api/v1/natal/{id}))` и навигация (без карты в сессии страницы редиректят).
- **Тесты**: python — `.venv/bin/python -m pytest app/tests/...` (НЕ системный python); фронт — `node app/tests/<name>.test.cjs` (node:test; jsdom доступен).
- **Сборка**: `cd app && npm run build:frontend` (бандлы и HTML-маркеры коммитятся вместе с исходниками).
- **Конвенции**: коммиты — содержательные, с описанием верификации; «verify, don't claim» — каждое изменение проверяется живьём в браузере (preview-тулы) или тестами ДО заявления о готовности; поведение существующих страниц не менять молча — opt-in опции/паритет.

## 6. Грабли (сэкономят часы)

- `attach(config)` в place-autocomplete — ОДИН объект, не позиционные аргументы.
- Движок ссылается на голый глобал `Symbols` → в jsdom-тестах ставить `global.Symbols = {signs:{},planets:{}}` ДО dynamic import; модули — IIFE с `window.X` + `module.exports` (es-module движок импортить через `await import()`).
- zsh: `UID` — readonly-переменная, не использовать в скриптах.
- При гидрации persisted-полей: `Number(null) === 0` проходит `isFinite` — guard'ить диапазоном.
- Решения форм карт: внутренняя форма натала для форкастов = `_load_natal_data` ({name, longitude, type} + all_objects с PROGNOSTIC_EXCLUDED-фильтром); богатая форма calculate → адаптер в `natal_context.py`.
- `forecast-new.js` ~3600 строк: единая точка рендера колеса — `renderWheel()`; слои — `LAYER_ORDER`+`data-layer-toggle`+`fetchLayer`+`buildLayerCacheKey`; persistence — `persistState`/`hydrateState` + `forecast-new-state-storage.js` (sanitize обязателен для новых полей).
- Solar-сервис: `save_to_db=True` по умолчанию! Для слоёв всегда слать `false`.
- `aspectScope`/`enabledAspectTypes` фильтрация в движке УЖЕ есть (не дублировать).

## 7. Карта ключевых файлов

```
UNIFIED_WORKSPACE_PIVOT_PLAN.md        — живой план (решения, фазы, статусы, ревью-отчёт)
app/services/natal_context.py          — NatalContext + адаптеры
app/services/{transit,progression,direction,solar_return,synastry}_service.py
app/api/routes/{transits,progressions,directions,solar,synastry}.py — union-роуты
app/frontend/js/prognostic-rings-wheel.js — ЕДИНЫЙ движок (W1/W4/правило одиночного кольца)
app/frontend/js/chart-wheel-adapter.js  — ChartWheelUnified (chart.js → единый движок)
app/frontend/js/chart-wheel.js          — legacy, retire в W6
app/frontend/js/prognostic-layer-normalizer.js — buildViewModel/normalizeLayer
app/frontend/js/chart-source-panel.js   — панель-модель + buildSourcePayload
app/frontend/js/methodology-registry.js — реестр методик
app/frontend/js/forecast-new.js         — ГЛАВНАЯ страница-workspace (Path B)
app/frontend/js/forecast-new-state-storage.js — persistence-sanitize
app/frontend/{workspace.html,js/workspace.js} — скелет-тестбед
app/tests/test_natal_context.py, test_prognostic_rings_wheel_unified.test.cjs,
  test_methodology_registry.test.cjs, test_chart_source_panel*.test.cjs — ядро тестов
```

## 8. Стиль взаимодействия с пользователем

Пользователь — продакт/владелец, говорит по-русски, ценит: автономную работу с реальной верификацией, честность о дырах, переиспользование существующего кода вместо переписывания, частые осмысленные коммиты. Команда «продолжай» = работать автономно дальше по плану. Перед удалением/жёсткими миграциями — ждать его явного ОК (визуальная проверка). Бэкенд-инварианты и UI-поведение фиксировать тестами.

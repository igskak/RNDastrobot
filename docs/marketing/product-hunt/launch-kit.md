# Product Hunt launch kit

*Собрано 2026-09-24. Продолжение [wave2-directory-kit.md](../wave2-directory-kit.md), заменяет его PH-часть.*

**Зачем запускаемся.** Клиентов отсюда почти не будет. Цель — сущность и ссылки:
страница на сильном домене, которая отделяет «Steliara» от препарата STELARA
([seo-audit-2026-09.md](../seo-audit-2026-09.md)); сторонний источник, который цитируют
Perplexity/ChatGPT по категорийным запросам; хвост перепечаток в каталогах; значок
для лендинга и заявки на грант.

**Когда.** Рекомендую **субботу, 10 октября 2026** (запасной вариант — суббота 17.10).
В выходные конкуренция за топ дня ниже, а наша цель — значок и страница, а не максимум
трафика. Запуск стартует в 00:01 по тихоокеанскому времени = **09:01 по Праге** (до 25.10
Прага в CEST).

---

## 1. Блокеры до запуска

Всё это видно на скриншотах или в первые минуты работы с продуктом. Нашёл при съёмке галереи.

| # | Что | Где | Почему важно для PH |
|---|---|---|---|
| 1 | **Ответ ассистента выводится сырым markdown** (`**1) …**`), плюс длинные штампы вида `23:59:59-07:00` | `app/frontend/js/chat.js:367`: `contentDiv.textContent = content` | Это слайд 3. Комментаторы будут пробовать чат первым делом |
| 2 | **Даты в профиле — сырой ISO** (`2026-10-01T16:00:00+00:00`) | `app/frontend/js/client-profile.js:114`: к штампу с `+00:00` дописывается `Z`, `Date` получает NaN и возвращается исходная строка | Профиль — слайд 2. На скриншоте даты поправлены вручную, как они должны выглядеть |
| 3 | **«Last session» показывает будущую запланированную встречу** | `app/services/person_profile_service.py:268` берёт `consultations[0]`, отсортированные по `scheduled_at desc`, включая planned | Там же |
| 4 | **Нет favicon, логотипа и og:image** | прод: `/favicon.ico` → 404; на главной есть `og:title`/`og:description` и `twitter:card=summary_large_image`, но нет `og:image` | Превью ссылки на PH, в X, Slack и мессенджерах выйдет без картинки. Готовые файлы: `gallery/thumbnail-240.png`, `gallery/og-1200x630.png` |
| 5 | **На лендинге нет ни одного изображения продукта** (0 `img`/`svg` во всех секциях) | `app/frontend/index.html` | Посетитель с PH приходит с картинкой в голове и видит только текст. Скриншоты из `screens/` подходят для секций craft / people / assistant |
| 6 | **Нет кадра записи и расшифровки звонка**, хотя это наш главный аргумент | тестовый аккаунт на Standard: `calls_enabled=false`, `recording_enabled=false` | Нужен кадр с Studio-аккаунта: см. раздел 6 |
| 7 | Импорт из Solar Fire / Astro Gold проверен только на синтетических файлах | `docs/chart-import-formats.md` | Если писать про импорт на PH, сначала прогнать настоящие экспорты. До этого в текстах только осторожная формулировка |
| 8 | На /pricing у Practitioner в списке «recordings», хотя запись есть только в Studio, и там же слово «client» | `locales/en.json` → `page.pricing.plans.practitioner.f2` | Мелочь, но на PH читают внимательно |

Плюс обычная проверка: в режиме инкогнито пройти по-английски путь
лендинг → регистрация → триал → первая карта → ассистент.

---

## 2. Поля страницы Product Hunt (копировать как есть)

**Name:** `Steliara`

**Tagline** (≤60, основной — первый):
- `The workspace for practicing astrologers` (40)
- `Astrology software that remembers every session` (47)
- `Charts, people and recorded sessions, for astrologers` (53)

**Description** (≤260, сейчас 248):
> Steliara is a calm workspace for astrologers who read for people. Each person gets a profile with their charts, your notes and every session. Hold the call inside Steliara and it's recorded, transcribed and summarized. Swiss Ephemeris. Any browser.

**Topics:** `Astrology`, `Productivity`, `SaaS`. Тему «Artificial Intelligence» не ставим
сознательно: астрологи плохо реагируют на AI-подачу (см. правила тона). Если PH
предложит `Transcription`, её можно добавить.

**Website:**
`https://steliara.com/?utm_source=producthunt&utm_medium=launch&utm_campaign=ph_2026_10`

**Pricing:** Paid, free trial (14 days, no card). Practitioner $24/mo, Studio $39/mo.

**Thumbnail:** `gallery/thumbnail-240.png`. Это предложение знака; настоящего логотипа
у продукта пока нет, так что его можно заменить.

**Gallery** (порядок важен: первые кадры видят чаще всего):

| # | Файл | Про что | Статус |
|---|---|---|---|
| 1 | `gallery/01-workspace.png` | Рабочий экран: натал + транзиты | готово |
| 2 | `gallery/02-profile.png` | Профиль человека: карты, заметки, контакт, партнёр | готово (после фикса блокеров 2–3 переснять) |
| 3 | `gallery/03-assistant.png` | Ответ из данных карты: Плутон по Луне, 3 точных прохода | **переснять после блокера 1** |
| 4 | *consultation (нет)* | Звонок → запись → расшифровка → краткое содержание | **снять по разделу 6 и поставить на место №2** |
| 5 | `gallery/04-history.png` | История сессий в профиле | готово |
| 6 | `gallery/05-timeline.png` | Год транзитов на одном экране | готово |
| 7 | `gallery/06-synastry.png` | Синастрия из связанных профилей | готово |
| 8 | `gallery/07-people.png` | Список людей, соляры месяца, важные транзиты | готово |
| 9 | `gallery/08-foundation.png` | Swiss Ephemeris, браузер, триал | готово |

Файлы 2540×1520 (двойное разрешение от рекомендованных PH 1270×760).
Пересобрать: `python3 docs/marketing/product-hunt/gallery-src/build.py`.

**Видео (необязательно, но заметно повышает шанс на Featured):** 60–75 секунд, без
голоса за кадром или с тихим голосом. Сцены: открыть профиль → карта с транзитами →
вопрос голосом «when is Pluto conjunct her Moon» → ответ с датами → конец сессии и
краткое содержание в профиле. Loom или запись экрана в 1440×900.

---

## 3. Первый комментарий автора

Публикуется сразу после старта. В `[квадратных скобках]` — только ваши личные факты,
их нельзя придумать за вас.

> Hi Product Hunt 👋
>
> I'm [name], and I built Steliara after watching how astrologers actually work. A reading
> means one program for the chart, another for the video call, and notes scattered
> between them. When the call ends, most of what was said is gone, and before the next
> session you rebuild the story from memory.
>
> Steliara keeps it in one place. Every person you read for has a profile: their charts,
> your notes and the history of your sessions. You can hold the call inside Steliara; it's
> recorded (with both sides' consent), transcribed, and a short summary lands in the
> profile.
>
> A few things we cared about:
> • Precision first. Calculations run on Swiss Ephemeris, with house systems, sidereal
> zodiacs and your own orbs.
> • You ask, it finds. "When is transiting Pluto exact on her Moon?" gets you the
> dates in seconds. It looks things up in the chart; it never reads the chart for you.
> • Nothing to install. Mac, Windows, any browser.
>
> [One personal line: who you are, how many astrologers you built this with, what surprised you.]
>
> There's a 14-day free trial, no card. I'd love honest feedback, especially from
> anyone who reads charts for other people. I'll be here in the comments all day.

---

## 4. Готовые ответы на частые комментарии

- **«Is this AI astrology?»**
  No. Steliara never interprets a chart. The assistant looks things up in the calculated
  data (aspects, exact dates, stations) so you don't search by hand. The reading is yours.
- **«Why no free plan?»**
  It's a working tool for people who read professionally, and calls with recording cost
  us real money. The 14-day trial has everything, with no card.
- **«What about privacy of recordings?»**
  Recording starts only after both the astrologer and the person consent. Recordings
  belong to the astrologer's workspace and aren't used for anything else. *(Сверить
  формулировку с terms и реальной политикой хранения до публикации.)*
- **«Can I bring my charts from Solar Fire / Astro Gold?»**
  Yes, there's an import for Solar Fire and Astro Gold chart files, AAF from Astro.com,
  ZET and Astrolog. *(Писать только после блокера 7.)*
- **«Mac app?»** It runs in the browser on Mac and Windows, nothing to install.
- **«How is this different from Astrolium / Solar Fire?»**
  Solar Fire is a superb calculator, but there's no room in it for the person, the notes or
  the session. Steliara keeps the depth of calculation and adds the practice around it,
  including the call itself: recorded, transcribed, summarized.

---

## 5. План дня запуска

Время по Праге (CEST). PT = Прага − 9 ч.

**За 2 недели (до 26.09)**
- [ ] Исправить блокеры 1–4, переснять слайды 2 и 3, снять консультацию (раздел 6).
- [ ] Картинки на лендинг (блокер 5); og:image и favicon на все публичные страницы.
- [ ] Страница продукта на PH заполнена и запланирована (Launch → Schedule). Себя
      ставим как hunter: сторонний hunter сейчас почти ничего не даёт.
- [ ] Профиль автора на PH: фото, имя, ссылка на сайт. Пара искренних комментариев к
      чужим запускам за неделю до нашего, чтобы аккаунт не был пустым.

**За 3–5 дней**
- [ ] Список из 30–50 человек, которые правда посмотрят: знакомые астрологи,
      микроблогеры из [micro-influencer-campaign.md](../micro-influencer-campaign.md),
      люди из тестового периода, коллеги-основатели. Каждому лично, коротко.
- [ ] Заготовки постов: LinkedIn, X, Telegram-канал, Indie Hackers (текст ниже).
- [ ] Аннотация в GA4 и сегмент PostHog по `utm_source=producthunt`, чтобы всплеск не
      испортил метрики воронки.
- [ ] Проверить прод: регистрация, триал, почта о подтверждении, скорость загрузки.

**День запуска (суббота)**
- [ ] **09:01** — запуск пошёл. Сразу опубликовать первый комментарий (раздел 3).
- [ ] **09:05–09:30** — личные сообщения по списку. Формулировка «we're live, would love
      your honest feedback», **без просьб проголосовать**: PH за это снижает вес голосов
      и может снять запуск.
- [ ] **09:30** — посты в LinkedIn / X / Telegram / Indie Hackers со ссылкой на страницу PH.
- [ ] **Весь день** — отвечать на каждый комментарий в течение 15–30 минут, по существу.
      Благодарить за каждый вопрос, баги записывать сразу.
- [ ] **13:00, 18:00, 23:00** — проверить позицию, регистрации, ошибки на проде.
- [ ] Не накручивать: никаких голосов с новых аккаунтов и «колец» обмена голосами.

**Первая неделя после**
- [ ] Значок PH на лендинг, если есть место в топе дня/недели.
- [ ] Сабмиты в каталоги по списку ниже (многие сами подтягивают продукты с PH).
- [ ] Через 2–4 недели повторить запросы в Perplexity из
      замера AI-поиска от 2026-08-06 и посмотреть, цитируется ли страница PH.
- [ ] Разобрать регистрации с `utm_source=producthunt`: сколько дошли до первой карты.

**Пост для соцсетей (EN):**
> Today Steliara is on Product Hunt. It's a workspace for astrologers who read for
> people: charts, notes and the sessions themselves, recorded and summarized, all in one
> profile. I'd really value your honest take → [PH link]

---

## 6. Кадр консультации (главный недостающий слайд)

Нужен аккаунт Studio (у тестового аккаунта тариф Standard, звонки и запись там
выключены). Реальных клиентов снимать нельзя, поэтому запись — постановочная.

1. В Studio-аккаунте открыть профиль **Maya Lindqvist** (или создать такой же).
2. Начать звонок, со второго устройства зайти по ссылке как «Maya», обе стороны дают
   согласие на запись.
3. Прочитать сценарий ниже (≈3 минуты), завершить звонок, дождаться обработки.
4. Снять два экрана: звонок с включённой записью и профиль с расшифровкой и кратким
   содержанием. Положить в `screens/` как `consultation-call.png` и
   `consultation-summary.png`, добавить слайд в `build.py` на место №2.

**Сценарий (EN):**

> **A:** Hi Maya, good to see you again. Last time we talked about the studio and whether to go freelance. How has it been?
> **M:** Honestly, harder than I expected. I handed in my notice in my head about ten times. Tom is supportive but he keeps asking about money.
> **A:** That makes sense. Let's look at timing, because your question was always "when", not "whether". Pluto is sitting on your natal Moon right now and it stays there through 2027.
> **M:** That sounds heavy.
> **A:** It's slow and deep rather than sudden. You told me in May that home feels rearranged. That's very much this. The exact passes are February, August and December 2027.
> **M:** So should I wait until then?
> **A:** Not necessarily. What I'd watch is Saturn square your Mars from this summer into March. That's where practical friction shows up: contracts, cash flow, energy.
> **M:** So maybe line up two or three clients before I leave?
> **A:** That fits. And your birthday in March, with the new solar return, is a natural point to make it public.
> **M:** Okay. March. I'll talk to Tom about a savings target until then.
> **A:** Good. I'll send you the notes and the key dates after the call, and let's check in early in the new year.

---

## 7. Каталоги: 20 площадок в порядке приоритета

Приоритет считал по нашей главной цели: **сущность и цитирование в ИИ-поиске** →
**категорийный интент** («alternative to Solar Fire») → **ссылки**. Условия площадок
меняются: платность и dofollow проверять при сабмите. Готовые тексты: раздел 2 и
[wave2-directory-kit.md](../wave2-directory-kit.md).

### P0 — до запуска PH (закрепляют сущность «Steliara ≠ STELARA»)

| # | Площадка | Что даёт | Что сделать |
|---|---|---|---|
| 1 | **AlternativeTo** | Прямой категорийный интент, страницы «alternatives to X» часто цитируют LLM | Добавить Steliara и отметить как альтернативу Solar Fire, Astro Gold, TimePassages, Astrolium, Kepler/Sirius, Janus |
| 2 | **G2** (бесплатный профиль вендора) | Один из главных источников для ИИ-ответов «best software for…» | Профиль, категория Practice Management; позже 5–10 отзывов от founding-астрологов |
| 3 | **Capterra / GetApp / Software Advice** (одна вендорская заявка Gartner Digital Markets) | Три сильных домена сразу, высокий коммерческий интент | Бесплатная базовая карточка; отзывы — после первых платящих |
| 4 | **Crunchbase** | Главная карточка сущности для ИИ и Google | Организация: описание, сайт, основатель, страна, категория Astrology/Software |
| 5 | **LinkedIn — страница компании** | Сущность + нужна для G2/Crunchbase | Логотип, описание, ссылка на сайт |

### P1 — неделя запуска

| # | Площадка | Что даёт | Что сделать |
|---|---|---|---|
| 6 | **Product Hunt** | Страница-сущность, значок, всплеск | Этот документ |
| 7 | **SaaSHub** | Страницы alternatives/vs, ссылка | Листинг + отметить конкурентов |
| 8 | **Slant** | Рейтинги-ответы на вопросы вроде «best astrology software for Mac», их цитирует ИИ | Добавить Steliara в существующие вопросы про astrology software, аргументы про/контра честно |
| 9 | **SourceForge** (каталог бизнес-софта) | Сильный домен, бесплатная карточка вендора | Листинг в категории Astrology / Practice Management |
| 10 | **TrustRadius** | Ещё один B2B-обзорный домен | Бесплатный профиль |
| 11 | **BetaList** | Ранние пользователи, ссылка | Бесплатная очередь долгая, есть платное ускорение; подавать заранее |
| 12 | **Indie Hackers** | Страница продукта + пост о запуске | Продукт + пост «what I learned launching for astrologers» |

### P2 — пакетом после запуска (ссылки и охват)

| # | Площадка | Что сделать |
|---|---|---|
| 13 | **Uneed** | Листинг в день запуска на их витрине |
| 14 | **Microlaunch** | Листинг |
| 15 | **Peerlist Launchpad** | Листинг + профиль основателя |
| 16 | **Fazier** | Листинг |
| 17 | **Startup Stash** | Листинг |
| 18 | **Crozdesk** | Бесплатный профиль вендора |
| 19 | **There's An AI For That** | Только с подачей «transcription & summaries of consultations», без «AI astrologer» |
| 20 | **Wikidata** | Элемент «Steliara (software)». **Только когда будут независимые источники** (PH, пресса, обзоры), иначе удалят |

### Не каталоги, но ценнее большинства из них (ручная работа)

- **Авторы статей «best astrology software 2026»**: предложить продукт в подборку, дать
  триал на месяц.
- **Профессиональные организации** (NCGR, ISAR, AFAN, AA, Kepler College): ресурсы для
  членов, спонсорство вебинаров.
- **Астрологические подкасты и YouTube**, где разбирают софт: демо-сессия, а не реклама.
- **Reddit** (r/astrologers, r/AskAstrologers): только полезные ответы от своего имени,
  без ссылок в первых сообщениях. Правила сабов против саморекламы строгие.

Трекер сабмитов вести в таблице `wave2-directory-kit.md`: дата, статус, живой URL.

---

## 8. Демо-данные и пересъёмка

Скриншоты сняты на проде в тестовом dev-аккаунте, интерфейс EN,
viewport 1440×900 @2x. Созданы вымышленные люди: Maya Lindqvist (5 заметок,
4 сессии, контакт на example.com, партнёр Tom Berg), Daniel Okafor, Clara Moreau,
Sofia Reyes, James Whitaker, Hana Sato, Leila Haddad, Oliver Brandt, Amara Nwosu, Ethan
Cole. Натальные данные вымышленные, заметки сверены с реальными транзитами карты Maya
(Плутон ☌ Луна 2026–27, Нептун на ASC, Сатурн □ Марс).

Их оставить до запуска: слайды 2 и 3 нужно переснять после фиксов. После запуска
удалить. ID всех записей — в `gallery-src/demo-data.json`.

На кадрах списка скрыты старые тестовые строки аккаунта (кириллица); на кадре профиля
даты поправлены так, как они будут выглядеть после фикса блокеров 2–3. Остальное на
скриншотах — реальный интерфейс без правок.

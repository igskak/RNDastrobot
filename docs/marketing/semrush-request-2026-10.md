# Semrush request: measured volumes for the next SEO pages

*Written 2026-10-26. Semrush is not available in the Claude desktop session where the SEO
pipeline lives, so this is a self-contained request to paste into another chat that has it.
The answer decides which two queue items in [seo-backlog.yml](seo-backlog.yml) the
weekly content agent is allowed to build. The rule it follows: **a page needs a measured
search volume, not just a SERP shape** (see `meta.rules` in the backlog and the Astrolium
case, where a page was queued on SERP shape alone and the brand turned out to have no
searchers).*

---

## Text to paste into the other chat

> Мне нужны замеры в Semrush по списку запросов, чтобы решить, какие страницы писать на
> сайт steliara.com (браузерное рабочее пространство для практикующих астрологов:
> гороскопы, профили людей, записанные и расшифрованные консультации). Сайт молодой,
> англоязычный, целевой рынок США. Сайт не нужно анализировать, нужны только цифры по
> запросам.
>
> **База:** US (английский). Если это почти ничего не стоит по лимитам, добавь колонкой
> объём по UK, но только как справку.
>
> **Экономно:** используй пакетный Keyword Overview (до 100 запросов за раз) и Keyword
> Magic / Related Keywords только для двух опорных запросов, указанных ниже. Не запускай
> анализ доменов конкурентов.
>
> **Для каждого запроса верни:** объём в месяц, Keyword Difficulty (%), намерение
> (informational / commercial / transactional / navigational), CPC, тренд за 12 месяцев
> (растёт, падает, ровно) и какие блоки есть в выдаче (AI Overview, People Also Ask, обзоры,
> видео). Если у запроса нет данных, так и пиши «нет данных», не округляй до нуля молча.
>
> **Запросы по кластерам:**
>
> 1. **Mac:** astrology software for mac; best astrology software for mac; astrology
>    software mac; mac astrology software; astrology program for mac; astrology app for
>    macbook
> 2. **Общие и профессиональные:** astrology software; best astrology software;
>    professional astrology software; astrology software for professionals; astrology
>    software for astrologers; best astrology software for professional astrologers;
>    astrology chart software
> 3. **Облако и браузер:** web based astrology software; online astrology software for
>    professionals; cloud astrology software; browser based astrology software; online
>    astrology chart software
> 4. **Ведение практики:** astrology client management software; astrology practice
>    management software; astrologer crm; astrology consultation software; astrology client
>    notes software; software for astrologers
> 5. **Запись сессий:** record astrology readings; astrology session recording; transcribe
>    astrology consultation; astrology reading transcription
> 6. **Astro Gold:** astro gold alternative; astro gold for windows; astro gold vs; astro
>    gold vs solar fire; astro gold software; astro gold app
> 7. **Solar Fire:** solar fire alternative; solar fire alternatives; solar fire for mac;
>    solar fire vs astro gold
>
> **Related keywords:** только для двух опорных запросов, «astrology software for mac» и
> «astrology software». По каждому верни топ-15 связанных запросов с объёмом и сложностью,
> исключая явно потребительские («free natal chart», «birth chart calculator», знаки
> зодиака, гороскопы).
>
> **Что вернуть:** одну таблицу по кластерам (запрос, объём, KD, намерение, CPC, тренд, блоки
> выдачи), под каждым кластером сумму объёмов, и в конце вердикт по правилу ниже. Данные
> «нет данных» считай нулём в сумме, но отметь их.
>
> **Правило вердикта.** Для кластеров 1 (Mac) и 6 (Astro Gold):
> - **«делать»**, если сумма объёмов основных запросов кластера ≥ 100 в месяц, и у лучшего
>   запроса KD ≤ 45;
> - **«не делать»**, если сумма < 100 или у всех запросов KD > 45;
> - **«спорно»** в остальных случаях, с одной строкой почему.
>
> Для кластеров 2, 3, 4, 5, 7 вердикт «предложить страницу» только если один запрос даёт
> ≥ 50 в месяц при KD ≤ 35; иначе «не предлагать». Если есть запрос с большим объёмом, который я
> не указал (из Related Keywords), отметь его отдельно.

---

## What I do with the answer

| Verdict | Effect in the backlog |
|---------|-----------------------|
| Mac cluster passes | `astrology-software-for-mac`: set `volume_checked: true`, note the numbers and date |
| Mac cluster fails | set `status: dropped` with the numbers, as for Astrolium |
| Astro Gold cluster passes | `astro-gold-alternative`: `volume_checked: true` |
| Astro Gold cluster fails | `status: dropped` |
| A new query passes in clusters 2–5, 7 | new backlog item with the numbers in its `why`, `volume_checked: true` |

Until the numbers are in, the weekly agent skips both items. The two technical items
(`ctr-title-meta-pass`, `internal-links-to-new-pages`) need no volume check, because their
evidence is Search Console impressions we already have, so it has work next Monday.

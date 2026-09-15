# Немецкая версия: стиль, глоссарий и готовые образцы

Пользователь выбрал **Sie** 2026-09-14. Это обязательное решение для интерфейса, писем и системного обращения ассистента. Ниже — редакционные решения для продукта; они не меняют определения астрологических методов. Готовые немецкие образцы прошли дополнительную редактуру на естественность 2026-09-14. Полный каталог de.json пока не создан; эта проверка не означает проверку всех 2303 будущих переводов или вычитку носителем языка.

## Правила перевода

1. Естественный нейтральный стандартный немецкий; кратко, профессионально, без рекламного усиления. Sie/Ihnen/Ihr — с прописной. Например: «Wählen Sie ein Datum», «Ihre Einstellungen». Не смешивать Sie и du.
2. Кнопки преимущественно инфинитивом: Speichern, Abbrechen, Berechnen. Не добавлять Sie в каждую кнопку. Пример сообщения об ошибке: «Das Horoskop konnte nicht geladen werden. Bitte versuchen Sie es erneut.»
3. Обычный sentence case, немецкие существительные с заглавной. Использовать ä/ö/ü/ß, не ae/oe/ue/ss. Никакого глобального Title Case из английского.
4. `Steliara`/существующие брендовые названия, Swiss Ephemeris, Google, названия тарифов сохраняются. В mailer текущий бренд AstroBot — сохранить его во всех немецких строках до отдельного общего ребрендинга.
5. `{name}`, `{count}`, `{date}`, `{message}` и любые другие реальные placeholders сохраняются буквально с тем же количеством повторений. Не переименовывать параметры, JSON keys, URLs, HTML-теги/атрибуты, escape sequences, символы градусов/планет. Переставлять placeholder в предложении можно.
6. Нельзя просто копировать английские абзацы в de. Допустимые одинаковые слова/имена оформлять точечными locale-specific исключениями проверки.
7. Показатель, действие, слой и карта — разные понятия. Chart в астрологическом контексте = Horoskop; диаграмма данных = Diagramm. Layer = Ebene; wheel ring = Horoskopring. Table = Tabelle; aspect = Aspekt.
8. Для счётчиков предпочитать естественные формы «Kein Horoskop», «1 Horoskop», «{count} Horoskope» и существующие singular/plural ключи. Если placeholder должен присутствовать и при нуле, использовать «0 Horoskope». Подпись «Anzahl der Horoskope: {count}» допустима в таблице показателей, но не должна заменять живые формулировки во всём интерфейсе. Если нужна грамматическая форма, добавлять узкую пару keys/Intl.PluralRules, не ICU/framework ради этой задачи. Проверять 0/1/2. Не менять глобальную семантику t().
9. Для клиента как человека использовать Klient/Klientin в контексте; для списка допустимо Klienten, для абстрактных элементов Profile. Не заменять автоматически каждое client на Kunde: это меняет тон продукта.
10. Длинный tooltip объясняет сокращённую подпись; не сокращать все фразы до непонятных аббревиатур ради ширины кнопки. Сначала использовать краткую формулировку/перенос.
11. Перевод существующих юридических/ценовых текстов сохраняет числа, сроки, валюты, контакты и смысл. Новые рыночные обещания и правовые положения не добавлять.
12. Отчёты по реальным консультациям отражают речь и форму обращения исходного разговора; требование Sie относится к системным текстам. Не переписывать чужие цитаты и исторические документы.

## Как получить естественный текст, а не пословный перевод

**Ориентир:** спокойный профессиональный сервис, который говорит с человеком напрямую. Формальное Sie не требует канцелярита. Термины астрологии сохраняются там, где помогают специалисту; обычные действия описываются обычными словами.

- Перед переводом определить экран, элемент и действие. `Apply` у настройки — «Übernehmen», у выполнения команды — «Anwenden». `Reset` у настроек — «Zurücksetzen», у отмены последнего действия — «Rückgängig machen». Нельзя выбрать один вариант для всех вхождений.
- Переписывать фразу целиком на немецком, сохраняя смысл. Английский порядок слов, существительные и повторы не являются шаблоном. Русский контекст в snapshot помогает понять функцию, но тоже не задаёт немецкую конструкцию.
- Избегать «erfolgreich durchgeführt», «Durchführung der Berechnung», «die angeforderte Ressource», «Bitte beachten Sie, dass» там, где достаточно «Gespeichert», «Wird berechnet …», «Der gesuchte Inhalt» или прямого предложения.
- Не добавлять эмоции, восклицательные знаки, «Oops», «Super!» и рекламные эпитеты в рабочие статусы. Живой язык здесь означает понятность и естественный ритм, а не фамильярность.
- Ошибка сообщает, что случилось, и при наличии реального действия — что можно сделать. Не обвинять пользователя и не предлагать повторить действие, если это не поможет. У access denied не выдумывать ссылку на поддержку; у сохранения не предлагать повтор с риском дубликата без проверки сценария.
- «Bitte» уместно в просьбе, но не обязательно в каждой строке. Использовать «Sie» только там, где есть обращение, а не превращать заголовки/кнопки в длинные инструкции.
- Избегать выдуманных длинных сложных слов: «Mehrere Horoskopringe» понятнее «Mehrringansicht». Настоящие термины вроде «Sonnenbogendirektion» не упрощать до потери точности.
- Полный термин в глоссарии — ориентир по смыслу, не обязательная подпись в каждом месте. Поле уже внутри Geburtsdaten может называться «Ort», а отдельно — «Geburtsort». Падеж, число и регистр зависят от предложения.
- В приветствии, empty state и пояснении допустима тёплая интонация: «Hier erscheinen Ihre gespeicherten Horoskope.» В ошибках и предупреждениях важнее точность.

### Образцы редакторского выбора

| Контекст | Не использовать как кальку | Предпочтительная формулировка |
|---|---|---|
| Сохранение завершено | Ihre Änderungen wurden erfolgreich gespeichert. | Änderungen gespeichert. |
| Загрузка карты | Das Laden Ihres Horoskops wird durchgeführt. | Ihr Horoskop wird geladen … |
| Пустой список | Es sind keine Horoskope verfügbar. | Noch keine Horoskope gespeichert. |
| Запись отсутствует | Keine Aufnahme ist vorhanden. | Noch keine Aufnahme vorhanden. |
| Поиск без совпадений | Keine Resultate wurden gefunden. | Keine passenden Ergebnisse gefunden. |
| Повтор после ошибки | Wiederholen Sie den Versuch. | Bitte versuchen Sie es erneut. |
| Поле поиска места рождения | Geben Sie Ihre Geburtsortinformation ein. | Geburtsort eingeben |
| Обновить настройки | Wenden Sie Ihre Einstellungen an. | Einstellungen übernehmen |
| Выбор интервала | Treffen Sie eine Auswahl des Zeitraums. | Wählen Sie einen Zeitraum. |

Это образцы для соответствующего сценария, не новые ключи и не готовые замены без проверки контекста. Например, «Noch keine …» подходит пустому списку до первого создания, но не ошибке загрузки и не поиску без совпадений.

### Обязательная редактура после чернового перевода

Каждый пакет проходит два раздельных чтения: сначала перевод с исходником, затем редактура **только немецкого текста** в порядке его появления на экране. На втором проходе исходник открывается вновь только для сверки смысла после правки. Задача второго прохода — переписать кальки, проверить ритм, управление глаголов, артикли, падежи и повторы, а не поставить отметку «прочитано».

После перевода пакетов собрать связанные тексты одного экрана, даже если они лежат в разных namespaces: заголовок → пояснение → поле → кнопка → результат/ошибка. Проверить, что они обращаются к одной аудитории и называют одно действие одинаково. Письма читать целиком, включая тему. Фразы с параметрами — с реалистичными подстановками (0/1/2, длинное имя, дата, название города).

Для каждого пакета хранить отдельно статусы `translated` и `editorially_reviewed`; во втором статусе — проверенные ключи/диапазон и краткие замечания. Нельзя считать пакет отредактированным по одному выборочному примеру. Автоматические gates подтверждают структуру, но не естественность языка. Итоговый отчёт должен честно отличать редактуру моделью от проверки носителем; проверку носителем не заявлять без её фактического проведения.

## Основной глоссарий

| Исходный термин / контекст | Немецкий вариант |
|---|---|
| Natal chart / birth chart | Geburtshoroskop |
| Radix, короткая подпись | Radix |
| Chart (астрология) | Horoskop |
| Chart (график данных) | Diagramm |
| Birth data | Geburtsdaten |
| Birth time / birth place | Geburtszeit / Geburtsort |
| Forecast | Prognose |
| Transit / transits | Transit / Transite |
| Progression / secondary progression | Progression / Sekundärprogression |
| Direction | Direktion |
| Solar arc direction | Sonnenbogendirektion |
| Solar return (полная подпись / короткая) | Solarhoroskop / Solar |
| Lunar return | Lunarhoroskop |
| Synastry | Synastrie |
| Composite, midpoint method | Komposit |
| Davison relationship chart | Kombin (Davison) |
| House / houses | Haus / Häuser |
| House system | Häusersystem |
| House cusp | Häuserspitze |
| Equal houses | Äqualhäuser |
| Whole Sign houses | Ganzzeichenhäuser |
| Zodiac sign | Tierkreiszeichen |
| Tropical / sidereal zodiac | Tropischer / siderischer Tierkreis |
| Ayanamsha | Ayanamsha |
| Ascendant / Descendant | Aszendent / Deszendent |
| Midheaven / IC | Medium Coeli / Imum Coeli |
| AC / DC / MC / IC | Сохранять принятые в продукте символы, не менять enum ASC/DSC |
| Ruler / rulership | Herrscher / Herrschaft |
| Dispositor / dispositor chain | Dispositor / Dispositorenkette |
| Mutual reception | Gegenseitige Rezeption |
| Dignities | Würden |
| Domicile / exaltation | Domizil / Erhöhung |
| Detriment / fall | Exil / Fall |
| Retrograde / direct / stationary | Rückläufig / direktläufig / stationär |
| Applying / separating aspect | Applikativer / separativer Aspekt |
| Orb | Orbis |
| Declination | Deklination |
| Fixed stars | Fixsterne |
| Lunar node | Mondknoten |
| North / south node | Aufsteigender / absteigender Mondknoten |
| True / mean node | Wahrer / mittlerer Mondknoten |
| Lilith / Black Moon | Lilith / Schwarzer Mond |
| Selena / White Moon | Selena / Weißer Mond |
| Part of Fortune | Glückspunkt |
| Antiscia | Antiszien |
| Profection | Profektion |
| Element / modality | Element / Modalität |
| Fire / Earth / Air / Water | Feuer / Erde / Luft / Wasser |
| Cardinal / Fixed / Mutable | Kardinal / Fix / Veränderlich |
| Layer / add layer | Ebene / Ebene hinzufügen |
| Single wheel / multi wheel | Einzelansicht / Mehrere Horoskopringe (кратко: Mehrere Ringe) |
| Swap charts | Horoskope tauschen |
| Timeline | Zeitverlauf |
| Settings / account settings | Einstellungen / Kontoeinstellungen |
| Practice (рабочая область) | Praxis |
| Client profile | Klientenprofil |
| Consultation / recording | Beratung / Aufnahme |
| Transcript / summary | Transkript / Zusammenfassung |
| Interpretation | Deutung |
| Time zone | Zeitzone |
| Save / cancel / close / retry | Speichern / Abbrechen / Schließen / Erneut versuchen |
| Sign in / sign out | Anmelden / Abmelden |
| Create account | Konto erstellen |
| Verify email | E-Mail-Adresse bestätigen |
| Reset password | Passwort zurücksetzen |
| Language | Sprache |

Термины Komposit, Kombin и Solarhoroskop сверены по [списку типов гороскопов Astrodienst](https://www.astro.com/cgi/h.cgi?f=gch&h=gchrtype&lang=g&nhor=2). Würden и названия Domizil/Erhöhung/Exil/Fall — по [Astrodienst: Würde](https://www.astro.com/astrowiki/de/Akzidentielle_W%C3%BCrden); Rezeption — по [Astrodienst: Rezeption](https://www.astro.com/astrowiki/de/Rezeption). Остальные варианты здесь — редакционный глоссарий для согласованности, не цитаты из источников.

## Планеты и знаки

| EN | DE |
|---|---|
| Sun | Sonne |
| Moon | Mond |
| Mercury | Merkur |
| Venus | Venus |
| Mars | Mars |
| Jupiter | Jupiter |
| Saturn | Saturn |
| Uranus | Uranus |
| Neptune | Neptun |
| Pluto | Pluto |
| Chiron | Chiron |
| Aries | Widder |
| Taurus | Stier |
| Gemini | Zwillinge |
| Cancer | Krebs |
| Leo | Löwe |
| Virgo | Jungfrau |
| Libra | Waage |
| Scorpio | Skorpion |
| Sagittarius | Schütze |
| Capricorn | Steinbock |
| Aquarius | Wassermann |
| Pisces | Fische |

## Аспекты и конфигурации

| EN / stable key | DE |
|---|---|
| Conjunction | Konjunktion |
| Opposition | Opposition |
| Square | Quadrat |
| Trine | Trigon |
| Sextile | Sextil |
| Quincunx | Quinkunx |
| Semisextile | Halbsextil |
| Semisquare | Halbquadrat |
| Sesquiquadrate | Anderthalbquadrat |
| Quintile / Biquintile | Quintil / Biquintil |
| Novile / Septile | Novil / Septil |
| Grand_Trine | Großes Trigon |
| Grand_Cross | Großes Kreuz |
| T_Square | T-Quadrat |
| Kite | Drachenfigur |
| Mystic_Rectangle | Mystisches Rechteck |
| Yod | Yod |

Редкие аспекты `Semi_Nonagon`, `Nonagon`, `Binonagon`, `Sentagon`, `Vigintile`, `Tridecile` и авторские конфигурации не переименовывать в другой метод. При отсутствии ясного немецкого эквивалента сохранять термин и уточнять угол из существующих seeds/справочника. Например, `Sentagon (100°)` — подтверждён seed `02_aspect_types.sql`; нельзя случайно превратить его в Septil. Перед переводом Chariot/Sail/Open_Envelope читать соответствующий исходный смысл, не объединять похожие конфигурации. Такие записи вынести в короткий список редакционной проверки, а не оставлять английские абзацы.

## Готовые образцы для API errors.py

| error_code | de |
|---|---|
| BAD_REQUEST | Ungültige Anfrage. |
| UNAUTHORIZED | Bitte melden Sie sich an. |
| FORBIDDEN | Zugriff verweigert. |
| NOT_FOUND | Der gesuchte Inhalt wurde nicht gefunden. |
| REQUEST_TIMEOUT | Die Anfrage hat zu lange gedauert. Bitte versuchen Sie es erneut. |
| SERVICE_UNAVAILABLE | Der Dienst ist vorübergehend nicht verfügbar. |
| VALIDATION_ERROR | Bitte überprüfen Sie Ihre Eingaben. |
| INTERNAL_ERROR | Ein technischer Fehler ist aufgetreten. Bitte versuchen Sie es erneut. |
| INVALID_USER_ID | Die Benutzer-ID hat ein ungültiges Format. |
| NATAL_CHART_NOT_FOUND | Das Geburtshoroskop wurde nicht gefunden. |
| INTERPRETATION_NOT_FOUND | Die Deutung wurde nicht gefunden. |
| USER_NOT_FOUND | Das Profil wurde nicht gefunden. |
| ACCESS_DENIED | Zugriff verweigert. |
| ADMIN_ENDPOINTS_DISABLED | Die Admin-Schnittstellen sind deaktiviert. |
| GEOCODING_TIMEOUT | Die Ortssuche hat zu lange gedauert. Bitte versuchen Sie es erneut. |
| GEOCODING_UNAVAILABLE | Die Ortssuche ist vorübergehend nicht verfügbar. |

USER_NOT_FOUND в нынешнем домене users может обозначать профиль человека, а не login-аккаунт; сверить вызывающий контекст, не менять error_code.

## Готовые письма (соответствуют текущим пяти полям mailer.py)

### Password reset

- subject: `AstroBot: Passwort zurücksetzen`
- line1: `Sie haben einen Link angefordert, um Ihr AstroBot-Passwort zurückzusetzen.`
- line2: `Legen Sie über diesen Link ein neues Passwort fest: {reset_link}`
- line3: `Dieser Link ist {ttl_minutes} Minuten gültig und kann nur einmal verwendet werden.`
- line4: `Falls die Anfrage nicht von Ihnen stammt, können Sie diese E-Mail ignorieren.`

### Email verification

- subject: `AstroBot: E-Mail-Adresse bestätigen`
- line1: `Willkommen bei AstroBot.`
- line2: `Bestätigen Sie Ihre E-Mail-Adresse über diesen Link: {verify_link}`
- line3: `Dieser Link ist {ttl_hours} Stunden gültig und kann nur einmal verwendet werden.`
- line4: `Falls Sie dieses Konto nicht erstellt haben, können Sie diese E-Mail ignorieren.`

Если существующая конфигурация допускает TTL=1, использовать `1 Minute`/`1 Stunde`; выбрать форму на уровне сборки данного предложения. Не переводить подставляемые URL.

## Подтверждённые строки вне каталога: образцы

| Текущий смысл | DE |
|---|---|
| Подтвердите: | Bitte bestätigen Sie: |
| Применить | Anwenden |
| Отмена | Abbrechen |
| Слой не выбран | Keine Ebene ausgewählt |
| Добавьте слой для расчёта | Fügen Sie eine Ebene hinzu, um die Berechnung zu starten. |
| — партнёр — | — Partnerprofil — |
| Transcription in progress… | Das Transkript wird erstellt … |
| Processing timed out. Retry | Die Verarbeitung hat zu lange gedauert. Bitte versuchen Sie es erneut. |
| More tabs | Weitere Ansichten (для меню видов карты; для настоящих вкладок: Weitere Tabs) |
| Custom step | Eigene Schrittweite |
| Step units | Sekunde(n), Minute(n), Stunde(n), Tag(e), Woche(n), Monat(e), Jahr(e) — реальные формы вместо скобок в UI |
| Switched to multi-wheel mode. | Zur Ansicht mit mehreren Horoskopringen gewechselt. |
| Switched to single-wheel mode. | Zur Einzelansicht gewechselt. |
| Canned meaning refusal | Ich biete keine Deutung der Konfigurationen an. Ich kann Ihnen aber die zugehörigen Daten und Berechnungen zeigen. Welche Werte interessieren Sie? |

Согласие на запись (три существующих предложения; не менять содержание согласия):

> Ihre Astrologin oder Ihr Astrologe möchte dieses Gespräch aufzeichnen. Aufgenommen wird nur der Ton, kein Video. Aus der Aufnahme wird eine Zusammenfassung für Sie erstellt.

## Проверка каждого пакета

- Все keys пакета представлены, ничего не удалено/переименовано; нет пустых значений.
- Формальное Sie, одинаковые термины и предсказуемые кнопки; выполнен отдельный проход editorially_reviewed по всем строкам пакета.
- Placeholder-мультимножество и HTML-семантика совпадают с источником.
- Нет случайной кириллицы/английских предложений; имена собственные рассматриваются отдельно.
- Длинные labels отмечены для browser QA; краткая и полная формы не перепутаны.
- Не добавлены новые обещания функций, гарантии точности, цены или условия.
- После merge заново сравнить keyset с актуальным en: новые ключи из DE-2/DE-5 отсутствуют в исходном snapshot и требуют отдельного перевода.

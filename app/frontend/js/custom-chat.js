/**
 * Custom chat widget for chart + forecast pages.
 *
 * Keeps the current backend contract (streaming, history, STT),
 * but renders a richer product UI tailored to the app.
 */
(function () {
    'use strict';

    const API_BASE = '/api/v1';
    const USERID_STORAGE_KEY = 'astrobot_user_id';
    const FALLBACK_COPY = {
        en: {
            'chatkit.natal.composerPlaceholder': 'Type your question about this chart...',
            'chatkit.natal.greeting': 'Ask me anything about this natal chart.',
            'chatkit.prognostic.composerPlaceholder': 'Ask about current trends and timing...',
            'chatkit.prognostic.greeting': 'I can help explain active transits, directions and progressions.',
            'chatkit.prognostic.prompts.transitsToday.label': "Today's transits",
            'chatkit.prognostic.prompts.transitsToday.prompt': 'Summarize the most important transits active today.',
            'chatkit.prognostic.prompts.monthly.label': 'Month overview',
            'chatkit.prognostic.prompts.monthly.prompt': 'Give a practical forecast for this month.',
            'chatkit.prognostic.prompts.solar.label': 'Solar return focus',
            'chatkit.prognostic.prompts.solar.prompt': 'Explain key themes from the solar return chart.',
            'customChat.assistantLabel': 'Steliara AI',
            'customChat.sendButton': 'Send',
            'customChat.thinking': 'Thinking...',
            'customChat.thinkingFirstRun': 'Preparing your personal analysis — this takes 2–3 minutes, follow-up replies will be much faster',
            'customChat.toolCalling': 'Analyzing {tool}...',
            'customChat.errorGeneric': 'Something went wrong. Please try again.',
            'customChat.errorNetwork': 'Network error. Check your connection.',
            'customChat.newConversation': 'New conversation',
            'customChat.micStart': 'Start voice input',
            'customChat.micStop': 'Stop recording',
            'customChat.micRecording': 'Listening...',
            'customChat.micTranscribing': 'Transcribing...',
            'customChat.micDenied': 'Microphone access denied. Check browser permissions.',
            'customChat.micError': 'Could not access microphone.',
            'customChat.history': 'History',
            'customChat.historyBack': 'Back',
            'customChat.historyEmpty': 'No conversations yet',
            'customChat.deleteConversation': 'Delete conversation',
            'customChat.untitledConversation': 'New conversation',
            'customChat.modeNatal': 'Natal chart',
            'customChat.modePrognostic': 'Forecast',
            'customChat.subtitleNatal': 'Ask about placements, patterns, strengths and tensions in the chart.',
            'customChat.subtitlePrognostic': 'Discuss transits, progressions and near-term astrological timing.',
            'customChat.statusReady': 'Ready',
            'customChat.statusListening': 'Listening',
            'customChat.statusTranscribing': 'Transcribing',
            'customChat.statusThinking': 'Thinking',
            'customChat.composerHint': 'Enter sends, Shift+Enter adds a new line',
            'customChat.voiceHint': 'Voice is great for quick follow-up questions',
            'customChat.startEyebrow': 'Astrology copilot',
            'customChat.startActionsVoice': 'Speak',
            'customChat.startActionsHistory': 'History',
            'customChat.promptGroup': 'Try one of these',
            'customChat.natalPrompts.overview.label': 'Chart overview',
            'customChat.natalPrompts.overview.prompt': 'Give me an overall reading of my natal chart: main themes, personality, and standout patterns.',
            'customChat.natalPrompts.strengths.label': 'Strengths',
            'customChat.natalPrompts.strengths.prompt': 'What strengths and talents stand out the most in my natal chart?',
            'customChat.natalPrompts.tensions.label': 'Growth edges',
            'customChat.natalPrompts.tensions.prompt': 'What core tensions or growth edges are most visible in my natal chart?',
            'customChat.justNow': 'just now',
            'customChat.minutesAgo': '{n} min ago',
            'customChat.hoursAgo': '{n}h ago',
            'customChat.daysAgo': '{n}d ago',
        },
        ru: {
            'chatkit.natal.composerPlaceholder': 'Введите ваш вопрос по этой карте...',
            'chatkit.natal.greeting': 'Спросите меня что угодно об этой натальной карте.',
            'chatkit.prognostic.composerPlaceholder': 'Спросите о текущих тенденциях и тайминге...',
            'chatkit.prognostic.greeting': 'Я помогу объяснить активные транзиты, дирекции и прогрессии.',
            'chatkit.prognostic.prompts.transitsToday.label': 'Транзиты сегодня',
            'chatkit.prognostic.prompts.transitsToday.prompt': 'Кратко опишите самые важные активные сегодня транзиты.',
            'chatkit.prognostic.prompts.monthly.label': 'Обзор месяца',
            'chatkit.prognostic.prompts.monthly.prompt': 'Дайте практический прогноз на этот месяц.',
            'chatkit.prognostic.prompts.solar.label': 'Фокус соляра',
            'chatkit.prognostic.prompts.solar.prompt': 'Объясните ключевые темы карты соляра.',
            'customChat.assistantLabel': 'Steliara AI',
            'customChat.sendButton': 'Отправить',
            'customChat.thinking': 'Думаю...',
            'customChat.thinkingFirstRun': 'Готовлю ваш персональный анализ — это займёт 2–3 минуты, следующие ответы будут значительно быстрее',
            'customChat.toolCalling': 'Анализирую {tool}...',
            'customChat.errorGeneric': 'Что-то пошло не так. Попробуйте ещё раз.',
            'customChat.errorNetwork': 'Ошибка сети. Проверьте подключение.',
            'customChat.newConversation': 'Новый разговор',
            'customChat.micStart': 'Голосовой ввод',
            'customChat.micStop': 'Остановить запись',
            'customChat.micRecording': 'Слушаю...',
            'customChat.micTranscribing': 'Транскрибирую...',
            'customChat.micDenied': 'Доступ к микрофону запрещён. Проверьте настройки браузера.',
            'customChat.micError': 'Не удалось получить доступ к микрофону.',
            'customChat.history': 'История',
            'customChat.historyBack': 'Назад',
            'customChat.historyEmpty': 'Пока нет разговоров',
            'customChat.deleteConversation': 'Удалить разговор',
            'customChat.untitledConversation': 'Новый разговор',
            'customChat.modeNatal': 'Натальная карта',
            'customChat.modePrognostic': 'Прогноз',
            'customChat.subtitleNatal': 'Спрашивайте о планетах, паттернах, сильных сторонах и напряжениях карты.',
            'customChat.subtitlePrognostic': 'Обсуждайте транзиты, прогрессии и ближайший астрологический тайминг.',
            'customChat.statusReady': 'Готов',
            'customChat.statusListening': 'Слушаю',
            'customChat.statusTranscribing': 'Расшифровываю',
            'customChat.statusThinking': 'Анализирую',
            'customChat.composerHint': 'Enter отправляет, Shift+Enter переносит строку',
            'customChat.voiceHint': 'Голос удобен для быстрых уточнений',
            'customChat.startEyebrow': 'Астрологический copilot',
            'customChat.startActionsVoice': 'Сказать',
            'customChat.startActionsHistory': 'История',
            'customChat.promptGroup': 'Можно начать так',
            'customChat.natalPrompts.overview.label': 'Общий обзор',
            'customChat.natalPrompts.overview.prompt': 'Дайте общий обзор моей натальной карты: главные акценты, характер и ключевые темы.',
            'customChat.natalPrompts.strengths.label': 'Сильные стороны',
            'customChat.natalPrompts.strengths.prompt': 'Какие сильные стороны и таланты особенно заметны в моей натальной карте?',
            'customChat.natalPrompts.tensions.label': 'Точки роста',
            'customChat.natalPrompts.tensions.prompt': 'Какие главные внутренние напряжения и зоны роста видны в моей натальной карте?',
            'customChat.justNow': 'только что',
            'customChat.minutesAgo': '{n} мин назад',
            'customChat.hoursAgo': '{n}ч назад',
            'customChat.daysAgo': '{n}д назад',
        },
        uk: {
            'chatkit.natal.composerPlaceholder': 'Введіть ваше запитання щодо цієї карти...',
            'chatkit.natal.greeting': 'Питайте будь-що про цю натальну карту.',
            'chatkit.prognostic.composerPlaceholder': 'Запитайте про поточні тенденції та таймінг...',
            'chatkit.prognostic.greeting': 'Я допоможу пояснити активні транзити, дирекції та прогресії.',
            'chatkit.prognostic.prompts.transitsToday.label': 'Транзити сьогодні',
            'chatkit.prognostic.prompts.transitsToday.prompt': 'Підсумуйте найважливіші транзити, активні сьогодні.',
            'chatkit.prognostic.prompts.monthly.label': 'Огляд місяця',
            'chatkit.prognostic.prompts.monthly.prompt': 'Дайте практичний прогноз на цей місяць.',
            'chatkit.prognostic.prompts.solar.label': 'Фокус соляра',
            'chatkit.prognostic.prompts.solar.prompt': 'Поясніть ключові теми з карти соляра.',
            'customChat.assistantLabel': 'Steliara AI',
            'customChat.sendButton': 'Надіслати',
            'customChat.thinking': 'Думаю...',
            'customChat.thinkingFirstRun': 'Готую ваш персональний аналіз — це займе 2–3 хвилини, наступні відповіді будуть значно швидшими',
            'customChat.toolCalling': 'Аналізую {tool}...',
            'customChat.errorGeneric': 'Щось пішло не так. Спробуйте ще раз.',
            'customChat.errorNetwork': 'Помилка мережі. Перевірте підключення.',
            'customChat.newConversation': 'Нова розмова',
            'customChat.micStart': 'Голосовий ввід',
            'customChat.micStop': 'Зупинити запис',
            'customChat.micRecording': 'Слухаю...',
            'customChat.micTranscribing': 'Транскрибую...',
            'customChat.micDenied': 'Доступ до мікрофона заборонено. Перевірте налаштування браузера.',
            'customChat.micError': 'Не вдалося отримати доступ до мікрофона.',
            'customChat.history': 'Історія',
            'customChat.historyBack': 'Назад',
            'customChat.historyEmpty': 'Поки немає розмов',
            'customChat.deleteConversation': 'Видалити розмову',
            'customChat.untitledConversation': 'Нова розмова',
            'customChat.modeNatal': 'Натальна карта',
            'customChat.modePrognostic': 'Прогноз',
            'customChat.subtitleNatal': 'Запитуйте про планети, патерни, сильні сторони й напруги карти.',
            'customChat.subtitlePrognostic': 'Обговорюйте транзити, прогресії та найближчий астрологічний таймінг.',
            'customChat.statusReady': 'Готово',
            'customChat.statusListening': 'Слухаю',
            'customChat.statusTranscribing': 'Розшифровую',
            'customChat.statusThinking': 'Аналізую',
            'customChat.composerHint': 'Enter надсилає, Shift+Enter переносить рядок',
            'customChat.voiceHint': 'Голос зручний для швидких уточнень',
            'customChat.startEyebrow': 'Астрологічний copilot',
            'customChat.startActionsVoice': 'Сказати',
            'customChat.startActionsHistory': 'Історія',
            'customChat.promptGroup': 'Можна почати так',
            'customChat.natalPrompts.overview.label': 'Огляд карти',
            'customChat.natalPrompts.overview.prompt': 'Дайте загальний огляд моєї натальної карти: головні теми, характер і ключові патерни.',
            'customChat.natalPrompts.strengths.label': 'Сильні сторони',
            'customChat.natalPrompts.strengths.prompt': 'Які сильні сторони та таланти найбільше виділяються в моїй натальній карті?',
            'customChat.natalPrompts.tensions.label': 'Точки росту',
            'customChat.natalPrompts.tensions.prompt': 'Які головні внутрішні напруги або зони росту найбільше видно в моїй натальній карті?',
            'customChat.justNow': 'щойно',
            'customChat.minutesAgo': '{n} хв тому',
            'customChat.hoursAgo': '{n}г тому',
            'customChat.daysAgo': '{n}д тому',
        },
    };

    let initialized = false;
    let containerEl = null;
    let chatContainerEl = null;
    let messagesEl = null;
    let composerInput = null;
    let composerHintEl = null;
    let sendBtn = null;
    let micBtn = null;
    let startScreenEl = null;
    let historyPanelEl = null;
    let presenceEl = null;
    let modePillEl = null;
    let subtitleEl = null;
    let mode = 'natal';
    let previousResponseId = null;
    let conversationId = null;
    let isStreaming = false;
    let currentStreamEl = null;
    let currentStreamText = '';
    let uiState = 'idle';
    let resizeObserver = null;
    let localeChangeHandler = null;

    let mediaRecorder = null;
    let mediaStream = null;
    let audioChunks = [];
    let isRecording = false;

    function t(key, params) {
        return window.FrontendI18n?.t?.(key, params) || key;
    }

    function normalizeLocale(locale) {
        if (!locale || typeof locale !== 'string') return '';
        return locale.trim().toLowerCase().replace(/_/g, '-').split('-', 1)[0];
    }

    function getLocale() {
        const runtimeLocale = normalizeLocale(window.FrontendI18n?.getLocale?.());
        if (runtimeLocale) return runtimeLocale;

        const legacyRuntimeLocale = normalizeLocale(window.FrontendI18n?.currentLocale?.());
        if (legacyRuntimeLocale) return legacyRuntimeLocale;

        const documentLocale = normalizeLocale(document?.documentElement?.lang);
        if (documentLocale) return documentLocale;

        const storedLocale = normalizeLocale(localStorage.getItem('astrobot_locale'));
        if (storedLocale) return storedLocale;

        return 'en';
    }

    function interpolate(template, params) {
        if (typeof template !== 'string' || !params) return template;
        return template.replace(/\{([A-Za-z0-9_]+)\}/g, (_, token) => (
            params[token] === undefined || params[token] === null ? `{${token}}` : String(params[token])
        ));
    }

    function tx(key, params) {
        const translated = t(key, params);
        if (translated !== key) return translated;

        const locale = getLocale();
        const fallback = FALLBACK_COPY[locale]?.[key] || FALLBACK_COPY.en[key];
        if (fallback) {
            return interpolate(fallback, params);
        }

        return translated;
    }

    function withLocaleHeaders(headers) {
        if (window.AstroAPI?.withLocaleHeaders) {
            return window.AstroAPI.withLocaleHeaders(headers);
        }
        return headers || {};
    }

    function getUserId() {
        const chartUserId = localStorage.getItem('currentUserId');
        if (chartUserId) return chartUserId;

        let userId = localStorage.getItem(USERID_STORAGE_KEY);
        if (!userId) {
            userId = 'user_' + crypto.randomUUID();
            localStorage.setItem(USERID_STORAGE_KEY, userId);
        }
        return userId;
    }

    function getPrognosticFrontendContext() {
        if (typeof window.getForecastChatContext === 'function') {
            try {
                return window.getForecastChatContext();
            } catch (error) {
                console.warn('CustomChat: failed to collect forecast context:', error);
            }
        }
        return null;
    }

    function formatRelativeDate(isoStr) {
        if (!isoStr) return '';
        const date = new Date(isoStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMin = Math.floor(diffMs / 60000);

        if (diffMin < 1) return tx('customChat.justNow');
        if (diffMin < 60) return tx('customChat.minutesAgo', { n: diffMin });

        const diffHours = Math.floor(diffMin / 60);
        if (diffHours < 24) return tx('customChat.hoursAgo', { n: diffHours });

        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return tx('customChat.daysAgo', { n: diffDays });

        return date.toLocaleDateString();
    }

    function getDefaultPlaceholder() {
        return tx(
            mode === 'prognostic'
                ? 'chatkit.prognostic.composerPlaceholder'
                : 'chatkit.natal.composerPlaceholder'
        );
    }

    function getModeLabel() {
        return tx(mode === 'prognostic' ? 'customChat.modePrognostic' : 'customChat.modeNatal');
    }

    function getModeSubtitle() {
        return tx(mode === 'prognostic' ? 'customChat.subtitlePrognostic' : 'customChat.subtitleNatal');
    }

    function getStarterPrompts() {
        if (mode === 'prognostic') {
            return [
                {
                    label: tx('chatkit.prognostic.prompts.transitsToday.label'),
                    prompt: tx('chatkit.prognostic.prompts.transitsToday.prompt'),
                },
                {
                    label: tx('chatkit.prognostic.prompts.monthly.label'),
                    prompt: tx('chatkit.prognostic.prompts.monthly.prompt'),
                },
                {
                    label: tx('chatkit.prognostic.prompts.solar.label'),
                    prompt: tx('chatkit.prognostic.prompts.solar.prompt'),
                },
            ];
        }

        return [
            {
                label: tx('customChat.natalPrompts.overview.label'),
                prompt: tx('customChat.natalPrompts.overview.prompt'),
            },
            {
                label: tx('customChat.natalPrompts.strengths.label'),
                prompt: tx('customChat.natalPrompts.strengths.prompt'),
            },
            {
                label: tx('customChat.natalPrompts.tensions.label'),
                prompt: tx('customChat.natalPrompts.tensions.prompt'),
            },
        ];
    }

    function getPresenceLabel() {
        if (uiState === 'recording') return tx('customChat.statusListening');
        if (uiState === 'transcribing') return tx('customChat.statusTranscribing');
        if (uiState === 'streaming') return tx('customChat.statusThinking');
        return tx('customChat.statusReady');
    }

    function getComposerHint() {
        if (uiState === 'recording') return tx('customChat.micStop');
        if (uiState === 'transcribing') return tx('customChat.micTranscribing');
        if (uiState === 'streaming') return tx('customChat.thinking');
        return isMicSupported() ? tx('customChat.voiceHint') : tx('customChat.composerHint');
    }

    function updateTopbar() {
        if (modePillEl) modePillEl.textContent = getModeLabel();
        if (subtitleEl) subtitleEl.textContent = getModeSubtitle();
        if (presenceEl) presenceEl.textContent = getPresenceLabel();
    }

    function setUiState(nextState) {
        uiState = nextState;

        if (chatContainerEl) {
            chatContainerEl.classList.toggle('is-recording', nextState === 'recording');
            chatContainerEl.classList.toggle('is-transcribing', nextState === 'transcribing');
            chatContainerEl.classList.toggle('is-streaming', nextState === 'streaming');
        }

        if (presenceEl) {
            presenceEl.textContent = getPresenceLabel();
        }

        if (composerHintEl) {
            composerHintEl.textContent = getComposerHint();
        }

        if (composerInput) {
            if (nextState === 'recording') {
                composerInput.placeholder = tx('customChat.micRecording');
            } else if (nextState === 'transcribing') {
                composerInput.placeholder = tx('customChat.micTranscribing');
            } else {
                composerInput.placeholder = getDefaultPlaceholder();
            }
        }

        syncComposerAvailability();
    }

    function isMicSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    function syncComposerAvailability() {
        const busy = isStreaming || uiState === 'transcribing';
        const hasText = Boolean(composerInput?.value.trim());

        if (composerInput) {
            composerInput.disabled = busy;
        }

        if (sendBtn) {
            sendBtn.disabled = busy || isRecording || !hasText;
        }

        if (micBtn) {
            micBtn.disabled = busy;
            micBtn.classList.toggle('recording', uiState === 'recording');
            micBtn.classList.toggle('transcribing', uiState === 'transcribing');
            micBtn.title = uiState === 'recording'
                ? tx('customChat.micStop')
                : tx('customChat.micStart');
        }
    }

    function escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderMarkdown(text) {
        if (!text) return '';

        const codeBlocks = [];
        const inlineCode = [];
        let processed = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, _lang, code) => {
            const idx = codeBlocks.length;
            codeBlocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`);
            return `\x00CB${idx}\x00`;
        });

        processed = processed.replace(/`([^`]+)`/g, (_, code) => {
            const idx = inlineCode.length;
            inlineCode.push(`<code>${escapeHtml(code)}</code>`);
            return `\x00IC${idx}\x00`;
        });

        processed = escapeHtml(processed);

        processed = processed.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        processed = processed.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        processed = processed.replace(/^# (.+)$/gm, '<h1>$1</h1>');

        processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        processed = processed.replace(/\*(.+?)\*/g, '<em>$1</em>');
        processed = processed.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

        processed = processed.replace(/(^|\n)((?:[-*] .+(?:\n|$))+)/g, (_match, prefix, list) => {
            const items = list
                .trim()
                .split('\n')
                .map((line) => `<li>${line.replace(/^[-*] /, '')}</li>`)
                .join('');
            return `${prefix}<ul>${items}</ul>`;
        });

        processed = processed.replace(/(^|\n)((?:\d+\. .+(?:\n|$))+)/g, (_match, prefix, list) => {
            const items = list
                .trim()
                .split('\n')
                .map((line) => `<li>${line.replace(/^\d+\. /, '')}</li>`)
                .join('');
            return `${prefix}<ol>${items}</ol>`;
        });

        processed = processed.replace(/\n{2,}/g, '</p><p>');
        processed = processed.replace(/\n/g, '<br>');
        processed = `<p>${processed}</p>`;

        processed = processed.replace(/<p>\s*<\/p>/g, '');
        processed = processed.replace(/<p>(<(?:h1|h2|h3|ul|ol|pre|blockquote)>)/g, '$1');
        processed = processed.replace(/(<\/(?:h1|h2|h3|ul|ol|pre|blockquote)>)<\/p>/g, '$1');

        processed = processed.replace(/\x00IC(\d+)\x00/g, (_, idx) => inlineCode[Number(idx)]);
        processed = processed.replace(/\x00CB(\d+)\x00/g, (_, idx) => codeBlocks[Number(idx)]);

        return processed;
    }

    function createIconMarkup(kind) {
        if (kind === 'voice') {
            return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"/><path d="M19 11a7 7 0 0 1-14 0"/><path d="M12 18v3"/><path d="M8 21h8"/></svg>';
        }
        if (kind === 'history') {
            return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/></svg>';
        }
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';
    }

    function buildTopbar() {
        const topbar = document.createElement('div');
        topbar.className = 'cc-chat-topbar';

        const intro = document.createElement('div');
        intro.className = 'cc-chat-topbar-copy';

        modePillEl = document.createElement('span');
        modePillEl.className = 'cc-chat-mode-pill';
        intro.appendChild(modePillEl);

        subtitleEl = document.createElement('p');
        subtitleEl.className = 'cc-chat-subtitle';
        intro.appendChild(subtitleEl);

        presenceEl = document.createElement('span');
        presenceEl.className = 'cc-chat-presence';

        topbar.appendChild(intro);
        topbar.appendChild(presenceEl);
        updateTopbar();

        return topbar;
    }

    function buildStartAction(kind, label, onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cc-start-action';
        button.innerHTML = `${createIconMarkup(kind)}<span>${label}</span>`;
        button.addEventListener('click', onClick);
        return button;
    }

    function buildStartScreen() {
        const screen = document.createElement('div');
        screen.className = 'custom-chat-start-screen';

        const eyebrow = document.createElement('div');
        eyebrow.className = 'cc-start-eyebrow';
        eyebrow.textContent = tx('customChat.startEyebrow');
        screen.appendChild(eyebrow);

        const title = document.createElement('div');
        title.className = 'cc-start-title';
        title.textContent = tx(
            mode === 'prognostic'
                ? 'chatkit.prognostic.greeting'
                : 'chatkit.natal.greeting'
        );
        screen.appendChild(title);

        const copy = document.createElement('p');
        copy.className = 'cc-start-copy';
        copy.textContent = getModeSubtitle();
        screen.appendChild(copy);

        const actions = document.createElement('div');
        actions.className = 'cc-start-actions';

        if (isMicSupported()) {
            actions.appendChild(
                buildStartAction('voice', tx('customChat.startActionsVoice'), () => {
                    composerInput?.focus();
                    toggleRecording();
                })
            );
        }

        actions.appendChild(
            buildStartAction('history', tx('customChat.startActionsHistory'), showHistoryPanel)
        );
        screen.appendChild(actions);

        const promptTitle = document.createElement('div');
        promptTitle.className = 'cc-start-prompts-title';
        promptTitle.textContent = tx('customChat.promptGroup');
        screen.appendChild(promptTitle);

        const prompts = document.createElement('div');
        prompts.className = 'cc-start-prompts';

        getStarterPrompts().forEach((promptData, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'cc-starter-prompt-btn';
            button.innerHTML = `<span class="cc-starter-index">0${index + 1}</span><span>${promptData.label}</span>`;
            button.addEventListener('click', () => sendMessage(promptData.prompt));
            prompts.appendChild(button);
        });

        screen.appendChild(prompts);
        return screen;
    }

    function rerenderStartScreen() {
        if (!messagesEl || !startScreenEl || !startScreenEl.parentNode) return;
        const nextStartScreen = buildStartScreen();
        startScreenEl.replaceWith(nextStartScreen);
        startScreenEl = nextStartScreen;
    }

    function createMessageFrame(role) {
        const messageEl = document.createElement('article');
        messageEl.className = `custom-chat-message ${role}`;

        if (role === 'assistant') {
            const avatar = document.createElement('div');
            avatar.className = 'cc-message-avatar';
            avatar.textContent = 'AI';
            messageEl.appendChild(avatar);
        }

        const stack = document.createElement('div');
        stack.className = 'cc-message-stack';

        if (role === 'assistant') {
            const meta = document.createElement('div');
            meta.className = 'cc-message-meta';
            meta.textContent = tx('customChat.assistantLabel');
            stack.appendChild(meta);
        }

        const contentEl = document.createElement('div');
        contentEl.className = 'cc-message-content';
        stack.appendChild(contentEl);

        messageEl.appendChild(stack);
        return { messageEl, contentEl };
    }

    function appendMessage(role, content) {
        const frame = createMessageFrame(role);

        if (role === 'user') {
            frame.contentEl.textContent = content;
        } else {
            frame.contentEl.innerHTML = renderMarkdown(content);
        }

        messagesEl.appendChild(frame.messageEl);
        scrollToBottom();
        return frame.messageEl;
    }

    function createStreamingMessage() {
        const frame = createMessageFrame('assistant');
        messagesEl.appendChild(frame.messageEl);
        currentStreamEl = frame.contentEl;
        currentStreamText = '';
        scrollToBottom();
        return frame.contentEl;
    }

    function updateStreamingMessage(text) {
        currentStreamText += text;
        if (currentStreamEl) {
            currentStreamEl.innerHTML = renderMarkdown(currentStreamText);
            scrollToBottom();
        }
    }

    function finalizeStreamingMessage() {
        currentStreamEl = null;
        currentStreamText = '';
    }

    function showTypingIndicator() {
        removeTypingIndicator();

        // Show extended message for first natal run (no conversation yet)
        const isFirstNatalRun = mode === 'natal' && !conversationId;
        const thinkingText = isFirstNatalRun
            ? tx('customChat.thinkingFirstRun')
            : tx('customChat.thinking');

        const indicator = document.createElement('div');
        indicator.className = 'cc-typing-indicator';
        indicator.id = 'ccTypingIndicator';
        indicator.innerHTML = `
            <div class="cc-message-avatar">AI</div>
            <div class="cc-typing-bubble">
                <span class="cc-typing-dots"><span></span><span></span><span></span></span>
                <span>${thinkingText}</span>
            </div>
        `;
        messagesEl.appendChild(indicator);
        scrollToBottom();
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById('ccTypingIndicator');
        if (indicator) indicator.remove();
    }

    function showToolIndicator(toolName) {
        removeToolIndicator();

        const indicator = document.createElement('div');
        indicator.className = 'cc-tool-indicator';
        indicator.id = 'ccToolIndicator';
        const label = tx('customChat.toolCalling', { tool: toolName });
        indicator.innerHTML = `
            <span class="cc-tool-spinner"></span>
            <span data-tool-name="${escapeHtml(toolName)}">${label}</span>
        `;
        messagesEl.appendChild(indicator);
        scrollToBottom();
    }

    function removeToolIndicator() {
        const indicator = document.getElementById('ccToolIndicator');
        if (indicator) indicator.remove();
    }

    // ── Progress indicators for multi-agent pipeline ──

    const AGENT_LABELS = {
        psychology: { ru: 'Анализ психологического профиля', en: 'Analyzing psychological profile' },
        events: { ru: 'Анализ жизненных событий', en: 'Analyzing life events' },
        karmic: { ru: 'Кармический анализ', en: 'Analyzing karmic patterns' },
        synthesizer: { ru: 'Формирование ответа', en: 'Synthesizing response' },
    };

    function showProgressIndicator(agent, agentStatus) {
        const containerId = 'ccProgressContainer';
        let container = document.getElementById(containerId);

        if (!container) {
            container = document.createElement('div');
            container.className = 'cc-progress-container';
            container.id = containerId;
            messagesEl.appendChild(container);
        }

        const itemId = `ccProgress_${agent}`;
        let item = document.getElementById(itemId);

        if (agentStatus === 'running' && !item) {
            item = document.createElement('div');
            item.className = 'cc-progress-item';
            item.id = itemId;
            const lang = (locale || 'en').startsWith('ru') ? 'ru' : 'en';
            const label = (AGENT_LABELS[agent] || {})[lang] || agent;
            item.innerHTML = `
                <span class="cc-tool-spinner"></span>
                <span>${escapeHtml(label)}...</span>
            `;
            container.appendChild(item);
            scrollToBottom();
        }

        if (agentStatus === 'done' && item) {
            item.classList.add('cc-progress-done');
            const spinner = item.querySelector('.cc-tool-spinner');
            if (spinner) spinner.outerHTML = '<span class="cc-progress-check">✓</span>';
        }

        // Remove container when synthesizer starts (sub-agents done)
        if (agent === 'synthesizer' && agentStatus === 'running' && container) {
            container.remove();
        }
    }

    function removeProgressIndicators() {
        const container = document.getElementById('ccProgressContainer');
        if (container) container.remove();
    }

    function showError(message) {
        const errorEl = document.createElement('div');
        errorEl.className = 'cc-error-message';
        errorEl.textContent = message || tx('customChat.errorGeneric');
        messagesEl.appendChild(errorEl);
        scrollToBottom();
    }

    function scrollToBottom() {
        if (messagesEl) {
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }
    }

    async function fetchConversations() {
        try {
            const response = await fetch(
                `${API_BASE}/chat/conversations?user_id=${encodeURIComponent(getUserId())}&mode=${mode}`,
                { headers: withLocaleHeaders({}) }
            );

            if (!response.ok) return [];
            return await response.json();
        } catch (error) {
            console.error('CustomChat: failed to load conversations:', error);
            return [];
        }
    }

    async function fetchConversationMessages(convId) {
        try {
            const response = await fetch(
                `${API_BASE}/chat/conversations/${convId}/messages`,
                { headers: withLocaleHeaders({}) }
            );

            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error('CustomChat: failed to load messages:', error);
            return null;
        }
    }

    async function deleteConversation(convId) {
        try {
            await fetch(`${API_BASE}/chat/conversations/${convId}`, {
                method: 'DELETE',
                headers: withLocaleHeaders({}),
            });
        } catch (error) {
            console.error('CustomChat: failed to delete conversation:', error);
        }
    }

    function showHistoryPanel() {
        if (!chatContainerEl) return;

        chatContainerEl.classList.add('cc-show-history');

        if (!historyPanelEl) {
            historyPanelEl = document.createElement('div');
            historyPanelEl.className = 'cc-history-panel';
            chatContainerEl.appendChild(historyPanelEl);
        }

        historyPanelEl.innerHTML = '<div class="cc-history-loading"><span class="cc-tool-spinner"></span></div>';

        fetchConversations().then((conversations) => {
            renderHistoryPanel(conversations);
        });
    }

    function hideHistoryPanel() {
        if (!chatContainerEl) return;
        chatContainerEl.classList.remove('cc-show-history');
    }

    function renderHistoryPanel(conversations) {
        if (!historyPanelEl) return;
        historyPanelEl.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'cc-history-header';

        const title = document.createElement('span');
        title.className = 'cc-history-title';
        title.textContent = tx('customChat.history');
        header.appendChild(title);

        const backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.className = 'cc-history-back';
        backBtn.textContent = tx('customChat.historyBack');
        backBtn.addEventListener('click', hideHistoryPanel);
        header.appendChild(backBtn);

        historyPanelEl.appendChild(header);

        const newBtn = document.createElement('button');
        newBtn.type = 'button';
        newBtn.className = 'cc-history-item cc-history-new';
        newBtn.innerHTML = `<span class="cc-history-plus">+</span><span>${tx('customChat.newConversation')}</span>`;
        newBtn.addEventListener('click', () => {
            hideHistoryPanel();
            startNewConversation();
        });
        historyPanelEl.appendChild(newBtn);

        if (conversations.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'cc-history-empty';
            empty.textContent = tx('customChat.historyEmpty');
            historyPanelEl.appendChild(empty);
            return;
        }

        const list = document.createElement('div');
        list.className = 'cc-history-list';

        conversations.forEach((conversation) => {
            const item = document.createElement('div');
            item.className = 'cc-history-item';
            if (conversation.id === conversationId) {
                item.classList.add('active');
            }

            const info = document.createElement('div');
            info.className = 'cc-history-item-info';

            const titleEl = document.createElement('div');
            titleEl.className = 'cc-history-item-title';
            titleEl.textContent = conversation.title || tx('customChat.untitledConversation');
            info.appendChild(titleEl);

            const dateEl = document.createElement('div');
            dateEl.className = 'cc-history-item-date';
            dateEl.textContent = formatRelativeDate(conversation.updated_at);
            info.appendChild(dateEl);

            item.appendChild(info);

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'cc-history-item-delete';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.title = tx('customChat.deleteConversation');
            deleteBtn.addEventListener('click', async (event) => {
                event.stopPropagation();
                await deleteConversation(conversation.id);

                if (conversation.id === conversationId) {
                    startNewConversation();
                }

                item.remove();
            });
            item.appendChild(deleteBtn);

            item.addEventListener('click', () => {
                loadConversation(conversation.id, conversation.last_response_id);
            });

            list.appendChild(item);
        });

        historyPanelEl.appendChild(list);
    }

    async function loadConversation(convId, lastResponseId) {
        hideHistoryPanel();

        conversationId = convId;
        previousResponseId = lastResponseId || null;
        messagesEl.innerHTML = '';

        showTypingIndicator();
        const data = await fetchConversationMessages(convId);
        removeTypingIndicator();

        if (!data || !data.messages || data.messages.length === 0) {
            startScreenEl = buildStartScreen();
            messagesEl.appendChild(startScreenEl);
            return;
        }

        data.messages.forEach((message) => {
            appendMessage(message.role, message.content);
        });
    }

    function startNewConversation() {
        conversationId = null;
        previousResponseId = null;
        currentStreamEl = null;
        currentStreamText = '';
        hideHistoryPanel();

        if (messagesEl) {
            messagesEl.innerHTML = '';
            startScreenEl = buildStartScreen();
            messagesEl.appendChild(startScreenEl);
        }

        if (composerInput) {
            composerInput.value = '';
            autoResizeInput();
        }

        setUiState('idle');
    }

    function handleStreamEvent(event) {
        if (event.type === 'progress') {
            removeTypingIndicator();
            showProgressIndicator(event.agent, event.status);
            return;
        }

        if (event.type === 'token') {
            removeTypingIndicator();
            removeProgressIndicators();
            // Lazy-create streaming message on first token
            if (!currentStreamEl) createStreamingMessage();
            updateStreamingMessage(event.text);
            return;
        }

        if (event.type === 'tool_call') {
            showToolIndicator(event.name);
            return;
        }

        if (event.type === 'tool_result') {
            removeToolIndicator();
            return;
        }

        if (event.type === 'done') {
            previousResponseId = event.response_id || null;
            if (event.conversation_id) {
                conversationId = event.conversation_id;
            }
            finalizeStreamingMessage();
            return;
        }

        if (event.type === 'error') {
            finalizeStreamingMessage();
            showError(event.message);
        }
    }

    async function sendMessage(text) {
        if (!text || !text.trim() || isStreaming) return;
        text = text.trim();

        if (startScreenEl?.parentNode) {
            startScreenEl.remove();
            startScreenEl = null;
        }

        appendMessage('user', text);

        if (composerInput) {
            composerInput.value = '';
            autoResizeInput();
        }

        isStreaming = true;
        setUiState('streaming');
        showTypingIndicator();

        const payload = {
            user_id: getUserId(),
            message: text,
            mode: mode,
        };

        if (previousResponseId) {
            payload.previous_response_id = previousResponseId;
        }
        if (conversationId) {
            payload.conversation_id = conversationId;
        }
        if (mode === 'prognostic') {
            const frontendContext = getPrognosticFrontendContext();
            if (frontendContext) payload.frontend_context = frontendContext;
        }

        try {
            const response = await fetch(`${API_BASE}/chat/stream`, {
                method: 'POST',
                headers: withLocaleHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                removeTypingIndicator();
                const errText = await response.text().catch(() => '');
                let detail = `Error ${response.status}`;
                try {
                    detail = JSON.parse(errText).detail || detail;
                } catch {
                    // Ignore JSON parse errors for non-JSON responses.
                }
                showError(detail);
                return;
            }

            // Don't remove typing indicator or create streaming message yet.
            // Typing dots stay visible until the first SSE event (progress or token).

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                lines.forEach((line) => {
                    if (!line.startsWith('data: ')) return;
                    const jsonStr = line.slice(6);
                    if (!jsonStr) return;

                    try {
                        handleStreamEvent(JSON.parse(jsonStr));
                    } catch {
                        // Ignore malformed partial events.
                    }
                });
            }

            if (buffer.startsWith('data: ')) {
                try {
                    handleStreamEvent(JSON.parse(buffer.slice(6)));
                } catch {
                    // Ignore leftover malformed tail chunk.
                }
            }
        } catch (error) {
            removeTypingIndicator();
            finalizeStreamingMessage();
            showError(tx('customChat.errorNetwork'));
            console.error('CustomChat stream error:', error);
        } finally {
            removeToolIndicator();
            isStreaming = false;
            setUiState('idle');
        }
    }

    async function startRecording() {
        if (isRecording || isStreaming || uiState === 'transcribing') return;

        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunks = [];

            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');

            mediaRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);

            mediaRecorder.addEventListener('dataavailable', (event) => {
                if (event.data.size > 0) audioChunks.push(event.data);
            });

            const recorderMimeType = mediaRecorder.mimeType || 'audio/webm';

            mediaRecorder.addEventListener('stop', async () => {
                if (mediaStream) {
                    mediaStream.getTracks().forEach((track) => track.stop());
                    mediaStream = null;
                }

                if (audioChunks.length === 0) {
                    isRecording = false;
                    setUiState('idle');
                    return;
                }

                const blob = new Blob(audioChunks, { type: recorderMimeType });
                audioChunks = [];
                isRecording = false;
                await transcribeAndInsert(blob);
            });

            mediaRecorder.start();
            isRecording = true;
            setUiState('recording');
        } catch (error) {
            console.error('Mic access error:', error);
            showError(
                error.name === 'NotAllowedError'
                    ? tx('customChat.micDenied')
                    : tx('customChat.micError')
            );
        }
    }

    function stopRecording() {
        if (!isRecording || !mediaRecorder) return;
        mediaRecorder.stop();
        mediaRecorder = null;
    }

    function toggleRecording() {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }

    async function transcribeAndInsert(blob) {
        setUiState('transcribing');

        try {
            const formData = new FormData();
            formData.append('audio', blob, 'audio.webm');

            const locale = window.FrontendI18n?.currentLocale?.();
            if (locale) {
                formData.append('language', locale);
            }

            const response = await fetch(`${API_BASE}/chat/transcribe`, {
                method: 'POST',
                headers: withLocaleHeaders({}),
                body: formData,
            });

            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                let detail = `Transcription error ${response.status}`;
                try {
                    detail = JSON.parse(errText).detail || detail;
                } catch {
                    // Ignore JSON parse errors for non-JSON responses.
                }
                showError(detail);
                return;
            }

            const data = await response.json();
            if (data.text && data.text.trim()) {
                sendMessage(data.text.trim());
            }
        } catch (error) {
            console.error('Transcription error:', error);
            showError(tx('customChat.errorNetwork'));
        } finally {
            if (!isStreaming) {
                setUiState('idle');
            }
        }
    }

    function autoResizeInput() {
        if (!composerInput) return;
        composerInput.style.height = 'auto';
        composerInput.style.height = `${Math.min(composerInput.scrollHeight, 140)}px`;
        syncComposerAvailability();
    }

    function handleComposerInput() {
        autoResizeInput();
    }

    function handleComposerKeydown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage(composerInput.value);
        }
    }

    function buildComposer() {
        const composer = document.createElement('div');
        composer.className = 'custom-chat-composer';

        const card = document.createElement('div');
        card.className = 'cc-composer-card';

        if (isMicSupported()) {
            micBtn = document.createElement('button');
            micBtn.type = 'button';
            micBtn.className = 'cc-composer-mic';
            micBtn.innerHTML = `
                <span class="cc-mic-core">${createIconMarkup('voice')}</span>
                <span class="cc-mic-pulse"></span>
            `;
            micBtn.title = tx('customChat.micStart');
            micBtn.addEventListener('click', toggleRecording);
            card.appendChild(micBtn);
        }

        composerInput = document.createElement('textarea');
        composerInput.className = 'cc-composer-input';
        composerInput.rows = 1;
        composerInput.placeholder = getDefaultPlaceholder();
        composerInput.addEventListener('input', handleComposerInput);
        composerInput.addEventListener('keydown', handleComposerKeydown);
        card.appendChild(composerInput);

        sendBtn = document.createElement('button');
        sendBtn.type = 'button';
        sendBtn.className = 'cc-composer-send';
        sendBtn.title = tx('customChat.sendButton');
        sendBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>';
        sendBtn.addEventListener('click', () => sendMessage(composerInput.value));
        card.appendChild(sendBtn);

        composer.appendChild(card);
        syncComposerAvailability();
        return composer;
    }

    function applyLocaleToExistingUi() {
        rerenderStartScreen();
        updateTopbar();

        if (composerInput && !composerInput.value) {
            composerInput.placeholder = getDefaultPlaceholder();
        }

        if (composerHintEl) {
            composerHintEl.textContent = getComposerHint();
        }

        if (sendBtn) {
            sendBtn.title = tx('customChat.sendButton');
        }

        if (micBtn) {
            micBtn.title = uiState === 'recording'
                ? tx('customChat.micStop')
                : tx('customChat.micStart');
        }

        messagesEl?.querySelectorAll('.cc-message-meta').forEach((element) => {
            element.textContent = tx('customChat.assistantLabel');
        });

        const typingText = messagesEl?.querySelector('#ccTypingIndicator .cc-typing-bubble span:last-child');
        if (typingText) {
            typingText.textContent = tx('customChat.thinking');
        }

        const toolLabel = messagesEl?.querySelector('#ccToolIndicator span:last-child');
        if (toolLabel && toolLabel.dataset.toolName) {
            toolLabel.textContent = tx('customChat.toolCalling', { tool: toolLabel.dataset.toolName });
        }
    }

    function resetConversation() {
        startNewConversation();
    }

    function updateResponsiveState() {
        if (!chatContainerEl || !containerEl) return;

        const width = containerEl.clientWidth;
        const height = containerEl.clientHeight;

        chatContainerEl.classList.toggle('cc-narrow', width < 420);
        chatContainerEl.classList.toggle('cc-compact', width < 360);
        chatContainerEl.classList.toggle('cc-short', height < 560);
        chatContainerEl.classList.toggle('cc-tiny', height < 470);
    }

    function init(container) {
        if (initialized && containerEl === container) return;

        containerEl = container;
        mode = container.dataset.mode || 'natal';
        container.innerHTML = '';

        chatContainerEl = document.createElement('div');
        chatContainerEl.className = 'custom-chat-container';

        messagesEl = document.createElement('div');
        messagesEl.className = 'custom-chat-messages';
        startScreenEl = buildStartScreen();
        messagesEl.appendChild(startScreenEl);
        chatContainerEl.appendChild(messagesEl);

        chatContainerEl.appendChild(buildComposer());
        container.appendChild(chatContainerEl);

        if (typeof ResizeObserver === 'function') {
            resizeObserver = new ResizeObserver(() => updateResponsiveState());
            resizeObserver.observe(containerEl);
        }

        localeChangeHandler = () => {
            applyLocaleToExistingUi();
        };
        document.addEventListener('frontend:locale-changed', localeChangeHandler);

        updateResponsiveState();
        setUiState('idle');
        initialized = true;
    }

    function destroy() {
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }

        if (localeChangeHandler) {
            document.removeEventListener('frontend:locale-changed', localeChangeHandler);
            localeChangeHandler = null;
        }

        if (mediaStream) {
            mediaStream.getTracks().forEach((track) => track.stop());
            mediaStream = null;
        }

        if (containerEl) {
            containerEl.innerHTML = '';
        }

        initialized = false;
        containerEl = null;
        chatContainerEl = null;
        messagesEl = null;
        composerInput = null;
        composerHintEl = null;
        sendBtn = null;
        micBtn = null;
        startScreenEl = null;
        historyPanelEl = null;
        presenceEl = null;
        modePillEl = null;
        subtitleEl = null;
        previousResponseId = null;
        conversationId = null;
        isStreaming = false;
        currentStreamEl = null;
        currentStreamText = '';
        uiState = 'idle';
        mediaRecorder = null;
        audioChunks = [];
        isRecording = false;
        localeChangeHandler = null;
    }

    window.CustomChat = {
        init,
        destroy,
        resetConversation,
        showHistory: showHistoryPanel,
    };
})();

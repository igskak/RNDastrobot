/**
 * Astrologer assistant chat widget (corner dock on the chart workspace).
 *
 * Text/voice input, non-streaming. Sends the conversation to POST /assistant/chat
 * bound to the active chart (user_id + timezone read from the loaded chart);
 * the server injects user_id into tool calls, so the model never controls it.
 */

const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8000/api/v1'
    : '/api/v1';

const MAX_HISTORY = 40;
const MAX_RECORDING_MS = 5 * 60_000;
const CHAT_SIZE_STORAGE_KEY = 'astrobotChatSize';
const CHAT_MIN_WIDTH = 320;
const CHAT_MIN_HEIGHT = 320;
const CHAT_VIEWPORT_GUTTER = 32;
const CHAT_VIEWPORT_VERTICAL_OFFSET = 120;

function t(key, params) {
    return window.FrontendI18n?.t?.(key, params) || key;
}

async function waitForI18nReady() {
    if (!window.FrontendI18n?.ready) return;
    await Promise.resolve(window.FrontendI18n.ready).catch(() => {});
}

function withLocaleHeaders(headers = {}) {
    if (window.AstroAPI?.withLocaleHeaders) {
        return window.AstroAPI.withLocaleHeaders(headers);
    }
    return headers;
}

function canUsePlanFeature(feature, astrologer) {
    if (!window.AstroPlan?.canUseFeature) return true;
    return window.AstroPlan.canUseFeature(feature, astrologer);
}

function hideElementsById(ids) {
    ids.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.hidden = true;
        el.classList?.add('hidden');
    });
}

function hideAssistantChrome() {
    hideElementsById(['chatToggle', 'chatVoiceCommand', 'chatVoiceMiniStatus', 'chatWidget']);
}

function hideVoiceChrome() {
    hideElementsById(['chatMic', 'chatVoiceCommand', 'chatVoiceMiniStatus', 'chatVoiceStatus']);
}

// Human labels for workspace actions returned by the agent. PR5 moves these to
// the i18n catalogs; kept inline (RU) here so PR3 touches no catalog files.
const ACTION_TEXT = {
    set_transit_date: (a) => `дата транзита → ${a.args.date}${a.args.time ? ' ' + a.args.time : ''}`,
    step_date: (a) => `сдвиг даты ${a.args.direction === 'backward' ? '−' : '+'}${a.args.amount} ${a.args.unit}`,
    add_layer: (a) => `добавить слой «${a.args.method}»`,
    build_solar: (a) => `соляр на ${a.args.year}`,
    set_solar_year: (a) => `год соляра → ${a.args.year}`,
    set_wheel_view: (a) => `вид колеса → ${a.args.view}`,
    set_house_system: (a) => `система домов → ${a.args.system}`,
    set_synastry_partner: (a) => `синастрия с ${a.args.title || a.args.manual?.name || a.args.manual?.title || 'партнёром'}`,
    add_client_note: () => t('page.clientNotes.actionLabel'),
    remove_layer: (a) => `убрать слой «${a.args.method || a.args.layer_id}»`,
    clear_layers: () => 'убрать все слои',
};

function actionLabel(action) {
    const fn = ACTION_TEXT[action?.name];
    try {
        return fn ? fn(action) : (action?.name || 'действие');
    } catch {
        return action?.name || 'действие';
    }
}

class ChatWidget {
    constructor(astrologer = null) {
        this.widget = document.getElementById('chatWidget');
        this.toggle = document.getElementById('chatToggle');
        this.closeBtn = document.getElementById('chatClose');
        this.resizeHandle = document.getElementById('chatResizeHandle');
        this.messages = document.getElementById('chatMessages');
        this.input = document.getElementById('chatInput');
        this.inputRow = document.getElementById('chatInputRow');
        this.send = document.getElementById('chatSend');
        this.mic = document.getElementById('chatMic');
        this.voiceCommand = document.getElementById('chatVoiceCommand');
        this.voiceMiniStatus = document.getElementById('chatVoiceMiniStatus');
        this.voiceStatus = document.getElementById('chatVoiceStatus');
        this.assistantTab = document.getElementById('chatAssistantTab');
        this.notesTab = document.getElementById('chatNotesTab');
        this.notesView = document.getElementById('chatNotesView');
        this.noteForm = document.getElementById('chatNoteForm');
        this.noteInput = document.getElementById('chatNoteInput');
        this.noteSubmit = document.getElementById('chatNoteSubmit');
        this.notesList = document.getElementById('chatNotesList');
        this.notesEmpty = document.getElementById('chatNotesEmpty');
        this.notesStatus = document.getElementById('chatNotesStatus');
        this.historyToggle = document.getElementById('chatHistoryToggle');
        this.newThreadBtn = document.getElementById('chatNewThread');
        this.historyPanel = document.getElementById('chatHistory');
        this.historyList = document.getElementById('chatHistoryList');

        // No markup on this page — stay inert.
        if (!this.widget || !this.toggle || !this.messages || !this.input || !this.send) {
            this.enabled = false;
            return;
        }

        this.astrologer = astrologer || window.AstroAPI?.getCachedAstrologer?.() || null;
        this.voiceEnabled = canUsePlanFeature('transcription', this.astrologer);
        if (!this.voiceEnabled) {
            hideVoiceChrome();
        }

        this.enabled = true;
        this.isOpen = false;
        this.isLoading = false;
        this.isRecording = false;
        this.isStartingRecording = false;
        this.isTranscribing = false;
        this.sendAfterTranscription = false;
        this.mediaRecorder = null;
        this.recordingTimer = null;
        this.recordingTicker = null;
        this.recordingStartedAt = null;
        this.quickVoiceMode = false;
        this.voiceMiniTimer = null;
        this.resizeObserver = null;
        this.recordedChunks = [];
        this.history = [];
        this.conversationId = null;
        this.isHistoryOpen = false;
        this.activeView = 'assistant';
        this.notesSource = 'astrologer';
        this.notesLoading = false;
        this.notesEntries = [];
        this.pendingInputOrigin = 'assistant_text';
        this.lastTurnInputOrigin = 'assistant_text';

        this.init();
    }

    init() {
        this.restoreSize();
        this.toggle.addEventListener('click', () => this.openPanel());
        this.assistantTab?.addEventListener('click', () => this.switchView('assistant'));
        this.notesTab?.addEventListener('click', () => this.switchView('notes'));
        if (this.voiceEnabled) {
            this.voiceCommand?.addEventListener('click', () => this.toggleVoiceCommand());
        }
        this.voiceMiniStatus?.addEventListener('click', () => this.openPanel({ focusInput: false }));
        this.closeBtn?.addEventListener('click', () => this.closePanel());
        this.send.addEventListener('click', () => this.sendMessage());
        if (this.voiceEnabled) {
            this.mic?.addEventListener('click', () => this.toggleRecording());
        }
        this.historyToggle?.addEventListener('click', () => this.toggleHistory());
        this.newThreadBtn?.addEventListener('click', () => this.startNewThread());
        this.noteForm?.addEventListener('submit', (event) => this.submitManualNote(event));
        this.notesView?.querySelectorAll('[data-notes-source]').forEach((button) => {
            button.addEventListener('click', () => this.setNotesSource(button.dataset.notesSource || 'astrologer'));
        });
        document.addEventListener('steliara:client-notes-changed', () => {
            if (this.activeView === 'notes') this.loadNotes();
        });
        this.resizeHandle?.addEventListener('pointerdown', (event) => this.startResize(event));
        this.resizeHandle?.addEventListener('keydown', (event) => this.resizeWithKeyboard(event));

        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.input.addEventListener('input', () => {
            this.input.style.height = 'auto';
            this.input.style.height = `${this.input.scrollHeight}px`;
        });

        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => this.saveSize());
            this.resizeObserver.observe(this.widget);
        }
        this.switchView('assistant');
    }

    restoreSize() {
        if (window.matchMedia?.('(max-width: 640px)').matches) return;
        try {
            const saved = JSON.parse(localStorage.getItem(CHAT_SIZE_STORAGE_KEY) || 'null');
            if (!saved?.width || !saved?.height) return;
            this.applySize(saved.width, saved.height);
        } catch {}
    }

    applySize(width, height) {
        const maxWidth = window.innerWidth - CHAT_VIEWPORT_GUTTER;
        const maxHeight = window.innerHeight - CHAT_VIEWPORT_VERTICAL_OFFSET;
        const minWidth = Math.min(CHAT_MIN_WIDTH, maxWidth);
        const minHeight = Math.min(CHAT_MIN_HEIGHT, maxHeight);
        this.widget.style.width = `${Math.max(minWidth, Math.min(width, maxWidth))}px`;
        this.widget.style.height = `${Math.max(minHeight, Math.min(height, maxHeight))}px`;
    }

    startResize(event) {
        if (event.button !== 0 || window.matchMedia?.('(max-width: 640px)').matches) return;
        event.preventDefault();
        const startX = event.clientX;
        const startY = event.clientY;
        const { width: startWidth, height: startHeight } = this.widget.getBoundingClientRect();

        this.widget.classList.add('resizing');
        this.resizeHandle.setPointerCapture?.(event.pointerId);

        const resize = (moveEvent) => {
            this.applySize(
                startWidth + startX - moveEvent.clientX,
                startHeight + startY - moveEvent.clientY,
            );
        };
        const finish = () => {
            this.widget.classList.remove('resizing');
            this.resizeHandle.removeEventListener('pointermove', resize);
            this.resizeHandle.removeEventListener('pointerup', finish);
            this.resizeHandle.removeEventListener('pointercancel', finish);
            this.saveSize();
        };

        this.resizeHandle.addEventListener('pointermove', resize);
        this.resizeHandle.addEventListener('pointerup', finish);
        this.resizeHandle.addEventListener('pointercancel', finish);
    }

    resizeWithKeyboard(event) {
        const directions = {
            ArrowLeft: [1, 0],
            ArrowRight: [-1, 0],
            ArrowUp: [0, 1],
            ArrowDown: [0, -1],
        };
        const direction = directions[event.key];
        if (!direction || window.matchMedia?.('(max-width: 640px)').matches) return;
        event.preventDefault();
        const step = event.shiftKey ? 32 : 10;
        const { width, height } = this.widget.getBoundingClientRect();
        this.applySize(width + direction[0] * step, height + direction[1] * step);
        this.saveSize();
    }

    saveSize() {
        if (!this.isOpen || window.matchMedia?.('(max-width: 640px)').matches) return;
        const { width, height } = this.widget.getBoundingClientRect();
        try {
            localStorage.setItem(CHAT_SIZE_STORAGE_KEY, JSON.stringify({
                width: Math.round(width),
                height: Math.round(height),
            }));
        } catch {}
    }

    isMobile() {
        return window.matchMedia?.('(max-width: 640px)').matches === true;
    }

    setVoiceStatus(key = null, { recording = false, params } = {}) {
        if (!this.voiceStatus) return;
        this.voiceStatus.hidden = !key;
        this.voiceStatus.classList.toggle('recording', recording);
        this.voiceStatus.textContent = key ? t(key, params) : '';
    }

    setVoiceMiniStatus(keyOrText = '', { params, recording = false, timeoutMs = 0 } = {}) {
        if (!this.voiceMiniStatus) return;
        clearTimeout(this.voiceMiniTimer);
        const key = String(keyOrText || '');
        const isLocaleKey = /^(common|page|nav|errors)\./.test(key);
        const text = key && isLocaleKey
            ? t(keyOrText, params)
            : keyOrText;
        this.voiceMiniStatus.hidden = !text;
        this.voiceMiniStatus.classList.toggle('recording', recording);
        this.voiceMiniStatus.textContent = text || '';
        if (timeoutMs > 0 && text) {
            this.voiceMiniTimer = setTimeout(() => {
                this.voiceMiniStatus.hidden = true;
                this.voiceMiniStatus.classList.remove('recording');
            }, timeoutMs);
        }
    }

    updateRecordingStatus() {
        const elapsedSeconds = Math.floor((Date.now() - this.recordingStartedAt) / 1000);
        const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
        const seconds = String(elapsedSeconds % 60).padStart(2, '0');
        this.setVoiceStatus('page.chart.chat.recording', {
            recording: true,
            params: { time: `${minutes}:${seconds}` },
        });
        if (this.quickVoiceMode) {
            this.setVoiceMiniStatus('page.chart.chat.recording', {
                recording: true,
                params: { time: `${minutes}:${seconds}` },
            });
        }
    }

    openPanel({ focusInput = !this.isMobile(), view = 'assistant' } = {}) {
        this.isOpen = true;
        this.widget.classList.add('open');
        this.switchView(view);
        window.AstroOnboarding?.trackLearning?.('onboarding_control_used', {
            control: 'chat', milestone: 'chat_opened',
        });
        if (focusInput && this.activeView === 'assistant') this.input.focus({ preventScroll: true });
    }

    closePanel() {
        if (this.isRecording) this.stopRecording();
        this.isOpen = false;
        this.widget.classList.remove('open');
        this.closeHistory();
    }

    switchView(view = 'assistant') {
        const next = view === 'notes' ? 'notes' : 'assistant';
        this.activeView = next;
        this.widget?.classList.toggle('notes-mode', next === 'notes');
        if (this.notesView) this.notesView.hidden = next !== 'notes';
        this.assistantTab?.classList.toggle('active', next === 'assistant');
        this.notesTab?.classList.toggle('active', next === 'notes');
        this.assistantTab?.setAttribute('aria-selected', String(next === 'assistant'));
        this.notesTab?.setAttribute('aria-selected', String(next === 'notes'));
        if (next === 'notes') {
            this.closeHistory();
            this.loadNotes();
            if (!this.isMobile()) this.noteInput?.focus({ preventScroll: true });
        } else {
            this.renderContextStrip();
        }
    }

    getActiveChartContext() {
        const assistantContext = window.getAssistantChartContext?.();
        const cache = window.chartDataRawCache || window.chartDataCache || null;
        const userId = assistantContext?.userId || cache?.user_id
            || localStorage.getItem('currentUserId') || null;
        const timezone = assistantContext?.timezone || cache?.timezone || 'UTC';
        const anchorDate = assistantContext?.anchorDate || null;
        return { userId, timezone, anchorDate };
    }

    addMessage(content, role = 'user') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}`;
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = content;
        messageDiv.appendChild(contentDiv);
        this.messages.appendChild(messageDiv);
        this.messages.scrollTop = this.messages.scrollHeight;
        return messageDiv;
    }

    // --- trust surfaces (chat-v2) ---------------------------------------
    // Provenance chip (D1) + guardrail state (D2). Refusal is a NORMAL outcome,
    // so it is styled neutral (info icon), never as a warning/error.
    decorateAssistantTurn(messageEl, data) {
        if (!messageEl || !data) return;
        const guardrail = data.guardrail || 'ok';
        if (guardrail.indexOf('blocked') === 0) {
            messageEl.classList.add('refused');  // neutral refuse-and-redirect note
        }
        const content = messageEl.querySelector('.message-content');
        const chip = this.buildProvenanceChip(data.tool_results, guardrail);
        if (chip && content) content.appendChild(chip);
        if (data.metric_id && content) {
            content.appendChild(this.buildFeedbackControl(data.metric_id));
        }
    }

    // Correction flag (D3): one-tap flag + optional one-line note, feeding the
    // beta capture/tuning loop. Low friction so a busy astrologer actually uses it.
    buildFeedbackControl(metricId) {
        const wrap = document.createElement('div');
        wrap.className = 'chat-correction chat-feedback';

        // Replace the whole control with a visible confirmation on any feedback.
        const showThanks = () => {
            wrap.textContent = '';
            const thanks = document.createElement('div');
            thanks.className = 'chat-correction-thanks';
            thanks.setAttribute('role', 'status');
            thanks.textContent = '✓ ' + t('page.chart.chat.correctionThanks');
            wrap.appendChild(thanks);
        };

        const like = document.createElement('button');
        like.type = 'button';
        like.className = 'chat-feedback-btn chat-feedback-like';
        like.setAttribute('aria-label', t('page.chart.chat.feedbackLike'));
        like.textContent = '👍';

        const dislike = document.createElement('button');
        dislike.type = 'button';
        dislike.className = 'chat-feedback-btn chat-feedback-dislike';
        dislike.setAttribute('aria-pressed', 'false');
        dislike.setAttribute('aria-label', t('page.chart.chat.feedbackDislike'));
        dislike.textContent = '👎';

        const form = document.createElement('div');
        form.className = 'chat-correction-form';
        form.hidden = true;
        const note = document.createElement('input');
        note.type = 'text';
        note.className = 'chat-correction-note';
        note.maxLength = 2000;
        note.placeholder = t('page.chart.chat.correctionNote');
        const submit = document.createElement('button');
        submit.type = 'button';
        submit.className = 'chat-correction-submit';
        submit.textContent = t('page.chart.chat.correctionSubmit');
        form.append(note, submit);

        // 👍 like: one tap -> record + thank-you (no note needed).
        like.addEventListener('click', async () => {
            like.disabled = true;
            dislike.disabled = true;
            await this.postFeedback(metricId, 'like');
            showThanks();
        });

        // 👎 dislike: reveal the note + Submit (the correction flow).
        dislike.addEventListener('click', () => {
            const open = dislike.getAttribute('aria-pressed') === 'true';
            dislike.setAttribute('aria-pressed', String(!open));
            form.hidden = open;
            if (!open) note.focus();
        });

        const doSubmit = async () => {
            submit.disabled = true;
            note.disabled = true;
            await this.postFeedback(metricId, 'dislike', note.value.trim());
            showThanks();
        };
        submit.addEventListener('click', doSubmit);
        note.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); doSubmit(); }
        });

        const buttons = document.createElement('div');
        buttons.className = 'chat-feedback-buttons';
        buttons.append(like, dislike);
        wrap.append(buttons, form);
        return wrap;
    }

    async postFeedback(metricId, kind, noteText) {
        try {
            await fetch(`${API_BASE_URL}/assistant/turns/${metricId}/feedback`, {
                method: 'POST',
                credentials: 'include',
                headers: withLocaleHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ kind, ...(noteText ? { note: noteText } : {}) }),
            });
        } catch (error) {
            console.error('Assistant feedback error:', error);
        }
    }

    buildProvenanceChip(toolResults, guardrail) {
        const withProv = (toolResults || []).filter(
            (tr) => tr && tr.result && tr.result.provenance && tr.result.provenance.dataset);
        const degraded = guardrail === 'degraded' || guardrail === 'regenerated_degraded';
        if (!withProv.length && !degraded) return null;

        const wrap = document.createElement('div');
        wrap.className = 'chat-provenance';

        if (!withProv.length) {
            const note = document.createElement('div');
            note.className = 'chat-provenance-degraded';
            note.textContent = t('page.chart.chat.provenanceDegraded');
            wrap.appendChild(note);
            return wrap;
        }

        const hash = withProv[withProv.length - 1].result.provenance.dataset;
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'chat-provenance-pill';
        pill.setAttribute('aria-expanded', 'false');

        const label = document.createElement('span');
        label.className = 'chat-provenance-label';
        const summaryKey = withProv.length === 1
            ? 'page.chart.chat.provenanceSummaryOne'
            : 'page.chart.chat.provenanceSummary';
        label.textContent = t(summaryKey, { count: withProv.length });
        pill.appendChild(label);

        if (degraded) {
            const warn = document.createElement('span');
            warn.className = 'chat-provenance-degraded';
            warn.textContent = t('page.chart.chat.provenanceDegraded');
            pill.appendChild(warn);
        }

        const chevron = document.createElement('span');
        chevron.className = 'chat-provenance-chevron';
        chevron.setAttribute('aria-hidden', 'true');
        chevron.textContent = '⌄';
        pill.appendChild(chevron);

        const detail = document.createElement('div');
        detail.className = 'chat-provenance-detail';
        detail.hidden = true;
        for (const tr of withProv) {
            const line = document.createElement('div');
            line.className = 'chat-provenance-tool';
            line.textContent = tr.name;
            detail.appendChild(line);
        }
        const meta = document.createElement('div');
        meta.className = 'chat-provenance-meta';
        meta.textContent = t('page.chart.chat.provenanceComputed', { hash });
        detail.appendChild(meta);

        pill.addEventListener('click', () => {
            const open = pill.getAttribute('aria-expanded') === 'true';
            pill.setAttribute('aria-expanded', String(!open));
            detail.hidden = open;
        });

        wrap.appendChild(pill);
        wrap.appendChild(detail);
        return wrap;
    }

    // Context strip (D4): collapsed one-line manifest of the workspace the
    // assistant is grounded in, expandable to the layer/house detail. Refreshed
    // after each turn since actions can change the workspace.
    renderContextStrip() {
        const summary = this.buildWorkspaceSummary();
        let strip = this.contextStrip;
        if (!strip) {
            if (!this.messages || !this.messages.parentNode) return;
            strip = document.createElement('div');
            strip.className = 'chat-context-strip';
            this.messages.parentNode.insertBefore(strip, this.messages);
            this.contextStrip = strip;
        }
        strip.textContent = '';
        if (!summary) { strip.hidden = true; return; }
        strip.hidden = false;

        const active = summary.resources && summary.resources.activeChart;
        const title = (active && active.title) ? String(active.title) : '';
        const layers = Array.isArray(summary.layers) ? summary.layers : [];
        const bits = [];
        if (title) bits.push(title);
        if (layers.length) bits.push(layers.join(', '));
        if (summary.houseSystem) bits.push(summary.houseSystem);
        const line = bits.join(' · ');

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'chat-context-toggle';
        toggle.setAttribute('aria-expanded', 'false');
        const label = document.createElement('span');
        label.className = 'chat-context-label';
        label.textContent = '◈ ' + t('page.chart.chat.contextLabel');
        const lineEl = document.createElement('span');
        lineEl.className = 'chat-context-line';
        lineEl.textContent = line ? ' — ' + line : '';
        const chevron = document.createElement('span');
        chevron.className = 'chat-context-chevron';
        chevron.setAttribute('aria-hidden', 'true');
        chevron.textContent = '⌄';
        toggle.append(label, lineEl, chevron);

        const detail = document.createElement('div');
        detail.className = 'chat-context-detail';
        detail.hidden = true;
        const addRow = (text) => {
            if (!text) return;
            const row = document.createElement('div');
            row.className = 'chat-context-row';
            row.textContent = text;
            detail.appendChild(row);
        };
        if (active) {
            addRow([active.title, active.date, active.place].filter(Boolean).join(' · '));
        }
        for (const method of layers) addRow(method);
        if (summary.date) addRow(summary.date);
        if (summary.houseSystem) addRow(summary.houseSystem);

        toggle.addEventListener('click', () => {
            const open = toggle.getAttribute('aria-expanded') === 'true';
            toggle.setAttribute('aria-expanded', String(!open));
            detail.hidden = open;
        });

        strip.append(toggle, detail);
    }

    addLoadingMessage() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message assistant loading';
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = t('page.chart.chat.thinking');
        messageDiv.appendChild(contentDiv);
        this.messages.appendChild(messageDiv);
        this.messages.scrollTop = this.messages.scrollHeight;
        return messageDiv;
    }

    // --- thread history -------------------------------------------------

    clearMessages() {
        this.messages.innerHTML = '';
        const empty = document.createElement('p');
        empty.className = 'chat-empty';
        empty.textContent = t('page.chart.chat.empty');
        this.messages.appendChild(empty);
        this.renderSuggestions();
    }

    // Discoverability: tappable example commands shown in the empty state, so the
    // astrologer learns the assistant can DRIVE the workspace, not just answer.
    renderSuggestions() {
        const onboardingState = window.AstroOnboarding?.getState?.();
        const onboardingActive = onboardingState?.eligible
            && onboardingState.status === 'active'
            && !onboardingState.completed_steps?.includes('assistant_answer');
        let workspace = null;
        try { workspace = window.ForecastCommands?.describeState?.() || null; } catch (_) { workspace = null; }
        const method = String(workspace?.selectedMethod || workspace?.activeLayers?.[0]?.method || 'transit');
        const contextualKeys = ({
            progression: ['progressionNow', 'progressionTransit', 'exactDates'],
            direction: ['directionNow', 'exactDates', 'compareLayers'],
            solar_return: ['solarThemes', 'solarTiming', 'compareLayers'],
            synastry_partner: ['synastryTight', 'synastryDynamics', 'exactDates'],
            transit: ['transitNow', 'exactDates', 'compareLayers'],
        })[method] || ['transitNow', 'exactDates', 'compareLayers'];
        const contextual = contextualKeys.map((key) => ({
            phrase: t(`page.onboarding.assistant.contextual.${key}`),
            promptType: key,
        }));
        const suggestions = onboardingActive
            ? contextual
            : [
                { phrase: t('page.chart.chat.suggestTransit'), promptType: 'default_transit' },
                { phrase: t('page.chart.chat.suggestSolar'), promptType: 'default_solar' },
                { phrase: t('page.chart.chat.suggestSingle'), promptType: 'default_single' },
            ];
        const phrases = suggestions.filter((item) => item.phrase);
        if (!phrases.length) return;

        const wrap = document.createElement('div');
        wrap.className = 'chat-suggestions';
        wrap.id = 'chatSuggestions';

        const title = document.createElement('div');
        title.className = 'chat-suggestions-title';
        title.textContent = t('page.chart.chat.suggestionsTitle');
        wrap.appendChild(title);

        const row = document.createElement('div');
        row.className = 'chat-suggestions-row';
        for (const { phrase, promptType } of phrases) {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'chat-suggestion';
            chip.textContent = phrase;
            chip.addEventListener('click', () => {
                window.AstroOnboarding?.trackLearning?.('onboarding_prompt_used', {
                    milestone: 'contextual_prompt',
                    prompt_type: promptType,
                    method,
                }, { once: false });
                this.input.value = phrase;
                this.sendMessage();
            });
            row.appendChild(chip);
        }
        wrap.appendChild(row);
        this.messages.appendChild(wrap);
    }

    clearSuggestions() {
        document.getElementById('chatSuggestions')?.remove();
    }

    startNewThread() {
        this.conversationId = null;
        this.history = [];
        this.clearMessages();
        this.closeHistory();
        this.input.focus();
    }

    toggleHistory() {
        if (this.isHistoryOpen) {
            this.closeHistory();
        } else {
            this.openHistory();
        }
    }

    openHistory() {
        if (!this.historyPanel) return;
        this.isHistoryOpen = true;
        this.historyPanel.hidden = false;
        this.historyToggle?.setAttribute('aria-expanded', 'true');
        this.loadThreadList();
    }

    closeHistory() {
        if (!this.historyPanel) return;
        this.isHistoryOpen = false;
        this.historyPanel.hidden = true;
        this.historyToggle?.setAttribute('aria-expanded', 'false');
    }

    async loadThreadList() {
        if (!this.historyList) return;
        const { userId } = this.getActiveChartContext();
        this.historyList.innerHTML = '';
        try {
            const url = new URL(`${API_BASE_URL}/assistant/conversations`, window.location.origin);
            if (userId) url.searchParams.set('chart_user_id', userId);
            const response = await fetch(url.toString(), {
                credentials: 'include',
                headers: withLocaleHeaders(),
            });
            if (!response.ok) throw new Error('list failed');
            const data = await response.json();
            this.renderThreadList(data.conversations || []);
        } catch (error) {
            console.error('Assistant history error:', error);
            this.renderHistoryNotice(t('page.chart.chat.loadFailed'));
        }
    }

    renderHistoryNotice(text) {
        this.historyList.innerHTML = '';
        const li = document.createElement('li');
        li.className = 'chat-history-empty';
        li.textContent = text;
        this.historyList.appendChild(li);
    }

    renderThreadList(items) {
        this.historyList.innerHTML = '';
        if (!items.length) {
            this.renderHistoryNotice(t('page.chart.chat.noThreads'));
            return;
        }
        for (const item of items) {
            const li = document.createElement('li');
            li.className = 'chat-history-item';
            if (item.id === this.conversationId) li.classList.add('active');

            const openBtn = document.createElement('button');
            openBtn.type = 'button';
            openBtn.className = 'chat-history-open';
            const title = document.createElement('span');
            title.className = 'chat-history-item-title';
            title.textContent = item.title || t('page.chart.chat.untitled');
            const meta = document.createElement('span');
            meta.className = 'chat-history-item-meta';
            meta.textContent = this.formatThreadMeta(item);
            openBtn.append(title, meta);
            openBtn.addEventListener('click', () => this.openThread(item.id));

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'chat-history-delete';
            delBtn.setAttribute('aria-label', t('page.chart.chat.delete'));
            delBtn.textContent = '×';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteThread(item.id);
            });

            li.append(openBtn, delBtn);
            this.historyList.appendChild(li);
        }
    }

    formatThreadMeta(item) {
        const when = item.updated_at ? new Date(item.updated_at) : null;
        if (!when || Number.isNaN(when.getTime())) return '';
        try {
            return when.toLocaleString(undefined, {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            });
        } catch {
            return when.toISOString().slice(0, 16).replace('T', ' ');
        }
    }

    async openThread(conversationId) {
        try {
            const response = await fetch(
                `${API_BASE_URL}/assistant/conversations/${conversationId}`,
                { credentials: 'include', headers: withLocaleHeaders() },
            );
            if (!response.ok) throw new Error('load failed');
            const data = await response.json();
            this.conversationId = data.id;
            this.history = (data.messages || []).map((m) => ({
                role: m.role, content: m.content,
            }));
            this.messages.innerHTML = '';
            if (!this.history.length) {
                this.clearMessages();
            } else {
                for (const m of this.history) this.addMessage(m.content, m.role);
            }
            this.closeHistory();
            this.input.focus();
        } catch (error) {
            console.error('Assistant open thread error:', error);
            this.renderHistoryNotice(t('page.chart.chat.loadFailed'));
        }
    }

    async deleteThread(conversationId) {
        if (!window.confirm(t('page.chart.chat.deleteConfirm'))) return;
        try {
            const response = await fetch(
                `${API_BASE_URL}/assistant/conversations/${conversationId}`,
                { method: 'DELETE', credentials: 'include', headers: withLocaleHeaders() },
            );
            if (!response.ok && response.status !== 204) throw new Error('delete failed');
            if (conversationId === this.conversationId) this.startNewThread();
            this.loadThreadList();
        } catch (error) {
            console.error('Assistant delete thread error:', error);
        }
    }

    async sendMessage({ refocus = !this.isMobile(), compactFeedback = false } = {}) {
        if (this.isRecording) {
            this.stopRecording({ sendAfterTranscription: true });
            return;
        }

        const message = this.input.value.trim();
        if (!message || this.isLoading || this.isTranscribing) return;
        const inputOrigin = this.pendingInputOrigin || 'assistant_text';
        this.lastTurnInputOrigin = inputOrigin;
        this.pendingInputOrigin = 'assistant_text';

        this.clearSuggestions();
        const { userId, timezone, anchorDate } = this.getActiveChartContext();
        this.addMessage(message, 'user');
        this.input.value = '';
        this.input.style.height = 'auto';

        if (!userId) {
            this.addMessage(t('page.chart.chat.noChart'), 'assistant');
            if (compactFeedback) {
                this.setVoiceMiniStatus('page.chart.chat.noChart', { timeoutMs: 7000 });
            }
            return;
        }

        this.history.push({ role: 'user', content: message });
        if (this.history.length > MAX_HISTORY) {
            this.history = this.history.slice(-MAX_HISTORY);
        }

        this.isLoading = true;
        this.send.disabled = true;
        const loadingMsg = this.addLoadingMessage();
        const workspace = this.buildWorkspaceSummary();

        try {
            const response = await fetch(`${API_BASE_URL}/assistant/chat`, {
                method: 'POST',
                credentials: 'include',
                headers: withLocaleHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    user_id: userId,
                    timezone,
                    ...(anchorDate ? { anchor_date: anchorDate } : {}),
                    ...(workspace ? { workspace } : {}),
                    ...(this.conversationId ? { conversation_id: this.conversationId } : {}),
                    messages: this.history,
                }),
            });

            if (!response.ok) {
                if (response.status === 403) {
                    let payload = null;
                    try { payload = await response.json(); } catch { payload = null; }
                    const code = payload?.error_code;
                    if (code) {
                        loadingMsg.remove();
                        const reason = code === 'TRIAL_ENDED' ? 'trial_ended'
                            : code === 'PLAN_LIMIT_REACHED' ? 'limit'
                            : (payload?.detail?.feature || 'default');
                        window.AstroPlan?.showUpgradeModal?.({ reason });
                        return;
                    }
                }
                throw new Error(t('page.chat.errors.sendFailed'));
            }

            const data = await response.json();
            const reply = data.reply || '';
            if (data.conversation_id) this.conversationId = data.conversation_id;
            loadingMsg.remove();
            if (reply) {
                const assistantEl = this.addMessage(reply, 'assistant');
                this.decorateAssistantTurn(assistantEl, data);
                this.history.push({ role: 'assistant', content: reply });
                if (compactFeedback) {
                    this.setVoiceMiniStatus(reply, { timeoutMs: 10000 });
                }
                document.dispatchEvent(new CustomEvent('steliara:onboarding-assistant-answer'));
            }
            this.handleActions(data.actions || [], { compactFeedback, inputOrigin });
        } catch (error) {
            console.error('Assistant chat error:', error);
            loadingMsg.remove();
            this.addMessage(t('page.chat.errors.assistantFallback'), 'assistant');
            if (compactFeedback) {
                this.setVoiceMiniStatus('page.chat.errors.assistantFallback', { timeoutMs: 7000 });
            }
        } finally {
            this.isLoading = false;
            this.send.disabled = false;
            if (refocus) this.input.focus({ preventScroll: true });
            this.renderContextStrip();  // refresh the manifest; actions may have changed it
        }
    }

    // --- workspace actions (PR3) ----------------------------------------

    // Compact, serializable snapshot for grounding follow-up commands on the
    // server. Drops the heavy undo snapshot from describeState().
    buildWorkspaceSummary() {
        try {
            const s = window.ForecastCommands?.describeState?.();
            if (!s) return null;
            return {
                wheelView: s.wheelView,
                houseSystem: s.houseSystem,
                date: s.date,
                solarYear: s.solarYear,
                layers: Array.isArray(s.activeLayers) ? s.activeLayers.map((l) => l.method) : [],
                ...(s.synastry ? { synastry: this.normalizeSynastrySummary(s.synastry) } : {}),
                ...(s.resources ? { resources: this.normalizeWorkspaceResources(s.resources) } : {}),
            };
        } catch {
            return null;
        }
    }

    normalizeSynastrySummary(summary) {
        if (!summary || typeof summary !== 'object' || summary.active !== true) return null;
        const cleanString = (value, limit = 120) => {
            const text = String(value || '').trim();
            return text ? text.slice(0, limit) : '';
        };
        const out = {
            active: true,
            mode: summary.mode === 'manual' ? 'manual' : 'db',
        };
        for (const [from, to] of [
            ['partnerName', 'partnerName'],
            ['partnerId', 'partnerId'],
            ['date', 'date'],
            ['time', 'time'],
            ['place', 'place'],
            ['timezone', 'timezone'],
            ['houseSystem', 'houseSystem'],
            ['zodiac', 'zodiac'],
            ['ayanamsha', 'ayanamsha'],
        ]) {
            const value = cleanString(summary[from]);
            if (value) out[to] = value;
        }
        for (const key of ['latitude', 'longitude']) {
            const value = Number(summary[key]);
            if (Number.isFinite(value)) out[key] = value;
        }
        const aspectCount = Number(summary.aspectCount);
        if (Number.isInteger(aspectCount) && aspectCount >= 0) out.aspectCount = aspectCount;
        if (Array.isArray(summary.tightInterAspects)) {
            out.tightInterAspects = summary.tightInterAspects.slice(0, 8).map((item) => ({
                primary: cleanString(item?.primary, 32),
                aspect: cleanString(item?.aspect, 32),
                partner: cleanString(item?.partner, 32),
                orb: Number.isFinite(Number(item?.orb)) ? Number(item.orb) : null,
            })).filter((item) => item.primary && item.aspect && item.partner && item.orb !== null);
        }
        return out;
    }

    normalizeWorkspaceResources(resources) {
        if (!resources || typeof resources !== 'object') return null;
        const cleanString = (value, limit = 140) => {
            const text = String(value || '').trim();
            return text ? text.slice(0, limit) : '';
        };
        const cleanNumber = (value) => {
            const number = Number(value);
            return Number.isFinite(number) ? number : null;
        };
        const cleanObject = (value, limit = 16) => {
            if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
            const out = {};
            Object.entries(value).slice(0, limit).forEach(([key, raw]) => {
                if (raw === null || raw === undefined) return;
                if (typeof raw === 'string') {
                    const text = cleanString(raw, 180);
                    if (text) out[key] = text;
                } else if (typeof raw === 'number' || typeof raw === 'boolean') {
                    out[key] = raw;
                } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
                    const nested = cleanObject(raw, 8);
                    if (nested && Object.keys(nested).length) out[key] = nested;
                }
            });
            return out;
        };
        const cleanAspect = (aspect) => ({
            primary: cleanString(aspect?.primary, 32),
            aspect: cleanString(aspect?.aspect, 32),
            target: cleanString(aspect?.target, 32),
            orb: cleanNumber(aspect?.orb),
            phase: cleanString(aspect?.phase, 24),
        });
        const cleanBody = (body) => ({
            name: cleanString(body?.name, 32),
            sign: cleanString(body?.sign, 24),
            degree: cleanString(body?.degree, 32),
            longitude: cleanNumber(body?.longitude),
            house: cleanNumber(body?.house),
            retrograde: body?.retrograde === true,
        });
        const activeChart = resources.activeChart && typeof resources.activeChart === 'object'
            ? cleanObject(resources.activeChart, 20)
            : null;
        const layers = Array.isArray(resources.layers)
            ? resources.layers.slice(0, 12).map((layer) => {
                const result = layer?.result && typeof layer.result === 'object' ? layer.result : {};
                return {
                    id: cleanString(layer?.id, 80),
                    method: cleanString(layer?.method, 40),
                    selected: layer?.selected === true,
                    ready: layer?.ready === true,
                    label: cleanString(layer?.label, 80),
                    config: cleanObject(layer?.config, 16),
                    meta: cleanString(layer?.meta, 180),
                    result: {
                        aspectCount: cleanNumber(result.aspectCount),
                        bodyCount: cleanNumber(result.bodyCount),
                        tightAspects: Array.isArray(result.tightAspects)
                            ? result.tightAspects.slice(0, 8).map(cleanAspect).filter((item) => item.primary && item.aspect && item.target)
                            : [],
                        keyBodies: Array.isArray(result.keyBodies)
                            ? result.keyBodies.slice(0, 12).map(cleanBody).filter((item) => item.name)
                            : [],
                        target: cleanObject(result.target, 16),
                    },
                };
            }).filter((layer) => layer.id && layer.method)
            : [];
        return {
            ...(activeChart ? { activeChart } : {}),
            selectedLayerId: cleanString(resources.selectedLayerId, 80),
            selectedMethod: cleanString(resources.selectedMethod, 40),
            layers,
        };
    }

    handleActions(actions, { compactFeedback = false, inputOrigin = 'assistant_text' } = {}) {
        if (!Array.isArray(actions) || actions.length === 0) return;
        if (!window.ForecastCommands) {
            this.addActionNote(t('page.chart.chat.actionsUnavailable')
                || 'Действия недоступны на этом экране.', { error: true, compactFeedback });
            return;
        }
        for (const action of actions) {
            if (!action || !action.name) continue;
            // Destructive commands wait for an explicit tap; reversible ones auto-apply.
            if (action.confirm === 'confirm') {
                this.renderConfirmAction(action, { compactFeedback });
            } else {
                void this.runAction(action, { compactFeedback, inputOrigin });
            }
        }
    }

    prepareClientAction(action, inputOrigin = 'assistant_text') {
        if (action?.name !== 'add_client_note') return action;
        return {
            ...action,
            args: {
                ...(action.args || {}),
                origin: inputOrigin === 'assistant_voice' ? 'assistant_voice' : 'assistant_text',
            },
        };
    }

    async runAction(action, { compactFeedback = false, inputOrigin = 'assistant_text' } = {}) {
        let result;
        const actionToRun = this.prepareClientAction(action, inputOrigin);
        try {
            result = await window.ForecastCommands.apply(actionToRun);
        } catch (error) {
            result = { ok: false, error: { message: String(error) } };
        }
        if (result && result.ok) {
            // The workspace toast (with Undo) is shown by the facade's onApplied hook;
            // here we just leave a compact record in the thread.
            this.addActionNote(`✓ ${actionLabel(actionToRun)}`, { applied: true, compactFeedback });
        } else {
            const code = result?.error?.code ? ` (${result.error.code})` : '';
            this.addActionNote(`${t('page.clientNotes.errors.actionFailed')} ${actionLabel(actionToRun)}${code}`, { error: true, compactFeedback });
        }
    }

    renderConfirmAction(action, { compactFeedback = false } = {}) {
        const wrap = document.createElement('div');
        wrap.className = 'chat-message assistant chat-action-confirm';
        const content = document.createElement('div');
        content.className = 'message-content';

        const label = document.createElement('div');
        label.textContent = `Подтвердите: ${actionLabel(action)}`;

        const buttons = document.createElement('div');
        buttons.className = 'chat-action-buttons';
        buttons.style.cssText = 'display:flex;gap:8px;margin-top:8px';

        const applyBtn = document.createElement('button');
        applyBtn.type = 'button';
        applyBtn.textContent = 'Применить';
        applyBtn.style.cssText = 'border:0;border-radius:8px;padding:5px 12px;cursor:pointer;'
            + 'background:#3b6cff;color:#fff;font:inherit';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.textContent = 'Отмена';
        cancelBtn.style.cssText = 'border:0;border-radius:8px;padding:5px 12px;cursor:pointer;'
            + 'background:rgba(0,0,0,0.08);font:inherit';

        applyBtn.addEventListener('click', async () => {
            applyBtn.disabled = true;
            cancelBtn.disabled = true;
            await this.runAction(action);
            wrap.remove();
        });
        cancelBtn.addEventListener('click', () => {
            this.addActionNote(`Отменено: ${actionLabel(action)}`);
            wrap.remove();
        });

        buttons.append(applyBtn, cancelBtn);
        content.append(label, buttons);
        wrap.appendChild(content);
        this.messages.appendChild(wrap);
        this.messages.scrollTop = this.messages.scrollHeight;
        if (compactFeedback) {
            this.setVoiceMiniStatus('page.chart.chat.confirmInChat', { timeoutMs: 9000 });
        }
    }

    addActionNote(text, { applied = false, error = false, compactFeedback = false } = {}) {
        const div = document.createElement('div');
        div.className = 'chat-message assistant chat-action-note';
        const content = document.createElement('div');
        content.className = 'message-content';
        content.textContent = text;
        content.style.cssText = `font-size:12px;opacity:0.9;${
            error ? 'color:#c0392b;' : applied ? 'color:#1e7a46;' : ''}`;
        div.appendChild(content);
        this.messages.appendChild(div);
        this.messages.scrollTop = this.messages.scrollHeight;
        if (compactFeedback) {
            this.setVoiceMiniStatus(text, { timeoutMs: 8000 });
        }
    }

    notesTarget() {
        const { userId } = this.getActiveChartContext();
        return userId ? { chartId: userId } : null;
    }

    noteContextSnapshot() {
        let state = null;
        try { state = window.ForecastCommands?.describeState?.() || null; } catch (_) { state = null; }
        if (!state) return null;
        const resources = state.resources || {};
        const layers = Array.isArray(resources.layers) ? resources.layers : [];
        const selected = layers.find((layer) => layer.id === state.selectedLayerId)
            || layers.find((layer) => layer.selected)
            || null;
        const config = selected?.config || {};
        const synastry = state.synastry?.active === true ? state.synastry : null;
        return {
            schema_version: 1,
            method: selected?.method || resources.selectedMethod || 'natal',
            selected_layer_id: state.selectedLayerId || '',
            date: config.date || state.date || '',
            time: config.time || state.time || '',
            timezone: config.timezone || state.timezone || 'UTC',
            wheel_view: state.wheelView || 'multi',
            ...(synastry?.partnerId ? { partner_chart_id: synastry.partnerId } : {}),
            ...(synastry?.partnerName ? { partner_name: synastry.partnerName } : {}),
        };
    }

    newIdempotencyKey() {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
        return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    setNotesStatus(textOrKey = '', { error = false, params } = {}) {
        if (!this.notesStatus) return;
        const raw = String(textOrKey || '');
        const isKey = /^(common|page|nav|errors)\./.test(raw);
        const text = raw ? (isKey ? t(raw, params) : raw) : '';
        this.notesStatus.hidden = !text;
        this.notesStatus.classList.toggle('error', error);
        this.notesStatus.textContent = text;
    }

    setNotesSource(source) {
        const next = source === 'ai' ? 'ai' : 'astrologer';
        if (this.notesSource === next) return;
        this.notesSource = next;
        this.notesView?.querySelectorAll('[data-notes-source]').forEach((button) => {
            const active = button.dataset.notesSource === next;
            button.classList.toggle('active', active);
            button.setAttribute('aria-selected', String(active));
        });
        if (this.noteForm) this.noteForm.hidden = next !== 'astrologer';
        this.loadNotes();
    }

    async loadNotes() {
        if (!this.notesList || this.notesLoading) return;
        const target = this.notesTarget();
        this.notesList.textContent = '';
        if (!target) {
            if (this.notesEmpty) {
                this.notesEmpty.hidden = false;
                this.notesEmpty.textContent = t('page.clientNotes.errors.noTarget');
            }
            return;
        }
        this.notesLoading = true;
        this.setNotesStatus('common.loading');
        if (this.notesEmpty) this.notesEmpty.hidden = true;
        try {
            const data = await window.AstroAPI.getClientMemory(target, {
                source: this.notesSource,
                limit: 100,
            });
            this.notesEntries = data.entries || [];
            this.renderNotesList();
            this.setNotesStatus('');
        } catch (error) {
            this.notesEntries = [];
            this.renderNotesList();
            this.setNotesStatus(error.message || 'page.clientNotes.errors.loadFailed', { error: true });
        } finally {
            this.notesLoading = false;
        }
    }

    renderNotesList() {
        if (!this.notesList) return;
        this.notesList.textContent = '';
        const entries = this.notesEntries || [];
        if (!entries.length) {
            if (this.notesEmpty) {
                this.notesEmpty.hidden = false;
                this.notesEmpty.textContent = this.notesSource === 'ai'
                    ? t('page.clientNotes.emptyConsultations')
                    : t('page.clientNotes.emptyNotes');
            }
            return;
        }
        if (this.notesEmpty) this.notesEmpty.hidden = true;
        for (const entry of entries) {
            this.notesList.appendChild(this.buildNoteItem(entry));
        }
    }

    noteContextChips(context = {}) {
        const chips = [];
        const method = context?.method;
        if (method) chips.push(t(`page.clientNotes.method.${method}`));
        const dateTime = [context?.date, context?.time].filter(Boolean).join(' ');
        if (dateTime) chips.push(dateTime);
        if (context?.timezone) chips.push(context.timezone);
        if (context?.partner_name) chips.push(t('page.clientNotes.context.partner', { name: context.partner_name }));
        return chips.filter(Boolean);
    }

    buildNoteItem(entry) {
        const item = document.createElement('article');
        item.className = 'chat-note-item';
        item.dataset.noteId = entry.id;

        const text = document.createElement('p');
        text.className = 'chat-note-text';
        text.textContent = entry.text || '';
        item.appendChild(text);

        const meta = document.createElement('div');
        meta.className = 'chat-note-meta';
        const source = document.createElement('span');
        source.className = 'chat-note-chip';
        source.textContent = entry.source === 'ai'
            ? t('page.clientNotes.origin.consultation_ai')
            : t(`page.clientNotes.origin.${entry.origin || 'manual'}`);
        meta.appendChild(source);
        if (entry.created_at) {
            const created = document.createElement('span');
            created.className = 'chat-note-chip';
            created.textContent = this.formatThreadDate(entry.created_at);
            meta.appendChild(created);
        }
        item.appendChild(meta);

        const chips = this.noteContextChips(entry.context_snapshot || {});
        if (chips.length) {
            const context = document.createElement('div');
            context.className = 'chat-note-context';
            chips.forEach((chipText) => {
                const chip = document.createElement('span');
                chip.className = 'chat-note-chip';
                chip.textContent = chipText;
                context.appendChild(chip);
            });
            item.appendChild(context);
        }

        const actions = document.createElement('div');
        actions.className = 'chat-note-actions';
        if (entry.source === 'astrologer') {
            const edit = document.createElement('button');
            edit.type = 'button';
            edit.className = 'chat-note-action';
            edit.textContent = t('common.edit');
            edit.addEventListener('click', () => this.editNoteInline(item, entry));
            actions.appendChild(edit);
        }
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'chat-note-action danger';
        del.textContent = t('common.delete');
        del.addEventListener('click', () => this.deleteNote(entry.id));
        actions.appendChild(del);
        item.appendChild(actions);
        return item;
    }

    formatThreadDate(value) {
        const when = value ? new Date(value) : null;
        if (!when || Number.isNaN(when.getTime())) return '';
        try {
            return when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        } catch {
            return String(value).slice(0, 10);
        }
    }

    editNoteInline(item, entry) {
        item.textContent = '';
        const textarea = document.createElement('textarea');
        textarea.className = 'chat-note-edit';
        textarea.value = entry.text || '';
        const actions = document.createElement('div');
        actions.className = 'chat-note-actions';
        const save = document.createElement('button');
        save.type = 'button';
        save.className = 'chat-note-action';
        save.textContent = t('common.save');
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'chat-note-action';
        cancel.textContent = t('common.cancel');
        actions.append(save, cancel);
        item.append(textarea, actions);
        textarea.focus();
        cancel.addEventListener('click', () => this.renderNotesList());
        save.addEventListener('click', async () => {
            const next = textarea.value.trim();
            if (!next) return;
            save.disabled = true;
            try {
                const updated = await window.AstroAPI.updateClientMemory(entry.id, { text: next });
                this.notesEntries = this.notesEntries.map((row) => (row.id === entry.id ? updated : row));
                this.renderNotesList();
                this.setNotesStatus('page.clientNotes.toast.updated');
                document.dispatchEvent(new CustomEvent('steliara:client-notes-changed'));
            } catch (error) {
                this.setNotesStatus(error.message || 'page.clientNotes.errors.saveFailed', { error: true });
            } finally {
                save.disabled = false;
            }
        });
    }

    async deleteNote(entryId) {
        if (!entryId || !window.confirm(t('page.clientNotes.confirmDelete'))) return;
        try {
            await window.AstroAPI.deleteClientMemory(entryId);
            this.notesEntries = this.notesEntries.filter((row) => row.id !== entryId);
            this.renderNotesList();
            this.setNotesStatus('page.clientNotes.toast.deleted');
            document.dispatchEvent(new CustomEvent('steliara:client-notes-changed'));
        } catch (error) {
            this.setNotesStatus(error.message || 'page.clientNotes.errors.deleteFailed', { error: true });
        }
    }

    async submitManualNote(event) {
        event.preventDefault();
        if (this.notesSource !== 'astrologer') return;
        const text = this.noteInput?.value?.trim() || '';
        if (!text) return;
        const target = this.notesTarget();
        if (!target) {
            this.setNotesStatus('page.clientNotes.errors.noTarget', { error: true });
            return;
        }
        this.noteSubmit.disabled = true;
        this.setNotesStatus('');
        try {
            const entry = await window.AstroAPI.createClientMemory(target, {
                text,
                category: 'other',
                mentioned_by: 'astrologer',
                origin: 'manual',
                idempotency_key: this.newIdempotencyKey(),
                context_snapshot: this.noteContextSnapshot(),
            });
            this.noteInput.value = '';
            this.notesEntries = [entry, ...this.notesEntries];
            this.renderNotesList();
            this.setNotesStatus('page.clientNotes.toast.added');
            document.dispatchEvent(new CustomEvent('steliara:client-notes-changed', { detail: { entry } }));
        } catch (error) {
            this.setNotesStatus(error.message || 'page.clientNotes.errors.saveFailed', { error: true });
        } finally {
            this.noteSubmit.disabled = false;
        }
    }

    toggleRecording() {
        if (!this.voiceEnabled) return;
        if (this.isRecording) {
            this.stopRecording();
        } else if (!this.isStartingRecording) {
            this.startRecording();
        }
    }

    toggleVoiceCommand() {
        if (!this.voiceEnabled) return;
        if (this.isRecording) {
            this.stopRecording({ sendAfterTranscription: true });
            return;
        }
        if (this.isStartingRecording || this.isTranscribing || this.isLoading) return;
        this.startRecording({ quick: true });
    }

    async startRecording({ quick = false } = {}) {
        if (!this.voiceEnabled) return;
        this.quickVoiceMode = quick;
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
            if (quick) this.setVoiceMiniStatus('page.chart.chat.micUnavailable', { timeoutMs: 6000 });
            else this.addMessage(t('page.chart.chat.micUnavailable'), 'assistant');
            this.quickVoiceMode = false;
            return;
        }

        this.isStartingRecording = true;
        if (this.mic) this.mic.disabled = true;
        if (this.voiceCommand) this.voiceCommand.disabled = true;
        if (quick) this.setVoiceMiniStatus('page.chart.chat.voiceCommandHint', { timeoutMs: 3000 });

        try {
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (error) {
                if (quick) this.setVoiceMiniStatus('page.chart.chat.micDenied', { timeoutMs: 6000 });
                else this.addMessage(t('page.chart.chat.micDenied'), 'assistant');
                this.quickVoiceMode = false;
                return;
            }

            this.recordedChunks = [];
            try {
                this.mediaRecorder = new MediaRecorder(stream);
            } catch (error) {
                stream.getTracks().forEach((track) => track.stop());
                if (quick) this.setVoiceMiniStatus('page.chart.chat.micUnavailable', { timeoutMs: 6000 });
                else this.addMessage(t('page.chart.chat.micUnavailable'), 'assistant');
                this.quickVoiceMode = false;
                return;
            }

            this.mediaRecorder.addEventListener('dataavailable', (e) => {
                if (e.data && e.data.size > 0) this.recordedChunks.push(e.data);
            });
            this.mediaRecorder.addEventListener('stop', () => {
                clearTimeout(this.recordingTimer);
                this.recordingTimer = null;
                stream.getTracks().forEach((track) => track.stop());
                const type = this.mediaRecorder?.mimeType || 'audio/webm';
                const blob = new Blob(this.recordedChunks, { type });
                const sendAfterTranscription = this.sendAfterTranscription;
                const quickVoiceMode = this.quickVoiceMode;
                this.sendAfterTranscription = false;
                this.transcribeBlob(blob, { sendAfterTranscription, quick: quickVoiceMode });
            });
            this.mediaRecorder.addEventListener('error', () => {
                clearTimeout(this.recordingTimer);
                this.recordingTimer = null;
                clearInterval(this.recordingTicker);
                this.recordingTicker = null;
                this.recordingStartedAt = null;
                stream.getTracks().forEach((track) => track.stop());
                this.isRecording = false;
                this.mic?.classList.remove('recording');
                this.mic?.setAttribute('aria-pressed', 'false');
                this.voiceCommand?.classList.remove('recording');
                this.voiceCommand?.setAttribute('aria-pressed', 'false');
                this.setVoiceStatus();
                if (this.quickVoiceMode) this.setVoiceMiniStatus('page.chart.chat.transcribeFailed', { timeoutMs: 6000 });
                else this.addMessage(t('page.chart.chat.transcribeFailed'), 'assistant');
                this.quickVoiceMode = false;
            });

            this.mediaRecorder.start();
            this.isRecording = true;
            this.recordingStartedAt = Date.now();
            this.updateRecordingStatus();
            this.recordingTicker = setInterval(() => this.updateRecordingStatus(), 1_000);
            this.mic?.classList.add('recording');
            this.mic?.setAttribute('aria-pressed', 'true');
            this.voiceCommand?.classList.add('recording');
            this.voiceCommand?.setAttribute('aria-pressed', 'true');
            this.recordingTimer = setTimeout(
                () => this.stopRecording({ sendAfterTranscription: this.quickVoiceMode }),
                MAX_RECORDING_MS,
            );
        } finally {
            this.isStartingRecording = false;
            if (this.mic) this.mic.disabled = false;
            if (this.voiceCommand) this.voiceCommand.disabled = false;
        }
    }

    stopRecording({ sendAfterTranscription = false } = {}) {
        this.sendAfterTranscription = sendAfterTranscription;
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        clearTimeout(this.recordingTimer);
        this.recordingTimer = null;
        clearInterval(this.recordingTicker);
        this.recordingTicker = null;
        this.recordingStartedAt = null;
        this.isRecording = false;
        this.mic?.classList.remove('recording');
        this.mic?.setAttribute('aria-pressed', 'false');
        this.voiceCommand?.classList.remove('recording');
        this.voiceCommand?.setAttribute('aria-pressed', 'false');
        if (this.quickVoiceMode && sendAfterTranscription) {
            this.setVoiceMiniStatus('page.chart.chat.transcribingAndSending');
        }
    }

    async transcribeBlob(blob, { sendAfterTranscription = false, quick = false } = {}) {
        if (!this.voiceEnabled) return;
        if (!blob || blob.size === 0) {
            this.setVoiceStatus();
            if (quick) this.setVoiceMiniStatus('', {});
            this.quickVoiceMode = false;
            return;
        }

        const baseType = (blob.type || 'audio/webm').split(';')[0];
        const ext = baseType.includes('ogg') ? 'ogg' : baseType.includes('mp4') ? 'mp4' : 'webm';
        const form = new FormData();
        form.append('audio', blob, `dictation.${ext}`);

        const previousPlaceholder = this.input.placeholder;
        this.input.placeholder = t('page.chart.chat.thinking');
        this.isTranscribing = true;
        this.send.disabled = true;
        this.setVoiceStatus(sendAfterTranscription
            ? 'page.chart.chat.transcribingAndSending'
            : 'page.chart.chat.transcribing');
        if (quick) {
            this.setVoiceMiniStatus(sendAfterTranscription
                ? 'page.chart.chat.transcribingAndSending'
                : 'page.chart.chat.transcribing');
        }
        if (this.mic) this.mic.disabled = true;
        if (this.voiceCommand) this.voiceCommand.disabled = true;

        try {
            const response = await fetch(`${API_BASE_URL}/assistant/transcribe`, {
                method: 'POST',
                credentials: 'include',
                headers: withLocaleHeaders({}),
                body: form,
            });
            if (!response.ok) {
                throw new Error(t('page.chart.chat.transcribeFailed'));
            }
            const data = await response.json();
            const text = (data.text || '').trim();
            if (text) {
                // Keep mic-stop as review-first; send-stop submits after transcription.
                this.input.value = this.input.value ? `${this.input.value} ${text}` : text;
                this.pendingInputOrigin = 'assistant_voice';
                this.input.dispatchEvent(new Event('input'));
                if (sendAfterTranscription) {
                    this.isTranscribing = false;
                    await this.sendMessage({ refocus: !quick && !this.isMobile(), compactFeedback: quick });
                } else if (quick) {
                    this.setVoiceMiniStatus(text, { timeoutMs: 8000 });
                }
            } else if (quick) {
                this.setVoiceMiniStatus('page.chart.chat.transcribeFailed', { timeoutMs: 6000 });
            }
        } catch (error) {
            console.error('Transcription error:', error);
            if (quick) this.setVoiceMiniStatus('page.chart.chat.transcribeFailed', { timeoutMs: 6000 });
            else this.addMessage(t('page.chart.chat.transcribeFailed'), 'assistant');
        } finally {
            this.isTranscribing = false;
            this.input.placeholder = previousPlaceholder;
            this.send.disabled = this.isLoading;
            if (this.mic) this.mic.disabled = false;
            if (this.voiceCommand) this.voiceCommand.disabled = false;
            this.setVoiceStatus();
            this.quickVoiceMode = false;
            if (!quick && !this.isMobile()) this.input.focus({ preventScroll: true });
        }
    }
}

async function initChatWidget() {
    await waitForI18nReady();
    const astrologer = window.AstroAPI?.getCachedAstrologer?.()
        || await window.AstroAPI?.getCurrentAstrologer?.();
    if (!canUsePlanFeature('assistant', astrologer)) {
        hideAssistantChrome();
        return;
    }
    window.chatWidget = new ChatWidget(astrologer);
    if (window.AstroOnboarding?.CHANGE_EVENT) {
        document.addEventListener(window.AstroOnboarding.CHANGE_EVENT, () => {
            if (window.chatWidget?.history?.length === 0 && !window.chatWidget?.isLoading) {
                window.chatWidget.clearMessages();
            }
        });
    }
}

// Фаза 3: chat.js грузится лениво (requestIdleCallback), обычно уже ПОСЛЕ
// DOMContentLoaded — тогда событие не сработает. Инициализируем сразу, если DOM
// готов; иначе ждём событие. Guard против повторного импорта.
if (!window.__chatWidgetInit) {
    window.__chatWidgetInit = true;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChatWidget, { once: true });
    } else {
        initChatWidget();
    }
}

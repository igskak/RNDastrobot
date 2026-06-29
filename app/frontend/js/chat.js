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
    constructor() {
        this.widget = document.getElementById('chatWidget');
        this.toggle = document.getElementById('chatToggle');
        this.closeBtn = document.getElementById('chatClose');
        this.resizeHandle = document.getElementById('chatResizeHandle');
        this.messages = document.getElementById('chatMessages');
        this.input = document.getElementById('chatInput');
        this.send = document.getElementById('chatSend');
        this.mic = document.getElementById('chatMic');
        this.voiceCommand = document.getElementById('chatVoiceCommand');
        this.voiceMiniStatus = document.getElementById('chatVoiceMiniStatus');
        this.voiceStatus = document.getElementById('chatVoiceStatus');
        this.historyToggle = document.getElementById('chatHistoryToggle');
        this.newThreadBtn = document.getElementById('chatNewThread');
        this.historyPanel = document.getElementById('chatHistory');
        this.historyList = document.getElementById('chatHistoryList');

        // No markup on this page — stay inert.
        if (!this.widget || !this.toggle || !this.messages || !this.input || !this.send) {
            this.enabled = false;
            return;
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

        this.init();
    }

    init() {
        this.restoreSize();
        this.toggle.addEventListener('click', () => this.openPanel());
        this.voiceCommand?.addEventListener('click', () => this.toggleVoiceCommand());
        this.voiceMiniStatus?.addEventListener('click', () => this.openPanel({ focusInput: false }));
        this.closeBtn?.addEventListener('click', () => this.closePanel());
        this.send.addEventListener('click', () => this.sendMessage());
        this.mic?.addEventListener('click', () => this.toggleRecording());
        this.historyToggle?.addEventListener('click', () => this.toggleHistory());
        this.newThreadBtn?.addEventListener('click', () => this.startNewThread());
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

    openPanel({ focusInput = !this.isMobile() } = {}) {
        this.isOpen = true;
        this.widget.classList.add('open');
        if (focusInput) this.input.focus({ preventScroll: true });
    }

    closePanel() {
        if (this.isRecording) this.stopRecording();
        this.isOpen = false;
        this.widget.classList.remove('open');
        this.closeHistory();
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
        const phrases = [
            t('page.chart.chat.suggestTransit'),
            t('page.chart.chat.suggestSolar'),
            t('page.chart.chat.suggestSingle'),
        ].filter(Boolean);
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
        for (const phrase of phrases) {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'chat-suggestion';
            chip.textContent = phrase;
            chip.addEventListener('click', () => {
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
                throw new Error(t('page.chat.errors.sendFailed'));
            }

            const data = await response.json();
            const reply = data.reply || '';
            if (data.conversation_id) this.conversationId = data.conversation_id;
            loadingMsg.remove();
            if (reply) {
                this.addMessage(reply, 'assistant');
                this.history.push({ role: 'assistant', content: reply });
                if (compactFeedback) {
                    this.setVoiceMiniStatus(reply, { timeoutMs: 10000 });
                }
            }
            this.handleActions(data.actions || [], { compactFeedback });
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
            ['date', 'date'],
            ['time', 'time'],
            ['place', 'place'],
            ['timezone', 'timezone'],
        ]) {
            const value = cleanString(summary[from]);
            if (value) out[to] = value;
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

    handleActions(actions, { compactFeedback = false } = {}) {
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
                void this.runAction(action, { compactFeedback });
            }
        }
    }

    async runAction(action, { compactFeedback = false } = {}) {
        let result;
        try {
            result = await window.ForecastCommands.apply(action);
        } catch (error) {
            result = { ok: false, error: { message: String(error) } };
        }
        if (result && result.ok) {
            // The workspace toast (with Undo) is shown by the facade's onApplied hook;
            // here we just leave a compact record in the thread.
            this.addActionNote(`✓ ${actionLabel(action)}`, { applied: true, compactFeedback });
        } else {
            const code = result?.error?.code ? ` (${result.error.code})` : '';
            this.addActionNote(`⚠ Не удалось: ${actionLabel(action)}${code}`, { error: true, compactFeedback });
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

    toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else if (!this.isStartingRecording) {
            this.startRecording();
        }
    }

    toggleVoiceCommand() {
        if (this.isRecording) {
            this.stopRecording({ sendAfterTranscription: true });
            return;
        }
        if (this.isStartingRecording || this.isTranscribing || this.isLoading) return;
        this.startRecording({ quick: true });
    }

    async startRecording({ quick = false } = {}) {
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

document.addEventListener('DOMContentLoaded', async () => {
    await waitForI18nReady();
    window.chatWidget = new ChatWidget();
});

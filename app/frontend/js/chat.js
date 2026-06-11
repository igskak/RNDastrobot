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
const MAX_RECORDING_MS = 60_000;

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

class ChatWidget {
    constructor() {
        this.widget = document.getElementById('chatWidget');
        this.toggle = document.getElementById('chatToggle');
        this.closeBtn = document.getElementById('chatClose');
        this.messages = document.getElementById('chatMessages');
        this.input = document.getElementById('chatInput');
        this.send = document.getElementById('chatSend');
        this.mic = document.getElementById('chatMic');

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
        this.mediaRecorder = null;
        this.recordingTimer = null;
        this.recordedChunks = [];
        this.history = [];

        this.init();
    }

    init() {
        this.toggle.addEventListener('click', () => this.openPanel());
        this.closeBtn?.addEventListener('click', () => this.closePanel());
        this.send.addEventListener('click', () => this.sendMessage());
        this.mic?.addEventListener('click', () => this.toggleRecording());

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
    }

    openPanel() {
        this.isOpen = true;
        this.widget.classList.add('open');
        this.input.focus();
    }

    closePanel() {
        if (this.isRecording) this.stopRecording();
        this.isOpen = false;
        this.widget.classList.remove('open');
    }

    getActiveChartContext() {
        const cache = window.chartDataRawCache || window.chartDataCache || null;
        const userId = cache?.user_id || localStorage.getItem('currentUserId') || null;
        const timezone = cache?.timezone || 'UTC';
        return { userId, timezone };
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

    async sendMessage() {
        const message = this.input.value.trim();
        if (!message || this.isLoading) return;

        const { userId, timezone } = this.getActiveChartContext();
        this.addMessage(message, 'user');
        this.input.value = '';
        this.input.style.height = 'auto';

        if (!userId) {
            this.addMessage(t('page.chart.chat.noChart'), 'assistant');
            return;
        }

        this.history.push({ role: 'user', content: message });
        if (this.history.length > MAX_HISTORY) {
            this.history = this.history.slice(-MAX_HISTORY);
        }

        this.isLoading = true;
        this.send.disabled = true;
        const loadingMsg = this.addLoadingMessage();

        try {
            const response = await fetch(`${API_BASE_URL}/assistant/chat`, {
                method: 'POST',
                credentials: 'include',
                headers: withLocaleHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    user_id: userId,
                    timezone,
                    messages: this.history,
                }),
            });

            if (!response.ok) {
                throw new Error(t('page.chat.errors.sendFailed'));
            }

            const data = await response.json();
            const reply = data.reply || '';
            loadingMsg.remove();
            this.addMessage(reply, 'assistant');
            this.history.push({ role: 'assistant', content: reply });
        } catch (error) {
            console.error('Assistant chat error:', error);
            loadingMsg.remove();
            this.addMessage(t('page.chat.errors.assistantFallback'), 'assistant');
        } finally {
            this.isLoading = false;
            this.send.disabled = false;
            this.input.focus();
        }
    }

    toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else if (!this.isStartingRecording) {
            this.startRecording();
        }
    }

    async startRecording() {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
            this.addMessage(t('page.chart.chat.micUnavailable'), 'assistant');
            return;
        }

        this.isStartingRecording = true;
        if (this.mic) this.mic.disabled = true;

        try {
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (error) {
                this.addMessage(t('page.chart.chat.micDenied'), 'assistant');
                return;
            }

            this.recordedChunks = [];
            try {
                this.mediaRecorder = new MediaRecorder(stream);
            } catch (error) {
                stream.getTracks().forEach((track) => track.stop());
                this.addMessage(t('page.chart.chat.micUnavailable'), 'assistant');
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
                this.transcribeBlob(blob);
            });
            this.mediaRecorder.addEventListener('error', () => {
                clearTimeout(this.recordingTimer);
                this.recordingTimer = null;
                stream.getTracks().forEach((track) => track.stop());
                this.isRecording = false;
                this.mic?.classList.remove('recording');
                this.mic?.setAttribute('aria-pressed', 'false');
                this.addMessage(t('page.chart.chat.transcribeFailed'), 'assistant');
            });

            this.mediaRecorder.start();
            this.isRecording = true;
            this.mic?.classList.add('recording');
            this.mic?.setAttribute('aria-pressed', 'true');
            this.recordingTimer = setTimeout(() => this.stopRecording(), MAX_RECORDING_MS);
        } finally {
            this.isStartingRecording = false;
            if (this.mic) this.mic.disabled = false;
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        clearTimeout(this.recordingTimer);
        this.recordingTimer = null;
        this.isRecording = false;
        this.mic?.classList.remove('recording');
        this.mic?.setAttribute('aria-pressed', 'false');
    }

    async transcribeBlob(blob) {
        if (!blob || blob.size === 0) return;

        const baseType = (blob.type || 'audio/webm').split(';')[0];
        const ext = baseType.includes('ogg') ? 'ogg' : baseType.includes('mp4') ? 'mp4' : 'webm';
        const form = new FormData();
        form.append('audio', blob, `dictation.${ext}`);

        const previousPlaceholder = this.input.placeholder;
        this.input.placeholder = t('page.chart.chat.thinking');
        if (this.mic) this.mic.disabled = true;

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
                // Fill the composer for review — never auto-send.
                this.input.value = this.input.value ? `${this.input.value} ${text}` : text;
                this.input.dispatchEvent(new Event('input'));
            }
        } catch (error) {
            console.error('Transcription error:', error);
            this.addMessage(t('page.chart.chat.transcribeFailed'), 'assistant');
        } finally {
            this.input.placeholder = previousPlaceholder;
            if (this.mic) this.mic.disabled = false;
            this.input.focus();
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await waitForI18nReady();
    window.chatWidget = new ChatWidget();
});

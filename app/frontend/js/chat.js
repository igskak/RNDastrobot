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
        this.voiceStatus = document.getElementById('chatVoiceStatus');

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
        this.resizeObserver = null;
        this.recordedChunks = [];
        this.history = [];

        this.init();
    }

    init() {
        this.restoreSize();
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
            this.widget.style.width = `${Math.min(saved.width, window.innerWidth - 32)}px`;
            this.widget.style.height = `${Math.min(saved.height, window.innerHeight - 120)}px`;
        } catch {}
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

    setVoiceStatus(key = null, { recording = false, params } = {}) {
        if (!this.voiceStatus) return;
        this.voiceStatus.hidden = !key;
        this.voiceStatus.classList.toggle('recording', recording);
        this.voiceStatus.textContent = key ? t(key, params) : '';
    }

    updateRecordingStatus() {
        const elapsedSeconds = Math.floor((Date.now() - this.recordingStartedAt) / 1000);
        const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
        const seconds = String(elapsedSeconds % 60).padStart(2, '0');
        this.setVoiceStatus('page.chart.chat.recording', {
            recording: true,
            params: { time: `${minutes}:${seconds}` },
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

    async sendMessage() {
        if (this.isRecording) {
            this.stopRecording({ sendAfterTranscription: true });
            return;
        }

        const message = this.input.value.trim();
        if (!message || this.isLoading || this.isTranscribing) return;

        const { userId, timezone, anchorDate } = this.getActiveChartContext();
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
                    ...(anchorDate ? { anchor_date: anchorDate } : {}),
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
                const sendAfterTranscription = this.sendAfterTranscription;
                this.sendAfterTranscription = false;
                this.transcribeBlob(blob, { sendAfterTranscription });
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
                this.setVoiceStatus();
                this.addMessage(t('page.chart.chat.transcribeFailed'), 'assistant');
            });

            this.mediaRecorder.start();
            this.isRecording = true;
            this.recordingStartedAt = Date.now();
            this.updateRecordingStatus();
            this.recordingTicker = setInterval(() => this.updateRecordingStatus(), 1_000);
            this.mic?.classList.add('recording');
            this.mic?.setAttribute('aria-pressed', 'true');
            this.recordingTimer = setTimeout(() => this.stopRecording(), MAX_RECORDING_MS);
        } finally {
            this.isStartingRecording = false;
            if (this.mic) this.mic.disabled = false;
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
    }

    async transcribeBlob(blob, { sendAfterTranscription = false } = {}) {
        if (!blob || blob.size === 0) {
            this.setVoiceStatus();
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
                // Keep mic-stop as review-first; send-stop submits after transcription.
                this.input.value = this.input.value ? `${this.input.value} ${text}` : text;
                this.input.dispatchEvent(new Event('input'));
                if (sendAfterTranscription) {
                    this.isTranscribing = false;
                    await this.sendMessage();
                }
            }
        } catch (error) {
            console.error('Transcription error:', error);
            this.addMessage(t('page.chart.chat.transcribeFailed'), 'assistant');
        } finally {
            this.isTranscribing = false;
            this.input.placeholder = previousPlaceholder;
            this.send.disabled = this.isLoading;
            if (this.mic) this.mic.disabled = false;
            this.setVoiceStatus();
            this.input.focus();
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await waitForI18nReady();
    window.chatWidget = new ChatWidget();
});

/**
 * Astrologer assistant chat widget (corner dock on the chart workspace).
 *
 * Text-only, non-streaming. Sends the conversation to POST /assistant/chat
 * bound to the active chart (user_id + timezone read from the loaded chart);
 * the server injects user_id into tool calls, so the model never controls it.
 */

const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8000/api/v1'
    : '/api/v1';

const MAX_HISTORY = 40;

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

        // No markup on this page — stay inert.
        if (!this.widget || !this.toggle || !this.messages || !this.input || !this.send) {
            this.enabled = false;
            return;
        }

        this.enabled = true;
        this.isOpen = false;
        this.isLoading = false;
        this.history = [];

        this.init();
    }

    init() {
        this.toggle.addEventListener('click', () => this.openPanel());
        this.closeBtn?.addEventListener('click', () => this.closePanel());
        this.send.addEventListener('click', () => this.sendMessage());

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
}

document.addEventListener('DOMContentLoaded', async () => {
    await waitForI18nReady();
    window.chatWidget = new ChatWidget();
});

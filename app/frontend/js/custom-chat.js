/**
 * Custom Chat UI — собственный чат-виджет вместо OpenAI ChatKit.
 *
 * Поддерживает два режима (natal / prognostic), SSE-стриминг ответов,
 * tool calling через бэкенд, markdown-рендеринг, starter prompts,
 * историю разговоров и STT (Whisper).
 *
 * Экспортируется как window.CustomChat = { init(container), destroy(), resetConversation() }
 */
(function () {
    'use strict';

    const API_BASE = '/api/v1';
    const USERID_STORAGE_KEY = 'astrobot_user_id';

    // ---- State ----
    let initialized = false;
    let containerEl = null;
    let chatContainerEl = null;
    let messagesEl = null;
    let composerInput = null;
    let sendBtn = null;
    let micBtn = null;
    let startScreenEl = null;
    let historyPanelEl = null;
    let mode = 'natal';
    let previousResponseId = null;
    let conversationId = null;
    let isStreaming = false;
    let currentStreamEl = null;
    let currentStreamText = '';

    // STT state
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;

    // ---- Helpers (same patterns as chatkit-init.js) ----

    function t(key, params) {
        return window.FrontendI18n?.t?.(key, params) || key;
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
            } catch (e) {
                console.warn('CustomChat: не удалось собрать forecast context:', e);
            }
        }
        return null;
    }

    function formatRelativeDate(isoStr) {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        const now = new Date();
        const diffMs = now - d;
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return t('customChat.justNow');
        if (diffMin < 60) return t('customChat.minutesAgo', { n: diffMin });
        const diffH = Math.floor(diffMin / 60);
        if (diffH < 24) return t('customChat.hoursAgo', { n: diffH });
        const diffD = Math.floor(diffH / 24);
        if (diffD < 7) return t('customChat.daysAgo', { n: diffD });
        return d.toLocaleDateString();
    }

    // ---- Simple markdown renderer ----

    function escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderMarkdown(text) {
        if (!text) return '';

        // Preserve code blocks first
        const codeBlocks = [];
        let processed = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
            const idx = codeBlocks.length;
            codeBlocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`);
            return `\x00CB${idx}\x00`;
        });

        // Inline code
        processed = processed.replace(/`([^`]+)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`);

        // Escape remaining HTML (but preserve our code placeholders)
        processed = processed.replace(/&/g, '&amp;');
        processed = processed.replace(/<(?![/]?code|[/]?pre)/g, '&lt;');

        // Headings
        processed = processed.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        processed = processed.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        processed = processed.replace(/^# (.+)$/gm, '<h1>$1</h1>');

        // Bold and italic
        processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        processed = processed.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // Blockquotes
        processed = processed.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

        // Unordered lists
        processed = processed.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
        processed = processed.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

        // Ordered lists
        processed = processed.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

        // Paragraphs (double newline)
        processed = processed.replace(/\n{2,}/g, '</p><p>');
        // Single newlines to <br> (inside paragraphs only)
        processed = processed.replace(/\n/g, '<br>');

        // Wrap in paragraph
        processed = `<p>${processed}</p>`;

        // Clean up empty paragraphs
        processed = processed.replace(/<p>\s*<\/p>/g, '');
        // Don't wrap block elements in <p>
        processed = processed.replace(/<p>(<h[123]>)/g, '$1');
        processed = processed.replace(/(<\/h[123]>)<\/p>/g, '$1');
        processed = processed.replace(/<p>(<ul>)/g, '$1');
        processed = processed.replace(/(<\/ul>)<\/p>/g, '$1');
        processed = processed.replace(/<p>(<pre>)/g, '$1');
        processed = processed.replace(/(<\/pre>)<\/p>/g, '$1');
        processed = processed.replace(/<p>(<blockquote>)/g, '$1');
        processed = processed.replace(/(<\/blockquote>)<\/p>/g, '$1');

        // Restore code blocks
        processed = processed.replace(/\x00CB(\d+)\x00/g, (_, idx) => codeBlocks[parseInt(idx)]);

        return processed;
    }

    // ---- DOM builders ----

    function buildStartScreen() {
        const el = document.createElement('div');
        el.className = 'custom-chat-start-screen';

        const greetingKey = mode === 'prognostic'
            ? 'chatkit.prognostic.greeting'
            : 'chatkit.natal.greeting';

        const greetingEl = document.createElement('div');
        greetingEl.className = 'cc-start-greeting';
        greetingEl.textContent = t(greetingKey);
        el.appendChild(greetingEl);

        if (mode === 'prognostic') {
            const promptsContainer = document.createElement('div');
            promptsContainer.className = 'cc-start-prompts';

            const prompts = [
                { label: t('chatkit.prognostic.prompts.transitsToday.label'), prompt: t('chatkit.prognostic.prompts.transitsToday.prompt') },
                { label: t('chatkit.prognostic.prompts.monthly.label'), prompt: t('chatkit.prognostic.prompts.monthly.prompt') },
                { label: t('chatkit.prognostic.prompts.solar.label'), prompt: t('chatkit.prognostic.prompts.solar.prompt') },
            ];

            for (const p of prompts) {
                const btn = document.createElement('button');
                btn.className = 'cc-starter-prompt-btn';
                btn.textContent = p.label;
                btn.addEventListener('click', () => sendMessage(p.prompt));
                promptsContainer.appendChild(btn);
            }

            el.appendChild(promptsContainer);
        }

        return el;
    }

    function appendMessage(role, content) {
        const msgEl = document.createElement('div');
        msgEl.className = `custom-chat-message ${role}`;

        const contentEl = document.createElement('div');
        contentEl.className = 'cc-message-content';

        if (role === 'user') {
            contentEl.textContent = content;
        } else {
            contentEl.innerHTML = renderMarkdown(content);
        }

        msgEl.appendChild(contentEl);
        messagesEl.appendChild(msgEl);
        scrollToBottom();
        return msgEl;
    }

    function createStreamingMessage() {
        const msgEl = document.createElement('div');
        msgEl.className = 'custom-chat-message assistant';

        const contentEl = document.createElement('div');
        contentEl.className = 'cc-message-content';

        msgEl.appendChild(contentEl);
        messagesEl.appendChild(msgEl);

        currentStreamEl = contentEl;
        currentStreamText = '';
        return contentEl;
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
        const el = document.createElement('div');
        el.className = 'cc-typing-indicator';
        el.id = 'ccTypingIndicator';

        const dots = document.createElement('span');
        dots.className = 'cc-typing-dots';
        dots.innerHTML = '<span></span><span></span><span></span>';
        el.appendChild(dots);

        messagesEl.appendChild(el);
        scrollToBottom();
    }

    function removeTypingIndicator() {
        const el = document.getElementById('ccTypingIndicator');
        if (el) el.remove();
    }

    function showToolIndicator(toolName) {
        removeToolIndicator();
        const el = document.createElement('div');
        el.className = 'cc-tool-indicator';
        el.id = 'ccToolIndicator';

        const spinner = document.createElement('span');
        spinner.className = 'cc-tool-spinner';
        el.appendChild(spinner);

        const label = document.createElement('span');
        label.textContent = t('customChat.toolCalling', { tool: toolName });
        el.appendChild(label);

        messagesEl.appendChild(el);
        scrollToBottom();
    }

    function removeToolIndicator() {
        const el = document.getElementById('ccToolIndicator');
        if (el) el.remove();
    }

    function showError(message) {
        const el = document.createElement('div');
        el.className = 'cc-error-message';
        el.textContent = message || t('customChat.errorGeneric');
        messagesEl.appendChild(el);
        scrollToBottom();
    }

    function scrollToBottom() {
        if (messagesEl) {
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }
    }

    // ---- Conversation history ----

    async function fetchConversations() {
        try {
            const res = await fetch(
                `${API_BASE}/chat/conversations?user_id=${encodeURIComponent(getUserId())}&mode=${mode}`,
                { headers: withLocaleHeaders({}) }
            );
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            console.error('CustomChat: failed to load conversations:', e);
            return [];
        }
    }

    async function fetchConversationMessages(convId) {
        try {
            const res = await fetch(
                `${API_BASE}/chat/conversations/${convId}/messages`,
                { headers: withLocaleHeaders({}) }
            );
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.error('CustomChat: failed to load messages:', e);
            return null;
        }
    }

    async function deleteConversation(convId) {
        try {
            await fetch(`${API_BASE}/chat/conversations/${convId}`, {
                method: 'DELETE',
                headers: withLocaleHeaders({}),
            });
        } catch (e) {
            console.error('CustomChat: failed to delete conversation:', e);
        }
    }

    function showHistoryPanel() {
        if (!chatContainerEl) return;

        // Hide messages + composer, show history panel
        chatContainerEl.classList.add('cc-show-history');

        if (!historyPanelEl) {
            historyPanelEl = document.createElement('div');
            historyPanelEl.className = 'cc-history-panel';
            chatContainerEl.appendChild(historyPanelEl);
        }

        historyPanelEl.innerHTML = `<div class="cc-history-loading"><span class="cc-tool-spinner"></span></div>`;

        fetchConversations().then(conversations => {
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

        // Header
        const header = document.createElement('div');
        header.className = 'cc-history-header';

        const title = document.createElement('span');
        title.className = 'cc-history-title';
        title.textContent = t('customChat.history');
        header.appendChild(title);

        const backBtn = document.createElement('button');
        backBtn.className = 'cc-history-back';
        backBtn.textContent = t('customChat.historyBack');
        backBtn.addEventListener('click', hideHistoryPanel);
        header.appendChild(backBtn);

        historyPanelEl.appendChild(header);

        // New conversation item
        const newBtn = document.createElement('button');
        newBtn.className = 'cc-history-item cc-history-new';
        newBtn.textContent = '+ ' + t('customChat.newConversation');
        newBtn.addEventListener('click', () => {
            hideHistoryPanel();
            startNewConversation();
        });
        historyPanelEl.appendChild(newBtn);

        if (conversations.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'cc-history-empty';
            empty.textContent = t('customChat.historyEmpty');
            historyPanelEl.appendChild(empty);
            return;
        }

        // List
        const list = document.createElement('div');
        list.className = 'cc-history-list';

        for (const conv of conversations) {
            const item = document.createElement('div');
            item.className = 'cc-history-item';
            if (conv.id === conversationId) {
                item.classList.add('active');
            }

            const info = document.createElement('div');
            info.className = 'cc-history-item-info';

            const titleEl = document.createElement('div');
            titleEl.className = 'cc-history-item-title';
            titleEl.textContent = conv.title || t('customChat.untitledConversation');
            info.appendChild(titleEl);

            const dateEl = document.createElement('div');
            dateEl.className = 'cc-history-item-date';
            dateEl.textContent = formatRelativeDate(conv.updated_at);
            info.appendChild(dateEl);

            item.appendChild(info);

            // Delete button
            const delBtn = document.createElement('button');
            delBtn.className = 'cc-history-item-delete';
            delBtn.innerHTML = '&times;';
            delBtn.title = t('customChat.deleteConversation');
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await deleteConversation(conv.id);
                if (conv.id === conversationId) {
                    startNewConversation();
                }
                item.remove();
            });
            item.appendChild(delBtn);

            item.addEventListener('click', () => {
                loadConversation(conv.id, conv.last_response_id);
            });

            list.appendChild(item);
        }

        historyPanelEl.appendChild(list);
    }

    async function loadConversation(convId, lastResponseId) {
        hideHistoryPanel();

        conversationId = convId;
        previousResponseId = lastResponseId || null;

        // Clear messages area
        messagesEl.innerHTML = '';

        // Show loading
        showTypingIndicator();

        const data = await fetchConversationMessages(convId);
        removeTypingIndicator();

        if (!data || !data.messages || data.messages.length === 0) {
            startScreenEl = buildStartScreen();
            messagesEl.appendChild(startScreenEl);
            return;
        }

        for (const msg of data.messages) {
            appendMessage(msg.role, msg.content);
        }
    }

    function startNewConversation() {
        conversationId = null;
        previousResponseId = null;
        currentStreamEl = null;
        currentStreamText = '';

        if (messagesEl) {
            messagesEl.innerHTML = '';
            startScreenEl = buildStartScreen();
            messagesEl.appendChild(startScreenEl);
        }
    }

    // ---- SSE streaming ----

    async function sendMessage(text) {
        if (!text || !text.trim() || isStreaming) return;
        text = text.trim();

        // Hide start screen
        if (startScreenEl && startScreenEl.parentNode) {
            startScreenEl.remove();
            startScreenEl = null;
        }

        // Append user message
        appendMessage('user', text);

        // Clear input
        if (composerInput) {
            composerInput.value = '';
            autoResizeInput();
        }

        setStreaming(true);
        showTypingIndicator();

        const body = {
            user_id: getUserId(),
            message: text,
            mode: mode,
        };
        if (previousResponseId) {
            body.previous_response_id = previousResponseId;
        }
        if (conversationId) {
            body.conversation_id = conversationId;
        }
        if (mode === 'prognostic') {
            const ctx = getPrognosticFrontendContext();
            if (ctx) body.frontend_context = ctx;
        }

        try {
            const response = await fetch(`${API_BASE}/chat/stream`, {
                method: 'POST',
                headers: withLocaleHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                removeTypingIndicator();
                const errText = await response.text().catch(() => '');
                let detail = `Error ${response.status}`;
                try { detail = JSON.parse(errText).detail || detail; } catch {}
                showError(detail);
                setStreaming(false);
                return;
            }

            removeTypingIndicator();
            createStreamingMessage();

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                // Keep the last incomplete line in buffer
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const jsonStr = line.slice(6);
                    if (!jsonStr) continue;

                    let event;
                    try {
                        event = JSON.parse(jsonStr);
                    } catch {
                        continue;
                    }

                    if (event.type === 'token') {
                        updateStreamingMessage(event.text);
                    } else if (event.type === 'tool_call') {
                        showToolIndicator(event.name);
                    } else if (event.type === 'tool_result') {
                        removeToolIndicator();
                    } else if (event.type === 'done') {
                        previousResponseId = event.response_id || null;
                        if (event.conversation_id) {
                            conversationId = event.conversation_id;
                        }
                        finalizeStreamingMessage();
                    } else if (event.type === 'error') {
                        finalizeStreamingMessage();
                        showError(event.message);
                    }
                }
            }

        } catch (e) {
            removeTypingIndicator();
            finalizeStreamingMessage();
            showError(t('customChat.errorNetwork'));
            console.error('CustomChat stream error:', e);
        } finally {
            removeToolIndicator();
            setStreaming(false);
        }
    }

    // ---- Speech-to-Text (Whisper) ----

    function isMicSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    async function startRecording() {
        if (isRecording || isStreaming) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunks = [];

            // Prefer webm/opus, fallback to whatever is available
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm')
                    ? 'audio/webm'
                    : '';

            mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

            mediaRecorder.addEventListener('dataavailable', (e) => {
                if (e.data.size > 0) audioChunks.push(e.data);
            });

            const recorderMimeType = mediaRecorder.mimeType || 'audio/webm';

            mediaRecorder.addEventListener('stop', async () => {
                // Stop all tracks to release mic
                stream.getTracks().forEach(track => track.stop());

                if (audioChunks.length === 0) {
                    setRecordingUI(false);
                    return;
                }

                const blob = new Blob(audioChunks, { type: recorderMimeType });
                audioChunks = [];

                await transcribeAndInsert(blob);
            });

            mediaRecorder.start();
            isRecording = true;
            setRecordingUI(true);

        } catch (e) {
            console.error('Mic access error:', e);
            if (e.name === 'NotAllowedError') {
                showError(t('customChat.micDenied'));
            } else {
                showError(t('customChat.micError'));
            }
        }
    }

    function stopRecording() {
        if (!isRecording || !mediaRecorder) return;
        isRecording = false;
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

    function setRecordingUI(recording) {
        if (micBtn) {
            micBtn.classList.toggle('recording', recording);
            micBtn.title = recording
                ? t('customChat.micStop')
                : t('customChat.micStart');
        }
        if (composerInput) {
            composerInput.placeholder = recording
                ? t('customChat.micRecording')
                : t(mode === 'prognostic'
                    ? 'chatkit.prognostic.composerPlaceholder'
                    : 'chatkit.natal.composerPlaceholder');
        }
    }

    async function transcribeAndInsert(blob) {
        // Show transcribing state
        if (micBtn) micBtn.classList.add('transcribing');
        if (composerInput) composerInput.placeholder = t('customChat.micTranscribing');

        try {
            const formData = new FormData();
            formData.append('audio', blob, 'audio.webm');

            // Send locale as language hint
            const locale = window.FrontendI18n?.currentLocale?.();
            if (locale) formData.append('language', locale);

            const response = await fetch(`${API_BASE}/chat/transcribe`, {
                method: 'POST',
                headers: withLocaleHeaders({}),
                body: formData,
            });

            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                let detail = `Transcription error ${response.status}`;
                try { detail = JSON.parse(errText).detail || detail; } catch {}
                showError(detail);
                return;
            }

            const data = await response.json();
            if (data.text && data.text.trim()) {
                // Insert transcribed text and auto-send
                sendMessage(data.text.trim());
            }

        } catch (e) {
            console.error('Transcription error:', e);
            showError(t('customChat.errorNetwork'));
        } finally {
            if (micBtn) micBtn.classList.remove('transcribing');
            setRecordingUI(false);
        }
    }

    // ---- Composer ----

    function setStreaming(val) {
        isStreaming = val;
        if (sendBtn) sendBtn.disabled = val;
        if (micBtn) micBtn.disabled = val;
        if (composerInput) composerInput.disabled = val;
    }

    function autoResizeInput() {
        if (!composerInput) return;
        composerInput.style.height = 'auto';
        composerInput.style.height = Math.min(composerInput.scrollHeight, 120) + 'px';
    }

    function handleComposerKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(composerInput.value);
        }
    }

    function buildComposer() {
        const el = document.createElement('div');
        el.className = 'custom-chat-composer';

        const placeholderKey = mode === 'prognostic'
            ? 'chatkit.prognostic.composerPlaceholder'
            : 'chatkit.natal.composerPlaceholder';

        composerInput = document.createElement('textarea');
        composerInput.className = 'cc-composer-input';
        composerInput.placeholder = t(placeholderKey);
        composerInput.rows = 1;
        composerInput.addEventListener('input', autoResizeInput);
        composerInput.addEventListener('keydown', handleComposerKeydown);

        sendBtn = document.createElement('button');
        sendBtn.className = 'cc-composer-send';
        sendBtn.innerHTML = '&#9654;'; // ▶ arrow
        sendBtn.title = t('customChat.sendButton');
        sendBtn.addEventListener('click', () => sendMessage(composerInput.value));

        el.appendChild(composerInput);

        // Mic button (only if browser supports getUserMedia)
        if (isMicSupported()) {
            micBtn = document.createElement('button');
            micBtn.className = 'cc-composer-mic';
            micBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
            micBtn.title = t('customChat.micStart');
            micBtn.addEventListener('click', toggleRecording);
            el.appendChild(micBtn);
        }

        el.appendChild(sendBtn);
        return el;
    }

    // ---- New conversation ----

    function resetConversation() {
        startNewConversation();
    }

    // ---- Init / Destroy ----

    function init(container) {
        if (initialized && containerEl === container) return;

        containerEl = container;
        mode = container.dataset.mode || 'natal';

        // Build structure
        container.innerHTML = '';

        chatContainerEl = document.createElement('div');
        chatContainerEl.className = 'custom-chat-container';

        messagesEl = document.createElement('div');
        messagesEl.className = 'custom-chat-messages';

        // Start screen
        startScreenEl = buildStartScreen();
        messagesEl.appendChild(startScreenEl);

        chatContainerEl.appendChild(messagesEl);
        chatContainerEl.appendChild(buildComposer());
        container.appendChild(chatContainerEl);

        initialized = true;
    }

    function destroy() {
        if (containerEl) {
            containerEl.innerHTML = '';
        }
        containerEl = null;
        chatContainerEl = null;
        messagesEl = null;
        composerInput = null;
        sendBtn = null;
        micBtn = null;
        startScreenEl = null;
        historyPanelEl = null;
        previousResponseId = null;
        conversationId = null;
        currentStreamEl = null;
        currentStreamText = '';
        isStreaming = false;
        initialized = false;
    }

    // ---- Export ----
    window.CustomChat = {
        init,
        destroy,
        resetConversation,
        showHistory: showHistoryPanel,
    };
})();

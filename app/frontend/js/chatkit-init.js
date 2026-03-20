/**
 * ChatKit инициализация для интеграции с OpenAI Agent Builder workflow.
 *
 * Ключевая оптимизация: отложенная загрузка ChatKit SDK и создание сессии
 * только при первом открытии виджета пользователем.
 */

(function() {
    'use strict';

    const USERID_STORAGE_KEY = 'astrobot_user_id';
    const CHAT_OPEN_STORAGE_KEY = 'astrobot_chat_open';
    const CHAT_SIZE_STORAGE_KEY = 'astrobot_chat_size';
    const API_BASE = '/api/v1';
    const CHATKIT_SCRIPT_URL = 'https://cdn.platform.openai.com/deployments/chatkit/chatkit.js';

    let chatkitScriptPromise = null;
    let chatkitInitPromise = null;
    let chatkitInitialized = false;

    function t(key, params) {
        return window.FrontendI18n?.t?.(key, params) || key;
    }

    function withLocaleHeaders(headers = {}) {
        if (window.AstroAPI?.withLocaleHeaders) {
            return window.AstroAPI.withLocaleHeaders(headers);
        }
        return headers;
    }

    function getUserId() {
        const chartUserId = localStorage.getItem('currentUserId');
        if (chartUserId) {
            return chartUserId;
        }

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
                console.warn('ChatKit [prognostic]: не удалось собрать контекст forecast:', e);
            }
        }
        return null;
    }

    function withContextDefaults(toolName, params, context) {
        const next = { ...(params || {}) };
        const controls = context?.controls || {};
        const calculated = context?.calculated || {};
        const activeRunId = context?.active_run_id;

        if (activeRunId && !next.run_id) {
            next.run_id = activeRunId;
        }

        if (toolName === 'get_transit_events') {
            const transits = calculated.transits || {};
            if (!next.start_date) next.start_date = transits.period_start || controls.start_date;
            if (!next.end_date) next.end_date = transits.period_end || controls.end_date;
        } else if (toolName === 'get_progressions') {
            const progressions = calculated.progressions || {};
            if (!next.target_date) next.target_date = progressions.target_date || controls.single_date;
        } else if (toolName === 'get_directions') {
            const directions = calculated.directions || {};
            if (!next.target_date) next.target_date = directions.target_date || controls.single_date;
            if (!next.direction_type) next.direction_type = directions.direction_type;
        } else if (toolName === 'get_solar_return') {
            const solar = calculated.solar_return || {};
            if (next.year === undefined || next.year === null) next.year = solar.year || controls.solar_year;
        }

        return next;
    }

    async function createChatSession(userId, mode) {
        const endpoint = mode === 'prognostic'
            ? `${API_BASE}/chat/prognostic-session`
            : `${API_BASE}/chat/session`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: withLocaleHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ user_id: userId })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || error.detail || t('chatkit.errors.sessionCreate'));
        }

        return response.json();
    }

    function loadChatKitScript() {
        if (chatkitScriptPromise) return chatkitScriptPromise;

        chatkitScriptPromise = new Promise((resolve, reject) => {
            if (customElements.get('openai-chatkit')) {
                resolve();
                return;
            }

            const existing = document.querySelector(`script[src="${CHATKIT_SCRIPT_URL}"]`);
            if (existing) {
                existing.addEventListener('load', () => resolve(), { once: true });
                existing.addEventListener('error', () => reject(new Error('chatkit_script_load_failed')), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = CHATKIT_SCRIPT_URL;
            script.async = true;
            script.addEventListener('load', () => resolve(), { once: true });
            script.addEventListener('error', () => reject(new Error('chatkit_script_load_failed')), { once: true });
            document.head.appendChild(script);
        }).catch((error) => {
            chatkitScriptPromise = null;
            throw error;
        });

        return chatkitScriptPromise;
    }

    async function initChatKit() {
        if (chatkitInitialized) return;
        if (chatkitInitPromise) return chatkitInitPromise;

        chatkitInitPromise = (async () => {
            const container = document.getElementById('chatkit-container');
            if (!container) return;

            const userId = getUserId();
            const mode = container.dataset.mode || 'natal';

            async function getClientSecret() {
                const session = await createChatSession(userId, mode);
                return session.client_secret;
            }

            await Promise.all([
                loadChatKitScript(),
                window.FrontendI18n?.ready,
            ]);

            await Promise.race([
                customElements.whenDefined('openai-chatkit'),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
            ]);

            const chatkit = document.createElement('openai-chatkit');

            const chatkitOptions = {
                api: {
                    getClientSecret: getClientSecret
                },
                composer: {
                    placeholder: mode === 'prognostic'
                        ? t('chatkit.prognostic.composerPlaceholder')
                        : t('chatkit.natal.composerPlaceholder')
                },
                startScreen: {
                    greeting: mode === 'prognostic'
                        ? t('chatkit.prognostic.greeting')
                        : t('chatkit.natal.greeting'),
                    prompts: mode === 'prognostic' ? [
                        { label: t('chatkit.prognostic.prompts.transitsToday.label'), prompt: t('chatkit.prognostic.prompts.transitsToday.prompt') },
                        { label: t('chatkit.prognostic.prompts.monthly.label'), prompt: t('chatkit.prognostic.prompts.monthly.prompt') },
                        { label: t('chatkit.prognostic.prompts.solar.label'), prompt: t('chatkit.prognostic.prompts.solar.prompt') },
                    ] : []
                }
            };

            if (mode === 'prognostic') {
                chatkitOptions.onClientTool = async ({ name, params }) => {
                    try {
                        const frontendContext = getPrognosticFrontendContext();
                        const mergedParams = withContextDefaults(name, params, frontendContext);
                        const resp = await fetch(`${API_BASE}/chat/prognostic-tool`, {
                            method: 'POST',
                            headers: withLocaleHeaders({ 'Content-Type': 'application/json' }),
                            body: JSON.stringify({
                                user_id: userId,
                                tool_name: name,
                                arguments: mergedParams,
                                frontend_context: frontendContext
                            })
                        });
                        if (!resp.ok) {
                            const errText = await resp.text().catch(() => '');
                            let detail = `Tool ${name} failed (${resp.status})`;
                            try { detail = JSON.parse(errText).detail || detail; } catch {}
                            return { error: detail };
                        }
                        const result = await resp.json();
                        return { data: JSON.stringify(result) };
                    } catch (e) {
                        return { error: e.message };
                    }
                };
            }

            if (typeof chatkit.setOptions === 'function') {
                chatkit.setOptions(chatkitOptions);
            } else {
                const initialSecret = await getClientSecret();
                chatkit.setAttribute('client-secret', initialSecret);
            }

            container.appendChild(chatkit);
            chatkitInitialized = true;
        })().catch((error) => {
            const container = document.getElementById('chatkit-container');
            if (container && !chatkitInitialized) {
                container.innerHTML = `<div style="color: #ff6b6b; padding: 20px; text-align: center;">${t('chatkit.errors.loadFailed')}</div>`;
            }
            chatkitInitPromise = null;
            throw error;
        });

        return chatkitInitPromise;
    }

    function setChatOpen(open) {
        localStorage.setItem(CHAT_OPEN_STORAGE_KEY, open ? '1' : '0');
    }

    function readChatOpenState() {
        return localStorage.getItem(CHAT_OPEN_STORAGE_KEY) === '1';
    }

    function scheduleChatScriptWarmup() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection?.saveData) return;

        const warmup = () => {
            if (!chatkitInitialized) {
                loadChatKitScript().catch(() => {
                    // optional warmup should stay non-blocking
                });
            }
        };

        const trigger = () => {
            if (typeof window.requestIdleCallback === 'function') {
                window.requestIdleCallback(warmup, { timeout: 15000 });
            } else {
                setTimeout(warmup, 12000);
            }
        };

        if (document.readyState === 'complete') {
            trigger();
        } else {
            window.addEventListener('load', trigger, { once: true });
        }
    }

    function initToggleButtons() {
        const wrapper = document.getElementById('chatkitWrapper');
        const minimizeBtn = document.getElementById('chatkitMinimize');
        const toggleBtn = document.getElementById('chatkitToggle');

        if (!wrapper || !minimizeBtn || !toggleBtn) {
            return;
        }

        const shouldOpen = readChatOpenState();
        wrapper.classList.toggle('minimized', !shouldOpen);
        toggleBtn.classList.toggle('hidden', shouldOpen);

        if (shouldOpen) {
            initChatKit().catch(() => {
                wrapper.classList.add('minimized');
                toggleBtn.classList.remove('hidden');
                setChatOpen(false);
            });
        }

        minimizeBtn.addEventListener('click', () => {
            wrapper.classList.add('minimized');
            toggleBtn.classList.remove('hidden');
            setChatOpen(false);
        });

        toggleBtn.addEventListener('click', async () => {
            wrapper.classList.remove('minimized');
            toggleBtn.classList.add('hidden');
            setChatOpen(true);

            try {
                await initChatKit();
            } catch {
                wrapper.classList.add('minimized');
                toggleBtn.classList.remove('hidden');
                setChatOpen(false);
            }
        });

        initResizeHandle(wrapper);
        scheduleChatScriptWarmup();
    }

    function initResizeHandle(wrapper) {
        const handle = document.getElementById('chatkitResizeHandle');
        if (!handle) return;

        const MIN_WIDTH = 320;
        const MIN_HEIGHT = 400;

        const saved = loadChatSize();
        if (saved) {
            wrapper.style.width = saved.width + 'px';
            wrapper.style.height = saved.height + 'px';
        }

        let startX, startY, startWidth, startHeight;

        function onPointerDown(e) {
            e.preventDefault();
            startX = e.clientX;
            startY = e.clientY;
            const rect = wrapper.getBoundingClientRect();
            startWidth = rect.width;
            startHeight = rect.height;
            wrapper.classList.add('resizing');
            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp);
        }

        function onPointerMove(e) {
            const dx = startX - e.clientX;
            const dy = startY - e.clientY;
            const maxWidth = window.innerWidth - 48;
            const maxHeight = window.innerHeight - 100;
            const newWidth = Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth + dx));
            const newHeight = Math.min(maxHeight, Math.max(MIN_HEIGHT, startHeight + dy));
            wrapper.style.width = newWidth + 'px';
            wrapper.style.height = newHeight + 'px';
        }

        function onPointerUp() {
            wrapper.classList.remove('resizing');
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
            saveChatSize(wrapper.offsetWidth, wrapper.offsetHeight);
        }

        handle.addEventListener('pointerdown', onPointerDown);
    }

    function saveChatSize(width, height) {
        try {
            localStorage.setItem(CHAT_SIZE_STORAGE_KEY, JSON.stringify({ width, height }));
        } catch {}
    }

    function loadChatSize() {
        try {
            const raw = localStorage.getItem(CHAT_SIZE_STORAGE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (data.width >= 320 && data.height >= 400) return data;
        } catch {}
        return null;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initToggleButtons);
    } else {
        initToggleButtons();
    }
})();

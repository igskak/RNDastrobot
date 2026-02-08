/**
 * ChatKit инициализация для интеграции с OpenAI Agent Builder workflow
 * 
 * Использует простую интеграцию ChatKit:
 * - Backend создаёт сессию и возвращает client_secret
 * - Frontend использует ChatKit.js виджет с этим токеном
 */

(function() {
    'use strict';

    const USERID_STORAGE_KEY = 'astrobot_user_id';
    const API_BASE = '/api/v1';

    /**
     * Получить user_id для чата
     *
     * Приоритет:
     * 1) user_id сохранённой натальной карты (localStorage.currentUserId) — UUID из БД
     * 2) fallback: анонимный id в localStorage[USERID_STORAGE_KEY]
     */
    function getUserId() {
        // 1. Если уже есть сохранённая натальная карта — используем её user_id
        const chartUserId = localStorage.getItem('currentUserId');
        if (chartUserId) {
            return chartUserId; // это чистый UUID, совпадает с user_id в БД
        }

        // 2. Иначе используем (или создаём) анонимный id
        let userId = localStorage.getItem(USERID_STORAGE_KEY);
        if (!userId) {
            userId = 'user_' + crypto.randomUUID();
            localStorage.setItem(USERID_STORAGE_KEY, userId);
        }
        return userId;
    }

    // Данные карты теперь загружаются на backend по user_id из БД
    // Эта функция больше не нужна, но оставляем для обратной совместимости
    function getChartData() {
        return null; // Backend сам загрузит карту из БД
    }

    /**
     * Создать ChatKit сессию через backend API
     * @param {string} userId
     * @param {string} mode — "natal" | "prognostic"
     */
    async function createChatSession(userId, mode) {
        const endpoint = mode === 'prognostic'
            ? `${API_BASE}/chat/prognostic-session`
            : `${API_BASE}/chat/session`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Ошибка создания сессии');
        }

        return response.json();
    }

    /**
     * Инициализация ChatKit виджета
     */
    async function initChatKit() {
        console.log('ChatKit: начало инициализации');

        const container = document.getElementById('chatkit-container');
        if (!container) {
            console.error('ChatKit container not found');
            return;
        }
        console.log('ChatKit: контейнер найден');

        const userId = getUserId();
        // Режим: "prognostic" если контейнер имеет data-mode="prognostic", иначе "natal"
        const mode = container.dataset.mode || 'natal';
        console.log('ChatKit: userId =', userId, ', mode =', mode);

        // Функция для получения свежего client_secret
        // Вызывается ChatKit каждый раз при необходимости (токены истекают быстро)
        async function getClientSecret() {
            console.log(`ChatKit [${mode}]: запрос нового client_secret...`);
            const session = await createChatSession(userId, mode);
            console.log(`ChatKit [${mode}]: получен свежий токен, session_id =`, session.session_id);
            return session.client_secret;
        }

        // Ожидаем регистрации web component (без хардкода таймаута)
        console.log('ChatKit: ожидание регистрации web component...');
        try {
            await Promise.race([
                customElements.whenDefined('openai-chatkit'),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
            ]);
            console.log('ChatKit: web component зарегистрирован');
        } catch {
            console.error('ChatKit: web component не зарегистрирован за 10с');
            container.innerHTML = '<div style="color: #ff6b6b; padding: 20px; text-align: center;">ChatKit не загружен. Проверьте подключение к интернету.</div>';
            return;
        }

        // Создаём ChatKit элемент
        console.log('ChatKit: создание элемента...');
        const chatkit = document.createElement('openai-chatkit');

        // Собираем options для setOptions()
        const chatkitOptions = {
            api: {
                getClientSecret: getClientSecret
            },
            composer: {
                placeholder: mode === 'prognostic'
                    ? 'Задайте вопрос о прогнозе...'
                    : 'Спросите о натальной карте...'
            },
            startScreen: {
                greeting: mode === 'prognostic'
                    ? 'Спросите о прогностике человека'
                    : '✨ Спросите о натальной карте',
                prompts: mode === 'prognostic' ? [
                    { label: 'Транзиты на сегодня', prompt: 'Какие транзиты активны сегодня и как они влияют на мою карту?' },
                    { label: 'Прогноз на месяц', prompt: 'Дай прогноз на ближайший месяц по транзитам и прогрессиям' },
                    { label: 'Соляр на этот год', prompt: 'Построй и интерпретируй мой соляр на текущий год' },
                ] : []
            }
        };

        // Client-side tool handler для прогностического режима
        if (mode === 'prognostic') {
            chatkitOptions.onClientTool = async ({ name, params }) => {
                console.log(`ChatKit [prognostic]: onClientTool вызван — ${name}`, params);
                try {
                    const resp = await fetch(`${API_BASE}/chat/prognostic-tool`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            user_id: userId,
                            tool_name: name,
                            arguments: params || {}
                        })
                    });
                    if (!resp.ok) {
                        const err = await resp.json().catch(() => ({}));
                        return { error: err.detail || `Tool ${name} failed` };
                    }
                    return await resp.json();
                } catch (e) {
                    console.error(`ChatKit: ошибка tool ${name}:`, e);
                    return { error: e.message };
                }
            };
        }

        // Используем setOptions() для Vanilla JS (согласно документации)
        if (typeof chatkit.setOptions === 'function') {
            chatkit.setOptions(chatkitOptions);
        } else {
            // Fallback: получаем токен и устанавливаем как атрибут
            const initialSecret = await getClientSecret();
            chatkit.setAttribute('client-secret', initialSecret);
        }

        container.appendChild(chatkit);
        console.log('ChatKit виджет инициализирован');
    }

    /**
     * Инициализация кнопок сворачивания/разворачивания
     */
    function initToggleButtons() {
        const wrapper = document.getElementById('chatkitWrapper');
        const minimizeBtn = document.getElementById('chatkitMinimize');
        const toggleBtn = document.getElementById('chatkitToggle');

        if (!wrapper || !minimizeBtn || !toggleBtn) {
            console.warn('ChatKit: кнопки управления не найдены');
            return;
        }

        // Сворачивание чата
        minimizeBtn.addEventListener('click', () => {
            wrapper.classList.add('minimized');
            toggleBtn.classList.remove('hidden');
            console.log('ChatKit: свёрнут');
        });

        // Разворачивание чата
        toggleBtn.addEventListener('click', () => {
            wrapper.classList.remove('minimized');
            toggleBtn.classList.add('hidden');
            console.log('ChatKit: развёрнут');
        });

        console.log('ChatKit: кнопки управления инициализированы');
    }

    // Инициализация при загрузке страницы
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initChatKit();
            initToggleButtons();
        });
    } else {
        initChatKit();
        initToggleButtons();
    }
})();


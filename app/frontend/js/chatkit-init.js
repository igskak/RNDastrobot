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
     * Backend сам загрузит натальную карту из БД по user_id
     */
    async function createChatSession(userId) {
        const response = await fetch(`${API_BASE}/chat/session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: userId
            })
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
        console.log('ChatKit: userId =', userId);

        // Функция для получения свежего client_secret
        // Вызывается ChatKit каждый раз при необходимости (токены истекают быстро)
        async function getClientSecret() {
            console.log('ChatKit: запрос нового client_secret...');
            const session = await createChatSession(userId);
            console.log('ChatKit: получен свежий токен, session_id =', session.session_id);
            return session.client_secret;
        }

        // Проверяем первоначальное подключение к backend
        try {
            await getClientSecret();
            console.log('ChatKit: первичная проверка подключения успешна');
        } catch (error) {
            console.error('ChatKit: ошибка подключения к backend:', error);
            container.innerHTML = '<div style="color: #ff6b6b; padding: 20px; text-align: center;">Ошибка подключения к чату. Попробуйте обновить страницу.</div>';
            return;
        }

        // Проверяем загрузку ChatKit
        console.log('ChatKit: проверка customElements...');
        let isRegistered = window.customElements?.get('openai-chatkit');

        if (!isRegistered) {
            console.log('ChatKit: ожидание загрузки скрипта...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            isRegistered = window.customElements?.get('openai-chatkit');
        }

        if (!isRegistered) {
            console.error('ChatKit: web component не зарегистрирован');
            container.innerHTML = '<div style="color: #ff6b6b; padding: 20px; text-align: center;">ChatKit не загружен. Проверьте подключение к интернету.</div>';
            return;
        }

        // Создаём ChatKit элемент
        console.log('ChatKit: создание элемента...');
        const chatkit = document.createElement('openai-chatkit');

        // Используем setOptions() для Vanilla JS (согласно документации)
        // getClientSecret вызывается ChatKit каждый раз при необходимости обновления токена
        if (typeof chatkit.setOptions === 'function') {
            chatkit.setOptions({
                api: {
                    getClientSecret: getClientSecret  // ✅ Динамическое обновление токена
                }
            });
        } else {
            // Fallback: получаем токен и устанавливаем как атрибут
            // (в этом случае динамическое обновление не работает)
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


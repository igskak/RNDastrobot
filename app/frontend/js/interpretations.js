/**
 * Interpretations Page Logic
 * Загрузка и отображение психологического профиля через OpenAI
 */

// Состояние
let currentUserId = null;
let currentInterpretation = null;

// DOM элементы
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const contentState = document.getElementById('contentState');
const errorMessage = document.getElementById('errorMessage');
const retryBtn = document.getElementById('retryBtn');
const regenerateBtn = document.getElementById('regenerateBtn');
const profileContent = document.getElementById('profileContent');
const birthDetails = document.getElementById('birthDetails');

// Мета-информация
const metaModel = document.getElementById('metaModel');
const metaTokens = document.getElementById('metaTokens');
const metaTime = document.getElementById('metaTime');
const metaCached = document.getElementById('metaCached');

function t(key, params) {
    return window.FrontendI18n?.t?.(key, params) || key;
}

function withLocaleHeaders(headers = {}) {
    if (window.AstroAPI?.withLocaleHeaders) {
        return window.AstroAPI.withLocaleHeaders(headers);
    }
    return headers;
}

function apiFetch(url, init = {}) {
    return fetch(url, {
        credentials: 'include',
        ...init,
        headers: withLocaleHeaders(init.headers || {}),
    });
}

/**
 * Инициализация страницы
 */
async function init() {
    const me = await window.AstroAPI?.requireAuth?.({ redirectTo: '/login.html' });
    if (!me) return;

    // Получаем user_id из URL или localStorage
    const urlParams = new URLSearchParams(window.location.search);
    currentUserId = urlParams.get('user_id') || localStorage.getItem('currentUserId');
    
    if (!currentUserId) {
        showError(t('page.interpretations.errors.userIdMissing'));
        return;
    }
    
    // Загружаем данные карты для отображения birth details
    await loadBirthDetails();
    
    // Загружаем или генерируем интерпретацию
    await loadInterpretation(false);
}

/**
 * Загрузка данных рождения
 */
async function loadBirthDetails() {
    try {
        const response = await apiFetch(`/api/v1/natal/${currentUserId}`, { method: 'GET' });
        if (response.ok) {
            const data = await response.json();
            if (data.birth_data) {
                birthDetails.textContent = `${data.birth_data.date} ${data.birth_data.time} • ${data.birth_data.place}`;
            }
        }
    } catch (e) {
        console.warn('Failed to load birth details:', e);
    }
}

/**
 * Загрузка/генерация интерпретации
 */
async function loadInterpretation(forceRegenerate = false) {
    showLoading();
    
    try {
        const response = await apiFetch(`/api/v1/interpretations/${currentUserId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                interpretation_type: 'psychological_profile',
                force_regenerate: forceRegenerate
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || error.detail || t('page.interpretations.errors.loadFailed'));
        }
        
        currentInterpretation = await response.json();
        showContent(currentInterpretation);
        
    } catch (error) {
        showError(error.message);
    }
}

/**
 * Показать состояние загрузки
 */
function showLoading() {
    loadingState.classList.remove('hidden');
    errorState.classList.add('hidden');
    contentState.classList.add('hidden');
}

/**
 * Показать ошибку
 */
function showError(message) {
    loadingState.classList.add('hidden');
    errorState.classList.remove('hidden');
    contentState.classList.add('hidden');
    errorMessage.textContent = message;
}

/**
 * Показать контент
 */
function showContent(data) {
    loadingState.classList.add('hidden');
    errorState.classList.add('hidden');
    contentState.classList.remove('hidden');
    
    // Мета-информация
    metaModel.textContent = t('page.interpretations.meta.model', { value: data.model || t('common.notAvailable') });
    metaTokens.textContent = t('page.interpretations.meta.tokens', { value: data.tokens_used || t('common.notAvailable') });
    metaTime.textContent = t('page.interpretations.meta.time', { value: data.generation_time_ms });
    metaCached.textContent = data.cached ? t('page.interpretations.meta.cached') : '';
    metaCached.style.display = data.cached ? 'inline' : 'none';
    
    // Рендерим контент
    renderProfile(data.content);
}

/**
 * Рендеринг профиля
 */
function renderProfile(content) {
    profileContent.innerHTML = '';

    if (!content) {
        profileContent.innerHTML = `<p class="profile-text">${t('page.interpretations.empty')}</p>`;
        return;
    }

    // Если это raw_text (не JSON)
    if (content.raw_text) {
        const section = document.createElement('div');
        section.className = 'profile-section';

        // Рендерим markdown
        const htmlContent = renderMarkdown(content.raw_text);
        section.innerHTML = `<div class="profile-text">${htmlContent}</div>`;
        profileContent.appendChild(section);
        return;
    }

    // Обрабатываем структурированный JSON
    for (const [key, value] of Object.entries(content)) {
        const section = document.createElement('div');
        section.className = 'profile-section';

        const title = formatSectionTitle(key);
        section.innerHTML = `<h3 class="profile-section-title">${title}</h3>`;

        if (Array.isArray(value)) {
            const list = document.createElement('ul');
            list.className = 'profile-list';
            value.forEach(item => {
                const li = document.createElement('li');
                if (typeof item === 'string') {
                    li.innerHTML = renderMarkdown(item);
                } else {
                    li.textContent = JSON.stringify(item);
                }
                list.appendChild(li);
            });
            section.appendChild(list);
        } else if (typeof value === 'object') {
            section.innerHTML += `<pre class="profile-text">${JSON.stringify(value, null, 2)}</pre>`;
        } else {
            const htmlContent = renderMarkdown(String(value));
            section.innerHTML += `<div class="profile-text">${htmlContent}</div>`;
        }

        profileContent.appendChild(section);
    }
}

/**
 * Рендеринг markdown в HTML
 */
function renderMarkdown(text) {
    if (typeof marked === 'undefined') {
        // Fallback если marked.js не загружен
        return escapeHtml(text).replace(/\n/g, '<br>');
    }

    // Настраиваем marked для безопасного рендеринга
    marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: false,
        mangle: false
    });

    return marked.parse(text);
}

/**
 * Форматирование названия секции
 */
function formatSectionTitle(key) {
    const translationKey = `page.interpretations.sections.${key}`;
    const localized = t(translationKey);
    if (localized !== translationKey) {
        return localized;
    }
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event Listeners
retryBtn.addEventListener('click', () => loadInterpretation(false));
regenerateBtn.addEventListener('click', () => loadInterpretation(true));
document.addEventListener('frontend:locale-changed', () => {
    if (currentInterpretation) {
        showContent(currentInterpretation);
    }
});

// Init
document.addEventListener('DOMContentLoaded', init);

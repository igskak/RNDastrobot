/**
 * Chat Widget для взаимодействия с OpenAI агентом
 */

const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8000/api/v1'
    : '/api/v1';

function t(key, params) {
    return window.FrontendI18n?.t?.(key, params) || key;
}

function withLocaleHeaders(headers = {}) {
    if (window.AstroAPI?.withLocaleHeaders) {
        return window.AstroAPI.withLocaleHeaders(headers);
    }
    return headers;
}

class ChatWidget {
    constructor() {
        this.threadId = null;
        this.isOpen = false;
        this.isLoading = false;
        
        // DOM элементы
        this.widget = document.getElementById('chatWidget');
        this.toggle = document.getElementById('chatToggle');
        this.close = document.getElementById('chatClose');
        this.messages = document.getElementById('chatMessages');
        this.input = document.getElementById('chatInput');
        this.send = document.getElementById('chatSend');
        
        this.init();
    }
    
    init() {
        // События
        this.toggle.addEventListener('click', () => this.open());
        this.close.addEventListener('click', () => this.close());
        this.send.addEventListener('click', () => this.sendMessage());
        
        // Enter для отправки (Shift+Enter для новой строки)
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Автоматическое изменение высоты textarea
        this.input.addEventListener('input', () => {
            this.input.style.height = 'auto';
            this.input.style.height = this.input.scrollHeight + 'px';
        });
    }
    
    open() {
        this.isOpen = true;
        this.widget.classList.add('open');
        this.input.focus();
    }
    
    close() {
        this.isOpen = false;
        this.widget.classList.remove('open');
    }
    
    addMessage(content, role = 'user') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = content;
        
        messageDiv.appendChild(contentDiv);
        this.messages.appendChild(messageDiv);
        
        // Скролл вниз
        this.messages.scrollTop = this.messages.scrollHeight;
        
        return messageDiv;
    }
    
    addLoadingMessage() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message assistant loading';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        messageDiv.appendChild(contentDiv);
        this.messages.appendChild(messageDiv);
        
        this.messages.scrollTop = this.messages.scrollHeight;
        
        return messageDiv;
    }
    
    async sendMessage() {
        const message = this.input.value.trim();
        
        if (!message || this.isLoading) {
            return;
        }
        
        // Добавляем сообщение пользователя
        this.addMessage(message, 'user');
        this.input.value = '';
        this.input.style.height = 'auto';
        
        // Показываем индикатор загрузки
        this.isLoading = true;
        this.send.disabled = true;
        const loadingMsg = this.addLoadingMessage();
        
        try {
            // Получаем данные натальной карты из sessionStorage
            const chartData = this.getChartData();
            
            // Отправляем запрос
            const response = await fetch(`${API_BASE_URL}/chat/message`, {
                method: 'POST',
                headers: withLocaleHeaders({
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    message: message,
                    chart_data: chartData,
                    thread_id: this.threadId
                }),
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || error.detail || t('page.chat.errors.sendFailed'));
            }
            
            const data = await response.json();
            
            // Сохраняем thread_id для продолжения диалога
            this.threadId = data.thread_id;
            
            // Удаляем индикатор загрузки
            loadingMsg.remove();
            
            // Добавляем ответ ассистента
            this.addMessage(data.response, 'assistant');
            
        } catch (error) {
            console.error('Ошибка чата:', error);
            loadingMsg.remove();
            this.addMessage(
                t('page.chat.errors.assistantFallback'),
                'assistant'
            );
        } finally {
            this.isLoading = false;
            this.send.disabled = false;
            this.input.focus();
        }
    }
    
    getChartData() {
        try {
            const storedData = sessionStorage.getItem('natalChart');
            if (storedData) {
                return JSON.parse(storedData);
            }
        } catch (error) {
            console.error('Ошибка при получении данных карты:', error);
        }
        return null;
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.chatWidget = new ChatWidget();
});

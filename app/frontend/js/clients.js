/**
 * Логика страницы базы клиентов
 */

const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:8000/api/v1'
    : '/api/v1';

const state = {
    users: [],
    filteredUsers: [],
    searchTerm: '',
    sortBy: 'created_desc'
};

let toastTimer = null;

const refs = {};

function getAdminHeaders() {
    const token = localStorage.getItem('adminApiToken');
    return token ? { 'X-Admin-Token': token } : {};
}

document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    bindEvents();
    loadClients();
});

function cacheElements() {
    refs.loading = document.getElementById('loading');
    refs.emptyState = document.getElementById('emptyState');
    refs.noResultsState = document.getElementById('noResultsState');
    refs.tableWrap = document.getElementById('tableWrap');
    refs.tbody = document.getElementById('clientsBody');
    refs.countEl = document.getElementById('clientCount');
    refs.searchInput = document.getElementById('searchInput');
    refs.sortSelect = document.getElementById('sortSelect');
    refs.resultsMeta = document.getElementById('resultsMeta');
    refs.toast = document.getElementById('toast');
}

function bindEvents() {
    refs.searchInput.addEventListener('input', (event) => {
        state.searchTerm = event.target.value.trim().toLowerCase();
        renderUsers();
    });

    refs.sortSelect.addEventListener('change', (event) => {
        state.sortBy = event.target.value;
        renderUsers();
    });

    refs.tbody.addEventListener('click', async (event) => {
        const actionBtn = event.target.closest('button[data-action]');
        if (!actionBtn) return;

        const { action, userId } = actionBtn.dataset;
        if (!userId) return;

        if (action === 'open') {
            await openChart(userId);
            return;
        }

        if (action === 'delete') {
            await handleDelete(userId, actionBtn);
        }
    });
}

async function loadClients() {
    refs.loading.textContent = 'Загрузка...';
    refs.loading.classList.remove('hidden');
    refs.emptyState.classList.add('hidden');
    refs.noResultsState.classList.add('hidden');
    refs.tableWrap.classList.add('hidden');

    try {
        const response = await fetch(`${API_BASE}/users`, {
            headers: getAdminHeaders()
        });
        if (!response.ok) throw new Error('Не удалось получить список клиентов');

        const users = await response.json();
        state.users = Array.isArray(users) ? users : [];

        refs.loading.classList.add('hidden');

        if (state.users.length === 0) {
            refs.emptyState.classList.remove('hidden');
            refs.countEl.textContent = '';
            refs.resultsMeta.textContent = '';
            return;
        }

        renderUsers();
    } catch (error) {
        refs.loading.textContent = `Ошибка загрузки: ${error.message}`;
        console.error(error);
    }
}

function renderUsers() {
    const filtered = filterUsers(state.users, state.searchTerm);
    const sorted = sortUsers(filtered, state.sortBy);
    state.filteredUsers = sorted;

    refs.tbody.innerHTML = '';

    if (state.users.length > 0 && sorted.length === 0) {
        refs.tableWrap.classList.add('hidden');
        refs.noResultsState.classList.remove('hidden');
    } else {
        refs.noResultsState.classList.add('hidden');

        for (const user of sorted) {
            refs.tbody.appendChild(buildUserRow(user));
        }

        refs.tableWrap.classList.remove('hidden');
    }

    updateCounters();
}

function buildUserRow(user) {
    const tr = document.createElement('tr');

    const userId = String(user.user_id || '');
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || '—';
    const birthDate = user.birth_date ? formatDate(user.birth_date) : '—';
    const place = user.birth_place || '—';
    const created = user.created_at ? formatDateTime(user.created_at) : '—';

    tr.innerHTML = `
        <td data-label="Имя"><strong>${escapeHtml(name)}</strong></td>
        <td data-label="Дата рождения">${escapeHtml(birthDate)}</td>
        <td data-label="Место">${escapeHtml(place)}</td>
        <td data-label="Создан">${escapeHtml(created)}</td>
        <td data-label="Действия" class="clients-actions">
            <button class="btn-open" data-action="open" data-user-id="${escapeHtml(userId)}">Открыть</button>
            <button class="btn-delete" data-action="delete" data-user-id="${escapeHtml(userId)}">Удалить</button>
        </td>
    `;

    return tr;
}

function filterUsers(users, searchTerm) {
    if (!searchTerm) return [...users];

    return users.filter((user) => {
        const name = [user.first_name, user.last_name].filter(Boolean).join(' ').toLowerCase();
        const place = (user.birth_place || '').toLowerCase();
        const birthDate = user.birth_date ? formatDate(user.birth_date).toLowerCase() : '';

        return name.includes(searchTerm) || place.includes(searchTerm) || birthDate.includes(searchTerm);
    });
}

function sortUsers(users, sortBy) {
    const list = [...users];

    const compareDate = (a, b, field, dir = 1) => {
        const aDate = a[field] ? new Date(a[field]).getTime() : 0;
        const bDate = b[field] ? new Date(b[field]).getTime() : 0;
        return (aDate - bDate) * dir;
    };

    if (sortBy === 'created_asc') {
        return list.sort((a, b) => compareDate(a, b, 'created_at', 1));
    }

    if (sortBy === 'created_desc') {
        return list.sort((a, b) => compareDate(a, b, 'created_at', -1));
    }

    if (sortBy === 'birth_asc') {
        return list.sort((a, b) => compareDate(a, b, 'birth_date', 1));
    }

    if (sortBy === 'birth_desc') {
        return list.sort((a, b) => compareDate(a, b, 'birth_date', -1));
    }

    if (sortBy === 'name_desc') {
        return list.sort((a, b) => getName(b).localeCompare(getName(a), 'ru'));
    }

    return list.sort((a, b) => getName(a).localeCompare(getName(b), 'ru'));
}

function getName(user) {
    return [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
}

function updateCounters() {
    const total = state.users.length;
    const shown = state.filteredUsers.length;

    refs.countEl.textContent = `Всего клиентов: ${total}`;

    if (state.searchTerm) {
        refs.resultsMeta.textContent = `Показано: ${shown} из ${total}`;
        return;
    }

    refs.resultsMeta.textContent = `Показано: ${shown}`;
}

async function openChart(userId) {
    try {
        const response = await fetch(`${API_BASE}/natal/${userId}`);
        if (!response.ok) throw new Error('Карта не найдена');

        const chartData = await response.json();
        AstroAPI.saveChartToSession(chartData);

        showPageLoader();
        window.location.href = '/chart.html';
    } catch (error) {
        showToast(`Ошибка: ${error.message}`, 'error');
    }
}

async function handleDelete(userId, button) {
    if (button.dataset.confirming !== 'true') {
        button.dataset.confirming = 'true';
        button.classList.add('confirming');
        button.textContent = 'Подтвердить';

        setTimeout(() => {
            if (button.dataset.confirming !== 'true') return;
            button.dataset.confirming = 'false';
            button.classList.remove('confirming');
            button.textContent = 'Удалить';
        }, 4000);

        showToast('Нажмите «Подтвердить», чтобы удалить клиента', 'warning');
        return;
    }

    button.disabled = true;
    button.textContent = '...';

    try {
        const response = await fetch(`${API_BASE}/users/${userId}`, {
            method: 'DELETE',
            headers: getAdminHeaders()
        });
        if (!response.ok) {
            let message = 'Ошибка удаления';
            try {
                const payload = await response.json();
                if (payload && typeof payload.detail === 'string' && payload.detail.trim()) {
                    message = payload.detail;
                }
            } catch (_) {
                // ignore json parse errors for non-json responses
            }
            throw new Error(message);
        }

        state.users = state.users.filter((user) => String(user.user_id) !== String(userId));

        if (state.users.length === 0) {
            refs.tableWrap.classList.add('hidden');
            refs.noResultsState.classList.add('hidden');
            refs.emptyState.classList.remove('hidden');
            refs.countEl.textContent = '';
            refs.resultsMeta.textContent = '';
        } else {
            renderUsers();
        }

        showToast('Клиент удалён', 'success');
    } catch (error) {
        button.disabled = false;
        button.dataset.confirming = 'false';
        button.classList.remove('confirming');
        button.textContent = 'Удалить';
        showToast(`Ошибка: ${error.message}`, 'error');
    }
}

function showToast(message, type = 'info') {
    refs.toast.textContent = message;
    refs.toast.className = `toast ${type}`;

    requestAnimationFrame(() => {
        refs.toast.classList.add('visible');
    });

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        refs.toast.classList.remove('visible');
    }, 2800);
}

function formatDate(isoDate) {
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function formatDateTime(isoStr) {
    const dt = new Date(isoStr);
    if (Number.isNaN(dt.getTime())) return isoStr;

    return `${dt.toLocaleDateString('ru-RU')} ${dt.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    })}`;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

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
let currentAstrologer = null;

function t(key, params) {
    return window.FrontendI18n?.t?.(key, params) || key;
}

function withLocaleHeaders(headers = {}) {
    if (window.AstroAPI?.withLocaleHeaders) {
        return window.AstroAPI.withLocaleHeaders(headers);
    }
    return headers;
}

function getNameCollator() {
    if (window.LocaleFormatters?.getCollator) {
        return window.LocaleFormatters.getCollator({
            sensitivity: 'base',
            numeric: true,
        });
    }
    const locale = window.FrontendI18n?.getLocale?.() || 'en';
    return new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
}

function apiFetch(url, init = {}) {
    return fetch(url, {
        credentials: 'include',
        ...init,
        headers: withLocaleHeaders(init.headers || {}),
    });
}

document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    bindEvents();
    bootstrapPage();
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
    refs.logoutBtn = document.getElementById('logoutBtn');
    refs.welcome = document.getElementById('welcomeLabel');
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
        // Toggle ⋯ menu
        const toggleBtn = event.target.closest('button[data-action="toggle-menu"]');
        if (toggleBtn) {
            event.stopPropagation();
            const dropdown = toggleBtn.nextElementSibling;
            const isOpen = dropdown.classList.contains('open');
            closeAllDropdowns();
            if (!isOpen) {
                dropdown.classList.add('open');
                toggleBtn.classList.add('open');
            }
            return;
        }

        // Action inside dropdown
        const actionBtn = event.target.closest('button[data-action]');
        if (actionBtn) {
            const { action, userId } = actionBtn.dataset;
            if (!userId) return;
            if (action === 'delete') { await handleDelete(userId, actionBtn); }
            return;
        }

        // Row click → open chart
        closeAllDropdowns();
        const row = event.target.closest('tr[data-user-id]');
        if (row) {
            await openChart(row.dataset.userId);
        }
    });

    document.addEventListener('click', closeAllDropdowns);

    document.addEventListener('frontend:locale-changed', () => {
        if (refs.loading && !refs.loading.classList.contains('hidden') && !state.users.length) {
            refs.loading.textContent = t('common.loading');
        }
        renderUsers();
    });

    if (refs.logoutBtn) {
        refs.logoutBtn.addEventListener('click', async () => {
            try {
                await window.AstroAPI?.logout?.();
            } finally {
                window.location.href = '/login.html';
            }
        });
    }
}

async function bootstrapPage() {
    currentAstrologer = await window.AstroAPI?.requireAuth?.({ redirectTo: '/login.html' });
    if (!currentAstrologer) return;

    if (refs.welcome) {
        refs.welcome.textContent = currentAstrologer.email || '';
    }

    await loadClients();
}

async function loadClients() {
    refs.loading.textContent = t('common.loading');
    refs.loading.classList.remove('hidden');
    refs.emptyState.classList.add('hidden');
    refs.noResultsState.classList.add('hidden');
    refs.tableWrap.classList.add('hidden');

    try {
        const response = await apiFetch(`${API_BASE}/users`, { method: 'GET' });
        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        if (!response.ok) throw new Error(t('page.clients.errors.fetchList'));

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
        refs.loading.textContent = t('page.clients.errors.loadingWithMessage', { message: error.message });
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

function closeAllDropdowns() {
    document.querySelectorAll('.actions-dropdown.open').forEach((d) => d.classList.remove('open'));
    document.querySelectorAll('.btn-actions.open').forEach((b) => b.classList.remove('open'));
}

function buildUserRow(user) {
    const tr = document.createElement('tr');

    const userId = String(user.user_id || '');
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || t('common.notAvailable');
    const initials = [user.first_name, user.last_name]
        .filter(Boolean)
        .map((n) => n[0].toUpperCase())
        .join('')
        .slice(0, 2) || '?';
    const birthDate = user.birth_date ? formatDate(user.birth_date) : t('common.notAvailable');
    const place = user.birth_place || t('common.notAvailable');
    const created = user.created_at ? formatDateTime(user.created_at) : t('common.notAvailable');
    const labelName = escapeHtml(t('page.clients.table.name'));
    const labelBirthDate = escapeHtml(t('page.clients.table.birthDate'));
    const labelPlace = escapeHtml(t('page.clients.table.place'));
    const labelCreated = escapeHtml(t('page.clients.table.created'));
    const labelActions = escapeHtml(t('page.clients.table.actions'));
    const openLabel = escapeHtml(t('page.clients.actions.open'));
    const deleteLabel = escapeHtml(t('page.clients.actions.delete'));

    tr.dataset.userId = userId;
    tr.innerHTML = `
        <td data-label="${labelName}">
            <div class="client-name-cell">
                <span class="client-avatar">${escapeHtml(initials)}</span>
                <strong>${escapeHtml(name)}</strong>
            </div>
        </td>
        <td data-label="${labelBirthDate}">${escapeHtml(birthDate)}</td>
        <td data-label="${labelPlace}">${escapeHtml(place)}</td>
        <td data-label="${labelCreated}">${escapeHtml(created)}</td>
        <td data-label="${labelActions}">
            <div class="row-actions">
                <button class="btn-actions" data-action="toggle-menu" data-user-id="${escapeHtml(userId)}" aria-label="${escapeHtml(t('page.clients.table.actions'))}">
                    <svg width="14" height="4" viewBox="0 0 14 4" fill="none"><circle cx="2" cy="2" r="1.4" fill="currentColor"/><circle cx="7" cy="2" r="1.4" fill="currentColor"/><circle cx="12" cy="2" r="1.4" fill="currentColor"/></svg>
                </button>
                <div class="actions-dropdown">
                    <button class="action-item danger" data-action="delete" data-user-id="${escapeHtml(userId)}">${deleteLabel}</button>
                </div>
            </div>
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
        const collator = getNameCollator();
        return list.sort((a, b) => collator.compare(getName(b), getName(a)));
    }

    const collator = getNameCollator();
    return list.sort((a, b) => collator.compare(getName(a), getName(b)));
}

function getName(user) {
    return [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
}

function updateCounters() {
    const total = state.users.length;
    const shown = state.filteredUsers.length;

    refs.countEl.textContent = t('page.clients.counters.total', { total });

    if (state.searchTerm) {
        refs.resultsMeta.textContent = t('page.clients.counters.shownOf', { shown, total });
        refs.resultsMeta.style.display = '';
        return;
    }

    refs.resultsMeta.textContent = '';
    refs.resultsMeta.style.display = 'none';
}

async function openChart(userId) {
    try {
        const response = await apiFetch(`${API_BASE}/natal/${userId}`, { method: 'GET' });
        if (!response.ok) throw new Error(t('page.clients.errors.chartNotFound'));

        const chartData = await response.json();
        AstroAPI.saveChartToSession(chartData);

        window.showPageLoader?.();
        window.location.href = '/chart.html';
    } catch (error) {
        showToast(t('common.errorWithMessage', { message: error.message }), 'error');
    }
}

async function handleDelete(userId, button) {
    if (button.dataset.confirming !== 'true') {
        button.dataset.confirming = 'true';
        button.classList.add('confirming');
        button.textContent = t('page.clients.actions.confirmDelete');

        setTimeout(() => {
            if (button.dataset.confirming !== 'true') return;
            button.dataset.confirming = 'false';
            button.classList.remove('confirming');
            button.textContent = t('page.clients.actions.delete');
        }, 4000);

        showToast(t('page.clients.messages.confirmDeleteHint'), 'warning');
        return;
    }

    button.disabled = true;
    button.textContent = '...';

    try {
        const response = await apiFetch(`${API_BASE}/users/${userId}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            let message = t('page.clients.errors.deleteFailed');
            try {
                const payload = await response.json();
                if (payload && typeof payload.message === 'string' && payload.message.trim()) {
                    message = payload.message;
                } else if (payload && typeof payload.detail === 'string' && payload.detail.trim()) {
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

        showToast(t('page.clients.messages.deleted'), 'success');
    } catch (error) {
        button.disabled = false;
        button.dataset.confirming = 'false';
        button.classList.remove('confirming');
        button.textContent = t('page.clients.actions.delete');
        showToast(t('common.errorWithMessage', { message: error.message }), 'error');
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
    if (window.LocaleFormatters?.formatDateTime) {
        return window.LocaleFormatters.formatDateTime(dt);
    }
    const locale = window.FrontendI18n?.getLocale?.() || 'en';
    return `${dt.toLocaleDateString(locale)} ${dt.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit'
    })}`;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

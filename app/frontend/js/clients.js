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
const editClientState = {
    autocompleteBound: false,
    userId: null,
    loadedChartData: null,
    originalCoords: null,
    selectedCoords: null,
    originalPlace: '',
    selectedPlaceLabel: '',
};

const refs = {};
let currentAstrologer = null;
const HERO_SEEN_STORAGE_PREFIX = 'steliara.clients.hero-seen';

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
    refs.body = document.body;
    refs.workspaceHero = document.getElementById('workspaceHero');
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
    refs.statTotal = document.getElementById('statTotal');
    refs.statLatest = document.getElementById('statLatest');
    refs.editBackdrop = document.getElementById('editClientBackdrop');
    refs.editDialog = document.getElementById('editClientDialog');
    refs.editForm = document.getElementById('editClientForm');
    refs.editClose = document.getElementById('editClientClose');
    refs.editCancel = document.getElementById('editClientCancel');
    refs.editSubmit = document.getElementById('editClientSubmit');
    refs.editError = document.getElementById('editClientError');
    refs.editFirstName = document.getElementById('editFirstName');
    refs.editLastName = document.getElementById('editLastName');
    refs.editDay = document.getElementById('editBirthDay');
    refs.editMonth = document.getElementById('editBirthMonth');
    refs.editYear = document.getElementById('editBirthYear');
    refs.editHour = document.getElementById('editBirthHour');
    refs.editMinute = document.getElementById('editBirthMinute');
    refs.editPlaceInput = document.getElementById('editBirthPlace');
    refs.editPlaceSuggestions = document.getElementById('editBirthPlaceSuggestions');
    refs.editPlaceHint = document.getElementById('editPlaceHint');
    refs.editTimezone = document.getElementById('editTimezone');
    refs.editTimezoneHint = document.getElementById('editTimezoneHint');
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
                toggleBtn.setAttribute('aria-expanded', 'true');
            }
            return;
        }

        // Action inside dropdown
        const actionBtn = event.target.closest('button[data-action]');
        if (actionBtn) {
            const { action, userId } = actionBtn.dataset;
            if (!userId) return;
            closeAllDropdowns();
            if (action === 'edit') {
                await openEditClientDialog(userId);
                return;
            }
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
        renderProfileSummary();
        renderUsers();
        refreshEditDialogLocale();
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

    initEditClientDialog();
}

async function bootstrapPage() {
    currentAstrologer = await window.AstroAPI?.requireAuth?.({ redirectTo: '/login.html' });
    if (!currentAstrologer) return;

    renderProfileSummary();
    applyHeroPlacement();

    await loadClients();
}

function renderProfileSummary() {
    if (!refs.welcome) return;
    const email = currentAstrologer?.email || t('common.notAvailable');
    refs.welcome.textContent = t('page.clients.profile.signedInAs', { email });
}

function applyHeroPlacement() {
    if (!refs.body || !refs.workspaceHero) return;

    const seen = getHeroSeenFlag();
    refs.body.classList.toggle('clients-page--returning', seen);

    if (!seen) {
        setHeroSeenFlag();
    }
}

function getHeroStorageKey() {
    const identity = String(currentAstrologer?.email || 'default').trim().toLowerCase();
    return `${HERO_SEEN_STORAGE_PREFIX}:${identity}`;
}

function getHeroSeenFlag() {
    try {
        return window.localStorage?.getItem(getHeroStorageKey()) === '1';
    } catch (_) {
        return false;
    }
}

function setHeroSeenFlag() {
    try {
        window.localStorage?.setItem(getHeroStorageKey(), '1');
    } catch (_) {
        // Ignore storage errors; default to first-visit placement.
    }
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
            updateCounters();
            refs.emptyState.classList.remove('hidden');
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
    document.querySelectorAll('.btn-actions.open, .btn-actions[aria-expanded="true"]').forEach((button) => {
        button.classList.remove('open');
        button.setAttribute('aria-expanded', 'false');
    });
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
    const editLabel = escapeHtml(t('page.clients.actions.edit'));
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
                <button class="btn-actions" type="button" data-action="toggle-menu" data-user-id="${escapeHtml(userId)}" aria-label="${escapeHtml(t('page.clients.table.actions'))}" aria-haspopup="menu" aria-expanded="false">
                    <svg width="14" height="4" viewBox="0 0 14 4" fill="none"><circle cx="2" cy="2" r="1.4" fill="currentColor"/><circle cx="7" cy="2" r="1.4" fill="currentColor"/><circle cx="12" cy="2" r="1.4" fill="currentColor"/></svg>
                </button>
                <div class="actions-dropdown">
                    <button class="action-item" type="button" data-action="edit" data-user-id="${escapeHtml(userId)}">${editLabel}</button>
                    <button class="action-item danger" type="button" data-action="delete" data-user-id="${escapeHtml(userId)}">${deleteLabel}</button>
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

    if (refs.statTotal) {
        refs.statTotal.textContent = String(total);
    }

    if (refs.statLatest) {
        refs.statLatest.textContent = getLatestCreatedLabel(state.users);
    }

    if (state.searchTerm) {
        refs.resultsMeta.textContent = t('page.clients.counters.shownOf', { shown, total });
        refs.resultsMeta.style.display = '';
        return;
    }

    refs.resultsMeta.textContent = '';
    refs.resultsMeta.style.display = 'none';
}

function getLatestCreatedLabel(users) {
    if (!Array.isArray(users) || users.length === 0) {
        return t('common.notAvailable');
    }

    let latestUser = null;
    let latestTs = 0;

    for (const user of users) {
        const ts = user?.created_at ? new Date(user.created_at).getTime() : 0;
        if (ts > latestTs) {
            latestTs = ts;
            latestUser = user;
        }
    }

    if (!latestUser || !latestUser.created_at) {
        return t('common.notAvailable');
    }

    return formatDateTime(latestUser.created_at);
}

async function openChart(userId) {
    try {
        const response = await apiFetch(`${API_BASE}/natal/${userId}`, { method: 'GET' });
        if (!response.ok) throw new Error(t('page.clients.errors.chartNotFound'));

        const chartData = await response.json();
        AstroAPI.saveChartToSession(chartData);
        AstroAPI.saveFormData(
            AstroAPI.chartToFormData(chartData, {
                houseSystem: AstroAPI.getFormData()?.houseSystem || 'P',
            })
        );

        window.showPageLoader?.();
        window.location.href = '/chart.html';
    } catch (error) {
        showToast(t('common.errorWithMessage', { message: error.message }), 'error');
    }
}

function initEditClientDialog() {
    if (!refs.editDialog || refs.editDialog.dataset.bound === 'true') return;

    refs.editDialog.dataset.bound = 'true';
    window.Timezones?.populate?.(refs.editTimezone);

    refs.editClose?.addEventListener('click', closeEditClientDialog);
    refs.editCancel?.addEventListener('click', closeEditClientDialog);
    refs.editBackdrop?.addEventListener('click', closeEditClientDialog);
    refs.editForm?.addEventListener('submit', handleEditClientSubmit);
    refs.editPlaceInput?.addEventListener('input', handleEditPlaceInput);
    refs.editPlaceInput?.addEventListener('focus', bindEditPlaceAutocomplete, { once: true });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !refs.editDialog.classList.contains('hidden')) {
            closeEditClientDialog();
        }
    });
}

async function openEditClientDialog(userId) {
    if (!userId) return;

    try {
        const response = await apiFetch(`${API_BASE}/natal/${userId}`, { method: 'GET' });
        if (!response.ok) throw new Error(t('page.clients.edit.errors.loadFailed'));

        const chartData = await response.json();
        const formData = AstroAPI.chartToFormData(chartData, {
            houseSystem: chartData?.birth_data?.house_system || AstroAPI.getFormData()?.houseSystem || 'P',
        });
        const place = String(formData.place || '').trim();
        const latitude = formData.latitude == null ? Number.NaN : Number(formData.latitude);
        const longitude = formData.longitude == null ? Number.NaN : Number(formData.longitude);

        editClientState.userId = String(chartData.user_id || userId);
        editClientState.loadedChartData = chartData;
        editClientState.originalCoords = {
            lat: latitude,
            lon: longitude,
        };
        editClientState.selectedCoords = {
            lat: latitude,
            lon: longitude,
        };
        editClientState.originalPlace = normalizeLooseText(place);
        editClientState.selectedPlaceLabel = normalizeLooseText(place);

        refs.editFirstName.value = formData.firstName || '';
        refs.editLastName.value = formData.lastName || '';
        refs.editDay.value = formData.day || '';
        refs.editMonth.value = formData.month || '';
        refs.editYear.value = formData.year || '';
        refs.editHour.value = formData.hour || '';
        refs.editMinute.value = formData.minute || '';
        refs.editPlaceInput.value = place;

        window.Timezones?.populate?.(refs.editTimezone);
        refs.editTimezone.value = formData.timezone || '';
        refs.editTimezoneHint.textContent = '';
        refs.editTimezoneHint.style.color = '';
        refs.editError.classList.add('hidden');
        refs.editError.textContent = '';

        renderEditPlaceHint('current');
        setEditClientSubmitting(false);

        refs.editBackdrop.classList.remove('hidden');
        refs.editDialog.classList.remove('hidden');
        refs.editFirstName.focus();
        document.body.style.overflow = 'hidden';
    } catch (error) {
        showToast(t('common.errorWithMessage', { message: error.message }), 'error');
    }
}

function closeEditClientDialog() {
    if (!refs.editDialog) return;

    refs.editBackdrop.classList.add('hidden');
    refs.editDialog.classList.add('hidden');
    refs.editError.classList.add('hidden');
    refs.editError.textContent = '';
    refs.editTimezoneHint.textContent = '';
    refs.editTimezoneHint.style.color = '';
    editClientState.userId = null;
    editClientState.loadedChartData = null;
    document.body.style.overflow = '';
}

function refreshEditDialogLocale() {
    if (!refs.editDialog || refs.editDialog.classList.contains('hidden')) return;

    const timezoneValue = refs.editTimezone.value;
    window.Timezones?.populate?.(refs.editTimezone);
    if (timezoneValue) {
        refs.editTimezone.value = timezoneValue;
    }
    renderEditPlaceHint(resolveEditPlaceHintMode());
}

function bindEditPlaceAutocomplete() {
    if (
        editClientState.autocompleteBound
        || !window.PlaceAutocomplete
        || !refs.editPlaceInput
        || !refs.editPlaceSuggestions
    ) {
        return;
    }

    editClientState.autocompleteBound = true;

    window.PlaceAutocomplete.attach({
        input: refs.editPlaceInput,
        suggestions: refs.editPlaceSuggestions,
        minChars: 2,
        debounceMs: 350,
        limit: 5,
        getLabel: (item) => item.shortName || item.displayName,
        onSelect: async (item) => {
            editClientState.selectedCoords = { lat: item.lat, lon: item.lon };
            editClientState.selectedPlaceLabel = normalizeLooseText(item.shortName || item.displayName);
            renderEditPlaceHint('selected');

            let resolvedTimezone = null;
            if (item.sourceId && window.AstroAPI?.resolvePlaceTimezone) {
                try {
                    resolvedTimezone = await window.AstroAPI.resolvePlaceTimezone(item.sourceId);
                } catch (_error) {
                    resolvedTimezone = null;
                }
            }

            if (!resolvedTimezone) {
                resolvedTimezone = window.Timezones?.guess?.(item.displayName || item.shortName) || null;
            }

            if (resolvedTimezone) {
                refs.editTimezone.value = resolvedTimezone;
                refs.editTimezoneHint.textContent = t('page.index.form.timezone.autoDetected');
                refs.editTimezoneHint.style.color = '#22c55e';
            }
        },
    });
}

function handleEditPlaceInput(event) {
    const nextValue = normalizeLooseText(event.target.value);
    if (!nextValue) {
        editClientState.selectedCoords = null;
        renderEditPlaceHint('empty');
        return;
    }

    if (nextValue === editClientState.selectedPlaceLabel) {
        renderEditPlaceHint(resolveEditPlaceHintMode());
        return;
    }

    if (nextValue === editClientState.originalPlace) {
        editClientState.selectedCoords = editClientState.originalCoords;
        editClientState.selectedPlaceLabel = editClientState.originalPlace;
        renderEditPlaceHint('current');
        return;
    }

    editClientState.selectedCoords = null;
    renderEditPlaceHint('manual');
}

function resolveEditPlaceHintMode() {
    if (
        editClientState.selectedCoords
        && editClientState.selectedPlaceLabel === editClientState.originalPlace
    ) {
        return 'current';
    }
    if (editClientState.selectedCoords) {
        return 'selected';
    }
    if (refs.editPlaceInput?.value?.trim()) {
        return 'manual';
    }
    return 'empty';
}

function renderEditPlaceHint(mode) {
    if (!refs.editPlaceHint) return;

    refs.editPlaceHint.style.color = '';

    if (mode === 'selected') {
        refs.editPlaceHint.textContent = t('page.clients.edit.placeSelected');
        refs.editPlaceHint.style.color = '#22c55e';
        return;
    }

    if (mode === 'manual') {
        refs.editPlaceHint.textContent = t('page.clients.edit.placeManual');
        refs.editPlaceHint.style.color = '#b07d10';
        return;
    }

    if (mode === 'empty') {
        refs.editPlaceHint.textContent = t('page.clients.edit.placeHint');
        return;
    }

    refs.editPlaceHint.textContent = t('page.clients.edit.placeCurrent');
}

async function handleEditClientSubmit(event) {
    event.preventDefault();

    if (!refs.editForm.reportValidity()) return;
    if (!editClientState.userId) {
        refs.editError.textContent = t('page.clients.edit.errors.chartUnavailable');
        refs.editError.classList.remove('hidden');
        return;
    }

    const place = refs.editPlaceInput.value.trim();
    const requestData = {
        first_name: refs.editFirstName.value.trim(),
        last_name: refs.editLastName.value.trim(),
        date: AstroAPI.formatDate(refs.editDay.value, refs.editMonth.value, refs.editYear.value),
        time: AstroAPI.formatTime(refs.editHour.value, refs.editMinute.value),
        timezone: refs.editTimezone.value,
        place,
        house_system: editClientState.loadedChartData?.birth_data?.house_system
            || AstroAPI.getFormData()?.houseSystem
            || 'P',
    };

    const resolvedCoords = resolveEditCoords(place);
    if (resolvedCoords) {
        requestData.latitude = resolvedCoords.lat;
        requestData.longitude = resolvedCoords.lon;
    }

    refs.editError.classList.add('hidden');
    refs.editError.textContent = '';
    setEditClientSubmitting(true);

    try {
        const updatedChartData = await AstroAPI.updateClientChart(editClientState.userId, requestData);
        state.users = state.users.map((user) => (
            String(user.user_id) === String(updatedChartData.user_id)
                ? buildUpdatedUserRecord(user, updatedChartData)
                : user
        ));
        renderUsers();
        closeEditClientDialog();
        showToast(t('page.clients.messages.updated'), 'success');
    } catch (error) {
        refs.editError.textContent = error.message || t('page.clients.edit.errors.saveFailed');
        refs.editError.classList.remove('hidden');
    } finally {
        setEditClientSubmitting(false);
    }
}

function buildUpdatedUserRecord(user, chartData) {
    const birthData = chartData?.birth_data || {};
    return {
        ...user,
        user_id: chartData?.user_id || user.user_id,
        first_name: birthData.first_name || '',
        last_name: birthData.last_name || '',
        birth_date: birthData.date || user.birth_date,
        birth_place: birthData.place || user.birth_place,
    };
}

function resolveEditCoords(place) {
    const normalizedPlace = normalizeLooseText(place);
    const lat = Number(editClientState.selectedCoords?.lat);
    const lon = Number(editClientState.selectedCoords?.lon);

    if (!normalizedPlace || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
    }

    if (
        normalizedPlace === editClientState.selectedPlaceLabel
        || normalizedPlace === editClientState.originalPlace
    ) {
        return { lat, lon };
    }

    return null;
}

function normalizeLooseText(value) {
    return String(value || '').trim().toLowerCase();
}

function setEditClientSubmitting(isSubmitting) {
    if (!refs.editSubmit) return;

    refs.editSubmit.disabled = isSubmitting;
    refs.editSubmit.querySelector('.btn-text')?.classList.toggle('hidden', isSubmitting);
    refs.editSubmit.querySelector('.btn-loader')?.classList.toggle('hidden', !isSubmitting);
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

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
    sortBy: 'created_desc',
    expandedUserId: null,
    consultationsCache: {},
    callSessionsCache: {},
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

document.addEventListener('DOMContentLoaded', async () => {
    await waitForI18nReady();
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
    refs.statUpcoming = document.getElementById('statUpcoming');
    refs.statUnpaid = document.getElementById('statUnpaid');
    // Alerts panel
    refs.alertsPanel = document.getElementById('alertsPanel');
    refs.alertsSolar = document.getElementById('alertsSolar');
    refs.alertsSolarList = document.getElementById('alertsSolarList');
    refs.alertsTransits = document.getElementById('alertsTransits');
    refs.alertsTransitsList = document.getElementById('alertsTransitsList');
    refs.alertsEmptyState = document.getElementById('alertsEmptyState');
    refs.alertsSkeleton = document.getElementById('alertsSkeleton');
    // CRM contact fields in edit modal
    refs.editEmail = document.getElementById('editEmail');
    refs.editPhone = document.getElementById('editPhone');
    refs.editMessenger = document.getElementById('editMessenger');
    refs.editTags = document.getElementById('editTags');
    refs.editNotes = document.getElementById('editNotes');
    // Log session dialog
    refs.logSessionBackdrop = document.getElementById('logSessionBackdrop');
    refs.logSessionDialog = document.getElementById('logSessionDialog');
    refs.logSessionForm = document.getElementById('logSessionForm');
    refs.logSessionClose = document.getElementById('logSessionClose');
    refs.logSessionCancel = document.getElementById('logSessionCancel');
    refs.logSessionSubmit = document.getElementById('logSessionSubmit');
    refs.logSessionError = document.getElementById('logSessionError');
    refs.logSessionType = document.getElementById('logSessionType');
    refs.logSessionDate = document.getElementById('logSessionDate');
    refs.logSessionStatus = document.getElementById('logSessionStatus');
    refs.logSessionDuration = document.getElementById('logSessionDuration');
    refs.logSessionPaid = document.getElementById('logSessionPaid');
    refs.logSessionNotes = document.getElementById('logSessionNotes');
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

        // Action inside dropdown or detail panel
        const actionBtn = event.target.closest('button[data-action]');
        if (actionBtn) {
            const { action, userId } = actionBtn.dataset;
            if (!userId) return;
            closeAllDropdowns();
            if (action === 'edit') {
                await openEditClientDialog(userId);
                return;
            }
            if (action === 'delete') { await handleDelete(userId, actionBtn); return; }
            if (action === 'open-chart') { await openChart(userId); return; }
            if (action === 'open-forecast') { await openForecastForUser(userId); return; }
            if (action === 'log-session') { openLogSessionDialog(userId); return; }
            if (action === 'start-call') { await startCallSession(userId); return; }
            if (action === 'delete-consultation') {
                await deleteConsultation(actionBtn.dataset.consultationId, userId);
                return;
            }
            return;
        }

        // Retry processing button
        const retryBtn = event.target.closest('.cs-retry-btn[data-session-id]');
        if (retryBtn) {
            await retryProcessing(retryBtn.dataset.sessionId, retryBtn);
            return;
        }

        // Call recording row click
        const csRow = event.target.closest('.cs-row--expandable[data-session-id]');
        if (csRow) {
            await openCallRecording(csRow.dataset.sessionId, csRow);
            return;
        }

        // Skip clicks inside detail panel
        if (event.target.closest('.client-detail-panel')) return;

        // Row click → toggle expandable detail
        closeAllDropdowns();
        const row = event.target.closest('tr[data-user-id]:not(.client-detail-row)');
        if (row) {
            await toggleDetailPanel(row.dataset.userId);
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
    initLogSessionDialog();
}

async function bootstrapPage() {
    currentAstrologer = await window.AstroAPI?.requireAuth?.({ redirectTo: '/login.html' });
    if (!currentAstrologer) return;

    renderProfileSummary();
    applyHeroPlacement();

    await loadClients();
    loadAlerts();
    initMiniCal();
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
    const openChartLabel = escapeHtml(t('page.clients.detail.openChart'));
    const forecastLabel = escapeHtml(t('page.chart.nav.forecast'));
    const upcomingCount = Number(user.upcoming_count || 0);
    const unpaidCount = Number(user.unpaid_count || 0);
    const summaryChips = [];

    if (upcomingCount > 0) {
        summaryChips.push(`
            <span class="client-summary-chip client-summary-chip-upcoming">
                ${escapeHtml(t('page.clients.statsUpcoming'))}: ${escapeHtml(String(upcomingCount))}
            </span>
        `);
    }

    if (unpaidCount > 0) {
        summaryChips.push(`
            <span class="client-summary-chip client-summary-chip-unpaid">
                ${escapeHtml(t('page.clients.statsUnpaid'))}: ${escapeHtml(String(unpaidCount))}
            </span>
        `);
    }

    tr.dataset.userId = userId;
    tr.innerHTML = `
        <td class="client-cell client-cell-name" data-label="${labelName}">
            <div class="client-name-cell">
                <span class="client-avatar">${escapeHtml(initials)}</span>
                <div class="client-name-stack">
                    <strong class="client-name-text">${escapeHtml(name)}</strong>
                    ${summaryChips.length > 0 ? `<div class="client-summary-chips">${summaryChips.join('')}</div>` : ''}
                    <div class="client-card-quick-actions">
                        <button class="client-quick-btn client-quick-btn-primary" type="button" data-action="open-chart" data-user-id="${escapeHtml(userId)}">
                            ${openChartLabel}
                        </button>
                        <button class="client-quick-btn" type="button" data-action="open-forecast" data-user-id="${escapeHtml(userId)}">
                            ${forecastLabel}
                        </button>
                    </div>
                </div>
            </div>
        </td>
        <td class="client-cell client-cell-birth" data-label="${labelBirthDate}">
            <div class="client-fact">
                <span class="client-fact-label">${labelBirthDate}</span>
                <span class="client-fact-value">${escapeHtml(birthDate)}</span>
            </div>
        </td>
        <td class="client-cell client-cell-place" data-label="${labelPlace}">
            <div class="client-fact">
                <span class="client-fact-label">${labelPlace}</span>
                <span class="client-fact-value">${escapeHtml(place)}</span>
            </div>
        </td>
        <td class="client-cell client-cell-created" data-label="${labelCreated}">
            <div class="client-fact">
                <span class="client-fact-label">${labelCreated}</span>
                <span class="client-fact-value">${escapeHtml(created)}</span>
            </div>
        </td>
        <td class="client-cell client-cell-actions" data-label="${labelActions}">
            <div class="row-actions">
                <button class="btn-actions" type="button" data-action="toggle-menu" data-user-id="${escapeHtml(userId)}" aria-label="${escapeHtml(t('page.clients.table.actions'))}" aria-haspopup="menu" aria-expanded="false">
                    <svg width="14" height="4" viewBox="0 0 14 4" fill="none"><circle cx="2" cy="2" r="1.4" fill="currentColor"/><circle cx="7" cy="2" r="1.4" fill="currentColor"/><circle cx="12" cy="2" r="1.4" fill="currentColor"/></svg>
                </button>
                <div class="actions-dropdown">
                    <a class="action-item" href="/client/${escapeHtml(userId)}">${escapeHtml(t('page.clientProfile.viewProfile'))}</a>
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

    if (refs.countEl) {
        refs.countEl.textContent = t('page.clients.counters.total', { total });
    }

    if (refs.statTotal) {
        refs.statTotal.textContent = String(total);
    }

    if (refs.statUpcoming) {
        const upcoming = state.users.reduce((sum, u) => sum + (u.upcoming_count || 0), 0);
        refs.statUpcoming.textContent = String(upcoming);
    }

    if (refs.statUnpaid) {
        const unpaid = state.users.reduce((sum, u) => sum + (u.unpaid_count || 0), 0);
        refs.statUnpaid.textContent = String(unpaid);
    }

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
        AstroAPI.saveFormData(AstroAPI.chartToFormData(chartData));

        window.showPageLoader?.();
        window.location.href = '/chart.html';
    } catch (error) {
        showToast(t('common.errorWithMessage', { message: error.message }), 'error');
    }
}

async function openForecastForUser(userId, { tab = 'biwheel', date, solarYear } = {}) {
    try {
        const response = await apiFetch(`${API_BASE}/natal/${userId}`, { method: 'GET' });
        if (!response.ok) throw new Error(t('page.clients.errors.chartNotFound'));

        const chartData = await response.json();
        AstroAPI.saveChartToSession(chartData);
        AstroAPI.saveFormData(AstroAPI.chartToFormData(chartData));

        const params = new URLSearchParams();
        params.set('tab', tab);
        if (date) params.set('date', date);
        if (solarYear) params.set('solarYear', solarYear);

        window.showPageLoader?.();
        window.location.href = `/forecast.html?${params.toString()}`;
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
        const formData = AstroAPI.chartToFormData(chartData);
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

        // CRM contact fields — pull from state.users (not from chart API)
        const userRecord = state.users.find((u) => String(u.user_id) === String(userId));
        if (refs.editEmail) refs.editEmail.value = userRecord?.email || '';
        if (refs.editPhone) refs.editPhone.value = userRecord?.phone || '';
        if (refs.editMessenger) refs.editMessenger.value = userRecord?.messenger || '';
        if (refs.editTags) refs.editTags.value = Array.isArray(userRecord?.tags) ? userRecord.tags.join(', ') : '';
        if (refs.editNotes) refs.editNotes.value = userRecord?.notes || '';

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
    const tagsRaw = (refs.editTags?.value || '').trim();
    const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [];
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
        email: refs.editEmail?.value?.trim() || '',
        phone: refs.editPhone?.value?.trim() || '',
        messenger: refs.editMessenger?.value?.trim() || '',
        tags,
        notes: refs.editNotes?.value?.trim() || '',
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
                ? buildUpdatedUserRecord(user, updatedChartData, requestData)
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

function buildUpdatedUserRecord(user, chartData, requestData) {
    const birthData = chartData?.birth_data || {};
    return {
        ...user,
        user_id: chartData?.user_id || user.user_id,
        first_name: birthData.first_name || '',
        last_name: birthData.last_name || '',
        birth_date: birthData.date || user.birth_date,
        birth_place: birthData.place || user.birth_place,
        email: requestData?.email ?? user.email,
        phone: requestData?.phone ?? user.phone,
        messenger: requestData?.messenger ?? user.messenger,
        tags: requestData?.tags ?? user.tags,
        notes: requestData?.notes ?? user.notes,
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
            if (refs.countEl) {
                refs.countEl.textContent = '';
            }
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

/* ─── Expandable detail panel ─────────────────────────────────────────── */

async function toggleDetailPanel(userId) {
    // Collapse current
    const existing = refs.tbody.querySelector('.client-detail-row');
    if (existing) {
        const wasId = existing.dataset.userId;
        existing.remove();
        state.expandedUserId = null;
        if (wasId === userId) return; // toggle off
    }

    const user = state.users.find((u) => String(u.user_id) === userId);
    if (!user) return;

    state.expandedUserId = userId;

    // Fetch consultations and call sessions in parallel
    let consultations = state.consultationsCache[userId];
    let callSessions  = state.callSessionsCache[userId];

    const fetches = [];
    if (!consultations) fetches.push(
        apiFetch(`${API_BASE}/consultations?user_id=${userId}`)
            .then(r => r.ok ? r.json() : []).catch(() => [])
            .then(d => { consultations = d; state.consultationsCache[userId] = d; })
    );
    if (!callSessions) fetches.push(
        apiFetch(`${API_BASE}/call-sessions?user_id=${userId}&include_non_terminal=true`)
            .then(r => r.ok ? r.json() : []).catch(() => [])
            .then(d => { callSessions = d; state.callSessionsCache[userId] = d; })
    );
    if (fetches.length) await Promise.all(fetches);

    const detailRow = document.createElement('tr');
    detailRow.classList.add('client-detail-row');
    detailRow.dataset.userId = userId;

    const td = document.createElement('td');
    td.colSpan = 5;
    td.innerHTML = buildDetailPanelHTML(user, consultations, callSessions || []);
    detailRow.appendChild(td);

    // Insert after the user's row
    const userRow = refs.tbody.querySelector(`tr[data-user-id="${userId}"]:not(.client-detail-row)`);
    if (userRow && userRow.nextSibling) {
        refs.tbody.insertBefore(detailRow, userRow.nextSibling);
    } else {
        refs.tbody.appendChild(detailRow);
    }
}

function buildDetailPanelHTML(user, consultations, callSessions = []) {
    const userId = escapeHtml(String(user.user_id));
    const callSessionsHTML = buildCallSessionsHTML(callSessions);

    // Contact summary — email only in quick view
    const contactHTML = user.email
        ? `<span class="detail-contact-item">${escapeHtml(user.email)}</span>`
        : `<span class="detail-contacts-empty">${escapeHtml(t('page.clients.crm.noContact'))}</span>`;

    // Tags
    const tagsHTML = Array.isArray(user.tags) && user.tags.length > 0
        ? `<div class="detail-tags">${user.tags.map((tag) => `<span class="detail-tag">${escapeHtml(tag)}</span>`).join('')}</div>`
        : '';

    // Last consultation summary (one line)
    let lastSessionHTML = '';
    if (consultations.length > 0) {
        const last = consultations[0];
        const typeLabel = t(`page.clients.consultation.types.${last.consultation_type}`) || last.consultation_type;
        const statusLabel = t(`page.clients.consultation.statuses.${last.status}`) || last.status;
        const dateStr = last.scheduled_at ? formatDateTime(last.scheduled_at) : '';
        lastSessionHTML = `
            <div class="detail-last-session">
                <span class="detail-last-session-label">${escapeHtml(t('page.clients.detail.lastSession'))}</span>
                <span class="session-type-badge">${escapeHtml(typeLabel)}</span>
                <span class="session-date">${escapeHtml(dateStr)}</span>
                <span class="session-status">${escapeHtml(statusLabel)}</span>
            </div>`;
    }

    // Next planned consultation
    const nextPlanned = consultations.find((c) => c.status === 'planned');
    let nextSessionHTML = '';
    if (nextPlanned) {
        const typeLabel = t(`page.clients.consultation.types.${nextPlanned.consultation_type}`) || nextPlanned.consultation_type;
        const dateStr = nextPlanned.scheduled_at ? formatDateTime(nextPlanned.scheduled_at) : '';
        nextSessionHTML = `
            <div class="detail-last-session">
                <span class="detail-last-session-label">${escapeHtml(t('page.clients.detail.nextSession'))}</span>
                <span class="session-type-badge">${escapeHtml(typeLabel)}</span>
                <span class="session-date">${escapeHtml(dateStr)}</span>
            </div>`;
    }

    return `
        <div class="client-detail-panel">
            <div class="detail-top">
                <div class="detail-contacts">${contactHTML}</div>
                ${tagsHTML}
            </div>
            ${lastSessionHTML || nextSessionHTML ? `<div class="detail-session-summary">${lastSessionHTML}${nextSessionHTML}</div>` : ''}
            <div class="detail-actions">
                <a class="btn-new btn-sm" href="/client/${userId}">${escapeHtml(t('page.clientProfile.viewProfile'))}</a>
                <button class="btn-new btn-sm btn-secondary" type="button" data-action="open-chart" data-user-id="${userId}">${escapeHtml(t('page.clients.detail.openChart'))}</button>
                <button class="btn-new btn-sm btn-secondary" type="button" data-action="open-forecast" data-user-id="${userId}">${escapeHtml(t('page.chart.nav.forecast'))}</button>
                <button class="btn-new btn-sm btn-secondary" type="button" data-action="log-session" data-user-id="${userId}">${escapeHtml(t('page.clients.detail.logSession'))}</button>
                <button class="btn-new btn-sm btn-secondary" type="button" data-action="edit" data-user-id="${userId}">${escapeHtml(t('page.clients.actions.edit'))}</button>
                <button class="btn-new btn-sm btn-call" type="button" data-action="start-call" data-user-id="${userId}">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><rect x="1" y="3" width="8" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M9 5.5l3-2v6l-3-2V5.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
                    ${escapeHtml(t('page.clientProfile.startCall'))}
                </button>
            </div>
            ${callSessionsHTML}
        </div>`;
}

/* ─── Call Sessions History ───────────────────────────────────────────── */

function buildCallSessionsHTML(callSessions) {
    if (!callSessions || callSessions.length === 0) return '';

    const STATUS_LABELS = {
        created:    { label: 'Scheduled',   cls: 'cs-status--created'    },
        active:     { label: 'In progress', cls: 'cs-status--active'     },
        ended:      { label: 'Ended',       cls: 'cs-status--ended'      },
        processing: { label: 'Processing…', cls: 'cs-status--processing' },
        completed:  { label: 'Completed',   cls: 'cs-status--completed'  },
        failed:     { label: 'Failed',      cls: 'cs-status--failed'     },
    };

    const rows = callSessions.map(cs => {
        const status  = STATUS_LABELS[cs.call_status] || { label: cs.call_status, cls: '' };
        const dateStr = cs.started_at
            ? new Date(cs.started_at + 'Z').toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
            : (cs.created_at ? new Date(cs.created_at + 'Z').toLocaleDateString() : '—');
        const dur = cs.duration_seconds
            ? `${Math.floor(cs.duration_seconds / 60)}m ${cs.duration_seconds % 60}s`
            : '';
        const isExpandable = ['ended', 'processing', 'completed', 'failed'].includes(cs.call_status);
        const expandIcon = isExpandable
            ? `<svg class="cs-expand-icon" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
            : '';
        const spinner = cs.call_status === 'processing'
            ? `<span class="cs-spinner"></span>`
            : '';

        return `
            <div class="cs-row${isExpandable ? ' cs-row--expandable' : ''}"
                 data-action="${isExpandable ? 'view-recording' : ''}"
                 data-session-id="${escapeHtml(cs.id)}">
                <span class="cs-date">${escapeHtml(dateStr)}</span>
                ${dur ? `<span class="cs-duration">${escapeHtml(dur)}</span>` : '<span class="cs-duration"></span>'}
                <span class="cs-status ${status.cls}">${spinner}${escapeHtml(status.label)}</span>
                ${expandIcon}
            </div>
            <div class="cs-recording-panel" id="cs-panel-${escapeHtml(cs.id)}" hidden></div>`;
    }).join('');

    return `
        <div class="detail-call-sessions">
            <h4 class="detail-sessions-title">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style="opacity:.55;margin-right:4px;vertical-align:-1px"><rect x="1" y="3" width="8" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M9 5.5l3-2v6l-3-2V5.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
                Call recordings
            </h4>
            <div class="detail-sessions-list">${rows}</div>
        </div>`;
}

async function openCallRecording(sessionId, rowEl) {
    const panel = document.getElementById(`cs-panel-${sessionId}`);
    if (!panel) return;

    // Toggle
    if (!panel.hidden) {
        panel.hidden = true;
        rowEl.classList.remove('cs-row--open');
        return;
    }
    rowEl.classList.add('cs-row--open');
    panel.hidden = false;

    // Already loaded
    if (panel.dataset.loaded) return;
    panel.dataset.loaded = '1';
    panel.innerHTML = `<div class="cs-panel-loading"><span class="cs-spinner"></span> Loading…</div>`;

    try {
        const csRes = await apiFetch(`${API_BASE}/call-sessions/${sessionId}`);
        const cs    = csRes.ok ? await csRes.json() : null;

        // Still processing — show spinner and start polling
        if (cs?.call_status === 'processing') {
            panel.innerHTML = `<div class="cs-panel-loading"><span class="cs-spinner"></span> Transcription in progress… this may take a few minutes.</div>`;
            pollProcessingSession(sessionId, panel, rowEl);
            return;
        }

        const audioRes = cs?.audio_storage_path
            ? await apiFetch(`${API_BASE}/call-sessions/${sessionId}/audio-url`)
            : null;
        const audio = audioRes?.ok ? await audioRes.json() : null;

        panel.innerHTML = buildRecordingPanelHTML(cs, audio?.url || null, sessionId);
    } catch (err) {
        panel.innerHTML = `<p class="cs-panel-error">Could not load recording: ${escapeHtml(err.message)}</p>`;
    }
}

function pollProcessingSession(sessionId, panel, rowEl) {
    let attempts = 0;
    const MAX_ATTEMPTS = 36; // 6 min max
    const INTERVAL_MS  = 10_000;

    const timer = setInterval(async () => {
        attempts++;
        if (attempts > MAX_ATTEMPTS) {
            clearInterval(timer);
            panel.innerHTML = `<div class="cs-panel-error">Processing timed out. <button class="btn-new btn-sm cs-retry-btn" data-action="retry-processing" data-session-id="${escapeHtml(sessionId)}">Retry</button></div>`;
            return;
        }
        try {
            const res = await apiFetch(`${API_BASE}/call-sessions/${sessionId}`);
            if (!res.ok) return;
            const cs = await res.json();

            if (cs.call_status === 'processing') return; // still going

            clearInterval(timer);

            // Update the status badge in the row
            const badge = rowEl.querySelector('.cs-status');
            if (badge) {
                const STATUS_LABELS = {
                    completed: { label: 'Completed', cls: 'cs-status--completed' },
                    failed:    { label: 'Failed',    cls: 'cs-status--failed'    },
                };
                const s = STATUS_LABELS[cs.call_status];
                if (s) {
                    badge.className = `cs-status ${s.cls}`;
                    badge.textContent = s.label;
                }
            }

            // Load audio URL and render
            const audioRes = cs.audio_storage_path
                ? await apiFetch(`${API_BASE}/call-sessions/${sessionId}/audio-url`)
                : null;
            const audio = audioRes?.ok ? await audioRes.json() : null;
            panel.dataset.loaded = '1';
            panel.innerHTML = buildRecordingPanelHTML(cs, audio?.url || null, sessionId);
        } catch (_) { /* ignore transient network errors */ }
    }, INTERVAL_MS);
}

function buildRecordingPanelHTML(cs, audioUrl, sessionId) {
    // Failed state — show error + retry button
    if (cs?.call_status === 'failed') {
        const errMsg = cs.processing_error
            ? `<p class="cs-panel-error">${escapeHtml(cs.processing_error)}</p>`
            : '';
        return `<div class="cs-panel-inner">
            <p class="cs-panel-error">Processing failed.</p>
            ${errMsg}
            <button class="btn-new btn-sm cs-retry-btn" data-action="retry-processing" data-session-id="${escapeHtml(sessionId)}">Retry processing</button>
        </div>`;
    }

    let html = '';

    // Audio player
    if (audioUrl) {
        html += `
            <div class="cs-audio-wrap">
                <audio class="cs-audio-player" controls preload="none" src="${escapeHtml(audioUrl)}">
                    Your browser doesn't support audio playback.
                </audio>
            </div>`;
    }

    // Summary
    if (cs?.summary_text) {
        html += `
            <div class="cs-summary">
                <h5 class="cs-section-title">Summary</h5>
                <p class="cs-summary-text">${escapeHtml(cs.summary_text)}</p>
            </div>`;
    }

    // Key points
    if (cs?.key_points?.length) {
        const items = cs.key_points.map(p => `<li>${escapeHtml(p)}</li>`).join('');
        html += `
            <div class="cs-key-points">
                <h5 class="cs-section-title">Key points</h5>
                <ul class="cs-key-points-list">${items}</ul>
            </div>`;
    }

    // Transcript
    if (cs?.transcript_segments?.length) {
        const segs = cs.transcript_segments.map(seg => {
            const speakerLabel = seg.speaker === 'A' ? 'Astrologer' : 'Client';
            const cls = seg.speaker === 'A' ? 'cs-seg--astrologer' : 'cs-seg--client';
            return `
                <div class="cs-segment ${cls}">
                    <span class="cs-seg-speaker">${escapeHtml(speakerLabel)}</span>
                    <span class="cs-seg-text">${escapeHtml(seg.text)}</span>
                </div>`;
        }).join('');
        html += `
            <details class="cs-transcript-details">
                <summary class="cs-transcript-toggle">Full transcript</summary>
                <div class="cs-transcript">${segs}</div>
            </details>`;
    } else if (cs?.transcript_text) {
        html += `
            <details class="cs-transcript-details">
                <summary class="cs-transcript-toggle">Full transcript</summary>
                <p class="cs-transcript-plain">${escapeHtml(cs.transcript_text)}</p>
            </details>`;
    }

    // Ended but not yet processed — allow manual kick-off
    if (cs?.call_status === 'ended' && cs?.audio_storage_path) {
        html += `
            <div class="cs-reprocess-wrap">
                <button class="btn-new btn-sm cs-retry-btn" data-action="retry-processing" data-session-id="${escapeHtml(sessionId)}">Start processing</button>
            </div>`;
    }

    if (!html) html = `<p class="cs-panel-empty">No recording data available yet.</p>`;
    return `<div class="cs-panel-inner">${html}</div>`;
}

async function retryProcessing(sessionId, btn) {
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Starting…';
    try {
        const res = await apiFetch(`${API_BASE}/call-sessions/${sessionId}/reprocess`, { method: 'POST' });
        if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            throw new Error(d.detail || 'Failed to start reprocessing');
        }
        // Reset the panel to polling state
        const panel = document.getElementById(`cs-panel-${sessionId}`);
        const row   = document.querySelector(`.cs-row--expandable[data-session-id="${sessionId}"]`);
        if (panel && row) {
            delete panel.dataset.loaded;
            panel.innerHTML = `<div class="cs-panel-loading"><span class="cs-spinner"></span> Transcription in progress… this may take a few minutes.</div>`;
            pollProcessingSession(sessionId, panel, row);
        }
    } catch (err) {
        showToast(err.message || 'Could not retry', 'error');
        btn.disabled    = false;
        btn.textContent = orig;
    }
}

/* ─── Start Call ──────────────────────────────────────────────────────── */

async function startCallSession(userId) {
    const btn = refs.tbody.querySelector(`button[data-action="start-call"][data-user-id="${userId}"]`);
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Starting…';
    }
    try {
        const res = await apiFetch(`${API_BASE}/call-sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.detail || 'Failed to create call session');
        }
        const session = await res.json();
        const joinParam = session.join_url ? `&join_url=${encodeURIComponent(session.join_url)}` : '';
        window.location.href = `/consultation-call.html?session_id=${session.id}&user_id=${userId}${joinParam}`;
    } catch (err) {
        showToast(err.message || 'Could not start call', 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><rect x="1" y="3" width="8" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M9 5.5l3-2v6l-3-2V5.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg> Start call';
        }
    }
}

/* ─── Log Session Dialog ──────────────────────────────────────────────── */

const logSessionState = { userId: null };

function initLogSessionDialog() {
    if (!refs.logSessionDialog) return;

    refs.logSessionClose?.addEventListener('click', closeLogSessionDialog);
    refs.logSessionCancel?.addEventListener('click', closeLogSessionDialog);
    refs.logSessionBackdrop?.addEventListener('click', closeLogSessionDialog);
    refs.logSessionForm?.addEventListener('submit', handleLogSessionSubmit);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && refs.logSessionDialog && !refs.logSessionDialog.classList.contains('hidden')) {
            closeLogSessionDialog();
        }
    });
}

function openLogSessionDialog(userId) {
    logSessionState.userId = userId;

    // Reset form
    if (refs.logSessionForm) refs.logSessionForm.reset();
    if (refs.logSessionStatus) refs.logSessionStatus.value = 'completed';
    if (refs.logSessionDate) {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        refs.logSessionDate.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    }
    if (refs.logSessionError) {
        refs.logSessionError.classList.add('hidden');
        refs.logSessionError.textContent = '';
    }
    setLogSessionSubmitting(false);

    refs.logSessionBackdrop?.classList.remove('hidden');
    refs.logSessionDialog?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeLogSessionDialog() {
    refs.logSessionBackdrop?.classList.add('hidden');
    refs.logSessionDialog?.classList.add('hidden');
    logSessionState.userId = null;
    document.body.style.overflow = '';
}

function setLogSessionSubmitting(isSubmitting) {
    if (!refs.logSessionSubmit) return;
    refs.logSessionSubmit.disabled = isSubmitting;
    refs.logSessionSubmit.querySelector('.btn-text')?.classList.toggle('hidden', isSubmitting);
    refs.logSessionSubmit.querySelector('.btn-loader')?.classList.toggle('hidden', !isSubmitting);
}

async function handleLogSessionSubmit(event) {
    event.preventDefault();
    if (!logSessionState.userId) return;

    const payload = {
        user_id: logSessionState.userId,
        consultation_type: refs.logSessionType?.value || 'natal',
        status: refs.logSessionStatus?.value || 'completed',
        is_paid: refs.logSessionPaid?.checked || false,
    };

    if (refs.logSessionDate?.value) {
        payload.scheduled_at = new Date(refs.logSessionDate.value).toISOString();
    }
    const dur = parseInt(refs.logSessionDuration?.value, 10);
    if (dur > 0) payload.duration_minutes = dur;
    const notes = refs.logSessionNotes?.value?.trim();
    if (notes) payload.notes = notes;

    setLogSessionSubmitting(true);
    if (refs.logSessionError) {
        refs.logSessionError.classList.add('hidden');
        refs.logSessionError.textContent = '';
    }

    try {
        const res = await apiFetch(`${API_BASE}/consultations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(t('page.clients.consultation.errors.saveFailed'));

        // Invalidate cache and refresh detail panel
        delete state.consultationsCache[logSessionState.userId];
        const userId = logSessionState.userId;
        closeLogSessionDialog();
        showToast(t('page.clients.consultation.messages.created'), 'success');

        // Refresh user list to update consultation counts
        await loadClients();

        // Re-expand detail if it was open
        if (state.expandedUserId === userId || userId) {
            state.expandedUserId = null;
            await toggleDetailPanel(userId);
        }
    } catch (error) {
        if (refs.logSessionError) {
            refs.logSessionError.textContent = error.message;
            refs.logSessionError.classList.remove('hidden');
        }
    } finally {
        setLogSessionSubmitting(false);
    }
}

/* ─── Smart Alerts ─────────────────────────────────────────────────── */

const ASPECT_GLYPHS = {
    Conjunction: '\u260C',
    Opposition: '\u260D',
    Square: '\u25A1',
    Trine: '\u25B3',
    Sextile: '\u2731',
};

async function loadAlerts() {
    if (!refs.alertsPanel) return;

    refs.alertsSolar?.classList.add('hidden');
    refs.alertsTransits?.classList.add('hidden');
    if (refs.alertsSolarList) refs.alertsSolarList.innerHTML = '';
    if (refs.alertsTransitsList) refs.alertsTransitsList.innerHTML = '';
    refs.alertsEmptyState?.classList.add('hidden');

    // Show skeleton while loading
    refs.alertsSkeleton?.classList.remove('hidden');
    refs.alertsPanel.classList.remove('hidden');

    try {
        const res = await apiFetch(`${API_BASE}/alerts/dashboard`);
        refs.alertsSkeleton?.classList.add('hidden');
        if (!res.ok) {
            refs.alertsEmptyState?.classList.remove('hidden');
            return;
        }
        const data = await res.json();

        const hasSolar = Array.isArray(data.solar_returns) && data.solar_returns.length > 0;
        const hasTransits = Array.isArray(data.transits) && data.transits.length > 0;

        if (!hasSolar && !hasTransits) {
            refs.alertsPanel.classList.remove('hidden');
            refs.alertsEmptyState?.classList.remove('hidden');
            return;
        }

        if (hasSolar && refs.alertsSolarList) {
            refs.alertsSolarList.innerHTML = data.solar_returns.map(buildSolarAlertRow).join('');
            refs.alertsSolar?.classList.remove('hidden');
        }

        if (hasTransits && refs.alertsTransitsList) {
            refs.alertsTransitsList.innerHTML = data.transits.map(buildTransitAlertRow).join('');
            refs.alertsTransits?.classList.remove('hidden');
        }

        refs.alertsPanel.classList.remove('hidden');
    } catch (e) {
        console.error('Failed to load alerts', e);
        refs.alertsSkeleton?.classList.add('hidden');
        refs.alertsEmptyState?.classList.remove('hidden');
    }
}

function buildSolarAlertRow(alert) {
    const days = alert.days_until;
    let timing;
    if (days === 0) timing = t('page.clients.alerts.today');
    else if (days === 1) timing = t('page.clients.alerts.tomorrow');
    else if (days > 0) timing = t('page.clients.alerts.daysUntil', { days });
    else timing = t('page.clients.alerts.passed', { days: Math.abs(days) });

    const dateStr = alert.solar_date ? formatDate(alert.solar_date) : '';

    return `
        <div class="alert-row">
            <span class="alert-name">${escapeHtml(alert.name)}</span>
            <span class="alert-date">${escapeHtml(dateStr)}</span>
            <span class="alert-timing ${days <= 3 && days >= 0 ? 'alert-timing-soon' : ''}">${escapeHtml(timing)}</span>
        </div>`;
}

function buildTransitAlertRow(alert) {
    const glyph = ASPECT_GLYPHS[alert.aspect] || '';
    const dateStr = alert.exact_date ? formatDate(alert.exact_date) : '';
    const transitBody = localizeAstroBody(alert.transit_body);
    const natalBody = localizeAstroBody(alert.natal_body);
    const desc = `${transitBody} ${glyph} ${natalBody}`;

    return `
        <div class="alert-row">
            <span class="alert-name">${escapeHtml(alert.name)}</span>
            <span class="alert-transit-desc ${alert.harmonic_type === 'tense' ? 'alert-tense' : ''}">${escapeHtml(desc)}</span>
            <span class="alert-date">${escapeHtml(dateStr)}</span>
        </div>`;
}

async function deleteConsultation(consultationId, userId) {
    if (!consultationId) return;
    try {
        const res = await apiFetch(`${API_BASE}/consultations/${consultationId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(t('page.clients.consultation.errors.deleteFailed'));

        delete state.consultationsCache[userId];
        showToast(t('page.clients.consultation.messages.deleted'), 'success');

        // Refresh and re-expand
        await loadClients();
        if (userId) {
            state.expandedUserId = null;
            await toggleDetailPanel(userId);
        }
    } catch (error) {
        showToast(t('common.errorWithMessage', { message: error.message }), 'error');
    }
}

// ── Mini Calendar Widget ─────────────────────────────────────────────────────

const STATUS_COLORS_MINI = {
    planned:   '#1E3A5F',
    completed: '#2B7A4B',
    cancelled: '#9B9289',
    no_show:   '#B83232',
};

function getIntlLocale() {
    return window.LocaleFormatters?.toIntlLocale?.(window.FrontendI18n?.getLocale?.() || 'en') || 'en-US';
}

function formatMiniCalendarMonthTitle(year, month) {
    const locale = getIntlLocale();
    const date = new Date(year, month, 1);
    const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long' }).format(date);
    return `${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)} ${year}`;
}

function getMiniCalendarWeekdayLabels() {
    const locale = getIntlLocale();
    const monday = new Date(Date.UTC(2026, 0, 5)); // Monday
    return Array.from({ length: 7 }, (_, index) => {
        const day = new Date(monday);
        day.setUTCDate(monday.getUTCDate() + index);
        return new Intl.DateTimeFormat(locale, { weekday: 'short' })
            .format(day)
            .replace(/\.$/, '');
    });
}

function renderMiniCalendarWeekdays(container) {
    if (!container) return;
    container.innerHTML = '';
    getMiniCalendarWeekdayLabels().forEach((label) => {
        const item = document.createElement('span');
        item.textContent = label;
        container.appendChild(item);
    });
}

function localizeAstroBody(name) {
    if (!name) return '';
    const translated = t(`astro.planet.${name}`);
    return translated && translated !== `astro.planet.${name}` ? translated : name;
}

function initMiniCal() {
    const grid    = document.getElementById('miniCalGrid');
    const dowRow  = document.getElementById('miniCalDowRow');
    const title   = document.getElementById('miniCalTitle');
    const btnPrev = document.getElementById('miniCalPrev');
    const btnNext = document.getElementById('miniCalNext');
    if (!grid || !title) return;

    const today = new Date();
    let year  = today.getFullYear();
    let month = today.getMonth(); // 0-indexed

    async function renderMonth() {
        title.textContent = formatMiniCalendarMonthTitle(year, month);
        renderMiniCalendarWeekdays(dowRow);
        grid.innerHTML = '';

        // Fetch events for this month
        const start = new Date(year, month, 1);
        const end   = new Date(year, month + 1, 0, 23, 59, 59);
        let eventsByDay = {};
        try {
            const params = new URLSearchParams({
                start: start.toISOString(),
                end:   end.toISOString(),
            });
            const res = await apiFetch(`${API_BASE}/consultations/calendar?${params}`);
            if (res.ok) {
                const events = await res.json();
                for (const ev of events) {
                    const d = new Date(ev.start);
                    const key = d.getDate();
                    if (!eventsByDay[key]) eventsByDay[key] = [];
                    eventsByDay[key].push(ev.extendedProps?.status || 'planned');
                }
            }
        } catch (_) { /* silently skip */ }

        // First weekday of month: Mon=0 … Sun=6
        const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
        // Days in month
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        // Days in prev month (for leading filler)
        const daysInPrev  = new Date(year, month, 0).getDate();

        const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;
        const todayKey = (today.getFullYear() === year && today.getMonth() === month)
            ? today.getDate() : -1;

        for (let i = 0; i < totalCells; i++) {
            const cell = document.createElement('a');
            cell.className = 'mini-cal-day';

            let dayNum, isCurrentMonth;
            if (i < firstDow) {
                dayNum = daysInPrev - firstDow + i + 1;
                isCurrentMonth = false;
            } else if (i >= firstDow + daysInMonth) {
                dayNum = i - firstDow - daysInMonth + 1;
                isCurrentMonth = false;
            } else {
                dayNum = i - firstDow + 1;
                isCurrentMonth = true;
            }

            if (!isCurrentMonth) cell.classList.add('mini-cal-day--other-month');
            if (isCurrentMonth && dayNum === todayKey) cell.classList.add('mini-cal-day--today');

            const numEl = document.createElement('span');
            numEl.className = 'mini-cal-day-num';
            numEl.textContent = dayNum;
            cell.appendChild(numEl);

            if (isCurrentMonth && eventsByDay[dayNum]) {
                cell.classList.add('mini-cal-day--has-events');
                const dots = document.createElement('div');
                dots.className = 'mini-cal-dots';
                // Show up to 3 dots, deduplicated by status
                const statuses = [...new Set(eventsByDay[dayNum])].slice(0, 3);
                for (const s of statuses) {
                    const dot = document.createElement('span');
                    dot.className = 'mini-cal-dot';
                    dot.style.background = STATUS_COLORS_MINI[s] || STATUS_COLORS_MINI.planned;
                    dots.appendChild(dot);
                }
                cell.appendChild(dots);

                // Navigate to full calendar day view on click
                const iso = `${year}-${String(month + 1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
                cell.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.location.href = `/calendar?date=${iso}&view=timeGridDay`;
                });
            } else {
                cell.removeAttribute('href');
            }

            grid.appendChild(cell);
        }
    }

    btnPrev?.addEventListener('click', () => {
        month--;
        if (month < 0) { month = 11; year--; }
        renderMonth();
    });

    btnNext?.addEventListener('click', () => {
        month++;
        if (month > 11) { month = 0; year++; }
        renderMonth();
    });

    document.addEventListener('frontend:locale-changed', () => {
        renderMonth();
        loadAlerts();
    });

    renderMonth();
}

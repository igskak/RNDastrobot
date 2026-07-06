/**
 * Логика страницы базы клиентов
 */

const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:8000/api/v1'
    : '/api/v1';

const state = {
    libraryView: 'charts',
    users: [],
    charts: [],
    people: [],
    apiTagPool: [],   // distinct tags across charts + persons (incl. family tags)
    filteredUsers: [],
    searchTerm: '',
    activeTag: '',
    activeProfileId: '',
    sortBy: 'created_desc',
    expandedUserId: null,
    consultationsCache: {},
    callSessionsCache: {},
    personTagIndex: new Map(),
    renderRafId: 0,
    searchRenderTimer: 0,
};

let toastTimer = null;
const newChartState = {
    autocompleteBound: false,
    selectedCoords: null,
    selectedPlaceLabel: '',
};

const editClientState = {
    autocompleteBound: false,
    isChartMode: false,
    isCreateMode: false,
    submitting: false,
    userId: null,
    loadedChartData: null,
    originalCoords: null,
    selectedCoords: null,
    originalPlace: '',
    selectedPlaceLabel: '',
    selectedPersons: [],        // [{ id, name }] — first is primary (FK), rest via M2M
    originalLinkedIds: [],      // person_ids currently linked via M2M (from chart meta)
    personAutocompleteBound: false,
};

const refs = {};
let currentAstrologer = null;
const HERO_SEEN_STORAGE_PREFIX = 'steliara.clients.hero-seen';
let clientListMetaCache = new WeakMap();

function scheduleAfterPaint(callback, timeout = 1200) {
    const task = () => {
        try {
            callback();
        } catch (error) {
            console.warn('Deferred clients task failed:', error);
        }
    };
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(task, { timeout });
        return;
    }
    window.setTimeout(task, 0);
}

function resetClientListMetaCache() {
    clientListMetaCache = new WeakMap();
}

function scheduleRenderUsers({ debounce = 0 } = {}) {
    if (state.searchRenderTimer) {
        window.clearTimeout(state.searchRenderTimer);
        state.searchRenderTimer = 0;
    }

    if (debounce > 0) {
        state.searchRenderTimer = window.setTimeout(() => {
            state.searchRenderTimer = 0;
            requestRenderUsersFrame();
        }, debounce);
        return;
    }

    requestRenderUsersFrame();
}

function requestRenderUsersFrame() {
    if (state.renderRafId) return;
    const scheduleFrame = typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame.bind(window)
        : (callback) => window.setTimeout(callback, 16);
    state.renderRafId = scheduleFrame(() => {
        state.renderRafId = 0;
        renderUsers();
    });
}

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

function planCan(feature) {
    if (!window.AstroPlan?.canUseFeature) return true;
    return window.AstroPlan.canUseFeature(feature, currentAstrologer);
}

function isSavedChartLimitReached() {
    return window.AstroPlan?.getSavedChartLimitState?.(currentAstrologer)?.reached === true;
}

function openPlanUpgrade(reason) {
    if (window.AstroPlan?.showUpgradeModal) {
        window.AstroPlan.showUpgradeModal({ reason, astrologer: currentAstrologer });
        return;
    }
    showToast(t('page.plan.modal.copy.default'), 'error');
}

function getPlanStatusLabel() {
    const planCode = window.AstroPlan?.getPlanCode?.(currentAstrologer) || currentAstrologer?.plan_code || 'pro';
    const planName = t(`page.plan.names.${planCode}`);
    const usage = window.AstroPlan?.getSavedChartLimitState?.(currentAstrologer);
    if (!usage || usage.max === null || usage.max === undefined) {
        return t('page.plan.statusWithUnlimitedCharts', {
            plan: planName,
            current: usage?.current || 0,
        });
    }
    return t('page.plan.statusWithLimitedCharts', {
        plan: planName,
        current: usage.current,
        max: usage.max,
    });
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
    refs.tagFilterSelect = document.getElementById('tagFilterSelect');
    refs.sortSelect = document.getElementById('sortSelect');
    refs.tableHeadName = document.getElementById('clientsTableHeadName');
    refs.tableHeadDate = document.getElementById('clientsTableHeadDate');
    refs.tableHeadPlace = document.getElementById('clientsTableHeadPlace');
    refs.tableHeadTags = document.getElementById('clientsTableHeadTags');
    refs.tableHeadMeta = document.getElementById('clientsTableHeadMeta');
    refs.libraryTabs = Array.from(document.querySelectorAll('[data-library-view]'));
    refs.resultsMeta = document.getElementById('resultsMeta');
    refs.toast = document.getElementById('toast');
    refs.logoutBtn = document.getElementById('logoutBtn');
    refs.welcome = document.getElementById('welcomeLabel');
    refs.planStatus = document.getElementById('planStatusLabel');
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
    refs.editTagSuggestionsWrap = document.getElementById('editTagSuggestionsWrap');
    refs.editTagSuggestions = document.getElementById('editTagSuggestions');
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
    refs.editChartTitle = document.getElementById('editChartTitle');
    refs.editFullNameGroup = document.getElementById('editFullNameGroup');
    refs.editChartTitleGroup = document.getElementById('editChartTitleGroup');
    refs.editChartPersonGroup = document.getElementById('editChartPersonGroup');
    refs.editChartPersonInput = document.getElementById('editChartPersonInput');
    refs.editChartPersonDropdown = document.getElementById('editChartPersonDropdown');
    refs.editChartPersonChips = document.getElementById('editChartPersonChips');
    refs.editChartPersonWrap = document.getElementById('editChartPersonWrap');
    refs.editCrmContactSection = document.getElementById('editCrmContactSection');
    refs.editKicker = refs.editDialog?.querySelector('.clients-dialog-kicker');
    refs.editTitleEl = document.getElementById('editClientTitle');
    refs.editSubtitle = refs.editDialog?.querySelector('.clients-dialog-copy');
    // New chart modal
    refs.newItemBtn = document.getElementById('newItemBtn');
    refs.newItemBtnLabel = document.getElementById('newItemBtnLabel');
    refs.emptyStateNewBtn = document.getElementById('emptyStateNewBtn');
    refs.emptyStateNewBtnLabel = document.getElementById('emptyStateNewBtnLabel');
    refs.newChartBackdrop = document.getElementById('newChartBackdrop');
    refs.newChartDialog = document.getElementById('newChartDialog');
    refs.newChartForm = document.getElementById('newChartForm');
    refs.newChartClose = document.getElementById('newChartClose');
    refs.newChartCancel = document.getElementById('newChartCancel');
    refs.newChartSubmit = document.getElementById('newChartSubmit');
    refs.newChartError = document.getElementById('newChartError');
    refs.newChartTitle = document.getElementById('newChartTitle');
    refs.newChartDay = document.getElementById('newChartDay');
    refs.newChartMonth = document.getElementById('newChartMonth');
    refs.newChartYear = document.getElementById('newChartYear');
    refs.newChartHour = document.getElementById('newChartHour');
    refs.newChartMinute = document.getElementById('newChartMinute');
    refs.newChartPlace = document.getElementById('newChartPlace');
    refs.newChartPlaceSuggestions = document.getElementById('newChartPlaceSuggestions');
    refs.newChartTimezone = document.getElementById('newChartTimezone');
}

function bindEvents() {
    refs.searchInput.addEventListener('input', (event) => {
        state.searchTerm = event.target.value.trim().toLowerCase();
        scheduleRenderUsers({ debounce: 140 });
    });

    refs.libraryTabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            setLibraryView(tab.dataset.libraryView);
        });
    });

    refs.newItemBtn?.addEventListener('click', () => handleNewItemClick());
    refs.emptyStateNewBtn?.addEventListener('click', () => handleNewItemClick());

    refs.newChartClose?.addEventListener('click', closeNewChartDialog);
    refs.newChartCancel?.addEventListener('click', closeNewChartDialog);
    refs.newChartBackdrop?.addEventListener('click', closeNewChartDialog);
    refs.newChartForm?.addEventListener('submit', (e) => { e.preventDefault(); submitNewChart(); });

    document.addEventListener('click', (event) => {
        const newChartLink = event.target.closest('a[data-plan-new-chart-link="true"]');
        if (!newChartLink || !isSavedChartLimitReached()) return;
        event.preventDefault();
        openPlanUpgrade('limit');
    });

    refs.tagFilterSelect?.addEventListener('change', (event) => {
        state.activeTag = normalizeTag(event.target.value);
        scheduleRenderUsers();
    });

    refs.sortSelect.addEventListener('change', (event) => {
        state.sortBy = event.target.value;
        scheduleRenderUsers();
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
                toggleBtn.closest('tr[data-user-id]')?.classList.add('dropdown-open');
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
            if (action === 'filter-tag') {
                event.stopPropagation();
                applyTagFilter(actionBtn.dataset.tag || '');
                return;
            }
            if (action === 'filter-profile') {
                event.stopPropagation();
                applyProfileFilter(actionBtn.dataset.profileId || '');
                return;
            }
            if (!userId) return;
            event.stopPropagation();
            if (action === 'delete') { await handleDelete(userId, actionBtn); return; }
            closeAllDropdowns();
            if (action === 'rename') { await handleRenameChart(userId); return; }
            if (action === 'edit') {
                if (state.libraryView === 'charts') {
                    await openEditChartDialog(userId);
                } else {
                    await openEditClientDialog(userId);
                }
                return;
            }
            if (action === 'open-chart') { await openChart(userId); return; }
            if (action === 'open-forecast') { await openForecastForUser(userId); return; }
            if (action === 'log-session') {
                if (!planCan('consultations')) {
                    openPlanUpgrade('consultations');
                    return;
                }
                openLogSessionDialog(userId);
                return;
            }
            if (action === 'start-call') {
                if (!planCan('calls')) {
                    openPlanUpgrade('calls');
                    return;
                }
                await startCallSession(userId);
                return;
            }
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
            if (state.libraryView === 'charts') {
                await openForecastForUser(row.dataset.userId);
                return;
            }
            if (state.libraryView === 'people') {
                if (row.dataset.primaryChartId) {
                    openProfile(row.dataset.primaryChartId);
                } else {
                    showToast(t('page.clients.people.noPrimaryChart'), 'warning');
                }
                return;
            }
            await toggleDetailPanel(row.dataset.userId);
        }
    });

    document.addEventListener('click', closeAllDropdowns);

    document.addEventListener('frontend:locale-changed', () => {
        if (refs.loading && !refs.loading.classList.contains('hidden') && !state.users.length) {
            refs.loading.textContent = t('common.loading');
        }
        renderProfileSummary();
        renderTagFilterOptions();
        syncLibraryChrome();
        resetClientListMetaCache();
        scheduleRenderUsers();
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
    applyPlanUi();

    if (window.AstroAPI?.getAccountPreferences) {
        try {
            window.accountPreferencesCache = await window.AstroAPI.getAccountPreferences();
            window.AstroPreferences?.setAccountVisualPreferences?.(window.accountPreferencesCache?.visual || {});
        } catch (error) {
            console.warn('Clients account preferences fallback to defaults:', error);
        }
    }

    renderProfileSummary();
    applyHeroPlacement();

    await loadClients();
    scheduleSecondaryPanels();
}

function scheduleSecondaryPanels() {
    scheduleAfterPaint(() => {
        if (planCan('consultations')) {
            initMiniCal();
        }
        if (planCan('meeting_stats')) {
            loadAlerts();
        }
    });
}

function applyPlanUi() {
    document.querySelectorAll('a[href="/calendar"], #miniCal').forEach((el) => {
        el.classList.toggle('hidden', !planCan('consultations'));
    });
    refs.alertsPanel?.classList.toggle('hidden', !planCan('meeting_stats'));
    refs.tagFilterSelect?.closest('.toolbar-field')?.classList.toggle('hidden', !planCan('clients'));
    refs.searchInput?.closest('.toolbar-field')?.classList.toggle('toolbar-field-search--wide', !planCan('clients'));

    const limitReached = isSavedChartLimitReached();
    document.querySelectorAll('a[href="/new"], a[href="/index.html"]').forEach((link) => {
        if (!link.dataset.planOriginalHref) {
            link.dataset.planOriginalHref = link.getAttribute('href') || '/new';
        }
        link.dataset.planNewChartLink = 'true';
        link.setAttribute('href', limitReached ? '#' : link.dataset.planOriginalHref);
        link.classList.toggle('is-disabled', limitReached);
        link.setAttribute('aria-disabled', limitReached ? 'true' : 'false');
    });
}

function renderProfileSummary() {
    if (!refs.welcome) return;
    const email = currentAstrologer?.email || t('common.notAvailable');
    refs.welcome.textContent = t('page.clients.profile.signedInAs', { email });
    if (refs.planStatus) {
        refs.planStatus.textContent = getPlanStatusLabel();
    }
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
        const [chartsResponse, personsResponse] = await Promise.all([
            apiFetch(`${API_BASE}/charts`, { method: 'GET' }),
            apiFetch(`${API_BASE}/persons`, { method: 'GET' }),
        ]);
        if (chartsResponse.status === 401 || personsResponse.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        // Legacy users remain a fallback while Persons rolls out.
        if (personsResponse.ok) {
            const persons = await personsResponse.json();
            state.people = Array.isArray(persons) ? persons : [];
        } else {
            const usersResponse = await apiFetch(`${API_BASE}/users`, { method: 'GET' });
            if (usersResponse.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            if (!usersResponse.ok) throw new Error(t('page.clients.errors.fetchList'));
            const users = await usersResponse.json();
            state.people = Array.isArray(users) ? users : [];
            console.warn('Persons API unavailable, falling back to legacy users view');
        }

        if (chartsResponse.ok) {
            const charts = await chartsResponse.json();
            state.charts = Array.isArray(charts) ? charts : [];
        } else {
            state.charts = [];
            console.warn('Charts API unavailable, falling back to people-only view');
        }

        state.people = enrichPeopleFromCharts(state.people, state.charts);
        rebuildClientListIndexes();
        state.users = getActiveLibraryItems();
        renderTagFilterOptions();
        syncLibraryChrome();

        refs.loading.classList.add('hidden');

        if (state.users.length === 0) {
            updateCounters();
            refs.emptyState.classList.remove('hidden');
            refs.resultsMeta.textContent = '';
            return;
        }

        renderUsers();
        loadTagPoolAfterFirstRender();
    } catch (error) {
        refs.loading.textContent = t('page.clients.errors.loadingWithMessage', { message: error.message });
        console.error(error);
    }
}

function loadTagPoolAfterFirstRender() {
    scheduleAfterPaint(async () => {
        const tagsResponse = await apiFetch(`${API_BASE}/charts/tags`, { method: 'GET' }).catch(() => null);
        const pool = tagsResponse?.ok ? await tagsResponse.json().catch(() => []) : [];
        state.apiTagPool = Array.isArray(pool) ? pool : [];
        renderTagFilterOptions();
    });
}

function setLibraryView(view) {
    if (!['charts', 'people'].includes(view) || state.libraryView === view) return;
    state.libraryView = view;
    state.users = getActiveLibraryItems();
    state.filteredUsers = [];
    state.activeTag = '';
    state.activeProfileId = '';
    state.expandedUserId = null;
    closeAllDropdowns();
    syncLibraryChrome();
    renderTagFilterOptions();
    resetClientListMetaCache();
    renderUsers();
}

function getActiveLibraryItems() {
    return state.libraryView === 'people' ? state.people : state.charts;
}

function rebuildClientListIndexes() {
    state.personTagIndex = buildPersonTagIndex();
    resetClientListMetaCache();
}

function enrichPeopleFromCharts(people = [], charts = []) {
    if (!Array.isArray(people) || !Array.isArray(charts) || charts.length === 0) return people;
    return people.map((person) => {
        const chart = findPrimaryChartForPerson(person, charts);
        if (!chart) return person;
        return {
            ...person,
            primary_chart_id: person.primary_chart_id || chart.chart_id || chart.user_id || null,
            birth_date: person.birth_date || chart.birth_date || chart.date || null,
            birth_place: person.birth_place || chart.birth_place || chart.location_name || null,
            chart_count: Math.max(Number(person.chart_count || 0), countChartsForPerson(person, charts)),
        };
    });
}

function findPrimaryChartForPerson(person, charts = []) {
    const primaryId = String(person?.primary_chart_id || '');
    if (primaryId) {
        const byPrimaryId = charts.find((chart) => String(chart.chart_id || chart.user_id || '') === primaryId);
        if (byPrimaryId) return byPrimaryId;
    }

    const personId = String(person?.person_id || '');
    if (personId) {
        const linked = charts
            .filter((chart) => String(chart.person_id || '') === personId)
            .sort(comparePrimaryChartCandidates);
        if (linked.length) return linked[0];
    }

    const personName = normalizePersonLookupName(person);
    if (!personName) return null;
    const matched = charts
        .filter((chart) => normalizeChartLookupName(chart) === personName)
        .sort(comparePrimaryChartCandidates);
    return matched[0] || null;
}

function countChartsForPerson(person, charts = []) {
    const personId = String(person?.person_id || '');
    const personName = normalizePersonLookupName(person);
    return charts.filter((chart) => {
        if (personId && String(chart.person_id || '') === personId) return true;
        return personName && normalizeChartLookupName(chart) === personName;
    }).length;
}

function comparePrimaryChartCandidates(a, b) {
    const aBirth = (a.chart_kind || 'birth') === 'birth' ? 0 : 1;
    const bBirth = (b.chart_kind || 'birth') === 'birth' ? 0 : 1;
    if (aBirth !== bBirth) return aBirth - bBirth;
    return String(a.created_at || '').localeCompare(String(b.created_at || ''));
}

function normalizePersonLookupName(person) {
    return normalizeLooseText(
        person?.display_name
        || [person?.first_name, person?.last_name].filter(Boolean).join(' '),
    );
}

function normalizeChartLookupName(chart) {
    return normalizeLooseText(
        chart?.display_title
        || chart?.title
        || [chart?.first_name, chart?.last_name].filter(Boolean).join(' '),
    );
}

function normalizeLooseText(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function syncLibraryChrome() {
    refs.libraryTabs.forEach((tab) => {
        const active = tab.dataset.libraryView === state.libraryView;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    const headings = state.libraryView === 'charts'
        ? {
            name: 'page.clients.table.chartName',
            date: 'page.clients.table.chartDate',
            place: 'page.clients.table.chartPlace',
            tags: 'page.clients.table.tags',
            meta: 'page.clients.table.profiles',
        }
        : {
            name: 'page.clients.table.name',
            date: 'page.clients.table.birthDate',
            place: 'page.clients.table.place',
            tags: '',
            meta: 'page.clients.table.created',
        };
    setTranslatedHeading(refs.tableHeadName, headings.name);
    setTranslatedHeading(refs.tableHeadDate, headings.date);
    setTranslatedHeading(refs.tableHeadPlace, headings.place);
    refs.tableHeadTags?.classList.toggle('hidden', state.libraryView !== 'charts');
    setTranslatedHeading(refs.tableHeadTags, headings.tags);
    setTranslatedHeading(refs.tableHeadMeta, headings.meta);

    const isChartsView = state.libraryView === 'charts';
    const newBtnKey = isChartsView ? 'page.clients.newChart.btnLabel' : 'page.clients.newCard';
    const emptyBtnKey = isChartsView ? 'page.clients.newChart.btnLabel' : 'page.clients.createFirstCard';
    if (refs.newItemBtnLabel) {
        refs.newItemBtnLabel.dataset.i18n = newBtnKey;
        refs.newItemBtnLabel.textContent = t(newBtnKey);
    }
    if (refs.emptyStateNewBtnLabel) {
        refs.emptyStateNewBtnLabel.dataset.i18n = emptyBtnKey;
        refs.emptyStateNewBtnLabel.textContent = t(emptyBtnKey);
    }
}

function setTranslatedHeading(element, key) {
    if (!element) return;
    element.dataset.i18n = key;
    element.textContent = t(key);
}

function renderUsers() {
    const filtered = filterUsers(state.users, state.searchTerm, state.activeTag, state.activeProfileId);
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

function renderTagFilterOptions() {
    if (!refs.tagFilterSelect) return;

    const currentValue = state.activeTag;
    const tags = getAvailableTags(state.users);
    const hasCurrent = currentValue && tags.some((tag) => normalizeTag(tag) === currentValue);
    if (currentValue && !hasCurrent) {
        state.activeTag = '';
    }

    refs.tagFilterSelect.innerHTML = '';
    refs.tagFilterSelect.appendChild(new Option(t('page.clients.tagFilter.all'), ''));

    for (const tag of tags) {
        const option = new Option(tag, normalizeTag(tag));
        refs.tagFilterSelect.appendChild(option);
    }

    refs.tagFilterSelect.value = state.activeTag;
    refs.tagFilterSelect.disabled = tags.length === 0;
}

function closeAllDropdowns() {
    document.querySelectorAll('.actions-dropdown.open').forEach((d) => d.classList.remove('open'));
    document.querySelectorAll('.clients-table tbody tr.dropdown-open').forEach((row) => row.classList.remove('dropdown-open'));
    document.querySelectorAll('.btn-actions.open, .btn-actions[aria-expanded="true"]').forEach((button) => {
        button.classList.remove('open');
        button.setAttribute('aria-expanded', 'false');
    });
}

function buildUserRow(user) {
    const tr = document.createElement('tr');

    const isChartsView = state.libraryView === 'charts';
    const userId = String(isChartsView ? (user.chart_id || user.user_id || '') : (user.person_id || user.user_id || ''));
    const primaryChartId = String(user.primary_chart_id || user.user_id || '');
    const forecastTargetId = isChartsView ? userId : primaryChartId;
    const name = isChartsView
        ? (user.display_title || user.title || [user.first_name, user.last_name].filter(Boolean).join(' ') || t('common.notAvailable'))
        : (user.display_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || t('common.notAvailable'));
    const birthDateRaw = user.birth_date || user.date;
    const chartTime = isChartsView ? formatTime(user.time) : '';
    const birthDate = birthDateRaw ? formatDate(birthDateRaw) : t('common.notAvailable');
    const dateValue = isChartsView && chartTime ? `${birthDate} · ${chartTime}` : birthDate;
    const place = user.birth_place || user.location_name || t('common.notAvailable');
    const created = user.created_at ? formatDateTime(user.created_at) : t('common.notAvailable');
    const labelName = escapeHtml(t(isChartsView ? 'page.clients.table.chartName' : 'page.clients.table.name'));
    const labelBirthDate = escapeHtml(t(isChartsView ? 'page.clients.table.chartDate' : 'page.clients.table.birthDate'));
    const labelPlace = escapeHtml(t(isChartsView ? 'page.clients.table.chartPlace' : 'page.clients.table.place'));
    const labelTags = escapeHtml(t('page.clients.table.tags'));
    const labelCreated = escapeHtml(t(isChartsView ? 'page.clients.table.profiles' : 'page.clients.table.created'));
    const labelActions = escapeHtml(t('page.clients.table.actions'));
    const editLabel = escapeHtml(t('page.clients.actions.edit'));
    const renameLabel = escapeHtml(t('page.clients.actions.rename'));
    const deleteLabel = escapeHtml(t('page.clients.actions.delete'));
    const openChartLabel = escapeHtml(t('page.clients.detail.openChart'));
    const forecastLabel = escapeHtml(isChartsView ? t('page.clients.charts.openWorkspace') : t('page.chart.nav.forecast'));
    const upcomingCount = Number(user.upcoming_count || 0);
    const unpaidCount = Number(user.unpaid_count || 0);
    const summaryChips = [];

    if (planCan('meeting_stats') && upcomingCount > 0) {
        summaryChips.push(`
            <span class="client-summary-chip client-summary-chip-upcoming">
                ${escapeHtml(t('page.clients.statsUpcoming'))}: ${escapeHtml(String(upcomingCount))}
            </span>
        `);
    }

    if (planCan('meeting_stats') && unpaidCount > 0) {
        summaryChips.push(`
            <span class="client-summary-chip client-summary-chip-unpaid">
                ${escapeHtml(t('page.clients.statsUnpaid'))}: ${escapeHtml(String(unpaidCount))}
            </span>
        `);
    }

    tr.dataset.userId = userId;
    if (!isChartsView && primaryChartId) {
        tr.dataset.primaryChartId = primaryChartId;
    }
    tr.innerHTML = `
        <td class="client-cell client-cell-name" data-label="${labelName}">
            <div class="client-name-cell">
                <div class="client-name-stack">
                    <strong class="client-name-text">${escapeHtml(name)}</strong>
                    ${isChartsView ? '' : renderPersonChips(user)}
                    ${summaryChips.length > 0 ? `<div class="client-summary-chips">${summaryChips.join('')}</div>` : ''}
                    <div class="client-card-quick-actions">
                        ${isChartsView ? '' : `<button class="client-quick-btn client-quick-btn-primary" type="button" data-action="open-chart" data-user-id="${escapeHtml(primaryChartId)}" ${primaryChartId ? '' : 'disabled'}>${openChartLabel}</button>`}
                        <button class="client-quick-btn ${isChartsView ? 'client-quick-btn-workspace' : ''}" type="button" data-action="open-forecast" data-user-id="${escapeHtml(forecastTargetId)}" ${forecastTargetId ? '' : 'disabled'}>
                            ${forecastLabel}
                        </button>
                    </div>
                </div>
            </div>
        </td>
        <td class="client-cell client-cell-birth" data-label="${labelBirthDate}">
            <div class="client-fact">
                <span class="client-fact-label">${labelBirthDate}</span>
                <span class="client-fact-value">${escapeHtml(dateValue)}</span>
            </div>
        </td>
        <td class="client-cell client-cell-place" data-label="${labelPlace}">
            <div class="client-fact">
                <span class="client-fact-label">${labelPlace}</span>
                <span class="client-fact-value">${escapeHtml(place)}</span>
            </div>
        </td>
        ${isChartsView ? `
            <td class="client-cell client-cell-tags" data-label="${labelTags}">
                <div class="client-fact">
                    <span class="client-fact-label">${labelTags}</span>
                    <span class="client-fact-value">${renderChartTagFilters(user)}</span>
                </div>
            </td>
        ` : ''}
        <td class="client-cell client-cell-created" data-label="${labelCreated}">
            <div class="client-fact">
                <span class="client-fact-label">${labelCreated}</span>
                <span class="client-fact-value">${isChartsView ? renderChartProfileFilters(user) : escapeHtml(created)}</span>
            </div>
        </td>
        <td class="client-cell client-cell-actions" data-label="${labelActions}">
            <div class="row-actions">
                <button class="btn-actions" type="button" data-action="toggle-menu" data-user-id="${escapeHtml(userId)}" aria-label="${escapeHtml(t('page.clients.table.actions'))}" aria-haspopup="menu" aria-expanded="false">
                    <svg width="14" height="4" viewBox="0 0 14 4" fill="none"><circle cx="2" cy="2" r="1.4" fill="currentColor"/><circle cx="7" cy="2" r="1.4" fill="currentColor"/><circle cx="12" cy="2" r="1.4" fill="currentColor"/></svg>
                </button>
                <div class="actions-dropdown">
                    ${isChartsView
                        ? `<button class="action-item" type="button" data-action="rename" data-user-id="${escapeHtml(userId)}">${renameLabel}</button>
                           <button class="action-item" type="button" data-action="edit" data-user-id="${escapeHtml(userId)}">${editLabel}</button>`
                        : primaryChartId
                            ? `<a class="action-item" href="/client/${escapeHtml(primaryChartId)}">${escapeHtml(t('page.clientProfile.viewProfile'))}</a>`
                            : `<button class="action-item" type="button" data-action="open-profile-no-chart" disabled>${escapeHtml(t('page.clientProfile.viewProfile'))}</button>`
                    }
                    <button class="action-item danger" type="button" data-action="delete" data-user-id="${escapeHtml(userId)}">${deleteLabel}</button>
                </div>
            </div>
        </td>
    `;

    return tr;
}

function renderChartTagFilters(chart) {
    const tags = getUserTags(chart);
    if (!tags.length) {
        return escapeHtml(t('page.clients.table.noTags'));
    }
    return `<span class="client-inline-chips">${tags.map((tag) => {
        const normalized = normalizeTag(tag);
        const active = normalized && normalized === state.activeTag;
        return `
            <button class="client-inline-chip${active ? ' is-active' : ''}" type="button" data-action="filter-tag" data-tag="${escapeHtml(tag)}">
                ${escapeHtml(tag)}
            </button>
        `;
    }).join('')}</span>`;
}

function renderChartProfileFilters(chart) {
    const related = getClientListItemMeta(chart).relatedProfiles;
    if (!related.length) {
        return escapeHtml(t('page.clients.table.noProfiles'));
    }
    return `<span class="client-inline-chips">${related.map((profile) => {
        const id = String(profile.id || '');
        const label = resolveProfileLabel(profile) || t('common.notAvailable');
        const active = id && id === state.activeProfileId;
        return id
            ? `<button class="client-inline-chip${active ? ' is-active' : ''}" type="button" data-action="filter-profile" data-profile-id="${escapeHtml(id)}">${escapeHtml(label)}</button>`
            : `<span class="client-inline-chip">${escapeHtml(label)}</span>`;
    }).join('')}</span>`;
}

function getChartRelatedProfiles(chart) {
    const related = [];
    const seen = new Set();
    const add = (id, name) => {
        const normalizedId = id ? String(id) : '';
        const normalizedName = String(name || '').trim();
        const key = normalizedId || normalizedName.toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        related.push({ id: normalizedId, name: normalizedName });
    };

    add(chart.person_id, chart.person_display_name || chart.person_name || chart.display_name);
    if (Array.isArray(chart.related_persons)) {
        chart.related_persons.forEach((person) => {
            add(
                person.person_id || person.user_id || person.id,
                person.display_name || person.name || [person.first_name, person.last_name].filter(Boolean).join(' '),
            );
        });
    }
    return related;
}

function getClientListItemMeta(item) {
    if (!item || typeof item !== 'object') {
        return {
            tags: [],
            normalizedEffectiveTags: [],
            relatedProfiles: [],
            relatedProfileIds: new Set(),
            searchBlob: '',
        };
    }
    const cached = clientListMetaCache.get(item);
    if (cached) return cached;

    const tags = getUserTags(item);
    const relatedProfiles = getChartRelatedProfiles(item);
    const rawDate = item.birth_date || item.date;
    const birthDate = rawDate ? formatDate(rawDate).toLowerCase() : '';
    const effectiveTags = getEffectiveTags(item, state.personTagIndex);
    const relatedText = relatedProfiles.map((profile) => profile.name).join(' ').toLowerCase();
    const searchBlob = [
        item.display_title,
        item.display_name,
        item.title,
        item.first_name,
        item.last_name,
        item.email,
        item.phone,
        item.birth_place,
        item.location_name,
        birthDate,
        tags.join(' '),
        relatedText,
    ].filter(Boolean).join(' ').toLowerCase();

    const meta = {
        tags,
        normalizedEffectiveTags: effectiveTags.map(normalizeTag).filter(Boolean),
        relatedProfiles,
        relatedProfileIds: new Set(relatedProfiles.map((profile) => String(profile.id || '')).filter(Boolean)),
        searchBlob,
    };
    clientListMetaCache.set(item, meta);
    return meta;
}

function resolveProfileLabel(profile) {
    const explicitName = String(profile?.name || '').trim();
    if (explicitName) return explicitName;

    const id = String(profile?.id || '');
    if (!id) return '';

    const person = state.people.find((item) => String(item.person_id || item.user_id || '') === id);
    if (!person) return '';

    return (
        person.display_name
        || [person.first_name, person.last_name].filter(Boolean).join(' ')
        || person.email
        || ''
    ).trim();
}

function renderPersonChips(person) {
    const chips = [];
    const chartCount = Number(person.chart_count || 0);
    chips.push(`<span class="client-summary-chip">${escapeHtml(t('page.clients.people.chartCount', { count: chartCount }))}</span>`);
    if (!person.primary_chart_id) {
        chips.push(`<span class="client-summary-chip">${escapeHtml(t('page.clients.people.noPrimaryChart'))}</span>`);
    }
    return `<div class="client-summary-chips">${chips.join('')}</div>`;
}

function filterUsers(users, searchTerm, activeTag = '', activeProfileId = '') {
    const normalizedTag = normalizeTag(activeTag);
    const normalizedProfileId = String(activeProfileId || '');
    if (!searchTerm && !normalizedTag && !normalizedProfileId) return [...users];

    return users.filter((user) => {
        const meta = getClientListItemMeta(user);
        const matchesTag = !normalizedTag || meta.normalizedEffectiveTags.includes(normalizedTag);
        if (!matchesTag) return false;
        const matchesProfile = !normalizedProfileId || meta.relatedProfileIds.has(normalizedProfileId);
        if (!matchesProfile) return false;

        if (!searchTerm) return true;
        return meta.searchBlob.includes(searchTerm);
    });
}

function getUserTags(user) {
    if (!Array.isArray(user?.tags)) return [];
    return user.tags
        .map((tag) => String(tag || '').trim())
        .filter(Boolean);
}

function normalizeTag(tag) {
    return String(tag || '').trim().toLowerCase();
}

function getAvailableTags(users) {
    const tagsByKey = new Map();
    for (const user of users || []) {
        for (const tag of getUserTags(user)) {
            const key = normalizeTag(tag);
            if (key && !tagsByKey.has(key)) {
                tagsByKey.set(key, tag);
            }
        }
    }

    // Pool from API: distinct tags across all charts AND persons, so family tags
    // (which live on people) are offered even on the charts tab.
    for (const tag of (state.apiTagPool || [])) {
        const key = normalizeTag(tag);
        if (key && !tagsByKey.has(key)) {
            tagsByKey.set(key, tag);
        }
    }

    const collator = getNameCollator();
    return [...tagsByKey.values()].sort((a, b) => collator.compare(a, b));
}

// Map person_id -> normalized tag set, for transitive ("family") tag matching.
function buildPersonTagIndex() {
    const index = new Map();
    for (const person of (state.people || [])) {
        const id = String(person?.person_id || '');
        if (!id) continue;
        index.set(id, getUserTags(person).map(normalizeTag).filter(Boolean));
    }
    return index;
}

// Effective tags for a chart = its own tags PLUS the tags of every linked person
// (primary person_id + M2M linked_person_ids). For a person item, just its tags.
function getEffectiveTags(item, personTagIndex) {
    const own = getUserTags(item);
    const linkedIds = [
        item?.person_id,
        ...(Array.isArray(item?.linked_person_ids) ? item.linked_person_ids : []),
    ].map((id) => String(id || '')).filter(Boolean);
    if (!linkedIds.length || !personTagIndex) return own;
    const out = own.slice();
    for (const id of linkedIds) {
        for (const tag of (personTagIndex.get(id) || [])) out.push(tag);
    }
    return out;
}

function applyTagFilter(tag) {
    const normalized = normalizeTag(tag);
    state.activeTag = state.activeTag === normalized ? '' : normalized;
    if (refs.tagFilterSelect) {
        refs.tagFilterSelect.value = state.activeTag;
    }
    scheduleRenderUsers();
}

function applyProfileFilter(profileId) {
    const normalized = String(profileId || '');
    state.activeProfileId = state.activeProfileId === normalized ? '' : normalized;
    scheduleRenderUsers();
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
        return list.sort((a, b) => compareDate(normalizeDateSortItem(a), normalizeDateSortItem(b), 'birth_date', 1));
    }

    if (sortBy === 'birth_desc') {
        return list.sort((a, b) => compareDate(normalizeDateSortItem(a), normalizeDateSortItem(b), 'birth_date', -1));
    }

    if (sortBy === 'name_desc') {
        const collator = getNameCollator();
        return list.sort((a, b) => collator.compare(getName(b), getName(a)));
    }

    const collator = getNameCollator();
    return list.sort((a, b) => collator.compare(getName(a), getName(b)));
}

function getName(user) {
    return (user.display_title || user.display_name || user.title || [user.first_name, user.last_name].filter(Boolean).join(' ')).trim();
}

function normalizeDateSortItem(item) {
    return { ...item, birth_date: item.birth_date || item.date };
}

function getChartKindLabel(kind) {
    const key = `page.clients.chartKinds.${kind || 'birth'}`;
    const label = t(key);
    return label === key ? (kind || 'birth') : label;
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

    if (state.searchTerm || state.activeTag || state.activeProfileId) {
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
        AstroAPI.saveNavigationState?.({
            sourceView: 'clients',
            sourceUrl: '/',
            clientUserId: String(userId),
            partnerUserId: null,
        });

        window.showPageLoader?.();
        window.location.href = '/forecast-new.html';
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
        AstroAPI.saveNavigationState?.({
            sourceView: 'clients',
            sourceUrl: '/',
            clientUserId: String(userId),
            partnerUserId: null,
        });

        const params = new URLSearchParams();
        params.set('tab', tab);
        if (date) params.set('date', date);
        if (solarYear) params.set('solarYear', solarYear);

        window.showPageLoader?.();
        window.location.href = `/forecast-new.html?${params.toString()}`;
    } catch (error) {
        showToast(t('common.errorWithMessage', { message: error.message }), 'error');
    }
}

function openProfile(userId) {
    if (!userId) return;
    window.showPageLoader?.();
    window.location.href = `/client/${encodeURIComponent(String(userId))}`;
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
    refs.editTags?.addEventListener('input', renderEditTagSuggestions);
    refs.editTagSuggestions?.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-tag]');
        if (!button) return;
        addTagToEditInput(button.dataset.tag);
    });

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
        renderEditTagSuggestions();

        window.Timezones?.populate?.(refs.editTimezone);
        refs.editTimezone.value = formData.timezone || '';
        refs.editTimezoneHint.textContent = '';
        refs.editTimezoneHint.style.color = '';
        refs.editError.classList.add('hidden');
        refs.editError.textContent = '';

        setEditDialogMode(false);
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

function setEditDialogMode(isChartMode) {
    editClientState.isChartMode = isChartMode;
    refs.editChartTitleGroup?.classList.toggle('hidden', !isChartMode);
    refs.editChartPersonGroup?.classList.toggle('hidden', !isChartMode);
    refs.editCrmContactSection?.classList.toggle('hidden', isChartMode);

    // A chart carries its own title and an optional person link — the personal
    // full name belongs to the linked person, not the chart. Hide and un-require
    // those inputs in chart mode so an unlinked chart can be saved.
    refs.editFullNameGroup?.classList.toggle('hidden', isChartMode);
    if (refs.editFirstName) refs.editFirstName.required = !isChartMode;
    if (refs.editLastName) refs.editLastName.required = !isChartMode;

    const kickerKey = isChartMode ? 'page.clients.edit.chartMode.kicker' : 'page.clients.edit.kicker';
    const titleKey = isChartMode ? 'page.clients.edit.chartMode.title' : 'page.clients.edit.title';
    const subtitleKey = isChartMode ? 'page.clients.edit.chartMode.subtitle' : 'page.clients.edit.subtitle';
    if (refs.editKicker) { refs.editKicker.setAttribute('data-i18n', kickerKey); refs.editKicker.textContent = t(kickerKey); }
    if (refs.editTitleEl) { refs.editTitleEl.setAttribute('data-i18n', titleKey); refs.editTitleEl.textContent = t(titleKey); }
    if (refs.editSubtitle) { refs.editSubtitle.setAttribute('data-i18n', subtitleKey); refs.editSubtitle.textContent = t(subtitleKey); }

    // Reset submit label to the edit copy; create mode overrides it afterwards.
    const submitText = refs.editSubmit?.querySelector('.btn-text');
    if (submitText) { submitText.setAttribute('data-i18n', 'page.clients.edit.submit'); submitText.textContent = t('page.clients.edit.submit'); }
}

function personName(person) {
    return person.display_name
        || [person.first_name, person.last_name].filter(Boolean).join(' ')
        || String(person.person_id || '');
}

// Initialise the chip multi-select. primaryId becomes the first chip (FK),
// linkedIds are the additional people linked via the M2M endpoint.
function initEditPersons(primaryId, linkedIds) {
    editClientState.originalLinkedIds = (linkedIds || []).map((id) => String(id));
    const byId = new Map((state.people || []).map((p) => [String(p.person_id), p]));
    const chosen = [];
    const seen = new Set();
    const pushId = (id) => {
        const key = String(id || '');
        if (!key || seen.has(key)) return;
        const person = byId.get(key);
        if (!person) return;
        seen.add(key);
        chosen.push({ id: key, name: personName(person) });
    };
    pushId(primaryId);
    (linkedIds || []).forEach(pushId);
    editClientState.selectedPersons = chosen;
    renderEditPersonChips();
    bindEditPersonAutocomplete();
    if (refs.editChartPersonInput) refs.editChartPersonInput.value = '';
    refs.editChartPersonDropdown?.classList.remove('active');
}

function renderEditPersonChips() {
    if (!refs.editChartPersonChips) return;
    refs.editChartPersonChips.innerHTML = '';
    editClientState.selectedPersons.forEach((person, i) => {
        const chip = document.createElement('span');
        chip.className = 'scm-tag-chip scm-person-chip';
        const name = document.createElement('span');
        name.textContent = i === 0
            ? `${person.name} · ${t('page.chart.saveModal.personPrimary') || 'основной'}`
            : person.name;
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'scm-tag-chip-del';
        del.setAttribute('aria-label', `${t('common.delete')}: ${person.name}`);
        del.textContent = '×';
        del.addEventListener('click', () => {
            editClientState.selectedPersons.splice(i, 1);
            renderEditPersonChips();
        });
        chip.append(name, del);
        refs.editChartPersonChips.appendChild(chip);
    });
}

function showEditPersonDropdown(query) {
    const dropdown = refs.editChartPersonDropdown;
    if (!dropdown) return;
    const q = String(query || '').trim().toLowerCase();
    dropdown.innerHTML = '';
    if (!q) { dropdown.classList.remove('active'); return; }
    const selectedIds = new Set(editClientState.selectedPersons.map((p) => String(p.id)));
    const matches = (state.people || [])
        .filter((p) => p.person_id && !selectedIds.has(String(p.person_id)))
        .filter((p) => personName(p).toLowerCase().includes(q))
        .slice(0, 8);
    if (!matches.length) { dropdown.classList.remove('active'); return; }
    matches.forEach((person) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'place-suggestion';
        btn.textContent = personName(person);
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            editClientState.selectedPersons.push({ id: String(person.person_id), name: personName(person) });
            renderEditPersonChips();
            if (refs.editChartPersonInput) refs.editChartPersonInput.value = '';
            dropdown.classList.remove('active');
        });
        dropdown.appendChild(btn);
    });
    dropdown.classList.add('active');
}

function bindEditPersonAutocomplete() {
    if (editClientState.personAutocompleteBound) return;
    editClientState.personAutocompleteBound = true;
    refs.editChartPersonInput?.addEventListener('input', () => {
        showEditPersonDropdown(refs.editChartPersonInput.value);
    });
    document.addEventListener('click', (e) => {
        if (refs.editChartPersonWrap && !refs.editChartPersonWrap.contains(e.target)) {
            refs.editChartPersonDropdown?.classList.remove('active');
        }
    }, { capture: true });
}

async function handleRenameChart(userId) {
    const chart = state.charts.find((c) => String(c.chart_id || c.user_id) === String(userId));
    const currentTitle = chart?.title || chart?.display_title || '';
    const nextTitle = window.prompt(t('page.clients.edit.chartTitle'), currentTitle);
    if (nextTitle === null) return;

    try {
        const res = await apiFetch(`${API_BASE}/charts/${encodeURIComponent(userId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: nextTitle.trim() || null }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || t('page.clients.edit.errors.saveFailed'));
        const updated = await res.json();
        state.charts = state.charts.map((c) =>
            String(c.chart_id || c.user_id) === String(userId)
                ? { ...c, title: updated.title, display_title: updated.display_title }
                : c
        );
        rebuildClientListIndexes();
        state.users = getActiveLibraryItems();
        renderUsers();
        showToast(t('page.clients.messages.chartRenamed'), 'success');
    } catch (err) {
        showToast(t('common.errorWithMessage', { message: err.message }), 'error');
    }
}

// Open the profile dialog in "create" mode — a fresh person + birth chart.
// Reuses the edit dialog markup (name, birth data, place, timezone, contacts).
function openNewClientDialog() {
    if (!refs.editDialog) return;

    refs.editForm?.reset();

    editClientState.isCreateMode = true;
    editClientState.userId = null;
    editClientState.loadedChartData = null;
    editClientState.originalCoords = null;
    editClientState.selectedCoords = null;
    editClientState.originalPlace = '';
    editClientState.selectedPlaceLabel = '';

    window.Timezones?.populate?.(refs.editTimezone);
    refs.editTimezone.value = '';
    refs.editTimezoneHint.textContent = '';
    refs.editTimezoneHint.style.color = '';
    refs.editError.classList.add('hidden');
    refs.editError.textContent = '';
    renderEditTagSuggestions();

    setEditDialogMode(false);
    applyCreateModeCopy();
    renderEditPlaceHint('empty');
    setEditClientSubmitting(false);

    refs.editBackdrop.classList.remove('hidden');
    refs.editDialog.classList.remove('hidden');
    refs.editFirstName.focus();
    document.body.style.overflow = 'hidden';
}

function applyCreateModeCopy() {
    const apply = (el, key) => {
        if (!el) return;
        el.setAttribute('data-i18n', key);
        el.textContent = t(key);
    };
    apply(refs.editKicker, 'page.clients.newProfile.kicker');
    apply(refs.editTitleEl, 'page.clients.newProfile.title');
    apply(refs.editSubtitle, 'page.clients.newProfile.subtitle');
    apply(refs.editSubmit?.querySelector('.btn-text'), 'page.clients.newProfile.submit');
}

async function openEditChartDialog(userId) {
    if (!userId) return;
    try {
        const [natalRes, chartRes] = await Promise.all([
            apiFetch(`${API_BASE}/natal/${userId}`),
            apiFetch(`${API_BASE}/charts/${userId}`),
        ]);
        if (!natalRes.ok) throw new Error(t('page.clients.edit.errors.loadFailed'));

        const chartData = await natalRes.json();
        const chartMeta = chartRes.ok ? await chartRes.json() : null;
        const formData = AstroAPI.chartToFormData(chartData);
        const place = String(formData.place || '').trim();
        const latitude = formData.latitude == null ? Number.NaN : Number(formData.latitude);
        const longitude = formData.longitude == null ? Number.NaN : Number(formData.longitude);

        editClientState.userId = String(chartData.user_id || userId);
        editClientState.loadedChartData = chartData;
        editClientState.originalCoords = { lat: latitude, lon: longitude };
        editClientState.selectedCoords = { lat: latitude, lon: longitude };
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

        if (refs.editChartTitle) refs.editChartTitle.value = chartMeta?.title || '';
        if (refs.editTags) refs.editTags.value = Array.isArray(chartMeta?.tags) ? chartMeta.tags.join(', ') : '';
        if (refs.editNotes) refs.editNotes.value = chartMeta?.notes || '';
        renderEditTagSuggestions();

        initEditPersons(chartMeta?.person_id || null, chartMeta?.linked_person_ids || []);

        window.Timezones?.populate?.(refs.editTimezone);
        refs.editTimezone.value = formData.timezone || '';
        refs.editTimezoneHint.textContent = '';
        refs.editTimezoneHint.style.color = '';
        refs.editError.classList.add('hidden');
        refs.editError.textContent = '';

        setEditDialogMode(true);
        renderEditPlaceHint('current');
        setEditClientSubmitting(false);

        refs.editBackdrop.classList.remove('hidden');
        refs.editDialog.classList.remove('hidden');
        (refs.editChartTitle || refs.editFirstName)?.focus();
        document.body.style.overflow = 'hidden';
    } catch (err) {
        showToast(t('common.errorWithMessage', { message: err.message }), 'error');
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
    editClientState.isCreateMode = false;
    setEditDialogMode(false);
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

    // Guard against double submits (rapid double-click / Enter): a second
    // click can already be queued before the button's disabled flag applies.
    if (editClientState.submitting) return;

    if (!refs.editForm.reportValidity()) return;

    if (editClientState.isCreateMode) {
        await handleCreateClientSubmit();
        return;
    }

    if (!editClientState.userId) {
        refs.editError.textContent = t('page.clients.edit.errors.chartUnavailable');
        refs.editError.classList.remove('hidden');
        return;
    }

    const place = refs.editPlaceInput.value.trim();
    const tags = parseTagInput(refs.editTags?.value || '');
    const isChartMode = editClientState.isChartMode;
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
        ...(isChartMode ? {} : {
            email: refs.editEmail?.value?.trim() || '',
            phone: refs.editPhone?.value?.trim() || '',
            messenger: refs.editMessenger?.value?.trim() || '',
        }),
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
        const userId = editClientState.userId;
        const updatedChartData = await AstroAPI.updateClientChart(userId, requestData);

        let patchedMeta = null;
        if (isChartMode) {
            const chartTitle = refs.editChartTitle?.value?.trim() || null;
            const chosen = editClientState.selectedPersons || [];
            const primaryId = chosen[0]?.id || null;
            const patchRes = await apiFetch(`${API_BASE}/charts/${encodeURIComponent(userId)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: chartTitle || null, person_id: primaryId || null }),
            });
            if (patchRes.ok) patchedMeta = await patchRes.json();

            // Reconcile M2M links for the non-primary people.
            const desiredM2M = new Set(chosen.slice(1).map((p) => String(p.id)));
            const originalM2M = new Set(editClientState.originalLinkedIds || []);
            const toAdd = [...desiredM2M].filter((id) => !originalM2M.has(id));
            const toRemove = [...originalM2M].filter((id) => !desiredM2M.has(id));
            for (const pid of toAdd) {
                await apiFetch(`${API_BASE}/persons/${encodeURIComponent(pid)}/charts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chart_id: userId }),
                }).catch((err) => console.warn('link person failed', pid, err));
            }
            for (const pid of toRemove) {
                await apiFetch(`${API_BASE}/persons/${encodeURIComponent(pid)}/charts/${encodeURIComponent(userId)}`, {
                    method: 'DELETE',
                }).catch((err) => console.warn('unlink person failed', pid, err));
            }
        }

        state.charts = state.charts.map((c) => {
            if (String(c.chart_id || c.user_id) !== String(updatedChartData.user_id)) return c;
            const base = buildUpdatedChartRecord(c, updatedChartData, requestData);
            if (patchedMeta) {
                base.title = patchedMeta.title;
                base.display_title = patchedMeta.display_title;
                base.person_id = patchedMeta.person_id;
                base.person_display_name = patchedMeta.person_display_name;
            }
            return base;
        });
        state.users = state.users.map((user) => (
            String(user.user_id) === String(updatedChartData.user_id)
                ? buildUpdatedUserRecord(user, updatedChartData, requestData)
                : user
        ));
        rebuildClientListIndexes();
        state.users = getActiveLibraryItems();
        renderUsers();
        closeEditClientDialog();
        showToast(t(isChartMode ? 'page.clients.messages.chartUpdated' : 'page.clients.messages.updated'), 'success');
    } catch (error) {
        refs.editError.textContent = error.message || t('page.clients.edit.errors.saveFailed');
        refs.editError.classList.remove('hidden');
    } finally {
        setEditClientSubmitting(false);
    }
}

// Create a new profile: a Person row (name + contacts) plus a linked birth
// chart carrying the birth data. Both are needed so the profile shows up in
// the people view (Person) and the chart library (User), correctly linked.
async function handleCreateClientSubmit() {
    const firstName = refs.editFirstName.value.trim();
    const lastName = refs.editLastName.value.trim();
    const place = refs.editPlaceInput.value.trim();
    const date = AstroAPI.formatDate(refs.editDay.value, refs.editMonth.value, refs.editYear.value);
    const time = AstroAPI.formatTime(refs.editHour.value, refs.editMinute.value);
    const timezone = refs.editTimezone.value;
    const tags = parseTagInput(refs.editTags?.value || '');
    const notes = refs.editNotes?.value?.trim() || '';
    const email = refs.editEmail?.value?.trim() || '';
    const phone = refs.editPhone?.value?.trim() || '';
    const messenger = refs.editMessenger?.value?.trim() || '';

    const showError = (message) => {
        refs.editError.textContent = message;
        refs.editError.classList.remove('hidden');
    };

    if (!date) { showError(t('page.clients.newChart.errors.dateRequired')); return; }
    if (!time) { showError(t('page.clients.newChart.errors.timeRequired')); return; }
    if (!place) { showError(t('page.clients.newChart.errors.placeRequired')); return; }
    if (!timezone) { showError(t('page.clients.newChart.errors.timezoneRequired')); return; }

    const coords = resolveEditCoords(place);

    refs.editError.classList.add('hidden');
    refs.editError.textContent = '';
    setEditClientSubmitting(true);

    try {
        const personResponse = await apiFetch(`${API_BASE}/persons`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                first_name: firstName,
                last_name: lastName,
                email,
                phone,
                messenger,
                tags,
                notes,
            }),
        });
        if (!personResponse.ok) {
            const detail = (await personResponse.json().catch(() => ({}))).detail;
            throw new Error(detail || t('page.clients.newProfile.errors.createFailed'));
        }
        const person = await personResponse.json();

        const chartResponse = await apiFetch(`${API_BASE}/charts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date,
                time,
                timezone,
                location_name: place,
                latitude: coords?.lat ?? null,
                longitude: coords?.lon ?? null,
                first_name: firstName,
                last_name: lastName,
                tags,
                notes,
                person_id: person.person_id,
                chart_kind: 'birth',
            }),
        });
        if (!chartResponse.ok) {
            // The person exists but its birth chart failed — surface it so the
            // astrologer can retry the birth details via edit.
            const detail = (await chartResponse.json().catch(() => ({}))).detail;
            throw new Error(detail || t('page.clients.newProfile.errors.createFailed'));
        }

        closeEditClientDialog();
        showToast(t('page.clients.newProfile.successToast'), 'success');
        await loadClients();
    } catch (error) {
        showError(error.message || t('page.clients.newProfile.errors.createFailed'));
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

function buildUpdatedChartRecord(chart, natalData, requestData) {
    const birthData = natalData?.birth_data || {};
    return {
        ...chart,
        chart_id: natalData?.user_id || chart.chart_id,
        user_id: natalData?.user_id || chart.user_id,
        first_name: birthData.first_name || '',
        last_name: birthData.last_name || '',
        date: birthData.date || chart.date,
        birth_date: birthData.date || chart.birth_date,
        location_name: birthData.place || chart.location_name,
        birth_place: birthData.place || chart.birth_place,
        tags: requestData?.tags ?? chart.tags,
        notes: requestData?.notes ?? chart.notes,
    };
}

function parseTagInput(value) {
    const tagsByKey = new Map();
    String(value || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .forEach((tag) => {
            const key = normalizeTag(tag);
            if (key && !tagsByKey.has(key)) {
                tagsByKey.set(key, tag);
            }
        });
    return [...tagsByKey.values()];
}

function setEditTags(tags) {
    if (!refs.editTags) return;
    refs.editTags.value = parseTagInput((tags || []).join(', ')).join(', ');
    renderEditTagSuggestions();
}

function addTagToEditInput(tag) {
    const nextTags = parseTagInput(refs.editTags?.value || '');
    const key = normalizeTag(tag);
    if (!key || nextTags.some((item) => normalizeTag(item) === key)) {
        renderEditTagSuggestions();
        return;
    }
    nextTags.push(String(tag).trim());
    setEditTags(nextTags);
    refs.editTags?.focus();
}

function renderEditTagSuggestions() {
    if (!refs.editTagSuggestions || !refs.editTagSuggestionsWrap) return;

    const tags = getAvailableTags(state.users);
    refs.editTagSuggestions.innerHTML = '';
    refs.editTagSuggestionsWrap.classList.toggle('hidden', tags.length === 0);
    if (tags.length === 0) return;

    const selectedKeys = new Set(parseTagInput(refs.editTags?.value || '').map(normalizeTag));
    for (const tag of tags) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `tag-suggestion${selectedKeys.has(normalizeTag(tag)) ? ' is-selected' : ''}`;
        button.dataset.tag = tag;
        button.textContent = tag;
        refs.editTagSuggestions.appendChild(button);
    }
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
    editClientState.submitting = isSubmitting;

    // Mute the whole dialog and float a blocking loader on top while the
    // request is in flight, so nothing else in the form can be touched.
    refs.editDialog?.classList.toggle('is-submitting', isSubmitting);

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
        const endpoint = state.libraryView === 'charts' ? `${API_BASE}/charts/${userId}` : `${API_BASE}/persons/${userId}`;
        const response = await apiFetch(endpoint, {
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

        state.people = state.people.filter((user) => String(user.person_id || user.user_id) !== String(userId));
        state.charts = state.charts.filter((chart) => String(chart.chart_id || chart.user_id) !== String(userId));
        rebuildClientListIndexes();
        state.users = getActiveLibraryItems();

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
        closeAllDropdowns();
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
    if (window.LocaleFormatters?.formatDate) {
        return window.LocaleFormatters.formatDate(isoDate);
    }
    const parts = String(isoDate || '').split('-');
    if (parts.length !== 3) return String(isoDate || '');
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function formatTime(value) {
    const parts = String(value || '').split(':');
    if (parts.length < 2) return '';
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
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
    if (planCan('consultations') && !consultations) fetches.push(
        apiFetch(`${API_BASE}/consultations?user_id=${userId}`)
            .then(r => r.ok ? r.json() : []).catch(() => [])
            .then(d => { consultations = d; state.consultationsCache[userId] = d; })
    );
    if (planCan('calls') && !callSessions) fetches.push(
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

async function refreshClientDetailPanel(userId) {
    if (!userId) return;
    delete state.consultationsCache[userId];

    const existing = refs.tbody.querySelector(`.client-detail-row[data-user-id="${userId}"]`);
    if (!existing && state.expandedUserId !== userId) return;

    existing?.remove();
    state.expandedUserId = null;
    await toggleDetailPanel(userId);
}

function buildDetailPanelHTML(user, consultations, callSessions = []) {
    const userId = escapeHtml(String(user.user_id));
    const consultationsEnabled = planCan('consultations');
    const callsEnabled = planCan('calls');
    const clientsEnabled = planCan('clients');
    const callSessionsHTML = callsEnabled ? buildCallSessionsHTML(callSessions) : '';

    // Contact summary — email only in quick view
    const contactHTML = clientsEnabled && user.email
        ? `<span class="detail-contact-item">${escapeHtml(user.email)}</span>`
        : `<span class="detail-contacts-empty">${escapeHtml(t('page.clients.crm.noContact'))}</span>`;

    // Tags
    const tagsHTML = clientsEnabled && Array.isArray(user.tags) && user.tags.length > 0
        ? `<div class="detail-tags">${user.tags.map((tag) => `<span class="detail-tag">${escapeHtml(tag)}</span>`).join('')}</div>`
        : '';

    // Last consultation summary (one line)
    let lastSessionHTML = '';
    if (consultationsEnabled && consultations.length > 0) {
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
    const nextPlanned = consultationsEnabled ? consultations.find((c) => c.status === 'planned') : null;
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
                ${consultationsEnabled ? `<button class="btn-new btn-sm btn-secondary" type="button" data-action="log-session" data-user-id="${userId}">${escapeHtml(t('page.clients.detail.logSession'))}</button>` : ''}
                <button class="btn-new btn-sm btn-secondary" type="button" data-action="edit" data-user-id="${userId}">${escapeHtml(t('page.clients.actions.edit'))}</button>
                ${callsEnabled ? `<button class="btn-new btn-sm btn-call" type="button" data-action="start-call" data-user-id="${userId}">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><rect x="1" y="3" width="8" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M9 5.5l3-2v6l-3-2V5.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
                    ${escapeHtml(t('page.clientProfile.startCall'))}
                </button>` : ''}
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
            ? formatDateTime(`${cs.started_at}Z`)
            : (cs.created_at ? formatDate(`${cs.created_at}Z`) : '—');
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
            const speakerLabel = seg.speaker === 'A' ? 'Astrologer' : 'Guest';
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
    if (!planCan('calls')) {
        openPlanUpgrade('calls');
        return;
    }
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
            throw new Error(data.message || data.detail || t('page.clients.detail.callStartFailed'));
        }
        const session = await res.json();
        const joinParam = session.join_url ? `&join_url=${encodeURIComponent(session.join_url)}` : '';
        window.location.href = `/consultation-call.html?session_id=${session.id}&user_id=${userId}${joinParam}`;
    } catch (err) {
        showToast(err.message || t('page.clients.detail.callStartFailed'), 'error');
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

        await refreshClientDetailPanel(userId);
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

        await refreshClientDetailPanel(userId);
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

// --- New standalone chart modal ---

function handleNewItemClick() {
    if (isSavedChartLimitReached()) { openPlanUpgrade('limit'); return; }
    if (state.libraryView === 'charts') {
        openNewChartDialog();
    } else {
        openNewClientDialog();
    }
}

function openNewChartDialog() {
    if (!refs.newChartDialog) return;
    refs.newChartForm?.reset();
    newChartState.selectedCoords = null;
    newChartState.selectedPlaceLabel = '';
    refs.newChartError?.classList.add('hidden');
    refs.newChartError && (refs.newChartError.textContent = '');
    window.Timezones?.populate?.(refs.newChartTimezone);
    refs.newChartBackdrop?.classList.remove('hidden');
    refs.newChartDialog.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    bindNewChartAutocomplete();
    refs.newChartDay?.focus();
}

function closeNewChartDialog() {
    refs.newChartBackdrop?.classList.add('hidden');
    refs.newChartDialog?.classList.add('hidden');
    document.body.style.overflow = '';
}

function bindNewChartAutocomplete() {
    if (newChartState.autocompleteBound || !window.PlaceAutocomplete || !refs.newChartPlace || !refs.newChartPlaceSuggestions) return;
    newChartState.autocompleteBound = true;
    window.PlaceAutocomplete.attach({
        input: refs.newChartPlace,
        suggestions: refs.newChartPlaceSuggestions,
        minChars: 2,
        debounceMs: 350,
        limit: 5,
        getLabel: (item) => item.shortName || item.displayName,
        onSelect: async (item) => {
            newChartState.selectedCoords = { lat: item.lat, lon: item.lon };
            newChartState.selectedPlaceLabel = item.shortName || item.displayName;
            let tz = null;
            if (item.sourceId && window.AstroAPI?.resolvePlaceTimezone) {
                try { tz = await window.AstroAPI.resolvePlaceTimezone(item.sourceId); } catch (_) {}
            }
            if (!tz) tz = window.Timezones?.guess?.(item.displayName || item.shortName) || null;
            if (tz && refs.newChartTimezone) refs.newChartTimezone.value = tz;
        },
    });
}

async function submitNewChart() {
    if (!refs.newChartSubmit) return;
    const day = refs.newChartDay?.value?.trim();
    const month = refs.newChartMonth?.value;
    const year = refs.newChartYear?.value?.trim();
    const hour = refs.newChartHour?.value?.trim();
    const minute = refs.newChartMinute?.value?.trim();
    const place = refs.newChartPlace?.value?.trim();
    const timezone = refs.newChartTimezone?.value;
    const title = refs.newChartTitle?.value?.trim() || null;

    const showError = (msg) => {
        if (!refs.newChartError) return;
        refs.newChartError.textContent = msg;
        refs.newChartError.classList.remove('hidden');
    };

    if (!day || !month || !year) { showError(t('page.clients.newChart.errors.dateRequired')); return; }
    if (hour === '' || minute === '') { showError(t('page.clients.newChart.errors.timeRequired')); return; }
    if (!place) { showError(t('page.clients.newChart.errors.placeRequired')); return; }
    if (!timezone) { showError(t('page.clients.newChart.errors.timezoneRequired')); return; }

    const dateStr = `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const timeStr = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00`;

    const body = {
        date: dateStr,
        time: timeStr,
        timezone,
        location_name: place,
        latitude: newChartState.selectedCoords?.lat ?? null,
        longitude: newChartState.selectedCoords?.lon ?? null,
        title,
        chart_kind: 'birth',
    };
    if (!body.location_name && (body.latitude === null || body.longitude === null)) {
        showError(t('page.clients.newChart.errors.placeRequired'));
        return;
    }

    refs.newChartSubmit.disabled = true;
    refs.newChartSubmit.querySelector('.btn-text')?.classList.add('hidden');
    refs.newChartSubmit.querySelector('.btn-loader')?.classList.remove('hidden');
    refs.newChartError?.classList.add('hidden');

    try {
        const res = await apiFetch(`${API_BASE}/charts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || t('common.errorGeneric'));
        }
        const chart = await res.json();
        const chartId = chart.chart_id || chart.user_id;
        closeNewChartDialog();
        if (chartId) {
            await openChart(chartId);
            return;
        }
        state.charts = [chart, ...state.charts];
        rebuildClientListIndexes();
        state.users = getActiveLibraryItems();
        renderUsers();
        showToast(t('page.clients.newChart.successToast'), 'success');
    } catch (err) {
        showError(err.message);
    } finally {
        refs.newChartSubmit.disabled = false;
        refs.newChartSubmit.querySelector('.btn-text')?.classList.remove('hidden');
        refs.newChartSubmit.querySelector('.btn-loader')?.classList.add('hidden');
    }
}

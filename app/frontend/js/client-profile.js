/**
 * Client profile page — /client/{personId}
 */

const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:8000/api/v1'
    : '/api/v1';

// Canonical route id is personId. Legacy chart ids are resolved during load.
const routeProfileId = window.location.pathname.split('/')[2] || '';
let personId = routeProfileId;
let primaryChartId = null;

let profileData = null;   // full server response
let relatedPeople = [];
let tagSourceUsers = [];
let apiTagPool = [];   // distinct tags across charts + persons (incl. family tags)
let consultationFilter = 'all';
let toastTimer = null;
let relatedPeoplePicker = null;
let currentAstrologer = null;

const refs = {};

const editClientState = {
    autocompleteBound: false,
    mode: 'edit-client',
    personId: null,
    loadedChartData: null,
    originalCoords: null,
    selectedCoords: null,
    originalPlace: '',
    selectedPlaceLabel: '',
};

const logSessionState = { personId: null, chartId: null };
/* ─── i18n helper ──────────────────────────────────────────────────────── */

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

function openPlanUpgrade(reason) {
    if (window.AstroPlan?.showUpgradeModal) {
        window.AstroPlan.showUpgradeModal({ reason, astrologer: currentAstrologer });
        return;
    }
    showToast(t('page.plan.modal.copy.default'), 'error');
}

/* ─── Utilities ─────────────────────────────────────────────────────────── */

function apiFetch(url, init = {}) {
    return fetch(url, {
        credentials: 'include',
        ...init,
        headers: withLocaleHeaders(init.headers || {}),
    });
}

function scheduleAfterPaint(callback, timeout = 1200) {
    const task = () => {
        try {
            Promise.resolve(callback()).catch((error) => {
                console.warn('Deferred client profile task failed:', error);
            });
        } catch (error) {
            console.warn('Deferred client profile task failed:', error);
        }
    };
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(task, { timeout });
        return;
    }
    window.setTimeout(task, 0);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
}

function formatDate(isoDate) {
    if (window.LocaleFormatters?.formatDate) {
        return window.LocaleFormatters.formatDate(isoDate);
    }
    if (!isoDate) return '';
    const parts = isoDate.split('T')[0].split('-');
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function formatDateTime(isoStr) {
    if (!isoStr) return '';
    const dt = new Date(isoStr + (isoStr.includes('T') && !isoStr.endsWith('Z') ? 'Z' : ''));
    if (Number.isNaN(dt.getTime())) return isoStr;
    if (window.LocaleFormatters?.formatDateTime) {
        return window.LocaleFormatters.formatDateTime(dt);
    }
    const locale = window.FrontendI18n?.getLocale?.() || 'en';
    return `${dt.toLocaleDateString(locale)} ${dt.toLocaleTimeString(locale, {
        hour: '2-digit', minute: '2-digit',
    })}`;
}

function formatDuration(seconds) {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
}

function showToast(message, type = 'info') {
    if (!refs.toast) return;
    refs.toast.textContent = message;
    refs.toast.className = `toast ${type}`;
    requestAnimationFrame(() => refs.toast.classList.add('visible'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => refs.toast.classList.remove('visible'), 2800);
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

/* ─── Bootstrap ─────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {
    await waitForI18nReady();
    cacheElements();
    configureProfileBackLink();

    if (!routeProfileId) {
        showError(t('page.clientProfile.errors.noId'));
        return;
    }

    currentAstrologer = await window.AstroAPI?.requireAuth?.({ redirectTo: '/login.html' });
    if (!currentAstrologer) return;
    applyPlanUi();

    if (window.AstroAPI?.getAccountPreferences) {
        try {
            window.accountPreferencesCache = await window.AstroAPI.getAccountPreferences();
            window.AstroPreferences?.setAccountVisualPreferences?.(window.accountPreferencesCache?.visual || {});
        } catch (error) {
            console.warn('Client profile account preferences fallback to defaults:', error);
        }
    }

    initEditClientDialog();
    initLogSessionDialog();
    initRelatedPeoplePicker();
    bindPageEvents();
    await loadProfile();
});

// The header back arrow is navigation ("previous page"), not "always home".
// Resolve it from the referrer / navigation breadcrumb, excluding self-referencing
// /client/... URLs so it never loops on another profile.
function configureProfileBackLink() {
    const backLink = document.querySelector('.profile-back');
    if (!backLink) return;
    backLink.href = window.AstroAPI?.resolveBackUrl?.({
        excludePattern: /\/client\//,
        fallback: '/',
    }) || '/';
}

function cacheElements() {
    refs.toast           = document.getElementById('toast');
    refs.pageLoader      = document.getElementById('pageLoader');
    refs.profileError    = document.getElementById('profileError');
    refs.profileErrorMsg = document.getElementById('profileErrorMsg');
    refs.profileMain     = document.getElementById('profileMain');

    // Header
    refs.profileAvatar  = document.getElementById('profileAvatar');
    refs.profileName    = document.getElementById('profileName');
    refs.profileBirth   = document.getElementById('profileBirth');
    refs.profileTags    = document.getElementById('profileTags');
    refs.openChartBtn   = document.getElementById('openChartBtn');
    refs.editClientBtn  = document.getElementById('editClientBtn');
    refs.profileActionsMenu     = document.getElementById('profileActionsMenu');
    refs.profileActionsBtn      = document.getElementById('profileActionsBtn');
    refs.profileActionsDropdown = document.getElementById('profileActionsDropdown');
    refs.profileEditAction      = document.getElementById('profileEditAction');
    refs.profileDeleteAction    = document.getElementById('profileDeleteAction');

    // Sections
    refs.profileContactList  = document.getElementById('profileContactList');
    refs.profileNotesWrap    = document.getElementById('profileNotesWrap');
    refs.profileNotes        = document.getElementById('profileNotes');
    refs.profileStatsGrid    = document.getElementById('profileStatsGrid');
    refs.profileInsightsCard = document.getElementById('profileInsightsCard');
    refs.profileInsightsList = document.getElementById('profileInsightsList');
    refs.profileInsightsEmpty = document.getElementById('profileInsightsEmpty');
    refs.relatedPeopleList   = document.getElementById('relatedPeopleList');
    refs.relatedPeopleEmpty  = document.getElementById('relatedPeopleEmpty');
    refs.addRelatedPersonBtn = document.getElementById('addRelatedPersonBtn');
    refs.linkExistingPersonBtn = document.getElementById('linkExistingPersonBtn');
    refs.consultationsList   = document.getElementById('consultationsList');
    refs.consultationsEmpty  = document.getElementById('consultationsEmpty');
    refs.filterTabs          = document.getElementById('consultationFilterTabs');
    refs.recordingsList      = document.getElementById('recordingsList');
    refs.recordingsEmpty     = document.getElementById('recordingsEmpty');
    refs.logSessionBtn       = document.getElementById('logSessionBtn');

    // Edit dialog
    refs.editBackdrop   = document.getElementById('editClientBackdrop');
    refs.editDialog     = document.getElementById('editClientDialog');
    refs.editForm       = document.getElementById('editClientForm');
    refs.editTitle      = document.getElementById('editClientTitle');
    refs.editClose      = document.getElementById('editClientClose');
    refs.editCancel     = document.getElementById('editClientCancel');
    refs.editSubmit     = document.getElementById('editClientSubmit');
    refs.editError      = document.getElementById('editClientError');
    refs.editFirstName  = document.getElementById('editFirstName');
    refs.editLastName   = document.getElementById('editLastName');
    refs.editDay        = document.getElementById('editBirthDay');
    refs.editMonth      = document.getElementById('editBirthMonth');
    refs.editYear       = document.getElementById('editBirthYear');
    refs.editHour       = document.getElementById('editBirthHour');
    refs.editMinute     = document.getElementById('editBirthMinute');
    refs.editPlaceInput      = document.getElementById('editBirthPlace');
    refs.editPlaceSuggestions = document.getElementById('editBirthPlaceSuggestions');
    refs.editPlaceHint  = document.getElementById('editPlaceHint');
    refs.editTimezone   = document.getElementById('editTimezone');
    refs.editTimezoneHint = document.getElementById('editTimezoneHint');
    refs.editEmail      = document.getElementById('editEmail');
    refs.editPhone      = document.getElementById('editPhone');
    refs.editMessenger  = document.getElementById('editMessenger');
    refs.editTags       = document.getElementById('editTags');
    refs.editTagSuggestionsWrap = document.getElementById('editTagSuggestionsWrap');
    refs.editTagSuggestions = document.getElementById('editTagSuggestions');
    refs.editNotes      = document.getElementById('editNotes');
    refs.editRelationGroup = document.getElementById('editRelationGroup');
    refs.editRelationLabel = document.getElementById('editRelationLabel');

    refs.relatedPickerBackdrop = document.getElementById('relatedPickerBackdrop');
    refs.relatedPickerDialog = document.getElementById('relatedPickerDialog');
    refs.relatedPickerClose = document.getElementById('relatedPickerClose');
    refs.relatedPickerCancel = document.getElementById('relatedPickerCancel');
    refs.relatedPickerSearch = document.getElementById('relatedPickerSearch');
    refs.relatedPickerRelationLabel = document.getElementById('relatedPickerRelationLabel');
    refs.relatedPickerError = document.getElementById('relatedPickerError');
    refs.relatedPickerList = document.getElementById('relatedPickerList');
    refs.relatedPickerEmpty = document.getElementById('relatedPickerEmpty');
    refs.relatedPickerSubmit = document.getElementById('relatedPickerSubmit');
    // Linked charts
    refs.linkedChartsCard    = document.getElementById('linkedChartsCard');
    refs.linkedChartsList    = document.getElementById('linkedChartsList');
    refs.linkedChartsEmpty   = document.getElementById('linkedChartsEmpty');
    refs.linkChartBtn        = document.getElementById('linkChartBtn');
    refs.linkChartBackdrop   = document.getElementById('linkChartBackdrop');
    refs.linkChartDialog     = document.getElementById('linkChartDialog');
    refs.linkChartClose      = document.getElementById('linkChartClose');
    refs.linkChartCancel     = document.getElementById('linkChartCancel');
    refs.linkChartSearch     = document.getElementById('linkChartSearch');
    refs.linkChartPickerList = document.getElementById('linkChartPickerList');
    refs.linkChartPickerEmpty = document.getElementById('linkChartPickerEmpty');
    refs.linkChartPickerLoading = document.getElementById('linkChartPickerLoading');
    refs.linkChartError      = document.getElementById('linkChartError');

    // Log session dialog
    refs.logSessionBackdrop = document.getElementById('logSessionBackdrop');
    refs.logSessionDialog   = document.getElementById('logSessionDialog');
    refs.logSessionForm     = document.getElementById('logSessionForm');
    refs.logSessionClose    = document.getElementById('logSessionClose');
    refs.logSessionCancel   = document.getElementById('logSessionCancel');
    refs.logSessionSubmit   = document.getElementById('logSessionSubmit');
    refs.logSessionError    = document.getElementById('logSessionError');
    refs.logSessionType     = document.getElementById('logSessionType');
    refs.logSessionDate     = document.getElementById('logSessionDate');
    refs.logSessionStatus   = document.getElementById('logSessionStatus');
    refs.logSessionDuration = document.getElementById('logSessionDuration');
    refs.logSessionPaid     = document.getElementById('logSessionPaid');
    refs.logSessionNotes    = document.getElementById('logSessionNotes');
}

function bindPageEvents() {
    refs.openChartBtn?.addEventListener('click', openChart);
    refs.linkChartBtn?.addEventListener('click', openLinkChartDialog);
    refs.linkChartClose?.addEventListener('click', closeLinkChartDialog);
    refs.linkChartCancel?.addEventListener('click', closeLinkChartDialog);
    refs.linkChartBackdrop?.addEventListener('click', closeLinkChartDialog);
    refs.linkChartSearch?.addEventListener('input', () => renderLinkChartPickerList());
    refs.editClientBtn?.addEventListener('click', () => openEditClientDialog(personId));

    refs.profileActionsBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleProfileActionsMenu();
    });
    refs.profileEditAction?.addEventListener('click', () => {
        closeProfileActionsMenu();
        openEditClientDialog(personId);
    });
    refs.profileDeleteAction?.addEventListener('click', () => deleteCard(refs.profileDeleteAction));
    document.addEventListener('click', (e) => {
        if (!refs.profileActionsMenu?.contains(e.target)) closeProfileActionsMenu();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeProfileActionsMenu();
    });
    refs.logSessionBtn?.addEventListener('click', () => {
        if (!planCan('consultations')) {
            openPlanUpgrade('consultations');
            return;
        }
        openLogSessionDialog(personId, primaryChartId);
    });
    refs.addRelatedPersonBtn?.addEventListener('click', openCreateRelatedPersonDialog);
    refs.linkExistingPersonBtn?.addEventListener('click', openRelatedPickerDialog);

    refs.filterTabs?.addEventListener('click', (e) => {
        const tab = e.target.closest('.profile-filter-tab[data-filter]');
        if (!tab) return;
        consultationFilter = tab.dataset.filter;
        refs.filterTabs.querySelectorAll('.profile-filter-tab').forEach((t) =>
            t.classList.toggle('active', t === tab)
        );
        renderConsultations();
    });

    refs.recordingsList?.addEventListener('click', async (e) => {
        const retryBtn = e.target.closest('.cs-retry-btn[data-session-id]');
        if (retryBtn) { await retryProcessing(retryBtn.dataset.sessionId, retryBtn); return; }

        const row = e.target.closest('.cs-row--expandable[data-session-id]');
        if (row) { await openCallRecording(row.dataset.sessionId, row); }
    });

    refs.relatedPeopleList?.addEventListener('click', async (e) => {
        const synastryBtn = e.target.closest('[data-action="open-synastry"]');
        if (synastryBtn) {
            openSynastry(synastryBtn.dataset.relatedPersonId, synastryBtn.dataset.relatedChartId);
            return;
        }

        const profileBtn = e.target.closest('[data-action="open-related-profile"]');
        if (profileBtn) {
            window.location.href = `/client/${encodeURIComponent(profileBtn.dataset.relatedPersonId)}`;
            return;
        }

        const deleteBtn = e.target.closest('[data-action="delete-related-person"]');
        if (deleteBtn) {
            await deleteRelatedPerson(deleteBtn.dataset.relatedPersonId);
        }
    });

    refs.editTags?.addEventListener('input', renderEditTagSuggestions);
    refs.editTagSuggestions?.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-tag]');
        if (!button) return;
        addTagToEditInput(button.dataset.tag);
    });

    document.addEventListener('frontend:locale-changed', () => {
        if (profileData) renderAll(profileData);
        relatedPeoplePicker?.refreshLocale?.();
        renderEditTagSuggestions();
    });
}

function applyPlanUi() {
    const isSolo = window.AstroAPI?.isSoloPlan?.(currentAstrologer) === true;
    document.body.classList.toggle('is-solo-profile', isSolo);
    document.querySelectorAll('[data-solo-profile-hidden]').forEach((section) => {
        section.classList.toggle('hidden', isSolo);
    });
    refs.logSessionBtn?.classList.toggle('hidden', !planCan('consultations'));
    refs.profileContactList?.closest('.profile-card')?.classList.toggle('hidden', !planCan('clients'));
    refs.profileStatsGrid?.closest('.profile-card')?.classList.toggle('hidden', !planCan('meeting_stats'));
    refs.profileInsightsCard?.classList.toggle('hidden', !planCan('calls'));
    refs.relatedPeopleList?.closest('.profile-card')?.classList.toggle('hidden', !planCan('clients'));
    refs.consultationsList?.closest('.profile-card')?.classList.toggle('hidden', !planCan('consultations'));
    refs.recordingsList?.closest('.profile-card')?.classList.toggle('hidden', !planCan('calls'));
}

/* ─── Load & render ─────────────────────────────────────────────────────── */

async function loadProfile() {
    try {
        let profileRes = await apiFetch(`${API_BASE}/persons/${encodeURIComponent(routeProfileId)}/profile`);

        if (profileRes.status === 401) { window.location.href = '/login.html'; return; }
        if (profileRes.status === 404) {
            const chartRes = await apiFetch(`${API_BASE}/charts/${encodeURIComponent(routeProfileId)}`);
            if (chartRes.status === 401) { window.location.href = '/login.html'; return; }
            if (chartRes.ok) {
                const chart = await chartRes.json();
                if (chart.person_id) {
                    window.location.replace(`/client/${encodeURIComponent(chart.person_id)}`);
                    return;
                }
                window.location.replace(`/?linkChart=${encodeURIComponent(routeProfileId)}`);
                return;
            }
            showError(t('page.clientProfile.errors.notFound'));
            return;
        }
        if (!profileRes.ok) throw new Error(t('page.clientProfile.errors.loadFailed'));

        profileData = await profileRes.json();
        personId = profileData?.person?.person_id || routeProfileId;
        primaryChartId = profileData?.primary_chart?.chart_id || null;
        profileData.user = normalizeCanonicalProfileUser(profileData);
        renderAll(profileData);

        refs.profileMain.classList.remove('hidden');
        hidePageLoader();
        scheduleSecondaryProfileLoads();
    } catch (err) {
        showError(err.message);
    }
}

function normalizeCanonicalProfileUser(data) {
    const person = data?.person || {};
    const chart = data?.primary_chart || {};
    return {
        user_id: chart.chart_id || null,
        person_id: person.person_id || null,
        first_name: person.first_name || person.display_name || chart.first_name || '',
        last_name: person.last_name || chart.last_name || '',
        birth_date: chart.birth_date || null,
        birth_time: chart.birth_time || null,
        birth_place: chart.birth_place || null,
        timezone: chart.timezone || null,
        email: person.email || '',
        phone: person.phone || '',
        messenger: person.messenger || '',
        tags: person.tags || [],
        notes: person.notes || '',
        created_at: person.created_at || null,
    };
}

function showError(msg) {
    hidePageLoader();
    refs.profileErrorMsg.textContent = msg;
    refs.profileError.classList.remove('hidden');
}

function hidePageLoader() {
    if (window.AstroAPI?.hidePageLoader) {
        window.AstroAPI.hidePageLoader();
        return;
    }

    refs.pageLoader?.classList.add('hidden');
}

function renderAll(data) {
    renderHeader(data.user);
    renderContact(data.user);
    renderStats(data.stats);
    renderDeferredSectionPlaceholders(data);
    renderInsights(data.aggregated_key_points);
    renderConsultations();
    renderRecordings(data.call_sessions);
}

function renderDeferredSectionPlaceholders(data) {
    renderRelatedPeopleLoading();
    renderClientMemoryLoading();
    renderLinkedChartsLoading(data?.user?.person_id);
}

function scheduleSecondaryProfileLoads() {
    scheduleAfterPaint(() => {
        loadProfileSecondaryData();
        loadAndRenderLinkedCharts(personId);
        if (!window.AstroAPI?.isSoloPlan?.(currentAstrologer)) {
            loadClientMemory();
        }
    });
}

async function loadProfileSecondaryData() {
    try {
        const [relatedPeoplePayload, usersPayload, tagsPayload] = await Promise.all([
            apiFetch(`${API_BASE}/persons/${encodeURIComponent(personId)}/related-people`).then((res) => (res.ok ? res.json() : [])).catch(() => []),
            apiFetch(`${API_BASE}/users`).then((res) => (res.ok ? res.json() : [])).catch(() => []),
            apiFetch(`${API_BASE}/charts/tags`).then((res) => (res.ok ? res.json() : [])).catch(() => []),
        ]);
        relatedPeople = Array.isArray(relatedPeoplePayload) ? relatedPeoplePayload : [];
        tagSourceUsers = Array.isArray(usersPayload) ? usersPayload : [];
        apiTagPool = Array.isArray(tagsPayload) ? tagsPayload : [];
        renderRelatedPeople(relatedPeople);
    } catch (_) {
        relatedPeople = [];
        renderRelatedPeople(relatedPeople);
    }
}

/* ─── Client history (consultation memory) ───────────────────────────────── */

const MEM_CATEGORY_KEY = (c) => `page.consultation.memoryCategory.${c}`;

async function loadClientMemory() {
    const list = document.getElementById('clientMemoryList');
    const empty = document.getElementById('clientMemoryEmpty');
    if (!list) return;
    try {
        const res = await apiFetch(`${API_BASE}/persons/${encodeURIComponent(personId)}/memory`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        const entries = data.entries || [];
        if (!entries.length) {
            list.innerHTML = '';
            empty?.classList.remove('hidden');
            return;
        }
        empty?.classList.add('hidden');
        list.innerHTML = entries.map((e) => {
            const catLabel = t(MEM_CATEGORY_KEY(e.category));
            const cat = catLabel === MEM_CATEGORY_KEY(e.category) ? e.category : catLabel;
            const prov = e.source === 'ai'
                ? `<span class="mem-provenance is-ai">✦ ${escapeHtml(t('page.consultation.memory.aiSuggested'))}</span>`
                : `<span class="mem-provenance">${escapeHtml(t('page.consultation.memory.byAstrologer'))}</span>`;
            return `<div class="mem-item" data-id="${escapeHtml(e.id)}">
                <div class="mem-item-head">
                    <span class="mem-cat">${escapeHtml(cat)}</span>
                    ${prov}
                    <span class="mem-internal">${escapeHtml(t('page.consultation.memory.internal'))}</span>
                </div>
                <p class="mem-text">${escapeHtml(e.text)}</p>
                <div class="mem-actions">
                    <button class="mem-del-btn" data-mem-del="${escapeHtml(e.id)}">${escapeHtml(t('common.delete'))}</button>
                </div>
            </div>`;
        }).join('');
        list.querySelectorAll('[data-mem-del]').forEach((btn) => {
            btn.addEventListener('click', () => deleteClientMemory(btn.dataset.memDel));
        });
    } catch (_) {
        list.innerHTML = '';
        empty?.classList.remove('hidden');
    }
}

function renderClientMemoryLoading() {
    const list = document.getElementById('clientMemoryList');
    const empty = document.getElementById('clientMemoryEmpty');
    if (!list) return;
    empty?.classList.add('hidden');
    list.innerHTML = `<p class="profile-empty">${escapeHtml(t('common.loading'))}</p>`;
}

async function deleteClientMemory(id) {
    if (!confirm(t('page.consultation.memory.confirmDelete'))) return;
    try {
        const res = await apiFetch(`${API_BASE}/memory/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        showToast(t('page.consultation.memory.deleted'), 'success');
        loadClientMemory();
    } catch (_) {
        showToast(t('common.error'), 'error');
    }
}

/* ─── Header ─────────────────────────────────────────────────────────────── */

function renderHeader(user) {
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || t('page.clientProfile.unnamed');
    const initials = [user.first_name, user.last_name]
        .filter(Boolean).map((n) => n[0].toUpperCase()).join('').slice(0, 2) || '?';

    refs.profileAvatar.textContent = initials;
    refs.profileName.textContent = name;
    document.title = name;

    const parts = [];
    if (user.birth_date) parts.push(formatDate(user.birth_date));
    if (user.birth_time) parts.push(user.birth_time.slice(0, 5));
    if (user.birth_place) parts.push(user.birth_place);
    refs.profileBirth.textContent = parts.join(' · ');
    if (refs.openChartBtn) {
        refs.openChartBtn.disabled = !primaryChartId;
        refs.openChartBtn.setAttribute('aria-disabled', primaryChartId ? 'false' : 'true');
    }

    refs.profileTags.innerHTML = '';
    if (Array.isArray(user.tags) && user.tags.length > 0) {
        user.tags.forEach((tag) => {
            const span = document.createElement('span');
            span.className = 'profile-tag';
            span.textContent = tag;
            refs.profileTags.appendChild(span);
        });
    }
}

/* ─── Contact ────────────────────────────────────────────────────────────── */

function renderContact(user) {
    refs.profileContactList.innerHTML = '';

    const items = [
        { icon: '✉', label: t('page.clients.crm.email'), value: user.email },
        { icon: '☎', label: t('page.clients.crm.phone'), value: user.phone },
        { icon: '✦', label: t('page.clients.crm.messenger'), value: user.messenger },
    ];

    let hasAny = false;
    for (const item of items) {
        if (!item.value) continue;
        hasAny = true;
        refs.profileContactList.insertAdjacentHTML('beforeend', `
            <div class="profile-contact-item">
                <span class="profile-contact-label">${escapeHtml(item.label)}</span>
                <span class="profile-contact-value">${escapeHtml(item.value)}</span>
            </div>`);
    }

    if (!hasAny) {
        refs.profileContactList.insertAdjacentHTML('beforeend',
            `<p class="profile-empty">${escapeHtml(t('page.clients.crm.noContact'))}</p>`);
    }

    if (user.notes) {
        refs.profileNotes.textContent = user.notes;
        refs.profileNotesWrap.classList.remove('hidden');
    } else {
        refs.profileNotesWrap.classList.add('hidden');
    }
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

function getAvailableTags() {
    const tagsByKey = new Map();
    const users = [
        ...(tagSourceUsers || []),
        ...(profileData?.user ? [profileData.user] : []),
    ];

    for (const user of users) {
        for (const tag of getUserTags(user)) {
            const key = normalizeTag(tag);
            if (key && !tagsByKey.has(key)) {
                tagsByKey.set(key, tag);
            }
        }
    }

    // Pool from API: distinct tags across all charts AND persons (family tags).
    for (const tag of (apiTagPool || [])) {
        const key = normalizeTag(tag);
        if (key && !tagsByKey.has(key)) {
            tagsByKey.set(key, tag);
        }
    }

    const collator = getNameCollator();
    return [...tagsByKey.values()].sort((a, b) => collator.compare(a, b));
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

    const tags = getAvailableTags();
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

/* ─── Stats ──────────────────────────────────────────────────────────────── */

function renderStats(stats) {
    const clientSince = stats.client_since ? formatDate(stats.client_since) : t('common.notAvailable');
    const lastType = stats.last_consultation_type
        ? t(`page.clients.consultation.types.${stats.last_consultation_type}`)
        : null;
    const lastAt = stats.last_consultation_at ? formatDateTime(stats.last_consultation_at) : null;
    const lastSession = lastAt ? `${lastAt}${lastType ? ` (${lastType})` : ''}` : t('common.notAvailable');

    const rows = [
        { label: t('page.clientProfile.stats.totalSessions'),   value: stats.consultation_count },
        { label: t('page.clientProfile.stats.completed'),        value: stats.completed_count },
        { label: t('page.clientProfile.stats.planned'),          value: stats.planned_count },
        { label: t('page.clientProfile.stats.totalCalls'),       value: stats.call_session_count },
        { label: t('page.clientProfile.stats.totalDuration'),    value: `${stats.total_duration_minutes} ${t('page.clientProfile.stats.minutes')}` },
        { label: t('page.clientProfile.stats.paid'),             value: `${stats.paid_count} / ${stats.consultation_count}` },
        { label: t('page.clientProfile.stats.clientSince'),      value: clientSince },
        { label: t('page.clientProfile.stats.lastSession'),      value: lastSession },
    ];

    refs.profileStatsGrid.innerHTML = rows.map((r) => `
        <div class="profile-stat-row">
            <span class="profile-stat-label">${escapeHtml(r.label)}</span>
            <span class="profile-stat-value">${escapeHtml(String(r.value))}</span>
        </div>`).join('');
}

/* ─── Key Insights ───────────────────────────────────────────────────────── */

function renderInsights(points) {
    if (!points || points.length === 0) {
        refs.profileInsightsList.innerHTML = '';
        refs.profileInsightsEmpty.classList.remove('hidden');
        return;
    }
    refs.profileInsightsEmpty.classList.add('hidden');
    refs.profileInsightsList.innerHTML = points
        .map((p) => `<li class="profile-insight-item">${escapeHtml(p)}</li>`)
        .join('');
}

function renderRelatedPeople(items) {
    if (!refs.relatedPeopleList || !refs.relatedPeopleEmpty) return;

    if (!items || items.length === 0) {
        refs.relatedPeopleList.innerHTML = '';
        refs.relatedPeopleEmpty.classList.remove('hidden');
        return;
    }

    refs.relatedPeopleEmpty.classList.add('hidden');
    refs.relatedPeopleList.innerHTML = items.map((person) => {
        const name = [person.first_name, person.last_name].filter(Boolean).join(' ') || t('common.notAvailable');
        const details = [];
        if (person.birth_date) details.push(formatDate(person.birth_date));
        if (person.birth_time) details.push(String(person.birth_time).slice(0, 5));
        if (person.birth_place) details.push(person.birth_place);

        return `
            <article class="profile-related-card">
                <div class="profile-related-main">
                    <div class="profile-related-name-row">
                        <h3 class="profile-related-name">${escapeHtml(name)}</h3>
                        <span class="profile-related-meta">${escapeHtml(details.join(' · ') || t('common.notAvailable'))}</span>
                        ${person.relation_label ? `<span class="profile-related-badge">${escapeHtml(person.relation_label)}</span>` : ''}
                    </div>
                    ${person.relation_notes ? `<p class="profile-related-notes">${escapeHtml(person.relation_notes)}</p>` : ''}
                </div>
                <div class="profile-related-actions">
                    <button class="btn-new btn-sm" type="button" data-action="open-synastry" data-related-person-id="${escapeHtml(person.person_id)}" data-related-chart-id="${escapeHtml(person.primary_chart_id || '')}" ${primaryChartId && person.primary_chart_id ? '' : 'disabled'}>${escapeHtml(t('page.clients.consultation.types.synastry'))}</button>
                    <button class="btn-logout btn-sm" type="button" data-action="open-related-profile" data-related-person-id="${escapeHtml(person.person_id)}">${escapeHtml(t('page.clientProfile.profileAction'))}</button>
                    <button class="profile-icon-btn profile-icon-btn--danger" type="button" data-action="delete-related-person" data-related-person-id="${escapeHtml(person.person_id)}" aria-label="${escapeHtml(t('page.clients.actions.delete'))}" title="${escapeHtml(t('page.clients.actions.delete'))}">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 4.5h9M6 2.5h4l.5 2H5.5l.5-2ZM5 6.5v6m3-6v6m3-6v6M4.5 4.5l.6 9h5.8l.6-9" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                </div>
            </article>
        `;
    }).join('');
}

function renderRelatedPeopleLoading() {
    if (!refs.relatedPeopleList || !refs.relatedPeopleEmpty) return;
    refs.relatedPeopleEmpty.classList.add('hidden');
    refs.relatedPeopleList.innerHTML = `<p class="profile-empty">${escapeHtml(t('common.loading'))}</p>`;
}

function initRelatedPeoplePicker() {
    if (!refs.relatedPickerDialog || !window.RelatedPeopleUI?.createRelatedPeoplePicker) return;

    relatedPeoplePicker = window.RelatedPeopleUI.createRelatedPeoplePicker({
        refs: {
            backdrop: refs.relatedPickerBackdrop,
            dialog: refs.relatedPickerDialog,
            close: refs.relatedPickerClose,
            cancel: refs.relatedPickerCancel,
            search: refs.relatedPickerSearch,
            relationLabel: refs.relatedPickerRelationLabel,
            error: refs.relatedPickerError,
            list: refs.relatedPickerList,
            empty: refs.relatedPickerEmpty,
            submit: refs.relatedPickerSubmit,
        },
        getCurrentUserId: () => personId,
        getExistingRelatedPeople: () => relatedPeople,
        onLinked: async () => {
            showToast(t('page.clientProfile.related.linked'), 'success');
            await loadProfile();
        },
        onOpenError: (error) => {
            showToast(t('common.errorWithMessage', { message: error.message }), 'error');
        },
        onVisibilityChange: (isOpen) => {
            document.body.style.overflow = isOpen ? 'hidden' : '';
        },
    });
    relatedPeoplePicker.init();
}

function openRelatedPickerDialog() {
    relatedPeoplePicker?.open?.();
}

/* ─── Consultation History ───────────────────────────────────────────────── */

function renderConsultations() {
    if (!profileData) return;
    const all = profileData.consultations || [];
    const filtered = consultationFilter === 'all'
        ? all
        : all.filter((c) => c.status === consultationFilter);

    if (filtered.length === 0) {
        refs.consultationsList.innerHTML = '';
        refs.consultationsEmpty.classList.remove('hidden');
        return;
    }

    refs.consultationsEmpty.classList.add('hidden');
    refs.consultationsList.innerHTML = filtered.map((c) => {
        const dateStr = c.scheduled_at ? formatDateTime(c.scheduled_at) : '';
        const typeLabel = t(`page.clients.consultation.types.${c.consultation_type}`) || c.consultation_type;
        const statusLabel = t(`page.clients.consultation.statuses.${c.status}`) || c.status;
        const paidClass = c.is_paid ? 'badge-paid' : 'badge-unpaid';
        const paidLabel = c.is_paid ? t('page.clients.detail.paidBadge') : t('page.clients.detail.unpaidBadge');
        const dur = c.duration_minutes ? `${c.duration_minutes} ${t('page.clientProfile.stats.minutes')}` : '';

        return `
            <div class="profile-consult-row">
                <span class="session-type-badge">${escapeHtml(typeLabel)}</span>
                <span class="session-date">${escapeHtml(dateStr)}</span>
                <span class="session-status">${escapeHtml(statusLabel)}</span>
                ${dur ? `<span class="session-duration">${escapeHtml(dur)}</span>` : ''}
                <span class="session-paid ${paidClass}">${escapeHtml(paidLabel)}</span>
                ${c.notes ? `<span class="session-notes" title="${escapeHtml(c.notes)}">${escapeHtml(c.notes.substring(0, 60))}${c.notes.length > 60 ? '…' : ''}</span>` : ''}
                <button class="session-delete-btn" type="button" data-action="delete-consultation" data-consultation-id="${escapeHtml(c.id)}">&times;</button>
            </div>`;
    }).join('');

    refs.consultationsList.querySelectorAll('button[data-action="delete-consultation"]').forEach((btn) => {
        btn.addEventListener('click', () => deleteConsultation(btn.dataset.consultationId));
    });
}

/* ─── Call Recordings ────────────────────────────────────────────────────── */

const CS_STATUS_META = {
    created:        { key: 'page.clientProfile.callStatus.created',       cls: 'cs-status--created'    },
    active:         { key: 'page.clientProfile.callStatus.active',        cls: 'cs-status--active'     },
    ended:          { key: 'page.clientProfile.callStatus.ended',         cls: 'cs-status--ended'      },
    processing:     { key: 'page.clientProfile.callStatus.processing',    cls: 'cs-status--processing' },
    completed:      { key: 'page.clientProfile.callStatus.completed',     cls: 'cs-status--completed'  },
    failed:         { key: 'page.clientProfile.callStatus.failed',        cls: 'cs-status--failed'     },
    summary_failed: { key: 'page.clientProfile.callStatus.summaryFailed', cls: 'cs-status--failed'     },
};
function csStatusLabel(status) {
    const m = CS_STATUS_META[status];
    return m ? t(m.key) : status;
}
function csStatusCls(status) {
    return CS_STATUS_META[status]?.cls || '';
}
// completed → full v1 recap; summary_failed → transcript + retry; both expandable.
function csIsExpandable(status) {
    return status === 'completed' || status === 'summary_failed';
}

function renderRecordings(sessions) {
    if (!sessions || sessions.length === 0) {
        refs.recordingsList.innerHTML = '';
        refs.recordingsEmpty.classList.remove('hidden');
        return;
    }
    refs.recordingsEmpty.classList.add('hidden');

    refs.recordingsList.innerHTML = sessions.map((cs) => {
        const dateStr = cs.started_at
            ? formatDateTime(`${cs.started_at}Z`)
            : (cs.created_at ? formatDate(`${cs.created_at}Z`) : '—');
        const dur = cs.duration_seconds ? formatDuration(cs.duration_seconds) : '';
        const isExpandable = csIsExpandable(cs.call_status);
        const expandIcon = isExpandable
            ? `<svg class="cs-expand-icon" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
            : '';
        const spinner = cs.call_status === 'processing' ? `<span class="cs-spinner"></span>` : '';

        return `
            <div class="cs-row${isExpandable ? ' cs-row--expandable' : ''}" data-session-id="${escapeHtml(cs.id)}">
                <span class="cs-date">${escapeHtml(dateStr)}</span>
                ${dur ? `<span class="cs-duration">${escapeHtml(dur)}</span>` : '<span class="cs-duration"></span>'}
                <span class="cs-status ${csStatusCls(cs.call_status)}">${spinner}${escapeHtml(csStatusLabel(cs.call_status))}</span>
                ${expandIcon}
            </div>
            <div class="cs-recording-panel" id="cs-panel-${escapeHtml(cs.id)}" hidden></div>`;
    }).join('');
}

async function openCallRecording(sessionId, rowEl) {
    const panel = document.getElementById(`cs-panel-${sessionId}`);
    if (!panel) return;

    if (!panel.hidden) {
        panel.hidden = true;
        rowEl.classList.remove('cs-row--open');
        return;
    }
    rowEl.classList.add('cs-row--open');
    panel.hidden = false;

    if (panel.dataset.loaded) return;
    panel.dataset.loaded = '1';
    panel.innerHTML = `<div class="cs-panel-loading"><span class="cs-spinner"></span> Loading…</div>`;

    try {
        const csRes = await apiFetch(`${API_BASE}/call-sessions/${sessionId}`);
        const cs = csRes.ok ? await csRes.json() : null;

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
    const MAX_ATTEMPTS = 36;
    const INTERVAL_MS  = 10_000;

    const timer = setInterval(async () => {
        attempts++;
        if (attempts > MAX_ATTEMPTS) {
            clearInterval(timer);
            panel.innerHTML = `<div class="cs-panel-error">Processing timed out. <button class="btn-new btn-sm cs-retry-btn" data-session-id="${escapeHtml(sessionId)}">Retry</button></div>`;
            return;
        }
        try {
            const res = await apiFetch(`${API_BASE}/call-sessions/${sessionId}`);
            if (!res.ok) return;
            const cs = await res.json();
            if (cs.call_status === 'processing') return;

            clearInterval(timer);

            const badge = rowEl.querySelector('.cs-status');
            if (badge) {
                badge.className = `cs-status ${csStatusCls(cs.call_status)}`;
                badge.textContent = csStatusLabel(cs.call_status);
            }

            const audioRes = cs.audio_storage_path
                ? await apiFetch(`${API_BASE}/call-sessions/${sessionId}/audio-url`)
                : null;
            const audio = audioRes?.ok ? await audioRes.json() : null;
            delete panel.dataset.loaded;
            panel.innerHTML = buildRecordingPanelHTML(cs, audio?.url || null, sessionId);
        } catch (_) { /* ignore transient errors */ }
    }, INTERVAL_MS);
}

function buildRecordingPanelHTML(cs, audioUrl, sessionId) {
    if (cs?.call_status === 'failed') {
        const errMsg = cs.processing_error
            ? `<p class="cs-panel-error">${escapeHtml(cs.processing_error)}</p>`
            : '';
        return `<div class="cs-panel-inner">
            <p class="cs-panel-error">${escapeHtml(t('page.clientProfile.recordings.failed'))}</p>
            ${errMsg}
            <button class="btn-new btn-sm cs-retry-btn" data-session-id="${escapeHtml(sessionId)}">${escapeHtml(t('page.clientProfile.recordings.retry'))}</button>
        </div>`;
    }

    let html = '';

    if (audioUrl) {
        html += `<div class="cs-audio-wrap">
            <audio class="cs-audio-player" controls preload="none" src="${escapeHtml(audioUrl)}"></audio>
        </div>`;
    }

    const sj = cs?.summary_json;

    if (cs?.call_status === 'summary_failed') {
        // Transcript succeeded but the summary failed §10 — show note + retry, keep transcript below.
        html += `<p class="cs-panel-error">${escapeHtml(t('page.clientProfile.recordings.summaryFailed'))}</p>
            <button class="btn-new btn-sm cs-retry-btn" data-session-id="${escapeHtml(sessionId)}">${escapeHtml(t('page.clientProfile.recordings.retry'))}</button>`;
    } else if (sj) {
        // v1 contract — brief recap + categorized key points + a link to the full review page.
        const brief = sj.session_summary?.brief || '';
        if (brief) {
            html += `<div class="cs-summary">
                <h5 class="cs-section-title">${escapeHtml(t('page.clientProfile.recordings.summary'))}</h5>
                <p class="cs-summary-text">${escapeHtml(brief)}</p>
            </div>`;
        }
        const kps = sj.key_points || [];
        if (kps.length) {
            const items = kps.slice(0, 6).map((p) => `<li>${escapeHtml(p.text || '')}</li>`).join('');
            html += `<div class="cs-key-points">
                <h5 class="cs-section-title">${escapeHtml(t('page.clientProfile.recordings.keyPoints'))}</h5>
                <ul class="cs-key-points-list">${items}</ul>
            </div>`;
        }
        html += `<a class="btn-new btn-sm" href="/consultation/${encodeURIComponent(sessionId)}">${escapeHtml(t('page.clientProfile.recordings.reviewShare'))} →</a>`;
    } else {
        // Legacy pre-v1 rows: render the old shape so historical sessions still display.
        if (cs?.summary_text) {
            html += `<div class="cs-summary">
                <h5 class="cs-section-title">${escapeHtml(t('page.clientProfile.recordings.summary'))}</h5>
                <p class="cs-summary-text">${escapeHtml(cs.summary_text)}</p>
            </div>`;
        }
        if (cs?.key_points?.length) {
            const items = cs.key_points.map((p) => {
                const text = typeof p === 'string' ? p : (p.detail || p.topic || '');
                return `<li>${escapeHtml(text)}</li>`;
            }).join('');
            html += `<div class="cs-key-points">
                <h5 class="cs-section-title">${escapeHtml(t('page.clientProfile.recordings.keyPoints'))}</h5>
                <ul class="cs-key-points-list">${items}</ul>
            </div>`;
        }
    }

    if (cs?.transcript_segments?.length) {
        const segs = cs.transcript_segments.map((seg) => {
            const speakerLabel = seg.speaker === 'A'
                ? t('page.clientProfile.recordings.speakerAstrologer')
                : t('page.clientProfile.recordings.speakerGuest');
            const cls = seg.speaker === 'A' ? 'cs-seg--astrologer' : 'cs-seg--client';
            return `<div class="cs-segment ${cls}">
                <span class="cs-seg-speaker">${escapeHtml(speakerLabel)}</span>
                <span class="cs-seg-text">${escapeHtml(seg.text)}</span>
            </div>`;
        }).join('');
        html += `<details class="cs-transcript-details">
            <summary class="cs-transcript-toggle">${escapeHtml(t('page.clientProfile.recordings.fullTranscript'))}</summary>
            <div class="cs-transcript">${segs}</div>
        </details>`;
    } else if (cs?.transcript_text) {
        html += `<details class="cs-transcript-details">
            <summary class="cs-transcript-toggle">${escapeHtml(t('page.clientProfile.recordings.fullTranscript'))}</summary>
            <p class="cs-transcript-plain">${escapeHtml(cs.transcript_text)}</p>
        </details>`;
    }

    if (!html) html = `<p class="cs-panel-empty">${escapeHtml(t('page.clientProfile.recordings.noData'))}</p>`;
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
        const panel = document.getElementById(`cs-panel-${sessionId}`);
        const row   = document.querySelector(`.cs-row--expandable[data-session-id="${sessionId}"]`);
        if (panel && row) {
            delete panel.dataset.loaded;
            panel.innerHTML = `<div class="cs-panel-loading"><span class="cs-spinner"></span> Transcription in progress…</div>`;
            pollProcessingSession(sessionId, panel, row);
        }
    } catch (err) {
        showToast(err.message || 'Could not retry', 'error');
        btn.disabled = false;
        btn.textContent = orig;
    }
}

/* ─── Navigation actions ─────────────────────────────────────────────────── */

async function openChart(chartId = primaryChartId) {
    if (!chartId) return;
    try {
        const res = await apiFetch(`${API_BASE}/natal/${encodeURIComponent(chartId)}`);
        if (!res.ok) throw new Error(t('page.clients.errors.chartNotFound'));
        const chartData = await res.json();
        window.AstroAPI.saveChartToSession(chartData);
        window.AstroAPI.saveFormData(window.AstroAPI.chartToFormData(chartData));
        window.AstroAPI.saveNavigationState?.({
            sourceView: 'client-profile',
            sourceUrl: window.AstroAPI.buildClientProfileUrl?.(personId) || `/client/${encodeURIComponent(personId)}`,
            clientPersonId: String(personId),
            clientChartId: String(chartId),
            clientUserId: String(chartId),
            partnerUserId: null,
        });
        window.showPageLoader?.();
        window.location.href = '/forecast-new.html';
    } catch (err) {
        showToast(t('common.errorWithMessage', { message: err.message }), 'error');
    }
}

function openSynastry(relatedPersonId, relatedChartId) {
    if (!primaryChartId || !relatedChartId) return;
    window.AstroAPI?.openForecastForSynastry?.(primaryChartId, relatedChartId, {
        sourceView: 'client-profile',
        sourceUrl: window.AstroAPI.buildClientProfileUrl?.(personId) || `/client/${encodeURIComponent(personId)}`,
        clientPersonId: personId,
        partnerPersonId: relatedPersonId,
    });
}

async function startCallSession() {
    if (!planCan('calls')) {
        openPlanUpgrade('calls');
        return;
    }
    refs.startCallBtn.disabled = true;
    const origHtml = refs.startCallBtn.innerHTML;
    refs.startCallBtn.textContent = t('page.clients.detail.startingCall');
    try {
        const res = await apiFetch(`${API_BASE}/call-sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ person_id: personId, chart_id: primaryChartId }),
        });
        if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            throw new Error(d.message || d.detail || t('page.clients.detail.callStartFailed'));
        }
        const session = await res.json();
        if (typeof window.AstroAnalytics?.track === 'function') {
            window.AstroAnalytics.track('consultation_started', {});
        }
        const joinParam = session.join_url ? `&join_url=${encodeURIComponent(session.join_url)}` : '';
        window.location.href = `/consultation-call.html?session_id=${session.id}&person_id=${personId}${primaryChartId ? `&chart_id=${primaryChartId}` : ''}${joinParam}`;
    } catch (err) {
        showToast(err.message || t('page.clients.detail.callStartFailed'), 'error');
        refs.startCallBtn.disabled = false;
        refs.startCallBtn.innerHTML = origHtml;
    }
}

/* ─── Delete consultation ────────────────────────────────────────────────── */

async function deleteConsultation(consultationId) {
    if (!consultationId) return;
    try {
        const res = await apiFetch(`${API_BASE}/consultations/${consultationId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(t('page.clients.consultation.errors.deleteFailed'));
        showToast(t('page.clients.consultation.messages.deleted'), 'success');
        await loadProfile();
    } catch (err) {
        showToast(t('common.errorWithMessage', { message: err.message }), 'error');
    }
}

/* ─── Edit Client Dialog ─────────────────────────────────────────────────── */

function initEditClientDialog() {
    if (!refs.editDialog) return;
    window.Timezones?.populate?.(refs.editTimezone);
    refs.editClose?.addEventListener('click', closeEditClientDialog);
    refs.editCancel?.addEventListener('click', closeEditClientDialog);
    refs.editBackdrop?.addEventListener('click', closeEditClientDialog);
    refs.editForm?.addEventListener('submit', handleEditClientSubmit);
    refs.editPlaceInput?.addEventListener('input', handleEditPlaceInput);
    refs.editPlaceInput?.addEventListener('focus', bindEditPlaceAutocomplete, { once: true });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !refs.editDialog.classList.contains('hidden')) {
            closeEditClientDialog();
        }
    });
}

function setEditDialogMode(mode) {
    editClientState.mode = mode === 'create-related' ? 'create-related' : 'edit-client';
    refs.editRelationGroup?.classList.toggle('hidden', editClientState.mode !== 'create-related');
    document.querySelectorAll('[data-profile-chart-fields]').forEach((group) => {
        const visible = editClientState.mode === 'create-related';
        group.classList.toggle('hidden', !visible);
        group.querySelectorAll('input, select').forEach((input) => {
            input.required = visible;
        });
    });
    if (refs.editFirstName) refs.editFirstName.required = true;
    if (refs.editLastName) refs.editLastName.required = editClientState.mode === 'create-related';

    if (refs.editTitle) {
        refs.editTitle.textContent = editClientState.mode === 'create-related'
            ? t('page.clientProfile.related.createTitle')
            : t('page.clients.edit.title');
    }

    const submitText = refs.editSubmit?.querySelector('.btn-text');
    if (submitText) {
        submitText.textContent = editClientState.mode === 'create-related'
            ? t('page.clientProfile.related.createSubmit')
            : t('page.clients.edit.submit');
    }
}

async function openEditClientDialog(pid) {
    if (!pid || !profileData?.person) return;
    try {
        setEditDialogMode('edit-client');
        const person = profileData.person;
        editClientState.personId = pid;
        editClientState.loadedChartData = null;
        refs.editFirstName.value = person.first_name || '';
        refs.editLastName.value  = person.last_name || '';
        if (refs.editEmail) refs.editEmail.value = person.email || '';
        if (refs.editPhone) refs.editPhone.value = person.phone || '';
        if (refs.editMessenger) refs.editMessenger.value = person.messenger || '';
        if (refs.editTags) refs.editTags.value = Array.isArray(person.tags) ? person.tags.join(', ') : '';
        if (refs.editNotes) refs.editNotes.value = person.notes || '';
        if (refs.editRelationLabel) refs.editRelationLabel.value = '';
        renderEditTagSuggestions();
        refs.editError.classList.add('hidden');
        refs.editError.textContent = '';
        setEditClientSubmitting(false);

        refs.editBackdrop.classList.remove('hidden');
        refs.editDialog.classList.remove('hidden');
        refs.editFirstName.focus();
        document.body.style.overflow = 'hidden';
    } catch (err) {
        showToast(t('common.errorWithMessage', { message: err.message }), 'error');
    }
}

function openCreateRelatedPersonDialog() {
    setEditDialogMode('create-related');
    editClientState.personId = null;
    editClientState.loadedChartData = null;
    editClientState.originalCoords = null;
    editClientState.selectedCoords = null;
    editClientState.originalPlace = '';
    editClientState.selectedPlaceLabel = '';

    refs.editForm?.reset();
    window.Timezones?.populate?.(refs.editTimezone);
    refs.editTimezone.value = '';
    refs.editTimezoneHint.textContent = '';
    refs.editTimezoneHint.style.color = '';
    refs.editError.classList.add('hidden');
    refs.editError.textContent = '';
    renderEditPlaceHint('empty');
    setEditClientSubmitting(false);

    refs.editBackdrop.classList.remove('hidden');
    refs.editDialog.classList.remove('hidden');
    refs.editFirstName.focus();
    document.body.style.overflow = 'hidden';
}

function closeEditClientDialog() {
    refs.editBackdrop?.classList.add('hidden');
    refs.editDialog?.classList.add('hidden');
    refs.editError?.classList.add('hidden');
    if (refs.editError) refs.editError.textContent = '';
    if (refs.editTimezoneHint) { refs.editTimezoneHint.textContent = ''; refs.editTimezoneHint.style.color = ''; }
    editClientState.personId = null;
    editClientState.loadedChartData = null;
    editClientState.mode = 'edit-client';
    document.body.style.overflow = '';
}

function bindEditPlaceAutocomplete() {
    if (editClientState.autocompleteBound || !window.PlaceAutocomplete || !refs.editPlaceInput) return;
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

            let resolvedTz = null;
            if (item.sourceId && window.AstroAPI?.resolvePlaceTimezone) {
                try { resolvedTz = await window.AstroAPI.resolvePlaceTimezone(item.sourceId); } catch (_) {}
            }
            if (!resolvedTz) {
                resolvedTz = window.Timezones?.guess?.(item.displayName || item.shortName) || null;
            }
            if (resolvedTz) {
                refs.editTimezone.value = resolvedTz;
                refs.editTimezoneHint.textContent = t('page.index.form.timezone.autoDetected');
                refs.editTimezoneHint.style.color = '#22c55e';
            }
        },
    });
}

function handleEditPlaceInput(e) {
    const next = normalizeLooseText(e.target.value);
    if (!next) { editClientState.selectedCoords = null; renderEditPlaceHint('empty'); return; }
    if (next === editClientState.selectedPlaceLabel) { renderEditPlaceHint(resolveEditPlaceHintMode()); return; }
    if (next === editClientState.originalPlace) {
        editClientState.selectedCoords = editClientState.originalCoords;
        editClientState.selectedPlaceLabel = editClientState.originalPlace;
        renderEditPlaceHint('current');
        return;
    }
    editClientState.selectedCoords = null;
    renderEditPlaceHint('manual');
}

function resolveEditPlaceHintMode() {
    if (editClientState.selectedCoords && editClientState.selectedPlaceLabel === editClientState.originalPlace) return 'current';
    if (editClientState.selectedCoords) return 'selected';
    if (refs.editPlaceInput?.value?.trim()) return 'manual';
    return 'empty';
}

function renderEditPlaceHint(mode) {
    if (!refs.editPlaceHint) return;
    refs.editPlaceHint.style.color = '';
    if (mode === 'selected') { refs.editPlaceHint.textContent = t('page.clients.edit.placeSelected'); refs.editPlaceHint.style.color = '#22c55e'; return; }
    if (mode === 'manual')   { refs.editPlaceHint.textContent = t('page.clients.edit.placeManual'); refs.editPlaceHint.style.color = '#b07d10'; return; }
    if (mode === 'empty')    { refs.editPlaceHint.textContent = t('page.clients.edit.placeHint'); return; }
    refs.editPlaceHint.textContent = t('page.clients.edit.placeCurrent');
}

async function handleEditClientSubmit(e) {
    e.preventDefault();
    if (!refs.editForm.reportValidity()) return;
    if (editClientState.mode !== 'create-related' && !editClientState.personId) {
        refs.editError.textContent = t('page.clients.edit.errors.chartUnavailable');
        refs.editError.classList.remove('hidden');
        return;
    }

    const place = refs.editPlaceInput.value.trim();
    const tags = parseTagInput(refs.editTags?.value || '');
    const personRequest = {
        first_name: refs.editFirstName.value.trim(),
        last_name:  refs.editLastName.value.trim(),
        display_name: [refs.editFirstName.value.trim(), refs.editLastName.value.trim()].filter(Boolean).join(' '),
        email:     refs.editEmail?.value?.trim() || '',
        phone:     refs.editPhone?.value?.trim() || '',
        messenger: refs.editMessenger?.value?.trim() || '',
        tags,
        notes: refs.editNotes?.value?.trim() || '',
    };

    const lat = Number(editClientState.selectedCoords?.lat);
    const lon = Number(editClientState.selectedCoords?.lon);
    const normPlace = normalizeLooseText(place);
    if (
        normPlace
        && Number.isFinite(lat) && Number.isFinite(lon)
        && (normPlace === editClientState.selectedPlaceLabel || normPlace === editClientState.originalPlace)
    ) {
        personRequest.latitude = lat;
        personRequest.longitude = lon;
    }

    refs.editError.classList.add('hidden');
    refs.editError.textContent = '';
    setEditClientSubmitting(true);

    try {
        const submitMode = editClientState.mode;
        if (editClientState.mode === 'create-related') {
            const personRes = await apiFetch(`${API_BASE}/persons`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(personRequest),
            });
            if (!personRes.ok) throw new Error(t('page.clients.edit.errors.saveFailed'));
            const createdPerson = await personRes.json();
            let createdChartId = null;
            try {
                const chartPayload = {
                    first_name: personRequest.first_name,
                    last_name: personRequest.last_name,
                    date: window.AstroAPI.formatDate(refs.editDay.value, refs.editMonth.value, refs.editYear.value),
                    time: window.AstroAPI.formatTime(refs.editHour.value, refs.editMinute.value),
                    timezone: refs.editTimezone.value,
                    location_name: place,
                    house_system: 'P',
                    chart_kind: 'birth',
                    person_id: createdPerson.person_id,
                };
                if (Number.isFinite(lat) && Number.isFinite(lon)) {
                    chartPayload.latitude = lat;
                    chartPayload.longitude = lon;
                }
                const chartRes = await apiFetch(`${API_BASE}/charts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(chartPayload),
                });
                if (!chartRes.ok) throw new Error(t('page.clients.edit.errors.saveFailed'));
                const createdChart = await chartRes.json();
                createdChartId = createdChart.chart_id || createdChart.user_id || null;
                const relationRes = await apiFetch(`${API_BASE}/persons/${encodeURIComponent(personId)}/related-people`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        related_person_id: createdPerson.person_id,
                        relation_label: refs.editRelationLabel?.value?.trim() || null,
                    }),
                });
                if (!relationRes.ok) throw new Error(t('page.clientProfile.related.linkFailed'));
            } catch (error) {
                if (createdChartId) {
                    await apiFetch(`${API_BASE}/charts/${encodeURIComponent(createdChartId)}`, { method: 'DELETE' }).catch(() => {});
                }
                await apiFetch(`${API_BASE}/persons/${encodeURIComponent(createdPerson.person_id)}`, { method: 'DELETE' }).catch(() => {});
                throw error;
            }
        } else {
            const res = await apiFetch(`${API_BASE}/persons/${encodeURIComponent(editClientState.personId)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(personRequest),
            });
            if (!res.ok) throw new Error(t('page.clients.edit.errors.saveFailed'));
        }
        closeEditClientDialog();
        showToast(
            submitMode === 'create-related'
                ? t('page.clientProfile.related.created')
                : t('page.clients.messages.updated'),
            'success'
        );
        await loadProfile();
    } catch (err) {
        refs.editError.textContent = err.message || t('page.clients.edit.errors.saveFailed');
        refs.editError.classList.remove('hidden');
    } finally {
        setEditClientSubmitting(false);
    }
}

function setEditClientSubmitting(v) {
    if (!refs.editSubmit) return;
    refs.editSubmit.disabled = v;
    refs.editSubmit.querySelector('.btn-text')?.classList.toggle('hidden', v);
    refs.editSubmit.querySelector('.btn-loader')?.classList.toggle('hidden', !v);
}

async function deleteRelatedPerson(relatedPersonId) {
    if (!relatedPersonId) return;
    if (!window.confirm(t('page.clientProfile.related.confirmDelete'))) return;

    try {
        await window.AstroAPI.deleteRelatedPerson(personId, relatedPersonId);
        showToast(t('page.clientProfile.related.deleted'), 'success');
        await loadProfile();
    } catch (err) {
        showToast(t('common.errorWithMessage', { message: err.message }), 'error');
    }
}

/* ─── Profile action menu (edit / delete card) ───────────────────────────── */

function toggleProfileActionsMenu() {
    const open = refs.profileActionsDropdown?.classList.toggle('open');
    refs.profileActionsBtn?.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function closeProfileActionsMenu() {
    if (!refs.profileActionsDropdown?.classList.contains('open')) return;
    refs.profileActionsDropdown.classList.remove('open');
    refs.profileActionsBtn?.setAttribute('aria-expanded', 'false');
    if (refs.profileDeleteAction) {
        refs.profileDeleteAction.dataset.confirming = 'false';
        refs.profileDeleteAction.classList.remove('confirming');
        refs.profileDeleteAction.textContent = t('page.clients.actions.delete');
    }
}

async function deleteCard(button) {
    if (!personId || !button) return;

    // Two-step confirm inside the menu, matching the clients list pattern.
    if (button.dataset.confirming !== 'true') {
        button.dataset.confirming = 'true';
        button.classList.add('confirming');
        button.textContent = t('page.clients.actions.confirmDelete');
        showToast(t('page.clients.messages.confirmDeleteHint'), 'warning');
        setTimeout(() => {
            if (button.dataset.confirming !== 'true') return;
            button.dataset.confirming = 'false';
            button.classList.remove('confirming');
            button.textContent = t('page.clients.actions.delete');
        }, 4000);
        return;
    }

    button.disabled = true;
    try {
        const res = await apiFetch(`${API_BASE}/persons/${encodeURIComponent(personId)}`, { method: 'DELETE' });
        if (!res.ok) {
            let message = t('page.clients.errors.deleteFailed');
            try {
                const payload = await res.json();
                if (payload?.message?.trim()) message = payload.message;
                else if (payload?.detail?.trim()) message = payload.detail;
            } catch (_) { /* non-json response */ }
            throw new Error(message);
        }
        showToast(t('page.clients.messages.deleted'), 'success');
        window.location.href = '/';
    } catch (err) {
        button.disabled = false;
        closeProfileActionsMenu();
        showToast(err.message || t('page.clients.errors.deleteFailed'), 'error');
    }
}

function normalizeLooseText(value) {
    return String(value || '').trim().toLowerCase();
}

/* ─── Log Session Dialog ─────────────────────────────────────────────────── */

function initLogSessionDialog() {
    if (!refs.logSessionDialog) return;
    refs.logSessionClose?.addEventListener('click', closeLogSessionDialog);
    refs.logSessionCancel?.addEventListener('click', closeLogSessionDialog);
    refs.logSessionBackdrop?.addEventListener('click', closeLogSessionDialog);
    refs.logSessionForm?.addEventListener('submit', handleLogSessionSubmit);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && refs.logSessionDialog && !refs.logSessionDialog.classList.contains('hidden')) {
            closeLogSessionDialog();
        }
    });
}

function openLogSessionDialog(pid, chartId = null) {
    logSessionState.personId = pid;
    logSessionState.chartId = chartId;
    refs.logSessionForm?.reset();
    if (refs.logSessionStatus) refs.logSessionStatus.value = 'completed';
    if (refs.logSessionDate) {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        refs.logSessionDate.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    }
    if (refs.logSessionError) { refs.logSessionError.classList.add('hidden'); refs.logSessionError.textContent = ''; }
    setLogSessionSubmitting(false);
    refs.logSessionBackdrop?.classList.remove('hidden');
    refs.logSessionDialog?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeLogSessionDialog() {
    refs.logSessionBackdrop?.classList.add('hidden');
    refs.logSessionDialog?.classList.add('hidden');
    logSessionState.personId = null;
    logSessionState.chartId = null;
    document.body.style.overflow = '';
}

function setLogSessionSubmitting(v) {
    if (!refs.logSessionSubmit) return;
    refs.logSessionSubmit.disabled = v;
    refs.logSessionSubmit.querySelector('.btn-text')?.classList.toggle('hidden', v);
    refs.logSessionSubmit.querySelector('.btn-loader')?.classList.toggle('hidden', !v);
}

async function handleLogSessionSubmit(e) {
    e.preventDefault();
    if (!logSessionState.personId) return;

    const payload = {
        person_id: logSessionState.personId,
        chart_id: logSessionState.chartId,
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
    if (refs.logSessionError) { refs.logSessionError.classList.add('hidden'); refs.logSessionError.textContent = ''; }

    try {
        const res = await apiFetch(`${API_BASE}/consultations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(t('page.clients.consultation.errors.saveFailed'));
        closeLogSessionDialog();
        showToast(t('page.clients.consultation.messages.created'), 'success');
        await loadProfile();
    } catch (err) {
        if (refs.logSessionError) {
            refs.logSessionError.textContent = err.message;
            refs.logSessionError.classList.remove('hidden');
        }
    } finally {
        setLogSessionSubmitting(false);
    }
}

// --- Linked charts ---

let allChartsCache = null;   // full chart list for picker
let linkedChartIds = new Set();
let currentPersonId = null;

function renderLinkedChartsLoading(personId) {
    if (!personId) {
        refs.linkedChartsCard?.classList.add('hidden');
        return;
    }
    refs.linkedChartsCard?.classList.remove('hidden');
    refs.linkedChartsEmpty?.classList.add('hidden');
    if (refs.linkedChartsList) {
        refs.linkedChartsList.innerHTML = `<p class="profile-empty">${escapeHtml(t('common.loading'))}</p>`;
    }
}

async function loadAndRenderLinkedCharts(personId) {
    if (!personId) {
        refs.linkedChartsCard?.classList.add('hidden');
        return;
    }
    currentPersonId = personId;
    refs.linkedChartsCard?.classList.remove('hidden');

    try {
        const res = await apiFetch(`${API_BASE}/persons/${personId}/charts`);
        if (!res.ok) return;
        const charts = await res.json();
        linkedChartIds = new Set(charts.map((c) => String(c.chart_id)));
        renderLinkedChartsList(charts);
    } catch (_) {}
}

function renderLinkedChartsList(charts) {
    if (!refs.linkedChartsList) return;
    if (!charts.length) {
        refs.linkedChartsEmpty?.classList.remove('hidden');
        refs.linkedChartsList.innerHTML = '';
        return;
    }
    refs.linkedChartsEmpty?.classList.add('hidden');
    refs.linkedChartsList.innerHTML = charts.map((c) => {
        const date = c.date ? formatDate(c.date) : '';
        const place = c.place || '';
        const meta = [date, place].filter(Boolean).join(' · ');
        const isCurrentChart = String(c.chart_id) === String(primaryChartId);
        const cls = `profile-linked-chart-item is-clickable${isCurrentChart ? ' is-current' : ''}`;
        const attrs = ` role="button" tabindex="0" data-action="open-linked-chart"`;
        return `<div class="${cls}" data-chart-id="${escapeHtml(String(c.chart_id))}"${attrs}>
            <div class="profile-linked-chart-info">
                <span class="profile-linked-chart-title">${escapeHtml(c.display_title)}</span>
                ${meta ? `<span class="profile-linked-chart-meta">${escapeHtml(meta)}</span>` : ''}
            </div>
            <div class="profile-linked-chart-actions">
                ${c.link_source === 'm2m' ? `<button class="profile-icon-btn profile-icon-btn--danger" type="button" data-action="unlink-chart" data-chart-id="${escapeHtml(String(c.chart_id))}" aria-label="${escapeHtml(t('page.clientProfile.linkedCharts.unlink'))}" title="${escapeHtml(t('page.clientProfile.linkedCharts.unlink'))}"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 4.5h9M6 2.5h4l.5 2H5.5l.5-2ZM5 6.5v6m3-6v6m3-6v6M4.5 4.5l.6 9h5.8l.6-9" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : ''}
                <div class="profile-actions-menu profile-linked-chart-menu">
                    <button class="profile-icon-btn" type="button" data-action="chart-menu-toggle" aria-haspopup="menu" aria-expanded="false" aria-label="${escapeHtml(t('page.clients.table.actions'))}" title="${escapeHtml(t('page.clients.table.actions'))}"><svg width="14" height="4" viewBox="0 0 14 4" fill="none" aria-hidden="true"><circle cx="2" cy="2" r="1.4" fill="currentColor"/><circle cx="7" cy="2" r="1.4" fill="currentColor"/><circle cx="12" cy="2" r="1.4" fill="currentColor"/></svg></button>
                    <div class="actions-dropdown profile-actions-dropdown" role="menu">
                        ${c.link_source === 'fk' && !isCurrentChart ? `<button class="action-item" type="button" role="menuitem" data-action="set-primary-chart" data-chart-id="${escapeHtml(String(c.chart_id))}">${escapeHtml(t('page.clientProfile.linkedCharts.setPrimary'))}</button>` : ''}
                        <button class="action-item" type="button" role="menuitem" data-action="edit-chart" data-chart-id="${escapeHtml(String(c.chart_id))}">${escapeHtml(t('page.clients.actions.edit'))}</button>
                        <button class="action-item danger" type="button" role="menuitem" data-action="delete-chart" data-chart-id="${escapeHtml(String(c.chart_id))}">${escapeHtml(t('page.clients.actions.delete'))}</button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    refs.linkedChartsList.querySelectorAll('[data-action="unlink-chart"]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            unlinkChart(btn.dataset.chartId);
        });
    });

    refs.linkedChartsList.querySelectorAll('[data-action="chart-menu-toggle"]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = btn.nextElementSibling;
            const willOpen = !dropdown.classList.contains('open');
            closeChartMenus();
            dropdown.classList.toggle('open', willOpen);
            btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        });
    });

    refs.linkedChartsList.querySelectorAll('[data-action="edit-chart"]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeChartMenus();
            window.location.href = `/?editChart=${encodeURIComponent(btn.dataset.chartId)}`;
        });
    });

    refs.linkedChartsList.querySelectorAll('[data-action="set-primary-chart"]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            closeChartMenus();
            await setPrimaryChart(btn.dataset.chartId);
        });
    });

    refs.linkedChartsList.querySelectorAll('[data-action="delete-chart"]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteLinkedChart(btn.dataset.chartId, btn);
        });
    });

    refs.linkedChartsList.querySelectorAll('[data-action="open-linked-chart"]').forEach((card) => {
        const open = () => openLinkedChart(card.dataset.chartId);
        card.addEventListener('click', open);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
            }
        });
    });
}

function closeChartMenus() {
    refs.linkedChartsList?.querySelectorAll('.profile-linked-chart-menu .actions-dropdown.open').forEach((d) => {
        d.classList.remove('open');
        const btn = d.previousElementSibling;
        btn?.setAttribute('aria-expanded', 'false');
        const del = d.querySelector('[data-action="delete-chart"]');
        if (del) {
            del.dataset.confirming = 'false';
            del.classList.remove('confirming');
            del.textContent = t('page.clients.actions.delete');
        }
    });
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.profile-linked-chart-menu')) closeChartMenus();
});

async function deleteLinkedChart(chartId, button) {
    if (!chartId || !button) return;

    // Two-step confirm inside the menu, matching the clients list pattern.
    if (button.dataset.confirming !== 'true') {
        button.dataset.confirming = 'true';
        button.classList.add('confirming');
        button.textContent = t('page.clients.actions.confirmDelete');
        showToast(t('page.clients.messages.confirmDeleteHint'), 'warning');
        setTimeout(() => {
            if (button.dataset.confirming !== 'true') return;
            button.dataset.confirming = 'false';
            button.classList.remove('confirming');
            button.textContent = t('page.clients.actions.delete');
        }, 4000);
        return;
    }

    button.disabled = true;
    try {
        const res = await apiFetch(`${API_BASE}/charts/${encodeURIComponent(chartId)}`, { method: 'DELETE' });
        if (!res.ok) {
            let message = t('page.clients.errors.deleteFailed');
            try {
                const payload = await res.json();
                if (payload?.message?.trim()) message = payload.message;
                else if (payload?.detail?.trim()) message = payload.detail;
            } catch (_) { /* non-json response */ }
            throw new Error(message);
        }
        showToast(t('page.clients.messages.deleted'), 'success');
        linkedChartIds.delete(String(chartId));
        await loadProfile();
    } catch (err) {
        button.disabled = false;
        closeChartMenus();
        showToast(err.message || t('page.clients.errors.deleteFailed'), 'error');
    }
}

function openLinkedChart(chartId) {
    openChart(chartId);
}

async function setPrimaryChart(chartId) {
    if (!personId || !chartId) return;
    try {
        const res = await apiFetch(`${API_BASE}/persons/${encodeURIComponent(personId)}/primary-chart`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chart_id: chartId }),
        });
        if (!res.ok) throw new Error(t('common.errorGeneric'));
        await loadProfile();
        showToast(t('page.clients.messages.updated'), 'success');
    } catch (error) {
        showToast(error.message || t('common.errorGeneric'), 'error');
    }
}

async function unlinkChart(chartId) {
    if (!currentPersonId || !chartId) return;
    try {
        const res = await apiFetch(`${API_BASE}/persons/${currentPersonId}/charts/${chartId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        linkedChartIds.delete(String(chartId));
        await loadAndRenderLinkedCharts(currentPersonId);
        showToast(t('page.clientProfile.linkedCharts.unlinkedToast'), 'success');
    } catch (_) {
        showToast(t('common.errorGeneric'), 'error');
    }
}

async function openLinkChartDialog() {
    if (!currentPersonId) return;
    refs.linkChartBackdrop?.classList.remove('hidden');
    refs.linkChartDialog?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    if (refs.linkChartSearch) refs.linkChartSearch.value = '';
    refs.linkChartError?.classList.add('hidden');

    if (!allChartsCache) {
        refs.linkChartPickerLoading?.classList.remove('hidden');
        refs.linkChartPickerEmpty?.classList.add('hidden');
        refs.linkChartPickerList && (refs.linkChartPickerList.innerHTML = '');
        try {
            const res = await apiFetch(`${API_BASE}/charts`);
            allChartsCache = res.ok ? await res.json() : [];
        } catch (_) {
            allChartsCache = [];
        }
        refs.linkChartPickerLoading?.classList.add('hidden');
    }

    renderLinkChartPickerList();
}

function closeLinkChartDialog() {
    refs.linkChartBackdrop?.classList.add('hidden');
    refs.linkChartDialog?.classList.add('hidden');
    document.body.style.overflow = '';
}

function renderLinkChartPickerList() {
    if (!refs.linkChartPickerList || !allChartsCache) return;
    const q = (refs.linkChartSearch?.value || '').trim().toLowerCase();
    const filtered = allChartsCache.filter((c) => {
        if (!q) return true;
        const haystack = [c.display_title, c.location_name, c.first_name, c.last_name]
            .filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
    });

    if (!filtered.length) {
        refs.linkChartPickerEmpty?.classList.remove('hidden');
        refs.linkChartPickerList.innerHTML = '';
        return;
    }
    refs.linkChartPickerEmpty?.classList.add('hidden');

    refs.linkChartPickerList.innerHTML = filtered.map((c) => {
        const chartId = String(c.chart_id || c.user_id);
        const already = linkedChartIds.has(chartId);
        const date = c.date ? formatDate(c.date) : '';
        const meta = [date, c.location_name].filter(Boolean).join(' · ');
        return `<div class="profile-picker-item${already ? ' is-linked' : ''}" data-chart-id="${escapeHtml(chartId)}">
            <div class="profile-picker-item-info">
                <span class="profile-picker-item-title">${escapeHtml(c.display_title)}</span>
                ${meta ? `<span class="profile-picker-item-meta">${escapeHtml(meta)}</span>` : ''}
            </div>
            <button class="btn-new btn-sm" type="button" ${already ? 'disabled' : ''} data-action="link-chart" data-chart-id="${escapeHtml(chartId)}">
                ${already ? escapeHtml(t('page.clientProfile.linkedCharts.alreadyLinked')) : escapeHtml(t('page.clientProfile.linkedCharts.linkAction'))}
            </button>
        </div>`;
    }).join('');

    refs.linkChartPickerList.querySelectorAll('[data-action="link-chart"]').forEach((btn) => {
        btn.addEventListener('click', () => linkChart(btn.dataset.chartId, btn));
    });
}

async function linkChart(chartId, btn) {
    if (!currentPersonId || !chartId || btn?.disabled) return;
    btn && (btn.disabled = true);
    refs.linkChartError?.classList.add('hidden');
    try {
        const res = await apiFetch(`${API_BASE}/persons/${currentPersonId}/charts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chart_id: chartId }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || t('common.errorGeneric'));
        }
        linkedChartIds.add(String(chartId));
        closeLinkChartDialog();
        await loadAndRenderLinkedCharts(currentPersonId);
        showToast(t('page.clientProfile.linkedCharts.linkedToast'), 'success');
    } catch (err) {
        if (refs.linkChartError) {
            refs.linkChartError.textContent = err.message;
            refs.linkChartError.classList.remove('hidden');
        }
        btn && (btn.disabled = false);
    }
}

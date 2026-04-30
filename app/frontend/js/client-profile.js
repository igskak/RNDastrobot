/**
 * Client profile page — /client/{userId}
 */

const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:8000/api/v1'
    : '/api/v1';

// Extract userId from URL: /client/{userId}
const userId = window.location.pathname.split('/')[2] || '';

let profileData = null;   // full server response
let relatedPeople = [];
let consultationFilter = 'all';
let toastTimer = null;
let relatedPeoplePicker = null;

const refs = {};

const editClientState = {
    autocompleteBound: false,
    mode: 'edit-client',
    userId: null,
    loadedChartData: null,
    originalCoords: null,
    selectedCoords: null,
    originalPlace: '',
    selectedPlaceLabel: '',
};

const logSessionState = { userId: null };
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

/* ─── Utilities ─────────────────────────────────────────────────────────── */

function apiFetch(url, init = {}) {
    return fetch(url, {
        credentials: 'include',
        ...init,
        headers: withLocaleHeaders(init.headers || {}),
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
}

function formatDate(isoDate) {
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

/* ─── Bootstrap ─────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {
    await waitForI18nReady();
    cacheElements();

    if (!userId) {
        showError(t('page.clientProfile.errors.noId'));
        return;
    }

    const astrologer = await window.AstroAPI?.requireAuth?.({ redirectTo: '/login.html' });
    if (!astrologer) return;

    initEditClientDialog();
    initLogSessionDialog();
    initRelatedPeoplePicker();
    bindPageEvents();
    await loadProfile();
});

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
    refs.openForecastBtn = document.getElementById('openForecastBtn');
    refs.startCallBtn   = document.getElementById('startCallBtn');
    refs.editClientBtn  = document.getElementById('editClientBtn');

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
    refs.openForecastBtn?.addEventListener('click', () => openForecast());
    refs.startCallBtn?.addEventListener('click', startCallSession);
    refs.editClientBtn?.addEventListener('click', () => openEditClientDialog(userId));
    refs.logSessionBtn?.addEventListener('click', () => openLogSessionDialog(userId));
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
            openSynastry(synastryBtn.dataset.relatedUserId);
            return;
        }

        const profileBtn = e.target.closest('[data-action="open-related-profile"]');
        if (profileBtn) {
            window.location.href = `/client/${encodeURIComponent(profileBtn.dataset.relatedUserId)}`;
            return;
        }

        const deleteBtn = e.target.closest('[data-action="delete-related-person"]');
        if (deleteBtn) {
            await deleteRelatedPerson(deleteBtn.dataset.relatedUserId);
        }
    });

    document.addEventListener('frontend:locale-changed', () => {
        if (profileData) renderAll(profileData);
        relatedPeoplePicker?.refreshLocale?.();
    });
}

/* ─── Load & render ─────────────────────────────────────────────────────── */

async function loadProfile() {
    try {
        const [profileRes, relatedPeoplePayload] = await Promise.all([
            apiFetch(`${API_BASE}/users/${userId}/profile`),
            window.AstroAPI.getRelatedPeople(userId).catch(() => []),
        ]);

        if (profileRes.status === 401) { window.location.href = '/login.html'; return; }
        if (profileRes.status === 404) { showError(t('page.clientProfile.errors.notFound')); return; }
        if (!profileRes.ok) throw new Error(t('page.clientProfile.errors.loadFailed'));

        profileData = await profileRes.json();
        relatedPeople = Array.isArray(relatedPeoplePayload) ? relatedPeoplePayload : [];
        renderAll(profileData);

        refs.profileMain.classList.remove('hidden');
        refs.pageLoader?.classList.add('hidden');
    } catch (err) {
        showError(err.message);
    }
}

function showError(msg) {
    refs.pageLoader?.classList.add('hidden');
    refs.profileErrorMsg.textContent = msg;
    refs.profileError.classList.remove('hidden');
}

function renderAll(data) {
    renderHeader(data.user);
    renderContact(data.user);
    renderStats(data.stats);
    renderRelatedPeople(relatedPeople);
    renderInsights(data.aggregated_key_points);
    renderConsultations();
    renderRecordings(data.call_sessions);
}

/* ─── Header ─────────────────────────────────────────────────────────────── */

function renderHeader(user) {
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || t('common.notAvailable');
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
                        ${person.relation_label ? `<span class="profile-related-badge">${escapeHtml(person.relation_label)}</span>` : ''}
                    </div>
                    <p class="profile-related-meta">${escapeHtml(details.join(' · ') || t('common.notAvailable'))}</p>
                    ${person.relation_notes ? `<p class="profile-related-notes">${escapeHtml(person.relation_notes)}</p>` : ''}
                </div>
                <div class="profile-related-actions">
                    <button class="btn-new btn-sm" type="button" data-action="open-synastry" data-related-user-id="${escapeHtml(person.user_id)}">${escapeHtml(t('page.clients.consultation.types.synastry'))}</button>
                    <button class="btn-logout btn-sm" type="button" data-action="open-related-profile" data-related-user-id="${escapeHtml(person.user_id)}">${escapeHtml(t('page.clientProfile.viewProfile'))}</button>
                    <button class="btn-logout btn-sm" type="button" data-action="delete-related-person" data-related-user-id="${escapeHtml(person.user_id)}">${escapeHtml(t('page.clients.actions.delete'))}</button>
                </div>
            </article>
        `;
    }).join('');
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
        getCurrentUserId: () => userId,
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

const CS_STATUS_LABELS = {
    created:    { label: 'Scheduled',   cls: 'cs-status--created'    },
    active:     { label: 'In progress', cls: 'cs-status--active'     },
    ended:      { label: 'Ended',       cls: 'cs-status--ended'      },
    processing: { label: 'Processing…', cls: 'cs-status--processing' },
    completed:  { label: 'Completed',   cls: 'cs-status--completed'  },
    failed:     { label: 'Failed',      cls: 'cs-status--failed'     },
};

function renderRecordings(sessions) {
    if (!sessions || sessions.length === 0) {
        refs.recordingsList.innerHTML = '';
        refs.recordingsEmpty.classList.remove('hidden');
        return;
    }
    refs.recordingsEmpty.classList.add('hidden');

    refs.recordingsList.innerHTML = sessions.map((cs) => {
        const st = CS_STATUS_LABELS[cs.call_status] || { label: cs.call_status, cls: '' };
        const dateStr = cs.started_at
            ? new Date(cs.started_at + 'Z').toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
            : (cs.created_at ? new Date(cs.created_at + 'Z').toLocaleDateString() : '—');
        const dur = cs.duration_seconds ? formatDuration(cs.duration_seconds) : '';
        const isExpandable = cs.call_status === 'completed';
        const expandIcon = isExpandable
            ? `<svg class="cs-expand-icon" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
            : '';
        const spinner = cs.call_status === 'processing' ? `<span class="cs-spinner"></span>` : '';

        return `
            <div class="cs-row${isExpandable ? ' cs-row--expandable' : ''}" data-session-id="${escapeHtml(cs.id)}">
                <span class="cs-date">${escapeHtml(dateStr)}</span>
                ${dur ? `<span class="cs-duration">${escapeHtml(dur)}</span>` : '<span class="cs-duration"></span>'}
                <span class="cs-status ${st.cls}">${spinner}${escapeHtml(st.label)}</span>
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
                const s = CS_STATUS_LABELS[cs.call_status];
                if (s) { badge.className = `cs-status ${s.cls}`; badge.textContent = s.label; }
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
            <p class="cs-panel-error">Processing failed.</p>
            ${errMsg}
            <button class="btn-new btn-sm cs-retry-btn" data-session-id="${escapeHtml(sessionId)}">Retry processing</button>
        </div>`;
    }

    let html = '';

    if (audioUrl) {
        html += `<div class="cs-audio-wrap">
            <audio class="cs-audio-player" controls preload="none" src="${escapeHtml(audioUrl)}">
                Your browser doesn't support audio playback.
            </audio>
        </div>`;
    }

    if (cs?.summary_text) {
        html += `<div class="cs-summary">
            <h5 class="cs-section-title">Summary</h5>
            <p class="cs-summary-text">${escapeHtml(cs.summary_text)}</p>
        </div>`;
    }

    if (cs?.key_points?.length) {
        const items = cs.key_points.map((p) => {
            const text = typeof p === 'string' ? p : (p.detail || p.topic || '');
            return `<li>${escapeHtml(text)}</li>`;
        }).join('');
        html += `<div class="cs-key-points">
            <h5 class="cs-section-title">Key points</h5>
            <ul class="cs-key-points-list">${items}</ul>
        </div>`;
    }

    if (cs?.transcript_segments?.length) {
        const segs = cs.transcript_segments.map((seg) => {
            const speakerLabel = seg.speaker === 'A' ? 'Astrologer' : 'Client';
            const cls = seg.speaker === 'A' ? 'cs-seg--astrologer' : 'cs-seg--client';
            return `<div class="cs-segment ${cls}">
                <span class="cs-seg-speaker">${escapeHtml(speakerLabel)}</span>
                <span class="cs-seg-text">${escapeHtml(seg.text)}</span>
            </div>`;
        }).join('');
        html += `<details class="cs-transcript-details">
            <summary class="cs-transcript-toggle">Full transcript</summary>
            <div class="cs-transcript">${segs}</div>
        </details>`;
    } else if (cs?.transcript_text) {
        html += `<details class="cs-transcript-details">
            <summary class="cs-transcript-toggle">Full transcript</summary>
            <p class="cs-transcript-plain">${escapeHtml(cs.transcript_text)}</p>
        </details>`;
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

async function openChart() {
    try {
        const res = await apiFetch(`${API_BASE}/natal/${userId}`);
        if (!res.ok) throw new Error(t('page.clients.errors.chartNotFound'));
        const chartData = await res.json();
        window.AstroAPI.saveChartToSession(chartData);
        window.AstroAPI.saveFormData(window.AstroAPI.chartToFormData(chartData));
        window.AstroAPI.saveNavigationState?.({
            sourceView: 'client-profile',
            sourceUrl: window.AstroAPI.buildClientProfileUrl?.(userId) || `/client/${encodeURIComponent(userId)}`,
            clientUserId: String(userId),
            partnerUserId: null,
        });
        window.showPageLoader?.();
        window.location.href = '/chart.html';
    } catch (err) {
        showToast(t('common.errorWithMessage', { message: err.message }), 'error');
    }
}

async function openForecast() {
    try {
        const res = await apiFetch(`${API_BASE}/natal/${userId}`);
        if (!res.ok) throw new Error(t('page.clients.errors.chartNotFound'));
        const chartData = await res.json();
        window.AstroAPI.saveChartToSession(chartData);
        window.AstroAPI.saveFormData(window.AstroAPI.chartToFormData(chartData));
        window.AstroAPI.saveNavigationState?.({
            sourceView: 'client-profile',
            sourceUrl: window.AstroAPI.buildClientProfileUrl?.(userId) || `/client/${encodeURIComponent(userId)}`,
            clientUserId: String(userId),
            partnerUserId: null,
        });
        window.showPageLoader?.();
        window.location.href = '/forecast-new.html';
    } catch (err) {
        showToast(t('common.errorWithMessage', { message: err.message }), 'error');
    }
}

function openSynastry(relatedUserId) {
    if (!relatedUserId) return;
    window.AstroAPI.saveNavigationState?.({
        sourceView: 'client-profile',
        sourceUrl: window.AstroAPI.buildClientProfileUrl?.(userId) || `/client/${encodeURIComponent(userId)}`,
        clientUserId: String(userId),
        partnerUserId: String(relatedUserId),
    });
    window.showPageLoader?.();
    window.location.href = window.AstroAPI.buildSynastryUrl?.(userId, relatedUserId)
        || `/synastry.html?client=${encodeURIComponent(userId)}&partner=${encodeURIComponent(relatedUserId)}`;
}

async function startCallSession() {
    refs.startCallBtn.disabled = true;
    const origHtml = refs.startCallBtn.innerHTML;
    refs.startCallBtn.textContent = 'Starting…';
    try {
        const res = await apiFetch(`${API_BASE}/call-sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId }),
        });
        if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            throw new Error(d.detail || 'Failed to create call session');
        }
        const session = await res.json();
        const joinParam = session.join_url ? `&join_url=${encodeURIComponent(session.join_url)}` : '';
        window.location.href = `/consultation-call.html?session_id=${session.id}&user_id=${userId}${joinParam}`;
    } catch (err) {
        showToast(err.message || 'Could not start call', 'error');
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

async function openEditClientDialog(uid) {
    if (!uid) return;
    try {
        setEditDialogMode('edit-client');
        const res = await apiFetch(`${API_BASE}/natal/${uid}`);
        if (!res.ok) throw new Error(t('page.clients.edit.errors.loadFailed'));

        const chartData = await res.json();
        const formData = window.AstroAPI.chartToFormData(chartData);
        const place = String(formData.place || '').trim();
        const latitude = formData.latitude == null ? Number.NaN : Number(formData.latitude);
        const longitude = formData.longitude == null ? Number.NaN : Number(formData.longitude);

        editClientState.userId = uid;
        editClientState.loadedChartData = chartData;
        editClientState.originalCoords = { lat: latitude, lon: longitude };
        editClientState.selectedCoords = { lat: latitude, lon: longitude };
        editClientState.originalPlace = normalizeLooseText(place);
        editClientState.selectedPlaceLabel = normalizeLooseText(place);

        refs.editFirstName.value = formData.firstName || '';
        refs.editLastName.value  = formData.lastName || '';
        refs.editDay.value       = formData.day || '';
        refs.editMonth.value     = formData.month || '';
        refs.editYear.value      = formData.year || '';
        refs.editHour.value      = formData.hour || '';
        refs.editMinute.value    = formData.minute || '';
        refs.editPlaceInput.value = place;

        const user = profileData?.user;
        if (refs.editEmail)    refs.editEmail.value    = user?.email    || '';
        if (refs.editPhone)    refs.editPhone.value    = user?.phone    || '';
        if (refs.editMessenger) refs.editMessenger.value = user?.messenger || '';
        if (refs.editTags)     refs.editTags.value     = Array.isArray(user?.tags) ? user.tags.join(', ') : '';
        if (refs.editNotes)    refs.editNotes.value    = user?.notes    || '';
        if (refs.editRelationLabel) refs.editRelationLabel.value = '';

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
    } catch (err) {
        showToast(t('common.errorWithMessage', { message: err.message }), 'error');
    }
}

function openCreateRelatedPersonDialog() {
    setEditDialogMode('create-related');
    editClientState.userId = null;
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
    editClientState.userId = null;
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
    if (editClientState.mode !== 'create-related' && !editClientState.userId) {
        refs.editError.textContent = t('page.clients.edit.errors.chartUnavailable');
        refs.editError.classList.remove('hidden');
        return;
    }

    const place = refs.editPlaceInput.value.trim();
    const tagsRaw = (refs.editTags?.value || '').trim();
    const tags = tagsRaw ? tagsRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const requestData = {
        first_name: refs.editFirstName.value.trim(),
        last_name:  refs.editLastName.value.trim(),
        date: window.AstroAPI.formatDate(refs.editDay.value, refs.editMonth.value, refs.editYear.value),
        time: window.AstroAPI.formatTime(refs.editHour.value, refs.editMinute.value),
        timezone: refs.editTimezone.value,
        place,
        house_system: editClientState.loadedChartData?.birth_data?.house_system || 'P',
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
        requestData.latitude = lat;
        requestData.longitude = lon;
    }

    refs.editError.classList.add('hidden');
    refs.editError.textContent = '';
    setEditClientSubmitting(true);

    try {
        const submitMode = editClientState.mode;
        if (editClientState.mode === 'create-related') {
            await window.AstroAPI.createRelatedPerson(userId, {
                ...requestData,
                relation_label: refs.editRelationLabel?.value?.trim() || '',
            });
        } else {
            await window.AstroAPI.updateClientChart(editClientState.userId, requestData);
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

async function deleteRelatedPerson(relatedUserId) {
    if (!relatedUserId) return;
    if (!window.confirm(t('page.clientProfile.related.confirmDelete'))) return;

    try {
        await window.AstroAPI.deleteRelatedPerson(userId, relatedUserId);
        showToast(t('page.clientProfile.related.deleted'), 'success');
        await loadProfile();
    } catch (err) {
        showToast(t('common.errorWithMessage', { message: err.message }), 'error');
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

function openLogSessionDialog(uid) {
    logSessionState.userId = uid;
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
    logSessionState.userId = null;
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

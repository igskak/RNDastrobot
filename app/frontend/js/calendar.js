/**
 * Calendar page — consultation schedule view using FullCalendar
 */

const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:8000/api/v1'
    : '/api/v1';

const STATUS_COLORS = {
    planned:   '#1E3A5F',
    completed: '#2B7A4B',
    cancelled: '#9B9289',
    no_show:   '#B83232',
};

let currentAstrologer = null;
let calendar = null;
let toastTimer = null;

const refs = {};

function t(key, params, fallback = key) {
    return window.FrontendI18n?.t?.(key, params) || fallback;
}

function apiFetch(url, init = {}) {
    return fetch(url, {
        ...init,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(window.AstroAPI?.withLocaleHeaders?.({}) || {}),
            ...(init.headers || {}),
        },
    });
}

// ── Toast ────────────────────────────────────────────────

function showToast(msg, type = 'success') {
    if (!refs.toast) return;
    refs.toast.textContent = msg;
    refs.toast.className = `toast toast--${type} toast--visible`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { refs.toast.className = 'toast'; }, 3500);
}

// ── Log Session Dialog ───────────────────────────────────

async function loadClientsForSelect() {
    if (!refs.logSessionClient) return;
    try {
        const res = await apiFetch(`${API_BASE}/users`);
        if (!res.ok) return;
        const users = await res.json();
        refs.logSessionClient.innerHTML = '';
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = t('page.calendar.dialog.selectClient', null, 'Select client');
        refs.logSessionClient.appendChild(defaultOption);
        for (const u of users) {
            const name = [u.first_name, u.last_name].filter(Boolean).join(' ')
                || t('page.calendar.clientUnnamed', null, 'Unnamed');
            const opt = document.createElement('option');
            opt.value = u.user_id;
            opt.textContent = name;
            refs.logSessionClient.appendChild(opt);
        }
    } catch (_) { /* silently ignore */ }
}

function openLogSessionDialog(date = null) {
    if (!refs.logSessionDialog) return;
    if (refs.logSessionForm) refs.logSessionForm.reset();
    if (refs.logSessionStatus) refs.logSessionStatus.value = 'planned';

    if (date && refs.logSessionDate) {
        const pad = (n) => String(n).padStart(2, '0');
        refs.logSessionDate.value =
            `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
            `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    refs.logSessionDialog.classList.remove('hidden');
    refs.logSessionBackdrop.classList.remove('hidden');
    loadClientsForSelect();
}

function closeLogSessionDialog() {
    refs.logSessionDialog?.classList.add('hidden');
    refs.logSessionBackdrop?.classList.add('hidden');
    if (refs.logSessionError) refs.logSessionError.classList.add('hidden');
}

async function handleLogSessionSubmit(event) {
    event.preventDefault();

    const userId = refs.logSessionClient?.value;
    if (!userId) {
        if (refs.logSessionError) {
            refs.logSessionError.textContent = t('page.calendar.errors.selectClient', null, 'Please select a client.');
            refs.logSessionError.classList.remove('hidden');
        }
        return;
    }
    if (refs.logSessionError) refs.logSessionError.classList.add('hidden');

    const scheduledAt = refs.logSessionDate?.value
        ? new Date(refs.logSessionDate.value).toISOString()
        : null;

    const payload = {
        user_id: userId,
        consultation_type: refs.logSessionType?.value || 'natal',
        scheduled_at: scheduledAt,
        status: refs.logSessionStatus?.value || 'planned',
        is_paid: refs.logSessionPaid?.checked || false,
        duration_minutes: refs.logSessionDuration?.value
            ? parseInt(refs.logSessionDuration.value, 10)
            : null,
        notes: refs.logSessionNotes?.value?.trim() || null,
    };

    const btnText   = refs.logSessionSubmit?.querySelector('.btn-text');
    const btnLoader = refs.logSessionSubmit?.querySelector('.btn-loader');
    if (btnText)   btnText.classList.add('hidden');
    if (btnLoader) btnLoader.classList.remove('hidden');
    if (refs.logSessionSubmit) refs.logSessionSubmit.disabled = true;

    try {
        const res = await apiFetch(`${API_BASE}/consultations`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || t('page.clients.consultation.errors.saveFailed', null, 'Failed to save consultation'));
        }

        closeLogSessionDialog();
        showToast(t('page.calendar.messages.consultationSaved', null, 'Consultation saved'));
        calendar?.refetchEvents();
    } catch (e) {
        if (refs.logSessionError) {
            refs.logSessionError.textContent = e.message || t('page.clients.consultation.errors.saveFailed', null, 'Error saving consultation');
            refs.logSessionError.classList.remove('hidden');
        }
    } finally {
        if (btnText)   btnText.classList.remove('hidden');
        if (btnLoader) btnLoader.classList.add('hidden');
        if (refs.logSessionSubmit) refs.logSessionSubmit.disabled = false;
    }
}

// ── FullCalendar init ────────────────────────────────────

function initCalendar(options = {}) {
    const el = document.getElementById('calendar');
    if (!el || !window.FullCalendar) return;

    // Support deep-link from mini calendar: ?date=YYYY-MM-DD&view=timeGridDay
    const params  = new URLSearchParams(window.location.search);
    const initDate = options.initialDate || params.get('date') || undefined;
    const initView = options.initialView || params.get('view') || 'dayGridMonth';

    if (calendar) {
        calendar.destroy();
        calendar = null;
    }

    calendar = new window.FullCalendar.Calendar(el, {
        initialView: initView,
        initialDate: initDate,
        locale: window.FrontendI18n?.getLocale?.() || 'en',
        headerToolbar: {
            left:   'prev,next today',
            center: 'title',
            right:  'dayGridMonth,timeGridWeek,timeGridDay',
        },
        height:    'auto',
        firstDay:  1,
        buttonText: {
            today: t('page.calendar.view.today', null, 'Today'),
            month: t('page.calendar.view.month', null, 'Month'),
            week:  t('page.calendar.view.week', null, 'Week'),
            day:   t('page.calendar.view.day', null, 'Day'),
        },
        nowIndicator: true,

        events: async function (info, successCallback, failureCallback) {
            try {
                const params = new URLSearchParams({ start: info.startStr, end: info.endStr });
                const res = await apiFetch(`${API_BASE}/consultations/calendar?${params}`);
                if (!res.ok) throw new Error(t('page.calendar.errors.loadEvents', null, 'Failed to load events'));
                const events = await res.json();

                successCallback(events.map(e => ({
                    ...e,
                    backgroundColor: STATUS_COLORS[e.extendedProps?.status] ?? STATUS_COLORS.planned,
                    borderColor:     'transparent',
                    textColor:       '#fff',
                })));
            } catch (err) {
                failureCallback(err);
            }
        },

        eventClick: function (info) {
            // Navigate to clients page highlighting the relevant client
            window.location.href = `/?highlight=${info.event.extendedProps.userId}`;
        },

        dateClick: function (info) {
            openLogSessionDialog(info.date);
        },

        eventDidMount: function (info) {
            const p = info.event.extendedProps;
            const statusText = p.status
                ? t(`page.clients.consultation.statuses.${p.status}`, null, String(p.status).replace('_', ' '))
                : '';
            const paidText = p.isPaid
                ? `· ${t('page.clients.detail.paidBadge', null, 'Paid')}`
                : `· ${t('page.clients.detail.unpaidBadge', null, 'Unpaid')}`;
            info.el.title = `${info.event.title}\n${statusText} ${paidText}`;
        },
    });

    calendar.render();
}

// ── Page bootstrap ───────────────────────────────────────

function bindRefs() {
    refs.toast               = document.getElementById('toast');
    refs.welcomeLabel        = document.getElementById('welcomeLabel');
    refs.logoutBtn           = document.getElementById('logoutBtn');
    refs.logSessionDialog    = document.getElementById('logSessionDialog');
    refs.logSessionBackdrop  = document.getElementById('logSessionBackdrop');
    refs.logSessionForm      = document.getElementById('logSessionForm');
    refs.logSessionClient    = document.getElementById('logSessionClient');
    refs.logSessionType      = document.getElementById('logSessionType');
    refs.logSessionDate      = document.getElementById('logSessionDate');
    refs.logSessionStatus    = document.getElementById('logSessionStatus');
    refs.logSessionDuration  = document.getElementById('logSessionDuration');
    refs.logSessionPaid      = document.getElementById('logSessionPaid');
    refs.logSessionNotes     = document.getElementById('logSessionNotes');
    refs.logSessionSubmit    = document.getElementById('logSessionSubmit');
    refs.logSessionError     = document.getElementById('logSessionError');
}

function bindEvents() {
    // Back arrow is navigation ("previous page"), not "always home". Resolve from
    // the referrer / navigation breadcrumb, excluding a self-referencing calendar URL.
    const backLink = document.querySelector('.calendar-back');
    if (backLink) {
        backLink.href = window.AstroAPI?.resolveBackUrl?.({
            excludePattern: /\/calendar(\.html)?(\?|#|$)/,
            fallback: '/',
        }) || '/';
    }

    refs.logoutBtn?.addEventListener('click', async () => {
        await window.AstroAPI?.logout?.();
        window.location.href = '/login.html';
    });

    refs.logSessionForm?.addEventListener('submit', handleLogSessionSubmit);
    refs.logSessionBackdrop?.addEventListener('click', closeLogSessionDialog);
    document.getElementById('logSessionClose')?.addEventListener('click', closeLogSessionDialog);
    document.getElementById('logSessionCancel')?.addEventListener('click', closeLogSessionDialog);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLogSessionDialog();
    });

    document.addEventListener('frontend:locale-changed', () => {
        const currentDate = calendar?.getDate?.() || undefined;
        const currentView = calendar?.view?.type || undefined;
        initCalendar({ initialDate: currentDate, initialView: currentView });

        const defaultOption = refs.logSessionClient?.querySelector('option[value=""]');
        if (defaultOption) {
            defaultOption.textContent = t('page.calendar.dialog.selectClient', null, 'Select client');
        }
    });
}

async function bootstrapPage(i18nReady) {
    const authReady = Promise.resolve(
        window.AstroAPI?.requireAuth?.({ redirectTo: '/login.html' })
    );
    currentAstrologer = await authReady;

    if (currentAstrologer) {
        const label = [currentAstrologer.first_name, currentAstrologer.last_name]
            .filter(Boolean).join(' ') || currentAstrologer.email || '';
        if (refs.welcomeLabel) refs.welcomeLabel.textContent = label;
    }

    // initCalendar использует t() для кнопок — ждём локаль (calendar и так
    // переинициализируется на frontend:locale-changed, но избегаем двойного рендера).
    await Promise.resolve(i18nReady);
    initCalendar();

    if (window.AstroAPI?.hidePageLoader) {
        window.AstroAPI.hidePageLoader();
    } else {
        const loader = document.getElementById('pageLoader');
        if (loader) loader.classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Каталог локали и auth независимы — стартуем параллельно, а не цепочкой.
    const i18nReady = Promise.resolve(window.FrontendI18n?.ready).catch(() => {});
    bindRefs();
    bindEvents();
    bootstrapPage(i18nReady);
});

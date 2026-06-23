/**
 * Consultation detail page — review / edit / share the v1 summary for a call session.
 * Route: /consultation/{sessionId}
 */
const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:8000/api/v1'
    : '/api/v1';

const KP_CATEGORY_ORDER = [
    'client_question', 'life_context', 'astrological_focus',
    'guidance_given', 'decision_or_plan', 'follow_up', 'sensitive',
];

const state = {
    sessionId: null,
    userId: null,
    cs: null,
    reportDirty: false,
};

function t(key, params) {
    return window.FrontendI18n?.t?.(key, params) || key;
}
function withLocaleHeaders(headers = {}) {
    return window.AstroAPI?.withLocaleHeaders ? window.AstroAPI.withLocaleHeaders(headers) : headers;
}
function apiFetch(url, init = {}) {
    return fetch(url, { credentials: 'include', ...init, headers: withLocaleHeaders(init.headers || {}) });
}
function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

function formatConsultDateTime(value) {
    if (!value) return '';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return String(value);
    if (window.LocaleFormatters?.formatDateTime) {
        return window.LocaleFormatters.formatDateTime(dt);
    }
    return dt.toLocaleString();
}
function enumLabel(ns, value) {
    if (!value) return '';
    const key = `page.consultation.${ns}.${value}`;
    const out = t(key);
    return out === key ? value : out;  // fall back to raw value if no translation
}

let toastTimer = null;
function showToast(msg, kind = '') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = `toast visible ${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, 2600);
}

function sessionIdFromPath() {
    const m = window.location.pathname.match(/\/consultation\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
}

document.addEventListener('DOMContentLoaded', init);

async function init() {
    state.sessionId = sessionIdFromPath();
    const back = document.getElementById('backLink');
    if (back) back.addEventListener('click', (e) => { e.preventDefault(); goBack(); });

    window.addEventListener('beforeunload', (e) => {
        if (state.reportDirty) { e.preventDefault(); e.returnValue = ''; }
    });

    if (!state.sessionId) { renderError(t('page.consultation.notFound')); return; }

    // Hydrate account visual preferences (e.g. date format) so rendered dates
    // honor the astrologer's settings instead of falling back to defaults.
    if (window.AstroAPI?.getAccountPreferences) {
        try {
            window.accountPreferencesCache = await window.AstroAPI.getAccountPreferences();
            window.AstroPreferences?.setAccountVisualPreferences?.(window.accountPreferencesCache?.visual || {});
        } catch (error) {
            console.warn('Consultation account preferences fallback to defaults:', error);
        }
    }

    await load();
    document.getElementById('pageLoader')?.classList.add('hidden');
}

function goBack() {
    if (state.userId) window.location.href = `/client/${encodeURIComponent(state.userId)}`;
    else window.history.back();
}

const SUPPORTED_LOCALES = ['en', 'uk', 'ru'];

async function load() {
    try {
        const res = await apiFetch(`${API_BASE}/call-sessions/${state.sessionId}`);
        if (res.status === 404) { renderError(t('page.consultation.notFound')); return; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        state.cs = await res.json();
        state.userId = state.cs.user_id;
        // A consultation is an output document: render its labels in the language the
        // call was conducted in, not the astrologer's global UI locale. persist:false
        // so this never overwrites the astrologer's own language preference.
        const callLang = state.cs.summary_json?.session?.language;
        if (callLang && SUPPORTED_LOCALES.includes(callLang) && window.FrontendI18n?.setLocale) {
            try {
                await window.FrontendI18n.setLocale(callLang, { persist: false, source: 'consultation-language' });
            } catch (_) { /* fall back to current locale */ }
        }
        render();
    } catch (err) {
        renderError(err.message);
    }
}

function renderError(msg) {
    document.getElementById('pageLoader')?.classList.add('hidden');
    document.getElementById('consultRoot').innerHTML =
        `<div class="consult-card"><p class="consult-empty">${escapeHtml(msg)}</p></div>`;
}

function render() {
    const cs = state.cs;
    const sj = cs.summary_json;
    const root = document.getElementById('consultRoot');

    const dateStr = cs.started_at
        ? formatConsultDateTime(`${cs.started_at}Z`)
        : (cs.created_at ? formatConsultDateTime(`${cs.created_at}Z`) : '');

    let html = '';

    // Header
    const types = (sj?.session?.consultation_types || [])
        .map((c) => `<span class="consult-type-chip">${escapeHtml(enumLabel('consultationType', c))}</span>`).join('');
    const meta = `${dateStr}${cs.client_name ? ` · ${cs.client_name}` : ''}`;
    html += `<div class="consult-head">
        <div class="consult-head-main">
            <h1 class="consult-title">${escapeHtml(t('page.consultation.title'))}</h1>
            <span class="consult-meta">${escapeHtml(meta)}</span>
        </div>
        <span class="consult-types">${types}</span>
    </div>`;

    let primaryHtml = '';
    let sideHtml = '';

    if (cs.call_status === 'summary_failed') {
        primaryHtml += `<div class="consult-card consult-card-status">
            <p class="consult-empty">${escapeHtml(t('page.consultation.summaryFailed'))}</p>
            ${cs.summary_error ? `<p class="consult-empty">${escapeHtml(cs.summary_error)}</p>` : ''}
        </div>`;
    } else if (!sj) {
        // Legacy row (pre-v1): render old shape read-only.
        primaryHtml += renderLegacy(cs);
    } else {
        primaryHtml += renderInternalSummary(sj);
        primaryHtml += renderClientReport(cs, sj);
        sideHtml += renderKeyPoints(sj.key_points || []);
        sideHtml += renderOpenQuestions(sj.open_questions_or_unclear_items || []);
    }

    // Client memory (history) — always show, it's client-level
    sideHtml += `<div class="consult-card consult-card-memory">
        <div class="consult-card-title"><span>${escapeHtml(t('page.consultation.memory.title'))}</span></div>
        <div id="memList" class="mem-list"><div class="consult-loading"><span class="consult-spinner"></span></div></div>
    </div>`;

    html += `<div class="consult-detail-grid">
        <div class="consult-column consult-column-main">${primaryHtml}</div>
        <div class="consult-column consult-column-side">${sideHtml}</div>
    </div>`;

    root.innerHTML = html;
    wireReport();
    loadMemory();
}

function renderLegacy(cs) {
    let h = `<div class="consult-card consult-card-summary"><div class="consult-card-title"><span>${escapeHtml(t('page.consultation.summary.title'))}</span></div>`;
    h += cs.summary_text
        ? `<p class="consult-text">${escapeHtml(cs.summary_text)}</p>`
        : `<p class="consult-empty">${escapeHtml(t('page.consultation.legacy'))}</p>`;
    h += `</div>`;
    if (cs.client_facing_summary) {
        h += `<div class="consult-card consult-card-report"><div class="consult-card-title"><span>${escapeHtml(t('page.consultation.report.title'))}</span></div>
            <p class="consult-text">${escapeHtml(cs.client_facing_summary)}</p></div>`;
    }
    return h;
}

function renderInternalSummary(sj) {
    const ss = sj.session_summary || {};
    return `<div class="consult-card consult-card-summary">
        <div class="consult-card-title"><span>${escapeHtml(t('page.consultation.summary.title'))}</span></div>
        <p class="consult-text">${escapeHtml(ss.brief || '')}</p>
        ${ss.detailed ? `<details><summary class="consult-detail-toggle">${escapeHtml(t('page.consultation.summary.showDetailed'))}</summary>
            <p class="consult-text consult-text-detail">${escapeHtml(ss.detailed)}</p></details>` : ''}
    </div>`;
}

function renderClientReport(cs, sj) {
    const text = cs.client_report_edited != null
        ? cs.client_report_edited
        : (sj.client_facing_report?.text || '');
    const sharedNote = cs.client_report_shared_at
        ? `<span class="consult-shared-note">${escapeHtml(t('page.consultation.report.sharedAt'))} ${escapeHtml(formatConsultDateTime(`${cs.client_report_shared_at}Z`))}</span>`
        : '';
    return `<div class="consult-card consult-card-report">
        <div class="consult-card-title">
            <span>${escapeHtml(t('page.consultation.report.title'))}</span>
            <span class="consult-review-badge">${escapeHtml(t('page.consultation.report.reviewRequired'))}</span>
        </div>
        <textarea class="consult-report-area" id="reportArea">${escapeHtml(text)}</textarea>
        <div class="consult-report-actions">
            <button class="btn-new" id="saveReportBtn" disabled>${escapeHtml(t('page.consultation.report.save'))}</button>
            <button class="btn-new btn-ghost" id="copyReportBtn">${escapeHtml(t('page.consultation.report.copy'))}</button>
            <span id="reportStatus"></span>
            ${sharedNote}
        </div>
    </div>`;
}

function renderKeyPoints(points) {
    if (!points.length) return '';
    const byCat = {};
    points.forEach((p) => { (byCat[p.category] = byCat[p.category] || []).push(p); });
    let groups = '';
    KP_CATEGORY_ORDER.forEach((cat) => {
        if (!byCat[cat]) return;
        const items = byCat[cat].map((p) =>
            `<li>${escapeHtml(p.text)}<span class="consult-kp-by">${escapeHtml(enumLabel('mentionedBy', p.mentioned_by))}</span></li>`
        ).join('');
        groups += `<div class="consult-kp-group">
            <p class="consult-kp-cat ${cat === 'sensitive' ? 'is-sensitive' : ''}">${escapeHtml(enumLabel('keyPointCategory', cat))}</p>
            <ul class="consult-kp-list">${items}</ul>
        </div>`;
    });
    return `<div class="consult-card consult-card-keypoints">
        <div class="consult-card-title"><span>${escapeHtml(t('page.consultation.keyPoints.title'))}</span></div>
        ${groups}
    </div>`;
}

function renderOpenQuestions(items) {
    if (!items.length) {
        return `<div class="consult-card consult-card-questions">
            <div class="consult-card-title"><span>${escapeHtml(t('page.consultation.openQuestions.title'))}</span></div>
            <p class="consult-empty">${escapeHtml(t('page.consultation.openQuestions.none'))}</p>
        </div>`;
    }
    const lis = items.map((o) =>
        `<li class="consult-oq-item">${escapeHtml(o.text)}
            <div class="consult-oq-reason">${escapeHtml(enumLabel('openQuestionReason', o.reason))} · ${escapeHtml(enumLabel('mentionedBy', o.mentioned_by))}</div>
        </li>`
    ).join('');
    return `<div class="consult-card consult-card-questions">
        <div class="consult-card-title"><span>${escapeHtml(t('page.consultation.openQuestions.title'))}</span></div>
        <ul class="consult-oq-list">${lis}</ul>
    </div>`;
}

function wireReport() {
    const area = document.getElementById('reportArea');
    const saveBtn = document.getElementById('saveReportBtn');
    const copyBtn = document.getElementById('copyReportBtn');
    if (!area) return;

    area.addEventListener('input', () => {
        state.reportDirty = true;
        saveBtn.disabled = false;
        document.getElementById('reportStatus').innerHTML =
            `<span class="consult-dirty">${escapeHtml(t('page.consultation.report.unsaved'))}</span>`;
    });

    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        try {
            const res = await apiFetch(`${API_BASE}/call-sessions/${state.sessionId}/report`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: area.value }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            state.reportDirty = false;
            document.getElementById('reportStatus').innerHTML =
                `<span class="consult-saved">${escapeHtml(t('page.consultation.report.saved'))}</span>`;
        } catch (err) {
            saveBtn.disabled = false;
            showToast(t('page.consultation.report.saveFailed'), 'error');
        }
    });

    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(area.value);
            showToast(t('page.consultation.report.copied'), 'success');
            await apiFetch(`${API_BASE}/call-sessions/${state.sessionId}/report/shared`, { method: 'POST' });
        } catch (_) {
            showToast(t('page.consultation.report.copyFailed'), 'error');
        }
    });
}

async function loadMemory() {
    const box = document.getElementById('memList');
    if (!box || !state.userId) return;
    try {
        const res = await apiFetch(`${API_BASE}/clients/${state.userId}/memory`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        renderMemory(data.entries || []);
    } catch (err) {
        box.innerHTML = `<p class="consult-empty">${escapeHtml(t('page.consultation.memory.loadError'))}</p>`;
    }
}

function renderMemory(entries) {
    const box = document.getElementById('memList');
    if (!entries.length) {
        box.innerHTML = `<p class="consult-empty">${escapeHtml(t('page.consultation.memory.empty'))}</p>`;
        return;
    }
    box.innerHTML = entries.map((e) => {
        const prov = e.source === 'ai'
            ? `<span class="mem-provenance is-ai">✦ ${escapeHtml(t('page.consultation.memory.aiSuggested'))}</span>`
            : `<span class="mem-provenance">${escapeHtml(t('page.consultation.memory.byAstrologer'))}</span>`;
        return `<div class="mem-item" data-id="${escapeHtml(e.id)}">
            <div class="mem-item-head">
                <span class="mem-cat">${escapeHtml(enumLabel('memoryCategory', e.category))}</span>
                ${prov}
                <span class="mem-internal">${escapeHtml(t('page.consultation.memory.internal'))}</span>
            </div>
            <p class="mem-text">${escapeHtml(e.text)}</p>
            <div class="mem-actions">
                <button class="mem-edit-btn" data-act="edit">${escapeHtml(t('common.edit'))}</button>
                <button class="compact-icon-btn compact-icon-btn--danger" data-act="del" aria-label="${escapeHtml(t('common.delete'))}" title="${escapeHtml(t('common.delete'))}">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 4.5h9M6 2.5h4l.5 2H5.5l.5-2ZM5 6.5v6m3-6v6m3-6v6M4.5 4.5l.6 9h5.8l.6-9" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
            </div>
        </div>`;
    }).join('');

    box.querySelectorAll('.mem-item').forEach((item) => {
        const id = item.dataset.id;
        item.querySelector('[data-act="edit"]')?.addEventListener('click', () => startEdit(item, id));
        item.querySelector('[data-act="del"]')?.addEventListener('click', () => deleteEntry(id));
    });
}

function startEdit(item, id) {
    const p = item.querySelector('.mem-text');
    const current = p.textContent;
    const actions = item.querySelector('.mem-actions');
    p.outerHTML = `<textarea class="mem-edit-area">${escapeHtml(current)}</textarea>`;
    actions.innerHTML = `
        <button class="mem-edit-btn" data-act="savee">${escapeHtml(t('common.save'))}</button>
        <button class="mem-del-btn" data-act="cancel">${escapeHtml(t('common.cancel'))}</button>`;
    actions.querySelector('[data-act="savee"]').addEventListener('click', async () => {
        const txt = item.querySelector('.mem-edit-area').value.trim();
        if (!txt) return;
        try {
            const res = await apiFetch(`${API_BASE}/memory/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: txt }),
            });
            if (!res.ok) throw new Error();
            loadMemory();
        } catch (_) { showToast(t('common.error'), 'error'); }
    });
    actions.querySelector('[data-act="cancel"]').addEventListener('click', loadMemory);
}

async function deleteEntry(id) {
    if (!confirm(t('page.consultation.memory.confirmDelete'))) return;
    try {
        const res = await apiFetch(`${API_BASE}/memory/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        showToast(t('page.consultation.memory.deleted'), 'success');
        loadMemory();
    } catch (_) { showToast(t('common.error'), 'error'); }
}

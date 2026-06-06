/**
 * SaveChartModal — shared modal for saving a chart.
 * Fields: title · tags (chip input + existing tags as quick-select) · person (autocomplete).
 *
 * Usage:
 *   const result = await window.SaveChartModal.open({ defaultTitle: 'My Chart' });
 *   if (!result) return;
 *   const { title, tags, personId } = result;
 *
 * Options:
 *   defaultTitle  {string}   Pre-filled chart name
 *   showTags      {boolean}  Show tags section (default true)
 *   showPerson    {boolean}  Show person section (default true)
 */
(function () {
    'use strict';

    const API_BASE = window.location.hostname === 'localhost'
        ? 'http://localhost:8000/api/v1'
        : '/api/v1';

    function t(key, params, fallback) {
        const val = window.FrontendI18n?.t?.(key, params);
        return (val && val !== key) ? val : (fallback || key);
    }

    function esc(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function apiHeaders() {
        const base = { 'Content-Type': 'application/json' };
        return window.AstroAPI?.withLocaleHeaders ? window.AstroAPI.withLocaleHeaders(base) : base;
    }

    async function apiFetch(path) {
        const res = await fetch(`${API_BASE}${path}`, {
            credentials: 'include',
            headers: window.AstroAPI?.withLocaleHeaders ? window.AstroAPI.withLocaleHeaders({}) : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    }

    // ─── State ───────────────────────────────────────────────────────────────────
    let _resolve = null;
    let _tags = [];
    let _allTags = [];          // existing tags from user's charts
    let _personId = null;
    let _personName = '';
    let _personTimer = null;
    let _domBuilt = false;
    let _eventsAttached = false;

    // ─── DOM refs ────────────────────────────────────────────────────────────────
    const R = {};
    const BACKDROP = 'scm-backdrop';
    const DIALOG   = 'scm-dialog';

    function q(id) { return document.getElementById(id); }
    function buildRefs() {
        R.backdrop      = q(BACKDROP);
        R.dialog        = q(DIALOG);
        R.form          = q('scm-form');
        R.closeBtn      = q('scm-close');
        R.cancelBtn     = q('scm-cancel');
        R.submitBtn     = q('scm-submit');
        R.submitText    = q('scm-submit-text');
        R.submitLoader  = q('scm-submit-loader');
        R.titleInput    = q('scm-title-input');
        R.error         = q('scm-error');
        // tags
        R.tagsSection   = q('scm-tags-section');
        R.tagWrap       = q('scm-tag-wrap');
        R.tagInput      = q('scm-tag-input');
        R.tagSuggestions = q('scm-tag-suggestions');
        // person
        R.personSection = q('scm-person-section');
        R.personWrap    = q('scm-person-wrap');
        R.personInput   = q('scm-person-input');
        R.personDropdown = q('scm-person-dropdown');
        R.personBadge   = q('scm-person-badge');
        R.personBadgeName = q('scm-person-badge-name');
        R.personClear   = q('scm-person-clear');
    }

    // ─── Build DOM ───────────────────────────────────────────────────────────────
    function buildDOM() {
        if (_domBuilt) return;
        _domBuilt = true;

        const html = `
<div class="chart-dialog-backdrop hidden" id="${BACKDROP}"></div>
<section class="chart-dialog hidden" id="${DIALOG}" role="dialog" aria-modal="true" aria-labelledby="scm-heading">
  <div class="chart-dialog-card chart-dialog-card--compact">
    <div class="chart-dialog-header">
      <h3 id="scm-heading" class="chart-dialog-title chart-dialog-title--compact"></h3>
      <button type="button" class="chart-dialog-close" id="scm-close" aria-label="Close">×</button>
    </div>

    <form id="scm-form" novalidate>
      <div class="chart-dialog-grid">

        <!-- Title -->
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label" for="scm-title-input" id="scm-title-label"></label>
          <input id="scm-title-input" type="text" autocomplete="off">
        </div>

        <!-- Tags -->
        <div class="form-group" id="scm-tags-section" style="grid-column:1/-1">
          <label class="form-label" id="scm-tags-label"></label>
          <div class="scm-tag-input-wrap" id="scm-tag-wrap">
            <input id="scm-tag-input" type="text" autocomplete="off">
          </div>
          <div class="scm-tag-suggestions" id="scm-tag-suggestions"></div>
        </div>

        <!-- Person -->
        <div class="form-group" id="scm-person-section" style="grid-column:1/-1">
          <label class="form-label" id="scm-person-label"></label>
          <div class="scm-person-wrap" id="scm-person-wrap">
            <div class="scm-person-badge hidden" id="scm-person-badge">
              <span id="scm-person-badge-name"></span>
              <button type="button" id="scm-person-clear" aria-label="Clear">×</button>
            </div>
            <input id="scm-person-input" type="text" autocomplete="off">
            <div class="place-suggestions" id="scm-person-dropdown"></div>
          </div>
        </div>

      </div>

      <div class="error-message hidden" id="scm-error"></div>

      <div class="chart-dialog-actions">
        <button type="button" class="header-nav-btn" id="scm-cancel"></button>
        <button type="submit" class="submit-btn chart-dialog-submit" id="scm-submit">
          <span id="scm-submit-text"></span>
          <span class="btn-loader hidden" id="scm-submit-loader"></span>
        </button>
      </div>
    </form>
  </div>
</section>`;

        const tmp = document.createElement('div');
        tmp.innerHTML = html.trim();
        while (tmp.firstChild) document.body.appendChild(tmp.firstChild);

        buildRefs();
        attachEvents();
    }

    // ─── Apply localised strings ─────────────────────────────────────────────────
    function applyStrings() {
        const heading = q('scm-heading');
        if (heading) heading.textContent = t('page.chart.actions.saveChart', null, 'Сохранить карту');

        const titleLabel = q('scm-title-label');
        if (titleLabel) titleLabel.textContent = t('page.chart.actions.saveSourceChartPromptTitle', null, 'Название карты');

        const tagsLabel = q('scm-tags-label');
        if (tagsLabel) tagsLabel.textContent = t('page.chart.saveModal.tagsLabel', null, 'Теги');

        const personLabel = q('scm-person-label');
        if (personLabel) personLabel.textContent = t('page.chart.saveModal.personLabel', null, 'Привязать к человеку');

        if (R.cancelBtn) R.cancelBtn.textContent = t('common.cancel', null, 'Отмена');
        if (R.submitText) R.submitText.textContent = t('page.chart.actions.saveSourceChart', null, 'Сохранить');
        if (R.submitLoader) R.submitLoader.textContent = t('common.loading', null, 'Сохраняем…');

        if (R.tagInput) R.tagInput.placeholder = t('page.chart.saveModal.tagsPlaceholder', null, 'Новый тег…');
        if (R.personInput) R.personInput.placeholder = t('page.chart.saveModal.personPlaceholder', null, 'Искать человека…');
    }

    // ─── Tag chip UI ─────────────────────────────────────────────────────────────
    function renderTagChips() {
        if (!R.tagWrap || !R.tagInput) return;
        R.tagWrap.querySelectorAll('.scm-tag-chip').forEach(c => c.remove());
        _tags.forEach((tag, i) => {
            const chip = document.createElement('span');
            chip.className = 'scm-tag-chip';
            const name = document.createElement('span');
            name.textContent = tag;
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'scm-tag-chip-del';
            del.setAttribute('aria-label', 'Remove ' + tag);
            del.textContent = '×';
            del.addEventListener('click', () => { _tags.splice(i, 1); renderTagChips(); renderTagSuggestions(); });
            chip.append(name, del);
            R.tagWrap.insertBefore(chip, R.tagInput);
        });
    }

    function addTag(raw) {
        const val = raw.trim();
        if (!val) return;
        if (!_tags.some(t => t.toLowerCase() === val.toLowerCase())) {
            _tags.push(val);
            renderTagChips();
            renderTagSuggestions();
        }
        if (R.tagInput) R.tagInput.value = '';
    }

    // Existing tags from user's charts — show as pills for quick-select
    function renderTagSuggestions() {
        if (!R.tagSuggestions) return;
        const active = new Set(_tags.map(t => t.toLowerCase()));
        const available = _allTags.filter(t => !active.has(t.toLowerCase()));
        if (!available.length) {
            R.tagSuggestions.innerHTML = '';
            R.tagSuggestions.hidden = true;
            return;
        }
        R.tagSuggestions.hidden = false;
        R.tagSuggestions.innerHTML = available.map(tag =>
            `<button type="button" class="chart-picker-tag scm-tag-suggestion" data-tag="${esc(tag)}">${esc(tag)}</button>`
        ).join('');
    }

    async function loadExistingTags() {
        try {
            const charts = await apiFetch('/charts?_limit=200');
            const tagSet = new Set();
            (Array.isArray(charts) ? charts : []).forEach(c => {
                (c.tags || []).forEach(tag => { if (tag) tagSet.add(tag); });
            });
            _allTags = Array.from(tagSet).sort((a, b) => a.localeCompare(b));
        } catch {
            _allTags = [];
        }
        renderTagSuggestions();
    }

    // ─── Person autocomplete ──────────────────────────────────────────────────────
    function showPersonDropdown(items) {
        if (!R.personDropdown) return;
        R.personDropdown.innerHTML = '';
        if (!items.length) { R.personDropdown.classList.remove('active'); return; }
        items.forEach(person => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'place-suggestion';
            btn.textContent = person.display_name;
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault(); // keep focus so blur doesn't fire first
                selectPerson(person.person_id, person.display_name);
            });
            R.personDropdown.appendChild(btn);
        });
        R.personDropdown.classList.add('active');
    }

    async function searchPersons(q) {
        if (!q.trim()) { R.personDropdown?.classList.remove('active'); return; }
        try {
            const data = await apiFetch(`/persons?q=${encodeURIComponent(q.trim())}`);
            showPersonDropdown(Array.isArray(data) ? data.slice(0, 8) : []);
        } catch { /* silent */ }
    }

    function selectPerson(id, name) {
        _personId = id;
        _personName = name;
        if (R.personBadge)     R.personBadge.classList.remove('hidden');
        if (R.personBadgeName) R.personBadgeName.textContent = name;
        if (R.personInput)     R.personInput.classList.add('hidden');
        if (R.personDropdown)  R.personDropdown.classList.remove('active');
    }

    function clearPerson() {
        _personId = null;
        _personName = '';
        if (R.personBadge)    R.personBadge.classList.add('hidden');
        if (R.personInput)    { R.personInput.classList.remove('hidden'); R.personInput.value = ''; R.personInput.focus(); }
        if (R.personDropdown) R.personDropdown.classList.remove('active');
    }

    // ─── Events ───────────────────────────────────────────────────────────────────
    function attachEvents() {
        if (_eventsAttached) return;
        _eventsAttached = true;

        // Close
        R.backdrop?.addEventListener('click', () => close(null));
        R.closeBtn?.addEventListener('click',  () => close(null));
        R.cancelBtn?.addEventListener('click', () => close(null));

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && R.dialog && !R.dialog.classList.contains('hidden')) close(null);
        });

        // Tag input
        R.tagInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); addTag(R.tagInput.value); }
            else if (e.key === ',' || e.key === ';') { e.preventDefault(); addTag(R.tagInput.value); }
            else if (e.key === 'Backspace' && !R.tagInput.value && _tags.length) {
                _tags.pop(); renderTagChips(); renderTagSuggestions();
            }
        });
        R.tagInput?.addEventListener('blur', () => { if (R.tagInput.value.trim()) addTag(R.tagInput.value); });
        R.tagWrap?.addEventListener('click', (e) => { if (e.target === R.tagWrap) R.tagInput?.focus(); });

        // Tag suggestions (click bubbles up)
        R.tagSuggestions?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-tag]');
            if (btn) addTag(btn.dataset.tag);
        });

        // Person input
        R.personInput?.addEventListener('input', () => {
            clearTimeout(_personTimer);
            const q = R.personInput.value.trim();
            if (!q) { R.personDropdown?.classList.remove('active'); return; }
            _personTimer = setTimeout(() => searchPersons(q), 280);
        });
        R.personInput?.addEventListener('keydown', (e) => {
            const dropdown = R.personDropdown;
            if (!dropdown || !dropdown.classList.contains('active')) return;
            const items = [...dropdown.querySelectorAll('.place-suggestion')];
            const focused = dropdown.querySelector('.place-suggestion:focus');
            const idx = focused ? items.indexOf(focused) : -1;
            if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(idx + 1, items.length - 1)]?.focus(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); idx <= 0 ? R.personInput.focus() : items[idx - 1]?.focus(); }
            else if (e.key === 'Escape') { dropdown.classList.remove('active'); }
        });
        document.addEventListener('click', (e) => {
            if (R.personWrap && !R.personWrap.contains(e.target)) R.personDropdown?.classList.remove('active');
        }, { capture: true });

        R.personClear?.addEventListener('click', clearPerson);

        // Submit
        R.form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = String(R.titleInput?.value || '').trim();
            if (!title) {
                showError(t('page.chart.actions.saveSourceChartTitleRequired', null, 'Укажите название карты.'));
                R.titleInput?.focus();
                return;
            }
            close({ title, tags: [..._tags], personId: _personId || null });
        });
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────────
    function showError(msg) {
        if (!R.error) return;
        R.error.textContent = msg;
        R.error.classList.remove('hidden');
    }

    function resetState() {
        _tags = [];
        _personId = null;
        _personName = '';
        clearTimeout(_personTimer);
        if (R.tagInput)      R.tagInput.value = '';
        if (R.personInput)   { R.personInput.value = ''; R.personInput.classList.remove('hidden'); }
        if (R.personBadge)   R.personBadge.classList.add('hidden');
        if (R.personDropdown) R.personDropdown.classList.remove('active');
        if (R.error)         { R.error.textContent = ''; R.error.classList.add('hidden'); }
        renderTagChips();
    }

    function setSubmitting(on) {
        if (!R.submitBtn) return;
        R.submitBtn.disabled = on;
        R.submitText?.classList.toggle('hidden', on);
        R.submitLoader?.classList.toggle('hidden', !on);
    }

    function close(result) {
        R.dialog?.classList.add('hidden');
        R.backdrop?.classList.add('hidden');
        document.body.style.overflow = '';
        if (_resolve) { _resolve(result ?? null); _resolve = null; }
    }

    // ─── Public API ───────────────────────────────────────────────────────────────
    function open(opts = {}) {
        const { defaultTitle = '', showTags = true, showPerson = true } = opts;

        buildDOM();
        applyStrings();
        resetState();
        setSubmitting(false);

        if (R.titleInput)  { R.titleInput.value = defaultTitle; }
        if (R.tagsSection)   R.tagsSection.classList.toggle('hidden', !showTags);
        if (R.personSection) R.personSection.classList.toggle('hidden', !showPerson);

        // Load existing tags in background
        if (showTags) loadExistingTags();

        R.backdrop?.classList.remove('hidden');
        R.dialog?.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Focus & select title
        setTimeout(() => { R.titleInput?.focus(); R.titleInput?.select(); }, 40);

        return new Promise((resolve) => { _resolve = resolve; });
    }

    window.SaveChartModal = { open };
})();

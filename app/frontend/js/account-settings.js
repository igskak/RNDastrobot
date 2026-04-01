(function () {
    'use strict';

    const VIEW_IDS = ['natal', 'biwheel', 'solar'];
    const ASPECT_TYPES = [
        'Conjunction',
        'Opposition',
        'Trine',
        'Square',
        'Sextile',
        'Quincunx',
        'Semisquare',
        'Semisextile',
        'Quintile',
        'Biquintile',
    ];

    let accountPreferences = null;
    let toastTimer = null;

    function hidePageLoader() {
        if (window.AstroAPI?.hidePageLoader) {
            window.AstroAPI.hidePageLoader();
            return;
        }

        const loader = document.getElementById('pageLoader');
        if (!loader) return;
        loader.classList.add('fade-out');
        setTimeout(() => loader.remove(), 300);
    }

    function t(key, params) {
        return window.FrontendI18n?.t?.(key, params) || key;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function translateOrFallback(key, fallback = '') {
        const translated = t(key);
        return translated && translated !== key ? translated : fallback;
    }

    function getBodyLabel(body) {
        return translateOrFallback(`astro.planet.${body}`, body);
    }

    function normalizeViewSettings(viewSettings = {}) {
        return window.AstroPreferences?.normalizeViewSettings
            ? window.AstroPreferences.normalizeViewSettings(viewSettings)
            : viewSettings;
    }

    function ensureMatrixRows(rows = {}) {
        return window.AstroPreferences?.ensureMatrixRows
            ? window.AstroPreferences.ensureMatrixRows(rows || {})
            : (rows || {});
    }

    function getMatrixBodies() {
        return window.AstroPreferences?.MATRIX_BODIES || [];
    }

    function getDefaultAccountPreferences() {
        return {
            chart_defaults: {
                natal: normalizeViewSettings({}),
                biwheel: normalizeViewSettings({ aspects: { scope: 'major' } }),
                solar: normalizeViewSettings({}),
            },
            chart_creation_defaults: {
                house_system: 'P',
            },
        };
    }

    function getViewDom(viewId) {
        if (viewId === 'natal') {
            return {
                orientation: document.getElementById('natalOrientationSelect'),
                aspectScope: document.getElementById('natalAspectScopeSelect'),
                aspectTypes: document.getElementById('natalAspectTypes'),
                matrix: document.getElementById('natalMatrixEditor'),
                showApplyingSeparating: document.getElementById('natalShowApplyingSeparating'),
                showSpeed: document.getElementById('natalShowSpeed'),
                showStationary: document.getElementById('natalShowStationary'),
            };
        }
        if (viewId === 'biwheel') {
            return {
                orientation: document.getElementById('biwheelOrientationSelectAccount'),
                aspectScope: document.getElementById('biwheelAspectScopeSelectAccount'),
                aspectTypes: document.getElementById('biwheelAspectTypes'),
                matrix: document.getElementById('biwheelMatrixEditor'),
                showApplyingSeparating: null,
                showSpeed: null,
                showStationary: null,
            };
        }
        return {
            orientation: document.getElementById('solarOrientationSelectAccount'),
            aspectScope: document.getElementById('solarAspectScopeSelectAccount'),
            aspectTypes: document.getElementById('solarAspectTypes'),
            matrix: document.getElementById('solarMatrixEditorAccount'),
            showApplyingSeparating: document.getElementById('solarShowApplyingSeparatingAccount'),
            showSpeed: document.getElementById('solarShowSpeedAccount'),
            showStationary: document.getElementById('solarShowStationaryAccount'),
        };
    }

    function renderAspectTypes(container, enabledTypes = []) {
        if (!container) return;
        const enabled = new Set(Array.isArray(enabledTypes) && enabledTypes.length ? enabledTypes : ASPECT_TYPES);
        container.innerHTML = ASPECT_TYPES.map((aspectType) => {
            const symbol = escapeHtml(window.Symbols?.aspects?.[aspectType] || '');
            const label = escapeHtml(t(`astro.aspect.${aspectType}`));
            const checked = enabled.has(aspectType) ? 'checked' : '';
            return `
                <label class="account-settings-check account-settings-check--aspect" title="${label}">
                    <input type="checkbox" data-aspect-type="${aspectType}" ${checked} aria-label="${label}">
                    <span class="account-settings-check-glyph" aria-hidden="true"><span class="astro-symbol">${symbol}</span></span>
                    <span class="account-settings-check-text">${label}</span>
                </label>
            `;
        }).join('');
    }

    function renderMatrix(container, rows = {}) {
        if (!container) return;
        const ensuredRows = ensureMatrixRows(rows);
        container.innerHTML = `
            <table class="account-settings-matrix-table">
                <thead>
                    <tr>
                        <th>${escapeHtml(t('page.accountSettings.matrix.columns.body'))}</th>
                        <th>${escapeHtml(t('page.accountSettings.matrix.columns.display'))}</th>
                        <th>${escapeHtml(t('page.accountSettings.matrix.columns.aspecting'))}</th>
                    </tr>
                </thead>
                <tbody>
                    ${getMatrixBodies().map((body) => {
                        const label = escapeHtml(getBodyLabel(body));
                        const symbol = escapeHtml(window.Symbols?.planets?.[body] || '');
                        const displayChecked = ensuredRows?.[body]?.display !== false ? 'checked' : '';
                        const aspectingChecked = ensuredRows?.[body]?.aspecting !== false ? 'checked' : '';
                    return `
                        <tr>
                            <td>
                                <span class="account-settings-body">
                                    <span class="account-settings-body-badge" title="${label}" aria-hidden="true">
                                        <span class="astro-symbol">${symbol}</span>
                                    </span>
                                    <span class="account-settings-body-name">${label}</span>
                                </span>
                            </td>
                            <td>
                                <input
                                    type="checkbox"
                                    data-matrix-body="${body}"
                                    data-matrix-field="display"
                                    ${displayChecked}
                                    aria-label="${escapeHtml(`${label}: ${t('page.accountSettings.matrix.columns.display')}`)}"
                                >
                            </td>
                            <td>
                                <input
                                    type="checkbox"
                                    data-matrix-body="${body}"
                                    data-matrix-field="aspecting"
                                    ${aspectingChecked}
                                    aria-label="${escapeHtml(`${label}: ${t('page.accountSettings.matrix.columns.aspecting')}`)}"
                                >
                            </td>
                        </tr>
                    `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    function populateForm(preferences) {
        const normalized = {
            ...getDefaultAccountPreferences(),
            ...(preferences || {}),
            chart_defaults: {
                natal: normalizeViewSettings(preferences?.chart_defaults?.natal || {}),
                biwheel: normalizeViewSettings(preferences?.chart_defaults?.biwheel || {}),
                solar: normalizeViewSettings(preferences?.chart_defaults?.solar || {}),
            },
            chart_creation_defaults: {
                house_system: preferences?.chart_creation_defaults?.house_system || 'P',
            },
        };

        accountPreferences = normalized;

        const houseSystemSelect = document.getElementById('accountHouseSystemSelect');
        if (houseSystemSelect) {
            houseSystemSelect.value = normalized.chart_creation_defaults.house_system || 'P';
        }

        VIEW_IDS.forEach((viewId) => {
            const view = normalized.chart_defaults[viewId];
            const dom = getViewDom(viewId);
            if (dom.orientation) dom.orientation.value = view.view_options?.orientation === 'asc' ? 'asc' : 'aries';
            if (dom.aspectScope) dom.aspectScope.value = view.aspects?.scope || (viewId === 'biwheel' ? 'major' : 'all');
            if (dom.showApplyingSeparating) dom.showApplyingSeparating.checked = view.aspects?.show_applying_separating === true;
            if (dom.showSpeed) dom.showSpeed.checked = view.table_options?.show_speed !== false;
            if (dom.showStationary) dom.showStationary.checked = view.table_options?.show_stationary !== false;
            renderAspectTypes(dom.aspectTypes, view.aspects?.enabled_types || []);
            renderMatrix(dom.matrix, view.matrix?.rows || {});
        });
    }

    function readCheckedAspectTypes(container) {
        const selected = [];
        container?.querySelectorAll('input[data-aspect-type]').forEach((input) => {
            if (input.checked && input.dataset.aspectType) {
                selected.push(input.dataset.aspectType);
            }
        });
        return selected.length ? selected : [...ASPECT_TYPES];
    }

    function readMatrixRows(container) {
        const rows = ensureMatrixRows({});
        container?.querySelectorAll('input[data-matrix-body][data-matrix-field]').forEach((input) => {
            const body = input.dataset.matrixBody;
            const field = input.dataset.matrixField;
            if (!body || !field) return;
            rows[body] = {
                ...(rows[body] || { display: true, aspecting: true }),
                [field]: input.checked,
            };
        });
        return rows;
    }

    function collectViewSettings(viewId) {
        const dom = getViewDom(viewId);
        return {
            matrix: {
                rows: readMatrixRows(dom.matrix),
            },
            aspects: {
                scope: dom.aspectScope?.value || (viewId === 'biwheel' ? 'major' : 'all'),
                enabled_types: readCheckedAspectTypes(dom.aspectTypes),
                show_applying_separating: dom.showApplyingSeparating?.checked === true,
            },
            table_options: {
                show_speed: dom.showSpeed ? dom.showSpeed.checked !== false : true,
                show_stationary: dom.showStationary ? dom.showStationary.checked !== false : true,
            },
            view_options: {
                orientation: dom.orientation?.value === 'asc' ? 'asc' : 'aries',
            },
        };
    }

    function collectPayload() {
        return {
            chart_creation_defaults: {
                house_system: document.getElementById('accountHouseSystemSelect')?.value || 'P',
            },
            chart_defaults: {
                natal: collectViewSettings('natal'),
                biwheel: collectViewSettings('biwheel'),
                solar: collectViewSettings('solar'),
            },
        };
    }

    function showToast(message, type = 'info') {
        const toast = document.getElementById('accountSettingsToast');
        if (!toast || !message) return;
        toast.textContent = message;
        toast.className = `toast ${type}`;
        requestAnimationFrame(() => toast.classList.add('visible'));
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.remove('visible');
        }, 2800);
    }

    async function loadPreferences() {
        const me = await window.AstroAPI?.requireAuth?.({ redirectTo: '/login.html' });
        if (!me) return;

        const subtitle = document.getElementById('accountSettingsSubtitle');
        if (subtitle) {
            subtitle.textContent = me.email
                ? t('page.accountSettings.subtitleWithEmail', { email: me.email })
                : t('page.accountSettings.subtitle');
        }

        const preferences = await window.AstroAPI.getAccountPreferences();
        populateForm(preferences);
        hidePageLoader();
    }

    async function savePreferences() {
        const saveBtn = document.getElementById('saveAccountSettingsBtn');
        if (saveBtn) saveBtn.disabled = true;
        try {
            const payload = collectPayload();
            const updated = await window.AstroAPI.patchAccountPreferences(payload);
            populateForm(updated);
            showToast(t('page.accountSettings.toasts.saved'), 'success');
        } catch (error) {
            showToast(error.message || t('page.accountSettings.toasts.saveFailed'), 'error');
        } finally {
            if (saveBtn) saveBtn.disabled = false;
        }
    }

    function restoreStandardDefaults() {
        populateForm(getDefaultAccountPreferences());
        showToast(t('page.accountSettings.toasts.restored'), 'info');
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const saveBtn = document.getElementById('saveAccountSettingsBtn');
        const reloadBtn = document.getElementById('reloadAccountSettingsBtn');
        const restoreBtn = document.getElementById('restoreStandardDefaultsBtn');

        saveBtn?.addEventListener('click', () => {
            savePreferences();
        });
        reloadBtn?.addEventListener('click', () => {
            loadPreferences().catch((error) => {
                showToast(error.message || t('page.accountSettings.toasts.reloadFailed'), 'error');
            });
        });
        restoreBtn?.addEventListener('click', () => {
            restoreStandardDefaults();
        });

        try {
            await window.FrontendI18n?.ready?.catch?.(() => {});
            await loadPreferences();
            document.addEventListener('frontend:locale-changed', () => {
                if (accountPreferences) {
                    populateForm(accountPreferences);
                }
            });
        } catch (error) {
            showToast(error.message || t('page.accountSettings.toasts.loadFailed'), 'error');
            hidePageLoader();
        }
    });
})();

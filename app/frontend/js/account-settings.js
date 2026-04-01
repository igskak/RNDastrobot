(function () {
    'use strict';

    const VIEW_IDS = ['natal', 'biwheel', 'solar'];
    const DEFAULT_ASPECT_TYPES = [
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
    const ASPECT_SYMBOL_FALLBACKS = {
        Sesquiquadrate: '⚼',
        Vigintile: 'V',
        Semi_Nonagon: 'SN',
        Decile: 'D',
        Nonagon: 'N',
        Binonagon: 'BN',
        Sentagon: 'SG',
        Tridecile: 'TD',
        Septile: '7',
        Novile: '9',
    };
    const ORB_PROFILE_IDS = window.AstroPreferences?.ORB_PROFILE_IDS || ['natal', 'prognostic'];
    const DEFAULT_ORB_PAIR_STRATEGY = window.AstroPreferences?.DEFAULT_ORB_PAIR_STRATEGY || 'larger';
    const ACTIVE_RECALC_JOB_KEY = 'activePreferenceRecalcJobId';

    let accountPreferences = null;
    let preferencesMetadata = null;
    let toastTimer = null;
    let pollTimer = null;
    let activeOrbProfile = 'natal';

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

    function getBodySymbol(body) {
        return window.Symbols?.planets?.[body] || String(body || '').slice(0, 2) || '•';
    }

    function getAspectLabel(aspectType) {
        return translateOrFallback(`astro.aspect.${aspectType}`, aspectType);
    }

    function getAspectSymbol(aspectType) {
        return window.Symbols?.aspects?.[aspectType]
            || ASPECT_SYMBOL_FALLBACKS[aspectType]
            || String(aspectType || '').slice(0, 2)
            || '•';
    }

    function deepEqual(left, right) {
        return window.AstroPreferences?.deepEqual
            ? window.AstroPreferences.deepEqual(left, right)
            : JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
    }

    function normalizeViewSettings(viewSettings = {}) {
        return window.AstroPreferences?.normalizeViewSettings
            ? window.AstroPreferences.normalizeViewSettings(viewSettings)
            : viewSettings;
    }

    function normalizeMethodologySettings(methodology = {}) {
        return window.AstroPreferences?.normalizeMethodologySettings
            ? window.AstroPreferences.normalizeMethodologySettings(methodology)
            : methodology;
    }

    function resolveVisualPreferences(visual = {}) {
        return window.AstroPreferences?.resolveVisualPreferences
            ? window.AstroPreferences.resolveVisualPreferences(visual)
            : (visual || {});
    }

    function ensureMatrixRows(rows = {}) {
        return window.AstroPreferences?.ensureMatrixRows
            ? window.AstroPreferences.ensureMatrixRows(rows || {})
            : (rows || {});
    }

    function getMatrixBodies() {
        return window.AstroPreferences?.MATRIX_BODIES || [];
    }

    function getMetadataAspectTypes() {
        return preferencesMetadata?.aspect_types || DEFAULT_ASPECT_TYPES.map((aspectType) => ({ aspect_type: aspectType }));
    }

    function getMetadataBodies() {
        return (preferencesMetadata?.bodies || []).map((item) => item?.name).filter(Boolean);
    }

    function buildDefaultOrbMatrix() {
        return Object.fromEntries(
            getMetadataAspectTypes().map((aspect) => [
                aspect.aspect_type,
                Object.fromEntries(
                    getMetadataBodies().map((body) => [body, Number(aspect.base_orb || 5)])
                ),
            ])
        );
    }

    function getDefaultMethodology() {
        const orbs = {
            version: 2,
            pair_strategy: DEFAULT_ORB_PAIR_STRATEGY,
            profiles: Object.fromEntries(
                ORB_PROFILE_IDS.map((profileId) => [
                    profileId,
                    {
                        matrix: buildDefaultOrbMatrix(),
                    },
                ])
            ),
        };

        return normalizeMethodologySettings({
            orbs,
            balances: preferencesMetadata?.default_balance_targets || {},
        });
    }

    function getDefaultVisual() {
        return resolveVisualPreferences(preferencesMetadata?.default_visual_palettes || {});
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
            methodology: getDefaultMethodology(),
            visual: getDefaultVisual(),
        };
    }

    function getViewDom(viewId) {
        if (viewId === 'natal') {
            return {
                orientation: document.getElementById('natalOrientationSelect'),
                aspectScope: document.getElementById('natalAspectScopeSelect'),
                showApplyingSeparating: document.getElementById('natalShowApplyingSeparating'),
                showSpeed: document.getElementById('natalShowSpeed'),
                showStationary: document.getElementById('natalShowStationary'),
            };
        }
        if (viewId === 'biwheel') {
            return {
                orientation: document.getElementById('biwheelOrientationSelectAccount'),
                aspectScope: document.getElementById('biwheelAspectScopeSelectAccount'),
                showApplyingSeparating: null,
                showSpeed: null,
                showStationary: null,
            };
        }
        return {
            orientation: document.getElementById('solarOrientationSelectAccount'),
            aspectScope: document.getElementById('solarAspectScopeSelectAccount'),
            showApplyingSeparating: document.getElementById('solarShowApplyingSeparatingAccount'),
            showSpeed: document.getElementById('solarShowSpeedAccount'),
            showStationary: document.getElementById('solarShowStationaryAccount'),
        };
    }

    function ensureMethodologyState() {
        if (!accountPreferences) {
            accountPreferences = {
                methodology: getDefaultMethodology(),
            };
        }
        accountPreferences.methodology = normalizeMethodologySettings(
            accountPreferences.methodology || getDefaultMethodology()
        );
        return accountPreferences.methodology;
    }

    function getOrbProfileMatrix(profileId) {
        const methodology = ensureMethodologyState();
        return methodology?.orbs?.profiles?.[profileId]?.matrix || buildDefaultOrbMatrix();
    }

    function getOrbPairStrategy() {
        const select = document.getElementById('accountOrbPairStrategySelect');
        if (select) {
            return window.AstroPreferences?.normalizeOrbPairStrategy?.(select.value) || DEFAULT_ORB_PAIR_STRATEGY;
        }
        return normalizeMethodologySettings(accountPreferences?.methodology || getDefaultMethodology())?.orbs?.pair_strategy
            || DEFAULT_ORB_PAIR_STRATEGY;
    }

    function updateOrbProfileUi() {
        const hint = document.getElementById('accountOrbProfileHint');
        const panel = document.getElementById('accountOrbMatrixPanel');
        const applyBtn = document.getElementById('accountApplyNatalOrbsBtn');

        document.querySelectorAll('[data-orb-profile-tab]').forEach((button) => {
            const isActive = button.dataset.orbProfileTab === activeOrbProfile;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
            if (panel && isActive && button.id) {
                panel.setAttribute('aria-labelledby', button.id);
            }
        });

        if (hint) {
            hint.textContent = t(`page.accountSettings.orbs.hints.${activeOrbProfile}`);
        }
        if (applyBtn) {
            applyBtn.classList.toggle('hidden', activeOrbProfile !== 'prognostic');
        }
    }

    function syncOrbMatrixFromDom() {
        const methodology = ensureMethodologyState();
        const matrix = buildDefaultOrbMatrix();
        document.querySelectorAll('#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]').forEach((input) => {
            const aspectType = input.dataset.orbAspectType;
            const body = input.dataset.orbBody;
            if (!aspectType || !body) return;
            if (!matrix[aspectType]) matrix[aspectType] = {};
            matrix[aspectType][body] = Number.parseFloat(input.value) || 0;
        });
        methodology.orbs.profiles[activeOrbProfile] = { matrix };
    }

    function setActiveOrbProfile(profileId, { rerender = true } = {}) {
        if (!ORB_PROFILE_IDS.includes(profileId)) return;
        if (accountPreferences) {
            syncOrbMatrixFromDom();
        }
        activeOrbProfile = profileId;
        updateOrbProfileUi();
        if (rerender && accountPreferences) {
            renderOrbsMatrix(accountPreferences.methodology);
        }
    }

    function renderAspectTypesMatrix(chartDefaults = {}) {
        const tbody = document.getElementById('accountAspectTypesMatrixBody');
        if (!tbody) return;

        tbody.innerHTML = getMetadataAspectTypes().map((aspectMeta) => {
            const aspectType = aspectMeta.aspect_type;
            const symbol = escapeHtml(getAspectSymbol(aspectType));
            const label = escapeHtml(getAspectLabel(aspectType));
            const cells = VIEW_IDS.map((viewId) => {
                const enabledTypes = chartDefaults?.[viewId]?.aspects?.enabled_types || [];
                const enabled = new Set(Array.isArray(enabledTypes) && enabledTypes.length ? enabledTypes : DEFAULT_ASPECT_TYPES);
                const checked = enabled.has(aspectType) ? 'checked' : '';
                return `
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${viewId}"
                                data-aspect-type="${aspectType}"
                                ${checked}
                                aria-label="${escapeHtml(`${translateOrFallback(`page.accountSettings.tables.columns.${viewId}`, viewId)}: ${label}`)}"
                            >
                        </label>
                    </td>
                `;
            }).join('');

            return `
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph" title="${label}" aria-label="${label}" role="img" tabindex="0"><span class="astro-symbol" aria-hidden="true">${symbol}</span></span>
                        </span>
                    </th>
                    ${cells}
                </tr>
            `;
        }).join('');
    }

    function renderBodiesMatrix(chartDefaults = {}) {
        const tbody = document.getElementById('accountBodiesMatrixBody');
        if (!tbody) return;

        tbody.innerHTML = getMatrixBodies().map((body) => {
            const label = escapeHtml(getBodyLabel(body));
            const symbol = escapeHtml(window.Symbols?.planets?.[body] || '');

            const cells = VIEW_IDS.map((viewId) => {
                const rows = ensureMatrixRows(chartDefaults?.[viewId]?.matrix?.rows || {});
                const displayChecked = rows?.[body]?.display !== false ? 'checked' : '';
                const aspectingChecked = rows?.[body]?.aspecting !== false ? 'checked' : '';
                return `
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${viewId}"
                                data-matrix-body="${body}"
                                data-matrix-field="display"
                                ${displayChecked}
                                aria-label="${escapeHtml(`${translateOrFallback(`page.accountSettings.tables.columns.${viewId}`, viewId)}: ${label} ${t('page.accountSettings.matrix.columns.display')}`)}"
                            >
                        </label>
                    </td>
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${viewId}"
                                data-matrix-body="${body}"
                                data-matrix-field="aspecting"
                                ${aspectingChecked}
                                aria-label="${escapeHtml(`${translateOrFallback(`page.accountSettings.tables.columns.${viewId}`, viewId)}: ${label} ${t('page.accountSettings.matrix.columns.aspecting')}`)}"
                            >
                        </label>
                    </td>
                `;
            }).join('');

            return `
                <tr>
                    <th scope="row">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge" title="${label}" aria-label="${label}" role="img" tabindex="0"><span class="astro-symbol" aria-hidden="true">${symbol}</span></span>
                        </span>
                    </th>
                    ${cells}
                </tr>
            `;
        }).join('');
    }

    function renderOrbsMatrix(methodology = {}) {
        const headerRow = document.getElementById('accountOrbsHeaderRow');
        const tbody = document.getElementById('accountOrbsMatrixBody');
        if (!headerRow || !tbody) return;

        const bodies = getMetadataBodies();
        const aspectTypes = getMetadataAspectTypes();
        const normalizedMethodology = normalizeMethodologySettings(methodology || getDefaultMethodology());
        const matrix = normalizedMethodology?.orbs?.profiles?.[activeOrbProfile]?.matrix || buildDefaultOrbMatrix();

        headerRow.innerHTML = `
            <th class="account-settings-orb-corner"></th>
            ${bodies.map((body) => {
                const label = escapeHtml(getBodyLabel(body));
                const symbol = escapeHtml(window.Symbols?.planets?.[body] || body);
                return `
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${label}" aria-label="${label}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${symbol}</span>
                            </span>
                        </span>
                    </th>
                `;
            }).join('')}
        `;

        tbody.innerHTML = aspectTypes.map((aspectMeta) => {
            const aspectType = aspectMeta.aspect_type;
            const symbol = escapeHtml(getAspectSymbol(aspectType));
            const aspectLabel = escapeHtml(getAspectLabel(aspectType));
            return `
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${aspectLabel}" aria-label="${aspectLabel}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${symbol}</span>
                            </span>
                        </span>
                    </th>
                    ${bodies.map((body) => {
                        const value = matrix?.[aspectType]?.[body];
                        const bodyLabel = escapeHtml(getBodyLabel(body));
                        return `
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(value)) ? Number(value) : Number(aspectMeta.base_orb || 5)}"
                                    aria-label="${escapeHtml(`${aspectLabel} · ${bodyLabel}`)}"
                                    data-orb-aspect-type="${aspectType}"
                                    data-orb-body="${body}"
                                    data-orb-profile="${activeOrbProfile}"
                                >
                            </td>
                        `;
                    }).join('')}
                </tr>
            `;
        }).join('');

        updateOrbProfileUi();
    }

    function renderBalanceWeights(methodology = {}) {
        const planetsBody = document.getElementById('accountBalancePlanetWeightsBody');
        const specialBody = document.getElementById('accountBalanceSpecialWeightsBody');
        if (!planetsBody || !specialBody) return;

        const balances = methodology?.balances || {};
        const planetWeights = balances?.planet_weights || {};
        const specialWeights = balances?.special_point_weights || {};
        const bodyNames = getMetadataBodies();

        const planetRows = bodyNames.filter((body) => !['TrueNode', 'SouthNode', 'BlackMoon', 'WhiteMoon', 'PartOfFortune', 'ASC', 'DSC', 'MC', 'IC', 'Vertex', 'AntiVertex'].includes(body));
        const specialRows = ['TrueNorthNode', 'TrueSouthNode', 'BlackMoon'];

        planetsBody.innerHTML = planetRows.map((body) => `
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                    <span class="account-settings-body account-settings-body--icon-only">
                        <span class="account-settings-body-badge account-settings-orb-glyph" title="${escapeHtml(getBodyLabel(body))}" aria-label="${escapeHtml(getBodyLabel(body))}" role="img" tabindex="0">
                            <span class="astro-symbol" aria-hidden="true">${escapeHtml(getBodySymbol(body))}</span>
                        </span>
                    </span>
                </th>
                <td>
                    <input
                        class="account-settings-number-input account-settings-compact-input"
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        value="${Number(planetWeights?.[body] ?? 1).toFixed(1)}"
                        data-balance-planet="${body}"
                        aria-label="${escapeHtml(getBodyLabel(body))}"
                    >
                </td>
            </tr>
        `).join('');

        specialBody.innerHTML = specialRows.map((body) => `
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                    <span class="account-settings-body account-settings-body--icon-only">
                        <span class="account-settings-body-badge account-settings-orb-glyph" title="${escapeHtml(getBodyLabel(body))}" aria-label="${escapeHtml(getBodyLabel(body))}" role="img" tabindex="0">
                            <span class="astro-symbol" aria-hidden="true">${escapeHtml(getBodySymbol(body))}</span>
                        </span>
                    </span>
                </th>
                <td>
                    <input
                        class="account-settings-number-input account-settings-compact-input"
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        value="${Number(specialWeights?.[body] ?? 0).toFixed(1)}"
                        data-balance-special-point="${body}"
                        aria-label="${escapeHtml(getBodyLabel(body))}"
                    >
                </td>
            </tr>
        `).join('');
    }

    function renderAspectColors(visual = {}) {
        const tbody = document.getElementById('accountAspectColorsBody');
        if (!tbody) return;
        const aspectColors = visual?.aspect_colors || {};

        tbody.innerHTML = getMetadataAspectTypes().map((aspectMeta) => {
            const aspectType = aspectMeta.aspect_type;
            const color = aspectColors?.[aspectType] || '#9ca3af';
            return `
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${escapeHtml(getAspectLabel(aspectType))}" aria-label="${escapeHtml(getAspectLabel(aspectType))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${escapeHtml(getAspectSymbol(aspectType))}</span>
                            </span>
                        </span>
                    </th>
                    <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${escapeHtml(color)}" data-aspect-color="${aspectType}" aria-label="${escapeHtml(getAspectLabel(aspectType))}"></td>
                </tr>
            `;
        }).join('');
    }

    function renderPlanetColors(visual = {}) {
        const elementBody = document.getElementById('accountElementPaletteBody');
        const overridesBody = document.getElementById('accountBodyOverrideColorsBody');
        if (!elementBody || !overridesBody) return;

        const resolvedVisual = resolveVisualPreferences(visual);
        const elementPalette = resolvedVisual?.planet_colors?.element_palette || {};
        const bodyOverrides = resolvedVisual?.planet_colors?.body_overrides || {};

        elementBody.innerHTML = Object.keys(elementPalette).map((element) => `
            <tr>
                <th scope="row">${escapeHtml(element)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${escapeHtml(elementPalette[element])}" data-element-color="${element}" aria-label="${escapeHtml(element)}"></td>
            </tr>
        `).join('');

        overridesBody.innerHTML = getMetadataBodies().map((body) => `
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                    <span class="account-settings-body account-settings-body--icon-only">
                        <span class="account-settings-body-badge account-settings-orb-glyph" title="${escapeHtml(getBodyLabel(body))}" aria-label="${escapeHtml(getBodyLabel(body))}" role="img" tabindex="0">
                            <span class="astro-symbol" aria-hidden="true">${escapeHtml(getBodySymbol(body))}</span>
                        </span>
                    </span>
                </th>
                <td>
                    <div class="account-settings-color-stack">
                        <input
                            type="color"
                            class="account-settings-color-input account-settings-swatch-input"
                            value="${escapeHtml(bodyOverrides?.[body] || '#c7b49a')}"
                            data-body-color-override="${body}"
                            data-body-color-active="${bodyOverrides?.[body] ? 'true' : 'false'}"
                            aria-label="${escapeHtml(getBodyLabel(body))}"
                        >
                        <button
                            type="button"
                            class="account-settings-reset-chip${bodyOverrides?.[body] ? '' : ' is-muted'}"
                            data-clear-body-color-override="${body}"
                            title="${escapeHtml(t('common.reset'))}"
                            aria-label="${escapeHtml(`${t('common.reset')}: ${getBodyLabel(body)}`)}"
                        >↺</button>
                    </div>
                </td>
            </tr>
        `).join('');
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
            methodology: normalizeMethodologySettings(preferences?.methodology || getDefaultMethodology()),
            visual: resolveVisualPreferences(preferences?.visual || getDefaultVisual()),
        };

        accountPreferences = normalized;
        window.AstroPreferences?.setAccountVisualPreferences?.(normalized.visual);
        if (!ORB_PROFILE_IDS.includes(activeOrbProfile)) activeOrbProfile = 'natal';

        const houseSystemSelect = document.getElementById('accountHouseSystemSelect');
        if (houseSystemSelect) {
            houseSystemSelect.value = normalized.chart_creation_defaults.house_system || 'P';
        }

        const orbPairStrategySelect = document.getElementById('accountOrbPairStrategySelect');
        if (orbPairStrategySelect) {
            orbPairStrategySelect.value = normalized.methodology?.orbs?.pair_strategy || DEFAULT_ORB_PAIR_STRATEGY;
        }

        VIEW_IDS.forEach((viewId) => {
            const view = normalized.chart_defaults[viewId];
            const dom = getViewDom(viewId);
            if (dom.orientation) dom.orientation.value = view.view_options?.orientation === 'asc' ? 'asc' : 'aries';
            if (dom.aspectScope) dom.aspectScope.value = view.aspects?.scope || (viewId === 'biwheel' ? 'major' : 'all');
            if (dom.showApplyingSeparating) dom.showApplyingSeparating.checked = view.aspects?.show_applying_separating === true;
            if (dom.showSpeed) dom.showSpeed.checked = view.table_options?.show_speed !== false;
            if (dom.showStationary) dom.showStationary.checked = view.table_options?.show_stationary !== false;
        });

        renderAspectTypesMatrix(normalized.chart_defaults);
        renderBodiesMatrix(normalized.chart_defaults);
        renderOrbsMatrix(normalized.methodology);
        renderBalanceWeights(normalized.methodology);
        renderAspectColors(normalized.visual);
        renderPlanetColors(normalized.visual);
    }

    function readCheckedAspectTypes(viewId) {
        const selected = [];
        document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${viewId}"][data-aspect-type]`).forEach((input) => {
            if (input.checked && input.dataset.aspectType) {
                selected.push(input.dataset.aspectType);
            }
        });
        return selected.length ? selected : getMetadataAspectTypes().map((item) => item.aspect_type);
    }

    function readMatrixRows(viewId) {
        const rows = ensureMatrixRows({});
        document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${viewId}"][data-matrix-body][data-matrix-field]`).forEach((input) => {
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
                rows: readMatrixRows(viewId),
            },
            aspects: {
                scope: dom.aspectScope?.value || (viewId === 'biwheel' ? 'major' : 'all'),
                enabled_types: readCheckedAspectTypes(viewId),
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

    function collectMethodology() {
        syncOrbMatrixFromDom();
        const normalizedOrbs = normalizeMethodologySettings(accountPreferences?.methodology || getDefaultMethodology())?.orbs || {};
        const orbProfiles = normalizedOrbs?.profiles || {};

        const planetWeights = {};
        document.querySelectorAll('[data-balance-planet]').forEach((input) => {
            if (!input.dataset.balancePlanet) return;
            planetWeights[input.dataset.balancePlanet] = Number.parseFloat(input.value) || 0;
        });

        const specialPointWeights = {};
        document.querySelectorAll('[data-balance-special-point]').forEach((input) => {
            if (!input.dataset.balanceSpecialPoint) return;
            specialPointWeights[input.dataset.balanceSpecialPoint] = Number.parseFloat(input.value) || 0;
        });

        return normalizeMethodologySettings({
            orbs: {
                version: 2,
                pair_strategy: getOrbPairStrategy(),
                profiles: orbProfiles,
            },
            balances: {
                version: 1,
                planet_weights: planetWeights,
                special_point_weights: specialPointWeights,
            },
        });
    }

    function collectVisual() {
        const aspectColors = {};
        document.querySelectorAll('[data-aspect-color]').forEach((input) => {
            if (input.dataset.aspectColor && input.value) {
                aspectColors[input.dataset.aspectColor] = input.value;
            }
        });

        const elementPalette = {};
        document.querySelectorAll('[data-element-color]').forEach((input) => {
            if (input.dataset.elementColor && input.value) {
                elementPalette[input.dataset.elementColor] = input.value;
            }
        });

        const bodyOverrides = {};
        document.querySelectorAll('[data-body-color-override]').forEach((input) => {
            const body = input.dataset.bodyColorOverride;
            const value = String(input.value || '').trim();
            if (body && value && input.dataset.bodyColorActive !== 'false') {
                bodyOverrides[body] = value;
            }
        });

        return resolveVisualPreferences({
            aspect_colors: aspectColors,
            planet_colors: {
                element_palette: elementPalette,
                body_overrides: bodyOverrides,
            },
        });
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
            methodology: collectMethodology(),
            visual: collectVisual(),
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

    function renderJobStatus(job, { final = false } = {}) {
        const container = document.getElementById('methodologyJobStatus');
        if (!container) return;
        if (!job) {
            container.classList.add('hidden');
            container.textContent = '';
            return;
        }

        const total = Number(job.progress_total || 0);
        const done = Number(job.progress_done || 0);
        const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
        const statusLabel = String(job.status || 'pending').toUpperCase();
        const summary = `${statusLabel} · ${done}/${total || '0'} · ${percent}%`;
        const failures = Number(job.failed_count || 0);
        const suffix = failures ? ` · failures: ${failures}` : '';
        container.textContent = final ? `${summary}${suffix}` : `${summary}${suffix}`;
        container.classList.remove('hidden');
        container.dataset.status = String(job.status || 'pending');
    }

    function stopPollingJob() {
        if (pollTimer) {
            clearTimeout(pollTimer);
            pollTimer = null;
        }
    }

    async function pollRecalcJob(jobId) {
        stopPollingJob();
        if (!jobId || !window.AstroAPI?.getPreferenceRecalcJob) return;
        sessionStorage.setItem(ACTIVE_RECALC_JOB_KEY, String(jobId));

        const loop = async () => {
            try {
                const job = await window.AstroAPI.getPreferenceRecalcJob(jobId);
                renderJobStatus(job, { final: job.status === 'completed' || job.status === 'failed' });
                if (job.status === 'completed') {
                    sessionStorage.removeItem(ACTIVE_RECALC_JOB_KEY);
                    showToast(`Methodology recalculation finished${job.failed_count ? ` with ${job.failed_count} failures` : ''}.`, job.failed_count ? 'info' : 'success');
                    stopPollingJob();
                    return;
                }
                if (job.status === 'failed') {
                    sessionStorage.removeItem(ACTIVE_RECALC_JOB_KEY);
                    showToast(job.error || 'Methodology recalculation failed.', 'error');
                    stopPollingJob();
                    return;
                }
                pollTimer = setTimeout(loop, 2500);
            } catch (error) {
                pollTimer = setTimeout(loop, 4000);
                console.warn('Failed to poll preference recalculation job:', error);
            }
        };

        await loop();
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

        const [metadata, preferences] = await Promise.all([
            window.AstroAPI.getPreferencesMetadata?.(),
            window.AstroAPI.getAccountPreferences(),
        ]);
        preferencesMetadata = metadata || null;
        populateForm(preferences);

        const activeJobId = sessionStorage.getItem(ACTIVE_RECALC_JOB_KEY);
        if (activeJobId) {
            pollRecalcJob(activeJobId).catch((error) => {
                console.warn('Failed to resume recalculation job polling:', error);
            });
        } else {
            renderJobStatus(null);
        }

        hidePageLoader();
    }

    async function savePreferences() {
        const saveBtn = document.getElementById('saveAccountSettingsBtn');
        if (saveBtn) saveBtn.disabled = true;
        try {
            const payload = collectPayload();
            const methodologyChanged = !deepEqual(
                normalizeMethodologySettings(accountPreferences?.methodology || {}),
                payload.methodology
            );
            const updated = await window.AstroAPI.patchAccountPreferences(payload);
            populateForm(updated);

            if (methodologyChanged && window.AstroAPI?.createPreferenceRecalcJob) {
                const job = await window.AstroAPI.createPreferenceRecalcJob({
                    job_type: 'methodology_recalc',
                    payload: { source: 'account-settings' },
                });
                renderJobStatus(job);
                pollRecalcJob(job.job_id).catch((error) => {
                    console.warn('Failed to poll methodology recalculation job:', error);
                });
                showToast('Preferences saved. Methodology recalculation started.', 'success');
                return;
            }

            showToast(t('page.accountSettings.toasts.saved'), 'success');
        } catch (error) {
            showToast(error.message || t('page.accountSettings.toasts.saveFailed'), 'error');
        } finally {
            if (saveBtn) saveBtn.disabled = false;
        }
    }

    function restoreStandardDefaults() {
        populateForm(getDefaultAccountPreferences());
        renderJobStatus(null);
        showToast(t('page.accountSettings.toasts.restored'), 'info');
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const saveBtn = document.getElementById('saveAccountSettingsBtn');
        const reloadBtn = document.getElementById('reloadAccountSettingsBtn');
        const restoreBtn = document.getElementById('restoreStandardDefaultsBtn');
        const applyNatalOrbsBtn = document.getElementById('accountApplyNatalOrbsBtn');
        const orbMatrixBody = document.getElementById('accountOrbsMatrixBody');
        const bodyOverrideColorsBody = document.getElementById('accountBodyOverrideColorsBody');

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
        document.querySelectorAll('[data-orb-profile-tab]').forEach((button) => {
            button.addEventListener('click', () => {
                setActiveOrbProfile(button.dataset.orbProfileTab || 'natal');
            });
        });
        applyNatalOrbsBtn?.addEventListener('click', () => {
            syncOrbMatrixFromDom();
            const methodology = ensureMethodologyState();
            methodology.orbs.profiles.prognostic = {
                matrix: JSON.parse(JSON.stringify(getOrbProfileMatrix('natal'))),
            };
            activeOrbProfile = 'prognostic';
            renderOrbsMatrix(methodology);
            showToast(t('page.accountSettings.toasts.orbsCopied'), 'info');
        });
        orbMatrixBody?.addEventListener('input', (event) => {
            const input = event.target;
            if (!(input instanceof HTMLInputElement)) return;
            if (!input.dataset.orbAspectType || !input.dataset.orbBody) return;
            const methodology = ensureMethodologyState();
            const profile = methodology.orbs.profiles[activeOrbProfile] || { matrix: buildDefaultOrbMatrix() };
            const nextMatrix = profile.matrix || buildDefaultOrbMatrix();
            if (!nextMatrix[input.dataset.orbAspectType]) {
                nextMatrix[input.dataset.orbAspectType] = {};
            }
            nextMatrix[input.dataset.orbAspectType][input.dataset.orbBody] = Number.parseFloat(input.value) || 0;
            methodology.orbs.profiles[activeOrbProfile] = { matrix: nextMatrix };
        });
        bodyOverrideColorsBody?.addEventListener('input', (event) => {
            const input = event.target;
            if (!(input instanceof HTMLInputElement)) return;
            if (!input.dataset.bodyColorOverride) return;
            input.dataset.bodyColorActive = 'true';
            const resetButton = bodyOverrideColorsBody.querySelector(`[data-clear-body-color-override="${input.dataset.bodyColorOverride}"]`);
            resetButton?.classList.remove('is-muted');
        });
        bodyOverrideColorsBody?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-clear-body-color-override]');
            if (!(button instanceof HTMLElement)) return;
            const body = button.dataset.clearBodyColorOverride;
            if (!body) return;
            const input = bodyOverrideColorsBody.querySelector(`[data-body-color-override="${body}"]`);
            if (!(input instanceof HTMLInputElement)) return;
            input.dataset.bodyColorActive = 'false';
            button.classList.add('is-muted');
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

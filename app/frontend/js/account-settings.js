(function () {
    'use strict';

    const VIEW_IDS = ['natal', 'biwheel', 'solar'];
    const VISUAL_PANEL_IDS = ['aspectColors', 'elementPalette', 'bodyOverrides', 'wheel'];
    const PREVIEW_ASPECT_TYPES = ['Conjunction', 'Trine', 'Square', 'Opposition', 'Sextile'];
    const PREVIEW_BODY_ELEMENTS = {
        Sun: 'Fire',
        Moon: 'Water',
        Mercury: 'Air',
        Venus: 'Earth',
        Mars: 'Fire',
        Jupiter: 'Fire',
    };
    const DEFAULT_ASPECT_TYPES = window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES || [
        'Conjunction',
        'Opposition',
        'Trine',
        'Square',
        'Sextile',
        'Vigintile',
        'Semi_Nonagon',
        'Semisextile',
        'Decile',
        'Nonagon',
        'Semisquare',
        'Quintile',
        'Binonagon',
        'Sentagon',
        'Tridecile',
        'Sesquiquadrate',
        'Biquintile',
        'Quincunx',
    ];
    const ORB_PROFILE_IDS = window.AstroPreferences?.ORB_PROFILE_IDS || ['natal', 'prognostic', 'synastry'];
    const DEFAULT_ORB_PAIR_STRATEGY = window.AstroPreferences?.DEFAULT_ORB_PAIR_STRATEGY || 'larger';
    const ACTIVE_RECALC_JOB_KEY = 'activePreferenceRecalcJobId';
    const ORB_VIEW_MODE_STORAGE_KEY = 'accountOrbViewMode';
    const DIGNITY_BODY_EXCLUSIONS = new Set([
        'TrueNode', 'SouthNode',
        'BlackMoon', 'WhiteMoon', 'PartOfFortune',
        'ASC', 'DSC', 'MC', 'IC', 'Vertex', 'AntiVertex',
    ]);

    let accountPreferences = null;
    let persistedMethodologyBaseline = null;
    let preferencesMetadata = null;
    let toastTimer = null;
    let pollTimer = null;
    let activeOrbProfile = 'natal';
    let activeOrbViewMode = 'default';
    let activeVisualTab = 'aspectColors';
    let lastFocusedElementBeforeResetConfirm = null;

    function hidePageLoader() {
        if (window.AstroAPI?.hidePageLoader) {
            window.AstroAPI.hidePageLoader();
            return;
        }

        const loader = document.getElementById('pageLoader');
        if (!loader) return;
        loader.classList.add('fade-out');
        setTimeout(() => loader.remove(), 460);
    }

    function t(key, params) {
        return window.FrontendI18n?.t?.(key, params) || key;
    }

    function configureAccountSettingsBackLink() {
        const backLink = document.querySelector('.account-settings-back');
        if (!backLink) return;
        const navigationState = window.AstroAPI?.getNavigationState?.() || {};
        let referrerUrl = '';
        try {
            const referrer = document.referrer ? new URL(document.referrer) : null;
            if (referrer && referrer.origin === window.location.origin && !referrer.pathname.endsWith('/account-settings.html')) {
                referrerUrl = `${referrer.pathname}${referrer.search || ''}${referrer.hash || ''}`;
            }
        } catch (_error) {
            referrerUrl = '';
        }
        backLink.href = referrerUrl || window.AstroAPI?.getAccountSettingsReturnUrl?.() || navigationState.sourceUrl || '/';
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

    function getPlanCode(me) {
        return window.AstroPlan?.getPlanCode?.(me) || String(me?.plan_code || 'pro').trim().toLowerCase() || 'pro';
    }

    function getPlanUsageLabel(me) {
        const usage = window.AstroPlan?.getSavedChartLimitState?.(me);
        if (!usage || usage.max === null || usage.max === undefined) {
            return t('page.plan.usage.savedChartsUnlimited', { current: usage?.current || 0 });
        }
        return t('page.plan.usage.savedChartsLimited', {
            current: usage.current,
            max: usage.max,
        });
    }

    function formatBillingDate(value) {
        if (!value) return '';
        if (window.LocaleFormatters?.formatDate) {
            return window.LocaleFormatters.formatDate(value);
        }
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
    }

    function getBillingStatusLabel(me) {
        const subscription = me?.billing?.subscription;
        if (!subscription) {
            return t('page.accountSettings.plan.billingFree');
        }
        if (subscription.cancel_at_period_end && subscription.current_period_end) {
            return t('page.accountSettings.plan.billingCancelsAt', {
                date: formatBillingDate(subscription.current_period_end),
            });
        }
        if (subscription.current_period_end) {
            return t('page.accountSettings.plan.billingRenewsAt', {
                date: formatBillingDate(subscription.current_period_end),
            });
        }
        return t(`page.accountSettings.plan.billingStatus.${subscription.status}`) || subscription.status;
    }

    function renderAccountPlan(me) {
        const card = document.getElementById('accountPlanCard');
        if (!card) return;

        const planCode = getPlanCode(me);
        const title = document.getElementById('accountPlanTitle');
        const copy = document.getElementById('accountPlanCopy');
        const usage = document.getElementById('accountPlanUsage');
        const billingStatus = document.getElementById('accountPlanBillingStatus');
        const portalBtn = document.getElementById('accountPlanPortalBtn');

        if (title) {
            title.textContent = t(`page.plan.names.${planCode}`);
        }
        if (copy) {
            copy.textContent = t(`page.plan.descriptions.${planCode}`);
        }
        if (usage) {
            usage.textContent = getPlanUsageLabel(me);
        }
        if (billingStatus) {
            billingStatus.textContent = getBillingStatusLabel(me);
        }
        if (portalBtn) {
            const hasSubscription = !!me?.billing?.subscription;
            portalBtn.classList.toggle('hidden', !hasSubscription);
            portalBtn.onclick = async () => {
                try {
                    portalBtn.disabled = true;
                    const portal = await window.AstroAPI.getBillingPortal();
                    if (portal?.portal_url) {
                        window.location.href = portal.portal_url;
                    }
                } catch (error) {
                    showToast(error.message || t('page.plan.modal.errors.portalFailed'), 'error');
                } finally {
                    portalBtn.disabled = false;
                }
            };
        }

        card.dataset.planCode = planCode;
    }

    function getBodyLabel(body) {
        return translateOrFallback(`astro.planet.${body}`, window.Symbols?.getPlanetNameRu?.(body) || body);
    }

    function getBodySymbol(body) {
        return window.Symbols?.getPlanetSymbol?.(body) || String(body || '').slice(0, 2) || '•';
    }

    function getBodySymbolMarkup(body, options = {}) {
        return window.Symbols?.getPlanetSymbolMarkup?.(body, options)
            || `<span class="astro-symbol" aria-hidden="true">${escapeHtml(getBodySymbol(body))}</span>`;
    }

    function getBodyDefaultDisplayElement(body) {
        const normalizedBody = window.AstroPreferences?.normalizeMatrixBodyName
            ? window.AstroPreferences.normalizeMatrixBodyName(body)
            : body;
        const defaultSigns = preferencesMetadata?.default_dignities?.signs || {};
        const signElements = window.Symbols?.signElements || {};
        const metadataSigns = getMetadataSigns()
            .map((signMeta) => signMeta?.name)
            .filter(Boolean);
        const candidateSigns = metadataSigns.length
            ? metadataSigns
            : Object.keys(defaultSigns);

        for (const sign of candidateSigns) {
            if (defaultSigns?.[sign]?.ruler === normalizedBody) {
                return signElements[sign] || null;
            }
        }

        for (const sign of candidateSigns) {
            if (defaultSigns?.[sign]?.co_ruler === normalizedBody) {
                return signElements[sign] || null;
            }
        }

        for (const sign of candidateSigns) {
            if (defaultSigns?.[sign]?.exaltation === normalizedBody) {
                return signElements[sign] || null;
            }
        }

        return null;
    }

    function getBodyDefaultDisplayColor(body, visual = {}) {
        const resolvedVisual = resolveVisualPreferences(visual);
        const fallbackElement = getBodyDefaultDisplayElement(body);
        if (window.AstroPreferences?.getPlanetColor) {
            return window.AstroPreferences.getPlanetColor(body, fallbackElement, resolvedVisual);
        }
        if (window.AstroPreferences?.getElementColor) {
            return window.AstroPreferences.getElementColor(fallbackElement, resolvedVisual);
        }
        return '#6b7280';
    }

    function getAspectLabel(aspectType) {
        return translateOrFallback(`astro.aspect.${aspectType}`, aspectType);
    }

    function getAspectSymbol(aspectType) {
        return window.Symbols?.getAspectDisplay?.(aspectType)
            || window.Symbols?.aspects?.[aspectType]
            || String(aspectType || '').slice(0, 3)
            || '•';
    }

    function deepEqual(left, right) {
        return window.AstroPreferences?.deepEqual
            ? window.AstroPreferences.deepEqual(left, right)
            : JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
    }

    function deepClone(value) {
        if (value === null || value === undefined) return value;
        return JSON.parse(JSON.stringify(value));
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

    function normalizeDignitySettings(dignities = {}, defaultDignities = {}) {
        return window.AstroPreferences?.normalizeDignitySettings
            ? window.AstroPreferences.normalizeDignitySettings(dignities, defaultDignities)
            : dignities;
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

    function getAspectMeta(aspectType) {
        return getMetadataAspectTypes().find((item) => item?.aspect_type === aspectType) || null;
    }

    function getMetadataBodies() {
        return (preferencesMetadata?.bodies || []).map((item) => item?.name).filter(Boolean);
    }

    function getMetadataSigns() {
        return preferencesMetadata?.signs || [];
    }

    function getDignityBodies() {
        return getMetadataBodies().filter((body) => !DIGNITY_BODY_EXCLUSIONS.has(body));
    }

    function buildDefaultOrbMatrix(profileId = 'natal') {
        const aspectTypes = getMetadataAspectTypes();
        const bodies = getMetadataBodies();
        if (window.AstroPreferences?.buildDefaultOrbProfileMatrix) {
            return window.AstroPreferences.buildDefaultOrbProfileMatrix(aspectTypes, bodies, profileId);
        }
        return Object.fromEntries(
            aspectTypes.map((aspect) => [
                aspect.aspect_type,
                Object.fromEntries(
                    bodies.map((body) => [
                        body,
                        profileId === 'prognostic'
                            ? (body === 'Moon' ? 3 : 1)
                            : Number(aspect.base_orb || 5),
                    ])
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
                        matrix: buildDefaultOrbMatrix(profileId),
                    },
                ])
            ),
        };

        return normalizeMethodologySettings({
            orbs,
            balances: preferencesMetadata?.default_balance_targets || {},
            dignities: preferencesMetadata?.default_dignities || { version: 1, signs: {} },
        });
    }

    function getDefaultVisual() {
        return resolveVisualPreferences(preferencesMetadata?.default_visual_palettes || {});
    }

    function getDefaultAccountPreferences() {
        return {
            chart_defaults: {
                natal: normalizeViewSettings({}),
                biwheel: normalizeViewSettings({}),
                forecast_new: normalizeViewSettings({}),
                solar: normalizeViewSettings({}),
            },
            chart_creation_defaults: {
                house_system: 'P',
            },
            methodology: getDefaultMethodology(),
            visual: getDefaultVisual(),
        };
    }

    function getTimezoneLabelFormatSelect() {
        return document.getElementById('accountTimezoneLabelFormatSelect');
    }

    function getDateFormatSelect() {
        return document.getElementById('accountDateFormatSelect');
    }

    function getDegreeFormatSelect() {
        return document.getElementById('accountDegreeFormatSelect');
    }

    function getViewDom(viewId) {
        if (viewId === 'natal') {
            return {
                orientation: document.getElementById('natalOrientationSelect'),
                aspectScope: document.getElementById('natalAspectScopeSelect'),
                showApplyingSeparating: document.getElementById('natalShowApplyingSeparating'),
                showSpeed: document.getElementById('natalShowSpeed'),
                showStationary: document.getElementById('natalShowStationary'),
                showAspectText: document.getElementById('natalShowAspectText'),
            };
        }
        if (viewId === 'biwheel') {
            return {
                orientation: document.getElementById('biwheelOrientationSelectAccount'),
                aspectScope: document.getElementById('biwheelAspectScopeSelectAccount'),
                showApplyingSeparating: null,
                showSpeed: null,
                showStationary: null,
                showAspectText: document.getElementById('biwheelShowAspectTextAccount'),
            };
        }
        return {
            orientation: document.getElementById('solarOrientationSelectAccount'),
            aspectScope: document.getElementById('solarAspectScopeSelectAccount'),
            showApplyingSeparating: document.getElementById('solarShowApplyingSeparatingAccount'),
            showSpeed: document.getElementById('solarShowSpeedAccount'),
            showStationary: document.getElementById('solarShowStationaryAccount'),
            showAspectText: document.getElementById('solarShowAspectTextAccount'),
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
        return methodology?.orbs?.profiles?.[profileId]?.matrix || buildDefaultOrbMatrix(profileId);
    }

    function getOrbPairStrategy() {
        const select = document.getElementById('accountOrbPairStrategySelect');
        if (select) {
            return window.AstroPreferences?.normalizeOrbPairStrategy?.(select.value) || DEFAULT_ORB_PAIR_STRATEGY;
        }
        return normalizeMethodologySettings(accountPreferences?.methodology || getDefaultMethodology())?.orbs?.pair_strategy
            || DEFAULT_ORB_PAIR_STRATEGY;
    }

    function getSignLabel(sign) {
        return translateOrFallback(`astro.sign.${sign}`, window.Symbols?.signNamesRu?.[sign] || sign);
    }

    function getSignSymbol(sign) {
        return window.Symbols?.signs?.[sign] || String(sign || '').slice(0, 2) || '•';
    }

    function getSignSymbolMarkup(sign) {
        const label = escapeHtml(getSignLabel(sign));
        const symbol = escapeHtml(getSignSymbol(sign));
        return `<span class="astro-symbol" aria-hidden="true" title="${label}">${symbol}</span>`;
    }

    function getOppositeSign(sign) {
        return getMetadataSigns().find((item) => item?.name === sign)?.opposite || null;
    }

    function ensureDignitiesState() {
        const methodology = ensureMethodologyState();
        methodology.dignities = normalizeDignitySettings(
            methodology.dignities || {},
            preferencesMetadata?.default_dignities || {}
        );
        return methodology.dignities;
    }

    function buildDignityPlanetMatrix(dignities = {}) {
        const bodies = getDignityBodies();
        const matrix = Object.fromEntries(
            bodies.map((body) => [
                body,
                {
                    domicile_primary: [],
                    domicile_secondary: [],
                    detriment_primary: [],
                    detriment_secondary: [],
                    exaltation: [],
                    fall: [],
                },
            ])
        );

        getMetadataSigns().forEach((signMeta) => {
            const sign = signMeta?.name;
            const opposite = signMeta?.opposite;
            const entry = dignities?.signs?.[sign] || {};
            if (entry.ruler && matrix[entry.ruler]) {
                matrix[entry.ruler].domicile_primary.push(sign);
                if (opposite) matrix[entry.ruler].detriment_primary.push(opposite);
            }
            if (entry.co_ruler && matrix[entry.co_ruler]) {
                matrix[entry.co_ruler].domicile_secondary.push(sign);
                if (opposite) matrix[entry.co_ruler].detriment_secondary.push(opposite);
            }
            if (entry.exaltation && matrix[entry.exaltation]) {
                matrix[entry.exaltation].exaltation.push(sign);
                if (opposite) matrix[entry.exaltation].fall.push(opposite);
            }
        });

        return matrix;
    }

    function renderDignityGlyphs(signs = [], { mode = 'derived', secondarySigns = [] } = {}) {
        const secondary = new Set(secondarySigns || []);
        return getMetadataSigns().map((signMeta) => {
            const sign = signMeta?.name;
            const active = signs.includes(sign) || secondary.has(sign);
            const isSecondary = secondary.has(sign);
            const className = [
                'account-settings-dignity-glyph',
                active ? 'is-active' : '',
                isSecondary ? 'is-secondary' : '',
                mode === 'derived' ? 'is-derived' : '',
            ].filter(Boolean).join(' ');
            const label = escapeHtml(getSignLabel(sign));
            const stateKey = active
                ? (isSecondary ? 'page.accountSettings.dignities.states.secondary' : 'page.accountSettings.dignities.states.primary')
                : 'page.accountSettings.dignities.states.empty';
            const title = escapeHtml(`${label} · ${t(stateKey)}`);
            return `
                <button
                    type="button"
                    class="${className}"
                    data-dignity-mode="${mode}"
                    data-dignity-sign="${sign}"
                    title="${title}"
                    aria-label="${title}"
                    ${mode === 'derived' ? 'disabled' : ''}
                >${getSignSymbolMarkup(sign)}</button>
            `;
        }).join('');
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
            applyBtn.classList.toggle('hidden', activeOrbProfile === 'natal');
        }
    }

    function updateOrbViewModeUi() {
        const panel = document.getElementById('accountOrbMatrixPanel');
        const table = document.getElementById('accountOrbsTable');

        document.querySelectorAll('[data-orb-view-mode]').forEach((button) => {
            const isActive = button.dataset.orbViewMode === activeOrbViewMode;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        panel?.classList.toggle('is-compact', activeOrbViewMode === 'compact');
        table?.classList.toggle('is-compact', activeOrbViewMode === 'compact');
    }

    function setActiveVisualTab(tabId) {
        if (!VISUAL_PANEL_IDS.includes(tabId)) return;
        activeVisualTab = tabId;
        document.querySelectorAll('[data-visual-tab]').forEach((button) => {
            const isActive = button.dataset.visualTab === activeVisualTab;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
        document.querySelectorAll('[data-visual-panel]').forEach((panel) => {
            panel.classList.toggle('hidden', panel.dataset.visualPanel !== activeVisualTab);
        });
    }

    function getCssToken(value) {
        return String(value || '')
            .trim()
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function setPreviewColor(preview, token, value, fallback = '#6b7280') {
        const color = String(value || fallback).trim();
        preview.style.setProperty(token, /^#[0-9a-f]{6}$/i.test(color) ? color : fallback);
    }

    function updateVisualPreview(visual = {}) {
        const preview = document.getElementById('accountVisualWheelPreview');
        if (!preview) return;

        const resolvedVisual = resolveVisualPreferences(visual);
        const elementPalette = resolvedVisual?.planet_colors?.element_palette || {};
        const bodyOverrides = resolvedVisual?.planet_colors?.body_overrides || {};

        PREVIEW_ASPECT_TYPES.forEach((aspectType) => {
            const color = window.AstroPreferences?.getAspectColor
                ? window.AstroPreferences.getAspectColor(aspectType, resolvedVisual)
                : resolvedVisual?.aspect_colors?.[aspectType];
            setPreviewColor(preview, `--preview-aspect-${getCssToken(aspectType)}`, color);
        });

        Object.entries(PREVIEW_BODY_ELEMENTS).forEach(([body, element]) => {
            const color = bodyOverrides?.[body]
                || elementPalette?.[element]
                || getBodyDefaultDisplayColor(body, resolvedVisual);
            setPreviewColor(preview, `--preview-body-${getCssToken(body)}`, color);
        });

        preview.style.setProperty(
            '--preview-cusp',
            resolvedVisual?.wheel?.angular_cusps_black === true ? '#111827' : '#8d6f54'
        );
        preview.style.setProperty(
            '--preview-line-width',
            resolvedVisual?.wheel?.highlight_exact_aspects === false ? '1.5px' : '2.5px'
        );
    }

    function syncOrbMatrixFromDom() {
        const methodology = ensureMethodologyState();
        const matrix = buildDefaultOrbMatrix(activeOrbProfile);
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

    function setActiveOrbViewMode(viewMode) {
        if (!['default', 'compact'].includes(viewMode)) return;
        activeOrbViewMode = viewMode;
        localStorage.setItem(ORB_VIEW_MODE_STORAGE_KEY, viewMode);
        updateOrbViewModeUi();
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
            const symbolMarkup = getBodySymbolMarkup(body, { size: 18, title: getBodyLabel(body) });

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
                            <span class="account-settings-body-badge" title="${label}" aria-label="${label}" role="img" tabindex="0">${symbolMarkup}</span>
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
        const matrix = normalizedMethodology?.orbs?.profiles?.[activeOrbProfile]?.matrix || buildDefaultOrbMatrix(activeOrbProfile);

        headerRow.innerHTML = `
            <th class="account-settings-orb-corner"></th>
            ${bodies.map((body) => {
                const label = escapeHtml(getBodyLabel(body));
                const symbolMarkup = getBodySymbolMarkup(body, { size: 18, title: getBodyLabel(body) });
                return `
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${label}" aria-label="${label}" role="img" tabindex="0">
                                ${symbolMarkup}
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
        updateOrbViewModeUi();
    }

    function renderDignitiesMatrix(methodology = {}) {
        const tbody = document.getElementById('accountDignitiesMatrixBody');
        if (!tbody) return;

        const dignities = normalizeDignitySettings(
            methodology?.dignities || {},
            preferencesMetadata?.default_dignities || {}
        );
        const matrix = buildDignityPlanetMatrix(dignities);

        tbody.innerHTML = getDignityBodies().map((body) => {
            const bodyLabel = escapeHtml(getBodyLabel(body));
            const bodyState = matrix[body] || {
                domicile_primary: [],
                domicile_secondary: [],
                detriment_primary: [],
                detriment_secondary: [],
                exaltation: [],
                fall: [],
            };

            return `
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${bodyLabel}" aria-label="${bodyLabel}" role="img" tabindex="0">
                                ${getBodySymbolMarkup(body, { size: 18, title: getBodyLabel(body) })}
                            </span>
                        </span>
                    </th>
                    <td>
                        <div class="account-settings-dignity-stack" data-dignity-cell="domicile" data-dignity-planet="${body}">
                            ${renderDignityGlyphs(bodyState.domicile_primary, {
                                mode: 'domicile',
                                secondarySigns: bodyState.domicile_secondary,
                            })}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack account-settings-dignity-stack--derived">
                            ${renderDignityGlyphs(bodyState.detriment_primary, {
                                mode: 'derived',
                                secondarySigns: bodyState.detriment_secondary,
                            })}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack" data-dignity-cell="exaltation" data-dignity-planet="${body}">
                            ${renderDignityGlyphs(bodyState.exaltation, { mode: 'exaltation' })}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack account-settings-dignity-stack--derived">
                            ${renderDignityGlyphs(bodyState.fall, { mode: 'derived' })}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function setDomicileAssignment(sign, planet) {
        const dignities = ensureDignitiesState();
        const current = {
            ...(dignities.signs?.[sign] || {}),
        };

        if (current.ruler === planet) {
            if (current.co_ruler) {
                current.ruler = current.co_ruler;
                current.co_ruler = null;
            } else {
                current.ruler = null;
            }
        } else if (current.co_ruler === planet) {
            current.co_ruler = null;
        } else if (!current.ruler) {
            current.ruler = planet;
        } else {
            current.co_ruler = planet;
        }

        dignities.signs[sign] = current;
        ensureMethodologyState().dignities = normalizeDignitySettings(
            dignities,
            preferencesMetadata?.default_dignities || {}
        );
    }

    function setExaltationAssignment(sign, planet) {
        const dignities = ensureDignitiesState();
        const current = {
            ...(dignities.signs?.[sign] || {}),
        };

        current.exaltation = current.exaltation === planet ? null : planet;
        dignities.signs[sign] = current;
        ensureMethodologyState().dignities = normalizeDignitySettings(
            dignities,
            preferencesMetadata?.default_dignities || {}
        );
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
                                ${getBodySymbolMarkup(body, { size: 18, title: getBodyLabel(body) })}
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
                                ${getBodySymbolMarkup(body, { size: 18, title: getBodyLabel(body) })}
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
        const resolvedVisual = resolveVisualPreferences(visual);

        tbody.innerHTML = getMetadataAspectTypes().map((aspectMeta) => {
            const aspectType = aspectMeta.aspect_type;
            const color = window.AstroPreferences?.getAspectColor
                ? window.AstroPreferences.getAspectColor(aspectType, resolvedVisual)
                : '#9ca3af';
            return `
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${escapeHtml(getAspectLabel(aspectType))}" aria-label="${escapeHtml(getAspectLabel(aspectType))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${escapeHtml(getAspectSymbol(aspectType))}</span>
                            </span>
                        </span>
                    </th>
                    <td>
                        <input
                            type="color"
                            class="account-settings-color-input account-settings-swatch-input"
                            value="${escapeHtml(color)}"
                            data-aspect-color="${aspectType}"
                            aria-label="${escapeHtml(getAspectLabel(aspectType))}"
                        >
                    </td>
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
        const angularCuspsToggle = document.getElementById('accountAngularCuspsBlackToggle');
        if (angularCuspsToggle) {
            angularCuspsToggle.checked = resolvedVisual?.wheel?.angular_cusps_black === true;
        }
        const exactAspectHighlightToggle = document.getElementById('accountExactAspectHighlightToggle');
        if (exactAspectHighlightToggle) {
            exactAspectHighlightToggle.checked = resolvedVisual?.wheel?.highlight_exact_aspects !== false;
        }

        elementBody.innerHTML = Object.keys(elementPalette).map((element) => `
            <tr>
                <th scope="row">${escapeHtml(element)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${escapeHtml(elementPalette[element])}" data-element-color="${element}" aria-label="${escapeHtml(element)}"></td>
            </tr>
        `).join('');

        overridesBody.innerHTML = getMetadataBodies().map((body) => {
            const defaultDisplayColor = getBodyDefaultDisplayColor(body, resolvedVisual);
            const isOverrideActive = Boolean(bodyOverrides?.[body]);
            const displayedColor = bodyOverrides?.[body] || defaultDisplayColor;

            return `
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
                                value="${escapeHtml(displayedColor)}"
                                data-body-color-override="${body}"
                                data-body-color-active="${isOverrideActive ? 'true' : 'false'}"
                                data-body-color-default="${escapeHtml(defaultDisplayColor)}"
                                aria-label="${escapeHtml(getBodyLabel(body))}"
                            >
                            <button
                                type="button"
                                class="account-settings-reset-chip${isOverrideActive ? '' : ' is-muted'}"
                                data-clear-body-color-override="${body}"
                                title="${escapeHtml(t('common.reset'))}"
                                aria-label="${escapeHtml(`${t('common.reset')}: ${getBodyLabel(body)}`)}"
                            >↺</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function populateForm(preferences, { updateBaseline = false } = {}) {
        const normalized = {
            ...getDefaultAccountPreferences(),
            ...(preferences || {}),
            chart_defaults: {
                natal: normalizeViewSettings(preferences?.chart_defaults?.natal || {}),
                biwheel: normalizeViewSettings(preferences?.chart_defaults?.biwheel || {}),
                forecast_new: normalizeViewSettings(preferences?.chart_defaults?.forecast_new || {}),
                solar: normalizeViewSettings(preferences?.chart_defaults?.solar || {}),
            },
            chart_creation_defaults: {
                house_system: preferences?.chart_creation_defaults?.house_system || 'P',
            },
            methodology: normalizeMethodologySettings(preferences?.methodology || getDefaultMethodology()),
            visual: resolveVisualPreferences(preferences?.visual || getDefaultVisual()),
        };

        accountPreferences = normalized;
        if (updateBaseline) {
            persistedMethodologyBaseline = deepClone(normalized.methodology);
        }
        window.AstroPreferences?.setAccountVisualPreferences?.(normalized.visual);
        if (!ORB_PROFILE_IDS.includes(activeOrbProfile)) activeOrbProfile = 'natal';

        const houseSystemSelect = document.getElementById('accountHouseSystemSelect');
        if (houseSystemSelect) {
            houseSystemSelect.value = normalized.chart_creation_defaults.house_system || 'P';
        }
        const globalViewOptions = normalized.chart_defaults.natal?.view_options || {};
        const globalTableOptions = normalized.chart_defaults.natal?.table_options || {};
        const orientationSelect = document.getElementById('accountOrientationSelect');
        if (orientationSelect) {
            orientationSelect.value = globalViewOptions.orientation === 'asc' ? 'asc' : 'aries';
        }
        const houseNumberStyleSelect = document.getElementById('accountHouseNumberStyleSelect');
        if (houseNumberStyleSelect) {
            houseNumberStyleSelect.value = globalViewOptions.house_number_style === 'roman' ? 'roman' : 'arabic';
        }
        const houseLabelsOutsideToggle = document.getElementById('accountHouseLabelsOutsideToggle');
        if (houseLabelsOutsideToggle) {
            houseLabelsOutsideToggle.checked = globalViewOptions.house_labels_outside === true;
        }
        const showAspectTextToggle = document.getElementById('accountShowAspectTextToggle');
        if (showAspectTextToggle) {
            showAspectTextToggle.checked = globalTableOptions.show_aspect_text === true;
        }
        const angularCuspsBoldToggle = document.getElementById('accountAngularCuspsBoldToggle');
        if (angularCuspsBoldToggle) {
            angularCuspsBoldToggle.checked = globalViewOptions.bold_asc_dsc !== false && globalViewOptions.bold_mc_ic !== false;
        }
        const timezoneLabelFormatSelect = getTimezoneLabelFormatSelect();
        if (timezoneLabelFormatSelect) {
            timezoneLabelFormatSelect.value = normalized.visual?.timezone_label_format === 'GMT' ? 'GMT' : 'UTC';
        }
        const dateFormatSelect = getDateFormatSelect();
        if (dateFormatSelect) {
            const resolvedDateFormat = ['DD_MM_YYYY', 'MM_DD_YYYY', 'YYYY_MM_DD', 'LOCALE'].includes(normalized.visual?.date_format)
                ? normalized.visual.date_format
                : 'DD_MM_YYYY';
            dateFormatSelect.value = resolvedDateFormat;
        }
        const degreeFormatSelect = getDegreeFormatSelect();
        if (degreeFormatSelect) {
            const resolvedDegreeFormat = ['DEGREES_ONLY', 'DEGREES_MINUTES', 'DEGREES_MINUTES_SECONDS'].includes(normalized.visual?.degree_format)
                ? normalized.visual.degree_format
                : 'DEGREES_ONLY';
            degreeFormatSelect.value = resolvedDegreeFormat;
        }

        const orbPairStrategySelect = document.getElementById('accountOrbPairStrategySelect');
        if (orbPairStrategySelect) {
            orbPairStrategySelect.value = normalized.methodology?.orbs?.pair_strategy || DEFAULT_ORB_PAIR_STRATEGY;
        }
        const stationaryThresholdInput = document.getElementById('accountStationaryThresholdPercent');
        if (stationaryThresholdInput) {
            stationaryThresholdInput.value = String(normalized.methodology?.stationary?.threshold_percent ?? 5);
        }

        VIEW_IDS.forEach((viewId) => {
            const view = normalized.chart_defaults[viewId];
            const dom = getViewDom(viewId);
            if (dom.orientation) dom.orientation.value = view.view_options?.orientation === 'asc' ? 'asc' : 'aries';
            if (dom.aspectScope) dom.aspectScope.value = view.aspects?.scope || (viewId === 'biwheel' ? 'major' : 'all');
            if (dom.showApplyingSeparating) dom.showApplyingSeparating.checked = view.aspects?.show_applying_separating === true;
            if (dom.showSpeed) dom.showSpeed.checked = view.table_options?.show_speed !== false;
            if (dom.showStationary) dom.showStationary.checked = view.table_options?.show_stationary !== false;
            if (dom.showAspectText) dom.showAspectText.checked = view.table_options?.show_aspect_text === true;
        });

        renderAspectTypesMatrix(normalized.chart_defaults);
        renderBodiesMatrix(normalized.chart_defaults);
        renderOrbsMatrix(normalized.methodology);
        renderDignitiesMatrix(normalized.methodology);
        renderBalanceWeights(normalized.methodology);
        renderAspectColors(normalized.visual);
        renderPlanetColors(normalized.visual);
        updateVisualPreview(normalized.visual);
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
                show_aspect_text: dom.showAspectText?.checked === true,
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
            stationary: {
                threshold_percent: Number.parseFloat(
                    document.getElementById('accountStationaryThresholdPercent')?.value || '5'
                ),
            },
            dignities: normalizeDignitySettings(
                accountPreferences?.methodology?.dignities || ensureDignitiesState(),
                preferencesMetadata?.default_dignities || {}
            ),
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
            wheel: {
                angular_cusps_black: document.getElementById('accountAngularCuspsBlackToggle')?.checked === true,
                highlight_exact_aspects: document.getElementById('accountExactAspectHighlightToggle')?.checked !== false,
            },
            timezone_label_format: getTimezoneLabelFormatSelect()?.value || 'UTC',
            date_format: getDateFormatSelect()?.value || 'DD_MM_YYYY',
            degree_format: getDegreeFormatSelect()?.value || 'DEGREES_ONLY',
        });
    }

    function collectGlobalViewSettings() {
        const orientation = document.getElementById('accountOrientationSelect')?.value === 'asc' ? 'asc' : 'aries';
        const houseNumberStyle = document.getElementById('accountHouseNumberStyleSelect')?.value === 'roman' ? 'roman' : 'arabic';
        const houseLabelsOutside = document.getElementById('accountHouseLabelsOutsideToggle')?.checked === true;
        const showAspectText = document.getElementById('accountShowAspectTextToggle')?.checked === true;
        const angularCuspsBold = document.getElementById('accountAngularCuspsBoldToggle')?.checked !== false;
        return {
            table_options: {
                show_aspect_text: showAspectText,
            },
            view_options: {
                orientation,
                house_number_style: houseNumberStyle,
                house_labels_outside: houseLabelsOutside,
                bold_asc_dsc: angularCuspsBold,
                bold_mc_ic: angularCuspsBold,
            },
        };
    }

    function collectPayload() {
        const globalViewSettings = collectGlobalViewSettings();
        return {
            chart_creation_defaults: {
                house_system: document.getElementById('accountHouseSystemSelect')?.value || 'P',
            },
            chart_defaults: {
                natal: deepClone(globalViewSettings),
                biwheel: deepClone(globalViewSettings),
                forecast_new: deepClone(globalViewSettings),
                solar: deepClone(globalViewSettings),
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

    function scrollToAccountSettingsTop() {
        const header = document.querySelector('.account-settings-header');
        if (header instanceof HTMLElement) {
            header.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function refreshCurrentChartSnapshot() {
        const userId = localStorage.getItem('currentUserId');
        if (!userId || !window.AstroAPI?.getNatalChart) return;

        try {
            const chart = await window.AstroAPI.getNatalChart(userId);
            window.AstroAPI?.saveChartToSession?.(chart);
        } catch (error) {
            console.warn('Failed to refresh current chart after methodology recalculation:', error);
        }
    }

    function renderJobStatus(job, { final = false } = {}) {
        const container = document.getElementById('methodologyJobStatus');
        if (!container) return;
        if (!job) {
            container.classList.add('hidden');
            container.replaceChildren();
            return;
        }

        const total = Number(job.progress_total || 0);
        const done = Number(job.progress_done || 0);
        const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
        const status = String(job.status || 'pending');
        const failures = Number(job.failed_count || 0);
        const titleByStatus = {
            pending: 'Карты ожидают пересчета',
            running: 'Карты пересчитываются с учетом новых настроек',
            completed: failures ? 'Пересчет завершен с ошибками' : 'Пересчет карт завершен',
            failed: 'Пересчет карт не выполнен',
        };
        const statusLabelByStatus = {
            pending: 'ОЖИДАНИЕ',
            running: 'В ПРОЦЕССЕ',
            completed: failures ? 'С ОШИБКАМИ' : 'ГОТОВО',
            failed: 'ОШИБКА',
        };
        const metaParts = [
            total > 0 ? `${done}/${total} карт` : 'Подготовка списка карт',
            `${percent}%`,
        ];
        if (failures) {
            metaParts.push(`ошибок: ${failures}`);
        }
        if (!final && status !== 'completed' && status !== 'failed') {
            metaParts.push('можно остаться на странице и дождаться завершения');
        }

        container.innerHTML = `
            <div class="account-settings-status-title">
                <span>${escapeHtml(titleByStatus[status] || 'Пересчет карт')}</span>
                <span>${escapeHtml(statusLabelByStatus[status] || String(status).toUpperCase())}</span>
            </div>
            <div class="account-settings-status-meta">${escapeHtml(metaParts.join(' · '))}</div>
            <div class="account-settings-status-progress" aria-hidden="true">
                <div class="account-settings-status-progress-bar" style="--progress: ${percent}%"></div>
            </div>
        `;
        container.classList.remove('hidden');
        container.dataset.status = status;
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
                    showToast(
                        job.failed_count
                            ? `Пересчет завершен с ошибками: ${job.failed_count}.`
                            : 'Пересчет карт завершен.',
                        job.failed_count ? 'info' : 'success',
                    );
                    await refreshCurrentChartSnapshot();
                    stopPollingJob();
                    return;
                }
                if (job.status === 'failed') {
                    sessionStorage.removeItem(ACTIVE_RECALC_JOB_KEY);
                    showToast(job.error || 'Пересчет карт не выполнен.', 'error');
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
        const onboardingResetSetting = document.getElementById('onboardingResetSetting');
        const onboardingAvailable = ['trial', 'pro'].includes(String(me.plan_code || '').toLowerCase());
        onboardingResetSetting?.classList.toggle('onboarding-hidden', !onboardingAvailable);

        const subtitle = document.getElementById('accountSettingsSubtitle');
        if (subtitle) {
            subtitle.textContent = me.email
                ? t('page.accountSettings.subtitleWithEmail', { email: me.email })
                : t('page.accountSettings.subtitle');
        }
        renderAccountPlan(me);

        const [metadata, preferences] = await Promise.all([
            window.AstroAPI.getPreferencesMetadata?.(),
            window.AstroAPI.getAccountPreferences(),
        ]);
        preferencesMetadata = metadata || null;
        populateForm(preferences, { updateBaseline: true });

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
            const priorityUserId = localStorage.getItem('currentUserId') || null;
            const methodologyChanged = !deepEqual(
                normalizeMethodologySettings(persistedMethodologyBaseline || {}),
                payload.methodology
            );
            const defaultHouseSystemChanged = (
                (accountPreferences?.chart_creation_defaults?.house_system || 'P')
                !== (payload.chart_creation_defaults?.house_system || 'P')
            );
            const updated = await window.AstroAPI.patchAccountPreferences(payload);
            populateForm(updated, { updateBaseline: true });

            if ((methodologyChanged || defaultHouseSystemChanged) && window.AstroAPI?.createPreferenceRecalcJob) {
                const job = await window.AstroAPI.createPreferenceRecalcJob({
                    job_type: 'methodology_recalc',
                    payload: {
                        source: 'account-settings',
                        ...(priorityUserId ? { priority_user_id: priorityUserId } : {}),
                    },
                });
                renderJobStatus(job);
                pollRecalcJob(job.job_id).catch((error) => {
                    console.warn('Failed to poll methodology recalculation job:', error);
                });
                showToast('Настройки сохранены. Карты пересчитываются с учетом новых настроек.', 'success');
                requestAnimationFrame(scrollToAccountSettingsTop);
                return;
            }

            showToast(t('page.accountSettings.toasts.saved'), 'success');
            requestAnimationFrame(scrollToAccountSettingsTop);
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

    function closeResetConfirmDialog({ restoreFocus = true } = {}) {
        const dialog = document.getElementById('accountSettingsResetConfirmDialog');
        const backdrop = document.getElementById('accountSettingsResetConfirmBackdrop');
        if (dialog) dialog.classList.add('hidden');
        if (backdrop) backdrop.classList.add('hidden');
        document.body.classList.remove('account-settings-modal-open');
        if (restoreFocus && lastFocusedElementBeforeResetConfirm instanceof HTMLElement) {
            lastFocusedElementBeforeResetConfirm.focus();
        }
        lastFocusedElementBeforeResetConfirm = null;
    }

    function openResetConfirmDialog() {
        const dialog = document.getElementById('accountSettingsResetConfirmDialog');
        const backdrop = document.getElementById('accountSettingsResetConfirmBackdrop');
        const confirmBtn = document.getElementById('accountSettingsResetConfirmSubmit');
        if (!dialog || !backdrop) return;
        lastFocusedElementBeforeResetConfirm = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        backdrop.classList.remove('hidden');
        dialog.classList.remove('hidden');
        document.body.classList.add('account-settings-modal-open');
        requestAnimationFrame(() => {
            confirmBtn?.focus();
        });
    }

    document.addEventListener('DOMContentLoaded', async () => {
        activeOrbViewMode = localStorage.getItem(ORB_VIEW_MODE_STORAGE_KEY) === 'compact' ? 'compact' : 'default';
        configureAccountSettingsBackLink();

        const saveBtn = document.getElementById('saveAccountSettingsBtn');
        const restoreBtn = document.getElementById('restoreStandardDefaultsBtn');
        const applyNatalOrbsBtn = document.getElementById('accountApplyNatalOrbsBtn');
        const orbMatrixBody = document.getElementById('accountOrbsMatrixBody');
        const dignityMatrixBody = document.getElementById('accountDignitiesMatrixBody');
        const bodyOverrideColorsBody = document.getElementById('accountBodyOverrideColorsBody');
        const resetConfirmDialog = document.getElementById('accountSettingsResetConfirmDialog');
        const resetConfirmBackdrop = document.getElementById('accountSettingsResetConfirmBackdrop');
        const resetConfirmCloseBtn = document.getElementById('accountSettingsResetConfirmClose');
        const resetConfirmCancelBtn = document.getElementById('accountSettingsResetConfirmCancel');
        const resetConfirmSubmitBtn = document.getElementById('accountSettingsResetConfirmSubmit');
        const onboardingResetBtn = document.getElementById('onboardingResetBtn');

        saveBtn?.addEventListener('click', () => {
            savePreferences();
        });
        restoreBtn?.addEventListener('click', () => {
            openResetConfirmDialog();
        });
        resetConfirmBackdrop?.addEventListener('click', () => {
            closeResetConfirmDialog();
        });
        resetConfirmCloseBtn?.addEventListener('click', () => {
            closeResetConfirmDialog();
        });
        resetConfirmCancelBtn?.addEventListener('click', () => {
            closeResetConfirmDialog();
        });
        resetConfirmSubmitBtn?.addEventListener('click', () => {
            closeResetConfirmDialog({ restoreFocus: false });
            restoreStandardDefaults();
        });
        onboardingResetBtn?.addEventListener('click', async () => {
            onboardingResetBtn.disabled = true;
            try {
                await window.AstroOnboarding?.reset?.();
                showToast(t('page.onboarding.settings.resetDone'), 'success');
            } catch (error) {
                showToast(error.message || t('page.accountSettings.toasts.saveFailed'), 'error');
            } finally {
                onboardingResetBtn.disabled = false;
            }
        });
        document.querySelectorAll('[data-orb-profile-tab]').forEach((button) => {
            button.addEventListener('click', () => {
                setActiveOrbProfile(button.dataset.orbProfileTab || 'natal');
            });
        });
        document.querySelectorAll('[data-orb-view-mode]').forEach((button) => {
            button.addEventListener('click', () => {
                setActiveOrbViewMode(button.dataset.orbViewMode || 'default');
            });
        });
        document.querySelectorAll('[data-visual-tab]').forEach((button) => {
            button.addEventListener('click', () => {
                setActiveVisualTab(button.dataset.visualTab || 'aspectColors');
            });
        });
        setActiveVisualTab(activeVisualTab);
        applyNatalOrbsBtn?.addEventListener('click', () => {
            if (activeOrbProfile === 'natal') return;
            syncOrbMatrixFromDom();
            const methodology = ensureMethodologyState();
            methodology.orbs.profiles[activeOrbProfile] = {
                matrix: JSON.parse(JSON.stringify(getOrbProfileMatrix('natal'))),
            };
            renderOrbsMatrix(methodology);
            showToast(t('page.accountSettings.toasts.orbsCopied'), 'info');
        });
        orbMatrixBody?.addEventListener('input', (event) => {
            const input = event.target;
            if (!(input instanceof HTMLInputElement)) return;
            if (!input.dataset.orbAspectType || !input.dataset.orbBody) return;
            const methodology = ensureMethodologyState();
            const profile = methodology.orbs.profiles[activeOrbProfile] || { matrix: buildDefaultOrbMatrix(activeOrbProfile) };
            const nextMatrix = profile.matrix || buildDefaultOrbMatrix(activeOrbProfile);
            if (!nextMatrix[input.dataset.orbAspectType]) {
                nextMatrix[input.dataset.orbAspectType] = {};
            }
            nextMatrix[input.dataset.orbAspectType][input.dataset.orbBody] = Number.parseFloat(input.value) || 0;
            methodology.orbs.profiles[activeOrbProfile] = { matrix: nextMatrix };
        });
        dignityMatrixBody?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-dignity-mode][data-dignity-sign]');
            if (!(button instanceof HTMLButtonElement)) return;
            const mode = button.dataset.dignityMode;
            const sign = button.dataset.dignitySign;
            const planet = button.closest('[data-dignity-planet]')?.dataset?.dignityPlanet;
            if (!mode || !sign || !planet || mode === 'derived') return;

            if (mode === 'domicile') {
                setDomicileAssignment(sign, planet);
            } else if (mode === 'exaltation') {
                setExaltationAssignment(sign, planet);
            }

            renderDignitiesMatrix(accountPreferences?.methodology || ensureMethodologyState());
        });
        bodyOverrideColorsBody?.addEventListener('input', (event) => {
            const input = event.target;
            if (!(input instanceof HTMLInputElement)) return;
            if (!input.dataset.bodyColorOverride) return;
            input.dataset.bodyColorActive = 'true';
            const resetButton = bodyOverrideColorsBody.querySelector(`[data-clear-body-color-override="${input.dataset.bodyColorOverride}"]`);
            resetButton?.classList.remove('is-muted');
            updateVisualPreview(collectVisual());
        });
        bodyOverrideColorsBody?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-clear-body-color-override]');
            if (!(button instanceof HTMLElement)) return;
            const body = button.dataset.clearBodyColorOverride;
            if (!body) return;
            const input = bodyOverrideColorsBody.querySelector(`[data-body-color-override="${body}"]`);
            if (!(input instanceof HTMLInputElement)) return;
            input.dataset.bodyColorActive = 'false';
            input.value = input.dataset.bodyColorDefault || '#6b7280';
            button.classList.add('is-muted');
            updateVisualPreview(collectVisual());
        });
        document.addEventListener('input', (event) => {
            const input = event.target;
            if (!(input instanceof HTMLInputElement)) return;
            if (!input.matches('[data-aspect-color], [data-element-color]')) return;
            updateVisualPreview(collectVisual());
        });
        document.addEventListener('change', (event) => {
            const input = event.target;
            if (!(input instanceof HTMLInputElement)) return;
            if (!input.matches('[data-aspect-color], [data-element-color], #accountAngularCuspsBlackToggle, #accountExactAspectHighlightToggle')) return;
            updateVisualPreview(collectVisual());
        });

        try {
            await window.FrontendI18n?.ready?.catch?.(() => {});
            await loadPreferences();
            document.addEventListener('frontend:locale-changed', () => {
                if (accountPreferences) {
                    populateForm(accountPreferences);
                }
            });
            document.addEventListener('keydown', (event) => {
                if (event.key !== 'Escape') return;
                if (!resetConfirmDialog || resetConfirmDialog.classList.contains('hidden')) return;
                closeResetConfirmDialog();
            });
        } catch (error) {
            showToast(error.message || t('page.accountSettings.toasts.loadFailed'), 'error');
            hidePageLoader();
        }
    });
})();

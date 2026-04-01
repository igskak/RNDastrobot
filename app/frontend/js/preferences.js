(function (root) {
    'use strict';

    const MATRIX_BODIES = [
        'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
        'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
        'Chiron', 'Proserpina',
        'TrueNode', 'SouthNode',
        'BlackMoon', 'WhiteMoon', 'PartOfFortune',
        'ASC', 'DSC', 'MC', 'IC', 'Vertex', 'AntiVertex',
    ];
    const DEFAULT_ASPECT_COLORS = {
        Conjunction: '#f59e0b',
        Opposition: '#ef4444',
        Square: '#ef4444',
        Trine: '#3b82f6',
        Sextile: '#22c55e',
        Quincunx: '#8b5cf6',
        Semisextile: '#14b8a6',
        Quintile: '#ec4899',
        Biquintile: '#ec4899',
        Semisquare: '#f97316',
        Sesquiquadrate: '#f97316',
    };
    const DEFAULT_ASPECT_HARMONY_COLORS = {
        harmonious: '#3b82f6',
        tense: '#ef4444',
        neutral: '#9ca3af',
    };
    const ASPECT_HARMONY_BY_TYPE = {
        Conjunction: 'neutral',
        Opposition: 'tense',
        Square: 'tense',
        Trine: 'harmonious',
        Sextile: 'harmonious',
        Vigintile: 'neutral',
        Semi_Nonagon: 'neutral',
        Semisextile: 'harmonious',
        SemiSextile: 'harmonious',
        Decile: 'neutral',
        Nonagon: 'neutral',
        Semisquare: 'tense',
        SemiSquare: 'tense',
        Quintile: 'neutral',
        Binonagon: 'neutral',
        Sentagon: 'neutral',
        Tridecile: 'neutral',
        Sesquiquadrate: 'tense',
        Biquintile: 'neutral',
        Quincunx: 'harmonious',
    };
    const DEFAULT_ELEMENT_PALETTE = {
        Fire: '#ef4444',
        Earth: '#22c55e',
        Air: '#eab308',
        Water: '#3b82f6',
    };
    const MAJOR_ASPECT_TYPES = [
        'Conjunction',
        'Opposition',
        'Trine',
        'Square',
        'Sextile',
    ];
    const DEFAULT_ENABLED_ASPECT_TYPES = [
        ...MAJOR_ASPECT_TYPES,
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
    const ORB_PROFILE_IDS = ['natal', 'prognostic'];
    const DEFAULT_ORB_PAIR_STRATEGY = 'larger';
    const DEFAULT_STATIONARY_THRESHOLD_PERCENT = 5;
    const BODY_NAME_ALIASES = {
        TrueNorthNode: 'TrueNode',
        TrueSouthNode: 'SouthNode',
        Fortune: 'PartOfFortune',
    };
    let accountVisualPreferences = {
        aspect_harmony_colors: { ...DEFAULT_ASPECT_HARMONY_COLORS },
        aspect_colors: { ...DEFAULT_ASPECT_COLORS },
        planet_colors: {
            element_palette: { ...DEFAULT_ELEMENT_PALETTE },
            body_overrides: {},
        },
    };

    function deepClone(value) {
        if (value === null || value === undefined) return value;
        return JSON.parse(JSON.stringify(value));
    }

    function isPlainObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value);
    }

    function deepMerge(base, overlay) {
        const result = deepClone(base) || {};
        Object.entries(overlay || {}).forEach(([key, value]) => {
            if (isPlainObject(value) && isPlainObject(result[key])) {
                result[key] = deepMerge(result[key], value);
                return;
            }
            result[key] = deepClone(value);
        });
        return result;
    }

    function deepEqual(left, right) {
        return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
    }

    function buildSparseDiff(base, value) {
        if (deepEqual(base, value)) return undefined;

        if (Array.isArray(value) || Array.isArray(base)) {
            return deepClone(value);
        }

        if (!isPlainObject(value) || !isPlainObject(base)) {
            return deepClone(value);
        }

        const diff = {};
        Object.keys(value).forEach((key) => {
            const next = buildSparseDiff(base[key], value[key]);
            if (next !== undefined) {
                diff[key] = next;
            }
        });
        return Object.keys(diff).length ? diff : undefined;
    }

    function ensureMatrixRows(rows = {}) {
        const ensured = {};
        MATRIX_BODIES.forEach((body) => {
            ensured[body] = {
                display: rows?.[body]?.display !== false,
                aspecting: rows?.[body]?.aspecting !== false,
            };
        });
        Object.keys(rows || {}).forEach((body) => {
            if (!ensured[body]) {
                ensured[body] = {
                    display: rows?.[body]?.display !== false,
                    aspecting: rows?.[body]?.aspecting !== false,
                };
            }
        });
        return ensured;
    }

    function getHiddenBodiesFromMatrix(rows = {}) {
        return Object.entries(ensureMatrixRows(rows))
            .filter(([, cfg]) => cfg?.display === false)
            .map(([body]) => body);
    }

    function buildMatrixRowsFromHiddenBodies(hiddenBodies = [], existingRows = {}) {
        const hidden = new Set(hiddenBodies || []);
        const rows = ensureMatrixRows(existingRows);
        Object.keys(rows).forEach((body) => {
            const visible = !hidden.has(body);
            rows[body] = {
                display: visible,
                aspecting: visible,
            };
        });
        return rows;
    }

    function normalizeMatrixBodyName(name) {
        return BODY_NAME_ALIASES[String(name || '')] || name;
    }

    function getKnownAspectTypes(availableAspectTypes = []) {
        const known = new Set(DEFAULT_ENABLED_ASPECT_TYPES);
        (availableAspectTypes || []).forEach((aspectType) => {
            if (aspectType) known.add(aspectType);
        });
        return [...known];
    }

    function normalizeEnabledAspectTypes(enabledAspectTypes, fallbackAspectTypes = DEFAULT_ENABLED_ASPECT_TYPES) {
        const fallback = getKnownAspectTypes(fallbackAspectTypes);
        if (!Array.isArray(enabledAspectTypes) || !enabledAspectTypes.length) {
            return [...fallback];
        }

        const normalized = [];
        enabledAspectTypes.forEach((aspectType) => {
            if (!aspectType || normalized.includes(aspectType)) return;
            normalized.push(aspectType);
        });
        return normalized.length ? normalized : [...fallback];
    }

    function getAspectFamilyTypes(aspectScope = 'all', availableAspectTypes = []) {
        const knownAspectTypes = getKnownAspectTypes(availableAspectTypes);
        if (aspectScope === 'all') {
            return knownAspectTypes;
        }
        return knownAspectTypes.filter((aspectType) => (
            aspectScope === 'major'
                ? MAJOR_ASPECT_TYPES.includes(aspectType)
                : !MAJOR_ASPECT_TYPES.includes(aspectType)
        ));
    }

    function isExactAspectFamilySelection(enabledAspectTypes = [], aspectScope = 'all', availableAspectTypes = []) {
        const familyAspectTypes = getAspectFamilyTypes(aspectScope, availableAspectTypes);
        const normalized = normalizeEnabledAspectTypes(enabledAspectTypes, familyAspectTypes);
        return (
            normalized.length === familyAspectTypes.length
            && normalized.every((aspectType) => familyAspectTypes.includes(aspectType))
        );
    }

    function healEnabledAspectTypesForScope(enabledAspectTypes = [], aspectScope = 'all', availableAspectTypes = []) {
        const knownAspectTypes = getKnownAspectTypes(availableAspectTypes);
        const normalized = normalizeEnabledAspectTypes(enabledAspectTypes, knownAspectTypes);

        if (aspectScope !== 'all') {
            return normalized;
        }

        if (
            isExactAspectFamilySelection(normalized, 'major', knownAspectTypes)
            || isExactAspectFamilySelection(normalized, 'minor', knownAspectTypes)
        ) {
            return [...knownAspectTypes];
        }

        return normalized;
    }

    function resolveEnabledAspectTypesForScope({
        enabledAspectTypes,
        aspectScope = 'all',
        availableAspectTypes = [],
    } = {}) {
        const knownAspectTypes = getKnownAspectTypes(availableAspectTypes);
        const normalized = healEnabledAspectTypesForScope(enabledAspectTypes, aspectScope, knownAspectTypes);

        if (aspectScope === 'all') {
            return new Set(normalized);
        }

        const scopedAspectTypes = getAspectFamilyTypes(aspectScope, knownAspectTypes);
        const intersection = normalized.filter((aspectType) => scopedAspectTypes.includes(aspectType));

        if (intersection.length) {
            return new Set(intersection);
        }

        return new Set(scopedAspectTypes);
    }

    function filterChartDataByViewPreferences(chartData = {}, options = {}) {
        const rows = ensureMatrixRows(options?.matrixRows || {});
        const visibleBodies = new Set();
        const aspectingBodies = new Set();

        Object.entries(rows).forEach(([body, config]) => {
            if (config?.display !== false) visibleBodies.add(body);
            if (config?.aspecting !== false) aspectingBodies.add(body);
        });

        const availableAspectTypes = (chartData?.aspects || [])
            .map((aspect) => aspect?.aspect_type)
            .filter(Boolean);
        const enabledAspectTypes = resolveEnabledAspectTypesForScope({
            enabledAspectTypes: options?.enabledAspectTypes,
            aspectScope: options?.aspectScope || 'all',
            availableAspectTypes,
        });

        const bodyIsVisible = (bodyName) => {
            const normalized = normalizeMatrixBodyName(bodyName);
            return !rows[normalized] || visibleBodies.has(normalized);
        };

        const bodyIsAspecting = (bodyName) => {
            const normalized = normalizeMatrixBodyName(bodyName);
            return !rows[normalized] || aspectingBodies.has(normalized);
        };

        const aspectIsEnabled = (aspectType) => enabledAspectTypes.has(aspectType);

        const filteredAspects = (chartData?.aspects || []).filter((aspect) => (
            bodyIsVisible(aspect?.planet_1)
            && bodyIsVisible(aspect?.planet_2)
            && bodyIsAspecting(aspect?.planet_1)
            && bodyIsAspecting(aspect?.planet_2)
            && aspectIsEnabled(aspect?.aspect_type)
        ));

        const filteredConfigurations = (chartData?.aspect_configurations || []).filter((configuration) => {
            const planetsInvolved = Array.isArray(configuration?.planets_involved)
                ? configuration.planets_involved
                : [];
            if (planetsInvolved.some((body) => !bodyIsVisible(body) || !bodyIsAspecting(body))) {
                return false;
            }

            const aspects = Array.isArray(configuration?.aspects) ? configuration.aspects : [];
            if (!aspects.length) {
                return true;
            }

            return aspects.every((aspect) => (
                bodyIsVisible(aspect?.planet_1)
                && bodyIsVisible(aspect?.planet_2)
                && bodyIsAspecting(aspect?.planet_1)
                && bodyIsAspecting(aspect?.planet_2)
                && aspectIsEnabled(aspect?.aspect_type)
            ));
        });

        const filteredStelliums = (chartData?.stelliums || []).filter((stellium) => {
            const planets = Array.isArray(stellium?.planets) ? stellium.planets : [];
            return planets.every((body) => bodyIsVisible(body) && bodyIsAspecting(body));
        });

        return {
            ...chartData,
            planets: (chartData?.planets || []).filter((planet) => bodyIsVisible(planet?.name)),
            aspects: filteredAspects,
            aspect_configurations: filteredConfigurations,
            stelliums: filteredStelliums,
        };
    }

    function normalizeViewSettings(viewSettings = {}) {
        return {
            matrix: {
                rows: ensureMatrixRows(viewSettings?.matrix?.rows),
            },
            aspects: {
                scope: viewSettings?.aspects?.scope || 'all',
                enabled_types: Array.isArray(viewSettings?.aspects?.enabled_types)
                    ? [...viewSettings.aspects.enabled_types]
                    : [...DEFAULT_ENABLED_ASPECT_TYPES],
                show_applying_separating: viewSettings?.aspects?.show_applying_separating === true,
            },
            table_options: {
                show_speed: viewSettings?.table_options?.show_speed !== false,
                show_stationary: viewSettings?.table_options?.show_stationary !== false,
            },
            view_options: {
                orientation: viewSettings?.view_options?.orientation === 'asc' ? 'asc' : 'aries',
            },
        };
    }

    function normalizeOrbPairStrategy(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'smaller' || normalized === 'min' || normalized === 'minimum') {
            return 'smaller';
        }
        if (normalized === 'average' || normalized === 'avg' || normalized === 'mean') {
            return 'average';
        }
        return DEFAULT_ORB_PAIR_STRATEGY;
    }

    function normalizeStationaryThresholdPercent(value) {
        const normalized = Number.parseFloat(value);
        if (!Number.isFinite(normalized)) {
            return DEFAULT_STATIONARY_THRESHOLD_PERCENT;
        }
        return Math.min(100, Math.max(0, normalized));
    }

    function normalizeMethodologySettings(methodology = {}) {
        const legacyMatrix = deepClone(methodology?.orbs?.matrix || {});
        const profiles = methodology?.orbs?.profiles || {};
        const normalizedProfiles = {};
        const pairStrategy = normalizeOrbPairStrategy(methodology?.orbs?.pair_strategy);

        ORB_PROFILE_IDS.forEach((profileId) => {
            const profileMatrix = deepClone(profiles?.[profileId]?.matrix || {});
            normalizedProfiles[profileId] = {
                matrix: Object.keys(profileMatrix).length ? profileMatrix : deepClone(legacyMatrix),
            };
        });

        return {
            orbs: {
                version: 2,
                pair_strategy: pairStrategy,
                profiles: normalizedProfiles,
            },
            balances: {
                version: Number(methodology?.balances?.version || 1),
                planet_weights: deepClone(methodology?.balances?.planet_weights || {}),
                special_point_weights: deepClone(methodology?.balances?.special_point_weights || {}),
            },
            stationary: {
                threshold_percent: normalizeStationaryThresholdPercent(methodology?.stationary?.threshold_percent),
            },
        };
    }

    function getAspectHarmonyType(aspectType) {
        return ASPECT_HARMONY_BY_TYPE[String(aspectType || '').trim()] || 'neutral';
    }

    function resolveVisualPreferences(visual = {}) {
        return {
            aspect_harmony_colors: {
                ...DEFAULT_ASPECT_HARMONY_COLORS,
                ...(visual?.aspect_harmony_colors || {}),
            },
            aspect_colors: {
                ...DEFAULT_ASPECT_COLORS,
                ...(visual?.aspect_colors || {}),
            },
            planet_colors: {
                element_palette: {
                    ...DEFAULT_ELEMENT_PALETTE,
                    ...(visual?.planet_colors?.element_palette || {}),
                },
                body_overrides: {
                    ...(visual?.planet_colors?.body_overrides || {}),
                },
            },
        };
    }

    function setAccountVisualPreferences(visual = {}) {
        accountVisualPreferences = resolveVisualPreferences(visual);
        return accountVisualPreferences;
    }

    function getAccountVisualPreferences() {
        return deepClone(accountVisualPreferences);
    }

    function getAspectColor(aspectType, visual = null, harmonicType = null) {
        const resolved = visual ? resolveVisualPreferences(visual) : accountVisualPreferences;
        const resolvedAspectType = String(aspectType || '').trim();
        const resolvedHarmonyType = harmonicType || getAspectHarmonyType(resolvedAspectType);
        return (
            resolved?.aspect_colors?.[resolvedAspectType]
            || resolved?.aspect_harmony_colors?.[resolvedHarmonyType]
            || DEFAULT_ASPECT_COLORS[resolvedAspectType]
            || DEFAULT_ASPECT_HARMONY_COLORS[resolvedHarmonyType]
            || '#9ca3af'
        );
    }

    function getElementColor(element, visual = null) {
        const resolved = visual ? resolveVisualPreferences(visual) : accountVisualPreferences;
        return resolved?.planet_colors?.element_palette?.[element] || DEFAULT_ELEMENT_PALETTE[element] || '#6b7280';
    }

    function getPlanetColor(bodyName, element = null, visual = null) {
        const resolved = visual ? resolveVisualPreferences(visual) : accountVisualPreferences;
        const bodyOverride = resolved?.planet_colors?.body_overrides?.[bodyName];
        if (bodyOverride) return bodyOverride;
        return getElementColor(element, resolved);
    }

    function buildLegacyNatalPatch({ formData, chartData, currentSettings } = {}) {
        const patch = {};
        const formHouseSystem = String(formData?.houseSystem || chartData?.birth_data?.house_system || '').trim();
        if (formHouseSystem) {
            patch.house_system = formHouseSystem;
        }
        if (currentSettings?.orientation && currentSettings.orientation !== 'aries') {
            patch.view_options = { orientation: currentSettings.orientation };
        }
        if (Array.isArray(currentSettings?.hiddenPlanets) && currentSettings.hiddenPlanets.length) {
            patch.matrix = {
                rows: buildMatrixRowsFromHiddenBodies(
                    currentSettings.hiddenPlanets,
                    currentSettings.matrixRows || {}
                ),
            };
        }
        return patch;
    }

    function buildLegacyForecastPatch({ biwheelOrientation, solarOrientation } = {}) {
        const patch = {};
        if (biwheelOrientation && biwheelOrientation !== 'aries') {
            patch.biwheel = { view_options: { orientation: biwheelOrientation } };
        }
        if (solarOrientation && solarOrientation !== 'aries') {
            patch.solar = { view_options: { orientation: solarOrientation } };
        }
        return patch;
    }

    const api = {
        MATRIX_BODIES,
        MAJOR_ASPECT_TYPES,
        DEFAULT_ENABLED_ASPECT_TYPES,
        DEFAULT_ASPECT_COLORS,
        DEFAULT_ASPECT_HARMONY_COLORS,
        DEFAULT_ELEMENT_PALETTE,
        ORB_PROFILE_IDS,
        DEFAULT_ORB_PAIR_STRATEGY,
        deepMerge,
        deepEqual,
        buildSparseDiff,
        ensureMatrixRows,
        normalizeMatrixBodyName,
        normalizeEnabledAspectTypes,
        getAspectFamilyTypes,
        isExactAspectFamilySelection,
        healEnabledAspectTypesForScope,
        normalizeOrbPairStrategy,
        normalizeViewSettings,
        normalizeMethodologySettings,
        resolveEnabledAspectTypesForScope,
        resolveVisualPreferences,
        getAspectHarmonyType,
        setAccountVisualPreferences,
        getAccountVisualPreferences,
        getAspectColor,
        getElementColor,
        getPlanetColor,
        getHiddenBodiesFromMatrix,
        buildMatrixRowsFromHiddenBodies,
        filterChartDataByViewPreferences,
        buildLegacyNatalPatch,
        buildLegacyForecastPatch,
    };

    root.AstroPreferences = api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);

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
    const DEFAULT_ELEMENT_PALETTE = {
        Fire: '#ef4444',
        Earth: '#22c55e',
        Air: '#eab308',
        Water: '#3b82f6',
    };
    const ORB_PROFILE_IDS = ['natal', 'prognostic'];
    const DEFAULT_ORB_PAIR_STRATEGY = 'larger';
    const BODY_NAME_ALIASES = {
        TrueNorthNode: 'TrueNode',
        TrueSouthNode: 'SouthNode',
        Fortune: 'PartOfFortune',
    };
    let accountVisualPreferences = {
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

    function filterChartDataByViewPreferences(chartData = {}, options = {}) {
        const rows = ensureMatrixRows(options?.matrixRows || {});
        const visibleBodies = new Set();
        const aspectingBodies = new Set();

        Object.entries(rows).forEach(([body, config]) => {
            if (config?.display !== false) visibleBodies.add(body);
            if (config?.aspecting !== false) aspectingBodies.add(body);
        });

        const enabledAspectTypes = Array.isArray(options?.enabledAspectTypes) && options.enabledAspectTypes.length
            ? new Set(options.enabledAspectTypes)
            : null;

        const bodyIsVisible = (bodyName) => {
            const normalized = normalizeMatrixBodyName(bodyName);
            return !rows[normalized] || visibleBodies.has(normalized);
        };

        const bodyIsAspecting = (bodyName) => {
            const normalized = normalizeMatrixBodyName(bodyName);
            return !rows[normalized] || aspectingBodies.has(normalized);
        };

        const aspectIsEnabled = (aspectType) => !enabledAspectTypes || enabledAspectTypes.has(aspectType);

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
                    : ['Conjunction', 'Opposition', 'Trine', 'Square', 'Sextile'],
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
        };
    }

    function resolveVisualPreferences(visual = {}) {
        return {
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

    function getAspectColor(aspectType, visual = null) {
        const resolved = visual ? resolveVisualPreferences(visual) : accountVisualPreferences;
        return resolved?.aspect_colors?.[aspectType] || DEFAULT_ASPECT_COLORS[aspectType] || '#9ca3af';
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
        DEFAULT_ASPECT_COLORS,
        DEFAULT_ELEMENT_PALETTE,
        ORB_PROFILE_IDS,
        DEFAULT_ORB_PAIR_STRATEGY,
        deepMerge,
        deepEqual,
        buildSparseDiff,
        ensureMatrixRows,
        normalizeMatrixBodyName,
        normalizeOrbPairStrategy,
        normalizeViewSettings,
        normalizeMethodologySettings,
        resolveVisualPreferences,
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

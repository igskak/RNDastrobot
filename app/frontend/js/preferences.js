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
        Earth: '#84cc16',
        Air: '#f59e0b',
        Water: '#3b82f6',
    };
    const DEFAULT_BODY_COLORS = {
        Sun: '#ef4444',
        Moon: '#84cc16',
        Mercury: '#84cc16',
        Venus: '#ef4444',
        Mars: '#3b82f6',
        Jupiter: '#84cc16',
        Saturn: '#3b82f6',
        Uranus: '#3b82f6',
        Neptune: '#ef4444',
        Pluto: '#f59e0b',
        Chiron: '#ef4444',
        Proserpina: '#f59e0b',
        TrueNode: '#3b82f6',
        TrueNorthNode: '#3b82f6',
        SouthNode: '#84cc16',
        TrueSouthNode: '#84cc16',
        BlackMoon: '#ef4444',
        WhiteMoon: '#3b82f6',
        PartOfFortune: '#84cc16',
        Fortune: '#84cc16',
        ASC: '#1e3a5f',
        DSC: '#1e3a5f',
        MC: '#1e3a5f',
        IC: '#1e3a5f',
        Vertex: '#b8935a',
        AntiVertex: '#b8935a',
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
    const DEFAULT_PROGNOSTIC_ORB = 1;
    const DEFAULT_PROGNOSTIC_MOON_ORB = 3;
    const DEFAULT_STATIONARY_THRESHOLD_PERCENT = 10;
    const VIEW_DRAFT_STORAGE_PREFIX = 'astroChartViewDraft:';
    const DIGNITY_SIGNS = [
        'Aries', 'Taurus', 'Gemini', 'Cancer',
        'Leo', 'Virgo', 'Libra', 'Scorpio',
        'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
    ];
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
        wheel: {
            angular_cusps_black: false,
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
            const display = rows?.[body]?.display !== false;
            ensured[body] = {
                display,
                aspecting: display && rows?.[body]?.aspecting !== false,
            };
        });
        Object.keys(rows || {}).forEach((body) => {
            if (!ensured[body]) {
                const display = rows?.[body]?.display !== false;
                ensured[body] = {
                    display,
                    aspecting: display && rows?.[body]?.aspecting !== false,
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
        const buildBodyFilterContext = (matrixRows = {}) => {
            const rows = ensureMatrixRows(matrixRows || {});
            const visibleBodies = new Set();
            const aspectingBodies = new Set();

            Object.entries(rows).forEach(([body, config]) => {
                if (config?.display !== false) visibleBodies.add(body);
                if (config?.aspecting !== false) aspectingBodies.add(body);
            });

            return {
                bodyIsVisible(bodyName) {
                    const normalized = normalizeMatrixBodyName(bodyName);
                    return !rows[normalized] || visibleBodies.has(normalized);
                },
                bodyIsAspecting(bodyName) {
                    const normalized = normalizeMatrixBodyName(bodyName);
                    return !rows[normalized] || aspectingBodies.has(normalized);
                },
            };
        };

        const defaultBodyFilters = buildBodyFilterContext(options?.matrixRows || {});
        const firstAspectBodyFilters = options?.aspectMatrixRows?.first
            ? buildBodyFilterContext(options.aspectMatrixRows.first)
            : defaultBodyFilters;
        const secondAspectBodyFilters = options?.aspectMatrixRows?.second
            ? buildBodyFilterContext(options.aspectMatrixRows.second)
            : defaultBodyFilters;

        const availableAspectTypes = (chartData?.aspects || [])
            .map((aspect) => aspect?.aspect_type)
            .filter(Boolean);
        const enabledAspectTypes = resolveEnabledAspectTypesForScope({
            enabledAspectTypes: options?.enabledAspectTypes,
            aspectScope: options?.aspectScope || 'all',
            availableAspectTypes,
        });

        const bodyIsVisible = (bodyName) => defaultBodyFilters.bodyIsVisible(bodyName);
        const bodyIsAspecting = (bodyName) => defaultBodyFilters.bodyIsAspecting(bodyName);

        const aspectIsEnabled = (aspectType) => enabledAspectTypes.has(aspectType);
        const getAspectBodies = (aspect) => ([
            aspect?.planet_1 ?? aspect?.left_planet ?? aspect?.transit_planet ?? aspect?.progressed_planet ?? aspect?.directed_object,
            aspect?.planet_2 ?? aspect?.right_planet ?? aspect?.natal_object,
        ]);

        const aspectPassesBodyFilters = (aspect) => {
            const [bodyA, bodyB] = getAspectBodies(aspect);
            return firstAspectBodyFilters.bodyIsVisible(bodyA)
                && secondAspectBodyFilters.bodyIsVisible(bodyB)
                && firstAspectBodyFilters.bodyIsAspecting(bodyA)
                && secondAspectBodyFilters.bodyIsAspecting(bodyB);
        };

        const filteredAspects = (chartData?.aspects || []).filter((aspect) => (
            aspectPassesBodyFilters(aspect)
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
                aspectPassesBodyFilters(aspect)
                && aspectIsEnabled(aspect?.aspect_type)
            ));
        });

        const filteredStelliums = (chartData?.stelliums || []).filter((stellium) => {
            const planets = Array.isArray(stellium?.planets) ? stellium.planets : [];
            return planets.every((body) => bodyIsVisible(body) && bodyIsAspecting(body));
        });

        const filteredHouses = (chartData?.houses || []).map((house) => {
            const rulerPlanet = bodyIsVisible(house?.ruler_planet) ? house?.ruler_planet : null;
            return {
                ...house,
                ruler_planet: rulerPlanet,
                ruler_in_house: rulerPlanet ? house?.ruler_in_house : null,
                co_rulers: Array.isArray(house?.co_rulers)
                    ? house.co_rulers.filter((body) => bodyIsVisible(body))
                    : house?.co_rulers,
                ruler_groups: Array.isArray(house?.ruler_groups)
                    ? house.ruler_groups
                        .map((group) => ({
                            ...group,
                            entries: Array.isArray(group?.entries)
                                ? group.entries.filter((entry) => bodyIsVisible(entry?.planet))
                                : [],
                        }))
                        .filter((group) => group.entries.length)
                    : house?.ruler_groups,
                planets_in_house: Array.isArray(house?.planets_in_house)
                    ? house.planets_in_house.filter((body) => bodyIsVisible(body))
                    : house?.planets_in_house,
            };
        });

        const filteredSpecialPoints = chartData?.special_points && typeof chartData.special_points === 'object'
            ? Object.fromEntries(Object.entries(chartData.special_points).filter(([name, point]) => (
                bodyIsVisible(name || point?.name)
            )))
            : chartData?.special_points;

        return {
            ...chartData,
            planets: (chartData?.planets || []).filter((planet) => bodyIsVisible(planet?.name)),
            houses: filteredHouses,
            special_points: filteredSpecialPoints,
            aspects: filteredAspects,
            aspect_configurations: filteredConfigurations,
            stelliums: filteredStelliums,
        };
    }

    function normalizeViewSettings(viewSettings = {}) {
        return {
            matrix: {
                schema_version: Number(viewSettings?.matrix?.schema_version) || 1,
                rows: ensureMatrixRows(viewSettings?.matrix?.rows),
                prognostic_rows: ensureMatrixRows(viewSettings?.matrix?.prognostic_rows || viewSettings?.matrix?.rows),
                natal_rows: ensureMatrixRows(viewSettings?.matrix?.natal_rows),
            },
            aspects: {
                scope: viewSettings?.aspects?.scope || 'major',
                enabled_types: Array.isArray(viewSettings?.aspects?.enabled_types)
                    ? [...viewSettings.aspects.enabled_types]
                    : [...DEFAULT_ENABLED_ASPECT_TYPES],
                show_applying_separating: viewSettings?.aspects?.show_applying_separating !== false,
            },
            table_options: {
                show_speed: viewSettings?.table_options?.show_speed !== false,
                show_stationary: viewSettings?.table_options?.show_stationary !== false,
                show_aspect_text: viewSettings?.table_options?.show_aspect_text === true,
            },
            view_options: {
                orientation: viewSettings?.view_options?.orientation === 'asc' ? 'asc' : 'aries',
                bold_asc_dsc: viewSettings?.view_options?.bold_asc_dsc !== false,
                bold_mc_ic: viewSettings?.view_options?.bold_mc_ic !== false,
                house_number_style: viewSettings?.view_options?.house_number_style === 'roman' ? 'roman' : 'arabic',
                house_labels_outside: viewSettings?.view_options?.house_labels_outside === true,
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

    function normalizeDignitySettings(dignities = {}, defaultDignities = {}) {
        const defaultSigns = defaultDignities?.signs || {};
        const sourceSigns = dignities?.signs || {};
        const signs = {};

        DIGNITY_SIGNS.forEach((sign) => {
            const merged = deepMerge(defaultSigns?.[sign] || {}, sourceSigns?.[sign] || {});
            const ruler = normalizeMatrixBodyName(merged?.ruler || null) || null;
            let coRuler = normalizeMatrixBodyName(merged?.co_ruler || null) || null;
            const exaltation = normalizeMatrixBodyName(merged?.exaltation || null) || null;

            if (ruler && coRuler && ruler === coRuler) {
                coRuler = null;
            }

            signs[sign] = {
                ruler,
                co_ruler: coRuler,
                exaltation,
            };
        });

        return {
            version: 1,
            signs,
        };
    }

    function normalizeStationaryThresholdPercent(value) {
        const normalized = Number.parseFloat(value);
        if (!Number.isFinite(normalized)) {
            return DEFAULT_STATIONARY_THRESHOLD_PERCENT;
        }
        return Math.min(100, Math.max(0, normalized));
    }

    function buildDefaultOrbProfileMatrix(aspectTypes = [], bodies = MATRIX_BODIES, profileId = 'natal') {
        return Object.fromEntries(
            (aspectTypes || []).map((aspect) => [
                aspect.aspect_type,
                Object.fromEntries(
                    (bodies || []).map((body) => [
                        body,
                        profileId === 'prognostic'
                            ? (body === 'Moon' ? DEFAULT_PROGNOSTIC_MOON_ORB : DEFAULT_PROGNOSTIC_ORB)
                            : Number(aspect.base_orb || 5),
                    ])
                ),
            ])
        );
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
            dignities: normalizeDignitySettings(
                methodology?.dignities || {},
                methodology?.default_dignities || {}
            ),
        };
    }

    function getAspectHarmonyType(aspectType) {
        return ASPECT_HARMONY_BY_TYPE[String(aspectType || '').trim()] || 'neutral';
    }

    function resolveVisualPreferences(visual = {}) {
        const timezoneLabelFormat = String(visual?.timezone_label_format || 'UTC').trim().toUpperCase() === 'GMT'
            ? 'GMT'
            : 'UTC';
        const normalizedDateFormat = String(visual?.date_format || 'DD_MM_YYYY').trim().toUpperCase();
        const dateFormat = ['DD_MM_YYYY', 'MM_DD_YYYY', 'YYYY_MM_DD', 'LOCALE'].includes(normalizedDateFormat)
            ? normalizedDateFormat
            : 'DD_MM_YYYY';
        const normalizedDegreeFormat = String(visual?.degree_format || 'DEGREES_ONLY').trim().toUpperCase();
        const degreeFormat = ['DEGREES_ONLY', 'DEGREES_MINUTES', 'DEGREES_MINUTES_SECONDS'].includes(normalizedDegreeFormat)
            ? normalizedDegreeFormat
            : 'DEGREES_ONLY';
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
            wheel: {
                angular_cusps_black: visual?.wheel?.angular_cusps_black === true,
            },
            timezone_label_format: timezoneLabelFormat,
            date_format: dateFormat,
            degree_format: degreeFormat,
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
        return (
            resolved?.aspect_colors?.[resolvedAspectType]
            || DEFAULT_ASPECT_COLORS[resolvedAspectType]
            || '#9ca3af'
        );
    }

    function getElementColor(element, visual = null) {
        const resolved = visual ? resolveVisualPreferences(visual) : accountVisualPreferences;
        return resolved?.planet_colors?.element_palette?.[element] || DEFAULT_ELEMENT_PALETTE[element] || '#6b7280';
    }

    function getPlanetColor(bodyName, element = null, visual = null) {
        const resolved = visual ? resolveVisualPreferences(visual) : accountVisualPreferences;
        const normalizedBodyName = normalizeMatrixBodyName(bodyName);
        const bodyOverrides = resolved?.planet_colors?.body_overrides || {};
        const bodyOverride = bodyOverrides?.[normalizedBodyName] || bodyOverrides?.[bodyName];
        if (bodyOverride) return bodyOverride;
        const defaultBodyColor = DEFAULT_BODY_COLORS[normalizedBodyName] || DEFAULT_BODY_COLORS[bodyName];
        if (defaultBodyColor) return defaultBodyColor;
        return getElementColor(element, resolved);
    }

    function getTimezoneLabelFormat(visual = null) {
        const resolved = visual ? resolveVisualPreferences(visual) : accountVisualPreferences;
        return resolved?.timezone_label_format === 'GMT' ? 'GMT' : 'UTC';
    }

    function getDateFormat(visual = null) {
        const resolved = visual ? resolveVisualPreferences(visual) : accountVisualPreferences;
        return ['DD_MM_YYYY', 'MM_DD_YYYY', 'YYYY_MM_DD', 'LOCALE'].includes(resolved?.date_format)
            ? resolved.date_format
            : 'DD_MM_YYYY';
    }

    function getDegreeFormat(visual = null) {
        const resolved = visual ? resolveVisualPreferences(visual) : accountVisualPreferences;
        return ['DEGREES_ONLY', 'DEGREES_MINUTES', 'DEGREES_MINUTES_SECONDS'].includes(resolved?.degree_format)
            ? resolved.degree_format
            : 'DEGREES_ONLY';
    }

    function shouldUseBlackAngularCusps(visual = null) {
        const resolved = visual ? resolveVisualPreferences(visual) : accountVisualPreferences;
        return resolved?.wheel?.angular_cusps_black === true;
    }

    function shouldShowAspectText(viewSettings = {}) {
        return normalizeViewSettings(viewSettings)?.table_options?.show_aspect_text === true;
    }

    function buildChartViewDraftKey(meta = {}) {
        const chartKind = String(meta.chart_kind || meta.chartKind || '').trim();
        const chartId = String(meta.chart_id || meta.chartId || '').trim();
        const viewType = String(meta.view_type || meta.viewType || '').trim();
        if (!chartKind || !chartId || !viewType) return null;
        return `${VIEW_DRAFT_STORAGE_PREFIX}${chartKind}:${chartId}:${viewType}`;
    }

    function saveChartViewDraft(meta = {}, resolved = {}) {
        const key = buildChartViewDraftKey(meta);
        if (!key || typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem(key, JSON.stringify({
                chart_kind: meta.chart_kind || meta.chartKind,
                chart_id: meta.chart_id || meta.chartId,
                view_type: meta.view_type || meta.viewType,
                resolved: deepClone(resolved || {}),
                updated_at: Date.now(),
            }));
        } catch {
            // Draft persistence is a best-effort safety net for fast navigation.
        }
    }

    function readChartViewDraft(meta = {}) {
        const key = buildChartViewDraftKey(meta);
        if (!key || typeof localStorage === 'undefined') return null;
        try {
            const parsed = JSON.parse(localStorage.getItem(key) || 'null');
            if (!parsed || typeof parsed !== 'object') return null;
            return parsed.resolved && typeof parsed.resolved === 'object' ? parsed.resolved : null;
        } catch {
            return null;
        }
    }

    function clearChartViewDraft(meta = {}) {
        const key = buildChartViewDraftKey(meta);
        if (!key || typeof localStorage === 'undefined') return;
        try {
            localStorage.removeItem(key);
        } catch {
            // Ignore storage cleanup failures.
        }
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
        DEFAULT_ELEMENT_PALETTE,
        DEFAULT_BODY_COLORS,
        ORB_PROFILE_IDS,
        DIGNITY_SIGNS,
        DEFAULT_ORB_PAIR_STRATEGY,
        DEFAULT_PROGNOSTIC_ORB,
        DEFAULT_PROGNOSTIC_MOON_ORB,
        deepMerge,
        deepEqual,
        buildSparseDiff,
        buildDefaultOrbProfileMatrix,
        ensureMatrixRows,
        normalizeMatrixBodyName,
        normalizeEnabledAspectTypes,
        getAspectFamilyTypes,
        isExactAspectFamilySelection,
        healEnabledAspectTypesForScope,
        normalizeOrbPairStrategy,
        normalizeDignitySettings,
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
        getTimezoneLabelFormat,
        getDateFormat,
        getDegreeFormat,
        shouldUseBlackAngularCusps,
        shouldShowAspectText,
        buildChartViewDraftKey,
        saveChartViewDraft,
        readChartViewDraft,
        clearChartViewDraft,
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

(function (root) {
    'use strict';

    const BODY_NAME_ALIASES = {
        TrueNorthNode: 'TrueNode',
        TrueSouthNode: 'SouthNode',
        Fortune: 'PartOfFortune',
    };

    const ASPECT_ANGLES = {
        Conjunction: 0,
        Vigintile: 18,
        Semisextile: 30,
        SemiSextile: 30,
        Decile: 36,
        Novile: 40,
        Semisquare: 45,
        SemiSquare: 45,
        Septile: 360 / 7,
        Sextile: 60,
        Quintile: 72,
        Binonagon: 80,
        Square: 90,
        Nonagon: 80,
        Tridecile: 108,
        Trine: 120,
        Sesquiquadrate: 135,
        Biquintile: 144,
        Quincunx: 150,
        Opposition: 180,
        Semi_Nonagon: 20,
        Sentagon: 100,
    };
    const ASPECT_PHASE_VALUES = ['applying', 'separating'];

    function normalizeBodyName(name) {
        return BODY_NAME_ALIASES[String(name || '').trim()] || String(name || '').trim();
    }

    function normalizeAngle(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return null;
        const normalized = numeric % 360;
        return normalized < 0 ? normalized + 360 : normalized;
    }

    function getAngularDistance(longitudeA, longitudeB) {
        const normalizedA = normalizeAngle(longitudeA);
        const normalizedB = normalizeAngle(longitudeB);
        if (normalizedA === null || normalizedB === null) return null;

        let diff = Math.abs(normalizedA - normalizedB);
        if (diff > 180) diff = 360 - diff;
        return diff;
    }

    function getAspectAngle(aspectType) {
        return ASPECT_ANGLES[String(aspectType || '').trim()] ?? null;
    }

    function buildBodyLookup(chartData) {
        const lookup = new Map();
        if (!chartData || typeof chartData !== 'object') return lookup;

        (chartData.planets || []).forEach((planet) => {
            const name = normalizeBodyName(planet?.name);
            const longitude = normalizeAngle(planet?.longitude);
            if (!name || longitude === null) return;
            const speed = Number(planet?.speed);
            lookup.set(name, {
                longitude,
                speed: Number.isFinite(speed) ? speed : 0,
            });
        });

        Object.entries(chartData.special_points || {}).forEach(([key, point]) => {
            const name = normalizeBodyName(point?.name || key);
            const longitude = normalizeAngle(point?.longitude);
            if (!name || longitude === null || lookup.has(name)) return;
            const speed = Number(point?.speed);
            lookup.set(name, {
                longitude,
                speed: Number.isFinite(speed) ? speed : 0,
            });
        });

        Object.entries(chartData.angles || {}).forEach(([key, angle]) => {
            const name = normalizeBodyName(angle?.name || key);
            const longitude = normalizeAngle(angle?.longitude);
            if (!name || longitude === null || lookup.has(name)) return;
            lookup.set(name, {
                longitude,
                speed: 0,
            });
        });

        return lookup;
    }

    function normalizeAspectPhaseFilter(value) {
        if (Array.isArray(value)) {
            const normalized = value
                .map((entry) => String(entry || '').trim().toLowerCase())
                .filter((entry) => ASPECT_PHASE_VALUES.includes(entry));
            return [...new Set(normalized)];
        }

        const raw = String(value || '').trim().toLowerCase();
        if (!raw || raw === 'all') return [...ASPECT_PHASE_VALUES];
        if (raw.includes(',')) return normalizeAspectPhaseFilter(raw.split(','));
        return ASPECT_PHASE_VALUES.includes(raw) ? [raw] : [...ASPECT_PHASE_VALUES];
    }

    function aspectHasPhaseMetadata(aspect) {
        if (!aspect || typeof aspect !== 'object') return false;
        if (typeof aspect.applying === 'boolean') return true;
        const rawPhase = String(aspect.applying_separating || aspect.phase || '').trim();
        return rawPhase.length > 0;
    }

    function getAspectPhaseState(aspect) {
        if (!aspect) return 'all';
        if (typeof aspect.applying === 'boolean') {
            return aspect.applying ? 'applying' : 'separating';
        }

        const rawPhase = String(aspect.applying_separating || aspect.phase || '').trim().toLowerCase();
        if (!rawPhase) return 'all';
        if (rawPhase.includes('applic')) return 'applying';
        if (rawPhase.includes('сход')) return 'applying';
        if (rawPhase.includes('separ')) return 'separating';
        if (rawPhase.includes('расход')) return 'separating';
        return 'all';
    }

    function inferAspectPhaseState(aspect, chartDataOrLookup) {
        if (!aspect || typeof aspect !== 'object') return 'all';

        const explicitState = getAspectPhaseState(aspect);
        if (explicitState !== 'all') return explicitState;

        const exactAngle = getAspectAngle(aspect.aspect_type);
        if (exactAngle === null) return 'all';

        const lookup = chartDataOrLookup instanceof Map
            ? chartDataOrLookup
            : buildBodyLookup(chartDataOrLookup);

        const bodyA = lookup.get(normalizeBodyName(aspect.planet_1));
        const bodyB = lookup.get(normalizeBodyName(aspect.planet_2));
        if (!bodyA || !bodyB) return 'all';

        const currentDistance = getAngularDistance(bodyA.longitude, bodyB.longitude);
        if (currentDistance === null) return 'all';

        const stepDays = 1 / 24;
        const futureDistance = getAngularDistance(
            bodyA.longitude + (bodyA.speed * stepDays),
            bodyB.longitude + (bodyB.speed * stepDays),
        );
        if (futureDistance === null) return 'all';

        const currentDeviation = Math.abs(currentDistance - exactAngle);
        const futureDeviation = Math.abs(futureDistance - exactAngle);
        if (Math.abs(futureDeviation - currentDeviation) < 1e-6) return 'all';

        return futureDeviation < currentDeviation ? 'applying' : 'separating';
    }

    function enrichAspectPhase(aspect, chartDataOrLookup) {
        if (!aspect || typeof aspect !== 'object') return aspect;
        if (aspectHasPhaseMetadata(aspect)) return aspect;

        const inferredState = inferAspectPhaseState(aspect, chartDataOrLookup);
        if (inferredState === 'all') return aspect;

        return {
            ...aspect,
            applying: inferredState === 'applying',
        };
    }

    function enrichChartDataWithAspectPhases(chartData) {
        if (!chartData || typeof chartData !== 'object') return chartData;

        const lookup = buildBodyLookup(chartData);
        if (!lookup.size) return chartData;

        const aspects = Array.isArray(chartData.aspects)
            ? chartData.aspects.map((aspect) => enrichAspectPhase(aspect, lookup))
            : chartData.aspects;

        const aspectConfigurations = Array.isArray(chartData.aspect_configurations)
            ? chartData.aspect_configurations.map((configuration) => {
                if (!Array.isArray(configuration?.aspects)) return configuration;
                return {
                    ...configuration,
                    aspects: configuration.aspects.map((aspect) => enrichAspectPhase(aspect, lookup)),
                };
            })
            : chartData.aspect_configurations;

        return {
            ...chartData,
            aspects,
            aspect_configurations: aspectConfigurations,
        };
    }

    function aspectMatchesPhaseFilter(aspect, filter = 'all') {
        const normalizedFilter = normalizeAspectPhaseFilter(filter);
        if (normalizedFilter.length === ASPECT_PHASE_VALUES.length) return true;
        if (normalizedFilter.length === 0) return false;
        if (!aspectHasPhaseMetadata(aspect)) return true;
        return normalizedFilter.includes(getAspectPhaseState(aspect));
    }

    function filterChartDataByAspectPhase(chartData, filter = 'all') {
        const normalizedFilter = normalizeAspectPhaseFilter(filter);
        if (!chartData) return chartData;

        const enrichedChartData = enrichChartDataWithAspectPhases(chartData);
        if (normalizedFilter.length === ASPECT_PHASE_VALUES.length) return enrichedChartData;
        if (normalizedFilter.length === 0) {
            return {
                ...enrichedChartData,
                aspects: [],
                aspect_configurations: [],
            };
        }

        const filteredAspects = (enrichedChartData.aspects || []).filter((aspect) => (
            aspectMatchesPhaseFilter(aspect, normalizedFilter)
        ));

        const filteredConfigurations = (enrichedChartData.aspect_configurations || [])
            .map((configuration) => {
                if (!Array.isArray(configuration?.aspects)) return configuration;

                const configurationAspects = configuration.aspects;
                const aspectsWithPhaseMetadata = configurationAspects.filter((aspect) => (
                    aspectHasPhaseMetadata(aspect)
                ));

                if (!aspectsWithPhaseMetadata.length) {
                    return configuration;
                }

                const visibleAspects = configurationAspects.filter((aspect) => (
                    aspectMatchesPhaseFilter(aspect, normalizedFilter)
                ));

                if (!visibleAspects.length) {
                    return null;
                }

                return {
                    ...configuration,
                    aspects: visibleAspects,
                };
            })
            .filter(Boolean);

        return {
            ...enrichedChartData,
            aspects: filteredAspects,
            aspect_configurations: filteredConfigurations,
        };
    }

    const api = {
        normalizeAspectPhaseFilter,
        aspectHasPhaseMetadata,
        getAspectPhaseState,
        inferAspectPhaseState,
        enrichAspectPhase,
        enrichChartDataWithAspectPhases,
        aspectMatchesPhaseFilter,
        filterChartDataByAspectPhase,
    };

    root.AstroAspectPhase = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
}(typeof window !== 'undefined' ? window : globalThis));

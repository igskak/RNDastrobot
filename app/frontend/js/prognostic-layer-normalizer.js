(function() {
    'use strict';

    const METHOD_ORDER = ['transit', 'progression', 'direction'];
    const METHOD_META = {
        transit: { label: 'Транзиты', color: '#1e3a5f' },
        progression: { label: 'Прогрессии', color: '#7c3aed' },
        direction: { label: 'Дирекции', color: '#0f766e' },
    };

    function cloneArray(value) {
        return Array.isArray(value) ? value.map((item) => ({ ...(item || {}) })) : [];
    }

    function normalizeMethod(method) {
        if (method === 'transits') return 'transit';
        if (method === 'progressions') return 'progression';
        if (method === 'directions') return 'direction';
        return METHOD_ORDER.includes(method) ? method : 'transit';
    }

    function normalizeTransit(data, ringIndex = 1) {
        const bodies = cloneArray(data?.transit_planets).map((planet) => ({
            ...planet,
            house: planet.house ?? planet.natal_house ?? null,
        }));
        const aspects = cloneArray(data?.aspects).map((aspect) => ({
            ...aspect,
            planet_1: aspect.transit_planet,
            planet_2: aspect.natal_object,
            left_planet: aspect.transit_planet,
            right_planet: aspect.natal_object,
            method: 'transit',
        }));
        const houses = cloneArray(data?.transit_houses || data?.houses);
        return buildLayer({ method: 'transit', bodies, houses, aspects, raw: data, ringIndex });
    }

    function normalizeProgression(data, ringIndex = 2) {
        const bodies = cloneArray(data?.progressed_planets).map((planet) => ({
            ...planet,
            house: planet.house ?? planet.progressed_house ?? planet.natal_house ?? null,
        }));
        const aspects = cloneArray(data?.aspects_to_natal).map((aspect) => ({
            ...aspect,
            planet_1: aspect.progressed_planet,
            planet_2: aspect.natal_object,
            left_planet: aspect.progressed_planet,
            right_planet: aspect.natal_object,
            method: 'progression',
        }));
        return buildLayer({
            method: 'progression',
            bodies,
            houses: cloneArray(data?.progressed_houses),
            aspects,
            raw: data,
            ringIndex,
        });
    }

    function normalizeDirection(data, ringIndex = 3) {
        const bodies = [
            ...cloneArray(data?.directed_planets),
            ...cloneArray(data?.directed_angles),
            ...cloneArray(data?.directed_special_points),
        ].map((body) => ({
            ...body,
            house: body.house ?? body.directed_house ?? body.natal_house ?? null,
            retrograde: Boolean(body.retrograde),
            speed: body.speed ?? null,
        }));
        const aspects = cloneArray(data?.aspects_to_natal).map((aspect) => ({
            ...aspect,
            planet_1: aspect.directed_object,
            planet_2: aspect.natal_object,
            left_planet: aspect.directed_object,
            right_planet: aspect.natal_object,
            method: 'direction',
        }));
        return buildLayer({
            method: 'direction',
            bodies,
            houses: cloneArray(data?.directed_houses),
            aspects,
            raw: data,
            ringIndex,
        });
    }

    function buildLayer({ method, bodies, houses, aspects, raw, ringIndex }) {
        const normalizedMethod = normalizeMethod(method);
        return {
            method: normalizedMethod,
            label: METHOD_META[normalizedMethod].label,
            bodies,
            houses,
            aspects,
            raw,
            ringIndex,
            style: {
                color: METHOD_META[normalizedMethod].color,
            },
        };
    }

    function normalizeLayer(method, data, ringIndex) {
        const normalizedMethod = normalizeMethod(method);
        if (normalizedMethod === 'progression') return normalizeProgression(data, ringIndex);
        if (normalizedMethod === 'direction') return normalizeDirection(data, ringIndex);
        return normalizeTransit(data, ringIndex);
    }

    function buildViewModel(natalData, layers, options = {}) {
        const activeMethods = Array.isArray(options.activeMethods) ? options.activeMethods : METHOD_ORDER;
        const ordered = METHOD_ORDER
            .filter((method) => activeMethods.includes(method))
            .map((method, index) => {
                const raw = layers?.[method];
                return raw ? normalizeLayer(method, raw, index + 1) : null;
            })
            .filter(Boolean);

        return {
            natalLayer: {
                method: 'natal',
                label: 'Натал',
                bodies: cloneArray(natalData?.planets),
                houses: cloneArray(natalData?.houses),
                aspects: cloneArray(natalData?.aspects),
                raw: natalData,
                ringIndex: 0,
                style: { color: '#111111' },
            },
            activePrognosticLayers: ordered,
        };
    }

    const api = {
        METHOD_ORDER,
        METHOD_META,
        normalizeMethod,
        normalizeLayer,
        buildViewModel,
    };

    if (typeof window !== 'undefined') window.PrognosticLayerNormalizer = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();

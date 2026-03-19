(function() {
    'use strict';

    const SPECIAL_POINT_NAME_MAP = {
        TrueNorthNode: 'TrueNode',
        TrueSouthNode: 'SouthNode',
        Fortune: 'PartOfFortune',
    };
    const WHEEL_SPECIAL_POINT_KEYS = [
        'TrueNorthNode',
        'TrueSouthNode',
        'BlackMoon',
        'WhiteMoon',
        'Fortune',
    ];

    function cloneArrayOfObjects(value) {
        if (!Array.isArray(value)) return [];
        return value.map((item) => (item && typeof item === 'object') ? { ...item } : item);
    }

    function cloneObjectMap(value) {
        if (!value || typeof value !== 'object') return {};
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [
            key,
            (item && typeof item === 'object') ? { ...item } : item,
        ]));
    }

    function normalizeSpecialPointName(name) {
        return SPECIAL_POINT_NAME_MAP[name] || name;
    }

    function mergeSpecialPointsIntoPlanets(chartData, options = {}) {
        const source = chartData && typeof chartData === 'object' ? chartData : null;
        if (!source) return chartData;

        const mutate = options.mutate === true;
        const nextData = mutate
            ? source
            : {
                ...source,
                planets: cloneArrayOfObjects(source.planets),
                birth_data: source.birth_data && typeof source.birth_data === 'object'
                    ? { ...source.birth_data }
                    : {},
                houses: cloneArrayOfObjects(source.houses),
                aspects: cloneArrayOfObjects(source.aspects),
                angles: cloneObjectMap(source.angles),
            };

        if (!Array.isArray(nextData.planets)) {
            nextData.planets = [];
        }

        const specialPoints = source.special_points && typeof source.special_points === 'object'
            ? source.special_points
            : null;
        if (!specialPoints) return nextData;

        WHEEL_SPECIAL_POINT_KEYS.forEach((key) => {
            const point = specialPoints[key];
            if (!point || point.longitude === null || point.longitude === undefined) return;

            const displayName = normalizeSpecialPointName(key);
            const exists = nextData.planets.some((planet) => (
                planet?.name === displayName || planet?.name === key
            ));
            if (exists) return;

            nextData.planets.push({
                name: displayName,
                longitude: point.longitude,
                sign: point.sign,
                degree_in_sign: point.degree_in_sign,
                house: point.house,
                retrograde: false,
            });
        });

        return nextData;
    }

    function prepareNatalWheelData(chartData, options = {}) {
        const prepared = mergeSpecialPointsIntoPlanets(chartData, { mutate: false }) || {};
        const birthData = prepared.birth_data && typeof prepared.birth_data === 'object'
            ? { ...prepared.birth_data }
            : {};

        if (options.houseSystem) {
            birthData.house_system = options.houseSystem;
        }

        return {
            ...prepared,
            planets: cloneArrayOfObjects(prepared.planets),
            houses: cloneArrayOfObjects(prepared.houses),
            aspects: cloneArrayOfObjects(prepared.aspects),
            angles: cloneObjectMap(prepared.angles),
            birth_data: birthData,
        };
    }

    const api = {
        SPECIAL_POINT_NAME_MAP,
        WHEEL_SPECIAL_POINT_KEYS,
        normalizeSpecialPointName,
        mergeSpecialPointsIntoPlanets,
        prepareNatalWheelData,
    };

    if (typeof window !== 'undefined') {
        window.NatalWheelData = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})();

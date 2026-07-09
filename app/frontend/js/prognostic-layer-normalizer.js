(function() {
    'use strict';

    const METHOD_ORDER = ['transit', 'progression', 'direction', 'solar_return', 'synastry_partner'];
    const METHOD_META = {
        transit: { label: 'Транзиты', color: '#1e3a5f' },
        progression: { label: 'Прогрессии', color: '#7c3aed' },
        direction: { label: 'Дирекции', color: '#0f766e' },
        solar_return: { label: 'Соляр', color: '#b45309' },
        synastry_partner: { label: 'Партнёр', color: '#1e3a5f' },
    };

    function cloneArray(value) {
        return Array.isArray(value) ? value.map((item) => ({ ...(item || {}) })) : [];
    }

    function cloneObjectValues(value) {
        return value && typeof value === 'object'
            ? Object.values(value).map((item) => ({ ...(item || {}) }))
            : [];
    }

    function clonePlainObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value)
            ? { ...value }
            : null;
    }

    function normalizeBodyName(name) {
        const rawName = String(name || '').trim();
        const root = typeof window !== 'undefined' ? window : globalThis;
        return root.AstroPreferences?.normalizeMatrixBodyName?.(rawName)
            || root.Symbols?.normalizeBodyName?.(rawName)
            || ({
                TrueNorthNode: 'TrueNode',
                TrueSouthNode: 'SouthNode',
                Fortune: 'PartOfFortune',
            })[rawName]
            || rawName;
    }

    function collectAspectBodies(chartData = {}) {
        const bodiesByName = new Map();
        [
            ...cloneArray(chartData?.planets),
            ...cloneObjectValues(chartData?.special_points),
            ...cloneObjectValues(chartData?.angles),
        ].forEach((body) => {
            if (!body?.name || body?.longitude == null) return;
            const normalizedName = normalizeBodyName(body.name);
            if (!bodiesByName.has(normalizedName)) {
                bodiesByName.set(normalizedName, { ...body, name: normalizedName });
            }
        });
        return [...bodiesByName.values()];
    }

    function normalizeMethod(method) {
        if (method === 'transits') return 'transit';
        if (method === 'progressions') return 'progression';
        if (method === 'directions') return 'direction';
        if (method === 'solar' || method === 'solar_return') return 'solar_return';
        if (method === 'synastry' || method === 'partner' || method === 'synastry_partner') return 'synastry_partner';
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

    function normalizeSolarReturn(data, ringIndex = 1) {
        const bodies = cloneArray(data?.planets).map((planet) => ({
            ...planet,
            house: planet.house ?? null,
        }));
        const aspects = cloneArray(data?.aspects_to_natal).map((aspect) => ({
            ...aspect,
            planet_1: aspect.solar_planet || aspect.planet_1 || aspect.left_planet,
            planet_2: aspect.natal_object || aspect.planet_2 || aspect.right_planet,
            left_planet: aspect.solar_planet || aspect.left_planet || aspect.planet_1,
            right_planet: aspect.natal_object || aspect.right_planet || aspect.planet_2,
            method: 'solar_return',
        }));
        return buildLayer({
            method: 'solar_return',
            bodies,
            houses: cloneArray(data?.houses),
            aspects,
            raw: data,
            ringIndex,
        });
    }

    function normalizeSynastryPartner(data, ringIndex = 1) {
        const partnerChart = data?.partner_chart || data?.partnerChart || data?.chart || data || {};
        const bodies = collectAspectBodies(partnerChart);
        const aspects = cloneArray(data?.inter_aspects || data?.aspects).map((aspect) => ({
            ...aspect,
            planet_1: aspect.planet_2 || aspect.right_planet,
            planet_2: aspect.planet_1 || aspect.left_planet,
            left_planet: aspect.planet_2 || aspect.right_planet,
            right_planet: aspect.planet_1 || aspect.left_planet,
            method: 'synastry_partner',
        }));
        return buildLayer({
            method: 'synastry_partner',
            bodies,
            aspectBodies: bodies,
            houses: cloneArray(partnerChart?.houses),
            aspects,
            raw: data,
            ringIndex,
        });
    }

    function buildLayer({ method, bodies, aspectBodies, houses, aspects, raw, ringIndex, derivedSource }) {
        const normalizedMethod = normalizeMethod(method);
        const source = derivedSource || raw || {};
        return {
            method: normalizedMethod,
            label: METHOD_META[normalizedMethod].label,
            bodies,
            aspectBodies: aspectBodies || bodies,
            houses,
            aspects,
            aspect_configurations: cloneArray(source?.aspect_configurations),
            stelliums: cloneArray(source?.stelliums),
            balances: clonePlainObject(source?.balances),
            cosmogram_pattern: clonePlainObject(source?.cosmogram_pattern),
            planet_distribution: clonePlainObject(source?.planet_distribution),
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
        if (normalizedMethod === 'solar_return') return normalizeSolarReturn(data, ringIndex);
        if (normalizedMethod === 'synastry_partner') return normalizeSynastryPartner(data, ringIndex);
        return normalizeTransit(data, ringIndex);
    }

    /**
     * Multi-instance модель: каждый прогностический слой — инстанс с собственным id.
     * `options.activeInstances` = [{ id, method }] (порядок уже отсортирован вызывающим);
     * `layers` ключуется по id инстанса. Бэк-компат: если передан только `activeMethods`
     * (массив имён методов), строим по-старому, где id === method.
     */
    function resolveActiveInstances(layers, options) {
        if (Array.isArray(options.activeInstances)) {
            return options.activeInstances
                .map((inst) => (inst && typeof inst === 'object'
                    ? { id: inst.id, method: normalizeMethod(inst.method) }
                    : null))
                .filter((inst) => inst && inst.id);
        }
        const activeMethods = Array.isArray(options.activeMethods) ? options.activeMethods : METHOD_ORDER;
        return METHOD_ORDER
            .filter((method) => activeMethods.includes(method))
            .map((method) => ({ id: method, method }));
    }

    function buildViewModel(natalData, layers, options = {}) {
        const instances = resolveActiveInstances(layers, options);
        const ordered = instances
            .map((inst, index) => {
                const raw = layers?.[inst.id];
                if (!raw) return null;
                const layer = normalizeLayer(inst.method, raw, index + 1);
                layer.id = inst.id;
                return layer;
            })
            .filter(Boolean);

        return {
            natalLayer: {
                id: 'natal',
                method: 'natal',
                label: 'Натал',
                bodies: cloneArray(natalData?.planets),
                aspectBodies: collectAspectBodies(natalData),
                houses: cloneArray(natalData?.houses),
                aspects: cloneArray(natalData?.aspects),
                // W3 (Фаза W): углы нужны единому движку для маркеров ASC/MC/DSC/IC
                angles: natalData?.angles || null,
                raw: natalData,
                ringIndex: 0,
                style: { color: '#111111' },
            },
            activePrognosticLayers: ordered,
        };
    }

    /**
     * Развернуть направление межкартных аспектов: в нормализованном слое
     * planet_1/left = тело слоя (соляр/партнёр), planet_2/right = тело натала.
     * После свопа натал становится кольцом (planet_1), а повышенная карта — базой
     * (planet_2), поэтому меняем стороны местами. natal_object в движке — это
     * «опорное» тело (теперь база), обновляем и его.
     */
    function flipInterAspects(aspects) {
        return cloneArray(aspects).map((aspect) => {
            const ringBody = aspect.planet_2 ?? aspect.right_planet ?? aspect.natal_object;
            const baseBody = aspect.planet_1 ?? aspect.left_planet;
            return {
                ...aspect,
                planet_1: ringBody,
                planet_2: baseBody,
                left_planet: ringBody,
                right_planet: baseBody,
                natal_object: baseBody,
            };
        });
    }

    /**
     * «Обмен карт» (аналог кнопки Swap в ZET): повысить прогностический слой
     * (соляр/партнёр) в базовый слот, а исходный натал понизить в единственное
     * внешнее кольцо. Движок рисует natalLayer как опорное кольцо, поэтому базой
     * (natalLayer, method 'natal') становится повышенная карта, а понижённый натал
     * — прогностическим кольцом с method повышенного слоя (чтобы не считаться
     * второй опорной картой). Межкартные аспекты — те же связи, развёрнутые по
     * направлению.
     *
     * @param promotedData natal-образная карта повышенного слоя (соляр/партнёр)
     * @param natalData     исходный натал (становится кольцом)
     * @param layerRaw      сырой ответ слоя (источник его аспектов к наталу)
     * @param ring          { id, method, label, color } понижённого натал-кольца
     */
    function buildSwapViewModel(promotedData, natalData, layerRaw, ring = {}) {
        const method = normalizeMethod(ring.method);
        const base = buildViewModel(promotedData, {}, { activeInstances: [] }).natalLayer;
        const natalAsRing = buildViewModel(natalData, {}, { activeInstances: [] }).natalLayer;
        const normalizedLayer = normalizeLayer(method, layerRaw || {}, 1);
        natalAsRing.id = ring.id || 'natal-ring';
        natalAsRing.method = method;
        natalAsRing.label = ring.label || natalAsRing.label;
        natalAsRing.ringIndex = 1;
        natalAsRing.style = { color: ring.color || '#111111' };
        natalAsRing.aspects = flipInterAspects(normalizedLayer.aspects);
        natalAsRing.aspect_configurations = [];
        natalAsRing.stelliums = [];
        natalAsRing.swappedNatal = true;
        return { natalLayer: base, activePrognosticLayers: [natalAsRing] };
    }

    const api = {
        METHOD_ORDER,
        METHOD_META,
        normalizeMethod,
        normalizeLayer,
        buildViewModel,
        buildSwapViewModel,
    };

    if (typeof window !== 'undefined') window.PrognosticLayerNormalizer = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();

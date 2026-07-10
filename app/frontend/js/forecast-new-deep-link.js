(function(root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.ForecastNewDeepLink = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
    'use strict';

    function resolveLayerEntry(layer, partnerId) {
        const isDirectSynastry = layer === 'synastry_partner' && !!String(partnerId || '').trim();
        if (isDirectSynastry) {
            return { methods: ['synastry_partner'], wheelView: 'multi' };
        }
        return {
            methods: layer === 'transit' ? ['transit'] : ['transit', layer],
            wheelView: null,
        };
    }

    return { resolveLayerEntry };
});

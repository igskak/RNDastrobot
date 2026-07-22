(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.ForecastRangeActions = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    function sync(root, disabled) {
        if (!root?.querySelectorAll) return;
        root.querySelectorAll('[data-forecast-range-action]').forEach((action) => {
            action.setAttribute('aria-disabled', disabled ? 'true' : 'false');
            if (disabled) action.setAttribute('tabindex', '-1');
            else action.removeAttribute('tabindex');
        });
        root.querySelector?.('#forecastRangeActionHint')?.classList.toggle('hidden', !disabled);
    }

    function isDisabledTarget(target) {
        return Boolean(target?.closest?.('[data-forecast-range-action][aria-disabled="true"]'));
    }

    return { sync, isDisabledTarget };
});

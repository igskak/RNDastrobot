(function() {
    'use strict';

    const DISPLAY_MODES = ['prognostic', 'natal-peek', 'natal-pinned'];
    const PERSISTABLE_DISPLAY_MODES = ['prognostic', 'natal-pinned'];
    const EDITABLE_GUARD_SELECTOR = [
        'input',
        'textarea',
        'select',
        '[contenteditable]',
        '[role="textbox"]',
        '[role="searchbox"]',
        '[role="combobox"]',
        '[data-chat-input]',
    ].join(', ');

    function normalizeForecastDisplayMode(value, options = {}) {
        const persisted = options.persisted === true;
        const fallback = 'prognostic';
        const raw = String(value || '').trim();
        const allowed = persisted ? PERSISTABLE_DISPLAY_MODES : DISPLAY_MODES;
        return allowed.includes(raw) ? raw : fallback;
    }

    function reduceForecastDisplayMode(currentMode, action) {
        const current = normalizeForecastDisplayMode(currentMode);
        switch (action) {
        case 'peek-on':
            return current === 'natal-pinned' ? 'natal-pinned' : 'natal-peek';
        case 'peek-off':
            return current === 'natal-peek' ? 'prognostic' : current;
        case 'toggle-pin':
            return current === 'natal-pinned' ? 'prognostic' : 'natal-pinned';
        case 'escape':
            return 'prognostic';
        default:
            return current;
        }
    }

    function isEditableControlTarget(target) {
        let node = target || null;
        while (node && node.nodeType && node.nodeType !== 1) {
            node = node.parentElement || null;
        }
        if (!node || typeof node !== 'object') return false;

        const tagName = String(node.tagName || '').toUpperCase();
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
            return true;
        }

        if (node.isContentEditable === true) {
            return true;
        }

        const role = typeof node.getAttribute === 'function'
            ? String(node.getAttribute('role') || '').toLowerCase()
            : '';
        if (role === 'textbox' || role === 'searchbox' || role === 'combobox') {
            return true;
        }

        if (typeof node.closest === 'function' && node.closest(EDITABLE_GUARD_SELECTOR)) {
            return true;
        }

        return false;
    }

    const api = {
        DISPLAY_MODES,
        PERSISTABLE_DISPLAY_MODES,
        EDITABLE_GUARD_SELECTOR,
        normalizeForecastDisplayMode,
        reduceForecastDisplayMode,
        isEditableControlTarget,
    };

    if (typeof window !== 'undefined') {
        window.ForecastDisplayMode = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})();

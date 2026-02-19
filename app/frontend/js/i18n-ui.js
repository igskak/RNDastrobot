/**
 * DOM i18n bindings for static UI content.
 * Supports text content and common localized attributes.
 */
(function (root) {
    'use strict';

    const DATA_ATTRIBUTE_BINDINGS = [
        ['i18nPlaceholder', 'placeholder'],
        ['i18nTitle', 'title'],
        ['i18nAriaLabel', 'aria-label'],
        ['i18nValue', 'value'],
        ['i18nDataLabel', 'data-label'],
    ];

    function t(key, params) {
        if (!key) return '';
        if (root.FrontendI18n?.t) {
            return root.FrontendI18n.t(key, params);
        }
        return String(key);
    }

    function applyDocumentTitle(documentRef) {
        if (!documentRef?.querySelector) return;
        const titleEl = documentRef.querySelector('title[data-i18n]');
        if (!titleEl) return;
        const nextTitle = t(titleEl.dataset.i18n);
        if (nextTitle) {
            titleEl.textContent = nextTitle;
            documentRef.title = nextTitle;
        }
    }

    function applyI18nToElement(element) {
        if (!element?.dataset) return;

        if (element.dataset.i18n) {
            element.textContent = t(element.dataset.i18n);
        }

        if (element.dataset.i18nHtml) {
            element.innerHTML = t(element.dataset.i18nHtml);
        }

        DATA_ATTRIBUTE_BINDINGS.forEach(([datasetKey, attributeName]) => {
            const translationKey = element.dataset[datasetKey];
            if (!translationKey) return;
            element.setAttribute(attributeName, t(translationKey));
        });
    }

    function applyI18n(documentRef) {
        if (!documentRef?.querySelectorAll) return;

        applyDocumentTitle(documentRef);

        documentRef
            .querySelectorAll('[data-i18n], [data-i18n-html], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria-label], [data-i18n-value], [data-i18n-data-label]')
            .forEach((element) => applyI18nToElement(element));
    }

    function bindI18nUi(options = {}) {
        const documentRef = options.document || (typeof document !== 'undefined' ? document : null);
        if (!documentRef) return;

        const run = () => applyI18n(documentRef);
        const runtime = root.FrontendI18n;
        const ready = runtime?.ready;
        const hasReady = !!(ready && typeof ready.then === 'function');
        let readyResolved = !hasReady;

        const runWhenReady = () => {
            if (!readyResolved) return;
            run();
        };

        documentRef.addEventListener('frontend:locale-changed', runWhenReady);

        if (!hasReady) {
            run();
            return;
        }

        Promise.resolve(ready)
            .catch(() => {
                // ready is best-effort; first render should still proceed
            })
            .then(() => {
                readyResolved = true;
                run();
            });
    }

    const api = {
        t,
        applyI18n,
        applyI18nToElement,
        bindI18nUi,
    };

    root.FrontendI18nUi = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => bindI18nUi());
        } else {
            bindI18nUi();
        }
    }
})(typeof window !== 'undefined' ? window : globalThis);

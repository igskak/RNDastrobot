const test = require('node:test');
const assert = require('node:assert/strict');

const MODULE_PATH = '../frontend/js/place-autocomplete.js';

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function createInput() {
    const listeners = new Map();
    return {
        value: '',
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(handler);
        },
        emit(type, value) {
            this.value = value;
            const handlers = listeners.get(type) || [];
            handlers.forEach((handler) => handler({ target: this }));
        },
    };
}

function createSuggestions() {
    const classState = new Set();
    return {
        innerHTML: '',
        children: [],
        classList: {
            add(name) {
                classState.add(name);
            },
            remove(name) {
                classState.delete(name);
            },
            contains(name) {
                return classState.has(name);
            },
        },
        appendChild(node) {
            this.children.push(node);
        },
    };
}

function loadModule(windowOverride, documentOverride) {
    global.window = windowOverride;
    global.document = documentOverride;
    delete require.cache[require.resolve(MODULE_PATH)];
    require(MODULE_PATH);
    return global.window.PlaceAutocomplete;
}

test('place-autocomplete aborts previous in-flight request and does not log AbortError', async () => {
    const signals = [];
    let fetchCalls = 0;
    const errors = [];

    global.fetch = (url, init = {}) => {
        fetchCalls += 1;
        const signal = init.signal;
        signals.push(signal);
        return new Promise((resolve, reject) => {
            if (signal) {
                signal.addEventListener('abort', () => {
                    const err = new Error('aborted');
                    err.name = 'AbortError';
                    reject(err);
                });
            }
            // Intentionally unresolved: we only care about cancellation behavior.
            void resolve;
        });
    };

    const previousConsoleError = console.error;
    console.error = (...args) => {
        errors.push(args);
    };

    try {
        const input = createInput();
        const suggestions = createSuggestions();
        const api = loadModule(
            {
                FrontendI18n: {
                    normalizeLocale(value) {
                        return value || 'en';
                    },
                    getLocale() {
                        return 'en';
                    },
                },
                AstroAPI: {
                    API_BASE_URL: '/api/v1',
                },
            },
            {
                createElement() {
                    return {
                        className: '',
                        textContent: '',
                        addEventListener() {},
                    };
                },
            }
        );

        api.attach({
            input,
            suggestions,
            debounceMs: 1,
            minChars: 2,
        });

        input.emit('input', 'kyi');
        await wait(5);
        input.emit('input', 'kyiv');
        await wait(5);

        assert.equal(fetchCalls, 2);
        assert.equal(Boolean(signals[0]?.aborted), true);
        assert.equal(errors.length, 0);
    } finally {
        console.error = previousConsoleError;
        delete global.window;
        delete global.document;
        delete global.fetch;
    }
});

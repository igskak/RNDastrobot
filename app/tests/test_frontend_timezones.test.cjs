const test = require('node:test');
const assert = require('node:assert/strict');

const MODULE_PATH = '../frontend/js/timezones.js';

function loadModule() {
    delete require.cache[require.resolve(MODULE_PATH)];
    return require(MODULE_PATH);
}

function makeI18n(catalog) {
    return {
        t(key, params = {}) {
            const value = key.split('.').reduce((acc, part) => (acc && part in acc ? acc[part] : undefined), catalog);
            if (typeof value !== 'string') return key;
            return value.replace(/\{([A-Za-z0-9_]+)\}/g, (_, token) => (token in params ? String(params[token]) : `{${token}}`));
        },
    };
}

function createSelectWithPlaceholder() {
    const select = {
        value: '',
        options: [],
        appendChild(option) {
            option._parent = this;
            if (typeof option.remove !== 'function') {
                option.remove = () => {
                    const idx = this.options.indexOf(option);
                    if (idx >= 0) this.options.splice(idx, 1);
                };
            }
            this.options.push(option);
        },
    };

    const placeholder = {
        value: '',
        textContent: '',
        remove() {
            const idx = select.options.indexOf(this);
            if (idx >= 0) select.options.splice(idx, 1);
        },
    };
    select.options.push(placeholder);

    return select;
}

test('formatTimezoneLabel uses locale catalog labels', () => {
    global.window = {
        FrontendI18n: makeI18n({
            timezones: {
                label: {
                    cityWithOffset: '{city} ({offset})',
                },
                city: {
                    kyiv: 'Київ',
                },
            },
        }),
    };

    const { formatTimezoneLabel } = loadModule();

    const label = formatTimezoneLabel({
        value: 'Europe/Kyiv',
        cityId: 'kyiv',
        offset: 'UTC+2/+3',
    });

    assert.equal(label, 'Київ (UTC+2/+3)');

    delete global.window;
});

test('populateTimezones re-renders translated options and preserves selected value', () => {
    global.document = {
        createElement() {
            return { value: '', textContent: '' };
        },
    };

    global.window = {
        FrontendI18n: makeI18n({
            timezones: {
                label: {
                    cityWithOffset: '{city} ({offset})',
                },
                city: {
                    kyiv: 'Kyiv',
                    moscow: 'Moscow',
                },
            },
        }),
    };

    const { populateTimezones } = loadModule();

    const select = createSelectWithPlaceholder();
    populateTimezones(select);

    const kyivOption = select.options.find((opt) => opt.value === 'Europe/Kyiv');
    assert.ok(kyivOption);
    assert.equal(kyivOption.textContent, 'Kyiv (UTC+2/+3)');

    select.value = 'Europe/Kyiv';

    global.window.FrontendI18n = makeI18n({
        timezones: {
            label: {
                cityWithOffset: '{city} ({offset})',
            },
            city: {
                kyiv: 'Київ',
                moscow: 'Москва',
            },
        },
    });

    populateTimezones(select);

    const kyivOptionLocalized = select.options.find((opt) => opt.value === 'Europe/Kyiv');
    assert.equal(kyivOptionLocalized.textContent, 'Київ (UTC+2/+3)');
    assert.equal(select.value, 'Europe/Kyiv');
    assert.equal(select.options[0].value, '');

    delete global.window;
    delete global.document;
});

test('formatTimezoneLabel uses dedicated UTC label key', () => {
    global.window = {
        FrontendI18n: makeI18n({
            timezones: {
                label: {
                    utc: 'UTC (Всесвітній координований час)',
                },
            },
        }),
    };

    const { formatTimezoneLabel } = loadModule();

    const label = formatTimezoneLabel({
        value: 'UTC',
        cityId: 'utc',
        offset: 'UTC',
    });

    assert.equal(label, 'UTC (Всесвітній координований час)');

    delete global.window;
});

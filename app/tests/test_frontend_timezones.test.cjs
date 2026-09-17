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

test('formatTimezoneOffsetLabel returns UTC offset without city name', () => {
    global.window = {};

    const { formatTimezoneOffsetLabel } = loadModule();

    assert.equal(formatTimezoneOffsetLabel('Europe/Kyiv'), 'UTC+2/+3');
    assert.equal(formatTimezoneOffsetLabel('Europe/Kiev'), 'UTC+2/+3');
    assert.equal(formatTimezoneOffsetLabel('GMT+2:00'), 'UTC+2:00');
    assert.equal(formatTimezoneOffsetLabel('UTC'), 'UTC');

    delete global.window;
});

test('formatTimezoneOffsetLabel returns concrete offset for chart date', () => {
    global.window = {};

    const { formatTimezoneOffsetLabel } = loadModule();

    assert.equal(formatTimezoneOffsetLabel('Europe/Madrid', { date: '2007-01-28', time: '11:22:00' }), 'UTC+1');
    assert.equal(formatTimezoneOffsetLabel('Europe/Madrid', { date: '2007-09-28', time: '11:22:00' }), 'UTC+2');
    assert.equal(formatTimezoneOffsetLabel('America/New_York', { datetime: '2026-01-01T12:00:00' }), 'UTC-5');
    assert.equal(formatTimezoneOffsetLabel('America/New_York', { datetime: '2026-07-01T12:00:00' }), 'UTC-4');

    delete global.window;
});

test('formatTimezoneOffsetLabel uses account preference prefix when not passed explicitly', () => {
    global.window = {
        AstroPreferences: {
            getTimezoneLabelFormat() {
                return 'GMT';
            },
        },
    };

    const { formatTimezoneOffsetLabel } = loadModule();

    assert.equal(formatTimezoneOffsetLabel('Europe/Kyiv'), 'GMT+2/+3');
    assert.equal(formatTimezoneOffsetLabel('Europe/Madrid', { date: '2007-09-28', time: '11:22:00' }), 'GMT+2');

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

test('guessTimezone detects Lisbon, Porto and Rio de Janeiro variants', () => {
    global.window = {};
    const { guessTimezone } = loadModule();

    assert.equal(guessTimezone('Lisbon, Portugal'), 'Europe/Lisbon');
    assert.equal(guessTimezone('Lisboa, Portugal'), 'Europe/Lisbon');
    assert.equal(guessTimezone('Порту, Португалия'), 'Europe/Lisbon');
    assert.equal(guessTimezone('Porto Alegre, Brazil'), 'America/Sao_Paulo');
    assert.equal(guessTimezone('Rio de Janeiro, Brazil'), 'America/Sao_Paulo');
    assert.equal(guessTimezone('Рио де Жанейро, Бразилия'), 'America/Sao_Paulo');

    delete global.window;
});

test('historical offsets retain seconds and survive select repopulation', () => {
    global.window = {};
    global.document = { createElement: () => ({ value: '', textContent: '' }) };
    const tz = loadModule();
    assert.equal(tz.getFixedOffsetSeconds('UTC+00:52:08'), 3128);
    assert.equal(tz.getFixedOffsetSeconds('UTC-06:53:20'), -24800);
    assert.equal(tz.getFixedOffsetSeconds('UTC-00:14:28'), -868);
    assert.equal(tz.getTimezoneOffsetMinutes('UTC+00:52:08') * 60, 3128);
    for (const bad of ['UTC+24:00', 'UTC+00:60', 'UTC+00:00:60', 'UTC+3:5']) {
        assert.equal(tz.isValidTimezone(bad), false);
    }
    const select = createSelectWithPlaceholder();
    tz.populateTimezones(select);
    tz.selectTimezoneValue(select, 'UTC+00:52:08');
    tz.populateTimezones(select);
    assert.equal(select.value, 'UTC+00:52:08');
    assert.equal(select.options.filter(o => o.value === select.value).length, 1);
    assert.equal(select.options.find(o => o.value === select.value).textContent, 'UTC+00:52:08');
    delete global.window;
    delete global.document;
});

test('local moment conversion handles fixed seconds and named timezones', () => {
    global.window = {};
    const { getLocalIso } = loadModule();
    assert.equal(getLocalIso(new Date('1889-04-20T17:37:51Z'), 'UTC+00:52:08'), '1889-04-20T18:29:59');
    assert.equal(getLocalIso(new Date('1542-12-07T13:26:28Z'), 'UTC-00:14:28'), '1542-12-07T13:12:00');
    assert.equal(getLocalIso(new Date('2026-07-15T22:00:00Z'), 'Europe/Madrid'), '2026-07-16T00:00:00');
    delete global.window;
});

test('ISO timestamps with second-precision offsets are valid browser instants', () => {
    global.window = {};
    const { parseInstant } = loadModule();
    assert.equal(parseInstant('1889-04-20T18:29:59+00:52:08').toISOString(), '1889-04-20T17:37:51.000Z');
    assert.equal(parseInstant('1542-12-07T13:12:00-00:14:28').toISOString(), '1542-12-07T13:26:28.000Z');
    assert.equal(parseInstant('2026-01-01T12:00:00+02:00').toISOString(), '2026-01-01T10:00:00.000Z');
    delete global.window;
});

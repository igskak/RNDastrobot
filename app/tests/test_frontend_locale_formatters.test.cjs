const test = require('node:test');
const assert = require('node:assert/strict');

const {
    formatAstroCoordinate,
    formatDate,
    formatDateTime,
} = require('../frontend/js/locale-formatters.js');

test.afterEach(() => {
    delete globalThis.Symbols;
    delete globalThis.AstroPreferences;
});

test('formatAstroCoordinate renders degrees only by default', () => {
    globalThis.Symbols = { signs: { Cancer: '♋' } };

    assert.equal(
        formatAstroCoordinate({ sign: 'Cancer', degree_in_sign: 24.869634 }),
        '24° ♋',
    );
});

test('formatAstroCoordinate renders degrees and minutes when requested explicitly', () => {
    globalThis.Symbols = { signs: { Pisces: '♓' } };

    assert.equal(
        formatAstroCoordinate({ sign: 'Pisces', degree_in_sign: 29.999 }, { degreeFormat: 'DEGREES_MINUTES' }),
        "29° ♓ 59'",
    );
});

test('formatAstroCoordinate renders degrees, minutes, and seconds when requested explicitly', () => {
    globalThis.Symbols = { signs: { Cancer: '♋' } };

    assert.equal(
        formatAstroCoordinate({ sign: 'Cancer', degree_in_sign: 24.869634 }, { degreeFormat: 'DEGREES_MINUTES_SECONDS' }),
        '24° ♋ 52\' 10"',
    );
});

test('formatAstroCoordinate tolerates missing sign', () => {
    assert.equal(formatAstroCoordinate({ degree_in_sign: 2.5 }), '2°');
});

test('formatDate uses DD.MM.YYYY by default', () => {
    assert.equal(formatDate('2026-05-17T14:35:00Z'), '17.05.2026');
});

test('formatDateTime uses DD.MM.YYYY by default', () => {
    const formatted = formatDateTime('2026-05-17T14:35:00Z');
    assert.match(formatted, /^17\.05\.2026 /);
    assert.equal(formatted.includes('17.05.2026 17.05.2026'), false);
});

test('formatDate keeps a bare YYYY-MM-DD day stable across timezones', () => {
    // A date-only string must be parsed in local time, otherwise a UTC parse
    // would shift the day by -1 for viewers in negative-offset timezones.
    assert.equal(formatDate('2026-05-17'), '17.05.2026');
});

test('formatDate honors locale preference override', () => {
    globalThis.AstroPreferences = {
        getAccountVisualPreferences: () => ({ date_format: 'LOCALE' }),
        getDateFormat: () => 'LOCALE',
    };

    assert.notEqual(formatDate('2026-05-17T14:35:00Z'), '17.05.2026');
});

test('formatDate supports MM/DD/YYYY', () => {
    globalThis.AstroPreferences = {
        getAccountVisualPreferences: () => ({ date_format: 'MM_DD_YYYY' }),
        getDateFormat: () => 'MM_DD_YYYY',
    };

    assert.equal(formatDate('2026-05-17T14:35:00Z'), '05/17/2026');
});

test('formatDate supports YYYY-MM-DD', () => {
    globalThis.AstroPreferences = {
        getAccountVisualPreferences: () => ({ date_format: 'YYYY_MM_DD' }),
        getDateFormat: () => 'YYYY_MM_DD',
    };

    assert.equal(formatDate('2026-05-17T14:35:00Z'), '2026-05-17');
});

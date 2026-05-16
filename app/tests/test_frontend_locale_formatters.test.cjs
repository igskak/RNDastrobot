const test = require('node:test');
const assert = require('node:assert/strict');

const { formatAstroCoordinate } = require('../frontend/js/locale-formatters.js');

test('formatAstroCoordinate renders degrees sign minutes', () => {
    globalThis.Symbols = { signs: { Cancer: '♋' } };

    assert.equal(
        formatAstroCoordinate({ sign: 'Cancer', degree_in_sign: 24.869634 }),
        "24° ♋ 52'",
    );
});

test('formatAstroCoordinate floors minutes without rolling to invalid 30 degrees', () => {
    globalThis.Symbols = { signs: { Pisces: '♓' } };

    assert.equal(
        formatAstroCoordinate({ sign: 'Pisces', degree_in_sign: 29.999 }),
        "29° ♓ 59'",
    );
});

test('formatAstroCoordinate tolerates missing sign', () => {
    assert.equal(formatAstroCoordinate({ degree_in_sign: 2.5 }), "2° 30'");
});

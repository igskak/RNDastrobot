const test = require('node:test');
const assert = require('node:assert/strict');

const {
    todayIsoDate,
    normalizeTime,
    splitTargetDatetime,
    normalizeTimezoneValue,
} = require('../frontend/js/forecast-source-utils.js');

// Characterization-тесты: фиксируют ТЕКУЩЕЕ поведение forecast-new.js, чтобы извлечение
// панели не меняло его молча.

test('normalizeTime: HH:MM:SS passes through', () => {
    assert.equal(normalizeTime('08:15:30'), '08:15:30');
});

test('normalizeTime: HH:MM gets :00 seconds', () => {
    assert.equal(normalizeTime('08:15'), '08:15:00');
});

test('normalizeTime: garbage/empty falls back to noon', () => {
    assert.equal(normalizeTime(''), '12:00:00');
    assert.equal(normalizeTime('nonsense'), '12:00:00');
    assert.equal(normalizeTime(null), '12:00:00');
});

test('splitTargetDatetime: valid ISO datetime splits into [date, time]', () => {
    assert.deepEqual(splitTargetDatetime('1990-09-11T10:30:00'), ['1990-09-11', '10:30:00']);
});

test('splitTargetDatetime: date-only defaults time to noon', () => {
    assert.deepEqual(splitTargetDatetime('1990-09-11'), ['1990-09-11', '12:00:00']);
});

test('splitTargetDatetime: invalid date uses injected fallback', () => {
    assert.deepEqual(splitTargetDatetime('garbage', '2026-06-02'), ['2026-06-02', '12:00:00']);
});

test('splitTargetDatetime: HH:MM time is normalized to HH:MM:SS', () => {
    assert.deepEqual(splitTargetDatetime('2020-01-02T07:05'), ['2020-01-02', '07:05:00']);
});

test('todayIsoDate: formats an injected date as YYYY-MM-DD', () => {
    assert.equal(todayIsoDate(new Date(2026, 5, 2)), '2026-06-02'); // месяц 0-индексный
});

const TZ = {
    list: [{ value: 'Europe/Kiev' }, { value: 'America/New_York' }],
    guess: (s) => (String(s).toLowerCase().includes('lviv') ? 'Europe/Kiev' : null),
};

test('normalizeTimezoneValue: exact list match returns the value', () => {
    assert.equal(normalizeTimezoneValue('Europe/Kiev', '', TZ), 'Europe/Kiev');
});

test('normalizeTimezoneValue: empty input returns empty string', () => {
    assert.equal(normalizeTimezoneValue('', 'Lviv', TZ), '');
});

test('normalizeTimezoneValue: falls back to guess-by-value then guess-by-place', () => {
    assert.equal(normalizeTimezoneValue('Lviv', '', TZ), 'Europe/Kiev');       // guess by value
    assert.equal(normalizeTimezoneValue('Unknownville', 'Lviv', TZ), 'Europe/Kiev'); // guess by place
});

test('normalizeTimezoneValue: no match returns empty string', () => {
    assert.equal(normalizeTimezoneValue('Mars/Olympus', 'Olympus', TZ), '');
});

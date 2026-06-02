const test = require('node:test');
const assert = require('node:assert/strict');

const { listMethods, buildLayerRequest, getEntry } = require('../frontend/js/methodology-registry.js');

const SAVED = { mode: 'saved', userId: 'user-1' };
const MANUAL = {
    mode: 'manual',
    datetime: '1990-09-11T10:30:00',
    timezone: 'Europe/Kiev',
    location: { name: 'Kyiv', latitude: 50.45, longitude: 30.52 },
};
const TARGET = {
    datetime: '2026-06-02T12:00:00',
    timezone: 'Europe/Kiev',
    location: { name: 'Kyiv', latitude: 50.45, longitude: 30.52 },
};

test('registry lists the supported methodologies', () => {
    assert.deepEqual(listMethods().sort(), ['direction', 'progression', 'solar_return', 'transit']);
});

test('transit request: saved source -> user_id + transit moment fields', () => {
    const req = buildLayerRequest('transit', SAVED, TARGET);
    assert.equal(req.endpoint, '/transits/calculate');
    assert.equal(req.ringMethod, 'transit');
    assert.equal(req.body.user_id, 'user-1');
    assert.equal('natal' in req.body, false);
    assert.equal(req.body.date, '2026-06-02');
    assert.equal(req.body.time, '12:00:00');
    assert.equal(req.body.latitude, 50.45);
});

test('transit request: manual source -> inline natal, no user_id (mirrors NatalSourceMixin)', () => {
    const req = buildLayerRequest('transit', MANUAL, TARGET);
    assert.equal('user_id' in req.body, false);
    assert.deepEqual(req.body.natal, {
        date: '1990-09-11',
        time: '10:30:00',
        timezone: 'Europe/Kiev',
        place: 'Kyiv',
        latitude: 50.45,
        longitude: 30.52,
    });
});

test('progression request shape', () => {
    const req = buildLayerRequest('progression', SAVED, TARGET);
    assert.equal(req.endpoint, '/progressions/calculate');
    assert.equal(req.body.target_date, '2026-06-02');
    assert.equal(req.body.target_time, '12:00:00');
    assert.equal(req.body.save_to_db, false);
});

test('direction request carries direction_type option', () => {
    const req = buildLayerRequest('direction', SAVED, TARGET, { directionType: 'solar_arc' });
    assert.equal(req.endpoint, '/directions/calculate');
    assert.equal(req.body.direction_type, 'solar_arc');
    assert.equal(req.body.target_date, '2026-06-02');
});

test('solar_return uses the year input variant', () => {
    assert.equal(getEntry('solar_return').targetInputVariant, 'year');
    const req = buildLayerRequest('solar_return', SAVED, { year: 2026, timezone: 'Europe/Kiev', location: { latitude: 50.45, longitude: 30.52, name: 'Kyiv' } });
    assert.equal(req.body.year, 2026);
    assert.equal(req.body.save_to_db, false);
});

test('unknown methodology throws', () => {
    assert.throws(() => buildLayerRequest('composite', SAVED, TARGET), /Unknown methodology/);
});

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    ChartSourcePanel,
    buildSourcePayload,
} = require('../frontend/js/chart-source-panel.js');

test('manual panel auto-generates a stable ephemeralId', () => {
    const p = new ChartSourcePanel({ mode: 'manual' });
    const id = p.getSource().ephemeralId;
    assert.ok(id, 'ephemeralId should be set for manual mode');
    // стабилен между чтениями
    assert.equal(p.getSource().ephemeralId, id);
});

test('two manual panels get distinct ephemeralIds (fixes cache collision)', () => {
    const a = new ChartSourcePanel({ mode: 'manual' });
    const b = new ChartSourcePanel({ mode: 'manual' });
    assert.notEqual(a.getSource().ephemeralId, b.getSource().ephemeralId);
});

test('update() emits change with the new snapshot', () => {
    const p = new ChartSourcePanel({ mode: 'manual', timezone: 'UTC' });
    let seen = null;
    p.on('change', (snap) => { seen = snap; });
    p.update({ timezone: 'Europe/Kiev', datetime: '1990-09-11T10:30:00' });
    assert.equal(seen.timezone, 'Europe/Kiev');
    assert.equal(seen.datetime, '1990-09-11T10:30:00');
});

test('selectSaved switches to saved mode, clears ephemeralId, sets userId', () => {
    const p = new ChartSourcePanel({ mode: 'manual' });
    p.selectSaved('user-123', {
        datetime: '1985-01-01T08:00:00',
        timezone: 'Europe/Kiev',
        location: { name: 'Lviv', latitude: 49.84, longitude: 24.03 },
    });
    const s = p.getSource();
    assert.equal(s.mode, 'saved');
    assert.equal(s.userId, 'user-123');
    assert.equal(s.ephemeralId, null);
    assert.equal(p.isEphemeral(), false);
});

test('getSource()/setSource() round-trips (serializable for sessionStorage/URL)', () => {
    const p = new ChartSourcePanel({
        mode: 'manual',
        inputVariant: 'year',
        year: 2026,
        timezone: 'Europe/Kiev',
        location: { name: 'Kyiv', latitude: 50.45, longitude: 30.52 },
    });
    const snap = p.getSource();
    const json = JSON.parse(JSON.stringify(snap));   // должен пережить сериализацию
    const p2 = new ChartSourcePanel().setSource(json);
    assert.deepEqual(p2.getSource(), snap);
});

test('requestSave emits save-request with the snapshot', () => {
    const p = new ChartSourcePanel({ mode: 'manual', datetime: '2020-02-02T02:02:02', timezone: 'UTC' });
    let fired = null;
    p.on('save-request', (snap) => { fired = snap; });
    p.requestSave();
    assert.ok(fired);
    assert.equal(fired.datetime, '2020-02-02T02:02:02');
});

test('buildSourcePayload: saved mode → {user_id}', () => {
    const p = new ChartSourcePanel({ mode: 'manual' });
    p.selectSaved('user-abc', {});
    assert.deepEqual(buildSourcePayload(p.getSource()), { user_id: 'user-abc' });
});

test('buildSourcePayload: manual mode → {natal:{...}} matching backend NatalSourceMixin', () => {
    const p = new ChartSourcePanel({
        mode: 'manual',
        datetime: '1990-09-11T10:30:00',
        timezone: 'Europe/Kiev',
        location: { name: 'Kyiv', latitude: 50.45, longitude: 30.52 },
    });
    const payload = buildSourcePayload(p.getSource());
    assert.deepEqual(payload, {
        natal: {
            date: '1990-09-11',
            time: '10:30:00',
            timezone: 'Europe/Kiev',
            place: 'Kyiv',
            latitude: 50.45,
            longitude: 30.52,
        },
    });
    // инвариант «ровно один источник»: нет user_id рядом с natal
    assert.equal('user_id' in payload, false);
});

test('methodology fields never leak into the panel snapshot', () => {
    const p = new ChartSourcePanel({ mode: 'manual' });
    // даже если кто-то попытается протолкнуть методичное поле — снимок его не несёт
    p.update({ directionType: 'solar_arc', layer: 'transit' });
    const s = p.getSource();
    assert.equal('directionType' in s, false);
    assert.equal('layer' in s, false);
});

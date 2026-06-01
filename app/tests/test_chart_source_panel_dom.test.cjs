const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const { ChartSourcePanel } = require('../frontend/js/chart-source-panel.js');

function setupDom() {
    const dom = new JSDOM(`<!DOCTYPE html><body>
        <input id="date" type="date">
        <input id="time" type="time">
        <input id="tz" type="text">
        <input id="loc" type="text">
        <input id="lat" type="text">
        <input id="lon" type="text">
        <input id="year" type="number">
    </body>`);
    const doc = dom.window.document;
    const els = {
        dateInput: doc.getElementById('date'),
        timeInput: doc.getElementById('time'),
        timezoneInput: doc.getElementById('tz'),
        locationInput: doc.getElementById('loc'),
        latitudeInput: doc.getElementById('lat'),
        longitudeInput: doc.getElementById('lon'),
        yearInput: doc.getElementById('year'),
    };
    return { dom, els };
}

function fire(dom, el) {
    el.dispatchEvent(new dom.window.Event('input'));
}

test('attachDom hydrates panel state from existing input values', () => {
    const { els } = setupDom();
    els.dateInput.value = '1990-09-11';
    els.timeInput.value = '10:30:00';
    els.timezoneInput.value = 'Europe/Kiev';
    els.locationInput.value = 'Kyiv';
    els.latitudeInput.value = '50.45';
    els.longitudeInput.value = '30.52';

    const panel = new ChartSourcePanel({ mode: 'manual' }).attachDom(els);
    const s = panel.getSource();
    assert.equal(s.datetime, '1990-09-11T10:30:00');
    assert.equal(s.timezone, 'Europe/Kiev');
    assert.deepEqual(
        { name: s.location.name, lat: s.location.latitude, lon: s.location.longitude },
        { name: 'Kyiv', lat: 50.45, lon: 30.52 },
    );
});

test('editing a DOM input updates state and emits change', () => {
    const { dom, els } = setupDom();
    const panel = new ChartSourcePanel({ mode: 'manual' }).attachDom(els);
    let seen = null;
    panel.on('change', (snap) => { seen = snap; });

    els.dateInput.value = '2026-06-02';
    els.timeInput.value = '08:15';
    fire(dom, els.timeInput);

    assert.ok(seen, 'change should fire');
    assert.equal(seen.datetime, '2026-06-02T08:15');
    assert.equal(panel.getSource().datetime, '2026-06-02T08:15');
});

test('latitude/longitude parse to numbers, blank to null', () => {
    const { dom, els } = setupDom();
    const panel = new ChartSourcePanel({ mode: 'manual' }).attachDom(els);

    els.latitudeInput.value = '48.21';
    els.longitudeInput.value = '';
    fire(dom, els.latitudeInput);

    const loc = panel.getSource().location;
    assert.equal(loc.latitude, 48.21);
    assert.equal(loc.longitude, null);
});

test('year input feeds the year field (solar variant)', () => {
    const { dom, els } = setupDom();
    const panel = new ChartSourcePanel({ mode: 'manual', inputVariant: 'year' }).attachDom(els);
    els.yearInput.value = '2026';
    fire(dom, els.yearInput);
    assert.equal(panel.getSource().year, 2026);
});

test('syncToDom writes panel state back into inputs', () => {
    const { els } = setupDom();
    // attachDom гидратирует ИЗ DOM — задаём начальные значения в инпутах
    els.locationInput.value = 'NYC';
    els.latitudeInput.value = '40.71';
    els.longitudeInput.value = '-74.0';
    const panel = new ChartSourcePanel({ mode: 'manual' }).attachDom(els);

    // меняем только дату/время/таймзону программно → location сохраняется
    panel.update({ datetime: '2000-12-31T23:59:59', timezone: 'UTC' });
    panel.syncToDom();

    assert.equal(els.dateInput.value, '2000-12-31');
    assert.equal(els.timezoneInput.value, 'UTC');
    assert.equal(els.locationInput.value, 'NYC');
    assert.equal(els.latitudeInput.value, '40.71');
});

test('partial element set: panel works with only date+time inputs', () => {
    const { dom, els } = setupDom();
    const panel = new ChartSourcePanel({ mode: 'manual' }).attachDom({
        dateInput: els.dateInput,
        timeInput: els.timeInput,
    });
    els.dateInput.value = '2026-03-21';
    els.timeInput.value = '00:00';
    fire(dom, els.dateInput);
    assert.equal(panel.getSource().datetime, '2026-03-21T00:00');
});

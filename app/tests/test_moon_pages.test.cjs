'use strict';

// The generated moon pages must match their sources, and the two page scripts must behave:
// render as text, map errors to the catalog messages, save journal answers to the server, and
// record interest in the personal month without charging anything.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const appRoot = path.resolve(__dirname, '..');
const pagesDir = path.join(appRoot, 'frontend', 'moon');
const toolSource = fs.readFileSync(path.join(appRoot, 'frontend', 'js', 'moon-tool.js'), 'utf8');
const letterSource = fs.readFileSync(path.join(appRoot, 'frontend', 'js', 'moon-letter.js'), 'utf8');

test('generated moon pages are up to date with their catalogs', () => {
    const run = spawnSync('node', [path.join(appRoot, 'scripts', 'build-moon-pages.mjs'), '--check'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr || run.stdout);
});

function makeDom(file, source, url, fetchImpl) {
    const html = fs.readFileSync(path.join(pagesDir, file), 'utf8').replace(/<script src="[^"]*" defer><\/script>/, '');
    const dom = new JSDOM(html, { runScripts: 'outside-only', url });
    dom.window.fetch = fetchImpl;
    dom.window.eval(source);
    return dom;
}

const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

const lunation = (kind, extra = {}) => Object.assign({
    kind, kind_label: kind === 'new_moon' ? 'New Moon' : 'Full Moon', utc: '2026-11-09T07:02:07Z',
    date_label: '09 Nov 2026, 08:02', sign_in: 'in Scorpio', house: 3,
    headline: kind === 'new_moon' ? 'New Moon in Scorpio, in your house 3' : 'Full Moon in Gemini, in your house 10',
    theme: 'This part of your chart is about words.', prompts: ['First?', 'Second?', 'Third?'],
    affirmation: 'My words can be clear and kind.', frame_note: 'Houses are counted from your rising sign.',
}, extra);

function submit(dom, id) {
    dom.window.document.getElementById(id).dispatchEvent(new dom.window.Event('submit', { cancelable: true, bubbles: true }));
}

test('calculator renders lunations as text and opens the signup', async () => {
    const calls = [];
    const dom = makeDom('pl/index.html', toolSource, 'http://localhost/moon/pl', (url, init) => {
        calls.push({ url, body: init && init.body && JSON.parse(init.body) });
        return json(200, { frame: 'rising', lunations: [lunation('new_moon', { headline: '<img src=x onerror=window.__pwned=1>' }), lunation('full_moon')] });
    });
    const doc = dom.window.document;
    doc.getElementById('birth-date').value = '1990-05-17';
    submit(dom, 'moon-form');
    await tick();

    assert.equal(calls[0].url, '/api/v1/moon/chart');
    assert.equal(calls[0].body.locale, 'pl');
    assert.equal(calls[0].body.birth.date, '1990-05-17');
    const result = doc.getElementById('result');
    assert.equal(result.hidden, false);
    assert.equal(result.querySelectorAll('.lunation').length, 2);
    assert.equal(result.querySelector('img'), null);
    assert.equal(dom.window.__pwned, undefined);
    assert.equal(doc.getElementById('signup').hidden, false);
});

test('calculator asks for a date before calling the server', async () => {
    let called = false;
    const dom = makeDom('index.html', toolSource, 'http://localhost/moon', () => { called = true; return json(200, {}); });
    submit(dom, 'moon-form');
    await tick();
    assert.equal(called, false);
    assert.equal(dom.window.document.getElementById('form-error').hidden, false);
});

test('signup maps an unavailable service to the catalog message', async () => {
    const ui = JSON.parse(fs.readFileSync(path.join(appRoot, 'frontend', 'moon-src', 'de.json'), 'utf8')).ui;
    const dom = makeDom('de/index.html', toolSource, 'http://localhost/moon/de', (url) => (
        url.endsWith('/chart') ? json(200, { frame: 'sun', lunations: [lunation('new_moon')] }) : json(503, {})
    ));
    const doc = dom.window.document;
    doc.getElementById('birth-date').value = '1990-05-17';
    submit(dom, 'moon-form');
    await tick();
    doc.getElementById('signup-email').value = 'ola@example.com';
    doc.getElementById('signup-consent').checked = true;
    submit(dom, 'signup-form');
    await tick();
    assert.equal(doc.getElementById('signup-error').textContent, ui.errorUnavailable);
});

test('the next lunation in the table is highlighted', () => {
    const dom = makeDom('index.html', toolSource, 'http://localhost/moon', () => json(200, {}));
    const rows = [...dom.window.document.querySelectorAll('tr[data-utc]')];
    const next = rows.filter((row) => row.classList.contains('next'));
    assert.ok(next.length <= 1);
    if (next.length) assert.ok(Date.parse(next[0].getAttribute('data-utc')) > Date.now());
});

test('letter page saves answers to the journal and records interest', async () => {
    const calls = [];
    const journal = [{ utc: '2026-10-26T04:11:49Z', kind: 'full_moon', label: 'Full Moon · 26 Oct 2026', entries: [{ index: 1, question: 'Old?', answer: '<b>older answer</b>' }] }];
    const dom = makeDom('letter.html', letterSource, 'http://localhost/moon/letter?t=tok123456789&confirm=1', (url, init) => {
        calls.push({ url, body: JSON.parse(init.body) });
        if (url.endsWith('/letter')) return json(200, { status: 'confirmed', locale: 'en', current: lunation('new_moon'), next: lunation('full_moon'), journal, interested: false });
        return json(200, { status: 'saved' });
    });
    const doc = dom.window.document;
    await tick();
    assert.deepEqual(calls[0].body, { token: 'tok123456789', confirm: true });
    assert.equal(doc.getElementById('letter-status').hidden, false);
    assert.match(doc.getElementById('history-list').textContent, /<b>older answer<\/b>/);
    const areas = doc.querySelectorAll('#letter textarea');
    assert.equal(areas.length, 3);

    areas[0].value = 'Read one book';
    areas[0].dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await tick(900);
    const save = calls.find((call) => call.url === '/api/v1/moon/journal/save');
    assert.deepEqual(save.body, { token: 'tok123456789', lunation_utc: '2026-11-09T07:02:07Z', kind: 'new_moon', index: 0, question: 'First?', answer: 'Read one book' });
    assert.match(doc.getElementById('history-list').textContent, /Read one book/);
    assert.equal(dom.window.localStorage.length, 0, 'nothing is kept in the browser');

    assert.equal(doc.getElementById('journal-offer').hidden, false);
    doc.getElementById('offer-btn').click();
    await tick();
    assert.equal(calls[calls.length - 1].url, '/api/v1/moon/interest');
    assert.equal(doc.getElementById('offer-thanks').hidden, false);
});

test('an unconfirmed address cannot write yet', async () => {
    const dom = makeDom('letter.html', letterSource, 'http://localhost/moon/letter?t=tok123456789', () => (
        json(200, { status: 'pending', locale: 'en', current: lunation('new_moon'), next: lunation('full_moon'), journal: [], interested: false })
    ));
    await tick();
    const areas = [...dom.window.document.querySelectorAll('#letter textarea')];
    assert.ok(areas.length && areas.every((area) => area.disabled));
    assert.equal(dom.window.document.getElementById('journal-offer').hidden, true);
});

test('index page shows both examples and sends the journal link', async () => {
    const calls = [];
    const dom = makeDom('pl/index.html', toolSource, 'http://localhost/moon/pl', (url, init) => {
        calls.push({ url, body: JSON.parse(init.body) });
        return json(200, { status: 'check_inbox' });
    });
    const doc = dom.window.document;
    assert.equal(doc.querySelectorAll('.plans .example').length, 2);
    assert.equal(doc.querySelectorAll('.plans .plan').length, 2);
    doc.getElementById('link-email').value = 'ola@example.com';
    submit(dom, 'link-form');
    await tick();
    assert.deepEqual(calls[0], { url: '/api/v1/moon/link', body: { email: 'ola@example.com', locale: 'pl' } });
    assert.equal(doc.getElementById('link-done').hidden, false);
});

test('letter page without a valid token says so', async () => {
    const noToken = makeDom('letter.html', letterSource, 'http://localhost/moon/letter', () => json(200, {}));
    await tick();
    assert.match(noToken.window.document.getElementById('letter').textContent, /not valid/);

    const forged = makeDom('fr/letter.html', letterSource, 'http://localhost/moon/fr/letter?t=forged0000', () => json(404, {}));
    await tick();
    assert.equal(forged.window.document.querySelector('#letter .error').textContent.length > 10, true);
});

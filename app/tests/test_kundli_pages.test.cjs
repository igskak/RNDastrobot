'use strict';

// The generated kundli pages must match their sources, and the calculator script must behave:
// render results as text, map errors to the catalog messages, and hold back the paid upsell
// unless the server says it is on.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const appRoot = path.resolve(__dirname, '..');
const pagesDir = path.join(appRoot, 'frontend', 'kundli');
const scriptSource = fs.readFileSync(path.join(appRoot, 'frontend', 'js', 'kundli-tool.js'), 'utf8');

test('generated kundli pages are up to date with their catalogs', () => {
    const run = spawnSync('node', [path.join(appRoot, 'scripts', 'build-kundli-pages.mjs'), '--check'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr || run.stdout);
});

function makeDom(file, fetchImpl) {
    const html = fs.readFileSync(path.join(pagesDir, file), 'utf8').replace(/<script src="[^"]*" defer><\/script>/, '');
    const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/kundli/x' });
    dom.window.fetch = fetchImpl;
    dom.window.eval(scriptSource);
    return dom;
}

const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

const dashaResponse = {
    report: {
        greeting: null,
        headline: 'You are in the Jupiter period.',
        data: {
            moon: { rashi_label: 'Capricorn', nakshatra_label: 'Dhanishta', pada: 2 },
            birth_balance: { lord_label: 'Mars', years_remaining: 5.03 },
            mahadashas: [
                { lord_label: 'Mars', start: '1988-05-27', end: '1995-05-28', years: 7, current: false },
                { lord_label: '<img src=x onerror=window.__pwned=1>', start: '1995-05-28', end: '2013-05-27', years: 18, current: true },
            ],
            antardashas: [{ lord_label: 'Jupiter', start: '2013-05-27', end: '2015-07-16', current: true }],
        },
    },
    birth: { time_known: false, uncertainty: { nakshatra_may_differ: true, rashi_may_differ: false } },
};

function fill(dom, date = '1990-05-17') {
    const doc = dom.window.document;
    doc.getElementById('p1-date').value = date;
    doc.getElementById('tool-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true, bubbles: true }));
}

test('dasha result renders as text, marks the current period, and notes an unknown time', async () => {
    const calls = [];
    const dom = makeDom('dasha-calculator.html', (url, init) => {
        calls.push({ url, body: init && init.body });
        return url.endsWith('/config') ? json(200, { paid_enabled: false }) : json(200, dashaResponse);
    });
    fill(dom);
    await tick();
    const doc = dom.window.document;
    const result = doc.getElementById('result');
    assert.equal(result.hidden, false);
    assert.match(result.textContent, /Jupiter period/);
    assert.equal(result.querySelectorAll('tr[aria-current="true"]').length, 2);
    assert.equal(result.querySelector('img'), null, 'labels must be inserted as text, never as markup');
    assert.equal(dom.window.__pwned, undefined);
    assert.match(result.textContent, /different nakshatra/);
    const post = calls.find((c) => c.url.endsWith('/dasha'));
    assert.deepEqual(JSON.parse(post.body).birth, { date: '1990-05-17', time: null, timezone: 'Asia/Kolkata', name: null });
    assert.equal(doc.getElementById('upsell').hidden, true, 'the paid block stays hidden while the server has it off');
});

test('the form refuses to submit without a date', async () => {
    let called = false;
    const dom = makeDom('dasha-calculator.html', () => { called = true; return json(200, {}); });
    fill(dom, '');
    await tick();
    assert.equal(called, false);
    assert.match(dom.window.document.getElementById('form-error').textContent, /date of birth/i);
});

for (const [status, pattern] of [[422, /check the date/i], [429, /wait a minute/i], [500, /went wrong/i]]) {
    test(`a ${status} answer is shown with its catalog message`, async () => {
        const dom = makeDom('dasha-calculator.html', () => json(status, {}));
        fill(dom);
        await tick();
        const doc = dom.window.document;
        assert.match(doc.getElementById('form-error').textContent, pattern);
        assert.equal(doc.getElementById('result').hidden, true);
        assert.equal(doc.querySelector('#tool-form button[type="submit"]').disabled, false, 'the button must come back');
    });
}

test('a network failure is shown as such', async () => {
    const dom = makeDom('dasha-calculator.html', () => Promise.reject(new TypeError('offline')));
    fill(dom);
    await tick();
    assert.match(dom.window.document.getElementById('form-error').textContent, /could not reach the server/i);
});

test('the paid block appears only when the server enables it for this language', async () => {
    const dom = makeDom('dasha-calculator.html', (url) => (url.endsWith('/config')
        ? json(200, { paid_enabled: true, reviewed_locales: ['en'], price_labels: { weekly: '$3 a week', biweekly: '' } })
        : json(200, dashaResponse)));
    fill(dom);
    await tick();
    const doc = dom.window.document;
    assert.equal(doc.getElementById('upsell').hidden, false);
    assert.match(doc.querySelector('[data-price="weekly"]').textContent, /\$3 a week/);
});

test('the paid block stays hidden when the language is not reviewed', async () => {
    const dom = makeDom('dasha-calculator.html', (url) => (url.endsWith('/config')
        ? json(200, { paid_enabled: true, reviewed_locales: ['hi'] })
        : json(200, dashaResponse)));
    fill(dom);
    await tick();
    assert.equal(dom.window.document.getElementById('upsell').hidden, true);
});

test('checkout validates the email and the consent box before calling the server', async () => {
    const calls = [];
    const dom = makeDom('dasha-calculator.html', (url, init) => {
        calls.push(url);
        return url.endsWith('/config') ? json(200, { paid_enabled: true, reviewed_locales: ['en'], price_labels: {} }) : json(200, dashaResponse);
    });
    fill(dom);
    await tick();
    const doc = dom.window.document;
    const form = doc.getElementById('upsell-form');
    const submit = () => form.dispatchEvent(new dom.window.Event('submit', { cancelable: true, bubbles: true }));
    doc.getElementById('up-email').value = 'nope';
    submit();
    assert.match(doc.getElementById('upsell-error').textContent, /valid email/i);
    doc.getElementById('up-email').value = 'a@example.com';
    submit();
    assert.match(doc.getElementById('upsell-error').textContent, /tick the box/i);
    assert.equal(calls.filter((url) => url.endsWith('/checkout')).length, 0);
});

test('the Hindi page uses the Hindi catalog', async () => {
    const dom = makeDom(path.join('hi', 'dasha-calculator.html'), () => json(422, {}));
    fill(dom);
    await tick();
    assert.match(dom.window.document.getElementById('form-error').textContent, /तारीख़/);
});

test('matching page asks for two people and posts both', async () => {
    let body = null;
    const dom = makeDom('kundli-matching.html', (url, init) => {
        body = JSON.parse(init.body);
        return json(200, {
            report: { greeting: null, headline: 'ok', data: { total: 27, max: 36, koota: [{ label: 'Varna', points: 1, max: 1, text: 'fine' }] } },
            groom: { time_known: true }, bride: { time_known: true },
        });
    });
    const doc = dom.window.document;
    doc.getElementById('groom-date').value = '1990-05-17';
    doc.getElementById('bride-date').value = '1992-02-03';
    doc.getElementById('bride-unknown').checked = true;
    doc.getElementById('bride-unknown').dispatchEvent(new dom.window.Event('change'));
    doc.getElementById('tool-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true, bubbles: true }));
    await tick();
    assert.equal(body.groom.date, '1990-05-17');
    assert.equal(body.bride.time, null);
    assert.match(doc.getElementById('result').textContent, /27 out of 36/);
});

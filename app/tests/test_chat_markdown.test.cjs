const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const { render, toPlainText } = require('../frontend/js/chat-markdown.js');

const { document } = new JSDOM('<!doctype html><body></body>').window;

function renderText(text) {
    return render(document.createElement('div'), text, document);
}

// A reply the assistant actually gave on prod (2026-09-24), trimmed.
const PROD_REPLY = [
    'Pluto conjunct Moon, past and next 5 years.',
    '',
    '**2) 2026-01-04 to 2029-02-10**',
    '- Exact passes: 3',
    '- 2027-02-17 11:29, D',
    '- 2027-08-03 04:48, R',
    '',
    'Only the middle window perfects.',
].join('\n');

test('bold and bullets render as elements, with no markers left', () => {
    const el = renderText(PROD_REPLY);
    assert.ok(!el.textContent.includes('**'));
    assert.equal(el.querySelector('strong').textContent, '2) 2026-01-04 to 2029-02-10');
    const items = [...el.querySelectorAll('ul > li')].map((li) => li.textContent);
    assert.deepEqual(items, ['Exact passes: 3', '2027-02-17 11:29, D', '2027-08-03 04:48, R']);
    assert.equal(el.querySelectorAll('p').length, 3);
});

test('a bold line directly above a list stays a paragraph, not a list item', () => {
    const el = renderText('**Scope**\n- House system: Placidus');
    assert.equal(el.children[0].tagName, 'P');
    assert.equal(el.children[1].tagName, 'UL');
});

test('numbered lists keep their starting number', () => {
    const el = renderText('3. Third\n4. Fourth');
    const ol = el.querySelector('ol');
    assert.equal(ol.getAttribute('start'), '3');
    assert.equal(ol.children.length, 2);
});

test('single lines inside a paragraph become <br>, headings become bold', () => {
    const el = renderText('### Window\nline one\nline two');
    assert.equal(el.querySelector('.chat-md-heading strong').textContent, 'Window');
    assert.equal(el.querySelectorAll('br').length, 1);
});

test('italics and code need real content; stray asterisks and underscores stay literal', () => {
    const el = renderText('orb 2 * 3 and *slow* in America/Los_Angeles with `R` flag');
    assert.equal(el.querySelector('em').textContent, 'slow');
    assert.equal(el.querySelector('code').textContent, 'R');
    assert.ok(el.textContent.includes('2 * 3'));
    assert.ok(el.textContent.includes('Los_Angeles'));
});

test('markup in the reply is text, never HTML', () => {
    const el = renderText('**<img src=x onerror=alert(1)>**\n- <script>alert(1)</script>');
    assert.equal(el.querySelector('img'), null);
    assert.equal(el.querySelector('script'), null);
    assert.equal(el.querySelector('strong').textContent, '<img src=x onerror=alert(1)>');
});

test('empty and missing input render nothing', () => {
    assert.equal(renderText('').childNodes.length, 0);
    assert.equal(renderText(null).childNodes.length, 0);
});

test('toPlainText strips markers for the one-line voice status', () => {
    assert.equal(toPlainText('## Window\n**3 exact passes** in `2027`'), 'Window\n3 exact passes in 2027');
});

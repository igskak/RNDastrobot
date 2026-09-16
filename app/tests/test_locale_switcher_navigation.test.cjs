const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const SWITCHER_SOURCE = fs.readFileSync(
    path.resolve(__dirname, '../frontend/js/locale-switcher.js'),
    'utf8',
);

const PAGE = `<!doctype html>
<html lang="en">
<head>
    <link rel="alternate" hreflang="en" href="https://www.steliara.com/pricing.html">
    <link rel="alternate" hreflang="de" href="https://www.steliara.com/de/pricing.html">
</head>
<body class="pricing-page">
    <header class="header">
        <div class="landing-header-actions"><a class="index-header-link-primary" href="#">Sign up</a></div>
    </header>
</body>
</html>`;

/**
 * jsdom refuses to let a test redefine location.assign, so the switcher IIFE runs in a
 * plain vm context against a stand-in window whose navigation we can observe.
 */
async function mountSwitcher({ html = PAGE, url = 'https://www.steliara.com/pricing.html', locale = 'en' } = {}) {
    const dom = new JSDOM(html, { url });
    // jsdom parses asynchronously; the switcher only mounts once the document is ready.
    if (dom.window.document.readyState === 'loading') {
        await new Promise((resolve) => dom.window.addEventListener('DOMContentLoaded', resolve));
    }
    const { document } = dom.window;
    const current = new URL(url);

    const navigations = [];
    const setLocaleCalls = [];
    const remembered = [];

    const windowStub = {
        FrontendI18n: {
            SUPPORTED_LOCALES: ['en', 'uk', 'ru', 'de'],
            getLocale: () => locale,
            t: (key) => key,
            setLocale: async (next, options) => {
                setLocaleCalls.push([next, options]);
                return next;
            },
            rememberLocale: (next) => {
                remembered.push(next);
                return next;
            },
        },
        location: {
            href: current.href,
            origin: current.origin,
            pathname: current.pathname,
            search: current.search,
            hash: current.hash,
            assign: (target) => navigations.push(target),
        },
    };

    vm.runInNewContext(SWITCHER_SOURCE, {
        window: windowStub,
        document,
        URL: dom.window.URL,
        setTimeout,
        clearTimeout,
    });

    return { dom, document, navigations, setLocaleCalls, remembered };
}

function clickLocale(document, locale) {
    const button = document.querySelector(`#localeSwitcher [data-locale="${locale}"]`);
    assert.ok(button, `locale button ${locale} is missing`);
    button.dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true }));
}

test('switching to a locale with a prerendered URL navigates instead of swapping text', async () => {
    const { document, navigations, setLocaleCalls } = await mountSwitcher({
        url: 'https://www.steliara.com/pricing.html?gclid=abc123&utm_source=google#plans',
    });

    clickLocale(document, 'de');

    assert.deepEqual(navigations, ['https://www.steliara.com/de/pricing.html?gclid=abc123&utm_source=google#plans']);
    assert.deepEqual(setLocaleCalls, [], 'the new document resolves its own locale from the path');
});

test('ad and analytics params survive the language switch', async () => {
    const { document, navigations } = await mountSwitcher({
        url: 'https://www.steliara.com/pricing.html?gclid=abc123',
    });

    clickLocale(document, 'de');

    assert.ok(navigations[0].includes('gclid=abc123'), `gclid dropped: ${navigations[0]}`);
});

test('a locale without a prerendered URL still switches in place', async () => {
    const { document, navigations, setLocaleCalls } = await mountSwitcher();

    clickLocale(document, 'ru');

    assert.deepEqual(navigations, []);
    assert.equal(setLocaleCalls.length, 1);
    assert.equal(setLocaleCalls[0][0], 'ru');
});

test('the active locale is not clickable and never navigates', async () => {
    const { document, navigations, setLocaleCalls } = await mountSwitcher({ locale: 'de', url: 'https://www.steliara.com/de/pricing.html' });

    clickLocale(document, 'de');

    assert.deepEqual(navigations, []);
    assert.deepEqual(setLocaleCalls, []);
});

test('the switch stays on the host the visitor is actually browsing', async () => {
    // hreflang hrefs are canonical production URLs; on localhost or a staging host,
    // following them verbatim would navigate away from the environment under test.
    const { document, navigations } = await mountSwitcher({ url: 'http://localhost:8012/pricing.html' });

    clickLocale(document, 'de');

    assert.deepEqual(navigations, ['http://localhost:8012/de/pricing.html']);
});

test('the chosen language is remembered before leaving the page', async () => {
    // The target document works out its own locale from the URL, but the workspace the
    // visitor signs in to has no prefix — it reads the stored choice instead.
    const { document, remembered, navigations } = await mountSwitcher();

    clickLocale(document, 'de');

    assert.deepEqual(remembered, ['de']);
    assert.equal(navigations.length, 1);
});

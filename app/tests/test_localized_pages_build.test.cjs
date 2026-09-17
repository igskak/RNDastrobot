const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const frontendRoot = path.resolve(__dirname, '../frontend');
const LOCALES = ['de', 'ru', 'uk'];
const PAGES = ['index.html', 'pricing.html', 'terms.html', 'login.html'];
const ORIGIN = 'https://www.steliara.com';

let buildLocalizedPages;

test.before(async () => {
    ({ buildLocalizedPages } = await import('../scripts/build-localized-pages.mjs'));
});

function readGenerated(locale, page) {
    return fs.readFileSync(path.join(frontendRoot, locale, page), 'utf8');
}

function documentOf(html) {
    return new JSDOM(html).window.document;
}

test('committed localized pages match a fresh build', async () => {
    const outputs = await buildLocalizedPages({ write: false });

    for (const [target, content] of outputs) {
        const relative = path.relative(frontendRoot, target);
        assert.equal(
            fs.readFileSync(target, 'utf8'),
            content,
            `${relative} is stale — run "npm --prefix app run build:localized" and commit the result`,
        );
    }

    assert.equal(outputs.size, PAGES.length * (LOCALES.length + 1));
});

test('every localized page declares its own language and canonical URL', () => {
    for (const locale of LOCALES) {
        for (const page of PAGES) {
            const document = documentOf(readGenerated(locale, page));
            const expectedPath = page === 'index.html' ? `/${locale}/` : `/${locale}/${page}`;

            assert.equal(document.documentElement.getAttribute('lang'), locale, `${locale}/${page} lang`);
            assert.equal(
                document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
                `${ORIGIN}${expectedPath}`,
                `${locale}/${page} canonical`,
            );
        }
    }
});

test('localized pages carry a reciprocal hreflang set including x-default', () => {
    for (const page of PAGES) {
        const bare = page === 'index.html' ? '/' : `/${page}`;
        const expected = new Map([
            ['en', `${ORIGIN}${bare}`],
            ...LOCALES.map((locale) => [locale, `${ORIGIN}/${locale}${bare === '/' ? '/' : bare}`]),
            ['x-default', `${ORIGIN}${bare}`],
        ]);

        const documents = [
            documentOf(fs.readFileSync(path.join(frontendRoot, page), 'utf8')),
            ...LOCALES.map((locale) => documentOf(readGenerated(locale, page))),
        ];

        for (const document of documents) {
            const links = [...document.querySelectorAll('link[rel="alternate"][hreflang]')];
            const actual = new Map(links.map((link) => [link.getAttribute('hreflang'), link.getAttribute('href')]));
            assert.deepEqual(actual, expected, `${page} alternates`);
        }
    }
});

test('no translation key leaks into the rendered text', () => {
    for (const locale of LOCALES) {
        for (const page of PAGES) {
            const document = documentOf(readGenerated(locale, page));

            for (const element of document.querySelectorAll('[data-i18n]')) {
                const key = element.getAttribute('data-i18n');
                assert.notEqual(
                    element.textContent.trim(),
                    key,
                    `${locale}/${page}: "${key}" rendered as its own key`,
                );
            }
        }
    }
});

test('localized pages are actually translated, not copies of the English source', () => {
    for (const locale of LOCALES) {
        const english = documentOf(fs.readFileSync(path.join(frontendRoot, 'index.html'), 'utf8'));
        const translated = documentOf(readGenerated(locale, 'index.html'));

        assert.notEqual(
            translated.querySelector('title').textContent,
            english.querySelector('title').textContent,
            `${locale}/index.html title is still English`,
        );
        assert.notEqual(
            translated.querySelector('meta[name="description"]').getAttribute('content'),
            english.querySelector('meta[name="description"]').getAttribute('content'),
            `${locale}/index.html description is still English`,
        );
    }
});

test('assets resolve from the prefixed URL and page links stay inside the locale', () => {
    for (const locale of LOCALES) {
        for (const page of PAGES) {
            const document = documentOf(readGenerated(locale, page));

            for (const element of document.querySelectorAll('[href], [src]')) {
                for (const attribute of ['href', 'src']) {
                    const value = element.getAttribute(attribute);
                    if (value === null) continue;
                    if (/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value)) continue;

                    assert.ok(
                        value.startsWith('/'),
                        `${locale}/${page}: relative ${attribute}="${value}" would 404 under the locale prefix`,
                    );

                    const target = value.split(/[?#]/)[0];
                    const linkedPage = target === `/${locale}/` ? 'index.html' : target.replace(`/${locale}/`, '');
                    if (PAGES.includes(linkedPage)) {
                        assert.ok(
                            target.startsWith(`/${locale}/`),
                            `${locale}/${page}: link to ${target} drops the visitor back into English`,
                        );
                    }
                }
            }
        }
    }
});

test('English sources keep their bare canonical URLs', () => {
    const document = documentOf(fs.readFileSync(path.join(frontendRoot, 'index.html'), 'utf8'));
    assert.equal(document.querySelector('link[rel="canonical"]')?.getAttribute('href'), `${ORIGIN}/`);
});

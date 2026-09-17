/**
 * Prerenders the public pages into one static document per locale.
 *
 * Why prerender instead of letting the browser translate: a German visitor arriving from
 * an ad must get German HTML in the first byte — not English text that JavaScript swaps a
 * moment later — and a crawler must find German content at a German URL it can index.
 *
 * English keeps the bare URLs (/pricing.html); every other locale lives under its own
 * prefix (/de/pricing.html). English is prerendered too, back over its own source file —
 * before that, `/` shipped 126 empty data-i18n nodes and one word of body text while
 * /de/ shipped 859, so the highest-priority URL on the site was blank to any crawler
 * that does not run JavaScript, which is most of the AI crawlers robots.txt invites in.
 *
 * Output is committed; `npm run check:localized-pages` fails the build when it drifts
 * from the sources or the catalogs, which also pins this script's idempotency.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const {
    DEFAULT_LOCALE,
    PREFIXED_LOCALES,
    localizePath,
} = require('../frontend/js/i18n.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const frontendRoot = path.join(appRoot, 'frontend');
const localesRoot = path.join(frontendRoot, 'locales');

const SITE_ORIGIN = (process.env.FRONTEND_BASE_URL || 'https://www.steliara.com').replace(/\/+$/, '');

// Pages that exist as their own indexable document in every locale. Conquest landing
// pages are deliberately absent: they carry no data-i18n markup yet.
const LOCALIZED_PAGES = ['index.html', 'pricing.html', 'terms.html', 'login.html'];

const OG_LOCALES = { en: 'en_US', de: 'de_DE', ru: 'ru_RU', uk: 'uk_UA' };

const HREFLANG_START = '<!-- hreflang:start -->';
const HREFLANG_END = '<!-- hreflang:end -->';

const TRANSLATED_LOCALES = [...PREFIXED_LOCALES].sort();

// Mirrors i18n-ui.js: same attributes, same meaning, so a prerendered page and a
// browser-translated one cannot disagree.
const ATTRIBUTE_BINDINGS = [
    ['i18nPlaceholder', 'placeholder'],
    ['i18nTitle', 'title'],
    ['i18nAriaLabel', 'aria-label'],
    ['i18nValue', 'value'],
    ['i18nDataLabel', 'data-label'],
    ['i18nContent', 'content'],
];

const I18N_SELECTOR = [
    '[data-i18n]',
    '[data-i18n-html]',
    '[data-i18n-placeholder]',
    '[data-i18n-title]',
    '[data-i18n-aria-label]',
    '[data-i18n-value]',
    '[data-i18n-data-label]',
    '[data-i18n-content]',
].join(', ');

function pagePath(page) {
    return page === 'index.html' ? '/' : `/${page}`;
}

function absoluteUrl(page, locale) {
    return `${SITE_ORIGIN}${localizePath(pagePath(page), locale)}`;
}

function lookup(catalog, key) {
    const parts = String(key).split('.').filter(Boolean);
    let current = catalog;
    for (const part of parts) {
        if (!current || typeof current !== 'object' || !(part in current)) return undefined;
        current = current[part];
    }
    return typeof current === 'string' ? current : undefined;
}

function createTranslator(catalog, page, locale) {
    return (key) => {
        const value = lookup(catalog, key);
        if (value === undefined) {
            // Falling back to English here would ship a half-translated page that looks
            // fine in review and reads as broken to the visitor. Fail loudly instead.
            throw new Error(`[localized-pages] ${locale}/${page}: missing translation for "${key}"`);
        }
        return value;
    };
}

function isExternalUrl(value) {
    return /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value);
}

/**
 * Rewrites one href/src so it still resolves from a prefixed URL. Relative asset paths
 * become root-absolute (at /de/ the browser would otherwise ask for /de/bundles/...),
 * and links to pages that have a translation stay inside the visitor's locale.
 */
function rewriteUrl(value, locale) {
    if (!value || isExternalUrl(value)) return value;

    const match = /^([^?#]*)([?#][\s\S]*)?$/.exec(value);
    let target = match?.[1] || '';
    const suffix = match?.[2] || '';
    if (!target) return value;

    if (!target.startsWith('/')) target = `/${target}`;
    if (target === '/index.html') target = '/';

    const page = target === '/' ? 'index.html' : target.slice(1);
    if (!LOCALIZED_PAGES.includes(page)) {
        // Assets and pages without a translation keep their single canonical URL.
        return `${target}${suffix}`;
    }

    return `${localizePath(target, locale)}${suffix}`;
}

function alternateRows(page) {
    return [
        ['en', absoluteUrl(page, DEFAULT_LOCALE)],
        ...TRANSLATED_LOCALES.map((locale) => [locale, absoluteUrl(page, locale)]),
        // Search engines send anyone we have no better match for to the English page.
        ['x-default', absoluteUrl(page, DEFAULT_LOCALE)],
    ];
}

function buildAlternateLinks(page, indent) {
    return alternateRows(page)
        .map(([hreflang, href]) => `${indent}<link rel="alternate" hreflang="${hreflang}" href="${href}">`)
        .join('\n');
}

/** Inserts (or refreshes) the hreflang block in a source page, without reformatting it. */
function syncSourceAlternates(source, page) {
    const indent = '    ';
    const block = `${HREFLANG_START}\n${buildAlternateLinks(page, indent)}\n${indent}${HREFLANG_END}`;

    const start = source.indexOf(HREFLANG_START);
    const end = source.indexOf(HREFLANG_END);
    if (start !== -1 && end > start) {
        return `${source.slice(0, start)}${block}${source.slice(end + HREFLANG_END.length)}`;
    }

    const titleEnd = source.indexOf('</title>');
    if (titleEnd === -1) {
        throw new Error(`[localized-pages] ${page}: no <title> to anchor the hreflang block to`);
    }
    const insertAt = titleEnd + '</title>'.length;
    return `${source.slice(0, insertAt)}\n${indent}${block}${source.slice(insertAt)}`;
}

/** Keeps appended head tags on their own indented line, so the output stays readable. */
function appendToHead(document, node) {
    document.head.appendChild(document.createTextNode('\n    '));
    document.head.appendChild(node);
}

function upsertMeta(document, { attribute, name, content }) {
    let element = document.head.querySelector(`meta[${attribute}="${name}"]`);
    if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, name);
        appendToHead(document, element);
    }
    element.setAttribute('content', content);
}

function localizeJsonLd(document, { locale, description }) {
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
        let payload;
        try {
            payload = JSON.parse(script.textContent);
        } catch {
            continue;
        }
        if (payload.url) payload.url = absoluteUrl('index.html', locale);
        if (payload.description) payload.description = description;
        if (payload.inLanguage || payload['@type'] === 'SoftwareApplication') payload.inLanguage = locale;
        script.textContent = `\n    ${JSON.stringify(payload)}\n    `;
    }
}

function localizeDocument(document, { page, locale, translate }) {
    document.documentElement.setAttribute('lang', locale);

    const title = document.querySelector('title[data-i18n]');
    if (title) title.textContent = translate(title.dataset.i18n);

    for (const element of document.querySelectorAll(I18N_SELECTOR)) {
        if (element.dataset.i18n && element.tagName !== 'TITLE') {
            element.textContent = translate(element.dataset.i18n);
        }
        if (element.dataset.i18nHtml) {
            element.innerHTML = translate(element.dataset.i18nHtml);
        }
        for (const [datasetKey, attributeName] of ATTRIBUTE_BINDINGS) {
            const key = element.dataset[datasetKey];
            if (key) element.setAttribute(attributeName, translate(key));
        }
    }

    for (const element of document.querySelectorAll('[href], [src]')) {
        for (const attribute of ['href', 'src']) {
            const value = element.getAttribute(attribute);
            if (value === null) continue;
            const rewritten = rewriteUrl(value, locale);
            if (rewritten !== value) element.setAttribute(attribute, rewritten);
        }
    }

    const canonicalUrl = absoluteUrl(page, locale);
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        appendToHead(document, canonical);
    }
    canonical.setAttribute('href', canonicalUrl);

    // The hreflang block is identical in every locale (it lists absolute URLs), so it is
    // inherited from the source document rather than rebuilt here.
    const alternateCount = document.querySelectorAll('link[rel="alternate"][hreflang]').length;
    if (alternateCount !== alternateRows(page).length) {
        throw new Error(`[localized-pages] ${locale}/${page}: expected the source hreflang block to be in place`);
    }

    const description = document.head.querySelector('meta[name="description"]')?.getAttribute('content');
    if (document.head.querySelector('meta[property="og:url"]')) {
        upsertMeta(document, { attribute: 'property', name: 'og:url', content: canonicalUrl });
    }
    if (document.head.querySelector('meta[property="og:title"]') && title) {
        upsertMeta(document, { attribute: 'property', name: 'og:title', content: title.textContent });
    }
    if (document.head.querySelector('meta[property="og:description"]') && description) {
        upsertMeta(document, { attribute: 'property', name: 'og:description', content: description });
    }
    if (document.head.querySelector('meta[property="og:type"]')) {
        upsertMeta(document, { attribute: 'property', name: 'og:locale', content: OG_LOCALES[locale] || locale });
    }

    if (description) localizeJsonLd(document, { locale, description });

    // English is prerendered back over its own source file, so every pass has to land on
    // a fixed point. Left alone, both of these grow by one blank line per build (the head
    // from the append below, the body from the newline that ends the file and that the
    // parser moves inside </body>), which would break `check:localized-pages` on the
    // second run.
    endWithSingleNewline(document.head);
    endWithSingleNewline(document.body);
}

/** Collapses a node's trailing whitespace into exactly one newline, so rebuilds converge. */
function endWithSingleNewline(parent) {
    const TEXT_NODE = 3;
    while (
        parent.lastChild
        && parent.lastChild.nodeType === TEXT_NODE
        && !parent.lastChild.textContent.trim()
    ) {
        parent.removeChild(parent.lastChild);
    }
    parent.appendChild(parent.ownerDocument.createTextNode('\n'));
}

export async function buildLocalizedPages({ write = true } = {}) {
    const catalogs = Object.fromEntries(
        await Promise.all(
            [DEFAULT_LOCALE, ...TRANSLATED_LOCALES].map(async (locale) => [
                locale,
                JSON.parse(await readFile(path.join(localesRoot, `${locale}.json`), 'utf8')),
            ]),
        ),
    );

    const outputs = new Map();

    for (const page of LOCALIZED_PAGES) {
        const sourcePath = path.join(frontendRoot, page);
        const source = syncSourceAlternates(await readFile(sourcePath, 'utf8'), page);

        for (const locale of [DEFAULT_LOCALE, ...TRANSLATED_LOCALES]) {
            const dom = new JSDOM(source);
            localizeDocument(dom.window.document, {
                page,
                locale,
                translate: createTranslator(catalogs[locale], page, locale),
            });
            // English keeps the bare URL, so its prerendered document *is* the source
            // file. The data-i18n attributes survive, so the browser can still switch
            // locales in place; it just no longer has to fill in an empty page first.
            const target = locale === DEFAULT_LOCALE ? sourcePath : path.join(frontendRoot, locale, page);
            outputs.set(target, `${dom.serialize()}\n`);
        }
    }

    if (write) {
        for (const locale of TRANSLATED_LOCALES) {
            await rm(path.join(frontendRoot, locale), { recursive: true, force: true });
            await mkdir(path.join(frontendRoot, locale), { recursive: true });
        }
        for (const [target, content] of outputs) {
            await writeFile(target, content, 'utf8');
        }
    }

    return outputs;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
    const outputs = await buildLocalizedPages();
    console.log(
        `[localized-pages] wrote ${outputs.size} files for locales: `
        + [DEFAULT_LOCALE, ...TRANSLATED_LOCALES].join(', '),
    );
}

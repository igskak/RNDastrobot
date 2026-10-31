#!/usr/bin/env node
/**
 * Build the public kundli pages (English and Hindi) from app/frontend/kundli-src/{en,hi}.json.
 *
 * Output: app/frontend/kundli/*.html and app/frontend/kundli/hi/*.html. They are build output:
 * edit the catalogs (copy) or this file (structure) and rebuild. `--check` rebuilds in memory
 * and fails on any difference, which is what CI runs.
 *
 * Why not the localized-pages build: that pipeline translates the whole application catalog,
 * which is far larger than these pages and not available in Hindi. Like the Russian and
 * Ukrainian conquest pages, these live in their own folder with their own routes, so the
 * localized build never deletes them.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '..', 'frontend');
const srcRoot = path.join(frontendRoot, 'kundli-src');
const outRoot = path.join(frontendRoot, 'kundli');
const ORIGIN = 'https://www.steliara.com';
const LOCALES = ['en', 'hi'];
const ASSET_VERSION = '3';

const TOOLS = {
    'dasha-calculator': { tool: 'dasha', nav: 'navDasha' },
    'sade-sati-calculator': { tool: 'sade-sati', nav: 'navSadeSati' },
    'kundli-matching': { tool: 'matching', nav: 'navMatching' },
};
const INDEXABLE = ['index', ...Object.keys(TOOLS)];
const ALL_PAGES = [...INDEXABLE, 'report', 'thanks'];

const TIMEZONES = [
    'Asia/Kolkata', 'Asia/Kathmandu', 'Asia/Dhaka', 'Asia/Colombo', 'Asia/Karachi', 'Asia/Dubai',
    'Asia/Singapore', 'Asia/Kuala_Lumpur', 'Europe/London', 'Europe/Berlin', 'America/New_York',
    'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'Australia/Sydney',
    'Africa/Nairobi', 'UTC',
];

const esc = (value) => String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function pagePath(locale, slug, { html = false } = {}) {
    const suffix = html ? '.html' : '';
    const base = locale === 'hi' ? '/kundli/hi' : '/kundli';
    return slug === 'index' ? base : `${base}/${slug}${suffix}`;
}

function outFile(locale, slug) {
    return path.join(locale === 'hi' ? path.join(outRoot, 'hi') : outRoot, `${slug}.html`);
}

function personFields(prefix, legend, ui) {
    const tzOptions = TIMEZONES.map((tz) => `<option value="${tz}"${tz === 'Asia/Kolkata' ? ' selected' : ''}>${tz}</option>`).join('');
    return `
      <fieldset class="person" data-person="${prefix}">
        <legend>${esc(legend)}</legend>
        <div class="field">
          <label for="${prefix}-name">${esc(ui.name)}</label>
          <input id="${prefix}-name" name="name" type="text" maxlength="40" autocomplete="off" placeholder="${esc(ui.namePlaceholder)}">
        </div>
        <div class="field">
          <label for="${prefix}-date">${esc(ui.date)}</label>
          <input id="${prefix}-date" name="date" type="date" min="1900-01-01" max="2100-12-31" required>
        </div>
        <div class="field">
          <label for="${prefix}-time">${esc(ui.time)}</label>
          <input id="${prefix}-time" name="time" type="time">
          <label class="check"><input id="${prefix}-unknown" name="unknown" type="checkbox"> ${esc(ui.timeUnknown)}</label>
        </div>
        <div class="field place">
          <label for="${prefix}-place">${esc(ui.place)}</label>
          <input id="${prefix}-place" name="place" type="text" autocomplete="off" role="combobox"
                 aria-autocomplete="list" aria-expanded="false" aria-controls="${prefix}-places" aria-describedby="${prefix}-place-hint">
          <ul id="${prefix}-places" class="suggestions" role="listbox" hidden></ul>
          <p id="${prefix}-place-hint" class="hint">${esc(ui.placeHint)}</p>
        </div>
        <div class="field">
          <label for="${prefix}-tz">${esc(ui.timezone)}</label>
          <select id="${prefix}-tz" name="timezone">${tzOptions}</select>
          <p class="hint" id="${prefix}-tz-hint" aria-live="polite"></p>
        </div>
      </fieldset>`;
}

function jsonLd(locale, slug, page) {
    const url = `${ORIGIN}${pagePath(locale, slug)}`;
    const blocks = [];
    if (slug !== 'index') {
        blocks.push({
            '@context': 'https://schema.org', '@type': 'WebApplication', name: page.h1, url,
            description: page.description, applicationCategory: 'LifestyleApplication', operatingSystem: 'Web',
            inLanguage: locale, isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        });
    }
    if (page.faq) {
        blocks.push({
            '@context': 'https://schema.org', '@type': 'FAQPage',
            mainEntity: page.faq.map((item) => ({
                '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
        });
    }
    return blocks.map((block) => `    <script type="application/ld+json">${JSON.stringify(block)}</script>`).join('\n');
}

function head(locale, slug, catalog) {
    const page = catalog.pages[slug];
    const indexable = INDEXABLE.includes(slug);
    const url = `${ORIGIN}${pagePath(locale, slug)}`;
    const alternates = indexable
        ? LOCALES.map((l) => `    <link rel="alternate" hreflang="${l}" href="${ORIGIN}${pagePath(l, slug)}">`).join('\n')
          + `\n    <link rel="alternate" hreflang="x-default" href="${ORIGIN}${pagePath('en', slug)}">`
        : '';
    return `<!DOCTYPE html>
<html lang="${locale}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
    <link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png">
    <title>${esc(page.title)}</title>
    <meta name="description" content="${esc(page.description)}">
${indexable ? '' : '    <meta name="robots" content="noindex, nofollow">\n    <meta name="referrer" content="no-referrer">\n'}    <link rel="canonical" href="${url}">
${alternates}
    <meta property="og:title" content="${esc(page.title)}">
    <meta property="og:description" content="${esc(page.description)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${url}">
    <meta property="og:locale" content="${locale === 'hi' ? 'hi_IN' : 'en_US'}">
    <meta property="og:image" content="${ORIGIN}/assets/brand/og-image.png">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="stylesheet" href="/css/kundli.css?v=${ASSET_VERSION}">
${jsonLd(locale, slug, page)}
</head>`;
}

function header(locale, slug, catalog) {
    const site = catalog.site;
    const other = locale === 'en' ? 'hi' : 'en';
    const links = [
        ['index', site.navHub],
        ...Object.entries(TOOLS).map(([s, meta]) => [s, site[meta.nav]]),
    ].map(([s, label]) => `<a href="${pagePath(locale, s)}"${s === slug ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('');
    const switchSlug = ALL_PAGES.includes(slug) ? slug : 'index';
    return `<header class="site-header">
    <div class="shell bar">
      <a class="brand" href="${pagePath(locale, 'index')}">${esc(site.brand)}</a>
      <nav class="nav" aria-label="${esc(site.navHub)}">${links}</nav>
      <a class="lang" href="${pagePath(other, switchSlug)}" hreflang="${other}" lang="${other}" aria-label="${esc(site.langSwitchLabel)}">${esc(site.langSwitch)}</a>
    </div>
  </header>`;
}

// The free tools stand apart from the pages for professional astrologers: the footer links to
// the terms and, in English, to the sister free tools (moon calendar), never to the pro site.
function footer(locale, catalog) {
    const site = catalog.site;
    const also = site.alsoFree
        ? `<p class="links also-free">${esc(site.alsoFree.text)} <a href="${site.alsoFree.href}">${esc(site.alsoFree.label)}</a></p>\n      `
        : '';
    return `<footer class="site-footer">
    <div class="shell">
      <p class="disclaimer">${esc(site.footerNote)}</p>
      ${also}<p class="links"><a href="/terms.html">${esc(site.footerTerms)}</a></p>
    </div>
  </footer>`;
}

function sections(page) {
    return (page.sections || []).map((section) => `
      <section class="copy">
        <h2>${esc(section.h2)}</h2>
        ${section.p.map((p) => `<p>${esc(p)}</p>`).join('\n        ')}
      </section>`).join('');
}

function faq(page) {
    if (!page.faq) return '';
    return `
      <section class="copy faq">
        <h2>${esc(page.faqTitle || 'FAQ')}</h2>
        ${page.faq.map((item) => `<h3>${esc(item.q)}</h3>\n        <p>${esc(item.a)}</p>`).join('\n        ')}
      </section>`;
}

// A real weekly letter (made by the same code that writes the emails) for a fictional person,
// so the offer shows what arrives instead of describing it.
function weeklyExample(example) {
    const days = example.days.map((day) => `<li><span class="when">${esc(day.label)}</span> ${esc(day.text)}</li>`).join('');
    return `
        <article class="example">
          <p class="example-label">${esc(example.title)}</p>
          <p class="hint">${esc(example.note)}</p>
          <p>${esc(example.lead)}</p>
          <ul class="example-days">${days}</ul>
          <h3>${esc(example.practiceTitle)}</h3>
          <p>${esc(example.practice)}</p>
        </article>`;
}

function upsell(ui, example) {
    return `
      <section id="upsell" class="card upsell" hidden aria-labelledby="upsell-title">
        <h2 id="upsell-title">${esc(ui.upsellTitle)}</h2>
        <p>${esc(ui.upsellText)}</p>${weeklyExample(example)}
        <p class="hint">${esc(ui.upsellFree)}</p>
        <form id="upsell-form" novalidate>
          <div class="field">
            <label for="up-email">${esc(ui.email)}</label>
            <input id="up-email" type="email" autocomplete="email" required>
          </div>
          <fieldset class="cadence">
            <label class="check"><input type="radio" name="cadence" value="weekly" checked> <span data-price="weekly">${esc(ui.cadenceWeekly)}</span></label>
            <label class="check"><input type="radio" name="cadence" value="biweekly"> <span data-price="biweekly">${esc(ui.cadenceBiweekly)}</span></label>
          </fieldset>
          <label class="check"><input id="up-consent" type="checkbox"> ${esc(ui.consent)}</label>
          <p id="upsell-error" class="error" role="alert" hidden></p>
          <button class="btn" type="submit">${esc(ui.subscribe)}</button>
        </form>
      </section>`;
}

function toolMain(locale, slug, catalog) {
    const page = catalog.pages[slug];
    const ui = catalog.ui;
    const meta = TOOLS[slug];
    const isMatching = meta.tool === 'matching';
    const people = isMatching
        ? personFields('groom', ui.first, ui) + personFields('bride', ui.second, ui)
        : personFields('p1', page.h1, ui);
    return `<main id="main" class="shell tool">
      <h1>${esc(page.h1)}</h1>
      <p class="lead">${esc(page.lead)}</p>
      <form id="tool-form" class="card" novalidate>${people}
        <p id="form-error" class="error" role="alert" hidden></p>
        <button class="btn" type="submit" data-label="${esc(ui.calculate)}" data-busy="${esc(ui.calculating)}">${esc(ui.calculate)}</button>
        <noscript><p class="error">${esc(ui.noscript)}</p></noscript>
      </form>
      <section id="result" class="result" aria-live="polite" tabindex="-1" hidden></section>${isMatching ? '' : upsell(ui, catalog.weeklyExample)}${sections(page)}${faq({ ...page, faqTitle: catalog.ui.faqTitle })}
    </main>`;
}

function hubMain(locale, catalog) {
    const page = catalog.pages.index;
    const cards = page.cards.map((card) => `
        <a class="card tool-card" href="${pagePath(locale, card.slug)}">
          <h2>${esc(card.title)}</h2>
          <p>${esc(card.text)}</p>
        </a>`).join('');
    return `<main id="main" class="shell">
      <h1>${esc(page.h1)}</h1>
      <p class="lead">${esc(page.lead)}</p>
      <div class="cards">${cards}
      </div>${sections(page)}${faq({ ...page, faqTitle: catalog.ui.faqTitle })}
    </main>`;
}

function reportMain(locale, catalog) {
    const page = catalog.pages.report;
    const ui = catalog.ui;
    return `<main id="main" class="shell report">
      <h1>${esc(page.h1)}</h1>
      <p class="lead">${esc(page.lead)}</p>
      <section id="report" aria-live="polite" tabindex="-1"><p>${esc(ui.reportLoading)}</p></section>
      <section id="manage" class="card manage" hidden>
        <button id="manage-btn" class="btn" type="button" data-label="${esc(ui.manage)}" data-busy="${esc(ui.managing)}">${esc(ui.manage)}</button>
        <button id="erase-btn" class="btn ghost" type="button">${esc(ui.erase)}</button>
        <p id="manage-message" class="hint" role="status" hidden></p>
      </section>
    </main>`;
}

function thanksMain(locale, catalog) {
    const page = catalog.pages.thanks;
    return `<main id="main" class="shell">
      <h1>${esc(page.h1)}</h1>
      <p class="lead">${esc(page.lead)}</p>
      <p><a class="btn" href="${pagePath(locale, 'index')}">${esc(catalog.site.navHub)}</a></p>
    </main>`;
}

function render(locale, slug, catalog) {
    const tool = TOOLS[slug]?.tool || (slug === 'report' ? 'report' : slug === 'thanks' ? 'thanks' : 'hub');
    let main;
    if (TOOLS[slug]) main = toolMain(locale, slug, catalog);
    else if (slug === 'report') main = reportMain(locale, catalog);
    else if (slug === 'thanks') main = thanksMain(locale, catalog);
    else main = hubMain(locale, catalog);

    const needsScript = tool !== 'hub' && tool !== 'thanks';
    const script = needsScript
        ? `\n  <script type="application/json" id="kundli-i18n">${JSON.stringify(catalog.ui).replace(/</g, '\\u003c')}</script>\n  <script src="/js/${tool === 'report' ? 'kundli-report' : 'kundli-tool'}.js?v=${ASSET_VERSION}" defer></script>`
        : '';
    return `${head(locale, slug, catalog)}
<body data-tool="${tool}" data-locale="${locale}">
  <a class="skip" href="#main">${esc(catalog.site.skip)}</a>
  ${header(locale, slug, catalog)}
  ${main}
  ${footer(locale, catalog)}${script}
</body>
</html>
`;
}

async function main() {
    const check = process.argv.includes('--check');
    const catalogs = Object.fromEntries(await Promise.all(
        LOCALES.map(async (locale) => [locale, JSON.parse(await readFile(path.join(srcRoot, `${locale}.json`), 'utf8'))]),
    ));
    const outputs = new Map();
    for (const locale of LOCALES) {
        for (const slug of ALL_PAGES) {
            outputs.set(outFile(locale, slug), render(locale, slug, catalogs[locale]));
        }
    }

    if (check) {
        const drifted = [];
        for (const [file, html] of outputs) {
            let current = null;
            try { current = await readFile(file, 'utf8'); } catch { /* missing */ }
            if (current !== html) drifted.push(path.relative(frontendRoot, file));
        }
        if (drifted.length) {
            console.error(`[kundli-pages] out of date, run "npm --prefix app run build:kundli":\n  ${drifted.join('\n  ')}`);
            process.exit(1);
        }
        console.log(`[kundli-pages] ${outputs.size} files up to date`);
        return;
    }

    for (const [file, html] of outputs) {
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, html, 'utf8');
    }
    console.log(`[kundli-pages] wrote ${outputs.size} files`);
}

main().catch((error) => { console.error(error); process.exit(1); });

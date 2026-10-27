#!/usr/bin/env node
/**
 * Build the public moon pages from app/frontend/moon-src/<locale>.json.
 *
 * Output: app/frontend/moon/{index,letter}.html (English) and app/frontend/moon/<locale>/...
 * for pl, de, fr, it, es, pt. They are build output: edit the catalogs (copy), the lunation
 * table (app/scripts/build_moon_lunations.py) or this file (structure) and rebuild. `--check`
 * rebuilds in memory and fails on any difference, which is what CI runs.
 *
 * Sign and phase names come from the letter catalogs in app/services/moon_journal_content, so
 * the page and the email never name a sign differently. Dates are formatted here from those
 * catalogs rather than with Intl date styles, whose output changes between Node versions.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const frontendRoot = path.join(appRoot, 'frontend');
const srcRoot = path.join(frontendRoot, 'moon-src');
const letterRoot = path.join(appRoot, 'services', 'moon_journal_content');
const outRoot = path.join(frontendRoot, 'moon');
const ORIGIN = 'https://www.steliara.com';
const LOCALES = ['en', 'pl', 'de', 'fr', 'it', 'es', 'pt'];
const PAGES = ['index', 'letter'];
const ASSET_VERSION = '1';

const TIMEZONES = [
    'Europe/Warsaw', 'Europe/Berlin', 'Europe/Vienna', 'Europe/Zurich', 'Europe/Paris', 'Europe/Brussels',
    'Europe/Rome', 'Europe/Madrid', 'Europe/Lisbon', 'Europe/London', 'Europe/Dublin', 'Europe/Kyiv',
    'America/Sao_Paulo', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Toronto', 'America/Mexico_City', 'America/Argentina/Buenos_Aires', 'Australia/Sydney', 'UTC',
];

const esc = (value) => String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function pagePath(locale, slug = 'index') {
    const base = locale === 'en' ? '/moon' : `/moon/${locale}`;
    return slug === 'index' ? base : `${base}/${slug}`;
}

function outFile(locale, slug) {
    return path.join(locale === 'en' ? outRoot : path.join(outRoot, locale), `${slug}.html`);
}

function wallClock(utcIso, timeZone) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
    }).formatToParts(new Date(utcIso)).map((part) => [part.type, part.value]));
    return { y: +parts.year, m: +parts.month, d: +parts.day, h: +parts.hour, min: +parts.minute };
}

function formatDate(utcIso, catalog) {
    const t = wallClock(utcIso, catalog.tableTimezone);
    const pad = (n) => String(n).padStart(2, '0');
    const values = {
        d: t.d, y: t.y, month: catalog.months[t.m - 1], hh: pad(t.h), mm: pad(t.min),
        h12: t.h % 12 || 12, ampm: t.h < 12 ? 'AM' : 'PM',
    };
    return catalog.tableDateFormat.replace(/\{(\w+)\}/g, (_, key) => String(values[key]));
}

function jsonLd(locale, catalog) {
    const page = catalog.pages.index;
    const blocks = [
        {
            '@context': 'https://schema.org', '@type': 'WebApplication', name: page.h1, url: `${ORIGIN}${pagePath(locale)}`,
            description: page.description, applicationCategory: 'LifestyleApplication', operatingSystem: 'Web',
            inLanguage: catalog.hreflang, isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        },
        {
            '@context': 'https://schema.org', '@type': 'FAQPage',
            mainEntity: page.faq.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
        },
    ];
    return blocks.map((block) => `    <script type="application/ld+json">${JSON.stringify(block)}</script>`).join('\n');
}

function head(locale, slug, catalog, catalogs) {
    const page = catalog.pages[slug];
    const indexable = slug === 'index';
    const url = `${ORIGIN}${pagePath(locale, slug)}`;
    const alternates = indexable
        ? LOCALES.map((l) => `    <link rel="alternate" hreflang="${catalogs[l].hreflang}" href="${ORIGIN}${pagePath(l)}">`).join('\n')
          + `\n    <link rel="alternate" hreflang="x-default" href="${ORIGIN}${pagePath('en')}">\n`
        : '';
    return `<!DOCTYPE html>
<html lang="${catalog.lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
    <link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png">
    <title>${esc(page.title)}</title>
    <meta name="description" content="${esc(page.description)}">
${indexable ? '' : '    <meta name="robots" content="noindex, nofollow">\n    <meta name="referrer" content="no-referrer">\n'}    <link rel="canonical" href="${url}">
${alternates}    <meta property="og:title" content="${esc(page.title)}">
    <meta property="og:description" content="${esc(page.description)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${url}">
    <meta property="og:locale" content="${catalog.ogLocale}">
    <meta property="og:image" content="${ORIGIN}/assets/brand/og-image.png">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="stylesheet" href="/css/kundli.css?v=${ASSET_VERSION}">
    <link rel="stylesheet" href="/css/moon.css?v=${ASSET_VERSION}">
${indexable ? jsonLd(locale, catalog) + '\n' : ''}</head>`;
}

function header(locale, slug, catalog, catalogs) {
    const langs = slug === 'index'
        ? `<div class="language-picker">
        <label class="language-label" for="language-select">${esc(catalog.site.langLabel)}</label>
        <select id="language-select" aria-label="${esc(catalog.site.langLabel)}">${LOCALES.map((l) => (
            `<option value="${pagePath(l)}"${l === locale ? ' selected' : ''}>${esc(catalogs[l].languageName)}</option>`
        )).join('')}</select>
      </div>`
        : '';
    return `<header class="site-header">
    <div class="shell bar">
      <a class="brand" href="${pagePath(locale)}">${esc(catalog.site.brand)}</a>
      ${langs}
    </div>
  </header>`;
}

function footer(catalog) {
    const site = catalog.site;
    return `<footer class="site-footer">
    <div class="shell">
      <p class="disclaimer">${esc(site.footerNote)}</p>
      <p class="links"><a href="/">${esc(site.footerAstrologers)}</a> · <a href="/terms.html">${esc(site.footerTerms)}</a></p>
    </div>
  </footer>`;
}

function birthFields(catalog) {
    const ui = catalog.ui;
    const tzOptions = TIMEZONES.map((tz) => `<option value="${tz}"${tz === catalog.tableTimezone ? ' selected' : ''}>${tz}</option>`).join('');
    return `
        <fieldset class="person">
          <legend>${esc(ui.legend)}</legend>
          <div class="field">
            <label for="birth-date">${esc(ui.date)}</label>
            <input id="birth-date" name="date" type="date" min="1900-01-01" max="2100-12-31" required>
          </div>
          <div class="field">
            <label for="birth-time">${esc(ui.time)}</label>
            <input id="birth-time" name="time" type="time">
            <label class="check"><input id="birth-unknown" name="unknown" type="checkbox"> ${esc(ui.timeUnknown)}</label>
          </div>
          <div class="field place">
            <label for="birth-place">${esc(ui.place)}</label>
            <input id="birth-place" name="place" type="text" autocomplete="off" role="combobox"
                   aria-autocomplete="list" aria-expanded="false" aria-controls="birth-places" aria-describedby="birth-place-hint">
            <ul id="birth-places" class="suggestions" role="listbox" hidden></ul>
            <p id="birth-place-hint" class="hint">${esc(ui.placeHint)}</p>
          </div>
          <div class="field">
            <label for="birth-tz">${esc(ui.timezone)}</label>
            <select id="birth-tz" name="timezone">${tzOptions}</select>
            <p class="hint" id="birth-tz-hint" aria-live="polite"></p>
          </div>
        </fieldset>`;
}

function lunationTable(catalog, letters, lunations) {
    const ui = catalog.ui;
    const rows = lunations.map((lun) => `
            <tr data-utc="${lun.utc}">
              <td><button class="lunation-pick" type="button">${esc(formatDate(lun.utc, catalog))}</button><span class="badge" hidden> · ${esc(ui.nextBadge)}</span></td>
              <td><span class="phase phase-${lun.kind === 'new_moon' ? 'new' : 'full'}" aria-hidden="true"></span>${esc(letters.kinds[lun.kind])}</td>
              <td>${esc(letters.signs[lun.sign])} ${lun.degree}°</td>
            </tr>`).join('');
    return `
      <section class="lunations reveal-on-scroll" aria-labelledby="lunations-title">
        <h2 id="lunations-title">${esc(catalog.pages.index.tableTitle)}</h2>
        <p class="hint">${esc(catalog.pages.index.tableNote)}</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th scope="col">${esc(ui.tableDate)}</th><th scope="col">${esc(ui.tablePhase)}</th><th scope="col">${esc(ui.tableSign)}</th></tr></thead>
            <tbody>${rows}
            </tbody>
          </table>
        </div>
      </section>`;
}

// The fictional person in the examples (17 May 1990, 14:30, Warsaw) has Virgo rising, so the
// first new moon in the table (Scorpio) falls in house 3 and the next full moon (Gemini) in
// house 10, which is what the paid example says. The free example is built from the real
// letter blocks, so it reads exactly like a letter.
const EXAMPLE_RISING = 5;

function freeExample(catalog, letters, lunations) {
    const lun = lunations.find((l) => l.kind === 'new_moon');
    const house = (lun.sign - EXAMPLE_RISING + 12) % 12 + 1;
    const block = letters.houses[house - 1];
    const headline = letters.headline.replace('{kind}', letters.kinds.new_moon)
        .replace('{sign_in}', letters.signs_in[lun.sign]).replace('{house}', String(house));
    return `
          <article class="example">
            <p class="example-label">${esc(catalog.plans.exampleFreeTitle)}</p>
            <h4><span class="phase phase-new" aria-hidden="true"></span>${esc(headline)}</h4>
            <p class="when">${esc(formatDate(lun.utc, catalog))}</p>
            <p>${esc(block.theme)}</p>
            <ol class="prompts">${[...block.new, letters.universal.new].map((q) => `<li>${esc(q)}</li>`).join('')}</ol>
            <p class="affirmation"><strong>${esc(catalog.ui.affirmationTitle)}</strong>${esc(block.affirmation)}</p>
          </article>`;
}

function paidExample(catalog) {
    const p = catalog.plans;
    const days = p.calendar.map((day) => `
              <li><span class="when">${esc(day.when)}</span> <strong>${esc(day.what)}</strong>
                <p>${esc(day.text)}</p><p class="question">${esc(day.question)}</p></li>`).join('');
    return `
          <article class="example paid">
            <p class="example-label">${esc(p.examplePaidTitle)}</p>
            <p class="hint">${esc(p.exampleNote)}</p>
            <h4>${esc(p.calendarTitle)}</h4>
            <ul class="calendar">${days}
            </ul>
            <h4>${esc(p.reviewTitle)}</h4>
            ${p.review.map((text) => `<p>${esc(text)}</p>`).join('\n            ')}
          </article>`;
}

function planCards(catalog) {
    const p = catalog.plans;
    const items = (list) => list.map((item) => typeof item === 'string'
        ? `<li>${esc(item)}</li>`
        : `<li><strong>${esc(item.title)}</strong><span>${esc(item.text)}</span></li>`).join('');
    return `
        <div class="plans-grid">
          <article class="plan"><h3>${esc(p.freeTitle)}</h3><p class="plan-intro">${esc(p.freeIntro)}</p><ul>${items(p.freeItems)}</ul><p class="plan-closing">${esc(p.freeClosing)}</p></article>
          <article class="plan paid"><h3>${esc(p.paidTitle)}</h3><p class="price">${esc(catalog.ui.price)}</p><p class="plan-intro">${esc(p.paidIntro)}</p><ul>${items(p.paidItems)}</ul><p class="plan-closing">${esc(p.paidClosing)}</p></article>
        </div>`;
}

function plans(catalog, letters, lunations) {
    const p = catalog.plans;
    return `
      <section class="plans reveal-on-scroll" aria-labelledby="plans-title">
        <h2 id="plans-title">${esc(p.title)}</h2>
        <p>${esc(p.lead)}</p>${planCards(catalog)}
        <div class="examples">${freeExample(catalog, letters, lunations)}${paidExample(catalog)}
        </div>
      </section>`;
}

function linkCard(ui) {
    return `
      <section id="link-card" class="card reveal-on-scroll" aria-labelledby="link-title">
        <h2 id="link-title">${esc(ui.linkTitle)}</h2>
        <p>${esc(ui.linkText)}</p>
        <div class="link-paths">
          <div class="link-path link-new">
            <h3>${esc(ui.linkNewTitle)}</h3>
            <p>${esc(ui.linkNewText)}</p>
            <a class="btn" href="#moon-form">${esc(ui.linkNewButton)}</a>
          </div>
          <div class="link-path link-returning">
            <h3>${esc(ui.linkReturningTitle)}</h3>
            <p>${esc(ui.linkReturningText)}</p>
            <form id="link-form" novalidate>
              <div class="field">
                <label for="link-email">${esc(ui.email)}</label>
                <input id="link-email" type="email" autocomplete="email" required>
              </div>
              <p id="link-error" class="error" role="alert" hidden></p>
              <p id="link-done" class="note" role="status" hidden></p>
              <button class="btn ghost" type="submit">${esc(ui.linkButton)}</button>
            </form>
          </div>
        </div>
      </section>`;
}

function copy(page) {
    const sections = page.sections.map((section) => `
      <section class="copy reveal-on-scroll">
        <h2>${esc(section.h2)}</h2>
        ${section.p.map((p) => `<p>${esc(p)}</p>`).join('\n        ')}
      </section>`).join('');
    const faq = `
      <section class="copy faq reveal-on-scroll">
        <h2>${esc(page.faqTitle)}</h2>
        ${page.faq.map((item) => `<h3>${esc(item.q)}</h3>\n        <p>${esc(item.a)}</p>`).join('\n        ')}
      </section>`;
    return sections + faq;
}

function indexMain(catalog, letters, lunations) {
    const page = catalog.pages.index;
    const ui = catalog.ui;
    return `<main id="main" class="shell tool moon-page">
      <h1>${esc(page.h1)}</h1>
      <p class="lead">${esc(page.lead)}</p>
      <div class="moon-grid">
        <div class="moon-primary">
          <form id="moon-form" class="card" novalidate>${birthFields(catalog)}
            <p id="form-error" class="error" role="alert" hidden></p>
            <button class="btn" type="submit" data-label="${esc(ui.calculate)}" data-busy="${esc(ui.calculating)}">${esc(ui.calculate)}</button>
            <noscript><p class="error">${esc(ui.noscript)}</p></noscript>
          </form>
          <section id="result" class="result" aria-live="polite" tabindex="-1" hidden></section>
          <section id="signup" class="card signup" hidden aria-labelledby="signup-title">
            <h2 id="signup-title">${esc(ui.signupTitle)}</h2>
            <p>${esc(ui.signupText)}</p>
            <form id="signup-form" novalidate>
              <div class="field">
                <label for="signup-email">${esc(ui.email)}</label>
                <input id="signup-email" type="email" autocomplete="email" required>
              </div>
              <label class="check"><input id="signup-consent" type="checkbox"> ${esc(ui.consent)}</label>
              <p id="signup-error" class="error" role="alert" hidden></p>
              <p id="signup-done" class="note" role="status" hidden></p>
              <button class="btn" type="submit">${esc(ui.subscribe)}</button>
            </form>
          </section>
        </div>
        <aside class="moon-rail">
          <section id="moon-highlight" class="moon-highlight" aria-labelledby="moon-highlight-title" aria-live="polite" hidden>
            <div class="moon-highlight-orbit" aria-hidden="true"><span class="moon-highlight-disc"></span></div>
            <div class="moon-highlight-copy"></div>
          </section>
${lunationTable(catalog, letters, lunations)}
        </aside>
      </div>${plans(catalog, letters, lunations)}${linkCard(ui)}${copy(page)}
    </main>`;
}

function letterMain(locale, catalog) {
    const page = catalog.pages.letter;
    const ui = catalog.ui;
    return `<main id="main" class="shell letter">
      <h1>${esc(page.h1)}</h1>
      <p class="lead">${esc(page.lead)}</p>
      <p id="letter-status" class="note" role="status" hidden></p>
      <p class="hint">${esc(ui.linkPrivacy)}</p>
      <section id="letter" aria-live="polite" tabindex="-1"><p>${esc(ui.loading)}</p></section>
      <section id="history" class="card" hidden aria-labelledby="history-title">
        <h2 id="history-title">${esc(ui.historyTitle)}</h2>
        <div id="history-list"><p class="hint">${esc(ui.historyEmpty)}</p></div>
      </section>
      <section id="journal-offer" class="card offer" hidden aria-labelledby="offer-title">
        <h2 id="offer-title">${esc(ui.fakeTitle)}</h2>
        <p>${esc(catalog.plans.lead)}</p>${planCards(catalog)}
        <div class="examples">${paidExample(catalog)}
        </div>
        <p>${esc(ui.fakeText)}</p>
        <p class="hint">${esc(ui.fakePrice.replace('{price}', ui.price))}</p>
        <button id="offer-btn" class="btn" type="button">${esc(ui.fakeButton)}</button>
        <p id="offer-thanks" class="note" role="status" hidden>${esc(ui.fakeThanks)}</p>
      </section>
      <section id="manage" class="card manage" hidden aria-labelledby="manage-title">
        <h2 id="manage-title">${esc(ui.manageTitle)}</h2>
        <div class="actions">
          <button id="unsubscribe-btn" class="btn ghost" type="button">${esc(ui.unsubscribe)}</button>
          <button id="erase-btn" class="btn ghost" type="button">${esc(ui.erase)}</button>
        </div>
        <p id="manage-message" class="hint" role="status" hidden></p>
      </section>
      <p><a href="${pagePath(locale)}">${esc(ui.backToMoon)}</a></p>
    </main>`;
}

function render(locale, slug, catalogs, letters, lunations) {
    const catalog = catalogs[locale];
    const main = slug === 'index' ? indexMain(catalog, letters[locale], lunations) : letterMain(locale, catalog);
    const script = slug === 'index' ? 'moon-tool' : 'moon-letter';
    return `${head(locale, slug, catalog, catalogs)}
<body data-page="${slug}" data-locale="${locale}">
  <a class="skip" href="#main">${esc(catalog.site.skip)}</a>
  ${header(locale, slug, catalog, catalogs)}
  ${main}
  ${footer(catalog)}
  <script type="application/json" id="moon-i18n">${JSON.stringify(catalog.ui).replace(/</g, '\\u003c')}</script>
  <script src="/js/${script}.js?v=${ASSET_VERSION}" defer></script>
</body>
</html>
`;
}

async function readJson(file) {
    return JSON.parse(await readFile(file, 'utf8'));
}

async function main() {
    const check = process.argv.includes('--check');
    const catalogs = {};
    const letters = {};
    for (const locale of LOCALES) {
        catalogs[locale] = await readJson(path.join(srcRoot, `${locale}.json`));
        letters[locale] = await readJson(path.join(letterRoot, `${locale}.json`));
    }
    const { lunations } = await readJson(path.join(srcRoot, 'lunations.json'));
    const outputs = new Map();
    for (const locale of LOCALES) {
        for (const slug of PAGES) outputs.set(outFile(locale, slug), render(locale, slug, catalogs, letters, lunations));
    }

    if (check) {
        const drifted = [];
        for (const [file, html] of outputs) {
            let current = null;
            try { current = await readFile(file, 'utf8'); } catch { /* missing */ }
            if (current !== html) drifted.push(path.relative(frontendRoot, file));
        }
        if (drifted.length) {
            console.error(`[moon-pages] out of date, run "npm --prefix app run build:moon":\n  ${drifted.join('\n  ')}`);
            process.exit(1);
        }
        console.log(`[moon-pages] ${outputs.size} files up to date`);
        return;
    }

    for (const [file, html] of outputs) {
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, html, 'utf8');
    }
    console.log(`[moon-pages] wrote ${outputs.size} files`);
}

main().catch((error) => { console.error(error); process.exit(1); });

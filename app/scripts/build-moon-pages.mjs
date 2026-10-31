#!/usr/bin/env node
/**
 * Build the public moon pages from app/frontend/moon-src/<locale>.json.
 *
 * Output: app/frontend/moon/{index,letter}.html (English) and app/frontend/moon/<locale>/...
 * for pl, de, fr, it, es, pt, plus one page per lunation until mid-2027 and lunation-pages.json
 * (the server's list of those pages). They are build output: edit the catalogs (copy), the
 * lunation table (app/scripts/build_moon_lunations.py) or this file (structure) and rebuild.
 * `--check` rebuilds in memory and fails on any difference, which is what CI runs.
 *
 * Sign and phase names come from the letter catalogs in app/services/moon_journal_content, so
 * the page and the email never name a sign differently. Dates are formatted here from those
 * catalogs rather than with Intl date styles, whose output changes between Node versions.
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
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
const ASSET_VERSION = '3';

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

function fill(template, values) {
    return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key]));
}

function clockValues(utcIso, catalog, timeZone = catalog.tableTimezone) {
    const t = wallClock(utcIso, timeZone);
    const pad = (n) => String(n).padStart(2, '0');
    return {
        d: t.d, y: t.y, month: catalog.months[t.m - 1], hh: pad(t.h), mm: pad(t.min),
        h12: t.h % 12 || 12, ampm: t.h < 12 ? 'AM' : 'PM',
    };
}

function formatDate(utcIso, catalog, timeZone) {
    return fill(catalog.tableDateFormat, clockValues(utcIso, catalog, timeZone));
}

const dayLabel = (utcIso, catalog) => fill(catalog.lunationPage.dateFormat, clockValues(utcIso, catalog));
const timeLabel = (utcIso, catalog) => fill(catalog.lunationPage.timeFormat, clockValues(utcIso, catalog));

// Slugs are ASCII so every address is easy to type, share and match in a log.
function slugify(text) {
    return text.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function lunationSlug(lun, catalog) {
    return slugify(`${catalog.lunationPage.slugKinds[lun.kind]} ${dayLabel(lun.utc, catalog)}`);
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

function headHtml(catalog, { title, description, url, indexable, alternates = '', ld = '' }) {
    return `<!DOCTYPE html>
<html lang="${catalog.lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
    <link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
${indexable ? '' : '    <meta name="robots" content="noindex, nofollow">\n    <meta name="referrer" content="no-referrer">\n'}    <link rel="canonical" href="${url}">
${alternates}    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${url}">
    <meta property="og:locale" content="${catalog.ogLocale}">
    <meta property="og:image" content="${ORIGIN}/assets/brand/og-image.png">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="stylesheet" href="/css/kundli.css?v=${ASSET_VERSION}">
    <link rel="stylesheet" href="/css/moon.css?v=${ASSET_VERSION}">
${ld ? ld + '\n' : ''}</head>`;
}

function head(locale, slug, catalog, catalogs) {
    const page = catalog.pages[slug];
    const indexable = slug === 'index';
    const alternates = indexable
        ? LOCALES.map((l) => `    <link rel="alternate" hreflang="${catalogs[l].hreflang}" href="${ORIGIN}${pagePath(l)}">`).join('\n')
          + `\n    <link rel="alternate" hreflang="x-default" href="${ORIGIN}${pagePath('en')}">\n`
        : '';
    return headHtml(catalog, {
        title: page.title, description: page.description, url: `${ORIGIN}${pagePath(locale, slug)}`,
        indexable, alternates, ld: indexable ? jsonLd(locale, catalog) : '',
    });
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

// The moon pages stand apart from the pages for professional astrologers: no link to them, only
// to the terms and, in English, to the sister free tools (kundli).
function footer(catalog) {
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

function lunationTable(catalog, letters, lunations, links) {
    const ui = catalog.ui;
    const more = (lun) => {
        const href = links.get(lun.utc);
        if (!href) return '';
        const aria = fill(catalog.lunationPage.detailsAria, { kind: letters.kinds[lun.kind], date: dayLabel(lun.utc, catalog) });
        return `<a class="lunation-more" href="${href}" aria-label="${esc(aria)}">${esc(catalog.lunationPage.details)}</a>`;
    };
    const rows = lunations.map((lun) => `
            <tr data-utc="${lun.utc}">
              <td><button class="lunation-pick" type="button">${esc(formatDate(lun.utc, catalog))}</button><span class="badge" hidden> · ${esc(ui.nextBadge)}</span>${more(lun)}</td>
              <td><span class="phase phase-${lun.kind === 'new_moon' ? 'new' : 'full'}" aria-hidden="true"></span>${esc(letters.kinds[lun.kind])}</td>
              <td>${esc(letters.signs[lun.sign])} ${lun.degree}°</td>
            </tr>`).join('');
    return `
      <section class="lunations reveal-on-scroll" aria-labelledby="lunations-title">
        <h2 id="lunations-title">${esc(catalog.pages.index.tableTitle)}</h2>
        <p class="hint" id="lunations-note">${esc(catalog.pages.index.tableNote)}</p>
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
    const headline = fill(letters.headline, {
        kind: letters.kinds.new_moon, sign_in: letters.signs_in[lun.sign], area: block.area, house,
    });
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

function plans(catalog) {
    const p = catalog.plans;
    return `
      <section class="plans reveal-on-scroll" aria-labelledby="plans-title">
        <h2 id="plans-title">${esc(p.title)}</h2>
        <p>${esc(p.lead)}</p>${planCards(catalog)}
        <div class="examples single">${paidExample(catalog)}
        </div>
      </section>`;
}

// What arrives, shown before what it costs: a real letter right after the short explanation.
function letterExample(catalog, letters, lunations) {
    return `
      <section class="letter-example reveal-on-scroll" aria-labelledby="example-title">
        <h2 id="example-title">${esc(catalog.plans.exampleHeading)}</h2>${freeExample(catalog, letters, lunations)}
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
    return page.sections.map((section) => `
      <section class="copy reveal-on-scroll">
        <h2>${esc(section.h2)}</h2>
        ${section.p.map((p) => `<p>${esc(p)}</p>`).join('\n        ')}
      </section>`).join('');
}

function faqSection(page) {
    return `
      <section class="copy faq reveal-on-scroll">
        <h2>${esc(page.faqTitle)}</h2>
        ${page.faq.map((item) => `<h3>${esc(item.q)}</h3>\n        <p>${esc(item.a)}</p>`).join('\n        ')}
      </section>`;
}

function indexMain(catalog, letters, lunations, links) {
    const page = catalog.pages.index;
    const ui = catalog.ui;
    return `<main id="main" class="shell tool moon-page">
      <h1>${esc(page.h1)}</h1>
      <p class="lead">${esc(page.lead)}</p>
      <p class="trust">${esc(page.trust)}</p>
      <div class="moon-grid">
        <section id="moon-highlight" class="moon-highlight" aria-labelledby="moon-highlight-title" aria-live="polite" hidden>
          <div class="moon-highlight-orbit" aria-hidden="true"><span class="moon-highlight-disc"></span></div>
          <div class="moon-highlight-copy"></div>
        </section>
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
${lunationTable(catalog, letters, lunations, links)}
        </aside>
      </div>${copy(page)}${letterExample(catalog, letters, lunations)}${plans(catalog)}${linkCard(ui)}${faqSection(page)}
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

// One page per lunation until the middle of 2027 (exclusive bound). Each language has its own
// address (the date is part of what people search for) and all seven form one hreflang set.
const DATE_PAGES_BEFORE = '2027-07-01';

function datePagePlan(catalogs, lunations) {
    const range = lunations.filter((lun) => lun.utc < DATE_PAGES_BEFORE);
    return range.map((lun) => ({
        lun,
        slugs: Object.fromEntries(LOCALES.map((l) => [l, lunationSlug(lun, catalogs[l])])),
    }));
}

function lunationLinks(locale, plan) {
    return new Map(plan.map((entry) => [entry.lun.utc, pagePath(locale, entry.slugs[locale])]));
}

function lunationJsonLd(locale, catalog, entry, texts) {
    const url = (slug) => `${ORIGIN}${pagePath(locale, slug)}`;
    const blocks = [
        {
            '@context': 'https://schema.org', '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: catalog.lunationPage.crumbHub, item: `${ORIGIN}${pagePath(locale)}` },
                { '@type': 'ListItem', position: 2, name: texts.name, item: url(entry.slugs[locale]) },
            ],
        },
        {
            '@context': 'https://schema.org', '@type': 'FAQPage',
            mainEntity: texts.faq.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
        },
    ];
    return blocks.map((block) => `    <script type="application/ld+json">${JSON.stringify(block)}</script>`).join('\n');
}

function lunationTexts(locale, catalog, letters, entry) {
    const lp = catalog.lunationPage;
    const lun = entry.lun;
    const kind = letters.kinds[lun.kind];
    const values = {
        kind, date: dayLabel(lun.utc, catalog), time: timeLabel(lun.utc, catalog), tz: lp.tzName,
        utc: formatDate(lun.utc, catalog, 'UTC'), sign: letters.signs[lun.sign], sign_in: letters.signs_in[lun.sign], degree: lun.degree,
    };
    const name = `${kind} ${values.date}`;
    const facts = fill(lp.facts, values);
    return {
        values, name, facts,
        title: fill(lp.title, values),
        description: `${facts} ${lp.descriptionTail}`,
        h1: fill(lp.h1, values),
        lead: `${facts} ${lp.moment[lun.kind]} ${lp.leadClosing}`,
        faq: lp.faq.map((item) => ({ q: fill(item.q, values), a: fill(item.a, values) })),
    };
}

function lunationMain(locale, catalog, letters, plan, index, catalogs) {
    const lp = catalog.lunationPage;
    const entry = plan[index];
    const lun = entry.lun;
    const texts = lunationTexts(locale, catalog, letters, entry);
    const v = texts.values;
    const href = (e) => pagePath(locale, e.slugs[locale]);
    const label = (e) => `${letters.kinds[e.lun.kind]} ${dayLabel(e.lun.utc, catalog)}`;
    const dot = (e) => `<span class="phase phase-${e.lun.kind === 'new_moon' ? 'new' : 'full'}" aria-hidden="true"></span>`;

    const rows = letters.signs.map((sign, rising) => {
        const house = (lun.sign - rising + 12) % 12 + 1;
        return `
              <tr><th scope="row">${esc(sign)}</th><td data-label="${esc(lp.housesHeaders[1])}">${house}</td><td>${esc(letters.houses[house - 1].area)}</td></tr>`;
    }).join('');

    const prev = plan[index - 1];
    const next = plan[index + 1];
    const stepper = [
        prev ? `<a class="step prev" rel="prev" href="${href(prev)}"><span class="step-dir">${esc(lp.prev)}</span><span>${dot(prev)}${esc(label(prev))}</span></a>` : '',
        next ? `<a class="step next" rel="next" href="${href(next)}"><span class="step-dir">${esc(lp.next)}</span><span>${dot(next)}${esc(label(next))}</span></a>` : '',
    ].join('');

    const first = plan[0].lun;
    const last = plan[plan.length - 1].lun;
    const span = (l) => fill(lp.monthYear, clockValues(l.utc, catalog));
    const list = plan.map((e, i) => (i === index
        ? `<li class="current">${dot(e)}<span aria-current="page">${esc(label(e))}</span></li>`
        : `<li>${dot(e)}<a href="${href(e)}">${esc(label(e))}</a></li>`)).join('\n          ');

    const faqIndex = lun.kind === 'new_moon' ? 2 : 3;
    const writeFaq = catalog.pages.index.faq[faqIndex];
    const short = lun.kind === 'new_moon' ? 'new' : 'full';
    const theme = lp.signs[lun.sign];
    const questions = [...theme[short], letters.universal[short]];
    const langs = LOCALES.map((l) => (l === locale
        ? `<li><span aria-current="page">${esc(catalogs[l].languageName)}</span></li>`
        : `<li><a href="${pagePath(l, entry.slugs[l])}" hreflang="${catalogs[l].hreflang}" lang="${l}">${esc(catalogs[l].languageName)}</a></li>`)).join('');

    return `<main id="main" class="shell lunation-page">
      <nav class="crumbs" aria-label="${esc(lp.crumbHub)}"><a href="${pagePath(locale)}">${esc(lp.crumbHub)}</a> <span aria-hidden="true">›</span> <span aria-current="page">${esc(texts.name)}</span></nav>
      <h1>${esc(texts.h1)}</h1>
      <p class="lead">${esc(texts.lead)}</p>
      <section class="card facts" aria-labelledby="facts-title">
        <h2 id="facts-title">${esc(lp.factsTitle)}</h2>
        <dl class="facts-list">
          <div><dt>${esc(lp.factDate)}</dt><dd>${esc(v.date)}</dd></div>
          <div><dt>${esc(fill(lp.factLocal, v))}</dt><dd>${esc(v.time)}</dd></div>
          <div><dt>${esc(lp.factUtc)}</dt><dd>${esc(v.utc)}</dd></div>
          <div><dt>${esc(lp.factSign)}</dt><dd>${esc(`${v.sign} ${v.degree}°`)}</dd></div>
        </dl>
      </section>
      <section class="card theme" aria-labelledby="theme-title">
        <h2 id="theme-title">${esc(fill(lp.aboutTitle, { sign: v.sign }))}</h2>
        <p>${esc(theme.about)}</p>
      </section>
      <section class="card houses" aria-labelledby="houses-title">
        <h2 id="houses-title">${esc(lp.housesTitle)}</h2>
        <p>${esc(lp.housesLead)}</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th scope="col">${esc(lp.housesHeaders[0])}</th><th scope="col">${esc(lp.housesHeaders[1])}</th><th scope="col">${esc(lp.housesHeaders[2])}</th></tr></thead>
            <tbody>${rows}
            </tbody>
          </table>
        </div>
      </section>
      <section class="card write" aria-labelledby="write-title">
        <h2 id="write-title">${esc(lp.writeTitle)}</h2>
        <p>${esc(writeFaq.a)}</p>
        <p class="hint">${esc(lp.writeLabel)}</p>
        <ol class="prompts">${questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ol>
      </section>
      <section class="card cta" aria-labelledby="cta-title">
        <h2 id="cta-title">${esc(lp.ctaTitle)}</h2>
        <p>${esc(lp.ctaText)}</p>
        <a class="btn" href="${pagePath(locale)}#moon-form">${esc(catalog.ui.calculate)}</a>
      </section>
      <section class="copy faq" aria-labelledby="faq-title">
        <h2 id="faq-title">${esc(catalog.pages.index.faqTitle)}</h2>
        ${texts.faq.map((item) => `<h3>${esc(item.q)}</h3>\n        <p>${esc(item.a)}</p>`).join('\n        ')}
      </section>
      <nav class="steps" aria-label="${esc(lp.crumbHub)}">${stepper}</nav>
      <section class="more" aria-labelledby="more-title">
        <h2 id="more-title">${esc(fill(lp.moreTitle, { from: span(first), to: span(last) }))}</h2>
        <ul class="lunation-list">
          ${list}
        </ul>
      </section>
      <nav class="lang-links" aria-label="${esc(lp.languagesLabel)}">
        <h2>${esc(lp.languagesLabel)}</h2>
        <ul>${langs}</ul>
      </nav>
    </main>`;
}

function renderLunation(locale, entry, index, plan, ctx) {
    const { catalogs, letters } = ctx;
    const catalog = catalogs[locale];
    const texts = lunationTexts(locale, catalog, letters[locale], entry);
    const alternates = LOCALES.map((l) => `    <link rel="alternate" hreflang="${catalogs[l].hreflang}" href="${ORIGIN}${pagePath(l, entry.slugs[l])}">`).join('\n')
        + `\n    <link rel="alternate" hreflang="x-default" href="${ORIGIN}${pagePath('en', entry.slugs.en)}">\n`;
    const html = headHtml(catalog, {
        title: texts.title, description: texts.description, url: `${ORIGIN}${pagePath(locale, entry.slugs[locale])}`,
        indexable: true, alternates, ld: lunationJsonLd(locale, catalog, entry, texts),
    });
    return `${html}
<body data-page="lunation" data-locale="${locale}">
  <a class="skip" href="#main">${esc(catalog.site.skip)}</a>
  ${header(locale, 'lunation', catalog, catalogs)}
  ${lunationMain(locale, catalog, letters[locale], plan, index, catalogs)}
  ${footer(catalog)}
</body>
</html>
`;
}

function i18n(catalog) {
    return {
        ...catalog.ui, months: catalog.months, tableDateFormat: catalog.tableDateFormat,
        intl: catalog.intl, tableTimezone: catalog.tableTimezone,
    };
}

function render(locale, slug, catalogs, letters, lunations, links) {
    const catalog = catalogs[locale];
    const main = slug === 'index' ? indexMain(catalog, letters[locale], lunations, links) : letterMain(locale, catalog);
    const script = slug === 'index' ? 'moon-tool' : 'moon-letter';
    return `${head(locale, slug, catalog, catalogs)}
<body data-page="${slug}" data-locale="${locale}">
  <a class="skip" href="#main">${esc(catalog.site.skip)}</a>
  ${header(locale, slug, catalog, catalogs)}
  ${main}
  ${footer(catalog)}
  <script type="application/json" id="moon-i18n">${JSON.stringify(i18n(catalog)).replace(/</g, '\\u003c')}</script>
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
    const plan = datePagePlan(catalogs, lunations);
    const outputs = new Map();
    for (const locale of LOCALES) {
        const links = lunationLinks(locale, plan);
        for (const slug of PAGES) outputs.set(outFile(locale, slug), render(locale, slug, catalogs, letters, lunations, links));
        plan.forEach((entry, index) => {
            outputs.set(outFile(locale, entry.slugs[locale]), renderLunation(locale, entry, index, plan, { catalogs, letters }));
        });
    }
    // The server reads this to route, to list the pages in the sitemap and to pair the languages.
    const manifest = {
        before: DATE_PAGES_BEFORE,
        pages: plan.map((entry) => ({
            utc: entry.lun.utc, kind: entry.lun.kind,
            paths: Object.fromEntries(LOCALES.map((l) => [l, pagePath(l, entry.slugs[l])])),
        })),
    };
    outputs.set(path.join(outRoot, 'lunation-pages.json'), `${JSON.stringify(manifest, null, 1)}\n`);

    // Pages that are no longer generated (a shorter range, a renamed slug) must not linger.
    const stale = [];
    for (const dir of [outRoot, ...LOCALES.filter((l) => l !== 'en').map((l) => path.join(outRoot, l))]) {
        for (const name of await readdir(dir).catch(() => [])) {
            const file = path.join(dir, name);
            if (/\.(html|json)$/.test(name) && !outputs.has(file)) stale.push(file);
        }
    }

    if (check) {
        const drifted = [];
        for (const [file, html] of outputs) {
            let current = null;
            try { current = await readFile(file, 'utf8'); } catch { /* missing */ }
            if (current !== html) drifted.push(path.relative(frontendRoot, file));
        }
        drifted.push(...stale.map((file) => `${path.relative(frontendRoot, file)} (stale)`));
        if (drifted.length) {
            console.error(`[moon-pages] out of date, run "npm --prefix app run build:moon":\n  ${drifted.join('\n  ')}`);
            process.exit(1);
        }
        console.log(`[moon-pages] ${outputs.size} files up to date`);
        return;
    }

    for (const file of stale) await rm(file);
    for (const [file, html] of outputs) {
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, html, 'utf8');
    }
    console.log(`[moon-pages] wrote ${outputs.size} files`);
}

main().catch((error) => { console.error(error); process.exit(1); });

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const frontendDir = path.join(__dirname, '..', 'frontend');
const pages = {
    'clients.html': null,
    'calendar.html': 'calendar-back',
    'account-settings.html': 'account-settings-back',
    'client-profile.html': 'profile-back',
    'forecast-new.html': 'forecastNewBackBtn',
    'natal-full.html': 'natalFullBackBtn',
    'forecast-tables.html': 'forecastBackBtn',
    'forecast-timeline.html': 'forecastBackBtn',
};

function read(page) {
    return fs.readFileSync(path.join(frontendDir, page), 'utf8');
}

test('authenticated work pages use app-nav without a standalone locale switcher', () => {
    for (const page of Object.keys(pages)) {
        const html = read(page);
        const entry = fs.readFileSync(path.join(frontendDir, 'entries', page.replace('.html', '.entry.js')), 'utf8');
        assert.match(html, /css\/app-nav\.css\?v=/, `${page} must load app-nav styles`);
        assert.match(html, /js\/app-nav\.js\?v=/, `${page} must load app-nav behavior`);
        assert.doesNotMatch(html, /locale-switcher/, `${page} must not load the standalone language switcher`);
        assert.doesNotMatch(entry, /locale-switcher/, `${page} bundle must not include the standalone language switcher`);
    }
});

test('every work page embeds the burger, while Practice alone has no back control', () => {
    const practice = read('clients.html');
    assert.equal((practice.match(/<span[^>]+data-app-nav-slot[^>]*>/g) || []).length, 1);
    assert.doesNotMatch(practice, /class="[^"]*\bclients-back\b/);

    for (const [page, backHook] of Object.entries(pages)) {
        const html = read(page);
        assert.equal((html.match(/<span[^>]+data-app-nav-slot[^>]*>/g) || []).length, 1, `${page} must host one embedded burger`);
        if (!backHook) continue;
        assert.ok(html.includes(backHook), `${page} must keep its back control`);
    }
});

test('embedded work-page headers do not duplicate global Home or Settings destinations', () => {
    for (const page of ['forecast-new.html', 'natal-full.html', 'forecast-tables.html', 'forecast-timeline.html']) {
        const html = read(page);
        assert.doesNotMatch(html, /data-i18n="page\.chart\.nav\.home"/, `${page} duplicates Practice from the drawer`);
    }
    assert.doesNotMatch(read('natal-full.html'), /class="natal-full-action-item"[^>]+href="account-settings\.html"/);
});

test('Calendar restores the semantic back link used by its navigation resolver', () => {
    const html = read('calendar.html');
    const js = fs.readFileSync(path.join(frontendDir, 'js', 'calendar.js'), 'utf8');
    assert.match(html, /<a[^>]+href="\/"[^>]+class="[^"]*calendar-back[^"]*"/);
    assert.match(js, /querySelector\('\.calendar-back'\)/);
    assert.match(js, /resolveBackUrl/);
});

test('forecast range pages use the shared segmented kit for view navigation', () => {
    const destinations = ['forecast-new.html', 'forecast-tables.html', 'forecast-timeline.html'];

    for (const page of ['forecast-tables.html', 'forecast-timeline.html']) {
        const html = read(page);
        assert.match(html, /class="forecast-view-tabs ui-segmented"/);
        assert.equal((html.match(/class="forecast-view-tab ui-segmented__item/g) || []).length, 3);
        for (const destination of destinations) {
            assert.match(html, new RegExp(`href="${destination.replace('.', '\\.')}`));
        }
        assert.equal((html.match(/ui-segmented__item is-selected" aria-current="page"/g) || []).length, 1);
    }
});

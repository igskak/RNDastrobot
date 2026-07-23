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

test('migrated work surfaces retain their kit contracts and critical hooks', () => {
    const practice = read('clients.html');
    const calendar = read('calendar.html');
    const call = read('consultation-call.html');
    const join = read('consultation-join.html');

    assert.match(practice, /clients-table ui-table ui-table--rows/);
    assert.match(practice, /clients-dialog-card ui-dialog/);
    assert.match(practice, /empty-state ui-empty-state/);
    assert.match(calendar, /calendar-card ui-card/);
    assert.match(calendar, /clients-dialog-card ui-dialog/);

    for (const [html, hooks] of [[call, ['callShell', 'btnToggleMic', 'btnToggleCam', 'btnEndCall', 'consentModal']], [join, ['joinLobby', 'callShell', 'lobbyBtnMic', 'lobbyBtnCam', 'btnJoinCall', 'btnLeaveCall', 'consentModal']]]) {
        for (const hook of hooks) assert.match(html, new RegExp(`id="${hook}"`));
        assert.match(html, /ui-dialog|ui-card/);
    }
});

test('consultation and profile dialogs use the flat kit without changing realtime hooks', () => {
    const profile = read('client-profile.html');
    const call = read('consultation-call.html');
    const join = read('consultation-join.html');
    const callCss = fs.readFileSync(path.join(frontendDir, 'entries-css', 'consultation-call.entry.css'), 'utf8');
    const joinCss = fs.readFileSync(path.join(frontendDir, 'entries-css', 'consultation-join.entry.css'), 'utf8');

    assert.equal((profile.match(/clients-dialog-backdrop ui-dialog-backdrop/g) || []).length, 4);
    assert.equal((profile.match(/clients-dialog-card[^\"]*ui-dialog/g) || []).length, 4);
    for (const html of [call, join]) {
        assert.match(html, /modal-box ui-dialog/);
        assert.match(html, /call-ended-box ui-card/);
        assert.match(html, /id="consentModal"/);
    }
    assert.match(callCss, /Flat consultation shell/);
    assert.match(callCss, /@media \(max-width: 520px\)/);
    assert.match(joinCss, /\.join-lobby-box[\s\S]*background: var\(--bg-secondary\)/);
});

test('client profile keeps the start-call control and its realtime contract', () => {
    const html = read('client-profile.html');
    const js = fs.readFileSync(path.join(frontendDir, 'js', 'client-profile.js'), 'utf8');

    assert.match(html, /id="startCallBtn"/);
    assert.match(html, /ui-btn ui-btn--primary ui-btn--sm/);
    assert.match(js, /refs\.startCallBtn\s*=\s*document\.getElementById\('startCallBtn'\)/);
    assert.match(js, /refs\.startCallBtn\?\.addEventListener\('click', startCallSession\)/);
    assert.match(js, /call-sessions/, 'the start-call endpoint must remain intact');
});

test('forecast aspect filters keep mobile-sized touch targets', () => {
    const css = fs.readFileSync(path.join(frontendDir, 'css', 'forecast-new.css'), 'utf8');

    assert.match(css, /@media \(max-width: 520px\)[\s\S]*settings-check-grid--compact[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/);
    assert.match(css, /settings-check-option--pill[\s\S]*min-height: 40px/);
    assert.match(css, /@media \(max-width: 340px\)[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
});

test('Pricing CTAs and Terms anchors keep their navigation contracts while using the kit', () => {
    const pricing = read('pricing.html');
    const terms = read('terms.html');

    assert.match(pricing, /id="monthlyBtn" class="active ui-segmented__item"/);
    assert.match(pricing, /href="login\.html"[^>]*page\.pricing\.plans\.practitioner\.cta/);
    assert.match(pricing, /href="login\.html"[^>]*page\.pricing\.plans\.studio\.cta/);
    assert.doesNotMatch(pricing, /linear-gradient/);
    for (const anchor of ['terms', 'privacy', 'refund', 'contact']) {
        assert.match(terms, new RegExp(`href="#${anchor}"`));
        assert.match(terms, new RegExp(`id="${anchor}"`));
    }
    assert.match(terms, /doc ui-card/);
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

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), 'utf8');

test('chart settings expose aspecting-only controls for natal cusps', () => {
    const source = read('frontend/js/forecast-new.js');

    assert.match(source, /normalizedScope === 'natal'/);
    assert.match(source, /data-natal-cusp-aspecting=/);
    assert.match(source, /forecast-new-matrix-fixed-display[^>]*>—</);
    assert.doesNotMatch(source, /data-natal-cusp-display=/);
});

test('orb settings add one compact cusp column with localized hover text', () => {
    const source = read('frontend/js/account-settings.js');
    const ru = JSON.parse(read('frontend/locales/ru.json'));

    assert.match(source, /CUSP_ORB_BODY/);
    assert.equal(ru.page.accountSettings.orbs.cuspsShort, 'Кусп');
    assert.equal(ru.page.accountSettings.orbs.cuspsTitle, 'Куспиды');
});

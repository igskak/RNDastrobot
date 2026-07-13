const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('forecast-new synastry layer can be configured from the right panel header card', () => {
    const html = read('frontend/forecast-new.html');
    const js = read('frontend/js/forecast-new.js');

    assert.match(
        html,
        /<div data-moment-synastry class="hidden">/,
        'moment card should contain a synastry-specific manual data form',
    );
    assert.match(
        html,
        /id="momentSynastryApplyBtn"/,
        'synastry header form should expose an apply button',
    );
    assert.match(
        js,
        /bindMomentSynastryControls\(\)/,
        'synastry header form should be bound during forecast initialization',
    );
    assert.match(
        js,
        /applyManualSynastryPartner\(readMomentSynastryManualInput\(\), \{ errorTarget: 'moment' \}\)/,
        'synastry header form should use the same manual partner apply path',
    );
    assert.match(
        js,
        /card\.querySelector\('\[data-moment-synastry\]'\)\?\.classList\.toggle\('hidden', !isSynastry\)/,
        'right panel header click should reveal the synastry form for synastry layers',
    );
});

test('forecast-new synastry empty state disables the stepper until partner data exists', () => {
    const js = read('frontend/js/forecast-new.js');
    const ru = JSON.parse(read('frontend/locales/ru.json'));
    const uk = JSON.parse(read('frontend/locales/uk.json'));
    const en = JSON.parse(read('frontend/locales/en.json'));

    assert.match(
        js,
        /function isSynastryPartnerMissing\(\)/,
        'synastry empty state should be explicit',
    );
    assert.match(
        js,
        /renderTimeStepperDisabled\(t\('page\.forecastNew\.synastry\.enterPrompt'\)\)/,
        'time stepper should render a disabled prompt while synastry partner data is missing',
    );
    assert.match(
        js,
        /setAttribute\('aria-disabled', 'true'\)/,
        'disabled time stepper should expose aria-disabled',
    );
    assert.equal(ru.page.forecastNew.synastry.enterPrompt, 'Введите данные карты партнёра');
    assert.equal(uk.page.forecastNew.synastry.enterPrompt, 'Введіть дані карти партнера');
    assert.equal(en.page.forecastNew.synastry.enterPrompt, 'Enter partner chart data');
});

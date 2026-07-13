const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('forecast-new eclipses widget uses the shared forecast date and place', () => {
    const js = read('frontend/js/forecast-new.js');

    assert.match(
        js,
        /function getEclipsePeriodContext\(\) \{[\s\S]*?splitTargetDatetime\(state\.selectedDateTime\)\[0\]/,
        'eclipse period should be anchored to the shared selected forecast date',
    );
    assert.match(
        js,
        /function getEclipsePeriodContext\(\) \{[\s\S]*?state\.location\?\.latitude[\s\S]*?state\.location\?\.longitude[\s\S]*?state\.timezone/,
        'eclipse period should use the shared forecast place and timezone',
    );
    assert.doesNotMatch(
        js,
        /const selectedDate = splitTargetDatetime\(getDisplayedMomentDateTime\(\)\)\[0\];[\s\S]*?const place = getMomentPlaceView\(\);/,
        'eclipse period must not follow the selected solar or synastry layer moment',
    );
});

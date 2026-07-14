const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('forecast-new eclipses widget follows the selected layer date and place', () => {
    const js = read('frontend/js/forecast-new.js');

    assert.match(
        js,
        /function getEclipseSourceContext\(\) \{[\s\S]*?getDisplayedMomentDateTime\(\) \|\| state\.selectedDateTime/,
        'eclipse period should be anchored to the selected layer moment',
    );
    assert.match(
        js,
        /function getEclipseSourceContext\(\) \{[\s\S]*?getMomentPlaceView\(\)/,
        'eclipse period should use the selected layer place and timezone',
    );
    assert.match(
        js,
        /function getEclipseSourceContext\(\) \{[\s\S]*?solar_info[\s\S]*?state\.solarLocation/,
        'solar eclipses should use the computed solar place',
    );
});

test('single natal eclipses use the natal stepper context and refresh with it', () => {
    const js = read('frontend/js/forecast-new.js');

    assert.match(
        js,
        /function getEclipseSourceContext\(\) \{[\s\S]*?currentWheelMode\(\) === 'single'[\s\S]*?state\.singleChartMode === 'natal'[\s\S]*?state\.natalSelectedDateTime[\s\S]*?state\.natalLocation[\s\S]*?state\.natalTimezone/,
    );
    assert.match(
        js,
        /function stepNatalDateTimeSegment\([\s\S]*?state\.natalSelectedDateTime =[\s\S]*?renderNowBlocks\(\)/,
    );
    assert.match(
        js,
        /key: \[sourceContext\.source, selectedDate, startDate, endDate/,
        'cache keys must distinguish natal and prognostic contexts',
    );
});

test('forecast-new refreshes legacy natal snapshots that lack cusp aspects', () => {
    const js = read('frontend/js/forecast-new.js');

    assert.match(js, /!Array\.isArray\(natalData\.cusp_aspects\)/);
    assert.match(js, /natalData = await window\.AstroAPI\.getNatalChart\(natalUserId\)/);
    assert.match(js, /window\.AstroAPI\.saveChartToSession\?\.\(natalData\)/);
});

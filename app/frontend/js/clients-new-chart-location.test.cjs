'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, 'clients.js'), 'utf8');

assert.match(
    source,
    /const body = \{[\s\S]*?location_name:\s*place,[\s\S]*?latitude:\s*newChartState\.selectedCoords\?\.lat \?\? null,[\s\S]*?longitude:\s*newChartState\.selectedCoords\?\.lon \?\? null,/,
    'new chart creation preserves the city label while sending selected coordinates'
);

assert.doesNotMatch(
    source,
    /location_name:\s*newChartState\.selectedCoords\s*\?\s*null\s*:\s*place/,
    'new chart creation must not drop location_name when autocomplete coordinates are selected'
);

assert.match(
    source,
    /if \(profileMode === 'new'\)[\s\S]*?apiFetch\(`\$\{API_BASE\}\/persons`[\s\S]*?body\.person_id = createdPersonId/,
    'new-profile mode creates a person and links the new chart to it'
);

assert.match(
    source,
    /if \(profileMode === 'existing' && !newChartState\.selectedPersonId\)[\s\S]*?existingRequired/,
    'existing-profile mode requires an explicit profile selection'
);

assert.match(
    source,
    /const submitKey = mode === 'new'[\s\S]*?submitNew[\s\S]*?submitExisting[\s\S]*?newChart\.submit/,
    'the submit label reflects all three profile modes'
);

assert.match(
    source,
    /const now = new Date\(\);[\s\S]*?now\.getDate\(\)[\s\S]*?now\.getMonth\(\)[\s\S]*?now\.getFullYear\(\)[\s\S]*?now\.getHours\(\)[\s\S]*?now\.getMinutes\(\)/,
    'now action fills every date and time field from one Date snapshot'
);

assert.match(
    source,
    /getCurrentPosition\(resolve, reject, \{[\s\S]*?timeout: 8000,[\s\S]*?maximumAge: 300000/,
    'now action requests a bounded, reusable device position'
);

assert.match(
    source,
    /reverseGeocode\?\.\(lat, lon\)[\s\S]*?currentLocation[\s\S]*?selectedCoords = \{ lat, lon \}/,
    'device coordinates are preserved when reverse geocoding needs a localized fallback'
);

console.log('8 passed, 0 failed');

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

console.log('2 passed, 0 failed');

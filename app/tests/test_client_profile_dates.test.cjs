const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// client-profile.js is a page module with a DOM bootstrap; lift just the date
// helpers out of the shipped source so the test exercises the real code.
const source = fs.readFileSync(path.join(__dirname, '../frontend/js/client-profile.js'), 'utf8');
const start = source.indexOf('const HAS_ZONE_SUFFIX');
const end = source.indexOf('function formatDuration');
assert.ok(start > 0 && end > start, 'date helpers not found in client-profile.js');

const context = { window: {} };
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\nthis.parseBackendInstant = parseBackendInstant; this.formatDateTime = formatDateTime;`, context);
const { parseBackendInstant, formatDateTime } = context;

const UTC_MS = Date.UTC(2026, 9, 1, 16, 0, 0);

test('offset-aware timestamps parse (scheduled_at, the raw-ISO bug)', () => {
    assert.equal(parseBackendInstant('2026-10-01T16:00:00+00:00').getTime(), UTC_MS);
    assert.equal(parseBackendInstant('2026-10-01T18:00:00+02:00').getTime(), UTC_MS);
    assert.equal(parseBackendInstant('2026-10-01T16:00:00Z').getTime(), UTC_MS);
});

test('naive timestamps are still read as UTC (created_at, started_at)', () => {
    assert.equal(parseBackendInstant('2026-10-01T16:00:00').getTime(), UTC_MS);
    assert.equal(parseBackendInstant('2026-10-01T16:00:00.123456').getTime(), UTC_MS + 123);
});

test('formatDateTime never falls back to the raw ISO string for valid input', () => {
    const out = formatDateTime('2026-10-01T16:00:00+00:00');
    assert.ok(!out.includes('T16:00:00'), out);
    assert.ok(out.includes('2026'), out);
});

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildTimelineRange,
    normalizeTimelineEvents,
    countTimelineRows,
} = require('../frontend/js/forecast-timeline-utils.js');

test('buildTimelineRange includes full end day', () => {
    const range = buildTimelineRange('2026-02-01', '2026-02-10');
    assert.ok(range);
    const expectedEnd = new Date('2026-02-10T23:59:59.999').getTime();
    assert.equal(range.endMs, expectedEnd);
});

test('normalizeTimelineEvents keeps events intersecting range end day', () => {
    const raw = [
        {
            transit_body: 'Saturn',
            natal_body: 'Sun',
            aspect_type: 'Square',
            t_enter: '2026-02-10T18:00:00+02:00',
            t_exact: '2026-02-10T21:00:00+02:00',
            t_leave: '2026-02-11T05:00:00+02:00',
        },
    ];
    const normalized = normalizeTimelineEvents(raw, '2026-02-01', '2026-02-10');
    assert.equal(normalized.events.length, 1);
    assert.equal(normalized.dropped.outOfRange, 0);
});

test('normalizeTimelineEvents drops invalid and fully out-of-range events', () => {
    const raw = [
        {
            transit_body: 'Saturn',
            natal_body: 'Moon',
            aspect_type: 'Opposition',
            t_enter: 'bad-date',
            t_exact: '2026-02-05T12:00:00+02:00',
            t_leave: '2026-02-06T12:00:00+02:00',
        },
        {
            transit_body: 'Jupiter',
            natal_body: 'Mars',
            aspect_type: 'Trine',
            t_enter: '2026-03-12T00:00:00+02:00',
            t_exact: '2026-03-13T00:00:00+02:00',
            t_leave: '2026-03-14T00:00:00+02:00',
        },
    ];
    const normalized = normalizeTimelineEvents(raw, '2026-02-01', '2026-02-10');
    assert.equal(normalized.events.length, 0);
    assert.equal(normalized.dropped.invalid, 1);
    assert.equal(normalized.dropped.outOfRange, 1);
});

test('countTimelineRows groups multiple events of same transit/aspect/natal into one row', () => {
    const events = [
        { transit_body: 'Saturn', aspect_type: 'Square', natal_body: 'Sun' },
        { transit_body: 'Saturn', aspect_type: 'Square', natal_body: 'Sun' },
        { transit_body: 'Jupiter', aspect_type: 'Trine', natal_body: 'Moon' },
    ];
    assert.equal(countTimelineRows(events), 2);
});

'use strict';

const KNOWN_HARDCODED_STRING_ALLOWLIST = [
    { file: 'app/frontend/forecast.html', kind: 'html-text-node', includes: 'Save as account defaults' },
    { file: 'app/frontend/forecast.html', kind: 'html-text-node', includes: 'Reset to defaults' },
    { file: 'app/frontend/forecast.html', kind: 'html-text-node', includes: 'Bodies Matrix' },
    { file: 'app/frontend/forecast.html', kind: 'html-text-node', includes: 'Aspect Types' },
    { file: 'app/frontend/forecast.html', kind: 'html-text-node', includes: 'Aspect Scope' },
    { file: 'app/frontend/forecast.html', kind: 'html-text-node', includes: 'Major' },
    { file: 'app/frontend/forecast.html', kind: 'html-text-node', includes: 'Minor' },
    { file: 'app/frontend/js/clients.js', kind: 'js-ui-sink', includes: 'Loading' },
    { file: 'app/frontend/js/clients.js', kind: 'js-ui-sink', includes: 'Transcription in progress' },
    { file: 'app/frontend/js/clients.js', kind: 'js-ui-sink', includes: 'Could not load recording:' },
    { file: 'app/frontend/js/clients.js', kind: 'js-ui-sink', includes: 'Processing timed out. Retry' },
    { file: 'app/frontend/js/clients.js', kind: 'js-ui-sink', includes: 'Starting' },
    { file: 'app/frontend/js/clients.js', kind: 'js-ui-sink', includes: 'Start call' },
    { file: 'app/frontend/js/chart.js', kind: 'js-user-error', includes: 'Account defaults are unavailable' },
    { file: 'app/frontend/js/forecast.js', kind: 'js-user-error', includes: 'Account defaults are unavailable' },
];

const KNOWN_UNTRANSLATED_VALUE_KEYS = [
    'page.accountSettings.creation.timezoneLabelFormatOptions.gmt',
    'page.accountSettings.creation.timezoneLabelFormatOptions.utc',
    'page.chart.balances.quadrant1',
    'page.chart.balances.quadrant2',
    'page.chart.balances.quadrant3',
    'page.chart.balances.quadrant4',
    'page.synastry.headerTitle',
    'page.natalFull.balances.quadrant1',
    'page.natalFull.balances.quadrant2',
    'page.natalFull.balances.quadrant3',
    'page.natalFull.balances.quadrant4',
];

module.exports = {
    KNOWN_HARDCODED_STRING_ALLOWLIST,
    KNOWN_UNTRANSLATED_VALUE_KEYS,
};

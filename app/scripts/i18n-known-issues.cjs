'use strict';

const GERMAN_IDENTICAL_VALUE_KEYS = require('./i18n-known-identical-values.de.json');

const KNOWN_HARDCODED_STRING_ALLOWLIST = [
    // These exceptions are internal control-flow errors. Their callers either log
    // them, ignore them, or replace them with catalog-backed UI copy.
    { file: 'app/frontend/js/call-pip.js', kind: 'js-user-error', includes: 'No video stream available' },
    { file: 'app/frontend/js/chart-config-presets.js', kind: 'js-user-error', includes: 'Preferences API is unavailable' },
    { file: 'app/frontend/js/chat.js', kind: 'js-user-error', includes: 'table failed' },
    { file: 'app/frontend/js/chat.js', kind: 'js-user-error', includes: 'list failed' },
    { file: 'app/frontend/js/chat.js', kind: 'js-user-error', includes: 'load failed' },
    { file: 'app/frontend/js/chat.js', kind: 'js-user-error', includes: 'delete failed' },
    { file: 'app/frontend/js/consultation-call.js', kind: 'js-user-error', includes: 'Failed to submit consent' },
    { file: 'app/frontend/js/forecast-new.js', kind: 'js-user-error', includes: 'Panel dialog is missing required controls' },
    { file: 'app/frontend/js/i18n.js', kind: 'js-user-error', includes: 'catalog HTTP' },
    { file: 'app/frontend/js/methodology-registry.js', kind: 'js-user-error', includes: 'Unknown methodology:' },
    { file: 'app/frontend/js/place-autocomplete.js', kind: 'js-user-error', includes: 'Place search failed:' },
    { file: 'app/frontend/js/save-chart-modal.js', kind: 'js-user-error', includes: 'HTTP' },
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
    // Ayanamsha systems are proper nouns (named after their authors) and stay
    // identical across locales.
    'page.forecastNew.zodiac.ayanamsha.lahiri',
    'page.forecastNew.zodiac.ayanamsha.fagan_bradley',
    'page.forecastNew.zodiac.ayanamsha.krishnamurti',
    'page.forecastNew.zodiac.ayanamsha.raman',
    'page.forecastNew.zodiac.ayanamsha.de_luce',
    // Davison is a named composite-chart method.
    'page.forecastNew.composite.davison',
    // Subscription tier names are kept as brand labels in every locale.
    'page.pricing.plans.practitioner.name',
    'page.pricing.plans.studio.name',
    // Swiss Ephemeris is the name of the ephemeris library itself.
    'page.index.foundation.items.ephemeris.title',
];

const KNOWN_UNTRANSLATED_VALUE_KEYS_BY_LOCALE = {
    de: GERMAN_IDENTICAL_VALUE_KEYS,
};

module.exports = {
    KNOWN_HARDCODED_STRING_ALLOWLIST,
    KNOWN_UNTRANSLATED_VALUE_KEYS,
    KNOWN_UNTRANSLATED_VALUE_KEYS_BY_LOCALE,
};

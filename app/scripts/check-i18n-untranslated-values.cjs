#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
    KNOWN_UNTRANSLATED_VALUE_KEYS,
} = require('./i18n-known-issues.cjs');

const DEFAULT_ALLOWLIST = [
    'i18n.sample_only_en',
    'common.brandName',
    'page.index.logo',
    'page.forecast.scale.range',
    'timezones.label.cityWithOffset',
    'timezones.city.utc',
    ...KNOWN_UNTRANSLATED_VALUE_KEYS,
];

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function flattenCatalog(value, prefix = '', out = {}) {
    if (!isPlainObject(value)) {
        out[prefix] = value;
        return out;
    }

    for (const [key, nested] of Object.entries(value)) {
        const nextPrefix = prefix ? `${prefix}.${key}` : key;
        flattenCatalog(nested, nextPrefix, out);
    }

    return out;
}

function parseLocales(rawLocales) {
    return String(rawLocales || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function parseAllowlist(rawAllowlist) {
    if (!rawAllowlist) return [...DEFAULT_ALLOWLIST];
    return String(rawAllowlist)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function parseArgs(argv) {
    const parsed = {};
    for (const arg of argv) {
        if (!arg.startsWith('--')) continue;
        const [rawKey, rawValue] = arg.slice(2).split('=', 2);
        if (!rawKey) continue;
        parsed[rawKey] = rawValue ?? 'true';
    }
    return parsed;
}

function isLikelyEnglish(value) {
    return typeof value === 'string'
        && /[A-Za-z]/.test(value)
        && !/[А-Яа-яІіЇїЄєҐґ]/.test(value);
}

function runUntranslatedValueCheck(options = {}) {
    const localesDir = path.resolve(options.localesDir || path.join(__dirname, '..', 'frontend', 'locales'));
    const baselineLocale = options.baselineLocale || 'en';
    const locales = options.locales || ['uk', 'ru'];
    const allowlist = new Set(options.allowlist || DEFAULT_ALLOWLIST);

    const baselinePath = path.join(localesDir, `${baselineLocale}.json`);
    if (!fs.existsSync(baselinePath)) {
        throw new Error(`Baseline locale file not found: ${baselinePath}`);
    }

    const baselineCatalog = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const baselineLeaves = flattenCatalog(baselineCatalog);

    const report = {};
    let issuesCount = 0;

    for (const locale of locales) {
        const localePath = path.join(localesDir, `${locale}.json`);
        if (!fs.existsSync(localePath)) {
            report[locale] = {
                untranslatedKeys: [`__file_missing__: ${localePath}`],
            };
            issuesCount += 1;
            continue;
        }

        const localeCatalog = JSON.parse(fs.readFileSync(localePath, 'utf8'));
        const localeLeaves = flattenCatalog(localeCatalog);
        const untranslatedKeys = [];

        for (const [key, baselineValue] of Object.entries(baselineLeaves)) {
            if (allowlist.has(key)) continue;
            if (!isLikelyEnglish(baselineValue)) continue;
            if (localeLeaves[key] === baselineValue) {
                untranslatedKeys.push(key);
            }
        }

        report[locale] = { untranslatedKeys };
        issuesCount += untranslatedKeys.length;
    }

    return {
        ok: issuesCount === 0,
        baselineLocale,
        locales,
        localesDir,
        allowlist: [...allowlist],
        report,
    };
}

function formatReport(result) {
    if (result.ok) {
        return `[i18n-untranslated-values] PASS baseline="${result.baselineLocale}" locales=${result.locales.join(',')} allowlist=${result.allowlist.length}`;
    }

    const lines = [`[i18n-untranslated-values] FAIL baseline="${result.baselineLocale}" locales=${result.locales.join(',')}`];
    for (const locale of result.locales) {
        const localeReport = result.report[locale];
        if (!localeReport || !localeReport.untranslatedKeys.length) continue;
        lines.push(`  locale="${locale}"`);
        for (const key of localeReport.untranslatedKeys) {
            lines.push(`    untranslated: ${key}`);
        }
    }
    return lines.join('\n');
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const locales = args.locales ? parseLocales(args.locales) : ['uk', 'ru'];
    const allowlist = parseAllowlist(args.allowlist);

    const result = runUntranslatedValueCheck({
        localesDir: args['locales-dir'],
        baselineLocale: args.baseline || 'en',
        locales,
        allowlist,
    });

    const output = formatReport(result);
    if (result.ok) {
        console.log(output);
        return;
    }
    console.error(output);
    process.exitCode = 1;
}

if (require.main === module) {
    try {
        main();
    } catch (error) {
        console.error(`[i18n-untranslated-values] ERROR ${error.message}`);
        process.exitCode = 1;
    }
}

module.exports = {
    DEFAULT_ALLOWLIST,
    flattenCatalog,
    isLikelyEnglish,
    parseAllowlist,
    parseLocales,
    runUntranslatedValueCheck,
    formatReport,
};

#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function collectLeafEntries(value, prefix = '', out = {}) {
    if (!isPlainObject(value)) {
        out[prefix] = value;
        return out;
    }

    for (const [key, nested] of Object.entries(value)) {
        const nextPrefix = prefix ? `${prefix}.${key}` : key;
        collectLeafEntries(nested, nextPrefix, out);
    }

    return out;
}

function getByPath(obj, dotPath) {
    if (!dotPath) return obj;
    const parts = dotPath.split('.');
    let current = obj;
    for (const part of parts) {
        if (!isPlainObject(current) || !(part in current)) {
            return undefined;
        }
        current = current[part];
    }
    return current;
}

function typeLabel(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

function validateAgainstBaseline(baselineCatalog, targetCatalog) {
    const baselineLeaves = collectLeafEntries(baselineCatalog);
    const missingKeys = [];
    const typeMismatches = [];

    for (const [key, baselineValue] of Object.entries(baselineLeaves)) {
        const targetValue = getByPath(targetCatalog, key);

        if (targetValue === undefined || targetValue === null) {
            missingKeys.push(key);
            continue;
        }

        if (isPlainObject(targetValue)) {
            typeMismatches.push({
                key,
                expected: typeLabel(baselineValue),
                actual: 'object',
            });
            continue;
        }

        if (Array.isArray(baselineValue) !== Array.isArray(targetValue)) {
            typeMismatches.push({
                key,
                expected: typeLabel(baselineValue),
                actual: typeLabel(targetValue),
            });
            continue;
        }

        if (!Array.isArray(baselineValue) && typeof baselineValue !== typeof targetValue) {
            typeMismatches.push({
                key,
                expected: typeLabel(baselineValue),
                actual: typeLabel(targetValue),
            });
        }
    }

    return { missingKeys, typeMismatches };
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseLocales(rawLocales) {
    return String(rawLocales || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function runMissingKeyCheck(options = {}) {
    const localesDir = path.resolve(options.localesDir || path.join(__dirname, '..', 'frontend', 'locales'));
    const baselineLocale = options.baselineLocale || 'en';
    const locales = options.locales || ['uk', 'ru'];

    const baselinePath = path.join(localesDir, `${baselineLocale}.json`);
    if (!fs.existsSync(baselinePath)) {
        throw new Error(`Baseline locale file not found: ${baselinePath}`);
    }

    const baselineCatalog = readJson(baselinePath);
    const report = {};
    let issuesCount = 0;

    for (const locale of locales) {
        const localePath = path.join(localesDir, `${locale}.json`);
        if (!fs.existsSync(localePath)) {
            report[locale] = {
                missingKeys: [`__file_missing__: ${localePath}`],
                typeMismatches: [],
            };
            issuesCount += 1;
            continue;
        }

        const targetCatalog = readJson(localePath);
        const localeReport = validateAgainstBaseline(baselineCatalog, targetCatalog);
        report[locale] = localeReport;
        issuesCount += localeReport.missingKeys.length + localeReport.typeMismatches.length;
    }

    return {
        ok: issuesCount === 0,
        baselineLocale,
        locales,
        localesDir,
        report,
    };
}

function formatReport(result) {
    const lines = [];
    if (result.ok) {
        lines.push(`[i18n-missing-keys] PASS baseline="${result.baselineLocale}" locales=${result.locales.join(',')}`);
        return lines.join('\n');
    }

    lines.push(`[i18n-missing-keys] FAIL baseline="${result.baselineLocale}" locales=${result.locales.join(',')}`);
    for (const locale of result.locales) {
        const localeReport = result.report[locale];
        if (!localeReport) continue;
        if (!localeReport.missingKeys.length && !localeReport.typeMismatches.length) continue;

        lines.push(`  locale="${locale}"`);
        for (const key of localeReport.missingKeys) {
            lines.push(`    missing: ${key}`);
        }
        for (const mismatch of localeReport.typeMismatches) {
            lines.push(`    type_mismatch: ${mismatch.key} expected=${mismatch.expected} actual=${mismatch.actual}`);
        }
    }
    return lines.join('\n');
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

function main() {
    const args = parseArgs(process.argv.slice(2));
    const locales = args.locales ? parseLocales(args.locales) : ['uk', 'ru'];

    const result = runMissingKeyCheck({
        localesDir: args['locales-dir'],
        baselineLocale: args.baseline || 'en',
        locales,
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
        console.error(`[i18n-missing-keys] ERROR ${error.message}`);
        process.exitCode = 1;
    }
}

module.exports = {
    collectLeafEntries,
    validateAgainstBaseline,
    runMissingKeyCheck,
    formatReport,
    parseLocales,
};

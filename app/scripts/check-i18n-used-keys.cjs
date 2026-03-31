#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function getByPath(obj, dotPath) {
    if (!dotPath) return obj;
    const parts = String(dotPath).split('.').filter(Boolean);
    let current = obj;
    for (const part of parts) {
        if (!isPlainObject(current) || !(part in current)) {
            return undefined;
        }
        current = current[part];
    }
    return current;
}

function walkFrontendSource(frontendDir) {
    const files = [];

    function walk(dir) {
        for (const name of fs.readdirSync(dir)) {
            const fullPath = path.join(dir, name);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                if (name === 'locales' || name === 'bundles') continue;
                walk(fullPath);
                continue;
            }

            if (/\.(html|js)$/.test(name)) {
                files.push(fullPath);
            }
        }
    }

    walk(frontendDir);
    return files;
}

function extractI18nKeys(source) {
    const found = new Set();
    const patterns = [
        /data-i18n(?:-html|-placeholder|-title|-aria-label|-value|-data-label)?="([^"]+)"/g,
        /\bt\(\s*['"]([^'"]+)['"]/g,
        /FrontendI18n\.t\(\s*['"]([^'"]+)['"]/g,
        /this\.t\(\s*['"]([^'"]+)['"]/g,
        /translate\(\s*['"]([^'"]+)['"]/g,
    ];

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(source)) !== null) {
            const key = String(match[1] || '').trim();
            if (!/^(page|common|app|locale|astro)\./.test(key)) continue;
            if (/\s/.test(key) || key.includes('{')) continue;
            found.add(key);
        }
        pattern.lastIndex = 0;
    }

    return found;
}

function runUsedKeyCheck(options = {}) {
    const repoRoot = path.resolve(options.repoRoot || path.join(__dirname, '..', '..'));
    const frontendDir = path.resolve(options.frontendDir || path.join(repoRoot, 'app', 'frontend'));
    const localesDir = path.resolve(options.localesDir || path.join(frontendDir, 'locales'));
    const baselineLocale = options.baselineLocale || 'en';
    const baselinePath = path.join(localesDir, `${baselineLocale}.json`);

    if (!fs.existsSync(baselinePath)) {
        throw new Error(`Baseline locale file not found: ${baselinePath}`);
    }

    const baselineCatalog = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const files = walkFrontendSource(frontendDir);
    const missing = new Map();

    for (const filePath of files) {
        const source = fs.readFileSync(filePath, 'utf8');
        const relPath = path.relative(repoRoot, filePath).split(path.sep).join('/');
        const keys = extractI18nKeys(source);

        for (const key of keys) {
            if (getByPath(baselineCatalog, key) !== undefined) continue;
            if (!missing.has(key)) missing.set(key, []);
            missing.get(key).push(relPath);
        }
    }

    const missingEntries = [...missing.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return {
        ok: missingEntries.length === 0,
        baselineLocale,
        missingEntries,
    };
}

function formatReport(result) {
    if (result.ok) {
        return `[i18n-used-keys] PASS baseline="${result.baselineLocale}"`;
    }

    const lines = [`[i18n-used-keys] FAIL baseline="${result.baselineLocale}"`];
    for (const [key, files] of result.missingEntries) {
        lines.push(`  missing: ${key}`);
        lines.push(`    used_in: ${files.join(', ')}`);
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
    const result = runUsedKeyCheck({
        repoRoot: args['repo-root'],
        frontendDir: args['frontend-dir'],
        localesDir: args['locales-dir'],
        baselineLocale: args.baseline || 'en',
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
        console.error(`[i18n-used-keys] ERROR ${error.message}`);
        process.exitCode = 1;
    }
}

module.exports = {
    extractI18nKeys,
    runUsedKeyCheck,
    formatReport,
};

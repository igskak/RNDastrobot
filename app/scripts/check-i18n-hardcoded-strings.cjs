#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_TARGET_FILES = [
    'app/frontend/index.html',
    'app/frontend/chart.html',
    'app/frontend/forecast.html',
    'app/frontend/clients.html',
    'app/frontend/natal-full.html',
    'app/frontend/login.html',
    'app/frontend/calendar.html',
    'app/frontend/js/form.js',
    'app/frontend/js/clients.js',
    'app/frontend/js/chart.js',
    'app/frontend/js/chart-data.js',
    'app/frontend/js/chart-layout.js',
    'app/frontend/js/chart-wheel.js',
    'app/frontend/js/forecast.js',
    'app/frontend/js/forecast-timeline.js',
    'app/frontend/js/forecast-biwheel.js',
    'app/frontend/js/natal-full.js',
    'app/frontend/js/login.js',
    'app/frontend/js/api.js',
    'app/frontend/js/timezones.js',
];

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

function toPosixPath(value) {
    return value.split(path.sep).join('/');
}

function looksLikeI18nKey(value) {
    return /^[a-z][a-z0-9_-]*(\.[a-z0-9_-]+)+$/.test(value);
}

function containsHumanText(value) {
    return /[A-Za-zА-Яа-я]{4,}/.test(value);
}

function stripTemplateExpressions(value) {
    return value.replace(/\$\{[^}]*\}/g, ' ');
}

function extractVisibleTextFromHtml(value) {
    return stripTemplateExpressions(value)
        .replace(/<[^>]*>/g, ' ')
        .replace(/&[a-z0-9#]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function lineNumberAt(text, index) {
    return text.slice(0, index).split('\n').length;
}

function isAllowed(allowlist, violation) {
    return allowlist.some((rule) => {
        if (rule.file && toPosixPath(rule.file) !== toPosixPath(violation.file)) return false;
        if (rule.kind && rule.kind !== violation.kind) return false;
        if (typeof rule.line === 'number' && rule.line !== violation.line) return false;
        if (rule.includes && !violation.value.includes(rule.includes)) return false;
        return true;
    });
}

function scanJsFile(filePath, source, allowlist) {
    const violations = [];
    const lines = source.split('\n');
    const sinkPatterns = [
        {
            kind: 'js-ui-sink',
            re: /\b(?:textContent|innerText|innerHTML)\s*=\s*(['"`])((?:\\.|(?!\1).)*)\1/,
            pick: (match) => match[2],
        },
        {
            kind: 'js-ui-sink',
            re: /\bsetAttribute\(\s*['"](title|placeholder|aria-label)['"]\s*,\s*(['"`])((?:\\.|(?!\2).)*)\2/,
            pick: (match) => match[3],
        },
        {
            kind: 'js-ui-sink',
            re: /\b(?:alert|confirm|prompt)\(\s*(['"`])((?:\\.|(?!\1).)*)\1/,
            pick: (match) => match[2],
        },
        {
            kind: 'js-user-error',
            re: /\bthrow\s+new\s+Error\(\s*(['"`])((?:\\.|(?!\1).)*)\1\s*\)/,
            pick: (match) => match[2],
        },
        {
            kind: 'js-user-error',
            re: /\bPromise\.reject\(\s*new\s+Error\(\s*(['"`])((?:\\.|(?!\1).)*)\1\s*\)\s*\)/,
            pick: (match) => match[2],
        },
    ];

    for (let idx = 0; idx < lines.length; idx += 1) {
        const line = lines[idx];
        if (line.includes('console.')) continue;

        for (const pattern of sinkPatterns) {
            const match = line.match(pattern.re);
            if (!match) continue;

            const literal = pattern.pick(match);
            if (!literal) continue;
            if (looksLikeI18nKey(literal)) continue;

            const candidate = literal.includes('<') && literal.includes('>')
                ? extractVisibleTextFromHtml(literal)
                : stripTemplateExpressions(literal).replace(/\s+/g, ' ').trim();

            if (!candidate || !containsHumanText(candidate)) continue;

            const violation = {
                file: filePath,
                line: idx + 1,
                kind: pattern.kind,
                value: candidate,
            };
            if (!isAllowed(allowlist, violation)) {
                violations.push(violation);
            }
        }
    }

    return violations;
}

function scanHtmlFile(filePath, source, allowlist) {
    const violations = [];

    const lines = source.split('\n');
    for (let idx = 0; idx < lines.length; idx += 1) {
        const line = lines[idx];
        const attrRe = /(placeholder|title|aria-label)\s*=\s*"([^"]*)"/gi;
        let attrMatch;
        while ((attrMatch = attrRe.exec(line)) !== null) {
            const attr = attrMatch[1];
            const value = attrMatch[2].trim();
            if (!containsHumanText(value)) continue;

            const i18nAttr = `data-i18n-${attr}`;
            if (line.includes(i18nAttr)) continue;

            const violation = {
                file: filePath,
                line: idx + 1,
                kind: 'html-attribute',
                value: `${attr}="${value}"`,
            };
            if (!isAllowed(allowlist, violation)) {
                violations.push(violation);
            }
        }
    }

    const htmlForTextNodes = source
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '');

    const textNodeRe = />([^<]+)</g;
    let textMatch;
    while ((textMatch = textNodeRe.exec(htmlForTextNodes)) !== null) {
        const rawText = textMatch[1].replace(/\s+/g, ' ').trim();
        if (!rawText || !containsHumanText(rawText)) continue;

        const violation = {
            file: filePath,
            line: lineNumberAt(source, textMatch.index),
            kind: 'html-text-node',
            value: rawText,
        };
        if (!isAllowed(allowlist, violation)) {
            violations.push(violation);
        }
    }

    return violations;
}

function runHardcodedStringCheck(options = {}) {
    const repoRoot = path.resolve(options.repoRoot || path.join(__dirname, '..', '..'));
    const targetFiles = options.targetFiles || DEFAULT_TARGET_FILES;
    const allowlist = options.allowlist || [];

    const violations = [];
    const scannedFiles = [];

    for (const relPath of targetFiles) {
        const absPath = path.resolve(repoRoot, relPath);
        if (!fs.existsSync(absPath)) {
            continue;
        }
        const source = fs.readFileSync(absPath, 'utf8');
        const normalizedPath = toPosixPath(path.relative(repoRoot, absPath));
        scannedFiles.push(normalizedPath);

        if (normalizedPath.endsWith('.js')) {
            violations.push(...scanJsFile(normalizedPath, source, allowlist));
            continue;
        }
        if (normalizedPath.endsWith('.html')) {
            violations.push(...scanHtmlFile(normalizedPath, source, allowlist));
        }
    }

    return {
        ok: violations.length === 0,
        scannedFiles,
        violations,
    };
}

function formatReport(result) {
    if (result.ok) {
        return `[i18n-hardcoded-check] PASS scanned=${result.scannedFiles.length}`;
    }

    const lines = [`[i18n-hardcoded-check] FAIL violations=${result.violations.length}`];
    for (const violation of result.violations) {
        lines.push(`  ${violation.file}:${violation.line} [${violation.kind}] ${violation.value}`);
    }
    return lines.join('\n');
}

function parseAllowlist(rawJson) {
    if (!rawJson) return [];
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) {
        throw new Error('Allowlist must be a JSON array');
    }
    return parsed;
}

function parseTargetFiles(rawCsv) {
    if (!rawCsv) return DEFAULT_TARGET_FILES;
    return rawCsv.split(',').map((item) => item.trim()).filter(Boolean);
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const result = runHardcodedStringCheck({
        repoRoot: args['repo-root'],
        targetFiles: parseTargetFiles(args.files),
        allowlist: parseAllowlist(args.allowlist),
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
        console.error(`[i18n-hardcoded-check] ERROR ${error.message}`);
        process.exitCode = 1;
    }
}

module.exports = {
    DEFAULT_TARGET_FILES,
    runHardcodedStringCheck,
    formatReport,
    scanJsFile,
    scanHtmlFile,
};

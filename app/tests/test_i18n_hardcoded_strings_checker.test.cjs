const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    runHardcodedStringCheck,
} = require('../scripts/check-i18n-hardcoded-strings.cjs');

function writeText(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, value, 'utf8');
}

test('hardcoded checker passes for i18n-safe ui sinks and data-i18n html', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-hardcoded-pass-'));

    try {
        writeText(
            path.join(tempRoot, 'app/frontend/js/page.js'),
            "element.textContent = t('page.title');\n",
        );
        writeText(
            path.join(tempRoot, 'app/frontend/page.html'),
            '<input placeholder="" data-i18n-placeholder="page.placeholder">\n',
        );

        const result = runHardcodedStringCheck({
            repoRoot: tempRoot,
            targetFiles: ['app/frontend/js/page.js', 'app/frontend/page.html'],
        });

        assert.equal(result.ok, true);
        assert.equal(result.violations.length, 0);
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('hardcoded checker fails on hardcoded ui sink and html attribute', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-hardcoded-fail-'));

    try {
        writeText(
            path.join(tempRoot, 'app/frontend/js/page.js'),
            "element.textContent = 'Hardcoded title';\n",
        );
        writeText(
            path.join(tempRoot, 'app/frontend/page.html'),
            '<button title="Open profile"></button>\n',
        );

        const result = runHardcodedStringCheck({
            repoRoot: tempRoot,
            targetFiles: ['app/frontend/js/page.js', 'app/frontend/page.html'],
        });

        assert.equal(result.ok, false);
        assert.equal(result.violations.length, 2);
        assert.ok(result.violations.some((v) => v.kind === 'js-ui-sink'));
        assert.ok(result.violations.some((v) => v.kind === 'html-attribute'));
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('hardcoded checker supports focused allowlist entries when exception is justified', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-hardcoded-allow-'));

    try {
        writeText(
            path.join(tempRoot, 'app/frontend/js/page.js'),
            "element.innerHTML = '<span>ABCD</span>';\n",
        );

        const result = runHardcodedStringCheck({
            repoRoot: tempRoot,
            targetFiles: ['app/frontend/js/page.js'],
            allowlist: [{
                file: 'app/frontend/js/page.js',
                kind: 'js-ui-sink',
                includes: 'ABCD',
            }],
        });

        assert.equal(result.ok, true);
        assert.equal(result.violations.length, 0);
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('hardcoded checker fails on hardcoded throw new Error user-facing message', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-hardcoded-throw-fail-'));

    try {
        writeText(
            path.join(tempRoot, 'app/frontend/js/page.js'),
            "throw new Error('Please select a valid date');\n",
        );

        const result = runHardcodedStringCheck({
            repoRoot: tempRoot,
            targetFiles: ['app/frontend/js/page.js'],
        });

        assert.equal(result.ok, false);
        assert.equal(result.violations.length, 1);
        assert.equal(result.violations[0].kind, 'js-user-error');
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('hardcoded checker allows throw new Error with i18n translation call', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-hardcoded-throw-pass-'));

    try {
        writeText(
            path.join(tempRoot, 'app/frontend/js/page.js'),
            "throw new Error(t('page.error.invalidDate'));\n",
        );

        const result = runHardcodedStringCheck({
            repoRoot: tempRoot,
            targetFiles: ['app/frontend/js/page.js'],
        });

        assert.equal(result.ok, true);
        assert.equal(result.violations.length, 0);
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

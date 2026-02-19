const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    runMissingKeyCheck,
} = require('../scripts/check-i18n-missing-keys.cjs');

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('missing-key checker passes when uk/ru are complete against en baseline', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-missing-pass-'));
    const localesDir = path.join(tempRoot, 'locales');
    fs.mkdirSync(localesDir, { recursive: true });

    try {
        const en = {
            common: {
                ok: 'OK',
                nested: {
                    value: 'Value',
                },
            },
        };
        writeJson(path.join(localesDir, 'en.json'), en);
        writeJson(path.join(localesDir, 'uk.json'), en);
        writeJson(path.join(localesDir, 'ru.json'), en);

        const result = runMissingKeyCheck({
            localesDir,
            baselineLocale: 'en',
            locales: ['uk', 'ru'],
        });

        assert.equal(result.ok, true);
        assert.equal(result.report.uk.missingKeys.length, 0);
        assert.equal(result.report.ru.missingKeys.length, 0);
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('missing-key checker fails when key is missing or type is incompatible', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-missing-fail-'));
    const localesDir = path.join(tempRoot, 'locales');
    fs.mkdirSync(localesDir, { recursive: true });

    try {
        writeJson(path.join(localesDir, 'en.json'), {
            page: {
                title: 'Title',
                subtitle: 'Subtitle',
            },
        });
        writeJson(path.join(localesDir, 'uk.json'), {
            page: {
                title: 'Заголовок',
                subtitle: { wrong: true },
            },
        });
        writeJson(path.join(localesDir, 'ru.json'), {
            page: {
                title: 'Заголовок',
            },
        });

        const result = runMissingKeyCheck({
            localesDir,
            baselineLocale: 'en',
            locales: ['uk', 'ru'],
        });

        assert.equal(result.ok, false);
        assert.equal(result.report.uk.typeMismatches.length, 1);
        assert.equal(result.report.uk.typeMismatches[0].key, 'page.subtitle');
        assert.deepEqual(result.report.ru.missingKeys, ['page.subtitle']);
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

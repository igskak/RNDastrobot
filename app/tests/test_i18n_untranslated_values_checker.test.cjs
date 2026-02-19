const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    runUntranslatedValueCheck,
} = require('../scripts/check-i18n-untranslated-values.cjs');

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('untranslated checker passes when localized values differ from en baseline', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-untranslated-pass-'));
    const localesDir = path.join(tempRoot, 'locales');
    fs.mkdirSync(localesDir, { recursive: true });

    try {
        writeJson(path.join(localesDir, 'en.json'), {
            page: {
                title: 'Title',
            },
            i18n: {
                sample_only_en: 'English fallback value',
            },
        });
        writeJson(path.join(localesDir, 'uk.json'), {
            page: {
                title: 'Заголовок',
            },
            i18n: {
                sample_only_en: 'English fallback value',
            },
        });
        writeJson(path.join(localesDir, 'ru.json'), {
            page: {
                title: 'Заголовок',
            },
            i18n: {
                sample_only_en: 'English fallback value',
            },
        });

        const result = runUntranslatedValueCheck({
            localesDir,
            baselineLocale: 'en',
            locales: ['uk', 'ru'],
            allowlist: ['i18n.sample_only_en'],
        });

        assert.equal(result.ok, true);
        assert.equal(result.report.uk.untranslatedKeys.length, 0);
        assert.equal(result.report.ru.untranslatedKeys.length, 0);
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('untranslated checker fails when target locale keeps en value for english text', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-untranslated-fail-'));
    const localesDir = path.join(tempRoot, 'locales');
    fs.mkdirSync(localesDir, { recursive: true });

    try {
        writeJson(path.join(localesDir, 'en.json'), {
            page: {
                subtitle: 'Professional astrology chart calculations',
            },
        });
        writeJson(path.join(localesDir, 'uk.json'), {
            page: {
                subtitle: 'Professional astrology chart calculations',
            },
        });
        writeJson(path.join(localesDir, 'ru.json'), {
            page: {
                subtitle: 'Профессиональные расчеты',
            },
        });

        const result = runUntranslatedValueCheck({
            localesDir,
            baselineLocale: 'en',
            locales: ['uk', 'ru'],
            allowlist: [],
        });

        assert.equal(result.ok, false);
        assert.deepEqual(result.report.uk.untranslatedKeys, ['page.subtitle']);
        assert.deepEqual(result.report.ru.untranslatedKeys, []);
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('untranslated checker ignores values from allowlist', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-untranslated-allow-'));
    const localesDir = path.join(tempRoot, 'locales');
    fs.mkdirSync(localesDir, { recursive: true });

    try {
        writeJson(path.join(localesDir, 'en.json'), {
            timezones: {
                label: {
                    cityWithOffset: '{city} ({offset})',
                },
            },
        });
        writeJson(path.join(localesDir, 'uk.json'), {
            timezones: {
                label: {
                    cityWithOffset: '{city} ({offset})',
                },
            },
        });
        writeJson(path.join(localesDir, 'ru.json'), {
            timezones: {
                label: {
                    cityWithOffset: '{city} ({offset})',
                },
            },
        });

        const result = runUntranslatedValueCheck({
            localesDir,
            baselineLocale: 'en',
            locales: ['uk', 'ru'],
            allowlist: ['timezones.label.cityWithOffset'],
        });

        assert.equal(result.ok, true);
        assert.equal(result.report.uk.untranslatedKeys.length, 0);
        assert.equal(result.report.ru.untranslatedKeys.length, 0);
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    extractI18nKeys,
    runUsedKeyCheck,
} = require('../scripts/check-i18n-used-keys.cjs');

function write(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
}

test('used-key checker extracts keys from html and js references', () => {
    const keys = extractI18nKeys(`
        <div data-i18n="page.clients.title"></div>
        <input data-i18n-placeholder="page.clients.search">
        <script>
          t('common.loading');
          FrontendI18n.t("astro.sign.Aries");
        </script>
    `);

    assert.deepEqual(
        [...keys].sort(),
        ['astro.sign.Aries', 'common.loading', 'page.clients.search', 'page.clients.title'],
    );
});

test('used-key checker passes when all referenced keys exist in en baseline', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-used-pass-'));
    const frontendDir = path.join(tempRoot, 'app', 'frontend');
    const localesDir = path.join(frontendDir, 'locales');

    try {
        write(path.join(localesDir, 'en.json'), JSON.stringify({
            page: { clients: { title: 'Clients' } },
            common: { loading: 'Loading...' },
        }, null, 2));
        write(path.join(frontendDir, 'clients.html'), '<h1 data-i18n="page.clients.title"></h1>');
        write(path.join(frontendDir, 'js', 'clients.js'), 't("common.loading");');

        const result = runUsedKeyCheck({
            repoRoot: tempRoot,
            frontendDir,
            localesDir,
            baselineLocale: 'en',
        });

        assert.equal(result.ok, true);
        assert.deepEqual(result.missingEntries, []);
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('used-key checker fails when frontend references keys absent in en baseline', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-used-fail-'));
    const frontendDir = path.join(tempRoot, 'app', 'frontend');
    const localesDir = path.join(frontendDir, 'locales');

    try {
        write(path.join(localesDir, 'en.json'), JSON.stringify({
            page: { clients: { title: 'Clients' } },
        }, null, 2));
        write(path.join(frontendDir, 'clients.html'), '<button data-i18n="page.clients.actions.delete"></button>');
        write(path.join(frontendDir, 'js', 'clients.js'), 't("page.clients.actions.edit");');

        const result = runUsedKeyCheck({
            repoRoot: tempRoot,
            frontendDir,
            localesDir,
            baselineLocale: 'en',
        });

        assert.equal(result.ok, false);
        assert.deepEqual(
            result.missingEntries.map(([key]) => key),
            ['page.clients.actions.delete', 'page.clients.actions.edit'],
        );
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

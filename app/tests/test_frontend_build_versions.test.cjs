const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const frontendDir = path.join(__dirname, '..', 'frontend');
const htmlPages = [
    'index.html',
    'clients.html',
    'chart.html',
    'forecast.html',
    'natal-full.html',
    'login.html',
    'calendar.html',
];

test('frontend html pages keep local asset versions aligned with __APP_BUILD_ID__', () => {
    for (const page of htmlPages) {
        const html = fs.readFileSync(path.join(frontendDir, page), 'utf8');
        const buildIdMatch = html.match(/window\.__APP_BUILD_ID__ = '([^']+)'/);

        assert.ok(buildIdMatch, `${page} is missing __APP_BUILD_ID__`);
        const buildId = buildIdMatch[1];
        assert.ok(buildId.length > 0, `${page} has an empty __APP_BUILD_ID__`);

        const localAssetMatches = html.match(/(?:bundles\/[^"'?]+\.bundle\.css|js\/bundles\/[^"'?]+\.bundle\.js|css\/locale-switcher\.css|js\/locale-switcher\.js)\?v=([^"' ]+)/g) || [];
        assert.ok(localAssetMatches.length > 0, `${page} does not reference any versioned local assets`);

        for (const asset of localAssetMatches) {
            const [, version] = asset.match(/\?v=([^"' ]+)/) || [];
            assert.equal(version, buildId, `${page} has asset version ${version} that does not match build id ${buildId}`);
        }
    }
});

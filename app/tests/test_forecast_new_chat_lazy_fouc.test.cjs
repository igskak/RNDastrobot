const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('forecast-new keeps lazy chat markup out of the first paint', () => {
    const html = read('frontend/forecast-new.html');
    const css = read('frontend/css/forecast-new.css');

    for (const id of [
        'chatToggle',
        'chatVoiceCommand',
        'chatNotesToggle',
        'chatVoiceMiniStatus',
        'chatWidget',
    ]) {
        assert.match(
            html,
            new RegExp(`id="${id}"[^>]*data-chat-lazy`),
            `${id} should stay guarded while chat CSS is loading`,
        );
    }
    assert.match(
        css,
        /\.forecast-new-page \[data-chat-lazy\]\s*{\s*display:\s*none !important;/,
        'the eager forecast stylesheet should hide guarded chat markup',
    );
});

test('forecast-new reveals chat only after its lazy CSS and module are ready', () => {
    const entry = read('frontend/entries/forecast-new.entry.js');

    assert.match(entry, /await loadStylesheetOnce\(`\/bundles\/chat-widget\.bundle\.css\$\{version\}`\)/);
    assert.match(entry, /await import\('\.\.\/js\/chat\.js'\)/);
    assert.match(entry, /querySelectorAll\('\[data-chat-lazy\]'\)[\s\S]*removeAttribute\('data-chat-lazy'\)/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('CI workflow wires i18n checkers before regression tests', () => {
    const workflowPath = path.resolve(__dirname, '../../.github/workflows/ci.yml');
    assert.equal(fs.existsSync(workflowPath), true, 'CI workflow file is missing');

    const content = fs.readFileSync(workflowPath, 'utf8');
    const missingCmd = 'node app/scripts/check-i18n-missing-keys.cjs';
    const hardcodedCmd = 'node app/scripts/check-i18n-hardcoded-strings.cjs';
    const untranslatedCmd = 'node app/scripts/check-i18n-untranslated-values.cjs';
    const frontendTestsCmd = 'app/tests/test_frontend_i18n.test.cjs';
    const backendTestsCmd = 'python -m pytest -q app/tests';

    assert.ok(content.includes(missingCmd), 'Missing-key checker is not wired in CI');
    assert.ok(content.includes(hardcodedCmd), 'Hardcoded checker is not wired in CI');
    assert.ok(content.includes(untranslatedCmd), 'Untranslated-value checker is not wired in CI');
    assert.ok(content.includes(frontendTestsCmd), 'Frontend regression tests are not wired in CI');
    assert.ok(content.includes(backendTestsCmd), 'Python regression suite is not wired in CI');

    const missingIndex = content.indexOf(missingCmd);
    const hardcodedIndex = content.indexOf(hardcodedCmd);
    const untranslatedIndex = content.indexOf(untranslatedCmd);
    const frontendTestsIndex = content.indexOf(frontendTestsCmd);
    const backendTestsIndex = content.indexOf(backendTestsCmd);

    assert.ok(missingIndex >= 0 && hardcodedIndex >= 0 && untranslatedIndex >= 0, 'Checker commands not found');
    assert.ok(frontendTestsIndex > untranslatedIndex, 'Frontend tests must run after i18n checkers');
    assert.ok(backendTestsIndex > untranslatedIndex, 'Python tests must run after i18n checkers');
});

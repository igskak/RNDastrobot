const test = require('node:test');
const assert = require('node:assert/strict');

const actions = require('../frontend/js/forecast-range-actions.js');

function makeAction() {
    return {
        attrs: {},
        setAttribute(name, value) { this.attrs[name] = String(value); },
        removeAttribute(name) { delete this.attrs[name]; },
    };
}

function makeRoot() {
    const items = [makeAction(), makeAction()];
    const hint = {
        hidden: false,
        classList: { toggle(_name, value) { hint.hidden = value; } },
    };
    return {
        items,
        hint,
        querySelectorAll() { return items; },
        querySelector() { return hint; },
    };
}

test('range actions remain visible but become inaccessible to activation in single mode', () => {
    const root = makeRoot();
    actions.sync(root, true);
    for (const item of root.items) {
        assert.equal(item.attrs['aria-disabled'], 'true');
        assert.equal(item.attrs.tabindex, '-1');
    }
    assert.equal(root.hint.hidden, false);
});

test('range actions become keyboard-accessible in multi mode', () => {
    const root = makeRoot();
    actions.sync(root, true);
    actions.sync(root, false);
    for (const item of root.items) {
        assert.equal(item.attrs['aria-disabled'], 'false');
        assert.equal('tabindex' in item.attrs, false);
    }
    assert.equal(root.hint.hidden, true);
});

test('disabled click targets are recognized for navigation blocking', () => {
    assert.equal(actions.isDisabledTarget({ closest: () => ({}) }), true);
    assert.equal(actions.isDisabledTarget({ closest: () => null }), false);
    assert.equal(actions.isDisabledTarget(null), false);
});

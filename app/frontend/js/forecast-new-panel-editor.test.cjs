'use strict';

const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'forecast-new.js'), 'utf8');
const forecastCss = fs.readFileSync(path.join(__dirname, '../css/forecast-new.css'), 'utf8');

let pass = 0;
let fail = 0;

function ok(condition, message) {
    if (condition) pass++;
    else {
        fail++;
        console.error('FAIL:', message);
    }
}

ok(
    source.includes("dialog = document.createElement('div');")
        && source.includes("dialog.setAttribute('role', 'dialog');"),
    'panel confirmations use the managed modal container'
);
ok(
    !source.includes("dialog = document.createElement('dialog');")
        && !source.includes('dialog.showModal()'),
    'panel confirmations do not depend on native dialog state'
);
[
    'data-pe-dialog-title',
    'data-pe-dialog-copy',
    'data-pe-dialog-input-wrap',
    'data-pe-dialog-input',
    'data-pe-dialog-cancel',
    'data-pe-dialog-confirm',
].forEach((attribute) => {
    ok(source.includes(attribute), `panel dialog contains ${attribute}`);
});
ok(
    /case 'load-preset':[\s\S]*?applyPanelLayout\(preset\.layout\);\s*renderPanelEditor\(\);/.test(source),
    'loading a preset refreshes the visible editor'
);
ok(
    /handleEditorAction\(btn\.dataset\.peAction, \{ \.\.\.btn\.dataset \}\)/.test(source),
    'click actions receive a stable dataset snapshot'
);
ok(
    source.includes("const previousBodyScrollTop = editor.querySelector('.forecast-new-pe-body')?.scrollTop || 0;")
        && source.includes("if (body && previousBodyScrollTop > 0) body.scrollTop = previousBodyScrollTop;"),
    'panel editor preserves its scroll position after re-rendering'
);
ok(
    /requiredSelectors\.every\(\(selector\) => dialog\.querySelector\(selector\)\)/.test(source)
        && source.includes('dialog?.remove();'),
    'a stale malformed panel dialog is rebuilt before use'
);
ok(
    source.includes('function positionAddLayerMenu(menu, toggle)')
        && source.includes("menu.classList.add('forecast-new-add-layer-menu--floating')")
        && forecastCss.includes('.forecast-new-add-layer-menu--floating')
        && forecastCss.includes('position: fixed;'),
    'add-layer dropdown is positioned outside the scroll-clipped layer tabs'
);
ok(
    /if \(method === 'solar_return'\) \{\s*return buildSolarMomentMeta\(selectedViewModelLayer\(\)\?\.raw\?\.solar_info, \{ year: state\.solarYear \}\);\s*\}/.test(source),
    'solar right-panel meta uses the full computed solar moment'
);
ok(
    !source.includes('function renderSolarYearStepper')
        && !source.includes('renderSolarYearStepper()')
        && !source.includes('data-solar-year-step')
        && /syncMomentCardLayout\(\);\s*renderOrUpdateTimeStepper\(\);/.test(source),
    'solar right-panel uses the shared date/time stepper instead of a year-only stepper'
);
ok(
    source.includes('function bindTimeStepperSpinInput(root, stepHandler)')
        && source.includes("root.addEventListener('wheel', (event) => {")
        && source.includes("root.addEventListener('touchmove', (event) => {")
        && source.includes('TIME_STEPPER_WHEEL_DELTA_THRESHOLD')
        && source.includes('TIME_STEPPER_SWIPE_STEP_PX'),
    'date/time stepper digits support wheel and mobile swipe input'
);
ok(
    forecastCss.includes('touch-action: pan-x;')
        && forecastCss.includes('cursor: ns-resize;')
        && forecastCss.includes('.forecast-new-time-stepper-segment.is-spinning'),
    'date/time stepper segments expose a stable gesture surface'
);
ok(
    forecastCss.includes('.forecast-new-single-mode .forecast-new-header .forecast-new-header-actions')
        && /\.forecast-new-single-mode \.forecast-new-header \.forecast-new-header-actions\s*\{\s*margin-left: auto;\s*\}/.test(forecastCss),
    'single-wheel header actions stay aligned to the right when layer tabs are hidden'
);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

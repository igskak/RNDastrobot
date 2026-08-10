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
    /function buildResultLayerMeta\(method, layer\) \{[\s\S]*?if \(method === 'solar_return'\) \{[\s\S]*?return buildSolarMomentMeta\(raw\.solar_info, \{ year: state\.solarYear \}\);\s*\}/.test(source),
    'solar result meta uses the full computed solar moment'
);
ok(
    /function buildPrognosticMomentSummary\(\) \{[\s\S]*?if \(isSwapDemotedNatalSelected\(\)\) \{[\s\S]*?return natalCardIdentity\(\)\.summary;[\s\S]*?if \(method === 'solar_return'\) \{[\s\S]*?return buildSolarPanelLocationMeta\(info, \{ date: solarDate, time: solarTime \}\);[\s\S]*?\}/.test(source),
    'side panel header meta excludes date/time for demoted natal and solar'
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

// --- moving a block back out of a chart corner -------------------------------
// findBlockLocation returns { corner } (no `tab`) when the block sits in a
// corner widget; reading location.tab.id there threw and the "add block"
// select silently did nothing.
ok(
    source.includes('const isSameTab = Boolean(location?.tab) && location.side === side && location.tab.id === tabId;')
        && /if \(location && !isSameTab\) \{[\s\S]{0,200}?blockLocationLabel\(location, mode\)/.test(source),
    'add-block handles a block that currently lives in a chart corner'
);
ok(
    /case 'clear-corner': \{[\s\S]*?announceCornerReturn\(restored, mode\);/.test(source)
        && source.includes('function announceCornerReturn(block, mode)'),
    'closing a corner widget reports where the block went'
);

// --- empty tabs are dropped, not labelled "Пусто" ----------------------------
ok(
    source.includes('function pruneEmptiedTabs(layout, mode, emptiedTabIds)')
        && /if \(before > 0 && tab\.blocks\.length === 0\) emptied\.add\(tab\.id\);/.test(source)
        && /tab\.blocks = tab\.blocks\.filter\(\(b\) => \(b\.source \+ ':' \+ b\.view\) !== ds\.blockkey\);\s*if \(tab\.blocks\.length === 0\) pruneEmptiedTabs\(l, mode, new Set\(\[tab\.id\]\)\);/.test(source),
    'a tab that loses its last block is removed from the panel'
);

// --- corner widgets keep their interactions ----------------------------------
ok(
    source.includes("const workspace = document.getElementById('forecastNewLayout') || document.body;")
        && source.includes('bindPlanetTableInteractions(workspace);')
        && source.includes('bindHouseTableInteractions(workspace);')
        && source.includes('function blockScopeOf(node)')
        && source.includes("closest?.('[data-block-source]')"),
    'planet/house interactions are bound above both panels and the chart corners'
);

// --- hovering a configuration highlights it on the wheel ---------------------
ok(
    source.includes('function bindConfigurationHover(root)')
        && source.includes('state.wheel?.setHoveredConfiguration?.({ aspectKeys, planets })')
        && forecastCss.includes('.forecast-new-page .config-card--hovered'),
    'hovering an aspect configuration highlights it on the chart'
);

// --- aspect line bodies are read via getAttribute --------------------------
// `data-planet-1` does NOT fold into `dataset.planet1` (a dash before a digit
// is not camel-cased), so the old reads were silently undefined and neither
// planet hover nor aspect hover ever highlighted the bodies.
const wheelSource = fs.readFileSync(path.join(__dirname, 'prognostic-rings-wheel.js'), 'utf8');
ok(
    wheelSource.includes('aspectLineBodies(line)')
        && wheelSource.includes("line.getAttribute('data-planet-1')")
        && !/line\??\.dataset\.planet[12]/.test(wheelSource),
    'aspect line bodies are read through getAttribute, not the camelCase dataset key'
);
ok(
    wheelSource.includes('createAspectEndpoints({ geometry, color, isMajor })')
        && wheelSource.includes("class: 'aspect-endpoint'"),
    'cross-chart aspect lines get an endpoint marker on the non-natal side'
);
// Соединение рисуется «скобкой»: концы остаются на телах, вершина уходит
// внутрь круга. Отдельно проверяем, что метка НЕ отрывается от планет —
// именно так выглядел отвергнутый вариант с радиальным сдвигом всей линии.
ok(
    /apexDepth: 16/.test(wheelSource)
        && wheelSource.includes('aspectBracketPath(geometry)')
        && /M \$\{geometry\.x1\} \$\{geometry\.y1\} L \$\{geometry\.apexX\}/.test(wheelSource)
        && !/radialInset/.test(wheelSource),
    'a conjunction is drawn as a bracket anchored to both bodies, not a detached stub'
);
ok(
    !/drawDot|aspect-dot|dotRadius: 4/.test(wheelSource),
    'the old free-floating conjunction dot is gone'
);

// --- the synastry partner ring reads the NATAL body matrix -----------------
// It is another person's natal chart, not a prognostic layer. Reading the
// prognostic matrix meant a body switched off for transits (e.g. Venus)
// silently dropped out of synastry together with all of its aspects.
ok(
    /static NATAL_MATRIX_METHODS = new Set\(\['natal', 'synastry_partner'\]\)/.test(wheelSource)
        && wheelSource.includes('PrognosticRingsWheel.NATAL_MATRIX_METHODS.has(method)'),
    'synastry partner bodies are gated by the natal matrix, not the prognostic one'
);

// --- corner widgets show the whole list, not the first 6 rows ---------------
ok(
    !/is-compact\[data-corner-view="(aspects|configs|stelliums)"\][^{]*nth-child\(n\+7\)/.test(forecastCss)
        && forecastCss.includes('.forecast-new-corner > .is-compact.has-scroll-below'),
    'a corner widget renders the full list and relies on scrolling instead of hiding rows'
);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

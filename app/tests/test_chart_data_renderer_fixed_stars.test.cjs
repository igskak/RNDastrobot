const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function loadRenderer(dom) {
    dom.window.Symbols = {
        readSavedHouseNumberStyle: () => 'arabic',
        signs: { Leo: '♌' },
        signNamesRu: { Leo: 'Leo' },
        signElements: { Leo: 'fire' },
        elementColors: { fire: '#dc2626' },
        planets: { Sun: '☉' },
        planetNamesRu: { Sun: 'Sun' },
        planetGlyphScale: {},
        getPlanetSymbol: (name) => ({ Sun: '☉' }[name] || ''),
        getPlanetSymbolMarkup: (name) => `<span>${name}</span>`,
    };
    dom.window.FrontendI18n = { t: (key) => key };
    dom.window.eval(fs.readFileSync(path.join(__dirname, '../frontend/js/chart-data.js'), 'utf8'));
    return dom.window.ChartDataRenderer;
}

test('fixed star table rerender restores matrix cells and renders star badge', () => {
    const dom = new JSDOM('<!DOCTYPE html><body><table><tbody id="planetsTable"></tbody></table></body>', {
        runScripts: 'outside-only',
    });
    const { document } = dom.window;
    const ChartDataRenderer = loadRenderer(dom);

    const restoreMatrixCells = () => {
        document.querySelectorAll('.forecast-new-matrix-inline-cell').forEach((cell) => cell.remove());
        document.querySelectorAll('#planetsTable tr[data-planet]').forEach((row) => {
            row.insertAdjacentHTML('beforeend', `
                <td class="forecast-new-matrix-inline-cell"><input type="checkbox" checked></td>
                <td class="forecast-new-matrix-inline-cell"><input type="checkbox" checked></td>
            `);
        });
    };

    const renderer = new ChartDataRenderer({
        planetsTableId: 'planetsTable',
        showSpeedColumn: true,
        showHouseColumn: false,
        onPlanetsRendered: restoreMatrixCells,
    });
    renderer.render({
        planets: [{ name: 'Sun', sign: 'Leo', degree_in_sign: 15.25, speed_percent: 100 }],
        houses: [],
        aspects: [],
        aspect_configurations: [],
        stelliums: [],
        balances: null,
    });

    renderer.setFixedStarsData({
        stars: [
            {
                name: 'Regulus',
                sign: 'Leo',
                degree_in_sign_formatted: "29°50'",
                designation: 'alpha Leo',
                magnitude: 1.4,
                nature: 'Mars Jupiter',
            },
        ],
        conjunctions: [
            {
                object: 'Sun',
                star: 'Regulus',
                orb: 0.2,
                object_sign: 'Leo',
                object_degree_in_sign_formatted: "15°15'",
            },
        ],
    }, { showBadges: true });

    const row = document.querySelector('#planetsTable tr[data-planet="Sun"]');
    assert.ok(row, 'planet row should exist after fixed-star rerender');
    assert.equal(row.querySelectorAll('td').length, 5, 'matrix checkbox cells should be restored');
    assert.equal(row.querySelectorAll('.forecast-new-matrix-inline-cell input').length, 2);

    const badge = row.querySelector('.fixed-star-badge');
    assert.ok(badge, 'star badge should render beside the planet coordinate');
    assert.match(badge.dataset.fixedStarTooltip, /Regulus/);
});

/**
 * Конфигурации и стеллиумы — один блок (фидбек астролога, п.8).
 * Заодно фиксируем п.5 (без «Силы») и п.7 (без иконки перед названием).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function loadRenderer(dom) {
    dom.window.Symbols = {
        readSavedHouseNumberStyle: () => 'arabic',
        signs: { Leo: '♌' },
        signNamesRu: { Leo: 'Лев' },
        signElements: { Leo: 'fire' },
        elementColors: { fire: '#dc2626' },
        planets: { Sun: '☉', Mars: '♂', Jupiter: '♃' },
        planetNamesRu: { Sun: 'Солнце', Mars: 'Марс', Jupiter: 'Юпитер' },
        planetGlyphScale: {},
        configIcons: { T_Square: '⊥' },
        getPlanetSymbol: (name) => name[0],
        getPlanetSymbolMarkup: (name) => `<span>${name}</span>`,
        formatHouseLabel: (n) => String(n),
    };
    dom.window.FrontendI18n = { t: (key) => key };
    dom.window.eval(fs.readFileSync(path.join(__dirname, '../frontend/js/chart-data.js'), 'utf8'));
    return dom.window.ChartDataRenderer;
}

function renderInto(configurations, stelliums) {
    const dom = new JSDOM('<!DOCTYPE html><body><div id="configurationsContainer"></div></body>', {
        runScripts: 'outside-only',
    });
    const ChartDataRenderer = loadRenderer(dom);
    const renderer = new ChartDataRenderer({ configsContainerId: 'configurationsContainer' });
    renderer.renderConfigurations(configurations, stelliums);
    return dom.window.document.getElementById('configurationsContainer');
}

const CONFIGS = [
    { type: 'T_Square', strength_score: 80, planets_involved: ['Sun', 'Mars', 'Jupiter'], apex_planet: 'Mars', aspects: [] },
];
const STELLIUMS = [
    { type: 'sign', sign: 'Leo', count: 3, planets: ['Sun', 'Mars', 'Jupiter'] },
];

test('стеллиумы рендерятся в тот же контейнер, что и конфигурации', () => {
    const container = renderInto(CONFIGS, STELLIUMS);
    assert.equal(container.querySelectorAll('.config-card').length, 2);
    const headings = [...container.querySelectorAll('h3')].map((h) => h.textContent.trim());
    assert.ok(headings.includes('page.chart.configurations.stelliums'), 'есть подзаголовок «Стеллиумы»');
});

test('раздельный контейнер для стеллиумов больше не поддерживается', () => {
    const dom = new JSDOM('<!DOCTYPE html><body><div id="configurationsContainer"></div></body>', {
        runScripts: 'outside-only',
    });
    const ChartDataRenderer = loadRenderer(dom);
    const renderer = new ChartDataRenderer({ configsContainerId: 'configurationsContainer' });
    assert.equal(renderer.stelliumsContainer, undefined);
});

test('у карточки конфигурации нет ни бейджа силы, ни иконки перед названием', () => {
    const container = renderInto(CONFIGS, []);
    const card = container.querySelector('.config-card');
    assert.equal(card.querySelector('.config-strength-badge'), null, 'бейдж силы убран (п.5)');
    assert.equal(card.querySelector('h4').textContent.trim(), 'T Square');
    assert.ok(!card.querySelector('h4').innerHTML.includes('⊥'), 'иконка конфигурации убрана (п.7)');
});

test('у стеллиума остаётся счётчик планет — это количество, а не сила', () => {
    const container = renderInto([], STELLIUMS);
    const card = container.querySelector('.config-card');
    assert.ok(card.querySelector('.config-strength-badge'), 'счётчик стеллиума на месте');
});

test('пустые данные дают одну заглушку', () => {
    const container = renderInto([], []);
    assert.equal(container.querySelectorAll('.config-card').length, 0);
    assert.ok(container.textContent.includes('page.chart.empty.noConfigurations'));
});

const assert = require('node:assert/strict');
const test = require('node:test');

const model = require('../frontend/js/account-settings-model.js');

test('two-type settings use natal and forecast with biwheel fallback', () => {
    const fallback = model.buildUiChartDefaults({
        natal: { id: 'natal' },
        biwheel: { id: 'biwheel' },
    });
    assert.equal(fallback.single.id, 'natal');
    assert.equal(fallback.double.id, 'biwheel');

    const forecast = model.buildUiChartDefaults({
        natal: { id: 'natal' },
        biwheel: { id: 'biwheel' },
        forecast_new: { id: 'forecast' },
    });
    assert.equal(forecast.double.id, 'forecast');
});

test('two-type settings deep-merge controlled fields without losing forecast state', () => {
    const existing = {
        natal: { panels: { left: ['a'] }, view_options: { point_scale: 1.2 } },
        solar: { solar_only: true },
        biwheel: { biwheel_only: true },
        forecast_new: {
            panels: { left: ['planets'], right: ['aspects'] },
            panel_presets: [{ id: 'dense' }],
            matrix: {
                schema_version: 2,
                prognostic_rows: { Mars: { display: false, aspecting: true } },
            },
        },
    };
    const result = model.buildTechnicalChartDefaults(
        existing,
        { view_options: { orientation: 'asc' }, aspects: { scope: 'major' } },
        { table_options: { show_speed: false } },
        { table_options: { show_speed: true }, matrix: { rows: { Sun: { display: false } } } },
    );

    assert.equal(result.natal.table_options.show_speed, false);
    assert.equal(result.solar.table_options.show_speed, false);
    assert.equal(result.biwheel.table_options.show_speed, true);
    assert.equal(result.forecast_new.table_options.show_speed, true);
    assert.deepEqual(result.forecast_new.panels, existing.forecast_new.panels);
    assert.deepEqual(result.forecast_new.panel_presets, existing.forecast_new.panel_presets);
    assert.deepEqual(result.forecast_new.matrix.prognostic_rows, existing.forecast_new.matrix.prognostic_rows);
    assert.equal(result.forecast_new.matrix.rows.Sun.display, false);
    assert.equal(result.forecast_new.aspects.scope, 'major');
});

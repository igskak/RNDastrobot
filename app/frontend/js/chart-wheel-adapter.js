/**
 * ChartWheelUnified — адаптер совместимости W5 (Фаза W, план UNIFIED_WORKSPACE_PIVOT_PLAN.md).
 *
 * Экспонирует API ChartWheel (draw/set*Options/setAspectFilter/applyMatrixRows) поверх
 * единого движка PrognosticRingsWheel: одиночная карта = его 1-кольцевой режим (D6).
 * chart.js мигрирует заменой конструктора; формат aspect-key и custom-события (chart:*)
 * у движков идентичны, поэтому интерактив со страничными таблицами сохраняется.
 * После подтверждения паритета chart-wheel.js уходит на пенсию (W6).
 */
(function () {
    'use strict';

    class ChartWheelUnified {
        constructor(svgElement) {
            const Engine = window.PrognosticRingsWheel;
            if (!Engine) throw new Error('ChartWheelUnified: PrognosticRingsWheel is not loaded');
            this.engine = new Engine(svgElement);
            this.svg = svgElement;
            this.chartData = null;
            // Паритет одиночной карты: маркеры углов включены (в ChartWheel они есть всегда)
            this.engine.setOptions({ showAngleMarkers: true, minimumRingCount: 1 });
        }

        _redraw(redraw) {
            if (redraw !== false && this.chartData) this.draw(this.chartData);
        }

        setOrientationMode(mode, options = {}) {
            this.engine.setOptions({ orientation: mode });
            this._redraw(options.redraw);
        }

        setPointScales(scales = {}, options = {}) {
            this.engine.setOptions({ planetScale: scales.planets, pointScale: scales.points });
            this._redraw(options.redraw);
        }

        setPlanetAnnotationOptions(opts = {}, options = {}) {
            this.engine.setOptions({
                showPlanetStationary: opts.showStationary === true,
                showPlanetDegree: opts.showDegree === true,
                showAspectText: opts.showAspectText === true,
            });
            this._redraw(options.redraw);
        }

        setHouseLabelOptions(opts = {}, options = {}) {
            this.engine.setOptions({
                houseNumberStyle: opts.style,
                houseLabelsOutside: opts.outside === true,
            });
            this._redraw(options.redraw);
        }

        setAngleMarkerOptions(opts = {}, options = {}) {
            this.engine.setOptions({
                angleAscDscBold: opts.ascDscBold !== false,
                angleMcIcBold: opts.mcIcBold !== false,
            });
            this._redraw(options.redraw);
        }

        applyMatrixRows(rows) {
            this.engine.applyMatrixRows(rows || {});
        }

        setAspectFilter(filter) {
            // ChartWheel.setAspectFilter хранит фильтр и перерисовывает из кэша — зеркалим
            this.engine.setOptions({ aspectScope: filter });
            this._redraw(true);
        }

        draw(chartData) {
            this.chartData = chartData;
            const normalizer = window.PrognosticLayerNormalizer;
            if (!normalizer?.buildViewModel) throw new Error('ChartWheelUnified: PrognosticLayerNormalizer is not loaded');
            const viewModel = normalizer.buildViewModel(chartData, {}, { activeMethods: [] });
            this.engine.render(viewModel);
        }
    }

    if (typeof window !== 'undefined') window.ChartWheelUnified = ChartWheelUnified;
    if (typeof module !== 'undefined' && module.exports) module.exports = { ChartWheelUnified };
})();

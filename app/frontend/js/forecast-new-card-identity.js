(function() {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────────
    // Единый источник «идентичности карты» (заголовок + сводка + дата/время)
    // для панелей рабочего экрана. До этого модуля идентичность считалась в ≥5
    // расходящихся местах (selectedPanelTitle, layerInstanceChipLabel,
    // swapPromotedChartView, updateNatalMomentMeta, renderSingleNatalRightPanel),
    // из-за чего имя партнёра в синастрии бралось из ГЛОБАЛЬНОГО scratch
    // (state.synastryManual), а не из конфига/загруженных данных конкретного
    // инстанса — отсюда «неверные имена» и «перемешанные данные» при свопе.
    //
    // Функции чистые: всё состояние и хелперы форматирования инъектируются, так
    // что модуль тестируется в чистом Node (см. prognostic-layer-normalizer.js).
    // ─────────────────────────────────────────────────────────────────────────

    function firstLastName(bd = {}) {
        return [bd.first_name, bd.last_name].filter(Boolean).join(' ').trim();
    }

    // Имя партнёра синастрии из КОНКРЕТНОГО инстанса: сначала явно заданный
    // заголовок карты, затем имя ручного партнёра из конфига инстанса, затем имя
    // из загруженной partner_chart. Глобальный state.synastryManual НЕ читаем.
    function synastryPartnerName({ config = {}, raw = {} } = {}, helpers = {}) {
        const { chartDisplayTitle } = helpers;
        const chart = raw.partner_chart || raw.partnerChart || {};
        const bd = chart.birth_data || {};
        const manual = config.manual || {};
        return config.chartTitle
            || manual.name
            || (chartDisplayTitle ? chartDisplayTitle(chart) : '')
            || firstLastName(bd)
            || '';
    }

    // {title, summary, datetimeLabel} для повышаемого/выбранного слоя.
    // - synastry_partner: имя/место партнёра из его конфига и загруженной карты.
    // - solar_return: шапка панели показывает место/TZ; сам момент живёт в степпере.
    // - моментные методы (transit/progression/direction): только заголовок; сводку
    //   и дату/время момента считает вызывающий (живой момент из степпера).
    function buildLayerCardIdentity({ method, config = {}, raw = {}, solarYearFallback } = {}, helpers = {}) {
        const {
            layerLabel, formatChartDate, formatChartDateTimeLabel,
            buildPanelLocationMeta, buildSolarPanelLocationMeta,
        } = helpers;
        const label = layerLabel ? layerLabel(method) : String(method || '');
        const fmtDate = (value) => (value ? (formatChartDate ? formatChartDate(value) : value) : '');

        if (method === 'synastry_partner') {
            const chart = raw.partner_chart || raw.partnerChart || {};
            const bd = chart.birth_data || {};
            const datetimeLabel = [fmtDate(bd.date), bd.time].filter(Boolean).join(' ');
            const summary = buildPanelLocationMeta
                ? buildPanelLocationMeta(bd.place, bd.timezone, { date: bd.date, time: bd.time })
                : (bd.place || '');
            return {
                title: synastryPartnerName({ config, raw }, helpers) || label,
                summary,
                datetimeLabel,
            };
        }

        if (method === 'solar_return') {
            const info = raw.solar_info || {};
            const [solarDate, solarClock] = String(info.solar_datetime_local || '').split('T');
            const solarTime = String(solarClock || '').slice(0, 5);
            const summary = buildSolarPanelLocationMeta
                ? buildSolarPanelLocationMeta(info, { date: solarDate, time: solarTime })
                : (buildPanelLocationMeta
                    ? buildPanelLocationMeta(info?.location?.name, info.timezone, { date: solarDate, time: solarTime })
                    : '');
            return {
                title: config.chartTitle || label,
                summary,
                datetimeLabel: [fmtDate(solarDate), solarTime].filter(Boolean).join(' '),
            };
        }

        return {
            title: config.chartTitle || label,
            summary: '',
            datetimeLabel: config.datetime
                ? (formatChartDateTimeLabel ? formatChartDateTimeLabel(config.datetime) : String(config.datetime))
                : '',
        };
    }

    // {title, summary, datetimeLabel} для натальной карты.
    // summary — «место · TZ» (форма шапок боковых панелей, без даты — дата живёт в
    // степпере/карточке-редакторе рядом). momentSummary остаётся для не-header
    // потребителей, которым нужен полный момент.
    function buildNatalCardIdentity(input = {}, helpers = {}) {
        const {
            natalData = {}, natalSelectedDateTime, natalTimezone, natalLocationName, fallbackTitle,
        } = input;
        const {
            chartDisplayTitle, formatChartDateTimeLabel, buildPanelLocationMeta,
        } = helpers;
        const birth = natalData.birth_data || {};
        const locationName = natalLocationName || birth.place || '';
        const timezone = natalTimezone || birth.timezone;
        const title = chartDisplayTitle
            ? chartDisplayTitle(natalData, fallbackTitle || '')
            : (firstLastName(birth) || fallbackTitle || '');
        const datetimeLabel = formatChartDateTimeLabel
            ? formatChartDateTimeLabel(natalSelectedDateTime)
            : String(natalSelectedDateTime || '');
        const summary = buildPanelLocationMeta
            ? buildPanelLocationMeta(locationName, timezone, natalSelectedDateTime)
            : locationName;
        const momentSummary = [datetimeLabel, summary].filter(Boolean).join(' · ');
        return { title, summary, momentSummary, datetimeLabel };
    }

    // Роли панелей — единственное место, решающее, КАКАЯ карта в КАКОЙ панели.
    // crossed === true (своп): слева повышенная карта, справа понижённый натал.
    // Иначе: слева натал, справа выбранный слой. Заголовки/меты берутся из
    // идентичностей, поэтому левый и правый писатель не могут «разъехаться».
    //   layerMeta — динамическая мета выбранного слоя справа (живой момент/соляр),
    //   считается вызывающим только для не-своп случая.
    //   formatSwapBaseTitle(name) — обёртка i18n «База: {name}» для повышенной карты.
    function computePanelRoles({ crossed, natalIdentity, layerIdentity, layerMeta, formatSwapBaseTitle } = {}) {
        const nat = natalIdentity || {};
        const lay = layerIdentity || {};
        const wrap = typeof formatSwapBaseTitle === 'function' ? formatSwapBaseTitle : ((s) => s);
        if (crossed) {
            return {
                crossed: true,
                left: { kind: 'layer', title: wrap(lay.title || ''), meta: lay.summary || '' },
                right: { kind: 'natal', title: nat.title || '', meta: nat.summary || '' },
            };
        }
        return {
            crossed: false,
            left: { kind: 'natal', title: nat.title || '', meta: nat.summary || '' },
            right: { kind: 'layer', title: lay.title || '', meta: layerMeta || '' },
        };
    }

    // Тупой писатель: раскладывает роли по узлам шапок панелей. Пишет только те
    // стороны, что переданы (левый и правый писатели вызывают его раздельно).
    // Отдельно тестируется в jsdom против реального forecast-new.html.
    function applyPanelHeaderRoles(doc, roles) {
        if (!doc || !roles) return;
        const set = (id, text) => { const el = doc.getElementById(id); if (el) el.textContent = text || ''; };
        if (roles.left) {
            set('natalPanelTitle', roles.left.title);
            set('natalPanelMeta', roles.left.meta);
        }
        if (roles.right) {
            set('prognosticPanelTitle', roles.right.title);
            set('prognosticPanelMeta', roles.right.meta);
        }
    }

    const api = {
        firstLastName,
        synastryPartnerName,
        buildLayerCardIdentity,
        buildNatalCardIdentity,
        computePanelRoles,
        applyPanelHeaderRoles,
    };

    if (typeof window !== 'undefined') window.ForecastCardIdentity = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();

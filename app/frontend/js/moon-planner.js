/* Printable moon planner: the dates are in the page language's home time zone in the HTML (for
   search engines and no-script); this picks the visitor's own zone and lets them change it.
   All visible text comes from the catalog embedded in the page (#moon-i18n). */
(function () {
    'use strict';

    var ui = JSON.parse(document.getElementById('moon-i18n').textContent);
    var select = document.getElementById('planner-tz');
    var note = document.getElementById('planner-times');
    var printButton = document.getElementById('planner-print');
    if (!select) return;

    function fill(template, values) {
        return String(template).replace(/\{(\w+)\}/g, function (_, key) { return values[key]; });
    }

    function zoneName(zone) {
        var styles = ['longGeneric', 'long'];
        for (var i = 0; i < styles.length; i++) {
            try {
                var parts = new Intl.DateTimeFormat(ui.intl, { timeZone: zone, timeZoneName: styles[i] }).formatToParts(new Date());
                var name = parts.filter(function (part) { return part.type === 'timeZoneName'; })[0];
                if (name && name.value) return name.value;
            } catch (e) { /* try the next style */ }
        }
        return zone.replace(/_/g, ' ');
    }

    function formatMoment(utc, zone) {
        var parts = {};
        new Intl.DateTimeFormat('en-US', {
            timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
        }).formatToParts(new Date(utc)).forEach(function (part) { parts[part.type] = part.value; });
        var hour = Number(parts.hour) % 24;
        var pad = function (n) { return (n < 10 ? '0' : '') + n; };
        return fill(ui.tableDateFormat, {
            d: Number(parts.day), y: Number(parts.year), month: ui.months[Number(parts.month) - 1],
            hh: pad(hour), mm: pad(Number(parts.minute)), h12: hour % 12 || 12, ampm: hour < 12 ? 'AM' : 'PM',
        });
    }

    function apply(zone) {
        try {
            [].forEach.call(document.querySelectorAll('.planner-item[data-utc]'), function (item) {
                var time = item.querySelector('time');
                if (time) time.textContent = formatMoment(item.getAttribute('data-utc'), zone);
            });
            if (note) note.textContent = fill(ui.timesNote, { tz: zoneName(zone) });
        } catch (e) { /* the page's own zone stays */ }
    }

    var viewerZone = null;
    try { viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e) { /* keep the page's zone */ }
    if (viewerZone) {
        var known = [].some.call(select.options, function (option) { return option.value === viewerZone; });
        if (!known) {
            var extra = document.createElement('option');
            extra.value = viewerZone;
            extra.textContent = viewerZone;
            select.insertBefore(extra, select.firstChild);
        }
        select.value = viewerZone;
        if (viewerZone !== ui.tableTimezone) apply(viewerZone);
    }

    select.addEventListener('change', function () { apply(select.value); });
    if (printButton) printButton.addEventListener('click', function () { window.print(); });
})();

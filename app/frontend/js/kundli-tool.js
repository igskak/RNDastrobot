/* Public kundli calculators (dasha, Sade Sati, matching).
   Plain script on purpose: these pages are the landing pages of an acquisition channel and
   must stay light on a cheap phone. No bundle, no framework. All visible text comes from the
   catalog embedded in the page (#kundli-i18n); the DOM is built with textContent only. */
(function () {
    'use strict';

    var API = '/api/v1/kundli';
    var body = document.body;
    var tool = body.getAttribute('data-tool');
    var locale = body.getAttribute('data-locale') === 'hi' ? 'hi' : 'en';
    var ui = JSON.parse(document.getElementById('kundli-i18n').textContent);
    var ENDPOINT = { dasha: '/dasha', 'sade-sati': '/sade-sati', matching: '/matching' };

    function t(key, vars) {
        var text = Object.prototype.hasOwnProperty.call(ui, key) ? ui[key] : key;
        if (vars) {
            Object.keys(vars).forEach(function (name) { text = text.split('{' + name + '}').join(String(vars[name])); });
        }
        return text;
    }

    function el(tag, props, children) {
        var node = document.createElement(tag);
        Object.keys(props || {}).forEach(function (key) {
            if (key === 'text') node.textContent = props[key];
            else if (key === 'class') node.className = props[key];
            else node.setAttribute(key, props[key]);
        });
        [].concat(children || []).forEach(function (child) {
            if (child) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
        });
        return node;
    }

    function post(path, payload) {
        return fetch(API + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }).then(function (response) {
            return response.json().catch(function () { return {}; }).then(function (data) {
                if (!response.ok) { var error = new Error('http'); error.status = response.status; throw error; }
                return data;
            });
        });
    }

    function errorMessage(error) {
        if (error && error.status === 422) return t('errorInvalid');
        if (error && error.status === 429) return t('errorRateLimited');
        if (error && error.status) return t('errorGeneric');
        return t('errorNetwork');
    }

    function showMessage(node, text) {
        node.textContent = text || '';
        node.hidden = !text;
    }

    /* ---- one person's birth fields, with place autocomplete ---- */
    function Person(prefix) {
        var root = document.querySelector('[data-person="' + prefix + '"]');
        var nameInput = root.querySelector('input[name="name"]');
        var dateInput = root.querySelector('input[name="date"]');
        var timeInput = root.querySelector('input[name="time"]');
        var unknown = root.querySelector('input[name="unknown"]');
        var placeInput = root.querySelector('input[name="place"]');
        var list = root.querySelector('.suggestions');
        var tzSelect = root.querySelector('select[name="timezone"]');
        var tzHint = root.querySelector('.hint[aria-live]');
        var timer = null;
        var sequence = 0;
        var active = -1;
        var items = [];

        unknown.addEventListener('change', function () {
            timeInput.disabled = unknown.checked;
            if (unknown.checked) timeInput.value = '';
        });

        function hide() {
            list.hidden = true;
            list.textContent = '';
            placeInput.setAttribute('aria-expanded', 'false');
            placeInput.removeAttribute('aria-activedescendant');
            active = -1;
        }

        function setActive(index) {
            var options = list.querySelectorAll('[role="option"]');
            [].forEach.call(options, function (option, i) { option.setAttribute('aria-selected', i === index ? 'true' : 'false'); });
            active = index;
            if (options[index]) placeInput.setAttribute('aria-activedescendant', options[index].id);
        }

        function setTimezone(zone) {
            if (!zone) return;
            if (![].some.call(tzSelect.options, function (option) { return option.value === zone; })) {
                tzSelect.appendChild(el('option', { value: zone, text: zone }));
            }
            tzSelect.value = zone;
            tzHint.textContent = t('timezoneFromPlace');
        }

        function choose(item) {
            placeInput.value = item.display_name || item.short_name || '';
            hide();
            if (!item.source_id) return;
            fetch('/api/v1/places/timezone?source_id=' + encodeURIComponent(item.source_id))
                .then(function (response) { return response.json(); })
                .then(function (data) { setTimezone(data && data.timezone); })
                .catch(function () { /* the manual time zone stays in charge */ });
        }

        function render(results) {
            list.textContent = '';
            items = results;
            if (!results.length) {
                list.appendChild(el('li', { class: 'status', text: t('placeNone') }));
            } else {
                results.forEach(function (item, i) {
                    var option = el('li', { role: 'option', id: list.id + '-' + i, 'aria-selected': 'false', text: item.display_name || item.short_name });
                    option.addEventListener('mousedown', function (event) { event.preventDefault(); choose(item); });
                    list.appendChild(option);
                });
            }
            list.hidden = false;
            placeInput.setAttribute('aria-expanded', 'true');
            active = -1;
        }

        function search(query) {
            var mine = ++sequence;
            list.textContent = '';
            list.appendChild(el('li', { class: 'status', text: t('placeSearching') }));
            list.hidden = false;
            fetch('/api/v1/places/autocomplete?q=' + encodeURIComponent(query) + '&limit=6&language=' + locale)
                .then(function (response) { return response.json(); })
                .then(function (data) { if (mine === sequence) render((data && data.results) || []); })
                .catch(function () { if (mine === sequence) render([]); });
        }

        placeInput.addEventListener('input', function () {
            clearTimeout(timer);
            var query = placeInput.value.trim();
            if (query.length < 2) { sequence++; hide(); return; }
            timer = setTimeout(function () { search(query); }, 250);
        });
        placeInput.addEventListener('blur', function () { setTimeout(hide, 120); });
        placeInput.addEventListener('keydown', function (event) {
            if (list.hidden || !items.length) return;
            if (event.key === 'ArrowDown') { event.preventDefault(); setActive((active + 1) % items.length); }
            else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((active - 1 + items.length) % items.length); }
            else if (event.key === 'Enter' && active >= 0) { event.preventDefault(); choose(items[active]); }
            else if (event.key === 'Escape') { hide(); }
        });

        return {
            valid: function () { return Boolean(dateInput.value); },
            focusFirstInvalid: function () { if (!dateInput.value) dateInput.focus(); },
            placeLabel: function () { return placeInput.value.trim().slice(0, 200) || null; },
            birth: function () {
                return {
                    date: dateInput.value,
                    time: unknown.checked || !timeInput.value ? null : timeInput.value,
                    timezone: tzSelect.value,
                    name: nameInput.value.trim() || null,
                };
            },
        };
    }

    /* ---- rendering ---- */
    function table(headers, rows) {
        var head = el('tr', {}, headers.map(function (h) { return el('th', { scope: 'col', text: h }); }));
        var bodyRows = rows.map(function (row) {
            var tr = el('tr', row.current ? { class: 'current', 'aria-current': 'true' } : {},
                row.cells.map(function (cell) { return el('td', { text: cell }); }));
            return tr;
        });
        return el('div', { class: 'table-wrap' }, el('table', {}, [el('thead', {}, head), el('tbody', {}, bodyRows)]));
    }

    function details(summary, children) {
        var node = el('details', { class: 'result-details' });
        node.appendChild(el('summary', { text: summary }));
        children.forEach(function (child) { node.appendChild(child); });
        return node;
    }

    function timeNotes(info) {
        var notes = [];
        if (info && info.time_known === false) {
            notes.push(t('timeNoteGeneral'));
            if (info.uncertainty && info.uncertainty.nakshatra_may_differ) notes.push(t('timeNoteNakshatra'));
            else if (info.uncertainty && info.uncertainty.rashi_may_differ) notes.push(t('timeNoteRashi'));
        }
        return notes.map(function (text) { return el('p', { class: 'note', text: text }); });
    }

    function head(report) {
        var nodes = [el('h2', { text: t('resultTitle') })];
        if (report.greeting) nodes.push(el('p', { class: 'greeting', text: report.greeting }));
        nodes.push(el('p', { class: 'headline', text: report.headline }));
        return nodes;
    }

    function renderDasha(data) {
        var report = data.report;
        var calc = report.data;
        var nodes = head(report);
        nodes.push(el('p', { text: t('moonLine', { rashi: calc.moon.rashi_label, nakshatra: calc.moon.nakshatra_label, pada: calc.moon.pada }) }));
        nodes.push(el('p', { text: t('balanceLine', { lord: calc.birth_balance.lord_label || calc.mahadashas[0].lord_label, years: calc.birth_balance.years_remaining }) }));
        var timeline = [el('h3', { text: t('mahadashaTitle') })];
        timeline.push(table([t('periodHeader'), t('fromHeader'), t('toHeader'), t('yearsHeader')], calc.mahadashas.map(function (m) {
            return { current: m.current, cells: [m.lord_label + (m.current ? ' (' + t('now') + ')' : ''), m.start, m.end, String(m.years)] };
        })));
        if (calc.antardashas.length) {
            timeline.push(el('h3', { text: t('antardashaTitle') }));
            timeline.push(table([t('periodHeader'), t('fromHeader'), t('toHeader')], calc.antardashas.map(function (a) {
                return { current: a.current, cells: [a.lord_label + (a.current ? ' (' + t('now') + ')' : ''), a.start, a.end] };
            })));
        } else {
            timeline.push(el('p', { text: t('noCurrent') }));
        }
        nodes.push(details(t('mahadashaTitle'), timeline));
        return nodes.concat(timeNotes(data.birth));
    }

    var PHASE = { rising: 'phaseRising', peak: 'phasePeak', setting: 'phaseSetting' };

    function renderSadeSati(data) {
        var report = data.report;
        var calc = report.data;
        var nodes = head(report);
        nodes.push(el('p', { text: t('moonLine', { rashi: data.moon.rashi_label, nakshatra: data.moon.nakshatra_label, pada: data.moon.pada }) }));
        nodes.push(el('p', { text: t('sadeSatiStatus', { sign: calc.saturn_sign_label }) }));
        var episodeNodes = [el('h3', { text: t('episodesTitle') })];
        if (!calc.episodes.length) {
            episodeNodes.push(el('p', { text: t('episodesEmpty') }));
        } else {
            episodeNodes.push(table([t('fromHeader'), t('toHeader'), t('periodHeader')], calc.episodes.map(function (e) {
                var phases = e.phases.map(function (p) { return t(PHASE[p.phase]) + ': ' + p.sign_label; }).join(' · ');
                return { current: e.active, cells: [e.start, e.end, phases] };
            })));
        }
        nodes.push(details(t('episodesTitle'), episodeNodes));
        return nodes.concat(timeNotes(data.birth));
    }

    function renderMatching(data) {
        var report = data.report;
        var calc = report.data;
        var nodes = head(report);
        nodes.push(el('p', { class: 'score', text: t('scoreLabel', { total: calc.total, max: calc.max }) }));
        nodes.push(el('p', { class: 'note', text: t('matchingPersonNote') }));
        nodes.push(table([t('areaHeader'), t('pointsHeader'), t('notesHeader')], calc.koota.map(function (k) {
            return { cells: [k.label, k.points + ' / ' + k.max, k.text] };
        })));
        return nodes.concat(timeNotes(data.groom), timeNotes(data.bride));
    }

    var RENDER = { dasha: renderDasha, 'sade-sati': renderSadeSati, matching: renderMatching };

    /* ---- the form ---- */
    var form = document.getElementById('tool-form');
    var result = document.getElementById('result');
    var formError = document.getElementById('form-error');
    var submit = form.querySelector('button[type="submit"]');
    var people = tool === 'matching' ? { groom: Person('groom'), bride: Person('bride') } : { p1: Person('p1') };
    var lastBirth = null;
    var lastPlace = null;

    function busy(isBusy) {
        submit.disabled = isBusy;
        submit.textContent = isBusy ? submit.getAttribute('data-busy') : submit.getAttribute('data-label');
    }

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        showMessage(formError, '');
        var invalid = Object.keys(people).filter(function (key) { return !people[key].valid(); });
        if (invalid.length) {
            showMessage(formError, t('required'));
            people[invalid[0]].focusFirstInvalid();
            return;
        }
        var payload;
        if (tool === 'matching') payload = { groom: people.groom.birth(), bride: people.bride.birth(), locale: locale };
        else payload = { birth: people.p1.birth(), locale: locale };
        busy(true);
        post(ENDPOINT[tool], payload).then(function (data) {
            result.textContent = '';
            RENDER[tool](data).forEach(function (node) { result.appendChild(node); });
            if (tool !== 'matching') {
                lastBirth = payload.birth;
                lastPlace = people.p1.placeLabel();
                enableUpsell();
            } else {
                var link = document.querySelector('.nav a[href*="dasha-calculator"]');
                if (link) result.appendChild(el('p', {}, el('a', { href: link.getAttribute('href'), text: t('matchingNext') })));
            }
            result.hidden = false;
            result.focus();
        }).catch(function (error) {
            showMessage(formError, errorMessage(error));
        }).then(function () { busy(false); });
    });

    /* ---- optional paid forecast ---- */
    var upsell = document.getElementById('upsell');
    var configPromise = null;

    function loadConfig() {
        if (!configPromise) {
            configPromise = fetch(API + '/config').then(function (response) { return response.json(); }).catch(function () { return null; });
        }
        return configPromise;
    }

    function enableUpsell() {
        if (!upsell) return;
        loadConfig().then(function (config) {
            if (!config || !config.paid_enabled || (config.reviewed_locales || []).indexOf(locale) === -1) return;
            ['weekly', 'biweekly'].forEach(function (cadence) {
                var label = upsell.querySelector('[data-price="' + cadence + '"]');
                var price = config.price_labels && config.price_labels[cadence];
                if (label && price) label.textContent = t(cadence === 'weekly' ? 'cadenceWeekly' : 'cadenceBiweekly') + ' (' + price + ')';
            });
            upsell.hidden = false;
            if (!result.querySelector('a[href="#upsell"]')) {
                result.appendChild(el('p', {}, el('a', { href: '#upsell', text: t('upsellTitle') })));
            }
        });
    }

    if (upsell) {
        var upsellForm = document.getElementById('upsell-form');
        var upsellError = document.getElementById('upsell-error');
        var upsellButton = upsellForm.querySelector('button[type="submit"]');
        upsellForm.addEventListener('submit', function (event) {
            event.preventDefault();
            showMessage(upsellError, '');
            var email = document.getElementById('up-email').value.trim();
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) { showMessage(upsellError, t('errorEmail')); return; }
            if (!document.getElementById('up-consent').checked) { showMessage(upsellError, t('errorConsent')); return; }
            if (!lastBirth) return;
            upsellButton.disabled = true;
            upsellButton.textContent = t('subscribing');
            var cadence = upsellForm.querySelector('input[name="cadence"]:checked').value;
            post('/checkout', { birth: lastBirth, email: email, cadence: cadence, locale: locale, place_label: lastPlace, consent: true })
                .then(function (data) {
                    if (data.checkout_url && /^https:\/\//.test(data.checkout_url)) window.location.href = data.checkout_url;
                    else throw new Error('no url');
                })
                .catch(function (error) {
                    showMessage(upsellError, error && error.status === 429 ? t('errorRateLimited') : t('errorCheckout'));
                    upsellButton.disabled = false;
                    upsellButton.textContent = t('subscribe');
                });
        });
    }
})();

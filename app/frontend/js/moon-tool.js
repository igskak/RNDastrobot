/* Public moon calculator: the next new and full moon in the visitor's houses, then the
   signup for the moon letters. Plain script on purpose, like the kundli tools: these pages
   are landing pages and must stay light on a cheap phone. All visible text comes from the
   catalog embedded in the page (#moon-i18n); the DOM is built with textContent only. */
(function () {
    'use strict';

    var API = '/api/v1/moon';
    var locale = document.body.getAttribute('data-locale') || 'en';
    var ui = JSON.parse(document.getElementById('moon-i18n').textContent);

    function t(key) {
        return Object.prototype.hasOwnProperty.call(ui, key) ? ui[key] : key;
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
        if (error && error.status === 503) return t('errorUnavailable');
        if (error && error.status === 502) return t('errorSignup');
        if (error && error.status) return t('errorGeneric');
        return t('errorNetwork');
    }

    function showMessage(node, text) {
        node.textContent = text || '';
        node.hidden = !text;
    }

    (function setupLanguagePicker() {
        var picker = document.getElementById('language-select');
        if (!picker) return;
        picker.addEventListener('change', function () {
            if (picker.value) window.location.assign(picker.value);
        });
    })();

    /* ---- table interaction and reveal motion ---- */
    function updateHighlight(row, animate) {
        var highlight = document.getElementById('moon-highlight');
        if (!highlight) return;
        var cells = row.querySelectorAll('td');
        var phase = cells[1] && cells[1].querySelector('.phase');
        var dateButton = cells[0] && cells[0].querySelector('.lunation-pick');
        var title = el('h2', { id: 'moon-highlight-title', text: cells[1] ? cells[1].textContent.trim() : '' });
        var copy = highlight.querySelector('.moon-highlight-copy');
        copy.textContent = '';
        copy.appendChild(el('p', { class: 'eyebrow', text: row.classList.contains('next') ? t('nextBadge') : t('selectedBadge') }));
        copy.appendChild(title);
        copy.appendChild(el('p', { class: 'moon-highlight-date', text: dateButton ? dateButton.textContent.trim() : '' }));
        copy.appendChild(el('p', { class: 'moon-highlight-sign', text: cells[2] ? cells[2].textContent.trim() : '' }));
        var isFull = Boolean(phase && phase.classList.contains('phase-full'));
        highlight.classList.toggle('is-full', isFull);
        highlight.classList.toggle('is-new', !isFull);
        if (animate) {
            highlight.classList.remove('is-changing');
            requestAnimationFrame(function () { highlight.classList.add('is-changing'); });
        }
        highlight.hidden = false;
    }

    (function setupLunationPicker() {
        var rows = document.querySelectorAll('tr[data-utc]');
        [].forEach.call(rows, function (row) {
            var button = row.querySelector('.lunation-pick');
            if (!button) return;
            button.addEventListener('click', function () {
                [].forEach.call(rows, function (item) { item.classList.remove('is-selected'); });
                row.classList.add('is-selected');
                updateHighlight(row, true);
            });
        });
    })();

    (function markNext() {
        var now = Date.now();
        var rows = document.querySelectorAll('tr[data-utc]');
        for (var i = 0; i < rows.length; i++) {
            if (Date.parse(rows[i].getAttribute('data-utc')) > now) {
                rows[i].classList.add('next', 'is-selected');
                rows[i].setAttribute('aria-current', 'true');
                var badge = rows[i].querySelector('.badge');
                if (badge) badge.hidden = false;
                updateHighlight(rows[i], false);
                return;
            }
        }
    })();

    (function setupScrollReveal() {
        var items = document.querySelectorAll('.reveal-on-scroll');
        if (!items.length) return;
        if (!('IntersectionObserver' in window)) {
            [].forEach.call(items, function (item) { item.classList.add('is-visible'); });
            return;
        }
        document.body.classList.add('motion-ready');
        var observer = new IntersectionObserver(function (entries, self) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                self.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
        [].forEach.call(items, function (item) { observer.observe(item); });
    })();

    (function setupCalendarMotion() {
        var page = document.querySelector('.moon-page');
        var tableWrap = document.querySelector('.moon-rail .table-wrap');
        if (!page) return;
        var frame = 0;
        function updatePageProgress() {
            frame = 0;
            var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
            document.body.style.setProperty('--calendar-progress', (window.scrollY / max).toFixed(3));
        }
        window.addEventListener('scroll', function () {
            if (frame) return;
            frame = requestAnimationFrame(updatePageProgress);
        }, { passive: true });
        updatePageProgress();

        if (!tableWrap) return;
        var rows = tableWrap.querySelectorAll('tr[data-utc]');
        var selected = tableWrap.querySelector('tr.is-selected');
        var tableFrame = 0;
        function followTable() {
            tableFrame = 0;
            var box = tableWrap.getBoundingClientRect();
            var target = box.top + Math.min(box.height * .34, 150);
            var closest = null;
            var distance = Infinity;
            [].forEach.call(rows, function (row) {
                var rect = row.getBoundingClientRect();
                var nextDistance = Math.abs(rect.top + rect.height / 2 - target);
                if (rect.bottom > box.top && rect.top < box.bottom && nextDistance < distance) {
                    closest = row;
                    distance = nextDistance;
                }
            });
            if (!closest || closest === selected) return;
            selected = closest;
            [].forEach.call(rows, function (row) { row.classList.remove('is-selected'); });
            selected.classList.add('is-selected');
            updateHighlight(selected, false);
        }
        tableWrap.addEventListener('scroll', function () {
            if (tableFrame) return;
            tableFrame = requestAnimationFrame(followTable);
        }, { passive: true });
    })();

    /* ---- birth fields with place autocomplete ---- */
    var form = document.getElementById('moon-form');
    var dateInput = document.getElementById('birth-date');
    var timeInput = document.getElementById('birth-time');
    var unknown = document.getElementById('birth-unknown');
    var placeInput = document.getElementById('birth-place');
    var list = document.getElementById('birth-places');
    var tzSelect = document.getElementById('birth-tz');
    var tzHint = document.getElementById('birth-tz-hint');
    var coords = null;
    var timer = null;
    var sequence = 0;
    var active = -1;
    var items = [];

    function setTimezone(zone) {
        if (!zone) return;
        if (![].some.call(tzSelect.options, function (option) { return option.value === zone; })) {
            tzSelect.appendChild(el('option', { value: zone, text: zone }));
        }
        tzSelect.value = zone;
    }

    try { setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch (e) { /* keep the page default */ }

    function syncFormState() { form.classList.toggle('is-ready', Boolean(dateInput.value)); }
    dateInput.addEventListener('input', syncFormState);
    syncFormState();

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

    function choose(item) {
        placeInput.value = item.display_name || item.short_name || '';
        coords = (typeof item.lat === 'number' && typeof item.lon === 'number') ? { lat: item.lat, lon: item.lon } : null;
        hide();
        if (!item.source_id) return;
        fetch('/api/v1/places/timezone?source_id=' + encodeURIComponent(item.source_id))
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (data && data.timezone) { setTimezone(data.timezone); tzHint.textContent = t('timezoneFromPlace'); }
            })
            .catch(function () { /* the manual time zone stays in charge */ });
    }

    function renderPlaces(results) {
        list.textContent = '';
        items = results;
        if (!results.length) {
            list.appendChild(el('li', { class: 'status', text: t('placeNone') }));
        } else {
            results.forEach(function (item, i) {
                var option = el('li', { role: 'option', id: 'birth-places-' + i, 'aria-selected': 'false', text: item.display_name || item.short_name });
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
            .then(function (data) { if (mine === sequence) renderPlaces((data && data.results) || []); })
            .catch(function () { if (mine === sequence) renderPlaces([]); });
    }

    placeInput.addEventListener('input', function () {
        coords = null; // typed text no longer matches the chosen place
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

    function birth() {
        var value = {
            date: dateInput.value,
            time: unknown.checked || !timeInput.value ? null : timeInput.value,
            timezone: tzSelect.value,
        };
        if (coords) { value.latitude = coords.lat; value.longitude = coords.lon; }
        return value;
    }

    /* ---- result ---- */
    function lunationNode(lun) {
        return el('article', { class: 'lunation' }, [
            el('h3', {}, [el('span', { class: 'phase phase-' + (lun.kind === 'new_moon' ? 'new' : 'full'), 'aria-hidden': 'true' }), lun.headline]),
            el('p', { class: 'when', text: lun.date_label }),
            el('p', { text: lun.theme }),
            el('h4', { text: t('promptsTitle') }),
            el('ol', { class: 'prompts' }, lun.prompts.map(function (prompt) { return el('li', { text: prompt }); })),
            el('p', { class: 'affirmation' }, [el('strong', { text: t('affirmationTitle') }), lun.affirmation]),
        ]);
    }

    var result = document.getElementById('result');
    var formError = document.getElementById('form-error');
    var submit = form.querySelector('button[type="submit"]');
    var signup = document.getElementById('signup');
    var lastBirth = null;
    var lastPlace = null;

    function busy(isBusy) {
        submit.disabled = isBusy;
        submit.textContent = isBusy ? submit.getAttribute('data-busy') : submit.getAttribute('data-label');
    }

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        showMessage(formError, '');
        if (!dateInput.value) { showMessage(formError, t('required')); dateInput.focus(); return; }
        var payload = { birth: birth(), locale: locale };
        busy(true);
        post('/chart', payload).then(function (data) {
            result.textContent = '';
            result.appendChild(el('h2', { text: t('resultTitle') }));
            data.lunations.forEach(function (lun) { result.appendChild(lunationNode(lun)); });
            if (data.lunations.length) result.appendChild(el('p', { class: 'note', text: data.lunations[0].frame_note }));
            result.hidden = false;
            lastBirth = payload.birth;
            lastPlace = placeInput.value.trim().slice(0, 200) || null;
            signup.hidden = false;
            result.focus();
        }).catch(function (error) {
            showMessage(formError, errorMessage(error));
        }).then(function () { busy(false); });
    });

    /* ---- signup (double opt-in) ---- */
    var signupForm = document.getElementById('signup-form');
    var signupError = document.getElementById('signup-error');
    var signupDone = document.getElementById('signup-done');
    var signupButton = signupForm.querySelector('button[type="submit"]');

    signupForm.addEventListener('submit', function (event) {
        event.preventDefault();
        showMessage(signupError, '');
        var email = document.getElementById('signup-email').value.trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) { showMessage(signupError, t('errorEmail')); return; }
        if (!document.getElementById('signup-consent').checked) { showMessage(signupError, t('errorConsent')); return; }
        if (!lastBirth) return;
        signupButton.disabled = true;
        signupButton.textContent = t('subscribing');
        post('/subscribe', { birth: lastBirth, email: email, locale: locale, place_label: lastPlace, consent: true })
            .then(function () {
                showMessage(signupDone, t('signupDone'));
                signupButton.hidden = true;
            })
            .catch(function (error) {
                showMessage(signupError, errorMessage(error));
                signupButton.disabled = false;
                signupButton.textContent = t('subscribe');
            });
    });

    /* ---- "send me my link": back into the journal from another device ---- */
    var linkForm = document.getElementById('link-form');
    var linkError = document.getElementById('link-error');
    var linkDone = document.getElementById('link-done');
    var linkButton = linkForm.querySelector('button[type="submit"]');

    linkForm.addEventListener('submit', function (event) {
        event.preventDefault();
        showMessage(linkError, '');
        var email = document.getElementById('link-email').value.trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) { showMessage(linkError, t('errorEmail')); return; }
        linkButton.disabled = true;
        linkButton.textContent = t('linkSending');
        post('/link', { email: email, locale: locale })
            .then(function () { showMessage(linkDone, t('linkDone')); linkButton.hidden = true; })
            .catch(function (error) {
                showMessage(linkError, errorMessage(error));
                linkButton.disabled = false;
                linkButton.textContent = t('linkButton');
            });
    });
})();

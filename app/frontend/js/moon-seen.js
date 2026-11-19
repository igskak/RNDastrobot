/* Anonymous "a person used this page" signal for the public moon pages. Sends only the kind of
   page, the language and one of two events: "engaged" (the visitor scrolled, typed or tapped and
   stayed a few seconds) and "hook_click" (the visitor followed the link to the calculator). No
   identifier, no text, no storage. A crawler that only loads the page never sends either. */
(function () {
    'use strict';

    var body = document.body;
    var page = body.getAttribute('data-page');
    var locale = body.getAttribute('data-locale') || 'en';
    if (!page || page === 'letter') return;

    var URL = '/api/v1/moon/seen';
    var ENGAGED_AFTER_MS = 5000;
    var sent = {};

    function send(event) {
        if (sent[event]) return;
        sent[event] = true;
        try {
            var payload = JSON.stringify({ event: event, page: page, locale: locale });
            if (navigator.sendBeacon && navigator.sendBeacon(URL, new Blob([payload], { type: 'application/json' }))) return;
            fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true });
        } catch (e) { /* counting must never get in the way of the page */ }
    }

    var armed = false;
    function onInput() {
        if (armed) return;
        armed = true;
        ['scroll', 'pointerdown', 'keydown', 'touchstart'].forEach(function (name) {
            window.removeEventListener(name, onInput, true);
        });
        setTimeout(function () {
            if (document.visibilityState === 'visible') send('engaged');
        }, ENGAGED_AFTER_MS);
    }
    ['scroll', 'pointerdown', 'keydown', 'touchstart'].forEach(function (name) {
        window.addEventListener(name, onInput, { capture: true, passive: true });
    });

    document.addEventListener('click', function (event) {
        var target = event.target;
        if (target && target.closest && target.closest('.hook-link')) send('hook_click');
    });
})();

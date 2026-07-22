/**
 * Steliara app nav — shared burger + slide-out drawer.
 *
 * Self-mounting (mirrors locale-switcher.js): builds the burger button, scrim,
 * and left drawer, injects them once, and wires open/close, active nav state,
 * language switch, account email, and logout to the app's existing globals
 * (window.AstroAPI, window.FrontendI18n). A page adopts this by including
 * css/app-nav.css + js/app-nav.js and removing its old top-bar chrome.
 *
 * Labels are self-contained (EN/UK/RU) so this needs no locale-file changes.
 */
(function (global) {
    'use strict';

    var NAV = [
        { key: 'practice', href: '/',                     ico: '◑', test: function (p) { return p === '/' || p === '' || p === '/new' || p.indexOf('/client') === 0; } },
        { key: 'calendar', href: '/calendar',             ico: '▦', test: function (p) { return p.indexOf('/calendar') === 0; } },
        { key: 'settings', href: '/account-settings.html', ico: '⚙', test: function (p) { return p.indexOf('/account-settings') === 0; } }
    ];

    var LOCALES = ['en', 'uk', 'ru'];
    var LABELS = {
        en: { practice: 'Practice', calendar: 'Calendar', settings: 'Settings', logout: 'Log out', menu: 'Menu', lang: { en: 'EN', uk: 'УКР', ru: 'RU' } },
        uk: { practice: 'Практика', calendar: 'Календар', settings: 'Налаштування', logout: 'Вийти', menu: 'Меню', lang: { en: 'EN', uk: 'УКР', ru: 'RU' } },
        ru: { practice: 'Практика', calendar: 'Календарь', settings: 'Настройки', logout: 'Выйти', menu: 'Меню', lang: { en: 'EN', uk: 'УКР', ru: 'RU' } }
    };

    function locale() {
        var l = (global.FrontendI18n && global.FrontendI18n.getLocale && global.FrontendI18n.getLocale()) || 'uk';
        return LABELS[l] ? l : 'uk';
    }

    function currentPath() {
        return (global.location && global.location.pathname || '/').replace(/\/$/, '') || '/';
    }

    function accountEmail() {
        var astrologer = global.AstroAPI && global.AstroAPI.getCachedAstrologer && global.AstroAPI.getCachedAstrologer();
        var cached = astrologer && (astrologer.email || [astrologer.first_name, astrologer.last_name].filter(Boolean).join(' '));
        if (cached) return String(cached).trim();
        var el = document.getElementById('welcomeLabel');
        var v = el && (el.textContent || '').trim();
        return v || '';
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    var mounted = false;

    function mount() {
        if (mounted || document.querySelector('.app-nav-burger')) { mounted = true; return; }
        if (!document.body) return;

        var burger = document.createElement('button');
        burger.type = 'button';
        burger.className = 'app-nav-burger';
        burger.setAttribute('aria-label', LABELS[locale()].menu);
        burger.setAttribute('aria-expanded', 'false');
        burger.innerHTML = '<span></span><span></span><span></span>';

        var scrim = document.createElement('div');
        scrim.className = 'app-nav-scrim';

        var drawer = document.createElement('aside');
        drawer.className = 'app-nav-drawer';
        drawer.setAttribute('role', 'navigation');

        // A page can host the burger inside its own chrome (e.g. the forecast-new
        // workspace toolbar) by placing an element with [data-app-nav-slot]: the
        // burger mounts there and no standalone bar is created, so a full-height /
        // single-row workspace never gains a second header row. Default (no slot):
        // the burger lives in app-nav's own sticky top bar (Practice).
        var slot = document.querySelector('[data-app-nav-slot]');
        if (slot) {
            slot.appendChild(burger);
        } else {
            // Sticky top bar in the flow — content sits below it (never covered),
            // burger left-aligned with the page content.
            var bar = document.createElement('div');
            bar.className = 'app-nav-bar';
            var barInner = document.createElement('div');
            barInner.className = 'app-nav-bar-inner';
            barInner.appendChild(burger);
            bar.appendChild(barInner);
            document.body.insertBefore(bar, document.body.firstChild);
        }
        document.body.appendChild(scrim);
        document.body.appendChild(drawer);
        mounted = true;

        function render() {
            var lc = locale();
            var L = LABELS[lc];
            var path = currentPath();
            var navHtml = NAV.map(function (item) {
                var active = item.test(path);
                return '<a class="app-nav-item' + (active ? ' is-active' : '') + '" href="' + item.href + '"' +
                    (active ? ' aria-current="page"' : '') + '><span class="ico" aria-hidden="true">' + item.ico +
                    '</span>' + L[item.key] + '</a>';
            }).join('');
            var langHtml = LOCALES.map(function (code) {
                return '<button type="button" class="' + (code === lc ? 'is-active' : '') + '" data-locale="' + code + '">' + L.lang[code] + '</button>';
            }).join('');
            var email = accountEmail();
            var initial = email ? email.charAt(0).toUpperCase() : '●';
            drawer.innerHTML =
                '<div class="app-nav-brand"><span class="mark" aria-hidden="true"></span><span class="name">Steliara</span></div>' +
                '<nav class="app-nav-list">' + navHtml + '</nav>' +
                '<div class="app-nav-foot">' +
                    '<div class="app-nav-lang">' + langHtml + '</div>' +
                    (email ? '<div class="app-nav-account"><span class="avatar">' + escapeHtml(initial) + '</span><span class="email">' + escapeHtml(email) + '</span></div>' : '') +
                    '<button type="button" class="app-nav-logout"><span class="ico" aria-hidden="true">⏻</span>' + L.logout + '</button>' +
                '</div>';
        }

        function open() {
            render();
            drawer.classList.add('is-open');
            scrim.classList.add('is-open');
            burger.setAttribute('aria-expanded', 'true');
        }
        function close() {
            drawer.classList.remove('is-open');
            scrim.classList.remove('is-open');
            burger.setAttribute('aria-expanded', 'false');
            burger.focus();
        }

        burger.addEventListener('click', function () {
            drawer.classList.contains('is-open') ? close() : open();
        });
        scrim.addEventListener('click', close);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

        drawer.addEventListener('click', function (e) {
            var lang = e.target.closest && e.target.closest('[data-locale]');
            if (lang) {
                var code = lang.getAttribute('data-locale');
                if (global.FrontendI18n && global.FrontendI18n.setLocale) { global.FrontendI18n.setLocale(code); }
                render();
                return;
            }
            if (e.target.closest && e.target.closest('.app-nav-logout')) {
                e.preventDefault();
                Promise.resolve(global.AstroAPI && global.AstroAPI.logout && global.AstroAPI.logout())
                    .catch(function () {})
                    .then(function () { global.location.href = '/login.html'; });
                return;
            }
            // nav links close the drawer, then navigate normally
            if (e.target.closest && e.target.closest('.app-nav-item')) { close(); }
        });

        render();
    }

    // Self-mount, retry until <body> exists.
    function boot() {
        try { mount(); } catch (e) { /* no-op */ }
        if (!mounted) { global.setTimeout(boot, 60); }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})(window);

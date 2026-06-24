/**
 * Steliara product analytics bootstrap (PostHog, EU cloud).
 *
 * Loaded as a plain (non-module) script on every page, before the page's ES
 * module bundle runs — mirrors the loading pattern of locale-switcher.js.
 *
 * Privacy posture (see plan "imperative-watching-mountain"):
 *   - Session replay is DISABLED.
 *   - All input fields and rendered text are masked, so client PII
 *     (birth dates/places, names, notes) never leaves the browser.
 *   - Only identified astrologers get person profiles.
 *
 * The public project key + EU host are injected at runtime via
 * window.__RUNTIME_CONFIG__ (served by GET /runtime-config.js). When the key is
 * absent (e.g. local dev without analytics configured) this module installs a
 * no-op window.AstroAnalytics and does nothing else.
 */
(function () {
    'use strict';

    var cfg = (window.__RUNTIME_CONFIG__ || {});
    var POSTHOG_KEY = cfg.posthogKey || '';
    var POSTHOG_HOST = cfg.posthogHost || 'https://eu.i.posthog.com';

    function noop() {}

    // Derive a stable, low-cardinality screen name for navigation/heatmap.
    function resolveScreen() {
        var body = document && document.body;
        if (body && body.classList) {
            for (var i = 0; i < body.classList.length; i++) {
                var cls = body.classList[i];
                if (cls.slice(-5) === '-page') return cls.slice(0, -5);
            }
        }
        var path = (window.location && window.location.pathname) || '/';
        path = path.replace(/\.html$/, '').replace(/^\/+|\/+$/g, '');
        return path === '' ? 'home' : path;
    }

    function currentLocale() {
        try {
            if (window.FrontendI18n && window.FrontendI18n.getLocale) {
                return window.FrontendI18n.getLocale();
            }
        } catch (e) { /* ignore */ }
        return undefined;
    }

    // If analytics is not configured, expose a safe no-op surface and bail.
    if (!POSTHOG_KEY) {
        window.AstroAnalytics = {
            enabled: false,
            screen: resolveScreen(),
            track: noop,
            identify: noop,
            reset: noop,
            pageLeave: noop,
        };
        return;
    }

    // --- Official PostHog loader snippet (creates the queueing stub) ---------
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId captureTraceFeedback captureTraceMetric".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

    var posthog = window.posthog;

    posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        // --- Behavioural capture (clicks/heatmaps/paths/time-on-page) --------
        autocapture: true,
        capture_pageview: true,
        capture_pageleave: true,
        // --- Privacy: replay OFF, mask everything sensitive ------------------
        disable_session_recording: true,
        mask_all_text: true,
        mask_all_element_attributes: true,
        // Don't create anonymous person profiles; only identified astrologers.
        person_profiles: 'identified_only',
        // Persist attribution (utm/referrer) for the marketing funnel.
        persistence: 'localStorage+cookie',
        // GDPR: capture NOTHING until the user consents. We opt in on accept.
        opt_out_capturing_by_default: true,
        loaded: function (ph) {
            try {
                var screen = resolveScreen();
                ph.register({ screen: screen, app_env: cfg.appEnv || 'production' });
                var locale = currentLocale();
                if (locale) ph.register({ locale: locale });
                captureAttribution(ph);   // first-touch utm/referrer (PH3)
                applyConsent(ph);         // opt-in if already granted, else banner (PH4)
                bootstrapIdentity();
            } catch (e) { /* analytics must never break the app */ }
        },
    });

    // --- Identify the signed-in astrologer once AstroAPI has resolved it -----
    // Entries already call requireAuth()/getCurrentAstrologer(), which fills the
    // AstroAPI cache. We poll that cache instead of editing every entry file.
    var identified = false;
    function bootstrapIdentity() {
        var attempts = 0;
        var timer = setInterval(function () {
            attempts++;
            var astro = null;
            try {
                astro = window.AstroAPI && window.AstroAPI.getCachedAstrologer
                    ? window.AstroAPI.getCachedAstrologer()
                    : null;
            } catch (e) { astro = null; }

            if (astro && astro.id) {
                clearInterval(timer);
                window.AstroAnalytics.identify(astro);
            } else if (attempts >= 40) {
                // ~20s: anonymous/public page (login, landing) — give up quietly.
                clearInterval(timer);
            }
        }, 500);
    }

    function safe(fn) {
        try { return fn(); } catch (e) { /* swallow */ }
    }

    // --- Cookies ---------------------------------------------------------------
    function setCookie(name, value, days) {
        try {
            var exp = new Date(Date.now() + days * 864e5).toUTCString();
            document.cookie = name + '=' + encodeURIComponent(value)
                + '; expires=' + exp + '; path=/; SameSite=Lax';
        } catch (e) { /* ignore */ }
    }
    function getCookie(name) {
        try {
            var m = document.cookie.match('(?:^|; )' + name + '=([^;]*)');
            return m ? decodeURIComponent(m[1]) : null;
        } catch (e) { return null; }
    }

    // --- PH3: first-touch marketing attribution (utm/referrer) -----------------
    // Stored first-party for our own signup conversion measurement; the server
    // reads the same cookie at /auth/register. First-touch = never overwrite.
    function captureAttribution(ph) {
        safe(function () {
            if (getCookie('steliara_attribution')) {
                registerAttributionSuper(ph);
                return;
            }
            var params = new URLSearchParams(window.location.search || '');
            var attr = {};
            ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
                .forEach(function (k) { if (params.get(k)) attr[k] = params.get(k); });

            var ref = document.referrer || '';
            if (ref && ref.indexOf(window.location.origin) !== 0) attr.referrer = ref;
            attr.landing_path = window.location.pathname || '/';

            // Only persist if there's a real signal (campaign or external referrer).
            var hasSignal = Object.keys(attr).some(function (k) {
                return k.indexOf('utm_') === 0 || k === 'referrer';
            });
            if (hasSignal) {
                setCookie('steliara_attribution', JSON.stringify(attr), 90);
                registerAttributionSuper(ph);
            }
        });
    }
    function registerAttributionSuper(ph) {
        safe(function () {
            var raw = getCookie('steliara_attribution');
            if (raw) ph.register(JSON.parse(raw));   // rides on events once opted in
        });
    }

    // --- PH4: consent gating (GDPR) -------------------------------------------
    var CONSENT_KEY = 'steliara_consent';
    function getConsent() {
        try { return window.localStorage.getItem(CONSENT_KEY); } catch (e) { return null; }
    }
    function setConsent(value) {
        try { window.localStorage.setItem(CONSENT_KEY, value); } catch (e) { /* ignore */ }
    }
    function applyConsent(ph) {
        var state = getConsent();
        if (state === 'granted') { safe(function () { ph.opt_in_capturing(); }); return; }
        if (state === 'denied') { safe(function () { ph.opt_out_capturing(); }); return; }
        renderConsentBanner(ph);              // undecided -> ask
    }

    var CONSENT_COPY = {
        en: {
            text: 'We use privacy-friendly analytics to improve the product. No recordings; personal data is masked.',
            accept: 'Accept', decline: 'Decline',
        },
        ru: {
            text: 'Мы используем аналитику без записи экрана, чтобы улучшать продукт. Персональные данные маскируются.',
            accept: 'Принять', decline: 'Отклонить',
        },
        uk: {
            text: 'Ми використовуємо аналітику без запису екрана, щоб покращувати продукт. Персональні дані маскуються.',
            accept: 'Прийняти', decline: 'Відхилити',
        },
    };
    function renderConsentBanner(ph) {
        safe(function () {
            if (!document.body || document.getElementById('steliara-consent')) return;
            var loc = (currentLocale() || 'en').slice(0, 2);
            var c = CONSENT_COPY[loc] || CONSENT_COPY.en;

            var bar = document.createElement('div');
            bar.id = 'steliara-consent';
            bar.setAttribute('role', 'dialog');
            bar.setAttribute('aria-label', c.text);
            bar.style.cssText = [
                'position:fixed', 'left:16px', 'right:16px', 'bottom:16px', 'z-index:2147483000',
                'max-width:560px', 'margin:0 auto', 'display:flex', 'gap:12px',
                'align-items:center', 'flex-wrap:wrap', 'justify-content:center',
                'padding:12px 16px', 'border-radius:12px',
                'background:rgba(26,22,20,0.96)', 'color:#fff',
                'font:14px/1.4 -apple-system,system-ui,sans-serif',
                'box-shadow:0 8px 24px rgba(0,0,0,0.25)',
            ].join(';');

            var msg = document.createElement('span');
            msg.textContent = c.text;
            msg.style.cssText = 'flex:1 1 240px;min-width:200px';

            function mkBtn(label, primary) {
                var b = document.createElement('button');
                b.type = 'button';
                b.textContent = label;
                b.style.cssText = [
                    'cursor:pointer', 'border:0', 'border-radius:8px',
                    'padding:8px 16px', 'font:inherit', 'font-weight:600',
                    primary ? 'background:#b8935a' : 'background:rgba(255,255,255,0.14)',
                    'color:#fff',
                ].join(';');
                return b;
            }
            var accept = mkBtn(c.accept, true);
            var decline = mkBtn(c.decline, false);
            accept.addEventListener('click', function () {
                setConsent('granted');
                safe(function () { ph.opt_in_capturing(); });
                // Events before consent were dropped (not queued): re-identify the
                // current astrologer and count this screen now that we're opted in.
                safe(function () {
                    identified = false;
                    var astro = window.AstroAPI && window.AstroAPI.getCachedAstrologer
                        ? window.AstroAPI.getCachedAstrologer() : null;
                    if (astro) window.AstroAnalytics.identify(astro);
                    window.AstroAnalytics.track('screen_view', {});
                });
                bar.remove();
            });
            decline.addEventListener('click', function () {
                setConsent('denied');
                // Enforce opt-out explicitly — overrides any prior persisted opt-in.
                safe(function () { ph.opt_out_capturing(); });
                bar.remove();
            });

            bar.appendChild(msg);
            bar.appendChild(accept);
            bar.appendChild(decline);
            document.body.appendChild(bar);
        });
    }

    window.AstroAnalytics = {
        enabled: true,
        screen: resolveScreen(),
        track: function (event, props) {
            safe(function () {
                window.posthog.capture(event, Object.assign(
                    { screen: window.AstroAnalytics.screen, locale: currentLocale() },
                    props || {}
                ));
            });
        },
        identify: function (astrologer) {
            if (!astrologer || !astrologer.id || identified) return;
            identified = true;
            safe(function () {
                window.posthog.identify(String(astrologer.id), {
                    plan_code: astrologer.plan_code,
                    preferred_locale: astrologer.preferred_locale,
                    auth_provider: astrologer.auth_provider,
                    created_at: astrologer.created_at,
                });
                if (astrologer.plan_code) {
                    window.posthog.group('plan', String(astrologer.plan_code));
                }
            });
        },
        reset: function () {
            identified = false;
            safe(function () { window.posthog.reset(); });
        },
        pageLeave: function () {
            safe(function () { window.posthog.capture('$pageleave'); });
        },
    };

    // Explicit screen_view so paths/time-on-screen read cleanly across the
    // 13-page multi-page app (in addition to PostHog's own $pageview).
    safe(function () {
        window.AstroAnalytics.track('screen_view', {});
    });
})();

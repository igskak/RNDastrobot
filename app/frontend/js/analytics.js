/**
 * Steliara product analytics bootstrap (PostHog, EU cloud).
 *
 * Loaded as a plain (non-module) script on every page, before the page's ES
 * module bundle runs — mirrors the loading pattern of locale-switcher.js.
 *
 * Privacy posture (see plan "imperative-watching-mountain"):
 *   - Session replay is enabled only after consent.
 *   - All input fields, rendered text, and element attributes are masked, so
 *     client PII (birth dates/places, names, notes) never leaves the browser.
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
    var GA4_ID = cfg.ga4MeasurementId || '';

    function noop() {}

    // --- GA4 (gtag.js) with Consent Mode v2 ----------------------------------
    // GA4 runs alongside PostHog for Google Ads conversion/audience signals.
    // Consent Mode keeps analytics_storage 'denied' until the user accepts,
    // mirroring PostHog's opt-out-by-default posture. The same consent banner
    // drives both: setGa4Consent() is called from applyConsent()/the banner.
    var ga4Ready = false;
    function initGa4() {
        if (ga4Ready || !GA4_ID) return;
        ga4Ready = true;
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        window.gtag('consent', 'default', {
            ad_storage: 'denied',
            analytics_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
        });
        var s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID);
        (document.getElementsByTagName('script')[0] || document.head).appendChild(s);
        window.gtag('js', new Date());
        window.gtag('config', GA4_ID);
    }
    function setGa4Consent(granted) {
        if (!GA4_ID) return;
        initGa4();
        try {
            window.gtag('consent', 'update', {
                ad_storage: granted ? 'granted' : 'denied',
                analytics_storage: granted ? 'granted' : 'denied',
                ad_user_data: granted ? 'granted' : 'denied',
                ad_personalization: granted ? 'granted' : 'denied',
            });
        } catch (e) { /* analytics must never break the app */ }
    }

    // GA4 is independent of PostHog: initialize it (consent denied by default)
    // and reflect any prior decision immediately, even if PostHog is unset.
    if (GA4_ID) {
        initGa4();
        var ga4Prior = null;
        try { ga4Prior = window.localStorage.getItem('steliara_consent'); } catch (e) { ga4Prior = null; }
        if (ga4Prior === 'granted') setGa4Consent(true);
    }

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
            captureException: noop,
        };
        return;
    }

    // --- Official PostHog loader snippet (creates the queueing stub) ---------
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId captureTraceFeedback captureTraceMetric".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

    var posthog = window.posthog;

    // --- Strip OAuth secrets from any URL before it leaves the browser -------
    // The Supabase auth callback lands on /login.html?oauth=callback with the
    // PKCE `code`/`state` in the query string (and, under implicit flow, the
    // access/refresh/provider tokens in the URL #hash). PostHog's pageview/
    // autocapture would otherwise ship that full URL as $current_url. We scrub
    // both the hash and the sensitive query params from every URL-bearing prop.
    var SENSITIVE_URL_PARAMS = [
        'access_token', 'refresh_token', 'provider_token', 'provider_refresh_token',
        'id_token', 'code', 'state', 'token', 'token_type', 'expires_in', 'expires_at',
    ];
    function scrubUrl(value) {
        if (typeof value !== 'string' || value.indexOf('http') !== 0) return value;
        try {
            var url = new URL(value);
            // The hash carries implicit-flow tokens wholesale — drop it entirely.
            if (url.hash) url.hash = '';
            for (var i = 0; i < SENSITIVE_URL_PARAMS.length; i++) {
                if (url.searchParams.has(SENSITIVE_URL_PARAMS[i])) {
                    url.searchParams.set(SENSITIVE_URL_PARAMS[i], 'redacted');
                }
            }
            return url.toString();
        } catch (e) {
            return value;
        }
    }
    function sanitizeProperties(properties) {
        if (!properties) return properties;
        var urlKeys = ['$current_url', '$referrer', '$referring_domain', '$pathname'];
        for (var i = 0; i < urlKeys.length; i++) {
            if (properties[urlKeys[i]]) {
                properties[urlKeys[i]] = scrubUrl(properties[urlKeys[i]]);
            }
        }
        return properties;
    }

    posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        // Scrub OAuth tokens/codes from captured URLs (see scrubUrl above).
        sanitize_properties: sanitizeProperties,
        // --- Behavioural capture (clicks/heatmaps/paths/time-on-page) --------
        autocapture: true,
        capture_pageview: true,
        capture_pageleave: true,
        // --- Privacy: replay ON after consent, mask everything sensitive -----
        disable_session_recording: false,
        mask_all_text: true,
        mask_all_element_attributes: true,
        // Don't create anonymous person profiles; only identified astrologers.
        person_profiles: 'identified_only',
        // Persist attribution (utm/referrer) for the marketing funnel.
        persistence: 'localStorage+cookie',
        // Scroll-depth / click-density heatmaps (rendered in PostHog → Heatmaps).
        // Coordinate-only data; respects the masking config above.
        enable_heatmaps: true,
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

    function scrubSensitiveText(value) {
        var text = String(value || '');
        SENSITIVE_URL_PARAMS.forEach(function (key) {
            var re = new RegExp('([?&#]' + key + '=)[^&#\\s]+', 'gi');
            text = text.replace(re, '$1redacted');
        });
        return text.length > 4000 ? text.slice(0, 4000) : text;
    }

    function normalizeException(error) {
        var name = 'Error';
        var message = 'Unknown frontend exception';
        var stack = '';
        if (error && typeof error === 'object') {
            name = scrubSensitiveText(error.name || error.constructor?.name || name);
            message = scrubSensitiveText(error.message || String(error));
            stack = scrubSensitiveText(error.stack || '');
        } else if (error !== undefined && error !== null) {
            message = scrubSensitiveText(String(error));
        }
        var normalized = new Error(message);
        normalized.name = name;
        if (stack) normalized.stack = stack;
        return normalized;
    }

    function captureException(error, props) {
        var normalized = normalizeException(error);
        var payload = Object.assign(
            {
                screen: window.AstroAnalytics?.screen || resolveScreen(),
                locale: currentLocale(),
                error_name: normalized.name,
            },
            props || {}
        );
        safe(function () {
            if (typeof window.posthog.captureException === 'function') {
                window.posthog.captureException(normalized, payload);
                return;
            }
            window.posthog.capture('$exception', Object.assign({
                '$exception_message': normalized.message,
                '$exception_type': normalized.name,
                '$exception_stack_trace_raw': normalized.stack || '',
            }, payload));
        });
    }

    function installExceptionHandlers() {
        if (window.__steliaraExceptionHandlersInstalled) return;
        window.__steliaraExceptionHandlersInstalled = true;
        window.addEventListener('error', function (event) {
            var target = event.target || event.srcElement;
            var isResourceError = target && target !== window;
            captureException(event.error || event.message || 'Window error', {
                source: isResourceError ? 'resource_error' : 'window_error',
                filename: scrubUrl(event.filename || target?.src || target?.href || ''),
                lineno: event.lineno || undefined,
                colno: event.colno || undefined,
                tag_name: isResourceError && target?.tagName ? String(target.tagName).toLowerCase() : undefined,
            });
        }, true);
        window.addEventListener('unhandledrejection', function (event) {
            captureException(event.reason || 'Unhandled promise rejection', {
                source: 'unhandledrejection',
            });
        });
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
            // utm_* + Google Ads click ids (gclid/gbraid/wbraid). The click ids
            // must be captured on the FIRST landing: they're gone from the URL
            // after the Google OAuth round-trip, but this cookie survives it and
            // is read server-side at signup for offline conversion import.
            ATTRIBUTION_PARAM_KEYS
                .forEach(function (k) { if (params.get(k)) attr[k] = params.get(k); });

            var ref = document.referrer || '';
            if (ref && ref.indexOf(window.location.origin) !== 0) attr.referrer = ref;
            attr.landing_path = window.location.pathname || '/';

            // Only persist if there's a real signal (campaign, ad click, or
            // external referrer) — never overwrite a first-touch on later visits.
            var hasSignal = Object.keys(attr).some(function (k) {
                return k.indexOf('utm_') === 0 || k === 'referrer'
                    || k === 'gclid' || k === 'gbraid' || k === 'wbraid';
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

    // --- Attribution readback (for signup events + person $set_once) ----------
    var ATTRIBUTION_PARAM_KEYS = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'gclid', 'gbraid', 'wbraid',
    ];
    function storedAttribution() {
        var raw = getCookie('steliara_attribution');
        if (!raw) return {};
        try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
    }
    // Campaign/click props to attach to conversion events.
    function attributionEventProps() {
        var a = storedAttribution();
        var out = {};
        ATTRIBUTION_PARAM_KEYS.forEach(function (k) { if (a[k]) out[k] = a[k]; });
        return out;
    }
    // First-touch props to freeze on the person (never overwritten by PostHog).
    function attributionSetOnce() {
        var a = storedAttribution();
        var out = {};
        ATTRIBUTION_PARAM_KEYS.forEach(function (k) { if (a[k]) out['initial_' + k] = a[k]; });
        return out;
    }

    // --- One-time signup conversion guard (per browser) -----------------------
    // Keys are hashed so no raw email is written to localStorage.
    function hashKey(s) {
        var h = 5381;
        for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
        return 'k' + h.toString(36);
    }
    function markSignupFired(key) {
        try {
            var stored = window.localStorage.getItem('steliara_signup_fired');
            var set = stored ? JSON.parse(stored) : [];
            if (!Array.isArray(set)) set = [];
            var hashed = hashKey(String(key));
            if (set.indexOf(hashed) !== -1) return false;   // already fired
            set.push(hashed);
            if (set.length > 50) set = set.slice(-50);
            window.localStorage.setItem('steliara_signup_fired', JSON.stringify(set));
            return true;
        } catch (e) {
            return true;   // storage unavailable — don't block the conversion
        }
    }

    // --- PH4: consent gating (GDPR) -------------------------------------------
    var CONSENT_KEY = 'steliara_consent';
    function getConsent() {
        try { return window.localStorage.getItem(CONSENT_KEY); } catch (e) { return null; }
    }
    function setConsent(value) {
        try { window.localStorage.setItem(CONSENT_KEY, value); } catch (e) { /* ignore */ }
    }
    function startSessionReplay(ph) {
        safe(function () {
            if (ph && typeof ph.startSessionRecording === 'function') ph.startSessionRecording();
        });
    }
    function stopSessionReplay(ph) {
        safe(function () {
            if (ph && typeof ph.stopSessionRecording === 'function') ph.stopSessionRecording();
        });
    }
    function applyConsent(ph) {
        var state = getConsent();
        if (state === 'granted') {
            safe(function () { ph.opt_in_capturing(); });
            startSessionReplay(ph);
            setGa4Consent(true);
            return;
        }
        if (state === 'denied') {
            stopSessionReplay(ph);
            safe(function () { ph.opt_out_capturing(); });
            setGa4Consent(false);
            return;
        }
        renderConsentBanner(ph);              // undecided -> ask
    }

    var CONSENT_COPY = {
        en: {
            text: 'We use privacy-friendly analytics and masked session replay to improve the product. Personal data is masked.',
            accept: 'Accept', decline: 'Decline',
        },
        ru: {
            text: 'Мы используем аналитику и маскированную запись сессий, чтобы улучшать продукт. Персональные данные маскируются.',
            accept: 'Принять', decline: 'Отклонить',
        },
        uk: {
            text: 'Ми використовуємо аналітику й замаскований запис сесій, щоб покращувати продукт. Персональні дані маскуються.',
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
                startSessionReplay(ph);
                setGa4Consent(true);
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
                stopSessionReplay(ph);
                safe(function () { ph.opt_out_capturing(); });
                setGa4Consent(false);
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
            var payload = Object.assign(
                { screen: window.AstroAnalytics.screen, locale: currentLocale() },
                props || {}
            );
            safe(function () {
                window.posthog.capture(event, payload);
            });
            // Mirror business events to GA4 for Google Ads conversions. Skip
            // screen_view (GA4 enhanced measurement already sends page_view)
            // and PostHog's $-prefixed internal events (invalid GA4 names).
            if (GA4_ID && window.gtag && event !== 'screen_view' && event.charAt(0) !== '$') {
                safe(function () {
                    window.gtag('event', event, payload);
                });
            }
        },
        identify: function (astrologer) {
            if (!astrologer || !astrologer.id || identified) return;
            identified = true;
            safe(function () {
                // $set carries current identity (email/name close the "anonymous
                // person" gap); $set_once freezes first-touch ad attribution so
                // ad → signup stays joined even across the OAuth redirect.
                window.posthog.identify(String(astrologer.id), {
                    email: astrologer.email,
                    name: astrologer.name,
                    plan_code: astrologer.plan_code,
                    preferred_locale: astrologer.preferred_locale,
                    auth_provider: astrologer.auth_provider,
                    created_at: astrologer.created_at,
                }, attributionSetOnce());
                if (astrologer.plan_code) {
                    window.posthog.group('plan', String(astrologer.plan_code));
                }
            });
        },
        // Attribution props (gclid/utm) for callers building signup payloads.
        getAttribution: function () {
            return attributionEventProps();
        },
        // Fire the one-time registration conversion on BOTH sinks:
        //   PostHog `user_signed_up`  +  GA4 `trial_start` (Google Ads import).
        // Pass dedupeKey to guarantee at-most-once per browser for that key.
        signup: function (method, extraProps, dedupeKey) {
            if (dedupeKey && !markSignupFired(dedupeKey)) return;
            var payload = Object.assign(
                { method: method, screen: window.AstroAnalytics.screen, locale: currentLocale() },
                attributionEventProps(),
                extraProps || {}
            );
            safe(function () {
                window.posthog.capture('user_signed_up', payload);
            });
            if (GA4_ID && window.gtag) {
                safe(function () {
                    window.gtag('event', 'trial_start', payload);
                });
            }
        },
        reset: function () {
            identified = false;
            safe(function () { window.posthog.reset(); });
        },
        pageLeave: function () {
            safe(function () { window.posthog.capture('$pageleave'); });
        },
        captureException: function (error, props) {
            captureException(error, props);
        },
    };

    installExceptionHandlers();

    // Explicit screen_view so paths/time-on-screen read cleanly across the
    // 13-page multi-page app (in addition to PostHog's own $pageview).
    safe(function () {
        window.AstroAnalytics.track('screen_view', {});
    });
})();

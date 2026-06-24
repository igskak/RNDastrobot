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
        loaded: function (ph) {
            try {
                var screen = resolveScreen();
                ph.register({ screen: screen, app_env: cfg.appEnv || 'production' });
                var locale = currentLocale();
                if (locale) ph.register({ locale: locale });
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

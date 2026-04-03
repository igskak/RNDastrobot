const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createI18n } = require('../frontend/js/i18n.js');
const AstroLogin = require('../frontend/js/login.js');

function loadCatalogs() {
    const baseDir = path.join(__dirname, '..', 'frontend', 'locales');
    return {
        en: JSON.parse(fs.readFileSync(path.join(baseDir, 'en.json'), 'utf8')),
        ru: JSON.parse(fs.readFileSync(path.join(baseDir, 'ru.json'), 'utf8')),
        uk: JSON.parse(fs.readFileSync(path.join(baseDir, 'uk.json'), 'utf8')),
    };
}

function installLocale(locale) {
    global.FrontendI18n = createI18n({
        catalogs: loadCatalogs(),
        queryString: `?locale=${locale}`,
        fetchFn: null,
    });
    return global.FrontendI18n.ready;
}

test('createAuthUiModel exposes key auth states', () => {
    const loginModel = AstroLogin.createAuthUiModel({ view: 'login', now: 0 });
    const resetModel = AstroLogin.createAuthUiModel({ view: 'reset', token: 'reset-token-1234567890', now: 0 });
    const checkEmailModel = AstroLogin.createAuthUiModel({
        view: 'check-email',
        lastEmail: 'astro@example.com',
        resendCooldownUntil: 30_000,
        now: 10_000,
    });
    const invalidModel = AstroLogin.createAuthUiModel({ view: 'reset', token: '', now: 0 });

    assert.equal(loginModel.view, 'login');
    assert.equal(resetModel.view, 'reset');
    assert.equal(resetModel.resetToken, 'reset-token-1234567890');
    assert.equal(checkEmailModel.view, 'check-email');
    assert.equal(checkEmailModel.cooldownSeconds, 20);
    assert.equal(checkEmailModel.resendEnabled, false);
    assert.equal(invalidModel.view, 'reset-invalid');
    assert.equal(invalidModel.invalidMessageKey, 'page.login.views.invalid.bodyInvalid');
});

test('createAuthUiModel exposes verification states', () => {
    const verifyCheckModel = AstroLogin.createAuthUiModel({
        view: 'verify-check-email',
        lastVerificationEmail: 'astro@example.com',
        verificationResendCooldownUntil: 20_000,
        now: 5_000,
    });
    const verifyInvalidModel = AstroLogin.createAuthUiModel({
        view: 'verify-loading',
        verifyToken: '',
        verifyInvalidReason: 'expired',
        now: 0,
    });

    assert.equal(verifyCheckModel.view, 'verify-check-email');
    assert.equal(verifyCheckModel.cooldownSeconds, 15);
    assert.equal(verifyCheckModel.resendEnabled, false);
    assert.equal(verifyInvalidModel.view, 'verify-invalid');
    assert.equal(verifyInvalidModel.verifyInvalidMessageKey, 'page.login.views.verifyInvalid.bodyExpired');
});

test('mapAuthErrorToKey classifies login and reset failures', () => {
    assert.equal(AstroLogin.mapAuthErrorToKey('login', 'Invalid credentials'), 'page.login.errors.invalidCredentials');
    assert.equal(AstroLogin.mapAuthErrorToKey('login', 'Account temporarily locked'), 'page.login.errors.rateLimited');
    assert.equal(AstroLogin.mapAuthErrorToKey('login', 'Email is not verified'), 'page.login.errors.emailNotVerified');
    assert.equal(AstroLogin.mapAuthErrorToKey('reset', 'Reset link has expired'), 'expired');
    assert.equal(AstroLogin.mapAuthErrorToKey('reset', 'Reset link has already been used'), 'used');
    assert.equal(AstroLogin.mapAuthErrorToKey('reset', 'Reset link is invalid'), 'invalid');
    assert.equal(AstroLogin.mapAuthErrorToKey('verify', 'Verification link has expired'), 'expired');
    assert.equal(AstroLogin.mapAuthErrorToKey('verify', 'Verification link has already been used'), 'used');
    assert.equal(AstroLogin.mapAuthErrorToKey('verify', 'Verification link is invalid'), 'invalid');
});

test('validateRegistrationPayload enforces registration fields and policy', () => {
    const invalid = AstroLogin.validateRegistrationPayload({
        email: 'bad-email',
        password: 'weakpass',
        confirmPassword: 'other',
        firstName: 'A'.repeat(101),
    });
    assert.equal(invalid.valid, false);
    assert.equal(invalid.errors.email, 'page.login.validation.emailInvalid');
    assert.equal(invalid.errors.password, 'page.login.validation.passwordPolicy');
    assert.equal(invalid.errors.confirmPassword, 'page.login.validation.passwordMismatch');
    assert.equal(invalid.errors.firstName, 'page.login.validation.nameTooLong');

    const valid = AstroLogin.validateRegistrationPayload({
        email: 'astro@example.com',
        password: 'Strong123',
        confirmPassword: 'Strong123',
        firstName: 'Ihor',
        lastName: 'Skakovskyi',
    });
    assert.equal(valid.valid, true);
    assert.deepEqual(valid.errors, {});
});

test('new auth copy is localized for en, ru, uk', async () => {
    for (const locale of ['en', 'ru', 'uk']) {
        await installLocale(locale);
        const title = global.FrontendI18n.t('page.login.views.reset.title');
        const success = global.FrontendI18n.t('page.login.views.success.body');
        const resend = global.FrontendI18n.t('page.login.actions.resendLink');
        const registerTitle = global.FrontendI18n.t('page.login.views.register.title');
        const verifyTitle = global.FrontendI18n.t('page.login.views.verifySuccess.title');
        const accountReady = global.FrontendI18n.t('page.login.status.accountReady');
        const spamTitle = global.FrontendI18n.t('page.login.hints.emailDeliverySpamTitle');
        const spamHint = global.FrontendI18n.t('page.login.hints.emailDeliverySpam');

        assert.notEqual(title, 'page.login.views.reset.title');
        assert.notEqual(success, 'page.login.views.success.body');
        assert.notEqual(resend, 'page.login.actions.resendLink');
        assert.notEqual(registerTitle, 'page.login.views.register.title');
        assert.notEqual(verifyTitle, 'page.login.views.verifySuccess.title');
        assert.notEqual(accountReady, 'page.login.status.accountReady');
        assert.notEqual(spamTitle, 'page.login.hints.emailDeliverySpamTitle');
        assert.notEqual(spamHint, 'page.login.hints.emailDeliverySpam');
    }

    delete global.FrontendI18n;
});

test('cooldown and invalid copy follow active locale', async () => {
    await installLocale('ru');
    const ruCooldown = AstroLogin.createCooldownLabel(15);
    const ruInvalid = global.FrontendI18n.t('page.login.views.invalid.bodyExpired');
    assert.equal(ruCooldown, 'Повтор через 15 с');
    assert.match(ruInvalid, /истек/i);

    await global.FrontendI18n.setLocale('uk', { persist: false });
    const ukCooldown = AstroLogin.createCooldownLabel(9);
    const ukSuccess = global.FrontendI18n.t('page.login.views.success.title');
    assert.equal(ukCooldown, 'Повтор через 9 с');
    assert.match(ukSuccess, /Пароль оновлено/i);

    delete global.FrontendI18n;
});

test('authenticated users are redirected away from register mode', async () => {
    await installLocale('en');

    let redirectedTo = null;
    const app = AstroLogin.createAuthApp({
        document: {
            title: 'Login',
            body: { dataset: {} },
            getElementById() { return null; },
            querySelector() { return null; },
            querySelectorAll() { return []; },
            addEventListener() {},
        },
        history: {
            replaceState() {},
        },
        location: {
            search: '?mode=register',
        },
        fetchFn: async () => ({
            ok: false,
            json: async () => ({}),
        }),
        getCurrentAstrologer: async () => ({ email: 'astro@example.com' }),
        redirect: (href) => {
            redirectedTo = href;
        },
    });

    await app.init();

    assert.equal(redirectedTo, '/');

    delete global.FrontendI18n;
});

test('reset mode does not redirect authenticated users before token flow', async () => {
    await installLocale('en');

    let redirectedTo = null;
    const app = AstroLogin.createAuthApp({
        document: {
            title: 'Login',
            body: { dataset: {} },
            getElementById() { return null; },
            querySelector() { return null; },
            querySelectorAll() { return []; },
            addEventListener() {},
        },
        history: {
            replaceState() {},
        },
        location: {
            search: '?mode=reset&token=test-token',
        },
        fetchFn: async () => ({
            ok: false,
            json: async () => ({}),
        }),
        getCurrentAstrologer: async () => ({ email: 'astro@example.com' }),
        redirect: (href) => {
            redirectedTo = href;
        },
    });

    await app.init();

    assert.equal(redirectedTo, null);

    delete global.FrontendI18n;
});

test('google oauth callback retries session lookup before failing', async () => {
    await installLocale('en');

    let redirectedTo = null;
    const signOutCalls = [];
    let sessionReads = 0;
    let authChecks = 0;
    let googlePayload = null;
    const waits = [];

    const app = AstroLogin.createAuthApp({
        document: {
            title: 'Login',
            body: { dataset: {} },
            getElementById() { return null; },
            querySelector() { return null; },
            querySelectorAll() { return []; },
            addEventListener() {},
        },
        history: {
            replaceState() {},
        },
        location: {
            search: '?oauth=callback',
        },
        fetchFn: async (url, init = {}) => {
            if (String(url).endsWith('/auth/frontend-config')) {
                return {
                    ok: true,
                    json: async () => ({
                        supabase_url: 'https://example.supabase.co',
                        supabase_anon_key: 'anon-key',
                    }),
                };
            }
            if (String(url).endsWith('/auth/google')) {
                googlePayload = JSON.parse(init.body);
                return {
                    ok: true,
                    json: async () => ({ email: 'astro@example.com' }),
                };
            }
            throw new Error(`Unexpected fetch: ${url}`);
        },
        supabaseFactory: () => ({
            auth: {
                getSession: async () => {
                    sessionReads += 1;
                    if (sessionReads === 1) {
                        return { data: { session: null }, error: null };
                    }
                    return { data: { session: { access_token: 'google-access-token' } }, error: null };
                },
                signOut: async (options) => {
                    signOutCalls.push(options);
                },
            },
        }),
        getCurrentAstrologer: async () => {
            authChecks += 1;
            if (authChecks === 1) {
                return null;
            }
            return { email: 'astro@example.com' };
        },
        wait: async (ms) => {
            waits.push(ms);
        },
        redirect: (href) => {
            redirectedTo = href;
        },
    });

    await app.init();

    assert.equal(sessionReads, 2);
    assert.equal(authChecks, 2);
    assert.deepEqual(waits, [300]);
    assert.deepEqual(googlePayload, { access_token: 'google-access-token' });
    assert.deepEqual(signOutCalls, [{ scope: 'local' }]);
    assert.equal(redirectedTo, '/');

    delete global.FrontendI18n;
});

test('google oauth callback exchanges auth code before polling session', async () => {
    await installLocale('en');

    let redirectedTo = null;
    let sessionReads = 0;
    let authChecks = 0;
    let exchangeCalls = 0;
    let googlePayload = null;
    const waits = [];

    const app = AstroLogin.createAuthApp({
        document: {
            title: 'Login',
            body: { dataset: {} },
            getElementById() { return null; },
            querySelector() { return null; },
            querySelectorAll() { return []; },
            addEventListener() {},
        },
        history: {
            replaceState() {},
        },
        location: {
            search: '?oauth=callback&code=oauth-code-123',
        },
        fetchFn: async (url, init = {}) => {
            if (String(url).endsWith('/auth/frontend-config')) {
                return {
                    ok: true,
                    json: async () => ({
                        supabase_url: 'https://example.supabase.co',
                        supabase_anon_key: 'anon-key',
                    }),
                };
            }
            if (String(url).endsWith('/auth/google')) {
                googlePayload = JSON.parse(init.body);
                return {
                    ok: true,
                    json: async () => ({ email: 'astro@example.com' }),
                };
            }
            throw new Error(`Unexpected fetch: ${url}`);
        },
        supabaseFactory: () => ({
            auth: {
                getSession: async () => {
                    sessionReads += 1;
                    return { data: { session: null }, error: null };
                },
                exchangeCodeForSession: async (code) => {
                    exchangeCalls += 1;
                    assert.equal(code, 'oauth-code-123');
                    return { data: { session: { access_token: 'google-access-token' } }, error: null };
                },
                signOut: async () => {},
            },
        }),
        getCurrentAstrologer: async () => {
            authChecks += 1;
            if (authChecks === 1) {
                return null;
            }
            return { email: 'astro@example.com' };
        },
        wait: async (ms) => {
            waits.push(ms);
        },
        redirect: (href) => {
            redirectedTo = href;
        },
    });

    await app.init();

    assert.equal(sessionReads, 1);
    assert.equal(exchangeCalls, 1);
    assert.equal(authChecks, 2);
    assert.deepEqual(waits, [300]);
    assert.deepEqual(googlePayload, { access_token: 'google-access-token' });
    assert.equal(redirectedTo, '/');

    delete global.FrontendI18n;
});

test('google oauth callback tolerates slower supabase session hydration', async () => {
    await installLocale('en');

    let redirectedTo = null;
    let sessionReads = 0;
    let authChecks = 0;
    let googlePayload = null;
    const waits = [];

    const app = AstroLogin.createAuthApp({
        document: {
            title: 'Login',
            body: { dataset: {} },
            getElementById() { return null; },
            querySelector() { return null; },
            querySelectorAll() { return []; },
            addEventListener() {},
        },
        history: {
            replaceState() {},
        },
        location: {
            search: '?oauth=callback',
        },
        fetchFn: async (url, init = {}) => {
            if (String(url).endsWith('/auth/frontend-config')) {
                return {
                    ok: true,
                    json: async () => ({
                        supabase_url: 'https://example.supabase.co',
                        supabase_anon_key: 'anon-key',
                    }),
                };
            }
            if (String(url).endsWith('/auth/google')) {
                googlePayload = JSON.parse(init.body);
                return {
                    ok: true,
                    json: async () => ({ email: 'astro@example.com' }),
                };
            }
            throw new Error(`Unexpected fetch: ${url}`);
        },
        supabaseFactory: () => ({
            auth: {
                getSession: async () => {
                    sessionReads += 1;
                    if (sessionReads < 11) {
                        return { data: { session: null }, error: null };
                    }
                    return { data: { session: { access_token: 'google-access-token' } }, error: null };
                },
                signOut: async () => {},
            },
        }),
        getCurrentAstrologer: async () => {
            authChecks += 1;
            if (authChecks === 1) {
                return null;
            }
            return { email: 'astro@example.com' };
        },
        wait: async (ms) => {
            waits.push(ms);
        },
        redirect: (href) => {
            redirectedTo = href;
        },
    });

    await app.init();

    assert.equal(sessionReads, 11);
    assert.equal(authChecks, 2);
    assert.equal(waits.filter((ms) => ms === 300).length, 10);
    assert.deepEqual(googlePayload, { access_token: 'google-access-token' });
    assert.equal(redirectedTo, '/');

    delete global.FrontendI18n;
});

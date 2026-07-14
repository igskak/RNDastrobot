// Regression: the app ("/") and the login page must never hand an unresolved
// session back and forth. In July 2026 a flapping /auth/me put newly registered
// users into a "/" <-> "/login.html" ping-pong that only ended when they closed
// the tab — it was the last thing three paid-channel signups ever saw.
//
// The two sides read the same /auth/me answer and draw opposite conclusions:
//   app   (api.js requireAuth)                  -> "no session, go to /login.html?next=/"
//   login (login.js maybeRedirectAuthenticatedUser) -> "session is fine, go back to /"
//
// These tests drive both real modules against a scripted /auth/me.

const test = require('node:test');
const assert = require('node:assert/strict');

// api.js captures `window` at load time, so the fake browser must exist first.
const store = new Map();
const sessionStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
};

let current = { pathname: '/', search: '' };
let nav = [];

function navigate(href) {
    const url = new URL(href, 'https://app.test');
    current = { pathname: url.pathname, search: url.search };
    nav.push(`${url.pathname}${url.search}`);
}

global.window = {
    sessionStorage,
    get location() {
        return {
            origin: 'https://app.test',
            pathname: current.pathname,
            search: current.search,
            hash: '',
            set href(value) { navigate(value); },
        };
    },
};
global.sessionStorage = sessionStorage;

const OK = { ok: true, status: 200, json: async () => ({ id: 'u1', plan_code: 'trial' }) };
const UNAUTHORIZED = { ok: false, status: 401, json: async () => ({}) };
const SERVER_ERROR = { ok: false, status: 503, json: async () => ({}) };
const NETWORK_FAILURE = Symbol('network');

let respond = () => OK;
let meCalls = 0;
global.fetch = async () => {
    meCalls += 1;
    const reply = respond(meCalls);
    if (reply === NETWORK_FAILURE) throw new TypeError('Load failed');
    return reply;
};

const AstroAPI = require('../frontend/js/api.js');
const AstroLogin = require('../frontend/js/login.js');

const loginApp = AstroLogin.createAuthApp({
    document: undefined,
    location: { get search() { return current.search; }, origin: 'https://app.test' },
    getCurrentAstrologer: () => AstroAPI.getCurrentAstrologer(),
    authBounceCount: () => AstroAPI.authBounceCount(),
    clearAuthBounces: () => AstroAPI.clearAuthBounces(),
    redirect: (href) => navigate(href),
});

// Walk the user through page loads until they land somewhere that doesn't
// redirect. Returns where they settled, or null if they are still bouncing.
async function browse(authMeScript, maxLoads = 40) {
    respond = authMeScript;
    meCalls = 0;
    store.clear();
    current = { pathname: '/', search: '' };
    nav = ['/'];

    for (let i = 0; i < maxLoads; i += 1) {
        if (current.pathname === '/login.html') {
            const route = AstroLogin.parseAuthRoute(current.search);
            const bounced = await loginApp.maybeRedirectAuthenticatedUser(route);
            if (!bounced) return { landedOn: 'login-form', loads: nav.length - 1, nav };
        } else {
            const me = await AstroAPI.requireAuth({ redirectTo: '/login.html' });
            if (me) return { landedOn: 'app', loads: nav.length - 1, nav };
            if (current.pathname === '/') return { landedOn: 'app-unresolved', loads: nav.length - 1, nav };
        }
    }
    return { landedOn: null, loads: nav.length - 1, nav };
}

test('a flapping /auth/me does not bounce the user out of the app', async () => {
    // The incident: the fetch itself fails, then succeeds. A network failure is
    // not proof of a signed-out user, so it must not trigger a redirect at all.
    const result = await browse((n) => (n % 2 === 1 ? NETWORK_FAILURE : OK));

    assert.equal(result.landedOn, 'app');
    assert.equal(result.loads, 0, 'a transient network failure must not redirect anywhere');
});

test('a 5xx on /auth/me does not bounce the user out of the app', async () => {
    const result = await browse((n) => (n % 2 === 1 ? SERVER_ERROR : OK));

    assert.equal(result.landedOn, 'app');
    assert.equal(result.loads, 0, 'a server error must not be read as "signed out"');
});

test('a self-contradicting /auth/me is capped instead of looping forever', async () => {
    // Pathological: the endpoint alternates 401 and 200, so neither side can
    // tell it is wrong. Nothing can resolve this — but it must terminate.
    const result = await browse((n) => (n % 2 === 1 ? UNAUTHORIZED : OK));

    assert.equal(result.landedOn, 'login-form', 'the loop must end on a page the user can act on');
    assert.ok(result.loads <= 4, `expected the bounce cap to engage, got ${result.loads} redirects: ${result.nav.join(' -> ')}`);
});

test('a signed-out user still reaches the login form in one redirect', async () => {
    const result = await browse(() => UNAUTHORIZED);

    assert.equal(result.landedOn, 'login-form');
    assert.equal(result.loads, 1);
    assert.equal(result.nav[1], '/login.html?next=%2F', 'the return path must survive the redirect');
});

test('a signed-in user is never sent to the login page', async () => {
    const result = await browse(() => OK);

    assert.equal(result.landedOn, 'app');
    assert.equal(result.loads, 0);
});

test('the bounce counter resets once the user settles, so a later sign-out still redirects', async () => {
    await browse((n) => (n % 2 === 1 ? UNAUTHORIZED : OK));   // burn the cap
    const result = await browse(() => UNAUTHORIZED);           // fresh visit, genuinely signed out

    assert.equal(result.landedOn, 'login-form');
    assert.equal(result.loads, 1, 'a stale counter must not suppress a legitimate redirect');
});

const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:8000/api/v1'
    : '/api/v1';

let supabaseClient = null;
let supabaseConfig = null;

function withLocaleHeaders(headers = {}) {
    if (window.AstroAPI?.withLocaleHeaders) {
        return window.AstroAPI.withLocaleHeaders(headers);
    }
    return headers;
}

async function apiFetch(url, init = {}) {
    return fetch(url, {
        credentials: 'include',
        ...init,
        headers: withLocaleHeaders(init.headers || {}),
    });
}

function setStatus(message, isError = false) {
    const el = document.getElementById('status');
    if (!el) return;
    el.textContent = message || '';
    el.className = isError ? 'status error' : 'status';
}

async function loadSupabaseConfig() {
    const response = await apiFetch(`${API_BASE}/auth/frontend-config`);
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload.supabase_url || !payload.supabase_anon_key) {
        return null;
    }
    return payload;
}

async function ensureBackendAuth() {
    const me = await window.AstroAPI?.getCurrentAstrologer?.();
    if (me) {
        window.location.href = '/';
        return true;
    }
    return false;
}

async function loginWithPassword(event) {
    event.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    setStatus('Signing in...');

    const response = await apiFetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || 'Login failed');
    }

    window.location.href = '/';
}

async function loginWithGoogle() {
    if (!supabaseClient) {
        throw new Error('Supabase is not configured');
    }
    const redirectTo = `${window.location.origin}/login.html?oauth=callback`;
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
    });
    if (error) {
        throw error;
    }
}

async function exchangeSupabaseSessionIfNeeded() {
    if (!supabaseClient) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('oauth') !== 'callback') return;

    setStatus('Completing Google login...');
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    const session = data?.session;
    if (!session) {
        throw new Error('Supabase session not found');
    }

    const response = await apiFetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            access_token: session.access_token,
        }),
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || 'Google login failed');
    }

    await supabaseClient.auth.signOut();
    window.history.replaceState({}, document.title, '/login.html');
    window.location.href = '/';
}

async function init() {
    if (await ensureBackendAuth()) return;

    const form = document.getElementById('passwordLoginForm');
    if (form) {
        form.addEventListener('submit', async (event) => {
            try {
                await loginWithPassword(event);
            } catch (error) {
                setStatus(error.message || 'Login failed', true);
            }
        });
    }

    supabaseConfig = await loadSupabaseConfig();
    if (supabaseConfig && window.supabase?.createClient) {
        supabaseClient = window.supabase.createClient(
            supabaseConfig.supabase_url,
            supabaseConfig.supabase_anon_key
        );

        const btn = document.getElementById('googleLoginBtn');
        if (btn) {
            btn.disabled = false;
            btn.addEventListener('click', async () => {
                try {
                    await loginWithGoogle();
                } catch (error) {
                    setStatus(error.message || 'Google login failed', true);
                }
            });
        }
    }

    try {
        await exchangeSupabaseSessionIfNeeded();
    } catch (error) {
        setStatus(error.message || 'Google login failed', true);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    init().catch((error) => {
        setStatus(error.message || 'Failed to initialize login', true);
    });
});

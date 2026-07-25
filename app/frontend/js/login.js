(function (global) {
    'use strict';

    const API_BASE = global.location && global.location.hostname === 'localhost'
        ? 'http://localhost:8000/api/v1'
        : '/api/v1';
    // How many times the app and this page may hand an unresolved session back
    // and forth before we stop and show the sign-in form. Must match api.js.
    const MAX_AUTH_BOUNCES = 2;

    // Send authenticated users to the app root. The "/" route serves the
    // client base (clients.html) when a session cookie is present and the
    // marketing landing (index.html) otherwise. "/new" is a dumb alias that
    // always serves the landing, so it must NOT be the post-auth default.
    const DEFAULT_POST_AUTH_REDIRECT = '/';

    const VIEW_COPY = {
        login: {
            title: 'page.login.views.login.title',
            subtitle: 'page.login.views.login.subtitle',
        },
        register: {
            title: 'page.login.views.register.title',
            subtitle: 'page.login.views.register.subtitle',
        },
        'verify-check-email': {
            title: 'page.login.views.verifyCheckEmail.title',
            subtitle: 'page.login.views.verifyCheckEmail.subtitle',
        },
        'verify-loading': {
            title: 'page.login.views.verifyLoading.title',
            subtitle: 'page.login.views.verifyLoading.subtitle',
        },
        'verify-success': {
            title: 'page.login.views.verifySuccess.title',
            subtitle: 'page.login.views.verifySuccess.subtitle',
        },
        'verify-invalid': {
            title: 'page.login.views.verifyInvalid.title',
            subtitle: 'page.login.views.verifyInvalid.subtitle',
        },
        forgot: {
            title: 'page.login.views.forgot.title',
            subtitle: 'page.login.views.forgot.subtitle',
        },
        'check-email': {
            title: 'page.login.views.checkEmail.title',
            subtitle: 'page.login.views.checkEmail.subtitle',
        },
        reset: {
            title: 'page.login.views.reset.title',
            subtitle: 'page.login.views.reset.subtitle',
        },
        'reset-success': {
            title: 'page.login.views.success.title',
            subtitle: 'page.login.views.success.subtitle',
        },
        'reset-invalid': {
            title: 'page.login.views.invalid.title',
            subtitle: 'page.login.views.invalid.subtitle',
        },
    };

    const RESET_REASON_TO_COPY_KEY = {
        invalid: 'page.login.views.invalid.bodyInvalid',
        expired: 'page.login.views.invalid.bodyExpired',
        used: 'page.login.views.invalid.bodyUsed',
    };

    const VERIFY_REASON_TO_COPY_KEY = {
        invalid: 'page.login.views.verifyInvalid.bodyInvalid',
        expired: 'page.login.views.verifyInvalid.bodyExpired',
        used: 'page.login.views.verifyInvalid.bodyUsed',
    };

    function t(key, params = {}) {
        return global.FrontendI18n?.t ? global.FrontendI18n.t(key, params) : key;
    }

    async function waitForI18nReady() {
        if (!global.FrontendI18n?.ready) return;
        await Promise.resolve(global.FrontendI18n.ready).catch(() => {});
    }

    function getCurrentLocale() {
        return global.FrontendI18n?.getLocale?.() || 'en';
    }

    function withLocaleHeaders(headers = {}) {
        if (global.AstroAPI?.withLocaleHeaders) {
            return global.AstroAPI.withLocaleHeaders(headers);
        }
        return headers;
    }

    async function apiFetch(url, init = {}, fetchFn = global.fetch.bind(global)) {
        return fetchFn(url, {
            credentials: 'include',
            ...init,
            headers: withLocaleHeaders(init.headers || {}),
        });
    }

    function normalizeLocalRedirect(value) {
        const candidate = String(value || '').trim();
        if (!candidate) return '';
        try {
            const base = global.location?.origin || 'http://localhost';
            const url = new URL(candidate, base);
            if (url.origin !== base) return '';
            const normalized = `${url.pathname}${url.search}${url.hash}`;
            if (!normalized.startsWith('/') || normalized.startsWith('//')) return '';
            if (/^\/login(?:\.html)?(?:[?#]|$)/.test(normalized)) return '';
            return normalized;
        } catch (_error) {
            return '';
        }
    }

    function getPostAuthRedirect(route = {}) {
        return normalizeLocalRedirect(route.next) || DEFAULT_POST_AUTH_REDIRECT;
    }

    function parseAuthRoute(search) {
        const params = new URLSearchParams(search || '');
        const token = (params.get('token') || '').trim();
        const mode = (params.get('mode') || '').trim();
        const locale = (params.get('locale') || '').trim();
        const plan = (params.get('plan') || '').trim().toLowerCase();
        return {
            mode,
            token,
            locale,
            plan,
            next: normalizeLocalRedirect(params.get('next') || ''),
            oauthCallback: params.get('oauth') === 'callback',
            oauthError: (params.get('error') || '').trim(),
        };
    }

    function extractErrorDetail(payload) {
        if (!payload) return '';
        if (typeof payload.detail === 'string') return payload.detail;
        if (typeof payload.message === 'string') return payload.message;
        if (typeof payload.error === 'string') return payload.error;
        return '';
    }

    function mapAuthErrorToKey(kind, detail) {
        const message = String(detail || '');
        if (kind === 'login') {
            if (message === 'Invalid credentials') return 'page.login.errors.invalidCredentials';
            if (message === 'Account is inactive') return 'page.login.errors.accountInactive';
            if (message === 'Email is not verified') return 'page.login.errors.emailNotVerified';
            if (message === 'Too many authentication attempts' || message === 'Account temporarily locked') {
                return 'page.login.errors.rateLimited';
            }
            return 'page.login.errors.loginFailed';
        }
        if (kind === 'google') {
            if (message === 'Too many authentication attempts' || message === 'Account temporarily locked') {
                return 'page.login.errors.rateLimited';
            }
            return 'page.login.errors.googleFailed';
        }
        if (kind === 'forgot') {
            if (message === 'Too many authentication attempts' || message === 'Account temporarily locked') {
                return 'page.login.errors.rateLimited';
            }
            return 'page.login.errors.forgotFailed';
        }
        if (kind === 'reset') {
            if (message === 'Reset link has expired') return 'expired';
            if (message === 'Reset link has already been used') return 'used';
            if (message === 'Reset link is invalid') return 'invalid';
            if (message === 'Too many authentication attempts' || message === 'Account temporarily locked') {
                return 'page.login.errors.rateLimited';
            }
            if (message === 'Account is inactive') return 'page.login.errors.accountInactive';
            return 'page.login.errors.resetFailed';
        }
        if (kind === 'register') {
            if (message === 'Too many authentication attempts' || message === 'Account temporarily locked') {
                return 'page.login.errors.rateLimited';
            }
            return 'page.login.errors.registerFailed';
        }
        if (kind === 'verify') {
            if (message === 'Verification link has expired') return 'expired';
            if (message === 'Verification link has already been used') return 'used';
            if (message === 'Verification link is invalid') return 'invalid';
            if (message === 'Too many authentication attempts' || message === 'Account temporarily locked') {
                return 'page.login.errors.rateLimited';
            }
            return 'page.login.errors.verifyFailed';
        }
        if (kind === 'resend-verification') {
            if (message === 'Too many authentication attempts' || message === 'Account temporarily locked') {
                return 'page.login.errors.rateLimited';
            }
            return 'page.login.errors.resendVerificationFailed';
        }
        return 'page.login.errors.generic';
    }

    function createAuthUiModel(input = {}) {
        const now = Number.isFinite(input.now) ? input.now : Date.now();
        const resetToken = String(input.token || '').trim();
        const verifyToken = String(input.verifyToken || '').trim();
        const requestedView = String(input.view || 'login');

        const resetResendUntil = Number(input.resendCooldownUntil || 0);
        const verifyResendUntil = Number(input.verificationResendCooldownUntil || 0);
        const resetCooldownSeconds = Math.max(0, Math.ceil((resetResendUntil - now) / 1000));
        const verifyCooldownSeconds = Math.max(0, Math.ceil((verifyResendUntil - now) / 1000));

        const resetInvalidReason = input.invalidReason && RESET_REASON_TO_COPY_KEY[input.invalidReason]
            ? input.invalidReason
            : 'invalid';
        const verifyInvalidReason = input.verifyInvalidReason && VERIFY_REASON_TO_COPY_KEY[input.verifyInvalidReason]
            ? input.verifyInvalidReason
            : 'invalid';

        let view = requestedView;
        if (requestedView === 'reset' && !resetToken) {
            view = 'reset-invalid';
        }
        if (requestedView === 'verify-loading' && !verifyToken) {
            view = 'verify-invalid';
        }
        if (!VIEW_COPY[view]) {
            view = 'login';
        }

        const isResetEmailView = view === 'check-email';
        const isVerifyEmailView = view === 'verify-check-email';
        const cooldownSeconds = isVerifyEmailView ? verifyCooldownSeconds : resetCooldownSeconds;
        const resendEnabled = isVerifyEmailView
            ? Boolean(input.lastVerificationEmail) && cooldownSeconds === 0
            : Boolean(input.lastEmail) && cooldownSeconds === 0;

        return {
            view,
            titleKey: VIEW_COPY[view].title,
            subtitleKey: VIEW_COPY[view].subtitle,
            resetToken,
            verifyToken,
            invalidReason: resetInvalidReason,
            verifyInvalidReason,
            invalidMessageKey: RESET_REASON_TO_COPY_KEY[resetInvalidReason],
            verifyInvalidMessageKey: VERIFY_REASON_TO_COPY_KEY[verifyInvalidReason],
            cooldownSeconds,
            resendEnabled,
        };
    }

    function createCooldownLabel(seconds) {
        return t('page.login.actions.resendCountdown', { seconds: Math.max(0, Math.ceil(seconds || 0)) });
    }

    function validateRegistrationPayload(payload = {}) {
        const email = String(payload.email || '').trim();
        const password = String(payload.password || '');
        const confirmPassword = String(payload.confirmPassword || '');
        const firstName = String(payload.firstName || '').trim();
        const lastName = String(payload.lastName || '').trim();
        const planCode = String(payload.planCode || 'trial').trim().toLowerCase();
        const errors = {};

        if (!email) {
            errors.email = 'page.login.validation.emailRequired';
        } else if (!email.includes('@')) {
            errors.email = 'page.login.validation.emailInvalid';
        }

        if (!password) {
            errors.password = 'page.login.validation.passwordRequired';
        } else if (password.length < 8) {
            errors.password = 'page.login.validation.passwordMinLength';
        } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
            errors.password = 'page.login.validation.passwordPolicy';
        }

        if (!confirmPassword) {
            errors.confirmPassword = 'page.login.validation.confirmPasswordRequired';
        } else if (confirmPassword !== password) {
            errors.confirmPassword = 'page.login.validation.passwordMismatch';
        }

        if (firstName.length > 100) {
            errors.firstName = 'page.login.validation.nameTooLong';
        }
        if (lastName.length > 100) {
            errors.lastName = 'page.login.validation.nameTooLong';
        }
        if (!['trial', 'solo'].includes(planCode)) {
            errors.planCode = 'page.login.validation.accountTypeInvalid';
        }

        return {
            valid: Object.keys(errors).length === 0,
            values: { email, password, confirmPassword, firstName, lastName, planCode },
            errors,
        };
    }

    function createAuthApp(options = {}) {
        const documentRef = options.document || global.document;
        const historyRef = options.history || global.history;
        const locationRef = options.location || global.location;
        const fetchFn = options.fetchFn || (global.fetch ? global.fetch.bind(global) : null);
        const supabaseFactory = options.supabaseFactory || global.supabase?.createClient;
        const getCurrentAstrologer = options.getCurrentAstrologer || global.AstroAPI?.getCurrentAstrologer?.bind(global.AstroAPI);
        // Loop breaker, shared with api.js requireAuth (see AUTH_BOUNCE_KEY there).
        const authBounceCount = options.authBounceCount
            || global.AstroAPI?.authBounceCount?.bind(global.AstroAPI)
            || (() => 0);
        const clearAuthBounces = options.clearAuthBounces
            || global.AstroAPI?.clearAuthBounces?.bind(global.AstroAPI)
            || (() => {});
        const wait = typeof options.wait === 'function'
            ? options.wait
            : (ms) => new Promise((resolve) => {
                global.setTimeout(resolve, ms);
            });
        const redirect = typeof options.redirect === 'function'
            ? options.redirect
            : (href) => {
                if (locationRef) {
                    locationRef.href = href;
                }
            };

        const state = {
            view: 'login',
            lastEmail: '',
            resetToken: '',
            resetInvalidReason: 'invalid',
            resetResendCooldownUntil: 0,
            showLoginPassword: false,
            showResetPassword: false,
            showResetConfirmPassword: false,
            loginCapsLock: false,
            resetCapsLock: false,

            lastVerificationEmail: '',
            verificationToken: '',
            verificationInvalidReason: 'invalid',
            verificationResendCooldownUntil: 0,
            showRegisterPassword: false,
            showRegisterConfirmPassword: false,
            registerCapsLock: false,
            // The backend determines the registration channel from an allowlisted
            // hostname. This value is only used for validation and analytics.
            registerPlanCode: 'trial',

            statusText: '',
            statusTone: 'info',
            loadingAction: '',
            supabaseClient: null,
            supabaseConfig: null,
            googleEnabled: false,
            soloMode: false,
        };

        const refs = {
            views: {},
            backButtons: [],
        };

        function getStatusCopy(key, params) {
            return t(key, params);
        }

        function clearStatus() {
            state.statusText = '';
            state.statusTone = 'info';
        }

        function setStatus(keyOrText, tone = 'info', params = {}, raw = false) {
            state.statusText = raw ? String(keyOrText || '') : getStatusCopy(keyOrText, params);
            state.statusTone = tone;
            render();
        }

        function setHistoryMode(mode) {
            if (!historyRef || typeof historyRef.replaceState !== 'function') return;
            let url = '/login.html';
            if (mode === 'reset' && state.resetToken) {
                url = `/login.html?mode=reset&token=${encodeURIComponent(state.resetToken)}`;
            } else if (mode === 'forgot') {
                url = '/login.html?mode=forgot';
            } else if (mode === 'reset-success') {
                url = '/login.html?mode=success';
            } else if (mode === 'register') {
                url = '/login.html?mode=register';
            } else if (mode === 'verify-loading' && state.verificationToken) {
                url = `/login.html?mode=verify&token=${encodeURIComponent(state.verificationToken)}`;
            } else if (mode === 'verify-success') {
                url = '/login.html?mode=verify-success';
            }
            historyRef.replaceState({}, documentRef?.title || '', url);
        }

        function setView(nextView, updates = {}) {
            if (updates.lastEmail !== undefined) state.lastEmail = updates.lastEmail;
            if (updates.resetToken !== undefined) state.resetToken = updates.resetToken;
            if (updates.resetInvalidReason) state.resetInvalidReason = updates.resetInvalidReason;
            if (updates.lastVerificationEmail !== undefined) state.lastVerificationEmail = updates.lastVerificationEmail;
            if (updates.verificationToken !== undefined) state.verificationToken = updates.verificationToken;
            if (updates.verificationInvalidReason) state.verificationInvalidReason = updates.verificationInvalidReason;
            state.view = nextView;
            if (updates.updateHistory !== false) {
                setHistoryMode(nextView);
            }
            render();
            focusCurrentView();
        }

        function setLoading(action) {
            state.loadingAction = action || '';
            render();
        }

        function updatePasswordToggle(button, visible) {
            if (!button) return;
            const actionKey = visible ? 'page.login.actions.hidePassword' : 'page.login.actions.showPassword';
            button.textContent = t(actionKey);
            button.setAttribute('aria-label', t(actionKey));
        }

        function setFieldError(input, errorEl, messageKey) {
            if (!input || !errorEl) return;
            if (!messageKey) {
                input.setAttribute('aria-invalid', 'false');
                errorEl.hidden = true;
                errorEl.textContent = '';
                return;
            }
            input.setAttribute('aria-invalid', 'true');
            errorEl.hidden = false;
            errorEl.textContent = t(messageKey);
        }

        function clearAllFieldErrors() {
            setFieldError(refs.email, refs.loginEmailError, '');
            setFieldError(refs.password, refs.loginPasswordError, '');
            setFieldError(refs.forgotEmail, refs.forgotEmailError, '');
            setFieldError(refs.resetPassword, refs.resetPasswordError, '');
            setFieldError(refs.resetPasswordConfirm, refs.resetPasswordConfirmError, '');
            setFieldError(refs.registerEmail, refs.registerEmailError, '');
            setFieldError(refs.registerPassword, refs.registerPasswordError, '');
            setFieldError(refs.registerPasswordConfirm, refs.registerPasswordConfirmError, '');
            setFieldError(refs.registerFirstName, refs.registerFirstNameError, '');
            setFieldError(refs.registerLastName, refs.registerLastNameError, '');
            setFieldError(refs.verifyResendEmail, refs.verifyResendEmailError, '');
        }

        function getViewModel() {
            return createAuthUiModel({
                view: state.view,
                token: state.resetToken,
                verifyToken: state.verificationToken,
                lastEmail: state.lastEmail,
                lastVerificationEmail: state.lastVerificationEmail,
                resendCooldownUntil: state.resetResendCooldownUntil,
                verificationResendCooldownUntil: state.verificationResendCooldownUntil,
                now: Date.now(),
                invalidReason: state.resetInvalidReason,
                verifyInvalidReason: state.verificationInvalidReason,
            });
        }

        function getViewKind(view) {
            if (view === 'check-email' || view === 'verify-check-email' || view === 'verify-loading') {
                return 'pending';
            }
            if (view === 'verify-success' || view === 'reset-success') {
                return 'success';
            }
            if (view === 'verify-invalid' || view === 'reset-invalid') {
                return 'warning';
            }
            return 'form';
        }

        function focusCurrentView() {
            const activeView = refs.views[state.view];
            if (!activeView || typeof activeView.querySelector !== 'function') return;
            const focusTarget = activeView.querySelector('input, button, [tabindex]:not([tabindex="-1"])');
            focusTarget?.focus?.();
        }

        function render() {
            if (!documentRef) return;
            const model = getViewModel();
            state.view = model.view;

            Object.entries(refs.views).forEach(([viewName, node]) => {
                if (!node) return;
                const isActive = viewName === model.view;
                node.hidden = !isActive;
                node.setAttribute('aria-hidden', isActive ? 'false' : 'true');
            });

            if (documentRef.body) {
                documentRef.body.dataset.authView = model.view;
                documentRef.body.dataset.authKind = getViewKind(model.view);
            }

            if (refs.authTitle) refs.authTitle.textContent = t(model.titleKey);
            if (refs.authSubtitle) refs.authSubtitle.textContent = t(model.subtitleKey);
            if (refs.statusBanner) {
                refs.statusBanner.hidden = !state.statusText;
                refs.statusBanner.dataset.tone = state.statusTone;
                refs.statusBanner.textContent = state.statusText;
            }

            if (refs.checkEmailBody) {
                refs.checkEmailBody.textContent = state.lastEmail
                    ? t('page.login.views.checkEmail.bodyWithEmail', { email: state.lastEmail })
                    : t('page.login.views.checkEmail.body');
            }
            if (refs.verifyCheckEmailBody) {
                refs.verifyCheckEmailBody.textContent = state.lastVerificationEmail
                    ? t('page.login.views.verifyCheckEmail.bodyWithEmail', { email: state.lastVerificationEmail })
                    : t('page.login.views.verifyCheckEmail.body');
            }
            if (refs.resetInvalidBody) {
                refs.resetInvalidBody.textContent = t(model.invalidMessageKey);
            }
            if (refs.verifyInvalidBody) {
                refs.verifyInvalidBody.textContent = t(model.verifyInvalidMessageKey);
            }

            [refs.googleLoginBtn, refs.googleRegisterBtn].forEach((googleBtn) => {
                if (!googleBtn) return;
                const secondaryAuth = googleBtn.closest?.('.login-secondary-auth');
                if (secondaryAuth) secondaryAuth.hidden = state.soloMode;
                googleBtn.disabled = !state.googleEnabled || Boolean(state.loadingAction);
                const googleIcon = '<svg class="btn-google-icon" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7955 2.7164v2.2581h2.9087c1.7018-1.5668 2.6832-3.874 2.6832-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.4673-.806 5.9564-2.1818l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z"/><path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9574C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9574 4.0418L3.964 10.71z"/><path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5814-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9574 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"/></svg>';
                const googleLabel = document.createElement('span');
                googleLabel.className = 'btn-google-label';
                googleLabel.textContent = t('page.login.actions.continueWithGoogle');
                googleBtn.innerHTML = googleIcon;
                googleBtn.appendChild(googleLabel);
            });
            if (refs.passwordLoginSubmit) {
                refs.passwordLoginSubmit.disabled = Boolean(state.loadingAction);
                refs.passwordLoginSubmit.textContent = t(
                    state.loadingAction === 'login'
                        ? 'page.login.actions.signingIn'
                        : 'page.login.actions.signIn'
                );
            }
            if (refs.registerSubmit) {
                refs.registerSubmit.disabled = Boolean(state.loadingAction);
                refs.registerSubmit.textContent = t(
                    state.loadingAction === 'register'
                        ? 'page.login.actions.creatingAccount'
                        : 'page.login.actions.createAccount'
                );
            }
            if (refs.forgotPasswordSubmit) {
                refs.forgotPasswordSubmit.disabled = Boolean(state.loadingAction);
                refs.forgotPasswordSubmit.textContent = t(
                    state.loadingAction === 'forgot'
                        ? 'page.login.actions.sendingResetLink'
                        : 'page.login.actions.sendResetLink'
                );
            }
            if (refs.resetPasswordSubmit) {
                refs.resetPasswordSubmit.disabled = Boolean(state.loadingAction);
                refs.resetPasswordSubmit.textContent = t(
                    state.loadingAction === 'reset'
                        ? 'page.login.actions.savingPassword'
                        : 'page.login.actions.setNewPassword'
                );
            }
            if (refs.resendResetLinkBtn) {
                refs.resendResetLinkBtn.disabled = state.view !== 'check-email' || !model.resendEnabled || Boolean(state.loadingAction);
                refs.resendResetLinkBtn.textContent = model.cooldownSeconds > 0
                    ? createCooldownLabel(model.cooldownSeconds)
                    : t('page.login.actions.resendLink');
            }
            if (refs.resendVerificationBtn) {
                const verifyModel = createAuthUiModel({
                    view: 'verify-check-email',
                    lastVerificationEmail: state.lastVerificationEmail,
                    verificationResendCooldownUntil: state.verificationResendCooldownUntil,
                    now: Date.now(),
                });
                refs.resendVerificationBtn.disabled = !verifyModel.resendEnabled || Boolean(state.loadingAction);
                refs.resendVerificationBtn.textContent = verifyModel.cooldownSeconds > 0
                    ? createCooldownLabel(verifyModel.cooldownSeconds)
                    : t('page.login.actions.resendVerification');
            }
            if (refs.verifyResendSubmit) {
                refs.verifyResendSubmit.disabled = Boolean(state.loadingAction);
                refs.verifyResendSubmit.textContent = t(
                    state.loadingAction === 'resend-verification'
                        ? 'page.login.actions.sendingVerification'
                        : 'page.login.actions.resendVerification'
                );
            }

            updatePasswordToggle(refs.toggleLoginPasswordBtn, state.showLoginPassword);
            updatePasswordToggle(refs.toggleResetPasswordBtn, state.showResetPassword);
            updatePasswordToggle(refs.toggleResetPasswordConfirmBtn, state.showResetConfirmPassword);
            updatePasswordToggle(refs.toggleRegisterPasswordBtn, state.showRegisterPassword);
            updatePasswordToggle(refs.toggleRegisterPasswordConfirmBtn, state.showRegisterConfirmPassword);

            if (refs.password) refs.password.type = state.showLoginPassword ? 'text' : 'password';
            if (refs.resetPassword) refs.resetPassword.type = state.showResetPassword ? 'text' : 'password';
            if (refs.resetPasswordConfirm) refs.resetPasswordConfirm.type = state.showResetConfirmPassword ? 'text' : 'password';
            if (refs.registerPassword) refs.registerPassword.type = state.showRegisterPassword ? 'text' : 'password';
            if (refs.registerPasswordConfirm) refs.registerPasswordConfirm.type = state.showRegisterConfirmPassword ? 'text' : 'password';

            if (refs.loginCapsHint) refs.loginCapsHint.hidden = !state.loginCapsLock;
            if (refs.resetCapsHint) refs.resetCapsHint.hidden = !state.resetCapsLock;
            if (refs.registerCapsHint) refs.registerCapsHint.hidden = !state.registerCapsLock;
        }

        function validateEmailField(input, errorEl) {
            const value = String(input?.value || '').trim();
            if (!value) {
                setFieldError(input, errorEl, 'page.login.validation.emailRequired');
                return null;
            }
            if (!value.includes('@')) {
                setFieldError(input, errorEl, 'page.login.validation.emailInvalid');
                return null;
            }
            setFieldError(input, errorEl, '');
            return value;
        }

        function validateLoginForm() {
            const email = validateEmailField(refs.email, refs.loginEmailError);
            const password = String(refs.password?.value || '');
            if (!password) {
                setFieldError(refs.password, refs.loginPasswordError, 'page.login.validation.passwordRequired');
                return null;
            }
            if (password.length < 8) {
                setFieldError(refs.password, refs.loginPasswordError, 'page.login.validation.passwordMinLength');
                return null;
            }
            setFieldError(refs.password, refs.loginPasswordError, '');
            return { email, password };
        }

        function validateRegisterForm() {
            const result = validateRegistrationPayload({
                email: refs.registerEmail?.value,
                password: refs.registerPassword?.value,
                confirmPassword: refs.registerPasswordConfirm?.value,
                firstName: refs.registerFirstName?.value,
                lastName: refs.registerLastName?.value,
                planCode: state.registerPlanCode,
            });

            setFieldError(refs.registerEmail, refs.registerEmailError, result.errors.email || '');
            setFieldError(refs.registerPassword, refs.registerPasswordError, result.errors.password || '');
            setFieldError(refs.registerPasswordConfirm, refs.registerPasswordConfirmError, result.errors.confirmPassword || '');
            setFieldError(refs.registerFirstName, refs.registerFirstNameError, result.errors.firstName || '');
            setFieldError(refs.registerLastName, refs.registerLastNameError, result.errors.lastName || '');

            if (!result.valid) {
                return null;
            }
            return result.values;
        }

        function validateResetForm() {
            const password = String(refs.resetPassword?.value || '');
            const confirmPassword = String(refs.resetPasswordConfirm?.value || '');
            let valid = true;

            if (!password) {
                setFieldError(refs.resetPassword, refs.resetPasswordError, 'page.login.validation.passwordRequired');
                valid = false;
            } else if (password.length < 8) {
                setFieldError(refs.resetPassword, refs.resetPasswordError, 'page.login.validation.passwordMinLength');
                valid = false;
            } else {
                setFieldError(refs.resetPassword, refs.resetPasswordError, '');
            }

            if (!confirmPassword) {
                setFieldError(refs.resetPasswordConfirm, refs.resetPasswordConfirmError, 'page.login.validation.confirmPasswordRequired');
                valid = false;
            } else if (confirmPassword !== password) {
                setFieldError(refs.resetPasswordConfirm, refs.resetPasswordConfirmError, 'page.login.validation.passwordMismatch');
                valid = false;
            } else {
                setFieldError(refs.resetPasswordConfirm, refs.resetPasswordConfirmError, '');
            }

            return valid ? { password } : null;
        }

        const SUPABASE_SESSION_POLL_ATTEMPTS = 20;
        const SUPABASE_SESSION_POLL_DELAY_MS = 300;

        async function readErrorMessage(response) {
            const payload = await response.json().catch(() => ({}));
            return extractErrorDetail(payload);
        }

        async function loadSupabaseConfig() {
            if (!fetchFn) return null;
            const response = await apiFetch(`${API_BASE}/auth/frontend-config`, {}, fetchFn);
            if (!response.ok) return null;
            const payload = await response.json();
            return payload || null;
        }

        async function waitForSupabaseAccessToken(initialError = null) {
            if (!state.supabaseClient?.auth?.getSession) {
                throw new Error('gse');
            }

            let lastError = initialError;
            for (let attempt = 0; attempt < SUPABASE_SESSION_POLL_ATTEMPTS; attempt += 1) {
                const sessionResult = await state.supabaseClient.auth.getSession();
                if (sessionResult?.error) {
                    lastError = sessionResult.error;
                } else {
                    const accessToken = sessionResult?.data?.session?.access_token;
                    if (accessToken) {
                        return accessToken;
                    }
                }

                if (attempt < SUPABASE_SESSION_POLL_ATTEMPTS - 1) {
                    await wait(SUPABASE_SESSION_POLL_DELAY_MS);
                }
            }

            throw lastError || new Error('gse');
        }

        async function waitForBackendSession() {
            if (!getCurrentAstrologer) {
                return null;
            }

            let lastError = null;
            for (let attempt = 0; attempt < SUPABASE_SESSION_POLL_ATTEMPTS; attempt += 1) {
                try {
                    const me = await getCurrentAstrologer();
                    if (me) {
                        return me;
                    }
                } catch (error) {
                    lastError = error;
                }

                if (attempt < SUPABASE_SESSION_POLL_ATTEMPTS - 1) {
                    await wait(SUPABASE_SESSION_POLL_DELAY_MS);
                }
            }

            throw lastError || new Error('backend_session_missing');
        }

        async function resolveSupabaseAccessTokenFromCallback() {
            if (!state.supabaseClient?.auth?.getSession) {
                throw new Error('gse');
            }

            const initialSession = await state.supabaseClient.auth.getSession();
            if (initialSession?.data?.session?.access_token) {
                return initialSession.data.session.access_token;
            }

            const code = new URLSearchParams(locationRef?.search || '').get('code');
            let exchangeError = initialSession?.error || null;

            if (code && typeof state.supabaseClient.auth.exchangeCodeForSession === 'function') {
                try {
                    const exchangeResult = await state.supabaseClient.auth.exchangeCodeForSession(code);
                    if (exchangeResult?.error) {
                        exchangeError = exchangeResult.error;
                    } else {
                        const accessToken = exchangeResult?.data?.session?.access_token;
                        if (accessToken) {
                            return accessToken;
                        }
                    }
                } catch (error) {
                    exchangeError = error;
                }
            }

            return waitForSupabaseAccessToken(exchangeError);
        }

        async function clearSupabaseOAuthSession() {
            if (!state.supabaseClient?.auth?.signOut) {
                return;
            }

            try {
                await state.supabaseClient.auth.signOut({ scope: 'local' });
            } catch (_error) {
                // Older clients may ignore scope options. Leaving the Supabase
                // session intact is safer than forcing a global sign-out here.
            }
        }

        async function loginWithPassword(event) {
            event.preventDefault();
            clearAllFieldErrors();
            clearStatus();
            const values = validateLoginForm();
            if (!values) {
                render();
                return;
            }

            setLoading('login');
            setStatus('page.login.status.signingIn', 'info');
            try {
                const response = await apiFetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(values),
                }, fetchFn);
                if (!response.ok) {
                    throw new Error(await readErrorMessage(response));
                }
                // Identify on THIS page so the anonymous session (carrying the ad
                // attribution) merges into the astrologer's person before we
                // navigate away.
                const me = await response.json().catch(() => null);
                if (me && typeof global.AstroAnalytics?.identify === 'function') {
                    global.AstroAnalytics.identify(me);
                }
                if (typeof global.AstroAnalytics?.track === 'function') {
                    global.AstroAnalytics.track('login', { method: 'password' });
                }
                redirect(getPostAuthRedirect(parseAuthRoute(locationRef?.search || '')));
            } catch (error) {
                const mapped = mapAuthErrorToKey('login', error.message);
                setStatus(mapped, 'error');
            } finally {
                setLoading('');
            }
        }

        async function loginWithGoogle() {
            if (!state.supabaseClient) {
                setStatus('page.login.errors.googleUnavailable', 'error');
                return;
            }
            setLoading('google');
            setStatus('page.login.status.googleRedirect', 'info');
            try {
                const route = parseAuthRoute(locationRef?.search || '');
                const next = route.next ? `&next=${encodeURIComponent(route.next)}` : '';
                const redirectTo = `${locationRef.origin}/login.html?oauth=callback${next}`;
                const result = await state.supabaseClient.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo },
                });
                if (result?.error) {
                    throw result.error;
                }
            } catch (error) {
                setStatus(mapAuthErrorToKey('google', error.message), 'error');
                setLoading('');
            }
        }

        async function registerWithPassword(event) {
            event.preventDefault();
            clearAllFieldErrors();
            clearStatus();

            const values = validateRegisterForm();
            if (!values) {
                render();
                return;
            }

            setLoading('register');
            setStatus('page.login.status.creatingAccount', 'info');
            try {
                const response = await apiFetch(`${API_BASE}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: values.email,
                        password: values.password,
                        first_name: values.firstName || null,
                        last_name: values.lastName || null,
                        locale: getCurrentLocale(),
                    }),
                }, fetchFn);
                if (!response.ok) {
                    throw new Error(await readErrorMessage(response));
                }
                await response.json().catch(() => ({}));
                // Registration conversion (email path): PostHog user_signed_up +
                // GA4 trial_start. The account isn't logged in yet, so this fires
                // on the anonymous session that holds the ad attribution;
                // identify() at first login merges it into the person. Deduped
                // per-email so a re-submit can't double-count.
                if (typeof global.AstroAnalytics?.signup === 'function') {
                    global.AstroAnalytics.signup('email', { plan_code: values.planCode }, 'email:' + values.email);
                }
                state.lastVerificationEmail = '';
                state.verificationResendCooldownUntil = 0;
                refs.email.value = values.email;
                refs.password.value = '';
                refs.registerPassword.value = '';
                refs.registerPasswordConfirm.value = '';
                setView('login');
                setStatus('page.login.status.accountReady', 'success');
            } catch (error) {
                setStatus(mapAuthErrorToKey('register', error.message), 'error');
            } finally {
                setLoading('');
            }
        }

        async function handleForgotPassword(event) {
            event.preventDefault();
            clearAllFieldErrors();
            clearStatus();
            const email = validateEmailField(refs.forgotEmail, refs.forgotEmailError);
            if (!email) {
                render();
                return;
            }

            setLoading('forgot');
            setStatus('page.login.status.sendingResetLink', 'info');
            try {
                const response = await apiFetch(`${API_BASE}/auth/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email }),
                }, fetchFn);
                if (!response.ok) {
                    throw new Error(await readErrorMessage(response));
                }
                const payload = await response.json();
                state.lastEmail = email;
                state.resetResendCooldownUntil = Date.now() + Number(payload.cooldown_seconds || 60) * 1000;
                clearStatus();
                setView('check-email');
            } catch (error) {
                setStatus(mapAuthErrorToKey('forgot', error.message), 'error');
            } finally {
                setLoading('');
            }
        }

        async function resendResetLink() {
            if (!state.lastEmail) return;
            const model = getViewModel();
            if (model.cooldownSeconds > 0) return;
            setLoading('forgot');
            setStatus('page.login.status.sendingResetLink', 'info');
            try {
                const response = await apiFetch(`${API_BASE}/auth/resend-reset-link`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: state.lastEmail }),
                }, fetchFn);
                if (!response.ok) {
                    throw new Error(await readErrorMessage(response));
                }
                const payload = await response.json();
                state.resetResendCooldownUntil = Date.now() + Number(payload.cooldown_seconds || 60) * 1000;
                clearStatus();
                render();
            } catch (error) {
                setStatus(mapAuthErrorToKey('forgot', error.message), 'error');
            } finally {
                setLoading('');
            }
        }

        async function resendVerificationLink() {
            if (!state.lastVerificationEmail) return;
            const model = createAuthUiModel({
                view: 'verify-check-email',
                lastVerificationEmail: state.lastVerificationEmail,
                verificationResendCooldownUntil: state.verificationResendCooldownUntil,
                now: Date.now(),
            });
            if (model.cooldownSeconds > 0) return;

            setLoading('resend-verification');
            setStatus('page.login.status.sendingVerification', 'info');
            try {
                const response = await apiFetch(`${API_BASE}/auth/resend-verification`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: state.lastVerificationEmail,
                        locale: getCurrentLocale(),
                    }),
                }, fetchFn);
                if (!response.ok) {
                    throw new Error(await readErrorMessage(response));
                }
                const payload = await response.json().catch(() => ({}));
                state.verificationResendCooldownUntil = Date.now() + Number(payload.cooldown_seconds || 60) * 1000;
                clearStatus();
                render();
            } catch (error) {
                setStatus(mapAuthErrorToKey('resend-verification', error.message), 'error');
            } finally {
                setLoading('');
            }
        }

        async function resendVerificationFromInvalid(event) {
            event.preventDefault();
            clearAllFieldErrors();
            clearStatus();
            const email = validateEmailField(refs.verifyResendEmail, refs.verifyResendEmailError);
            if (!email) {
                render();
                return;
            }

            setLoading('resend-verification');
            setStatus('page.login.status.sendingVerification', 'info');
            try {
                const response = await apiFetch(`${API_BASE}/auth/resend-verification`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email,
                        token: state.verificationToken || undefined,
                        locale: getCurrentLocale(),
                    }),
                }, fetchFn);
                if (!response.ok) {
                    throw new Error(await readErrorMessage(response));
                }
                const payload = await response.json().catch(() => ({}));
                state.lastVerificationEmail = email;
                state.verificationResendCooldownUntil = Date.now() + Number(payload.cooldown_seconds || 60) * 1000;
                refs.verifyResendEmail.value = '';
                clearStatus();
                setView('verify-check-email');
            } catch (error) {
                setStatus(mapAuthErrorToKey('resend-verification', error.message), 'error');
            } finally {
                setLoading('');
            }
        }

        async function handleResetPassword(event) {
            event.preventDefault();
            clearAllFieldErrors();
            clearStatus();
            const values = validateResetForm();
            if (!values) {
                render();
                return;
            }
            if (!state.resetToken) {
                state.resetInvalidReason = 'invalid';
                setView('reset-invalid');
                return;
            }

            setLoading('reset');
            setStatus('page.login.status.savingPassword', 'info');
            try {
                const response = await apiFetch(`${API_BASE}/auth/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: state.resetToken, password: values.password }),
                }, fetchFn);
                if (!response.ok) {
                    throw new Error(await readErrorMessage(response));
                }
                refs.resetPassword.value = '';
                refs.resetPasswordConfirm.value = '';
                state.resetToken = '';
                clearStatus();
                setView('reset-success');
            } catch (error) {
                const mapped = mapAuthErrorToKey('reset', error.message);
                if (mapped === 'expired' || mapped === 'used' || mapped === 'invalid') {
                    state.resetInvalidReason = mapped;
                    clearStatus();
                    setView('reset-invalid');
                } else {
                    setStatus(mapped, 'error');
                }
            } finally {
                setLoading('');
            }
        }

        function handleCapsLock(event, kind) {
            const active = Boolean(event?.getModifierState && event.getModifierState('CapsLock'));
            if (kind === 'login') {
                state.loginCapsLock = active;
            } else if (kind === 'reset') {
                state.resetCapsLock = active;
            } else {
                state.registerCapsLock = active;
            }
            render();
        }

        // Best-effort finalization after the session cookie is already set.
        // Every step is guarded: the login has succeeded server-side, so a
        // failure here must never block the caller's redirect.
        async function finalizeGoogleCallback(me) {
            try {
                await waitForBackendSession();
            } catch (_error) {
                // /auth/me not confirming yet (blocked/slow fetch, extension).
                // The cookie is set regardless; navigate and let the destination
                // route resolve the session.
            }
            try {
                await clearSupabaseOAuthSession();
            } catch (_error) { /* leaving the local Supabase session is harmless */ }
            if (historyRef?.replaceState) {
                try {
                    historyRef.replaceState({}, documentRef?.title || '', '/login.html');
                } catch (_error) { /* history may be unavailable — ignore */ }
            }
            // Identify on the callback page — the same PostHog instance that
            // held the anonymous, gclid-tagged session — before redirecting,
            // so ad attribution and the account merge into one person.
            try {
                if (me && typeof global.AstroAnalytics?.identify === 'function') {
                    global.AstroAnalytics.identify(me);
                }
                if (me && me.is_new_user && typeof global.AstroAnalytics?.signup === 'function') {
                    // First Google sign-in == registration. The backend is
                    // authoritative on new-vs-returning; dedupe by id as a guard.
                    global.AstroAnalytics.signup('google', {}, 'id:' + me.id);
                } else if (typeof global.AstroAnalytics?.track === 'function') {
                    global.AstroAnalytics.track('login', { method: 'google' });
                }
            } catch (_error) { /* analytics must never block the redirect */ }
        }

        async function exchangeSupabaseSessionIfNeeded() {
            const route = parseAuthRoute(locationRef?.search || '');
            if (!route.oauthCallback || !state.supabaseClient) return;
            setLoading('google');
            setStatus('page.login.status.completingGoogle', 'info');
            try {
                if (route.oauthError) {
                    throw new Error(route.oauthError);
                }
                const accessToken = await resolveSupabaseAccessTokenFromCallback();
                const response = await apiFetch(`${API_BASE}/auth/google`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ access_token: accessToken }),
                }, fetchFn);
                if (!response.ok) {
                    throw new Error(await readErrorMessage(response));
                }
                // A 2xx here means the backend already issued the session cookie
                // (POST /auth/google → issue_session). From this point the login
                // has SUCCEEDED; nothing below is allowed to strand the user back
                // on the login page. The session-readiness poll, Supabase cleanup
                // and analytics are all best-effort — a failure in any of them
                // (blocked fetch, extension, transient /auth/me hiccup) must still
                // let the redirect fire, or the user sits on /login.html with a
                // perfectly valid session. See finalizeGoogleCallback below.
                const me = await response.json().catch(() => null);
                await finalizeGoogleCallback(me);
                redirect(getPostAuthRedirect(route));
            } catch (error) {
                setStatus(mapAuthErrorToKey('google', error.message), 'error');
                setLoading('');
            }
        }

        async function verifyEmailTokenByRoute() {
            if (!state.verificationToken) {
                state.verificationInvalidReason = 'invalid';
                setView('verify-invalid', { updateHistory: false });
                return;
            }
            setView('verify-loading', { updateHistory: false });
            setLoading('verify');
            setStatus('page.login.status.verifyingEmail', 'info');
            try {
                const response = await apiFetch(`${API_BASE}/auth/verify-email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: state.verificationToken }),
                }, fetchFn);
                if (!response.ok) {
                    throw new Error(await readErrorMessage(response));
                }
                clearStatus();
                setView('verify-success', { updateHistory: false });
            } catch (error) {
                const mapped = mapAuthErrorToKey('verify', error.message);
                if (mapped === 'expired' || mapped === 'used' || mapped === 'invalid') {
                    state.verificationInvalidReason = mapped;
                    clearStatus();
                    setView('verify-invalid', { updateHistory: false });
                } else {
                    setStatus(mapped, 'error');
                }
            } finally {
                setLoading('');
            }
        }

        async function maybeRedirectAuthenticatedUser(route) {
            if (!getCurrentAstrologer || route.oauthCallback || route.mode === 'reset' || route.mode === 'verify') {
                return false;
            }
            const me = await getCurrentAstrologer();
            if (!me) {
                // Signed out (or unverifiable): the sign-in form is the right
                // place to be, so the hand-off chain ends here.
                clearAuthBounces();
                return false;
            }
            // The session looks valid from here, yet the page that sent us here
            // concluded it wasn't. Sending the user back restarts the ping-pong,
            // so after a couple of hand-offs stop and let them sign in by hand.
            if (authBounceCount() >= MAX_AUTH_BOUNCES) {
                clearAuthBounces();
                return false;
            }
            redirect(getPostAuthRedirect(route));
            return true;
        }

        function bindEvents() {
            refs.passwordLoginForm?.addEventListener('submit', loginWithPassword);
            refs.registerForm?.addEventListener('submit', registerWithPassword);
            refs.forgotPasswordForm?.addEventListener('submit', handleForgotPassword);
            refs.resetPasswordForm?.addEventListener('submit', handleResetPassword);
            refs.verifyResendForm?.addEventListener('submit', resendVerificationFromInvalid);
            refs.googleLoginBtn?.addEventListener('click', loginWithGoogle);
            refs.googleRegisterBtn?.addEventListener('click', loginWithGoogle);
            refs.showForgotBtn?.addEventListener('click', () => setView('forgot'));
            refs.showRegisterBtn?.addEventListener('click', () => setView('register'));
            refs.openRegisterFromVerifyBtn?.addEventListener('click', () => setView('register'));
            refs.resendResetLinkBtn?.addEventListener('click', resendResetLink);
            refs.resendVerificationBtn?.addEventListener('click', resendVerificationLink);
            refs.backButtons.forEach((button) => {
                button.addEventListener('click', () => setView('login'));
            });
            refs.openForgotBtn?.addEventListener('click', () => setView('forgot'));

            refs.toggleLoginPasswordBtn?.addEventListener('click', () => {
                state.showLoginPassword = !state.showLoginPassword;
                render();
            });
            refs.toggleResetPasswordBtn?.addEventListener('click', () => {
                state.showResetPassword = !state.showResetPassword;
                render();
            });
            refs.toggleResetPasswordConfirmBtn?.addEventListener('click', () => {
                state.showResetConfirmPassword = !state.showResetConfirmPassword;
                render();
            });
            refs.toggleRegisterPasswordBtn?.addEventListener('click', () => {
                state.showRegisterPassword = !state.showRegisterPassword;
                render();
            });
            refs.toggleRegisterPasswordConfirmBtn?.addEventListener('click', () => {
                state.showRegisterConfirmPassword = !state.showRegisterConfirmPassword;
                render();
            });

            refs.password?.addEventListener('keydown', (event) => handleCapsLock(event, 'login'));
            refs.password?.addEventListener('keyup', (event) => handleCapsLock(event, 'login'));
            refs.password?.addEventListener('blur', () => {
                state.loginCapsLock = false;
                render();
            });

            refs.resetPassword?.addEventListener('keydown', (event) => handleCapsLock(event, 'reset'));
            refs.resetPassword?.addEventListener('keyup', (event) => handleCapsLock(event, 'reset'));
            refs.resetPassword?.addEventListener('blur', () => {
                state.resetCapsLock = false;
                render();
            });

            refs.registerPassword?.addEventListener('keydown', (event) => handleCapsLock(event, 'register'));
            refs.registerPassword?.addEventListener('keyup', (event) => handleCapsLock(event, 'register'));
            refs.registerPassword?.addEventListener('blur', () => {
                state.registerCapsLock = false;
                render();
            });

            documentRef?.addEventListener?.('frontend:locale-changed', () => render());
        }

        function cacheRefs() {
            if (!documentRef) return;
            refs.authTitle = documentRef.getElementById('authTitle');
            refs.authSubtitle = documentRef.getElementById('authSubtitle');
            refs.statusBanner = documentRef.getElementById('statusBanner');
            refs.googleLoginBtn = documentRef.getElementById('googleLoginBtn');
            refs.googleRegisterBtn = documentRef.getElementById('googleRegisterBtn');
            refs.passwordLoginForm = documentRef.getElementById('passwordLoginForm');
            refs.registerForm = documentRef.getElementById('registerForm');
            refs.forgotPasswordForm = documentRef.getElementById('forgotPasswordForm');
            refs.resetPasswordForm = documentRef.getElementById('resetPasswordForm');
            refs.verifyResendForm = documentRef.getElementById('verifyResendForm');
            refs.passwordLoginSubmit = documentRef.getElementById('passwordLoginSubmit');
            refs.registerSubmit = documentRef.getElementById('registerSubmit');
            refs.forgotPasswordSubmit = documentRef.getElementById('forgotPasswordSubmit');
            refs.resetPasswordSubmit = documentRef.getElementById('resetPasswordSubmit');
            refs.verifyResendSubmit = documentRef.getElementById('verifyResendSubmit');
            refs.showForgotBtn = documentRef.getElementById('showForgotBtn');
            refs.showRegisterBtn = documentRef.getElementById('showRegisterBtn');
            refs.openRegisterFromVerifyBtn = documentRef.getElementById('openRegisterFromVerifyBtn');
            refs.resendResetLinkBtn = documentRef.getElementById('resendResetLinkBtn');
            refs.resendVerificationBtn = documentRef.getElementById('resendVerificationBtn');
            refs.openForgotBtn = documentRef.querySelector('[data-action="open-forgot"]');
            refs.toggleLoginPasswordBtn = documentRef.getElementById('toggleLoginPasswordBtn');
            refs.toggleResetPasswordBtn = documentRef.getElementById('toggleResetPasswordBtn');
            refs.toggleResetPasswordConfirmBtn = documentRef.getElementById('toggleResetPasswordConfirmBtn');
            refs.toggleRegisterPasswordBtn = documentRef.getElementById('toggleRegisterPasswordBtn');
            refs.toggleRegisterPasswordConfirmBtn = documentRef.getElementById('toggleRegisterPasswordConfirmBtn');

            refs.email = documentRef.getElementById('email');
            refs.password = documentRef.getElementById('password');
            refs.forgotEmail = documentRef.getElementById('forgotEmail');
            refs.resetPassword = documentRef.getElementById('resetPassword');
            refs.resetPasswordConfirm = documentRef.getElementById('resetPasswordConfirm');
            refs.registerEmail = documentRef.getElementById('registerEmail');
            refs.registerPassword = documentRef.getElementById('registerPassword');
            refs.registerPasswordConfirm = documentRef.getElementById('registerPasswordConfirm');
            refs.registerFirstName = documentRef.getElementById('registerFirstName');
            refs.registerLastName = documentRef.getElementById('registerLastName');
            refs.verifyResendEmail = documentRef.getElementById('verifyResendEmail');

            refs.loginEmailError = documentRef.getElementById('loginEmailError');
            refs.loginPasswordError = documentRef.getElementById('loginPasswordError');
            refs.forgotEmailError = documentRef.getElementById('forgotEmailError');
            refs.resetPasswordError = documentRef.getElementById('resetPasswordError');
            refs.resetPasswordConfirmError = documentRef.getElementById('resetPasswordConfirmError');
            refs.registerEmailError = documentRef.getElementById('registerEmailError');
            refs.registerPasswordError = documentRef.getElementById('registerPasswordError');
            refs.registerPasswordConfirmError = documentRef.getElementById('registerPasswordConfirmError');
            refs.registerFirstNameError = documentRef.getElementById('registerFirstNameError');
            refs.registerLastNameError = documentRef.getElementById('registerLastNameError');
            refs.verifyResendEmailError = documentRef.getElementById('verifyResendEmailError');

            refs.loginCapsHint = documentRef.getElementById('loginCapsHint');
            refs.resetCapsHint = documentRef.getElementById('resetCapsHint');
            refs.registerCapsHint = documentRef.getElementById('registerCapsHint');

            refs.checkEmailBody = documentRef.getElementById('checkEmailBody');
            refs.verifyCheckEmailBody = documentRef.getElementById('verifyCheckEmailBody');
            refs.resetInvalidBody = documentRef.getElementById('resetInvalidBody');
            refs.verifyInvalidBody = documentRef.getElementById('verifyInvalidBody');
            refs.backButtons = Array.from(documentRef.querySelectorAll('[data-action="back-login"]'));
            documentRef.querySelectorAll('[data-view]').forEach((node) => {
                refs.views[node.dataset.view] = node;
            });
        }

        async function init() {
            if (!documentRef || !fetchFn) return;
            await waitForI18nReady();
            cacheRefs();
            bindEvents();

            const route = parseAuthRoute(locationRef?.search || '');
            state.resetToken = route.token;
            state.verificationToken = route.token;
            state.registerPlanCode = 'trial';
            state.view = route.mode === 'forgot'
                ? 'forgot'
                : route.mode === 'success'
                    ? 'reset-success'
                    : route.mode === 'reset'
                        ? (route.token ? 'reset' : 'reset-invalid')
                        : route.mode === 'register'
                            ? 'register'
                            : route.mode === 'verify'
                                ? (route.token ? 'verify-loading' : 'verify-invalid')
                                : route.mode === 'verify-success'
                                    ? 'verify-success'
                                    : 'login';
            if (state.view === 'reset-invalid') {
                state.resetInvalidReason = 'invalid';
            }
            if (state.view === 'verify-invalid') {
                state.verificationInvalidReason = 'invalid';
            }

            if (route.locale && global.FrontendI18n?.setLocale) {
                await global.FrontendI18n.setLocale(route.locale, { persist: false, source: 'auth-verify-link' }).catch(() => {});
            }

            render();
            if (await maybeRedirectAuthenticatedUser(route)) {
                return;
            }

            state.supabaseConfig = await loadSupabaseConfig();
            state.soloMode = Boolean(state.supabaseConfig?.solo_mode);
            state.registerPlanCode = state.soloMode ? 'solo' : 'trial';
            if (state.supabaseConfig && state.supabaseConfig.supabase_url && state.supabaseConfig.supabase_anon_key && supabaseFactory) {
                state.supabaseClient = supabaseFactory(
                    state.supabaseConfig.supabase_url,
                    state.supabaseConfig.supabase_anon_key,
                    {
                        auth: {
                            detectSessionInUrl: true,
                            persistSession: true,
                            autoRefreshToken: true,
                            flowType: 'pkce',
                        },
                    }
                );
                state.googleEnabled = !state.soloMode;
            }
            render();

            if (route.oauthCallback) {
                await exchangeSupabaseSessionIfNeeded();
                return;
            }

            if (route.mode === 'verify') {
                await verifyEmailTokenByRoute();
            }

            const cooldownTimer = global.setInterval?.(() => {
                if (state.view !== 'check-email' && state.view !== 'verify-check-email') {
                    return;
                }
                // Keep rendering while the email-check views are open so the countdown
                // always reaches zero and the button is re-enabled.
                render();
            }, 1000);
            cooldownTimer?.unref?.();
        }

        return {
            state,
            init,
            render,
            setView,
            maybeRedirectAuthenticatedUser,
            parseAuthRoute,
            createAuthUiModel,
            mapAuthErrorToKey,
            createCooldownLabel,
            validateRegistrationPayload,
            normalizeLocalRedirect,
            getPostAuthRedirect,
        };
    }

    const exported = {
        parseAuthRoute,
        createAuthUiModel,
        mapAuthErrorToKey,
        createCooldownLabel,
        validateRegistrationPayload,
        normalizeLocalRedirect,
        getPostAuthRedirect,
        createAuthApp,
    };

    global.AstroLogin = exported;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = exported;
    }

    if (global.document) {
        global.document.addEventListener('DOMContentLoaded', () => {
            const app = createAuthApp();
            app.init().catch(() => {
                app.state.statusText = t('page.login.errors.initFailed');
                app.state.statusTone = 'error';
                app.render();
            });
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);

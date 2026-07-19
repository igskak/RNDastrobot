/**
 * Injects a global language switcher into frontend pages.
 */
(function () {
    'use strict';

    function shouldRenderSwitcher() {
        const body = document?.body;
        if (!body) return true;

        const hiddenOnPages = [
            'chart-page',
            'forecast-page',
            'forecast-new-page',
            'natal-full-page',
            'synastry-page',
            'interpretations-page',
            'login-page',
            'calendar-page', // burger nav (app-nav.js) provides the language switch
        ];

        return !hiddenOnPages.some((className) => body.classList.contains(className));
    }

    function resolveMountTarget() {
        const landingHeaderActions = document.querySelector('.landing-header-actions');
        if (landingHeaderActions) {
            return {
                parent: landingHeaderActions,
                beforeNode: landingHeaderActions.querySelector('.index-header-link-primary'),
                inline: true
            };
        }

        const clientsHeaderActions = document.querySelector('.clients-header-actions');
        if (clientsHeaderActions) {
            return {
                parent: clientsHeaderActions,
                beforeNode: clientsHeaderActions.querySelector('.btn-logout'),
                inline: true
            };
        }

        const forecastHeader = document.querySelector('.forecast-header');
        if (forecastHeader) {
            return {
                parent: forecastHeader,
                beforeNode: forecastHeader.querySelector('.help-btn'),
                inline: true
            };
        }

        const chartHeader = document.querySelector('.chart-header-compact');
        if (chartHeader) {
            return {
                parent: chartHeader,
                beforeNode: chartHeader.querySelector('.header-nav-buttons'),
                inline: true
            };
        }

        const natalHeaderContent = document.querySelector('.natal-header .header-content');
        if (natalHeaderContent) {
            return {
                parent: natalHeaderContent,
                beforeNode: natalHeaderContent.querySelector('.header-actions'),
                inline: true
            };
        }

        const genericHeader = document.querySelector('.header');
        if (genericHeader) {
            return {
                parent: genericHeader,
                beforeNode: null,
                inline: true
            };
        }

        const accountSettingsActions = document.querySelector('.account-settings-actions');
        if (accountSettingsActions) {
            return {
                parent: accountSettingsActions,
                beforeNode: accountSettingsActions.querySelector('#restoreStandardDefaultsBtn'),
                inline: true
            };
        }

        return {
            parent: document.body,
            beforeNode: null,
            inline: false
        };
    }

    function getLocaleShortLabel(locale) {
        const labels = {
            en: 'EN',
            uk: 'УКР',
            ru: 'RU',
        };
        return labels[locale] || String(locale || '').toUpperCase();
    }

    function getLocaleFullLabel(locale) {
        return window.FrontendI18n?.t?.(`locale.name.${locale}`) || getLocaleShortLabel(locale);
    }

    function buildLocaleButton(locale) {
        const active = locale === window.FrontendI18n.getLocale();
        return `
            <button
                class="locale-switcher-option${active ? ' is-active' : ''}"
                type="button"
                data-locale="${locale}"
                aria-pressed="${active ? 'true' : 'false'}"
                title="${getLocaleFullLabel(locale)}"
            >${getLocaleShortLabel(locale)}</button>
        `;
    }

    function renderSwitcher() {
        if (!document || document.getElementById('localeSwitcher')) {
            return;
        }
        if (!window.FrontendI18n) {
            return;
        }
        if (!shouldRenderSwitcher()) {
            return;
        }

        const switcher = document.createElement('div');
        switcher.id = 'localeSwitcher';
        switcher.className = 'locale-switcher';

        switcher.setAttribute('role', 'group');
        switcher.setAttribute('aria-label', window.FrontendI18n.t('app.language'));
        switcher.innerHTML = window.FrontendI18n.SUPPORTED_LOCALES.map(buildLocaleButton).join('');

        const mount = resolveMountTarget();
        switcher.classList.add(mount.inline ? 'locale-switcher--inline' : 'locale-switcher--floating');

        switcher.addEventListener('click', async (event) => {
            const button = event.target?.closest?.('[data-locale]');
            if (!button) return;
            const locale = button.dataset.locale;
            if (!locale || locale === window.FrontendI18n.getLocale()) return;
            await window.FrontendI18n.setLocale(locale, { source: 'switcher' });
        });

        if (mount.beforeNode) {
            mount.parent.insertBefore(switcher, mount.beforeNode);
        } else {
            mount.parent.appendChild(switcher);
        }

        document.addEventListener('frontend:locale-changed', (event) => {
            const locale = event?.detail?.locale || window.FrontendI18n.getLocale();
            switcher.setAttribute('aria-label', window.FrontendI18n.t('app.language'));
            switcher.querySelectorAll('[data-locale]').forEach((button) => {
                const isActive = button.dataset.locale === locale;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
                button.setAttribute('title', getLocaleFullLabel(button.dataset.locale));
            });
        });
    }

    function bootstrap(triesLeft) {
        renderSwitcher();
        if (!document.getElementById('localeSwitcher') && triesLeft > 0) {
            setTimeout(() => bootstrap(triesLeft - 1), 120);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => bootstrap(40));
    } else {
        bootstrap(40);
    }
})();

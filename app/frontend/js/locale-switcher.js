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
            'natal-full-page',
            'synastry-page',
            'interpretations-page',
            'login-page',
        ];

        return !hiddenOnPages.some((className) => body.classList.contains(className));
    }

    function resolveMountTarget() {
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

        return {
            parent: document.body,
            beforeNode: null,
            inline: false
        };
    }

    function buildOption(locale) {
        const title = window.FrontendI18n?.t?.(`locale.name.${locale}`) || locale.toUpperCase();
        return `<option value="${locale}">${title}</option>`;
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

        switcher.innerHTML = `
            <label class="locale-switcher-label" for="localeSwitcherSelect">${window.FrontendI18n.t('app.language')}</label>
            <select id="localeSwitcherSelect" class="locale-switcher-select" aria-label="${window.FrontendI18n.t('app.language')}">
                ${window.FrontendI18n.SUPPORTED_LOCALES.map(buildOption).join('')}
            </select>
        `;

        const mount = resolveMountTarget();
        switcher.classList.add(mount.inline ? 'locale-switcher--inline' : 'locale-switcher--floating');

        const select = switcher.querySelector('#localeSwitcherSelect');
        select.value = window.FrontendI18n.getLocale();
        select.addEventListener('change', async (event) => {
            await window.FrontendI18n.setLocale(event.target.value, { source: 'switcher' });
        });

        if (mount.beforeNode) {
            mount.parent.insertBefore(switcher, mount.beforeNode);
        } else {
            mount.parent.appendChild(switcher);
        }

        document.addEventListener('frontend:locale-changed', (event) => {
            const locale = event?.detail?.locale || window.FrontendI18n.getLocale();
            select.value = locale;
            const label = switcher.querySelector('.locale-switcher-label');
            if (label) {
                const title = window.FrontendI18n.t('app.language');
                label.textContent = title;
                select.setAttribute('aria-label', title);
            }
            Array.from(select.options).forEach((option) => {
                option.textContent = window.FrontendI18n.t(`locale.name.${option.value}`);
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

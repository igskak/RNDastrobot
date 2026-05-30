/**
 * forecast-nav-menu.js — wires the forecast navigation dropdown.
 *
 * Markup contract (next to the existing "Forecast" header button):
 *   <div class="forecast-nav-menu">
 *     <a href="forecast-new.html" ...>Forecast</a>
 *     <button data-forecast-nav-toggle aria-expanded="false">▾</button>
 *     <div class="forecast-nav-dropdown hidden">
 *       <a href="forecast-timeline.html">Timeline</a>
 *       <a href="forecast-tables.html">Tables</a>
 *     </div>
 *   </div>
 *
 * Self-initializing: binds every toggle on the page, closes on outside click
 * or Escape. Safe to include on any page (no-ops when markup is absent).
 */
(function () {
    'use strict';

    function closeAll(except) {
        document.querySelectorAll('.forecast-nav-menu').forEach((menu) => {
            if (menu === except) return;
            const toggle = menu.querySelector('[data-forecast-nav-toggle]');
            const dropdown = menu.querySelector('.forecast-nav-dropdown');
            dropdown?.classList.add('hidden');
            toggle?.setAttribute('aria-expanded', 'false');
        });
    }

    function init() {
        const toggles = document.querySelectorAll('[data-forecast-nav-toggle]');
        if (!toggles.length) return;

        toggles.forEach((toggle) => {
            const menu = toggle.closest('.forecast-nav-menu');
            const dropdown = menu?.querySelector('.forecast-nav-dropdown');
            if (!dropdown) return;
            toggle.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const isOpen = !dropdown.classList.contains('hidden');
                closeAll(menu);
                dropdown.classList.toggle('hidden', isOpen);
                toggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
            });
        });

        document.addEventListener('click', (event) => {
            if (!event.target.closest('.forecast-nav-menu')) closeAll(null);
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeAll(null);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

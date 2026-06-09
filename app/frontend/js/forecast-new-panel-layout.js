/**
 * forecast-new-panel-layout.js
 *
 * Pure, DOM-free layout model for the configurable forecast-new side panels.
 *
 * A "block" is one unit of information that already renders into a fixed DOM
 * container (e.g. the natal planets table). A "tab" groups one or more blocks
 * and may carry a user-defined title. A "panel" (left|right) holds an ordered
 * list of tabs. Layout is stored per wheel mode: 'multi' and 'single'.
 *
 * Block identity = { source: 'natal'|'prog', view: <viewKey> }, blockKey =
 * `${source}:${view}`. Each blockKey maps to exactly ONE physical DOM container
 * and ONE renderer instance (see BLOCK_TARGET_MAP). Therefore a blockKey may
 * appear at most once per wheel mode — `normalizeLayout` enforces this.
 *
 * In 'single' wheel mode only the natal wheel exists, so every block is forced
 * to source 'natal' and rendered into the natal* containers (the legacy reuse
 * of prog* containers for natal data is dropped).
 *
 * Persisted under chart_defaults.forecast_new.panels. The backend deep-merge
 * replaces lists wholesale, so callers must always PATCH the full normalized
 * object.
 */
(function (root) {
    'use strict';

    var SCHEMA_VERSION = 1;

    // Canonical view catalog. Order here is the default tab order.
    var VIEW_KEYS = ['planets', 'houses', 'aspects', 'grid', 'configs', 'balances', 'rulers'];

    // i18n keys for auto-titling a tab from its (first) block's view.
    var VIEW_I18N = {
        planets: 'page.chart.tabs.planets',
        houses: 'page.chart.tabs.houses',
        aspects: 'page.chart.tabs.aspects',
        grid: 'page.forecastNew.tabs.grid',
        configs: 'page.forecastNew.tabs.configs',
        balances: 'page.forecastNew.tabs.balances',
        rulers: 'page.chart.tabs.rulers',
    };

    var SOURCES = ['natal', 'prog'];

    function viewToContainerSuffix(view) {
        // grid -> GridView, configs -> ConfigsView, etc. Matches the ids in
        // forecast-new.html (natalGridView, progConfigsView, ...).
        var cap = view.charAt(0).toUpperCase() + view.slice(1);
        return cap + 'View';
    }

    /**
     * Canonical block -> physical render target map. This is the authority for
     * what is realizable; normalizeLayout validates against it (not live DOM,
     * so the function stays pure/testable).
     *
     * containerId: the .panel-tab-content style div that holds the block.
     * rendererKey: which renderer instance owns it ('natal' | 'prog').
     */
    var BLOCK_TARGET_MAP = (function buildTargetMap() {
        var map = {};
        SOURCES.forEach(function (source) {
            VIEW_KEYS.forEach(function (view) {
                var key = source + ':' + view;
                map[key] = {
                    source: source,
                    view: view,
                    containerId: source + viewToContainerSuffix(view),
                    rendererKey: source, // natal blocks -> natalRenderer, prog -> prognosticRenderer
                };
            });
        });
        return map;
    })();

    function isValidView(view) {
        return VIEW_KEYS.indexOf(view) !== -1;
    }

    function blockKeyOf(block) {
        return block.source + ':' + block.view;
    }

    function makeTabId() {
        if (root.crypto && typeof root.crypto.randomUUID === 'function') {
            return 't_' + root.crypto.randomUUID().slice(0, 8);
        }
        return 't_' + Math.random().toString(36).slice(2, 10);
    }

    function defaultTabId(mode, side, view) {
        return mode + '-' + side + '-' + view;
    }

    /** One single-block tab for a given source/view. */
    function singleBlockTab(mode, side, source, view) {
        return {
            id: defaultTabId(mode, side, view),
            title: null, // null => auto from first block view
            blocks: [{ source: source, view: view }],
        };
    }

    /**
     * Default layout — reproduces today's hardcoded forecast-new UX 1:1 so
     * existing users see no change when they have no saved panels config.
     */
    function buildDefaultForecastNewLayout() {
        var layout = { schema_version: SCHEMA_VERSION, panels: {} };

        // multi: left = 7 natal tabs, right = 7 prog tabs (current order).
        layout.panels.multi = {
            left: VIEW_KEYS.map(function (v) { return singleBlockTab('multi', 'left', 'natal', v); }),
            right: VIEW_KEYS.map(function (v) { return singleBlockTab('multi', 'right', 'prog', v); }),
        };

        // single: natal-only. left = planets/aspects/grid, right = houses/configs/balances/rulers
        // (matches legacy normalizeSingleLeftTab / normalizeSingleRightTab).
        var singleLeftViews = ['planets', 'aspects', 'grid'];
        var singleRightViews = ['houses', 'configs', 'balances', 'rulers'];
        layout.panels.single = {
            left: singleLeftViews.map(function (v) { return singleBlockTab('single', 'left', 'natal', v); }),
            right: singleRightViews.map(function (v) { return singleBlockTab('single', 'right', 'natal', v); }),
        };

        return layout;
    }

    function normalizePanelArray(tabs, mode, side, seenBlockKeys, seenTabIds) {
        if (!Array.isArray(tabs)) return [];
        var out = [];
        tabs.forEach(function (rawTab) {
            if (!rawTab || typeof rawTab !== 'object') return;

            // --- blocks ---
            var rawBlocks = Array.isArray(rawTab.blocks) ? rawTab.blocks : [];
            var blocks = [];
            rawBlocks.forEach(function (b) {
                if (!b || typeof b !== 'object') return;
                var view = b.view;
                if (!isValidView(view)) return; // drop unknown view
                var source = b.source === 'prog' ? 'prog' : 'natal';
                if (mode === 'single') source = 'natal'; // single = natal only
                var key = source + ':' + view;
                if (!BLOCK_TARGET_MAP[key]) return; // not DOM-realizable
                if (seenBlockKeys[key]) return; // dedup across the whole mode
                seenBlockKeys[key] = true;
                blocks.push({ source: source, view: view });
            });

            if (blocks.length === 0) return; // drop empty tabs

            // --- id ---
            var id = typeof rawTab.id === 'string' && rawTab.id ? rawTab.id : '';
            if (!id || seenTabIds[id]) id = makeTabId();
            while (seenTabIds[id]) id = makeTabId();
            seenTabIds[id] = true;

            // --- title ---
            var title = (typeof rawTab.title === 'string' && rawTab.title.trim()) ? rawTab.title : null;

            out.push({ id: id, title: title, blocks: blocks });
        });
        return out;
    }

    /**
     * Sanitize an arbitrary (possibly corrupt / partial / legacy) layout into a
     * DOM-realizable, deduped, versioned layout. Falls back to defaults per
     * mode when a mode is unusable.
     */
    function normalizeLayout(raw) {
        var fallback = buildDefaultForecastNewLayout();
        if (!raw || typeof raw !== 'object' || !raw.panels || typeof raw.panels !== 'object') {
            return fallback;
        }

        var result = { schema_version: SCHEMA_VERSION, panels: {} };

        ['multi', 'single'].forEach(function (mode) {
            var rawMode = raw.panels[mode] && typeof raw.panels[mode] === 'object' ? raw.panels[mode] : {};
            var seenBlockKeys = {};
            var seenTabIds = {};
            var left = normalizePanelArray(rawMode.left, mode, 'left', seenBlockKeys, seenTabIds);
            var right = normalizePanelArray(rawMode.right, mode, 'right', seenBlockKeys, seenTabIds);

            // If a mode is entirely empty (no usable tabs anywhere), rebuild it
            // from defaults so the user is never stranded with blank panels.
            if (left.length === 0 && right.length === 0) {
                result.panels[mode] = fallback.panels[mode];
            } else {
                result.panels[mode] = { left: left, right: right };
            }
        });

        return result;
    }

    /**
     * Find the tab id that should be active given a legacy active-tab value
     * (old localStorage stored a view label like 'Planets'). Returns the id of
     * the first tab containing a block whose view matches, else the first tab.
     */
    function findTabIdForView(tabs, view) {
        if (!Array.isArray(tabs) || tabs.length === 0) return null;
        if (view) {
            for (var i = 0; i < tabs.length; i++) {
                var t = tabs[i];
                for (var j = 0; j < t.blocks.length; j++) {
                    if (t.blocks[j].view === view) return t.id;
                }
            }
        }
        return tabs[0].id;
    }

    /**
     * Migrate legacy active-tab labels (e.g. 'Planets') into the four active
     * tab ids of the new model. `legacy` = { leftTab, rightTab, singleRightTab }.
     */
    function migrateLegacyActiveTab(legacy, layout) {
        legacy = legacy || {};
        var p = layout.panels;
        var toView = function (label) {
            return label && typeof label === 'string' ? label.toLowerCase() : null;
        };
        return {
            multiLeft: findTabIdForView(p.multi.left, toView(legacy.leftTab)),
            multiRight: findTabIdForView(p.multi.right, toView(legacy.rightTab)),
            singleLeft: findTabIdForView(p.single.left, toView(legacy.leftTab)),
            singleRight: findTabIdForView(p.single.right, toView(legacy.singleRightTab)),
        };
    }

    /** Default active tab ids (first tab of each panel/mode). */
    function defaultActiveTabs(layout) {
        var p = layout.panels;
        var first = function (tabs) { return tabs && tabs[0] ? tabs[0].id : null; };
        return {
            multiLeft: first(p.multi.left),
            multiRight: first(p.multi.right),
            singleLeft: first(p.single.left),
            singleRight: first(p.single.right),
        };
    }

    function autoTabTitle(tab, translate) {
        if (tab.title) return tab.title;
        var firstView = tab.blocks && tab.blocks[0] ? tab.blocks[0].view : null;
        var i18nKey = firstView ? VIEW_I18N[firstView] : null;
        if (i18nKey && typeof translate === 'function') {
            var t = translate(i18nKey);
            if (t && t !== i18nKey) return t;
        }
        // Last-resort readable fallback.
        return firstView ? firstView.charAt(0).toUpperCase() + firstView.slice(1) : 'Tab';
    }

    var PANEL_SIDE_IDS = { left: 'forecastNewNatalPanel', right: 'forecastNewProgPanel' };

    function activeKeyFor(mode, side) {
        return mode + (side === 'left' ? 'Left' : 'Right');
    }

    /**
     * Render both side panels from a layout into a DOM document. Pure w.r.t.
     * app state: detaches every known block container to a hidden store, then
     * rebuilds each panel's tab bar + panes and re-homes the block divs. The
     * activatable unit is the TAB PANE; block divs inside stay visible.
     *
     * Returns the (possibly repaired) activeTab map. jsdom-testable.
     */
    function renderPanelsToDom(opts) {
        opts = opts || {};
        var doc = opts.document;
        var layout = opts.layout;
        var mode = opts.mode === 'single' ? 'single' : 'multi';
        var activeTab = opts.activeTab || {};
        var translate = opts.translate;
        if (!doc || !layout || !layout.panels) return activeTab;

        var store = doc.getElementById('forecastNewBlockStore');
        if (!store) {
            store = doc.createElement('div');
            store.id = 'forecastNewBlockStore';
            store.hidden = true;
            store.style.display = 'none';
            doc.body.appendChild(store);
        }
        // Detach every known block container so it can be re-homed anywhere.
        Object.keys(BLOCK_TARGET_MAP).forEach(function (key) {
            var el = doc.getElementById(BLOCK_TARGET_MAP[key].containerId);
            if (el && el.parentElement !== store) store.appendChild(el);
        });

        ['left', 'right'].forEach(function (side) {
            var panel = doc.getElementById(PANEL_SIDE_IDS[side]);
            if (!panel) return;
            var tabsBar = panel.querySelector('.panel-tabs');
            var content = panel.querySelector('.panel-content');
            if (!tabsBar || !content) return;
            var tabs = (layout.panels[mode] && layout.panels[mode][side]) || [];

            var akey = activeKeyFor(mode, side);
            var activeId = activeTab[akey];
            if (!tabs.some(function (t) { return t.id === activeId; })) activeId = tabs[0] ? tabs[0].id : null;
            activeTab[akey] = activeId;

            tabsBar.innerHTML = '';
            tabsBar.classList.add('forecast-new-tabs');
            tabs.forEach(function (tab) {
                var btn = doc.createElement('button');
                btn.type = 'button';
                btn.className = 'panel-tab' + (tab.id === activeId ? ' active' : '');
                btn.dataset.tabId = tab.id;
                btn.textContent = autoTabTitle(tab, translate);
                tabsBar.appendChild(btn);
            });

            Array.prototype.forEach.call(content.querySelectorAll('[data-tab-id]'), function (n) { n.remove(); });
            tabs.forEach(function (tab) {
                var pane = doc.createElement('div');
                pane.className = 'panel-tab-content forecast-new-tab-pane' + (tab.id === activeId ? ' active' : '');
                pane.dataset.tabId = tab.id;
                var multi = tab.blocks.length > 1;
                tab.blocks.forEach(function (block) {
                    var meta = BLOCK_TARGET_MAP[block.source + ':' + block.view];
                    if (!meta) return;
                    var el = doc.getElementById(meta.containerId) || store.querySelector('#' + meta.containerId);
                    if (!el) return;
                    el.classList.add('active');
                    if (multi) {
                        var wrap = doc.createElement('div');
                        wrap.className = 'forecast-new-block';
                        var head = doc.createElement('div');
                        head.className = 'forecast-new-block-header';
                        head.textContent = autoTabTitle({ blocks: [block] }, translate);
                        wrap.appendChild(head);
                        wrap.appendChild(el);
                        pane.appendChild(wrap);
                    } else {
                        pane.appendChild(el);
                    }
                });
                content.appendChild(pane);
            });
        });
        return activeTab;
    }

    var api = {
        SCHEMA_VERSION: SCHEMA_VERSION,
        PANEL_SIDE_IDS: PANEL_SIDE_IDS,
        renderPanelsToDom: renderPanelsToDom,
        VIEW_KEYS: VIEW_KEYS,
        VIEW_I18N: VIEW_I18N,
        SOURCES: SOURCES,
        BLOCK_TARGET_MAP: BLOCK_TARGET_MAP,
        blockKeyOf: blockKeyOf,
        isValidView: isValidView,
        makeTabId: makeTabId,
        buildDefaultForecastNewLayout: buildDefaultForecastNewLayout,
        normalizeLayout: normalizeLayout,
        migrateLegacyActiveTab: migrateLegacyActiveTab,
        defaultActiveTabs: defaultActiveTabs,
        findTabIdForView: findTabIdForView,
        autoTabTitle: autoTabTitle,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window !== 'undefined') {
        window.ForecastNewPanelLayout = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));

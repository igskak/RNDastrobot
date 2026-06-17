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
    // Granular blocks: the former 'configs' block is split into 'configs'
    // (configuration aspects) + 'stelliums'; the former 'rulers' block is split
    // into 'jones' (Jones cosmogram) + 'dispositors' (dispositor scheme).
    var VIEW_KEYS = ['planets', 'houses', 'aspects', 'grid', 'configs', 'stelliums', 'balances', 'jones', 'dispositors'];

    // "Moment now" views: not a property of the natal/prog chart but of the
    // current instant (source 'now'). They are registered as explicit blocks
    // (NOT via the SOURCES x VIEW_KEYS cross product) so we never create bogus
    // pairings like now:planets or natal:lunar.
    var NOW_VIEWS = ['lunar', 'hours'];

    // i18n keys for auto-titling a tab from its (first) block's view.
    var VIEW_I18N = {
        planets: 'page.chart.tabs.planets',
        houses: 'page.chart.tabs.houses',
        aspects: 'page.chart.tabs.aspects',
        grid: 'page.forecastNew.tabs.grid',
        configs: 'page.forecastNew.tabs.configs',
        stelliums: 'page.forecastNew.tabs.stelliums',
        balances: 'page.forecastNew.tabs.balances',
        jones: 'page.forecastNew.tabs.jones',
        dispositors: 'page.forecastNew.tabs.dispositors',
        lunar: 'page.forecastNew.tabs.lunar',
        hours: 'page.forecastNew.tabs.hours',
    };

    var SOURCES = ['natal', 'prog'];

    // Corner overlay slots (Option C: a block lives in a side panel OR one
    // corner, never both — corners share the per-mode block pool with panels).
    // Each corner holds 0 or 1 block. Order = visual reading order.
    var CORNER_KEYS = ['tl', 'tr', 'bl', 'br'];
    var CORNER_RECOMMENDED_VIEWS = ['balances', 'configs', 'stelliums', 'jones', 'lunar', 'hours'];
    var CORNER_COMPACT_VIEWS = ['planets', 'houses', 'aspects', 'lunar', 'hours'];
    var CORNER_DISCOURAGED_VIEWS = ['grid', 'dispositors'];

    // Corner slot -> overlay host element id in forecast-new.html. The block's
    // own content container (BLOCK_TARGET_MAP[...].containerId) is re-homed INTO
    // this host, exactly like a panel pane.
    var CORNER_CONTAINER_IDS = {
        tl: 'forecastNewCornerTl',
        tr: 'forecastNewCornerTr',
        bl: 'forecastNewCornerBl',
        br: 'forecastNewCornerBr',
    };

    function emptyCorners() {
        return { tl: null, tr: null, bl: null, br: null };
    }

    function cornersEmpty(corners) {
        if (!corners) return true;
        return CORNER_KEYS.every(function (pos) { return !corners[pos]; });
    }

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
        // "now" blocks: explicit registration, single instance each (no biwheel
        // natal/prog duplication — the current moment is the same on both sides).
        NOW_VIEWS.forEach(function (view) {
            map['now:' + view] = {
                source: 'now',
                view: view,
                containerId: 'now' + viewToContainerSuffix(view),
                rendererKey: 'now', // owned by the lightweight "now" renderer
            };
        });
        return map;
    })();

    function isNowView(view) {
        return NOW_VIEWS.indexOf(view) !== -1;
    }

    function isValidView(view) {
        return VIEW_KEYS.indexOf(view) !== -1 || isNowView(view);
    }

    /**
     * Resolve the effective source for a (rawSource, view) pair, honoring the
     * wheel mode. Returns null when the pair is not DOM-realizable.
     * - now-views are always source 'now' (mode-agnostic — the moment is shared).
     * - chart-views are 'prog' only when explicitly asked AND not in single mode.
     */
    function resolveSource(rawSource, view, mode) {
        if (isNowView(view)) return 'now';
        if (mode === 'single') return 'natal'; // single = natal only
        return rawSource === 'prog' ? 'prog' : 'natal';
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
        // corners empty by default — opt-in via the editor (no first-run clutter).
        layout.panels.multi = {
            left: VIEW_KEYS.map(function (v) { return singleBlockTab('multi', 'left', 'natal', v); }),
            right: VIEW_KEYS.map(function (v) { return singleBlockTab('multi', 'right', 'prog', v); }),
            corners: emptyCorners(),
        };

        // single: natal-only.
        var singleLeftViews = ['planets', 'aspects', 'grid', 'configs', 'stelliums'];
        var singleRightViews = ['houses', 'balances', 'jones', 'dispositors'];
        layout.panels.single = {
            left: singleLeftViews.map(function (v) { return singleBlockTab('single', 'left', 'natal', v); }),
            right: singleRightViews.map(function (v) { return singleBlockTab('single', 'right', 'natal', v); }),
            corners: emptyCorners(),
        };

        return layout;
    }

    function resetModeToDefault(layout, mode) {
        var normalized = normalizeLayout(layout);
        var defaults = buildDefaultForecastNewLayout();
        var targetMode = mode === 'single' ? 'single' : 'multi';
        normalized.panels[targetMode] = JSON.parse(JSON.stringify(defaults.panels[targetMode]));
        return normalized;
    }

    function tab(id, title, blocks) {
        return { id: id, title: title || null, blocks: blocks };
    }

    function blocks(source, views) {
        return views.map(function (view) { return { source: source, view: view }; });
    }

    function buildBuiltinWorkspaceLayout(workspaceId, baseLayout) {
        var layout = normalizeLayout(baseLayout || buildDefaultForecastNewLayout());
        var modeLayouts = {
            natal_consultation: {
                left: [
                    tab('builtin-natal-core', null, blocks('natal', ['planets', 'houses'])),
                    tab('builtin-natal-aspects', null, blocks('natal', ['aspects', 'grid'])),
                ],
                right: [
                    tab('builtin-natal-analysis', null, blocks('natal', ['configs', 'stelliums', 'balances'])),
                    tab('builtin-natal-patterns', null, blocks('natal', ['jones', 'dispositors'])),
                ],
            },
            transits: {
                left: [
                    tab('builtin-transit-natal', null, blocks('natal', ['planets', 'houses', 'aspects'])),
                    tab('builtin-transit-natal-analysis', null, blocks('natal', ['configs', 'balances'])),
                ],
                right: [
                    tab('builtin-transit-current', null, blocks('prog', ['planets', 'houses', 'aspects', 'grid'])),
                    tab('builtin-transit-analysis', null, blocks('prog', ['configs', 'stelliums', 'balances', 'jones', 'dispositors'])),
                ],
            },
            progressions_directions: {
                left: [
                    tab('builtin-pd-natal', null, blocks('natal', ['planets', 'houses', 'aspects', 'grid'])),
                    tab('builtin-pd-foundation', null, blocks('natal', ['configs', 'balances', 'dispositors'])),
                ],
                right: [
                    tab('builtin-pd-current', null, blocks('prog', ['planets', 'houses', 'aspects', 'grid'])),
                    tab('builtin-pd-analysis', null, blocks('prog', ['configs', 'stelliums', 'balances', 'jones', 'dispositors'])),
                ],
            },
            natal_forecast_comparison: {
                left: [
                    tab('builtin-compare-natal', null, blocks('natal', ['planets', 'houses', 'aspects', 'grid', 'configs', 'balances'])),
                ],
                right: [
                    tab('builtin-compare-forecast', null, blocks('prog', ['planets', 'houses', 'aspects', 'grid', 'configs', 'balances'])),
                ],
            },
            compact: {
                left: [tab('builtin-compact-primary', null, blocks('natal', ['planets', 'aspects', 'grid']))],
                right: [tab('builtin-compact-compare', null, blocks('prog', ['planets', 'aspects', 'grid']))],
                corners: {
                    tl: { source: 'natal', view: 'balances' },
                    tr: { source: 'prog', view: 'balances' },
                    bl: { source: 'natal', view: 'configs' },
                    br: { source: 'prog', view: 'configs' },
                },
            },
        };
        var chosen = modeLayouts[workspaceId];
        if (!chosen) return layout;
        layout.panels.multi = chosen;
        if (workspaceId === 'compact') {
            layout.panels.single = {
                left: [tab('builtin-compact-single-primary', null, blocks('natal', ['planets', 'aspects', 'grid']))],
                right: [tab('builtin-compact-single-secondary', null, blocks('natal', ['houses', 'dispositors']))],
                corners: {
                    tl: { source: 'natal', view: 'balances' },
                    tr: { source: 'natal', view: 'configs' },
                    bl: { source: 'natal', view: 'stelliums' },
                    br: { source: 'natal', view: 'jones' },
                },
            };
        } else if (workspaceId === 'natal_consultation') {
            layout.panels.single = {
                left: [
                    tab('builtin-natal-single-core', null, blocks('natal', ['planets', 'houses'])),
                    tab('builtin-natal-single-aspects', null, blocks('natal', ['aspects', 'grid'])),
                ],
                right: [
                    tab('builtin-natal-single-analysis', null, blocks('natal', ['configs', 'stelliums', 'balances'])),
                    tab('builtin-natal-single-patterns', null, blocks('natal', ['jones', 'dispositors'])),
                ],
            };
        }
        return normalizeLayout(layout);
    }

    var BUILTIN_WORKSPACES = [
        { id: 'natal_consultation', labelKey: 'page.forecastNew.panelEditor.workspaces.natalConsultation' },
        { id: 'transits', labelKey: 'page.forecastNew.panelEditor.workspaces.transits' },
        { id: 'progressions_directions', labelKey: 'page.forecastNew.panelEditor.workspaces.progressionsDirections' },
        { id: 'natal_forecast_comparison', labelKey: 'page.forecastNew.panelEditor.workspaces.natalForecastComparison' },
        { id: 'compact', labelKey: 'page.forecastNew.panelEditor.workspaces.compact' },
    ];

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
                var source = resolveSource(b.source, view, mode);
                var key = source + ':' + view;
                if (!BLOCK_TARGET_MAP[key]) return; // not DOM-realizable
                if (seenBlockKeys[key]) return; // dedup across the whole mode
                seenBlockKeys[key] = true;
                blocks.push({ source: source, view: view });
            });

            // A tab whose blocks were ALL dropped (unknown view / dedup) is
            // discarded, but a tab that was intentionally empty (input blocks
            // array empty) is KEPT — that's how the configurator creates a fresh
            // named tab for the user to fill.
            if (blocks.length === 0 && rawBlocks.length > 0) return;

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
     * Normalize the four corner slots for a mode. Shares `seenBlockKeys` with the
     * panel pass so a blockKey can live in a panel OR a corner, never both
     * (Option C). MUST be called AFTER the panels are normalized so panels win a
     * collision and the corner yields (deterministic precedence). Drops unknown
     * views, non-realizable blocks, and (in single mode) forces source 'natal'.
     */
    function normalizeCorners(rawCorners, mode, seenBlockKeys) {
        var out = emptyCorners();
        if (!rawCorners || typeof rawCorners !== 'object') return out;
        CORNER_KEYS.forEach(function (pos) {
            var b = rawCorners[pos];
            if (!b || typeof b !== 'object') return;
            var view = b.view;
            if (!isValidView(view)) return;
            var source = resolveSource(b.source, view, mode);
            var key = source + ':' + view;
            if (!BLOCK_TARGET_MAP[key]) return; // not DOM-realizable
            if (seenBlockKeys[key]) return; // already claimed by a panel (or earlier corner)
            seenBlockKeys[key] = true;
            out[pos] = { source: source, view: view };
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
            // Corners AFTER panels: shared seenBlockKeys, panels win a collision.
            var corners = normalizeCorners(rawMode.corners, mode, seenBlockKeys);

            // If a mode is entirely empty (no usable tabs AND no corner blocks),
            // rebuild it from defaults so the user is never stranded with a blank
            // workspace. A corner-only layout is valid and must NOT be wiped.
            if (left.length === 0 && right.length === 0 && cornersEmpty(corners)) {
                result.panels[mode] = fallback.panels[mode];
            } else {
                result.panels[mode] = { left: left, right: right, corners: corners };
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

            // First VISIBLE_COUNT tabs render inline; the rest go behind the ▸ overflow toggle.
            var VISIBLE_COUNT = 3;
            var visibleTabs = tabs.slice(0, VISIBLE_COUNT);
            var overflowTabs = tabs.slice(VISIBLE_COUNT);
            var activeInOverflow = overflowTabs.some(function (t) { return t.id === activeId; });

            visibleTabs.forEach(function (tab) {
                var btn = doc.createElement('button');
                btn.type = 'button';
                btn.className = 'panel-tab' + (tab.id === activeId ? ' active' : '');
                btn.dataset.tabId = tab.id;
                btn.textContent = autoTabTitle(tab, translate);
                tabsBar.appendChild(btn);
            });

            // Always render the overflow container as the 4th grid cell.
            var overflowWrap = doc.createElement('div');
            overflowWrap.className = 'forecast-new-tabs-overflow' + (activeInOverflow ? ' is-active' : '');
            overflowWrap.setAttribute('data-tabs-overflow', '');
            var toggle = doc.createElement('button');
            toggle.type = 'button';
            toggle.className = 'panel-tab forecast-new-tabs-overflow-toggle';
            toggle.setAttribute('data-tabs-overflow-toggle', '');
            toggle.setAttribute('aria-haspopup', 'true');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.textContent = '▸';
            if (overflowTabs.length === 0) toggle.style.visibility = 'hidden';
            overflowWrap.appendChild(toggle);
            if (overflowTabs.length > 0) {
                var menu = doc.createElement('div');
                menu.className = 'forecast-new-tabs-overflow-menu';
                menu.setAttribute('data-tabs-overflow-menu', '');
                overflowTabs.forEach(function (tab) {
                    var btn = doc.createElement('button');
                    btn.type = 'button';
                    btn.className = 'panel-tab forecast-new-tabs-overflow-item' + (tab.id === activeId ? ' active' : '');
                    btn.dataset.tabId = tab.id;
                    btn.textContent = autoTabTitle(tab, translate);
                    menu.appendChild(btn);
                });
                overflowWrap.appendChild(menu);
            }
            tabsBar.appendChild(overflowWrap);

            Array.prototype.forEach.call(content.querySelectorAll('[data-tab-id]'), function (n) { n.remove(); });
            tabs.forEach(function (tab) {
                var pane = doc.createElement('div');
                pane.className = 'panel-tab-content forecast-new-tab-pane' + (tab.id === activeId ? ' active' : '');
                pane.dataset.tabId = tab.id;
                // Mini block headers only in multi-wheel mode; single mode is
                // natal-only and the headers read as redundant labels there.
                var showHeaders = tab.blocks.length > 1 && mode !== 'single';
                tab.blocks.forEach(function (block) {
                    var meta = BLOCK_TARGET_MAP[block.source + ':' + block.view];
                    if (!meta) return;
                    var el = doc.getElementById(meta.containerId) || store.querySelector('#' + meta.containerId);
                    if (!el) return;
                    el.classList.add('active');
                    el.classList.remove('is-compact'); // shed corner-compact styling when back in a panel
                    delete el.dataset.cornerView;
                    if (showHeaders) {
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

        // --- corners (Option C) ---
        // The detach pass above already moved every block container to the store,
        // so corner hosts start empty each render. Re-home each assigned block
        // into its corner host with compact styling; hide unfilled corners.
        var corners = (layout.panels[mode] && layout.panels[mode].corners) || emptyCorners();
        CORNER_KEYS.forEach(function (pos) {
            var host = doc.getElementById(CORNER_CONTAINER_IDS[pos]);
            if (!host) return;
            Array.prototype.forEach.call(host.querySelectorAll('.forecast-new-corner-toolbar'), function (node) { node.remove(); });
            var block = corners[pos];
            var filled = false;
            if (block) {
                var meta = BLOCK_TARGET_MAP[block.source + ':' + block.view];
                if (meta) {
                    var el = doc.getElementById(meta.containerId) || store.querySelector('#' + meta.containerId);
                    if (el) {
                        el.classList.add('active', 'is-compact');
                        el.dataset.cornerView = block.view;
                        var toolbar = doc.createElement('div');
                        toolbar.className = 'forecast-new-corner-toolbar';
                        var title = doc.createElement('span');
                        title.className = 'forecast-new-corner-title';
                        title.textContent = autoTabTitle({ blocks: [block] }, translate);
                        var remove = doc.createElement('button');
                        remove.type = 'button';
                        remove.className = 'forecast-new-corner-remove';
                        remove.dataset.cornerRemove = pos;
                        remove.setAttribute('aria-label', translate('page.forecastNew.panelEditor.removeWidget'));
                        remove.textContent = '×';
                        toolbar.appendChild(title);
                        toolbar.appendChild(remove);
                        host.appendChild(toolbar);
                        host.appendChild(el);
                        filled = true;
                    }
                }
            }
            host.classList.toggle('forecast-new-corner-filled', filled);
            host.hidden = !filled;
        });

        return activeTab;
    }

    var api = {
        SCHEMA_VERSION: SCHEMA_VERSION,
        PANEL_SIDE_IDS: PANEL_SIDE_IDS,
        renderPanelsToDom: renderPanelsToDom,
        VIEW_KEYS: VIEW_KEYS,
        NOW_VIEWS: NOW_VIEWS,
        VIEW_I18N: VIEW_I18N,
        SOURCES: SOURCES,
        isNowView: isNowView,
        CORNER_KEYS: CORNER_KEYS,
        CORNER_RECOMMENDED_VIEWS: CORNER_RECOMMENDED_VIEWS,
        CORNER_COMPACT_VIEWS: CORNER_COMPACT_VIEWS,
        CORNER_DISCOURAGED_VIEWS: CORNER_DISCOURAGED_VIEWS,
        CORNER_CONTAINER_IDS: CORNER_CONTAINER_IDS,
        emptyCorners: emptyCorners,
        cornersEmpty: cornersEmpty,
        BLOCK_TARGET_MAP: BLOCK_TARGET_MAP,
        blockKeyOf: blockKeyOf,
        isValidView: isValidView,
        makeTabId: makeTabId,
        buildDefaultForecastNewLayout: buildDefaultForecastNewLayout,
        resetModeToDefault: resetModeToDefault,
        buildBuiltinWorkspaceLayout: buildBuiltinWorkspaceLayout,
        BUILTIN_WORKSPACES: BUILTIN_WORKSPACES,
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

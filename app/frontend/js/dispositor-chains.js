(function() {
    'use strict';

    const EMPTY = '—';
    const SIGN_ORDER = [
        'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
        'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
    ];
    const BODY_ORDER = [
        'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
        'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
        'Chiron', 'Proserpina',
    ];
    const OPPOSITE_SIGN = Object.fromEntries(SIGN_ORDER.map((sign, index) => [
        sign,
        SIGN_ORDER[(index + 6) % 12],
    ]));
    const DEFAULT_DIGNITIES = {
        Aries: { ruler: 'Mars', co_ruler: null, exaltation: 'Sun' },
        Taurus: { ruler: 'Venus', co_ruler: null, exaltation: 'Moon' },
        Gemini: { ruler: 'Mercury', co_ruler: null, exaltation: null },
        Cancer: { ruler: 'Moon', co_ruler: null, exaltation: 'Jupiter' },
        Leo: { ruler: 'Sun', co_ruler: null, exaltation: null },
        Virgo: { ruler: 'Mercury', co_ruler: 'Proserpina', exaltation: 'Mercury' },
        Libra: { ruler: 'Venus', co_ruler: 'Chiron', exaltation: 'Saturn' },
        Scorpio: { ruler: 'Pluto', co_ruler: 'Mars', exaltation: null },
        Sagittarius: { ruler: 'Jupiter', co_ruler: 'Neptune', exaltation: null },
        Capricorn: { ruler: 'Saturn', co_ruler: 'Uranus', exaltation: 'Mars' },
        Aquarius: { ruler: 'Uranus', co_ruler: 'Saturn', exaltation: null },
        Pisces: { ruler: 'Neptune', co_ruler: 'Jupiter', exaltation: 'Venus' },
    };
    const BODY_ALIASES = {
        TrueNorthNode: 'TrueNode',
        TrueSouthNode: 'SouthNode',
        Fortune: 'PartOfFortune',
    };

    function t(key, params) {
        return window.FrontendI18n?.t?.(key, params) || key;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeBodyName(name) {
        return BODY_ALIASES[name] || name;
    }

    function getPlanetName(name) {
        if (!name) return EMPTY;
        const key = `astro.planet.${name}`;
        const translated = t(key);
        if (translated !== key) return translated;
        return window.Symbols?.getPlanetNameRu?.(name) || window.Symbols?.planetNamesRu?.[name] || name;
    }

    function getSignName(name) {
        if (!name) return EMPTY;
        const key = `astro.sign.${name}`;
        const translated = t(key);
        if (translated !== key) return translated;
        return window.Symbols?.signNamesRu?.[name] || name;
    }

    function planetSymbol(name, size = 16) {
        return window.Symbols?.getPlanetSymbolMarkup?.(name, { size, title: getPlanetName(name) })
            || `<span class="astro-symbol">${escapeHtml(window.Symbols?.getPlanetSymbol?.(name) || '')}</span>`;
    }

    function signLabel(sign) {
        const symbol = window.Symbols?.signs?.[sign] || '';
        return [symbol, getSignName(sign)].filter(Boolean).join(' ');
    }

    function getMergedDignities() {
        const signs = {};
        const preferenceSigns = window.accountPreferencesCache?.methodology?.dignities?.signs
            || window.accountPreferencesCache?.methodology?.default_dignities?.signs
            || {};

        SIGN_ORDER.forEach((sign) => {
            const fallback = DEFAULT_DIGNITIES[sign] || {};
            const override = preferenceSigns?.[sign] || {};
            const ruler = normalizeBodyName(override.ruler || fallback.ruler || null);
            let coRuler = normalizeBodyName(override.co_ruler || fallback.co_ruler || null);
            const exaltation = normalizeBodyName(override.exaltation || fallback.exaltation || null);
            if (ruler && coRuler && ruler === coRuler) coRuler = null;
            signs[sign] = { ruler, co_ruler: coRuler, exaltation };
        });

        return signs;
    }

    function getRulerForSign(sign, mode, dignities = getMergedDignities()) {
        const entry = dignities?.[sign] || {};
        const opposite = dignities?.[OPPOSITE_SIGN[sign]] || {};
        if (mode === 'exaltation') return entry.exaltation || null;
        if (mode === 'detriment') return opposite.ruler || null;
        if (mode === 'fall') return opposite.exaltation || null;
        return entry.ruler || null;
    }

    function getRenderablePlanets(chartData) {
        const planets = Array.isArray(chartData?.planets) ? chartData.planets : [];
        return planets
            .filter((planet) => planet?.name && planet?.sign && BODY_ORDER.includes(normalizeBodyName(planet.name)))
            .map((planet) => ({ ...planet, name: normalizeBodyName(planet.name) }))
            .sort((a, b) => BODY_ORDER.indexOf(a.name) - BODY_ORDER.indexOf(b.name));
    }

    function buildChains(chartData, mode) {
        const dignities = getMergedDignities();
        const planets = getRenderablePlanets(chartData);
        const planetByName = new Map(planets.map((planet) => [planet.name, planet]));
        const chains = [];
        const finalCounts = new Map();

        planets.forEach((start) => {
            const steps = [];
            const seen = new Map();
            let current = start;
            let finalKey = null;
            let cycle = [];

            while (current?.name && !seen.has(current.name)) {
                seen.set(current.name, steps.length);
                const ruler = getRulerForSign(current.sign, mode, dignities);
                steps.push({ planet: current.name, sign: current.sign, ruler, retrograde: Boolean(current.retrograde) });

                if (!ruler) {
                    finalKey = 'none';
                    break;
                }
                if (!planetByName.has(ruler)) {
                    finalKey = ruler;
                    break;
                }
                if (ruler === current.name) {
                    finalKey = ruler;
                    break;
                }
                current = planetByName.get(ruler);
            }

            if (!finalKey && current?.name && seen.has(current.name)) {
                const cycleStart = seen.get(current.name);
                cycle = steps.slice(cycleStart).map((step) => step.planet);
                finalKey = cycle.join('+');
            }

            finalCounts.set(finalKey, (finalCounts.get(finalKey) || 0) + 1);
            chains.push({ start: start.name, steps, finalKey, cycle });
        });

        const mainRulers = [...finalCounts.entries()]
            .filter(([key]) => key && key !== 'none')
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, 4);

        return { chains, mainRulers };
    }

    function renderJonesPattern(pattern) {
        if (!pattern) {
            return `<p class="dispositor-empty">${escapeHtml(t('page.chart.rulers.empty.noJones'))}</p>`;
        }

        const patternName = (() => {
            const key = `astro.pattern.${pattern.pattern_type}`;
            const translated = t(key);
            return translated === key ? (pattern.pattern_type || EMPTY) : translated;
        })();
        const details = [];
        if (Number.isFinite(Number(pattern.empty_arc_degree))) {
            details.push(t('page.chart.balances.emptyArc', { value: Number(pattern.empty_arc_degree).toFixed(0) }));
        }
        if (pattern.handle_planet) {
            details.push(t('page.chart.balances.handle', { planet: getPlanetName(pattern.handle_planet) }));
        }
        if (pattern.leading_planet) {
            details.push(t('page.chart.balances.leading', { planet: getPlanetName(pattern.leading_planet) }));
        }

        return `
            <article class="dispositor-jones-card">
                <span class="dispositor-card-kicker">${escapeHtml(t('page.chart.rulers.jonesKicker'))}</span>
                <h4>${escapeHtml(patternName)}</h4>
                ${details.length ? `<p>${escapeHtml(details.join(' · '))}</p>` : ''}
            </article>
        `;
    }

    function renderMainRulers(mainRulers) {
        if (!mainRulers.length) {
            return `<p class="dispositor-empty">${escapeHtml(t('page.chart.rulers.empty.noMainRulers'))}</p>`;
        }

        return `
            <div class="dispositor-main-rulers">
                ${mainRulers.map(([key, count]) => {
                    const planets = key.split('+').filter(Boolean);
                    const label = planets.map(getPlanetName).join(' + ');
                    return `
                        <span class="dispositor-main-chip" title="${escapeHtml(label)}">
                            ${planets.map((planet) => planetSymbol(planet, 15)).join('')}
                            <b>${count}</b>
                        </span>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderChainNode(step, extraClass = '', style = '') {
        const label = [
            getPlanetName(step.planet),
            step.sign ? signLabel(step.sign) : '',
        ].filter(Boolean).join(' · ');
        return `
            <span class="dispositor-chain-node ${extraClass}" style="${escapeHtml(style)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
                ${planetSymbol(step.planet, 15)}
                ${step.retrograde ? '<span class="dispositor-node-retro">r</span>' : ''}
            </span>
        `;
    }

    function renderChain(chain) {
        const items = [...chain.steps].reverse().map((step, index) => {
            const isMain = index === 0 && chain.finalKey !== 'none';
            return renderChainNode(step, isMain ? 'dispositor-chain-node--main' : '');
        });

        const finalStep = chain.steps[chain.steps.length - 1];
        if (finalStep?.ruler && !chain.steps.some((step) => step.planet === finalStep.ruler)) {
            items.unshift(renderChainNode({ planet: finalStep.ruler }, 'dispositor-chain-node--external dispositor-chain-node--main'));
        }

        return `
            <div class="dispositor-chain-row">
                <div class="dispositor-chain-path">${items.join('<span class="dispositor-chain-arrow">←</span>')}</div>
            </div>
        `;
    }

    function renderDiagram(chains) {
        const uniqueChains = [];
        const seen = new Set();

        chains.forEach((chain) => {
            const signature = chain.steps.map((step) => step.planet).join('>');
            if (seen.has(signature)) return;
            seen.add(signature);
            uniqueChains.push(chain);
        });

        const groups = new Map();
        uniqueChains.forEach((chain) => {
            const key = chain.finalKey || 'none';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(chain);
        });

        if (!uniqueChains.length) {
            return `<p class="dispositor-empty">${escapeHtml(t('page.chart.rulers.empty.noChains'))}</p>`;
        }

        return `
            <div class="dispositor-diagram">
                ${[...groups.entries()].map(([key, groupChains]) => `
                    <section class="dispositor-diagram-group">
                        <div class="dispositor-diagram-group-head">
                            ${renderDiagramGroupTitle(key, groupChains.length)}
                        </div>
                        ${renderGraphGroup(key, groupChains)}
                    </section>
                `).join('')}
            </div>
        `;
    }

    function renderGraphGroup(finalKey, groupChains) {
        const layout = buildGraphLayout(finalKey, groupChains);
        if (!layout.nodes.length) {
            return `<p class="dispositor-empty">${escapeHtml(t('page.chart.rulers.empty.noChains'))}</p>`;
        }

        return `
            <div class="dispositor-graph" style="--graph-width:${layout.width}px; --graph-height:${layout.height}px;">
                <svg class="dispositor-graph-lines" viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true">
                    <defs>
                        <marker id="dispositorArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L8,4 L0,8 Z"></path>
                        </marker>
                    </defs>
                    ${layout.edges.map((edge) => `
                        <path d="${escapeHtml(edge.path)}" marker-end="url(#dispositorArrow)"></path>
                    `).join('')}
                </svg>
                ${layout.nodes.map((node) => renderChainNode(node, node.isRoot ? 'dispositor-chain-node--main' : '', `left:${node.x}px; top:${node.y}px;`)).join('')}
            </div>
        `;
    }

    function buildGraphLayout(finalKey, groupChains) {
        const nodeSize = 44;
        const xGap = 128;
        const yGap = 76;
        const pad = 24;
        const rootSet = new Set(finalKey && finalKey !== 'none' ? finalKey.split('+').filter(Boolean) : []);
        const nodes = new Map();
        const edges = [];
        const edgeKeys = new Set();
        const childrenByParent = new Map();
        const parentByChild = new Map();

        const ensureNode = (planet, source = {}) => {
            if (!planet) return null;
            const existing = nodes.get(planet) || { planet, sign: null, retrograde: false };
            nodes.set(planet, {
                ...existing,
                sign: existing.sign || source.sign || null,
                retrograde: existing.retrograde || Boolean(source.retrograde),
            });
            return nodes.get(planet);
        };

        const addEdge = (childStep, parentStep) => {
            const child = childStep?.planet;
            const parent = parentStep?.planet;
            if (!child || !parent || child === parent) return;
            if (rootSet.has(child) && rootSet.has(parent)) return;
            ensureNode(child, childStep);
            ensureNode(parent, parentStep);
            const key = `${child}->${parent}`;
            if (edgeKeys.has(key)) return;
            edgeKeys.add(key);
            edges.push({ child, parent });
            parentByChild.set(child, parent);
            if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
            childrenByParent.get(parent).push(child);
        };

        groupChains.forEach((chain) => {
            chain.steps.forEach((step) => ensureNode(step.planet, step));
            for (let index = 0; index < chain.steps.length - 1; index += 1) {
                addEdge(chain.steps[index], chain.steps[index + 1]);
            }

            const finalStep = chain.steps[chain.steps.length - 1];
            if (finalStep?.ruler && !chain.steps.some((step) => step.planet === finalStep.ruler)) {
                addEdge(finalStep, { planet: finalStep.ruler });
            }
        });

        if (!rootSet.size) {
            [...nodes.keys()].forEach((planet) => {
                if (!parentByChild.has(planet)) rootSet.add(planet);
            });
        }
        if (!rootSet.size && nodes.size) rootSet.add([...nodes.keys()][0]);

        const sortPlanets = (items) => [...new Set(items)].sort((a, b) => {
            const ar = BODY_ORDER.indexOf(a);
            const br = BODY_ORDER.indexOf(b);
            return (ar === -1 ? 999 : ar) - (br === -1 ? 999 : br);
        });
        childrenByParent.forEach((children, parent) => {
            childrenByParent.set(parent, sortPlanets(children));
        });

        const depth = new Map();
        const assignDepth = (planet, value = 0) => {
            if (depth.has(planet) && depth.get(planet) <= value) return;
            depth.set(planet, value);
            (childrenByParent.get(planet) || []).forEach((child) => assignDepth(child, value + 1));
        };
        sortPlanets([...rootSet]).forEach((root) => assignDepth(root, 0));
        nodes.forEach((_node, planet) => {
            if (!depth.has(planet)) depth.set(planet, 0);
        });

        let nextY = pad;
        const yByPlanet = new Map();
        const place = (planet, visiting = new Set()) => {
            if (yByPlanet.has(planet)) return yByPlanet.get(planet);
            if (visiting.has(planet)) {
                const y = nextY;
                nextY += yGap;
                yByPlanet.set(planet, y);
                return y;
            }
            visiting.add(planet);
            const children = childrenByParent.get(planet) || [];
            let y;
            if (!children.length) {
                y = nextY;
                nextY += yGap;
            } else {
                const childYs = children.map((child) => place(child, new Set(visiting)));
                y = (Math.min(...childYs) + Math.max(...childYs)) / 2;
            }
            visiting.delete(planet);
            yByPlanet.set(planet, y);
            return y;
        };
        sortPlanets([...rootSet]).forEach((root) => place(root));
        nodes.forEach((_node, planet) => place(planet));

        const positionedNodes = [...nodes.values()].map((node) => ({
            ...node,
            isRoot: rootSet.has(node.planet),
            x: pad + (depth.get(node.planet) || 0) * xGap,
            y: yByPlanet.get(node.planet) || pad,
        }));
        const nodeByPlanet = new Map(positionedNodes.map((node) => [node.planet, node]));
        const maxDepth = Math.max(0, ...positionedNodes.map((node) => depth.get(node.planet) || 0));
        const height = Math.max(180, nextY + pad);
        const width = Math.max(520, pad * 2 + maxDepth * xGap + nodeSize);
        const connectorEdges = edges
            .map((edge) => {
                const child = nodeByPlanet.get(edge.child);
                const parent = nodeByPlanet.get(edge.parent);
                if (!child || !parent) return null;
                const childX = child.x;
                const childY = child.y + nodeSize / 2;
                const parentX = parent.x + nodeSize;
                const parentY = parent.y + nodeSize / 2;
                const midX = Math.max(parentX + 18, childX - 42);
                return {
                    ...edge,
                    path: `M${childX},${childY} H${midX} V${parentY} H${parentX}`,
                };
            })
            .filter(Boolean);

        return {
            width,
            height,
            nodes: positionedNodes,
            edges: connectorEdges,
        };
    }

    function renderDiagramGroupTitle(finalKey, count) {
        if (!finalKey || finalKey === 'none') {
            return `
                <span class="dispositor-diagram-group-title">${escapeHtml(t('page.chart.rulers.empty.noMainRulers'))}</span>
                <span class="dispositor-diagram-count">${count}</span>
            `;
        }
        const planets = finalKey.split('+').filter(Boolean);
        const label = planets.map(getPlanetName).join(' + ');
        return `
            <span class="dispositor-diagram-group-title" title="${escapeHtml(label)}">
                ${planets.map((planet) => planetSymbol(planet, 17)).join('<span class="dispositor-cycle-mark">↔</span>')}
            </span>
            <span class="dispositor-diagram-count">${count}</span>
        `;
    }

    function renderModeTabs(mode) {
        const modes = ['domicile', 'exaltation', 'fall', 'detriment'];
        return `
            <div class="dispositor-mode-tabs" role="tablist" aria-label="${escapeHtml(t('page.chart.rulers.modeLabel'))}">
                ${modes.map((item) => `
                    <button
                        type="button"
                        class="dispositor-mode-tab${item === mode ? ' active' : ''}"
                        data-dispositor-mode="${item}"
                        role="tab"
                        aria-selected="${item === mode ? 'true' : 'false'}"
                    >${escapeHtml(t(`astro.dignity.${item}`))}</button>
                `).join('')}
            </div>
        `;
    }

    function openModal(chartData, options = {}, mode = 'domicile') {
        closeModal();
        const { chains, mainRulers } = buildChains(chartData, mode);
        const modal = document.createElement('div');
        modal.className = 'dispositor-modal-overlay';
        modal.innerHTML = `
            <div class="dispositor-modal" role="dialog" aria-modal="true" aria-labelledby="dispositorModalTitle">
                <div class="dispositor-modal-head">
                    <h3 id="dispositorModalTitle">${escapeHtml(t('page.chart.rulers.modalTitle'))}</h3>
                    <button type="button" class="dispositor-modal-close" data-dispositor-close aria-label="${escapeHtml(t('page.chart.rulers.modalClose'))}">×</button>
                </div>
                ${renderModeTabs(mode)}
                <div class="dispositor-modal-summary">
                    <span class="dispositor-card-kicker">${escapeHtml(t('page.chart.rulers.mainKicker'))}</span>
                    ${renderMainRulers(mainRulers)}
                </div>
                ${renderDiagram(chains)}
            </div>
        `;
        document.body.appendChild(modal);
        document.body.classList.add('dispositor-modal-open');

        modal.addEventListener('click', (event) => {
            const target = event.target;
            if (target === modal || (target instanceof Element && target.closest('[data-dispositor-close]'))) {
                closeModal();
                return;
            }
            if (!(target instanceof Element)) return;
            const modeButton = target.closest('.dispositor-mode-tab[data-dispositor-mode]');
            if (!modeButton) return;
            openModal(chartData, options, modeButton.dataset.dispositorMode || mode);
        });

        modal.querySelector('[data-dispositor-close]')?.focus();
    }

    function closeModal() {
        document.querySelector('.dispositor-modal-overlay')?.remove();
        document.body.classList.remove('dispositor-modal-open');
    }

    function render(containerOrId, chartData, options = {}) {
        const container = typeof containerOrId === 'string'
            ? document.getElementById(containerOrId)
            : containerOrId;
        if (!container) return;

        const existingMode = container.querySelector('.dispositor-mode-tab.active')?.dataset?.dispositorMode;
        const mode = existingMode || options.mode || 'domicile';
        const { chains, mainRulers } = buildChains(chartData, mode);

        container.innerHTML = `
            <div class="dispositor-panel">
                ${renderJonesPattern(chartData?.cosmogram_pattern)}
                <div class="dispositor-section">
                    <div class="dispositor-section-head">
                        <div>
                            <span class="dispositor-card-kicker">${escapeHtml(t('page.chart.rulers.mainKicker'))}</span>
                            <h4>${escapeHtml(t('page.chart.rulers.mainTitle'))}</h4>
                        </div>
                    </div>
                    ${renderModeTabs(mode)}
                    ${renderMainRulers(mainRulers)}
                    <button type="button" class="dispositor-open-modal-btn" data-dispositor-open-modal>
                        ${escapeHtml(t('page.chart.rulers.openSchema'))}
                    </button>
                </div>
            </div>
        `;

        container.querySelectorAll('.dispositor-mode-tab[data-dispositor-mode]').forEach((button) => {
            button.addEventListener('click', () => {
                render(container, chartData, { ...options, mode: button.dataset.dispositorMode || mode });
            });
        });
        container.querySelector('[data-dispositor-open-modal]')?.addEventListener('click', () => {
            openModal(chartData, options, container.querySelector('.dispositor-mode-tab.active')?.dataset?.dispositorMode || mode);
        });
    }

    window.DispositorChains = {
        render,
        buildChains,
        closeModal,
    };

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeModal();
    });
})();

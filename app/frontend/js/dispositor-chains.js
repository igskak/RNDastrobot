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
    const COMPACT_SCHEME_BODY_ORDER = BODY_ORDER.slice(0, 10);
    const DISPLAY_OPTIONS_STORAGE_KEY = 'dispositorChainDisplayOptions';
    const DEFAULT_DISPLAY_OPTIONS = {
        mode: 'domicile',
        showArrowDirection: true,
        showHouseRulers: true,
        classicalRulers: false,
    };
    const CLASSICAL_RULERS = {
        Aries: 'Mars',
        Taurus: 'Venus',
        Gemini: 'Mercury',
        Cancer: 'Moon',
        Leo: 'Sun',
        Virgo: 'Mercury',
        Libra: 'Venus',
        Scorpio: 'Mars',
        Sagittarius: 'Jupiter',
        Capricorn: 'Saturn',
        Aquarius: 'Saturn',
        Pisces: 'Jupiter',
    };
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

    function getDisplayRulerForSign(sign, mode, dignities, displayOptions = DEFAULT_DISPLAY_OPTIONS) {
        if (!sign) return null;
        if (displayOptions.classicalRulers && mode === 'domicile') {
            return CLASSICAL_RULERS[sign] || getRulerForSign(sign, mode, dignities);
        }
        if (displayOptions.classicalRulers && mode === 'detriment') {
            return CLASSICAL_RULERS[OPPOSITE_SIGN[sign]] || getRulerForSign(sign, mode, dignities);
        }
        return getRulerForSign(sign, mode, dignities);
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
            <article class="dispositor-jones-card" title="${escapeHtml([t('page.chart.rulers.jonesKicker'), patternName, ...details].join(' · '))}">
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

    function sortPlanets(items) {
        return [...new Set(items)].sort((a, b) => {
            const ar = BODY_ORDER.indexOf(a);
            const br = BODY_ORDER.indexOf(b);
            return (ar === -1 ? 999 : ar) - (br === -1 ? 999 : br);
        });
    }

    function canonicalFinalKey(planets) {
        return sortPlanets(planets).join('+');
    }

    function getHouseNumber(house) {
        const value = house?.number ?? house?.house_number;
        const numeric = Number(value);
        return Number.isInteger(numeric) ? numeric : value;
    }

    function formatHouseList(houses) {
        const values = [...new Set(houses)]
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value))
            .sort((a, b) => a - b);
        if (!values.length) return '';
        return window.Symbols?.formatHouseList?.(values, { style: 'roman', separator: ',' })
            || values.map((value) => {
                const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
                return roman[value - 1] || String(value);
            }).join(',');
    }

    function getHouseRuler(house, mode, dignities, displayOptions = DEFAULT_DISPLAY_OPTIONS) {
        if (mode === 'domicile' && house?.ruler_planet && !displayOptions.classicalRulers) {
            return normalizeBodyName(house.ruler_planet);
        }
        return normalizeBodyName(getDisplayRulerForSign(house?.sign, mode, dignities, displayOptions));
    }

    function buildHouseDispositorScheme(chartData, mode, displayOptions = DEFAULT_DISPLAY_OPTIONS) {
        const dignities = getMergedDignities();
        const planets = getRenderablePlanets(chartData);
        const planetByName = new Map(planets.map((planet) => [planet.name, planet]));
        const houses = Array.isArray(chartData?.houses) ? chartData.houses : [];
        const housesByRuler = new Map();
        const startPlanets = [];

        houses.forEach((house) => {
            const ruler = getHouseRuler(house, mode, dignities, displayOptions);
            const houseNumber = getHouseNumber(house);
            if (!ruler || !houseNumber) return;
            if (!housesByRuler.has(ruler)) housesByRuler.set(ruler, []);
            housesByRuler.get(ruler).push(houseNumber);
            startPlanets.push(ruler);
        });

        planets.forEach((planet) => {
            if (COMPACT_SCHEME_BODY_ORDER.includes(planet.name)) {
                startPlanets.push(planet.name);
            }
        });

        const chains = sortPlanets(startPlanets).map((startPlanet) => {
            const steps = [];
            const seen = new Map();
            let current = planetByName.get(startPlanet) || { name: startPlanet, sign: null, retrograde: false };
            let finalKey = null;
            let cycle = [];

            while (current?.name && !seen.has(current.name)) {
                seen.set(current.name, steps.length);
                const ruler = current.sign
                    ? getDisplayRulerForSign(current.sign, mode, dignities, displayOptions)
                    : null;
                steps.push({
                    planet: current.name,
                    sign: current.sign,
                    ruler,
                    retrograde: Boolean(current.retrograde),
                });

                if (!ruler) {
                    finalKey = current.name;
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
                finalKey = canonicalFinalKey(cycle);
            }

            return { start: startPlanet, steps, finalKey, cycle };
        });

        return { chains, housesByRuler };
    }

    function renderCompactNode(node, housesByRuler, displayOptions, extraClass = '') {
        const houseLabel = displayOptions.showHouseRulers ? formatHouseList(housesByRuler.get(node.planet) || []) : '';
        const label = [
            getPlanetName(node.planet),
            node.sign ? signLabel(node.sign) : '',
            houseLabel ? `${t('common.house')} ${houseLabel}` : '',
        ].filter(Boolean).join(' · ');
        return `
            <span
                class="dispositor-compact-node ${extraClass}"
                style="left:${node.x}px; top:${node.y}px;"
                title="${escapeHtml(label)}"
                aria-label="${escapeHtml(label)}"
            >
                <span class="dispositor-compact-symbol">${planetSymbol(node.planet, 32)}</span>
                ${node.retrograde ? '<span class="dispositor-node-retro">r</span>' : ''}
                ${houseLabel ? `<span class="dispositor-house-label">${escapeHtml(houseLabel)}</span>` : ''}
            </span>
        `;
    }

    function renderCompactDiagram(chains, housesByRuler, displayOptions) {
        const uniqueChains = [];
        const seen = new Set();

        chains.forEach((chain) => {
            const signature = chain.steps.map((step) => step.planet).join('>');
            if (seen.has(signature)) return;
            seen.add(signature);
            uniqueChains.push(chain);
        });

        if (!uniqueChains.length) {
            return `<p class="dispositor-empty">${escapeHtml(t('page.chart.rulers.empty.noChains'))}</p>`;
        }

        const groups = new Map();
        uniqueChains.forEach((chain) => {
            const key = chain.finalKey || 'none';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(chain);
        });

        const sortedGroups = [...groups.entries()].sort((a, b) => {
            const aSize = new Set(a[1].flatMap((chain) => chain.steps.map((step) => step.planet))).size;
            const bSize = new Set(b[1].flatMap((chain) => chain.steps.map((step) => step.planet))).size;
            return aSize - bSize || String(a[0]).localeCompare(String(b[0]));
        });

        return `
            <div class="dispositor-compact-diagram">
                ${sortedGroups.map(([key, groupChains], index) => {
                    const layout = buildCompactLayout(key, groupChains);
                    const markerRef = `url(#dispositorCompactArrow${index})`;
                    const markerEnd = displayOptions.showArrowDirection ? ` marker-end="${markerRef}"` : '';
                    const mutualMarkers = displayOptions.showArrowDirection
                        ? ` marker-start="${markerRef}" marker-end="${markerRef}"`
                        : '';
                    return `
                        <section class="dispositor-compact-group" aria-label="${escapeHtml(t('page.chart.rulers.modalTitle'))} ${index + 1}">
                            <div class="dispositor-compact-graph" style="--graph-width:${layout.width}px; --graph-height:${layout.height}px;">
                                <svg class="dispositor-compact-lines" viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true">
                                    <defs>
                                        <marker id="dispositorCompactArrow${index}" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
                                            <path d="M1,1 L10,6 L1,11"></path>
                                        </marker>
                                    </defs>
                                    ${layout.edges.map((edge) => `
                                        <path d="${escapeHtml(edge.path)}"${markerEnd}></path>
                                    `).join('')}
                                    ${layout.mutualEdges.map((edge) => `
                                        <path class="dispositor-compact-mutual" d="${escapeHtml(edge.path)}"${mutualMarkers}></path>
                                    `).join('')}
                                </svg>
                                ${layout.nodes.map((node) => renderCompactNode(node, housesByRuler, displayOptions, node.isRoot ? 'dispositor-compact-node--main' : '')).join('')}
                            </div>
                        </section>
                    `;
                }).join('')}
            </div>
        `;
    }

    function buildCompactLayout(finalKey, groupChains) {
        const nodeWidth = 42;
        const nodeHeight = 58;
        const xGap = 60;
        const yGap = 58;
        const cycleGap = 72;
        const pad = 8;
        const rootPlanets = finalKey && finalKey !== 'none' ? finalKey.split('+').filter(Boolean) : [];
        const nodes = new Map();
        const edges = [];
        const edgeKeys = new Set();

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
            ensureNode(child, childStep);
            ensureNode(parent, parentStep);
            const key = `${child}->${parent}`;
            if (edgeKeys.has(key)) return;
            edgeKeys.add(key);
            edges.push({ child, parent });
        };

        groupChains.forEach((chain) => {
            chain.steps.forEach((step) => ensureNode(step.planet, step));
            for (let index = 0; index < chain.steps.length; index += 1) {
                const step = chain.steps[index];
                const nextStep = chain.steps[index + 1];
                if (nextStep) {
                    addEdge(step, nextStep);
                } else if (step?.ruler && !chain.steps.some((candidate) => candidate.planet === step.ruler)) {
                    addEdge(step, { planet: step.ruler });
                }
            }
        });

        const roots = rootPlanets.length ? sortPlanets(rootPlanets) : sortPlanets([...nodes.keys()].filter((planet) => (
            !edges.some((edge) => edge.child === planet)
        )));
        if (!roots.length && nodes.size) roots.push([...nodes.keys()][0]);
        const rootSet = new Set(roots);
        const childrenByParent = new Map();
        const mutualEdges = [];
        const normalEdges = [];

        edges.forEach((edge) => {
            if (rootSet.has(edge.child) && rootSet.has(edge.parent)) {
                const key = sortPlanets([edge.child, edge.parent]).join('<->');
                if (!mutualEdges.some((item) => item.key === key)) {
                    mutualEdges.push({ ...edge, key });
                }
                return;
            }
            normalEdges.push(edge);
            if (!childrenByParent.has(edge.parent)) childrenByParent.set(edge.parent, []);
            childrenByParent.get(edge.parent).push(edge.child);
        });
        childrenByParent.forEach((children, parent) => {
            childrenByParent.set(parent, sortPlanets(children));
        });

        const positions = new Map();
        const layoutTree = (root, side, rootX) => {
            let nextY = pad;
            const place = (planet, depth = 0, visiting = new Set()) => {
                if (positions.has(planet)) return positions.get(planet);
                if (visiting.has(planet)) {
                    const fallback = { x: rootX + side * depth * xGap, y: nextY };
                    nextY += yGap;
                    positions.set(planet, fallback);
                    return fallback;
                }
                visiting.add(planet);
                const children = (childrenByParent.get(planet) || []).filter((child) => !rootSet.has(child));
                let y;
                if (!children.length) {
                    y = nextY;
                    nextY += yGap;
                } else {
                    const childPositions = children.map((child) => place(child, depth + 1, new Set(visiting)));
                    y = (Math.min(...childPositions.map((item) => item.y)) + Math.max(...childPositions.map((item) => item.y))) / 2;
                }
                visiting.delete(planet);
                const position = { x: rootX + side * depth * xGap, y };
                positions.set(planet, position);
                return position;
            };

            const rootPosition = place(root, 0);
            return { rootPosition, height: nextY };
        };

        if (roots.length === 2) {
            const leftRoot = roots[0];
            const rightRoot = roots[1];
            const left = layoutTree(leftRoot, -1, 0);
            const right = layoutTree(rightRoot, 1, cycleGap);
            const targetY = Math.max(left.rootPosition.y, right.rootPosition.y);
            const shiftBranch = (root, delta) => {
                const stack = [root];
                const visited = new Set();
                while (stack.length) {
                    const planet = stack.pop();
                    if (!planet || visited.has(planet)) continue;
                    visited.add(planet);
                    const position = positions.get(planet);
                    if (position) position.y += delta;
                    (childrenByParent.get(planet) || []).forEach((child) => {
                        if (!rootSet.has(child)) stack.push(child);
                    });
                }
            };
            shiftBranch(leftRoot, targetY - left.rootPosition.y);
            shiftBranch(rightRoot, targetY - right.rootPosition.y);
        } else {
            roots.forEach((root, index) => {
                const result = layoutTree(root, -1, index * (yGap * 2));
                const offset = index === 0 ? 0 : index * (yGap * 2) - result.rootPosition.y;
                if (!offset) return;
                positions.forEach((position, planet) => {
                    if (planet === root || (childrenByParent.get(root) || []).includes(planet)) position.y += offset;
                });
            });
        }

        nodes.forEach((_node, planet) => {
            if (!positions.has(planet)) {
                positions.set(planet, { x: 0, y: pad + positions.size * yGap });
            }
        });

        const minX = Math.min(...[...positions.values()].map((position) => position.x));
        const minY = Math.min(...[...positions.values()].map((position) => position.y));
        positions.forEach((position) => {
            position.x = position.x - minX + pad;
            position.y = position.y - minY + pad;
        });

        const positionedNodes = [...nodes.values()].map((node) => ({
            ...node,
            isRoot: rootSet.has(node.planet),
            ...(positions.get(node.planet) || { x: pad, y: pad }),
        }));
        const nodeByPlanet = new Map(positionedNodes.map((node) => [node.planet, node]));
        const makePath = (edge) => {
            const child = nodeByPlanet.get(edge.child);
            const parent = nodeByPlanet.get(edge.parent);
            if (!child || !parent) return null;
            const arrowGap = 1;
            const childIsLeft = child.x < parent.x;
            const startX = childIsLeft ? child.x + nodeWidth + arrowGap : child.x - arrowGap;
            const endX = childIsLeft ? parent.x - arrowGap : parent.x + nodeWidth + arrowGap;
            const startY = child.y + 21;
            const endY = parent.y + 21;
            return { ...edge, path: `M${startX},${startY} L${endX},${endY}` };
        };
        const connectorEdges = normalEdges.map(makePath).filter(Boolean);
        const connectorMutualEdges = mutualEdges.map(makePath).filter(Boolean);
        const width = Math.max(220, Math.ceil(Math.max(...positionedNodes.map((node) => node.x + nodeWidth)) + pad));
        const height = Math.max(70, Math.ceil(Math.max(...positionedNodes.map((node) => node.y + nodeHeight)) + pad));

        return {
            width,
            height,
            nodes: positionedNodes,
            edges: connectorEdges,
            mutualEdges: connectorMutualEdges,
        };
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
        const modes = ['domicile', 'exaltation', 'detriment', 'fall'];
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

    function normalizeDisplayMode(value) {
        return ['domicile', 'exaltation', 'detriment', 'fall'].includes(value) ? value : DEFAULT_DISPLAY_OPTIONS.mode;
    }

    function readDisplayOptions(overrides = {}) {
        let stored = {};
        try {
            stored = JSON.parse(window.localStorage?.getItem(DISPLAY_OPTIONS_STORAGE_KEY) || '{}') || {};
        } catch {
            stored = {};
        }
        return {
            ...DEFAULT_DISPLAY_OPTIONS,
            mode: normalizeDisplayMode(overrides.mode || stored.mode || DEFAULT_DISPLAY_OPTIONS.mode),
            showArrowDirection: (overrides.showArrowDirection ?? stored.showArrowDirection ?? DEFAULT_DISPLAY_OPTIONS.showArrowDirection) !== false,
            showHouseRulers: (overrides.showHouseRulers ?? stored.showHouseRulers ?? DEFAULT_DISPLAY_OPTIONS.showHouseRulers) !== false,
            classicalRulers: (overrides.classicalRulers ?? stored.classicalRulers ?? DEFAULT_DISPLAY_OPTIONS.classicalRulers) === true,
        };
    }

    function saveDisplayOptions(displayOptions) {
        try {
            window.localStorage?.setItem(DISPLAY_OPTIONS_STORAGE_KEY, JSON.stringify(displayOptions));
        } catch {
            // Local storage is optional; the active render still uses the selected options.
        }
    }

    function getCompactModeLabel(mode) {
        const key = `page.chart.rulers.chainModes.${mode}`;
        const label = t(key);
        if (label !== key) return label;
        return mode === 'domicile' ? t('page.chart.rulers.chainModes.domicile') : t(`astro.dignity.${mode}`);
    }

    function renderDisplayOptionsControl(displayOptions) {
        const modes = ['domicile', 'exaltation', 'detriment', 'fall'];
        return `
            <div class="dispositor-options">
                <button
                    type="button"
                    class="dispositor-options-toggle"
                    data-dispositor-options-toggle
                    aria-haspopup="menu"
                    aria-expanded="false"
                >
                    <span>${escapeHtml(getCompactModeLabel(displayOptions.mode))}</span>
                    <span class="dispositor-options-chevron" aria-hidden="true">⌄</span>
                </button>
                <div class="dispositor-options-menu hidden" data-dispositor-options-menu role="menu">
                    <div class="dispositor-options-group" role="radiogroup" aria-label="${escapeHtml(t('page.chart.rulers.options.chainType'))}">
                        ${modes.map((mode) => `
                            <label class="dispositor-option-row">
                                <input
                                    type="radio"
                                    name="dispositor-chain-mode"
                                    value="${escapeHtml(mode)}"
                                    data-dispositor-option="mode"
                                    ${mode === displayOptions.mode ? 'checked' : ''}
                                >
                                <span>${escapeHtml(getCompactModeLabel(mode))}</span>
                            </label>
                        `).join('')}
                    </div>
                    <div class="dispositor-options-divider"></div>
                    <label class="dispositor-option-row">
                        <input type="checkbox" data-dispositor-option="showArrowDirection" ${displayOptions.showArrowDirection ? 'checked' : ''}>
                        <span>${escapeHtml(t('page.chart.rulers.options.arrowDirection'))}</span>
                    </label>
                    <label class="dispositor-option-row">
                        <input type="checkbox" data-dispositor-option="showHouseRulers" ${displayOptions.showHouseRulers ? 'checked' : ''}>
                        <span>${escapeHtml(t('page.chart.rulers.options.houseRulers'))}</span>
                    </label>
                    <label class="dispositor-option-row">
                        <input type="checkbox" data-dispositor-option="classicalRulers" ${displayOptions.classicalRulers ? 'checked' : ''}>
                        <span>${escapeHtml(t('page.chart.rulers.options.classicalRulers'))}</span>
                    </label>
                </div>
            </div>
        `;
    }

    function renderCompactDispositorSection(chains, housesByRuler, displayOptions) {
        return `
            <div class="dispositor-section">
                <div class="dispositor-section-head">
                    <div>
                        <span class="dispositor-card-kicker">${escapeHtml(t('page.chart.rulers.mainKicker'))}</span>
                        <h4>${escapeHtml(t('page.chart.rulers.modalTitle'))}</h4>
                    </div>
                    ${renderDisplayOptionsControl(displayOptions)}
                </div>
                ${renderCompactDiagram(chains, housesByRuler, displayOptions)}
            </div>
        `;
    }

    function renderTabbedPanel(chartData, chains, housesByRuler, displayOptions) {
        return `
            <div class="dispositor-panel dispositor-panel--tabs">
                <div class="dispositor-tabs" role="tablist" aria-label="${escapeHtml(t('page.chart.rulers.tabs.label'))}">
                    <button type="button" class="dispositor-tab active" data-dispositor-tab="jones" role="tab" aria-selected="true">
                        ${escapeHtml(t('page.chart.rulers.tabs.jones'))}
                    </button>
                    <button type="button" class="dispositor-tab" data-dispositor-tab="scheme" role="tab" aria-selected="false">
                        ${escapeHtml(t('page.chart.rulers.tabs.scheme'))}
                    </button>
                </div>
                <div class="dispositor-tab-panel active" data-dispositor-panel="jones" role="tabpanel">
                    ${renderJonesPattern(chartData?.cosmogram_pattern)}
                </div>
                <div class="dispositor-tab-panel" data-dispositor-panel="scheme" role="tabpanel">
                    ${renderCompactDispositorSection(chains, housesByRuler, displayOptions)}
                </div>
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

        const displayOptions = readDisplayOptions(options);
        const { chains, housesByRuler } = buildHouseDispositorScheme(chartData, displayOptions.mode, displayOptions);

        // Granular forecast-new blocks request a single section instead of the
        // combined/tabbed panel: 'jones' (cosmogram only) or 'scheme'
        // (dispositor scheme only).
        if (options.section === 'jones') {
            container.innerHTML = `<div class="dispositor-panel">${renderJonesPattern(chartData?.cosmogram_pattern)}</div>`;
        } else if (options.section === 'scheme') {
            container.innerHTML = `<div class="dispositor-panel">${renderCompactDispositorSection(chains, housesByRuler, displayOptions)}</div>`;
        } else {
            container.innerHTML = options.layout === 'tabs'
                ? renderTabbedPanel(chartData, chains, housesByRuler, displayOptions)
                : `
                    <div class="dispositor-panel">
                        ${renderJonesPattern(chartData?.cosmogram_pattern)}
                        ${renderCompactDispositorSection(chains, housesByRuler, displayOptions)}
                    </div>
                `;
        }

        container.querySelectorAll('[data-dispositor-tab]').forEach((button) => {
            button.addEventListener('click', () => {
                const tab = button.dataset.dispositorTab;
                container.querySelectorAll('[data-dispositor-tab]').forEach((item) => {
                    const isActive = item.dataset.dispositorTab === tab;
                    item.classList.toggle('active', isActive);
                    item.setAttribute('aria-selected', isActive ? 'true' : 'false');
                });
                container.querySelectorAll('[data-dispositor-panel]').forEach((panel) => {
                    panel.classList.toggle('active', panel.dataset.dispositorPanel === tab);
                });
            });
        });

        const toggle = container.querySelector('[data-dispositor-options-toggle]');
        const menu = container.querySelector('[data-dispositor-options-menu]');
        toggle?.addEventListener('click', (event) => {
            event.stopPropagation();
            const isOpen = menu && !menu.classList.contains('hidden');
            menu?.classList.toggle('hidden', isOpen);
            toggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        });
        menu?.addEventListener('click', (event) => event.stopPropagation());
        menu?.querySelectorAll('[data-dispositor-option]').forEach((input) => {
            input.addEventListener('change', () => {
                const nextOptions = { ...displayOptions };
                if (input.dataset.dispositorOption === 'mode') {
                    nextOptions.mode = normalizeDisplayMode(input.value);
                } else {
                    nextOptions[input.dataset.dispositorOption] = input.checked;
                }
                saveDisplayOptions(nextOptions);
                render(container, chartData, nextOptions);
            });
        });
    }

    window.DispositorChains = {
        render,
        buildChains,
        buildHouseDispositorScheme,
        buildCompactLayout,
        closeModal,
    };

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeModal();
            document.querySelectorAll('.dispositor-options-menu').forEach((menu) => menu.classList.add('hidden'));
            document.querySelectorAll('[data-dispositor-options-toggle][aria-expanded="true"]').forEach((toggle) => {
                toggle.setAttribute('aria-expanded', 'false');
            });
        }
    });

    document.addEventListener('click', (event) => {
        if (event.target instanceof Element && event.target.closest('.dispositor-options')) return;
        document.querySelectorAll('.dispositor-options-menu').forEach((menu) => menu.classList.add('hidden'));
        document.querySelectorAll('[data-dispositor-options-toggle][aria-expanded="true"]').forEach((toggle) => {
            toggle.setAttribute('aria-expanded', 'false');
        });
    });
})();

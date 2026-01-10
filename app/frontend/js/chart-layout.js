/**
 * Chart Layout — Mobile navigation, panel tabs & chart interactivity (zoom/pan)
 */

(function() {
    'use strict';

    // ========== ZOOM / PAN STATE ==========
    let scale = 1;
    let pointX = 0, pointY = 0;
    let panning = false;
    let startX = 0, startY = 0;

    function setTransform() {
        const wrapper = document.getElementById('chartWheelWrapper');
        if (wrapper) {
            wrapper.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
        }
    }

    function zoomIn() { scale = Math.min(scale * 1.2, 5); setTransform(); }
    function zoomOut() { scale = Math.max(scale / 1.2, 0.5); setTransform(); }
    function resetZoom() { scale = 1; pointX = 0; pointY = 0; setTransform(); }

    // ========== MOBILE VIEW SWITCHING ==========
    function switchMobileView(viewName) {
        const viewChart = document.getElementById('view-chart');
        const viewPlanets = document.getElementById('view-planets');
        const viewHouses = document.getElementById('view-houses');

        [viewChart, viewPlanets, viewHouses].forEach(el => {
            if (el) el.classList.remove('active-view');
        });

        const target = document.getElementById('view-' + viewName);
        if (target) target.classList.add('active-view');

        document.querySelectorAll('.mobile-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });
    }

    // ========== PANEL TAB SWITCHING ==========
    function switchPanelTab(panel, tabName) {
        panel.querySelectorAll('.panel-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.panelTab === tabName);
        });
        panel.querySelectorAll('.panel-tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabName);
        });
    }

    // ========== HIGHLIGHT / TOOLTIP ==========
    let activeHighlight = null;

    function highlightPlanet(planetName, active, event) {
        const tooltip = document.getElementById('tooltip');
        const chartCenter = document.getElementById('view-chart');

        // Reset all highlights
        document.querySelectorAll('.planet-group .planet-circle').forEach(c => {
            c.setAttribute('fill', 'white');
            c.setAttribute('r', '12');
        });
        document.querySelectorAll('.data-table tr').forEach(r => r.classList.remove('active-row'));
        if (tooltip) tooltip.style.display = 'none';

        if (active && planetName) {
            activeHighlight = planetName;

            // Highlight table row
            const row = document.getElementById(`row-${planetName}`);
            if (row) {
                row.classList.add('active-row');
                row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }

            // Highlight circle on chart
            const group = document.querySelector(`.planet-group[data-planet="${planetName}"]`);
            if (group) {
                const circle = group.querySelector('.planet-circle');
                if (circle) {
                    circle.setAttribute('fill', '#f0f0f0');
                    circle.setAttribute('r', '15');
                }
            }

            // Show tooltip
            if (tooltip && event && window.chartDataCache) {
                const planet = window.chartDataCache.planets?.find(p => p.name === planetName);
                if (planet) {
                    const signRu = Symbols.signNamesRu[planet.sign] || planet.sign;
                    const signSymbol = Symbols.signs[planet.sign] || '';
                    const nameRu = Symbols.planetNamesRu[planet.name] || planet.name;
                    const symbol = Symbols.planets[planet.name] || '';

                    tooltip.innerHTML = `
                        <strong>${symbol} ${nameRu}</strong><br>
                        ${signSymbol} ${signRu} ${planet.degree_in_sign_formatted || planet.degree_in_sign.toFixed(2) + '°'}<br>
                        Дом ${planet.house}
                    `;
                    tooltip.style.display = 'block';
                    moveTooltip(event, chartCenter, tooltip);
                }
            }
        } else {
            activeHighlight = null;
        }
    }

    let activeAspectHighlight = null;

    function highlightAspect(aspectKey, active) {
        // Сбрасываем все выделения аспектов
        document.querySelectorAll('.aspect-line').forEach(line => {
            line.style.opacity = '';
            line.style.strokeWidth = '';
        });
        document.querySelectorAll('tr[data-aspect]').forEach(row => {
            row.classList.remove('active-row');
        });

        if (active && aspectKey) {
            activeAspectHighlight = aspectKey;

            // Выделяем линию аспекта на карте
            const aspectLine = document.querySelector(`.aspect-line[data-aspect="${aspectKey}"]`);
            if (aspectLine) {
                aspectLine.style.opacity = '1';
                aspectLine.style.strokeWidth = '3';
            }

            // Выделяем строку в таблице
            const row = document.querySelector(`tr[data-aspect="${aspectKey}"]`);
            if (row) {
                row.classList.add('active-row');
            }

            // Подсветка связанных планет
            const [p1, p2] = aspectKey.split('-');
            [p1, p2].forEach(pName => {
                const group = document.querySelector(`.planet-group[data-planet="${pName}"]`);
                if (group) {
                    const circle = group.querySelector('.planet-circle');
                    if (circle) {
                        circle.setAttribute('r', '15');
                    }
                }
            });
        } else {
            activeAspectHighlight = null;
            // Сбрасываем размеры планет
            document.querySelectorAll('.planet-group .planet-circle').forEach(c => {
                c.setAttribute('r', '12');
            });
        }
    }

    function moveTooltip(e, container, tooltip) {
        if (!container || !tooltip) return;
        const rect = container.getBoundingClientRect();
        let x = (e.clientX || e.pageX) - rect.left + 15;
        let y = (e.clientY || e.pageY) - rect.top;

        if (x + 150 > rect.width) x -= 170;
        if (y + 80 > rect.height) y -= 70;

        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
    }

    // ========== INIT ==========
    document.addEventListener('DOMContentLoaded', function() {
        const chartCenter = document.getElementById('view-chart');
        const tooltip = document.getElementById('tooltip');

        // --- Zoom buttons ---
        const zoomInBtn = document.getElementById('zoomIn');
        const zoomOutBtn = document.getElementById('zoomOut');
        const zoomResetBtn = document.getElementById('zoomReset');

        if (zoomInBtn) zoomInBtn.addEventListener('click', zoomIn);
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', zoomOut);
        if (zoomResetBtn) zoomResetBtn.addEventListener('click', resetZoom);

        // --- Mouse wheel zoom ---
        if (chartCenter) {
            chartCenter.addEventListener('wheel', (e) => {
                e.preventDefault();
                if (e.deltaY < 0) { scale *= 1.1; } else { scale /= 1.1; }
                scale = Math.max(0.5, Math.min(5, scale));
                setTransform();
            }, { passive: false });

            // --- Mouse drag pan ---
            chartCenter.addEventListener('mousedown', (e) => {
                if (e.target.closest('.zoom-controls-float')) return;
                panning = true;
                startX = e.clientX - pointX;
                startY = e.clientY - pointY;
                chartCenter.style.cursor = 'grabbing';
            });

            chartCenter.addEventListener('mouseup', () => {
                panning = false;
                chartCenter.style.cursor = 'grab';
            });

            chartCenter.addEventListener('mouseleave', () => {
                panning = false;
                chartCenter.style.cursor = 'grab';
            });

            chartCenter.addEventListener('mousemove', (e) => {
                if (!panning) return;
                e.preventDefault();
                pointX = e.clientX - startX;
                pointY = e.clientY - startY;
                setTransform();
            });

            // --- Touch gestures ---
            chartCenter.addEventListener('touchstart', (e) => {
                if (e.touches.length === 1) {
                    panning = true;
                    startX = e.touches[0].clientX - pointX;
                    startY = e.touches[0].clientY - pointY;
                }
            }, { passive: true });

            chartCenter.addEventListener('touchmove', (e) => {
                if (panning && e.touches.length === 1) {
                    e.preventDefault();
                    pointX = e.touches[0].clientX - startX;
                    pointY = e.touches[0].clientY - startY;
                    setTransform();
                }
            }, { passive: false });

            chartCenter.addEventListener('touchend', () => { panning = false; });

            // --- Tooltip follows mouse ---
            chartCenter.addEventListener('mousemove', (e) => {
                if (activeHighlight && tooltip && tooltip.style.display === 'block' && !panning) {
                    moveTooltip(e, chartCenter, tooltip);
                }
            });
        }

        // --- Mobile navigation ---
        document.querySelectorAll('.mobile-tab').forEach(btn => {
            btn.addEventListener('click', () => switchMobileView(btn.dataset.view));
        });

        // --- Panel tabs ---
        document.querySelectorAll('.panel-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const panel = tab.closest('.side-panel');
                switchPanelTab(panel, tab.dataset.panelTab);
            });
        });

        // --- Default mobile view ---
        if (window.innerWidth <= 1024) {
            switchMobileView('chart');
        }

        // --- Planet hover on SVG (using event delegation) ---
        document.addEventListener('mouseenter', (e) => {
            const group = e.target.closest('.planet-group');
            if (group) {
                highlightPlanet(group.dataset.planet, true, e);
            }
        }, true);

        document.addEventListener('mouseleave', (e) => {
            const group = e.target.closest('.planet-group');
            if (group) {
                highlightPlanet(null, false);
            }
        }, true);

        // --- Click on planet group ---
        document.addEventListener('click', (e) => {
            const group = e.target.closest('.planet-group');
            if (group) {
                e.stopPropagation();
                highlightPlanet(group.dataset.planet, true, e);
            }
        });

        // --- Click on table row to highlight ---
        document.addEventListener('click', (e) => {
            const row = e.target.closest('tr[data-planet]');
            if (row) {
                highlightAspect(null, false); // сбросить выделение аспекта
                highlightPlanet(row.dataset.planet, true, e);
            }
        });

        // --- Click on aspect row in table ---
        document.addEventListener('click', (e) => {
            const row = e.target.closest('tr[data-aspect]');
            if (row && !row.hasAttribute('data-planet')) {
                e.stopPropagation();
                highlightPlanet(null, false); // сбросить выделение планеты
                highlightAspect(row.dataset.aspect, true);
            }
        });

        // --- Click on aspect line on chart ---
        document.addEventListener('click', (e) => {
            const line = e.target.closest('.aspect-line');
            if (line) {
                e.stopPropagation();
                highlightPlanet(null, false);
                highlightAspect(line.dataset.aspect, true);
            }
        });

        // --- Click elsewhere to clear highlight ---
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.planet-group') &&
                !e.target.closest('tr[data-planet]') &&
                !e.target.closest('tr[data-aspect]') &&
                !e.target.closest('.aspect-line')) {
                highlightPlanet(null, false);
                highlightAspect(null, false);
            }
        });
    });

    // Expose for external use
    window.highlightPlanet = highlightPlanet;
    window.highlightAspect = highlightAspect;
})();


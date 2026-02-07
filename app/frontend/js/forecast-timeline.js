/**
 * forecast-timeline.js — Gantt-style timeline for transit events
 * Canvas-based rendering with tooltip interaction
 */
(function() {
    'use strict';

    // ─── Constants ──────────────────────────────────────
    const ROW_HEIGHT = 24;
    const HEADER_HEIGHT = 40;
    const LEFT_LABEL_WIDTH = 160;
    const RIGHT_PAD = 20;
    const DPR = window.devicePixelRatio || 1;

    // Aspect colors
    const ASPECT_COLORS = {
        'Conjunction': '#6366f1',
        'Opposition': '#ef4444',
        'Trine': '#22c55e',
        'Square': '#f97316',
        'Sextile': '#06b6d4',
        'Quincunx': '#a855f7',
        'SemiSextile': '#84cc16',
        'SemiSquare': '#f59e0b',
        'Sesquiquadrate': '#ec4899',
    };
    const DEFAULT_COLOR = '#9ca3af';

    // ─── State ──────────────────────────────────────────
    let canvas, ctx;
    let events = [];
    let startMs, endMs, totalMs;
    let rows = []; // { label, color, x1, x2, xExact, event }
    let hoveredRow = -1;
    let canvasW, canvasH;

    // ─── Public render ──────────────────────────────────
    function render(evts, startDate, endDate) {
        events = evts || [];
        startMs = new Date(startDate).getTime();
        endMs = new Date(endDate).getTime();
        totalMs = endMs - startMs;
        if (totalMs <= 0) return;

        canvas = document.getElementById('timelineCanvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');

        // Sort events by t_exact
        events.sort((a, b) => new Date(a.t_exact) - new Date(b.t_exact));

        // Build rows
        buildRows();
        setupCanvas();
        draw();
        bindEvents();
        renderLegend();
    }

    function buildRows() {
        rows = events.map(ev => {
            const tEnter = new Date(ev.t_enter).getTime();
            const tExact = new Date(ev.t_exact).getTime();
            const tLeave = new Date(ev.t_leave).getTime();

            const pSym = Symbols?.planets?.[ev.transit_body] || ev.transit_body;
            const nSym = Symbols?.planets?.[ev.natal_body] || ev.natal_body;
            const aSym = Symbols?.aspects?.[ev.aspect_type] || '';
            const label = `${pSym} ${aSym} ${nSym}`;
            const color = ASPECT_COLORS[ev.aspect_type] || DEFAULT_COLOR;

            return {
                label,
                color,
                x1: Math.max(tEnter, startMs),
                x2: Math.min(tLeave, endMs),
                xExact: tExact,
                event: ev,
            };
        });
    }

    function setupCanvas() {
        const wrapper = canvas.parentElement;
        canvasW = wrapper.clientWidth || 800;
        canvasH = HEADER_HEIGHT + rows.length * ROW_HEIGHT + 10;
        canvas.width = canvasW * DPR;
        canvas.height = canvasH * DPR;
        canvas.style.width = canvasW + 'px';
        canvas.style.height = canvasH + 'px';
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    // ─── Drawing ────────────────────────────────────────
    function draw() {
        ctx.clearRect(0, 0, canvasW, canvasH);
        drawHeader();
        drawGrid();
        drawBars();
        drawTodayLine();
        if (hoveredRow >= 0 && hoveredRow < rows.length) {
            highlightRow(hoveredRow);
        }
    }

    function drawTodayLine() {
        const nowMs = Date.now();
        if (nowMs < startMs || nowMs > endMs) return;
        const x = dateToX(nowMs);
        // Dashed vertical line
        ctx.save();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(x, HEADER_HEIGHT);
        ctx.lineTo(x, canvasH);
        ctx.stroke();
        ctx.setLineDash([]);
        // "Сегодня" label at top
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Сегодня', x, HEADER_HEIGHT - 14);
        // Small triangle marker
        ctx.beginPath();
        ctx.moveTo(x - 4, HEADER_HEIGHT - 1);
        ctx.lineTo(x + 4, HEADER_HEIGHT - 1);
        ctx.lineTo(x, HEADER_HEIGHT + 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    function dateToX(ms) {
        const frac = (ms - startMs) / totalMs;
        return LEFT_LABEL_WIDTH + frac * (canvasW - LEFT_LABEL_WIDTH - RIGHT_PAD);
    }

    function drawHeader() {
        ctx.fillStyle = '#f8f8f8';
        ctx.fillRect(0, 0, canvasW, HEADER_HEIGHT);
        ctx.strokeStyle = '#e5e5e7';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, HEADER_HEIGHT);
        ctx.lineTo(canvasW, HEADER_HEIGHT);
        ctx.stroke();

        // Date ticks
        ctx.fillStyle = '#6b7280';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        const totalDays = totalMs / 86400000;
        let step = 1;
        if (totalDays > 180) step = 30;
        else if (totalDays > 60) step = 7;
        else if (totalDays > 14) step = 3;

        const d = new Date(startMs);
        d.setHours(0,0,0,0);
        while (d.getTime() <= endMs) {
            const x = dateToX(d.getTime());
            if (x >= LEFT_LABEL_WIDTH && x <= canvasW - RIGHT_PAD) {
                ctx.fillText(formatTickDate(d), x, HEADER_HEIGHT - 8);
                ctx.beginPath();
                ctx.moveTo(x, HEADER_HEIGHT - 3);
                ctx.lineTo(x, HEADER_HEIGHT);
                ctx.stroke();
            }
            d.setDate(d.getDate() + step);
        }
    }

    function formatTickDate(d) {
        const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
        return `${d.getDate()} ${months[d.getMonth()]}`;
    }

    function drawGrid() {
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < rows.length; i++) {
            const y = HEADER_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT;
            ctx.beginPath();
            ctx.moveTo(LEFT_LABEL_WIDTH, y);
            ctx.lineTo(canvasW, y);
            ctx.stroke();
        }
    }

    function drawBars() {
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        rows.forEach((row, i) => {
            const y = HEADER_HEIGHT + i * ROW_HEIGHT;
            const cy = y + ROW_HEIGHT / 2;

            // Label
            ctx.fillStyle = '#374151';
            ctx.fillText(row.label, LEFT_LABEL_WIDTH - 8, cy);

            // Bar
            const x1 = dateToX(row.x1);
            const x2 = dateToX(row.x2);
            const barW = Math.max(x2 - x1, 2);
            const barH = ROW_HEIGHT * 0.5;
            const barY = cy - barH / 2;
            const xExact = dateToX(row.xExact);

            // Intensity gradient: low opacity at edges → full at exact
            const grad = ctx.createLinearGradient(x1, 0, x2, 0);
            const t = barW > 2 ? Math.max(0, Math.min(1, (xExact - x1) / barW)) : 0.5;
            const c = row.color;
            grad.addColorStop(0, c + '18');          // ~9% at enter
            grad.addColorStop(Math.max(t - 0.05, 0), c + '60'); // ramp up
            grad.addColorStop(t, c + 'CC');           // ~80% at exact
            grad.addColorStop(Math.min(t + 0.05, 1), c + '60'); // ramp down
            grad.addColorStop(1, c + '18');           // ~9% at leave

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(x1, barY, barW, barH, 3);
            ctx.fill();

            // Exact marker
            ctx.fillStyle = row.color;
            ctx.beginPath();
            ctx.arc(xExact, cy, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function highlightRow(idx) {
        const y = HEADER_HEIGHT + idx * ROW_HEIGHT;
        ctx.fillStyle = 'rgba(99, 102, 241, 0.06)';
        ctx.fillRect(0, y, canvasW, ROW_HEIGHT);
    }

    // ─── Interaction ────────────────────────────────────
    function bindEvents() {
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseleave', onMouseLeave);
        canvas.addEventListener('click', onClick);
        canvas.style.cursor = 'pointer';
    }

    function onClick(e) {
        const rect = canvas.getBoundingClientRect();
        const mouseY = e.clientY - rect.top;
        const rowIdx = Math.floor((mouseY - HEADER_HEIGHT) / ROW_HEIGHT);
        if (rowIdx >= 0 && rowIdx < rows.length) {
            const ev = rows[rowIdx].event;
            const exactDate = ev.t_exact ? ev.t_exact.split('T')[0] : null;
            if (exactDate && window.ForecastNavigation) {
                window.ForecastNavigation.goToBiwheel(exactDate);
            }
        }
    }

    function onMouseMove(e) {
        const rect = canvas.getBoundingClientRect();
        const mouseY = e.clientY - rect.top;
        const rowIdx = Math.floor((mouseY - HEADER_HEIGHT) / ROW_HEIGHT);

        if (rowIdx !== hoveredRow) {
            hoveredRow = rowIdx;
            draw();
        }

        // Tooltip
        const tooltip = document.getElementById('timelineTooltip');
        if (rowIdx >= 0 && rowIdx < rows.length) {
            const row = rows[rowIdx];
            const ev = row.event;
            const pSym = Symbols?.planets?.[ev.transit_body] || ev.transit_body;
            const nSym = Symbols?.planets?.[ev.natal_body] || ev.natal_body;
            const aSym = Symbols?.aspects?.[ev.aspect_type] || ev.aspect_type;

            tooltip.innerHTML = `
                <div class="tt-title">${pSym} ${ev.transit_body} ${aSym} ${nSym} ${ev.natal_body}</div>
                <div class="tt-row"><span class="tt-label">Вход:</span> ${formatDateTime(ev.t_enter)}</div>
                <div class="tt-row"><span class="tt-label">Точный:</span> ${formatDateTime(ev.t_exact)}</div>
                <div class="tt-row"><span class="tt-label">Выход:</span> ${formatDateTime(ev.t_leave)}</div>
                <div class="tt-row"><span class="tt-label">Орб:</span> ${ev.min_orb?.toFixed(2)}°</div>
                <div class="tt-row"><span class="tt-label">Тип:</span> ${ev.is_major ? 'Мажорный' : 'Минорный'}</div>
            `;
            tooltip.classList.add('visible');
            tooltip.style.left = (e.clientX + 12) + 'px';
            tooltip.style.top = (e.clientY - 20) + 'px';
        } else {
            tooltip.classList.remove('visible');
        }
    }

    function onMouseLeave() {
        hoveredRow = -1;
        draw();
        document.getElementById('timelineTooltip')?.classList.remove('visible');
    }

    function formatDateTime(isoStr) {
        if (!isoStr) return '—';
        const d = new Date(isoStr);
        const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }

    // ─── Legend ──────────────────────────────────────────
    function renderLegend() {
        const container = document.getElementById('timelineLegend');
        if (!container) return;
        const usedAspects = [...new Set(events.map(e => e.aspect_type))];
        container.innerHTML = usedAspects.map(a => {
            const color = ASPECT_COLORS[a] || DEFAULT_COLOR;
            const sym = Symbols?.aspects?.[a] || '';
            return `<div class="timeline-legend-item">
                <span class="timeline-legend-color" style="background:${color}"></span>
                ${sym} ${a}
            </div>`;
        }).join('');
    }

    // ─── Export ──────────────────────────────────────────
    window.ForecastTimeline = { render };
})();


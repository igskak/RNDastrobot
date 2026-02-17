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
    let canvas, ctx, wrapper;
    let events = [];
    let startMs, endMs, totalMs;
    let rows = [];
    let hoveredRow = -1;
    let canvasW, canvasH;
    let scrollTop = 0;
    let totalContentH = 0;
    let boundScroll = false;
    let boundCanvasEvents = false;

    // ─── Public render ──────────────────────────────────
    function render(evts, startDate, endDate) {
        const normalized = window.ForecastTimelineUtils?.normalizeTimelineEvents
            ? window.ForecastTimelineUtils.normalizeTimelineEvents(evts || [], startDate, endDate)
            : { events: evts || [], range: null };
        events = normalized.events || [];

        if (normalized.range) {
            startMs = normalized.range.startMs;
            endMs = normalized.range.endMs;
            totalMs = normalized.range.totalMs;
        } else {
            startMs = new Date(startDate).getTime();
            endMs = new Date(endDate).getTime();
            totalMs = endMs - startMs;
        }
        if (totalMs <= 0) return;

        canvas = document.getElementById('timelineCanvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        wrapper = canvas.parentElement;

        events.sort((a, b) => new Date(a.t_exact) - new Date(b.t_exact));

        buildRows();
        setupCanvas();
        draw();
        bindEvents();
        renderLegend();
    }

    function buildRows() {
        // Group events by transit+aspect+natal into single Gantt rows
        const grouped = new Map();
        events.forEach(ev => {
            const key = window.ForecastTimelineUtils?.buildTimelineRowKey
                ? window.ForecastTimelineUtils.buildTimelineRowKey(ev)
                : `${ev.transit_body}|${ev.aspect_type}|${ev.natal_body}`;
            if (!grouped.has(key)) {
                const pSym = Symbols?.planets?.[ev.transit_body] || ev.transit_body;
                const nSym = Symbols?.planets?.[ev.natal_body] || ev.natal_body;
                const aSym = Symbols?.aspects?.[ev.aspect_type] || '';
                grouped.set(key, {
                    label: `${pSym} ${aSym} ${nSym}`,
                    color: ASPECT_COLORS[ev.aspect_type] || DEFAULT_COLOR,
                    spans: [],
                    events: [],
                });
            }
            const g = grouped.get(key);
            g.spans.push({
                x1: Math.max(new Date(ev.t_enter).getTime(), startMs),
                x2: Math.min(new Date(ev.t_leave).getTime(), endMs),
                xExact: new Date(ev.t_exact).getTime(),
            });
            g.events.push(ev);
        });
        rows = Array.from(grouped.values());
        // Sort: slow planets first, then by first exact date
        const PLANET_ORDER = ['Pluto','Neptune','Uranus','Chiron','Saturn','Jupiter','TrueNorthNode','TrueSouthNode','BlackMoon','Proserpina','Mars','Venus','Mercury','Sun','Moon'];
        rows.sort((a, b) => {
            const pa = PLANET_ORDER.indexOf(a.events[0].transit_body);
            const pb = PLANET_ORDER.indexOf(b.events[0].transit_body);
            if (pa !== pb) return pa - pb;
            return a.spans[0].xExact - b.spans[0].xExact;
        });
    }

    function setupCanvas() {
        canvasW = wrapper.clientWidth || 800;
        totalContentH = HEADER_HEIGHT + rows.length * ROW_HEIGHT + 10;
        // Canvas = visible viewport height (capped), wrapper scrolls
        const viewH = Math.min(totalContentH, wrapper.clientHeight || 600);
        canvasH = viewH;
        canvas.width = canvasW * DPR;
        canvas.height = canvasH * DPR;
        canvas.style.width = canvasW + 'px';
        canvas.style.height = canvasH + 'px';
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

        // Spacer for native scroll
        let spacer = wrapper.querySelector('.tl-spacer');
        if (!spacer) {
            spacer = document.createElement('div');
            spacer.className = 'tl-spacer';
            spacer.style.cssText = 'width:1px;pointer-events:none;';
            wrapper.appendChild(spacer);
        }
        spacer.style.height = totalContentH + 'px';
        // Sticky canvas
        canvas.style.position = 'sticky';
        canvas.style.top = '0';
        canvas.style.zIndex = '1';

        if (!boundScroll) {
            boundScroll = true;
            wrapper.addEventListener('scroll', () => {
                scrollTop = wrapper.scrollTop;
                draw();
            }, { passive: true });
        }
        scrollTop = wrapper.scrollTop;
    }

    // ─── Drawing (virtual scroll) ────────────────────────
    function getVisibleRange() {
        const firstRow = Math.max(0, Math.floor((scrollTop - HEADER_HEIGHT) / ROW_HEIGHT));
        const lastRow = Math.min(rows.length - 1, Math.ceil((scrollTop + canvasH - HEADER_HEIGHT) / ROW_HEIGHT));
        return { firstRow, lastRow };
    }

    function draw() {
        ctx.clearRect(0, 0, canvasW, canvasH);
        ctx.save();
        ctx.translate(0, -scrollTop);
        drawGrid();
        drawBars();
        drawTodayLine();
        if (hoveredRow >= 0 && hoveredRow < rows.length) {
            highlightRow(hoveredRow);
        }
        ctx.restore();
        // Header on top (not scrolled)
        drawHeader();
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
        const { firstRow, lastRow } = getVisibleRange();
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 0.5;
        for (let i = firstRow; i <= lastRow; i++) {
            const y = HEADER_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT;
            ctx.beginPath();
            ctx.moveTo(LEFT_LABEL_WIDTH, y);
            ctx.lineTo(canvasW, y);
            ctx.stroke();
        }
    }

    function drawBars() {
        const { firstRow, lastRow } = getVisibleRange();
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        for (let i = firstRow; i <= lastRow; i++) {
            const row = rows[i];
            const y = HEADER_HEIGHT + i * ROW_HEIGHT;
            const cy = y + ROW_HEIGHT / 2;

            // Label
            ctx.fillStyle = '#374151';
            ctx.fillText(row.label, LEFT_LABEL_WIDTH - 8, cy);

            // Draw each span
            const barH = ROW_HEIGHT * 0.5;
            const barY = cy - barH / 2;
            row.spans.forEach(span => {
                const x1 = dateToX(span.x1);
                const x2 = dateToX(span.x2);
                const barW = Math.max(x2 - x1, 2);
                const xExact = dateToX(span.xExact);

                const grad = ctx.createLinearGradient(x1, 0, x2, 0);
                const t = barW > 2 ? Math.max(0, Math.min(1, (xExact - x1) / barW)) : 0.5;
                const c = row.color;
                grad.addColorStop(0, c + '18');
                grad.addColorStop(Math.max(t - 0.05, 0), c + '60');
                grad.addColorStop(t, c + 'CC');
                grad.addColorStop(Math.min(t + 0.05, 1), c + '60');
                grad.addColorStop(1, c + '18');

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.roundRect(x1, barY, barW, barH, 3);
                ctx.fill();

                ctx.fillStyle = row.color;
                ctx.beginPath();
                ctx.arc(xExact, cy, 3, 0, Math.PI * 2);
                ctx.fill();
            });
        }
    }

    function highlightRow(idx) {
        const y = HEADER_HEIGHT + idx * ROW_HEIGHT;
        ctx.fillStyle = 'rgba(99, 102, 241, 0.06)';
        ctx.fillRect(0, y, canvasW, ROW_HEIGHT);
    }

    // ─── Interaction ────────────────────────────────────
    function bindEvents() {
        if (boundCanvasEvents) return;
        boundCanvasEvents = true;
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseleave', onMouseLeave);
        canvas.addEventListener('click', onClick);
        canvas.style.cursor = 'pointer';
    }

    // Find which span in a row the mouseX hits
    function findSpanAt(row, mouseX) {
        for (let si = 0; si < row.spans.length; si++) {
            const x1 = dateToX(row.spans[si].x1);
            const x2 = dateToX(row.spans[si].x2);
            if (mouseX >= x1 - 2 && mouseX <= x2 + 2) return si;
        }
        return row.spans.length > 0 ? 0 : -1; // fallback to first
    }

    function mouseToRow(e) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top + scrollTop;
        const rowIdx = Math.floor((mouseY - HEADER_HEIGHT) / ROW_HEIGHT);
        return { mouseX, rowIdx };
    }

    function onClick(e) {
        const { mouseX, rowIdx } = mouseToRow(e);
        if (rowIdx >= 0 && rowIdx < rows.length) {
            const row = rows[rowIdx];
            const si = findSpanAt(row, mouseX);
            const ev = si >= 0 ? row.events[si] : row.events[0];
            const exactDate = ev.t_exact ? ev.t_exact.split('T')[0] : null;
            if (exactDate && window.ForecastNavigation) {
                window.ForecastNavigation.goToBiwheel(exactDate, {
                    transitBody: ev.transit_body,
                    aspectType: ev.aspect_type,
                    natalBody: ev.natal_body,
                });
            }
        }
    }

    function onMouseMove(e) {
        const { mouseX, rowIdx } = mouseToRow(e);

        if (rowIdx !== hoveredRow) {
            hoveredRow = rowIdx;
            draw();
        }

        // Tooltip
        const tooltip = document.getElementById('timelineTooltip');
        if (rowIdx >= 0 && rowIdx < rows.length) {
            const row = rows[rowIdx];
            const si = findSpanAt(row, mouseX);
            const ev = si >= 0 ? row.events[si] : row.events[0];
            const pSym = Symbols?.planets?.[ev.transit_body] || ev.transit_body;
            const nSym = Symbols?.planets?.[ev.natal_body] || ev.natal_body;
            const aSym = Symbols?.aspects?.[ev.aspect_type] || ev.aspect_type;
            const isMulti = row.events.length > 1;
            const countInfo = isMulti ? `<div class="tt-row"><span class="tt-label">Вхождений:</span> ${row.events.length}</div>` : '';
            const singleEntry = !isMulti ? `
                <div class="tt-row"><span class="tt-label">Вход:</span> ${formatTimelineBoundDateTime(ev.t_enter)}</div>
                <div class="tt-row"><span class="tt-label">Точный:</span> ${formatTimelineBoundDateTime(ev.t_exact)}</div>
                <div class="tt-row"><span class="tt-label">Выход:</span> ${formatTimelineBoundDateTime(ev.t_leave)}</div>
            ` : '';
            const allEntries = isMulti
                ? `<div class="tt-row"><span class="tt-label">Все вхождения:</span></div>${buildAllEntriesHtml(row.events)}`
                : '';

            tooltip.innerHTML = `
                <div class="tt-title">${pSym} ${ev.transit_body} ${aSym} ${nSym} ${ev.natal_body}</div>
                ${singleEntry}
                <div class="tt-row"><span class="tt-label">Орб:</span> ${ev.min_orb?.toFixed(2)}°</div>
                ${countInfo}
                ${allEntries}
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

    function formatTimelineBoundDateTime(isoStr) {
        if (!isoStr) return '—';
        const ts = new Date(isoStr).getTime();
        const base = formatDateTime(isoStr);
        if (Number.isNaN(ts)) return base;
        if (ts < startMs || ts > endMs) return `${base} (вне диапазона)`;
        return base;
    }

    function buildAllEntriesHtml(eventsList) {
        const sorted = [...(eventsList || [])].sort((a, b) => new Date(a.t_exact) - new Date(b.t_exact));
        return sorted.map((item, idx) => `
            <div class="tt-row"><span class="tt-label">#${idx + 1} вход:</span> ${formatTimelineBoundDateTime(item.t_enter)}</div>
            <div class="tt-row"><span class="tt-label">#${idx + 1} точный:</span> ${formatTimelineBoundDateTime(item.t_exact)}</div>
            <div class="tt-row"><span class="tt-label">#${idx + 1} выход:</span> ${formatTimelineBoundDateTime(item.t_leave)}</div>
        `).join('');
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

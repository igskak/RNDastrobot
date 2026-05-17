export function getPlanetLeaderLineEndPoint(anchorPoint, iconPoint, iconRadius, gap = 2) {
    const dx = iconPoint.x - anchorPoint.x;
    const dy = iconPoint.y - anchorPoint.y;
    const distance = Math.hypot(dx, dy);
    if (!distance) {
        return { x: iconPoint.x, y: iconPoint.y };
    }

    const trim = Math.min(
        distance,
        Math.max(0, Number(iconRadius) || 0) + Math.max(0, Number(gap) || 0)
    );
    const ratio = (distance - trim) / distance;
    return {
        x: anchorPoint.x + dx * ratio,
        y: anchorPoint.y + dy * ratio,
    };
}

export function appendPlanetLeaderAnnotation(group, options = {}) {
    const {
        createSvgElement,
        anchorPoint,
        iconPoint,
        iconBoxSize,
        scale = 1,
        leaderColor = '#6b7280',
        leaderStrokeWidth = 0.32,
        leaderOpacity = 0.4,
        anchorMaskFill = '#fafafa',
        minTargetRadius = 10,
        gap = 2.2,
        pointerEvents = 'none',
    } = options;

    if (!group || typeof createSvgElement !== 'function' || !anchorPoint || !iconPoint) {
        return null;
    }

    const targetRadius = Math.max(
        Number(minTargetRadius || 0) * Math.max(0, Number(scale) || 1),
        Number(iconBoxSize || 0) * 0.5
    );
    const leaderEnd = getPlanetLeaderLineEndPoint(anchorPoint, iconPoint, targetRadius, gap);
    const sharedStyle = pointerEvents ? `pointer-events: ${pointerEvents};` : null;

    group.appendChild(createSvgElement('line', {
        x1: anchorPoint.x,
        y1: anchorPoint.y,
        x2: leaderEnd.x,
        y2: leaderEnd.y,
        stroke: leaderColor,
        'stroke-width': leaderStrokeWidth,
        opacity: leaderOpacity,
        class: 'planet-leader-line',
        ...(sharedStyle ? { style: sharedStyle } : {}),
    }));

    group.appendChild(createSvgElement('circle', {
        cx: anchorPoint.x,
        cy: anchorPoint.y,
        r: 1.64,
        fill: anchorMaskFill,
        stroke: 'none',
        opacity: 1,
        class: 'planet-anchor-point-mask',
        ...(sharedStyle ? { style: sharedStyle } : {}),
    }));

    group.appendChild(createSvgElement('circle', {
        cx: anchorPoint.x,
        cy: anchorPoint.y,
        r: 1.8,
        fill: 'none',
        stroke: leaderColor,
        'stroke-width': leaderStrokeWidth,
        opacity: 1,
        class: 'planet-anchor-point',
        ...(sharedStyle ? { style: sharedStyle } : {}),
    }));

    return { leaderEnd, targetRadius };
}

"""Draw the landing hero's bi-wheel (natal + transits) for the demo person and
inject it into app/frontend/index.html between the hero-wheel markers.

Usage (from repo root, with the project venv that has pyswisseph):
    .venv/bin/python docs/marketing/product-hunt/gallery-src/hero_wheel.py

Positions come from the Swiss Ephemeris with the app's defaults (tropical,
Placidus); the look follows app/frontend/js/prognostic-rings-wheel.js (ring
proportions, #fafafa / #d1d5db / #9ca3af, element-tinted sign sectors) and the
default colours in app/frontend/js/preferences.js. Glyphs are text in the app's
astro symbol font (var(--font-symbol)), so the SVG stays small and sharp.
"""
import math
import pathlib
import re
import sys

import swisseph as swe

ROOT = pathlib.Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT))
from app.utils.ephemeris import get_ephemeris_path  # noqa: E402
INDEX = ROOT / "app" / "frontend" / "index.html"
START, END = "<!-- hero-wheel:start -->", "<!-- hero-wheel:end -->"

# Demo person Maya Lindqvist: 14.03.1988 06:42 PST, Portland, Oregon.
NATAL_UT = (1988, 3, 14, 14 + 42 / 60)
LAT, LON = 45.5152, -122.6784
# Transits at the exact pass of Pluto conjunct her natal Moon: 17.02.2027 11:29 PST.
TRANSIT_UT = (2027, 2, 17, 19 + 29 / 60)

BODIES = [
    ("Sun", swe.SUN, "☉"), ("Moon", swe.MOON, "☽"), ("Mercury", swe.MERCURY, "☿"),
    ("Venus", swe.VENUS, "♀"), ("Mars", swe.MARS, "♂"), ("Jupiter", swe.JUPITER, "♃"),
    ("Saturn", swe.SATURN, "♄"), ("Uranus", swe.URANUS, "♅"), ("Neptune", swe.NEPTUNE, "♆"),
    ("Pluto", swe.PLUTO, "♇"), ("TrueNode", swe.TRUE_NODE, "☊"), ("Chiron", swe.CHIRON, "⚷"),
]
BODY_COLORS = {  # preferences.js DEFAULT_BODY_COLORS
    "Sun": "#ef4444", "Moon": "#84cc16", "Mercury": "#84cc16", "Venus": "#ef4444", "Mars": "#3b82f6",
    "Jupiter": "#84cc16", "Saturn": "#3b82f6", "Uranus": "#3b82f6", "Neptune": "#ef4444",
    "Pluto": "#f59e0b", "TrueNode": "#3b82f6", "Chiron": "#ef4444",
}
SIGNS = "♈♉♊♋♌♍♎♏♐♑♒♓"
ELEMENT_COLORS = ["#ef4444", "#84cc16", "#f59e0b", "#3b82f6"]  # Fire, Earth, Air, Water
ASPECTS = [  # angle, name, glyph, colour (preferences.js defaults), css class
    (0, "Conjunction", "\u260c", "#f59e0b", "conj"), (60, "Sextile", "\u26b9", "#22c55e", "sextile"),
    (90, "Square", "\u25a1", "#ef4444", "square"), (120, "Trine", "\u25b3", "#3b82f6", "trine"),
    (180, "Opposition", "\u260d", "#ef4444", "opp"),
]
# A hand-sized wheel cannot carry every contact: 1 degree orb, and the transiting
# Moon (a new sign every two and a half days) is left out.
ORB = 1.0
SLOW = {"Jupiter", "Saturn", "Uranus", "Neptune", "Pluto", "Chiron"}
ASPECTS_START, ASPECTS_END = "<!-- hero-aspects:start -->", "<!-- hero-aspects:end -->"
TEXT_VS = "︎"  # text presentation, never the emoji form

# Geometry: viewBox 300, rings in the proportions of the app's wheel.
C = 150
R_OUT, R_SIGN_OUT, R_SIGN_IN = 146, 139, 121
R_TRANSIT_IN = 95
R_NATAL_IN = 60
R_TRANSIT_GLYPH, R_NATAL_GLYPH = 108, 80


def positions(ut):
    jd = swe.julday(*ut)
    out = []
    for name, code, glyph in BODIES:
        (lon, _lat, _dist, speed, *_), _ = swe.calc_ut(jd, code, swe.FLG_SWIEPH | swe.FLG_SPEED)
        out.append({"name": name, "lon": lon, "speed": speed, "glyph": glyph})
    return jd, out


def angle_of(lon, asc):
    """Screen angle (radians, counter-clockwise from +x) with the ASC on the left."""
    return math.radians(180 + (lon - asc))


def xy(r, ang):
    return C + r * math.cos(ang), C - r * math.sin(ang)


def spread(lons, min_gap):
    """Nudge glyph longitudes apart so neighbours keep min_gap degrees."""
    order = sorted(range(len(lons)), key=lambda i: lons[i])
    placed = [lons[i] for i in order]
    for _ in range(300):
        moved = False
        for k in range(len(placed)):
            a, b = placed[k], placed[(k + 1) % len(placed)]
            gap = (b - a) % 360
            if gap < min_gap:
                push = (min_gap - gap) / 2
                placed[k] = (a - push) % 360
                placed[(k + 1) % len(placed)] = (b + push) % 360
                moved = True
        if not moved:
            break
    result = [0.0] * len(lons)
    for k, i in enumerate(order):
        result[i] = placed[k]
    return result


def fmt(v):
    return f"{v:.1f}".rstrip("0").rstrip(".")


def line(x1, y1, x2, y2, stroke, width, extra=""):
    return f'<line x1="{fmt(x1)}" y1="{fmt(y1)}" x2="{fmt(x2)}" y2="{fmt(y2)}" stroke="{stroke}" stroke-width="{width}"{extra}/>'


def arc_sector(r1, r2, a1, a2, fill):
    p1, p2 = xy(r1, a1), xy(r1, a2)
    q2, q1 = xy(r2, a2), xy(r2, a1)
    return (f'<path d="M{fmt(p1[0])} {fmt(p1[1])}A{r1} {r1} 0 0 0 {fmt(p2[0])} {fmt(p2[1])}'
            f'L{fmt(q2[0])} {fmt(q2[1])}A{r2} {r2} 0 0 1 {fmt(q1[0])} {fmt(q1[1])}Z" fill="{fill}"/>')


def build():
    swe.set_ephe_path(get_ephemeris_path())
    jd_n, natal = positions(NATAL_UT)
    _, transit = positions(TRANSIT_UT)
    cusps, ascmc = swe.houses(jd_n, LAT, LON, b"P")
    asc, mc = ascmc[0], ascmc[1]

    parts = [f'<circle cx="{C}" cy="{C}" r="{R_OUT}" fill="#fafafa" stroke="#d1d5db"/>']
    # Sign band: element-tinted sectors, boundaries, glyphs.
    for i in range(12):
        colour = ELEMENT_COLORS[i % 4]
        a1, a2 = angle_of(i * 30, asc), angle_of((i + 1) * 30, asc)
        parts.append(arc_sector(R_SIGN_OUT, R_SIGN_IN, a1, a2, colour + "18"))
        bx1, by1 = xy(R_OUT, a1)
        bx2, by2 = xy(R_SIGN_IN, a1)
        parts.append(line(bx1, by1, bx2, by2, "#9ca3af", 1))
        gx, gy = xy((R_SIGN_OUT + R_SIGN_IN) / 2, angle_of(i * 30 + 15, asc))
        parts.append(f'<text x="{fmt(gx)}" y="{fmt(gy)}" fill="{colour}" font-size="11">{SIGNS[i]}{TEXT_VS}</text>')
    # Degree ticks every 5 degrees.
    for deg in range(0, 360, 5):
        ang = angle_of(deg, asc)
        x1, y1 = xy(R_OUT, ang)
        x2, y2 = xy(R_SIGN_OUT + (1.5 if deg % 10 == 0 else 4), ang)
        parts.append(line(x1, y1, x2, y2, "#c4c8cf", 0.6))
    for r in (R_SIGN_OUT, R_SIGN_IN, R_TRANSIT_IN):
        parts.append(f'<circle cx="{C}" cy="{C}" r="{r}" fill="none" stroke="#d1d5db"/>')
    parts.append(f'<circle cx="{C}" cy="{C}" r="{R_TRANSIT_IN}" fill="#fff" stroke="#d1d5db"/>')
    parts.append(f'<circle cx="{C}" cy="{C}" r="{R_NATAL_IN}" fill="#fff" stroke="#d1d5db"/>')

    # Natal houses: cusp lines across the natal band, angles bold and long.
    for i, cusp in enumerate(cusps[:12]):
        ang = angle_of(cusp, asc)
        angular = i in (0, 3, 6, 9)
        x1, y1 = xy(R_NATAL_IN, ang)
        x2, y2 = xy(R_SIGN_IN if angular else R_TRANSIT_IN, ang)
        parts.append(line(x1, y1, x2, y2, "#1f2937" if angular else "#d1d5db", 1.6 if angular else 0.8))
        nxt = cusps[(i + 1) % 12]
        mid = cusp + ((nxt - cusp) % 360) / 2
        hx, hy = xy(R_NATAL_IN + 6, angle_of(mid, asc))
        parts.append(f'<text x="{fmt(hx)}" y="{fmt(hy)}" class="is-house">{i + 1}</text>')
    # Axis labels sit inside the centre circle, clear of the planet glyphs.
    for label, lon, off in (("ASC", asc, -1), ("MC", mc, 1)):
        lx, ly = xy(R_NATAL_IN - 17, angle_of(lon + off * 13, asc))
        parts.append(f'<text x="{fmt(lx)}" y="{fmt(ly)}" class="is-angle">{label}</text>')

    # Transit -> natal aspects, drawn inside the centre circle.
    aspects = []
    for t in transit:
        if t["name"] == "Moon":
            continue
        for n in natal:
            diff = abs((t["lon"] - n["lon"] + 180) % 360 - 180)
            for ang_deg, name, glyph, colour, css in ASPECTS:
                if abs(diff - ang_deg) <= ORB:
                    aspects.append((abs(diff - ang_deg), t, n, name, colour, glyph, css))
    aspects.sort(key=lambda item: item[0])
    for delta, t, n, name, colour, _glyph, _css in aspects:
        tx, ty = xy(R_NATAL_IN, angle_of(t["lon"], asc))
        nx, ny = xy(R_NATAL_IN, angle_of(n["lon"], asc))
        if name == "Conjunction":
            parts.append(f'<circle cx="{fmt(nx)}" cy="{fmt(ny)}" r="4.5" fill="none" stroke="{colour}" stroke-width="1.6"/>')
            continue
        width = 1.6 if delta < 0.5 else 1
        parts.append(line(tx, ty, nx, ny, colour, width, ' stroke-opacity="0.85"'))

    # Planet glyphs, nudged apart, each with a tick at its true longitude.
    def ring(bodies, r_glyph, r_edge, tick_dir, min_gap, retro):
        shown = spread([b["lon"] for b in bodies], min_gap)
        for b, lon in zip(bodies, shown):
            ang_true = angle_of(b["lon"], asc)
            x1, y1 = xy(r_edge, ang_true)
            x2, y2 = xy(r_edge + tick_dir * 4, ang_true)
            parts.append(line(x1, y1, x2, y2, "#6b7280", 0.8))
            gx, gy = xy(r_glyph, angle_of(lon, asc))
            colour = BODY_COLORS[b["name"]]
            parts.append(f'<text x="{fmt(gx)}" y="{fmt(gy)}" fill="{colour}" font-size="12">{b["glyph"]}{TEXT_VS}</text>')
            if retro and b["speed"] < 0 and b["name"] != "TrueNode":
                parts.append(f'<text x="{fmt(gx + 5.5)}" y="{fmt(gy + 5)}" class="is-retro">R</text>')
            ex, ey = xy(R_NATAL_IN, ang_true)
            if r_glyph == R_NATAL_GLYPH:
                parts.append(f'<circle cx="{fmt(ex)}" cy="{fmt(ey)}" r="1.4" fill="{colour}"/>')

    ring(natal, R_NATAL_GLYPH, R_TRANSIT_IN, -1, 9.5, retro=False)
    ring(transit, R_TRANSIT_GLYPH, R_SIGN_IN, -1, 7.5, retro=True)

    body = "".join(parts)
    return (f'<svg class="landing-mini-wheel" viewBox="0 0 300 300" role="img" '
            f'aria-labelledby="heroWheelTitle"><title id="heroWheelTitle" '
            f'data-i18n="page.index.preview.wheel.alt">Bi-wheel</title>{body}</svg>'), aspects


def aspect_chips(aspects, count=4):
    """The contacts named under the wheel: slow planets first, then by orb."""
    ranked = sorted(aspects, key=lambda a: (a[1]["name"] not in SLOW, a[0]))[:count]
    items = []
    for delta, t, n, _name, _colour, glyph, css in ranked:
        minutes = round(delta * 60)
        items.append(f'<li class="is-{css}"><span class="landing-mini-glyphs">{t["glyph"]} {glyph} {n["glyph"]}</span>'
                     f'<span>{minutes // 60}\u00b0{minutes % 60:02d}\u2032</span></li>')
    return "".join(items)


def inject(html, start, end, content):
    pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    if not pattern.search(html):
        raise SystemExit(f"markers {start} not found in index.html")
    return pattern.sub(lambda _m: f"{start}{content}{end}", html)


def main():
    svg, aspects = build()
    html = INDEX.read_text(encoding="utf-8")
    html = inject(html, START, END, svg)
    html = inject(html, ASPECTS_START, ASPECTS_END, aspect_chips(aspects))
    INDEX.write_text(html, encoding="utf-8")
    print(f"wheel: {len(svg)} bytes; transit-natal aspects:")
    for delta, t, n, name, *_ in aspects:
        print(f"  {t['name']:8} {name:11} {n['name']:8} orb {delta:.2f}")


if __name__ == "__main__":
    main()

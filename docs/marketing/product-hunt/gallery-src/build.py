"""Render the Product Hunt gallery, thumbnail and OG image from the raw app screens.

Usage (from repo root):
    python3 docs/marketing/product-hunt/gallery-src/build.py

Needs Google Chrome (headless) and network access for Google Fonts.
Raw screens live in ../screens/ (2880x1800, captured at 2x from a 1440x900 viewport).
Outputs go to ../gallery/ at 2x of Product Hunt's 1270x760 (2540x1520), plus
thumbnail-240.png and og-1200x630.png.
"""
import pathlib
import subprocess

HERE = pathlib.Path(__file__).resolve().parent
SCREENS = HERE.parent / "screens"
OUT = HERE.parent / "gallery"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

FONTS = (
    '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400'
    '&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet">'
)

BASE_CSS = """
:root{--bg:#F9F7F2;--ink:#1E3A5F;--ink-soft:#5B6B80;--gold:#B8935A;--gold-pale:#F5EDDF;--line:#E4DED2}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:%(w)dpx;height:%(h)dpx;overflow:hidden;background:var(--bg)}
body{font-family:'DM Sans',sans-serif;color:var(--ink);position:relative;
  background:radial-gradient(900px 520px at 88%% -10%%,rgba(184,147,90,.18),transparent 70%%),
             radial-gradient(700px 480px at -5%% 110%%,rgba(30,58,95,.08),transparent 70%%),var(--bg)}
.kicker{font-size:15px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);font-weight:600}
h1{font-family:'Cormorant Garamond',serif;font-weight:500;color:var(--ink);letter-spacing:-.01em}
p.sub{color:var(--ink-soft);font-size:19px;line-height:1.45}
.frame{position:absolute;border-radius:14px;background:#fff;overflow:hidden;
  box-shadow:0 1px 2px rgba(30,58,95,.06),0 30px 70px -24px rgba(30,58,95,.35);border:1px solid var(--line)}
.bar{height:30px;background:#F3F0E8;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:7px;padding:0 13px}
.bar i{width:10px;height:10px;border-radius:50%%;background:#DCD5C7;display:block}
.bar span{margin-left:14px;font-size:11.5px;color:#9A9384;letter-spacing:.02em}
.shot{position:absolute;left:0;right:0;top:30px;bottom:0;background-repeat:no-repeat}
.brand{position:absolute;display:flex;align-items:center;gap:10px;font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:600;color:var(--ink);letter-spacing:.02em}
.brand b{width:30px;height:30px;border-radius:8px;background:var(--ink);display:grid;place-items:center;color:var(--gold);font-size:19px;font-weight:500}
"""

# Slide: (file, screen, kicker, title, sub, crop)
# crop = (x0, y0, zoom): left/top of the visible window as a fraction of the screen, and zoom
# (1 = the full 1440px screen width fits the frame).
SLIDES = [
    ("01-workspace", "workspace", "Steliara",
     "The workspace for practicing astrologers",
     "Charts, the people you read for and your sessions, together in one calm place.",
     (0, 0, 1)),
    ("02-profile", "profile", "Person profile",
     "Every person, one profile",
     "Their charts, your notes and the whole history of your work together. Open it before a reading and the context is back.",
     (0, 0, 1)),
    ("03-assistant", "assistant", "Answers from the chart",
     "Ask the chart. Get exact dates.",
     "Transiting Pluto to her natal Moon, five years back and forward: three exact passes, in seconds. The reading stays yours.",
     (0.216, 0.0, 1.28)),
    ("04-history", "profile_history", "Sessions",
     "Nothing from a session gets lost",
     "Every reading stays with the person: what you looked at, when, and what you noted. Recorded calls add a transcript and a short summary.",
     (0.05, 0.37, 1.45)),
    ("05-timeline", "timeline", "Forecast",
     "A year of transits on one screen",
     "Each contact with its exact dates, stations and eclipses, one line per aspect.",
     (0, 0, 1)),
    ("06-synastry", "synastry", "Synastry",
     "Two people, one view",
     "Synastry and composite straight from linked profiles, with every position side by side.",
     (0, 0, 1)),
    ("07-people", "people", "Your practice",
     "Everyone you read for, a click away",
     "Search, tags, this month's solar returns and the transits that matter right now.",
     (0, 0, 1)),
    ("08-foundation", "workspace", "Built for careful work",
     "Swiss Ephemeris precision. Nothing to install.",
     "House systems, tropical and sidereal, orbs your way. Mac, Windows and any browser. 14-day free trial, no card.",
     (0.2, 0.05, 1.7)),
]

W, H = 1270, 760
FRAME_X, FRAME_Y, FRAME_W = 75, 212, 1120
FRAME_H = H - FRAME_Y + 40  # bleeds off the bottom edge


def slide_html(screen, kicker, title, sub, crop):
    x0, y0, zoom = crop
    img_w = FRAME_W * zoom
    img_h = img_w * 900 / 1440
    bg = (
        f"background-image:url('{(SCREENS / (screen + '.png')).as_uri()}');"
        f"background-size:{img_w:.1f}px {img_h:.1f}px;"
        f"background-position:{-x0 * img_w:.1f}px {-y0 * img_h:.1f}px"
    )
    return f"""<!doctype html><html><head><meta charset="utf-8">{FONTS}<style>{BASE_CSS % {'w': W, 'h': H}}
.head{{position:absolute;left:75px;top:52px;width:1120px;display:grid;grid-template-columns:1fr 470px;column-gap:48px;align-items:end}}
h1{{font-size:50px;line-height:1.02;margin-top:12px}}
</style></head><body>
<div class="head"><div><div class="kicker">{kicker}</div><h1>{title}</h1></div><p class="sub">{sub}</p></div>
<div class="frame" style="left:{FRAME_X}px;top:{FRAME_Y}px;width:{FRAME_W}px;height:{FRAME_H}px">
<div class="bar"><i></i><i></i><i></i><span>steliara.com</span></div><div class="shot" style="{bg}"></div></div>
</body></html>"""


def thumb_html():
    return f"""<!doctype html><html><head><meta charset="utf-8">{FONTS}<style>
*{{margin:0;padding:0}}html,body{{width:240px;height:240px;overflow:hidden;background:#1E3A5F}}
body{{position:relative;display:grid;place-items:center;background:radial-gradient(160px 160px at 70% 20%,rgba(184,147,90,.35),transparent 70%),#1E3A5F}}
.m{{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:168px;line-height:1;color:#E9D6B0;transform:translateY(-8px)}}
.star{{position:absolute;top:30px;right:40px;font-size:34px;line-height:1;color:#D9B97F;font-family:'DM Sans',sans-serif}}
</style></head><body><div class="m">S</div><div class="star">&#10022;</div></body></html>"""


def og_html():
    shot = (SCREENS / "workspace.png").as_uri()
    return f"""<!doctype html><html><head><meta charset="utf-8">{FONTS}<style>{BASE_CSS % {'w': 1200, 'h': 630}}
.l{{position:absolute;left:64px;top:0;bottom:0;width:470px;display:flex;flex-direction:column;justify-content:center;gap:18px}}
h1{{font-size:54px;line-height:1.02}}
.frame{{left:585px;top:92px;width:760px;height:560px}}
.shot{{background-image:url('{shot}');background-size:1140px 712.5px;background-position:-228px -20px}}
</style></head><body>
<div class="l"><div class="brand" style="position:static"><b>S</b>Steliara</div>
<h1>The workspace for practicing astrologers</h1>
<p class="sub">Charts, people and recorded sessions in one calm place. Mac, Windows, any browser.</p></div>
<div class="frame"><div class="bar"><i></i><i></i><i></i><span>steliara.com</span></div><div class="shot"></div></div>
</body></html>"""


def render(html, name, w, h, scale):
    src = HERE / f"_{name}.html"
    src.write_text(html, encoding="utf-8")
    subprocess.run(
        [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
         f"--force-device-scale-factor={scale}", f"--window-size={w},{h}",
         "--virtual-time-budget=6000", f"--screenshot={OUT / (name + '.png')}", src.as_uri()],
        check=True, capture_output=True,
    )
    src.unlink()


def main():
    OUT.mkdir(exist_ok=True)
    for name, screen, kicker, title, sub, crop in SLIDES:
        render(slide_html(screen, kicker, title, sub, crop), name, W, H, 2)
        print("rendered", name)
    render(thumb_html(), "thumbnail-240", 240, 240, 1)
    render(og_html(), "og-1200x630", 1200, 630, 1)
    print("rendered thumbnail + og")


if __name__ == "__main__":
    main()

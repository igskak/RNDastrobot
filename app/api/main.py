"""
FastAPI приложение для Astrobot
"""
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse, Response
import os
import sys
import time
import logging
from typing import List
from urllib.parse import urlencode
from dotenv import load_dotenv

# Загрузка переменных окружения (из app/.env)
_APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_APP_DIR, '.env'))

# Настройка логирования для production — минимальный уровень
if os.getenv('APP_ENV') == 'production':
    # Отключаем избыточные логи
    logging.getLogger('sqlalchemy').setLevel(logging.ERROR)
    logging.getLogger('sqlalchemy.engine').setLevel(logging.ERROR)
    logging.getLogger('uvicorn.access').setLevel(logging.WARNING)

    # Настраиваем loguru для минимального логирования
    from loguru import logger
    logger.remove()  # Удаляем default handler
    logger.add(sys.stderr, level="WARNING")  # Только WARNING и выше

from app.api.routes import auth, natal, transits, solar, progressions, directions, ingresses, places, consultations, alerts, preferences, call_sessions, synastry, charts, persons, assistant, billing, lunar, electional, composite, forecast, profections, antiscia, asteroids, dominants, fixed_stars, declination, client_memory, conversions
from app.api.error_handlers import register_error_handlers
from app.api.locale_dependency import locale_context_dependency
from app.services.processing_pipeline import recover_stuck_sessions
from app.auth.site_mode import is_solo_request


@asynccontextmanager
async def lifespan(app: FastAPI):
    recover_stuck_sessions()   # re-queue any sessions stuck mid-processing
    yield

# Путь к frontend
FRONTEND_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")

# Создание приложения
app = FastAPI(
    title="Astrobot API",
    description="API для расчёта натальных карт и астрологического анализа",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    dependencies=[Depends(locale_context_dependency)],
    lifespan=lifespan,
)

register_error_handlers(app)

# Сжатие уменьшает время передачи JS/CSS/JSON на медленных каналах.
app.add_middleware(GZipMiddleware, minimum_size=1024)

def _resolve_cors_origins() -> List[str]:
    raw = os.getenv("CORS_ALLOW_ORIGINS", "").strip()
    if raw:
        if raw == "*":
            return ["*"]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    # Без явной настройки в production CORS не открываем.
    if os.getenv("APP_ENV", "development").lower() == "production":
        return []

    # Dev defaults для локальной разработки.
    return [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]


# CORS middleware
cors_origins = _resolve_cors_origins()
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials="*" not in cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.middleware("http")
async def server_timing(request: Request, call_next):
    """D4 (Фаза 4): отдаём Server-Timing с полным временем обработки запроса —
    дешёвый замер TTFB слоя до/после кэшей (DevTools → Timing → Server Timing).
    Только для API, чтобы не шуметь на статике."""
    start = time.perf_counter()
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        duration_ms = (time.perf_counter() - start) * 1000.0
        existing = response.headers.get("Server-Timing")
        header = f"total;dur={duration_ms:.1f}"
        response.headers["Server-Timing"] = f"{existing}, {header}" if existing else header
    return response


@app.middleware("http")
async def head_as_get(request: Request, call_next):
    if request.method == "HEAD":
        request.scope["method"] = "GET"
        response = await call_next(request)
        return Response(
            status_code=response.status_code,
            headers=dict(response.headers),
        )
    return await call_next(request)


@app.middleware("http")
async def isolate_solo_marketing_routes(request: Request, call_next):
    """Keep the invite-only Solo hostname out of commercial acquisition pages."""
    commercial_paths = {
        "/pricing.html",
        "/cloud-astrology-software",
        "/cloud-astrology-software.html",
        "/astrologer-workspace",
        "/astrologer-workspace.html",
        "/astrology-practice-management",
        "/astrology-practice-management.html",
    }
    if is_solo_request(request) and request.url.path in commercial_paths:
        return RedirectResponse(url="/", status_code=307)
    return await call_next(request)


@app.middleware("http")
async def static_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    frontend_document_paths = {
        "/",
        "/new",
        "/login",
        "/login.html",
        "/index.html",
        "/account-settings",
        "/account-settings.html",
        "/natal-full.html",
        "/forecast-tables",
        "/forecast-tables.html",
        "/forecast-timeline",
        "/forecast-timeline.html",
        "/calendar",
        "/calendar.html",
        "/consultation-call.html",
        "/consultation-join.html",
        "/pricing.html",
        "/terms.html",
        "/cloud-astrology-software",
        "/cloud-astrology-software.html",
        "/astrologer-workspace",
        "/astrologer-workspace.html",
        "/astrology-practice-management",
        "/astrology-practice-management.html",
    }

    if path in frontend_document_paths or path.startswith(("/client/", "/consultation/")):
        # HTML documents should always revalidate so deploys pick up the latest
        # versioned asset markers immediately after rollout.
        response.headers["Cache-Control"] = "no-store, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"

    if path.startswith(("/css/", "/js/", "/bundles/", "/locales/", "/assets/", "/fonts/")):
        if os.getenv("APP_ENV", "development").lower() == "production":
            response.headers.setdefault("Cache-Control", "public, max-age=31536000, immutable")
        else:
            # Disable aggressive asset caching in local development so Chrome
            # doesn't keep serving stale bundles after rollbacks.
            response.headers["Cache-Control"] = "no-store, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
    return response

# Подключение роутеров
app.include_router(natal.router, prefix="/api/v1", tags=["Natal Charts"])
app.include_router(auth.router, prefix="/api/v1", tags=["Auth"])
app.include_router(transits.router, prefix="/api/v1", tags=["Transits"])
app.include_router(solar.router, prefix="/api/v1", tags=["Solar Return"])
app.include_router(progressions.router, prefix="/api/v1", tags=["Progressions"])
app.include_router(directions.router, prefix="/api/v1", tags=["Directions"])
app.include_router(ingresses.router, prefix="/api/v1", tags=["Ingresses"])
app.include_router(places.router, prefix="/api/v1", tags=["Places"])
app.include_router(consultations.router, prefix="/api/v1", tags=["Consultations"])
app.include_router(call_sessions.router, prefix="/api/v1", tags=["Call Sessions"])
app.include_router(client_memory.router, prefix="/api/v1", tags=["Client Memory"])
app.include_router(alerts.router, prefix="/api/v1", tags=["Alerts"])
app.include_router(preferences.router, prefix="/api/v1", tags=["Preferences"])
app.include_router(synastry.router, prefix="/api/v1", tags=["Synastry"])
app.include_router(charts.router, prefix="/api/v1", tags=["Charts"])
app.include_router(persons.router, prefix="/api/v1", tags=["Persons"])
app.include_router(assistant.router, prefix="/api/v1", tags=["Assistant"])
app.include_router(billing.router, prefix="/api/v1", tags=["Billing"])
app.include_router(lunar.router, prefix="/api/v1", tags=["Lunar"])
app.include_router(electional.router, prefix="/api/v1", tags=["Electional"])
app.include_router(composite.router, prefix="/api/v1", tags=["Composite"])
app.include_router(forecast.router, prefix="/api/v1", tags=["Forecast"])
app.include_router(profections.router, prefix="/api/v1", tags=["Profections"])
app.include_router(antiscia.router, prefix="/api/v1", tags=["Antiscia"])
app.include_router(asteroids.router, prefix="/api/v1", tags=["Asteroids"])
app.include_router(dominants.router, prefix="/api/v1", tags=["Dominants"])
app.include_router(fixed_stars.router, prefix="/api/v1", tags=["FixedStars"])
app.include_router(declination.router, prefix="/api/v1", tags=["Declination"])
app.include_router(conversions.router, prefix="/api/v1", tags=["Conversions"])

# Статические файлы (CSS, JS)
if os.path.exists(FRONTEND_PATH):
    app.mount("/css", StaticFiles(directory=os.path.join(FRONTEND_PATH, "css")), name="css")
    app.mount("/js", StaticFiles(directory=os.path.join(FRONTEND_PATH, "js")), name="js")
    if os.path.exists(os.path.join(FRONTEND_PATH, "bundles")):
        app.mount("/bundles", StaticFiles(directory=os.path.join(FRONTEND_PATH, "bundles")), name="bundles")
    if os.path.exists(os.path.join(FRONTEND_PATH, "fonts")):
        app.mount("/fonts", StaticFiles(directory=os.path.join(FRONTEND_PATH, "fonts")), name="fonts")
    if os.path.exists(os.path.join(FRONTEND_PATH, "locales")):
        app.mount("/locales", StaticFiles(directory=os.path.join(FRONTEND_PATH, "locales")), name="locales")
    if os.path.exists(os.path.join(FRONTEND_PATH, "assets")):
        app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_PATH, "assets")), name="assets")


@app.get("/runtime-config.js")
async def runtime_config_js():
    """Expose public client-side runtime config (analytics, env) as JS.

    Served dynamically so the public PostHog project key and EU host come from
    env vars instead of being committed into the static frontend. The PostHog
    *project* key is publishable by design; no secret is exposed here.
    """
    import json

    config = {
        "posthogKey": os.getenv("POSTHOG_PROJECT_API_KEY", ""),
        "posthogHost": os.getenv("POSTHOG_HOST", "https://eu.i.posthog.com"),
        "appEnv": os.getenv("APP_ENV", "production"),
        # GA4 Measurement ID (G-XXXXXXXXXX). Public by design; gated client-side
        # behind the same consent banner via gtag Consent Mode. Empty => GA4 off.
        "ga4MeasurementId": os.getenv("GA4_MEASUREMENT_ID", ""),
        "onboardingV1Enabled": os.getenv("ONBOARDING_V1_ENABLED", "false").strip().lower()
        in {"1", "true", "yes", "on"},
        "onboardingV1LaunchedAt": os.getenv("ONBOARDING_V1_LAUNCHED_AT", "").strip(),
    }
    body = f"window.__RUNTIME_CONFIG__ = {json.dumps(config)};"
    return Response(
        content=body,
        media_type="application/javascript",
        headers={"Cache-Control": "no-store"},
    )


def _public_base_url() -> str:
    """Canonical public origin for SEO files (sitemap/robots)."""
    return (
        os.getenv("FRONTEND_BASE_URL", "").strip()
        or os.getenv("APP_BASE_URL", "").strip()
        or "https://www.steliara.com"
    ).rstrip("/")


# Crawlers that read the site in order to *answer questions and cite sources*.
# Naming them explicitly is redundant with `User-agent: *` today, but it makes the
# intent unmissable: an AI engine that cannot fetch us cannot cite us, and our only
# non-ads signups so far have arrived via an LLM answer rather than Google.
_AI_SEARCH_BOTS = (
    "GPTBot",          # OpenAI crawler
    "OAI-SearchBot",   # ChatGPT search index
    "ChatGPT-User",    # ChatGPT fetching a page on a user's behalf
    "PerplexityBot",   # Perplexity index
    "Perplexity-User", # Perplexity fetching a page on a user's behalf
    "ClaudeBot",       # Anthropic crawler
    "Claude-User",
    "anthropic-ai",
    "Google-Extended",  # Gemini / AI Overviews grounding
    "Applebot-Extended",
    "Bingbot",          # Copilot rides the Bing index
    "Amazonbot",
    "meta-externalagent",
)

# Paths that hold, or can expose, someone else's chart and consultation data.
_CRAWLER_DISALLOW = (
    "/api/",
    "/account-settings",
    "/client/",
    "/consultation/",
    "/call/",
)


@app.get("/robots.txt")
async def robots_txt():
    """Crawler directives. Allow public pages, keep app internals out, point to sitemap."""
    base = _public_base_url()
    lines = ["User-agent: *", "Allow: /"]
    lines += [f"Disallow: {p}" for p in _CRAWLER_DISALLOW]
    for bot in _AI_SEARCH_BOTS:
        lines += ["", f"User-agent: {bot}", "Allow: /"]
        lines += [f"Disallow: {p}" for p in _CRAWLER_DISALLOW]
    lines += [
        "",
        f"Sitemap: {base}/sitemap.xml",
        f"# Machine-readable summary for AI agents: {base}/llms.txt",
        "",
    ]
    return Response(content="\n".join(lines), media_type="text/plain", headers={"Cache-Control": "public, max-age=86400"})


# Public, indexable pages with the priority we actually want crawlers to infer.
_SITEMAP_PAGES = (
    ("/", "1.0"),
    ("/astrology-practice-management", "0.9"),
    ("/astrologer-workspace", "0.9"),
    ("/cloud-astrology-software", "0.9"),
    ("/pricing.html", "0.8"),
    ("/terms.html", "0.3"),
)

# Bumped by hand when the public marketing pages change in substance. AI engines
# weight recency, and an undated URL loses to a dated one.
_SITEMAP_LASTMOD = "2026-08-06"


@app.get("/sitemap.xml")
async def sitemap_xml():
    """Sitemap of public, indexable pages."""
    base = _public_base_url()
    urls = "".join(
        f"<url><loc>{base}{path}</loc>"
        f"<lastmod>{_SITEMAP_LASTMOD}</lastmod>"
        f"<priority>{priority}</priority></url>"
        for path, priority in _SITEMAP_PAGES
    )
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f"{urls}</urlset>"
    )
    return Response(content=body, media_type="application/xml", headers={"Cache-Control": "public, max-age=86400"})


@app.get("/llms.txt")
async def llms_txt():
    """Plain-text product summary for AI assistants (see llmstxt.org).

    An LLM answering "what software records astrology consultations?" gets one
    shot at reading us. This file states the category, the differentiator and the
    price in the order an answer engine needs them, without rendering the site.
    """
    base = _public_base_url()
    body = f"""# Steliara

> Practice management software for professional astrologers. Steliara keeps
> chart calculation, a profile for every person you read for, and the
> consultation itself — recorded, transcribed and summarized — in one browser-based
> workspace.

Steliara (spelled S-T-E-L-I-A-R-A) is a subscription web application for working
astrologers, not a horoscope app for consumers. Charts are computed with the Swiss
Ephemeris using an orb table tuned with a practising astrologer.

## What makes it different

Most astrology tools are either chart calculators or client lists. Steliara also
runs the consultation as a video call inside the app, records it, transcribes it,
and writes a short summary onto the profile of the person you read for. That
removes the common arrangement of chart software plus a separate video app plus a
separate transcription service.

## Who it is for

Solo practitioners and small practices who read charts professionally. Interface
languages: English, Ukrainian, Russian. Not aimed at hobbyists wanting a one-off
free chart, and not a consumer horoscope product.

## Pricing

- Practitioner — $24/month, or $20/month billed annually.
- Studio — $39/month, or $32/month billed annually.
- Every account starts with a 14-day trial of all features. No card required.
- After a trial or subscription lapses the account becomes read-only rather than locked.
- Full details: {base}/pricing.md

## Key pages

- Home: {base}/
- Astrology practice management: {base}/astrology-practice-management
- Workspace with recorded, transcribed sessions: {base}/astrologer-workspace
- Cloud astrology software (Mac and Windows): {base}/cloud-astrology-software
- Pricing: {base}/pricing.html
- Terms and privacy: {base}/terms.html

Last updated: {_SITEMAP_LASTMOD}
"""
    return Response(content=body, media_type="text/plain; charset=utf-8", headers={"Cache-Control": "public, max-age=86400"})


@app.get("/pricing.md")
async def pricing_md():
    """Structured pricing for AI agents comparing tools on a buyer's behalf.

    Answer engines quote competitors' exact prices because those prices are easy to
    read off a page. This makes ours just as easy, without a render step.
    """
    base = _public_base_url()
    body = f"""# Pricing — Steliara

Practice management software for professional astrologers.
Currency: USD. Billed per astrologer. Prices exclude local sales tax/VAT, which is
applied at checkout.

## Trial
- Price: $0 for 14 days
- Card required: no
- Limits: none — every feature is unlocked during the trial
- After it ends: the account becomes read-only; your charts and records are kept, not deleted

## Practitioner
- Price: $24/month billed monthly | $20/month billed annually
- Includes: natal and transit charts (Swiss Ephemeris), unlimited profiles for the
  people you read for, notes and recordings, forecast timeline and tables,
  multiple house systems, email support

## Studio
- Price: $39/month billed monthly | $32/month billed annually
- Includes: everything in Practitioner, plus automatic consultation summaries,
  session recordings, and fast factual answers from the chart data during a session

## Notes
- Payments are processed by Stripe as merchant of record (Stripe Managed Payments).
- Platforms: any modern browser on macOS, Windows, or tablet. Nothing to install.
- Human-readable version: {base}/pricing.html

Last updated: {_SITEMAP_LASTMOD}
"""
    return Response(content=body, media_type="text/markdown; charset=utf-8", headers={"Cache-Control": "public, max-age=86400"})


@app.get("/google{token}.html", include_in_schema=False)
async def google_site_verification(token: str):
    """Serve Google Search Console's HTML-file verification token.

    Search Console asks you to host a file named `google<token>.html` whose body
    is `google-site-verification: google<token>.html`. Set GOOGLE_SITE_VERIFICATION
    to that full filename and this route answers it; anything else 404s.

    The path is deliberately prefixed with `google` so it cannot shadow the real
    page routes (/index.html, /login.html, ...) declared further down this module.
    Preferred alternative: verify a Domain property via a DNS TXT record, which
    needs no deploy and covers www/non-www at once.
    """
    expected = os.getenv("GOOGLE_SITE_VERIFICATION", "").strip()
    if not expected or expected != f"google{token}.html":
        raise HTTPException(status_code=404, detail="Not found")
    return Response(
        content=f"google-site-verification: {expected}",
        media_type="text/html",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@app.get("/")
async def root(request: Request):
    """Root entrypoint.

    Anonymous visitors (and crawlers/bots — e.g. payment-provider domain
    verification) get the public marketing landing page. Signed-in users get
    their workspace (client base). The cookie presence check only drives which
    page is served; real authorization is still enforced by the API.
    """
    has_session = bool(request.cookies.get("astrobot_session"))

    if has_session:
        clients_path = os.path.join(FRONTEND_PATH, "clients.html")
        if os.path.exists(clients_path):
            return FileResponse(clients_path)

    if is_solo_request(request):
        return RedirectResponse(url="/login.html?mode=register", status_code=307)

    index_path = os.path.join(FRONTEND_PATH, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)

    return {
        "message": "Astrobot API",
        "version": "1.0.0",
        "docs": "/api/docs"
    }


@app.get("/new")
async def new_chart_page():
    """Страница создания новой натальной карты"""
    index_path = os.path.join(FRONTEND_PATH, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="Form page not found")


@app.get("/login")
async def login_page_alias():
    """Alias for login page."""
    login_path = os.path.join(FRONTEND_PATH, "login.html")
    if os.path.exists(login_path):
        return FileResponse(login_path)
    raise HTTPException(status_code=404, detail="Login page not found")


@app.get("/login.html")
async def login_page():
    """Login page."""
    return await login_page_alias()


@app.get("/auth/verify")
async def auth_verify_page(token: str = "", locale: str = ""):
    """Email verification link entrypoint."""
    params = {"mode": "verify"}
    if token:
        params["token"] = token
    if locale:
        params["locale"] = locale
    target = f"/login.html?{urlencode(params)}"
    return RedirectResponse(url=target, status_code=307)


@app.get("/index.html")
async def index_page():
    """Форма ввода (альтернативный путь)"""
    return await new_chart_page()


@app.get("/account-settings")
@app.get("/account-settings.html")
async def account_settings_page():
    """Страница настроек аккаунта"""
    account_settings_path = os.path.join(FRONTEND_PATH, "account-settings.html")
    if os.path.exists(account_settings_path):
        return FileResponse(account_settings_path)
    raise HTTPException(status_code=404, detail="Account settings page not found")


@app.get("/styleguide.html")
async def styleguide_page():
    """Design-kit styleguide — internal dev reference (noindex)."""
    styleguide_path = os.path.join(FRONTEND_PATH, "styleguide.html")
    if os.path.exists(styleguide_path):
        return FileResponse(styleguide_path)
    raise HTTPException(status_code=404, detail="Styleguide page not found")


@app.get("/natal-full.html")
async def natal_full_page():
    """Страница полной натальной карты (табличный вид)"""
    natal_full_path = os.path.join(FRONTEND_PATH, "natal-full.html")
    if os.path.exists(natal_full_path):
        return FileResponse(natal_full_path)
    raise HTTPException(status_code=404, detail="Natal full page not found")


@app.get("/forecast-new")
@app.get("/forecast-new.html")
async def forecast_new_page():
    """Новая страница прогностики с концентрическими кольцами."""
    forecast_new_path = os.path.join(FRONTEND_PATH, "forecast-new.html")
    if os.path.exists(forecast_new_path):
        return FileResponse(forecast_new_path)
    raise HTTPException(status_code=404, detail="Forecast New page not found")


@app.get("/forecast-tables")
@app.get("/forecast-tables.html")
async def forecast_tables_page():
    """Страница таблиц прогностики (диапазон дат)."""
    forecast_tables_path = os.path.join(FRONTEND_PATH, "forecast-tables.html")
    if os.path.exists(forecast_tables_path):
        return FileResponse(forecast_tables_path)
    raise HTTPException(status_code=404, detail="Forecast Tables page not found")


@app.get("/forecast-timeline")
@app.get("/forecast-timeline.html")
async def forecast_timeline_page():
    """Страница таймлайна прогностики (диапазон дат)."""
    forecast_timeline_path = os.path.join(FRONTEND_PATH, "forecast-timeline.html")
    if os.path.exists(forecast_timeline_path):
        return FileResponse(forecast_timeline_path)
    raise HTTPException(status_code=404, detail="Forecast Timeline page not found")


@app.get("/calendar")
@app.get("/calendar.html")
async def calendar_page():
    """Страница календаря консультаций"""
    calendar_path = os.path.join(FRONTEND_PATH, "calendar.html")
    if os.path.exists(calendar_path):
        return FileResponse(calendar_path)
    raise HTTPException(status_code=404, detail="Calendar page not found")


@app.get("/consultation-call.html")
async def consultation_call_page():
    """Astrologer video call page."""
    page_path = os.path.join(FRONTEND_PATH, "consultation-call.html")
    if os.path.exists(page_path):
        return FileResponse(page_path)
    raise HTTPException(status_code=404, detail="Page not found")


@app.get("/call/{token}")
async def consultation_join_page(token: str):
    """Client join page — served for any /call/{token} path."""
    page_path = os.path.join(FRONTEND_PATH, "consultation-join.html")
    if os.path.exists(page_path):
        return FileResponse(page_path)
    raise HTTPException(status_code=404, detail="Page not found")


@app.get("/client/{user_id}")
async def client_profile_page(user_id: str):
    """Client profile page — served for any /client/{user_id} path."""
    page_path = os.path.join(FRONTEND_PATH, "client-profile.html")
    if os.path.exists(page_path):
        return FileResponse(page_path)
    raise HTTPException(status_code=404, detail="Page not found")


@app.get("/consultation/{session_id}")
async def consultation_detail_page(session_id: str):
    """Consultation detail page — review/edit/share the summary for a call session."""
    page_path = os.path.join(FRONTEND_PATH, "consultation.html")
    if os.path.exists(page_path):
        return FileResponse(page_path)
    raise HTTPException(status_code=404, detail="Page not found")


@app.get("/pricing.html")
async def pricing_page():
    """Public pricing page."""
    page_path = os.path.join(FRONTEND_PATH, "pricing.html")
    if os.path.exists(page_path):
        return FileResponse(page_path)
    raise HTTPException(status_code=404, detail="Pricing page not found")


@app.get("/terms.html")
async def terms_page():
    """Public legal terms, privacy, and refund page."""
    page_path = os.path.join(FRONTEND_PATH, "terms.html")
    if os.path.exists(page_path):
        return FileResponse(page_path)
    raise HTTPException(status_code=404, detail="Terms page not found")


def _serve_frontend_page(filename: str):
    page_path = os.path.join(FRONTEND_PATH, filename)
    if os.path.exists(page_path):
        return FileResponse(page_path)
    raise HTTPException(status_code=404, detail="Page not found")


@app.get("/cloud-astrology-software")
@app.get("/cloud-astrology-software.html")
async def conquest_cloud_page():
    """SEO conquest landing: cloud astrology software (desktop-switch)."""
    return _serve_frontend_page("cloud-astrology-software.html")


@app.get("/astrologer-workspace")
@app.get("/astrologer-workspace.html")
async def conquest_workspace_page():
    """SEO conquest landing: astrologer workspace with recorded sessions."""
    return _serve_frontend_page("astrologer-workspace.html")


@app.get("/astrology-practice-management")
@app.get("/astrology-practice-management.html")
async def conquest_practice_page():
    """SEO category landing: astrology practice management software."""
    return _serve_frontend_page("astrology-practice-management.html")


@app.get("/health")
async def health_check():
    """Проверка здоровья сервиса"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    uvicorn.run(
        "app.api.main:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )

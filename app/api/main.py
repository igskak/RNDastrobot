"""
FastAPI приложение для Astrobot
"""
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
import os
import sys
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

from app.api.routes import auth, natal, interpretations, chat, transits, solar, progressions, directions, ingresses, places, consultations, alerts
from app.api.error_handlers import register_error_handlers
from app.api.locale_dependency import locale_context_dependency

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
async def static_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
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
app.include_router(interpretations.router, prefix="/api/v1", tags=["Interpretations"])
app.include_router(chat.router, prefix="/api/v1", tags=["Chat"])
app.include_router(transits.router, prefix="/api/v1", tags=["Transits"])
app.include_router(solar.router, prefix="/api/v1", tags=["Solar Return"])
app.include_router(progressions.router, prefix="/api/v1", tags=["Progressions"])
app.include_router(directions.router, prefix="/api/v1", tags=["Directions"])
app.include_router(ingresses.router, prefix="/api/v1", tags=["Ingresses"])
app.include_router(places.router, prefix="/api/v1", tags=["Places"])
app.include_router(consultations.router, prefix="/api/v1", tags=["Consultations"])
app.include_router(alerts.router, prefix="/api/v1", tags=["Alerts"])

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


@app.get("/")
async def root():
    """Главная страница - база клиентов"""
    clients_path = os.path.join(FRONTEND_PATH, "clients.html")
    if os.path.exists(clients_path):
        return FileResponse(clients_path)
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


@app.get("/chart.html")
async def chart_page():
    """Страница натальной карты"""
    chart_path = os.path.join(FRONTEND_PATH, "chart.html")
    if os.path.exists(chart_path):
        return FileResponse(chart_path)
    raise HTTPException(status_code=404, detail="Chart page not found")


@app.get("/natal-full.html")
async def natal_full_page():
    """Страница полной натальной карты (табличный вид)"""
    natal_full_path = os.path.join(FRONTEND_PATH, "natal-full.html")
    if os.path.exists(natal_full_path):
        return FileResponse(natal_full_path)
    raise HTTPException(status_code=404, detail="Natal full page not found")


@app.get("/interpretations.html")
async def interpretations_page():
    """Страница интерпретаций (психологический профиль)"""
    interpretations_path = os.path.join(FRONTEND_PATH, "interpretations.html")
    if os.path.exists(interpretations_path):
        return FileResponse(interpretations_path)
    raise HTTPException(status_code=404, detail="Interpretations page not found")


@app.get("/forecast.html")
async def forecast_page():
    """Страница прогностики"""
    forecast_path = os.path.join(FRONTEND_PATH, "forecast.html")
    if os.path.exists(forecast_path):
        return FileResponse(forecast_path)
    raise HTTPException(status_code=404, detail="Forecast page not found")


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

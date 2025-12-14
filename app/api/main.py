"""
FastAPI приложение для Astrobot
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.api.routes import natal
import os
from dotenv import load_dotenv

# Загрузка переменных окружения
load_dotenv()

# Путь к frontend
FRONTEND_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")

# Создание приложения
app = FastAPI(
    title="Astrobot API",
    description="API для расчёта натальных карт и астрологического анализа",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене указать конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутеров
app.include_router(natal.router, prefix="/api/v1", tags=["Natal Charts"])

# Статические файлы (CSS, JS)
if os.path.exists(FRONTEND_PATH):
    app.mount("/css", StaticFiles(directory=os.path.join(FRONTEND_PATH, "css")), name="css")
    app.mount("/js", StaticFiles(directory=os.path.join(FRONTEND_PATH, "js")), name="js")
    if os.path.exists(os.path.join(FRONTEND_PATH, "assets")):
        app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_PATH, "assets")), name="assets")


@app.get("/")
async def root():
    """Главная страница - форма ввода данных"""
    index_path = os.path.join(FRONTEND_PATH, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {
        "message": "Astrobot API",
        "version": "1.0.0",
        "docs": "/api/docs"
    }


@app.get("/index.html")
async def index_page():
    """Главная страница (альтернативный путь)"""
    return await root()


@app.get("/chart.html")
async def chart_page():
    """Страница натальной карты"""
    chart_path = os.path.join(FRONTEND_PATH, "chart.html")
    if os.path.exists(chart_path):
        return FileResponse(chart_path)
    raise HTTPException(status_code=404, detail="Chart page not found")


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


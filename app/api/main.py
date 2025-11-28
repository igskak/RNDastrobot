"""
FastAPI приложение для Astrobot
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import natal
import os
from dotenv import load_dotenv

# Загрузка переменных окружения
load_dotenv()

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


@app.get("/")
async def root():
    """Корневой эндпоинт"""
    return {
        "message": "Astrobot API",
        "version": "1.0.0",
        "docs": "/api/docs"
    }


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


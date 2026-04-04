#!/bin/bash

# ============================================================================
# Скрипт для запуску Astrobot API
# ============================================================================

# Кольори для виводу
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Запуск Astrobot API...${NC}"

# Визначити корінь проекту (swisseph/)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Спробувати знайти віртуальне середовище
if [ -d "$PROJECT_ROOT/.venv" ]; then
    VENV_PATH="$PROJECT_ROOT/.venv"
elif [ -d "$PROJECT_ROOT/app/venv" ]; then
    VENV_PATH="$PROJECT_ROOT/app/venv"
else
    VENV_PATH="$PROJECT_ROOT/.venv"
fi

echo -e "${YELLOW}📁 Корінь проекту: $PROJECT_ROOT${NC}"
echo -e "${YELLOW}🐍 Віртуальне середовище: $VENV_PATH${NC}"

# Перевірити, чи існує віртуальне середовище
if [ ! -d "$VENV_PATH" ]; then
    echo -e "${RED}❌ Віртуальне середовище не знайдено: $VENV_PATH${NC}"
    echo -e "${YELLOW}Створюю віртуальне середовище...${NC}"
    python3 -m venv "$VENV_PATH"
fi

# Активувати віртуальне середовище
echo -e "${YELLOW}🔧 Активація віртуального середовища...${NC}"
source "$VENV_PATH/bin/activate"

# Перевірити, чи встановлені ключові залежності (включно з AI/transcription)
if ! python -c "import fastapi, jwt, bcrypt, openai, assemblyai; import livekit.api; from argon2 import PasswordHasher" 2>/dev/null; then
    echo -e "${YELLOW}📦 Встановлення залежностей...${NC}"
    pip install -r "$PROJECT_ROOT/app/requirements.txt"
fi

# Встановити PYTHONPATH на корінь проекту
export PYTHONPATH="$PROJECT_ROOT:$PYTHONPATH"

# Запустити API через uvicorn
echo -e "${GREEN}✅ Запуск API сервера через uvicorn...${NC}"
echo -e "${GREEN}📖 Документація буде доступна на:${NC}"
echo -e "${GREEN}   - Swagger UI: http://localhost:8000/api/docs${NC}"
echo -e "${GREEN}   - ReDoc: http://localhost:8000/api/redoc${NC}"
echo -e "${GREEN}   - Health check: http://localhost:8000/health${NC}"
echo ""

cd "$PROJECT_ROOT"
uvicorn app.api.main:app --reload --host 0.0.0.0 --port 8000

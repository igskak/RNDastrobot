# Server Start Instructions Update

**Date:** 2026-01-20  
**Issue:** Inconsistent server startup instructions across documentation files

## Problem

Multiple documentation files contained outdated or incomplete server startup instructions that didn't include the dependency installation step, causing repeated failures.

## Files Updated

### 1. ✅ README.md (Root)
**Location:** `/README.md`  
**Changes:**
- Added "Running API Server" section with correct 2-step process
- Added important notes about ChatKit token management
- Clearly separated API server instructions from CLI tools

**New instructions:**
```bash
# 1. Install dependencies (first time only)
source .venv/bin/activate && pip install -r app/requirements.txt

# 2. Start the API server
bash app/start_api.sh
```

### 2. ✅ app/API_README.md
**Location:** `/app/API_README.md`  
**Changes:**
- Updated "Быстрый старт" section
- Removed outdated `python -m app.api.main` command
- Added correct dependency installation step

### 3. ✅ app/QUICK_START_API.md
**Location:** `/app/QUICK_START_API.md`  
**Changes:**
- Added dependency installation as step 1
- Updated path to run from project root
- Kept alternative methods for reference

### 4. ✅ docs/PROSERPINA.md
**Location:** `/docs/PROSERPINA.md`  
**Changes:**
- Updated "Тест через HTTP API" section
- Added dependency installation before server start

### 5. ✅ app/QUICK_START_3.3.md
**Location:** `/app/QUICK_START_3.3.md`  
**Changes:**
- Updated "Тестовий розрахунок" section (line 57-63)
- Updated "API не повертає нові поля" troubleshooting (line 162-167)

### 6. ✅ app/SETUP_GUIDE_3.3.md
**Location:** `/app/SETUP_GUIDE_3.3.md`  
**Changes:**
- Updated "Розрахунок натальної карти через API" section (line 113-119)

## Standard Server Start Procedure

All documentation now follows this consistent pattern:

```bash
# Step 1: Install dependencies (first time only)
source .venv/bin/activate && pip install -r app/requirements.txt

# Step 2: Start server
bash app/start_api.sh
```

## Key Points

1. **Always run from project root** (`/Users/ihorskakovskyi/RNDastro/swisseph`)
2. **Install dependencies first** (prevents `ModuleNotFoundError: No module named 'openai'`)
3. **Use `app/start_api.sh`** (handles venv activation and PYTHONPATH automatically)

## Verification

All 6 documentation files now have consistent, correct instructions that include:
- ✅ Dependency installation step
- ✅ Correct working directory (project root)
- ✅ Use of `app/start_api.sh` script

## Impact

This update prevents the recurring issue where the server fails to start due to missing dependencies (specifically the `openai` module).


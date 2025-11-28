#!/bin/bash
# ============================================================================
# Astrobot Database Quick Start Script
# ============================================================================
# This script automates the database setup process
# ============================================================================

set -e  # Exit on error

echo "============================================================================"
echo "🌟 Astrobot Database Quick Start"
echo "============================================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found${NC}"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo -e "${RED}❗ Please edit .env file with your Supabase credentials before continuing${NC}"
    echo ""
    echo "Required information:"
    echo "  - DB_HOST (from Supabase Settings → Database)"
    echo "  - DB_PASSWORD (your Supabase database password)"
    echo "  - SUPABASE_URL (your project URL)"
    echo "  - SUPABASE_ANON_KEY (from Supabase Settings → API)"
    echo ""
    exit 1
fi

echo "✓ Found .env file"
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
    echo -e "${GREEN}✓ Virtual environment created${NC}"
else
    echo "✓ Virtual environment exists"
fi
echo ""

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate
echo -e "${GREEN}✓ Virtual environment activated${NC}"
echo ""

# Install dependencies
echo "Installing Python dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements.txt
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Run database setup
echo "============================================================================"
echo "Setting up database schema..."
echo "============================================================================"
echo ""
python database/setup_database.py

if [ $? -eq 0 ]; then
    echo ""
    echo "============================================================================"
    echo -e "${GREEN}✅ Database setup completed successfully!${NC}"
    echo "============================================================================"
    echo ""
    echo "Next steps:"
    echo "  1. Populate reference data:"
    echo "     cd database/seeds"
    echo "     Execute each .sql file in Supabase SQL Editor"
    echo ""
    echo "  2. Verify installation:"
    echo "     psql \"\$DATABASE_URL\" -f database/verification_queries.sql"
    echo ""
    echo "  3. Start building your application!"
    echo ""
else
    echo ""
    echo "============================================================================"
    echo -e "${RED}❌ Database setup failed${NC}"
    echo "============================================================================"
    echo ""
    echo "Please check:"
    echo "  1. Your .env file has correct Supabase credentials"
    echo "  2. Your Supabase project is active (not paused)"
    echo "  3. You have internet connection"
    echo ""
    exit 1
fi


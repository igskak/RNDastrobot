#!/bin/bash
# ============================================================================
# Script to apply orbs update from Alyona's table
# ============================================================================

set -e  # Exit on error

echo "=========================================="
echo "Applying Orbs Update from Alyona's Table"
echo "=========================================="
echo ""

# Load .env file
if [ -f .env ]; then
    echo "Loading environment variables from .env..."
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if database is running
echo "Checking database connection..."
python3 -c "
import sys
sys.path.insert(0, '$(pwd)')
from sqlalchemy import create_engine
import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

db_url = os.getenv('DATABASE_URL')
if not db_url:
    print('❌ DATABASE_URL not found in environment')
    sys.exit(1)

print(f'Using database: {db_url.split(\"@\")[1] if \"@\" in db_url else \"unknown\"}')

try:
    engine = create_engine(db_url)
    with engine.connect() as conn:
        print('✅ Database connection successful')
except Exception as e:
    print(f'❌ Database connection failed: {e}')
    sys.exit(1)
"

if [ $? -ne 0 ]; then
    echo ""
    echo "Please check your DATABASE_URL in .env file"
    exit 1
fi

echo ""
echo "Applying migration..."
python3 -c "
import sys
sys.path.insert(0, '$(pwd)')

from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

db_url = os.getenv('DATABASE_URL')
engine = create_engine(db_url)

# Read SQL file
with open('app/database/migrations/update_orbs_from_alyona.sql', 'r') as f:
    sql_content = f.read()

# Execute migration
with engine.connect() as conn:
    statements = [s.strip() for s in sql_content.split(';') if s.strip() and not s.strip().upper() in ['BEGIN', 'COMMIT']]
    
    trans = conn.begin()
    try:
        for stmt in statements:
            if stmt.strip():
                result = conn.execute(text(stmt))
                if stmt.strip().upper().startswith('SELECT'):
                    rows = result.fetchall()
                    for row in rows:
                        print(row)
        trans.commit()
        print('')
        print('✅ Migration completed successfully!')
    except Exception as e:
        trans.rollback()
        print(f'❌ Error: {e}')
        raise
"

echo ""
echo "=========================================="
echo "Orbs update completed!"
echo "=========================================="
echo ""
echo "Summary of changes:"
echo "  - Septener planets (Mercury-Saturn): Sextile/Square/Trine 8° → 5°"
echo "  - Fictitious points (Nodes, BlackMoon, WhiteMoon): all major aspects → 3°"
echo ""
echo "⚠️  Note: Existing aspects were calculated with old orbs."
echo "    Consider recalculating aspects for existing users."
echo ""


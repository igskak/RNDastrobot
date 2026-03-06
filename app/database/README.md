# Astrobot Database Setup Guide

Complete guide for setting up the PostgreSQL database for the Astrobot astrology application on Supabase.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Supabase Project Setup](#supabase-project-setup)
3. [Database Configuration](#database-configuration)
4. [Schema Installation](#schema-installation)
5. [Verification](#verification)
6. [Python Setup](#python-setup)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Supabase account (free tier is sufficient for development)
- Python 3.9 or higher
- Git (for version control)

---

## Supabase Project Setup

### Step 1: Create a New Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Click **"New Project"**
3. Fill in the project details:
   - **Name**: `astrobot`
   - **Database Password**: `Skak26062022` (or your chosen password)
   - **Region**: Choose closest to your location (e.g., `eu-central-1`)
   - **Pricing Plan**: Free (or your preferred plan)
4. Click **"Create new project"**
5. Wait for the project to be provisioned (2-3 minutes)

### Step 2: Get Connection Details

Once your project is ready:

1. Go to **Settings** → **Database**
2. Note down the following information:
   - **Host**: `db.xxxxxxxxxxxxx.supabase.co`
   - **Database name**: `postgres`
   - **Port**: `5432`
   - **User**: `postgres`
   - **Password**: (the one you set during creation)

3. Also note the **Connection String** under "Connection string" section

---

## Database Configuration

### Step 1: Create Environment File

1. Navigate to the `app` directory:
   ```bash
   cd app
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and fill in your Supabase details:
   ```bash
   # Database Configuration
   DATABASE_URL=postgresql://postgres:Skak26062022@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
   DB_HOST=db.xxxxxxxxxxxxx.supabase.co
   DB_PORT=5432
   DB_NAME=postgres
   DB_USER=postgres
   DB_PASSWORD=Skak26062022
   
   # Supabase Configuration
   SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_KEY=your_service_key_here
   ```

**Important Notes:**
- Replace `xxxxxxxxxxxxx` with your actual Supabase project reference
- Get API keys from **Settings** → **API** in Supabase dashboard
- **NEVER** commit the `.env` file to version control!

---

## Schema Installation

### Option 1: Using Python Setup Script (Recommended)

1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the setup script:
   ```bash
   python database/setup_database.py
   ```

   This will:
   - Test database connection
   - Execute all schema files in order
   - Verify the installation
   - Display a summary of created tables

### Option 2: Using Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Execute each schema file in order:
   - `01_core_tables.sql`
   - `02_special_points.sql`
   - `03_reference_tables.sql`
   - `04_karma_reference_tables.sql`
   - `05_balance_tables.sql`
   - `06_analysis_tables.sql`
   - `07_topic_tables.sql`
   - `08_karma_tables.sql`
   - `09_support_challenge_tables.sql`

### Option 3: Using psql Command Line

```bash
# Navigate to schema directory
cd database/schema

# Execute each file
psql "postgresql://postgres:Skak26062022@db.xxxxxxxxxxxxx.supabase.co:5432/postgres" \
  -f 01_core_tables.sql \
  -f 02_special_points.sql \
  -f 03_reference_tables.sql \
  -f 04_karma_reference_tables.sql \
  -f 05_balance_tables.sql \
  -f 06_analysis_tables.sql \
  -f 07_topic_tables.sql \
  -f 08_karma_tables.sql \
  -f 09_support_challenge_tables.sql
```

---

## Verification

### Check Tables Created

Run this SQL query in Supabase SQL Editor or using Python:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

You should see approximately **45+ tables** including:
- Core tables (users, natal_planets, natal_houses, etc.)
- Reference tables (ref_sign_properties, ref_house_meanings, etc.)
- Analysis tables (general_overview_summary, user_psych_summary, etc.)
- Balance tables (user_element_balance, user_mode_balance, etc.)

### Test Database Connection with Python

Create a test file `test_connection.py`:

```python
from database import DatabaseManager

# Test connection
engine = DatabaseManager.get_engine()
print("✓ Database connection successful!")

# Test query
session = DatabaseManager.get_session()
result = session.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
count = result.scalar()
print(f"✓ Found {count} tables in database")
session.close()
```

Run it:
```bash
python test_connection.py
```

---

## Python Setup

### Install Dependencies

```bash
# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Basic Usage Example

```python
from database import DatabaseManager, get_db
from datetime import datetime, time

# Get a database session
session = DatabaseManager.get_session()

# Example: Create a user
from sqlalchemy import text

query = text("""
    INSERT INTO users (birth_date, birth_time, timezone, birth_place, lat, lon)
    VALUES (:birth_date, :birth_time, :timezone, :birth_place, :lat, :lon)
    RETURNING user_id
""")

result = session.execute(query, {
    'birth_date': datetime(1990, 3, 15).date(),
    'birth_time': time(14, 30),
    'timezone': 'America/New_York',
    'birth_place': 'New York, NY, USA',
    'lat': 40.7128,
    'lon': -74.0060
})

user_id = result.scalar()
session.commit()
print(f"Created user with ID: {user_id}")

session.close()
```

---

## Troubleshooting

### Connection Issues

**Problem**: Cannot connect to database

**Solutions**:
1. Verify your Supabase project is active (not paused)
2. Check that your IP is allowed (Supabase allows all IPs by default)
3. Verify credentials in `.env` file
4. Test connection using Supabase dashboard SQL Editor

### Schema Errors

**Problem**: Tables already exist

**Solution**: Drop existing tables first:
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

Then re-run the schema installation.

### Permission Issues

**Problem**: Permission denied errors

**Solution**: Ensure you're using the `postgres` user or a user with sufficient privileges.

---

## Next Steps

1. ✅ Database schema is set up
2. 📝 Populate reference tables with astrological data (see `seeds/` directory)
3. 🔧 Build the astrology calculation engine
4. 🌐 Create API endpoints for chart calculation
5. 🧪 Write tests for database operations

---

## Database Schema Overview

The database consists of 9 main categories:

1. **Core Tables**: Users, planets, houses, angles, aspects
2. **Special Points**: Nodes, Lilith, Selena, Fortune, etc.
3. **Reference Tables**: Sign properties, house meanings, aspect types
4. **Karma References**: Node karma, Saturn, Lilith/Selena interpretations
5. **Balance Tables**: Element, mode, hemisphere distributions
6. **Analysis Tables**: General overview, psychological profiles
7. **Topic Tables**: Health, career, relationships, family, spirituality
8. **Karma Tables**: Karmic analysis and planet status
9. **Support/Challenge**: Strengths and growth areas

Total: **45+ tables** with full JSONB support for flexible data storage.

---

## Local Geocoding Cities (geo_cities)

Для внутреннего автокомплита мест добавлена таблица `geo_cities`.

1. Примените миграцию:
```bash
python3 app/apply_migration.py app/database/migrations/019_add_geo_cities.sql
```

2. Подготовьте файлы GeoNames:
- `cities5000.txt` (или `cities15000.txt`)
- `countryInfo.txt`
- `admin1CodesASCII.txt`
- `admin2Codes.txt`

3. Импортируйте данные:
```bash
python3 app/database/import_geo_cities.py \
  --cities-file /path/to/cities5000.txt \
  --country-info-file /path/to/countryInfo.txt \
  --admin1-file /path/to/admin1CodesASCII.txt \
  --admin2-file /path/to/admin2Codes.txt
```

После этого API `GET /api/v1/places/autocomplete` будет использовать локальную базу как primary source.

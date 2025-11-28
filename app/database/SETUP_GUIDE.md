# Complete PostgreSQL Setup Guide for Astrobot on Supabase

This is your step-by-step guide to set up the complete database infrastructure for the Astrobot astrology application.

---

## 📋 Quick Start Checklist

- [ ] Create Supabase project
- [ ] Configure environment variables
- [ ] Install Python dependencies
- [ ] Run database schema setup
- [ ] Populate reference data
- [ ] Verify installation
- [ ] Test database connection

---

## 🚀 Step-by-Step Setup

### Step 1: Create Supabase Project

1. **Go to Supabase Dashboard**
   - Visit: https://app.supabase.com/
   - Sign in or create an account

2. **Create New Project**
   - Click "New Project"
   - **Organization**: Select or create one
   - **Name**: `astrobot`
   - **Database Password**: `Skak26062022`
   - **Region**: `eu-central-1` (or closest to you)
   - **Pricing Plan**: Free (sufficient for development)
   - Click "Create new project"

3. **Wait for Provisioning**
   - This takes 2-3 minutes
   - You'll see a progress indicator

4. **Get Connection Details**
   - Once ready, go to **Settings** → **Database**
   - Copy the following:
     - **Host**: `db.xxxxxxxxxxxxx.supabase.co`
     - **Database**: `postgres`
     - **Port**: `5432`
     - **User**: `postgres`
     - **Password**: (the one you set)

5. **Get API Keys**
   - Go to **Settings** → **API**
   - Copy:
     - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
     - **anon public key**
     - **service_role key** (keep this secret!)

---

### Step 2: Configure Environment

1. **Navigate to app directory**
   ```bash
   cd /Users/ihorskakovskyi/RNDastro/swisseph/app
   ```

2. **Create .env file**
   ```bash
   cp .env.example .env
   ```

3. **Edit .env file**
   ```bash
   nano .env  # or use your preferred editor
   ```

4. **Fill in your Supabase details**
   ```env
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
   
   # Application Configuration
   APP_ENV=development
   DEBUG=True
   SECRET_KEY=your-secret-key-here-change-in-production
   
   # Swiss Ephemeris Configuration
   EPHEMERIS_PATH=../swisseph/ephe
   
   # Logging
   LOG_LEVEL=INFO
   LOG_FILE=logs/astrobot.log
   ```

   **Important**: Replace `xxxxxxxxxxxxx` with your actual Supabase project reference!

---

### Step 3: Install Python Dependencies

1. **Create virtual environment** (recommended)
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On macOS/Linux
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

   This installs:
   - PostgreSQL driver (psycopg2)
   - SQLAlchemy ORM
   - FastAPI framework
   - Supabase client
   - Other utilities

---

### Step 4: Run Database Schema Setup

**Option A: Using Python Script (Recommended)**

```bash
python database/setup_database.py
```

This will:
- ✓ Test database connection
- ✓ Execute all 9 schema files in order
- ✓ Create 45+ tables
- ✓ Set up indexes and constraints
- ✓ Create views and functions
- ✓ Verify installation

**Option B: Using Supabase SQL Editor**

1. Go to your Supabase project
2. Click **SQL Editor**
3. Create a new query
4. Copy and paste each schema file content in order:
   - `schema/01_core_tables.sql`
   - `schema/02_special_points.sql`
   - `schema/03_reference_tables.sql`
   - `schema/04_karma_reference_tables.sql`
   - `schema/05_balance_tables.sql`
   - `schema/06_analysis_tables.sql`
   - `schema/07_topic_tables.sql`
   - `schema/08_karma_tables.sql`
   - `schema/09_support_challenge_tables.sql`
5. Run each query

---

### Step 5: Populate Reference Data

1. **Run seed scripts**
   ```bash
   # Navigate to seeds directory
   cd database/seeds
   
   # Execute each seed file
   psql "$DATABASE_URL" -f 01_sign_properties.sql
   psql "$DATABASE_URL" -f 02_aspect_types.sql
   psql "$DATABASE_URL" -f 03_house_meanings.sql
   psql "$DATABASE_URL" -f 04_chakra_mapping.sql
   ```

   Or use Supabase SQL Editor to run each seed file.

2. **Verify seed data**
   ```sql
   SELECT COUNT(*) FROM ref_sign_properties;      -- Should be 12
   SELECT COUNT(*) FROM ref_aspect_types;         -- Should be 13
   SELECT COUNT(*) FROM ref_house_meanings;       -- Should be 12
   SELECT COUNT(*) FROM ref_chakra_mapping;       -- Should be 7
   ```

---

### Step 6: Verify Installation

1. **Check tables created**
   ```sql
   SELECT COUNT(*) 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_type = 'BASE TABLE';
   ```
   Expected: **45+ tables**

2. **List all tables**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```

3. **Test Python connection**
   ```python
   from database import DatabaseManager
   
   engine = DatabaseManager.get_engine()
   print("✓ Connection successful!")
   ```

---

## 🧪 Testing Your Setup

Create a test file `test_db.py`:

```python
from database import DatabaseManager
from sqlalchemy import text
from datetime import datetime, time

# Test connection
session = DatabaseManager.get_session()

# Insert test user
query = text("""
    INSERT INTO users (birth_date, birth_time, timezone, birth_place, lat, lon)
    VALUES (:birth_date, :birth_time, :timezone, :birth_place, :lat, :lon)
    RETURNING user_id, birth_place
""")

result = session.execute(query, {
    'birth_date': datetime(1990, 3, 15).date(),
    'birth_time': time(14, 30),
    'timezone': 'America/New_York',
    'birth_place': 'New York, NY, USA',
    'lat': 40.7128,
    'lon': -74.0060
})

user = result.fetchone()
session.commit()

print(f"✓ Created test user: {user.user_id}")
print(f"✓ Birth place: {user.birth_place}")

# Clean up
session.execute(text("DELETE FROM users WHERE user_id = :id"), {'id': user.user_id})
session.commit()
session.close()

print("✓ All tests passed!")
```

Run it:
```bash
python test_db.py
```

---

## 📊 Database Structure Overview

Your database now has:

### Core Tables (8)
- `users` - User birth data
- `natal_planets` - Planet positions
- `natal_houses` - House cusps
- `angles` - ASC, MC, IC, DSC
- `natal_aspects` - Aspects between planets
- `natal_configurations` - Aspect patterns
- `natal_stelliums` - Planet clusters
- `natal_special_points` - Nodes, Lilith, etc.

### Reference Tables (20+)
- Sign properties, house meanings
- Aspect types, cosmogram patterns
- Psychological interpretations
- Karmic interpretations
- Topic significators

### Analysis Tables (17+)
- Balance tables (elements, modes, etc.)
- Summary tables (general, psychological, karmic)
- Topic-specific analyses
- Support and challenge factors

**Total: 45+ tables** ready for your astrology application!

---

## 🔧 Troubleshooting

See the main [README.md](README.md) for detailed troubleshooting steps.

---

## ✅ Setup Complete!

You now have:
- ✅ Supabase PostgreSQL database
- ✅ Complete schema (45+ tables)
- ✅ Reference data populated
- ✅ Python connection configured
- ✅ Ready for development

**Next Steps:**
1. Build the natal chart calculation engine
2. Create API endpoints
3. Implement analysis algorithms
4. Add more reference data interpretations


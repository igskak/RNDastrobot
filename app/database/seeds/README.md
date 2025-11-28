# Database Seed Data

This directory contains SQL scripts to populate reference tables with initial astrological data.

## Seed Files

1. **01_sign_properties.sql** - Zodiac sign properties (element, mode, gender, rulers, etc.)
2. **02_aspect_types.sql** - Astrological aspects (conjunction, trine, square, etc.)
3. **03_house_meanings.sql** - House interpretations and themes
4. **04_chakra_mapping.sql** - Planet-to-chakra associations

## How to Use

### Option 1: Using Python Script

```bash
cd app
python database/seed_database.py
```

### Option 2: Using Supabase SQL Editor

1. Go to your Supabase project
2. Navigate to SQL Editor
3. Execute each seed file in order (01, 02, 03, 04...)

### Option 3: Using psql

```bash
cd app/database/seeds

psql "postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres" \
  -f 01_sign_properties.sql \
  -f 02_aspect_types.sql \
  -f 03_house_meanings.sql \
  -f 04_chakra_mapping.sql
```

## What's Included

### Sign Properties (12 records)
- All 12 zodiac signs
- Element, mode, gender classifications
- Planetary rulers and dignities
- Life quadrant associations

### Aspect Types (13 records)
- Major aspects (conjunction, opposition, trine, square, sextile)
- Minor aspects (semisextile, quintile, quincunx, etc.)
- Orbs and harmonic classifications

### House Meanings (12 records)
- All 12 houses
- Keywords and themes
- Extended descriptions
- Life area associations

### Chakra Mapping (7 records)
- 7 main chakras
- Associated planets
- Psychological functions

## Additional Reference Data Needed

The following reference tables still need to be populated with your specific astrological interpretations:

### High Priority
- `ref_planet_psych_functions` - Psychological functions of planets
- `ref_planet_in_sign_psych` - Planet in sign interpretations (120 combinations)
- `ref_planet_in_house_psych` - Planet in house interpretations (120 combinations)
- `ref_cosmogram_patterns` - Jones patterns (Bowl, Bucket, etc.)

### Medium Priority
- `ref_node_karma` - North/South Node interpretations by sign and house
- `ref_saturn_karma` - Saturn lessons by sign and house
- `ref_lilith_karma` - Black Moon interpretations
- `ref_selena_karma` - White Moon interpretations

### Lower Priority
- `ref_aspect_psych` - Psychological interpretations of aspects
- `ref_configuration_types` - Aspect pattern definitions
- `ref_topic_significators` - Topic-specific significators
- `ref_support_sources` - Support factor definitions
- `ref_challenge_sources` - Challenge factor definitions

## Creating Custom Seed Data

To add your own interpretations, create new SQL files following this pattern:

```sql
-- ============================================================================
-- Reference Data: Your Table Name
-- ============================================================================

INSERT INTO your_table_name (column1, column2, ...) VALUES
('value1', 'value2', ...),
('value1', 'value2', ...)
ON CONFLICT (primary_key) DO NOTHING;

-- Verify insertion
SELECT 'Inserted ' || COUNT(*) || ' records' as status FROM your_table_name;
```

## Notes

- All seed files use `ON CONFLICT DO NOTHING` to prevent duplicate insertions
- You can safely re-run seed files without creating duplicates
- JSONB columns are used for flexible data storage
- Text fields support full astrological interpretations

## Next Steps

1. ✅ Run basic seed files (signs, aspects, houses, chakras)
2. 📝 Create interpretations for planet psychology tables
3. 📝 Add karmic interpretation data
4. 🧪 Test data integrity with sample queries
5. 🔄 Set up data versioning for interpretation updates


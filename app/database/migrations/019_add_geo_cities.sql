-- Migration 019: Local geo cities catalog for internal geocoding

CREATE TABLE IF NOT EXISTS geo_cities (
    city_id SERIAL PRIMARY KEY,
    geoname_id INTEGER NOT NULL UNIQUE,

    name VARCHAR(200) NOT NULL,
    ascii_name VARCHAR(200),
    alternate_names TEXT,

    country_code VARCHAR(2) NOT NULL,
    country_name VARCHAR(120) NOT NULL,
    admin1_code VARCHAR(40),
    admin1_name VARCHAR(120),
    admin2_code VARCHAR(80),
    admin2_name VARCHAR(120),

    latitude NUMERIC(9, 6) NOT NULL,
    longitude NUMERIC(9, 6) NOT NULL,
    population INTEGER NOT NULL DEFAULT 0,
    timezone VARCHAR(64),

    feature_class VARCHAR(1) NOT NULL DEFAULT 'P',
    feature_code VARCHAR(16) NOT NULL DEFAULT 'PPL',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_geo_city_latitude CHECK (latitude >= -90 AND latitude <= 90),
    CONSTRAINT valid_geo_city_longitude CHECK (longitude >= -180 AND longitude <= 180)
);

CREATE INDEX IF NOT EXISTS idx_geo_cities_name ON geo_cities(name);
CREATE INDEX IF NOT EXISTS idx_geo_cities_ascii_name ON geo_cities(ascii_name);
CREATE INDEX IF NOT EXISTS idx_geo_cities_country ON geo_cities(country_code);
CREATE INDEX IF NOT EXISTS idx_geo_cities_population ON geo_cities(population);
CREATE INDEX IF NOT EXISTS idx_geo_cities_name_lower ON geo_cities((LOWER(name)));
CREATE INDEX IF NOT EXISTS idx_geo_cities_ascii_name_lower ON geo_cities((LOWER(COALESCE(ascii_name, ''))));

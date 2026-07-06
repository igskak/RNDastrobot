#!/usr/bin/env bash
# Build script for Render deployment

set -o errexit  # Exit on error

echo "🔨 Starting build process..."

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install --upgrade pip
pip install -r app/requirements.txt

# Apply any pending database migrations before serving the new code, so schema
# and code can't drift (this is why the assistant feedback UI silently broke:
# model shipped the `feedback` column but migration 050 was never applied).
# Only migrations absent from the schema_migrations tracker run; the tracker was
# baselined to the live DB, so pre-tracker historical migrations aren't replayed.
# errexit above means a failed migration aborts the deploy instead of drifting.
echo "🗄️  Applying pending database migrations..."
PYTHONPATH="$(pwd)" python -m app.database.apply_migration --all

# Install frontend build dependencies and regenerate versioned bundles/HTML markers
echo "🧰 Installing frontend dependencies..."
npm --prefix app ci
echo "🎨 Building frontend bundles..."
npm --prefix app run build:frontend

# Build Swiss Ephemeris library
echo "🌟 Building Swiss Ephemeris library..."
cd swisseph
make clean
make libswe.a
cd ..

# Build natal chart applications
echo "📊 Building natal chart applications..."
cd app
make clean
make all
cd ..

# Create logs directory
echo "📁 Creating logs directory..."
mkdir -p /tmp/logs

# Verify ephemeris files exist
echo "✅ Verifying ephemeris files..."
if [ ! -d "swisseph/ephe" ]; then
    echo "❌ Error: Ephemeris files not found!"
    exit 1
fi
if [ ! -f "swisseph/ephe/seas_18.se1" ]; then
    echo "❌ Error: Required SwissEph file swisseph/ephe/seas_18.se1 not found!"
    exit 1
fi

echo "✅ Build completed successfully!"

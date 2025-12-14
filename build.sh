#!/usr/bin/env bash
# Build script for Render deployment

set -o errexit  # Exit on error

echo "🔨 Starting build process..."

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install --upgrade pip
pip install -r app/requirements.txt

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

echo "✅ Build completed successfully!"


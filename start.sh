#!/usr/bin/env bash
# Start script for Render deployment

set -o errexit  # Exit on error

echo "🚀 Starting Astrobot API..."

# Set PYTHONPATH to project root
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Get port from environment (Render sets this)
PORT="${PORT:-10000}"

echo "📍 PYTHONPATH: $PYTHONPATH"
echo "🌐 PORT: $PORT"
echo "🗂️  Working directory: $(pwd)"

# Start the application with gunicorn
echo "✅ Starting gunicorn server..."
exec gunicorn app.api.main:app \
    --workers 2 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind "0.0.0.0:${PORT}" \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --log-level info


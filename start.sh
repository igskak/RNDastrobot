#!/usr/bin/env bash
# Start script for Render deployment

set -o errexit  # Exit on error

echo "🚀 Starting Astrobot API..."

# Set PYTHONPATH to project root
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Get port from environment (Render sets this)
PORT="${PORT:-10000}"
WEB_CONCURRENCY="${WEB_CONCURRENCY:-2}"
MAX_REQUESTS="${MAX_REQUESTS:-1000}"
MAX_REQUESTS_JITTER="${MAX_REQUESTS_JITTER:-50}"

echo "📍 PYTHONPATH: $PYTHONPATH"
echo "🌐 PORT: $PORT"
echo "👷 WEB_CONCURRENCY: $WEB_CONCURRENCY"
echo "🗂️  Working directory: $(pwd)"

# Start the application with gunicorn
echo "✅ Starting gunicorn server..."
exec gunicorn app.api.main:app \
    --workers "${WEB_CONCURRENCY}" \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind "0.0.0.0:${PORT}" \
    --timeout 120 \
    --max-requests "${MAX_REQUESTS}" \
    --max-requests-jitter "${MAX_REQUESTS_JITTER}" \
    --access-logfile /dev/null \
    --error-logfile - \
    --log-level warning

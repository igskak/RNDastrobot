#!/usr/bin/env bash
# Starts (or restarts) the local app that the SEO content agent audits its pages against.
#
# A script rather than an inline command because the agent runs under explicit permission
# rules that match command text, and the inline form — leading VAR=... assignments, a
# redirect to /tmp, a trailing & — matches none of them: only a handful of known-safe
# variables are stripped before matching, and a redirect outside the working directory
# needs its own approval. One exact rule for this file is narrower and actually works.
#
# The workflow calls it once before the agent starts; the agent calls it again after it
# changes app/api/main.py, or seo_audit.py would check the old routes.
set -euo pipefail

PORT=8099
LOG="${RUNNER_TEMP:-/tmp}/seo-agent-api.log"

pkill -f "uvicorn app.api.main" 2>/dev/null || true

DATABASE_URL="${SEO_AGENT_DATABASE_URL:-sqlite+pysqlite:///./_seo_agent.db}" \
FRONTEND_BASE_URL="http://127.0.0.1:${PORT}" \
  nohup python -m uvicorn app.api.main:app --host 127.0.0.1 --port "$PORT" \
  --log-level warning > "$LOG" 2>&1 &

for _ in $(seq 1 40); do
  sleep 1
  if curl -sf -o /dev/null "http://127.0.0.1:${PORT}/robots.txt"; then
    echo "App is up on http://127.0.0.1:${PORT}"
    exit 0
  fi
done

echo "App did not come up on port ${PORT}. Last lines of its log:"
tail -40 "$LOG" || true
exit 1

#!/usr/bin/env bash
# Controlled production update. Runs ON the VM from /opt/after-sunday.
# Order: tag the current commit -> pull main -> build -> migrate -> restart
# -> health check. Never runs destructive git or database commands.
set -euo pipefail

cd /opt/after-sunday

ENV_FILE=/opt/after-sunday/.env.production
COMPOSE_FILE=/opt/after-sunday/docker-compose.production.yml
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
HEALTH_URL="${APP_HEALTH_URL:-https://app.example.com/api/health}"

echo "Tagging the current deployed commit..."
git tag "production-$(date -u +%Y%m%dT%H%M%SZ)"
git push origin --tags

echo "Fetching latest main..."
git fetch origin main
git checkout main
git pull --ff-only origin main

echo "Building images..."
"${COMPOSE[@]}" build

echo "Applying migrations before starting traffic..."
"${COMPOSE[@]}" run --rm api alembic upgrade head

echo "Restarting the stack..."
"${COMPOSE[@]}" up -d

echo "Waiting for health..."
for i in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo "Update complete: $HEALTH_URL is healthy."
    exit 0
  fi
  sleep 2
done

echo "Health check did not pass within 60s: $HEALTH_URL" >&2
exit 1

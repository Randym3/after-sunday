#!/usr/bin/env bash
# Application-only rollback to a previous known-good git tag. Runs ON the VM
# from /opt/after-sunday:
#   deploy/scripts/rollback-production.sh production-20260821T120000Z
#
# Rebuilds and restarts the containers WITHOUT downgrading Alembic (database
# downgrades need a separate, manually reviewed recovery procedure).
set -euo pipefail

TAG="${1:?Usage: rollback-production.sh <git-tag>}"

cd /opt/after-sunday

ENV_FILE=/opt/after-sunday/.env.production
COMPOSE_FILE=/opt/after-sunday/docker-compose.production.yml
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
HEALTH_URL="${APP_HEALTH_URL:-https://app.example.com/api/health}"

echo "Fetching tags..."
git fetch --tags origin
git tag -l "$TAG" | grep -q "^$TAG$" || { echo "Tag not found: $TAG" >&2; exit 1; }

echo "Checking out $TAG ..."
git checkout "$TAG"

echo "Rebuilding images..."
"${COMPOSE[@]}" build

echo "Restarting the stack (database is left untouched)..."
"${COMPOSE[@]}" up -d

echo "Waiting for health..."
for i in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo "Rollback complete: $HEALTH_URL is healthy."
    exit 0
  fi
  sleep 2
done

echo "Health check did not pass within 60s: $HEALTH_URL" >&2
exit 1

#!/usr/bin/env bash
# Restore a custom-format dump into the production Postgres container.
# Run ON the VM from /opt/after-sunday:
#   deploy/scripts/restore-production-db.sh /opt/after-sunday-data/backups/after-sunday-XXXX.dump
#
# Preserves UUIDs so existing Supabase-authenticated users keep owning their
# rows. Runs Alembic migrations to head afterwards.
set -euo pipefail

DUMP_FILE="${1:?Usage: restore-production-db.sh <dump-file>}"

ENV_FILE=/opt/after-sunday/.env.production
COMPOSE_FILE=/opt/after-sunday/docker-compose.production.yml
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

pg_user="$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | cut -d= -f2- || true)"
pg_user="${pg_user:-after_sunday}"
pg_db="$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | cut -d= -f2- || true)"
pg_db="${pg_db:-after_sunday}"

[ -f "$DUMP_FILE" ] || { echo "Dump not found: $DUMP_FILE" >&2; exit 1; }

echo "Starting the database container..."
"${COMPOSE[@]}" up -d db

echo "Waiting for the database to become healthy..."
for i in $(seq 1 30); do
  if "${COMPOSE[@]}" exec -T db pg_isready -U "$pg_user" -d "$pg_db" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "Restoring $DUMP_FILE ..."
cat "$DUMP_FILE" | "${COMPOSE[@]}" exec -T db \
  pg_restore \
    --username "$pg_user" \
    --dbname "$pg_db" \
    --clean \
    --if-exists \
    --no-owner

echo "Applying Alembic migrations..."
"${COMPOSE[@]}" run --rm api alembic upgrade head

echo "Restore complete."

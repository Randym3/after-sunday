#!/usr/bin/env bash
# Backup the LOCAL development database before migrating to the Oracle VM.
# Run from the repository root while the local Postgres container is up:
#   docker compose -f api/docker-compose.yml up -d
#   deploy/scripts/backup-local-db.sh
#
# Writes a timestamped custom-format dump to backups/ (gitignored).
set -euo pipefail

DB_HOST="${LOCAL_PG_HOST:-localhost}"
DB_PORT="${LOCAL_PG_PORT:-5433}"
DB_USER="${LOCAL_PG_USER:-after_sunday}"
DB_NAME="${LOCAL_PG_NAME:-after_sunday}"

backup_dir="backups"
mkdir -p "$backup_dir"
file="$backup_dir/after-sunday-$(date +%Y%m%d-%H%M%S).dump"

# Prefer the local pg_dump; fall back to the postgres container's pg_dump so
# the script works on machines without postgresql-client installed.
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump \
    --host "$DB_HOST" \
    --port "$DB_PORT" \
    --username "$DB_USER" \
    --dbname "$DB_NAME" \
    --format custom \
    --file "$file"
elif docker ps --format '{{.Names}}' | grep -qx 'after-sunday-db'; then
  echo "pg_dump not found locally — using the after-sunday-db container."
  docker exec after-sunday-db \
    pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$file"
else
  echo "pg_dump not found and the after-sunday-db container is not running." >&2
  echo "Install postgresql-client or start the local database first." >&2
  exit 1
fi

echo "Backup written to $file"

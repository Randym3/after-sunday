#!/usr/bin/env bash
# Backup the LOCAL development database before migrating to the Oracle VM.
# Run from the repository root while the local Postgres container is up:
#   docker compose -f api/docker-compose.yml up -d
#   deploy/scripts/backup-local-db.sh
#
# Writes a timestamped custom-format dump to backups/ (gitignored).
set -euo pipefail

command -v pg_dump >/dev/null 2>&1 || {
  echo "pg_dump not found. Install postgresql-client locally (or use the VM)." >&2
  exit 1
}

DB_HOST="${LOCAL_PG_HOST:-localhost}"
DB_PORT="${LOCAL_PG_PORT:-5433}"
DB_USER="${LOCAL_PG_USER:-after_sunday}"
DB_NAME="${LOCAL_PG_NAME:-after_sunday}"

backup_dir="backups"
mkdir -p "$backup_dir"
file="$backup_dir/after-sunday-$(date +%Y%m%d-%H%M%S).dump"

pg_dump \
  --host "$DB_HOST" \
  --port "$DB_PORT" \
  --username "$DB_USER" \
  --dbname "$DB_NAME" \
  --format custom \
  --file "$file"

echo "Backup written to $file"

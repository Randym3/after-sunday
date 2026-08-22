#!/usr/bin/env bash
# Daily production database backup. Runs ON the VM (typically via a systemd
# timer or cron). Writes timestamped custom-format dumps to
# /opt/after-sunday-data/backups and keeps 14 days. Exits nonzero on failure.
#
# Copy an encrypted backup off the VM before relying on it as the only copy.
set -euo pipefail

ENV_FILE=/opt/after-sunday/.env.production
COMPOSE_FILE=/opt/after-sunday/docker-compose.production.yml
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

pg_user="$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | cut -d= -f2- || true)"
pg_user="${pg_user:-after_sunday}"
pg_db="$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | cut -d= -f2- || true)"
pg_db="${pg_db:-after_sunday}"

backup_dir=/opt/after-sunday-data/backups
mkdir -p "$backup_dir"
file="$backup_dir/after-sunday-$(date -u +%Y%m%dT%H%M%SZ).dump"

"${COMPOSE[@]}" exec -T db \
  pg_dump -U "$pg_user" -d "$pg_db" -Fc > "$file"

find "$backup_dir" -type f -name '*.dump' -mtime +14 -delete

echo "Backup written to $file"

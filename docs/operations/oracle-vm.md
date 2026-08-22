# After Sunday — Oracle Always Free VM Runbook

Operations guide for the production deployment: one Oracle Ampere A1 VM running
Caddy (HTTPS), Next.js, FastAPI (with the background transcription worker), and
Postgres. Recording uploads stay **disabled** for this deployment.

## VM Details

Fill these in after provisioning (no secrets — private keys, database
passwords, and API keys never belong in this file):

| Field | Value |
| --- | --- |
| Region | `TODO: e.g. us-ashburn-1` |
| Public IP | `TODO` |
| Hostname | `TODO: e.g. app.example.com` |
| Data path | `/opt/after-sunday-data` |
| OCPU / RAM | 2 OCPU / 12 GB (Always Free Ampere A1) |
| Date provisioned | `TODO` |

## Architecture

```txt
Internet
  -> Caddy :80/:443 (only published ports; HTTPS via Let's Encrypt)
     -> /api/*  -> api:8000 (prefix stripped)
     -> /media/* -> api:8000
     -> everything else -> web:3000 (Next.js standalone)
api:8000 (FastAPI + asyncio transcription worker) -> db:5432 (Postgres, private)
```

Supabase remains the authentication provider (Google OAuth). The VM Postgres
stores application rows only; there is no `auth.users` table.

## Provisioning (one-time, OCI console)

1. Create an **Always Free** Ampere A1 compute instance in the account's home
   region: 2 OCPUs / 12 GB RAM, Ubuntu 24.04 LTS, public IPv4, your SSH public
   key. Do **not** pick paid shapes, boot-volume tiers, load balancers, NAT
   gateways, or managed databases.
2. Create a 50 GB+ block volume in the same availability domain, attach it,
   and mount it at `/opt/after-sunday-data` (see Recovery → remount below).
3. Ingress rules: `TCP 22` (your IP only), `TCP 80` and `TCP 443` (`0.0.0.0/0`).
   Never open 3000, 5432, or 8000.
4. DNS: `A` record for the hostname → public IP. Verify before cert issuance:
   ```bash
   getent hosts app.example.com
   ```

## Baseline setup (one-time, on the VM)

```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl git ufw jq postgresql-client
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from <your-ip>/32 to any port 22 proto tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
# log out and back in so the docker group applies
docker version
sudo ufw status verbose
```

## Repository + secrets

```bash
sudo mkdir -p /opt/after-sunday /opt/after-sunday-data/{postgres,storage,backups}
sudo chown "$USER":"$USER" /opt/after-sunday /opt/after-sunday-data
cd /opt/after-sunday
git clone git@github.com:Randym3/after-sunday.git .   # read-only deploy key
git checkout main
cp deploy/.env.production.example .env.production
chmod 600 .env.production
# replace every placeholder; generate SECRET_KEY once:
python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
```

Do **not** rotate `SECRET_KEY` after encrypted settings (e.g. the saved Resend
key) have been written, or they become unreadable.

## Deploy

```bash
cd /opt/after-sunday
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=100 api
```

Verify from another machine:

```bash
curl -fsS https://app.example.com/api/health   # {"status":"healthy"}
curl -I https://app.example.com                # 200 via HTTPS
```

### Supabase configuration

In Supabase → Authentication → URL Configuration:

- Site URL: `https://app.example.com`
- Redirect URLs: add `https://app.example.com/auth/callback`
- The Google OAuth provider redirect URI stays pointed at Supabase's own
  callback (`https://<project-ref>.supabase.co/auth/v1/callback`), not the app.

## Database migration (local dev → VM)

1. Back up the local database (from the repo root, local Postgres on :5433):
   ```bash
   deploy/scripts/backup-local-db.sh
   ```
2. Start only the DB on the VM and wait for it to be healthy:
   ```bash
   docker compose --env-file .env.production -f docker-compose.production.yml up -d db
   ```
3. Copy the dump over encrypted SSH and restore:
   ```bash
   scp backups/after-sunday-*.dump user@app.example.com:/opt/after-sunday-data/
   ssh user@app.example.com \
     'cd /opt/after-sunday && deploy/scripts/restore-production-db.sh /opt/after-sunday-data/after-sunday-*.dump'
   ```
   The restore script applies `alembic upgrade head` afterwards.
4. Verify row counts match the local database before starting the web service:
   ```bash
   docker compose --env-file .env.production -f docker-compose.production.yml exec -T db \
     psql -U after_sunday -d after_sunday \
     -c 'select count(*) from sermons; select count(*) from members; select count(*) from groups;'
   ```

## Backups

`deploy/scripts/backup-production-db.sh` writes a timestamped custom-format
dump to `/opt/after-sunday-data/backups` and prunes dumps older than 14 days.
Install a daily systemd timer (or cron):

```bash
sudo tee /etc/systemd/system/after-sunday-backup.service >/dev/null <<'EOF'
[Unit]
Description=After Sunday database backup
After=docker.service

[Service]
Type=oneshot
User=<your-user>
ExecStart=/opt/after-sunday/deploy/scripts/backup-production-db.sh
EOF
sudo tee /etc/systemd/system/after-sunday-backup.timer >/dev/null <<'EOF'
[Unit]
Description=Run the After Sunday database backup daily

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now after-sunday-backup.timer
```

Copy an encrypted backup to a separate storage provider — the VM must never be
the only copy. **Test a restore**, don't just create dumps.

## Updates

`deploy/scripts/update-production.sh` (run on the VM):

```text
tag current commit -> pull main (ff-only) -> build -> alembic upgrade head
-> restart -> /api/health check
```

## Rollback

`deploy/scripts/rollback-production.sh <git-tag>` rebuilds and restarts the
application containers from a previous tag **without touching the database**.
Database downgrades are not automatic — they require a separate, reviewed
recovery procedure.

## Monitoring

Monitor `https://app.example.com/api/health` (external uptime check). Inspect:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml logs --since=15m api
```

## Recovery

- **Remount data volume after reboot:** the block volume must be re-attached
  and mounted at `/opt/after-sunday-data` (OCI does not auto-mount). Add an
  `/etc/fstab` entry (by UUID, `nofail`) so the stack comes back with data.
- **Restore from backup:** use `deploy/scripts/restore-production-db.sh` with
  the newest dump from `/opt/after-sunday-data/backups` (or the off-VM copy).
- **Verify:** after any restore, confirm sermons/members/groups/settings read
  correctly and run the hosted smoke tests (`docs/operations/oracle-vm-smoke-test.md`).

## Known limitations (go/no-go record)

- One VM is a single point of failure.
- Oracle Always Free capacity and reclaim policies apply.
- The `youtube-transcript-api` scraper may be blocked from a cloud IP; the
  official YouTube provider is a separate milestone.
- Recording uploads remain intentionally disabled.
- Campaign delivery is not yet the completed production workflow.
- Backups must be tested, not merely created.

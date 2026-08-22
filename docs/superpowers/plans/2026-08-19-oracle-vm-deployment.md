# Oracle Always Free VM Deployment Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Host the current After Sunday application on one Oracle Cloud Always Free VM with Docker, an always-on FastAPI worker, persistent Postgres, HTTPS, and Supabase authentication while keeping recording uploads temporarily disabled.

**Architecture:** One Oracle Ampere A1 VM runs Caddy, the Next.js web container, the FastAPI API/worker container, and a Postgres container. Caddy serves one public hostname, routes `/api/*` to FastAPI after stripping the prefix, and terminates HTTPS; Supabase remains the external authentication provider, while Postgres data is migrated from the local development database onto the VM’s persistent block volume. The deployment keeps the current YouTube/paste-transcript workflows and does not re-enable recordings.

**Tech Stack:** Oracle Cloud Infrastructure Always Free Compute, Ubuntu LTS, Docker Engine, Docker Compose, Caddy, Next.js 16, FastAPI/Uvicorn, PostgreSQL 16, Alembic, Supabase Auth, GitHub, and the existing Resend/Groq/Velma integrations.

## Global Constraints

- Use an Oracle Always Free Ampere A1 VM within the documented 2 OCPU / 12 GB RAM allowance; do not create billable compute resources.
- Keep Postgres private inside the Docker network; never expose port 5432 to the public internet.
- Keep SSH restricted to the operator’s IP or a VPN/security group; do not open SSH to the world.
- Keep `RECORDING_UPLOADS_ENABLED = false` in both frontend and backend during this deployment.
- Do not delete or simplify the existing recording upload/transcription implementation.
- Keep Supabase Auth and Google login; update only the hosted callback and site URLs.
- Keep secrets out of Git, Dockerfiles, images, logs, and client-side environment variables.
- Run Alembic migrations before starting application traffic, and take a database dump before the first migration on the VM.
- Use a public domain or subdomain for HTTPS; do not use a raw IP for OAuth callbacks.
- Treat the current `youtube-transcript-api` scraper as a temporary hosted risk; do not claim production reliability until the official YouTube provider plan is completed.
- Tests must run locally or in CI; deployment verification may make real external API calls only after the user explicitly provides the production credentials and domain.

---

## File Map

- Create `api/Dockerfile` for the production FastAPI image.
- Create `web/Dockerfile` for the production Next.js image.
- Create `docker-compose.production.yml` at the repository root for `caddy`, `web`, `api`, and `db`.
- Create the `deploy` directory, `deploy/Caddyfile` for HTTPS and reverse proxy routing, and `deploy/.env.production.example` documenting required VM secrets without values. Create `deploy/scripts` before adding the operational shell scripts in Tasks 4 and 7.
- Create `.dockerignore` files for `api` and `web` so tests, virtual environments, `.env` files, and local storage never enter images.
- Modify `web/next.config.ts` to use standalone output for the production container.
- Modify `api/app/config.py` and `api/app/main.py` so the public web origin is configurable instead of hardcoded to localhost.
- Modify `api/.env.example` to document production database/network values and preserve the upload-disabled switch.
- Create the `docs/operations` directory and `docs/operations/oracle-vm.md` with provisioning, deployment, backup, update, rollback, and recovery procedures.
- Add deployment smoke tests to the existing test suites without adding production credentials.

---

### Task 1: Provision the Oracle Always Free VM and network boundary

**Files:**
- Create: `docs/operations/oracle-vm.md`

**Interfaces:**
- Produces a VM with a stable public IPv4 address, a persistent block volume, and only ports 22, 80, and 443 reachable from the internet.
- Produces a DNS record such as `app.example.com` pointing to the VM address.
- Consumes no repository code changes.

- [ ] **Step 1: Create the Always Free compute instance**

In Oracle Cloud Infrastructure:

- choose the account’s home region;
- select an Always Free eligible Ampere A1 shape;
- allocate 2 OCPUs and 12 GB RAM;
- select Ubuntu 24.04 LTS or the current Ubuntu LTS image marked Always Free eligible;
- assign a public IPv4 address;
- add an SSH public key;
- create a 50 GB or larger block volume in the same availability domain;
- attach and mount the volume at `/opt/after-sunday-data`.

Do not select a paid shape, paid boot volume tier, load balancer, NAT gateway, or managed database during this task.

- [ ] **Step 2: Configure Oracle ingress rules**

Create ingress rules for:

```text
TCP 22   operator IP only
TCP 80   0.0.0.0/0
TCP 443  0.0.0.0/0
```

Do not create public ingress rules for ports 3000, 5432, or 8000.

- [ ] **Step 3: Configure DNS**

Create an A record for the selected application hostname:

```text
app.example.com A <oracle-public-ip>
```

Verify propagation before requesting a certificate:

```bash
getent hosts app.example.com
```

- [ ] **Step 4: Install baseline packages and firewall**

On the VM, run:

```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl git ufw jq postgresql-client
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from <operator-ip>/32 to any port 22 proto tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

Log out and back in so the Docker group membership applies. Confirm:

```bash
docker version
sudo ufw status verbose
```

- [ ] **Step 5: Document the VM details without secrets**

Record the VM region, public IP, hostname, mounted data path, and date provisioned in `docs/operations/oracle-vm.md`. Do not record private keys, database passwords, API keys, or Supabase service-role keys.

- [ ] **Step 6: Commit the runbook scaffold**

```bash
git add docs/operations/oracle-vm.md
git commit -m "docs: add oracle vm deployment runbook"
```

---

### Task 2: Make the Next.js and FastAPI containers production-ready

**Files:**
- Create: `api/Dockerfile`
- Create: `web/Dockerfile`
- Create: `api/.dockerignore`
- Create: `web/.dockerignore`
- Modify: `web/next.config.ts`
- Test: `web` production build

**Interfaces:**
- Produces an API image that starts with `uvicorn app.main:app --host 0.0.0.0 --port 8000`.
- Produces a web image that starts with `next start` from the standalone output.
- Does not copy `.env`, `.env.local`, `.venv`, `storage`, `node_modules`, tests, or Git metadata into images.

- [ ] **Step 1: Add the API Dockerfile**

Use a Python 3.12 slim image, install `api/requirements.txt`, copy only the API application and Alembic files, and define:

```dockerfile
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Do not bake any environment variable values into the image.

- [ ] **Step 2: Enable standalone Next.js output**

In `web/next.config.ts`, preserve existing settings and add:

```ts
const nextConfig = {
  output: "standalone",
};

export default nextConfig;
```

If the file already exports an object, add `output: "standalone"` to that object instead of replacing it.

- [ ] **Step 3: Add the web multi-stage Dockerfile**

Use Node 22 or the Node version required by the existing Next.js lockfile:

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 4: Add Docker ignore files**

Each ignore file must contain at least:

```text
node_modules
.next
.env
.env.*
.git
storage
__pycache__
.venv
tests
```

Keep any required production assets out of the ignore list.

- [ ] **Step 5: Verify images build locally**

Run:

```bash
docker build -f api/Dockerfile -t after-sunday-api ./api
docker build -f web/Dockerfile -t after-sunday-web ./web
```

Expected: both images build without reading local secret files.

- [ ] **Step 6: Run frontend checks**

Run:

```bash
cd web
npm run lint
npm run build
```

Expected: lint and production build pass.

- [ ] **Step 7: Commit containerization**

```bash
git add api/Dockerfile web/Dockerfile api/.dockerignore web/.dockerignore web/next.config.ts
git commit -m "build: add production containers for web and api"
```

---

### Task 3: Configure same-origin HTTPS routing and production environment

**Files:**
- Create: `docker-compose.production.yml`
- Create: `deploy/Caddyfile`
- Create: `deploy/.env.production.example`
- Modify: `api/app/config.py`
- Modify: `api/app/main.py`
- Modify: `api/.env.example`
- Create: `api/tests/test_config.py`

**Interfaces:**
- Public web origin: `https://app.example.com`.
- Public API origin from the browser: `https://app.example.com/api`.
- Internal API origin from Caddy: `http://api:8000`.
- Internal database origin from API: `db:5432`.
- Caddy strips `/api` before forwarding to FastAPI so existing routes such as `/sermons` and `/youtube/transcript` remain unchanged.
- `RECORDING_UPLOADS_ENABLED` remains false in the existing frontend/backend gates.

- [ ] **Step 1: Make the API CORS origin configurable**

Add a setting such as:

```python
web_origin: str = "http://localhost:3000"
```

Replace the hardcoded `allow_origins=["http://localhost:3000"]` with:

```python
allow_origins=[get_settings().web_origin]
```

Keep localhost as the development default.

- [ ] **Step 2: Add a configuration regression test**

Create `api/tests/test_config.py`:

```python
from app.config import get_settings


def test_web_origin_can_be_configured(monkeypatch):
    monkeypatch.setenv("WEB_ORIGIN", "https://app.example.com")
    get_settings.cache_clear()
    try:
        assert get_settings().web_origin == "https://app.example.com"
    finally:
        get_settings.cache_clear()
```

Run: `cd api && source .venv/bin/activate && python -m pytest tests/test_config.py -q`

Expected: PASS after the `web_origin` setting is added.

- [ ] **Step 3: Add the production environment template**

Create `deploy/.env.production.example` with names but no values:

```env
POSTGRES_USER=after_sunday
POSTGRES_PASSWORD=replace-with-a-long-random-password
POSTGRES_DB=after_sunday
DATABASE_URL=postgresql+psycopg://after_sunday:replace-with-password@db:5432/after_sunday
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=
WEB_ORIGIN=https://app.example.com
NEXT_PUBLIC_API_URL=https://app.example.com/api
MODULATE_API_KEY=
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=
LLM_MODEL=openai/gpt-oss-20b
RESEND_API_KEY=
EMAIL_FROM=After Sunday <noreply@your-domain.example>
SECRET_KEY=
STORAGE_ROOT=/var/lib/after-sunday/storage
RECORDING_UPLOADS_ENABLED=false
```

Keep server-only secrets out of any `NEXT_PUBLIC_*` variable.

- [ ] **Step 4: Add Caddy routing**

Create `deploy/Caddyfile`:

```caddyfile
app.example.com {
    encode gzip zstd

    handle_path /api/* {
        reverse_proxy api:8000
    }

    handle /media/* {
        reverse_proxy api:8000
    }

    handle {
        reverse_proxy web:3000
    }
}
```

Caddy will obtain and renew the HTTPS certificate automatically once DNS and ports 80/443 are working.

- [ ] **Step 5: Add production Compose services**

Create `docker-compose.production.yml` with:

- `db`: `postgres:16-alpine`, internal-only, persistent volume at `/opt/after-sunday-data/postgres`;
- `api`: API image, `DATABASE_URL` pointing to `db:5432`, persistent storage at `/opt/after-sunday-data/storage`, healthcheck `/health`, restart policy `unless-stopped`;
- `web`: web image built with `NEXT_PUBLIC_API_URL=https://app.example.com/api` as a build argument and exposed at runtime, restart policy `unless-stopped`;
- `caddy`: official Caddy image, ports 80/443, persistent `/data` and `/config`, mounted `deploy/Caddyfile`, restart policy `unless-stopped`.

Do not publish Postgres, API, or Next.js ports to the VM host. Compose service discovery should handle internal communication.

- [ ] **Step 6: Add health checks and resource limits**

Configure:

```text
API healthcheck: GET http://api:8000/health
Database healthcheck: pg_isready -U after_sunday -d after_sunday
```

Set conservative container resource limits so the 2 OCPU / 12 GB VM remains responsive during builds and migrations. Build images before starting production services when possible.

- [ ] **Step 7: Run a local production Compose smoke test**

Run with a local test environment file:

```bash
docker compose --env-file deploy/.env.production.example -f docker-compose.production.yml config
```

Expected: Compose renders successfully. Do not use the template file with real services until all placeholder values are replaced.

- [ ] **Step 8: Commit production routing configuration**

```bash
git add docker-compose.production.yml deploy/Caddyfile deploy/.env.production.example api/app/config.py api/app/main.py api/.env.example
 git commit -m "build: configure production routing and environment"
```

---

### Task 4: Migrate the local Postgres database safely

**Files:**
- Create: `deploy/scripts/backup-local-db.sh`
- Create: `deploy/scripts/restore-production-db.sh`
- Modify: `docs/operations/oracle-vm.md`

**Interfaces:**
- Produces a compressed, timestamped `pg_dump` of the local database.
- Restores schema/data into the VM’s Postgres container.
- Preserves UUIDs so existing Supabase-authenticated users continue to own their existing sermons, members, groups, and campaigns.

- [ ] **Step 1: Back up the local database before deployment**

From the repository root while local Postgres is running:

```bash
mkdir -p backups
pg_dump \
  --host localhost \
  --port 5433 \
  --username after_sunday \
  --dbname after_sunday \
  --format custom \
  --file "backups/after-sunday-$(date +%Y%m%d-%H%M%S).dump"
```

Do not commit the dump. Add `backups/` to `.gitignore` if it is not already ignored.

- [ ] **Step 2: Start only the VM database container**

On the VM:

```bash
cd /opt/after-sunday
cp deploy/.env.production.example .env.production
chmod 600 .env.production
# Replace every placeholder in .env.production before continuing.
docker compose --env-file .env.production -f docker-compose.production.yml up -d db
```

Wait for:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml ps
```

Expected: the database is healthy.

- [ ] **Step 3: Restore the dump**

Copy the dump to the VM through an encrypted SSH transfer:

```bash
scp backups/after-sunday-YYYYMMDD-HHMMSS.dump user@app.example.com:/opt/after-sunday-data/
```

Restore it into the private database container:

```bash
cat /opt/after-sunday-data/after-sunday-YYYYMMDD-HHMMSS.dump | \
docker compose --env-file .env.production -f docker-compose.production.yml exec -T db \
  pg_restore \
    --username after_sunday \
    --dbname after_sunday \
    --clean \
    --if-exists \
    --no-owner
```

- [ ] **Step 4: Apply migrations after restore**

Run the API migration command from the API container:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml run --rm api alembic upgrade head
```

Expected: Alembic reaches the repository head without downgrading or skipping revisions.

- [ ] **Step 5: Verify row counts and ownership UUIDs**

Run:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec -T db \
  psql -U after_sunday -d after_sunday \
  -c 'select count(*) from sermons; select count(*) from members; select count(*) from groups;'
```

Compare counts with the local database before starting the web service.

- [ ] **Step 6: Commit migration scripts/documentation**

```bash
git add deploy/scripts/backup-local-db.sh deploy/scripts/restore-production-db.sh docs/operations/oracle-vm.md .gitignore
git commit -m "ops: add oracle database migration procedures"
```

---

### Task 5: Deploy the application and configure Supabase

**Files:**
- Modify: `docs/operations/oracle-vm.md`

**Interfaces:**
- Produces a running `web`, `api`, `db`, and `caddy` stack.
- Produces Supabase configuration for the hosted origin.
- Keeps the current upload-disabled behavior in production.

- [ ] **Step 1: Install the repository on the VM**

Use a read-only deploy key or GitHub Actions deployment key. Do not copy a developer’s private key into the VM.

```bash
sudo mkdir -p /opt/after-sunday
sudo chown "$USER":"$USER" /opt/after-sunday
cd /opt/after-sunday
git clone git@github.com:Randym3/after-sunday.git .
git checkout main
```

- [ ] **Step 2: Configure secrets**

Create `/opt/after-sunday/.env.production` with real values and lock it down:

```bash
chmod 600 /opt/after-sunday/.env.production
```

Generate `SECRET_KEY` once:

```bash
python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
```

Do not rotate `SECRET_KEY` after encrypted settings have been saved unless the encrypted settings are migrated first.

- [ ] **Step 3: Configure Supabase URLs**

In Supabase Authentication URL Configuration, set the hosted site URL to:

```text
https://app.example.com
```

Add this redirect URL:

```text
https://app.example.com/auth/callback
```

Keep the Google Cloud OAuth provider redirect URI pointed at Supabase’s callback URL, not the application callback:

```text
https://<supabase-project-ref>.supabase.co/auth/v1/callback
```

- [ ] **Step 4: Start the full stack**

```bash
cd /opt/after-sunday
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

Check:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=100 api
```

- [ ] **Step 5: Wait for Caddy TLS and verify health**

Run from another machine:

```bash
curl -fsS https://app.example.com/api/health
curl -I https://app.example.com
```

Expected: API returns `{"status":"healthy"}` and the web app returns HTTPS successfully.

- [ ] **Step 6: Commit the deployment instructions**

```bash
git add docs/operations/oracle-vm.md
git commit -m "docs: document oracle application deployment"
```

---

### Task 6: Run hosted end-to-end smoke tests

**Files:**
- Create: `docs/operations/oracle-vm-smoke-test.md`
- Test: deployed environment manually, without committing credentials

**Interfaces:**
- Verifies the hosted app’s authentication, YouTube import, AI generation, email test, and temporary upload gate.
- Confirms the background worker remains alive in the always-on API container.

- [ ] **Step 1: Verify authentication**

From an incognito browser:

1. Open `https://app.example.com/signup`.
2. Complete Google sign-in.
3. Confirm redirect to `/app/dashboard`.
4. Refresh the page and confirm the session remains active.
5. Log out and confirm protected routes redirect to `/login`.

- [ ] **Step 2: Verify YouTube pre-import**

1. Open `/app/sermons/new`.
2. Confirm YouTube is selected by default.
3. Paste a church YouTube URL.
4. Confirm metadata prefills.
5. Click **Import transcript**.
6. Confirm the existing loading spinner appears.
7. Confirm the transcript appears before sermon creation.
8. Create the sermon.
9. Confirm the transcript is ready and no duplicate caption job is created.

- [ ] **Step 3: Verify paste-transcript flow**

1. Select Paste transcript.
2. Paste a transcript.
3. Create the sermon.
4. Generate an AI draft.
5. Save and approve the draft.
6. Confirm the provider/model metadata is shown.

- [ ] **Step 4: Verify temporary upload gate**

Confirm the Upload recording card is disabled and the file picker cannot open. Verify the API rejects a direct upload-init request with HTTP 503 and the temporary-disabled message.

Do not re-enable uploads as part of this deployment.

- [ ] **Step 5: Verify worker logs**

```bash
docker compose --env-file .env.production -f docker-compose.production.yml logs -f api
```

Confirm the worker starts once, does not crash on startup, and processes any intentionally queued non-upload job.

- [ ] **Step 6: Verify email configuration**

From a sermon with a draft, send one test email to an approved test address. Confirm Resend succeeds and no API key appears in browser responses or logs.

- [ ] **Step 7: Commit the smoke-test checklist**

```bash
git add docs/operations/oracle-vm-smoke-test.md
git commit -m "docs: add hosted oracle smoke tests"
```

---

### Task 7: Add backup, update, monitoring, and rollback operations

**Files:**
- Create: `deploy/scripts/backup-production-db.sh`
- Create: `deploy/scripts/update-production.sh`
- Create: `deploy/scripts/rollback-production.sh`
- Modify: `docs/operations/oracle-vm.md`

**Interfaces:**
- Produces daily database dumps without stopping the application.
- Produces a repeatable update command with migration-before-traffic ordering.
- Produces a rollback procedure that does not destroy the database.
- Produces a health endpoint suitable for an external uptime monitor.

- [ ] **Step 1: Implement the production database backup**

Create a script that writes a timestamped custom-format dump to `/opt/after-sunday-data/backups`, retains 14 days locally, and exits nonzero on failure:

```bash
set -euo pipefail
backup_dir=/opt/after-sunday-data/backups
mkdir -p "$backup_dir"
file="$backup_dir/after-sunday-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose --env-file /opt/after-sunday/.env.production -f /opt/after-sunday/docker-compose.production.yml exec -T db \
  pg_dump -U after_sunday -d after_sunday -Fc > "$file"
find "$backup_dir" -type f -name '*.dump' -mtime +14 -delete
```

Configure a daily systemd timer or cron entry. Copy an encrypted backup to a separate storage provider before relying on the VM as the only copy.

- [ ] **Step 2: Implement controlled updates**

The update script must:

```bash
set -euo pipefail
cd /opt/after-sunday
git fetch origin main
git checkout main
git pull --ff-only origin main
docker compose --env-file .env.production -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.production.yml run --rm api alembic upgrade head
docker compose --env-file .env.production -f docker-compose.production.yml up -d
curl -fsS https://app.example.com/api/health
```

Do not run `git reset --hard`, `git clean`, or destructive database commands during updates.

- [ ] **Step 3: Implement rollback**

Tag each deployed commit before updating:

```bash
git tag "production-$(date -u +%Y%m%dT%H%M%SZ)"
git push origin --tags
```

For an application-only rollback, check out the previous known-good tag, rebuild the images, and restart without downgrading Alembic. Database downgrade requires a separate reviewed recovery procedure and must not be automatic.

- [ ] **Step 4: Add monitoring**

Monitor:

```text
https://app.example.com/api/health
```

Alert on non-200 responses and inspect:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml logs --since=15m api
```

- [ ] **Step 5: Commit operations scripts**

```bash
git add deploy/scripts/backup-production-db.sh deploy/scripts/update-production.sh deploy/scripts/rollback-production.sh docs/operations/oracle-vm.md
 git commit -m "ops: add oracle backup update and rollback scripts"
```

---

### Task 8: Production go/no-go review

**Files:**
- Modify: `docs/operations/oracle-vm.md`
- Modify: `docs/agent/04_ROADMAP.md`

**Interfaces:**
- Produces a documented decision about whether the VM is suitable for the current small-scale church test.
- Does not re-enable recording uploads or claim that YouTube scraping is permanently reliable.

- [ ] **Step 1: Confirm the free-tier boundary**

Verify the Oracle console shows the VM as Always Free eligible and no paid compute, load balancer, NAT gateway, or database resource exists.

- [ ] **Step 2: Confirm security boundaries**

Verify:

```bash
sudo ufw status verbose
ss -lntp
```

Only Caddy’s 80/443 and restricted SSH should be publicly reachable. Postgres must be reachable only by the Docker network.

- [ ] **Step 3: Confirm data recovery**

Restore the latest dump into a separate test database container or temporary local Postgres instance and verify sermons, members, groups, campaigns, and settings are readable.

- [ ] **Step 4: Record known limitations**

Document that:

- one VM is a single point of failure;
- Oracle Always Free capacity and reclaim policies apply;
- the current YouTube scraper may be blocked from a cloud IP;
- uploads remain intentionally disabled;
- campaign delivery is not yet the completed production workflow;
- backups must be tested, not merely created.

- [ ] **Step 5: Update the roadmap**

Mark the Oracle deployment as a development/small-church hosting milestone, not as completion of multi-tenant security, campaign delivery, or the official YouTube provider work.

- [ ] **Step 6: Commit the go/no-go record**

```bash
git add docs/operations/oracle-vm.md docs/agent/04_ROADMAP.md
git commit -m "docs: record oracle hosting readiness review"
```

---

## Self-Review

### Spec coverage

- Oracle Always Free VM: Tasks 1 and 8.
- Current Next.js/FastAPI/Postgres architecture: Tasks 2–5.
- Always-on worker: production API container in Tasks 2, 3, and 6.
- HTTPS and public routing: Tasks 1 and 3.
- Supabase Auth and Google OAuth: Task 5.
- Database migration and persistence: Task 4.
- Temporary recording-upload decision: Global Constraints, Tasks 3 and 6.
- Backups, updates, monitoring, and rollback: Task 7.
- YouTube cloud-IP risk: Task 8, with the official provider remaining a separate future milestone.
- No deployment credentials or production values committed: Global Constraints and Task 3.

### Placeholder scan

The plan contains no `TBD` or `TODO` instructions. Deployment-specific values are named explicitly as variables such as `app.example.com`, `<oracle-public-ip>`, and `<operator-ip>` and must be replaced only in the VM’s private configuration or DNS provider.

### Type and interface consistency

- The frontend API base URL is `https://app.example.com/api`, while Caddy strips `/api` before FastAPI receives existing routes such as `/health`, `/sermons`, and `/youtube/transcript`.
- The API database URL uses the Compose service name `db:5432`, not the local development port `5433`. The browser-visible `NEXT_PUBLIC_API_URL` is supplied during the Next.js image build, because public Next.js environment variables are embedded at build time.
- The same `RECORDING_UPLOADS_ENABLED=false` decision is preserved in both frontend and backend deployment configuration.
- Supabase remains responsible for auth/session verification; the VM Postgres database stores application rows and does not need an `auth.users` table.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-19-oracle-vm-deployment.md`. Two execution options:

**1. Subagent-Driven (recommended)** - Dispatch a fresh subagent per task and review between tasks.

**2. Inline Execution** - Execute the tasks in this session with checkpoints.

No VM, DNS, Docker service, database, or deployment resource has been created by this plan.

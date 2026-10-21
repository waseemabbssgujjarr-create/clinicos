# Clinicos production server runbook — doctorsmyagency.com

**Account:** `digitals`  
**Web root:** `/home/digitals/doctorsmyagency.com`  
**API code:** `/home/digitals/doctorsmyagency.com/clinicos-api`  
**Environment file:** `/home/digitals/doctorsmyagency.com/clinicos-api/.env` (never commit; edit via cPanel File Manager or SSH)  
**Production API port:** `3002` (TCP on `127.0.0.1`, not public)  
**Public API URL:** `https://doctorsmyagency.com/api/*` → Apache `.htaccess` → `api-proxy.php` → Node `:3002`

cPanel **“Restart Node.js app”** does **not** reload the cron-started API on port 3002. Use the commands below.

---

## Quick health checks (browser or curl)

| URL | Expected |
|-----|----------|
| `https://doctorsmyagency.com/api/health` | HTTP **200**, JSON `"api":"healthy"` |
| `https://doctorsmyagency.com/api/health/db` | HTTP **200**, `"database":"healthy"` |
| `https://doctorsmyagency.com/api-status.php` | HTTP **200**, diagnosis + logs (no Node required) |

When Node is down, `/api/*` returns HTTP **502** with `"code":"PROXY_ERROR"`.

---

## cPanel cron jobs (recommended)

Set these under **cPanel → Cron Jobs** as user `digitals`:

```cron
# Every 5 minutes — start or no-op if already healthy
*/5 * * * * /bin/bash /home/digitals/doctorsmyagency.com/clinicos-api/start-node.sh

# Every 2 minutes — restart only if :3002 is dead (uses force-start-api.sh)
*/2 * * * * /bin/bash /home/digitals/doctorsmyagency.com/clinicos-api/keepalive-api.sh
```

`start-node.sh` exits immediately when `/api/health` on localhost already returns healthy (avoids killing a live process).

---

## SSH / cPanel Terminal — start API now

```bash
cd /home/digitals/doctorsmyagency.com/clinicos-api

# First-time or after git upload without node_modules:
npm install --omit=dev
npx prisma generate

# Preferred recovery (clears LVE locks, kills stuck node, starts bootstrap):
/bin/bash force-start-api.sh

# Or lighter cron-style start:
/bin/bash start-node.sh
```

**Verify on the server:**

```bash
curl -s http://127.0.0.1:3002/api/health
curl -s http://127.0.0.1:3002/api/leads/features | head -c 200
```

**Verify from the internet:**

```bash
curl -s https://doctorsmyagency.com/api/health
```

---

## After deploying new `clinicos-api/dist/*`

1. Upload changed files to `/home/digitals/doctorsmyagency.com/clinicos-api/dist/`.
2. Queue restart (picked up within 5 min by cron), or restart immediately in Terminal:

```bash
# Browser (creates clinicos-api/logs/force-restart flag):
# https://doctorsmyagency.com/force-restart.php?key=DMA-SETUP-2026

/bin/bash /home/digitals/doctorsmyagency.com/clinicos-api/force-start-api.sh
```

---

## Log files

| Path | Purpose |
|------|---------|
| `clinicos-api/logs/cron.log` | `start-node.sh` output, npm install, boot |
| `clinicos-api/logs/force-start.log` | `force-start-api.sh` recovery |
| `clinicos-api/logs/startup.log` | Node bootstrap (DATABASE_URL, Prisma, SMTP) |
| `clinicos-api/logs/keepalive.log` | `keepalive-api.sh` |
| `logs/api-proxy.log` | PHP proxy → Node (site root `logs/`) |
| `stderr.log` | cPanel Passenger errors (ignore if using cron-only TCP 3002) |

---

## Common failures

### PROXY_ERROR / port 3002 closed

Node is not listening. Run `force-start-api.sh`. Check `cron.log` and `force-start.log` for `FATAL`, `Killed` (CloudLinux LVE OOM), or `npm install FAILED`.

### NPM_INSTALL_REQUIRED (`api-status.php`)

Run in Terminal:

```bash
cd /home/digitals/doctorsmyagency.com/clinicos-api
npm install --omit=dev
npx prisma generate
/bin/bash start-node.sh
```

### Brief outage every ~5 minutes

Usually `start-node.sh` restarting while health check failed under load. Ensure keepalive + start-node crons are both set; deploy latest `start-node.sh` (health check before kill).

### MySQL works but API down

Database is independent (PHP `api-status.php` probes MySQL). Fix Node process, not `.env` password, unless `startup.log` shows Prisma auth errors.

### DATABASE_URL

Must use `127.0.0.1` not `localhost` on this host (IPv6 / Prisma). Scripts rewrite automatically; confirm in `clinicos-api/.env`.

---

## Architecture (do not change without planning)

- **Apache** serves static HTML/JS/CSS from web root.
- **`api-proxy.php`** forwards `/api` and `/socket.io` to `127.0.0.1:3002` (fallback `3001`, then Passenger socket).
- **Node** runs `clinicos-api/dist/bootstrap.js` with `PORT=3002`.
- **`.env`** lives only under `clinicos-api/`; `start-node.sh` exports it before `nohup node`.

---

## Node venv paths (CloudLinux)

Activate script is usually one of:

- `/home/digitals/nodevenv/doctorsmyagency.com/clinicos-api/20/bin/activate`
- `/home/digitals/nodevenv/doctorsmyagency.com/20/bin/activate`

`force-start-api.sh` requires a valid venv; `start-node.sh` falls back to PATH `node` if activate is missing.

---

© Clinicos · Doctors My Agency · operations doc for production host.

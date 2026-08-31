#!/bin/bash
# keepalive-api.sh — cron every 1–2 min; restart ClinicOS API if port 3002 is dead
#
# cPanel Cron (digitals):
#   bash /home/digitals/doctorsmyagency.com/clinicos-api/keepalive-api.sh
#
# Design:
# - Exits quickly when healthy (curl health check only).
# - Never spam-starts: lock file with timeout while force-start is running.
# - Restarts via force-start-api.sh which clears digitals Node (LVE OOM recovery),
#   sets NODE_OPTIONS=192, prefers 127.0.0.1 DB host, then starts bootstrap.

API_DIR="/home/digitals/doctorsmyagency.com/clinicos-api"
PORT=3002
HEALTH_URL="http://127.0.0.1:${PORT}/api/leads/features"
LOG="$API_DIR/logs/keepalive.log"
LOCK="$API_DIR/logs/keepalive.lock"
FORCE_START="$API_DIR/force-start-api.sh"
# Max seconds a start may hold the lock before keepalive may try again
LOCK_TIMEOUT_SEC=120

mkdir -p "$API_DIR/logs"

log() {
  echo "$(date -Iseconds) $*" >> "$LOG"
}

is_healthy() {
  local RESP
  RESP=$(curl -s --max-time 3 "$HEALTH_URL" 2>/dev/null || true)
  if echo "$RESP" | grep -q '"features"' && ! echo "$RESP" | grep -q 'php-fallback'; then
    return 0
  fi
  return 1
}

lock_age_sec() {
  if [ ! -f "$LOCK" ]; then
    echo 0
    return
  fi
  local mtime now
  mtime=$(stat -c %Y "$LOCK" 2>/dev/null || echo 0)
  now=$(date +%s)
  echo $((now - mtime))
}

# Fast path — API alive
if is_healthy; then
  # Keep log small: one short OK line (cron every 1–2 min is fine)
  log "OK healthy on :$PORT"
  exit 0
fi

log "UNHEALTHY :$PORT — curl $HEALTH_URL failed or php-fallback"

# Do not start if another keepalive/force-start is in progress
if [ -f "$LOCK" ]; then
  AGE=$(lock_age_sec)
  if [ "$AGE" -lt "$LOCK_TIMEOUT_SEC" ]; then
    log "SKIP already starting (lock age ${AGE}s < ${LOCK_TIMEOUT_SEC}s) — avoid fork/nproc spam"
    exit 0
  fi
  log "WARN stale lock age ${AGE}s — clearing and retrying"
  rm -f "$LOCK"
fi

if [ ! -x "$FORCE_START" ] && [ ! -f "$FORCE_START" ]; then
  log "FATAL missing $FORCE_START"
  exit 1
fi

# Acquire lock (PID + timestamp for operators)
printf '%s\n' "pid=$$ started=$(date -Iseconds)" > "$LOCK"
# Always drop lock when this script exits (success or failure)
trap 'rm -f "$LOCK"' EXIT

log "START force-start-api.sh (kills digitals node to free LVE; starts :$PORT)"
bash "$FORCE_START" >> "$LOG" 2>&1
RC=$?

if is_healthy; then
  log "SUCCESS api back on :$PORT (force-start exit=$RC)"
  exit 0
fi

log "FAIL still unhealthy after force-start exit=$RC — check logs/force-start.log logs/startup.log (Killed/LVE OOM, Prisma PANIC, localhost→127.0.0.1, SMTP 535, nproc)"
if grep -q 'Killed' "$API_DIR/logs/force-start.log" 2>/dev/null; then
  log "HINT: Killed seen in force-start.log — LVE OOM; see FIX-NODE-KILLED.txt"
fi
exit 1

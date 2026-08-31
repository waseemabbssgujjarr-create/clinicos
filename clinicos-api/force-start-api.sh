#!/bin/bash
# force-start-api.sh — bypass stuck cPanel Node lock; start API on port 3002
# Usage (cPanel Terminal):
#   bash /home/digitals/doctorsmyagency.com/clinicos-api/force-start-api.sh
#
# LVE/OOM note: kills ALL digitals node processes to free memory before start.
# Prefer 127.0.0.1 in DATABASE_URL (see FIX-NODE-KILLED.txt).

set -e
API_DIR="/home/digitals/doctorsmyagency.com/clinicos-api"
PORT=3002
LOG="$API_DIR/logs/force-start.log"

mkdir -p "$API_DIR/logs"
echo "======== $(date -Iseconds) force-start ========" >> "$LOG"

echo "1) Clearing CloudLinux locks..."
rm -f /home/digitals/nodevenv/doctorsmyagency.com/.lock 2>/dev/null || true
rm -f /home/digitals/nodevenv/doctorsmyagency.com/20/.lock 2>/dev/null || true
rm -f /home/digitals/nodevenv/doctorsmyagency.com/clinicos-api/.lock 2>/dev/null || true
rm -f /home/digitals/nodevenv/doctorsmyagency.com/clinicos-api/20/.lock 2>/dev/null || true
find /home/digitals/nodevenv -name '.lock' -path '*clinicos*' -print -delete 2>/dev/null || true

echo "2) Killing ALL digitals Node to free LVE (OOM)..."
# Under CloudLinux LVE, leftover Node orphans cause "Killed" on next nohup start.
# Intentional full clear for this account when recovering from OOM.
pkill -9 -u digitals node 2>/dev/null || true
pkill -9 -u digitals -f "node.*bootstrap" 2>/dev/null || true
pkill -9 -u digitals -f "passenger" 2>/dev/null || true
fuser -k ${PORT}/tcp 2>/dev/null || true
fuser -k 3001/tcp 2>/dev/null || true
sleep 3
echo "=== remaining node ===" | tee -a "$LOG"
pgrep -afu digitals node 2>/dev/null | tee -a "$LOG" || echo "(none)" | tee -a "$LOG"

echo "3) Activating Node venv..."
ACTIVATE=""
for cand in \
  "/home/digitals/nodevenv/doctorsmyagency.com/clinicos-api/20/bin/activate" \
  "/home/digitals/nodevenv/doctorsmyagency.com/20/bin/activate" \
  "/home/digitals/nodevenv/doctorsmyagency.com/clinicos-api/24/bin/activate"
do
  if [ -f "$cand" ]; then ACTIVATE="$cand"; break; fi
done

if [ -z "$ACTIVATE" ]; then
  echo "FATAL: nodevenv activate not found" | tee -a "$LOG"
  exit 1
fi
# shellcheck disable=SC1090
source "$ACTIVATE"
cd "$API_DIR" || exit 1

if [ ! -f "$API_DIR/dist/bootstrap.js" ]; then
  echo "FATAL: dist/bootstrap.js missing" | tee -a "$LOG"
  exit 1
fi

# Prefer symlink node_modules from CloudLinux; if missing, use backup folder
if [ ! -e node_modules ] && [ -d node_modules.local-bak ]; then
  echo "Restoring node_modules from local-bak (temporary)..."
  mv node_modules.local-bak node_modules
fi

if [ ! -d node_modules/express ] && [ ! -d node_modules/dotenv ]; then
  echo "Running npm install --omit=dev ..."
  npm install --omit=dev >> "$LOG" 2>&1 || true
fi

# Strip CRLF from .env and export into this shell (Node inherits; .env is source of truth)
load_dotenv() {
  local f="$1"
  if [ ! -f "$f" ]; then
    echo "WARN: missing $f — Node may lack DATABASE_URL" | tee -a "$LOG"
    return 1
  fi
  sed -i 's/\r$//' "$f" 2>/dev/null || true
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in
      ''|\#*) continue ;;
    esac
    # skip lines without KEY=VAL
    case "$line" in
      *=*) ;;
      *) continue ;;
    esac
    key="${line%%=*}"
    val="${line#*=}"
    # trim key
    key="$(printf '%s' "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    case "$key" in
      ''|*[!A-Za-z0-9_]*) continue ;;
    esac
    val="$(printf '%s' "$val" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    # strip one layer of matching quotes
    if [ "${#val}" -ge 2 ]; then
      first="${val%"${val#?}"}"
      last="${val#"${val%?}"}"
      if [ "$first" = '"' ] && [ "$last" = '"' ]; then
        val="${val#\"}"
        val="${val%\"}"
      elif [ "$first" = "'" ] && [ "$last" = "'" ]; then
        val="${val#\'}"
        val="${val%\'}"
      fi
    fi
    export "$key=$val"
  done < "$f"
  return 0
}

echo "4) Loading .env + starting API on port $PORT..."
load_dotenv "$API_DIR/.env" || true
export PORT="$PORT"
export NODE_ENV=production
# Cap heap so CloudLinux LVE OOM-kills less often during Prisma/SMTP boot
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=192}"
# Prefer 127.0.0.1 over localhost (Prisma IPv6 / P1001 on cPanel) — bash only (sed | breaks on localhost|::1)
if [ -n "${DATABASE_URL:-}" ]; then
  FIXED_URL="$DATABASE_URL"
  case "$FIXED_URL" in
    *@localhost:*)
      FIXED_URL="${FIXED_URL/@localhost:/@127.0.0.1:}"
      export DATABASE_URL="$FIXED_URL"
      echo "DATABASE_URL host rewritten localhost → 127.0.0.1" | tee -a "$LOG"
      ;;
    *@[::1]:*)
      FIXED_URL="${FIXED_URL/@[::1]:/@127.0.0.1:}"
      export DATABASE_URL="$FIXED_URL"
      echo "DATABASE_URL host rewritten [::1] → 127.0.0.1" | tee -a "$LOG"
      ;;
  esac
  # LVE-safe Prisma pool (append only when connection_limit missing)
  case "$DATABASE_URL" in
    *connection_limit=*) ;;
    *\?*)
      export DATABASE_URL="${DATABASE_URL}&connection_limit=1&connect_timeout=10"
      echo "DATABASE_URL appended connection_limit=1&connect_timeout=10" | tee -a "$LOG"
      ;;
    *)
      export DATABASE_URL="${DATABASE_URL}?connection_limit=1&connect_timeout=10"
      echo "DATABASE_URL appended ?connection_limit=1&connect_timeout=10" | tee -a "$LOG"
      ;;
  esac
fi
# Masked sanity check (no password printed)
if [ -n "${DATABASE_URL:-}" ]; then
  DB_USER="$(printf '%s' "$DATABASE_URL" | sed -n 's|^mysql://\([^:/]*\):.*|\1|p')"
  DB_HOST="$(printf '%s' "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\):.*|\1|p')"
  echo "DATABASE_URL loaded; user=${DB_USER:-?} host=${DB_HOST:-?}" | tee -a "$LOG"
  case "$DB_USER" in
    digitals_clinicuser) echo "OK: MySQL user matches digitals_clinicuser" | tee -a "$LOG" ;;
    cognitom*|cognitos*)
      echo "FATAL WARN: OLD cognitos/aderalabs MySQL user — do NOT use for workee" | tee -a "$LOG"
      ;;
    *) echo "WARN: expected digitals_clinicuser — got '${DB_USER:-empty}'" | tee -a "$LOG" ;;
  esac
else
  echo "WARN: DATABASE_URL empty after .env load" | tee -a "$LOG"
fi

# Skip blocking SMTP verify on boot (bootstrap default); listen ASAP
export SKIP_SMTP_VERIFY="${SKIP_SMTP_VERIFY:-1}"

nohup node dist/bootstrap.js >> "$LOG" 2>&1 &
PID=$!
echo "started pid=$PID NODE_OPTIONS=$NODE_OPTIONS" | tee -a "$LOG"

# Wait longer — LVE / cold Prisma can take >6s before listen
echo "5) Waiting for listen (up to ~25s)..."
HEALTHY=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 2
  # Detect OOM kill early
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "FATAL: pid $PID died (often CloudLinux LVE 'Killed')" | tee -a "$LOG"
    grep -E 'Killed|PANIC|timer has gone away|Can.t reach database' "$LOG" | tail -n 20 || true
    tail -n 40 "$LOG"
    exit 1
  fi
  RESP=$(curl -s --max-time 3 "http://127.0.0.1:$PORT/api/leads/features" 2>/dev/null || true)
  if echo "$RESP" | grep -q '"features"' && ! echo "$RESP" | grep -q 'php-fallback'; then
    HEALTHY=1
    break
  fi
done

echo "6) Health check..."
if [ "$HEALTHY" = "1" ]; then
  echo "$RESP" | head -c 300
  echo ""
  echo "SUCCESS: Node API is live on $PORT pid=$PID"
  echo "$(date -Iseconds) SUCCESS pid=$PID" >> "$LOG"
  exit 0
fi

echo "WARN: API not healthy yet — last log lines:"
tail -n 50 "$LOG"
echo "Also check: $API_DIR/logs/startup.log"
# Flag Killed / Prisma panic for operators
if grep -q 'Killed' "$LOG" 2>/dev/null; then
  echo "HINT: saw 'Killed' — LVE OOM. Kill all node, raise LVE, or keep NODE_OPTIONS=192 and retry."
fi
if grep -qi 'timer has gone away\|PANIC' "$API_DIR/logs/startup.log" 2>/dev/null; then
  echo "HINT: Prisma panic in startup.log — use 127.0.0.1 DB host; API should still listen after bootstrap fix."
fi
exit 1

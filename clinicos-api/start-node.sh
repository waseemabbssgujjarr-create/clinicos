#!/bin/bash
# start-node.sh — full API on port 3002 (cPanel Cron / manual start)
# Cron every 5 min:
#   /bin/bash /home/digitals/doctorsmyagency.com/clinicos-api/start-node.sh

API_DIR="/home/digitals/doctorsmyagency.com/clinicos-api"
# cPanel may create venv under clinicos-api OR under the domain folder
ACTIVATE=""
for cand in \
  "/home/digitals/nodevenv/doctorsmyagency.com/clinicos-api/20/bin/activate" \
  "/home/digitals/nodevenv/doctorsmyagency.com/20/bin/activate" \
  "/home/digitals/nodevenv/doctorsmyagency.com/clinicos-api/24/bin/activate" \
  "/home/digitals/nodevenv/doctorsmyagency.com/24/bin/activate"
do
  if [ -f "$cand" ]; then
    ACTIVATE="$cand"
    break
  fi
done
LOG="$API_DIR/logs/cron.log"
BOOT_FILE="dist/bootstrap.js"
PORT=3002
ENV_FILE="$API_DIR/.env"
BOOT_MARK="$API_DIR/logs/boot-time.txt"

mkdir -p "$API_DIR/logs"
echo "$(date -Iseconds) start-node.sh run" >> "$LOG"

# Strip Windows CRLF from .env (breaks PORT/APP_URL) and export for Node
if [ -f "$ENV_FILE" ]; then
  sed -i 's/\r$//' "$ENV_FILE" 2>/dev/null || true
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in ''|\#*) continue ;; esac
    case "$line" in *=*) ;; *) continue ;; esac
    key="${line%%=*}"
    val="${line#*=}"
    # Pure-bash trim — sed would break on values containing '/' (URLs, DSNs, secrets)
    key="${key#"${key%%[! ]*}"}"   # ltrim
    key="${key%"${key##*[! ]}"}"   # rtrim
    case "$key" in ''|*[!A-Za-z0-9_]*) continue ;; esac
    val="${val#"${val%%[! ]*}"}"   # ltrim
    val="${val%"${val##*[! ]}"}"   # rtrim
    if [ "${#val}" -ge 2 ]; then
      first="${val%"${val#?}"}"
      last="${val#"${val%?}"}"
      if [ "$first" = '"' ] && [ "$last" = '"' ]; then val="${val#\"}"; val="${val%\"}"
      elif [ "$first" = "'" ] && [ "$last" = "'" ]; then val="${val#\'}"; val="${val%\'}"
      fi
    fi
    export "$key=$val"
  done < "$ENV_FILE"
  echo "$(date -Iseconds) exported .env (DATABASE_URL set=$( [ -n "$DATABASE_URL" ] && echo yes || echo no ))" >> "$LOG"
fi

FORCE_RESTART=0
if [ -f "$API_DIR/logs/force-restart" ]; then
  FORCE_RESTART=1
  rm -f "$API_DIR/logs/force-restart"
  echo "$(date -Iseconds) force-restart flag set" >> "$LOG"
elif [ -f "$ENV_FILE" ] && [ -f "$BOOT_MARK" ] && [ "$ENV_FILE" -nt "$BOOT_MARK" ]; then
  FORCE_RESTART=1
  echo "$(date -Iseconds) .env changed since last boot — restarting" >> "$LOG"
elif [ -f "$BOOT_MARK" ]; then
  for f in \
    "$API_DIR/dist/app.js" \
    "$API_DIR/dist/bootstrap.js" \
    "$API_DIR/dist/controllers/staff.controller.js" \
    "$API_DIR/dist/controllers/superadmin.controller.js" \
    "$API_DIR/dist/routes/superadmin.routes.js"
  do
    if [ -f "$f" ] && [ "$f" -nt "$BOOT_MARK" ]; then
      FORCE_RESTART=1
      echo "$(date -Iseconds) code updated since boot: $f" >> "$LOG"
      break
    fi
  done
fi

if [ "$FORCE_RESTART" -eq 0 ] && command -v curl >/dev/null 2>&1; then
  RESP=$(curl -s --max-time 3 "http://127.0.0.1:$PORT/api/leads/features" 2>/dev/null)
  if echo "$RESP" | grep -q '"features"' && ! echo "$RESP" | grep -q 'php-fallback'; then
    echo "$(date -Iseconds) full API OK on port $PORT" >> "$LOG"
    exit 0
  fi
fi

# Kill only this app's bootstrap + :3002 — never pkill all node (nproc / other apps)
pkill -9 -u digitals -f "doctorsmyagency.com/clinicos-api.*bootstrap" 2>/dev/null || true
pkill -9 -u digitals -f "clinicos-api/dist/bootstrap" 2>/dev/null || true
fuser -k 3002/tcp 2>/dev/null || true
sleep 2

if [ ! -f "$API_DIR/$BOOT_FILE" ]; then
  echo "$(date -Iseconds) FATAL: $BOOT_FILE missing" >> "$LOG"
  exit 1
fi

cd "$API_DIR" || exit 1
export PORT=3002
export NODE_ENV=production

NODE_BIN=""
NPM_BIN=""
NPX_BIN=""

if [ -n "$ACTIVATE" ] && [ -f "$ACTIVATE" ]; then
  # shellcheck disable=SC1090
  source "$ACTIVATE"
  NODE_BIN="$(command -v node)"
  NPM_BIN="$(command -v npm)"
  NPX_BIN="$(command -v npx)"
  echo "$(date -Iseconds) activated: $ACTIVATE node=$NODE_BIN" >> "$LOG"
else
  echo "$(date -Iseconds) WARN: no nodevenv activate found — trying PATH node" >> "$LOG"
fi

if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then
  NODE_BIN="$(command -v node 2>/dev/null || true)"
fi

if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then
  for nb in \
    /home/digitals/nodevenv/doctorsmyagency.com/20/bin/node \
    /home/digitals/nodevenv/doctorsmyagency.com/clinicos-api/20/bin/node \
    /home/digitals/nodevenv/doctorsmyagency.com/24/bin/node
  do
    if [ -x "$nb" ]; then NODE_BIN="$nb"; break; fi
  done
fi

if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then
  echo "$(date -Iseconds) FATAL: node not found — fix Node app / activate venv" >> "$LOG"
  exit 1
fi
command -v npm >/dev/null 2>&1 && NPM_BIN="$(command -v npm)"
command -v npx >/dev/null 2>&1 && NPX_BIN="$(command -v npx)"
if [ ! -d "$API_DIR/node_modules/dotenv" ] || [ ! -d "$API_DIR/node_modules/express" ]; then
  echo "$(date -Iseconds) node_modules missing — npm install" >> "$LOG"
  (cd "$API_DIR" && npm install --omit=dev >> "$LOG" 2>&1) || {
    echo "$(date -Iseconds) npm install FAILED" >> "$LOG"
    exit 1
  }
fi

if [ ! -f "$API_DIR/generated/prisma/index.js" ] && [ ! -f "$API_DIR/node_modules/.prisma/client/index.js" ]; then
  echo "$(date -Iseconds) prisma client missing — npx prisma generate" >> "$LOG"
  (cd "$API_DIR" && npx prisma generate >> "$LOG" 2>&1) || true
fi

# Ensure PORT in environment wins over .env Passenger socket paths
export PORT=3002
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=192}"
export SKIP_SMTP_VERIFY="${SKIP_SMTP_VERIFY:-1}"
if [ -n "${DATABASE_URL:-}" ]; then
  # Replace @localhost or @[::1] with @127.0.0.1 using pure bash — no sed.
  # sed -E with the 'I' (case-insensitive) flag is a GNU extension not available
  # on all cPanel hosts and causes: unknown option to 's'
  _dbu="${DATABASE_URL}"
  case "$_dbu" in
    *@localhost:*)   _dbu="${_dbu%%@localhost:*}@127.0.0.1:${_dbu##*@localhost:}" ;;
    *@localhost/*)   _dbu="${_dbu%%@localhost/*}@127.0.0.1/${_dbu##*@localhost/}" ;;
    *@localhost)     _dbu="${_dbu%%@localhost}@127.0.0.1" ;;
    *'@[::1]:'*)     _dbu="${_dbu%%@\[::1\]:*}@127.0.0.1:${_dbu##*@\[::1\]:}" ;;
  esac
  export DATABASE_URL="$_dbu"
  unset _dbu
fi
nohup "$NODE_BIN" "$API_DIR/dist/bootstrap.js" >> "$LOG" 2>&1 &
PID=$!
echo "$(date -Iseconds) started full API on port $PORT pid=$PID NODE_OPTIONS=$NODE_OPTIONS" >> "$LOG"
sleep 12

if command -v curl >/dev/null 2>&1; then
  RESP=$(curl -s --max-time 5 "http://127.0.0.1:$PORT/api/leads/features" 2>/dev/null)
  if echo "$RESP" | grep -q '"features"' && ! echo "$RESP" | grep -q 'php-fallback'; then
    touch "$BOOT_MARK"
    echo "$(date -Iseconds) SUCCESS: full API on $PORT" >> "$LOG"
  else
    echo "$(date -Iseconds) WARN: API not responding yet — check startup.log / cron.log" >> "$LOG"
    echo "$(date -Iseconds) response: ${RESP:0:200}" >> "$LOG"
  fi
fi

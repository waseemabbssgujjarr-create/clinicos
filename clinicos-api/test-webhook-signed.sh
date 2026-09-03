#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# test-webhook-signed.sh
# Signed HMAC-SHA256 webhook test for the DMA inbound message pipeline.
#
# Run on the Hostinger terminal (inside the clinicos-api directory):
#   bash test-webhook-signed.sh
#
# What it does:
#   1. POSTs a realistic WhatsApp inbound message payload to localhost:3002
#   2. Signs it with the real META_APP_SECRET from .env
#   3. Uses the exact phoneNumberId (758204954052103) for your connected WABA
#   4. Verifies the response is "EVENT_RECEIVED"
#   5. Prints the last 40 lines of combined.log so you can see all diagnostic lines
# ─────────────────────────────────────────────────────────────────────────────

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load META_APP_SECRET from .env
if [ -f "$SCRIPT_DIR/.env" ]; then
    export $(grep -E '^META_APP_SECRET=' "$SCRIPT_DIR/.env" | xargs)
fi

if [ -z "$META_APP_SECRET" ]; then
    echo "ERROR: META_APP_SECRET not found in .env"
    echo "Set META_APP_SECRET in $SCRIPT_DIR/.env and retry."
    exit 1
fi

# ── Payload — real-looking inbound text message ───────────────────────────────
# phoneNumberId 758204954052103 matches your connected WABA (+92 311 4522101)
# wabaId        7578723405035399 matches your WABA
PAYLOAD='{"object":"whatsapp_business_account","entry":[{"id":"7578723405035399","changes":[{"field":"messages","value":{"messaging_product":"whatsapp","metadata":{"display_phone_number":"+92 311 4522101","phone_number_id":"758204954052103"},"messages":[{"id":"wamid.test_'$(date +%s)'","from":"923001234567","timestamp":"'$(date +%s)'","type":"text","text":{"body":"Hello, what are your consultation fees?"}}]}}]}]}'

# ── HMAC-SHA256 signature ─────────────────────────────────────────────────────
SIG="sha256=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$META_APP_SECRET" | sed 's/^.*= //')"

echo "────────────────────────────────────────"
echo "Payload length : ${#PAYLOAD} bytes"
echo "Signature prefix: ${SIG:0:20}..."
echo "────────────────────────────────────────"
echo ""

# ── POST to localhost:3002 ────────────────────────────────────────────────────
echo "Sending signed request to http://127.0.0.1:3002/api/webhooks/meta ..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST "http://127.0.0.1:3002/api/webhooks/meta" \
    -H "Content-Type: application/json" \
    -H "X-Hub-Signature-256: $SIG" \
    -d "$PAYLOAD" 2>&1)

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_STATUS:")

echo "HTTP Status : $HTTP_STATUS"
echo "Response    : $BODY"
echo ""

if [ "$BODY" = "EVENT_RECEIVED" ] && [ "$HTTP_STATUS" = "200" ]; then
    echo "✓ HMAC passed — webhook accepted the request"
else
    echo "✗ Unexpected response — check logs below"
fi

echo ""
echo "── Last 50 lines of combined.log ────────────────────────────────────────"
LOG_FILE="$SCRIPT_DIR/logs/combined.log"
if [ -f "$LOG_FILE" ]; then
    tail -50 "$LOG_FILE"
else
    echo "(log file not found at $LOG_FILE)"
fi

echo ""
echo "── What to look for ─────────────────────────────────────────────────────"
echo "  META_WEBHOOK_POST_RECEIVED     — webhook was reached"
echo "  META_WEBHOOK_HMAC_VALID        — signature verified  ← critical"
echo "  META_WEBHOOK_MESSAGE_RECEIVED  — message extracted"
echo "  META_WEBHOOK_CLINIC_RESOLVED   — phoneNumberId matched a clinic"
echo "  META_WEBHOOK_PROCESSING_MESSAGE aiEnabled:true — AI will reply"
echo "  META_WEBHOOK_SENDING_REPLY     — AI response queued for send"
echo "  META_WEBHOOK_MESSAGE_PROCESSED — done"
echo ""
echo "If META_WEBHOOK_HMAC_FAILED: verify META_APP_SECRET in .env matches"
echo "  Meta Developer Dashboard → App ID 1381753247172965 → App Settings → App Secret"
echo ""
echo "If META_WEBHOOK_NO_CLINIC_FOR_PHONE_NUMBER_ID: run the DB check:"
echo "  mysql -u digitals_doctoruser -p digitals_doctordb \\"
echo "    -e \"SELECT id,clinicId,phoneNumberId,connectionStatus FROM ClinicWhatsAppConnection;\""
echo ""
echo "If aiEnabled=0 causes generic reply:"
echo "  mysql -u digitals_doctoruser -p digitals_doctordb \\"
echo "    -e \"UPDATE Clinic SET aiEnabled=1 WHERE planStatus NOT IN ('CANCELLED','PAST_DUE');\""

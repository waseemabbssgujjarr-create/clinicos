<?php
/**
 * WhatsApp webhook — IQ Pigeon (Clinicos bridge compatible).
 *
 * GET: Meta hub.verify handshake.
 * POST: mark read + ingest first, ack Meta, then reply after a short quiet wait.
 */

require_once __DIR__ . '/../config.php';

if (!function_exists('meta_webhook_verify_ok')) {
    $domainFile = __DIR__ . '/../includes/domain.php';
    if (is_readable($domainFile)) {
        require_once $domainFile;
    }
}

if (!function_exists('meta_webhook_verify_ok')) {
    function meta_webhook_verify_ok(string $token): bool
    {
        if ($token === '') {
            return false;
        }
        foreach (['WEBHOOK_VERIFY_TOKEN', 'WHATSAPP_VERIFY_TOKEN'] as $name) {
            if (!defined($name)) {
                continue;
            }
            $expected = trim((string) constant($name));
            if ($expected !== '' && hash_equals($expected, $token)) {
                return true;
            }
        }

        return false;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $mode = $_GET['hub_mode'] ?? $_GET['hub.mode'] ?? '';
    $token = $_GET['hub_verify_token'] ?? $_GET['hub.verify_token'] ?? '';
    $challenge = $_GET['hub_challenge'] ?? $_GET['hub.challenge'] ?? '';

    if ($mode === 'subscribe' && meta_webhook_verify_ok($token)) {
        http_response_code(200);
        header('Content-Type: text/plain; charset=utf-8');
        echo $challenge;
        exit;
    }

    if ($mode === '' && $token === '' && $challenge === '') {
        header('Content-Type: text/plain; charset=utf-8');
        http_response_code(200);
        echo 'WhatsApp webhook is online. Meta verifies with hub.mode=subscribe — opening this URL in a browser is normal.';
        exit;
    }

    http_response_code(403);
    exit;
}

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/whatsapp.php';
require_once __DIR__ . '/../includes/whatsapp-webhook-log.php';
require_once __DIR__ . '/../includes/whatsapp-inbound.php';
require_once __DIR__ . '/../includes/whatsapp-token.php';
require_once __DIR__ . '/../includes/whatsapp-oauth.php';
require_once __DIR__ . '/../includes/whatsapp-reply-debug-log.php';

function wa_webhook_log(string $message, array $context = []): void
{
    whatsapp_webhook_log_event($message, $context);
    if (function_exists('whatsapp_reply_debug_log')) {
        whatsapp_reply_debug_log('webhook:' . $message, $context);
    }
}

$payload = file_get_contents('php://input') ?: '';
$signature = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? null;
$isDiagnosePost = isset($_SERVER['HTTP_X_AILEADS_DIAGNOSE']) || isset($_SERVER['HTTP_X_AILEADS-DIAGNOSE']);

whatsapp_webhook_log_event($isDiagnosePost ? 'POST received (diagnose self-test)' : 'POST received (meta)', [
    'bytes'      => strlen($payload),
    'has_sig'    => $signature !== null && $signature !== '',
    'user_agent' => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 80),
]);

if (!verify_meta_signature($payload, $signature)) {
    $secret = whatsapp_meta_app_secret();
    $hint = ($secret === '' || $secret === 'your_app_secret')
        ? 'Meta App Secret is missing — set it in Admin → Integrations'
        : 'Meta App Secret does not match Meta App → Settings → Basic';
    whatsapp_webhook_log_event('REJECTED invalid signature', ['hint' => $hint]);
    http_response_code(403);
    exit;
}

@set_time_limit(25);
ignore_user_abort(true);

$turnEngineOk = false;
try {
    require_once __DIR__ . '/../includes/conversation-turn-engine.php';
    $turnEngineOk = function_exists('turn_engine_ingest');
} catch (Throwable $e) {
    wa_webhook_log('Turn engine include failed', ['error' => $e->getMessage()]);
}

$data = json_decode($payload, true);
if (!$data || empty($data['entry'])) {
    http_response_code(200);
    echo 'OK';
    exit;
}

/** @var array<int, array{bot: array<string, mixed>, phone_id: string, token: string, lead_ids: array<int, int>}> $jobs */
$jobs = [];

foreach ($data['entry'] as $entry) {
    foreach ($entry['changes'] ?? [] as $change) {
        $field = (string) ($change['field'] ?? '');
        $value = $change['value'] ?? [];
        $phoneId = (string) ($value['metadata']['phone_number_id'] ?? '');
        $messages = $value['messages'] ?? [];

        if (in_array($field, ['history', 'smb_app_state_sync', 'smb_message_echoes', 'account_update'], true)) {
            wa_webhook_log('Coexistence webhook received', ['field' => $field, 'phone_id' => $phoneId]);
            continue;
        }

        if ($phoneId === '' || $messages === []) {
            continue;
        }

        wa_webhook_log('Inbound message for phone_id=' . $phoneId, ['count' => count($messages)]);

        $bot = bot_resolve_by_whatsapp_phone_id($phoneId);
        if (!$bot) {
            wa_webhook_log('No active bot matched phone_id=' . $phoneId);
            continue;
        }

        $token = bot_whatsapp_token_plain((string) ($bot['whatsapp_token'] ?? ''));
        if ($token === false || $token === '') {
            wa_webhook_log('Could not decrypt WhatsApp token for bot #' . (int) $bot['id']);
            whatsapp_mark_token_failure((int) $bot['id'], 'Could not read saved token — reconnect in Bot Setup.');
            continue;
        }

        bot_whatsapp_heal_connection((int) $bot['id']);

        $contacts = $value['contacts'] ?? [];
        $contactNames = [];
        foreach ($contacts as $contact) {
            $waId = (string) ($contact['wa_id'] ?? '');
            if ($waId !== '') {
                $contactNames[$waId] = (string) ($contact['profile']['name'] ?? 'WhatsApp Lead');
            }
        }

        $jobKey = $phoneId . ':' . (int) $bot['id'];
        if (!isset($jobs[$jobKey])) {
            $jobs[$jobKey] = [
                'bot'      => $bot,
                'phone_id' => $phoneId,
                'token'    => $token,
                'lead_ids' => [],
            ];
        }

        foreach ($messages as $msg) {
            $senderPhone = (string) ($msg['from'] ?? '');
            if ($senderPhone === '') {
                continue;
            }

            $msgType = (string) ($msg['type'] ?? '');
            if (!in_array($msgType, ['text', 'audio', 'image', 'video', 'document', 'sticker', 'location', 'contacts', 'interactive', 'order'], true)) {
                wa_webhook_log('Skipped unsupported message type=' . ($msgType !== '' ? $msgType : 'unknown'));
                continue;
            }

            $contactName = $contactNames[$senderPhone] ?? 'WhatsApp Lead';
            $waId = trim((string) ($msg['id'] ?? ''));
            if ($waId !== '') {
                $readOk = whatsapp_mark_message_read($phoneId, $token, $waId);
                wa_webhook_log('Mark read attempted', [
                    'wa_id' => $waId,
                    'ok'    => $readOk,
                ]);
            } else {
                wa_webhook_log('Mark read skipped — empty message id', [
                    'from' => $senderPhone,
                    'type' => $msgType,
                ]);
            }

            if (!$turnEngineOk) {
                wa_webhook_log('Turn engine unavailable — cannot buffer inbound', [
                    'from' => $senderPhone,
                    'type' => $msgType,
                ]);
                continue;
            }

            try {
                $result = turn_engine_ingest($bot, $phoneId, $token, $senderPhone, $msg, $contactName);
            } catch (Throwable $e) {
                wa_webhook_log('Turn ingest exception', ['error' => $e->getMessage(), 'from' => $senderPhone]);
                continue;
            }

            if (!empty($result['duplicate'])) {
                // First request often dies after insert; retry must still send if nobody replied yet.
                $dupLead = (int) ($result['lead_id'] ?? 0);
                $stillOpen = $dupLead > 0 && function_exists('turn_engine_customer_awaiting_reply')
                    && turn_engine_customer_awaiting_reply($dupLead)
                    && !(function_exists('turn_engine_lead_just_got_reply') && turn_engine_lead_just_got_reply($dupLead, 20));
                if ($stillOpen) {
                    $jobs[$jobKey]['lead_ids'][$dupLead] = $dupLead;
                    wa_webhook_log('DUPLICATE_REQUEUE_SEND', [
                        'wa_id'   => $msg['id'] ?? '',
                        'lead_id' => $dupLead,
                    ]);
                } else {
                    wa_webhook_log('DUPLICATE_EVENT_IGNORED', ['wa_id' => $msg['id'] ?? '']);
                }
                continue;
            }

            if (empty($result['success'])) {
                wa_webhook_log('Turn ingest failed', [
                    'error' => $result['error'] ?? 'unknown',
                    'from'  => $senderPhone,
                    'type'  => $msgType,
                ]);
                continue;
            }

            if (!empty($result['lead_id'])) {
                $jobs[$jobKey]['lead_ids'][(int) $result['lead_id']] = (int) $result['lead_id'];
            }

            wa_webhook_log('Message buffered for turn', [
                'turn_id'  => $result['turn_id'] ?? null,
                'lead_id'  => $result['lead_id'] ?? null,
                'type'     => $msgType,
                'wa_id'    => $msg['id'] ?? '',
            ]);
        }
    }
}

// Live evidence (2026-08-24): recover sent turn 475 in 884ms. Webhook read+OK then
// died before send. Reply MUST happen before Meta ACK on this host.
foreach ($jobs as $job) {
    $leadIds = array_values($job['lead_ids']);
    if ($leadIds === []) {
        continue;
    }
    wa_webhook_log('Inline send before Meta ACK', ['leads' => $leadIds]);
    try {
        $sentNow = turn_engine_send_leads_now($leadIds, $job['bot'], $job['phone_id'], $job['token']);
        wa_webhook_log('Inline send result', $sentNow);
    } catch (Throwable $e) {
        wa_webhook_log('Inline send failed', ['error' => $e->getMessage(), 'leads' => $leadIds]);
        try {
            foreach ($leadIds as $leadId) {
                turn_engine_finalize_webhook_leads([$leadId], $job['bot'], $job['phone_id'], $job['token']);
            }
        } catch (Throwable $ignored) {
        }
    }
    if (function_exists('turn_engine_dispatch_worker')) {
        turn_engine_dispatch_worker($leadIds);
    }
}

http_response_code(200);
header('Content-Type: text/plain; charset=utf-8');
echo 'OK';
while (ob_get_level() > 0) {
    @ob_end_flush();
}
@flush();


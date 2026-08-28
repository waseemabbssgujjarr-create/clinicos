<?php
/**
 * Lightweight turn worker — no heavy turn_engine_process_turn (avoids cPanel 503).
 *
 * GET  ?key=...           — health (instant JSON, no heavy includes)
 * GET  ?key=...&run=1     — repair + lite auto-reply for due leads
 * POST {"key":"...","lead_ids":[102]} — async worker from webhook
 */
declare(strict_types=1);

require_once __DIR__ . '/../config.php';
ignore_user_abort(true);
@set_time_limit(120);

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/turn-schema-lite.php';
require_once __DIR__ . '/../includes/wa-recover-lite.php';

$input = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($input)) {
    $input = [];
}

$key = (string) ($input['key'] ?? $_GET['key'] ?? '');
$expected = defined('CRON_SECRET') ? (string) CRON_SECRET : '';

if ($expected === '' || !hash_equals($expected, $key)) {
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => 'Unauthorized'], JSON_UNESCAPED_UNICODE);
    exit;
}

$leadIds = $input['lead_ids'] ?? [];
if (!is_array($leadIds)) {
    $leadIds = [];
}
$leadIds = array_values(array_unique(array_filter(array_map('intval', $leadIds))));

$botId = (int) ($input['bot_id'] ?? $_GET['bot_id'] ?? 0);

function turn_worker_turn_counts(): array
{
    turn_schema_lite_ensure();

    $buffering = db_fetch('SELECT COUNT(*) AS c FROM conversation_turns WHERE status = \'buffering\'', '', []);
    $due = db_fetch(
        'SELECT COUNT(*) AS c FROM conversation_turns WHERE status = \'buffering\' AND finalize_after <= NOW()',
        '',
        []
    );
    $cancelled = db_fetch(
        'SELECT COUNT(*) AS c FROM conversation_turns WHERE status = \'cancelled\'',
        '',
        []
    );
    $needsReply = db_fetch(
        'SELECT COUNT(DISTINCT t.lead_id) AS c FROM conversation_turns t
         WHERE NOT EXISTS (
            SELECT 1 FROM conversation_turn_events e
            WHERE e.turn_id = t.id AND e.event_type = \'RESPONSE_SENT\'
         )
         AND EXISTS (SELECT 1 FROM conversation_turn_messages ctm WHERE ctm.turn_id = t.id)',
        '',
        []
    );

    return [
        'buffering'    => (int) ($buffering['c'] ?? 0),
        'due'          => (int) ($due['c'] ?? 0),
        'cancelled'    => (int) ($cancelled['c'] ?? 0),
        'needs_reply'  => (int) ($needsReply['c'] ?? 0),
        'processing'   => (int) (db_fetch('SELECT COUNT(*) AS c FROM conversation_turns WHERE status = \'processing\'', '', [])['c'] ?? 0),
    ];
}

$runNow = $_SERVER['REQUEST_METHOD'] === 'POST'
    || (($_GET['run'] ?? '') === '1' || ($_GET['run'] ?? '') === 'true');

if ($_SERVER['REQUEST_METHOD'] === 'GET' && !$runNow) {
    header('Content-Type: application/json; charset=utf-8');
    $payload = [
        'success'         => true,
        'health'          => 'ok',
        'lite'            => true,
        'time'            => date('c'),
        'turns'           => turn_worker_turn_counts(),
        'app_url'         => defined('APP_URL') ? APP_URL : null,
        'cron_secret_set' => $expected !== '',
        'hint'            => 'Add &run=1 to process stuck turns (lite path, no 503).',
    ];
    if (($_GET['debug'] ?? '') === '1') {
        $root = dirname(__DIR__);
        $recover = is_readable($root . '/includes/wa-recover-lite.php')
            ? (string) file_get_contents($root . '/includes/wa-recover-lite.php')
            : '';
        $webhook = is_readable($root . '/api/whatsapp-webhook.php')
            ? (string) file_get_contents($root . '/api/whatsapp-webhook.php')
            : '';
        $engine = is_readable($root . '/includes/conversation-turn-engine.php')
            ? (string) file_get_contents($root . '/includes/conversation-turn-engine.php')
            : '';
        $core = is_readable($root . '/includes/whatsapp-auto-reply-core.php')
            ? (string) file_get_contents($root . '/includes/whatsapp-auto-reply-core.php')
            : '';
        $waitFn = strpos($engine, 'function turn_engine_webhook_wait_quiet');
        $waitSrc = $waitFn !== false ? substr($engine, $waitFn, 900) : '';
        $payload['debug'] = [
            'files' => [
                'webhook_mtime'            => is_file($root . '/api/whatsapp-webhook.php')
                    ? date('c', (int) filemtime($root . '/api/whatsapp-webhook.php'))
                    : null,
                'engine_mtime'             => is_file($root . '/includes/conversation-turn-engine.php')
                    ? date('c', (int) filemtime($root . '/includes/conversation-turn-engine.php'))
                    : null,
                'core_mtime'               => is_file($root . '/includes/whatsapp-auto-reply-core.php')
                    ? date('c', (int) filemtime($root . '/includes/whatsapp-auto-reply-core.php'))
                    : null,
                'recover_mtime'            => is_file($root . '/includes/wa-recover-lite.php')
                    ? date('c', (int) filemtime($root . '/includes/wa-recover-lite.php'))
                    : null,
                'already_replied_per_turn' => str_contains($recover, 'no unanswered inbound turn'),
                'webhook_dup_not_requeued' => str_contains($webhook, 'DUPLICATE_REQUEUE_SEND'),
                'short_quiet_wait'         => str_contains($engine, '$maxWaitMs = 8000'),
                'wait_quiet_no_typing'     => str_contains($waitSrc, 'Silent wait')
                    && !str_contains($waitSrc, 'whatsapp_send_typing_indicator'),
                'webhook_openai'           => str_contains($core, "'path' => 'webhook_openai'"),
                'webhook_mind'             => str_contains($core, 'function wa_webhook_mind_reply')
                    && str_contains($core, "'path' => 'webhook_mind'")
                    && str_contains($engine, "\$GLOBALS['wa_skip_openai'] = true"),
                'type_before_compose'      => str_contains($engine, 'whatsapp_send_typing_indicator($phoneId, $token, $waId)'),
                'webhook_instant_reply'    => str_contains($core, 'function wa_webhook_instant_reply'),
                'send_before_meta_ack'     => str_contains($webhook, 'Inline send before Meta ACK')
                    && str_contains($engine, 'function turn_engine_send_leads_now'),
            ],
        ];
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

$asyncAck = $_SERVER['REQUEST_METHOD'] === 'POST';
if ($asyncAck) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success'  => true,
        'accepted' => true,
        'lite'     => true,
        'leads'    => $leadIds,
        'time'     => date('c'),
    ], JSON_UNESCAPED_UNICODE);
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    } elseif (function_exists('litespeed_finish_request')) {
        litespeed_finish_request();
    } else {
        while (ob_get_level() > 0) {
            @ob_end_flush();
        }
        @flush();
    }
}

try {
    turn_schema_lite_ensure();

    if ($leadIds === []) {
        $leadIds = wa_recover_leads_needing_reply($botId, 30);
    }

    $leadIds = array_values(array_filter(
        $leadIds,
        static fn ($id) => !wa_recover_lead_is_live((int) $id, 20)
    ));

    foreach ($leadIds as $leadId) {
        wa_recover_repair_lead_turn($leadId);
    }

    $quietSec = wa_recover_quiet_seconds();
    db_execute(
        'UPDATE conversation_turns SET finalize_after = NOW()
         WHERE status = \'buffering\'
         AND last_message_at <= DATE_SUB(NOW(), INTERVAL ? SECOND)',
        'i',
        [$quietSec]
    );

    $limit = max(1, min(10, count($leadIds) > 0 ? count($leadIds) : 5));
    $result = wa_recover_run($botId, true, $limit);

    if ($asyncAck) {
        exit;
    }

    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success'     => true,
        'action'      => 'lite_recover',
        'lite'        => true,
        'leads'       => $leadIds,
        'sent'        => (int) ($result['sent'] ?? 0),
        'hung'        => (int) ($result['hung'] ?? 0),
        'results'     => $result['results'] ?? [],
        'turns_after' => turn_worker_turn_counts(),
        'time'        => date('c'),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('turn-worker-lite: ' . $e->getMessage());
    if ($asyncAck) {
        exit;
    }
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'lite'    => true,
        'error'   => $e->getMessage(),
        'turns'   => turn_worker_turn_counts(),
        'time'    => date('c'),
    ], JSON_UNESCAPED_UNICODE);
}

<?php
/**
 * Async turn processor — invoked fire-and-forget from the WhatsApp webhook.
 * Runs independently so cPanel cannot kill processing when the webhook returns 200.
 *
 * Auth: CRON_SECRET in JSON body or ?key= query param.
 *
 * GET  ?key=...           — health check (turn counts only)
 * GET  ?key=...&run=1     — process all due/overdue turns (browser-friendly)
 * POST {"key":"...","lead_ids":[1,2]} — process specific leads (or [] for all due)
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/whatsapp-token.php';
require_once __DIR__ . '/../includes/conversation-turn-engine.php';

@set_time_limit(300);
ignore_user_abort(true);

$input = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($input)) {
    $input = [];
}

$key = (string) ($input['key'] ?? $_GET['key'] ?? '');
$expected = defined('CRON_SECRET') ? (string) CRON_SECRET : '';

if ($expected === '' || !hash_equals($expected, $key)) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

turn_engine_ensure_schema();

function turn_worker_turn_counts(): array
{
    $buffering = db_fetch('SELECT COUNT(*) AS c FROM conversation_turns WHERE status = \'buffering\'', '', []);
    $due = db_fetch(
        'SELECT COUNT(*) AS c FROM conversation_turns WHERE status = \'buffering\' AND finalize_after <= NOW()',
        '',
        []
    );
    $processing = db_fetch('SELECT COUNT(*) AS c FROM conversation_turns WHERE status = \'processing\'', '', []);
    $stuck = db_fetch(
        'SELECT COUNT(*) AS c FROM conversation_turns
         WHERE status = \'processing\'
         AND processing_started_at IS NOT NULL
         AND processing_started_at < DATE_SUB(NOW(), INTERVAL 3 MINUTE)',
        '',
        []
    );
    $overdue = db_fetch(
        'SELECT COUNT(*) AS c FROM conversation_turns
         WHERE status = \'buffering\'
         AND finalize_after <= DATE_SUB(NOW(), INTERVAL 30 SECOND)',
        '',
        []
    );

    return [
        'buffering'   => (int) ($buffering['c'] ?? 0),
        'due'         => (int) ($due['c'] ?? 0),
        'overdue_30s' => (int) ($overdue['c'] ?? 0),
        'processing'  => (int) ($processing['c'] ?? 0),
        'stuck_3m'    => (int) ($stuck['c'] ?? 0),
    ];
}

$runNow = $_SERVER['REQUEST_METHOD'] === 'POST'
    || (($_GET['run'] ?? '') === '1' || ($_GET['run'] ?? '') === 'true');

if ($_SERVER['REQUEST_METHOD'] === 'GET' && !$runNow) {
    header('Content-Type: application/json');
    echo json_encode([
        'success'         => true,
        'health'          => 'ok',
        'time'            => date('c'),
        'turns'           => turn_worker_turn_counts(),
        'app_url'         => defined('APP_URL') ? APP_URL : null,
        'cron_secret_set' => $expected !== '',
        'hint'            => 'Add &run=1 to this URL to process stuck turns, or POST with {"key":"...","lead_ids":[]}',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$leadIds = $input['lead_ids'] ?? [];
if (!is_array($leadIds)) {
    $leadIds = [];
}
$leadIds = array_values(array_unique(array_filter(array_map('intval', $leadIds))));

try {
    $recovered = turn_engine_recover_stuck_turns(8);
    $forced = turn_engine_force_max_window_due(0);
    $forced += turn_engine_force_finalize_all_overdue(5);

    // Manual GET ?run=1 only — never shorten the 5s quiet window on live webhook workers.
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $quietSec = max(5, (int) ceil(turn_engine_constants()['text_debounce_ms'] / 1000));
        db_execute(
            'UPDATE conversation_turns SET finalize_after = NOW()
             WHERE status = \'buffering\'
             AND last_message_at <= DATE_SUB(NOW(), INTERVAL ? SECOND)',
            'i',
            [$quietSec]
        );
    }

    if ($leadIds !== []) {
        turn_engine_background_process($leadIds);
        $processed = turn_engine_process_due(30, $leadIds);
    } else {
        $processed = turn_engine_process_due(30);
    }

    header('Content-Type: application/json');
    echo json_encode([
        'success'     => true,
        'action'      => 'processed',
        'leads'       => $leadIds,
        'recovered'   => $recovered,
        'forced'      => $forced,
        'processed'   => $processed['processed'] ?? 0,
        'results'     => $processed['results'] ?? [],
        'turns_after' => turn_worker_turn_counts(),
        'time'        => date('c'),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('turn-worker: ' . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error'   => $e->getMessage(),
        'turns'   => turn_worker_turn_counts(),
        'time'    => date('c'),
    ], JSON_UNESCAPED_UNICODE);
}

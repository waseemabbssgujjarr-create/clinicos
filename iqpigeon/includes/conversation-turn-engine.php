<?php
/**
 * IQ Pigeon — Global Human-Like Conversation Turn Engine.
 * RAW WhatsApp events ≠ customer turns. One turn → one response.
 */

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/whatsapp-inbound.php';
require_once __DIR__ . '/whatsapp.php';
require_once __DIR__ . '/conversation-media.php';

/** @return array{text_debounce_ms: int, media_debounce_ms: int, max_window_ms: int, new_turn_gap_ms: int} */
function turn_engine_constants(): array
{
    $text = defined('TURN_TEXT_DEBOUNCE_MS') ? (int) TURN_TEXT_DEBOUNCE_MS : 5000;
    $media = defined('TURN_MEDIA_DEBOUNCE_MS') ? (int) TURN_MEDIA_DEBOUNCE_MS : 6000;
    $maxWin = defined('TURN_MAX_WINDOW_MS') ? (int) TURN_MAX_WINDOW_MS : 30000;

    return [
        'text_debounce_ms'  => max(5000, $text),
        'media_debounce_ms' => max(5000, min(8000, $media > 0 ? $media : 6000)),
        'max_window_ms'     => max(20000, $maxWin),
        'new_turn_gap_ms'   => defined('TURN_NEW_TURN_GAP_MS') ? (int) TURN_NEW_TURN_GAP_MS : 120000,
        'background_ms'     => defined('TURN_BACKGROUND_MS') ? (int) TURN_BACKGROUND_MS : 12000,
        'retain_per_lead'   => defined('TURN_ENGINE_RETAIN_PER_LEAD') ? (int) TURN_ENGINE_RETAIN_PER_LEAD : 15,
    ];
}

/** Seconds of silence after the last inbound bubble before we type or reply. */
function turn_engine_quiet_seconds(): int
{
    return max(5, (int) ceil(turn_engine_constants()['text_debounce_ms'] / 1000));
}

function turn_engine_turn_is_quiet(int $turnId): bool
{
    if ($turnId <= 0) {
        return false;
    }

    $row = db_fetch(
        'SELECT id FROM conversation_turns
         WHERE id = ? AND last_message_at <= DATE_SUB(NOW(), INTERVAL ? SECOND)',
        'ii',
        [$turnId, turn_engine_quiet_seconds()]
    );

    return $row !== null;
}

/**
 * True when the customer has not sent another bubble for the quiet window.
 *
 * @param array<string, mixed> $turn
 */
function turn_engine_row_is_quiet(array $turn): bool
{
    $id = (int) ($turn['id'] ?? 0);
    if ($id > 0) {
        return turn_engine_turn_is_quiet($id);
    }

    $last = strtotime((string) ($turn['last_message_at'] ?? ''));
    if ($last <= 0) {
        return false;
    }

    return (time() - $last) >= turn_engine_quiet_seconds();
}

/** SQL fragment: buffering + debounce elapsed + last bubble is quiet. */
function turn_engine_quiet_due_sql(string $alias = ''): string
{
    $p = $alias !== '' ? $alias . '.' : '';
    $sec = turn_engine_quiet_seconds();

    return $p . "status = 'buffering' AND " . $p . 'finalize_after <= NOW() AND '
        . $p . 'last_message_at <= DATE_SUB(NOW(), INTERVAL ' . $sec . ' SECOND)';
}

/** Put a turn back to buffering and wait a full quiet window from the last bubble. */
function turn_engine_rebuffer_for_quiet(int $turnId): void
{
    $sec = turn_engine_quiet_seconds();
    db_execute(
        'UPDATE conversation_turns
         SET status = \'buffering\',
             finalized_at = NULL,
             processing_started_at = NULL,
             finalize_after = DATE_ADD(last_message_at, INTERVAL ? SECOND),
             updated_at = NOW()
         WHERE id = ?',
        'ii',
        [$sec, $turnId]
    );
    turn_engine_log_event($turnId, 'TURN_REBUFFERED', ['reason' => 'wait_for_quiet']);
}

/** Milliseconds since this turn started buffering (guide §9 max window). */
function turn_engine_turn_buffer_age_ms(int $turnId): int
{
    if ($turnId <= 0) {
        return 0;
    }

    $row = db_fetch('SELECT started_at FROM conversation_turns WHERE id = ?', 'i', [$turnId]);
    if (!$row || empty($row['started_at'])) {
        return 0;
    }

    $started = strtotime((string) $row['started_at']);

    return $started > 0 ? max(0, (int) ((microtime(true) - $started) * 1000)) : 0;
}

/** True when the burst has exceeded TURN_MAX_WINDOW_MS. Never skips the quiet wait. */
function turn_engine_max_window_exceeded(int $turnId): bool
{
    $const = turn_engine_constants();
    $maxMs = max(15000, (int) $const['max_window_ms']);

    return turn_engine_turn_buffer_age_ms($turnId) >= $maxMs;
}

/** Mark long bursts due only after the customer has been quiet. */
function turn_engine_force_max_window_due(int $leadId = 0): int
{
    turn_engine_ensure_schema();
    $maxSec = max(15, (int) ceil(turn_engine_constants()['max_window_ms'] / 1000));
    $quietSec = turn_engine_quiet_seconds();

    try {
        if ($leadId > 0) {
            return db_execute(
                'UPDATE conversation_turns SET finalize_after = NOW()
                 WHERE lead_id = ? AND status = \'buffering\'
                 AND started_at <= DATE_SUB(NOW(), INTERVAL ? SECOND)
                 AND last_message_at <= DATE_SUB(NOW(), INTERVAL ? SECOND)',
                'iii',
                [$leadId, $maxSec, $quietSec]
            );
        }

        return db_execute(
            'UPDATE conversation_turns SET finalize_after = NOW()
             WHERE status = \'buffering\'
             AND started_at <= DATE_SUB(NOW(), INTERVAL ? SECOND)
             AND last_message_at <= DATE_SUB(NOW(), INTERVAL ? SECOND)',
            'ii',
            [$maxSec, $quietSec]
        );
    } catch (Throwable $e) {
        error_log('turn_engine_force_max_window_due: ' . $e->getMessage());

        return 0;
    }
}

function turn_engine_retain_limit(): int
{
    $const = turn_engine_constants();

    return max(5, (int) ($const['retain_per_lead'] ?? 15));
}

/**
 * Keep only the most recent N turns per lead (events + messages + turn row).
 */
function turn_engine_prune_old_turns(int $leadId): int
{
    turn_engine_ensure_schema();
    if ($leadId <= 0) {
        return 0;
    }

    $limit = turn_engine_retain_limit();
    $rows = db_fetch_all(
        'SELECT id FROM conversation_turns WHERE lead_id = ? ORDER BY id DESC',
        'i',
        [$leadId]
    );

    if (count($rows) <= $limit) {
        return 0;
    }

    $toDelete = array_slice($rows, $limit);
    $n = 0;

    foreach ($toDelete as $row) {
        $turnId = (int) ($row['id'] ?? 0);
        if ($turnId <= 0) {
            continue;
        }

        try {
            db_execute('DELETE FROM conversation_turn_events WHERE turn_id = ?', 'i', [$turnId]);
            db_execute('DELETE FROM conversation_turn_messages WHERE turn_id = ?', 'i', [$turnId]);
            try {
                db_execute('DELETE FROM conversation_turn_intelligence WHERE turn_id = ?', 'i', [$turnId]);
                db_execute('DELETE FROM conversation_generations WHERE turn_id = ?', 'i', [$turnId]);
            } catch (Throwable $e) {
                // tables may not exist yet on first boot
            }
            db_execute('DELETE FROM conversation_turns WHERE id = ?', 'i', [$turnId]);
            $n++;
        } catch (Throwable $e) {
            error_log('turn_engine_prune_old_turns #' . $turnId . ': ' . $e->getMessage());
        }
    }

    if ($n > 0) {
        turn_engine_log_event(0, 'TURNS_PRUNED', ['lead_id' => $leadId, 'removed' => $n, 'retain' => $limit]);
    }

    return $n;
}

function turn_engine_ensure_schema(): void
{
    static $done = false;
    if ($done) {
        return;
    }

    try {
        db_connect()->query(
            "CREATE TABLE IF NOT EXISTS conversation_turns (
                id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                lead_id                 INT NOT NULL,
                bot_id                  INT NOT NULL,
                sender_phone            VARCHAR(32) NOT NULL,
                status                  VARCHAR(24) NOT NULL DEFAULT 'buffering',
                conversation_state      VARCHAR(32) NOT NULL DEFAULT 'DISCOVERY',
                started_at              DATETIME NOT NULL,
                last_message_at         DATETIME NOT NULL,
                finalize_after          DATETIME NOT NULL,
                finalized_at            DATETIME NULL,
                message_count           INT NOT NULL DEFAULT 0,
                media_count             INT NOT NULL DEFAULT 0,
                processing_generation   INT NOT NULL DEFAULT 0,
                processing_started_at   DATETIME NULL,
                processing_completed_at DATETIME NULL,
                combined_text           MEDIUMTEXT NULL,
                ai_response_text        MEDIUMTEXT NULL,
                suppression_reason      VARCHAR(255) NULL,
                created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                KEY idx_lead_status (lead_id, status),
                KEY idx_finalize (status, finalize_after),
                KEY idx_bot_sender (bot_id, sender_phone)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        db_connect()->query(
            "CREATE TABLE IF NOT EXISTS conversation_turn_messages (
                id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                turn_id             INT UNSIGNED NOT NULL,
                wa_message_id       VARCHAR(128) NOT NULL,
                message_type        VARCHAR(24) NOT NULL DEFAULT 'text',
                raw_text            TEXT NULL,
                caption             TEXT NULL,
                media_id            VARCHAR(128) NULL,
                media_url           VARCHAR(512) NULL,
                mime_type           VARCHAR(128) NULL,
                transcription       MEDIUMTEXT NULL,
                image_description   MEDIUMTEXT NULL,
                processing_status   VARCHAR(24) NOT NULL DEFAULT 'pending',
                wa_timestamp        BIGINT NULL,
                sort_order          INT NOT NULL DEFAULT 0,
                metadata_json       JSON NULL,
                created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_wa_message (wa_message_id),
                KEY idx_turn_order (turn_id, sort_order)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        db_connect()->query(
            "CREATE TABLE IF NOT EXISTS conversation_turn_events (
                id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                turn_id     INT UNSIGNED NOT NULL,
                event_type  VARCHAR(64) NOT NULL,
                detail_json JSON NULL,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                KEY idx_turn_event (turn_id, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        db_connect()->query(
            "CREATE TABLE IF NOT EXISTS conversation_state (
                lead_id     INT NOT NULL PRIMARY KEY,
                state       VARCHAR(32) NOT NULL DEFAULT 'DISCOVERY',
                updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );
    } catch (Throwable $e) {
        error_log('turn_engine_ensure_schema: ' . $e->getMessage());
    }

    $done = true;

    require_once __DIR__ . '/conversation-intelligence.php';
    conversation_intelligence_ensure_schema();
}

function turn_engine_log_event(int $turnId, string $eventType, array $detail = []): void
{
    turn_engine_ensure_schema();
    if ($turnId < 0) {
        return;
    }

    try {
        db_insert(
            'INSERT INTO conversation_turn_events (turn_id, event_type, detail_json) VALUES (?, ?, ?)',
            'iss',
            [$turnId, $eventType, $detail !== [] ? json_encode($detail, JSON_UNESCAPED_UNICODE) : null]
        );
    } catch (Throwable $e) {
        error_log('turn_engine_log_event: ' . $e->getMessage());
    }
}

/**
 * Normalize a raw WhatsApp webhook message.
 *
 * @return array<string, mixed>
 */
function turn_engine_normalize_whatsapp_message(array $msg): array
{
    $type = (string) ($msg['type'] ?? 'unknown');
    $normalized = [
        'wa_message_id' => trim((string) ($msg['id'] ?? '')),
        'message_type'  => $type,
        'raw_text'      => null,
        'caption'       => null,
        'media_id'      => null,
        'media_url'     => null,
        'mime_type'     => null,
        'wa_timestamp'  => isset($msg['timestamp']) ? (int) $msg['timestamp'] : null,
        'metadata'      => ['original_type' => $type],
    ];

    if ($type === 'text') {
        $normalized['message_type'] = 'text';
        $normalized['raw_text'] = trim((string) ($msg['text']['body'] ?? ''));
    } elseif ($type === 'audio') {
        $normalized['message_type'] = !empty($msg['audio']['voice']) ? 'audio' : 'audio';
        $normalized['media_id'] = trim((string) ($msg['audio']['id'] ?? ''));
        $normalized['mime_type'] = trim((string) ($msg['audio']['mime_type'] ?? 'audio/ogg'));
    } elseif ($type === 'image') {
        $normalized['message_type'] = 'image';
        $normalized['media_id'] = trim((string) ($msg['image']['id'] ?? ''));
        $normalized['caption'] = trim((string) ($msg['image']['caption'] ?? ''));
        $normalized['mime_type'] = trim((string) ($msg['image']['mime_type'] ?? 'image/jpeg'));
    } elseif ($type === 'video') {
        $normalized['message_type'] = 'video';
        $normalized['media_id'] = trim((string) ($msg['video']['id'] ?? ''));
        $normalized['caption'] = trim((string) ($msg['video']['caption'] ?? ''));
    } elseif ($type === 'document') {
        $normalized['message_type'] = 'document';
        $normalized['media_id'] = trim((string) ($msg['document']['id'] ?? ''));
        $normalized['caption'] = trim((string) ($msg['document']['caption'] ?? ''));
        $normalized['mime_type'] = trim((string) ($msg['document']['mime_type'] ?? ''));
        $normalized['metadata']['filename'] = trim((string) ($msg['document']['filename'] ?? ''));
    } elseif ($type === 'sticker') {
        $normalized['message_type'] = 'text';
        $normalized['raw_text'] = '[Sticker]';
        $normalized['media_id'] = trim((string) ($msg['sticker']['id'] ?? ''));
        $normalized['metadata']['original_type'] = 'sticker';
    } elseif ($type === 'location') {
        $loc = is_array($msg['location'] ?? null) ? $msg['location'] : [];
        $name = trim((string) ($loc['name'] ?? ''));
        $address = trim((string) ($loc['address'] ?? ''));
        $lat = isset($loc['latitude']) ? (string) $loc['latitude'] : '';
        $lng = isset($loc['longitude']) ? (string) $loc['longitude'] : '';
        $label = trim(implode(', ', array_filter([$name, $address])));
        $normalized['message_type'] = 'text';
        $normalized['raw_text'] = $label !== '' ? '[Location] ' . $label : '[Location shared]';
        $normalized['metadata']['original_type'] = 'location';
        $normalized['metadata']['latitude'] = $lat;
        $normalized['metadata']['longitude'] = $lng;
    } elseif ($type === 'contacts' || $type === 'contact') {
        $contacts = $msg['contacts'] ?? [];
        $names = [];
        foreach (is_array($contacts) ? $contacts : [] as $c) {
            $n = trim((string) (($c['name']['formatted_name'] ?? '') ?: ($c['name']['first_name'] ?? '')));
            if ($n !== '') {
                $names[] = $n;
            }
        }
        $normalized['message_type'] = 'text';
        $normalized['raw_text'] = $names !== [] ? '[Contact] ' . implode(', ', $names) : '[Contact card]';
        $normalized['metadata']['original_type'] = 'contact';
    } elseif ($type === 'interactive') {
        $interactive = is_array($msg['interactive'] ?? null) ? $msg['interactive'] : [];
        $interactiveType = (string) ($interactive['type'] ?? '');
        $replyId = '';
        $replyTitle = '';

        if ($interactiveType === 'button_reply') {
            $replyId = trim((string) ($interactive['button_reply']['id'] ?? ''));
            $replyTitle = trim((string) ($interactive['button_reply']['title'] ?? ''));
        } elseif ($interactiveType === 'list_reply') {
            $replyId = trim((string) ($interactive['list_reply']['id'] ?? ''));
            $replyTitle = trim((string) ($interactive['list_reply']['title'] ?? ''));
        }

        $normalized['message_type'] = 'text';
        $normalized['metadata']['interactive_type'] = $interactiveType;
        $normalized['metadata']['interactive_id'] = $replyId;
        $normalized['metadata']['interactive_title'] = $replyTitle;

        if (preg_match('/^add_(\d+)$/i', $replyId, $m)) {
            $normalized['raw_text'] = 'add #' . $m[1];
        } elseif (preg_match('/^clear_cart$/i', $replyId)) {
            $normalized['raw_text'] = 'clear cart';
        } elseif ($replyId !== '') {
            $normalized['raw_text'] = $replyId;
        } elseif ($replyTitle !== '') {
            $normalized['raw_text'] = $replyTitle;
        } else {
            $normalized['message_type'] = 'unknown';
        }
    } else {
        $normalized['message_type'] = 'unknown';
    }

    return $normalized;
}

function turn_engine_message_is_media(string $type): bool
{
    return in_array($type, ['image', 'audio', 'video', 'document'], true);
}

function turn_engine_wa_message_exists(string $waMessageId): bool
{
    turn_engine_ensure_schema();
    $waMessageId = trim($waMessageId);
    if ($waMessageId === '') {
        return false;
    }

    $row = db_fetch(
        'SELECT id FROM conversation_turn_messages WHERE wa_message_id = ? LIMIT 1',
        's',
        [$waMessageId]
    );

    return $row !== null;
}

function turn_engine_wa_message_replied(string $waMessageId): bool
{
    turn_engine_ensure_schema();
    $waMessageId = trim($waMessageId);
    if ($waMessageId === '') {
        return false;
    }

    if (whatsapp_inbound_already_replied($waMessageId)) {
        return true;
    }

    $row = db_fetch(
        'SELECT ct.status
         FROM conversation_turn_messages ctm
         INNER JOIN conversation_turns ct ON ct.id = ctm.turn_id
         WHERE ctm.wa_message_id = ? LIMIT 1',
        's',
        [$waMessageId]
    );

    return $row !== null && (string) ($row['status'] ?? '') === 'completed';
}

function turn_engine_resolve_lead(array $bot, string $senderPhone, string $contactName): int
{
    $lead = db_fetch(
        'SELECT id FROM leads WHERE bot_id = ? AND external_id = ?',
        'is',
        [(int) $bot['id'], $senderPhone]
    );

    if ($lead) {
        return (int) $lead['id'];
    }

    if (!within_lead_limit((int) $bot['user_id'])) {
        return 0;
    }

    $leadId = db_insert(
        'INSERT INTO leads (bot_id, external_id, name, platform, status) VALUES (?, ?, ?, \'whatsapp\', \'new\')',
        'iss',
        [(int) $bot['id'], $senderPhone, $contactName]
    );

    try {
        $owner = db_fetch('SELECT email FROM users WHERE id = ?', 'i', [(int) $bot['user_id']]);
        if ($owner) {
            require_once __DIR__ . '/mailer.php';
            email_new_lead($owner['email'], $contactName, 'whatsapp');
        }
        require_once __DIR__ . '/notifications.php';
        notify_new_lead((int) $bot['id'], $contactName, 'whatsapp', $leadId);
    } catch (Throwable $e) {
        error_log('turn_engine_resolve_lead notify: ' . $e->getMessage());
    }

    return $leadId;
}

function turn_engine_customer_awaiting_reply(int $leadId): bool
{
    ensure_conversations_schema();
    $last = db_fetch(
        'SELECT role FROM conversations WHERE lead_id = ? ORDER BY id DESC LIMIT 1',
        'i',
        [$leadId]
    );

    return $last !== null && (string) ($last['role'] ?? '') === 'user';
}

function turn_engine_message_is_interruption(string $text): bool
{
    $t = mb_strtolower(trim($text));

    return preg_match('/\b(never mind|nevermind|cancel that|ignore that|forget it|stop|don\'?t bother|actually no)\b/u', $t) === 1;
}

function turn_engine_get_or_create_buffering_turn(int $leadId, int $botId, string $senderPhone, bool $hasMedia): int
{
    turn_engine_ensure_schema();
    $const = turn_engine_constants();
    $now = time();

    $buffering = db_fetch(
        'SELECT * FROM conversation_turns WHERE lead_id = ? AND status = \'buffering\' ORDER BY id DESC LIMIT 1',
        'i',
        [$leadId]
    );

    if ($buffering) {
        return (int) $buffering['id'];
    }

    // Customer sent more while we were generating — fold back into the same turn (never split mid-burst).
    $processing = db_fetch(
        'SELECT id FROM conversation_turns WHERE lead_id = ? AND status = \'processing\' ORDER BY id DESC LIMIT 1',
        'i',
        [$leadId]
    );
    if ($processing) {
        $turnId = (int) $processing['id'];
        db_execute(
            'UPDATE conversation_turns SET status = \'buffering\', processing_started_at = NULL, finalized_at = NULL,
             suppression_reason = NULL, processing_generation = processing_generation + 1 WHERE id = ?',
            'i',
            [$turnId]
        );
        require_once __DIR__ . '/conversation-intelligence.php';
        conversation_intelligence_bump_context_version($leadId);
        turn_engine_extend_buffer($turnId, $hasMedia);
        turn_engine_log_event($turnId, 'TURN_REBUFFERED', [
            'reason' => 'message_during_processing',
            'processing_generation' => turn_engine_current_processing_generation($turnId),
        ]);

        return $turnId;
    }

    // Customer still waiting for our reply — keep one continuous burst (do not split mid-conversation).
    if (turn_engine_customer_awaiting_reply($leadId)) {
        $recentOpen = db_fetch(
            'SELECT id FROM conversation_turns
             WHERE lead_id = ? AND status IN (\'processing\', \'cancelled\', \'failed\')
             AND last_message_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
             ORDER BY id DESC LIMIT 1',
            'i',
            [$leadId]
        );
        if ($recentOpen) {
            turn_engine_log_event((int) $recentOpen['id'], 'TURN_BUFFER_EXTENDED', ['reason' => 'customer_awaiting_reply']);
        }
    } else {
        $lastCompleted = db_fetch(
            'SELECT last_message_at FROM conversation_turns
             WHERE lead_id = ? AND status IN (\'completed\', \'cancelled\', \'failed\', \'human_handled\')
             ORDER BY id DESC LIMIT 1',
            'i',
            [$leadId]
        );
        if ($lastCompleted) {
            $gap = $now - strtotime((string) $lastCompleted['last_message_at']);
            if ($gap > (int) ($const['new_turn_gap_ms'] / 1000)) {
                turn_engine_log_event(0, 'TURN_CREATED', ['reason' => 'new_session_after_pause', 'gap_sec' => $gap]);
            }
        }
    }

    $debounceMs = $hasMedia ? $const['media_debounce_ms'] : $const['text_debounce_ms'];
    $debounceSec = max(5, (int) ceil($debounceMs / 1000));

    $stateRow = db_fetch('SELECT state FROM conversation_state WHERE lead_id = ?', 'i', [$leadId]);
    $state = $stateRow ? (string) $stateRow['state'] : 'DISCOVERY';

    $turnId = db_insert(
        'INSERT INTO conversation_turns
         (lead_id, bot_id, sender_phone, status, conversation_state, started_at, last_message_at, finalize_after, message_count, media_count)
         VALUES (?, ?, ?, \'buffering\', ?, NOW(), NOW(), DATE_ADD(NOW(), INTERVAL ? SECOND), 0, 0)',
        'iissi',
        [$leadId, $botId, whatsapp_normalize_sender_phone($senderPhone), $state, $debounceSec]
    );

    turn_engine_log_event($turnId, 'TURN_CREATED', ['lead_id' => $leadId]);

    return $turnId;
}

function turn_engine_extend_buffer(int $turnId, bool $hasMedia): void
{
    $const = turn_engine_constants();
    $debounceMs = $hasMedia ? (int) $const['media_debounce_ms'] : (int) $const['text_debounce_ms'];
    $debounceSec = max(5, (int) ceil(max(5000, $debounceMs) / 1000));

    // Always restart the quiet clock from this bubble. Never become due while they are still sending.
    db_execute(
        'UPDATE conversation_turns SET last_message_at = NOW(), finalize_after = DATE_ADD(NOW(), INTERVAL ? SECOND), updated_at = NOW() WHERE id = ? AND status IN (\'buffering\', \'processing\')',
        'ii',
        [$debounceSec, $turnId]
    );

    turn_engine_log_event($turnId, 'TURN_BUFFER_EXTENDED', ['debounce_ms' => $debounceMs, 'debounce_sec' => $debounceSec]);
}

/**
 * Ingest one WhatsApp message — webhook must NOT call AI from here.
 *
 * @param array<string, mixed> $bot
 * @return array{success: bool, duplicate?: bool, turn_id?: int, lead_id?: int, error?: string}
 */
function turn_engine_ingest(array $bot, string $phoneId, string $token, string $senderPhone, array $rawMsg, string $contactName = 'WhatsApp Lead'): array
{
    turn_engine_ensure_schema();
    ensure_conversations_schema();

    $normalized = turn_engine_normalize_whatsapp_message($rawMsg);
    $waId = (string) $normalized['wa_message_id'];

    if ($waId === '') {
        return ['success' => false, 'error' => 'Missing wa_message_id'];
    }

    if (turn_engine_wa_message_replied($waId)) {
        turn_engine_log_event(0, 'DUPLICATE_EVENT_IGNORED', ['wa_message_id' => $waId, 'reason' => 'already_replied']);
        return ['success' => true, 'duplicate' => true];
    }

    if (turn_engine_wa_message_exists($waId)) {
        $existing = db_fetch(
            'SELECT ct.lead_id, ct.id AS turn_id, ct.status
             FROM conversation_turn_messages ctm
             INNER JOIN conversation_turns ct ON ct.id = ctm.turn_id
             WHERE ctm.wa_message_id = ? LIMIT 1',
            's',
            [$waId]
        );
        if ($existing && in_array((string) ($existing['status'] ?? ''), ['buffering', 'processing'], true)) {
            turn_engine_schedule_lead_processing((int) $existing['lead_id']);
            turn_engine_log_event((int) $existing['turn_id'], 'DUPLICATE_REPROCESS', ['wa_message_id' => $waId]);
            return ['success' => true, 'duplicate' => true, 'reprocess' => true, 'lead_id' => (int) $existing['lead_id']];
        }
        turn_engine_log_event(0, 'DUPLICATE_EVENT_IGNORED', ['wa_message_id' => $waId]);
        return ['success' => true, 'duplicate' => true];
    }

    if (whatsapp_inbound_already_replied($waId)) {
        turn_engine_log_event(0, 'DUPLICATE_EVENT_IGNORED', ['wa_message_id' => $waId, 'source' => 'dedup_table']);
        return ['success' => true, 'duplicate' => true];
    }

    $type = (string) $normalized['message_type'];
    $supported = ['text', 'image', 'audio', 'video', 'document'];
    if (!in_array($type, $supported, true)) {
        return ['success' => false, 'error' => 'Unsupported type: ' . $type];
    }

    if ($type === 'text' && trim((string) ($normalized['raw_text'] ?? '')) === '') {
        return ['success' => false, 'error' => 'Empty text'];
    }

    $leadId = turn_engine_resolve_lead($bot, $senderPhone, $contactName);
    if ($leadId <= 0) {
        return ['success' => false, 'error' => 'Lead limit reached'];
    }

    whatsapp_track_inbound($waId, (int) $bot['id'], $senderPhone, $leadId);

    $hasMedia = turn_engine_message_is_media($type);
    $turnId = turn_engine_get_or_create_buffering_turn($leadId, (int) $bot['id'], $senderPhone, $hasMedia);

    $sort = (int) (db_fetch('SELECT COUNT(*) AS c FROM conversation_turn_messages WHERE turn_id = ?', 'i', [$turnId])['c'] ?? 0);

    db_insert(
        'INSERT INTO conversation_turn_messages
         (turn_id, wa_message_id, message_type, raw_text, caption, media_id, mime_type, wa_timestamp, sort_order, processing_status, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, \'pending\', ?)',
        'issssssiis',
        [
            $turnId,
            $waId,
            $type,
            $normalized['raw_text'],
            $normalized['caption'],
            $normalized['media_id'],
            $normalized['mime_type'],
            $normalized['wa_timestamp'] ?? 0,
            $sort,
            json_encode($normalized['metadata'] ?? [], JSON_UNESCAPED_UNICODE),
        ]
    );

    db_execute(
        'UPDATE conversation_turns SET
            message_count = message_count + 1,
            media_count = media_count + ?,
            last_message_at = NOW()
         WHERE id = ?',
        'ii',
        [$hasMedia ? 1 : 0, $turnId]
    );

    turn_engine_extend_buffer($turnId, $hasMedia);
    turn_engine_consolidate_buffering_turns($leadId);
    turn_engine_log_event($turnId, 'MESSAGE_NORMALIZED', [
        'wa_message_id' => $waId,
        'type'          => $type,
    ]);
    turn_engine_log_event($turnId, 'TURN_MESSAGE_ADDED', [
        'wa_message_id' => $waId,
        'type'          => $type,
    ]);

    // Never generate or show typing from ingest — wait until the client has been quiet.
    if (!turn_engine_dispatch_worker([$leadId])) {
        turn_engine_log_event($turnId, 'WORKER_DISPATCH_FAILED', ['lead_id' => $leadId]);
    }

    return ['success' => true, 'turn_id' => $turnId, 'lead_id' => $leadId];
}

/**
 * Combine fragmented short text bursts into one line.
 *
 * @param list<string> $parts
 */
function turn_engine_combine_text_parts(array $parts): string
{
    $parts = array_values(array_filter(array_map(static fn ($p) => trim((string) $p), $parts), static fn ($p) => $p !== ''));
    if ($parts === []) {
        return '';
    }
    if (count($parts) === 1) {
        return whatsapp_normalize_inbound_text($parts[0]);
    }

    $wordLike = 0;
    $allShort = true;
    foreach ($parts as $part) {
        $len = mb_strlen($part);
        if ($len > 28) {
            $allShort = false;
        }
        $words = array_values(array_filter(preg_split('/\s+/u', $part) ?: []));
        if ($words === [] || (count($words) <= 3 && $len <= 40) || preg_match('/^[?!.]+$/u', $part) === 1) {
            $wordLike++;
        }
    }

    $joinSpaces = $allShort || $wordLike >= (int) ceil(count($parts) * 0.7);
    $joined = $joinSpaces ? implode(' ', $parts) : implode("\n", $parts);
    $joined = preg_replace('/\s+([?.!,;:])/u', '$1', $joined) ?? $joined;

    return whatsapp_normalize_inbound_text($joined);
}

function turn_engine_text_part_count(int $turnId): int
{
    $row = db_fetch(
        'SELECT COUNT(*) AS c FROM conversation_turn_messages WHERE turn_id = ? AND message_type = \'text\'',
        'i',
        [$turnId]
    );

    return (int) ($row['c'] ?? 0);
}

function turn_engine_peek_combined_text(int $turnId): string
{
    $rows = db_fetch_all(
        'SELECT raw_text FROM conversation_turn_messages WHERE turn_id = ? AND message_type = \'text\' ORDER BY sort_order ASC, id ASC',
        'i',
        [$turnId]
    );
    $parts = array_map(static fn ($r) => (string) ($r['raw_text'] ?? ''), $rows);

    return turn_engine_combine_text_parts($parts);
}

function turn_engine_process_turn_media(int $turnId, string $token): void
{
    require_once __DIR__ . '/whatsapp-media.php';
    require_once __DIR__ . '/media-understanding.php';

    turn_engine_log_event($turnId, 'MEDIA_PROCESSING_STARTED');

    $rows = db_fetch_all(
        'SELECT * FROM conversation_turn_messages WHERE turn_id = ? ORDER BY sort_order ASC, id ASC',
        'i',
        [$turnId]
    );

    foreach ($rows as $row) {
        $type = (string) ($row['message_type'] ?? '');
        if (!turn_engine_message_is_media($type)) {
            db_execute(
                'UPDATE conversation_turn_messages SET processing_status = \'completed\' WHERE id = ?',
                'i',
                [(int) $row['id']]
            );
            continue;
        }

        if ((string) ($row['processing_status'] ?? '') === 'completed') {
            continue;
        }

        db_execute(
            'UPDATE conversation_turn_messages SET processing_status = \'processing\' WHERE id = ?',
            'i',
            [(int) $row['id']]
        );

        $mediaId = trim((string) ($row['media_id'] ?? ''));
        if ($mediaId === '') {
            db_execute(
                'UPDATE conversation_turn_messages SET processing_status = \'failed\' WHERE id = ?',
                'i',
                [(int) $row['id']]
            );
            continue;
        }

        $dl = whatsapp_download_media($mediaId, $token);
        if (!$dl['success']) {
            db_execute(
                'UPDATE conversation_turn_messages SET processing_status = \'failed\' WHERE id = ?',
                'i',
                [(int) $row['id']]
            );
            continue;
        }

        $mediaUrl = null;
        if (in_array($type, ['image', 'audio'], true)) {
            $persisted = conversation_persist_whatsapp_media(
                $dl['path'],
                $mediaId,
                $dl['mime'] ?? 'application/octet-stream'
            );
            if (!empty($persisted['success'])) {
                $mediaUrl = $persisted['url'] ?? null;
            }
        }

        $transcription = null;
        $imageDescription = null;
        $documentText = null;
        $ocrText = null;
        $analysisJson = null;
        $provider = null;
        $confidence = null;

        if ($type === 'audio') {
            $result = media_transcribe_voice($dl['path'], $dl['mime'] ?? 'audio/ogg');
            if ($result['success']) {
                $transcription = trim((string) ($result['text'] ?? ''));
                $provider = 'openai';
                $confidence = 0.850;
            }
        } elseif ($type === 'image') {
            $result = media_understand_image($dl['path'], $dl['mime'] ?? 'image/jpeg', (string) ($row['caption'] ?? ''));
            if ($result['success']) {
                $imageDescription = trim((string) ($result['text'] ?? ''));
                $provider = 'openai';
                $confidence = 0.800;
                require_once __DIR__ . '/conversation-intelligence.php';
                $ocrText = conversation_intelligence_ocr_from_description($imageDescription);
            }
        } elseif ($type === 'document') {
            require_once __DIR__ . '/document-text.php';
            require_once __DIR__ . '/conversation-intelligence.php';
            $meta = [];
            if (!empty($row['metadata_json'])) {
                $decoded = json_decode((string) $row['metadata_json'], true);
                $meta = is_array($decoded) ? $decoded : [];
            }
            $filename = (string) ($meta['filename'] ?? '');
            $extHint = document_extension_from_mime((string) ($dl['mime'] ?? $row['mime_type'] ?? ''), $filename);
            $extracted = $extHint !== ''
                ? extract_document_text_from_path($dl['path'], $extHint, 8)
                : ['success' => false];
            if (!empty($extracted['success'])) {
                $documentText = conversation_intelligence_strip_injection(trim((string) ($extracted['text'] ?? '')));
                $provider = 'local';
                $confidence = 0.600;
            }
            $analysisJson = json_encode([
                'understood' => $documentText !== null && $documentText !== '',
                'filename'   => $filename,
                'untrusted'  => true,
            ], JSON_UNESCAPED_UNICODE);
        } elseif ($type === 'video') {
            $analysisJson = json_encode([
                'understood' => false,
                'note'       => 'Video received. Visual understanding of video is not available.',
            ], JSON_UNESCAPED_UNICODE);
            $provider = 'none';
            $confidence = 0.000;
        }

        whatsapp_media_cleanup($dl['path'] ?? null);

        $ok = $transcription !== null
            || $imageDescription !== null
            || $documentText !== null
            || $type === 'document'
            || $type === 'video';

        turn_engine_save_media_analysis((int) $row['id'], [
            'processing_status' => $ok ? 'completed' : 'failed',
            'transcription'     => $transcription,
            'image_description' => $imageDescription,
            'document_text'     => $documentText,
            'ocr_text'          => $ocrText !== null && $ocrText !== '' ? $ocrText : null,
            'analysis_json'     => $analysisJson,
            'provider'          => $provider,
            'confidence'        => $confidence,
            'media_url'         => $mediaUrl,
            'mime_type'         => $dl['mime'] ?? '',
        ]);
    }

    turn_engine_log_event($turnId, 'MEDIA_PROCESSING_COMPLETED');
}

/**
 * Persist media understanding fields; skip columns that are not migrated yet.
 *
 * @param array<string, mixed> $fields
 */
function turn_engine_save_media_analysis(int $messageId, array $fields): void
{
    if ($messageId <= 0) {
        return;
    }

    $sets = ['processing_status = ?', 'transcription = ?', 'image_description = ?', 'media_url = ?', "mime_type = COALESCE(NULLIF(mime_type, ''), ?)"];
    $types = 'sssss';
    $params = [
        (string) ($fields['processing_status'] ?? 'completed'),
        $fields['transcription'] ?? null,
        $fields['image_description'] ?? null,
        $fields['media_url'] ?? null,
        (string) ($fields['mime_type'] ?? ''),
    ];

    $optional = [
        'document_text' => 's',
        'ocr_text'      => 's',
        'analysis_json' => 's',
        'provider'      => 's',
        'confidence'    => 's',
    ];
    foreach ($optional as $col => $t) {
        if (!db_column_exists('conversation_turn_messages', $col)) {
            continue;
        }
        $sets[] = "`{$col}` = ?";
        $types .= $t;
        if ($t === 'd') {
            $params[] = $fields[$col] !== null ? (float) $fields[$col] : null;
        } elseif ($col === 'confidence') {
            $params[] = $fields[$col] !== null && $fields[$col] !== '' ? (string) $fields[$col] : null;
        } else {
            $params[] = $fields[$col] ?? null;
        }
    }

    $types .= 'i';
    $params[] = $messageId;
    db_execute(
        'UPDATE conversation_turn_messages SET ' . implode(', ', $sets) . ' WHERE id = ?',
        $types,
        $params
    );
}

/**
 * @return array{combined: string, media_type: ?string, media_url: ?string, wa_message_ids: list<string>}
 */
function turn_engine_build_turn_payload(int $turnId): array
{
    $rows = db_fetch_all(
        'SELECT * FROM conversation_turn_messages WHERE turn_id = ? ORDER BY sort_order ASC, id ASC',
        'i',
        [$turnId]
    );

    $textParts = [];
    $audioParts = [];
    $imageBlocks = [];
    $waIds = [];
    $mediaType = null;
    $mediaUrl = null;

    foreach ($rows as $row) {
        $waIds[] = (string) $row['wa_message_id'];
        $type = (string) $row['message_type'];

        if ($type === 'text') {
            $textParts[] = (string) ($row['raw_text'] ?? '');
            continue;
        }

        if ($type === 'audio') {
            $transcript = trim((string) ($row['transcription'] ?? ''));
            if ($transcript !== '') {
                $audioParts[] = $transcript;
            } else {
                $audioParts[] = '[Voice note — could not be transcribed clearly]';
            }
            $mediaType = 'voice';
            if (!empty($row['media_url'])) {
                $mediaUrl = (string) $row['media_url'];
            }
            continue;
        }

        if ($type === 'image') {
            $desc = trim((string) ($row['image_description'] ?? ''));
            $cap = trim((string) ($row['caption'] ?? ''));
            $block = '[Customer image]';
            if ($desc !== '') {
                $block .= ' ' . $desc;
                if ($cap !== '') {
                    $block .= ' Caption: "' . $cap . '"';
                }
            } elseif ($cap !== '') {
                $block .= ' (caption only — image analysis unavailable) Caption: "' . $cap . '"';
            } else {
                $block .= ' (image received — analysis unavailable)';
            }
            $imageBlocks[] = $block;
            $mediaType = 'image';
            if (!empty($row['media_url'])) {
                $mediaUrl = (string) $row['media_url'];
            }
            continue;
        }

        if ($type === 'document') {
            $doc = trim((string) ($row['document_text'] ?? ''));
            $cap = trim((string) ($row['caption'] ?? ''));
            if ($doc !== '') {
                require_once __DIR__ . '/conversation-intelligence.php';
                $doc = conversation_intelligence_strip_injection($doc);
                $block = '[Customer document]: ' . mb_substr($doc, 0, 3000);
            } else {
                $block = '[Customer document]: A document was received but text could not be extracted. Ask the customer to paste the relevant details. Do not claim you read it.';
            }
            if ($cap !== '') {
                $block .= ' Caption: "' . $cap . '"';
            }
            $imageBlocks[] = $block;
            $mediaType = $mediaType ?? 'document';
            continue;
        }

        if ($type === 'video') {
            $cap = trim((string) ($row['caption'] ?? ''));
            $block = '[Customer video]: A video was received. Visual understanding of video is not available — do not claim you watched it. Ask the customer for a screenshot or a short description of what they wanted you to see.';
            if ($cap !== '') {
                $block .= ' Caption: "' . $cap . '"';
            }
            $imageBlocks[] = $block;
            $mediaType = $mediaType ?? 'video';
        }
    }

    $segments = [];
    if ($textParts !== []) {
        $segments[] = turn_engine_combine_text_parts($textParts);
    }
    if ($audioParts !== []) {
        $segments[] = '[Voice message from customer]: ' . turn_engine_combine_text_parts($audioParts);
    }
    if ($imageBlocks !== []) {
        $segments[] = implode("\n", $imageBlocks);
    }

    return [
        'combined'        => whatsapp_normalize_inbound_text(implode("\n", array_filter($segments))),
        'media_type'      => $mediaType,
        'media_url'       => $mediaUrl,
        'wa_message_ids'  => $waIds,
        'image_count'     => count($imageBlocks),
        'audio_count'     => count($audioParts),
        'text_part_count' => count($textParts),
    ];
}

function turn_engine_infer_state(string $combined, string $current): string
{
    $t = mb_strtolower($combined);
    if (preg_match('/\b(hi+|hello+|hey+|salam|assalam)\b/u', $t)) {
        return 'GREETING';
    }
    if (preg_match('/\b(price|cost|how much|kitne|rate)\b/u', $t)) {
        return 'PRICE_INQUIRY';
    }
    if (preg_match('/\b(available|in stock|have this|do you have|milta|available hai)\b/u', $t)) {
        return 'AVAILABILITY_CHECK';
    }
    if (preg_match('/\b(order|buy|purchase|book|booking)\b/u', $t)) {
        return 'ORDER_INTENT';
    }
    if (preg_match('/\b(image|photo|picture|pic)\b/u', $t) || str_contains($combined, '[Customer image]')) {
        return 'PRODUCT_SEARCH';
    }

    return $current !== '' ? $current : 'DISCOVERY';
}

function turn_engine_update_conversation_state(int $leadId, string $combined): string
{
    turn_engine_ensure_schema();
    $row = db_fetch('SELECT state FROM conversation_state WHERE lead_id = ?', 'i', [$leadId]);
    $current = $row ? (string) $row['state'] : 'DISCOVERY';
    $next = turn_engine_infer_state($combined, $current);

    if ($row) {
        db_execute('UPDATE conversation_state SET state = ? WHERE lead_id = ?', 'si', [$next, $leadId]);
    } else {
        db_insert('INSERT INTO conversation_state (lead_id, state) VALUES (?, ?)', 'is', [$leadId, $next]);
    }

    return $next;
}

/**
 * @return string Catalog verification block for AI prompt
 */
function turn_engine_catalog_context_block(int $botId, int $turnId): string
{
    require_once __DIR__ . '/catalog.php';

    $rows = db_fetch_all(
        'SELECT image_description, caption FROM conversation_turn_messages
         WHERE turn_id = ? AND message_type = \'image\' ORDER BY sort_order ASC',
        'i',
        [$turnId]
    );

    if ($rows === []) {
        return '';
    }

    $lines = ["\n───── CATALOG VERIFICATION (mandatory) ─────"];
    $lines[] = 'For each customer image, catalog matches below are authoritative. Never claim stock/price without a match.';
    $idx = 1;

    foreach ($rows as $row) {
        $query = trim((string) ($row['image_description'] ?? ''));
        if ($query === '') {
            $query = trim((string) ($row['caption'] ?? ''));
        }
        if ($query === '') {
            $lines[] = "Image {$idx}: no visual analysis — ask for clearer photo or product code.";
            $idx++;
            continue;
        }

        $matches = catalog_search_products($botId, $query, 3);
        if ($matches === []) {
            $lines[] = "Image {$idx}: visual notes: {$query} | CATALOG: no exact match — do NOT claim we have it.";
        } else {
            $parts = [];
            foreach ($matches as $m) {
                $p = isset($m['product']) && is_array($m['product']) ? $m['product'] : $m;
                $stockRaw = $p['stock'] ?? null;
                $avail = ($stockRaw === null || $stockRaw === '' || (int) $stockRaw > 0) ? 'in catalog' : 'out of stock';
                $parts[] = ($p['name'] ?? 'Product') . ' — ' . ($p['price'] ?? '') . ' ' . ($p['currency'] ?? '') . " ({$avail})";
            }
            $lines[] = "Image {$idx}: {$query} | CATALOG MATCHES: " . implode('; ', $parts);
        }
        $idx++;
    }

    return implode("\n", $lines) . "\n";
}

function turn_engine_merge_turn_messages(int $fromTurnId, int $toTurnId): void
{
    if ($fromTurnId <= 0 || $toTurnId <= 0 || $fromTurnId === $toTurnId) {
        return;
    }

    db_execute(
        'UPDATE conversation_turn_messages SET turn_id = ? WHERE turn_id = ?',
        'ii',
        [$toTurnId, $fromTurnId]
    );

    $counts = db_fetch(
        'SELECT COUNT(*) AS c, SUM(CASE WHEN message_type IN (\'image\',\'audio\',\'video\',\'document\') THEN 1 ELSE 0 END) AS m
         FROM conversation_turn_messages WHERE turn_id = ?',
        'i',
        [$toTurnId]
    );

    db_execute(
        'UPDATE conversation_turns SET message_count = ?, media_count = ?, last_message_at = NOW() WHERE id = ?',
        'iii',
        [(int) ($counts['c'] ?? 0), (int) ($counts['m'] ?? 0), $toTurnId]
    );

    turn_engine_extend_buffer($toTurnId, ((int) ($counts['m'] ?? 0)) > 0);

    db_execute(
        'UPDATE conversation_turns SET status = \'cancelled\', suppression_reason = \'merged_into_later_turn\' WHERE id = ?',
        'i',
        [$fromTurnId]
    );

    turn_engine_log_event($toTurnId, 'TURN_MESSAGE_ADDED', ['merged_from_turn' => $fromTurnId]);
}

function turn_engine_consolidate_buffering_turns(int $leadId): void
{
    $turns = db_fetch_all(
        'SELECT id FROM conversation_turns WHERE lead_id = ? AND status = \'buffering\' ORDER BY id ASC',
        'i',
        [$leadId]
    );
    if (count($turns) <= 1) {
        return;
    }

    $primaryId = (int) $turns[0]['id'];
    for ($i = 1, $n = count($turns); $i < $n; $i++) {
        turn_engine_merge_turn_messages((int) $turns[$i]['id'], $primaryId);
    }
}

/**
 * If the customer is still sending bubbles, do not type or reply.
 * Same-turn fragments ("Hello" then "how" then "are") must wait for 5s quiet.
 */
function turn_engine_defer_if_customer_still_typing(int $turnId, int $leadId, int $messageCountSnapshot = -1): bool
{
    $turn = db_fetch(
        'SELECT id, status, last_message_at, message_count FROM conversation_turns WHERE id = ?',
        'i',
        [$turnId]
    );
    if (!$turn) {
        return true;
    }

    $buffering = db_fetch(
        'SELECT id FROM conversation_turns WHERE lead_id = ? AND status = \'buffering\' AND id != ? ORDER BY id DESC LIMIT 1',
        'ii',
        [$leadId, $turnId]
    );
    if ($buffering) {
        turn_engine_merge_turn_messages($turnId, (int) $buffering['id']);
        turn_engine_log_event($turnId, 'STALE_RESPONSE_SUPPRESSED', ['reason' => 'newer_messages_buffered']);

        return true;
    }

    $status = (string) ($turn['status'] ?? '');
    $count = (int) ($turn['message_count'] ?? 0);
    $newMessages = $messageCountSnapshot >= 0 && $count > $messageCountSnapshot;
    $stillSending = !turn_engine_row_is_quiet($turn);

    if ($status !== 'processing' || $newMessages || $stillSending) {
        turn_engine_rebuffer_for_quiet($turnId);
        turn_engine_log_event($turnId, 'STALE_RESPONSE_SUPPRESSED', [
            'reason'         => $stillSending ? 'customer_still_sending' : ($newMessages ? 'new_bubbles_same_turn' : 'rebuffered'),
            'message_count'  => $count,
            'snapshot_count' => $messageCountSnapshot,
        ]);

        return true;
    }

    return false;
}

/**
 * Push overdue buffering turns into the due queue (finalize_after elapsed by $overdueSec+).
 */
function turn_engine_force_finalize_overdue(int $leadId, int $overdueSec = 30): int
{
    turn_engine_ensure_schema();
    if ($leadId <= 0) {
        return 0;
    }

    $overdueSec = max(5, $overdueSec);
    $quietSec = turn_engine_quiet_seconds();

    try {
        $affected = db_execute(
            'UPDATE conversation_turns SET finalize_after = NOW()
             WHERE lead_id = ? AND status = \'buffering\'
             AND finalize_after <= DATE_SUB(NOW(), INTERVAL ? SECOND)
             AND last_message_at <= DATE_SUB(NOW(), INTERVAL ? SECOND)',
            'iii',
            [$leadId, $overdueSec, $quietSec]
        );

        if ($affected > 0) {
            turn_engine_log_event(0, 'TURN_FORCE_OVERDUE', ['lead_id' => $leadId, 'count' => $affected]);
        }

        return $affected;
    } catch (Throwable $e) {
        error_log('turn_engine_force_finalize_overdue: ' . $e->getMessage());

        return 0;
    }
}

function turn_engine_recover_stuck_turns(int $maxAgeMinutes = 8): int
{
    turn_engine_ensure_schema();
    $maxAgeMinutes = max(8, $maxAgeMinutes);
    $rows = db_fetch_all(
        'SELECT id FROM conversation_turns
         WHERE status = \'processing\'
         AND (
            (processing_started_at IS NOT NULL AND processing_started_at < DATE_SUB(NOW(), INTERVAL ? MINUTE))
            OR (processing_started_at IS NULL AND last_message_at < DATE_SUB(NOW(), INTERVAL ? MINUTE))
         )',
        'ii',
        [$maxAgeMinutes, $maxAgeMinutes]
    );
    $n = 0;
    foreach ($rows as $row) {
        db_execute(
            'UPDATE conversation_turns SET status = \'buffering\', processing_started_at = NULL, finalized_at = NULL,
             finalize_after = NOW(), suppression_reason = \'recovered_stuck\' WHERE id = ?',
            'i',
            [(int) $row['id']]
        );
        turn_engine_log_event((int) $row['id'], 'AI_GENERATION_CANCELLED', ['reason' => 'recovered_stuck']);
        $n++;
    }

    return $n;
}

/**
 * Make overdue buffering turns due immediately (worker/cron safety net).
 */
function turn_engine_force_finalize_all_overdue(int $overdueSec = 5): int
{
    turn_engine_ensure_schema();
    $overdueSec = max(5, $overdueSec);
    $maxSec = max(15, (int) ceil(turn_engine_constants()['max_window_ms'] / 1000));
    $quietSec = turn_engine_quiet_seconds();

    try {
        $affected = db_execute(
            'UPDATE conversation_turns SET finalize_after = NOW()
             WHERE status = \'buffering\'
             AND last_message_at <= DATE_SUB(NOW(), INTERVAL ? SECOND)
             AND (
                finalize_after <= DATE_SUB(NOW(), INTERVAL ? SECOND)
                OR started_at <= DATE_SUB(NOW(), INTERVAL ? SECOND)
             )',
            'iii',
            [$quietSec, $overdueSec, $maxSec]
        );
        if ($affected > 0) {
            turn_engine_log_event(0, 'TURN_FORCE_ALL_OVERDUE', ['count' => $affected, 'overdue_sec' => $overdueSec]);
        }

        return $affected;
    } catch (Throwable $e) {
        error_log('turn_engine_force_finalize_all_overdue: ' . $e->getMessage());

        return 0;
    }
}

function turn_engine_turn_still_processing(int $turnId): bool
{
    $row = db_fetch('SELECT status FROM conversation_turns WHERE id = ?', 'i', [$turnId]);

    return $row !== null && (string) ($row['status'] ?? '') === 'processing';
}

function turn_engine_current_processing_generation(int $turnId): int
{
    $row = db_fetch('SELECT processing_generation FROM conversation_turns WHERE id = ?', 'i', [$turnId]);

    return (int) ($row['processing_generation'] ?? 0);
}

function turn_engine_rollback_ai_turn(int $leadId, int $userConversationId): void
{
    if ($leadId <= 0 || $userConversationId <= 0) {
        return;
    }

    whatsapp_remove_unsent_assistant_turn($leadId, $userConversationId);

    try {
        db_execute(
            'DELETE FROM conversations WHERE id = ? AND lead_id = ? AND role = \'user\'',
            'ii',
            [$userConversationId, $leadId]
        );
    } catch (Throwable $e) {
        error_log('turn_engine_rollback_ai_turn: ' . $e->getMessage());
    }
}

function turn_engine_build_live_agent_prompt(): string
{
    return "\n───── THIS USER MESSAGE IS ONE CUSTOMER TURN ─────\n"
        . "WhatsApp bubbles in this turn are already combined — they may be one sentence split word-by-word "
        . "(\"Hello\" / \"how\" / \"are\" / \"you\" / \"?\") or two related thoughts. "
        . "READ them together. LISTEN. UNDERSTAND. THINK. PLAN. DECIDE. Then one REPLY. "
        . "First sentence answers what they said.\n";
}

function turn_engine_short_ack_reply(): string
{
    $acks = ['Got it 👍', 'Sure thing.', 'Noted.', 'Alright!', 'Okay, let me know if you need anything else.'];
    return $acks[array_rand($acks)];
}

function turn_engine_response_is_repetitive(int $leadId, string $reply): bool
{
    ensure_conversations_schema();
    $last = db_fetch(
        'SELECT message FROM conversations WHERE lead_id = ? AND role = \'assistant\' ORDER BY id DESC LIMIT 1',
        'i',
        [$leadId]
    );
    if (!$last) {
        return false;
    }

    $prev = mb_strtolower(trim((string) ($last['message'] ?? '')));
    $cur = mb_strtolower(trim($reply));
    if ($prev === '' || $cur === '') {
        return false;
    }

    similar_text($prev, $cur, $pct);

    return $pct >= 88.0;
}

/**
 * @return array{ok: bool, reason?: string}
 */
function turn_engine_validate_response(int $turnId, int $leadId, string $reply, string $combined): array
{
    require_once __DIR__ . '/conversation-response-validator.php';

    $validation = conversation_validate_customer_reply($leadId, $reply, $combined);
    if (!$validation['ok']) {
        turn_engine_log_event($turnId, 'RESPONSE_VALIDATED', ['ok' => false, 'reason' => $validation['reason'] ?? '']);

        return $validation;
    }

    if (preg_match('/\b(I can\'?t|cannot) (view|see|read) (images|photos|pictures)\b/i', $reply)) {
        return ['ok' => false, 'reason' => 'image_denial'];
    }

    turn_engine_log_event($turnId, 'RESPONSE_VALIDATED', ['length' => mb_strlen($reply)]);

    return ['ok' => true];
}

/**
 * Stale / duplicate / handoff / validation / factuality gate immediately before WhatsApp send.
 *
 * @param array<string, mixed> $bot
 * @param array<string, mixed> $analysis
 * @param array<string, mixed> $ai
 * @return array{ok: bool, reply: string, suppressed?: string, reason?: string}
 */
function turn_engine_prepare_outbound_reply(
    int $turnId,
    int $leadId,
    array $bot,
    string $combined,
    string $reply,
    int $snapshotGeneration,
    array $analysis,
    array $ai
): array {
    require_once __DIR__ . '/conversation-intelligence.php';

    $lead = db_fetch('SELECT * FROM leads WHERE id = ?', 'i', [$leadId]) ?: [];
    $gate = turn_engine_should_suppress_outbound($turnId, $leadId, $snapshotGeneration, $lead);
    if ($gate['suppress']) {
        turn_engine_log_event($turnId, $gate['reason'] === 'HUMAN_HANDOFF_ACTIVE' ? 'HUMAN_HANDOFF_ACTIVE' : $gate['reason'], [
            'snapshot' => $snapshotGeneration,
            'current'  => turn_engine_current_processing_generation($turnId),
        ]);

        return ['ok' => false, 'reply' => $reply, 'suppressed' => $gate['reason']];
    }

    $validation = turn_engine_validate_response($turnId, $leadId, $reply, $combined);
    $factual = conversation_intelligence_factuality_gate($reply, $bot, $leadId, $analysis);
    if ($validation['ok'] && $factual['ok']) {
        $gate = turn_engine_should_suppress_outbound($turnId, $leadId, $snapshotGeneration, $lead);
        if ($gate['suppress']) {
            return ['ok' => false, 'reply' => $reply, 'suppressed' => $gate['reason']];
        }

        return ['ok' => true, 'reply' => $reply];
    }

    $reason = !$validation['ok'] ? (string) ($validation['reason'] ?? 'validation') : (string) ($factual['reason'] ?? 'factuality');
    turn_engine_log_event($turnId, 'VALIDATION_FAILED', ['reason' => $reason, 'attempt' => 1]);

    require_once __DIR__ . '/conversation-response-validator.php';
    $hint = conversation_validation_retry_hint($reason, $combined);
    $hint .= "\n\n" . mb_substr((string) ($analysis['context_pack'] ?? ''), 0, 900);
    if ($reason === 'unsupported_price' || $reason === 'unsupported_availability' || $reason === 'claimed_in_stock_but_oos') {
        $hint .= ' Use only catalog prices/stock from the prompt. If unknown, say you are checking — never invent.';
    }
    if ($reason === 'shop_pitch_on_social') {
        $hint .= ' This was a social message. Reply like a human. No menu pitch.';
    }
    if ($reason === 'unconfirmed_booking' || $reason === 'unconfirmed_payment' || $reason === 'fabricated_payment_url') {
        $hint .= ' Do not confirm bookings or payments unless the system already did. Do not invent URLs.';
    }

    $retry = get_ai_response($leadId, (int) $bot['id'], $combined, [
        'skip_user_insert' => true,
        'customer_turn'    => true,
        'ai_only'          => true,
        'system_hint'      => $hint,
    ]);
    $retryReply = trim((string) ($retry['reply'] ?? ''));
    if ($retryReply !== '') {
        $reply = $retryReply;
    }

    $validation = turn_engine_validate_response($turnId, $leadId, $reply, $combined);
    $factual = conversation_intelligence_factuality_gate($reply, $bot, $leadId, $analysis);
    $gate = turn_engine_should_suppress_outbound($turnId, $leadId, $snapshotGeneration, $lead);
    if ($gate['suppress']) {
        return ['ok' => false, 'reply' => $reply, 'suppressed' => $gate['reason']];
    }
    if (!$validation['ok'] || !$factual['ok']) {
        $reason = !$validation['ok'] ? (string) ($validation['reason'] ?? 'validation') : (string) ($factual['reason'] ?? 'factuality');
        turn_engine_log_event($turnId, 'VALIDATION_FAILED', ['reason' => $reason, 'attempt' => 2]);

        return ['ok' => false, 'reply' => $reply, 'suppressed' => 'VALIDATION_FAILED', 'reason' => $reason];
    }

    unset($ai);

    return ['ok' => true, 'reply' => $reply];
}

function turn_engine_finalize_turn(int $turnId, bool $force = false): bool
{
    turn_engine_ensure_schema();
    $turn = db_fetch('SELECT * FROM conversation_turns WHERE id = ?', 'i', [$turnId]);
    if (!$turn || (string) ($turn['status'] ?? '') !== 'buffering') {
        return false;
    }

    if (!turn_engine_row_is_quiet($turn)) {
        turn_engine_rebuffer_for_quiet($turnId);

        return false;
    }

    if (!$force && strtotime((string) $turn['finalize_after']) > time()) {
        return false;
    }

    db_execute(
        'UPDATE conversation_turns SET status = \'processing\', finalized_at = NOW(), processing_started_at = NOW() WHERE id = ? AND status = \'buffering\'',
        'i',
        [$turnId]
    );

    turn_engine_log_event($turnId, 'TURN_FINALIZED');

    return true;
}

/**
 * Process one turn end-to-end.
 *
 * @param array<string, mixed> $bot
 */
function turn_engine_process_turn(int $turnId, array $bot, string $phoneId, string $token): array
{
    turn_engine_ensure_schema();

    $turn = db_fetch('SELECT * FROM conversation_turns WHERE id = ?', 'i', [$turnId]);
    if (!$turn) {
        return ['success' => false, 'error' => 'Turn not found'];
    }

    $status = (string) ($turn['status'] ?? '');
    if ($status === 'cancelled' || $status === 'completed') {
        return ['success' => false, 'error' => 'Turn already closed: ' . $status];
    }

    if ($status === 'buffering') {
        if (!turn_engine_finalize_turn($turnId)) {
            return ['success' => false, 'error' => 'Turn not ready'];
        }
        $turn = db_fetch('SELECT * FROM conversation_turns WHERE id = ?', 'i', [$turnId]) ?: $turn;
    } elseif ($status !== 'processing') {
        return ['success' => false, 'error' => 'Turn status: ' . $status];
    }

    $leadId = (int) $turn['lead_id'];
    $senderPhone = (string) $turn['sender_phone'];
    $combined = '';
    $waMessageIds = [];
    $primaryWaId = '';
    $messageCountSnapshot = (int) ($turn['message_count'] ?? 0);
    $snapshotGeneration = (int) ($turn['processing_generation'] ?? 0);
    $generationId = '';
    $analysis = [];
    if (function_exists('conversation_consume_shop_menu_send')) {
        conversation_consume_shop_menu_send();
    }

    $earlyPayload = turn_engine_build_turn_payload($turnId);
    $earlyIds = $earlyPayload['wa_message_ids'] ?? [];
    if ($earlyIds !== []) {
        $primaryWaId = $earlyIds[count($earlyIds) - 1];
        whatsapp_mark_message_read($phoneId, $token, $primaryWaId);
    }

    require_once __DIR__ . '/conversation-intelligence.php';
    $generationId = conversation_intelligence_start_generation(
        $turnId,
        $leadId,
        $snapshotGeneration,
        conversation_intelligence_context_version($leadId)
    );

    turn_engine_log_event($turnId, 'AI_GENERATION_STARTED', [
        'processing_generation' => $snapshotGeneration,
        'generation_id'         => $generationId,
    ]);

    require_once __DIR__ . '/whatsapp-typing-keepalive.php';

    $lead = db_fetch('SELECT * FROM leads WHERE id = ?', 'i', [$leadId]) ?: [];
    if ($lead !== [] && is_lead_bot_paused($lead)) {
        turn_engine_process_turn_media($turnId, $token);
        $payload = turn_engine_build_turn_payload($turnId);
        if ($payload['combined'] !== '') {
            conversation_insert($leadId, 'user', $payload['combined'], $payload['media_type'], $payload['media_url']);
            touch_lead_activity($leadId);
            $analysis = conversation_intelligence_run_for_turn($turnId, $bot, $leadId, $payload['combined'], $payload);
        }
        db_execute(
            'UPDATE conversation_turns SET status = \'human_handled\', processing_completed_at = NOW(), suppression_reason = \'human_handoff\' WHERE id = ?',
            'i',
            [$turnId]
        );
        turn_engine_log_event($turnId, 'HUMAN_HANDOFF_ACTIVE');
        whatsapp_mark_many_inbound_replied($payload['wa_message_ids']);
        conversation_intelligence_finish_generation($generationId, 'suppressed');

        return ['success' => true, 'suppressed' => 'human_handoff'];
    }

    if ((int) ($bot['whatsapp_auto_reply'] ?? 1) !== 1) {
        turn_engine_process_turn_media($turnId, $token);
        $payload = turn_engine_build_turn_payload($turnId);
        if ($payload['combined'] !== '') {
            conversation_insert($leadId, 'user', $payload['combined'], $payload['media_type'], $payload['media_url']);
            touch_lead_activity($leadId);
            $analysis = conversation_intelligence_run_for_turn($turnId, $bot, $leadId, $payload['combined'], $payload);
        }
        db_execute(
            'UPDATE conversation_turns SET status = \'completed\', processing_completed_at = NOW(), suppression_reason = \'auto_reply_off\' WHERE id = ?',
            'i',
            [$turnId]
        );
        turn_engine_log_event($turnId, 'AUTO_REPLY_DISABLED');
        whatsapp_mark_many_inbound_replied($payload['wa_message_ids'] ?? []);
        conversation_intelligence_finish_generation($generationId, 'suppressed');

        return ['success' => true, 'suppressed' => 'auto_reply_off'];
    }

    if (!whatsapp_acquire_lead_reply_lock($leadId, 5)) {
        return ['success' => false, 'error' => 'Lock busy'];
    }

    try {
        turn_engine_process_turn_media($turnId, $token);
        $payload = turn_engine_build_turn_payload($turnId);
        $combined = $payload['combined'];
        $waMessageIds = $payload['wa_message_ids'];
        $primaryWaId = $waMessageIds !== [] ? $waMessageIds[count($waMessageIds) - 1] : '';

        // Mark read as soon as we start processing — never wait on AI includes.
        if ($primaryWaId !== '') {
            whatsapp_mark_message_read($phoneId, $token, $primaryWaId);
        }

        if ($combined === '') {
            if (turn_engine_defer_if_customer_still_typing($turnId, $leadId, $messageCountSnapshot)) {
                turn_engine_dispatch_worker([$leadId]);

                return ['success' => true, 'suppressed' => 'merged_empty_wait'];
            }
            $fallback = 'I got your message — could you tell me a bit more about what you need? A product name or photo with a caption helps.';
            $primaryWaId = $waMessageIds !== [] ? $waMessageIds[count($waMessageIds) - 1] : '';
            $gate = turn_engine_should_suppress_outbound($turnId, $leadId, $snapshotGeneration, $lead);
            if ($gate['suppress']) {
                conversation_intelligence_finish_generation($generationId, 'suppressed');

                return ['success' => true, 'suppressed' => $gate['reason']];
            }
            whatsapp_deliver_inbound_reply($phoneId, $token, $senderPhone, $bot, $leadId, '', $fallback, $primaryWaId, $waMessageIds);
            db_execute(
                'UPDATE conversation_turns SET status = \'completed\', ai_response_text = ?, suppression_reason = \'empty_turn_fallback\', processing_completed_at = NOW() WHERE id = ?',
                'si',
                [$fallback, $turnId]
            );
            conversation_intelligence_finish_generation($generationId, 'completed');

            return ['success' => true, 'reply' => $fallback];
        }

        if (!turn_engine_turn_still_processing($turnId)) {
            return ['success' => true, 'suppressed' => 'rebuffered'];
        }

        if (turn_engine_defer_if_customer_still_typing($turnId, $leadId, $messageCountSnapshot)) {
            db_execute(
                'UPDATE conversation_turns SET processing_completed_at = NOW() WHERE id = ?',
                'i',
                [$turnId]
            );
            turn_engine_dispatch_worker([$leadId]);

            return ['success' => true, 'suppressed' => 'merged_into_buffer'];
        }

        $payload = turn_engine_build_turn_payload($turnId);
        $combined = $payload['combined'];
        $waMessageIds = $payload['wa_message_ids'];
        $countRow = db_fetch('SELECT message_count FROM conversation_turns WHERE id = ?', 'i', [$turnId]);
        $messageCountSnapshot = (int) ($countRow['message_count'] ?? $messageCountSnapshot);

        db_execute(
            'UPDATE conversation_turns SET combined_text = ?, conversation_state = ? WHERE id = ?',
            'ssi',
            [$combined, turn_engine_update_conversation_state($leadId, $combined), $turnId]
        );

        if (whatsapp_should_skip_auto_reply($leadId, $combined, $waMessageIds)) {
            db_execute(
                'UPDATE conversation_turns SET status = \'completed\', suppression_reason = \'duplicate\', processing_completed_at = NOW() WHERE id = ?',
                'i',
                [$turnId]
            );
            whatsapp_mark_many_inbound_replied($waMessageIds);
            turn_engine_log_event($turnId, 'RESPONSE_SUPPRESSED', ['reason' => 'duplicate']);

            return ['success' => true, 'suppressed' => 'duplicate'];
        }

        require_once __DIR__ . '/../api/ai-respond.php';
        require_once __DIR__ . '/catalog.php';
        $primaryWaId = $waMessageIds !== [] ? $waMessageIds[count($waMessageIds) - 1] : '';

        $catalogBlock = turn_engine_catalog_context_block((int) $bot['id'], $turnId);
        $analysis = conversation_intelligence_run_for_turn($turnId, $bot, $leadId, $combined, $payload);
        $intelBlock = conversation_intelligence_prompt_block($analysis);
        $GLOBALS['turn_engine_catalog_prompt_block'] = trim($catalogBlock . "\n" . conversation_intelligence_catalog_block($analysis['catalog'] ?? []));
        $GLOBALS['turn_engine_state_prompt_block'] = "\nConversation state: " . turn_engine_update_conversation_state($leadId, $combined) . "\n";
        $GLOBALS['turn_engine_live_agent_block'] = turn_engine_build_live_agent_prompt();
        $GLOBALS['turn_engine_intelligence_block'] = $intelBlock;
        require_once __DIR__ . '/human-agent-prompt.php';
        $GLOBALS['turn_engine_system_hint'] = trim(human_agent_universal_turn_hint($combined, $leadId) . "\n\n" . $intelBlock);

        if (turn_engine_defer_if_customer_still_typing($turnId, $leadId, $messageCountSnapshot)) {
            turn_engine_dispatch_worker([$leadId]);

            return ['success' => true, 'suppressed' => 'merged_pre_ai'];
        }

        if ($primaryWaId !== '') {
            whatsapp_send_typing_indicator($phoneId, $token, $primaryWaId);
            whatsapp_typing_keepalive_start($phoneId, $token, $primaryWaId);
        }

        conversation_insert($leadId, 'user', $combined, $payload['media_type'], $payload['media_url']);

        if (!whatsapp_ai_rate_limit_ok((int) $bot['id'])) {
            $msg = whatsapp_ai_rate_limit_message();
            whatsapp_deliver_inbound_reply($phoneId, $token, $senderPhone, $bot, $leadId, $combined, $msg, $primaryWaId, $waMessageIds);
            db_execute(
                'UPDATE conversation_turns SET status = \'completed\', ai_response_text = ?, processing_completed_at = NOW() WHERE id = ?',
                'si',
                [$msg, $turnId]
            );

            return ['success' => true, 'reply' => $msg];
        }

        $GLOBALS['behavior_defer_consolidation'] = true;
        $GLOBALS['human_agent_customer_turn'] = true;
        $ai = get_ai_response($leadId, (int) $bot['id'], $combined, [
            'skip_user_insert' => true,
            'customer_turn'    => true,
            'system_hint'      => (string) ($GLOBALS['turn_engine_system_hint'] ?? ''),
        ]);
        unset($GLOBALS['behavior_defer_consolidation'], $GLOBALS['turn_engine_catalog_prompt_block'], $GLOBALS['turn_engine_state_prompt_block'], $GLOBALS['turn_engine_live_agent_block'], $GLOBALS['turn_engine_system_hint'], $GLOBALS['turn_engine_intelligence_block'], $GLOBALS['human_agent_customer_turn']);

        if (turn_engine_defer_if_customer_still_typing($turnId, $leadId, $messageCountSnapshot)) {
            if (!empty($ai['user_message_id'])) {
                turn_engine_rollback_ai_turn($leadId, (int) $ai['user_message_id']);
            }
            turn_engine_dispatch_worker([$leadId]);

            return ['success' => true, 'suppressed' => 'merged_post_ai'];
        }

        $gate = turn_engine_should_suppress_outbound($turnId, $leadId, $snapshotGeneration, $lead);
        if (!empty($gate['suppress'])) {
            if (!empty($ai['user_message_id'])) {
                turn_engine_rollback_ai_turn($leadId, (int) $ai['user_message_id']);
            }
            turn_engine_dispatch_worker([$leadId]);

            return ['success' => true, 'suppressed' => (string) ($gate['reason'] ?? 'stale')];
        }

        $freshPayload = turn_engine_build_turn_payload($turnId);
        if (count($freshPayload['wa_message_ids'] ?? []) > count($waMessageIds)) {
            if (!empty($ai['user_message_id'])) {
                turn_engine_rollback_ai_turn($leadId, (int) $ai['user_message_id']);
            }
            turn_engine_rebuffer_for_quiet($turnId);
            turn_engine_dispatch_worker([$leadId]);

            return ['success' => true, 'suppressed' => 'new_bubbles_before_send'];
        }

        if (!empty($ai['paused'])) {
            db_execute(
                'UPDATE conversation_turns SET status = \'human_handled\', suppression_reason = \'paused\' WHERE id = ?',
                'i',
                [$turnId]
            );
            whatsapp_mark_many_inbound_replied($waMessageIds);
            conversation_intelligence_finish_generation($generationId, 'suppressed');

            return ['success' => true, 'suppressed' => 'paused'];
        }

        $reply = human_agent_ensure_customer_reply($bot, $leadId, (int) $bot['id'], $combined, $ai);
        $reply = human_agent_finalize_reply($bot, $leadId, $reply, $combined);

        $productIndexes = $ai['product_indexes'] ?? [];
        require_once __DIR__ . '/whatsapp-shop-ux.php';
        $wantsCard = $combined !== '' && whatsapp_shop_customer_wants_visual_card($combined);
        if ($productIndexes === [] && $wantsCard && catalog_has_clear_shopping_intent($combined)) {
            require_once __DIR__ . '/catalog.php';
            $productIndexes = catalog_auto_product_indexes((int) $bot['id'], $combined, []);
        }

        $sent = whatsapp_deliver_inbound_reply($phoneId, $token, $senderPhone, $bot, $leadId, $combined, $reply, $primaryWaId, $waMessageIds);

        if (!empty($sent['success'])) {
            conversation_store_sent_assistant_reply($leadId, $reply);
            bot_whatsapp_mark_verified((int) $bot['id']);
            require_once __DIR__ . '/whatsapp-shop-ux.php';
            whatsapp_shop_followup_after_reply(
                $bot,
                $leadId,
                $senderPhone,
                array_merge($ai, [
                    'product_indexes' => $productIndexes,
                    'menu_card'       => !empty($ai['menu_card']),
                    'menu_card_title' => (string) ($ai['menu_card_title'] ?? ''),
                ]),
                $reply,
                $combined
            );
            if (!empty($ai['send_receipt_image']) && !empty($ai['shipment_id'])) {
                require_once __DIR__ . '/shipment.php';
                shipment_send_receipt_image((int) $ai['shipment_id']);
            }
            db_execute(
                'UPDATE conversation_turns SET status = \'completed\', ai_response_text = ?, processing_completed_at = NOW() WHERE id = ?',
                'si',
                [$reply, $turnId]
            );
            turn_engine_log_event($turnId, 'RESPONSE_SENT');
            conversation_intelligence_after_send($turnId, $leadId, (int) $bot['id'], $analysis, $reply);
            conversation_intelligence_finish_generation($generationId, 'completed');
        } else {
            db_execute(
                'UPDATE conversation_turns SET status = \'failed\', suppression_reason = ? WHERE id = ?',
                'si',
                [(string) ($sent['message'] ?? 'send_failed'), $turnId]
            );
            if (!empty($ai['user_message_id'])) {
                whatsapp_remove_unsent_assistant_turn($leadId, (int) $ai['user_message_id']);
            }
            $fallback = human_agent_warm_last_resort($bot, $combined, $leadId);
            $retry = whatsapp_deliver_inbound_reply($phoneId, $token, $senderPhone, $bot, $leadId, $combined, $fallback, $primaryWaId, $waMessageIds);
            if (!empty($retry['success'])) {
                conversation_store_sent_assistant_reply($leadId, $fallback);
                db_execute(
                    'UPDATE conversation_turns SET status = \'completed\', ai_response_text = ?, processing_completed_at = NOW() WHERE id = ?',
                    'si',
                    [$fallback, $turnId]
                );
                turn_engine_log_event($turnId, 'RESPONSE_SENT', ['path' => 'fallback_after_fail']);

                return ['success' => true, 'reply' => $fallback];
            }
        }

        return ['success' => !empty($sent['success']), 'reply' => $reply];
    } catch (Throwable $e) {
        error_log('turn_engine_process_turn #' . $turnId . ': ' . $e->getMessage());
        turn_engine_log_event($turnId, 'AI_GENERATION_FAILED', ['error' => $e->getMessage()]);

        if (turn_engine_turn_still_processing($turnId)) {
            if (turn_engine_defer_if_customer_still_typing($turnId, $leadId, $messageCountSnapshot)) {
                turn_engine_dispatch_worker([$leadId]);

                return ['success' => true, 'suppressed' => 'merged_on_exception'];
            }
            try {
                if ($combined === '' || $waMessageIds === []) {
                    $payload = turn_engine_build_turn_payload($turnId);
                    if ($combined === '') {
                        $combined = (string) ($payload['combined'] ?? '');
                    }
                    if ($waMessageIds === []) {
                        $waMessageIds = $payload['wa_message_ids'] ?? [];
                    }
                }
                if ($primaryWaId === '' && $waMessageIds !== []) {
                    $primaryWaId = $waMessageIds[count($waMessageIds) - 1];
                }
                require_once __DIR__ . '/human-agent-prompt.php';
                $fallback = human_agent_warm_last_resort($bot, $combined !== '' ? $combined : 'message', $leadId);
                $sent = whatsapp_deliver_inbound_reply($phoneId, $token, $senderPhone, $bot, $leadId, $combined, $fallback, $primaryWaId, $waMessageIds);
                if (!empty($sent['success'])) {
                    conversation_store_sent_assistant_reply($leadId, $fallback);
                    db_execute(
                        'UPDATE conversation_turns SET status = \'completed\', ai_response_text = ?, processing_completed_at = NOW(), suppression_reason = \'exception_fallback\' WHERE id = ?',
                        'si',
                        [$fallback, $turnId]
                    );
                    turn_engine_log_event($turnId, 'RESPONSE_SENT', ['path' => 'exception_fallback']);
                    conversation_intelligence_finish_generation($generationId, 'completed');

                    return ['success' => true, 'reply' => $fallback];
                }
            } catch (Throwable $inner) {
                error_log('turn_engine_process_turn fallback: ' . $inner->getMessage());
            }
        }

        db_execute(
            'UPDATE conversation_turns SET status = \'failed\', suppression_reason = ?, processing_completed_at = NOW() WHERE id = ?',
            'si',
            [mb_substr($e->getMessage(), 0, 200), $turnId]
        );

        return ['success' => false, 'error' => $e->getMessage()];
    } finally {
        if (!empty($primaryWaId)) {
            if (function_exists('whatsapp_typing_keepalive_stop')) {
                whatsapp_typing_keepalive_stop($primaryWaId);
            }
        }
        if (!empty($leadId)) {
            whatsapp_release_lead_reply_lock($leadId);
        }
    }
}

/**
 * Process turns whose debounce window has elapsed.
 *
 * @param list<int> $leadIds Optional restrict to these leads
 * @return array{processed: int, results: list<array<string, mixed>>}
 */
function turn_engine_process_due(int $limit = 20, array $leadIds = []): array
{
    turn_engine_ensure_schema();
    $limit = max(1, min(100, $limit));
    $results = [];
    $processed = 0;

    if ($leadIds === []) {
        $leadRows = db_fetch_all(
            'SELECT DISTINCT lead_id FROM conversation_turns
             WHERE ' . turn_engine_quiet_due_sql() . '
             ORDER BY finalize_after ASC LIMIT ' . $limit,
            '',
            []
        );
        $leadIds = array_map(static fn ($r) => (int) $r['lead_id'], $leadRows);
    } else {
        $leadIds = array_values(array_unique(array_filter(array_map('intval', $leadIds))));
    }

    $seenLeads = [];
    foreach ($leadIds as $leadId) {
        if ($leadId <= 0 || isset($seenLeads[$leadId])) {
            continue;
        }
        $seenLeads[$leadId] = true;

        if ($processed >= $limit) {
            break;
        }

        try {
            $turn = turn_engine_fetch_due_turn_row($leadId);
            if (!$turn) {
                continue;
            }

            $token = bot_whatsapp_token_plain((string) ($turn['whatsapp_token'] ?? ''));
            if ($token === false || $token === '') {
                turn_engine_log_event((int) $turn['id'], 'TOKEN_DECRYPT_FAILED', ['lead_id' => $leadId]);
                error_log('turn_engine_process_due: empty token for turn #' . (int) $turn['id'] . ' lead #' . $leadId);
                continue;
            }

            $bot = db_fetch('SELECT * FROM bots WHERE id = ?', 'i', [(int) $turn['bot_id']]);
            if (!$bot) {
                continue;
            }

            $phoneId = (string) ($turn['whatsapp_phone_id'] ?? '');
            $result = turn_engine_process_turn((int) $turn['id'], $bot, $phoneId, $token);
            $results[] = array_merge(['turn_id' => (int) $turn['id'], 'lead_id' => $leadId], $result);
            $processed++;
        } catch (Throwable $e) {
            error_log('turn_engine_process_due lead #' . $leadId . ': ' . $e->getMessage());
            $results[] = ['lead_id' => $leadId, 'success' => false, 'error' => $e->getMessage()];
        }
    }

    return ['processed' => $processed, 'results' => $results];
}

/**
 * Wait for debounce then process (post-webhook background worker).
 *
 * @param list<int> $leadIds
 */
function turn_engine_background_process(array $leadIds, ?int $maxWaitMs = null): void
{
    $leadIds = array_values(array_filter(array_map('intval', $leadIds)));
    if ($leadIds === []) {
        return;
    }

    $const = turn_engine_constants();
    $quietSec = turn_engine_quiet_seconds();
    $maxWaitMs = $maxWaitMs ?? (int) $const['background_ms'];
    $maxWaitMs = max($maxWaitMs, ($quietSec + 2) * 1000);
    $deadline = microtime(true) + ($maxWaitMs / 1000);
    $inList = implode(',', $leadIds);

    turn_engine_recover_stuck_turns(8);

    do {
        foreach ($leadIds as $leadId) {
            turn_engine_consolidate_buffering_turns($leadId);
        }

        turn_engine_process_due(15, $leadIds);

        $pending = db_fetch(
            'SELECT COUNT(*) AS c FROM conversation_turns
             WHERE lead_id IN (' . $inList . ") AND status IN ('buffering', 'processing')",
            '',
            []
        );

        if ((int) ($pending['c'] ?? 0) === 0) {
            break;
        }

        $next = db_fetch(
            'SELECT MIN(finalize_after) AS next_at, MAX(last_message_at) AS last_at FROM conversation_turns
             WHERE lead_id IN (' . $inList . ") AND status = 'buffering'",
            '',
            []
        );

        if (!$next || empty($next['next_at'])) {
            usleep(300000);
            continue;
        }

        $waitUntil = strtotime((string) $next['next_at']);
        $lastAt = !empty($next['last_at']) ? strtotime((string) $next['last_at']) : 0;
        $quietUntil = $lastAt > 0 ? $lastAt + $quietSec : $waitUntil;
        $target = max($waitUntil, $quietUntil);
        if ($target > time()) {
            $sleepMs = min(1000, max(200, ($target - time()) * 1000));
            usleep((int) ($sleepMs * 1000));
        } else {
            usleep(200000);
        }
    } while (microtime(true) < $deadline);

    // One extra quiet drain — never force a reply while bubbles are still arriving.
    $lastRow = db_fetch(
        'SELECT MAX(last_message_at) AS last_at FROM conversation_turns
         WHERE lead_id IN (' . $inList . ") AND status = 'buffering'",
        '',
        []
    );
    $lastAt = !empty($lastRow['last_at']) ? strtotime((string) $lastRow['last_at']) : 0;
    if ($lastAt > 0) {
        $remain = $quietSec - (time() - $lastAt);
        if ($remain > 0) {
            usleep(min($remain, $quietSec) * 1000000);
        }
    }

    turn_engine_process_due(25, $leadIds);

    $stillWaiting = db_fetch(
        'SELECT COUNT(*) AS c FROM conversation_turns
         WHERE lead_id IN (' . $inList . ") AND status = 'buffering'
         AND last_message_at > DATE_SUB(NOW(), INTERVAL " . $quietSec . ' SECOND)',
        '',
        []
    );
    if ((int) ($stillWaiting['c'] ?? 0) > 0) {
        turn_engine_dispatch_worker($leadIds);
    }
}

/**
 * Resolve the primary due turn for a lead after consolidation (never a merged/cancelled id).
 *
 * @return array<string, mixed>|null
 */
function turn_engine_fetch_due_turn_row(int $leadId): ?array
{
    turn_engine_consolidate_buffering_turns($leadId);

    $row = db_fetch(
        'SELECT t.*, b.whatsapp_phone_id, b.whatsapp_token, b.id AS bot_row_id, b.user_id, b.name, b.persona_description
         FROM conversation_turns t
         INNER JOIN bots b ON b.id = t.bot_id
         WHERE t.lead_id = ? AND ' . turn_engine_quiet_due_sql('t') . '
         ORDER BY t.finalize_after ASC LIMIT 1',
        'i',
        [$leadId]
    );

    return $row ?: null;
}

/**
 * Queue processing after debounce — never generate on ingest.
 *
 * @param int|list<int> $leadIds
 */
function turn_engine_schedule_lead_processing($leadIds): bool
{
    if (!is_array($leadIds)) {
        $leadIds = [(int) $leadIds];
    }

    return turn_engine_dispatch_worker($leadIds);
}

/**
 * Fire-and-forget worker — survives cPanel killing the webhook after fastcgi_finish_request.
 *
 * @param list<int> $leadIds
 */
function turn_engine_dispatch_worker(array $leadIds): bool
{
    $leadIds = array_values(array_unique(array_filter(array_map('intval', $leadIds))));
    if ($leadIds === [] || !defined('APP_URL') || APP_URL === '') {
        return false;
    }

    $key = defined('CRON_SECRET') ? (string) CRON_SECRET : '';
    if ($key === '') {
        error_log('turn_engine_dispatch_worker: CRON_SECRET not configured');

        return false;
    }

    $url = rtrim(APP_URL, '/') . '/api/turn-worker.php';
    $body = json_encode(['lead_ids' => $leadIds, 'key' => $key]);
    if ($body === false) {
        return false;
    }

    if (turn_engine_dispatch_worker_curl($url, $body)) {
        return true;
    }

    return turn_engine_dispatch_worker_fsockopen($url, $body);
}

function turn_engine_dispatch_worker_curl(string $url, string $body): bool
{
    if (!function_exists('curl_init')) {
        return false;
    }

    $ch = curl_init($url);
    if ($ch === false) {
        return false;
    }

    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Connection: Close'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 1,
        CURLOPT_CONNECTTIMEOUT => 1,
        CURLOPT_NOSIGNAL       => true,
        CURLOPT_SSL_VERIFYPEER => defined('META_GRAPH_SSL_VERIFY') ? (bool) META_GRAPH_SSL_VERIFY : true,
        CURLOPT_SSL_VERIFYHOST => defined('META_GRAPH_SSL_VERIFY') && !META_GRAPH_SSL_VERIFY ? 0 : 2,
    ]);

    $ok = @curl_exec($ch) !== false;
    $errno = curl_errno($ch);
    if (!$ok && $errno !== 0) {
        error_log('turn_engine_dispatch_worker: curl failed errno=' . $errno . ' ' . curl_error($ch));
    }
    curl_close($ch);

    return $ok;
}

function turn_engine_dispatch_worker_fsockopen(string $url, string $body): bool
{
    $parts = parse_url($url);
    if ($parts === false || empty($parts['host'])) {
        return false;
    }

    $host = $parts['host'];
    $scheme = strtolower((string) ($parts['scheme'] ?? 'https'));
    $port = (int) ($parts['port'] ?? ($scheme === 'https' ? 443 : 80));
    $path = ($parts['path'] ?? '/') . (isset($parts['query']) ? '?' . $parts['query'] : '');
    $transport = ($scheme === 'https') ? 'ssl://' : '';

    $errno = 0;
    $errstr = '';
    $fp = @fsockopen($transport . $host, $port, $errno, $errstr, 2);
    if (!$fp) {
        error_log('turn_engine_dispatch_worker: fsockopen failed ' . $errno . ' ' . $errstr);

        return false;
    }

    stream_set_timeout($fp, 1);

    $headers = [
        'POST ' . $path . ' HTTP/1.1',
        'Host: ' . $host,
        'Content-Type: application/json',
        'Content-Length: ' . strlen($body),
        'Connection: Close',
        '',
        $body,
    ];

    @fwrite($fp, implode("\r\n", $headers));
    @fclose($fp);

    return true;
}

/** @return array<string, mixed>|null */
function turn_engine_get_turn_diagnostics(int $turnId): ?array
{
    turn_engine_ensure_schema();
    $turn = db_fetch('SELECT * FROM conversation_turns WHERE id = ?', 'i', [$turnId]);
    if (!$turn) {
        return null;
    }

    $messageSql = 'SELECT wa_message_id, message_type, raw_text, caption, transcription, image_description, processing_status, created_at';
    if (db_column_exists('conversation_turn_messages', 'document_text')) {
        $messageSql = 'SELECT wa_message_id, message_type, raw_text, caption, transcription, image_description,
                document_text, ocr_text, provider, confidence, processing_status, created_at';
    }
    $messages = db_fetch_all(
        $messageSql . ' FROM conversation_turn_messages WHERE turn_id = ? ORDER BY sort_order ASC',
        'i',
        [$turnId]
    );

    $events = db_fetch_all(
        'SELECT event_type, detail_json, created_at FROM conversation_turn_events WHERE turn_id = ? ORDER BY id ASC',
        'i',
        [$turnId]
    );

    require_once __DIR__ . '/conversation-intelligence.php';
    $intel = conversation_intelligence_diagnostics($turnId) ?? [];

    return [
        'turn'          => $turn,
        'messages'      => $messages,
        'events'        => $events,
        'intelligence'  => $intel['intelligence'] ?? null,
        'generations'   => $intel['generations'] ?? [],
        'memory'        => $intel['memory'] ?? [],
        'state'         => $intel['state'] ?? [],
    ];
}

/**
 * Read-only product status — core human-like behaviors are always on.
 *
 * @return list<array{label: string, status: string}>
 */
function conversation_engine_core_status(): array
{
    return [
        ['label' => 'Conversational turn aggregation', 'status' => 'Active'],
        ['label' => 'Multi-message understanding', 'status' => 'Active'],
        ['label' => 'Multi-image aggregation', 'status' => 'Active'],
        ['label' => 'Voice aggregation', 'status' => 'Active'],
        ['label' => 'Duplicate protection', 'status' => 'Active'],
        ['label' => 'Response race protection', 'status' => 'Active'],
        ['label' => 'Catalog verification', 'status' => 'Active'],
        ['label' => 'Human handoff protection', 'status' => 'Active'],
        ['label' => 'Live human-agent protocol', 'status' => 'Active'],
    ];
}

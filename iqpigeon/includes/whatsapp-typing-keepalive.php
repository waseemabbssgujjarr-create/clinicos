<?php
/**
 * Background typing keepalive — keeps WhatsApp "typing…" bubble alive during AI + delay.
 * Only one session per inbound message id can pulse. A newer start supersedes the old one.
 */

require_once __DIR__ . '/../config.php';

function whatsapp_typing_session_dir(): string
{
    $dir = dirname(__DIR__) . '/storage/typing-sessions';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }

    return $dir;
}

function whatsapp_typing_stop_path(string $messageId): string
{
    return whatsapp_typing_session_dir() . '/stop-' . md5(trim($messageId)) . '.flag';
}

function whatsapp_typing_active_path(string $messageId): string
{
    return whatsapp_typing_session_dir() . '/active-' . md5(trim($messageId)) . '.txt';
}

/**
 * Fire-and-forget POST so typing pulses continue while the worker runs AI.
 */
function whatsapp_typing_keepalive_start(string $phoneId, string $token, string $messageId): void
{
    $messageId = trim($messageId);
    if ($messageId === '' || !defined('APP_URL') || APP_URL === '') {
        return;
    }

    $sessionId = bin2hex(random_bytes(12));
    $sessionFile = whatsapp_typing_session_dir() . '/' . $sessionId . '.json';
    $payload = json_encode([
        'phone_id'   => $phoneId,
        'token'      => $token,
        'message_id' => $messageId,
        'session_id' => $sessionId,
        'started_at' => time(),
    ]);

    if (@file_put_contents($sessionFile, $payload, LOCK_EX) === false) {
        return;
    }

    @file_put_contents(whatsapp_typing_active_path($messageId), $sessionId, LOCK_EX);
    @unlink(whatsapp_typing_stop_path($messageId));

    $url = rtrim(APP_URL, '/') . '/api/whatsapp-typing-keepalive.php';
    $body = json_encode(['session_id' => $sessionId]);
    $parts = parse_url($url);
    if ($parts === false || empty($parts['host'])) {
        return;
    }

    $host = $parts['host'];
    $port = $parts['port'] ?? (($parts['scheme'] ?? 'https') === 'https' ? 443 : 80);
    $path = ($parts['path'] ?? '/') . (isset($parts['query']) ? '?' . $parts['query'] : '');
    $scheme = ($port === 443) ? 'ssl://' : '';

    $errno = 0;
    $errstr = '';
    $fp = @fsockopen($scheme . $host, (int) $port, $errno, $errstr, 2);
    if (!$fp) {
        return;
    }

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
}

function whatsapp_typing_keepalive_stop(string $messageId): void
{
    $messageId = trim($messageId);
    if ($messageId === '') {
        return;
    }

    @file_put_contents(whatsapp_typing_stop_path($messageId), (string) time(), LOCK_EX);
    @file_put_contents(whatsapp_typing_active_path($messageId), 'stopped', LOCK_EX);
}

function whatsapp_typing_keepalive_run(string $sessionId): void
{
    require_once __DIR__ . '/whatsapp.php';

    $sessionId = preg_replace('/[^a-f0-9]/', '', strtolower($sessionId)) ?? '';
    if ($sessionId === '') {
        return;
    }

    $sessionFile = whatsapp_typing_session_dir() . '/' . $sessionId . '.json';
    if (!is_file($sessionFile)) {
        return;
    }

    $data = json_decode((string) file_get_contents($sessionFile), true);
    if (!is_array($data)) {
        @unlink($sessionFile);

        return;
    }

    $phoneId = (string) ($data['phone_id'] ?? '');
    $token = (string) ($data['token'] ?? '');
    $messageId = trim((string) ($data['message_id'] ?? ''));

    if ($phoneId === '' || $token === '' || $messageId === '') {
        @unlink($sessionFile);

        return;
    }

    @set_time_limit(100);
    ignore_user_abort(true);

    $pulseSec = defined('WHATSAPP_TYPING_PULSE_MS') ? max(8, (int) WHATSAPP_TYPING_PULSE_MS / 1000) : 20;
    $maxSec = defined('WHATSAPP_TYPING_KEEPALIVE_MAX_SEC') ? (int) WHATSAPP_TYPING_KEEPALIVE_MAX_SEC : 90;
    $deadline = time() + max(20, min(90, $maxSec));
    $stopPath = whatsapp_typing_stop_path($messageId);
    $activePath = whatsapp_typing_active_path($messageId);

    try {
        while (time() < $deadline) {
            if (is_file($stopPath)) {
                break;
            }
            $active = is_file($activePath) ? trim((string) @file_get_contents($activePath)) : '';
            if ($active !== $sessionId) {
                break;
            }

            whatsapp_send_typing_indicator($phoneId, $token, $messageId);
            sleep($pulseSec);
        }
    } finally {
        @unlink($sessionFile);
    }
}

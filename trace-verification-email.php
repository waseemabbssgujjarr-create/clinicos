<?php
/**
 * trace-verification-email.php — find where verify emails went
 *
 * Upload to site root, open:
 *   https://clinicos.workee.online/trace-verification-email.php?key=DMA-SETUP-2026&email=haydenak63@gmail.com
 *
 * Optional:
 *   &action=resend     — call Node API resend-verification (same as browser button)
 *   &action=test-smtp   — send plain SMTP test to &to= address
 *
 * DELETE this file after debugging.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const TRACE_KEY = 'DMA-SETUP-2026';

function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (($_GET['key'] ?? '') !== TRACE_KEY) {
    respond([
        'ok' => false,
        'error' => 'Forbidden',
        'usage' => '?key=' . TRACE_KEY . '&email=USER@gmail.com',
    ], 403);
}

$email = trim((string)($_GET['email'] ?? 'haydenak63@gmail.com'));
$action = strtolower(trim((string)($_GET['action'] ?? 'trace')));
$testTo = trim((string)($_GET['to'] ?? $email));

function find_env_file() {
    foreach ([
        __DIR__ . '/clinicos-api/.env',
        __DIR__ . '/.env',
    ] as $path) {
        if (is_readable($path)) return $path;
    }
    return null;
}

function parse_env_file($path) {
    $out = [];
    if (!$path || !is_readable($path)) return $out;
    foreach (preg_split('/\r\n|\r|\n/', file_get_contents($path)) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        if (!preg_match('/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/', $line, $m)) continue;
        $val = trim($m[2], " \t\"'");
        $out[$m[1]] = $val;
    }
    return $out;
}

function parse_database_url($raw) {
    $url = trim($raw, " \t\n\r\0\x0B\"'");
    if (stripos($url, 'mysql://') !== 0) return ['error' => 'DATABASE_URL must start with mysql://'];
    $parts = parse_url('http://' . substr($url, 8));
    if (!$parts || empty($parts['host']) || empty($parts['user']) || empty($parts['path'])) {
        return ['error' => 'Could not parse DATABASE_URL'];
    }
    return [
        'user' => urldecode($parts['user']),
        'pass' => isset($parts['pass']) ? urldecode($parts['pass']) : '',
        'host' => $parts['host'],
        'port' => isset($parts['port']) ? (int)$parts['port'] : 3306,
        'db'   => ltrim(explode('?', ltrim($parts['path'], '/'))[0], '/'),
    ];
}

function mask_secret($val) {
    $val = (string)$val;
    if ($val === '') return '(empty)';
    if (strlen($val) <= 4) return '****';
    return '****' . strlen($val) . 'chars****' . substr($val, -2);
}

function tail_log($path, $lines = 40) {
    if (!$path || !is_readable($path)) {
        return ['path' => $path, 'readable' => false, 'lines' => []];
    }
    $all = @file($path, FILE_IGNORE_NEW_LINES);
    if (!$all) return ['path' => $path, 'readable' => true, 'lines' => []];
    return [
        'path' => $path,
        'readable' => true,
        'lines' => array_slice($all, -$lines),
    ];
}

function grep_log_lines($path, $patterns, $max = 30) {
    $t = tail_log($path, 500);
    if (empty($t['lines'])) return [];
    $hits = [];
    foreach ($t['lines'] as $line) {
        foreach ((array)$patterns as $p) {
            if (stripos($line, $p) !== false) {
                $hits[] = $line;
                break;
            }
        }
        if (count($hits) >= $max) break;
    }
    return $hits;
}

function curl_json($url, $method = 'GET', $body = null, $timeout = 15) {
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'error' => 'curl not available'];
    }
    $ch = curl_init($url);
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
    ];
    if ($body !== null) {
        $opts[CURLOPT_POSTFIELDS] = is_string($body) ? $body : json_encode($body);
    }
    curl_setopt_array($ch, $opts);
    $raw = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    $json = json_decode($raw ?: '', true);
    return [
        'ok' => $code > 0 && $code < 500,
        'http_code' => $code,
        'curl_error' => $err ?: null,
        'raw' => $raw,
        'json' => $json,
    ];
}

function probe_node_ports() {
    $ports = [];
    foreach ([3002, 3001] as $port) {
        $features = curl_json("http://127.0.0.1:{$port}/api/leads/features");
        $health = curl_json("http://127.0.0.1:{$port}/api/health/db");
        $ports[$port] = [
            'features_http' => $features['http_code'] ?? 0,
            'features_live' => ($features['http_code'] ?? 0) === 200 && strpos($features['raw'] ?? '', '"features"') !== false,
            'health_db' => $health['json'] ?? null,
            'health_http' => $health['http_code'] ?? 0,
        ];
    }
    return $ports;
}

function load_smtp_from_db($mysqli) {
    $rows = [];
    $res = @$mysqli->query(
        "SELECT `key`, value, updatedAt FROM PlatformSetting WHERE `key` IN ('SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','SMTP_FROM','APP_URL','APP_NAME') ORDER BY `key`"
    );
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $k = $row['key'];
            $v = $row['value'];
            $rows[$k] = [
                'value' => $k === 'SMTP_PASS' ? mask_secret($v) : $v,
                'updatedAt' => $row['updatedAt'] ?? null,
            ];
        }
        $res->free();
    }
    return $rows;
}

function table_has_columns($mysqli, $table, $cols) {
    $missing = [];
    foreach ($cols as $col) {
        $colEsc = $mysqli->real_escape_string($col);
        $tableEsc = $mysqli->real_escape_string($table);
        $r = @$mysqli->query("SHOW COLUMNS FROM `$tableEsc` LIKE '$colEsc'");
        if (!$r || $r->num_rows === 0) $missing[] = $col;
    }
    return $missing;
}

/** Minimal SMTP send (STARTTLS on 587 or SSL on 465) for delivery test */
function smtp_send_test($cfg, $to, $subject, $body) {
    $host = $cfg['SMTP_HOST'] ?? '';
    $port = (int)($cfg['SMTP_PORT'] ?? 587);
    $user = $cfg['SMTP_USER'] ?? '';
    $pass = $cfg['SMTP_PASS'] ?? '';
    $from = $cfg['SMTP_FROM'] ?? $user;
    if (!$host || !$user || !$pass) {
        return ['ok' => false, 'error' => 'SMTP_HOST/USER/PASS missing in merged config'];
    }
    if (!preg_match('/<.+@.+>/', $from)) {
        $from = "ClinicOS Trace <{$user}>";
    }
    preg_match('/<([^>]+)>/', $from, $fm);
    $fromAddr = $fm[1] ?? $user;

    $transport = ($port === 465) ? "ssl://{$host}:{$port}" : "tcp://{$host}:{$port}";
    $fp = @stream_socket_client($transport, $errno, $errstr, 15, STREAM_CLIENT_CONNECT);
    if (!$fp) return ['ok' => false, 'error' => "connect fail: $errstr ($errno)", 'host' => $host, 'port' => $port];

    stream_set_timeout($fp, 15);
    $read = function () use ($fp) {
        $out = '';
        while ($line = fgets($fp, 515)) {
            $out .= $line;
            if (isset($line[3]) && $line[3] === ' ') break;
        }
        return $out;
    };
    $cmd = function ($c) use ($fp, $read) {
        fwrite($fp, $c . "\r\n");
        return $read();
    };

    $greet = $read();
    if ($port !== 465) {
        $ehlo = $cmd('EHLO clinicos.workee.online');
        if (stripos($ehlo, 'STARTTLS') !== false) {
            $cmd('STARTTLS');
            stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            $cmd('EHLO clinicos.workee.online');
        }
    } else {
        $cmd('EHLO clinicos.workee.online');
    }

    $auth = $cmd('AUTH LOGIN');
    $cmd(base64_encode($user));
    $authResp = $cmd(base64_encode($pass));
    if (strpos($authResp, '235') === false) {
        fclose($fp);
        return ['ok' => false, 'error' => 'SMTP auth failed', 'smtp_response' => trim($authResp)];
    }

    $cmd("MAIL FROM:<{$fromAddr}>");
    $rcpt = $cmd("RCPT TO:<{$to}>");
    if (strpos($rcpt, '250') === false && strpos($rcpt, '251') === false) {
        fclose($fp);
        return ['ok' => false, 'error' => 'RCPT rejected', 'smtp_response' => trim($rcpt)];
    }
    $cmd('DATA');
    $msg = "From: {$from}\r\nTo: {$to}\r\nSubject: {$subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n{$body}\r\n.";
    $dataResp = $cmd($msg);
    $cmd('QUIT');
    fclose($fp);

    $ok = strpos($dataResp, '250') !== false;
    return [
        'ok' => $ok,
        'host' => $host,
        'port' => $port,
        'user' => $user,
        'from' => $from,
        'to' => $to,
        'smtp_data_response' => trim($dataResp),
        'note' => $ok
            ? 'Message accepted by SMTP server — check recipient inbox/spam and support@ bounces in 5–15 min'
            : 'SMTP server rejected DATA',
    ];
}

// ── Load env + DB ───────────────────────────────────────────────────────────
$envPath = find_env_file();
$env = parse_env_file($envPath);
$dbUrl = $env['DATABASE_URL'] ?? null;
if (!$dbUrl) respond(['ok' => false, 'error' => '.env DATABASE_URL missing', 'env_file' => $envPath], 500);

$db = parse_database_url($dbUrl);
if (!empty($db['error'])) respond(['ok' => false, 'error' => $db['error']], 500);

$mysqli = @new mysqli($db['host'], $db['user'], $db['pass'], $db['db'], $db['port']);
if ($mysqli->connect_error) {
    respond(['ok' => false, 'error' => 'MySQL: ' . $mysqli->connect_error], 500);
}
$mysqli->set_charset('utf8mb4');

$apiDir = is_dir(__DIR__ . '/clinicos-api') ? __DIR__ . '/clinicos-api' : __DIR__;
$logDir = $apiDir . '/logs';

// Merge SMTP: PlatformSetting overrides .env (same as Node)
$smtpDb = load_smtp_from_db($mysqli);
$smtpMerged = [
    'SMTP_HOST' => $smtpDb['SMTP_HOST']['value'] ?? ($env['SMTP_HOST'] ?? null),
    'SMTP_PORT' => $smtpDb['SMTP_PORT']['value'] ?? ($env['SMTP_PORT'] ?? '587'),
    'SMTP_USER' => $smtpDb['SMTP_USER']['value'] ?? ($env['SMTP_USER'] ?? null),
    'SMTP_PASS' => $env['SMTP_PASS'] ?? null,
];
// Real password for send tests — from .env; DB stores masked in output only
$resPass = @$mysqli->query("SELECT value FROM PlatformSetting WHERE `key`='SMTP_PASS' LIMIT 1");
if ($resPass && ($row = $resPass->fetch_assoc()) && !empty($row['value'])) {
    $smtpMerged['SMTP_PASS'] = $row['value'];
}
$smtpMerged['SMTP_FROM'] = $smtpDb['SMTP_FROM']['value'] ?? ($env['SMTP_FROM'] ?? null);
$smtpMerged['APP_URL'] = $smtpDb['APP_URL']['value'] ?? ($env['APP_URL'] ?? 'https://clinicos.workee.online');

// ── Account lookup ────────────────────────────────────────────────────────────
$emailEsc = $mysqli->real_escape_string($email);
$clinic = null;
$staff = null;

$r = @$mysqli->query("SELECT id, name, ownerName, email, emailVerified, emailVerifyToken, emailVerifyExpires, createdAt, updatedAt FROM Clinic WHERE email='{$emailEsc}' LIMIT 1");
if ($r && $r->num_rows) $clinic = $r->fetch_assoc();

$r2 = @$mysqli->query("SELECT id, name, email, emailVerified, emailVerifyToken, emailVerifyExpires, clinicId, createdAt FROM StaffMember WHERE email='{$emailEsc}' LIMIT 1");
if ($r2 && $r2->num_rows) $staff = $r2->fetch_assoc();

$verifyUrl = null;
if ($clinic && !empty($clinic['emailVerifyToken'])) {
    $verifyUrl = rtrim($smtpMerged['APP_URL'], '/') . '/verify-email/?token=' . urlencode($clinic['emailVerifyToken']) . '&email=' . urlencode($email);
}

$colMissingClinic = table_has_columns($mysqli, 'Clinic', ['emailVerified', 'emailVerifyToken', 'emailVerifyExpires']);

// ── Actions ─────────────────────────────────────────────────────────────────
$resendViaNode = null;
$smtpTest = null;

if ($action === 'resend') {
    foreach ([3002, 3001] as $port) {
        $resendViaNode = curl_json(
            "http://127.0.0.1:{$port}/api/auth/resend-verification",
            'POST',
            ['email' => $email]
        );
        $resendViaNode['port'] = $port;
        if (($resendViaNode['http_code'] ?? 0) >= 200 && ($resendViaNode['http_code'] ?? 0) < 500) break;
    }
    // Refresh clinic row after resend (new token)
    $r = @$mysqli->query("SELECT emailVerified, emailVerifyToken, emailVerifyExpires, updatedAt FROM Clinic WHERE email='{$emailEsc}' LIMIT 1");
    if ($r && $r->num_rows) {
        $fresh = $r->fetch_assoc();
        $clinic = array_merge($clinic ?: [], $fresh);
        if (!empty($clinic['emailVerifyToken'])) {
            $verifyUrl = rtrim($smtpMerged['APP_URL'], '/') . '/verify-email/?token=' . urlencode($clinic['emailVerifyToken']) . '&email=' . urlencode($email);
        }
    }
}

if ($action === 'test-smtp') {
    $smtpTest = smtp_send_test($smtpMerged, $testTo, 'ClinicOS trace SMTP test', "Plain SMTP test sent at " . date('c') . "\nIf you see this, SMTP delivery path works.\n");
}

// Proxy path test (what browser uses)
$resendViaProxy = curl_json(
    'https://' . ($_SERVER['HTTP_HOST'] ?? 'clinicos.workee.online') . '/api/auth/resend-verification',
    'POST',
    ['email' => $email]
);

// ── Log grep ────────────────────────────────────────────────────────────────
$emailLogHits = array_merge(
    grep_log_lines($logDir . '/startup.log', [$email, 'Verification email', 'Email sent', 'Failed to send', '535', 'SMTP'], 25),
    grep_log_lines($logDir . '/force-start.log', [$email, 'SMTP', 'Killed'], 15),
    grep_log_lines(__DIR__ . '/logs/api-proxy.log', ['resend-verification', $email, 'tcp3002'], 15)
);

// ── Diagnosis ───────────────────────────────────────────────────────────────
$diagnosis = [];
if (!$clinic && !$staff) {
    $diagnosis[] = "No Clinic or StaffMember row for {$email} — register first or typo in email (53 vs 63 vs 83).";
} elseif ($clinic && (int)($clinic['emailVerified'] ?? 0) === 1) {
    $diagnosis[] = 'Clinic email already verified — no verify email needed; sign in at /doctor-login/';
} elseif (!empty($colMissingClinic)) {
    $diagnosis[] = 'Missing DB columns: ' . implode(', ', $colMissingClinic) . ' — run php clinicos-api/add-email-verification.php';
} elseif ($clinic && empty($clinic['emailVerifyToken'])) {
    $diagnosis[] = 'No verify token in DB yet — click Resend or open ?action=resend on this trace URL.';
} else {
    $diagnosis[] = 'Token exists in DB — if inbox empty, check Gmail Spam and support@ webmail for bounces.';
}

if ($resendViaNode && ($resendViaNode['json']['code'] ?? '') === 'EMAIL_SEND_FAILED') {
    $diagnosis[] = 'Node says SMTP send failed: ' . ($resendViaNode['json']['detail'] ?? $resendViaNode['json']['error'] ?? 'unknown');
}
if ($resendViaNode && ($resendViaNode['json']['found'] ?? null) === false) {
    $diagnosis[] = 'Node API: email not registered (found:false).';
}
if ($resendViaNode && ($resendViaNode['json']['code'] ?? '') === 'DB_UNAVAILABLE') {
    $diagnosis[] = 'Node cannot reach DB — bash clinicos-api/force-start-api.sh';
}

$nodePorts = probe_node_ports();

respond([
    'ok' => true,
    'traced_at' => date('c'),
    'email' => $email,
    'action' => $action,
    'diagnosis' => $diagnosis,
    'account' => [
        'clinic' => $clinic ? [
            'id' => $clinic['id'],
            'name' => $clinic['name'] ?? null,
            'ownerName' => $clinic['ownerName'] ?? null,
            'emailVerified' => (int)($clinic['emailVerified'] ?? 0),
            'hasToken' => !empty($clinic['emailVerifyToken']),
            'tokenPreview' => !empty($clinic['emailVerifyToken']) ? substr($clinic['emailVerifyToken'], 0, 8) . '…' : null,
            'expires' => $clinic['emailVerifyExpires'] ?? null,
            'expired' => !empty($clinic['emailVerifyExpires']) && strtotime($clinic['emailVerifyExpires']) < time(),
            'updatedAt' => $clinic['updatedAt'] ?? null,
        ] : null,
        'staff' => $staff ?: null,
    ],
    'verify_link_in_db' => $verifyUrl,
    'verify_link_note' => $verifyUrl
        ? 'Open this link directly if email never arrives (same as message body link)'
        : 'No token — run ?action=resend first',
    'smtp' => [
        'from_env' => [
            'SMTP_HOST' => $env['SMTP_HOST'] ?? null,
            'SMTP_PORT' => $env['SMTP_PORT'] ?? null,
            'SMTP_USER' => $env['SMTP_USER'] ?? null,
            'SMTP_PASS' => mask_secret($env['SMTP_PASS'] ?? ''),
            'SMTP_FROM' => $env['SMTP_FROM'] ?? null,
        ],
        'from_platform_setting' => $smtpDb,
        'merged_for_send' => [
            'SMTP_HOST' => $smtpMerged['SMTP_HOST'],
            'SMTP_PORT' => $smtpMerged['SMTP_PORT'],
            'SMTP_USER' => $smtpMerged['SMTP_USER'],
            'SMTP_PASS' => mask_secret($smtpMerged['SMTP_PASS'] ?? ''),
            'SMTP_FROM' => $smtpMerged['SMTP_FROM'],
        ],
    ],
    'node' => [
        'ports' => $nodePorts,
        'resend_direct' => $resendViaNode,
    ],
    'browser_path' => [
        'resend_via_https_proxy' => [
            'http_code' => $resendViaProxy['http_code'] ?? 0,
            'json' => $resendViaProxy['json'] ?? null,
            'curl_error' => $resendViaProxy['curl_error'] ?? null,
        ],
    ],
    'smtp_test' => $smtpTest,
    'logs' => [
        'email_related_lines' => $emailLogHits,
        'startup_tail' => tail_log($logDir . '/startup.log', 15),
        'api_proxy_tail' => tail_log(__DIR__ . '/logs/api-proxy.log', 10),
    ],
    'next_steps' => [
        '1' => 'Open trace: ?key=' . TRACE_KEY . '&email=' . rawurlencode($email),
        '2' => 'Force resend via Node: add &action=resend',
        '3' => 'Plain SMTP test: &action=test-smtp&to=' . rawurlencode($email),
        '4' => 'If verify_link_in_db is set, open it in browser (bypasses email)',
        '5' => 'Check support@ webmail Sent + Inbox for bounces to ' . $email,
        '6' => 'cPanel → Email → Track Delivery for messages to ' . $email,
        '7' => 'Delete this file when done',
    ],
]);

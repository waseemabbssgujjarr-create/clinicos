<?php
/**
 * verify-unblock.php — verify without waiting for HTML email
 *
 * https://clinicos.workee.online/verify-unblock.php?key=DMA-SETUP-2026&email=haydenak63@gmail.com
 *
 * &go=1        → redirect to verify link in DB
 * &send=1      → send PLAIN verify email (same path as working trace SMTP test)
 * &mark=1      → set emailVerified=1 (emergency admin bypass)
 *
 * DELETE after use.
 */
const UNBLOCK_KEY = 'DMA-SETUP-2026';

$key = $_GET['key'] ?? '';
$email = trim((string)($_GET['email'] ?? 'haydenak63@gmail.com'));

if ($key !== UNBLOCK_KEY) {
    http_response_code(403);
    echo 'Forbidden. Use ?key=' . UNBLOCK_KEY . '&email=YOUR@gmail.com';
    exit;
}

function find_env_file() {
    foreach ([__DIR__ . '/clinicos-api/.env', __DIR__ . '/.env'] as $p) {
        if (is_readable($p)) return $p;
    }
    return null;
}

function parse_env_file($path) {
    $out = [];
    foreach (preg_split('/\r\n|\r|\n/', file_get_contents($path)) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        if (preg_match('/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/', $line, $m)) {
            $out[$m[1]] = trim($m[2], " \t\"'");
        }
    }
    return $out;
}

function parse_database_url($raw) {
    $url = trim($raw, " \t\"'");
    $parts = parse_url('http://' . substr($url, 8));
    return [
        'user' => urldecode($parts['user']),
        'pass' => urldecode($parts['pass'] ?? ''),
        'host' => $parts['host'],
        'port' => (int)($parts['port'] ?? 3306),
        'db'   => ltrim(explode('?', ltrim($parts['path'], '/'))[0], '/'),
    ];
}

function smtp_send_plain($cfg, $to, $subject, $body) {
    $host = $cfg['SMTP_HOST'];
    $port = (int)$cfg['SMTP_PORT'];
    $user = $cfg['SMTP_USER'];
    $pass = $cfg['SMTP_PASS'];
    $from = $cfg['SMTP_FROM'] ?? $user;
    if (!preg_match('/<.+@.+>/', $from)) $from = "Doctors My Agency <{$user}>";
    preg_match('/<([^>]+)>/', $from, $fm);
    $fromAddr = $fm[1] ?? $user;

    $transport = ($port === 465) ? "ssl://{$host}:{$port}" : "tcp://{$host}:{$port}";
    $fp = @stream_socket_client($transport, $errno, $errstr, 15);
    if (!$fp) return ['ok' => false, 'error' => "$errstr ($errno)"];

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

    $read();
    if ($port !== 465) {
        $cmd('EHLO clinicos.workee.online');
        $cmd('STARTTLS');
        stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
        $cmd('EHLO clinicos.workee.online');
    } else {
        $cmd('EHLO clinicos.workee.online');
    }
    $cmd('AUTH LOGIN');
    $cmd(base64_encode($user));
    $auth = $cmd(base64_encode($pass));
    if (strpos($auth, '235') === false) {
        fclose($fp);
        return ['ok' => false, 'error' => 'SMTP auth failed: ' . trim($auth)];
    }
    $cmd("MAIL FROM:<{$fromAddr}>");
    $rcpt = $cmd("RCPT TO:<{$to}>");
    if (strpos($rcpt, '250') === false && strpos($rcpt, '251') === false) {
        fclose($fp);
        return ['ok' => false, 'error' => 'RCPT failed: ' . trim($rcpt)];
    }
    $cmd('DATA');
    $msg = "From: {$from}\r\nTo: {$to}\r\nSubject: {$subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n{$body}\r\n.";
    $data = $cmd($msg);
    $cmd('QUIT');
    fclose($fp);
    return ['ok' => strpos($data, '250') !== false, 'smtp' => trim($data)];
}

// ── DB ──────────────────────────────────────────────────────────────────────
$env = parse_env_file(find_env_file());
$db = parse_database_url($env['DATABASE_URL'] ?? '');
$mysqli = new mysqli($db['host'], $db['user'], $db['pass'], $db['db'], $db['port']);
if ($mysqli->connect_error) {
    http_response_code(500);
    echo 'DB error: ' . $mysqli->connect_error;
    exit;
}

$esc = $mysqli->real_escape_string($email);
$res = $mysqli->query("SELECT id, ownerName, email, emailVerified, emailVerifyToken, emailVerifyExpires FROM Clinic WHERE email='{$esc}' LIMIT 1");
$clinic = $res ? $res->fetch_assoc() : null;

if (!$clinic) {
    http_response_code(404);
    echo "No clinic registered for {$email}. Register first or fix email typo (63 vs 53 vs 83).";
    exit;
}

$appUrl = $env['APP_URL'] ?? 'https://clinicos.workee.online';
$token = $clinic['emailVerifyToken'];
if (!$token) {
    $token = bin2hex(random_bytes(32));
    $exp = date('Y-m-d H:i:s', time() + 86400);
    $tokEsc = $mysqli->real_escape_string($token);
    $mysqli->query("UPDATE Clinic SET emailVerifyToken='{$tokEsc}', emailVerifyExpires='{$exp}', emailVerified=0 WHERE id='{$mysqli->real_escape_string($clinic['id'])}'");
}

$verifyUrl = rtrim($appUrl, '/') . '/verify-email/?token=' . urlencode($token) . '&email=' . urlencode($email);

// SMTP merge
$smtp = [
    'SMTP_HOST' => $env['SMTP_HOST'] ?? 'mail.workee.online',
    'SMTP_PORT' => $env['SMTP_PORT'] ?? '587',
    'SMTP_USER' => $env['SMTP_USER'] ?? 'support@clinicos.workee.online',
    'SMTP_PASS' => $env['SMTP_PASS'] ?? '',
    'SMTP_FROM' => $env['SMTP_FROM'] ?? 'Doctors My Agency <support@clinicos.workee.online>',
];
$r = $mysqli->query("SELECT `key`, value FROM PlatformSetting WHERE `key` LIKE 'SMTP_%' OR `key`='APP_URL'");
while ($r && ($row = $r->fetch_assoc())) {
    if ($row['key'] === 'SMTP_PASS' && $row['value'] !== '') $smtp['SMTP_PASS'] = $row['value'];
    elseif ($row['key'] !== 'SMTP_PASS') $smtp[$row['key']] = $row['value'];
}

// ── Actions ─────────────────────────────────────────────────────────────────
/** Verify in MySQL via PHP — does not need Node (verify-email page hits dead API). */
if (isset($_GET['go']) || isset($_GET['verify'])) {
    $idEsc = $mysqli->real_escape_string($clinic['id']);
    if ((int)$clinic['emailVerified'] === 1) {
        header('Location: /doctor-login/?verified=1');
        exit;
    }
    $exp = $clinic['emailVerifyExpires'] ?? null;
    if ($exp && strtotime($exp) < time()) {
        http_response_code(400);
        echo 'Verification link expired. Open this page without &go and click Send plain verify email, or use Integrations resend after Node restart.';
        exit;
    }
    $mysqli->query("UPDATE Clinic SET emailVerified=1, emailVerifyToken=NULL, emailVerifyExpires=NULL WHERE id='{$idEsc}'");
    header('Location: /doctor-login/?verified=1');
    exit;
}

if (isset($_GET['mark'])) {
    $mysqli->query("UPDATE Clinic SET emailVerified=1, emailVerifyToken=NULL, emailVerifyExpires=NULL WHERE id='{$mysqli->real_escape_string($clinic['id'])}'");
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:520px;margin:40px auto;padding:20px">';
    echo '<h1>Email marked verified</h1><p>You can sign in now at <a href="/doctor-login/">/doctor-login/</a></p>';
    echo '<p><strong>Delete verify-unblock.php from the server.</strong></p></body></html>';
    exit;
}

$sendResult = null;
if (isset($_GET['send'])) {
    $name = $clinic['ownerName'] ?: 'Doctor';
    $body = "Hi {$name},\n\nVerify your Doctors My Agency account:\n\n{$verifyUrl}\n\nLink expires in 24 hours.\n";
    $sendResult = smtp_send_plain($smtp, $email, 'Verify your email — Doctors My Agency', $body);
}

header('Content-Type: text/html; charset=utf-8');
$verified = (int)$clinic['emailVerified'] === 1;
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Verify unblock — Doctors My Agency</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; max-width: 560px; margin: 40px auto; padding: 24px; }
    .card { background: #1e293b; border-radius: 12px; padding: 24px; border: 1px solid #334155; }
    h1 { font-size: 1.35rem; margin: 0 0 12px; }
    p { line-height: 1.5; color: #94a3b8; }
    .btn { display: inline-block; margin: 8px 8px 8px 0; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .primary { background: #f97316; color: #fff; }
    .secondary { background: transparent; color: #e2e8f0; border: 1px solid #64748b; }
    .ok { color: #86efac; }
    .warn { color: #fca5a5; font-size: 0.9rem; }
    code { word-break: break-all; font-size: 0.8rem; background: #0f172a; padding: 8px; display: block; border-radius: 6px; margin: 12px 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Verify without waiting for Gmail</h1>
    <p>Account: <strong><?= htmlspecialchars($email) ?></strong>
      <?= $verified ? '<span class="ok">(already verified)</span>' : '<span class="warn">(not verified yet)</span>' ?></p>

    <?php if ($sendResult !== null): ?>
      <p class="<?= $sendResult['ok'] ? 'ok' : 'warn' ?>">
        <?= $sendResult['ok'] ? 'Plain verify email sent — check inbox (same path as trace test).' : 'Send failed: ' . htmlspecialchars($sendResult['error'] ?? $sendResult['smtp'] ?? '?') ?>
      </p>
    <?php endif; ?>

    <p>Node HTML verify emails may not reach Gmail; plain SMTP tests do. Use one of these:</p>

    <a class="btn primary" href="?key=<?= urlencode(UNBLOCK_KEY) ?>&email=<?= urlencode($email) ?>&go=1">Verify now (PHP — no Node)</a>
    <a class="btn secondary" href="?key=<?= urlencode(UNBLOCK_KEY) ?>&email=<?= urlencode($email) ?>&send=1">Send plain verify email</a>
    <a class="btn secondary" href="/doctor-login/">Doctor login</a>

    <p>Node verify page needs API on :3002. If you see “Database unavailable”, use the button above (PHP + MySQL only).</p>
    <p style="margin-top:8px">Browser verify link (needs Node live):</p>
    <code><?= htmlspecialchars($verifyUrl) ?></code>

    <p class="warn" style="margin-top:20px">Emergency only — <a href="?key=<?= urlencode(UNBLOCK_KEY) ?>&email=<?= urlencode($email) ?>&mark=1" style="color:#fca5a5">mark verified in DB</a> (skip email entirely).</p>
    <p class="warn">Delete verify-unblock.php and trace-verification-email.php when done.</p>
  </div>
</body>
</html>

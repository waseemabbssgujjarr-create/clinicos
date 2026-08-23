<?php
/**
 * Reset Platform Admin password only (does not wipe clinics).
 *
 * Upload to site root, open once:
 *   https://clinicos.workee.online/reset-admin-password.php?key=DMA-SETUP-2026
 * Then DELETE this file from the server.
 */
header('Content-Type: application/json; charset=utf-8');

const SETUP_KEY = 'DMA-SETUP-2026';
const ADMIN_EMAIL = 'admin@doctorsmyagency.com';
const ADMIN_PASS  = 'DmaAdmin2026!';
const ADMIN_NAME  = 'DMA Platform Admin';

function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (($_GET['key'] ?? '') !== SETUP_KEY) {
    respond(['ok' => false, 'error' => 'Forbidden. Add ?key=' . SETUP_KEY], 403);
}

function find_env_file() {
    foreach ([__DIR__ . '/clinicos-api/.env', __DIR__ . '/.env'] as $path) {
        if (is_readable($path)) return $path;
    }
    return null;
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
        'db'   => ltrim($parts['path'], '/'),
    ];
}

function bcrypt_for_node($password) {
    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    if (strpos($hash, '$2y$') === 0) {
        $hash = '$2a$' . substr($hash, 4);
    }
    return $hash;
}

$envPath = find_env_file();
if (!$envPath) respond(['ok' => false, 'error' => '.env not found'], 500);

$content = file_get_contents($envPath);
if (!preg_match('/^DATABASE_URL=(.+)$/m', $content, $m)) {
    respond(['ok' => false, 'error' => 'DATABASE_URL missing in .env'], 500);
}

$cfg = parse_database_url($m[1]);
if (isset($cfg['error'])) respond(['ok' => false, 'error' => $cfg['error']], 500);

$mysqli = @new mysqli($cfg['host'], $cfg['user'], $cfg['pass'], $cfg['db'], $cfg['port']);
if ($mysqli->connect_errno) {
    respond(['ok' => false, 'error' => 'DB connect failed: ' . $mysqli->connect_error], 500);
}
$mysqli->set_charset('utf8mb4');

$hash = bcrypt_for_node(ADMIN_PASS);
$email = ADMIN_EMAIL;
$name = ADMIN_NAME;
$id = 'sa_dma_' . substr(md5($email), 0, 12);

$stmt = $mysqli->prepare('SELECT id FROM SuperAdmin WHERE email = ? LIMIT 1');
$stmt->bind_param('s', $email);
$stmt->execute();
$res = $stmt->get_result();
$existing = $res ? $res->fetch_assoc() : null;
$stmt->close();

if ($existing && !empty($existing['id'])) {
    $stmt = $mysqli->prepare('UPDATE SuperAdmin SET passwordHash = ?, name = ? WHERE id = ?');
    $stmt->bind_param('sss', $hash, $name, $existing['id']);
    $stmt->execute();
    $stmt->close();
    $action = 'updated';
    $id = $existing['id'];
} else {
    $stmt = $mysqli->prepare(
        'INSERT INTO SuperAdmin (id, email, passwordHash, name, createdAt) VALUES (?, ?, ?, ?, NOW())'
    );
    $stmt->bind_param('ssss', $id, $email, $hash, $name);
    $stmt->execute();
    $stmt->close();
    $action = 'created';
}

$mysqli->close();

respond([
    'ok' => true,
    'action' => $action,
    'message' => 'Platform admin password reset. DELETE reset-admin-password.php from the server now.',
    'login' => [
        'url' => 'https://clinicos.workee.online/admin-login/',
        'email' => ADMIN_EMAIL,
        'password' => ADMIN_PASS,
    ],
]);

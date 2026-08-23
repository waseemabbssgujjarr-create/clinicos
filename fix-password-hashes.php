<?php
/**
 * Fix bcrypt hashes created by PHP ($2y$) so Node.js bcryptjs can verify them.
 * Run once: https://clinicos.aderalabs.com/fix-password-hashes.php?key=DMA-SETUP-2026
 * Then DELETE this file.
 */
header('Content-Type: application/json; charset=utf-8');
const SETUP_KEY = 'DMA-SETUP-2026';
if (($_GET['key'] ?? '') !== SETUP_KEY) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Forbidden']);
    exit;
}

function find_env_file() {
    foreach ([__DIR__ . '/clinicos-api/.env', __DIR__ . '/.env'] as $path) {
        if (is_readable($path)) return $path;
    }
    return null;
}
function parse_database_url($raw) {
    $url = trim($raw, " \t\n\r\0\x0B\"'");
    $parts = parse_url('http://' . substr($url, 8));
    return [
        'user' => urldecode($parts['user']),
        'pass' => urldecode($parts['pass'] ?? ''),
        'host' => $parts['host'],
        'port' => $parts['port'] ?? 3306,
        'db'   => ltrim($parts['path'], '/'),
    ];
}

$envPath = find_env_file();
preg_match('/^DATABASE_URL=(.+)$/m', file_get_contents($envPath), $m);
$cfg = parse_database_url($m[1]);
$mysqli = new mysqli($cfg['host'], $cfg['user'], $cfg['pass'], $cfg['db'], $cfg['port']);

$fixed = 0;
foreach (['SuperAdmin' => 'passwordHash', 'Clinic' => 'passwordHash', 'StaffMember' => 'passwordHash'] as $table => $col) {
    $r = $mysqli->query("SELECT id, `$col` AS h FROM `$table`");
    if (!$r) continue;
    while ($row = $r->fetch_assoc()) {
        $h = $row['h'];
        if ($h && strpos($h, '$2y$') === 0) {
            $new = '$2a$' . substr($h, 4);
            $stmt = $mysqli->prepare("UPDATE `$table` SET `$col` = ? WHERE id = ?");
            $stmt->bind_param('ss', $new, $row['id']);
            $stmt->execute();
            $fixed++;
        }
    }
}
$mysqli->close();
echo json_encode(['ok' => true, 'fixed_hashes' => $fixed, 'message' => 'Password hashes fixed. Try admin-login again. DELETE this file now.'], JSON_PRETTY_PRINT);

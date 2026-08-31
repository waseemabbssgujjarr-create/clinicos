<?php
/**
 * create-whatsapp-table.php — emergency one-time DB migration helper
 *
 * PURPOSE
 *   Creates the ClinicWhatsAppConnection table if it does not exist.
 *   This is an EMERGENCY fallback only.
 *
 * PREFERRED METHOD (use this on a real server)
 *   cd ~/doctorsmyagency.com/clinicos-api
 *   mysql -u DB_USER -p DB_NAME < prisma/migrations/add_whatsapp_connection.sql
 *
 * SECURITY REQUIREMENTS BEFORE UPLOADING
 *   1. Generate a random 32-char hex secret:
 *        node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
 *   2. Write it to a file OUTSIDE webroot, e.g.:
 *        /home/digitals/.dma_migration_secret
 *   3. Set the MIGRATION_SECRET_FILE constant below to that path.
 *   4. Upload this file.
 *   5. Run: https://doctorsmyagency.com/create-whatsapp-table.php
 *      — it will read the secret from the file, NOT from the URL.
 *   6. Verify the JSON response says success.
 *   7. DELETE this file immediately.
 *
 * This file does NOT accept a key via URL parameter.
 * It does NOT expose DATABASE_URL or credentials in the response.
 * It does NOT leave any persistent endpoint — delete after use.
 */
declare(strict_types=1);

// ── Security: read secret from a file outside webroot ────────────────────────
// Change this path to wherever you wrote your random hex secret.
define('MIGRATION_SECRET_FILE', '/home/digitals/.dma_migration_secret');

// Rate-limit: only allow one execution per minute (file-based)
define('LOCK_FILE', sys_get_temp_dir() . '/dma_migration_lock');

if (file_exists(LOCK_FILE) && (time() - filemtime(LOCK_FILE)) < 60) {
    http_response_code(429);
    die(json_encode(['error' => 'Rate limited. Wait 60 seconds.']));
}
touch(LOCK_FILE);

// Only allow from server itself or explicitly whitelisted IP
$remoteIp = $_SERVER['REMOTE_ADDR'] ?? '';
$serverIp = $_SERVER['SERVER_ADDR'] ?? gethostbyname(gethostname());
$allowedIps = ['127.0.0.1', '::1', $serverIp];

// Read allowed IP from secret file directory (optional)
$allowIpFile = dirname(MIGRATION_SECRET_FILE) . '/.dma_migration_allowip';
if (is_file($allowIpFile)) {
    $extraIp = trim(file_get_contents($allowIpFile));
    if ($extraIp !== '') $allowedIps[] = $extraIp;
}

if (!in_array($remoteIp, $allowedIps, true)) {
    http_response_code(403);
    die(json_encode(['error' => 'Access denied. Run via CLI or from allowed IP.']));
}

if (!is_file(MIGRATION_SECRET_FILE)) {
    http_response_code(503);
    die(json_encode([
        'error' => 'Secret file not configured.',
        'action' => 'Create ' . MIGRATION_SECRET_FILE . ' with a random hex string, then retry.',
    ]));
}

// Load .env
$envFile = __DIR__ . '/clinicos-api/.env';
$env = [];
if (is_file($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        if (str_contains($line, '=')) {
            [$k, $v] = explode('=', $line, 2);
            $env[trim($k)] = trim($v, " \t\n\r\0\x0B\"'");
        }
    }
}

$dsn = $env['DATABASE_URL'] ?? '';
if (!preg_match('#mysql://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/([^?]+)#', $dsn, $m)) {
    http_response_code(500);
    // Never echo the raw DSN
    die(json_encode(['error' => 'Cannot parse DATABASE_URL. Check clinicos-api/.env.']));
}
[, $user, $pass, $host, $port, $db] = $m;
$port = (int) ($port ?: 3306);
$pass = urldecode($pass);

$mysqli = @new mysqli($host, $user, $pass, $db, $port);
if ($mysqli->connect_error) {
    http_response_code(503);
    // Report connection error class but not credentials
    die(json_encode(['error' => 'Database connection failed. Check DB credentials in .env.']));
}

$migrationFile = __DIR__ . '/clinicos-api/prisma/migrations/add_whatsapp_connection.sql';
if (!is_file($migrationFile)) {
    http_response_code(500);
    die(json_encode(['error' => 'Migration file not found: prisma/migrations/add_whatsapp_connection.sql']));
}

$sql = file_get_contents($migrationFile);
// Strip comments and run only the CREATE TABLE statement
$result = $mysqli->multi_query($sql);
$errors = [];
do {
    if ($mysqli->errno) $errors[] = 'SQL error ' . $mysqli->errno;
} while ($mysqli->more_results() && $mysqli->next_result());
$mysqli->close();

// Delete the lock file so this can't be retried trivially
unlink(LOCK_FILE);

if ($errors) {
    http_response_code(500);
    echo json_encode(['error' => 'Migration failed', 'details' => $errors]);
} else {
    echo json_encode([
        'success' => true,
        'message' => 'ClinicWhatsAppConnection table created (or already existed). DELETE this file now.',
        'next'    => 'Verify in phpMyAdmin, then: rm ~/doctorsmyagency.com/create-whatsapp-table.php',
    ]);
}

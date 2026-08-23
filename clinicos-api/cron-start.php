<?php
/**
 * cron-start.php — starts Node.js on TCP 3001 (Passenger bypass)
 *
 * cPanel → Cron Jobs → every 5 minutes:
 *   /usr/local/bin/php /home2/cognitom/clinicos.aderalabs.com/clinicos-api/cron-start.php
 *
 * Manual test (browser):
 *   https://clinicos.aderalabs.com/clinicos-api/cron-start.php?key=clinicos2026
 */
header('Content-Type: application/json');

$root = __DIR__;
$logFile = $root . '/logs/cron.log';
$secret = 'clinicos2026';

function clog($msg) {
    global $logFile;
    if (!is_dir(dirname($logFile))) @mkdir(dirname($logFile), 0755, true);
    @file_put_contents($logFile, date('c') . ' ' . $msg . "\n", FILE_APPEND);
}

// Manual browser trigger requires key; cron runs without key
$isCli = php_sapi_name() === 'cli' || !isset($_SERVER['HTTP_HOST']);
if (!$isCli && ($_GET['key'] ?? '') !== $secret) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden', 'hint' => 'Add ?key=clinicos2026 for manual test']);
    exit;
}

// Already running?
$fp = @fsockopen('127.0.0.1', 3001, $errno, $errstr, 1);
if ($fp) {
    fclose($fp);
    clog('skip: port 3001 already open');
    echo json_encode(['status' => 'already_running', 'port' => 3001]);
    exit;
}

// Find node binary (prefer v20)
$nodeBin = null;
$patterns = [
    '/home2/cognitom/nodevenv/clinicos.aderalabs.com/clinicos-api/20/bin/node',
    '/home2/cognitom/nodevenv/clinicos.aderalabs.com/clinicos-api/24/bin/node',
    '/home2/cognitom/nodevenv/clinicos.aderalabs.com/20/bin/node',
];
foreach ($patterns as $p) {
    if (file_exists($p)) { $nodeBin = $p; break; }
}
if (!$nodeBin) {
    $glob = glob('/home2/cognitom/nodevenv/clinicos.aderalabs.com/clinicos-api/*/bin/node') ?: [];
    $nodeBin = $glob[0] ?? null;
}

if (!$nodeBin) {
    clog('FATAL: node binary not found in nodevenv');
    echo json_encode(['error' => 'node binary not found', 'fix' => 'Run NPM Install in Setup Node.js App']);
    exit;
}

$serverJs = $root . '/server.js';
if (!file_exists($serverJs)) {
    clog('FATAL: server.js missing');
    echo json_encode(['error' => 'server.js missing']);
    exit;
}

clog('starting node: ' . $nodeBin);

$env = 'PORT=3001 NODE_ENV=production';
$cmd = 'cd ' . escapeshellarg($root)
    . ' && ' . $env . ' nohup ' . escapeshellarg($nodeBin) . ' ' . escapeshellarg($serverJs)
    . ' >> ' . escapeshellarg($logFile) . ' 2>&1 &';

$disabled = array_map('trim', explode(',', (string)ini_get('disable_functions')));
$canExec = !in_array('exec', $disabled, true) && function_exists('exec');

if ($canExec) {
    exec($cmd, $out, $code);
    clog('exec cmd=' . $cmd . ' exit=' . $code);
} else {
    clog('web PHP cannot exec — use cPanel Cron with start-node.sh (shell), not browser');
    echo json_encode([
        'error' => 'Browser cannot start Node on this host (exec disabled)',
        'fix' => 'Use cPanel → Cron Jobs → run start-node.sh every 5 minutes',
        'cron_command' => '/bin/bash /home2/cognitom/clinicos.aderalabs.com/clinicos-api/start-node.sh',
        'note' => 'This is normal on PakHosting — shell Cron works even when browser PHP does not',
    ]);
    exit;
}

sleep(2);
$fp2 = @fsockopen('127.0.0.1', 3001, $errno, $errstr, 2);
$running = (bool)$fp2;
if ($fp2) fclose($fp2);

echo json_encode([
    'status' => $running ? 'started' : 'start_attempted',
    'port' => 3001,
    'port_open' => $running,
    'node' => $nodeBin,
    'log' => $logFile,
    'next' => $running
        ? 'Test https://clinicos.aderalabs.com/api/leads/features'
        : 'Check clinicos-api/logs/cron.log for errors',
]);

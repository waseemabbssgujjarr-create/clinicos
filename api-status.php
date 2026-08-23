<?php
/**
 * api-status.php — open in browser (no Node needed)
 * https://clinicos.aderalabs.com/api-status.php
 */
header('Content-Type: application/json');

$home = '/home2/cognitom';
$apiRoot = $home . '/clinicos.aderalabs.com/clinicos-api';
$webRoot = $home . '/clinicos.aderalabs.com';

function tail_file($path, $lines = 30) {
    if (!file_exists($path)) return null;
    $content = @file_get_contents($path);
    if ($content === false) return '(unreadable)';
    $arr = explode("\n", trim($content));
    return array_slice($arr, -$lines);
}

function scan_sockets($base) {
    $found = [];
    if (!is_dir($base)) return $found;
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    foreach ($it as $file) {
        if ($file->isFile() && preg_match('/passenger\.so/i', $file->getFilename())) {
            $found[] = $file->getPathname();
        }
    }
    return $found;
}

function tcp_probe($port) {
    $fp = @fsockopen('127.0.0.1', $port, $errno, $errstr, 2);
    if ($fp) { fclose($fp); return 'open'; }
    return "closed ($errstr)";
}

function parse_database_url($envPath) {
    if (!file_exists($envPath)) return null;
    $content = @file_get_contents($envPath);
    if ($content === false) return null;
    if (!preg_match('/^DATABASE_URL=(.+)$/m', $content, $m)) return null;
    $url = trim($m[1], " \t\n\r\0\x0B\"'");
    if (!preg_match('#^mysql://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/([^?]+)#', $url, $p)) {
        return ['error' => 'DATABASE_URL format invalid in .env'];
    }
    return [
        'user' => rawurldecode($p[1]),
        'pass' => rawurldecode($p[2]),
        'host' => $p[3],
        'port' => $p[4] ?: '3306',
        'db'   => $p[5],
    ];
}

function db_probe($apiRoot) {
    $cfg = parse_database_url($apiRoot . '/.env');
    if (!$cfg) return ['status' => 'no_env', 'message' => 'DATABASE_URL not found in clinicos-api/.env'];
    if (isset($cfg['error'])) return ['status' => 'bad_format', 'message' => $cfg['error']];
    $mysqli = @new mysqli($cfg['host'], $cfg['user'], $cfg['pass'], $cfg['db'], (int)$cfg['port']);
    if ($mysqli->connect_errno) {
        return [
            'status'  => 'auth_failed',
            'message' => $mysqli->connect_error,
            'hint'    => 'Fix password in clinicos-api/.env DATABASE_URL — cPanel → MySQL Databases → change user password to match',
        ];
    }
    $tables = [];
    $res = $mysqli->query("SHOW TABLES LIKE 'Clinic'");
    if ($res && $res->num_rows > 0) $tables[] = 'Clinic';
    $mysqli->close();
    return [
        'status'  => 'ok',
        'message' => 'MySQL connection successful',
        'clinic_table' => in_array('Clinic', $tables, true) ? 'exists' : 'missing — run full_database_setup.sql in phpMyAdmin',
    ];
}

$webRoot = $home . '/clinicos.aderalabs.com';
$apiRoot = $webRoot . '/clinicos-api';

$socketCandidates = [
    $webRoot . '/tmp/sockets/passenger.socket',
    $webRoot . '/tmp/sockets/passenger.sock',
    $webRoot . '/tmp/passenger.socket',
    $apiRoot . '/tmp/sockets/passenger.socket',
    $apiRoot . '/tmp/sockets/passenger.sock',
];

$sockets = [];
foreach ($socketCandidates as $p) {
    $sockets[$p] = file_exists($p) ? 'EXISTS' : 'missing';
}

$scanned = array_merge(
    scan_sockets($home . '/nodevenv/clinicos.aderalabs.com'),
    scan_sockets($home . '/nodevenv/clinicos.aderalabs.com/clinicos-api'),
    scan_sockets($webRoot . '/tmp'),
    scan_sockets($apiRoot . '/tmp')
);

$hasNodeModules = is_dir($apiRoot . '/node_modules') && file_exists($apiRoot . '/node_modules/dotenv/package.json');
$hasExpress = file_exists($apiRoot . '/node_modules/express/package.json');

$files = [
    'server.js (site root)' => file_exists($webRoot . '/server.js'),
    'package.json (site root)' => file_exists($webRoot . '/package.json'),
    'clinicos-api/server.js' => file_exists($apiRoot . '/server.js'),
    'clinicos-api/dist/bootstrap.js'=> file_exists($apiRoot . '/dist/bootstrap.js'),
    'node_modules (site root)' => is_link($webRoot . '/node_modules') || is_dir($webRoot . '/node_modules'),
    'node_modules (clinicos-api)' => $hasNodeModules,
    'node_modules/express' => $hasExpress,
    'generated/prisma' => file_exists($apiRoot . '/generated/prisma/index.js'),
    '.env'             => file_exists($apiRoot . '/.env'),
];

$passengerLogs = [
    $webRoot . '/logs/passenger.log',
    $webRoot . '/stderr.log',
    $webRoot . '/tmp/passenger.log',
    $apiRoot . '/logs/passenger.log',
    $apiRoot . '/stderr.log',
    $apiRoot . '/tmp/passenger.log',
    $home . '/logs/passenger.log',
];

$passengerLogContent = [];
foreach ($passengerLogs as $p) {
    if (file_exists($p)) {
        $passengerLogContent[$p] = tail_file($p, 20);
    }
}

$nodeVersions = glob($home . '/nodevenv/clinicos.aderalabs.com/*') ?: [];
$nodeVersionsSub = glob($home . '/nodevenv/clinicos.aderalabs.com/clinicos-api/*') ?: [];

$hasRootModules = $files['node_modules (site root)'];
$hasLogs = !empty(tail_file($apiRoot . '/logs/root-server.log')) || !empty(tail_file($apiRoot . '/logs/minimal.log'));
$noSockets = empty($scanned);

$diagnosis = 'unknown';
if (!$hasNodeModules || !$hasExpress) {
    $diagnosis = 'NPM_INSTALL_REQUIRED';
} elseif (!$hasLogs && $noSockets && tcp_probe(3001) === 'open') {
    $diagnosis = 'CRON_TCP_WORKING';
} elseif (tcp_probe(3002) === 'open') {
    $diagnosis = 'CRON_TCP_3002';
} elseif (!$files['server.js (site root)'] && !file_exists($apiRoot . '/server.js')) {
    $diagnosis = 'FILES_MISSING';
} elseif (!$hasRootModules && $files['node_modules (clinicos-api)'] && $noSockets && tcp_probe(3001) !== 'open') {
    $diagnosis = 'USE_CRON_TCP_BYPASS';
} elseif (!$hasRootModules && empty($nodeVersions)) {
    $diagnosis = 'NPM_NOT_INSTALLED_AT_ROOT';
} elseif (!$hasLogs && $noSockets) {
    $diagnosis = 'PASSENGER_NEVER_STARTED';
} elseif (!empty(tail_file($apiRoot . '/logs/startup.log'))) {
    $diagnosis = 'APP_CRASHED_ON_BOOT';
} elseif (!$noSockets || tcp_probe(3001) === 'open') {
    $diagnosis = 'NODE_REACHABLE';
}

$nextSteps = [
    'Upload server.js to site root, set app root = clinicos.aderalabs.com, Node 20, NPM Install, START',
];
if ($diagnosis === 'NPM_INSTALL_REQUIRED') {
    $nextSteps = [
        '1. cPanel → Terminal (or SSH)',
        '2. cd ~/clinicos.aderalabs.com/clinicos-api',
        '3. npm install --omit=dev',
        '4. npx prisma generate',
        '5. /bin/bash start-node.sh',
        '6. Verify: /api/leads/features returns JSON',
    ];
} elseif ($diagnosis === 'USE_CRON_TCP_BYPASS' || $diagnosis === 'CRON_TCP_WORKING') {
    $nextSteps = [
        '1. Upload start-node.sh to clinicos-api/',
        '2. File Manager → right-click start-node.sh → Permissions → 755 (executable)',
        '3. cPanel → Cron Jobs → every 5 min → paste cron_command below',
        '4. Wait 5 min → api-status tcp_ports 3001 should be open',
        'NOTE: browser cron-start.php cannot work on PakHosting (exec disabled) — use Cron only',
    ];
} elseif ($diagnosis === 'PASSENGER_NEVER_STARTED') {
    $nextSteps = [
        '1. Confirm Application root = clinicos.aderalabs.com',
        '2. STOP APP → wait 10 sec → START APP',
        '3. Click OPEN button in cPanel Node.js page',
        '4. If root-server.log still empty → contact PakHosting support',
    ];
} elseif ($diagnosis === 'NODE_REACHABLE' || $diagnosis === 'CRON_TCP_WORKING' || $diagnosis === 'CRON_TCP_3002') {
    $nextSteps = [
        'API runs via Cron on port 3002 — cPanel Restart does NOT reload code after upload',
        'After uploading clinicos-api/dist/* → visit /force-restart.php?key=DMA-SETUP-2026',
        'Verify: /api/leads/deploy-check → staffTrialLimit: 2, ok: true',
    ];
}

$staffPath = $apiRoot . '/dist/controllers/staff.controller.js';
$superPath = $apiRoot . '/dist/controllers/superadmin.controller.js';
$appPath = $apiRoot . '/dist/app.js';
$staffSrc = file_exists($staffPath) ? @file_get_contents($staffPath) : '';
$superSrc = file_exists($superPath) ? @file_get_contents($superPath) : '';
$appSrc = file_exists($appPath) ? @file_get_contents($appPath) : '';

$publicRoutesPath = $apiRoot . '/dist/routes/public.routes.js';
$publicRoutesSrc = file_exists($publicRoutesPath) ? @file_get_contents($publicRoutesPath) : '';

echo json_encode([
    'status' => 'diagnostic',
    'diagnosis' => $diagnosis,
    'diagnosis_meaning' => [
        'NPM_INSTALL_REQUIRED' => 'node_modules missing — API cannot boot (Cannot find module dotenv). Run npm install in clinicos-api via Terminal, then start-node.sh',
        'USE_CRON_TCP_BYPASS' => 'Passenger broken on PakHosting — use Cron Job + PORT=3001 instead (see steps)',
        'CRON_TCP_WORKING' => 'Node running on TCP 3001 via Cron — API should work!',
        'CRON_TCP_3002' => 'Full API running on TCP 3002 via Cron (start-node.sh). cPanel Restart does NOT reload this process.',
        'NODE_REACHABLE' => 'Node is reachable — reload /api/leads/features',
        'FILES_MISSING' => 'Upload server.js and package.json to site root',
    ][$diagnosis] ?? 'Check logs below',
    'code_on_disk' => [
        'staff_controller' => [
            'path' => $staffPath,
            'exists' => file_exists($staffPath),
            'trial_limit_2' => strpos($staffSrc, 'TRIAL: 2') !== false,
            'modified' => file_exists($staffPath) ? date('c', filemtime($staffPath)) : null,
        ],
        'superadmin_controller' => [
            'path' => $superPath,
            'exists' => file_exists($superPath),
            'has_deleteClinic' => strpos($superSrc, 'deleteClinic') !== false,
            'modified' => file_exists($superPath) ? date('c', filemtime($superPath)) : null,
        ],
        'app_js' => [
            'path' => $appPath,
            'api_json_404' => strpos($appSrc, 'Route not found') !== false,
            'modified' => file_exists($appPath) ? date('c', filemtime($appPath)) : null,
        ],
        'public_routes_js' => [
            'path' => $publicRoutesPath,
            'exists' => file_exists($publicRoutesPath),
            'fix_not_cancelled' => strpos($publicRoutesSrc, "planStatus: { not: 'CANCELLED' }") !== false,
            'old_suspended_bug' => strpos($publicRoutesSrc, 'SUSPENDED') !== false,
            'modified' => file_exists($publicRoutesPath) ? date('c', filemtime($publicRoutesPath)) : null,
        ],
        'deploy_check_php' => 'https://clinicos.aderalabs.com/api/public/deploy-check.php',
        'running_api_check' => 'https://clinicos.aderalabs.com/api/leads/deploy-check',
        'force_restart' => 'https://clinicos.aderalabs.com/force-restart.php?key=DMA-SETUP-2026',
    ],
    'database' => db_probe($apiRoot),
    'node_app' => [
        'expected_app_root' => $webRoot,
        'api_code_folder' => $apiRoot,
        'node_versions_site_root' => array_map('basename', $nodeVersions),
        'node_versions_clinicos_api_subfolder' => array_map('basename', $nodeVersionsSub),
        'files' => $files,
        'socket_candidates' => $sockets,
        'sockets_scanned' => $scanned ?: ['none found'],
        'tcp_ports' => [
            '3002' => tcp_probe(3002),
            '3001' => tcp_probe(3001),
            '5000' => tcp_probe(5000),
        ],
    ],
    'logs' => [
        'cron.log'       => tail_file($apiRoot . '/logs/cron.log'),
        'minimal.log'    => tail_file($apiRoot . '/logs/minimal.log'),
        'startup.log'    => tail_file($apiRoot . '/logs/startup.log'),
        'cpanel-check.log'=> tail_file($apiRoot . '/logs/cpanel-check.log'),
        'api-proxy.log'  => tail_file($webRoot . '/logs/api-proxy.log'),
        'passenger_errors'=> $passengerLogContent ?: ['none found'],
    ],
    'cron_command' => '/bin/bash /home2/cognitom/clinicos.aderalabs.com/clinicos-api/start-node.sh',
    'cron_note' => 'Browser cron-start.php will NOT work — use shell Cron command above',
    'next_steps' => $nextSteps,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

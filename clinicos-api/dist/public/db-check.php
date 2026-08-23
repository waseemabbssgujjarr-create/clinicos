<?php
/**
 * db-check.php — test MySQL connection from clinicos-api/.env
 * Open: https://clinicos.workee.online/db-check.php
 *
 * ⚠ If JSON shows env_file under clinicos.aderalabs.com or user cognitom_* —
 * that is the OLD site. workee must use digitals_clinicuser / digitals_clinicdb.
 *
 * CloudLinux note: enable ONE pair only:
 *   nd_mysqli + nd_pdo_mysql   (recommended)
 * OR mysqli + pdo_mysql
 * Never enable both pairs — cPanel will skip them as conflicting.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

set_exception_handler(function ($e) {
    respond(['ok' => false, 'error' => $e->getMessage(), 'type' => 'exception'], 200);
});

function find_env_file() {
    foreach ([
        __DIR__ . '/clinicos-api/.env',
        __DIR__ . '/.env',
        dirname(__DIR__) . '/clinicos-api/.env',
        dirname(__DIR__) . '/.env',
        dirname(dirname(__DIR__)) . '/.env',
    ] as $path) {
        if (is_readable($path)) return $path;
    }
    return null;
}

function active_database_url($content) {
    $active = null;
    foreach (preg_split('/\r\n|\r|\n/', $content) as $line) {
        $trim = trim($line);
        if ($trim === '' || strpos($trim, '#') === 0) continue;
        if (preg_match('/^DATABASE_URL\s*=\s*(.+)$/', $trim, $m)) {
            $active = trim($m[1], " \t\"'");
        }
    }
    return $active;
}

function parse_database_url($raw) {
    $url = trim($raw, " \t\n\r\0\x0B\"'");
    if (stripos($url, 'mysql://') !== 0) {
        return ['error' => 'DATABASE_URL must start with mysql://'];
    }
    $parts = parse_url('http://' . substr($url, 8));
    if (!$parts || empty($parts['host']) || empty($parts['user']) || empty($parts['path'])) {
        return ['error' => 'Could not parse DATABASE_URL — check password has no unencoded @ symbol'];
    }
    return [
        'user' => urldecode($parts['user']),
        'pass' => isset($parts['pass']) ? urldecode($parts['pass']) : '',
        'host' => $parts['host'],
        'port' => isset($parts['port']) ? (int)$parts['port'] : 3306,
        'db'   => ltrim($parts['path'], '/'),
    ];
}

function probe_node_api() {
    if (!function_exists('curl_init')) return null;
    foreach ([3002, 3001] as $port) {
        $ch = curl_init("http://127.0.0.1:{$port}/api/leads/features");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 3,
            CURLOPT_CONNECTTIMEOUT => 2,
        ]);
        $body = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($body && $code >= 200 && $code < 500 && strpos($body, 'php-fallback') === false && strpos($body, 'features') !== false) {
            return [
                'ok' => true,
                'port' => $port,
                'note' => 'Node is live — /api/leads/features is STATIC (no Prisma). Prove DB with /api/health/db or node prisma-db-check.js',
            ];
        }
    }
    return ['ok' => false, 'note' => 'Node API not reachable on 3002/3001'];
}

$phpMysql = [
    'mysqli_extension' => extension_loaded('mysqli'),
    'mysqli_class' => class_exists('mysqli'),
    'mysqli_connect_fn' => function_exists('mysqli_connect'),
    'nd_mysqli_hint' => extension_loaded('nd_mysqli'),
    'pdo' => extension_loaded('pdo'),
    'pdo_mysql' => extension_loaded('pdo_mysql'),
    'nd_pdo_mysql_hint' => extension_loaded('nd_pdo_mysql'),
    'pdo_drivers' => class_exists('PDO') ? PDO::getAvailableDrivers() : [],
    'php_version' => PHP_VERSION,
    'loaded_mysqlish' => array_values(array_filter(get_loaded_extensions(), function ($e) {
        return stripos($e, 'mysql') !== false || stripos($e, 'pdo') !== false;
    })),
];

$envPath = find_env_file();
if (!$envPath) {
    respond(['ok' => false, 'error' => '.env not found', 'php' => $phpMysql]);
}

$content = @file_get_contents($envPath);
if ($content === false) {
    respond(['ok' => false, 'error' => '.env exists but cannot be read', 'path' => $envPath, 'php' => $phpMysql]);
}

$rawUrl = active_database_url($content);
if (!$rawUrl) {
    respond(['ok' => false, 'error' => 'No active DATABASE_URL in .env', 'path' => $envPath, 'php' => $phpMysql]);
}

$cfg = parse_database_url($rawUrl);
if (isset($cfg['error'])) {
    respond(['ok' => false, 'error' => $cfg['error'], 'path' => $envPath, 'php' => $phpMysql]);
}

$node = probe_node_api();
$canMysqli = $phpMysql['mysqli_extension'] || $phpMysql['mysqli_class'] || $phpMysql['mysqli_connect_fn'];
$canPdoMysql = $phpMysql['pdo_mysql'] || in_array('mysql', $phpMysql['pdo_drivers'], true);

$siteWarn = null;
if (preg_match('/cognitom|aderalabs/i', $envPath . ' ' . $cfg['user'] . ' ' . $cfg['db'])) {
    $siteWarn = 'OLD SITE DETECTED (cognitom / aderalabs). workee production must use digitals_clinicuser / digitals_clinicdb — do NOT point workee at cognitos DB.';
} elseif ($cfg['user'] !== 'digitals_clinicuser' || $cfg['db'] !== 'digitals_clinicdb') {
    $siteWarn = 'Expected digitals_clinicuser / digitals_clinicdb — got ' . $cfg['user'] . ' / ' . $cfg['db'];
}

if ($canMysqli) {
    mysqli_report(MYSQLI_REPORT_OFF);
    $mysqli = @mysqli_connect($cfg['host'], $cfg['user'], $cfg['pass'], $cfg['db'], $cfg['port']);
    if (!$mysqli) {
        respond([
            'ok' => false,
            'error' => mysqli_connect_error(),
            'user' => $cfg['user'],
            'db' => $cfg['db'],
            'env_file' => $envPath,
            'site_warn' => $siteWarn,
            'php' => $phpMysql,
            'node_api' => $node,
            'note' => 'features endpoint is static (no DB). Auth/verify needs Prisma — use node prisma-db-check.js or GET /api/health/db',
        ]);
    }
    $tableCount = 0;
    if ($res = mysqli_query($mysqli, 'SHOW TABLES')) {
        while (mysqli_fetch_array($res)) $tableCount++;
    }
    $clinic = mysqli_query($mysqli, "SHOW TABLES LIKE 'Clinic'");
    $clinicOk = $clinic && mysqli_num_rows($clinic) > 0;
    mysqli_close($mysqli);
    respond([
        'ok' => true,
        'message' => 'MySQL connection works via PHP mysqli',
        'via' => 'mysqli',
        'env_file' => $envPath,
        'user' => $cfg['user'],
        'db' => $cfg['db'],
        'clinic_table' => $clinicOk ? 'exists' : 'missing',
        'table_count' => $tableCount,
        'site_warn' => $siteWarn,
        'php' => $phpMysql,
        'node_api' => $node,
    ]);
}

if ($canPdoMysql) {
    try {
        $dsn = "mysql:host={$cfg['host']};port={$cfg['port']};dbname={$cfg['db']};charset=utf8mb4";
        $pdo = new PDO($dsn, $cfg['user'], $cfg['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $tableCount = (int)$pdo->query('SHOW TABLES')->rowCount();
        respond([
            'ok' => true,
            'message' => 'MySQL connection works via PDO',
            'via' => 'pdo_mysql',
            'user' => $cfg['user'],
            'db' => $cfg['db'],
            'table_count' => $tableCount,
            'env_file' => $envPath,
            'site_warn' => $siteWarn,
            'php' => $phpMysql,
            'node_api' => $node,
        ]);
    } catch (Throwable $e) {
        respond([
            'ok' => false,
            'error' => $e->getMessage(),
            'user' => $cfg['user'],
            'db' => $cfg['db'],
            'env_file' => $envPath,
            'site_warn' => $siteWarn,
            'php' => $phpMysql,
            'node_api' => $node,
        ]);
    }
}

// PHP extensions unavailable — still report Node health so deploy isn't blocked
respond([
    'ok' => !empty($node['ok']),
    'php_checker' => 'unavailable',
    'error' => 'Neither mysqli nor pdo_mysql available in PHP (CloudLinux conflict is common)',
    'php' => $phpMysql,
    'env_file' => $envPath,
    'user' => $cfg['user'],
    'db' => $cfg['db'],
    'site_warn' => $siteWarn,
    'node_api' => $node,
    'important' => 'Login/verify use Node.js + Prisma. node_api.ok only means Node is up — features is static. Prove DB with GET /api/health/db or: node clinicos-api/prisma-db-check.js',
    'fix_php_checker' => [
        '1. cPanel → Select PHP Version → Extensions',
        '2. UNCHECK: mysqli AND pdo_mysql',
        '3. CHECK only: nd_mysqli AND nd_pdo_mysql (and mysqlnd)',
        '4. Do NOT enable both pairs — warnings "skipped as conflicting" mean nothing loaded',
        '5. Click SAVE at the bottom',
        '6. Reload this page',
    ],
]);

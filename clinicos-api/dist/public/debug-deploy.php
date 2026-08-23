<?php
/**
 * debug-deploy.php — full cPanel deploy diagnostic for clinicos.workee.online
 * Upload to site root, open: https://clinicos.workee.online/debug-deploy.php
 * Delete this file after the site works.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function j($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

$webRoot = __DIR__;
$home = getenv('HOME') ?: (preg_match('#^(/home[^/]*/[^/]+)#', $webRoot, $m) ? $m[1] : dirname($webRoot));
$apiRoot = is_dir($webRoot . '/clinicos-api') ? $webRoot . '/clinicos-api' : $webRoot;
$domain = $_SERVER['HTTP_HOST'] ?? 'clinicos.workee.online';

function tail_file($path, $n = 40) {
    if (!is_readable($path)) return null;
    $lines = explode("\n", (string)@file_get_contents($path));
    return array_values(array_slice($lines, -$n));
}

function find_env($apiRoot, $webRoot) {
    foreach ([
        $apiRoot . '/.env',
        $apiRoot . '/env',
        $webRoot . '/.env',
        $webRoot . '/env',
    ] as $p) {
        if (is_readable($p)) return $p;
    }
    return null;
}

function parse_active_database_url($content) {
    $active = null;
    $all = [];
    foreach (preg_split('/\r\n|\r|\n/', $content) as $i => $line) {
        $trim = trim($line);
        if ($trim === '' || strpos($trim, 'DATABASE_URL') === false) continue;
        $commented = (strpos($trim, '#') === 0);
        if (preg_match('/^#?\s*DATABASE_URL\s*=\s*(.+)$/', $trim, $m)) {
            $val = trim($m[1], " \t\"'");
            $all[] = [
                'line' => $i + 1,
                'commented' => $commented,
                'raw_preview' => preg_replace('#://([^:]+):([^@]+)@#', '://$1:***@', $trim),
            ];
            if (!$commented) $active = $val;
        }
    }
    return [$active, $all];
}

function parse_mysql_url($url) {
    $url = trim($url, " \t\"'");
    if (stripos($url, 'mysql://') !== 0) return ['error' => 'must start with mysql://'];
    $parts = parse_url('http://' . substr($url, 8));
    if (!$parts || empty($parts['user']) || empty($parts['host']) || empty($parts['path'])) {
        return ['error' => 'parse failed — password may contain unencoded @ # %'];
    }
    return [
        'user' => urldecode($parts['user']),
        'pass' => isset($parts['pass']) ? urldecode($parts['pass']) : '',
        'host' => $parts['host'],
        'port' => isset($parts['port']) ? (int)$parts['port'] : 3306,
        'db'   => ltrim($parts['path'], '/'),
        'pass_len' => isset($parts['pass']) ? strlen(urldecode($parts['pass'])) : 0,
    ];
}

function tcp_probe($port) {
    $fp = @fsockopen('127.0.0.1', (int)$port, $errno, $errstr, 2);
    if ($fp) { fclose($fp); return ['open' => true]; }
    return ['open' => false, 'error' => "$errno $errstr"];
}

function http_local($url, $socket = null) {
    if (!function_exists('curl_init')) return ['ok' => false, 'error' => 'curl missing'];
    $ch = curl_init($url);
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_HEADER => false,
    ];
    if ($socket) $opts[CURLOPT_UNIX_SOCKET_PATH] = $socket;
    curl_setopt_array($ch, $opts);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    return [
        'ok' => $body !== false && $code > 0 && $code < 500,
        'http' => $code,
        'error' => $err ?: null,
        'body_preview' => is_string($body) ? substr($body, 0, 180) : null,
    ];
}

function find_sockets($bases) {
    $found = [];
    foreach ($bases as $base) {
        if (!is_dir($base)) continue;
        try {
            $it = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS),
                RecursiveIteratorIterator::SELF_FIRST
            );
            foreach ($it as $file) {
                if ($file->isFile() && preg_match('/passenger\.so/i', $file->getFilename())) {
                    $found[] = $file->getPathname();
                }
            }
        } catch (Throwable $e) { /* ignore */ }
    }
    return array_values(array_unique($found));
}

// ── PHP extensions ──────────────────────────────────────────────────────────
$ext = get_loaded_extensions();
sort($ext);
$php = [
    'version' => PHP_VERSION,
    'sapi' => PHP_SAPI,
    'ini_file' => php_ini_loaded_file(),
    'mysqli' => [
        'extension_loaded' => extension_loaded('mysqli'),
        'class_exists' => class_exists('mysqli'),
        'function_mysqli_connect' => function_exists('mysqli_connect'),
    ],
    'pdo' => [
        'extension_loaded' => extension_loaded('pdo'),
        'class_exists' => class_exists('PDO'),
        'pdo_mysql' => extension_loaded('pdo_mysql'),
        'drivers' => class_exists('PDO') ? PDO::getAvailableDrivers() : [],
    ],
    'curl' => extension_loaded('curl'),
    'json' => extension_loaded('json'),
    'relevant_extensions' => array_values(array_filter($ext, function ($e) {
        return preg_match('/mysql|pdo|curl|json|mbstring/i', $e);
    })),
];

// ── .env / DATABASE_URL ─────────────────────────────────────────────────────
$envPath = find_env($apiRoot, $webRoot);
$envInfo = ['path' => $envPath, 'exists' => (bool)$envPath];
$dbCfg = null;
$dbProbe = null;

if ($envPath) {
    $content = (string)@file_get_contents($envPath);
    [$activeUrl, $allDbLines] = parse_active_database_url($content);
    $envInfo['database_url_lines'] = $allDbLines;
    $envInfo['active_database_url_preview'] = $activeUrl
        ? preg_replace('#://([^:]+):([^@]+)@#', '://$1:***@', $activeUrl)
        : null;

    foreach (['APP_URL', 'FRONTEND_URL', 'NODE_ENV', 'PORT'] as $key) {
        if (preg_match('/^' . preg_quote($key, '/') . '=(.+)$/m', $content, $mm)) {
            $envInfo['vars'][$key] = trim($mm[1], " \t\"'");
        }
    }

    if ($activeUrl) {
        $dbCfg = parse_mysql_url($activeUrl);
        if (!isset($dbCfg['error'])) {
            if (extension_loaded('mysqli') || function_exists('mysqli_connect') || class_exists('mysqli')) {
                mysqli_report(MYSQLI_REPORT_OFF);
                $mysqli = @mysqli_connect($dbCfg['host'], $dbCfg['user'], $dbCfg['pass'], $dbCfg['db'], $dbCfg['port']);
                if (!$mysqli) {
                    $dbProbe = [
                        'ok' => false,
                        'via' => 'mysqli',
                        'error' => mysqli_connect_error(),
                        'user' => $dbCfg['user'],
                        'db' => $dbCfg['db'],
                        'host' => $dbCfg['host'],
                    ];
                } else {
                    $tables = 0;
                    if ($res = mysqli_query($mysqli, 'SHOW TABLES')) {
                        while (mysqli_fetch_array($res)) $tables++;
                    }
                    $clinic = mysqli_query($mysqli, "SHOW TABLES LIKE 'Clinic'");
                    $dbProbe = [
                        'ok' => true,
                        'via' => 'mysqli',
                        'user' => $dbCfg['user'],
                        'db' => $dbCfg['db'],
                        'table_count' => $tables,
                        'clinic_table' => ($clinic && mysqli_num_rows($clinic) > 0) ? 'exists' : 'missing',
                    ];
                    mysqli_close($mysqli);
                }
            } elseif (extension_loaded('pdo_mysql')) {
                try {
                    $dsn = "mysql:host={$dbCfg['host']};port={$dbCfg['port']};dbname={$dbCfg['db']};charset=utf8mb4";
                    $pdo = new PDO($dsn, $dbCfg['user'], $dbCfg['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
                    $tables = (int)$pdo->query('SHOW TABLES')->rowCount();
                    $dbProbe = [
                        'ok' => true,
                        'via' => 'pdo_mysql',
                        'user' => $dbCfg['user'],
                        'db' => $dbCfg['db'],
                        'table_count' => $tables,
                    ];
                } catch (Throwable $e) {
                    $dbProbe = [
                        'ok' => false,
                        'via' => 'pdo_mysql',
                        'error' => $e->getMessage(),
                        'user' => $dbCfg['user'],
                        'db' => $dbCfg['db'],
                    ];
                }
            } else {
                $dbProbe = [
                    'ok' => false,
                    'error' => 'PHP MySQL extensions disabled',
                    'fix' => [
                        'cPanel → Select PHP Version (or MultiPHP INI Editor)',
                        'Enable extensions: mysqli AND pdo_mysql',
                        'Save → reload this page',
                        'Note: Node/Prisma does NOT need PHP mysqli — only this PHP checker does',
                    ],
                ];
            }
        } else {
            $dbProbe = ['ok' => false, 'error' => $dbCfg['error']];
        }
    } else {
        $dbProbe = ['ok' => false, 'error' => 'No active (uncommented) DATABASE_URL in .env'];
    }
}

// ── Node / proxy reachability ───────────────────────────────────────────────
$sockets = find_sockets([
    $apiRoot . '/tmp',
    $webRoot . '/tmp',
    $home . '/nodevenv',
]);

$tcp = [
    '3002' => tcp_probe(3002),
    '3001' => tcp_probe(3001),
    '5000' => tcp_probe(5000),
];

$apiProbes = [
    'tcp_3002' => http_local('http://127.0.0.1:3002/api/leads/features'),
    'tcp_3001' => http_local('http://127.0.0.1:3001/api/leads/features'),
];
foreach ($sockets as $i => $sock) {
    $apiProbes['socket_' . $i] = http_local('http://localhost/api/leads/features', $sock) + ['path' => $sock];
}

$proxyFile = $webRoot . '/api-proxy.php';
$proxySrc = is_readable($proxyFile) ? (string)@file_get_contents($proxyFile) : '';
$proxyHasOldHome = strpos($proxySrc, '/home2/cognitom/') !== false;
$proxyHasNewHome = strpos($proxySrc, $home . '/') !== false || strpos($proxySrc, '/home/digitals/') !== false;

$files = [
    'api-proxy.php' => file_exists($webRoot . '/api-proxy.php'),
    '.htaccess' => file_exists($webRoot . '/.htaccess'),
    'clinicos-api/.env' => file_exists($apiRoot . '/.env'),
    'clinicos-api/env (wrong name)' => file_exists($apiRoot . '/env'),
    'clinicos-api/dist/bootstrap.js' => file_exists($apiRoot . '/dist/bootstrap.js'),
    'clinicos-api/node_modules/express' => file_exists($apiRoot . '/node_modules/express/package.json'),
    'clinicos-api/node_modules/@prisma/client' => file_exists($apiRoot . '/node_modules/@prisma/client/package.json'),
];

// ── Diagnosis ───────────────────────────────────────────────────────────────
$issues = [];
$steps = [];

if (!empty($php['mysqli']['extension_loaded']) === false && empty($php['pdo']['pdo_mysql'])) {
    $issues[] = 'PHP_MYSQL_EXTENSIONS_OFF';
    $steps[] = 'cPanel → Select PHP Version → enable mysqli + pdo_mysql (only needed for PHP db-check; Node can still work)';
}
if (!$envPath) {
    $issues[] = 'ENV_MISSING';
    $steps[] = 'Create clinicos-api/.env (with the leading dot)';
} elseif (file_exists($apiRoot . '/env') && !file_exists($apiRoot . '/.env')) {
    $issues[] = 'ENV_WRONG_FILENAME';
    $steps[] = 'Rename clinicos-api/env → clinicos-api/.env';
}
if ($dbProbe && empty($dbProbe['ok'])) {
    if (!empty($dbProbe['error']) && stripos($dbProbe['error'], 'Access denied') !== false) {
        $issues[] = 'DB_AUTH_FAILED';
        $steps[] = 'Fix DATABASE_URL password; must match MySQL user digitals_clinicuser';
    } elseif (!empty($dbProbe['error']) && stripos((string)$dbProbe['error'], 'extensions') !== false) {
        // already covered
    } elseif (isset($dbCfg['user']) && preg_match('/cognitom|clinicos_user/', $dbCfg['user'])) {
        $issues[] = 'DB_OLD_CREDENTIALS';
        $steps[] = 'DATABASE_URL still uses old user — set digitals_clinicuser / digitals_clinicdb';
    } else {
        $issues[] = 'DB_CONNECT_FAILED';
        $steps[] = 'Check DATABASE_URL user/password/db name in clinicos-api/.env';
    }
}
if ($proxyHasOldHome && !$proxyHasNewHome) {
    $issues[] = 'API_PROXY_OLD_PATHS';
    $steps[] = 'Upload fixed api-proxy.php (paths must use /home/digitals/ not /home2/cognitom/)';
}
$nodeReachable = false;
foreach ($apiProbes as $p) {
    if (!empty($p['ok'])) { $nodeReachable = true; break; }
}
if (!$nodeReachable) {
    $issues[] = 'NODE_UNREACHABLE';
    $steps[] = 'cPanel → Setup Node.js App → STOP → START (startup file: dist/bootstrap.js)';
    $steps[] = 'Or run: source ~/nodevenv/clinicos.workee.online/clinicos-api/20/bin/activate && cd ~/clinicos.workee.online/clinicos-api && node dist/bootstrap.js';
    $steps[] = 'Check clinicos-api/logs/startup.log for BOOT FAILED';
}
if (empty($files['clinicos-api/node_modules/express'])) {
    $issues[] = 'NPM_INSTALL_NEEDED';
    $steps[] = 'In Node app page click Run NPM Install, or: cd clinicos-api && npm install --omit=dev && npx prisma generate';
}

if (!$issues) {
    $issues[] = 'LOOKS_OK';
    $steps[] = 'Open /api/leads/features then try /doctor-login/ again';
}

j([
    'ok' => $nodeReachable && (!empty($dbProbe['ok']) || in_array('PHP_MYSQL_EXTENSIONS_OFF', $issues, true)),
    'summary' => [
        'php_mysql_ok_for_checker' => !empty($dbProbe['ok']),
        'node_api_reachable' => $nodeReachable,
        'issues' => $issues,
        'next_steps' => array_values(array_unique($steps)),
    ],
    'paths' => [
        'home' => $home,
        'web_root' => $webRoot,
        'api_root' => $apiRoot,
        'domain' => $domain,
    ],
    'php' => $php,
    'env' => $envInfo,
    'database' => [
        'parsed' => $dbCfg ? array_diff_key($dbCfg, ['pass' => 1]) : null,
        'probe' => $dbProbe,
        'note' => 'Login/register uses Node+Prisma, not PHP mysqli. If PHP extensions are off, fix Node API instead.',
    ],
    'node' => [
        'files' => $files,
        'tcp_ports' => $tcp,
        'passenger_sockets' => $sockets ?: ['none found'],
        'api_probes' => $apiProbes,
        'api_proxy' => [
            'exists' => $files['api-proxy.php'],
            'still_has_old_cognitom_paths' => $proxyHasOldHome,
            'has_current_home_paths' => $proxyHasNewHome,
        ],
        'logs' => [
            'startup.log' => tail_file($apiRoot . '/logs/startup.log', 30),
            'cron.log' => tail_file($apiRoot . '/logs/cron.log', 20),
            'api-proxy.log' => tail_file($webRoot . '/logs/api-proxy.log', 20),
        ],
    ],
    'links' => [
        'this_page' => "https://{$domain}/debug-deploy.php",
        'api_features' => "https://{$domain}/api/leads/features",
        'doctor_login' => "https://{$domain}/doctor-login/",
    ],
]);

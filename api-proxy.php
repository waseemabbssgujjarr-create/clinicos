<?php
/**
 * api-proxy.php — forwards /api/* to Node.js
 * Prefer TCP :3002 (manual/cron start) over stale Passenger sockets.
 */

function proxy_log($msg) {
    $dir = __DIR__ . '/logs';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    @file_put_contents($dir . '/api-proxy.log', date('c') . ' ' . $msg . "\n", FILE_APPEND);
}

function find_passenger_socket() {
    $webRoot = __DIR__;
    $apiRoot = is_dir($webRoot . '/clinicos-api') ? $webRoot . '/clinicos-api' : $webRoot;
    $home = getenv('HOME') ?: (preg_match('#^(/home[^/]*/[^/]+)#', $webRoot, $m) ? $m[1] : dirname($webRoot));

    $candidates = [
        $apiRoot . '/tmp/sockets/passenger.socket',
        $apiRoot . '/tmp/sockets/passenger.sock',
        $webRoot . '/tmp/sockets/passenger.socket',
        $webRoot . '/tmp/sockets/passenger.sock',
        $webRoot . '/tmp/passenger.socket',
        '/home/digitals/clinicos.workee.online/clinicos-api/tmp/sockets/passenger.socket',
        '/home/digitals/clinicos.workee.online/clinicos-api/tmp/sockets/passenger.sock',
        '/home/digitals/clinicos.workee.online/tmp/sockets/passenger.socket',
    ];
    foreach ($candidates as $p) {
        if ($p && file_exists($p)) return $p;
    }
    foreach ([
        $home . '/nodevenv/*/tmp/**/passenger.so*',
        $home . '/nodevenv/*/*/tmp/**/passenger.so*',
        '/home/digitals/nodevenv/clinicos.workee.online/*/tmp/**/passenger.so*',
        '/home/digitals/nodevenv/clinicos.workee.online/clinicos-api/*/tmp/**/passenger.so*',
    ] as $pattern) {
        foreach (glob($pattern) ?: [] as $p) {
            if (file_exists($p)) return $p;
        }
    }
    return null;
}

function forward_request($targetUrl, $socketPath = null) {
    $body = file_get_contents('php://input');
    $forwardHeaders = [];
    $skip = ['host', 'connection', 'transfer-encoding', 'upgrade', 'proxy-connection', 'keep-alive', 'content-length'];
    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (!in_array(strtolower($name), $skip, true)) {
                $forwardHeaders[] = "$name: $value";
            }
        }
    }
    // Ensure JSON POSTs keep Content-Type even if headers were stripped
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method !== 'GET' && $method !== 'HEAD' && $body !== '' && $body !== false) {
        $hasCt = false;
        foreach ($forwardHeaders as $h) {
            if (stripos($h, 'Content-Type:') === 0) { $hasCt = true; break; }
        }
        if (!$hasCt) $forwardHeaders[] = 'Content-Type: application/json';
        $forwardHeaders[] = 'Content-Length: ' . strlen($body);
    }

    $opts = [
        CURLOPT_URL            => $targetUrl,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER         => true,
        CURLOPT_HTTPHEADER     => $forwardHeaders,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_TIMEOUT        => 45,
        CURLOPT_CONNECTTIMEOUT => 3,
    ];
    if ($method !== 'GET' && $method !== 'HEAD') {
        $opts[CURLOPT_POSTFIELDS] = ($body === false) ? '' : $body;
    }
    if ($socketPath) {
        $opts[CURLOPT_UNIX_SOCKET_PATH] = $socketPath;
    }
    $ch = curl_init();
    curl_setopt_array($ch, $opts);
    $response   = curl_exec($ch);
    $statusCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $curlError  = curl_error($ch);
    curl_close($ch);
    return [$response, $statusCode, $headerSize, $curlError];
}

function send_response($response, $statusCode, $headerSize) {
    $responseHeaders = substr($response, 0, $headerSize);
    $responseBody    = substr($response, $headerSize);
    http_response_code($statusCode);
    $skip = ['transfer-encoding', 'connection', 'keep-alive', 'upgrade'];
    foreach (explode("\r\n", $responseHeaders) as $line) {
        if (strpos($line, ':') === false) continue;
        [$hName] = explode(':', $line, 2);
        if (!in_array(strtolower(trim($hName)), $skip, true)) {
            header($line, false);
        }
    }
    echo $responseBody;
}

/** TCP Node: any real HTTP response is valid (app may return 503 for SMTP/DB errors). */
function is_usable_tcp_upstream($resp, $code) {
    return $resp !== false && $code > 0;
}

/** Passenger socket: 502/503/504 often means stale/dead socket — try next target. */
function is_usable_passenger_upstream($resp, $code) {
    if ($resp === false || $code <= 0) return false;
    if ($code === 502 || $code === 503 || $code === 504) return false;
    return true;
}

function php_features_fallback() {
    $file = __DIR__ . '/features-fallback.json';
    if (!file_exists($file)) return false;
    header('Content-Type: application/json');
    header('X-API-Fallback: php-static');
    readfile($file);
    return true;
}

$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$errors     = [];

// 1) Prefer TCP first — matches force-start-api.sh / start-node.sh on 3002
foreach ([3002, 3001, 5000, 8080] as $port) {
    $url = "http://127.0.0.1:$port$requestUri";
    proxy_log("tcp: $url " . ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    [$resp, $code, $hSize, $err] = forward_request($url, null);
    if (is_usable_tcp_upstream($resp, $code)) {
        $body = substr($resp, $hSize);
        if ($port == 3001 && strpos($body, '"features"') === false && strpos($body, '"status"') !== false) {
            $errors[] = "tcp3001:minimal_only";
            continue;
        }
        proxy_log("tcp$port OK status=$code");
        send_response($resp, $code, $hSize);
        exit;
    }
    if ($err) $errors[] = "tcp$port:$err";
    else $errors[] = "tcp$port:status=$code";
}

// 2) Passenger unix socket (only if TCP failed)
$socket = find_passenger_socket();
if ($socket) {
    proxy_log("socket: $socket");
    [$resp, $code, $hSize, $err] = forward_request('http://localhost' . $requestUri, $socket);
    if (is_usable_passenger_upstream($resp, $code)) {
        proxy_log("socket OK status=$code");
        send_response($resp, $code, $hSize);
        exit;
    }
    $errors[] = $err ? "socket:$err" : "socket:status=$code";
} else {
    $errors[] = 'socket:not_found';
}

if (preg_match('#^/api/leads/features#', $requestUri)) {
    proxy_log('php features fallback');
    if (php_features_fallback()) exit;
}

$host = $_SERVER['HTTP_HOST'] ?? 'clinicos.workee.online';
http_response_code(502);
header('Content-Type: application/json');
echo json_encode([
    'error'  => 'API server unreachable',
    'detail' => 'Node.js not reachable on TCP 3002. In Terminal run: bash clinicos-api/force-start-api.sh',
    'errors' => $errors,
    'diagnose' => 'https://' . $host . '/db-check.php',
    'code'   => 'PROXY_ERROR',
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

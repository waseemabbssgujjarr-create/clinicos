<?php
/**
 * api-proxy.php — forwards /api/* to Node.js Passenger socket
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
        // Current host (auto from this file's location)
        $apiRoot . '/tmp/sockets/passenger.socket',
        $apiRoot . '/tmp/sockets/passenger.sock',
        $webRoot . '/tmp/sockets/passenger.socket',
        $webRoot . '/tmp/sockets/passenger.sock',
        $webRoot . '/tmp/passenger.socket',
        // workee.online (digitals)
        '/home/digitals/clinicos.workee.online/clinicos-api/tmp/sockets/passenger.socket',
        '/home/digitals/clinicos.workee.online/clinicos-api/tmp/sockets/passenger.sock',
        '/home/digitals/clinicos.workee.online/tmp/sockets/passenger.socket',
        // legacy aderals (old host)
        '/home2/cognitom/clinicos.aderalabs.com/tmp/sockets/passenger.socket',
        '/home2/cognitom/clinicos.aderalabs.com/clinicos-api/tmp/sockets/passenger.socket',
    ];
    foreach ($candidates as $p) {
        if ($p && file_exists($p)) return $p;
    }
    foreach ([
        $home . '/nodevenv/*/tmp/**/passenger.so*',
        $home . '/nodevenv/*/*/tmp/**/passenger.so*',
        $webRoot . '/tmp/**/passenger.so*',
        $apiRoot . '/tmp/**/passenger.so*',
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
    $skip = ['host', 'connection', 'transfer-encoding', 'upgrade', 'proxy-connection', 'keep-alive'];
    foreach (getallheaders() as $name => $value) {
        if (!in_array(strtolower($name), $skip, true)) {
            $forwardHeaders[] = "$name: $value";
        }
    }
    $opts = [
        CURLOPT_URL            => $targetUrl,
        CURLOPT_CUSTOMREQUEST  => $_SERVER['REQUEST_METHOD'],
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER         => true,
        CURLOPT_HTTPHEADER     => $forwardHeaders,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_CONNECTTIMEOUT => 5,
    ];
    if ($socketPath) {
        $opts[CURLOPT_UNIX_SOCKET_PATH] = $socketPath;
    }
    $ch = curl_init();
    curl_setopt_array($ch, $opts);
    $response   = curl_exec($ch);
    $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
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

$socket = find_passenger_socket();
if ($socket) {
    proxy_log("socket: $socket");
    [$resp, $code, $hSize, $err] = forward_request('http://localhost' . $requestUri, $socket);
    if ($resp !== false && $code > 0) {
        send_response($resp, $code, $hSize);
        exit;
    }
    $errors[] = "socket:$err";
} else {
    $errors[] = 'socket:not_found';
}

foreach ([3002, 3001, 5000, 8080] as $port) {
    // Skip minimal stub on 3001 — only accept full API responses
    $url = "http://127.0.0.1:$port$requestUri";
    proxy_log("tcp: $url");
    [$resp, $code, $hSize, $err] = forward_request($url, null);
    if ($resp !== false && $code > 0 && $code < 502) {
        $body = substr($resp, $hSize);
        if ($port == 3001 && strpos($body, '"features"') === false && strpos($body, '"status"') !== false) {
            $errors[] = "tcp3001:minimal_only";
            continue;
        }
        send_response($resp, $code, $hSize);
        exit;
    }
    if ($err) $errors[] = "tcp$port:$err";
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
    'detail' => 'Node.js app not reachable via Passenger socket or TCP 3002/3001. Restart Setup Node.js App (startup: dist/bootstrap.js).',
    'errors' => $errors,
    'diagnose' => 'https://' . $host . '/debug-deploy.php',
    'code'   => 'PROXY_ERROR',
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

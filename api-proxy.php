<?php
/**
 * api-proxy.php — forwards /api/* to Node.js on port 3002.
 *
 * Production Node.js API listens on http://127.0.0.1:3002
 * Confirmed reachable via PHP fsockopen + cURL from this account.
 *
 * ROOT CAUSE OF PREVIOUS 502:
 *   CURLOPT_CONNECTTIMEOUT was 3 seconds. Under CloudLinux LVE resource
 *   limits, PHP's loopback TCP connect to 127.0.0.1:3002 can take longer
 *   than 3 s even when Node is healthy. The connection timed out before
 *   it completed → curl returned false → proxy returned 502.
 *
 * FIX:
 *   Primary target: http://127.0.0.1:3002 with CURLOPT_CONNECTTIMEOUT 15 s.
 *   Fallback: port 3001 (Passenger/secondary start), same timeout.
 *   Passenger unix socket: attempted only if both TCP ports fail.
 *   No port scanning of 5000/8080 — they are not used on this server.
 */

// ── OPTIONS preflight — return immediately, never proxy ──────────────────────
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Authorization, Content-Type, Accept');
    exit;
}

function proxy_log($msg) {
    $dir = __DIR__ . '/logs';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    @file_put_contents($dir . '/api-proxy.log', date('c') . ' ' . $msg . "\n", FILE_APPEND);
}

/**
 * Forward the current HTTP request to $targetUrl.
 * Preserves method, headers (excluding hop-by-hop), query string, body.
 * Returns [$responseRaw, $httpCode, $headerSize, $curlError].
 * Never logs Authorization header value or request body.
 */
function forward_request($targetUrl, $socketPath = null) {
    $body   = file_get_contents('php://input');
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    // Build forwarded headers — skip hop-by-hop headers
    $forwardHeaders = [];
    $skipHeaders    = ['host', 'connection', 'transfer-encoding', 'upgrade',
                       'proxy-connection', 'keep-alive', 'content-length'];
    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (!in_array(strtolower($name), $skipHeaders, true)) {
                $forwardHeaders[] = "$name: $value";
            }
        }
    }

    // Ensure Content-Type + Content-Length on bodies
    if ($method !== 'GET' && $method !== 'HEAD' && $body !== '' && $body !== false) {
        $hasCt = false;
        foreach ($forwardHeaders as $h) {
            if (stripos($h, 'Content-Type:') === 0) { $hasCt = true; break; }
        }
        if (!$hasCt) $forwardHeaders[] = 'Content-Type: application/json';
        $forwardHeaders[] = 'Content-Length: ' . strlen($body);
    }

    $opts = [
        CURLOPT_URL             => $targetUrl,
        CURLOPT_CUSTOMREQUEST   => $method,
        CURLOPT_RETURNTRANSFER  => true,
        CURLOPT_HEADER          => true,
        CURLOPT_HTTPHEADER      => $forwardHeaders,
        CURLOPT_FOLLOWLOCATION  => false,
        CURLOPT_TIMEOUT         => 45,
        // Raised from 3 s → 15 s to survive CloudLinux LVE loopback throttling.
        // PHP fsockopen/cURL direct tests confirm 127.0.0.1:3002 connects but
        // can take > 3 s under LVE load, causing the old 3-second limit to fire.
        CURLOPT_CONNECTTIMEOUT  => 15,
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
    $curlErrno  = curl_errno($ch);
    curl_close($ch);

    return [$response, $statusCode, $headerSize, $curlError, $curlErrno];
}

function send_response($response, $statusCode, $headerSize) {
    $responseHeaders = substr($response, 0, $headerSize);
    $responseBody    = substr($response, $headerSize);
    http_response_code($statusCode);
    $skipResp = ['transfer-encoding', 'connection', 'keep-alive', 'upgrade'];
    foreach (explode("\r\n", $responseHeaders) as $line) {
        if (strpos($line, ':') === false) continue;
        [$hName] = explode(':', $line, 2);
        if (!in_array(strtolower(trim($hName)), $skipResp, true)) {
            header($line, false);
        }
    }
    echo $responseBody;
}

/** Any real HTTP response from Node is valid — even 4xx/5xx are app responses. */
function is_live_upstream($resp, $code) {
    return $resp !== false && $code > 0;
}

function find_passenger_socket() {
    $webRoot = __DIR__;
    $apiRoot = is_dir($webRoot . '/clinicos-api') ? $webRoot . '/clinicos-api' : $webRoot;
    $home    = getenv('HOME') ?: (preg_match('#^(/home[^/]*/[^/]+)#', $webRoot, $m) ? $m[1] : dirname($webRoot));

    $candidates = [
        $apiRoot . '/tmp/sockets/passenger.socket',
        $apiRoot . '/tmp/sockets/passenger.sock',
        $webRoot . '/tmp/sockets/passenger.socket',
        $webRoot . '/tmp/sockets/passenger.sock',
        $webRoot . '/tmp/passenger.socket',
        $home    . '/public_html/clinicos-api/tmp/sockets/passenger.socket',
        $home    . '/public_html/clinicos-api/tmp/sockets/passenger.sock',
        $home    . '/public_html/tmp/sockets/passenger.socket',
    ];
    foreach ($candidates as $p) {
        if ($p && file_exists($p)) return $p;
    }
    foreach ([
        $home . '/nodevenv/*/tmp/**/passenger.so*',
        $home . '/nodevenv/*/*/tmp/**/passenger.so*',
    ] as $pattern) {
        foreach (glob($pattern) ?: [] as $p) {
            if (file_exists($p)) return $p;
        }
    }
    return null;
}

$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$errors     = [];

// ── 1. Primary: TCP 3002 ──────────────────────────────────────────────────────
// Confirmed production port. CONNECTTIMEOUT raised to survive LVE throttling.
{
    $url = "http://127.0.0.1:3002$requestUri";
    proxy_log("try tcp3002: $url");
    [$resp, $code, $hSize, $err, $errno] = forward_request($url);
    if (is_live_upstream($resp, $code)) {
        proxy_log("tcp3002 OK status=$code");
        send_response($resp, $code, $hSize);
        exit;
    }
    $errMsg = $err ?: "status=$code";
    proxy_log("tcp3002 FAIL errno=$errno err=$errMsg");
    $errors[] = "tcp3002 errno=$errno: $errMsg";
}

// ── 2. Fallback: TCP 3001 ─────────────────────────────────────────────────────
// Used when Passenger or an alternate start assigns port 3001.
{
    $url = "http://127.0.0.1:3001$requestUri";
    proxy_log("try tcp3001: $url");
    [$resp, $code, $hSize, $err, $errno] = forward_request($url);
    if (is_live_upstream($resp, $code)) {
        proxy_log("tcp3001 OK status=$code");
        send_response($resp, $code, $hSize);
        exit;
    }
    $errMsg = $err ?: "status=$code";
    proxy_log("tcp3001 FAIL errno=$errno err=$errMsg");
    $errors[] = "tcp3001 errno=$errno: $errMsg";
}

// ── 3. Last resort: Passenger unix socket ─────────────────────────────────────
$socket = find_passenger_socket();
if ($socket) {
    proxy_log("try socket: $socket");
    [$resp, $code, $hSize, $err, $errno] = forward_request('http://localhost' . $requestUri, $socket);
    if (is_live_upstream($resp, $code)) {
        proxy_log("socket OK status=$code");
        send_response($resp, $code, $hSize);
        exit;
    }
    $errMsg = $err ?: "status=$code";
    proxy_log("socket FAIL errno=$errno err=$errMsg");
    $errors[] = "socket errno=$errno: $errMsg";
} else {
    $errors[] = "socket:not_found";
}

// ── All upstreams failed ──────────────────────────────────────────────────────
$host = $_SERVER['HTTP_HOST'] ?? 'doctorsmyagency.com';
http_response_code(502);
header('Content-Type: application/json');
echo json_encode([
    'error'   => 'API server unreachable',
    'detail'  => 'Node.js did not respond on TCP 3002 or 3001. '
               . 'In Hostinger Terminal run: bash clinicos-api/force-start-api.sh',
    'errors'  => $errors,
    'code'    => 'PROXY_ERROR',
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

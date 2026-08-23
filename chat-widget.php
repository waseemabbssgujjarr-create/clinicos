<?php
/**
 * Same-origin proxy for IQ Pigeon SalesBot — avoids browser CORS blocking.
 * Widget calls /api/chat-widget.php on this domain.
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$target = 'https://iqpigeon.com/api/chat-widget.php';
$query = $_SERVER['QUERY_STRING'] ?? '';
if ($query !== '') {
    $target .= '?' . $query;
}

$body = file_get_contents('php://input');
$headers = ['Accept: application/json'];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $headers[] = 'Content-Type: application/json';
}

$ch = curl_init($target);
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST  => $_SERVER['REQUEST_METHOD'],
    CURLOPT_POSTFIELDS     => $body ?: null,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => $headers,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_CONNECTTIMEOUT => 8,
]);
$response = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
curl_close($ch);

if ($response === false) {
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Chat proxy error: ' . $err]);
    exit;
}

$brandColor = '#F97316';
$data = json_decode($response, true);
if (is_array($data) && !empty($data['success'])) {
    $data['widget_color'] = $brandColor;
    $data['widgetColor'] = $brandColor;
    $response = json_encode($data);
}

http_response_code($code > 0 ? $code : 200);
header('Content-Type: application/json');
echo $response;

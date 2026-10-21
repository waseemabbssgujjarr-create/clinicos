<?php
/**
 * Queue API restart (cron Node on port 3002).
 * Visit: https://doctorsmyagency.com/force-restart.php?key=DMA-SETUP-2026
 * cPanel "Restart Node" does NOT reload the cron API — use this after uploading dist/ files.
 */
header('Content-Type: application/json');

$key = $_GET['key'] ?? '';
if ($key !== 'DMA-SETUP-2026') {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Forbidden — add ?key=DMA-SETUP-2026']);
    exit;
}

$webRoot = __DIR__;
$apiRoot = is_dir($webRoot . '/clinicos-api') ? $webRoot . '/clinicos-api' : $webRoot;
$flag = $apiRoot . '/logs/force-restart';
$dir = dirname($flag);
if (!is_dir($dir)) {
    @mkdir($dir, 0755, true);
}
file_put_contents($flag, date('c'));

$host = $_SERVER['HTTP_HOST'] ?? 'doctorsmyagency.com';
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$base = $scheme . '://' . $host;

echo json_encode([
    'ok' => true,
    'message' => 'Force restart queued. Cron start-node.sh reloads the API within 5 minutes (or run force-start-api.sh now in Terminal).',
    'flag' => $flag,
    'faster' => '/bin/bash ' . $apiRoot . '/force-start-api.sh',
    'cron' => '/bin/bash ' . $apiRoot . '/start-node.sh',
    'verify' => $base . '/api/health',
    'diagnostics' => $base . '/api-status.php',
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

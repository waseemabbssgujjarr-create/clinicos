<?php
/**
 * Queue API restart (cron Node on port 3002).
 * Visit: https://clinicos.aderalabs.com/force-restart.php?key=DMA-SETUP-2026
 * cPanel "Restart Node" does NOT reload the cron API — use this after uploading dist/ files.
 */
header('Content-Type: application/json');

$key = $_GET['key'] ?? '';
if ($key !== 'DMA-SETUP-2026') {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Forbidden — add ?key=DMA-SETUP-2026']);
    exit;
}

$flag = '/home2/cognitom/clinicos.aderalabs.com/clinicos-api/logs/force-restart';
$dir = dirname($flag);
if (!is_dir($dir)) {
    @mkdir($dir, 0755, true);
}
file_put_contents($flag, date('c'));

echo json_encode([
    'ok' => true,
    'message' => 'Force restart queued. Cron reloads the API within 5 minutes.',
    'faster' => 'cPanel Terminal: /bin/bash /home2/cognitom/clinicos.aderalabs.com/clinicos-api/start-node.sh',
    'verify' => 'https://clinicos.aderalabs.com/api/leads/deploy-check — expect staffTrialLimit: 2 and ok: true',
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

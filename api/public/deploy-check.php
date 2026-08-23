<?php
/**
 * Browser-friendly deploy check (no .php suffix confusion with SPA fallback).
 * https://clinicos.aderalabs.com/api/public/deploy-check.php
 *
 * Also try the Node route after upload + restart:
 * https://clinicos.aderalabs.com/api/public/deploy-check
 */
header('Content-Type: application/json');

$home = '/home2/cognitom';
$webRoot = $home . '/clinicos.aderalabs.com';
$apiRoot = $webRoot . '/clinicos-api';
$routesPath = $apiRoot . '/dist/routes/public.routes.js';
$expectedDeploy = '2026-07-30-crm-webchat-persist';

function http_get_json($url, $timeout = 4) {
    $ctx = stream_context_create([
        'http' => ['timeout' => $timeout, 'ignore_errors' => true],
    ]);
    $body = @file_get_contents($url, false, $ctx);
    if ($body === false) return null;
    $data = json_decode($body, true);
    return is_array($data) ? $data : ['raw' => substr($body, 0, 500)];
}

$diskSrc = file_exists($routesPath) ? @file_get_contents($routesPath) : '';
$diskOk = $diskSrc !== '' && (strpos($diskSrc, "planStatus: { not: 'CANCELLED' }") !== false || strpos($diskSrc, 'crm-no-public-directory') !== false);
$diskBad = $diskSrc !== '' && strpos($diskSrc, 'SUSPENDED') !== false;

$liveClinics = http_get_json('https://clinicos.aderalabs.com/api/public/clinics');
$liveDeploy = http_get_json('https://clinicos.aderalabs.com/api/public/deploy-check');
$liveLeads = http_get_json('https://clinicos.aderalabs.com/api/leads/deploy-check');

$clinicsOk = is_array($liveClinics) && !isset($liveClinics['statusCode']) && !isset($liveClinics['error']);
$runningOld = is_array($liveClinics) && isset($liveClinics['error']) && stripos($liveClinics['error'], 'SUSPENDED') !== false;

echo json_encode([
    'ok' => $diskOk && $clinicsOk,
    'expected' => $expectedDeploy,
    'disk' => [
        'path' => $routesPath,
        'exists' => file_exists($routesPath),
        'modified' => file_exists($routesPath) ? date('c', filemtime($routesPath)) : null,
        'fix_present' => $diskOk,
        'old_suspended_bug' => $diskBad,
        'hint' => !$diskOk
            ? 'Upload clinicos-api/dist/routes/public.routes.js from your local Clinic-OS folder, then force-restart.'
            : ($runningOld ? 'File on disk looks fixed but running API is still old — visit force-restart.php and wait 5 min.' : null),
    ],
    'live_api' => [
        'clinics' => [
            'url' => 'https://clinicos.aderalabs.com/api/public/clinics',
            'status' => $clinicsOk ? 'ok' : ($runningOld ? '500_old_code' : 'error'),
            'preview' => is_array($liveClinics)
                ? (isset($liveClinics['clinics']) ? ['count' => count($liveClinics['clinics']), '_deploy' => $liveClinics['_deploy'] ?? null] : ['error' => substr($liveClinics['error'] ?? json_encode($liveClinics), 0, 200)])
                : null,
        ],
        'deploy_check' => [
            'url' => 'https://clinicos.aderalabs.com/api/public/deploy-check',
            'response' => $liveDeploy,
        ],
        'leads_deploy_check' => $liveLeads,
    ],
    'next_steps' => [
        '1. Upload clinicos-api/dist/routes/public.routes.js to server path clinicos-api/dist/routes/',
        '2. Visit https://clinicos.aderalabs.com/force-restart.php?key=DMA-SETUP-2026',
        '3. Wait up to 5 minutes (or run start-node.sh in cPanel Terminal)',
        '4. Re-open this page — clinics status should be ok',
    ],
    'note' => 'Use this .php URL in the browser. The Node route /api/public/deploy-check (no .php) works after API upload + restart.',
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

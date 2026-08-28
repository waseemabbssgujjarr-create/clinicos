<?php
/**
 * Scheduled tasks — bookings, drip, abandoned cart, shipments, tokens.
 * WhatsApp auto-reply is NOT done here (that races the webhook and goes silent).
 *
 * cPanel cron (every 15 min), HTTP only:
 *   curl -s "https://iqpigeon.com/api/cron.php?key=YOUR_CRON_SECRET"
 *
 * Do not use CLI `php api/cron.php?key=...` — PHP CLI ignores ?query strings.
 * Do not add turn-worker.php?run=1 on a short interval; it fights live chats.
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/booking.php';
require_once __DIR__ . '/../includes/drip.php';
require_once __DIR__ . '/../includes/abandoned-cart.php';
require_once __DIR__ . '/../includes/shipment.php';
require_once __DIR__ . '/../includes/platform-schema.php';
require_once __DIR__ . '/../includes/whatsapp-token.php';
require_once __DIR__ . '/../includes/platform-renewals.php';
require_once __DIR__ . '/../includes/ai-ceo.php';
require_once __DIR__ . '/../includes/catalog-image.php';
require_once __DIR__ . '/../includes/meta-catalog-sync.php';

header('Content-Type: application/json');

$key = (string) ($_GET['key'] ?? '');
$expected = defined('CRON_SECRET') ? CRON_SECRET : '';
if ($expected === '' || !hash_equals($expected, $key)) {
    json_response(['success' => false, 'error' => 'Unauthorized'], 401);
}

platform_ensure_all_silent();

$reminders = booking_process_reminders();
$drip = drip_process_all();
$abandoned = abandoned_cart_process_all();
$shipments = shipment_sync_all(80);
$whatsappTokens = whatsapp_process_token_health_all();
$platformRenewals = platform_renewal_process_all();
$aiCeoOutreach = ai_ceo_process_outreach_all();
$catalogOriginalsPurge = catalog_purge_expired_originals();
$metaCatalogSync = meta_catalog_process_pending(8, 80);

$turnRecover = ['dispatched' => false];
if (defined('APP_URL') && APP_URL !== '' && defined('CRON_SECRET') && CRON_SECRET !== '') {
    $workerUrl = rtrim((string) APP_URL, '/') . '/api/turn-worker.php';
    $payload = json_encode(['key' => CRON_SECRET, 'lead_ids' => []], JSON_UNESCAPED_UNICODE);
    $ch = curl_init($workerUrl);
    if ($ch !== false) {
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 1,
            CURLOPT_TIMEOUT        => 2,
        ]);
        curl_exec($ch);
        curl_close($ch);
        $turnRecover = [
            'dispatched' => true,
            'reason'     => 'Stale unanswered turns only. Live webhook still sends before Meta ACK. Worker skips leads that are live in the last 20s.',
        ];
    }
}

json_response([
    'success'   => true,
    'reminders' => $reminders,
    'drip'      => $drip,
    'abandoned' => $abandoned,
    'shipments' => $shipments,
    'whatsapp_tokens' => $whatsappTokens,
    'platform_renewals' => $platformRenewals,
    'ai_ceo_outreach' => $aiCeoOutreach,
    'turn_engine' => $turnRecover,
    'catalog_originals_purged' => $catalogOriginalsPurge['deleted'] ?? 0,
    'meta_catalog_sync' => $metaCatalogSync,
    'time'      => date('c'),
]);

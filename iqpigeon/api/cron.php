<?php
/**
 * Scheduled tasks — booking reminders.
 * Call via cPanel cron every 15 minutes:
 * curl -s "https://yoursite.com/api/cron.php?key=YOUR_CRON_SECRET"
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
require_once __DIR__ . '/../includes/conversation-turn-engine.php';
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
$forcedMaxWindow = turn_engine_force_max_window_due(0);
$forcedOverdue = turn_engine_force_finalize_all_overdue(5);
$recoveredTurns = turn_engine_recover_stuck_turns(8);
$turnEngine = turn_engine_process_due(30);
$turnEngine['forced_max_window'] = $forcedMaxWindow;
$turnEngine['forced_overdue'] = $forcedOverdue;
$turnEngine['recovered_stuck'] = $recoveredTurns;
$catalogOriginalsPurge = catalog_purge_expired_originals();
$metaCatalogSync = meta_catalog_process_pending(8, 80);

json_response([
    'success'   => true,
    'reminders' => $reminders,
    'drip'      => $drip,
    'abandoned' => $abandoned,
    'shipments' => $shipments,
    'whatsapp_tokens' => $whatsappTokens,
    'platform_renewals' => $platformRenewals,
    'ai_ceo_outreach' => $aiCeoOutreach,
    'turn_engine' => $turnEngine,
    'catalog_originals_purged' => $catalogOriginalsPurge['deleted'] ?? 0,
    'meta_catalog_sync' => $metaCatalogSync,
    'time'      => date('c'),
]);

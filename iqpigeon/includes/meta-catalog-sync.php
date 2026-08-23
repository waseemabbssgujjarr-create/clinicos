<?php
/**
 * Auto-provision Meta Commerce catalogs and sync bot_products → native WhatsApp product cards.
 * Runs per tenant when WhatsApp is connected — no manual Catalog ID paste required at scale.
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/phase5-schema.php';
require_once __DIR__ . '/commerce-schema.php';
require_once __DIR__ . '/whatsapp.php';
require_once __DIR__ . '/whatsapp-token.php';

function meta_catalog_auto_sync_enabled(): bool
{
    return !defined('META_CATALOG_AUTO_SYNC') || (bool) META_CATALOG_AUTO_SYNC;
}

function meta_catalog_ensure_schema(): void
{
    static $done = false;
    if ($done) {
        return;
    }

    ensure_phase5_schema();
    ensure_commerce_schema();

    $conn = db_connect();
    commerce_ensure_column($conn, 'bots', 'meta_business_id', 'VARCHAR(64) NULL AFTER whatsapp_catalog_id');
    commerce_ensure_column($conn, 'bots', 'meta_catalog_status', "VARCHAR(32) NOT NULL DEFAULT 'pending' AFTER meta_business_id");
    commerce_ensure_column($conn, 'bots', 'meta_catalog_error', 'TEXT NULL AFTER meta_catalog_status');
    commerce_ensure_column($conn, 'bots', 'meta_catalog_sync_pending', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER meta_catalog_error');
    commerce_ensure_column($conn, 'bots', 'meta_catalog_synced_at', 'TIMESTAMP NULL AFTER meta_catalog_sync_pending');
    commerce_ensure_column($conn, 'bot_products', 'meta_product_id', 'VARCHAR(64) NULL AFTER meta_retailer_id');
    commerce_ensure_column($conn, 'bot_products', 'meta_synced_at', 'TIMESTAMP NULL AFTER meta_product_id');

    $done = true;
}

function meta_catalog_set_status(int $botId, string $status, string $error = ''): void
{
    meta_catalog_ensure_schema();
    db_execute(
        'UPDATE bots SET meta_catalog_status = ?, meta_catalog_error = ? WHERE id = ?',
        'ssi',
        [$status, $error !== '' ? $error : null, $botId]
    );
}

function meta_catalog_mark_bot_pending(int $botId): void
{
    if (!meta_catalog_auto_sync_enabled() || $botId <= 0) {
        return;
    }

    meta_catalog_ensure_schema();
    db_execute(
        'UPDATE bots SET meta_catalog_sync_pending = 1 WHERE id = ? AND whatsapp_verified = 1',
        'i',
        [$botId]
    );
}

/**
 * @return array{token: string, waba_id: string, user_id: int, catalog_id: string, business_id: string, bot_name: string}|null
 */
function meta_catalog_bot_access(int $botId): ?array
{
    meta_catalog_ensure_schema();

    $bot = db_fetch(
        'SELECT id, user_id, name, whatsapp_phone_id, whatsapp_token, whatsapp_verified,
                whatsapp_catalog_id, meta_business_id
         FROM bots WHERE id = ?',
        'i',
        [$botId]
    );

    if (!$bot || empty($bot['whatsapp_verified']) || empty($bot['whatsapp_phone_id'])) {
        return null;
    }

    $token = bot_whatsapp_token_plain((string) ($bot['whatsapp_token'] ?? ''));
    if ($token === false || $token === '') {
        $account = db_fetch(
            'SELECT business_token, waba_id FROM client_whatsapp_accounts WHERE client_id = ? ORDER BY id DESC LIMIT 1',
            'i',
            [(int) $bot['user_id']]
        );
        if ($account) {
            $token = decrypt_token((string) ($account['business_token'] ?? ''));
            $wabaId = trim((string) ($account['waba_id'] ?? ''));
        } else {
            return null;
        }
    } else {
        $account = db_fetch(
            'SELECT waba_id FROM client_whatsapp_accounts WHERE client_id = ? ORDER BY id DESC LIMIT 1',
            'i',
            [(int) $bot['user_id']]
        );
        $wabaId = trim((string) ($account['waba_id'] ?? ''));
    }

    if (!is_string($token) || $token === '') {
        return null;
    }

    return [
        'token'       => $token,
        'waba_id'     => $wabaId,
        'user_id'     => (int) $bot['user_id'],
        'catalog_id'  => trim((string) ($bot['whatsapp_catalog_id'] ?? '')),
        'business_id' => trim((string) ($bot['meta_business_id'] ?? '')),
        'bot_name'    => trim((string) ($bot['name'] ?? 'Shop')),
    ];
}

function meta_catalog_resolve_business_id(string $token, string $wabaId): string
{
    if ($wabaId !== '') {
        $waba = whatsapp_graph_get(rawurlencode($wabaId) . '?fields=owner_business_info', $token);
        $bizId = trim((string) ($waba['data']['owner_business_info']['id'] ?? ''));
        if ($bizId !== '') {
            return $bizId;
        }
    }

    $businesses = whatsapp_graph_get('me/businesses?fields=id,name', $token);
    foreach ($businesses['data']['data'] ?? [] as $biz) {
        if (!is_array($biz)) {
            continue;
        }
        $bizId = trim((string) ($biz['id'] ?? ''));
        if ($bizId !== '') {
            return $bizId;
        }
    }

    if (defined('META_BUSINESS_ID') && trim((string) META_BUSINESS_ID) !== '') {
        return trim((string) META_BUSINESS_ID);
    }

    return '';
}

function meta_catalog_fetch_linked_catalog_id(string $wabaId, string $token, array $rejectIds = []): string
{
    if ($wabaId === '') {
        return '';
    }

    $reject = array_fill_keys(array_map('strval', $rejectIds), true);

    $linked = whatsapp_graph_get(rawurlencode($wabaId) . '/product_catalogs?fields=id,name', $token);
    foreach ($linked['data']['data'] ?? [] as $row) {
        if (!is_array($row)) {
            continue;
        }
        $id = trim((string) ($row['id'] ?? ''));
        if ($id === '' || isset($reject[$id])) {
            continue;
        }
        $valid = meta_catalog_validate_catalog($id, $token);
        if (!empty($valid['valid'])) {
            return $id;
        }
    }

    return '';
}

/**
 * @return array{valid: bool, error?: string, id?: string}
 */
function meta_catalog_validate_catalog(string $catalogId, string $token): array
{
    $catalogId = trim($catalogId);
    if ($catalogId === '') {
        return ['valid' => false, 'error' => 'Catalog ID empty'];
    }

    $result = whatsapp_graph_get(rawurlencode($catalogId) . '?fields=id,name,vertical', $token);
    if ($result['http_code'] >= 400 || empty($result['data']['id'])) {
        $err = (string) ($result['data']['error']['message'] ?? 'Catalog not accessible');

        return ['valid' => false, 'error' => $err];
    }

    // Reject WABA / page / other IDs mistaken for a product catalog.
    $products = whatsapp_graph_get(rawurlencode($catalogId) . '/products?limit=1&fields=id', $token);
    if ($products['http_code'] >= 400 || !isset($products['data']['data'])) {
        $err = (string) ($products['data']['error']['message'] ?? 'ID is not a Meta product catalog');

        return ['valid' => false, 'error' => $err];
    }

    return ['valid' => true, 'id' => (string) $result['data']['id']];
}

/**
 * @param array{reject_catalog_ids?: array<int, string>, force_create?: bool} $opts
 */
function meta_catalog_ensure_options(array $opts): array
{
    $reject = [];
    foreach ($opts['reject_catalog_ids'] ?? [] as $id) {
        $id = trim((string) $id);
        if ($id !== '') {
            $reject[] = $id;
        }
    }

    return [
        'reject_catalog_ids' => $reject,
        'force_create'       => !empty($opts['force_create']),
    ];
}

function meta_catalog_reset_stale_catalog(int $botId): void
{
    meta_catalog_ensure_schema();
    db_execute(
        'UPDATE bots SET whatsapp_catalog_id = NULL, meta_catalog_status = \'pending\', meta_catalog_error = NULL WHERE id = ?',
        'i',
        [$botId]
    );
    db_execute(
        'UPDATE bot_products SET meta_synced_at = NULL, meta_product_id = NULL WHERE bot_id = ?',
        'i',
        [$botId]
    );
}

function meta_catalog_permission_hint(string $error): string
{
    if (stripos($error, 'permission') !== false || stripos($error, 'does not exist') !== false) {
        return $error . ' Re-connect WhatsApp in Meta Embedded Signup and grant catalog access, or clear the Catalog ID override and click Sync now.';
    }

    return $error;
}

/**
 * Create (if needed) and link a Meta catalog for this bot's WABA.
 *
 * @param array{reject_catalog_ids?: array<int, string>, force_create?: bool} $opts
 * @return array{success: bool, catalog_id?: string, created?: bool, error?: string, skipped?: bool}
 */
function meta_catalog_ensure_for_bot(int $botId, array $opts = []): array
{
    if (!meta_catalog_auto_sync_enabled()) {
        return ['success' => false, 'skipped' => true];
    }

    $opts = meta_catalog_ensure_options($opts);
    $rejectIds = $opts['reject_catalog_ids'];
    $forceCreate = $opts['force_create'];

    meta_catalog_ensure_schema();
    $access = meta_catalog_bot_access($botId);
    if ($access === null) {
        return ['success' => false, 'error' => 'WhatsApp not connected'];
    }

    if ($access['waba_id'] === '') {
        meta_catalog_set_status($botId, 'needs_business', 'Missing WABA ID on account');
        return ['success' => false, 'error' => 'Missing WABA ID'];
    }

    $catalogId = $forceCreate ? '' : $access['catalog_id'];
    if ($catalogId !== '' && in_array($catalogId, $rejectIds, true)) {
        $catalogId = '';
    }

    if (!$forceCreate && $catalogId === '') {
        $catalogId = meta_catalog_fetch_linked_catalog_id($access['waba_id'], $access['token'], $rejectIds);
    }

    $businessId = $access['business_id'];
    if ($businessId === '') {
        $businessId = meta_catalog_resolve_business_id($access['token'], $access['waba_id']);
    }

    if (!$forceCreate && $catalogId !== '') {
        $valid = meta_catalog_validate_catalog($catalogId, $access['token']);
        if (empty($valid['valid'])) {
            error_log('meta_catalog_ensure_for_bot: stale catalog ' . $catalogId . ' — ' . ($valid['error'] ?? ''));
            meta_catalog_reset_stale_catalog($botId);
            $rejectIds[] = $catalogId;
            $catalogId = meta_catalog_fetch_linked_catalog_id($access['waba_id'], $access['token'], $rejectIds);
        } else {
            db_execute(
                'UPDATE bots SET whatsapp_catalog_id = ?, meta_business_id = ?, meta_catalog_status = \'active\', meta_catalog_error = NULL WHERE id = ?',
                'ssi',
                [$catalogId, $businessId !== '' ? $businessId : null, $botId]
            );

            return ['success' => true, 'catalog_id' => $catalogId, 'created' => false];
        }
    }

    if ($businessId === '') {
        meta_catalog_set_status($botId, 'needs_business', 'Grant catalog access in Meta Embedded Signup or set META_BUSINESS_ID.');
        return ['success' => false, 'error' => 'Could not resolve Meta Business ID'];
    }

    if ($catalogId !== '') {
        $valid = meta_catalog_validate_catalog($catalogId, $access['token']);
        if (!empty($valid['valid'])) {
            db_execute(
                'UPDATE bots SET whatsapp_catalog_id = ?, meta_business_id = ?, meta_catalog_status = \'active\', meta_catalog_error = NULL WHERE id = ?',
                'ssi',
                [$catalogId, $businessId, $botId]
            );

            return ['success' => true, 'catalog_id' => $catalogId, 'created' => false];
        }
        $rejectIds[] = $catalogId;
        $catalogId = '';
    }

    $catalogName = 'IQ Pigeon — ' . ($access['bot_name'] !== '' ? $access['bot_name'] : 'Shop') . ' #' . $botId;
    $create = whatsapp_graph_post(
        rawurlencode($businessId) . '/owned_product_catalogs',
        $access['token'],
        [
            'name'     => mb_substr($catalogName, 0, 100),
            'vertical' => 'commerce',
        ]
    );

    if ($create['http_code'] >= 400 || empty($create['data']['id'])) {
        $create = whatsapp_graph_post(
            rawurlencode($businessId) . '/product_catalogs',
            $access['token'],
            [
                'name'     => mb_substr($catalogName, 0, 100),
                'vertical' => 'commerce',
            ]
        );
    }

    if ($create['http_code'] >= 400 || empty($create['data']['id'])) {
        $err = (string) ($create['data']['error']['message'] ?? 'Meta catalog creation failed');
        meta_catalog_set_status($botId, 'error', $err);
        return ['success' => false, 'error' => $err];
    }

    $catalogId = (string) $create['data']['id'];

    $link = whatsapp_graph_post(
        rawurlencode($access['waba_id']) . '/product_catalogs',
        $access['token'],
        ['catalog_id' => $catalogId]
    );

    if ($link['http_code'] >= 400) {
        $linkErr = (string) ($link['data']['error']['message'] ?? 'Could not link catalog to WABA');
        error_log('meta_catalog_ensure_for_bot link: bot=' . $botId . ' ' . $linkErr);
        meta_catalog_set_status($botId, 'error', $linkErr);
    }

    db_execute(
        'UPDATE bots SET whatsapp_catalog_id = ?, meta_business_id = ?, meta_catalog_status = ?, meta_catalog_error = NULL WHERE id = ?',
        'sssi',
        [$catalogId, $businessId, ($link['http_code'] ?? 500) < 400 ? 'active' : 'error', $botId]
    );

    return ['success' => true, 'catalog_id' => $catalogId, 'created' => true];
}

/**
 * @param array<string, mixed> $product
 * @return array<string, mixed>
 */
function meta_catalog_product_batch_row(array $product, string $retailerId, string $method = 'UPDATE'): array
{
    $price = max(0, (float) ($product['price'] ?? 0));
    $currency = strtoupper(trim((string) ($product['currency'] ?? default_currency()))) ?: default_currency();
    $priceStr = number_format($price, 2, '.', '') . ' ' . $currency;

    $active = !empty($product['is_active']);
    $stock = $product['stock'] ?? null;
    if ($stock !== null && (int) $stock <= 0) {
        $active = false;
    }

    $imageUrl = trim((string) ($product['image_url'] ?? ''));
    $data = [
        'id'            => $retailerId,
        'title'         => mb_substr(trim((string) ($product['name'] ?? 'Product')), 0, 150),
        'description'   => mb_substr(trim((string) ($product['description'] ?? '')), 0, 5000),
        'availability'  => $active ? 'in stock' : 'out of stock',
        'condition'     => 'new',
        'price'         => $priceStr,
        'brand'         => 'Store',
    ];

    if ($imageUrl !== '') {
        $data['image_link'] = $imageUrl;
    }

    $category = trim((string) ($product['category'] ?? ''));
    if ($category !== '') {
        $data['google_product_category'] = mb_substr($category, 0, 250);
    }

    return [
        'method' => $method,
        'data'   => $data,
    ];
}

/**
 * Sync one product to Meta catalog.
 *
 * @return array{success: bool, error?: string, retailer_id?: string}
 */
function meta_catalog_sync_product(int $botId, int $productId): array
{
    if (!meta_catalog_auto_sync_enabled()) {
        return ['success' => false, 'error' => 'Auto sync disabled'];
    }

    meta_catalog_ensure_schema();
    require_once __DIR__ . '/catalog.php';

    $ensure = meta_catalog_ensure_for_bot($botId);
    if (empty($ensure['success'])) {
        return ['success' => false, 'error' => $ensure['error'] ?? 'Catalog not ready'];
    }

    $access = meta_catalog_bot_access($botId);
    if ($access === null || $access['catalog_id'] === '') {
        return ['success' => false, 'error' => 'Catalog ID missing'];
    }

    $product = db_fetch(
        'SELECT * FROM bot_products WHERE id = ? AND bot_id = ?',
        'ii',
        [$productId, $botId]
    );
    if (!$product) {
        return ['success' => false, 'error' => 'Product not found'];
    }

    $retailerId = catalog_resolve_meta_retailer_id($product);
    if ($retailerId === '') {
        return ['success' => false, 'error' => 'No retailer ID'];
    }

    $method = !empty($product['meta_synced_at']) ? 'UPDATE' : 'CREATE';
    $batch = meta_catalog_product_batch_row($product, $retailerId, $method);

    $result = whatsapp_graph_post(
        rawurlencode($access['catalog_id']) . '/items_batch',
        $access['token'],
        [
            'item_type' => 'PRODUCT_ITEM',
            'requests'  => [$batch],
        ]
    );

    if ($result['http_code'] >= 400) {
        $err = (string) ($result['data']['error']['message'] ?? 'Meta product sync failed');
        return ['success' => false, 'error' => $err];
    }

    $handles = $result['data']['handles'] ?? [];
    $validation = $result['data']['validation_status'] ?? null;
    if ($validation !== null && is_array($validation)) {
        foreach ($validation as $v) {
            if (!empty($v['errors'])) {
                return ['success' => false, 'error' => json_encode($v['errors'])];
            }
        }
    }

    db_execute(
        'UPDATE bot_products SET meta_retailer_id = ?, meta_synced_at = NOW() WHERE id = ? AND bot_id = ?',
        'sii',
        [$retailerId, $productId, $botId]
    );

    return ['success' => true, 'retailer_id' => $retailerId, 'handles' => $handles];
}

/**
 * Batch-sync active products for a bot (cron + manual).
 *
 * @return array{success: bool, synced: int, failed: int, errors: array<int, string>, catalog_id?: string}
 */
function meta_catalog_sync_bot(int $botId, int $batchSize = 80, array $opts = []): array
{
    $retryAfterReset = ($opts['retry_after_reset'] ?? true) !== false;
    $ensureOpts = meta_catalog_ensure_options($opts);
    $stats = ['success' => true, 'synced' => 0, 'failed' => 0, 'errors' => []];

    if (!meta_catalog_auto_sync_enabled()) {
        $stats['success'] = false;
        $stats['errors'][] = 'Auto sync disabled';
        return $stats;
    }

    $ensure = meta_catalog_ensure_for_bot($botId, $ensureOpts);
    if (empty($ensure['success'])) {
        $stats['success'] = false;
        $err = $ensure['error'] ?? 'Catalog setup failed';
        $stats['errors'][] = $err;
        if (empty($ensure['skipped'])) {
            meta_catalog_set_status($botId, 'error', $err);
        }
        return $stats;
    }

    $stats['catalog_id'] = $ensure['catalog_id'] ?? '';

    $access = meta_catalog_bot_access($botId);
    if ($access === null || $access['catalog_id'] === '') {
        $stats['success'] = false;
        $stats['errors'][] = 'Catalog not available';
        return $stats;
    }

    require_once __DIR__ . '/catalog.php';

    $products = db_fetch_all(
        'SELECT * FROM bot_products
         WHERE bot_id = ? AND is_active = 1
         ORDER BY (meta_synced_at IS NULL) DESC, sort_order ASC, id ASC
         LIMIT ?',
        'ii',
        [$botId, max(1, min(200, $batchSize))]
    );

    if ($products === []) {
        meta_catalog_ensure_schema();
        db_execute(
            'UPDATE bots SET meta_catalog_sync_pending = 0, meta_catalog_synced_at = NOW() WHERE id = ?',
            'i',
            [$botId]
        );
        return $stats;
    }

    $requests = [];
    $productMap = [];

    foreach ($products as $product) {
        $retailerId = catalog_resolve_meta_retailer_id($product);
        if ($retailerId === '') {
            continue;
        }
        $productId = (int) $product['id'];
        $method = empty($product['meta_synced_at']) ? 'CREATE' : 'UPDATE';
        $requests[] = meta_catalog_product_batch_row($product, $retailerId, $method);
        $productMap[] = ['id' => $productId, 'retailer_id' => $retailerId];
    }

    foreach (array_chunk($requests, 50) as $chunkIndex => $chunk) {
        $mapChunk = array_slice($productMap, $chunkIndex * 50, 50);

        $result = whatsapp_graph_post(
            rawurlencode($access['catalog_id']) . '/items_batch',
            $access['token'],
            [
                'item_type' => 'PRODUCT_ITEM',
                'requests'  => $chunk,
            ]
        );

        if ($result['http_code'] >= 400) {
            $err = meta_catalog_permission_hint((string) ($result['data']['error']['message'] ?? 'Batch sync failed'));
            if (stripos($err, 'does not exist') !== false || stripos($err, 'Unsupported post') !== false) {
                $failedCatalogId = $access['catalog_id'];
                meta_catalog_reset_stale_catalog($botId);
                if ($retryAfterReset) {
                    $reject = $ensureOpts['reject_catalog_ids'];
                    if ($failedCatalogId !== '') {
                        $reject[] = $failedCatalogId;
                    }

                    return meta_catalog_sync_bot($botId, $batchSize, [
                        'retry_after_reset'  => false,
                        'reject_catalog_ids' => $reject,
                        'force_create'       => true,
                    ]);
                }
                $stats['errors'][] = $err . ' Stale catalog cleared — click Sync now again.';
                $stats['success'] = false;
                break;
            }
            $stats['failed'] += count($chunk);
            if (count($stats['errors']) < 5) {
                $stats['errors'][] = $err;
            }
            continue;
        }

        foreach ($mapChunk as $row) {
            db_execute(
                'UPDATE bot_products SET meta_retailer_id = ?, meta_synced_at = NOW() WHERE id = ? AND bot_id = ?',
                'sii',
                [$row['retailer_id'], $row['id'], $botId]
            );
            $stats['synced']++;
        }
    }

    $remaining = db_fetch(
        'SELECT COUNT(*) AS c FROM bot_products WHERE bot_id = ? AND is_active = 1 AND meta_synced_at IS NULL',
        'i',
        [$botId]
    );
    $pending = (int) ($remaining['c'] ?? 0) > 0;

    meta_catalog_ensure_schema();
    if (!$stats['success'] && $stats['errors'] !== []) {
        meta_catalog_set_status($botId, 'error', implode(' ', $stats['errors']));
    } else {
        db_execute(
            'UPDATE bots SET meta_catalog_sync_pending = ?, meta_catalog_synced_at = NOW(), meta_catalog_status = \'active\', meta_catalog_error = NULL WHERE id = ?',
            'ii',
            [$pending ? 1 : 0, $botId]
        );
    }

    return $stats;
}

/**
 * After WhatsApp OAuth — provision catalog + queue product sync for all client bots.
 */
function meta_catalog_after_whatsapp_connect(int $clientId, string $wabaId, string $token): void
{
    if (!meta_catalog_auto_sync_enabled() || $clientId <= 0) {
        return;
    }

    meta_catalog_ensure_schema();

    $businessId = meta_catalog_resolve_business_id($token, $wabaId);
    $bots = db_fetch_all('SELECT id FROM bots WHERE user_id = ?', 'i', [$clientId]);

    foreach ($bots as $botRow) {
        $botId = (int) $botRow['id'];
        if ($businessId !== '') {
            db_execute(
                'UPDATE bots SET meta_business_id = ? WHERE id = ?',
                'si',
                [$businessId, $botId]
            );
        }
        meta_catalog_ensure_for_bot($botId);
        meta_catalog_mark_bot_pending($botId);
    }
}

/**
 * Cron: process bots flagged for Meta catalog sync.
 *
 * @return array{processed: int, synced: int, failed: int, bots: array<int, array<string, mixed>>}
 */
function meta_catalog_process_pending(int $maxBots = 8, int $productsPerBot = 80): array
{
    if (!meta_catalog_auto_sync_enabled()) {
        return ['processed' => 0, 'synced' => 0, 'failed' => 0, 'bots' => []];
    }

    meta_catalog_ensure_schema();

    $rows = db_fetch_all(
        'SELECT id FROM bots
         WHERE whatsapp_verified = 1
           AND (meta_catalog_sync_pending = 1 OR whatsapp_catalog_id IS NULL OR whatsapp_catalog_id = \'\')
         ORDER BY meta_catalog_synced_at IS NULL DESC, meta_catalog_synced_at ASC
         LIMIT ?',
        'i',
        [max(1, min(20, $maxBots))]
    );

    $summary = ['processed' => 0, 'synced' => 0, 'failed' => 0, 'bots' => []];

    foreach ($rows as $row) {
        $botId = (int) $row['id'];
        $result = meta_catalog_sync_bot($botId, $productsPerBot);
        $summary['processed']++;
        $summary['synced'] += (int) ($result['synced'] ?? 0);
        $summary['failed'] += (int) ($result['failed'] ?? 0);
        $summary['bots'][] = [
            'bot_id'     => $botId,
            'catalog_id' => $result['catalog_id'] ?? '',
            'synced'     => $result['synced'] ?? 0,
            'failed'     => $result['failed'] ?? 0,
            'errors'     => $result['errors'] ?? [],
        ];
    }

    return $summary;
}

/**
 * Human-readable sync status for Shop UI.
 *
 * @return array{status: string, label: string, detail: string, catalog_id: string}
 */
function meta_catalog_bot_status(int $botId): array
{
    meta_catalog_ensure_schema();

    $bot = db_fetch(
        'SELECT whatsapp_catalog_id, meta_catalog_status, meta_catalog_error, meta_catalog_synced_at, meta_catalog_sync_pending, whatsapp_verified
         FROM bots WHERE id = ?',
        'i',
        [$botId]
    );

    if (!$bot) {
        return ['status' => 'unknown', 'label' => 'Unknown', 'detail' => '', 'catalog_id' => ''];
    }

    $catalogId = trim((string) ($bot['whatsapp_catalog_id'] ?? ''));
    $status = (string) ($bot['meta_catalog_status'] ?? 'pending');
    $error = trim((string) ($bot['meta_catalog_error'] ?? ''));

    if (empty($bot['whatsapp_verified'])) {
        return [
            'status'     => 'disconnected',
            'label'      => 'Connect WhatsApp first',
            'detail'     => 'Native product cards auto-enable when WhatsApp is connected.',
            'catalog_id' => $catalogId,
        ];
    }

    if ($status === 'needs_business') {
        return [
            'status'     => $status,
            'label'      => 'Needs Meta catalog permission',
            'detail'     => $error !== '' ? $error : 'Re-connect WhatsApp and approve catalog access in Meta.',
            'catalog_id' => $catalogId,
        ];
    }

    if ($status === 'error') {
        return [
            'status'     => $status,
            'label'      => 'Sync error',
            'detail'     => $error !== '' ? $error : 'Check Meta app has catalog_management permission.',
            'catalog_id' => $catalogId,
        ];
    }

    if (!empty($bot['meta_catalog_sync_pending'])) {
        return [
            'status'     => 'syncing',
            'label'      => 'Syncing products to Meta…',
            'detail'     => 'Native WhatsApp product cards will appear once sync completes.',
            'catalog_id' => $catalogId,
        ];
    }

    if ($catalogId !== '') {
        return [
            'status'     => 'active',
            'label'      => 'Native catalog active',
            'detail'     => 'Products send as official WhatsApp catalog cards.',
            'catalog_id' => $catalogId,
        ];
    }

    return [
        'status'     => 'pending',
        'label'      => 'Catalog provisioning pending',
        'detail'     => 'Runs automatically after WhatsApp connect or product import.',
        'catalog_id' => '',
    ];
}

<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/iqp-ui.php';
require_once __DIR__ . '/../includes/bot-knowledge.php';
require_once __DIR__ . '/../includes/commerce-schema.php';
require_once __DIR__ . '/../includes/platform-schema.php';
require_once __DIR__ . '/../includes/industry-templates.php';
require_once __DIR__ . '/../includes/catalog.php';
require_once __DIR__ . '/../includes/whatsapp.php';
require_once __DIR__ . '/../includes/lead-lifecycle.php';
require_once __DIR__ . '/../includes/qualification-flow.php';
platform_ensure_all_silent();

$user   = require_login();
$userId = (int)$user['id'];

if (isset($_GET['tab']) && (string) $_GET['tab'] === 'training') {
    redirect('/client/training?tab=knowledge');
}

ensure_bots_schema();
ensure_lead_lifecycle_schema();
ensure_qualification_flow_schema();
ensure_client_starter_bot($userId);
ensure_commerce_schema(); // brings business_mode / conversion_goal columns online too
ensure_user_profile_schema(); // avatar_url / bio / address / phone / industry

$bot = db_fetch('SELECT * FROM bots WHERE user_id = ? ORDER BY id ASC LIMIT 1', 'i', [$userId]);
if (!$bot) {
    redirect('/client/dashboard');
}

$botId = (int)$bot['id'];
$message = '';
$error   = '';

// Handle POST saves
if ($_SERVER['REQUEST_METHOD'] === 'POST' && verify_csrf($_POST['csrf_token'] ?? '')) {
    $action = trim($_POST['action'] ?? '');

    if ($action === 'save_business_info') {
        $repName  = mb_substr(trim($_POST['rep_name'] ?? ''), 0, 30);
        $bizName  = mb_substr(trim($_POST['company_name'] ?? ''), 0, 120);
        $industry = mb_substr(trim($_POST['industry'] ?? ''), 0, 80);
        $bizEmail = mb_substr(trim($_POST['business_email'] ?? ''), 0, 120);
        $bizPhone = mb_substr(trim($_POST['business_phone'] ?? ''), 0, 30);
        $website  = mb_substr(trim($_POST['website_url'] ?? ''), 0, 255);
        $desc     = mb_substr(trim($_POST['business_description'] ?? ''), 0, 500);
        $address  = mb_substr(trim($_POST['business_address'] ?? ''), 0, 255);
        $timezone = mb_substr(trim($_POST['timezone'] ?? ''), 0, 80);
        $currency = mb_substr(trim($_POST['currency'] ?? ''), 0, 20);

        // Business Logo upload — same validated pipeline as client/settings.php avatar upload.
        $logoUpdate = '';
        if (!empty($_FILES['logo_file']['tmp_name'])) {
            $file  = $_FILES['logo_file'];
            $allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
            $ftype = @mime_content_type($file['tmp_name']);
            if (!in_array($ftype, $allowed, true)) {
                $error = 'Invalid logo type. Use JPG, PNG, SVG or WebP.';
            } elseif ($file['size'] > 2 * 1024 * 1024) {
                $error = 'Logo too large. Max 2MB.';
            } else {
                $ext = match ($ftype) {
                    'image/png' => 'png',
                    'image/webp' => 'webp',
                    'image/svg+xml' => 'svg',
                    default => 'jpg',
                };
                $dir = dirname(__DIR__) . '/uploads/avatars';
                if (!is_dir($dir)) { @mkdir($dir, 0775, true); }
                $fname = 'logo_' . $userId . '_' . time() . '.' . $ext;
                $dest  = $dir . '/' . $fname;
                if (move_uploaded_file($file['tmp_name'], $dest)) {
                    $logoUpdate = '/uploads/avatars/' . $fname;
                } else {
                    $error = 'Could not save logo. Check server permissions.';
                }
            }
        }

        if ($error === '') {
            db_execute(
                'UPDATE bots SET rep_name=?, website_url=?, knowledge_updated_at=NOW() WHERE id=? AND user_id=?',
                'ssii',
                [$repName, $website, $botId, $userId]
            );
            if ($bizName !== '') {
                db_execute('UPDATE bots SET name=? WHERE id=? AND user_id=?', 'sii', [$bizName, $botId, $userId]);
            }

            $companyForUser = $bizName !== '' ? $bizName : trim((string) ($user['company_name'] ?? ''));
            $sql = 'UPDATE users SET company_name=?, industry=?, bio=?, address=?, phone=?';
            $types = 'sssss';
            $params = [$companyForUser, $industry, $desc, $address, $bizPhone];
            if ($logoUpdate !== '') {
                $sql .= ', avatar_url=?';
                $types .= 's';
                $params[] = $logoUpdate;
            }
            $sql .= ' WHERE id=?';
            $types .= 'i';
            $params[] = $userId;
            db_execute($sql, $types, $params);

            $bot  = db_fetch('SELECT * FROM bots WHERE id=? AND user_id=?', 'ii', [$botId, $userId]);
            $user = db_fetch('SELECT * FROM users WHERE id=?', 'i', [$userId]);
            redirect('/client/training?tab=business&saved=1');
        }
        $bot  = db_fetch('SELECT * FROM bots WHERE id=? AND user_id=?', 'ii', [$botId, $userId]);
        $user = db_fetch('SELECT * FROM users WHERE id=?', 'i', [$userId]);
    }

    if ($action === 'save_knowledge') {
        $knowledge = mb_substr(trim($_POST['knowledge'] ?? ''), 0, 15000);
        db_execute('UPDATE bots SET bot_knowledge=?, knowledge_updated_at=NOW() WHERE id=? AND user_id=?',
            'sii', [$knowledge, $botId, $userId]);
        $message = 'Knowledge saved.';
        $bot = db_fetch('SELECT * FROM bots WHERE id=? AND user_id=?', 'ii', [$botId, $userId]);
    }

    if ($action === 'save_menu_cards' || $action === 'auto_menu_cards') {
        $allProducts = catalog_products_for_bot($botId, false);
        $byCategory = training_products_by_category($allProducts);
        $cards = [];

        if ($action === 'auto_menu_cards') {
            $cards = training_auto_menu_cards($byCategory);
            $message = $cards === []
                ? 'Add products in Shop first, then auto-fill menu cards.'
                : 'Menu cards created from your Shop catalog.';
        } else {
            $submitted = $_POST['menu_cards'] ?? [];
            if (is_array($submitted)) {
                $validIds = [];
                foreach ($allProducts as $p) {
                    $validIds[(int) $p['id']] = true;
                }
                foreach ($submitted as $row) {
                    if (!is_array($row)) {
                        continue;
                    }
                    $title = mb_substr(trim((string) ($row['title'] ?? '')), 0, 80);
                    $category = mb_substr(trim((string) ($row['category'] ?? '')), 0, 80);
                    $rawIds = (array) ($row['product_ids'] ?? []);
                    $productIds = [];
                    foreach ($rawIds as $pid) {
                        $pid = (int) $pid;
                        if ($pid > 0 && isset($validIds[$pid])) {
                            $productIds[] = $pid;
                        }
                    }
                    $productIds = array_values(array_unique($productIds));
                    if ($title === '' || $productIds === []) {
                        continue;
                    }
                    $cards[] = [
                        'id'          => mb_substr(trim((string) ($row['id'] ?? '')), 0, 64)
                            ?: ('card-' . substr(md5($category . $title . implode(',', $productIds)), 0, 12)),
                        'title'       => $title,
                        'category'    => $category !== '' ? $category : 'General',
                        'product_ids' => array_slice($productIds, 0, 30),
                    ];
                }
            }
            $message = 'Menu cards saved.';
        }

        bot_training_meta_update($botId, $userId, ['menu_cards' => $cards]);
        $bot = db_fetch('SELECT * FROM bots WHERE id=? AND user_id=?', 'ii', [$botId, $userId]);
    }

    if ($action === 'apply_industry') {
        ensure_lead_lifecycle_schema();
        require_once __DIR__ . '/../includes/qualification-flow.php';
        ensure_qualification_flow_schema();
        $key        = preg_replace('/[^a-z0-9_]/', '', mb_strtolower(trim($_POST['industry_key'] ?? '')));
        $currentKey = preg_replace('/[^a-z0-9_]/', '', mb_strtolower(trim((string) ($bot['industry_key'] ?? ''))));
        $force      = !empty($_POST['overwrite_existing']) || ($currentKey !== '' && $currentKey !== $key);
        $keepQual   = qualification_is_custom($bot) && empty($_POST['overwrite_qualification']);
        $tpl        = industry_template($key);
        if ($tpl === null) {
            $error = 'Pick a valid industry template.';
        } else {
            $applied = industry_apply_to_bot($bot, $key, $force);
            if ($keepQual) {
                db_execute(
                    'UPDATE bots SET industry_key=?, business_model=?, bot_knowledge=?, knowledge_updated_at=NOW() WHERE id=? AND user_id=?',
                    'sssii',
                    [$key, $applied['business_model'], $applied['bot_knowledge'], $botId, $userId]
                );
                db_execute('UPDATE users SET industry = ? WHERE id = ?', 'si', [$tpl['label'], $userId]);
                redirect('/client/training?tab=industry&applied=1&kept_qualify=1');
            }
            db_execute(
                'UPDATE bots SET industry_key=?, business_model=?, bot_knowledge=?, business_mode=?, conversion_goal=?, knowledge_updated_at=NOW() WHERE id=? AND user_id=?',
                'sssssii',
                [$key, $applied['business_model'], $applied['bot_knowledge'], $applied['business_mode'], $applied['conversion_goal'], $botId, $userId]
            );
            db_execute('UPDATE users SET industry = ? WHERE id = ?', 'si', [$tpl['label'], $userId]);
            $seedBot = array_merge($bot, [
                'industry_key'    => $key,
                'business_mode'   => $applied['business_mode'],
                'conversion_goal' => $applied['conversion_goal'],
            ]);
            qualification_save_for_bot($botId, $userId, qualification_defaults_for_bot($seedBot), false);
            redirect('/client/training?tab=industry&applied=1');
        }
    }

    if ($action === 'save_qualification') {
        require_once __DIR__ . '/../includes/qualification-flow.php';
        $postedQuestions = $_POST['questions'] ?? [];
        if (!is_array($postedQuestions)) {
            $postedQuestions = [];
        }
        qualification_save_for_bot($botId, $userId, [
            'questions'          => $postedQuestions,
            'qualify_trigger'    => $_POST['qualify_trigger'] ?? '',
            'qualify_message'    => $_POST['qualify_message'] ?? '',
            'disqualify_message' => $_POST['disqualify_message'] ?? '',
            'business_mode'      => $_POST['business_mode'] ?? 'mixed',
            'conversion_goal'    => $_POST['conversion_goal'] ?? '',
        ], true);
        redirect('/client/training?tab=qualify&saved=1');
    }

    if ($action === 'reset_qualification') {
        require_once __DIR__ . '/../includes/qualification-flow.php';
        if (qualification_reset_from_industry($bot, $userId)) {
            redirect('/client/training?tab=qualify&reset=1');
        }
        $error = 'Apply an industry template first, then reset Qualify to its starter questions.';
    }

    if ($action === 'save_hours') {
        $alwaysOpen = !empty($_POST['always_open']);
        $days = [];
        foreach (['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] as $day) {
            $slug = strtolower($day);
            $days[$day] = [
                'enabled' => isset($_POST['day_enabled'][$slug]),
                'open'    => mb_substr((string) ($_POST['day_open'][$slug] ?? '10:00'), 0, 5),
                'close'   => mb_substr((string) ($_POST['day_close'][$slug] ?? '22:00'), 0, 5),
            ];
        }
        bot_training_meta_update($botId, $userId, [
            'operating_hours' => ['always_open' => $alwaysOpen, 'days' => $days],
        ]);
        $message = 'Operating hours saved.';
        $bot = db_fetch('SELECT * FROM bots WHERE id=? AND user_id=?', 'ii', [$botId, $userId]);
    }

    if ($action === 'save_closed_behavior') {
        $text = mb_substr(trim($_POST['closed_behavior'] ?? ''), 0, 500);
        bot_training_meta_update($botId, $userId, ['closed_behavior' => $text]);
        $message = 'Closed-hours behavior saved.';
        $bot = db_fetch('SELECT * FROM bots WHERE id=? AND user_id=?', 'ii', [$botId, $userId]);
    }

    if ($action === 'add_trigger_word') {
        $word   = mb_substr(trim($_POST['word'] ?? ''), 0, 60);
        $intent = mb_substr(trim($_POST['intent'] ?? ''), 0, 80);
        if ($word === '') {
            $error = 'Type a trigger word or phrase.';
        } else {
            $meta = bot_training_meta($bot);
            $meta['trigger_words'][] = ['word' => $word, 'intent' => $intent, 'is_active' => true];
            bot_training_meta_update($botId, $userId, ['trigger_words' => $meta['trigger_words']]);
            $message = 'Trigger word added.';
            $bot = db_fetch('SELECT * FROM bots WHERE id=? AND user_id=?', 'ii', [$botId, $userId]);
        }
    }

    if ($action === 'delete_trigger_word') {
        $idx  = (int) ($_POST['index'] ?? -1);
        $meta = bot_training_meta($bot);
        if (isset($meta['trigger_words'][$idx])) {
            unset($meta['trigger_words'][$idx]);
            bot_training_meta_update($botId, $userId, ['trigger_words' => array_values($meta['trigger_words'])]);
            $message = 'Trigger word removed.';
            $bot = db_fetch('SELECT * FROM bots WHERE id=? AND user_id=?', 'ii', [$botId, $userId]);
        }
    }

    if ($action === 'toggle_trigger_word') {
        $idx  = (int) ($_POST['index'] ?? -1);
        $meta = bot_training_meta($bot);
        if (isset($meta['trigger_words'][$idx])) {
            $meta['trigger_words'][$idx]['is_active'] = empty($meta['trigger_words'][$idx]['is_active']);
            bot_training_meta_update($botId, $userId, ['trigger_words' => $meta['trigger_words']]);
            $bot = db_fetch('SELECT * FROM bots WHERE id=? AND user_id=?', 'ii', [$botId, $userId]);
        }
    }
}

// Data for view
$repName         = trim((string) ($bot['rep_name'] ?? ''));
$repNamePreview  = $repName !== '' ? $repName : 'Assistant';
$bizName     = (string)($user['company_name'] ?? '');
$industry    = (string)($user['industry'] ?? '');
$knowledge   = (string)($bot['bot_knowledge'] ?? '');
$websiteUrl  = (string)($bot['website_url'] ?? '');
$updated     = (string)($bot['knowledge_updated_at'] ?? '');
$industryKey = (string)($bot['industry_key'] ?? '');
$trainingMeta = bot_training_meta($bot);
$menuCards = (array) ($trainingMeta['menu_cards'] ?? []);
$industryTemplates = industry_templates_all();
$qualifyFlow = qualification_load_for_bot($bot);
$qualifyTypes = qualification_question_types();
$qualifyModes = bot_business_modes();
$qualifyGoals = bot_conversion_goals();

// WhatsApp connection status
$wa = db_fetch('SELECT * FROM client_whatsapp_accounts WHERE client_id=? AND connection_status=\'active\' ORDER BY connected_at DESC LIMIT 1', 'i', [$userId]);
if ($wa && !empty($wa['phone_display_number'])) {
    whatsapp_sync_user_business_phone($userId, (string) $wa['phone_display_number']);
    $user = db_fetch('SELECT * FROM users WHERE id=?', 'i', [$userId]) ?: $user;
}
$waDisplayPhone = trim((string) ($wa['phone_display_number'] ?? ''));
$businessPhone = trim((string) ($user['phone'] ?? ''));
if ($businessPhone === '' || whatsapp_is_placeholder_business_phone($businessPhone)) {
    $businessPhone = $waDisplayPhone;
}
$businessPhoneFromWhatsApp = $waDisplayPhone !== ''
    && ($businessPhone === $waDisplayPhone || whatsapp_is_placeholder_business_phone((string) ($user['phone'] ?? '')));

// Products for Menu tab + Industry preview
$products = catalog_products_for_bot($botId, false);
$productsByCategory = training_products_by_category($products);
$productMap = [];
foreach ($products as $p) {
    $productMap[(int) $p['id']] = $p;
}
$prodLimit = array_slice($products, 0, 5);

$csrf = csrf_token();

require __DIR__ . '/../includes/views/client-training.php';

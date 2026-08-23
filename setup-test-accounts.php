<?php
/**
 * One-time setup: remove old seed/test data and create fresh test logins.
 *
 * 1. Upload to site root (clinicos.aderalabs.com/)
 * 2. Open: https://clinicos.aderalabs.com/setup-test-accounts.php?key=DMA-SETUP-2026
 * 3. DELETE this file immediately after success
 */
header('Content-Type: application/json; charset=utf-8');

const SETUP_KEY = 'DMA-SETUP-2026';

const DOCTOR_EMAIL = 'support@clinicos.aderalabs.com'; // temp demo doctor login — update later
const STAFF_EMAIL  = 'demo.staff@doctorsmyagency.com';
const ADMIN_EMAIL  = 'admin@doctorsmyagency.com';

const DOCTOR_PASS = 'DmaTest2026!';
const STAFF_PASS  = 'DmaStaff2026!';
const ADMIN_PASS  = 'DmaAdmin2026!';

function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (($_GET['key'] ?? '') !== SETUP_KEY) {
    respond(['ok' => false, 'error' => 'Forbidden. Add ?key=' . SETUP_KEY . ' to the URL.'], 403);
}

function find_env_file() {
    foreach ([__DIR__ . '/clinicos-api/.env', __DIR__ . '/.env'] as $path) {
        if (is_readable($path)) return $path;
    }
    return null;
}

function parse_database_url($raw) {
    $url = trim($raw, " \t\n\r\0\x0B\"'");
    if (stripos($url, 'mysql://') !== 0) return ['error' => 'DATABASE_URL must start with mysql://'];
    $parts = parse_url('http://' . substr($url, 8));
    if (!$parts || empty($parts['host']) || empty($parts['user']) || empty($parts['path'])) {
        return ['error' => 'Could not parse DATABASE_URL'];
    }
    return [
        'user' => urldecode($parts['user']),
        'pass' => isset($parts['pass']) ? urldecode($parts['pass']) : '',
        'host' => $parts['host'],
        'port' => isset($parts['port']) ? (int)$parts['port'] : 3306,
        'db'   => ltrim($parts['path'], '/'),
    ];
}

$envPath = find_env_file();
if (!$envPath) respond(['ok' => false, 'error' => '.env not found']);

$content = file_get_contents($envPath);
if (!preg_match('/^DATABASE_URL=(.+)$/m', $content, $m)) {
    respond(['ok' => false, 'error' => 'DATABASE_URL missing in .env']);
}

$cfg = parse_database_url($m[1]);
if (isset($cfg['error'])) respond(['ok' => false, 'error' => $cfg['error']]);

$mysqli = @new mysqli($cfg['host'], $cfg['user'], $cfg['pass'], $cfg['db'], $cfg['port']);
if ($mysqli->connect_errno) {
    respond(['ok' => false, 'error' => 'DB connect failed: ' . $mysqli->connect_error]);
}
$mysqli->set_charset('utf8mb4');

function table_exists($mysqli, $name) {
    $esc = $mysqli->real_escape_string($name);
    $r = $mysqli->query("SHOW TABLES LIKE '$esc'");
    return $r && $r->num_rows > 0;
}

function delete_test_clinics($mysqli) {
    $patterns = [
        "%@test.clinicos.ai",
        "testreg%@example.com",
        "%@test.com",
    ];
    $ids = [];
    foreach ($patterns as $p) {
        $stmt = $mysqli->prepare("SELECT id FROM Clinic WHERE email LIKE ?");
        $stmt->bind_param('s', $p);
        $stmt->execute();
        $res = $stmt->get_result();
        while ($row = $res->fetch_assoc()) $ids[$row['id']] = true;
        $stmt->close();
    }
    if (!$ids) return 0;

    $idList = "'" . implode("','", array_map([$mysqli, 'real_escape_string'], array_keys($ids))) . "'";
    $childTables = [
        'DailyBrief', 'MissedCall', 'Lead', 'AILog', 'Notification', 'Broadcast',
        'Invoice', 'Message', 'Appointment', 'Patient', 'StaffMember',
    ];
    foreach ($childTables as $t) {
        if (table_exists($mysqli, $t)) {
            $mysqli->query("DELETE FROM `$t` WHERE clinicId IN ($idList)");
        }
    }
    $mysqli->query("DELETE FROM Clinic WHERE id IN ($idList)");
    return count($ids);
}

function delete_clinics_by_emails($mysqli, array $emails) {
    if (!$emails) return 0;
    $ids = [];
    foreach ($emails as $email) {
        $stmt = $mysqli->prepare("SELECT id FROM Clinic WHERE email = ?");
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $res = $stmt->get_result();
        while ($row = $res->fetch_assoc()) $ids[$row['id']] = true;
        $stmt->close();
    }
    if (!$ids) return 0;

    $idList = "'" . implode("','", array_map([$mysqli, 'real_escape_string'], array_keys($ids))) . "'";
    $childTables = [
        'DailyBrief', 'MissedCall', 'Lead', 'AILog', 'Notification', 'Broadcast',
        'Invoice', 'Message', 'Appointment', 'Patient', 'StaffMember',
    ];
    foreach ($childTables as $t) {
        if (table_exists($mysqli, $t)) {
            $mysqli->query("DELETE FROM `$t` WHERE clinicId IN ($idList)");
        }
    }
    $mysqli->query("DELETE FROM Clinic WHERE id IN ($idList)");
    return count($ids);
}

function bcrypt_for_node($password) {
    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    // PHP uses $2y$ — Node bcryptjs requires $2a$
    if (strpos($hash, '$2y$') === 0) {
        $hash = '$2a$' . substr($hash, 4);
    }
    return $hash;
}

function ensure_verification_columns($mysqli) {
    $cols = ['emailVerified', 'emailVerifyToken', 'emailVerifyExpires'];
    foreach (['Clinic', 'StaffMember'] as $table) {
        foreach ($cols as $col) {
            $r = $mysqli->query("SHOW COLUMNS FROM `$table` LIKE '$col'");
            if ($r && $r->num_rows === 0) {
                if ($col === 'emailVerified') {
                    $mysqli->query("ALTER TABLE `$table` ADD COLUMN `emailVerified` TINYINT(1) NOT NULL DEFAULT 0");
                } elseif ($col === 'emailVerifyToken') {
                    $mysqli->query("ALTER TABLE `$table` ADD COLUMN `emailVerifyToken` VARCHAR(191) NULL");
                } else {
                    $mysqli->query("ALTER TABLE `$table` ADD COLUMN `emailVerifyExpires` DATETIME(3) NULL");
                }
            }
        }
    }
}

function upsert_super_admin($mysqli, $email, $password, $name) {
    $hash = bcrypt_for_node($password);
    $id = 'sa_dma_' . substr(md5($email), 0, 12);

    $stmt = $mysqli->prepare("SELECT id FROM SuperAdmin WHERE email = ? LIMIT 1");
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $res = $stmt->get_result();
    $existing = $res ? $res->fetch_assoc() : null;
    $stmt->close();

    if ($existing && !empty($existing['id'])) {
        $stmt = $mysqli->prepare("UPDATE SuperAdmin SET passwordHash = ?, name = ? WHERE id = ?");
        $stmt->bind_param('sss', $hash, $name, $existing['id']);
        $stmt->execute();
        $stmt->close();
        return $existing['id'];
    }

    $stmt = $mysqli->prepare(
        "INSERT INTO SuperAdmin (id, email, passwordHash, name, createdAt)
         VALUES (?, ?, ?, ?, NOW())"
    );
    $stmt->bind_param('ssss', $id, $email, $hash, $name);
    $stmt->execute();
    $stmt->close();
    return $id;
}

function create_demo_clinic($mysqli, $doctorEmail, $doctorPass, $staffEmail, $staffPass) {
    $doctorHash = bcrypt_for_node($doctorPass);
    $staffHash  = bcrypt_for_node($staffPass);

    $clinicId = 'clinic_dma_demo_' . substr(md5($doctorEmail), 0, 8);
    $staffId  = 'staff_dma_demo_' . substr(md5($staffEmail), 0, 8);

    $ownerName = 'Dr. Demo Doctor';
    $clinicName = 'DMA Demo Clinic';
    $phone = '+971501112233';
    $specialty = 'general';
    $slug = 'dma-demo-clinic';
    $address = 'Dubai, UAE';
    $timezone = 'Asia/Dubai';
    $workingHours = json_encode([
        'monday' => ['isOpen' => true, 'open' => '09:00', 'close' => '17:00', 'slotDuration' => 30],
        'tuesday' => ['isOpen' => true, 'open' => '09:00', 'close' => '17:00', 'slotDuration' => 30],
        'wednesday' => ['isOpen' => true, 'open' => '09:00', 'close' => '17:00', 'slotDuration' => 30],
        'thursday' => ['isOpen' => true, 'open' => '09:00', 'close' => '17:00', 'slotDuration' => 30],
        'friday' => ['isOpen' => false],
        'saturday' => ['isOpen' => true, 'open' => '10:00', 'close' => '14:00', 'slotDuration' => 30],
        'sunday' => ['isOpen' => false],
    ]);
    $treatments = json_encode([
        ['name' => 'General Consultation', 'fee' => 150],
        ['name' => 'Checkup & Cleaning', 'fee' => 200],
    ]);

    $trialEnds = date('Y-m-d H:i:s', strtotime('+14 days'));

    $stmt = $mysqli->prepare(
        "INSERT INTO Clinic (
            id, name, ownerName, phone, email, passwordHash, specialty, address, timezone,
            bookingSlug, workingHours, treatments, plan, planStatus, trialEndsAt,
            onboardingDone, aiEnabled, isActive, emailVerified, createdAt, updatedAt
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, 'TRIAL', 'TRIALING', ?,
            1, 1, 1, 1, NOW(), NOW()
        )
        ON DUPLICATE KEY UPDATE
            passwordHash = VALUES(passwordHash),
            name = VALUES(name),
            ownerName = VALUES(ownerName),
            isActive = 1,
            onboardingDone = 1,
            aiEnabled = 1,
            emailVerified = 1,
            updatedAt = NOW()"
    );
    $stmt->bind_param(
        'sssssssssssss',
        $clinicId, $clinicName, $ownerName, $phone, $doctorEmail, $doctorHash,
        $specialty, $address, $timezone, $slug, $workingHours, $treatments, $trialEnds
    );
    $stmt->execute();
    $stmt->close();

    $staffName = 'Demo Receptionist';
    $role = 'RECEPTIONIST';
    $stmt = $mysqli->prepare(
        "INSERT INTO StaffMember (
            id, clinicId, name, email, passwordHash, role, isActive, emailVerified, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
            passwordHash = VALUES(passwordHash),
            clinicId = VALUES(clinicId),
            isActive = 1,
            emailVerified = 1,
            updatedAt = NOW()"
    );
    $stmt->bind_param('ssssss', $staffId, $clinicId, $staffName, $staffEmail, $staffHash, $role);
    $stmt->execute();
    $stmt->close();

    return ['clinicId' => $clinicId, 'bookingSlug' => $slug];
}

try {
    $mysqli->begin_transaction();

    ensure_verification_columns($mysqli);
    $removed = delete_test_clinics($mysqli);
    // Remove previous demo doctor email so booking slug can be reused
    $removed += delete_clinics_by_emails($mysqli, [
        'demo.doctor@doctorsmyagency.com',
        DOCTOR_EMAIL,
    ]);

    // Remove old super admin seed emails if present
    $mysqli->query("DELETE FROM SuperAdmin WHERE email IN (
        'support@clinicos.workee.online',
        'support@clinicos.aderalabs.com'
    ) AND email != '" . $mysqli->real_escape_string(ADMIN_EMAIL) . "'");

    upsert_super_admin($mysqli, ADMIN_EMAIL, ADMIN_PASS, 'DMA Platform Admin');
    $demo = create_demo_clinic($mysqli, DOCTOR_EMAIL, DOCTOR_PASS, STAFF_EMAIL, STAFF_PASS);

    $mysqli->commit();
    $mysqli->close();

    respond([
        'ok' => true,
        'message' => 'Test data reset complete. DELETE setup-test-accounts.php from server now.',
        'removed_old_test_clinics' => $removed,
        'logins' => [
            'super_admin' => [
                'url' => 'https://clinicos.workee.online/admin-login/',
                'legacy_url' => 'https://clinicos.workee.online/superadmin/login/',
                'email' => ADMIN_EMAIL,
                'password' => ADMIN_PASS,
            ],
            'doctor' => [
                'url' => 'https://clinicos.workee.online/doctor-login/',
                'email' => DOCTOR_EMAIL,
                'password' => DOCTOR_PASS,
                'dashboard' => 'https://clinicos.workee.online/dashboard/',
            ],
            'staff' => [
                'url' => 'https://clinicos.workee.online/staff-login/',
                'email' => STAFF_EMAIL,
                'password' => STAFF_PASS,
                'portal' => 'https://clinicos.workee.online/staff/',
            ],
            'patient_booking' => 'https://clinicos.workee.online/book/' . $demo['bookingSlug'] . '/',
        ],
        'note' => 'Old seed logins (rahman@test.clinicos.ai, staff@test.clinicos.ai) were removed if they existed.',
    ]);
} catch (Throwable $e) {
    $mysqli->rollback();
    $mysqli->close();
    respond(['ok' => false, 'error' => $e->getMessage()], 500);
}

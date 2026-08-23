<?php
/**
 * add-email-verification.php — add missing email verify columns
 * Run once: php add-email-verification.php
 * Or open via browser if placed in clinicos-api/ (delete after use)
 */
header('Content-Type: text/plain; charset=utf-8');

$envFile = __DIR__ . '/.env';
if (!is_readable($envFile)) {
    echo "FAIL: .env not found at $envFile\n";
    exit(1);
}

$url = null;
foreach (file($envFile) as $line) {
    $line = trim($line);
    if ($line === '' || $line[0] === '#') continue;
    if (preg_match('/^DATABASE_URL\s*=\s*(.+)$/', $line, $m)) {
        $url = trim($m[1], " \t\"'");
    }
}
if (!$url || !preg_match('#^mysql://([^:]+):([^@]+)@([^:/]+):(\d+)/([^?]+)#', $url, $p)) {
    echo "FAIL: could not parse DATABASE_URL\n";
    exit(1);
}

[, $user, $pass, $host, $port, $db] = $p;
$m = @new mysqli($host, $user, $pass, $db, (int)$port);
if (!$m || $m->connect_error) {
    echo "FAIL: MySQL " . ($m ? $m->connect_error : 'no mysqli') . "\n";
    exit(1);
}

echo "Connected as $user @ $host / $db\n\n";

$columns = [
    'Clinic' => [
        'emailVerified'     => 'TINYINT(1) NOT NULL DEFAULT 0',
        'emailVerifyToken'  => 'VARCHAR(191) NULL',
        'emailVerifyExpires'=> 'DATETIME(3) NULL',
    ],
    'StaffMember' => [
        'emailVerified'     => 'TINYINT(1) NOT NULL DEFAULT 0',
        'emailVerifyToken'  => 'VARCHAR(191) NULL',
        'emailVerifyExpires'=> 'DATETIME(3) NULL',
    ],
];

foreach ($columns as $table => $cols) {
    echo "=== $table ===\n";
    foreach ($cols as $col => $def) {
        $r = $m->query("SHOW COLUMNS FROM `$table` LIKE '$col'");
        if ($r && $r->num_rows > 0) {
            echo "  skip $col (exists)\n";
            continue;
        }
        $sql = "ALTER TABLE `$table` ADD COLUMN `$col` $def";
        if ($m->query($sql)) {
            echo "  ADDED $col\n";
        } else {
            echo "  FAIL $col: " . $m->error . "\n";
        }
    }
}

echo "\nDone. Test resend:\n";
echo "curl -s -X POST http://127.0.0.1:3002/api/auth/resend-verification -H \"Content-Type: application/json\" -d '{\"email\":\"haydenak63@gmail.com\"}'\n";

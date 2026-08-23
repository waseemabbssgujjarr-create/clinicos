<?php
/**
 * Data Deletion Request Handler
 * POST /data-deletion/request.php
 *
 * Accepts a JSON deletion request from the data-deletion/index.html form,
 * validates it, logs it to a local file, and emails the DPO.
 *
 * Meta App Review requirement: the data-deletion URL must be a functional
 * endpoint that processes user data deletion requests.
 */

declare(strict_types=1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://doctorsmyagency.com');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// ── Config ───────────────────────────────────────────────────────────────────

define('DPO_EMAIL',     'privacy@doctorsmyagency.com');
define('DPO_NAME',      'Doctors My Agency Privacy Team');
define('FROM_EMAIL',    'noreply@doctorsmyagency.com');
define('FROM_NAME',     'Doctors My Agency');
define('LOG_FILE',      __DIR__ . '/deletion-requests.log');
define('MAX_LOG_BYTES', 5 * 1024 * 1024); // 5 MB max log size

// ── Parse input ───────────────────────────────────────────────────────────────

$raw   = file_get_contents('php://input');
$input = json_decode($raw ?: '', true);

if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON']);
    exit;
}

$name          = trim((string) ($input['name']          ?? ''));
$email         = trim((string) ($input['email']         ?? ''));
$deletionType  = trim((string) ($input['deletion_type'] ?? ''));
$details       = trim((string) ($input['details']       ?? ''));

// ── Validate ──────────────────────────────────────────────────────────────────

$allowed_types = [
    'full_account',
    'whatsapp_only',
    'patient_record',
    'staff_account',
    'other',
];

$errors = [];
if ($name === '' || strlen($name) > 120) {
    $errors[] = 'Name is required (max 120 chars)';
}
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'Valid email address is required';
}
if (!in_array($deletionType, $allowed_types, true)) {
    $errors[] = 'Invalid deletion type';
}
// Sanitise free-text to prevent log injection
$details = preg_replace('/[\r\n\t]+/', ' ', $details);
$details = substr($details, 0, 1000);

if ($errors !== []) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => implode('. ', $errors)]);
    exit;
}

// ── Rate limit (simple IP-based, per hour) ────────────────────────────────────

$ip         = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateLock   = sys_get_temp_dir() . '/dma_del_' . md5($ip) . '.tmp';
$now        = time();
$rateWindow = 3600; // 1 hour
$rateLimit  = 5;    // max 5 requests per IP per hour

$history = [];
if (file_exists($rateLock)) {
    $history = array_filter(
        array_map('intval', explode(',', file_get_contents($rateLock) ?: '')),
        fn($t) => $t > $now - $rateWindow
    );
}
if (count($history) >= $rateLimit) {
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'Too many requests. Please wait before submitting again.']);
    exit;
}
$history[] = $now;
file_put_contents($rateLock, implode(',', $history));

// ── Log request ───────────────────────────────────────────────────────────────

$refId     = strtoupper(substr(md5(uniqid($email, true)), 0, 10));
$timestamp = date('Y-m-d H:i:s T');

$logEntry = sprintf(
    "[%s] REF:%s | IP:%s | EMAIL:%s | NAME:%s | TYPE:%s | DETAILS:%s\n",
    $timestamp,
    $refId,
    $ip,
    $email,
    $name,
    $deletionType,
    $details !== '' ? $details : '(none)'
);

// Rotate log if too large
if (file_exists(LOG_FILE) && filesize(LOG_FILE) > MAX_LOG_BYTES) {
    rename(LOG_FILE, LOG_FILE . '.bak');
}
file_put_contents(LOG_FILE, $logEntry, FILE_APPEND | LOCK_EX);

// ── Send email to DPO ─────────────────────────────────────────────────────────

$deletionLabels = [
    'full_account'   => 'Full account + all data',
    'whatsapp_only'  => 'WhatsApp connection + message data only',
    'patient_record' => 'Specific patient record',
    'staff_account'  => 'Staff account',
    'other'          => 'Other',
];
$typeLabel = $deletionLabels[$deletionType] ?? $deletionType;

$subject = "Data Deletion Request [REF:{$refId}] — {$email}";

$body = <<<TEXT
A data deletion request has been submitted on doctorsmyagency.com.

Reference: {$refId}
Date/Time: {$timestamp}
IP Address: {$ip}

Requestor name:  {$name}
Requestor email: {$email}
Deletion scope:  {$typeLabel}
Additional info: {$details}

---
Required action: Process this deletion within 30 days per Privacy Policy.
Log entry saved: deletion-requests.log

To reply to the requestor, email: {$email}
TEXT;

$htmlBody = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Data Deletion Request</title></head>
<body style="font-family:Arial,sans-serif;background:#f8fafc;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0">
    <div style="background:#dc2626;color:#fff;padding:12px 18px;border-radius:8px;margin-bottom:24px">
      <strong>Data Deletion Request</strong> — Action Required Within 30 Days
    </div>
    <table style="width:100%;font-size:14px;border-collapse:collapse">
      <tr><td style="padding:8px 0;color:#64748b;width:140px">Reference ID</td><td style="padding:8px 0;font-weight:700;color:#0f172a">{$refId}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b">Date/Time</td><td style="padding:8px 0">{$timestamp}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b">Name</td><td style="padding:8px 0">{$name}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b">Email</td><td style="padding:8px 0"><a href="mailto:{$email}">{$email}</a></td></tr>
      <tr><td style="padding:8px 0;color:#64748b">Scope</td><td style="padding:8px 0;font-weight:600">{$typeLabel}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;vertical-align:top">Details</td><td style="padding:8px 0">{$details}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b">IP Address</td><td style="padding:8px 0">{$ip}</td></tr>
    </table>
    <div style="margin-top:24px;padding:14px 18px;background:#fef2f2;border-radius:8px;font-size:13px;color:#991b1b">
      Process this deletion within <strong>30 days</strong> per Privacy Policy and GDPR requirements. Reply to requestor at <a href="mailto:{$email}">{$email}</a> to confirm.
    </div>
    <p style="font-size:12px;color:#94a3b8;margin-top:20px">Doctors My Agency · doctorsmyagency.com · privacy@doctorsmyagency.com</p>
  </div>
</body>
</html>
HTML;

$boundary = 'BOUNDARY_' . md5((string) time());
$headers  = implode("\r\n", [
    'From: ' . FROM_NAME . ' <' . FROM_EMAIL . '>',
    'Reply-To: ' . $email,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
    'X-Mailer: DoctorsMyAgency/1.0',
]);

$message = "--{$boundary}\r\n"
    . "Content-Type: text/plain; charset=UTF-8\r\n\r\n"
    . $body . "\r\n"
    . "--{$boundary}\r\n"
    . "Content-Type: text/html; charset=UTF-8\r\n\r\n"
    . $htmlBody . "\r\n"
    . "--{$boundary}--";

$mailSent = @mail(DPO_EMAIL, $subject, $message, $headers);

// ── Send confirmation to requestor ────────────────────────────────────────────

$confirmSubject = "Data Deletion Request Received [REF:{$refId}]";
$confirmBody    = <<<TEXT
Hello {$name},

We have received your data deletion request (Reference: {$refId}).

Requested deletion scope: {$typeLabel}

What happens next:
1. We will confirm receipt within 2 business days.
2. Deletion will be completed within 30 days.
3. You will receive a final confirmation email when deletion is complete.

If you have questions, reply to this email or contact privacy@doctorsmyagency.com.

Reference: {$refId}
Submitted: {$timestamp}

— Doctors My Agency Privacy Team
doctorsmyagency.com/privacy/
TEXT;

$confirmHeaders = implode("\r\n", [
    'From: ' . DPO_NAME . ' <' . DPO_EMAIL . '>',
    'Content-Type: text/plain; charset=UTF-8',
]);
@mail($email, $confirmSubject, $confirmBody, $confirmHeaders);

// ── Respond ───────────────────────────────────────────────────────────────────

echo json_encode([
    'success'   => true,
    'ref'       => $refId,
    'message'   => 'Deletion request received. You will be emailed a confirmation within 2 business days.',
]);

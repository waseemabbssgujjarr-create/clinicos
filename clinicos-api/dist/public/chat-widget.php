<?php
/**
 * chat-widget.php — Doctors My Agency
 *
 * The previous version of this file proxied requests to the IQPigeon
 * SalesBot CDN (https://iqpigeon.com/api/chat-widget.php).
 * That external dependency has been removed.
 *
 * Doctors My Agency operates its own AI receptionist via WhatsApp Embedded
 * Signup and the /api/ai/* endpoints. No third-party chat proxy is needed.
 *
 * This file returns a safe 404 so that any cached widget embed codes that
 * still call /api/chat-widget.php do not proxy traffic to iqpigeon.com.
 */
http_response_code(404);
header('Content-Type: application/json');
echo json_encode([
    'success' => false,
    'error'   => 'Chat widget service not available. Use WhatsApp via Doctors My Agency.',
]);

<?php
/**
 * Legacy /doctor path — redirect to Doctors My Agency doctor login.
 */
header('Location: /doctor-login/', true, 302);
header('Cache-Control: no-store, no-cache, must-revalidate');
exit;
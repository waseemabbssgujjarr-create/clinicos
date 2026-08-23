<?php
/**
 * Legacy ClinicOS path — redirect to Doctors My Agency platform admin login.
 */
header('Location: /admin-login/', true, 302);
header('Cache-Control: no-store, no-cache, must-revalidate');
exit;

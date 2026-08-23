<?php
/**
 * Legacy /staff path — redirect to Doctors My Agency staff login.
 */
header('Location: /staff-login/', true, 302);
header('Cache-Control: no-store, no-cache, must-revalidate');
exit;
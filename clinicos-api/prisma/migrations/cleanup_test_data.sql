-- Remove old seed / test clinic data (phpMyAdmin → cognitom_clinicos_db → SQL)
-- Safe patterns only: @test.clinicos.ai and testreg*@example.com
-- Does NOT delete real clinic registrations.

SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM DailyBrief WHERE clinicId IN (
  SELECT id FROM Clinic WHERE email LIKE '%@test.clinicos.ai' OR email LIKE 'testreg%@example.com'
);
DELETE FROM MissedCall WHERE clinicId IN (
  SELECT id FROM Clinic WHERE email LIKE '%@test.clinicos.ai' OR email LIKE 'testreg%@example.com'
);
DELETE FROM `Lead` WHERE clinicId IN (
  SELECT id FROM Clinic WHERE email LIKE '%@test.clinicos.ai' OR email LIKE 'testreg%@example.com'
);
DELETE FROM AILog WHERE clinicId IN (
  SELECT id FROM Clinic WHERE email LIKE '%@test.clinicos.ai' OR email LIKE 'testreg%@example.com'
);
DELETE FROM Notification WHERE clinicId IN (
  SELECT id FROM Clinic WHERE email LIKE '%@test.clinicos.ai' OR email LIKE 'testreg%@example.com'
);
DELETE FROM Broadcast WHERE clinicId IN (
  SELECT id FROM Clinic WHERE email LIKE '%@test.clinicos.ai' OR email LIKE 'testreg%@example.com'
);
DELETE FROM Invoice WHERE clinicId IN (
  SELECT id FROM Clinic WHERE email LIKE '%@test.clinicos.ai' OR email LIKE 'testreg%@example.com'
);
DELETE FROM Message WHERE clinicId IN (
  SELECT id FROM Clinic WHERE email LIKE '%@test.clinicos.ai' OR email LIKE 'testreg%@example.com'
);
DELETE FROM Appointment WHERE clinicId IN (
  SELECT id FROM Clinic WHERE email LIKE '%@test.clinicos.ai' OR email LIKE 'testreg%@example.com'
);
DELETE FROM Patient WHERE clinicId IN (
  SELECT id FROM Clinic WHERE email LIKE '%@test.clinicos.ai' OR email LIKE 'testreg%@example.com'
);
DELETE FROM StaffMember WHERE clinicId IN (
  SELECT id FROM Clinic WHERE email LIKE '%@test.clinicos.ai' OR email LIKE 'testreg%@example.com'
);
DELETE FROM Clinic WHERE email LIKE '%@test.clinicos.ai' OR email LIKE 'testreg%@example.com';

-- Old placeholder super admins (optional)
DELETE FROM SuperAdmin WHERE email IN ('support@clinicos.workee.online');

SET FOREIGN_KEY_CHECKS = 1;

-- After this, run setup-test-accounts.php to create fresh logins.

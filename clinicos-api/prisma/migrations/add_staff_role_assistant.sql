-- Ensure StaffMember.role accepts ASSISTANT (safe to re-run).
-- Run in phpMyAdmin on cognitom_clinicos_db if assistant invites fail with a server error.

ALTER TABLE `StaffMember`
  MODIFY COLUMN `role` ENUM('RECEPTIONIST','NURSE','ASSISTANT','MANAGER') NOT NULL DEFAULT 'RECEPTIONIST';

-- Safe email verification migration (phpMyAdmin → cognitom_clinicos_db → SQL)
-- Run the ENTIRE script once. Safe if columns already exist (skips duplicates).

DELIMITER $$

DROP PROCEDURE IF EXISTS dma_add_email_verification$$
CREATE PROCEDURE dma_add_email_verification()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Clinic' AND COLUMN_NAME = 'emailVerified'
  ) THEN
    ALTER TABLE `Clinic` ADD COLUMN `emailVerified` TINYINT(1) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Clinic' AND COLUMN_NAME = 'emailVerifyToken'
  ) THEN
    ALTER TABLE `Clinic` ADD COLUMN `emailVerifyToken` VARCHAR(191) NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Clinic' AND COLUMN_NAME = 'emailVerifyExpires'
  ) THEN
    ALTER TABLE `Clinic` ADD COLUMN `emailVerifyExpires` DATETIME(3) NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'StaffMember' AND COLUMN_NAME = 'emailVerified'
  ) THEN
    ALTER TABLE `StaffMember` ADD COLUMN `emailVerified` TINYINT(1) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'StaffMember' AND COLUMN_NAME = 'emailVerifyToken'
  ) THEN
    ALTER TABLE `StaffMember` ADD COLUMN `emailVerifyToken` VARCHAR(191) NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'StaffMember' AND COLUMN_NAME = 'emailVerifyExpires'
  ) THEN
    ALTER TABLE `StaffMember` ADD COLUMN `emailVerifyExpires` DATETIME(3) NULL;
  END IF;
END$$

DELIMITER ;

CALL dma_add_email_verification();
DROP PROCEDURE IF EXISTS dma_add_email_verification;

-- Mark existing accounts verified (safe to run anytime)
UPDATE `Clinic` SET `emailVerified` = 1 WHERE `emailVerified` = 0;
UPDATE `StaffMember` SET `emailVerified` = 1 WHERE `isActive` = 1;

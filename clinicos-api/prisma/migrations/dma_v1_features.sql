-- ⚠️ DO NOT RUN THIS ON AN EMPTY DATABASE ⚠️
--
-- Error you saw: "Table Patient doesn't exist"
-- Reason: This file ONLY adds NEW V1 features to EXISTING tables.
--
-- ✅ CORRECT FIX (use cPanel Terminal instead):
--    cd ~/clinicos.aderalabs.com/clinicos-api
--    npx prisma db push
--
-- That creates ALL tables (Patient, Clinic, Lead, etc.) in one step.
--
-- Only run THIS file if you already imported Railway database
-- and tables Clinic, Patient, Appointment already exist.
-- ─────────────────────────────────────────────────────────────

-- Patient: lead score + opt-out (skip line if column already exists)
ALTER TABLE `Patient`
  ADD COLUMN `optedOut` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `optedOutAt` DATETIME(3) NULL,
  ADD COLUMN `leadScore` ENUM('HOT','WARM','COLD') NOT NULL DEFAULT 'COLD';

-- Message: tags, intent, summary
ALTER TABLE `Message`
  ADD COLUMN `tags` TEXT NULL,
  ADD COLUMN `intent` VARCHAR(191) NULL,
  ADD COLUMN `summary` TEXT NULL;

-- Extend MessageChannel enum
ALTER TABLE `Message`
  MODIFY COLUMN `channel` ENUM('WHATSAPP','SMS','CALL','EMAIL','INSTAGRAM','WEBSITE') NOT NULL;

-- Lead table
CREATE TABLE IF NOT EXISTS `Lead` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `patientId` VARCHAR(191) NULL,
  `fullName` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NULL,
  `enquiryReason` TEXT NULL,
  `treatmentInterest` VARCHAR(191) NULL,
  `intent` ENUM('BOOKING','PRICE','TREATMENT','EMERGENCY','GENERAL') NOT NULL DEFAULT 'GENERAL',
  `status` ENUM('NEW','CONTACTED','BOOKED','VISITED','FOLLOW_UP','CONVERTED','LOST') NOT NULL DEFAULT 'NEW',
  `leadScore` ENUM('HOT','WARM','COLD') NOT NULL DEFAULT 'COLD',
  `source` ENUM('WHATSAPP','SMS','CALL','EMAIL','INSTAGRAM','WEBSITE') NOT NULL DEFAULT 'WHATSAPP',
  `tags` TEXT NULL,
  `followUpCount` INT NOT NULL DEFAULT 0,
  `lastFollowUpAt` DATETIME(3) NULL,
  `nextFollowUpAt` DATETIME(3) NULL,
  `rescuedAt` DATETIME(3) NULL,
  `convertedAt` DATETIME(3) NULL,
  `estimatedValue` DECIMAL(10,2) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `Lead_clinicId_phone_key` (`clinicId`, `phone`),
  INDEX `Lead_clinicId_status_idx` (`clinicId`, `status`),
  INDEX `Lead_clinicId_leadScore_idx` (`clinicId`, `leadScore`),
  INDEX `Lead_clinicId_nextFollowUpAt_idx` (`clinicId`, `nextFollowUpAt`),
  CONSTRAINT `Lead_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Lead_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `MissedCall` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `callerPhone` VARCHAR(191) NOT NULL,
  `calledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `recoverySent` BOOLEAN NOT NULL DEFAULT false,
  `recoverySentAt` DATETIME(3) NULL,
  `replied` BOOLEAN NOT NULL DEFAULT false,
  `repliedAt` DATETIME(3) NULL,
  `booked` BOOLEAN NOT NULL DEFAULT false,
  `bookedAt` DATETIME(3) NULL,
  `appointmentId` VARCHAR(191) NULL,
  `recoveredValue` DECIMAL(10,2) NULL,
  `leadId` VARCHAR(191) NULL,
  PRIMARY KEY (`id`),
  INDEX `MissedCall_clinicId_calledAt_idx` (`clinicId`, `calledAt`),
  INDEX `MissedCall_clinicId_booked_idx` (`clinicId`, `booked`),
  CONSTRAINT `MissedCall_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `DailyBrief` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `briefDate` DATE NOT NULL,
  `appointmentsToday` INT NOT NULL DEFAULT 0,
  `appointmentsBooked` INT NOT NULL DEFAULT 0,
  `chatsHandled` INT NOT NULL DEFAULT 0,
  `newLeads` INT NOT NULL DEFAULT 0,
  `hotLeads` INT NOT NULL DEFAULT 0,
  `missedCalls` INT NOT NULL DEFAULT 0,
  `recoveredBookings` INT NOT NULL DEFAULT 0,
  `recoveredRevenue` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `lostLeadsRescued` INT NOT NULL DEFAULT 0,
  `noShows` INT NOT NULL DEFAULT 0,
  `summary` TEXT NOT NULL,
  `actionItems` TEXT NULL,
  `sentAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `DailyBrief_clinicId_briefDate_key` (`clinicId`, `briefDate`),
  INDEX `DailyBrief_clinicId_briefDate_idx` (`clinicId`, `briefDate`),
  CONSTRAINT `DailyBrief_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

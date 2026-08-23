-- ═══════════════════════════════════════════════════════════════════
-- Doctors My Agency / ClinicOS — FULL DATABASE SETUP
-- Run in: cPanel → phpMyAdmin → select cognitom_clinicos_db → SQL tab
-- Use when: database is EMPTY (no Patient table error)
-- Do NOT run dma_v1_features.sql — this file replaces it entirely.
-- ═══════════════════════════════════════════════════════════════════

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `DailyBrief`;
DROP TABLE IF EXISTS `MissedCall`;
DROP TABLE IF EXISTS `Lead`;
DROP TABLE IF EXISTS `PasswordReset`;
DROP TABLE IF EXISTS `Invoice`;
DROP TABLE IF EXISTS `Broadcast`;
DROP TABLE IF EXISTS `Notification`;
DROP TABLE IF EXISTS `AILog`;
DROP TABLE IF EXISTS `Message`;
DROP TABLE IF EXISTS `Appointment`;
DROP TABLE IF EXISTS `Patient`;
DROP TABLE IF EXISTS `StaffMember`;
DROP TABLE IF EXISTS `Plan`;
DROP TABLE IF EXISTS `Clinic`;
DROP TABLE IF EXISTS `SuperAdmin`;

SET FOREIGN_KEY_CHECKS = 1;

-- SuperAdmin
CREATE TABLE `SuperAdmin` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `SuperAdmin_email_key` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clinic
CREATE TABLE `Clinic` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `ownerName` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(191) NOT NULL,
  `specialty` VARCHAR(191) NULL,
  `address` VARCHAR(191) NULL,
  `logoUrl` VARCHAR(191) NULL,
  `bookingSlug` VARCHAR(191) NOT NULL,
  `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Dubai',
  `workingHours` TEXT NULL,
  `treatments` TEXT NULL,
  `defaultFee` DECIMAL(10,2) NULL,
  `aiEnabled` BOOLEAN NOT NULL DEFAULT true,
  `aiLanguage` VARCHAR(191) NOT NULL DEFAULT 'english',
  `aiPersonality` VARCHAR(191) NOT NULL DEFAULT 'professional',
  `autoConfirm` BOOLEAN NOT NULL DEFAULT true,
  `reminderTiming` VARCHAR(191) NOT NULL DEFAULT 'both',
  `reviewTiming` VARCHAR(191) NOT NULL DEFAULT '1h_after',
  `customIntroMsg` TEXT NULL,
  `googlePlaceId` VARCHAR(191) NULL,
  `googleApiKey` VARCHAR(191) NULL,
  `stripeCustomerId` VARCHAR(191) NULL,
  `stripeSubId` VARCHAR(191) NULL,
  `plan` ENUM('TRIAL','STARTER','PRO','ENTERPRISE') NOT NULL DEFAULT 'TRIAL',
  `planStatus` ENUM('ACTIVE','PAST_DUE','CANCELLED','TRIALING') NOT NULL DEFAULT 'ACTIVE',
  `trialEndsAt` DATETIME(3) NULL,
  `currentPeriodEnd` DATETIME(3) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `onboardingDone` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `Clinic_phone_key` (`phone`),
  UNIQUE INDEX `Clinic_email_key` (`email`),
  UNIQUE INDEX `Clinic_bookingSlug_key` (`bookingSlug`),
  UNIQUE INDEX `Clinic_stripeCustomerId_key` (`stripeCustomerId`),
  UNIQUE INDEX `Clinic_stripeSubId_key` (`stripeSubId`),
  INDEX `Clinic_bookingSlug_idx` (`bookingSlug`),
  INDEX `Clinic_email_idx` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Plan
CREATE TABLE `Plan` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `stripePriceId` VARCHAR(191) NOT NULL,
  `priceMonthly` DECIMAL(10,2) NOT NULL,
  `maxStaff` INT NOT NULL DEFAULT 1,
  `maxPatients` INT NOT NULL DEFAULT 500,
  `aiMessagesLimit` INT NOT NULL DEFAULT 1000,
  `features` TEXT NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `Plan_name_key` (`name`),
  UNIQUE INDEX `Plan_stripePriceId_key` (`stripePriceId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- StaffMember
CREATE TABLE `StaffMember` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NULL,
  `passwordHash` VARCHAR(191) NOT NULL,
  `role` ENUM('RECEPTIONIST','NURSE','ASSISTANT','MANAGER') NOT NULL DEFAULT 'RECEPTIONIST',
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `inviteToken` VARCHAR(191) NULL,
  `inviteExpiry` DATETIME(3) NULL,
  `lastLogin` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `StaffMember_email_key` (`email`),
  UNIQUE INDEX `StaffMember_inviteToken_key` (`inviteToken`),
  INDEX `StaffMember_clinicId_idx` (`clinicId`),
  CONSTRAINT `StaffMember_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Patient
CREATE TABLE `Patient` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `fullName` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NULL,
  `dateOfBirth` DATETIME(3) NULL,
  `gender` VARCHAR(191) NULL,
  `bloodGroup` VARCHAR(191) NULL,
  `medicalNotes` TEXT NULL,
  `allergies` VARCHAR(191) NULL,
  `emergencyName` VARCHAR(191) NULL,
  `emergencyPhone` VARCHAR(191) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `magicLinkToken` VARCHAR(191) NULL,
  `magicLinkExpiry` DATETIME(3) NULL,
  `portalEnabled` BOOLEAN NOT NULL DEFAULT false,
  `optedOut` BOOLEAN NOT NULL DEFAULT false,
  `optedOutAt` DATETIME(3) NULL,
  `leadScore` ENUM('HOT','WARM','COLD') NOT NULL DEFAULT 'COLD',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `Patient_magicLinkToken_key` (`magicLinkToken`),
  UNIQUE INDEX `Patient_clinicId_phone_key` (`clinicId`, `phone`),
  INDEX `Patient_clinicId_idx` (`clinicId`),
  INDEX `Patient_clinicId_leadScore_idx` (`clinicId`, `leadScore`),
  CONSTRAINT `Patient_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Appointment
CREATE TABLE `Appointment` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `patientId` VARCHAR(191) NOT NULL,
  `treatment` VARCHAR(191) NOT NULL,
  `dateTime` DATETIME(3) NOT NULL,
  `durationMin` INT NOT NULL DEFAULT 30,
  `status` ENUM('PENDING','CONFIRMED','ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW','RESCHEDULED') NOT NULL DEFAULT 'PENDING',
  `channel` ENUM('MANUAL','WHATSAPP','SMS','CALL','EMAIL','ONLINE_BOOKING','STAFF_PORTAL') NOT NULL DEFAULT 'MANUAL',
  `notes` VARCHAR(191) NULL,
  `fee` DECIMAL(10,2) NULL,
  `confirmationSent` BOOLEAN NOT NULL DEFAULT false,
  `reminder24hSent` BOOLEAN NOT NULL DEFAULT false,
  `reminder2hSent` BOOLEAN NOT NULL DEFAULT false,
  `reviewSent` BOOLEAN NOT NULL DEFAULT false,
  `bookedByStaffId` VARCHAR(191) NULL,
  `bookedByAI` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `Appointment_clinicId_dateTime_idx` (`clinicId`, `dateTime`),
  INDEX `Appointment_patientId_idx` (`patientId`),
  CONSTRAINT `Appointment_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Appointment_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Message
CREATE TABLE `Message` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `patientId` VARCHAR(191) NULL,
  `channel` ENUM('WHATSAPP','SMS','CALL','EMAIL','INSTAGRAM','WEBSITE') NOT NULL,
  `direction` ENUM('INBOUND','OUTBOUND') NOT NULL,
  `fromNumber` VARCHAR(191) NOT NULL,
  `toNumber` VARCHAR(191) NOT NULL,
  `body` TEXT NOT NULL,
  `isRead` BOOLEAN NOT NULL DEFAULT false,
  `isHandledByAI` BOOLEAN NOT NULL DEFAULT false,
  `aiConfidence` DOUBLE NULL,
  `needsReview` BOOLEAN NOT NULL DEFAULT false,
  `tags` TEXT NULL,
  `intent` VARCHAR(191) NULL,
  `summary` TEXT NULL,
  `twilioSid` VARCHAR(191) NULL,
  `replyToId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `Message_clinicId_createdAt_idx` (`clinicId`, `createdAt`),
  INDEX `Message_patientId_idx` (`patientId`),
  CONSTRAINT `Message_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Message_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AILog
CREATE TABLE `AILog` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `action` VARCHAR(191) NOT NULL,
  `details` TEXT NOT NULL,
  `patientId` VARCHAR(191) NULL,
  `success` BOOLEAN NOT NULL DEFAULT true,
  `error` VARCHAR(191) NULL,
  `durationMs` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `AILog_clinicId_createdAt_idx` (`clinicId`, `createdAt`),
  CONSTRAINT `AILog_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notification
CREATE TABLE `Notification` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `body` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `color` VARCHAR(191) NOT NULL DEFAULT 'teal',
  `isRead` BOOLEAN NOT NULL DEFAULT false,
  `link` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `Notification_clinicId_isRead_createdAt_idx` (`clinicId`, `isRead`, `createdAt`),
  CONSTRAINT `Notification_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Broadcast
CREATE TABLE `Broadcast` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `channel` VARCHAR(191) NOT NULL,
  `targetGroup` VARCHAR(191) NOT NULL,
  `messageBody` TEXT NOT NULL,
  `sentCount` INT NOT NULL DEFAULT 0,
  `failedCount` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(191) NOT NULL DEFAULT 'completed',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `Broadcast_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Invoice
CREATE TABLE `Invoice` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `stripeInvoiceId` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'usd',
  `status` VARCHAR(191) NOT NULL,
  `period` VARCHAR(191) NOT NULL,
  `pdfUrl` VARCHAR(191) NULL,
  `paidAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `Invoice_stripeInvoiceId_key` (`stripeInvoiceId`),
  INDEX `Invoice_clinicId_idx` (`clinicId`),
  CONSTRAINT `Invoice_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lead (V1 killer features)
CREATE TABLE `Lead` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- MissedCall
CREATE TABLE `MissedCall` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DailyBrief
CREATE TABLE `DailyBrief` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PasswordReset
CREATE TABLE `PasswordReset` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `token` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `used` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `PasswordReset_token_key` (`token`),
  INDEX `PasswordReset_token_idx` (`token`),
  INDEX `PasswordReset_email_idx` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed: Subscription Plans
INSERT INTO `Plan` (`id`, `name`, `stripePriceId`, `priceMonthly`, `maxStaff`, `maxPatients`, `aiMessagesLimit`, `features`, `isActive`, `createdAt`) VALUES
('plan_starter', 'Starter', 'price_starter_v1', 29.00, 1, 500, 1000, '["dashboard","whatsapp_ai","reminders","booking"]', true, NOW(3)),
('plan_pro', 'Pro', 'price_pro_v1', 59.00, 3, 2000, 5000, '["dashboard","whatsapp_ai","analytics","lead_score","missed_call_recovery"]', true, NOW(3)),
('plan_enterprise', 'Enterprise', 'price_enterprise_v1', 99.00, 10, -1, -1, '["dashboard","whatsapp_ai","analytics","priority_support","multi_location"]', true, NOW(3));

-- Seed: Subscription Plans only
-- Create your admin account at: https://clinicos.aderalabs.com/register/
-- Super admin: ask host to enable Terminal OR use Railway export for existing admin data

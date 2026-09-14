-- Phase 5: first-class clinical domain, CALLED status, roster, locations,
-- leave, rooms, patient AR, documents, lab, inventory, tele, insurance.
-- Idempotent: schema-ensure ignores duplicate column/key errors.

-- Append CALLED at the end. MySQL ENUMs are stored as indexes; inserting a
-- value in the middle would remap existing IN_PROGRESS/COMPLETED rows.
ALTER TABLE `Appointment`
  MODIFY COLUMN `status` ENUM('PENDING','CONFIRMED','ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW','RESCHEDULED','CALLED') NOT NULL DEFAULT 'PENDING';

ALTER TABLE `Appointment` ADD COLUMN `practitionerId` VARCHAR(191) NULL;
ALTER TABLE `Appointment` ADD COLUMN `locationId` VARCHAR(191) NULL;
ALTER TABLE `Appointment` ADD COLUMN `roomId` VARCHAR(191) NULL;
ALTER TABLE `Appointment` ADD COLUMN `calledAt` DATETIME(3) NULL;
ALTER TABLE `Appointment` ADD COLUMN `calledBy` VARCHAR(191) NULL;
ALTER TABLE `Appointment` ADD COLUMN `chartMigratedAt` DATETIME(3) NULL;
ALTER TABLE `Appointment` MODIFY COLUMN `notes` TEXT NULL;

CREATE TABLE IF NOT EXISTS `Practitioner` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `specialty` VARCHAR(191) NULL,
  `isPrimary` BOOLEAN NOT NULL DEFAULT false,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `Practitioner_clinicId_isActive_idx` (`clinicId`, `isActive`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Location` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `address` VARCHAR(191) NULL,
  `isPrimary` BOOLEAN NOT NULL DEFAULT false,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `Location_clinicId_isActive_idx` (`clinicId`, `isActive`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Room` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `locationId` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `status` ENUM('AVAILABLE','RESERVED','OCCUPIED','BLOCKED') NOT NULL DEFAULT 'AVAILABLE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `Room_clinicId_status_idx` (`clinicId`, `status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Leave` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `practitionerId` VARCHAR(191) NOT NULL,
  `startsAt` DATETIME(3) NOT NULL,
  `endsAt` DATETIME(3) NOT NULL,
  `reason` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `Leave_clinicId_startsAt_endsAt_idx` (`clinicId`, `startsAt`, `endsAt`),
  INDEX `Leave_practitionerId_startsAt_idx` (`practitionerId`, `startsAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ScheduleBlock` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `practitionerId` VARCHAR(191) NULL,
  `locationId` VARCHAR(191) NULL,
  `roomId` VARCHAR(191) NULL,
  `startsAt` DATETIME(3) NOT NULL,
  `endsAt` DATETIME(3) NOT NULL,
  `kind` VARCHAR(191) NOT NULL DEFAULT 'BLOCK',
  `reason` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `ScheduleBlock_clinicId_startsAt_endsAt_idx` (`clinicId`, `startsAt`, `endsAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Encounter` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `appointmentId` VARCHAR(191) NOT NULL,
  `patientId` VARCHAR(191) NOT NULL,
  `practitionerId` VARCHAR(191) NULL,
  `status` ENUM('DRAFT','IN_PROGRESS','COMPLETED') NOT NULL DEFAULT 'DRAFT',
  `startedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `migratedFromNotesAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `Encounter_appointmentId_key` (`appointmentId`),
  INDEX `Encounter_clinicId_patientId_idx` (`clinicId`, `patientId`),
  INDEX `Encounter_patientId_createdAt_idx` (`patientId`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ClinicalNote` (
  `id` VARCHAR(191) NOT NULL,
  `encounterId` VARCHAR(191) NOT NULL,
  `complaint` TEXT NULL,
  `history` TEXT NULL,
  `exam` TEXT NULL,
  `assessment` TEXT NULL,
  `treatment` TEXT NULL,
  `freeText` TEXT NULL,
  `draft` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ClinicalNote_encounterId_key` (`encounterId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Observation` (
  `id` VARCHAR(191) NOT NULL,
  `encounterId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `display` VARCHAR(191) NULL,
  `value` VARCHAR(191) NOT NULL,
  `unit` VARCHAR(191) NULL,
  `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `Observation_encounterId_code_idx` (`encounterId`, `code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Diagnosis` (
  `id` VARCHAR(191) NOT NULL,
  `encounterId` VARCHAR(191) NOT NULL,
  `condition` TEXT NOT NULL,
  `code` VARCHAR(191) NULL,
  `display` VARCHAR(191) NULL,
  `isPrimary` BOOLEAN NOT NULL DEFAULT true,
  `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `Diagnosis_encounterId_idx` (`encounterId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Prescription` (
  `id` VARCHAR(191) NOT NULL,
  `encounterId` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `status` ENUM('DRAFT','ISSUED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `issuedAt` DATETIME(3) NULL,
  `issuedBy` VARCHAR(191) NULL,
  `cancelledAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `Prescription_clinicId_status_idx` (`clinicId`, `status`),
  INDEX `Prescription_encounterId_idx` (`encounterId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PrescriptionItem` (
  `id` VARCHAR(191) NOT NULL,
  `prescriptionId` VARCHAR(191) NOT NULL,
  `drug` VARCHAR(191) NOT NULL,
  `strength` VARCHAR(191) NULL,
  `route` VARCHAR(191) NULL,
  `dose` VARCHAR(191) NULL,
  `frequency` VARCHAR(191) NULL,
  `duration` VARCHAR(191) NULL,
  `quantity` VARCHAR(191) NULL,
  `instructions` TEXT NULL,
  `refills` INT NOT NULL DEFAULT 0,
  `sortOrder` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `PrescriptionItem_prescriptionId_idx` (`prescriptionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `FollowUp` (
  `id` VARCHAR(191) NOT NULL,
  `encounterId` VARCHAR(191) NOT NULL,
  `note` TEXT NOT NULL,
  `dueDate` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `FollowUp_encounterId_key` (`encounterId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PatientInvoice` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `patientId` VARCHAR(191) NOT NULL,
  `appointmentId` VARCHAR(191) NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `balance` DECIMAL(10,2) NOT NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'usd',
  `status` ENUM('DRAFT','OPEN','PARTIAL','PAID','VOID','REFUNDED') NOT NULL DEFAULT 'DRAFT',
  `note` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `PatientInvoice_clinicId_patientId_idx` (`clinicId`, `patientId`),
  INDEX `PatientInvoice_patientId_status_idx` (`patientId`, `status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PatientPayment` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `patientId` VARCHAR(191) NOT NULL,
  `invoiceId` VARCHAR(191) NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `method` VARCHAR(191) NOT NULL DEFAULT 'CASH',
  `kind` VARCHAR(191) NOT NULL DEFAULT 'PAYMENT',
  `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `note` VARCHAR(191) NULL,
  PRIMARY KEY (`id`),
  INDEX `PatientPayment_clinicId_patientId_idx` (`clinicId`, `patientId`),
  INDEX `PatientPayment_invoiceId_idx` (`invoiceId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PatientLedgerEntry` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `patientId` VARCHAR(191) NOT NULL,
  `invoiceId` VARCHAR(191) NULL,
  `type` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `note` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `PatientLedgerEntry_clinicId_patientId_createdAt_idx` (`clinicId`, `patientId`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PatientDocument` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `patientId` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL DEFAULT 'OTHER',
  `filename` VARCHAR(191) NOT NULL,
  `mimeType` VARCHAR(191) NOT NULL,
  `size` INT NOT NULL,
  `storageKey` VARCHAR(191) NOT NULL,
  `uploadedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `PatientDocument_clinicId_patientId_idx` (`clinicId`, `patientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `LabOrder` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `patientId` VARCHAR(191) NOT NULL,
  `appointmentId` VARCHAR(191) NULL,
  `encounterId` VARCHAR(191) NULL,
  `status` ENUM('ORDERED','COLLECTED','PROCESSING','COMPLETED','CANCELLED') NOT NULL DEFAULT 'ORDERED',
  `note` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `LabOrder_clinicId_patientId_idx` (`clinicId`, `patientId`),
  INDEX `LabOrder_encounterId_idx` (`encounterId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `LabOrderItem` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `testName` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'ORDERED',
  PRIMARY KEY (`id`),
  INDEX `LabOrderItem_orderId_idx` (`orderId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `LabResult` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NULL,
  `code` VARCHAR(191) NULL,
  `value` VARCHAR(191) NOT NULL,
  `unit` VARCHAR(191) NULL,
  `flag` VARCHAR(191) NULL,
  `reportedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `LabResult_orderId_idx` (`orderId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Sku` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `unit` VARCHAR(191) NOT NULL DEFAULT 'ea',
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `Sku_clinicId_isActive_idx` (`clinicId`, `isActive`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `StockLot` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `skuId` VARCHAR(191) NOT NULL,
  `lotCode` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `StockLot_clinicId_skuId_idx` (`clinicId`, `skuId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `StockMovement` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `skuId` VARCHAR(191) NOT NULL,
  `lotId` VARCHAR(191) NULL,
  `type` VARCHAR(191) NOT NULL,
  `quantity` DECIMAL(12,3) NOT NULL,
  `note` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdBy` VARCHAR(191) NULL,
  PRIMARY KEY (`id`),
  INDEX `StockMovement_clinicId_skuId_createdAt_idx` (`clinicId`, `skuId`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Dispense` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `skuId` VARCHAR(191) NOT NULL,
  `lotId` VARCHAR(191) NULL,
  `prescriptionId` VARCHAR(191) NULL,
  `prescriptionItemId` VARCHAR(191) NULL,
  `quantity` DECIMAL(12,3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdBy` VARCHAR(191) NULL,
  PRIMARY KEY (`id`),
  INDEX `Dispense_clinicId_createdAt_idx` (`clinicId`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `TeleSession` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `appointmentId` VARCHAR(191) NOT NULL,
  `provider` VARCHAR(191) NOT NULL,
  `providerSessionId` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'SCHEDULED',
  `startedAt` DATETIME(3) NULL,
  `endedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `TeleSession_clinicId_appointmentId_idx` (`clinicId`, `appointmentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Coverage` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `patientId` VARCHAR(191) NOT NULL,
  `payer` VARCHAR(191) NOT NULL,
  `memberId` VARCHAR(191) NULL,
  `isPrimary` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `Coverage_clinicId_patientId_idx` (`clinicId`, `patientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Claim` (
  `id` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `coverageId` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
  `note` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `Claim_clinicId_status_idx` (`clinicId`, `status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

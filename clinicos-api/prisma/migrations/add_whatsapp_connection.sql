-- ═══════════════════════════════════════════════════════════════════
-- Migration: add_whatsapp_connection
-- Adds the ClinicWhatsAppConnection table to an existing DMA database.
--
-- Run on production (cPanel Terminal):
--   cd ~/doctorsmyagency.com/clinicos-api
--   mysql -u DB_USER -p DB_NAME < prisma/migrations/add_whatsapp_connection.sql
--
-- Or in phpMyAdmin: select the database → SQL tab → paste and execute.
-- Safe to run multiple times (IF NOT EXISTS).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS `ClinicWhatsAppConnection` (
  `id`                  VARCHAR(191)  NOT NULL,
  `clinicId`            VARCHAR(191)  NOT NULL,
  `connectionMethod`    VARCHAR(191)  NOT NULL DEFAULT 'MANUAL',
  `businessPortfolioId` VARCHAR(191)  NULL,
  `wabaId`              VARCHAR(191)  NOT NULL,
  `phoneNumberId`       VARCHAR(191)  NOT NULL,
  `phoneNumber`         VARCHAR(191)  NULL,
  `displayName`         VARCHAR(191)  NULL,
  `accessTokenEnc`      LONGTEXT      NOT NULL,
  `connectionStatus`    VARCHAR(191)  NOT NULL DEFAULT 'active',
  `webhookStatus`       VARCHAR(191)  NOT NULL DEFAULT 'unknown',
  `tokenMetadata`       LONGTEXT      NULL,
  `lastVerifiedAt`      DATETIME(3)   NULL,
  `lastError`           LONGTEXT      NULL,
  `connectedAt`         DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`           DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ClinicWhatsAppConnection_clinicId_key` (`clinicId`),
  UNIQUE KEY `ClinicWhatsAppConnection_phoneNumberId_key` (`phoneNumberId`),
  KEY `ClinicWhatsAppConnection_phoneNumberId_idx` (`phoneNumberId`),
  KEY `ClinicWhatsAppConnection_clinicId_idx` (`clinicId`),
  CONSTRAINT `ClinicWhatsAppConnection_clinicId_fkey`
    FOREIGN KEY (`clinicId`) REFERENCES `Clinic` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

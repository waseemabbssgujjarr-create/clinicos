-- Structured training, conversation memory, message delivery states, audit log.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS `AITrainingRule` (
  `id`          VARCHAR(191)  NOT NULL,
  `clinicId`    VARCHAR(191)  NOT NULL,
  `question`    TEXT          NOT NULL,
  `answer`      TEXT          NOT NULL,
  `category`    VARCHAR(191)  NOT NULL DEFAULT 'general',
  `isActive`    TINYINT(1)    NOT NULL DEFAULT 1,
  `priority`    INT           NOT NULL DEFAULT 0,
  `matchType`   VARCHAR(32)   NOT NULL DEFAULT 'contains',
  `createdAt`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `AITrainingRule_clinicId_idx` (`clinicId`, `isActive`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AITrainingProfile` (
  `id`             VARCHAR(191)  NOT NULL,
  `clinicId`       VARCHAR(191)  NOT NULL,
  `draftJson`      LONGTEXT      NOT NULL,
  `publishedJson`  LONGTEXT      NULL,
  `draftUpdatedAt` DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `publishedAt`    DATETIME(3)   NULL,
  `publishedBy`    VARCHAR(191)  NULL,
  `createdAt`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `AITrainingProfile_clinicId_key` (`clinicId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ConversationState` (
  `id`               VARCHAR(191)  NOT NULL,
  `clinicId`         VARCHAR(191)  NOT NULL,
  `patientId`        VARCHAR(191)  NOT NULL,
  `turnCount`        INT           NOT NULL DEFAULT 0,
  `greetingSent`     TINYINT(1)    NOT NULL DEFAULT 0,
  `lastIntent`       VARCHAR(191)  NULL,
  `lastAction`       VARCHAR(191)  NULL,
  `pendingQuestion`  TEXT          NULL,
  `pendingSlot`      TEXT          NULL,
  `lastOutboundBody` TEXT          NULL,
  `lastFallbackHash` VARCHAR(191)  NULL,
  `memoryJson`       TEXT          NULL,
  `createdAt`        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ConversationState_clinic_patient` (`clinicId`, `patientId`),
  KEY `ConversationState_clinicId_idx` (`clinicId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AuditLog` (
  `id`         VARCHAR(191)  NOT NULL,
  `clinicId`   VARCHAR(191)  NULL,
  `actorId`    VARCHAR(191)  NULL,
  `actorRole`  VARCHAR(191)  NULL,
  `action`     VARCHAR(191)  NOT NULL,
  `entityType` VARCHAR(191)  NULL,
  `entityId`   VARCHAR(191)  NULL,
  `details`    TEXT          NULL,
  `success`    TINYINT(1)    NOT NULL DEFAULT 1,
  `createdAt`  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `AuditLog_clinic_created_idx` (`clinicId`, `createdAt`),
  KEY `AuditLog_created_idx` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

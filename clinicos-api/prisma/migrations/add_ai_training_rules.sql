-- ═══════════════════════════════════════════════════════════════════
-- Migration: add_ai_training_rules
-- Adds the AITrainingRule table for clinic-specific custom AI replies.
--
-- Run on production (cPanel Terminal):
--   cd ~/doctorsmyagency.com/clinicos-api
--   mysql -u digitals_doctoruser -p digitals_doctordb \
--     < prisma/migrations/add_ai_training_rules.sql
--
-- Or in phpMyAdmin: select digitals_doctordb → SQL tab → Execute.
-- Safe to run multiple times (IF NOT EXISTS).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS `AITrainingRule` (
  `id`          VARCHAR(191)  NOT NULL,
  `clinicId`    VARCHAR(191)  NOT NULL,
  `question`    TEXT          NOT NULL COMMENT 'Patient question pattern (e.g. "What are your fees?")',
  `answer`      TEXT          NOT NULL COMMENT 'Exact answer the AI must give',
  `category`    VARCHAR(191)  NOT NULL DEFAULT 'general'
                              COMMENT 'Grouping: general | pricing | hours | treatments | booking | policies',
  `isActive`    TINYINT(1)    NOT NULL DEFAULT 1,
  `priority`    INT           NOT NULL DEFAULT 0
                              COMMENT 'Higher = checked first. Rules with priority > 0 override AI inference.',
  `matchType`   VARCHAR(32)   NOT NULL DEFAULT 'contains'
                              COMMENT 'contains | exact | starts_with — how to match patient message',
  `createdAt`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `AITrainingRule_clinicId_idx`          (`clinicId`),
  KEY `AITrainingRule_clinicId_active_idx`   (`clinicId`, `isActive`),
  CONSTRAINT `AITrainingRule_clinicId_fkey`
    FOREIGN KEY (`clinicId`) REFERENCES `Clinic` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

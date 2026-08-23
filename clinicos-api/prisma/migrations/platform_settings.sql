-- PlatformSetting — admin-managed integration keys (no code / .env edit required)
-- Run in phpMyAdmin on digitals_clinicdb

CREATE TABLE IF NOT EXISTS `PlatformSetting` (
  `key` varchar(191) NOT NULL,
  `value` text NOT NULL,
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3) ON UPDATE current_timestamp(3),
  `updatedBy` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

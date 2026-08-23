-- Columns already exist? Run ONLY this (fixes #1060 duplicate column error)

UPDATE `Clinic` SET `emailVerified` = 1 WHERE `emailVerified` = 0;
UPDATE `StaffMember` SET `emailVerified` = 1 WHERE `isActive` = 1;

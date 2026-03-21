-- Complete Migration for Franchise Management System
-- Compatible with MariaDB 10.4.28

SET sql_mode = '';

-- Drop tables if exists (optional, remove if you want to keep existing data)
-- DROP TABLE IF EXISTS login_attempts;
-- DROP TABLE IF EXISTS refresh_tokens;
-- DROP TABLE IF EXISTS franchises;
-- DROP TABLE IF EXISTS makes;
-- DROP TABLE IF EXISTS users;

-- Users table
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `UserID` varchar(45) NOT NULL,
  `FirstName` varchar(45) NOT NULL,
  `LastName` varchar(45) DEFAULT NULL,
  `PasswordHash` varchar(255) NOT NULL,
  `UserType` enum('Admin','Editor','Viewer') NOT NULL DEFAULT 'Viewer',
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `CreatedBy` varchar(45) DEFAULT NULL,
  `UpdatedBy` varchar(45) DEFAULT NULL,
  `LastLogin` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UserID` (`UserID`),
  KEY `idx_UserType` (`UserType`),
  KEY `idx_CreatedBy` (`CreatedBy`),
  KEY `idx_UpdatedBy` (`UpdatedBy`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `UserID` varchar(45) NOT NULL,
  `Token` varchar(255) NOT NULL,
  `ExpiresAt` datetime NOT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Token` (`Token`),
  KEY `UserID` (`UserID`),
  KEY `ExpiresAt` (`ExpiresAt`),
  CONSTRAINT `fk_refresh_tokens_user`
    FOREIGN KEY (`UserID`) 
    REFERENCES `users`(`UserID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Login attempts tracking
CREATE TABLE IF NOT EXISTS `login_attempts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `UserID` varchar(100) NOT NULL,
  `IpAddress` varchar(45) NOT NULL,
  `AttemptedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `Success` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `UserID` (`UserID`),
  KEY `IpAddress` (`IpAddress`),
  KEY `AttemptedAt` (`AttemptedAt`),
  KEY `idx_Success` (`Success`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Makes table
CREATE TABLE IF NOT EXISTS `makes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `Name` varchar(100) NOT NULL UNIQUE,
  `Description` text DEFAULT NULL,
  `IsActive` tinyint(1) NOT NULL DEFAULT 1,
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `CreatedBy` varchar(45) DEFAULT NULL,
  `UpdatedBy` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_IsActive` (`IsActive`),
  KEY `idx_CreatedBy` (`CreatedBy`),
  KEY `idx_UpdatedBy` (`UpdatedBy`),
  CONSTRAINT `fk_makes_created_by`
    FOREIGN KEY (`CreatedBy`) 
    REFERENCES `users`(`UserID`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_makes_updated_by`
    FOREIGN KEY (`UpdatedBy`) 
    REFERENCES `users`(`UserID`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Applicants table
CREATE TABLE IF NOT EXISTS `applicants` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `FirstName` varchar(100) NOT NULL,
  `LastName` varchar(100) NOT NULL,
  `MiddleName` varchar(100) DEFAULT NULL,
  `Address` text NOT NULL,
  `ContactNo` varchar(50) DEFAULT NULL,
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `CreatedBy` varchar(45) DEFAULT NULL,
  `UpdatedBy` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_CreatedBy` (`CreatedBy`),
  KEY `idx_UpdatedBy` (`UpdatedBy`),
  CONSTRAINT `fk_applicants_created_by` FOREIGN KEY (`CreatedBy`) REFERENCES `users` (`UserID`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_applicants_updated_by` FOREIGN KEY (`UpdatedBy`) REFERENCES `users` (`UserID`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default makes
INSERT INTO `makes` (`Name`, `IsActive`) VALUES
  ('Yamaha', 1),
  ('Honda', 1),
  ('Kawasaki', 1),
  ('Mitsubishi', 1),
  ('Mitsukoshi', 1),
  ('Bajaj', 1),
  ('TVS', 1),
  ('Motostar', 1),
  ('Motoposh', 1),
  ('Rusi', 1),
  ('Skygo', 1),
  ('Sunriser', 1),
  ('Euro', 1),
  ('Suzuki', 1)
ON DUPLICATE KEY UPDATE `Name` = VALUES(`Name`);

-- Franchises table
CREATE TABLE IF NOT EXISTS `franchises` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `FranchiseNo` varchar(100) NOT NULL UNIQUE,
  `ApplicantID` int(11) NOT NULL,
  `DateIssued` date NOT NULL,
  `Route` varchar(255) NOT NULL,
  `MakeID` int(11) NOT NULL,
  `ChassisNo` varchar(100) NOT NULL,
  `EngineNo` varchar(100) NOT NULL,
  `PlateNo` varchar(50) NOT NULL,
  `ORNo` varchar(100) DEFAULT NULL,
  `Amount` decimal(10,2) DEFAULT NULL,
  `Status` enum('new','renew','drop') NOT NULL DEFAULT 'new',
  `DropReason` text DEFAULT NULL,
  `RenewalCount` int(11) NOT NULL DEFAULT 0,
  `LastRenewalDate` date DEFAULT NULL,
  `ExpiryDate` date DEFAULT NULL,
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `CreatedBy` varchar(45) DEFAULT NULL,
  `UpdatedBy` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_Status` (`Status`),
  KEY `idx_ApplicantID` (`ApplicantID`),
  KEY `idx_MakeID` (`MakeID`),
  KEY `idx_DateIssued` (`DateIssued`),
  KEY `idx_PlateNo` (`PlateNo`),
  KEY `idx_CreatedBy` (`CreatedBy`),
  KEY `idx_UpdatedBy` (`UpdatedBy`),
  CONSTRAINT `fk_franchises_make`
    FOREIGN KEY (`MakeID`) 
    REFERENCES `makes`(`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_franchises_created_by`
    FOREIGN KEY (`CreatedBy`) 
    REFERENCES `users`(`UserID`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_franchises_updated_by`
    FOREIGN KEY (`UpdatedBy`) 
    REFERENCES `users`(`UserID`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Franchise History table (tracks all status changes and renewals)
CREATE TABLE IF NOT EXISTS `franchise_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `FranchiseID` int(11) NOT NULL,
  `ActionType` enum('new','renew','drop','update') NOT NULL,
  `PreviousStatus` enum('new','renew','drop') DEFAULT NULL,
  `NewStatus` enum('new','renew','drop') NOT NULL,
  `DateIssued` date NOT NULL,
  `ExpiryDate` date DEFAULT NULL,
  `Route` varchar(255) DEFAULT NULL,
  `PlateNo` varchar(50) DEFAULT NULL,
  `ORNo` varchar(100) DEFAULT NULL,
  `Amount` decimal(10,2) DEFAULT NULL,
  `DropReason` text DEFAULT NULL,
  `ChangesJson` text DEFAULT NULL COMMENT 'JSON of changed fields',
  `Remarks` text DEFAULT NULL,
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `CreatedBy` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_FranchiseID` (`FranchiseID`),
  KEY `idx_ActionType` (`ActionType`),
  KEY `idx_DateIssued` (`DateIssued`),
  KEY `idx_CreatedBy` (`CreatedBy`),
  CONSTRAINT `fk_franchise_history_franchise`
    FOREIGN KEY (`FranchiseID`) 
    REFERENCES `franchises`(`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_franchise_history_created_by`
    FOREIGN KEY (`CreatedBy`) 
    REFERENCES `users`(`UserID`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
    TokenID INT AUTO_INCREMENT PRIMARY KEY,
    UserID VARCHAR(255) NOT NULL,
    Token VARCHAR(64) NOT NULL, -- SHA-256 hash (64 chars)
    ExpiresAt DATETIME NOT NULL,
    CreatedAt DATETIME NOT NULL,
    LastUsedAt DATETIME NULL, -- Track when token was last used
    UserAgent VARCHAR(255) NULL, -- Track device/browser
    IpAddress VARCHAR(45) NULL, -- Track IP (supports IPv6)
    IsRevoked BOOLEAN DEFAULT FALSE, -- Manual revocation flag
    
    INDEX idx_user_id (UserID),
    INDEX idx_token (Token),
    INDEX idx_expires_at (ExpiresAt),
    
    FOREIGN KEY (UserID) REFERENCES users(UserID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clean up expired tokens periodically
-- Run this as a scheduled job (cron/task scheduler)
-- DELETE FROM refresh_tokens 
-- WHERE ExpiresAt < NOW() 
--    OR IsRevoked = TRUE;

-- Add table comments
ALTER TABLE `users` COMMENT = 'Stores user accounts and authentication information';
ALTER TABLE `refresh_tokens` COMMENT = 'Stores refresh tokens for JWT authentication';
ALTER TABLE `login_attempts` COMMENT = 'Tracks login attempts for security monitoring';
ALTER TABLE `makes` COMMENT = 'Stores vehicle make/brand information';
ALTER TABLE `applicants` COMMENT = 'Stores information about franchise applicants/owners';
ALTER TABLE `franchises` COMMENT = 'Stores franchise information including vehicle details and status';

-- Sample admin user (password: admin123 - CHANGE THIS IN PRODUCTION!)
-- Password hash generated with: Auth::hashPassword('admin123')
-- Run generate_admin_hash.php first to get the actual hash, then replace below
INSERT INTO `users` (`UserID`, `FirstName`, `LastName`, `PasswordHash`, `UserType`) VALUES
  ('admin', 'System', 'Administrator', '$argon2id$v=19$m=65536,t=4,p=3$Z3gvNnR2eENTeG9pS2VnQw$WZUXgx12pZmNRotxIc5LvjIV/dtZUI46/nmbQVY4zTk', 'Admin')
ON DUPLICATE KEY UPDATE `UserID` = VALUES(`UserID`);

-- IMPORTANT: Before running this migration:
-- 1. Run: php generate_admin_hash.php
-- 2. Copy the generated hash
-- 3. Replace 'REPLACE_WITH_GENERATED_HASH' above with the actual hash
-- 4. Then run this migration

-- Sample admin user (password: admin123 - CHANGE THIS IN PRODUCTION!)
-- Password hash generated with: Auth::hashPassword('admin123')
-- Run generate_admin_hash.php first to get the actual hash, then replace below
-- INSERT INTO `users` (`UserID`, `FirstName`, `LastName`, `PasswordHash`, `UserType`) VALUES
--   ('0001', 'System', 'Administrator', '$argon2id$v=19$m=65536,t=4,p=3$Z3gvNnR2eENTeG9pS2VnQw$WZUXgx12pZmNRotxIc5LvjIV/dtZUI46/nmbQVY4zTk', 'Admin')
-- ON DUPLICATE KEY UPDATE `UserID` = VALUES(`UserID`);
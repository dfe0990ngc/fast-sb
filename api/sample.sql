-- Complete Migration for Franchise Management System with Sample Data
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
  KEY `idx_UpdatedBy` (`UpdatedBy`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default makes
INSERT INTO `makes` (`Name`, `IsActive`) VALUES
  ('Yamaha', 1),
  ('Honda', 1),
  ('Kawasaki', 1),
  ('Mitsubishi', 1),
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
  `Name` varchar(255) NOT NULL,
  `Address` text NOT NULL,
  `ContactNo` varchar(50) NOT NULL,
  `FranchiseNo` varchar(100) NOT NULL UNIQUE,
  `DateIssued` date NOT NULL,
  `Route` varchar(255) NOT NULL,
  `MakeID` int(11) NOT NULL,
  `ChassisNo` varchar(100) NOT NULL,
  `EngineNo` varchar(100) NOT NULL,
  `PlateNo` varchar(50) NOT NULL,
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
  KEY `idx_MakeID` (`MakeID`),
  KEY `idx_DateIssued` (`DateIssued`),
  KEY `idx_PlateNo` (`PlateNo`),
  KEY `idx_CreatedBy` (`CreatedBy`),
  KEY `idx_UpdatedBy` (`UpdatedBy`),
  CONSTRAINT `fk_franchises_make`
    FOREIGN KEY (`MakeID`) 
    REFERENCES `makes`(`id`)
    ON DELETE RESTRICT
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
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sample admin user (password: admin123)
INSERT INTO `users` (`UserID`, `FirstName`, `LastName`, `PasswordHash`, `UserType`) VALUES
  ('admin', 'System', 'Administrator', '$argon2id$v=19$m=65536,t=4,p=3$Z3gvNnR2eENTeG9pS2VnQw$WZUXgx12pZmNRotxIc5LvjIV/dtZUI46/nmbQVY4zTk', 'Admin'),
  ('editor01', 'Maria', 'Santos', '$argon2id$v=19$m=65536,t=4,p=3$Z3gvNnR2eENTeG9pS2VnQw$WZUXgx12pZmNRotxIc5LvjIV/dtZUI46/nmbQVY4zTk', 'Editor'),
  ('viewer01', 'Juan', 'Dela Cruz', '$argon2id$v=19$m=65536,t=4,p=3$Z3gvNnR2eENTeG9pS2VnQw$WZUXgx12pZmNRotxIc5LvjIV/dtZUI46/nmbQVY4zTk', 'Viewer')
ON DUPLICATE KEY UPDATE `UserID` = VALUES(`UserID`);

-- Sample data for 200 franchises
INSERT INTO `franchises` (`Name`, `Address`, `ContactNo`, `FranchiseNo`, `DateIssued`, `Route`, `MakeID`, `ChassisNo`, `EngineNo`, `PlateNo`, `Status`, `RenewalCount`, `LastRenewalDate`, `ExpiryDate`, `CreatedBy`) VALUES
('Juan Dela Cruz', 'Brgy. Bagumbayan, Santa Cruz, Laguna', '09171234567', 'FR-2024-001', '2024-01-15', 'Santa Cruz - Pagsanjan', 1, 'CH123456789', 'EN987654321', 'ABC-1234', 'renew', 2, '2024-01-15', '2025-01-15', 'admin'),
('Maria Santos', 'Brgy. Poblacion, Santa Cruz, Laguna', '09281234567', 'FR-2024-002', '2024-02-20', 'Santa Cruz - Lumban', 2, 'CH234567890', 'EN876543210', 'XYZ-5678', 'new', 0, NULL, '2025-02-20', 'admin'),
('Pedro Gonzales', 'Brgy. Duhat, Santa Cruz, Laguna', '09391234567', 'FR-2024-003', '2024-03-10', 'Santa Cruz - Magdalena', 3, 'CH345678901', 'EN765432109', 'DEF-9012', 'renew', 1, '2024-03-10', '2025-03-10', 'admin'),
('Ana Reyes', 'Brgy. Jasaan, Santa Cruz, Laguna', '09451234567', 'FR-2024-004', '2024-04-05', 'Santa Cruz - Majayjay', 4, 'CH456789012', 'EN654321098', 'GHI-3456', 'new', 0, NULL, '2025-04-05', 'admin'),
('Carlos Mendoza', 'Brgy. Labuin, Santa Cruz, Laguna', '09561234567', 'FR-2024-005', '2024-05-12', 'Santa Cruz - Pakil', 5, 'CH567890123', 'EN543210987', 'JKL-7890', 'renew', 3, '2024-05-12', '2025-05-12', 'admin'),
('Rosa Garcia', 'Brgy. Malinao, Santa Cruz, Laguna', '09671234567', 'FR-2024-006', '2024-06-18', 'Santa Cruz - Pangil', 6, 'CH678901234', 'EN432109876', 'MNO-1234', 'new', 0, NULL, '2025-06-18', 'admin'),
('Miguel Torres', 'Brgy. Palasan, Santa Cruz, Laguna', '09781234567', 'FR-2024-007', '2024-07-25', 'Santa Cruz - Siniloan', 7, 'CH789012345', 'EN321098765', 'PQR-5678', 'renew', 2, '2024-07-25', '2025-07-25', 'admin'),
('Carmen Flores', 'Brgy. Palusapis, Santa Cruz, Laguna', '09891234567', 'FR-2024-008', '2024-08-30', 'Santa Cruz - Famy', 8, 'CH890123456', 'EN210987654', 'STU-9012', 'new', 0, NULL, '2025-08-30', 'admin'),
('Roberto Silva', 'Brgy. San Juan, Santa Cruz, Laguna', '09901234567', 'FR-2024-009', '2024-09-14', 'Santa Cruz - Kalayaan', 9, 'CH901234567', 'EN109876543', 'VWX-3456', 'renew', 1, '2024-09-14', '2025-09-14', 'admin'),
('Elena Morales', 'Brgy. Santo Angel Norte, Santa Cruz, Laguna', '09012345678', 'FR-2024-010', '2024-10-22', 'Santa Cruz - Liliw', 10, 'CH012345678', 'EN098765432', 'YZA-7890', 'new', 0, NULL, '2025-10-22', 'admin'),
('Francisco Castro', 'Brgy. Santo Angel Sur, Santa Cruz, Laguna', '09123456789', 'FR-2024-011', '2024-11-08', 'Santa Cruz - Rizal', 11, 'CH123456780', 'EN987654320', 'BCD-1234', 'renew', 4, '2024-11-08', '2025-11-08', 'admin'),
('Luz Ramos', 'Brgy. Santisimo, Santa Cruz, Laguna', '09234567890', 'FR-2024-012', '2024-12-15', 'Santa Cruz - Nagcarlan', 12, 'CH234567801', 'EN876543201', 'EFG-5678', 'new', 0, NULL, '2025-12-15', 'admin'),
('Antonio Herrera', 'Brgy. Bagumbayan, Santa Cruz, Laguna', '09345678901', 'FR-2023-013', '2023-01-20', 'Santa Cruz - Bay', 1, 'CH345678912', 'EN765432102', 'HIJ-9012', 'renew', 5, '2023-01-20', '2024-01-20', 'admin'),
('Gloria Jimenez', 'Brgy. Poblacion, Santa Cruz, Laguna', '09456789012', 'FR-2023-014', '2023-02-28', 'Santa Cruz - Los Baños', 2, 'CH456789023', 'EN654321003', 'KLM-3456', 'drop', 2, '2023-02-28', '2024-02-28', 'admin'),
('Ricardo Vargas', 'Brgy. Duhat, Santa Cruz, Laguna', '09567890123', 'FR-2023-015', '2023-03-15', 'Santa Cruz - Calauan', 3, 'CH567890134', 'EN543210904', 'NOP-7890', 'renew', 3, '2023-03-15', '2024-03-15', 'admin'),
('Esperanza Cruz', 'Brgy. Jasaan, Santa Cruz, Laguna', '09678901234', 'FR-2023-016', '2023-04-10', 'Santa Cruz - Alaminos', 4, 'CH678901245', 'EN432109805', 'QRS-1234', 'new', 0, NULL, '2024-04-10', 'admin'),
('Alfredo Diaz', 'Brgy. Labuin, Santa Cruz, Laguna', '09789012345', 'FR-2023-017', '2023-05-25', 'Santa Cruz - San Pablo', 5, 'CH789012356', 'EN321098706', 'TUV-5678', 'renew', 1, '2023-05-25', '2024-05-25', 'admin'),
('Remedios Aguilar', 'Brgy. Malinao, Santa Cruz, Laguna', '09890123456', 'FR-2023-018', '2023-06-12', 'Santa Cruz - Tiaong', 6, 'CH890123467', 'EN210987607', 'WXY-9012', 'new', 0, NULL, '2024-06-12', 'admin'),
('Ernesto Navarro', 'Brgy. Palasan, Santa Cruz, Laguna', '09901234567', 'FR-2023-019', '2023-07-18', 'Santa Cruz - Candelaria', 7, 'CH901234578', 'EN109876508', 'ZAB-3456', 'renew', 2, '2023-07-18', '2024-07-18', 'admin'),
('Corazon Perez', 'Brgy. Palusapis, Santa Cruz, Laguna', '09012345679', 'FR-2023-020', '2023-08-05', 'Santa Cruz - Sariaya', 8, 'CH012345689', 'EN098765409', 'CDE-7890', 'new', 0, NULL, '2024-08-05', 'admin'),
('Domingo Lopez', 'Brgy. San Juan, Santa Cruz, Laguna', '09123456780', 'FR-2023-021', '2023-09-22', 'Santa Cruz - Tayabas', 9, 'CH123456790', 'EN987654310', 'FGH-1234', 'renew', 4, '2023-09-22', '2024-09-22', 'admin'),
('Pilar Gutierrez', 'Brgy. Santo Angel Norte, Santa Cruz, Laguna', '09234567801', 'FR-2023-022', '2023-10-30', 'Santa Cruz - Lucban', 10, 'CH234567801', 'EN876543211', 'IJK-5678', 'new', 0, NULL, '2024-10-30', 'admin'),
('Teodoro Ortega', 'Brgy. Santo Angel Sur, Santa Cruz, Laguna', '09345678912', 'FR-2023-023', '2023-11-14', 'Santa Cruz - Sampaloc', 11, 'CH345678912', 'EN765432112', 'LMN-9012', 'renew', 3, '2023-11-14', '2024-11-14', 'admin'),
('Soledad Ruiz', 'Brgy. Santisimo, Santa Cruz, Laguna', '09456789023', 'FR-2023-024', '2023-12-08', 'Santa Cruz - Mauban', 12, 'CH456789023', 'EN654321013', 'OPQ-3456', 'drop', 1, '2023-12-08', '2024-12-08', 'admin'),
('Arturo Medina', 'Brgy. Bagumbayan, Santa Cruz, Laguna', '09567890134', 'FR-2022-025', '2022-01-12', 'Santa Cruz - Real', 1, 'CH567890134', 'EN543210914', 'RST-7890', 'renew', 6, '2022-01-12', '2023-01-12', 'admin'),
('Natividad Romero', 'Brgy. Poblacion, Santa Cruz, Laguna', '09678901245', 'FR-2022-026', '2022-02-18', 'Santa Cruz - General Nakar', 2, 'CH678901245', 'EN432109815', 'UVW-1234', 'new', 0, NULL, '2023-02-18', 'admin'),
('Leopoldo Sandoval', 'Brgy. Duhat, Santa Cruz, Laguna', '09789012356', 'FR-2022-027', '2022-03-25', 'Santa Cruz - Infanta', 3, 'CH789012356', 'EN321098716', 'XYZ-5678', 'renew', 2, '2022-03-25', '2023-03-25', 'admin'),
('Concepcion Vega', 'Brgy. Jasaan, Santa Cruz, Laguna', '09890123467', 'FR-2022-028', '2022-04-30', 'Santa Cruz - Polillo', 4, 'CH890123467', 'EN210987617', 'ABC-9012', 'new', 0, NULL, '2023-04-30', 'admin'),
('Eugenio Moreno', 'Brgy. Labuin, Santa Cruz, Laguna', '09901234578', 'FR-2022-029', '2022-05-15', 'Santa Cruz - Burdeos', 5, 'CH901234578', 'EN109876518', 'DEF-3456', 'renew', 5, '2022-05-15', '2023-05-15', 'admin'),
('Pacita Blanco', 'Brgy. Malinao, Santa Cruz, Laguna', '09012345689', 'FR-2022-030', '2022-06-20', 'Santa Cruz - Panukulan', 6, 'CH012345689', 'EN098765419', 'GHI-7890', 'drop', 3, '2022-06-20', '2023-06-20', 'admin'),
('Florencio Rivera', 'Brgy. Palasan, Santa Cruz, Laguna', '09123456790', 'FR-2022-031', '2022-07-08', 'Santa Cruz - Jomalig', 7, 'CH123456790', 'EN987654320', 'JKL-1234', 'renew', 1, '2022-07-08', '2023-07-08', 'admin'),
('Milagros Guerrero', 'Brgy. Palusapis, Santa Cruz, Laguna', '09234567801', 'FR-2022-032', '2022-08-12', 'Santa Cruz - Patnanungan', 8, 'CH234567801', 'EN876543221', 'MNO-5678', 'new', 0, NULL, '2023-08-12', 'admin'),
('Rodolfo Pascual', 'Brgy. San Juan, Santa Cruz, Laguna', '09345678912', 'FR-2022-033', '2022-09-28', 'Santa Cruz - Paete', 9, 'CH345678912', 'EN765432122', 'PQR-9012', 'renew', 4, '2022-09-28', '2023-09-28', 'admin'),
('Purificacion Aquino', 'Brgy. Santo Angel Norte, Santa Cruz, Laguna', '09456789023', 'FR-2022-034', '2022-10-05', 'Santa Cruz - Kalayaan', 10, 'CH456789023', 'EN654321023', 'STU-3456', 'new', 0, NULL, '2023-10-05', 'admin'),
('Marcelo Bautista', 'Brgy. Santo Angel Sur, Santa Cruz, Laguna', '09567890134', 'FR-2022-035', '2022-11-18', 'Santa Cruz - Lumban', 11, 'CH567890134', 'EN543210924', 'VWX-7890', 'renew', 2, '2022-11-18', '2023-11-18', 'admin'),
('Consolacion Villanueva', 'Brgy. Santisimo, Santa Cruz, Laguna', '09678901245', 'FR-2022-036', '2022-12-22', 'Santa Cruz - Pagsanjan', 12, 'CH678901245', 'EN432109825', 'YZA-1234', 'drop', 1, '2022-12-22', '2023-12-22', 'admin'),
('Benito Fernandez', 'Brgy. Bagumbayan, Santa Cruz, Laguna', '09789012356', 'FR-2021-037', '2021-01-10', 'Santa Cruz - Magdalena', 1, 'CH789012356', 'EN321098726', 'BCD-5678', 'renew', 7, '2021-01-10', '2022-01-10', 'admin'),
('Visitacion Castillo', 'Brgy. Poblacion, Santa Cruz, Laguna', '09890123467', 'FR-2021-038', '2021-02-14', 'Santa Cruz - Majayjay', 2, 'CH890123467', 'EN210987627', 'EFG-9012', 'new', 0, NULL, '2022-02-14', 'admin'),
('Rogelio Delgado', 'Brgy. Duhat, Santa Cruz, Laguna', '09901234578', 'FR-2021-039', '2021-03-20', 'Santa Cruz - Pakil', 3, 'CH901234578', 'EN109876528', 'HIJ-3456', 'renew', 3, '2021-03-20', '2022-03-20', 'admin'),
('Felicidad Espinoza', 'Brgy. Jasaan, Santa Cruz, Laguna', '09012345689', 'FR-2021-040', '2021-04-25', 'Santa Cruz - Pangil', 4, 'CH012345689', 'EN098765429', 'KLM-7890', 'new', 0, NULL, '2022-04-25', 'admin'),
('Gregorio Cabrera', 'Brgy. Labuin, Santa Cruz, Laguna', '09123456790', 'FR-2021-041', '2021-05-30', 'Santa Cruz - Siniloan', 5, 'CH123456790', 'EN987654330', 'NOP-1234', 'renew', 6, '2021-05-30', '2022-05-30', 'admin'),
('Presentacion Valdez', 'Brgy. Malinao, Santa Cruz, Laguna', '09234567801', 'FR-2021-042', '2021-06-15', 'Santa Cruz - Famy', 6, 'CH234567801', 'EN876543231', 'QRS-5678', 'drop', 2, '2021-06-15', '2022-06-15', 'admin'),
('Aurelio Campos', 'Brgy. Palasan, Santa Cruz, Laguna', '09345678912', 'FR-2021-043', '2021-07-22', 'Santa Cruz - Kalayaan', 7, 'CH345678912', 'EN765432132', 'TUV-9012', 'renew', 1, '2021-07-22', '2022-07-22', 'admin'),
('Salvacion Lim', 'Brgy. Palusapis, Santa Cruz, Laguna', '09456789023', 'FR-2021-044', '2021-08-28', 'Santa Cruz - Liliw', 8, 'CH456789023', 'EN654321033', 'WXY-3456', 'new', 0, NULL, '2022-08-28', 'admin'),
('Amado Tan', 'Brgy. San Juan, Santa Cruz, Laguna', '09567890134', 'FR-2021-045', '2021-09-12', 'Santa Cruz - Rizal', 9, 'CH567890134', 'EN543210934', 'ZAB-7890', 'renew', 5, '2021-09-12', '2022-09-12', 'admin'),
('Encarnacion Go', 'Brgy. Santo Angel Norte, Santa Cruz, Laguna', '09678901245', 'FR-2021-046', '2021-10-18', 'Santa Cruz - Nagcarlan', 10, 'CH678901245', 'EN432109835', 'CDE-1234', 'new', 0, NULL, '2022-10-18', 'admin'),
('Hilario Ong', 'Brgy. Santo Angel Sur, Santa Cruz, Laguna', '09789012356', 'FR-2021-047', '2021-11-25', 'Santa Cruz - Bay', 11, 'CH789012356', 'EN321098736', 'FGH-5678', 'renew', 4, '2021-11-25', '2022-11-25', 'admin'),
('Primitiva Sy', 'Brgy. Santisimo, Santa Cruz, Laguna', '09890123467', 'FR-2021-048', '2021-12-30', 'Santa Cruz - Los Baños', 12, 'CH890123467', 'EN210987637', 'IJK-9012', 'drop', 3, '2021-12-30', '2022-12-30', 'admin'),
('Venancio Lee', 'Brgy. Bagumbayan, Santa Cruz, Laguna', '09901234578', 'FR-2020-049', '2020-01-15', 'Santa Cruz - Calauan', 1, 'CH901234578', 'EN109876538', 'LMN-3456', 'renew', 8, '2020-01-15', '2021-01-15', 'admin'),
('Apolonia Chua', 'Brgy. Poblacion, Santa Cruz, Laguna', '09012345689', 'FR-2020-050', '2020-02-20', 'Santa Cruz - Alaminos', 2, 'CH012345689', 'EN098765439', 'OPQ-7890', 'new', 0, NULL, '2021-02-20', 'admin'),
('Mariano Yu', 'Brgy. Duhat, Santa Cruz, Laguna', '09123456790', 'FR-2024-051', '2024-01-08', 'Santa Cruz - San Pablo', 3, 'CH123456791', 'EN987654331', 'RST-1234', 'new', 0, NULL, '2025-01-08', 'admin'),
('Josefina Wong', 'Brgy. Jasaan, Santa Cruz, Laguna', '09234567801', 'FR-2024-052', '2024-02-12', 'Santa Cruz - Tiaong', 4, 'CH234567802', 'EN876543232', 'UVW-5678', 'renew', 1, '2024-02-12', '2025-02-12', 'admin'),
('Esteban Lao', 'Brgy. Labuin, Santa Cruz, Laguna', '09345678912', 'FR-2024-053', '2024-03-18', 'Santa Cruz - Candelaria', 5, 'CH345678913', 'EN765432133', 'XYZ-9012', 'new', 0, NULL, '2025-03-18', 'admin'),
('Catalina Ang', 'Brgy. Malinao, Santa Cruz, Laguna', '09456789023', 'FR-2024-054', '2024-04-22', 'Santa Cruz - Sariaya', 6, 'CH456789024', 'EN654321034', 'ABC-3456', 'renew', 2, '2024-04-22', '2025-04-22', 'admin'),
('Nemesio Tiu', 'Brgy. Palasan, Santa Cruz, Laguna', '09567890134', 'FR-2024-055', '2024-05-28', 'Santa Cruz - Tayabas', 7, 'CH567890135', 'EN543210935', 'DEF-7890', 'new', 0, NULL, '2025-05-28', 'admin'),
('Genoveva Co', 'Brgy. Palusapis, Santa Cruz, Laguna', '09678901245', 'FR-2024-056', '2024-06-05', 'Santa Cruz - Lucban', 8, 'CH678901246', 'EN432109836', 'GHI-1234', 'renew', 3, '2024-06-05', '2025-06-05', 'admin'),
('Demetrio Yap', 'Brgy. San Juan, Santa Cruz, Laguna', '09789012356', 'FR-2024-057', '2024-07-10', 'Santa Cruz - Sampaloc', 9, 'CH789012357', 'EN321098737', 'JKL-5678', 'new', 0, NULL, '2025-07-10', 'admin'),
('Amparo Lim', 'Brgy. Santo Angel Norte, Santa Cruz, Laguna', '09890123467', 'FR-2024-058', '2024-08-15', 'Santa Cruz - Mauban', 10, 'CH890123468', 'EN210987638', 'MNO-9012', 'renew', 1, '2024-08-15', '2025-08-15', 'admin'),
('Isidro Tan', 'Brgy. Santo Angel Sur, Santa Cruz, Laguna', '09901234578', 'FR-2024-059', '2024-09-20', 'Santa Cruz - Real', 11, 'CH901234579', 'EN109876539', 'PQR-3456', 'new', 0, NULL, '2025-09-20', 'admin'),
('Perfecta Go', 'Brgy. Santisimo, Santa Cruz, Laguna', '09012345689', 'FR-2024-060', '2024-10-25', 'Santa Cruz - General Nakar', 12, 'CH012345690', 'EN098765440', 'STU-7890', 'renew', 4, '2024-10-25', '2025-10-25', 'admin'),
('Cipriano Ong', 'Brgy. Bagumbayan, Santa Cruz, Laguna', '09123456790', 'FR-2024-061', '2024-11-30', 'Santa Cruz - Infanta', 1, 'CH123456792', 'EN987654332', 'VWX-1234', 'new', 0, NULL, '2025-11-30', 'admin'),
('Dionisia Sy', 'Brgy. Poblacion, Santa Cruz, Laguna', '09234567801', 'FR-2024-062', '2024-12-05', 'Santa Cruz - Polillo', 2, 'CH234567803', 'EN876543233', 'YZA-5678', 'renew', 2, '2024-12-05', '2025-12-05', 'admin'),
('Anastacio Lee', 'Brgy. Duhat, Santa Cruz, Laguna', '09345678912', 'FR-2023-063', '2023-01-12', 'Santa Cruz - Burdeos', 3, 'CH345678914', 'EN765432134', 'BCD-9012', 'renew', 5, '2023-01-12', '2024-01-12', 'admin'),
('Basilisa Chua', 'Brgy. Jasaan, Santa Cruz, Laguna', '09456789023', 'FR-2023-064', '2023-02-18', 'Santa Cruz - Panukulan', 4, 'CH456789025', 'EN654321035', 'EFG-3456', 'drop', 1, '2023-02-18', '2024-02-18', 'admin'),
('Crisanto Yu', 'Brgy. Labuin, Santa Cruz, Laguna', '09567890134', 'FR-2023-065', '2023-03-25', 'Santa Cruz - Jomalig', 5, 'CH567890136', 'EN543210936', 'HIJ-7890', 'renew', 3, '2023-03-25', '2024-03-25', 'admin'),
('Dolores Wong', 'Brgy. Malinao, Santa Cruz, Laguna', '09678901245', 'FR-2023-066', '2023-04-30', 'Santa Cruz - Patnanungan', 6, 'CH678901247', 'EN432109837', 'KLM-1234', 'new', 0, NULL, '2024-04-30', 'admin'),
('Epifanio Lao', 'Brgy. Palasan, Santa Cruz, Laguna', '09789012356', 'FR-2023-067', '2023-05-08', 'Santa Cruz - Paete', 7, 'CH789012358', 'EN321098738', 'NOP-5678', 'renew', 2, '2023-05-08', '2024-05-08', 'admin'),
('Felipa Ang', 'Brgy. Palusapis, Santa Cruz, Laguna', '09890123467', 'FR-2023-068', '2023-06-15', 'Santa Cruz - Kalayaan', 8, 'CH890123469', 'EN210987639', 'QRS-9012', 'new', 0, NULL, '2024-06-15', 'admin'),
('Gerardo Tiu', 'Brgy. San Juan, Santa Cruz, Laguna', '09901234578', 'FR-2023-069', '2023-07-22', 'Santa Cruz - Lumban', 9, 'CH901234580', 'EN109876540', 'TUV-3456', 'renew', 4, '2023-07-22', '2024-07-22', 'admin'),
('Herminia Co', 'Brgy. Santo Angel Norte, Santa Cruz, Laguna', '09012345689', 'FR-2023-070', '2023-08-28', 'Santa Cruz - Pagsanjan', 10, 'CH012345691', 'EN098765441', 'WXY-7890', 'drop', 2, '2023-08-28', '2024-08-28', 'admin'),
('Ignacio Yap', 'Brgy. Santo Angel Sur, Santa Cruz, Laguna', '09123456790', 'FR-2023-071', '2023-09-05', 'Santa Cruz - Magdalena', 11, 'CH123456793', 'EN987654333', 'ZAB-1234', 'renew', 1, '2023-09-05', '2024-09-05', 'admin'),
('Jacinta Lim', 'Brgy. Santisimo, Santa Cruz, Laguna', '09234567801', 'FR-2023-072', '2023-10-12', 'Santa Cruz - Majayjay', 12, 'CH234567804', 'EN876543234', 'CDE-5678', 'new', 0, NULL, '2024-10-12', 'admin'),
('Kiko Tan', 'Brgy. Bagumbayan, Santa Cruz, Laguna', '09345678912', 'FR-2023-073', '2023-11-18', 'Santa Cruz - Pakil', 1, 'CH345678915', 'EN765432135', 'FGH-9012', 'renew', 6, '2023-11-18', '2024-11-18', 'admin'),
('Leonarda Go', 'Brgy. Poblacion, Santa Cruz, Laguna', '09456789023', 'FR-2023-074', '2023-12-25', 'Santa Cruz - Pangil', 2, 'CH456789026', 'EN654321036', 'IJK-3456', 'new', 0, NULL, '2024-12-25', 'admin'),
('Macario Ong', 'Brgy. Duhat, Santa Cruz, Laguna', '09567890134', 'FR-2022-075', '2022-01-05', 'Santa Cruz - Siniloan', 3, 'CH567890137', 'EN543210937', 'LMN-7890', 'renew', 7, '2022-01-05', '2023-01-05', 'admin'),
('Norberta Sy', 'Brgy. Jasaan, Santa Cruz, Laguna', '09678901245', 'FR-2022-076', '2022-02-10', 'Santa Cruz - Famy', 4, 'CH678901248', 'EN432109838', 'OPQ-1234', 'drop', 3, '2022-02-10', '2023-02-10', 'admin'),
('Octavio Lee', 'Brgy. Labuin, Santa Cruz, Laguna', '09789012356', 'FR-2022-077', '2022-03-18', 'Santa Cruz - Kalayaan', 5, 'CH789012359', 'EN321098739', 'RST-5678', 'renew', 2, '2022-03-18', '2023-03-18', 'admin'),
('Priscila Chua', 'Brgy. Malinao, Santa Cruz, Laguna', '09890123467', 'FR-2022-078', '2022-04-22', 'Santa Cruz - Liliw', 6, 'CH890123470', 'EN210987640', 'UVW-9012', 'new', 0, NULL, '2023-04-22', 'admin'),
('Quirino Yu', 'Brgy. Palasan, Santa Cruz, Laguna', '09901234578', 'FR-2022-079', '2022-05-28', 'Santa Cruz - Rizal', 7, 'CH901234581', 'EN109876541', 'XYZ-3456', 'renew', 5, '2022-05-28', '2023-05-28', 'admin'),
('Rosalinda Wong', 'Brgy. Palusapis, Santa Cruz, Laguna', '09012345689', 'FR-2022-080', '2022-06-30', 'Santa Cruz - Nagcarlan', 8, 'CH012345692', 'EN098765442', 'ABC-7890', 'new', 0, NULL, '2023-06-30', 'admin'),
('Saturnino Lao', 'Brgy. San Juan, Santa Cruz, Laguna', '09123456790', 'FR-2022-081', '2022-07-15', 'Santa Cruz - Bay', 9, 'CH123456794', 'EN987654334', 'DEF-1234', 'renew', 1, '2022-07-15', '2023-07-15', 'admin'),
('Teresita Ang', 'Brgy. Santo Angel Norte, Santa Cruz, Laguna', '09234567801', 'FR-2022-082', '2022-08-20', 'Santa Cruz - Los Baños', 10, 'CH234567805', 'EN876543235', 'GHI-5678', 'drop', 4, '2022-08-20', '2023-08-20', 'admin'),
('Urbano Tiu', 'Brgy. Santo Angel Sur, Santa Cruz, Laguna', '09345678912', 'FR-2022-083', '2022-09-25', 'Santa Cruz - Calauan', 11, 'CH345678916', 'EN765432136', 'JKL-9012', 'renew', 3, '2022-09-25', '2023-09-25', 'admin'),
('Valentina Co', 'Brgy. Santisimo, Santa Cruz, Laguna', '09456789023', 'FR-2022-084', '2022-10-30', 'Santa Cruz - Alaminos', 12, 'CH456789027', 'EN654321037', 'MNO-3456', 'new', 0, NULL, '2023-10-30', 'admin'),
('Wenceslao Yap', 'Brgy. Bagumbayan, Santa Cruz, Laguna', '09567890134', 'FR-2022-085', '2022-11-08', 'Santa Cruz - San Pablo', 1, 'CH567890138', 'EN543210938', 'PQR-7890', 'renew', 6, '2022-11-08', '2023-11-08', 'admin'),
('Ximena Lim', 'Brgy. Poblacion, Santa Cruz, Laguna', '09678901245', 'FR-2022-086', '2022-12-12', 'Santa Cruz - Tiaong', 2, 'CH678901249', 'EN432109839', 'STU-1234', 'new', 0, NULL, '2023-12-12', 'admin'),
('Yolanda Tan', 'Brgy. Duhat, Santa Cruz, Laguna', '09789012356', 'FR-2021-087', '2021-01-18', 'Santa Cruz - Candelaria', 3, 'CH789012360', 'EN321098740', 'VWX-5678', 'renew', 8, '2021-01-18', '2022-01-18', 'admin'),
('Zenaida Go', 'Brgy. Jasaan, Santa Cruz, Laguna', '09890123467', 'FR-2021-088', '2021-02-22', 'Santa Cruz - Sariaya', 4, 'CH890123471', 'EN210987641', 'YZA-9012', 'drop', 2, '2021-02-22', '2022-02-22', 'admin'),
('Alberto Ong', 'Brgy. Labuin, Santa Cruz, Laguna', '09901234578', 'FR-2021-089', '2021-03-28', 'Santa Cruz - Tayabas', 5, 'CH901234582', 'EN109876542', 'BCD-3456', 'renew', 1, '2021-03-28', '2022-03-28', 'admin'),
('Beatriz Sy', 'Brgy. Malinao, Santa Cruz, Laguna', '09012345689', 'FR-2021-090', '2021-04-05', 'Santa Cruz - Lucban', 6, 'CH012345693', 'EN098765443', 'EFG-7890', 'new', 0, NULL, '2022-04-05', 'admin'),
('Celestino Lee', 'Brgy. Palasan, Santa Cruz, Laguna', '09123456790', 'FR-2021-091', '2021-05-10', 'Santa Cruz - Sampaloc', 7, 'CH123456795', 'EN987654335', 'HIJ-1234', 'renew', 5, '2021-05-10', '2022-05-10', 'admin'),
('Delia Chua', 'Brgy. Palusapis, Santa Cruz, Laguna', '09234567801', 'FR-2021-092', '2021-06-18', 'Santa Cruz - Mauban', 8, 'CH234567806', 'EN876543236', 'KLM-5678', 'new', 0, NULL, '2022-06-18', 'admin'),
('Ernesto Yu', 'Brgy. San Juan, Santa Cruz, Laguna', '09345678912', 'FR-2021-093', '2021-07-25', 'Santa Cruz - Real', 9, 'CH345678917', 'EN765432137', 'NOP-9012', 'renew', 4, '2021-07-25', '2022-07-25', 'admin'),
('Florencia Wong', 'Brgy. Santo Angel Norte, Santa Cruz, Laguna', '09456789023', 'FR-2021-094', '2021-08-30', 'Santa Cruz - General Nakar', 10, 'CH456789028', 'EN654321038', 'QRS-3456', 'drop', 3, '2021-08-30', '2022-08-30', 'admin'),
('Guillermo Lao', 'Brgy. Santo Angel Sur, Santa Cruz, Laguna', '09567890134', 'FR-2021-095', '2021-09-08', 'Santa Cruz - Infanta', 11, 'CH567890139', 'EN543210939', 'TUV-7890', 'renew', 2, '2021-09-08', '2022-09-08', 'admin'),
('Honorata Ang', 'Brgy. Santisimo, Santa Cruz, Laguna', '09678901245', 'FR-2021-096', '2021-10-15', 'Santa Cruz - Polillo', 12, 'CH678901250', 'EN432109840', 'WXY-1234', 'new', 0, NULL, '2022-10-15', 'admin'),
('Inocencio Tiu', 'Brgy. Bagumbayan, Santa Cruz, Laguna', '09789012356', 'FR-2021-097', '2021-11-20', 'Santa Cruz - Burdeos', 1, 'CH789012361', 'EN321098741', 'ZAB-5678', 'renew', 7, '2021-11-20', '2022-11-20', 'admin'),
('Josefa Co', 'Brgy. Poblacion, Santa Cruz, Laguna', '09890123467', 'FR-2021-098', '2021-12-28', 'Santa Cruz - Panukulan', 2, 'CH890123472', 'EN210987642', 'CDE-9012', 'new', 0, NULL, '2022-12-28', 'admin'),
('Kristina Yap', 'Brgy. Duhat, Santa Cruz, Laguna', '09901234578', 'FR-2020-099', '2020-01-05', 'Santa Cruz - Jomalig', 3, 'CH901234583', 'EN109876543', 'FGH-3456', 'renew', 9, '2020-01-05', '2021-01-05', 'admin'),
('Lorenzo Lim', 'Brgy. Jasaan, Santa Cruz, Laguna', '09012345689', 'FR-2020-100', '2020-02-12', 'Santa Cruz - Patnanungan', 4, 'CH012345694', 'EN098765444', 'IJK-7890', 'drop', 1, '2020-02-12', '2021-02-12', 'admin'),
('Magdalena Tan', 'Brgy. Labuin, Santa Cruz, Laguna', '09123456790', 'FR-2024-101', '2024-01-20', 'Santa Cruz - Paete', 5, 'CH123456796', 'EN987654336', 'LMN-1234', 'new', 0, NULL, '2025-01-20', 'admin'),
('Nicolas Go', 'Brgy. Malinao, Santa Cruz, Laguna', '09234567801', 'FR-2024-102', '2024-02-25', 'Santa Cruz - Kalayaan', 6, 'CH234567807', 'EN876543237', 'OPQ-5678', 'renew', 1, '2024-02-25', '2025-02-25', 'admin'),
('Ofelia Ong', 'Brgy. Palasan, Santa Cruz, Laguna', '09345678912', 'FR-2024-103', '2024-03-30', 'Santa Cruz - Lumban', 7, 'CH345678918', 'EN765432138', 'RST-9012', 'new', 0, NULL, '2025-03-30', 'admin'),
('Patricio Sy', 'Brgy. Palusapis, Santa Cruz, Laguna', '09456789023', 'FR-2024-104', '2024-04-08', 'Santa Cruz - Pagsanjan', 8, 'CH456789029', 'EN654321039', 'UVW-3456', 'renew', 2, '2024-04-08', '2025-04-08', 'admin'),
('Querida Lee', 'Brgy. San Juan, Santa Cruz, Laguna', '09567890134', 'FR-2024-105', '2024-05-15', 'Santa Cruz - Magdalena', 9, 'CH567890140', 'EN543210940', 'XYZ-7890', 'new', 0, NULL, '2025-05-15', 'admin'),
('Reynaldo Chua', 'Brgy. Santo Angel Norte, Santa Cruz, Laguna', '09678901245', 'FR-2024-106', '2024-06-22', 'Santa Cruz - Majayjay', 10, 'CH678901251', 'EN432109841', 'ABC-1234', 'renew', 3, '2024-06-22', '2025-06-22', 'admin'),
('Socorro Yu', 'Brgy. Santo Angel Sur, Santa Cruz, Laguna', '09789012356', 'FR-2024-107', '2024-07-28', 'Santa Cruz - Pakil', 11, 'CH789012362', 'EN321098742', 'DEF-5678', 'new', 0, NULL, '2025-07-28', 'admin'),
('Trinidad Wong', 'Brgy. Santisimo, Santa Cruz, Laguna', '09890123467', 'FR-2024-108', '2024-08-05', 'Santa Cruz - Pangil', 12, 'CH890123473', 'EN210987643', 'GHI-9012', 'renew', 1, '2024-08-05', '2025-08-05', 'admin'),
('Ulpiano Lao', 'Brgy. Bagumbayan, Santa Cruz, Laguna', '09901234578', 'FR-2024-109', '2024-09-12', 'Santa Cruz - Siniloan', 1, 'CH901234584', 'EN109876544', 'JKL-3456', 'new', 0, NULL, '2025-09-12', 'admin'),
('Vicenta Ang', 'Brgy. Poblacion, Santa Cruz, Laguna', '09012345689', 'FR-2024-110', '2024-10-18', 'Santa Cruz - Famy', 2, 'CH012345695', 'EN098765445', 'MNO-7890', 'renew', 4, '2024-10-18', '2025-10-18', 'admin'),
('Wilfredo Tiu', 'Brgy. Duhat, Santa Cruz, Laguna', '09123456790', 'FR-2024-111', '2024-11-25', 'Santa Cruz - Kalayaan', 3, 'CH123456797', 'EN987654337', 'PQR-1234', 'new', 0, NULL, '2025-11-25', 'admin'),
('Xenia Co', 'Brgy. Jasaan, Santa Cruz, Laguna', '09234567801', 'FR-2024-112', '2024-12-30', 'Santa Cruz - Liliw', 4, 'CH234567808', 'EN876543238', 'STU-5678', 'renew', 2, '2024-12-30', '2025-12-30', 'admin'),
('Ysmael Yap', 'Brgy. Labuin, Santa Cruz, Laguna', '09345678912', 'FR-2023-113', '2023-01-08', 'Santa Cruz - Rizal', 5, 'CH345678919', 'EN765432139', 'VWX-9012', 'renew', 5, '2023-01-08', '2024-01-08', 'admin'),
('Zosima Lim', 'Brgy. Malinao, Santa Cruz, Laguna', '09456789023', 'FR-2023-114', '2023-02-15', 'Santa Cruz - Nagcarlan', 6, 'CH456789030', 'EN654321040', 'YZA-3456', 'drop', 1, '2023-02-15', '2024-02-15', 'admin'),
('Agustin Tan', 'Brgy. Palasan, Santa Cruz, Laguna', '09567890134', 'FR-2023-115', '2023-03-22', 'Santa Cruz - Bay', 7, 'CH567890141', 'EN543210941', 'BCD-7890', 'renew', 3, '2023-03-22', '2024-03-22', 'admin'),
('Brigida Go', 'Brgy. Palusapis, Santa Cruz, Laguna', '09678901245', 'FR-2023-116', '2023-04-28', 'Santa Cruz - Los Baños', 8, 'CH678901252', 'EN432109842', 'EFG-1234', 'new', 0, NULL, '2024-04-28', 'admin'),
('Casimiro Ong', 'Brgy. San Juan, Santa Cruz, Laguna', '09789012356', 'FR-2023-117', '2023-05-05', 'Santa Cruz - Calauan', 9, 'CH789012363', 'EN321098743', 'HIJ-5678', 'renew', 2, '2023-05-05', '2024-05-05', 'admin'),
('Dominga Sy', 'Brgy. Santo Angel Norte, Santa Cruz, Laguna', '09890123467', 'FR-2023-118', '2023-06-12', 'Santa Cruz - Alaminos', 10, 'CH890123474', 'EN210987644', 'KLM-9012', 'new', 0, NULL, '2024-06-12', 'admin'),
('Eleuterio Lee', 'Brgy. Santo Angel Sur, Santa Cruz, Laguna', '09901234578', 'FR-2023-119', '2023-07-18', 'Santa Cruz - San Pablo', 11, 'CH901234585', 'EN109876545', 'NOP-3456', 'renew', 4, '2023-07-18', '2024-07-18', 'admin'),
('Faustina Chua', 'Brgy. Santisimo, Santa Cruz, Laguna', '09012345689', 'FR-2023-120', '2023-08-25', 'Santa Cruz - Tiaong', 12, 'CH012345696', 'EN098765446', 'QRS-7890', 'drop', 2, '2023-08-25', '2024-08-25', 'admin'),
('Genaro Yu', 'Brgy. Bagumbayan, Santa Cruz, Laguna', '09123456790', 'FR-2023-121', '2023-09-30', 'Santa Cruz - Candelaria', 1, 'CH123456798', 'EN987654338', 'TUV-1234', 'renew', 1, '2023-09-30', '2024-09-30', 'admin'),
('Hilaria Wong', 'Brgy. Poblacion, Santa Cruz, Laguna', '09234567801', 'FR-2023-122', '2023-10-08', 'Santa Cruz - Sariaya', 2, 'CH234567809', 'EN876543239', 'WXY-5678', 'new', 0, NULL, '2024-10-08', 'admin'),
('Ireneo Lao', 'Brgy. Duhat, Santa Cruz, Laguna', '09345678912', 'FR-2023-123', '2023-11-15', 'Santa Cruz - Tayabas', 3, 'CH345678920', 'EN765432140', 'ZAB-9012', 'renew', 6, '2023-11-15', '2024-11-15', 'admin'),
('Jovita Ang', 'Brgy. Jasaan, Santa Cruz, Laguna', '09456789023', 'FR-2023-124', '2023-12-22', 'Santa Cruz - Lucban', 4, 'CH456789031', 'EN654321041', 'CDE-3456', 'new', 0, NULL, '2024-12-22', 'admin'),
('Kardo Tiu', 'Brgy. Labuin, Santa Cruz, Laguna', '09567890134', 'FR-2022-125', '2022-01-12', 'Santa Cruz - Sampaloc', 5, 'CH567890142', 'EN543210942', 'FGH-7890', 'renew', 7, '2022-01-12', '2023-01-12', 'admin'),
('Librada Co', 'Brgy. Malinao, Santa Cruz, Laguna', '09678901245', 'FR-2022-126', '2022-02-18', 'Santa Cruz - Mauban', 6, 'CH678901253', 'EN432109843', 'IJK-1234', 'drop', 3, '2022-02-18', '2023-02-18', 'admin'),
('Maximo Yap', 'Brgy. Palasan, Santa Cruz, Laguna', '09789012356', 'FR-2022-127', '2022-03-25', 'Santa Cruz - Real', 7, 'CH789012364', 'EN321098744', 'LMN-5678', 'renew', 2, '2022-03-25', '2023-03-25', 'admin'),
('Nicanora Lim', 'Brgy. Palusapis, Santa Cruz, Laguna', '09890123467', 'FR-2022-128', '2022-04-30', 'Santa Cruz - General Nakar', 8, 'CH890123475', 'EN210987645', 'OPQ-9012', 'new', 0, NULL, '2023-04-30', 'admin'),
('Osmundo Tan', 'Brgy. San Juan, Santa Cruz, Laguna', '09901234578', 'FR-2022-129', '2022-05-08', 'Santa Cruz - Infanta', 9, 'CH901234586', 'EN109876546', 'RST-3456', 'renew', 5, '2022-05-08', '2023-05-08', 'admin'),
('Perpetua Go', 'Brgy. Santo Angel Norte, Santa Cruz, Laguna', '09012345689', 'FR-2022-130', '2022-06-15', 'Santa Cruz - Polillo', 10, 'CH012345697', 'EN098765447', 'UVW-7890', 'new', 0, NULL, '2023-06-15', 'admin'),
('Quintin Ong', 'Brgy. Santo Angel Sur, Santa Cruz, Laguna', '09123456790', 'FR-2022-131', '2022-07-22', 'Santa Cruz - Burdeos', 11, 'CH123456799', 'EN987654339', 'XYZ-1234', 'renew', 1, '2022-07-22', '2023-07-22', 'admin'),
('Remedios Sy', 'Brgy. Santisimo, Santa Cruz, Laguna', '09234567801', 'FR-2022-132', '2022-08-28', 'Santa Cruz - Panukulan', 12, 'CH234567810', 'EN876543240', 'ABC-5678', 'drop', 4, '2022-08-28', '2023-08-28', 'admin'),
('Severino Lee', 'Brgy. Bagumbayan, Santa Cruz, Laguna', '09345678912', 'FR-2022-133', '2022-09-05', 'Santa Cruz - Jomalig', 1, 'CH345678921', 'EN765432141', 'DEF-9012', 'renew', 3, '2022-09-05', '2023-09-05', 'admin'),
('Tomasa Chua', 'Brgy. Poblacion, Santa Cruz, Laguna', '09456789023', 'FR-2022-134', '2022-10-12', 'Santa Cruz - Patnanungan', 2, 'CH456789032', 'EN654321042', 'GHI-3456', 'new', 0, NULL, '2023-10-12', 'admin'),
('Uldarico Yu', 'Brgy. Duhat, Santa Cruz, Laguna', '09567890134', 'FR-2022-135', '2022-11-18', 'Santa Cruz - Paete', 3, 'CH567890143', 'EN543210943', 'JKL-7890', 'renew', 6, '2022-11-18', '2023-11-18', 'admin'),
('Visitacion Wong', 'Brgy. Jasaan, Santa Cruz, Laguna', '09678901245', 'FR-2022-136', '2022-12-25', 'Santa Cruz - Kalayaan', 4, 'CH678901254', 'EN432109844', 'MNO-1234', 'new', 0, NULL, '2023-12-25', 'admin'),
('Wenceslao Lao', 'Brgy. Labuin, Santa Cruz, Laguna', '09789012356', 'FR-2021-137', '2021-01-08', 'Santa Cruz - Lumban', 5, 'CH789012365', 'EN321098745', 'PQR-5678', 'renew', 8, '2021-01-08', '2022-01-08', 'admin'),
('Ximena Ang', 'Brgy. Malinao, Santa Cruz, Laguna', '09890123467', 'FR-2021-138', '2021-02-15', 'Santa Cruz - Pagsanjan', 6, 'CH890123476', 'EN210987646', 'STU-9012', 'drop', 2, '2021-02-15', '2022-02-15', 'admin'),
('Yolanda Tiu', 'Brgy. Palasan, Santa Cruz, Laguna', '09901234578', 'FR-2021-139', '2021-03-22', 'Santa Cruz - Magdalena', 7, 'CH901234587', 'EN109876547', 'VWX-3456', 'renew', 1, '2021-03-22', '2022-03-22', 'admin'),
('Zacarias Co', 'Brgy. Palusapis, Santa Cruz, Laguna', '09012345689', 'FR-2021-140', '2021-04-28', 'Santa Cruz - Majayjay', 8, 'CH012345698', 'EN098765448', 'YZA-7890', 'new', 0, NULL, '2022-04-28', 'admin'),
('Abundio Yap', 'Brgy. San Juan, Santa Cruz, Laguna', '09123456790', 'FR-2021-141', '2021-05-05', 'Santa Cruz - Pakil', 9, 'CH123456800', 'EN987654340', 'BCD-1234', 'renew', 5, '2021-05-05', '2022-05-05', 'admin'),
('Benigna Lim', 'Brgy. Santo Angel Norte, Santa Cruz, Laguna', '09234567801', 'FR-2021-142', '2021-06-12', 'Santa Cruz - Pangil', 10, 'CH234567811', 'EN876543241', 'EFG-5678', 'new', 0, NULL, '2022-06-12', 'admin'),
('Cornelio Tan', 'Brgy. Santo Angel Sur, Santa Cruz, Laguna', '09345678912', 'FR-2021-143', '2021-07-18', 'Santa Cruz - Siniloan', 11, 'CH345678922', 'EN765432142', 'HIJ-9012', 'renew', 4, '2021-07-18', '2022-07-18', 'admin'),
('Demetria Go', 'Brgy. Santisimo, Santa Cruz, Laguna', '09456789023', 'FR-2021-144', '2021-08-25', 'Santa Cruz - Famy', 12, 'CH456789033', 'EN654321043', 'KLM-3456', 'drop', 3, '2021-08-25', '2022-08-25', 'admin'),
('Estanislao Ong', 'Brgy. Bagumbayan, Santa Cruz, Laguna', '09567890134', 'FR-2021-145', '2021-09-30', 'Santa Cruz - Kalayaan', 1, 'CH567890144', 'EN543210944', 'NOP-7890', 'renew', 2, '2021-09-30', '2022-09-30', 'admin'),
('Filomena Sy', 'Brgy. Poblacion, Santa Cruz, Laguna', '09678901245', 'FR-2021-146', '2021-10-08', 'Santa Cruz - Liliw', 2, 'CH678901255', 'EN432109845', 'QRS-1234', 'new', 0, NULL, '2022-10-08', 'admin'),
('Graciano Lee', 'Brgy. Duhat, Santa Cruz, Laguna', '09789012356', 'FR-2021-147', '2021-11-15', 'Santa Cruz - Rizal', 3, 'CH789012366', 'EN321098746', 'TUV-5678', 'renew', 7, '2021-11-15', '2022-11-15', 'admin'),
('Hermenegildo Chua', 'Brgy. Jasaan, Santa Cruz, Laguna', '09890123467', 'FR-2021-148', '2021-12-22', 'Santa Cruz - Nagcarlan', 4, 'CH890123477', 'EN210987647', 'WXY-9012', 'new', 0, NULL, '2022-12-22', 'admin'),
('Imelda Yu', 'Brgy. Labuin, Santa Cruz, Laguna', '09901234578', 'FR-2020-149', '2020-01-12', 'Santa Cruz - Bay', 5, 'CH901234588', 'EN109876548', 'ZAB-3456', 'renew', 9, '2020-01-12', '2021-01-12', 'admin'),
('Juanito Wong', 'Brgy. Malinao, Santa Cruz, Laguna', '09012345689', 'FR-2020-150', '2020-02-18', 'Santa Cruz - Los Baños', 6, 'CH012345699', 'EN098765449', 'CDE-7890', 'drop', 1, '2020-02-18', '2021-02-18', 'admin'),
('Krisanta Lao', 'Brgy. Palasan, Santa Cruz, Laguna', '09123456790', 'FR-2024-151', '2024-01-25', 'Santa Cruz - Calauan', 7, 'CH123456801', 'EN987654341', 'FGH-1234', 'new', 0, NULL, '2025-01-25', 'admin'),
('Luciano Ang', 'Brgy. Palusapis, Santa Cruz, Laguna', '09234567801', 'FR-2024-152', '2024-02-30', 'Santa Cruz - Alaminos', 8, 'CH234567812', 'EN876543242', 'IJK-5678', 'renew', 1, '2024-02-30', '2025-02-30', 'admin'),
('Magdalena Tiu', 'Brgy. San Juan, Santa Cruz, Laguna', '09345678912', 'FR-2024-153', '2024-03-08', 'Santa Cruz - San Pablo', 9, 'CH345678923', 'EN765432143', 'LMN-9012', 'new', 0, NULL, '2025-03-08', 'admin'),
('Nemesio Co', 'Brgy. Santo Angel Norte, Santa Cruz, Laguna', '09456789023', 'FR-2024-154', '2024-04-15', 'Santa Cruz - Tiaong', 10, 'CH456789034', 'EN654321044', 'OPQ-3456', 'renew', 2, '2024-04-15', '2025-04-15', 'admin'),
('Olimpia Yap', 'Brgy. Santo Angel Sur, Santa Cruz, Laguna', '09567890134', 'FR-2024-155', '2024-05-22', 'Santa Cruz - Candelaria', 11, 'CH567890145', 'EN543210945', 'RST-7890', 'new', 0, NULL, '2025-05-22', 'admin'),
('Primitivo Lim', 'Brgy. Santisimo, Santa Cruz, Laguna', '09678901245', 'FR-2024-156', '2024-06-28', 'Santa Cruz - Sariaya', 12, 'CH678901256', 'EN432109846', 'UVW-1234', 'renew', 3, '2024-06-28', '2025-06-28', 'admin'),
('Quirina Tan', 'Brgy. Bagumbayan, Santa Cruz, Laguna', '09789012356', 'FR-2024-157', '2024-07-05', 'Santa Cruz - Tayabas', 1, 'CH789012367', 'EN321098747', 'XYZ-5678', 'new', 0, NULL, '2025-07-05', 'admin'),
('Rosendo Go', 'Brgy. Poblacion, Santa Cruz, Laguna', '09890123467', 'FR-2024-158', '2024-08-12', 'Santa Cruz - Lucban', 2, 'CH890123478', 'EN210987648', 'ABC-9012', 'renew', 1, '2024-08-12', '2025-08-12', 'admin'),
('Serafina Ong', 'Brgy. Duhat, Santa Cruz, Laguna', '09901234578', 'FR-2024-159', '2024-09-18', 'Santa Cruz - Sampaloc', 3, 'CH901234589', 'EN109876549', 'DEF-3456', 'new', 0, NULL, '2025-09-18', 'admin'),
('Teodora Sy', 'Brgy. Jasaan, Santa Cruz, Laguna', '09012345689', 'FR-2024-160', '2024-10-25', 'Santa Cruz - Mauban', 4, 'CH012345700', 'EN098765450', 'GHI-7890', 'renew', 4, '2024-10-25', '2025-10-25', 'admin'),
('Urbana Lee', 'Brgy. Labuin, Santa Cruz, Laguna', '09123456790', 'FR-2024-161', '2024-11-30', 'Santa Cruz - Real', 5, 'CH123456802', 'EN987654342', 'JKL-1234', 'new', 0, NULL, '2025-11-30', 'admin'),
('Valeriano Chua', 'Brgy. Malinao, Santa Cruz, Laguna', '09234567801', 'FR-2024-162', '2024-12-08', 'Santa Cruz - General Nakar', 6, 'CH234567813', 'EN876543243', 'MNO-5678', 'renew', 2, '2024-12-08', '2025-12-08', 'admin'),
('Wenceslada Yu', 'Brgy. Palasan, Santa Cruz, Laguna', '09345678912', 'FR-2023-163', '2023-01-15', 'Santa Cruz - Infanta', 7, 'CH345678924', 'EN765432144', 'PQR-9012', 'renew', 5, '2023-01-15', '2024-01-15', 'admin'),
('Ximena Wong', 'Brgy. Palusapis, Santa Cruz, Laguna', '09456789023', 'FR-2023-164', '2023-02-22', 'Santa Cruz - Polillo', 8, 'CH456789035', 'EN654321045', 'STU-3456', 'drop', 1, '2023-02-22', '2024-02-22', 'admin'),
('Yolanda Lao', 'Brgy. San Juan, Santa Cruz, Laguna', '09567890134', 'FR-2023-165', '2023-03-28', 'Santa Cruz - Burdeos', 9, 'CH567890146', 'EN543210946', 'VWX-7890', 'renew', 3, '2023-03-28', '2024-03-28', 'admin'),
('Zenaida Ang', 'Brgy. Santo Angel Norte, Santa Cruz, Laguna', '09678901245', 'FR-2023-166', '2023-04-05', 'Santa Cruz - Panukulan', 10, 'CH678901257', 'EN432109847', 'YZA-1234', 'new', 0, NULL, '2024-04-05', 'admin'),
('Abundio Tiu', 'Brgy. Santo Angel Sur, Santa Cruz, Laguna', '09789012356', 'FR-2023-167', '2023-05-12', 'Santa Cruz - Jomalig', 11, 'CH789012368', 'EN321098748', 'BCD-5678', 'renew', 2, '2023-05-12', '2024-05-12', 'admin'),
('Benigna Co', 'Brgy. Santisimo, Santa Cruz, Laguna', '09890123467', 'FR-2023-168', '2023-06-18', 'Santa Cruz - Patnanungan', 12, 'CH890123479', 'EN210987649', 'EFG-9012', 'new', 0, NULL, '2024-06-18', 'admin'),
('Cornelio Yap', 'Brgy. Bagumbayan, Santa Cruz, Laguna', '09901234578', 'FR-2023-169', '2023-07-25', 'Santa Cruz - Paete', 1, 'CH901234590', 'EN109876550', 'HIJ-3456', 'renew', 4, '2023-07-25', '2024-07-25', 'admin'),
('Demetria Lim', 'Brgy. Poblacion, Santa Cruz, Laguna', '09012345689', 'FR-2023-170', '2023-08-30', 'Santa Cruz - Kalayaan', 2, 'CH012345701', 'EN098765451', 'KLM-7890', 'drop', 2, '2023-08-30', '2024-08-30', 'admin'),
('Estanislao Tan', 'Brgy. Duhat, Santa Cruz, Laguna', '09123456790', 'FR-2023-171', '2023-09-08', 'Santa Cruz - Lumban', 3, 'CH123456803', 'EN987654343', 'NOP-1234', 'renew', 1, '2023-09-08', '2024-09-08', 'admin'),
('Filomena Go', 'Brgy. Jasaan, Santa Cruz, Laguna', '09234567801', 'FR-2023-172', '2023-10-15', 'Santa Cruz - Pagsanjan', 4, 'CH234567814', 'EN876543244', 'QRS-5678', 'new', 0, NULL, '2024-10-15', 'admin'),
('Graciano Ong', 'Brgy. Labuin, Santa Cruz, Laguna', '09345678912', 'FR-2023-173', '2023-11-22', 'Santa Cruz - Magdalena', 5, 'CH345678925', 'EN765432145', 'TUV-9012', 'renew', 6, '2023-11-22', '2024-11-22', 'admin'),
('Hermenegildo Sy', 'Brgy. Malinao, Santa Cruz, Laguna', '09456789023', 'FR-2023-174', '2023-12-28', 'Santa Cruz - Majayjay', 6, 'CH456789036', 'EN654321046', 'WXY-3456', 'new', 0, NULL, '2024-12-28', 'admin'),
('Imelda Lee', 'Brgy. Palasan, Santa Cruz, Laguna', '09567890134', 'FR-2022-175', '2022-01-05', 'Santa Cruz - Pakil', 7, 'CH567890147', 'EN543210947', 'ZAB-7890', 'renew', 7, '2022-01-05', '2023-01-05', 'admin'),
('Juanito Chua', 'Brgy. Palusapis, Santa Cruz, Laguna', '09678901245', 'FR-2022-176', '2022-02-12', 'Santa Cruz - Pangil', 8, 'CH678901258', 'EN432109848', 'CDE-1234', 'drop', 3, '2022-02-12', '2023-02-12', 'admin'),
('Krisanta Yu', 'Brgy. San Juan, Santa Cruz, Laguna', '09789012356', 'FR-2022-177', '2022-03-18', 'Santa Cruz - Siniloan', 9, 'CH789012369', 'EN321098749', 'FGH-5678', 'renew', 2, '2022-03-18', '2023-03-18', 'admin'),
('Luciano Wong', 'Brgy. Santo Angel Norte, Santa Cruz, Laguna', '09890123467', 'FR-2022-178', '2022-04-25', 'Santa Cruz - Famy', 10, 'CH890123480', 'EN210987650', 'IJK-9012', 'new', 0, NULL, '2023-04-25', 'admin'),
('Magdalena Lao', 'Brgy. Santo Angel Sur, Santa Cruz, Laguna', '09901234578', 'FR-2022-179', '2022-05-30', 'Santa Cruz - Kalayaan', 11, 'CH901234591', 'EN109876551', 'LMN-3456', 'renew', 5, '2022-05-30', '2023-05-30', 'admin'),
('Nemesio Ang', 'Brgy. Santisimo, Santa Cruz, Laguna', '09012345689', 'FR-2022-180', '2022-06-08', 'Santa Cruz - Liliw', 12, 'CH012345702', 'EN098765452', 'OPQ-7890', 'new', 0, NULL, '2023-06-08', 'admin'),
('Olimpia Tiu', 'Brgy. Bagumbayan, Santa Cruz, Laguna', '09123456790', 'FR-2022-181', '2022-07-15', 'Santa Cruz - Rizal', 1, 'CH123456804', 'EN987654344', 'RST-1234', 'renew', 1, '2022-07-15', '2023-07-15', 'admin'),
('Primitivo Co', 'Brgy. Poblacion, Santa Cruz, Laguna', '09234567801', 'FR-2022-182', '2022-08-22', 'Santa Cruz - Nagcarlan', 2, 'CH234567815', 'EN876543245', 'UVW-5678', 'drop', 4, '2022-08-22', '2023-08-22', 'admin'),
('Quirina Yap', 'Brgy. Duhat, Santa Cruz, Laguna', '09345678912', 'FR-2022-183', '2022-09-28', 'Santa Cruz - Bay', 3, 'CH345678926', 'EN765432146', 'XYZ-9012', 'renew', 3, '2022-09-28', '2023-09-28', 'admin'),
('Rosendo Lim', 'Brgy. Jasaan, Santa Cruz, Laguna', '09456789023', 'FR-2022-184', '2022-10-05', 'Santa Cruz - Los Baños', 4, 'CH456789037', 'EN654321047', 'ABC-3456', 'new', 0, NULL, '2023-10-05', 'admin'),
('Serafina Tan', 'Brgy. Labuin, Santa Cruz, Laguna', '09567890134', 'FR-2022-185', '2022-11-12', 'Santa Cruz - Calauan', 5, 'CH567890148', 'EN543210948', 'DEF-7890', 'renew', 6, '2022-11-12', '2023-11-12', 'admin'),
('Teodora Go', 'Brgy. Malinao, Santa Cruz, Laguna', '09678901245', 'FR-2022-186', '2022-12-18', 'Santa Cruz - Alaminos', 6, 'CH678901259', 'EN432109849', 'GHI-1234', 'new', 0, NULL, '2023-12-18', 'admin'),
('Urbana Ong', 'Brgy. Palasan, Santa Cruz, Laguna', '09789012356', 'FR-2021-187', '2021-01-25', 'Santa Cruz - San Pablo', 7, 'CH789012370', 'EN321098750', 'JKL-5678', 'renew', 8, '2021-01-25', '2022-01-25', 'admin'),
('Valeriano Sy', 'Brgy. Palusapis, Santa Cruz, Laguna', '09890123467', 'FR-2021-188', '2021-02-30', 'Santa Cruz - Tiaong', 8, 'CH890123481', 'EN210987651', 'MNO-9012', 'drop', 2, '2021-02-30', '2022-02-30', 'admin'),
('Wenceslada Lee', 'Brgy. San Juan, Santa Cruz, Laguna', '09901234578', 'FR-2021-189', '2021-03-08', 'Santa Cruz - Candelaria', 9, 'CH901234592', 'EN109876552', 'PQR-3456', 'renew', 1, '2021-03-08', '2022-03-08', 'admin'),
('Ximena Chua', 'Brgy. Santo Angel Norte, Santa Cruz, Laguna', '09012345689', 'FR-2021-190', '2021-04-15', 'Santa Cruz - Sariaya', 10, 'CH012345703', 'EN098765453', 'STU-7890', 'new', 0, NULL, '2022-04-15', 'admin'),
('Yolanda Yu', 'Brgy. Santo Angel Sur, Santa Cruz, Laguna', '09123456790', 'FR-2021-191', '2021-05-22', 'Santa Cruz - Tayabas', 11, 'CH123456805', 'EN987654345', 'VWX-1234', 'renew', 5, '2021-05-22', '2022-05-22', 'admin'),
('Zenaida Wong', 'Brgy. Santisimo, Santa Cruz, Laguna', '09234567801', 'FR-2021-192', '2021-06-28', 'Santa Cruz - Lucban', 12, 'CH234567816', 'EN876543246', 'YZA-5678', 'new', 0, NULL, '2022-06-28', 'admin'),
('Abundio Lao', 'Brgy. Bagumbayan, Santa Cruz, Laguna', '09345678912', 'FR-2021-193', '2021-07-05', 'Santa Cruz - Sampaloc', 1, 'CH345678927', 'EN765432147', 'BCD-9012', 'renew', 4, '2021-07-05', '2022-07-05', 'admin'),
('Benigna Ang', 'Brgy. Poblacion, Santa Cruz, Laguna', '09456789023', 'FR-2021-194', '2021-08-12', 'Santa Cruz - Mauban', 2, 'CH456789038', 'EN654321048', 'EFG-3456', 'drop', 3, '2021-08-12', '2022-08-12', 'admin'),
('Cornelio Tiu', 'Brgy. Duhat, Santa Cruz, Laguna', '09567890134', 'FR-2021-195', '2021-09-18', 'Santa Cruz - Real', 3, 'CH567890149', 'EN543210949', 'HIJ-7890', 'renew', 2, '2021-09-18', '2022-09-18', 'admin'),
('Demetria Co', 'Brgy. Jasaan, Santa Cruz, Laguna', '09678901245', 'FR-2021-196', '2021-10-25', 'Santa Cruz - General Nakar', 4, 'CH678901260', 'EN432109850', 'KLM-1234', 'new', 0, NULL, '2022-10-25', 'admin'),
('Estanislao Yap', 'Brgy. Labuin, Santa Cruz, Laguna', '09789012356', 'FR-2021-197', '2021-11-30', 'Santa Cruz - Infanta', 5, 'CH789012371', 'EN321098751', 'NOP-5678', 'renew', 7, '2021-11-30', '2022-11-30', 'admin'),
('Filomena Lim', 'Brgy. Malinao, Santa Cruz, Laguna', '09890123467', 'FR-2021-198', '2021-12-08', 'Santa Cruz - Polillo', 6, 'CH890123482', 'EN210987652', 'QRS-9012', 'new', 0, NULL, '2022-12-08', 'admin'),
('Graciano Tan', 'Brgy. Palasan, Santa Cruz, Laguna', '09901234578', 'FR-2020-199', '2020-01-15', 'Santa Cruz - Burdeos', 7, 'CH901234593', 'EN109876553', 'TUV-3456', 'renew', 9, '2020-01-15', '2021-01-15', 'admin'),
('Hermenegildo Go', 'Brgy. Palusapis, Santa Cruz, Laguna', '09012345689', 'FR-2020-200', '2020-02-22', 'Santa Cruz - Panukulan', 8, 'CH012345704', 'EN098765454', 'WXY-7890', 'drop', 1, '2020-02-22', '2021-02-22', 'admin');

-- Add table comments
ALTER TABLE `users` COMMENT = 'Stores user accounts and authentication information';
ALTER TABLE `refresh_tokens` COMMENT = 'Stores refresh tokens for JWT authentication';
ALTER TABLE `login_attempts` COMMENT = 'Tracks login attempts for security monitoring';
ALTER TABLE `makes` COMMENT = 'Stores vehicle make/brand information';
ALTER TABLE `franchises` COMMENT = 'Stores franchise information including vehicle details and status';
ALTER TABLE `franchise_history` COMMENT = 'Tracks all franchise status changes and renewals';

-- Clean up expired tokens periodically
-- Run this as a scheduled job (cron/task scheduler)
-- DELETE FROM refresh_tokens WHERE ExpiresAt < NOW() OR IsRevoked = TRUE;
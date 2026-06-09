-- ============================================
-- CellVantage Database Architecture
-- Battery Tracking & Traceability System
-- ============================================

-- Create and initialize the clean database
DROP DATABASE IF EXISTS cell_vantage;
CREATE DATABASE cell_vantage CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cell_vantage;

-- 1. Users Table (users) - Factory Authentication & Permissions
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT 'Unique employee identifier',
  username VARCHAR(50) NOT NULL UNIQUE COMMENT 'Login username (e.g., zkx1234)', -- Automatically indexed (UNIQUE)
  password_hash VARCHAR(255) NOT NULL COMMENT 'Bcrypt hashed password value',
  email VARCHAR(100) COMMENT 'Employee email address',
  role ENUM('admin', 'lab_operator', 'warehouse_staff', 'quality_engineer', 'system') NOT NULL DEFAULT 'lab_operator' COMMENT 'Role-based access control permissions',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Account creation timestamp',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last account update timestamp',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Flag to indicate if the account is active',
  
  -- Manual index for frequent role-based filtering on the dashboard
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='User accounts and factory permission management';


-- 2. Batches Table (batches) - Material Supply Batches
CREATE TABLE IF NOT EXISTS batches (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT 'Internal system batch ID',
  batch_number VARCHAR(64) NOT NULL UNIQUE COMMENT 'Factory batch number (e.g., CATL-20260608-01A)', -- Automatically indexed (UNIQUE)
  supplier VARCHAR(100) NOT NULL COMMENT 'Supplier name (e.g., CATL, LG Energy)',
  total_quantity INT NOT NULL COMMENT 'Total quantity of items delivered in this batch',
  delivery_date DATE NOT NULL COMMENT 'Date the batch arrived at the factory',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'System batch registration timestamp',
  notes TEXT COMMENT 'Batch logistics notes (e.g., transport conditions, special requirements)',
  
  -- Manual indexes for dropdown filtering and chronological sorting
  INDEX idx_supplier (supplier),
  INDEX idx_delivery_date (delivery_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Material procurement and supplier batch tracking';


-- 3. Cells Table (cells) - Individual Battery Master Table
CREATE TABLE IF NOT EXISTS cells (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT 'Internal unique tracking index',
  cell_code VARCHAR(100) NOT NULL UNIQUE COMMENT 'Laser-etched QR/Barcode on the cell surface (Unique Identifier)', -- Automatically indexed (UNIQUE)
  batch_id BIGINT UNSIGNED NOT NULL COMMENT 'Strong relation: Origin supply batch',                            -- Automatically indexed (FOREIGN KEY)
  model VARCHAR(100) COMMENT 'Battery form factor model (e.g., 21700, 18650)',
  capacity_rated DECIMAL(8,2) COMMENT 'Rated capacity in mAh',
  voltage_nominal DECIMAL(4,2) COMMENT 'Nominal voltage in V',
  manufacture_date DATE COMMENT 'Cell manufacturing date by supplier',
  current_state ENUM('Received', 'Incoming QC', 'Storage', 'Under Test', 'Passed', 'Failed', 'Disposed') NOT NULL DEFAULT 'Received' COMMENT 'Current lifecycle state of the cell',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Initial factory check-in timestamp',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Timestamp of the last state transition',
  
  -- Defensive Design: RESTRICT prevents deleting a batch if cells are still linked to it
  CONSTRAINT fk_cells_batch_id FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  
  -- Manual indexes for high-frequency frontend operational filtering
  INDEX idx_current_state (current_state),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Master asset ledger for every unique battery cell';


-- 4. Metrics Data Table (cell_metrics_data) - High-Frequency Test Machine Telemetry
CREATE TABLE IF NOT EXISTS cell_metrics_data (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT 'Data point record ID',
  cell_id BIGINT UNSIGNED NOT NULL COMMENT 'Strong relation: Associated battery cell', -- Automatically indexed (FOREIGN KEY)
  voltage DECIMAL(5,3) COMMENT 'Open-circuit voltage (V), precise to 0.001V',
  internal_resistance DECIMAL(6,3) COMMENT 'Internal resistance (mΩ), precise to 0.001mΩ',
  capacity DECIMAL(8,3) COMMENT 'Actual discharged capacity (mAh)',
  temperature DECIMAL(4,1) COMMENT 'Testing ambient temperature (°C)',
  cycle_count INT COMMENT 'Current testing cycle count number',
  test_type VARCHAR(50) COMMENT 'Type of test being executed (e.g., cycle_test, thermal_test)',
  test_duration_hours INT COMMENT 'Duration of test phase in hours',
  notes TEXT COMMENT 'Machine or operator testing notes',
  test_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Automated test equipment capture timestamp',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Database ingestion timestamp',
  
  -- Data Integrity: Testing metrics cannot be orphaned by sudden cell master changes
  CONSTRAINT fk_metrics_cell_id FOREIGN KEY (cell_id) REFERENCES cells(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  
  -- Manual indexes for time-series range analysis and analytics
  INDEX idx_test_timestamp (test_timestamp),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='High-frequency automated equipment telemetry logs';


-- 5. Audit Logs Table (cell_audit_logs) - Immutable Audit Trail (The System Soul)
CREATE TABLE IF NOT EXISTS cell_audit_logs (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT 'Audit log transaction serial number',
  cell_id BIGINT UNSIGNED NOT NULL COMMENT 'Strong relation: Targeted battery cell',    -- Automatically indexed (FOREIGN KEY)
  operator_id BIGINT UNSIGNED NOT NULL COMMENT 'Strong relation: Responsible employee', -- Automatically indexed (FOREIGN KEY)
  event_type ENUM('Create', 'Status_Change', 'Correction', 'Metrics_Update') NOT NULL COMMENT 'Classification of the action taken',
  changed_from VARCHAR(30) COMMENT 'State prior to modification (NULL if initial asset creation)',
  changed_to VARCHAR(30) NOT NULL COMMENT 'State resulting from modification',
  notes TEXT NOT NULL COMMENT 'Mandatory compliance reason: Why was this data changed?',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Precise millisecond-level change execution time',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Compliance Rule: Audit logs are Append-Only. They can NEVER be deleted by cascading changes
  CONSTRAINT fk_logs_cell_id FOREIGN KEY (cell_id) REFERENCES cells(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_logs_operator_id FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  
  -- Manual indexes for compliance officers searching by event types or timeframes
  INDEX idx_event_type (event_type),
  INDEX idx_created_at (created_at),
  INDEX idx_changed_to (changed_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Immutable, append-only historical audit trail for compliance and tracking';


-- ============================================
-- Virtual View Layer (Views)
-- ============================================

-- View 1: Complete Cell Overview with Batch Context (For Main Dashboard Table)
CREATE OR REPLACE VIEW v_cells_with_batch AS
SELECT 
  c.id,
  c.cell_code,
  c.current_state,
  c.created_at,
  c.updated_at,
  b.batch_number,
  b.supplier AS batch_supplier, -- Seamless normalized dynamic relation lookup
  b.delivery_date,
  c.model,
  c.capacity_rated,
  c.voltage_nominal
FROM cells c
LEFT JOIN batches b ON c.batch_id = b.id;


-- View 2: Complete Cell Lifecycle History (For Vertical Timeline Component)
CREATE OR REPLACE VIEW v_cell_complete_history AS
SELECT 
  cal.id,
  cal.cell_id,
  cal.event_type,
  cal.changed_from,
  cal.changed_to,
  cal.notes,
  cal.created_at,
  u.username AS operator_name,  -- Pulls real human names instead of raw numbers
  c.cell_code
FROM cell_audit_logs cal
LEFT JOIN users u ON cal.operator_id = u.id
LEFT JOIN cells c ON cal.cell_id = c.id;

CREATE TABLE IF NOT EXISTS incidents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  incident_code VARCHAR(32) DEFAULT NULL,
  reporter_id BIGINT UNSIGNED NOT NULL,
  plant_sector_id BIGINT UNSIGNED NOT NULL,
  category VARCHAR(100) NOT NULL,
  occurred_at DATETIME NOT NULL,
  severity ENUM('Low', 'Moderate', 'High', 'Critical') NOT NULL,
  description TEXT NOT NULL,
  witnesses VARCHAR(500) DEFAULT NULL,
  status ENUM('Pending', 'Under Review', 'In Progress', 'Resolved') NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_incidents_code (incident_code),
  KEY idx_incidents_reporter (reporter_id),
  KEY idx_incidents_sector (plant_sector_id),
  KEY idx_incidents_status (status),
  KEY idx_incidents_created (created_at),
  CONSTRAINT fk_incidents_reporter FOREIGN KEY (reporter_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_incidents_sector FOREIGN KEY (plant_sector_id)
    REFERENCES plant_sectors (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS incident_evidence (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  incident_id BIGINT UNSIGNED NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  storage_name VARCHAR(100) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_incident_evidence_incident (incident_id),
  CONSTRAINT fk_incident_evidence_incident FOREIGN KEY (incident_id)
    REFERENCES incidents (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Officer accounts stay in users. The profile extension stores officer-only details.
CREATE TABLE IF NOT EXISTS officer_roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_name VARCHAR(100) NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_officer_roles_name (role_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS officer_specialties (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  specialty_name VARCHAR(120) NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_officer_specialties_name (specialty_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS officer_profiles (
  user_id BIGINT UNSIGNED NOT NULL,
  officer_role_id BIGINT UNSIGNED NOT NULL,
  plant_sector_id BIGINT UNSIGNED DEFAULT NULL,
  contact_number VARCHAR(30) DEFAULT NULL,
  created_by BIGINT UNSIGNED DEFAULT NULL,
  updated_by BIGINT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  KEY idx_officer_role (officer_role_id),
  KEY idx_officer_sector (plant_sector_id),
  KEY idx_officer_created_by (created_by),
  KEY idx_officer_updated_by (updated_by),
  CONSTRAINT fk_officer_profile_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_officer_profile_role FOREIGN KEY (officer_role_id)
    REFERENCES officer_roles (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_officer_profile_sector FOREIGN KEY (plant_sector_id)
    REFERENCES plant_sectors (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_officer_profile_created_by FOREIGN KEY (created_by)
    REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_officer_profile_updated_by FOREIGN KEY (updated_by)
    REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS officer_profile_specialties (
  officer_user_id BIGINT UNSIGNED NOT NULL,
  specialty_id BIGINT UNSIGNED NOT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (officer_user_id, specialty_id),
  KEY idx_officer_specialty (specialty_id),
  CONSTRAINT fk_officer_specialty_profile FOREIGN KEY (officer_user_id)
    REFERENCES officer_profiles (user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_officer_specialty_catalog FOREIGN KEY (specialty_id)
    REFERENCES officer_specialties (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO officer_roles (role_name, description) VALUES
  ('Safety Officer', 'Workplace safety inspections and incident response.'),
  ('Engineer', 'Engineering review of equipment, facilities, and process hazards.'),
  ('EHS Officer', 'Environmental, health, and safety compliance.'),
  ('Fire & Emergency Responder', 'Fire prevention, emergency response, and evacuation.'),
  ('First Aid / Medical Responder', 'Initial medical response and first aid.'),
  ('Electrical Technician', 'Electrical systems and electrical hazard response.'),
  ('Maintenance Technician', 'Equipment maintenance and mechanical hazard response.'),
  ('Security Officer', 'Site security and incident-area access control.'),
  ('Environmental Officer', 'Spill, waste, and environmental hazard response.')
ON DUPLICATE KEY UPDATE description = VALUES(description), is_active = 1;

INSERT INTO officer_specialties (specialty_name, description) VALUES
  ('Incident Investigation', 'Incident documentation, evidence review, and root-cause analysis.'),
  ('Chemical Spill Response', 'Hazardous material containment and spill response.'),
  ('Fire & Electrical Safety', 'Fire prevention and electrical hazard assessment.'),
  ('First Aid & Medical Response', 'First aid and coordination of medical response.'),
  ('Equipment & Machinery Safety', 'Machine guarding, equipment faults, and safe operation.'),
  ('Environmental Hazard Response', 'Environmental spills, releases, and waste hazards.'),
  ('Structural & Evacuation Safety', 'Structural hazards, blocked exits, and evacuation readiness.'),
  ('PPE Compliance', 'Personal protective equipment selection and compliance.'),
  ('Emergency Response', 'Emergency planning, response coordination, and drills.')
ON DUPLICATE KEY UPDATE description = VALUES(description), is_active = 1;

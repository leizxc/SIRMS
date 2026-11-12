CREATE TABLE IF NOT EXISTS incident_assignments (
  incident_id BIGINT UNSIGNED NOT NULL,
  officer_user_id BIGINT UNSIGNED NOT NULL,
  assigned_by BIGINT UNSIGNED NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (incident_id),
  KEY idx_incident_assignments_officer (officer_user_id),
  CONSTRAINT fk_incident_assignment_incident FOREIGN KEY (incident_id)
    REFERENCES incidents (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_incident_assignment_officer FOREIGN KEY (officer_user_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_incident_assignment_admin FOREIGN KEY (assigned_by)
    REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

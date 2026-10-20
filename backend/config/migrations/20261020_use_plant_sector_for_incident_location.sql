-- Incident location is selected from the active plant sectors catalog.
ALTER TABLE incidents
  DROP COLUMN location,
  ADD COLUMN plant_sector_id BIGINT UNSIGNED NOT NULL AFTER reporter_id,
  ADD KEY idx_incidents_sector (plant_sector_id),
  ADD CONSTRAINT fk_incidents_sector FOREIGN KEY (plant_sector_id)
    REFERENCES plant_sectors (id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE plant_sectors
  ADD COLUMN IF NOT EXISTS risk_tier VARCHAR(30) NOT NULL DEFAULT 'TIER 2' AFTER description,
  ADD COLUMN IF NOT EXISTS facility_lead VARCHAR(150) DEFAULT NULL AFTER risk_tier;

UPDATE plant_sectors SET risk_tier = UPPER(risk_tier);

ALTER TABLE plant_sectors
  MODIFY COLUMN risk_tier VARCHAR(30) NOT NULL DEFAULT 'TIER 2';

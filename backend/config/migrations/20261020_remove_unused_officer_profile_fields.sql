-- Employee numbers and officer notes are not part of officer account management.
-- Conditional statements keep this safe for fresh databases where the columns
-- are already absent from the initial officer-management schema.
SET @drop_employee_index = (
  SELECT IF(COUNT(*) > 0,
    'ALTER TABLE officer_profiles DROP INDEX uq_officer_employee_number',
    'SELECT 1')
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'officer_profiles'
    AND index_name = 'uq_officer_employee_number'
);
PREPARE officer_profile_stmt FROM @drop_employee_index;
EXECUTE officer_profile_stmt;
DEALLOCATE PREPARE officer_profile_stmt;

SET @drop_employee_number = (
  SELECT IF(COUNT(*) > 0,
    'ALTER TABLE officer_profiles DROP COLUMN employee_number',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'officer_profiles'
    AND column_name = 'employee_number'
);
PREPARE officer_profile_stmt FROM @drop_employee_number;
EXECUTE officer_profile_stmt;
DEALLOCATE PREPARE officer_profile_stmt;

SET @drop_officer_notes = (
  SELECT IF(COUNT(*) > 0,
    'ALTER TABLE officer_profiles DROP COLUMN notes',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'officer_profiles'
    AND column_name = 'notes'
);
PREPARE officer_profile_stmt FROM @drop_officer_notes;
EXECUTE officer_profile_stmt;
DEALLOCATE PREPARE officer_profile_stmt;

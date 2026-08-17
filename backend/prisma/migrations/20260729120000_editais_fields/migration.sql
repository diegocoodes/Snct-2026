-- Campos completos do módulo de editais
ALTER TABLE `snct_notices`
  ADD COLUMN `summary` TEXT NULL,
  ADD COLUMN `description` TEXT NULL,
  ADD COLUMN `registration_starts_at` DATE NULL,
  ADD COLUMN `registration_ends_at` DATE NULL,
  ADD COLUMN `form_url` TEXT NULL;

UPDATE `snct_notices`
SET
  `summary` = COALESCE(`summary`, ''),
  `description` = COALESCE(`description`, ''),
  `form_url` = COALESCE(`form_url`, '');

ALTER TABLE `snct_notices`
  MODIFY COLUMN `summary` TEXT NOT NULL,
  MODIFY COLUMN `description` TEXT NOT NULL,
  MODIFY COLUMN `form_url` TEXT NOT NULL;

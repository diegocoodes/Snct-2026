ALTER TABLE `snct_site_settings`
  ADD COLUMN `color_background` VARCHAR(7) NOT NULL DEFAULT '#10002b',
  ADD COLUMN `color_surface` VARCHAR(7) NOT NULL DEFAULT '#18003d',
  ADD COLUMN `color_primary` VARCHAR(7) NOT NULL DEFAULT '#6a00ff',
  ADD COLUMN `color_secondary` VARCHAR(7) NOT NULL DEFAULT '#ff2ed1',
  ADD COLUMN `color_accent` VARCHAR(7) NOT NULL DEFAULT '#00e5ff',
  ADD COLUMN `color_text` VARCHAR(7) NOT NULL DEFAULT '#f5f7ff';

CREATE TABLE `game_forms` (
  `id` VARCHAR(64) NOT NULL,
  `title` VARCHAR(180) NOT NULL,
  `slug` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `fields` JSON NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `game_forms_slug_unique` (`slug`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `game_form_submissions` (
  `id` VARCHAR(64) NOT NULL,
  `form_id` VARCHAR(64) NOT NULL,
  `answers` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `game_form_submissions_form_idx` (`form_id`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `game_form_submissions_form_fk`
    FOREIGN KEY (`form_id`) REFERENCES `game_forms` (`id`)
    ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

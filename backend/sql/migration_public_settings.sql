-- Neo backend: key/value JSON for public-facing settings (e.g. subscription price bands).
-- Auto-created by app/db_mysql.ensure_public_settings_table() when MySQL is configured.
-- Import manually if needed:

CREATE TABLE IF NOT EXISTS `public_settings` (
  `setting_key` VARCHAR(128) NOT NULL,
  `setting_value` JSON NOT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Example manual edit (phpMyAdmin): row key `subscription_plan_pricing`, JSON shape matches GET /api/public/subscription-plans

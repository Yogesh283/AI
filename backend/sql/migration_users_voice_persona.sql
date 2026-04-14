-- Voice / avatar persona persisted per user (web Voice page).
-- Run once on existing DBs: mysql -u ... dbname < sql/migration_users_voice_persona.sql
-- If you see "Duplicate column", the column is already there — skip.

ALTER TABLE `users`
  ADD COLUMN `voice_persona_id` VARCHAR(32) NOT NULL DEFAULT 'sara'
    COMMENT 'Voice UI persona id (e.g. arjun, sara)'
    AFTER `auth_provider`;

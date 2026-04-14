-- NEO backend — MySQL (XAMPP)
-- phpMyAdmin: Import this file, OR run: mysql -u root -p < init_ai_users.sql
-- Default XAMPP: user root, empty password

CREATE DATABASE IF NOT EXISTS `ai`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `ai`;

-- Login / register + Google sign-in (same shape as app.store user records)
CREATE TABLE IF NOT EXISTS `users` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID',
  `email` VARCHAR(255) NOT NULL,
  `display_name` VARCHAR(80) NOT NULL DEFAULT '',
  `password_hash_b64` VARCHAR(512) NOT NULL DEFAULT '' COMMENT 'empty if Google-only',
  `auth_provider` ENUM('password', 'google') NOT NULL DEFAULT 'password',
  `voice_persona_id` VARCHAR(32) NOT NULL DEFAULT 'sara' COMMENT 'Voice UI persona (arjun, sara, …)',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Logged-in user chat (Bearer JWT); one row per message
CREATE TABLE IF NOT EXISTS `chat_messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` CHAR(36) NOT NULL,
  `role` ENUM('user', 'assistant', 'system') NOT NULL,
  `source` VARCHAR(16) NOT NULL DEFAULT 'chat' COMMENT 'chat | voice | tools',
  `content` MEDIUMTEXT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_chat_user_time` (`user_id`, `created_at`),
  KEY `idx_chat_user_source_time` (`user_id`, `source`, `created_at`),
  CONSTRAINT `fk_chat_messages_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Usage / billing-style log per API interaction (e.g. chat completion)
CREATE TABLE IF NOT EXISTS `usage_transactions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` CHAR(36) NOT NULL,
  `txn_type` VARCHAR(32) NOT NULL,
  `metadata` JSON NULL,
  `prompt_tokens` INT UNSIGNED NULL,
  `completion_tokens` INT UNSIGNED NULL,
  `total_tokens` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_txn_user_time` (`user_id`, `created_at`),
  CONSTRAINT `fk_usage_transactions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

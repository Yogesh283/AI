-- Add conversation source so Memory UI can show only Chat + Voice (exclude Tools, etc.).
-- Run once on existing DB: mysql -u root -p your_db < sql/migration_chat_messages_source.sql

ALTER TABLE `chat_messages`
 ADD COLUMN `source` VARCHAR(16) NOT NULL DEFAULT 'chat'
 COMMENT 'chat | voice | tools'
    AFTER `role`;

ALTER TABLE `chat_messages`
  ADD KEY `idx_chat_user_source_time` (`user_id`, `source`, `created_at`);

-- Migration: Add ownerChatId to Task table
-- This field stores the Telegram chatId of the user who created the task.
-- Reminders will only be sent to this specific user, not to all registered chats.

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "ownerChatId" BIGINT;

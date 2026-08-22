-- Single notification per task by default.
-- The old default (3 repeats) made the engine send 4 notifications per task
-- (advance + due + 2 overdue repeats). New default: 0 repeats = exactly one
-- notification; users can opt back into repeats via reminder settings.
ALTER TABLE "TelegramChat" ALTER COLUMN "reminderRepeatCount" SET DEFAULT 0;

-- Reset only untouched legacy defaults so existing users stop receiving
-- quadruple notifications. Anyone who explicitly chose 1/2/3/5 keeps it.
UPDATE "TelegramChat" SET "reminderRepeatCount" = 0 WHERE "reminderRepeatCount" = 3;

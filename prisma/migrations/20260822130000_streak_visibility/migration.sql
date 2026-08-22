-- Social streaks layer: per-user visibility toggle (default ON).
ALTER TABLE "TelegramChat" ADD COLUMN "streakVisible" BOOLEAN NOT NULL DEFAULT true;

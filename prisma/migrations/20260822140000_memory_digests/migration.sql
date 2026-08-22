-- Hierarchical task memory: additive layer only (no changes to existing tables).
CREATE TABLE "TimeDigest" (
    "id" TEXT NOT NULL,
    "ownerChatId" BIGINT NOT NULL,
    "level" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "content" JSONB NOT NULL,
    "text" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeDigest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TimeDigest_ownerChatId_level_periodStart_key"
  ON "TimeDigest"("ownerChatId", "level", "periodStart");
CREATE INDEX "TimeDigest_ownerChatId_level_idx" ON "TimeDigest"("ownerChatId", "level");

CREATE TABLE "UserPortrait" (
    "ownerChatId" BIGINT NOT NULL,
    "core" JSONB NOT NULL,
    "recent" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPortrait_pkey" PRIMARY KEY ("ownerChatId")
);

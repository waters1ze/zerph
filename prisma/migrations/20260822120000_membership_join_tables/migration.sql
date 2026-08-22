-- Join tables for project/team membership (audit B7).
-- Replaces denormalized BigInt[] arrays with relational rows:
--   ProjectDB.memberIds  -> ProjectMember
--   Team.memberIds/adminIds -> TeamMember (role column)
-- Arrays stay in place during the expand-contract transition; the app
-- dual-writes until a later cleanup migration drops them.

CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectMember_projectId_chatId_key" ON "ProjectMember"("projectId", "chatId");
CREATE INDEX "ProjectMember_chatId_idx" ON "ProjectMember"("chatId");

CREATE UNIQUE INDEX "TeamMember_teamId_chatId_key" ON "TeamMember"("teamId", "chatId");
CREATE INDEX "TeamMember_chatId_idx" ON "TeamMember"("chatId");

-- Backfill: one row per array element; owners get role='owner'.
INSERT INTO "ProjectMember" ("id", "projectId", "chatId", "role", "createdAt")
SELECT
    md5(random()::text || clock_timestamp()::text || p."id"),
    p."id",
    m.value,
    CASE WHEN p."ownerChatId" = m.value THEN 'owner' ELSE 'member' END,
    now()
FROM "ProjectDB" p
CROSS JOIN LATERAL unnest(p."memberIds") AS m(value)
ON CONFLICT DO NOTHING;

INSERT INTO "TeamMember" ("id", "teamId", "chatId", "role", "createdAt")
SELECT
    md5(random()::text || clock_timestamp()::text || t."id"),
    t."id",
    m.value,
    CASE
        WHEN t."ownerChatId" = m.value THEN 'owner'
        WHEN t."adminIds" @> ARRAY[m.value] THEN 'admin'
        ELSE 'member'
    END,
    now()
FROM "Team" t
CROSS JOIN LATERAL unnest(t."memberIds") AS m(value)
ON CONFLICT DO NOTHING;

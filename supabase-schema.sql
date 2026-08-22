-- ==============================================================================
-- Zerf Note & Tasks — Complete Supabase PostgreSQL Initialization Script
-- Paste and run this script in Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- CreateTable Task
CREATE TABLE IF NOT EXISTS "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'todo',
    "dueDate" TEXT,
    "dueTime" TEXT,
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "assignees" TEXT[],
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "linkedNoteIds" TEXT[],
    "projectId" TEXT,
    "goalId" TEXT,
    "habitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "rawText" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "subtasks" JSONB,
    "repeat" TEXT,
    "reminderOffsetMinutes" INTEGER NOT NULL DEFAULT 0,
    "ownerChatId" BIGINT,
    "authorChatId" BIGINT,
    "completedBy" TEXT,
    "parentTaskId" TEXT,
    "projectDbId" TEXT,
    "remindersSentCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable Goal
CREATE TABLE IF NOT EXISTS "Goal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "motivation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'on_track',
    "deadline" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#2d7a4f',
    "milestones" JSONB,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerChatId" BIGINT,
    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable Note
CREATE TABLE IF NOT EXISTS "Note" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "originalText" TEXT,
    "type" TEXT NOT NULL DEFAULT 'note',
    "tags" TEXT[],
    "dueDate" TEXT,
    "dueTime" TEXT,
    "projectId" TEXT,
    "goalId" TEXT,
    "habitId" TEXT,
    "taskIds" TEXT[],
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "folder" TEXT DEFAULT 'Общее',
    "ownerChatId" BIGINT,
    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable TelegramChat
CREATE TABLE IF NOT EXISTS "TelegramChat" (
    "chatId" BIGINT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "username" TEXT,
    "email" TEXT,
    "passwordHash" TEXT,
    "authProvider" TEXT,
    "vkId" TEXT,
    "googleEmail" TEXT,
    "birthday" TEXT,
    "timezone" TEXT DEFAULT 'Europe/Moscow',
    "reminderIntervalMinutes" INTEGER NOT NULL DEFAULT 5,
    "reminderRepeatCount" INTEGER NOT NULL DEFAULT 0, -- 0 = single notification per task
    "plan" TEXT NOT NULL DEFAULT 'free',
    "subscriptionExpiry" TIMESTAMP(3),
    "voiceCountToday" INTEGER NOT NULL DEFAULT 0,
    "voiceSecondsToday" INTEGER NOT NULL DEFAULT 0,
    "notesCountToday" INTEGER NOT NULL DEFAULT 0,
    "chatMessagesToday" INTEGER NOT NULL DEFAULT 0,
    "lastResetDate" TEXT,
    "lastActiveAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "referredBy" BIGINT,
    "referralCount" INTEGER NOT NULL DEFAULT 0,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "lastStreakDate" TEXT,
    "ttsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramChat_pkey" PRIMARY KEY ("chatId")
);

-- CreateTable Friendship
CREATE TABLE IF NOT EXISTS "Friendship" (
    "id" TEXT NOT NULL,
    "userChatId" BIGINT NOT NULL,
    "friendChatId" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'accepted',
    "allowTasks" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable LoginToken
CREATE TABLE IF NOT EXISTS "LoginToken" (
    "id" TEXT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "token" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable UserSession
CREATE TABLE IF NOT EXISTS "UserSession" (
    "id" TEXT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "deviceName" TEXT,
    "deviceType" TEXT NOT NULL DEFAULT 'web',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable ProjectDB
CREATE TABLE IF NOT EXISTS "ProjectDB" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ownerChatId" BIGINT NOT NULL,
    "memberIds" BIGINT[],
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectDB_pkey" PRIMARY KEY ("id")
);

-- CreateTable GroupMembership
CREATE TABLE IF NOT EXISTS "GroupMembership" (
    "id" TEXT NOT NULL,
    "groupChatId" BIGINT NOT NULL,
    "memberChatId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable Habit
CREATE TABLE IF NOT EXISTS "Habit" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "icon" TEXT,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastCompletedAt" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "ownerChatId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);

-- CreateTable Config
CREATE TABLE IF NOT EXISTS "Config" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Config_pkey" PRIMARY KEY ("key")
);

-- CreateTable ChannelPoll
CREATE TABLE IF NOT EXISTS "ChannelPoll" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "channelId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "date" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "winningOption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable AppActionLog
CREATE TABLE IF NOT EXISTS "AppActionLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "chatId" BIGINT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AppActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable ChannelComment
CREATE TABLE IF NOT EXISTS "ChannelComment" (
    "id" TEXT NOT NULL,
    "channelPostId" INTEGER,
    "chatId" BIGINT,
    "userName" TEXT,
    "text" TEXT NOT NULL,
    "sentiment" TEXT,
    "isAnalyzed" BOOLEAN NOT NULL DEFAULT false,
    "analyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable PromoCode
CREATE TABLE IF NOT EXISTS "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountPercent" INTEGER NOT NULL DEFAULT 100,
    "targetPlan" TEXT NOT NULL DEFAULT 'all',
    "durationDays" INTEGER NOT NULL DEFAULT 30,
    "maxActivations" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "usedByChatIds" TEXT[],
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "TelegramChat_email_key" ON "TelegramChat"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Friendship_userChatId_friendChatId_key" ON "Friendship"("userChatId", "friendChatId");
CREATE UNIQUE INDEX IF NOT EXISTS "LoginToken_token_key" ON "LoginToken"("token");
CREATE INDEX IF NOT EXISTS "LoginToken_chatId_idx" ON "LoginToken"("chatId");
CREATE INDEX IF NOT EXISTS "LoginToken_token_idx" ON "LoginToken"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "UserSession_sessionToken_key" ON "UserSession"("sessionToken");
CREATE INDEX IF NOT EXISTS "UserSession_chatId_idx" ON "UserSession"("chatId");
CREATE INDEX IF NOT EXISTS "UserSession_sessionToken_idx" ON "UserSession"("sessionToken");
CREATE UNIQUE INDEX IF NOT EXISTS "GroupMembership_groupChatId_memberChatId_key" ON "GroupMembership"("groupChatId", "memberChatId");
CREATE UNIQUE INDEX IF NOT EXISTS "ChannelPoll_pollId_key" ON "ChannelPoll"("pollId");
CREATE INDEX IF NOT EXISTS "ChannelComment_isAnalyzed_idx" ON "ChannelComment"("isAnalyzed");
CREATE UNIQUE INDEX IF NOT EXISTS "PromoCode_code_key" ON "PromoCode"("code");

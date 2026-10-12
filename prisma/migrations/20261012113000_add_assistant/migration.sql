-- CreateEnum
CREATE TYPE "AssistantRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "AssistantToolStatus" AS ENUM ('OK', 'ERROR', 'DENIED');

-- CreateEnum
CREATE TYPE "AssistantExportStatus" AS ENUM ('COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "assistant_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "activeClubId" UUID,
    "pending" JSONB,
    "processingClientRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_messages" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "AssistantRole" NOT NULL,
    "content" TEXT NOT NULL,
    "scene" TEXT,
    "clientRequestId" TEXT,
    "replyToMessageId" UUID,
    "exportId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_tool_calls" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tool" TEXT NOT NULL,
    "clubId" UUID,
    "status" "AssistantToolStatus" NOT NULL,
    "errorCode" TEXT,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_tool_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_exports" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "clubName" TEXT NOT NULL,
    "objectName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL,
    "status" "AssistantExportStatus" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assistant_sessions_userId_updatedAt_idx" ON "assistant_sessions"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "assistant_messages_sessionId_createdAt_idx" ON "assistant_messages"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "assistant_messages_userId_createdAt_idx" ON "assistant_messages"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "assistant_messages_sessionId_clientRequestId_key" ON "assistant_messages"("sessionId", "clientRequestId");

-- CreateIndex
CREATE INDEX "assistant_tool_calls_userId_createdAt_idx" ON "assistant_tool_calls"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "assistant_tool_calls_sessionId_createdAt_idx" ON "assistant_tool_calls"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "assistant_exports_userId_createdAt_idx" ON "assistant_exports"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "assistant_sessions" ADD CONSTRAINT "assistant_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "assistant_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_tool_calls" ADD CONSTRAINT "assistant_tool_calls_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "assistant_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_exports" ADD CONSTRAINT "assistant_exports_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "assistant_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

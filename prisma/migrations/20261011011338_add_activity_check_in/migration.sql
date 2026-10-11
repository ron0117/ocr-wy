-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('PUBLISHED', 'ENDED');

-- CreateEnum
CREATE TYPE "RecipientKind" AS ENUM ('PARTY', 'TAG', 'USER');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('PUBLISH', 'REMIND');

-- CreateEnum
CREATE TYPE "NotificationTrigger" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SENT', 'FAILED');

-- AlterTable
ALTER TABLE "clubs" ADD COLUMN     "wecomTeamId" UUID;

-- CreateTable
CREATE TABLE "wecom_teams" (
    "id" UUID NOT NULL,
    "corpId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '企业微信团队',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wecom_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "wecomTeamId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "remindAt" TIMESTAMP(3),
    "status" "ActivityStatus" NOT NULL DEFAULT 'PUBLISHED',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "remindClaimedAt" TIMESTAMP(3),

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_clubs" (
    "activityId" UUID NOT NULL,
    "clubId" UUID NOT NULL,

    CONSTRAINT "activity_clubs_pkey" PRIMARY KEY ("activityId","clubId")
);

-- CreateTable
CREATE TABLE "activity_recipients" (
    "activityId" UUID NOT NULL,
    "kind" "RecipientKind" NOT NULL,
    "wecomId" TEXT NOT NULL,

    CONSTRAINT "activity_recipients_pkey" PRIMARY KEY ("activityId","kind","wecomId")
);

-- CreateTable
CREATE TABLE "wecom_bindings" (
    "id" UUID NOT NULL,
    "wecomTeamId" UUID NOT NULL,
    "wecomUserId" TEXT NOT NULL,
    "memberId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wecom_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_check_ins" (
    "activityId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "wecomUserId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_check_ins_pkey" PRIMARY KEY ("activityId","memberId")
);

-- CreateTable
CREATE TABLE "activity_notifications" (
    "id" UUID NOT NULL,
    "activityId" UUID NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "trigger" "NotificationTrigger" NOT NULL,
    "status" "NotificationStatus" NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wecom_teams_corpId_key" ON "wecom_teams"("corpId");

-- CreateIndex
CREATE INDEX "activities_userId_publishedAt_idx" ON "activities"("userId", "publishedAt");

-- CreateIndex
CREATE INDEX "activities_status_remindAt_idx" ON "activities"("status", "remindAt");

-- CreateIndex
CREATE INDEX "activity_clubs_clubId_idx" ON "activity_clubs"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "wecom_bindings_memberId_key" ON "wecom_bindings"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "wecom_bindings_wecomTeamId_wecomUserId_key" ON "wecom_bindings"("wecomTeamId", "wecomUserId");

-- CreateIndex
CREATE UNIQUE INDEX "activity_check_ins_activityId_wecomUserId_key" ON "activity_check_ins"("activityId", "wecomUserId");

-- CreateIndex
CREATE INDEX "activity_notifications_activityId_createdAt_idx" ON "activity_notifications"("activityId", "createdAt");

-- AddForeignKey
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_wecomTeamId_fkey" FOREIGN KEY ("wecomTeamId") REFERENCES "wecom_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_wecomTeamId_fkey" FOREIGN KEY ("wecomTeamId") REFERENCES "wecom_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_clubs" ADD CONSTRAINT "activity_clubs_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_clubs" ADD CONSTRAINT "activity_clubs_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_recipients" ADD CONSTRAINT "activity_recipients_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wecom_bindings" ADD CONSTRAINT "wecom_bindings_wecomTeamId_fkey" FOREIGN KEY ("wecomTeamId") REFERENCES "wecom_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wecom_bindings" ADD CONSTRAINT "wecom_bindings_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_check_ins" ADD CONSTRAINT "activity_check_ins_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_check_ins" ADD CONSTRAINT "activity_check_ins_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_notifications" ADD CONSTRAINT "activity_notifications_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

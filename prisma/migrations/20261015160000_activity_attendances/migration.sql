ALTER TABLE "activities" ALTER COLUMN "wecomTeamId" DROP NOT NULL;

CREATE TABLE "activity_attendances" (
    "id" UUID NOT NULL,
    "activityId" UUID NOT NULL,
    "memberId" UUID,
    "clubId" UUID NOT NULL,
    "playerName" TEXT NOT NULL,
    "late" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_attendances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "activity_attendances_activityId_memberId_key" ON "activity_attendances"("activityId", "memberId");
CREATE UNIQUE INDEX "activity_attendances_activityId_clubId_playerName_key" ON "activity_attendances"("activityId", "clubId", "playerName");
CREATE INDEX "activity_attendances_clubId_playerName_idx" ON "activity_attendances"("clubId", "playerName");
CREATE INDEX "activity_attendances_memberId_idx" ON "activity_attendances"("memberId");

ALTER TABLE "activity_attendances" ADD CONSTRAINT "activity_attendances_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_attendances" ADD CONSTRAINT "activity_attendances_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "activity_attendances" ADD CONSTRAINT "activity_attendances_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

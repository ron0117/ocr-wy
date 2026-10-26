-- CreateEnum
CREATE TYPE "RegistrationProfession" AS ENUM ('AUDIENCE', 'SUN', 'FOOL', 'WARRIOR', 'APPRENTICE', 'DIVINATION');

-- CreateEnum
CREATE TYPE "RegistrationAttendanceStatus" AS ENUM ('NORMAL', 'LATE', 'ABSENT');

-- CreateTable
CREATE TABLE "activity_registrations" (
    "id" UUID NOT NULL,
    "activityId" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "playerName" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "profession" "RegistrationProfession" NOT NULL,
    "attendanceStatus" "RegistrationAttendanceStatus" NOT NULL DEFAULT 'NORMAL',
    "submitIp" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_registrations_activityId_createdAt_idx" ON "activity_registrations"("activityId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_registrations_activityId_submitIp_idx" ON "activity_registrations"("activityId", "submitIp");

-- CreateIndex
CREATE UNIQUE INDEX "activity_registrations_activityId_clubId_playerName_key" ON "activity_registrations"("activityId", "clubId", "playerName");

-- AddForeignKey
ALTER TABLE "activity_registrations" ADD CONSTRAINT "activity_registrations_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_registrations" ADD CONSTRAINT "activity_registrations_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "ApplicationDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "clubId" UUID,
    "clubName" TEXT NOT NULL,
    "gameName" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "uid" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "decision" "ApplicationDecision" NOT NULL DEFAULT 'PENDING',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "applications_clubId_readAt_createdAt_idx" ON "applications"("clubId", "readAt", "createdAt");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

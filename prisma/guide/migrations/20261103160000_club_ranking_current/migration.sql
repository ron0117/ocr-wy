-- CreateTable
CREATE TABLE "club_ranking_current" (
    "id" TEXT NOT NULL,
    "clubs" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "club_ranking_current_pkey" PRIMARY KEY ("id")
);

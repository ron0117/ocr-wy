-- AlterTable
ALTER TABLE "GuideArticle" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SharedBuild" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;

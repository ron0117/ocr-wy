-- CreateTable
CREATE TABLE "GuideArticle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "summary" VARCHAR(500),
    "bodyHtml" TEXT NOT NULL,
    "coverUrl" TEXT,
    "pathwaySlug" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuideArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuideArticle_slug_key" ON "GuideArticle"("slug");

-- CreateIndex
CREATE INDEX "GuideArticle_createdAt_idx" ON "GuideArticle"("createdAt");

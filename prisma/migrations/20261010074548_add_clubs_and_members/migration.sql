-- CreateTable
CREATE TABLE "clubs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "leader" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "playerName" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "level" INTEGER,
    "path" TEXT,
    "score" INTEGER,
    "fashion" INTEGER,
    "weeklyActivity" INTEGER,
    "joinedText" TEXT,
    "previousRank" INTEGER,
    "previousScore" INTEGER,
    "dataUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "objectName" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clubs_userId_createdAt_idx" ON "clubs"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "clubs_userId_name_key" ON "clubs"("userId", "name");

-- CreateIndex
CREATE INDEX "members_clubId_rank_idx" ON "members"("clubId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "members_clubId_playerName_key" ON "members"("clubId", "playerName");

-- CreateIndex
CREATE INDEX "import_batches_clubId_createdAt_idx" ON "import_batches"("clubId", "createdAt");

-- AddForeignKey
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

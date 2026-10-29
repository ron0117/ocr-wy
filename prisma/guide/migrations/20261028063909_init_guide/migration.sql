-- CreateEnum
CREATE TYPE "GearSlot" AS ENUM ('HEAD', 'CHEST', 'LEGS', 'FEET', 'HANDS', 'WEAPON', 'OFFHAND', 'ACCESSORY', 'SEAL');

-- CreateEnum
CREATE TYPE "GearRarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "SkillType" AS ENUM ('ACTIVE', 'PASSIVE', 'ULT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ImportRunStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "GameVersion" (
    "id" TEXT NOT NULL,
    "semver" TEXT NOT NULL,
    "label" TEXT,
    "releasedAt" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pathway" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceNote" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "isStale" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Pathway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayScenario" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceNote" TEXT,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "PlayScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pathwayId" TEXT,
    "skillType" "SkillType" NOT NULL DEFAULT 'UNKNOWN',
    "iconRef" TEXT,
    "cooldownMs" INTEGER,
    "energyCost" INTEGER,
    "tags" JSONB,
    "sourceNote" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "isStale" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GearSet" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "effects" JSONB NOT NULL,
    "sourceNote" TEXT,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "GearSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gear" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slot" "GearSlot" NOT NULL,
    "rarity" "GearRarity" NOT NULL DEFAULT 'COMMON',
    "baseStats" JSONB NOT NULL,
    "affixes" JSONB NOT NULL DEFAULT '[]',
    "setId" TEXT,
    "restrictions" JSONB,
    "sourceNote" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "isStale" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Gear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendedLoadout" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "pathwayId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "gearSlots" JSONB NOT NULL,
    "skillBar" JSONB,
    "comboSteps" JSONB NOT NULL,
    "notes" TEXT,
    "sourceNote" TEXT,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "RecommendedLoadout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedBuild" (
    "id" VARCHAR(16) NOT NULL,
    "versionId" TEXT NOT NULL,
    "pathwayId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "gearSlots" JSONB NOT NULL,
    "comboSteps" JSONB NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "SharedBuild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "versionId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "manifestHash" TEXT,
    "gameVersion" TEXT,
    "status" "ImportRunStatus" NOT NULL,
    "log" TEXT,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pathway_versionId_idx" ON "Pathway"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "Pathway_versionId_slug_key" ON "Pathway"("versionId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Pathway_versionId_externalId_key" ON "Pathway"("versionId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayScenario_versionId_code_key" ON "PlayScenario"("versionId", "code");

-- CreateIndex
CREATE INDEX "Skill_pathwayId_idx" ON "Skill"("pathwayId");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_versionId_slug_key" ON "Skill"("versionId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_versionId_externalId_key" ON "Skill"("versionId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "GearSet_versionId_name_key" ON "GearSet"("versionId", "name");

-- CreateIndex
CREATE INDEX "Gear_versionId_slot_idx" ON "Gear"("versionId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "Gear_versionId_slug_key" ON "Gear"("versionId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendedLoadout_versionId_slug_key" ON "RecommendedLoadout"("versionId", "slug");

-- CreateIndex
CREATE INDEX "SharedBuild_createdAt_idx" ON "SharedBuild"("createdAt");

-- AddForeignKey
ALTER TABLE "Pathway" ADD CONSTRAINT "Pathway_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "GameVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayScenario" ADD CONSTRAINT "PlayScenario_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "GameVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "GameVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "Pathway"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GearSet" ADD CONSTRAINT "GearSet_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "GameVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gear" ADD CONSTRAINT "Gear_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "GameVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gear" ADD CONSTRAINT "Gear_setId_fkey" FOREIGN KEY ("setId") REFERENCES "GearSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendedLoadout" ADD CONSTRAINT "RecommendedLoadout_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "GameVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendedLoadout" ADD CONSTRAINT "RecommendedLoadout_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "Pathway"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendedLoadout" ADD CONSTRAINT "RecommendedLoadout_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "PlayScenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedBuild" ADD CONSTRAINT "SharedBuild_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "GameVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedBuild" ADD CONSTRAINT "SharedBuild_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "Pathway"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedBuild" ADD CONSTRAINT "SharedBuild_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "PlayScenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "GameVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

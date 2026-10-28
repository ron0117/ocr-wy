-- 连招码改为保存完整分享文案，移除旧配装 JSON 分享
DELETE FROM "SharedBuild";

ALTER TABLE "SharedBuild" DROP COLUMN IF EXISTS "gearSlots";
ALTER TABLE "SharedBuild" DROP COLUMN IF EXISTS "comboSteps";
ALTER TABLE "SharedBuild" DROP COLUMN IF EXISTS "expiresAt";

ALTER TABLE "SharedBuild" ADD COLUMN "shareText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SharedBuild" ADD COLUMN "authorName" TEXT;
ALTER TABLE "SharedBuild" ADD COLUMN "comboStepCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "SharedBuild" ALTER COLUMN "shareText" DROP DEFAULT;

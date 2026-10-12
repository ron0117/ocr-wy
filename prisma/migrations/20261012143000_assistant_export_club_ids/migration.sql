ALTER TABLE "assistant_exports" ADD COLUMN "clubIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isSuper" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_menus" (
    "roleId" UUID NOT NULL,
    "menuKey" TEXT NOT NULL,

    CONSTRAINT "role_menus_pkey" PRIMARY KEY ("roleId","menuKey")
);

-- CreateTable
CREATE TABLE "role_clubs" (
    "roleId" UUID NOT NULL,
    "clubId" UUID NOT NULL,

    CONSTRAINT "role_clubs_pkey" PRIMARY KEY ("roleId","clubId")
);

-- AlterTable
ALTER TABLE "users" ADD COLUMN "roleId" UUID,
ADD COLUMN "disabled" BOOLEAN NOT NULL DEFAULT false;

-- 只在这次迁移停用已有账号，启动时不再重复执行
UPDATE "users" SET "disabled" = true;

-- 删除账号时保留俱乐部、导入记录和活动
ALTER TABLE "clubs" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "clubs" DROP CONSTRAINT "clubs_userId_fkey";
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "import_batches" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "import_batches" DROP CONSTRAINT "import_batches_userId_fkey";
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "activities" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "activities" DROP CONSTRAINT "activities_userId_fkey";
ALTER TABLE "activities" ADD CONSTRAINT "activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "users_roleId_idx" ON "users"("roleId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_menus" ADD CONSTRAINT "role_menus_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_clubs" ADD CONSTRAINT "role_clubs_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_clubs" ADD CONSTRAINT "role_clubs_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

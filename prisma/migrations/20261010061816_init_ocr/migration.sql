-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('UPLOADED', 'OCR_PROCESSING', 'OCR_COMPLETED', 'AI_PROCESSING', 'REVIEW_REQUIRED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('SOURCE_IMAGE', 'OCR_JSON', 'STRUCTURED_JSON', 'EXCEL');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_tasks" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'UPLOADED',
    "templateId" UUID,
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "dataVersion" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ocr_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_images" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "resourceId" UUID NOT NULL,
    "pageIndex" INTEGER NOT NULL DEFAULT 0,
    "ocrText" TEXT NOT NULL DEFAULT '',
    "ocrJson" JSONB,
    "meanConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_records" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "price" DECIMAL(12,2),
    "quantity" DECIMAL(12,3),
    "total" DECIMAL(14,2),
    "unit" TEXT,
    "confidence" DOUBLE PRECISION,
    "rawText" TEXT,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ocr_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_revisions" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "record_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_templates" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "schema" JSONB NOT NULL,
    "prompt" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ocr_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_files" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "type" "ResourceType" NOT NULL,
    "objectName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "originalName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_jobs" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'PENDING',
    "resourceId" UUID,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "ocr_tasks_userId_createdAt_idx" ON "ocr_tasks"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ocr_tasks_status_updatedAt_idx" ON "ocr_tasks"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ocr_tasks_userId_idempotencyKey_key" ON "ocr_tasks"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ocr_images_taskId_pageIndex_idx" ON "ocr_images"("taskId", "pageIndex");

-- CreateIndex
CREATE INDEX "ocr_records_taskId_idx" ON "ocr_records"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "ocr_records_taskId_rowIndex_key" ON "ocr_records"("taskId", "rowIndex");

-- CreateIndex
CREATE INDEX "record_revisions_taskId_version_idx" ON "record_revisions"("taskId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "record_revisions_taskId_version_key" ON "record_revisions"("taskId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ocr_templates_userId_name_key" ON "ocr_templates"("userId", "name");

-- CreateIndex
CREATE INDEX "ai_messages_taskId_createdAt_idx" ON "ai_messages"("taskId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "resource_files_objectName_key" ON "resource_files"("objectName");

-- CreateIndex
CREATE INDEX "resource_files_taskId_type_idx" ON "resource_files"("taskId", "type");

-- CreateIndex
CREATE INDEX "export_jobs_taskId_createdAt_idx" ON "export_jobs"("taskId", "createdAt");

-- AddForeignKey
ALTER TABLE "ocr_tasks" ADD CONSTRAINT "ocr_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_tasks" ADD CONSTRAINT "ocr_tasks_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ocr_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_images" ADD CONSTRAINT "ocr_images_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ocr_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_records" ADD CONSTRAINT "ocr_records_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ocr_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_revisions" ADD CONSTRAINT "record_revisions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ocr_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_templates" ADD CONSTRAINT "ocr_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ocr_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_files" ADD CONSTRAINT "resource_files_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ocr_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ocr_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

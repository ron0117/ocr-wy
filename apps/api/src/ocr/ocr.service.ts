import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { groupRows } from '../common/extract-table';
import { PrismaService } from '../prisma/prisma.module';
import { StorageService } from '../storage/storage.service';
import { TasksService } from '../tasks/tasks.service';
import { OcrClient } from './ocr.client';
import type { Prisma } from '@prisma/client';

const RECOGNIZE_FROM = ['UPLOADED', 'OCR_COMPLETED', 'REVIEW_REQUIRED', 'COMPLETED', 'FAILED'] as const;

@Injectable()
export class OcrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly tasks: TasksService,
    private readonly client: OcrClient,
  ) {}

  async recognizeTask(taskId: string, userId: string, force = false) {
    const task = await this.tasks.assertOwnedBy(taskId, userId);
    if (!RECOGNIZE_FROM.includes(task.status as (typeof RECOGNIZE_FROM)[number])) {
      throw new ConflictException('任务正在处理或当前状态不能识别');
    }

    const images = await this.prisma.ocrImage.findMany({
      where: { taskId },
      orderBy: { pageIndex: 'asc' },
    });
    if (images.length === 0) throw new BadRequestException('请先上传图片');

    const locked = await this.prisma.ocrTask.updateMany({
      where: { id: taskId, userId, status: { in: [...RECOGNIZE_FROM] } },
      data: { status: 'OCR_PROCESSING', errorCode: null, errorMessage: null },
    });
    if (locked.count !== 1) throw new ConflictException('任务正在处理中');

    try {
      for (const image of images) {
        if (!force && image.ocrText.trim()) continue;
        const resource = await this.prisma.resourceFile.findFirst({
          where: { id: image.resourceId, taskId },
        });
        if (!resource) throw new BadRequestException('图片资源缺失');
        const buffer = await this.storage.download(resource.objectName);
        const result = await this.client.recognize(buffer, resource.originalName || 'image.png');
        const confidenceValues = result.lines.map((line) => line.confidence);
        const meanConfidence =
          confidenceValues.length === 0
            ? null
            : confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length;
        const tableRows = groupRows(result.lines).map((row) =>
          row.map((cell) => ({ text: cell.text, confidence: cell.confidence })),
        );
        const ocrJson = {
          text: result.text,
          lines: result.lines,
          tableRows,
        };
        const objectName = `ocr/${userId}/${taskId}/ocr/${randomUUID()}.json`;
        const payload = Buffer.from(JSON.stringify(ocrJson));
        const stored = await this.storage.upload(objectName, payload, 'application/json');
        try {
          await this.prisma.$transaction([
            this.prisma.resourceFile.create({
              data: {
                taskId,
                type: 'OCR_JSON',
                objectName,
                contentType: 'application/json',
                sizeBytes: BigInt(stored.sizeBytes),
                sha256: stored.sha256,
                originalName: `${image.id}.json`,
              },
            }),
            this.prisma.ocrImage.update({
              where: { id: image.id },
              data: {
                ocrText: result.text,
                ocrJson: ocrJson as unknown as Prisma.InputJsonValue,
                meanConfidence,
              },
            }),
          ]);
        } catch (error) {
          await this.storage.remove(objectName);
          throw error;
        }
      }

      await this.prisma.ocrTask.update({
        where: { id: taskId },
        data: { status: 'OCR_COMPLETED', errorCode: null, errorMessage: null },
      });
      return this.tasks.getDetail(taskId, userId);
    } catch (error) {
      const message = error instanceof HttpException ? error.message : 'OCR 识别失败，请稍后重试';
      await this.prisma.ocrTask.update({
        where: { id: taskId },
        data: { status: 'FAILED', errorCode: 'OCR_FAILED', errorMessage: message },
      });
      throw error;
    }
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { detectImageType, sanitizeFilename } from '../common/image';
import { PrismaService } from '../prisma/prisma.module';
import { StorageService } from '../storage/storage.service';
import type { CreateTaskDto } from './dto';

const BUSY: Array<'OCR_PROCESSING' | 'AI_PROCESSING'> = ['OCR_PROCESSING', 'AI_PROCESSING'];

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(userId: string, limit = 50) {
    const tasks = await this.prisma.ocrTask.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { template: { select: { name: true } } },
    });
    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      templateName: task.template?.name ?? null,
      sourceCount: task.sourceCount,
      dataVersion: task.dataVersion,
      errorMessage: task.errorMessage,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }));
  }

  async create(userId: string, dto: CreateTaskDto, idempotencyKey?: string) {
    if (idempotencyKey && !/^[A-Za-z0-9_-]{8,80}$/.test(idempotencyKey)) {
      throw new BadRequestException('Idempotency-Key 格式不正确');
    }
    if (dto.templateId) {
      const template = await this.prisma.ocrTemplate.findFirst({
        where: { id: dto.templateId, userId },
      });
      if (!template) throw new NotFoundException('模板不存在');
    }
    if (idempotencyKey) {
      const existing = await this.prisma.ocrTask.findFirst({
        where: { userId, idempotencyKey },
      });
      if (existing) return this.getDetail(existing.id, userId);
    }

    try {
      const task = await this.prisma.ocrTask.create({
        data: {
          userId,
          title: dto.title.trim(),
          templateId: dto.templateId ?? null,
          idempotencyKey: idempotencyKey ?? null,
        },
      });
      return this.getDetail(task.id, userId);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        idempotencyKey
      ) {
        const existing = await this.prisma.ocrTask.findFirst({
          where: { userId, idempotencyKey },
        });
        if (existing) return this.getDetail(existing.id, userId);
      }
      throw error;
    }
  }

  async assertOwnedBy(taskId: string, userId: string) {
    const task = await this.prisma.ocrTask.findFirst({
      where: { id: taskId, userId },
    });
    if (!task) throw new NotFoundException('任务不存在');
    return task;
  }

  async getDetail(taskId: string, userId: string) {
    const task = await this.prisma.ocrTask.findFirst({
      where: { id: taskId, userId },
      include: {
        template: { select: { id: true, name: true } },
        images: { orderBy: { pageIndex: 'asc' } },
        exports: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!task) throw new NotFoundException('任务不存在');
    return {
      id: task.id,
      title: task.title,
      status: task.status,
      templateId: task.templateId,
      templateName: task.template?.name ?? null,
      sourceCount: task.sourceCount,
      dataVersion: task.dataVersion,
      errorCode: task.errorCode,
      errorMessage: task.errorMessage,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      images: task.images.map((image) => ({
        id: image.id,
        pageIndex: image.pageIndex,
        resourceId: image.resourceId,
        ocrText: image.ocrText,
        ocrJson: image.ocrJson,
        meanConfidence: image.meanConfidence,
      })),
      exports: task.exports.map((item) => ({
        id: item.id,
        status: item.status,
        resourceId: item.resourceId,
        errorMessage: item.errorMessage,
        createdAt: item.createdAt,
        completedAt: item.completedAt,
      })),
    };
  }

  assertIdle(status: string) {
    if (BUSY.includes(status as (typeof BUSY)[number])) {
      throw new ConflictException('任务正在处理中');
    }
  }

  async addImage(taskId: string, userId: string, file: Express.Multer.File) {
    const task = await this.assertOwnedBy(taskId, userId);
    this.assertIdle(task.status);
    const detected = await detectImageType(file.buffer);
    if (!detected) {
      throw new BadRequestException('仅支持 PNG、JPEG、WebP 图片');
    }

    const imageId = randomUUID();
    const objectName = `ocr/${userId}/${taskId}/source/${imageId}.${detected.ext}`;
    const stored = await this.storage.upload(objectName, file.buffer, detected.mime);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.ocrTask.findFirst({ where: { id: taskId, userId } });
        if (!current) throw new NotFoundException('任务不存在');
        const resource = await tx.resourceFile.create({
          data: {
            taskId,
            type: 'SOURCE_IMAGE',
            objectName,
            contentType: detected.mime,
            sizeBytes: BigInt(stored.sizeBytes),
            sha256: stored.sha256,
            originalName: sanitizeFilename(file.originalname || `image.${detected.ext}`),
          },
        });
        const image = await tx.ocrImage.create({
          data: {
            id: imageId,
            taskId,
            resourceId: resource.id,
            pageIndex: current.sourceCount,
          },
        });
        await tx.ocrTask.update({
          where: { id: taskId },
          data: { sourceCount: { increment: 1 } },
        });
        return {
          imageId: image.id,
          resourceId: resource.id,
          sizeBytes: stored.sizeBytes,
        };
      });
    } catch (error) {
      await this.storage.remove(objectName);
      throw error;
    }
  }

  async complete(taskId: string, userId: string) {
    const task = await this.assertOwnedBy(taskId, userId);
    if (!['REVIEW_REQUIRED', 'OCR_COMPLETED', 'COMPLETED'].includes(task.status)) {
      throw new ConflictException('当前状态不能确认完成');
    }
    const count = await this.prisma.ocrRecord.count({ where: { taskId } });
    if (count === 0) throw new BadRequestException('还没有可确认的商品数据');
    await this.prisma.ocrTask.update({
      where: { id: taskId },
      data: { status: 'COMPLETED', errorCode: null, errorMessage: null },
    });
    return this.getDetail(taskId, userId);
  }
}

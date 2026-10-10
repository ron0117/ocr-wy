import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { sanitizeFilename } from '../common/image';
import { PrismaService } from '../prisma/prisma.module';
import { RecordsService } from '../records/records.service';
import { ResourcesService } from '../resources/resources.service';
import { StorageService } from '../storage/storage.service';
import { TasksService } from '../tasks/tasks.service';
import { EXCEL_MIME, ExcelService } from './excel.service';

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly records: RecordsService,
    private readonly storage: StorageService,
    private readonly excel: ExcelService,
    private readonly resources: ResourcesService,
  ) {}

  async create(taskId: string, userId: string) {
    const task = await this.tasks.assertOwnedBy(taskId, userId);
    this.tasks.assertIdle(task.status);
    const records = await this.records.list(taskId);
    if (records.length === 0) throw new BadRequestException('没有可导出的商品数据');

    const exportId = randomUUID();
    await this.prisma.exportJob.create({
      data: { id: exportId, taskId, status: 'PROCESSING' },
    });

    const objectName = `ocr/${userId}/${taskId}/exports/${exportId}.xlsx`;
    try {
      const buffer = this.excel.generate(
        records.map((record) => ({
          productName: record.productName,
          price: record.price,
          quantity: record.quantity,
          unit: record.unit,
          warnings: record.warnings,
        })),
      );
      const stored = await this.storage.upload(objectName, buffer, EXCEL_MIME);
      try {
        const resource = await this.prisma.resourceFile.create({
          data: {
            taskId,
            type: 'EXCEL',
            objectName,
            contentType: EXCEL_MIME,
            sizeBytes: BigInt(stored.sizeBytes),
            sha256: stored.sha256,
            originalName: sanitizeFilename(`${task.title || '商品清单'}.xlsx`),
          },
        });
        await this.prisma.exportJob.update({
          where: { id: exportId },
          data: {
            status: 'COMPLETED',
            resourceId: resource.id,
            completedAt: new Date(),
          },
        });
        return { exportId, resourceId: resource.id };
      } catch (error) {
        await this.storage.remove(objectName);
        throw error;
      }
    } catch (error) {
      await this.prisma.exportJob.update({
        where: { id: exportId },
        data: { status: 'FAILED', errorMessage: 'Excel 生成失败' },
      });
      if (error instanceof BadRequestException || error instanceof ConflictException) throw error;
      throw error;
    }
  }

  async read(exportId: string, userId: string) {
    const job = await this.prisma.exportJob.findUnique({
      where: { id: exportId },
      include: { task: true },
    });
    if (!job || job.task.userId !== userId) throw new NotFoundException('导出记录不存在');
    if (job.status !== 'COMPLETED' || !job.resourceId) {
      throw new ConflictException('文件尚未生成');
    }
    return this.resources.read(job.resourceId, userId);
  }
}

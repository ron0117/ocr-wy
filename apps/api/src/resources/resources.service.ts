import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { StorageService } from '../storage/storage.service';
import { TasksService } from '../tasks/tasks.service';

@Injectable()
export class ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly tasks: TasksService,
  ) {}

  private async findOwned(resourceId: string, userId: string) {
    const resource = await this.prisma.resourceFile.findUnique({
      where: { id: resourceId },
      include: { task: true },
    });
    if (!resource || resource.task.userId !== userId) {
      throw new NotFoundException('资源不存在');
    }
    return resource;
  }

  async list(taskId: string, userId: string) {
    await this.tasks.assertOwnedBy(taskId, userId);
    const files = await this.prisma.resourceFile.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    });
    return files.map((file) => ({
      id: file.id,
      type: file.type,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes.toString(),
      originalName: file.originalName,
      createdAt: file.createdAt,
    }));
  }

  async read(resourceId: string, userId: string) {
    const resource = await this.findOwned(resourceId, userId);
    const buffer = await this.storage.download(resource.objectName);
    return { buffer, resource };
  }

  async signedUrl(resourceId: string, userId: string) {
    const resource = await this.findOwned(resourceId, userId);
    if (!this.storage.supportsSignedUrl) {
      throw new BadRequestException('当前存储驱动不提供签名 URL，请使用下载接口');
    }
    const url = await this.storage.createReadUrl(resource.objectName);
    return { url, expiresInSeconds: 300 };
  }
}

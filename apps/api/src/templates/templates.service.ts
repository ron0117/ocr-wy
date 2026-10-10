import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import type { CreateTemplateDto } from './dto';
import { DEFAULT_TEMPLATE_SCHEMA } from './schema';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const templates = await this.prisma.ocrTemplate.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return templates.map((template) => this.present(template));
  }

  async create(userId: string, dto: CreateTemplateDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.isDefault) {
          await tx.ocrTemplate.updateMany({
            where: { userId, isDefault: true },
            data: { isDefault: false },
          });
        }
        const template = await tx.ocrTemplate.create({
          data: {
            userId,
            name: dto.name.trim(),
            description: dto.description?.trim() || null,
            prompt: dto.prompt?.trim() || null,
            isDefault: dto.isDefault === true,
            schema: DEFAULT_TEMPLATE_SCHEMA as unknown as Prisma.InputJsonValue,
          },
        });
        return this.present(template);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('模板名称已存在');
      }
      throw error;
    }
  }

  async remove(userId: string, templateId: string) {
    const template = await this.prisma.ocrTemplate.findFirst({
      where: { id: templateId, userId },
    });
    if (!template) throw new NotFoundException('模板不存在');
    await this.prisma.ocrTemplate.delete({ where: { id: templateId } });
    return { ok: true };
  }

  private present(template: {
    id: string;
    name: string;
    description: string | null;
    schema: Prisma.JsonValue;
    prompt: string | null;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      schema: template.schema,
      prompt: template.prompt,
      isDefault: template.isDefault,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }
}

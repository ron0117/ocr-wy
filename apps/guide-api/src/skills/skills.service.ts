import { Injectable, NotFoundException } from '@nestjs/common';
import type { SkillDto } from '@ocr/guide-types';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  private async currentVersionId() {
    const version = await this.prisma.gameVersion.findFirst({
      where: { isCurrent: true },
    });
    if (!version) throw new NotFoundException('尚未导入游戏版本数据');
    return version.id;
  }

  private mapRow(row: {
    slug: string;
    name: string;
    externalId: string;
    skillType: string;
    pathway: { slug: string } | null;
  }): SkillDto {
    return {
      slug: row.slug,
      name: row.name,
      externalId: row.externalId,
      skillType: row.skillType,
      pathwaySlug: row.pathway?.slug ?? null,
    };
  }

  async list(pathwaySlug?: string): Promise<SkillDto[]> {
    const versionId = await this.currentVersionId();
    const rows = await this.prisma.skill.findMany({
      where: {
        versionId,
        ...(pathwaySlug
          ? { pathway: { slug: pathwaySlug, versionId } }
          : {}),
      },
      include: { pathway: true },
      orderBy: { externalId: 'asc' },
    });
    return rows.map((row) => this.mapRow(row));
  }

  async getBySlug(slug: string): Promise<SkillDto> {
    const versionId = await this.currentVersionId();
    const row = await this.prisma.skill.findFirst({
      where: { versionId, slug },
      include: { pathway: true },
    });
    if (!row) throw new NotFoundException('技能不存在');
    return this.mapRow(row);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import type { PathwayDto, PlayScenarioDto } from '@ocr/guide-types';
import {
  PATHWAY_DEITY_LABEL,
  pathwayProfessionLabel,
  pathwayRouteLabel,
} from '@ocr/guide-types';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class PathwaysService {
  constructor(private readonly prisma: PrismaService) {}

  private async currentVersionId() {
    const version = await this.prisma.gameVersion.findFirst({
      where: { isCurrent: true },
    });
    if (!version) throw new NotFoundException('尚未导入游戏版本数据');
    return version.id;
  }

  async list(): Promise<PathwayDto[]> {
    const versionId = await this.currentVersionId();
    const rows = await this.prisma.pathway.findMany({
      where: { versionId },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((row) => this.mapRow(row));
  }

  async getBySlug(slug: string): Promise<PathwayDto & { scenarios: PlayScenarioDto[] }> {
    const versionId = await this.currentVersionId();
    const row = await this.prisma.pathway.findFirst({
      where: { versionId, slug },
    });
    if (!row) throw new NotFoundException('途径不存在');
    const scenarios = await this.prisma.playScenario.findMany({
      where: { versionId },
      orderBy: { code: 'asc' },
    });
    return {
      ...this.mapRow(row),
      scenarios: scenarios.map((s) => ({ code: s.code, name: s.name })),
    };
  }

  private mapRow(row: {
    slug: string;
    name: string;
    description: string | null;
    externalId: string;
  }): PathwayDto {
    return {
      slug: row.slug,
      name: row.name,
      professionLabel: pathwayProfessionLabel(row.slug, row.name),
      routeLabel: pathwayRouteLabel(row.slug, row.name),
      deityLabel: PATHWAY_DEITY_LABEL[row.slug],
      description: row.description,
      externalId: row.externalId,
    };
  }

  async findIdBySlug(slug: string): Promise<string> {
    const versionId = await this.currentVersionId();
    const row = await this.prisma.pathway.findFirst({
      where: { versionId, slug },
    });
    if (!row) throw new NotFoundException('途径不存在');
    return row.id;
  }
}

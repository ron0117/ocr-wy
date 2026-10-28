import { Injectable, NotFoundException } from '@nestjs/common';
import type { ComboStepDto, LoadoutDto } from '@ocr/guide-types';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class LoadoutsService {
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
    title: string;
    gearSlots: unknown;
    skillBar: unknown;
    comboSteps: unknown;
    sourceNote: string | null;
    verifiedAt: Date | null;
    pathway: { slug: string };
    scenario: { code: string } | null;
  }): LoadoutDto {
    return {
      slug: row.slug,
      title: row.title,
      pathwaySlug: row.pathway.slug,
      scenarioCode: row.scenario?.code ?? null,
      gearSlots: (row.gearSlots ?? {}) as Record<string, string>,
      skillBar: (row.skillBar ?? undefined) as string[] | undefined,
      comboSteps: (row.comboSteps ?? []) as ComboStepDto[],
      sourceNote: row.sourceNote,
      verifiedAt: row.verifiedAt?.toISOString() ?? null,
    };
  }

  async list(pathwaySlug?: string, scenario?: string): Promise<LoadoutDto[]> {
    const versionId = await this.currentVersionId();
    const rows = await this.prisma.recommendedLoadout.findMany({
      where: {
        versionId,
        ...(pathwaySlug ? { pathway: { slug: pathwaySlug, versionId } } : {}),
        ...(scenario ? { scenario: { code: scenario, versionId } } : {}),
      },
      include: { pathway: true, scenario: true },
    });
    return rows.map((row) => this.mapRow(row));
  }

  async getBySlug(slug: string): Promise<LoadoutDto> {
    const versionId = await this.currentVersionId();
    const row = await this.prisma.recommendedLoadout.findFirst({
      where: { versionId, slug },
      include: { pathway: true, scenario: true },
    });
    if (!row) throw new NotFoundException('推荐配装不存在');
    return this.mapRow(row);
  }
}

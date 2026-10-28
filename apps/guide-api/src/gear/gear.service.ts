import { Injectable, NotFoundException } from '@nestjs/common';
import type { GearAffixDto, GearDto, StatMap } from '@ocr/guide-types';
import { GearSlot } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class GearService {
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
    slot: GearSlot;
    rarity: string;
    baseStats: unknown;
    affixes: unknown;
    sourceNote: string | null;
    verifiedAt: Date | null;
    restrictions: unknown;
  }): GearDto {
    const restrictions = row.restrictions as { pathwaySlugs?: string[] } | null;
    return {
      slug: row.slug,
      name: row.name,
      slot: row.slot,
      rarity: row.rarity,
      baseStats: (row.baseStats ?? {}) as StatMap,
      affixes: (row.affixes ?? []) as GearAffixDto[],
      pathwaySlugs: restrictions?.pathwaySlugs,
      sourceNote: row.sourceNote,
      verifiedAt: row.verifiedAt?.toISOString() ?? null,
    };
  }

  async list(pathwaySlug?: string, slot?: string): Promise<GearDto[]> {
    const versionId = await this.currentVersionId();
    const rows = await this.prisma.gear.findMany({
      where: {
        versionId,
        ...(slot ? { slot: slot as GearSlot } : {}),
      },
      orderBy: { slug: 'asc' },
    });
    let mapped = rows.map((row) => this.mapRow(row));
    if (pathwaySlug) {
      mapped = mapped.filter(
        (g) =>
          !g.pathwaySlugs?.length || g.pathwaySlugs.includes(pathwaySlug),
      );
    }
    return mapped;
  }

  async getBySlug(slug: string): Promise<GearDto> {
    const versionId = await this.currentVersionId();
    const row = await this.prisma.gear.findFirst({
      where: { versionId, slug },
    });
    if (!row) throw new NotFoundException('装备不存在');
    return this.mapRow(row);
  }
}

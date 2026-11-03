import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { parseGameSharePaste, pathwayProfessionLabel } from '@ocr/guide-types';
import type {
  ShareCreatedDto,
  ShareDto,
  ShareListPageDto,
} from '@ocr/guide-types';
import { nanoid } from 'nanoid';
import type { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.module';
import { PathwaysService } from '../pathways/pathways.service';
import { CreateShareDto } from './create-share.dto';
import { normalizeDeployedPuppets } from './puppet-names';

function deployedPuppetNames(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

@Injectable()
export class SharesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pathways: PathwaysService,
  ) {}

  private async currentVersionId() {
    const version = await this.prisma.gameVersion.findFirst({
      where: { isCurrent: true },
    });
    if (!version) throw new NotFoundException('尚未导入游戏版本数据');
    return version.id;
  }

  /** `planOverride` 为前端编辑的方案名称，优先于分享码内解析结果 */
  private buildTitle(author: string, parsedPlan?: string, planOverride?: string) {
    const plan = planOverride?.trim() || parsedPlan?.trim();
    const base = author.trim() || '未知分享者';
    return plan ? `${base} · ${plan}` : base;
  }

  async create(dto: CreateShareDto): Promise<ShareCreatedDto> {
    const text = dto.shareText.trim();
    if (!text) throw new BadRequestException('分享文案不能为空');

    let parsed: ReturnType<typeof parseGameSharePaste>;
    try {
      parsed = parseGameSharePaste(text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '分享文案无法解析';
      throw new BadRequestException(msg);
    }

    const versionId = await this.currentVersionId();
    const pathwayId = await this.pathways.findIdBySlug(dto.pathwaySlug);
    let scenarioId: string | undefined;
    if (dto.scenarioCode) {
      const scenario = await this.prisma.playScenario.findFirst({
        where: { versionId, code: dto.scenarioCode },
      });
      if (!scenario) throw new NotFoundException('玩法场景不存在');
      scenarioId = scenario.id;
    }

    const id = nanoid(10);
    const authorName = parsed.author;
    const title = this.buildTitle(authorName, undefined, dto.title);
    const deployedPuppets = normalizeDeployedPuppets(dto.deployedPuppets);

    await this.prisma.sharedBuild.create({
      data: {
        id,
        versionId,
        pathwayId,
        scenarioId,
        shareText: text,
        title,
        authorName,
        comboStepCount: parsed.comboSteps.length,
        deployedPuppets,
      },
    });
    return { id, urlPath: `/codes/${id}` };
  }

  private async listWhere(filters?: {
    pathwaySlug?: string;
    scenarioCode?: string;
  }): Promise<Prisma.SharedBuildWhereInput> {
    const where: Prisma.SharedBuildWhereInput = {};
    const versionId = await this.currentVersionId();

    if (filters?.pathwaySlug) {
      const pathway = await this.prisma.pathway.findFirst({
        where: { versionId, slug: filters.pathwaySlug },
      });
      if (!pathway) return { id: { in: [] } };
      where.pathwayId = pathway.id;
    }

    if (filters?.scenarioCode) {
      const scenario = await this.prisma.playScenario.findFirst({
        where: { versionId, code: filters.scenarioCode },
      });
      if (!scenario) return { id: { in: [] } };
      where.scenarioId = scenario.id;
    }

    return where;
  }

  async list(
    page: number,
    pageSize: number,
    filters?: { pathwaySlug?: string; scenarioCode?: string },
  ): Promise<ShareListPageDto> {
    const where = await this.listWhere(filters);
    const skip = (page - 1) * pageSize;
    const [rows, total] = await Promise.all([
      this.prisma.sharedBuild.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { pathway: true, scenario: true },
      }),
      this.prisma.sharedBuild.count({ where }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      page,
      pageSize,
      total,
      totalPages,
      items: rows.map((row) => ({
        id: row.id,
        title: row.title ?? undefined,
        authorName: row.authorName ?? undefined,
        pathwaySlug: row.pathway.slug,
        pathwayProfessionLabel: pathwayProfessionLabel(
          row.pathway.slug,
          row.pathway.name,
        ),
        scenarioCode: row.scenario?.code,
        scenarioName: row.scenario?.name,
        comboStepCount: row.comboStepCount,
        viewCount: row.viewCount,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  private mapRow(row: {
    id: string;
    shareText: string;
    title: string | null;
    authorName: string | null;
    comboStepCount: number;
    viewCount: number;
    createdAt: Date;
    deployedPuppets: Prisma.JsonValue | null;
    pathway: { slug: string; name: string };
    scenario: { code: string; name: string } | null;
  }): ShareDto {
    return {
      id: row.id,
      pathwaySlug: row.pathway.slug,
      pathwayProfessionLabel: pathwayProfessionLabel(
        row.pathway.slug,
        row.pathway.name,
      ),
      scenarioCode: row.scenario?.code,
      scenarioName: row.scenario?.name,
      shareText: row.shareText,
      title: row.title ?? undefined,
      authorName: row.authorName ?? undefined,
      comboStepCount: row.comboStepCount,
      viewCount: row.viewCount,
      deployedPuppets: deployedPuppetNames(row.deployedPuppets),
      createdAt: row.createdAt.toISOString(),
    };
  }

  async getById(id: string): Promise<ShareDto> {
    try {
      const row = await this.prisma.sharedBuild.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
        include: { pathway: true, scenario: true },
      });
      return this.mapRow(row);
    } catch {
      throw new NotFoundException('连招码不存在');
    }
  }

  async deleteById(id: string): Promise<{ deleted: true; id: string }> {
    if (!id) throw new NotFoundException('连招码不存在');
    try {
      await this.prisma.sharedBuild.delete({ where: { id } });
      return { deleted: true, id };
    } catch {
      throw new NotFoundException('连招码不存在');
    }
  }
}

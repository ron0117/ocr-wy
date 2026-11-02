import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  GuideArticleCreatedDto,
  GuideArticleDto,
  GuideArticleListItemDto,
} from '@ocr/guide-types';
import { nanoid } from 'nanoid';
import { PrismaService } from '../prisma/prisma.module';

function buildSlug(title: string): string {
  const trimmed = title.trim();
  const base =
    trimmed
      .slice(0, 48)
      .replace(/\s+/g, '-')
      .replace(/[^\w\u4e00-\u9fff-]+/gu, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'guide';
  return `${base}-${nanoid(8)}`;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  private toListItem(row: {
    id: string;
    slug: string;
    title: string;
    authorName: string;
    summary: string | null;
    coverUrl: string | null;
    pathwaySlug: string | null;
    viewCount: number;
    createdAt: Date;
  }): GuideArticleListItemDto {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      authorName: row.authorName,
      summary: row.summary ?? undefined,
      coverUrl: row.coverUrl ?? undefined,
      pathwaySlug: row.pathwaySlug ?? undefined,
      viewCount: row.viewCount,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async list(limit = 50): Promise<GuideArticleListItemDto[]> {
    const rows = await this.prisma.guideArticle.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, Math.max(1, limit)),
      select: {
        id: true,
        slug: true,
        title: true,
        authorName: true,
        summary: true,
        coverUrl: true,
        pathwaySlug: true,
        viewCount: true,
        createdAt: true,
      },
    });
    return rows.map((r) => this.toListItem(r));
  }

  async getBySlug(slug: string): Promise<GuideArticleDto> {
    try {
      const row = await this.prisma.guideArticle.update({
        where: { slug },
        data: { viewCount: { increment: 1 } },
      });
      return {
        ...this.toListItem(row),
        bodyHtml: row.bodyHtml,
        updatedAt: row.updatedAt.toISOString(),
      };
    } catch {
      throw new NotFoundException('攻略不存在');
    }
  }

  async create(dto: {
    title: string;
    authorName: string;
    summary?: string;
    bodyHtml: string;
    coverUrl?: string;
    pathwaySlug?: string;
  }): Promise<GuideArticleCreatedDto> {
    const title = dto.title.trim();
    const authorName = dto.authorName.trim();
    const bodyHtml = dto.bodyHtml.trim();
    if (!title) throw new BadRequestException('标题不能为空');
    if (!authorName) throw new BadRequestException('请填写作者昵称');
    if (!bodyHtml || bodyHtml === '<p></p>') {
      throw new BadRequestException('正文不能为空');
    }

    const summary =
      dto.summary?.trim() ||
      stripHtml(bodyHtml).slice(0, 160) ||
      undefined;

    const slug = buildSlug(title);
    const row = await this.prisma.guideArticle.create({
      data: {
        slug,
        title,
        authorName,
        summary,
        bodyHtml,
        coverUrl: dto.coverUrl?.trim() || undefined,
        pathwaySlug: dto.pathwaySlug?.trim() || undefined,
      },
    });

    return {
      id: row.id,
      slug: row.slug,
      urlPath: `/guides/${row.slug}`,
    };
  }

  async deleteBySlug(slug: string): Promise<{ deleted: true; slug: string }> {
    if (!slug) throw new NotFoundException('攻略不存在');
    try {
      await this.prisma.guideArticle.delete({ where: { slug } });
      return { deleted: true, slug };
    } catch {
      throw new NotFoundException('攻略不存在');
    }
  }
}

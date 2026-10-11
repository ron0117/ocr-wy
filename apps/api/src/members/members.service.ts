import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { AuthUser } from '@ocr/shared-types';
import { Prisma } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { ClubsService } from '../clubs/clubs.service';
import { detectImageType, sanitizeFilename, type DetectedImage } from '../common/image';
import { OcrClient } from '../ocr/ocr.client';
import { PrismaService } from '../prisma/prisma.module';
import { StorageService } from '../storage/storage.service';
import { ListMembersQuery, WriteMemberDto, type MemberSort } from './dto';
import { MemberAiService } from './member-ai.service';
import { omitClippedTopLines, omitGroupColumn, parseMemberTable, type OcrLine, type ParsedMember } from './parse-member-table';
import { assignRanks, fillMissingFields, orderByVertical, uniqueByName } from './structure-members';

interface Change {
  direction: 'up' | 'down';
  delta: number;
}

function change(previous: number | null, current: number | null, higherIsBetter: boolean): Change | null {
  if (previous === null || current === null || previous === current) return null;
  const improved = higherIsBetter ? current > previous : current < previous;
  return { direction: improved ? 'up' : 'down', delta: Math.abs(current - previous) };
}

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clubs: ClubsService,
    private readonly access: AccessService,
    private readonly ocr: OcrClient,
    private readonly storage: StorageService,
    private readonly memberAi: MemberAiService,
  ) {}

  async importImages(user: AuthUser, clubId: string, files: Express.Multer.File[]) {
    if (files.length === 0) throw new BadRequestException('请上传图片文件');
    if (files.length > 20) throw new BadRequestException('一次最多上传 20 张图片');
    await this.clubs.findOwned(user, clubId);

    const prepared: PreparedImage[] = [];
    for (const file of files) {
      const name = sanitizeFilename(file.originalname || '图片');
      const detected = await detectImageType(file.buffer);
      if (!detected) throw new BadRequestException(`${name} 不是 PNG、JPEG 或 WebP 图片`);
      const recognized = await this.ocr.recognize(file.buffer, name);
      const lines = omitClippedTopLines(omitGroupColumn(recognized.lines));
      if (lines.length === 0) throw new UnprocessableEntityException(`${name} 没有识别到文字`);
      const rows = uniqueByName(parseMemberTable(lines));
      prepared.push({ file, detected, lines, rows, objectName: '' });
    }

    const merged = await this.merge(prepared);
    if (merged.length === 0) throw new UnprocessableEntityException('没有识别到人员行');
    const stored: string[] = [];
    try {
      for (const item of prepared) {
        const objectName = `imports/${user.id}/${clubId}/${randomUUID()}.${item.detected.ext}`;
        await this.storage.upload(objectName, item.file.buffer, item.detected.mime);
        item.objectName = objectName;
        stored.push(objectName);
      }
      return await this.prisma.$transaction(async (tx) => {
        const updatedAt = new Date();
        for (const row of merged) {
          const existing = await tx.member.findUnique({
            where: { clubId_playerName: { clubId, playerName: row.playerName } },
          });
          if (!existing) {
            await tx.member.create({
              data: { ...importFields(row), rank: 0, clubId, dataUpdatedAt: updatedAt },
            });
            continue;
          }
          await tx.member.update({
            where: { id: existing.id },
            data: {
              ...importFields(row),
              previousScore: existing.score,
              dataUpdatedAt: updatedAt,
            },
          });
        }
        for (const item of prepared) {
          await tx.importBatch.create({
            data: {
              clubId,
              userId: user.id,
              objectName: item.objectName,
              rowCount: item.rows.length,
              createdAt: updatedAt,
            },
          });
        }
        return { rowCount: merged.length, imageCount: prepared.length, updatedAt: updatedAt.toISOString() };
      });
    } catch (error) {
      await Promise.all(stored.map((objectName) => this.storage.remove(objectName)));
      throw error;
    }
  }

  private async merge(images: PreparedImage[]): Promise<ParsedMember[]> {
    const localRows = uniqueByName(images.flatMap((image) => image.rows));
    const ranked = (rows: ParsedMember[]) => assignRanks(orderByVertical(rows, images.map((image) => image.lines)));
    if (!this.memberAi.isEnabled()) return ranked(localRows);
    try {
      const filtered = await this.memberAi.filterAndDedupe(
        images.map((image) => ({
          name: sanitizeFilename(image.file.originalname || '图片'),
          lines: image.lines,
          candidates: image.rows,
        })),
      );
      if (filtered.length > 0) {
        const names = new Set(filtered.map((row) => row.playerName));
        const kept = localRows.filter((row) => names.has(row.playerName));
        return ranked(kept.length > 0 ? fillMissingFields(kept, filtered) : filtered);
      }
      this.logger.warn('AI 没有筛出人员，改用坐标整理结果');
    } catch (error) {
      if (localRows.length === 0) throw error;
      const message = error instanceof Error ? error.message : 'AI 整理失败';
      this.logger.warn(`AI 筛选去重失败，改用坐标整理：${message}`);
    }
    return ranked(localRows);
  }

  async list(user: AuthUser, query: ListMembersQuery) {
    if (query.clubId) await this.clubs.findOwned(user, query.clubId);
    const sort = query.sort ?? 'score';
    const order = query.order ?? (sort === 'score' ? 'desc' : 'asc');
    const keyword = query.keyword?.trim();
    const rows = await this.prisma.member.findMany({
      where: {
        club: this.access.clubWhere(user),
        ...(query.clubId ? { clubId: query.clubId } : {}),
        ...(keyword ? { playerName: { contains: keyword, mode: 'insensitive' } } : {}),
      },
      include: { club: { select: { name: true } }, wecomBinding: { select: { id: true } } },
      orderBy: sort === 'notifyBound' ? { rank: order } : orderBy(sort, order),
    });
    const sorted =
      sort === 'notifyBound'
        ? [...rows].sort((left, right) => {
            const delta = Number(Boolean(left.wecomBinding)) - Number(Boolean(right.wecomBinding));
            return order === 'asc' ? delta : -delta;
          })
        : rows;
    return sorted.map((row) => present(row));
  }

  async create(user: AuthUser, dto: WriteMemberDto) {
    const fields = memberInput(dto);
    await this.clubs.findOwned(user, fields.clubId);
    try {
      const row = await this.prisma.member.create({
        data: { ...fields, dataUpdatedAt: new Date() },
        include: { club: { select: { name: true } }, wecomBinding: { select: { id: true } } },
      });
      return present(row);
    } catch (error) {
      this.rethrowDuplicate(error);
    }
  }

  async update(user: AuthUser, memberId: string, dto: WriteMemberDto) {
    const existing = await this.findOwned(user, memberId);
    const fields = memberInput(dto);
    await this.clubs.findOwned(user, fields.clubId);
    try {
      const row = await this.prisma.member.update({
        where: { id: existing.id },
        data: {
          ...fields,
          previousRank: existing.rank,
          previousScore: existing.score,
          dataUpdatedAt: new Date(),
        },
        include: { club: { select: { name: true } }, wecomBinding: { select: { id: true } } },
      });
      return present(row);
    } catch (error) {
      this.rethrowDuplicate(error);
    }
  }

  async unbind(user: AuthUser, memberId: string) {
    const existing = await this.findOwned(user, memberId);
    const binding = await this.prisma.wecomBinding.findUnique({ where: { memberId: existing.id } });
    if (!binding) return { ok: true, alreadyUnbound: true };
    await this.prisma.wecomBinding.delete({ where: { memberId: existing.id } });
    return { ok: true, alreadyUnbound: false };
  }

  async remove(user: AuthUser, memberId: string) {
    const existing = await this.findOwned(user, memberId);
    await this.prisma.member.delete({ where: { id: existing.id } });
    return { ok: true };
  }

  async removeMany(user: AuthUser, ids: string[]) {
    const unique = [...new Set(ids)];
    const owned = await this.prisma.member.findMany({
      where: { id: { in: unique }, club: this.access.clubWhere(user) },
      select: { id: true },
    });
    if (owned.length !== unique.length) throw new NotFoundException('有人员不存在');
    const result = await this.prisma.member.deleteMany({
      where: { id: { in: owned.map((row) => row.id) } },
    });
    return { deleted: result.count };
  }

  private async findOwned(user: AuthUser, memberId: string) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, club: this.access.clubWhere(user) },
    });
    if (!member) throw new NotFoundException('人员不存在');
    return member;
  }

  private rethrowDuplicate(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('该俱乐部已有同名玩家');
    }
    throw error;
  }
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function memberInput(dto: WriteMemberDto) {
  const playerName = dto.playerName.trim();
  if (!playerName) throw new BadRequestException('请填写玩家名称');
  return {
    clubId: dto.clubId,
    playerName,
    rank: dto.rank,
    level: dto.level ?? null,
    path: blankToNull(dto.path),
    score: dto.score ?? null,
    fashion: dto.fashion ?? null,
    weeklyActivity: dto.weeklyActivity ?? null,
    joinedText: blankToNull(dto.joinedText),
  };
}

function present(row: {
  id: string;
  clubId: string;
  rank: number;
  playerName: string;
  level: number | null;
  path: string | null;
  score: number | null;
  fashion: number | null;
  weeklyActivity: number | null;
  joinedText: string | null;
  dataUpdatedAt: Date;
  previousRank: number | null;
  previousScore: number | null;
  club: { name: string };
  wecomBinding: { id: string } | null;
}) {
  return {
    id: row.id,
    clubId: row.clubId,
    rank: row.rank,
    playerName: row.playerName,
    clubName: row.club.name,
    level: row.level,
    path: row.path,
    score: row.score,
    fashion: row.fashion,
    weeklyActivity: row.weeklyActivity,
    joinedText: row.joinedText,
    dataUpdatedAt: row.dataUpdatedAt.toISOString(),
    rankChange: change(row.previousRank, row.rank, false),
    scoreChange: change(row.previousScore, row.score, true),
    notifyBound: Boolean(row.wecomBinding),
  };
}

interface PreparedImage {
  file: Express.Multer.File;
  detected: DetectedImage;
  lines: OcrLine[];
  rows: ParsedMember[];
  objectName: string;
}

const INT32_MAX = 2_147_483_647;

function fitsInt(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= 0 && value <= INT32_MAX;
}

function fitInt(value: number | null): number | null {
  return fitsInt(value) ? value : null;
}

function importFields(row: ParsedMember) {
  return {
    playerName: row.playerName,
    level: fitInt(row.level),
    path: row.path,
    score: fitInt(row.score),
    fashion: fitInt(row.fashion),
    weeklyActivity: fitInt(row.weeklyActivity),
    joinedText: row.joinedText,
  };
}

function orderBy(sort: MemberSort, order: Prisma.SortOrder): Prisma.MemberOrderByWithRelationInput {
  const nullable = { sort: order, nulls: 'last' as const };
  switch (sort) {
    case 'playerName':
      return { playerName: order };
    case 'clubName':
      return { club: { name: order } };
    case 'level':
      return { level: nullable };
    case 'path':
      return { path: nullable };
    case 'score':
      return { score: nullable };
    case 'fashion':
      return { fashion: nullable };
    case 'weeklyActivity':
      return { weeklyActivity: nullable };
    case 'joinedText':
      return { joinedText: nullable };
    case 'notifyBound':
    case 'rank':
      return { rank: order };
  }
}

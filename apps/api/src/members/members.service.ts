import { randomUUID } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { AuthUser } from '@ocr/shared-types';
import { Prisma } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { ClubsService } from '../clubs/clubs.service';
import { detectImageType, sanitizeFilename, toVisionJpeg, type DetectedImage } from '../common/image';
import { PrismaService } from '../prisma/prisma.module';
import { StorageService } from '../storage/storage.service';
import { ListMembersQuery, WriteMemberDto, type MemberSort } from './dto';
import { MemberAiService } from './member-ai.service';
import { cleanVisionRows, ConfirmRowsError, mergeVisionRows, parseConfirmRows, type VisionMemberRow } from './vision-members';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly clubs: ClubsService,
    private readonly access: AccessService,
    private readonly storage: StorageService,
    private readonly memberAi: MemberAiService,
  ) {}

  async previewImages(user: AuthUser, clubId: string, files: Express.Multer.File[]) {
    const prepared = await this.prepareFiles(user, clubId, files);
    if (!this.memberAi.isEnabled()) throw new BadGatewayException('未配置 AI');
    const jpegs: Buffer[] = [];
    for (const item of prepared) {
      try {
        jpegs.push(await toVisionJpeg(item.file.buffer));
      } catch {
        throw new BadRequestException(`${item.name} 无法读取`);
      }
    }
    const payloads = await mapPool(jpegs, 4, (jpeg) => this.memberAi.readImage(jpeg));
    const rows = mergeVisionRows(payloads.map((payload) => cleanVisionRows(payload)));
    if (rows.length === 0) throw new UnprocessableEntityException('没有识别到人员');
    return { rows };
  }

  async confirmImport(
    user: AuthUser,
    clubId: string,
    files: Express.Multer.File[],
    rowsField: string | undefined,
    renamesField?: string,
  ) {
    const prepared = await this.prepareFiles(user, clubId, files);
    const rows = this.readConfirmField(rowsField);
    const renames = readRenames(renamesField);
    const stored: string[] = [];
    try {
      const uploaded: string[] = [];
      for (const item of prepared) {
        const objectName = `imports/${user.id}/${clubId}/${randomUUID()}.${item.detected.ext}`;
        await this.storage.upload(objectName, item.file.buffer, item.detected.mime);
        uploaded.push(objectName);
        stored.push(objectName);
      }
      return await this.prisma.$transaction(async (tx) => {
        const updatedAt = new Date();
        const current = await tx.member.findMany({ where: { clubId } });
        const exact = new Map(current.map((member) => [member.playerName, member]));
        const folded = new Map<string, typeof current>();
        for (const member of current) {
          const key = foldPlayerName(member.playerName);
          const bucket = folded.get(key) ?? [];
          bucket.push(member);
          folded.set(key, bucket);
        }
        const updates: { id: string; row: VisionMemberRow; previousScore: number | null }[] = [];
        const creates: VisionMemberRow[] = [];
        for (const row of rows) {
          const existing = matchMember(row.playerName, exact, folded);
          if (!existing) {
            creates.push(row);
            continue;
          }
          updates.push({ id: existing.id, row, previousScore: existing.score });
          untrackMember(existing, exact, folded);
        }
        const keepIds = new Set(updates.map((item) => item.id));
        const removalIds = current.map((member) => member.id).filter((id) => !keepIds.has(id));
        const historyCounts =
          removalIds.length === 0
            ? []
            : await tx.activityAttendance.groupBy({
                by: ['memberId'],
                where: { memberId: { in: removalIds } },
                _count: { _all: true },
              });
        const historyIds = new Set(
          historyCounts.flatMap((item) => (item.memberId && item._count._all > 0 ? [item.memberId] : [])),
        );
        const missing = current.filter((member) => historyIds.has(member.id));
        const arriving = creates.map((row) => row.playerName);
        if (missing.length > 0 && arriving.length > 0 && renames === undefined) {
          throw new ConflictException({
            statusCode: 409,
            code: 'NEED_RENAME',
            message: '请确认哪些旧名对应新名称',
            missing: missing.map((member) => ({
              memberId: member.id,
              playerName: member.playerName,
              attendanceCount: historyCounts.find((item) => item.memberId === member.id)?._count._all ?? 0,
            })),
            arriving,
          });
        }
        const pairs = checkedRenames(renames ?? [], missing.map((member) => member.id), arriving);
        const consumed = new Set(pairs.map((pair) => pair.playerName));
        const renamedIds = new Set(pairs.map((pair) => pair.memberId));
        for (const pair of pairs) {
          const row = creates.find((item) => item.playerName === pair.playerName);
          const existing = current.find((member) => member.id === pair.memberId);
          if (!row || !existing) throw new BadRequestException('改名对照不正确');
          await tx.member.update({
            where: { id: pair.memberId },
            data: { ...importFields(row), previousScore: existing.score, dataUpdatedAt: updatedAt },
          });
          await syncAttendanceName(tx, pair.memberId, clubId, row.playerName);
        }
        const deleteIds = removalIds.filter((id) => !renamedIds.has(id));
        if (deleteIds.length > 0) {
          await tx.member.deleteMany({ where: { id: { in: deleteIds } } });
        }
        for (const item of updates) {
          await tx.member.update({
            where: { id: item.id },
            data: {
              ...importFields(item.row),
              previousScore: item.previousScore,
              dataUpdatedAt: updatedAt,
            },
          });
        }
        for (const row of creates) {
          if (consumed.has(row.playerName)) continue;
          const created = await tx.member.create({
            data: { ...importFields(row), rank: 0, clubId, dataUpdatedAt: updatedAt },
          });
          await claimAttendances(tx, clubId, created.playerName, created.id);
        }
        for (const objectName of uploaded) {
          await tx.importBatch.create({
            data: {
              clubId,
              userId: user.id,
              objectName,
              rowCount: rows.length,
              createdAt: updatedAt,
            },
          });
        }
        return { rowCount: rows.length, imageCount: prepared.length, updatedAt: updatedAt.toISOString() };
      });
    } catch (error) {
      await Promise.all(stored.map((objectName) => this.storage.remove(objectName)));
      throw error;
    }
  }

  private async prepareFiles(user: AuthUser, clubId: string, files: Express.Multer.File[]) {
    if (files.length === 0) throw new BadRequestException('请上传图片文件');
    if (files.length > 20) throw new BadRequestException('一次最多上传 20 张图片');
    await this.clubs.findOwned(user, clubId);
    const prepared: PreparedFile[] = [];
    for (const file of files) {
      const name = sanitizeFilename(file.originalname || '图片');
      const detected = await detectImageType(file.buffer);
      if (!detected) throw new BadRequestException(`${name} 不是 PNG、JPEG 或 WebP 图片`);
      prepared.push({ file, detected, name });
    }
    return prepared;
  }

  private readConfirmField(rowsField: string | undefined): VisionMemberRow[] {
    if (typeof rowsField !== 'string' || !rowsField.trim()) throw new BadRequestException('请提交校对结果');
    let parsed: unknown;
    try {
      parsed = JSON.parse(rowsField);
    } catch {
      throw new BadRequestException('校对结果无法解析');
    }
    try {
      return parseConfirmRows(parsed);
    } catch (error) {
      if (error instanceof ConfirmRowsError) throw new BadRequestException(error.message);
      throw error;
    }
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
      include: { club: { select: { name: true } } },
      orderBy: orderBy(sort, order),
    });
    return rows.map((row) => present(row));
  }

  async create(user: AuthUser, dto: WriteMemberDto) {
    const fields = memberInput(dto);
    await this.clubs.findOwned(user, fields.clubId);
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.member.create({
          data: { ...fields, dataUpdatedAt: new Date() },
          include: { club: { select: { name: true } } },
        });
        await claimAttendances(tx, created.clubId, created.playerName, created.id);
        return created;
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
      const row = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.member.update({
          where: { id: existing.id },
          data: {
            ...fields,
            previousRank: existing.rank,
            previousScore: existing.score,
            dataUpdatedAt: new Date(),
          },
          include: { club: { select: { name: true } } },
        });
        if (existing.playerName !== fields.playerName || existing.clubId !== fields.clubId) {
          await syncAttendanceName(tx, existing.id, fields.clubId, fields.playerName);
          await claimAttendances(tx, fields.clubId, fields.playerName, existing.id);
        }
        return updated;
      });
      return present(row);
    } catch (error) {
      this.rethrowDuplicate(error);
    }
  }

  async activities(user: AuthUser, memberId: string) {
    const member = await this.findOwned(user, memberId);
    const includeClubs = { clubs: { include: { club: { select: { id: true, name: true } } } } };
    const [attendedRows, missed] = await Promise.all([
      this.prisma.activityAttendance.findMany({
        where: { memberId: member.id, activity: this.access.activityWhere(user) },
        include: { activity: { include: includeClubs } },
        orderBy: { activity: { startsAt: 'desc' } },
      }),
      this.prisma.activity.findMany({
        where: {
          AND: [
            this.access.activityWhere(user),
            { clubs: { some: { clubId: member.clubId } } },
            { attendances: { none: { memberId: member.id } } },
          ],
        },
        include: includeClubs,
        orderBy: { startsAt: 'desc' },
      }),
    ]);
    return {
      attended: attendedRows.map((row) => ({ ...presentActivity(row.activity), late: row.late })),
      missed: missed.map((activity) => presentActivity(activity)),
    };
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
  };
}

function presentActivity(activity: {
  id: string;
  title: string;
  status: 'PUBLISHED' | 'ENDED';
  startsAt: Date;
  clubs: Array<{ club: { id: string; name: string } }>;
}) {
  return {
    id: activity.id,
    title: activity.title,
    status: activity.status,
    startsAt: activity.startsAt.toISOString(),
    clubs: activity.clubs.map((item) => ({ id: item.club.id, name: item.club.name })),
  };
}

function readRenames(field: string | undefined) {
  if (field === undefined) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(field);
  } catch {
    throw new BadRequestException('改名对照不正确');
  }
  if (!Array.isArray(parsed)) throw new BadRequestException('改名对照不正确');
  return parsed.map((item) => {
    if (!item || typeof item !== 'object') throw new BadRequestException('改名对照不正确');
    const memberId = 'memberId' in item ? item.memberId : undefined;
    const playerName = 'playerName' in item ? item.playerName : undefined;
    if (typeof memberId !== 'string' || typeof playerName !== 'string' || !playerName.trim()) {
      throw new BadRequestException('改名对照不正确');
    }
    return { memberId, playerName: playerName.trim() };
  });
}

function checkedRenames(
  pairs: Array<{ memberId: string; playerName: string }>,
  missingIds: string[],
  arriving: string[],
) {
  const missing = new Set(missingIds);
  const names = new Set(arriving);
  const seenMembers = new Set<string>();
  const seenNames = new Set<string>();
  for (const pair of pairs) {
    if (!missing.has(pair.memberId) || !names.has(pair.playerName)) {
      throw new BadRequestException('改名对照不正确');
    }
    if (seenMembers.has(pair.memberId) || seenNames.has(pair.playerName)) {
      throw new BadRequestException('改名对照不正确');
    }
    seenMembers.add(pair.memberId);
    seenNames.add(pair.playerName);
  }
  return pairs;
}

async function syncAttendanceName(
  tx: Prisma.TransactionClient,
  memberId: string,
  clubId: string,
  playerName: string,
) {
  const rows = await tx.activityAttendance.findMany({ where: { memberId } });
  for (const row of rows) {
    const clash = await tx.activityAttendance.findFirst({
      where: { activityId: row.activityId, clubId, playerName, NOT: { id: row.id } },
    });
    if (clash) {
      await tx.activityAttendance.delete({ where: { id: clash.id } });
      if (clash.late) {
        await tx.activityAttendance.update({ where: { id: row.id }, data: { late: true } });
      }
    }
    await tx.activityAttendance.update({
      where: { id: row.id },
      data: { playerName, clubId },
    });
  }
}

async function claimAttendances(
  tx: Prisma.TransactionClient,
  clubId: string,
  playerName: string,
  memberId: string,
) {
  const orphans = await tx.activityAttendance.findMany({
    where: { clubId, playerName, memberId: null },
  });
  for (const orphan of orphans) {
    const taken = await tx.activityAttendance.findFirst({
      where: { activityId: orphan.activityId, memberId },
    });
    if (taken) {
      if (orphan.late && !taken.late) {
        await tx.activityAttendance.update({ where: { id: taken.id }, data: { late: true } });
      }
      await tx.activityAttendance.delete({ where: { id: orphan.id } });
      continue;
    }
    await tx.activityAttendance.update({ where: { id: orphan.id }, data: { memberId } });
  }
}

interface PreparedFile {
  file: Express.Multer.File;
  detected: DetectedImage;
  name: string;
}

function importFields(row: VisionMemberRow) {
  return {
    playerName: row.playerName,
    level: row.level,
    path: row.path,
    score: row.score,
    fashion: row.fashion,
    weeklyActivity: row.weeklyActivity,
    joinedText: row.joinedText,
  };
}

function foldPlayerName(name: string) {
  return name.trim().replace(/[\s\u3000]+/g, '').toLowerCase();
}

function matchMember<T extends { id: string; playerName: string }>(
  playerName: string,
  exact: Map<string, T>,
  folded: Map<string, T[]>,
) {
  const direct = exact.get(playerName);
  if (direct) return direct;
  const bucket = folded.get(foldPlayerName(playerName)) ?? [];
  return bucket.length === 1 ? bucket[0] : undefined;
}

function untrackMember<T extends { id: string; playerName: string }>(
  member: T,
  exact: Map<string, T>,
  folded: Map<string, T[]>,
) {
  exact.delete(member.playerName);
  const key = foldPlayerName(member.playerName);
  const bucket = (folded.get(key) ?? []).filter((item) => item.id !== member.id);
  if (bucket.length === 0) folded.delete(key);
  else folded.set(key, bucket);
}

async function mapPool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const run = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
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
    case 'rank':
      return { rank: order };
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '@ocr/shared-types';
import { AccessService } from '../access/access.service';
import { PrismaService } from '../prisma/prisma.module';
import { ActivityFieldsDto, SaveAttendanceDto } from './dto';

const activityInclude = {
  clubs: { include: { club: { select: { id: true, name: true } } } },
} satisfies Prisma.ActivityInclude;

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async create(user: AuthUser, dto: ActivityFieldsDto) {
    const fields = this.fields(dto);
    await this.ownedClubs(user, fields.clubIds);
    const activity = await this.prisma.activity.create({
      data: {
        userId: user.id,
        title: fields.title,
        note: fields.note,
        startsAt: fields.startsAt,
        status: 'PUBLISHED',
        clubs: { create: fields.clubIds.map((clubId) => ({ clubId })) },
      },
      include: activityInclude,
    });
    return presentActivity(activity);
  }

  async list(user: AuthUser) {
    const rows = await this.prisma.activity.findMany({
      where: this.access.activityWhere(user),
      include: activityInclude,
      orderBy: { publishedAt: 'desc' },
    });
    return rows.map(presentActivity);
  }

  async get(user: AuthUser, activityId: string) {
    return presentActivity(await this.owned(user, activityId));
  }

  async update(user: AuthUser, activityId: string, dto: ActivityFieldsDto) {
    const activity = await this.owned(user, activityId);
    const fields = this.fields(dto);
    await this.ownedClubs(user, fields.clubIds);
    const updated = await this.prisma.activity.update({
      where: { id: activity.id },
      data: {
        title: fields.title,
        note: fields.note,
        startsAt: fields.startsAt,
        clubs: {
          deleteMany: {},
          create: fields.clubIds.map((clubId) => ({ clubId })),
        },
      },
      include: activityInclude,
    });
    return presentActivity(updated);
  }

  async remove(user: AuthUser, activityId: string) {
    const activity = await this.owned(user, activityId);
    await this.prisma.activity.delete({ where: { id: activity.id } });
    return { ok: true };
  }

  async end(user: AuthUser, activityId: string) {
    const activity = await this.owned(user, activityId);
    if (activity.status === 'ENDED') return presentActivity(activity);
    const updated = await this.prisma.activity.update({
      where: { id: activity.id },
      data: { status: 'ENDED', endedAt: new Date() },
      include: activityInclude,
    });
    return presentActivity(updated);
  }

  async attendance(user: AuthUser, activityId: string) {
    const activity = await this.owned(user, activityId);
    const clubIds = activity.clubs.map((item) => item.clubId);
    const [members, marks] = await Promise.all([
      this.prisma.member.findMany({
        where: { clubId: { in: clubIds } },
        include: { club: { select: { name: true } } },
        orderBy: [{ club: { name: 'asc' } }, { rank: 'asc' }],
      }),
      this.prisma.activityAttendance.findMany({
        where: { activityId, memberId: { not: null } },
        select: { memberId: true, late: true },
      }),
    ]);
    const byMember = new Map(marks.map((item) => [item.memberId, item.late]));
    return members.map((member) => ({
      id: member.id,
      playerName: member.playerName,
      clubName: member.club.name,
      attended: byMember.has(member.id),
      late: byMember.get(member.id) ?? false,
    }));
  }

  async saveAttendance(user: AuthUser, activityId: string, dto: SaveAttendanceDto) {
    const activity = await this.owned(user, activityId);
    const clubIds = activity.clubs.map((item) => item.clubId);
    const roster = await this.prisma.member.findMany({
      where: { clubId: { in: clubIds } },
      select: { id: true, clubId: true, playerName: true },
    });
    const byId = new Map(roster.map((member) => [member.id, member]));
    const desired = new Map<string, { late: boolean; clubId: string; playerName: string }>();
    for (const mark of dto.marks) {
      const member = byId.get(mark.memberId);
      if (!member) throw new NotFoundException('人员不存在');
      const previous = desired.get(member.id);
      desired.set(member.id, {
        late: Boolean(mark.late) || Boolean(previous?.late),
        clubId: member.clubId,
        playerName: member.playerName,
      });
    }
    const rosterIds = roster.map((member) => member.id);
    await this.prisma.$transaction(async (tx) => {
      if (rosterIds.length > 0) {
        await tx.activityAttendance.deleteMany({
          where: {
            activityId,
            memberId: { in: rosterIds.filter((id) => !desired.has(id)) },
          },
        });
      }
      for (const [memberId, mark] of desired) {
        const existing = await tx.activityAttendance.findFirst({
          where: { activityId, memberId },
        });
        if (existing) {
          await tx.activityAttendance.update({
            where: { id: existing.id },
            data: { late: mark.late, playerName: mark.playerName, clubId: mark.clubId },
          });
          continue;
        }
        const orphan = await tx.activityAttendance.findFirst({
          where: { activityId, clubId: mark.clubId, playerName: mark.playerName, memberId: null },
        });
        if (orphan) {
          await tx.activityAttendance.update({
            where: { id: orphan.id },
            data: { memberId, late: mark.late },
          });
          continue;
        }
        await tx.activityAttendance.create({
          data: {
            activityId,
            memberId,
            clubId: mark.clubId,
            playerName: mark.playerName,
            late: mark.late,
          },
        });
      }
    });
    return this.attendance(user, activityId);
  }

  private fields(dto: ActivityFieldsDto) {
    const title = dto.title.trim();
    if (!title) throw new BadRequestException('请填写活动标题');
    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('开始时间不正确');
    const note = dto.note?.trim() || null;
    return { title, note, clubIds: [...new Set(dto.clubIds)], startsAt };
  }

  private async ownedClubs(user: AuthUser, clubIds: string[]) {
    const clubs = await this.prisma.club.findMany({
      where: { id: { in: clubIds }, AND: [this.access.clubWhere(user)] },
      select: { id: true },
    });
    if (clubs.length !== clubIds.length) throw new NotFoundException('俱乐部不存在');
    return clubs;
  }

  private async owned(user: AuthUser, activityId: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, AND: [this.access.activityWhere(user)] },
      include: activityInclude,
    });
    if (!activity) throw new NotFoundException('活动不存在');
    return activity;
  }
}

function presentActivity(activity: Prisma.ActivityGetPayload<{ include: typeof activityInclude }>) {
  return {
    id: activity.id,
    title: activity.title,
    note: activity.note,
    status: activity.status,
    startsAt: activity.startsAt.toISOString(),
    remindAt: activity.remindAt?.toISOString() ?? null,
    publishedAt: activity.publishedAt.toISOString(),
    endedAt: activity.endedAt?.toISOString() ?? null,
    clubs: activity.clubs.map((item) => ({ id: item.club.id, name: item.club.name })),
  };
}

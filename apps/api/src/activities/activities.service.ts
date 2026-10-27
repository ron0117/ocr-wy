import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '@ocr/shared-types';
import { AccessService } from '../access/access.service';
import { activityPublicUrl } from '../common/web-origin';
import { PrismaService } from '../prisma/prisma.module';
import { ActivityFieldsDto } from './dto';

const activityInclude = {
  clubs: { include: { club: { select: { id: true, name: true } } } },
} satisfies Prisma.ActivityInclude;

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly config: ConfigService,
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
    return this.present(activity);
  }

  async list(_user: AuthUser) {
    const rows = await this.prisma.activity.findMany({
      include: activityInclude,
      orderBy: { publishedAt: 'desc' },
    });
    return rows.map((row) => this.present(row));
  }

  async get(user: AuthUser, activityId: string) {
    return this.present(await this.owned(user, activityId));
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
    return this.present(updated);
  }

  async remove(user: AuthUser, activityId: string) {
    const activity = await this.owned(user, activityId);
    await this.prisma.activity.delete({ where: { id: activity.id } });
    return { ok: true };
  }

  async end(user: AuthUser, activityId: string) {
    const activity = await this.owned(user, activityId);
    if (activity.status === 'ENDED') return this.present(activity);
    const updated = await this.prisma.activity.update({
      where: { id: activity.id },
      data: { status: 'ENDED', endedAt: new Date() },
      include: activityInclude,
    });
    return this.present(updated);
  }

  private present(activity: Prisma.ActivityGetPayload<{ include: typeof activityInclude }>) {
    const origin = this.config.get<string>('WEB_ORIGIN');
    return {
      id: activity.id,
      title: activity.title,
      note: activity.note,
      status: activity.status,
      startsAt: activity.startsAt.toISOString(),
      remindAt: activity.remindAt?.toISOString() ?? null,
      publishedAt: activity.publishedAt.toISOString(),
      endedAt: activity.endedAt?.toISOString() ?? null,
      publicUrl: activityPublicUrl(origin, activity.id),
      clubs: activity.clubs.map((item) => ({ id: item.club.id, name: item.club.name })),
    };
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

  private async owned(_user: AuthUser, activityId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: activityInclude,
    });
    if (!activity) throw new NotFoundException('活动不存在');
    return activity;
  }
}

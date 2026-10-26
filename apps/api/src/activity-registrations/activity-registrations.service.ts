import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { clientIp } from '../common/client-ip';
import { activityPublicUrl } from '../common/web-origin';
import { PrismaService } from '../prisma/prisma.module';
import { ListRegistrationsQuery, PatchRegistrationDto, SubmitRegistrationDto } from './dto';
import { presentRegistration } from './present';

const registrationInclude = {
  club: { select: { name: true } },
} satisfies Prisma.ActivityRegistrationInclude;

const activityInclude = {
  clubs: { include: { club: { select: { id: true, name: true } } } },
} satisfies Prisma.ActivityInclude;

const MAX_SUBMISSIONS_PER_IP = 5;

@Injectable()
export class ActivityRegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getPublicActivity(activityId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: activityInclude,
    });
    if (!activity) throw new NotFoundException('活动不存在');
    return {
      id: activity.id,
      title: activity.title,
      startsAt: activity.startsAt.toISOString(),
      status: activity.status,
      clubs: activity.clubs.map((item) => ({ id: item.club.id, name: item.club.name })),
    };
  }

  async submitPublic(activityId: string, dto: SubmitRegistrationDto, request: Request) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: { clubs: { select: { clubId: true } } },
    });
    if (!activity) throw new NotFoundException('活动不存在');
    if (activity.status !== 'PUBLISHED') {
      throw new BadRequestException('活动已结束，无法报名');
    }
    const allowedClubs = new Set(activity.clubs.map((item) => item.clubId));
    if (!allowedClubs.has(dto.clubId)) {
      throw new BadRequestException('俱乐部不属于该活动');
    }
    const playerName = dto.playerName.trim();
    if (!playerName) throw new BadRequestException('请填写非凡者名称');
    const ip = clientIp(request);
    const count = await this.prisma.activityRegistration.count({
      where: { activityId, submitIp: ip },
    });
    if (count >= MAX_SUBMISSIONS_PER_IP) {
      throw new BadRequestException('您已报名多次，报名失败');
    }
    try {
      const row = await this.prisma.activityRegistration.create({
        data: {
          activityId,
          clubId: dto.clubId,
          playerName,
          score: dto.score,
          profession: dto.profession,
          submitIp: ip,
        },
        include: registrationInclude,
      });
      return presentRegistration(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('当前活动已报名');
      }
      throw error;
    }
  }

  listActivitiesForView() {
    return this.prisma.activity.findMany({
      select: {
        id: true,
        title: true,
        startsAt: true,
        status: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: 'desc' },
    }).then((rows) =>
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        startsAt: row.startsAt.toISOString(),
        status: row.status,
        publishedAt: row.publishedAt.toISOString(),
      })),
    );
  }

  async listRegistrations(query: ListRegistrationsQuery) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: query.activityId },
      include: activityInclude,
    });
    if (!activity) throw new NotFoundException('活动不存在');
    const clubIds = activity.clubs.map((item) => item.clubId);
    if (query.clubId && !clubIds.includes(query.clubId)) {
      throw new BadRequestException('俱乐部不属于该活动');
    }
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';
    const orderBy = buildOrderBy(sortBy, sortOrder);
    const rows = await this.prisma.activityRegistration.findMany({
      where: {
        activityId: query.activityId,
        ...(query.clubId ? { clubId: query.clubId } : {}),
      },
      include: registrationInclude,
      orderBy,
    });
    const origin = this.config.get<string>('WEB_ORIGIN');
    return {
      activity: {
        id: activity.id,
        title: activity.title,
        status: activity.status,
        startsAt: activity.startsAt.toISOString(),
        publicUrl: activityPublicUrl(origin, activity.id),
        clubs: activity.clubs.map((item) => ({ id: item.club.id, name: item.club.name })),
      },
      rows: rows.map(presentRegistration),
    };
  }

  async patchRegistration(id: string, dto: PatchRegistrationDto) {
    const existing = await this.prisma.activityRegistration.findUnique({
      where: { id },
      include: { activity: { include: { clubs: { select: { clubId: true } } } } },
    });
    if (!existing) throw new NotFoundException('报名记录不存在');
    const allowedClubs = new Set(existing.activity.clubs.map((item) => item.clubId));
    const clubId = dto.clubId ?? existing.clubId;
    if (!allowedClubs.has(clubId)) throw new BadRequestException('俱乐部不属于该活动');
    const playerName = dto.playerName !== undefined ? dto.playerName.trim() : existing.playerName;
    if (!playerName) throw new BadRequestException('请填写非凡者名称');
    try {
      const row = await this.prisma.activityRegistration.update({
        where: { id },
        data: {
          ...(dto.clubId !== undefined ? { clubId: dto.clubId } : {}),
          ...(dto.playerName !== undefined ? { playerName } : {}),
          ...(dto.score !== undefined ? { score: dto.score } : {}),
          ...(dto.profession !== undefined ? { profession: dto.profession } : {}),
          ...(dto.attendanceStatus !== undefined ? { attendanceStatus: dto.attendanceStatus } : {}),
        },
        include: registrationInclude,
      });
      return presentRegistration(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('当前活动已报名');
      }
      throw error;
    }
  }

  async removeRegistration(id: string) {
    try {
      await this.prisma.activityRegistration.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('报名记录不存在');
      }
      throw error;
    }
    return { ok: true };
  }
}

function buildOrderBy(
  sortBy: NonNullable<ListRegistrationsQuery['sortBy']>,
  sortOrder: 'asc' | 'desc',
): Prisma.ActivityRegistrationOrderByWithRelationInput | Prisma.ActivityRegistrationOrderByWithRelationInput[] {
  if (sortBy === 'clubName') {
    return { club: { name: sortOrder } };
  }
  return { [sortBy]: sortOrder };
}

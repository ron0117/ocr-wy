import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationKind, NotificationTrigger, Prisma } from '@prisma/client';
import type { AuthUser } from '@ocr/shared-types';
import { AccessService } from '../access/access.service';
import { PrismaService } from '../prisma/prisma.module';
import { WecomService, type WecomPlayer } from '../wecom/wecom.service';
import { BindMemberDto, CreateActivityDto, NotifyActivityDto } from './dto';

const activityInclude = {
  clubs: { include: { club: { select: { id: true, name: true } } } },
  recipients: true,
  notifications: { orderBy: { createdAt: 'desc' as const }, take: 10 },
} satisfies Prisma.ActivityInclude;

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wecom: WecomService,
    private readonly access: AccessService,
  ) {}

  async create(user: AuthUser, dto: CreateActivityDto) {
    this.wecom.assertConfigured();
    const title = dto.title.trim();
    if (!title) throw new BadRequestException('请填写活动标题');
    const clubIds = [...new Set(dto.clubIds)];
    const partyIds = cleanIds(dto.partyIds);
    const tagIds = cleanIds(dto.tagIds);
    const userIds = cleanIds(dto.userIds);
    if (partyIds.length + tagIds.length + userIds.length === 0) {
      throw new BadRequestException('请选择部门、标签或成员');
    }
    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('开始时间不正确');
    const remindAt = dto.remindAt ? new Date(dto.remindAt) : null;
    if (remindAt && (Number.isNaN(remindAt.getTime()) || remindAt.getTime() <= Date.now())) {
      throw new BadRequestException('提醒时间必须晚于当前时间');
    }
    const clubs = await this.ownedClubs(user, clubIds);
    const teamIds = new Set(clubs.map((club) => club.wecomTeamId));
    if (teamIds.size !== 1 || teamIds.has(null)) {
      throw new BadRequestException('所选俱乐部必须属于同一个企业微信团队');
    }
    const wecomTeamId = clubs[0].wecomTeamId as string;
    const activity = await this.prisma.activity.create({
      data: {
        userId: user.id,
        wecomTeamId,
        title,
        startsAt,
        remindAt,
        status: 'PUBLISHED',
        clubs: { create: clubIds.map((clubId) => ({ clubId })) },
        recipients: {
          create: [
            ...partyIds.map((wecomId) => ({ kind: 'PARTY' as const, wecomId })),
            ...tagIds.map((wecomId) => ({ kind: 'TAG' as const, wecomId })),
            ...userIds.map((wecomId) => ({ kind: 'USER' as const, wecomId })),
          ],
        },
      },
      include: activityInclude,
    });
    const notification = await this.dispatch(activity.id, 'PUBLISH', 'AUTO');
    return {
      ...presentActivity(activity),
      publishStatus: notification.status,
      publishError: notification.errorMessage,
      notification,
    };
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

  async checkIns(user: AuthUser, activityId: string) {
    const activity = await this.owned(user, activityId);
    const clubIds = activity.clubs.map((item) => item.clubId);
    const members = await this.prisma.member.findMany({
      where: { clubId: { in: clubIds } },
      include: {
        club: { select: { name: true } },
        wecomBinding: { select: { id: true } },
        checkIns: { where: { activityId }, select: { checkedAt: true } },
      },
      orderBy: [{ club: { name: 'asc' } }, { rank: 'asc' }],
    });
    return members.map((member) => ({
      id: member.id,
      playerName: member.playerName,
      clubName: member.club.name,
      notifyBound: Boolean(member.wecomBinding),
      checkedIn: member.checkIns.length > 0,
      checkedAt: member.checkIns[0]?.checkedAt.toISOString() ?? null,
    }));
  }

  async notify(user: AuthUser, activityId: string, dto: NotifyActivityDto) {
    const activity = await this.owned(user, activityId);
    if (activity.status !== 'PUBLISHED') throw new ConflictException('活动已结束');
    const kind = dto.kind === 'publish' ? 'PUBLISH' : 'REMIND';
    return this.dispatch(activity.id, kind, 'MANUAL');
  }

  async runDueReminders() {
    const due = await this.prisma.activity.findMany({
      where: {
        status: 'PUBLISHED',
        remindAt: { lte: new Date() },
        remindClaimedAt: null,
      },
      select: { id: true },
      take: 20,
    });
    for (const activity of due) {
      const claimed = await this.prisma.activity.updateMany({
        where: { id: activity.id, status: 'PUBLISHED', remindClaimedAt: null },
        data: { remindClaimedAt: new Date() },
      });
      if (claimed.count !== 1) continue;
      try {
        await this.dispatch(activity.id, 'REMIND', 'AUTO');
      } catch (error) {
        const message = error instanceof Error ? error.message : '发送提醒失败';
        await this.prisma.activityNotification.create({
          data: {
            activityId: activity.id,
            kind: 'REMIND',
            trigger: 'AUTO',
            status: 'FAILED',
            recipientCount: 0,
            errorMessage: message,
          },
        });
      }
    }
  }

  async playerView(player: WecomPlayer, activityId: string) {
    const activity = await this.playerActivity(player, activityId);
    const binding = await this.prisma.wecomBinding.findUnique({
      where: { wecomTeamId_wecomUserId: { wecomTeamId: player.teamId, wecomUserId: player.wecomUserId } },
      include: { member: { include: { club: { select: { id: true, name: true } } } } },
    });
    const clubIds = new Set(activity.clubs.map((item) => item.clubId));
    const member = binding
      ? {
          id: binding.member.id,
          playerName: binding.member.playerName,
          clubName: binding.member.club.name,
        }
      : null;
    const checkedAt = binding
      ? (
          await this.prisma.activityCheckIn.findUnique({
            where: { activityId_memberId: { activityId, memberId: binding.memberId } },
          })
        )?.checkedAt.toISOString() ?? null
      : null;
    if (activity.status === 'ENDED') {
      return { ...presentPlayerActivity(activity), phase: 'closed' as const, member, checkedAt };
    }
    if (!binding) {
      const candidates = await this.prisma.member.findMany({
        where: { clubId: { in: [...clubIds] }, wecomBinding: null },
        include: { club: { select: { name: true } } },
        orderBy: [{ club: { name: 'asc' } }, { rank: 'asc' }],
      });
      return {
        ...presentPlayerActivity(activity),
        phase: 'unbound' as const,
        candidates: candidates.map((item) => ({
          id: item.id,
          playerName: item.playerName,
          clubName: item.club.name,
        })),
      };
    }
    if (!clubIds.has(binding.member.clubId)) {
      return { ...presentPlayerActivity(activity), phase: 'other_club' as const, member, checkedAt: null };
    }
    return { ...presentPlayerActivity(activity), phase: 'ready' as const, member, checkedAt };
  }

  async bind(player: WecomPlayer, activityId: string, dto: BindMemberDto) {
    const activity = await this.openActivity(player, activityId);
    const clubIds = new Set(activity.clubs.map((item) => item.clubId));
    const member = await this.prisma.member.findFirst({
      where: { id: dto.memberId, club: { wecomTeamId: player.teamId } },
      include: { club: { select: { id: true, name: true } } },
    });
    if (!member || !clubIds.has(member.clubId)) throw new ConflictException('只能绑定本场活动的角色');
    const existingUser = await this.prisma.wecomBinding.findUnique({
      where: { wecomTeamId_wecomUserId: { wecomTeamId: player.teamId, wecomUserId: player.wecomUserId } },
    });
    if (existingUser) throw new ConflictException('你已绑定其他角色');
    const existingMember = await this.prisma.wecomBinding.findUnique({ where: { memberId: member.id } });
    if (existingMember) throw new ConflictException('该角色已被绑定');
    try {
      await this.prisma.wecomBinding.create({
        data: { wecomTeamId: player.teamId, wecomUserId: player.wecomUserId, memberId: member.id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('该角色已被绑定');
      }
      throw error;
    }
    return {
      member: { id: member.id, playerName: member.playerName, clubName: member.club.name },
    };
  }

  async checkIn(player: WecomPlayer, activityId: string) {
    const activity = await this.openActivity(player, activityId);
    const binding = await this.prisma.wecomBinding.findUnique({
      where: { wecomTeamId_wecomUserId: { wecomTeamId: player.teamId, wecomUserId: player.wecomUserId } },
      include: { member: true },
    });
    if (!binding) throw new ConflictException('请先绑定角色');
    const clubIds = new Set(activity.clubs.map((item) => item.clubId));
    if (!clubIds.has(binding.member.clubId)) throw new ConflictException('已绑定其他俱乐部的角色，不能签到这场');
    const existing = await this.prisma.activityCheckIn.findUnique({
      where: { activityId_memberId: { activityId, memberId: binding.memberId } },
    });
    if (existing) return { checkedAt: existing.checkedAt.toISOString() };
    try {
      const created = await this.prisma.activityCheckIn.create({
        data: { activityId, memberId: binding.memberId, wecomUserId: player.wecomUserId },
      });
      return { checkedAt: created.checkedAt.toISOString() };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const again = await this.prisma.activityCheckIn.findUnique({
          where: { activityId_memberId: { activityId, memberId: binding.memberId } },
        });
        if (again) return { checkedAt: again.checkedAt.toISOString() };
      }
      throw error;
    }
  }

  private async dispatch(activityId: string, kind: NotificationKind, trigger: NotificationTrigger) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: { clubs: { include: { club: { select: { name: true } } } }, recipients: true },
    });
    if (!activity) throw new NotFoundException('活动不存在');
    const clubNames = activity.clubs.map((item) => item.club.name);
    const description = this.wecom.cardDescription(clubNames, activity.startsAt);
    const url = this.wecom.activityUrl(activity.id);
    const audience =
      kind === 'PUBLISH'
        ? {
            partyIds: activity.recipients.filter((item) => item.kind === 'PARTY').map((item) => item.wecomId),
            tagIds: activity.recipients.filter((item) => item.kind === 'TAG').map((item) => item.wecomId),
            userIds: activity.recipients.filter((item) => item.kind === 'USER').map((item) => item.wecomId),
          }
        : { partyIds: [], tagIds: [], userIds: await this.remindUserIds(activity.id) };
    const sent = await this.wecom.sendTextCard({
      title: activity.title,
      description,
      url,
      ...audience,
    });
    return this.prisma.activityNotification.create({
      data: {
        activityId,
        kind,
        trigger,
        status: sent.ok ? 'SENT' : 'FAILED',
        recipientCount: sent.recipientCount,
        errorMessage: sent.errorMessage,
      },
      select: { id: true, kind: true, trigger: true, status: true, recipientCount: true, errorMessage: true, createdAt: true },
    });
  }

  private async remindUserIds(activityId: string): Promise<string[]> {
    const links = await this.prisma.activityClub.findMany({
      where: { activityId },
      select: { clubId: true },
    });
    const bindings = await this.prisma.wecomBinding.findMany({
      where: { member: { clubId: { in: links.map((item) => item.clubId) } } },
      select: { wecomUserId: true },
    });
    return [...new Set(bindings.map((item) => item.wecomUserId))];
  }

  private async ownedClubs(user: AuthUser, clubIds: string[]) {
    const clubs = await this.prisma.club.findMany({
      where: { id: { in: clubIds }, AND: [this.access.clubWhere(user)] },
      select: { id: true, wecomTeamId: true, name: true },
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

  private async playerActivity(player: WecomPlayer, activityId: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, wecomTeamId: player.teamId },
      include: { clubs: { include: { club: { select: { id: true, name: true } } } } },
    });
    if (!activity) throw new NotFoundException('活动不存在');
    return activity;
  }

  private async openActivity(player: WecomPlayer, activityId: string) {
    const activity = await this.playerActivity(player, activityId);
    if (activity.status !== 'PUBLISHED') throw new ConflictException('活动已结束');
    return activity;
  }
}

function cleanIds(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((item) => item.trim()).filter(Boolean))];
}

function presentActivity(activity: Prisma.ActivityGetPayload<{ include: typeof activityInclude }>) {
  const publish = activity.notifications.find((item) => item.kind === 'PUBLISH');
  return {
    id: activity.id,
    title: activity.title,
    status: activity.status,
    startsAt: activity.startsAt.toISOString(),
    remindAt: activity.remindAt?.toISOString() ?? null,
    publishedAt: activity.publishedAt.toISOString(),
    endedAt: activity.endedAt?.toISOString() ?? null,
    clubs: activity.clubs.map((item) => ({ id: item.club.id, name: item.club.name })),
    recipients: activity.recipients.map((item) => ({ kind: item.kind, wecomId: item.wecomId })),
    publishStatus: publish?.status ?? null,
    publishError: publish?.errorMessage ?? null,
    notifications: activity.notifications.map((item) => ({
      id: item.id,
      kind: item.kind,
      trigger: item.trigger,
      status: item.status,
      recipientCount: item.recipientCount,
      errorMessage: item.errorMessage,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

function presentPlayerActivity(activity: {
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

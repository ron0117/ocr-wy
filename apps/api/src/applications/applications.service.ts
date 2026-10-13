import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@ocr/shared-types';
import { Prisma } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { PrismaService } from '../prisma/prisma.module';
import type { DecideApplicationDto, SubmitApplicationDto } from './dto';

const applicationInclude = {
  club: { select: { name: true } },
} satisfies Prisma.ApplicationInclude;

type ApplicationRow = Prisma.ApplicationGetPayload<{ include: typeof applicationInclude }>;

function presentList(row: ApplicationRow) {
  return {
    id: row.id,
    gameName: row.gameName,
    score: row.score,
    uid: row.uid,
    clubName: row.club?.name ?? row.clubName,
    createdAt: row.createdAt,
    read: row.readAt !== null,
    decision: row.decision,
  };
}

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  listPublicClubs() {
    return this.prisma.club.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async submit(dto: SubmitApplicationDto) {
    const club = await this.prisma.club.findUnique({
      where: { id: dto.clubId },
      select: { id: true, name: true },
    });
    if (!club) throw new BadRequestException('所选工会不存在');
    await this.prisma.application.create({
      data: {
        clubId: club.id,
        clubName: club.name,
        gameName: dto.gameName,
        score: dto.score,
        uid: dto.uid,
        reason: dto.reason,
      },
    });
    return { ok: true };
  }

  async list(user: AuthUser, read: 'unread' | 'read') {
    const rows = await this.prisma.application.findMany({
      where: {
        AND: [this.scope(user), { readAt: read === 'read' ? { not: null } : null }],
      },
      include: applicationInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(presentList);
  }

  async detail(user: AuthUser, id: string) {
    const existing = await this.findVisible(user, id);
    if (!existing.readAt) {
      await this.prisma.application.updateMany({
        where: { id: existing.id, readAt: null },
        data: { readAt: new Date() },
      });
    }
    const row = await this.prisma.application.findUniqueOrThrow({
      where: { id: existing.id },
      include: applicationInclude,
    });
    return { ...presentList(row), reason: row.reason };
  }

  async decide(user: AuthUser, id: string, dto: DecideApplicationDto) {
    const existing = await this.findVisible(user, id);
    const row = await this.prisma.application.update({
      where: { id: existing.id },
      data: { decision: dto.decision },
      include: applicationInclude,
    });
    return presentList(row);
  }

  private scope(user: AuthUser): Prisma.ApplicationWhereInput {
    if (user.isSuper) return {};
    return { club: this.access.clubWhere(user) };
  }

  private async findVisible(user: AuthUser, id: string) {
    const row = await this.prisma.application.findFirst({
      where: { id, AND: [this.scope(user)] },
      select: { id: true, readAt: true },
    });
    if (!row) throw new NotFoundException('申请不存在');
    return row;
  }
}

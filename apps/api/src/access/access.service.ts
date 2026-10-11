import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '@ocr/shared-types';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  clubWhere(user: AuthUser): Prisma.ClubWhereInput {
    if (user.isSuper) return {};
    if (!user.roleId) return { id: { in: [] } };
    return { roleClubs: { some: { roleId: user.roleId } } };
  }

  activityWhere(user: AuthUser): Prisma.ActivityWhereInput {
    if (user.isSuper) return {};
    if (!user.roleId) return { id: { in: [] } };
    return {
      clubs: {
        some: {},
        every: { club: { roleClubs: { some: { roleId: user.roleId } } } },
      },
    };
  }

  async assertClub(user: AuthUser, clubId: string) {
    const club = await this.prisma.club.findFirst({
      where: { id: clubId, AND: [this.clubWhere(user)] },
    });
    if (!club) throw new NotFoundException('俱乐部不存在');
    return club;
  }

  async visibleClubIds(user: AuthUser): Promise<string[] | null> {
    if (user.isSuper) return null;
    if (!user.roleId) return [];
    const rows = await this.prisma.roleClub.findMany({
      where: { roleId: user.roleId },
      select: { clubId: true },
    });
    return rows.map((row) => row.clubId);
  }
}

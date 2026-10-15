import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '@ocr/shared-types';
import { Prisma } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { PrismaService } from '../prisma/prisma.module';
import { CreateClubDto, UpdateClubDto } from './dto';

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

const clubSelect = {
  id: true,
  name: true,
  leader: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { email: true } },
} satisfies Prisma.ClubSelect;

function present(row: Prisma.ClubGetPayload<{ select: typeof clubSelect }>) {
  return {
    id: row.id,
    name: row.name,
    leader: row.leader,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    creatorEmail: row.user?.email ?? null,
  };
}

@Injectable()
export class ClubsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly access: AccessService,
  ) {}

  async list(user: AuthUser) {
    const rows = await this.prisma.club.findMany({
      where: this.access.clubWhere(user),
      orderBy: { createdAt: 'desc' },
      select: clubSelect,
    });
    return rows.map(present);
  }

  async create(user: AuthUser, dto: CreateClubDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('请填写俱乐部名称');
    try {
      const corpId = this.config.get<string>('WECOM_CORP_ID')?.trim();
      const team = corpId ? await this.prisma.wecomTeam.findUnique({ where: { corpId } }) : null;
      return await this.prisma.$transaction(async (tx) => {
        const club = await tx.club.create({
          data: { userId: user.id, name, leader: blankToNull(dto.leader), wecomTeamId: team?.id },
          select: clubSelect,
        });
        if (user.roleId) {
          await tx.roleClub.create({ data: { roleId: user.roleId, clubId: club.id } });
        }
        return present(club);
      });
    } catch (error) {
      this.rethrowDuplicate(error);
    }
  }

  async update(user: AuthUser, clubId: string, dto: UpdateClubDto) {
    if (dto.name === undefined && dto.leader === undefined) {
      throw new BadRequestException('请填写要修改的内容');
    }
    await this.findOwned(user, clubId);
    const data: Prisma.ClubUpdateInput = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('请填写俱乐部名称');
      data.name = name;
    }
    if (dto.leader !== undefined) data.leader = blankToNull(dto.leader);
    try {
      const row = await this.prisma.club.update({
        where: { id: clubId },
        data,
        select: clubSelect,
      });
      return present(row);
    } catch (error) {
      this.rethrowDuplicate(error);
    }
  }

  async remove(user: AuthUser, clubId: string) {
    await this.findOwned(user, clubId);
    const members = await this.prisma.member.count({ where: { clubId } });
    if (members > 0) throw new ConflictException('俱乐部已有人员，不能删除');
    const activities = await this.prisma.activityClub.count({ where: { clubId } });
    const attendances = await this.prisma.activityAttendance.count({ where: { clubId } });
    if (activities > 0 || attendances > 0) throw new ConflictException('俱乐部已被活动使用，不能删除');
    await this.prisma.club.delete({ where: { id: clubId } });
    return { ok: true };
  }

  async findOwned(user: AuthUser, clubId: string) {
    return this.access.assertClub(user, clubId);
  }

  private rethrowDuplicate(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('俱乐部名称已存在');
    }
    throw error;
  }
}

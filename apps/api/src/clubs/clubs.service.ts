import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { CreateClubDto, UpdateClubDto } from './dto';

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

@Injectable()
export class ClubsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.club.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, leader: true, createdAt: true, updatedAt: true },
    });
  }

  async create(userId: string, dto: CreateClubDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('请填写俱乐部名称');
    try {
      return await this.prisma.club.create({
        data: { userId, name, leader: blankToNull(dto.leader) },
        select: { id: true, name: true, leader: true, createdAt: true, updatedAt: true },
      });
    } catch (error) {
      this.rethrowDuplicate(error);
    }
  }

  async update(userId: string, clubId: string, dto: UpdateClubDto) {
    if (dto.name === undefined && dto.leader === undefined) {
      throw new BadRequestException('请填写要修改的内容');
    }
    await this.findOwned(userId, clubId);
    const data: Prisma.ClubUpdateInput = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('请填写俱乐部名称');
      data.name = name;
    }
    if (dto.leader !== undefined) data.leader = blankToNull(dto.leader);
    try {
      return await this.prisma.club.update({
        where: { id: clubId },
        data,
        select: { id: true, name: true, leader: true, createdAt: true, updatedAt: true },
      });
    } catch (error) {
      this.rethrowDuplicate(error);
    }
  }

  async remove(userId: string, clubId: string) {
    await this.findOwned(userId, clubId);
    const members = await this.prisma.member.count({ where: { clubId } });
    if (members > 0) throw new ConflictException('俱乐部已有人员，不能删除');
    await this.prisma.club.delete({ where: { id: clubId } });
    return { ok: true };
  }

  async findOwned(userId: string, clubId: string) {
    const club = await this.prisma.club.findFirst({ where: { id: clubId, userId } });
    if (!club) throw new NotFoundException('俱乐部不存在');
    return club;
  }

  private rethrowDuplicate(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('俱乐部名称已存在');
    }
    throw error;
  }
}

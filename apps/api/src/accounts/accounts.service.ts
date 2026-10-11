import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '@ocr/shared-types';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.module';
import type { CreateAccountDto, ListAccountsQuery, UpdateAccountDto } from './dto';

const accountSelect = {
  id: true,
  email: true,
  name: true,
  disabled: true,
  roleId: true,
  role: { select: { id: true, name: true, isSuper: true } },
} satisfies Prisma.UserSelect;

type AccountRow = Prisma.UserGetPayload<{ select: typeof accountSelect }>;

function present(row: AccountRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    disabled: row.disabled,
    roleId: row.roleId,
    roleName: row.role?.name ?? null,
  };
}

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAccountsQuery) {
    const email = query.email?.trim();
    const rows = await this.prisma.user.findMany({
      where: email ? { email: { contains: email, mode: 'insensitive' } } : {},
      select: accountSelect,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(present);
  }

  async create(dto: CreateAccountDto) {
    const email = dto.email.trim().toLowerCase();
    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) throw new NotFoundException('角色不存在');
    if (role.isSuper) throw new ConflictException('不能指定超级管理员角色');
    try {
      const row = await this.prisma.user.create({
        data: {
          email,
          passwordHash: await bcrypt.hash(dto.password, 10),
          name: blankToNull(dto.name),
          roleId: role.id,
          disabled: false,
        },
        select: accountSelect,
      });
      return present(row);
    } catch (error) {
      this.rethrowEmail(error);
    }
  }

  async update(actor: AuthUser, accountId: string, dto: UpdateAccountDto) {
    const existing = await this.find(accountId);
    const targetIsSuper = Boolean(existing.role?.isSuper);
    if (targetIsSuper && dto.disabled === true) throw new ConflictException('不能停用超级管理员');
    if (targetIsSuper && dto.roleId && dto.roleId !== existing.roleId) {
      throw new ConflictException('不能修改超级管理员');
    }
    if (dto.disabled === true && existing.id === actor.id) throw new ConflictException('不能停用当前账号');

    let roleId = existing.roleId;
    if (dto.roleId && dto.roleId !== existing.roleId) {
      const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
      if (!role) throw new NotFoundException('角色不存在');
      if (role.isSuper) throw new ConflictException('不能指定超级管理员角色');
      roleId = role.id;
    }

    const disabled = dto.disabled ?? existing.disabled;
    if (!disabled && !roleId) throw new BadRequestException('请选择角色');

    const password = dto.password?.trim() ?? '';
    if (password && password.length < 8) throw new BadRequestException('密码至少 8 位');

    const row = await this.prisma.user.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined ? { name: blankToNull(dto.name) } : {}),
        ...(dto.roleId && dto.roleId !== existing.roleId ? { roleId } : {}),
        ...(dto.disabled !== undefined ? { disabled } : {}),
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      },
      select: accountSelect,
    });
    return present(row);
  }

  async remove(actor: AuthUser, accountId: string) {
    const existing = await this.find(accountId);
    if (existing.id === actor.id) throw new ConflictException('不能删除当前账号');
    if (existing.role?.isSuper) throw new ConflictException('不能删除超级管理员');
    try {
      await this.prisma.user.delete({ where: { id: existing.id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('账号仍有关联的任务或模板，不能删除');
      }
      throw error;
    }
    return { ok: true };
  }

  private async find(accountId: string) {
    const row = await this.prisma.user.findUnique({ where: { id: accountId }, select: accountSelect });
    if (!row) throw new NotFoundException('账号不存在');
    return row;
  }

  private rethrowEmail(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('邮箱已存在');
    }
    throw error;
  }
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

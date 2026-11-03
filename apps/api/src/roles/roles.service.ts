import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isMenuKey, SUPER_ONLY_MENU_KEYS, type AuthUser } from '@ocr/shared-types';
import { Prisma } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { PrismaService } from '../prisma/prisma.module';
import type { WriteRoleDto } from './dto';

const roleInclude = {
  menus: { select: { menuKey: true } },
  clubs: { select: { clubId: true } },
} satisfies Prisma.RoleInclude;

type RoleRow = Prisma.RoleGetPayload<{ include: typeof roleInclude }>;

function present(row: RoleRow) {
  return {
    id: row.id,
    name: row.name,
    isSuper: row.isSuper,
    menuKeys: row.menus.map((item) => item.menuKey),
    clubIds: row.clubs.map((item) => item.clubId),
    menuCount: row.menus.length,
    clubCount: row.clubs.length,
  };
}

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async list(actor: AuthUser) {
    this.assertCanRead(actor);
    const omitSuper = !actor.isSuper && !actor.menuKeys.includes('roles');
    const rows = await this.prisma.role.findMany({
      where: omitSuper ? { isSuper: false } : {},
      include: roleInclude,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(present);
  }

  async create(actor: AuthUser, dto: WriteRoleDto) {
    const name = this.cleanName(dto.name);
    const menuKeys = this.cleanMenus(dto.menuKeys);
    const clubIds = await this.cleanClubs(actor, dto.clubIds);
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const role = await tx.role.create({ data: { name, isSuper: false } });
        await this.writeMenus(tx, role.id, menuKeys);
        await this.replaceClubs(tx, actor, role.id, clubIds);
        return tx.role.findUniqueOrThrow({ where: { id: role.id }, include: roleInclude });
      });
      return present(row);
    } catch (error) {
      this.rethrowName(error);
    }
  }

  async update(actor: AuthUser, roleId: string, dto: WriteRoleDto) {
    const existing = await this.find(roleId);
    if (existing.isSuper) throw new ConflictException('不能修改超级管理员角色');
    const name = this.cleanName(dto.name);
    const menuKeys = this.cleanMenus(dto.menuKeys);
    const clubIds = await this.cleanClubs(actor, dto.clubIds);
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        await tx.role.update({ where: { id: roleId }, data: { name } });
        await tx.roleMenu.deleteMany({ where: { roleId } });
        await this.writeMenus(tx, roleId, menuKeys);
        await this.replaceClubs(tx, actor, roleId, clubIds);
        return tx.role.findUniqueOrThrow({ where: { id: roleId }, include: roleInclude });
      });
      return present(row);
    } catch (error) {
      this.rethrowName(error);
    }
  }

  async remove(roleId: string) {
    const existing = await this.find(roleId);
    if (existing.isSuper) throw new ConflictException('不能删除超级管理员角色');
    const users = await this.prisma.user.count({ where: { roleId } });
    if (users > 0) throw new ConflictException('仍有账号使用该角色');
    await this.prisma.role.delete({ where: { id: roleId } });
    return { ok: true };
  }

  private assertCanRead(actor: AuthUser) {
    if (actor.isSuper || actor.menuKeys.includes('accounts') || actor.menuKeys.includes('roles')) return;
    throw new ForbiddenException('没有权限');
  }

  private async find(roleId: string) {
    const row = await this.prisma.role.findUnique({ where: { id: roleId }, include: roleInclude });
    if (!row) throw new NotFoundException('角色不存在');
    return row;
  }

  private cleanName(name: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('请填写角色名称');
    return trimmed;
  }

  private cleanMenus(menuKeys: string[]) {
    const unique = [...new Set(menuKeys)];
    const superOnly = new Set<string>(SUPER_ONLY_MENU_KEYS);
    if (unique.some((key) => !isMenuKey(key) || superOnly.has(key))) {
      throw new BadRequestException('菜单不正确');
    }
    return unique;
  }

  private async cleanClubs(actor: AuthUser, clubIds: string[]) {
    const unique = [...new Set(clubIds)];
    if (actor.isSuper) {
      const found = await this.prisma.club.count({ where: { id: { in: unique } } });
      if (found !== unique.length) throw new BadRequestException('俱乐部不存在');
      return unique;
    }
    const visible = new Set(await this.access.visibleClubIds(actor));
    if (unique.some((id) => !visible.has(id))) throw new BadRequestException('只能分配自己能看到的俱乐部');
    return unique;
  }

  private async writeMenus(tx: Prisma.TransactionClient, roleId: string, menuKeys: string[]) {
    if (menuKeys.length === 0) return;
    await tx.roleMenu.createMany({ data: menuKeys.map((menuKey) => ({ roleId, menuKey })) });
  }

  private async replaceClubs(tx: Prisma.TransactionClient, actor: AuthUser, roleId: string, clubIds: string[]) {
    if (actor.isSuper) {
      await tx.roleClub.deleteMany({ where: { roleId } });
    } else {
      const visible = await this.access.visibleClubIds(actor);
      await tx.roleClub.deleteMany({ where: { roleId, clubId: { in: visible ?? [] } } });
    }
    if (clubIds.length === 0) return;
    await tx.roleClub.createMany({ data: clubIds.map((clubId) => ({ roleId, clubId })) });
  }

  private rethrowName(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('角色名称已存在');
    }
    throw error;
  }
}

import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MENU_KEYS } from '@ocr/shared-types';
import * as bcrypt from 'bcryptjs';
import { toAuthUser } from '../access/present';
import { PrismaService } from '../prisma/prisma.module';
import type { LoginDto } from './dto';

const SUPER_ROLE_NAME = '超级管理员';

const userWithRole = {
  role: { include: { menus: { select: { menuKey: true } } } },
} as const;

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const role = await this.prisma.role.upsert({
      where: { name: SUPER_ROLE_NAME },
      create: { name: SUPER_ROLE_NAME, isSuper: true },
      update: { isSuper: true },
    });
    await this.prisma.roleMenu.createMany({
      data: MENU_KEYS.map((menuKey) => ({ roleId: role.id, menuKey })),
      skipDuplicates: true,
    });

    const email = this.config.get<string>('SUPER_ADMIN_EMAIL')?.trim().toLowerCase();
    const password = this.config.get<string>('SUPER_ADMIN_PASSWORD') ?? '';
    if (!email || !password) {
      this.logger.error('未配置 SUPER_ADMIN_EMAIL 或 SUPER_ADMIN_PASSWORD，无法预置超级管理员');
      return;
    }
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (!existing) {
      if (password.length < 8 || password.length > 72) {
        this.logger.error('SUPER_ADMIN_PASSWORD 长度需在 8 到 72 位之间，未创建超级管理员');
        return;
      }
      await this.prisma.user.create({
        data: {
          email,
          passwordHash: await bcrypt.hash(password, 10),
          roleId: role.id,
          disabled: false,
        },
      });
      return;
    }
    await this.prisma.user.update({
      where: { id: existing.id },
      data: { disabled: false, roleId: role.id },
    });
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email }, include: userWithRole });
    const matched = user ? await bcrypt.compare(dto.password, user.passwordHash) : false;
    if (!user || !matched || user.disabled) {
      throw new UnauthorizedException('邮箱或密码不正确');
    }
    return this.issue(user);
  }

  private issue(user: Parameters<typeof toAuthUser>[0]) {
    const authUser = toAuthUser(user);
    return {
      token: this.jwt.sign({ sub: user.id, email: user.email }),
      user: authUser,
    };
  }
}

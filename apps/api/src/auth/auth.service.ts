import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthUser } from '@ocr/shared-types';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.module';
import type { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('该邮箱已注册');
    }
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        name: dto.name?.trim() || null,
      },
    });
    return this.issue(user);
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const matched = user ? await bcrypt.compare(dto.password, user.passwordHash) : false;
    if (!user || !matched) {
      throw new UnauthorizedException('邮箱或密码不正确');
    }
    return this.issue(user);
  }

  private issue(user: { id: string; email: string; name: string | null }) {
    const authUser: AuthUser = { id: user.id, email: user.email, name: user.name };
    return {
      token: this.jwt.sign({ sub: user.id, email: user.email }),
      user: authUser,
    };
  }
}

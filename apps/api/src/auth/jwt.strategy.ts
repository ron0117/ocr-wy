import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { AuthUser } from '@ocr/shared-types';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { toAuthUser } from '../access/present';
import { PrismaService } from '../prisma/prisma.module';

interface JwtPayload {
  sub?: string;
  email?: string;
  typ?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload.sub || payload.typ === 'wecom') throw new UnauthorizedException('登录已失效');
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: { include: { menus: { select: { menuKey: true } } } } },
    });
    if (!user || user.disabled) {
      throw new UnauthorizedException('登录已失效');
    }
    return toAuthUser(user);
  }
}

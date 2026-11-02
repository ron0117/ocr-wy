import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

@Injectable()
export class GuideAdminTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.GUIDE_ADMIN_TOKEN?.trim();
    if (!expected) {
      throw new UnauthorizedException('管理接口未配置 GUIDE_ADMIN_TOKEN');
    }

    const req = context.switchToHttp().getRequest<{ headers: { authorization?: string } }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('需要 Bearer 管理员凭证');
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token || !tokensMatch(token, expected)) {
      throw new UnauthorizedException('管理员凭证无效');
    }
    return true;
  }
}

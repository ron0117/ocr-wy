import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser, MenuKey } from '@ocr/shared-types';

export const MENU_KEY = 'menuKey';

export const RequireMenu = (key: MenuKey) => SetMetadata(MENU_KEY, key);

@Injectable()
export class MenuGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const key = this.reflector.getAllAndOverride<string | undefined>(MENU_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!key) return true;
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (user?.isSuper || user?.menuKeys?.includes(key)) return true;
    throw new ForbiddenException('没有权限');
  }
}

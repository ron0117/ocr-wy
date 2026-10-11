import { Controller, Post, UseGuards } from '@nestjs/common';
import { menusForKeys, type AuthUser } from '@ocr/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('permission')
@UseGuards(JwtAuthGuard)
export class PermissionController {
  @Post()
  permission(@CurrentUser() user: AuthUser) {
    return { menus: menusForKeys(user.menuKeys) };
  }
}

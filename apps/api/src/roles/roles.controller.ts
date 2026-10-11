import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@ocr/shared-types';
import { MenuGuard, RequireMenu } from '../access/menu.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WriteRoleDto } from './dto';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(JwtAuthGuard, MenuGuard)
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.roles.list(user);
  }

  @Post()
  @RequireMenu('roles')
  create(@CurrentUser() user: AuthUser, @Body() dto: WriteRoleDto) {
    return this.roles.create(user, dto);
  }

  @Patch(':id')
  @RequireMenu('roles')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: WriteRoleDto,
  ) {
    return this.roles.update(user, id, dto);
  }

  @Delete(':id')
  @RequireMenu('roles')
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.roles.remove(id);
  }
}

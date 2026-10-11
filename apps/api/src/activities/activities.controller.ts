import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@ocr/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto, NotifyActivityDto } from './dto';

@Controller('activities')
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateActivityDto) {
    return this.activities.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.activities.list(user);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.activities.get(user, id);
  }

  @Post(':id/end')
  end(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.activities.end(user, id);
  }

  @Get(':id/check-ins')
  checkIns(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.activities.checkIns(user, id);
  }

  @Post(':id/notifications')
  notify(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NotifyActivityDto,
  ) {
    return this.activities.notify(user, id, dto);
  }
}

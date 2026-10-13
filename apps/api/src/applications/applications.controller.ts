import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@ocr/shared-types';
import { MenuGuard, RequireMenu } from '../access/menu.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApplicationsService } from './applications.service';
import { DecideApplicationDto, ListApplicationsQuery } from './dto';

@Controller('applications')
@UseGuards(JwtAuthGuard, MenuGuard)
@RequireMenu('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListApplicationsQuery) {
    return this.applications.list(user, query.read);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.applications.detail(user, id);
  }

  @Patch(':id')
  decide(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: DecideApplicationDto,
  ) {
    return this.applications.decide(user, id, dto);
  }
}

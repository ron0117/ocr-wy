import { Body, Controller, ForbiddenException, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@ocr/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClubRankingsService } from './club-rankings.service';

@Controller('club-rankings')
@UseGuards(JwtAuthGuard)
export class ClubRankingsController {
  constructor(private readonly rankings: ClubRankingsService) {}

  @Post()
  replace(@CurrentUser() user: AuthUser, @Body() body: { clubs?: unknown }) {
    if (!user.isSuper) throw new ForbiddenException('没有权限');
    return this.rankings.replace(body?.clubs);
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { BindMemberDto } from './dto';
import { CurrentWecom } from '../wecom/current-wecom.decorator';
import { WecomAuthGuard } from '../wecom/wecom-auth.guard';
import type { WecomPlayer } from '../wecom/wecom.service';

@Controller('player/activities')
@UseGuards(WecomAuthGuard)
export class PlayerController {
  constructor(private readonly activities: ActivitiesService) {}

  @Get(':id')
  view(@CurrentWecom() player: WecomPlayer, @Param('id', ParseUUIDPipe) id: string) {
    return this.activities.playerView(player, id);
  }

  @Post(':id/binding')
  bind(
    @CurrentWecom() player: WecomPlayer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BindMemberDto,
  ) {
    return this.activities.bind(player, id, dto);
  }

  @Post(':id/check-in')
  checkIn(@CurrentWecom() player: WecomPlayer, @Param('id', ParseUUIDPipe) id: string) {
    return this.activities.checkIn(player, id);
  }
}

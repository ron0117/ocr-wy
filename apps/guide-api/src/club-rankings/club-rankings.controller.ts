import { Controller, Get } from '@nestjs/common';
import { ClubRankingsService } from './club-rankings.service';

@Controller('club-rankings')
export class ClubRankingsController {
  constructor(private readonly rankings: ClubRankingsService) {}

  @Get()
  current() {
    return this.rankings.current();
  }
}

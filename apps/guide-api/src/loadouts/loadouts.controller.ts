import { Controller, Get, Param, Query } from '@nestjs/common';
import { LoadoutsService } from './loadouts.service';

@Controller('loadouts')
export class LoadoutsController {
  constructor(private readonly loadouts: LoadoutsService) {}

  @Get()
  list(@Query('pathway') pathway?: string, @Query('scenario') scenario?: string) {
    return this.loadouts.list(pathway, scenario);
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.loadouts.getBySlug(slug);
  }
}

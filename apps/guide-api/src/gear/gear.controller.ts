import { Controller, Get, Param, Query } from '@nestjs/common';
import { GearService } from './gear.service';

@Controller('gear')
export class GearController {
  constructor(private readonly gear: GearService) {}

  @Get()
  list(@Query('pathway') pathway?: string, @Query('slot') slot?: string) {
    return this.gear.list(pathway, slot);
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.gear.getBySlug(slug);
  }
}

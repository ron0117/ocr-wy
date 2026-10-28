import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CreateShareDto } from './create-share.dto';
import { SharesService } from './shares.service';

@Controller('shares')
export class SharesController {
  constructor(private readonly shares: SharesService) {}

  @Post()
  create(@Body() body: CreateShareDto) {
    return this.shares.create(body);
  }

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('pathway') pathway?: string,
    @Query('scenario') scenario?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const size = Math.min(50, Math.max(1, Number(pageSize) || 20));
    return this.shares.list(p, size, {
      pathwaySlug: pathway?.trim() || undefined,
      scenarioCode: scenario?.trim() || undefined,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.shares.getById(id);
  }
}

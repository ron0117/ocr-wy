import { Controller, Get, Param } from '@nestjs/common';
import { PathwaysService } from './pathways.service';

@Controller('pathways')
export class PathwaysController {
  constructor(private readonly pathways: PathwaysService) {}

  @Get()
  list() {
    return this.pathways.list();
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.pathways.getBySlug(slug);
  }
}

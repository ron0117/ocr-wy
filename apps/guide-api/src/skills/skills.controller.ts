import { Controller, Get, Param, Query } from '@nestjs/common';
import { SkillsService } from './skills.service';

@Controller('skills')
export class SkillsController {
  constructor(private readonly skills: SkillsService) {}

  @Get()
  list(@Query('pathway') pathway?: string) {
    return this.skills.list(pathway);
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.skills.getBySlug(slug);
  }
}

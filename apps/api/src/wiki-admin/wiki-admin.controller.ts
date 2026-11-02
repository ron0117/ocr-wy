import { Controller, Delete, Get, Param, Query, UseGuards } from '@nestjs/common';
import { MenuGuard, RequireMenu } from '../access/menu.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WikiAdminService } from './wiki-admin.service';

@Controller('wiki-admin')
@UseGuards(JwtAuthGuard, MenuGuard)
@RequireMenu('wiki-admin')
export class WikiAdminController {
  constructor(private readonly wiki: WikiAdminService) {}

  @Get('shares')
  listShares(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.wiki.listShares(Number(page) || 1, Number(pageSize) || 20);
  }

  @Get('articles')
  listArticles(@Query('limit') limit?: string) {
    return this.wiki.listArticles(Number(limit) || 50);
  }

  @Delete('shares/:id')
  deleteShare(@Param('id') id: string) {
    return this.wiki.deleteShare(id);
  }

  @Delete('articles/:slug')
  deleteArticle(@Param('slug') slug: string) {
    return this.wiki.deleteArticle(slug);
  }
}

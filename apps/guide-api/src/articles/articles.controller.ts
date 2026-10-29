import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CreateArticleDto } from './create-article.dto';
import { ArticlesService } from './articles.service';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    const n = Math.min(100, Math.max(1, Number(limit) || 50));
    return this.articles.list(n);
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.articles.getBySlug(slug);
  }

  @Post()
  create(@Body() body: CreateArticleDto) {
    return this.articles.create(body);
  }
}

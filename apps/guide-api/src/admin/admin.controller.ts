import { Controller, Delete, Param, UseGuards } from '@nestjs/common';
import { ArticlesService } from '../articles/articles.service';
import { SharesService } from '../shares/shares.service';
import { GuideAdminTokenGuard } from './guide-admin-token.guard';

@Controller('admin')
@UseGuards(GuideAdminTokenGuard)
export class AdminController {
  constructor(
    private readonly shares: SharesService,
    private readonly articles: ArticlesService,
  ) {}

  /** 删除一条分享连招码（/codes/:id） */
  @Delete('shares/:id')
  deleteShare(@Param('id') id: string) {
    return this.shares.deleteById(id.trim());
  }

  /** 删除一篇玩家攻略（/guides/:slug） */
  @Delete('articles/:slug')
  deleteArticle(@Param('slug') slug: string) {
    return this.articles.deleteBySlug(slug.trim());
  }
}

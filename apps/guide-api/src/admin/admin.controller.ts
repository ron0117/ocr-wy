import { Body, Controller, Delete, Param, Put, UseGuards } from '@nestjs/common';
import { ArticlesService } from '../articles/articles.service';
import { ClubRankingsService } from '../club-rankings/club-rankings.service';
import { SharesService } from '../shares/shares.service';
import { GuideAdminTokenGuard } from './guide-admin-token.guard';

@Controller('admin')
@UseGuards(GuideAdminTokenGuard)
export class AdminController {
  constructor(
    private readonly shares: SharesService,
    private readonly articles: ArticlesService,
    private readonly rankings: ClubRankingsService,
  ) {}

  /** 覆盖当前俱乐部排行。校验失败时不写库。 */
  @Put('club-rankings')
  replaceClubRankings(@Body() body: { clubs?: unknown }) {
    return this.rankings.replace(body?.clubs);
  }

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

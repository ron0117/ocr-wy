import { Module } from '@nestjs/common';
import { ArticlesModule } from '../articles/articles.module';
import { SharesModule } from '../shares/shares.module';
import { AdminController } from './admin.controller';
import { GuideAdminTokenGuard } from './guide-admin-token.guard';

@Module({
  imports: [SharesModule, ArticlesModule],
  controllers: [AdminController],
  providers: [GuideAdminTokenGuard],
})
export class AdminModule {}

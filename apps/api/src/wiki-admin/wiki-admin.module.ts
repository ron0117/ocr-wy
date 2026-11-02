import { Module } from '@nestjs/common';
import { WikiAdminController } from './wiki-admin.controller';
import { WikiAdminService } from './wiki-admin.service';

@Module({
  controllers: [WikiAdminController],
  providers: [WikiAdminService],
})
export class WikiAdminModule {}

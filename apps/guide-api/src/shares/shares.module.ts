import { Module } from '@nestjs/common';
import { PathwaysModule } from '../pathways/pathways.module';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';

@Module({
  imports: [PathwaysModule],
  controllers: [SharesController],
  providers: [SharesService],
  exports: [SharesService],
})
export class SharesModule {}

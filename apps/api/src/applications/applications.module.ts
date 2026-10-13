import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { ApplyController } from './apply.controller';

@Module({
  imports: [AccessModule],
  controllers: [ApplyController, ApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}

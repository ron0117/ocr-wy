import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { WecomModule } from '../wecom/wecom.module';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { PlayerController } from './player.controller';
import { ReminderService } from './reminder.service';

@Module({
  imports: [AccessModule, WecomModule],
  controllers: [ActivitiesController, PlayerController],
  providers: [ActivitiesService, ReminderService],
})
export class ActivitiesModule {}

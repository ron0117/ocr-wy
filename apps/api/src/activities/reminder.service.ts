import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ActivitiesService } from './activities.service';

@Injectable()
export class ReminderService {
  constructor(private readonly activities: ActivitiesService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  remind() {
    return this.activities.runDueReminders();
  }
}

import { Module } from '@nestjs/common';
import { ActivityRegistrationsController } from './activity-registrations.controller';
import { ActivityRegistrationsService } from './activity-registrations.service';
import { PublicActivitiesController } from './public-activities.controller';

@Module({
  controllers: [PublicActivitiesController, ActivityRegistrationsController],
  providers: [ActivityRegistrationsService],
})
export class ActivityRegistrationsModule {}

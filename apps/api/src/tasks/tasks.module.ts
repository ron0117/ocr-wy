import { Module } from '@nestjs/common';
import { TaskImagesController } from './images.controller';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  controllers: [TasksController, TaskImagesController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}

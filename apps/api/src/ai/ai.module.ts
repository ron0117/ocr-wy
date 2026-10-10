import { Module } from '@nestjs/common';
import { RecordsModule } from '../records/records.module';
import { TasksModule } from '../tasks/tasks.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [TasksModule, RecordsModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}

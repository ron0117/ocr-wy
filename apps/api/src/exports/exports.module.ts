import { Module } from '@nestjs/common';
import { RecordsModule } from '../records/records.module';
import { ResourcesModule } from '../resources/resources.module';
import { TasksModule } from '../tasks/tasks.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';
import { ExcelService } from './excel.service';

@Module({
  imports: [TasksModule, RecordsModule, ResourcesModule],
  controllers: [ExportsController],
  providers: [ExportsService, ExcelService],
})
export class ExportsModule {}

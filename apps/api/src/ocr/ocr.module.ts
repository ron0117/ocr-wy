import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { OcrClient } from './ocr.client';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';

@Module({
  imports: [TasksModule],
  controllers: [OcrController],
  providers: [OcrClient, OcrService],
})
export class OcrModule {}

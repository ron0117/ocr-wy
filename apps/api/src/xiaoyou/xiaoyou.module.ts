import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { IntentClient } from './intent-client';
import { AssistantRateLimit } from './rate-limit';
import { SpeechBook } from './speech';
import { XiaoyouController } from './xiaoyou.controller';
import { XiaoyouService } from './xiaoyou.service';

@Module({
  imports: [AccessModule],
  controllers: [XiaoyouController],
  providers: [XiaoyouService, SpeechBook, IntentClient, AssistantRateLimit],
})
export class XiaoyouModule {}

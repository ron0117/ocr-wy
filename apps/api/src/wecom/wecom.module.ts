import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WecomAuthGuard } from './wecom-auth.guard';
import { WecomController } from './wecom.controller';
import { WecomService } from './wecom.service';

@Module({
  imports: [AuthModule],
  controllers: [WecomController],
  providers: [WecomService, WecomAuthGuard],
  exports: [WecomService, WecomAuthGuard],
})
export class WecomModule {}

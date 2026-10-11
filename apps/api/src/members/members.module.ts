import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { ClubsModule } from '../clubs/clubs.module';
import { OcrClientModule } from '../ocr/ocr-client.module';
import { MemberAiService } from './member-ai.service';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

@Module({
  imports: [AccessModule, ClubsModule, OcrClientModule],
  controllers: [MembersController],
  providers: [MembersService, MemberAiService],
})
export class MembersModule {}

import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@ocr/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RecognizeDto } from '../tasks/dto';
import { OcrService } from './ocr.service';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class OcrController {
  constructor(private readonly ocr: OcrService) {}

  @Post(':taskId/recognize')
  recognize(
    @CurrentUser() user: AuthUser,
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
    @Body() dto: RecognizeDto,
  ) {
    return this.ocr.recognizeTask(taskId, user.id, dto.force === true);
  }
}

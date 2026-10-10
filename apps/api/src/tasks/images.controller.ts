import {
  BadRequestException,
  Controller,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthUser } from '@ocr/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadExceptionFilter } from '../common/upload-exception.filter';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
@UseFilters(UploadExceptionFilter)
export class TaskImagesController {
  constructor(private readonly tasks: TasksService) {}

  @Post(':taskId/images')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        exceptionFactory: () => new BadRequestException('请上传图片文件'),
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.tasks.addImage(taskId, user.id, file);
  }
}

import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { WikiImageUploadDto } from '@ocr/guide-types';
import { memoryStorage } from 'multer';
import { WikiMediaService } from './wiki-media.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly media: WikiMediaService) {}

  @Post('wiki-image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadWikiImage(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<WikiImageUploadDto> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('请选择图片文件');
    }
    const mime = file.mimetype || 'application/octet-stream';
    this.media.assertAllowedImage(mime);
    return this.media.uploadImage(file.buffer, mime);
  }
}

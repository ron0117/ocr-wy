import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { WikiMediaService } from './wiki-media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly media: WikiMediaService) {}

  /** 开发环境：COS 未配置时读取本地上传的 Wiki 图 */
  @Get('local/:key')
  async serveLocal(@Param('key') key: string, @Res() res: Response) {
    try {
      const decoded = decodeURIComponent(key);
      const { buffer, mime } = await this.media.readLocalFile(decoded);
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buffer);
    } catch {
      throw new NotFoundException();
    }
  }
}

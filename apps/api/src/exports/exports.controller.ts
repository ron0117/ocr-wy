import { Controller, Get, Param, ParseUUIDPipe, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthUser } from '@ocr/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { contentDisposition } from '../resources/content-disposition';
import { ExportsService } from './exports.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post('tasks/:taskId/exports')
  create(
    @CurrentUser() user: AuthUser,
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
  ) {
    return this.exportsService.create(taskId, user.id);
  }

  @Get('exports/:exportId/download')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('exportId', new ParseUUIDPipe({ version: '4' })) exportId: string,
    @Res() res: Response,
  ) {
    const { buffer, resource } = await this.exportsService.read(exportId, user.id);
    res.setHeader('Content-Type', resource.contentType);
    res.setHeader('Content-Disposition', contentDisposition(resource.originalName || '商品清单.xlsx'));
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  }
}

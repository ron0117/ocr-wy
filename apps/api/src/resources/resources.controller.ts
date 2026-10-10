import { Controller, Get, Param, ParseUUIDPipe, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthUser } from '@ocr/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { contentDisposition } from './content-disposition';
import { ResourcesService } from './resources.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Get('tasks/:taskId/resources')
  list(
    @CurrentUser() user: AuthUser,
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
  ) {
    return this.resources.list(taskId, user.id);
  }

  @Get('resources/:resourceId/download')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('resourceId', new ParseUUIDPipe({ version: '4' })) resourceId: string,
    @Res() res: Response,
  ) {
    const { buffer, resource } = await this.resources.read(resourceId, user.id);
    res.setHeader('Content-Type', resource.contentType);
    res.setHeader(
      'Content-Disposition',
      contentDisposition(resource.originalName || 'download'),
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  }

  @Get('resources/:resourceId/signed-url')
  signedUrl(
    @CurrentUser() user: AuthUser,
    @Param('resourceId', new ParseUUIDPipe({ version: '4' })) resourceId: string,
  ) {
    return this.resources.signedUrl(resourceId, user.id);
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthUser } from '@ocr/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { contentDisposition } from '../resources/content-disposition';
import { SendAssistantMessageDto } from './dto';
import { XiaoyouService } from './xiaoyou.service';

@Controller('assistant')
@UseGuards(JwtAuthGuard)
export class XiaoyouController {
  constructor(private readonly xiaoyou: XiaoyouService) {}

  @Get('session')
  current(@CurrentUser() user: AuthUser) {
    return this.xiaoyou.current(user);
  }

  @Post('sessions')
  create(@CurrentUser() user: AuthUser) {
    return this.xiaoyou.openSession(user);
  }

  @Post('sessions/:id/messages')
  send(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SendAssistantMessageDto,
  ) {
    return this.xiaoyou.send(user, id, dto);
  }

  @Get('exports/:id')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Res() res: Response,
  ) {
    const file = await this.xiaoyou.readExport(user, id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', contentDisposition(file.fileName));
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(file.buffer);
  }
}

import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ParseUUIDPipe } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WecomService } from './wecom.service';

@Controller('wecom')
export class WecomController {
  constructor(private readonly wecom: WecomService) {}

  @Get('audience')
  @UseGuards(JwtAuthGuard)
  audience() {
    return this.wecom.audience();
  }

  @Get('oauth/start')
  async start(
    @Query('activityId', new ParseUUIDPipe({ version: '4' })) activityId: string,
    @Res() res: Response,
  ) {
    const url = await this.wecom.beginOauth(activityId);
    res.redirect(url);
  }

  @Get('oauth/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    const url = await this.wecom.completeOauth(code, state);
    res.redirect(url);
  }
}

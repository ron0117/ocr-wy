import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { WecomService, type WecomPlayer } from './wecom.service';

export interface WecomRequest extends Request {
  wecomPlayer?: WecomPlayer;
}

@Injectable()
export class WecomAuthGuard implements CanActivate {
  constructor(private readonly wecom: WecomService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<WecomRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('请从企业微信打开');
    try {
      request.wecomPlayer = await this.wecom.verifyPlayer(header.slice('Bearer '.length).trim());
    } catch {
      throw new UnauthorizedException('请从企业微信打开');
    }
    return true;
  }
}

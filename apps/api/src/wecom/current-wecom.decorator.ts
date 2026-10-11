import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { WecomPlayer } from './wecom.service';
import type { WecomRequest } from './wecom-auth.guard';

export const CurrentWecom = createParamDecorator((_: unknown, ctx: ExecutionContext): WecomPlayer => {
  const request = ctx.switchToHttp().getRequest<WecomRequest>();
  return request.wecomPlayer as WecomPlayer;
});

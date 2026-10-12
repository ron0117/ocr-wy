import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { addressAs } from './speech';

const WINDOW_MS = 60_000;
const LIMIT = 20;

@Injectable()
export class AssistantRateLimit {
  private readonly hits = new Map<string, number[]>();

  hit(userId: string, callerName?: string | null) {
    const now = Date.now();
    const recent = (this.hits.get(userId) ?? []).filter((at) => now - at < WINDOW_MS);
    if (recent.length >= LIMIT) {
      this.hits.set(userId, recent);
      throw new HttpException(
        addressAs('管理员，小忧这一分钟里已经帮你办了不少，稍等一下再说话。', callerName),
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.hits.set(userId, recent);
  }
}

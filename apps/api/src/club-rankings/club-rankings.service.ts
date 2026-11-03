import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeClubRankingClubs } from '@ocr/guide-types';

function pickMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const message = (body as { message?: unknown }).message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.filter((item) => typeof item === 'string').join('；') || fallback;
  return fallback;
}

@Injectable()
export class ClubRankingsService {
  constructor(private readonly config: ConfigService) {}

  private apiBase(): string {
    const raw = this.config.get<string>('GUIDE_API_URL')?.trim() || 'http://127.0.0.1:3001';
    return `${raw.replace(/\/$/, '')}/api/v1`;
  }

  private adminToken(): string {
    const token = this.config.get<string>('GUIDE_ADMIN_TOKEN')?.trim();
    if (!token) {
      throw new ServiceUnavailableException('未配置 GUIDE_ADMIN_TOKEN，无法写入俱乐部排行');
    }
    return token;
  }

  async replace(clubs: unknown): Promise<{ count: number }> {
    const parsed = normalizeClubRankingClubs(clubs);
    if (!parsed.ok) throw new BadRequestException(parsed.message);

    let res: Response;
    try {
      res = await fetch(`${this.apiBase()}/admin/club-rankings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.adminToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clubs: parsed.clubs }),
      });
    } catch {
      throw new BadGatewayException('无法连接 Guide API，请检查 GUIDE_API_URL');
    }

    if (res.ok) return (await res.json()) as { count: number };

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    const message = pickMessage(body, `Guide API 错误 (${res.status})`);
    if (res.status === 404) throw new NotFoundException(message);
    if (res.status >= 500) throw new BadGatewayException(message);
    throw new HttpException(message, res.status);
  }
}

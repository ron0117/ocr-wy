import {
  BadGatewayException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GuideArticleListItemDto, ShareListPageDto } from '@ocr/guide-types';

function pickMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const message = (body as { message?: unknown }).message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.filter((item) => typeof item === 'string').join('；') || fallback;
  return fallback;
}

@Injectable()
export class WikiAdminService {
  constructor(private readonly config: ConfigService) {}

  private apiBase(): string {
    const raw =
      this.config.get<string>('GUIDE_API_URL')?.trim() || 'http://127.0.0.1:3001';
    return `${raw.replace(/\/$/, '')}/api/v1`;
  }

  private adminToken(): string {
    const token = this.config.get<string>('GUIDE_ADMIN_TOKEN')?.trim();
    if (!token) {
      throw new ServiceUnavailableException('未配置 GUIDE_ADMIN_TOKEN，无法执行 Wiki 删除');
    }
    return token;
  }

  private async guideFetch<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.apiBase()}${path}`, init);
    } catch {
      throw new BadGatewayException('无法连接 Guide API，请检查 GUIDE_API_URL');
    }
    if (res.ok) {
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    }
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

  listShares(page: number, pageSize: number) {
    const p = Math.max(1, page);
    const size = Math.min(50, Math.max(1, pageSize));
    const qs = new URLSearchParams({ page: String(p), pageSize: String(size) });
    return this.guideFetch<ShareListPageDto>(`/shares?${qs}`);
  }

  listArticles(limit: number) {
    const n = Math.min(100, Math.max(1, limit));
    return this.guideFetch<GuideArticleListItemDto[]>(`/articles?limit=${n}`);
  }

  deleteShare(id: string) {
    const trimmed = id.trim();
    return this.guideFetch<{ deleted: true; id: string }>(`/admin/shares/${encodeURIComponent(trimmed)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.adminToken()}` },
    });
  }

  deleteArticle(slug: string) {
    const trimmed = slug.trim();
    return this.guideFetch<{ deleted: true; slug: string }>(
      `/admin/articles/${encodeURIComponent(trimmed)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.adminToken()}` },
      },
    );
  }
}

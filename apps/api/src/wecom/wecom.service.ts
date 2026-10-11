import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.module';

export interface WecomPlayer {
  wecomUserId: string;
  teamId: string;
}

export interface WecomAudience {
  parties: Array<{ id: string; name: string }>;
  tags: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string }>;
}

export interface SendCardInput {
  title: string;
  description: string;
  url: string;
  partyIds: string[];
  tagIds: string[];
  userIds: string[];
}

export interface SendCardResult {
  ok: boolean;
  recipientCount: number;
  errorMessage: string | null;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

@Injectable()
export class WecomService implements OnModuleInit {
  private readonly logger = new Logger(WecomService.name);
  private tokenCache: TokenCache | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async onModuleInit() {
    if (!this.isConfigured()) return;
    const corpId = this.required('WECOM_CORP_ID');
    const agentId = this.required('WECOM_AGENT_ID');
    const team = await this.prisma.wecomTeam.upsert({
      where: { corpId },
      create: { corpId, agentId, name: '企业微信团队' },
      update: { agentId },
    });
    await this.prisma.club.updateMany({
      where: { wecomTeamId: null },
      data: { wecomTeamId: team.id },
    });
  }

  isConfigured(): boolean {
    return Boolean(this.optional('WECOM_CORP_ID') && this.optional('WECOM_AGENT_ID') && this.optional('WECOM_SECRET') && this.optional('WEB_ORIGIN'));
  }

  assertConfigured() {
    if (!this.isConfigured()) throw new BadRequestException('企业微信未配置');
  }

  origin(): string {
    return this.required('WEB_ORIGIN').replace(/\/$/, '');
  }

  async currentTeam() {
    this.assertConfigured();
    const corpId = this.required('WECOM_CORP_ID');
    const team = await this.prisma.wecomTeam.findUnique({ where: { corpId } });
    if (!team) throw new BadRequestException('企业微信未配置');
    return team;
  }

  async audience(): Promise<WecomAudience> {
    this.assertConfigured();
    const token = await this.accessToken();
    const agentId = this.required('WECOM_AGENT_ID');
    const agent = await this.getJson<{
      errcode?: number;
      errmsg?: string;
      allow_userinfos?: { user?: Array<{ userid?: string }> };
      allow_partys?: { partyid?: number[] };
      allow_tags?: { tagid?: number[] };
    }>(`https://qyapi.weixin.qq.com/cgi-bin/agent/get?access_token=${token}&agentid=${agentId}`);
    this.assertOk(agent, '读取应用可见范围失败');
    const partyIds = (agent.allow_partys?.partyid ?? []).map(String);
    const tagIds = (agent.allow_tags?.tagid ?? []).map(String);
    const userIds = (agent.allow_userinfos?.user ?? []).map((item) => item.userid).filter((id): id is string => Boolean(id));
    const [departments, tags] = await Promise.all([this.departmentNames(token), this.tagNames(token)]);
    return {
      parties: partyIds.map((id) => ({ id, name: departments.get(id) ?? id })),
      tags: tagIds.map((id) => ({ id, name: tags.get(id) ?? id })),
      users: userIds.map((id) => ({ id, name: id })),
    };
  }

  async sendTextCard(input: SendCardInput): Promise<SendCardResult> {
    const partyIds = unique(input.partyIds);
    const tagIds = unique(input.tagIds);
    const userIds = unique(input.userIds);
    const recipientCount = partyIds.length + tagIds.length + userIds.length;
    if (recipientCount === 0) {
      return { ok: true, recipientCount: 0, errorMessage: null };
    }
    try {
      const token = await this.accessToken();
      const agentid = Number(this.required('WECOM_AGENT_ID'));
      let invalid = '';
      for (let index = 0; index < Math.max(userIds.length, 1); index += 1000) {
        const slice = userIds.slice(index, index + 1000);
        const body: Record<string, unknown> = {
          msgtype: 'textcard',
          agentid,
          textcard: {
            title: clipBytes(input.title, 128),
            description: clipBytes(input.description, 512),
            url: input.url,
            btntxt: '去签到',
          },
        };
        if (index === 0) {
          if (partyIds.length > 0) body.toparty = partyIds.join('|');
          if (tagIds.length > 0) body.totag = tagIds.join('|');
        }
        if (slice.length > 0) body.touser = slice.join('|');
        if (!body.touser && !body.toparty && !body.totag) continue;
        const result = await this.postJson<{ errcode?: number; errmsg?: string; invaliduser?: string; invalidparty?: string; invalidtag?: string }>(
          `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`,
          body,
        );
        if (result.errcode !== 0) {
          return { ok: false, recipientCount, errorMessage: result.errmsg || '发送应用消息失败' };
        }
        invalid = [invalid, result.invaliduser, result.invalidparty, result.invalidtag].filter(Boolean).join(',');
      }
      return { ok: true, recipientCount, errorMessage: invalid ? `部分接收人未送达：${invalid}` : null };
    } catch (error) {
      const message = error instanceof Error ? error.message : '发送应用消息失败';
      this.logger.warn(message);
      return { ok: false, recipientCount, errorMessage: message };
    }
  }

  cardDescription(clubNames: string[], startsAt: Date): string {
    const when = startsAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
    const timeLine = `<div class="gray">开始时间：${when}</div>`;
    const prefix = '俱乐部：';
    const budget = 512 - Buffer.byteLength(`${prefix}${timeLine}`);
    let names = clubNames.join('、');
    if (Buffer.byteLength(names) > budget) {
      while (names.length > 0 && Buffer.byteLength(`${names}…`) > budget) names = names.slice(0, -1);
      names = `${names}…`;
    }
    return `${prefix}${names}\n${timeLine}`;
  }

  activityUrl(activityId: string): string {
    return `${this.origin()}/a/${activityId}`;
  }

  async beginOauth(activityId: string): Promise<string> {
    this.assertConfigured();
    const activity = await this.prisma.activity.findUnique({ where: { id: activityId }, select: { id: true } });
    if (!activity) throw new NotFoundException('活动不存在');
    const state = this.signState(activityId);
    const redirectUri = encodeURIComponent(`${this.origin()}/api/v1/wecom/oauth/callback`);
    const appid = this.required('WECOM_CORP_ID');
    const agentid = this.required('WECOM_AGENT_ID');
    return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appid}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_base&state=${state}&agentid=${agentid}#wechat_redirect`;
  }

  async completeOauth(code: string | undefined, state: string | undefined): Promise<string> {
    const activityId = this.readState(state);
    const back = activityId ? `${this.safeOrigin()}/a/${activityId}` : this.safeOrigin();
    if (!activityId || !code) return `${back}${back.includes('?') ? '&' : '?'}error=auth`;
    try {
      this.assertConfigured();
      const token = await this.accessToken();
      const info = await this.getJson<{ errcode?: number; errmsg?: string; userid?: string }>(
        `https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo?access_token=${token}&code=${encodeURIComponent(code)}`,
      );
      if (!info.userid) return `${back}?error=auth`;
      const team = await this.currentTeam();
      const playerToken = await this.jwt.signAsync(
        { typ: 'wecom', wecomUserId: info.userid, teamId: team.id },
        { expiresIn: '12h' },
      );
      return `${back}#token=${encodeURIComponent(playerToken)}`;
    } catch (error) {
      this.logger.warn(error instanceof Error ? error.message : '企业微信身份识别失败');
      return `${back}?error=auth`;
    }
  }

  async verifyPlayer(token: string): Promise<WecomPlayer> {
    try {
      const payload = await this.jwt.verifyAsync<{ typ?: string; wecomUserId?: string; teamId?: string }>(token);
      if (payload.typ !== 'wecom' || !payload.wecomUserId || !payload.teamId) {
        throw new Error('invalid');
      }
      return { wecomUserId: payload.wecomUserId, teamId: payload.teamId };
    } catch {
      throw new BadRequestException('请从企业微信打开');
    }
  }

  private signState(activityId: string): string {
    const payload = Buffer.from(JSON.stringify({ activityId, exp: Date.now() + 10 * 60 * 1000 })).toString('base64url');
    const signature = createHmac('sha256', this.required('JWT_SECRET')).update(payload).digest('base64url');
    return `${payload}.${signature}`;
  }

  private readState(state: string | undefined): string | null {
    if (!state || !this.optional('JWT_SECRET')) return null;
    const [payload, signature] = state.split('.');
    if (!payload || !signature) return null;
    const expected = createHmac('sha256', this.required('JWT_SECRET')).update(payload).digest('base64url');
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
    try {
      const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { activityId?: string; exp?: number };
      if (!parsed.activityId || !parsed.exp || parsed.exp < Date.now()) return null;
      return parsed.activityId;
    } catch {
      return null;
    }
  }

  private async departmentNames(token: string): Promise<Map<string, string>> {
    try {
      const data = await this.getJson<{ errcode?: number; department?: Array<{ id?: number; name?: string }> }>(
        `https://qyapi.weixin.qq.com/cgi-bin/department/list?access_token=${token}`,
      );
      if (data.errcode !== 0) return new Map();
      return new Map((data.department ?? []).filter((item) => item.id != null && item.name).map((item) => [String(item.id), item.name as string]));
    } catch {
      return new Map();
    }
  }

  private async tagNames(token: string): Promise<Map<string, string>> {
    try {
      const data = await this.getJson<{ errcode?: number; taglist?: Array<{ tagid?: number; tagname?: string }> }>(
        `https://qyapi.weixin.qq.com/cgi-bin/tag/list?access_token=${token}`,
      );
      if (data.errcode !== 0) return new Map();
      return new Map((data.taglist ?? []).filter((item) => item.tagid != null && item.tagname).map((item) => [String(item.tagid), item.tagname as string]));
    } catch {
      return new Map();
    }
  }

  private async accessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) return this.tokenCache.token;
    const corpId = this.required('WECOM_CORP_ID');
    const secret = this.required('WECOM_SECRET');
    const data = await this.getJson<{ errcode?: number; errmsg?: string; access_token?: string; expires_in?: number }>(
      `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(corpId)}&corpsecret=${encodeURIComponent(secret)}`,
    );
    this.assertOk(data, '获取企业微信令牌失败');
    if (!data.access_token) throw new Error('获取企业微信令牌失败');
    const expiresIn = data.expires_in ?? 7200;
    this.tokenCache = { token: data.access_token, expiresAt: Date.now() + Math.max(expiresIn - 60, 60) * 1000 };
    return data.access_token;
  }

  private assertOk(data: { errcode?: number; errmsg?: string }, fallback: string) {
    if (data.errcode !== undefined && data.errcode !== 0) {
      throw new Error(data.errmsg || fallback);
    }
  }

  private async getJson<T>(url: string): Promise<T> {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`企业微信接口不可用（${response.status}）`);
    return (await response.json()) as T;
  }

  private async postJson<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`企业微信接口不可用（${response.status}）`);
    return (await response.json()) as T;
  }

  private optional(key: string): string | null {
    const value = this.config.get<string>(key)?.trim();
    return value ? value : null;
  }

  private required(key: string): string {
    const value = this.optional(key);
    if (!value) throw new BadRequestException('企业微信未配置');
    return value;
  }

  private safeOrigin(): string {
    return this.optional('WEB_ORIGIN')?.replace(/\/$/, '') || '';
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function clipBytes(value: string, max: number): string {
  if (Buffer.byteLength(value) <= max) return value;
  let result = value;
  while (result.length > 0 && Buffer.byteLength(`${result}…`) > max) result = result.slice(0, -1);
  return `${result}…`;
}
